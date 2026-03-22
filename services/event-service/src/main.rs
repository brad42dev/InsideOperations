use axum::{
    routing::{get, post},
    Router,
};
use std::{net::SocketAddr, sync::Arc};
use tower_http::catch_panic::CatchPanicLayer;
use tracing::info;

mod alarm_evaluator;
mod alarm_state;
mod config;
mod handlers;
mod state;

use state::AppState;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();

    let obs = io_observability::init(io_observability::ObservabilityConfig {
        service_name: "event-service",
        service_version: env!("CARGO_PKG_VERSION"),
        log_level: "info",
        metrics_enabled: true,
        tracing_enabled: false,
    })?;
    obs.start_watchdog_keepalive();

    info!(service = "event-service", "Starting up");

    let cfg = config::Config::from_env()?;
    let port = cfg.port;

    let db = io_db::create_pool(&cfg.database_url).await?;

    let health =
        io_health::HealthRegistry::new("event-service", env!("CARGO_PKG_VERSION"));
    health.mark_startup_complete();

    let state = AppState { db: db.clone(), config: cfg.clone() };
    let cfg_arc = Arc::new(cfg);

    // Spawn the ISA-18.2 alarm evaluator as a background task.
    let eval_db = db.clone();
    let eval_cfg = cfg_arc.clone();
    tokio::spawn(async move {
        alarm_evaluator::run_alarm_evaluator(eval_db, eval_cfg).await;
    });

    let app: Router = Router::new()
        // Alarm endpoints (service-secret protected)
        .route("/alarms/active", get(handlers::alarms::get_active_alarms))
        .route("/alarms/history", get(handlers::alarms::get_alarm_history))
        .route("/alarms/:id/acknowledge", post(handlers::alarms::acknowledge_alarm))
        .route("/alarms/:id/shelve", post(handlers::alarms::shelve_alarm))
        .with_state(state)
        .merge(health.into_router())
        .merge(obs.metrics_router())
        .layer(CatchPanicLayer::new());

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    info!(service = "event-service", addr = %addr, "Listening");

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
