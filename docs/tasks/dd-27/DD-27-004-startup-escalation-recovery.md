---
id: DD-27-004
title: Recover in-flight escalations on alert-service startup
unit: DD-27
status: pending
priority: high
depends-on: [DD-27-001, DD-27-003]
---

## What This Feature Should Do

If the alert-service restarts while alerts are active and mid-escalation, escalation must resume automatically. On startup, the service queries for all alerts with `status = 'active'` and a configured escalation policy, determines which escalation tier is currently due (accounting for elapsed time), fires overdue tiers immediately, and arms timers for future tiers. Without this, a service restart silently drops all pending escalations.

## Spec Excerpt (verbatim)

> **Recovery After Restart**
>
> On startup, the Alert Service queries for:
> - Active alerts (not acknowledged, not resolved, not cancelled)
> - Their escalation policy and current escalation level
> - Time elapsed since last escalation step
>
> If an escalation step was missed during downtime, it fires immediately. Future steps resume their normal timers.
> — design-docs/27_ALERT_SYSTEM.md, §Escalation Engine — Recovery After Restart

## Where to Look in the Codebase

Primary files:
- `services/alert-service/src/main.rs:19-93` — startup logic; no recovery query present
- `services/alert-service/src/state.rs` — `AppState::new` where recovery could be triggered
- `services/alert-service/src/handlers/escalation.rs` — `dispatch_tier` function that recovery will call

## Verification Checklist

- [ ] After `AppState::new` completes, `main.rs` calls a `recover_escalations` function before beginning to serve requests
- [ ] `recover_escalations` queries `alerts WHERE status = 'active' AND policy_id IS NOT NULL`
- [ ] For each active alert, it queries the last escalation tier dispatched and the time it was dispatched
- [ ] If `now - last_dispatched_at >= escalate_after_mins` for the next tier, that tier fires immediately via `dispatch_tier`
- [ ] If the delay has not elapsed, a timer is armed for the remaining duration (not the full `escalate_after_mins`)

## Assessment

- **Status**: ❌ Missing — `main.rs` does not query for active alerts on startup

## Fix Instructions (if needed)

1. Add a `recover_escalations` async function in `escalation.rs` (or a new `recovery.rs` module):

   ```rust
   pub async fn recover_escalations(state: AppState) {
       let now = Utc::now();

       // Find all active alerts with a policy
       let rows = sqlx::query(
           "SELECT id, policy_id, current_tier, created_at
            FROM alerts
            WHERE status = 'active' AND policy_id IS NOT NULL"
       )
       .fetch_all(&state.db)
       .await
       .unwrap_or_default();

       for row in &rows {
           let alert_id: Uuid = row.get("id");
           let policy_id: Uuid = row.get("policy_id");
           let current_tier: i16 = row.get("current_tier");
           let next_tier = current_tier + 1;

           // Find the next tier config
           let tier_row = sqlx::query(
               "SELECT escalate_after_mins FROM escalation_tiers
                WHERE policy_id = $1 AND tier_order = $2"
           )
           .bind(policy_id)
           .bind(next_tier)
           .fetch_optional(&state.db)
           .await
           .unwrap_or(None);

           if let Some(tier) = tier_row {
               let delay_mins: i16 = tier.get("escalate_after_mins");
               // Find when current tier was dispatched from alert_deliveries
               let last_dispatch: Option<DateTime<Utc>> = sqlx::query_scalar(
                   "SELECT MAX(sent_at) FROM alert_deliveries
                    WHERE alert_id = $1 AND tier = $2"
               )
               .bind(alert_id)
               .bind(current_tier)
               .fetch_one(&state.db)
               .await
               .unwrap_or(None);

               let elapsed = match last_dispatch {
                   Some(t) => (now - t).num_seconds().max(0) as u64,
                   None => delay_mins as u64 * 60, // no record means overdue
               };
               let remaining = ((delay_mins as u64 * 60)).saturating_sub(elapsed);

               let state_clone = state.clone();
               tokio::spawn(async move {
                   tokio::time::sleep(Duration::from_secs(remaining)).await;
                   dispatch_tier(state_clone, alert_id, next_tier).await;
               });
           }
       }
   }
   ```

2. In `main.rs`, after `AppState::new` and before `axum::serve`, call:
   ```rust
   let recovery_state = state.clone();
   tokio::spawn(async move {
       handlers::escalation::recover_escalations(recovery_state).await;
   });
   ```

3. This depends on DD-27-003: the spawned tasks should use `CancellationToken` (registered in `AppState.escalation_tokens`) so they can still be cancelled if the alert is acknowledged during the recovery window.

Do NOT:
- Block the HTTP listener on recovery — spawn recovery as a background task
- Re-fire tier 0 (the initial dispatch) on recovery — only resume from `current_tier + 1`
- Assume `created_at` is when the last tier fired — always query `alert_deliveries` for the actual dispatch time
