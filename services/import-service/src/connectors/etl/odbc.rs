//! ODBC ETL connector using odbc-api 8.x.
//!
//! All ODBC calls are synchronous; they are wrapped in `tokio::task::spawn_blocking`.
//! A new `Environment` is created per call (cheap on the blocking thread-pool).
//! Connection is via a DSN-less connection string from
//! `connection_config.connection_string`.
//!
//! Schema discovery: if `source_config.table` is set, executes
//! `SELECT * FROM <table> WHERE 1=0` and reads column metadata via
//! `Cursor::describe_col`. Falls back to key names of the first extracted record.

use anyhow::{anyhow, Result};
use odbc_api::buffers::TextRowSet;
use odbc_api::{ColumnDescription, ConnectionOptions, Cursor, Environment, ResultSetMetadata};
use serde_json::Value as JsonValue;
use std::collections::HashMap;

use super::{validate_sql_identifier, EtlConnector, EtlConnectorConfig};
use crate::handlers::import::{SchemaField, SchemaTable};
use crate::pipeline::SourceRecord;

// ---------------------------------------------------------------------------
// OdbcConnector
// ---------------------------------------------------------------------------

pub struct OdbcConnector;

impl OdbcConnector {
    fn get_connection_string(cfg: &EtlConnectorConfig) -> Result<String> {
        cfg.connection_config
            .get("connection_string")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .ok_or_else(|| anyhow!("odbc: connection_string is required in connection_config"))
    }
}

