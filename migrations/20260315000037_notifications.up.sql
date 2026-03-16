-- =============================================================================
-- Migration: notifications (Phase 14 — Alerts Module)
-- Creates notification_* tables for human-initiated alert workflows.
-- These are separate from the alert_* tables (alarm engine, migration 27).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- notification_templates: reusable templates for human-initiated alerts
-- ---------------------------------------------------------------------------
CREATE TABLE notification_templates (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(200) NOT NULL UNIQUE,
    category        VARCHAR(50)  NOT NULL DEFAULT 'custom',
    severity        VARCHAR(20)  NOT NULL DEFAULT 'info',   -- emergency | critical | warning | info
    title_template  TEXT         NOT NULL,
    body_template   TEXT         NOT NULL,
    channels        TEXT[]       NOT NULL DEFAULT '{"websocket"}',
    variables       TEXT[]       NOT NULL DEFAULT '{}',
    is_system       BOOLEAN      NOT NULL DEFAULT false,
    enabled         BOOLEAN      NOT NULL DEFAULT true,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by      UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_notification_templates_enabled  ON notification_templates(enabled);
CREATE INDEX idx_notification_templates_severity ON notification_templates(severity);
CREATE INDEX idx_notification_templates_category ON notification_templates(category);

-- ---------------------------------------------------------------------------
-- notification_groups: custom recipient lists
-- ---------------------------------------------------------------------------
CREATE TABLE notification_groups (
    id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(200) NOT NULL UNIQUE,
    description TEXT,
    group_type  VARCHAR(20)  NOT NULL DEFAULT 'static',  -- static | role_based | on_shift | on_site | all_users
    config      JSONB,
    created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    created_by  UUID REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_notification_groups_type ON notification_groups(group_type);

-- ---------------------------------------------------------------------------
-- notification_group_members: static group membership
-- ---------------------------------------------------------------------------
CREATE TABLE notification_group_members (
    id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id  UUID        NOT NULL REFERENCES notification_groups(id) ON DELETE CASCADE,
    user_id   UUID        NOT NULL REFERENCES users(id)              ON DELETE CASCADE,
    added_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    added_by  UUID REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE (group_id, user_id)
);

CREATE INDEX idx_notification_group_members_group ON notification_group_members(group_id);
CREATE INDEX idx_notification_group_members_user  ON notification_group_members(user_id);

-- ---------------------------------------------------------------------------
-- notification_messages: audit record of every sent notification
-- ---------------------------------------------------------------------------
CREATE TABLE notification_messages (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id     UUID REFERENCES notification_templates(id) ON DELETE SET NULL,
    severity        VARCHAR(20)  NOT NULL DEFAULT 'info',
    title           VARCHAR(500) NOT NULL,
    body            TEXT         NOT NULL,
    channels        TEXT[]       NOT NULL,
    group_id        UUID REFERENCES notification_groups(id) ON DELETE SET NULL,
    recipient_count INT          NOT NULL DEFAULT 0,
    sent_by         UUID         NOT NULL REFERENCES users(id),
    sent_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    variables_used  JSONB,
    status          VARCHAR(20)  NOT NULL DEFAULT 'sent'  -- sent | partial | failed
);

CREATE INDEX idx_notification_messages_severity   ON notification_messages(severity);
CREATE INDEX idx_notification_messages_sent_at    ON notification_messages(sent_at DESC);
CREATE INDEX idx_notification_messages_sent_by    ON notification_messages(sent_by);
CREATE INDEX idx_notification_messages_template   ON notification_messages(template_id);

-- ---------------------------------------------------------------------------
-- notification_muster_marks: per-recipient accountability tracking
-- ---------------------------------------------------------------------------
CREATE TABLE notification_muster_marks (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID        NOT NULL REFERENCES notification_messages(id) ON DELETE CASCADE,
    user_id    UUID        NOT NULL REFERENCES users(id)                 ON DELETE CASCADE,
    status     VARCHAR(20) NOT NULL DEFAULT 'unaccounted',  -- unaccounted | accounted | off_site
    marked_by  UUID REFERENCES users(id) ON DELETE SET NULL,
    marked_at  TIMESTAMPTZ,
    notes      TEXT,
    UNIQUE (message_id, user_id)
);

CREATE INDEX idx_notification_muster_message ON notification_muster_marks(message_id);
CREATE INDEX idx_notification_muster_user    ON notification_muster_marks(user_id);
CREATE INDEX idx_notification_muster_status  ON notification_muster_marks(status);

-- ---------------------------------------------------------------------------
-- updated_at triggers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_notification_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notification_templates_updated_at
    BEFORE UPDATE ON notification_templates
    FOR EACH ROW EXECUTE FUNCTION update_notification_updated_at();

CREATE TRIGGER trg_notification_groups_updated_at
    BEFORE UPDATE ON notification_groups
    FOR EACH ROW EXECUTE FUNCTION update_notification_updated_at();

-- ---------------------------------------------------------------------------
-- Seed: 10 built-in notification templates (is_system = true)
-- ---------------------------------------------------------------------------
INSERT INTO notification_templates
    (name, category, severity, title_template, body_template, channels, variables, is_system, enabled)
VALUES
-- 1. Gas Leak
(
    'Gas Leak',
    'safety',
    'emergency',
    'GAS LEAK ALERT — {{location}}',
    'A gas leak has been detected at {{location}}. All personnel must evacuate the area immediately and report to the muster point. Do NOT operate any electrical switches. Emergency response team has been notified.',
    '{"websocket","email","sms","pa"}',
    '{"location"}',
    true, true
),
-- 2. Fire Alarm
(
    'Fire Alarm',
    'safety',
    'emergency',
    'FIRE ALARM — {{location}}',
    'A fire alarm has been activated at {{location}}. All personnel must evacuate immediately via the nearest emergency exit. Proceed to the designated assembly area. Do NOT use elevators.',
    '{"websocket","email","sms","pa"}',
    '{"location"}',
    true, true
),
-- 3. Shelter in Place
(
    'Shelter in Place',
    'safety',
    'emergency',
    'SHELTER IN PLACE ORDER — {{reason}}',
    'A shelter-in-place order has been issued due to {{reason}}. All personnel must move to the designated shelter area immediately. Await further instructions. Do NOT leave the building.',
    '{"websocket","email","sms","pa"}',
    '{"reason"}',
    true, true
),
-- 4. Evacuation Order
(
    'Evacuation Order',
    'safety',
    'emergency',
    'MANDATORY EVACUATION — {{area}}',
    'A mandatory evacuation has been ordered for {{area}}. All personnel must leave immediately via designated evacuation routes. Report to the muster station. Emergency personnel will account for all workers.',
    '{"websocket","email","sms","pa"}',
    '{"area"}',
    true, true
),
-- 5. All Clear
(
    'All Clear',
    'safety',
    'warning',
    'ALL CLEAR — {{incident}} Resolved',
    'The {{incident}} incident at {{location}} has been resolved. The all-clear has been given. Personnel may return to normal operations. Please report any concerns to your supervisor.',
    '{"websocket","email","sms","pa"}',
    '{"incident","location"}',
    true, true
),
-- 6. Unit Trip
(
    'Unit Trip',
    'operations',
    'critical',
    'UNIT TRIP — {{unit_name}}',
    'Unit {{unit_name}} has tripped at {{time}}. Cause: {{cause}}. Operations team is responding. Do NOT attempt restart without supervisor authorization. Contact the shift supervisor immediately.',
    '{"websocket","email","sms"}',
    '{"unit_name","time","cause"}',
    true, true
),
-- 7. Shift Announcement
(
    'Shift Announcement',
    'operations',
    'info',
    'Shift Announcement — {{shift_name}}',
    '{{message}}\n\nThis announcement applies to all personnel on the {{shift_name}} shift. Please acknowledge receipt.',
    '{"websocket","email"}',
    '{"shift_name","message"}',
    true, true
),
-- 8. Safety Bulletin
(
    'Safety Bulletin',
    'safety',
    'warning',
    'Safety Bulletin: {{bulletin_title}}',
    '{{bulletin_body}}\n\nThis safety bulletin is issued by {{issued_by}}. All personnel are required to read and acknowledge this bulletin. Questions should be directed to the HSE department.',
    '{"websocket","email"}',
    '{"bulletin_title","bulletin_body","issued_by"}',
    true, true
),
-- 9. Planned Outage Notice
(
    'Planned Outage Notice',
    'operations',
    'info',
    'Planned Outage: {{system_name}} — {{date}}',
    '{{system_name}} will be taken offline for planned maintenance on {{date}} from {{start_time}} to {{end_time}}. Affected systems: {{affected_systems}}. Please plan accordingly. Contact {{contact_person}} with questions.',
    '{"websocket","email"}',
    '{"system_name","date","start_time","end_time","affected_systems","contact_person"}',
    true, true
),
-- 10. Custom Alert
(
    'Custom Alert',
    'custom',
    'info',
    '{{title}}',
    '{{message}}',
    '{"websocket","email","sms","radio","push"}',
    '{"title","message"}',
    true, true
);
