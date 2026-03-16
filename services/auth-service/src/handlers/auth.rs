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

use crate::state::AppState;

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
                locked_until, failed_login_count, auth_provider
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
            let _ = verify_password("dummy", "$argon2id$v=19$m=19456,t=2,p=1$fake/hash/placeholder==");
            return Err(IoError::BadRequest("Invalid username or password".to_string()));
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
            return Err(IoError::RateLimited { retry_after_secs: secs });
        }
    }

    // --- 4. Verify password ---
    let hash = match &password_hash {
        Some(h) => h.as_str(),
        None => {
            return Err(IoError::BadRequest("Invalid username or password".to_string()));
        }
    };

    let valid = verify_password(&req.password, hash)
        .map_err(|e| IoError::Internal(e.to_string()))?;

    if !valid {
        let new_count = failed_login_count + 1;
        if new_count >= state.config.max_failed_logins {
            let lockout_until = Utc::now()
                + chrono::Duration::seconds(state.config.lockout_duration_secs as i64);
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
        return Err(IoError::BadRequest("Invalid username or password".to_string()));
    }

    // --- 5. Collect permissions ---
    let permissions = fetch_user_permissions(&state.db, user_id).await?;

    // --- 6. Build JWT ---
    let claims = build_claims(&user_id.to_string(), &db_username, permissions);
    let access_token = generate_access_token(&claims, &state.config.jwt_secret)
        .map_err(|e| IoError::Internal(e.to_string()))?;

    // --- 7. Generate refresh token, enforce session limit ---
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

    // --- 10. Check current EULA acceptance ---
    let eula_accepted: bool = sqlx::query(
        "SELECT EXISTS (
            SELECT 1 FROM eula_acceptances ea
            JOIN eula_versions ev ON ev.id = ea.eula_version_id
            WHERE ea.user_id = $1 AND ev.is_active = true
        ) AS eula_accepted",
    )
    .bind(user_id)
    .fetch_optional(&state.db)
    .await
    .ok()
    .flatten()
    .and_then(|r| r.try_get::<bool, _>("eula_accepted").ok())
    .unwrap_or(false);

    // --- 11. Build response ---
    let body = ApiResponse::ok(LoginResponse {
        access_token,
        token_type: "Bearer".to_string(),
        expires_in: 900, // 15 minutes
        user: UserSummary { id: user_id, username: db_username, full_name, email, eula_accepted },
    });

    let cookie = format!(
        "refresh_token={refresh_token}; HttpOnly; SameSite=Strict; Path=/api/auth; Max-Age={ttl_secs}"
    );

    let mut response = (StatusCode::OK, Json(body)).into_response();
    response.headers_mut().insert(
        header::SET_COOKIE,
        cookie.parse().map_err(|_| IoError::Internal("cookie encoding error".to_string()))?,
    );
    Ok(response)
}

// ---------------------------------------------------------------------------
// POST /auth/refresh
// Rotates the refresh token. Old token is revoked, new one issued.
// ---------------------------------------------------------------------------

pub async fn refresh(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> IoResult<Response> {
    let refresh_token = extract_refresh_cookie(&headers)
        .ok_or_else(|| IoError::Unauthorized)?;

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
    let user_row = sqlx::query(
        "SELECT username, enabled FROM users WHERE id = $1 AND deleted_at IS NULL",
    )
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

    sqlx::query("UPDATE user_sessions SET revoked_at = NOW(), revoked_reason = 'rotated' WHERE id = $1")
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
        cookie.parse().map_err(|_| IoError::Internal("cookie error".to_string()))?,
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
        clear_cookie.parse().map_err(|_| IoError::Internal("cookie error".to_string()))?,
    );
    Ok(response)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Fetch all permissions for a user via their role assignments.
pub async fn fetch_user_permissions(
    db: &io_db::DbPool,
    user_id: Uuid,
) -> IoResult<Vec<String>> {
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

    Ok(rows.into_iter().map(|r| r.get::<String, _>("name")).collect())
}

/// Enforce max concurrent sessions. Revokes oldest sessions if limit exceeded.
async fn enforce_session_limit(
    db: &io_db::DbPool,
    user_id: Uuid,
    max: u32,
) -> IoResult<()> {
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
