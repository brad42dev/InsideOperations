# SimBLAH Integration Plan via Universal Import Generic Connectors

**Hard constraint:** Zero SimBLAH-specific connector code. All changes are to Universal Import's core pipeline and streaming infrastructure.

---

## Architecture Overview

```
SimBLAH Services                    Universal Import
+------------------+               +---------------------------+
| Maint :8444      |--REST(GET)--->| generic_rest connector    |---> pipeline ---> typed tables
|   /api/tickets   |               |   (ETL: bulk poll)        |     (tickets, work_orders)
|   /api/workorders|               +---------------------------+
|   /api/events/   |--SSE-------->| sse connector             |---> on_event -> pipeline -> typed tables
|     stream       |               |   (streaming: live)       |
+------------------+               +---------------------------+
| Acct :8445       |--REST(GET)--->| generic_rest connector    |---> pipeline ---> typed tables
|   /api/purchase- |               +---------------------------+     (purchase_orders, inventory_items,
|     orders       |--SSE-------->| sse connector             |      vendor_master)
|   /api/inventory |               +---------------------------+
|   /api/vendors   |
+------------------+
| Access :8446     |--REST(GET)--->| generic_rest connector    |---> pipeline ---> typed tables
|   /api/employees |               +---------------------------+     (badge_events via
|   /api/events    |--SSE-------->| sse connector             |      access_control_sources)
|   /api/events/   |               +---------------------------+
|     stream       |
+------------------+
```

**Import definitions per service:**
- Maint REST: 3 definitions (tickets, workorders, points) + 2 SSE definitions (ticket events, work_order events)
- Acct REST: 3 definitions (POs, inventory, vendors) + 2 SSE definitions (PO events, stock_movement events)
- Access REST: 2 definitions (employees, badge event history) + 1 SSE definition (live badge events)

**Event routing strategy:** One SSE `import_definition` per `event_kind`, each connecting to the SAME SSE URL. Each definition's `source_config` includes an `event_kind_filter` field. The `on_event` callback checks `event_kind` in the incoming event data and silently drops events that don't match. This means 2 SSE connections per service (Maint: ticket + work_order; Acct: purchase_order + stock_movement; Access: 1 badge event stream). This is simpler than routing within a single session because each definition has its own field_mappings and target_table.

---

## Phase 1: Typed Table Loading in the ETL Pipeline

### What it accomplishes
Implements the `load_records()` function's ability to INSERT/UPSERT into typed target tables (`tickets`, `work_orders`, `inventory_items`, `purchase_orders`, `vendor_master`, `badge_events`) instead of only `custom_import_data`. This is the core pipeline gap that blocks all integration.

### Difficulty: Medium
The pattern is repetitive. Each table needs its own INSERT with the right columns, types, and UPSERT conflict target. The tricky parts are: (a) type coercion from JSON strings to the right SQL types, (b) the CHECK constraints on status/priority/ticket_type columns that will reject unmapped values, (c) `badge_events` requires a `source_id` FK that doesn't come from the import data directly.

### Implementation Prompt

```
You are implementing Phase 1 of the SimBLAH integration plan for the Inside/Operations (I/O) project. Your task is to implement typed table loading in the Universal Import ETL pipeline.

## Context

The import service at `/home/io/io-dev/io/services/import-service/` has an ETL pipeline in `src/pipeline.rs`. The `load_records()` function (line ~409) currently ONLY writes to `custom_import_data`. The `target_table` field from `import_definitions` is read from the DB (line ~844, stored as `target_table`) but passed to `run_pipeline_in_tx` as `_target_table` (line ~518, prefixed with underscore = unused).

You need to:
1. Make `load_records()` dispatch to table-specific INSERT/UPSERT logic based on `target_table`
2. Implement typed loaders for: `tickets`, `work_orders`, `inventory_items`, `purchase_orders`, `vendor_master`, `badge_events`
3. Keep `custom_import_data` as the fallback for unknown target tables

## File changes required

### `/home/io/io-dev/io/services/import-service/src/pipeline.rs`

**Change 1:** In `run_pipeline_in_tx` signature (line ~518), rename `_target_table` to `target_table`.

**Change 2:** In the LOAD section (line ~681), pass `target_table` to `load_records`:
```rust
let loaded = load_records(tx, def_id, &valid_records, source_config, target_table).await?;
```

**Change 3:** Update the `load_records` function signature to accept `target_table: &str` and dispatch:

```rust
async fn load_records(
    executor: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    def_id: Uuid,
    records: &[MappedRecord],
    source_config: &JsonValue,
    target_table: &str,
) -> Result<i64> {
    match target_table {
        "tickets" => load_tickets(executor, def_id, records, source_config).await,
        "work_orders" => load_work_orders(executor, def_id, records, source_config).await,
        "inventory_items" => load_inventory_items(executor, def_id, records, source_config).await,
        "purchase_orders" => load_purchase_orders(executor, def_id, records, source_config).await,
        "vendor_master" => load_vendor_master(executor, def_id, records, source_config).await,
        "badge_events" => load_badge_events(executor, records, source_config).await,
        "custom_import_data" | "" => load_custom(executor, def_id, records, source_config).await,
        other => {
            warn!(target_table = other, "unknown target_table; falling back to custom_import_data");
            load_custom(executor, def_id, records, source_config).await
        }
    }
}
```

Move the existing `load_records` body into `load_custom`.

**Change 4:** Implement each typed loader. Here are the patterns:

### Helper: extract string/number/bool from MappedRecord fields

```rust
fn field_str(record: &MappedRecord, key: &str) -> Option<String> {
    record.fields.get(key).and_then(|v| match v {
        JsonValue::String(s) if !s.is_empty() => Some(s.clone()),
        JsonValue::Number(n) => Some(n.to_string()),
        _ => None,
    })
}

fn field_f64(record: &MappedRecord, key: &str) -> Option<f64> {
    record.fields.get(key).and_then(|v| match v {
        JsonValue::Number(n) => n.as_f64(),
        JsonValue::String(s) => s.parse::<f64>().ok(),
        _ => None,
    })
}

fn field_timestamp(record: &MappedRecord, key: &str) -> Option<chrono::DateTime<chrono::Utc>> {
    record.fields.get(key).and_then(|v| match v {
        JsonValue::String(s) => chrono::DateTime::parse_from_rfc3339(s).ok().map(|dt| dt.with_timezone(&chrono::Utc)),
        _ => None,
    })
}

fn field_json_extra(record: &MappedRecord, known_keys: &[&str]) -> JsonValue {
    let mut extra = serde_json::Map::new();
    for (k, v) in &record.fields {
        if !known_keys.contains(&k.as_str()) {
            extra.insert(k.clone(), v.clone());
        }
    }
    JsonValue::Object(extra)
}
```

### load_tickets

Key columns: external_id, source_system, ticket_number, ticket_type, title, description, status, priority, assigned_to, resolved_at, closed_at, extra_data
- UPSERT on `(source_system, external_id)` constraint `uq_tickets_external`
- `source_system` comes from `source_config.source_system` (set in the import_definition, e.g. "simblah_maint")
- `id_field` in source_config identifies which field is the external_id (e.g. "id")
- If `ticket_type` is not in the CHECK set ('incident','change_request','problem','service_request'), default to 'incident'
- If `status` is not in CHECK set, map: `open` -> `open`, `in_progress` -> `in_progress`, `on_hold` -> `on_hold`, `closed` -> `closed`. Unknown -> 'open'
- Collect unmapped fields into `extra_data` JSONB

SQL pattern:
```sql
INSERT INTO tickets (external_id, source_system, ticket_number, ticket_type, title, description, status, priority, assigned_to, resolved_at, closed_at, extra_data)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
ON CONFLICT ON CONSTRAINT uq_tickets_external
DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description,
    status = EXCLUDED.status, priority = EXCLUDED.priority,
    assigned_to = EXCLUDED.assigned_to, resolved_at = EXCLUDED.resolved_at,
    closed_at = EXCLUDED.closed_at, extra_data = EXCLUDED.extra_data,
    updated_at = NOW()
