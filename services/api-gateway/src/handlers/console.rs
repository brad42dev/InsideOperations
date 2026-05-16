use axum::{
    extract::{Path, Query, State},
    response::IntoResponse,
    Extension, Json,
};
use chrono::{DateTime, Utc};
use io_auth::Claims;
use io_error::IoError;
use io_models::{ApiResponse, PagedResponse};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use sqlx::Row;
use uuid::Uuid;

use crate::state::AppState;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
pub struct WorkspaceSummary {
    pub id: Uuid,
    pub name: String,
    pub metadata: Option<JsonValue>,
    pub published: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateWorkspaceBody {
    pub name: String,
    pub metadata: Option<JsonValue>,
    pub id: Option<Uuid>,
    pub autosave: Option<bool>,
    pub label: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateWorkspaceBody {
    pub name: Option<String>,
    pub metadata: Option<JsonValue>,
    pub label: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ShareWorkspaceBody {
    pub users: Option<Vec<String>>,
    pub roles: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
pub struct DuplicateWorkspaceBody {
    pub name: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ListWorkspaceVersionsQuery {
    pub include_deleted: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct WorkspaceVersionSummary {
    pub id: Uuid,
    pub version_number: i32,
    pub version_type: String,
    pub label: Option<String>,
    pub parent_version_number: Option<i32>,
    pub metadata: Option<JsonValue>,
    pub created_by: Uuid,
    pub created_by_name: Option<String>,
    pub created_at: DateTime<Utc>,
    pub deleted_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize)]
pub struct WorkspaceVersionContent {
    pub id: Uuid,
    pub version_number: i32,
    pub version_type: String,
    pub label: Option<String>,
    pub parent_version_number: Option<i32>,
    pub layout: JsonValue,
    pub metadata: Option<JsonValue>,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateWorkspaceVersionLabelBody {
    pub label: Option<String>,
}

// ---------------------------------------------------------------------------
// Permission helpers
// ---------------------------------------------------------------------------

fn check_permission(claims: &Claims, permission: &str) -> bool {
    claims
        .permissions
        .iter()
        .any(|p| p == "*" || p == permission)
}

fn is_admin(claims: &Claims) -> bool {
    claims.permissions.iter().any(|p| p == "*")
}

// ---------------------------------------------------------------------------
// Version metadata helpers
// ---------------------------------------------------------------------------

fn count_panes(metadata: &Option<JsonValue>) -> i64 {
    metadata
        .as_ref()
        .and_then(|m| m.get("panes"))
        .and_then(|p| p.as_array())
        .map(|arr| arr.len() as i64)
        .unwrap_or(0)
}

fn count_workspace_bindings(metadata: &Option<JsonValue>) -> i64 {
    let panes = match metadata
        .as_ref()
        .and_then(|m| m.get("panes"))
        .and_then(|p| p.as_array())
    {
        Some(arr) => arr,
        None => return 0,
    };

    let mut count = 0i64;
    for pane in panes {
        if let Some(series) = pane
            .get("chartConfig")
            .and_then(|c| c.get("series"))
            .and_then(|s| s.as_array())
        {
            count += series.len() as i64;
        }
        if pane.get("graphicId").and_then(|v| v.as_str()).is_some() {
            count += 1;
        }
    }
    count
}

fn compute_workspace_version_metadata(
    metadata: &Option<JsonValue>,
    existing_version_metadata: &Option<JsonValue>,
) -> JsonValue {
    let element_count = count_panes(metadata);
    let binding_count = count_workspace_bindings(metadata);

    let mut meta = existing_version_metadata
        .clone()
        .unwrap_or(serde_json::json!({}));
    if let Some(obj) = meta.as_object_mut() {
        obj.insert("element_count".to_string(), serde_json::json!(element_count));
        obj.insert("binding_count".to_string(), serde_json::json!(binding_count));
    }
    meta
}

// ---------------------------------------------------------------------------
// Shared helper: create_workspace_version_snapshot
// ---------------------------------------------------------------------------

async fn create_workspace_version_snapshot(
    db: &sqlx::PgPool,
    workspace_id: Uuid,
    created_by: Uuid,
    version_type: &str,
    layout: &JsonValue,
    metadata: &JsonValue,
    label: Option<String>,
) -> Result<i32, sqlx::Error> {
    let mut tx = db.begin().await?;

    sqlx::query("SELECT pg_advisory_xact_lock(hashtext($1::text))")
        .bind(workspace_id.to_string())
        .execute(&mut *tx)
        .await?;

    let (current_max, parent_version): (i32, Option<i32>) = sqlx::query_as(
        "SELECT COALESCE(MAX(version_number), 0), \
                CASE WHEN MAX(version_number) > 0 THEN MAX(version_number) ELSE NULL END \
         FROM workspace_versions \
         WHERE workspace_id = $1",
    )
    .bind(workspace_id)
    .fetch_one(&mut *tx)
    .await?;

    let next_version = current_max + 1;

    let effective_label = if next_version == 1 && label.is_none() {
        Some("Original".to_string())
    } else {
        label
    };

    sqlx::query(
        r#"
        INSERT INTO workspace_versions
            (id, workspace_id, version_number, version_type, layout,
             metadata, created_by, label, parent_version_number)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(workspace_id)
    .bind(next_version)
    .bind(version_type)
    .bind(layout)
    .bind(metadata)
    .bind(created_by)
    .bind(&effective_label)
    .bind(parent_version)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    tracing::info!(
        workspace_id = %workspace_id,
        version = next_version,
        version_type = version_type,
        "Workspace version snapshot created"
    );

    Ok(next_version)
}

// ---------------------------------------------------------------------------
// GET /api/console/workspaces — list workspaces for the authenticated user
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct ListWorkspacesQuery {
    pub page: Option<u32>,
    pub per_page: Option<u32>,
    /// Admin only: when "true", return all users' workspaces.
    pub include_all_users: Option<String>,
}

pub async fn list_workspaces(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListWorkspacesQuery>,
) -> impl IntoResponse {
    let user_id: Uuid = match Uuid::parse_str(&claims.sub) {
        Ok(id) => id,
        Err(_) => return IoError::Unauthorized.into_response(),
    };

    let pg = params.page.unwrap_or(1).max(1);
    let limit = params.per_page.unwrap_or(50).clamp(1, 200) as i64;
    let offset = ((pg - 1) as i64) * limit;

    let all_users = params.include_all_users.as_deref() == Some("true") && is_admin(&claims);

    let (total, rows) = if all_users {
        let total: i64 = match sqlx::query_scalar(
            "SELECT COUNT(*) FROM design_objects WHERE type = 'console_workspace' AND deleted_at IS NULL",
        )
        .fetch_one(&state.db)
        .await
        {
            Ok(n) => n,
            Err(e) => {
                tracing::error!(error = %e, "list_workspaces count query failed");
                return IoError::Database(e).into_response();
            }
        };

        let rows = match sqlx::query(
            r#"
            SELECT id, name, metadata, published, created_at
            FROM design_objects
            WHERE type = 'console_workspace' AND deleted_at IS NULL
            ORDER BY created_at DESC
            LIMIT $1 OFFSET $2
            "#,
        )
        .bind(limit)
        .bind(offset)
        .fetch_all(&state.db)
        .await
        {
            Ok(r) => r,
            Err(e) => {
                tracing::error!(error = %e, "list_workspaces query failed");
                return IoError::Database(e).into_response();
            }
        };

        (total, rows)
    } else {
        let total: i64 = match sqlx::query_scalar(
            "SELECT COUNT(*) FROM design_objects
             WHERE type = 'console_workspace'
               AND deleted_at IS NULL
               AND (created_by = $1 OR COALESCE(published, false) = true)",
        )
        .bind(user_id)
        .fetch_one(&state.db)
        .await
        {
            Ok(n) => n,
            Err(e) => {
                tracing::error!(error = %e, "list_workspaces count query failed");
                return IoError::Database(e).into_response();
            }
        };

        let rows = match sqlx::query(
            r#"
            SELECT id, name, metadata, published, created_at
            FROM design_objects
            WHERE type = 'console_workspace'
              AND deleted_at IS NULL
              AND (created_by = $1 OR COALESCE(published, false) = true)
            ORDER BY created_at DESC
            LIMIT $2 OFFSET $3
            "#,
        )
        .bind(user_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(&state.db)
        .await
        {
            Ok(r) => r,
            Err(e) => {
                tracing::error!(error = %e, "list_workspaces query failed");
                return IoError::Database(e).into_response();
            }
        };

        (total, rows)
    };

    let mut items: Vec<WorkspaceSummary> = Vec::with_capacity(rows.len());
    for row in &rows {
        let id: Uuid = match row.try_get("id") {
            Ok(v) => v,
            Err(e) => {
                tracing::warn!(error = %e, "skipping workspace row with bad id");
                continue;
            }
        };
        let name: String = row.try_get("name").unwrap_or_default();
        let metadata: Option<JsonValue> = row.try_get("metadata").ok().flatten();
        let published: bool = row.try_get("published").unwrap_or(false);
        let created_at: DateTime<Utc> = row.try_get("created_at").unwrap_or_else(|_| Utc::now());
        items.push(WorkspaceSummary {
            id,
            name,
            metadata,
            published,
            created_at,
        });
    }

    Json(PagedResponse::new(items, pg, limit as u32, total as u64)).into_response()
}

// ---------------------------------------------------------------------------
// POST /api/console/workspaces — create workspace
// ---------------------------------------------------------------------------

pub async fn create_workspace(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateWorkspaceBody>,
) -> impl IntoResponse {
    if body.name.trim().is_empty() {
        return IoError::BadRequest("name is required".into()).into_response();
    }

    let user_id: Uuid = match Uuid::parse_str(&claims.sub) {
        Ok(id) => id,
        Err(_) => return IoError::Unauthorized.into_response(),
    };

    let id = body.id.unwrap_or_else(Uuid::new_v4);
    let metadata = body
        .metadata
        .unwrap_or_else(|| JsonValue::Object(serde_json::Map::new()));

    let row = match sqlx::query(
        r#"
        INSERT INTO design_objects
            (id, name, type, svg_data, bindings, metadata, parent_id, created_by)
        VALUES ($1, $2, 'console_workspace', NULL,
                '{}'::jsonb, $3, NULL, $4)
        ON CONFLICT(id) DO UPDATE SET
            name = EXCLUDED.name,
            metadata = EXCLUDED.metadata
        RETURNING id, name, metadata, published, created_at
        "#,
    )
    .bind(id)
    .bind(&body.name)
    .bind(&metadata)
    .bind(user_id)
    .fetch_one(&state.db)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(error = %e, "create_workspace insert/update failed");
            return IoError::Database(e).into_response();
        }
    };

    let ws = WorkspaceSummary {
        id: row.try_get("id").unwrap_or(id),
        name: row.try_get("name").unwrap_or_default(),
        metadata: row.try_get("metadata").ok().flatten(),
        published: row.try_get("published").unwrap_or(false),
        created_at: row.try_get("created_at").unwrap_or_else(|_| Utc::now()),
    };

    // Snapshot on explicit saves (not autosave)
    let is_update = body.id.is_some();
    let is_autosave = body.autosave.unwrap_or(false);
    if is_update && !is_autosave {
        let ws_metadata = ws.metadata.clone();
        let version_metadata = compute_workspace_version_metadata(&ws_metadata, &None);
        let layout_snap = ws_metadata.unwrap_or(serde_json::json!({}));
        let db = state.db.clone();
        let ws_id = ws.id;
        let snapshot_label = body.label.clone();
        tokio::spawn(async move {
            if let Err(e) = create_workspace_version_snapshot(
                &db,
                ws_id,
                user_id,
                "save",
                &layout_snap,
                &version_metadata,
                snapshot_label,
            )
            .await
            {
                tracing::warn!(error = %e, workspace_id = %ws_id, "Workspace version snapshot creation failed (non-fatal)");
            }
        });
    } else if !is_update && !is_autosave && !body.name.starts_with("__autosave_") {
        let ws_metadata = ws.metadata.clone();
        let version_metadata = compute_workspace_version_metadata(&ws_metadata, &None);
        let layout_snap = ws_metadata.unwrap_or(serde_json::json!({}));
        let db = state.db.clone();
        let ws_id = ws.id;
        let snapshot_label = body.label.clone();
        tokio::spawn(async move {
            if let Err(e) = create_workspace_version_snapshot(
                &db,
                ws_id,
                user_id,
                "save",
                &layout_snap,
                &version_metadata,
                snapshot_label,
            )
            .await
            {
                tracing::warn!(error = %e, workspace_id = %ws_id, "Initial workspace version snapshot creation failed (non-fatal)");
            }
        });
    }

    Json(ApiResponse::ok(ws)).into_response()
}

// ---------------------------------------------------------------------------
// GET /api/console/workspaces/:id — get one workspace
// ---------------------------------------------------------------------------

pub async fn get_workspace(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let user_id: Uuid = match Uuid::parse_str(&claims.sub) {
        Ok(uid) => uid,
        Err(_) => return IoError::Unauthorized.into_response(),
    };

    let row = match sqlx::query(
        r#"
        SELECT id, name, metadata, published, created_at
        FROM design_objects
        WHERE id = $1
          AND type IN ('console_workspace', 'console_workspace_snapshot')
          AND deleted_at IS NULL
          AND (created_by = $2 OR COALESCE(published, false) = true)
        "#,
    )
    .bind(id)
    .bind(user_id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(r)) => r,
        Ok(None) => {
            return IoError::NotFound(format!("Workspace {} not found", id)).into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "get_workspace query failed");
            return IoError::Database(e).into_response();
        }
    };

    let ws = WorkspaceSummary {
        id: row.try_get("id").unwrap_or(id),
        name: row.try_get("name").unwrap_or_default(),
        metadata: row.try_get("metadata").ok().flatten(),
        published: row.try_get("published").unwrap_or(false),
        created_at: row.try_get("created_at").unwrap_or_else(|_| Utc::now()),
    };

    Json(ApiResponse::ok(ws)).into_response()
}

// ---------------------------------------------------------------------------
// DELETE /api/console/workspaces/:id — delete workspace
// ---------------------------------------------------------------------------

pub async fn delete_workspace(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let user_id: Uuid = match Uuid::parse_str(&claims.sub) {
        Ok(uid) => uid,
        Err(_) => return IoError::Unauthorized.into_response(),
    };

    let result = match sqlx::query(
        r#"
        UPDATE design_objects SET deleted_at = NOW()
        WHERE id = $1
          AND type = 'console_workspace'
          AND deleted_at IS NULL
          AND (created_by = $2 OR $3::boolean)
        RETURNING id
        "#,
    )
    .bind(id)
    .bind(user_id)
    .bind(is_admin(&claims))
    .fetch_optional(&state.db)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(error = %e, "delete_workspace query failed");
            return IoError::Database(e).into_response();
        }
    };

    if result.is_none() {
        return IoError::NotFound(format!("Workspace {} not found", id)).into_response();
    }

    Json(ApiResponse::ok(serde_json::json!({ "id": id }))).into_response()
}

// ---------------------------------------------------------------------------
// POST /api/console/workspaces/:id/recover — admin only
// ---------------------------------------------------------------------------

pub async fn recover_workspace(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    if !is_admin(&claims) {
        return IoError::Forbidden("Admin permission required".into()).into_response();
    }

    let result = match sqlx::query(
        "UPDATE design_objects SET deleted_at = NULL WHERE id = $1 AND type = 'console_workspace' AND deleted_at IS NOT NULL RETURNING id",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(error = %e, "recover_workspace query failed");
            return IoError::Database(e).into_response();
        }
    };

    if result.is_none() {
        return IoError::NotFound(format!("Deleted workspace {} not found", id)).into_response();
    }

    Json(ApiResponse::ok(serde_json::json!({ "id": id, "recovered": true }))).into_response()
}

// ---------------------------------------------------------------------------
// DELETE /api/console/workspaces/:id/permanent — admin only hard delete
// ---------------------------------------------------------------------------

pub async fn permanent_delete_workspace(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    if !is_admin(&claims) {
        return IoError::Forbidden("Admin permission required".into()).into_response();
    }

    let user_id = match claims.sub.parse::<Uuid>() {
        Ok(u) => u,
        Err(_) => return IoError::Internal("Invalid user ID in token".into()).into_response(),
    };

    let result = match sqlx::query(
        "DELETE FROM design_objects WHERE id = $1 AND type = 'console_workspace' AND deleted_at IS NOT NULL RETURNING id",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(error = %e, "permanent_delete_workspace query failed");
            return IoError::Database(e).into_response();
        }
    };

