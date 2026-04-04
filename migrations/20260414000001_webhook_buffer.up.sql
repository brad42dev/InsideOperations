-- Phase D: Webhook buffer table for durable webhook event processing

CREATE TABLE import_webhook_buffer (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_definition_id UUID NOT NULL REFERENCES import_definitions(id) ON DELETE CASCADE,
    payload              JSONB NOT NULL,
    headers              JSONB DEFAULT '{}',
    received_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at         TIMESTAMPTZ,
    processing_status    VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (processing_status IN ('pending', 'processing', 'done', 'failed')),
    error_message        TEXT,
    retry_count          INTEGER NOT NULL DEFAULT 0,
    max_retries          INTEGER NOT NULL DEFAULT 3
);

-- Partial index for drain task performance: only pending rows
CREATE INDEX idx_webhook_buffer_pending
    ON import_webhook_buffer (import_definition_id, received_at)
    WHERE processing_status = 'pending';

-- Index for buffer depth check (rate limiting)
CREATE INDEX idx_webhook_buffer_depth
    ON import_webhook_buffer (import_definition_id)
    WHERE processing_status IN ('pending', 'processing');
