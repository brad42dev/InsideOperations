//! Radio dispatch channel adapter — delivers alert notifications via a generic HTTP
//! dispatch endpoint (e.g., a radio gateway or dispatch console REST API).
//!
//! The adapter sends a JSON POST to a configured `dispatch_url`. Authentication
//! is configurable: None, Bearer token, or Basic auth. The talkgroup for each
//! recipient is resolved from the recipient's `talkgroup` field (populated by the
//! channel_config or roster logic).

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use tracing::{error, info, warn};

use super::{
    AlertChannel, AlertSummary, ChannelError, ChannelRecipient, ChannelType, DeliveryResult,
};

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum RadioAuthMode {
    #[default]
    None,
    Bearer,
    Basic,
}

/// Deserialised from `alert_channels.config` JSONB for the `radio` channel type.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RadioConfig {
    /// Full URL to the radio dispatch HTTP endpoint.
    pub dispatch_url: String,
    /// Authentication mode for the dispatch endpoint.
    #[serde(default)]
    pub auth_mode: RadioAuthMode,
    /// Bearer token — used when `auth_mode` is `bearer`.
    pub bearer_token: Option<String>,
    /// Basic auth username — used when `auth_mode` is `basic`.
    pub basic_username: Option<String>,
    /// Basic auth password (stored encrypted) — used when `auth_mode` is `basic`.
    pub basic_password: Option<String>,
    /// Default talkgroup ID to use when the recipient has no talkgroup.
    pub default_talkgroup: Option<String>,
    /// Additional JSON fields to merge into the dispatch payload (e.g., system_id).
    pub extra_fields: Option<serde_json::Value>,
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

pub struct RadioAdapter {
    config: RadioConfig,
    http: reqwest::Client,
}

impl RadioAdapter {
    pub fn new(config: RadioConfig, http: reqwest::Client) -> Self {
        RadioAdapter { config, http }
    }

    fn build_payload(&self, alert: &AlertSummary, talkgroup: &str) -> serde_json::Value {
        let mut payload = serde_json::json!({
            "alert_id": alert.id,
            "severity": alert.severity,
            "title": alert.title,
            "message": alert.message.as_deref().unwrap_or(""),
            "talkgroup": talkgroup,
        });

        // Merge any extra fields from config (non-destructive).
        if let Some(ref extra) = self.config.extra_fields {
            if let (Some(obj), Some(extra_obj)) = (payload.as_object_mut(), extra.as_object()) {
                for (k, v) in extra_obj {
                    obj.entry(k).or_insert(v.clone());
                }
            }
        }

        payload
    }
}

#[async_trait]
impl AlertChannel for RadioAdapter {
    fn channel_type(&self) -> ChannelType {
        ChannelType::Radio
    }

    fn display_name(&self) -> &str {
        "Radio Dispatch"
    }

    async fn deliver(
        &self,
        alert: &AlertSummary,
        recipients: &[ChannelRecipient],
    ) -> Vec<DeliveryResult> {
        let mut results = Vec::with_capacity(recipients.len());

        // If no recipients provided, dispatch to the default talkgroup (broadcast mode).
        if recipients.is_empty() {
            let talkgroup = match &self.config.default_talkgroup {
                Some(tg) => tg.clone(),
                None => {
                    warn!(alert_id = %alert.id, "radio: no recipients and no default_talkgroup configured");
                    results.push(DeliveryResult::skipped("no talkgroup configured"));
                    return results;
                }
            };
            let result = self.dispatch_to_talkgroup(alert, &talkgroup, None).await;
            results.push(result);
            return results;
        }

        for recipient in recipients {
            let talkgroup = recipient
                .talkgroup
                .as_deref()
                .filter(|tg| !tg.is_empty())
                .or(self.config.default_talkgroup.as_deref())
                .map(|s| s.to_string());

            match talkgroup {
                Some(tg) => {
                    let result = self
                        .dispatch_to_talkgroup(alert, &tg, recipient.user_id)
                        .await;
                    results.push(result);
                }
                None => {
                    warn!(
                        user_id = ?recipient.user_id,
                        "radio: no talkgroup for recipient and no default configured, skipping"
                    );
                    results.push(DeliveryResult::skipped("no talkgroup"));
                }
            }
        }

        results
    }

    async fn health_check(&self) -> Result<(), ChannelError> {
        if self.config.dispatch_url.is_empty() {
            return Err(ChannelError::Config("dispatch_url is required".into()));
        }
        // Validate auth config consistency.
        match self.config.auth_mode {
            RadioAuthMode::Bearer => {
                if self.config.bearer_token.as_deref().unwrap_or("").is_empty() {
                    return Err(ChannelError::Config(
                        "bearer_token required when auth_mode is bearer".into(),
                    ));
                }
            }
            RadioAuthMode::Basic => {
                if self
                    .config
                    .basic_username
                    .as_deref()
                    .unwrap_or("")
                    .is_empty()
                {
                    return Err(ChannelError::Config(
                        "basic_username required when auth_mode is basic".into(),
                    ));
                }
            }
            RadioAuthMode::None => {}
        }
        Ok(())
    }
}

impl RadioAdapter {
    async fn dispatch_to_talkgroup(
        &self,
        alert: &AlertSummary,
        talkgroup: &str,
        user_id: Option<uuid::Uuid>,
    ) -> DeliveryResult {
        let payload = self.build_payload(alert, talkgroup);

        let mut req = self.http.post(&self.config.dispatch_url).json(&payload);

        req = match &self.config.auth_mode {
            RadioAuthMode::Bearer => {
                let token = self.config.bearer_token.as_deref().unwrap_or("");
                req.bearer_auth(token)
            }
            RadioAuthMode::Basic => {
                let user = self.config.basic_username.as_deref().unwrap_or("");
                let pass = self.config.basic_password.as_deref();
                req.basic_auth(user, pass)
            }
            RadioAuthMode::None => req,
        };

        match req.send().await {
            Ok(resp) if resp.status().is_success() => {
                info!(
                    alert_id = %alert.id,
                    talkgroup = %talkgroup,
                    "radio: dispatched"
                );
                DeliveryResult::sent(user_id, Some(talkgroup.to_string()), None)
            }
            Ok(resp) => {
                let status = resp.status();
                let body = resp.text().await.unwrap_or_default();
                let msg = format!("dispatch endpoint HTTP {}: {}", status, body);
                error!(alert_id = %alert.id, talkgroup = %talkgroup, error = %msg, "radio: dispatch failed");
                DeliveryResult::failed(user_id, Some(talkgroup.to_string()), msg)
            }
            Err(e) => {
                let msg = e.to_string();
                error!(alert_id = %alert.id, talkgroup = %talkgroup, error = %msg, "radio: request error");
                DeliveryResult::failed(user_id, Some(talkgroup.to_string()), msg)
            }
        }
    }
}
