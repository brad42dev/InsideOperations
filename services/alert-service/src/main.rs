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
mod handlers;
mod state;

use state::AppState;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();

    let obs = io_observability::init(io_observability::ObservabilityConfig {
        service_name: "alert-service",
        service_version: env!("CARGO_PKG_VERSION"),
        log_level: "info",
        metrics_enabled: true,
        tracing_enabled: false,
    })?;
    obs.start_watchdog_keepalive();

    info!(service = "alert-service", "Starting up");

    let cfg = config::Config::from_env()?;
    let port = cfg.port;
    let state = AppState::new(cfg).await?;

    let mut health = io_health::HealthRegistry::new("alert-service", env!("CARGO_PKG_VERSION"));
    health.register(io_health::PgDatabaseCheck::new(state.db.clone()));
    health.mark_startup_complete();

    // Recover any in-flight escalations from before the service restarted.
    // This runs as a background task so the HTTP listener is never blocked.
    let recovery_state = state.clone();
    tokio::spawn(async move {
        handlers::escalation::recover_escalations(recovery_state).await;
    });

    // Alert routes
    // NOTE: static routes (/trigger, /policies) must be registered before
    // parameterised routes (/:id) to avoid routing conflicts.
    let api = Router::new()
        // Alert instance endpoints (static before parameterised)
        .route("/alerts/trigger", post(handlers::alerts::trigger_alert))
        .route("/alerts", get(handlers::alerts::list_alerts))
        // Policy endpoints (static /policies before /:id)
        .route(
            "/alerts/policies",
            get(handlers::policies::list_policies).post(handlers::policies::create_policy),
        )
        .route(
            "/alerts/policies/:id",
            get(handlers::policies::get_policy)
                .put(handlers::policies::update_policy)
                .delete(handlers::policies::delete_policy),
        )
        .route(
            "/alerts/policies/:id/tiers",
            get(handlers::policies::list_tiers).post(handlers::policies::create_tier),
        )
        .route(
            "/alerts/policies/:id/tiers/:tier_id",
            put(handlers::policies::update_tier).delete(handlers::policies::delete_tier),
        )
        // Roster endpoints (static /rosters before /:id)
        .route(
            "/alerts/rosters",
            get(handlers::rosters::list_rosters).post(handlers::rosters::create_roster),
        )
        .route(
            "/alerts/rosters/:id",
            get(handlers::rosters::get_roster)
                .put(handlers::rosters::update_roster)
                .delete(handlers::rosters::delete_roster),
        )
        // Alert instance endpoints with :id (after static routes)
        .route("/alerts/:id", get(handlers::alerts::get_alert))
        .route(
            "/alerts/:id/acknowledge",
            post(handlers::alerts::acknowledge_alert),
        )
        .route(
            "/alerts/:id/resolve",
            post(handlers::alerts::resolve_alert),
        )
        .route(
            "/alerts/:id/cancel",
            post(handlers::alerts::cancel_alert),
        )
        .layer(middleware::from_fn_with_state(state.clone(), validate_service_secret))
        .with_state(state);

    let app = api
        .merge(health.into_router())
        .merge(obs.metrics_router())
        .layer(CatchPanicLayer::new());

    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    info!(service = "alert-service", addr = %addr, "Listening");

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
