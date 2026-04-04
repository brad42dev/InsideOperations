# Import Service — Master Connector Behavior Synthesis

**Date:** 2026-04-04
**Synthesized from:** `01_current_architecture.md`, `02_database_connectors.md`, `03_file_connectors.md`, `04_rest_connectors.md`
**Note:** Files 05 and 06 were not yet available; this synthesis covers files 01–04 only.
**Purpose:** Definitive reference for the phased implementation plan.

---

## Executive Summary

The import service today has a single working execution mode: **one-shot manual trigger**. All 12 ETL connector types are implemented at the trait level but operate as bulk, in-memory extracts. The general import scheduler code exists but is entirely non-functional due to a schema mismatch (missing DDL columns). Nothing in the system is event-driven. Watermark state tracking is designed but never populated.

The path forward is: fix the scheduler (one week), add watermark-based incremental polling (one to two weeks), then layer in push-based and streaming modes. CDC and streaming connectors are Tier 3 work that requires a new connector trait and significant source-side setup.

---

## 1. Full Trigger / Delivery Mode Matrix

**Legend:**
- ✅ Recommended for this combination
- ⚠️ Possible but with caveats (noted)
- ❌ Not applicable / not worth implementing
- 🔧 Requires source-side setup (noted)

### File Connectors

| Connector | One-Time | Interval Poll | Cron | File-Arrival | Webhook | CDC / Streaming |
|---|---|---|---|---|---|---|
| **CSV / TSV file** | ✅ Primary use case — upload and run | ✅ If files are dropped periodically to SFTP, S3, or local path (via those connectors) | ✅ Same as interval; use when source export time is known | ⚠️ Only directly applicable to local filesystem via inotify; for SFTP/S3 file-arrival means aggressive interval polling | ❌ File connectors are push-by-definition; webhook signals file readiness, but the file connector still polls to retrieve | ❌ Files are batches, not streams |
| **Excel file** | ✅ Primary use case | ✅ Via SFTP directory poll (stated user need) | ✅ Use when source exports on a known schedule | ⚠️ Local filesystem only (inotify); SFTP/S3 simulate via interval | ❌ Same as CSV | ❌ |
| **JSON file** | ✅ Primary use case | ✅ Via file transport connectors | ✅ | ⚠️ Local filesystem only | ❌ | ❌ |
| **XML file** | ✅ Primary use case | ✅ Via file transport connectors | ✅ | ⚠️ Local filesystem only | ❌ | ❌ |
| **SFTP** | ✅ Current behavior (single named file) | ✅ **Recommended** — directory poll with filename+mtime deduplication | ✅ When source export schedule is known | ⚠️ No kernel notification from SFTP; implement as short interval (30–60s) with no-op runs when nothing is new | ❌ | ❌ |
| **FTP** | ✅ Not yet implemented; add `FtpConnector` | ✅ Same as SFTP once implemented | ✅ | ⚠️ Same as SFTP | ❌ | ❌ |
| **S3 / Object Storage** | ✅ New connector needed | ✅ **Recommended** — `list_objects_v2` with `LastModified` watermark | ✅ | ⚠️ Simulate via short interval (30s–5min); SQS event-driven is Tier 4 | ❌ | ⚠️ SQS event-driven is Tier 4: requires SQS queue + S3 event notifications + IAM config |
| **Local filesystem** | ✅ Useful for one-time ingestion of a specific file | ⚠️ Possible but inotify is lower latency than polling for local paths | ✅ | ✅ **Recommended** — inotify via `notify` crate, sub-second latency, zero wasted polls | ❌ | ❌ |

### Database Connectors

| Connector | One-Time | Interval Poll | Cron | File-Arrival | Webhook | CDC / Streaming |
|---|---|---|---|---|---|---|
| **PostgreSQL** | ✅ Current behavior | ✅ Watermark on `updated_at` or integer sequence | ✅ When source export cadence is fixed | ❌ | ❌ | 🔧 pgoutput logical replication requires `wal_level=logical`, publication, replication slot, replication user — DBA setup; suitable only when near-real-time LIMS or access control latency is genuinely required |
| **MySQL / MariaDB** | ✅ Current behavior | ✅ Watermark on `updated_at`; use `READ UNCOMMITTED` to avoid lock contention | ✅ | ❌ | ❌ | 🔧 Binlog CDC requires `binlog_format=ROW`, replication user, unique `server-id`; `mysql_cdc` crate has no SSL support — only viable on private networks |
| **MSSQL** | ✅ Current behavior | ✅ **Recommended** — `ROWVERSION` watermark (monotonic, clock-drift-free) or `MODIFIEDON` column | ✅ | ❌ | ❌ | 🔧 Change Tracking polling (recommended over full CDC): enables `CHANGETABLE(CHANGES ...)` T-SQL; requires CT enabled per table and `VIEW CHANGE TRACKING` grant — no Enterprise license, no SQL Agent; captures deletes. Full CDC requires SQL Agent + Enterprise + DBA enablement |
| **ODBC** | ✅ Current behavior | ✅ Parameterized query with watermark substitution (string substitution, not bound params) | ✅ | ❌ | ❌ | ❌ ODBC provides no standard log-access interface; Oracle LogMiner requires DBA privileges and is not practical as a general feature |
| **MongoDB** | ✅ Current behavior | ✅ ObjectId watermark (insertions) or `updatedAt` field (updates) | ✅ | ❌ | ❌ | 🔧 Change Streams require replica set (not standalone `mongod`); uses existing `mongodb` 3.x crate natively; resume tokens give restartability; applicable only to confirmed replica set or Atlas deployments |

### REST Connectors

| Connector | One-Time | Interval Poll | Cron | File-Arrival | Webhook | CDC / Streaming |
|---|---|---|---|---|---|---|
| **Generic REST API** | ✅ Current behavior | ✅ **Recommended** — add watermark param injection and link-header pagination | ✅ | ❌ | ⚠️ Webhook receiver is a separate path: external system POSTs to I/O's endpoint rather than I/O pulling the REST API | ⚠️ SSE and WebSocket are separate connector types (see below) |
| **Webhook receiver (push)** | ❌ Not a pull connector — push-only | ❌ | ❌ | ❌ | ✅ **This IS the webhook delivery mode** — external system POSTs to `POST /import/webhook/{def_id}/{token}`; HMAC validation + durable PostgreSQL buffer + drain task | ❌ |
| **SSE client** | ❌ SSE is a persistent connection, not a batch | ❌ | ❌ | ❌ | ❌ | ✅ Long-lived background task; reconnect with exponential backoff; one `import_run` row per session; incompatible with current ETL trait |
| **WebSocket client** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ Long-lived background task; Ping/Pong keepalive required; subscription handshake; incompatible with current ETL trait |

---

## 2. Implementation Complexity Tiers

### Tier 1 — Quick Wins (< 1 week each)

These unblock the scheduler and add the most widely-applicable delivery enhancement with zero new dependencies.

1. **Fix the import scheduler (DDL migration):** Add missing columns to `import_schedules`: `cron_expression TEXT`, `interval_seconds INTEGER`, `running BOOLEAN NOT NULL DEFAULT false`, `last_heartbeat_at TIMESTAMPTZ`. Also rename `s.definition_id` reference to `s.import_definition_id` in `poll_import_schedules`. Without this, nothing scheduled runs. Estimated effort: 2–4 hours.

2. **Fix `triggered_by` schema mismatch:** Code writes `'scheduled'` but schema constraint requires `'schedule'`. Pick one and align. Single-file change.

3. **Implement watermark for all five DB connectors:** No new crates needed. Changes are in the pipeline (`pipeline.rs`) to read the previous run's `watermark_state`, pass it to the connector, and write the new value. Changes in each connector's `extract()` to inject the watermark into the query. Covers PostgreSQL, MySQL, MSSQL, ODBC, MongoDB with existing dependencies.

4. **SFTP directory polling (stated user need):** Extend `SftpConnector` to call `sftp.read_dir()`, filter by `file_pattern` glob, compare against `watermark_state` (filename + mtime), download new files, dispatch to the parser, archive if configured. `russh-sftp` already has `read_dir`. Requires adding `glob = "0.3"` (MIT/Apache-2.0). Add shared `FilePollingState` struct in `connectors/etl/file_polling.rs`.

5. **Fix `source_row_id` population:** Currently set to row number within the batch. Change to use `source_config.id_field` value from the source record when configured. Prerequisite for deduplication correctness.

6. **Respect `import_definitions.enabled` in scheduler:** The scheduler currently ignores this field; a disabled definition can still be triggered by an active schedule.

### Tier 2 — Medium Effort (1–2 weeks each)