    if result.is_none() {
        return IoError::NotFound(
            format!("Workspace {} not found or not soft-deleted", id),
        )
        .into_response();
    }

    let audit_meta = serde_json::json!({
        "workspace_id": id.to_string(),
        "action": "permanent_delete",
    });
    let db = state.db.clone();
    tokio::spawn(async move {
        let _ = sqlx::query(
            "INSERT INTO audit_log \
             (id, table_name, action, record_id, user_id, changes) \
             VALUES ($1, $2, $3, $4, $5, $6)",
        )
        .bind(Uuid::new_v4())
        .bind("design_objects")
        .bind("object.permanent_delete")
        .bind(id)
        .bind(user_id)
        .bind(audit_meta)
        .execute(&db)
        .await;
    });

    Json(ApiResponse::ok(serde_json::json!({ "id": id, "permanently_deleted": true }))).into_response()
}

// ---------------------------------------------------------------------------
// PUT /api/console/workspaces/:id — update workspace name or config
// ---------------------------------------------------------------------------

pub async fn update_workspace(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateWorkspaceBody>,
) -> impl IntoResponse {
    let user_id: Uuid = match Uuid::parse_str(&claims.sub) {
        Ok(uid) => uid,
        Err(_) => return IoError::Unauthorized.into_response(),
    };

    let row = match sqlx::query(
        r#"
        UPDATE design_objects
        SET name     = COALESCE($3, name),
            metadata = COALESCE($4, metadata)
        WHERE id = $1
          AND type = 'console_workspace'
          AND deleted_at IS NULL
          AND created_by = $2
        RETURNING id, name, metadata, published, created_at
        "#,
    )
    .bind(id)
    .bind(user_id)
    .bind(&body.name)
    .bind(&body.metadata)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(r)) => r,
        Ok(None) => {
            return IoError::NotFound(format!("Workspace {} not found", id)).into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "update_workspace query failed");
            return IoError::Database(e).into_response();
        }
    };

    let ws = WorkspaceSummary {
        id: row.try_get("id").unwrap_or(id),
        name: row.try_get("name").unwrap_or_default(),
        metadata: row.try_get("metadata").ok().flatten(),
        published: row.try_get("published").unwrap_or(false),
        created_at: row.try_get("created_at").unwrap_or_else(|_| Utc::now()),
    };

    // Snapshot only for explicit saves, not autosaves (autosave names use __autosave_ prefix)
    let saved_name: String = ws.name.clone();
    let created_by = match claims.sub.parse::<Uuid>() {
        Ok(u) => u,
        Err(_) => {
            tracing::warn!("update_workspace: invalid user ID in token, skipping version snapshot");
            Uuid::nil()
        }
    };
    if !created_by.is_nil() && !saved_name.starts_with("__autosave_") {
        let ws_metadata = ws.metadata.clone();
        let version_metadata = compute_workspace_version_metadata(&ws_metadata, &None);
        let layout_snap = ws_metadata.unwrap_or(serde_json::json!({}));
        let label = body.label.clone();
        let db = state.db.clone();
        tokio::spawn(async move {
            if let Err(e) = create_workspace_version_snapshot(
                &db,
                id,
                created_by,
                "save",
                &layout_snap,
                &version_metadata,
                label,
            )
            .await
            {
                tracing::warn!(error = %e, workspace_id = %id, "Workspace version snapshot creation failed (non-fatal)");
            }
        });
    }

    Json(ApiResponse::ok(ws)).into_response()
}

