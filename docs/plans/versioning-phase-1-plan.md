# Versioning Phase 1 — Schema Foundation: Implementation Plan

## Overview

This plan covers four database migrations and verification of an existing iographic.rs bug fix. No frontend changes. No new API handlers. Schema only.

**Architecture reference:** `docs/architecture/versioning-and-publishing.md`

---

## File Inventory

**Files to create (8 total):**

1. `migrations/20260512000001_design_objects_published.up.sql`
2. `migrations/20260512000001_design_objects_published.down.sql`
3. `migrations/20260512000002_design_object_versions_metadata.up.sql`
4. `migrations/20260512000002_design_object_versions_metadata.down.sql`
5. `migrations/20260512000003_workspace_versions.up.sql`
6. `migrations/20260512000003_workspace_versions.down.sql`
7. `migrations/20260512000004_saved_charts.up.sql`
8. `migrations/20260512000004_saved_charts.down.sql`

**Files to verify (no changes needed):**

9. `services/api-gateway/src/handlers/iographic.rs` — bug fix already committed; verify it compiles

**Timestamp note:** The latest existing migration is `20260511000001`. These migrations use `20260512` as the next date. If running on a different day, adjust the date prefix, but preserve the sequence numbers `000001` through `000004` and their ordering.

---

## Migration 1: Add `published` column to `design_objects`

**File:** `migrations/20260512000001_design_objects_published.up.sql`

```sql
ALTER TABLE design_objects
    ADD COLUMN published BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX idx_design_objects_published
    ON design_objects(published) WHERE published = true;
```

**File:** `migrations/20260512000001_design_objects_published.down.sql`

```sql
DROP INDEX IF EXISTS idx_design_objects_published;
ALTER TABLE design_objects DROP COLUMN IF EXISTS published;
```

**Notes:**
- `NOT NULL DEFAULT false` — PostgreSQL backfills existing rows with the default in a single pass, safe for ALTER.
- Partial index only indexes `published = true` rows (a small fraction of all objects).

---

## Migration 2: Add version metadata columns to `design_object_versions`

**File:** `migrations/20260512000002_design_object_versions_metadata.up.sql`

```sql
ALTER TABLE design_object_versions
    ADD COLUMN deleted_at TIMESTAMPTZ,
    ADD COLUMN label TEXT,
    ADD COLUMN parent_version_number INTEGER;
```

**File:** `migrations/20260512000002_design_object_versions_metadata.down.sql`

```sql
ALTER TABLE design_object_versions
    DROP COLUMN IF EXISTS parent_version_number,
    DROP COLUMN IF EXISTS label,
    DROP COLUMN IF EXISTS deleted_at;
```

**Notes:**
- All three columns nullable — no backfill needed for existing rows.
- `deleted_at` enables soft-delete. NULL = not deleted.
- `label` is optional user notes. v1 auto-labeled "Original" by application code in Task 2 (not by migration).
- `parent_version_number` tracks which version was live when this snapshot was created. NULL for v1.
- The existing `metadata JSONB` column (already on the table) stores computed stats (`element_count`, `binding_count`) — no schema change needed.

---

## Migration 3: Create `workspace_versions` table

**File:** `migrations/20260512000003_workspace_versions.up.sql`

```sql
CREATE TABLE workspace_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    version_type VARCHAR(10) NOT NULL CHECK (version_type IN ('save', 'publish')),
    layout JSONB NOT NULL,
    label TEXT,
    parent_version_number INTEGER,
    metadata JSONB,
    deleted_at TIMESTAMPTZ,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (workspace_id, version_number)
);

CREATE INDEX idx_workspace_versions_workspace ON workspace_versions(workspace_id);
```

**File:** `migrations/20260512000003_workspace_versions.down.sql`

```sql
DROP TABLE IF EXISTS workspace_versions;
```

**Notes:**
- FK to `workspaces(id)` — confirmed to exist in `migrations/20260314000009_graphics_workspaces.up.sql` line 33.
- FK to `users(id)` — confirmed to exist in `migrations/20260314000003_auth_core.up.sql`.
- `ON DELETE CASCADE` on `workspace_id` — deleting a workspace deletes all its versions.
- No cascade on `created_by` — deleting a user must not delete workspace versions.
- `UNIQUE (workspace_id, version_number)` prevents duplicate version numbers per workspace.
- `version_type` CHECK uses `('save', 'publish')`. Note: the existing `design_object_versions` table uses `('draft', 'publish')` — this discrepancy will be reconciled in Task 2.

---

## Migration 4: Create `saved_charts` table

**File:** `migrations/20260512000004_saved_charts.up.sql`

