use axum::{
    body::Body,
    extract::{Multipart, Path, Query, State},
    http::{header, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
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

use crate::{file_scan, state::AppState, tiles};

// ---------------------------------------------------------------------------
// Permission helper
// ---------------------------------------------------------------------------

fn check_permission(claims: &Claims, permission: &str) -> bool {
    claims
        .permissions
        .iter()
        .any(|p| p == "*" || p == permission)
}

// ---------------------------------------------------------------------------
// Request / Response types
// ---------------------------------------------------------------------------

fn default_graphic_type() -> String {
    "graphic".to_string()
}

#[derive(Debug, Deserialize)]
pub struct DesignObjectTypeFilter {
    #[serde(rename = "type")]
    pub object_type: Option<String>,
    pub page: Option<u32>,
    pub limit: Option<u32>,
}

/// Body for creating or updating a design object / graphic.
#[derive(Debug, Deserialize)]
pub struct UpsertDesignObjectBody {
    pub name: String,
    /// Object type: "graphic", "dashboard", "report", "shape", "stencil", etc.
    /// Defaults to "graphic" when omitted (Designer frontend omits this field).
    #[serde(rename = "type", default = "default_graphic_type")]
    pub object_type: String,
    pub svg_data: Option<String>,
    /// The scene graph (GraphicDocument JSON) for graphics, or point binding definitions
    /// for shapes/stencils. Accepts "scene_data" as an alias so the frontend can use
    /// `{ scene_data: GraphicDocument }` instead of `{ bindings: ... }`.
    #[serde(alias = "scene_data")]
    pub bindings: Option<JsonValue>,
    pub metadata: Option<JsonValue>,
    pub parent_id: Option<Uuid>,
    pub label: Option<String>,
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
    pub published: bool,
    /// Optional module hint from metadata.module — "process", "console", etc.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub module: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ListGraphicsQuery {
    /// Filter by module tag (metadata->>'module'). Pass "process" or "console".
    pub module: Option<String>,
    pub page: Option<u32>,
    pub limit: Option<u32>,
    /// Admin only: when "true", return all users' graphics (including unpublished).
    pub include_all_users: Option<String>,
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
    pub published: bool,
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
// Versioning structs and helpers
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct ListVersionsQuery {
    pub include_deleted: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct VersionSummary {
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
pub struct VersionContent {
    pub id: Uuid,
    pub version_number: i32,
    pub version_type: String,
    pub label: Option<String>,
    pub parent_version_number: Option<i32>,
    pub svg_data: String,
    #[serde(rename = "scene_data")]
    pub bindings: Option<JsonValue>,
    pub metadata: Option<JsonValue>,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateVersionLabelBody {
    pub label: Option<String>,
}

fn is_admin(claims: &Claims) -> bool {
    claims.permissions.iter().any(|p| p == "*")
}

fn count_scene_nodes(scene_data: &JsonValue) -> i64 {
    fn count_recursive(val: &JsonValue) -> i64 {
        match val {
            JsonValue::Object(map) => {
                let mut count = 1i64;
                if let Some(children) = map.get("children").and_then(|v| v.as_array()) {
                    for child in children {
                        count += count_recursive(child);
                    }
                }
                count
            }
            _ => 0,
        }
    }
    count_recursive(scene_data)
}

fn count_point_bindings(scene_data: &JsonValue) -> i64 {
    collect_point_ids(scene_data).len() as i64
}

fn compute_version_metadata(
    scene_data: &Option<JsonValue>,
    existing_metadata: &Option<JsonValue>,
) -> JsonValue {
    let element_count = scene_data.as_ref().map(count_scene_nodes).unwrap_or(0);
    let binding_count = scene_data.as_ref().map(count_point_bindings).unwrap_or(0);

    let mut meta = existing_metadata.clone().unwrap_or(serde_json::json!({}));
    if let Some(obj) = meta.as_object_mut() {
        obj.insert(
            "element_count".to_string(),
            serde_json::json!(element_count),
        );
        obj.insert(
            "binding_count".to_string(),
            serde_json::json!(binding_count),
        );
    }
    meta
}

#[allow(clippy::too_many_arguments)]
async fn create_version_snapshot(
    db: &sqlx::PgPool,
    design_object_id: Uuid,
    created_by: Uuid,
    version_type: &str,
    svg_data: &str,
    bindings: &Option<JsonValue>,
    metadata: &JsonValue,
    label: Option<String>,
) -> Result<i32, sqlx::Error> {
    let mut tx = db.begin().await?;

    sqlx::query("SELECT pg_advisory_xact_lock(hashtext($1::text))")
        .bind(design_object_id.to_string())
        .execute(&mut *tx)
        .await?;

    let (current_max, parent_version): (i32, Option<i32>) = sqlx::query_as(
        "SELECT COALESCE(MAX(version_number), 0), \
                CASE WHEN MAX(version_number) > 0 THEN MAX(version_number) ELSE NULL END \
         FROM design_object_versions \
         WHERE design_object_id = $1",
    )
    .bind(design_object_id)
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
        INSERT INTO design_object_versions
            (id, design_object_id, version_number, version_type, svg_data, bindings,
             metadata, created_by, label, parent_version_number)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(design_object_id)
    .bind(next_version)
    .bind(version_type)
    .bind(svg_data)
    .bind(bindings)
    .bind(metadata)
    .bind(created_by)
    .bind(&effective_label)
    .bind(parent_version)
    .execute(&mut *tx)
    .await?;

    tx.commit().await?;

    tracing::info!(
        graphic_id = %design_object_id,
        version = next_version,
        version_type = version_type,
        "Version snapshot created"
    );

    Ok(next_version)
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
    let published: bool = row.try_get("published").unwrap_or(false);
    let created_at: DateTime<Utc> = row.try_get("created_at")?;
    let created_by: Option<Uuid> = row.try_get("created_by").ok().flatten();
    Ok(GraphicDetail {
        id,
        name,
        object_type,
        svg_data,
        bindings,
        metadata,
        parent_id,
        published,
        created_at,
        created_by,
    })
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

    let pg = query.page.unwrap_or(1).max(1);
    let limit = query.limit.unwrap_or(50).clamp(1, 100);
    let offset = ((pg - 1) * limit) as i64;

    let user_id: Uuid = Uuid::parse_str(&claims.sub).unwrap_or_default();
    let all_users = query.include_all_users.as_deref() == Some("true") && is_admin(&claims);

    // $1 = all_users (bool), $2 = user_id (UUID) — used in all queries below
    // When all_users is true the expression short-circuits; no string interpolation of user data.
    let visibility = "AND ($1::boolean OR created_by = $2 OR COALESCE(published, false) = true)";

    // Module filter appended after the two fixed params: $3 = module, $4/$5 = limit/offset
    let (extra_where, module_bind) = if let Some(ref m) = query.module {
        (" AND metadata->>'module' = $3", Some(m.as_str()))
    } else {
        ("", None)
    };

    // Parameter positions: [all_users, user_id, (module?,) limit, offset]
    let (limit_pos, offset_pos) = if module_bind.is_some() {
        (4, 5)
    } else {
        (3, 4)
    };

    let count_sql = format!(
        "SELECT COUNT(*) FROM design_objects WHERE type = 'graphic' AND name NOT LIKE '__autosave_%' AND deleted_at IS NULL {visibility}{extra_where}",
        visibility = visibility,
        extra_where = extra_where,
    );

    let total: i64 = if let Some(m) = module_bind {
        match sqlx::query_scalar(&count_sql)
            .bind(all_users)
            .bind(user_id)
            .bind(m)
            .fetch_one(&state.db)
            .await
        {
            Ok(n) => n,
            Err(e) => {
                tracing::error!(error = %e, "list_graphics count query failed");
                return IoError::Database(e).into_response();
            }
        }
    } else {
        match sqlx::query_scalar(&count_sql)
            .bind(all_users)
            .bind(user_id)
            .fetch_one(&state.db)
            .await
        {
            Ok(n) => n,
            Err(e) => {
                tracing::error!(error = %e, "list_graphics count query failed");
                return IoError::Database(e).into_response();
            }
        }
    };

    let data_sql = format!(
        r#"
        SELECT
            id,
            name,
            type,
            metadata->>'module' AS module,
            published,
            created_at,
            created_by,
            (
                SELECT count(*)::bigint
                FROM jsonb_object_keys(COALESCE(bindings, '{{}}'::jsonb)) k
            ) AS bindings_count
        FROM design_objects
        WHERE type = 'graphic' AND name NOT LIKE '__autosave_%' AND deleted_at IS NULL {visibility}{extra_where}
        ORDER BY created_at DESC
        LIMIT ${limit_pos} OFFSET ${offset_pos}
        "#,
        visibility = visibility,
        extra_where = extra_where,
        limit_pos = limit_pos,
        offset_pos = offset_pos,
    );

    let rows = if let Some(m) = module_bind {
        match sqlx::query(&data_sql)
            .bind(all_users)
            .bind(user_id)
            .bind(m)
            .bind(limit as i64)
            .bind(offset)
            .fetch_all(&state.db)
            .await
        {
            Ok(r) => r,
            Err(e) => {
                tracing::error!(error = %e, "list_graphics query failed");
                return IoError::Database(e).into_response();
            }
        }
    } else {
        match sqlx::query(&data_sql)
            .bind(all_users)
            .bind(user_id)
            .bind(limit as i64)
            .bind(offset)
            .fetch_all(&state.db)
            .await
        {
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
        let published: bool = row.try_get("published").unwrap_or(false);
        items.push(GraphicSummary {
            id,
            name,
            object_type,
            module,
            created_at,
            created_by,
            bindings_count,
            published,
        });
    }

    Json(PagedResponse::new(items, pg, limit, total as u64)).into_response()
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

    // Accept graphic/dashboard/report; default is "graphic" (set by UpsertDesignObjectBody default)
    let allowed = ["graphic", "dashboard", "report"];
    let object_type = if allowed.contains(&body.object_type.as_str()) {
        body.object_type.clone()
    } else {
        "graphic".to_string()
    };
    let id = Uuid::new_v4();
    let created_by: Option<Uuid> = Uuid::parse_str(&claims.sub).ok();
    let bindings = body
        .bindings
        .unwrap_or(JsonValue::Object(serde_json::Map::new()));
    let metadata = body
        .metadata
        .unwrap_or(JsonValue::Object(serde_json::Map::new()));

    let row = match sqlx::query(
        r#"
        INSERT INTO design_objects
            (id, name, type, svg_data, bindings, metadata, parent_id, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, name, type, svg_data, bindings, metadata, parent_id, published, created_at, created_by
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

    // Spawn initial v1 snapshot (non-blocking)
    if let Some(creator) = created_by {
        let db_snap = state.db.clone();
        let svg_snap = body.svg_data.clone().unwrap_or_default();
        let bindings_snap = bindings.clone();
        let meta_snap = metadata.clone();
        let label_snap = body.label.clone();
        tokio::spawn(async move {
            if let Err(e) = create_version_snapshot(
                &db_snap,
                id,
                creator,
                "save",
                &svg_snap,
                &Some(bindings_snap),
                &meta_snap,
                label_snap,
            )
            .await
            {
                tracing::warn!(
                    error = %e,
                    graphic_id = %id,
                    "Failed to create initial v1 snapshot"
                );
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
        SELECT id, name, type, svg_data, bindings, metadata, parent_id, published, created_at, created_by
        FROM design_objects
        WHERE id = $1 AND deleted_at IS NULL
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

    let row = match sqlx::query(
        r#"
        UPDATE design_objects
        SET
            name      = $1,
            svg_data  = COALESCE($2, svg_data),
            bindings  = COALESCE($3, bindings),
            metadata  = COALESCE($4, metadata),
            parent_id = COALESCE($5, parent_id)
        WHERE id = $6 AND deleted_at IS NULL
        RETURNING id, name, type, svg_data, bindings, metadata, parent_id, published, created_at, created_by
        "#,
    )
    .bind(&body.name)
    .bind(&body.svg_data)
    .bind(&body.bindings)
    .bind(&body.metadata)
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

    // Version snapshot — skip for auto-save rows
    let row_name: String = row.try_get("name").unwrap_or_default();
    if !row_name.starts_with("__autosave_") {
        let created_by = match claims.sub.parse::<Uuid>() {
            Ok(u) => u,
            Err(_) => {
                tracing::warn!(
                    "update_graphic: invalid user ID in token, skipping version snapshot"
                );
                Uuid::nil()
            }
        };
        if !created_by.is_nil() {
            let scene_data_for_stats = row
                .try_get::<Option<JsonValue>, _>("bindings")
                .ok()
                .flatten();
            let existing_metadata: Option<JsonValue> = row.try_get("metadata").ok().flatten();
            let version_metadata =
                compute_version_metadata(&scene_data_for_stats, &existing_metadata);
            let svg_data_snap: String = row
                .try_get::<Option<String>, _>("svg_data")
                .ok()
                .flatten()
                .unwrap_or_default();
            let bindings_snap: Option<JsonValue> = row.try_get("bindings").ok().flatten();
            let label = body.label.clone();

            let db = state.db.clone();
            tokio::spawn(async move {
                if let Err(e) = create_version_snapshot(
                    &db,
                    id,
                    created_by,
                    "save",
                    &svg_data_snap,
                    &bindings_snap,
                    &version_metadata,
                    label,
                )
                .await
                {
                    tracing::warn!(error = %e, graphic_id = %id, "Version snapshot creation failed (non-fatal)");
                }
            });
        }
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

    let user_id: Uuid = match Uuid::parse_str(&claims.sub) {
        Ok(uid) => uid,
        Err(_) => return IoError::Unauthorized.into_response(),
    };

    let result = match sqlx::query(
        "UPDATE design_objects SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL AND (created_by = $2 OR $3::boolean) RETURNING id",
    )
    .bind(id)
    .bind(user_id)
    .bind(is_admin(&claims))
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

    // Best-effort tile cleanup on soft delete
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
// POST /api/v1/design-objects/:id/recover — admin only, un-soft-deletes a graphic
// ---------------------------------------------------------------------------

pub async fn recover_graphic(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    if !is_admin(&claims) {
        return IoError::Forbidden("Admin permission required".into()).into_response();
    }

    let result = match sqlx::query(
        "UPDATE design_objects SET deleted_at = NULL WHERE id = $1 AND deleted_at IS NOT NULL RETURNING id",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(error = %e, "recover_graphic query failed");
            return IoError::Database(e).into_response();
        }
    };

    if result.is_none() {
        return IoError::NotFound(format!("Deleted graphic {} not found", id)).into_response();
    }

    Json(ApiResponse::ok(
        serde_json::json!({ "id": id, "recovered": true }),
    ))
    .into_response()
}

// ---------------------------------------------------------------------------
// DELETE /api/v1/design-objects/:id/permanent — admin only hard delete
// ---------------------------------------------------------------------------

pub async fn permanent_delete_graphic(
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
        "DELETE FROM design_objects WHERE id = $1 AND deleted_at IS NOT NULL RETURNING id",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(error = %e, "permanent_delete_graphic query failed");
            return IoError::Database(e).into_response();
        }
    };

    if result.is_none() {
        return IoError::NotFound(format!("Graphic {} not found or not soft-deleted", id))
            .into_response();
    }

    let audit_meta = serde_json::json!({
        "design_object_id": id.to_string(),
        "action": "permanent_delete",
    });
    let db = state.db.clone();
    let id_str = id.to_string();
    let storage_dir = state.config.tile_storage_dir.clone();
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

        if let Err(e) = tiles::delete_tiles(&id_str, &storage_dir) {
            tracing::warn!(graphic_id = %id_str, error = %e, "Failed to remove tiles on graphic permanent delete");
        }
    });

    Json(ApiResponse::ok(
        serde_json::json!({ "id": id, "permanently_deleted": true }),
    ))
    .into_response()
}

// ---------------------------------------------------------------------------
// POST /api/v1/design-objects/:id/publish — set published=true + version snapshot
// ---------------------------------------------------------------------------

pub async fn publish_graphic(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    if !check_permission(&claims, "designer:publish") {
        return IoError::Forbidden("designer:publish permission required".into()).into_response();
    }

    let created_by = match claims.sub.parse::<Uuid>() {
        Ok(u) => u,
        Err(_) => return IoError::Internal("Invalid user ID in token".into()).into_response(),
    };

    let row = if is_admin(&claims) {
        sqlx::query(
            r#"
            UPDATE design_objects SET published = true WHERE id = $1 AND deleted_at IS NULL
            RETURNING id, name, svg_data, bindings, metadata
            "#,
        )
        .bind(id)
        .fetch_optional(&state.db)
        .await
    } else {
        sqlx::query(
            r#"
            UPDATE design_objects SET published = true WHERE id = $1 AND deleted_at IS NULL AND created_by = $2
            RETURNING id, name, svg_data, bindings, metadata
            "#,
        )
        .bind(id)
        .bind(created_by)
        .fetch_optional(&state.db)
        .await
    };

    let row = match row {
        Ok(Some(r)) => r,
        Ok(None) => return IoError::NotFound(format!("Graphic {} not found", id)).into_response(),
        Err(e) => {
            tracing::error!(error = %e, "publish_graphic fetch failed");
            return IoError::Database(e).into_response();
        }
    };

    let name: String = row.try_get("name").unwrap_or_default();
    if name.starts_with("__autosave_") {
        return IoError::BadRequest("Cannot publish an auto-save row".into()).into_response();
    }

    let svg_data: String = row
        .try_get::<Option<String>, _>("svg_data")
        .ok()
        .flatten()
        .unwrap_or_default();
    let bindings: Option<JsonValue> = row.try_get("bindings").ok().flatten();
    let existing_metadata: Option<JsonValue> = row.try_get("metadata").ok().flatten();
    let version_metadata = compute_version_metadata(&bindings, &existing_metadata);

    match create_version_snapshot(
        &state.db,
        id,
        created_by,
        "publish",
        &svg_data,
        &bindings,
        &version_metadata,
        None,
    )
    .await
    {
        Ok(version) => {
            tracing::info!(graphic_id = %id, version = version, "Graphic published");
            Json(ApiResponse::ok(serde_json::json!({
                "version": version,
                "published": true,
            })))
            .into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "publish_graphic version snapshot failed");
            IoError::Database(e).into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// POST /api/v1/design-objects/:id/unpublish
// ---------------------------------------------------------------------------

pub async fn unpublish_graphic(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    if !check_permission(&claims, "designer:publish") {
        return IoError::Forbidden("designer:publish permission required".into()).into_response();
    }

    let user_id = match claims.sub.parse::<Uuid>() {
        Ok(u) => u,
        Err(_) => return IoError::Internal("Invalid user ID in token".into()).into_response(),
    };

    let result = if is_admin(&claims) {
        sqlx::query(
            "UPDATE design_objects SET published = false WHERE id = $1 AND deleted_at IS NULL RETURNING id",
        )
        .bind(id)
        .fetch_optional(&state.db)
        .await
    } else {
        sqlx::query(
            "UPDATE design_objects SET published = false WHERE id = $1 AND deleted_at IS NULL AND created_by = $2 RETURNING id",
        )
        .bind(id)
        .bind(user_id)
        .fetch_optional(&state.db)
        .await
    };

    match result {
        Ok(Some(_)) => {
            tracing::info!(graphic_id = %id, "Graphic unpublished");
            Json(ApiResponse::ok(serde_json::json!({ "published": false }))).into_response()
        }
        Ok(None) => IoError::NotFound(format!("Graphic {} not found or not owned by you", id))
            .into_response(),
        Err(e) => {
            tracing::error!(error = %e, "unpublish_graphic query failed");
            IoError::Database(e).into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// GET /api/v1/design-objects/:id/versions
// ---------------------------------------------------------------------------

pub async fn list_versions(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Query(query): Query<ListVersionsQuery>,
) -> impl IntoResponse {
    if !check_permission(&claims, "designer:read") {
        return IoError::Forbidden("designer:read permission required".into()).into_response();
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
        FROM design_object_versions v
        LEFT JOIN users u ON u.id = v.created_by
        WHERE v.design_object_id = $1 {deleted_filter}
        ORDER BY v.version_number DESC
        "#,
        deleted_filter = deleted_filter,
    );

    let rows = match sqlx::query(&sql).bind(id).fetch_all(&state.db).await {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(error = %e, "list_versions query failed");
            return IoError::Database(e).into_response();
        }
    };

    let versions: Vec<VersionSummary> = rows
        .iter()
        .filter_map(|row| {
            Some(VersionSummary {
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
// GET /api/v1/design-objects/:id/versions/:version_number
// ---------------------------------------------------------------------------

pub async fn get_version_content(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((id, version_number)): Path<(Uuid, i32)>,
) -> impl IntoResponse {
    if !check_permission(&claims, "designer:read") {
        return IoError::Forbidden("designer:read permission required".into()).into_response();
    }

    let row = match sqlx::query(
        r#"
        SELECT id, version_number, version_type, label, parent_version_number,
               svg_data, bindings, metadata, created_by, created_at
        FROM design_object_versions
        WHERE design_object_id = $1 AND version_number = $2 AND deleted_at IS NULL
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
                "Version {} of graphic {} not found",
                version_number, id
            ))
            .into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "get_version_content query failed");
            return IoError::Database(e).into_response();
        }
    };

    let content = VersionContent {
        id: row.try_get("id").unwrap_or_default(),
        version_number: row.try_get("version_number").unwrap_or(0),
        version_type: row.try_get("version_type").unwrap_or_default(),
        label: row.try_get("label").ok().flatten(),
        parent_version_number: row.try_get("parent_version_number").ok().flatten(),
        svg_data: row.try_get("svg_data").unwrap_or_default(),
        bindings: row.try_get("bindings").ok().flatten(),
        metadata: row.try_get("metadata").ok().flatten(),
        created_by: row.try_get("created_by").unwrap_or_default(),
        created_at: row.try_get("created_at").unwrap_or_else(|_| Utc::now()),
    };

    Json(ApiResponse::ok(content)).into_response()
}

// ---------------------------------------------------------------------------
// POST /api/v1/design-objects/:id/versions/:version_number/restore
// ---------------------------------------------------------------------------

pub async fn restore_version(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((id, version_number)): Path<(Uuid, i32)>,
) -> impl IntoResponse {
    if !check_permission(&claims, "designer:write") {
        return IoError::Forbidden("designer:write permission required".into()).into_response();
    }

    let created_by = match claims.sub.parse::<Uuid>() {
        Ok(u) => u,
        Err(_) => return IoError::Internal("Invalid user ID in token".into()).into_response(),
    };

    let ver_row = match sqlx::query(
        r#"
        SELECT svg_data, bindings, metadata
        FROM design_object_versions
        WHERE design_object_id = $1 AND version_number = $2 AND deleted_at IS NULL
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
                "Version {} of graphic {} not found",
                version_number, id
            ))
            .into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "restore_version fetch failed");
            return IoError::Database(e).into_response();
        }
    };

    let svg_data: String = ver_row
        .try_get::<Option<String>, _>("svg_data")
        .ok()
        .flatten()
        .unwrap_or_default();
    let bindings: Option<JsonValue> = ver_row.try_get("bindings").ok().flatten();
    let existing_metadata: Option<JsonValue> = ver_row.try_get("metadata").ok().flatten();

    // All mutations inside the advisory-lock transaction for atomicity
    let mut tx = match state.db.begin().await {
        Ok(tx) => tx,
        Err(e) => {
            tracing::error!(error = %e, "restore_version begin transaction failed");
            return IoError::Database(e).into_response();
        }
    };

    if let Err(e) = sqlx::query("SELECT pg_advisory_xact_lock(hashtext($1::text))")
        .bind(id.to_string())
        .execute(&mut *tx)
        .await
    {
        tracing::error!(error = %e, "restore_version advisory lock failed");
        return IoError::Database(e).into_response();
    }

    // Live-data update inside the transaction — ownership enforced for non-admins
    let update_result = if is_admin(&claims) {
        sqlx::query(
            "UPDATE design_objects SET svg_data = $1, bindings = $2, metadata = $3 WHERE id = $4 RETURNING id",
        )
        .bind(&svg_data)
        .bind(&bindings)
        .bind(&existing_metadata)
        .bind(id)
        .fetch_optional(&mut *tx)
        .await
    } else {
        sqlx::query(
            "UPDATE design_objects SET svg_data = $1, bindings = $2, metadata = $3 WHERE id = $4 AND created_by = $5 RETURNING id",
        )
        .bind(&svg_data)
        .bind(&bindings)
        .bind(&existing_metadata)
        .bind(id)
        .bind(created_by)
        .fetch_optional(&mut *tx)
        .await
    };

    match update_result {
        Ok(Some(_)) => {}
        Ok(None) => {
            return IoError::NotFound(format!("Graphic {} not found or not owned by you", id))
                .into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "restore_version update failed");
            return IoError::Database(e).into_response();
        }
    }

    let next_version: i32 = match sqlx::query_scalar(
        "SELECT COALESCE(MAX(version_number), 0) + 1 FROM design_object_versions WHERE design_object_id = $1",
    )
    .bind(id)
    .fetch_one(&mut *tx)
    .await
    {
        Ok(v) => v,
        Err(e) => {
            tracing::error!(error = %e, "restore_version next_version query failed");
            return IoError::Database(e).into_response();
        }
    };

    let version_metadata = compute_version_metadata(&bindings, &existing_metadata);
    let restore_label = format!("Restored from v{}", version_number);

    if let Err(e) = sqlx::query(
        r#"
        INSERT INTO design_object_versions
            (id, design_object_id, version_number, version_type, svg_data, bindings,
             metadata, created_by, label, parent_version_number)
        VALUES ($1, $2, $3, 'save', $4, $5, $6, $7, $8, $9)
        "#,
    )
    .bind(Uuid::new_v4())
    .bind(id)
    .bind(next_version)
    .bind(&svg_data)
    .bind(&bindings)
    .bind(&version_metadata)
    .bind(created_by)
    .bind(&restore_label)
    .bind(version_number)
    .execute(&mut *tx)
    .await
    {
        tracing::error!(error = %e, "restore_version insert failed");
        return IoError::Database(e).into_response();
    }

    if let Err(e) = tx.commit().await {
        tracing::error!(error = %e, "restore_version commit failed");
        return IoError::Database(e).into_response();
    }

    tracing::info!(
        graphic_id = %id,
        restored_from = version_number,
        new_version = next_version,
        "Version restored"
    );
    Json(ApiResponse::ok(serde_json::json!({
        "version_number": next_version,
        "restored_from": version_number,
    })))
    .into_response()
}

// ---------------------------------------------------------------------------
// DELETE /api/v1/design-objects/:id/versions/:version_number — soft delete
// ---------------------------------------------------------------------------

pub async fn soft_delete_version(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((id, version_number)): Path<(Uuid, i32)>,
) -> impl IntoResponse {
    if !check_permission(&claims, "designer:write") {
        return IoError::Forbidden("designer:write permission required".into()).into_response();
    }

    let user_id = match claims.sub.parse::<Uuid>() {
        Ok(u) => u,
        Err(_) => return IoError::Internal("Invalid user ID in token".into()).into_response(),
    };

    let result = if is_admin(&claims) {
        sqlx::query(
            r#"
            UPDATE design_object_versions SET deleted_at = NOW()
            WHERE design_object_id = $1 AND version_number = $2 AND deleted_at IS NULL
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
            UPDATE design_object_versions SET deleted_at = NOW()
            WHERE design_object_id = $1 AND version_number = $2
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
            tracing::info!(graphic_id = %id, version = version_number, "Version soft-deleted");
            Json(ApiResponse::ok(serde_json::json!({ "deleted": true }))).into_response()
        }
        Ok(None) => IoError::NotFound(format!(
            "Version {} of graphic {} not found or not owned by you",
            version_number, id
        ))
        .into_response(),
        Err(e) => {
            tracing::error!(error = %e, "soft_delete_version query failed");
            IoError::Database(e).into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// POST /api/v1/design-objects/:id/versions/:version_number/recover (admin only)
// ---------------------------------------------------------------------------

pub async fn recover_version(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((id, version_number)): Path<(Uuid, i32)>,
) -> impl IntoResponse {
    if !is_admin(&claims) {
        return IoError::Forbidden("Admin access required".into()).into_response();
    }

    let result = match sqlx::query(
        r#"
        UPDATE design_object_versions SET deleted_at = NULL
        WHERE design_object_id = $1 AND version_number = $2 AND deleted_at IS NOT NULL
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
            tracing::error!(error = %e, "recover_version query failed");
            return IoError::Database(e).into_response();
        }
    };

    match result {
        Some(_) => {
            tracing::info!(graphic_id = %id, version = version_number, "Version recovered");
            Json(ApiResponse::ok(serde_json::json!({ "recovered": true }))).into_response()
        }
        None => IoError::NotFound(format!(
            "Soft-deleted version {} of graphic {} not found",
            version_number, id
        ))
        .into_response(),
    }
}

// ---------------------------------------------------------------------------
// DELETE /api/v1/design-objects/:id/versions/:version_number/permanent (admin only)
// ---------------------------------------------------------------------------

pub async fn permanent_delete_version(
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
        DELETE FROM design_object_versions
        WHERE design_object_id = $1 AND version_number = $2
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
            tracing::error!(error = %e, "permanent_delete_version query failed");
            return IoError::Database(e).into_response();
        }
    };

    match result {
        Some(row) => {
            let version_uuid: Uuid = row.try_get("id").unwrap_or_default();
            let audit_meta = serde_json::json!({
                "design_object_id": id.to_string(),
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
                .bind("design_object_versions")
                .bind("version.permanent_delete")
                .bind(version_uuid)
                .bind(user_id)
                .bind(audit_meta)
                .execute(&db)
                .await;
            });
            tracing::info!(graphic_id = %id, version = version_number, "Version permanently deleted");
            Json(ApiResponse::ok(
                serde_json::json!({ "permanently_deleted": true }),
            ))
            .into_response()
        }
        None => IoError::NotFound(format!(
            "Version {} of graphic {} not found",
            version_number, id
        ))
        .into_response(),
    }
}

// ---------------------------------------------------------------------------
// PATCH /api/v1/design-objects/:id/versions/:version_number
// ---------------------------------------------------------------------------

pub async fn update_version_label(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((id, version_number)): Path<(Uuid, i32)>,
    Json(body): Json<UpdateVersionLabelBody>,
) -> impl IntoResponse {
    if !check_permission(&claims, "designer:write") {
        return IoError::Forbidden("designer:write permission required".into()).into_response();
    }

    let user_id = match claims.sub.parse::<Uuid>() {
        Ok(u) => u,
        Err(_) => return IoError::Internal("Invalid user ID in token".into()).into_response(),
    };

    let result = if is_admin(&claims) {
        sqlx::query(
            r#"
            UPDATE design_object_versions SET label = $1
            WHERE design_object_id = $2 AND version_number = $3 AND deleted_at IS NULL
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
            UPDATE design_object_versions SET label = $1
            WHERE design_object_id = $2 AND version_number = $3
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
            "Version {} of graphic {} not found or not owned by you",
            version_number, id
        ))
        .into_response(),
        Err(e) => {
            tracing::error!(error = %e, "update_version_label query failed");
            IoError::Database(e).into_response()
        }
    }
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
        SELECT id, name, type, svg_data, bindings, metadata, parent_id, published, created_at, created_by
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
            .expect("response builder with static headers")
            .into_response(),
        Err(_) => {
            // Return a 1×1 transparent PNG placeholder rather than a 404
            // so <img> elements don't show a broken image icon while tiles are generating
            const EMPTY_PNG: &[u8] = &[
                0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG header
                0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR chunk length + type
                0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // width=1, height=1
                0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15,
                0xc4, // bit depth=8, colorType=6 (RGBA)
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
                .expect("response builder with static headers")
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
            .expect("response builder with static headers")
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
            .expect("response builder with static headers")
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

    let pg = filter.page.unwrap_or(1).max(1);
    let limit = filter.limit.unwrap_or(50).clamp(1, 100);
    let offset = ((pg - 1) * limit) as i64;

    // Only allow shape/stencil types on this endpoint
    let allowed_types = ["shape", "stencil", "symbol", "template"];
    let type_filter: Option<String> = filter.object_type.and_then(|t| {
        if allowed_types.contains(&t.as_str()) {
            Some(t)
        } else {
            None
        }
    });

    let total: i64 = match &type_filter {
        Some(t) => {
            match sqlx::query_scalar(
                "SELECT COUNT(*) FROM design_objects WHERE type = $1 AND deleted_at IS NULL",
            )
            .bind(t)
            .fetch_one(&state.db)
            .await
            {
                Ok(n) => n,
                Err(e) => {
                    tracing::error!(error = %e, "list_design_objects count query failed");
                    return IoError::Database(e).into_response();
                }
            }
        }
        None => {
            match sqlx::query_scalar(
                "SELECT COUNT(*) FROM design_objects WHERE type IN ('shape', 'stencil', 'symbol', 'template') AND deleted_at IS NULL",
            )
            .fetch_one(&state.db)
            .await
            {
                Ok(n) => n,
                Err(e) => {
                    tracing::error!(error = %e, "list_design_objects count query failed");
                    return IoError::Database(e).into_response();
                }
            }
        }
    };

    let rows = match type_filter {
        Some(ref t) => {
            sqlx::query(
                r#"
                SELECT
                    id, name, type, svg_data, bindings, metadata, parent_id, created_at, created_by
                FROM design_objects
                WHERE type = $1 AND deleted_at IS NULL
                ORDER BY name ASC
                LIMIT $2 OFFSET $3
                "#,
            )
            .bind(t)
            .bind(limit as i64)
            .bind(offset)
            .fetch_all(&state.db)
            .await
        }
        None => {
            sqlx::query(
                r#"
                SELECT
                    id, name, type, svg_data, bindings, metadata, parent_id, created_at, created_by
                FROM design_objects
                WHERE type IN ('shape', 'stencil', 'symbol', 'template') AND deleted_at IS NULL
                ORDER BY type ASC, name ASC
                LIMIT $1 OFFSET $2
                "#,
            )
            .bind(limit as i64)
            .bind(offset)
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

    Json(PagedResponse::new(items, pg, limit, total as u64)).into_response()
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
        return IoError::BadRequest("type must be one of: shape, stencil, symbol, template".into())
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
    let bindings = body
        .bindings
        .unwrap_or(JsonValue::Object(serde_json::Map::new()));
    let metadata = body
        .metadata
        .unwrap_or(JsonValue::Object(serde_json::Map::new()));

    let row = match sqlx::query(
        r#"
        INSERT INTO design_objects
            (id, name, type, svg_data, bindings, metadata, parent_id, created_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, name, type, svg_data, bindings, metadata, parent_id, published, created_at, created_by
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
        SELECT id, name, type, svg_data, bindings, metadata, parent_id, published, created_at, created_by
        FROM design_objects
        WHERE id = $1 AND deleted_at IS NULL
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

    let user_id: Uuid = match Uuid::parse_str(&claims.sub) {
        Ok(uid) => uid,
        Err(_) => return IoError::Unauthorized.into_response(),
    };

    let result = match sqlx::query(
        "UPDATE design_objects SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL AND (created_by = $2 OR $3::boolean) RETURNING id",
    )
    .bind(id)
    .bind(user_id)
    .bind(is_admin(&claims))
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
            let lod_level = entry.get("lodLevel").and_then(|v| v.as_i64()).unwrap_or(0) as i32;
            Some(PointBindingIndex {
                point_id,
                bbox,
                lod_level,
            })
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
    /// Admin only: when "true", return all users' graphics.
    pub include_all_users: Option<String>,
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
    let user_id: Uuid = Uuid::parse_str(&claims.sub).unwrap_or_default();
    let all_users = query.include_all_users.as_deref() == Some("true") && is_admin(&claims);

    // $1 = all_users (bool), $2 = user_id (UUID), $3 = scope_filter
    let hierarchy_sql = "SELECT id, name, parent_id, type \
         FROM design_objects \
         WHERE type = 'graphic' \
           AND deleted_at IS NULL \
           AND (metadata->>'module' = $3 OR $3 = 'all') \
           AND ($1::boolean OR created_by = $2 OR COALESCE(published, false) = true) \
         ORDER BY name ASC";

    let rows = match sqlx::query(hierarchy_sql)
        .bind(all_users)
        .bind(user_id)
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
            Some(HierarchyNode {
                id,
                name,
                parent_id,
                object_type,
                children: vec![],
            })
        })
        .collect();

    let total = nodes.len() as u64;
    let tree_data = vec![serde_json::json!({ "tree": nodes })];
    Json(PagedResponse::new(tree_data, 1, total.max(1) as u32, total)).into_response()
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
    let mime_type: String = row
        .try_get("mime_type")
        .unwrap_or_else(|_| "image/png".to_string());

    axum::response::Response::builder()
        .status(200)
        .header("Content-Type", mime_type)
        .header("Cache-Control", "public, max-age=31536000, immutable")
        .body(axum::body::Body::from(content))
        .expect("response builder with valid mime_type from database")
        .into_response()
}

// ---------------------------------------------------------------------------
// POST /api/v1/shapes/batch — batch load shape SVGs and sidecars
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct BatchShapesBody {
    pub shape_ids: Vec<String>,
}

#[derive(Debug, Deserialize)]
pub struct BatchIdsBody {
    pub ids: Vec<Uuid>,
}

pub async fn batch_shapes(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    req_headers: axum::http::HeaderMap,
    Json(body): Json<BatchShapesBody>,
) -> Response {
    if !check_permission(&claims, "process:read") && !check_permission(&claims, "console:read") {
        return IoError::Forbidden("process:read or console:read permission required".into())
            .into_response();
    }

    if body.shape_ids.is_empty() {
        return Json(ApiResponse::ok(serde_json::json!({}))).into_response();
    }

    let rows = match sqlx::query(
        r#"
        SELECT metadata->>'shape_id' as shape_id, svg_data, metadata
        FROM design_objects
        WHERE metadata->>'shape_id' = ANY($1)
          AND type IN ('shape', 'shape_part')
        "#,
    )
    .bind(&body.shape_ids)
    .fetch_all(&state.db)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(error = %e, "batch_shapes query failed");
            return IoError::Database(e).into_response();
        }
    };

    let mut result = serde_json::Map::new();
    for row in &rows {
        let shape_id: Option<String> = row.try_get("shape_id").ok().flatten();
        let svg_data: Option<String> = row.try_get("svg_data").ok().flatten();
        let metadata: Option<JsonValue> = row.try_get("metadata").ok().flatten();

        if let (Some(sid), Some(svg)) = (shape_id, svg_data) {
            let sidecar = metadata
                .as_ref()
                .and_then(|m| m.get("sidecar"))
                .cloned()
                .unwrap_or(serde_json::json!({}));
            let sidecar_hash_val = metadata
                .as_ref()
                .and_then(|m| m.get("sidecar_hash"))
                .and_then(|v| v.as_str())
                .unwrap_or("");
            let svg_hash_val = metadata
                .as_ref()
                .and_then(|m| m.get("svg_hash"))
                .and_then(|v| v.as_str())
                .unwrap_or("");
            result.insert(
                sid,
                serde_json::json!({
                    "svg": svg,
                    "sidecar": sidecar,
                    "sidecar_hash": sidecar_hash_val,
                    "svg_hash": svg_hash_val,
                }),
            );
        }
    }

    // Compute ETag from result content
    use std::hash::{Hash, Hasher};
    let result_str = serde_json::to_string(&JsonValue::Object(result.clone())).unwrap_or_default();
    let mut hasher = std::collections::hash_map::DefaultHasher::new();
    result_str.hash(&mut hasher);
    let etag = format!("\"{}\"", hasher.finish());

    // Return 304 if client already has this content
    let client_etag = req_headers
        .get(header::IF_NONE_MATCH)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    if client_etag == etag {
        return Response::builder()
            .status(StatusCode::NOT_MODIFIED)
            .body(Body::empty())
            .unwrap();
    }

    let mut response = Json(ApiResponse::ok(JsonValue::Object(result))).into_response();
    response.headers_mut().insert(
        header::ETAG,
        HeaderValue::from_str(&etag).expect("etag is valid ascii"),
    );
    response.headers_mut().insert(
        header::CACHE_CONTROL,
        HeaderValue::from_static("private, max-age=300"),
    );
    response
}

// ---------------------------------------------------------------------------
// GET /api/v1/shapes — shape library catalog (mirrors /shapes/index.json)
// ---------------------------------------------------------------------------
pub async fn list_library_shapes(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> impl IntoResponse {
    if !check_permission(&claims, "process:read") && !check_permission(&claims, "console:read") {
        return IoError::Forbidden("process:read or console:read permission required".into())
            .into_response();
    }

    let rows = match sqlx::query(
        r#"
        SELECT
            metadata->>'shape_id'              AS shape_id,
            metadata->>'display_name'           AS display_name,
            metadata->>'category'               AS category,
            metadata->'sidecar'->>'subcategory' AS subcategory
        FROM design_objects
        WHERE type IN ('shape', 'shape_part')
          AND metadata->>'source' = 'library'
        ORDER BY metadata->>'category', metadata->>'shape_id'
        "#,
    )
    .fetch_all(&state.db)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(error = %e, "list_library_shapes query failed");
            return IoError::Database(e).into_response();
        }
    };

    let shapes: Vec<serde_json::Value> = rows
        .iter()
        .filter_map(|row| {
            let id: Option<String> = row.try_get("shape_id").ok().flatten();
            let label: Option<String> = row.try_get("display_name").ok().flatten();
            let category: Option<String> = row.try_get("category").ok().flatten();
            let subcategory: Option<String> = row.try_get("subcategory").ok().flatten();
            match (id, label, category) {
                (Some(id), Some(label), Some(category)) => Some(serde_json::json!({
                    "id": id,
                    "label": label,
                    "category": category,
                    "subcategory": subcategory,
                })),
                _ => None,
            }
        })
        .collect();

    Json(ApiResponse::ok(serde_json::json!({ "shapes": shapes }))).into_response()
}

// ---------------------------------------------------------------------------
// POST /api/v1/stencils/batch — batch load stencil SVGs
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

    if let Ok(Some(field)) = multipart.next_field().await {
        let content_type = field.content_type().unwrap_or("image/png").to_string();
        // Accept image/* only
        if !content_type.starts_with("image/") {
            return IoError::BadRequest(format!("Unsupported file type: {}", content_type))
                .into_response();
        }
        match field.bytes().await {
            Ok(data) => {
                if data.len() > 10 * 1024 * 1024 {
                    return IoError::BadRequest("Image too large (max 10MB)".into())
                        .into_response();
                }
                file_data = Some((data.to_vec(), content_type));
            }
            Err(e) => {
                return IoError::BadRequest(format!("Failed to read file: {e}")).into_response();
            }
        }
    }

    let (bytes, mime_type) = match file_data {
        Some(f) => f,
        None => {
            return IoError::BadRequest("No file field in multipart body".into()).into_response()
        }
    };

    // Compute SHA-256 content hash for deduplication
    use std::fmt::Write;
    let hash = {
        use sha2::{Digest, Sha256};
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

    let row =
        match sqlx::query("SELECT content, mime_type FROM graphic_assets WHERE content_hash = $1")
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
    let mime_type: String = row
        .try_get("mime_type")
        .unwrap_or_else(|_| "image/png".to_string());

    axum::response::Response::builder()
        .status(200)
        .header("Content-Type", mime_type)
        .header("Cache-Control", "public, max-age=31536000, immutable")
        .body(axum::body::Body::from(content))
        .expect("response builder with valid mime_type from database")
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
    if let Err(e) = sqlx::query("DELETE FROM design_object_shapes WHERE design_object_id = $1")
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
    if let Err(e) = sqlx::query("DELETE FROM design_object_points WHERE design_object_id = $1")
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

// ---------------------------------------------------------------------------
// GET /api/v1/shapes/user — list user-created (custom) shapes
// ---------------------------------------------------------------------------

pub async fn list_user_shapes(
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
            svg_data,
            metadata,
            created_at,
            created_by
        FROM design_objects
        WHERE type IN ('shape', 'shape_part')
          AND metadata->>'source' = 'user'
        ORDER BY name ASC
        "#,
    )
    .fetch_all(&state.db)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(error = %e, "list_user_shapes query failed");
            return IoError::Database(e).into_response();
        }
    };

    let items: Vec<JsonValue> = rows
        .iter()
        .map(|row| {
            let id: Option<Uuid> = row.try_get("id").ok();
            let name: Option<String> = row.try_get("name").ok().flatten();
            let metadata: Option<JsonValue> = row.try_get("metadata").ok().flatten();
            let created_at: Option<DateTime<Utc>> = row.try_get("created_at").ok().flatten();

            let shape_id = metadata
                .as_ref()
                .and_then(|m| m.get("shape_id"))
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .unwrap_or_else(|| id.map(|u| u.to_string()).unwrap_or_default());

            let category = metadata
                .as_ref()
                .and_then(|m| m.get("category"))
                .and_then(|v| v.as_str())
                .unwrap_or("custom")
                .to_string();

            serde_json::json!({
                "id": id.map(|u| u.to_string()).unwrap_or_default(),
                "shape_id": shape_id,
                "name": name.unwrap_or_default(),
                "category": category,
                "source": "user",
                "created_at": created_at.map(|t| t.to_rfc3339()),
            })
        })
        .collect();

    Json(ApiResponse::ok(
        serde_json::json!({ "data": items, "total": items.len() }),
    ))
    .into_response()
}

// ---------------------------------------------------------------------------
// POST /api/v1/shapes/user — upload a custom SVG shape
// ---------------------------------------------------------------------------

pub async fn upload_user_shape(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    mut multipart: Multipart,
) -> impl IntoResponse {
    if !check_permission(&claims, "designer:write") {
        return IoError::Forbidden("designer:write permission required".into()).into_response();
    }

    let created_by: Uuid = match Uuid::parse_str(&claims.sub) {
        Ok(id) => id,
        Err(_) => return IoError::Unauthorized.into_response(),
    };

    let mut svg_data: Option<String> = None;
    let mut shape_name: Option<String> = None;
    let mut category = "custom".to_string();

    while let Ok(Some(field)) = multipart.next_field().await {
        let field_name = field.name().unwrap_or("").to_string();
        match field_name.as_str() {
            "svg" | "file" => {
                let ct = field.content_type().unwrap_or("").to_string();
                if !ct.is_empty() && !ct.contains("svg") && !ct.contains("octet-stream") {
                    return IoError::BadRequest(format!(
                        "Expected SVG file, got content-type: {ct}"
                    ))
                    .into_response();
                }
                let filename = field.file_name().map(|s| s.to_string()).unwrap_or_default();
                if shape_name.is_none() && !filename.is_empty() {
                    // Use filename stem as the default name
                    let stem = std::path::Path::new(&filename)
                        .file_stem()
                        .and_then(|s| s.to_str())
                        .unwrap_or("Custom Shape")
                        .to_string();
                    shape_name = Some(stem);
                }
                match field.bytes().await {
                    Ok(data) => {
                        if data.len() > 2 * 1024 * 1024 {
                            return IoError::BadRequest("SVG too large (max 2MB)".into())
                                .into_response();
                        }
                        let text = match std::str::from_utf8(&data) {
                            Ok(s) => s.to_string(),
                            Err(_) => {
                                return IoError::BadRequest("SVG must be valid UTF-8".into())
                                    .into_response()
                            }
                        };
                        // Basic sanity check — must contain <svg
                        if !text.contains("<svg") {
                            return IoError::BadRequest("File does not appear to be an SVG".into())
                                .into_response();
                        }
                        // Security scan
                        if let Err(e) = file_scan::check_upload(text.as_bytes(), "upload.svg") {
                            return e.into_response();
                        }
                        svg_data = Some(text);
                    }
                    Err(e) => {
                        return IoError::BadRequest(format!("Failed to read SVG field: {e}"))
                            .into_response();
                    }
                }
            }
            "name" => {
                if let Ok(bytes) = field.bytes().await {
                    if let Ok(s) = std::str::from_utf8(&bytes) {
                        let trimmed = s.trim().to_string();
                        if !trimmed.is_empty() {
                            shape_name = Some(trimmed);
                        }
                    }
                }
            }
            "category" => {
                if let Ok(bytes) = field.bytes().await {
                    if let Ok(s) = std::str::from_utf8(&bytes) {
                        let trimmed = s.trim().to_string();
                        if !trimmed.is_empty() {
                            category = trimmed;
                        }
                    }
                }
            }
            _ => {
                // ignore unknown fields
                let _ = field.bytes().await;
            }
        }
    }

    let svg = match svg_data {
        Some(s) => s,
        None => {
            return IoError::BadRequest("No SVG file provided (field name: 'svg' or 'file')".into())
                .into_response()
        }
    };

    let name = shape_name.unwrap_or_else(|| "Custom Shape".to_string());

    // Generate a user-scoped shape_id to avoid collisions with library IDs
    let shape_id = format!(".custom.{}", Uuid::new_v4().simple());

    let view_box =
        extract_viewbox_from_svg(svg.as_str()).unwrap_or_else(|| "0 0 100 100".to_string());

    let sidecar_value = serde_json::json!({
        "geometry": {
            "viewBox": &view_box
        }
    });
    let computed_sidecar_hash = crate::shape_hash::sidecar_hash(&sidecar_value);
    let computed_svg_hash = crate::shape_hash::svg_hash(&svg);

    let metadata = serde_json::json!({
        "shape_id": shape_id,
        "source": "user",
        "display_name": &name,
        "category": category,
        "schema": "io-shape-v1",
        "view_box": &view_box,
        "sidecar": sidecar_value,
        "sidecar_hash": computed_sidecar_hash,
        "svg_hash": computed_svg_hash,
    });

    let id = Uuid::new_v4();

    match sqlx::query(
        r#"
        INSERT INTO design_objects
            (id, name, type, svg_data, metadata, created_by)
        VALUES
            ($1, $2, 'shape', $3, $4::jsonb, $5)
        "#,
    )
    .bind(id)
    .bind(&name)
    .bind(&svg)
    .bind(metadata.to_string())
    .bind(created_by)
    .execute(&state.db)
    .await
    {
        Ok(_) => Json(ApiResponse::ok(serde_json::json!({
            "id": id.to_string(),
            "shape_id": shape_id,
            "name": name,
            "category": category,
            "source": "user",
        })))
        .into_response(),
        Err(e) => {
            tracing::error!(error = %e, "upload_user_shape insert failed");
            IoError::Database(e).into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// GET  /api/v1/shapes/:shape_id/svg — export raw SVG for any shape
// PUT  /api/v1/shapes/:shape_id/svg — replace user shape SVG (preserve sidecar)
// ---------------------------------------------------------------------------

fn extract_viewbox_from_svg(svg: &str) -> Option<String> {
    // Match viewBox="..." or viewBox='...'
    for prefix in ["viewBox=\"", "viewBox='"] {
        if let Some(start) = svg.find(prefix) {
            let rest = &svg[start + prefix.len()..];
            let quote_char = if prefix.ends_with('"') { '"' } else { '\'' };
            if let Some(end) = rest.find(quote_char) {
                let vb = rest[..end].trim().to_string();
                if !vb.is_empty() {
                    return Some(vb);
                }
            }
        }
    }
    None
}

pub async fn export_shape_svg(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(shape_id): Path<String>,
) -> Response {
    if !check_permission(&claims, "process:read")
        && !check_permission(&claims, "console:read")
        && !check_permission(&claims, "designer:read")
    {
        return IoError::Forbidden(
            "process:read, console:read, or designer:read permission required".into(),
        )
        .into_response();
    }

    let row = match sqlx::query(
        r#"
        SELECT svg_data
        FROM design_objects
        WHERE metadata->>'shape_id' = $1
          AND type IN ('shape', 'shape_part')
        LIMIT 1
        "#,
    )
    .bind(&shape_id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(r)) => r,
        Ok(None) => {
            return IoError::NotFound(format!("Shape '{}' not found", shape_id)).into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, shape_id = %shape_id, "export_shape_svg query failed");
            return IoError::Database(e).into_response();
        }
    };

    let svg: Option<String> = row.try_get("svg_data").ok().flatten();
    match svg {
        Some(s) => Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, "image/svg+xml")
            .body(Body::from(s))
            .unwrap(),
        None => IoError::NotFound(format!("Shape '{}' has no SVG data", shape_id)).into_response(),
    }
}

#[derive(Debug, Deserialize)]
pub struct ReimportShapeSvgBody {
    pub svg_content: String,
}

pub async fn reimport_shape_svg(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(shape_id): Path<String>,
    Json(body): Json<ReimportShapeSvgBody>,
) -> Response {
    if !check_permission(&claims, "designer:write") {
        return IoError::Forbidden("designer:write permission required".into()).into_response();
    }

    if !body.svg_content.contains("<svg") {
        return IoError::BadRequest("svg_content does not appear to be an SVG".into())
            .into_response();
    }

    // Security scan
    if let Err(e) = file_scan::check_upload(body.svg_content.as_bytes(), "shape.svg") {
        return e.into_response();
    }

    let row = match sqlx::query(
        r#"
        SELECT id, metadata->>'source' as source,
               metadata->'sidecar'->'geometry'->>'viewBox' as old_viewbox
        FROM design_objects
        WHERE metadata->>'shape_id' = $1
          AND type IN ('shape', 'shape_part')
        LIMIT 1
        "#,
    )
    .bind(&shape_id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(r)) => r,
        Ok(None) => {
            return IoError::NotFound(format!("Shape '{}' not found", shape_id)).into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, shape_id = %shape_id, "reimport_shape_svg lookup failed");
            return IoError::Database(e).into_response();
        }
    };

    let source: Option<String> = row.try_get("source").ok().flatten();
    if source.as_deref() != Some("user") {
        return IoError::Forbidden("Cannot modify built-in library shapes".into()).into_response();
    }

    let row_id: Uuid = row.try_get("id").unwrap();
    let old_viewbox: String = row
        .try_get("old_viewbox")
        .ok()
        .flatten()
        .unwrap_or_else(|| "0 0 100 100".to_string());
    let new_viewbox =
        extract_viewbox_from_svg(&body.svg_content).unwrap_or_else(|| old_viewbox.clone());
    let viewbox_changed = new_viewbox != old_viewbox;

    let new_svg_hash = crate::shape_hash::svg_hash(&body.svg_content);

    match sqlx::query(
        r#"
        UPDATE design_objects
        SET svg_data    = $1,
            metadata    = jsonb_set(
                              jsonb_set(metadata, '{sidecar,geometry,viewBox}', to_jsonb($2::text)),
                              '{svg_hash}', to_jsonb($4::text)
                          ),
            updated_at  = NOW()
        WHERE id = $3
        "#,
    )
    .bind(&body.svg_content)
    .bind(&new_viewbox)
    .bind(row_id)
    .bind(&new_svg_hash)
    .execute(&state.db)
    .await
    {
        Ok(_) => Json(ApiResponse::ok(serde_json::json!({
            "viewBoxChanged": viewbox_changed,
            "oldViewBox": old_viewbox,
            "newViewBox": new_viewbox,
        })))
        .into_response(),
        Err(e) => {
            tracing::error!(error = %e, shape_id = %shape_id, "reimport_shape_svg update failed");
            IoError::Database(e).into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// DELETE /api/v1/shapes/user/:id — delete a user-created custom shape
// ---------------------------------------------------------------------------

pub async fn delete_user_shape(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    if !check_permission(&claims, "designer:write") {
        return IoError::Forbidden("designer:write permission required".into()).into_response();
    }

    // Verify it exists and is a user shape (not a library shape)
    let row = match sqlx::query(
        r#"
        SELECT id, metadata->>'source' as source
        FROM design_objects
        WHERE id = $1
          AND type IN ('shape', 'shape_part')
        "#,
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(r)) => r,
        Ok(None) => return IoError::NotFound(format!("Shape {} not found", id)).into_response(),
        Err(e) => {
            tracing::error!(error = %e, "delete_user_shape lookup failed");
            return IoError::Database(e).into_response();
        }
    };

    let source: Option<String> = row.try_get("source").ok().flatten();
    if source.as_deref() != Some("user") {
        return IoError::Forbidden("Cannot delete built-in library shapes".into()).into_response();
    }

    match sqlx::query("DELETE FROM design_objects WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await
    {
        Ok(_) => Json(ApiResponse::ok(
            serde_json::json!({ "deleted": id.to_string() }),
        ))
        .into_response(),
        Err(e) => {
            tracing::error!(error = %e, "delete_user_shape delete failed");
            IoError::Database(e).into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// POST /api/v1/design-objects/:id/lock — acquire pessimistic edit lock
// ---------------------------------------------------------------------------

pub async fn acquire_design_object_lock(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    if !check_permission(&claims, "designer:write") {
        return IoError::Forbidden("designer:write permission required".into()).into_response();
    }

    let user_id = match claims.sub.parse::<Uuid>() {
        Ok(u) => u,
        Err(_) => return IoError::Internal("Invalid user ID in token".into()).into_response(),
    };

    // Try to acquire the lock: succeeds if unlocked OR already held by this user.
    let updated = match sqlx::query_scalar::<_, i64>(
        r#"
        WITH attempt AS (
            UPDATE design_objects
            SET locked_by = $1, locked_at = NOW()
            WHERE id = $2
              AND (locked_by IS NULL OR locked_by = $1)
            RETURNING 1
        )
        SELECT COUNT(*) FROM attempt
        "#,
    )
    .bind(user_id)
    .bind(id)
    .fetch_one(&state.db)
    .await
    {
        Ok(n) => n,
        Err(e) => {
            tracing::error!(error = %e, "acquire_design_object_lock query failed");
            return IoError::Database(e).into_response();
        }
    };

    if updated > 0 {
        return Json(ApiResponse::ok(serde_json::json!({
            "data": { "acquired": true }
        })))
        .into_response();
    }

    // Lock held by another user — fetch their name and the lock timestamp.
    let row = match sqlx::query(
        r#"
        SELECT u.display_name, d.locked_at
        FROM design_objects d
        LEFT JOIN users u ON u.id = d.locked_by
        WHERE d.id = $1
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
            tracing::error!(error = %e, "acquire_design_object_lock fetch failed");
            return IoError::Database(e).into_response();
        }
    };

    let locked_by_name: Option<String> = row.try_get("display_name").ok().flatten();
    let locked_at: Option<DateTime<Utc>> = row.try_get("locked_at").ok().flatten();

    Json(ApiResponse::ok(serde_json::json!({
        "data": {
            "acquired": false,
            "locked_by_name": locked_by_name.unwrap_or_else(|| "another user".to_string()),
            "locked_at": locked_at.map(|t| t.to_rfc3339()).unwrap_or_default(),
        }
    })))
    .into_response()
}

// ---------------------------------------------------------------------------
// DELETE /api/v1/design-objects/:id/lock — release pessimistic edit lock
// ---------------------------------------------------------------------------

pub async fn release_design_object_lock(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    if !check_permission(&claims, "designer:write") {
        return IoError::Forbidden("designer:write permission required".into()).into_response();
    }

    let user_id = match claims.sub.parse::<Uuid>() {
        Ok(u) => u,
        Err(_) => return IoError::Internal("Invalid user ID in token".into()).into_response(),
    };

    match sqlx::query(
        "UPDATE design_objects SET locked_by = NULL, locked_at = NULL WHERE id = $1 AND locked_by = $2",
    )
    .bind(id)
    .bind(user_id)
    .execute(&state.db)
    .await
    {
        Ok(_) => Json(ApiResponse::ok(serde_json::json!({ "released": true }))).into_response(),
        Err(e) => {
            tracing::error!(error = %e, "release_design_object_lock query failed");
            IoError::Database(e).into_response()
        }
    }
}
