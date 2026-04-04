# Import Service — Scheduler Architecture Design

**Date:** 2026-04-04
**Purpose:** Design the correct scheduler implementation for all 6 schedule types, fix the broken `poll_import_schedules` function, and specify the migration needed to align the schema with what the code actually needs.
**Status:** Research complete — ready for implementation.

---

## 1. The Broken Scheduler — Exact Column Mismatches

`poll_import_schedules()` in `services/import-service/src/main.rs` (lines 248–402) references columns that do not exist in the `import_schedules` DDL as shipped in `migrations/20260314000013_import.up.sql`.

### Full mismatch table

| SQL / code reference | Actual DDL column | Action needed |
|---|---|---|
| `s.definition_id` (SELECT, index hint comments) | `import_definition_id` | Rename DDL column to `definition_id` OR fix query to use `import_definition_id` |
| `s.cron_expression` (SELECT) | not in DDL | Add column |
| `s.interval_seconds` (SELECT) | not in DDL | Add column |
| `s.running` (WHERE clause, UPDATE SET) | not in DDL | Add column |
| `s.last_heartbeat_at` (WHERE clause, UPDATE SET) | not in DDL | Add column |
| `trigger` (INSERT into `import_runs`) | column is `triggered_by` | Fix INSERT column name |
| value `'scheduled'` (INSERT into `import_runs`) | CHECK requires `'schedule'` | Fix value to `'schedule'` |
| `(id, import_definition_id, status, trigger, created_at)` in INSERT | missing `schedule_id`, `dry_run` columns | Expand INSERT or accept defaults |

Additionally, the design doc (`24_UNIVERSAL_IMPORT.md` §5 DDL) uses `definition_id` (no `import_` prefix) while the actual migration uses `import_definition_id`. The code uses `definition_id`. The DDL column is the odd one out — see §7 migration for resolution.

There is also a second mismatch: the code in `poll_import_schedules` sets `next_run_at` and clears `running` in a separate UPDATE *after* spawning the ETL task. This means the `running = false` update fires before the ETL task actually finishes, making `running` a reservation flag (set true to claim, set false after spawning) rather than an "actively executing" flag. This design is intentional per the claim-then-spawn model, but it means `last_heartbeat_at` must be updated *inside the spawned task* at regular intervals to be meaningful. The current code never does this — the spawned `pipeline::execute` task does not update `last_heartbeat_at`. The heartbeat logic is entirely inoperative.

---

## 2. Schedule Type Designs

### 2.1 `manual`

**Behavior:** No automatic scheduling. Runs only when explicitly triggered via `POST /import/definitions/:id/runs`.

**Scheduler interaction:** None. The scheduler loop should skip all `schedule_type = 'manual'` rows entirely. There is no `next_run_at` to compute and no polling logic needed.

**Current state:** Fully functional via `trigger_run()` handler. No changes needed to the manual trigger path.

**Storage:** `schedule_config = '{}'`, `next_run_at = NULL`, `enabled` should default to `true` (it controls UI visibility) but the scheduler must ignore it. Better: the scheduler WHERE clause filters to `schedule_type IN ('cron', 'interval')` only, so `manual` rows are naturally excluded.

---

### 2.2 `cron`

**Behavior:** Run on a cron expression schedule. The expression is stored in `schedule_config` as `{"expression": "0 6 * * *", "timezone": "UTC"}`.

**Crate decision:** Keep the existing `cron = "0.12"` crate (MIT licensed). See §6 for full crate evaluation. The current API is correct: `cron::Schedule::from_str(expr)?.upcoming(chrono::Utc).next()` returns the next fire time. No crate change needed.

**Next-run calculation:**
1. On schedule creation: parse expression, call `.upcoming(chrono::Utc).next()`, store as `next_run_at`.
2. After a successful claim-and-run: recompute from expression, store new `next_run_at`. This is what the existing code already does — it's correct in logic, just broken by missing columns.

**Timezone support:** The design doc DDL includes a `timezone VARCHAR(50)` column. The `cron` crate's `upcoming()` method accepts any `chrono::TimeZone`. Store the timezone in `schedule_config` JSONB and use `chrono_tz::Tz` to parse it. No separate `timezone` column is needed — keep it in JSONB to avoid schema churn.

