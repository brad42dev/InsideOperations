CREATE TABLE IF NOT EXISTS change_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    target_type TEXT NOT NULL,
    label TEXT,
    row_count INTEGER NOT NULL DEFAULT 0,
    snapshot_data JSONB NOT NULL DEFAULT '[]',
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_change_snapshots_target_type ON change_snapshots(target_type);
CREATE INDEX idx_change_snapshots_created_at ON change_snapshots(created_at DESC);
