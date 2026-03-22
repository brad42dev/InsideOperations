---
id: DD-16-006
title: Mark source-associated points stale immediately on source_offline
unit: DD-16
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

When the OPC Service reports that a source has gone offline, the broker should immediately mark all cached points belonging to that source as stale and send `point_stale` messages to all clients subscribed to those points. Currently the broker broadcasts `source_offline` but defers point staleness to the next periodic sweep (up to 10 seconds later), leaving clients with stale data displayed as current for up to a sweep interval.

## Spec Excerpt (verbatim)

> On `source_offline`, all points associated with that source are immediately marked stale in the shadow cache. Clients subscribed to those points receive `point_stale` messages.
> — design-docs/16_REALTIME_WEBSOCKET.md, §Stale Data and Source Status Messages / OPC Source Status

## Where to Look in the Codebase

Primary files:
- `services/data-broker/src/uds.rs:126–130` — `SourceStatusChange::Offline` arm: comment says "we don't know which points belong to this source here, so staleness sweep will catch them"; broadcasts `SourceOffline` to all clients but does not mark any points stale
- `services/data-broker/src/cache.rs` — `ShadowCache`: currently has no method to find or mark stale all points belonging to a given source; `CachedValue` struct does not track `source_id`
- `services/data-broker/src/staleness.rs` — `run_staleness_sweeper`: correctly sends `PointStale` on transition but runs on a periodic sweep, not on demand
- `services/data-broker/src/registry.rs` — subscription registry: tracks point → clients but not source → points

## Verification Checklist

- [ ] `ShadowCache` stores `source_id: Uuid` alongside each `CachedValue` (or there is a separate `source_to_points: DashMap<Uuid, HashSet<Uuid>>` in a companion structure)
- [ ] `ShadowCache` exposes a method `mark_source_stale(source_id: Uuid) -> Vec<(Uuid, DateTime<Utc>)>` that marks all points for that source stale and returns their (point_id, last_updated_at)
- [ ] The `SourceStatusChange::Offline` arm in `uds.rs` calls `cache.mark_source_stale(source_id)` and then fans out `WsServerMessage::PointStale` to subscribed clients for each returned point
- [ ] The fanout of `PointStale` messages in `uds.rs` uses the same subscription-aware delivery as `staleness.rs` (look up subscribers via `registry.get_clients_for_point`)

## Assessment

- **Status**: ⚠️ Wrong
- **If partial/missing**: `uds.rs:127–129` explicitly acknowledges the gap ("we don't know which points belong to this source here, so staleness sweep will catch them"). The shadow cache `CachedValue` struct at `cache.rs:6–11` contains no `source_id` field, so there is no mechanism to look up source-owned points. Points are eventually marked stale by the sweep (up to `staleness_sweep_secs`=10s later), but the spec requires it to happen immediately on `source_offline`.

## Fix Instructions

**Step 1 — Add source_id to CachedValue**

In `services/data-broker/src/cache.rs`, add `source_id: Option<Uuid>` to `CachedValue`:

```rust
pub struct CachedValue {
    pub value: f64,
    pub quality: String,
    pub timestamp: DateTime<Utc>,
    pub stale: bool,
    pub source_id: Option<Uuid>,  // which OPC source provides this point
}
```

Update `ShadowCache::update` to accept and store `source_id`:

```rust
pub fn update(&self, point_id: Uuid, value: f64, quality: String, timestamp: DateTime<Utc>, source_id: Option<Uuid>) -> bool {
    let was_stale = self.inner.get(&point_id).map(|v| v.stale).unwrap_or(false);
    self.inner.insert(point_id, CachedValue { value, quality, timestamp, stale: false, source_id });
    was_stale
}
```

Update the warm_cache call in `main.rs` and `fanout.rs` to pass `source_id`. In `fanout.rs`, the `UdsPointBatch` has a `source_id` field at the batch level — pass `Some(batch.source_id)` to each point's cache update.

**Step 2 — Add mark_source_stale to ShadowCache**

```rust
/// Immediately marks all points from `source_id` as stale.
/// Returns the list of (point_id, last_updated_at) for points that transitioned fresh→stale.
pub fn mark_source_stale(&self, source_id: Uuid) -> Vec<(Uuid, DateTime<Utc>)> {
    let mut transitioned = Vec::new();
    for mut entry in self.inner.iter_mut() {
        if entry.source_id == Some(source_id) && !entry.stale {
            entry.stale = true;
            transitioned.push((*entry.key(), entry.timestamp));
        }
    }
    transitioned
}
```

**Step 3 — Call mark_source_stale in uds.rs on SourceOffline**

Replace the comment in the `SourceStatusChange::Offline` arm with actual staleness marking:

```rust
SourceStatusChange::Offline => {
    // Immediately mark all source points stale
    let stale_points = cache.mark_source_stale(status.source_id);
    for (point_id, last_updated_at) in stale_points {
        let stale_msg = WsServerMessage::PointStale {
            point_id,
            last_updated_at: last_updated_at.to_rfc3339(),
        };
        let client_ids = registry.get_clients_for_point(&point_id);
        for client_id in client_ids {
            if let Some(tx) = connections.get(&client_id) {
                let _ = tx.try_send(stale_msg.clone());
            }
        }
    }
    WsServerMessage::SourceOffline { ... }
}
```

The `dispatch_frame` function in `uds.rs` needs `registry` in scope for the fanout. Note that `dispatch_frame` at line 104 already takes both `cache` and `connections` but not `registry`. Add `registry: &SubscriptionRegistry` as a parameter.

**Step 4 — Update warm_cache call**

In `main.rs:160`, the warm_cache SQL query does not fetch `source_id`. Update the query to `SELECT point_id, value, quality, timestamp, source_id FROM points_current` and pass `Some(source_id)` to the cache warm.

Do NOT:
- Remove or weaken the periodic staleness sweep — it still catches points whose source never explicitly disconnected (e.g., OPC point timeout without a source-offline event)
- Mark every cached point stale when any source goes offline — only points whose `source_id` matches
