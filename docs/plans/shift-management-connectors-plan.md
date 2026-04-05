# Shift Management Connector Templates — Implementation Plan

**Goal:** Build 5 vendor-specific connector templates + 2 generic fallbacks that pull shift schedule data from external workforce management systems into the I/O Shifts module (rosters, assignments, presence tracking, mustering).

**Systems covered:** UKG Pro WFM, Shiftboard (JSON-RPC), Oracle Primavera P6, SAP SuccessFactors, Hexagon j5, Generic CSV, Generic REST.

---

## Architecture Overview

```
External WFM Systems                  Import Service (ETL Pipeline)
+---------------------+              +---------------------------+
| UKG Pro WFM         |--REST------->| ukg_wfm connector         |
| Shiftboard          |--JSON-RPC--->| shiftboard_jsonrpc conn.   |
| Oracle P6 EPPM      |--REST------->| generic_rest connector     |
| SAP SuccessFactors  |--OData------>| generic_rest connector     |
| Hexagon j5          |--REST------->| generic_rest connector     |
| CSV/SFTP files      |--File------->| csv_file connector         |
| Generic REST        |--REST------->| generic_rest connector     |
+---------------------+              +---------------------------+
                                              |
                                              v
                                     load_shifts() / load_shift_assignments()
                                              |
                                              v
                              +-------------------------------+
                              | shifts (source='external')    |
                              | shift_assignments (src='ext') |
                              +-------------------------------+
                                              |
                                     (automatic integration)
                                              v
                              +-------------------------------+
                              | presence_status.on_shift      |
                              | /api/shifts/current/personnel |
                              | muster_accounting             |
                              +-------------------------------+
```

**Key design decisions:**
1. Reuse the existing import service pipeline (Option A). No new shift_sync adapter.
2. `shifts.source` + `shifts.external_id` columns enable dedup/upsert on external data.
3. UKG and Shiftboard need custom ETL connector types (non-standard auth/protocol). P6, SAP SF, and j5 use `generic_rest` with vendor-specific `template_config`.
4. External shifts appear read-only in the UI with a lock icon and "from {vendor}" badge.

---

## Phase 1: Foundation (Migration + Typed Loaders + Generic Templates)

**Deliverable:** Database schema supports external shifts; pipeline can load into `shifts` and `shift_assignments`; generic CSV and REST shift templates are seeded and functional.

### Files to create or modify

| File | Action |
|------|--------|
| `migrations/20260422000002_shift_management_import.up.sql` | CREATE (new migration) |
| `migrations/20260422000002_shift_management_import.down.sql` | CREATE (rollback) |
| `services/import-service/src/pipeline.rs` | MODIFY (add `load_shifts`, `load_shift_assignments` typed loaders) |
| `services/import-service/src/main.rs` | MODIFY (add shift_management templates to seed function) |

### What gets built

1. **Migration** — adds `source`, `external_id` to `shifts`; adds `external_id` to `shift_assignments`; adds `shift_management` to domain CHECK; adds unique constraint for dedup.
2. **Typed loaders** — `load_shifts()` and `load_shift_assignments()` in pipeline.rs, following the exact pattern of `load_tickets()`.
3. **Seed templates** — `generic-shift-csv` and `generic-shift-rest` connector templates with full `template_config`.

---

## Phase 2: UKG Pro WFM Connector

**Deliverable:** Custom `ukg_wfm` ETL connector type registered; UKG connector template seeded; OAuth ROPC token acquisition + multi_read schedule extraction working.

### Files to create or modify

| File | Action |
|------|--------|
| `services/import-service/src/connectors/etl/ukg_wfm.rs` | CREATE |
| `services/import-service/src/connectors/etl/mod.rs` | MODIFY (add `pub mod ukg_wfm;` + registry entry) |
| `services/import-service/src/main.rs` | MODIFY (add UKG template to seed) |

---

## Phase 3: Shiftboard JSON-RPC + SAP SuccessFactors

**Deliverable:** Custom `shiftboard_jsonrpc` connector type; Shiftboard template with HMAC-SHA1 auth; SAP SuccessFactors template (uses `generic_rest` with OData config).

### Files to create or modify

| File | Action |
|------|--------|
| `services/import-service/src/connectors/etl/shiftboard.rs` | CREATE |
| `services/import-service/src/connectors/etl/mod.rs` | MODIFY (add `pub mod shiftboard;` + registry entry) |
| `services/import-service/src/main.rs` | MODIFY (add Shiftboard + SAP SF templates to seed) |

---

## Phase 4: Oracle P6 EPPM + Hexagon j5

**Deliverable:** P6 and j5 templates (both use `generic_rest`); j5 shift_log_entries table if needed; all 5 vendor connectors + 2 generic = 7 total templates seeded.

### Files to create or modify

| File | Action |
|------|--------|
| `services/import-service/src/main.rs` | MODIFY (add P6 + j5 templates to seed) |
| `services/import-service/src/pipeline.rs` | MODIFY (add `load_shift_log_entries` if j5 needs it) |
| `migrations/20260422000003_shift_log_entries.up.sql` | CREATE (j5 log entry table, optional) |
| `migrations/20260422000003_shift_log_entries.down.sql` | CREATE (rollback) |

---

## Phase 5: Frontend — Shift Management Domain UI + Read-Only External Shifts

**Deliverable:** Import settings shows `shift_management` domain with all 7 templates; Shifts module shows external shifts as read-only with lock icon and vendor badge; complete verification.

### Files to create or modify

| File | Action |
|------|--------|
| `frontend/src/api/shifts.ts` | MODIFY (add `source`, `external_id` to Shift interface) |
| `frontend/src/pages/shifts/ShiftSchedule.tsx` | MODIFY (read-only treatment for external shifts) |
| `frontend/src/pages/shifts/ShiftScheduleEditor.tsx` | MODIFY (disable editing for external shifts) |
| `frontend/src/pages/shifts/index.tsx` | MODIFY (add external shift indicator) |
| `frontend/src/pages/settings/Import.tsx` | MODIFY (add `shift_management` domain label) |

---

## Phase Sequencing Rationale

```
Phase 1 ─── Foundation (schema + loaders + generic templates)
   │
Phase 2 ─── UKG connector (most complex auth, test pattern)
   │
Phase 3 ─── Shiftboard + SAP SF (two connectors, medium complexity)
   │
Phase 4 ─── P6 + j5 (template-only, use generic_rest)
   │
Phase 5 ─── Frontend (display + integration, all backends ready)
```

Each phase compiles and tests independently. Phase 1 is required by all others. Phases 2-4 could theoretically run in parallel but are sequenced to manage complexity. Phase 5 depends on all backends being present.

---

---

# PHASE 1 IMPLEMENTATION PROMPT

---

```
You are implementing Phase 1 of the Shift Management Connectors plan for the Inside/Operations (I/O) project. Your task is to add database schema support for external shift imports, add typed loaders for shifts/shift_assignments in the import pipeline, and seed generic CSV and REST connector templates for the shift_management domain.

## Context

I/O is an industrial process monitoring web application. The Universal Import module has an ETL pipeline in `services/import-service/src/pipeline.rs` that follows: Extract -> Map -> Transform -> Validate -> Load. The Load stage dispatches to typed loaders by `target_table` name (see `load_records()` at ~line 421). There are existing loaders for `tickets`, `work_orders`, `inventory_items`, `purchase_orders`, `vendor_master`, and `badge_events`.

The Shifts module has tables `shifts` and `shift_assignments` (migration `migrations/20260315000038_shifts.up.sql`). Currently `shifts` has NO `source` or `external_id` column. `shift_assignments` already has `source VARCHAR(20) DEFAULT 'crew'` with values: crew, direct, external.

The `connector_templates` table has a domain CHECK constraint that currently allows: `maintenance`, `equipment`, `access_control`, `erp_financial`, `ticketing`, `environmental`, `lims_lab`, `regulatory`. We need to add `shift_management`.

## Files to Modify

### 1. NEW: `/home/io/io-dev/io/migrations/20260422000002_shift_management_import.up.sql`

Create this migration file with the following DDL:

```sql
-- Phase: Shift Management Import Support
-- Adds external shift source tracking and expands connector template domains.

-- 1. Add source + external_id to shifts table for dedup of externally imported shifts
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS source VARCHAR(30) NOT NULL DEFAULT 'manual';
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS external_id VARCHAR(200);
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS source_system VARCHAR(100);

