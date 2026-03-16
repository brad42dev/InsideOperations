-- Alert Service: Escalation policies, tiers, alert instances, and delivery log
-- Phase 14 — Human-initiated alerts and escalation engine

-- Escalation policies
CREATE TABLE IF NOT EXISTS escalation_policies (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(200) NOT NULL,
    description     TEXT,
    enabled         BOOLEAN NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Escalation tiers within a policy
CREATE TABLE IF NOT EXISTS escalation_tiers (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    policy_id           UUID NOT NULL REFERENCES escalation_policies(id) ON DELETE CASCADE,
    tier_order          SMALLINT NOT NULL DEFAULT 1,
    escalate_after_mins SMALLINT NOT NULL DEFAULT 15,
    notify_groups       UUID[] NOT NULL DEFAULT '{}',
    notify_users        UUID[] NOT NULL DEFAULT '{}',
    channels            TEXT[] NOT NULL DEFAULT '{"email","websocket"}',
    UNIQUE (policy_id, tier_order)
);

-- Alert instances — each triggered alert
CREATE TABLE IF NOT EXISTS alert_instances (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title               VARCHAR(500) NOT NULL,
    body                TEXT,
    severity            VARCHAR(20) NOT NULL DEFAULT 'info'
                            CHECK (severity IN ('emergency', 'critical', 'warning', 'info')),
    source_type         VARCHAR(50),
    source_id           UUID,
    policy_id           UUID REFERENCES escalation_policies(id),
    current_tier        SMALLINT NOT NULL DEFAULT 1,
    status              VARCHAR(20) NOT NULL DEFAULT 'active'
                            CHECK (status IN ('active', 'acknowledged', 'resolved', 'expired')),
    acknowledged_by     UUID REFERENCES users(id),
    acknowledged_at     TIMESTAMPTZ,
    resolved_by         UUID REFERENCES users(id),
    resolved_at         TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at          TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_alert_instances_status ON alert_instances (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alert_instances_source ON alert_instances (source_type, source_id);

-- Delivery log per alert per tier
CREATE TABLE IF NOT EXISTS alert_deliveries (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id        UUID NOT NULL REFERENCES alert_instances(id) ON DELETE CASCADE,
    tier            SMALLINT NOT NULL,
    channel         VARCHAR(20) NOT NULL,
    recipient_id    UUID REFERENCES users(id),
    status          VARCHAR(20) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'sent', 'failed', 'acknowledged')),
    sent_at         TIMESTAMPTZ,
    error           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_alert_deliveries_alert ON alert_deliveries (alert_id);
