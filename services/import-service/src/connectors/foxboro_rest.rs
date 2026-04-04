//! AVEVA EcoStruxure Foxboro DCS supplemental connector.
//!
//! REST API via FoxConnect platform, available since I/A Series v9.4.
//! Base URL: https://{host}/foxconnect/api/v1
//! Authentication: Basic auth or bearer token
//!
//! Metadata: GET /compounds — compound/block hierarchy with parameter values.
//!   Each compound contains blocks; each block exposes parameters including
//!   description, engineering units, and alarm limits.
//!
//! Events: GET /alarms?since=... — alarm event history from the alarm journal.
//!
//! Connection config keys: base_url (e.g. "https://foxboro-host")
//! Auth config keys: username + password (Basic) or bearer_token
//! Optional source_config keys:
//!   page_size — compounds page size (default 1000)

use anyhow::{anyhow, Result};
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use tracing::warn;

use super::{apply_auth, ConnectorConfig, DcsConnector, SupplementalEvent, SupplementalMetadata};

pub struct FoxboroConnector;

fn base(cfg: &ConnectorConfig) -> Result<String> {
    cfg.base_url
        .clone()
        .ok_or_else(|| anyhow!("foxboro_rest: base_url is required"))
}

fn client(cfg: &ConnectorConfig) -> Result<reqwest::Client> {
    let mut builder = reqwest::Client::builder();
    if cfg
        .extra
        .get("ignore_tls")
        .and_then(|v| v.as_bool())
        .unwrap_or(false)
    {
        builder = builder.danger_accept_invalid_certs(true);
    }
    builder.build().map_err(|e| anyhow!("reqwest client: {e}"))
}

