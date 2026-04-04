//! JSON file ETL connector.
//!
//! Supports two formats controlled by `source_config.format`:
//! - `"array"` (default) — parses the file as a JSON document; `records_path` navigates
//!   to an array inside the document (e.g. `"data.items"`).
//! - `"ndjson"` — reads the file line by line, parsing each non-empty line as a JSON object.

use anyhow::{anyhow, Result};
use serde_json::Value as JsonValue;
use std::collections::HashMap;

use crate::handlers::import::{SchemaField, SchemaTable};
use crate::pipeline::SourceRecord;
use super::{extract_by_path, resolve_file_content, EtlConnector, EtlConnectorConfig};

// ---------------------------------------------------------------------------
// JsonFileConnector
// ---------------------------------------------------------------------------

pub struct JsonFileConnector;

#[async_trait::async_trait]
impl EtlConnector for JsonFileConnector {
    fn connector_type(&self) -> &'static str {
        "json_file"
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
                name: "json".to_string(),
                fields,
            }])
        } else {
            Ok(vec![])
        }
    }

    async fn extract(&self, cfg: &EtlConnectorConfig) -> Result<Vec<SourceRecord>> {
        let bytes = resolve_file_content(&cfg.source_config, &cfg.upload_dir).await?;
        let format = cfg
            .source_config
            .get("format")
            .and_then(|v| v.as_str())
            .unwrap_or("array");
        let records_path = cfg
            .source_config
            .get("records_path")
            .and_then(|v| v.as_str())
            .unwrap_or("");

        let items: Vec<JsonValue> = match format {
            "ndjson" => {
                let text = std::str::from_utf8(&bytes)
                    .map_err(|e| anyhow!("json_file: invalid UTF-8: {e}"))?;
                text.lines()
                    .filter(|line| !line.trim().is_empty())
                    .map(|line| {
                        serde_json::from_str(line)
                            .map_err(|e| anyhow!("json_file: NDJSON parse error: {e}"))
                    })
                    .collect::<Result<Vec<_>>>()?
            }
            _ => {
                // array format
                let doc: JsonValue = serde_json::from_slice(&bytes)
                    .map_err(|e| anyhow!("json_file: JSON parse error: {e}"))?;
                let data = extract_by_path(&doc, records_path);
                match data {
                    v if v.is_array() => v.as_array().unwrap().clone(),
                    v if v.is_object() => vec![v.clone()],
                    JsonValue::Null if !records_path.is_empty() => {
                        return Err(anyhow!(
                            "json_file: records_path '{records_path}' not found in document"
                        ))
                    }
                    _ => return Err(anyhow!("json_file: expected array at records_path")),
                }
            }
        };

        let mut records: Vec<SourceRecord> = Vec::new();
        for item in &items {
            let fields: HashMap<String, JsonValue> = match item.as_object() {
                Some(map) => map.iter().map(|(k, v)| (k.clone(), v.clone())).collect(),
                None => {
                    let mut m = HashMap::new();
                    m.insert("value".to_string(), item.clone());
                    m
                }
            };
            let raw = item.to_string();
            records.push(SourceRecord {
                row_number: (records.len() + 1) as i64,
                raw,
                fields,
            });
        }

        Ok(records)
    }
}
