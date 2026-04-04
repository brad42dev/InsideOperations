//! Microsoft SQL Server ETL connector using tiberius + tokio-util compat.
//!
//! Builds a per-connection `tiberius::Client` from `connection_config` (host, port,
//! database, username, ssl_mode) and `auth_config` (password) over a raw TCP stream.
//! Executes the user-supplied SQL via `simple_query`.
//!
//! Schema discovery queries `INFORMATION_SCHEMA.COLUMNS` when `source_config.table`
//! is set; otherwise falls back to extracting a sample record.

use anyhow::{anyhow, Result};
use serde_json::Value as JsonValue;
use std::collections::HashMap;
use tiberius::{AuthMethod, Client, Config, EncryptionLevel};
use tokio::net::TcpStream;
use tokio_util::compat::TokioAsyncWriteCompatExt;

use super::{validate_sql_identifier, EtlConnector, EtlConnectorConfig};
use crate::handlers::import::{SchemaField, SchemaTable};
use crate::pipeline::SourceRecord;

// ---------------------------------------------------------------------------
// MssqlConnector
// ---------------------------------------------------------------------------

pub struct MssqlConnector;

impl MssqlConnector {
    fn build_config(cfg: &EtlConnectorConfig) -> Result<(Config, String)> {
        let host = cfg
            .connection_config
            .get("host")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("mssql: host is required in connection config"))?;
        let port = cfg
            .connection_config
            .get("port")
            .and_then(|v| v.as_u64())
            .unwrap_or(1433) as u16;
        let database = cfg
            .connection_config
            .get("database")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let username = cfg
            .connection_config
            .get("username")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("mssql: username is required in connection config"))?;
        let password = cfg
            .auth_config
            .get("password")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let ssl_mode = cfg
            .connection_config
            .get("ssl_mode")
            .and_then(|v| v.as_str())
            .unwrap_or("required");

        let mut config = Config::new();
        config.host(host);
        config.port(port);
        config.database(database);
        config.authentication(AuthMethod::sql_server(username, password));
        config.encryption(match ssl_mode {
            "disable" => EncryptionLevel::NotSupported,
            _ => EncryptionLevel::Required,
        });

        let addr = format!("{host}:{port}");
        Ok((config, addr))
    }

    async fn connect(
        cfg: &EtlConnectorConfig,
    ) -> Result<Client<tokio_util::compat::Compat<TcpStream>>> {
        let (config, addr) = Self::build_config(cfg)?;
        let tcp = TcpStream::connect(&addr)
            .await
            .map_err(|e| anyhow!("mssql: TCP connect to {addr} failed: {e}"))?;
        tcp.set_nodelay(true)
            .map_err(|e| anyhow!("mssql: set_nodelay failed: {e}"))?;
        Client::connect(config, tcp.compat_write())
            .await
            .map_err(|e| anyhow!("mssql: handshake failed: {e}"))
    }

    fn col_to_json(row: &tiberius::Row, idx: usize) -> JsonValue {
        row.get::<i64, _>(idx)
            .map(JsonValue::from)
            .or_else(|| row.get::<i32, _>(idx).map(|v| JsonValue::from(v as i64)))
            .or_else(|| row.get::<i16, _>(idx).map(|v| JsonValue::from(v as i64)))
            .or_else(|| row.get::<u8, _>(idx).map(|v| JsonValue::from(v as i64)))
            .or_else(|| row.get::<f64, _>(idx).map(JsonValue::from))
            .or_else(|| row.get::<f32, _>(idx).map(|v| JsonValue::from(v as f64)))
            .or_else(|| row.get::<bool, _>(idx).map(JsonValue::Bool))
            .or_else(|| {
                row.get::<&str, _>(idx)
                    .map(|v| JsonValue::String(v.to_string()))
            })
            .unwrap_or(JsonValue::Null)
    }

    fn row_to_map(row: &tiberius::Row) -> HashMap<String, JsonValue> {
        row.columns()
            .iter()
            .enumerate()
            .map(|(i, col)| (col.name().to_string(), Self::col_to_json(row, i)))
            .collect()
    }
}