```

### load_work_orders

Key columns: external_id, source_system, wo_number, title, description, status, priority, assigned_to, scheduled_start, scheduled_end, actual_start, actual_end, labor_hours, parts_cost, extra_data
- UPSERT on `uq_work_orders_external`
- Status CHECK: ('open','in_progress','on_hold','completed','closed','cancelled')
- Priority CHECK: ('critical','high','medium','low')

### load_inventory_items

Key columns: external_id, source_system, part_number, description, quantity_on_hand, quantity_available, unit_cost, warehouse_name, extra_data
- UPSERT on `uq_inventory_external`

### load_purchase_orders

Key columns: external_id, source_system, po_number, status, vendor_name, order_date, total_amount, extra_data
- UPSERT on `uq_purchase_orders_external`
- Status CHECK: ('draft','approved','ordered','partially_received','received','closed','cancelled')
- SimBLAH status mapping handled by field_mappings transforms, not here

### load_vendor_master

Key columns: external_id, source_system, vendor_code, name, contact_name, contact_email, contact_phone, extra_data
- UPSERT on `uq_vendor_external`
- `vendor_code` is required NOT NULL; use external_id as fallback

### load_badge_events

Different pattern: no UPSERT (badge events are append-only), needs `source_id` FK.
- `source_id` comes from `source_config.source_id` (UUID of the access_control_sources row)
- If source_id is missing, log warning and skip
- No external_id/source_system columns on badge_events
- Columns: source_id, event_type, employee_id, door_id, door_name, area, event_time, raw_data
- raw_data = the full original record as JSONB

## Database schema reference

Read these migration files to verify column names and types:
- `/home/io/io-dev/io/migrations/20260314000017_integration_ticketing.up.sql` (tickets)
- `/home/io/io-dev/io/migrations/20260314000015_integration_maintenance.up.sql` (work_orders)
- `/home/io/io-dev/io/migrations/20260314000016_integration_erp.up.sql` (inventory_items, purchase_orders)
- `/home/io/io-dev/io/migrations/20260314000014_integration_equipment.up.sql` (vendor_master)
- `/home/io/io-dev/io/migrations/20260315000038_shifts.up.sql` (badge_events, access_control_sources)
- `/home/io/io-dev/io/migrations/20260314000013_import.up.sql` (custom_import_data)

## Acceptance criteria

1. `cargo build -p io-import-service` compiles cleanly
2. `cargo clippy -p io-import-service -- -D warnings` passes
3. The `load_records` function dispatches to the correct typed loader based on `target_table`
4. Each typed loader uses UPSERT with the correct constraint name
5. `custom_import_data` remains the fallback for unknown/empty target_table values
6. Unknown enum values for status/priority/ticket_type fields are mapped to safe defaults rather than crashing
7. The `source_system` value comes from `source_config` (key: "source_system"), not hardcoded
8. Extra/unmapped fields are collected into `extra_data` JSONB
9. `badge_events` loader reads `source_id` from `source_config` and fails gracefully if missing
10. No SimBLAH-specific code anywhere -- these are generic typed loaders
```

---

## Phase 2: SSE Streaming -> Pipeline Wiring

### What it accomplishes
Wires the SSE `on_event` callback (currently a no-op stub in `supervisor.rs` line ~282) to actually process incoming events through the import pipeline's field_mappings and load them into typed target tables. Also adds `event_kind_filter` support so one SSE URL can have multiple definitions each filtering for their event type.

### Difficulty: Medium-High
The main challenge is that the `on_event` callback runs inside a `move` closure that only has `session_id`. It needs access to: (a) the DB pool, (b) the import_definition's field_mappings, target_table, and source_config, (c) the typed loaders from Phase 1. The callback also needs to handle SimBLAH's array-of-events format where one SSE message contains an array of mixed-type events.

### Implementation Prompt

```
You are implementing Phase 2 of the SimBLAH integration plan for the Inside/Operations (I/O) project. Your task is to wire the SSE streaming connector's on_event callback to process events through the import pipeline and load them into typed target tables.

## Context

The streaming supervisor at `/home/io/io-dev/io/services/import-service/src/connectors/streaming/supervisor.rs` spawns SSE sessions. The `on_event` callback (line ~282) is currently a no-op stub:

```rust
let on_event: Box<dyn Fn(StreamEvent) -> BoxFuture<'static, anyhow::Result<()>> + Send + Sync> =
    Box::new(move |event: StreamEvent| {
        tracing::debug!(
            session_id = %session_id,
            event_type = ?event.event_type,
            "stream event received"
        );
        Box::pin(async { Ok(()) })
    });
```

You need to make this callback:
1. Parse the event data (which may be an array of events or a single event object)
2. Filter events by `event_kind` if `source_config.event_kind_filter` is set
3. Apply field_mappings from the import_definition
4. Load each mapped record into the target_table using the typed loaders from Phase 1

## File changes required

### `/home/io/io-dev/io/services/import-service/src/connectors/streaming/supervisor.rs`

The `spawn_session_for_definition` function (line ~195) needs to:

**Step 1:** Fetch additional fields from the import_definition that the on_event callback needs:

After the existing query at line 201 that fetches `source_config, connection_type, connection_config, auth_type, auth_config`, add a second query to get the definition's pipeline config:

```rust
let def_row = sqlx::query(
    "SELECT field_mappings, target_table, source_config \
     FROM import_definitions WHERE id = $1"
)
.bind(def_id)
.fetch_one(db)
.await?;

let field_mappings: serde_json::Value = def_row.try_get("field_mappings")?;
let target_table: String = def_row.try_get::<String, _>("target_table")
    .unwrap_or_else(|_| "custom_import_data".to_string());
let def_source_config: serde_json::Value = def_row.try_get("source_config")?;
let event_kind_filter: Option<String> = def_source_config
    .get("event_kind_filter")
    .and_then(|v| v.as_str())
    .map(|s| s.to_string());
```

Note: `source_config` is already fetched from the first query at line 214, but that's the one used for the connector. The definition's source_config may have additional fields like `event_kind_filter`. Actually, they're the same -- `source_config` comes from `import_definitions.source_config`. So just extract event_kind_filter from the existing `source_config`:

```rust
let event_kind_filter: Option<String> = source_config
    .get("event_kind_filter")
    .and_then(|v| v.as_str())
    .map(|s| s.to_string());