-- Index for watermark-based delta sync queries
CREATE INDEX IF NOT EXISTS idx_shifts_source ON shifts (source) WHERE source != 'manual';
CREATE INDEX IF NOT EXISTS idx_shifts_external_id ON shifts (external_id) WHERE external_id IS NOT NULL;

-- Unique constraint for dedup: one external_id per source_system
ALTER TABLE shifts ADD CONSTRAINT uq_shifts_external
    UNIQUE (source_system, external_id);

-- 2. Add external_id to shift_assignments for dedup
ALTER TABLE shift_assignments ADD COLUMN IF NOT EXISTS external_id VARCHAR(200);
ALTER TABLE shift_assignments ADD COLUMN IF NOT EXISTS source_system VARCHAR(100);
CREATE INDEX IF NOT EXISTS idx_shift_assignments_external_id ON shift_assignments (external_id)
    WHERE external_id IS NOT NULL;

-- Unique constraint for dedup: one external_id per source_system per shift
ALTER TABLE shift_assignments ADD CONSTRAINT uq_shift_assignments_external
    UNIQUE (source_system, external_id);

-- 3. Expand connector_templates domain CHECK to include shift_management
-- Drop the existing CHECK and recreate with the new value
ALTER TABLE connector_templates DROP CONSTRAINT IF EXISTS connector_templates_domain_check;
ALTER TABLE connector_templates ADD CONSTRAINT connector_templates_domain_check
    CHECK (domain IN (
        'maintenance', 'equipment', 'access_control', 'erp_financial',
        'ticketing', 'environmental', 'lims_lab', 'regulatory',
        'shift_management', 'generic_file'
    ));
```

**IMPORTANT:** The CHECK constraint name may vary. Read the existing migration at `/home/io/io-dev/io/migrations/20260314000013_import.up.sql` to confirm the constraint name. PostgreSQL auto-names it `connector_templates_domain_check` for inline CHECK constraints, but if it was defined differently you need the correct name. Use `DROP CONSTRAINT IF EXISTS` to be safe.

### 2. NEW: `/home/io/io-dev/io/migrations/20260422000002_shift_management_import.down.sql`

```sql
-- Rollback shift management import support

ALTER TABLE shifts DROP CONSTRAINT IF EXISTS uq_shifts_external;
ALTER TABLE shifts DROP COLUMN IF EXISTS source_system;
ALTER TABLE shifts DROP COLUMN IF EXISTS external_id;
ALTER TABLE shifts DROP COLUMN IF EXISTS source;

ALTER TABLE shift_assignments DROP CONSTRAINT IF EXISTS uq_shift_assignments_external;
ALTER TABLE shift_assignments DROP COLUMN IF EXISTS source_system;
ALTER TABLE shift_assignments DROP COLUMN IF EXISTS external_id;

-- Restore original domain CHECK
ALTER TABLE connector_templates DROP CONSTRAINT IF EXISTS connector_templates_domain_check;
ALTER TABLE connector_templates ADD CONSTRAINT connector_templates_domain_check
    CHECK (domain IN (
        'maintenance', 'equipment', 'access_control', 'erp_financial',
        'ticketing', 'environmental', 'lims_lab', 'regulatory'
    ));
```

### 3. MODIFY: `/home/io/io-dev/io/services/import-service/src/pipeline.rs`

Add two new typed loaders. In the `load_records()` match block (~line 428), add two new arms BEFORE the fallback:

```rust
        "shifts" => load_shifts(executor, def_id, records, source_config).await,
        "shift_assignments" => load_shift_assignments(executor, def_id, records, source_config).await,