// ---------------------------------------------------------------------------
// POST /api/console/workspaces/:id/publish — mark workspace as published
// ---------------------------------------------------------------------------

pub async fn publish_workspace(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let user_id: Uuid = match Uuid::parse_str(&claims.sub) {
        Ok(uid) => uid,
        Err(_) => return IoError::Unauthorized.into_response(),
    };

    if !check_permission(&claims, "console:workspace_publish") {
        return IoError::Forbidden("console:workspace_publish permission required".into())
            .into_response();
    }

    let row = if is_admin(&claims) {
        sqlx::query(
            r#"
            UPDATE design_objects
            SET published = true
            WHERE id = $1
              AND type = 'console_workspace'
              AND deleted_at IS NULL
            RETURNING id, name, metadata
            "#,
        )
        .bind(id)
        .fetch_optional(&state.db)
        .await
    } else {
        sqlx::query(
            r#"
            UPDATE design_objects
            SET published = true
            WHERE id = $1
              AND type = 'console_workspace'
              AND created_by = $2
              AND deleted_at IS NULL
            RETURNING id, name, metadata
            "#,
        )
        .bind(id)
        .bind(user_id)
        .fetch_optional(&state.db)
        .await
    };

    let row = match row {
        Ok(Some(r)) => r,
        Ok(None) => {
            return IoError::NotFound(format!("Workspace {} not found", id)).into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "publish_workspace query failed");
            return IoError::Database(e).into_response();
        }
    };

    let ws_metadata: Option<JsonValue> = row.try_get("metadata").ok().flatten();
    let version_metadata = compute_workspace_version_metadata(&ws_metadata, &None);
    let layout_snap = ws_metadata.unwrap_or(serde_json::json!({}));

    match create_workspace_version_snapshot(
        &state.db,
        id,
        user_id,
        "publish",
        &layout_snap,
        &version_metadata,
        None,
    )
    .await
    {
        Ok(version) => {
            tracing::info!(workspace_id = %id, version = version, "Workspace published");
            Json(ApiResponse::ok(serde_json::json!({
                "version": version,
                "published": true,
            })))
            .into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "publish_workspace version snapshot failed");
            IoError::Database(e).into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// POST /api/console/workspaces/:id/unpublish — clear published flag
// ---------------------------------------------------------------------------

pub async fn unpublish_workspace(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    if !check_permission(&claims, "console:workspace_publish") {
        return IoError::Forbidden("console:workspace_publish permission required".into())
            .into_response();
    }

    let user_id = match claims.sub.parse::<Uuid>() {
        Ok(u) => u,
        Err(_) => return IoError::Internal("Invalid user ID in token".into()).into_response(),
    };

    let result = if is_admin(&claims) {
        sqlx::query(
            "UPDATE design_objects SET published = false WHERE id = $1 AND type = 'console_workspace' AND deleted_at IS NULL RETURNING id",
        )
        .bind(id)
        .fetch_optional(&state.db)
        .await
    } else {
        sqlx::query(
            "UPDATE design_objects SET published = false WHERE id = $1 AND type = 'console_workspace' AND deleted_at IS NULL AND created_by = $2 RETURNING id",
        )
        .bind(id)
        .bind(user_id)
        .fetch_optional(&state.db)
        .await
    };

    match result {
        Ok(Some(_)) => {
            tracing::info!(workspace_id = %id, "Workspace unpublished");
            Json(ApiResponse::ok(serde_json::json!({ "published": false }))).into_response()
        }
        Ok(None) => {
            IoError::NotFound(format!("Workspace {} not found or not owned by you", id))
                .into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "unpublish_workspace query failed");
            IoError::Database(e).into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// POST /api/console/workspaces/:id/share — share workspace with users/roles
// ---------------------------------------------------------------------------

pub async fn share_workspace(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<ShareWorkspaceBody>,
) -> impl IntoResponse {
    let user_id: Uuid = match Uuid::parse_str(&claims.sub) {
        Ok(uid) => uid,
        Err(_) => return IoError::Unauthorized.into_response(),
    };

    let shared_patch = serde_json::json!({
        "shared_with_users": body.users.unwrap_or_default(),
        "shared_with_roles": body.roles.unwrap_or_default(),
    });

    let result = match sqlx::query(
        r#"
        UPDATE design_objects
        SET metadata = metadata || $3::jsonb
        WHERE id = $1
          AND type = 'console_workspace'
          AND created_by = $2
        RETURNING id
        "#,
    )
    .bind(id)
    .bind(user_id)
    .bind(&shared_patch)
    .fetch_optional(&state.db)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(error = %e, "share_workspace query failed");
            return IoError::Database(e).into_response();
        }
    };

    if result.is_none() {
        return IoError::NotFound(format!("Workspace {} not found", id)).into_response();
    }

    Json(ApiResponse::ok(
        serde_json::json!({ "id": id, "shared": true }),
    ))
    .into_response()
}

// ---------------------------------------------------------------------------
// POST /api/console/workspaces/:id/duplicate — copy workspace for this user
// ---------------------------------------------------------------------------

pub async fn duplicate_workspace(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<DuplicateWorkspaceBody>,
) -> impl IntoResponse {
    let user_id: Uuid = match Uuid::parse_str(&claims.sub) {
        Ok(uid) => uid,
        Err(_) => return IoError::Unauthorized.into_response(),
    };

    let src = match sqlx::query(
        r#"
        SELECT name, metadata
        FROM design_objects
        WHERE id = $1
          AND type = 'console_workspace'
          AND created_by = $2
        "#,
    )
    .bind(id)
    .bind(user_id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(r)) => r,
        Ok(None) => {
            return IoError::NotFound(format!("Workspace {} not found", id)).into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "duplicate_workspace source query failed");
            return IoError::Database(e).into_response();
        }
    };

    let src_name: String = src.try_get("name").unwrap_or_default();
    let src_meta: Option<JsonValue> = src.try_get("metadata").ok().flatten();
    let new_name = body.name.unwrap_or_else(|| format!("{} (Copy)", src_name));
    let new_id = Uuid::new_v4();

    // Strip sharing / published flags from the copy
    let new_meta = src_meta.map(|mut m| {
        if let Some(obj) = m.as_object_mut() {
            obj.remove("published");
            obj.remove("shared_with_users");
            obj.remove("shared_with_roles");
        }
        m
    });

    let row = match sqlx::query(
        r#"
        INSERT INTO design_objects
            (id, name, type, svg_data, bindings, metadata, parent_id, created_by)
        VALUES ($1, $2, 'console_workspace', NULL, '{}'::jsonb, $3, NULL, $4)
        RETURNING id, name, metadata, published, created_at
        "#,
    )
    .bind(new_id)
    .bind(&new_name)
    .bind(&new_meta)
    .bind(user_id)
    .fetch_one(&state.db)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(error = %e, "duplicate_workspace insert failed");
            return IoError::Database(e).into_response();
        }
    };

    let ws = WorkspaceSummary {
        id: row.try_get("id").unwrap_or(new_id),
        name: row.try_get("name").unwrap_or_default(),
        metadata: row.try_get("metadata").ok().flatten(),
        published: row.try_get("published").unwrap_or(false),
        created_at: row.try_get("created_at").unwrap_or_else(|_| Utc::now()),
    };

    Json(ApiResponse::ok(ws)).into_response()
}

