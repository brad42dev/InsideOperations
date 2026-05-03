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
use sqlx::Row;
use uuid::Uuid;

use crate::state::AppState;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, PartialEq)]
#[sqlx(type_name = "video_stream_visibility", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum VideoStreamVisibility {
    Public,
    Managed,
    Private,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type, PartialEq)]
#[sqlx(type_name = "video_stream_connection_mode", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum VideoStreamConnectionMode {
    Direct,
    Relay,
    Auto,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "video_stream_acl_entity_type", rename_all = "lowercase")]
#[serde(rename_all = "lowercase")]
pub enum VideoStreamAclEntityType {
    Role,
    User,
}

#[derive(Debug, Clone, Serialize)]
pub struct VideoStreamRow {
    pub id: Uuid,
    pub name: String,
    pub description: Option<String>,
    pub visibility: VideoStreamVisibility,
    pub connection_mode: VideoStreamConnectionMode,
    pub direct_url: Option<String>,
    pub relay_config: Option<serde_json::Value>,
    pub onvif_config: Option<serde_json::Value>,
    pub created_by: Option<Uuid>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

fn map_stream_row(r: &sqlx::postgres::PgRow) -> Result<VideoStreamRow, sqlx::Error> {
    Ok(VideoStreamRow {
        id: r.try_get("id")?,
        name: r.try_get("name")?,
        description: r.try_get("description")?,
        visibility: r.try_get("visibility")?,
        connection_mode: r.try_get("connection_mode")?,
        direct_url: r.try_get("direct_url")?,
        relay_config: r.try_get("relay_config")?,
        onvif_config: r.try_get("onvif_config")?,
        created_by: r.try_get("created_by")?,
        created_at: r.try_get("created_at")?,
        updated_at: r.try_get("updated_at")?,
    })
}

#[derive(Debug, Deserialize)]
pub struct CreateVideoStreamRequest {
    pub name: String,
    pub description: Option<String>,
    pub visibility: VideoStreamVisibility,
    pub connection_mode: VideoStreamConnectionMode,
    pub direct_url: Option<String>,
    pub relay_config: Option<serde_json::Value>,
    pub onvif_config: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct UpdateVideoStreamRequest {
    pub name: Option<String>,
    pub description: Option<String>,
    pub visibility: Option<VideoStreamVisibility>,
    pub connection_mode: Option<VideoStreamConnectionMode>,
    pub direct_url: Option<String>,
    pub relay_config: Option<serde_json::Value>,
    pub onvif_config: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
pub struct AddAccessRequest {
    pub entity_type: VideoStreamAclEntityType,
    pub entity_id: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct VideoStreamAccessRow {
    pub stream_id: Uuid,
    pub entity_type: VideoStreamAclEntityType,
    pub entity_id: String,
}

#[derive(Debug, Serialize)]
pub struct VideoStreamTokenResponse {
    pub direct_url: Option<String>,
    pub relay_url: Option<String>,
    pub token: String,
    pub expires_at: DateTime<Utc>,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn require_manage(claims: &Claims) -> bool {
    claims
        .permissions
        .iter()
        .any(|p| p == "*" || p == "video_streams:manage")
}

async fn fetch_user_roles(db: &sqlx::PgPool, user_id: Uuid) -> Vec<String> {
    sqlx::query_scalar(
        "SELECT r.name FROM roles r
         JOIN user_roles ur ON ur.role_id = r.id
         WHERE ur.user_id = $1 AND r.deleted_at IS NULL",
    )
    .bind(user_id)
    .fetch_all(db)
    .await
    .unwrap_or_default()
}

async fn user_can_view_stream(
    db: &sqlx::PgPool,
    user_id: Uuid,
    user_roles: &[String],
    stream: &VideoStreamRow,
    user_perms: &[String],
) -> bool {
    if user_perms
        .iter()
        .any(|p| p == "*" || p == "video_streams:manage")
    {
        return true;
    }
    match stream.visibility {
        // Public: any authenticated user can view — no permission check required.
        VideoStreamVisibility::Public => true,
        // Managed: user must hold the view permission.
        VideoStreamVisibility::Managed => user_perms.iter().any(|p| p == "video_streams:view"),
        // Private: user or one of their roles must be in the ACL.
        VideoStreamVisibility::Private => {
            let user_id_str = user_id.to_string();
            sqlx::query(
                "SELECT 1 FROM video_stream_access
                 WHERE stream_id = $1
                 AND ((entity_type = 'user' AND entity_id = $2)
                   OR (entity_type = 'role' AND entity_id = ANY($3)))
                 LIMIT 1",
            )
            .bind(stream.id)
            .bind(&user_id_str)
            .bind(user_roles)
            .fetch_optional(db)
            .await
            .ok()
            .flatten()
            .is_some()
        }
    }
}

/// Register or update a stream in go2rtc via its REST API.
/// Uses the go2rtc v1.x `PUT /api/streams?name=X&src=Y` query-param API.
///
/// To use a remote go2rtc instance instead of the local sidecar, set GO2RTC_URL
/// in the environment — that is the only configuration change required.
async fn go2rtc_register_stream(
    client: &reqwest::Client,
    go2rtc_url: &str,
    stream_name: &str,
    inputs: &[String],
) -> anyhow::Result<()> {
    if inputs.is_empty() {
        return Ok(());
    }
    // go2rtc v1.x: each PUT with ?src= overwrites the stream sources.
    // Send only the first input; to add multiple sources, call PUT for each.
    // Use reqwest's .query() to percent-encode the src value — raw format!()
    // injection would allow a crafted RTSP URL to inject extra query params.
    let base = format!("{}/api/streams", go2rtc_url);
    client
        .put(&base)
        .query(&[("name", stream_name), ("src", inputs[0].as_str())])
        .send()
        .await?;
    Ok(())
}

/// Remove a stream's source from go2rtc.
/// Note: go2rtc v1.x DELETE removes the producer entry but the stream shell
/// may remain in the config. This is acceptable — an empty stream serves no video.
async fn go2rtc_remove_stream(
    client: &reqwest::Client,
    go2rtc_url: &str,
    stream_name: &str,
    src: Option<&str>,
) -> anyhow::Result<()> {
    let base = format!("{}/api/streams", go2rtc_url);
    if let Some(s) = src {
        client
            .delete(&base)
            .query(&[("name", stream_name), ("src", s)])
            .send()
            .await?;
    } else {
        client
            .delete(&base)
            .query(&[("name", stream_name)])
            .send()
            .await?;
    }
    Ok(())
}

fn stream_name_for(stream_id: Uuid) -> String {
    format!("stream_{}", stream_id.to_string().replace('-', ""))
}

fn relay_url_for(stream_id: Uuid) -> String {
    // go2rtc 1.9+ HLS endpoint — consumed by hls.js (or native Safari HLS).
    // go2rtc registers its media endpoints under /api/, so the correct path is
    // /api/stream.m3u8, not /stream.m3u8 (which returns 404 in v1.9+).
    // hls.js fetches playlist then segments at /api/hls/*, all covered by nginx.
    format!(
        "/go2rtc/api/stream.m3u8?src=stream_{}",
        stream_id.to_string().replace('-', "")
    )
}

fn extract_go2rtc_inputs(relay_config: Option<&serde_json::Value>) -> Vec<String> {
    relay_config
        .and_then(|v| v.get("go2rtc_inputs"))
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|s| s.as_str().map(|s| s.to_owned()))
                .collect()
        })
        .unwrap_or_default()
}

/// Returns an error if direct_url uses a scheme other than http/https.
/// RTSP/RTMP cannot be played directly in browsers; relay mode handles those.
fn validate_direct_url(url: &str) -> Result<(), String> {
    let lower = url.to_lowercase();
    if !lower.starts_with("http://") && !lower.starts_with("https://") {
        return Err(format!(
            "direct_url must use http:// or https:// scheme: {url}"
        ));
    }
    Ok(())
}

/// Returns an error message if any input URL uses a disallowed scheme.
/// Permitted schemes: rtsp, rtsps, rtmp, rtmps.
fn validate_go2rtc_inputs(inputs: &[String]) -> Result<(), String> {
    for url in inputs {
        let lower = url.to_lowercase();
        if !lower.starts_with("rtsp://")
            && !lower.starts_with("rtsps://")
            && !lower.starts_with("rtmp://")
            && !lower.starts_with("rtmps://")
        {
            return Err(format!(
                "go2rtc_inputs contains disallowed URL scheme: {}",
                url
            ));
        }
    }
    Ok(())
}

// ---------------------------------------------------------------------------
// GET /api/video-streams
// ---------------------------------------------------------------------------

pub async fn list_streams(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> impl IntoResponse {
    let user_id = match Uuid::parse_str(&claims.sub) {
        Ok(id) => id,
        Err(_) => return IoError::Unauthorized.into_response(),
    };

    let rows = match sqlx::query(
        "SELECT id, name, description, visibility, connection_mode,
                direct_url, relay_config, onvif_config, created_by, created_at, updated_at
         FROM video_streams
         ORDER BY created_at DESC",
    )
    .fetch_all(&state.db)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(error = %e, "list_streams query failed");
            return IoError::Database(e).into_response();
        }
    };

