use axum::{
    routing::{get, post},
    Router,
};
use std::{net::SocketAddr, sync::Arc};
use tower_http::catch_panic::CatchPanicLayer;
use tower_http::cors::{Any, CorsLayer};
use tracing::info;

mod config;
mod handlers;
mod maintenance;
mod state;

use state::AppState;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();

    let obs = io_observability::init(io_observability::ObservabilityConfig {
        service_name: "archive-service",
        service_version: env!("CARGO_PKG_VERSION"),
        log_level: "info",
        metrics_enabled: true,
        tracing_enabled: false,
    })?;
    obs.start_watchdog_keepalive();

    let cfg = config::Config::from_env()?;
    let port = cfg.port;
    let cfg = Arc::new(cfg);

    info!(service = "archive-service", "Connecting to database");
    let db = io_db::create_pool(&cfg.database_url).await?;

    let health =
        io_health::HealthRegistry::new("archive-service", env!("CARGO_PKG_VERSION"));
    health.mark_startup_complete();

    let state = AppState { db: db.clone(), config: cfg.clone() };

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_headers(Any)
        .allow_methods(Any);

    // Spawn the background maintenance task.
    tokio::spawn(maintenance::run_maintenance(db, cfg));

    let api: Router = Router::new()
        // Single-point history query
        .route(
            "/history/points/:point_id",
            get(handlers::history::get_point_history),
        )
        // Latest value for a single point
        .route(
            "/history/points/:point_id/latest",
            get(handlers::history::get_point_latest),
        )
        // Batch history query (up to 50 points)
        .route(
            "/history/points/batch",
            post(handlers::history::get_batch_history),
        )
        .with_state(state);

    let app = api
        .merge(health.into_router())
        .merge(obs.metrics_router())
        .layer(cors)
        .layer(CatchPanicLayer::new());

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    info!(service = "archive-service", addr = %addr, "Listening");

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    Ok(())
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