// ---------------------------------------------------------------------------
// POST /api/console/workspaces/snapshots — create a throw-away workspace
// snapshot at video export submit time. Always mints a fresh UUID and uses
// type='console_workspace_snapshot' so it is invisible in normal workspace
// lists. The video export service deletes it after the job reaches a terminal
// state.
// ---------------------------------------------------------------------------

pub async fn create_workspace_snapshot(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateWorkspaceBody>,
) -> impl IntoResponse {
    let user_id: Uuid = match Uuid::parse_str(&claims.sub) {
        Ok(id) => id,
        Err(_) => return IoError::Unauthorized.into_response(),
    };

    if !check_permission(&claims, "console:video_export") {
        return IoError::Forbidden("console:video_export permission required".into())
            .into_response();
    }

    let metadata = body
        .metadata
        .unwrap_or_else(|| JsonValue::Object(serde_json::Map::new()));

    let row = match sqlx::query(
        r#"
        INSERT INTO design_objects
            (id, name, type, svg_data, bindings, metadata, parent_id, created_by)
        VALUES (gen_random_uuid(), $1, 'console_workspace_snapshot', NULL,
                '{}'::jsonb, $2, NULL, $3)
        RETURNING id, name, metadata, published, created_at
        "#,
    )
    .bind(body.name.trim())
    .bind(&metadata)
    .bind(user_id)
    .fetch_one(&state.db)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(error = %e, "create_workspace_snapshot insert failed");
            return IoError::Database(e).into_response();
        }
    };

    let ws = WorkspaceSummary {
        id: row.try_get("id").unwrap_or_else(|_| Uuid::new_v4()),
        name: row.try_get("name").unwrap_or_default(),
        metadata: row.try_get("metadata").ok().flatten(),
        published: row.try_get("published").unwrap_or(false),
        created_at: row.try_get("created_at").unwrap_or_else(|_| Utc::now()),
    };

    Json(ApiResponse::ok(ws)).into_response()
}

