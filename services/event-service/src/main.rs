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
    io_db::spawn_pool_metrics(db.clone(), "event-service");

    let mut health = io_health::HealthRegistry::new("event-service", env!("CARGO_PKG_VERSION"));
    health.register(io_health::PgDatabaseCheck::new(db.clone()));
    health.mark_startup_complete();

    let http = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()?;

    let state = AppState {
        db: db.clone(),
        config: cfg.clone(),
        http,
    };
    let cfg_arc = Arc::new(cfg);

    // Spawn the ISA-18.2 threshold alarm evaluator.
    let eval_db = db.clone();
    let eval_cfg = cfg_arc.clone();
    tokio::spawn(async move {
        alarm_evaluator::run_alarm_evaluator(eval_db, eval_cfg).await;
    });

    // Spawn the external alarm processor: handles OPC A&C events and imported alarm
    // events that land in the events table from non-threshold sources.
    // This makes the alarm_state_changed broadcast source-agnostic.
    let ext_db = db.clone();
    tokio::spawn(async move {
        alarm_evaluator::run_external_alarm_processor(ext_db).await;
    });

    let app: Router = Router::new()
        // Alarm endpoints (service-secret protected)
        .route("/alarms/active", get(handlers::alarms::get_active_alarms))
        .route("/alarms/history", get(handlers::alarms::get_alarm_history))
        .route(
            "/alarms/:id/acknowledge",
            post(handlers::alarms::acknowledge_alarm),
        )
        .route("/alarms/:id/shelve", post(handlers::alarms::shelve_alarm))
        // OPC A&C alarm endpoints
        .route(
            "/alarms/opc/active",
            get(handlers::alarms::get_opc_active_alarms),
        )
        .route(
            "/alarms/opc/:point_id/acknowledge",
            post(handlers::alarms::acknowledge_opc_alarm),
        )
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