```

And add the field_mappings/target_table query:
```rust
let pipeline_row = sqlx::query(
    "SELECT field_mappings, target_table FROM import_definitions WHERE id = $1"
)
.bind(def_id)
.fetch_one(db)
.await?;

let field_mappings: serde_json::Value = pipeline_row.try_get("field_mappings")?;
let target_table: String = pipeline_row.try_get::<String, _>("target_table")
    .unwrap_or_else(|_| "custom_import_data".to_string());
```

**Step 2:** Replace the no-op on_event with a real callback:

```rust
let db_event = db.clone();
let on_event: Box<dyn Fn(StreamEvent) -> BoxFuture<'static, anyhow::Result<()>> + Send + Sync> = {
    let field_mappings = field_mappings.clone();
    let target_table = target_table.clone();
    let event_kind_filter = event_kind_filter.clone();
    let def_source_config = source_config.clone();

    Box::new(move |event: StreamEvent| {
        let db = db_event.clone();
        let field_mappings = field_mappings.clone();
        let target_table = target_table.clone();
        let event_kind_filter = event_kind_filter.clone();
        let def_source_config = def_source_config.clone();
        let session_id = session_id;
        let def_id = def_id;

        Box::pin(async move {
            crate::pipeline::process_stream_event(
                &db,
                session_id,
                def_id,
                &event,
                &field_mappings,
                &target_table,
                &def_source_config,
                event_kind_filter.as_deref(),
            ).await
        })
    })
};
```

### `/home/io/io-dev/io/services/import-service/src/pipeline.rs`

Add a new public function `process_stream_event` that handles streaming event processing:

```rust
/// Process a single streaming event through the field mapping and load stages.
///
/// Called by the SSE/WebSocket on_event callback. Unlike the full ETL pipeline,
/// this skips Extract (data comes from the event) and operates record-by-record
/// rather than in batches.
///
/// The event data may be:
/// - A single JSON object -> processed as one record
/// - A JSON array of objects -> each element processed individually
///
/// When `event_kind_filter` is set, only events whose `event_kind` field matches
/// the filter are processed. Others are silently dropped.
pub async fn process_stream_event(
    db: &PgPool,
    session_id: Uuid,
    def_id: Uuid,
    event: &crate::connectors::streaming::StreamEvent,
    field_mappings: &JsonValue,
    target_table: &str,
    source_config: &JsonValue,
    event_kind_filter: Option<&str>,
) -> Result<()> {
    // Parse event data into individual records
    let items: Vec<&JsonValue> = match &event.data {
        JsonValue::Array(arr) => arr.iter().collect(),
        obj @ JsonValue::Object(_) => vec![obj],
        _ => {
            tracing::debug!(session_id = %session_id, "stream event data is not object or array; skipping");
            return Ok(());
        }
    };

    let mut loaded = 0i64;
    for item in items {
        // Event kind filtering
        if let Some(filter) = event_kind_filter {
            let kind = item.get("event_kind")
                .and_then(|v| v.as_str())
                .unwrap_or("");
            if kind != filter {
                continue; // silently drop events that don't match
            }
        }

        // Convert to SourceRecord
        let fields = match item.as_object() {
            Some(map) => map.iter().map(|(k, v)| (k.clone(), v.clone())).collect(),
            None => continue,
        };
        let source_record = SourceRecord {
            row_number: 1,
            raw: item.to_string(),
            fields,
        };

        // Apply field mappings
        let mapped = apply_field_mappings(&source_record, field_mappings)?;

        // Load to target table (single-record transaction)
        let mut tx = db.begin().await?;
        let result = load_records(&mut tx, def_id, &[mapped], source_config, target_table).await;
        match result {
            Ok(n) => {
                tx.commit().await?;
                loaded += n;
            }
            Err(e) => {
                let _ = tx.rollback().await;
                tracing::warn!(
                    session_id = %session_id,
                    error = %e,
                    "stream event load failed"
                );
            }
        }
    }

    // Update session stats with loaded count
    if loaded > 0 {
        let _ = sqlx::query(
            "UPDATE import_stream_sessions \
             SET events_received = events_received + $2, updated_at = NOW() \
             WHERE id = $1"
        )
        .bind(session_id)
        .bind(loaded)
        .execute(db)
        .await;
    }

    Ok(())
}
```

Note: `apply_field_mappings` and `load_records` are currently private functions. You need to keep them module-private but callable from `process_stream_event` since it's in the same module. The `load_records` signature was updated in Phase 1 to accept `target_table: &str`.

## Important details

1. The SSE connector (`src/connectors/streaming/sse.rs`) already calls `on_event(stream_event).await` at line 118. The event data is already parsed from JSON. The `events_received` counter is already incremented by the SSE connector itself (line 100-111), so don't double-count in `process_stream_event`. Actually -- the SSE connector increments by 1 per SSE message. But one message may contain an array of events. The `process_stream_event` function processes individual items from the array. The session stats should track SSE messages received (already done by SSE connector) separately from records loaded. Remove the loaded-count update from `process_stream_event` -- the SSE connector already handles message counting.

2. SimBLAH SSE format: Each SSE message's `data` field is a JSON object like:
   ```json
   {"event_kind": "ticket", "id": "abc123", "subject": "...", ...}
   ```
   OR an array of such objects. The `event_kind` discriminator determines which definition should process it.

3. The `event_kind_filter` is stored in the import_definition's `source_config` JSON, e.g.:
   ```json
   {"endpoint": "/api/events/stream", "event_kind_filter": "ticket"}
   ```

## Acceptance criteria

1. `cargo build -p io-import-service` compiles cleanly
2. `cargo clippy -p io-import-service -- -D warnings` passes
3. SSE events are parsed, filtered by event_kind_filter, mapped through field_mappings, and loaded to the target_table
4. Events that don't match the event_kind_filter are silently dropped (no error, no warning)
5. Array-format events are iterated individually
6. Load failures for individual events are logged but don't kill the SSE session
7. No SimBLAH-specific code -- the event_kind_filter mechanism is generic
```

---

## Phase 3: Access Control Source + Badge Event Loading

### What it accomplishes
Handles the special case of `badge_events` which requires a `source_id` FK to `access_control_sources`. Creates a migration to seed the SimBLAH access control source row, and ensures the badge event typed loader from Phase 1 properly references it.

### Difficulty: Low
Straightforward migration + minor loader adjustment. The main question is how to get the `source_id` into the pipeline. Answer: store it in the import_definition's `source_config.source_id`.

### Implementation Prompt

