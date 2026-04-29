use axum::{
    body::Body,
    extract::{Path, State},
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    Extension, Json,
};
use chrono::{DateTime, Utc};
use io_auth::Claims;
use io_error::IoError;
use io_models::ApiResponse;
use serde::{Deserialize, Serialize};
use sqlx::Row;
use tokio::fs::File;
use tokio_util::io::ReaderStream;
use uuid::Uuid;

use crate::state::AppState;

// ---------------------------------------------------------------------------
// Request / Response types
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct CreateVideoExportRequest {
    pub module: String,
    pub graphic_id: Uuid,
    pub range_start: DateTime<Utc>,
    pub range_end: DateTime<Utc>,
    pub step_ms: i32,
    pub fps: f64,
    pub width_px: i32,
    pub height_px: i32,
    #[serde(default = "default_dpr")]
    pub device_pixel_ratio: f64,
    #[serde(default = "default_overlay")]
    pub overlay_timestamp: bool,
    pub codec: Option<String>,
    pub container: Option<String>,
    pub crf: Option<i16>,
    pub frames_total: Option<i32>,
    pub original_filename: Option<String>,
    pub snapshot_workspace_id: Option<Uuid>,
}

fn default_dpr() -> f64 {
    1.0
}
fn default_overlay() -> bool {
    true
}

#[derive(Debug, Serialize)]
pub struct VideoExportJobRow {
    pub id: Uuid,
    pub status: String,
    pub module: String,
    pub graphic_id: Uuid,
    pub range_start: DateTime<Utc>,
    pub range_end: DateTime<Utc>,
    pub step_ms: i32,
    pub fps: f64,
    pub width_px: i32,
    pub height_px: i32,
    pub frames_total: Option<i32>,
    pub frames_rendered: i32,
    pub error_message: Option<String>,
    pub created_by: Uuid,
    pub created_at: DateTime<Utc>,
    pub started_at: Option<DateTime<Utc>>,
    pub completed_at: Option<DateTime<Utc>>,
    pub file_size_bytes: Option<i64>,
    pub original_filename: Option<String>,
}

fn map_job_row(r: &sqlx::postgres::PgRow) -> Result<VideoExportJobRow, sqlx::Error> {
    Ok(VideoExportJobRow {
        id: r.try_get("id")?,
        status: r.try_get("status")?,
        module: r.try_get("module")?,
        graphic_id: r.try_get("graphic_id")?,
        range_start: r.try_get("range_start")?,
        range_end: r.try_get("range_end")?,
        step_ms: r.try_get("step_ms")?,
        fps: r.try_get("fps")?,
        width_px: r.try_get("width_px")?,
        height_px: r.try_get("height_px")?,
        frames_total: r.try_get("frames_total")?,
        frames_rendered: r.try_get("frames_rendered")?,
        error_message: r.try_get("error_message")?,
        created_by: r.try_get("created_by")?,
        created_at: r.try_get("created_at")?,
        started_at: r.try_get("started_at")?,
        completed_at: r.try_get("completed_at")?,
        file_size_bytes: r.try_get("file_size_bytes")?,
        original_filename: r.try_get("original_filename")?,
    })
}

// ---------------------------------------------------------------------------
// POST /api/video-exports — submit a new video export job
// ---------------------------------------------------------------------------

