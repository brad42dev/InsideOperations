//! PostgreSQL logical replication CDC connector.
//!
//! Source-side requirements (DBA must configure before enabling this connector):
//! 1. postgresql.conf: `wal_level = logical`
//! 2. `CREATE PUBLICATION io_import FOR TABLE <t1>, <t2>, ...;`
//! 3. `SELECT pg_create_logical_replication_slot('io_import_slot', 'pgoutput');`
//! 4. `CREATE ROLE io_replication WITH REPLICATION LOGIN PASSWORD '...';`
//!    `GRANT USAGE ON SCHEMA public TO io_replication;`
//!    `GRANT SELECT ON ALL TABLES IN SCHEMA public TO io_replication;`
//!
//! Connection config keys: host, port (default 5432), database, username
//! Auth config keys: password
//! Source config keys:
//!   slot        — replication slot name (required)
//!   publication — publication name (required)
//!   ssl_mode    — "disable" | "require" (default "disable")
//!   wal_lag_alert_bytes — WAL lag threshold before pg_notify alert (default 1 GiB)

use anyhow::{anyhow, Result};
use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine};
use futures::future::BoxFuture;
use pgwire_replication::{Lsn, ReplicationClient, ReplicationConfig, ReplicationEvent, TlsConfig};
use serde_json::Value as JsonValue;
use std::collections::HashMap;
use std::time::{Duration, Instant};
use tracing::{debug, warn};

use super::{StreamConfig, StreamEvent, StreamingConnector};

const WAL_LAG_ALERT_DEFAULT: u64 = 1_073_741_824; // 1 GiB
const WAL_LAG_ALERT_COOLDOWN: Duration = Duration::from_secs(300); // 5 min

pub struct PgCdcConnector;

struct RelationInfo {
    table_name: String,
    columns: Vec<String>,
}

#[async_trait::async_trait]
impl StreamingConnector for PgCdcConnector {
    fn connector_type(&self) -> &'static str {
        "pg_cdc"
    }

    async fn run(
        &self,
        config: &StreamConfig,
        db: &sqlx::PgPool,
        on_event: Box<dyn Fn(StreamEvent) -> BoxFuture<'static, Result<()>> + Send + Sync>,
    ) -> Result<()> {
        let host = config
            .connection_config
            .get("host")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("pg_cdc: host required in connection_config"))?;
        let port = config
            .connection_config
            .get("port")
            .and_then(|v| v.as_u64())
            .unwrap_or(5432) as u16;
        let database = config
            .connection_config
            .get("database")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("pg_cdc: database required in connection_config"))?;
        let username = config
            .connection_config
            .get("username")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("pg_cdc: username required in connection_config"))?;
        let password = config
            .auth_config
            .get("password")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let slot = config
            .source_config
            .get("slot")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("pg_cdc: slot required in source_config"))?;
        let publication = config
            .source_config
            .get("publication")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("pg_cdc: publication required in source_config"))?;
        let ssl_mode = config
            .source_config
            .get("ssl_mode")
            .and_then(|v| v.as_str())
            .unwrap_or("disable");
        let wal_lag_threshold = config
            .source_config
            .get("wal_lag_alert_bytes")
            .and_then(|v| v.as_u64())
            .unwrap_or(WAL_LAG_ALERT_DEFAULT);

        // Resume from saved LSN
        let start_lsn = config
            .resume_token
            .as_ref()
            .and_then(|t| t.get("lsn"))
            .and_then(|v| v.as_str())
            .and_then(|s| Lsn::parse(s).ok())
            .unwrap_or(Lsn::ZERO);

        let tls = if ssl_mode == "require" {
            TlsConfig::require()
        } else {
            TlsConfig::disabled()
        };

        let cfg = ReplicationConfig {
            host: host.into(),
            port,
            user: username.into(),
            password: password.into(),
            database: database.into(),
            tls,
            slot: slot.into(),
            publication: publication.into(),
            start_lsn,
            stop_at_lsn: None,
            status_interval: Duration::from_secs(10),
            idle_wakeup_interval: Duration::from_secs(10),
            buffer_events: 4096,
        };

        let mut client = ReplicationClient::connect(cfg)
            .await
            .map_err(|e| anyhow!("pg_cdc: failed to connect: {e}"))?;

        // Mark session active
        let _ = sqlx::query(
            "UPDATE import_stream_sessions \
             SET status = 'active', updated_at = NOW() \
             WHERE id = $1 AND status != 'stopped'",
        )
        .bind(config.session_id)
        .execute(db)
        .await;

        let mut rel_map: HashMap<u32, RelationInfo> = HashMap::new();
        let mut last_applied = start_lsn;
        let mut last_alert = Instant::now() - WAL_LAG_ALERT_COOLDOWN;

        loop {
            tokio::select! {
                _ = config.cancel.cancelled() => {
                    client.stop();
                    debug!(session_id = %config.session_id, "pg_cdc cancelled");
                    break;
                }
                result = client.recv() => {
                    let event = match result {
                        Ok(Some(e)) => e,
                        Ok(None) => break,
                        Err(e) => return Err(anyhow!("pg_cdc replication error: {e}")),
                    };
                    match event {
                        ReplicationEvent::KeepAlive { wal_end, .. } => {
                            check_wal_lag(
                                config,
                                db,
                                wal_end,
                                last_applied,
                                wal_lag_threshold,
                                &mut last_alert,
                            )
                            .await;
                        }
                        ReplicationEvent::XLogData { wal_end, data, .. } => {
                            if let Some((op_type, row)) =
                                parse_pgoutput(&data, &mut rel_map)
                            {
                                let data_json = JsonValue::Object(row);
                                let resume = serde_json::json!({ "lsn": wal_end.to_string() });

                                let _ = sqlx::query(
                                    "UPDATE import_stream_sessions \
                                     SET events_received = events_received + 1, \
                                         last_event_at = NOW(), \
                                         updated_at = NOW(), \
                                         resume_token = $2 \
                                     WHERE id = $1",
                                )
                                .bind(config.session_id)
                                .bind(&resume)
                                .execute(db)
                                .await;

                                let stream_event = StreamEvent {
                                    event_type: Some(op_type.to_string()),
                                    data: data_json,
                                    resume_token: Some(resume),
                                };
                                if let Err(e) = on_event(stream_event).await {
                                    warn!(session_id = %config.session_id, "on_event error: {e}");
                                }

                                last_applied = wal_end;
                                client.update_applied_lsn(wal_end);
                            }
                        }
                        ReplicationEvent::Commit { end_lsn, .. } => {
                            last_applied = end_lsn;
                            client.update_applied_lsn(end_lsn);
                        }
                        _ => {}
                    }
                }
            }
        }
        Ok(())
    }
}

