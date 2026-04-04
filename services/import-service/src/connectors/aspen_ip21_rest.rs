//! AspenTech InfoPlus.21 (IP.21) supplemental DCS connector.
//!
//! REST API base: https://{host}/processdata/api/v1
//! Authentication: Basic auth or API key via X-Api-Key header.
//!
//! Metadata endpoint: GET /processdata/api/v1/definitions?filter=*&count=5000
//! Returns tag definitions including description, engineering units, range, and
//! all four alarm limits (HIHI/HI/LO/LOLO) — the most complete metadata source
//! among supported connectors.
//!
//! Event endpoint: GET /processdata/api/v1/events?startTime=...&endTime=*&filter=*
//! Returns alarm event frames with severity, alarm type, and acknowledgement state.
//!
//! Connection config keys: base_url (e.g. "https://ip21host")
//! Auth config keys: username + password (Basic) or api_key (X-Api-Key)
//! Optional source_config keys:
//!   page_size — definitions page size (default 5000)

use anyhow::{anyhow, Result};
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use tracing::warn;

use super::{apply_auth, ConnectorConfig, DcsConnector, SupplementalEvent, SupplementalMetadata};

pub struct AspenIp21Connector;

fn base(cfg: &ConnectorConfig) -> Result<String> {
    cfg.base_url
        .clone()
        .ok_or_else(|| anyhow!("aspen_ip21_rest: base_url is required"))
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
impl DcsConnector for AspenIp21Connector {
    fn connector_type(&self) -> &'static str {
        "aspen_ip21_rest"
    }

    async fn test_connection(&self, cfg: &ConnectorConfig) -> Result<()> {
        let base = base(cfg)?;
        let client = client(cfg)?;
        let req = apply_auth(
            client.get(format!("{base}/processdata/api/v1/definitions?count=1")),
            cfg,
        );
        let resp = req.send().await?;
        if !resp.status().is_success() {
            return Err(anyhow!("aspen_ip21 test_connection: HTTP {}", resp.status()));
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
            .unwrap_or(5000);

        let mut results = Vec::new();
        let mut offset = 0u64;

        loop {
            let url = format!(
                "{base}/processdata/api/v1/definitions?filter=*&count={page_size}&offset={offset}"
            );
            let req = apply_auth(client.get(&url), cfg);
            let resp: serde_json::Value = match req.send().await?.json().await {
                Ok(v) => v,
                Err(e) => {
                    warn!("aspen_ip21: failed to parse definitions response: {e}");
                    break;
                }
            };

            let items = match resp
                .as_array()
                .cloned()
                .or_else(|| {
                    resp.get("data")
                        .or_else(|| resp.get("items"))
                        .and_then(|v| v.as_array())
                        .cloned()
                }) {
                Some(a) => a,
                None => break,
            };

            let fetched = items.len();
            for item in &items {
                let tagname = match item
                    .get("TagName")
                    .or_else(|| item.get("name"))
                    .and_then(|v| v.as_str())
                {
                    Some(n) => n.to_string(),
                    None => continue,
                };

                results.push(SupplementalMetadata {
                    tagname,
                    description: item
                        .get("Description")
                        .or_else(|| item.get("description"))
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string()),
                    engineering_units: item
                        .get("EngUnits")
                        .or_else(|| item.get("Units"))
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string()),
                    eu_range_low: item
                        .get("IP_INPUT_MIN")
                        .and_then(|v| v.as_f64()),
                    eu_range_high: item
                        .get("IP_INPUT_MAX")
                        .and_then(|v| v.as_f64()),
                    alarm_limit_hh: item
                        .get("IP_ALMHIHI_PV")
                        .and_then(|v| v.as_f64()),
                    alarm_limit_h: item
                        .get("IP_ALMHI_PV")
                        .and_then(|v| v.as_f64()),
                    alarm_limit_l: item
                        .get("IP_ALMLO_PV")
                        .and_then(|v| v.as_f64()),
                    alarm_limit_ll: item
                        .get("IP_ALMLOLO_PV")
                        .and_then(|v| v.as_f64()),
                });
            }

            if fetched < page_size as usize {
                break; // last page
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
        let start_str = since.to_rfc3339();

        let url = format!(
            "{base}/processdata/api/v1/events?startTime={start_str}&endTime=*&filter=*"
        );
        let req = apply_auth(client.get(&url), cfg);
        let resp: serde_json::Value = match req.send().await?.json().await {
            Ok(v) => v,
            Err(e) => {
                warn!("aspen_ip21: failed to parse events response: {e}");
                return Ok(vec![]);
            }
        };

        let items = match resp
            .as_array()
            .cloned()
            .or_else(|| {
                resp.get("data")
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
                .get("EventTime")
                .or_else(|| item.get("startTime"))
                .or_else(|| item.get("timestamp"))
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
                .get("TagName")
                .or_else(|| item.get("name"))
                .and_then(|v| v.as_str())
                .unwrap_or("unknown")
                .to_string();

            results.push(SupplementalEvent {
                event_type: "process_alarm".to_string(),
                source_name,
                timestamp,
                severity: item.get("Priority").and_then(|v| v.as_i64()).map(|v| v as i32),
                message: item
                    .get("Message")
                    .or_else(|| item.get("description"))
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                alarm_type: item
                    .get("AlarmType")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                alarm_state: item
                    .get("AlarmState")
                    .or_else(|| item.get("state"))
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                external_id: item
                    .get("EventId")
                    .or_else(|| item.get("id"))
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                limit_value: item.get("LimitValue").and_then(|v| v.as_f64()),
                actual_value: item.get("ActualValue").and_then(|v| v.as_f64()),
            });
        }
        Ok(results)
    }

    fn has_events(&self) -> bool {
        true
    }
}
