//! CSV and TSV file ETL connectors.
//!
//! Both connectors read from an uploaded file (`file_id`) or inline `source_config.data`.
//! The CSV connector reads `delimiter` from source_config (default `,`).
//! The TSV connector always uses tab as the delimiter.

use anyhow::Result;
use serde_json::Value as JsonValue;
use std::collections::HashMap;

use crate::handlers::import::{SchemaField, SchemaTable};
use crate::pipeline::SourceRecord;
use super::{resolve_file_content, EtlConnector, EtlConnectorConfig};

// ---------------------------------------------------------------------------
// Shared CSV parsing helper
// ---------------------------------------------------------------------------

async fn parse_csv_bytes(cfg: &EtlConnectorConfig, delimiter: u8) -> Result<Vec<SourceRecord>> {
    let bytes = resolve_file_content(&cfg.source_config, &cfg.upload_dir).await?;
    let has_header = cfg
        .source_config
        .get("has_header")
        .and_then(|v| v.as_bool())
        .unwrap_or(true);
    let skip_rows = cfg
        .source_config
        .get("skip_rows")
        .and_then(|v| v.as_u64())
        .unwrap_or(0) as usize;

    let mut rdr = csv::ReaderBuilder::new()
        .delimiter(delimiter)
        .has_headers(has_header)
        .from_reader(bytes.as_slice());

    let mut records: Vec<SourceRecord> = Vec::new();

    if has_header {
        let headers: Vec<String> = rdr.headers()?.iter().map(|s| s.to_string()).collect();
        for (row_idx, result) in rdr.records().enumerate() {
            if row_idx < skip_rows {
                continue;
            }
            let record = result?;
            let fields: HashMap<String, JsonValue> = headers
                .iter()
                .zip(record.iter())
                .map(|(h, v)| (h.clone(), JsonValue::String(v.to_string())))
                .collect();
            let raw = serde_json::to_string(&fields).unwrap_or_default();
            records.push(SourceRecord {
                row_number: (records.len() + 1) as i64,
                raw,
                fields,
            });
        }
    } else {
        for (row_idx, result) in rdr.records().enumerate() {
            if row_idx < skip_rows {
                continue;
            }
            let record = result?;
            let fields: HashMap<String, JsonValue> = record
                .iter()
                .enumerate()
                .map(|(i, v)| (format!("col_{i}"), JsonValue::String(v.to_string())))
                .collect();
            let raw = serde_json::to_string(&fields).unwrap_or_default();
            records.push(SourceRecord {
                row_number: (records.len() + 1) as i64,
                raw,
                fields,
            });
        }
    }

    Ok(records)
}

// ---------------------------------------------------------------------------
// CsvFileConnector
// ---------------------------------------------------------------------------

pub struct CsvFileConnector;

#[async_trait::async_trait]
impl EtlConnector for CsvFileConnector {
    fn connector_type(&self) -> &'static str {
        "csv_file"
    }

    async fn test_connection(&self, _cfg: &EtlConnectorConfig) -> Result<()> {
        Ok(()) // No network connection to test for file-based connectors
    }

    async fn discover_schema(&self, cfg: &EtlConnectorConfig) -> Result<Vec<SchemaTable>> {
        let records = self.extract(cfg).await?;
        if let Some(first) = records.first() {
            let fields = first
                .fields
                .keys()
                .map(|k| SchemaField {
                    name: k.clone(),
                    data_type: "string".to_string(),
                })
                .collect();
            Ok(vec![SchemaTable {
                name: "csv".to_string(),
                fields,
            }])
        } else {
            Ok(vec![])
        }
    }

    async fn extract(&self, cfg: &EtlConnectorConfig) -> Result<Vec<SourceRecord>> {
        let delimiter = cfg
            .source_config
            .get("delimiter")
            .and_then(|v| v.as_str())
            .and_then(|s| s.bytes().next())
            .unwrap_or(b',');
        parse_csv_bytes(cfg, delimiter).await
    }
}

// ---------------------------------------------------------------------------
// TsvFileConnector
// ---------------------------------------------------------------------------

pub struct TsvFileConnector;

#[async_trait::async_trait]
impl EtlConnector for TsvFileConnector {
    fn connector_type(&self) -> &'static str {
        "tsv_file"
    }

    async fn test_connection(&self, _cfg: &EtlConnectorConfig) -> Result<()> {
        Ok(())
    }

    async fn discover_schema(&self, cfg: &EtlConnectorConfig) -> Result<Vec<SchemaTable>> {
        let records = self.extract(cfg).await?;
        if let Some(first) = records.first() {
            let fields = first
                .fields
                .keys()
                .map(|k| SchemaField {
                    name: k.clone(),
                    data_type: "string".to_string(),
                })
                .collect();
            Ok(vec![SchemaTable {
                name: "tsv".to_string(),
                fields,
            }])
        } else {
            Ok(vec![])
        }
    }

    async fn extract(&self, cfg: &EtlConnectorConfig) -> Result<Vec<SourceRecord>> {
        parse_csv_bytes(cfg, b'\t').await
    }
}