```

Then add these two functions. Follow the exact pattern of the existing `load_tickets()` function (field extraction, upsert with ON CONFLICT, error handling). Place them after the existing typed loaders (after `load_badge_events`), before the field extraction helpers.

**`load_shifts` function:**

```rust
async fn load_shifts(
    executor: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    _def_id: Uuid,
    records: &[MappedRecord],
    source_config: &JsonValue,
) -> Result<i64> {
    const KNOWN: &[&str] = &[
        "external_id", "name", "crew_name", "start_time", "end_time",
        "handover_minutes", "notes", "status", "employee_ids",
    ];
    let source_system = source_config
        .get("source_system")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown")
        .to_string();
    let id_field = source_config
        .get("id_field")
        .and_then(|v| v.as_str())
        .unwrap_or("external_id");

    let mut loaded: i64 = 0;
    for record in records {
        let external_id = field_str(record, id_field)
            .or_else(|| field_str(record, "external_id"))
            .unwrap_or_else(|| record.row_number.to_string());
        let name = field_str(record, "name")
            .unwrap_or_else(|| format!("Shift {}", &external_id));
        let start_time = match field_timestamp(record, "start_time") {
            Some(ts) => ts,
            None => {
                warn!(row = record.row_number, "shifts: skipping row missing start_time");
                continue;
            }
        };
        let end_time = match field_timestamp(record, "end_time") {
            Some(ts) => ts,
            None => {
                warn!(row = record.row_number, "shifts: skipping row missing end_time");
                continue;
            }
        };
        let handover_minutes = field_f64(record, "handover_minutes")
            .map(|v| v as i32)
            .unwrap_or(30);
        let notes = field_str(record, "notes");
        let status = normalize_shift_status(
            field_str(record, "status").as_deref().unwrap_or("scheduled"),
        );

        // Resolve crew_id from crew_name if provided
        let crew_name = field_str(record, "crew_name");
        let crew_id: Option<Uuid> = if let Some(ref cn) = crew_name {
            sqlx::query_scalar::<_, Uuid>("SELECT id FROM shift_crews WHERE name = $1")
                .bind(cn)
                .fetch_optional(&mut **executor)
                .await?
        } else {
            None
        };

        let result = sqlx::query(
            "INSERT INTO shifts \
             (name, crew_id, start_time, end_time, handover_minutes, notes, status, \
              source, source_system, external_id) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, 'external', $8, $9) \
             ON CONFLICT ON CONSTRAINT uq_shifts_external \
             DO UPDATE SET name = EXCLUDED.name, crew_id = EXCLUDED.crew_id, \
                 start_time = EXCLUDED.start_time, end_time = EXCLUDED.end_time, \
                 handover_minutes = EXCLUDED.handover_minutes, notes = EXCLUDED.notes, \
                 status = EXCLUDED.status",
        )
        .bind(&name)
        .bind(crew_id)
        .bind(start_time)
        .bind(end_time)
        .bind(handover_minutes)
        .bind(notes.as_deref())
        .bind(status)
        .bind(&source_system)
        .bind(&external_id)
        .execute(&mut **executor)
        .await;

        match result {
            Ok(_) => loaded += 1,
            Err(e) => {
                warn!(row = record.row_number, error = %e, "shifts load error");
                return Err(anyhow!("load error on row {}: {e}", record.row_number));
            }
        }
    }
    Ok(loaded)
}
```

**`load_shift_assignments` function:**

```rust
async fn load_shift_assignments(
    executor: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    _def_id: Uuid,
    records: &[MappedRecord],
    source_config: &JsonValue,
) -> Result<i64> {
    const KNOWN: &[&str] = &[
        "external_id", "shift_external_id", "employee_id", "role_label",
    ];
    let source_system = source_config
        .get("source_system")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown")
        .to_string();

    let mut loaded: i64 = 0;
    for record in records {
        let external_id = field_str(record, "external_id")
            .unwrap_or_else(|| record.row_number.to_string());

        // Resolve shift_id from the shift's external_id
        let shift_external_id = match field_str(record, "shift_external_id") {
            Some(s) => s,
            None => {
                warn!(row = record.row_number, "shift_assignments: missing shift_external_id");
                continue;
            }
        };
        let shift_id: Option<Uuid> = sqlx::query_scalar::<_, Uuid>(
            "SELECT id FROM shifts WHERE source_system = $1 AND external_id = $2",
        )
        .bind(&source_system)
        .bind(&shift_external_id)
        .fetch_optional(&mut **executor)
        .await?;
        let shift_id = match shift_id {
            Some(id) => id,
            None => {
                warn!(
                    row = record.row_number,
                    shift_external_id = %shift_external_id,
                    "shift_assignments: shift not found for external_id"
                );
                continue;
            }
        };

        // Resolve user_id from employee_id
        let employee_id = match field_str(record, "employee_id") {
            Some(e) => e,
            None => {
                warn!(row = record.row_number, "shift_assignments: missing employee_id");
                continue;
            }
        };
        let user_id: Option<Uuid> = sqlx::query_scalar::<_, Uuid>(
            "SELECT id FROM users WHERE employee_id = $1",
        )
        .bind(&employee_id)
        .fetch_optional(&mut **executor)
        .await?;
        let user_id = match user_id {
            Some(id) => id,
            None => {
                warn!(
                    row = record.row_number,
                    employee_id = %employee_id,
                    "shift_assignments: user not found for employee_id"
                );
                continue;
            }
        };

        let role_label = field_str(record, "role_label");

        let result = sqlx::query(
            "INSERT INTO shift_assignments \
             (shift_id, user_id, role_label, source, source_system, external_id) \
             VALUES ($1, $2, $3, 'external', $4, $5) \
             ON CONFLICT ON CONSTRAINT uq_shift_assignments_external \
             DO UPDATE SET shift_id = EXCLUDED.shift_id, user_id = EXCLUDED.user_id, \
                 role_label = EXCLUDED.role_label",
        )
        .bind(shift_id)
        .bind(user_id)
        .bind(role_label.as_deref())
        .bind(&source_system)
        .bind(&external_id)
        .execute(&mut **executor)
        .await;

        match result {
            Ok(_) => loaded += 1,
            Err(e) => {
                warn!(row = record.row_number, error = %e, "shift_assignments load error");
                return Err(anyhow!("load error on row {}: {e}", record.row_number));
            }
        }
    }
    Ok(loaded)
}
```

Also add this normalizer function near the other normalizers (~line 563):

```rust
fn normalize_shift_status(s: &str) -> &'static str {
    match s {
        "scheduled" => "scheduled",
        "active" => "active",
        "completed" => "completed",
        "cancelled" | "canceled" => "cancelled",
        _ => "scheduled",
    }
}
```

### 4. MODIFY: `/home/io/io-dev/io/services/import-service/src/main.rs`

In the `seed_connector_templates()` function, add shift_management templates to the `generic_templates` array (the `GenericTemplateSpec` array that starts around line 1168). Add these two entries:

```rust
        GenericTemplateSpec {
            slug: "generic-shift-csv",
            name: "Shift Schedule CSV Import",
            domain: "shift_management",
            vendor: "Generic",
            description: "Import shift schedules from a CSV file. Expected columns: shift_name, employee_id, start_time (ISO-8601), end_time (ISO-8601), role_label, crew_name, external_id.",
            target_tables: &["shifts", "shift_assignments"],
            required_fields: r##"[
                {"key":"file_id","label":"Uploaded File ID","placeholder":"UUID of the uploaded CSV file","type":"text"},
                {"key":"source_system","label":"Source System Name","placeholder":"e.g. kronos, sap","type":"text"},
                {"key":"delimiter","label":"Delimiter","type":"select","options":[
                    {"value":",","label":"Comma (,)"},
                    {"value":";","label":"Semicolon (;)"},
                    {"value":"|","label":"Pipe (|)"}
                ]}
            ]"##,
            template_config: r##"{
                "connection": {},
                "auth_type": "none",
                "auth_config": {},
                "definitions": [{
                    "name": "Shift Schedule CSV Import",
                    "source_config": {
                        "source_type": "csv_file",
                        "file_id": "{{file_id}}",
                        "delimiter": "{{delimiter}}",
                        "has_header": true,
                        "skip_rows": 0,
                        "source_system": "{{source_system}}"
                    },
                    "field_mappings": [
                        {"source": "shift_name", "target": "name"},
                        {"source": "employee_id", "target": "employee_id"},
                        {"source": "start_time", "target": "start_time"},
                        {"source": "end_time", "target": "end_time"},
                        {"source": "role_label", "target": "role_label"},
                        {"source": "crew_name", "target": "crew_name"},
                        {"source": "external_id", "target": "external_id"}
                    ],
                    "target_table": "shifts"
                }]
            }"##,
        },
        GenericTemplateSpec {
            slug: "generic-shift-rest",
            name: "Shift Schedule REST Import",
            domain: "shift_management",
            vendor: "Generic",
            description: "Import shift schedules from a REST API endpoint. Configure the endpoint URL, authentication, and JSON path to records array.",
            target_tables: &["shifts", "shift_assignments"],
            required_fields: r##"[
                {"key":"base_url","label":"Base URL","placeholder":"https://your-wfm-server/api","type":"text"},
                {"key":"endpoint","label":"Schedule Endpoint","placeholder":"/shifts","type":"text"},
                {"key":"records_path","label":"JSON Path to Records","placeholder":"data.shifts","type":"text"},
                {"key":"source_system","label":"Source System Name","placeholder":"e.g. kronos, custom","type":"text"},
                {"key":"username","label":"Username (optional)","type":"text"},
                {"key":"password","label":"Password (optional)","type":"secret"}
            ]"##,
            template_config: r##"{
                "connection": {
                    "base_url": "{{base_url}}"
                },
                "auth_type": "basic",
                "auth_config": {
                    "username": "{{username}}",
                    "password": "{{password}}"
                },
                "definitions": [{
                    "name": "Shift Schedule REST Import",
                    "source_config": {
                        "source_type": "generic_rest",
                        "endpoint": "{{endpoint}}",
                        "method": "GET",
                        "records_path": "{{records_path}}",
                        "pagination": "none",
                        "source_system": "{{source_system}}"
                    },
                    "field_mappings": [
                        {"source": "name", "target": "name"},
                        {"source": "employee_id", "target": "employee_id"},
                        {"source": "start_time", "target": "start_time"},
                        {"source": "end_time", "target": "end_time"},
                        {"source": "role_label", "target": "role_label"},
                        {"source": "crew_name", "target": "crew_name"},
                        {"source": "external_id", "target": "external_id"}
                    ],
                    "target_table": "shifts"
                }]
            }"##,
        },
```

## Verification Checklist

1. `cargo check -p io-import-service` compiles without errors
2. Migration files exist and have valid SQL syntax
3. `load_records()` match block includes `"shifts"` and `"shift_assignments"` arms
4. `load_shifts()` function: upserts into shifts with source='external', resolves crew_id from crew_name, requires start_time/end_time
5. `load_shift_assignments()` function: resolves shift_id from external_id+source_system, resolves user_id from employee_id
6. `normalize_shift_status()` normalizer function exists
7. Two new GenericTemplateSpec entries in seed function with domain="shift_management"
8. No new TODO/FIXME/stub comments introduced
9. `pnpm build` in frontend still passes (no frontend changes in this phase)
```

---

# PHASE 2 IMPLEMENTATION PROMPT

---

```
You are implementing Phase 2 of the Shift Management Connectors plan for the Inside/Operations (I/O) project. Your task is to build a custom `ukg_wfm` ETL connector for UKG Pro Workforce Management (formerly Kronos) and seed its connector template.

## Context

The import service at `/home/io/io-dev/io/services/import-service/` has an ETL connector registry in `src/connectors/etl/mod.rs`. Each connector type is a Rust file implementing the `EtlConnector` trait with three methods: `test_connection()`, `discover_schema()`, and `extract()`. The registry function `get_etl_connector()` maps string names to implementations.

Phase 1 (already completed) added:
- `shifts.source`, `shifts.external_id`, `shifts.source_system` columns
- `shift_assignments.external_id`, `shift_assignments.source_system` columns
- `load_shifts()` and `load_shift_assignments()` typed loaders in pipeline.rs
- `shift_management` in the connector_templates domain CHECK
- Generic CSV and REST shift templates

## EtlConnector Trait (from mod.rs)

```rust
#[async_trait::async_trait]
pub trait EtlConnector: Send + Sync {
    fn connector_type(&self) -> &'static str;
    async fn test_connection(&self, cfg: &EtlConnectorConfig) -> Result<()>;
    async fn discover_schema(&self, cfg: &EtlConnectorConfig) -> Result<Vec<SchemaTable>>;
    async fn extract(&self, cfg: &EtlConnectorConfig) -> Result<Vec<SourceRecord>>;
}
```

`EtlConnectorConfig` fields:
- `connection_config: JsonValue` — from `import_connections.config` (base_url, etc.)
- `auth_type: String` — from `import_connections.auth_type`
- `auth_config: JsonValue` — decrypted auth credentials
- `source_config: JsonValue` — from `import_definitions.source_config` (endpoint details)
- `watermark_state: Option<JsonValue>` — for delta sync

There is an existing `apply_auth_etl()` helper in mod.rs that handles basic, bearer_token, and api_key_header auth types. For UKG we need custom OAuth ROPC token acquisition, so we will NOT use `apply_auth_etl` — we'll handle auth internally.

## UKG Pro WFM API Details

**Authentication — OAuth 2.0 Resource Owner Password Credentials (ROPC):**
- Token endpoint: `POST https://{tenant}.mykronos.com/api/authentication/access_token`
- Body (form-encoded): `username={user}&password={pass}&client_id={id}&client_secret={secret}&grant_type=password&auth_chain=OAuthLdapService`
- Response: `{ "access_token": "...", "token_type": "Bearer", "expires_in": 3600, "scope": "..." }`
- Some tenants also require `appkey` header on all subsequent requests

