use crate::{
    cache::ShadowCache,
    registry::{ClientId, SubscriptionRegistry},
};
use chrono::{TimeZone, Utc};
use dashmap::DashMap;
use io_bus::{UdsPointBatch, WsBatchUpdate, WsPointValue, WsServerMessage};
use std::{
    collections::HashMap,
    sync::Arc,
    time::Instant,
};
use tokio::sync::mpsc;
use tracing::debug;

// ---------------------------------------------------------------------------
// Per-client pending accumulator.
// ---------------------------------------------------------------------------

/// Shared accumulator: client_id → pending WsPointValue updates not yet flushed.
///
/// `fanout_batch` appends here; `run_fanout_flusher` drains here on each tick.
pub type PendingMap = Arc<DashMap<ClientId, Vec<WsPointValue>>>;

/// Per-client last-fanout timestamp (epoch seconds as `Instant` relative).
/// Updated by the flusher each time it actually sends a non-empty batch to a
/// client. Used by the heartbeat task to detect max-silence violations.
pub type LastFanoutMap = Arc<DashMap<ClientId, std::time::SystemTime>>;

// ---------------------------------------------------------------------------
// fanout_batch — change-only + deadband, then enqueue into accumulator.
// ---------------------------------------------------------------------------

/// Process a batch of point updates.
///
/// For each point:
/// 1. Compare against the cached value (shadow cache comparison).
/// 2. Apply deadband filtering: if the absolute change is ≤ `|prev| × deadband`
///    the update is suppressed.
/// 3. If the update passes, push it into the per-client accumulator. The
///    `run_fanout_flusher` task will drain the accumulator and send batches.
pub fn fanout_batch(
    batch: &UdsPointBatch,
    cache: &ShadowCache,
    registry: &SubscriptionRegistry,
    pending: &DashMap<ClientId, Vec<WsPointValue>>,
    deadband: f64,
) {
    // Per-call staging map: point → WsPointValue (deduplication within batch).
    let mut per_client: HashMap<ClientId, Vec<WsPointValue>> = HashMap::new();

    for point_update in &batch.points {
        let timestamp = Utc
            .timestamp_millis_opt(point_update.timestamp)
            .single()
            .unwrap_or_else(Utc::now);

        let quality_str = point_update.quality.as_str().to_string();
        let new_value = point_update.value;

        // Update shadow cache; returns the previous CachedValue if present.
        let prev = cache.update(
            point_update.point_id,
            new_value,
            quality_str.clone(),
            timestamp,
        );

        // --- Change-only / deadband gate ---
        if let Some(ref prev) = prev {
            let delta = (new_value - prev.value).abs();
            // Relative deadband: suppress if delta ≤ |prev| × deadband.
            // When deadband == 0.0 this branch never suppresses (delta > 0 or
            // they are identical, handled by exact-equality check below).
            let band = prev.value.abs() * deadband;
            if delta <= band {
                // Value within deadband — skip fanout.
                debug!(
                    point_id = %point_update.point_id,
                    delta,
                    band,
                    "Suppressed update within deadband"
                );
                continue;
            }
            // Exact equality check (delta == 0.0 and deadband == 0.0):
            // quality or timestamp may differ, but if the numeric value and
            // quality string are identical there is nothing new to show.
            if delta == 0.0 && quality_str == prev.quality {
                debug!(
                    point_id = %point_update.point_id,
                    "Suppressed unchanged update (change-only)"
                );
                continue;
            }
        }

        let pv = WsPointValue {
            id: point_update.point_id,
            v: new_value,
            q: quality_str,
            t: point_update.timestamp,
        };

        let client_ids = registry.get_clients_for_point(&point_update.point_id);
        for client_id in client_ids {
            per_client.entry(client_id).or_default().push(pv.clone());
        }
    }

    // Merge the per-call map into the shared accumulator.
    for (client_id, points) in per_client {
        pending.entry(client_id).or_default().extend(points);
    }
}

// ---------------------------------------------------------------------------
// Flusher task — drains accumulator, staggered delivery.
// ---------------------------------------------------------------------------

