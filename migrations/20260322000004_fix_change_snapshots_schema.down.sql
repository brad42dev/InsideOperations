-- Revert fix_change_snapshots_schema migration
-- Restores target_type and label columns, removes spec-added columns

ALTER TABLE change_snapshots
    ADD COLUMN IF NOT EXISTS target_type TEXT,
    ADD COLUMN IF NOT EXISTS label TEXT;

UPDATE change_snapshots
SET target_type = table_name,
    label = description
WHERE target_type IS NULL;

ALTER TABLE change_snapshots
    DROP COLUMN IF EXISTS table_name,
    DROP COLUMN IF EXISTS snapshot_type,
    DROP COLUMN IF EXISTS description,
    DROP COLUMN IF EXISTS filter_criteria,
    DROP COLUMN IF EXISTS related_job_id;

DROP INDEX IF EXISTS idx_change_snapshots_table_name;
CREATE INDEX IF NOT EXISTS idx_change_snapshots_target_type ON change_snapshots(target_type);
