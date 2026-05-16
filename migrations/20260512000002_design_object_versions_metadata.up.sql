ALTER TABLE design_object_versions
    ADD COLUMN deleted_at TIMESTAMPTZ,
    ADD COLUMN label TEXT,
    ADD COLUMN parent_version_number INTEGER;