    let user_roles = fetch_user_roles(&state.db, user_id).await;

    let mut streams = Vec::new();
    for r in &rows {
        match map_stream_row(r) {
            Ok(stream) => {
                if user_can_view_stream(
                    &state.db,
                    user_id,
                    &user_roles,
                    &stream,
                    &claims.permissions,
                )
                .await
                {
                    streams.push(stream);
                }
            }
            Err(e) => tracing::warn!(error = %e, "skipping malformed video_streams row"),
        }
    }

    Json(ApiResponse::ok(streams)).into_response()
}

// ---------------------------------------------------------------------------
// GET /api/video-streams/:id
// ---------------------------------------------------------------------------

pub async fn get_stream(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let user_id = match Uuid::parse_str(&claims.sub) {
        Ok(id) => id,
        Err(_) => return IoError::Unauthorized.into_response(),
    };

    let row = match sqlx::query(
        "SELECT id, name, description, visibility, connection_mode,
                direct_url, relay_config, onvif_config, created_by, created_at, updated_at
         FROM video_streams WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(r)) => r,
        Ok(None) => {
            return IoError::NotFound(format!("Video stream {id} not found")).into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "get_stream query failed");
            return IoError::Database(e).into_response();
        }
    };

    let stream = match map_stream_row(&row) {
        Ok(s) => s,
        Err(e) => return IoError::Database(e).into_response(),
    };

    let user_roles = fetch_user_roles(&state.db, user_id).await;
    if !user_can_view_stream(
        &state.db,
        user_id,
        &user_roles,
        &stream,
        &claims.permissions,
    )
    .await
    {
        return IoError::Forbidden("Access denied to this video stream".into()).into_response();
    }

    Json(ApiResponse::ok(stream)).into_response()
}