// ---------------------------------------------------------------------------
// GET /api/console/workspaces/:id/versions — list version history
// ---------------------------------------------------------------------------

pub async fn list_workspace_versions(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Query(query): Query<ListWorkspaceVersionsQuery>,
) -> impl IntoResponse {
    let user_id: Uuid = match claims.sub.parse::<Uuid>() {
        Ok(u) => u,
        Err(_) => return IoError::Unauthorized.into_response(),
    };

    // Must own the workspace or it must be published (or be admin)
    let has_access: bool = match sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM design_objects WHERE id = $1 AND type = 'console_workspace' AND (created_by = $2 OR COALESCE(published, false) = true OR $3))",
    )
    .bind(id)
    .bind(user_id)
    .bind(is_admin(&claims))
    .fetch_one(&state.db)
    .await
    {
        Ok(v) => v,
        Err(e) => {
            tracing::error!(error = %e, "list_workspace_versions access check failed");
            return IoError::Database(e).into_response();
        }
    };

    if !has_access {
        return IoError::Forbidden("Not authorized to view this workspace".into()).into_response();
    }

    let include_deleted = query.include_deleted.unwrap_or(false) && is_admin(&claims);
    let deleted_filter = if include_deleted {
        ""
    } else {
        "AND v.deleted_at IS NULL"
    };

    let sql = format!(
        r#"
        SELECT v.id, v.version_number, v.version_type, v.label,
               v.parent_version_number, v.metadata, v.created_by,
               v.created_at, v.deleted_at,
               u.display_name AS created_by_name
        FROM workspace_versions v
        LEFT JOIN users u ON u.id = v.created_by
        WHERE v.workspace_id = $1 {deleted_filter}
        ORDER BY v.version_number DESC
        "#,
        deleted_filter = deleted_filter,
    );

    let rows = match sqlx::query(&sql)
        .bind(id)
        .fetch_all(&state.db)
        .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(error = %e, "list_workspace_versions query failed");
            return IoError::Database(e).into_response();
        }
    };

    let versions: Vec<WorkspaceVersionSummary> = rows
        .iter()
        .filter_map(|row| {
            Some(WorkspaceVersionSummary {
                id: row.try_get("id").ok()?,
                version_number: row.try_get("version_number").ok()?,
                version_type: row.try_get("version_type").ok()?,
                label: row.try_get("label").ok().flatten(),
                parent_version_number: row.try_get("parent_version_number").ok().flatten(),
                metadata: row.try_get("metadata").ok().flatten(),
                created_by: row.try_get("created_by").ok()?,
                created_by_name: row.try_get("created_by_name").ok().flatten(),
                created_at: row.try_get("created_at").ok()?,
                deleted_at: row.try_get("deleted_at").ok().flatten(),
            })
        })
        .collect();

    Json(ApiResponse::ok(versions)).into_response()
}

