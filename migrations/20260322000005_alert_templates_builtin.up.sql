-- Add built_in flag to alert_templates so the system can prevent deletion of
-- the 14 shipped templates. Existing rows default to false (custom templates).
ALTER TABLE alert_templates
    ADD COLUMN IF NOT EXISTS built_in BOOLEAN NOT NULL DEFAULT false;
