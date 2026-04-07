use axum::{
    extract::State,
    http::{header, HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sqlx::Row;
use tracing::{info, warn};
use uuid::Uuid;

use io_auth::{build_claims, generate_access_token, verify_password};
use io_error::{IoError, IoResult};
use io_models::ApiResponse;

use crate::handlers::mfa::check_mfa_required;
use crate::state::{AppState, EulaPendingEntry, MfaPendingEntry};

// ---------------------------------------------------------------------------
// Publish a session lock/unlock event to the data broker so connected
// WebSocket clients receive the event in real time.
// Failures are logged but do not fail the calling handler.
// ---------------------------------------------------------------------------

async fn publish_session_event(
    state: &AppState,
    event_type: &str,
    user_id: Uuid,
    session_id: Uuid,
) {
    let url = format!("{}/internal/publish", state.config.data_broker_url);
    let body = serde_json::json!({
        "event_type": event_type,
        "user_id": user_id,
        "payload": { "session_id": session_id },
    });
    match state
        .http
        .post(&url)
        .header("x-io-service-secret", &state.config.service_secret)
        .json(&body)
        .send()
        .await
    {
        Ok(resp) if resp.status().is_success() => {
            info!(
                event_type = event_type,
                user_id = %user_id,
                session_id = %session_id,
                "session event published to data broker"
            );
        }
        Ok(resp) => {
            warn!(
                event_type = event_type,
                status = %resp.status(),
                "data broker returned non-success for session event"
            );
        }
        Err(e) => {
            warn!(
                event_type = event_type,
                error = %e,
                "failed to publish session event to data broker"
            );
        }
    }
}

// ---------------------------------------------------------------------------
// Request / response bodies
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub username: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
pub struct LoginResponse {
    pub access_token: String,
    pub token_type: String,
    pub expires_in: u64,
    pub user: UserSummary,
}

#[derive(Debug, Serialize)]
pub struct UserSummary {
    pub id: Uuid,
    pub username: String,
    pub full_name: Option<String>,
    pub email: String,
    pub eula_accepted: bool,
}

#[derive(Debug, Serialize)]
pub struct EulaRequiredResponse {
    pub status: String,
    pub eula_pending_token: String,
    pub eula: EulaInfo,
}

#[derive(Debug, Serialize)]
pub struct EulaInfo {
    pub version: String,
    pub title: String,
    pub content_url: String,
}

// ---------------------------------------------------------------------------
// POST /auth/login
// Local username/password authentication. Returns access token in body,
// sets refresh token as httpOnly cookie.
// ---------------------------------------------------------------------------

pub async fn login(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<LoginRequest>,
) -> IoResult<Response> {
    let username = req.username.trim().to_lowercase();

    // --- 1. Look up user ---
    let row = sqlx::query(
        "SELECT id, username, full_name, email, password_hash, enabled,
                locked_until, failed_login_count, auth_provider, is_service_account,
                is_emergency_account
         FROM users
         WHERE LOWER(username) = $1 AND deleted_at IS NULL",
    )
    .bind(&username)
    .fetch_optional(&state.db)
    .await?;

    let row = match row {
        Some(r) => r,
        None => {
            // Constant-time: still verify a dummy hash to prevent timing attacks
            let _ = verify_password(
                "dummy",
                "$argon2id$v=19$m=19456,t=2,p=1$fake/hash/placeholder==",
            );
            return Err(IoError::BadRequest(
                "Invalid username or password".to_string(),
            ));
        }
    };

    let user_id: Uuid = row.get("id");
    let db_username: String = row.get("username");
    let full_name: Option<String> = row.get("full_name");
    let email: String = row.get("email");
    let password_hash: Option<String> = row.get("password_hash");
    let enabled: bool = row.get("enabled");
    let locked_until: Option<chrono::DateTime<Utc>> = row.get("locked_until");
    let failed_login_count: i32 = row.get("failed_login_count");
    let auth_provider: String = row.get("auth_provider");
    let is_service_account: bool = row.get("is_service_account");
    let is_emergency_account: bool = row.get("is_emergency_account");

    // --- 2. Validate auth provider ---
    if auth_provider != "local" {
        metrics::counter!(
            "io_auth_failures_total",
            "reason" => "sso_account",
        )
        .increment(1);
        return Err(IoError::BadRequest(
            "This account uses SSO. Please sign in with your identity provider.".to_string(),
        ));
    }

    // --- 3. Check account status ---
    if !enabled {
        warn!(username = %db_username, "Login attempt on disabled account");
        return Err(IoError::Forbidden("Account is disabled.".to_string()));
    }

    if let Some(locked_until) = locked_until {
        if locked_until > Utc::now() {
            let secs = (locked_until - Utc::now()).num_seconds().max(1) as u64;
            return Err(IoError::RateLimited {
                retry_after_secs: secs,
            });
        }
    }

    // --- 4. Verify password ---
    let hash = match &password_hash {
        Some(h) => h.as_str(),
        None => {
            return Err(IoError::BadRequest(
                "Invalid username or password".to_string(),
            ));
        }
    };

    let valid =
        verify_password(&req.password, hash).map_err(|e| IoError::Internal(e.to_string()))?;

    if !valid {
        let new_count = failed_login_count + 1;
        if new_count >= state.config.max_failed_logins {
            let lockout_until =
                Utc::now() + chrono::Duration::seconds(state.config.lockout_duration_secs as i64);
            sqlx::query(
                "UPDATE users SET failed_login_count = $1, locked_until = $2 WHERE id = $3",
            )
            .bind(new_count)
            .bind(lockout_until)
            .bind(user_id)
            .execute(&state.db)
            .await?;
            warn!(username = %db_username, "Account locked after {} failed attempts", new_count);
            metrics::counter!(
                "io_auth_failures_total",
                "reason" => "account_locked",
            )
            .increment(1);
        } else {
            sqlx::query("UPDATE users SET failed_login_count = $1 WHERE id = $2")
                .bind(new_count)
                .bind(user_id)
                .execute(&state.db)
                .await?;
            metrics::counter!(
                "io_auth_failures_total",
                "reason" => "bad_password",
            )
            .increment(1);
        }
        crate::audit::log_event(
            &state.db,
            "users",
            "FAILED_LOGIN",
            Some(user_id),
            Some(user_id),
            serde_json::json!({ "ip": extract_client_ip(&headers) }),
        )
        .await;
        return Err(IoError::BadRequest(
            "Invalid username or password".to_string(),
        ));
    }

    // --- 5. MFA gate ---
    // Service accounts use API keys and bypass MFA entirely.
    if !is_service_account {
        if let Some((mfa_token, allowed_methods)) = check_mfa_required(&state.db, user_id).await? {
            state.mfa_pending_tokens.insert(
                mfa_token.clone(),
                MfaPendingEntry {
                    user_id,
                    allowed_methods: allowed_methods.clone(),
                    expires_at: Utc::now() + chrono::Duration::minutes(5),
                },
            );
            metrics::counter!("io_mfa_challenges_total").increment(1);
            return Ok((
                StatusCode::OK,
                Json(ApiResponse::ok(serde_json::json!({
                    "mfa_required": true,
                    "mfa_token": mfa_token,
                    "allowed_methods": allowed_methods,
                }))),
            )
                .into_response());
        }
    }

    // --- 6. EULA gate ---
    // Service accounts (API keys) and emergency break-glass accounts bypass the EULA check.
    if !is_service_account && !is_emergency_account {
        let eula_not_accepted: bool = sqlx::query(
            "SELECT NOT EXISTS (
                SELECT 1 FROM eula_acceptances ea
                JOIN eula_versions ev ON ev.id = ea.eula_version_id
                WHERE ea.user_id = $1 AND ev.is_active = true AND ev.eula_type = 'end_user'
            ) AS eula_not_accepted",
        )
        .bind(user_id)
        .fetch_optional(&state.db)
        .await
        .ok()
        .flatten()
        .and_then(|r| r.try_get::<bool, _>("eula_not_accepted").ok())
        .unwrap_or(false);

        if eula_not_accepted {
            // Fetch the active EULA version details for the response
            let eula_row = sqlx::query(
                "SELECT version, title FROM eula_versions
                 WHERE eula_type = 'end_user' AND is_active = true
                 LIMIT 1",
            )
            .fetch_optional(&state.db)
            .await;

            let (eula_version, eula_title) = match eula_row {
                Ok(Some(r)) => (
                    r.try_get::<String, _>("version")
                        .unwrap_or_else(|_| "1.0".to_string()),
                    r.try_get::<String, _>("title")
                        .unwrap_or_else(|_| "End User License Agreement".to_string()),
                ),
                _ => ("1.0".to_string(), "End User License Agreement".to_string()),
            };

            // Generate a short-lived pending token (32 bytes = 64 hex chars)
            use rand::Rng;
            let bytes: Vec<u8> = (0..32).map(|_| rand::thread_rng().gen::<u8>()).collect();
            let pending_token: String = bytes.iter().map(|b| format!("{:02x}", b)).collect();

            state.eula_pending_tokens.insert(
                pending_token.clone(),
                EulaPendingEntry {
                    user_id,
                    expires_at: Utc::now() + chrono::Duration::minutes(5),
                    used: false,
                },
            );

            info!(user_id = %user_id, "EULA acceptance required — pending token issued");

            return Ok((
                StatusCode::OK,
                Json(ApiResponse::ok(EulaRequiredResponse {
                    status: "eula_required".to_string(),
                    eula_pending_token: pending_token,
                    eula: EulaInfo {
                        version: eula_version,
                        title: eula_title,
                        content_url: "/api/auth/eula/current".to_string(),
                    },
                })),
            )
                .into_response());
        }
    }

    // --- 7. Collect permissions ---
    let permissions = fetch_user_permissions(&state.db, user_id).await?;

    // --- 8. Build JWT ---
    let claims = build_claims(&user_id.to_string(), &db_username, permissions);
    let access_token = generate_access_token(&claims, &state.config.jwt_secret)
        .map_err(|e| IoError::Internal(e.to_string()))?;

    // --- 8. Generate refresh token, enforce session limit ---
    let refresh_token = Uuid::new_v4().to_string();
    let refresh_token_hash = sha256_hex(&refresh_token);
    let ttl_secs = state.config.refresh_token_ttl_secs as i64;
    let expires_at = Utc::now() + chrono::Duration::seconds(ttl_secs);

    let ip = extract_client_ip(&headers);
    let user_agent: String = headers
        .get(header::USER_AGENT)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("unknown")
        .chars()
        .take(512)
        .collect();

    enforce_session_limit(&state.db, user_id, state.config.max_sessions_per_user).await?;

    sqlx::query(
        "INSERT INTO user_sessions
            (id, user_id, refresh_token_hash, expires_at, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5::inet, $6)",
    )
    .bind(Uuid::new_v4())
    .bind(user_id)
    .bind(&refresh_token_hash)
    .bind(expires_at)
    .bind(&ip)
    .bind(&user_agent)
    .execute(&state.db)
    .await?;

    // --- 8. Update login metadata ---
    sqlx::query(
        "UPDATE users SET last_login_at = NOW(), failed_login_count = 0, locked_until = NULL
         WHERE id = $1",
    )
    .bind(user_id)
    .execute(&state.db)
    .await?;

    metrics::counter!(
        "io_auth_logins_total",
        "method" => "local",
    )
    .increment(1);
    metrics::counter!("io_tokens_issued_total", "type" => "access").increment(1);

    info!(user_id = %user_id, username = %db_username, "User logged in");

    // --- 9. Audit log ---
    crate::audit::log_event(
        &state.db,
        "users",
        "LOGIN",
        Some(user_id),
        Some(user_id),
        serde_json::json!({ "ip": ip }),
    )
    .await;

    // --- 10. Build response ---
    // If we reach this point the EULA gate was passed (either accepted or bypassed for service/emergency
    // accounts), so eula_accepted is always true from the client's perspective here.
    let body = ApiResponse::ok(LoginResponse {
        access_token,
        token_type: "Bearer".to_string(),
        expires_in: 900, // 15 minutes
        user: UserSummary {
            id: user_id,
            username: db_username,
            full_name,
            email,
            eula_accepted: true,
        },
    });

    let cookie = format!(
        "refresh_token={refresh_token}; HttpOnly; SameSite=Strict; Path=/api/auth; Max-Age={ttl_secs}"
    );

    let mut response = (StatusCode::OK, Json(body)).into_response();
    response.headers_mut().insert(
        header::SET_COOKIE,
        cookie
            .parse()
            .map_err(|_| IoError::Internal("cookie encoding error".to_string()))?,
    );
    Ok(response)
}

// ---------------------------------------------------------------------------
// POST /auth/refresh
// Rotates the refresh token. Old token is revoked, new one issued.
// ---------------------------------------------------------------------------

pub async fn refresh(State(state): State<AppState>, headers: HeaderMap) -> IoResult<Response> {
    let refresh_token = extract_refresh_cookie(&headers).ok_or_else(|| IoError::Unauthorized)?;

    let token_hash = sha256_hex(&refresh_token);

    // Find and validate session
    let row = sqlx::query(
        "SELECT s.id, s.user_id, s.expires_at
         FROM user_sessions s
         WHERE s.refresh_token_hash = $1
           AND s.revoked_at IS NULL
           AND s.expires_at > NOW()",
    )
    .bind(&token_hash)
    .fetch_optional(&state.db)
    .await?;

    let row = row.ok_or(IoError::Unauthorized)?;
    let session_id: Uuid = row.get("id");
    let user_id: Uuid = row.get("user_id");

    // Verify user still active
    let user_row =
        sqlx::query("SELECT username, enabled FROM users WHERE id = $1 AND deleted_at IS NULL")
            .bind(user_id)
            .fetch_optional(&state.db)
            .await?;

    let user_row = user_row.ok_or(IoError::Unauthorized)?;
    let db_username: String = user_row.get("username");
    let enabled: bool = user_row.get("enabled");

    if !enabled {
        sqlx::query("UPDATE user_sessions SET revoked_at = NOW() WHERE id = $1")
            .bind(session_id)
            .execute(&state.db)
            .await?;
        return Err(IoError::Forbidden("Account is disabled.".to_string()));
    }

    // Get updated permissions
    let permissions = fetch_user_permissions(&state.db, user_id).await?;

    // Build new access token
    let claims = build_claims(&user_id.to_string(), &db_username, permissions);
    let access_token = generate_access_token(&claims, &state.config.jwt_secret)
        .map_err(|e| IoError::Internal(e.to_string()))?;

    // Rotate refresh token
    let new_refresh_token = Uuid::new_v4().to_string();
    let new_token_hash = sha256_hex(&new_refresh_token);
    let ttl_secs = state.config.refresh_token_ttl_secs as i64;
    let new_expires_at = Utc::now() + chrono::Duration::seconds(ttl_secs);

    let ip = extract_client_ip(&headers);
    let user_agent: String = headers
        .get(header::USER_AGENT)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("unknown")
        .chars()
        .take(512)
        .collect();

    // Revoke old, create new — in a transaction
    let mut tx = state.db.begin().await?;

    sqlx::query(
        "UPDATE user_sessions SET revoked_at = NOW(), revoked_reason = 'rotated' WHERE id = $1",
    )
    .bind(session_id)
    .execute(&mut *tx)
    .await?;

    sqlx::query(
        "INSERT INTO user_sessions
            (id, user_id, refresh_token_hash, expires_at, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5::inet, $6)",
    )
    .bind(Uuid::new_v4())
    .bind(user_id)
    .bind(&new_token_hash)
    .bind(new_expires_at)
    .bind(&ip)
    .bind(&user_agent)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    metrics::counter!("io_tokens_issued_total", "type" => "access").increment(1);

    let body = ApiResponse::ok(serde_json::json!({
        "access_token": access_token,
        "token_type": "Bearer",
        "expires_in": 900u64,
    }));

    let cookie = format!(
        "refresh_token={new_refresh_token}; HttpOnly; SameSite=Strict; Path=/api/auth; Max-Age={ttl_secs}"
    );

    let mut response = (StatusCode::OK, Json(body)).into_response();
    response.headers_mut().insert(
        header::SET_COOKIE,
        cookie
            .parse()
            .map_err(|_| IoError::Internal("cookie error".to_string()))?,
    );
    Ok(response)
}

// ---------------------------------------------------------------------------
// POST /auth/logout
// Revokes the current refresh token session.
// ---------------------------------------------------------------------------

pub async fn logout(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> IoResult<impl IntoResponse> {
    if let Some(refresh_token) = extract_refresh_cookie(&headers) {
        let token_hash = sha256_hex(&refresh_token);

        // Fetch the user_id before revoking so we can log it
        let session_row = sqlx::query(
            "SELECT user_id FROM user_sessions WHERE refresh_token_hash = $1 AND revoked_at IS NULL",
        )
        .bind(&token_hash)
        .fetch_optional(&state.db)
        .await?;

        sqlx::query(
            "UPDATE user_sessions SET revoked_at = NOW(), revoked_reason = 'logout'
             WHERE refresh_token_hash = $1 AND revoked_at IS NULL",
        )
        .bind(&token_hash)
        .execute(&state.db)
        .await?;

        if let Some(sr) = session_row {
            let user_id: uuid::Uuid = sr.get("user_id");
            let ip = extract_client_ip(&headers);
            crate::audit::log_event(
                &state.db,
                "users",
                "LOGOUT",
                Some(user_id),
                Some(user_id),
                serde_json::json!({ "ip": ip }),
            )
            .await;
        }
    }

    // Clear the cookie by sending an expired one
    let clear_cookie =
        "refresh_token=; HttpOnly; SameSite=Strict; Path=/api/auth; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT";

    let body = ApiResponse::ok(serde_json::json!({ "message": "Logged out successfully" }));
    let mut response = (StatusCode::OK, Json(body)).into_response();
    response.headers_mut().insert(
        header::SET_COOKIE,
        clear_cookie
            .parse()
            .map_err(|_| IoError::Internal("cookie error".to_string()))?,
    );
    Ok(response)
}

// ---------------------------------------------------------------------------
// POST /auth/lock
// Lock the caller's active session by writing locked_since = NOW() on the
// session row.  Called by the frontend idle timer.  No new tokens are issued.
// JWT authentication is enforced by the API gateway; the user_id is injected
// via the x-io-user-id header before the request reaches this service.
// ---------------------------------------------------------------------------

pub async fn lock_session(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> IoResult<impl IntoResponse> {
    // Extract user_id from the gateway-injected header.
    let user_id_str = headers
        .get("x-io-user-id")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    let user_id: Uuid = user_id_str.parse().map_err(|_| IoError::Unauthorized)?;

    // Find the most-recently-created active session for this user.
    let session_row = sqlx::query(
        "SELECT id FROM user_sessions
         WHERE user_id = $1
           AND revoked_at IS NULL
           AND expires_at > NOW()
         ORDER BY created_at DESC
         LIMIT 1",
    )
    .bind(user_id)
    .fetch_optional(&state.db)
    .await?;

    let session_id: Uuid = match session_row {
        Some(row) => row.get("id"),
        None => {
            // No active session found — user may have refreshed from another tab;
            // return 200 so the frontend's idle timer doesn't see an error.
            return Ok((
                StatusCode::OK,
                Json(serde_json::json!({ "locked": false, "reason": "no_active_session" })),
            ));
        }
    };

    // Write locked_since only if not already locked (idempotent).
    sqlx::query(
        "UPDATE user_sessions
         SET locked_since = COALESCE(locked_since, NOW())
         WHERE id = $1",
    )
    .bind(session_id)
    .execute(&state.db)
    .await?;

    info!(user_id = %user_id, session_id = %session_id, "Session locked");

    // Publish event to data broker (best-effort).
    publish_session_event(&state, "session.locked", user_id, session_id).await;

    crate::audit::log_event(
        &state.db,
        "user_sessions",
        "SESSION_LOCKED",
        Some(user_id),
        Some(user_id),
        serde_json::json!({ "session_id": session_id }),
    )
    .await;

    Ok((StatusCode::OK, Json(serde_json::json!({ "locked": true }))))
}

// ---------------------------------------------------------------------------
// POST /auth/verify-password
// Lock-screen unlock: re-verifies a local account password without issuing
// new tokens.  Two-tier rate limiting per (user_id, ip_address):
//   Soft limit: 5 failures in a 5-minute rolling window → 429
//   Hard limit: 20 failures since last successful unlock → 401 forced_signout
// ---------------------------------------------------------------------------

/// Request body for verify-password.
#[derive(Debug, Deserialize)]
pub struct VerifyPasswordRequest {
    pub password: String,
}

/// Soft limit: max failures within a 5-minute window before a 429.
const SOFT_FAIL_LIMIT: i16 = 5;
/// Hard limit: cumulative failures since last unlock before a forced sign-out.
const HARD_FAIL_LIMIT: i16 = 20;
/// Soft window duration in seconds (5 minutes).
const SOFT_WINDOW_SECS: i64 = 300;

pub async fn verify_password_unlock(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<VerifyPasswordRequest>,
) -> IoResult<Response> {
    // --- 1. Extract user_id from x-io-user-id injected by the gateway ---
    let user_id_str = headers
        .get("x-io-user-id")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    let user_id: uuid::Uuid = user_id_str.parse().map_err(|_| IoError::Unauthorized)?;

    let ip = extract_client_ip(&headers);

    // --- 2. Fetch user record ---
    let user_row = sqlx::query(
        "SELECT password_hash, auth_provider
         FROM users
         WHERE id = $1 AND deleted_at IS NULL",
    )
    .bind(user_id)
    .fetch_optional(&state.db)
    .await?;

    let user_row = user_row.ok_or(IoError::Unauthorized)?;
    let password_hash: Option<String> = user_row.get("password_hash");
    let auth_provider: String = user_row.get("auth_provider");

    // --- 3. SSO-only accounts have no local password ---
    if password_hash.is_none() || auth_provider != "local" {
        return Ok((
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({ "error": "no_local_password" })),
        )
            .into_response());
    }

    let hash = password_hash.as_deref().expect("password_hash is Some: checked above");

    // --- 4. Find the active session for this user/ip to read rate-limit counters ---
    // We match on the most-recently-created non-revoked session for this user.
    // If no session exists (e.g. token was valid but session row is gone), we
    // still allow the password check — just with no persistent counter storage.
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

    // --- 4a. Check rate-limit counters ---
    if let Some(ref s) = session_row {
        let session_id: uuid::Uuid = s.get("id");
        let soft_count: i16 = s.get("unlock_fail_count_soft");
        let window_start: Option<chrono::DateTime<Utc>> = s.get("unlock_fail_window_start");
        let hard_count: i16 = s.get("unlock_fail_count_hard");

        // Soft limit: count failures within the rolling 5-minute window.
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

        // Hard limit: cumulative failures since last successful unlock.
        if hard_count >= HARD_FAIL_LIMIT {
            // Revoke the session to force sign-out.
            sqlx::query(
                "UPDATE user_sessions SET revoked_at = NOW(), revoked_reason = 'unlock_hard_limit'
                 WHERE id = $1",
            )
            .bind(session_id)
            .execute(&state.db)
            .await?;

            warn!(
                user_id = %user_id,
                "Hard unlock limit reached — session revoked"
            );

            return Ok((
                StatusCode::UNAUTHORIZED,
                Json(serde_json::json!({ "error": "forced_signout" })),
            )
                .into_response());
        }
    }

    // --- 5. Verify password ---
    let valid =
        verify_password(&req.password, hash).map_err(|e| IoError::Internal(e.to_string()))?;

    if !valid {
        // Increment failure counters in the session row.
        if let Some(ref s) = session_row {
            let session_id: uuid::Uuid = s.get("id");
            let soft_count: i16 = s.get("unlock_fail_count_soft");
            let window_start: Option<chrono::DateTime<Utc>> = s.get("unlock_fail_window_start");
            let hard_count: i16 = s.get("unlock_fail_count_hard");

            let window_active = window_start
                .map(|ws| (Utc::now() - ws).num_seconds() < SOFT_WINDOW_SECS)
                .unwrap_or(false);

            let (new_soft, new_window_start) = if window_active {
                (soft_count + 1, window_start)
            } else {
                // Start a new soft window.
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
                "reason" => "bad_password",
            )
            .increment(1);

            warn!(
                user_id = %user_id,
                soft_count = new_soft,
                hard_count = new_hard,
                "Failed unlock attempt",
            );

            return Ok((
                StatusCode::UNAUTHORIZED,
                Json(serde_json::json!({
                    "error": "invalid_password",
                    "soft_remaining": soft_remaining,
                })),
            )
                .into_response());
        }

        // No session row — return generic 401 with no counter information.
        return Ok((
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({
                "error": "invalid_password",
                "soft_remaining": SOFT_FAIL_LIMIT,
            })),
        )
            .into_response());
    }

    // --- 6. Correct password — reset counters, clear locked_since, record timestamp ---
    if let Some(ref s) = session_row {
        let session_id: uuid::Uuid = s.get("id");

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

        // Publish session.unlocked event to data broker (best-effort).
        publish_session_event(&state, "session.unlocked", user_id, session_id).await;
    }

    info!(user_id = %user_id, ip = %ip, "Successful lock screen unlock");

    metrics::counter!(
        "io_unlock_successes_total",
        "method" => "password",
    )
    .increment(1);

    crate::audit::log_event(
        &state.db,
        "user_sessions",
        "UNLOCK_SUCCESS",
        Some(user_id),
        Some(user_id),
        serde_json::json!({ "ip": ip, "method": "password" }),
    )
    .await;

    Ok((StatusCode::OK, Json(serde_json::json!({ "success": true }))).into_response())
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Fetch all permissions for a user via their role assignments.
pub async fn fetch_user_permissions(db: &io_db::DbPool, user_id: Uuid) -> IoResult<Vec<String>> {
    let rows = sqlx::query(
        "SELECT DISTINCT p.name
         FROM permissions p
         JOIN role_permissions rp ON rp.permission_id = p.id
         JOIN user_roles ur ON ur.role_id = rp.role_id
         WHERE ur.user_id = $1
         ORDER BY p.name",
    )
    .bind(user_id)
    .fetch_all(db)
    .await?;

    Ok(rows
        .into_iter()
        .map(|r| r.get::<String, _>("name"))
        .collect())
}

/// Enforce max concurrent sessions. Revokes oldest sessions if limit exceeded.
async fn enforce_session_limit(db: &io_db::DbPool, user_id: Uuid, max: u32) -> IoResult<()> {
    let rows = sqlx::query(
        "SELECT id FROM user_sessions
         WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > NOW()
         ORDER BY created_at ASC",
    )
    .bind(user_id)
    .fetch_all(db)
    .await?;

    if rows.len() >= max as usize {
        let excess = rows.len() - max as usize + 1;
        for row in rows.iter().take(excess) {
            let id: Uuid = row.get("id");
            sqlx::query(
                "UPDATE user_sessions SET revoked_at = NOW(), revoked_reason = 'session_limit'
                 WHERE id = $1",
            )
            .bind(id)
            .execute(db)
            .await?;
        }
    }
    Ok(())
}

/// Extract the `refresh_token` cookie value from request headers.
fn extract_refresh_cookie(headers: &HeaderMap) -> Option<String> {
    let cookie_header = headers.get(header::COOKIE)?.to_str().ok()?;
    cookie_header.split(';').find_map(|s| {
        let s = s.trim();
        s.strip_prefix("refresh_token=").map(|v| v.to_string())
    })
}

/// Extract client IP from `X-Forwarded-For` or `X-Real-IP`, falling back to "unknown".
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

/// SHA-256 hex digest of a string.
fn sha256_hex(input: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(input.as_bytes());
    format!("{:x}", hasher.finalize())
}
