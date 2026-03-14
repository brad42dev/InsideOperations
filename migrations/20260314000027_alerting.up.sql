-- Alerting: enums, templates, rosters, alerts, deliveries, escalations, channels, push subscriptions

CREATE TYPE alert_severity AS ENUM ('emergency', 'critical', 'warning', 'info');
CREATE TYPE alert_status AS ENUM ('active', 'acknowledged', 'resolved', 'cancelled');

CREATE TABLE alert_rosters (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(200) NOT NULL UNIQUE,
    description     TEXT,
    source          VARCHAR(20) NOT NULL DEFAULT 'manual',
    source_config   JSONB,
    members         JSONB NOT NULL DEFAULT '[]',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      UUID REFERENCES users(id),
    updated_by      UUID REFERENCES users(id)
);

CREATE TABLE alert_templates (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                    VARCHAR(200) NOT NULL UNIQUE,
    severity                alert_severity NOT NULL,
    title_template          TEXT NOT NULL,
    message_template        TEXT NOT NULL,
    channels                TEXT[] NOT NULL,
    default_roster_id       UUID REFERENCES alert_rosters(id),
    escalation_policy       JSONB,
    requires_acknowledgment BOOLEAN NOT NULL DEFAULT false,
    auto_resolve_minutes    INT,
    category                VARCHAR(50) NOT NULL DEFAULT 'custom',
    variables               TEXT[],
    enabled                 BOOLEAN NOT NULL DEFAULT true,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by              UUID REFERENCES users(id),
    updated_by              UUID REFERENCES users(id)
);

CREATE TABLE alerts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id         UUID REFERENCES alert_templates(id),
    severity            alert_severity NOT NULL,
    status              alert_status NOT NULL DEFAULT 'active',
    title               VARCHAR(500) NOT NULL,
    message             TEXT NOT NULL,
    source              VARCHAR(100) NOT NULL,
    source_reference_id UUID,
    roster_id           UUID REFERENCES alert_rosters(id),
    escalation_policy   JSONB,
    current_escalation  SMALLINT NOT NULL DEFAULT 0,
    channels_used       TEXT[] NOT NULL,
    triggered_by        UUID REFERENCES users(id),
    triggered_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    acknowledged_by     UUID REFERENCES users(id),
    acknowledged_at     TIMESTAMPTZ,
    resolved_by         UUID REFERENCES users(id),
    resolved_at         TIMESTAMPTZ,
    cancelled_by        UUID REFERENCES users(id),
    cancelled_at        TIMESTAMPTZ,
    metadata            JSONB
);

CREATE TABLE alert_deliveries (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id          UUID NOT NULL REFERENCES alerts(id),
    channel_type      VARCHAR(30) NOT NULL,
    recipient_user_id UUID REFERENCES users(id),
    recipient_name    VARCHAR(200),
    recipient_contact VARCHAR(300),
    status            VARCHAR(30) NOT NULL DEFAULT 'pending',
    sent_at           TIMESTAMPTZ,
    delivered_at      TIMESTAMPTZ,
    acknowledged_at   TIMESTAMPTZ,
    failure_reason    TEXT,
    external_id       VARCHAR(200),
    escalation_level  SMALLINT NOT NULL DEFAULT 0,
    metadata          JSONB
);

CREATE TABLE alert_escalations (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id     UUID NOT NULL REFERENCES alerts(id),
    from_level   SMALLINT NOT NULL,
    to_level     SMALLINT NOT NULL,
    reason       VARCHAR(100) NOT NULL,
    escalated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE alert_channels (
    channel_type    VARCHAR(30) PRIMARY KEY,
    display_name    VARCHAR(100) NOT NULL,
    enabled         BOOLEAN NOT NULL DEFAULT false,
    config          JSONB NOT NULL DEFAULT '{}',
    last_tested_at  TIMESTAMPTZ,
    last_test_ok    BOOLEAN,
    last_test_error TEXT,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by      UUID REFERENCES users(id)
);

CREATE TABLE push_subscriptions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id),
    endpoint    TEXT NOT NULL UNIQUE,
    p256dh_key  TEXT NOT NULL,
    auth_key    TEXT NOT NULL,
    user_agent  VARCHAR(500),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX idx_alerts_status ON alerts (status) WHERE status = 'active';
CREATE INDEX idx_alerts_severity_time ON alerts (severity, triggered_at DESC);
CREATE INDEX idx_alerts_source ON alerts (source, source_reference_id);
CREATE INDEX idx_alert_deliveries_alert ON alert_deliveries (alert_id);
CREATE INDEX idx_alert_deliveries_status ON alert_deliveries (alert_id, status) WHERE status IN ('pending', 'sending');
CREATE INDEX idx_alert_escalations_alert ON alert_escalations (alert_id);
CREATE INDEX idx_push_subscriptions_user ON push_subscriptions (user_id);

-- Triggers
CREATE TRIGGER trg_alert_templates_updated_at
    BEFORE UPDATE ON alert_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_alert_rosters_updated_at
    BEFORE UPDATE ON alert_rosters FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_audit_alert_templates
    AFTER INSERT OR UPDATE OR DELETE ON alert_templates
    FOR EACH ROW EXECUTE FUNCTION log_audit_trail();

CREATE TRIGGER trg_audit_alert_rosters
    AFTER INSERT OR UPDATE OR DELETE ON alert_rosters
    FOR EACH ROW EXECUTE FUNCTION log_audit_trail();

CREATE TRIGGER trg_audit_alert_channels
    AFTER INSERT OR UPDATE OR DELETE ON alert_channels
    FOR EACH ROW EXECUTE FUNCTION log_audit_trail();
