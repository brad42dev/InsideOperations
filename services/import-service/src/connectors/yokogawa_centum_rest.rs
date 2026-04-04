//! Yokogawa CENTUM VP supplemental DCS connector.
//!
//! REST API via Plant Resource Manager (PRM), available since CENTUM VP R6.09 (2021).
//! Base URL: https://{host}/prm/api/v1
//! Authentication: Basic auth
//!
//! Metadata: GET /tags — returns tagname, description, engineering unit, range
//! Events: GET /alarms?startTime=...&endTime=... — alarm history with type and state
//!
//! Connection config keys: base_url (e.g. "https://centum-host")
//! Auth config keys: username + password (Basic)
//! Optional source_config keys:
//!   page_size — tag page size (default 2000)

use anyhow::{anyhow, Result};
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use tracing::warn;

use super::{apply_auth, ConnectorConfig, DcsConnector, SupplementalEvent, SupplementalMetadata};

pub struct YokogawaCentumConnector;

fn base(cfg: &ConnectorConfig) -> Result<String> {
    cfg.base_url
        .clone()
        .ok_or_else(|| anyhow!("yokogawa_centum_rest: base_url is required"))
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
impl DcsConnector for YokogawaCentumConnector {
    fn connector_type(&self) -> &'static str {
        "yokogawa_centum_rest"
    }

    async fn test_connection(&self, cfg: &ConnectorConfig) -> Result<()> {
        let base = base(cfg)?;
        let client = client(cfg)?;
        let req = apply_auth(client.get(format!("{base}/prm/api/v1/system")), cfg);
        let resp = req.send().await?;
        if !resp.status().is_success() {
            // Try the tags endpoint as a fallback health check
            let req2 = apply_auth(client.get(format!("{base}/prm/api/v1/tags?count=1")), cfg);
            let resp2 = req2.send().await?;
            if !resp2.status().is_success() {
                return Err(anyhow!(
                    "yokogawa_centum test_connection: HTTP {}",
                    resp2.status()
                ));
            }
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
            .unwrap_or(2000);

        let mut results = Vec::new();
        let mut offset = 0u64;

        loop {
            let url = format!("{base}/prm/api/v1/tags?count={page_size}&offset={offset}");
            let req = apply_auth(client.get(&url), cfg);
            let resp: serde_json::Value = match req.send().await?.json().await {
                Ok(v) => v,
                Err(e) => {
                    warn!("yokogawa_centum: failed to parse tags response: {e}");
                    break;
                }
            };

            let items = match resp.as_array().cloned().or_else(|| {
                resp.get("data")
                    .or_else(|| resp.get("items"))
                    .or_else(|| resp.get("tags"))
                    .and_then(|v| v.as_array())
                    .cloned()
            }) {
                Some(a) => a,
                None => break,
            };

            let fetched = items.len();
            for item in &items {
                let tagname = match item
                    .get("tagName")
                    .or_else(|| item.get("tag"))
                    .or_else(|| item.get("name"))
                    .and_then(|v| v.as_str())
                {
                    Some(n) => n.to_string(),
                    None => continue,
                };

                results.push(SupplementalMetadata {
                    tagname,
                    description: item
                        .get("description")
                        .or_else(|| item.get("comment"))
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string()),
                    engineering_units: item
                        .get("engineeringUnit")
                        .or_else(|| item.get("unit"))
                        .or_else(|| item.get("units"))
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string()),
                    eu_range_low: item
                        .get("rangeMin")
                        .or_else(|| item.get("scaleMin"))
                        .and_then(|v| v.as_f64()),
                    eu_range_high: item
                        .get("rangeMax")
                        .or_else(|| item.get("scaleMax"))
                        .and_then(|v| v.as_f64()),
                    alarm_limit_hh: item
                        .get("alarmHH")
                        .or_else(|| item.get("hiHiLimit"))
                        .and_then(|v| v.as_f64()),
                    alarm_limit_h: item
                        .get("alarmH")
                        .or_else(|| item.get("hiLimit"))
                        .and_then(|v| v.as_f64()),
                    alarm_limit_l: item
                        .get("alarmL")
                        .or_else(|| item.get("loLimit"))
                        .and_then(|v| v.as_f64()),
                    alarm_limit_ll: item
                        .get("alarmLL")
                        .or_else(|| item.get("loLoLimit"))
                        .and_then(|v| v.as_f64()),
                });
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
        let start_str = since.to_rfc3339();
        let end_str = Utc::now().to_rfc3339();

        let url = format!("{base}/prm/api/v1/alarms?startTime={start_str}&endTime={end_str}");
        let req = apply_auth(client.get(&url), cfg);
        let resp: serde_json::Value = match req.send().await?.json().await {
            Ok(v) => v,
            Err(e) => {
                warn!("yokogawa_centum: failed to parse alarms response: {e}");
                return Ok(vec![]);
            }
        };

        let items = match resp.as_array().cloned().or_else(|| {
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
                .get("occurrenceTime")
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
                .get("tagName")
                .or_else(|| item.get("tag"))
                .or_else(|| item.get("source"))
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
                    .get("alarmId")
                    .or_else(|| item.get("id"))
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                limit_value: item.get("limitValue").and_then(|v| v.as_f64()),
                actual_value: item
                    .get("processValue")
                    .or_else(|| item.get("actualValue"))
                    .and_then(|v| v.as_f64()),
            });
        }
        Ok(results)
    }
}