// ---------------------------------------------------------------------------
// GET /api/console/workspaces/:id/versions/:version_number — get version content
// ---------------------------------------------------------------------------

pub async fn get_workspace_version_content(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((id, version_number)): Path<(Uuid, i32)>,
) -> impl IntoResponse {
    let user_id: Uuid = match claims.sub.parse::<Uuid>() {
        Ok(u) => u,
        Err(_) => return IoError::Unauthorized.into_response(),
    };

    let has_access: bool = match sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM design_objects WHERE id = $1 AND type = 'console_workspace' AND (created_by = $2 OR COALESCE(published, false) = true OR $3))",
    )
    .bind(id)
    .bind(user_id)
    .bind(is_admin(&claims))
    .fetch_one(&state.db)
    .await
    {
        Ok(v) => v,
        Err(e) => {
            tracing::error!(error = %e, "get_workspace_version_content access check failed");
            return IoError::Database(e).into_response();
        }
    };

    if !has_access {
        return IoError::Forbidden("Not authorized to view this workspace".into()).into_response();
    }

    let row = match sqlx::query(
        r#"
        SELECT id, version_number, version_type, label, parent_version_number,
               layout, metadata, created_by, created_at
        FROM workspace_versions
        WHERE workspace_id = $1 AND version_number = $2 AND deleted_at IS NULL
        "#,
    )
    .bind(id)
    .bind(version_number)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(r)) => r,
        Ok(None) => {
            return IoError::NotFound(format!(
                "Version {} of workspace {} not found",
                version_number, id
            ))
            .into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "get_workspace_version_content query failed");
            return IoError::Database(e).into_response();
        }
    };

    let content = WorkspaceVersionContent {
        id: row.try_get("id").unwrap_or_default(),
        version_number: row.try_get("version_number").unwrap_or(0),
        version_type: row.try_get("version_type").unwrap_or_default(),
        label: row.try_get("label").ok().flatten(),
        parent_version_number: row.try_get("parent_version_number").ok().flatten(),
        layout: row.try_get("layout").unwrap_or(serde_json::json!({})),
        metadata: row.try_get("metadata").ok().flatten(),
        created_by: row.try_get("created_by").unwrap_or_default(),
        created_at: row.try_get("created_at").unwrap_or_else(|_| Utc::now()),
    };

    Json(ApiResponse::ok(content)).into_response()
}

