//! Alert channel configuration API handlers.
//!
//! Routes:
//!   GET  /alerts/channels           — list all channels with enabled status
//!   PUT  /alerts/channels/:type     — update channel configuration (re-encrypts secrets)
//!   PUT  /alerts/channels/:type/enabled — enable or disable a channel
//!   POST /alerts/channels/:type/test    — send a test delivery to the authenticated user
//!
//! Channel configuration secrets (Twilio auth tokens, VAPID private keys) are
//! stored encrypted in `alert_channels.config` JSONB using AES-GCM with the
//! master key loaded from `ALERT_MASTER_KEY` environment variable (32 bytes,
//! hex-encoded). At runtime the config is decrypted before constructing the
//! adapter.
//!
//! The `list_channels` handler masks all fields named `*_token`, `*_password`,
//! `*_key`, `auth_token` before returning the JSON to the client.

use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    Json,
};
use chrono::{DateTime, Utc};
use io_error::IoError;
use io_models::ApiResponse;
use serde::{Deserialize, Serialize};
use tracing::{error, info, warn};
use uuid::Uuid;

use crate::{
    channels::{
        browser_push::BrowserPushAdapter,
        pa::PaAdapter,
        radio::RadioAdapter,
        sms::SmsAdapter,
        voice::VoiceAdapter,
        AlertChannel, AlertSummary, ChannelRecipient,
    },
    state::AppState,
};

// ---------------------------------------------------------------------------
// Error helper
// ---------------------------------------------------------------------------

