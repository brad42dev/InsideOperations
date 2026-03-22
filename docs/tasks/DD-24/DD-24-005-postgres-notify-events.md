---
id: DD-24-005
title: Emit PostgreSQL NOTIFY events for import status changes
unit: DD-24
status: pending
priority: medium
depends-on: [DD-24-001]
---

## What This Feature Should Do

The Import Service must emit PostgreSQL NOTIFY events on three channels so that other services (API Gateway, OPC Service) can react to import state changes in real time: `import_status` when runs start/complete/fail, `import_alert` when runs fail or exceed error thresholds, and `point_metadata_changed` when imports modify `points_metadata`.

## Spec Excerpt (verbatim)

> - **NOTIFY `import_status`**: Emitted when import runs start, complete, or fail. The API Gateway listens and can push status updates to the frontend via the Data Broker WebSocket.
> - **NOTIFY `point_metadata_changed`**: Emitted when imports modify `points_metadata` (e.g., bulk point import from CSV). The OPC Service listens to update its subscription registry.
> — 24_UNIVERSAL_IMPORT.md, §2 Inter-Service Communication

> - **PostgreSQL NOTIFY `import_alert`**: Emitted on run failure or threshold breach. The API Gateway can relay to the frontend.
> — 24_UNIVERSAL_IMPORT.md, §10 Alerting

## Where to Look in the Codebase

Primary files:
- `services/import-service/src/handlers/import.rs:996–1046` — `trigger_run` and its background task: the right place to emit `import_status`
- `services/import-service/src/main.rs:132–205` — `poll_supplemental_connectors`: should emit `point_metadata_changed` after writes
- `services/import-service/src/connectors/db_writes.rs` — `write_supplemental_metadata` and `write_supplemental_events`: natural site for `point_metadata_changed` NOTIFY

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] `NOTIFY import_status, '{"run_id":"...","status":"running","definition_id":"..."}'` emitted when a run transitions to `running`
- [ ] `NOTIFY import_status, '{"run_id":"...","status":"completed",...}'` emitted on run completion
- [ ] `NOTIFY import_status, '{"run_id":"...","status":"failed","error":"..."}'` emitted on failure
- [ ] `NOTIFY import_alert, '{"run_id":"...","error":"..."}'` emitted when a run fails or exceeds error threshold
- [ ] `NOTIFY point_metadata_changed` emitted after any import that writes to `points_metadata`

## Assessment

- **Status**: ❌ Missing
- Grep of all import-service source files (`services/import-service/src/`) finds zero calls to NOTIFY or `pg_notify`. No event emission of any kind on run status transitions.

## Fix Instructions

Use `sqlx::query("SELECT pg_notify($1, $2)").bind(channel).bind(payload).execute(&db).await` as the NOTIFY mechanism (same pattern used in other I/O services).

1. In the ETL pipeline background task (after DD-24-001 is implemented), emit at three points:
   - After updating `status = 'running'`: `SELECT pg_notify('import_status', json_build_object('run_id', $run_id, 'status', 'running', 'definition_id', $def_id)::text)`
   - After `status = 'completed'` or `'completed_with_errors'`: same with final counts
   - After `status = 'failed'`: `import_status` AND `import_alert` with error message

2. In `db_writes::write_supplemental_metadata` (after bulk write): emit `SELECT pg_notify('point_metadata_changed', '{}')` if any rows were written.

3. For the current stub (`trigger_run` before DD-24-001 is complete): add `import_status` NOTIFY calls even in the stub, so the WebSocket update path can be tested independently.

Do NOT:
- Use `tokio::sync::broadcast` or any in-process mechanism — must use PostgreSQL NOTIFY for cross-service communication
- Emit NOTIFY inside a transaction that will be rolled back (dry-run mode) — emit only after real commits
