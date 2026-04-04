# Import Service — Current Architecture Baseline

**Date:** 2026-04-04
**Purpose:** Shared foundation for all connector-behavior research agents.
**Scope:** Import-service as it exists on `main` today — what is actually implemented, not what the spec envisions.

---

## 1. How a Job Gets Triggered Today

There are two trigger paths:

### 1a. Manual HTTP trigger (primary path)

```
POST /import/definitions/:id/runs
  body: { "dry_run": false }
```

Handler (`handlers/import.rs` → `trigger_run()`):
1. Inserts a row into `import_runs` with `status='pending'`, `triggered_by='manual'`.
2. Returns the `import_runs` row immediately (HTTP 201) — the job is fire-and-forget from the caller's perspective.
3. Spawns `tokio::spawn(pipeline::execute(...))` — the ETL runs in a background task.
4. The caller polls `GET /import/runs/:id` to check status.

The UI "Run Now" button in `DefinitionsTab` and the context menu "Run Now" action both call this endpoint.

### 1b. Scheduler polling (cron/interval triggers)

At service startup `main.rs` spawns two long-running background tasks:

**Task 1 — DCS supplemental connectors** (`run_supplemental_connectors`):
- Polls every **5 minutes** (hard-coded `Duration::from_secs(300)`).
- Queries `import_connections WHERE is_supplemental_connector = true AND enabled = true`.
- For each row, dispatches to `connectors::get_connector(conn_type)` (the DCS/supplemental path).
- Calls `connector.fetch_metadata()` and `connector.fetch_events()` directly — does NOT go through the ETL pipeline or `import_runs`.

**Task 2 — General import scheduler** (`run_import_scheduler`):
- Polls `import_schedules` every **30 seconds** (hard-coded `Duration::from_secs(30)`).
- Uses `poll_import_schedules()` which does a `FOR UPDATE SKIP LOCKED` claim loop.
- For each due schedule, inserts an `import_runs` row with `triggered_by='scheduled'` and spawns `pipeline::execute()`.
- Computes `next_run_at` via the `cron` crate (for `schedule_type='cron'`) or `chrono::Duration::seconds(interval_seconds)` (for `schedule_type='interval'`).

**CRITICAL SCHEMA MISMATCH (known bug):** The scheduler (`poll_import_schedules`) references columns that do not exist in the current `import_schedules` migration DDL:

| Column queried by scheduler | Actual DDL column | Status |
|---|---|---|
| `s.definition_id` | `import_definition_id` | **Wrong name** |
| `s.cron_expression` | (not in DDL) | **Missing** |
| `s.interval_seconds` | (not in DDL) | **Missing** |
| `s.running` | (not in DDL) | **Missing** |
| `s.last_heartbeat_at` | (not in DDL) | **Missing** |

The actual `import_schedules` migration (`20260314000013_import.up.sql`) has: `id`, `import_definition_id`, `schedule_type`, `schedule_config` (JSONB), `enabled`, `next_run_at`, `last_run_at`, `created_at`, `updated_at`. The scheduler code will fail at runtime with a PostgreSQL column-not-found error. **The scheduler is not functional as-written.**

---

## 2. Scheduler / Cron Mechanism

Two schedulers exist in code. Neither is currently functional without the missing columns.

### Supplemental connector poller
- Fixed 5-minute interval.
- No database schedule configuration.
- Skips the ETL pipeline entirely — calls DCS connector methods directly.

### General import scheduler
- Fixed 30-second poll cycle.
- Reads schedule configuration from `import_schedules` table.
- Supports two `schedule_type` values in code: `"cron"` and `"interval"`.
- Uses the `cron` crate to parse cron expressions.
- Uses `FOR UPDATE SKIP LOCKED` to prevent double-execution across hypothetical multi-instance deployments.

The DB schema allows `schedule_type IN ('cron', 'interval', 'manual', 'file_arrival', 'webhook', 'dependency')` but only `cron` and `interval` are implemented in the scheduler loop. The other four types — `manual`, `file_arrival`, `webhook`, `dependency` — are schema-level stubs with no implementation.

