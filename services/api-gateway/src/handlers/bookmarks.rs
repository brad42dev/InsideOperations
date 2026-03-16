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
pub struct BookmarkItem {
    pub id: Uuid,
    pub entity_type: String,
    pub entity_id: String,
    pub name: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct AddBookmarkBody {
    pub entity_type: String,
    pub entity_id: String,
    pub name: String,
}

// ---------------------------------------------------------------------------
// Helpers — check if user_bookmarks table exists
// We fall back to design_objects with type='bookmark' if not available.
// We always try design_objects approach to keep it simple and portable.
// ---------------------------------------------------------------------------

fn bookmark_metadata(entity_type: &str, entity_id: &str) -> JsonValue {
    serde_json::json!({
        "entity_type": entity_type,
        "entity_id": entity_id,
    })
}

fn extract_bookmark(row: &sqlx::postgres::PgRow) -> Option<BookmarkItem> {
    let id: Uuid = row.try_get("id").ok()?;
    let name: String = row.try_get("name").unwrap_or_default();
    let created_at: DateTime<Utc> = row.try_get("created_at").unwrap_or_else(|_| Utc::now());
    let metadata: Option<JsonValue> = row.try_get("metadata").ok().flatten();

    let (entity_type, entity_id) = if let Some(m) = metadata {
        let et = m
            .get("entity_type")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        let ei = m
            .get("entity_id")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();
        (et, ei)
    } else {
        (String::new(), String::new())
    };

    Some(BookmarkItem { id, entity_type, entity_id, name, created_at })
}

// ---------------------------------------------------------------------------
// GET /api/bookmarks — list user's bookmarks
// ---------------------------------------------------------------------------

pub async fn list_bookmarks(
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
        WHERE type = 'bookmark'
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
            tracing::error!(error = %e, "list_bookmarks query failed");
            return IoError::Database(e).into_response();
        }
    };

    let items: Vec<BookmarkItem> = rows.iter().filter_map(extract_bookmark).collect();
    Json(ApiResponse::ok(items)).into_response()
}

// ---------------------------------------------------------------------------
// POST /api/bookmarks — add bookmark
// ---------------------------------------------------------------------------

pub async fn add_bookmark(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<AddBookmarkBody>,
) -> impl IntoResponse {
    if body.name.trim().is_empty() {
        return IoError::BadRequest("name is required".into()).into_response();
    }
    if body.entity_type.trim().is_empty() || body.entity_id.trim().is_empty() {
        return IoError::BadRequest("entity_type and entity_id are required".into()).into_response();
    }

    let user_id: Uuid = match Uuid::parse_str(&claims.sub) {
        Ok(id) => id,
        Err(_) => return IoError::Unauthorized.into_response(),
    };

    let id = Uuid::new_v4();
    let metadata = bookmark_metadata(&body.entity_type, &body.entity_id);

    let row = match sqlx::query(
        r#"
        INSERT INTO design_objects
            (id, name, type, svg_data, bindings, metadata, parent_id, created_by)
        VALUES ($1, $2, 'bookmark', NULL, '{}'::jsonb, $3, NULL, $4)
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
            tracing::error!(error = %e, "add_bookmark insert failed");
            return IoError::Database(e).into_response();
        }
    };

    match extract_bookmark(&row) {
        Some(bm) => Json(ApiResponse::ok(bm)).into_response(),
        None => IoError::Internal("Failed to map bookmark".into()).into_response(),
    }
}

// ---------------------------------------------------------------------------
// DELETE /api/bookmarks/:id — remove bookmark
// ---------------------------------------------------------------------------

pub async fn remove_bookmark(
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
          AND type = 'bookmark'
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
            tracing::error!(error = %e, "remove_bookmark query failed");
            return IoError::Database(e).into_response();
        }
    };

    if result.is_none() {
        return IoError::NotFound(format!("Bookmark {} not found", id)).into_response();
    }

    Json(ApiResponse::ok(serde_json::json!({ "id": id }))).into_response()
}
