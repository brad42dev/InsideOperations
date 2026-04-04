//! MySQL/MariaDB binlog CDC connector.
//!
//! Source-side requirements (DBA must configure):
//! 1. my.cnf: `binlog_format = ROW`, `binlog_row_image = FULL`
//! 2. `CREATE USER 'io_repl'@'%' IDENTIFIED BY '...';`
//!    `GRANT REPLICATION SLAVE, REPLICATION CLIENT ON *.* TO 'io_repl'@'%';`
//!    `GRANT SELECT ON target_db.* TO 'io_repl'@'%';`
//! 3. Each I/O import connection needs a unique server_id in source_config.
//!
//! LIMITATION: mysql_cdc 0.2 does not support SSL. Only viable on private networks.
//! LIMITATION: The blocking binlog reader cannot be interrupted mid-read; cancellation
//!   may be delayed up to heartbeat_interval_secs (default 10s).
//!
//! Connection config keys: hostname, port (default 3306), database (optional)
//! Auth config keys: username, password
//! Source config keys:
//!   server_id              — unique integer ID for this replica (required)
//!   heartbeat_interval_secs — how often MySQL sends heartbeats (default 10)
//!   binlog_filename        — resume from this file (from resume_token)
//!   binlog_position        — resume from this offset (from resume_token)

use anyhow::{anyhow, Result};
use base64::{engine::general_purpose::STANDARD as BASE64_STANDARD, Engine};
use futures::future::BoxFuture;
use mysql_cdc::{
    binlog_client::BinlogClient,
    binlog_options::BinlogOptions,
    events::{binlog_event::BinlogEvent, row_events::mysql_value::MySqlValue},
    replica_options::ReplicaOptions,
    ssl_mode::SslMode,
};
use serde_json::Value as JsonValue;
use std::collections::HashMap;
use std::time::Duration;
use tracing::{debug, warn};

use super::{StreamConfig, StreamEvent, StreamingConnector};

pub struct MysqlCdcConnector;