---

## 3. Import Job Lifecycle (States and Transitions)

States defined in `import_runs.status` CHECK constraint:

```
pending → running → completed
                 → failed
                 → partial   (some rows loaded, some errored)
         → cancelled         (explicit POST /runs/:id/cancel while pending or running)
```

Transition table:

| Transition | Where it happens |
|---|---|
| `pending` | `INSERT` in `trigger_run()` or scheduler |
| `pending → running` | `pipeline::execute()` at start, `UPDATE ... SET status='running'` |
| `running → completed` | `pipeline::execute()` on success, no row errors |
| `running → partial` | `pipeline::execute()` on success, some row errors |
| `running → failed` | `pipeline::execute()` when `rows_errored > 0 && rows_loaded == 0`, or pipeline exception |
| `pending/running → cancelled` | `cancel_run()` handler, `UPDATE ... WHERE status IN ('pending','running')` |

Note: cancellation sets the DB row to `cancelled` but does NOT actually stop the background `tokio::spawn` task. There is no cooperative cancellation of a running pipeline. A "cancelled" run may still complete normally in the background.

### Persistence model
All state is in PostgreSQL. The service is stateless beyond the connection pool and the two background polling tasks. Restarting the service abandons any in-progress `tokio::spawn` tasks but leaves DB rows in `running` state. The scheduler has a 5-minute stale-heartbeat recovery window (`last_heartbeat_at < NOW() - INTERVAL '5 minutes'`), but since `last_heartbeat_at` doesn't exist yet this recovery is also non-functional.

### NOTIFY emissions (`import_status` channel)
`pipeline::execute()` emits `pg_notify('import_status', ...)` at three points:
- On `running` transition.
- On `completed`/`partial` (not on dry-run).
- On `failed`.

The API Gateway is expected to listen and push status updates to the frontend via the Data Broker WebSocket.

`pg_notify('import_alert', ...)` is emitted when a run fails or completes with errors.

---

## 4. Database Tables

### `import_connections`
Stores external system credentials and connection configuration.

```sql
CREATE TABLE import_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL UNIQUE,
    connection_type VARCHAR(100) NOT NULL,
    config JSONB NOT NULL DEFAULT '{}',        -- base_url, host, port, database, etc.
    auth_type VARCHAR(50) NOT NULL DEFAULT 'none',
    auth_config JSONB NOT NULL DEFAULT '{}',   -- encrypted at application layer
    enabled BOOLEAN NOT NULL DEFAULT true,
    data_category_id UUID REFERENCES data_categories(id),
    -- DCS supplemental fields:
    point_source_id UUID REFERENCES point_sources(id) ON DELETE SET NULL,
    is_supplemental_connector BOOLEAN NOT NULL DEFAULT false,
    last_tested_at TIMESTAMPTZ,
    last_test_status VARCHAR(20),
    last_test_message TEXT,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

The `point_source_id` / `is_supplemental_connector` fields are added by migration `20260315000047`. Auth_config values are encrypted/decrypted at the application layer via `crypto::encrypt_sensitive_fields()` / `decrypt_sensitive_fields()` using `state.config.master_key` (32-byte AES key from env).

Sensitive field names recognized for encryption (in `crypto.rs`): `password`, `api_key`, `bearer_token`, `token`, `secret`, `private_key`, `client_secret`.

### `import_definitions`
Stores the ETL job configuration (what to extract, how to map/transform, where to load).

```sql
CREATE TABLE import_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID NOT NULL REFERENCES import_connections(id) ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL UNIQUE,
    description TEXT,
    source_config JSONB NOT NULL DEFAULT '{}',      -- source_type + connector-specific params
    field_mappings JSONB NOT NULL DEFAULT '[]',     -- [{"source":"col","target":"name"}, ...]
    transforms JSONB NOT NULL DEFAULT '[]',         -- [{op, field}, ...]
    validation_rules JSONB NOT NULL DEFAULT '{}',
    target_table VARCHAR(100) NOT NULL,             -- 'custom_import_data', 'points_metadata', etc.
    error_strategy VARCHAR(20) NOT NULL DEFAULT 'quarantine'
        CHECK (error_strategy IN ('stop', 'skip', 'quarantine', 'threshold')),
    error_threshold_percent NUMERIC(5,2) DEFAULT 10.00,
    batch_size INTEGER NOT NULL DEFAULT 1000,
    template_id UUID REFERENCES connector_templates(id) ON DELETE SET NULL,
    template_version VARCHAR(20),
    point_column VARCHAR(100),              -- for point-linked imports
    point_column_transforms JSONB,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

