# Connector Behavior Implementation Plan

**Date:** 2026-04-04
**Authority:** `/home/io/io-dev/io/docs/research/connector-behavior/00_MASTER_SYNTHESIS.md`
**Scope:** 8 phases (A through H) — scheduler fix, watermark incremental, file triggers, webhook, streaming, CDC, DCS connectors, frontend UI
**Estimated total duration:** 14-22 weeks

---

## Phase A — Fix the Broken Scheduler + DCS Connector Bugs

### What this delivers

Scheduled imports actually run for the first time. The `poll_import_schedules()` function currently references 7 columns that do not exist in the `import_schedules` DDL, making the entire scheduler non-functional. This phase adds the missing columns, fixes all column reference mismatches, adds heartbeat writing from spawned pipeline tasks to prevent phantom stale-run reclaims, and fixes three high-priority DCS connector correctness bugs (PI eu_range_high, Kepware tag group recursion, Siemens NTLM silent fallback). It also adds DCS health tracking columns so operators can see supplemental connector status.

### Prerequisites

None. This is the first phase and unblocks everything.

### New dependencies (Cargo.toml additions)

None anticipated. The Siemens NTLM fix should attempt to use `reqwest`'s built-in support first. If that is insufficient, evaluate adding `ntlm = "0.2"` (MIT) — but try without it first by using HTTP Basic auth as a fallback with clear logging.

### Database migrations

Create file: `migrations/20260405000001_fix_import_schedules.up.sql`

```sql
-- Phase A: Fix broken import_schedules schema + add DCS health columns
-- Authority: docs/research/connector-behavior/00_MASTER_SYNTHESIS.md §4a, §11

-- 1. Rename import_definition_id -> definition_id on import_schedules
--    Code and design docs both use definition_id; DDL column name was the outlier
ALTER TABLE import_schedules RENAME COLUMN import_definition_id TO definition_id;

-- 2. Add missing columns that the scheduler code already references
ALTER TABLE import_schedules
    ADD COLUMN IF NOT EXISTS cron_expression    VARCHAR(100),
    ADD COLUMN IF NOT EXISTS interval_seconds   INTEGER,
    ADD COLUMN IF NOT EXISTS watch_path         VARCHAR(500),
    ADD COLUMN IF NOT EXISTS watch_pattern      VARCHAR(255),
    ADD COLUMN IF NOT EXISTS timezone           VARCHAR(50) DEFAULT 'UTC',
    ADD COLUMN IF NOT EXISTS running            BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS last_heartbeat_at  TIMESTAMPTZ;

-- 3. Backfill cron_expression and interval_seconds from schedule_config JSONB
--    for any existing schedule rows
UPDATE import_schedules
   SET cron_expression = schedule_config->>'expression'
 WHERE schedule_type = 'cron'
   AND cron_expression IS NULL
   AND schedule_config->>'expression' IS NOT NULL;

UPDATE import_schedules
   SET interval_seconds = (schedule_config->>'interval_seconds')::INTEGER
 WHERE schedule_type = 'interval'
   AND interval_seconds IS NULL
   AND schedule_config->>'interval_seconds' IS NOT NULL;

-- 4. Fix triggered_by CHECK constraint on import_runs
--    Code writes 'scheduled' but constraint only allows 'schedule'.
--    Add 'scheduled' to allowed values so existing code works.
ALTER TABLE import_runs
    DROP CONSTRAINT IF EXISTS import_runs_triggered_by_check;
ALTER TABLE import_runs
    ADD CONSTRAINT import_runs_triggered_by_check
    CHECK (triggered_by IN ('manual', 'schedule', 'scheduled', 'webhook', 'file_arrival', 'dependency', 'retry'));

-- 5. Add DCS supplemental connector health columns to import_connections
ALTER TABLE import_connections
    ADD COLUMN IF NOT EXISTS supplemental_last_polled_at       TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS supplemental_last_error           TEXT,
    ADD COLUMN IF NOT EXISTS supplemental_last_metadata_count  INTEGER,
    ADD COLUMN IF NOT EXISTS supplemental_last_event_count     INTEGER;

-- 6. Add GIN index on schedule_config for dependency schedule lookups
CREATE INDEX IF NOT EXISTS idx_import_schedules_config_gin
    ON import_schedules USING gin (schedule_config);

-- 7. Index for scheduler polling performance
CREATE INDEX IF NOT EXISTS idx_import_schedules_next_run
    ON import_schedules (next_run_at)
    WHERE enabled = true AND running = false;
```

Create file: `migrations/20260405000001_fix_import_schedules.down.sql`

```sql
DROP INDEX IF EXISTS idx_import_schedules_next_run;
DROP INDEX IF EXISTS idx_import_schedules_config_gin;

ALTER TABLE import_connections
    DROP COLUMN IF EXISTS supplemental_last_event_count,
    DROP COLUMN IF EXISTS supplemental_last_metadata_count,
    DROP COLUMN IF EXISTS supplemental_last_error,
    DROP COLUMN IF EXISTS supplemental_last_polled_at;

ALTER TABLE import_runs
    DROP CONSTRAINT IF EXISTS import_runs_triggered_by_check;
ALTER TABLE import_runs
    ADD CONSTRAINT import_runs_triggered_by_check
    CHECK (triggered_by IN ('manual', 'schedule', 'webhook', 'file_arrival', 'dependency', 'retry'));

ALTER TABLE import_schedules
    DROP COLUMN IF EXISTS last_heartbeat_at,
    DROP COLUMN IF EXISTS running,
    DROP COLUMN IF EXISTS timezone,
    DROP COLUMN IF EXISTS watch_pattern,
    DROP COLUMN IF EXISTS watch_path,
    DROP COLUMN IF EXISTS interval_seconds,
    DROP COLUMN IF EXISTS cron_expression;

ALTER TABLE import_schedules RENAME COLUMN definition_id TO import_definition_id;
```

### Files to create

| File | Purpose |
|------|---------|
| `migrations/20260405000001_fix_import_schedules.up.sql` | Schema migration for scheduler columns + DCS health columns |
| `migrations/20260405000001_fix_import_schedules.down.sql` | Rollback migration |

### Files to modify

| File | Changes |
|------|---------|
| `services/import-service/src/main.rs` | Fix `poll_import_schedules()`: correct column names, fix INSERT column, add heartbeat spawning, add `d.enabled` join, add metrics, restrict to `schedule_type IN ('cron', 'interval')` |
| `services/import-service/src/pipeline.rs` | Add `schedule_id` parameter to `execute()`, spawn heartbeat update task |
| `services/import-service/src/connectors/pi_web_api.rs` | Fix `eu_range_high` calculation: change from `Span` to `Zero + Span` |
| `services/import-service/src/connectors/kepware_rest.rs` | Add recursive tag group traversal |
| `services/import-service/src/connectors/siemens_sph_rest.rs` | Replace NTLM warning-and-skip with actual HTTP Basic auth attempt or proper error |
| `services/import-service/src/connectors/db_writes.rs` | Write `supplemental_last_polled_at`, `supplemental_last_error`, `supplemental_last_metadata_count`, `supplemental_last_event_count` after each poll cycle |

### Step-by-step implementation

**Step 1: Apply the migration.**

Create the migration files listed above. Run `sqlx migrate run` from the project root to verify the migration applies cleanly.

**Step 2: Fix `poll_import_schedules()` in `services/import-service/src/main.rs`.**

The function starts at approximately line 248. Make these exact changes:

2a. In the SELECT query (around line 260-271), change `s.definition_id` to `s.definition_id` (it was renamed FROM `import_definition_id` TO `definition_id` in the migration, so this reference is now correct). Add a JOIN to `import_definitions` to check `enabled`:

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
FOR UPDATE OF s SKIP LOCKED
LIMIT 1
```

2b. In the INSERT INTO import_runs (around line 308-315), fix the column name from `trigger` to `triggered_by`, and change the value from `'scheduled'` to `'schedule'` to match the CHECK constraint (we added `'scheduled'` to the constraint as well, but use `'schedule'` going forward for consistency). Also add `schedule_id`:

```sql
INSERT INTO import_runs
    (id, import_definition_id, schedule_id, status, triggered_by, created_at)
VALUES ($1, $2, $3, 'pending', 'schedule', NOW())
```

Bind `schedule_id` as the third parameter.

2c. Change the `pipeline::execute` call to pass `schedule_id` (this requires modifying the function signature — see Step 3).

2d. Do NOT clear `running = false` immediately after spawning the ETL task. Instead, move the `running = false` + `next_run_at` update into a callback that runs AFTER the spawned pipeline task completes. The spawned task block should look like:

```rust
let db_clone = db.clone();
let upload_dir_clone = upload_dir.to_string();
let sched_id = schedule_id;
tokio::spawn(async move {
    let result = pipeline::execute(
        &db_clone,
        run_id,
        definition_id,
        false, // not dry_run
        master_key,
        upload_dir_clone,
        Some(sched_id),
    )
    .await;

    if let Err(e) = &result {
        warn!(
            run_id = %run_id,
            definition_id = %definition_id,
            "scheduled pipeline execution failed: {e}"
        );
    }

    // Clear running flag and advance next_run_at AFTER pipeline completes
    // (compute next_run_at from schedule_type)
    // ... move the next_run_at computation here ...
});
```

Move the entire `next_run_at` computation block (match on schedule_type for cron/interval) and the `UPDATE import_schedules SET running = false` into the spawned task, AFTER `pipeline::execute` returns.

2e. Add scheduler metrics at the top of each poll cycle:

```rust
metrics::counter!("io_import_scheduler_ticks_total").increment(1);
// After claiming a schedule:
metrics::counter!("io_import_scheduler_due_count").increment(1);
```

**Step 3: Add heartbeat to `pipeline::execute()` in `services/import-service/src/pipeline.rs`.**

3a. Add `schedule_id: Option<Uuid>` as a new parameter to `pub async fn execute(...)`.

3b. At the beginning of `execute()`, after marking the run as `running`, spawn a heartbeat task if `schedule_id` is `Some`:

```rust
// Spawn heartbeat updater for scheduled runs
let heartbeat_handle = if let Some(sched_id) = schedule_id {
    let db_hb = db.clone();
    Some(tokio::spawn(async move {
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(60));
        loop {
            interval.tick().await;
            let _ = sqlx::query(
                "UPDATE import_schedules SET last_heartbeat_at = NOW() WHERE id = $1"
            )
            .bind(sched_id)
            .execute(&db_hb)
            .await;
        }
    }))
} else {
    None
};
```

3c. At the end of `execute()` (before the final `Ok(())`), abort the heartbeat task:

```rust
if let Some(handle) = heartbeat_handle {
    handle.abort();
}
```

3d. Update all existing callers of `pipeline::execute()` (in `handlers/import.rs` and `main.rs`) to pass the new `schedule_id` parameter. Manual runs pass `None`.

**Step 4: Fix PI Web API `eu_range_high` bug in `services/import-service/src/connectors/pi_web_api.rs`.**

Find the line (approximately line 109):
```rust
eu_range_high: p.get("Span").and_then(|v| v.as_f64()),
```

Replace with:
```rust
eu_range_high: {
    let zero = p.get("Zero").and_then(|v| v.as_f64()).unwrap_or(0.0);
    let span = p.get("Span").and_then(|v| v.as_f64());
    span.map(|s| zero + s)
},
```

**Step 5: Fix Kepware tag group recursion in `services/import-service/src/connectors/kepware_rest.rs`.**

After fetching device-level tags, add a recursive function that walks tag groups:

```rust
/// Recursively collect tags from nested tag groups within a Kepware device.
async fn collect_tag_group_tags(
    client: &reqwest::Client,
    host: &str,
    ch_name: &str,
    dev_name: &str,
    group_path: &str,
    username: Option<&str>,
    password: Option<&str>,
    all_items: &mut Vec<SupplementalMetadataItem>,
) {
    let groups_url = format!(
        "http://{host}:{CONFIG_PORT}/config/v1/project/channels/{ch_name}/devices/{dev_name}/tag_groups{group_path}"
    );
    let req = if let (Some(u), Some(p)) = (username, password) {
        client.get(&groups_url).basic_auth(u, Some(p))
    } else {
        client.get(&groups_url)
    };
    let groups: serde_json::Value = match req.send().await.and_then(|r| /* check status */) {
        // ... parse response
    };

    if let Some(group_arr) = groups.as_array() {
        for group in group_arr {
            let group_name = match group.get("common.ALLTYPES_NAME").and_then(|v| v.as_str()) {
                Some(n) => n,
                None => continue,
            };
            let sub_path = format!("{group_path}/{group_name}");

            // Fetch tags within this group
            let tags_url = format!(
                "http://{host}:{CONFIG_PORT}/config/v1/project/channels/{ch_name}/devices/{dev_name}/tag_groups{sub_path}/tags"
            );
            // ... fetch and parse tags the same way as device-level tags ...

            // Recurse into sub-groups
            collect_tag_group_tags(client, host, ch_name, dev_name, &sub_path, username, password, all_items).await;
        }
    }
}
```

Call this function after fetching device-level tags, starting with an empty `group_path` of `""`.

**Step 6: Fix Siemens SPH NTLM auth in `services/import-service/src/connectors/siemens_sph_rest.rs`.**

Replace the `if cfg.auth_type == "ntlm"` warning blocks with a proper error that tells the operator what to do:

```rust
if cfg.auth_type == "ntlm" {
    return Err(anyhow!(
        "siemens_sph_rest: NTLM authentication is not yet supported. \
         Configure HTTP Basic auth on the SPH server, or use a reverse proxy \
         that handles NTLM and exposes Basic/Bearer auth to I/O."
    ));
}
```

This is an explicit failure instead of a silent fallback to unauthenticated requests that will be rejected anyway.

**Step 7: Update DCS health tracking in `services/import-service/src/connectors/db_writes.rs` and `main.rs`.**

In `main.rs`, in the `poll_supplemental_connectors()` function, after each connector's fetch_metadata and fetch_events calls complete, update the health columns:

```rust
// After metadata fetch:
let metadata_count = items.len() as i32;
sqlx::query(
    "UPDATE import_connections SET \
     supplemental_last_polled_at = NOW(), \
     supplemental_last_metadata_count = $2, \
     supplemental_last_error = NULL \
     WHERE id = $1"
)
.bind(conn_id)
.bind(metadata_count)
.execute(db)
.await?;

