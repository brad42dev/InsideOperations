/// Integration test for the video export pipeline.
/// Requires IO_DATABASE_URL and IO_JWT_SECRET to be set (sourced from .env).
/// Run with: VIDEO_EXPORT_FAKE_WORKER=1 cargo test -p video-export-service
use chrono::Utc;
use video_export_service::{config::Config, db, render};

#[tokio::test]
async fn test_full_pipeline_with_fake_worker() {
    dotenvy::dotenv().ok();
    std::env::set_var("VIDEO_EXPORT_FAKE_WORKER", "1");

    let database_url = match std::env::var("IO_DATABASE_URL") {
        Ok(u) => u,
        Err(_) => {
            eprintln!("IO_DATABASE_URL not set — skipping integration test");
            return;
        }
    };

    // Ensure export directories exist
    let export_dir =
        std::env::var("IO_EXPORT_DIR").unwrap_or_else(|_| "/tmp/io-exports-test".to_string());
    std::env::set_var("IO_EXPORT_DIR", &export_dir);
    tokio::fs::create_dir_all(format!("{}/videos", export_dir))
        .await
        .ok();
    tokio::fs::create_dir_all(format!("{}/videos/.tmp", export_dir))
        .await
        .ok();

    let pool = io_db::create_pool(&database_url).await.expect("db pool");
    let cfg = match Config::from_env() {
        Ok(c) => std::sync::Arc::new(c),
        Err(e) => {
            eprintln!("Service config unavailable ({e}) — skipping integration test");
            return;
        }
    };

    // Need an existing user to satisfy the FK on video_export_jobs.created_by
    let user_id: uuid::Uuid = sqlx::query_scalar("SELECT id FROM users LIMIT 1")
        .fetch_one(&pool)
        .await
        .expect("at least one user must exist in the DB");

    let job_id = uuid::Uuid::new_v4();
    let now = Utc::now();

    let params = db::CreateJobParams {
        id: job_id,
        module: "process".to_string(),
        graphic_id: uuid::Uuid::new_v4(),
        range_start: now - chrono::Duration::hours(1),
        range_end: now,
        step_ms: 60_000,
        fps: 10,
        width_px: 1280,
        height_px: 720,
        device_pixel_ratio: 1.0,
        overlay_timestamp: false,
        codec: "vp9".to_string(),
        container: "webm".to_string(),
        crf: 28,
        frames_total: None,
        original_filename: None,
        created_by: user_id,
        snapshot_workspace_id: None,
    };

    db::create_job(&pool, params).await.expect("insert job");

    render::playwright::render_job(&pool, &cfg, job_id)
        .await
        .expect("render_job should succeed with fake worker");

    // Assert DB status = completed
    let status: String = sqlx::query_scalar("SELECT status FROM video_export_jobs WHERE id = $1")
        .bind(job_id)
        .fetch_one(&pool)
        .await
        .expect("fetch status");

    assert_eq!(status, "completed", "job status should be completed");

    // Assert file exists at the output path
    let file_path: Option<String> =
        sqlx::query_scalar("SELECT file_path FROM video_export_jobs WHERE id = $1")
            .bind(job_id)
            .fetch_one(&pool)
            .await
            .ok()
            .flatten();

    if let Some(ref path) = file_path {
        assert!(
            std::path::Path::new(path).exists(),
            "output file should exist at {path}"
        );
        let _ = tokio::fs::remove_file(path).await;
    } else {
        panic!("file_path should be set on a completed job");
    }

    // Cleanup
    sqlx::query("DELETE FROM video_export_jobs WHERE id = $1")
        .bind(job_id)
        .execute(&pool)
        .await
        .ok();
}
