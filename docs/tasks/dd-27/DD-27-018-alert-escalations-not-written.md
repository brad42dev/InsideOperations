---
id: DD-27-018
title: Write escalation steps to alert_escalations table in dispatch_tier_impl
unit: DD-27
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

Every time an alert escalates to a new tier, the escalation engine must insert a row into `alert_escalations` recording the transition (`from_level`, `to_level`, `reason`). This audit trail is required for regulatory compliance (OSHA PSM, EPA RMP) and powers the `GET /alerts/:id/escalations` endpoint. Currently that endpoint always returns an empty array because nothing ever writes to the table.

## Spec Excerpt (verbatim)

> **Escalation flow**:
> 5. On acknowledgment at any point, cancel all pending escalation timers
> 6. **Each escalation step is logged in `alert_escalations`**
>
> ```sql
> CREATE TABLE alert_escalations (
>     id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
>     alert_id        UUID NOT NULL REFERENCES alerts(id),
>     from_level      SMALLINT NOT NULL,
>     to_level        SMALLINT NOT NULL,
>     reason          VARCHAR(100) NOT NULL,  -- 'no_acknowledgment', 'always', 'manual'
>     escalated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
> );
> ```
> — design-docs/27_ALERT_SYSTEM.md, §Escalation Engine / §Database Schema

## Where to Look in the Codebase

Primary files:
- `services/alert-service/src/handlers/escalation.rs:274-283` — updates `current_escalation` on alert but does not insert into `alert_escalations`
- `services/alert-service/src/handlers/escalation.rs:179-411` — full `dispatch_tier_impl` function; the INSERT is missing
- `services/alert-service/src/handlers/alerts.rs:843-873` — `list_escalations` handler that queries `alert_escalations` — correct, but always returns empty

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] `dispatch_tier_impl` inserts a row into `alert_escalations` when dispatching a tier (after confirming the alert is still active)
- [ ] The insert sets `from_level = current_escalation`, `to_level = tier`, `reason = 'no_acknowledgment'`
- [ ] `GET /alerts/:id/escalations` returns non-empty results after an escalation fires
- [ ] The insert is best-effort (log on failure, do not abort the delivery)

## Assessment

- **Status**: ❌ Missing
- **If partial/missing**: `dispatch_tier_impl` in `escalation.rs` updates `current_escalation` on the `alerts` row but never inserts into `alert_escalations`. The escalation history endpoint always returns `[]`.

## Fix Instructions (if needed)

In `services/alert-service/src/handlers/escalation.rs`, inside `dispatch_tier_impl`, after the `UPDATE alerts SET current_escalation = $1` block (around line 274), add an INSERT into `alert_escalations`:

```rust
// Log the escalation step in the audit table.
// from_level is the escalation level before this dispatch; to_level is the current tier.
let from_level = tier - 1;
if let Err(e) = sqlx::query(
    "INSERT INTO alert_escalations (alert_id, from_level, to_level, reason)
     VALUES ($1, $2, $3, 'no_acknowledgment')",
)
.bind(alert_id)
.bind(from_level)
.bind(tier)
.execute(&state.db)
.await
{
    error!(
        alert_id = %alert_id,
        error = %e,
        "dispatch_tier: failed to insert alert_escalations record"
    );
    // Non-fatal: continue delivery even if audit record fails
}
```

Place this INSERT after the `UPDATE alerts SET current_escalation` succeeds (or regardless of its success — the audit record should still be written).

Do NOT:
- Make the escalation abort if the INSERT fails — it is an audit record, not a control flow gate
- Change the `reason` to anything other than `'no_acknowledgment'` for timer-based escalations
- Remove the existing `UPDATE alerts SET current_escalation` update
