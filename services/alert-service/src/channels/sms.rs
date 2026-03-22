//! SMS channel adapter — delivers alert notifications via the Twilio Messages API.
//!
//! Authentication uses HTTP Basic auth with `{account_sid}:{auth_token}`.
//! Message body is rendered via a MiniJinja template if configured; otherwise
//! a sensible default template is used.
//!
//! Messages longer than `max_length` characters (default 160) are truncated
//! with a `...` suffix to fit a single SMS segment.

use async_trait::async_trait;
use minijinja::Environment;
use serde::{Deserialize, Serialize};
use tracing::{error, info, warn};

use super::{AlertChannel, AlertSummary, ChannelError, ChannelRecipient, ChannelType, DeliveryResult};

const DEFAULT_MAX_LENGTH: usize = 160;
const DEFAULT_BODY_TEMPLATE: &str =
    "[{{ severity | upper }}] {{ title }}{% if message %}: {{ message }}{% endif %}";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

/// Deserialised from `alert_channels.config` JSONB for the `sms` channel type.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SmsConfig {
    /// Twilio Account SID.
    pub account_sid: String,
    /// Twilio Auth Token (stored encrypted at rest; decrypted by caller).
    pub auth_token: String,
    /// Twilio sender phone number in E.164 format (e.g. "+15005550006").
    pub from_number: String,
    /// MiniJinja template for the SMS body. Available variables:
    /// `severity`, `title`, `message` (may be empty string).
    #[serde(default = "default_body_template")]
    pub body_template: String,
    /// Maximum SMS length in characters before truncation.
    #[serde(default = "default_max_length")]
    pub max_length: usize,
    /// Optional fallback Twilio account for failover.
    pub fallback_account_sid: Option<String>,
    pub fallback_auth_token: Option<String>,
    pub fallback_from_number: Option<String>,
}

fn default_body_template() -> String {
    DEFAULT_BODY_TEMPLATE.to_string()
}

fn default_max_length() -> usize {
    DEFAULT_MAX_LENGTH
}

// ---------------------------------------------------------------------------
// Adapter
// ---------------------------------------------------------------------------

pub struct SmsAdapter {
    config: SmsConfig,
    http: reqwest::Client,
}

impl SmsAdapter {
    pub fn new(config: SmsConfig, http: reqwest::Client) -> Self {
        SmsAdapter { config, http }
    }

    /// Render the body template and truncate to max_length.
    fn render_body(&self, alert: &AlertSummary) -> String {
        let env = Environment::new();
        let template_str = self.config.body_template.clone();
        let body = match env.render_str(
            &template_str,
            minijinja::context! {
                severity => &alert.severity,
                title => &alert.title,
                message => alert.message.as_deref().unwrap_or(""),
            },
        ) {
            Ok(s) => s,
            Err(e) => {
                warn!(error = %e, "sms: template render failed, using fallback");
                format!("[{}] {}", alert.severity.to_uppercase(), alert.title)
            }
        };

        truncate_sms(&body, self.config.max_length)
    }

    /// Deliver via a specific Twilio account credential set.
    async fn send_via_twilio(
        &self,
        account_sid: &str,
        auth_token: &str,
        from_number: &str,
        to_number: &str,
        body: &str,
    ) -> Result<String, String> {
        let url = format!(
            "https://api.twilio.com/2010-04-01/Accounts/{}/Messages.json",
            account_sid
        );

        let params = [("From", from_number), ("To", to_number), ("Body", body)];

        let resp = self
            .http
            .post(&url)
            .basic_auth(account_sid, Some(auth_token))
            .form(&params)
            .send()
            .await
            .map_err(|e| e.to_string())?;

        let status = resp.status();
        let resp_body = resp.text().await.unwrap_or_default();

        if status.is_success() {
            // Extract the SID from the JSON response.
            let sid = serde_json::from_str::<serde_json::Value>(&resp_body)
                .ok()
                .and_then(|v| v.get("sid").and_then(|s| s.as_str()).map(|s| s.to_string()))
                .unwrap_or_else(|| "unknown".to_string());
            Ok(sid)
        } else {
            Err(format!("Twilio HTTP {}: {}", status, resp_body))
        }
    }
}

#[async_trait]
impl AlertChannel for SmsAdapter {
    fn channel_type(&self) -> ChannelType {
        ChannelType::Sms
    }

