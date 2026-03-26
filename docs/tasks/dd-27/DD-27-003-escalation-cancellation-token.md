---
id: DD-27-003
title: Use CancellationToken to cancel pending escalation timers on acknowledge/resolve/cancel
unit: DD-27
status: pending
priority: high
depends-on: [DD-27-001]
---

## What This Feature Should Do

When an alert is acknowledged, resolved, or cancelled, all pending escalation timer tasks for that alert must be immediately cancelled. The current implementation spawns `tokio::spawn` tasks that wait `escalate_after_mins * 60` seconds, then re-check the DB status. This means a pending escalation waits its full delay (potentially 5-15 minutes) before discovering the alert was acknowledged. The spec requires cancellation via a `CancellationToken` — acknowledgment cancels the token and all pending tasks stop immediately.

## Spec Excerpt (verbatim)

> **Timer implementation**: Tokio `sleep` tasks spawned per alert. On acknowledgment, the task is cancelled via a `CancellationToken`. If the Alert Service restarts, pending escalations are recovered from the database (check for unacknowledged alerts with remaining escalation levels).
> — design-docs/27_ALERT_SYSTEM.md, §Escalation Engine

> 6. On acknowledgment at any point, cancel all pending escalation timers
> — design-docs/27_ALERT_SYSTEM.md, §Escalation Rules

## Where to Look in the Codebase

Primary files:
- `services/alert-service/src/state.rs` — `AppState` struct; needs a token registry added
- `services/alert-service/src/handlers/escalation.rs:134-194` — spawned timer task; currently polls DB only
- `services/alert-service/src/handlers/alerts.rs:269-318` — `acknowledge_alert` and `resolve_alert` handlers; neither cancels timers

## Verification Checklist

- [ ] `AppState` contains a `cancellation_tokens: Arc<DashMap<Uuid, CancellationToken>>` (or equivalent concurrent map keyed by alert ID)
- [ ] `dispatch_tier` creates a `CancellationToken`, stores it in the map for `alert_id`, and uses `tokio::select!` with `token.cancelled()` vs the sleep future
- [ ] `acknowledge_alert` handler retrieves and cancels the token for the alert_id after updating DB status
- [ ] `resolve_alert` handler retrieves and cancels the token for the alert_id after updating DB status
- [ ] A `cancel_alert` handler (new) also cancels the token
- [ ] Token is removed from the map after cancellation to prevent memory leak

## Assessment

- **Status**: ❌ Missing — no `CancellationToken` anywhere in alert-service; escalation tasks poll DB status after full delay

## Fix Instructions (if needed)

1. Add `dashmap` to `alert-service/Cargo.toml` (MIT license) or use `std::sync::Mutex<HashMap<Uuid, CancellationToken>>`.

2. Update `AppState` in `state.rs`:
   ```rust
   use tokio_util::sync::CancellationToken;
   use dashmap::DashMap;

   pub struct AppState {
       pub config: Config,
       pub db: PgPool,
       pub http: reqwest::Client,
       pub escalation_tokens: Arc<DashMap<Uuid, CancellationToken>>,
   }
   ```

3. In `AppState::new`, initialize `escalation_tokens: Arc::new(DashMap::new())`.

4. In `dispatch_tier_impl` (`escalation.rs:21`), before spawning the next-tier wait:
   ```rust
   let token = CancellationToken::new();
   state.escalation_tokens.insert(alert_id, token.clone());

   tokio::spawn(async move {
       tokio::select! {
           _ = token.cancelled() => {
               info!(alert_id = %alert_id, "Escalation cancelled");
               return;
           }
           _ = tokio::time::sleep(Duration::from_secs(delay_mins * 60)) => {}
       }
       // proceed to check and dispatch next tier
   });
   ```

5. In `acknowledge_alert` handler (`alerts.rs:269`), after the DB UPDATE succeeds:
   ```rust
   if let Some((_, token)) = state.escalation_tokens.remove(&id) {
       token.cancel();
   }
   ```
   Do the same in `resolve_alert` and the new `cancel_alert` handler.

6. If an alert has multiple tiers, only one token per alert is needed — cancelling it stops all future tiers for that alert (each tier's task checks the same token).

Do NOT:
- Use `abort()` on `JoinHandle` — `CancellationToken` is the specified pattern and handles graceful cleanup
- Store the token in the database — it is an in-process runtime handle only; recovery on restart is handled by DD-27-004