// ---------------------------------------------------------------------------
// POST /api/video-streams
// ---------------------------------------------------------------------------

pub async fn create_stream(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(req): Json<CreateVideoStreamRequest>,
) -> impl IntoResponse {
    if !require_manage(&claims) {
        return IoError::Forbidden("video_streams:manage permission required".into())
            .into_response();
    }

    let user_id = match Uuid::parse_str(&claims.sub) {
        Ok(id) => id,
        Err(_) => return IoError::Unauthorized.into_response(),
    };

    let stream_id = Uuid::new_v4();
    let stream_name = stream_name_for(stream_id);

    // Merge stream_name into relay_config for later use by the token endpoint.
    let relay_config = if req.connection_mode != VideoStreamConnectionMode::Direct {
        let mut cfg = req
            .relay_config
            .clone()
            .unwrap_or_else(|| serde_json::json!({}));
        if let Some(obj) = cfg.as_object_mut() {
            obj.insert(
                "stream_name".to_owned(),
                serde_json::Value::String(stream_name.clone()),
            );
        }
        Some(cfg)
    } else {
        req.relay_config.clone()
    };

    // Validate direct_url scheme before writing to DB.
    if let Some(ref u) = req.direct_url {
        if let Err(msg) = validate_direct_url(u) {
            return IoError::BadRequest(msg).into_response();
        }
    }

    // Validate go2rtc_inputs scheme before writing to DB.
    let inputs_for_validation = extract_go2rtc_inputs(relay_config.as_ref());
    if let Err(msg) = validate_go2rtc_inputs(&inputs_for_validation) {
        return IoError::BadRequest(msg).into_response();
    }

    let row = match sqlx::query(
        "INSERT INTO video_streams
             (id, name, description, visibility, connection_mode,
              direct_url, relay_config, onvif_config, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, name, description, visibility, connection_mode,
                   direct_url, relay_config, onvif_config, created_by, created_at, updated_at",
    )
    .bind(stream_id)
    .bind(&req.name)
    .bind(&req.description)
    .bind(&req.visibility)
    .bind(&req.connection_mode)
    .bind(&req.direct_url)
    .bind(&relay_config)
    .bind(&req.onvif_config)
    .bind(user_id)
    .fetch_one(&state.db)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(error = %e, "create_stream insert failed");
            return IoError::Database(e).into_response();
        }
    };

    let stream = match map_stream_row(&row) {
        Ok(s) => s,
        Err(e) => return IoError::Database(e).into_response(),
    };

    // Register with go2rtc if relay mode.
    if req.connection_mode != VideoStreamConnectionMode::Direct {
        let inputs = extract_go2rtc_inputs(relay_config.as_ref());
        if !inputs.is_empty() {
            if let Err(e) = go2rtc_register_stream(
                &state.http_client,
                &state.config.go2rtc_url,
                &stream_name,
                &inputs,
            )
            .await
            {
                tracing::warn!(error = %e, %stream_name, "go2rtc registration failed (non-fatal)");
            }
        }
    }

    (
        axum::http::StatusCode::CREATED,
        Json(ApiResponse::ok(stream)),
    )
        .into_response()
}

