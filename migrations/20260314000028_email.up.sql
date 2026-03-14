-- Email service: providers, templates, queue, delivery log

CREATE TABLE email_providers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(100) NOT NULL UNIQUE,
    provider_type   VARCHAR(20) NOT NULL,
    config          JSONB NOT NULL,
    is_default      BOOLEAN NOT NULL DEFAULT false,
    is_fallback     BOOLEAN NOT NULL DEFAULT false,
    enabled         BOOLEAN NOT NULL DEFAULT true,
    from_address    VARCHAR(254) NOT NULL,
    from_name       VARCHAR(200),
    last_tested_at  TIMESTAMPTZ,
    last_test_ok    BOOLEAN,
    last_test_error TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      UUID REFERENCES users(id),
    updated_by      UUID REFERENCES users(id)
);

CREATE UNIQUE INDEX idx_email_providers_default ON email_providers (is_default) WHERE is_default = true;

CREATE TABLE email_templates (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name              VARCHAR(100) NOT NULL UNIQUE,
    category          VARCHAR(20) NOT NULL DEFAULT 'custom',
    subject_template  TEXT NOT NULL,
    body_html         TEXT NOT NULL,
    body_text         TEXT,
    variables_schema  JSONB,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by        UUID REFERENCES users(id),
    updated_by        UUID REFERENCES users(id)
);

CREATE TABLE email_queue (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id     UUID REFERENCES email_providers(id),
    template_id     UUID REFERENCES email_templates(id),
    to_addresses    TEXT[] NOT NULL,
    cc_addresses    TEXT[] DEFAULT '{}',
    bcc_addresses   TEXT[] DEFAULT '{}',
    reply_to        VARCHAR(254),
    subject         TEXT NOT NULL,
    body_html       TEXT NOT NULL,
    body_text       TEXT,
    attachments     JSONB,
    priority        SMALLINT NOT NULL DEFAULT 2,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',
    attempts        SMALLINT NOT NULL DEFAULT 0,
    max_attempts    SMALLINT NOT NULL DEFAULT 4,
    next_attempt    TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_error      TEXT,
    context_type    VARCHAR(50),
    context_id      UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_at         TIMESTAMPTZ,
    created_by      UUID REFERENCES users(id)
);

CREATE TABLE email_delivery_log (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    queue_id            UUID NOT NULL REFERENCES email_queue(id),
    provider_id         UUID NOT NULL REFERENCES email_providers(id),
    attempt_number      SMALLINT NOT NULL,
    status              VARCHAR(20) NOT NULL,
    provider_message_id VARCHAR(200),
    provider_response   TEXT,
    error_details       TEXT,
    sent_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_email_queue_pending ON email_queue (priority, next_attempt) WHERE status IN ('pending', 'retry');
CREATE INDEX idx_email_queue_context ON email_queue (context_type, context_id);
CREATE INDEX idx_email_delivery_log_queue ON email_delivery_log (queue_id);

-- Triggers
CREATE TRIGGER trg_email_providers_updated_at
    BEFORE UPDATE ON email_providers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_email_templates_updated_at
    BEFORE UPDATE ON email_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_audit_email_providers
    AFTER INSERT OR UPDATE OR DELETE ON email_providers
    FOR EACH ROW EXECUTE FUNCTION log_audit_trail();
