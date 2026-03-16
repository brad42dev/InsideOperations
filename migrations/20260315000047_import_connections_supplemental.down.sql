-- Rollback: Remove DCS supplemental connector columns from import_connections
ALTER TABLE import_connections
    DROP CONSTRAINT IF EXISTS chk_supplemental_has_source;

DROP INDEX IF EXISTS idx_import_connections_supplemental;
DROP INDEX IF EXISTS idx_import_connections_point_source;

ALTER TABLE import_connections
    DROP COLUMN IF EXISTS is_supplemental_connector,
    DROP COLUMN IF EXISTS point_source_id;
