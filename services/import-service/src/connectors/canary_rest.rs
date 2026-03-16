use anyhow::{anyhow, Result};
use async_trait::async_trait;
use chrono::{DateTime, Utc};

use super::{apply_auth, ConnectorConfig, DcsConnector, SupplementalEvent, SupplementalMetadata};

pub struct CanaryConnector;

fn base(cfg: &ConnectorConfig) -> Result<String> {
    cfg.base_url
        .clone()
        .ok_or_else(|| anyhow!("canary_rest: base_url is required"))
}

fn client() -> Result<reqwest::Client> {
    reqwest::Client::builder()
        .build()
        .map_err(|e| anyhow!("reqwest client: {e}"))
}

#[async_trait]
impl DcsConnector for CanaryConnector {
    fn connector_type(&self) -> &'static str {
        "canary_rest"
    }

    async fn test_connection(&self, cfg: &ConnectorConfig) -> Result<()> {
        let base = base(cfg)?;
        let client = client()?;
        let req = apply_auth(client.get(format!("{base}/api/v1/system")), cfg);
        let resp = req.send().await?;
        if !resp.status().is_success() {
            return Err(anyhow!("canary test_connection: HTTP {}", resp.status()));
        }
        Ok(())
    }

    async fn fetch_metadata(&self, cfg: &ConnectorConfig) -> Result<Vec<SupplementalMetadata>> {
        let base = base(cfg)?;
        let client = client()?;
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
            let tagname = match item
                .get("name")
                .or_else(|| item.get("tag"))
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
                    .get("engineeringUnits")
                    .or_else(|| item.get("units"))
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
        _cfg: &ConnectorConfig,
        _since: DateTime<Utc>,
    ) -> Result<Vec<SupplementalEvent>> {
        // Canary is values-only — no alarm history
        Ok(vec![])
    }
}