    fn display_name(&self) -> &str {
        "SMS (Twilio)"
    }

    async fn deliver(
        &self,
        alert: &AlertSummary,
        recipients: &[ChannelRecipient],
    ) -> Vec<DeliveryResult> {
        let body = self.render_body(alert);
        let mut results = Vec::with_capacity(recipients.len());

        for recipient in recipients {
            let phone = match &recipient.phone {
                Some(p) if !p.is_empty() => p.clone(),
                _ => {
                    warn!(
                        user_id = ?recipient.user_id,
                        "sms: recipient has no phone number, skipping"
                    );
                    results.push(DeliveryResult::skipped("no phone number"));
                    continue;
                }
            };

            // Try primary Twilio account.
            match self
                .send_via_twilio(
                    &self.config.account_sid,
                    &self.config.auth_token,
                    &self.config.from_number,
                    &phone,
                    &body,
                )
                .await
            {
                Ok(sid) => {
                    info!(
                        alert_id = %alert.id,
                        to = %phone,
                        sid = %sid,
                        "sms: sent"
                    );
                    results.push(DeliveryResult::sent(
                        recipient.user_id,
                        Some(phone),
                        Some(sid),
                    ));
                }
                Err(primary_err) => {
                    // Try fallback if configured.
                    let fallback_result = if let (
                        Some(fb_sid),
                        Some(fb_token),
                        Some(fb_from),
                    ) = (
                        &self.config.fallback_account_sid,
                        &self.config.fallback_auth_token,
                        &self.config.fallback_from_number,
                    ) {
                        warn!(
                            alert_id = %alert.id,
                            to = %phone,
                            error = %primary_err,
                            "sms: primary failed, trying fallback"
                        );
                        self.send_via_twilio(fb_sid, fb_token, fb_from, &phone, &body)
                            .await
                            .ok()
                    } else {
                        None
                    };

                    match fallback_result {
                        Some(sid) => {
                            info!(
                                alert_id = %alert.id,
                                to = %phone,
                                sid = %sid,
                                "sms: sent via fallback"
                            );
                            results.push(DeliveryResult::sent(
                                recipient.user_id,
                                Some(phone),
                                Some(sid),
                            ));
                        }
                        None => {
                            error!(
                                alert_id = %alert.id,
                                to = %phone,
                                error = %primary_err,
                                "sms: delivery failed"
                            );
                            results.push(DeliveryResult::failed(
                                recipient.user_id,
                                Some(phone),
                                primary_err,
                            ));
                        }
                    }
                }
            }
        }

        results
    }

    async fn health_check(&self) -> Result<(), ChannelError> {
        // Validate the account SID format (starts with "AC").
        if !self.config.account_sid.starts_with("AC") {
            return Err(ChannelError::Config(
                "account_sid must start with 'AC'".into(),
            ));
        }
        if self.config.auth_token.is_empty() {
            return Err(ChannelError::Config("auth_token is required".into()));
        }
        if self.config.from_number.is_empty() {
            return Err(ChannelError::Config("from_number is required".into()));
        }
        // Verify credentials by fetching the account resource (read-only, cheap call).
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
                "Twilio auth failed: HTTP {}",
                resp.status()
            )))
        }
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Truncate `s` to at most `max_len` Unicode characters, appending `...` if
/// truncation is necessary.
fn truncate_sms(s: &str, max_len: usize) -> String {
    let char_count = s.chars().count();
    if char_count <= max_len {
        return s.to_string();
    }
    // Reserve 3 chars for "..."
    let keep = max_len.saturating_sub(3);
    let truncated: String = s.chars().take(keep).collect();
    format!("{}...", truncated)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn truncate_short_message() {
        let msg = "hello";
        assert_eq!(truncate_sms(msg, 160), "hello");
    }

    #[test]
    fn truncate_exact_length() {
        let msg = "a".repeat(160);
        assert_eq!(truncate_sms(&msg, 160).chars().count(), 160);
    }

    #[test]
    fn truncate_long_message() {
        let msg = "a".repeat(200);
        let result = truncate_sms(&msg, 160);
        assert_eq!(result.chars().count(), 160);
        assert!(result.ends_with("..."));
    }

    #[test]
    fn truncate_to_short_limit() {
        let msg = "abcdefgh";
        let result = truncate_sms(msg, 5);
        assert_eq!(result.chars().count(), 5);
        assert!(result.ends_with("..."));
    }
}
