use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use chrono::Utc;
use serde::Deserialize;
use sqlx::Row;
use tracing::{info, warn};
use uuid::Uuid;

use io_auth::{hash_password, verify_password};
use io_error::{IoError, IoResult};
use io_models::ApiResponse;

use crate::state::AppState;

// ---------------------------------------------------------------------------
// Shared rate-limit constants (identical to verify-password, same counters)
// ---------------------------------------------------------------------------

/// Soft limit: max failures within the rolling window before 429.
const SOFT_FAIL_LIMIT: i16 = 5;
/// Hard limit: cumulative failures since last successful unlock before forced sign-out.
const HARD_FAIL_LIMIT: i16 = 20;
/// Soft window duration in seconds (5 minutes).
const SOFT_WINDOW_SECS: i64 = 300;

// ---------------------------------------------------------------------------
// Request types
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct SetPinRequest {
    /// Exactly 6 numeric digits.
    pub pin: String,
    /// Required for local-password accounts. Pass as empty string for SSO-only accounts.
    pub current_password: String,
}

#[derive(Debug, Deserialize)]
pub struct DeletePinRequest {
    /// Same requirement as SetPinRequest.
    pub current_password: String,
}

#[derive(Debug, Deserialize)]
pub struct VerifyPinRequest {
    /// Exactly 6 numeric digits.
    pub pin: String,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn extract_user_id(headers: &HeaderMap) -> IoResult<Uuid> {
    headers
        .get("x-io-user-id")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .parse::<Uuid>()
        .map_err(|_| IoError::Unauthorized)
}

fn extract_client_ip(headers: &HeaderMap) -> String {
    headers
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.split(',').next())
        .or_else(|| headers.get("x-real-ip").and_then(|v| v.to_str().ok()))
        .unwrap_or("127.0.0.1")
        .trim()
        .to_string()
}

/// Validate that the string is exactly 6 numeric digits.
fn validate_pin(pin: &str) -> bool {
    pin.len() == 6 && pin.chars().all(|c| c.is_ascii_digit())
}

// ---------------------------------------------------------------------------
// POST /auth/pin — Set or update PIN
// ---------------------------------------------------------------------------