**Schedule extraction — multi_read:**
- Endpoint: `POST /api/v1/scheduling/schedule/multi_read`
- Headers: `Authorization: Bearer {token}`, optionally `appkey: {key}`
- Body:
```json
{
    "where": {
        "employees": {
            "hyperfind": { "qualifier": "All Home" },
            "startDate": "2026-04-01",
            "endDate": "2026-04-08"
        },
        "excludeBreaks": true
    }
}
```
- Response:
```json
{
    "shifts": [
        {
            "startDateTime": "2026-04-01T06:00:00.000",
            "endDateTime": "2026-04-01T18:00:00.000",
            "label": "Day Shift",
            "employeeRef": { "id": 12345, "qualifier": "EMP001" },
            "segments": [
                { "orgJobRef": { "qualifier": "Unit Operator" } }
            ]
        }
    ],
    "employees": [
        {
            "personNumber": "EMP001",
            "personIdentity": { "firstName": "John", "lastName": "Doe" }
        }
    ]
}
```

**Employee data — multi_read:**
- Endpoint: `POST /api/v1/commons/data/multi_read`
- Body: `{ "keys": [{ "employee": { "hyperfind": { "qualifier": "All Home" } }, "properties": [{ "key": "EMP_COMMON_FULL_NAME" }, { "key": "EMP_COMMON_PERSON_NUMBER" }, { "key": "EMP_WORK_EMAIL" }] }] }`

**Rate limits:** HTTP 429 with Retry-After header; max 500 employees per request; max 365-day date range.

## Files to Create or Modify

### 1. NEW: `/home/io/io-dev/io/services/import-service/src/connectors/etl/ukg_wfm.rs`

Create this file implementing the `EtlConnector` trait for UKG Pro WFM.

**Structure:**

```rust
//! UKG Pro WFM (formerly Kronos) ETL connector.
//!
//! Implements OAuth 2.0 ROPC authentication and schedule extraction via
//! the UKG multi_read scheduling API.

use anyhow::{anyhow, Result};
use serde::Deserialize;
use serde_json::Value as JsonValue;
use tracing::{info, warn};

use super::{EtlConnector, EtlConnectorConfig};
use crate::handlers::import::{SchemaField, SchemaTable};
use crate::pipeline::SourceRecord;

pub struct UkgWfmConnector;
```

**Key implementation details:**

1. **`test_connection`**: Acquire an OAuth token (described below). If successful, connection is valid.

2. **Token acquisition** (private helper method):
   - Read from `auth_config`: `username`, `password`, `client_id`, `client_secret`
   - Read from `connection_config`: `base_url` (the `https://{tenant}.mykronos.com` URL), `app_key` (optional)
   - POST to `{base_url}/api/authentication/access_token` with form body
   - Parse response JSON for `access_token`
   - Return the token string

3. **`extract`**: 
   - Acquire token
   - Read `source_config` fields: `start_date`, `end_date`, `hyperfind_qualifier` (default "All Home")
   - If watermark_state exists and has `last_end_date`, use that as start_date for delta sync
   - POST to `{base_url}/api/v1/scheduling/schedule/multi_read` with the schedule query body
   - Parse `shifts` array from response
   - For each shift, produce a `SourceRecord` with fields:
     - `external_id`: composite `"{employeeRef.qualifier}_{startDateTime}"` (unique per shift assignment)
     - `name`: from `label` field
     - `start_time`: from `startDateTime` (convert to RFC-3339)
     - `end_time`: from `endDateTime` (convert to RFC-3339)
     - `employee_id`: from `employeeRef.qualifier` (the person number)
     - `role_label`: from first `segments[0].orgJobRef.qualifier` if present
     - `shift_external_id`: composite `"{label}_{startDateTime}"` (groups assignments into shifts)
   - Set `new_watermark` to `{ "last_end_date": "{end_date}" }` for delta sync
   - Return all records

4. **`discover_schema`**: Return a fixed schema listing the fields above.

5. **Date handling**: UKG returns dates like `"2026-04-01T06:00:00.000"` (no timezone). Treat as UTC or use a configurable timezone from `source_config.timezone`.

6. **App key**: If `connection_config.app_key` is set, add `appkey: {value}` header to all requests.

7. **HTTP client**: Use `reqwest::Client` with `danger_accept_invalid_certs(true)` (same pattern as `GenericRestConnector`).

### 2. MODIFY: `/home/io/io-dev/io/services/import-service/src/connectors/etl/mod.rs`

Add `pub mod ukg_wfm;` to the module declarations (after the existing `pub mod sql_postgres;` line).

In `get_etl_connector()`, add a new match arm:
```rust
        "ukg_wfm" => Some(Box::new(ukg_wfm::UkgWfmConnector)),
```

### 3. MODIFY: `/home/io/io-dev/io/services/import-service/src/main.rs`

Add a UKG template to the `generic_templates` array in `seed_connector_templates()`. Use `GenericTemplateSpec`:

```rust
        GenericTemplateSpec {
            slug: "ukg-pro-wfm-shifts",
            name: "UKG Pro WFM Shift Schedules",
            domain: "shift_management",
            vendor: "UKG (Kronos)",
            description: "Import shift schedules and personnel assignments from UKG Pro Workforce Management (formerly Kronos Workforce Central/Dimensions) via the REST API.",
            target_tables: &["shifts", "shift_assignments"],
            required_fields: r##"[
                {"key":"base_url","label":"UKG Tenant URL","placeholder":"https://your-tenant.mykronos.com","type":"text"},
                {"key":"username","label":"API Username","type":"text"},
                {"key":"password","label":"API Password","type":"secret"},
                {"key":"client_id","label":"OAuth Client ID","type":"text"},
                {"key":"client_secret","label":"OAuth Client Secret","type":"secret"},
                {"key":"app_key","label":"App Key (optional, older tenants)","type":"text"},
                {"key":"hyperfind","label":"Hyperfind Qualifier","placeholder":"All Home","type":"text"},
                {"key":"source_system","label":"Source System Name","placeholder":"ukg","type":"text"}
            ]"##,
            template_config: r##"{
                "connection": {
                    "base_url": "{{base_url}}",
                    "app_key": "{{app_key}}"
                },
                "auth_type": "custom_token",
                "auth_config": {
                    "username": "{{username}}",
                    "password": "{{password}}",
                    "client_id": "{{client_id}}",
                    "client_secret": "{{client_secret}}"
                },
                "definitions": [{
                    "name": "UKG Shift Schedules",
                    "source_config": {
                        "source_type": "ukg_wfm",
                        "hyperfind_qualifier": "{{hyperfind}}",
                        "source_system": "{{source_system}}"
                    },
                    "field_mappings": [
                        {"source": "name", "target": "name"},
                        {"source": "external_id", "target": "external_id"},
                        {"source": "start_time", "target": "start_time"},
                        {"source": "end_time", "target": "end_time"},
                        {"source": "employee_id", "target": "employee_id"},
                        {"source": "role_label", "target": "role_label"},
                        {"source": "shift_external_id", "target": "shift_external_id"}
                    ],
                    "target_table": "shifts"
                }]
            }"##,
        },
```

## Verification Checklist

1. `cargo check -p io-import-service` compiles without errors
2. New file `services/import-service/src/connectors/etl/ukg_wfm.rs` exists and implements `EtlConnector`
3. `get_etl_connector("ukg_wfm")` returns `Some(...)` (check the match arm in mod.rs)
4. UKG connector handles OAuth ROPC token acquisition
5. UKG connector extracts schedule data and produces SourceRecords with correct field names
6. UKG connector supports watermark-based delta sync via `last_end_date`
7. UKG template seeded with domain="shift_management" and source_type="ukg_wfm"
8. No new TODO/FIXME/stub comments introduced
9. No hardcoded credentials or secrets
```

---

# PHASE 3 IMPLEMENTATION PROMPT

---

```
You are implementing Phase 3 of the Shift Management Connectors plan for the Inside/Operations (I/O) project. Your task is to build a custom `shiftboard_jsonrpc` ETL connector for Shiftboard (JSON-RPC 2.0 with HMAC-SHA1 auth), and add an SAP SuccessFactors connector template (uses existing `generic_rest` connector with OData configuration).