**Missed-run handling:** If the service was down and `next_run_at` is in the past, the scheduler will find it on the next poll cycle and fire immediately. This is correct behavior — run it once, then advance to the next scheduled time. Do not attempt to replay all missed runs.

---

### 2.3 `interval`

**Behavior:** Run every N seconds. Store as `schedule_config = {"interval_seconds": 300}`.

**Concurrency guard:** If a run is still active when the next interval fires, the scheduler must skip it. Two mechanisms handle this:
1. The `running` flag: if `running = true AND last_heartbeat_at > NOW() - INTERVAL '5 minutes'` → skip.
2. If `running = true AND last_heartbeat_at < NOW() - INTERVAL '5 minutes'` → treat as crashed, reclaim.

**Next-run calculation:** After spawn, set `next_run_at = NOW() + interval_seconds`. This means the interval is measured from when the previous run *started*, not when it ended. This is simpler and prevents interval drift. An alternative (measure from completion) is more complex and not meaningfully better for import scheduling.

**Missed-run handling:** Same as cron — fire once when the service comes back up, then recalculate forward. Do not try to catch up missed cycles.

---

### 2.4 `file_arrival`

**Behavior:** Trigger an import when a new file appears at a watched location (local path, SFTP directory, or S3 prefix). This is event-driven, not time-based.

**Storage in `import_schedules`:**
```json
// schedule_config for file_arrival
{
  "watch_type": "local",      // "local" | "sftp" | "s3"
  "watch_path": "/imports/daily/",
  "watch_pattern": "*.csv",   // glob pattern
  "seen_files": []            // list of already-processed filenames (watermark)
}
```

The `seen_files` watermark is updated at the end of each successful run.

**Local file watching — implementation options:**

Option A — `notify` crate (CC0-1.0 license, royalty-free commercial use acceptable): Uses inotify on Linux. Provides event-driven notifications without polling. License is CC0 (public domain dedication), which is permissive.

Option B — Short-interval poller: The scheduler loop itself polls the watch path every N seconds (e.g., 60 seconds), compares the current directory listing against `seen_files` in `schedule_config`, and triggers a run for each new file found. No additional crate needed.

**Recommendation: Option B (poller) for v1 of the scheduler.** Reasons:
- SFTP and S3 cannot use inotify anyway; they require polling the remote listing.
- A consistent polling model works for all three watch types.
- `notify` crate adds OS-specific complexity (inotify setup, event channel management) and requires a persistent watcher task registry separate from the scheduler loop.
- The polling interval for file-arrival (60 seconds) is acceptable for import use cases.

**Watcher task registry decision: not needed if using Option B.** The scheduler loop handles `file_arrival` schedules in the same poll cycle as cron/interval — it just does a directory listing comparison instead of a time comparison. No separate background tasks are needed.

**SFTP/S3 file arrival:** Use the existing SFTP connector or `object_store` crate (Apache-2.0) to list remote files. Compare listing against `seen_files`. Trigger a run for each new file, passing the filename in `run_metadata` so the extract step knows which file to fetch.

**`import_schedules` changes for file_arrival:**
- No new dedicated columns needed. `schedule_config` JSONB holds `watch_path`, `watch_pattern`, `watch_type`, and `seen_files`.
- `next_run_at` is not meaningful for file_arrival — set it to `NOW() + poll_interval` after each check so the scheduler loop knows when to recheck. The effective polling interval is the scheduler's 30-second loop plus the interval stored in `schedule_config`.
- `running` / `last_heartbeat_at` still apply: if a file-arrival run is in progress, do not trigger another for the same definition.

---

### 2.5 `webhook`

**Behavior:** Import is triggered by an incoming HTTP POST from an external system to a registered endpoint. This is not time-based and the scheduler does not drive it.

**Endpoint design:**
```
POST /import/webhooks/:token
  Headers: (none required — token is auth)
  Body: (optional — can be empty or contain trigger metadata)
```

Each `import_schedules` row of type `webhook` stores a unique secret token in `schedule_config`:
```json
{
  "token": "wh_abc123...",   // random 32-byte hex, unique per schedule
  "buffer_seconds": 5,        // optional: debounce window
  "last_file_hint": ""        // optional: external system may pass a filename
}
```

