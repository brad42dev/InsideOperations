//! Voice call channel adapter — delivers alert notifications via the Twilio Calls API.
//!
//! When a call is placed, Twilio executes a TwiML URL to determine what to say.
//! The call SID returned by Twilio is stored as `external_id` in the delivery record
//! so operators can look up call status from the Twilio console.
//!
//! TwiML is generated on-the-fly by our Twilio webhook handler (`/webhooks/twilio/voice`)
//! and can prompt the callee to press a key to acknowledge the alert.

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use tracing::{error, info, warn};

use super::{AlertChannel, AlertSummary, ChannelError, ChannelRecipient, ChannelType, DeliveryResult};

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/// Deserialised from `alert_channels.config` JSONB for the `voice` channel type.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoiceConfig {
    /// Twilio Account SID.
    pub account_sid: String,
    /// Twilio Auth Token (stored encrypted at rest; decrypted by caller).
    pub auth_token: String,
    /// Twilio caller phone number in E.164 format.
    pub from_number: String,
    /// Publicly reachable URL for the TwiML webhook. Twilio will GET/POST this URL
    /// when the call is answered.  Example: "https://example.com/api/webhooks/twilio/voice".
    pub twiml_url: String,
    /// Optional status callback URL for Twilio to report call completion.
    pub status_callback_url: Option<String>,
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

pub struct VoiceAdapter {
    config: VoiceConfig,
    http: reqwest::Client,
}

impl VoiceAdapter {
    pub fn new(config: VoiceConfig, http: reqwest::Client) -> Self {
        VoiceAdapter { config, http }
    }
}

#[async_trait]
impl AlertChannel for VoiceAdapter {
    fn channel_type(&self) -> ChannelType {
        ChannelType::Voice
    }

    fn display_name(&self) -> &str {
        "Voice Call (Twilio)"
    }

    async fn deliver(
        &self,
        alert: &AlertSummary,
        recipients: &[ChannelRecipient],
    ) -> Vec<DeliveryResult> {
        let mut results = Vec::with_capacity(recipients.len());

        // Build a TwiML URL that includes the alert ID so the voice webhook can
        // look up the alert title/message and render appropriate TwiML.
        let twiml_url = format!("{}?alert_id={}", self.config.twiml_url, alert.id);

        for recipient in recipients {
            let phone = match &recipient.phone {
                Some(p) if !p.is_empty() => p.clone(),
                _ => {
                    warn!(
                        user_id = ?recipient.user_id,
                        "voice: recipient has no phone number, skipping"
                    );
                    results.push(DeliveryResult::skipped("no phone number"));
                    continue;
                }
            };

            let url = format!(
                "https://api.twilio.com/2010-04-01/Accounts/{}/Calls.json",
                self.config.account_sid
            );

            let mut params = vec![
                ("From", self.config.from_number.as_str()),
                ("To", phone.as_str()),
                ("Url", twiml_url.as_str()),
            ];

            let status_cb_str;
            if let Some(ref cb) = self.config.status_callback_url {
                status_cb_str = cb.clone();
                params.push(("StatusCallback", status_cb_str.as_str()));
                params.push(("StatusCallbackMethod", "POST"));
            }

            let resp = self
                .http
                .post(&url)
                .basic_auth(&self.config.account_sid, Some(&self.config.auth_token))
                .form(&params)
                .send()
                .await;

            match resp {
                Ok(r) if r.status().is_success() => {
                    let body_text = r.text().await.unwrap_or_default();
                    let call_sid = serde_json::from_str::<serde_json::Value>(&body_text)
                        .ok()
                        .and_then(|v| v.get("sid").and_then(|s| s.as_str()).map(|s| s.to_string()))
                        .unwrap_or_else(|| "unknown".to_string());

                    info!(
                        alert_id = %alert.id,
                        to = %phone,
                        call_sid = %call_sid,
                        "voice: call placed"
                    );
                    results.push(DeliveryResult::sent(
                        recipient.user_id,
                        Some(phone),
                        Some(call_sid),
                    ));
                }
                Ok(r) => {
                    let status = r.status();
                    let body_text = r.text().await.unwrap_or_default();
                    let msg = format!("Twilio Calls API HTTP {}: {}", status, body_text);
                    error!(alert_id = %alert.id, to = %phone, error = %msg, "voice: call failed");
                    results.push(DeliveryResult::failed(recipient.user_id, Some(phone), msg));
                }
                Err(e) => {
                    let msg = e.to_string();
                    error!(alert_id = %alert.id, to = %phone, error = %msg, "voice: request error");
                    results.push(DeliveryResult::failed(recipient.user_id, Some(phone), msg));
                }
            }
        }

        results
    }

    async fn health_check(&self) -> Result<(), ChannelError> {
        if !self.config.account_sid.starts_with("AC") {
            return Err(ChannelError::Config(
                "account_sid must start with 'AC'".into(),
            ));
        }
        if self.config.auth_token.is_empty() {
            return Err(ChannelError::Config("auth_token is required".into()));
        }
        if self.config.twiml_url.is_empty() {
            return Err(ChannelError::Config("twiml_url is required".into()));
        }
        // Verify credentials by fetching the account resource.
        let url = format!(
            "https://api.twilio.com/2010-04-01/Accounts/{}.json",
            self.config.account_sid
        );
        let resp = self
            .http
            .get(&url)
            .basic_auth(&self.config.account_sid, Some(&self.config.auth_token))
            .send()
            .await?;
        if resp.status().is_success() {
            Ok(())
        } else {
            Err(ChannelError::Other(format!(
                "Twilio auth check failed: HTTP {}",
                resp.status()
            )))
        }
    }
}