#[async_trait]
impl DcsConnector for FoxboroConnector {
    fn connector_type(&self) -> &'static str {
        "foxboro_rest"
    }

    async fn test_connection(&self, cfg: &ConnectorConfig) -> Result<()> {
        let base = base(cfg)?;
        let client = client(cfg)?;
        let req = apply_auth(
            client.get(format!("{base}/foxconnect/api/v1/compounds?count=1")),
            cfg,
        );
        let resp = req.send().await?;
        if !resp.status().is_success() {
            return Err(anyhow!("foxboro test_connection: HTTP {}", resp.status()));
        }
        Ok(())
    }

    async fn fetch_metadata(&self, cfg: &ConnectorConfig) -> Result<Vec<SupplementalMetadata>> {
        let base = base(cfg)?;
        let client = client(cfg)?;
        let page_size = cfg
            .extra
            .get("page_size")
            .and_then(|v| v.as_u64())
            .unwrap_or(1000);

        let mut results = Vec::new();
        let mut offset = 0u64;

        loop {
            let url = format!(
                "{base}/foxconnect/api/v1/compounds?count={page_size}&offset={offset}"
            );
            let req = apply_auth(client.get(&url), cfg);
            let resp: serde_json::Value = match req.send().await?.json().await {
                Ok(v) => v,
                Err(e) => {
                    warn!("foxboro: failed to parse compounds response: {e}");
                    break;
                }
            };

            let compounds = match resp
                .as_array()
                .cloned()
                .or_else(|| {
                    resp.get("compounds")
                        .or_else(|| resp.get("data"))
                        .or_else(|| resp.get("items"))
                        .and_then(|v| v.as_array())
                        .cloned()
                }) {
                Some(a) => a,
                None => break,
            };

            let fetched = compounds.len();
            for compound in &compounds {
                let compound_name = compound
                    .get("name")
                    .or_else(|| compound.get("compoundName"))
                    .and_then(|v| v.as_str())
                    .unwrap_or("")
                    .to_string();

                // A compound may embed its blocks directly, or blocks may be nested
                let blocks = match compound
                    .get("blocks")
                    .and_then(|v| v.as_array())
                    .cloned()
                {
                    Some(b) => b,
                    None => {
                        // If no inline blocks, treat compound itself as a tag entry
                        let tagname = if compound_name.is_empty() {
                            continue;
                        } else {
                            compound_name.clone()
                        };
                        results.push(SupplementalMetadata {
                            tagname,
                            description: compound
                                .get("description")
                                .and_then(|v| v.as_str())
                                .map(|s| s.to_string()),
                            engineering_units: compound
                                .get("eu")
                                .or_else(|| compound.get("units"))
                                .and_then(|v| v.as_str())
                                .map(|s| s.to_string()),
                            eu_range_low: compound.get("euLo").and_then(|v| v.as_f64()),
                            eu_range_high: compound.get("euHi").and_then(|v| v.as_f64()),
                            alarm_limit_hh: compound.get("hihi").and_then(|v| v.as_f64()),
                            alarm_limit_h: compound.get("hi").and_then(|v| v.as_f64()),
                            alarm_limit_l: compound.get("lo").and_then(|v| v.as_f64()),
                            alarm_limit_ll: compound.get("lolo").and_then(|v| v.as_f64()),
                        });
                        continue;
                    }
                };

                for block in &blocks {
                    let block_name = match block
                        .get("name")
                        .or_else(|| block.get("blockName"))
                        .and_then(|v| v.as_str())
                    {
                        Some(n) => n,
                        None => continue,
                    };
                    let tagname = if compound_name.is_empty() {
                        block_name.to_string()
                    } else {
                        format!("{compound_name}:{block_name}")
                    };

                    results.push(SupplementalMetadata {
                        tagname,
                        description: block
                            .get("description")
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string()),
                        engineering_units: block
                            .get("eu")
                            .or_else(|| block.get("units"))
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string()),
                        eu_range_low: block.get("euLo").and_then(|v| v.as_f64()),
                        eu_range_high: block.get("euHi").and_then(|v| v.as_f64()),
                        alarm_limit_hh: block.get("hihi").and_then(|v| v.as_f64()),
                        alarm_limit_h: block.get("hi").and_then(|v| v.as_f64()),
                        alarm_limit_l: block.get("lo").and_then(|v| v.as_f64()),
                        alarm_limit_ll: block.get("lolo").and_then(|v| v.as_f64()),
                    });
                }
            }

            if fetched < page_size as usize {
                break;
            }
            offset += page_size;
        }

        Ok(results)
    }

    async fn fetch_events(
        &self,
        cfg: &ConnectorConfig,
        since: DateTime<Utc>,
    ) -> Result<Vec<SupplementalEvent>> {
        let base = base(cfg)?;
        let client = client(cfg)?;
        let since_str = since.to_rfc3339();

        let url = format!("{base}/foxconnect/api/v1/alarms?since={since_str}");
        let req = apply_auth(client.get(&url), cfg);
        let resp: serde_json::Value = match req.send().await?.json().await {
            Ok(v) => v,
            Err(e) => {
                warn!("foxboro: failed to parse alarms response: {e}");
                return Ok(vec![]);
            }
        };

        let items = match resp
            .as_array()
            .cloned()
            .or_else(|| {
                resp.get("alarms")
                    .or_else(|| resp.get("data"))
                    .or_else(|| resp.get("items"))
                    .and_then(|v| v.as_array())
                    .cloned()
            }) {
            Some(a) => a,
            None => return Ok(vec![]),
        };

        let mut results = Vec::new();
        for item in &items {
            let ts_str = match item
                .get("eventTime")
                .or_else(|| item.get("timestamp"))
                .or_else(|| item.get("time"))
                .and_then(|v| v.as_str())
            {
                Some(s) => s,
                None => continue,
            };
            let timestamp = match DateTime::parse_from_rfc3339(ts_str) {
                Ok(t) => t.with_timezone(&Utc),
                Err(_) => continue,
            };
            let source_name = item
                .get("tag")
                .or_else(|| item.get("source"))
                .or_else(|| item.get("name"))
                .and_then(|v| v.as_str())
                .unwrap_or("unknown")
                .to_string();

            results.push(SupplementalEvent {
                event_type: "process_alarm".to_string(),
                source_name,
                timestamp,
                severity: item
                    .get("priority")
                    .or_else(|| item.get("severity"))
                    .and_then(|v| v.as_i64())
                    .map(|v| v as i32),
                message: item
                    .get("message")
                    .or_else(|| item.get("description"))
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                alarm_type: item
                    .get("alarmType")
                    .or_else(|| item.get("type"))
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                alarm_state: item
                    .get("alarmState")
                    .or_else(|| item.get("state"))
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                external_id: item
                    .get("id")
                    .or_else(|| item.get("eventId"))
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                limit_value: item.get("limitValue").and_then(|v| v.as_f64()),
                actual_value: item
                    .get("processValue")
                    .or_else(|| item.get("currentValue"))
                    .and_then(|v| v.as_f64()),
            });
        }
        Ok(results)
    }
}
