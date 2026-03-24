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
pub struct GroupRow {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub role_count: i64,
    pub member_count: i64,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct GroupRoleSummary {
    pub id: Uuid,
    pub name: String,
    pub display_name: String,
}

#[derive(Debug, Serialize)]
pub struct GroupDetail {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub role_count: i64,
    pub member_count: i64,
    pub created_at: DateTime<Utc>,
    pub roles: Vec<GroupRoleSummary>,
}

#[derive(Debug, Serialize)]
pub struct GroupMemberRow {
    pub id: String,
    pub user_id: Uuid,
    pub username: String,
    pub email: String,
    pub full_name: Option<String>,
    pub added_at: DateTime<Utc>,
}

// ---------------------------------------------------------------------------
// Request types
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct CreateGroupRequest {
    pub name: String,
    pub description: Option<String>,
    pub role_ids: Option<Vec<Uuid>>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateGroupRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub role_ids: Option<Vec<Uuid>>,
}

#[derive(Debug, Deserialize)]
pub struct AddMemberRequest {
    pub user_id: Uuid,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async fn fetch_group_detail(
    db: &io_db::DbPool,
    group_id: Uuid,
) -> IoResult<GroupDetail> {
    let row = sqlx::query(
        "SELECT g.id, g.name, g.description, g.created_at,
                COUNT(DISTINCT gr.role_id) AS role_count,
                COUNT(DISTINCT ug.user_id) AS member_count
         FROM groups g
         LEFT JOIN group_roles gr ON gr.group_id = g.id
         LEFT JOIN user_groups ug ON ug.group_id = g.id
         WHERE g.id = $1
         GROUP BY g.id",
    )
    .bind(group_id)
    .fetch_optional(db)
    .await?
    .ok_or_else(|| IoError::NotFound(format!("Group {} not found", group_id)))?;

    let role_rows = sqlx::query(
        "SELECT r.id, r.name, r.display_name
         FROM roles r
         JOIN group_roles gr ON gr.role_id = r.id
         WHERE gr.group_id = $1
           AND r.deleted_at IS NULL
         ORDER BY r.name",
    )
    .bind(group_id)
    .fetch_all(db)
    .await?;

    let roles: Vec<GroupRoleSummary> = role_rows
        .into_iter()
        .map(|r| GroupRoleSummary {
            id: r.get("id"),
            name: r.get("name"),
            display_name: r.get("display_name"),
        })
        .collect();

    Ok(GroupDetail {
        id: row.get("id"),
        name: row.get("name"),
        description: row.get("description"),
        role_count: row.get("role_count"),
        member_count: row.get("member_count"),
        created_at: row.get("created_at"),
        roles,
    })
}

// ---------------------------------------------------------------------------
// GET /groups
// ---------------------------------------------------------------------------

pub async fn list_groups(
    State(state): State<AppState>,
    Query(page): Query<PageParams>,
) -> IoResult<impl IntoResponse> {
    let pg = page.page();
    let limit = page.per_page();
    let offset = page.offset();

    let total: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM groups")
        .fetch_one(&state.db)
        .await?;

    let rows = sqlx::query(
        "SELECT g.id, g.name, g.description, g.created_at,
                COUNT(DISTINCT gr.role_id) AS role_count,
                COUNT(DISTINCT ug.user_id) AS member_count
         FROM groups g
         LEFT JOIN group_roles gr ON gr.group_id = g.id
         LEFT JOIN user_groups ug ON ug.group_id = g.id
         GROUP BY g.id
         ORDER BY g.name
         LIMIT $1 OFFSET $2",
    )
    .bind(limit as i64)
    .bind(offset)
    .fetch_all(&state.db)
    .await?;

    let groups: Vec<GroupRow> = rows
        .into_iter()
        .map(|r| GroupRow {
            id: r.get("id"),
            name: r.get("name"),
            description: r.get("description"),
            role_count: r.get("role_count"),
            member_count: r.get("member_count"),
            created_at: r.get("created_at"),
        })
        .collect();

    Ok(Json(PagedResponse::new(groups, pg, limit, total as u64)))
}

// ---------------------------------------------------------------------------
// GET /groups/:id
// ---------------------------------------------------------------------------

pub async fn get_group(
    State(state): State<AppState>,
    Path(group_id): Path<Uuid>,
) -> IoResult<impl IntoResponse> {
    let detail = fetch_group_detail(&state.db, group_id).await?;
    Ok(Json(ApiResponse::ok(detail)))
}

// ---------------------------------------------------------------------------
// POST /groups
// ---------------------------------------------------------------------------

pub async fn create_group(
    State(state): State<AppState>,
    Json(req): Json<CreateGroupRequest>,
) -> IoResult<impl IntoResponse> {
    if req.name.trim().is_empty() {
        return Err(IoError::BadRequest("name is required".to_string()));
    }

    let exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM groups WHERE LOWER(name) = LOWER($1))",
    )
    .bind(&req.name)
    .fetch_one(&state.db)
    .await?;
    if exists {
        return Err(IoError::Conflict(format!(
            "Group '{}' already exists",
            req.name
        )));
    }