pub async fn create_export(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Json(req): Json<CreateVideoExportRequest>,
) -> Response {
    let user_id = match Uuid::parse_str(&claims.sub) {
        Ok(id) => id,
        Err(_) => return IoError::Unauthorized.into_response(),
    };

    // RBAC: require <module>:video_export permission
    let required_perm = format!("{}:video_export", req.module);
    if !claims
        .permissions
        .iter()
        .any(|p| p == "*" || p == &required_perm)
    {
        return IoError::Forbidden(format!("{required_perm} permission required")).into_response();
    }

    // Reject if user already has a queued or processing job
    match sqlx::query(
        "SELECT id FROM video_export_jobs
         WHERE created_by = $1 AND status IN ('queued','processing')
         LIMIT 1",
    )
    .bind(user_id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(_)) => {
            return IoError::Conflict(
                "A video export is already in progress. Wait for it to finish or cancel it.".into(),
            )
            .into_response()
        }
        Ok(None) => {}
        Err(e) => {
            tracing::error!(error = %e, "in-flight check query failed");
            return IoError::Database(e).into_response();
        }
    }

    // Validate params
    let duration_ms = (req.range_end - req.range_start).num_milliseconds();
    if duration_ms <= 0 {
        return IoError::BadRequest("range_end must be after range_start".into()).into_response();
    }
    if duration_ms > 3600 * 1000 {
        return IoError::BadRequest("range duration must not exceed 1 hour".into()).into_response();
    }
    if !(100..=60_000).contains(&req.step_ms) {
        return IoError::BadRequest("step_ms must be between 100 and 60000".into()).into_response();
    }
    if req.fps <= 0.0 || req.fps > 60.0 {
        return IoError::BadRequest("fps must be between 0 (exclusive) and 60".into())
            .into_response();
    }
    if req.width_px as i64 * req.height_px as i64 > 3840 * 2160 {
        return IoError::BadRequest("width_px * height_px must not exceed 3840×2160".into())
            .into_response();
    }
    let max_frames = duration_ms / req.step_ms as i64;
    if max_frames > 3_600 {
        return IoError::BadRequest(format!(
            "Too many frames ({max_frames}). Reduce the range or increase step_ms."
        ))
        .into_response();
    }

    // Capture fields for audit log before String values are consumed by json!
    let audit_module = req.module.clone();
    let audit_graphic_id = req.graphic_id;
    let audit_range_start = req.range_start;
    let audit_range_end = req.range_end;
    let audit_step_ms = req.step_ms;
    let audit_fps = req.fps;
    let audit_resolution = format!("{}x{}", req.width_px, req.height_px);

    // Forward to video-export-service
    let internal_url = format!("{}/internal/jobs", state.config.video_export_service_url);
    let body = serde_json::json!({
        "module": req.module,
        "graphic_id": req.graphic_id,
        "range_start": req.range_start,
        "range_end": req.range_end,
        "step_ms": req.step_ms,
        "fps": req.fps,
        "width_px": req.width_px,
        "height_px": req.height_px,
        "device_pixel_ratio": req.device_pixel_ratio,
        "overlay_timestamp": req.overlay_timestamp,
        "codec": req.codec,
        "container": req.container,
        "crf": req.crf,
        "frames_total": req.frames_total,
        "original_filename": req.original_filename,
        "snapshot_workspace_id": req.snapshot_workspace_id,
        "created_by": user_id,
    });

    let resp = match state
        .http_client
        .post(&internal_url)
        .json(&body)
        .send()
        .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(error = %e, "Failed to reach video-export-service");
            return IoError::Internal("video-export-service unavailable".into()).into_response();
        }
    };

    let status = resp.status();
    match resp.json::<serde_json::Value>().await {
        Ok(json) => {
            let http_status =
                StatusCode::from_u16(status.as_u16()).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR);

            // Write audit log for successful job submissions (fire-and-forget)
            if status.as_u16() == 202 {
                if let Some(job_id) = json
                    .get("id")
                    .and_then(|v| v.as_str())
                    .and_then(|s| Uuid::parse_str(s).ok())
                {
                    let meta = serde_json::json!({
                        "module": audit_module,
                        "graphic_id": audit_graphic_id,
                        "range_start": audit_range_start,
                        "range_end": audit_range_end,
                        "step_ms": audit_step_ms,
                        "fps": audit_fps,
                        "resolution": audit_resolution,
                    });
                    let db = state.db.clone();
                    tokio::spawn(async move {
                        let _ = sqlx::query(
                            "INSERT INTO audit_log \
                             (id, table_name, action, record_id, user_id, changes) \
                             VALUES ($1, $2, $3, $4, $5, $6)",
                        )
                        .bind(Uuid::new_v4())
                        .bind("video_export_jobs")
                        .bind("video_export.create")
                        .bind(job_id)
                        .bind(user_id)
                        .bind(meta)
                        .execute(&db)
                        .await;
                    });
                }
            }

            (http_status, Json(ApiResponse::ok(json))).into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "Failed to decode video-export-service response");
            IoError::Internal("invalid response from video-export-service".into()).into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// GET /api/video-exports — list own video export jobs
// ---------------------------------------------------------------------------

pub async fn list_exports(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
) -> impl IntoResponse {
    let user_id = match Uuid::parse_str(&claims.sub) {
        Ok(id) => id,
        Err(_) => return IoError::Unauthorized.into_response(),
    };

    let rows = match sqlx::query(
        "SELECT id, status, module, graphic_id, range_start, range_end, step_ms, fps,
                width_px, height_px, frames_total, frames_rendered, error_message,
                created_by, created_at, started_at, completed_at,
                file_size_bytes, original_filename
         FROM video_export_jobs
         WHERE created_by = $1
         ORDER BY created_at DESC
         LIMIT 50",
    )
    .bind(user_id)
    .fetch_all(&state.db)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(error = %e, "list video exports query failed");
            return IoError::Database(e).into_response();
        }
    };

    let items: Vec<VideoExportJobRow> = rows
        .iter()
        .filter_map(|r| match map_job_row(r) {
            Ok(job) => Some(job),
            Err(e) => {
                tracing::warn!(error = %e, "skipping malformed video_export_jobs row");
                None
            }
        })
        .collect();

    Json(ApiResponse::ok(items)).into_response()
}

