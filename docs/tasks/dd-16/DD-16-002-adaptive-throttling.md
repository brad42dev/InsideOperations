---
id: DD-16-002
title: Implement adaptive throttling driven by client status_report messages
unit: DD-16
status: pending
priority: medium
depends-on: [DD-16-003]
---

## What This Feature Should Do

When a client reports rising `pending_updates` or dropping `render_fps` via a `status_report` message, the broker should escalate through up to 5 throttle levels: normal → increased batch window → deduplicate (latest value only per point per batch) → further reduced frequency → deprioritize off-screen panes. Throttling scales back automatically as the client recovers. If more than 30% of clients are being throttled simultaneously, the broker triggers server-wide measures.

## Spec Excerpt (verbatim)

> 1. Normal — send all updates as they arrive in batches
> 2. Batch — increase batch window (250ms → 500ms) if client reports FPS dropping or pending updates climbing
> 3. Deduplicate — only send latest value per point per batch (drop intermediate updates)
> 4. Reduce frequency — increase batch window further (500ms → 1s)
> 5. Off-screen deprioritize — points on minimized/hidden panes get updates at lowest frequency (client reports which panes are visible)
> Throttling scales back automatically as the client recovers.
> If >30% of clients are being throttled simultaneously, broker triggers server-wide measures: increase global batch interval, enforce deadband filtering even for points without explicit deadband config
> — design-docs/16_REALTIME_WEBSOCKET.md, §Adaptive Throttling / Per-Client Throttle Escalation

## Where to Look in the Codebase

Primary files:
- `services/data-broker/src/ws.rs:153–165` — `StatusReport` handler: currently only logs with `tracing::debug!`, no throttle state is modified
- `services/data-broker/src/state.rs` — `AppState`: no per-client throttle state stored here
- `services/data-broker/src/fanout.rs` — fanout function: no throttle awareness
- `services/data-broker/src/registry.rs` — could store per-client throttle level

## Verification Checklist

- [ ] A per-client throttle level type is defined (enum with at least 5 levels: Normal, Batch, Deduplicate, ReduceFrequency, OffScreenDeprioritize)
- [ ] Throttle level is stored per client (e.g., in a DashMap or as a field alongside the mpsc sender in `connections`)
- [ ] `StatusReport` handler in `ws.rs` reads `render_fps` and `pending_updates`, computes throttle level, and updates the client's stored level
- [ ] `fanout_batch` (or the batching layer above it) reads each client's throttle level and applies the corresponding behavior
- [ ] Server-wide aggregate check: if `throttled_count / total_clients > 0.30`, global measures are applied (wider batch window, force deadband)

## Assessment

- **Status**: ❌ Missing
- **If partial/missing**: `StatusReport` is received at `ws.rs:153` and logged only. No throttle state structure exists anywhere in the codebase. The fanout in `fanout.rs` does not consult any per-client state. The server-wide aggregate logic is entirely absent.

## Fix Instructions

This is a substantial feature. Implement incrementally:

**Step 1 — Per-client throttle state**

Add a `ThrottleLevel` enum and a per-client throttle map to `AppState`:

```rust
// In a new file: services/data-broker/src/throttle.rs
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum ThrottleLevel { #[default] Normal, Batch, Deduplicate, ReduceFrequency, OffScreen }
```

Add `pub throttle_states: Arc<DashMap<ClientId, ThrottleLevel>>` to `AppState` in `state.rs`.

**Step 2 — Update StatusReport handler**

In `ws.rs` inside the `StatusReport` arm, compute a new throttle level:

```rust
// Escalate if FPS < 30 or pending_updates > 50; de-escalate if FPS > 55 and pending < 5
let current = state.throttle_states.get(&client_id).map(|v| *v).unwrap_or_default();
let new_level = compute_throttle(current, render_fps, pending_updates);
state.throttle_states.insert(client_id, new_level);
```

Define `compute_throttle` thresholds based on the spec's description (FPS dropping, pending climbing).

**Step 3 — Fanout respects throttle**

Modify `fanout_batch` in `fanout.rs` to accept a `throttle_states` reference. Before sending to a client, look up its throttle level. At `Deduplicate` level, the fanout loop should accumulate only the latest value per (client, point) pair rather than sending immediately on each update.

**Step 4 — Server-wide aggregate check**

After updating per-client throttle state in the `StatusReport` handler, count how many clients are above `Normal` and compare to total connections. If ratio > 0.30, log a warning and set a global flag (atomic bool on AppState) that `fanout_batch` checks to force a wider batch window.

Do NOT:
- Implement throttle before DD-16-003 (batching) — throttle levels 2–4 depend on batch windows existing
- Use blocking locks inside the hot fanout loop — use DashMap (already in use) or per-client AtomicU8
- Hard-code FPS/pending thresholds without making them configurable in `config.rs`