    let group_id = Uuid::new_v4();
    sqlx::query(
        "INSERT INTO groups (id, name, description) VALUES ($1, $2, $3)",
    )
    .bind(group_id)
    .bind(&req.name)
    .bind(&req.description)
    .execute(&state.db)
    .await?;

    if let Some(role_ids) = &req.role_ids {
        for role_id in role_ids {
            sqlx::query(
                "INSERT INTO group_roles (group_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
            )
            .bind(group_id)
            .bind(role_id)
            .execute(&state.db)
            .await?;
        }
    }

    let detail = fetch_group_detail(&state.db, group_id).await?;
    Ok((StatusCode::CREATED, Json(ApiResponse::ok(detail))))
}

// ---------------------------------------------------------------------------
// PUT /groups/:id
// ---------------------------------------------------------------------------

pub async fn update_group(
    State(state): State<AppState>,
    Path(group_id): Path<Uuid>,
    Json(req): Json<UpdateGroupRequest>,
) -> IoResult<impl IntoResponse> {
    // Verify group exists
    let exists: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM groups WHERE id = $1)")
        .bind(group_id)
        .fetch_one(&state.db)
        .await?;
    if !exists {
        return Err(IoError::NotFound(format!("Group {} not found", group_id)));
    }

    if let Some(name) = &req.name {
        if name.trim().is_empty() {
            return Err(IoError::BadRequest("name cannot be empty".to_string()));
        }
        // Check uniqueness (excluding this group)
        let name_taken: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM groups WHERE LOWER(name) = LOWER($1) AND id != $2)",
        )
        .bind(name)
        .bind(group_id)
        .fetch_one(&state.db)
        .await?;
        if name_taken {
            return Err(IoError::Conflict(format!("Group '{}' already exists", name)));
        }
        sqlx::query("UPDATE groups SET name = $1, updated_at = NOW() WHERE id = $2")
            .bind(name)
            .bind(group_id)
            .execute(&state.db)
            .await?;
    }

    if let Some(description) = &req.description {
        sqlx::query("UPDATE groups SET description = $1, updated_at = NOW() WHERE id = $2")
            .bind(description)
            .bind(group_id)
            .execute(&state.db)
            .await?;
    }

    if let Some(role_ids) = &req.role_ids {
        // Replace all role assignments
        sqlx::query("DELETE FROM group_roles WHERE group_id = $1")
            .bind(group_id)
            .execute(&state.db)
            .await?;
        for role_id in role_ids {
            sqlx::query(
                "INSERT INTO group_roles (group_id, role_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
            )
            .bind(group_id)
            .bind(role_id)
            .execute(&state.db)
            .await?;
        }
    }

    let detail = fetch_group_detail(&state.db, group_id).await?;
    Ok(Json(ApiResponse::ok(detail)))
}

// ---------------------------------------------------------------------------
// DELETE /groups/:id
// ---------------------------------------------------------------------------

pub async fn delete_group(
    State(state): State<AppState>,
    Path(group_id): Path<Uuid>,
) -> IoResult<impl IntoResponse> {
    let exists: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM groups WHERE id = $1)")
        .bind(group_id)
        .fetch_one(&state.db)
        .await?;
    if !exists {
        return Err(IoError::NotFound(format!("Group {} not found", group_id)));
    }

    // Cascade deletes handle group_roles and user_groups via FK ON DELETE CASCADE
    sqlx::query("DELETE FROM groups WHERE id = $1")
        .bind(group_id)
        .execute(&state.db)
        .await?;

    Ok(StatusCode::NO_CONTENT)
}

// ---------------------------------------------------------------------------
// GET /groups/:id/members
// ---------------------------------------------------------------------------

