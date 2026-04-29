use axum::{
    routing::{delete, get, post},
    Router,
};
use chrono::Utc;
use sqlx::Row;
use std::{net::SocketAddr, sync::Arc};
use tower_http::catch_panic::CatchPanicLayer;
use tower_http::cors::{Any, CorsLayer};
use tracing::info;
use uuid::Uuid;

use video_export_service::{config::Config, handlers, jobs::JobQueue, state::AppState};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();

    let obs = io_observability::init(io_observability::ObservabilityConfig {
        service_name: "video-export-service",
        service_version: env!("CARGO_PKG_VERSION"),
        log_level: "info",
        metrics_enabled: true,
        tracing_enabled: false,
    })?;
    obs.start_watchdog_keepalive();

    let cfg = Config::from_env()?;
    let port = cfg.port;
    let cfg = Arc::new(cfg);

    info!(service = "video-export-service", "Connecting to database");
    let db = io_db::create_pool(&cfg.database_url).await?;
    io_db::spawn_pool_metrics(db.clone(), "video-export-service");

    // Recover jobs orphaned by a previous crash before accepting new work
    recover_orphans(&db, &cfg.export_dir).await;

    let mut health =
        io_health::HealthRegistry::new("video-export-service", env!("CARGO_PKG_VERSION"));
    health.register(io_health::PgDatabaseCheck::new(db.clone()));
    health.mark_startup_complete();

    let job_queue = Arc::new(JobQueue::new(db.clone(), Arc::clone(&cfg)));

    // Hourly file-retention cleanup
    {
        let cleanup_pool = db.clone();
        let cleanup_cfg = Arc::clone(&cfg);
        tokio::spawn(async move {
            cleanup_loop(&cleanup_pool, &cleanup_cfg).await;
        });
    }

    let state = AppState {
        db,
        config: cfg,
        job_queue,
    };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_headers(Any)
        .allow_methods(Any);

    let api = Router::new()
        .route("/internal/jobs", post(handlers::create_job))
        .route("/internal/jobs/:id", get(handlers::get_job))
        .route("/internal/jobs/:id", delete(handlers::cancel_job))
        .with_state(state);

    let app = api
        .merge(health.into_router())
        .merge(obs.metrics_router())
        .layer(cors)
        .layer(CatchPanicLayer::new());

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    info!(service = "video-export-service", addr = %addr, "Listening");

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    Ok(())
}

async fn recover_orphans(pool: &io_db::DbPool, export_dir: &str) {
    let orphaned = sqlx::query(
        "UPDATE video_export_jobs
         SET status = 'failed',
             error_message = 'Service restarted during render',
             completed_at = NOW(),
             updated_at = NOW()
         WHERE status IN ('queued', 'processing')
         RETURNING id, snapshot_workspace_id",
    )
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    for row in &orphaned {
        if let Ok(job_id) = row.try_get::<Uuid, _>("id") {
            let payload = serde_json::json!({
                "job_id": job_id,
                "kind": "video_export",
                "status": "failed",
            })
            .to_string();
            let _ = sqlx::query("SELECT pg_notify('export_complete', $1)")
                .bind(payload)
                .execute(pool)
                .await;
        }
    }

    if !orphaned.is_empty() {
        tracing::warn!(
            count = orphaned.len(),
            "Recovered orphaned video export jobs on startup"
        );

        let snapshot_ids: Vec<Uuid> = orphaned
            .iter()
            .filter_map(|r| {
                r.try_get::<Option<Uuid>, _>("snapshot_workspace_id")
                    .ok()
                    .flatten()
            })
            .collect();

        if !snapshot_ids.is_empty() {
            let _ = sqlx::query(
                "DELETE FROM design_objects
                 WHERE id = ANY($1)
                   AND type = 'console_workspace_snapshot'",
            )
            .bind(&snapshot_ids)
            .execute(pool)
            .await;
        }
    }

    // Remove leftover .tmp files from interrupted renders
    let tmp_dir = format!("{}/videos/.tmp", export_dir);
    if let Ok(mut entries) = tokio::fs::read_dir(&tmp_dir).await {
        while let Ok(Some(entry)) = entries.next_entry().await {
            let path = entry.path();
            if path.is_dir() {
                let _ = tokio::fs::remove_dir_all(&path).await;
            } else {
                let _ = tokio::fs::remove_file(&path).await;
            }
        }
    }
}

async fn cleanup_loop(pool: &io_db::DbPool, cfg: &Config) {
    let mut interval = tokio::time::interval(tokio::time::Duration::from_secs(3600));
    loop {
        interval.tick().await;
        cleanup_old_exports(pool, cfg).await;
    }
}

async fn cleanup_old_exports(pool: &io_db::DbPool, cfg: &Config) {
    let cutoff = Utc::now() - chrono::Duration::hours(cfg.export_retention_hours as i64);

    let expired = sqlx::query(
        "SELECT id, file_path FROM video_export_jobs
         WHERE created_at < $1 AND file_path IS NOT NULL",
    )
    .bind(cutoff)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    for row in &expired {
        let job_id: Uuid = row.try_get("id").unwrap_or_default();
        if let Ok(Some(path)) = row.try_get::<Option<String>, _>("file_path") {
            if !path.is_empty() {
                let _ = tokio::fs::remove_file(&path).await;
            }
        }
        let _ = sqlx::query(
            "UPDATE video_export_jobs SET file_path = NULL, status = 'cancelled' WHERE id = $1",
        )
        .bind(job_id)
        .execute(pool)
        .await;
    }

    // Sweep .tmp directory for files older than 2 hours
    let tmp_dir = format!("{}/videos/.tmp", cfg.export_dir);
    let two_hours_ago = std::time::SystemTime::now() - std::time::Duration::from_secs(7200);
    if let Ok(mut entries) = tokio::fs::read_dir(&tmp_dir).await {
        while let Ok(Some(entry)) = entries.next_entry().await {
            if let Ok(meta) = entry.metadata().await {
                if let Ok(modified) = meta.modified() {
                    if modified < two_hours_ago {
                        let path = entry.path();
                        if path.is_dir() {
                            let _ = tokio::fs::remove_dir_all(&path).await;
                        } else {
                            let _ = tokio::fs::remove_file(&path).await;
                        }
                    }
                }
            }
        }
    }
}

async fn shutdown_signal() {
    use tokio::signal;
    let ctrl_c = async {
        signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };
    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("failed to install SIGTERM handler")
            .recv()
            .await;
    };
    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();
    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }
    tracing::info!("shutdown signal received, draining in-flight requests…");
}
