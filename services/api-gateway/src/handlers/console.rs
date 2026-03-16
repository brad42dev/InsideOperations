use axum::{
    extract::{Path, State},
    response::IntoResponse,
    Extension, Json,
};
use chrono::{DateTime, Utc};
use io_auth::Claims;
use io_error::IoError;
use io_models::ApiResponse;
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
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateWorkspaceBody {
    pub name: String,
    pub metadata: Option<JsonValue>,
}

// ---------------------------------------------------------------------------
// GET /api/console/workspaces — list workspaces for the authenticated user
// ---------------------------------------------------------------------------

pub async fn list_workspaces(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> impl IntoResponse {
    let user_id: Uuid = match Uuid::parse_str(&claims.sub) {
        Ok(id) => id,
        Err(_) => return IoError::Unauthorized.into_response(),
    };

    let rows = match sqlx::query(
        r#"
        SELECT id, name, metadata, created_at
        FROM design_objects
        WHERE type = 'console_workspace'
          AND created_by = $1
        ORDER BY created_at DESC
        "#,
    )
    .bind(user_id)
    .fetch_all(&state.db)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(error = %e, "list_workspaces query failed");
            return IoError::Database(e).into_response();
        }
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
        let created_at: DateTime<Utc> = row.try_get("created_at").unwrap_or_else(|_| Utc::now());
        items.push(WorkspaceSummary { id, name, metadata, created_at });
    }

    Json(ApiResponse::ok(items)).into_response()
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

    let id = Uuid::new_v4();
    let metadata = body
        .metadata
        .unwrap_or_else(|| JsonValue::Object(serde_json::Map::new()));

    let row = match sqlx::query(
        r#"
        INSERT INTO design_objects
            (id, name, type, svg_data, bindings, metadata, parent_id, created_by)
        VALUES ($1, $2, 'console_workspace', NULL,
                '{}'::jsonb, $3, NULL, $4)
        RETURNING id, name, metadata, created_at
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
            tracing::error!(error = %e, "create_workspace insert failed");
            return IoError::Database(e).into_response();
        }
    };

    let ws = WorkspaceSummary {
        id: row.try_get("id").unwrap_or(id),
        name: row.try_get("name").unwrap_or_default(),
        metadata: row.try_get("metadata").ok().flatten(),
        created_at: row.try_get("created_at").unwrap_or_else(|_| Utc::now()),
    };

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
        SELECT id, name, metadata, created_at
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
        Ok(None) => return IoError::NotFound(format!("Workspace {} not found", id)).into_response(),
        Err(e) => {
            tracing::error!(error = %e, "get_workspace query failed");
            return IoError::Database(e).into_response();
        }
    };

    let ws = WorkspaceSummary {
        id: row.try_get("id").unwrap_or(id),
        name: row.try_get("name").unwrap_or_default(),
        metadata: row.try_get("metadata").ok().flatten(),
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
        DELETE FROM design_objects
        WHERE id = $1
          AND type = 'console_workspace'
          AND created_by = $2
        RETURNING id
        "#,
    )
    .bind(id)
    .bind(user_id)
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