/// Check WAL lag and emit a pg_notify alert if threshold exceeded.
async fn check_wal_lag(
    config: &StreamConfig,
    db: &sqlx::PgPool,
    wal_end: Lsn,
    applied: Lsn,
    threshold: u64,
    last_alert: &mut Instant,
) {
    let lag = wal_end.as_u64().saturating_sub(applied.as_u64());
    if lag >= threshold && last_alert.elapsed() >= WAL_LAG_ALERT_COOLDOWN {
        let lag_mb = lag as f64 / 1_048_576.0;
        warn!(
            session_id = %config.session_id,
            lag_mb = lag_mb,
            "pg_cdc WAL lag exceeds threshold"
        );
        let msg = format!(
            "WAL lag alert for session {}: {lag_mb:.1} MiB behind (slot may block vacuuming)",
            config.session_id
        );
        let _ = sqlx::query("SELECT pg_notify('import_alert', $1)")
            .bind(msg)
            .execute(db)
            .await;
        *last_alert = Instant::now();
    }
}

// ---------------------------------------------------------------------------
// pgoutput protocol parser
// ---------------------------------------------------------------------------

/// Parse a single pgoutput message.  Returns `(op_type, data_map)` for DML
/// operations, or `None` for schema/control messages.
fn parse_pgoutput(
    data: &[u8],
    rel_map: &mut HashMap<u32, RelationInfo>,
) -> Option<(&'static str, serde_json::Map<String, JsonValue>)> {
    if data.is_empty() {
        return None;
    }
    let mut pos = 1usize; // skip message type byte
    match data[0] {
        b'R' => {
            // Relation — update the relation map; no event emitted
            if let Some((oid, table_name, columns)) = pg_parse_relation(data, &mut pos) {
                rel_map.insert(oid, RelationInfo { table_name, columns });
            }
            None
        }
        b'I' => {
            let oid = pg_read_u32_be(data, &mut pos)?;
            if pg_read_u8(data, &mut pos)? != b'N' {
                return None;
            }
            let rel = rel_map.get(&oid)?;
            let mut m = serde_json::Map::new();
            m.insert("op".into(), "insert".into());
            m.insert("table".into(), rel.table_name.clone().into());
            m.insert("row".into(), JsonValue::Object(pg_parse_tuple(data, &mut pos, &rel.columns)));
            Some(("insert", m))
        }
        b'U' => {
            let oid = pg_read_u32_be(data, &mut pos)?;
            let rel = rel_map.get(&oid)?;
            let t = pg_read_u8(data, &mut pos)?;
            // Skip optional old tuple (K = key, O = old full)
            if t == b'K' || t == b'O' {
                let _old = pg_parse_tuple(data, &mut pos, &rel.columns);
                if pg_read_u8(data, &mut pos)? != b'N' {
                    return None;
                }
            } else if t != b'N' {
                return None;
            }
            let mut m = serde_json::Map::new();
            m.insert("op".into(), "update".into());
            m.insert("table".into(), rel.table_name.clone().into());
            m.insert("after".into(), JsonValue::Object(pg_parse_tuple(data, &mut pos, &rel.columns)));
            Some(("update", m))
        }
        b'D' => {
            let oid = pg_read_u32_be(data, &mut pos)?;
            let rel = rel_map.get(&oid)?;
            let t = pg_read_u8(data, &mut pos)?;
            if t != b'K' && t != b'O' {
                return None;
            }
            let mut m = serde_json::Map::new();
            m.insert("op".into(), "delete".into());
            m.insert("table".into(), rel.table_name.clone().into());
            m.insert("row".into(), JsonValue::Object(pg_parse_tuple(data, &mut pos, &rel.columns)));
            Some(("delete", m))
        }
        _ => None,
    }
}

