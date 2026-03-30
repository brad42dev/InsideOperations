# History Recovery Resilience Plan

**Date:** 2026-03-30
**Problem:** Recovery jobs keep getting killed during development restarts, leaving persistent data gaps. Startup auto-recovery runs inline (blocking, killed on restart). Jobs stuck in `running` state are never resumed.

---

## Root Cause Analysis

### Bug 1 — Startup auto-recovery is inline, not job-based
`run_source_once` (driver.rs:420-472) calls `harvest_history(...)` directly and synchronously. If the OPC service restarts during a long harvest (e.g. 17-day gap), all progress is lost. The next startup will try again from scratch — but gets killed again.

### Bug 2 — `running` jobs are never resumed after crash
When a recovery job is `status='running'` and the service crashes, `get_pending_recovery_jobs` only queries `status='pending'`, so the interrupted job is orphaned forever.

### Bug 3 — No overlap buffer on recovery windows
The startup auto-recovery starts from the "start of the hour containing the last stored value." The watchdog starts from "MIN(last 100 points) − 5 min." Neither adds a percentage buffer to guarantee no boundary data is missed.

### Bug 4 — 17-day gap since March 13th
Recovery from March 13th needs to be manually kicked off now, and the new resilient system applied going forward.

---

## Solution

### Change 1 — `db.rs`: Add `reset_interrupted_recovery_jobs`

New function that on startup resets any `status='running'` jobs for this source back to `'pending'`, updating `to_time = now()` so the resumed job covers up to the current restart time.

```rust
pub async fn reset_interrupted_recovery_jobs(
    db: &DbPool,
    source_id: Uuid,
    now: DateTime<Utc>,
) -> anyhow::Result<u64>
// UPDATE opc_history_recovery_jobs
// SET status='pending', to_time=$2, started_at=NULL
// WHERE source_id=$1 AND status='running'
```

### Change 2 — `db.rs`: Add `has_pending_recovery_jobs`

Guard to prevent duplicate job creation on restart when a pending job already covers the gap.

```rust
pub async fn has_pending_recovery_jobs(
    db: &DbPool,
    source_id: Uuid,
) -> anyhow::Result<bool>
// SELECT EXISTS(... WHERE source_id=$1 AND status='pending')
```

### Change 3 — `driver.rs`: Replace inline startup harvest with DB job

In `run_source_once`, replace the `harvest_history(...)` call with:
1. Call `reset_interrupted_recovery_jobs` — resumes any crashed job
2. Check `has_pending_recovery_jobs` — skip if already queued
3. Compute gap with **5% buffer** on `from_time`
4. Call `create_recovery_job` — let the flush loop's polling pick it up in background

This means:
- Subscription setup is no longer blocked by a potentially-long harvest
- Jobs survive restarts (reset to pending, to_time extended to now)
- 5% buffer ensures no boundary data is lost

**5% buffer formula:**
```
gap_secs = (now - from_time).num_seconds()
buffer_secs = gap_secs * 0.05
buffered_from = from_time - Duration::seconds(buffer_secs)
```
For a 17-day gap: 5% = ~20 hours of extra overlap. For a 1-hour gap: 5% = 3 minutes.

### Change 4 — `driver.rs`: Add 5% buffer to watchdog recovery

In `run_source` after `watchdog_triggered`, apply the same 5% buffer formula to the watchdog's `recovery_from` calculation before calling `create_recovery_job`.

### Change 5 — Manual kickoff: March 13th gap

SQL to create recovery jobs for all enabled OPC sources covering 2026-03-13 to now:

```sql
INSERT INTO opc_history_recovery_jobs (source_id, from_time, to_time)
SELECT id,
       '2026-03-13T00:00:00Z'::timestamptz,
       now()
FROM point_sources
WHERE source_type = 'opc_ua'
  AND enabled = true
  AND id NOT IN (
    SELECT DISTINCT source_id FROM opc_history_recovery_jobs
    WHERE status IN ('pending', 'running')
      AND from_time <= '2026-03-13T00:00:00Z'::timestamptz
  );
```

This inserts one job per enabled OPC source, skipping sources that already have a pending/running job from before March 13th (prevents double-covering).

---

## File Checklist

- [ ] `services/opc-service/src/db.rs` — add `reset_interrupted_recovery_jobs` + `has_pending_recovery_jobs`
- [ ] `services/opc-service/src/driver.rs` — startup auto-recovery (replace inline harvest with job creation + reset + 5% buffer)
- [ ] `services/opc-service/src/driver.rs` — watchdog recovery (add 5% buffer)
- [ ] SQL — create March 13th recovery jobs via DB
- [ ] `cargo build -p api-gateway opc-service` — build and restart services
- [ ] Verify recovery jobs appear in `opc_history_recovery_jobs` table
- [ ] Verify jobs transition from pending → running → complete

---

## Non-Goals

- Adding a UI for recovery progress (it already exists)
- Changing the `harvest_history` function itself
- Splitting large jobs into chunks (the existing pagination handles large ranges)
- Rate-limiting recovery jobs (already handled: at most one background task at a time)
