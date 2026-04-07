use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use uuid::Uuid;

use io_auth::hash_password;
use io_error::{FieldError, IoError, IoResult};
use io_models::{ApiResponse, PagedResponse};
use io_validate;

use crate::state::AppState;

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
pub struct UserRow {
    pub id: Uuid,
    pub username: String,
    pub email: String,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub display_name: Option<String>,
    /// Legacy field kept for backward compat with auth/oidc/sessions handlers.
    pub full_name: Option<String>,
    pub phone_number: Option<String>,
    pub enabled: bool,
    pub auth_provider: String,
    pub created_at: DateTime<Utc>,
    pub last_login_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize)]
pub struct GroupSummary {
    pub id: Uuid,
    pub name: String,
}

#[derive(Debug, Serialize)]
pub struct UserDetail {
    #[serde(flatten)]
    pub user: UserRow,
    pub roles: Vec<RoleSummary>,
    pub groups: Vec<GroupSummary>,
}

#[derive(Debug, Serialize)]
pub struct RoleSummary {
    pub id: Uuid,
    pub name: String,
    pub display_name: String,
}

// ---------------------------------------------------------------------------
// Request types
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct CreateUserRequest {
    pub username: String,
    pub email: String,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub display_name: Option<String>,
    /// Legacy — kept for compat; prefer first_name + last_name.
    pub full_name: Option<String>,
    pub phone_number: Option<String>,
    pub password: String,
    pub role_ids: Option<Vec<Uuid>>,
    pub group_ids: Option<Vec<Uuid>>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateUserRequest {
    pub email: Option<String>,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub display_name: Option<String>,
    /// Legacy — kept for compat.
    pub full_name: Option<String>,
    pub phone_number: Option<String>,
    pub enabled: Option<bool>,
    pub role_ids: Option<Vec<Uuid>>,
    pub group_ids: Option<Vec<Uuid>>,
    /// Only settable by admin — forces a password change.
    pub password: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UserFilter {
    pub page: Option<u64>,
    pub limit: Option<u64>,
    pub q: Option<String>,
    pub role: Option<String>,
    pub enabled: Option<bool>,
}

// ---------------------------------------------------------------------------
// GET /users
// ---------------------------------------------------------------------------

pub async fn list_users(
    State(state): State<AppState>,
    Query(filter): Query<UserFilter>,
) -> IoResult<impl IntoResponse> {
    let page = filter.page.unwrap_or(1).max(1) as u32;
    let limit = filter.limit.unwrap_or(50).clamp(1, 100) as u32;
    let offset = ((page - 1) * limit) as i64;

    let q_pattern = filter.q.as_deref().map(|q| format!("%{q}%"));

    let total: i64 = sqlx::query(
        "SELECT COUNT(*) FROM users u
         WHERE u.deleted_at IS NULL
           AND ($1::text IS NULL
                OR u.username     ILIKE $1
                OR u.email        ILIKE $1
                OR u.full_name    ILIKE $1
                OR u.display_name ILIKE $1
                OR u.first_name   ILIKE $1
                OR u.last_name    ILIKE $1)
           AND ($2::boolean IS NULL OR u.enabled = $2)
           AND ($3::text IS NULL OR EXISTS (
               SELECT 1 FROM user_roles ur
               JOIN roles r ON r.id = ur.role_id
               WHERE ur.user_id = u.id AND r.name = $3 AND r.deleted_at IS NULL
           ))",
    )
    .bind(q_pattern.as_deref())
    .bind(filter.enabled)
    .bind(filter.role.as_deref())
    .fetch_one(&state.db)
    .await
    .map(|r| r.get::<i64, _>(0))?;

    let rows = sqlx::query(
        "SELECT u.id, u.username, u.email,
                u.first_name, u.last_name, u.display_name,
                u.full_name, u.phone_number,
                u.enabled, u.auth_provider, u.created_at, u.last_login_at
         FROM users u
         WHERE u.deleted_at IS NULL
           AND ($1::text IS NULL
                OR u.username     ILIKE $1
                OR u.email        ILIKE $1
                OR u.full_name    ILIKE $1
                OR u.display_name ILIKE $1
                OR u.first_name   ILIKE $1
                OR u.last_name    ILIKE $1)
           AND ($2::boolean IS NULL OR u.enabled = $2)
           AND ($3::text IS NULL OR EXISTS (
               SELECT 1 FROM user_roles ur
               JOIN roles r ON r.id = ur.role_id
               WHERE ur.user_id = u.id AND r.name = $3 AND r.deleted_at IS NULL
           ))
         ORDER BY u.created_at DESC
         LIMIT $4 OFFSET $5",
    )
    .bind(q_pattern.as_deref())
    .bind(filter.enabled)
    .bind(filter.role.as_deref())
    .bind(limit as i64)
    .bind(offset)
    .fetch_all(&state.db)
    .await?;

    let users: Vec<UserRow> = rows
        .into_iter()
        .map(|r| UserRow {
            id: r.get("id"),
            username: r.get("username"),
            email: r.get("email"),
            first_name: r.get("first_name"),
            last_name: r.get("last_name"),
            display_name: r.get("display_name"),
            full_name: r.get("full_name"),
            phone_number: r.get("phone_number"),
            enabled: r.get("enabled"),
            auth_provider: r.get("auth_provider"),
            created_at: r.get("created_at"),
            last_login_at: r.get("last_login_at"),
        })
        .collect();

    Ok(Json(PagedResponse::new(users, page, limit, total as u64)))
}

// ---------------------------------------------------------------------------
// GET /users/:id
// ---------------------------------------------------------------------------

pub async fn get_user(
    State(state): State<AppState>,
    Path(user_id): Path<Uuid>,
) -> IoResult<impl IntoResponse> {
    let row = sqlx::query(
        "SELECT id, username, email,
                first_name, last_name, display_name,
                full_name, phone_number,
                enabled, auth_provider, created_at, last_login_at
         FROM users WHERE id = $1 AND deleted_at IS NULL",
    )
    .bind(user_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| IoError::NotFound(format!("User {} not found", user_id)))?;

    let user = UserRow {
        id: row.get("id"),
        username: row.get("username"),
        email: row.get("email"),
        first_name: row.get("first_name"),
        last_name: row.get("last_name"),
        display_name: row.get("display_name"),
        full_name: row.get("full_name"),
        phone_number: row.get("phone_number"),
        enabled: row.get("enabled"),
        auth_provider: row.get("auth_provider"),
        created_at: row.get("created_at"),
        last_login_at: row.get("last_login_at"),
    };

    let role_rows = sqlx::query(
        "SELECT r.id, r.name, r.display_name FROM roles r
         JOIN user_roles ur ON ur.role_id = r.id
         WHERE ur.user_id = $1 AND r.deleted_at IS NULL
         ORDER BY r.name",
    )
    .bind(user_id)
    .fetch_all(&state.db)
    .await?;

    let roles: Vec<RoleSummary> = role_rows
        .into_iter()
        .map(|r| RoleSummary {
            id: r.get("id"),
            name: r.get("name"),
            display_name: r.get("display_name"),
        })
        .collect();

    let group_rows = sqlx::query(
        "SELECT g.id, g.name FROM groups g
         JOIN user_groups ug ON ug.group_id = g.id
         WHERE ug.user_id = $1
         ORDER BY g.name",
    )
    .bind(user_id)
    .fetch_all(&state.db)
    .await?;

    let groups: Vec<GroupSummary> = group_rows
        .into_iter()
        .map(|r| GroupSummary {
            id: r.get("id"),
            name: r.get("name"),
        })
        .collect();

    Ok(Json(ApiResponse::ok(UserDetail {
        user,
        roles,
        groups,
    })))
}

// ---------------------------------------------------------------------------
// POST /users
// ---------------------------------------------------------------------------

pub async fn create_user(
    State(state): State<AppState>,
    Json(req): Json<CreateUserRequest>,
) -> IoResult<impl IntoResponse> {
    let mut errors: Vec<FieldError> = Vec::new();
    if let Err(e) = io_validate::validate_username(&req.username) {
        errors.push(FieldError::new("username", e.to_string()));
    }
    if let Err(e) = io_validate::validate_email(&req.email) {
        errors.push(FieldError::new("email", e.to_string()));
    }
    if let Err(e) = io_validate::validate_password(&req.password) {
        errors.push(FieldError::new("password", e.to_string()));
    }
    if !errors.is_empty() {
        return Err(IoError::Validation(errors));
    }

    let exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM users WHERE LOWER(username) = LOWER($1) AND deleted_at IS NULL)",
    )
    .bind(&req.username)
    .fetch_one(&state.db)
    .await?;
    if exists {
        return Err(IoError::Conflict(format!(
            "Username '{}' is already taken",
            req.username
        )));
    }

    let email_exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM users WHERE LOWER(email) = LOWER($1) AND deleted_at IS NULL)",
    )
    .bind(&req.email)
    .fetch_one(&state.db)
    .await?;
    if email_exists {
        return Err(IoError::Conflict(format!(
            "Email '{}' is already in use",
            req.email
        )));
    }

    let password_hash =
        hash_password(&req.password).map_err(|e| IoError::Internal(e.to_string()))?;

    // Derive full_name from first+last if not provided directly.
    let full_name = req.full_name.clone().or_else(|| {
        match (req.first_name.as_deref(), req.last_name.as_deref()) {
            (Some(f), Some(l)) if !f.is_empty() || !l.is_empty() => {
                Some(format!("{} {}", f, l).trim().to_string())
            }
            (Some(f), None) if !f.is_empty() => Some(f.to_string()),
            (None, Some(l)) if !l.is_empty() => Some(l.to_string()),
            _ => None,
        }
    });

    // display_name: explicit > first+last > username
    let display_name = req.display_name.clone().or_else(|| full_name.clone());

    let user_id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO users (id, username, email,
                            first_name, last_name, display_name,
                            full_name, phone_number,
                            password_hash, enabled, auth_provider)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true, 'local')",
    )
    .bind(user_id)
    .bind(&req.username)
    .bind(&req.email)
    .bind(&req.first_name)
    .bind(&req.last_name)
    .bind(&display_name)
    .bind(&full_name)
    .bind(&req.phone_number)
    .bind(&password_hash)
    .execute(&state.db)
    .await?;

    if let Some(role_ids) = &req.role_ids {
        for role_id in role_ids {
            sqlx::query(
                "INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)
                 ON CONFLICT DO NOTHING",
            )
            .bind(user_id)
            .bind(role_id)
            .execute(&state.db)
            .await?;
        }
    }

    if let Some(group_ids) = &req.group_ids {
        for group_id in group_ids {
            sqlx::query(
                "INSERT INTO user_groups (user_id, group_id) VALUES ($1, $2)
                 ON CONFLICT DO NOTHING",
            )
            .bind(user_id)
            .bind(group_id)
            .execute(&state.db)
            .await?;
        }
    }

    let user = UserRow {
        id: user_id,
        username: req.username,
        email: req.email,
        first_name: req.first_name,
        last_name: req.last_name,
        display_name,
        full_name,
        phone_number: req.phone_number,
        enabled: true,
        auth_provider: "local".to_string(),
        created_at: Utc::now(),
        last_login_at: None,
    };

    Ok((StatusCode::CREATED, Json(ApiResponse::ok(user))))
}

