//! MySQL / MariaDB ETL connector using mysql_async.
//!
//! Builds a per-connection Pool from `connection_config` (host, port, database, username)
//! and `auth_config` (password). Executes the user-supplied SQL query after issuing
//! `SET SESSION TRANSACTION READ ONLY` on the connection.
//!
//! Schema discovery queries `information_schema.columns` when `source_config.table` is set;
//! otherwise falls back to extracting a sample record and returning its field names.

use anyhow::{anyhow, Result};
use mysql_async::prelude::*;
use mysql_async::{OptsBuilder, Row as MysqlRow, Value as MysqlValue};
use serde_json::Value as JsonValue;
use std::collections::HashMap;

use super::{validate_sql_identifier, EtlConnector, EtlConnectorConfig};
use crate::handlers::import::{SchemaField, SchemaTable};
use crate::pipeline::SourceRecord;

// ---------------------------------------------------------------------------
// MySqlConnector
// ---------------------------------------------------------------------------

pub struct MySqlConnector;

impl MySqlConnector {
    fn build_pool(cfg: &EtlConnectorConfig) -> Result<mysql_async::Pool> {
        let host = cfg
            .connection_config
            .get("host")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("mysql: host is required in connection config"))?
            .to_string();
        let port = cfg
            .connection_config
            .get("port")
            .and_then(|v| v.as_u64())
            .unwrap_or(3306) as u16;
        let database = cfg
            .connection_config
            .get("database")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        let username = cfg
            .connection_config
            .get("username")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        let password = cfg
            .auth_config
            .get("password")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let opts = OptsBuilder::from_opts(mysql_async::Opts::default())
            .ip_or_hostname(host)
            .tcp_port(port)
            .db_name(database)
            .user(username)
            .pass(password);

        Ok(mysql_async::Pool::new(mysql_async::Opts::from(opts)))
    }

    fn mysql_value_to_json(value: MysqlValue) -> JsonValue {
        match value {
            MysqlValue::NULL => JsonValue::Null,
            MysqlValue::Bytes(b) => JsonValue::String(String::from_utf8_lossy(&b).into_owned()),
            MysqlValue::Int(i) => JsonValue::from(i),
            MysqlValue::UInt(u) => JsonValue::from(u),
            MysqlValue::Float(f) => JsonValue::from(f as f64),
            MysqlValue::Double(d) => JsonValue::from(d),
            MysqlValue::Date(y, mo, d, h, mi, s, us) => JsonValue::String(format!(
                "{y:04}-{mo:02}-{d:02} {h:02}:{mi:02}:{s:02}.{us:06}"
            )),
            MysqlValue::Time(neg, days, h, mi, s, us) => {
                let sign = if neg { "-" } else { "" };
                let total_h = days * 24 + h as u32;
                JsonValue::String(format!("{sign}{total_h:02}:{mi:02}:{s:02}.{us:06}"))
            }
        }
    }

    fn row_to_map(mut row: MysqlRow) -> HashMap<String, JsonValue> {
        let columns = row.columns_ref().to_vec();
        let mut map = HashMap::new();
        for (i, col) in columns.iter().enumerate() {
            let name = col.name_str().into_owned();
            let val: MysqlValue = row.take(i).unwrap_or(MysqlValue::NULL);
            map.insert(name, Self::mysql_value_to_json(val));
        }
        map
    }
}

