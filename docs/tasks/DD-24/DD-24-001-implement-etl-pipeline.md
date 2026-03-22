---
id: DD-24-001
title: Implement ETL pipeline execution in trigger_run
unit: DD-24
status: pending
priority: high
depends-on: []
---

## What This Feature Should Do

When an administrator triggers an import run (manually or via schedule), the Import Service should execute a real Extract-Map-Transform-Validate-Load pipeline against the configured connection and source. Row counts, timing breakdowns, and errors must be recorded accurately in `import_runs` and `import_errors`. The current stub creates a run record then immediately marks it `completed` with zero rows after a 2-second sleep.

## Spec Excerpt (verbatim)

> Each import execution follows a linear pipeline:
> ```
> Extract → Map → Transform → Validate → Load
> ```
> At every stage:
> - Success rows → next stage
> - Error rows → import_errors table (with original source data)
> — 24_UNIVERSAL_IMPORT.md, §2 Import Pipeline

> ```rust
> async fn dry_run(config: &ImportDefinition, pool: &PgPool) -> DryRunResult {
>     let mut tx = pool.begin().await?;
>     // Run full pipeline inside transaction
>     let result = execute_pipeline(&mut tx, config).await;
>     // Collect statistics before rollback
>     let stats = collect_run_statistics(&mut tx, &result).await?;
>     // ROLLBACK - nothing persisted
>     tx.rollback().await?;
>     stats
> }
> ```
> — 24_UNIVERSAL_IMPORT.md, §11 Test, Preview, and Dry Run

## Where to Look in the Codebase

Primary files:
- `services/import-service/src/handlers/import.rs:996–1043` — `trigger_run` handler; the stub is at lines 1030–1043
- `services/import-service/src/connectors/mod.rs` — DcsConnector trait; need a parallel ImportConnector trait for the general pipeline
- `services/import-service/src/main.rs:132–205` — supplemental connector polling pattern (reference for how to call connectors)

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] `trigger_run` spawns a Tokio task that calls a real `execute_pipeline` function (not a sleep-then-update stub)
- [ ] `execute_pipeline` updates `import_runs.rows_extracted`, `rows_transformed`, `rows_loaded`, `rows_skipped`, `rows_errored` with actual counts
- [ ] `execute_pipeline` updates `import_runs.extract_duration_ms`, `transform_duration_ms`, `validate_duration_ms`, `load_duration_ms`, `total_duration_ms`
- [ ] Rows that fail validation or transformation are written to `import_errors` with `source_data`, `error_type`, `field_name`, `error_message`
- [ ] Dry-run mode (`dry_run = true`) wraps the full pipeline in a transaction and rolls back, but still records statistics
- [ ] `import_runs.status` progresses through `pending` → `running` → `completed` / `completed_with_errors` / `failed`

## Assessment

- **Status**: ❌ Missing
- `handlers/import.rs:1030–1043` contains: `tokio::time::sleep(Duration::from_secs(2)).await; UPDATE import_runs SET status = 'completed', rows_extracted = 0, rows_loaded = 0, rows_errored = 0`. No pipeline execution occurs.

## Fix Instructions

1. Create a new module `services/import-service/src/pipeline.rs` (or `src/engine/mod.rs`).

2. Define an `ImportConnector` trait analogous to the `DcsConnector` trait in `connectors/mod.rs`:
   ```rust
   #[async_trait]
   pub trait ImportConnector: Send + Sync {
       fn connector_type(&self) -> &str;
       async fn test_connection(&self, config: &ConnectionConfig) -> Result<ConnectionTestResult>;
       async fn extract(...) -> Result<Pin<Box<dyn Stream<Item = Result<RowBatch>> + Send>>>;
   }
   ```

3. Implement at minimum a `csv` connector and a stub `rest_json` connector for Phase 7 demo readiness. Wire them into a registry analogous to `connectors::get_connector`.

4. Replace the stub in `trigger_run` (lines 1030–1043) with:
   - Mark run as `running` immediately
   - Spawn Tokio task calling `pipeline::execute(&state.db, run_id, def_id, dry_run).await`
   - Inside `execute`: fetch the `import_definitions` row + `import_connections` row; call the correct connector's `extract`; apply field_mappings; apply transform_pipeline steps; validate; bulk-insert to target table; write `import_errors` for bad rows; update `import_runs` with final counts and durations.

5. Heartbeat: inside the background task, update `import_schedules.last_heartbeat_at` every 60 seconds while the job runs (per §9 Heartbeat).

6. After a successful run, advance the watermark: update `import_definitions.watermark_state` with the new last_value observed.

Do NOT:
- Remove the existing run record creation — keep `INSERT INTO import_runs` intact; only replace what happens after the record is created
- Skip the `dry_run` transaction-rollback path — it is required for the "Dry Run" button in the UI to show real statistics
- Use `tokio::time::sleep` as a proxy for work
