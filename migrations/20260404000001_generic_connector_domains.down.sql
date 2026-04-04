-- Remove generic connector domains from the connector_templates domain CHECK constraint.
ALTER TABLE connector_templates
    DROP CONSTRAINT IF EXISTS connector_templates_domain_check;

ALTER TABLE connector_templates
    ADD CONSTRAINT connector_templates_domain_check
        CHECK (domain IN (
            'maintenance', 'equipment', 'access_control', 'erp_financial',
            'ticketing', 'environmental', 'lims_lab', 'regulatory',
            'dcs_supplemental'
        ));