## Context

The import service at `/home/io/io-dev/io/services/import-service/` has an ETL connector registry in `src/connectors/etl/mod.rs`. Phase 2 added the `ukg_wfm` connector as a reference for how custom connectors work. The existing `generic_rest` connector supports configurable pagination, JSONPath record extraction, and watermark delta sync.

Phase 1 added: typed loaders for `shifts` and `shift_assignments` in pipeline.rs, `shift_management` domain, generic templates.
Phase 2 added: `ukg_wfm` custom connector + template.

## EtlConnector Trait (from mod.rs)

```rust
#[async_trait::async_trait]
pub trait EtlConnector: Send + Sync {
    fn connector_type(&self) -> &'static str;
    async fn test_connection(&self, cfg: &EtlConnectorConfig) -> Result<()>;
    async fn discover_schema(&self, cfg: &EtlConnectorConfig) -> Result<Vec<SchemaTable>>;
    async fn extract(&self, cfg: &EtlConnectorConfig) -> Result<Vec<SourceRecord>>;
}
```

`EtlConnectorConfig` fields:
- `connection_config: JsonValue` — base_url, etc.
- `auth_type: String`
- `auth_config: JsonValue` — decrypted auth credentials
- `source_config: JsonValue` — endpoint details, source_system, etc.
- `watermark_state: Option<JsonValue>` — for delta sync

`SourceRecord` has: `row_number: i64`, `fields: HashMap<String, JsonValue>`, `raw: String`.

## Part A: Shiftboard JSON-RPC Connector

### Shiftboard API Details

**Protocol:** JSON-RPC 2.0 at `https://api.shiftboard.com/`

**Authentication — HMAC-SHA1 signature:**
Every request includes these headers/params:
- `access_key_id`: provided by Shiftboard (like an API username)
- `signature`: HMAC-SHA1 of `"method" + methodName + "params" + paramString`, signed with `secret_key`, base64-encoded
- The JSON-RPC body is: `{ "jsonrpc": "2.0", "method": "...", "params": {...}, "id": 1 }`
- The signature is computed over the concatenation: `"method"` + method name + `"params"` + JSON-serialized params (no whitespace)
- Add to request body as additional fields: `access_key_id` and `signature`

So the full request body looks like:
```json
{
    "jsonrpc": "2.0",
    "method": "shift.list",
    "params": {"start_date": "2026-04-01", "end_date": "2026-04-08", "page": {"batch": 25, "start": 1}},
    "id": 1,
    "access_key_id": "your_key_id",
    "signature": "base64_hmac_sha1_signature"
}
```

**Schedule endpoint — `shift.list`:**
- Params: `{ "start_date": "YYYY-MM-DD", "end_date": "YYYY-MM-DD", "page": { "batch": 25, "start": 1 } }`
- Response:
```json
{
    "jsonrpc": "2.0",
    "result": {
        "shifts": [
            {
                "id": "123456",
                "start_date": "2026-04-01 06:00:00",
                "end_date": "2026-04-01 18:00:00",
                "subject": "Day Shift - Unit 5",
                "workgroup": { "id": "789", "name": "Operations" },
                "location": { "id": "456", "name": "Refinery Unit 5" },
                "covering_member": {
                    "id": "111",
                    "first_name": "Jane",
                    "last_name": "Smith",
                    "screen_name": "jsmith",
                    "external_id": "EMP002"
                }
            }
        ],
        "page": { "this": 1, "next": 2, "batch": 25 }
    },
    "id": 1
}
```

**Delta sync — `shift.listUpdated`:**
- Params: `{ "updated_since": "YYYY-MM-DD HH:MM:SS", "page": { "batch": 25, "start": 1 } }`
- Same response shape as `shift.list`
- Use this for watermark-based incremental sync

**Pagination:** Check `result.page.next` — if present and not null, make another request with `"page": { "batch": 25, "start": next_value }`. If null/missing, no more pages.

### Files to Create

**`/home/io/io-dev/io/services/import-service/src/connectors/etl/shiftboard.rs`**

```rust
//! Shiftboard JSON-RPC 2.0 ETL connector.
//!
//! Implements HMAC-SHA1 signed requests to the Shiftboard API for
//! extracting shift schedules and personnel assignments.

use anyhow::{anyhow, Result};
use hmac::{Hmac, Mac};
use sha1::Sha1;
use base64::Engine as _;
use serde_json::Value as JsonValue;
use tracing::{info, warn};

use super::{EtlConnector, EtlConnectorConfig};
use crate::handlers::import::{SchemaField, SchemaTable};
use crate::pipeline::SourceRecord;

pub struct ShiftboardJsonRpcConnector;
```

**Key implementation details:**

1. **HMAC-SHA1 signature helper:**
```rust
fn compute_signature(method: &str, params: &JsonValue, secret_key: &str) -> Result<String> {
    let params_str = serde_json::to_string(params)?;
    let sign_data = format!("method{}params{}", method, params_str);
    type HmacSha1 = Hmac<Sha1>;
    let mut mac = HmacSha1::new_from_slice(secret_key.as_bytes())
        .map_err(|e| anyhow!("HMAC key error: {e}"))?;
    mac.update(sign_data.as_bytes());
    let result = mac.finalize();
    Ok(base64::engine::general_purpose::STANDARD.encode(result.into_bytes()))
}
```

2. **JSON-RPC request helper:**
```rust
async fn jsonrpc_call(
    client: &reqwest::Client,
    base_url: &str,
    method: &str,
    params: JsonValue,
    access_key_id: &str,
    secret_key: &str,
) -> Result<JsonValue> {
    let signature = compute_signature(method, &params, secret_key)?;
    let body = serde_json::json!({
        "jsonrpc": "2.0",
        "method": method,
        "params": params,
        "id": 1,
        "access_key_id": access_key_id,
        "signature": signature,
    });
    let resp = client.post(base_url)
        .json(&body)
        .send()
        .await?;
    // ... parse response, check for JSON-RPC error
}
```

3. **`test_connection`**: Call `shift.list` with a 1-day range and batch=1. If it returns without error, connection is valid.