// ---------------------------------------------------------------------------
// GET /api/video-exports/:id — get single job
// ---------------------------------------------------------------------------

pub async fn get_export(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let user_id = match Uuid::parse_str(&claims.sub) {
        Ok(id) => id,
        Err(_) => return IoError::Unauthorized.into_response(),
    };

    let row = match sqlx::query(
        "SELECT id, status, module, graphic_id, range_start, range_end, step_ms, fps,
                width_px, height_px, frames_total, frames_rendered, error_message,
                created_by, created_at, started_at, completed_at,
                file_size_bytes, original_filename
         FROM video_export_jobs
         WHERE id = $1 AND created_by = $2",
    )
    .bind(id)
    .bind(user_id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(r)) => r,
        Ok(None) => {
            return IoError::NotFound(format!("Video export job {id} not found")).into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "get_export query failed");
            return IoError::Database(e).into_response();
        }
    };

    match map_job_row(&row) {
        Ok(job) => Json(ApiResponse::ok(job)).into_response(),
        Err(e) => IoError::Database(e).into_response(),
    }
}

// ---------------------------------------------------------------------------
// DELETE /api/video-exports/:id — cancel a job
// ---------------------------------------------------------------------------

pub async fn cancel_export(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    let user_id = match Uuid::parse_str(&claims.sub) {
        Ok(id) => id,
        Err(_) => return IoError::Unauthorized.into_response(),
    };

    // Verify ownership
    match sqlx::query("SELECT id FROM video_export_jobs WHERE id = $1 AND created_by = $2")
        .bind(id)
        .bind(user_id)
        .fetch_optional(&state.db)
        .await
    {
        Ok(Some(_)) => {}
        Ok(None) => {
            return IoError::NotFound(format!("Video export job {id} not found")).into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "cancel_export ownership check failed");
            return IoError::Database(e).into_response();
        }
    }

    // Forward cancel to video-export-service
    let internal_url = format!(
        "{}/internal/jobs/{id}",
        state.config.video_export_service_url
    );
    match state.http_client.delete(&internal_url).send().await {
        Ok(_) => {}
        Err(e) => {
            tracing::warn!(error = %e, %id, "Failed to forward cancel to video-export-service");
        }
    }

    Json(ApiResponse::ok(
        serde_json::json!({ "id": id, "status": "cancelled" }),
    ))
    .into_response()
}

// ---------------------------------------------------------------------------
// GET /api/video-exports/:id/download — stream the video file
// ---------------------------------------------------------------------------

pub async fn download_export(
    State(state): State<AppState>,
    Extension(claims): Extension<Claims>,
    Path(id): Path<Uuid>,
) -> Response {
    let user_id = match Uuid::parse_str(&claims.sub) {
        Ok(id) => id,
        Err(_) => return IoError::Unauthorized.into_response(),
    };

    let row = match sqlx::query(
        "SELECT file_path, original_filename, file_size_bytes, status, created_by
         FROM video_export_jobs
         WHERE id = $1 AND created_by = $2",
    )
    .bind(id)
    .bind(user_id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(r)) => r,
        Ok(None) => {
            return IoError::NotFound(format!("Video export job {id} not found")).into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "download_export query failed");
            return IoError::Database(e).into_response();
        }
    };

    let status: String = row.try_get("status").unwrap_or_default();
    if status != "completed" {
        return IoError::BadRequest(format!(
            "Export is not ready (status: {status}). Poll GET /api/video-exports/{id} first."
        ))
        .into_response();
    }

    let file_path: Option<String> = row.try_get("file_path").unwrap_or_default();
    let file_path = match file_path {
        Some(p) if !p.is_empty() => p,
        _ => return IoError::Internal("Export file has no path".into()).into_response(),
    };

    let original_filename: Option<String> = row.try_get("original_filename").unwrap_or_default();
    let download_name = original_filename.unwrap_or_else(|| format!("video-export-{id}.webm"));

    let file_size_bytes: Option<i64> = row.try_get("file_size_bytes").unwrap_or_default();

    let file = match File::open(&file_path).await {
        Ok(f) => f,
        Err(e) => {
            tracing::error!(error = %e, path = %file_path, "Failed to open video export file");
            return IoError::Internal("Export file not found on disk".into()).into_response();
        }
    };

    let stream = ReaderStream::new(file);
    let body = Body::from_stream(stream);

    let mut builder = Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "video/webm")
        .header(
            header::CONTENT_DISPOSITION,
            format!("attachment; filename=\"{download_name}\""),
        );

    if let Some(size) = file_size_bytes {
        builder = builder.header(header::CONTENT_LENGTH, size);
    }

    builder
        .body(body)
        .unwrap_or_else(|_| IoError::Internal("Response build failed".into()).into_response())
}