There is no `schedule_*` or `cron_*` column on `import_definitions`. Scheduling is fully separate via `import_schedules`.

### `import_schedules`
One-to-many from `import_definitions`. Current actual DDL (migration `20260314000013`):

```sql
CREATE TABLE import_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_definition_id UUID NOT NULL REFERENCES import_definitions(id) ON DELETE CASCADE,
    schedule_type VARCHAR(20) NOT NULL
        CHECK (schedule_type IN ('cron', 'interval', 'manual', 'file_arrival', 'webhook', 'dependency')),
    schedule_config JSONB NOT NULL DEFAULT '{}',
    enabled BOOLEAN NOT NULL DEFAULT true,
    next_run_at TIMESTAMPTZ,
    last_run_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

The scheduler code in `main.rs` requires additional columns (`definition_id`, `cron_expression`, `interval_seconds`, `running`, `last_heartbeat_at`) that have NOT been added via any migration. These must be added before the scheduler can work.

### `import_runs`
Execution history.

```sql
CREATE TABLE import_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_definition_id UUID NOT NULL REFERENCES import_definitions(id) ON DELETE CASCADE,
    schedule_id UUID REFERENCES import_schedules(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled', 'partial')),
    triggered_by VARCHAR(20) NOT NULL DEFAULT 'manual'
        CHECK (triggered_by IN ('manual', 'schedule', 'webhook', 'file_arrival', 'dependency', 'retry')),
    dry_run BOOLEAN NOT NULL DEFAULT false,
    rows_extracted INTEGER DEFAULT 0,
    rows_mapped INTEGER DEFAULT 0,
    rows_transformed INTEGER DEFAULT 0,
    rows_validated INTEGER DEFAULT 0,
    rows_loaded INTEGER DEFAULT 0,
    rows_errored INTEGER DEFAULT 0,
    rows_skipped INTEGER DEFAULT 0,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    watermark_state JSONB,          -- watermark-based change detection (not yet used)
    run_metadata JSONB DEFAULT '{}', -- timing breakdown stored here (extract_ms, transform_ms, etc.)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Note: `run_metadata` is used to store per-stage timing because the per-stage duration columns (`extract_duration_ms`, etc.) are not in the schema. The pipeline writes timing as JSONB here as a workaround.

The pipeline handler currently only writes to `rows_extracted`, `rows_transformed`, `rows_loaded`, `rows_skipped`, `rows_errored`. The `rows_mapped` and `rows_validated` columns are in the schema but not populated.

Also note: `triggered_by` schema allows `'webhook'`, `'file_arrival'`, `'dependency'`, `'retry'` but the code only ever sets `'manual'` or `'scheduled'`. (The code uses `'scheduled'` but the schema constraint requires `'schedule'` — another schema/code mismatch to watch for.)

### `import_errors`
Per-row error details from failed imports.

```sql
CREATE TABLE import_errors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_run_id UUID NOT NULL REFERENCES import_runs(id) ON DELETE CASCADE,
    row_number INTEGER,
    field_name VARCHAR(255),
    error_type VARCHAR(50) NOT NULL,   -- 'validation_error', 'mapping_error', 'transform_warning'
    error_message TEXT NOT NULL,
    raw_value TEXT,
    raw_row JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### `custom_import_data`
Generic catch-all target table. All current ETL jobs land here.

```sql
CREATE TABLE custom_import_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_definition_id UUID NOT NULL REFERENCES import_definitions(id) ON DELETE CASCADE,
    data JSONB NOT NULL,
    source_row_id VARCHAR(255),
    imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### `connector_templates`
Seeded at service startup. 40+ named-system templates plus generic connector templates.

```sql
CREATE TABLE connector_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    domain VARCHAR(50) NOT NULL
        CHECK (domain IN (
            'maintenance', 'equipment', 'access_control', 'erp_financial',
            'ticketing', 'environmental', 'lims_lab', 'regulatory',
            'dcs_supplemental', 'generic_api', 'generic_file', 'generic_database'
        )),
    vendor VARCHAR(100) NOT NULL,
    description TEXT,
    template_config JSONB NOT NULL,     -- {{placeholder}} substitution config
    required_fields JSONB NOT NULL,     -- UI field descriptors for wizard
    target_tables TEXT[] NOT NULL,
    version VARCHAR(20) NOT NULL DEFAULT '1.0',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

The `generic_api`, `generic_file`, `generic_database` domain values were added via migration `20260404000001_generic_connector_domains.up.sql`.

---

## 5. `GenericTemplateSpec` and `instantiate_template`

The `seed_connector_templates()` function in `main.rs` uses an internal `TemplateSpec` struct (not public) with these fields:

```rust
struct TemplateSpec {
    slug: &'static str,
    name: &'static str,
    domain: &'static str,
    vendor: &'static str,
    description: &'static str,
    target_tables: &'static [&'static str],
    required_fields: &'static str,  // JSON array of {key, label, type, ...}
}
```

Seeding uses `ON CONFLICT (slug) DO UPDATE SET required_fields = EXCLUDED.required_fields, template_config = EXCLUDED.template_config, description = EXCLUDED.description`.

### `instantiate_template` flow

`POST /import/connector-templates/:slug/instantiate` with body:

```json
{
  "field_values": { "base_url": "https://...", "username": "...", "password": "..." },
  "connection_name": "My Connection"
}
```

1. Fetches `connector_templates` row by slug.
2. Performs `{{key}}` → value substitution recursively across all string values in `template_config`.
3. Extracts `template_config["connection"]` → becomes `import_connections.config`.
4. Extracts `template_config["auth_type"]` and `template_config["auth_config"]` → encrypts and stores.
5. Derives `connection_type` from `template_config["definitions"][0]["source_config"]["source_type"]`, falling back to the slug.
6. Creates one `import_connections` row.
7. Iterates `template_config["definitions"]` array. For each entry creates one `import_definitions` row.
8. If `definitions` is empty/absent, creates one default definition with empty `source_config`.
9. Returns `{ connection: ImportConnectionRow, definitions: [ImportDefinitionRow, ...] }`.

The frontend does not use `instantiate_template` — the `NewConnectionWizard` creates a bare connection via `POST /import/connections` instead, then the user creates definitions manually in the `DefinitionsTab`.

---

## 6. All ETL Connectors Registered in `get_etl_connector()`

File: `services/import-service/src/connectors/etl/mod.rs`

```rust
pub fn get_etl_connector(connection_type: &str) -> Option<Box<dyn EtlConnector>> {
    match connection_type {
        "generic_rest"  => Some(Box::new(rest::GenericRestConnector)),
        "csv_file"      => Some(Box::new(file_csv::CsvFileConnector)),
        "tsv_file"      => Some(Box::new(file_csv::TsvFileConnector)),
        "excel_file"    => Some(Box::new(file_excel::ExcelFileConnector)),
        "json_file"     => Some(Box::new(file_json::JsonFileConnector)),
        "xml_file"      => Some(Box::new(file_xml::XmlFileConnector)),
        "postgresql"    => Some(Box::new(sql_postgres::PostgresConnector)),
        "mysql"         => Some(Box::new(sql_mysql::MySqlConnector)),
        "mssql"         => Some(Box::new(sql_mssql::MssqlConnector)),
        "odbc"          => Some(Box::new(odbc::OdbcConnector)),
        "sftp"          => Some(Box::new(sftp::SftpConnector)),
        "mongodb"       => Some(Box::new(mongodb::MongoConnector)),
        _               => None,
    }
}
```

All 12 ETL connector types are registered (Phases 1–4 of the generic connectors plan are complete at the trait level). The `EtlConnector` trait requires:

```rust
#[async_trait]
pub trait EtlConnector: Send + Sync {
    fn connector_type(&self) -> &'static str;
    async fn test_connection(&self, cfg: &EtlConnectorConfig) -> Result<()>;
    async fn discover_schema(&self, cfg: &EtlConnectorConfig) -> Result<Vec<SchemaTable>>;
    async fn extract(&self, cfg: &EtlConnectorConfig) -> Result<Vec<SourceRecord>>;
}
```

All implementations operate as one-shot bulk extracts (call `extract()` → get `Vec<SourceRecord>`). There is no streaming/batched extraction in the trait — the entire result set is materialized in memory before the pipeline proceeds.

### `EtlConnectorConfig` fields

```rust
pub struct EtlConnectorConfig {
    pub connection_id: Uuid,
    pub connection_config: JsonValue,  // import_connections.config (base_url, host, etc.)
    pub auth_type: String,             // import_connections.auth_type
    pub auth_config: JsonValue,        // DECRYPTED import_connections.auth_config
    pub source_config: JsonValue,      // import_definitions.source_config (query, endpoint, etc.)
    pub upload_dir: String,            // from Config, for file-backed connectors
}
```

---

## 7. DCS Connectors (Non-ETL, `connectors/mod.rs`)

These implement the `DcsConnector` trait, not `EtlConnector`. They are used exclusively by the supplemental connector poller.

```rust
pub trait DcsConnector: Send + Sync {
    fn connector_type(&self) -> &'static str;
    async fn test_connection(&self, cfg: &ConnectorConfig) -> Result<()>;
    async fn fetch_metadata(&self, cfg: &ConnectorConfig) -> Result<Vec<SupplementalMetadata>>;
    async fn fetch_events(&self, cfg: &ConnectorConfig, since: DateTime<Utc>) -> Result<Vec<SupplementalEvent>>;
}
```

Registered via `get_connector()`:

| `connection_type` | Struct | Vendor |
|---|---|---|
| `pi_web_api` | `PiWebApiConnector` | AVEVA/OSIsoft PI |
| `experion_rest` | `ExperionConnector` | Honeywell Experion PKS |
| `siemens_sph_rest` | `SiemensSphConnector` | Siemens SIMATIC Process Historian |
| `wincc_oa_rest` | `WinccOaConnector` | Siemens WinCC OA |
| `s800xa_rest` | `AbbImConnector` | ABB 800xA |
| `kepware_rest` | `KepwareConnector` | PTC Kepware KEPServerEX |
| `canary_rest` | `CanaryConnector` | Canary Labs Historian |

These connectors bypass the ETL pipeline entirely. They write directly to `points_metadata` (via `write_supplemental_metadata`) and `events` (via `write_supplemental_events`) in `connectors/db_writes.rs`. They do not create `import_runs` records and are therefore not tracked in run history.

`ConnectorConfig` (used by DCS connectors, distinct from `EtlConnectorConfig`):

```rust
pub struct ConnectorConfig {
    pub connection_id: Uuid,
    pub base_url: Option<String>,
    pub auth_type: String,
    pub username: Option<String>,
    pub password: Option<String>,
    pub api_key: Option<String>,
    pub bearer_token: Option<String>,
    pub extra: serde_json::Value,   // full import_connections.config
}
```

---

## 8. Pipeline Step-by-Step (`pipeline.rs`)

`pipeline::execute(db, run_id, def_id, dry_run, master_key, upload_dir)`:

### Step 1: Mark running
```sql
UPDATE import_runs SET status = 'running', started_at = COALESCE(started_at, NOW())
WHERE id = $run_id
```
Emits `pg_notify('import_status', '{"run_id":..., "status":"running", ...}')`.

### Step 2: Fetch definition
```sql
SELECT connection_id, source_config, field_mappings, transforms, target_table
FROM import_definitions WHERE id = $def_id
```

### Step 3: Begin transaction (always, even for dry-run)
```rust
let mut tx = db.begin().await?;
```

### Step 4: EXTRACT (`extract_records`)
Dispatches on `source_config.source_type`:
- `"csv"` or `"csv_inline"` → inline CSV parser (splits on delimiter, reads inline `source_config.data`).
- `"json_array"` → inline JSON array from `source_config.data`.
- Anything else → ETL connector dispatch via `connection_id`:
  1. Fetches `import_connections` row for `connection_type`, `config`, `auth_type`, `auth_config`.
  2. Decrypts `auth_config`.
  3. Calls `get_etl_connector(connection_type)`.
  4. Calls `connector.extract(&etl_cfg).await`.

Returns `Vec<SourceRecord>` — all rows in memory.

### Step 5: MAP (`apply_field_mappings`)
For each `SourceRecord`:
- If `field_mappings` is an array: `[{"source": "src_col", "target": "dst_col"}, ...]` — only mapped fields pass through.
- If `field_mappings` is an object: `{"src_col": "dst_col"}` — same.
- If empty/null: all fields pass through unchanged.
Produces `Vec<MappedRecord>`.

### Step 6: TRANSFORM (`apply_transforms`)
For each `MappedRecord`, iterates `transforms` array:
- `{"op": "set_null_if_empty", "field": "x"}` — null-ifies empty strings.
- `{"op": "trim", "field": "x"}` — trims whitespace.
- `{"op": "to_lowercase", "field": "x"}`
- `{"op": "to_uppercase", "field": "x"}`
- Unknown ops generate `ErrorRecord` with `error_type="transform_warning"` but do not fail the row.

### Step 7: VALIDATE (`validate_record`)
For each `MappedRecord`:
- Checks that all fields listed in `source_config.required_fields` are non-null.
- Failure produces a fatal `ErrorRecord` (`error_type="validation_error"`), row is dropped.

### Step 8: LOAD (`load_records`)
All valid `MappedRecord`s are inserted into `custom_import_data`:
```sql
INSERT INTO custom_import_data (import_definition_id, data, source_row_id, imported_at)
VALUES ($def_id, $data_json, $row_number::text, NOW())
```

Note: `target_table` is fetched from `import_definitions` but is currently IGNORED. All output goes to `custom_import_data` regardless. This is called out in a code comment as "phase 7 behavior."

### Step 9: Write error records
All `ErrorRecord`s are inserted into `import_errors` within the transaction.

### Step 10: Commit or rollback
- `dry_run=true` → `tx.rollback()`. Stats are computed but nothing persists.
- `dry_run=false` → `tx.commit()`.
- Pipeline exception → `tx.rollback()`, mark run `failed`.

### Step 11: Update `import_runs`
```sql
UPDATE import_runs SET
  status = $final_status,
  completed_at = NOW(),
  rows_extracted = $n, rows_transformed = $n, rows_loaded = $n,
  rows_skipped = $n, rows_errored = $n,
  run_metadata = $timing_json
