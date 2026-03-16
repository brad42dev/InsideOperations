use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
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
// Permission helper
// ---------------------------------------------------------------------------

fn check_permission(claims: &Claims, permission: &str) -> bool {
    claims.permissions.iter().any(|p| p == "*" || p == permission)
}

// ---------------------------------------------------------------------------
// Helper: extract user UUID from claims sub
// ---------------------------------------------------------------------------

fn user_id_from_claims(claims: &Claims) -> Option<Uuid> {
    Uuid::parse_str(&claims.sub).ok()
}

// ---------------------------------------------------------------------------
// Request / Response types
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize)]
pub struct DashboardRow {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub category: Option<String>,
    pub layout: JsonValue,
    pub widgets: JsonValue,
    pub variables: JsonValue,
    pub published: bool,
    pub is_system: bool,
    pub user_id: Option<Uuid>,
    pub thumbnail: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Deserialize)]
pub struct CreateDashboardRequest {
    pub name: String,
    pub description: Option<String>,
    pub category: Option<String>,
    pub layout: Option<JsonValue>,
    pub widgets: Option<JsonValue>,
    pub variables: Option<JsonValue>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateDashboardRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub category: Option<String>,
    pub layout: Option<JsonValue>,
    pub widgets: Option<JsonValue>,
    pub variables: Option<JsonValue>,
    pub published: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct ListParams {
    pub published: Option<bool>,
    pub category: Option<String>,
    pub system: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct PlaylistRow {
    pub id: Uuid,
    pub name: String,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
pub struct PlaylistItemRow {
    pub id: Uuid,
    pub playlist_id: Uuid,
    pub dashboard_id: Uuid,
    pub position: i32,
    pub dwell_seconds: i32,
    pub variable_overrides: JsonValue,
}

#[derive(Debug, Serialize)]
pub struct PlaylistDetail {
    #[serde(flatten)]
    pub playlist: PlaylistRow,
    pub items: Vec<PlaylistItemRow>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePlaylistRequest {
    pub name: String,
    pub items: Option<Vec<CreatePlaylistItemRequest>>,
}

#[derive(Debug, Deserialize)]
pub struct CreatePlaylistItemRequest {
    pub dashboard_id: Uuid,
    pub position: i32,
    pub dwell_seconds: Option<i32>,
    pub variable_overrides: Option<JsonValue>,
}

#[derive(Debug, Deserialize)]
pub struct UpdatePlaylistRequest {
    pub name: Option<String>,
    pub items: Option<Vec<CreatePlaylistItemRequest>>,
}

// ---------------------------------------------------------------------------
// Row mapping helpers
// ---------------------------------------------------------------------------

fn row_to_dashboard(row: &sqlx::postgres::PgRow) -> Result<DashboardRow, sqlx::Error> {
    let id: Uuid = row.try_get("id")?;
    let name: String = row.try_get("name")?;
    let description: Option<String> = row.try_get("description").ok().flatten();
    let category: Option<String> = row.try_get("category").ok().flatten();
    let layout: JsonValue = row.try_get("layout").unwrap_or(JsonValue::Object(serde_json::Map::new()));
    let widgets: JsonValue = row.try_get("widgets").unwrap_or(JsonValue::Array(vec![]));
    let variables: JsonValue = row.try_get("variables").unwrap_or(JsonValue::Array(vec![]));
    let published: bool = row.try_get("published").unwrap_or(false);
    let is_system: bool = row.try_get("is_system").unwrap_or(false);
    let user_id: Option<Uuid> = row.try_get("user_id").ok().flatten();
    let thumbnail: Option<String> = row.try_get("thumbnail").ok().flatten();
    let created_at: DateTime<Utc> = row.try_get("created_at").unwrap_or_else(|_| Utc::now());
    let updated_at: DateTime<Utc> = row.try_get("updated_at").unwrap_or_else(|_| Utc::now());
    Ok(DashboardRow {
        id,
        name,
        description,
        category,
        layout,
        widgets,
        variables,
        published,
        is_system,
        user_id,
        thumbnail,
        created_at,
        updated_at,
    })
}

fn row_to_playlist(row: &sqlx::postgres::PgRow) -> Result<PlaylistRow, sqlx::Error> {
    Ok(PlaylistRow {
        id: row.try_get("id")?,
        name: row.try_get("name")?,
        created_by: row.try_get("created_by").ok().flatten(),
        created_at: row.try_get("created_at").unwrap_or_else(|_| Utc::now()),
        updated_at: row.try_get("updated_at").unwrap_or_else(|_| Utc::now()),
    })
}

fn row_to_playlist_item(row: &sqlx::postgres::PgRow) -> Result<PlaylistItemRow, sqlx::Error> {
    Ok(PlaylistItemRow {
        id: row.try_get("id")?,
        playlist_id: row.try_get("playlist_id")?,
        dashboard_id: row.try_get("dashboard_id")?,
        position: row.try_get("position")?,
        dwell_seconds: row.try_get("dwell_seconds").unwrap_or(30),
        variable_overrides: row
            .try_get("variable_overrides")
            .unwrap_or(JsonValue::Object(serde_json::Map::new())),
    })
}

// ---------------------------------------------------------------------------
// GET /api/dashboards — list dashboards
// ---------------------------------------------------------------------------

pub async fn list_dashboards(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Query(params): Query<ListParams>,
) -> impl IntoResponse {
    if !check_permission(&claims, "dashboards:read") {
        return IoError::Forbidden("dashboards:read permission required".into()).into_response();
    }

    let user_id = user_id_from_claims(&claims);

    // Build a flexible query: always return system dashboards plus dashboards
    // owned by the current user.  Optional filters narrow by category,
    // published state, or system-only.
    let rows = match sqlx::query(
        r#"
        SELECT id, name, description, category, layout, widgets, variables,
               published, is_system, user_id, thumbnail, created_at, updated_at
        FROM dashboards
        WHERE
            (is_system = true OR user_id = $1)
            AND ($2::boolean IS NULL OR published = $2)
            AND ($3::varchar IS NULL OR category = $3)
            AND ($4::boolean IS NULL OR is_system = $4)
        ORDER BY is_system DESC, name ASC
        "#,
    )
    .bind(user_id)
    .bind(params.published)
    .bind(&params.category)
    .bind(params.system)
    .fetch_all(&state.db)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(error = %e, "list_dashboards query failed");
            return IoError::Database(e).into_response();
        }
    };

    let mut items: Vec<DashboardRow> = Vec::with_capacity(rows.len());
    for row in &rows {
        match row_to_dashboard(row) {
            Ok(d) => items.push(d),
            Err(e) => tracing::warn!(error = %e, "skipping malformed dashboard row"),
        }
    }

    Json(ApiResponse::ok(items)).into_response()
}

// ---------------------------------------------------------------------------
// GET /api/dashboards/:id — get single dashboard
// ---------------------------------------------------------------------------

pub async fn get_dashboard(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    if !check_permission(&claims, "dashboards:read") {
        return IoError::Forbidden("dashboards:read permission required".into()).into_response();
    }

    let user_id = user_id_from_claims(&claims);

    let row = match sqlx::query(
        r#"
        SELECT id, name, description, category, layout, widgets, variables,
               published, is_system, user_id, thumbnail, created_at, updated_at
        FROM dashboards
        WHERE id = $1
          AND (is_system = true OR user_id = $2)
        "#,
    )
    .bind(id)
    .bind(user_id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(r)) => r,
        Ok(None) => return IoError::NotFound(format!("Dashboard {} not found", id)).into_response(),
        Err(e) => {
            tracing::error!(error = %e, "get_dashboard query failed");
            return IoError::Database(e).into_response();
        }
    };

    match row_to_dashboard(&row) {
        Ok(d) => Json(ApiResponse::ok(d)).into_response(),
        Err(e) => {
            tracing::error!(error = %e, "get_dashboard row mapping failed");
            IoError::Internal("Failed to map dashboard".into()).into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// POST /api/dashboards — create dashboard
// ---------------------------------------------------------------------------

pub async fn create_dashboard(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreateDashboardRequest>,
) -> impl IntoResponse {
    if !check_permission(&claims, "dashboards:write") {
        return IoError::Forbidden("dashboards:write permission required".into()).into_response();
    }

    if body.name.trim().is_empty() {
        return IoError::BadRequest("name is required".into()).into_response();
    }

    let user_id = user_id_from_claims(&claims);
    let layout = body.layout.unwrap_or_else(|| serde_json::json!({"cols":12,"rows":8}));
    let widgets = body.widgets.unwrap_or_else(|| JsonValue::Array(vec![]));
    let variables = body.variables.unwrap_or_else(|| JsonValue::Array(vec![]));

    let row = match sqlx::query(
        r#"
        INSERT INTO dashboards
            (name, description, category, layout, widgets, variables, published, is_system, user_id)
        VALUES ($1, $2, $3, $4, $5, $6, false, false, $7)
        RETURNING id, name, description, category, layout, widgets, variables,
                  published, is_system, user_id, thumbnail, created_at, updated_at
        "#,
    )
    .bind(&body.name)
    .bind(&body.description)
    .bind(&body.category)
    .bind(&layout)
    .bind(&widgets)
    .bind(&variables)
    .bind(user_id)
    .fetch_one(&state.db)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(error = %e, "create_dashboard insert failed");
            return IoError::Database(e).into_response();
        }
    };

    match row_to_dashboard(&row) {
        Ok(d) => (StatusCode::CREATED, Json(ApiResponse::ok(d))).into_response(),
        Err(e) => {
            tracing::error!(error = %e, "create_dashboard row mapping failed");
            IoError::Internal("Failed to map created dashboard".into()).into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// PUT /api/dashboards/:id — update dashboard
// ---------------------------------------------------------------------------

pub async fn update_dashboard(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdateDashboardRequest>,
) -> impl IntoResponse {
    if !check_permission(&claims, "dashboards:write") {
        return IoError::Forbidden("dashboards:write permission required".into()).into_response();
    }

    let user_id = user_id_from_claims(&claims);

    // Fetch the current record to check ownership and system flag.
    let existing = match sqlx::query(
        "SELECT is_system, user_id FROM dashboards WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(r)) => r,
        Ok(None) => return IoError::NotFound(format!("Dashboard {} not found", id)).into_response(),
        Err(e) => {
            tracing::error!(error = %e, "update_dashboard fetch failed");
            return IoError::Database(e).into_response();
        }
    };

    let is_system: bool = existing.try_get("is_system").unwrap_or(false);
    let owner_id: Option<Uuid> = existing.try_get("user_id").ok().flatten();

    if is_system {
        // System dashboards require the dashboards:admin permission.
        if !check_permission(&claims, "dashboards:admin") {
            return IoError::Forbidden(
                "dashboards:admin permission required to edit system dashboards".into(),
            )
            .into_response();
        }
    } else if owner_id != user_id {
        return IoError::Forbidden("Only the dashboard owner can edit this dashboard".into())
            .into_response();
    }

    let row = match sqlx::query(
        r#"
        UPDATE dashboards
        SET
            name        = COALESCE($1, name),
            description = COALESCE($2, description),
            category    = COALESCE($3, category),
            layout      = COALESCE($4, layout),
            widgets     = COALESCE($5, widgets),
            variables   = COALESCE($6, variables),
            published   = COALESCE($7, published),
            updated_at  = NOW()
        WHERE id = $8
        RETURNING id, name, description, category, layout, widgets, variables,
                  published, is_system, user_id, thumbnail, created_at, updated_at
        "#,
    )
    .bind(&body.name)
    .bind(&body.description)
    .bind(&body.category)
    .bind(&body.layout)
    .bind(&body.widgets)
    .bind(&body.variables)
    .bind(body.published)
    .bind(id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(r)) => r,
        Ok(None) => return IoError::NotFound(format!("Dashboard {} not found", id)).into_response(),
        Err(e) => {
            tracing::error!(error = %e, "update_dashboard query failed");
            return IoError::Database(e).into_response();
        }
    };

    match row_to_dashboard(&row) {
        Ok(d) => Json(ApiResponse::ok(d)).into_response(),
        Err(e) => {
            tracing::error!(error = %e, "update_dashboard row mapping failed");
            IoError::Internal("Failed to map updated dashboard".into()).into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// DELETE /api/dashboards/:id — delete dashboard
// ---------------------------------------------------------------------------

pub async fn delete_dashboard(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    if !check_permission(&claims, "dashboards:write") {
        return IoError::Forbidden("dashboards:write permission required".into()).into_response();
    }

    let user_id = user_id_from_claims(&claims);

    // Fetch to check is_system and ownership.
    let existing = match sqlx::query(
        "SELECT is_system, user_id FROM dashboards WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(r)) => r,
        Ok(None) => return IoError::NotFound(format!("Dashboard {} not found", id)).into_response(),
        Err(e) => {
            tracing::error!(error = %e, "delete_dashboard fetch failed");
            return IoError::Database(e).into_response();
        }
    };

    let is_system: bool = existing.try_get("is_system").unwrap_or(false);
    let owner_id: Option<Uuid> = existing.try_get("user_id").ok().flatten();

    if is_system {
        return IoError::Forbidden("System dashboards cannot be deleted".into()).into_response();
    }

    if owner_id != user_id {
        return IoError::Forbidden("Only the dashboard owner can delete this dashboard".into())
            .into_response();
    }

    match sqlx::query("DELETE FROM dashboards WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await
    {
        Ok(_) => (StatusCode::NO_CONTENT, ()).into_response(),
        Err(e) => {
            tracing::error!(error = %e, "delete_dashboard query failed");
            IoError::Database(e).into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// POST /api/dashboards/:id/duplicate — duplicate a dashboard
// ---------------------------------------------------------------------------

pub async fn duplicate_dashboard(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    if !check_permission(&claims, "dashboards:write") {
        return IoError::Forbidden("dashboards:write permission required".into()).into_response();
    }

    let user_id = user_id_from_claims(&claims);

    // Load the source dashboard.
    let src = match sqlx::query(
        r#"
        SELECT id, name, description, category, layout, widgets, variables,
               published, is_system, user_id, thumbnail, created_at, updated_at
        FROM dashboards
        WHERE id = $1
          AND (is_system = true OR user_id = $2)
        "#,
    )
    .bind(id)
    .bind(user_id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(r)) => r,
        Ok(None) => return IoError::NotFound(format!("Dashboard {} not found", id)).into_response(),
        Err(e) => {
            tracing::error!(error = %e, "duplicate_dashboard source fetch failed");
            return IoError::Database(e).into_response();
        }
    };

    let src_dashboard = match row_to_dashboard(&src) {
        Ok(d) => d,
        Err(e) => {
            tracing::error!(error = %e, "duplicate_dashboard source row mapping failed");
            return IoError::Internal("Failed to map source dashboard".into()).into_response();
        }
    };

    let copy_name = format!("Copy of {}", src_dashboard.name);

    let row = match sqlx::query(
        r#"
        INSERT INTO dashboards
            (name, description, category, layout, widgets, variables, published, is_system, user_id)
        VALUES ($1, $2, $3, $4, $5, $6, false, false, $7)
        RETURNING id, name, description, category, layout, widgets, variables,
                  published, is_system, user_id, thumbnail, created_at, updated_at
        "#,
    )
    .bind(&copy_name)
    .bind(&src_dashboard.description)
    .bind(&src_dashboard.category)
    .bind(&src_dashboard.layout)
    .bind(&src_dashboard.widgets)
    .bind(&src_dashboard.variables)
    .bind(user_id)
    .fetch_one(&state.db)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(error = %e, "duplicate_dashboard insert failed");
            return IoError::Database(e).into_response();
        }
    };

    match row_to_dashboard(&row) {
        Ok(d) => (StatusCode::CREATED, Json(ApiResponse::ok(d))).into_response(),
        Err(e) => {
            tracing::error!(error = %e, "duplicate_dashboard row mapping failed");
            IoError::Internal("Failed to map duplicated dashboard".into()).into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// GET /api/dashboards/playlists — list playlists
// ---------------------------------------------------------------------------

pub async fn list_playlists(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> impl IntoResponse {
    if !check_permission(&claims, "dashboards:read") {
        return IoError::Forbidden("dashboards:read permission required".into()).into_response();
    }

    let rows = match sqlx::query(
        r#"
        SELECT id, name, created_by, created_at, updated_at
        FROM dashboard_playlists
        ORDER BY name ASC
        "#,
    )
    .fetch_all(&state.db)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(error = %e, "list_playlists query failed");
            return IoError::Database(e).into_response();
        }
    };

    let mut playlists: Vec<PlaylistRow> = Vec::with_capacity(rows.len());
    for row in &rows {
        match row_to_playlist(row) {
            Ok(p) => playlists.push(p),
            Err(e) => tracing::warn!(error = %e, "skipping malformed playlist row"),
        }
    }

    Json(ApiResponse::ok(playlists)).into_response()
}

// ---------------------------------------------------------------------------
// GET /api/dashboards/playlists/:id — get playlist with items
// ---------------------------------------------------------------------------

pub async fn get_playlist(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    if !check_permission(&claims, "dashboards:read") {
        return IoError::Forbidden("dashboards:read permission required".into()).into_response();
    }

    let playlist_row = match sqlx::query(
        "SELECT id, name, created_by, created_at, updated_at FROM dashboard_playlists WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(r)) => r,
        Ok(None) => return IoError::NotFound(format!("Playlist {} not found", id)).into_response(),
        Err(e) => {
            tracing::error!(error = %e, "get_playlist query failed");
            return IoError::Database(e).into_response();
        }
    };

    let playlist = match row_to_playlist(&playlist_row) {
        Ok(p) => p,
        Err(e) => {
            tracing::error!(error = %e, "get_playlist row mapping failed");
            return IoError::Internal("Failed to map playlist".into()).into_response();
        }
    };

    let item_rows = match sqlx::query(
        r#"
        SELECT id, playlist_id, dashboard_id, position, dwell_seconds, variable_overrides
        FROM dashboard_playlist_items
        WHERE playlist_id = $1
        ORDER BY position ASC
        "#,
    )
    .bind(id)
    .fetch_all(&state.db)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(error = %e, "get_playlist items query failed");
            return IoError::Database(e).into_response();
        }
    };

    let mut items: Vec<PlaylistItemRow> = Vec::with_capacity(item_rows.len());
    for row in &item_rows {
        match row_to_playlist_item(row) {
            Ok(item) => items.push(item),
            Err(e) => tracing::warn!(error = %e, "skipping malformed playlist item row"),
        }
    }

    Json(ApiResponse::ok(PlaylistDetail { playlist, items })).into_response()
}

// ---------------------------------------------------------------------------
// POST /api/dashboards/playlists — create playlist
// ---------------------------------------------------------------------------

pub async fn create_playlist(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(body): Json<CreatePlaylistRequest>,
) -> impl IntoResponse {
    if !check_permission(&claims, "dashboards:write") {
        return IoError::Forbidden("dashboards:write permission required".into()).into_response();
    }

    if body.name.trim().is_empty() {
        return IoError::BadRequest("name is required".into()).into_response();
    }

    let user_id = user_id_from_claims(&claims);

    let playlist_row = match sqlx::query(
        r#"
        INSERT INTO dashboard_playlists (name, created_by)
        VALUES ($1, $2)
        RETURNING id, name, created_by, created_at, updated_at
        "#,
    )
    .bind(&body.name)
    .bind(user_id)
    .fetch_one(&state.db)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(error = %e, "create_playlist insert failed");
            return IoError::Database(e).into_response();
        }
    };

    let playlist = match row_to_playlist(&playlist_row) {
        Ok(p) => p,
        Err(e) => {
            tracing::error!(error = %e, "create_playlist row mapping failed");
            return IoError::Internal("Failed to map created playlist".into()).into_response();
        }
    };

    let playlist_id = playlist.id;

    // Insert items if provided.
    let mut items: Vec<PlaylistItemRow> = vec![];
    if let Some(req_items) = body.items {
        for item_req in &req_items {
            let item_row = match sqlx::query(
                r#"
                INSERT INTO dashboard_playlist_items
                    (playlist_id, dashboard_id, position, dwell_seconds, variable_overrides)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING id, playlist_id, dashboard_id, position, dwell_seconds, variable_overrides
                "#,
            )
            .bind(playlist_id)
            .bind(item_req.dashboard_id)
            .bind(item_req.position)
            .bind(item_req.dwell_seconds.unwrap_or(30))
            .bind(
                item_req
                    .variable_overrides
                    .clone()
                    .unwrap_or_else(|| JsonValue::Object(serde_json::Map::new())),
            )
            .fetch_one(&state.db)
            .await
            {
                Ok(r) => r,
                Err(e) => {
                    tracing::error!(error = %e, "create_playlist item insert failed");
                    return IoError::Database(e).into_response();
                }
            };

            match row_to_playlist_item(&item_row) {
                Ok(i) => items.push(i),
                Err(e) => tracing::warn!(error = %e, "skipping malformed inserted item row"),
            }
        }
    }

    (
        StatusCode::CREATED,
        Json(ApiResponse::ok(PlaylistDetail { playlist, items })),
    )
        .into_response()
}

// ---------------------------------------------------------------------------
// PUT /api/dashboards/playlists/:id — update playlist
// ---------------------------------------------------------------------------

pub async fn update_playlist(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(body): Json<UpdatePlaylistRequest>,
) -> impl IntoResponse {
    if !check_permission(&claims, "dashboards:write") {
        return IoError::Forbidden("dashboards:write permission required".into()).into_response();
    }

    // Verify the playlist exists.
    let existing = match sqlx::query(
        "SELECT id FROM dashboard_playlists WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(r)) => r,
        Ok(None) => return IoError::NotFound(format!("Playlist {} not found", id)).into_response(),
        Err(e) => {
            tracing::error!(error = %e, "update_playlist fetch failed");
            return IoError::Database(e).into_response();
        }
    };
    let _ = existing; // used only for existence check

    // Update name if provided.
    if let Some(ref new_name) = body.name {
        if let Err(e) = sqlx::query(
            "UPDATE dashboard_playlists SET name = $1, updated_at = NOW() WHERE id = $2",
        )
        .bind(new_name)
        .bind(id)
        .execute(&state.db)
        .await
        {
            tracing::error!(error = %e, "update_playlist name update failed");
            return IoError::Database(e).into_response();
        }
    }

    // If items supplied, replace them wholesale.
    if let Some(ref req_items) = body.items {
        if let Err(e) = sqlx::query(
            "DELETE FROM dashboard_playlist_items WHERE playlist_id = $1",
        )
        .bind(id)
        .execute(&state.db)
        .await
        {
            tracing::error!(error = %e, "update_playlist items delete failed");
            return IoError::Database(e).into_response();
        }

        for item_req in req_items {
            if let Err(e) = sqlx::query(
                r#"
                INSERT INTO dashboard_playlist_items
                    (playlist_id, dashboard_id, position, dwell_seconds, variable_overrides)
                VALUES ($1, $2, $3, $4, $5)
                "#,
            )
            .bind(id)
            .bind(item_req.dashboard_id)
            .bind(item_req.position)
            .bind(item_req.dwell_seconds.unwrap_or(30))
            .bind(
                item_req
                    .variable_overrides
                    .clone()
                    .unwrap_or_else(|| JsonValue::Object(serde_json::Map::new())),
            )
            .execute(&state.db)
            .await
            {
                tracing::error!(error = %e, "update_playlist item insert failed");
                return IoError::Database(e).into_response();
            }
        }
    }

    // Re-fetch and return the updated playlist with items.
    get_playlist(State(state), Extension(claims), Path(id)).await.into_response()
}

// ---------------------------------------------------------------------------
// DELETE /api/dashboards/playlists/:id — delete playlist
// ---------------------------------------------------------------------------

pub async fn delete_playlist(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    if !check_permission(&claims, "dashboards:write") {
        return IoError::Forbidden("dashboards:write permission required".into()).into_response();
    }

    let result = match sqlx::query(
        "DELETE FROM dashboard_playlists WHERE id = $1 RETURNING id",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(error = %e, "delete_playlist query failed");
            return IoError::Database(e).into_response();
        }
    };

    if result.is_none() {
        return IoError::NotFound(format!("Playlist {} not found", id)).into_response();
    }

    (StatusCode::NO_CONTENT, ()).into_response()
}
