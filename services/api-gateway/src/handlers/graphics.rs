use axum::{
    extract::{Multipart, Path, Query, State},
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
    /// The scene graph (GraphicDocument JSON) for graphics, or point binding definitions
    /// for shapes/stencils. Accepts "scene_data" as an alias so the frontend can use
    /// `{ scene_data: GraphicDocument }` instead of `{ bindings: ... }`.
    #[serde(alias = "scene_data")]
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
    /// Optional module hint from metadata.module — "process", "console", etc.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub module: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ListGraphicsQuery {
    /// Filter by module tag (metadata->>'module'). Pass "process" or "console".
    pub module: Option<String>,
}

/// Full item returned in get-single responses.
#[derive(Debug, Serialize)]
pub struct GraphicDetail {
    pub id: Uuid,
    pub name: String,
    #[serde(rename = "type")]
    pub object_type: String,
    pub svg_data: Option<String>,
    /// Stored in DB as `bindings`. Serialized as `scene_data` so the Designer frontend
    /// can use `record.scene_data` directly. Also exposed as `bindings` for backward compat.
    #[serde(rename = "scene_data")]
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
    Query(query): Query<ListGraphicsQuery>,
) -> impl IntoResponse {
    if !check_permission(&claims, "designer:read") {
        return IoError::Forbidden("designer:read permission required".into()).into_response();
    }

    // Build optional module filter clause
    let (extra_where, module_bind) = if let Some(ref m) = query.module {
        (" AND metadata->>'module' = $1", Some(m.as_str()))
    } else {
        ("", None)
    };

    let sql = format!(
        r#"
        SELECT
            id,
            name,
            type,
            metadata->>'module' AS module,
            created_at,
            created_by,
            (
                SELECT count(*)::bigint
                FROM jsonb_object_keys(COALESCE(bindings, '{{}}'::jsonb)) k
            ) AS bindings_count
        FROM design_objects
        WHERE type = 'graphic'{extra_where}
        ORDER BY created_at DESC
        "#,
        extra_where = extra_where,
    );

    let rows = if let Some(m) = module_bind {
        match sqlx::query(&sql).bind(m).fetch_all(&state.db).await {
            Ok(r) => r,
            Err(e) => {
                tracing::error!(error = %e, "list_graphics query failed");
                return IoError::Database(e).into_response();
            }
        }
    } else {
        match sqlx::query(&sql).fetch_all(&state.db).await {
            Ok(r) => r,
            Err(e) => {
                tracing::error!(error = %e, "list_graphics query failed");
                return IoError::Database(e).into_response();
            }
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
        let module: Option<String> = row.try_get("module").ok().flatten();
        let created_at: DateTime<Utc> = match row.try_get("created_at") {
            Ok(v) => v,
            Err(_) => Utc::now(),
        };
        let created_by: Option<Uuid> = row.try_get("created_by").ok().flatten();
        let bindings_count: i64 = row.try_get("bindings_count").unwrap_or(0);
        items.push(GraphicSummary { id, name, object_type, module, created_at, created_by, bindings_count });
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

    let bindings_for_index = body.bindings.clone();
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

    // Maintain denormalized shape + point reverse-index tables in the background.
    // These are best-effort — a stale index is tolerable; the graphic still functions.
    if let Some(bindings_val) = bindings_for_index {
        let db = state.db.clone();
        tokio::spawn(async move {
            rebuild_graphic_indexes(&db, id, &bindings_val).await;
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
// GET /api/v1/design-objects/:id/thumbnail.png — serve the z0 tile as a thumbnail
// ---------------------------------------------------------------------------

pub async fn get_thumbnail(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    if !check_permission(&claims, "designer:read")
        && !check_permission(&claims, "process:read")
        && !check_permission(&claims, "console:read")
    {
        return IoError::Forbidden("read permission required".into()).into_response();
    }

    let path = std::path::PathBuf::from(&state.config.tile_storage_dir)
        .join("graphics")
        .join(id.to_string())
        .join("z0")
        .join("r0_c0.png");

    match std::fs::read(&path) {
        Ok(bytes) => axum::response::Response::builder()
            .status(200)
            .header("Content-Type", "image/png")
            .header("Cache-Control", "public, max-age=3600")
            .body(axum::body::Body::from(bytes))
            .unwrap()
            .into_response(),
        Err(_) => {
            // Return a 1×1 transparent PNG placeholder rather than a 404
            // so <img> elements don't show a broken image icon while tiles are generating
            const EMPTY_PNG: &[u8] = &[
                0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG header
                0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR chunk length + type
                0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // width=1, height=1
                0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, // bit depth=8, colorType=6 (RGBA)
                0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, // IHDR crc, IDAT chunk
                0x54, 0x78, 0x9c, 0x62, 0x00, 0x00, 0x00, 0x02, // IDAT: compressed 1-pixel
                0x00, 0x01, 0xe2, 0x21, 0xbc, 0x33, 0x00, 0x00, // IDAT crc
                0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, // IEND chunk
                0x60, 0x82,
            ];
            axum::response::Response::builder()
                .status(200)
                .header("Content-Type", "image/png")
                .header("Cache-Control", "no-cache")
                .body(axum::body::Body::from(EMPTY_PNG))
                .unwrap()
                .into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// GET /api/v1/design-objects/:id/tiles/:z/:x/:y — serve a specific tile PNG
// The tile pyramid uses r{row}_c{col}.png naming where row=y, col=x
// ---------------------------------------------------------------------------

pub async fn get_tile(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((id, z, x, y)): Path<(Uuid, u8, u32, u32)>,
) -> impl IntoResponse {
    if !check_permission(&claims, "designer:read")
        && !check_permission(&claims, "process:read")
        && !check_permission(&claims, "console:read")
    {
        return axum::response::Response::builder()
            .status(403)
            .body(axum::body::Body::empty())
            .unwrap()
            .into_response();
    }

    let path = std::path::PathBuf::from(&state.config.tile_storage_dir)
        .join("graphics")
        .join(id.to_string())
        .join(format!("z{z}"))
        .join(format!("r{y}_c{x}.png"));

    match std::fs::read(&path) {
        Ok(bytes) => axum::response::Response::builder()
            .status(200)
            .header("Content-Type", "image/png")
            .header("Cache-Control", "public, max-age=86400")
            .body(axum::body::Body::from(bytes))
            .unwrap()
            .into_response(),
        Err(_) => axum::response::Response::builder()
            .status(404)
            .body(axum::body::Body::empty())
            .unwrap()
            .into_response(),
    }
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

// ---------------------------------------------------------------------------
// GET /api/graphics/:id/points — binding index for viewport subscription
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
pub struct PointBindingIndex {
    pub point_id: String,
    pub bbox: Option<JsonValue>,
    pub lod_level: i32,
}

#[derive(Debug, Serialize)]
pub struct GraphicPointsResponse {
    pub points: Vec<PointBindingIndex>,
}

pub async fn get_graphic_points(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    if !check_permission(&claims, "process:read") && !check_permission(&claims, "console:read") {
        return IoError::Forbidden("process:read or console:read permission required".into())
            .into_response();
    }

    let row = match sqlx::query(
        r#"
        SELECT bindings
        FROM design_objects
        WHERE id = $1
          AND type = 'graphic'
        "#,
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(r)) => r,
        Ok(None) => return IoError::NotFound(format!("Graphic {} not found", id)).into_response(),
        Err(e) => {
            tracing::error!(error = %e, "get_graphic_points query failed");
            return IoError::Database(e).into_response();
        }
    };

    let bindings: Option<JsonValue> = row.try_get("bindings").ok().flatten();
    let points = bindings
        .and_then(|b| b.as_array().cloned())
        .unwrap_or_default()
        .into_iter()
        .filter_map(|entry| {
            let point_id = entry.get("pointId")?.as_str()?.to_string();
            let bbox = entry.get("bbox").cloned();
            let lod_level = entry
                .get("lodLevel")
                .and_then(|v| v.as_i64())
                .unwrap_or(0) as i32;
            Some(PointBindingIndex { point_id, bbox, lod_level })
        })
        .collect::<Vec<_>>();

    Json(ApiResponse::ok(GraphicPointsResponse { points })).into_response()
}

// ---------------------------------------------------------------------------
// GET /api/graphics/hierarchy — view hierarchy for navigation tree
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
pub struct HierarchyNode {
    pub id: Uuid,
    pub name: String,
    pub parent_id: Option<Uuid>,
    #[serde(rename = "type")]
    pub object_type: String,
    pub children: Vec<HierarchyNode>,
}

#[derive(Debug, Deserialize)]
pub struct HierarchyQuery {
    pub scope: Option<String>,
}

pub async fn list_graphics_hierarchy(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(query): Query<HierarchyQuery>,
) -> impl IntoResponse {
    if !check_permission(&claims, "process:read") && !check_permission(&claims, "console:read") {
        return IoError::Forbidden("process:read or console:read permission required".into())
            .into_response();
    }

    let scope_filter = query.scope.unwrap_or_else(|| "process".to_string());

    let rows = match sqlx::query(
        r#"
        SELECT id, name, parent_id, type
        FROM design_objects
        WHERE type = 'graphic'
          AND (metadata->>'module' = $1 OR $1 = 'all')
        ORDER BY name ASC
        "#,
    )
    .bind(&scope_filter)
    .fetch_all(&state.db)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(error = %e, "list_graphics_hierarchy query failed");
            return IoError::Database(e).into_response();
        }
    };

    let nodes: Vec<HierarchyNode> = rows
        .iter()
        .filter_map(|row| {
            let id: Uuid = row.try_get("id").ok()?;
            let name: String = row.try_get("name").ok()?;
            let parent_id: Option<Uuid> = row.try_get("parent_id").ok().flatten();
            let object_type: String = row.try_get("type").ok()?;
            Some(HierarchyNode { id, name, parent_id, object_type, children: vec![] })
        })
        .collect();

    Json(ApiResponse::ok(serde_json::json!({ "tree": nodes }))).into_response()
}

// ---------------------------------------------------------------------------
// GET /api/graphics/images/:hash — load image asset by content hash
// ---------------------------------------------------------------------------

pub async fn get_image_asset(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(hash): Path<String>,
) -> impl IntoResponse {
    if !check_permission(&claims, "process:read") && !check_permission(&claims, "console:read") {
        return IoError::Forbidden("process:read or console:read permission required".into())
            .into_response();
    }

    let row = match sqlx::query(
        r#"
        SELECT content, mime_type
        FROM graphic_assets
        WHERE content_hash = $1
        "#,
    )
    .bind(&hash)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(r)) => r,
        Ok(None) => {
            return IoError::NotFound(format!("Image asset {} not found", hash)).into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "get_image_asset query failed");
            return IoError::Database(e).into_response();
        }
    };

    let content: Vec<u8> = match row.try_get("content") {
        Ok(c) => c,
        Err(_) => return IoError::NotFound("Asset content missing".into()).into_response(),
    };
    let mime_type: String =
        row.try_get("mime_type").unwrap_or_else(|_| "image/png".to_string());

    axum::response::Response::builder()
        .status(200)
        .header("Content-Type", mime_type)
        .header("Cache-Control", "public, max-age=31536000, immutable")
        .body(axum::body::Body::from(content))
        .unwrap()
        .into_response()
}

// ---------------------------------------------------------------------------
// POST /api/shapes/batch — batch load shape SVGs and sidecars
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct BatchIdsBody {
    pub ids: Vec<Uuid>,
}

pub async fn batch_shapes(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<BatchIdsBody>,
) -> impl IntoResponse {
    if !check_permission(&claims, "process:read") && !check_permission(&claims, "console:read") {
        return IoError::Forbidden("process:read or console:read permission required".into())
            .into_response();
    }

    if body.ids.is_empty() {
        return Json(ApiResponse::ok(serde_json::json!({ "items": [] }))).into_response();
    }

    let placeholders: String = body
        .ids
        .iter()
        .enumerate()
        .map(|(i, _)| format!("${}", i + 1))
        .collect::<Vec<_>>()
        .join(",");

    let sql = format!(
        r#"
        SELECT id, name, type, svg_data, bindings, metadata
        FROM design_objects
        WHERE id IN ({})
          AND type IN ('shape', 'shape_part')
        "#,
        placeholders
    );

    let mut q = sqlx::query(&sql);
    for id in &body.ids {
        q = q.bind(id);
    }

    let rows = match q.fetch_all(&state.db).await {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(error = %e, "batch_shapes query failed");
            return IoError::Database(e).into_response();
        }
    };

    let items: Vec<JsonValue> = rows
        .iter()
        .filter_map(|row| {
            let id: Uuid = row.try_get("id").ok()?;
            let name: String = row.try_get("name").ok()?;
            let svg_data: Option<String> = row.try_get("svg_data").ok().flatten();
            let bindings: Option<JsonValue> = row.try_get("bindings").ok().flatten();
            let metadata: Option<JsonValue> = row.try_get("metadata").ok().flatten();
            Some(serde_json::json!({
                "id": id,
                "name": name,
                "svg_data": svg_data,
                "bindings": bindings,
                "metadata": metadata,
            }))
        })
        .collect();

    Json(ApiResponse::ok(serde_json::json!({ "items": items }))).into_response()
}

// ---------------------------------------------------------------------------
// POST /api/stencils/batch — batch load stencil SVGs
// ---------------------------------------------------------------------------

pub async fn batch_stencils(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<BatchIdsBody>,
) -> impl IntoResponse {
    if !check_permission(&claims, "process:read") && !check_permission(&claims, "console:read") {
        return IoError::Forbidden("process:read or console:read permission required".into())
            .into_response();
    }

    if body.ids.is_empty() {
        return Json(ApiResponse::ok(serde_json::json!({ "items": [] }))).into_response();
    }

    let placeholders: String = body
        .ids
        .iter()
        .enumerate()
        .map(|(i, _)| format!("${}", i + 1))
        .collect::<Vec<_>>()
        .join(",");

    let sql = format!(
        r#"
        SELECT id, name, svg_data, metadata
        FROM design_objects
        WHERE id IN ({})
          AND type = 'stencil'
        "#,
        placeholders
    );

    let mut q = sqlx::query(&sql);
    for id in &body.ids {
        q = q.bind(id);
    }

    let rows = match q.fetch_all(&state.db).await {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(error = %e, "batch_stencils query failed");
            return IoError::Database(e).into_response();
        }
    };

    let items: Vec<JsonValue> = rows
        .iter()
        .filter_map(|row| {
            let id: Uuid = row.try_get("id").ok()?;
            let name: String = row.try_get("name").ok()?;
            let svg_data: Option<String> = row.try_get("svg_data").ok().flatten();
            let metadata: Option<JsonValue> = row.try_get("metadata").ok().flatten();
            Some(serde_json::json!({
                "id": id,
                "name": name,
                "svg_data": svg_data,
                "metadata": metadata,
            }))
        })
        .collect();

    Json(ApiResponse::ok(serde_json::json!({ "items": items }))).into_response()
}

// ---------------------------------------------------------------------------
// POST /api/v1/image-assets — upload an image asset (for Designer Image Tool)
// ---------------------------------------------------------------------------

pub async fn upload_image_asset(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    mut multipart: Multipart,
) -> impl IntoResponse {
    if !check_permission(&claims, "designer:write") {
        return IoError::Forbidden("designer:write permission required".into()).into_response();
    }

    let user_id: Uuid = match uuid::Uuid::parse_str(&claims.sub) {
        Ok(id) => id,
        Err(_) => return IoError::Unauthorized.into_response(),
    };

    let mut file_data: Option<(Vec<u8>, String)> = None;

    while let Ok(Some(field)) = multipart.next_field().await {
        let content_type = field
            .content_type()
            .unwrap_or("image/png")
            .to_string();
        // Accept image/* only
        if !content_type.starts_with("image/") {
            return IoError::BadRequest(format!("Unsupported file type: {}", content_type)).into_response();
        }
        match field.bytes().await {
            Ok(data) => {
                if data.len() > 10 * 1024 * 1024 {
                    return IoError::BadRequest("Image too large (max 10MB)".into()).into_response();
                }
                file_data = Some((data.to_vec(), content_type));
                break;
            }
            Err(e) => {
                return IoError::BadRequest(format!("Failed to read file: {e}")).into_response();
            }
        }
    }

    let (bytes, mime_type) = match file_data {
        Some(f) => f,
        None => return IoError::BadRequest("No file field in multipart body".into()).into_response(),
    };

    // Compute SHA-256 content hash for deduplication
    use std::fmt::Write;
    let hash = {
        use sha2::{Sha256, Digest};
        let mut hasher = Sha256::new();
        hasher.update(&bytes);
        let result = hasher.finalize();
        let mut hex = String::with_capacity(64);
        for b in result {
            write!(hex, "{:02x}", b).ok();
        }
        hex
    };

    // Upsert — if the same hash already exists, return it without re-storing
    let result = sqlx::query(
        r#"
        INSERT INTO graphic_assets (content_hash, mime_type, content, created_by)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (content_hash) DO NOTHING
        RETURNING content_hash
        "#,
    )
    .bind(&hash)
    .bind(&mime_type)
    .bind(&bytes)
    .bind(user_id)
    .fetch_optional(&state.db)
    .await;

    match result {
        Ok(_) => Json(ApiResponse::ok(serde_json::json!({
            "hash": hash,
            "url": format!("/api/v1/image-assets/{}", hash),
            "mime_type": mime_type,
            "size": bytes.len(),
        })))
        .into_response(),
        Err(e) => {
            tracing::error!(error = %e, "upload_image_asset insert failed");
            IoError::Database(e).into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// GET /api/v1/image-assets/:hash — serve image asset by content hash
// ---------------------------------------------------------------------------

pub async fn get_image_asset_v1(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(hash): Path<String>,
) -> impl IntoResponse {
    if !check_permission(&claims, "designer:read")
        && !check_permission(&claims, "process:read")
        && !check_permission(&claims, "console:read")
    {
        return IoError::Forbidden("read permission required".into()).into_response();
    }

    let row = match sqlx::query(
        "SELECT content, mime_type FROM graphic_assets WHERE content_hash = $1",
    )
    .bind(&hash)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(r)) => r,
        Ok(None) => {
            return IoError::NotFound(format!("Image asset {} not found", hash)).into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "get_image_asset_v1 query failed");
            return IoError::Database(e).into_response();
        }
    };

    let content: Vec<u8> = match row.try_get("content") {
        Ok(c) => c,
        Err(_) => return IoError::NotFound("Asset content missing".into()).into_response(),
    };
    let mime_type: String =
        row.try_get("mime_type").unwrap_or_else(|_| "image/png".to_string());

    axum::response::Response::builder()
        .status(200)
        .header("Content-Type", mime_type)
        .header("Cache-Control", "public, max-age=31536000, immutable")
        .body(axum::body::Body::from(content))
        .unwrap()
        .into_response()
}

// ---------------------------------------------------------------------------
// rebuild_graphic_indexes — maintain design_object_shapes + design_object_points
// Called in background after each graphic save. Best-effort; errors are logged.
// ---------------------------------------------------------------------------

async fn rebuild_graphic_indexes(db: &sqlx::PgPool, graphic_id: Uuid, scene_data: &JsonValue) {
    // Extract shape IDs: look for nodes with shapeRef.libraryId or shapeId fields
    let shape_ids = collect_shape_ids(scene_data);
    // Extract point IDs: look for binding.pointId or stateBinding.pointId fields
    let point_ids = collect_point_ids(scene_data);

    // Replace shape index
    if let Err(e) = sqlx::query(
        "DELETE FROM design_object_shapes WHERE design_object_id = $1",
    )
    .bind(graphic_id)
    .execute(db)
    .await
    {
        tracing::warn!(error = %e, graphic_id = %graphic_id, "Failed to clear shape index");
        return;
    }
    for shape_id in &shape_ids {
        let _ = sqlx::query(
            "INSERT INTO design_object_shapes (design_object_id, shape_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
        )
        .bind(graphic_id)
        .bind(shape_id)
        .execute(db)
        .await;
    }

    // Replace point index
    if let Err(e) = sqlx::query(
        "DELETE FROM design_object_points WHERE design_object_id = $1",
    )
    .bind(graphic_id)
    .execute(db)
    .await
    {
        tracing::warn!(error = %e, graphic_id = %graphic_id, "Failed to clear point index");
        return;
    }
    for point_id_str in &point_ids {
        if let Ok(point_uuid) = Uuid::parse_str(point_id_str) {
            let _ = sqlx::query(
                "INSERT INTO design_object_points (design_object_id, point_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
            )
            .bind(graphic_id)
            .bind(point_uuid)
            .execute(db)
            .await;
        }
    }
}

/// Recursively walk scene_data JSON and collect all shapeRef library IDs.
fn collect_shape_ids(val: &JsonValue) -> Vec<String> {
    let mut ids = Vec::new();
    collect_shape_ids_rec(val, &mut ids);
    ids
}

fn collect_shape_ids_rec(val: &JsonValue, ids: &mut Vec<String>) {
    match val {
        JsonValue::Object(map) => {
            // SymbolInstance: { shapeRef: { libraryId: "pump-centrifugal" } }
            if let Some(shape_ref) = map.get("shapeRef").and_then(|v| v.as_object()) {
                if let Some(library_id) = shape_ref.get("libraryId").and_then(|v| v.as_str()) {
                    ids.push(library_id.to_string());
                }
            }
            // Also check direct shapeId
            if let Some(shape_id) = map.get("shapeId").and_then(|v| v.as_str()) {
                ids.push(shape_id.to_string());
            }
            for child in map.values() {
                collect_shape_ids_rec(child, ids);
            }
        }
        JsonValue::Array(arr) => {
            for item in arr {
                collect_shape_ids_rec(item, ids);
            }
        }
        _ => {}
    }
}

/// Recursively walk scene_data JSON and collect all bound point IDs.
fn collect_point_ids(val: &JsonValue) -> Vec<String> {
    let mut ids = Vec::new();
    collect_point_ids_rec(val, &mut ids);
    ids
}

fn collect_point_ids_rec(val: &JsonValue, ids: &mut Vec<String>) {
    match val {
        JsonValue::Object(map) => {
            // binding.pointId and stateBinding.pointId
            for key in ["binding", "stateBinding"] {
                if let Some(b) = map.get(key).and_then(|v| v.as_object()) {
                    if let Some(pid) = b.get("pointId").and_then(|v| v.as_str()) {
                        ids.push(pid.to_string());
                    }
                }
            }
            // Direct pointId field (legacy or simplified bindings)
            if let Some(pid) = map.get("pointId").and_then(|v| v.as_str()) {
                ids.push(pid.to_string());
            }
            for child in map.values() {
                collect_point_ids_rec(child, ids);
            }
        }
        JsonValue::Array(arr) => {
            for item in arr {
                collect_point_ids_rec(item, ids);
            }
        }
        _ => {}
    }
}
