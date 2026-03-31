use anyhow::{anyhow, Result};
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use tracing::warn;

use super::{apply_auth, ConnectorConfig, DcsConnector, SupplementalEvent, SupplementalMetadata};

pub struct PiWebApiConnector;

fn base(cfg: &ConnectorConfig) -> Result<String> {
    cfg.base_url
        .clone()
        .ok_or_else(|| anyhow!("pi_web_api: base_url is required"))
}

fn client() -> Result<reqwest::Client> {
    reqwest::Client::builder()
        .build()
        .map_err(|e| anyhow!("reqwest client: {e}"))
}

#[async_trait]
impl DcsConnector for PiWebApiConnector {
    fn connector_type(&self) -> &'static str {
        "pi_web_api"
    }

    async fn test_connection(&self, cfg: &ConnectorConfig) -> Result<()> {
        let base = base(cfg)?;
        let client = client()?;
        let req = client.get(format!("{base}/piwebapi/system"));
        let req = if cfg.auth_type == "kerberos" {
            warn!("pi_web_api: kerberos auth not supported; proceeding without auth");
            req
        } else {
            apply_auth(req, cfg)
        };
        let resp = req
            .header("X-Requested-With", "XMLHttpRequest")
            .send()
            .await?;
        if !resp.status().is_success() {
            return Err(anyhow!(
                "pi_web_api test_connection: HTTP {}",
                resp.status()
            ));
        }
        Ok(())
    }

    async fn fetch_metadata(&self, cfg: &ConnectorConfig) -> Result<Vec<SupplementalMetadata>> {
        let base = base(cfg)?;
        let client = client()?;

        // Get data servers
        let req = client.get(format!("{base}/piwebapi/dataservers"));
        let req = apply_auth(req, cfg);
        let servers: serde_json::Value = req.send().await?.json().await?;
        let items = match servers.get("Items").and_then(|v| v.as_array()) {
            Some(a) => a.clone(),
            None => return Ok(vec![]),
        };

        let mut results = Vec::new();
        for server in &items {
            let server_web_id = match server.get("WebId").and_then(|v| v.as_str()) {
                Some(id) => id.to_string(),
                None => continue,
            };

            let mut url = format!(
                "{base}/piwebapi/dataservers/{server_web_id}/points\
                 ?selectedFields=Items.WebId,Items.Name,Items.Descriptor,\
                 Items.EngineeringUnits,Items.Zero,Items.Span&maxCount=5000"
            );

            loop {
                let req = apply_auth(client.get(&url), cfg);
                let points_resp: serde_json::Value = match req.send().await?.json().await {
                    Ok(v) => v,
                    Err(e) => {
                        warn!("pi_web_api: failed to fetch points for server {server_web_id}: {e}");
                        break;
                    }
                };

                let point_items = points_resp
                    .get("Items")
                    .and_then(|v| v.as_array())
                    .cloned()
                    .unwrap_or_default();

                for p in &point_items {
                    let tagname = match p.get("Name").and_then(|v| v.as_str()) {
                        Some(n) => n.to_string(),
                        None => continue,
                    };
                    results.push(SupplementalMetadata {
                        tagname,
                        description: p
                            .get("Descriptor")
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string()),
                        engineering_units: p
                            .get("EngineeringUnits")
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string()),
                        eu_range_low: p.get("Zero").and_then(|v| v.as_f64()),
                        eu_range_high: p.get("Span").and_then(|v| v.as_f64()),
                        alarm_limit_hh: None,
                        alarm_limit_h: None,
                        alarm_limit_l: None,
                        alarm_limit_ll: None,
                    });
                }

                // Follow pagination via Links.Next
                match points_resp
                    .get("Links")
                    .and_then(|l| l.get("Next"))
                    .and_then(|v| v.as_str())
                {
                    Some(next) => url = next.to_string(),
                    None => break,
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
        let since_str = since.to_rfc3339();

        // Get asset databases
        let req = apply_auth(client.get(format!("{base}/piwebapi/assetdatabases")), cfg);
        let dbs: serde_json::Value = req.send().await?.json().await?;
        let db_items = match dbs.get("Items").and_then(|v| v.as_array()) {
            Some(a) => a.clone(),
            None => return Ok(vec![]),
        };

        let mut results = Vec::new();
        for db in &db_items {
            let db_links = match db
                .get("Links")
                .and_then(|v| v.get("Self"))
                .and_then(|v| v.as_str())
            {
                Some(u) => u.to_string(),
                None => continue,
            };
            let ef_url = format!(
                "{db_links}/eventframes?startTime={since_str}&searchMode=Overlapped\
                 &selectedFields=Items.StartTime,Items.Name,Items.Description"
            );
            let req = apply_auth(client.get(&ef_url), cfg);
            let ef_resp: serde_json::Value = match req.send().await?.json().await {
                Ok(v) => v,
                Err(e) => {
                    warn!("pi_web_api: failed to fetch event frames: {e}");
                    continue;
                }
            };

            if let Some(ef_items) = ef_resp.get("Items").and_then(|v| v.as_array()) {
                for ef in ef_items {
                    let ts_str = match ef.get("StartTime").and_then(|v| v.as_str()) {
                        Some(s) => s,
                        None => continue,
                    };
                    let timestamp = match DateTime::parse_from_rfc3339(ts_str) {
                        Ok(t) => t.with_timezone(&Utc),
                        Err(_) => continue,
                    };
                    let source_name = ef
                        .get("Name")
                        .and_then(|v| v.as_str())
                        .unwrap_or("unknown")
                        .to_string();
                    let message = ef
                        .get("Description")
                        .and_then(|v| v.as_str())
                        .map(|s| s.to_string());

                    results.push(SupplementalEvent {
                        event_type: "process_alarm".to_string(),
                        source_name,
                        timestamp,
                        severity: None,
                        message,
                        alarm_type: None,
                        alarm_state: None,
                        external_id: None,
                        limit_value: None,
                        actual_value: None,
                    });
                }
            }
        }
        Ok(results)
    }
}