**Interaction with scheduler loop:** None. The webhook handler is a separate HTTP endpoint. When a webhook arrives:
1. Look up `import_schedules WHERE schedule_config->>'token' = $token AND schedule_type = 'webhook' AND enabled = true`.
2. Check that no run for this definition is currently `pending` or `running` (skip if so).
3. Insert `import_runs` with `triggered_by = 'webhook'`.
4. Spawn `pipeline::execute`.
5. Update `import_schedules.last_run_at = NOW()`.

The scheduler's poll loop does not need to touch webhook rows. Webhook runs are entirely self-triggering.

**Security:** The token in `schedule_config` should be stored encrypted (it is a secret). The API to retrieve a webhook URL should mask the token after initial creation (show once).

**Buffering/debounce:** If an upstream system fires the webhook multiple times in rapid succession (e.g., on every file write completion), a `buffer_seconds` grace period prevents duplicate runs. Implementation: after inserting the run, set `next_run_at = NOW() + buffer_seconds`. The webhook handler checks `last_run_at > NOW() - buffer_seconds` and skips if within the debounce window.

---

### 2.6 `dependency`

**Behavior:** Definition B runs automatically after Definition A completes successfully. This is a graph-based scheduling model.

**Storage:** `schedule_config` for a dependency schedule:
```json
{
  "depends_on_definition_id": "uuid-of-A",
  "trigger_on": "completed",   // "completed" | "partial" (partial = completed with errors)
  "max_lag_minutes": null       // optional: only trigger if A completed within N minutes
}
```

**Implementation — post-run hook:** After `pipeline::execute` finishes with status `completed` (or `partial` if `trigger_on = 'partial'`), the pipeline queries:

```sql
SELECT s.id, s.import_definition_id
FROM import_schedules s
WHERE s.schedule_type = 'dependency'
  AND s.enabled = true
  AND s.schedule_config->>'depends_on_definition_id' = $completed_definition_id::text
```

For each dependent schedule found:
1. Check that no run is currently `pending` or `running` for that definition.
2. Insert `import_runs` with `triggered_by = 'dependency'`, `schedule_id = s.id`.
3. Spawn `pipeline::execute`.

**Cycle detection:** Required. Before inserting a dependency schedule, the API must walk the dependency graph and reject cycles. Algorithm: starting from the new dependency's `depends_on_definition_id`, follow the chain of existing dependency schedules. If the current definition's ID is ever reached, the cycle is rejected with a 422 error.

This walk can be done in SQL using a recursive CTE:
```sql
WITH RECURSIVE dep_chain AS (
  SELECT import_definition_id, schedule_config->>'depends_on_definition_id' AS depends_on
  FROM import_schedules
  WHERE schedule_type = 'dependency'
    AND schedule_config->>'depends_on_definition_id' = $proposed_parent_id::text
  UNION ALL
  SELECT s.import_definition_id, s.schedule_config->>'depends_on_definition_id'
  FROM import_schedules s
  JOIN dep_chain d ON s.schedule_config->>'depends_on_definition_id' = d.import_definition_id::text
  WHERE s.schedule_type = 'dependency'
)
SELECT 1 FROM dep_chain WHERE import_definition_id = $new_child_id LIMIT 1;
```

If this returns a row, the proposed dependency creates a cycle — reject it.

**Schema changes needed for dependency:** None beyond the core migration in §7. The `depends_on_definition_id` is stored in `schedule_config` JSONB. No separate FK column is needed in the initial implementation; it trades referential integrity for flexibility. A future migration can add a proper FK column if needed.

**`next_run_at` for dependency schedules:** Not used. Set to NULL. The trigger is event-based, not time-based. The scheduler loop must exclude `schedule_type = 'dependency'` rows (along with `webhook` and `manual`) from its time-based poll.

---

## 3. Scheduler Architecture Design — Answers

### Q1: One global scheduler loop vs. per-schedule tasks?

**One global scheduler loop.** The existing 30-second poll design is correct and should be kept. Reasons:
- PostgreSQL `FOR UPDATE SKIP LOCKED` handles multi-instance concurrency correctly in a loop model.
- Per-schedule Tokio tasks would require an in-memory task registry, complicate restart recovery, and provide no meaningful latency advantage (30-second poll granularity is acceptable for import scheduling).
- A loop is simpler to reason about and requires no state beyond what's in the database.

The loop handles `cron` and `interval` types. `file_arrival` schedules are also checked in the loop using directory-listing comparison instead of a time comparison. The loop skips `webhook`, `dependency`, and `manual` schedule types entirely — those are triggered by external events.