#[async_trait::async_trait]
impl EtlConnector for MssqlConnector {
    fn connector_type(&self) -> &'static str {
        "mssql"
    }

    async fn test_connection(&self, cfg: &EtlConnectorConfig) -> Result<()> {
        let mut client = Self::connect(cfg).await?;
        client
            .simple_query("SELECT 1")
            .await
            .map_err(|e| anyhow!("mssql: test query failed: {e}"))?
            .into_first_result()
            .await
            .map_err(|e| anyhow!("mssql: test query result failed: {e}"))?;
        Ok(())
    }

    async fn discover_schema(&self, cfg: &EtlConnectorConfig) -> Result<Vec<SchemaTable>> {
        if let Some(table) = cfg.source_config.get("table").and_then(|v| v.as_str()) {
            validate_sql_identifier(table)?;
            let schema = cfg
                .source_config
                .get("schema")
                .and_then(|v| v.as_str())
                .unwrap_or("dbo");
            validate_sql_identifier(schema)?;
            let sql = format!(
                "SELECT COLUMN_NAME, DATA_TYPE \
                 FROM INFORMATION_SCHEMA.COLUMNS \
                 WHERE TABLE_NAME = '{}' AND TABLE_SCHEMA = '{}' \
                 ORDER BY ORDINAL_POSITION",
                table, schema
            );
            let mut client = Self::connect(cfg).await?;
            let rows = client
                .simple_query(sql)
                .await
                .map_err(|e| anyhow!("mssql: INFORMATION_SCHEMA query failed: {e}"))?
                .into_first_result()
                .await
                .map_err(|e| anyhow!("mssql: collecting schema results failed: {e}"))?;

            let fields = rows
                .iter()
                .map(|r| SchemaField {
                    name: r.get::<&str, _>(0).unwrap_or("").to_string(),
                    data_type: r.get::<&str, _>(1).unwrap_or("text").to_string(),
                })
                .collect();
            return Ok(vec![SchemaTable {
                name: table.to_string(),
                fields,
            }]);
        }

        // Fallback: derive schema from first extracted record.
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
        // CT (Change Tracking) mode: use CHANGETABLE queries instead of the user SQL.
        //
        // Source-side requirements:
        //   ALTER DATABASE YourDb SET CHANGE_TRACKING = ON (CHANGE_RETENTION = 7 DAYS, AUTO_CLEANUP = ON);
        //   ALTER TABLE YourTable ENABLE CHANGE_TRACKING WITH (TRACK_COLUMNS_UPDATED = ON);
        //   GRANT VIEW CHANGE TRACKING ON YourTable TO io_import;
        //
        // source_config must include: ct_enabled=true, table, primary_key_column
        // Optional: schema (default "dbo")
        //
        // Watermark is stored as { "last_sync_version": <bigint> } or the scheduler's
        // standard { "last_value": "<bigint>" } — both are accepted.
        if cfg
            .source_config
            .get("ct_enabled")
            .and_then(|v| v.as_bool())
            .unwrap_or(false)
        {
            return self.extract_ct(cfg).await;
        }

        let base_sql = cfg
            .source_config
            .get("query")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("mssql: query is required in source_config"))?;

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
                    .map_err(|e| anyhow!("mssql: invalid watermark_column: {e}"))?;
                let lookback_seconds = cfg
                    .source_config
                    .get("watermark_lookback_seconds")
                    .and_then(|v| v.as_i64())
                    .unwrap_or(120);

                if wm_type == "integer" {
                    let n: i64 = val.parse().map_err(|_| {
                        anyhow!("mssql: watermark last_value is not a valid integer: {val}")
                    })?;
                    format!("SELECT * FROM ({base_sql}) _wm WHERE _wm.[{col}] > {n}")
                } else {
                    chrono::DateTime::parse_from_rfc3339(val).map_err(|_| {
                        anyhow!(
                            "mssql: watermark last_value is not a valid RFC3339 timestamp: {val}"
                        )
                    })?;
                    format!(
                        "SELECT * FROM ({base_sql}) _wm \
                         WHERE _wm.[{col}] > DATEADD(SECOND, -{lookback_seconds}, CAST('{val}' AS DATETIME2))"
                    )
                }
            } else {
                base_sql.to_string()
            }
        } else {
            base_sql.to_string()
        };

        let mut client = Self::connect(cfg).await?;
        let rows = client
            .simple_query(sql)
            .await
            .map_err(|e| anyhow!("mssql: query execution failed: {e}"))?
            .into_first_result()
            .await
            .map_err(|e| anyhow!("mssql: collecting query results failed: {e}"))?;

        let records = rows
            .iter()
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

impl MssqlConnector {
    /// Extract changed rows via CHANGETABLE(CHANGES ...) when `ct_enabled = true`.
    async fn extract_ct(&self, cfg: &EtlConnectorConfig) -> Result<Vec<SourceRecord>> {
        let table = cfg
            .source_config
            .get("table")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("mssql CT: table is required in source_config"))?;
        validate_sql_identifier(table)?;

        let schema = cfg
            .source_config
            .get("schema")
            .and_then(|v| v.as_str())
            .unwrap_or("dbo");
        validate_sql_identifier(schema)?;

        let pk_col = cfg
            .source_config
            .get("primary_key_column")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("mssql CT: primary_key_column is required in source_config"))?;
        validate_sql_identifier(pk_col)?;

        // Accept last_sync_version from either dedicated key or the standard last_value key.
        let last_sync_version: i64 = cfg
            .watermark_state
            .as_ref()
            .and_then(|wm| {
                wm.get("last_sync_version")
                    .or_else(|| wm.get("last_value"))
                    .and_then(|v| {
                        v.as_i64()
                            .or_else(|| v.as_str().and_then(|s| s.parse().ok()))
                    })
            })
            .unwrap_or(0);

        // CHANGETABLE returns SYS_CHANGE_OPERATION (I/U/D) and SYS_CHANGE_VERSION
        // alongside all current column values (NULL for deleted rows).
        let sql = format!(
            "SELECT ct.SYS_CHANGE_OPERATION, ct.SYS_CHANGE_VERSION, t.* \
             FROM CHANGETABLE(CHANGES [{schema}].[{table}], {last_sync_version}) AS ct \
             LEFT JOIN [{schema}].[{table}] t ON ct.[{pk_col}] = t.[{pk_col}]"
        );

        let mut client = Self::connect(cfg).await?;
        let rows = client
            .simple_query(sql)
            .await
            .map_err(|e| anyhow!("mssql CT: query failed: {e}"))?
            .into_first_result()
            .await
            .map_err(|e| anyhow!("mssql CT: collecting results failed: {e}"))?;

        let records = rows
            .iter()
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
