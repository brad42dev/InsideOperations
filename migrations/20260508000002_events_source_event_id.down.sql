DROP INDEX IF EXISTS idx_events_source_event_id;
ALTER TABLE events DROP COLUMN IF EXISTS source_event_id;