pub async fn set_pin(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<SetPinRequest>,
) -> IoResult<Response> {
    let user_id = extract_user_id(&headers)?;

    // --- Validate PIN format ---
    if !validate_pin(&req.pin) {
        return Ok((
            StatusCode::UNPROCESSABLE_ENTITY,
            Json(serde_json::json!({
                "error": "validation_error",
                "message": "pin must be exactly 6 numeric digits",
            })),
        )
            .into_response());
    }

    // --- Fetch user record ---
    let row = sqlx::query(
        "SELECT password_hash, auth_provider FROM users
         WHERE id = $1 AND deleted_at IS NULL",
    )
    .bind(user_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(IoError::Unauthorized)?;

    let password_hash: Option<String> = row.get("password_hash");
    let auth_provider: String = row.get("auth_provider");

    // --- Verify current password for local accounts ---
    // SSO-only accounts (no local password_hash) skip the password check.
    let is_sso_only = password_hash.is_none() || auth_provider != "local";

    if !is_sso_only {
        let hash = password_hash
            .as_deref()
            .expect("password_hash is Some: checked above");
        let valid = verify_password(&req.current_password, hash)
            .map_err(|e| IoError::Internal(e.to_string()))?;
        if !valid {
            return Ok((
                StatusCode::UNAUTHORIZED,
                Json(serde_json::json!({
                    "error": "invalid_password",
                    "message": "current password is incorrect",
                })),
            )
                .into_response());
        }
    }
    // For SSO-only: accept even empty current_password — no check needed.

    // --- Hash the PIN with Argon2 ---
    let pin_hash = hash_password(&req.pin).map_err(|e| IoError::Internal(e.to_string()))?;

    // --- Persist ---
    sqlx::query("UPDATE users SET lock_pin_hash = $1 WHERE id = $2")
        .bind(&pin_hash)
        .bind(user_id)
        .execute(&state.db)
        .await?;

    info!(user_id = %user_id, "Lock screen PIN set");

    crate::audit::log_event(
        &state.db,
        "users",
        "PIN_SET",
        Some(user_id),
        Some(user_id),
        serde_json::json!({}),
    )
    .await;

    Ok((StatusCode::OK, Json(ApiResponse::ok(serde_json::json!({})))).into_response())
}

// ---------------------------------------------------------------------------
// DELETE /auth/pin — Remove PIN
// ---------------------------------------------------------------------------

pub async fn delete_pin(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<DeletePinRequest>,
) -> IoResult<Response> {
    let user_id = extract_user_id(&headers)?;

    // --- Fetch user record ---
    let row = sqlx::query(
        "SELECT password_hash, auth_provider FROM users
         WHERE id = $1 AND deleted_at IS NULL",
    )
    .bind(user_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(IoError::Unauthorized)?;

    let password_hash: Option<String> = row.get("password_hash");
    let auth_provider: String = row.get("auth_provider");

    // --- Verify current password for local accounts ---
    let is_sso_only = password_hash.is_none() || auth_provider != "local";

    if !is_sso_only {
        let hash = password_hash
            .as_deref()
            .expect("password_hash is Some: checked above");
        let valid = verify_password(&req.current_password, hash)
            .map_err(|e| IoError::Internal(e.to_string()))?;
        if !valid {
            return Ok((
                StatusCode::UNAUTHORIZED,
                Json(serde_json::json!({
                    "error": "invalid_password",
                    "message": "current password is incorrect",
                })),
            )
                .into_response());
        }
    }

    // --- Clear PIN ---
    sqlx::query("UPDATE users SET lock_pin_hash = NULL WHERE id = $1")
        .bind(user_id)
        .execute(&state.db)
        .await?;

    info!(user_id = %user_id, "Lock screen PIN removed");

    crate::audit::log_event(
        &state.db,
        "users",
        "PIN_REMOVED",
        Some(user_id),
        Some(user_id),
        serde_json::json!({}),
    )
    .await;

    Ok((StatusCode::OK, Json(ApiResponse::ok(serde_json::json!({})))).into_response())
}

// ---------------------------------------------------------------------------
// POST /auth/verify-pin — Verify PIN for lock-screen unlock
//
// Uses the SAME rate-limit counters (per session row) as verify-password.
// Soft and hard limits are shared across both endpoints.
// ---------------------------------------------------------------------------

pub async fn verify_pin(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<VerifyPinRequest>,
) -> IoResult<Response> {
    let user_id = extract_user_id(&headers)?;
    let ip = extract_client_ip(&headers);

    // --- Fetch user's PIN hash ---
    let row = sqlx::query("SELECT lock_pin_hash FROM users WHERE id = $1 AND deleted_at IS NULL")
        .bind(user_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or(IoError::Unauthorized)?;

    let lock_pin_hash: Option<String> = row.get("lock_pin_hash");

    // --- 404 if no PIN is set ---
    let pin_hash = match lock_pin_hash {
        Some(h) => h,
        None => {
            return Ok((
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({ "error": "no_pin_set" })),
            )
                .into_response());
        }
    };

    // --- Fetch the active session for rate-limit counters ---
    let session_row = sqlx::query(
        "SELECT id, unlock_fail_count_soft, unlock_fail_window_start,
                unlock_fail_count_hard, last_successful_unlock_at
         FROM user_sessions
         WHERE user_id = $1
           AND revoked_at IS NULL
           AND expires_at > NOW()
         ORDER BY created_at DESC
         LIMIT 1",
    )
    .bind(user_id)
    .fetch_optional(&state.db)
    .await?;

    // --- Check rate-limit counters (identical logic to verify-password) ---
    if let Some(ref s) = session_row {
        let session_id: Uuid = s.get("id");
        let soft_count: i16 = s.get("unlock_fail_count_soft");
        let window_start: Option<chrono::DateTime<Utc>> = s.get("unlock_fail_window_start");
        let hard_count: i16 = s.get("unlock_fail_count_hard");

        let window_active = window_start
            .map(|ws| (Utc::now() - ws).num_seconds() < SOFT_WINDOW_SECS)
            .unwrap_or(false);

        if window_active && soft_count >= SOFT_FAIL_LIMIT {
            let ws = window_start.expect("window_start is Some when window_active is true");
            let retry_after = (SOFT_WINDOW_SECS - (Utc::now() - ws).num_seconds()).max(1) as u64;
            return Ok((
                StatusCode::TOO_MANY_REQUESTS,
                Json(serde_json::json!({
                    "error": "rate_limited",
                    "retry_after_seconds": retry_after,
                })),
            )
                .into_response());
        }

        if hard_count >= HARD_FAIL_LIMIT {
            sqlx::query(
                "UPDATE user_sessions SET revoked_at = NOW(), revoked_reason = 'unlock_hard_limit'
                 WHERE id = $1",
            )
            .bind(session_id)
            .execute(&state.db)
            .await?;

            warn!(
                user_id = %user_id,
                "Hard unlock limit reached via PIN — session revoked"
            );

            return Ok((
                StatusCode::UNAUTHORIZED,
                Json(serde_json::json!({ "error": "forced_signout" })),
            )
                .into_response());
        }
    }

    // --- Verify PIN ---
    let valid =
        verify_password(&req.pin, &pin_hash).map_err(|e| IoError::Internal(e.to_string()))?;

    if !valid {
        if let Some(ref s) = session_row {
            let session_id: Uuid = s.get("id");
            let soft_count: i16 = s.get("unlock_fail_count_soft");
            let window_start: Option<chrono::DateTime<Utc>> = s.get("unlock_fail_window_start");
            let hard_count: i16 = s.get("unlock_fail_count_hard");

            let window_active = window_start
                .map(|ws| (Utc::now() - ws).num_seconds() < SOFT_WINDOW_SECS)
                .unwrap_or(false);

            let (new_soft, new_window_start) = if window_active {
                (soft_count + 1, window_start)
            } else {
                (1i16, Some(Utc::now()))
            };

            let new_hard = hard_count + 1;
            let soft_remaining = (SOFT_FAIL_LIMIT - new_soft).max(0);

            sqlx::query(
                "UPDATE user_sessions
                 SET unlock_fail_count_soft   = $1,
                     unlock_fail_window_start = $2,
                     unlock_fail_count_hard   = $3
                 WHERE id = $4",
            )
            .bind(new_soft)
            .bind(new_window_start)
            .bind(new_hard)
            .bind(session_id)
            .execute(&state.db)
            .await?;

            metrics::counter!(
                "io_unlock_failures_total",
                "reason" => "bad_pin",
            )
            .increment(1);

            warn!(
                user_id = %user_id,
                soft_count = new_soft,
                hard_count = new_hard,
                "Failed PIN unlock attempt",
            );

            return Ok((
                StatusCode::UNAUTHORIZED,
                Json(serde_json::json!({
                    "error": "invalid_pin",
                    "soft_remaining": soft_remaining,
                })),
            )
                .into_response());
        }

        // No session row — return generic 401 with no counter information.
        return Ok((
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({
                "error": "invalid_pin",
                "soft_remaining": SOFT_FAIL_LIMIT,
            })),
        )
            .into_response());
    }

    // --- Correct PIN — reset counters, clear locked_since ---
    if let Some(ref s) = session_row {
        let session_id: Uuid = s.get("id");

        sqlx::query(
            "UPDATE user_sessions
             SET locked_since               = NULL,
                 last_successful_unlock_at  = NOW(),
                 unlock_fail_count_soft     = 0,
                 unlock_fail_window_start   = NULL,
                 unlock_fail_count_hard     = 0
             WHERE id = $1",
        )
        .bind(session_id)
        .execute(&state.db)
        .await?;

        // Publish best-effort session.unlocked event.
        let url = format!("{}/internal/publish", state.config.data_broker_url);
        let body = serde_json::json!({
            "event_type": "session.unlocked",
            "user_id": user_id,
            "payload": { "session_id": session_id },
        });
        let _ = state
            .http
            .post(&url)
            .header("x-io-service-secret", &state.config.service_secret)
            .json(&body)
            .send()
            .await;
    }

    info!(user_id = %user_id, ip = %ip, "Successful lock screen PIN unlock");

    metrics::counter!(
        "io_unlock_successes_total",
        "method" => "pin",
    )
    .increment(1);

    crate::audit::log_event(
        &state.db,
        "user_sessions",
        "UNLOCK_SUCCESS",
        Some(user_id),
        Some(user_id),
        serde_json::json!({ "ip": ip, "method": "pin" }),
    )
    .await;

    Ok((StatusCode::OK, Json(serde_json::json!({ "success": true }))).into_response())
}
