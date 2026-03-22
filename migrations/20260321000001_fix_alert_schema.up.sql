-- Fix alert-service schema: migrate from alert_instances to spec-correct alerts table
-- The spec-correct `alerts` and `alert_deliveries` tables were already created in
-- migration 20260314000027_alerting. This migration cleans up the legacy
-- `alert_instances` table and its associated duplicate `alert_deliveries` entries
-- that referenced it, introduced by migration 20260315000040_alert_service.

-- Drop legacy delivery records that reference alert_instances (cascade handles rows)
-- Only drop if alert_instances still exists (idempotent guard)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'alert_instances'
    ) THEN
        -- Remove the old alert_deliveries foreign key constraint referencing alert_instances
        -- (The spec alert_deliveries from migration 27 references alerts(id), not alert_instances)
        -- Drop the old table; CASCADE removes the old deliveries rows referencing it
        DROP TABLE alert_instances CASCADE;
    END IF;
END$$;

-- Add missing columns to alert_deliveries if they were created by migration 40
-- without the spec columns (recipient_name, recipient_contact, escalation_level, etc.)
ALTER TABLE alert_deliveries
    ADD COLUMN IF NOT EXISTS recipient_name    VARCHAR(200),
    ADD COLUMN IF NOT EXISTS recipient_contact VARCHAR(300),
    ADD COLUMN IF NOT EXISTS escalation_level  SMALLINT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS delivered_at      TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS acknowledged_at   TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS external_id       VARCHAR(200),
    ADD COLUMN IF NOT EXISTS metadata          JSONB;

-- Ensure alert_deliveries.alert_id references alerts(id) (not alert_instances)
-- If the column was pointing elsewhere, fix it. This is a no-op if already correct.
-- (FK constraints are checked at insert time; we cannot ALTER FK inline easily,
--  so we drop and re-add if the constraint references the wrong table.)
DO $$
DECLARE
    ref_table TEXT;
BEGIN
    SELECT ccu.table_name INTO ref_table
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
    WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_name = 'alert_deliveries'
        AND kcu.column_name = 'alert_id'
    LIMIT 1;

    IF ref_table IS DISTINCT FROM 'alerts' THEN
        ALTER TABLE alert_deliveries
            DROP CONSTRAINT IF EXISTS alert_deliveries_alert_id_fkey;
        ALTER TABLE alert_deliveries
            ADD CONSTRAINT alert_deliveries_alert_id_fkey
            FOREIGN KEY (alert_id) REFERENCES alerts(id) ON DELETE CASCADE;
    END IF;
END$$;
