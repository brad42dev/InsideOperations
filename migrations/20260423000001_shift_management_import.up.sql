-- Phase: Shift Management Import Support
-- Adds external shift source tracking and expands connector template domains.

-- 1. Add source + external_id to shifts table for dedup of externally imported shifts
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS source VARCHAR(30) NOT NULL DEFAULT 'manual';
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS external_id VARCHAR(200);
ALTER TABLE shifts ADD COLUMN IF NOT EXISTS source_system VARCHAR(100);

-- Index for watermark-based delta sync queries
CREATE INDEX IF NOT EXISTS idx_shifts_source ON shifts (source) WHERE source != 'manual';
CREATE INDEX IF NOT EXISTS idx_shifts_external_id ON shifts (external_id) WHERE external_id IS NOT NULL;

-- Unique constraint for dedup: one external_id per source_system
ALTER TABLE shifts ADD CONSTRAINT uq_shifts_external
    UNIQUE (source_system, external_id);

-- 2. Add external_id to shift_assignments for dedup
ALTER TABLE shift_assignments ADD COLUMN IF NOT EXISTS external_id VARCHAR(200);
ALTER TABLE shift_assignments ADD COLUMN IF NOT EXISTS source_system VARCHAR(100);
CREATE INDEX IF NOT EXISTS idx_shift_assignments_external_id ON shift_assignments (external_id)
    WHERE external_id IS NOT NULL;

-- Unique constraint for dedup: one external_id per source_system per shift
ALTER TABLE shift_assignments ADD CONSTRAINT uq_shift_assignments_external
    UNIQUE (source_system, external_id);

-- 3. Expand connector_templates domain CHECK to include shift_management
ALTER TABLE connector_templates DROP CONSTRAINT IF EXISTS connector_templates_domain_check;
ALTER TABLE connector_templates ADD CONSTRAINT connector_templates_domain_check
    CHECK (domain IN (
        'maintenance', 'equipment', 'access_control', 'erp_financial',
        'ticketing', 'environmental', 'lims_lab', 'regulatory',
        'dcs_supplemental',
        'generic_api', 'generic_file', 'generic_database',
        'shift_management'
    ));
