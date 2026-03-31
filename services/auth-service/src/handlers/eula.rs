use axum::{
    extract::{Path, Query, State},
    http::{header, HeaderMap, StatusCode},
    response::IntoResponse,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sqlx::Row;
use uuid::Uuid;

use io_auth::{build_claims, generate_access_token};
use io_error::IoError;
use io_models::ApiResponse;

use crate::state::AppState;

// ---------------------------------------------------------------------------
// Request / response types
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Clone)]
pub struct EulaVersion {
    pub id: Uuid,
    pub eula_type: String,
    pub version: String,
    pub title: String,
    pub content: String,
    pub published_at: Option<DateTime<Utc>>,
}

/// One item in the list of EULAs a user still needs to accept.
#[derive(Debug, Serialize)]
pub struct EulaPendingItem {
    pub eula_type: String,
    pub id: Uuid,
    pub version: String,
    pub title: String,
    pub content: String,
    pub published_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize)]
pub struct EulaStatus {
    pub accepted: bool,
    pub accepted_at: Option<DateTime<Utc>>,
    pub version: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct AcceptEulaBody {
    /// The EULA version string (e.g. "1.1").
    pub version: String,
    /// The EULA type being accepted: "installer" or "end_user".
    /// Defaults to "end_user" if omitted for backwards compatibility.
    #[serde(default = "default_eula_type")]
    pub eula_type: String,
    /// Context: how the acceptance was triggered.
    /// Defaults to "login" if omitted.
    #[serde(default = "default_context")]
    pub acceptance_context: String,
}

fn default_eula_type() -> String {
    "end_user".to_string()
}
fn default_context() -> String {
    "login".to_string()
}

#[derive(Debug, Deserialize)]
pub struct EulaTypeQuery {
    #[serde(rename = "type", default = "default_eula_type")]
    pub eula_type: String,
}

// ---------------------------------------------------------------------------
// Helpers — extract headers injected by the API gateway after JWT validation
// ---------------------------------------------------------------------------

fn extract_user_id(headers: &HeaderMap) -> Option<Uuid> {
    headers
        .get("x-io-user-id")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| Uuid::parse_str(s).ok())
}

fn extract_header_str<'a>(headers: &'a HeaderMap, name: &str) -> &'a str {
    headers
        .get(name)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
}

fn has_permission(headers: &HeaderMap, required: &str) -> bool {
    headers
        .get("x-io-permissions")
        .and_then(|v| v.to_str().ok())
        .map(|perms| {
            perms.split(',').any(|p| {
                let p = p.trim();
                p == required || p == "*"
            })
        })
        .unwrap_or(false)
}

fn is_admin(headers: &HeaderMap) -> bool {
    has_permission(headers, "system:configure")
}

// ---------------------------------------------------------------------------
// Helper — compute SHA-256 hex digest
// ---------------------------------------------------------------------------

pub fn sha256_hex(input: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(input.as_bytes());
    format!("{:x}", hasher.finalize())
}

// ---------------------------------------------------------------------------
// GET /auth/eula/pending
//
// Returns the list of EULA documents the authenticated user still needs to
// accept, in the order they should be presented:
//
//   1. installer EULA — only for admins, only when no admin has yet accepted
//      the current installer EULA version (post-install / post-upgrade gate)
//   2. end_user EULA — for all users, when they have not accepted the current
//      active end_user version
//
// An empty array means the user has nothing pending and can proceed.
// ---------------------------------------------------------------------------