### Q2: How to handle missed runs (service was down)?

**Run once immediately, then advance forward.** When the service restarts and polls `import_schedules`, it finds rows where `next_run_at <= NOW()`. It fires each one once, then computes the next future `next_run_at` from the cron expression or interval. It does NOT attempt to replay all missed cycles.

This is the correct behavior for import scheduling: running an import twice to catch up is rarely useful and often harmful (duplicate data loads). The one-shot catch-up is fine.

Exception: if the operator wants "run every time it was missed," that is a configuration decision and not the default. Default is: one catch-up run, then resume forward.

### Q3: How to prevent concurrent runs of the same definition?

Two-layer defense:

**Layer 1 — `running` flag + heartbeat:** The scheduler sets `running = true` before spawning the ETL task. On reclaim after crash (heartbeat stale > 5 minutes), it treats the row as claimable again.

**Layer 2 — `FOR UPDATE SKIP LOCKED`:** In a multi-instance deployment (or even within a single instance if the poll loop fires again before the ETL finishes), the database lock prevents double-claiming the same schedule row.

**Important implementation note:** The current code sets `running = false` *immediately after spawning* the ETL task — not after the ETL task finishes. This is intentional (the claim transaction is kept short) but means the `running` flag only reflects "claimed by this poll cycle," not "pipeline is currently executing." The real concurrency guard is the `FOR UPDATE SKIP LOCKED` plus the heartbeat from *inside* the spawned task.

**Fix required:** The spawned `pipeline::execute` task must update `last_heartbeat_at` on `import_schedules` every 60 seconds while running. This is the mechanism that prevents a second scheduler poll from reclaiming a legitimately-running job. Without this, the 5-minute stale-heartbeat recovery will never trigger correctly.

### Q4: Right polling interval for the scheduler task?

**30 seconds is correct.** Import scheduling is not latency-sensitive. The 30-second poll provides reasonable responsiveness (max 30-second delay to start a scheduled run) while keeping DB load negligible. No change needed.

For file_arrival schedules, a separate configurable poll interval per schedule (in `schedule_config`) is appropriate since file arrival checking may need to be more or less frequent depending on the source.

### Q5: How should `watermark_state` be updated at the end of a successful run?

`watermark_state` is a JSONB column on `import_runs`, not on `import_schedules`. The current schema stores it on the run row (`import_runs.watermark_state`), not the schedule.

**Recommended approach:** Store the "live" watermark on `import_definitions` via a separate `watermark_state JSONB` column (or in `source_config`). After a successful run, the pipeline:
1. Reads `watermark_state` from `import_definitions.source_config` (or a dedicated column).
2. Runs the extract with `WHERE watermark_column > last_value`.
3. After successful commit, updates `import_definitions.source_config->>'watermark_state'` with the new high-water mark.

The `import_runs.watermark_state` column should store a snapshot of the watermark *at the time of the run* for audit purposes (`watermark_state_before` / `watermark_state_after` in the design doc DDL).

This requires adding `watermark_enabled BOOLEAN` and `watermark_column VARCHAR(255)` to `import_definitions` (or storing them in `source_config` JSONB, which is already present). The current schema has `watermark_state JSONB` on `import_runs` but never populates it. The fix is to write both the before/after snapshot to the run row and update the live state on the definition.

### Q6: Should the scheduler use `pg_notify`/LISTEN for instant triggering or only polling?

**Polling only for the initial implementation.** Reasons:
- The service already uses `pg_notify('import_status', ...)` for outbound notifications (pipeline → frontend). Adding LISTEN would require a separate persistent connection and async event loop management.
- 30-second poll latency is acceptable for all scheduled trigger types.
- `pg_notify` would only help for the dependency trigger case (immediate chain execution) and the webhook case (neither of which uses the scheduler loop anyway).

**One future exception:** For dependency chains where immediate sequential execution matters, the post-run hook in `pipeline.rs` can directly spawn the dependent run without waiting for the scheduler loop. This gives near-instant chaining without LISTEN/NOTIFY complexity. This is described in §2.6 above.

---

## 4. Schema Corrections — Full Migration

The following migration corrects all column mismatches and adds the columns needed for the full scheduler implementation.

### Migration: `20260405000001_import_schedules_scheduler_fix.up.sql`