// ---------------------------------------------------------------------------
// PUT /api/video-streams/:id
// ---------------------------------------------------------------------------

pub async fn update_stream(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(req): Json<UpdateVideoStreamRequest>,
) -> impl IntoResponse {
    if !require_manage(&claims) {
        return IoError::Forbidden("video_streams:manage permission required".into())
            .into_response();
    }

    // Fetch existing stream to compare connection_mode / relay_config.
    let existing_row = match sqlx::query(
        "SELECT id, name, description, visibility, connection_mode,
                direct_url, relay_config, onvif_config, created_by, created_at, updated_at
         FROM video_streams WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(r)) => r,
        Ok(None) => {
            return IoError::NotFound(format!("Video stream {id} not found")).into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "update_stream fetch failed");
            return IoError::Database(e).into_response();
        }
    };

    let existing = match map_stream_row(&existing_row) {
        Ok(s) => s,
        Err(e) => return IoError::Database(e).into_response(),
    };

    // Determine effective connection_mode after update.
    let new_mode = req
        .connection_mode
        .as_ref()
        .unwrap_or(&existing.connection_mode);

    // If relay_config is being updated, preserve the stream_name we stored at create time.
    let new_relay_config = if let Some(mut cfg) = req.relay_config.clone() {
        if *new_mode != VideoStreamConnectionMode::Direct {
            let stream_name = stream_name_for(id);
            if let Some(obj) = cfg.as_object_mut() {
                obj.entry("stream_name".to_owned())
                    .or_insert_with(|| serde_json::Value::String(stream_name));
            }
        }
        Some(cfg)
    } else {
        None // NULL in COALESCE → keep existing
    };

    // Validate direct_url scheme before writing to DB.
    if let Some(ref u) = req.direct_url {
        if let Err(msg) = validate_direct_url(u) {
            return IoError::BadRequest(msg).into_response();
        }
    }

    // Validate go2rtc_inputs scheme before writing to DB.
    if let Some(ref cfg) = new_relay_config {
        let inputs = extract_go2rtc_inputs(Some(cfg));
        if let Err(msg) = validate_go2rtc_inputs(&inputs) {
            return IoError::BadRequest(msg).into_response();
        }
    }

    let row = match sqlx::query(
        "UPDATE video_streams SET
           name            = COALESCE($1, name),
           description     = CASE WHEN $2::boolean THEN $3 ELSE description END,
           visibility      = COALESCE($4, visibility),
           connection_mode = COALESCE($5, connection_mode),
           direct_url      = CASE WHEN $6::boolean THEN $7 ELSE direct_url END,
           relay_config    = CASE WHEN $8::boolean THEN $9 ELSE relay_config END,
           onvif_config    = CASE WHEN $10::boolean THEN $11 ELSE onvif_config END
         WHERE id = $12
         RETURNING id, name, description, visibility, connection_mode,
                   direct_url, relay_config, onvif_config, created_by, created_at, updated_at",
    )
    .bind(req.name.as_deref())
    .bind(req.description.is_some())
    .bind(req.description.as_deref())
    .bind(req.visibility.as_ref())
    .bind(req.connection_mode.as_ref())
    .bind(req.direct_url.is_some() || req.connection_mode.is_some())
    .bind(req.direct_url.as_deref())
    .bind(new_relay_config.is_some())
    .bind(new_relay_config.as_ref())
    .bind(req.onvif_config.is_some())
    .bind(req.onvif_config.as_ref())
    .bind(id)
    .fetch_one(&state.db)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(error = %e, "update_stream update failed");
            return IoError::Database(e).into_response();
        }
    };

    let updated = match map_stream_row(&row) {
        Ok(s) => s,
        Err(e) => return IoError::Database(e).into_response(),
    };

    // Sync go2rtc if relay config changed.
    let relay_changed = req.relay_config.is_some() || req.connection_mode.is_some();
    if relay_changed && *new_mode != VideoStreamConnectionMode::Direct {
        let stream_name = stream_name_for(id);
        let inputs = extract_go2rtc_inputs(updated.relay_config.as_ref());
        if !inputs.is_empty() {
            if let Err(e) = go2rtc_register_stream(
                &state.http_client,
                &state.config.go2rtc_url,
                &stream_name,
                &inputs,
            )
            .await
            {
                tracing::warn!(error = %e, %stream_name, "go2rtc update failed (non-fatal)");
            }
        }
    } else if relay_changed && *new_mode == VideoStreamConnectionMode::Direct {
        // Switched to direct-only: remove from go2rtc.
        let stream_name = stream_name_for(id);
        let old_src = existing
            .relay_config
            .as_ref()
            .and_then(|v| v.get("go2rtc_inputs"))
            .and_then(|v| v.as_array())
            .and_then(|a| a.first())
            .and_then(|s| s.as_str())
            .map(|s| s.to_owned());
        if let Err(e) = go2rtc_remove_stream(
            &state.http_client,
            &state.config.go2rtc_url,
            &stream_name,
            old_src.as_deref(),
        )
        .await
        {
            tracing::warn!(error = %e, %stream_name, "go2rtc remove failed (non-fatal)");
        }
    }

    // Suppress unused binding warning (existing is only used to determine defaults).
    let _ = existing;

    Json(ApiResponse::ok(updated)).into_response()
}

