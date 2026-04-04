//! PostgreSQL ETL connector.
//!
//! Builds a per-connection PgPool from `connection_config` (host, port, database, username,
//! ssl_mode) and `auth_config` (password). Executes the user-supplied SQL query inside a
//! READ ONLY transaction and converts each row to a `SourceRecord`.
//!
//! Schema discovery queries `information_schema.columns` when `source_config.table` is set;
//! otherwise falls back to extracting a sample record and returning its field names.

use anyhow::{anyhow, Result};
use serde_json::Value as JsonValue;
use sqlx::postgres::{PgConnectOptions, PgPoolOptions, PgRow, PgSslMode};
use sqlx::{Column, Row, TypeInfo};
use std::collections::HashMap;

use super::{validate_sql_identifier, EtlConnector, EtlConnectorConfig};
use crate::handlers::import::{SchemaField, SchemaTable};
use crate::pipeline::SourceRecord;

// ---------------------------------------------------------------------------
// PostgresConnector
// ---------------------------------------------------------------------------

pub struct PostgresConnector;

impl PostgresConnector {
    async fn build_pool(cfg: &EtlConnectorConfig) -> Result<sqlx::PgPool> {
        let host = cfg
            .connection_config
            .get("host")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("postgresql: host is required in connection config"))?;
        let port = cfg
            .connection_config
            .get("port")
            .and_then(|v| v.as_u64())
            .unwrap_or(5432) as u16;
        let database = cfg
            .connection_config
            .get("database")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("postgresql: database is required in connection config"))?;
        let username = cfg
            .connection_config
            .get("username")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("postgresql: username is required in connection config"))?;
        let password = cfg
            .auth_config
            .get("password")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let ssl_mode = cfg
            .connection_config
            .get("ssl_mode")
            .and_then(|v| v.as_str())
            .unwrap_or("prefer");

        let options = PgConnectOptions::new()
            .host(host)
            .port(port)
            .database(database)
            .username(username)
            .password(password)
            .ssl_mode(match ssl_mode {
                "require" => PgSslMode::Require,
                "disable" => PgSslMode::Disable,
                _ => PgSslMode::Prefer,
            });

        PgPoolOptions::new()
            .max_connections(2)
            .connect_with(options)
            .await
            .map_err(|e| anyhow!("postgresql: connection failed: {e}"))
    }

    fn row_to_map(row: &PgRow) -> HashMap<String, JsonValue> {
        let mut map = HashMap::new();
        for col in row.columns() {
            let idx = col.ordinal();
            let name = col.name().to_string();
            let type_name = col.type_info().name();
            let json = match type_name {
                "INT2" | "INT4" | "INT8" => row
                    .try_get::<i64, _>(idx)
                    .map(JsonValue::from)
                    .unwrap_or(JsonValue::Null),
                "FLOAT4" | "FLOAT8" | "NUMERIC" => row
                    .try_get::<f64, _>(idx)
                    .map(JsonValue::from)
                    .unwrap_or(JsonValue::Null),
                "BOOL" => row
                    .try_get::<bool, _>(idx)
                    .map(JsonValue::Bool)
                    .unwrap_or(JsonValue::Null),
                "JSON" | "JSONB" => row.try_get::<JsonValue, _>(idx).unwrap_or(JsonValue::Null),
                _ => row
                    .try_get::<String, _>(idx)
                    .map(JsonValue::String)
                    .unwrap_or(JsonValue::Null),
            };
            map.insert(name, json);
        }
        map
    }
}

#[async_trait::async_trait]
impl EtlConnector for PostgresConnector {
    fn connector_type(&self) -> &'static str {
        "postgresql"
    }

    async fn test_connection(&self, cfg: &EtlConnectorConfig) -> Result<()> {
        let pool = Self::build_pool(cfg).await?;
        sqlx::query("SELECT 1")
            .execute(&pool)
            .await
            .map_err(|e| anyhow!("postgresql: test query failed: {e}"))?;
        pool.close().await;
        Ok(())
    }

    async fn discover_schema(&self, cfg: &EtlConnectorConfig) -> Result<Vec<SchemaTable>> {
        // If source_config specifies a table, use information_schema for accurate typing.
        if let Some(table) = cfg.source_config.get("table").and_then(|v| v.as_str()) {
            let schema = cfg
                .source_config
                .get("schema")
                .and_then(|v| v.as_str())
                .unwrap_or("public");
            let pool = Self::build_pool(cfg).await?;
            let rows = sqlx::query(
                "SELECT column_name, data_type \
                 FROM information_schema.columns \
                 WHERE table_name = $1 AND table_schema = $2 \
                 ORDER BY ordinal_position",
            )
            .bind(table)
            .bind(schema)
            .fetch_all(&pool)
            .await
            .map_err(|e| anyhow!("postgresql: information_schema query failed: {e}"))?;
            pool.close().await;
            let fields = rows
                .iter()
                .map(|r| SchemaField {
                    name: r.try_get::<String, _>(0).unwrap_or_default(),
                    data_type: r
                        .try_get::<String, _>(1)
                        .unwrap_or_else(|_| "text".to_string()),
                })
                .collect();
            return Ok(vec![SchemaTable {
                name: table.to_string(),
                fields,
            }]);
        }

        // Fallback: extract and return field names from the first record.
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
        let sql = cfg
            .source_config
            .get("query")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("postgresql: query is required in source_config"))?;

        // Apply watermark filter by wrapping the user's query in a subquery
        let effective_query;
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
                    .map_err(|e| anyhow!("postgresql: invalid watermark_column: {e}"))?;
                let lookback_seconds = cfg
                    .source_config
                    .get("watermark_lookback_seconds")
                    .and_then(|v| v.as_i64())
                    .unwrap_or(120);

                effective_query = if wm_type == "integer" {
                    // Parse to i64 to ensure it's a safe integer literal
                    let n: i64 = val.parse().map_err(|_| {
                        anyhow!("postgresql: watermark last_value is not a valid integer: {val}")
                    })?;
                    format!("SELECT * FROM ({sql}) _wm WHERE _wm.\"{col}\" > {n}")
                } else {
                    // Parse and reformat to ensure it's a valid timestamp
                    chrono::DateTime::parse_from_rfc3339(val)
                        .map_err(|_| anyhow!("postgresql: watermark last_value is not a valid RFC3339 timestamp: {val}"))?;
                    format!(
                        "SELECT * FROM ({sql}) _wm \
                         WHERE _wm.\"{col}\" > (TIMESTAMP '{val}' - INTERVAL '{lookback_seconds} seconds')"
                    )
                };
                effective_query.as_str()
            } else {
                sql
            }
        } else {
            sql
        };

        let pool = Self::build_pool(cfg).await?;
        let mut tx = pool
            .begin()
            .await
            .map_err(|e| anyhow!("postgresql: begin transaction failed: {e}"))?;

        sqlx::query("SET TRANSACTION READ ONLY")
            .execute(&mut *tx)
            .await
            .map_err(|e| anyhow!("postgresql: SET TRANSACTION READ ONLY failed: {e}"))?;

        let rows = sqlx::query(sql)
            .fetch_all(&mut *tx)
            .await
            .map_err(|e| anyhow!("postgresql: query execution failed: {e}"))?;

        let _ = tx.rollback().await;

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

        pool.close().await;
        Ok(records)
    }
}
