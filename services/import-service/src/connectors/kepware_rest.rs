use anyhow::{anyhow, Result};
use async_trait::async_trait;
use chrono::{DateTime, Utc};
use tracing::warn;

use super::{ConnectorConfig, DcsConnector, SupplementalEvent, SupplementalMetadata};

pub struct KepwareConnector;

const CONFIG_PORT: u16 = 57412;

fn host(cfg: &ConnectorConfig) -> Result<String> {
    // base_url may be "http://hostname" or just "hostname"; extract host
    let raw = cfg
        .base_url
        .as_deref()
        .ok_or_else(|| anyhow!("kepware_rest: base_url (host) is required"))?;
    // Strip scheme if present
    let host = raw
        .trim_start_matches("http://")
        .trim_start_matches("https://")
        .split(':')
        .next()
        .unwrap_or(raw);
    Ok(host.to_string())
}

fn client(cfg: &ConnectorConfig) -> Result<reqwest::Client> {
    let mut builder = reqwest::Client::builder();
    // Kepware Config API uses self-signed cert by default; only skip validation when explicitly opted in
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
impl DcsConnector for KepwareConnector {
    fn connector_type(&self) -> &'static str {
        "kepware_rest"
    }

    async fn test_connection(&self, cfg: &ConnectorConfig) -> Result<()> {
        let host = host(cfg)?;
        let client = client(cfg)?;
        let url = format!("http://{host}:{CONFIG_PORT}/config/v1/project");
        let req = if let (Some(u), Some(p)) = (cfg.username.as_deref(), cfg.password.as_deref()) {
            client.get(&url).basic_auth(u, Some(p))
        } else {
            client.get(&url)
        };
        let resp = req.send().await?;
        if !resp.status().is_success() {
            return Err(anyhow!("kepware test_connection: HTTP {}", resp.status()));
        }
        Ok(())
    }

    async fn fetch_metadata(&self, cfg: &ConnectorConfig) -> Result<Vec<SupplementalMetadata>> {
        let host = host(cfg)?;
        let client = client(cfg)?;

        // Get channels
        let channels_url = format!("http://{host}:{CONFIG_PORT}/config/v1/project/channels");
        let req = if let (Some(u), Some(p)) = (cfg.username.as_deref(), cfg.password.as_deref()) {
            client.get(&channels_url).basic_auth(u, Some(p))
        } else {
            client.get(&channels_url)
        };
        let channels: serde_json::Value = req.send().await?.json().await?;
        let channel_items = match channels.as_array() {
            Some(a) => a.clone(),
            None => return Ok(vec![]),
        };

        let mut results = Vec::new();
        for channel in &channel_items {
            let ch_name = match channel.get("common.ALLTYPES_NAME").and_then(|v| v.as_str()) {
                Some(n) => n.to_string(),
                None => continue,
            };
            let devices_url =
                format!("http://{host}:{CONFIG_PORT}/config/v1/project/channels/{ch_name}/devices");
            let req = if let (Some(u), Some(p)) = (cfg.username.as_deref(), cfg.password.as_deref())
            {
                client.get(&devices_url).basic_auth(u, Some(p))
            } else {
                client.get(&devices_url)
            };
            let devices: serde_json::Value = match req.send().await?.json().await {
                Ok(v) => v,
                Err(e) => {
                    warn!("kepware: failed to list devices in channel {ch_name}: {e}");
                    continue;
                }
            };
            let device_items = match devices.as_array() {
                Some(a) => a.clone(),
                None => continue,
            };
            for device in &device_items {
                let dev_name = match device.get("common.ALLTYPES_NAME").and_then(|v| v.as_str()) {
                    Some(n) => n.to_string(),
                    None => continue,
                };

                // Fetch device-level tags
                let tags_url = format!(
                    "http://{host}:{CONFIG_PORT}/config/v1/project/channels/{ch_name}/devices/{dev_name}/tags"
                );
                let req = if let (Some(u), Some(p)) =
                    (cfg.username.as_deref(), cfg.password.as_deref())
                {
                    client.get(&tags_url).basic_auth(u, Some(p))
                } else {
                    client.get(&tags_url)
                };
                let tags: serde_json::Value = match req.send().await?.json().await {
                    Ok(v) => v,
                    Err(e) => {
                        warn!("kepware: failed to list tags for {ch_name}/{dev_name}: {e}");
                        continue;
                    }
                };
                let tag_items = match tags.as_array() {
                    Some(a) => a.clone(),
                    None => continue,
                };
                for tag in &tag_items {
                    let tagname = match tag.get("common.ALLTYPES_NAME").and_then(|v| v.as_str()) {
                        Some(n) => format!("{ch_name}.{dev_name}.{n}"),
                        None => continue,
                    };
                    results.push(SupplementalMetadata {
                        tagname,
                        description: tag
                            .get("common.ALLTYPES_DESCRIPTION")
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string()),
                        engineering_units: tag
                            .get("servermain.TAG_EU_UNITS")
                            .and_then(|v| v.as_str())
                            .map(|s| s.to_string()),
                        eu_range_low: tag.get("servermain.TAG_EU_LOW").and_then(|v| v.as_f64()),
                        eu_range_high: tag.get("servermain.TAG_EU_HIGH").and_then(|v| v.as_f64()),
                        alarm_limit_hh: None,
                        alarm_limit_h: None,
                        alarm_limit_l: None,
                        alarm_limit_ll: None,
                    });
                }

                // Walk nested tag groups using an iterative stack to avoid recursive async.
                // Stack entries: (api_path_within_tag_groups, display_prefix)
                // e.g. ("GroupA", "GroupA"), ("GroupA/SubGroup", "GroupA.SubGroup")
                let mut group_stack: Vec<(String, String)> = Vec::new();

                // Seed the stack with root-level tag groups for this device
                let root_groups_url = format!(
                    "http://{host}:{CONFIG_PORT}/config/v1/project/channels/{ch_name}/devices/{dev_name}/tag_groups"
                );
                let req = if let (Some(u), Some(p)) =
                    (cfg.username.as_deref(), cfg.password.as_deref())
                {
                    client.get(&root_groups_url).basic_auth(u, Some(p))
                } else {
                    client.get(&root_groups_url)
                };
                match req.send().await {
                    Ok(resp) if resp.status().is_success() => {
                        match resp.json::<serde_json::Value>().await {
                            Ok(v) => {
                                if let Some(arr) = v.as_array() {
                                    for g in arr {
                                        if let Some(name) =
                                            g.get("common.ALLTYPES_NAME").and_then(|v| v.as_str())
                                        {
                                            group_stack.push((name.to_string(), name.to_string()));
                                        }
                                    }
                                }
                            }
                            Err(e) => {
                                warn!(
                                    "kepware: failed to parse tag_groups for {ch_name}/{dev_name}: {e}"
                                );
                            }
                        }
                    }
                    Ok(_) => {} // 404 or other — device has no tag groups, skip silently
                    Err(e) => {
                        warn!(
                            "kepware: request error listing tag_groups for {ch_name}/{dev_name}: {e}"
                        );
                    }
                }

                while let Some((api_path, name_prefix)) = group_stack.pop() {
                    // Fetch tags within this tag group
                    let group_tags_url = format!(
                        "http://{host}:{CONFIG_PORT}/config/v1/project/channels/{ch_name}/devices/{dev_name}/tag_groups/{api_path}/tags"
                    );
                    let req = if let (Some(u), Some(p)) =
                        (cfg.username.as_deref(), cfg.password.as_deref())
                    {
                        client.get(&group_tags_url).basic_auth(u, Some(p))
                    } else {
                        client.get(&group_tags_url)
                    };
                    match req.send().await {
                        Ok(resp) if resp.status().is_success() => {
                            match resp.json::<serde_json::Value>().await {
                                Ok(v) => {
                                    if let Some(arr) = v.as_array() {
                                        for tag in arr {
                                            let tagname = match tag
                                                .get("common.ALLTYPES_NAME")
                                                .and_then(|v| v.as_str())
                                            {
                                                Some(n) => format!(
                                                    "{ch_name}.{dev_name}.{name_prefix}.{n}"
                                                ),
                                                None => continue,
                                            };
                                            results.push(SupplementalMetadata {
                                                tagname,
                                                description: tag
                                                    .get("common.ALLTYPES_DESCRIPTION")
                                                    .and_then(|v| v.as_str())
                                                    .map(|s| s.to_string()),
                                                engineering_units: tag
                                                    .get("servermain.TAG_EU_UNITS")
                                                    .and_then(|v| v.as_str())
                                                    .map(|s| s.to_string()),
                                                eu_range_low: tag
                                                    .get("servermain.TAG_EU_LOW")
                                                    .and_then(|v| v.as_f64()),
                                                eu_range_high: tag
                                                    .get("servermain.TAG_EU_HIGH")
                                                    .and_then(|v| v.as_f64()),
                                                alarm_limit_hh: None,
                                                alarm_limit_h: None,
                                                alarm_limit_l: None,
                                                alarm_limit_ll: None,
                                            });
                                        }
                                    }
                                }
                                Err(e) => {
                                    warn!(
                                        "kepware: failed to parse tags for group {api_path}: {e}"
                                    );
                                }
                            }
                        }
                        Ok(_) => {} // 404 — group has no tags
                        Err(e) => {
                            warn!("kepware: request error fetching tags for group {api_path}: {e}");
                        }
                    }

                    // Fetch sub-groups and push them onto the stack
                    let sub_groups_url = format!(
                        "http://{host}:{CONFIG_PORT}/config/v1/project/channels/{ch_name}/devices/{dev_name}/tag_groups/{api_path}/tag_groups"
                    );
                    let req = if let (Some(u), Some(p)) =
                        (cfg.username.as_deref(), cfg.password.as_deref())
                    {
                        client.get(&sub_groups_url).basic_auth(u, Some(p))
                    } else {
                        client.get(&sub_groups_url)
                    };
                    match req.send().await {
                        Ok(resp) if resp.status().is_success() => {
                            match resp.json::<serde_json::Value>().await {
                                Ok(v) => {
                                    if let Some(arr) = v.as_array() {
                                        for g in arr {
                                            if let Some(sub_name) = g
                                                .get("common.ALLTYPES_NAME")
                                                .and_then(|v| v.as_str())
                                            {
                                                group_stack.push((
                                                    format!("{api_path}/{sub_name}"),
                                                    format!("{name_prefix}.{sub_name}"),
                                                ));
                                            }
                                        }
                                    }
                                }
                                Err(e) => {
                                    warn!(
                                        "kepware: failed to parse sub-groups for {api_path}: {e}"
                                    );
                                }
                            }
                        }
                        Ok(_) => {} // 404 — group has no sub-groups
                        Err(e) => {
                            warn!("kepware: request error fetching sub-groups for {api_path}: {e}");
                        }
                    }
                }
            }
        }
        Ok(results)
    }

    async fn fetch_events(
        &self,
        _cfg: &ConnectorConfig,
        _since: DateTime<Utc>,
    ) -> Result<Vec<SupplementalEvent>> {
        // Kepware doesn't provide alarm history via REST
        Ok(vec![])
    }

    fn has_events(&self) -> bool {
        false
    }
}