// ---------------------------------------------------------------------------
// DELETE /api/video-streams/:id
// ---------------------------------------------------------------------------

pub async fn delete_stream(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    if !require_manage(&claims) {
        return IoError::Forbidden("video_streams:manage permission required".into())
            .into_response();
    }

    // Fetch the stream to get relay config before deletion.
    let row =
        match sqlx::query("SELECT connection_mode, relay_config FROM video_streams WHERE id = $1")
            .bind(id)
            .fetch_optional(&state.db)
            .await
        {
            Ok(Some(r)) => r,
            Ok(None) => {
                return IoError::NotFound(format!("Video stream {id} not found")).into_response()
            }
            Err(e) => {
                tracing::error!(error = %e, "delete_stream fetch failed");
                return IoError::Database(e).into_response();
            }
        };

    let connection_mode: VideoStreamConnectionMode = match row.try_get("connection_mode") {
        Ok(v) => v,
        Err(e) => {
            tracing::error!(error = %e, "delete_stream: failed to decode connection_mode");
            return IoError::Database(e).into_response();
        }
    };
    let relay_config: Option<serde_json::Value> = match row.try_get("relay_config") {
        Ok(v) => v,
        Err(e) => {
            tracing::warn!(error = %e, "delete_stream: relay_config decode failed, skipping go2rtc cleanup");
            None
        }
    };

    // Remove from DB (cascades to video_stream_access).
    match sqlx::query("DELETE FROM video_streams WHERE id = $1")
        .bind(id)
        .execute(&state.db)
        .await
    {
        Ok(_) => {}
        Err(e) => {
            tracing::error!(error = %e, "delete_stream delete failed");
            return IoError::Database(e).into_response();
        }
    }

    // Remove from go2rtc after successful DB delete.
    if connection_mode != VideoStreamConnectionMode::Direct {
        let stream_name = relay_config
            .as_ref()
            .and_then(|v| v.get("stream_name"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_owned())
            .unwrap_or_else(|| stream_name_for(id));

        let src = relay_config
            .as_ref()
            .and_then(|v| v.get("go2rtc_inputs"))
            .and_then(|v| v.as_array())
            .and_then(|a| a.first())
            .and_then(|s| s.as_str())
            .map(|s| s.to_owned());

        if let Err(e) = go2rtc_remove_stream(
            &state.http_client,
            &state.config.go2rtc_url,
            &stream_name,
            src.as_deref(),
        )
        .await
        {
            tracing::warn!(error = %e, %stream_name, "go2rtc remove failed (non-fatal)");
        }
    }

    Json(ApiResponse::ok(serde_json::json!({ "id": id }))).into_response()
}

// ---------------------------------------------------------------------------
// GET /api/video-streams/:id/token
// ACL is enforced here — this is the only gate that matters.
// ---------------------------------------------------------------------------

pub async fn get_stream_token(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let user_id = match Uuid::parse_str(&claims.sub) {
        Ok(uid) => uid,
        Err(_) => return IoError::Unauthorized.into_response(),
    };

    let row = match sqlx::query(
        "SELECT id, name, description, visibility, connection_mode,
                direct_url, relay_config, onvif_config, created_by, created_at, updated_at
         FROM video_streams WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(r)) => r,
        Ok(None) => {
            return IoError::NotFound(format!("Video stream {id} not found")).into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "get_stream_token query failed");
            return IoError::Database(e).into_response();
        }
    };

    let stream = match map_stream_row(&row) {
        Ok(s) => s,
        Err(e) => return IoError::Database(e).into_response(),
    };

    let user_roles = fetch_user_roles(&state.db, user_id).await;
    if !user_can_view_stream(
        &state.db,
        user_id,
        &user_roles,
        &stream,
        &claims.permissions,
    )
    .await
    {
        return IoError::Forbidden("Access denied to this video stream".into()).into_response();
    }

    let expires_at = Utc::now() + chrono::Duration::minutes(30);
    let token = Uuid::new_v4().to_string();

    let direct_url = match stream.connection_mode {
        VideoStreamConnectionMode::Relay => None,
        _ => stream.direct_url.clone(),
    };

    let relay_url = match stream.connection_mode {
        VideoStreamConnectionMode::Direct => None,
        _ => Some(relay_url_for(stream.id)),
    };

    Json(ApiResponse::ok(VideoStreamTokenResponse {
        direct_url,
        relay_url,
        token,
        expires_at,
    }))
    .into_response()
}

