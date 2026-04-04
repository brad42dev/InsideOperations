//! XML file ETL connector using quick-xml.
//!
//! Finds all `<{record_element}>` tags in the document and extracts their named
//! child text nodes as fields. Field names are taken from `field_elements` in
//! source_config; if omitted, all child element names are captured.

use anyhow::{anyhow, Result};
use quick_xml::events::Event;
use quick_xml::Reader;
use serde_json::Value as JsonValue;
use std::collections::HashMap;

use super::{resolve_file_content, EtlConnector, EtlConnectorConfig};
use crate::handlers::import::{SchemaField, SchemaTable};
use crate::pipeline::SourceRecord;

// ---------------------------------------------------------------------------
// XmlFileConnector
// ---------------------------------------------------------------------------

pub struct XmlFileConnector;

#[async_trait::async_trait]
impl EtlConnector for XmlFileConnector {
    fn connector_type(&self) -> &'static str {
        "xml_file"
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
                name: "xml".to_string(),
                fields,
            }])
        } else {
            Ok(vec![])
        }
    }

    async fn extract(&self, cfg: &EtlConnectorConfig) -> Result<Vec<SourceRecord>> {
        let bytes = resolve_file_content(&cfg.source_config, &cfg.upload_dir).await?;
        let record_element = cfg
            .source_config
            .get("record_element")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("xml_file: record_element is required in source_config"))?
            .to_string();

        // Optional allowlist of field names to extract; empty = capture all children
        let field_allowlist: Option<Vec<String>> = cfg
            .source_config
            .get("field_elements")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                    .collect()
            });

        let text =
            std::str::from_utf8(&bytes).map_err(|e| anyhow!("xml_file: invalid UTF-8: {e}"))?;

        let mut reader = Reader::from_str(text);
        reader.config_mut().trim_text(true);

        let mut records: Vec<SourceRecord> = Vec::new();
        let mut buf = Vec::new();

        // State machine: are we inside a record element? inside a child element?
        let mut in_record = false;
        let mut current_fields: HashMap<String, JsonValue> = HashMap::new();
        let mut current_child: Option<String> = None;

        loop {
            match reader.read_event_into(&mut buf) {
                Ok(Event::Start(ref e)) => {
                    let tag = std::str::from_utf8(e.local_name().as_ref())
                        .unwrap_or("")
                        .to_string();
                    if tag == record_element {
                        in_record = true;
                        current_fields = HashMap::new();
                    } else if in_record {
                        let capture = match &field_allowlist {
                            Some(list) => list.contains(&tag),
                            None => true,
                        };
                        if capture {
                            current_child = Some(tag);
                        }
                    }
                }
                Ok(Event::Text(e)) => {
                    if in_record {
                        if let Some(ref field_name) = current_child {
                            let text_val = e.unescape().map(|s| s.into_owned()).unwrap_or_default();
                            current_fields.insert(field_name.clone(), JsonValue::String(text_val));
                        }
                    }
                }
                Ok(Event::End(ref e)) => {
                    let tag = std::str::from_utf8(e.local_name().as_ref())
                        .unwrap_or("")
                        .to_string();
                    if tag == record_element && in_record {
                        let raw = serde_json::to_string(&current_fields).unwrap_or_default();
                        records.push(SourceRecord {
                            row_number: (records.len() + 1) as i64,
                            raw,
                            fields: current_fields.clone(),
                        });
                        in_record = false;
                        current_fields = HashMap::new();
                    } else if in_record && current_child.as_deref() == Some(&tag) {
                        current_child = None;
                    }
                }
                Ok(Event::Eof) => break,
                Err(e) => return Err(anyhow!("xml_file: parse error: {e}")),
                _ => {}
            }
            buf.clear();
        }

        Ok(records)
    }
}
