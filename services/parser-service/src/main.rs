use axum::{
    Router,
    routing::{get, post},
};
use std::net::SocketAddr;
use tower_http::catch_panic::CatchPanicLayer;
use tracing::info;

mod config;
mod handlers;

/// Shared application state passed into axum handlers via `State<AppState>`.
#[derive(Clone)]
pub struct AppState {
    pub config: config::Config,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();

    let obs = io_observability::init(io_observability::ObservabilityConfig {
        service_name: "parser-service",
        service_version: env!("CARGO_PKG_VERSION"),
        log_level: "info",
        metrics_enabled: true,
        tracing_enabled: false,
    })?;
    obs.start_watchdog_keepalive();

    let cfg = config::Config::from_env()?;
    let port = cfg.port;

    info!(service = "parser-service", "Starting up");

    let health =
        io_health::HealthRegistry::new("parser-service", env!("CARGO_PKG_VERSION"));
    health.mark_startup_complete();

    let state = AppState { config: cfg };

    let api: Router = Router::new()
        .route("/parse/svg", post(handlers::parse::parse_svg))
        .route("/parse/json", post(handlers::parse::parse_json))
        .route("/parse/dxf", post(handlers::parse::parse_dxf))
        .route("/parse/dcs-import", post(handlers::dcs_import::dcs_import))
        .route("/parse/formats", get(handlers::parse::list_formats))
        .with_state(state);

    let app = api
        .merge(health.into_router())
        .merge(obs.metrics_router())
        .layer(CatchPanicLayer::new());

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    info!(service = "parser-service", addr = %addr, "Listening");

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
