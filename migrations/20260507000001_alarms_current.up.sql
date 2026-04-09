-- Materialized current alarm state per (point, source, condition).
-- Updated by upsert in the external alarm processor on every OPC A&C event.
-- Enables fast active-alarm queries without scanning alarm_states history.

CREATE TABLE alarms_current (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    point_id             UUID REFERENCES points_metadata(id),
    alarm_source         event_source_enum NOT NULL,

    -- ISA-18.2 derived state
    state                alarm_state_enum NOT NULL DEFAULT 'cleared',
    priority             alarm_priority_enum,
    severity             SMALLINT NOT NULL DEFAULT 500,

    -- OPC A&C identity fields
    condition_name       TEXT NOT NULL DEFAULT '',
    limit_state          TEXT,           -- "HighHigh", "High", "Low", "LowLow", ""
    event_id_hex         TEXT,           -- OPC EventId bytes (hex) for Acknowledge call
    source_id            UUID,           -- point_sources.id for OPC method dispatch

    -- State flags (mirrored from OPC server)
    active               BOOLEAN NOT NULL DEFAULT false,
    acked                BOOLEAN NOT NULL DEFAULT true,
    retain               BOOLEAN NOT NULL DEFAULT false,
    suppressed_or_shelved BOOLEAN NOT NULL DEFAULT false,

    -- Timestamps
    activated_at         TIMESTAMPTZ,
    acknowledged_at      TIMESTAMPTZ,
    acknowledged_by      UUID,
    cleared_at           TIMESTAMPTZ,
    shelved_until        TIMESTAMPTZ,

    -- Human-readable message from OPC server
    message              TEXT,

    -- Full OPC event metadata for forensics
    metadata             JSONB NOT NULL DEFAULT '{}',

    last_event_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- One row per (point, source, condition_name)
    CONSTRAINT uq_alarms_current_point_source_cond
        UNIQUE (point_id, alarm_source, condition_name)
);

CREATE INDEX idx_alarms_current_active   ON alarms_current(active) WHERE active = true;
CREATE INDEX idx_alarms_current_state    ON alarms_current(state)
    WHERE state != 'cleared'::alarm_state_enum
      AND state != 'disabled'::alarm_state_enum;
CREATE INDEX idx_alarms_current_point_id ON alarms_current(point_id);
CREATE INDEX idx_alarms_current_source   ON alarms_current(alarm_source);
