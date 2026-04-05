-- Phase: Shift Log Entries for j5 integration
-- Stores imported logbook entries from shift operations systems (e.g., Hexagon j5).
-- Entries are correlated to shifts by timestamp overlap.

CREATE TABLE IF NOT EXISTS shift_log_entries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_id        UUID REFERENCES shifts(id),
    external_id     VARCHAR(200),
    source_system   VARCHAR(100) NOT NULL DEFAULT 'unknown',
    entry_type      VARCHAR(50) NOT NULL DEFAULT 'logbook',  -- logbook, handover, rounds
    area            VARCHAR(200),
    author          VARCHAR(200),
    author_user_id  UUID REFERENCES users(id),
    event_time      TIMESTAMPTZ NOT NULL,
    summary         TEXT,
    details         JSONB,
    status          VARCHAR(30),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_shift_log_entries_shift_id ON shift_log_entries (shift_id) WHERE shift_id IS NOT NULL;
CREATE INDEX idx_shift_log_entries_event_time ON shift_log_entries (event_time DESC);
CREATE INDEX idx_shift_log_entries_source_system ON shift_log_entries (source_system);

ALTER TABLE shift_log_entries ADD CONSTRAINT uq_shift_log_entries_external
    UNIQUE (source_system, external_id);