// ---------------------------------------------------------------------------
// GET /api/video-streams/:id/access
// ---------------------------------------------------------------------------

pub async fn list_access(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    if !require_manage(&claims) {
        return IoError::Forbidden("video_streams:manage permission required".into())
            .into_response();
    }

    // Confirm stream exists.
    match sqlx::query("SELECT 1 FROM video_streams WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await
    {
        Ok(None) => {
            return IoError::NotFound(format!("Video stream {id} not found")).into_response()
        }
        Err(e) => return IoError::Database(e).into_response(),
        _ => {}
    }

    let rows = match sqlx::query(
        "SELECT stream_id, entity_type, entity_id FROM video_stream_access WHERE stream_id = $1",
    )
    .bind(id)
    .fetch_all(&state.db)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(error = %e, "list_access query failed");
            return IoError::Database(e).into_response();
        }
    };

    let items: Vec<VideoStreamAccessRow> = rows
        .iter()
        .filter_map(|r| {
            Some(VideoStreamAccessRow {
                stream_id: r.try_get("stream_id").ok()?,
                entity_type: r.try_get("entity_type").ok()?,
                entity_id: r.try_get("entity_id").ok()?,
            })
        })
        .collect();

    Json(ApiResponse::ok(items)).into_response()
}

// ---------------------------------------------------------------------------
// POST /api/video-streams/:id/access
// ---------------------------------------------------------------------------

