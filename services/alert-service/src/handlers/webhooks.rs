//! Twilio webhook handlers.
//!
//! Two endpoints are provided:
//!   - POST /alerts/webhooks/twilio/status  — inbound delivery status callbacks
//!   - POST /alerts/webhooks/twilio/voice   — inbound voice keypress callbacks
//!
//! Both endpoints validate the `X-Twilio-Signature` HMAC-SHA1 header before
//! processing the request body. Unsigned requests return 403 Forbidden.

use axum::{
    extract::{Request, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    Json,
};
use base64::{engine::general_purpose::STANDARD as BASE64, Engine as _};
use hmac::{Hmac, Mac};
use io_error::IoError;
use sha1::Sha1;
use std::collections::BTreeMap;
use tracing::{info, warn};

use crate::state::AppState;

type HmacSha1 = Hmac<Sha1>;

// ---------------------------------------------------------------------------
// Twilio signature validation
// ---------------------------------------------------------------------------

/// Validate the `X-Twilio-Signature` header.
///
/// Twilio's algorithm:
/// 1. Concatenate the full URL (including query string).
/// 2. If the request is a POST form, sort all POST parameters by key name and
///    append each key and value (no separator) to the URL string.
/// 3. Sign the resulting string with HMAC-SHA1 using the auth token.
/// 4. Base64-encode the result and compare with the header value.
///
/// Returns `true` when the signature is valid or when `auth_token` is empty
/// (development mode — skip validation).
fn validate_twilio_signature(
    auth_token: &str,
    url: &str,
    params: &BTreeMap<String, String>,
    signature_header: &str,
) -> bool {
    if auth_token.is_empty() {
        // Dev mode: no auth token configured — skip validation.
        return true;
    }

    // Build the string to sign: URL + sorted key-value pairs concatenated.
    let mut to_sign = url.to_string();
    for (k, v) in params {
        to_sign.push_str(k);
        to_sign.push_str(v);
    }

    let mut mac = match HmacSha1::new_from_slice(auth_token.as_bytes()) {
        Ok(m) => m,
        Err(_) => return false,
    };
    mac.update(to_sign.as_bytes());
    let result = mac.finalize().into_bytes();
    let expected = BASE64.encode(result);

    // Constant-time comparison is not strictly required here because Twilio
    // signatures are not secret tokens — they verify request origin. A
    // simple string comparison is consistent with the Twilio helper libraries.
    expected == signature_header
}

/// Parse `application/x-www-form-urlencoded` body into a sorted map.
fn parse_form_body(body: &str) -> BTreeMap<String, String> {
    let mut map = BTreeMap::new();
    for pair in body.split('&') {
        if let Some((k, v)) = pair.split_once('=') {
            let key = urlencoding::decode(k).unwrap_or_default().into_owned();
            let val = urlencoding::decode(v).unwrap_or_default().into_owned();
            map.insert(key, val);
        }
    }
    map
}

/// Reject the request with 403 and a JSON body.
fn forbidden() -> axum::response::Response {
    (
        StatusCode::FORBIDDEN,
        Json(serde_json::json!({
            "success": false,
            "error": {
                "code": "FORBIDDEN",
                "message": "Invalid or missing Twilio signature"
            }
        })),
    )
        .into_response()
}

// ---------------------------------------------------------------------------
// POST /alerts/webhooks/twilio/status
// ---------------------------------------------------------------------------

/// Twilio delivery status callback.
///
/// Twilio POSTs `MessageSid`, `MessageStatus`, and other fields as form data.
/// We update the matching `alert_deliveries` row using `external_id = MessageSid`.
///
/// Supported `MessageStatus` values → internal status:
/// - `queued`, `accepted`, `sending` → `sending`
/// - `sent`                          → `sent`
/// - `delivered`                     → `delivered`
/// - `failed`, `undelivered`         → `failed`
pub async fn twilio_status(
    State(state): State<AppState>,
    headers: HeaderMap,
    request: Request,
) -> impl IntoResponse {
    // Read body bytes
    let body_bytes = match axum::body::to_bytes(request.into_body(), 65_536).await {
        Ok(b) => b,
        Err(_) => {
            return IoError::BadRequest("Failed to read request body".to_string()).into_response()
        }
    };
    let body_str = match std::str::from_utf8(&body_bytes) {
        Ok(s) => s,
        Err(_) => return IoError::BadRequest("Non-UTF-8 request body".to_string()).into_response(),
    };

    let params = parse_form_body(body_str);

    // Retrieve Twilio auth token from SMS channel config (used for signing both SMS and Voice)
    let auth_token = get_twilio_auth_token(&state).await;

    // Build the URL for signature validation.
    // In production the gateway strips the internal URL; use a configured override or the
    // service's own URL. If neither is set we fall back to empty string (dev mode).
    let callback_url = state
        .config
        .twilio_status_callback_url
        .as_deref()
        .unwrap_or("");

    let signature = headers
        .get("x-twilio-signature")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    if !validate_twilio_signature(&auth_token, callback_url, &params, signature) {
        warn!("twilio_status: invalid Twilio signature — rejecting");
        return forbidden();
    }

    let message_sid = match params.get("MessageSid") {
        Some(s) if !s.is_empty() => s.clone(),
        _ => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({
                    "success": false,
                    "error": { "code": "BAD_REQUEST", "message": "Missing MessageSid" }
                })),
            )
                .into_response();
        }
    };

    let twilio_status = params
        .get("MessageStatus")
        .map(|s| s.as_str())
        .unwrap_or("unknown");
    let internal_status = match twilio_status {
        "queued" | "accepted" | "sending" | "scheduled" => "sending",
        "sent" => "sent",
        "delivered" => "delivered",
        "failed" | "undelivered" | "canceled" => "failed",
        _ => "sent", // Unknown status: treat as sent to avoid data loss
    };

    let failure_reason: Option<String> = if internal_status == "failed" {
        params
            .get("ErrorMessage")
            .or_else(|| params.get("ErrorCode"))
            .cloned()
    } else {
        None
    };

    // Update the delivery row matching the Twilio MessageSid
    let result = sqlx::query(
        "UPDATE alert_deliveries
         SET status = $1,
             delivered_at = CASE WHEN $1 = 'delivered' THEN now() ELSE delivered_at END,
             failure_reason = COALESCE($2, failure_reason)
         WHERE external_id = $3",
    )
    .bind(internal_status)
    .bind(&failure_reason)
    .bind(&message_sid)
    .execute(&state.db)
    .await;

    match result {
        Ok(r) => {
            info!(
                message_sid = %message_sid,
                twilio_status = %twilio_status,
                internal_status = %internal_status,
                rows_affected = r.rows_affected(),
                "twilio_status: delivery status updated"
            );
            (StatusCode::NO_CONTENT, Json(serde_json::json!({}))).into_response()
        }
        Err(e) => IoError::Database(e).into_response(),
    }
}

