use anyhow::{anyhow, Result};
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use tracing::warn;

use super::{apply_auth, ConnectorConfig, DcsConnector, SupplementalEvent, SupplementalMetadata};

pub struct ExperionConnector;

fn base(cfg: &ConnectorConfig) -> Result<String> {
    cfg.base_url
        .clone()
        .ok_or_else(|| anyhow!("experion_rest: base_url is required"))
}

fn client() -> Result<reqwest::Client> {
    reqwest::Client::builder()
        .build()
        .map_err(|e| anyhow!("reqwest client: {e}"))
}

#[async_trait]
impl DcsConnector for ExperionConnector {
    fn connector_type(&self) -> &'static str {
        "experion_rest"
    }

    async fn test_connection(&self, cfg: &ConnectorConfig) -> Result<()> {
        let base = base(cfg)?;
        let client = client()?;
        // Try points/status first, fall back to system/status
        let req = apply_auth(client.get(format!("{base}/points/status")), cfg);
        let resp = req.send().await?;
        if resp.status().is_success() {
            return Ok(());
        }
        let req = apply_auth(client.get(format!("{base}/system/status")), cfg);
        let resp = req.send().await?;
        if !resp.status().is_success() {
            return Err(anyhow!("experion test_connection: HTTP {}", resp.status()));
        }
        Ok(())
    }

    async fn fetch_metadata(&self, cfg: &ConnectorConfig) -> Result<Vec<SupplementalMetadata>> {
        let base = base(cfg)?;
        let client = client()?;

        // Fetch tag list
        let req = apply_auth(client.get(format!("{base}/points")), cfg);
        let list_resp: serde_json::Value = req.send().await?.json().await?;
        let tags: Vec<String> = match list_resp.as_array() {
            Some(arr) => arr
                .iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect(),
            None => return Ok(vec![]),
        };

        // Note: EPDOC does not have a bulk config endpoint; we fetch per-tag.
        // Limit to 20 concurrent requests to avoid overwhelming the server.
        let mut results = Vec::new();
        for chunk in tags.chunks(20) {
            let mut join_set = tokio::task::JoinSet::new();
            for tag in chunk {
                let tag = tag.clone();
                let url = format!("{base}/points/{tag}/config");
                let client = client.clone();
                let auth_type = cfg.auth_type.clone();
                let username = cfg.username.clone();
                let password = cfg.password.clone();
                let api_key = cfg.api_key.clone();
                let bearer_token = cfg.bearer_token.clone();
                join_set.spawn(async move {
                    // Reconstruct a minimal ConnectorConfig for apply_auth
                    use super::{apply_auth, ConnectorConfig};
                    let mini_cfg = ConnectorConfig {
                        connection_id: uuid::Uuid::nil(),
                        base_url: None,
                        auth_type,
                        username,
                        password,
                        api_key,
                        bearer_token,
                        extra: serde_json::Value::Null,
                    };
                    let req = apply_auth(client.get(&url), &mini_cfg);
                    let result: anyhow::Result<serde_json::Value> = async {
                        let resp = req.send().await?;
                        let v = resp.json().await?;
                        Ok(v)
                    }
                    .await;
                    (tag, result)
                });
            }
            while let Some(res) = join_set.join_next().await {
                match res {
                    Ok((tag, Ok(cfg_resp))) => {
                        results.push(SupplementalMetadata {
                            tagname: tag,
                            description: cfg_resp
                                .get("descriptor")
                                .or_else(|| cfg_resp.get("description"))
                                .and_then(|v| v.as_str())
                                .map(|s| s.to_string()),
                            engineering_units: cfg_resp
                                .get("eu")
                                .or_else(|| cfg_resp.get("engineering_units"))
                                .and_then(|v| v.as_str())
                                .map(|s| s.to_string()),
                            eu_range_low: None,
                            eu_range_high: None,
                            alarm_limit_hh: cfg_resp
                                .get("HIHI")
                                .or_else(|| cfg_resp.get("hihi"))
                                .and_then(|v| v.as_f64()),
                            alarm_limit_h: cfg_resp
                                .get("HI")
                                .or_else(|| cfg_resp.get("hi"))
                                .and_then(|v| v.as_f64()),
                            alarm_limit_l: cfg_resp
                                .get("LO")
                                .or_else(|| cfg_resp.get("lo"))
                                .and_then(|v| v.as_f64()),
                            alarm_limit_ll: cfg_resp
                                .get("LOLO")
                                .or_else(|| cfg_resp.get("lolo"))
                                .and_then(|v| v.as_f64()),
                        });
                    }
                    Ok((tag, Err(e))) => {
                        warn!("experion: failed to fetch config for {tag}: {e}");
                    }
                    Err(e) => {
                        warn!("experion: task join error: {e}");
                    }
                }
            }
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
            "{base}/alarms/history?startTime={}&endTime={}",
            since.to_rfc3339(),
            now.to_rfc3339()
        );
        let req = apply_auth(client.get(&url), cfg);
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
            let ts_str = match item
                .get("activationTime")
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
                .get("tag")
                .or_else(|| item.get("tagname"))
                .and_then(|v| v.as_str())
                .unwrap_or("unknown")
                .to_string();
            let message = item
                .get("message")
                .or_else(|| item.get("description"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            let severity = item
                .get("priority")
                .and_then(|v| v.as_i64())
                .map(|p| p as i32);
            let alarm_state = item
                .get("state")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());

            results.push(SupplementalEvent {
                event_type: "process_alarm".to_string(),
                source_name,
                timestamp,
                severity,
                message,
                alarm_type: None,
                alarm_state,
                external_id: item
                    .get("id")
                    .and_then(|v| v.as_str())
                    .map(|s| format!("experion:{s}")),
                limit_value: None,
                actual_value: None,
            });
        }
        Ok(results)
    }
}
