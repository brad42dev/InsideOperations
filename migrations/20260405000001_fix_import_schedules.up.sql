-- Phase A: Fix broken import_schedules schema + add DCS health columns
-- Authority: docs/research/connector-behavior/00_MASTER_SYNTHESIS.md §4a, §11

-- 1. Rename import_definition_id -> definition_id on import_schedules
--    Code and design docs both use definition_id; DDL column name was the outlier
ALTER TABLE import_schedules RENAME COLUMN import_definition_id TO definition_id;

-- 2. Add missing columns that the scheduler code already references
ALTER TABLE import_schedules
    ADD COLUMN IF NOT EXISTS cron_expression    VARCHAR(100),
    ADD COLUMN IF NOT EXISTS interval_seconds   INTEGER,
    ADD COLUMN IF NOT EXISTS watch_path         VARCHAR(500),
    ADD COLUMN IF NOT EXISTS watch_pattern      VARCHAR(255),
    ADD COLUMN IF NOT EXISTS timezone           VARCHAR(50) DEFAULT 'UTC',
    ADD COLUMN IF NOT EXISTS running            BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS last_heartbeat_at  TIMESTAMPTZ;

-- 3. Backfill cron_expression and interval_seconds from schedule_config JSONB
--    for any existing schedule rows
UPDATE import_schedules
   SET cron_expression = schedule_config->>'expression'
 WHERE schedule_type = 'cron'
   AND cron_expression IS NULL
   AND schedule_config->>'expression' IS NOT NULL;

UPDATE import_schedules
   SET interval_seconds = (schedule_config->>'interval_seconds')::INTEGER
 WHERE schedule_type = 'interval'
   AND interval_seconds IS NULL
   AND schedule_config->>'interval_seconds' IS NOT NULL;

-- 4. Fix triggered_by CHECK constraint on import_runs
--    Code currently writes 'scheduled' but the original constraint only allows 'schedule'.
--    Expand to allow both values; new code will use 'schedule'.
ALTER TABLE import_runs
    DROP CONSTRAINT IF EXISTS import_runs_triggered_by_check;
ALTER TABLE import_runs
    ADD CONSTRAINT import_runs_triggered_by_check
    CHECK (triggered_by IN ('manual', 'schedule', 'scheduled', 'webhook', 'file_arrival', 'dependency', 'retry'));

-- 5. Add DCS supplemental connector health columns to import_connections
ALTER TABLE import_connections
    ADD COLUMN IF NOT EXISTS supplemental_last_polled_at       TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS supplemental_last_error           TEXT,
    ADD COLUMN IF NOT EXISTS supplemental_last_metadata_count  INTEGER,
    ADD COLUMN IF NOT EXISTS supplemental_last_event_count     INTEGER;

-- 6. Add GIN index on schedule_config for dependency schedule lookups (future use)
CREATE INDEX IF NOT EXISTS idx_import_schedules_config_gin
    ON import_schedules USING gin (schedule_config);

-- 7. Index for scheduler polling performance
CREATE INDEX IF NOT EXISTS idx_import_schedules_next_run
    ON import_schedules (next_run_at)
    WHERE enabled = true AND running = false;
