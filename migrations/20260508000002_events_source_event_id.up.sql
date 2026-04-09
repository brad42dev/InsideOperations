-- Add source_event_id column to events for OPC UA EventId deduplication.
-- Stores the hex-encoded OPC UA EventId (unique per event on the server).
-- The unique index on (timestamp, source_event_id) enables ON CONFLICT DO NOTHING
-- in write_opc_events(), preventing duplicate events from ConditionRefresh replays
-- and historical event recovery runs.
--
-- TimescaleDB requires the partitioning column (timestamp) in all unique indexes.

ALTER TABLE events ADD COLUMN IF NOT EXISTS source_event_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_events_source_event_id
    ON events (timestamp, source_event_id)
    WHERE source_event_id IS NOT NULL;