// ---------------------------------------------------------------------------
// POST /api/console/workspaces/:id/versions/:version_number/restore
// ---------------------------------------------------------------------------

pub async fn restore_workspace_version(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((id, version_number)): Path<(Uuid, i32)>,
) -> impl IntoResponse {
    let created_by = match claims.sub.parse::<Uuid>() {
        Ok(u) => u,
        Err(_) => return IoError::Unauthorized.into_response(),
    };

    let ver_row = match sqlx::query(
        r#"
        SELECT layout, metadata
        FROM workspace_versions
        WHERE workspace_id = $1 AND version_number = $2 AND deleted_at IS NULL
        "#,
    )
    .bind(id)
    .bind(version_number)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(r)) => r,
        Ok(None) => {
            return IoError::NotFound(format!(
                "Version {} of workspace {} not found",
                version_number, id
            ))
            .into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "restore_workspace_version fetch failed");
            return IoError::Database(e).into_response();
        }
    };

    let layout: JsonValue = ver_row.try_get("layout").unwrap_or(serde_json::json!({}));

    // All mutations inside the advisory-lock transaction for atomicity
    let mut tx = match state.db.begin().await {
        Ok(tx) => tx,
        Err(e) => {
            tracing::error!(error = %e, "restore_workspace_version begin transaction failed");
            return IoError::Database(e).into_response();
        }
    };

    if let Err(e) = sqlx::query("SELECT pg_advisory_xact_lock(hashtext($1::text))")
        .bind(id.to_string())
        .execute(&mut *tx)
        .await
    {
        tracing::error!(error = %e, "restore_workspace_version advisory lock failed");
        return IoError::Database(e).into_response();
    }

    // Ownership check + live-data update inside the transaction
    let update_result = if is_admin(&claims) {
        sqlx::query(
            "UPDATE design_objects SET metadata = $1 WHERE id = $2 AND type = 'console_workspace' RETURNING id",
        )
        .bind(&layout)
        .bind(id)
        .fetch_optional(&mut *tx)
        .await
    } else {
        sqlx::query(
            "UPDATE design_objects SET metadata = $1 WHERE id = $2 AND type = 'console_workspace' AND created_by = $3 RETURNING id",
        )
        .bind(&layout)
        .bind(id)
        .bind(created_by)
        .fetch_optional(&mut *tx)
        .await
    };

    match update_result {
        Ok(Some(_)) => {}
        Ok(None) => {
            return IoError::NotFound(format!(
                "Workspace {} not found or not owned by you",
                id
            ))
            .into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "restore_workspace_version update failed");
            return IoError::Database(e).into_response();
        }
    }

    let next_version: i32 = match sqlx::query_scalar(
        "SELECT COALESCE(MAX(version_number), 0) + 1 FROM workspace_versions WHERE workspace_id = $1",
    )
    .bind(id)
    .fetch_one(&mut *tx)
    .await
    {
        Ok(v) => v,
        Err(e) => {
            tracing::error!(error = %e, "restore_workspace_version next_version query failed");
            return IoError::Database(e).into_response();
        }
    };

    let ws_metadata_opt = Some(layout.clone());
    let version_metadata = compute_workspace_version_metadata(&ws_metadata_opt, &None);
    let restore_label = format!("Restored from v{}", version_number);

    if let Err(e) = sqlx::query(
        r#"
        INSERT INTO workspace_versions
            (id, workspace_id, version_number, version_type, layout,
             metadata, created_by, label, parent_version_number)
        VALUES ($1, $2, $3, 'save', $4, $5, $6, $7, $8)
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(id)
    .bind(next_version)
    .bind(&layout)
    .bind(&version_metadata)
    .bind(created_by)
    .bind(&restore_label)
    .bind(version_number)
    .execute(&mut *tx)
    .await
    {
        tracing::error!(error = %e, "restore_workspace_version insert failed");
        return IoError::Database(e).into_response();
    }

    if let Err(e) = tx.commit().await {
        tracing::error!(error = %e, "restore_workspace_version commit failed");
        return IoError::Database(e).into_response();
    }

    tracing::info!(workspace_id = %id, restored_from = version_number, new_version = next_version, "Workspace version restored");
    Json(ApiResponse::ok(serde_json::json!({
        "version_number": next_version,
        "restored_from": version_number,
    })))
    .into_response()
}

// ---------------------------------------------------------------------------
// DELETE /api/console/workspaces/:id/versions/:version_number — soft-delete
// ---------------------------------------------------------------------------

