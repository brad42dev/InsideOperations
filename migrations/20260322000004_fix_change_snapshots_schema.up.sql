-- Fix change_snapshots table to match spec schema (design-docs/25_EXPORT_SYSTEM.md §12.2)
--
-- The original migration 22 defined the correct schema with `table_name`.
-- Migration 45 added `target_type`, `label`, and `snapshot_data` columns that
-- diverged from the spec. This migration aligns the table with the spec by:
--   1. Adding `table_name` (populated from existing `target_type`)
--   2. Adding `snapshot_type`, `description`, `filter_criteria`, `related_job_id`
--   3. Dropping the non-spec `target_type` and `label` columns
--   Note: `snapshot_data` is retained as it is actively used by the bulk-update handler
--         for JSONB snapshot storage (used in restore operations).

-- Step 1: Add the spec-required columns (if not already present)
ALTER TABLE change_snapshots
    ADD COLUMN IF NOT EXISTS table_name VARCHAR(100),
    ADD COLUMN IF NOT EXISTS snapshot_type VARCHAR(20) NOT NULL DEFAULT 'manual'
        CHECK (snapshot_type IN ('automatic', 'manual')),
    ADD COLUMN IF NOT EXISTS description TEXT,
    ADD COLUMN IF NOT EXISTS filter_criteria JSONB,
    ADD COLUMN IF NOT EXISTS related_job_id UUID REFERENCES export_jobs(id) ON DELETE SET NULL;

-- Step 2: Populate table_name from target_type (for existing rows)
UPDATE change_snapshots
SET table_name = COALESCE(target_type, 'unknown')
WHERE table_name IS NULL;

-- Step 3: Make table_name NOT NULL now that it's populated
ALTER TABLE change_snapshots
    ALTER COLUMN table_name SET NOT NULL;

-- Step 4: Populate description from label (for existing rows)
UPDATE change_snapshots
SET description = label
WHERE description IS NULL AND label IS NOT NULL;

-- Step 5: Drop the non-spec columns that have been superseded
ALTER TABLE change_snapshots
    DROP COLUMN IF EXISTS target_type,
    DROP COLUMN IF EXISTS label;

-- Step 6: Add index on table_name (replacing old target_type index)
DROP INDEX IF EXISTS idx_change_snapshots_target_type;
CREATE INDEX IF NOT EXISTS idx_change_snapshots_table_name ON change_snapshots(table_name);
