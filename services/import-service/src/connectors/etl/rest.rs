//! Generic REST API ETL connector.
//!
//! Supports arbitrary HTTP endpoints with configurable authentication (none,
//! basic, bearer token, API key header) and three pagination strategies:
//! - `none`         — single-page fetch
//! - `cursor`       — follow a cursor/next-link field in the response body
//! - `offset_limit` — advance an `offset` query parameter by `page_size` each page

use anyhow::{anyhow, Result};
use serde_json::Value as JsonValue;
use tracing::info;

use crate::handlers::import::{SchemaField, SchemaTable};
use crate::pipeline::SourceRecord;
use super::{apply_auth_etl, extract_by_path, EtlConnector, EtlConnectorConfig};

// ---------------------------------------------------------------------------
// Connector struct
// ---------------------------------------------------------------------------

pub struct GenericRestConnector;

impl GenericRestConnector {
    fn base_url(cfg: &EtlConnectorConfig) -> Result<&str> {
        cfg.connection_config
            .get("base_url")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow!("generic_rest: base_url is required in connection config"))
    }

    fn build_request_url(base: &str, endpoint: &str) -> String {
        if endpoint.is_empty() {
            return base.to_string();
        }
        if endpoint.starts_with("http://") || endpoint.starts_with("https://") {
            return endpoint.to_string();
        }
        format!(
            "{}/{}",
            base.trim_end_matches('/'),
            endpoint.trim_start_matches('/')
        )
    }
}

// ---------------------------------------------------------------------------
// EtlConnector implementation
// ---------------------------------------------------------------------------

#[async_trait::async_trait]
impl EtlConnector for GenericRestConnector {
    fn connector_type(&self) -> &'static str {
        "generic_rest"
    }

    /// Test connectivity by making a GET request to `base_url`.
    async fn test_connection(&self, cfg: &EtlConnectorConfig) -> Result<()> {
        let url = Self::base_url(cfg)?;
        let client = reqwest::Client::new();
        let resp = apply_auth_etl(client.get(url), cfg).send().await?;
        if !resp.status().is_success() {
            return Err(anyhow!(
                "generic_rest: test_connection: HTTP {} from {}",
                resp.status(),
                url
            ));
        }
        Ok(())
    }

    /// Discover schema by extracting a sample page and reading the first record's keys.
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
                name: "response".to_string(),
                fields,
            }])
        } else {
            Ok(vec![])
        }
    }

    /// Extract all records from the REST endpoint, following pagination as configured.
    async fn extract(&self, cfg: &EtlConnectorConfig) -> Result<Vec<SourceRecord>> {
        let base = Self::base_url(cfg)?;
        let endpoint = cfg
            .source_config
            .get("endpoint")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let base_url = Self::build_request_url(base, endpoint);
        let method = cfg
            .source_config
            .get("method")
            .and_then(|v| v.as_str())
            .unwrap_or("GET");
        let pagination_type = cfg
            .source_config
            .get("pagination_type")
            .and_then(|v| v.as_str())
            .unwrap_or("none");
        let records_path = cfg
            .source_config
            .get("records_path")
            .and_then(|v| v.as_str())
            .unwrap_or("");
        let max_pages = cfg
            .source_config
            .get("max_pages")
            .and_then(|v| v.as_u64())
            .unwrap_or(100) as usize;
        let page_size = cfg
            .source_config
            .get("page_size")
            .and_then(|v| v.as_u64())
            .unwrap_or(100);

        // Apply watermark as a query parameter on the starting URL
        let watermark_param = cfg.source_config
            .get("watermark_param")
            .and_then(|v| v.as_str());
        let watermark_value = cfg.watermark_state
            .as_ref()
            .and_then(|wm| wm.get("last_value"))
            .and_then(|v| v.as_str());
        let url = if let (Some(param), Some(val)) = (watermark_param, watermark_value) {
            let sep = if base_url.contains('?') { "&" } else { "?" };
            format!("{base_url}{sep}{param}={val}")
        } else {
            base_url.clone()
        };

        let client = reqwest::Client::new();
        let mut all_records: Vec<SourceRecord> = Vec::new();
        let mut next_url: Option<String> = Some(url.clone());
        let mut offset: u64 = 0;
        let mut page = 0usize;

        while let Some(current_url) = next_url.take() {
            if page >= max_pages {
                info!(
                    connection_id = %cfg.connection_id,
                    pages = page,
                    "generic_rest: max_pages reached; stopping pagination"
                );
                break;
            }

            let req = match method.to_uppercase().as_str() {
                "POST" => {
                    let body = cfg
                        .source_config
                        .get("request_body")
                        .cloned()
                        .unwrap_or(JsonValue::Null);
                    client.post(&current_url).json(&body)
                }
                _ => client.get(&current_url),
            };

            let resp = apply_auth_etl(req, cfg).send().await?;
            if !resp.status().is_success() {
                return Err(anyhow!(
                    "generic_rest: extract: HTTP {} from {}",
                    resp.status(),
                    current_url
                ));
            }

            // Extract Link header before consuming body (needed for link_header pagination)
            let link_next: Option<String> = if pagination_type == "link_header" {
                resp.headers()
                    .get("link")
                    .and_then(|v| v.to_str().ok())
                    .and_then(parse_link_next)
                    .map(|s| s.to_string())
            } else {
                None
            };

            let body: JsonValue = resp.json().await?;
            let data = extract_by_path(&body, records_path);

            let arr: Vec<JsonValue> = match data {
                v if v.is_array() => v.as_array().unwrap().clone(),
                v if v.is_object() => vec![v.clone()],
                _ => vec![],
            };

            for item in &arr {
                if let Some(map) = item.as_object() {
                    all_records.push(SourceRecord {
                        row_number: (all_records.len() + 1) as i64,
                        raw: item.to_string(),
                        fields: map.iter().map(|(k, v)| (k.clone(), v.clone())).collect(),
                    });
                }
            }

            // Advance pagination
            match pagination_type {
                "cursor" => {
                    let cursor_path = cfg
                        .source_config
                        .get("cursor_path")
                        .and_then(|v| v.as_str())
                        .unwrap_or("next");
                    if let Some(next_str) = extract_by_path(&body, cursor_path).as_str() {
                        if !next_str.is_empty() {
                            next_url = Some(if next_str.starts_with("http") {
                                next_str.to_string()
                            } else {
                                format!("{}?cursor={}", url, next_str)
                            });
                        }
                    }
                }
                "offset_limit" => {
                    if arr.len() as u64 >= page_size {
                        offset += page_size;
                        let sep = if url.contains('?') { "&" } else { "?" };
                        next_url = Some(format!(
                            "{}{}offset={}&limit={}",
                            url, sep, offset, page_size
                        ));
                    }
                }
                "link_header" => {
                    if let Some(next) = link_next {
                        next_url = Some(next);
                    }
                }
                _ => { /* none — single page, next_url remains None */ }
            }

            page += 1;
        }

        Ok(all_records)
    }
}

/// Parse the `next` URL from a Link header value.
/// Format: `<https://example.com/api?page=2>; rel="next", <...>; rel="last"`
fn parse_link_next(link_header: &str) -> Option<&str> {
    for part in link_header.split(',') {
        let part = part.trim();
        if part.contains("rel=\"next\"") || part.contains("rel=next") {
            if let Some(url_part) = part.split('>').next() {
                return Some(url_part.trim_start_matches('<'));
            }
        }
    }
    None
}
