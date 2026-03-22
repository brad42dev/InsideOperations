use crate::{
    cache::ShadowCache,
    fanout::{fanout_batch, PendingMap},
    registry::{ClientId, SubscriptionRegistry},
    throttle::ThrottleLevel,
};
use chrono::DateTime;
use dashmap::DashMap;
use io_bus::{
    NotifyPointUpdates, PointQuality, UdsPointBatch, UdsPointUpdate, WsServerMessage,
};
use io_db::DbPool;
use std::collections::HashSet;
use std::sync::Arc;
use tokio::sync::mpsc;
use tracing::{error, info, warn};
use uuid::Uuid;

/// Listen on the PostgreSQL `point_updates` and `export_complete` NOTIFY channels.
///
/// `point_updates` is the NOTIFY fallback for when the OPC Service cannot reach
/// the UDS socket directly.
///
/// `export_complete` delivers targeted "your report is ready" notifications to
/// the user who requested the job, via that user's active WebSocket connections.
pub async fn run_notify_listener(
    db: DbPool,
    cache: Arc<ShadowCache>,
    registry: Arc<SubscriptionRegistry>,
    pending: PendingMap,
    deadband: f64,
    connections: Arc<DashMap<ClientId, mpsc::Sender<WsServerMessage>>>,
    user_connections: Arc<DashMap<Uuid, HashSet<ClientId>>>,
    throttle_states: Arc<DashMap<ClientId, ThrottleLevel>>,
) {
    let mut listener: sqlx::postgres::PgListener = match sqlx::postgres::PgListener::connect_with(&db).await {
        Ok(l) => l,
        Err(e) => {
            error!(error = %e, "Failed to create PgListener — NOTIFY fallback disabled");
            return;
        }
    };

    if let Err(e) = listener.listen("point_updates").await {
        error!(error = %e, "Failed to LISTEN on point_updates channel — NOTIFY fallback disabled");
        return;
    }

    if let Err(e) = listener.listen("export_complete").await {
        error!(error = %e, "Failed to LISTEN on export_complete channel — export notifications disabled");
        return;
    }

    info!("NOTIFY/LISTEN active on channels 'point_updates', 'export_complete'");

    loop {
        match listener.recv().await {
            Ok(notification) => {
                let channel = notification.channel();
                let payload = notification.payload();

                match channel {
                    "point_updates" => {
                        match serde_json::from_str::<NotifyPointUpdates>(payload) {
                            Ok(notify) => {
                                let batch = notify_to_batch(notify);
                                fanout_batch(
                                    &batch,
                                    &cache,
                                    &registry,
                                    &connections,
                                    &pending,
                                    deadband,
                                    &throttle_states,
                                );
                            }
                            Err(e) => {
                                warn!(error = %e, payload = %payload, "Failed to deserialize point_updates NOTIFY payload");
                            }
                        }
                    }
                    "export_complete" => {
                        handle_export_complete(
                            payload,
                            &db,
                            &connections,
                            &user_connections,
                        )
                        .await;
                    }
                    other => {
                        warn!(channel = %other, "Received NOTIFY on unexpected channel — ignoring");
                    }
                }
            }
            Err(e) => {
                error!(error = %e, "PgListener error — attempting reconnect");
                // sqlx PgListener handles reconnect internally on the next recv().
            }
        }
    }
}

/// Handle a notification on the `export_complete` channel.
///
/// Payload shape: `{"job_id": "<uuid>"}` (fired by api-gateway/src/handlers/reports.rs).
/// We look up the requesting user from `report_jobs`, then send a targeted
/// `export_complete` WS message to all of that user's active connections.
async fn handle_export_complete(
    payload: &str,
    db: &DbPool,
    connections: &DashMap<ClientId, mpsc::Sender<WsServerMessage>>,
    user_connections: &DashMap<Uuid, HashSet<ClientId>>,
) {
    // Parse the notify payload.
    let job_id: Uuid = match serde_json::from_str::<serde_json::Value>(payload)
        .ok()
        .and_then(|v| v.get("job_id").and_then(|j| j.as_str()).and_then(|s| s.parse::<Uuid>().ok()))
    {
        Some(id) => id,
        None => {
            warn!(payload = %payload, "export_complete NOTIFY payload missing or invalid job_id — ignoring");
            return;
        }
    };

    // Look up the user who requested this job.
    let user_id: Uuid = match sqlx::query_scalar::<_, Uuid>(
        "SELECT requested_by FROM report_jobs WHERE id = $1",
    )
    .bind(job_id)
    .fetch_optional(db)
    .await
    {
        Ok(Some(uid)) => uid,
        Ok(None) => {
            warn!(%job_id, "export_complete: no report_jobs row found for job — ignoring");
            return;
        }
        Err(e) => {
            error!(error = %e, %job_id, "export_complete: DB lookup failed");
            return;
        }
    };

    // Build the WS message.
    let msg = WsServerMessage::ExportComplete { job_id };

    // Find all client connections for this user and send.
    let client_ids: Vec<ClientId> = user_connections
        .get(&user_id)
        .map(|set| set.iter().copied().collect())
        .unwrap_or_default();

    let mut sent = 0usize;
    for client_id in &client_ids {
        if let Some(tx) = connections.get(client_id) {
            if tx.try_send(msg.clone()).is_ok() {
                sent += 1;
            }
        }
    }

    info!(
        %job_id,
        %user_id,
        clients_sent = sent,
        "export_complete: sent notification to user connections"
    );
}

/// Convert a `NotifyPointUpdates` message into the `UdsPointBatch` shape so
/// we can reuse the same fanout engine for both UDS and NOTIFY paths.
fn notify_to_batch(notify: NotifyPointUpdates) -> UdsPointBatch {
    let points = notify
        .points
        .into_iter()
        .map(|p| {
            // Parse the RFC 3339 timestamp into epoch milliseconds.
            let ts_ms = DateTime::parse_from_rfc3339(&p.ts)
                .map(|dt| dt.timestamp_millis())
                .unwrap_or_else(|_| chrono::Utc::now().timestamp_millis());

            let quality = match p.quality.as_str() {
                "good" => PointQuality::Good,
                "uncertain" => PointQuality::Uncertain,
                _ => PointQuality::Bad,
            };

            UdsPointUpdate {
                point_id: p.id,
                value: p.value,
                quality,
                timestamp: ts_ms,
            }
        })
        .collect();

    UdsPointBatch {
        source_id: notify.source_id,
        points,
    }
}
