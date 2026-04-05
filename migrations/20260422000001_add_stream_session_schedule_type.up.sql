-- Add 'stream_session' to import_schedules.schedule_type CHECK constraint
-- Required for SSE/WebSocket streaming sessions managed by the supervisor

ALTER TABLE import_schedules
    DROP CONSTRAINT IF EXISTS import_schedules_schedule_type_check;

ALTER TABLE import_schedules
    ADD CONSTRAINT import_schedules_schedule_type_check
    CHECK (schedule_type IN ('cron', 'interval', 'manual', 'file_arrival', 'webhook', 'dependency', 'stream_session'));