```
You are implementing Phase 3 of the SimBLAH integration plan for the Inside/Operations (I/O) project. Your task is to ensure badge events can be loaded through the Universal Import pipeline by providing the required `source_id` FK to `access_control_sources`.

## Context

The `badge_events` table (defined in `/home/io/io-dev/io/migrations/20260315000038_shifts.up.sql`) requires a `source_id UUID NOT NULL REFERENCES access_control_sources(id)` column. The `access_control_sources` table stores badge system adapter configurations.

The typed loader for `badge_events` (implemented in Phase 1 in `/home/io/io-dev/io/services/import-service/src/pipeline.rs`) reads `source_id` from `source_config.source_id`. The import_definition for badge events will have this UUID in its source_config.

However, the `access_control_sources` row needs to exist before any badge events can be imported. This phase handles that bootstrapping.

## What needs to happen

### 1. Verify the Phase 1 badge_events loader

Open `/home/io/io-dev/io/services/import-service/src/pipeline.rs` and verify the `load_badge_events` function:

- Reads `source_id` from `source_config.source_id` (UUID string)
- Parses it to a `Uuid`
- If missing or unparseable, returns `Ok(0)` with a warning (no records loaded, doesn't crash)
- INSERT (not UPSERT -- badge events are append-only, no unique constraint)
- Maps fields: event_type, employee_id, door_id, door_name, area, event_time, raw_data
- `event_time` should be parsed from ISO 8601 / RFC 3339 string
- `raw_data` should be the full original record as JSONB

If the loader needs fixes, fix it now.

### 2. Create a helper migration for the schedule_type constraint

The `import_schedules.schedule_type` CHECK constraint (from `/home/io/io-dev/io/migrations/20260314000013_import.up.sql` line 69) only allows: 'cron', 'interval', 'manual', 'file_arrival', 'webhook', 'dependency'. The streaming supervisor queries for `schedule_type = 'stream_session'` but this value isn't in the constraint.

Create a new migration file:
`/home/io/io-dev/io/migrations/20260422000001_add_stream_session_schedule_type.up.sql`

```sql
-- Add 'stream_session' to import_schedules.schedule_type CHECK constraint
-- Required for SSE/WebSocket streaming sessions managed by the supervisor

ALTER TABLE import_schedules
    DROP CONSTRAINT IF EXISTS import_schedules_schedule_type_check;

ALTER TABLE import_schedules
    ADD CONSTRAINT import_schedules_schedule_type_check
    CHECK (schedule_type IN ('cron', 'interval', 'manual', 'file_arrival', 'webhook', 'dependency', 'stream_session'));
```

And the down migration:
`/home/io/io-dev/io/migrations/20260422000001_add_stream_session_schedule_type.down.sql`

```sql
ALTER TABLE import_schedules
    DROP CONSTRAINT IF EXISTS import_schedules_schedule_type_check;

ALTER TABLE import_schedules
    ADD CONSTRAINT import_schedules_schedule_type_check
    CHECK (schedule_type IN ('cron', 'interval', 'manual', 'file_arrival', 'webhook', 'dependency'));
```

### 3. No code changes needed for access_control_sources seeding

The actual `access_control_sources` row will be seeded in Phase 4 (the seed data migration). This phase just ensures the pipeline infrastructure can handle badge events when the source exists.

## Acceptance criteria

1. The `load_badge_events` function in pipeline.rs correctly reads `source_id` from source_config
2. The migration adds `stream_session` to the schedule_type CHECK constraint
3. Both up and down migrations are syntactically valid SQL
4. `cargo build -p io-import-service` still compiles
5. If the Phase 1 badge_events loader had any bugs, they are fixed
```

---

## Phase 4: SimBLAH Connection Configuration (Seed Data)

### What it accomplishes
Creates all the import_connections, import_definitions, and import_schedules rows needed to connect to the three SimBLAH services. This is a SQL migration that pre-configures everything for the demo. After this migration runs and the import-service restarts, SSE streams should auto-start and REST imports can be triggered manually or on schedule.

### Difficulty: Medium
Lots of config to get right. The field_mappings JSON for each definition must correctly map SimBLAH field names to IO table column names, handle status value transformations, and put unmapped fields into extra_data.

### Implementation Prompt

```
You are implementing Phase 4 of the SimBLAH integration plan for the Inside/Operations (I/O) project. Your task is to create seed data that configures all SimBLAH connections, import definitions, and schedules using Universal Import's generic connectors.

## Context

The Universal Import system uses three tables to configure integrations:
- `import_connections` — connection endpoints and auth credentials
- `import_definitions` — what to import, field mappings, target table
- `import_schedules` — when to run (cron, interval, stream_session)

All tables are defined in `/home/io/io-dev/io/migrations/20260314000013_import.up.sql`. The schedules table was fixed in `/home/io/io-dev/io/migrations/20260405000001_fix_import_schedules.up.sql` (column renamed to `definition_id`).

The `created_by` column on import_connections and import_definitions is `NOT NULL REFERENCES users(id)`. You need to use the admin user's UUID. The admin user is seeded with a well-known ID. Find it by querying: `SELECT id FROM users WHERE username = 'admin' LIMIT 1`. For the migration, use a subselect: `(SELECT id FROM users WHERE username = 'admin' LIMIT 1)`.

## Create migration file

`/home/io/io-dev/io/migrations/20260422000002_simblah_seed_connections.up.sql`

### Step 1: Access Control Source

Insert the `access_control_sources` row that badge_events will reference:

```sql
INSERT INTO access_control_sources (id, name, adapter_type, enabled, config, poll_interval_s)
VALUES (
    'a0000000-0000-0000-0000-000000000001'::uuid,
    'SimBLAH Access Control',
    'generic_db',
    true,
    '{"type": "sse_import", "notes": "Managed by Universal Import SSE connector"}'::jsonb,
    0  -- not polled directly; SSE stream handles updates
)
ON CONFLICT (name) DO NOTHING;
```

### Step 2: Import Connections (3 — one per SimBLAH service)

```sql
-- Maintenance service
INSERT INTO import_connections (id, name, connection_type, config, auth_type, auth_config, enabled, created_by)
VALUES (
    'c0000000-0000-0000-0001-000000000001'::uuid,
    'SimBLAH Maintenance REST',
    'generic_rest',
    '{"base_url": "https://maint.simblah.in-ops.com:8444"}'::jsonb,
    'bearer_token',
    '{"bearer_token": "SIMBLAH_MAINT_TOKEN"}'::jsonb,
    true,
    (SELECT id FROM users WHERE username = 'admin' LIMIT 1)
)
ON CONFLICT (name) DO NOTHING;

INSERT INTO import_connections (id, name, connection_type, config, auth_type, auth_config, enabled, created_by)
VALUES (
    'c0000000-0000-0000-0001-000000000002'::uuid,
    'SimBLAH Maintenance SSE',
    'sse',
    '{"base_url": "https://maint.simblah.in-ops.com:8444"}'::jsonb,
    'bearer_token',
    '{"bearer_token": "SIMBLAH_MAINT_TOKEN"}'::jsonb,
    true,
    (SELECT id FROM users WHERE username = 'admin' LIMIT 1)
)
ON CONFLICT (name) DO NOTHING;

-- Accounting/ERP service
INSERT INTO import_connections (id, name, connection_type, config, auth_type, auth_config, enabled, created_by)
VALUES (
    'c0000000-0000-0000-0001-000000000003'::uuid,
    'SimBLAH Accounting REST',
    'generic_rest',
    '{"base_url": "https://acct.simblah.in-ops.com:8445"}'::jsonb,
    'bearer_token',
    '{"bearer_token": "SIMBLAH_ACCT_TOKEN"}'::jsonb,
    true,
    (SELECT id FROM users WHERE username = 'admin' LIMIT 1)
)
ON CONFLICT (name) DO NOTHING;

