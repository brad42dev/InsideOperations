use axum::{
    extract::{Path, Query, State},
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

use crate::{file_scan, state::AppState, tiles};

// ---------------------------------------------------------------------------
// Permission helper
// ---------------------------------------------------------------------------

fn check_permission(claims: &Claims, permission: &str) -> bool {
    claims.permissions.iter().any(|p| p == "*" || p == permission)
}

// ---------------------------------------------------------------------------
// Request / Response types
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct DesignObjectTypeFilter {
    #[serde(rename = "type")]
    pub object_type: Option<String>,
}

/// Body for creating or updating a design object / graphic.
#[derive(Debug, Deserialize)]
pub struct UpsertDesignObjectBody {
    pub name: String,
    #[serde(rename = "type")]
    pub object_type: String,
    pub svg_data: Option<String>,
    pub bindings: Option<JsonValue>,
    pub metadata: Option<JsonValue>,
    pub parent_id: Option<Uuid>,
}

/// Summary item returned in list responses (no svg_data).
#[derive(Debug, Serialize)]
pub struct GraphicSummary {
    pub id: Uuid,
    pub name: String,
    #[serde(rename = "type")]
    pub object_type: String,
    pub created_at: DateTime<Utc>,
    pub created_by: Option<Uuid>,
    pub bindings_count: i64,
}

/// Full item returned in get-single responses.
#[derive(Debug, Serialize)]
pub struct GraphicDetail {
    pub id: Uuid,
    pub name: String,
    #[serde(rename = "type")]
    pub object_type: String,
    pub svg_data: Option<String>,
    pub bindings: Option<JsonValue>,
    pub metadata: Option<JsonValue>,
    pub parent_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub created_by: Option<Uuid>,
}

/// Response for GET /api/graphics/:id/tile-info
#[derive(Debug, Serialize)]
pub struct TileInfoResponse {
    /// Base URL (relative) for tile PNGs, e.g. "/tiles/graphics/abc123/"
    pub tile_base_url: String,
    pub max_zoom: u8,
    pub tile_size: u32,
    /// SVG canvas width in pixels (derived from the stored SVG viewBox / size)
    pub width: u32,
    /// SVG canvas height in pixels
    pub height: u32,
}

// ---------------------------------------------------------------------------
// Helpers — parse a row into GraphicDetail
// ---------------------------------------------------------------------------

fn row_to_detail(row: &sqlx::postgres::PgRow) -> Result<GraphicDetail, sqlx::Error> {
    let id: Uuid = row.try_get("id")?;
    let name: String = row.try_get("name")?;
    let object_type: String = row.try_get("type")?;
    let svg_data: Option<String> = row.try_get("svg_data").ok().flatten();
    let bindings: Option<JsonValue> = row.try_get("bindings").ok().flatten();
    let metadata: Option<JsonValue> = row.try_get("metadata").ok().flatten();
    let parent_id: Option<Uuid> = row.try_get("parent_id").ok().flatten();
    let created_at: DateTime<Utc> = row.try_get("created_at")?;
    let created_by: Option<Uuid> = row.try_get("created_by").ok().flatten();
    Ok(GraphicDetail { id, name, object_type, svg_data, bindings, metadata, parent_id, created_at, created_by })
}

// ---------------------------------------------------------------------------
// GET /api/graphics — list graphics (type = 'graphic')
// ---------------------------------------------------------------------------

pub async fn list_graphics(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> impl IntoResponse {
    if !check_permission(&claims, "designer:read") {
        return IoError::Forbidden("designer:read permission required".into()).into_response();
    }

    let rows = match sqlx::query(
        r#"
        SELECT
            id,
            name,
            type,
            created_at,
            created_by,
            (
                SELECT count(*)::bigint
                FROM jsonb_object_keys(COALESCE(bindings, '{}'::jsonb)) k
            ) AS bindings_count
        FROM design_objects
        WHERE type = 'graphic'
        ORDER BY created_at DESC
        "#,
    )
    .fetch_all(&state.db)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(error = %e, "list_graphics query failed");
            return IoError::Database(e).into_response();
        }
    };

    let mut items: Vec<GraphicSummary> = Vec::with_capacity(rows.len());
    for row in &rows {
        let id: Uuid = match row.try_get("id") {
            Ok(v) => v,
            Err(e) => {
                tracing::warn!(error = %e, "skipping row with bad id");
                continue;
            }
        };
        let name: String = row.try_get("name").unwrap_or_default();
        let object_type: String = row.try_get("type").unwrap_or_default();
        let created_at: DateTime<Utc> = match row.try_get("created_at") {
            Ok(v) => v,
            Err(_) => Utc::now(),
        };
        let created_by: Option<Uuid> = row.try_get("created_by").ok().flatten();
        let bindings_count: i64 = row.try_get("bindings_count").unwrap_or(0);
        items.push(GraphicSummary { id, name, object_type, created_at, created_by, bindings_count });
    }

    Json(ApiResponse::ok(items)).into_response()
}

