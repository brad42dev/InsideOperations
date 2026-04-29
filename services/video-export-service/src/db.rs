use anyhow::Result;
use io_db::DbPool;
use uuid::Uuid;

pub struct CreateJobParams {
    pub id: Uuid,
    pub module: String,
    pub graphic_id: Uuid,
    pub range_start: chrono::DateTime<chrono::Utc>,
    pub range_end: chrono::DateTime<chrono::Utc>,
    pub step_ms: i32,
    pub fps: f64,
    pub width_px: i32,
    pub height_px: i32,
    pub device_pixel_ratio: f64,
    pub overlay_timestamp: bool,
    pub codec: String,
    pub container: String,
    pub crf: i16,
    pub frames_total: Option<i32>,
    pub original_filename: Option<String>,
    pub created_by: Uuid,
    pub snapshot_workspace_id: Option<Uuid>,
}

pub async fn create_job(pool: &DbPool, params: CreateJobParams) -> Result<Uuid> {
    let id = sqlx::query_scalar::<_, Uuid>(
        "INSERT INTO video_export_jobs
         (id, module, graphic_id, range_start, range_end, step_ms, fps,
          width_px, height_px, device_pixel_ratio, overlay_timestamp,
          codec, container, crf, frames_total, original_filename, created_by,
          snapshot_workspace_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::NUMERIC, $11,
                 $12, $13, $14, $15, $16, $17, $18)
         RETURNING id",
    )
    .bind(params.id)
    .bind(&params.module)
    .bind(params.graphic_id)
    .bind(params.range_start)
    .bind(params.range_end)
    .bind(params.step_ms)
    .bind(params.fps)
    .bind(params.width_px)
    .bind(params.height_px)
    .bind(params.device_pixel_ratio)
    .bind(params.overlay_timestamp)
    .bind(&params.codec)
    .bind(&params.container)
    .bind(params.crf)
    .bind(params.frames_total)
    .bind(params.original_filename.as_deref())
    .bind(params.created_by)
    .bind(params.snapshot_workspace_id)
    .fetch_one(pool)
    .await?;
    Ok(id)
}

#[allow(dead_code)]
pub async fn set_processing(pool: &DbPool, id: Uuid) -> Result<()> {
    sqlx::query("UPDATE video_export_jobs SET status='processing', started_at=NOW() WHERE id=$1")
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn set_processing_with_frames(pool: &DbPool, id: Uuid, frames_total: i32) -> Result<()> {
    sqlx::query(
        "UPDATE video_export_jobs SET status='processing', started_at=NOW(), frames_total=$1 WHERE id=$2",
    )
    .bind(frames_total)
    .bind(id)
    .execute(pool)
    .await?;
    Ok(())
}

pub async fn set_completed(
    pool: &DbPool,
    id: Uuid,
    file_path: &str,
    original_filename: &str,
    file_size: i64,
    duration: f64,
) -> Result<()> {
    sqlx::query(
        "UPDATE video_export_jobs
         SET status='completed', file_path=$1, file_size_bytes=$2,
             duration_seconds=$3::NUMERIC, completed_at=NOW(),
             original_filename=COALESCE(original_filename, $4)
         WHERE id=$5",
    )
    .bind(file_path)
    .bind(file_size)
    .bind(duration)
    .bind(original_filename)
    .bind(id)
    .execute(pool)
    .await?;
    cleanup_snapshot(pool, id).await.ok();
    Ok(())
}

pub async fn set_failed(pool: &DbPool, id: Uuid, error_message: &str) -> Result<()> {
    sqlx::query(
        "UPDATE video_export_jobs
         SET status='failed', error_message=$1, completed_at=NOW()
         WHERE id=$2",
    )
    .bind(error_message)
    .bind(id)
    .execute(pool)
    .await?;
    cleanup_snapshot(pool, id).await.ok();
    Ok(())
}

pub async fn set_cancelled(pool: &DbPool, id: Uuid) -> Result<()> {
    sqlx::query(
        "UPDATE video_export_jobs
         SET status='cancelled', completed_at=COALESCE(completed_at, NOW())
         WHERE id=$1",
    )
    .bind(id)
    .execute(pool)
    .await?;
    cleanup_snapshot(pool, id).await.ok();
    Ok(())
}

/// Deletes the workspace snapshot row (if any) attached to this job.
/// Safe to call even if snapshot_workspace_id is NULL or the row is already gone.
async fn cleanup_snapshot(pool: &DbPool, job_id: Uuid) -> Result<()> {
    sqlx::query(
        "DELETE FROM design_objects
         WHERE id = (SELECT snapshot_workspace_id FROM video_export_jobs WHERE id = $1)
           AND type = 'console_workspace_snapshot'",
    )
    .bind(job_id)
    .execute(pool)
    .await?;
    Ok(())
}

#[allow(dead_code)]
pub async fn update_frames_rendered(pool: &DbPool, id: Uuid, count: i32) -> Result<()> {
    sqlx::query("UPDATE video_export_jobs SET frames_rendered=$1 WHERE id=$2")
        .bind(count)
        .bind(id)
        .execute(pool)
        .await?;
    Ok(())
}

pub async fn notify_complete(pool: &DbPool, job_id: Uuid, status: &str) -> Result<()> {
    sqlx::query("SELECT pg_notify('export_complete', $1)")
        .bind(
            serde_json::json!({
                "job_id": job_id,
                "kind": "video_export",
                "status": status,
            })
            .to_string(),
        )
        .execute(pool)
        .await?;
    Ok(())
}
