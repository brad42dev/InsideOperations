use crate::{
    cache::ShadowCache,
    registry::{ClientId, SubscriptionRegistry},
};
use chrono::{TimeZone, Utc};
use dashmap::DashMap;
use io_bus::{UdsPointBatch, WsBatchUpdate, WsPointValue, WsServerMessage};
use std::collections::HashMap;
use tokio::sync::mpsc;

/// Process a batch of point updates: update the shadow cache and deliver
/// `WsServerMessage::Update` messages to all subscribed clients.
///
/// Points are batched per-client so each client receives a single
/// `WsServerMessage::Update(WsBatchUpdate)` containing all points relevant
/// to that client rather than one message per point.
pub async fn fanout_batch(
    batch: &UdsPointBatch,
    cache: &ShadowCache,
    registry: &SubscriptionRegistry,
    connections: &DashMap<ClientId, mpsc::Sender<WsServerMessage>>,
) {
    // Per-client accumulator: client_id → Vec<WsPointValue>
    let mut per_client: HashMap<ClientId, Vec<WsPointValue>> = HashMap::new();

    for point_update in &batch.points {
        let timestamp = Utc
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

        let pv = WsPointValue {
            id: point_update.point_id,
            v: point_update.value,
            q: quality_str,
            t: point_update.timestamp,
        };

        let client_ids = registry.get_clients_for_point(&point_update.point_id);
        for client_id in client_ids {
            per_client.entry(client_id).or_default().push(pv.clone());
        }
    }

    // Send one batched Update per client.
    for (client_id, points) in per_client {
        if let Some(tx) = connections.get(&client_id) {
            let msg = WsServerMessage::Update(WsBatchUpdate { points });
            // Use try_send — drop the message rather than blocking if the
            // client's channel is full.
            if tx.try_send(msg).is_err() {
                // Channel full or closed — the ws task will clean up on its own.
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use io_bus::{PointQuality, UdsPointUpdate, WsBatchUpdate};
    use uuid::Uuid;

    fn make_batch(point_id: Uuid, value: f64, quality: PointQuality) -> UdsPointBatch {
        let ts_ms = chrono::Utc::now().timestamp_millis();
        UdsPointBatch {
            source_id: Uuid::new_v4(),
            points: vec![UdsPointUpdate {
                point_id,
                value,
                quality,
                timestamp: ts_ms,
            }],
        }
    }

    /// fanout_batch must deliver one Update message to every client subscribed
    /// to the point in the batch.
    #[tokio::test]
    async fn fanout_delivers_update_to_all_subscribed_clients() {
        let point = Uuid::new_v4();
        let cache = ShadowCache::new();
        let registry = SubscriptionRegistry::new();

        let c1 = Uuid::new_v4();
        let c2 = Uuid::new_v4();
        registry.subscribe(c1, &[point], 1000);
        registry.subscribe(c2, &[point], 1000);

        let (tx1, mut rx1) = mpsc::channel::<WsServerMessage>(4);
        let (tx2, mut rx2) = mpsc::channel::<WsServerMessage>(4);

        let connections: DashMap<ClientId, mpsc::Sender<WsServerMessage>> = DashMap::new();
        connections.insert(c1, tx1);
        connections.insert(c2, tx2);

        let batch = make_batch(point, 42.5, PointQuality::Good);
        fanout_batch(&batch, &cache, &registry, &connections).await;

        let msg1 = rx1.try_recv().expect("client 1 must receive an Update");
        let msg2 = rx2.try_recv().expect("client 2 must receive an Update");

        match (msg1, msg2) {
            (
                WsServerMessage::Update(WsBatchUpdate { points: pts1 }),
                WsServerMessage::Update(WsBatchUpdate { points: pts2 }),
            ) => {
                assert_eq!(pts1.len(), 1);
                assert_eq!(pts2.len(), 1);
                assert_eq!(pts1[0].id, point);
                assert_eq!(pts2[0].id, point);
                assert!((pts1[0].v - 42.5).abs() < f64::EPSILON);
                assert!((pts2[0].v - 42.5).abs() < f64::EPSILON);
                assert_eq!(pts1[0].q, "good");
                assert_eq!(pts2[0].q, "good");
            }
            other => panic!("Expected Update messages, got: {:?}", other),
        }
    }

    /// fanout_batch must not deliver messages to clients NOT subscribed to the point.
    #[tokio::test]
    async fn fanout_does_not_deliver_to_unsubscribed_clients() {
        let point = Uuid::new_v4();
        let other_point = Uuid::new_v4();
        let cache = ShadowCache::new();
        let registry = SubscriptionRegistry::new();

        let c1 = Uuid::new_v4();
        // c1 subscribes to other_point, NOT to point.
        registry.subscribe(c1, &[other_point], 1000);

        let (tx1, mut rx1) = mpsc::channel::<WsServerMessage>(4);
        let connections: DashMap<ClientId, mpsc::Sender<WsServerMessage>> = DashMap::new();
        connections.insert(c1, tx1);

        let batch = make_batch(point, 1.0, PointQuality::Good);
        fanout_batch(&batch, &cache, &registry, &connections).await;

        assert!(
            rx1.try_recv().is_err(),
            "Unsubscribed client must not receive any message"
        );
    }

    /// fanout_batch must update the shadow cache so the latest value is visible.
    #[tokio::test]
    async fn fanout_updates_shadow_cache() {
        let point = Uuid::new_v4();
        let cache = ShadowCache::new();
        let registry = SubscriptionRegistry::new();
        let connections: DashMap<ClientId, mpsc::Sender<WsServerMessage>> = DashMap::new();

        let batch = make_batch(point, 99.9, PointQuality::Good);
        fanout_batch(&batch, &cache, &registry, &connections).await;

        let entry = cache.get(&point).expect("Cache must have entry after fanout");
        assert!((entry.value - 99.9).abs() < f64::EPSILON);
        assert_eq!(entry.quality, "good");
        assert!(!entry.stale);
    }

    /// fanout_batch with Bad quality must propagate that quality string.
    #[tokio::test]
    async fn fanout_propagates_bad_quality_to_subscribers() {
        let point = Uuid::new_v4();
        let cache = ShadowCache::new();
        let registry = SubscriptionRegistry::new();

        let client = Uuid::new_v4();
        registry.subscribe(client, &[point], 1000);

        let (tx, mut rx) = mpsc::channel::<WsServerMessage>(4);
        let connections: DashMap<ClientId, mpsc::Sender<WsServerMessage>> = DashMap::new();
        connections.insert(client, tx);

        let batch = make_batch(point, 0.0, PointQuality::Bad);
        fanout_batch(&batch, &cache, &registry, &connections).await;

        match rx.try_recv() {
            Ok(WsServerMessage::Update(WsBatchUpdate { points })) => {
                assert_eq!(points.len(), 1);
                assert_eq!(points[0].q, "bad", "Bad quality must be forwarded as 'bad'");
            }
            other => panic!("Expected Update, got: {:?}", other),
        }
    }
}
