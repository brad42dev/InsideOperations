-- Rollback for 20260321000002_badge_poller_columns

DROP INDEX IF EXISTS idx_badge_events_dedup;

ALTER TABLE badge_events
    DROP COLUMN IF EXISTS external_event_id,
    DROP COLUMN IF EXISTS badge_id;

ALTER TABLE access_control_sources
    DROP COLUMN IF EXISTS last_poll_checkpoint,
    DROP COLUMN IF EXISTS consecutive_failures;