7. **S3 connector:** New `S3FileConnector` in `connectors/etl/s3.rs`. Poll `list_objects_v2` with prefix, filter by `LastModified > watermark`, download via `get_object`, dispatch to format parser. Configurable `endpoint_url` for S3-compatible stores (MinIO, Ceph). Requires `aws-sdk-s3 = "1"` + `aws-config = "1"` (both Apache-2.0). Share `FilePollingState` deduplication logic.

8. **FTP connector:** New `FtpConnector` in `connectors/etl/ftp.rs`. Separate from SFTP — different crate, different protocol. Directory listing, pattern matching, deduplication identical to SFTP extension (shared `FilePollingState`). Requires `suppaftp = { version = "6", features = ["async", "rustls"] }` (MIT/Apache-2.0). FTPS support via rustls.

9. **Webhook receiver:** New Axum route `POST /import/webhook/:definition_id/:token`. HMAC-SHA256 validation against `import_connections.auth_config.secret` (already encrypted at rest). Durable `import_webhook_buffer` PostgreSQL table + background drain task. Requires `hmac`, `sha2`, `hex`, `constant_time_eq` (all MIT/Apache-2.0 or CC0). The drain task spawns `pipeline::execute()` from buffered payloads.

10. **Local filesystem watcher:** New `LocalFileConnector` with `file_arrival` schedule type. Spawns a `notify::recommended_watcher()` task at schedule activation. On `IN_CLOSE_WRITE` or `IN_MOVED_TO`, check pattern, check deduplication state, dispatch to pipeline. Requires `notify = "8"` (CC0) + `notify-debouncer-full = "0.4"` (MIT/Apache-2.0). Falls back to polling for network-mounted paths.

11. **Link-header pagination for REST connector:** Add `Link: <url>; rel="next"` header parsing to `GenericRestConnector`. Required for Maximo OSLC and OData integrations. No new crates — response headers are already in `reqwest`.

12. **Watermark injection for REST connector:** Add `watermark_param` and `watermark_field` to `GenericRestConnector`'s recognized `source_config` keys. On each scheduled run, read the previous run's `watermark_state`, inject as a query parameter, record the max value from the response.

### Tier 3 — Significant Effort (2–4 weeks each)

These all require a new connector trait design — they cannot be forced into the current `EtlConnector::extract()` one-shot model.

13. **PostgreSQL CDC (pgoutput):** New `CdcConnector` trait (long-running async task). Uses `pgwire-replication = "0.2"` (MIT/Apache-2.0, crates.io). Requires source-side: `wal_level=logical`, publication, replication slot, replication user. WAL accumulation risk if I/O goes offline must be documented for operators. Session state tracked in new `import_stream_sessions` table.

14. **MySQL/MariaDB binlog CDC:** New `CdcConnector` implementation using `mysql_cdc = "0.9"` (MIT). Requires: `binlog_format=ROW`, unique `server-id`, replication user. SSL limitation of `mysql_cdc` means only viable on private networks. GTID-based position tracking for restartability.

15. **MongoDB change streams:** No new crate — `mongodb` 3.x natively supports `collection.watch()`. Requires replica set (not standalone). Resume token persistence for restartability. Long-running task model, not ETL extract.

16. **SSE client connector:** New connector type using `reqwest-eventsource` (MIT/Apache-2.0). Long-lived background task per active SSE definition. Reconnect with exponential backoff + jitter. Session state in `import_stream_sessions`. Maps to historian SSE streams (PI Web API), some IoT platforms.

17. **WebSocket client connector:** `tokio-tungstenite` already in workspace. Custom reconnect loop with Ping/Pong keepalive, subscription handshake, re-authentication on reconnect. Same long-lived task model as SSE. Session state in `import_stream_sessions`.

### Tier 4 — Future / Optional

18. **SQS event-driven S3:** S3 → SQS queue → I/O polls SQS for `ObjectCreated` notifications → downloads only notified objects. Requires `aws-sdk-sqs = "1"` (Apache-2.0) and customer-side SQS + S3 event notification setup. Only justified if customers report large active buckets where the polling scan is slow.

19. **GraphQL subscriptions:** Low industrial demand as of 2026. GraphQL polling queries (non-subscription) already work via `GenericRestConnector` with `method: POST`. Subscription mode would require WebSocket + Apollo `graphql-ws` protocol layer. Defer until a target system lists GraphQL as its only integration surface.

20. **Dependency scheduling (`schedule_type = 'dependency'`):** Trigger definition B after definition A completes. Schema stub exists. Requires a DAG resolver and dependency-aware scheduler. Significant orchestration complexity.

21. **MSSQL Full CDC (`cdc.*` shadow tables):** More powerful than Change Tracking but requires SQL Server Enterprise edition, SQL Server Agent, and DBA enablement. Implement after Change Tracking polling is working and customer demand for before-images is confirmed.

22. **Oracle native connector:** `oracle` crate (UPL-1.0 or Apache-2.0) via ODPI-C. Requires Oracle Instant Client. Yields better type fidelity for Oracle-specific types than ODBC. Warrant only if Oracle source sites report ODBC connector issues.

---

## 3. New Cargo Dependencies Needed

All crates confirmed royalty-free commercial use (MIT, Apache-2.0, CC0, or UPL-1.0).

### Tier 1 (Quick Wins)

| Crate | Version | License | Purpose | When |
|---|---|---|---|---|
| `glob` | 0.3 | MIT OR Apache-2.0 | Filename pattern matching for SFTP/FTP/local connectors | With SFTP dir polling |

### Tier 2 (Medium Effort)

| Crate | Version | License | Purpose | When |
|---|---|---|---|---|
| `aws-sdk-s3` | 1.x | Apache-2.0 | S3 object storage connector | S3 connector |
| `aws-config` | 1.x | Apache-2.0 | AWS credential chain (env, instance profile, ~/.aws) | S3 connector |
| `suppaftp` | 6.x | MIT OR Apache-2.0 | FTP / FTPS connector | FTP connector |
| `notify` | 8.x | CC0-1.0 (public domain) | Linux inotify filesystem event watcher | Local file watcher |
| `notify-debouncer-full` | 0.4.x | MIT OR Apache-2.0 | Event deduplication for inotify | Local file watcher |
| `hmac` | 0.12.x | MIT OR Apache-2.0 | HMAC computation for webhook signature validation | Webhook receiver |
| `sha2` | 0.10.x | MIT OR Apache-2.0 | SHA-256 for HMAC | Webhook receiver |
| `hex` | 0.4.x | MIT OR Apache-2.0 | Hex encoding/decoding for HMAC signature comparison | Webhook receiver |
| `constant_time_eq` | 0.3.x | CC0-1.0 (public domain) | Timing-safe comparison preventing timing attacks on HMAC | Webhook receiver |

### Tier 3 (Significant Effort)

| Crate | Version | License | Purpose | When |
|---|---|---|---|---|
| `pgwire-replication` | 0.2.0 | MIT OR Apache-2.0 | PostgreSQL logical replication (pgoutput) CDC client | PG CDC |
| `mysql_cdc` | 0.9.x | MIT | MySQL / MariaDB binlog replication client | MySQL CDC |
| `reqwest-eventsource` | 0.6.x | MIT OR Apache-2.0 | SSE client with built-in ExponentialBackoff reconnect | SSE connector |

### No New Dependencies (already in workspace)

- Watermark DB polling: `sqlx`, `mysql_async`, `tiberius`, `odbc-api`, `mongodb` — all already present.
- MongoDB change streams: `mongodb` 3.x already supports `collection.watch()` natively.
- MSSQL Change Tracking: `tiberius` + T-SQL `CHANGETABLE(CHANGES ...)` — no new crate.
- WebSocket client: `tokio-tungstenite` is already a workspace dependency.

### Tier 4 (Future)

| Crate | Version | License | Purpose |
|---|---|---|---|
| `aws-sdk-sqs` | 1.x | Apache-2.0 | Event-driven S3 via SQS notifications |
| `globset` | 0.4.x | MIT OR Apache-2.0 | Multi-pattern simultaneous matching (alternative to `glob`) |

---

## 4. Schema Changes Needed

### 4a. Critical Bug Fix — `import_schedules` Missing Columns

The scheduler is entirely broken without these. Single migration.

```sql
ALTER TABLE import_schedules
  ADD COLUMN cron_expression       TEXT,
  ADD COLUMN interval_seconds      INTEGER,
  ADD COLUMN running               BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN last_heartbeat_at     TIMESTAMPTZ;
```

Additionally rename the column reference in `poll_import_schedules` from `s.definition_id` to `s.import_definition_id` (code-only fix — the DDL column name is already correct).

