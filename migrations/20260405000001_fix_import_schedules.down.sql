DROP INDEX IF EXISTS idx_import_schedules_next_run;
DROP INDEX IF EXISTS idx_import_schedules_config_gin;

ALTER TABLE import_connections
    DROP COLUMN IF EXISTS supplemental_last_event_count,
    DROP COLUMN IF EXISTS supplemental_last_metadata_count,
    DROP COLUMN IF EXISTS supplemental_last_error,
    DROP COLUMN IF EXISTS supplemental_last_polled_at;

ALTER TABLE import_runs
    DROP CONSTRAINT IF EXISTS import_runs_triggered_by_check;
ALTER TABLE import_runs
    ADD CONSTRAINT import_runs_triggered_by_check
    CHECK (triggered_by IN ('manual', 'schedule', 'webhook', 'file_arrival', 'dependency', 'retry'));

ALTER TABLE import_schedules
    DROP COLUMN IF EXISTS last_heartbeat_at,
    DROP COLUMN IF EXISTS running,
    DROP COLUMN IF EXISTS timezone,
    DROP COLUMN IF EXISTS watch_pattern,
    DROP COLUMN IF EXISTS watch_path,
    DROP COLUMN IF EXISTS interval_seconds,
    DROP COLUMN IF EXISTS cron_expression;

ALTER TABLE import_schedules RENAME COLUMN definition_id TO import_definition_id;