// On error:
sqlx::query(
    "UPDATE import_connections SET \
     supplemental_last_polled_at = NOW(), \
     supplemental_last_error = $2 \
     WHERE id = $1"
)
.bind(conn_id)
.bind(e.to_string())
.execute(db)
.await?;
```

Similarly for event count.

### Acceptance criteria

- [ ] Migration applies cleanly on a fresh database (`sqlx migrate run` succeeds)
- [ ] Migration applies cleanly on a database with existing `import_schedules` rows
- [ ] `cargo build -p import-service` compiles without errors
- [ ] `cargo clippy -p import-service -- -D warnings` passes
- [ ] Creating an interval schedule via API (`POST /import/definitions/:id/schedules` with `schedule_type: "interval"`, `interval_seconds: 60`) results in the scheduler firing the pipeline within 90 seconds
- [ ] Creating a cron schedule via API results in the scheduler computing the correct `next_run_at`
- [ ] A scheduled pipeline run that takes >30 seconds does NOT get reclaimed (heartbeat prevents stale detection)
- [ ] Disabled definitions (`enabled = false`) are NOT picked up by the scheduler even if they have active schedules
- [ ] PI Web API connector stores `eu_range_high = Zero + Span` (not just Span)
- [ ] Kepware connector discovers tags inside nested tag groups (not just device-level tags)
- [ ] Siemens SPH connector returns an explicit error when NTLM auth is configured (no silent fallback)
- [ ] After a DCS supplemental poll cycle, `import_connections.supplemental_last_polled_at` is populated

### Implementation prompt for this phase

```
You are implementing Phase A of the connector behavior plan for the I/O import service.

READ THE PLAN FIRST: /home/io/io-dev/io/docs/connector-behavior-plan.md — read the entire "Phase A" section before writing any code.

OBJECTIVE: Fix the broken import scheduler and three DCS connector bugs. After this phase, scheduled imports (cron and interval types) will actually fire for the first time.

CRITICAL CONTEXT — CURRENT BUGS:
1. The `import_schedules` table is missing 7 columns that `poll_import_schedules()` references. The scheduler cannot execute any query and silently fails. A schema migration is required.
2. The INSERT into `import_runs` uses column name `trigger` but the actual column is `triggered_by`. The value `'scheduled'` does not match the CHECK constraint which requires `'schedule'`.
3. The spawned pipeline task never writes `last_heartbeat_at`, making stale-run recovery non-functional. Any run taking >5 minutes will be re-triggered.
4. The scheduler does not check `import_definitions.enabled`, so disabled definitions with active schedules still fire.
5. PI Web API stores Span (a delta) in eu_range_high instead of Zero+Span (the absolute upper bound).
6. Kepware connector only fetches device-level tags, missing all tags inside nested tag groups.
7. Siemens SPH logs a warning for NTLM auth and proceeds unauthenticated — all requests are then rejected by the server.

FILES TO CREATE:
- migrations/20260405000001_fix_import_schedules.up.sql (exact SQL is in the plan)
- migrations/20260405000001_fix_import_schedules.down.sql (exact SQL is in the plan)

FILES TO MODIFY:
1. services/import-service/src/main.rs — Fix poll_import_schedules() function (starts ~line 248):
   - Fix SELECT: change s.definition_id (already correct after rename), add JOIN import_definitions d ON d.id = s.definition_id AND d.enabled = true, add WHERE s.schedule_type IN ('cron', 'interval')
   - Fix INSERT: column "trigger" -> "triggered_by", value 'scheduled' -> 'schedule', add schedule_id column
   - Move running=false and next_run_at update INTO the spawned task (after pipeline::execute returns)
   - Add schedule_id to the pipeline::execute call as Some(schedule_id)
   - Add metrics: io_import_scheduler_ticks_total, io_import_scheduler_due_count
   - Update the supplemental connector poll loop to write health columns after each connector

2. services/import-service/src/pipeline.rs — Modify execute() function:
   - Add parameter: schedule_id: Option<Uuid>
   - Spawn a heartbeat task that updates import_schedules.last_heartbeat_at every 60 seconds when schedule_id is Some
   - Abort the heartbeat task at the end of execute()

3. services/import-service/src/connectors/pi_web_api.rs:
   - Find: eu_range_high: p.get("Span").and_then(|v| v.as_f64()),
   - Replace with: eu_range_high = Zero + Span (see plan for exact code)

4. services/import-service/src/connectors/kepware_rest.rs:
   - Add recursive tag group traversal function
   - Call it after fetching device-level tags for each device
   - The Kepware Config API path for tag groups is: /config/v1/project/channels/{ch}/devices/{dev}/tag_groups
   - Each tag group can contain nested tag_groups (recursive)

5. services/import-service/src/connectors/siemens_sph_rest.rs:
   - Replace NTLM warning+continue with an explicit error return

6. services/import-service/src/connectors/db_writes.rs (or directly in main.rs poll loop):
   - After each supplemental connector poll, UPDATE import_connections SET supplemental_last_polled_at, supplemental_last_error, supplemental_last_metadata_count, supplemental_last_event_count

7. services/import-service/src/handlers/import.rs — Update all calls to pipeline::execute() to pass None for schedule_id

CONSTRAINTS:
- Do NOT change any existing API endpoint behavior
- Do NOT modify the EtlConnector trait
- All existing manual run functionality must continue working
- The migration must be safe for tables that already have data
- Use IF NOT EXISTS / IF EXISTS in migration DDL where possible

VERIFY:
- cargo build -p import-service
- cargo clippy -p import-service -- -D warnings
- cargo test -p import-service (if tests exist)
```

---

## Phase B — Watermark / Incremental for All DB and REST Connectors

### What this delivers

All five database connectors (PostgreSQL, MySQL, MSSQL, ODBC, MongoDB) and the Generic REST connector support incremental polling via watermark state. On each scheduled run, the pipeline reads the previous run's watermark, passes it to the connector, the connector injects it into its query as a WHERE clause parameter, and the pipeline writes the new high-water mark after a successful commit. This eliminates full-table re-extraction on every poll cycle. Additionally, `source_row_id` is fixed to use a user-configured field value for deduplication, and the REST connector gains link-header pagination support.

### Prerequisites

Phase A must be complete (scheduler functional, schema migration applied).

### New dependencies (Cargo.toml additions)

None. All database drivers are already in the workspace.

### Database migrations

Create file: `migrations/20260407000001_watermark_dedup.up.sql`

```sql
-- Phase B: Watermark state support + deduplication index

-- 1. Add unique partial index for upsert-based deduplication in custom_import_data
--    This enables ON CONFLICT (import_definition_id, source_row_id) DO UPDATE
--    when source_row_id is non-null (configured via id_field)
CREATE UNIQUE INDEX IF NOT EXISTS custom_import_data_dedup_idx
    ON custom_import_data (import_definition_id, source_row_id)
    WHERE source_row_id IS NOT NULL;
```

Create file: `migrations/20260407000001_watermark_dedup.down.sql`

```sql
DROP INDEX IF EXISTS custom_import_data_dedup_idx;
```

### Files to create

| File | Purpose |
|------|---------|
| `migrations/20260407000001_watermark_dedup.up.sql` | Deduplication unique index |
| `migrations/20260407000001_watermark_dedup.down.sql` | Rollback |

### Files to modify

| File | Changes |
|------|---------|
| `services/import-service/src/connectors/etl/mod.rs` | Add `watermark_state: Option<JsonValue>` field to `EtlConnectorConfig` |
| `services/import-service/src/pipeline.rs` | Read previous watermark before extract, pass to connector, write new watermark after commit, fix `source_row_id` to use `id_field`, change load to use upsert |
| `services/import-service/src/connectors/etl/sql_postgres.rs` | Add watermark injection into query |
| `services/import-service/src/connectors/etl/sql_mysql.rs` | Add watermark injection into query |
| `services/import-service/src/connectors/etl/sql_mssql.rs` | Add watermark injection into query + MSSQL Change Tracking mode |
| `services/import-service/src/connectors/etl/odbc.rs` | Add watermark string substitution into query |
| `services/import-service/src/connectors/etl/mongodb.rs` | Add watermark filter to find query |
| `services/import-service/src/connectors/etl/rest.rs` | Add watermark param injection + link-header pagination |

### Step-by-step implementation

**Step 1: Add `watermark_state` to `EtlConnectorConfig`.**

In `services/import-service/src/connectors/etl/mod.rs`, add to the `EtlConnectorConfig` struct:

```rust
/// Previous run's watermark state (None on first run or when watermark is not configured).
/// Shape: { "watermark_type": "timestamp"|"integer", "watermark_column": "col", "last_value": "..." }
pub watermark_state: Option<JsonValue>,
```

**Step 2: Read previous watermark in `pipeline.rs`.**

In the `execute()` function, after fetching the import definition row but before calling `run_pipeline_in_tx`, query for the previous watermark:

```rust
// Read previous watermark from the latest successful run
let prev_watermark: Option<JsonValue> = sqlx::query_scalar(
    "SELECT watermark_state FROM import_runs \
     WHERE import_definition_id = $1 \
       AND status IN ('completed', 'partial') \
       AND watermark_state IS NOT NULL \
     ORDER BY completed_at DESC \
     LIMIT 1"
)
.bind(def_id)
.fetch_optional(db)
.await?;
```

Pass this into the `EtlConnectorConfig` when constructing it inside `extract_records()`.

**Step 3: Modify `extract_records()` to pass watermark.**

The `extract_records()` function currently constructs `EtlConnectorConfig` in its ETL dispatch path. Add `prev_watermark: Option<JsonValue>` as a parameter, and set it on the config:

```rust
let etl_cfg = EtlConnectorConfig {
    connection_id: conn_id,
    connection_config: config,
    auth_type,
    auth_config,
    source_config: source_config.clone(),
    upload_dir: upload_dir.to_string(),
    watermark_state: prev_watermark,
};
```

**Step 4: Implement watermark injection in each DB connector.**

The pattern is the same for all SQL connectors. In each connector's `extract()` method, check for `watermark_state` and modify the query:

For PostgreSQL (`sql_postgres.rs`), MySQL (`sql_mysql.rs`), MSSQL (`sql_mssql.rs`):

```rust
// After reading the user's query from source_config:
let mut effective_query = sql.to_string();

