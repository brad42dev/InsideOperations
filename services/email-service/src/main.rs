use axum::{
    extract::{Request, State},
    http::StatusCode,
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::{get, post, put},
    Router,
};
use std::net::SocketAddr;
use tower_http::catch_panic::CatchPanicLayer;
use tracing::info;

mod config;
mod crypto;
mod handlers;
mod queue_worker;
mod seed_templates;
mod state;
mod template_engine;

use state::AppState;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();

    let obs = io_observability::init(io_observability::ObservabilityConfig {
        service_name: "email-service",
        service_version: env!("CARGO_PKG_VERSION"),
        log_level: "info",
        metrics_enabled: true,
        tracing_enabled: false,
    })?;
    obs.start_watchdog_keepalive();

    info!(service = "email-service", "Starting up");

    let cfg = config::Config::from_env()?;
    let port = cfg.port;
    let db = io_db::create_pool(&cfg.database_url).await?;

    // Seed built-in system email templates if not already present.
    if let Err(e) = seed_templates::seed_builtin_templates(&db).await {
        tracing::warn!(error = %e, "Failed to seed built-in email templates (non-fatal)");
    }

    let state = AppState::new(cfg, db);

    let mut health = io_health::HealthRegistry::new("email-service", env!("CARGO_PKG_VERSION"));
    health.register(io_health::PgDatabaseCheck::new(state.db.clone()));
    health.mark_startup_complete();

    // Spawn background queue worker
    tokio::spawn(queue_worker::run_queue_worker(state.clone()));

    let api = Router::new()
        // Providers
        .route("/providers", get(handlers::email::list_providers).post(handlers::email::create_provider))
        .route(
            "/providers/:id",
            put(handlers::email::update_provider).delete(handlers::email::delete_provider),
        )
        .route("/providers/:id/test", post(handlers::email::test_provider))
        // Templates
        .route(
            "/templates",
            get(handlers::email::list_templates).post(handlers::email::create_template),
        )
        .route(
            "/templates/:id",
            put(handlers::email::update_template).delete(handlers::email::delete_template),
        )
        .route("/templates/:id/render", post(handlers::email::render_template_preview))
        // Queue
        .route("/queue", post(handlers::email::enqueue_email).get(handlers::email::list_queue))
        // Delivery log
        .route("/delivery-log", get(handlers::email::list_delivery_log))
        // Internal
        .route("/internal/send", post(handlers::email::internal_send))
        .layer(middleware::from_fn_with_state(state.clone(), validate_service_secret))
        .with_state(state);

    let app = api
        .merge(health.into_router())
        .merge(obs.metrics_router())
        .layer(CatchPanicLayer::new());

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    info!(service = "email-service", addr = %addr, "Listening");

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

/// Middleware: validate x-io-service-secret header for all requests.
async fn validate_service_secret(
    State(state): State<AppState>,
    req: Request,
    next: Next,
) -> Response {
    // Skip validation if service_secret is empty (dev mode)
    if state.config.service_secret.is_empty() {
        return next.run(req).await;
    }

    let secret = req
        .headers()
        .get("x-io-service-secret")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    if secret != state.config.service_secret {
        return (
            StatusCode::UNAUTHORIZED,
            axum::Json(serde_json::json!({
                "success": false,
                "error": { "code": "UNAUTHORIZED", "message": "Invalid service secret" }
            })),
        )
            .into_response();
    }

    next.run(req).await
}