pub async fn get_pending_eulas(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let user_id = match extract_user_id(&headers) {
        Some(id) => id,
        None => return IoError::Unauthorized.into_response(),
    };

    let mut pending: Vec<EulaPendingItem> = Vec::new();

    // ── 1. Installer EULA (admins only) ─────────────────────────────────────
    if is_admin(&headers) {
        // What is the current active installer EULA version?
        let installer_row = sqlx::query(
            "SELECT id, eula_type, version, title, content, published_at
             FROM eula_versions
             WHERE eula_type = 'installer' AND is_active = true
             LIMIT 1",
        )
        .fetch_optional(&state.db)
        .await;

        if let Ok(Some(row)) = installer_row {
            let inst_version: String = row.try_get("version").unwrap_or_default();

            // What version has an admin already accepted?
            let accepted_setting = sqlx::query(
                "SELECT value FROM settings
                 WHERE key = 'installer_eula_admin_accepted_version'",
            )
            .fetch_optional(&state.db)
            .await;

            let admin_accepted_version: String = match accepted_setting {
                Ok(Some(r)) => {
                    let v: serde_json::Value =
                        r.try_get("value").unwrap_or(serde_json::Value::Null);
                    v.as_str().unwrap_or("").to_string()
                }
                _ => String::new(),
            };

            if admin_accepted_version != inst_version {
                pending.push(EulaPendingItem {
                    eula_type: "installer".to_string(),
                    id: row.try_get("id").unwrap_or_else(|_| Uuid::nil()),
                    version: inst_version,
                    title: row.try_get("title").unwrap_or_default(),
                    content: row.try_get("content").unwrap_or_default(),
                    published_at: row.try_get("published_at").ok(),
                });
            }
        }
    }

    // ── 2. End-user EULA (all users) ────────────────────────────────────────
    let end_user_row = sqlx::query(
        r#"
        SELECT ev.id, ev.eula_type, ev.version, ev.title, ev.content, ev.published_at
        FROM eula_versions ev
        WHERE ev.eula_type = 'end_user' AND ev.is_active = true
          AND NOT EXISTS (
              SELECT 1 FROM eula_acceptances ea
              WHERE ea.user_id = $1
                AND ea.eula_version_id = ev.id
          )
        LIMIT 1
        "#,
    )
    .bind(user_id)
    .fetch_optional(&state.db)
    .await;

    if let Ok(Some(row)) = end_user_row {
        pending.push(EulaPendingItem {
            eula_type: "end_user".to_string(),
            id: row.try_get("id").unwrap_or_else(|_| Uuid::nil()),
            version: row.try_get("version").unwrap_or_default(),
            title: row.try_get("title").unwrap_or_default(),
            content: row.try_get("content").unwrap_or_default(),
            published_at: row.try_get("published_at").ok(),
        });
    }

    Json(ApiResponse::ok(pending)).into_response()
}

// ---------------------------------------------------------------------------
// GET /auth/eula/current?type=end_user|installer
// Returns the active EULA of the requested type (default: end_user).
// ---------------------------------------------------------------------------