// ---------------------------------------------------------------------------
// PUT /users/:id
// ---------------------------------------------------------------------------

pub async fn update_user(
    State(state): State<AppState>,
    Path(user_id): Path<Uuid>,
    Json(req): Json<UpdateUserRequest>,
) -> IoResult<impl IntoResponse> {
    let exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM users WHERE id = $1 AND deleted_at IS NULL)",
    )
    .bind(user_id)
    .fetch_one(&state.db)
    .await?;
    if !exists {
        return Err(IoError::NotFound(format!("User {} not found", user_id)));
    }

    let mut errors: Vec<FieldError> = Vec::new();
    if let Some(email) = &req.email {
        if let Err(e) = io_validate::validate_email(email) {
            errors.push(FieldError::new("email", e.to_string()));
        }
    }
    if let Some(password) = &req.password {
        if let Err(e) = io_validate::validate_password(password) {
            errors.push(FieldError::new("password", e.to_string()));
        }
    }
    if !errors.is_empty() {
        return Err(IoError::Validation(errors));
    }

    if let Some(email) = &req.email {
        sqlx::query("UPDATE users SET email = $1, updated_at = NOW() WHERE id = $2")
            .bind(email)
            .bind(user_id)
            .execute(&state.db)
            .await?;
    }
    if let Some(first_name) = &req.first_name {
        sqlx::query("UPDATE users SET first_name = $1, updated_at = NOW() WHERE id = $2")
            .bind(first_name)
            .bind(user_id)
            .execute(&state.db)
            .await?;
    }
    if let Some(last_name) = &req.last_name {
        sqlx::query("UPDATE users SET last_name = $1, updated_at = NOW() WHERE id = $2")
            .bind(last_name)
            .bind(user_id)
            .execute(&state.db)
            .await?;
    }
    if let Some(display_name) = &req.display_name {
        sqlx::query("UPDATE users SET display_name = $1, updated_at = NOW() WHERE id = $2")
            .bind(display_name)
            .bind(user_id)
            .execute(&state.db)
            .await?;
    }
    // Keep full_name in sync for backwards compat with auth/oidc handlers.
    let derived_full_name = req.full_name.clone().or_else(|| {
        match (req.first_name.as_deref(), req.last_name.as_deref()) {
            (Some(f), Some(l)) => Some(format!("{} {}", f, l).trim().to_string()),
            (Some(f), None) => Some(f.to_string()),
            (None, Some(l)) => Some(l.to_string()),
            _ => None,
        }
    });
    if let Some(full_name) = &derived_full_name {
        sqlx::query("UPDATE users SET full_name = $1, updated_at = NOW() WHERE id = $2")
            .bind(full_name)
            .bind(user_id)
            .execute(&state.db)
            .await?;
    }
    if let Some(phone) = &req.phone_number {
        sqlx::query("UPDATE users SET phone_number = $1, updated_at = NOW() WHERE id = $2")
            .bind(phone)
            .bind(user_id)
            .execute(&state.db)
            .await?;
    }
    if let Some(enabled) = req.enabled {
        sqlx::query("UPDATE users SET enabled = $1, updated_at = NOW() WHERE id = $2")
            .bind(enabled)
            .bind(user_id)
            .execute(&state.db)
            .await?;
        if !enabled {
            sqlx::query(
                "UPDATE user_sessions SET revoked_at = NOW(), revoked_reason = 'account_disabled'
                 WHERE user_id = $1 AND revoked_at IS NULL",
            )
            .bind(user_id)
            .execute(&state.db)
            .await?;
        }
    }
    if let Some(password) = &req.password {
        let hash = hash_password(password).map_err(|e| IoError::Internal(e.to_string()))?;
        sqlx::query("UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2")
            .bind(&hash)
            .bind(user_id)
            .execute(&state.db)
            .await?;
    }
    if let Some(role_ids) = &req.role_ids {
        sqlx::query("DELETE FROM user_roles WHERE user_id = $1")
            .bind(user_id)
            .execute(&state.db)
            .await?;
        for role_id in role_ids {
            sqlx::query(
                "INSERT INTO user_roles (user_id, role_id) VALUES ($1, $2)
                 ON CONFLICT DO NOTHING",
            )
            .bind(user_id)
            .bind(role_id)
            .execute(&state.db)
            .await?;
        }
    }
    if let Some(group_ids) = &req.group_ids {
        sqlx::query("DELETE FROM user_groups WHERE user_id = $1")
            .bind(user_id)
            .execute(&state.db)
            .await?;
        for group_id in group_ids {
            sqlx::query(
                "INSERT INTO user_groups (user_id, group_id) VALUES ($1, $2)
                 ON CONFLICT DO NOTHING",
            )
            .bind(user_id)
            .bind(group_id)
            .execute(&state.db)
            .await?;
        }
    }

    get_user(State(state), Path(user_id)).await
}

