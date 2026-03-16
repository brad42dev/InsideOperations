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

use io_error::{IoError, IoResult};
use io_models::{PageParams, PagedResponse, ApiResponse};

use crate::state::AppState;

// ---------------------------------------------------------------------------
// Response types
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
pub struct RoleRow {
    pub id: Uuid,
    pub name: String,
    pub display_name: String,
    pub description: Option<String>,
    pub is_predefined: bool,
    pub created_at: DateTime<Utc>,
    pub permission_count: i64,
}

#[derive(Debug, Serialize)]
pub struct RoleDetail {
    #[serde(flatten)]
    pub role: RoleRow,
    pub permissions: Vec<PermissionSummary>,
}

#[derive(Debug, Serialize)]
pub struct PermissionSummary {
    pub id: Uuid,
    pub module: String,
    pub name: String,
    pub description: Option<String>,
}

// ---------------------------------------------------------------------------
// Request types
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct CreateRoleRequest {
    pub name: String,
    pub display_name: String,
    pub description: Option<String>,
    /// Permission names to assign (not IDs — use names for readability)
    pub permissions: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateRoleRequest {
    pub display_name: Option<String>,
    pub description: Option<String>,
    pub permissions: Option<Vec<String>>,
}

// ---------------------------------------------------------------------------
// GET /roles
// ---------------------------------------------------------------------------

pub async fn list_roles(
    State(state): State<AppState>,
    Query(page): Query<PageParams>,
) -> IoResult<impl IntoResponse> {
    let pg = page.page();
    let limit = page.limit();
    let offset = page.offset();

    let total: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM roles WHERE deleted_at IS NULL",
    )
    .fetch_one(&state.db)
    .await?;

    let rows = sqlx::query(
        "SELECT r.id, r.name, r.display_name, r.description, r.is_predefined, r.created_at,
                COUNT(rp.permission_id) AS permission_count
         FROM roles r
         LEFT JOIN role_permissions rp ON rp.role_id = r.id
         WHERE r.deleted_at IS NULL
         GROUP BY r.id
         ORDER BY r.is_predefined DESC, r.name
         LIMIT $1 OFFSET $2",
    )
    .bind(limit as i64)
    .bind(offset)
    .fetch_all(&state.db)
    .await?;

    let roles: Vec<RoleRow> = rows
        .into_iter()
        .map(|r| RoleRow {
            id: r.get("id"),
            name: r.get("name"),
            display_name: r.get("display_name"),
            description: r.get("description"),
            is_predefined: r.get("is_predefined"),
            created_at: r.get("created_at"),
            permission_count: r.get("permission_count"),
        })
        .collect();

    Ok(Json(PagedResponse::new(roles, pg, limit, total as u64)))
}

// ---------------------------------------------------------------------------
// GET /roles/:id
// ---------------------------------------------------------------------------

pub async fn get_role(
    State(state): State<AppState>,
    Path(role_id): Path<Uuid>,
) -> IoResult<impl IntoResponse> {
    let row = sqlx::query(
        "SELECT r.id, r.name, r.display_name, r.description, r.is_predefined, r.created_at,
                COUNT(rp.permission_id) AS permission_count
         FROM roles r
         LEFT JOIN role_permissions rp ON rp.role_id = r.id
         WHERE r.id = $1 AND r.deleted_at IS NULL
         GROUP BY r.id",
    )
    .bind(role_id)
    .fetch_optional(&state.db)
    .await?
    .ok_or_else(|| IoError::NotFound(format!("Role {} not found", role_id)))?;

    let role = RoleRow {
        id: row.get("id"),
        name: row.get("name"),
        display_name: row.get("display_name"),
        description: row.get("description"),
        is_predefined: row.get("is_predefined"),
        created_at: row.get("created_at"),
        permission_count: row.get("permission_count"),
    };

    let perm_rows = sqlx::query(
        "SELECT p.id, p.module, p.name, p.description
         FROM permissions p
         JOIN role_permissions rp ON rp.permission_id = p.id
         WHERE rp.role_id = $1
         ORDER BY p.module, p.name",
    )
    .bind(role_id)
    .fetch_all(&state.db)
    .await?;

    let permissions: Vec<PermissionSummary> = perm_rows
        .into_iter()
        .map(|r| PermissionSummary {
            id: r.get("id"),
            module: r.get("module"),
            name: r.get("name"),
            description: r.get("description"),
        })
        .collect();

    Ok(Json(ApiResponse::ok(RoleDetail { role, permissions })))
}

// ---------------------------------------------------------------------------
// POST /roles
// Predefined roles cannot be created via the API — only custom ones.
// ---------------------------------------------------------------------------