pub async fn get_current_eula(
    State(state): State<AppState>,
    Query(params): Query<EulaTypeQuery>,
) -> impl IntoResponse {
    let row = sqlx::query(
        "SELECT id, eula_type, version, title, content, published_at
         FROM eula_versions
         WHERE eula_type = $1 AND is_active = true
         LIMIT 1",
    )
    .bind(&params.eula_type)
    .fetch_optional(&state.db)
    .await;

    match row {
        Ok(Some(r)) => {
            let eula = EulaVersion {
                id: r.try_get("id").unwrap_or_else(|_| Uuid::nil()),
                eula_type: r
                    .try_get::<String, _>("eula_type")
                    .unwrap_or_else(|_| "end_user".to_string()),
                version: r.try_get::<String, _>("version").unwrap_or_default(),
                title: r
                    .try_get::<String, _>("title")
                    .unwrap_or_else(|_| "End User License Agreement".to_string()),
                content: r.try_get::<String, _>("content").unwrap_or_default(),
                published_at: r.try_get("published_at").ok(),
            };
            Json(ApiResponse::ok(eula)).into_response()
        }
        _ => {
            IoError::NotFound(format!("No active {} EULA found", params.eula_type)).into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// POST /auth/eula/accept
// Records that the authenticated user accepted a specific EULA version.
// Computes a chained tamper-evident hash row for the audit log.
// ---------------------------------------------------------------------------

pub async fn accept_eula(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<AcceptEulaBody>,
) -> impl IntoResponse {
    let user_id = match extract_user_id(&headers) {
        Some(id) => id,
        None => return IoError::Unauthorized.into_response(),
    };

    if body.version.trim().is_empty() {
        return IoError::BadRequest("version is required".into()).into_response();
    }

    let valid_types = ["installer", "end_user"];
    if !valid_types.contains(&body.eula_type.as_str()) {
        return IoError::BadRequest("eula_type must be 'installer' or 'end_user'".into())
            .into_response();
    }

    let valid_contexts = ["installer", "installer_admin", "login", "version_update"];
    if !valid_contexts.contains(&body.acceptance_context.as_str()) {
        return IoError::BadRequest("invalid acceptance_context".into()).into_response();
    }

    // Look up the active EULA version
    let version_row = sqlx::query(
        "SELECT id, content_hash FROM eula_versions
         WHERE eula_type = $1 AND version = $2 AND is_active = true
         LIMIT 1",
    )
    .bind(&body.eula_type)
    .bind(&body.version)
    .fetch_optional(&state.db)
    .await;

    let (version_id, content_hash) = match version_row {
        Ok(Some(r)) => {
            let vid: Uuid = r.try_get("id").unwrap_or_else(|_| Uuid::nil());
            let ch: String = r.try_get::<String, _>("content_hash").unwrap_or_default();
            (vid, ch)
        }
        Ok(None) => {
            tracing::warn!(eula_type = %body.eula_type, version = %body.version,
                "accept_eula: version not found or not active");
            return IoError::NotFound(format!(
                "EULA {} v'{}' not found or not active",
                body.eula_type, body.version
            ))
            .into_response();
        }
        Err(e) => {
            tracing::error!(error = %e, "accept_eula: version lookup failed");
            return IoError::Database(e).into_response();
        }
    };

    let user_agent = extract_header_str(&headers, "user-agent");
    let forwarded = extract_header_str(&headers, "x-forwarded-for");
    let client_ip = if forwarded.is_empty() {
        "127.0.0.1"
    } else {
        forwarded
    };
    let username = extract_header_str(&headers, "x-io-username");
    let role = extract_header_str(&headers, "x-user-role");
    let email = extract_header_str(&headers, "x-io-email");
    let display_name = extract_header_str(&headers, "x-io-display-name");

    let role_str = if role.is_empty() { "operator" } else { role };
    let username_str = if username.is_empty() {
        "unknown"
    } else {
        username
    };
    let email_str = if email.is_empty() { "" } else { email };
    let name_str = if display_name.is_empty() {
        ""
    } else {
        display_name
    };

    // Fetch the row_hash of the most recent acceptance for chain continuity
    let prev_row = sqlx::query(
        "SELECT row_hash FROM eula_acceptances
         ORDER BY accepted_at DESC
         LIMIT 1",
    )
    .fetch_optional(&state.db)
    .await;

    let previous_hash: Option<String> = prev_row
        .ok()
        .flatten()
        .and_then(|r| r.try_get::<Option<String>, _>("row_hash").ok().flatten());

    // Generate receipt token (UUID v4)
    let receipt_token = Uuid::new_v4();

    // Pre-compute row_hash (all key fields except row_hash itself)
    let accepted_at_str = Utc::now().to_rfc3339();
    let row_hash = sha256_hex(&format!(
        "{user_id}|{version_id}|{accepted_at_str}|{client_ip}|{role_str}|\
         {username_str}|{email_str}|{name_str}|{content_hash}|\
         {receipt_token}|{}|{}",
        body.acceptance_context,
        previous_hash.as_deref().unwrap_or("")
    ));

    let result = sqlx::query(
        r#"
        INSERT INTO eula_acceptances (
            user_id, eula_version_id,
            accepted_from_ip, accepted_as_role,
            username_snapshot, user_agent, content_hash,
            receipt_token, acceptance_context,
            user_email_snapshot, user_display_name_snapshot,
            previous_hash, row_hash
        )
        SELECT $1, $2, $3::inet, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
        WHERE NOT EXISTS (
            SELECT 1 FROM eula_acceptances
            WHERE user_id = $1 AND eula_version_id = $2
        )
        "#,
    )
    .bind(user_id)
    .bind(version_id)
    .bind(client_ip)
    .bind(role_str)
    .bind(username_str)
    .bind(user_agent)
    .bind(&content_hash)
    .bind(receipt_token)
    .bind(&body.acceptance_context)
    .bind(email_str)
    .bind(name_str)
    .bind(&previous_hash)
    .bind(&row_hash)
    .execute(&state.db)
    .await;

    match result {
        Ok(_) => {
            // Mirror onto users table for fast login-time check
            let _ = sqlx::query(
                "UPDATE users SET eula_accepted = true, eula_accepted_at = NOW() WHERE id = $1",
            )
            .bind(user_id)
            .execute(&state.db)
            .await;

            // If this is an installer_admin acceptance, record in system settings
            // so subsequent admin logins know the current installer EULA was accepted
            if body.acceptance_context == "installer_admin" || body.eula_type == "installer" {
                let _ = sqlx::query(
                    "UPDATE settings SET value = $1 WHERE key = 'installer_eula_admin_accepted_version'",
                )
                .bind(serde_json::json!(body.version))
                .execute(&state.db)
                .await;
            }

            tracing::info!(
                user_id = %user_id,
                eula_type = %body.eula_type,
                version = %body.version,
                receipt_token = %receipt_token,
                "EULA accepted"
            );

            Json(ApiResponse::ok(serde_json::json!({
                "accepted": true,
                "receipt_token": receipt_token,
            })))
            .into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "accept_eula insert failed");
            IoError::Database(e).into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// POST /auth/eula/accept-pending
//
// Called immediately after the EULA is presented to the user during the login
// flow (when the normal login response returned `eula_required`).
//
// Does NOT require a JWT — the caller presents the short-lived `eula_pending_token`
// that was issued by the login handler.  On success, records EULA acceptance
// and issues the real JWT access + refresh tokens, completing the login.
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct AcceptEulaPendingBody {
    /// The short-lived token returned in the `eula_required` login response.
    pub eula_pending_token: String,
    /// The EULA version being accepted.
    pub version: String,
    /// Context — always "login" for this flow.
    #[serde(default = "default_context")]
    pub acceptance_context: String,
}

pub async fn accept_eula_pending(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<AcceptEulaPendingBody>,
) -> impl IntoResponse {
    // --- 1. Validate the pending token ---
    let entry = {
        match state.eula_pending_tokens.get(&body.eula_pending_token) {
            Some(e) => e.clone(),
            None => {
                return (
                    StatusCode::UNAUTHORIZED,
                    Json(serde_json::json!({"error": "invalid_or_expired_token"})),
                )
                    .into_response()
            }
        }
    };

    if entry.used {
        // Single-use: reject
        state.eula_pending_tokens.remove(&body.eula_pending_token);
        return (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({"error": "token_already_used"})),
        )
            .into_response();
    }

    if entry.expires_at < Utc::now() {
        state.eula_pending_tokens.remove(&body.eula_pending_token);
        return (
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({"error": "token_expired"})),
        )
            .into_response();
    }

    let user_id = entry.user_id;

    // Mark the token used atomically
    if let Some(mut e) = state.eula_pending_tokens.get_mut(&body.eula_pending_token) {
        e.used = true;
    }

    // Remove the token (single-use)
    state.eula_pending_tokens.remove(&body.eula_pending_token);

    // --- 2. Record EULA acceptance (same logic as accept_eula) ---
    let version = body.version.trim().to_string();
    if version.is_empty() {
        return IoError::BadRequest("version is required".into()).into_response();
    }

    let version_row = sqlx::query(
        "SELECT id, content_hash FROM eula_versions
         WHERE eula_type = 'end_user' AND version = $1 AND is_active = true
         LIMIT 1",
    )
    .bind(&version)
    .fetch_optional(&state.db)
    .await;

    let (version_id, content_hash) = match version_row {
        Ok(Some(r)) => {
            let vid: Uuid = r.try_get("id").unwrap_or_else(|_| Uuid::nil());
            let ch: String = r.try_get::<String, _>("content_hash").unwrap_or_default();
            (vid, ch)
        }
        Ok(None) => {
            tracing::warn!(version = %version, "accept_eula_pending: EULA version not found or not active");
            return IoError::NotFound(format!("EULA v'{}' not found or not active", version))
                .into_response();
        }
        Err(e) => {
            tracing::error!(error = %e, "accept_eula_pending: version lookup failed");
            return IoError::Database(e).into_response();
        }
    };

    // Get user info for snapshot fields
    let user_row = sqlx::query(
        "SELECT username, email, full_name FROM users WHERE id = $1 AND enabled = true AND deleted_at IS NULL",
    )
    .bind(user_id)
    .fetch_optional(&state.db)
    .await;

    let (username, email, _full_name) = match user_row {
        Ok(Some(r)) => (
            r.try_get::<String, _>("username").unwrap_or_default(),
            r.try_get::<String, _>("email").unwrap_or_default(),
            r.try_get::<Option<String>, _>("full_name").ok().flatten(),
        ),
        _ => {
            tracing::warn!(user_id = %user_id, "accept_eula_pending: user not found or disabled");
            return IoError::Unauthorized.into_response();
        }
    };

    let user_agent: String = headers
        .get(header::USER_AGENT)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("unknown")
        .chars()
        .take(512)
        .collect();

    let forwarded = headers
        .get("x-forwarded-for")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.split(',').next())
        .or_else(|| headers.get("x-real-ip").and_then(|v| v.to_str().ok()))
        .unwrap_or("127.0.0.1")
        .trim()
        .to_string();

    // Fetch prior hash for chain continuity
    let prev_row =
        sqlx::query("SELECT row_hash FROM eula_acceptances ORDER BY accepted_at DESC LIMIT 1")
            .fetch_optional(&state.db)
            .await;

    let previous_hash: Option<String> = prev_row
        .ok()
        .flatten()
        .and_then(|r| r.try_get::<Option<String>, _>("row_hash").ok().flatten());

    let receipt_token = Uuid::new_v4();
    let accepted_at_str = Utc::now().to_rfc3339();
    let row_hash = sha256_hex(&format!(
        "{user_id}|{version_id}|{accepted_at_str}|{forwarded}|operator|\
         {username}|{email}||{content_hash}|\
         {receipt_token}|{}|{}",
        body.acceptance_context,
        previous_hash.as_deref().unwrap_or("")
    ));

    let insert_result = sqlx::query(
        r#"
        INSERT INTO eula_acceptances (
            user_id, eula_version_id,
            accepted_from_ip, accepted_as_role,
            username_snapshot, user_agent, content_hash,
            receipt_token, acceptance_context,
            user_email_snapshot, user_display_name_snapshot,
            previous_hash, row_hash
        )
        SELECT $1, $2, $3::inet, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13
        WHERE NOT EXISTS (
            SELECT 1 FROM eula_acceptances
            WHERE user_id = $1 AND eula_version_id = $2
        )
        "#,
    )
    .bind(user_id)
    .bind(version_id)
    .bind(&forwarded)
    .bind("operator")
    .bind(&username)
    .bind(&user_agent)
    .bind(&content_hash)
    .bind(receipt_token)
    .bind(&body.acceptance_context)
    .bind(&email)
    .bind("") // display_name_snapshot — not available without JWT
    .bind(&previous_hash)
    .bind(&row_hash)
    .execute(&state.db)
    .await;

    if let Err(e) = insert_result {
        tracing::error!(error = %e, "accept_eula_pending: insert failed");
        return IoError::Database(e).into_response();
    }

    // Mirror onto users table for fast login-time check
    let _ = sqlx::query(
        "UPDATE users SET eula_accepted = true, eula_accepted_at = NOW() WHERE id = $1",
    )
    .bind(user_id)
    .execute(&state.db)
    .await;

    tracing::info!(
        user_id = %user_id,
        version = %version,
        receipt_token = %receipt_token,
        "EULA accepted via pending token — login completing"
    );

    // --- 3. Issue JWT + refresh tokens (completing the login) ---
    let permissions = crate::handlers::auth::fetch_user_permissions(&state.db, user_id)
        .await
        .unwrap_or_default();

    let claims = build_claims(&user_id.to_string(), &username, permissions);
    let access_token = match generate_access_token(&claims, &state.config.jwt_secret) {
        Ok(t) => t,
        Err(e) => return IoError::Internal(e.to_string()).into_response(),
    };

    let refresh_token = Uuid::new_v4().to_string();
    let mut hasher = Sha256::new();
    hasher.update(refresh_token.as_bytes());
    let refresh_token_hash = format!("{:x}", hasher.finalize());

    let ttl_secs = state.config.refresh_token_ttl_secs as i64;
    let expires_at = Utc::now() + chrono::Duration::seconds(ttl_secs);

    let _ = sqlx::query(
        "INSERT INTO user_sessions
            (id, user_id, refresh_token_hash, expires_at, ip_address, user_agent)
         VALUES ($1, $2, $3, $4, $5::inet, $6)",
    )
    .bind(Uuid::new_v4())
    .bind(user_id)
    .bind(&refresh_token_hash)
    .bind(expires_at)
    .bind(&forwarded)
    .bind(&user_agent)
    .execute(&state.db)
    .await;

    let _ = sqlx::query(
        "UPDATE users SET last_login_at = NOW(), failed_login_count = 0, locked_until = NULL
         WHERE id = $1",
    )
    .bind(user_id)
    .execute(&state.db)
    .await;

    let body_resp = ApiResponse::ok(serde_json::json!({
        "access_token": access_token,
        "token_type": "Bearer",
        "expires_in": 900u64,
    }));

    let cookie = format!(
        "refresh_token={refresh_token}; HttpOnly; SameSite=Strict; Path=/api/auth; Max-Age={ttl_secs}"
    );

    let mut response = (StatusCode::OK, Json(body_resp)).into_response();
    if let Ok(cookie_val) = cookie.parse() {
        response
            .headers_mut()
            .insert(header::SET_COOKIE, cookie_val);
    }

    response
}

// ---------------------------------------------------------------------------
// GET /auth/eula/status — check end_user EULA acceptance for the current user
// (Legacy endpoint — prefer /auth/eula/pending for the full picture)
// ---------------------------------------------------------------------------

pub async fn eula_status(State(state): State<AppState>, headers: HeaderMap) -> impl IntoResponse {
    let user_id = match extract_user_id(&headers) {
        Some(id) => id,
        None => return IoError::Unauthorized.into_response(),
    };

    let row = sqlx::query(
        r#"
        SELECT ev.version, ea.accepted_at
        FROM eula_acceptances ea
        JOIN eula_versions ev ON ev.id = ea.eula_version_id
        WHERE ea.user_id = $1
          AND ev.eula_type = 'end_user'
          AND ev.is_active = true
        ORDER BY ea.accepted_at DESC
        LIMIT 1
        "#,
    )
    .bind(user_id)
    .fetch_optional(&state.db)
    .await;

    let status = match row {
        Ok(Some(r)) => EulaStatus {
            accepted: true,
            accepted_at: r.try_get("accepted_at").ok(),
            version: r.try_get::<Option<String>, _>("version").ok().flatten(),
        },
        Ok(None) => EulaStatus {
            accepted: false,
            accepted_at: None,
            version: None,
        },
        Err(e) => {
            tracing::error!(error = %e, "eula_status query failed");
            return IoError::Database(e).into_response();
        }
    };

    Json(ApiResponse::ok(status)).into_response()
}

// ---------------------------------------------------------------------------
// Admin types
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
pub struct EulaVersionAdmin {
    pub id: Uuid,
    pub eula_type: String,
    pub version: String,
    pub title: String,
    pub content: String,
    pub content_hash: String,
    pub is_active: bool,
    pub published_at: Option<DateTime<Utc>>,
    pub archived_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub published_by: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct CreateEulaVersionBody {
    pub eula_type: String,
    pub version: String,
    pub title: String,
    pub content: String,
}

#[derive(Debug, Serialize)]
pub struct EulaAcceptanceRecord {
    pub id: Uuid,
    pub user_id: Uuid,
    pub username: String,
    pub full_name: Option<String>,
    pub email: String,
    pub eula_type: String,
    pub eula_version: String,
    pub eula_version_id: Uuid,
    pub accepted_at: DateTime<Utc>,
    pub accepted_from_ip: String,
    pub accepted_as_role: String,
    pub acceptance_context: String,
    pub content_hash: String,
    pub receipt_token: Option<Uuid>,
}

#[derive(Debug, Deserialize)]
pub struct AcceptanceQueryParams {
    pub version_id: Option<Uuid>,
    pub eula_type: Option<String>,
    pub page: Option<i64>,
    pub per_page: Option<i64>,
}

// ---------------------------------------------------------------------------
// GET /auth/admin/eula/versions
// ---------------------------------------------------------------------------

pub async fn list_eula_versions(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> impl IntoResponse {
    if !has_permission(&headers, "system:configure") {
        return IoError::Forbidden("Requires system:configure permission".into()).into_response();
    }
    let rows = sqlx::query(
        "SELECT id, eula_type, version, title, content, content_hash, is_active,
                published_at, archived_at, created_at, published_by
         FROM eula_versions
         ORDER BY eula_type, created_at DESC",
    )
    .fetch_all(&state.db)
    .await;

    match rows {
        Ok(rows) => {
            let versions: Vec<EulaVersionAdmin> = rows
                .into_iter()
                .map(|r| EulaVersionAdmin {
                    id: r.try_get("id").unwrap_or_else(|_| Uuid::nil()),
                    eula_type: r.try_get::<String, _>("eula_type").unwrap_or_default(),
                    version: r.try_get::<String, _>("version").unwrap_or_default(),
                    title: r.try_get::<String, _>("title").unwrap_or_default(),
                    content: r.try_get::<String, _>("content").unwrap_or_default(),
                    content_hash: r.try_get::<String, _>("content_hash").unwrap_or_default(),
                    is_active: r.try_get::<bool, _>("is_active").unwrap_or(false),
                    published_at: r.try_get("published_at").ok(),
                    archived_at: r.try_get("archived_at").ok(),
                    created_at: r.try_get("created_at").unwrap_or_else(|_| Utc::now()),
                    published_by: r.try_get("published_by").ok(),
                })
                .collect();
            Json(ApiResponse::ok(versions)).into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "list_eula_versions query failed");
            IoError::Database(e).into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// POST /auth/admin/eula/versions — create a draft EULA version
// ---------------------------------------------------------------------------

pub async fn create_eula_version(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(body): Json<CreateEulaVersionBody>,
) -> impl IntoResponse {
    let admin_id = match extract_user_id(&headers) {
        Some(id) => id,
        None => return IoError::Unauthorized.into_response(),
    };
    if !has_permission(&headers, "system:configure") {
        return IoError::Forbidden("Requires system:configure permission".into()).into_response();
    }

    let valid_types = ["installer", "end_user"];
    if !valid_types.contains(&body.eula_type.as_str()) {
        return IoError::BadRequest("eula_type must be 'installer' or 'end_user'".into())
            .into_response();
    }
    if body.version.trim().is_empty() {
        return IoError::BadRequest("version is required".into()).into_response();
    }
    if body.title.trim().is_empty() {
        return IoError::BadRequest("title is required".into()).into_response();
    }
    if body.content.trim().is_empty() {
        return IoError::BadRequest("content is required".into()).into_response();
    }

    let content_hash = sha256_hex(&body.content);
    let new_id = Uuid::new_v4();

    let result = sqlx::query(
        "INSERT INTO eula_versions
            (id, eula_type, version, title, content, content_hash, is_active, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, false, $7)
         RETURNING id, eula_type, version, title, content, content_hash, is_active,
                   published_at, archived_at, created_at, published_by",
    )
    .bind(new_id)
    .bind(&body.eula_type)
    .bind(&body.version)
    .bind(&body.title)
    .bind(&body.content)
    .bind(&content_hash)
    .bind(admin_id)
    .fetch_one(&state.db)
    .await;

    match result {
        Ok(r) => {
            let version = EulaVersionAdmin {
                id: r.try_get("id").unwrap_or(new_id),
                eula_type: r.try_get::<String, _>("eula_type").unwrap_or_default(),
                version: r.try_get::<String, _>("version").unwrap_or_default(),
                title: r.try_get::<String, _>("title").unwrap_or_default(),
                content: r.try_get::<String, _>("content").unwrap_or_default(),
                content_hash: r.try_get::<String, _>("content_hash").unwrap_or_default(),
                is_active: r.try_get::<bool, _>("is_active").unwrap_or(false),
                published_at: r.try_get("published_at").ok(),
                archived_at: r.try_get("archived_at").ok(),
                created_at: r.try_get("created_at").unwrap_or_else(|_| Utc::now()),
                published_by: r.try_get("published_by").ok(),
            };
            Json(ApiResponse::ok(version)).into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "create_eula_version insert failed");
            IoError::Database(e).into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// POST /auth/admin/eula/versions/:id/publish
// Publishes a draft, deactivating the current active version of the same type.
// For end_user: resets all users to force re-acceptance.
// For installer: resets the admin-accepted setting to force post-install gate.
// ---------------------------------------------------------------------------

pub async fn publish_eula_version(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let admin_id = match extract_user_id(&headers) {
        Some(id) => id,
        None => return IoError::Unauthorized.into_response(),
    };
    if !has_permission(&headers, "system:configure") {
        return IoError::Forbidden("Requires system:configure permission".into()).into_response();
    }

    let mut tx = match state.db.begin().await {
        Ok(tx) => tx,
        Err(e) => return IoError::Database(e).into_response(),
    };

    // Get the eula_type of the version being published
    let type_row = sqlx::query("SELECT eula_type FROM eula_versions WHERE id = $1")
        .bind(id)
        .fetch_optional(&mut *tx)
        .await;

    let eula_type = match type_row {
        Ok(Some(r)) => r.try_get::<String, _>("eula_type").unwrap_or_default(),
        Ok(None) => {
            return IoError::NotFound(format!("EULA version {} not found", id)).into_response()
        }
        Err(e) => return IoError::Database(e).into_response(),
    };

    // Deactivate current active version of the same type only
    let _ = sqlx::query(
        "UPDATE eula_versions SET is_active = false
         WHERE eula_type = $1 AND is_active = true",
    )
    .bind(&eula_type)
    .execute(&mut *tx)
    .await;

    // Activate the target version
    let activate = sqlx::query(
        "UPDATE eula_versions
         SET is_active = true, published_at = NOW(), published_by = $1
         WHERE id = $2",
    )
    .bind(admin_id)
    .bind(id)
    .execute(&mut *tx)
    .await;

    match activate {
        Ok(res) if res.rows_affected() == 0 => {
            return IoError::NotFound(format!("EULA version {} not found", id)).into_response();
        }
        Err(e) => return IoError::Database(e).into_response(),
        Ok(_) => {}
    }

    // Type-specific side effects
    if eula_type == "end_user" {
        // Reset all enabled users to require re-acceptance
        let _ = sqlx::query(
            "UPDATE users SET eula_accepted = false, eula_accepted_at = NULL WHERE enabled = true",
        )
        .execute(&mut *tx)
        .await;
    } else if eula_type == "installer" {
        // Reset installer admin acceptance — triggers the post-install gate
        let _ = sqlx::query(
            "UPDATE settings SET value = '\"\"' WHERE key = 'installer_eula_admin_accepted_version'",
        )
        .execute(&mut *tx)
        .await;
    }

    if let Err(e) = tx.commit().await {
        tracing::error!(error = %e, "publish_eula_version: commit failed");
        return IoError::Database(e).into_response();
    }

    tracing::info!(
        admin_id = %admin_id,
        eula_version_id = %id,
        eula_type = %eula_type,
        "EULA version published"
    );

    Json(ApiResponse::ok(serde_json::json!({
        "published": true,
        "version_id": id,
        "eula_type": eula_type,
    })))
    .into_response()
}

// ---------------------------------------------------------------------------
// GET /auth/admin/eula/acceptances — paginated audit log
// ---------------------------------------------------------------------------

pub async fn list_eula_acceptances(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(params): Query<AcceptanceQueryParams>,
) -> impl IntoResponse {
    if !has_permission(&headers, "system:configure") {
        return IoError::Forbidden("Requires system:configure permission".into()).into_response();
    }
    let page = params.page.unwrap_or(1).max(1);
    let per_page = params.per_page.unwrap_or(50).clamp(1, 200);
    let offset = (page - 1) * per_page;

    let base_query = r#"
        SELECT ea.id, ea.user_id, u.username, u.full_name, u.email,
               ev.eula_type, ev.version AS eula_version, ea.eula_version_id,
               ea.accepted_at, ea.accepted_from_ip::TEXT AS accepted_from_ip,
               ea.accepted_as_role, ea.acceptance_context, ea.content_hash,
               ea.receipt_token
        FROM eula_acceptances ea
        JOIN users u ON u.id = ea.user_id
        JOIN eula_versions ev ON ev.id = ea.eula_version_id
    "#;

    let rows = match (params.version_id, params.eula_type.as_deref()) {
        (Some(vid), _) => {
            sqlx::query(&format!(
                "{base_query} WHERE ea.eula_version_id = $1 ORDER BY ea.accepted_at DESC LIMIT $2 OFFSET $3"
            ))
            .bind(vid).bind(per_page).bind(offset)
            .fetch_all(&state.db).await
        }
        (None, Some(et)) => {
            sqlx::query(&format!(
                "{base_query} WHERE ev.eula_type = $1 ORDER BY ea.accepted_at DESC LIMIT $2 OFFSET $3"
            ))
            .bind(et).bind(per_page).bind(offset)
            .fetch_all(&state.db).await
        }
        (None, None) => {
            sqlx::query(&format!(
                "{base_query} ORDER BY ea.accepted_at DESC LIMIT $1 OFFSET $2"
            ))
            .bind(per_page).bind(offset)
            .fetch_all(&state.db).await
        }
    };

    match rows {
        Ok(rows) => {
            let records: Vec<EulaAcceptanceRecord> = rows
                .into_iter()
                .map(|r| EulaAcceptanceRecord {
                    id: r.try_get("id").unwrap_or_else(|_| Uuid::nil()),
                    user_id: r.try_get("user_id").unwrap_or_else(|_| Uuid::nil()),
                    username: r.try_get::<String, _>("username").unwrap_or_default(),
                    full_name: r.try_get::<Option<String>, _>("full_name").ok().flatten(),
                    email: r.try_get::<String, _>("email").unwrap_or_default(),
                    eula_type: r.try_get::<String, _>("eula_type").unwrap_or_default(),
                    eula_version: r.try_get::<String, _>("eula_version").unwrap_or_default(),
                    eula_version_id: r.try_get("eula_version_id").unwrap_or_else(|_| Uuid::nil()),
                    accepted_at: r.try_get("accepted_at").unwrap_or_else(|_| Utc::now()),
                    accepted_from_ip: r
                        .try_get::<String, _>("accepted_from_ip")
                        .unwrap_or_default(),
                    accepted_as_role: r
                        .try_get::<String, _>("accepted_as_role")
                        .unwrap_or_default(),
                    acceptance_context: r
                        .try_get::<String, _>("acceptance_context")
                        .unwrap_or_default(),
                    content_hash: r.try_get::<String, _>("content_hash").unwrap_or_default(),
                    receipt_token: r.try_get("receipt_token").ok(),
                })
                .collect();
            Json(ApiResponse::ok(records)).into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "list_eula_acceptances query failed");
            IoError::Database(e).into_response()
        }
    }
}