// ---------------------------------------------------------------------------
// DELETE /users/:id  (soft delete — sets deleted_at)
// ---------------------------------------------------------------------------

pub async fn delete_user(
    State(state): State<AppState>,
    Path(user_id): Path<Uuid>,
) -> IoResult<impl IntoResponse> {
    let result = sqlx::query(
        "UPDATE users SET deleted_at = NOW(), enabled = false, updated_at = NOW()
         WHERE id = $1 AND deleted_at IS NULL",
    )
    .bind(user_id)
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(IoError::NotFound(format!("User {} not found", user_id)));
    }

    sqlx::query(
        "UPDATE user_sessions SET revoked_at = NOW(), revoked_reason = 'account_deleted'
         WHERE user_id = $1 AND revoked_at IS NULL",
    )
    .bind(user_id)
    .execute(&state.db)
    .await?;

    Ok(StatusCode::NO_CONTENT)
}

// ---------------------------------------------------------------------------
// GET /auth/me
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
pub struct MeDetail {
    #[serde(flatten)]
    pub detail: UserDetail,
    pub is_locked: bool,
    pub has_pin: bool,
}

pub async fn get_me(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
) -> IoResult<impl IntoResponse> {
    let user_id_str = headers
        .get("x-io-user-id")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    let user_id: Uuid = user_id_str.parse().map_err(|_| IoError::Unauthorized)?;

    let row = sqlx::query(
        "SELECT id, username, email,
                first_name, last_name, display_name,
                full_name, phone_number,
                enabled, auth_provider, created_at, last_login_at
         FROM users WHERE id = $1 AND deleted_at IS NULL",
    )
    .bind(user_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or(IoError::Unauthorized)?;

    let user = UserRow {
        id: row.get("id"),
        username: row.get("username"),
        email: row.get("email"),
        first_name: row.get("first_name"),
        last_name: row.get("last_name"),
        display_name: row.get("display_name"),
        full_name: row.get("full_name"),
        phone_number: row.get("phone_number"),
        enabled: row.get("enabled"),
        auth_provider: row.get("auth_provider"),
        created_at: row.get("created_at"),
        last_login_at: row.get("last_login_at"),
    };

    let role_rows = sqlx::query(
        "SELECT r.id, r.name, r.display_name FROM roles r
         JOIN user_roles ur ON ur.role_id = r.id
         WHERE ur.user_id = $1 AND r.deleted_at IS NULL
         ORDER BY r.name",
    )
    .bind(user_id)
    .fetch_all(&state.db)
    .await?;

    let roles: Vec<RoleSummary> = role_rows
        .into_iter()
        .map(|r| RoleSummary {
            id: r.get("id"),
            name: r.get("name"),
            display_name: r.get("display_name"),
        })
        .collect();

    let group_rows = sqlx::query(
        "SELECT g.id, g.name FROM groups g
         JOIN user_groups ug ON ug.group_id = g.id
         WHERE ug.user_id = $1
         ORDER BY g.name",
    )
    .bind(user_id)
    .fetch_all(&state.db)
    .await?;

    let groups: Vec<GroupSummary> = group_rows
        .into_iter()
        .map(|r| GroupSummary {
            id: r.get("id"),
            name: r.get("name"),
        })
        .collect();

    let is_locked: bool = sqlx::query_scalar(
        "SELECT locked_since IS NOT NULL
         FROM user_sessions
         WHERE user_id = $1
           AND revoked_at IS NULL
           AND expires_at > NOW()
         ORDER BY created_at DESC
         LIMIT 1",
    )
    .bind(user_id)
    .fetch_optional(&state.db)
    .await?
    .unwrap_or(false);

    let has_pin: bool = sqlx::query_scalar(
        "SELECT lock_pin_hash IS NOT NULL FROM users WHERE id = $1 AND deleted_at IS NULL",
    )
    .bind(user_id)
    .fetch_optional(&state.db)
    .await?
    .unwrap_or(false);

    Ok(Json(ApiResponse::ok(MeDetail {
        detail: UserDetail {
            user,
            roles,
            groups,
        },
        is_locked,
        has_pin,
    })))
}
