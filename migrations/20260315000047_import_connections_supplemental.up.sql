-- Migration: Add DCS supplemental connector support to import_connections
-- Supplemental connectors fill gaps left by OPC UA (alarms, EU, limits, descriptors)
-- using vendor REST APIs. They live in the Import module (domain: dcs_supplemental)
-- but are linked to a specific OPC UA source and labeled "Supplemental Point Data" in the UI.
-- See doc 17 § Supplemental Connectors and doc 24 § 3.2.1 DCS Supplemental Connectors.

ALTER TABLE import_connections
    ADD COLUMN IF NOT EXISTS point_source_id UUID REFERENCES point_sources(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS is_supplemental_connector BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE import_connections
    ADD CONSTRAINT chk_supplemental_has_source
        CHECK (NOT is_supplemental_connector OR point_source_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_import_connections_point_source
    ON import_connections(point_source_id)
    WHERE point_source_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_import_connections_supplemental
    ON import_connections(is_supplemental_connector)
    WHERE is_supplemental_connector = true;

COMMENT ON COLUMN import_connections.point_source_id IS
    'OPC UA source this connector supplements. NULL for general-purpose import connectors.';
COMMENT ON COLUMN import_connections.is_supplemental_connector IS
    'When true, this connector fills gaps left by OPC UA for a specific point_source. '
    'Labeled "Supplemental Point Data" in UI. Configured via Settings > Data Sources, '
    'not the Import wizard.';