fn pg_parse_relation(data: &[u8], pos: &mut usize) -> Option<(u32, String, Vec<String>)> {
    let oid = pg_read_u32_be(data, pos)?;
    let _namespace = pg_read_cstring(data, pos);
    let table_name = pg_read_cstring(data, pos);
    let _replica_identity = pg_read_u8(data, pos)?;
    let num_cols = pg_read_u16_be(data, pos)? as usize;
    let mut columns = Vec::with_capacity(num_cols);
    for _ in 0..num_cols {
        let _flags = pg_read_u8(data, pos)?;
        let name = pg_read_cstring(data, pos);
        let _type_oid = pg_read_u32_be(data, pos)?;
        let _type_mod = pg_read_u32_be(data, pos)?; // i32, read as u32
        columns.push(name);
    }
    Some((oid, table_name, columns))
}

fn pg_parse_tuple(data: &[u8], pos: &mut usize, cols: &[String]) -> serde_json::Map<String, JsonValue> {
    let mut map = serde_json::Map::new();
    let num_cols = match pg_read_u16_be(data, pos) {
        Some(n) => n as usize,
        None => return map,
    };
    for i in 0..num_cols {
        let col = cols.get(i).map(String::as_str).unwrap_or("?");
        let fmt = match pg_read_u8(data, pos) {
            Some(f) => f,
            None => break,
        };
        let value = match fmt {
            b'n' => JsonValue::Null,
            b'u' => continue, // unchanged-toast: skip
            b't' | b'b' => {
                let len = match pg_read_u32_be(data, pos) {
                    Some(l) => l as usize,
                    None => break,
                };
                if *pos + len > data.len() {
                    break;
                }
                let bytes = &data[*pos..*pos + len];
                *pos += len;
                if fmt == b't' {
                    JsonValue::String(String::from_utf8_lossy(bytes).into_owned())
                } else {
                    JsonValue::String(BASE64_STANDARD.encode(bytes))
                }
            }
            _ => break,
        };
        map.insert(col.to_string(), value);
    }
    map
}

fn pg_read_u8(data: &[u8], pos: &mut usize) -> Option<u8> {
    data.get(*pos).copied().inspect(|_| {
        *pos += 1;
    })
}

fn pg_read_u16_be(data: &[u8], pos: &mut usize) -> Option<u16> {
    let bytes: [u8; 2] = data.get(*pos..*pos + 2)?.try_into().ok()?;
    *pos += 2;
    Some(u16::from_be_bytes(bytes))
}

fn pg_read_u32_be(data: &[u8], pos: &mut usize) -> Option<u32> {
    let bytes: [u8; 4] = data.get(*pos..*pos + 4)?.try_into().ok()?;
    *pos += 4;
    Some(u32::from_be_bytes(bytes))
}

fn pg_read_cstring(data: &[u8], pos: &mut usize) -> String {
    let start = *pos;
    while *pos < data.len() && data[*pos] != 0 {
        *pos += 1;
    }
    let s = String::from_utf8_lossy(&data[start..*pos]).into_owned();
    if *pos < data.len() {
        *pos += 1; // skip null terminator
    }
    s
}
