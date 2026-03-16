use axum::{
    extract::{Path, Query, State},
    http::HeaderMap,
    response::IntoResponse,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sqlx::Row;
use uuid::Uuid;

use io_error::IoError;
use io_models::ApiResponse;

use crate::state::AppState;

// ---------------------------------------------------------------------------
// Request / response types
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
pub struct EulaVersion {
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
    /// The EULA version string (e.g. "1.0") the user is accepting.
    pub version: String,
}

// ---------------------------------------------------------------------------
// Helper — extract user_id from service-internal X-User-Id header
// (set by the API gateway after JWT validation)
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

/// Returns true if the caller has the given permission (or the wildcard "*").
/// Reads from the `x-io-permissions` header injected by the API gateway.
fn has_permission(headers: &HeaderMap, required: &str) -> bool {
    headers
        .get("x-io-permissions")
        .and_then(|v| v.to_str().ok())
        .map(|perms| perms.split(',').any(|p| {
            let p = p.trim();
            p == required || p == "*"
        }))
        .unwrap_or(false)
}

// ---------------------------------------------------------------------------
// GET /auth/eula/current — return the active EULA version and text
// ---------------------------------------------------------------------------

pub async fn get_current_eula(
    State(state): State<AppState>,
) -> impl IntoResponse {
    let row = sqlx::query(
        "SELECT id, version, title, content, published_at \
         FROM eula_versions WHERE is_active = true LIMIT 1",
    )
    .fetch_optional(&state.db)
    .await;

    match row {
        Ok(Some(r)) => {
            let eula = EulaVersion {
                id: r.try_get("id").unwrap_or_else(|_| Uuid::nil()),
                version: r.try_get::<String, _>("version").unwrap_or_else(|_| "1.0".to_string()),
                title: r.try_get::<String, _>("title").unwrap_or_else(|_| "End User License Agreement".to_string()),
                content: r.try_get::<String, _>("content").unwrap_or_else(|_| "By using Inside/Operations you agree to the terms of service.".to_string()),
                published_at: r.try_get("published_at").ok(),
            };
            Json(ApiResponse::ok(eula)).into_response()
        }
        _ => {
            // No active EULA in DB yet — return a placeholder so the UI always gets a response.
            let eula = EulaVersion {
                id: Uuid::nil(),
                version: "1.0".to_string(),
                title: "End User License Agreement".to_string(),
                content: "By using Inside/Operations you agree to the terms of service.".to_string(),
                published_at: None,
            };
            Json(ApiResponse::ok(eula)).into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// POST /auth/eula/accept — record that the authenticated user accepted the EULA
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

    // Look up the active eula_version row to get its UUID and content_hash.
    // Only the currently active version can be accepted — reject stale version strings.
    let version_row = sqlx::query(
        "SELECT id, content_hash FROM eula_versions WHERE version = $1 AND is_active = true LIMIT 1",
    )
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
            tracing::warn!(version = %body.version, "accept_eula: version not found in eula_versions");
            return IoError::NotFound(format!("EULA version '{}' not found", body.version)).into_response();
        }
        Err(e) => {
            tracing::error!(error = %e, "accept_eula: version lookup failed");
            return IoError::Database(e).into_response();
        }
    };

    // Collect optional context from headers injected by the gateway.
    let user_agent = extract_header_str(&headers, "user-agent");
    let forwarded_ip = extract_header_str(&headers, "x-forwarded-for");
    let client_ip = if forwarded_ip.is_empty() { "127.0.0.1" } else { forwarded_ip };

    let username = extract_header_str(&headers, "x-io-username");
    let role = extract_header_str(&headers, "x-user-role");
    let role_str = if role.is_empty() { "operator" } else { role };
    let username_str = if username.is_empty() { "unknown" } else { username };

    let result = sqlx::query(
        r#"
        INSERT INTO eula_acceptances
            (user_id, eula_version_id, accepted_from_ip, accepted_as_role,
             username_snapshot, user_agent, content_hash)
        SELECT $1, $2, $3::inet, $4, $5, $6, $7
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
    .execute(&state.db)
    .await;

    match result {
        Ok(_) => {
            // Mirror acceptance onto the users table for fast login-time checks.
            let _ = sqlx::query(
                "UPDATE users SET eula_accepted = true, eula_accepted_at = NOW() WHERE id = $1",
            )
            .bind(user_id)
            .execute(&state.db)
            .await;

            Json(ApiResponse::ok(serde_json::json!({ "accepted": true }))).into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "accept_eula insert failed");
            IoError::Database(e).into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// GET /auth/eula/status — check whether the authenticated user has accepted
// the currently active EULA version
// ---------------------------------------------------------------------------

pub async fn eula_status(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> impl IntoResponse {
    let user_id = match extract_user_id(&headers) {
        Some(id) => id,
        None => return IoError::Unauthorized.into_response(),
    };

    // Must check against the currently active version only.
    // Without ev.is_active = true, a user who accepted an old version would
    // appear accepted after a new version is published.
    let row = sqlx::query(
        r#"
        SELECT ev.version, ea.accepted_at
        FROM eula_acceptances ea
        JOIN eula_versions ev ON ev.id = ea.eula_version_id
        WHERE ea.user_id = $1 AND ev.is_active = true
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
// Admin request / response types
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
pub struct EulaVersionAdmin {
    pub id: Uuid,
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
    pub eula_version: String,
    pub eula_version_id: Uuid,
    pub accepted_at: DateTime<Utc>,
    pub accepted_from_ip: String,
    pub accepted_as_role: String,
    pub content_hash: String,
}

#[derive(Debug, Deserialize)]
pub struct AcceptanceQueryParams {
    pub version_id: Option<Uuid>,
    pub page: Option<i64>,
    pub per_page: Option<i64>,
}

// ---------------------------------------------------------------------------
// Helper: compute SHA-256 hex digest of a string
// ---------------------------------------------------------------------------

pub fn sha256_hex(input: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(input.as_bytes());
    format!("{:x}", hasher.finalize())
}

// ---------------------------------------------------------------------------
// GET /auth/admin/eula/versions — list all EULA versions (active, draft, archived)
// ---------------------------------------------------------------------------

pub async fn list_eula_versions(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> impl IntoResponse {
    if !has_permission(&headers, "system:configure") {
        return IoError::Forbidden("Requires system:configure permission".into()).into_response();
    }
    let rows = sqlx::query(
        "SELECT id, version, title, content, content_hash, is_active,
                published_at, archived_at, created_at, published_by
         FROM eula_versions
         ORDER BY created_at DESC",
    )
    .fetch_all(&state.db)
    .await;

    match rows {
        Ok(rows) => {
            let versions: Vec<EulaVersionAdmin> = rows
                .into_iter()
                .map(|r| EulaVersionAdmin {
                    id: r.try_get("id").unwrap_or_else(|_| Uuid::nil()),
                    version: r.try_get::<String, _>("version").unwrap_or_default(),
                    title: r.try_get::<String, _>("title").unwrap_or_default(),
                    content: r.try_get::<String, _>("content").unwrap_or_default(),
                    content_hash: r.try_get::<String, _>("content_hash").unwrap_or_default(),
                    is_active: r.try_get::<bool, _>("is_active").unwrap_or(false),
                    published_at: r.try_get("published_at").ok(),
                    archived_at: r.try_get("archived_at").ok(),
                    created_at: r
                        .try_get("created_at")
                        .unwrap_or_else(|_| Utc::now()),
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
// POST /auth/admin/eula/versions — create a new draft EULA version
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
            (id, version, title, content, content_hash, is_active, created_by)
         VALUES ($1, $2, $3, $4, $5, false, $6)
         RETURNING id, version, title, content, content_hash, is_active,
                   published_at, archived_at, created_at, published_by",
    )
    .bind(new_id)
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
// Publishes a draft version, deactivating the current active one.
// All users are reset to eula_accepted = false to force re-acceptance.
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

    let mut tx = match state.db.begin().await {
        Ok(tx) => tx,
        Err(e) => return IoError::Database(e).into_response(),
    };

    // 1. Deactivate any currently active version
    let deactivate = sqlx::query(
        "UPDATE eula_versions SET is_active = false WHERE is_active = true",
    )
    .execute(&mut *tx)
    .await;

    if let Err(e) = deactivate {
        tracing::error!(error = %e, "publish_eula_version: deactivate failed");
        return IoError::Database(e).into_response();
    }

    // 2. Activate the target version and record who published it
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
        Err(e) => {
            tracing::error!(error = %e, "publish_eula_version: activate failed");
            return IoError::Database(e).into_response();
        }
        Ok(_) => {}
    }

    // 3. Reset enabled users to require re-acceptance of the new version.
    // Skip disabled accounts — they cannot log in and the EULA gate is never shown to them.
    let reset_users = sqlx::query(
        "UPDATE users SET eula_accepted = false, eula_accepted_at = NULL WHERE enabled = true",
    )
    .execute(&mut *tx)
    .await;

    if let Err(e) = reset_users {
        tracing::error!(error = %e, "publish_eula_version: user reset failed");
        return IoError::Database(e).into_response();
    }

    if let Err(e) = tx.commit().await {
        tracing::error!(error = %e, "publish_eula_version: commit failed");
        return IoError::Database(e).into_response();
    }

    tracing::info!(
        admin_id = %admin_id,
        eula_version_id = %id,
        "EULA version published"
    );

    Json(ApiResponse::ok(serde_json::json!({
        "published": true,
        "version_id": id,
    })))
    .into_response()
}

// ---------------------------------------------------------------------------
// GET /auth/admin/eula/acceptances — acceptance audit log with pagination
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
    let per_page = params.per_page.unwrap_or(50).min(200).max(1);
    let offset = (page - 1) * per_page;

    // Build query conditionally on version_id filter
    let rows = if let Some(version_id) = params.version_id {
        sqlx::query(
            r#"
            SELECT ea.id, ea.user_id, u.username, u.full_name, u.email,
                   ev.version AS eula_version, ea.eula_version_id,
                   ea.accepted_at, ea.accepted_from_ip::TEXT AS accepted_from_ip,
                   ea.accepted_as_role, ea.content_hash
            FROM eula_acceptances ea
            JOIN users u ON u.id = ea.user_id
            JOIN eula_versions ev ON ev.id = ea.eula_version_id
            WHERE ea.eula_version_id = $1
            ORDER BY ea.accepted_at DESC
            LIMIT $2 OFFSET $3
            "#,
        )
        .bind(version_id)
        .bind(per_page)
        .bind(offset)
        .fetch_all(&state.db)
        .await
    } else {
        sqlx::query(
            r#"
            SELECT ea.id, ea.user_id, u.username, u.full_name, u.email,
                   ev.version AS eula_version, ea.eula_version_id,
                   ea.accepted_at, ea.accepted_from_ip::TEXT AS accepted_from_ip,
                   ea.accepted_as_role, ea.content_hash
            FROM eula_acceptances ea
            JOIN users u ON u.id = ea.user_id
            JOIN eula_versions ev ON ev.id = ea.eula_version_id
            ORDER BY ea.accepted_at DESC
            LIMIT $1 OFFSET $2
            "#,
        )
        .bind(per_page)
        .bind(offset)
        .fetch_all(&state.db)
        .await
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
                    eula_version: r.try_get::<String, _>("eula_version").unwrap_or_default(),
                    eula_version_id: r
                        .try_get("eula_version_id")
                        .unwrap_or_else(|_| Uuid::nil()),
                    accepted_at: r.try_get("accepted_at").unwrap_or_else(|_| Utc::now()),
                    accepted_from_ip: r
                        .try_get::<String, _>("accepted_from_ip")
                        .unwrap_or_default(),
                    accepted_as_role: r
                        .try_get::<String, _>("accepted_as_role")
                        .unwrap_or_default(),
                    content_hash: r.try_get::<String, _>("content_hash").unwrap_or_default(),
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