INSERT INTO import_connections (id, name, connection_type, config, auth_type, auth_config, enabled, created_by)
VALUES (
    'c0000000-0000-0000-0001-000000000004'::uuid,
    'SimBLAH Accounting SSE',
    'sse',
    '{"base_url": "https://acct.simblah.in-ops.com:8445"}'::jsonb,
    'bearer_token',
    '{"bearer_token": "SIMBLAH_ACCT_TOKEN"}'::jsonb,
    true,
    (SELECT id FROM users WHERE username = 'admin' LIMIT 1)
)
ON CONFLICT (name) DO NOTHING;

-- Access Control service
INSERT INTO import_connections (id, name, connection_type, config, auth_type, auth_config, enabled, created_by)
VALUES (
    'c0000000-0000-0000-0001-000000000005'::uuid,
    'SimBLAH Access Control REST',
    'generic_rest',
    '{"base_url": "https://access.simblah.in-ops.com:8446"}'::jsonb,
    'bearer_token',
    '{"bearer_token": "SIMBLAH_ACCESS_TOKEN"}'::jsonb,
    true,
    (SELECT id FROM users WHERE username = 'admin' LIMIT 1)
)
ON CONFLICT (name) DO NOTHING;

INSERT INTO import_connections (id, name, connection_type, config, auth_type, auth_config, enabled, created_by)
VALUES (
    'c0000000-0000-0000-0001-000000000006'::uuid,
    'SimBLAH Access Control SSE',
    'sse',
    '{"base_url": "https://access.simblah.in-ops.com:8446"}'::jsonb,
    'bearer_token',
    '{"bearer_token": "SIMBLAH_ACCESS_TOKEN"}'::jsonb,
    true,
    (SELECT id FROM users WHERE username = 'admin' LIMIT 1)
)
ON CONFLICT (name) DO NOTHING;
```

NOTE: The `auth_config` values contain placeholder tokens. In a real deployment these would be encrypted with the master key. For the dev/demo environment with the all-zeros master key, plaintext tokens work. If the SimBLAH services don't actually require tokens, use empty strings.

### Step 3: Import Definitions

Create definitions for each data type. Each definition has:
- `connection_id` — FK to the connection
- `source_config` — endpoint, pagination, event_kind_filter (for SSE), source_system, id_field
- `field_mappings` — array of {source, target} mappings
- `target_table` — which typed table to load into

#### Maintenance: Tickets (REST poll)
```sql
INSERT INTO import_definitions (id, connection_id, name, description, source_config, field_mappings, target_table, enabled, created_by)
VALUES (
    'd0000000-0000-0000-0001-000000000001'::uuid,
    'c0000000-0000-0000-0001-000000000001'::uuid,
    'SimBLAH Tickets',
    'Import maintenance tickets from SimBLAH',
    '{
        "endpoint": "/api/tickets",
        "pagination_type": "offset_limit",
        "page_size": 100,
        "source_system": "simblah_maint",
        "id_field": "id",
        "watermark_column": "updated_at",
        "watermark_param": "updated_since"
    }'::jsonb,
    '[
        {"source": "id", "target": "external_id"},
        {"source": "subject", "target": "title"},
        {"source": "description", "target": "description"},
        {"source": "status", "target": "status"},
        {"source": "priority", "target": "priority"},
        {"source": "assigned_to_name", "target": "assigned_to"},
        {"source": "date_closed", "target": "closed_at"}
    ]'::jsonb,
    'tickets',
    true,
    (SELECT id FROM users WHERE username = 'admin' LIMIT 1)
)
ON CONFLICT (name) DO NOTHING;
```

Notes on field_mappings for tickets:
- `subject` -> `title` (SimBLAH uses "subject", IO uses "title")
- `ticket_number` defaults to external_id if not mapped (loader should handle this)
- `ticket_type` defaults to 'incident' since SimBLAH doesn't provide it
- Unmapped fields (assigned_to, date_opened, due_date, created_at, updated_at) go to extra_data
- SimBLAH status values (open, in_progress, on_hold, closed) are all valid in IO's CHECK constraint

#### Maintenance: Work Orders (REST poll)
```sql
INSERT INTO import_definitions (id, connection_id, name, description, source_config, field_mappings, target_table, enabled, created_by)
VALUES (
    'd0000000-0000-0000-0001-000000000002'::uuid,
    'c0000000-0000-0000-0001-000000000001'::uuid,
    'SimBLAH Work Orders',
    'Import work orders from SimBLAH Maintenance',
    '{
        "endpoint": "/api/workorders",
        "pagination_type": "offset_limit",
        "page_size": 100,
        "source_system": "simblah_maint",
        "id_field": "id",
        "watermark_column": "date_opened",
        "watermark_param": "updated_since"
    }'::jsonb,
    '[
        {"source": "id", "target": "external_id"},
        {"source": "subject", "target": "title"},
        {"source": "description", "target": "description"},
        {"source": "status", "target": "status"},
        {"source": "assigned_to_name", "target": "assigned_to"},
        {"source": "date_opened", "target": "scheduled_start"},
        {"source": "due_date", "target": "scheduled_end"},
        {"source": "date_completed", "target": "actual_end"}
    ]'::jsonb,
    'work_orders',
    true,
    (SELECT id FROM users WHERE username = 'admin' LIMIT 1)
)
ON CONFLICT (name) DO NOTHING;
```

#### Maintenance: Tickets SSE (live stream)
```sql
INSERT INTO import_definitions (id, connection_id, name, description, source_config, field_mappings, target_table, enabled, created_by)
VALUES (
    'd0000000-0000-0000-0001-000000000003'::uuid,
    'c0000000-0000-0000-0001-000000000002'::uuid,
    'SimBLAH Tickets SSE',
    'Live ticket updates from SimBLAH Maintenance SSE stream',
    '{
        "endpoint": "/api/events/stream",
        "event_kind_filter": "ticket",
        "source_system": "simblah_maint",
        "id_field": "id"
    }'::jsonb,
    '[
        {"source": "id", "target": "external_id"},
        {"source": "subject", "target": "title"},
        {"source": "description", "target": "description"},
        {"source": "status", "target": "status"},
        {"source": "priority", "target": "priority"},
        {"source": "assigned_to_name", "target": "assigned_to"},
        {"source": "date_closed", "target": "closed_at"}
    ]'::jsonb,
    'tickets',
    true,
    (SELECT id FROM users WHERE username = 'admin' LIMIT 1)
)
ON CONFLICT (name) DO NOTHING;
```

#### Maintenance: Work Orders SSE (live stream)
```sql
INSERT INTO import_definitions (id, connection_id, name, description, source_config, field_mappings, target_table, enabled, created_by)
VALUES (
    'd0000000-0000-0000-0001-000000000004'::uuid,
    'c0000000-0000-0000-0001-000000000002'::uuid,
    'SimBLAH Work Orders SSE',
    'Live work order updates from SimBLAH Maintenance SSE stream',
    '{
        "endpoint": "/api/events/stream",
        "event_kind_filter": "work_order",
        "source_system": "simblah_maint",
        "id_field": "id"
    }'::jsonb,
    '[
        {"source": "id", "target": "external_id"},
        {"source": "subject", "target": "title"},
        {"source": "description", "target": "description"},
        {"source": "status", "target": "status"},
        {"source": "assigned_to_name", "target": "assigned_to"},
        {"source": "date_opened", "target": "scheduled_start"},
        {"source": "due_date", "target": "scheduled_end"},
        {"source": "date_completed", "target": "actual_end"}
    ]'::jsonb,
    'work_orders',
    true,
    (SELECT id FROM users WHERE username = 'admin' LIMIT 1)
)
ON CONFLICT (name) DO NOTHING;
```

#### Accounting: Purchase Orders (REST)
```sql
INSERT INTO import_definitions (id, connection_id, name, description, source_config, field_mappings, target_table, enabled, created_by)
VALUES (
    'd0000000-0000-0000-0001-000000000005'::uuid,
    'c0000000-0000-0000-0001-000000000003'::uuid,
    'SimBLAH Purchase Orders',
    'Import purchase orders from SimBLAH Accounting',
    '{
        "endpoint": "/api/purchase-orders",
        "pagination_type": "offset_limit",
        "page_size": 100,
        "source_system": "simblah_acct",
        "id_field": "id"
    }'::jsonb,
    '[
        {"source": "id", "target": "external_id"},
        {"source": "id", "target": "po_number"},
        {"source": "vendor_name", "target": "vendor_name"},
        {"source": "status", "target": "status"},
        {"source": "date_opened", "target": "order_date"},
        {"source": "date_fulfilled", "target": "expected_delivery_date"},
        {"source": "total_cost", "target": "total_amount"},
        {"source": "notes", "target": "extra_data"}
    ]'::jsonb,
    'purchase_orders',
    true,
    (SELECT id FROM users WHERE username = 'admin' LIMIT 1)
)
ON CONFLICT (name) DO NOTHING;
```

IMPORTANT: SimBLAH PO status values need mapping:
- SimBLAH `open` -> IO `approved`
- SimBLAH `fulfilled` -> IO `received`
- SimBLAH `cancelled` -> IO `cancelled`

The field_mappings alone can't do value transforms. Two options:
(a) Add a `transforms` array with a Rhai expression or value map
(b) Handle it in the typed loader with a status mapping table

The simplest approach: add a `transforms` entry. However, the current transform ops in pipeline.rs (line ~133) only support string operations (trim, lowercase, etc.), not value mapping.

**Decision: Add a `value_map` transform op to pipeline.rs.** This is a generic pipeline improvement, not SimBLAH-specific.

Add to the transforms JSON:
```json
[{"op": "value_map", "field": "status", "map": {"open": "approved", "fulfilled": "received", "cancelled": "cancelled"}, "default": "approved"}]
```

This requires a code change in `apply_transforms` in pipeline.rs:
```rust
"value_map" => {
    let map = step.get("map").and_then(|v| v.as_object());
    let default_val = step.get("default").and_then(|v| v.as_str());
    if let (Some(map), Some(JsonValue::String(current))) = (map, record.fields.get(field)) {
        let new_val = map.get(current.as_str())
            .and_then(|v| v.as_str())
            .or(default_val)
            .unwrap_or(current.as_str());
        record.fields.insert(field.to_string(), JsonValue::String(new_val.to_string()));
    }
}
```

Update the PO definition transforms:
```sql
-- In the PO definition, add transforms column:
    '[{"op": "value_map", "field": "status", "map": {"open": "approved", "fulfilled": "received", "cancelled": "cancelled"}, "default": "approved"}]'::jsonb,
