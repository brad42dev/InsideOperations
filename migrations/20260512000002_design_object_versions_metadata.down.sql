ALTER TABLE design_object_versions
    DROP COLUMN IF EXISTS parent_version_number,
    DROP COLUMN IF EXISTS label,
    DROP COLUMN IF EXISTS deleted_at;