/// Background task that drains the per-client accumulator every
/// `batch_window_ms` milliseconds and sends one `WsServerMessage::Update`
/// per client.
///
/// Staggered fanout: clients are sorted by a stable key (their UUID) and each
/// one is offset within the window by `index × (window / count)` so that CPU
/// work is spread across the interval rather than spiking at the boundary.
pub async fn run_fanout_flusher(
    batch_window_ms: u64,
    pending: PendingMap,
    connections: Arc<DashMap<ClientId, mpsc::Sender<WsServerMessage>>>,
    last_fanout: LastFanoutMap,
) {
    let window = tokio::time::Duration::from_millis(batch_window_ms);

    loop {
        tokio::time::sleep(window).await;

        // Collect clients that have pending updates.
        let mut clients_with_work: Vec<ClientId> = pending
            .iter()
            .filter(|entry| !entry.value().is_empty())
            .map(|entry| *entry.key())
            .collect();

        if clients_with_work.is_empty() {
            continue;
        }

        // Sort for stable stagger ordering.
        clients_with_work.sort_unstable();

        let count = clients_with_work.len() as u64;
        let stagger_ms = if count > 1 { batch_window_ms / count } else { 0 };

        let flush_start = Instant::now();

        for (idx, client_id) in clients_with_work.iter().enumerate() {
            // Apply stagger delay (skip for first client).
            let target_offset_ms = idx as u64 * stagger_ms;
            let elapsed_ms = flush_start.elapsed().as_millis() as u64;
            if target_offset_ms > elapsed_ms {
                let delay = target_offset_ms - elapsed_ms;
                tokio::time::sleep(tokio::time::Duration::from_millis(delay)).await;
            }

            // Drain this client's pending updates atomically.
            let points = match pending.get_mut(client_id) {
                Some(mut entry) => {
                    if entry.is_empty() {
                        continue;
                    }
                    std::mem::take(&mut *entry)
                }
                None => continue,
            };

            if points.is_empty() {
                continue;
            }

            if let Some(tx) = connections.get(client_id) {
                let msg = WsServerMessage::Update(WsBatchUpdate { points });
                if tx.try_send(msg).is_ok() {
                    // Record last successful fanout timestamp.
                    last_fanout.insert(*client_id, std::time::SystemTime::now());
                }
                // If try_send fails, the channel is full or closed; the ws
                // task will clean up stale connections on its own.
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Heartbeat task — max-silence re-send.
// ---------------------------------------------------------------------------

/// Background task that re-sends the current cached value for any point that
/// has not been fanned out in `max_silence_secs` seconds, so clients know
/// the connection is alive and the value is still valid.
///
/// The sweep runs every `max_silence_secs / 2` seconds. For each point in
/// the shadow cache that has active subscribers and whose last-seen timestamp
/// is older than `max_silence_secs`, the current value is pushed into the
/// pending accumulator (the flusher will deliver it on the next tick).
pub async fn run_heartbeat_task(
    max_silence_secs: u64,
    cache: Arc<ShadowCache>,
    registry: Arc<SubscriptionRegistry>,
    pending: PendingMap,
) {
    // Sweep at half the silence window so we never miss a window.
    let sweep_interval = tokio::time::Duration::from_secs(max_silence_secs / 2).max(
        tokio::time::Duration::from_secs(1),
    );
    let silence_dur = chrono::Duration::seconds(max_silence_secs as i64);

    loop {
        tokio::time::sleep(sweep_interval).await;

        let threshold = Utc::now() - silence_dur;

        // Iterate all cached points and find those older than the threshold.
        // `find_stale` filters already-stale points; we need a different scan.
        // We iterate directly via the cache's all_entries helper.
        let silent_points = cache.find_silent(threshold);

        for (point_id, cached) in silent_points {
            let client_ids = registry.get_clients_for_point(&point_id);
            if client_ids.is_empty() {
                continue;
            }

            debug!(
                point_id = %point_id,
                "Sending max-silence heartbeat"
            );

            let pv = WsPointValue {
                id: point_id,
                v: cached.value,
                q: cached.quality,
                t: cached.timestamp.timestamp_millis(),
            };

            for client_id in client_ids {
                pending
                    .entry(client_id)
                    .or_default()
                    .push(pv.clone());
            }
        }
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

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

    fn make_pending() -> PendingMap {
        Arc::new(DashMap::new())
    }

    // -----------------------------------------------------------------------
    // Helpers to flush pending into channels (simulating flusher in unit tests)
    // -----------------------------------------------------------------------

    /// Drain the accumulator for `client_id` and send one batched Update.
    fn flush_to_channel(
        client_id: ClientId,
        pending: &PendingMap,
        tx: &mpsc::Sender<WsServerMessage>,
    ) {
        if let Some(mut entry) = pending.get_mut(&client_id) {
            if !entry.is_empty() {
                let points = std::mem::take(&mut *entry);
                let msg = WsServerMessage::Update(WsBatchUpdate { points });
                let _ = tx.try_send(msg);
            }
        }
    }

    /// fanout_batch must deliver one Update to every subscribed client
    /// (via the pending accumulator → manual flush).
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

        let pending = make_pending();

        let batch = make_batch(point, 42.5, PointQuality::Good);
        fanout_batch(&batch, &cache, &registry, &pending, 0.0);

        flush_to_channel(c1, &pending, &tx1);
        flush_to_channel(c2, &pending, &tx2);

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

    /// fanout_batch must not deliver messages to unsubscribed clients.
    #[tokio::test]
    async fn fanout_does_not_deliver_to_unsubscribed_clients() {
        let point = Uuid::new_v4();
        let other_point = Uuid::new_v4();
        let cache = ShadowCache::new();
        let registry = SubscriptionRegistry::new();

        let c1 = Uuid::new_v4();
        registry.subscribe(c1, &[other_point], 1000);

        let (tx1, mut rx1) = mpsc::channel::<WsServerMessage>(4);
        let pending = make_pending();

        let batch = make_batch(point, 1.0, PointQuality::Good);
        fanout_batch(&batch, &cache, &registry, &pending, 0.0);
        flush_to_channel(c1, &pending, &tx1);

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
        let pending = make_pending();

        let batch = make_batch(point, 99.9, PointQuality::Good);
        fanout_batch(&batch, &cache, &registry, &pending, 0.0);

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
        let pending = make_pending();

        let batch = make_batch(point, 0.0, PointQuality::Bad);
        fanout_batch(&batch, &cache, &registry, &pending, 0.0);
        flush_to_channel(client, &pending, &tx);

        match rx.try_recv() {
            Ok(WsServerMessage::Update(WsBatchUpdate { points })) => {
                assert_eq!(points.len(), 1);
                assert_eq!(points[0].q, "bad", "Bad quality must be forwarded as 'bad'");
            }
            other => panic!("Expected Update, got: {:?}", other),
        }
    }

    // -----------------------------------------------------------------------
    // Change-only filtering tests
    // -----------------------------------------------------------------------

    /// A second identical update for the same point must be suppressed.
    #[tokio::test]
    async fn fanout_suppresses_unchanged_value() {
        let point = Uuid::new_v4();
        let cache = ShadowCache::new();
        let registry = SubscriptionRegistry::new();

        let client = Uuid::new_v4();
        registry.subscribe(client, &[point], 1000);

        let (tx, mut rx) = mpsc::channel::<WsServerMessage>(4);
        let pending = make_pending();

        // First update — must pass through.
        let batch1 = make_batch(point, 10.0, PointQuality::Good);
        fanout_batch(&batch1, &cache, &registry, &pending, 0.0);
        flush_to_channel(client, &pending, &tx);
        assert!(rx.try_recv().is_ok(), "First update must reach client");

        // Second identical update — must be suppressed.
        let batch2 = make_batch(point, 10.0, PointQuality::Good);
        fanout_batch(&batch2, &cache, &registry, &pending, 0.0);
        flush_to_channel(client, &pending, &tx);
        assert!(
            rx.try_recv().is_err(),
            "Identical second update must be suppressed by change-only filter"
        );
    }

    /// A changed value must always be delivered even when a deadband is set,
    /// as long as the change exceeds the band.
    #[tokio::test]
    async fn fanout_delivers_when_exceeds_deadband() {
        let point = Uuid::new_v4();
        let cache = ShadowCache::new();
        let registry = SubscriptionRegistry::new();

        let client = Uuid::new_v4();
        registry.subscribe(client, &[point], 1000);

        let (tx, mut rx) = mpsc::channel::<WsServerMessage>(4);
        let pending = make_pending();

        // Seed the cache with value 100.0.
        let batch1 = make_batch(point, 100.0, PointQuality::Good);
        fanout_batch(&batch1, &cache, &registry, &pending, 0.01); // 1% deadband
        flush_to_channel(client, &pending, &tx);
        let _ = rx.try_recv(); // consume first

        // New value 105.0 — delta = 5.0, band = 100.0 * 0.01 = 1.0 → exceeds band.
        let batch2 = make_batch(point, 105.0, PointQuality::Good);
        fanout_batch(&batch2, &cache, &registry, &pending, 0.01);
        flush_to_channel(client, &pending, &tx);
        assert!(
            rx.try_recv().is_ok(),
            "Update exceeding deadband must be delivered"
        );
    }

    /// A change within the deadband must be suppressed.
    #[tokio::test]
    async fn fanout_suppresses_within_deadband() {
        let point = Uuid::new_v4();
        let cache = ShadowCache::new();
        let registry = SubscriptionRegistry::new();

        let client = Uuid::new_v4();
        registry.subscribe(client, &[point], 1000);

        let (tx, mut rx) = mpsc::channel::<WsServerMessage>(4);
        let pending = make_pending();

        // Seed cache with 100.0.
        let batch1 = make_batch(point, 100.0, PointQuality::Good);
        fanout_batch(&batch1, &cache, &registry, &pending, 0.01); // 1% deadband
        flush_to_channel(client, &pending, &tx);
        let _ = rx.try_recv(); // consume first

        // New value 100.5 — delta = 0.5, band = 100.0 * 0.01 = 1.0 → within band.
        let batch2 = make_batch(point, 100.5, PointQuality::Good);
        fanout_batch(&batch2, &cache, &registry, &pending, 0.01);
        flush_to_channel(client, &pending, &tx);
        assert!(
            rx.try_recv().is_err(),
            "Update within deadband must be suppressed"
        );
    }
}