#[async_trait::async_trait]
impl EtlConnector for OdbcConnector {
    fn connector_type(&self) -> &'static str {
        "odbc"
    }

    async fn test_connection(&self, cfg: &EtlConnectorConfig) -> Result<()> {
        let conn_str = Self::get_connection_string(cfg)?;
        tokio::task::spawn_blocking(move || {
            let env = Environment::new()
                .map_err(|e| anyhow!("odbc: failed to create ODBC environment: {e}"))?;
            let _conn = env
                .connect_with_connection_string(&conn_str, ConnectionOptions::default())
                .map_err(|e| anyhow!("odbc: connection failed: {e}"))?;
            Ok::<(), anyhow::Error>(())
        })
        .await
        .map_err(|e| anyhow!("odbc: spawn_blocking error: {e}"))?
    }

    async fn discover_schema(&self, cfg: &EtlConnectorConfig) -> Result<Vec<SchemaTable>> {
        let conn_str = Self::get_connection_string(cfg)?;
        let table_name = cfg
            .source_config
            .get("table")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        if let Some(table) = table_name {
            validate_sql_identifier(&table)?;
            let table2 = table.clone();
            let fields = tokio::task::spawn_blocking(move || {
                let env = Environment::new()
                    .map_err(|e| anyhow!("odbc: failed to create ODBC environment: {e}"))?;
                let conn = env
                    .connect_with_connection_string(&conn_str, ConnectionOptions::default())
                    .map_err(|e| anyhow!("odbc: connection failed: {e}"))?;

                let query = format!("SELECT * FROM {table2} WHERE 1=0");
                let mut cursor = conn
                    .execute(&query, ())
                    .map_err(|e| anyhow!("odbc: schema query failed: {e}"))?
                    .ok_or_else(|| anyhow!("odbc: schema query returned no cursor"))?;

                let num_cols = cursor
                    .num_result_cols()
                    .map_err(|e| anyhow!("odbc: num_result_cols failed: {e}"))?
                    as usize;

                let mut fields: Vec<SchemaField> = Vec::with_capacity(num_cols);
                for i in 1..=num_cols {
                    let mut desc = ColumnDescription::default();
                    cursor
                        .describe_col(i as u16, &mut desc)
                        .map_err(|e| anyhow!("odbc: describe_col({i}) failed: {e}"))?;
                    fields.push(SchemaField {
                        name: String::from_utf16_lossy(&desc.name),
                        data_type: format!("{:?}", desc.data_type),
                    });
                }
                Ok::<Vec<SchemaField>, anyhow::Error>(fields)
            })
            .await
            .map_err(|e| anyhow!("odbc: spawn_blocking error: {e}"))??;

            return Ok(vec![SchemaTable {
                name: table,
                fields,
            }]);
        }

        // Fallback: derive from first extracted record.
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
        let conn_str = Self::get_connection_string(cfg)?;
        let base_sql = cfg
            .source_config
            .get("query")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("odbc: query is required in source_config"))?;

        // Apply watermark via {{WATERMARK}} placeholder substitution.
        // ODBC cannot use subquery wrapping reliably across all ODBC drivers.
        let sql = if let Some(ref wm) = cfg.watermark_state {
            if let Some(val) = wm.get("last_value").and_then(|v| v.as_str()) {
                base_sql.replace("{{WATERMARK}}", val)
            } else {
                base_sql.to_string()
            }
        } else {
            base_sql.to_string()
        };
        let max_rows = cfg
            .source_config
            .get("max_rows")
            .and_then(|v| v.as_u64())
            .unwrap_or(50_000) as usize;

        tokio::task::spawn_blocking(move || {
            let env = Environment::new()
                .map_err(|e| anyhow!("odbc: failed to create ODBC environment: {e}"))?;
            let conn = env
                .connect_with_connection_string(&conn_str, ConnectionOptions::default())
                .map_err(|e| anyhow!("odbc: connection failed: {e}"))?;

            let mut cursor = conn
                .execute(&sql, ())
                .map_err(|e| anyhow!("odbc: query execution failed: {e}"))?
                .ok_or_else(|| anyhow!("odbc: query returned no result set"))?;

            let num_cols = cursor
                .num_result_cols()
                .map_err(|e| anyhow!("odbc: num_result_cols failed: {e}"))?
                as usize;

            let mut col_names: Vec<String> = Vec::with_capacity(num_cols);
            for i in 1..=num_cols {
                let mut desc = ColumnDescription::default();
                cursor
                    .describe_col(i as u16, &mut desc)
                    .map_err(|e| anyhow!("odbc: describe_col({i}) failed: {e}"))?;
                col_names.push(String::from_utf16_lossy(&desc.name));
            }

            let batch_size = max_rows.min(1_000);
            let mut buffer = TextRowSet::for_cursor(batch_size, &mut cursor, Some(65_535))
                .map_err(|e| anyhow!("odbc: TextRowSet::for_cursor failed: {e}"))?;
            let mut row_set_cursor = cursor
                .bind_buffer(&mut buffer)
                .map_err(|e| anyhow!("odbc: bind_buffer failed: {e}"))?;

            let mut records: Vec<SourceRecord> = Vec::new();
            let mut row_number = 1i64;

            'outer: while let Some(batch) = row_set_cursor
                .fetch()
                .map_err(|e| anyhow!("odbc: fetch failed: {e}"))?
            {
                for row_idx in 0..batch.num_rows() {
                    if records.len() >= max_rows {
                        break 'outer;
                    }
                    let mut fields: HashMap<String, JsonValue> = HashMap::with_capacity(num_cols);
                    for (col_idx, name) in col_names.iter().cloned().enumerate() {
                        let val = match batch.at(col_idx, row_idx) {
                            Some(bytes) => {
                                JsonValue::String(String::from_utf8_lossy(bytes).into_owned())
                            }
                            None => JsonValue::Null,
                        };
                        fields.insert(name, val);
                    }
                    let raw = serde_json::to_string(&fields).unwrap_or_default();
                    records.push(SourceRecord {
                        row_number,
                        raw,
                        fields,
                    });
                    row_number += 1;
                }
            }

            Ok::<Vec<SourceRecord>, anyhow::Error>(records)
        })
        .await
        .map_err(|e| anyhow!("odbc: spawn_blocking error: {e}"))?
    }
}