```sql
-- Fix import_schedules: rename FK column to match scheduler code and design doc,
-- add missing columns for scheduler operation.

BEGIN;

-- 1. Rename import_definition_id → definition_id
--    (the code and design doc both use definition_id; the DDL was the outlier)
ALTER TABLE import_schedules
    RENAME COLUMN import_definition_id TO definition_id;

-- 2. Add missing scheduler columns
ALTER TABLE import_schedules
    ADD COLUMN IF NOT EXISTS cron_expression VARCHAR(100),
    ADD COLUMN IF NOT EXISTS interval_seconds INTEGER,
    ADD COLUMN IF NOT EXISTS watch_path VARCHAR(500),
    ADD COLUMN IF NOT EXISTS watch_pattern VARCHAR(255),
    ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
    ADD COLUMN IF NOT EXISTS running BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS last_heartbeat_at TIMESTAMPTZ;

-- 3. Backfill cron_expression and interval_seconds from schedule_config JSONB
--    (for any existing rows created via the API before this migration)
UPDATE import_schedules
SET cron_expression = schedule_config->>'expression'
WHERE schedule_type = 'cron' AND cron_expression IS NULL;

UPDATE import_schedules
SET interval_seconds = (schedule_config->>'interval_seconds')::INTEGER
WHERE schedule_type = 'interval' AND interval_seconds IS NULL;

-- 4. Fix the import_runs triggered_by constraint:
--    Code inserts 'scheduled' but constraint requires 'schedule'.
--    Decision: align the constraint to match what the code actually inserts.
--    'scheduled' is more readable than 'schedule'; update the constraint.
ALTER TABLE import_runs
    DROP CONSTRAINT IF EXISTS import_runs_triggered_by_check;

ALTER TABLE import_runs
    ADD CONSTRAINT import_runs_triggered_by_check
    CHECK (triggered_by IN ('manual', 'scheduled', 'webhook', 'file_arrival', 'dependency', 'retry'));

-- 5. Add index for dependency schedule lookup (used in post-run hook)
CREATE INDEX IF NOT EXISTS idx_import_schedules_dep_definition
    ON import_schedules USING GIN (schedule_config)
    WHERE schedule_type = 'dependency';

-- 6. Add index for file_arrival schedules
CREATE INDEX IF NOT EXISTS idx_import_schedules_file_arrival
    ON import_schedules (enabled, next_run_at)
    WHERE schedule_type = 'file_arrival';

COMMIT;
```

### Migration: `20260405000001_import_schedules_scheduler_fix.down.sql`

```sql
BEGIN;

ALTER TABLE import_schedules RENAME COLUMN definition_id TO import_definition_id;

ALTER TABLE import_schedules
    DROP COLUMN IF EXISTS cron_expression,
    DROP COLUMN IF EXISTS interval_seconds,
    DROP COLUMN IF EXISTS watch_path,
    DROP COLUMN IF EXISTS watch_pattern,
    DROP COLUMN IF EXISTS timezone,
    DROP COLUMN IF EXISTS running,
    DROP COLUMN IF EXISTS last_heartbeat_at;

ALTER TABLE import_runs
    DROP CONSTRAINT IF EXISTS import_runs_triggered_by_check;

ALTER TABLE import_runs
    ADD CONSTRAINT import_runs_triggered_by_check
    CHECK (triggered_by IN ('manual', 'schedule', 'webhook', 'file_arrival', 'dependency', 'retry'));

DROP INDEX IF EXISTS idx_import_schedules_dep_definition;
DROP INDEX IF EXISTS idx_import_schedules_file_arrival;

COMMIT;
```

### Summary of column changes

| Table | Change | Reason |
|---|---|---|
| `import_schedules` | `import_definition_id` → `definition_id` | Code and design doc both use `definition_id` |
| `import_schedules` | ADD `cron_expression VARCHAR(100)` | Scheduler reads this directly |
| `import_schedules` | ADD `interval_seconds INTEGER` | Scheduler reads this directly |
| `import_schedules` | ADD `watch_path VARCHAR(500)` | File arrival watcher path |
| `import_schedules` | ADD `watch_pattern VARCHAR(255)` | Glob pattern for file arrival |
| `import_schedules` | ADD `timezone VARCHAR(50) DEFAULT 'UTC'` | Cron timezone support |
| `import_schedules` | ADD `running BOOLEAN NOT NULL DEFAULT false` | Concurrency guard |
| `import_schedules` | ADD `last_heartbeat_at TIMESTAMPTZ` | Stale-run recovery |
| `import_runs` | Fix `triggered_by` CHECK: add `'scheduled'` | Code uses `'scheduled'`; schema had `'schedule'` |