```

#### Accounting: Inventory (REST)
```sql
INSERT INTO import_definitions (id, connection_id, name, description, source_config, field_mappings, target_table, enabled, created_by)
VALUES (
    'd0000000-0000-0000-0001-000000000006'::uuid,
    'c0000000-0000-0000-0001-000000000003'::uuid,
    'SimBLAH Inventory',
    'Import inventory/parts from SimBLAH Accounting',
    '{
        "endpoint": "/api/inventory",
        "pagination_type": "offset_limit",
        "page_size": 100,
        "source_system": "simblah_acct",
        "id_field": "id"
    }'::jsonb,
    '[
        {"source": "id", "target": "external_id"},
        {"source": "part_number", "target": "part_number"},
        {"source": "description", "target": "description"},
        {"source": "total_stock", "target": "quantity_on_hand"},
        {"source": "model_number", "target": "extra_data"}
    ]'::jsonb,
    'inventory_items',
    true,
    (SELECT id FROM users WHERE username = 'admin' LIMIT 1)
)
ON CONFLICT (name) DO NOTHING;
```

#### Accounting: Vendors (REST)
```sql
INSERT INTO import_definitions (id, connection_id, name, description, source_config, field_mappings, target_table, enabled, created_by)
VALUES (
    'd0000000-0000-0000-0001-000000000007'::uuid,
    'c0000000-0000-0000-0001-000000000003'::uuid,
    'SimBLAH Vendors',
    'Import vendor master from SimBLAH Accounting',
    '{
        "endpoint": "/api/vendors",
        "pagination_type": "none",
        "source_system": "simblah_acct",
        "id_field": "id"
    }'::jsonb,
    '[
        {"source": "id", "target": "external_id"},
        {"source": "name", "target": "name"},
        {"source": "name", "target": "vendor_code"},
        {"source": "contact_info", "target": "extra_data"}
    ]'::jsonb,
    'vendor_master',
    true,
    (SELECT id FROM users WHERE username = 'admin' LIMIT 1)
)
ON CONFLICT (name) DO NOTHING;
```

#### Accounting: PO SSE
```sql
INSERT INTO import_definitions (id, connection_id, name, description, source_config, field_mappings, transforms, target_table, enabled, created_by)
VALUES (
    'd0000000-0000-0000-0001-000000000008'::uuid,
    'c0000000-0000-0000-0001-000000000004'::uuid,
    'SimBLAH PO Updates SSE',
    'Live PO updates from SimBLAH Accounting SSE stream',
    '{
        "endpoint": "/api/events/stream",
        "event_kind_filter": "purchase_order",
        "source_system": "simblah_acct",
        "id_field": "id"
    }'::jsonb,
    '[
        {"source": "id", "target": "external_id"},
        {"source": "id", "target": "po_number"},
        {"source": "vendor_name", "target": "vendor_name"},
        {"source": "status", "target": "status"},
        {"source": "total_cost", "target": "total_amount"}
    ]'::jsonb,
    '[{"op": "value_map", "field": "status", "map": {"open": "approved", "fulfilled": "received", "cancelled": "cancelled"}, "default": "approved"}]'::jsonb,
    'purchase_orders',
    true,
    (SELECT id FROM users WHERE username = 'admin' LIMIT 1)
)
ON CONFLICT (name) DO NOTHING;
```

#### Accounting: Stock Movement SSE
```sql
INSERT INTO import_definitions (id, connection_id, name, description, source_config, field_mappings, target_table, enabled, created_by)
VALUES (
    'd0000000-0000-0000-0001-000000000009'::uuid,
    'c0000000-0000-0000-0001-000000000004'::uuid,
    'SimBLAH Stock Updates SSE',
    'Live inventory updates from SimBLAH Accounting SSE stream',
    '{
        "endpoint": "/api/events/stream",
        "event_kind_filter": "stock_movement",
        "source_system": "simblah_acct",
        "id_field": "id"
    }'::jsonb,
    '[
        {"source": "id", "target": "external_id"},
        {"source": "part_number", "target": "part_number"},
        {"source": "description", "target": "description"},
        {"source": "total_stock", "target": "quantity_on_hand"}
    ]'::jsonb,
    'inventory_items',
    true,
    (SELECT id FROM users WHERE username = 'admin' LIMIT 1)
)
ON CONFLICT (name) DO NOTHING;
```

#### Access Control: Employees (REST) -> custom_import_data
Employees don't have a dedicated typed table. Store in custom_import_data for now.
```sql
INSERT INTO import_definitions (id, connection_id, name, description, source_config, field_mappings, target_table, enabled, created_by)
VALUES (
    'd0000000-0000-0000-0001-000000000010'::uuid,
    'c0000000-0000-0000-0001-000000000005'::uuid,
    'SimBLAH Employees',
    'Import employee directory from SimBLAH Access Control',
    '{
        "endpoint": "/api/employees",
        "pagination_type": "offset_limit",
        "page_size": 100,
        "source_system": "simblah_access",
        "id_field": "id"
    }'::jsonb,
    '[]'::jsonb,
    'custom_import_data',
    true,
    (SELECT id FROM users WHERE username = 'admin' LIMIT 1)
)
ON CONFLICT (name) DO NOTHING;
```

#### Access Control: Badge Events (REST poll for history)
```sql
INSERT INTO import_definitions (id, connection_id, name, description, source_config, field_mappings, target_table, enabled, created_by)
VALUES (
    'd0000000-0000-0000-0001-000000000011'::uuid,
    'c0000000-0000-0000-0001-000000000005'::uuid,
    'SimBLAH Badge Events',
    'Import badge event history from SimBLAH Access Control',
    '{
        "endpoint": "/api/events",
        "pagination_type": "offset_limit",
        "page_size": 100,
        "source_system": "simblah_access",
        "id_field": "id",
        "source_id": "a0000000-0000-0000-0000-000000000001"
    }'::jsonb,
    '[
        {"source": "event_type", "target": "event_type"},
        {"source": "employee_id", "target": "employee_id"},
        {"source": "reader_id", "target": "door_id"},
        {"source": "reader_string_id", "target": "door_name"},
        {"source": "event_time", "target": "event_time"}
    ]'::jsonb,
    'badge_events',
    true,
    (SELECT id FROM users WHERE username = 'admin' LIMIT 1)
)
ON CONFLICT (name) DO NOTHING;
```

#### Access Control: Badge Events SSE (live stream)
```sql
INSERT INTO import_definitions (id, connection_id, name, description, source_config, field_mappings, target_table, enabled, created_by)
VALUES (
    'd0000000-0000-0000-0001-000000000012'::uuid,
    'c0000000-0000-0000-0001-000000000006'::uuid,
    'SimBLAH Badge Events SSE',
    'Live badge events from SimBLAH Access Control SSE stream',
    '{
        "endpoint": "/api/events/stream",
        "source_system": "simblah_access",
        "id_field": "id",
        "source_id": "a0000000-0000-0000-0000-000000000001"
    }'::jsonb,
    '[
        {"source": "event_type", "target": "event_type"},
        {"source": "employee_id", "target": "employee_id"},
        {"source": "reader_id", "target": "door_id"},
        {"source": "reader_string_id", "target": "door_name"},
        {"source": "reader_description", "target": "area"},
        {"source": "event_time", "target": "event_time"},
        {"source": "employee_first_name", "target": "extra_first_name"},
        {"source": "employee_last_name", "target": "extra_last_name"}
    ]'::jsonb,
    'badge_events',
    true,
    (SELECT id FROM users WHERE username = 'admin' LIMIT 1)
)
ON CONFLICT (name) DO NOTHING;
```

### Step 4: Import Schedules

REST definitions get `interval` schedules (poll every 5 minutes).
SSE definitions get `stream_session` schedules (auto-started by supervisor).

```sql
-- REST poll schedules (5-minute interval)
INSERT INTO import_schedules (id, definition_id, schedule_type, interval_seconds, enabled)
VALUES
    (gen_random_uuid(), 'd0000000-0000-0000-0001-000000000001'::uuid, 'interval', 300, true),
    (gen_random_uuid(), 'd0000000-0000-0000-0001-000000000002'::uuid, 'interval', 300, true),
    (gen_random_uuid(), 'd0000000-0000-0000-0001-000000000005'::uuid, 'interval', 300, true),
    (gen_random_uuid(), 'd0000000-0000-0000-0001-000000000006'::uuid, 'interval', 300, true),
    (gen_random_uuid(), 'd0000000-0000-0000-0001-000000000007'::uuid, 'interval', 300, true),
    (gen_random_uuid(), 'd0000000-0000-0000-0001-000000000010'::uuid, 'interval', 300, true),
    (gen_random_uuid(), 'd0000000-0000-0000-0001-000000000011'::uuid, 'interval', 300, true);

