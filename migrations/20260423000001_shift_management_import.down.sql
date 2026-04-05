-- Rollback shift management import support

ALTER TABLE shifts DROP CONSTRAINT IF EXISTS uq_shifts_external;
DROP INDEX IF EXISTS idx_shifts_source;
DROP INDEX IF EXISTS idx_shifts_external_id;
ALTER TABLE shifts DROP COLUMN IF EXISTS source_system;
ALTER TABLE shifts DROP COLUMN IF EXISTS external_id;
ALTER TABLE shifts DROP COLUMN IF EXISTS source;

ALTER TABLE shift_assignments DROP CONSTRAINT IF EXISTS uq_shift_assignments_external;
DROP INDEX IF EXISTS idx_shift_assignments_external_id;
ALTER TABLE shift_assignments DROP COLUMN IF EXISTS source_system;
ALTER TABLE shift_assignments DROP COLUMN IF EXISTS external_id;

-- Restore previous domain CHECK (without shift_management)
ALTER TABLE connector_templates DROP CONSTRAINT IF EXISTS connector_templates_domain_check;
ALTER TABLE connector_templates ADD CONSTRAINT connector_templates_domain_check
    CHECK (domain IN (
        'maintenance', 'equipment', 'access_control', 'erp_financial',
        'ticketing', 'environmental', 'lims_lab', 'regulatory',
        'dcs_supplemental',
        'generic_api', 'generic_file', 'generic_database'
    ));
