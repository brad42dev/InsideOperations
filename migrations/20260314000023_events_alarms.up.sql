-- no-transaction
-- Events & alarms: enums, events hypertable, alarm states, definitions, shelving

CREATE TYPE event_type_enum AS ENUM (
    'process_alarm', 'operator_action', 'system_event',
    'config_change', 'safety_event', 'io_alarm', 'io_expression_alarm'
);

CREATE TYPE event_source_enum AS ENUM (
    'opc', 'io_threshold', 'io_expression', 'system', 'operator', 'scheduled'
);

CREATE TYPE alarm_state_enum AS ENUM (
    'active', 'acknowledged', 'rtn', 'cleared',
    'shelved', 'suppressed', 'out_of_service', 'disabled', 'latched'
);

CREATE TYPE alarm_priority_enum AS ENUM (
    'urgent', 'high', 'medium', 'low', 'diagnostic'
);

-- Unified event table (hypertable)
CREATE TABLE events (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    event_type event_type_enum NOT NULL,
    source event_source_enum NOT NULL,
    severity SMALLINT NOT NULL DEFAULT 500,
    priority alarm_priority_enum,
    point_id UUID REFERENCES points_metadata(id),
    message TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    source_timestamp TIMESTAMPTZ,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

SELECT create_hypertable('events', 'timestamp',
    chunk_time_interval => INTERVAL '1 day');

ALTER TABLE events ADD CONSTRAINT pk_events PRIMARY KEY (id, timestamp);

-- ISA-18.2 alarm state machine tracking
-- NOTE: event_id/event_timestamp duplicate the composite PK of events (id, timestamp).
-- A FK to events(id) is intentionally omitted: TimescaleDB hypertables require the
-- partition key in every UNIQUE/PK constraint, making simple FK references impossible.
-- Join as: alarm_states AS s JOIN events AS e ON e.id = s.event_id AND e.timestamp = s.event_timestamp
CREATE TABLE alarm_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL,
    event_timestamp TIMESTAMPTZ NOT NULL,
    state alarm_state_enum NOT NULL,
    previous_state alarm_state_enum,
    transitioned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    transitioned_by UUID REFERENCES users(id),
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- I/O-generated alarm definitions
CREATE TABLE alarm_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    point_id UUID REFERENCES points_metadata(id),
    definition_type VARCHAR(20) NOT NULL
        CHECK (definition_type IN ('threshold', 'expression')),
    threshold_config JSONB,
    expression_id UUID REFERENCES custom_expressions(id) ON DELETE SET NULL,
    priority alarm_priority_enum NOT NULL DEFAULT 'low',
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_by UUID NOT NULL REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT uq_alarm_definitions_name UNIQUE (name),
    CONSTRAINT chk_alarm_def_threshold CHECK (
        definition_type != 'threshold' OR threshold_config IS NOT NULL
    ),
    CONSTRAINT chk_alarm_def_expression CHECK (
        definition_type != 'expression' OR expression_id IS NOT NULL
    )
);

-- Active alarm shelves
CREATE TABLE alarm_shelving (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alarm_definition_id UUID NOT NULL REFERENCES alarm_definitions(id) ON DELETE CASCADE,
    shelved_by UUID NOT NULL REFERENCES users(id),
    shelved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    shelf_duration_seconds INTEGER NOT NULL,
    shelf_expires_at TIMESTAMPTZ NOT NULL,
    reason TEXT NOT NULL,
    unshelved_at TIMESTAMPTZ,
    unshelved_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_events_timestamp ON events(timestamp DESC);
CREATE INDEX idx_events_event_type ON events(event_type, timestamp DESC);
CREATE INDEX idx_events_point_id ON events(point_id, timestamp DESC) WHERE point_id IS NOT NULL;
CREATE INDEX idx_events_severity ON events(severity, timestamp DESC);
CREATE INDEX idx_events_source ON events(source, timestamp DESC);
CREATE INDEX idx_events_priority ON events(priority, timestamp DESC) WHERE priority IS NOT NULL;
CREATE INDEX idx_alarm_states_event ON alarm_states(event_id);
CREATE INDEX idx_alarm_states_state ON alarm_states(state, transitioned_at DESC);
CREATE INDEX idx_alarm_states_event_timestamp ON alarm_states(event_timestamp DESC);
CREATE INDEX idx_alarm_definitions_point ON alarm_definitions(point_id) WHERE point_id IS NOT NULL;
CREATE INDEX idx_alarm_definitions_type ON alarm_definitions(definition_type);
CREATE INDEX idx_alarm_definitions_enabled ON alarm_definitions(enabled) WHERE enabled = true;
CREATE INDEX idx_alarm_definitions_active ON alarm_definitions(id) WHERE enabled = true AND deleted_at IS NULL;
CREATE INDEX idx_alarm_shelving_definition ON alarm_shelving(alarm_definition_id);
CREATE INDEX idx_alarm_shelving_active ON alarm_shelving(shelf_expires_at)
    WHERE unshelved_at IS NULL;

-- Triggers
CREATE TRIGGER trg_alarm_definitions_updated_at
    BEFORE UPDATE ON alarm_definitions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_audit_alarm_definitions
    AFTER INSERT OR UPDATE OR DELETE ON alarm_definitions
    FOR EACH ROW EXECUTE FUNCTION log_audit_trail();

CREATE TRIGGER trg_audit_alarm_shelving
    AFTER INSERT OR UPDATE OR DELETE ON alarm_shelving
    FOR EACH ROW EXECUTE FUNCTION log_audit_trail();