```sql
CREATE TABLE saved_charts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    chart_type INTEGER NOT NULL,
    config JSONB NOT NULL,
    published BOOLEAN NOT NULL DEFAULT false,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_saved_charts_created_by ON saved_charts(created_by);
CREATE INDEX idx_saved_charts_published ON saved_charts(published) WHERE published = true;

CREATE TRIGGER trg_saved_charts_updated_at
    BEFORE UPDATE ON saved_charts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

**File:** `migrations/20260512000004_saved_charts.down.sql`

```sql
DROP TRIGGER IF EXISTS trg_saved_charts_updated_at ON saved_charts;
DROP TABLE IF EXISTS saved_charts;
```

**Notes:**
- FK to `users(id)` with `ON DELETE CASCADE` — deleting a user deletes their saved charts.
- `update_updated_at_column()` trigger function is defined in `migrations/20260314000002_functions.up.sql`.
- Partial index on `published` matches the pattern used for `design_objects`.
- `chart_type INTEGER` matches the existing chart type enum used in the frontend `savedChartsStore.ts`.
- `config JSONB` stores the full chart configuration.

---

## Bug Fix Verification: iographic.rs

**Status: Already fixed and committed.**

The INSERT at `services/api-gateway/src/handlers/iographic.rs` ~line 3034 now correctly uses:
- `design_object_id` (was `graphic_id`)
- `version_number` (was `version`)
- `svg_data` included (was missing — NOT NULL column)

The fix is in the committed codebase. No code changes are needed in this phase.

**Action:** Run `cargo build -p io-api-gateway` to confirm the existing fix compiles clean.

**Secondary finding (log for Task 2):** Around line 2819, the code sets `version_type = "published"` when `import_as == "published"`, but the CHECK constraint on `design_object_versions` only allows `('draft', 'publish')`. The value `"published"` violates the CHECK constraint, causing the INSERT to fail silently (caught as a non-fatal warning). Fix in Task 2 by changing `"published"` to `"publish"`.

---

## Verification Steps

```bash
# 1. Ensure DB is running
docker compose up -d

# 2. Run pending migrations
sqlx migrate run

# 3. Spot-check schema in psql
psql postgresql://io:io_password@localhost:5432/io_dev

# Check published column on design_objects
\d design_objects
-- Should show: published | boolean | not null | default false

# Check new columns on design_object_versions
\d design_object_versions
-- Should show: deleted_at, label, parent_version_number columns

# Check workspace_versions table
\d workspace_versions

# Check saved_charts table
\d saved_charts

# Check indexes
SELECT indexname, indexdef FROM pg_indexes
WHERE indexname IN (
    'idx_design_objects_published',
    'idx_workspace_versions_workspace',
    'idx_saved_charts_created_by',
    'idx_saved_charts_published'
);

\q

# 4. Compile check
BINDGEN_EXTRA_CLANG_ARGS="-I/usr/lib/gcc/x86_64-linux-gnu/13/include" cargo build -p io-api-gateway
```

---

## Implementation Checklist

- [ ] Create `migrations/20260512000001_design_objects_published.up.sql`
- [ ] Create `migrations/20260512000001_design_objects_published.down.sql`
- [ ] Create `migrations/20260512000002_design_object_versions_metadata.up.sql`
- [ ] Create `migrations/20260512000002_design_object_versions_metadata.down.sql`
- [ ] Create `migrations/20260512000003_workspace_versions.up.sql`
- [ ] Create `migrations/20260512000003_workspace_versions.down.sql`
- [ ] Create `migrations/20260512000004_saved_charts.up.sql`
- [ ] Create `migrations/20260512000004_saved_charts.down.sql`
- [ ] Run `sqlx migrate run` — all 4 migrations apply cleanly with no errors
- [ ] Verify `design_objects.published` column exists (`NOT NULL DEFAULT false`)
- [ ] Verify `design_object_versions` has `deleted_at`, `label`, `parent_version_number` columns
- [ ] Verify `workspace_versions` table exists with all columns, constraints, and index
- [ ] Verify `saved_charts` table exists with all columns, indexes, and trigger
- [ ] Run `cargo build -p io-api-gateway` — compiles clean (no iographic.rs source changes needed)
- [ ] Commit all 8 migration files

---

## Known Issues for Future Phases

1. **`version_type` CHECK discrepancy:** `design_object_versions` uses `('draft', 'publish')` while `workspace_versions` uses `('save', 'publish')`. Task 2 should decide whether to ALTER the existing constraint on `design_object_versions` to align with `('save', 'publish')`, or preserve `'draft'` for backward compatibility.

2. **iographic.rs `"published"` value bug:** Line ~2819 sets `version_type = "published"` but the CHECK only allows `"publish"`. This causes silent version row insert failures when importing as published. Fix in Task 2 by changing the string literal `"published"` to `"publish"`.