// ---------------------------------------------------------------------------
// POST /api/graphics — create graphic
// ---------------------------------------------------------------------------

pub async fn create_graphic(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<UpsertDesignObjectBody>,
) -> impl IntoResponse {
    if !check_permission(&claims, "designer:write") {
        return IoError::Forbidden("designer:write permission required".into()).into_response();
    }

    if body.name.trim().is_empty() {
        return IoError::BadRequest("name is required".into()).into_response();
    }

    // Scan SVG content for malicious payloads before storing
    if let Some(ref svg) = body.svg_data {
        if let Err(e) = file_scan::check_upload(svg.as_bytes(), &body.name) {
            return e.into_response();
        }
    }

    // Force type to 'graphic' for this endpoint
    let object_type = "graphic".to_string();
    let id = Uuid::new_v4();
    let created_by: Option<Uuid> = Uuid::parse_str(&claims.sub).ok();
    let bindings = body.bindings.unwrap_or(JsonValue::Object(serde_json::Map::new()));
    let metadata = body.metadata.unwrap_or(JsonValue::Object(serde_json::Map::new()));

    let row = match sqlx::query(
        r#"
        INSERT INTO design_objects
            (id, name, type, svg_data, bindings, metadata, parent_id, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, name, type, svg_data, bindings, metadata, parent_id, created_at, created_by
        "#,
    )
    .bind(id)
    .bind(&body.name)
    .bind(&object_type)
    .bind(&body.svg_data)
    .bind(&bindings)
    .bind(&metadata)
    .bind(body.parent_id)
    .bind(created_by)
    .fetch_one(&state.db)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(error = %e, "create_graphic insert failed");
            return IoError::Database(e).into_response();
        }
    };

    // Spawn tile generation in background (non-blocking)
    if let Some(ref svg) = body.svg_data {
        let svg_clone = svg.clone();
        let id_str = id.to_string();
        let tile_cfg = tiles::TileConfig {
            storage_dir: state.config.tile_storage_dir.clone(),
            max_zoom: state.config.tile_max_zoom,
            tile_size: state.config.tile_size,
        };
        tokio::spawn(async move {
            match tiles::generate_tiles(&svg_clone, &id_str, &tile_cfg) {
                Ok((count, w, h)) => tracing::info!(
                    graphic_id = %id_str,
                    tiles = count,
                    width = w,
                    height = h,
                    "Tile pyramid generated"
                ),
                Err(e) => tracing::warn!(
                    graphic_id = %id_str,
                    error = %e,
                    "Tile generation failed"
                ),
            }
        });
    }

    match row_to_detail(&row) {
        Ok(detail) => Json(ApiResponse::ok(detail)).into_response(),
        Err(e) => {
            tracing::error!(error = %e, "create_graphic row mapping failed");
            IoError::Internal("Failed to map created graphic".into()).into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// GET /api/graphics/:id — get graphic with bindings
// ---------------------------------------------------------------------------

pub async fn get_graphic(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    if !check_permission(&claims, "designer:read") {
        return IoError::Forbidden("designer:read permission required".into()).into_response();
    }

    let row = match sqlx::query(
        r#"
        SELECT id, name, type, svg_data, bindings, metadata, parent_id, created_at, created_by
        FROM design_objects
        WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(r)) => r,
        Ok(None) => return IoError::NotFound(format!("Graphic {} not found", id)).into_response(),
        Err(e) => {
            tracing::error!(error = %e, "get_graphic query failed");
            return IoError::Database(e).into_response();
        }
    };

    match row_to_detail(&row) {
        Ok(detail) => Json(ApiResponse::ok(detail)).into_response(),
        Err(e) => {
            tracing::error!(error = %e, "get_graphic row mapping failed");
            IoError::Internal("Failed to map graphic".into()).into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// PUT /api/graphics/:id — update graphic
// ---------------------------------------------------------------------------

pub async fn update_graphic(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpsertDesignObjectBody>,
) -> impl IntoResponse {
    if !check_permission(&claims, "designer:write") {
        return IoError::Forbidden("designer:write permission required".into()).into_response();
    }

    if body.name.trim().is_empty() {
        return IoError::BadRequest("name is required".into()).into_response();
    }

    let bindings = body.bindings.unwrap_or(JsonValue::Object(serde_json::Map::new()));
    let metadata = body.metadata.unwrap_or(JsonValue::Object(serde_json::Map::new()));

    let row = match sqlx::query(
        r#"
        UPDATE design_objects
        SET
            name      = $1,
            svg_data  = $2,
            bindings  = $3,
            metadata  = $4,
            parent_id = $5
        WHERE id = $6
        RETURNING id, name, type, svg_data, bindings, metadata, parent_id, created_at, created_by
        "#,
    )
    .bind(&body.name)
    .bind(&body.svg_data)
    .bind(&bindings)
    .bind(&metadata)
    .bind(body.parent_id)
    .bind(id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(r)) => r,
        Ok(None) => return IoError::NotFound(format!("Graphic {} not found", id)).into_response(),
        Err(e) => {
            tracing::error!(error = %e, "update_graphic query failed");
            return IoError::Database(e).into_response();
        }
    };

    // Rebuild tile pyramid when SVG content is updated
    if let Some(ref svg) = body.svg_data {
        let svg_clone = svg.clone();
        let id_str = id.to_string();
        let tile_cfg = tiles::TileConfig {
            storage_dir: state.config.tile_storage_dir.clone(),
            max_zoom: state.config.tile_max_zoom,
            tile_size: state.config.tile_size,
        };
        tokio::spawn(async move {
            // Remove stale tiles before regenerating
            if let Err(e) = tiles::delete_tiles(&id_str, &tile_cfg.storage_dir) {
                tracing::warn!(graphic_id = %id_str, error = %e, "Failed to remove stale tiles");
            }
            match tiles::generate_tiles(&svg_clone, &id_str, &tile_cfg) {
                Ok((count, w, h)) => tracing::info!(
                    graphic_id = %id_str,
                    tiles = count,
                    width = w,
                    height = h,
                    "Tile pyramid regenerated"
                ),
                Err(e) => tracing::warn!(
                    graphic_id = %id_str,
                    error = %e,
                    "Tile regeneration failed"
                ),
            }
        });
    }

    match row_to_detail(&row) {
        Ok(detail) => Json(ApiResponse::ok(detail)).into_response(),
        Err(e) => {
            tracing::error!(error = %e, "update_graphic row mapping failed");
            IoError::Internal("Failed to map updated graphic".into()).into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// DELETE /api/graphics/:id — delete graphic
// ---------------------------------------------------------------------------

pub async fn delete_graphic(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    if !check_permission(&claims, "designer:write") {
        return IoError::Forbidden("designer:write permission required".into()).into_response();
    }

    let result = match sqlx::query(
        "DELETE FROM design_objects WHERE id = $1 RETURNING id",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(error = %e, "delete_graphic query failed");
            return IoError::Database(e).into_response();
        }
    };

    if result.is_none() {
        return IoError::NotFound(format!("Graphic {} not found", id)).into_response();
    }

    // Delete tile pyramid (best-effort — log but don't fail the request)
    let id_str = id.to_string();
    let storage_dir = state.config.tile_storage_dir.clone();
    tokio::spawn(async move {
        if let Err(e) = tiles::delete_tiles(&id_str, &storage_dir) {
            tracing::warn!(graphic_id = %id_str, error = %e, "Failed to remove tiles on graphic delete");
        }
    });

    Json(ApiResponse::ok(serde_json::json!({ "id": id }))).into_response()
}

// ---------------------------------------------------------------------------
// GET /api/graphics/:id/tile-info
// ---------------------------------------------------------------------------

pub async fn get_tile_info(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    if !check_permission(&claims, "designer:read") {
        return IoError::Forbidden("designer:read permission required".into()).into_response();
    }

    // Fetch the graphic to determine SVG dimensions
    let row = match sqlx::query(
        r#"
        SELECT id, name, type, svg_data, bindings, metadata, parent_id, created_at, created_by
        FROM design_objects
        WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(r)) => r,
        Ok(None) => return IoError::NotFound(format!("Graphic {} not found", id)).into_response(),
        Err(e) => {
            tracing::error!(error = %e, "get_tile_info query failed");
            return IoError::Database(e).into_response();
        }
    };

    // Determine SVG canvas dimensions from metadata or by parsing svg_data
    let metadata: Option<serde_json::Value> = row.try_get("metadata").ok().flatten();
    let svg_data: Option<String> = row.try_get("svg_data").ok().flatten();

    let (width, height) = if let Some(ref m) = metadata {
        let w = m.get("width").and_then(|v| v.as_u64()).unwrap_or(800) as u32;
        let h = m.get("height").and_then(|v| v.as_u64()).unwrap_or(600) as u32;
        (w, h)
    } else if let Some(ref svg) = svg_data {
        // Attempt to parse dimensions from the SVG tree using resvg/usvg
        use resvg::usvg::{Options, Tree};
        match Tree::from_str(svg, &Options::default()) {
            Ok(tree) => {
                let sz = tree.size();
                (sz.width() as u32, sz.height() as u32)
            }
            Err(_) => (800, 600),
        }
    } else {
        (800, 600)
    };

    let tile_base_url = format!("/tiles/graphics/{id}/");

    Json(ApiResponse::ok(TileInfoResponse {
        tile_base_url,
        max_zoom: state.config.tile_max_zoom,
        tile_size: state.config.tile_size,
        width,
        height,
    }))
    .into_response()
}

// ---------------------------------------------------------------------------
// GET /api/design-objects — list shapes/stencils
// ---------------------------------------------------------------------------

pub async fn list_design_objects(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(filter): Query<DesignObjectTypeFilter>,
) -> impl IntoResponse {
    if !check_permission(&claims, "designer:read") {
        return IoError::Forbidden("designer:read permission required".into()).into_response();
    }

    // Only allow shape/stencil types on this endpoint
    let allowed_types = ["shape", "stencil", "symbol", "template"];
    let type_filter: Option<String> = filter.object_type.and_then(|t| {
        if allowed_types.contains(&t.as_str()) { Some(t) } else { None }
    });

    let rows = match type_filter {
        Some(ref t) => {
            sqlx::query(
                r#"
                SELECT
                    id, name, type, svg_data, bindings, metadata, parent_id, created_at, created_by
                FROM design_objects
                WHERE type = $1
                ORDER BY name ASC
                "#,
            )
            .bind(t)
            .fetch_all(&state.db)
            .await
        }
        None => {
            sqlx::query(
                r#"
                SELECT
                    id, name, type, svg_data, bindings, metadata, parent_id, created_at, created_by
                FROM design_objects
                WHERE type IN ('shape', 'stencil', 'symbol', 'template')
                ORDER BY type ASC, name ASC
                "#,
            )
            .fetch_all(&state.db)
            .await
        }
    };

    let rows = match rows {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(error = %e, "list_design_objects query failed");
            return IoError::Database(e).into_response();
        }
    };

    let mut items: Vec<GraphicDetail> = Vec::with_capacity(rows.len());
    for row in &rows {
        match row_to_detail(row) {
            Ok(d) => items.push(d),
            Err(e) => tracing::warn!(error = %e, "skipping malformed design_object row"),
        }
    }

    Json(ApiResponse::ok(items)).into_response()
}

// ---------------------------------------------------------------------------
// POST /api/design-objects — create shape/stencil
// ---------------------------------------------------------------------------

pub async fn create_design_object(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<UpsertDesignObjectBody>,
) -> impl IntoResponse {
    if !check_permission(&claims, "designer:write") {
        return IoError::Forbidden("designer:write permission required".into()).into_response();
    }

    if body.name.trim().is_empty() {
        return IoError::BadRequest("name is required".into()).into_response();
    }

    let allowed_types = ["shape", "stencil", "symbol", "template"];
    if !allowed_types.contains(&body.object_type.as_str()) {
        return IoError::BadRequest(
            "type must be one of: shape, stencil, symbol, template".into(),
        )
        .into_response();
    }

    // Scan SVG content for malicious payloads before storing
    if let Some(ref svg) = body.svg_data {
        if let Err(e) = file_scan::check_upload(svg.as_bytes(), &body.name) {
            return e.into_response();
        }
    }

    let id = Uuid::new_v4();
    let created_by: Option<Uuid> = Uuid::parse_str(&claims.sub).ok();
    let bindings = body.bindings.unwrap_or(JsonValue::Object(serde_json::Map::new()));
    let metadata = body.metadata.unwrap_or(JsonValue::Object(serde_json::Map::new()));

    let row = match sqlx::query(
        r#"
        INSERT INTO design_objects
            (id, name, type, svg_data, bindings, metadata, parent_id, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, name, type, svg_data, bindings, metadata, parent_id, created_at, created_by
        "#,
    )
    .bind(id)
    .bind(&body.name)
    .bind(&body.object_type)
    .bind(&body.svg_data)
    .bind(&bindings)
    .bind(&metadata)
    .bind(body.parent_id)
    .bind(created_by)
    .fetch_one(&state.db)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(error = %e, "create_design_object insert failed");
            return IoError::Database(e).into_response();
        }
    };

    match row_to_detail(&row) {
        Ok(detail) => Json(ApiResponse::ok(detail)).into_response(),
        Err(e) => {
            tracing::error!(error = %e, "create_design_object row mapping failed");
            IoError::Internal("Failed to map created design object".into()).into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// GET /api/design-objects/:id — get one shape/stencil
// ---------------------------------------------------------------------------

pub async fn get_design_object(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    if !check_permission(&claims, "designer:read") {
        return IoError::Forbidden("designer:read permission required".into()).into_response();
    }

    let row = match sqlx::query(
        r#"
        SELECT id, name, type, svg_data, bindings, metadata, parent_id, created_at, created_by
        FROM design_objects
        WHERE id = $1
        "#,
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(r)) => r,
        Ok(None) => {
            return IoError::NotFound(format!("Design object {} not found", id)).into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "get_design_object query failed");
            return IoError::Database(e).into_response();
        }
    };

    match row_to_detail(&row) {
        Ok(detail) => Json(ApiResponse::ok(detail)).into_response(),
        Err(e) => {
            tracing::error!(error = %e, "get_design_object row mapping failed");
            IoError::Internal("Failed to map design object".into()).into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// DELETE /api/design-objects/:id — delete shape/stencil
// ---------------------------------------------------------------------------

pub async fn delete_design_object(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    if !check_permission(&claims, "designer:write") {
        return IoError::Forbidden("designer:write permission required".into()).into_response();
    }

    let result = match sqlx::query(
        "DELETE FROM design_objects WHERE id = $1 RETURNING id",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(error = %e, "delete_design_object query failed");
            return IoError::Database(e).into_response();
        }
    };

    if result.is_none() {
        return IoError::NotFound(format!("Design object {} not found", id)).into_response();
    }

    Json(ApiResponse::ok(serde_json::json!({ "id": id }))).into_response()
}
