-- Remove built_in flag from alert_templates
ALTER TABLE alert_templates
    DROP COLUMN IF EXISTS built_in;