/// Build a standard error response JSON body matching the project error envelope.
fn err_response(status: StatusCode, message: &str) -> axum::response::Response {
    (
        status,
        Json(serde_json::json!({
            "success": false,
            "error": {
                "code": status.as_u16().to_string(),
                "message": message
            }
        })),
    )
        .into_response()
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct AlertChannel_ {
    pub channel_type: String,
    pub display_name: String,
    pub enabled: bool,
    pub config: Option<serde_json::Value>,
    pub last_tested_at: Option<DateTime<Utc>>,
    pub last_test_ok: Option<bool>,
    pub last_test_error: Option<String>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateChannelBody {
    /// Merged into the existing config JSONB. Secret fields will be re-encrypted.
    pub config: serde_json::Value,
    pub display_name: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct EnableChannelBody {
    pub enabled: bool,
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/// GET /alerts/channels — list all channels with enabled status.
/// Secret fields are masked in the response.
pub async fn list_channels(State(state): State<AppState>) -> impl IntoResponse {
    let rows = sqlx::query_as::<_, AlertChannel_>(
        "SELECT channel_type, display_name, enabled, config,
                last_tested_at, last_test_ok, last_test_error, updated_at
         FROM alert_channels
         ORDER BY channel_type",
    )
    .fetch_all(&state.db)
    .await;

    match rows {
        Ok(mut channels) => {
            // Mask secret fields in config before returning.
            for ch in &mut channels {
                if let Some(ref mut cfg) = ch.config {
                    mask_secrets(cfg);
                }
            }
            (StatusCode::OK, Json(ApiResponse::ok(channels))).into_response()
        }
        Err(e) => IoError::Database(e).into_response(),
    }
}

/// PUT /alerts/channels/:type — update channel configuration.
/// Secret fields in the body are encrypted before storing.
pub async fn update_channel(
    State(state): State<AppState>,
    Path(channel_type): Path<String>,
    Json(body): Json<UpdateChannelBody>,
) -> impl IntoResponse {
    // Load existing config.
    let existing = sqlx::query(
        "SELECT config FROM alert_channels WHERE channel_type = $1",
    )
    .bind(&channel_type)
    .fetch_optional(&state.db)
    .await;

    match existing {
        Err(e) => return IoError::Database(e).into_response(),
        Ok(None) => {
            return IoError::NotFound(format!("Channel '{}' not found", channel_type))
                .into_response()
        }
        Ok(Some(_)) => {}
    }

    // Encrypt secret fields in the incoming config.
    let mut new_config = body.config.clone();
    if let Err(e) = encrypt_secrets(&state, &mut new_config) {
        return err_response(
            StatusCode::INTERNAL_SERVER_ERROR,
            &format!("Failed to encrypt secrets: {}", e),
        );
    }

    let display_name_clause = if body.display_name.is_some() {
        ", display_name = $3"
    } else {
        ""
    };

    let sql = format!(
        "UPDATE alert_channels SET config = $1, updated_at = NOW(){} WHERE channel_type = $2",
        display_name_clause
    );

    let result = if let Some(ref dn) = body.display_name {
        sqlx::query(&sql)
            .bind(&new_config)
            .bind(&channel_type)
            .bind(dn)
            .execute(&state.db)
            .await
    } else {
        sqlx::query(&sql)
            .bind(&new_config)
            .bind(&channel_type)
            .execute(&state.db)
            .await
    };

    match result {
        Ok(_) => {
            info!(channel_type = %channel_type, "channel_config: updated");
            (StatusCode::OK, Json(ApiResponse::ok(serde_json::json!({ "updated": true }))))
                .into_response()
        }
        Err(e) => IoError::Database(e).into_response(),
    }
}

/// PUT /alerts/channels/:type/enabled — enable or disable a channel.
pub async fn enable_channel(
    State(state): State<AppState>,
    Path(channel_type): Path<String>,
    Json(body): Json<EnableChannelBody>,
) -> impl IntoResponse {
    let result = sqlx::query(
        "UPDATE alert_channels SET enabled = $1, updated_at = NOW() WHERE channel_type = $2",
    )
    .bind(body.enabled)
    .bind(&channel_type)
    .execute(&state.db)
    .await;

    match result {
        Ok(r) if r.rows_affected() == 0 => {
            IoError::NotFound(format!("Channel '{}' not found", channel_type)).into_response()
        }
        Ok(_) => {
            info!(
                channel_type = %channel_type,
                enabled = body.enabled,
                "channel_config: enable toggled"
            );
            (
                StatusCode::OK,
                Json(ApiResponse::ok(
                    serde_json::json!({ "enabled": body.enabled }),
                )),
            )
                .into_response()
        }
        Err(e) => IoError::Database(e).into_response(),
    }
}

/// POST /alerts/channels/:type/test — send a test delivery to the authenticated user.
pub async fn test_channel(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(channel_type): Path<String>,
) -> impl IntoResponse {
    // Extract authenticated user from gateway-forwarded header.
    let user_id = match extract_user_id(&headers) {
        Some(id) => id,
        None => {
            return err_response(
                StatusCode::UNAUTHORIZED,
                "No authenticated user found in request",
            );
        }
    };

    // Load channel config.
    let row = sqlx::query(
        "SELECT enabled, config FROM alert_channels WHERE channel_type = $1",
    )
    .bind(&channel_type)
    .fetch_optional(&state.db)
    .await;

    let row = match row {
        Err(e) => return IoError::Database(e).into_response(),
        Ok(None) => {
            return IoError::NotFound(format!("Channel '{}' not found", channel_type))
                .into_response()
        }
        Ok(Some(r)) => r,
    };

    use sqlx::Row;
    let enabled: bool = row.get("enabled");
    if !enabled {
        return err_response(
            StatusCode::BAD_REQUEST,
            &format!("Channel '{}' is disabled", channel_type),
        );
    }

    let config_val: Option<serde_json::Value> = row.get("config");
    let mut config_val = match config_val {
        Some(c) => c,
        None => {
            return err_response(StatusCode::BAD_REQUEST, "Channel has no configuration");
        }
    };

    // Decrypt secrets before passing to adapter.
    if let Err(e) = decrypt_secrets(&state, &mut config_val) {
        error!(error = %e, "test_channel: failed to decrypt config secrets");
        return err_response(
            StatusCode::INTERNAL_SERVER_ERROR,
            "Failed to decrypt channel config",
        );
    }

    // Load the user's contact details for the test.
    let user_row = sqlx::query(
        "SELECT email, display_name, phone FROM users WHERE id = $1",
    )
    .bind(user_id)
    .fetch_optional(&state.db)
    .await;

    let user_row = match user_row {
        Err(e) => return IoError::Database(e).into_response(),
        Ok(None) => {
            return IoError::NotFound(format!("User {} not found", user_id)).into_response()
        }
        Ok(Some(r)) => r,
    };

    let user_email: Option<String> = user_row.try_get("email").ok();
    let user_name: Option<String> = user_row.try_get("display_name").ok();
    let user_phone: Option<String> = user_row.try_get("phone").ok();

    let test_alert = AlertSummary {
        id: Uuid::new_v4(),
        title: "Test Alert".to_string(),
        message: Some("This is a test notification from Inside/Operations.".to_string()),
        severity: "info".to_string(),
    };

    let recipient = build_test_recipient(user_id, user_name, user_email, user_phone);

    // Dispatch via the appropriate adapter.
    let results = dispatch_test(&state, &channel_type, config_val, &test_alert, &[recipient]).await;

    let all_sent = results.iter().all(|r| r.status == "sent");
    let failed: Vec<_> = results
        .iter()
        .filter(|r| r.status == "failed")
        .map(|r| r.failure_reason.as_deref().unwrap_or("unknown"))
        .collect();

    if all_sent {
        info!(channel_type = %channel_type, user_id = %user_id, "test_channel: test delivered");
        (
            StatusCode::OK,
            Json(ApiResponse::ok(
                serde_json::json!({ "sent": true }),
            )),
        )
            .into_response()
    } else {
        warn!(
            channel_type = %channel_type,
            user_id = %user_id,
            failures = ?failed,
            "test_channel: test delivery failed"
        );
        err_response(
            StatusCode::BAD_GATEWAY,
            &format!("Test delivery failed: {}", failed.join("; ")),
        )
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn extract_user_id(headers: &HeaderMap) -> Option<Uuid> {
    headers
        .get("x-io-user-id")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.parse::<Uuid>().ok())
}

fn build_test_recipient(
    user_id: Uuid,
    name: Option<String>,
    email: Option<String>,
    phone: Option<String>,
) -> ChannelRecipient {
    ChannelRecipient {
        user_id: Some(user_id),
        name,
        email,
        phone,
        talkgroup: None,
        pa_zone: None,
        push_endpoint: None,
        push_p256dh: None,
        push_auth: None,
    }
}

async fn dispatch_test(
    state: &AppState,
    channel_type: &str,
    config_val: serde_json::Value,
    alert: &AlertSummary,
    recipients: &[ChannelRecipient],
) -> Vec<crate::channels::DeliveryResult> {
    match channel_type {
        "sms" => {
            let cfg: crate::channels::sms::SmsConfig =
                match serde_json::from_value(config_val) {
                    Ok(c) => c,
                    Err(e) => {
                        error!(error = %e, "test_channel/sms: invalid config");
                        return vec![crate::channels::DeliveryResult::failed(
                            None,
                            None,
                            format!("invalid SMS config: {}", e),
                        )];
                    }
                };
            SmsAdapter::new(cfg, state.http.clone())
                .deliver(alert, recipients)
                .await
        }
        "voice" => {
            let cfg: crate::channels::voice::VoiceConfig =
                match serde_json::from_value(config_val) {
                    Ok(c) => c,
                    Err(e) => {
                        return vec![crate::channels::DeliveryResult::failed(
                            None,
                            None,
                            format!("invalid Voice config: {}", e),
                        )];
                    }
                };
            VoiceAdapter::new(cfg, state.http.clone())
                .deliver(alert, recipients)
                .await
        }
        "radio" => {
            let cfg: crate::channels::radio::RadioConfig =
                match serde_json::from_value(config_val) {
                    Ok(c) => c,
                    Err(e) => {
                        return vec![crate::channels::DeliveryResult::failed(
                            None,
                            None,
                            format!("invalid Radio config: {}", e),
                        )];
                    }
                };
            RadioAdapter::new(cfg, state.http.clone())
                .deliver(alert, recipients)
                .await
        }
        "pa" => {
            let cfg: crate::channels::pa::PaConfig =
                match serde_json::from_value(config_val) {
                    Ok(c) => c,
                    Err(e) => {
                        return vec![crate::channels::DeliveryResult::failed(
                            None,
                            None,
                            format!("invalid PA config: {}", e),
                        )];
                    }
                };
            PaAdapter::new(cfg, state.http.clone())
                .deliver(alert, recipients)
                .await
        }
        "browser_push" => {
            let cfg: crate::channels::browser_push::BrowserPushConfig =
                match serde_json::from_value(config_val) {
                    Ok(c) => c,
                    Err(e) => {
                        return vec![crate::channels::DeliveryResult::failed(
                            None,
                            None,
                            format!("invalid BrowserPush config: {}", e),
                        )];
                    }
                };
            BrowserPushAdapter::new(cfg, state)
                .deliver(alert, recipients)
                .await
        }
        _ => {
            vec![crate::channels::DeliveryResult::skipped(format!(
                "no test handler for channel type '{}'",
                channel_type
            ))]
        }
    }
}

/// Mask sensitive fields in a config JSON value before returning to client.
/// Fields matching these patterns are replaced with `"***"`.
fn mask_secrets(cfg: &mut serde_json::Value) {
    let secret_suffixes = [
        "token",
        "password",
        "key",
        "secret",
        "auth_token",
        "bearer_token",
    ];

    if let Some(obj) = cfg.as_object_mut() {
        for (k, v) in obj.iter_mut() {
            let lower = k.to_lowercase();
            if secret_suffixes.iter().any(|suffix| lower.contains(suffix))
                && v.is_string() && !v.as_str().unwrap_or("").is_empty() {
                *v = serde_json::Value::String("***".to_string());
            }
        }
    }
}

/// Encrypt secret fields in the config JSON value using AES-GCM.
///
/// Encrypted values are base64-encoded and prefixed with `"enc:"` to distinguish
/// them from plaintext values. This convention is checked by `decrypt_secrets`.
fn encrypt_secrets(state: &AppState, cfg: &mut serde_json::Value) -> Result<(), String> {
    let master_key = get_master_key(state)?;

    let secret_suffixes = [
        "token",
        "password",
        "key",
        "secret",
        "auth_token",
        "bearer_token",
    ];

    if let Some(obj) = cfg.as_object_mut() {
        for (k, v) in obj.iter_mut() {
            let lower = k.to_lowercase();
            if secret_suffixes.iter().any(|suffix| lower.contains(suffix)) {
                if let Some(plaintext) = v.as_str() {
                    if !plaintext.is_empty() && !plaintext.starts_with("enc:") {
                        let encrypted = aes_gcm_encrypt(plaintext.as_bytes(), &master_key)?;
                        *v = serde_json::Value::String(format!("enc:{}", encrypted));
                    }
                }
            }
        }
    }

    Ok(())
}

/// Decrypt secret fields in the config JSON value (reverses `encrypt_secrets`).
/// Public wrapper used by `escalation.rs` to decrypt secrets before calling a channel adapter.
pub fn decrypt_secrets_for_dispatch(
    state: &AppState,
    cfg: &mut serde_json::Value,
) -> Result<(), String> {
    decrypt_secrets(state, cfg)
}

fn decrypt_secrets(state: &AppState, cfg: &mut serde_json::Value) -> Result<(), String> {
    let master_key = match get_master_key(state) {
        Ok(k) => k,
        Err(_) => return Ok(()), // No key configured — pass through (dev mode)
    };

    if let Some(obj) = cfg.as_object_mut() {
        for (_k, v) in obj.iter_mut() {
            if let Some(s) = v.as_str() {
                if let Some(encoded) = s.strip_prefix("enc:") {
                    let plaintext = aes_gcm_decrypt(encoded, &master_key)?;
                    *v = serde_json::Value::String(
                        String::from_utf8(plaintext).map_err(|e| e.to_string())?,
                    );
                }
            }
        }
    }

    Ok(())
}

/// Load the 32-byte master key from `ALERT_MASTER_KEY` environment variable
/// (hex-encoded 32 bytes, i.e. 64 hex chars).
fn get_master_key(_state: &AppState) -> Result<[u8; 32], String> {
    let hex_key = std::env::var("ALERT_MASTER_KEY")
        .map_err(|_| "ALERT_MASTER_KEY not set".to_string())?;
    let bytes = hex::decode(&hex_key).map_err(|e| format!("invalid ALERT_MASTER_KEY hex: {}", e))?;
    if bytes.len() != 32 {
        return Err(format!(
            "ALERT_MASTER_KEY must be 32 bytes (64 hex chars), got {}",
            bytes.len()
        ));
    }
    let mut key = [0u8; 32];
    key.copy_from_slice(&bytes);
    Ok(key)
}

/// AES-256-GCM encrypt `plaintext` with `key`.
/// Returns base64url-encoded `nonce || ciphertext`.
fn aes_gcm_encrypt(plaintext: &[u8], key: &[u8; 32]) -> Result<String, String> {
    use aes_gcm::{
        aead::{Aead, KeyInit},
        Aes256Gcm, Nonce,
    };
    use rand::RngCore;
    use base64::Engine;

    let cipher = Aes256Gcm::new_from_slice(key).map_err(|e| e.to_string())?;

    let mut nonce_bytes = [0u8; 12];
    rand::thread_rng().fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);

    let ciphertext = cipher
        .encrypt(nonce, plaintext)
        .map_err(|e| format!("AES-GCM encrypt failed: {}", e))?;

    let mut combined = Vec::with_capacity(12 + ciphertext.len());
    combined.extend_from_slice(&nonce_bytes);
    combined.extend_from_slice(&ciphertext);

    Ok(base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(&combined))
}

/// AES-256-GCM decrypt a base64url-encoded `nonce || ciphertext`.
fn aes_gcm_decrypt(encoded: &str, key: &[u8; 32]) -> Result<Vec<u8>, String> {
    use aes_gcm::{
        aead::{Aead, KeyInit},
        Aes256Gcm, Nonce,
    };
    use base64::Engine;

    let combined = base64::engine::general_purpose::URL_SAFE_NO_PAD
        .decode(encoded)
        .map_err(|e| format!("base64 decode failed: {}", e))?;

    if combined.len() < 12 {
        return Err("ciphertext too short".to_string());
    }

    let (nonce_bytes, ciphertext) = combined.split_at(12);
    let nonce = Nonce::from_slice(nonce_bytes);

    let cipher = Aes256Gcm::new_from_slice(key).map_err(|e| e.to_string())?;
    cipher
        .decrypt(nonce, ciphertext)
        .map_err(|e| format!("AES-GCM decrypt failed: {}", e))
}
