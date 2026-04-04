//! MongoDB ETL connector using the official mongodb 3.x async driver.
//!
//! Connects via a MongoDB URI in `connection_config.connection_string`.
//! Optionally accepts a `filter` (JSON object → BSON document) and
//! `projection` in `source_config`. Converts BSON documents to `SourceRecord`
//! via serde_json serialization.
//!
//! Schema discovery: calls `list_collection_names()` for table names and
//! samples the first document to infer field names.

use anyhow::{anyhow, Result};
use bson::{doc, Document};
use mongodb::Client;
use serde_json::Value as JsonValue;
use std::collections::HashMap;

use super::{EtlConnector, EtlConnectorConfig};
use crate::handlers::import::{SchemaField, SchemaTable};
use crate::pipeline::SourceRecord;

// ---------------------------------------------------------------------------
// MongoConnector
// ---------------------------------------------------------------------------

pub struct MongoConnector;

impl MongoConnector {
    fn get_uri(cfg: &EtlConnectorConfig) -> Result<String> {
        cfg.connection_config
            .get("connection_string")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .ok_or_else(|| anyhow!("mongodb: connection_string is required in connection_config"))
    }

    fn get_database(cfg: &EtlConnectorConfig) -> Result<String> {
        cfg.connection_config
            .get("database")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string())
            .ok_or_else(|| anyhow!("mongodb: database is required in connection_config"))
    }

    /// Convert a serde_json::Value filter to a BSON Document.
    /// Simple JSON objects map directly to BSON via serde.
    fn json_to_doc(value: Option<&JsonValue>) -> Document {
        value
            .and_then(|v| serde_json::from_value::<Document>(v.clone()).ok())
            .unwrap_or_default()
    }

    /// Convert a BSON Document to a HashMap of JSON values via serde.
    fn doc_to_fields(doc: Document) -> HashMap<String, JsonValue> {
        match serde_json::to_value(&doc) {
            Ok(JsonValue::Object(map)) => map.into_iter().collect(),
            _ => HashMap::new(),
        }
    }
}

#[async_trait::async_trait]
impl EtlConnector for MongoConnector {
    fn connector_type(&self) -> &'static str {
        "mongodb"
    }

    async fn test_connection(&self, cfg: &EtlConnectorConfig) -> Result<()> {
        let uri = Self::get_uri(cfg)?;
        let db_name = Self::get_database(cfg)?;
        let client = Client::with_uri_str(&uri)
            .await
            .map_err(|e| anyhow!("mongodb: connection failed: {e}"))?;
        client
            .database(&db_name)
            .list_collection_names()
            .await
            .map_err(|e| anyhow!("mongodb: test query failed: {e}"))?;
        Ok(())
    }

    async fn discover_schema(&self, cfg: &EtlConnectorConfig) -> Result<Vec<SchemaTable>> {
        let uri = Self::get_uri(cfg)?;
        let db_name = Self::get_database(cfg)?;
        let client = Client::with_uri_str(&uri)
            .await
            .map_err(|e| anyhow!("mongodb: connection failed: {e}"))?;
        let db = client.database(&db_name);

        let collection_names = db
            .list_collection_names()
            .await
            .map_err(|e| anyhow!("mongodb: list_collection_names failed: {e}"))?;

        let mut tables = Vec::new();
        for name in collection_names {
            let collection = db.collection::<Document>(&name);
            // Sample one document to infer field names
            let fields = if let Some(doc) = collection.find_one(doc! {}).await.unwrap_or(None) {
                doc.keys()
                    .map(|k| SchemaField {
                        name: k.clone(),
                        data_type: "mixed".to_string(),
                    })
                    .collect()
            } else {
                vec![]
            };
            tables.push(SchemaTable { name, fields });
        }
        Ok(tables)
    }

    async fn extract(&self, cfg: &EtlConnectorConfig) -> Result<Vec<SourceRecord>> {
        let uri = Self::get_uri(cfg)?;
        let db_name = Self::get_database(cfg)?;
        let collection_name = cfg
            .source_config
            .get("collection")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("mongodb: collection is required in source_config"))?
            .to_string();

        let mut filter_doc = Self::json_to_doc(cfg.source_config.get("filter"));
        let projection_doc = cfg
            .source_config
            .get("projection")
            .and_then(|v| serde_json::from_value::<Document>(v.clone()).ok());

        // Apply watermark filter
        if let Some(ref wm) = cfg.watermark_state {
            let wm_column = cfg
                .source_config
                .get("watermark_column")
                .and_then(|v| v.as_str());
            let last_value = wm.get("last_value").and_then(|v| v.as_str());

            if let (Some(col), Some(val)) = (wm_column, last_value) {
                let wm_type = wm
                    .get("watermark_type")
                    .and_then(|v| v.as_str())
                    .unwrap_or("timestamp");
                if wm_type == "objectid" {
                    if let Ok(oid) = bson::oid::ObjectId::parse_str(val) {
                        filter_doc.insert(col.to_string(), doc! { "$gt": oid });
                    }
                } else {
                    // Assume ISO 8601 timestamp
                    if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(val) {
                        let bson_dt = bson::DateTime::from_millis(dt.timestamp_millis());
                        filter_doc.insert(col.to_string(), doc! { "$gt": bson_dt });
                    }
                }
            }
        }

        let max_rows = cfg
            .source_config
            .get("max_rows")
            .and_then(|v| v.as_u64())
            .unwrap_or(50_000) as i64;

        let client = Client::with_uri_str(&uri)
            .await
            .map_err(|e| anyhow!("mongodb: connection failed: {e}"))?;
        let collection = client
            .database(&db_name)
            .collection::<Document>(&collection_name);

        let mut find_op = collection.find(filter_doc).limit(max_rows);
        if let Some(proj) = projection_doc {
            find_op = find_op.projection(proj);
        }
        let mut cursor = find_op
            .await
            .map_err(|e| anyhow!("mongodb: find failed: {e}"))?;

        let mut records: Vec<SourceRecord> = Vec::new();
        let mut row_number = 1i64;

        while cursor
            .advance()
            .await
            .map_err(|e| anyhow!("mongodb: cursor advance failed: {e}"))?
        {
            let doc: Document = cursor
                .deserialize_current()
                .map_err(|e| anyhow!("mongodb: deserialize_current failed: {e}"))?;
            let fields = Self::doc_to_fields(doc);
            let raw = serde_json::to_string(&fields).unwrap_or_default();
            records.push(SourceRecord {
                row_number,
                raw,
                fields,
            });
            row_number += 1;
        }

        Ok(records)
    }
}
