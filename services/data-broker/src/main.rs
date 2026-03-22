use axum::{routing::{get, post}, Router};
use cache::ShadowCache;
use dashmap::DashMap;
use fanout::{LastFanoutMap, PendingMap};
use registry::SubscriptionRegistry;
use state::AppState;
use std::{
    collections::HashSet,
    net::SocketAddr,
    sync::{atomic::AtomicBool, Arc},
};
use tower_http::catch_panic::CatchPanicLayer;
use tracing::info;

mod broadcast;
mod cache;
mod config;
mod fanout;
mod notify;
mod publish;
mod registry;
mod staleness;
mod state;
mod throttle;
mod uds;
mod ws;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();

    let obs = io_observability::init(io_observability::ObservabilityConfig {
        service_name: "data-broker",
        service_version: env!("CARGO_PKG_VERSION"),
        log_level: "info",
        metrics_enabled: true,
        tracing_enabled: false,
    })?;
    obs.start_watchdog_keepalive();

    info!(service = "data-broker", "Starting up");

    let cfg = Arc::new(config::Config::from_env()?);

    // Connect to the database.
    let db = io_db::create_pool(&cfg.database_url).await?;
    info!("Database pool established");

    // Build shadow cache and warm from points_current.
    let shadow_cache = Arc::new(ShadowCache::new());
    warm_cache(&shadow_cache, &db).await;

    let registry = Arc::new(SubscriptionRegistry::new());
    let connections: Arc<DashMap<_, _>> = Arc::new(DashMap::new());
    let user_connections: Arc<DashMap<uuid::Uuid, HashSet<uuid::Uuid>>> = Arc::new(DashMap::new());

    // Shared per-client update accumulator (filled by fanout_batch, drained by flusher).
    let pending: PendingMap = Arc::new(DashMap::new());
    // Per-client last-fanout timestamps (updated by flusher, read by heartbeat).
    let last_fanout: LastFanoutMap = Arc::new(DashMap::new());

    // Per-client throttle level map (filled by StatusReport handler in ws.rs).
    let throttle_states: Arc<DashMap<_, _>> = Arc::new(DashMap::new());
    // Global throttle flag — set when >30% of clients are above Normal level.
    let global_throttle_active = Arc::new(AtomicBool::new(false));

    let state = AppState {
        config: Arc::clone(&cfg),
        cache: Arc::clone(&shadow_cache),
        registry: Arc::clone(&registry),
        connections: Arc::clone(&connections),
        user_connections: Arc::clone(&user_connections),
        http_client: reqwest::Client::new(),
        throttle_states: Arc::clone(&throttle_states),
        global_throttle_active: Arc::clone(&global_throttle_active),
    };

    // Spawn UDS server.
    {
        let sock = cfg.opc_broker_sock.clone();
        let c = Arc::clone(&shadow_cache);
        let r = Arc::clone(&registry);
        let cx = Arc::clone(&connections);
        let p = Arc::clone(&pending);
        let db = cfg.fanout_deadband;
        let ts = Arc::clone(&throttle_states);
        tokio::spawn(uds::run_uds_server(sock, c, r, cx, p, db, ts));
    }

    // Spawn NOTIFY/LISTEN listener (point_updates fallback + export_complete).
    {
        let db2 = db.clone();
        let c = Arc::clone(&shadow_cache);
        let r = Arc::clone(&registry);
        let p = Arc::clone(&pending);
        let db_val = cfg.fanout_deadband;
        let cx = Arc::clone(&connections);
        let uc = Arc::clone(&user_connections);
        let ts = Arc::clone(&throttle_states);
        tokio::spawn(notify::run_notify_listener(db2, c, r, p, db_val, cx, uc, ts));
    }

    // Spawn batched fanout flusher.
    {
        let p = Arc::clone(&pending);
        let cx = Arc::clone(&connections);
        let lf = Arc::clone(&last_fanout);
        let bw = cfg.batch_window_ms;
        let ts = Arc::clone(&throttle_states);
        let gta = Arc::clone(&global_throttle_active);
        let gdb = cfg.throttle_global_deadband;
        tokio::spawn(fanout::run_fanout_flusher(bw, p, cx, lf, ts, gta, gdb));
    }

    // Spawn max-silence heartbeat task.
    {
        let c = Arc::clone(&shadow_cache);
        let r = Arc::clone(&registry);
        let p = Arc::clone(&pending);
        let ms = cfg.max_silence_secs;
        tokio::spawn(fanout::run_heartbeat_task(ms, c, r, p));
    }

    // Spawn staleness sweeper.
    {
        let c = Arc::clone(&shadow_cache);
        let r = Arc::clone(&registry);
        let cx = Arc::clone(&connections);
        tokio::spawn(staleness::run_staleness_sweeper(
            cfg.stale_threshold_secs,
            cfg.staleness_sweep_secs,
            c,
            r,
            cx,
        ));
    }

    // Spawn ping task — sends Ping to every connected client on schedule.
    {
        let cx = Arc::clone(&connections);
        let interval_secs = cfg.ping_interval_secs;
        tokio::spawn(async move {
            let interval = tokio::time::Duration::from_secs(interval_secs);
            loop {
                tokio::time::sleep(interval).await;
                let mut dead = Vec::new();
                for entry in cx.iter() {
                    if entry
                        .value()
                        .try_send(io_bus::WsServerMessage::Ping)
                        .is_err()
                    {
                        dead.push(*entry.key());
                    }
                }
                for client_id in dead {
                    cx.remove(&client_id);
                }
            }
        });
    }

    // Build axum router.
    let mut health = io_health::HealthRegistry::new("data-broker", env!("CARGO_PKG_VERSION"));
    health.register(io_health::PgDatabaseCheck::new(db.clone()));
    health.register(io_health::UnixSocketCheck::new(cfg.opc_broker_sock.clone()).non_critical());
    health.mark_startup_complete();

    // The WebSocket route needs AppState; health/metrics routes have no state.
    // Build with_state first, then nest stateless routers.
    let app = Router::new()
        .route("/ws", get(ws::ws_handler))
        .route("/internal/publish", post(publish::publish_handler))
        .route("/internal/broadcast", post(broadcast::broadcast_handler))
        .with_state(state)
        .merge(health.into_router())
        .merge(obs.metrics_router())
        .layer(CatchPanicLayer::new());

    let addr = SocketAddr::from(([0, 0, 0, 0], cfg.port));
    info!(service = "data-broker", addr = %addr, "Listening");

    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app)
        .with_graceful_shutdown(graceful_shutdown(Arc::clone(&connections)))
        .await?;

    Ok(())
}

