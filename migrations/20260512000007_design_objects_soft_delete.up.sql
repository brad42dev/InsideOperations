ALTER TABLE design_objects ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX idx_design_objects_deleted ON design_objects(deleted_at) WHERE deleted_at IS NOT NULL;
