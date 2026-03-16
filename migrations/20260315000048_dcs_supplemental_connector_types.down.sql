-- Rollback: Restore original connector_templates domain CHECK (remove dcs_supplemental)
-- Must remove seeded dcs_supplemental rows first or the re-added constraint will fail.
DELETE FROM connector_templates WHERE domain = 'dcs_supplemental';

ALTER TABLE connector_templates
    DROP CONSTRAINT IF EXISTS connector_templates_domain_check;

ALTER TABLE connector_templates
    ADD CONSTRAINT connector_templates_domain_check
        CHECK (domain IN (
            'maintenance', 'equipment', 'access_control', 'erp_financial',
            'ticketing', 'environmental', 'lims_lab', 'regulatory'
        ));