if let Some(ref wm) = cfg.watermark_state {
    let wm_column = cfg.source_config
        .get("watermark_column")
        .and_then(|v| v.as_str());
    let wm_type = wm.get("watermark_type")
        .and_then(|v| v.as_str())
        .unwrap_or("timestamp");
    let last_value = wm.get("last_value")
        .and_then(|v| v.as_str());

    if let (Some(col), Some(val)) = (wm_column, last_value) {
        // Apply safety lookback for timestamp watermarks
        let lookback_seconds = cfg.source_config
            .get("watermark_lookback_seconds")
            .and_then(|v| v.as_i64())
            .unwrap_or(120);

        // Wrap the user's query and add a WHERE clause
        // If the user's query already has a WHERE, this approach uses a subquery
        if wm_type == "timestamp" {
            effective_query = format!(
                "SELECT * FROM ({effective_query}) _wm \
                 WHERE _wm.\"{col}\" > (TIMESTAMP '{val}' - INTERVAL '{lookback_seconds} seconds')"
            );
        } else {
            // Integer watermark — no lookback needed
            effective_query = format!(
                "SELECT * FROM ({effective_query}) _wm \
                 WHERE _wm.\"{col}\" > {val}"
            );
        }
    }
}
```

Note: For ODBC, use string substitution since ODBC does not support subqueries uniformly. Check for a `{{WATERMARK}}` placeholder in the query and replace it:

```rust
if let Some(ref wm) = cfg.watermark_state {
    if let Some(val) = wm.get("last_value").and_then(|v| v.as_str()) {
        effective_query = effective_query.replace("{{WATERMARK}}", val);
    }
}
```

For MongoDB, add a filter document:

```rust
let mut filter = base_filter.clone(); // from source_config.filter
if let Some(ref wm) = cfg.watermark_state {
    let wm_column = cfg.source_config
        .get("watermark_column")
        .and_then(|v| v.as_str());
    let last_value = wm.get("last_value")
        .and_then(|v| v.as_str());

    if let (Some(col), Some(val)) = (wm_column, last_value) {
        let wm_type = wm.get("watermark_type")
            .and_then(|v| v.as_str())
            .unwrap_or("timestamp");
        if wm_type == "objectid" {
            if let Ok(oid) = bson::oid::ObjectId::parse_str(val) {
                filter.insert(col, bson::doc! { "$gt": oid });
            }
        } else {
            // Assume timestamp string in ISO format
            if let Ok(dt) = chrono::DateTime::parse_from_rfc3339(val) {
                filter.insert(col, bson::doc! { "$gt": bson::DateTime::from(dt) });
            }
        }
    }
}
```

**Step 5: Compute and write new watermark after successful run.**

In `pipeline.rs`, after `tx.commit()` succeeds (and the run is not a dry_run), compute the new watermark from the extracted records:

```rust
// Compute new watermark if watermark_column is configured
if !dry_run {
    let wm_column = source_config
        .get("watermark_column")
        .and_then(|v| v.as_str());

    if let Some(col) = wm_column {
        let wm_type = source_config
            .get("watermark_type")
            .and_then(|v| v.as_str())
            .unwrap_or("timestamp");

        // Find the max value of the watermark column across all extracted records
        let mut max_value: Option<String> = None;
        for rec in &source_records {
            if let Some(val) = rec.fields.get(col).and_then(|v| v.as_str()) {
                if max_value.as_ref().map_or(true, |m| val > m.as_str()) {
                    max_value = Some(val.to_string());
                }
            }
        }

        if let Some(val) = max_value {
            let new_watermark = serde_json::json!({
                "watermark_type": wm_type,
                "watermark_column": col,
                "last_value": val,
                "last_run_completed_at": chrono::Utc::now().to_rfc3339(),
            });

            // Write snapshot to import_runs
            sqlx::query(
                "UPDATE import_runs SET watermark_state = $2 WHERE id = $1"
            )
            .bind(run_id)
            .bind(&new_watermark)
            .execute(db)
            .await?;
        }
    }
}
```

**Step 6: Fix `source_row_id` to use configured `id_field`.**

In `pipeline.rs`, in the `load_records()` function, change:

```rust
let source_row_id = record.row_number.to_string();
```

To:

```rust
let id_field = source_config
    .get("id_field")
    .and_then(|v| v.as_str());
let source_row_id = if let Some(field) = id_field {
    record.fields.get(field)
        .and_then(|v| match v {
            JsonValue::String(s) => Some(s.clone()),
            JsonValue::Number(n) => Some(n.to_string()),
            _ => None,
        })
        .unwrap_or_else(|| record.row_number.to_string())
} else {
    record.row_number.to_string()
};
```

This requires passing `source_config` into `load_records()`.

**Step 7: Change load to use upsert when `source_row_id` is populated from `id_field`.**

When `id_field` is configured, use `INSERT ... ON CONFLICT DO UPDATE`:

```rust
let use_upsert = source_config
    .get("id_field")
    .and_then(|v| v.as_str())
    .is_some();

if use_upsert {
    sqlx::query(
        "INSERT INTO custom_import_data \
         (import_definition_id, data, source_row_id, imported_at) \
         VALUES ($1, $2, $3, NOW()) \
         ON CONFLICT (import_definition_id, source_row_id) \
         WHERE source_row_id IS NOT NULL \
         DO UPDATE SET data = EXCLUDED.data, imported_at = NOW()"
    )
    // ...
} else {
    // Original INSERT without ON CONFLICT
}
```

**Step 8: Add link-header pagination to `GenericRestConnector`.**

In `services/import-service/src/connectors/etl/rest.rs`, in the `extract()` method, add a new pagination type `"link_header"`. Before the `match pagination_type` block, capture the response headers:

```rust
let resp = apply_auth_etl(req, cfg).send().await?;
if !resp.status().is_success() {
    return Err(anyhow!("..."));
}

// Extract Link header for link_header pagination before consuming body
let link_next = if pagination_type == "link_header" {
    resp.headers()
        .get("link")
        .and_then(|v| v.to_str().ok())
        .and_then(|link_str| parse_link_next(link_str))
        .map(|s| s.to_string())
} else {
    None
};

let body: JsonValue = resp.json().await?;
```

Add a helper function:

```rust
/// Parse the `next` URL from a Link header value.
/// Format: `<https://example.com/api?page=2>; rel="next", <...>; rel="last"`
fn parse_link_next(link_header: &str) -> Option<&str> {
    for part in link_header.split(',') {
        let part = part.trim();
        if part.contains("rel=\"next\"") || part.contains("rel=next") {
            if let Some(url) = part.split('>').next() {
                return Some(url.trim_start_matches('<'));
            }
        }
    }
    None
}
```

Add the pagination match arm:

```rust
"link_header" => {
    if let Some(next) = link_next {
        next_url = Some(next);
    }
}
```

**Step 9: Add watermark parameter injection to REST connector.**

In the REST connector's `extract()`, before building the first request URL, check for watermark configuration:

```rust
let watermark_param = cfg.source_config
    .get("watermark_param")
    .and_then(|v| v.as_str());
let watermark_value = cfg.watermark_state
    .as_ref()
    .and_then(|wm| wm.get("last_value"))
    .and_then(|v| v.as_str());

let mut effective_url = url.clone();
if let (Some(param), Some(val)) = (watermark_param, watermark_value) {
    let sep = if effective_url.contains('?') { "&" } else { "?" };
    effective_url = format!("{effective_url}{sep}{param}={val}");
}
```

Use `effective_url` as the starting URL. After extracting records, compute the new watermark from the configured `watermark_field`:

```rust
let watermark_field = cfg.source_config
    .get("watermark_field")
    .and_then(|v| v.as_str());
// Find max value across all records for this field
```

### Acceptance criteria

- [ ] Migration applies cleanly
- [ ] `cargo build -p import-service` compiles
- [ ] `cargo clippy -p import-service -- -D warnings` passes
- [ ] A PostgreSQL connector with `watermark_column: "updated_at"` extracts only rows newer than the previous watermark on second run
- [ ] `source_row_id` contains the value of the configured `id_field` (not the batch row number)
- [ ] Duplicate rows (same `source_row_id`) are upserted, not duplicated
- [ ] REST connector with `pagination_type: "link_header"` follows Link headers
- [ ] REST connector with `watermark_param: "since"` injects the previous watermark value into the query string
- [ ] `import_runs.watermark_state` is populated after a successful watermark-enabled run
- [ ] MongoDB connector with `watermark_column: "updatedAt"` extracts only newer documents

### Implementation prompt for this phase

```
You are implementing Phase B of the connector behavior plan for the I/O import service.

READ THE PLAN FIRST: /home/io/io-dev/io/docs/connector-behavior-plan.md — read the entire "Phase B" section before writing any code.

PREREQUISITE: Phase A must be complete. The scheduler migration must have been applied.

OBJECTIVE: Add watermark-based incremental polling to all 5 DB connectors and the REST connector. Fix source_row_id to use a configurable id_field. Add upsert deduplication. Add link-header pagination to the REST connector.

KEY CONTEXT:
- The EtlConnectorConfig struct is in services/import-service/src/connectors/etl/mod.rs
- The pipeline entry point is services/import-service/src/pipeline.rs — execute() function
- The import_runs table already has a watermark_state JSONB column (never written)
- The custom_import_data table needs a unique partial index for upsert (in the migration)
- DB connectors: sql_postgres.rs, sql_mysql.rs, sql_mssql.rs, odbc.rs, mongodb.rs (all in connectors/etl/)
- REST connector: connectors/etl/rest.rs

WATERMARK PATTERN (same for all connectors):
1. Pipeline reads previous watermark from latest completed import_run for this definition
2. Watermark is passed to connector via EtlConnectorConfig.watermark_state
3. Connector injects watermark into its query (WHERE col > watermark_value)
4. For timestamp watermarks, subtract a safety lookback (default 120s) to handle clock skew
5. Pipeline computes new high-water mark from extracted records' max value
6. Pipeline writes new watermark to import_runs.watermark_state after commit

WATERMARK JSON SHAPE:
{
  "watermark_type": "timestamp" | "integer" | "objectid",
  "watermark_column": "updated_at",
  "last_value": "2026-04-04T12:00:00Z",
  "last_run_completed_at": "2026-04-04T12:05:00Z"
}

SOURCE_ROW_ID FIX:
- Currently set to batch row number (useless for deduplication)
- Change to use source_config.id_field value from the record when configured
- Add upsert via ON CONFLICT (import_definition_id, source_row_id) DO UPDATE

LINK-HEADER PAGINATION:
- New pagination_type "link_header" in REST connector
- Parse Link response header for rel="next" URL
- Follow until no more next links or max_pages reached

FILES TO CREATE:
- migrations/20260407000001_watermark_dedup.up.sql
- migrations/20260407000001_watermark_dedup.down.sql

FILES TO MODIFY:
- services/import-service/src/connectors/etl/mod.rs — add watermark_state field
- services/import-service/src/pipeline.rs — read/write watermark, fix source_row_id, upsert
- services/import-service/src/connectors/etl/sql_postgres.rs — watermark injection
- services/import-service/src/connectors/etl/sql_mysql.rs — watermark injection
- services/import-service/src/connectors/etl/sql_mssql.rs — watermark injection + CT mode
- services/import-service/src/connectors/etl/odbc.rs — watermark substitution ({{WATERMARK}} placeholder)
- services/import-service/src/connectors/etl/mongodb.rs — watermark filter
- services/import-service/src/connectors/etl/rest.rs — watermark param injection + link-header pagination

CONSTRAINTS:
- Do NOT change the EtlConnector trait interface (extract() signature stays the same — watermark flows through EtlConnectorConfig)
- All existing manual run functionality must continue working (watermark is optional)
- Safety lookback default is 120 seconds for timestamp watermarks
- ODBC uses string substitution ({{WATERMARK}}) because it cannot use subquery wrapping reliably

VERIFY:
- cargo build -p import-service
- cargo clippy -p import-service -- -D warnings
- cargo test -p import-service
```

---

## Phase C — File-Based Trigger Modes (SFTP Directory Polling, FTP, Local Filesystem)

### What this delivers

The SFTP connector is extended from single-file download to directory polling with glob pattern matching, mtime-based deduplication, and post-processing archival. A new FTP connector provides the same capability over FTP/FTPS. A local filesystem connector handles watched directories. The `file_arrival` schedule type is supported by the scheduler loop using a directory-listing comparison approach (consistent polling model across all three watch types). A shared `FilePollingState` struct provides deduplication logic for all file-based connectors.

### Prerequisites

Phase A must be complete (scheduler functional). Phase B is not strictly required but is recommended (watermark infrastructure is reused for file deduplication state).

### New dependencies (Cargo.toml additions)

```toml
# In services/import-service/Cargo.toml [dependencies]
glob = "0.3"           # MIT OR Apache-2.0 — filename pattern matching
suppaftp = { version = "6", default-features = false, features = ["async-rustls"] }  # MIT OR Apache-2.0 — FTP/FTPS
```

### Database migrations

None. File polling state is stored in `import_runs.watermark_state` JSONB using the `"seen"` key from the unified watermark envelope, and in `import_schedules.schedule_config` for the `file_arrival` schedule type.

### Files to create

| File | Purpose |
|------|---------|
| `services/import-service/src/connectors/etl/file_polling.rs` | Shared `FilePollingState` struct and deduplication logic |
| `services/import-service/src/connectors/etl/ftp.rs` | FTP/FTPS connector using `suppaftp` |
| `services/import-service/src/connectors/etl/local_file.rs` | Local filesystem connector for watched directories |

### Files to modify

| File | Changes |
|------|---------|
| `services/import-service/Cargo.toml` | Add `glob` and `suppaftp` dependencies |
| `services/import-service/src/connectors/etl/mod.rs` | Register `ftp` and `local_file` connector types, add `pub mod file_polling`, `pub mod ftp`, `pub mod local_file` |
| `services/import-service/src/connectors/etl/sftp.rs` | Add `poll_directory()` method with glob matching and mtime deduplication; keep single-file `remote_path` as backward compat |
| `services/import-service/src/main.rs` | Add `file_arrival` schedule type handling in `poll_import_schedules()` |

### Step-by-step implementation

**Step 1: Create `file_polling.rs` with shared deduplication state.**

```rust
//! Shared file polling state and deduplication for SFTP, FTP, S3, and local file connectors.

