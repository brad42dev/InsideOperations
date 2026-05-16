UPDATE design_object_versions SET version_type = 'draft' WHERE version_type = 'save';
ALTER TABLE design_object_versions DROP CONSTRAINT IF EXISTS design_object_versions_version_type_check;
ALTER TABLE design_object_versions ADD CONSTRAINT design_object_versions_version_type_check CHECK (version_type IN ('draft', 'publish'));