-- SSE stream_session schedules (auto-started by supervisor)
INSERT INTO import_schedules (id, definition_id, schedule_type, enabled)
VALUES
    (gen_random_uuid(), 'd0000000-0000-0000-0001-000000000003'::uuid, 'stream_session', true),
    (gen_random_uuid(), 'd0000000-0000-0000-0001-000000000004'::uuid, 'stream_session', true),
    (gen_random_uuid(), 'd0000000-0000-0000-0001-000000000008'::uuid, 'stream_session', true),
    (gen_random_uuid(), 'd0000000-0000-0000-0001-000000000009'::uuid, 'stream_session', true),
    (gen_random_uuid(), 'd0000000-0000-0000-0001-000000000012'::uuid, 'stream_session', true);
```

### Step 5: Add `value_map` transform op

In `/home/io/io-dev/io/services/import-service/src/pipeline.rs`, in the `apply_transforms` function (the `match op` block around line ~148), add:

```rust
"value_map" => {
    if let Some(map) = step.get("map").and_then(|v| v.as_object()) {
        let default_val = step.get("default").and_then(|v| v.as_str());
        if let Some(JsonValue::String(current)) = record.fields.get(field).cloned() {
            let new_val = map.get(current.as_str())
                .and_then(|v| v.as_str())
                .or(default_val)
                .unwrap_or(current.as_str())
                .to_string();
            record.fields.insert(field.to_string(), JsonValue::String(new_val));
        }
    }
}
```

### Down migration

`/home/io/io-dev/io/migrations/20260422000002_simblah_seed_connections.down.sql`

```sql
-- Remove SimBLAH seed data (schedules cascade from definitions)
DELETE FROM import_definitions WHERE name LIKE 'SimBLAH%';
DELETE FROM import_connections WHERE name LIKE 'SimBLAH%';
DELETE FROM access_control_sources WHERE name = 'SimBLAH Access Control';
```

## Acceptance criteria

1. The migration runs without errors (assuming Phase 3 migration ran first for stream_session schedule_type)
2. All 12 import_definitions are created with correct field_mappings and target_tables
3. All 12 import_schedules are created (7 interval + 5 stream_session)
4. The `value_map` transform op is added to pipeline.rs and compiles
5. `cargo build -p io-import-service` compiles
6. `cargo clippy -p io-import-service -- -D warnings` passes
7. After service restart, the streaming supervisor should pick up the 5 SSE stream_session schedules and attempt to connect (they'll fail if SimBLAH isn't running, but the connection attempts should be visible in logs)
```

---

## Phase 5: Frontend Demo Integration