async fn graceful_shutdown(
    connections: Arc<DashMap<registry::ClientId, tokio::sync::mpsc::Sender<io_bus::WsServerMessage>>>,
) {
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

    tracing::info!("Shutdown signal received — broadcasting server_restarting");

    // Broadcast to all connected clients.
    for entry in connections.iter() {
        let _ = entry.value().try_send(io_bus::WsServerMessage::ServerRestarting);
    }

    // Give clients up to 5 seconds to receive and act on the message.
    tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
    tracing::info!("Graceful shutdown drain complete");
}

/// Read all rows from `points_current` and populate the shadow cache.
async fn warm_cache(cache: &ShadowCache, db: &io_db::DbPool) {
    use sqlx::Row;

    let result = sqlx::query(
        "SELECT point_id, value, quality, timestamp, source_id FROM points_current",
    )
    .fetch_all(db)
    .await;

    match result {
        Ok(rows) => {
            let entries: Vec<_> = rows
                .into_iter()
                .filter_map(|row| {
                    let point_id: uuid::Uuid = row.try_get("point_id").ok()?;
                    let value: Option<f64> = row.try_get("value").ok()?;
                    let value = value?;
                    let quality: Option<String> = row.try_get("quality").ok().flatten();
                    let quality = quality.unwrap_or_else(|| "bad".to_string());
                    let timestamp: Option<chrono::DateTime<chrono::Utc>> =
                        row.try_get("timestamp").ok().flatten();
                    let timestamp = timestamp.unwrap_or_else(chrono::Utc::now);
                    let source_id: Option<uuid::Uuid> =
                        row.try_get("source_id").ok().flatten();
                    Some((
                        point_id,
                        cache::CachedValue {
                            value,
                            quality,
                            timestamp,
                            stale: false,
                            source_id,
                        },
                    ))
                })
                .collect();

            let count = entries.len();
            cache.warm(entries);
            info!(count, "Shadow cache warmed from points_current");
        }
        Err(e) => {
            tracing::warn!(
                error = %e,
                "Failed to warm shadow cache from points_current — starting empty"
            );
        }
    }
}