// ---------------------------------------------------------------------------
// POST /alerts/webhooks/twilio/voice
// ---------------------------------------------------------------------------

/// Twilio voice keypress callback (TwiML gather).
///
/// Twilio POSTs `CallSid`, `Digits`, and other fields as form data.
/// If `Digits == "1"` (the configured acknowledgment key), we acknowledge
/// the alert whose delivery row has `external_id = CallSid`.
pub async fn twilio_voice(
    State(state): State<AppState>,
    headers: HeaderMap,
    request: Request,
) -> impl IntoResponse {
    // Read body bytes
    let body_bytes = match axum::body::to_bytes(request.into_body(), 65_536).await {
        Ok(b) => b,
        Err(_) => {
            return IoError::BadRequest("Failed to read request body".to_string()).into_response()
        }
    };
    let body_str = match std::str::from_utf8(&body_bytes) {
        Ok(s) => s,
        Err(_) => return IoError::BadRequest("Non-UTF-8 request body".to_string()).into_response(),
    };

    let params = parse_form_body(body_str);

    // Validate Twilio signature
    let auth_token = get_twilio_auth_token(&state).await;
    let callback_url = state
        .config
        .twilio_voice_callback_url
        .as_deref()
        .unwrap_or("");

    let signature = headers
        .get("x-twilio-signature")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    if !validate_twilio_signature(&auth_token, callback_url, &params, signature) {
        warn!("twilio_voice: invalid Twilio signature — rejecting");
        return forbidden();
    }

    let call_sid = match params.get("CallSid") {
        Some(s) if !s.is_empty() => s.clone(),
        _ => {
            return (
                StatusCode::BAD_REQUEST,
                Json(serde_json::json!({
                    "success": false,
                    "error": { "code": "BAD_REQUEST", "message": "Missing CallSid" }
                })),
            )
                .into_response();
        }
    };

    let digits = params.get("Digits").map(|s| s.as_str()).unwrap_or("");

    if digits != "1" {
        // Non-acknowledgment keypress — return a simple TwiML response
        info!(call_sid = %call_sid, digits = %digits, "twilio_voice: non-ack keypress, ignoring");
        return (
            StatusCode::OK,
            [(axum::http::header::CONTENT_TYPE, "application/xml")],
            "<Response><Say>Thank you. Goodbye.</Say><Hangup/></Response>",
        )
            .into_response();
    }

    // Digit "1" pressed — find the alert via the delivery's external_id
    let alert_id_result: Result<Option<uuid::Uuid>, _> =
        sqlx::query_scalar("SELECT alert_id FROM alert_deliveries WHERE external_id = $1 LIMIT 1")
            .bind(&call_sid)
            .fetch_optional(&state.db)
            .await;

    let alert_id = match alert_id_result {
        Ok(Some(id)) => id,
        Ok(None) => {
            warn!(call_sid = %call_sid, "twilio_voice: no delivery found for CallSid");
            return (
                StatusCode::OK,
                [(axum::http::header::CONTENT_TYPE, "application/xml")],
                "<Response><Say>Alert not found. Goodbye.</Say><Hangup/></Response>",
            )
                .into_response();
        }
        Err(e) => return IoError::Database(e).into_response(),
    };

    // Check current alert status
    let status: Option<String> =
        sqlx::query_scalar("SELECT status::text FROM alerts WHERE id = $1")
            .bind(alert_id)
            .fetch_optional(&state.db)
            .await
            .unwrap_or(None);

    if status.as_deref() != Some("active") {
        info!(
            alert_id = %alert_id,
            status = ?status,
            "twilio_voice: alert is not active, skipping ack"
        );
        return (
            StatusCode::OK,
            [(axum::http::header::CONTENT_TYPE, "application/xml")],
            "<Response><Say>Alert has already been acknowledged. Thank you.</Say><Hangup/></Response>",
        )
            .into_response();
    }

    // Acknowledge the alert (no user_id for Twilio-originated acks)
    let ack_result = sqlx::query(
        "UPDATE alerts
         SET status = 'acknowledged'::alert_status,
             acknowledged_at = now()
         WHERE id = $1 AND status = 'active'::alert_status",
    )
    .bind(alert_id)
    .execute(&state.db)
    .await;

    match ack_result {
        Ok(r) if r.rows_affected() > 0 => {
            // Cancel escalation token
            if let Some((_, token)) = state.escalation_tokens.remove(&alert_id) {
                token.cancel();
            }
            info!(alert_id = %alert_id, "twilio_voice: alert acknowledged via keypress 1");
            (
                StatusCode::OK,
                [(axum::http::header::CONTENT_TYPE, "application/xml")],
                "<Response><Say>Alert acknowledged. Thank you.</Say><Hangup/></Response>",
            )
                .into_response()
        }
        Ok(_) => {
            // Concurrent ack — alert was already acknowledged
            (
                StatusCode::OK,
                [(axum::http::header::CONTENT_TYPE, "application/xml")],
                "<Response><Say>Alert has already been acknowledged. Thank you.</Say><Hangup/></Response>",
            )
                .into_response()
        }
        Err(e) => IoError::Database(e).into_response(),
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Fetch the Twilio auth token from the `alert_channels` table (SMS config).
/// Returns an empty string if the channel is not configured (dev mode).
async fn get_twilio_auth_token(state: &AppState) -> String {
    let config_result: Result<Option<serde_json::Value>, _> =
        sqlx::query_scalar("SELECT config FROM alert_channels WHERE channel_type = 'sms' LIMIT 1")
            .fetch_optional(&state.db)
            .await;

    match config_result {
        Ok(Some(cfg)) => cfg
            .get("auth_token")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        _ => String::new(),
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validate_signature_empty_token_always_passes() {
        let params = BTreeMap::new();
        assert!(validate_twilio_signature(
            "",
            "https://example.com/cb",
            &params,
            "anything"
        ));
    }

    #[test]
    fn validate_signature_wrong_token_fails() {
        let mut params = BTreeMap::new();
        params.insert("foo".to_string(), "bar".to_string());
        assert!(!validate_twilio_signature(
            "wrong_token",
            "https://example.com/cb",
            &params,
            "invalidsignature"
        ));
    }

    #[test]
    fn validate_signature_known_vector() {
        // Test vector generated from the Twilio HMAC-SHA1 algorithm:
        // URL: https://mycompany.com/myapp
        // POST params sorted: CallSid, Caller, Digits, From, To
        // Auth token: 12345
        // String to sign: "https://mycompany.com/myapp"
        //   + "CallSid" + "CA1234567890ABCDE"
        //   + "Caller" + "+12349013030"
        //   + "Digits" + "1234"
        //   + "From" + "+12349013030"
        //   + "To" + "+18005551212"
        // Expected HMAC-SHA1 base64: 3KI2uRuYyAdhZIJXcpU0izDUzWI=
        let mut params = BTreeMap::new();
        params.insert("CallSid".to_string(), "CA1234567890ABCDE".to_string());
        params.insert("Caller".to_string(), "+12349013030".to_string());
        params.insert("Digits".to_string(), "1234".to_string());
        params.insert("From".to_string(), "+12349013030".to_string());
        params.insert("To".to_string(), "+18005551212".to_string());

        let valid = validate_twilio_signature(
            "12345",
            "https://mycompany.com/myapp",
            &params,
            "3KI2uRuYyAdhZIJXcpU0izDUzWI=",
        );
        assert!(valid, "Known Twilio test vector must validate correctly");
    }

    #[test]
    fn parse_form_body_handles_encoded_values() {
        let body = "MessageSid=SM1234&MessageStatus=delivered&To=%2B15005550006";
        let map = parse_form_body(body);
        assert_eq!(map.get("MessageSid").map(|s| s.as_str()), Some("SM1234"));
        assert_eq!(
            map.get("MessageStatus").map(|s| s.as_str()),
            Some("delivered")
        );
        assert_eq!(map.get("To").map(|s| s.as_str()), Some("+15005550006"));
    }

    #[test]
    fn parse_form_body_empty_string_returns_empty_map() {
        let map = parse_form_body("");
        assert!(map.is_empty());
    }
}
