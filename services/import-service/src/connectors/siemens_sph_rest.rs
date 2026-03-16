use anyhow::{anyhow, Result};
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use tracing::warn;

use super::{apply_auth, ConnectorConfig, DcsConnector, SupplementalEvent, SupplementalMetadata};

pub struct SiemensSphConnector;

fn base(cfg: &ConnectorConfig) -> Result<String> {
    // Default SPH port 18732 if not specified in base_url
    cfg.base_url
        .clone()
        .ok_or_else(|| anyhow!("siemens_sph_rest: base_url is required"))
}

fn client() -> Result<reqwest::Client> {
    reqwest::Client::builder()
        .build()
        .map_err(|e| anyhow!("reqwest client: {e}"))
}

#[async_trait]
impl DcsConnector for SiemensSphConnector {
    fn connector_type(&self) -> &'static str {
        "siemens_sph_rest"
    }

    async fn test_connection(&self, cfg: &ConnectorConfig) -> Result<()> {
        let base = base(cfg)?;
        let client = client()?;
        if cfg.auth_type == "ntlm" {
            warn!("siemens_sph_rest: NTLM auth not supported in pure Rust; proceeding without auth");
        }
        let req = apply_auth(client.get(format!("{base}/api/v1/status")), cfg);
        let resp = req.send().await?;
        if !resp.status().is_success() {
            return Err(anyhow!("siemens_sph test_connection: HTTP {}", resp.status()));
        }
        Ok(())
    }

    async fn fetch_metadata(&self, cfg: &ConnectorConfig) -> Result<Vec<SupplementalMetadata>> {
        let base = base(cfg)?;
        let client = client()?;

        if cfg.auth_type == "ntlm" {
            warn!("siemens_sph_rest: NTLM auth not supported; metadata may be unavailable");
        }

        let req = apply_auth(client.get(format!("{base}/api/v1/tags")), cfg);
        let resp: serde_json::Value = req.send().await?.json().await?;

        let items = match resp.as_array() {
            Some(a) => a.clone(),
            None => match resp.get("items").and_then(|v| v.as_array()) {
                Some(a) => a.clone(),
                None => return Ok(vec![]),
            },
        };

        let mut results = Vec::new();
        for item in &items {
            let tagname = match item.get("name").and_then(|v| v.as_str()) {
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
            "{base}/api/v1/alarms?startTime={}&endTime={}",
            since.to_rfc3339(),
            now.to_rfc3339()
        );
        let req = apply_auth(client.get(&url), cfg);
        let resp: serde_json::Value = match req.send().await?.json().await {
            Ok(v) => v,
            Err(e) => {
                warn!("siemens_sph_rest: failed to fetch alarms: {e}");
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
                .get("tagName")
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
                    .map(|s| format!("sph:{s}")),
                limit_value: None,
                actual_value: None,
            });
        }
        Ok(results)
    }
}
