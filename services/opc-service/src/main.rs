use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Router,
};
use std::collections::{HashMap, HashSet};
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::Notify;
use tokio::time::Duration;
use tower_http::catch_panic::CatchPanicLayer;
use tracing::{info, warn};
use uuid::Uuid;

mod config;
mod db;
mod driver;
mod ipc;
mod state;

use config::Config;
use ipc::UdsSender;
use state::AppState;

/// Interval at which we poll the DB for newly enabled sources.
const SOURCE_POLL_INTERVAL: Duration = Duration::from_secs(60);

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();

    let obs = io_observability::init(io_observability::ObservabilityConfig {
        service_name: "opc-service",
        service_version: env!("CARGO_PKG_VERSION"),
        log_level: "info",
        metrics_enabled: true,
        tracing_enabled: false,
    })?;

    info!(service = "opc-service", "Starting up");

    // --- Config ---
    let config = Arc::new(Config::from_env()?);

    // --- Database ---
    let db = io_db::create_pool(&config.database_url).await?;
    info!(service = "opc-service", "Database pool connected");

    // --- UDS sender ---
    let uds = Arc::new(UdsSender::new(config.opc_broker_sock.clone()));
    uds.connect().await;

    // --- Reconnect signal map ---
    let reconnect_signals: Arc<std::sync::Mutex<HashMap<Uuid, Arc<Notify>>>> =
        Arc::new(std::sync::Mutex::new(HashMap::new()));

    // --- Health + metrics HTTP ---
    let health = io_health::HealthRegistry::new("opc-service", env!("CARGO_PKG_VERSION"));
    health.mark_startup_complete();

    let app_state = AppState {
        db: db.clone(),
        config: config.clone(),
        reconnect_signals: reconnect_signals.clone(),
    };

    let internal_router = Router::new()
        .route("/internal/reconnect/:source_id", axum::routing::post(reconnect_source))
        .with_state(app_state);

    let app = Router::new()
        .merge(health.into_router())
        .merge(obs.metrics_router())
        .merge(internal_router)
        .layer(CatchPanicLayer::new());

    let addr = SocketAddr::from(([0, 0, 0, 0], config.port));
    info!(service = "opc-service", addr = %addr, "Listening");

    let listener = tokio::net::TcpListener::bind(addr).await?;

    // Use a oneshot channel so the source manager loop can signal the HTTP
    // server to shut down when a SIGTERM/SIGINT is received.
    let (shutdown_tx, shutdown_rx) = tokio::sync::oneshot::channel::<()>();

    // --- Spawn HTTP server in background ---
    tokio::spawn(async move {
        if let Err(e) = axum::serve(listener, app)
            .with_graceful_shutdown(async move {
                let _ = shutdown_rx.await;
                tracing::info!("shutdown signal received, draining in-flight requests…");
            })
            .await
        {
            warn!(error = %e, "HTTP server exited");
        }
    });

    // --- Source manager loop — exits on SIGTERM/SIGINT ---
    let mut known_source_ids: HashSet<Uuid> = HashSet::new();
    let mut shutdown_tx = Some(shutdown_tx);

    loop {
        // Poll for new OPC UA sources.
        match db::load_sources(&db).await {
            Ok(sources) => {
                for source in sources {
                    if !known_source_ids.contains(&source.id) {
                        known_source_ids.insert(source.id);
                        info!(source = %source.name, id = %source.id, "Spawning OPC UA driver task");

                        // Create a per-source reconnect notifier.
                        let notify = Arc::new(Notify::new());
                        reconnect_signals
                            .lock()
                            .unwrap()
                            .insert(source.id, notify.clone());

                        let db_clone = db.clone();
                        let uds_clone = uds.clone();
                        let cfg_clone = config.clone();
                        let signals_clone = reconnect_signals.clone();
                        let source_id = source.id;

                        tokio::spawn(async move {
                            driver::run_source(source, db_clone, uds_clone, cfg_clone, notify).await;
                            // Remove the notifier when the driver exits (shouldn't happen
                            // in normal operation, but keeps the map clean).
                            signals_clone.lock().unwrap().remove(&source_id);
                        });
                    }
                }
            }
            Err(e) => {
                warn!(error = %e, "Failed to load OPC UA sources from DB");
            }
        }

        tokio::select! {
            _ = tokio::time::sleep(SOURCE_POLL_INTERVAL) => {},
            _ = shutdown_signal() => {
                info!("opc-service shutting down");
                if let Some(tx) = shutdown_tx.take() {
                    let _ = tx.send(());
                }
                break;
            },
        }
    }

    Ok(())
}

// ---------------------------------------------------------------------------
// Internal reconnect endpoint  POST /internal/reconnect/:source_id
// ---------------------------------------------------------------------------

async fn reconnect_source(
    State(state): State<AppState>,
    Path(source_id): Path<Uuid>,
) -> impl IntoResponse {
    let notify = state
        .reconnect_signals
        .lock()
        .unwrap()
        .get(&source_id)
        .cloned();

    if let Some(n) = notify {
        n.notify_one();
        info!(source_id = %source_id, "Reconnect signal sent to driver");
        StatusCode::NO_CONTENT
    } else {
        // Source not currently managed (may not be enabled yet or unknown ID).
        StatusCode::NOT_FOUND
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