#[async_trait::async_trait]
impl StreamingConnector for MysqlCdcConnector {
    fn connector_type(&self) -> &'static str {
        "mysql_cdc"
    }

    async fn run(
        &self,
        config: &StreamConfig,
        db: &sqlx::PgPool,
        on_event: Box<dyn Fn(StreamEvent) -> BoxFuture<'static, Result<()>> + Send + Sync>,
    ) -> Result<()> {
        let hostname = config
            .connection_config
            .get("hostname")
            .and_then(|v| v.as_str())
            .unwrap_or("localhost")
            .to_string();
        let port = config
            .connection_config
            .get("port")
            .and_then(|v| v.as_u64())
            .unwrap_or(3306) as u16;
        let database = config
            .connection_config
            .get("database")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        let username = config
            .auth_config
            .get("username")
            .or_else(|| config.auth_config.get("user"))
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let password = config
            .auth_config
            .get("password")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let server_id: u32 = config
            .source_config
            .get("server_id")
            .and_then(|v| v.as_u64())
            .unwrap_or(65535) as u32;
        let heartbeat_secs = config
            .source_config
            .get("heartbeat_interval_secs")
            .and_then(|v| v.as_u64())
            .unwrap_or(10);

        // Resume position from saved token
        let binlog_opts = if let Some(rt) = &config.resume_token {
            let filename = rt.get("binlog_filename").and_then(|v| v.as_str());
            let position = rt.get("binlog_position").and_then(|v| v.as_u64());
            match (filename, position) {
                (Some(f), Some(p)) => BinlogOptions::from_position(f.to_string(), p as u32),
                _ => BinlogOptions::from_end(),
            }
        } else {
            BinlogOptions::from_end()
        };

        let options = ReplicaOptions {
            hostname: hostname.clone(),
            port,
            username,
            password,
            database,
            server_id,
            blocking: true,
            ssl_mode: SslMode::Disabled,
            heartbeat_interval: Duration::from_secs(heartbeat_secs),
            binlog: binlog_opts,
        };

        // Bridge blocking mysql_cdc → async via mpsc channel.
        // Event type: Ok((op_type, data_json, resume_token_json)) or Err(message)
        type MysqlMsg = Result<(String, JsonValue, JsonValue), String>;
        let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel::<MysqlMsg>();

        tokio::task::spawn_blocking(move || {
            let mut client = BinlogClient::new(options);
            let events = match client.replicate() {
                Ok(e) => e,
                Err(e) => {
                    let _ = tx.send(Err(format!("mysql_cdc connect failed: {e:?}")));
                    return;
                }
            };

            let mut table_map = HashMap::new();

            for result in events {
                let (header, event) = match result {
                    Ok(pair) => pair,
                    Err(e) => {
                        let _ = tx.send(Err(format!("mysql_cdc event error: {e:?}")));
                        break;
                    }
                };
                client.commit(&header, &event);

                // Track table metadata for column name resolution
                if let BinlogEvent::TableMapEvent(e) = &event {
                    table_map.insert(e.table_id, e.clone());
                }

                // Convert DML events to JSON
                if let Some((op, data)) = binlog_event_to_json(&event, &table_map) {
                    let pos_json = serde_json::json!({
                        "binlog_filename": client.options.binlog.filename,
                        "binlog_position": client.options.binlog.position,
                    });
                    if tx.send(Ok((op, data, pos_json))).is_err() {
                        break; // receiver dropped — cancelled
                    }
                }
            }
        });

        // Mark session active
        let _ = sqlx::query(
            "UPDATE import_stream_sessions \
             SET status = 'active', updated_at = NOW() \
             WHERE id = $1 AND status != 'stopped'",
        )
        .bind(config.session_id)
        .execute(db)
        .await;

        loop {
            tokio::select! {
                _ = config.cancel.cancelled() => {
                    debug!(session_id = %config.session_id, "mysql_cdc cancelled");
                    break;
                }
                msg = rx.recv() => {
                    match msg {
                        None => break, // blocking thread exited
                        Some(Err(e)) => return Err(anyhow!(e)),
                        Some(Ok((op_type, data_json, resume_json))) => {
                            let _ = sqlx::query(
                                "UPDATE import_stream_sessions \
                                 SET events_received = events_received + 1, \
                                     last_event_at = NOW(), \
                                     updated_at = NOW(), \
                                     resume_token = $2 \
                                 WHERE id = $1",
                            )
                            .bind(config.session_id)
                            .bind(&resume_json)
                            .execute(db)
                            .await;

                            let stream_event = StreamEvent {
                                event_type: Some(op_type),
                                data: data_json,
                                resume_token: Some(resume_json),
                            };
                            if let Err(e) = on_event(stream_event).await {
                                warn!(session_id = %config.session_id, "on_event error: {e}");
                            }
                        }
                    }
                }
            }
        }
        Ok(())
    }
}

/// Convert a binlog event to (op_type, JSON data).  Returns `None` for
/// non-DML events that we don't need to propagate.
fn binlog_event_to_json(
    event: &BinlogEvent,
    table_map: &HashMap<u64, mysql_cdc::events::table_map_event::TableMapEvent>,
) -> Option<(String, JsonValue)> {
    match event {
        BinlogEvent::WriteRowsEvent(e) => {
            let table_info = table_map.get(&e.table_id);
            let mut rows = Vec::new();
            for row in &e.rows {
                rows.push(cells_to_json(&row.cells, table_info));
            }
            Some((
                "insert".into(),
                serde_json::json!({
                    "op": "insert",
                    "table": table_info.map(|t| t.table_name.as_str()).unwrap_or("?"),
                    "database": table_info.map(|t| t.database_name.as_str()).unwrap_or("?"),
                    "rows": rows,
                }),
            ))
        }
        BinlogEvent::UpdateRowsEvent(e) => {
            let table_info = table_map.get(&e.table_id);
            let mut rows = Vec::new();
            for row in &e.rows {
                rows.push(serde_json::json!({
                    "before": cells_to_json(&row.before_update.cells, table_info),
                    "after": cells_to_json(&row.after_update.cells, table_info),
                }));
            }
            Some((
                "update".into(),
                serde_json::json!({
                    "op": "update",
                    "table": table_info.map(|t| t.table_name.as_str()).unwrap_or("?"),
                    "database": table_info.map(|t| t.database_name.as_str()).unwrap_or("?"),
                    "rows": rows,
                }),
            ))
        }
        BinlogEvent::DeleteRowsEvent(e) => {
            let table_info = table_map.get(&e.table_id);
            let mut rows = Vec::new();
            for row in &e.rows {
                rows.push(cells_to_json(&row.cells, table_info));
            }
            Some((
                "delete".into(),
                serde_json::json!({
                    "op": "delete",
                    "table": table_info.map(|t| t.table_name.as_str()).unwrap_or("?"),
                    "database": table_info.map(|t| t.database_name.as_str()).unwrap_or("?"),
                    "rows": rows,
                }),
            ))
        }
        _ => None,
    }
}