use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;
use std::collections::HashMap;

/// State tracking for file-based polling connectors.
/// Serialized as part of the watermark_state JSONB.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct FilePollingState {
    /// Map of filename -> file metadata (mtime, size) for deduplication.
    /// A file is "new" if it is not in this map or if its mtime/size changed.
    pub seen: HashMap<String, SeenFile>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SeenFile {
    pub mtime: i64,    // Unix timestamp
    pub size: u64,
}

impl FilePollingState {
    /// Load from a watermark_state JSONB value.
    pub fn from_watermark(wm: Option<&JsonValue>) -> Self {
        wm.and_then(|v| v.get("seen"))
            .and_then(|v| serde_json::from_value(v.clone()).ok())
            .map(|seen| FilePollingState { seen })
            .unwrap_or_default()
    }

    /// Convert to a watermark_state JSONB value.
    pub fn to_watermark(&self) -> JsonValue {
        serde_json::json!({
            "watermark_type": "file_poll",
            "seen": self.seen,
        })
    }

    /// Check if a file is new or modified.
    pub fn is_new(&self, filename: &str, mtime: i64, size: u64) -> bool {
        match self.seen.get(filename) {
            None => true,
            Some(prev) => prev.mtime != mtime || prev.size != size,
        }
    }

    /// Mark a file as seen.
    pub fn mark_seen(&mut self, filename: String, mtime: i64, size: u64) {
        self.seen.insert(filename, SeenFile { mtime, size });
    }
}

/// Check if a filename matches a glob pattern.
pub fn matches_pattern(filename: &str, pattern: &str) -> bool {
    glob::Pattern::new(pattern)
        .map(|p| p.matches(filename))
        .unwrap_or(false)
}
```

**Step 2: Extend `SftpConnector` with directory polling.**

In `sftp.rs`, add a `poll_directory()` method that:
- Checks for `remote_dir` in `source_config` (if absent, falls back to existing `remote_path` single-file behavior)
- Calls `sftp.read_dir(remote_dir)` to list files
- Filters by `file_pattern` glob (e.g., `"*.xlsx"`)
- Compares against `FilePollingState` from the watermark
- Downloads each new file, dispatches to the format parser
- Optionally renames processed files to an `archive_dir` if configured
- Returns aggregated `SourceRecord`s from all processed files

```rust
async fn extract(&self, cfg: &EtlConnectorConfig) -> Result<Vec<SourceRecord>> {
    // Check if this is directory polling or single-file mode
    let remote_dir = cfg.source_config.get("remote_dir").and_then(|v| v.as_str());

    if let Some(dir) = remote_dir {
        self.poll_directory(cfg, dir).await
    } else {
        // Existing single-file extraction
        let file_format = cfg.source_config.get("file_format")
            .and_then(|v| v.as_str()).unwrap_or("csv");
        let (inline_cfg, temp_path) = Self::download_to_temp(cfg).await?;
        let result = dispatch_to_parser(file_format, &inline_cfg).await;
        let _ = tokio::fs::remove_file(&temp_path).await;
        result
    }
}
```

**Step 3: Create the FTP connector in `ftp.rs`.**

Mirror the SFTP connector structure but use `suppaftp::AsyncFtpStream`:
- `open_ftp()` establishes FTP connection (with optional TLS via `secure()`)
- `poll_directory()` lists the remote directory, matches patterns, downloads new files
- Uses `FilePollingState` for deduplication
- Dispatches to the same file parsers as SFTP

Register in `mod.rs`:
```rust
pub mod ftp;
// In get_etl_connector:
"ftp" => Some(Box::new(ftp::FtpConnector)),
```

**Step 4: Create the local filesystem connector in `local_file.rs`.**

Simple connector that:
- Reads `watch_dir` from `source_config`
- Lists files in the directory using `tokio::fs::read_dir`
- Filters by `file_pattern` glob
- Compares against `FilePollingState` for deduplication
- Reads each new file and dispatches to the format parser
- Optionally moves processed files to `archive_dir`

Register in `mod.rs`:
```rust
pub mod local_file;
// In get_etl_connector:
"local_file" => Some(Box::new(local_file::LocalFileConnector)),
```

**Step 5: Add `file_arrival` schedule type to the scheduler.**

In `main.rs`, in `poll_import_schedules()`, expand the `schedule_type IN ('cron', 'interval')` filter to include `'file_arrival'`. For `file_arrival` schedules, the `next_run_at` is computed as `NOW() + poll_interval_seconds` from `schedule_config` (default 60 seconds).

The file_arrival schedule type works identically to interval — the connector itself handles deduplication via `FilePollingState`. If no new files are found, the pipeline produces zero extracted rows, which results in a fast no-op run.

Add the `next_run_at` computation:
```rust
"file_arrival" => {
    let poll_interval = schedule_config
        .get("poll_interval_seconds")
        .and_then(|v| v.as_i64())
        .unwrap_or(60);
    Some(chrono::Utc::now() + chrono::Duration::seconds(poll_interval))
}
```

Also read `schedule_config` from the schedule row (add it to the SELECT query).

### Acceptance criteria

- [ ] `cargo build -p import-service` compiles
- [ ] `cargo clippy -p import-service -- -D warnings` passes
- [ ] SFTP connector with `remote_dir` + `file_pattern: "*.csv"` lists the directory and downloads matching files
- [ ] On second run, previously-seen files (same mtime/size) are skipped
- [ ] FTP connector connects, lists directory, downloads, and parses files
- [ ] Local filesystem connector reads from a watch directory and parses files
- [ ] `file_arrival` schedule type fires at the configured poll interval
- [ ] Processed files are moved to `archive_dir` when configured
- [ ] Backward compatibility: SFTP with `remote_path` (no `remote_dir`) still works as single-file download

### Implementation prompt for this phase

```
You are implementing Phase C of the connector behavior plan for the I/O import service.

READ THE PLAN FIRST: /home/io/io-dev/io/docs/connector-behavior-plan.md — read the entire "Phase C" section before writing any code.

PREREQUISITE: Phase A must be complete (scheduler functional).

OBJECTIVE: Add file-based trigger modes. Extend SFTP connector with directory polling. Create FTP and local filesystem connectors. Add file_arrival schedule type.

FILES TO CREATE:
1. services/import-service/src/connectors/etl/file_polling.rs — shared FilePollingState struct (see plan for exact code)
2. services/import-service/src/connectors/etl/ftp.rs — FTP/FTPS connector using suppaftp crate
3. services/import-service/src/connectors/etl/local_file.rs — local filesystem connector

FILES TO MODIFY:
1. services/import-service/Cargo.toml — add glob = "0.3" and suppaftp = { version = "6", default-features = false, features = ["async-rustls"] }
2. services/import-service/src/connectors/etl/mod.rs — add pub mod file_polling, ftp, local_file; register "ftp" and "local_file" in get_etl_connector()
3. services/import-service/src/connectors/etl/sftp.rs — add poll_directory() method, modify extract() to check for remote_dir vs remote_path
4. services/import-service/src/main.rs — add 'file_arrival' to schedule_type filter in poll_import_schedules(), add next_run_at computation for file_arrival

KEY DESIGN DECISIONS:
- All file polling (SFTP, FTP, local, S3) uses the same polling model — directory listing comparison on each scheduler tick
- No inotify/notify crate — consistent polling approach across all transport types
- FilePollingState tracks seen files as { filename: { mtime, size } } in watermark_state JSONB
- File pattern matching uses the `glob` crate's Pattern::matches()
- FTP uses suppaftp with async-rustls feature for FTPS support
- Archive: rename processed files to archive_dir (configurable, optional)

SFTP DIRECTORY POLLING:
- If source_config has "remote_dir" -> directory polling mode
- If source_config has "remote_path" -> single-file mode (existing behavior, preserved)
- In directory mode: sftp.read_dir(dir) -> filter by file_pattern -> check FilePollingState -> download new files -> dispatch to parser -> archive if configured

FTP CONNECTOR (suppaftp):
- Connection: AsyncFtpStream::connect(host:port) -> .login(user, pass) -> optionally .secure() for FTPS
- Directory listing: .nlst(remote_dir) or .list(remote_dir) -> parse filenames and sizes
- Download: .retr_as_buffer(path) -> bytes -> dispatch to parser
- Same FilePollingState deduplication as SFTP

LOCAL FILE CONNECTOR:
- tokio::fs::read_dir(watch_dir) -> filter by file_pattern -> check FilePollingState -> read file -> dispatch to parser
- Optionally move processed files: tokio::fs::rename(from, archive_dir/filename)

CONSTRAINTS:
- Keep backward compatibility for SFTP single-file mode
- No new database migrations needed
- All file connectors must handle the case where the remote directory does not exist (log warning, return empty)

VERIFY:
- cargo build -p import-service
- cargo clippy -p import-service -- -D warnings
- cargo test -p import-service
```

---

## Phase D — Webhook Receiver + S3 Connector

### What this delivers

External systems can push data to I/O without polling via a webhook endpoint. The webhook receiver accepts POST requests with HMAC-SHA256 signature validation, writes payloads to a durable PostgreSQL buffer table, and a background drain task processes them through the normal pipeline. An S3 connector is added for polling object storage with `list_objects_v2` and `LastModified`-based watermark deduplication. The webhook path requires an API Gateway route exception for unauthenticated access.

### Prerequisites

Phase A must be complete. Phase C is recommended (shared `FilePollingState` for S3 deduplication).

### New dependencies (Cargo.toml additions)

```toml
# In services/import-service/Cargo.toml [dependencies]
aws-sdk-s3 = "1"       # Apache-2.0 — S3 connector
aws-config = "1"        # Apache-2.0 — AWS credential chain
hmac = "0.12"           # MIT OR Apache-2.0 — HMAC computation
sha2 = "0.10"           # MIT OR Apache-2.0 — SHA-256
constant_time_eq = "0.3"  # CC0 — timing-safe comparison
```

Note: `hex` is already in the workspace.

### Database migrations

Create file: `migrations/20260414000001_webhook_buffer.up.sql`

```sql
-- Phase D: Webhook buffer table for durable webhook event processing

CREATE TABLE import_webhook_buffer (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_definition_id UUID NOT NULL REFERENCES import_definitions(id) ON DELETE CASCADE,
    payload              JSONB NOT NULL,
    headers              JSONB DEFAULT '{}',
    received_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at         TIMESTAMPTZ,
    processing_status    VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (processing_status IN ('pending', 'processing', 'done', 'failed')),
    error_message        TEXT,
    retry_count          INTEGER NOT NULL DEFAULT 0,
    max_retries          INTEGER NOT NULL DEFAULT 3
);

-- Partial index for drain task performance: only pending rows
CREATE INDEX idx_webhook_buffer_pending
    ON import_webhook_buffer (import_definition_id, received_at)
    WHERE processing_status = 'pending';

-- Index for buffer depth check (rate limiting)
CREATE INDEX idx_webhook_buffer_depth
    ON import_webhook_buffer (import_definition_id)
    WHERE processing_status IN ('pending', 'processing');
