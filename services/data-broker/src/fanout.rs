use crate::{
    cache::ShadowCache,
    registry::{ClientId, SubscriptionRegistry},
};
use chrono::{DateTime, TimeZone, Utc};
use dashmap::DashMap;
use io_bus::{UdsPointBatch, WsServerMessage};
use tokio::sync::mpsc;

/// Process a batch of point updates: update the shadow cache and deliver
/// `WsServerMessage::Update` messages to all subscribed clients.
pub async fn fanout_batch(
    batch: &UdsPointBatch,
    cache: &ShadowCache,
    registry: &SubscriptionRegistry,
    connections: &DashMap<ClientId, mpsc::Sender<WsServerMessage>>,
) {
    for point_update in &batch.points {
        let timestamp: DateTime<Utc> = Utc
            .timestamp_millis_opt(point_update.timestamp)
            .single()
            .unwrap_or_else(Utc::now);

        let quality_str = point_update.quality.as_str().to_string();

        // Update shadow cache (also clears any prior stale flag).
        cache.update(
            point_update.point_id,
            point_update.value,
            quality_str.clone(),
            timestamp,
        );

        let msg = WsServerMessage::Update {
            point_id: point_update.point_id,
            value: point_update.value,
            quality: quality_str,
            timestamp: timestamp.to_rfc3339(),
        };

        let client_ids = registry.get_clients_for_point(&point_update.point_id);
        for client_id in client_ids {
            if let Some(tx) = connections.get(&client_id) {
                // Use try_send — drop the message rather than blocking if the
                // client's channel is full.
                if tx.try_send(msg.clone()).is_err() {
                    // Channel full or closed — the ws task will clean up on its own.
                }
            }
        }
    }
}
