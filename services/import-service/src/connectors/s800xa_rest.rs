use anyhow::{anyhow, Result};
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use tracing::warn;

use super::{apply_auth, ConnectorConfig, DcsConnector, SupplementalEvent, SupplementalMetadata};

pub struct AbbImConnector;

const API_PREFIX: &str = "/abb-im-api/v1";
const PAGE_SIZE: u64 = 1000;

fn base(cfg: &ConnectorConfig) -> Result<String> {
    cfg.base_url
        .clone()
        .ok_or_else(|| anyhow!("s800xa_rest: base_url is required"))
}

fn client() -> Result<reqwest::Client> {
    reqwest::Client::builder()
        .build()
        .map_err(|e| anyhow!("reqwest client: {e}"))
}

#[async_trait]
impl DcsConnector for AbbImConnector {
    fn connector_type(&self) -> &'static str {
        "s800xa_rest"
    }

    async fn test_connection(&self, cfg: &ConnectorConfig) -> Result<()> {
        let base = base(cfg)?;
        let client = client()?;
        let url = format!("{base}{API_PREFIX}/tags?$top=1");
        let req = apply_auth(client.get(&url), cfg);
        let resp = req.send().await?;
        if !resp.status().is_success() {
            return Err(anyhow!("s800xa test_connection: HTTP {}", resp.status()));
        }
        Ok(())
    }

    async fn fetch_metadata(&self, cfg: &ConnectorConfig) -> Result<Vec<SupplementalMetadata>> {
        let base = base(cfg)?;
        let client = client()?;
        let mut results = Vec::new();
        let mut skip: u64 = 0;

        loop {
            let url = format!("{base}{API_PREFIX}/tags?$skip={skip}&$top={PAGE_SIZE}");
            let req = apply_auth(client.get(&url), cfg);
            let resp: serde_json::Value = match req.send().await?.json().await {
                Ok(v) => v,
                Err(e) => {
                    warn!("s800xa: failed to fetch tags at skip={skip}: {e}");
                    break;
                }
            };

            let items = match resp
                .get("value")
                .or_else(|| resp.get("items"))
                .and_then(|v| v.as_array())
            {
                Some(a) => a.clone(),
                None => break,
            };

            if items.is_empty() {
                break;
            }

            for item in &items {
                let tagname = match item
                    .get("name")
                    .or_else(|| item.get("tagName"))
                    .and_then(|v| v.as_str())
                {
                    Some(n) => n.to_string(),
                    None => continue,
                };
                results.push(SupplementalMetadata {
                    tagname,
                    description: item
                        .get("description")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string()),
                    engineering_units: item
                        .get("unit")
                        .or_else(|| item.get("engineeringUnits"))
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string()),
                    eu_range_low: None,
                    eu_range_high: None,
                    alarm_limit_hh: None,
                    alarm_limit_h: None,
                    alarm_limit_l: None,
                    alarm_limit_ll: None,
                });
            }

            if items.len() < PAGE_SIZE as usize {
                break;
            }
            skip += PAGE_SIZE;
        }
        Ok(results)
    }

    async fn fetch_events(
        &self,
        cfg: &ConnectorConfig,
        since: DateTime<Utc>,
    ) -> Result<Vec<SupplementalEvent>> {
        let base = base(cfg)?;
        let client = client()?;
        let now = Utc::now();
        let url = format!(
            "{base}{API_PREFIX}/events?startTime={}&endTime={}&category=alarms",
            since.to_rfc3339(),
            now.to_rfc3339()
        );
        let req = apply_auth(client.get(&url), cfg);
        let resp: serde_json::Value = match req.send().await?.json().await {
            Ok(v) => v,
            Err(e) => {
                warn!("s800xa: failed to fetch events: {e}");
                return Ok(vec![]);
            }
        };

        let items = match resp
            .get("value")
            .or_else(|| resp.get("items"))
            .and_then(|v| v.as_array())
        {
            Some(a) => a.clone(),
            None => {
                if let Some(arr) = resp.as_array() {
                    arr.clone()
                } else {
                    return Ok(vec![]);
                }
            }
        };

        let mut results = Vec::new();
        for item in &items {
            let ts_str = match item
                .get("timestamp")
                .or_else(|| item.get("eventTime"))
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
                .or_else(|| item.get("source"))
                .and_then(|v| v.as_str())
                .unwrap_or("unknown")
                .to_string();

            results.push(SupplementalEvent {
                event_type: "process_alarm".to_string(),
                source_name,
                timestamp,
                severity: item
                    .get("severity")
                    .and_then(|v| v.as_i64())
                    .map(|s| s as i32),
                message: item
                    .get("message")
                    .or_else(|| item.get("description"))
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                alarm_type: item
                    .get("alarmType")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                alarm_state: item
                    .get("state")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                external_id: item
                    .get("id")
                    .and_then(|v| v.as_str())
                    .map(|s| format!("abb:{s}")),
                limit_value: None,
                actual_value: None,
            });
        }
        Ok(results)
    }
}
