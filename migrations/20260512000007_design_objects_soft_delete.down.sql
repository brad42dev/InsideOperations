DROP INDEX IF EXISTS idx_design_objects_deleted;
ALTER TABLE design_objects DROP COLUMN IF EXISTS deleted_at;
