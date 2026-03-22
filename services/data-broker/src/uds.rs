use crate::{
    cache::ShadowCache,
    fanout::{fanout_batch, PendingMap},
    registry::{ClientId, SubscriptionRegistry},
    throttle::ThrottleLevel,
};
use chrono::Utc;
use dashmap::DashMap;
use io_bus::{decode_frame, SourceStatusChange, UdsFrame, WsServerMessage};
use std::sync::Arc;
use tokio::{
    io::AsyncReadExt,
    net::{UnixListener, UnixStream},
    sync::mpsc,
};
use tracing::{error, info, warn};

/// Spawn the UDS server. Accepts connections from OPC Service and dispatches
/// received frames to the fanout engine.
pub async fn run_uds_server(
    sock_path: String,
    cache: Arc<ShadowCache>,
    registry: Arc<SubscriptionRegistry>,
    connections: Arc<DashMap<ClientId, mpsc::Sender<WsServerMessage>>>,
    pending: PendingMap,
    deadband: f64,
    throttle_states: Arc<DashMap<ClientId, ThrottleLevel>>,
) {
    // Ensure parent directory exists.
    if let Some(parent) = std::path::Path::new(&sock_path).parent() {
        if let Err(e) = tokio::fs::create_dir_all(parent).await {
            error!(error = %e, path = %parent.display(), "Failed to create UDS socket directory");
        }
    }

    // Remove a stale socket file left from a previous run.
    let _ = tokio::fs::remove_file(&sock_path).await;

    let listener = match UnixListener::bind(&sock_path) {
        Ok(l) => {
            info!(path = %sock_path, "UDS server listening");
            l
        }
        Err(e) => {
            error!(error = %e, path = %sock_path, "Failed to bind UDS socket — point updates via UDS will be unavailable");
            return;
        }
    };

    loop {
        match listener.accept().await {
            Ok((stream, _addr)) => {
                info!("UDS connection accepted from OPC Service");
                let cache = Arc::clone(&cache);
                let registry = Arc::clone(&registry);
                let connections = Arc::clone(&connections);
                let pending = Arc::clone(&pending);
                let ts = Arc::clone(&throttle_states);
                tokio::spawn(handle_uds_connection(
                    stream, cache, registry, connections, pending, deadband, ts,
                ));
            }
            Err(e) => {
                error!(error = %e, "UDS accept error");
            }
        }
    }
}

async fn handle_uds_connection(
    mut stream: UnixStream,
    cache: Arc<ShadowCache>,
    registry: Arc<SubscriptionRegistry>,
    connections: Arc<DashMap<ClientId, mpsc::Sender<WsServerMessage>>>,
    pending: PendingMap,
    deadband: f64,
    throttle_states: Arc<DashMap<ClientId, ThrottleLevel>>,
) {
    let mut buf: Vec<u8> = Vec::with_capacity(65_536);
    let mut read_buf = [0u8; 16_384];

    loop {
        let n = match stream.read(&mut read_buf).await {
            Ok(0) => {
                info!("UDS connection closed by OPC Service");
                break;
            }
            Ok(n) => n,
            Err(e) => {
                error!(error = %e, "UDS read error");
                break;
            }
        };

        buf.extend_from_slice(&read_buf[..n]);

        // Decode all complete frames from the accumulated buffer.
        loop {
            match decode_frame(&buf) {
                Ok(Some((frame, consumed))) => {
                    dispatch_frame(
                        frame,
                        &cache,
                        &registry,
                        &connections,
                        &pending,
                        deadband,
                        &throttle_states,
                    )
                    .await;
                    buf.drain(..consumed);
                }
                Ok(None) => break, // Need more data.
                Err(e) => {
                    warn!(error = %e, "UDS frame decode error — discarding buffer");
                    buf.clear();
                    break;
                }
            }
        }
    }
}

async fn dispatch_frame(
    frame: UdsFrame,
    cache: &ShadowCache,
    registry: &SubscriptionRegistry,
    connections: &DashMap<ClientId, mpsc::Sender<WsServerMessage>>,
    pending: &PendingMap,
    deadband: f64,
    throttle_states: &DashMap<ClientId, ThrottleLevel>,
) {
    match frame {
        UdsFrame::Data(batch) => {
            fanout_batch(&batch, cache, registry, connections, pending, deadband, throttle_states);
        }
        UdsFrame::Status(status) => {
            let now = Utc::now().to_rfc3339();
            // We don't have source names in the UDS frame — use the UUID as a
            // placeholder. A richer lookup could join against the DB if needed.
            let source_name = status.source_id.to_string();

            let msg = match status.status {
                SourceStatusChange::Online => WsServerMessage::SourceOnline {
                    source_id: status.source_id,
                    source_name: source_name.clone(),
                    timestamp: now,
                },
                SourceStatusChange::Offline => {
                    // Mark all cached points stale — we don't know which points
                    // belong to this source here, so staleness sweep will catch them.
                    // However we do broadcast source_offline to all clients.
                    WsServerMessage::SourceOffline {
                        source_id: status.source_id,
                        source_name: source_name.clone(),
                        timestamp: now,
                    }
                }
            };

            // Broadcast to ALL connected clients.
            let mut dead_clients = Vec::new();
            for entry in connections.iter() {
                if entry.value().try_send(msg.clone()).is_err() {
                    dead_clients.push(*entry.key());
                }
            }
            for client_id in dead_clients {
                connections.remove(&client_id);
            }
        }
    }
}
