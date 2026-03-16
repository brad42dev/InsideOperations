-- Migration: Add 'dcs_supplemental' domain to connector_templates
-- and expand connector_type documentation for DCS supplemental connectors.
-- See doc 17 § Supplemental Connector Types and doc 24 § 3.2.1.
--
-- DCS supplemental connectors fill gaps left by OPC UA using vendor REST or ODBC sidecar:
--   Tier 1 REST: pi_web_api, experion_rest, siemens_sph_rest, wincc_oa_rest,
--               s800xa_rest, kepware_rest, canary_rest
--   Tier 2 ODBC sidecar: deltav_sidecar, s800xa_odbc, yokogawa_sidecar

-- connector_templates.domain: drop old CHECK and recreate with dcs_supplemental added
ALTER TABLE connector_templates
    DROP CONSTRAINT IF EXISTS connector_templates_domain_check;

ALTER TABLE connector_templates
    ADD CONSTRAINT connector_templates_domain_check
        CHECK (domain IN (
            'maintenance', 'equipment', 'access_control', 'erp_financial',
            'ticketing', 'environmental', 'lims_lab', 'regulatory',
            'dcs_supplemental'
        ));

COMMENT ON COLUMN connector_templates.domain IS
    'Template category. dcs_supplemental = supplements an OPC UA source '
    '(pi_web_api, experion_rest, siemens_sph_rest, wincc_oa_rest, s800xa_rest, '
    'kepware_rest, canary_rest, deltav_sidecar, s800xa_odbc, yokogawa_sidecar).';