fn cells_to_json(
    cells: &[Option<MySqlValue>],
    table_info: Option<&mysql_cdc::events::table_map_event::TableMapEvent>,
) -> JsonValue {
    let col_names: Option<&[String]> = table_info
        .and_then(|t| t.table_metadata.as_ref())
        .and_then(|m| m.column_names.as_deref());

    let obj: serde_json::Map<String, JsonValue> = cells
        .iter()
        .enumerate()
        .map(|(i, cell)| {
            let key = col_names
                .and_then(|names| names.get(i))
                .cloned()
                .unwrap_or_else(|| format!("col_{i}"));
            let val = cell
                .as_ref()
                .map(mysql_value_to_json)
                .unwrap_or(JsonValue::Null);
            (key, val)
        })
        .collect();
    JsonValue::Object(obj)
}

fn mysql_value_to_json(v: &MySqlValue) -> JsonValue {
    match v {
        MySqlValue::TinyInt(n) => JsonValue::Number((*n as i64).into()),
        MySqlValue::SmallInt(n) => JsonValue::Number((*n as i64).into()),
        MySqlValue::MediumInt(n) => JsonValue::Number((*n as i64).into()),
        MySqlValue::Int(n) => JsonValue::Number((*n as i64).into()),
        MySqlValue::BigInt(n) => JsonValue::Number(serde_json::Number::from(*n)),
        MySqlValue::Float(f) => serde_json::Number::from_f64(*f as f64)
            .map(JsonValue::Number)
            .unwrap_or(JsonValue::Null),
        MySqlValue::Double(f) => serde_json::Number::from_f64(*f)
            .map(JsonValue::Number)
            .unwrap_or(JsonValue::Null),
        MySqlValue::Decimal(s) => JsonValue::String(s.clone()),
        MySqlValue::String(s) => JsonValue::String(s.clone()),
        MySqlValue::Blob(b) => JsonValue::String(BASE64_STANDARD.encode(b)),
        MySqlValue::Bit(bits) => {
            let val: u64 =
                bits.iter()
                    .enumerate()
                    .fold(0u64, |acc, (i, &b)| if b { acc | (1u64 << i) } else { acc });
            JsonValue::Number(val.into())
        }
        MySqlValue::Enum(n) => JsonValue::Number((*n as i64).into()),
        MySqlValue::Set(n) => JsonValue::Number((*n).into()),
        MySqlValue::Year(y) => JsonValue::Number((*y as i64).into()),
        MySqlValue::Date(d) => {
            JsonValue::String(format!("{:04}-{:02}-{:02}", d.year, d.month, d.day))
        }
        MySqlValue::Time(t) => JsonValue::String(format!(
            "{:03}:{:02}:{:02}.{:03}",
            t.hour, t.minute, t.second, t.millis
        )),
        MySqlValue::DateTime(dt) => JsonValue::String(format!(
            "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}.{:03}",
            dt.year, dt.month, dt.day, dt.hour, dt.minute, dt.second, dt.millis
        )),
        MySqlValue::Timestamp(ms) => JsonValue::Number((*ms).into()),
    }
}
