DROP INDEX IF EXISTS idx_design_objects_published;
ALTER TABLE design_objects DROP COLUMN IF EXISTS published;
