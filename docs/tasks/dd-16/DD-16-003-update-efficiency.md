---
id: DD-16-003
title: Implement update efficiency: change-only fanout, deadband, max-silence heartbeat, batching, and staggered fanout
unit: DD-16
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The broker should not fan out a point update if the value is unchanged from the cached value (change-only delivery). Per-point deadband filtering should suppress updates where the value changed by less than a configurable threshold. If a point has not sent an update in N seconds (default 60s), the broker should re-send the current cached value as a heartbeat so clients know the connection is alive. Updates should be accumulated over a short window (default 250ms) and sent as a batch rather than individually per message. Fanout should be staggered across clients within the window to smooth CPU spikes.

## Spec Excerpt (verbatim)

> 1. Shadow cache comparison: On receiving a point update, compare against the cached value. If unchanged, skip fanout.
> 2. Deadband filtering: Configurable per-point (admin sets in point configuration). If value changes by less than the deadband threshold (e.g., 0.1%), treat as unchanged.
> 3. Max-silence heartbeat: If a point hasn't sent an update in N seconds (configurable, default 60s), send the current value anyway so the client knows the connection is alive and the value is still valid.
> 4. Batched delivery: Accumulate updates over a short window (default 250ms) and send one JSON array message per batch.
> 5. Staggered fanout: Spread batches across the interval per-client (Client A at 0ms, Client B at 50ms, etc.) to smooth CPU spikes on the broker.
> — design-docs/16_REALTIME_WEBSOCKET.md, §Update Efficiency / Change-Only Delivery

## Where to Look in the Codebase

Primary files:
- `services/data-broker/src/fanout.rs:18–51` — current fanout: updates cache, then immediately sends `WsServerMessage::Update` for every incoming update with no change detection
- `services/data-broker/src/cache.rs:24–40` — `ShadowCache::update`: overwrites unconditionally; no old-value return
- `services/data-broker/src/config.rs` — batch window interval and heartbeat interval should be added here
- `services/data-broker/src/main.rs` — heartbeat task for max-silence would be spawned here

## Verification Checklist

- [ ] `fanout_batch` reads the existing cached value before calling `cache.update`; if new value equals old value (within deadband), skips fanout for that point
- [ ] `ShadowCache` exposes a method to get the current value before update (or `update` returns the old value for comparison)
- [ ] A batching layer exists: updates are accumulated in a per-client pending map over a `batch_window_ms` interval before being sent
- [ ] The batch window interval is configurable in `config.rs` (default 250ms)
- [ ] A max-silence heartbeat task runs periodically and sends the current cached value for points that have not had a fanout in the configured silence window
- [ ] Staggered fanout: client fanouts are offset within the batch window (e.g., by `client_index * (batch_window / client_count)` ms)

## Assessment

- **Status**: ❌ Missing
- **If partial/missing**: `fanout.rs:18–51` calls `cache.update` then immediately constructs and sends `WsServerMessage::Update` for every incoming point in the batch with no deduplication, no deadband check, no buffering window, and no stagger. The cache `update` method at `cache.rs:24` simply inserts without returning the old value.

## Fix Instructions

This requires refactoring `fanout_batch` and adding a batching layer.

**Step 1 — Change-only detection in `cache.rs`**

Modify `ShadowCache::update` to return the previous value so callers can compare:

```rust
pub fn update(&self, point_id: Uuid, value: f64, quality: String, timestamp: DateTime<Utc>) -> Option<CachedValue> {
    self.inner.insert(point_id, CachedValue { value, quality, timestamp, stale: false })
    // insert returns the previous value if present
}
```

**Step 2 — Deadband check in `fanout.rs`**

Before queueing an update for fanout:

```rust
let prev = cache.update(point_id, new_value, quality, timestamp);
if let Some(prev) = prev {
    let deadband = lookup_deadband(point_id); // from config or points table
    if (new_value - prev.value).abs() <= prev.value.abs() * deadband {
        continue; // skip fanout
    }
}
```

For Phase 1, a global deadband of 0.0 (off) is acceptable; the hook for per-point deadband needs to exist.

**Step 3 — Batching accumulator**

Replace the immediate `try_send` in `fanout.rs` with a per-client accumulator (a `DashMap<ClientId, Vec<WsServerMessage>>`). A background task (spawned in `main.rs`) flushes each client's accumulated updates every `batch_window_ms` milliseconds, serializing all pending updates into a single JSON array message.

Note: this requires extending `WsServerMessage` or using a wrapper type for batched delivery (`{"type":"batch","updates":[...]}`). Check doc 37 for the canonical batch message format before defining it.

**Step 4 — Max-silence heartbeat**

Add a configurable `max_silence_secs` to `config.rs` (default 60). Spawn a task in `main.rs` that runs every `max_silence_secs / 2` seconds. For each point in the shadow cache, if `Utc::now() - last_update > max_silence` and the point has active subscribers, push the current cached value into their accumulator as a regular `Update`.

**Step 5 — Staggered fanout**

In the flush task (Step 3), sort clients by index and offset each client's flush by `client_index * (batch_window_ms / client_count)` within the batch window.

Do NOT:
- Implement stagger before the batching layer exists (Step 3 is prerequisite)
- Make the deadband check block the hot path with a DB query — deadband values must be pre-cached in memory at startup
- Change the `WsServerMessage` format in `io-bus` without checking doc 37 for canonical wire format