4. **`extract`**: 
   - Read from `auth_config`: `access_key_id`, `secret_key`
   - Read from `connection_config`: `base_url` (default `https://api.shiftboard.com/`)
   - Read from `source_config`: `start_date`, `end_date`, `source_system`
   - Check watermark: if `watermark_state.updated_since` exists, use `shift.listUpdated` with that timestamp; otherwise use `shift.list` with date range
   - Paginate: follow `result.page.next` until null
   - For each shift object, produce a `SourceRecord` with fields:
     - `external_id`: shift `id` field (Shiftboard's unique shift ID)
     - `name`: from `subject`
     - `start_time`: from `start_date` (parse "YYYY-MM-DD HH:MM:SS" as UTC, output RFC-3339)
     - `end_time`: from `end_date`
     - `employee_id`: from `covering_member.external_id` (falls back to `covering_member.id`)
     - `role_label`: from `workgroup.name`
     - `shift_external_id`: same as `external_id` (one person per shift in Shiftboard)
     - `crew_name`: from `location.name` (optional mapping)
   - Set `new_watermark` to current UTC timestamp for `updated_since` on next run

5. **Crate dependencies**: You'll need `hmac`, `sha1`, and `base64` crates. Check `services/import-service/Cargo.toml` — if they're not already there, add them:
   - `hmac = "0.12"` (MIT)
   - `sha1 = "0.10"` (MIT/Apache-2.0)
   - `base64` should already be present (check first)

### Files to Modify

**`/home/io/io-dev/io/services/import-service/src/connectors/etl/mod.rs`**
Add: `pub mod shiftboard;`
Add match arm: `"shiftboard_jsonrpc" => Some(Box::new(shiftboard::ShiftboardJsonRpcConnector)),`

**`/home/io/io-dev/io/services/import-service/Cargo.toml`**
Add `hmac` and `sha1` if not present. Check existing deps first.

**`/home/io/io-dev/io/services/import-service/src/main.rs`**
Add Shiftboard template to `seed_connector_templates()`:

```rust
        GenericTemplateSpec {
            slug: "shiftboard-shifts",
            name: "Shiftboard SchedulePro Shifts",
            domain: "shift_management",
            vendor: "Shiftboard",
            description: "Import shift schedules from Shiftboard SchedulePro via JSON-RPC 2.0 API with HMAC-SHA1 authentication.",
            target_tables: &["shifts", "shift_assignments"],
            required_fields: r##"[
                {"key":"access_key_id","label":"Access Key ID","type":"text"},
                {"key":"secret_key","label":"Secret Key","type":"secret"},
                {"key":"base_url","label":"API Base URL","placeholder":"https://api.shiftboard.com/","type":"text"},
                {"key":"source_system","label":"Source System Name","placeholder":"shiftboard","type":"text"}
            ]"##,
            template_config: r##"{
                "connection": {
                    "base_url": "{{base_url}}"
                },
                "auth_type": "custom_token",
                "auth_config": {
                    "access_key_id": "{{access_key_id}}",
                    "secret_key": "{{secret_key}}"
                },
                "definitions": [{
                    "name": "Shiftboard Shift Schedules",
                    "source_config": {
                        "source_type": "shiftboard_jsonrpc",
                        "source_system": "{{source_system}}"
                    },
                    "field_mappings": [
                        {"source": "name", "target": "name"},
                        {"source": "external_id", "target": "external_id"},
                        {"source": "start_time", "target": "start_time"},
                        {"source": "end_time", "target": "end_time"},
                        {"source": "employee_id", "target": "employee_id"},
                        {"source": "role_label", "target": "role_label"},
                        {"source": "shift_external_id", "target": "shift_external_id"},
                        {"source": "crew_name", "target": "crew_name"}
                    ],
                    "target_table": "shifts"
                }]
            }"##,
        },
```

## Part B: SAP SuccessFactors Template

SAP SuccessFactors uses OData V2 REST, which the existing `generic_rest` connector can handle. We only need a template — no custom connector code.

**Add to `seed_connector_templates()` in main.rs:**

```rust
        GenericTemplateSpec {
            slug: "sap-sf-shift-schedules",
            name: "SAP SuccessFactors Work Schedules",
            domain: "shift_management",
            vendor: "SAP SE",
            description: "Import employee work schedules and roster data from SAP SuccessFactors Employee Central via OData V2 API.",
            target_tables: &["shifts", "shift_assignments"],
            required_fields: r##"[
                {"key":"api_server","label":"API Server","placeholder":"https://apiN.successfactors.com","type":"text"},
                {"key":"company_id","label":"Company ID (Tenant)","type":"text"},
                {"key":"username","label":"API Username","type":"text"},
                {"key":"password","label":"Password","type":"secret"},
                {"key":"source_system","label":"Source System Name","placeholder":"sap_sf","type":"text"}
            ]"##,
            template_config: r##"{
                "connection": {
                    "base_url": "{{api_server}}/odata/v2"
                },
                "auth_type": "basic",
                "auth_config": {
                    "username": "{{username}}@{{company_id}}",
                    "password": "{{password}}"
                },
                "definitions": [{
                    "name": "SAP SF Work Schedules",
                    "source_config": {
                        "source_type": "generic_rest",
                        "endpoint": "/EmpJob?$expand=workScheduleNav,userNav&$filter=emplStatus eq 'A'&$select=userId,startDate,department,jobTitle,workScheduleCode,workScheduleNav/externalCode,workScheduleNav/startTime,workScheduleNav/endTime,userNav/firstName,userNav/lastName&$format=json",
                        "method": "GET",
                        "records_path": "d.results",
                        "pagination": "offset_limit",
                        "page_size": 100,
                        "offset_param": "$skip",
                        "limit_param": "$top",
                        "source_system": "{{source_system}}",
                        "watermark": {
                            "type": "timestamp",
                            "column": "lastModifiedDateTime",
                            "filter_template": "&$filter=lastModifiedDateTime gt datetime'{{value}}'"
                        }
                    },
                    "field_mappings": [
                        {"source": "userId", "target": "employee_id"},
                        {"source": "workScheduleNav.externalCode", "target": "external_id"},
                        {"source": "workScheduleNav.startTime", "target": "start_time"},
                        {"source": "workScheduleNav.endTime", "target": "end_time"},
                        {"source": "jobTitle", "target": "role_label"},
                        {"source": "department", "target": "crew_name"},
                        {"source": "workScheduleCode", "target": "name"}
                    ],
                    "target_table": "shifts"
                }]
            }"##,
        },
```

## Verification Checklist

1. `cargo check -p io-import-service` compiles without errors
2. New file `services/import-service/src/connectors/etl/shiftboard.rs` exists and implements `EtlConnector`
3. `get_etl_connector("shiftboard_jsonrpc")` returns `Some(...)`
4. Shiftboard connector implements HMAC-SHA1 signature computation correctly
5. Shiftboard connector paginates via `result.page.next`
6. Shiftboard connector supports watermark delta sync via `shift.listUpdated`
7. `hmac` and `sha1` crates added to Cargo.toml (if not already present)
8. SAP SuccessFactors template uses `generic_rest` source_type with OData V2 config
9. Both templates have domain="shift_management"
10. No new TODO/FIXME/stub comments introduced
11. No hardcoded credentials or secrets
```

---

# PHASE 4 IMPLEMENTATION PROMPT

---

```
You are implementing Phase 4 of the Shift Management Connectors plan for the Inside/Operations (I/O) project. Your task is to add Oracle Primavera P6 EPPM and Hexagon j5 connector templates. Both use the existing `generic_rest` connector — no custom connector code needed. Additionally, j5 requires a new `shift_log_entries` table for storing imported logbook entries.

## Context

The import service at `/home/io/io-dev/io/services/import-service/` has:
- ETL connector registry with `generic_rest`, `ukg_wfm`, `shiftboard_jsonrpc` connectors
- Typed loaders in `pipeline.rs` for: tickets, work_orders, inventory_items, purchase_orders, vendor_master, badge_events, shifts, shift_assignments
- Connector template seeding in `main.rs` via `seed_connector_templates()` function using `GenericTemplateSpec` structs
- `shift_management` domain in the CHECK constraint

The `generic_rest` connector (`src/connectors/etl/rest.rs`) supports:
- Configurable `base_url` in connection config
- `endpoint`, `method` (GET/POST), `records_path` (JSONPath), `request_body` in source_config
- Pagination: `none`, `cursor` (follow a link field), `offset_limit` (offset+limit params)
- Auth via `apply_auth_etl()`: basic, bearer_token, api_key_header
- Watermark delta sync

## Oracle Primavera P6 EPPM Details

P6 is turnaround/maintenance scheduling. Activities map to shifts; resource assignments map to shift_assignments.

**Auth:** OAuth Bearer token — `POST /p6ws/oauth/token` with Basic Auth header → raw bearer token. Since P6 uses standard Bearer auth after token acquisition, the `generic_rest` connector's `bearer_token` auth type works (the user provides the token manually or we document the token acquisition step).

Alternatively, we use `basic` auth (P6 supports it for API access).

**Endpoints:**
- Projects: `GET /p6ws/restapi/project?Fields=ObjectId,Id,Name,Status&Filter=Status:eq:'Active'`
- Resource Assignments: `GET /p6ws/restapi/resourceAssignment?Fields=ResourceName,ActivityName,PlannedStartDate,PlannedFinishDate,ActualStartDate,ActualFinishDate,ResourceType&Filter=ProjectObjectId:eq:{id}:and:ResourceType:eq:'Labor'`
- Resources: `GET /p6ws/restapi/resource?Fields=ObjectId,Id,Name,ResourceType,EmailAddress,EmployeeId`

**Response format:** JSON array at root level (no wrapper object). Each object has the requested fields directly.

**Pagination:** No native pagination — use Filter by ObjectId ranges or date ranges.

## Hexagon j5 Details

j5 is a shift operations management system (logbook/handover), NOT a shift scheduling system. It doesn't have shift roster data. Integration is pulling logbook entries and correlating them to shifts by timestamp.

**Auth:** HTTP Basic Auth.

**Endpoints:**
- Logbook query: `GET /restserver/28.0/industraform/logbook-query-v2/{logbook_name}?attribute_names=...&from_date_time=...&to_date_time=...`
- Response: `{ "values": [{ "$Form.Area": "Unit 5", "$Form.Status": "Complete", "EventTime": "2026-04-01T14:30:00Z", "CreatedByUser.DisplayValue": "John Doe", ... }], "nextLink": "..." }`

**Pagination:** Follow `nextLink` URL until null.

**Data mapping:** j5 logbook entries map to a NEW `shift_log_entries` table (not directly to shifts/shift_assignments).

## Files to Create or Modify

### 1. NEW: `/home/io/io-dev/io/migrations/20260422000003_shift_log_entries.up.sql`

```sql
-- Phase: Shift Log Entries for j5 integration
-- Stores imported logbook entries from shift operations systems (e.g., Hexagon j5).
-- Entries are correlated to shifts by timestamp overlap.

CREATE TABLE IF NOT EXISTS shift_log_entries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_id        UUID REFERENCES shifts(id),
    external_id     VARCHAR(200),
    source_system   VARCHAR(100) NOT NULL DEFAULT 'unknown',
    entry_type      VARCHAR(50) NOT NULL DEFAULT 'logbook',  -- logbook, handover, rounds
    area            VARCHAR(200),
    author          VARCHAR(200),
    author_user_id  UUID REFERENCES users(id),
    event_time      TIMESTAMPTZ NOT NULL,
    summary         TEXT,
    details         JSONB,
    status          VARCHAR(30),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_shift_log_entries_shift_id ON shift_log_entries (shift_id) WHERE shift_id IS NOT NULL;
CREATE INDEX idx_shift_log_entries_event_time ON shift_log_entries (event_time DESC);
CREATE INDEX idx_shift_log_entries_source_system ON shift_log_entries (source_system);

-- Unique constraint for dedup on re-import
ALTER TABLE shift_log_entries ADD CONSTRAINT uq_shift_log_entries_external
    UNIQUE (source_system, external_id);
```

### 2. NEW: `/home/io/io-dev/io/migrations/20260422000003_shift_log_entries.down.sql`

```sql
DROP TABLE IF EXISTS shift_log_entries;
```

### 3. MODIFY: `/home/io/io-dev/io/services/import-service/src/pipeline.rs`

Add a new typed loader for `shift_log_entries`. In the `load_records()` match block, add:

```rust
        "shift_log_entries" => load_shift_log_entries(executor, def_id, records, source_config).await,
```

Add the loader function (follow the pattern of existing loaders):

```rust
async fn load_shift_log_entries(
    executor: &mut sqlx::Transaction<'_, sqlx::Postgres>,
    _def_id: Uuid,
    records: &[MappedRecord],
    source_config: &JsonValue,
) -> Result<i64> {
    const KNOWN: &[&str] = &[
        "external_id", "entry_type", "area", "author", "event_time",
        "summary", "status",
    ];
    let source_system = source_config
        .get("source_system")
        .and_then(|v| v.as_str())
        .unwrap_or("unknown")
        .to_string();

    let mut loaded: i64 = 0;
    for record in records {
        let external_id = field_str(record, "external_id")
            .unwrap_or_else(|| record.row_number.to_string());
        let event_time = match field_timestamp(record, "event_time") {
            Some(ts) => ts,
            None => {
                warn!(row = record.row_number, "shift_log_entries: skipping row missing event_time");
                continue;
            }
        };
        let entry_type = field_str(record, "entry_type").unwrap_or_else(|| "logbook".to_string());
        let area = field_str(record, "area");
        let author = field_str(record, "author");
        let summary = field_str(record, "summary");
        let status = field_str(record, "status");
        let details = field_json_extra(record, KNOWN);

        // Correlate to shift by timestamp: find active shift that overlaps event_time
        let shift_id: Option<Uuid> = sqlx::query_scalar::<_, Uuid>(
            "SELECT id FROM shifts WHERE start_time <= $1 AND end_time >= $1 \
             ORDER BY start_time DESC LIMIT 1",
        )
        .bind(event_time)
        .fetch_optional(&mut **executor)
        .await?;

        // Resolve author to user_id if possible
        let author_user_id: Option<Uuid> = if let Some(ref a) = author {
            sqlx::query_scalar::<_, Uuid>(
                "SELECT id FROM users WHERE display_name = $1 OR email = $1 LIMIT 1",
            )
            .bind(a)
            .fetch_optional(&mut **executor)
            .await?
        } else {
            None
        };

        let result = sqlx::query(
            "INSERT INTO shift_log_entries \
             (external_id, source_system, shift_id, entry_type, area, author, \
              author_user_id, event_time, summary, details, status) \
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) \
             ON CONFLICT ON CONSTRAINT uq_shift_log_entries_external \
             DO UPDATE SET shift_id = EXCLUDED.shift_id, area = EXCLUDED.area, \
                 author = EXCLUDED.author, author_user_id = EXCLUDED.author_user_id, \
                 summary = EXCLUDED.summary, details = EXCLUDED.details, \
                 status = EXCLUDED.status",
        )
        .bind(&external_id)
        .bind(&source_system)
        .bind(shift_id)
        .bind(&entry_type)
        .bind(area.as_deref())
        .bind(author.as_deref())
        .bind(author_user_id)
        .bind(event_time)
        .bind(summary.as_deref())
        .bind(&details)
        .bind(status.as_deref())
        .execute(&mut **executor)
        .await;

        match result {
            Ok(_) => loaded += 1,
            Err(e) => {
                warn!(row = record.row_number, error = %e, "shift_log_entries load error");
                return Err(anyhow!("load error on row {}: {e}", record.row_number));
            }
        }
    }
    Ok(loaded)
}
```

### 4. MODIFY: `/home/io/io-dev/io/services/import-service/src/main.rs`

Add P6 and j5 templates to `seed_connector_templates()`:

**Oracle Primavera P6:**

```rust
        GenericTemplateSpec {
            slug: "oracle-p6-turnaround-schedules",
            name: "Oracle Primavera P6 Turnaround Schedules",
            domain: "shift_management",
            vendor: "Oracle",
            description: "Import turnaround/shutdown craft labor schedules from Oracle Primavera P6 EPPM. Activities map to shifts; labor resource assignments map to personnel assignments.",
            target_tables: &["shifts", "shift_assignments"],
            required_fields: r##"[
                {"key":"server_url","label":"P6 Server URL","placeholder":"https://your-p6-server/p6ws/restapi","type":"text"},
                {"key":"username","label":"Username","type":"text"},
                {"key":"password","label":"Password","type":"secret"},
                {"key":"project_filter","label":"Project Filter (optional)","placeholder":"Status:eq:'Active'","type":"text"},
                {"key":"source_system","label":"Source System Name","placeholder":"oracle_p6","type":"text"}
            ]"##,
            template_config: r##"{
                "connection": {
                    "base_url": "{{server_url}}"
                },
                "auth_type": "basic",
                "auth_config": {
                    "username": "{{username}}",
                    "password": "{{password}}"
                },
                "definitions": [{
                    "name": "P6 Resource Assignments (Labor)",
                    "source_config": {
                        "source_type": "generic_rest",
                        "endpoint": "/resourceAssignment?Fields=ResourceName,ActivityName,PlannedStartDate,PlannedFinishDate,ActualStartDate,ActualFinishDate,ResourceType,ResourceObjectId&Filter=ResourceType:eq:'Labor'",
                        "method": "GET",
                        "records_path": "",
                        "pagination": "none",
                        "source_system": "{{source_system}}"
                    },
                    "field_mappings": [
                        {"source": "ActivityName", "target": "name"},
                        {"source": "ResourceObjectId", "target": "external_id"},
                        {"source": "PlannedStartDate", "target": "start_time"},
                        {"source": "PlannedFinishDate", "target": "end_time"},
                        {"source": "ResourceName", "target": "employee_id"},
                        {"source": "ActivityName", "target": "role_label"}
                    ],
                    "target_table": "shifts"
                }]
            }"##,
        },
```

**Hexagon j5:**

```rust
        GenericTemplateSpec {
            slug: "hexagon-j5-logbook",
            name: "Hexagon j5 Shift Logbook",
            domain: "shift_management",
            vendor: "Hexagon",
            description: "Import shift logbook entries, handover notes, and operator rounds from Hexagon j5 Operations Management Suite. Entries are correlated to shifts by timestamp.",
            target_tables: &["shift_log_entries"],
            required_fields: r##"[
                {"key":"server_url","label":"j5 Server URL","placeholder":"https://your-j5-server/restserver/28.0","type":"text"},
                {"key":"username","label":"Username","type":"text"},
                {"key":"password","label":"Password","type":"secret"},
                {"key":"logbook_name","label":"Logbook Name","placeholder":"general_logbook","type":"text"},
                {"key":"source_system","label":"Source System Name","placeholder":"hexagon_j5","type":"text"}
            ]"##,
            template_config: r##"{
                "connection": {
                    "base_url": "{{server_url}}"
                },
                "auth_type": "basic",
                "auth_config": {
                    "username": "{{username}}",
                    "password": "{{password}}"
                },
                "definitions": [{
                    "name": "j5 Logbook Entries",
                    "source_config": {
                        "source_type": "generic_rest",
                        "endpoint": "/industraform/logbook-query-v2/{{logbook_name}}?attribute_names=$Form.Area,$Form.Status,EventTime,CreatedByUser.DisplayValue,Summary",
                        "method": "GET",
                        "records_path": "values",
                        "pagination": "cursor",
                        "cursor_field": "nextLink",
                        "source_system": "{{source_system}}"
                    },
                    "field_mappings": [
                        {"source": "EventTime", "target": "event_time"},
                        {"source": "$Form.Area", "target": "area"},
                        {"source": "CreatedByUser.DisplayValue", "target": "author"},
                        {"source": "Summary", "target": "summary"},
                        {"source": "$Form.Status", "target": "status"}
                    ],
                    "target_table": "shift_log_entries"
                }]
            }"##,
        },
```

## Verification Checklist

1. `cargo check -p io-import-service` compiles without errors
2. Migration files exist: `20260422000003_shift_log_entries.up.sql` and `.down.sql`
3. `shift_log_entries` table DDL has: id, shift_id, external_id, source_system, entry_type, area, author, author_user_id, event_time, summary, details, status
4. `load_records()` match block includes `"shift_log_entries"` arm
5. `load_shift_log_entries()` correlates entries to shifts by timestamp overlap
6. Oracle P6 template: domain="shift_management", source_type="generic_rest", maps ResourceAssignment fields
7. Hexagon j5 template: domain="shift_management", source_type="generic_rest", target_table="shift_log_entries", uses cursor pagination
8. No new TODO/FIXME/stub comments introduced
9. Total connector templates in shift_management domain: 7 (generic-csv, generic-rest, ukg, shiftboard, sap-sf, oracle-p6, hexagon-j5)
```

---

# PHASE 5 IMPLEMENTATION PROMPT

---

```
You are implementing Phase 5 of the Shift Management Connectors plan for the Inside/Operations (I/O) project. Your task is to add frontend support for the shift_management import domain and make externally-imported shifts appear as read-only in the Shifts module UI.

## Context

The backend (Phases 1-4) has been completed:
- `shifts` table now has `source VARCHAR(30) DEFAULT 'manual'`, `external_id VARCHAR(200)`, `source_system VARCHAR(100)` columns
- `shift_assignments` table now has `external_id VARCHAR(200)`, `source_system VARCHAR(100)` columns
- 7 connector templates exist in domain="shift_management" (generic-shift-csv, generic-shift-rest, ukg-pro-wfm-shifts, shiftboard-shifts, sap-sf-shift-schedules, oracle-p6-turnaround-schedules, hexagon-j5-logbook)
- Typed loaders write to `shifts` with `source='external'`
- `shift_log_entries` table for j5 logbook data

The frontend Shifts module is at `/home/io/io-dev/io/frontend/src/pages/shifts/`. The Import settings page is at `/home/io/io-dev/io/frontend/src/pages/settings/Import.tsx`. The shifts API module is at `/home/io/io-dev/io/frontend/src/api/shifts.ts`.

## Files to Modify

### 1. MODIFY: `/home/io/io-dev/io/frontend/src/api/shifts.ts`

Add `source`, `external_id`, and `source_system` to the `Shift` interface:

Current Shift interface (around line 54):
```typescript
export interface Shift {
  id: string;
  name: string;
  crew_id: string | null;
  crew_name: string | null;
  pattern_id: string | null;
  start_time: string;
  end_time: string;
  handover_minutes: number;
  notes: string | null;
  status: "scheduled" | "active" | "completed" | "cancelled";
  created_at: string;
  created_by: string | null;
}
```

Change to:
```typescript
export interface Shift {
  id: string;
  name: string;
  crew_id: string | null;
  crew_name: string | null;
  pattern_id: string | null;
  start_time: string;
  end_time: string;
  handover_minutes: number;
  notes: string | null;
  status: "scheduled" | "active" | "completed" | "cancelled";
  source: string;
  source_system: string | null;
  external_id: string | null;
  created_at: string;
  created_by: string | null;
}
```

### 2. MODIFY: `/home/io/io-dev/io/services/api-gateway/src/handlers/shifts.rs`

The shifts handler's SQL queries need to include the new columns. Find all SELECT queries that read from the `shifts` table and add `source`, `source_system`, `external_id` to the column list. Also update the row struct and serialization.

Find the `ShiftRow` struct and add the new fields:
```rust
pub struct ShiftRow {
    // ... existing fields ...
    pub source: String,
    pub source_system: Option<String>,
    pub external_id: Option<String>,
}
```

Update the `row_to_shift()` or equivalent mapping function to extract these columns from the SQL row.

Update all `SELECT ... FROM shifts` queries to include `s.source, s.source_system, s.external_id`.

**IMPORTANT:** Read the actual file first to understand the exact query and struct patterns used. Do not guess — the struct and query patterns vary.

### 3. MODIFY: `/home/io/io-dev/io/frontend/src/pages/shifts/ShiftSchedule.tsx`

This component displays the shift schedule list/calendar. Add visual indicators for external shifts:

For each shift row or card displayed:
- If `shift.source === 'external'`, show a lock icon (use the Unicode lock character or an SVG) and a small badge showing the source system name
- External shifts should NOT have edit/delete action buttons

Add a helper component at the top of the file:

```typescript
function ExternalBadge({ shift }: { shift: Shift }) {
  if (shift.source !== "external") return null;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        padding: "2px 8px",
        borderRadius: 100,
        background: "rgba(99, 102, 241, 0.12)",
        color: "#6366f1",
        border: "1px solid rgba(99, 102, 241, 0.3)",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ fontSize: 12 }}>&#128274;</span>
      {shift.source_system || "External"}
    </span>
  );
}
```

In the shift list rendering, add the ExternalBadge next to the shift name. In the action buttons area, conditionally hide edit/delete when `shift.source === 'external'`.

### 4. MODIFY: `/home/io/io-dev/io/frontend/src/pages/shifts/ShiftScheduleEditor.tsx`

This is the shift creation/editing form. If the component receives a shift with `source === 'external'`, the form should:
- Show all fields as disabled/read-only
- Show a banner at the top: "This shift is managed by {source_system}. To modify it, update the source system and re-import."
- Hide the Save button

Find the form component and add a check at the top:

```typescript
const isExternal = shift?.source === "external";
```

Then conditionally disable form fields and show/hide the save button based on `isExternal`.

### 5. MODIFY: `/home/io/io-dev/io/frontend/src/pages/shifts/index.tsx`

In the main Shifts page that renders the shift list, ensure the `source` field from the API response is properly passed through to child components. If shifts are fetched and rendered as table rows, add the ExternalBadge to the name column.

### 6. MODIFY: `/home/io/io-dev/io/frontend/src/pages/settings/Import.tsx`

The Import settings page groups connector templates by domain. It likely has a domain label mapping object. Add the `shift_management` domain label.

Search for existing domain label mappings (look for strings like "maintenance", "equipment", "access_control" in the component). Add:

```typescript
shift_management: "Shift Management",
```

This ensures the 7 shift management templates appear under a "Shift Management" category header in the import settings.

## Verification Checklist

1. `pnpm build` in frontend passes without errors
2. `cargo check -p io-api-gateway` compiles without errors  
3. `Shift` TypeScript interface includes `source`, `source_system`, `external_id` fields
4. Shifts handler SQL queries include `source`, `source_system`, `external_id` in SELECT
5. External shifts show lock icon + source system badge in ShiftSchedule.tsx
6. External shifts cannot be edited/deleted in the UI
7. ShiftScheduleEditor shows read-only banner for external shifts
8. Import.tsx shows "Shift Management" domain label for shift_management templates
9. No new TODO/FIXME/stub comments introduced
10. `pnpm test` passes (or failures are in unrelated pre-existing files only)
```