Fix `import_runs.triggered_by` CHECK constraint — either change the constraint from `'schedule'` to `'scheduled'` to match what the code writes, or change the code. Pick one and be consistent:

```sql
ALTER TABLE import_runs
  DROP CONSTRAINT import_runs_triggered_by_check,
  ADD CONSTRAINT import_runs_triggered_by_check
    CHECK (triggered_by IN ('manual', 'schedule', 'webhook', 'file_arrival', 'dependency', 'retry'));
-- Update code to write 'schedule' not 'scheduled'.
```

### 4b. Webhook Buffer Table (new, for Tier 2 webhook receiver)

```sql
CREATE TABLE import_webhook_buffer (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_definition_id UUID NOT NULL REFERENCES import_definitions(id) ON DELETE CASCADE,
    payload              JSONB NOT NULL,
    received_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at         TIMESTAMPTZ,
    processing_status    VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (processing_status IN ('pending', 'processing', 'done', 'failed')),
    error_message        TEXT
);

CREATE INDEX ON import_webhook_buffer (import_definition_id, processing_status, received_at)
    WHERE processing_status = 'pending';
```

### 4c. Stream Sessions Table (new, for Tier 3 SSE/WebSocket/CDC connectors)

Required because SSE, WebSocket, and CDC connectors are long-lived and cannot be modeled as `import_runs` (which have discrete start/end boundaries).

```sql
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
    resume_token         JSONB,          -- CDC/change-stream resume position
    error_message        TEXT,
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ON import_stream_sessions (import_definition_id, status);
```

### 4d. Optional: `watermark_state` on `import_schedules` (alternative to querying latest run)

Current plan: read watermark from the latest completed `import_runs` row. If this proves slow (many runs per definition), add:

```sql
ALTER TABLE import_schedules
  ADD COLUMN watermark_state JSONB;
```

Watermark is then written here after each successful run, avoiding the lookup query. The tradeoff: this duplicates watermark state between the schedule row and the run row. Defer until the run-query approach is measured to be a bottleneck.

### 4e. Consider: `UNIQUE` constraint on `custom_import_data (import_definition_id, source_row_id)` for Upsert

Currently `source_row_id` in `custom_import_data` has no unique constraint, making upsert-based deduplication impossible. For watermark-based incremental loading with a configurable `id_field`, add:

```sql
CREATE UNIQUE INDEX custom_import_data_dedup_idx
    ON custom_import_data (import_definition_id, source_row_id)
    WHERE source_row_id IS NOT NULL;
```

This enables `ON CONFLICT (import_definition_id, source_row_id) DO UPDATE` in the load step, preventing duplicates when the watermark overlap window causes re-processing.

---

## 5. New API Endpoints Needed

### Webhook Receiver (Tier 2)

```
POST /import/webhook/:definition_id/:token
```

- Public-facing (no JWT required — external system cannot hold a user token).
- `token` is a URL-embedded 32-byte random hex secret stored in `import_connections.auth_config`.
- HMAC signature validated from request header before any DB access.
- Responds HTTP 200 immediately after writing to `import_webhook_buffer`.
- Responds HTTP 401 if token or HMAC validation fails (timing-safe).
- Responds HTTP 404 if `definition_id` does not exist (checked after token validation to prevent enumeration).
- Responds HTTP 429 if the definition's buffer exceeds a configurable depth.

The nginx proxy config must allow this path without JWT enforcement (all other `/api/import/*` routes are JWT-protected at the API Gateway level). Likely requires a route exception in the API Gateway.

### Schedule Management (already have CRUD — gaps to fill)

The schedule CRUD endpoints already exist in the route table:

```
GET    /import/definitions/:id/schedules
POST   /import/definitions/:id/schedules
PUT    /import/schedules/:id
DELETE /import/schedules/:id
```

No new endpoints needed. But the handlers for these need to be verified — they persist rows to `import_schedules` but there is no test evidence the `schedule_config` JSONB shape is validated or the `next_run_at` is computed correctly on create.

### Webhook Secret Management (new)

When a user creates a `webhook` schedule type, they need to get the webhook URL (including the secret token) from the UI. Add a dedicated endpoint:

```
POST /import/definitions/:id/webhook-token
```

Returns `{ "webhook_url": "https://io.plant.local/api/import/webhook/{id}/{token}", "token": "..." }`. Generates and stores a new 32-byte token in `import_connections.auth_config.webhook_token` (encrypted). If a token already exists, regenerates it (invalidating the old URL).

### Stream Session Status (Tier 3)

```
GET  /import/definitions/:id/stream-session
POST /import/definitions/:id/stream-session/stop
POST /import/definitions/:id/stream-session/restart
```

Allows operators to see the current SSE/WebSocket/CDC connection status and force a reconnect. Returns the `import_stream_sessions` row.

---

## 6. Frontend Changes Needed

All changes are in `frontend/src/pages/settings/Import.tsx` and related components. The current UI surface is minimal: manual run only, no schedule management, no dry-run, no field mapping.

### 6a. Schedule Tab / Panel (required for Tier 1 benefit to be visible)

Add a **Schedules** sub-panel to the Definitions tab (or as a fourth top-level tab). For each definition:

- List active schedules with type badge (`interval`, `cron`, `file_arrival`, `webhook`), next run time, last run time, enable/disable toggle.
- "Add Schedule" button opens a drawer with:
  - Schedule type selector: `Manual only`, `Fixed interval`, `Cron expression`, `File arrival`, `Webhook (push)`.
  - Conditional fields:
    - `interval`: duration picker (seconds/minutes/hours).
    - `cron`: cron expression input with human-readable preview (e.g., "every day at 06:00").
    - `file_arrival`: transport type (local path, SFTP, S3), watch directory, file pattern.
    - `webhook`: displays the auto-generated webhook URL and copy button; shows HMAC secret (masked).
  - Enabled toggle.

### 6b. Watermark / Incremental Import Toggle (required for Tier 1 benefit)

In the Definition editor (currently there is no editor — definitions are created via API only), add:

- "Incremental import" toggle (boolean).
- When enabled, show:
  - Watermark column name (e.g., `updated_at`, `MODIFIEDON`, `id`).
  - Watermark type: `timestamp` or `integer`.
  - Safety lookback window (seconds, default 120).
  - Current watermark value (read-only, from latest run's `watermark_state`).
  - "Reset watermark" button (triggers full re-extract on next run).

### 6c. Source Config Editor

The definition editor needs a way to configure `source_config`. Currently this is only settable via raw API. The fields that must be surfaced in the UI (varies by connector type):

- **All file connectors via SFTP/FTP/S3:** `remote_dir`, `file_pattern`, `file_format`, `archive_dir`, `dedup_strategy`.
- **REST connector:** `endpoint`, `method`, `pagination_type`, `page_size`, `records_path`, `watermark_param`, `watermark_field`, `id_field`.
- **DB connectors:** `query` (multi-line text area), `watermark_column`, `watermark_type`.

Show only fields relevant to the connector type of the parent connection.

### 6d. Dry-Run Toggle

The API supports `dry_run: true` but the UI never sets it. Add a "Dry run" checkbox to the "Run Now" flow (both the button and context menu item). The run history table should show a "DRY RUN" badge on dry-run rows.

### 6e. Stream Session Status Panel (Tier 3)

For definitions using SSE, WebSocket, or CDC schedule types, replace the "Run Now" button with a persistent connection status indicator:

- Status badge: `Connecting`, `Active` (with event count and last event time), `Reconnecting` (with reconnect count), `Failed`.
- "Stop" and "Restart" buttons.
- Link to reconnection log.

### 6f. Run History Enhancements

- Show `watermark_state` values on completed run detail drawer (what watermark was used, what new watermark was recorded).
- Show `files_processed` list from `run_metadata` when the connector processed multiple files in one poll cycle.
- Add filter by `triggered_by` (manual / schedule / webhook / file_arrival).

---

## 7. Cross-Cutting Concerns

### 7a. Concurrency Control

**Current state:** Nothing prevents two scheduler ticks from spawning duplicate runs for the same definition. The `FOR UPDATE SKIP LOCKED` claim loop in `poll_import_schedules` prevents the scheduler from processing the same schedule row twice, but only if the scheduler is single-instance (no horizontal scaling).

**Required additions:**

1. **`running` flag on `import_schedules`:** The schema migration (§4a) adds `running BOOLEAN`. Set to `true` before spawning `pipeline::execute()`, reset to `false` on completion. The scheduler skips rows where `running = true`. This is the in-progress concurrency guard.

2. **Heartbeat / stale recovery:** `last_heartbeat_at` (added in §4a) is updated every 30 seconds by the active pipeline task. The scheduler resets `running = false` for any row where `last_heartbeat_at < NOW() - INTERVAL '5 minutes'` — this handles service restarts that abandoned in-progress runs.

3. **Advisory locks for webhook drain:** The webhook buffer drain task should use PostgreSQL advisory locks (`pg_try_advisory_lock`) keyed on `import_definition_id` to prevent two drain tasks from processing the same definition concurrently if the service is ever horizontally scaled.

4. **SSE/WebSocket/CDC sessions:** Only one active session per `import_definition_id`. On service startup, check `import_stream_sessions` for any `active` or `reconnecting` rows and restart them (the previous service instance may have crashed).

### 7b. Watermark State Storage and Propagation

**Storage location:** `import_runs.watermark_state JSONB` (already in schema, never written). Read the most recent row for the definition where `status = 'completed'` and `watermark_state IS NOT NULL`.

**Write timing:** At the end of a successful pipeline run (after `tx.commit()`, before emitting the final NOTIFY). Do not write on `failed` or `dry_run` runs.

**Propagation into the connector:** Pass as a new field in `EtlConnectorConfig`:
```rust
pub watermark_state: Option<JsonValue>,  // None on first run
```

Each connector that supports incremental mode reads from this field and constructs its parameterized query.

**Unified watermark JSONB shape** (all connector types use this envelope):
```json
{
  "watermark_type": "timestamp" | "integer" | "change_tracking_version" | "s3_keys" | "sftp_files" | "delta_token",
  "watermark_column": "<column_name>",   // DB connectors
  "last_value": "<timestamp or integer as string>",
  "last_sync_version": 8192,             // MSSQL CT only
  "seen": { "<filename>": { "mtime": 0, "size": 0 } },  // file connectors
  "last_checked_at": "<timestamp>",      // S3 connector
  "delta_token": "<opaque_token>",       // OData V4
  "last_run_row_count": 0,
  "last_run_completed_at": "<timestamp>"
}
```

**Safety lookback for timestamp watermarks:** Subtract a configurable buffer (default 120 seconds) from the previous watermark before using it in the query. This handles clock skew and in-flight records. Accept the resulting re-processing; use `source_row_id` upsert to absorb duplicates.

### 7c. Error Handling and Retry Policies Per Trigger Mode

| Trigger Mode | Error Response | Retry Strategy |
|---|---|---|
| **Manual** | Immediate failure; `import_runs.status = 'failed'`; `pg_notify('import_alert')` | User retries manually; no automatic retry |
| **Interval / Cron** | Run marked `failed`; `running = false` on schedule row | Scheduler will re-trigger on next interval/cron tick naturally. No exponential backoff needed — the poll interval IS the backoff. Operators see consecutive failures in run history. |
| **File-arrival (local)** | If pipeline fails, the file is NOT moved to archive; it will be re-detected on next event if `file_pattern` still matches | The `notify` watcher continues; the file must be re-written (close+write) or manually re-triggered for reprocessing. Consider a configurable `retry_failed_files: bool` flag. |
| **File-arrival (SFTP/S3 simulated)** | Failed files remain in `watermark_state.seen` as un-acknowledged; next poll re-attempts them | Automatic retry on next poll. After N consecutive failures on a single file, quarantine it (move to error dir or mark in `watermark_state.failed`). |
| **Webhook** | Drain task marks buffer row `failed`; external system does not receive an error (already got HTTP 200) | Configurable retry count (default 3) with exponential backoff within the drain loop. After max retries, leave in `failed` state for operator review. Emit `pg_notify('import_alert')`. |
| **SSE / WebSocket** | Connection drop triggers reconnect loop | Exponential backoff: 500ms initial, factor 2, cap 60s, +20% jitter. Circuit-break after 10 consecutive failures within 5 minutes — emit alert, wait 10 minutes before resuming. |
| **CDC (all types)** | Replication connection drop triggers reconnect; position/LSN persisted so no data loss | Same backoff as SSE/WebSocket. Additional risk: PostgreSQL replication slots accumulate WAL during downtime — alert if WAL lag exceeds configurable threshold. |

### 7d. Observability (Metrics and Logging Per Schedule Type)

**Existing metrics** (from `pipeline.rs`):
- `io_import_runs_total` (counter)
- `io_import_rows_processed_total` (counter)
- `io_import_errors_total` (counter)

**New metrics needed:**

```
io_import_scheduler_ticks_total{type="cron|interval"}        — scheduler poll cycles
io_import_scheduler_due_count{type="cron|interval"}          — schedules found due per tick
io_import_watermark_lag_seconds{definition_id}               — age of the last successful watermark
io_import_file_poll_new_files_total{connector="sftp|s3|ftp|local"}  — new files found per poll
io_import_webhook_buffer_depth{definition_id}                — pending items in webhook buffer
io_import_webhook_received_total{definition_id}              — webhooks received
io_import_stream_session_reconnects_total{type,definition_id} — reconnection events
io_import_stream_events_received_total{type,definition_id}   — events processed by streaming connectors
io_import_stream_lag_seconds{type,definition_id}             — seconds since last event received
```

**Structured logging per mode:**
- Scheduler: log at `INFO` when schedules are due, `DEBUG` for "no schedules due" ticks.
- Watermark: log at `DEBUG` the watermark value used and the new high-watermark recorded.
- File polling: log at `INFO` each new file found, `DEBUG` each skipped (unchanged) file.
- Webhook: log at `INFO` each received webhook (definition_id, size), `WARN` on HMAC failure, `ERROR` on drain failure.
- Streaming: log at `INFO` on connect/disconnect/reconnect, `DEBUG` per event (only in debug builds — could be very high volume in production).

---

## 8. Recommended Industrial Defaults

### 8a. Default Trigger Mode Per Connector Category

| Connector Category | Recommended Default | Rationale |
|---|---|---|
| **File (CSV/Excel/JSON/XML)** | Manual only | Files are typically one-off or ad-hoc. Automatic scheduling is opt-in. |
| **SFTP** | `interval`, 300 seconds | Lab systems export infrequently. 5-minute poll avoids hammering SSH. The SFTP server is often a shared OT system; be respectful of connection load. |
| **FTP** | `interval`, 300 seconds | Legacy FTP servers are resource-constrained. 5 minutes is conservative and safe. |
| **S3 / Object Storage** | `interval`, 300 seconds | S3 list operations are cheap but there is no industrial need for sub-5-minute latency from an object store. |
| **Local filesystem** | `file_arrival` (inotify) | Zero-latency, zero-poll-load. Correct default for a watched inbox directory. |
| **PostgreSQL** | `interval`, 3600 seconds (1 hour) | LIMS and access control DB reads are low-urgency. 1-hour cadence for initial deployment; tune down if needed. |
| **MySQL / MariaDB** | `interval`, 3600 seconds | Same rationale as PostgreSQL. |
| **MSSQL** | `interval`, 3600 seconds with MSSQL Change Tracking | Same. CT polling adds delete detection with no additional overhead. |
| **ODBC** | `interval`, 3600 seconds | ODBC sources are often legacy and resource-constrained. Conservative default. |
| **MongoDB** | `interval`, 3600 seconds | Same rationale as PostgreSQL. |
| **Generic REST API** | `interval`, 300 seconds | REST APIs are cheap to poll. 5-minute default covers most near-real-time monitoring needs without webhook complexity. |
| **Webhook receiver** | N/A (push, not pull) | Event-driven by definition. The associated poll schedule is not applicable. |

### 8b. Default Poll Intervals by Data Urgency

| Data Type | Recommended Interval | Rationale |
|---|---|---|
| Emergency muster badge events | 10–30 seconds (or webhook) | Operationally critical; see §8c |
| Safety permit (LOTO) status | 60–300 seconds | Safety-critical but not emergency; 1–5 minutes acceptable |
| Work order status | 3600 seconds (1 hour) | Work orders change slowly; hourly is sufficient |
| Equipment/asset records | 86400 seconds (daily) | Asset data is stable; daily sync is appropriate |
| LIMS sample results | 300–900 seconds | Lab results land in batches; 5–15 minute polling covers the export cadence |
| Badge event audit trail | 300 seconds | Compliance-relevant but not real-time critical |
| Personnel / cardholder roster | 3600 seconds | Roster changes are infrequent; hourly is appropriate |
| Historical forensics data | Manual or daily | Bulk historical load; scheduled nightly is fine |

### 8c. What "Near Real-Time" Means in Industrial Context

In refinery and process industry environments, "real-time" has a different meaning than in web applications. OPC UA subscriptions for process data target 1–2 second update latency (the I/O Data Broker). For the import service, which handles supplemental operational data (LIMS, CMMS, access control), different latency bands apply:

| Latency Band | Definition | Import Service Implication |
|---|---|---|
| **Hard real-time** | < 100ms | Not achievable or required for import service. Process control systems use OPC UA directly, not the import pipeline. |
| **Soft real-time** | < 2 seconds | Achievable only via webhooks or SSE/WebSocket streaming. Required for emergency mustering (badge swipes must appear in muster roll within 5 seconds per industrial safety practice). |
| **Near real-time** | 10–60 seconds | Achievable via short-interval polling (10s for critical, 60s for normal). Appropriate for badge event occupancy dashboards, safety permit status, alarm acknowledgement confirmation. |
| **Operational real-time** | 1–5 minutes | The practical floor for polling-based import. Appropriate for most LIMS, work order, and environmental monitoring integrations. This is what most on-premise industrial APIs can support without performance impact. |
| **Batch near-real-time** | 15–60 minutes | Appropriate for CMMS work order sync, personnel roster sync, calibration record updates. |
| **Daily batch** | 24 hours | Asset master data, historical reports, compliance data. |

**Key implication:** For the I/O import service, "near real-time" should be defined as **1–5 minutes** for standard operational data and **10–30 seconds** for safety-critical data (muster, LOTO). Anything requiring sub-10-second latency should use webhooks (Tier 2) or a dedicated short-poll connector profile. Claiming "real-time" import from polling-based connectors at 5-minute intervals is appropriate language in an industrial monitoring product — process engineers understand polling intervals.

### 8d. Concurrency and Load Defaults

- **Default `batch_size`:** 1000 rows per insert batch. Fine for most connectors. Increase to 5000 for LIMS or access control systems with large historical backlogs.
- **Default `error_strategy`:** `quarantine` (existing schema default). Never `stop` in production schedules — a single bad row should not halt the entire run.
- **Default `error_threshold_percent`:** 10%. Emit an alert if more than 10% of rows fail validation; this indicates a schema change on the source system.
- **Max concurrent runs per definition:** 1 (enforced by `running` flag on `import_schedules`).
- **Webhook buffer max depth:** 1000 pending events before returning HTTP 429. Configurable per definition.

---

## 9. Implementation Phase Plan

This synthesizes all of the above into a sequenced delivery order.

### Phase A — Make Scheduled Imports Work (unblocks everything)
*Estimated: 1 week*

1. Migration: add missing `import_schedules` columns (`cron_expression`, `interval_seconds`, `running`, `last_heartbeat_at`).
2. Fix `triggered_by` CHECK constraint mismatch.
3. Fix code reference from `s.definition_id` to `s.import_definition_id` in `poll_import_schedules`.
4. Fix `import_definitions.enabled` not being checked by the scheduler.
5. Implement heartbeat update in `pipeline::execute()`.
6. Implement stale-run recovery in the scheduler.
7. Add basic scheduler metrics.
8. **Verify:** Create a schedule row via API, confirm the scheduler fires at the correct time.

### Phase B — Watermark Incremental for All Connectors
*Estimated: 1–2 weeks*

1. Add `watermark_state: Option<JsonValue>` to `EtlConnectorConfig`.
2. Pipeline reads previous run's `watermark_state` and passes it into `EtlConnectorConfig`.
3. Pipeline writes new `watermark_state` on successful completion.
4. Implement watermark injection in: `PostgresConnector`, `MySqlConnector`, `MssqlConnector`, `OdbcConnector`, `MongoConnector`, `GenericRestConnector`.
5. Fix `source_row_id` to use `source_config.id_field` value.
6. Add MSSQL Change Tracking polling mode (uses existing `tiberius`).
7. Add link-header pagination to `GenericRestConnector`.
8. **Verify:** Run a DB connector with watermark; confirm that only new rows are extracted on subsequent runs.

### Phase C — SFTP Directory Polling + File Format Dispatch
*Estimated: 1 week; this is the stated user need*

1. Add `glob = "0.3"` dependency.
2. Create `connectors/etl/file_polling.rs` with `FilePollingState` struct.
3. Extend `SftpConnector` with `poll_directory()` method; maintain backward compat with `remote_path`.
4. Add archival logic (`sftp.rename()` after successful parse).
5. **Verify:** SFTP connection configured with `remote_dir` + `file_pattern: "*.xlsx"` + `file_format: "excel"`; new Excel files are ingested on schedule; processed files move to archive.

### Phase D — New File Connectors (S3, FTP, Local)
*Estimated: 2–3 weeks total*

1. S3 connector with poll-based `list_objects_v2` + watermark.
2. Local filesystem connector with `notify` inotify watcher + `file_arrival` schedule type.
3. FTP connector using `suppaftp`.
4. All three share `FilePollingState` from Phase C.

### Phase E — Webhook Receiver
*Estimated: 1–2 weeks*

1. Add `import_webhook_buffer` migration.
2. Add webhook receiver Axum route with HMAC validation.
3. Add background drain task in `main.rs`.
4. Add webhook secret management endpoint.
5. Update API Gateway to allow unauthenticated access to webhook path.

### Phase F — Streaming Connectors (SSE, WebSocket)
*Estimated: 2–4 weeks*

1. Design `StreamingConnector` trait.
2. Add `import_stream_sessions` migration.
3. Implement SSE connector using `reqwest-eventsource`.
4. Implement WebSocket connector using `tokio-tungstenite`.
5. Add stream session status API endpoints.

### Phase G — CDC (Design, then Implement)
*Estimated: 3–5 weeks*

Design first — determine the `CdcConnector` trait interface, persistence model, and supervision architecture — before committing to an implementation. Each DB type is a separate sub-task.

---

## 10. Cross-Reference: What Each Research File Covers

| File | Primary Contribution to This Synthesis |
|---|---|
| `01_current_architecture.md` | Ground truth: what works, what is broken, exact schema DDL, route table, pipeline steps, gaps inventory |
| `02_database_connectors.md` | DB watermark patterns per type, CDC feasibility per type, crate options for CDC, industrial use cases for each DB type, MSSQL Change Tracking as the recommended CDC-lite approach |
| `03_file_connectors.md` | SFTP directory polling approach using existing `russh-sftp`, `FilePollingState` design, S3 polling approach, local inotify via `notify`, FTP gap analysis, `suppaftp` recommendation, crate license confirmations |
| `04_rest_connectors.md` | Webhook receiver design (HMAC, queue, drain), SSE client design, WebSocket client design, access control system API analysis (Genetec, Lenel, C•CURE), CMMS API analysis (Maximo OSLC, SAP OData, HxGN EAM), real-time vs near-real-time latency analysis |

---

*Synthesis completed 2026-04-04. Based on research files 01–04. Files 05 and 06 were not yet available; supplement this document when they are complete.*

---

## 10. DCS Supplemental Connector Findings

*Source: `05_dcs_connectors.md`*

### What the 7 DCS Connectors Do

DCS supplemental connectors operate outside the ETL pipeline entirely. They run on a shared 5-minute poll loop (`run_supplemental_connectors()`) and write to `points_metadata` and the `events` hypertable — not to `custom_import_data`. Their sole purpose is to fill in metadata gaps left by OPC UA: engineering units, EU range bounds, alarm limits, and alarm event history. OPC UA always wins — the DB write uses `COALESCE` semantics and only overwrites NULL fields.

The seven connectors and what each actually delivers today:

| Connector | Metadata fields populated | Events populated | Key limitation |
|---|---|---|---|
| **PI Web API** (`pi_web_api`) | description, EU, eu_range_low, eu_range_high (bugged) | Event frames (no severity, no external ID) | eu_range_high bug; alarm limits absent; no event dedup |
| **Honeywell Experion EPDOC** (`experion_rest`) | description, EU, all 4 alarm limits | Alarm history (severity, alarm_state, external ID) | No pagination; per-tag fan-out is slow at scale |
| **Siemens SPH** (`siemens_sph_rest`) | description, EU only | Alarm history (severity, alarm_type, alarm_state, external ID) | NTLM auth not implemented; alarm limits absent |
| **Siemens WinCC OA** (`wincc_oa_rest`) | description, EU, eu_range_low, eu_range_high | Alarm history (severity, alarm_state, external ID) | Sequential per-datapoint fetch; alarm limits absent; alarm_type absent |
| **Kepware KEPServerEX** (`kepware_rest`) | description, EU, eu_range_low, eu_range_high | None (Kepware has no alarm history API) | Tag group recursion broken — most tags silently missed |
| **Canary Labs** (`canary_rest`) | description, EU only | None (values-only historian) | Historical data backfill use case entirely absent |
| **ABB 800xA IM** (`s800xa_rest`) | description, EU only | Alarm history (severity, alarm_type, alarm_state, external ID) | Events pagination missing; EU range and alarm limits absent |

All seven connectors produce no `import_runs` rows. There is no run history, no per-connection error tracking, and no operator-visible health status for any supplemental connector.

### 3 Bugs That Need Fixing Regardless of Scheduling Plan

These are correctness bugs in the currently-running code. They are independent of any scheduling or architecture decisions and should be fixed before other supplemental connector work proceeds.

**Bug 1 — PI Web API `eu_range_high` stores Span, not Zero+Span.**
PI's `Span` attribute is a delta (range width), not an absolute upper bound. A tag with `Zero=-40` and `Span=240` has a correct `eu_range_high` of 200, but the connector stores 240. Fix: change the calculation from storing `Span` to storing `Zero + Span`.

**Bug 2 — Kepware tag group recursion is absent.**
The Kepware connector fetches only the device-level `tags` endpoint. KEPServerEX organizes tags into nested tag groups (this is the normal project structure). Tags inside any tag group are silently missed. For most real-world Kepware configurations this means the majority of tags are never retrieved. Fix: recursively walk the `tag_groups` array within each device, collecting all nested tags.

**Bug 3 — Siemens SPH NTLM auth falls back to unauthenticated.**
When the connector detects NTLM auth (common in Windows-domain SPH deployments), it logs a warning and continues unauthenticated. This means SPH connectors at Windows-domain sites are effectively non-functional — all requests will be rejected. Fix: implement NTLM auth using the `ntlm` or `windows-auth` crate, or use `reqwest`'s digest/NTLM support if available.

### Push / Subscription Verdict for All DCS Vendors

All seven connectors are polling-only, and this is the correct design. The detailed per-vendor analysis confirms:

- **PI Web API** has SSE streaming via `/piwebapi/streams/{webId}/channel`, but this is for real-time tag values — not metadata or event frames. Supplemental connectors care about configuration data, which is stable and only requires periodic refresh.
- **Honeywell Experion EPDOC** has no subscription or notification API. Polling with a time window is the only model the EPDOC REST API supports.
- **Siemens SPH** has no push API. Its primary interfaces are OLEDB/ODBC and the SIMATIC HMI API. The REST API is read-only and polling-based.
- **WinCC OA** has a WebSocket API for real-time datapoint values (not alarm history). Useful only if WinCC OA were used as a real-time data source alongside OPC UA — outside the supplemental connector scope.
- **Kepware** has no notification mechanism on its Configuration REST API. The IoT Gateway plugin publishes values outbound to an MQTT broker; it cannot be used as a subscribable endpoint.
- **Canary Labs** is values-only via REST; its real-time path is OPC UA, which I/O already handles.
- **ABB 800xA IM** has no push/subscription capability via its REST API.

The polling design is appropriate for metadata augmentation. The primary improvement needed is making the poll interval configurable per connection (separate intervals for metadata vs. events) rather than the current hardcoded 5 minutes for all.

### Recommended Poll Intervals Per Connector Type

| Connector | Recommended metadata interval | Recommended event interval | Rationale |
|---|---|---|---|
| PI Web API | 1–24 hours | 20–30 minutes | Tag configs change rarely; event frames are retroactive, not live |
| Experion EPDOC | 1 hour | 10–15 minutes | Config is stable; alarm history is the primary value |
| Siemens SPH | 1 hour | 10–15 minutes | Same rationale |
| WinCC OA | 1 hour | 10–15 minutes | Same rationale; per-dp fetch is slow so longer interval needed |
| Kepware | 15–30 minutes | N/A | Project changes during engineering phases; no events |
| Canary | 4–24 hours | N/A | Tag list is extremely stable; no events |
| ABB 800xA IM | 1 hour | 10–15 minutes | Events pagination gap makes longer intervals safer for now |

The simplest implementation is to add `poll_interval_seconds` and `event_poll_interval_seconds` to `import_connections.config` (the existing JSONB column) and read them in the poller, defaulting to 300s if absent. This requires no schema migration.

### 3 New Connectors Worth Building

**Priority: High — AspenTech InfoPlus.21 (`aspen_ip21_rest`)**
IP.21 is the dominant historian in refinery advanced process control and hydrocarbon processing. Its REST API (available since ~2019) exposes full tag metadata including HIHI/HI/LO/LOLO alarm limits natively — making it one of the most complete supplemental metadata sources available. Priority is high because AspenTech sites running Aspen APC are a core I/O target market.

**Priority: Medium — Yokogawa CENTUM VP (`yokogawa_centum_rest`)**
Yokogawa introduced a REST API in CENTUM VP R6.09 (2021) via the Plant Resource Manager. Metadata and alarm history are both accessible. Yokogawa is the fourth most common DCS in refinery and petrochemical applications. The REST API is mature in widely-deployed versions.

**Priority: Medium — AVEVA EcoStruxure Foxboro (`foxboro_rest`)**
Foxboro DCS (formerly I/A) has a REST API via the FoxConnect platform as of I/A v9.4. Covers compound/block hierarchy, parameter values, and alarm events. Common in older refineries and specialty chemical plants. Less common than Honeywell, Emerson, or ABB but still significant in legacy refinery applications.

Note: Emerson DeltaV and Rockwell FactoryTalk do not need DCS REST connectors. DeltaV already has the correct integration path (OPC UA for real-time, MSSQL ETL connector for alarm history via Event Chronicle). Rockwell FactoryTalk Historian uses OPC UA, which I/O already handles.

### The Structural Gap: No Visibility into DCS Connector Health

The supplemental poll loop creates no `import_runs` rows, records no timing, captures no error counts, and emits no structured metrics. Errors appear only in service logs at WARN level. Operators have no way to see when a DCS connection was last successfully polled, how many tags were updated, or whether the last poll failed.

This is the most important structural deficiency in the current DCS connector design. At minimum, `import_connections` needs two new columns:

```sql
ALTER TABLE import_connections
    ADD COLUMN supplemental_last_polled_at TIMESTAMPTZ,
    ADD COLUMN supplemental_last_error TEXT,
    ADD COLUMN supplemental_last_metadata_count INTEGER,
    ADD COLUMN supplemental_last_event_count INTEGER;
```

These four columns are the minimum surface needed for the Settings UI to show per-connection health status. Without them, supplemental connectors cannot be considered production-ready.

---

## 11. Scheduler Architecture: Exact Changes Required

*Source: `06_scheduler_architecture.md`*

### Column Mismatches in `poll_import_schedules()`

The scheduler function at `services/import-service/src/main.rs` lines 248–402 references columns that do not exist in the `import_schedules` DDL as shipped. The function cannot execute without a schema migration. Every column mismatch is listed below:

| SQL / code reference | Actual DDL column | Fix required |
|---|---|---|
| `s.definition_id` | `import_definition_id` | Rename DDL column to `definition_id` (code and design doc both use `definition_id`; DDL is the outlier) |
| `s.cron_expression` | not in DDL | Add column: `cron_expression VARCHAR(100)` |
| `s.interval_seconds` | not in DDL | Add column: `interval_seconds INTEGER` |
| `s.running` | not in DDL | Add column: `running BOOLEAN NOT NULL DEFAULT false` |
| `s.last_heartbeat_at` | not in DDL | Add column: `last_heartbeat_at TIMESTAMPTZ` |
| `trigger` (INSERT into `import_runs`) | column is `triggered_by` | Change INSERT column name from `trigger` to `triggered_by` |
| value `'scheduled'` (INSERT into `import_runs`) | CHECK requires `'schedule'` | Fix: update the CHECK constraint to allow `'scheduled'` (the code value is more readable; the constraint is the outlier) |

Beyond column names, there is a secondary code bug: `running` is set to `false` immediately after spawning the ETL task (not after it completes). This means `running` functions as a claim reservation flag, not an execution flag. The real concurrency guard must come from `last_heartbeat_at` being updated inside the spawned ETL task. The spawned task currently never updates `last_heartbeat_at`, making the stale-run recovery mechanism completely inoperative.

### All 6 Schedule Types and How Each is Handled

**`manual`** — No automatic scheduling. The scheduler loop skips all `manual` rows entirely (by filtering `schedule_type IN ('cron', 'interval')` in the WHERE clause). Manual runs are triggered only via `POST /import/definitions/:id/runs`. No changes to the manual path are needed; it is the only fully functional path today.

**`cron`** — Time-based scheduling using a cron expression stored in `schedule_config` as `{"expression": "0 6 * * *", "timezone": "UTC"}` and redundantly in the dedicated `cron_expression` column (for indexed query performance). After migration, the scheduler reads `cron_expression`, calls `cron::Schedule::from_str(expr)?.upcoming(chrono::Utc).next()` to get the next fire time, claims the row with `FOR UPDATE SKIP LOCKED`, spawns `pipeline::execute`, and stores the next-next fire time. On restart, if `next_run_at` is in the past, the scheduler fires once immediately and then advances forward — it does not replay missed cycles. Timezone support uses `chrono_tz::Tz` parsed from `schedule_config.timezone`; the `cron` crate's `upcoming()` method accepts any `chrono::TimeZone`.

**`interval`** — Fixed-period scheduling using `{"interval_seconds": 300}` in `schedule_config` and the dedicated `interval_seconds` column. The scheduler sets `next_run_at = NOW() + interval_seconds` after spawning each run, measuring the interval from run start rather than completion (prevents interval drift). Concurrency guard: if `running = true AND last_heartbeat_at > NOW() - 5 minutes`, the row is skipped. If `running = true AND last_heartbeat_at < NOW() - 5 minutes`, the run is treated as crashed and reclaimed.

**`file_arrival`** — Event-driven but implemented as a directory-listing comparison within the scheduler loop (not a separate inotify watcher task). The scheduler loop handles `file_arrival` rows alongside `cron` and `interval`, but instead of comparing `next_run_at` against a timestamp it compares the current remote/local directory listing against the `seen_files` array stored in `schedule_config`. New files trigger a run with the filename passed in `run_metadata`. After each check, `next_run_at` is set to `NOW() + poll_interval_seconds` (from `schedule_config`, default 60s). SFTP and S3 file arrival work identically — polling the remote listing. No separate `notify`-based watcher registry is needed in the initial implementation; a consistent polling model across all three watch types (local, SFTP, S3) is simpler and correct.

**`webhook`** — Entirely self-triggering; the scheduler loop excludes `webhook` rows. When a POST arrives at `/import/webhooks/:token`, the handler looks up the matching schedule by token, checks that no run is currently in `pending` or `running` state, inserts an `import_runs` row with `triggered_by = 'webhook'`, and spawns `pipeline::execute`. A `buffer_seconds` field in `schedule_config` provides optional debounce. The token in `schedule_config` should be stored encrypted and shown only once at creation time.

**`dependency`** — Graph-based scheduling where definition B runs automatically after definition A completes successfully. The scheduler loop excludes `dependency` rows. Instead, `pipeline::execute` in `pipeline.rs` queries `import_schedules` for any dependency rows whose `schedule_config->>'depends_on_definition_id'` matches the just-completed definition ID, and directly spawns those dependent runs. A recursive CTE cycle-detection query must be executed when a dependency schedule is created to prevent DAG cycles, returning 422 if a cycle is detected.

### Migration SQL: Columns Needed

The correcting migration adds/renames the following (full SQL is in `06_scheduler_architecture.md` §4):

| Table | Change |
|---|---|
| `import_schedules` | Rename `import_definition_id` → `definition_id` |
| `import_schedules` | Add `cron_expression VARCHAR(100)` |
| `import_schedules` | Add `interval_seconds INTEGER` |
| `import_schedules` | Add `watch_path VARCHAR(500)` |
| `import_schedules` | Add `watch_pattern VARCHAR(255)` |
| `import_schedules` | Add `timezone VARCHAR(50) DEFAULT 'UTC'` |
| `import_schedules` | Add `running BOOLEAN NOT NULL DEFAULT false` |
| `import_schedules` | Add `last_heartbeat_at TIMESTAMPTZ` |
| `import_runs` | Fix `triggered_by` CHECK: add `'scheduled'` to allowed values |

The migration also backfills `cron_expression` and `interval_seconds` from existing `schedule_config` JSONB rows, and adds a GIN index on `schedule_config` for dependency schedule lookups.

### Crate Recommendation: Keep `cron = "0.12"`

`cron = "0.12"` is already pinned in `Cargo.toml` and the existing code at line 355 uses its API correctly (`cron::Schedule::from_str(expr)?.upcoming(chrono::Utc).next()`). The crate is MIT licensed.

Two alternatives were evaluated: `croner` (MIT, more actively maintained, slightly different API) and `tokio-cron-scheduler` (MIT, full in-memory scheduler). `croner` is a reasonable swap but not worth mid-project friction. `tokio-cron-scheduler` is actively wrong for this use case: it maintains an in-memory task registry that loses state on crash, cannot integrate with `FOR UPDATE SKIP LOCKED`, and still would not handle `interval`, `file_arrival`, `webhook`, or `dependency` types — you would need the existing poll loop anyway.

The `cron` crate is a timestamp calculator, not a scheduling engine. The scheduler's 30-second DB poll loop is the scheduling engine. Keep `cron = "0.12"` and no crate change is needed for cron support.

### Heartbeat Requirement for Running Tasks

The spawned `pipeline::execute` task must update `import_schedules.last_heartbeat_at` every 60 seconds while a scheduled run is in progress. This is the only mechanism that prevents the scheduler from reclaiming and re-running a legitimately active job. Without it, the stale-run recovery (heartbeat older than 5 minutes → treat as crashed) will never work correctly, and any run that takes more than 5 minutes risks being double-triggered. The current code never writes `last_heartbeat_at` from inside the pipeline. This is a required fix.

Implementation: spawn a separate `tokio::task` alongside `pipeline::execute` that holds a clone of the DB pool and the schedule row ID, and updates `last_heartbeat_at` on a 60-second interval. Cancel it when the pipeline task completes.

### Watermark Storage Approach

Watermark state should be stored in two places with different purposes:

1. **Live watermark on `import_definitions`:** Store as JSONB in `import_definitions.source_config` (existing column) under a `watermark_state` key. The pipeline reads this before each run and writes the new high-water mark after a successful commit. This is the authoritative live state.

2. **Snapshot on `import_runs`:** The existing `import_runs.watermark_state` column (never currently written) should store a before/after snapshot for audit purposes — what watermark was used for this run, and what new watermark was recorded.

The unified watermark JSONB envelope (common across all connector types) uses `watermark_type`, `last_value`, `watermark_column`, and connector-specific fields (`seen` for file connectors, `last_sync_version` for MSSQL CT, `delta_token` for OData V4). A safety lookback window (default 120 seconds, subtracted from the previous timestamp watermark) handles clock skew; the resulting re-processed rows are absorbed by the `source_row_id` upsert deduplication.

---

## 12. Revised Phased Plan

*This section supersedes Section 9. All findings from docs 01–06 are incorporated.*

---

### Phase A — Fix the Broken Scheduler + DCS Connector Bugs

**What it delivers:**
- Scheduled imports actually run for the first time (`cron` and `interval` types)
- Three high-priority DCS connector bugs fixed (PI eu_range_high, Kepware tag groups, Siemens NTLM)
- Scheduler respects `import_definitions.enabled`
- Heartbeat updates prevent phantom stale-run reclaims
- Basic scheduler observability metrics

**Specific deliverables:**
1. Migration: rename `import_definition_id` → `definition_id`; add `cron_expression`, `interval_seconds`, `running`, `last_heartbeat_at`, `watch_path`, `watch_pattern`, `timezone` columns; fix `triggered_by` CHECK constraint.
2. Fix `poll_import_schedules()`: correct all 7 column mismatches, fix `trigger` → `triggered_by` in INSERT, add `schedule_id` to INSERT, add `JOIN import_definitions ... AND d.enabled = true`, restrict to `schedule_type IN ('cron', 'interval')`.
3. Add heartbeat update task inside `pipeline::execute` (60-second interval).
4. Fix PI Web API: `eu_range_high = Zero + Span`.
5. Fix Kepware: recursive tag group traversal.
6. Fix Siemens SPH: NTLM auth implementation.
7. Add `supplemental_last_polled_at`, `supplemental_last_error`, `supplemental_last_metadata_count`, `supplemental_last_event_count` to `import_connections`.

**What it unblocks:** Everything. No scheduled import can run until the schema migration is applied. The DCS bugs are correctness fixes that are unblocked from everything — they should be first.

**Estimated scope:** M (1–2 weeks)

**New Cargo deps:** None. NTLM auth may require evaluating `ntlm` crate (MIT) — check before committing.

---

### Phase B — Watermark / Incremental for All DB and REST Connectors

**What it delivers:**
- All five DB connectors (PostgreSQL, MySQL, MSSQL, ODBC, MongoDB) support incremental polling via watermark
- MSSQL Change Tracking polling mode (captures deletes without binlog or CDC)
- Generic REST connector supports watermark parameter injection and link-header pagination
- Watermark state written to `import_runs` and `import_definitions.source_config` after each successful run
- `source_row_id` uses configured `id_field` value (deduplication correctness)

**What it unblocks:** Interval-scheduled DB and REST connectors become truly incremental, eliminating full-table re-extraction on every poll cycle. This is the prerequisite for making scheduled DB imports practical at scale.

**Estimated scope:** M (1–2 weeks)

**New Cargo deps:** None. All DB drivers already present in workspace.

---

### Phase C — File-Based Trigger Modes (SFTP Directory Polling, Local Filesystem, FTP)

**What it delivers:**
- SFTP connector extended with directory polling: `read_dir()` → glob filter → mtime deduplication → dispatch per file → archive on success
- `file_arrival` schedule type supported by the scheduler loop (directory-listing comparison)
- Local filesystem connector (`LocalFileConnector`) using 60-second poll loop (same model as SFTP — consistent polling across all watch types)
- FTP connector (`FtpConnector`) using `suppaftp`, same `FilePollingState` deduplication

**What it unblocks:** The stated user need for SFTP directory polling is satisfied. All three local/SFTP/FTP file arrival modes are covered.

**Estimated scope:** M (1–2 weeks)

**New Cargo deps:** `glob = "0.3"` (MIT/Apache-2.0) for filename pattern matching; `suppaftp = { version = "6", features = ["async", "rustls"] }` (MIT/Apache-2.0) for FTP. `notify` crate deferred — consistent polling model adopted instead.

---

### Phase D — Webhook Receiver + S3 Connector

**What it delivers:**
- S3 connector (`S3FileConnector`): `list_objects_v2` with `LastModified` watermark, configurable `endpoint_url` for S3-compatible stores (MinIO, Ceph), shared `FilePollingState` deduplication
- Webhook receiver: `POST /import/webhooks/:token` Axum route, HMAC-SHA256 validation, durable `import_webhook_buffer` PostgreSQL table, background drain task, webhook secret management endpoint
- API Gateway route exception for unauthenticated webhook path
- Debounce window (`buffer_seconds`) to prevent duplicate runs from rapid-fire webhooks

**What it unblocks:** S3-based file drops become a first-class source. External systems (LIMS, CMMS, access control) can push data to I/O without I/O needing to poll.

**Estimated scope:** L (2–3 weeks)

**New Cargo deps:** `aws-sdk-s3 = "1"` (Apache-2.0), `aws-config = "1"` (Apache-2.0) for S3; `hmac = "0.12"`, `sha2 = "0.10"`, `hex = "0.4"`, `constant_time_eq = "0.3"` (all MIT/Apache-2.0 or CC0) for webhook HMAC.

---

### Phase E — SSE Client + WebSocket Client Connectors

**What it delivers:**
- New `StreamingConnector` trait (incompatible with current `EtlConnector::extract()` one-shot model — new trait required)
- `import_stream_sessions` table migration for long-lived session tracking
- SSE connector: long-lived background task per definition, reconnect with exponential backoff + jitter, circuit-break after 10 consecutive failures, session state in `import_stream_sessions`
- WebSocket connector: same task model, Ping/Pong keepalive, subscription handshake, re-auth on reconnect
- Stream session status API endpoints (`GET`, stop, restart)

**What it unblocks:** Near-real-time data ingestion (< 2 seconds latency) without polling. Primary use cases: PI Web API SSE value streams, IoT platform subscriptions, any source that exposes SSE.

**Estimated scope:** L (2–4 weeks)

**New Cargo deps:** `reqwest-eventsource = "0.6"` (MIT/Apache-2.0) for SSE. WebSocket uses `tokio-tungstenite` already in workspace.

---

### Phase F — CDC (PostgreSQL WAL, MySQL Binlog, MSSQL Change Tracking Deep, MongoDB Change Streams)

**What it delivers:**
- PostgreSQL WAL/pgoutput logical replication CDC (new `CdcConnector` trait)
- MySQL/MariaDB binlog CDC
- MSSQL full Change Tracking with before-images (upgrade from Phase B's CT polling)
- MongoDB change streams with resume token persistence
- WAL accumulation alerting for PostgreSQL CDC (replication slot lag threshold)

**Prerequisites and constraints:** Each type requires source-side setup (DBA work): `wal_level=logical` + publication + replication user (PostgreSQL), `binlog_format=ROW` + replication user (MySQL), CT enabled per table (MSSQL), replica set (MongoDB). CDC is appropriate only for confirmed site deployments with these prerequisites met.

**What it unblocks:** Sub-second ingestion latency for mission-critical operational data (LIMS in-process results, badge event streams) without polling load on the source system.

**Estimated scope:** XL (3–5 weeks; design before implementation — `CdcConnector` trait architecture must be settled before any code is written)

**New Cargo deps:** `pgwire-replication = "0.2"` (MIT/Apache-2.0) for PostgreSQL CDC; `mysql_cdc = "0.9"` (MIT) for MySQL binlog. MongoDB change streams use existing `mongodb` 3.x natively.

---

### Phase G — New DCS Connectors + DCS Poll Configurability

**What it delivers:**
- `aspen_ip21_rest` connector (High priority — full metadata including HIHI/HI/LO/LOLO alarm limits; historical data backfill path)
- `yokogawa_centum_rest` connector (Medium priority — PRM tag browse + historian alarm query)
- `foxboro_rest` connector for EcoStruxure Foxboro DCS (Medium priority — FoxConnect REST API, metadata + alarm events)
- DCS poll interval made configurable per connection: read `poll_interval_seconds` and `event_poll_interval_seconds` from `import_connections.config` JSONB with 300s default fallback
- Separate metadata and event poll tracking (`supplemental_last_metadata_poll_at`, `supplemental_last_event_poll_at` columns on `import_connections`)
- `has_events() -> bool` capability flag added to `DcsConnector` trait to skip event fetch for Kepware and Canary (no-op every 5 minutes eliminated)

**What it unblocks:** Coverage of AspenTech sites (common in refineries running Aspen APC), Yokogawa sites, and legacy Foxboro installations. Configurable intervals allow metadata polls to be moved to 1-hour cadence, reducing OT network load from the current every-5-minutes-for-everything.

**Estimated scope:** L (2–3 weeks)

**New Cargo deps:** None anticipated (new connectors use `reqwest` already in workspace; NTLM for Foxboro may require the `ntlm` crate evaluated in Phase A).

---

### Phase H — Frontend Schedule Management UI

**What it delivers:**
- Schedule sub-panel in `frontend/src/pages/settings/Import.tsx`: list active schedules per definition with type badge, next/last run time, enable/disable toggle
- "Add Schedule" drawer with conditional fields per schedule type (interval duration picker, cron expression input with human-readable preview, file arrival transport + path + pattern, webhook URL display + copy button)
- Watermark / incremental import toggle in the Definition editor: watermark column, type, lookback window, current watermark value, "Reset watermark" button
- Source config editor surfacing per-connector-type fields (removes API-only configuration requirement)
- Dry-run checkbox in Run Now flow; "DRY RUN" badge in run history table
- Filter run history by `triggered_by` (manual / schedule / webhook / file_arrival)
- DCS connection health display: last polled, last error, tag count updated (using Phase A columns)
- For streaming connector definitions (Phase E): persistent connection status indicator (Connecting / Active / Reconnecting / Failed) replacing the Run Now button

**What it unblocks:** Operators can configure and monitor all scheduling without API access. DCS connector health is visible in the Settings UI. The scheduler implementation in Phases A–G becomes operator-accessible.

**Estimated scope:** L (2–3 weeks)

**New Cargo deps:** None (frontend only).

---

### Phase Summary Table

| Phase | Delivers | Unblocks | Scope | New Cargo Deps? |
|---|---|---|---|---|
| A | Scheduler works; 3 DCS bugs fixed; DCS health columns | Everything | M | Possibly `ntlm` (for Siemens NTLM) |
| B | Watermark incremental for all DB + REST connectors | Practical interval scheduling | M | None |
| C | SFTP dir polling; file_arrival type; local + FTP connectors | Stated user need met | M | `glob`, `suppaftp` |
| D | Webhook receiver; S3 connector | Push-based sources; S3 file drops | L | `aws-sdk-s3`, `aws-config`, `hmac`, `sha2`, `hex`, `constant_time_eq` |
| E | SSE client; WebSocket client (new trait required) | Near-real-time streaming | L | `reqwest-eventsource` |
| F | CDC — PG WAL, MySQL binlog, MSSQL CT deep, MongoDB streams | Sub-second operational data ingestion | XL | `pgwire-replication`, `mysql_cdc` |
| G | 3 new DCS connectors; configurable DCS poll intervals | AspenTech/Yokogawa/Foxboro coverage | L | None (likely) |
| H | Frontend schedule management UI; DCS health display | Operator self-service configuration | L | None |

---

*Synthesis updated 2026-04-04 to incorporate `05_dcs_connectors.md` (§10) and `06_scheduler_architecture.md` (§11, §12). Sections 10–12 supersede or extend Section 9 where they conflict.*