pub async fn create_role(
    State(state): State<AppState>,
    Json(req): Json<CreateRoleRequest>,
) -> IoResult<impl IntoResponse> {
    if req.name.is_empty() || req.display_name.is_empty() {
        return Err(IoError::BadRequest("name and display_name are required".to_string()));
    }

    let exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM roles WHERE LOWER(name) = LOWER($1) AND deleted_at IS NULL)",
    )
    .bind(&req.name)
    .fetch_one(&state.db)
    .await?;
    if exists {
        return Err(IoError::Conflict(format!("Role '{}' already exists", req.name)));
    }

    let role_id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO roles (id, name, display_name, description, is_predefined)
         VALUES ($1, $2, $3, $4, false)",
    )
    .bind(role_id)
    .bind(&req.name)
    .bind(&req.display_name)
    .bind(&req.description)
    .execute(&state.db)
    .await?;

    if let Some(perms) = &req.permissions {
        assign_permissions_by_name(&state.db, role_id, perms).await?;
    }

    get_role(State(state), Path(role_id)).await.map(|r| {
        let (_, body) = (StatusCode::CREATED, r);
        body
    })
}

// ---------------------------------------------------------------------------
// PUT /roles/:id
// Predefined roles: only permission assignments can be changed.
// Custom roles: display_name and description can also be changed.
// ---------------------------------------------------------------------------

pub async fn update_role(
    State(state): State<AppState>,
    Path(role_id): Path<Uuid>,
    Json(req): Json<UpdateRoleRequest>,
) -> IoResult<impl IntoResponse> {
    let row = sqlx::query("SELECT is_predefined FROM roles WHERE id = $1 AND deleted_at IS NULL")
        .bind(role_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| IoError::NotFound(format!("Role {} not found", role_id)))?;

    let is_predefined: bool = row.get("is_predefined");

    if !is_predefined {
        if let Some(display_name) = &req.display_name {
            sqlx::query("UPDATE roles SET display_name = $1, updated_at = NOW() WHERE id = $2")
                .bind(display_name)
                .bind(role_id)
                .execute(&state.db)
                .await?;
        }
        if let Some(description) = &req.description {
            sqlx::query("UPDATE roles SET description = $1, updated_at = NOW() WHERE id = $2")
                .bind(description)
                .bind(role_id)
                .execute(&state.db)
                .await?;
        }
    }

    if let Some(perms) = &req.permissions {
        sqlx::query("DELETE FROM role_permissions WHERE role_id = $1")
            .bind(role_id)
            .execute(&state.db)
            .await?;
        assign_permissions_by_name(&state.db, role_id, perms).await?;
    }

    get_role(State(state), Path(role_id)).await
}

// ---------------------------------------------------------------------------
// DELETE /roles/:id  (soft delete — only custom roles)
// ---------------------------------------------------------------------------

pub async fn delete_role(
    State(state): State<AppState>,
    Path(role_id): Path<Uuid>,
) -> IoResult<impl IntoResponse> {
    let row = sqlx::query("SELECT is_predefined FROM roles WHERE id = $1 AND deleted_at IS NULL")
        .bind(role_id)
        .fetch_optional(&state.db)
        .await?
        .ok_or_else(|| IoError::NotFound(format!("Role {} not found", role_id)))?;

    let is_predefined: bool = row.get("is_predefined");
    if is_predefined {
        return Err(IoError::Conflict(
            "Predefined roles cannot be deleted.".to_string(),
        ));
    }

    sqlx::query("UPDATE roles SET deleted_at = NOW() WHERE id = $1")
        .bind(role_id)
        .execute(&state.db)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

// ---------------------------------------------------------------------------
// GET /permissions
// List all 118 permissions, grouped by module.
// ---------------------------------------------------------------------------

pub async fn list_permissions(
    State(state): State<AppState>,
) -> IoResult<impl IntoResponse> {
    let rows = sqlx::query(
        "SELECT id, module, name, description FROM permissions ORDER BY module, name",
    )
    .fetch_all(&state.db)
    .await?;

    let permissions: Vec<PermissionSummary> = rows
        .into_iter()
        .map(|r| PermissionSummary {
            id: r.get("id"),
            module: r.get("module"),
            name: r.get("name"),
            description: r.get("description"),
        })
        .collect();

    Ok(Json(ApiResponse::ok(permissions)))
}

// ---------------------------------------------------------------------------
// Helper: assign permissions to a role by name
// ---------------------------------------------------------------------------

async fn assign_permissions_by_name(
    db: &io_db::DbPool,
    role_id: Uuid,
    permission_names: &[String],
) -> IoResult<()> {
    for name in permission_names {
        let result = sqlx::query(
            "INSERT INTO role_permissions (role_id, permission_id)
             SELECT $1, id FROM permissions WHERE name = $2
             ON CONFLICT DO NOTHING",
        )
        .bind(role_id)
        .bind(name)
        .execute(db)
        .await?;

        if result.rows_affected() == 0 {
            // Unknown permission name — skip silently (or error if strict mode)
            tracing::warn!(permission = %name, "Unknown permission name in role assignment");
        }
    }
    Ok(())
}
