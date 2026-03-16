use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use uuid::Uuid;

use io_error::{IoError, IoResult};
use io_models::{PagedResponse, ApiResponse};

use crate::state::AppState;

// ---------------------------------------------------------------------------
// Helpers (mirrors eula.rs pattern)
// ---------------------------------------------------------------------------

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

fn extract_user_id(headers: &HeaderMap) -> IoResult<Uuid> {
    headers
        .get("x-io-user-id")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("")
        .parse::<Uuid>()
        .map_err(|_| IoError::Unauthorized)
}

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

/// A session row as returned by the admin list endpoint (includes user info).
#[derive(Debug, Serialize)]
pub struct SessionRow {
    pub id: Uuid,
    pub user_id: Uuid,
    pub username: String,
    pub email: String,
    pub full_name: Option<String>,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub created_at: DateTime<Utc>,
    pub last_accessed_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
}

/// A session row as returned by the "my sessions" endpoint (no user info needed).
#[derive(Debug, Serialize)]
pub struct MySessionRow {
    pub id: Uuid,
    pub ip_address: Option<String>,
    pub user_agent: Option<String>,
    pub created_at: DateTime<Utc>,
    pub last_accessed_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
}

// ---------------------------------------------------------------------------
// Query params
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct SessionFilter {
    pub page: Option<u32>,
    pub limit: Option<u32>,
    /// Optional: filter to sessions belonging to a specific user.
    pub user_id: Option<Uuid>,
}

// ---------------------------------------------------------------------------
// GET /auth/admin/sessions
// Admin view: all active sessions across all users. Requires system:configure.
// ---------------------------------------------------------------------------

pub async fn list_sessions(
    State(state): State<AppState>,
    headers: HeaderMap,
    Query(filter): Query<SessionFilter>,
) -> IoResult<impl IntoResponse> {
    if !has_permission(&headers, "system:configure") {
        return Err(IoError::Forbidden("Requires system:configure permission".to_string()));
    }

    let pg = filter.page.unwrap_or(1).max(1);
    let limit = filter.limit.unwrap_or(50).clamp(1, 100);
    let offset = ((pg - 1) * limit) as i64;

    let total: i64 = sqlx::query_scalar(
        "SELECT COUNT(*)
         FROM user_sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.revoked_at IS NULL
           AND s.expires_at > NOW()
           AND u.deleted_at IS NULL
           AND ($1::uuid IS NULL OR s.user_id = $1)",
    )
    .bind(filter.user_id)
    .fetch_one(&state.db)
    .await?;

    let rows = sqlx::query(
        "SELECT s.id, s.user_id, u.username, u.email, u.full_name,
                s.ip_address::text AS ip_address, s.user_agent,
                s.created_at, s.last_accessed_at, s.expires_at
         FROM user_sessions s
         JOIN users u ON u.id = s.user_id
         WHERE s.revoked_at IS NULL
           AND s.expires_at > NOW()
           AND u.deleted_at IS NULL
           AND ($1::uuid IS NULL OR s.user_id = $1)
         ORDER BY s.last_accessed_at DESC
         LIMIT $2 OFFSET $3",
    )
    .bind(filter.user_id)
    .bind(limit as i64)
    .bind(offset)
    .fetch_all(&state.db)
    .await?;

    let sessions: Vec<SessionRow> = rows
        .into_iter()
        .map(|r| SessionRow {
            id: r.get("id"),
            user_id: r.get("user_id"),
            username: r.get("username"),
            email: r.get("email"),
            full_name: r.get("full_name"),
            ip_address: r.get("ip_address"),
            user_agent: r.get("user_agent"),
            created_at: r.get("created_at"),
            last_accessed_at: r.get("last_accessed_at"),
            expires_at: r.get("expires_at"),
        })
        .collect();

    Ok(Json(PagedResponse::new(sessions, pg, limit, total as u64)))
}

// ---------------------------------------------------------------------------
// DELETE /auth/admin/sessions/:id
// Revoke a single session by ID. Requires system:configure.
// ---------------------------------------------------------------------------

pub async fn revoke_session(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(session_id): Path<Uuid>,
) -> IoResult<impl IntoResponse> {
    if !has_permission(&headers, "system:configure") {
        return Err(IoError::Forbidden("Requires system:configure permission".to_string()));
    }

    let result = sqlx::query(
        "UPDATE user_sessions
         SET revoked_at = NOW(), revoked_reason = 'admin_revoked'
         WHERE id = $1 AND revoked_at IS NULL",
    )
    .bind(session_id)
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(IoError::NotFound(format!(
            "Session {} not found or already revoked",
            session_id
        )));
    }

    Ok(StatusCode::NO_CONTENT)
}

// ---------------------------------------------------------------------------
// DELETE /auth/admin/sessions/user/:user_id
// Revoke ALL active sessions for a given user. Requires system:configure.
// Useful for "kick user" without disabling the account.
// NOTE: static path /auth/admin/sessions/user/:user_id must be registered
// before parameterised /auth/admin/sessions/:id in the router.
// ---------------------------------------------------------------------------

pub async fn revoke_user_sessions(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(user_id): Path<Uuid>,
) -> IoResult<impl IntoResponse> {
    if !has_permission(&headers, "system:configure") {
        return Err(IoError::Forbidden("Requires system:configure permission".to_string()));
    }

    sqlx::query(
        "UPDATE user_sessions
         SET revoked_at = NOW(), revoked_reason = 'admin_revoked'
         WHERE user_id = $1 AND revoked_at IS NULL",
    )
    .bind(user_id)
    .execute(&state.db)
    .await?;

    Ok(StatusCode::NO_CONTENT)
}

// ---------------------------------------------------------------------------
// DELETE /auth/sessions/mine/:id
// Revoke one of the current user's own sessions. Validates ownership so a user
// cannot revoke someone else's session through this endpoint.
// ---------------------------------------------------------------------------

pub async fn revoke_my_session(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(session_id): Path<Uuid>,
) -> IoResult<impl IntoResponse> {
    let user_id = extract_user_id(&headers)?;

    let result = sqlx::query(
        "UPDATE user_sessions
         SET revoked_at = NOW(), revoked_reason = 'user_revoked'
         WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL",
    )
    .bind(session_id)
    .bind(user_id)
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(IoError::NotFound(
            "Session not found or does not belong to your account".to_string(),
        ));
    }

    Ok(StatusCode::NO_CONTENT)
}

// GET /auth/sessions/mine
// Returns the current user's own active sessions. No special permission needed.
// ---------------------------------------------------------------------------

pub async fn list_my_sessions(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> IoResult<impl IntoResponse> {
    let user_id = extract_user_id(&headers)?;

    let rows = sqlx::query(
        "SELECT id, ip_address::text AS ip_address, user_agent,
                created_at, last_accessed_at, expires_at
         FROM user_sessions
         WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > NOW()
         ORDER BY last_accessed_at DESC",
    )
    .bind(user_id)
    .fetch_all(&state.db)
    .await?;

    let sessions: Vec<MySessionRow> = rows
        .into_iter()
        .map(|r| MySessionRow {
            id: r.get("id"),
            ip_address: r.get("ip_address"),
            user_agent: r.get("user_agent"),
            created_at: r.get("created_at"),
            last_accessed_at: r.get("last_accessed_at"),
            expires_at: r.get("expires_at"),
        })
        .collect();

    Ok(Json(ApiResponse::ok(sessions)))
}