pub async fn add_access(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
    Json(req): Json<AddAccessRequest>,
) -> impl IntoResponse {
    if !require_manage(&claims) {
        return IoError::Forbidden("video_streams:manage permission required".into())
            .into_response();
    }

    let granted_by = match Uuid::parse_str(&claims.sub) {
        Ok(uid) => uid,
        Err(_) => return IoError::Unauthorized.into_response(),
    };

    // Confirm stream exists.
    match sqlx::query("SELECT 1 FROM video_streams WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await
    {
        Ok(None) => {
            return IoError::NotFound(format!("Video stream {id} not found")).into_response()
        }
        Err(e) => return IoError::Database(e).into_response(),
        _ => {}
    }

    match sqlx::query(
        "INSERT INTO video_stream_access (stream_id, entity_type, entity_id, granted_by)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT DO NOTHING",
    )
    .bind(id)
    .bind(&req.entity_type)
    .bind(&req.entity_id)
    .bind(granted_by)
    .execute(&state.db)
    .await
    {
        Ok(_) => {}
        Err(e) => {
            tracing::error!(error = %e, "add_access insert failed");
            return IoError::Database(e).into_response();
        }
    }

    Json(ApiResponse::ok(serde_json::json!({
        "stream_id": id,
        "entity_type": req.entity_type,
        "entity_id": req.entity_id,
    })))
    .into_response()
}

// ---------------------------------------------------------------------------
// DELETE /api/video-streams/:id/access/:entity_type/:entity_id
// ---------------------------------------------------------------------------

pub async fn remove_access(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path((id, entity_type, entity_id)): Path<(Uuid, String, String)>,
) -> impl IntoResponse {
    if !require_manage(&claims) {
        return IoError::Forbidden("video_streams:manage permission required".into())
            .into_response();
    }

    match sqlx::query(
        "DELETE FROM video_stream_access
         WHERE stream_id = $1 AND entity_type::text = $2 AND entity_id = $3",
    )
    .bind(id)
    .bind(&entity_type)
    .bind(&entity_id)
    .execute(&state.db)
    .await
    {
        Ok(_) => {}
        Err(e) => {
            tracing::error!(error = %e, "remove_access delete failed");
            return IoError::Database(e).into_response();
        }
    }

    Json(ApiResponse::ok(serde_json::json!({ "removed": true }))).into_response()
}