pub async fn list_group_members(
    State(state): State<AppState>,
    Path(group_id): Path<Uuid>,
    Query(page): Query<PageParams>,
) -> IoResult<impl IntoResponse> {
    let pg = page.page();
    let limit = page.per_page();
    let offset = page.offset();

    // Verify group exists
    let exists: bool = sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM groups WHERE id = $1)")
        .bind(group_id)
        .fetch_one(&state.db)
        .await?;
    if !exists {
        return Err(IoError::NotFound(format!("Group {} not found", group_id)));
    }

    let total: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM user_groups WHERE group_id = $1",
    )
    .bind(group_id)
    .fetch_one(&state.db)
    .await?;

    let rows = sqlx::query(
        "SELECT u.id AS user_id, u.username, u.email, u.full_name, ug.added_at
         FROM user_groups ug
         JOIN users u ON u.id = ug.user_id
         WHERE ug.group_id = $1
         ORDER BY u.username
         LIMIT $2 OFFSET $3",
    )
    .bind(group_id)
    .bind(limit as i64)
    .bind(offset)
    .fetch_all(&state.db)
    .await?;

    let members: Vec<GroupMemberRow> = rows
        .into_iter()
        .map(|r| {
            let user_id: Uuid = r.get("user_id");
            GroupMemberRow {
                // Use composite key as stable row ID
                id: format!("{}-{}", group_id, user_id),
                user_id,
                username: r.get("username"),
                email: r.get("email"),
                full_name: r.get("full_name"),
                added_at: r.get("added_at"),
            }
        })
        .collect();

    Ok(Json(PagedResponse::new(members, pg, limit, total as u64)))
}

// ---------------------------------------------------------------------------
// POST /groups/:id/members
// ---------------------------------------------------------------------------

pub async fn add_group_member(
    State(state): State<AppState>,
    Path(group_id): Path<Uuid>,
    Json(req): Json<AddMemberRequest>,
) -> IoResult<impl IntoResponse> {
    // Verify group exists
    let group_exists: bool =
        sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM groups WHERE id = $1)")
            .bind(group_id)
            .fetch_one(&state.db)
            .await?;
    if !group_exists {
        return Err(IoError::NotFound(format!("Group {} not found", group_id)));
    }

    // Verify user exists
    let user_exists: bool =
        sqlx::query_scalar("SELECT EXISTS(SELECT 1 FROM users WHERE id = $1 AND deleted_at IS NULL)")
            .bind(req.user_id)
            .fetch_one(&state.db)
            .await?;
    if !user_exists {
        return Err(IoError::NotFound(format!("User {} not found", req.user_id)));
    }

    // Check if already a member
    let already_member: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM user_groups WHERE group_id = $1 AND user_id = $2)",
    )
    .bind(group_id)
    .bind(req.user_id)
    .fetch_one(&state.db)
    .await?;
    if already_member {
        return Err(IoError::Conflict("User is already a member of this group".to_string()));
    }

    sqlx::query(
        "INSERT INTO user_groups (user_id, group_id, added_at) VALUES ($1, $2, NOW())",
    )
    .bind(req.user_id)
    .bind(group_id)
    .execute(&state.db)
    .await?;

    // Fetch the new member row to return
    let row = sqlx::query(
        "SELECT u.id AS user_id, u.username, u.email, u.full_name, ug.added_at
         FROM user_groups ug
         JOIN users u ON u.id = ug.user_id
         WHERE ug.group_id = $1 AND ug.user_id = $2",
    )
    .bind(group_id)
    .bind(req.user_id)
    .fetch_one(&state.db)
    .await?;

    let user_id: Uuid = row.get("user_id");
    let member = GroupMemberRow {
        id: format!("{}-{}", group_id, user_id),
        user_id,
        username: row.get("username"),
        email: row.get("email"),
        full_name: row.get("full_name"),
        added_at: row.get("added_at"),
    };

    Ok((StatusCode::CREATED, Json(ApiResponse::ok(member))))
}

// ---------------------------------------------------------------------------
// DELETE /groups/:group_id/members/:user_id
// ---------------------------------------------------------------------------

pub async fn remove_group_member(
    State(state): State<AppState>,
    Path((group_id, user_id)): Path<(Uuid, Uuid)>,
) -> IoResult<impl IntoResponse> {
    let result = sqlx::query(
        "DELETE FROM user_groups WHERE group_id = $1 AND user_id = $2",
    )
    .bind(group_id)
    .bind(user_id)
    .execute(&state.db)
    .await?;

    if result.rows_affected() == 0 {
        return Err(IoError::NotFound(format!(
            "User {} is not a member of group {}",
            user_id, group_id
        )));
    }

    Ok(StatusCode::NO_CONTENT)
}
