//! PA (Public Address) system channel adapter.
//!
//! Supports three operating modes, selectable via `PaConfig::mode`:
//!
//! - `rest`  — real HTTP POST to a configured PA controller REST API
//! - `sip`   — stub: logs the intent and records delivery as "sent" (async SIP
//!   integration is out-of-scope for this release; the stub keeps the
//!   delivery pipeline working without blocking)
//! - `relay` — stub: same as sip; a relay (dry-contact or Modbus coil) trigger
//!   will be wired in a future task
//!
//! SIP and relay modes are intentionally stubbed — they must not block the async
//! executor and must not use `reqwest::blocking`.

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use tracing::{error, info, warn};

use super::{AlertChannel, AlertSummary, ChannelError, ChannelRecipient, ChannelType, DeliveryResult};

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum PaMode {
    #[default]
    Rest,
    Sip,
    Relay,
}

/// Deserialised from `alert_channels.config` JSONB for the `pa` channel type.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaConfig {
    /// PA mode: `rest`, `sip`, or `relay`.
    #[serde(default)]
    pub mode: PaMode,

    // ── REST fields ─────────────────────────────────────────────────────────
    /// REST: full URL to the PA controller API (e.g. "http://10.1.1.5/api/announce").
    pub rest_url: Option<String>,
    /// REST: optional Bearer token.
    pub rest_bearer_token: Option<String>,
    /// REST: optional Basic auth username.
    pub rest_basic_username: Option<String>,
    /// REST: optional Basic auth password (stored encrypted).
    pub rest_basic_password: Option<String>,
    /// REST: default PA zone to announce to (used when recipient has no `pa_zone`).
    pub default_zone: Option<String>,

    // ── SIP fields (for future implementation) ──────────────────────────────
    /// SIP: URI of the PA SIP endpoint (stub only; not implemented in this release).
    pub sip_uri: Option<String>,

    // ── Relay fields (for future implementation) ────────────────────────────
    /// Relay: host of the relay controller (stub only; not implemented in this release).
    pub relay_host: Option<String>,
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

pub struct PaAdapter {
    config: PaConfig,
    http: reqwest::Client,
}

impl PaAdapter {
    pub fn new(config: PaConfig, http: reqwest::Client) -> Self {
        PaAdapter { config, http }
    }

    async fn deliver_rest(
        &self,
        alert: &AlertSummary,
        zone: &str,
        user_id: Option<uuid::Uuid>,
    ) -> DeliveryResult {
        let url = match &self.config.rest_url {
            Some(u) if !u.is_empty() => u.clone(),
            _ => {
                warn!(alert_id = %alert.id, "pa/rest: rest_url not configured");
                return DeliveryResult::failed(user_id, Some(zone.to_string()), "rest_url not configured");
            }
        };

        let payload = serde_json::json!({
            "alert_id": alert.id,
            "severity": alert.severity,
            "title": alert.title,
            "message": alert.message.as_deref().unwrap_or(""),
            "zone": zone,
        });

        let mut req = self.http.post(&url).json(&payload);

        if let Some(token) = &self.config.rest_bearer_token {
            req = req.bearer_auth(token);
        } else if let Some(user) = &self.config.rest_basic_username {
            req = req.basic_auth(user, self.config.rest_basic_password.as_deref());
        }

        match req.send().await {
            Ok(resp) if resp.status().is_success() => {
                info!(
                    alert_id = %alert.id,
                    zone = %zone,
                    "pa/rest: announced"
                );
                DeliveryResult::sent(user_id, Some(zone.to_string()), None)
            }
            Ok(resp) => {
                let status = resp.status();
                let body = resp.text().await.unwrap_or_default();
                let msg = format!("PA REST API HTTP {}: {}", status, body);
                error!(alert_id = %alert.id, zone = %zone, error = %msg, "pa/rest: failed");
                DeliveryResult::failed(user_id, Some(zone.to_string()), msg)
            }
            Err(e) => {
                let msg = e.to_string();
                error!(alert_id = %alert.id, zone = %zone, error = %msg, "pa/rest: request error");
                DeliveryResult::failed(user_id, Some(zone.to_string()), msg)
            }
        }
    }