---

## 5. Additional Code Bugs Beyond Column Names

Beyond the column mismatches, the current `poll_import_schedules` code has these additional bugs:

**Bug 1 — Wrong INSERT column name:**
```rust
// Line 310 — uses 'trigger' but column is 'triggered_by'
"INSERT INTO import_runs (id, import_definition_id, status, trigger, created_at) ..."
```
Fix: change `trigger` to `triggered_by`.

**Bug 2 — Wrong triggered_by value:**
```rust
// Line 311 — inserts 'scheduled' but original CHECK constraint required 'schedule'
"... VALUES ($1, $2, 'pending', 'scheduled', NOW())"
```
Fix: the migration above changes the CHECK constraint to allow `'scheduled'`. The code value is fine.

**Bug 3 — Missing `schedule_id` in INSERT:**
The INSERT into `import_runs` does not populate `schedule_id`. The column exists in the schema and should be populated so runs can be traced back to their schedule.

**Bug 4 — `running = false` set before ETL completes:**
After spawning the ETL task, the code immediately sets `running = false`. This means `running` is used as a claim flag, not an execution flag. The heartbeat inside the spawned task must keep the schedule from being reclaimed. But the spawned task never updates `last_heartbeat_at`. This must be implemented in `pipeline.rs` or via a separate heartbeat task spawned alongside the ETL.

**Bug 5 — No check on `import_definitions.enabled`:**
The scheduler queries `import_schedules.enabled` but does not join `import_definitions` to check if the definition itself is disabled. A disabled definition with an enabled schedule will still be triggered.

Fix: add `JOIN import_definitions d ON d.id = s.definition_id AND d.enabled = true` to the scheduler query.

---

## 6. Crate Evaluation — Cron Parsing

Three candidates for parsing cron expressions in a Tokio async service:

### `cron` (version 0.12, MIT licensed)

- **What it does:** Parses cron expressions (including optional seconds field) and iterates upcoming fire times as a lazy iterator via `Schedule::upcoming(tz)`.
- **API:** Sync. `Schedule::from_str("0 6 * * *")` → `Iterator<Item = DateTime<Tz>>`.
- **Tokio integration:** None needed. You call `.next()` synchronously to get the next timestamp, then store it in the DB. The scheduler loop's async sleep handles the actual waiting.
- **License:** MIT. Fully royalty-free commercial use.
- **Current use in codebase:** Already pinned at `0.12` in `Cargo.toml`. The code at line 355 uses `cron::Schedule::from_str(expr)` and `.upcoming(chrono::Utc).next()` — this API is valid.
- **Design doc reference:** Doc 24 §appendix lists `cron = "0.13+"` as the target version but the difference between 0.12 and 0.13 is minimal for this use case.

### `croner` (version 2.x, MIT licensed)

- **What it does:** Similar to `cron` — parses cron expressions, iterates upcoming times.
- **API difference:** Uses its own `CronError` type, slightly different method names.
- **Advantage over `cron`:** Better handling of non-standard cron syntax (Quartz-style with seconds and years). More actively maintained as of 2025.
- **Tokio integration:** Same as `cron` — sync iteration, store timestamp in DB.
- **License:** MIT.
- **Assessment:** A reasonable alternative but not worth switching from `cron` mid-project.

### `tokio-cron-scheduler` (version 0.13.x, MIT licensed)

- **What it does:** Full in-memory cron scheduler that fires Tokio tasks on schedule. Manages its own task registry and timer loop.
- **API:** `JobScheduler::new()`, `scheduler.add(Job::new("0 6 * * *", |uuid, lock| { ... })?)`.
- **Advantage:** No manual poll loop needed for cron jobs — it fires tasks automatically.
- **Disadvantage for this project:**
  1. It maintains an in-memory task registry — crashes lose all registered jobs and require DB re-read on restart. The current DB-poll model naturally handles this.
  2. It does not integrate with the `FOR UPDATE SKIP LOCKED` concurrency model used for multi-instance safety.
  3. It does not handle interval, file_arrival, webhook, or dependency types — you'd still need a separate mechanism for those.
  4. More complex lifecycle management (start/stop/add/remove while running).