### What it accomplishes
Adds UI elements to display the imported SimBLAH data in context: maintenance tickets in alarm panels, badge events in the Shifts module, and a Universal Import status dashboard showing all active connections and SSE sessions.

### Difficulty: Medium-High (lots of surface area)
This phase touches multiple frontend modules. The most impactful demo element is the streaming status dashboard since it shows SSE sessions connecting, events flowing, and record counts updating in real-time.

### Implementation Prompt

```
You are implementing Phase 5 of the SimBLAH integration plan for the Inside/Operations (I/O) project. Your task is to add frontend UI elements that display data imported from SimBLAH's three services through the Universal Import pipeline.

## Context

Phases 1-4 implemented:
- Typed table loading for tickets, work_orders, inventory_items, purchase_orders, vendor_master, badge_events
- SSE streaming event processing with event_kind_filter
- All SimBLAH connections and definitions seeded via migration
- Streaming supervisor auto-starts SSE sessions

The frontend is a React 18 + TypeScript app at `/home/io/io-dev/io/frontend/`. It uses:
- Zustand for client state
- TanStack Query for server state
- TanStack Table for data tables
- Radix UI primitives
- Tailwind CSS
- Design tokens from doc 38

The backend API gateway is at port 3000, proxying to the import service at port 3006.

## Deliverables (in priority order for demo impact)

### 1. Universal Import Streaming Status Dashboard

**Location:** Settings module, new "Import Status" tab
**Route:** `/settings/import/status`

This is the highest-demo-impact item. It shows:
- All import_connections with their connection status
- All active SSE streaming sessions with live metrics
- Ability to stop/restart streams

**API endpoints (already exist):**
- `GET /api/v1/import/definitions` — list all definitions
- `GET /api/v1/import/definitions/:id/stream-session` — session status for a definition
- `POST /api/v1/import/definitions/:id/stream-session/stop` — stop a session
- `POST /api/v1/import/definitions/:id/stream-session/restart` — restart a session

**UI layout:**
- Two-column layout: left = connection list with status chips, right = detail panel
- Clicking a connection shows its definitions
- Each streaming definition shows: status badge (green=active, yellow=connecting/reconnecting, red=failed, gray=stopped), events_received count, last_event_at timestamp, reconnect_count
- Stop/Restart buttons for each streaming session
- Auto-refresh every 5 seconds using TanStack Query's `refetchInterval`

**File to create:** `/home/io/io-dev/io/frontend/src/pages/settings/ImportStatusPage.tsx`

Skeleton:
```tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';

interface StreamSession {
  session_id: string;
  definition_id: string;
  status: 'connecting' | 'active' | 'reconnecting' | 'failed' | 'stopped';
  session_type: string;
  started_at: string;
  last_event_at: string | null;
  events_received: number;
  reconnect_count: number;
  error_message: string | null;
  supervisor_running: boolean;
}

// Fetch all definitions, then for each streaming one, fetch its session
// Display in a table with status badges
```

### 2. Badge Event Feed in Shifts Module

**Location:** Shifts module, "Badge Events" tab
**Route:** `/shifts/badge-events`

**API:** Create a new endpoint `GET /api/v1/shifts/badge-events` that queries the `badge_events` table with pagination, filtering by time range.

If the shifts module already has a badge events page, integrate with it. Check:
- `/home/io/io-dev/io/frontend/src/pages/shifts/` for existing pages

**UI:** TanStack Table with columns: Time, Employee, Event Type, Door, Area. Sorted by event_time DESC. Auto-refresh every 10 seconds.

### 3. Maintenance Tickets Panel

**Location:** Available as a context panel when clicking on an OPC alarm or point

**UI approach:** A `<MaintenanceTicketsPanel>` component that:
- Takes an optional `pointId` or `tagname` prop
- Queries `GET /api/v1/import/tickets?source_system=simblah_maint` (or a new endpoint)
- Shows recent open tickets in a compact card list
- Each card shows: title, status badge, priority badge, assigned_to, age

If there's no existing API endpoint for querying tickets, you'll need to add one to the API gateway. Check if there's already a tickets endpoint.

### 4. Work Order / PO Detail Links

Lower priority. If time permits:
- Work order detail view that shows linked ticket (via ticket_id in extra_data)
- PO list with vendor and status
- Inventory item list with stock levels

## Important implementation notes

1. Check the existing Settings module structure at `/home/io/io-dev/io/frontend/src/pages/settings/` before creating new pages. Follow the existing pattern for how settings tabs are organized.

2. Check the existing router configuration at `/home/io/io-dev/io/frontend/src/` (likely `App.tsx` or a routes file) to understand how to add new routes.

3. The API gateway at `/home/io/io-dev/io/services/api-gateway/` may need new proxy routes if the import service endpoints aren't already exposed. Check the existing route configuration.

4. For the streaming status dashboard, the data should auto-refresh but NOT use WebSocket -- use TanStack Query polling. The import service's streaming sessions are internal infrastructure, not user-facing real-time data.

5. Follow the existing design token patterns (Tailwind classes, Radix primitives) used in other Settings pages.

6. For new API endpoints, follow the REST conventions in design doc 21 (`/api/v1/` prefix, standard error format, pagination envelope).

## Acceptance criteria

1. `pnpm build` in the frontend directory succeeds
2. `pnpm lint` passes
3. The Import Status page at `/settings/import/status` renders and shows:
   - All import connections
   - Streaming session status for SSE definitions
   - Stop/Restart buttons that call the correct API endpoints
   - Auto-refresh
4. The badge events table at `/shifts/badge-events` renders badge events sorted by time
5. No new npm dependencies added (use existing TanStack Query, Radix, Tailwind)
6. All new components follow existing code patterns (api client, query key conventions, etc.)
```

---

## Summary: Phase Dependency Chain

```
Phase 1 (Typed Loading)  ─── required by all subsequent phases
    │
Phase 2 (SSE Wiring)    ─── requires Phase 1 typed loaders
    │
Phase 3 (Badge + Migration) ─ can run parallel with Phase 2
    │
Phase 4 (Seed Data)      ─── requires Phase 1, 2, 3 all complete
    │
Phase 5 (Frontend)       ─── requires Phase 4 for data to display
```

**Estimated effort:**
- Phase 1: ~2 hours (repetitive but straightforward)
- Phase 2: ~1.5 hours (tricky closure/ownership, but small surface)
- Phase 3: ~30 minutes (migration + verification)
- Phase 4: ~1.5 hours (lots of JSON config to get right)
- Phase 5: ~3-4 hours (multi-module frontend work)

**Total: ~8-9 hours of implementation work**

## Risk assessment

- **Highest risk:** Phase 2 (SSE wiring). The closure ownership model for `on_event` is the trickiest part. The callback needs to capture `db`, `field_mappings`, `target_table`, and `source_config` in a `'static + Send + Sync` closure. All of these are `Clone`, so it should work, but the async lifetime management could be fiddly.

- **Medium risk:** Phase 4 (seed data). The field_mappings JSON must exactly match the field names coming from SimBLAH. If the actual API responses have different field names than documented, the mappings will silently produce empty records. Mitigation: run a manual REST import first, inspect the extracted data, then adjust mappings.

- **Low risk:** Phase 1, 3, 5. These are straightforward implementation work with clear patterns.
