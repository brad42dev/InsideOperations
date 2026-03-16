use anyhow::{anyhow, Result};
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use tracing::warn;

use super::{apply_auth, ConnectorConfig, DcsConnector, SupplementalEvent, SupplementalMetadata};

pub struct WinccOaConnector;

fn base(cfg: &ConnectorConfig) -> Result<String> {
    cfg.base_url
        .clone()
        .ok_or_else(|| anyhow!("wincc_oa_rest: base_url is required"))
}

fn client() -> Result<reqwest::Client> {
    reqwest::Client::builder()
        .build()
        .map_err(|e| anyhow!("reqwest client: {e}"))
}

#[async_trait]
impl DcsConnector for WinccOaConnector {
    fn connector_type(&self) -> &'static str {
        "wincc_oa_rest"
    }

    async fn test_connection(&self, cfg: &ConnectorConfig) -> Result<()> {
        let base = base(cfg)?;
        let client = client()?;
        let req = apply_auth(client.get(format!("{base}/rest/v1/system")), cfg);
        let resp = req.send().await?;
        if !resp.status().is_success() {
            return Err(anyhow!("wincc_oa test_connection: HTTP {}", resp.status()));
        }
        Ok(())
    }

    async fn fetch_metadata(&self, cfg: &ConnectorConfig) -> Result<Vec<SupplementalMetadata>> {
        let base = base(cfg)?;
        let client = client()?;

        let req = apply_auth(client.get(format!("{base}/rest/v1/datapoints")), cfg);
        let resp: serde_json::Value = req.send().await?.json().await?;

        let dp_names: Vec<String> = match resp.as_array() {
            Some(arr) => arr
                .iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect(),
            None => return Ok(vec![]),
        };

        let mut results = Vec::new();
        for dpname in &dp_names {
            let url = format!("{base}/rest/v1/datapoints/{dpname}/config");
            let req = apply_auth(client.get(&url), cfg);
            let dp_cfg: serde_json::Value = match req.send().await?.json().await {
                Ok(v) => v,
                Err(e) => {
                    warn!("wincc_oa: failed to fetch config for {dpname}: {e}");
                    continue;
                }
            };

            results.push(SupplementalMetadata {
                tagname: dpname.clone(),
                description: dp_cfg
                    .get("description")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                engineering_units: dp_cfg
                    .get("unit")
                    .or_else(|| dp_cfg.get("engineering_units"))
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                eu_range_low: dp_cfg.get("rangeMin").and_then(|v| v.as_f64()),
                eu_range_high: dp_cfg.get("rangeMax").and_then(|v| v.as_f64()),
                alarm_limit_hh: None,
                alarm_limit_h: None,
                alarm_limit_l: None,
                alarm_limit_ll: None,
            });
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
            "{base}/rest/v1/alerts/history?startTime={}&endTime={}",
            since.to_rfc3339(),
            now.to_rfc3339()
        );
        let req = apply_auth(client.get(&url), cfg);
        let resp: serde_json::Value = match req.send().await?.json().await {
            Ok(v) => v,
            Err(e) => {
                warn!("wincc_oa: failed to fetch alerts: {e}");
                return Ok(vec![]);
            }
        };

        let items = match resp.as_array() {
            Some(a) => a.clone(),
            None => match resp.get("items").and_then(|v| v.as_array()) {
                Some(a) => a.clone(),
                None => return Ok(vec![]),
            },
        };

        let mut results = Vec::new();
        for item in &items {
            let ts_str = match item
                .get("timestamp")
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
                .get("datapoint")
                .or_else(|| item.get("tag"))
                .and_then(|v| v.as_str())
                .unwrap_or("unknown")
                .to_string();

            results.push(SupplementalEvent {
                event_type: "process_alarm".to_string(),
                source_name,
                timestamp,
                severity: item.get("severity").and_then(|v| v.as_i64()).map(|s| s as i32),
                message: item
                    .get("message")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                alarm_type: None,
                alarm_state: item
                    .get("state")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
                external_id: item
                    .get("id")
                    .and_then(|v| v.as_str())
                    .map(|s| format!("wincc:{s}")),
                limit_value: None,
                actual_value: None,
            });
        }
        Ok(results)
    }
}
