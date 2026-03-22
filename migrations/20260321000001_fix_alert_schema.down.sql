-- Reverse: remove added columns from alert_deliveries
-- (Cannot restore alert_instances as that data is gone)
ALTER TABLE alert_deliveries
    DROP COLUMN IF EXISTS recipient_name,
    DROP COLUMN IF EXISTS recipient_contact,
    DROP COLUMN IF EXISTS escalation_level,
    DROP COLUMN IF EXISTS delivered_at,
    DROP COLUMN IF EXISTS acknowledged_at,
    DROP COLUMN IF EXISTS external_id,
    DROP COLUMN IF EXISTS metadata;