WHERE id = $run_id
```

`run_metadata` stores: `extract_duration_ms`, `transform_duration_ms`, `validate_duration_ms`, `load_duration_ms`, `total_duration_ms`, `dry_run`.

### Step 12: Emit metrics and NOTIFY
- `metrics::counter!("io_import_runs_total").increment(1)`
- `metrics::counter!("io_import_rows_processed_total").increment(n)`
- `metrics::counter!("io_import_errors_total").increment(n)`
- `pg_notify('import_status', '{"status":"completed"/"partial", ...}')`
- `pg_notify('import_alert', ...)` if errors > 0.

---

## 9. Scheduling-Related Fields in `import_definitions`

There are **no** schedule-related fields on `import_definitions`. The design fully separates definition from schedule:

- `import_definitions` — what to extract, how to transform, where to load.
- `import_schedules` — when to run it (one-to-many from definition).

The only definition fields that affect scheduling behavior indirectly:
- `enabled` — the scheduler does not check this field; it only checks `import_schedules.enabled`. A disabled definition will still be triggered by an active schedule.
- `batch_size` — fetched but not currently used in the pipeline (the loader processes all valid records in a single loop).

---

## 10. Frontend UI (`frontend/src/pages/settings/Import.tsx`)

The Import settings page has three tabs: **Connections**, **Definitions**, **Run History**.

### Connections tab
- Lists all `import_connections`.
- "New Connection" button opens `NewConnectionWizard` — a 3-step modal:
  1. Select connector template from grid (populated from `GET /import/connector-templates`).
  2. Configure — raw JSON fields for `config` and `auth_config`, plus `auth_type` select.
  3. Test & Save — calls `POST /import/connections/:id/test`.
- Right-click context menu: Test, Enable/Disable, Delete (grayed if definitions exist).
- No schedule configuration exposed here.

### Definitions tab (not separately named — part of DefinitionsTab component)
- Lists `import_definitions` with connection name, status badge, enable/disable.
- Right-click context menu: **Run Now**, View Run History, Enable/Disable.
- "Run Now" calls `POST /import/definitions/:id/runs` with `{ dry_run: false }`.
- No dry-run UI exposed to end users.
- No schedule creation UI exposed in this tab.

### Run History tab (`RunHistoryTab`)
- Shows a quick-run panel: buttons for each definition labeled "Run: {name}".
- Shows a runs table: definition name, status badge, row counts, start time, duration.
- Clicking a row opens a `Drawer` showing per-row errors from `GET /import/runs/:id/errors`.
- Cancel button for pending/running runs.
- Auto-refreshes every 15 seconds while active runs exist.

### What the UI does NOT expose
- Schedule creation or management (no schedule CRUD UI exists).
- Dry-run toggle.
- Field mapping editor.
- Transform configuration.
- Schema discovery (`POST /connections/:id/discover`).
- Watermark / incremental import configuration.
- `instantiate_template` endpoint (wizard creates connections directly, not via template instantiation).

---

## 11. HTTP Route Table

All routes are prefixed with `/import` (the API Gateway proxies `/api/import/*` to port 3006).

| Method | Path | Handler |
|---|---|---|
| `GET` | `/import/connector-templates` | `list_connector_templates` |
| `GET` | `/import/connector-templates/:slug` | `get_connector_template` |
| `POST` | `/import/connector-templates/:slug/instantiate` | `instantiate_template` |
| `POST` | `/import/upload` | `upload_file` |
| `GET` | `/import/connections` | `list_connections` |
| `POST` | `/import/connections` | `create_connection` |
| `GET` | `/import/connections/:id` | `get_connection` |
| `PUT` | `/import/connections/:id` | `update_connection` |
| `DELETE` | `/import/connections/:id` | `delete_connection` |
| `POST` | `/import/connections/:id/test` | `test_connection` |
| `POST` | `/import/connections/:id/discover` | `discover_schema` |
| `GET` | `/import/definitions` | `list_definitions` |
| `POST` | `/import/definitions` | `create_definition` |
| `GET` | `/import/definitions/:id` | `get_definition` |
| `PUT` | `/import/definitions/:id` | `update_definition` |
| `DELETE` | `/import/definitions/:id` | `delete_definition` |
| `POST` | `/import/definitions/:id/clone` | `clone_definition` |
| `GET` | `/import/definitions/:id/schedules` | `list_schedules` |
| `POST` | `/import/definitions/:id/schedules` | `create_schedule` |
| `PUT` | `/import/schedules/:id` | `update_schedule` |
| `DELETE` | `/import/schedules/:id` | `delete_schedule` |
| `GET` | `/import/definitions/:id/runs` | `list_runs` |
| `POST` | `/import/definitions/:id/runs` | `trigger_run` |
| `GET` | `/import/runs/:id` | `get_run` |
| `GET` | `/import/runs/:id/errors` | `get_run_errors` |
| `POST` | `/import/runs/:id/cancel` | `cancel_run` |

---

## 12. Key Gaps and Non-Implemented Features

The following features are in the design spec (`design-docs/24_UNIVERSAL_IMPORT.md`) or schema but have no working implementation:

| Feature | Schema | Code | Notes |
|---|---|---|---|
| Scheduled imports (cron) | `import_schedules` | Scheduler code exists but broken | Missing columns in DDL |
| Scheduled imports (interval) | `import_schedules` | Scheduler code exists but broken | Same issue |
| File-arrival trigger | `schedule_type='file_arrival'` | None | Schema-only stub |
| Webhook trigger | `schedule_type='webhook'` | None | Schema-only stub |
| Dependency trigger | `schedule_type='dependency'` | None | Schema-only stub |
| Heartbeat / stale-run recovery | Not in DDL | References missing column | Non-functional |
| Watermark-based incremental | `watermark_state JSONB` | Schema only | Field exists, never written |
| `target_table` routing | `import_definitions.target_table` | Ignored; always → `custom_import_data` | Code comment marks this |
| DCS connector run tracking | N/A | Never creates `import_runs` rows | Supplemental poll is invisible |
| Schedule management UI | N/A | Not built | No frontend component |
| Dry-run UI | N/A | API supports it | Not exposed in UI |
| Schema discovery UI | N/A | API supports it | Not exposed in UI |
| Field mapping UI | N/A | API stores it | Not exposed in UI |
| Streaming/chunked extraction | N/A | All connectors return full Vec | Entire result set in RAM |
| Real-time / event-driven modes | N/A | None | Only one-shot batch supported |
| Error threshold strategy | `error_strategy='threshold'` | Schema only | Pipeline ignores `error_strategy` |

---

## 13. AppState

```rust
pub struct AppState {
    pub db: PgPool,
    pub config: Arc<Config>,
}
```

`Config` fields relevant to scheduling/connectors:
- `master_key: [u8; 32]` — AES key for auth_config encryption.
- `upload_dir: String` — directory for uploaded files (file connectors).
- `port: u16` — service port (3006).
- `service_secret: String` — `x-io-service-secret` header validation.
- `database_url: String` — PostgreSQL connection string.

There is no per-scheduler state, no in-memory job queue, no worker pool. Each triggered run is a bare `tokio::spawn`.

---

## 14. Summary: What "Currently Works"

As of 2026-04-04 on `main`:

**Fully working:**
- Manual one-shot ETL trigger via HTTP.
- Full pipeline: Extract → Map → Transform → Validate → Load (to `custom_import_data`).
- All 12 ETL connectors registered and implemented (generic_rest, csv/tsv/excel/json/xml file, postgresql, mysql, mssql, odbc, sftp, mongodb).
- All 7 DCS supplemental connectors (pi_web_api, experion_rest, siemens_sph_rest, wincc_oa_rest, s800xa_rest, kepware_rest, canary_rest).
- Supplemental connector polling (5-minute interval, no DB schedule).
- Run tracking (import_runs, import_errors).
- NOTIFY emissions.
- Connection CRUD, test, discover.
- Definition CRUD, clone.
- Schedule CRUD (API persists rows, nothing executes them due to schema mismatch).
- File upload endpoint.
- Template seeding (40+ named-system templates + generic connector templates).

**Broken / non-functional:**
- General import scheduler (`poll_import_schedules`) — references missing DB columns.
- Run heartbeat / stale recovery — same.
- Scheduled trigger types beyond `cron` and `interval`.

**Not implemented at all:**
- File-watching / file-arrival triggers.
- Webhook / push-based triggers.
- Event-driven / streaming connector modes.
- Real-time data ingestion.
- Watermark-based incremental extraction (field exists, never populated).
- Schedule management UI.
