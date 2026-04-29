use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json,
};
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::Row;
use uuid::Uuid;

use crate::{db, state::AppState};

#[derive(Debug, Deserialize)]
pub struct CreateJobRequest {
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
    pub created_by: Uuid,
    pub snapshot_workspace_id: Option<Uuid>,
}

fn default_dpr() -> f64 {
    1.0
}
fn default_overlay() -> bool {
    true
}

#[derive(Debug, Serialize)]
pub struct JobResponse {
    pub id: Uuid,
    pub status: String,
    pub frames_total: Option<i32>,
}

/// Returns available bytes on the filesystem containing `path`, or None if the
/// check cannot be performed (path does not exist yet, df not available, etc.).
fn available_bytes(path: &str) -> Option<u64> {
    let output = std::process::Command::new("df")
        .arg("-P") // POSIX format prevents line-wrapping on long filesystem names
        .arg("-B1")
        .arg(path)
        .output()
        .ok()?;
    let stdout = String::from_utf8_lossy(&output.stdout);
    // Header line + one data line; Available is the 4th whitespace-separated field.
    let data_line = stdout.lines().nth(1)?;
    let avail_str = data_line.split_whitespace().nth(3)?;
    avail_str.parse().ok()
}

pub async fn create_job(
    State(state): State<AppState>,
    Json(req): Json<CreateJobRequest>,
) -> impl IntoResponse {
    // Disk space pre-flight: estimate required bytes and reject if insufficient.
    // Formula: frames * w * h * 4 bytes/px * ~15% VP9 ratio, with 1.5× headroom.
    let duration_ms = (req.range_end - req.range_start).num_milliseconds().max(0) as u64;
    let frames = duration_ms / (req.step_ms.max(1) as u64);
    let estimated = (frames * req.width_px as u64 * req.height_px as u64 * 4) as f64 * 0.15;
    let required = (estimated * 1.5) as u64;

    if let Some(free) = available_bytes(&state.config.export_dir) {
        if free < required {
            return (
                StatusCode::INSUFFICIENT_STORAGE,
                Json(serde_json::json!({
                    "error": "Insufficient disk space for this export. Try a shorter range or larger step interval."
                })),
            )
                .into_response();
        }
    }

    let job_id = Uuid::new_v4();
    let frames_total = req.frames_total;

    let params = db::CreateJobParams {
        id: job_id,
        module: req.module,
        graphic_id: req.graphic_id,
        range_start: req.range_start,
        range_end: req.range_end,
        step_ms: req.step_ms,
        fps: req.fps,
        width_px: req.width_px,
        height_px: req.height_px,
        device_pixel_ratio: req.device_pixel_ratio,
        overlay_timestamp: req.overlay_timestamp,
        codec: req.codec.unwrap_or_else(|| "vp9".to_string()),
        container: req.container.unwrap_or_else(|| "webm".to_string()),
        crf: req.crf.unwrap_or(28),
        frames_total,
        original_filename: req.original_filename,
        created_by: req.created_by,
        snapshot_workspace_id: req.snapshot_workspace_id,
    };

    if let Err(e) = db::create_job(&state.db, params).await {
        tracing::error!(error = %e, "Failed to insert video_export_jobs row");
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": "db insert failed" })),
        )
            .into_response();
    }

    metrics::counter!("video_export_jobs_total", "status" => "created").increment(1);
    state.job_queue.enqueue(job_id).await;

    (
        StatusCode::ACCEPTED,
        Json(JobResponse {
            id: job_id,
            status: "queued".to_string(),
            frames_total,
        }),
    )
        .into_response()
}

pub async fn get_job(State(state): State<AppState>, Path(id): Path<Uuid>) -> impl IntoResponse {
    let row = match sqlx::query(
        "SELECT id, status, module, graphic_id, range_start, range_end, step_ms, fps,
                width_px, height_px, frames_total, frames_rendered, error_message,
                created_by, created_at, started_at, completed_at,
                file_path, file_size_bytes, original_filename
         FROM video_export_jobs WHERE id = $1",
    )
    .bind(id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(r)) => r,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({ "error": "job not found" })),
            )
                .into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "get_job query failed");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "db query failed" })),
            )
                .into_response();
        }
    };

    let job = serde_json::json!({
        "id": row.try_get::<Uuid, _>("id").unwrap_or(id),
        "status": row.try_get::<String, _>("status").unwrap_or_default(),
        "module": row.try_get::<String, _>("module").unwrap_or_default(),
        "graphic_id": row.try_get::<Uuid, _>("graphic_id").ok(),
        "range_start": row.try_get::<DateTime<Utc>, _>("range_start").ok(),
        "range_end": row.try_get::<DateTime<Utc>, _>("range_end").ok(),
        "step_ms": row.try_get::<i32, _>("step_ms").ok(),
        "fps": row.try_get::<f64, _>("fps").ok(),
        "width_px": row.try_get::<i32, _>("width_px").ok(),
        "height_px": row.try_get::<i32, _>("height_px").ok(),
        "frames_total": row.try_get::<Option<i32>, _>("frames_total").unwrap_or_default(),
        "frames_rendered": row.try_get::<i32, _>("frames_rendered").unwrap_or(0),
        "error_message": row.try_get::<Option<String>, _>("error_message").unwrap_or_default(),
        "created_by": row.try_get::<Uuid, _>("created_by").ok(),
        "created_at": row.try_get::<DateTime<Utc>, _>("created_at").ok(),
        "started_at": row.try_get::<Option<DateTime<Utc>>, _>("started_at").unwrap_or_default(),
        "completed_at": row.try_get::<Option<DateTime<Utc>>, _>("completed_at").unwrap_or_default(),
        "file_size_bytes": row.try_get::<Option<i64>, _>("file_size_bytes").unwrap_or_default(),
        "original_filename": row.try_get::<Option<String>, _>("original_filename").unwrap_or_default(),
    });

    Json(job).into_response()
}

pub async fn cancel_job(State(state): State<AppState>, Path(id): Path<Uuid>) -> impl IntoResponse {
    let row = match sqlx::query("SELECT id, status FROM video_export_jobs WHERE id = $1")
        .bind(id)
        .fetch_optional(&state.db)
        .await
    {
        Ok(Some(r)) => r,
        Ok(None) => {
            return (
                StatusCode::NOT_FOUND,
                Json(serde_json::json!({ "error": "job not found" })),
            )
                .into_response()
        }
        Err(e) => {
            tracing::error!(error = %e, "cancel_job query failed");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "db query failed" })),
            )
                .into_response();
        }
    };

    let status: String = row.try_get("status").unwrap_or_default();
    if status == "completed" || status == "failed" || status == "cancelled" {
        return (
            StatusCode::CONFLICT,
            Json(serde_json::json!({ "error": format!("job is already {status}") })),
        )
            .into_response();
    }

    state.job_queue.cancel(id);
    db::set_cancelled(&state.db, id).await.ok();

    Json(serde_json::json!({ "id": id, "status": "cancelled" })).into_response()
}
