-- Phase E: Stream session tracking for SSE, WebSocket, and CDC connectors

CREATE TABLE import_stream_sessions (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_definition_id UUID NOT NULL REFERENCES import_definitions(id) ON DELETE CASCADE,
    session_type         VARCHAR(20) NOT NULL
        CHECK (session_type IN ('sse', 'websocket', 'pg_cdc', 'mysql_cdc', 'mongo_change_stream')),
    status               VARCHAR(20) NOT NULL DEFAULT 'connecting'
        CHECK (status IN ('connecting', 'active', 'reconnecting', 'failed', 'stopped')),
    started_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_event_at        TIMESTAMPTZ,
    reconnect_count      INTEGER NOT NULL DEFAULT 0,
    events_received      BIGINT NOT NULL DEFAULT 0,
    resume_token         JSONB,
    error_message        TEXT,
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_stream_sessions_def_status
    ON import_stream_sessions (import_definition_id, status);

-- Only one active/connecting/reconnecting session per definition
CREATE UNIQUE INDEX idx_stream_sessions_active
    ON import_stream_sessions (import_definition_id)
    WHERE status IN ('connecting', 'active', 'reconnecting');
