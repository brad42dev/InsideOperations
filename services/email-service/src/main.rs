use axum::{
    extract::{Request, State},
    http::StatusCode,
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::{delete, get, post, put},
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
    io_db::spawn_pool_metrics(db.clone(), "email-service");

    // Seed built-in system email templates if not already present.
    if let Err(e) = seed_templates::seed_builtin_templates(&db).await {
        tracing::warn!(error = %e, "Failed to seed built-in email templates (non-fatal)");
    }

    let state = AppState::new(cfg, db);

    let mut health = io_health::HealthRegistry::new("email-service", env!("CARGO_PKG_VERSION"));
    health.register(io_health::PgDatabaseCheck::new(state.db.clone()));
    health.mark_startup_complete();

    // Spawn background queue workers (configurable count, default 4).
    // Each worker independently dequeues using SKIP LOCKED for concurrency safety.
    let worker_count = state.config.queue_workers;
    for _ in 0..worker_count {
        tokio::spawn(queue_worker::run_queue_worker(state.clone()));
    }

    // Spawn PostgreSQL NOTIFY listener for the `email_send` channel.
    // Other services can trigger email delivery via: NOTIFY email_send, '<json payload>';
    {
        let notify_state = state.clone();
        tokio::spawn(async move {
            let mut listener = match sqlx::postgres::PgListener::connect_with(&notify_state.db).await {
                Ok(l) => l,
                Err(e) => {
                    tracing::error!(error = %e, "Failed to connect NOTIFY listener — pg_notify trigger disabled");
                    return;
                }
            };
            if let Err(e) = listener.listen("email_send").await {
                tracing::error!(error = %e, "Failed to subscribe to email_send NOTIFY channel");
                return;
            }
            tracing::info!("NOTIFY listener active on channel 'email_send'");
            loop {
                match listener.recv().await {
                    Ok(notification) => {
                        let payload = notification.payload();
                        // Parse as a SendRequest JSON object and insert into email_queue.
                        match serde_json::from_str::<serde_json::Value>(payload) {
                            Ok(req) => {
                                let to = req.get("to").and_then(|v| v.as_array()).map(|arr| {
                                    arr.iter().filter_map(|v| v.as_str().map(String::from)).collect::<Vec<_>>()
                                }).unwrap_or_default();
                                let subject = req.get("subject").and_then(|v| v.as_str()).unwrap_or("(no subject)").to_string();
                                let body_html = req.get("body_html").and_then(|v| v.as_str()).unwrap_or("").to_string();
                                let body_text: Option<String> = req.get("body_text").and_then(|v| v.as_str()).map(String::from);

                                if to.is_empty() {
                                    tracing::warn!(payload = %payload, "NOTIFY email_send: missing 'to' field — skipping");
                                    continue;
                                }

                                let insert_result = sqlx::query(
                                    r#"INSERT INTO email_queue
                                           (id, to_addresses, subject, body_html, body_text, status, priority, attempts, max_attempts, next_attempt)
                                       VALUES (gen_random_uuid(), $1, $2, $3, $4, 'pending', 5, 0, 4, now())"#,
                                )
                                .bind(&to)
                                .bind(&subject)
                                .bind(&body_html)
                                .bind(&body_text)
                                .execute(&notify_state.db)
                                .await;

                                match insert_result {
                                    Ok(_) => tracing::info!(to = ?to, subject = %subject, "NOTIFY email_send: queued email"),
                                    Err(e) => tracing::error!(error = %e, "NOTIFY email_send: failed to insert into queue"),
                                }
                            }
                            Err(e) => {
                                tracing::warn!(error = %e, payload = %payload, "NOTIFY email_send: invalid JSON payload — skipping");
                            }
                        }
                    }
                    Err(e) => {
                        tracing::error!(error = %e, "NOTIFY listener error — listener may have disconnected");
                    }
                }
            }
        });
    }

    // Spawn scheduled cleanup task — purges sent/dead queue entries older than
    // the configured retention period (default 30 days). Runs hourly.
    {
        let cleanup_state = state.clone();
        tokio::spawn(async move {
            loop {
                tokio::time::sleep(std::time::Duration::from_secs(3600)).await;
                let retention_days = cleanup_state.config.queue_retention_days as i64;
                match sqlx::query(
                    "DELETE FROM email_queue WHERE status IN ('sent', 'dead') AND created_at < now() - ($1 * interval '1 day')",
                )
                .bind(retention_days)
                .execute(&cleanup_state.db)
                .await
                {
                    Ok(r) => {
                        let deleted = r.rows_affected();
                        if deleted > 0 {
                            tracing::info!(deleted, "Queue cleanup: purged old sent/dead entries");
                        }
                    }
                    Err(e) => {
                        tracing::error!(error = %e, "Queue cleanup: DELETE failed");
                    }
                }
            }
        });
    }

    let api = Router::new()
        // Providers
        .route("/providers", get(handlers::email::list_providers).post(handlers::email::create_provider))
        .route(
            "/providers/:id",
            get(handlers::email::get_provider)
                .put(handlers::email::update_provider)
                .delete(handlers::email::delete_provider),
        )
        .route("/providers/:id/test", post(handlers::email::test_provider))
        .route("/providers/:id/default", put(handlers::email::set_default_provider))
        .route("/providers/:id/fallback", put(handlers::email::set_fallback_provider))
        .route("/providers/:id/enabled", put(handlers::email::set_provider_enabled))
        // Templates
        .route(
            "/templates",
            get(handlers::email::list_templates).post(handlers::email::create_template),
        )
        .route(
            "/templates/:id",
            put(handlers::email::update_template).delete(handlers::email::delete_template),
        )
        // Canonical route per spec; keep old /render alias for compatibility.
        .route("/templates/:id/preview", post(handlers::email::render_template_preview))
        .route("/templates/:id/render", post(handlers::email::render_template_preview))
        // Queue
        .route("/queue", post(handlers::email::enqueue_email).get(handlers::email::list_queue))
        .route("/queue/:id/retry", post(handlers::email::retry_queue_item))
        .route("/queue/:id", delete(handlers::email::cancel_queue_item))
        // Delivery log — /logs is canonical; /delivery-log kept for backwards compatibility.
        .route("/logs", get(handlers::email::list_logs))
        .route("/logs/:id", get(handlers::email::get_delivery_log_item))
        .route("/delivery-log", get(handlers::email::list_delivery_log))
        // Stats
        .route("/stats", get(handlers::email::get_email_stats))
        // Suppression list
        .route("/suppressions", get(handlers::email::list_suppressions))
        .route("/suppressions/:id", delete(handlers::email::delete_suppression))
        // Internal
        .route("/internal/send", post(handlers::email::internal_send))
        // Spec-compliant detailed health endpoint
        .route("/health", get(handlers::email::email_health))
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
