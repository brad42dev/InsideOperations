-- Phase 15 / DD-30-001: Add columns required by the badge polling engine.
--
-- access_control_sources gets:
--   last_poll_checkpoint   — most-recent event timestamp used as the `since`
--                            parameter on the next poll cycle
--   consecutive_failures   — incremented on each adapter error, reset to 0
--                            on a successful poll
--
-- badge_events gets:
--   external_event_id      — the vendor-assigned ID of this event (used for
--                            deduplication across polls)
--   badge_id               — the card/badge number from the access-control
--                            system (distinct from employee_id)
--
-- A unique index on (source_id, external_event_id) enables the
-- INSERT … ON CONFLICT DO NOTHING deduplication pattern used by the poller.

ALTER TABLE access_control_sources
    ADD COLUMN IF NOT EXISTS last_poll_checkpoint TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS consecutive_failures  INT NOT NULL DEFAULT 0;

ALTER TABLE badge_events
    ADD COLUMN IF NOT EXISTS external_event_id VARCHAR(200),
    ADD COLUMN IF NOT EXISTS badge_id          VARCHAR(100);

-- Deduplication index — only meaningful for rows that carry an external_event_id
CREATE UNIQUE INDEX IF NOT EXISTS idx_badge_events_dedup
    ON badge_events (source_id, external_event_id)
    WHERE external_event_id IS NOT NULL;
