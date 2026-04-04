//! Excel (xlsx/xls) ETL connector using calamine.
//!
//! Reads an uploaded file by `file_id` or inline `data`. Supports selecting a sheet
//! by `sheet_name` or `sheet_index` (default: first sheet). The `header_row` config
//! controls which row provides column names (0-indexed, default 0).

use anyhow::{anyhow, Result};
use calamine::{open_workbook_auto_from_rs, Data, Reader};
use serde_json::Value as JsonValue;
use std::collections::HashMap;
use std::io::Cursor;

use crate::handlers::import::{SchemaField, SchemaTable};
use crate::pipeline::SourceRecord;
use super::{resolve_file_content, EtlConnector, EtlConnectorConfig};

// ---------------------------------------------------------------------------
// ExcelFileConnector
// ---------------------------------------------------------------------------

pub struct ExcelFileConnector;

#[async_trait::async_trait]
impl EtlConnector for ExcelFileConnector {
    fn connector_type(&self) -> &'static str {
        "excel_file"
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
                name: "sheet".to_string(),
                fields,
            }])
        } else {
            Ok(vec![])
        }
    }

    async fn extract(&self, cfg: &EtlConnectorConfig) -> Result<Vec<SourceRecord>> {
        let bytes = resolve_file_content(&cfg.source_config, &cfg.upload_dir).await?;
        let header_row = cfg
            .source_config
            .get("header_row")
            .and_then(|v| v.as_u64())
            .unwrap_or(0) as usize;

        // Run calamine (sync) — bytes are in memory so no blocking I/O concern
        let mut workbook = open_workbook_auto_from_rs(Cursor::new(bytes))
            .map_err(|e| anyhow!("excel_file: failed to open workbook: {e}"))?;

        // Select sheet by name or index
        let sheet_name = if let Some(name) =
            cfg.source_config.get("sheet_name").and_then(|v| v.as_str())
        {
            name.to_string()
        } else {
            let idx = cfg
                .source_config
                .get("sheet_index")
                .and_then(|v| v.as_u64())
                .unwrap_or(0) as usize;
            workbook
                .sheet_names()
                .get(idx)
                .cloned()
                .ok_or_else(|| anyhow!("excel_file: sheet index {idx} out of range"))?
        };

        let range = workbook
            .worksheet_range(&sheet_name)
            .map_err(|e| anyhow!("excel_file: failed to read sheet '{sheet_name}': {e}"))?;

        let mut rows = range.rows();

        // Advance to header row
        for _ in 0..header_row {
            rows.next();
        }

        // Read header
        let headers: Vec<String> = match rows.next() {
            Some(row) => row
                .iter()
                .enumerate()
                .map(|(i, cell)| match cell {
                    Data::String(s) => s.clone(),
                    Data::Empty => format!("col_{i}"),
                    other => other.to_string(),
                })
                .collect(),
            None => return Ok(vec![]),
        };

        let mut records: Vec<SourceRecord> = Vec::new();

        for row in rows {
            let fields: HashMap<String, JsonValue> = headers
                .iter()
                .zip(row.iter())
                .map(|(h, cell)| {
                    let val = match cell {
                        Data::String(s) => JsonValue::String(s.clone()),
                        Data::Float(f) => {
                            JsonValue::Number(serde_json::Number::from_f64(*f).unwrap_or_else(|| serde_json::Number::from(0)))
                        }
                        Data::Int(i) => JsonValue::Number((*i).into()),
                        Data::Bool(b) => JsonValue::Bool(*b),
                        Data::Empty => JsonValue::Null,
                        Data::Error(e) => JsonValue::String(format!("{e:?}")),
                        other => JsonValue::String(other.to_string()),
                    };
                    (h.clone(), val)
                })
                .collect();

            let raw = serde_json::to_string(&fields).unwrap_or_default();
            records.push(SourceRecord {
                row_number: (records.len() + 1) as i64,
                raw,
                fields,
            });
        }

        Ok(records)
    }
}
