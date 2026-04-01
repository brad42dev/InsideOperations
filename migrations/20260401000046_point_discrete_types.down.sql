ALTER TABLE points_metadata_versions DROP COLUMN IF EXISTS point_category;
DROP TABLE IF EXISTS point_enum_labels;
ALTER TABLE points_metadata DROP COLUMN IF EXISTS point_category;
