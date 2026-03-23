use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    Json, Router,
};
use opcua::client::prelude::{ByteString, LocalizedText, Session, StatusCode as OpcStatusCode, Variant};
use opcua::sync::RwLock;
use serde::Deserialize;
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
    obs.start_watchdog_keepalive();

    info!(service = "opc-service", "Starting up");

    // --- Config ---
    let config = Arc::new(Config::from_env()?);

    // --- Database ---
    let db = io_db::create_pool(&config.database_url).await?;
    info!(service = "opc-service", "Database pool connected");
    io_db::spawn_pool_metrics(db.clone(), "opc-service");

    // --- UDS sender ---
    let uds = Arc::new(UdsSender::new(config.opc_broker_sock.clone()));
    uds.connect().await;

    // --- Reconnect signal map ---
    let reconnect_signals: Arc<std::sync::Mutex<HashMap<Uuid, Arc<Notify>>>> =
        Arc::new(std::sync::Mutex::new(HashMap::new()));

    // --- Session registry (live OPC UA sessions for alarm-method HTTP handlers) ---
    let sessions: state::SessionRegistry =
        Arc::new(std::sync::Mutex::new(HashMap::new()));

    // --- Health + metrics HTTP ---
    let mut health = io_health::HealthRegistry::new("opc-service", env!("CARGO_PKG_VERSION"));
    health.register(io_health::PgDatabaseCheck::new(db.clone()));
    health.register(io_health::UnixSocketCheck::new(config.opc_broker_sock.clone()).non_critical());
    health.mark_startup_complete();

    let app_state = AppState {
        db: db.clone(),
        config: config.clone(),
        reconnect_signals: reconnect_signals.clone(),
        sessions: sessions.clone(),
    };

    let internal_router = Router::new()
        .route("/internal/reconnect/:source_id", axum::routing::post(reconnect_source))
        .route("/internal/alarm/:source_id/acknowledge", axum::routing::post(alarm_acknowledge))
        .route("/internal/alarm/:source_id/enable", axum::routing::post(alarm_enable))
        .route("/internal/alarm/:source_id/disable", axum::routing::post(alarm_disable))
        .route("/internal/alarm/:source_id/shelve", axum::routing::post(alarm_shelve))
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
                        let sessions_clone = sessions.clone();
                        let source_id = source.id;

                        tokio::spawn(async move {
                            driver::run_source(source, db_clone, uds_clone, cfg_clone, notify, sessions_clone).await;
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

// ---------------------------------------------------------------------------
// Internal alarm method endpoints
// ---------------------------------------------------------------------------
//
// All four endpoints share the same pattern:
//   1. Clone the Arc<RwLock<Session>> from the registry under the Mutex (then release the lock).
//   2. Dispatch to driver::call_alarm_method on a spawn_blocking thread.
//   3. Map Good → 204, bad OPC status → 422 with JSON body.

/// Look up a live session by source_id, returning None if not connected.
/// The Arc is cloned under the Mutex so we never hold the lock while doing I/O.
fn get_session(state: &AppState, source_id: Uuid) -> Option<Arc<RwLock<Session>>> {
    state.sessions.lock().unwrap().get(&source_id).cloned()
}

/// Map an OPC UA StatusCode to an HTTP response.
/// `Good` → 204 No Content.  Any non-Good status → 422 with JSON body.
fn opc_status_to_response(sc: OpcStatusCode) -> axum::response::Response {
    if sc.is_good() {
        StatusCode::NO_CONTENT.into_response()
    } else {
        let body = serde_json::json!({ "opc_status": format!("{:?}", sc) });
        (StatusCode::UNPROCESSABLE_ENTITY, Json(body)).into_response()
    }
}

// ---------------------------------------------------------------------------
// POST /internal/alarm/:source_id/acknowledge
// Body: { "condition_node_id": "...", "event_id": "<hex>", "comment": "..." }
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
struct AcknowledgeBody {
    condition_node_id: String,
    event_id: String,
    #[serde(default)]
    comment: String,
}

async fn alarm_acknowledge(
    State(state): State<AppState>,
    Path(source_id): Path<Uuid>,
    Json(body): Json<AcknowledgeBody>,
) -> axum::response::Response {
    let Some(session_arc) = get_session(&state, source_id) else {
        return StatusCode::NOT_FOUND.into_response();
    };

    let condition_node_id = body.condition_node_id;
    let event_id_hex = body.event_id;
    let comment = body.comment;

    let sc = tokio::task::spawn_blocking(move || {
        // Decode hex event_id into bytes for ByteString.
        let bytes = hex::decode(&event_id_hex).unwrap_or_default();
        let event_id_variant = Variant::ByteString(ByteString::from(bytes));
        let comment_variant = Variant::from(LocalizedText::new("en", &comment));
        let args = Some(vec![event_id_variant, comment_variant]);

        let session_guard = session_arc.read();
        driver::call_alarm_method(&session_guard, &condition_node_id, "Acknowledge", args)
    })
    .await;

    match sc {
        Ok(status_code) => opc_status_to_response(status_code),
        Err(e) => {
            warn!(source_id = %source_id, error = %e, "spawn_blocking join error in alarm_acknowledge");
            StatusCode::INTERNAL_SERVER_ERROR.into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// POST /internal/alarm/:source_id/enable
// Body: { "condition_node_id": "..." }
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
struct ConditionBody {
    condition_node_id: String,
}

async fn alarm_enable(
    State(state): State<AppState>,
    Path(source_id): Path<Uuid>,
    Json(body): Json<ConditionBody>,
) -> axum::response::Response {
    let Some(session_arc) = get_session(&state, source_id) else {
        return StatusCode::NOT_FOUND.into_response();
    };

    let condition_node_id = body.condition_node_id;

    let sc = tokio::task::spawn_blocking(move || {
        let session_guard = session_arc.read();
        driver::call_alarm_method(&session_guard, &condition_node_id, "Enable", None)
    })
    .await;

    match sc {
        Ok(status_code) => opc_status_to_response(status_code),
        Err(e) => {
            warn!(source_id = %source_id, error = %e, "spawn_blocking join error in alarm_enable");
            StatusCode::INTERNAL_SERVER_ERROR.into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// POST /internal/alarm/:source_id/disable
// Body: { "condition_node_id": "..." }
// ---------------------------------------------------------------------------

async fn alarm_disable(
    State(state): State<AppState>,
    Path(source_id): Path<Uuid>,
    Json(body): Json<ConditionBody>,
) -> axum::response::Response {
    let Some(session_arc) = get_session(&state, source_id) else {
        return StatusCode::NOT_FOUND.into_response();
    };

    let condition_node_id = body.condition_node_id;

    let sc = tokio::task::spawn_blocking(move || {
        let session_guard = session_arc.read();
        driver::call_alarm_method(&session_guard, &condition_node_id, "Disable", None)
    })
    .await;

    match sc {
        Ok(status_code) => opc_status_to_response(status_code),
        Err(e) => {
            warn!(source_id = %source_id, error = %e, "spawn_blocking join error in alarm_disable");
            StatusCode::INTERNAL_SERVER_ERROR.into_response()
        }
    }
}

// ---------------------------------------------------------------------------
// POST /internal/alarm/:source_id/shelve
// Body: { "condition_node_id": "...", "type": "timed|oneshot|unshelve", "shelving_time_ms": 3600000 }
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
struct ShelveBody {
    condition_node_id: String,
    #[serde(rename = "type")]
    shelve_type: String,
    shelving_time_ms: Option<f64>,
}

async fn alarm_shelve(
    State(state): State<AppState>,
    Path(source_id): Path<Uuid>,
    Json(body): Json<ShelveBody>,
) -> axum::response::Response {
    let Some(session_arc) = get_session(&state, source_id) else {
        return StatusCode::NOT_FOUND.into_response();
    };

    let condition_node_id = body.condition_node_id;
    let shelve_type = body.shelve_type;
    let shelving_time_ms = body.shelving_time_ms;

    let sc = tokio::task::spawn_blocking(move || {
        let (method_name, args) = match shelve_type.as_str() {
            "timed" => {
                let ms = shelving_time_ms.unwrap_or(3_600_000.0);
                ("TimedShelve", Some(vec![Variant::Double(ms)]))
            }
            "oneshot" => ("OneShotShelve", None),
            "unshelve" | _ => ("Unshelve", None),
        };

        let session_guard = session_arc.read();
        driver::call_alarm_method(&session_guard, &condition_node_id, method_name, args)
    })
    .await;

    match sc {
        Ok(status_code) => opc_status_to_response(status_code),
        Err(e) => {
            warn!(source_id = %source_id, error = %e, "spawn_blocking join error in alarm_shelve");
            StatusCode::INTERNAL_SERVER_ERROR.into_response()
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
