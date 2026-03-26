---
id: DD-24-006
title: Implement PostgreSQL-based import scheduler with FOR UPDATE SKIP LOCKED
unit: DD-24
status: pending
priority: medium
depends-on: [DD-24-001]
---

## What This Feature Should Do

The Import Service must poll `import_schedules` every 30 seconds, claim due schedules using `FOR UPDATE SKIP LOCKED` to prevent duplicate execution, and enqueue them for the ETL pipeline. CRON expressions must be parsed to compute `next_run_at`. Crashed jobs (heartbeat stale by >5 minutes) must be recoverable. Currently only the DCS supplemental connector polling exists; general import scheduling is absent.

## Spec Excerpt (verbatim)

> ```sql
> -- Poll for runnable schedules (executed every 30 seconds by Import Service)
> SELECT s.id, s.definition_id, s.schedule_type
> FROM import_schedules s
> WHERE s.enabled = true
>   AND s.next_run_at <= NOW()
>   AND (s.running = false
>        OR s.last_heartbeat_at < NOW() - INTERVAL '5 minutes')
> ORDER BY s.next_run_at
> FOR UPDATE SKIP LOCKED
> LIMIT 1;
> ```
> This pattern prevents duplicate runs of the same import, recovers from crashed jobs, requires no external infrastructure.
> — 24_UNIVERSAL_IMPORT.md, §9 PostgreSQL-Based Job Queue

> | Type | Implementation |
> |---|---|
> | **Cron** | `cron` crate (MIT/Apache-2.0) parses expressions |
> | **Interval** | Fixed seconds between runs |
> — 24_UNIVERSAL_IMPORT.md, §9 Schedule Types

## Where to Look in the Codebase

Primary files:
- `services/import-service/src/main.rs:40–41` — only `run_supplemental_connectors` is spawned; no general scheduler spawned
- `services/import-service/src/main.rs:131–140` — `run_supplemental_connectors` pattern to replicate for the general scheduler

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] A `run_scheduler` background task is spawned at startup in `main.rs`
- [ ] The scheduler polls every 30 seconds (not 300 seconds)
- [ ] Poll query uses `FOR UPDATE SKIP LOCKED` to prevent double-execution
- [ ] Crashed jobs (heartbeat stale > 5 minutes) are considered eligible for re-run
- [ ] CRON expressions are parsed using the `cron` crate to compute `next_run_at` after each execution
- [ ] `import_schedules.next_run_at` is updated after each completed run
- [ ] Interval-based schedules advance `next_run_at` by `interval_seconds`
- [ ] `running = true` and `last_heartbeat_at` are set when a job starts, cleared on completion

## Assessment

- **Status**: ❌ Missing
- `services/import-service/src/main.rs:40–41` spawns only `run_supplemental_connectors(db.clone())`. No general import scheduler is spawned. The `import_schedules` table is populated via the handlers but nothing ever reads it to trigger runs.

## Fix Instructions

1. Add `cron = "0.12"` (MIT/Apache-2.0) to `services/import-service/Cargo.toml`.

2. In `main.rs`, after the supplemental connector task spawn (line 41), add:
   ```rust
   tokio::spawn(run_import_scheduler(db.clone()));
   ```

3. Implement `run_import_scheduler`:
   ```rust
   async fn run_import_scheduler(db: sqlx::PgPool) {
       let mut interval = tokio::time::interval(Duration::from_secs(30));
       loop {
           interval.tick().await;
           if let Err(e) = poll_import_schedules(&db).await {
               warn!("import scheduler error: {e}");
           }
       }
   }
   ```

4. Implement `poll_import_schedules`:
   - Begin a transaction
   - Execute the `FOR UPDATE SKIP LOCKED` query from the spec
   - For each claimed schedule: mark `running = true`, `last_heartbeat_at = NOW()`, call `trigger_pipeline(db, definition_id)` (the real ETL from DD-24-001)
   - After completion: set `running = false`, compute and update `next_run_at` based on schedule_type
   - Commit

5. For CRON: use `cron::Schedule::from_str(&expression)` to get the next occurrence after NOW().

6. Heartbeat update: inside the ETL pipeline execution, call `UPDATE import_schedules SET last_heartbeat_at = NOW() WHERE definition_id = $1 AND running = true` every 60 seconds.

Do NOT:
- Use `tokio::time::sleep` with a hardcoded 2-second delay as a proxy for work
- Execute the `FOR UPDATE SKIP LOCKED` query outside a transaction — locking requires an open transaction
- Update `next_run_at` before the job completes — only advance after success or failure is recorded