- **Assessment:** Overkill for this use case. The existing poll-loop model is simpler, more robust across restarts, and already supports all trigger types through a unified mechanism.

### Recommendation

**Keep `cron = "0.12"`.** It is already in use, MIT licensed, and does exactly what is needed: parse an expression, get the next fire time. The scheduler's poll loop is the scheduling engine — the `cron` crate is just a timestamp calculator.

The `notify` crate (CC0-1.0, version 7.x) is acceptable for file watching if a more responsive file-arrival trigger is needed in a future iteration. CC0-1.0 is a public domain dedication — no restrictions on commercial use.

---

## 7. `schedule_config` JSONB Shape — Per Type

After the migration, the canonical shape of `schedule_config` for each type:

```json
// cron
{"expression": "0 6 * * *", "timezone": "UTC"}

// interval
{"interval_seconds": 300}

// manual
{}

// file_arrival (local)
{"watch_type": "local", "watch_path": "/imports/daily/", "watch_pattern": "*.csv", "poll_interval_seconds": 60, "seen_files": []}

// file_arrival (sftp — uses connection credentials from import_connection)
{"watch_type": "sftp", "watch_path": "/remote/exports/", "watch_pattern": "*.xlsx", "poll_interval_seconds": 300, "seen_files": []}

// webhook
{"token": "<32-byte-hex>", "buffer_seconds": 5}

// dependency
{"depends_on_definition_id": "<uuid>", "trigger_on": "completed"}
```

The `cron_expression` and `interval_seconds` dedicated columns (added by migration) are the authoritative source for the scheduler. The `schedule_config` JSONB provides these same values plus extras. On write, the API handler should populate both: the dedicated column (for indexed query performance) and the JSONB (for full config storage). On read, the scheduler uses the dedicated columns.

---

## 8. Scheduler Loop Revised Query

After migration, the corrected poll query for the scheduler loop (cron + interval only):

```sql
SELECT s.id, s.definition_id, s.schedule_type,
       s.cron_expression, s.interval_seconds
FROM import_schedules s
JOIN import_definitions d ON d.id = s.definition_id AND d.enabled = true
WHERE s.enabled = true
  AND s.schedule_type IN ('cron', 'interval')
  AND s.next_run_at <= NOW()
  AND (s.running = false
       OR s.last_heartbeat_at < NOW() - INTERVAL '5 minutes')
ORDER BY s.next_run_at
FOR UPDATE SKIP LOCKED
LIMIT 1
```

Key changes from current (broken) query:
1. `s.definition_id` — correct after rename migration.
2. Added `JOIN import_definitions d ON d.id = s.definition_id AND d.enabled = true`.
3. Added `s.schedule_type IN ('cron', 'interval')` — excludes other types from this loop.
4. All other column references were already structurally correct once the missing columns are added.

---

## 9. Implementation Priority

1. **Blocker — fix first:** Run the schema migration. Without it, the scheduler crashes on every poll cycle.
2. **High priority:** Fix the 5 code bugs listed in §5 (wrong column names in INSERT, missing schedule_id, wrong triggered_by value).
3. **High priority:** Add heartbeat updates from inside `pipeline::execute` (60-second interval, update `import_schedules.last_heartbeat_at` for scheduled runs).
4. **Medium priority:** File arrival poller — add directory listing comparison to the scheduler loop for `schedule_type = 'file_arrival'`.
5. **Medium priority:** Dependency trigger — add post-run hook in `pipeline.rs` to query and spawn dependent definitions.
6. **Lower priority:** Webhook endpoint — new route handler, token validation, debounce logic.
7. **Lower priority:** Watermark state persistence — currently schema exists but pipeline never writes it.

---

## 10. Files to Modify for Implementation

| File | Change |
|---|---|
| `migrations/20260405000001_import_schedules_scheduler_fix.up.sql` | New migration (schema fix) |
| `migrations/20260405000001_import_schedules_scheduler_fix.down.sql` | New migration (rollback) |
| `services/import-service/src/main.rs` | Fix `poll_import_schedules()` — column names, INSERT statement, add file_arrival handling |
| `services/import-service/src/pipeline.rs` | Add heartbeat updates, add dependency post-run hook |
| `services/import-service/src/handlers/import.rs` | Add webhook endpoint handler, fix triggered_by values |
| `services/import-service/Cargo.toml` | No crate changes needed for phase 1 |