#[async_trait::async_trait]
impl EtlConnector for MySqlConnector {
    fn connector_type(&self) -> &'static str {
        "mysql"
    }

    async fn test_connection(&self, cfg: &EtlConnectorConfig) -> Result<()> {
        let pool = Self::build_pool(cfg)?;
        let mut conn = pool
            .get_conn()
            .await
            .map_err(|e| anyhow!("mysql: connection failed: {e}"))?;
        conn.query_drop("SELECT 1")
            .await
            .map_err(|e| anyhow!("mysql: test query failed: {e}"))?;
        drop(conn);
        pool.disconnect().await.ok();
        Ok(())
    }

    async fn discover_schema(&self, cfg: &EtlConnectorConfig) -> Result<Vec<SchemaTable>> {
        if let Some(table) = cfg.source_config.get("table").and_then(|v| v.as_str()) {
            validate_sql_identifier(table)?;
            let database = cfg
                .connection_config
                .get("database")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            validate_sql_identifier(database)?;
            let pool = Self::build_pool(cfg)?;
            let mut conn = pool
                .get_conn()
                .await
                .map_err(|e| anyhow!("mysql: connection failed: {e}"))?;

            let sql = format!(
                "SELECT COLUMN_NAME, DATA_TYPE \
                 FROM information_schema.COLUMNS \
                 WHERE TABLE_NAME = '{}' AND TABLE_SCHEMA = '{}' \
                 ORDER BY ORDINAL_POSITION",
                table, database
            );
            let rows: Vec<MysqlRow> = conn
                .query(sql)
                .await
                .map_err(|e| anyhow!("mysql: information_schema query failed: {e}"))?;

            drop(conn);
            pool.disconnect().await.ok();

            let fields = rows
                .into_iter()
                .map(|mut r| {
                    let name: String = r.take(0).map(mysql_async::from_value).unwrap_or_default();
                    let data_type: String =
                        r.take(1).map(mysql_async::from_value).unwrap_or_default();
                    SchemaField { name, data_type }
                })
                .collect();

            return Ok(vec![SchemaTable {
                name: table.to_string(),
                fields,
            }]);
        }

        // Fallback: extract and derive schema from first record.
        let records = self.extract(cfg).await?;
        if let Some(first) = records.first() {
            let fields = first
                .fields
                .keys()
                .map(|k| SchemaField {
                    name: k.clone(),
                    data_type: "text".to_string(),
                })
                .collect();
            Ok(vec![SchemaTable {
                name: "query_result".to_string(),
                fields,
            }])
        } else {
            Ok(vec![])
        }
    }

    async fn extract(&self, cfg: &EtlConnectorConfig) -> Result<Vec<SourceRecord>> {
        let base_sql = cfg
            .source_config
            .get("query")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("mysql: query is required in source_config"))?;

        // Apply watermark filter by wrapping the user's query in a subquery
        let sql = if let Some(ref wm) = cfg.watermark_state {
            let wm_column = cfg
                .source_config
                .get("watermark_column")
                .and_then(|v| v.as_str());
            let wm_type = wm
                .get("watermark_type")
                .and_then(|v| v.as_str())
                .unwrap_or("timestamp");
            let last_value = wm.get("last_value").and_then(|v| v.as_str());

            if let (Some(col), Some(val)) = (wm_column, last_value) {
                validate_sql_identifier(col)
                    .map_err(|e| anyhow!("mysql: invalid watermark_column: {e}"))?;
                let lookback_seconds = cfg
                    .source_config
                    .get("watermark_lookback_seconds")
                    .and_then(|v| v.as_i64())
                    .unwrap_or(120);

                if wm_type == "integer" {
                    let n: i64 = val.parse().map_err(|_| {
                        anyhow!("mysql: watermark last_value is not a valid integer: {val}")
                    })?;
                    format!("SELECT * FROM ({base_sql}) _wm WHERE _wm.`{col}` > {n}")
                } else {
                    let dt = chrono::DateTime::parse_from_rfc3339(val).map_err(|_| {
                        anyhow!(
                            "mysql: watermark last_value is not a valid RFC3339 timestamp: {val}"
                        )
                    })?;
                    // Reformat as MySQL datetime literal (no timezone offset)
                    let mysql_dt = dt
                        .with_timezone(&chrono::Utc)
                        .format("%Y-%m-%d %H:%M:%S")
                        .to_string();
                    format!(
                        "SELECT * FROM ({base_sql}) _wm \
                         WHERE _wm.`{col}` > DATE_SUB('{mysql_dt}', INTERVAL {lookback_seconds} SECOND)"
                    )
                }
            } else {
                base_sql.to_string()
            }
        } else {
            base_sql.to_string()
        };

        let pool = Self::build_pool(cfg)?;
        let mut conn = pool
            .get_conn()
            .await
            .map_err(|e| anyhow!("mysql: connection failed: {e}"))?;

        conn.query_drop("SET SESSION TRANSACTION READ ONLY")
            .await
            .map_err(|e| anyhow!("mysql: SET SESSION TRANSACTION READ ONLY failed: {e}"))?;

        let rows: Vec<MysqlRow> = conn
            .query(sql)
            .await
            .map_err(|e| anyhow!("mysql: query execution failed: {e}"))?;

        drop(conn);
        pool.disconnect().await.ok();

        let records = rows
            .into_iter()
            .enumerate()
            .map(|(i, row)| {
                let fields = Self::row_to_map(row);
                let raw = serde_json::to_string(&fields).unwrap_or_default();
                SourceRecord {
                    row_number: (i + 1) as i64,
                    raw,
                    fields,
                }
            })
            .collect();

        Ok(records)
    }
}
