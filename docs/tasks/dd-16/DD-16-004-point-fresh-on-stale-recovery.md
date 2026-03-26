---
id: DD-16-004
title: Emit point_fresh instead of regular update when a stale point receives a new value
unit: DD-16
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

When a point that has been marked stale (via the staleness sweep) receives a new value from the OPC Service, the broker should send a `point_fresh` message to all subscribed clients instead of a plain `update` message. This allows the client to clear any stale visual indicator (e.g., grayed-out value) and know that fresh data has arrived. Without this, clients have no way to distinguish a regular update from a stale-recovery event.

## Spec Excerpt (verbatim)

> When a previously stale point receives a new update, the broker sends `point_fresh` (which includes the new value) instead of a regular `update` message, so the client knows to clear the stale indicator
> — design-docs/16_REALTIME_WEBSOCKET.md, §Stale Data and Source Status Messages / Point Staleness

## Where to Look in the Codebase

Primary files:
- `services/data-broker/src/fanout.rs:18–51` — fanout loop: calls `cache.update` then always sends `WsServerMessage::Update`; never checks if the point was previously stale
- `services/data-broker/src/cache.rs:48–56` — `mark_stale` sets `entry.stale = true` and returns whether a transition occurred; `mark_fresh` at line 58 exists but is `#[allow(dead_code)]`
- `crates/io-bus/src/lib.rs:252–257` — `WsServerMessage::PointFresh` variant is defined but never constructed in the broker
- `services/data-broker/src/staleness.rs` — sweep marks points stale and sends `PointStale`; does not send `PointFresh`

## Verification Checklist

- [ ] `ShadowCache::update` (or a new `update_with_stale_check` method) returns whether the point was previously stale before the update
- [ ] `fanout.rs` checks the stale flag before selecting the message type: if previously stale → `WsServerMessage::PointFresh { point_id, value, timestamp }`, otherwise → `WsServerMessage::Update`
- [ ] `WsServerMessage::PointFresh` is serialized correctly: `{"type":"point_fresh","point_id":"...","value":...,"timestamp":"..."}`
- [ ] `cache.mark_fresh` is called (or the stale flag is cleared) when a new value arrives for a previously-stale point
- [ ] The `mark_fresh` function in `cache.rs` (currently `#[allow(dead_code)]`) is used in the fanout path

## Assessment

- **Status**: ❌ Missing
- **If partial/missing**: `fanout.rs:34` always constructs `WsServerMessage::Update` regardless of whether the point was stale. `WsServerMessage::PointFresh` is defined in `io-bus` at line 252 but is never instantiated anywhere in the broker codebase. `cache.mark_fresh` at `cache.rs:58` is dead code.

## Fix Instructions

In `services/data-broker/src/cache.rs`, modify `update` to return the previous stale state:

```rust
/// Returns `true` if the point was previously marked stale (stale-recovery transition).
pub fn update(&self, point_id: Uuid, value: f64, quality: String, timestamp: DateTime<Utc>) -> bool {
    let was_stale = self.inner
        .get(&point_id)
        .map(|v| v.stale)
        .unwrap_or(false);
    self.inner.insert(point_id, CachedValue { value, quality, timestamp, stale: false });
    was_stale
}
```

In `services/data-broker/src/fanout.rs`, replace the hardcoded `WsServerMessage::Update` construction:

```rust
let was_stale = cache.update(point_update.point_id, point_update.value, quality_str.clone(), timestamp);

let msg = if was_stale {
    WsServerMessage::PointFresh {
        point_id: point_update.point_id,
        value: point_update.value,
        timestamp: timestamp.to_rfc3339(),
    }
} else {
    WsServerMessage::Update {
        point_id: point_update.point_id,
        value: point_update.value,
        quality: quality_str,
        timestamp: timestamp.to_rfc3339(),
    }
};
```

Note: `WsServerMessage::PointFresh` does not include `quality` per the spec's message definition. The `mark_fresh` call is now implicit since `cache.update` unconditionally sets `stale: false`.

Do NOT:
- Remove the `Update` variant — it is still used for the non-stale path and is part of the wire protocol
- Emit `PointFresh` for every update regardless of prior stale state — it must only fire on a stale→fresh transition