```

Create file: `migrations/20260414000001_webhook_buffer.down.sql`

```sql
DROP TABLE IF EXISTS import_webhook_buffer;
```

### Files to create

| File | Purpose |
|------|---------|
| `migrations/20260414000001_webhook_buffer.up.sql` | Webhook buffer table |
| `migrations/20260414000001_webhook_buffer.down.sql` | Rollback |
| `services/import-service/src/connectors/etl/s3.rs` | S3 object storage connector |
| `services/import-service/src/handlers/webhook.rs` | Webhook receiver endpoint + secret management |

### Files to modify

| File | Changes |
|------|---------|
| `services/import-service/Cargo.toml` | Add `aws-sdk-s3`, `aws-config`, `hmac`, `sha2`, `constant_time_eq` |
| `services/import-service/src/main.rs` | Add webhook routes (outside service_secret middleware), spawn webhook drain background task |
| `services/import-service/src/connectors/etl/mod.rs` | Register S3 connector type |
| `services/import-service/src/handlers/mod.rs` | Add `pub mod webhook;` (or add to existing import.rs) |
| `services/api-gateway/src/main.rs` | Add route exception for `/api/import/webhooks/*` to bypass JWT validation |

### Step-by-step implementation

**Step 1: Create the S3 connector in `s3.rs`.**

```rust
//! S3 / S3-compatible object storage ETL connector.
//!
//! Polls `list_objects_v2` with prefix filtering and `LastModified`-based watermark
//! deduplication. Supports configurable `endpoint_url` for MinIO, Ceph, etc.

use anyhow::{anyhow, Result};
use aws_sdk_s3::Client as S3Client;
use serde_json::Value as JsonValue;

use super::{EtlConnector, EtlConnectorConfig};
use super::file_polling::{FilePollingState, matches_pattern};
use crate::pipeline::SourceRecord;
use crate::handlers::import::{SchemaTable};

pub struct S3FileConnector;

impl S3FileConnector {
    async fn build_client(cfg: &EtlConnectorConfig) -> Result<S3Client> {
        let endpoint_url = cfg.connection_config
            .get("endpoint_url")
            .and_then(|v| v.as_str());
        let region = cfg.connection_config
            .get("region")
            .and_then(|v| v.as_str())
            .unwrap_or("us-east-1");

        let mut config_loader = aws_config::defaults(aws_config::BehaviorVersion::latest())
            .region(aws_config::Region::new(region.to_string()));

        // Support explicit credentials from auth_config
        if let (Some(key_id), Some(secret)) = (
            cfg.auth_config.get("access_key_id").and_then(|v| v.as_str()),
            cfg.auth_config.get("secret_access_key").and_then(|v| v.as_str()),
        ) {
            config_loader = config_loader.credentials_provider(
                aws_sdk_s3::config::Credentials::new(key_id, secret, None, None, "io-import")
            );
        }

        let sdk_config = config_loader.load().await;
        let mut s3_config = aws_sdk_s3::config::Builder::from(&sdk_config);

        if let Some(endpoint) = endpoint_url {
            s3_config = s3_config.endpoint_url(endpoint).force_path_style(true);
        }

        Ok(S3Client::from_conf(s3_config.build()))
    }
}

// EtlConnector impl:
// - test_connection: list_objects_v2 with max_keys=1
// - extract: list_objects_v2 with prefix, filter by pattern, compare with FilePollingState,
//            get_object for each new file, dispatch to format parser
```

Register in `mod.rs`:
```rust
pub mod s3;
"s3" => Some(Box::new(s3::S3FileConnector)),
```

**Step 2: Create the webhook receiver endpoint.**

In `services/import-service/src/handlers/webhook.rs`:

```rust
//! Webhook receiver for push-based import triggers.
//!
//! POST /import/webhooks/:token
//! - Token lookup against import_schedules.schedule_config->>'webhook_token'
//! - HMAC-SHA256 signature validation from X-IO-Signature header
//! - Writes to import_webhook_buffer for async processing
//! - Returns 200 immediately (external system cannot wait for pipeline)

use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    response::IntoResponse,
    Json,
};
use hmac::{Hmac, Mac};
use sha2::Sha256;
use sqlx::Row;

type HmacSha256 = Hmac<Sha256>;

pub async fn receive_webhook(
    State(state): State<crate::state::AppState>,
    Path(token): Path<String>,
    headers: HeaderMap,
    body: axum::body::Bytes,
) -> impl IntoResponse {
    // 1. Look up the schedule by webhook token
    let schedule_row = sqlx::query(
        "SELECT s.id, s.definition_id, s.schedule_config \
         FROM import_schedules s \
         WHERE s.schedule_type = 'webhook' \
           AND s.enabled = true \
           AND s.schedule_config->>'webhook_token' = $1"
    )
    .bind(&token)
    .fetch_optional(&state.db)
    .await;

    let schedule_row = match schedule_row {
        Ok(Some(r)) => r,
        Ok(None) => return (StatusCode::NOT_FOUND, Json(serde_json::json!({"error": "not found"}))).into_response(),
        Err(e) => {
            tracing::error!("webhook token lookup error: {e}");
            return (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": "internal"}))).into_response();
        }
    };

    let definition_id: uuid::Uuid = schedule_row.try_get("definition_id").unwrap();
    let schedule_config: serde_json::Value = schedule_row.try_get("schedule_config").unwrap_or_default();

    // 2. HMAC validation (if secret is configured)
    if let Some(hmac_secret) = schedule_config.get("hmac_secret").and_then(|v| v.as_str()) {
        let signature_header = headers
            .get("x-io-signature")
            .and_then(|v| v.to_str().ok())
            .unwrap_or("");

        let mut mac = HmacSha256::new_from_slice(hmac_secret.as_bytes())
            .expect("HMAC accepts any key length");
        mac.update(&body);
        let expected = hex::encode(mac.finalize().into_bytes());

        if !constant_time_eq::constant_time_eq(
            signature_header.as_bytes(),
            expected.as_bytes(),
        ) {
            return (StatusCode::UNAUTHORIZED, Json(serde_json::json!({"error": "invalid signature"}))).into_response();
        }
    }

    // 3. Check buffer depth (rate limiting)
    let buffer_depth: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM import_webhook_buffer \
         WHERE import_definition_id = $1 \
           AND processing_status IN ('pending', 'processing')"
    )
    .bind(definition_id)
    .fetch_one(&state.db)
    .await
    .unwrap_or(0);

    let max_buffer = schedule_config
        .get("max_buffer_depth")
        .and_then(|v| v.as_i64())
        .unwrap_or(1000);

    if buffer_depth >= max_buffer {
        return (StatusCode::TOO_MANY_REQUESTS, Json(serde_json::json!({"error": "buffer full"}))).into_response();
    }

    // 4. Parse payload and write to buffer
    let payload: serde_json::Value = match serde_json::from_slice(&body) {
        Ok(v) => v,
        Err(_) => return (StatusCode::BAD_REQUEST, Json(serde_json::json!({"error": "invalid JSON"}))).into_response(),
    };

    let result = sqlx::query(
        "INSERT INTO import_webhook_buffer \
         (import_definition_id, payload, received_at) \
         VALUES ($1, $2, NOW())"
    )
    .bind(definition_id)
    .bind(&payload)
    .execute(&state.db)
    .await;

    match result {
        Ok(_) => {
            metrics::counter!("io_import_webhook_received_total").increment(1);
            (StatusCode::OK, Json(serde_json::json!({"status": "accepted"}))).into_response()
        }
        Err(e) => {
            tracing::error!("webhook buffer write error: {e}");
            (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({"error": "internal"}))).into_response()
        }
    }
}
```

**Step 3: Add the webhook drain background task.**

In `main.rs`, spawn a drain task at startup:

```rust
tokio::spawn(run_webhook_drain(db.clone(), cfg.master_key, cfg.upload_dir.clone()));
```

The drain task polls every 5 seconds for pending webhook buffer rows:

```rust
async fn run_webhook_drain(db: sqlx::PgPool, master_key: [u8; 32], upload_dir: String) {
    let mut interval = tokio::time::interval(Duration::from_secs(5));
    loop {
        interval.tick().await;
        if let Err(e) = drain_webhook_buffer(&db, master_key, &upload_dir).await {
            warn!("webhook drain error: {e}");
        }
    }
}

async fn drain_webhook_buffer(db: &sqlx::PgPool, master_key: [u8; 32], upload_dir: &str) -> anyhow::Result<()> {
    // Claim one pending buffer row at a time using FOR UPDATE SKIP LOCKED
    loop {
        let row = sqlx::query(
            "UPDATE import_webhook_buffer \
             SET processing_status = 'processing' \
             WHERE id = (
                 SELECT id FROM import_webhook_buffer \
                 WHERE processing_status = 'pending' \
                 ORDER BY received_at \
                 FOR UPDATE SKIP LOCKED \
                 LIMIT 1
             ) RETURNING id, import_definition_id, payload"
        )
        .fetch_optional(db)
        .await?;

        let row = match row {
            Some(r) => r,
            None => break, // No pending items
        };

        let buffer_id: uuid::Uuid = row.try_get("id")?;
        let def_id: uuid::Uuid = row.try_get("import_definition_id")?;
        let _payload: serde_json::Value = row.try_get("payload")?;

        // Create a run and execute the pipeline
        let run_id = uuid::Uuid::new_v4();
        let insert_ok = sqlx::query(
            "INSERT INTO import_runs (id, import_definition_id, status, triggered_by, created_at) \
             VALUES ($1, $2, 'pending', 'webhook', NOW())"
        )
        .bind(run_id)
        .bind(def_id)
        .execute(db)
        .await;

        if let Err(e) = insert_ok {
            warn!(buffer_id = %buffer_id, "failed to create run for webhook: {e}");
            let _ = sqlx::query(
                "UPDATE import_webhook_buffer SET processing_status = 'failed', error_message = $2 WHERE id = $1"
            ).bind(buffer_id).bind(e.to_string()).execute(db).await;
            continue;
        }

        match pipeline::execute(db, run_id, def_id, false, master_key, upload_dir.to_string(), None).await {
            Ok(()) => {
                let _ = sqlx::query(
                    "UPDATE import_webhook_buffer SET processing_status = 'done', processed_at = NOW() WHERE id = $1"
                ).bind(buffer_id).execute(db).await;
            }
            Err(e) => {
                let _ = sqlx::query(
                    "UPDATE import_webhook_buffer SET processing_status = 'failed', error_message = $2, retry_count = retry_count + 1 WHERE id = $1"
                ).bind(buffer_id).bind(e.to_string()).execute(db).await;
            }
        }
    }
    Ok(())
}
```

**Step 4: Wire webhook routes into the Axum app.**

The webhook endpoint must be OUTSIDE the `service_secret_middleware` layer because external systems will not have the service secret. In `main.rs`:

```rust
// Webhook routes — no auth (HMAC validated internally)
let webhook_routes = axum::Router::new()
    .route("/import/webhooks/:token", axum::routing::post(handlers::webhook::receive_webhook))
    .with_state(app_state.clone());

let app = api
    .merge(webhook_routes)  // merged without service_secret middleware
    .merge(health.into_router())
    .merge(obs.metrics_router())
    .layer(CatchPanicLayer::new());
```

**Step 5: Add webhook token generation endpoint.**

Add to the existing import handlers (or webhook handlers):

```rust
// POST /import/definitions/:id/webhook-token
// Generates a new 32-byte random token, stores it encrypted in the webhook schedule's schedule_config
pub async fn generate_webhook_token(...) -> impl IntoResponse {
    let token = hex::encode(rand::random::<[u8; 32]>());
    // Store in schedule_config->>'webhook_token'
    // Return { webhook_url, token }
}
```

**Step 6: Add API Gateway route exception.**

In `services/api-gateway/src/main.rs`, add a route that proxies `/api/import/webhooks/*` to the import service WITHOUT JWT validation. Find the existing proxy pattern for import and add:

```rust
// Webhook receiver — no JWT required (HMAC validated by import-service)
.route("/api/import/webhooks/*path", any(proxy_import_webhook))
```

The proxy function is identical to `proxy_import` but does NOT add the JWT-derived user context.

### Acceptance criteria

- [ ] Migration applies cleanly
- [ ] `cargo build -p import-service` compiles
- [ ] `cargo clippy -p import-service -- -D warnings` passes
- [ ] S3 connector lists objects from a bucket, filters by pattern, downloads new files
- [ ] S3 connector with `endpoint_url` configured works with MinIO
- [ ] `POST /import/webhooks/:token` with valid token and HMAC returns 200
- [ ] Invalid HMAC returns 401
- [ ] Invalid token returns 404
- [ ] Buffer depth exceeding max returns 429
- [ ] Drain task processes buffered webhooks and creates import runs
- [ ] Webhook token generation endpoint returns a URL and token
- [ ] API Gateway routes webhook requests without JWT validation

### Implementation prompt for this phase

```
You are implementing Phase D of the connector behavior plan for the I/O import service.

READ THE PLAN FIRST: /home/io/io-dev/io/docs/connector-behavior-plan.md — read the entire "Phase D" section before writing any code.

PREREQUISITE: Phase A must be complete. Phase C is recommended (file_polling.rs for S3 deduplication).

OBJECTIVE: Add S3 connector and webhook receiver. External systems can push data to I/O via webhooks. S3 object storage becomes a first-class source.

KEY DESIGN:
- Webhook receiver is a POST endpoint that accepts JSON payloads with HMAC-SHA256 signature validation
- Payloads are written to import_webhook_buffer table (durable, not in-memory)
- A background drain task processes buffered payloads through the normal pipeline
- The webhook endpoint is OUTSIDE the service_secret middleware (external systems cannot have service secret)
- S3 connector uses aws-sdk-s3 with configurable endpoint_url for S3-compatible stores
- S3 uses FilePollingState from Phase C for deduplication

FILES TO CREATE:
- migrations/20260414000001_webhook_buffer.up.sql (exact SQL in plan)
- migrations/20260414000001_webhook_buffer.down.sql
- services/import-service/src/connectors/etl/s3.rs — S3 connector
- services/import-service/src/handlers/webhook.rs — webhook receiver + token management

FILES TO MODIFY:
- services/import-service/Cargo.toml — add aws-sdk-s3, aws-config, hmac, sha2, constant_time_eq
- services/import-service/src/main.rs — webhook routes (outside auth middleware), drain task
- services/import-service/src/connectors/etl/mod.rs — register "s3" type
- services/import-service/src/handlers/mod.rs — add pub mod webhook
- services/api-gateway/src/main.rs — route exception for /api/import/webhooks/*

WEBHOOK SECURITY:
- Token is a 32-byte random hex string stored in schedule_config.webhook_token (encrypted at rest)
- HMAC-SHA256: external system sends X-IO-Signature header = hex(HMAC-SHA256(secret, body_bytes))
- hmac_secret is separate from the URL token — double-layer security
- Timing-safe comparison via constant_time_eq crate
- Buffer depth rate limiting (default 1000 pending items)

VERIFY:
- cargo build -p import-service
- cargo clippy -p import-service -- -D warnings
- cargo test -p import-service
```

---

## Phase E — SSE Client + WebSocket Client Connectors

### What this delivers

A new `StreamingConnector` trait for long-lived, event-driven data ingestion that is fundamentally incompatible with the current `EtlConnector::extract()` one-shot model. SSE and WebSocket client connectors are implemented as background tasks that maintain persistent connections, process events as they arrive, and handle reconnection with exponential backoff. An `import_stream_sessions` table tracks session lifecycle. API endpoints allow operators to view session status and force stop/restart.

### Prerequisites

Phase A must be complete. The pipeline infrastructure from Phase B is used for individual event processing.

### New dependencies (Cargo.toml additions)

```toml
# In services/import-service/Cargo.toml [dependencies]
reqwest-eventsource = "0.6"  # MIT OR Apache-2.0 — SSE client with reconnect
# tokio-tungstenite is already in the workspace — used for WebSocket client
tokio-tungstenite = { workspace = true }
```

### Database migrations

Create file: `migrations/20260421000001_stream_sessions.up.sql`

```sql
-- Phase E: Stream session tracking for SSE, WebSocket, and CDC connectors

CREATE TABLE import_stream_sessions (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_definition_id UUID NOT NULL REFERENCES import_definitions(id) ON DELETE CASCADE,
    session_type         VARCHAR(20) NOT NULL
        CHECK (session_type IN ('sse', 'websocket', 'pg_cdc', 'mysql_cdc', 'mongo_change_stream')),
    status               VARCHAR(20) NOT NULL DEFAULT 'connecting'
        CHECK (status IN ('connecting', 'active', 'reconnecting', 'failed', 'stopped')),
    started_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_event_at        TIMESTAMPTZ,
    reconnect_count      INTEGER NOT NULL DEFAULT 0,
    events_received      BIGINT NOT NULL DEFAULT 0,
    resume_token         JSONB,
    error_message        TEXT,
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stream_sessions_def_status
    ON import_stream_sessions (import_definition_id, status);

-- Only one active/connecting/reconnecting session per definition
CREATE UNIQUE INDEX idx_stream_sessions_active
    ON import_stream_sessions (import_definition_id)
    WHERE status IN ('connecting', 'active', 'reconnecting');
```

Create file: `migrations/20260421000001_stream_sessions.down.sql`

```sql
DROP TABLE IF EXISTS import_stream_sessions;
```

### Files to create

| File | Purpose |
|------|---------|
| `migrations/20260421000001_stream_sessions.up.sql` | Stream sessions table |
| `migrations/20260421000001_stream_sessions.down.sql` | Rollback |
| `services/import-service/src/connectors/streaming/mod.rs` | `StreamingConnector` trait definition |
| `services/import-service/src/connectors/streaming/sse.rs` | SSE client connector |
| `services/import-service/src/connectors/streaming/websocket.rs` | WebSocket client connector |
| `services/import-service/src/connectors/streaming/supervisor.rs` | Session supervisor: startup recovery, backoff, circuit-break |
| `services/import-service/src/handlers/stream.rs` | Stream session status API endpoints |

### Files to modify

| File | Changes |
|------|---------|
| `services/import-service/Cargo.toml` | Add `reqwest-eventsource`, `tokio-tungstenite` |
| `services/import-service/src/main.rs` | Spawn streaming session supervisor at startup, add stream session routes |
| `services/import-service/src/connectors/mod.rs` | Add `pub mod streaming;` |
| `services/import-service/src/handlers/mod.rs` | Add `pub mod stream;` |

### Step-by-step implementation

**Step 1: Define the `StreamingConnector` trait.**

```rust
//! Streaming connector trait for long-lived, event-driven data sources.
//!
//! Unlike EtlConnector (one-shot extract), StreamingConnector runs indefinitely
//! and processes events as they arrive. Each connector type manages its own
//! connection lifecycle, reconnection, and event parsing.

pub mod sse;
pub mod websocket;
pub mod supervisor;

use anyhow::Result;
use serde_json::Value as JsonValue;
use uuid::Uuid;

/// Configuration for a streaming connector session.
#[derive(Debug, Clone)]
pub struct StreamConfig {
    pub definition_id: Uuid,
    pub session_id: Uuid,
    pub connection_config: JsonValue,
    pub auth_type: String,
    pub auth_config: JsonValue,
    pub source_config: JsonValue,
    pub resume_token: Option<JsonValue>,
}

/// A single event received from the stream.
#[derive(Debug, Clone)]
pub struct StreamEvent {
    pub event_type: Option<String>,
    pub data: JsonValue,
    /// Optional resume token for this event (for restartability).
    pub resume_token: Option<JsonValue>,
}

/// Trait for streaming connectors. Implementations must be Send + Sync.
/// The `run()` method is expected to run indefinitely until cancelled.
#[async_trait::async_trait]
pub trait StreamingConnector: Send + Sync {
    fn connector_type(&self) -> &'static str;

    /// Run the streaming connection. This method should:
    /// 1. Connect to the source
    /// 2. Process events via the provided callback
    /// 3. Handle reconnection on failure
    /// 4. Return only when the session should be permanently stopped
    ///
    /// The callback processes each event through the pipeline.
    async fn run(
        &self,
        config: &StreamConfig,
        db: &sqlx::PgPool,
        on_event: Box<dyn Fn(StreamEvent) -> futures::future::BoxFuture<'static, Result<()>> + Send + Sync>,
    ) -> Result<()>;
}
```

**Step 2: Implement SSE connector.**

Use `reqwest-eventsource` which handles reconnection natively:

```rust
pub struct SseConnector;

#[async_trait::async_trait]
impl StreamingConnector for SseConnector {
    fn connector_type(&self) -> &'static str { "sse" }

    async fn run(&self, config: &StreamConfig, db: &sqlx::PgPool, on_event: ...) -> Result<()> {
        let url = config.connection_config.get("base_url")...;
        let endpoint = config.source_config.get("endpoint")...;
        let full_url = format!("{}/{}", url, endpoint);

        let mut es = reqwest_eventsource::EventSource::get(&full_url);
        // Apply auth headers

        while let Some(event) = es.next().await {
            match event {
                Ok(reqwest_eventsource::Event::Message(msg)) => {
                    let data: JsonValue = serde_json::from_str(&msg.data)?;
                    let stream_event = StreamEvent {
                        event_type: Some(msg.event),
                        data,
                        resume_token: None,
                    };
                    // Update session status
                    update_session_event(db, config.session_id).await;
                    // Process through pipeline callback
                    on_event(stream_event).await?;
                }
                Err(e) => {
                    // reqwest-eventsource handles reconnection internally
                    // Log and update session status
                    update_session_reconnecting(db, config.session_id, &e.to_string()).await;
                }
            }
        }
        Ok(())
    }
}
```

**Step 3: Implement WebSocket connector.**

Use `tokio-tungstenite` for WebSocket connections:

```rust
pub struct WebSocketConnector;

// Handles:
// - Initial connection with auth headers
// - Subscription handshake (send subscription message from source_config.subscription_message)
// - Ping/Pong keepalive
// - Reconnection with exponential backoff (500ms initial, 2x factor, 60s cap, 20% jitter)
// - Circuit-break after 10 consecutive failures in 5 minutes
```

**Step 4: Implement the session supervisor.**

The supervisor runs at startup and manages all streaming sessions:

```rust
pub async fn run_streaming_supervisor(db: sqlx::PgPool, master_key: [u8; 32]) {
    // 1. On startup, check for any sessions in 'active' or 'reconnecting' state
    //    (left over from a previous crash). Restart them.
    // 2. Check for any streaming-type schedules (schedule_type = 'stream_session')
    //    that should have active sessions but don't. Start them.
    // 3. Hold JoinHandle for each active session task.
    // 4. When a session task exits, check if it should be restarted.
}
```

**Step 5: Add stream session status endpoints.**

```rust
// GET  /import/definitions/:id/stream-session — current session status
// POST /import/definitions/:id/stream-session/stop — force stop
// POST /import/definitions/:id/stream-session/restart — force restart
```

**Step 6: Wire into main.rs.**

Spawn the supervisor at startup and add the stream routes to the Axum router.

### Acceptance criteria

- [ ] Migration applies cleanly
- [ ] `cargo build -p import-service` compiles
- [ ] `cargo clippy -p import-service -- -D warnings` passes
- [ ] SSE connector establishes a persistent connection and processes events
- [ ] SSE connector reconnects with exponential backoff on connection loss
- [ ] WebSocket connector establishes connection, sends subscription handshake, processes messages
- [ ] WebSocket connector handles Ping/Pong keepalive
- [ ] `import_stream_sessions` table tracks session lifecycle (connecting -> active -> reconnecting -> etc.)
- [ ] `GET /import/definitions/:id/stream-session` returns current session status
- [ ] Stop endpoint terminates the session task
- [ ] Restart endpoint stops and restarts the session
- [ ] On service restart, orphaned sessions are recovered

### Implementation prompt for this phase

```
You are implementing Phase E of the connector behavior plan for the I/O import service.

READ THE PLAN FIRST: /home/io/io-dev/io/docs/connector-behavior-plan.md — read the entire "Phase E" section before writing any code.

PREREQUISITE: Phase A must be complete.

OBJECTIVE: Add SSE and WebSocket client connectors using a new StreamingConnector trait. These are long-lived background tasks, fundamentally different from the one-shot EtlConnector pattern.

KEY DESIGN:
- StreamingConnector trait is separate from EtlConnector — they cannot share a trait
- Each streaming definition has one active session tracked in import_stream_sessions
- Session supervisor handles startup recovery, new session creation, and crash restart
- SSE uses reqwest-eventsource (handles reconnection natively)
- WebSocket uses tokio-tungstenite (manual reconnection loop needed)
- Exponential backoff: 500ms initial, 2x factor, 60s cap, 20% jitter
- Circuit-break: 10 consecutive failures in 5 minutes -> alert, wait 10 minutes

FILES TO CREATE:
- migrations/20260421000001_stream_sessions.up.sql (exact SQL in plan)
- migrations/20260421000001_stream_sessions.down.sql
- services/import-service/src/connectors/streaming/mod.rs — trait definition
- services/import-service/src/connectors/streaming/sse.rs — SSE connector
- services/import-service/src/connectors/streaming/websocket.rs — WebSocket connector
- services/import-service/src/connectors/streaming/supervisor.rs — session supervisor
- services/import-service/src/handlers/stream.rs — session status endpoints

FILES TO MODIFY:
- services/import-service/Cargo.toml — add reqwest-eventsource, tokio-tungstenite
- services/import-service/src/main.rs — spawn supervisor, add routes
- services/import-service/src/connectors/mod.rs — add pub mod streaming
- services/import-service/src/handlers/mod.rs — add pub mod stream

VERIFY:
- cargo build -p import-service
- cargo clippy -p import-service -- -D warnings
- cargo test -p import-service
```

---

## Phase F — Change Data Capture (CDC)

### What this delivers

CDC connectors for PostgreSQL (WAL/pgoutput logical replication), MySQL/MariaDB (binlog), MSSQL (deep Change Tracking with before-images), and MongoDB (change streams). All CDC connectors use the `StreamingConnector` trait from Phase E and the `import_stream_sessions` table for lifecycle tracking. Each requires source-side DBA setup that is documented in-line. WAL accumulation alerting is added for PostgreSQL CDC.

### Prerequisites

Phase E must be complete (StreamingConnector trait, import_stream_sessions table, session supervisor).

### New dependencies (Cargo.toml additions)

```toml
# In services/import-service/Cargo.toml [dependencies]
pgwire-replication = "0.2"  # MIT OR Apache-2.0 — PostgreSQL logical replication
mysql_cdc = "0.9"           # MIT — MySQL/MariaDB binlog replication
# tiberius already present — used for MSSQL Change Tracking
# mongodb already present — used for change streams natively
```

### Database migrations

None. Uses `import_stream_sessions` from Phase E.

### Files to create

| File | Purpose |
|------|---------|
| `services/import-service/src/connectors/streaming/pg_cdc.rs` | PostgreSQL logical replication CDC |
| `services/import-service/src/connectors/streaming/mysql_cdc.rs` | MySQL/MariaDB binlog CDC |
| `services/import-service/src/connectors/streaming/mssql_ct.rs` | MSSQL Change Tracking deep polling |
| `services/import-service/src/connectors/streaming/mongo_cdc.rs` | MongoDB change streams |

### Files to modify

| File | Changes |
|------|---------|
| `services/import-service/Cargo.toml` | Add `pgwire-replication`, `mysql_cdc` |
| `services/import-service/src/connectors/streaming/mod.rs` | Register CDC connector types |
| `services/import-service/src/connectors/streaming/supervisor.rs` | Add CDC session types to supervision |

### Step-by-step implementation

**Step 1: PostgreSQL CDC via pgoutput.**

```rust
//! PostgreSQL logical replication CDC connector.
//!
//! Source-side requirements (DBA must configure):
//! 1. postgresql.conf: wal_level = logical
//! 2. CREATE PUBLICATION io_import FOR TABLE <table1>, <table2>, ...;
//! 3. SELECT pg_create_logical_replication_slot('io_import_slot', 'pgoutput');
//! 4. CREATE ROLE io_replication WITH REPLICATION LOGIN PASSWORD '...';
//!    GRANT USAGE ON SCHEMA public TO io_replication;
//!    GRANT SELECT ON ALL TABLES IN SCHEMA public TO io_replication;

pub struct PgCdcConnector;

// Uses pgwire-replication to:
// 1. Connect to the replication slot
// 2. Start streaming with START_REPLICATION SLOT ... PLUGIN 'pgoutput'
// 3. Parse pgoutput protocol messages (Insert, Update, Delete, Begin, Commit)
// 4. Convert each operation to a StreamEvent
// 5. Persist WAL LSN as resume_token for restartability
// 6. Send standby status updates to prevent WAL accumulation

// WAL accumulation alert:
// If the current WAL position minus the last confirmed flush LSN exceeds
// a configurable threshold (default 1GB), emit pg_notify('import_alert')
// with a WAL lag warning.
```

**Step 2: MySQL CDC via binlog.**

```rust
//! MySQL/MariaDB binlog CDC connector.
//!
//! Source-side requirements:
//! 1. my.cnf: binlog_format = ROW, binlog_row_image = FULL
//! 2. CREATE USER 'io_repl'@'%' IDENTIFIED BY '...';
//!    GRANT REPLICATION SLAVE, REPLICATION CLIENT ON *.* TO 'io_repl'@'%';
//!    GRANT SELECT ON target_db.* TO 'io_repl'@'%';
//! 3. Each I/O connection needs a unique server-id (auto-generated from connection UUID)
//!
//! LIMITATION: mysql_cdc crate does not support SSL. Only viable on private networks.

pub struct MysqlCdcConnector;

// Uses mysql_cdc to:
// 1. Connect as a replication client
// 2. Start from GTID position (if resume_token available) or current binlog position
// 3. Parse row events (WriteRowsEvent, UpdateRowsEvent, DeleteRowsEvent)
// 4. Convert to StreamEvent with operation type (insert/update/delete)
// 5. Persist GTID set as resume_token
```

**Step 3: MSSQL Change Tracking deep polling.**

This is NOT a streaming connector in the long-lived sense. It uses the `EtlConnector` trait (from Phase B) but with a specialized extraction query:

```rust
//! MSSQL Change Tracking polling connector.
//!
//! Source-side requirements:
//! 1. ALTER DATABASE YourDb SET CHANGE_TRACKING = ON (CHANGE_RETENTION = 7 DAYS, AUTO_CLEANUP = ON);
//! 2. ALTER TABLE YourTable ENABLE CHANGE_TRACKING WITH (TRACK_COLUMNS_UPDATED = ON);
//! 3. GRANT VIEW CHANGE TRACKING ON YourTable TO io_import;
//!
//! Query pattern:
//! SELECT ct.SYS_CHANGE_OPERATION, ct.SYS_CHANGE_VERSION, t.*
//! FROM CHANGETABLE(CHANGES YourTable, @last_sync_version) AS ct
//! LEFT JOIN YourTable t ON ct.PrimaryKeyCol = t.PrimaryKeyCol
//!
//! Captures inserts, updates, AND deletes (unlike watermark polling).

// Stored in watermark_state as:
// { "watermark_type": "change_tracking_version", "last_sync_version": 8192 }
```

Note: MSSQL CT is implemented as an enhancement to the existing `MssqlConnector` in `sql_mssql.rs`, NOT as a new streaming connector. When `source_config.ct_enabled: true`, the connector uses CHANGETABLE queries instead of the user's SQL.

**Step 4: MongoDB change streams.**

```rust
//! MongoDB change stream connector.
//!
//! Source-side requirements:
//! 1. MongoDB must be running as a replica set (not standalone)
//! 2. User must have read access to the target collection
//!
//! Uses mongodb 3.x collection.watch() natively — no new crate needed.

pub struct MongoChangeStreamConnector;

// Uses the mongodb driver's native watch() to:
// 1. Open a change stream on the target collection
// 2. Resume from saved resume_token if available
// 3. Process each change document (insert, update, replace, delete)
// 4. Persist resume_token for restartability
```

### Acceptance criteria

- [ ] `cargo build -p import-service` compiles with new CDC crates
- [ ] `cargo clippy -p import-service -- -D warnings` passes
- [ ] PostgreSQL CDC connector establishes replication connection and receives WAL events
- [ ] PostgreSQL CDC persists LSN and can resume from saved position
- [ ] WAL accumulation alert fires when lag exceeds threshold
- [ ] MySQL CDC connector receives binlog events for INSERT/UPDATE/DELETE
- [ ] MySQL CDC persists GTID and can resume
- [ ] MSSQL Change Tracking mode in MssqlConnector uses CHANGETABLE queries
- [ ] MSSQL CT captures deletes (watermark polling cannot)
- [ ] MongoDB change stream processes insert/update/delete events
- [ ] MongoDB change stream resumes from saved resume token
- [ ] All CDC source-side requirements are documented as inline comments

### Implementation prompt for this phase

```
You are implementing Phase F of the connector behavior plan for the I/O import service.

READ THE PLAN FIRST: /home/io/io-dev/io/docs/connector-behavior-plan.md — read the entire "Phase F" section before writing any code.

PREREQUISITE: Phase E must be complete (StreamingConnector trait and import_stream_sessions table).

OBJECTIVE: Add CDC connectors for PostgreSQL (WAL), MySQL (binlog), MongoDB (change streams). Add MSSQL Change Tracking deep mode to the existing MSSQL connector.

KEY DESIGN:
- PG CDC and MySQL CDC are StreamingConnector implementations (long-lived)
- MongoDB change streams are also StreamingConnector (long-lived)
- MSSQL Change Tracking is NOT streaming — it enhances the existing EtlConnector with CT queries
- All require source-side DBA setup — document requirements as inline comments
- Resume tokens enable restartability after crash/restart
- PG CDC must monitor WAL lag and alert when it exceeds threshold

FILES TO CREATE:
- services/import-service/src/connectors/streaming/pg_cdc.rs
- services/import-service/src/connectors/streaming/mysql_cdc.rs
- services/import-service/src/connectors/streaming/mongo_cdc.rs

FILES TO MODIFY:
- services/import-service/Cargo.toml — add pgwire-replication, mysql_cdc
- services/import-service/src/connectors/streaming/mod.rs — register CDC types
- services/import-service/src/connectors/streaming/supervisor.rs — supervise CDC sessions
- services/import-service/src/connectors/etl/sql_mssql.rs — add CT mode (ct_enabled in source_config)

NEW CARGO DEPS:
- pgwire-replication = "0.2" (MIT/Apache-2.0)
- mysql_cdc = "0.9" (MIT)

VERIFY:
- cargo build -p import-service
- cargo clippy -p import-service -- -D warnings
- cargo test -p import-service
```

---

## Phase G — New DCS Connectors + DCS Poll Configurability

### What this delivers

Three new DCS supplemental connectors: AspenTech IP.21 (high priority, full metadata including alarm limits), Yokogawa CENTUM VP (medium priority, PRM REST API), and Foxboro EcoStruxure (medium priority, FoxConnect REST API). The DCS poll interval is made configurable per connection via existing `import_connections.config` JSONB. Metadata and event polls are tracked separately. The `DcsConnector` trait gains a `has_events()` flag to skip event fetches for connectors that do not have alarm history APIs (Kepware, Canary).

### Prerequisites

Phase A must be complete (DCS health columns added).

### New dependencies (Cargo.toml additions)

None anticipated. All new connectors use `reqwest` (already in workspace). If Foxboro requires NTLM, evaluate adding the `ntlm` crate (MIT) — this was deferred in Phase A.

### Database migrations

None. Poll intervals are stored in the existing `import_connections.config` JSONB column:
- `poll_interval_seconds` (integer, default 300)
- `event_poll_interval_seconds` (integer, default 300)

The `supplemental_last_polled_at` etc. columns were added in Phase A.

### Files to create

| File | Purpose |
|------|---------|
| `services/import-service/src/connectors/aspen_ip21_rest.rs` | AspenTech IP.21 REST connector |
| `services/import-service/src/connectors/yokogawa_centum_rest.rs` | Yokogawa CENTUM VP REST connector |
| `services/import-service/src/connectors/foxboro_rest.rs` | AVEVA EcoStruxure Foxboro REST connector |

### Files to modify

| File | Changes |
|------|---------|
| `services/import-service/src/connectors/mod.rs` | Register 3 new connectors, add `has_events()` to `DcsConnector` trait |
| `services/import-service/src/main.rs` | Read per-connection poll intervals from config JSONB, separate metadata and event poll timing |

### Step-by-step implementation

**Step 1: Add `has_events()` to the `DcsConnector` trait.**

In `services/import-service/src/connectors/mod.rs`, add to the trait:

```rust
/// Whether this connector type has an alarm event history API.
/// When false, the supervisor skips event fetching entirely.
fn has_events(&self) -> bool { true }  // default true
```

Override to return `false` in `kepware_rest.rs` and `canary_rest.rs`.

**Step 2: Make poll intervals configurable.**

In `main.rs`, change `run_supplemental_connectors()` to:
1. Read `poll_interval_seconds` from each connection's `config` JSONB (default 300)
2. Read `event_poll_interval_seconds` from each connection's `config` JSONB (default 300)
3. Track per-connection last-poll timestamps in memory
4. Only poll metadata when `now - last_metadata_poll > poll_interval_seconds`
5. Only poll events when `has_events() && now - last_event_poll > event_poll_interval_seconds`

The outer loop interval stays at 60 seconds (checking all connections each minute), but individual connections are only polled when their interval has elapsed.

**Step 3: Create AspenTech IP.21 REST connector.**

```rust
//! AspenTech InfoPlus.21 (IP.21) supplemental DCS connector.
//!
//! REST API base: https://{host}/processdata/api/v1
//! Authentication: Basic auth or API key
//!
//! Metadata endpoint: GET /definitions?filter=*&count=5000
//! Returns: TagName, Description, EngUnits, IP_INPUT_MIN, IP_INPUT_MAX,
//!          IP_ALMHI_PV, IP_ALMLO_PV, IP_ALMHIHI_PV, IP_ALMLOLO_PV
//!
//! This is one of the most complete metadata sources available — all 4 alarm
//! limits are natively available (HIHI, HI, LO, LOLO).
//!
//! Event endpoint: GET /events?startTime=-1h&endTime=*&filter=*
//! Returns alarm event frames with severity, alarm type, and acknowledgement.

pub struct AspenIp21Connector;

impl DcsConnector for AspenIp21Connector {
    fn connector_type(&self) -> &'static str { "aspen_ip21_rest" }

    async fn fetch_metadata(&self, cfg: &ConnectorConfig) -> Result<Vec<SupplementalMetadataItem>> {
        let base = cfg.config.get("base_url")...;
        let client = reqwest::Client::new();
        // GET /processdata/api/v1/definitions with pagination
        // Map:
        //   Description -> description
        //   EngUnits -> engineering_unit
        //   IP_INPUT_MIN -> eu_range_low
        //   IP_INPUT_MAX -> eu_range_high
        //   IP_ALMHIHI_PV -> alarm_limit_hh
        //   IP_ALMHI_PV -> alarm_limit_h
        //   IP_ALMLO_PV -> alarm_limit_l
        //   IP_ALMLOLO_PV -> alarm_limit_ll
    }

    async fn fetch_events(&self, cfg: &ConnectorConfig, since: DateTime<Utc>) -> Result<Vec<SupplementalEvent>> {
        // GET /processdata/api/v1/events with time window
    }

    fn has_events(&self) -> bool { true }
}
```

**Step 4: Create Yokogawa CENTUM VP REST connector.**

```rust
//! Yokogawa CENTUM VP supplemental DCS connector.
//!
//! REST API via Plant Resource Manager (PRM), available since CENTUM VP R6.09 (2021).
//! Base: https://{host}/prm/api/v1
//! Authentication: Basic auth
//!
//! Metadata: GET /tags — returns tagname, description, engineering unit, range
//! Events: GET /alarms?startTime=...&endTime=... — alarm history

pub struct YokogawaCentumConnector;
```

**Step 5: Create Foxboro EcoStruxure REST connector.**

```rust
//! AVEVA EcoStruxure Foxboro DCS supplemental connector.
//!
//! REST API via FoxConnect platform, available since I/A v9.4.
//! Base: https://{host}/foxconnect/api/v1
//! Authentication: Basic auth or bearer token
//!
//! Metadata: GET /compounds — compound/block hierarchy with parameter values
//! Events: GET /alarms?since=... — alarm event history

pub struct FoxboroConnector;
```

**Step 6: Register all three connectors in `mod.rs`.**

Add to the `get_connector()` match:
```rust
"aspen_ip21_rest" => Some(Box::new(aspen_ip21_rest::AspenIp21Connector)),
"yokogawa_centum_rest" => Some(Box::new(yokogawa_centum_rest::YokogawaCentumConnector)),
"foxboro_rest" => Some(Box::new(foxboro_rest::FoxboroConnector)),
```

### Acceptance criteria

- [ ] `cargo build -p import-service` compiles
- [ ] `cargo clippy -p import-service -- -D warnings` passes
- [ ] AspenTech IP.21 connector fetches tag metadata including all 4 alarm limits
- [ ] Yokogawa CENTUM VP connector fetches tag metadata and alarm history
- [ ] Foxboro connector fetches compound metadata and alarm events
- [ ] Poll intervals are configurable per connection (tested with different values)
- [ ] Kepware and Canary connectors skip event fetching when `has_events()` returns false
- [ ] `supplemental_last_polled_at` is updated per-connection (not all at once)
- [ ] Metadata and event polls track timing independently

### Implementation prompt for this phase

```
You are implementing Phase G of the connector behavior plan for the I/O import service.

READ THE PLAN FIRST: /home/io/io-dev/io/docs/connector-behavior-plan.md — read the entire "Phase G" section before writing any code.

PREREQUISITE: Phase A must be complete (DCS health columns).

OBJECTIVE: Add three new DCS supplemental connectors (AspenTech IP.21, Yokogawa CENTUM VP, Foxboro EcoStruxure). Make DCS poll intervals configurable per connection. Add has_events() flag to skip unnecessary event polling.

KEY CONTEXT:
- DCS supplemental connectors are in services/import-service/src/connectors/ (NOT connectors/etl/)
- They implement the DcsConnector trait (defined in connectors/mod.rs)
- They write to points_metadata and the events hypertable (NOT custom_import_data)
- The poll loop is in main.rs run_supplemental_connectors()
- Existing connectors: pi_web_api.rs, experion_rest.rs, siemens_sph_rest.rs, wincc_oa_rest.rs, kepware_rest.rs, canary_rest.rs, s800xa_rest.rs

FILES TO CREATE:
- services/import-service/src/connectors/aspen_ip21_rest.rs
- services/import-service/src/connectors/yokogawa_centum_rest.rs
- services/import-service/src/connectors/foxboro_rest.rs

FILES TO MODIFY:
- services/import-service/src/connectors/mod.rs — register new connectors, add has_events() to DcsConnector trait
- services/import-service/src/main.rs — per-connection poll intervals, separate metadata/event timing

VERIFY:
- cargo build -p import-service
- cargo clippy -p import-service -- -D warnings
- cargo test -p import-service
```

---

## Phase H — Frontend Schedule Management UI

### What this delivers

Operators can configure and monitor all scheduling, watermark, webhook, and streaming connector settings from the Settings UI without using the API directly. This phase adds a schedule sub-panel to the Import settings page with full CRUD for schedules, trigger mode selection, watermark configuration, webhook URL display, DCS connector health status, and streaming session status indicators.

### Prerequisites

All backend phases (A through G) should be complete for full UI coverage, but the UI can be developed incrementally — Phase A (scheduler) and Phase B (watermark) are the minimum prerequisites for the core schedule and watermark UI. DCS health display requires Phase A. Streaming status requires Phase E.

### New dependencies (Cargo.toml additions)

None. This is a frontend-only phase.

### Database migrations

None.

### Files to create

| File | Purpose |
|------|---------|
| `frontend/src/pages/settings/import/SchedulePanel.tsx` | Schedule list and CRUD per definition |
| `frontend/src/pages/settings/import/ScheduleDrawer.tsx` | Create/edit schedule drawer with conditional fields |
| `frontend/src/pages/settings/import/WatermarkConfig.tsx` | Watermark configuration component |
| `frontend/src/pages/settings/import/WebhookDisplay.tsx` | Webhook URL display, copy button, secret rotation |
| `frontend/src/pages/settings/import/DcsHealthStatus.tsx` | DCS connector health display |
| `frontend/src/pages/settings/import/StreamSessionStatus.tsx` | Streaming session status indicator |

### Files to modify

| File | Changes |
|------|---------|
| `frontend/src/pages/settings/Import.tsx` | Add Schedules tab/panel, integrate new components |

### Step-by-step implementation

**Step 1: Add schedule list panel.**

In `SchedulePanel.tsx`, create a component that:
- Fetches schedules for a given definition via `GET /api/import/definitions/:id/schedules`
- Displays a table with columns: Type (badge), Expression/Interval, Next Run, Last Run, Status, Enabled (toggle), Actions (edit/delete)
- Type badges with colors: `interval` (blue), `cron` (purple), `file_arrival` (green), `webhook` (orange), `manual` (gray)
- "Add Schedule" button opens the ScheduleDrawer
- Enable/disable toggle calls `PUT /api/import/schedules/:id` with `{ enabled: bool }`

**Step 2: Create schedule drawer with conditional fields.**

In `ScheduleDrawer.tsx`:

```tsx
// Schedule type selector (Radix Select):
// - Manual only (no schedule created, just dismiss)
// - Fixed interval
// - Cron expression
// - File arrival
// - Webhook (push)

// Conditional fields based on type:
// interval: Duration picker (number + unit selector: seconds/minutes/hours)
// cron: Text input + human-readable preview (parse with cronstrue library or manual mapping)
// file_arrival: Transport type (local/SFTP/S3), Watch directory path, File pattern (glob), Poll interval
// webhook: Read-only webhook URL display, Copy button, HMAC secret (masked with reveal toggle)
```

Use Radix UI primitives for all form controls. Use Tailwind CSS classes consistent with the existing Settings page styling.

**Step 3: Watermark configuration component.**

In `WatermarkConfig.tsx`:

```tsx
// Toggle: "Enable incremental import" (boolean)
// When enabled, show:
// - Watermark column name (text input, e.g. "updated_at", "MODIFIEDON")
// - Watermark type selector: timestamp | integer | objectid
// - Safety lookback window (number input, seconds, default 120)
// - Current watermark value (read-only, fetched from latest run's watermark_state)
// - "Reset watermark" button (clears watermark_state, next run does full extract)
```

**Step 4: Webhook URL display component.**

In `WebhookDisplay.tsx`:

```tsx
// Shows the auto-generated webhook URL: https://io.plant.local/api/import/webhooks/{token}
// Copy to clipboard button
// HMAC secret display (masked with eye toggle)
// "Regenerate Token" button (calls POST /api/import/definitions/:id/webhook-token)
// Warning: "Regenerating will invalidate the current webhook URL"
```

**Step 5: DCS connector health display.**

In `DcsHealthStatus.tsx`:

```tsx
// For each supplemental connector (import_connections where is_supplemental_connector = true):
// - Connection name
// - Status indicator: green dot if polled within 2x interval, yellow if >2x, red if >5x or has error
// - Last polled: relative time (e.g. "3 minutes ago")
// - Last error: truncated error message (expand on click)
// - Tags updated: supplemental_last_metadata_count
// - Events updated: supplemental_last_event_count
```

**Step 6: Stream session status.**

In `StreamSessionStatus.tsx`:

```tsx
// For definitions using SSE, WebSocket, or CDC schedule types:
// Replace "Run Now" button with persistent status indicator:
// - Status badge: Connecting (yellow pulse), Active (green), Reconnecting (orange), Failed (red), Stopped (gray)
// - Events received count
// - Last event time (relative)
// - Reconnect count
// - "Stop" button (POST /api/import/definitions/:id/stream-session/stop)
// - "Restart" button (POST /api/import/definitions/:id/stream-session/restart)
```

**Step 7: Integrate into Import.tsx.**

Add a "Schedules" column or expandable panel to the existing definitions table. When a definition row is selected or expanded, show the SchedulePanel, WatermarkConfig, and (if applicable) WebhookDisplay or StreamSessionStatus.

Add a "DCS Health" section to the Connections tab showing DcsHealthStatus for all supplemental connectors.

**Step 8: Add dry-run toggle and run history enhancements.**

- Add "Dry run" checkbox to the "Run Now" button/dialog
- Show "DRY RUN" badge on dry-run rows in run history
- Show `watermark_state` values on completed run detail
- Add `triggered_by` filter to run history table

### Acceptance criteria

- [ ] `pnpm build` succeeds
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes
- [ ] Schedule list displays all schedules for a definition with correct type badges
- [ ] Creating an interval schedule via the drawer persists correctly
- [ ] Creating a cron schedule shows human-readable preview
- [ ] File arrival schedule shows transport/path/pattern fields
- [ ] Webhook schedule displays the webhook URL with copy button
- [ ] Watermark toggle enables/disables incremental import configuration
- [ ] Reset watermark button clears the watermark state
- [ ] DCS health shows connection status with color-coded indicators
- [ ] Stream session status shows live connection state for streaming definitions
- [ ] Dry-run checkbox works and produces a DRY RUN badge in run history
- [ ] Run history can be filtered by triggered_by

### Implementation prompt for this phase

```
You are implementing Phase H of the connector behavior plan for the I/O import service.

READ THE PLAN FIRST: /home/io/io-dev/io/docs/connector-behavior-plan.md — read the entire "Phase H" section before writing any code.

ALSO READ: /home/io/io-dev/io/frontend/src/pages/settings/Import.tsx to understand the current UI structure.

PREREQUISITE: Backend phases A and B at minimum. Full UI coverage requires all phases A-G.

OBJECTIVE: Add schedule management UI to the Import settings page. Operators can create/edit/delete schedules, configure watermark incremental imports, view webhook URLs, see DCS connector health, and monitor streaming sessions — all without API access.

TECHNOLOGY:
- React 18 + TypeScript
- Radix UI primitives for all form controls
- Tailwind CSS for styling
- TanStack Query for server state
- Zustand not needed (local component state is sufficient)

FILES TO CREATE:
- frontend/src/pages/settings/import/SchedulePanel.tsx
- frontend/src/pages/settings/import/ScheduleDrawer.tsx
- frontend/src/pages/settings/import/WatermarkConfig.tsx
- frontend/src/pages/settings/import/WebhookDisplay.tsx
- frontend/src/pages/settings/import/DcsHealthStatus.tsx
- frontend/src/pages/settings/import/StreamSessionStatus.tsx

FILES TO MODIFY:
- frontend/src/pages/settings/Import.tsx — integrate new components

API ENDPOINTS USED:
- GET /api/import/definitions/:id/schedules — list schedules
- POST /api/import/definitions/:id/schedules — create schedule
- PUT /api/import/schedules/:id — update schedule
- DELETE /api/import/schedules/:id — delete schedule
- POST /api/import/definitions/:id/webhook-token — generate webhook token
- GET /api/import/definitions/:id/stream-session — stream session status
- POST /api/import/definitions/:id/stream-session/stop — stop stream
- POST /api/import/definitions/:id/stream-session/restart — restart stream
- GET /api/import/connections — list connections (for DCS health)

STYLE RULES:
- Match existing Import.tsx styling patterns
- Use design tokens from the project CSS (see design-docs/06_FRONTEND_SHELL.md)
- No emojis in the UI
- Error states must be handled (loading, empty, error)

VERIFY:
- pnpm build
- pnpm lint
- pnpm test
```

---

## Phase Summary

| Phase | Delivers | Est. Duration | New Cargo Deps |
|-------|----------|---------------|----------------|
| A | Scheduler works; 3 DCS bugs fixed; DCS health columns | 1-2 weeks | None (possibly `ntlm`) |
| B | Watermark incremental for all DB + REST connectors | 1-2 weeks | None |
| C | SFTP dir polling; file_arrival; local + FTP connectors | 1-2 weeks | `glob`, `suppaftp` |
| D | Webhook receiver; S3 connector | 2-3 weeks | `aws-sdk-s3`, `aws-config`, `hmac`, `sha2`, `constant_time_eq` |
| E | SSE client; WebSocket client (new trait) | 2-4 weeks | `reqwest-eventsource`, `tokio-tungstenite` |
| F | CDC: PG WAL, MySQL binlog, MSSQL CT deep, MongoDB streams | 3-5 weeks | `pgwire-replication`, `mysql_cdc` |
| G | 3 new DCS connectors; configurable DCS poll intervals | 2-3 weeks | None |
| H | Frontend schedule management UI; DCS health display | 2-3 weeks | None (frontend) |

**Total estimated range: 14-24 weeks**

**Critical path: A -> B -> C -> D (operational value delivered incrementally)**
**Independent tracks: E+F (streaming/CDC) can proceed in parallel with G (DCS connectors)**
**H (frontend) can start as soon as A+B are complete and expand as backend phases land**

---

*Plan authored 2026-04-04. Authority: `/home/io/io-dev/io/docs/research/connector-behavior/00_MASTER_SYNTHESIS.md`*
