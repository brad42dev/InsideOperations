//! SMS delivery via configured provider (Twilio or generic webhook).

use anyhow::{Context, Result};
use serde_json::json;
use sqlx::PgPool;
use sqlx::Row;
use tracing::{info, warn};

pub struct SmsProvider {
    #[allow(dead_code)]
    pub id: String,
    pub provider_type: String,
    pub config: serde_json::Value,
}

/// Load the default enabled SMS provider from DB.
pub async fn load_default_provider(db: &PgPool) -> Result<SmsProvider> {
    let row = sqlx::query(
        "SELECT id::text, provider_type, config FROM sms_providers
         WHERE enabled = true AND is_default = true
         ORDER BY created_at LIMIT 1",
    )
    .fetch_optional(db)
    .await?
    .context("No default SMS provider configured")?;

    Ok(SmsProvider {
        id: row.try_get("id").unwrap_or_default(),
        provider_type: row.try_get("provider_type").unwrap_or_default(),
        config: row.try_get("config").unwrap_or_default(),
    })
}

/// Send an SMS via the configured provider.
pub async fn send_sms(
    http: &reqwest::Client,
    provider: &SmsProvider,
    to: &str,
    message: &str,
) -> Result<()> {
    match provider.provider_type.as_str() {
        "twilio" => send_via_twilio(http, &provider.config, to, message).await,
        "webhook" => send_via_webhook(http, &provider.config, to, message).await,
        _ => Err(anyhow::anyhow!(
            "Unknown SMS provider type: {}",
            provider.provider_type
        )),
    }
}

async fn send_via_twilio(
    http: &reqwest::Client,
    config: &serde_json::Value,
    to: &str,
    message: &str,
) -> Result<()> {
    let account_sid = config["account_sid"]
        .as_str()
        .context("Twilio account_sid not set")?;
    let auth_token = config["auth_token"]
        .as_str()
        .context("Twilio auth_token not set")?;
    let from_number = config["from_number"]
        .as_str()
        .context("Twilio from_number not set")?;

    let url = format!(
        "https://api.twilio.com/2010-04-01/Accounts/{}/Messages.json",
        account_sid
    );

    let response = http
        .post(&url)
        .basic_auth(account_sid, Some(auth_token))
        .form(&[("To", to), ("From", from_number), ("Body", message)])
        .send()
        .await
        .context("Failed to send Twilio request")?;

    let status = response.status();
    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        warn!(status = %status, body = %body, "Twilio SMS delivery failed");
        return Err(anyhow::anyhow!("Twilio API error {}: {}", status, body));
    }

    info!(to = %to, "SMS sent via Twilio");
    Ok(())
}

async fn send_via_webhook(
    http: &reqwest::Client,
    config: &serde_json::Value,
    to: &str,
    message: &str,
) -> Result<()> {
    let url = config["url"]
        .as_str()
        .context("Webhook URL not configured")?;

    let payload = json!({ "to": to, "message": message });

    let mut req = http.post(url).json(&payload);

    // Add custom headers if configured
    if let Some(headers) = config["headers"].as_object() {
        for (key, val) in headers {
            if let Some(v) = val.as_str() {
                req = req.header(key.as_str(), v);
            }
        }
    }

    let response = req.send().await.context("Webhook request failed")?;
    if !response.status().is_success() {
        warn!(status = %response.status(), "SMS webhook delivery failed");
        return Err(anyhow::anyhow!(
            "Webhook returned status {}",
            response.status()
        ));
    }

    info!(to = %to, "SMS sent via webhook");
    Ok(())
}