pub async fn soft_delete_workspace_version(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((id, version_number)): Path<(Uuid, i32)>,
) -> impl IntoResponse {
    let user_id = match claims.sub.parse::<Uuid>() {
        Ok(u) => u,
        Err(_) => return IoError::Internal("Invalid user ID in token".into()).into_response(),
    };

    let result = if is_admin(&claims) {
        sqlx::query(
            r#"
            UPDATE workspace_versions SET deleted_at = NOW()
            WHERE workspace_id = $1 AND version_number = $2 AND deleted_at IS NULL
            RETURNING id
            "#,
        )
        .bind(id)
        .bind(version_number)
        .fetch_optional(&state.db)
        .await
    } else {
        sqlx::query(
            r#"
            UPDATE workspace_versions SET deleted_at = NOW()
            WHERE workspace_id = $1 AND version_number = $2
              AND created_by = $3 AND deleted_at IS NULL
            RETURNING id
            "#,
        )
        .bind(id)
        .bind(version_number)
        .bind(user_id)
        .fetch_optional(&state.db)
        .await
    };

    match result {
        Ok(Some(_)) => {
            tracing::info!(workspace_id = %id, version = version_number, "Workspace version soft-deleted");
            Json(ApiResponse::ok(serde_json::json!({ "deleted": true }))).into_response()
        }
        Ok(None) => IoError::NotFound(format!(
            "Version {} of workspace {} not found or not owned by you",
            version_number, id
        ))
        .into_response(),
        Err(e) => {
            tracing::error!(error = %e, "soft_delete_workspace_version query failed");
            IoError::Database(e).into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// POST /api/console/workspaces/:id/versions/:version_number/recover (admin)
// ---------------------------------------------------------------------------

pub async fn recover_workspace_version(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((id, version_number)): Path<(Uuid, i32)>,
) -> impl IntoResponse {
    if !is_admin(&claims) {
        return IoError::Forbidden("Admin access required".into()).into_response();
    }

    let result = match sqlx::query(
        r#"
        UPDATE workspace_versions SET deleted_at = NULL
        WHERE workspace_id = $1 AND version_number = $2 AND deleted_at IS NOT NULL
        RETURNING id
        "#,
    )
    .bind(id)
    .bind(version_number)
    .fetch_optional(&state.db)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(error = %e, "recover_workspace_version query failed");
            return IoError::Database(e).into_response();
        }
    };

    match result {
        Some(_) => {
            tracing::info!(workspace_id = %id, version = version_number, "Workspace version recovered");
            Json(ApiResponse::ok(serde_json::json!({ "recovered": true }))).into_response()
        }
        None => IoError::NotFound(format!(
            "Soft-deleted version {} of workspace {} not found",
            version_number, id
        ))
        .into_response(),
    }
}

// ---------------------------------------------------------------------------
// DELETE /api/console/workspaces/:id/versions/:version_number/permanent (admin)
// ---------------------------------------------------------------------------

pub async fn permanent_delete_workspace_version(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((id, version_number)): Path<(Uuid, i32)>,
) -> impl IntoResponse {
    if !is_admin(&claims) {
        return IoError::Forbidden("Admin access required".into()).into_response();
    }

    let user_id = match claims.sub.parse::<Uuid>() {
        Ok(u) => u,
        Err(_) => return IoError::Internal("Invalid user ID in token".into()).into_response(),
    };

    let result = match sqlx::query(
        r#"
        DELETE FROM workspace_versions
        WHERE workspace_id = $1 AND version_number = $2
        RETURNING id
        "#,
    )
    .bind(id)
    .bind(version_number)
    .fetch_optional(&state.db)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(error = %e, "permanent_delete_workspace_version query failed");
            return IoError::Database(e).into_response();
        }
    };

    match result {
        Some(row) => {
            let version_uuid: Uuid = row.try_get("id").unwrap_or_default();
            let audit_meta = serde_json::json!({
                "workspace_id": id.to_string(),
                "version_number": version_number,
                "action": "permanent_delete",
            });
            let db = state.db.clone();
            tokio::spawn(async move {
                let _ = sqlx::query(
                    "INSERT INTO audit_log \
                     (id, table_name, action, record_id, user_id, changes) \
                     VALUES ($1, $2, $3, $4, $5, $6)",
                )
                .bind(Uuid::new_v4())
                .bind("workspace_versions")
                .bind("version.permanent_delete")
                .bind(version_uuid)
                .bind(user_id)
                .bind(audit_meta)
                .execute(&db)
                .await;
            });

            tracing::info!(workspace_id = %id, version = version_number, "Workspace version permanently deleted");
            Json(ApiResponse::ok(
                serde_json::json!({ "permanently_deleted": true }),
            ))
            .into_response()
        }
        None => IoError::NotFound(format!(
            "Version {} of workspace {} not found",
            version_number, id
        ))
        .into_response(),
    }
}

// ---------------------------------------------------------------------------
// PATCH /api/console/workspaces/:id/versions/:version_number — update label
// ---------------------------------------------------------------------------

pub async fn update_workspace_version_label(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((id, version_number)): Path<(Uuid, i32)>,
    Json(body): Json<UpdateWorkspaceVersionLabelBody>,
) -> impl IntoResponse {
    let user_id = match claims.sub.parse::<Uuid>() {
        Ok(u) => u,
        Err(_) => return IoError::Internal("Invalid user ID in token".into()).into_response(),
    };

    let result = if is_admin(&claims) {
        sqlx::query(
            r#"
            UPDATE workspace_versions SET label = $1
            WHERE workspace_id = $2 AND version_number = $3 AND deleted_at IS NULL
            RETURNING id, label
            "#,
        )
        .bind(&body.label)
        .bind(id)
        .bind(version_number)
        .fetch_optional(&state.db)
        .await
    } else {
        sqlx::query(
            r#"
            UPDATE workspace_versions SET label = $1
            WHERE workspace_id = $2 AND version_number = $3
              AND created_by = $4 AND deleted_at IS NULL
            RETURNING id, label
            "#,
        )
        .bind(&body.label)
        .bind(id)
        .bind(version_number)
        .bind(user_id)
        .fetch_optional(&state.db)
        .await
    };

    match result {
        Ok(Some(row)) => {
            let label: Option<String> = row.try_get("label").ok().flatten();
            Json(ApiResponse::ok(serde_json::json!({
                "version_number": version_number,
                "label": label,
            })))
            .into_response()
        }
        Ok(None) => IoError::NotFound(format!(
            "Version {} of workspace {} not found or not owned by you",
            version_number, id
        ))
        .into_response(),
        Err(e) => {
            tracing::error!(error = %e, "update_workspace_version_label query failed");
            IoError::Database(e).into_response()
        }
    }
}
