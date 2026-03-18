-- OPC UA History Recovery Jobs
-- Tracks both automatic startup recovery and admin-triggered manual recovery requests.

CREATE TABLE opc_history_recovery_jobs (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id        UUID NOT NULL REFERENCES point_sources(id) ON DELETE CASCADE,
    requested_by     UUID REFERENCES users(id) ON DELETE SET NULL,
    from_time        TIMESTAMPTZ NOT NULL,
    to_time          TIMESTAMPTZ NOT NULL,
    status           TEXT NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending', 'running', 'complete', 'failed')),
    points_recovered BIGINT NOT NULL DEFAULT 0,
    started_at       TIMESTAMPTZ,
    completed_at     TIMESTAMPTZ,
    error_message    TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_opc_history_recovery_source ON opc_history_recovery_jobs(source_id, created_at DESC);
CREATE INDEX idx_opc_history_recovery_pending ON opc_history_recovery_jobs(source_id, status)
    WHERE status IN ('pending', 'running');