    fn deliver_sip_stub(&self, alert: &AlertSummary, zone: &str, user_id: Option<uuid::Uuid>) -> DeliveryResult {
        // SIP mode is stubbed: log the intent and record as "sent".
        // A full async SIP implementation will replace this in a future task.
        info!(
            alert_id = %alert.id,
            zone = %zone,
            sip_uri = ?self.config.sip_uri,
            "pa/sip: [STUB] would initiate SIP call to PA system"
        );
        DeliveryResult::sent(user_id, Some(zone.to_string()), None)
    }

    fn deliver_relay_stub(&self, alert: &AlertSummary, zone: &str, user_id: Option<uuid::Uuid>) -> DeliveryResult {
        // Relay mode is stubbed: log the intent and record as "sent".
        // Modbus/dry-contact relay wiring will replace this in a future task.
        info!(
            alert_id = %alert.id,
            zone = %zone,
            relay_host = ?self.config.relay_host,
            "pa/relay: [STUB] would trigger relay for PA system"
        );
        DeliveryResult::sent(user_id, Some(zone.to_string()), None)
    }
}

#[async_trait]
impl AlertChannel for PaAdapter {
    fn channel_type(&self) -> ChannelType {
        ChannelType::Pa
    }

    fn display_name(&self) -> &str {
        "PA System"
    }

    async fn deliver(
        &self,
        alert: &AlertSummary,
        recipients: &[ChannelRecipient],
    ) -> Vec<DeliveryResult> {
        let mut results = Vec::new();

        // If no recipients, broadcast to the default zone.
        let effective_recipients: Vec<(Option<uuid::Uuid>, String)> = if recipients.is_empty() {
            match &self.config.default_zone {
                Some(z) if !z.is_empty() => vec![(None, z.clone())],
                _ => {
                    warn!(alert_id = %alert.id, "pa: no recipients and no default_zone configured");
                    results.push(DeliveryResult::skipped("no PA zone configured"));
                    return results;
                }
            }
        } else {
            recipients
                .iter()
                .filter_map(|r| {
                    let zone = r.pa_zone.as_deref()
                        .filter(|z| !z.is_empty())
                        .or(self.config.default_zone.as_deref())
                        .map(|z| z.to_string());
                    zone.map(|z| (r.user_id, z))
                })
                .collect()
        };

        if effective_recipients.is_empty() {
            warn!(alert_id = %alert.id, "pa: no zones resolved for any recipient");
            results.push(DeliveryResult::skipped("no PA zones resolved"));
            return results;
        }

        // Deduplicate zones — PA typically broadcasts to a zone, not per-user.
        let mut seen_zones = std::collections::HashSet::new();
        for (user_id, zone) in &effective_recipients {
            if !seen_zones.insert(zone.clone()) {
                continue; // already dispatched to this zone
            }
            let result = match self.config.mode {
                PaMode::Rest => self.deliver_rest(alert, zone, *user_id).await,
                PaMode::Sip => self.deliver_sip_stub(alert, zone, *user_id),
                PaMode::Relay => self.deliver_relay_stub(alert, zone, *user_id),
            };
            results.push(result);
        }

        results
    }

    async fn health_check(&self) -> Result<(), ChannelError> {
        match self.config.mode {
            PaMode::Rest => {
                let url = self.config.rest_url.as_deref().unwrap_or("");
                if url.is_empty() {
                    return Err(ChannelError::Config(
                        "rest_url is required in REST mode".into(),
                    ));
                }
            }
            PaMode::Sip => {
                if self.config.sip_uri.as_deref().unwrap_or("").is_empty() {
                    return Err(ChannelError::Config(
                        "sip_uri is required in SIP mode".into(),
                    ));
                }
            }
            PaMode::Relay => {
                if self.config.relay_host.as_deref().unwrap_or("").is_empty() {
                    return Err(ChannelError::Config(
                        "relay_host is required in relay mode".into(),
                    ));
                }
            }
        }
        Ok(())
    }
}
