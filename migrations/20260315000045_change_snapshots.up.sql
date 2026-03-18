-- Add target_type and snapshot_data columns to change_snapshots (created in migration 22)
ALTER TABLE change_snapshots
    ADD COLUMN IF NOT EXISTS target_type TEXT,
    ADD COLUMN IF NOT EXISTS label TEXT,
    ADD COLUMN IF NOT EXISTS snapshot_data JSONB NOT NULL DEFAULT '[]';

CREATE INDEX IF NOT EXISTS idx_change_snapshots_target_type ON change_snapshots(target_type);
CREATE INDEX IF NOT EXISTS idx_change_snapshots_created_at ON change_snapshots(created_at DESC);
