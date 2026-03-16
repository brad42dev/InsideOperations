-- Phase 15: Shifts / Access Control schema
-- Extends users with badge mapping, adds badge event tracking,
-- presence status, shift scheduling, and muster accountability tables.

-- ---------------------------------------------------------------------------
-- Extend users with badge/employee mapping
-- ---------------------------------------------------------------------------

ALTER TABLE users ADD COLUMN IF NOT EXISTS employee_id VARCHAR(100);
CREATE INDEX IF NOT EXISTS idx_users_employee_id ON users (employee_id) WHERE employee_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- access_control_sources: badge system adapters
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS access_control_sources (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(200) NOT NULL UNIQUE,
    adapter_type    VARCHAR(30)  NOT NULL, -- lenel, ccure, genetec, honeywell, gallagher, generic_db
    enabled         BOOLEAN NOT NULL DEFAULT true,
    config          JSONB NOT NULL DEFAULT '{}', -- connection details (encrypted in prod)
    poll_interval_s INT  NOT NULL DEFAULT 30,
    last_poll_at    TIMESTAMPTZ,
    last_poll_ok    BOOLEAN,
    last_error      TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      UUID REFERENCES users(id)
);

CREATE TRIGGER trg_access_control_sources_updated_at
    BEFORE UPDATE ON access_control_sources
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ---------------------------------------------------------------------------
-- badge_events: raw badge swipe records (90-day retention)
-- ---------------------------------------------------------------------------

CREATE TABLE badge_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id   UUID NOT NULL REFERENCES access_control_sources(id),
    event_type  VARCHAR(30) NOT NULL, -- SwipeIn,SwipeOut,AccessDenied,DoorForced,DoorHeldOpen,Duress,PassbackViolation,Tailgate
    employee_id VARCHAR(100),
    user_id     UUID REFERENCES users(id),
    door_id     VARCHAR(100),
    door_name   VARCHAR(200),
    area        VARCHAR(200),
    event_time  TIMESTAMPTZ NOT NULL,
    raw_data    JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_badge_events_event_time  ON badge_events (event_time DESC);
CREATE INDEX idx_badge_events_employee_id ON badge_events (employee_id) WHERE employee_id IS NOT NULL;
CREATE INDEX idx_badge_events_source_id   ON badge_events (source_id);
CREATE INDEX idx_badge_events_user_id     ON badge_events (user_id)     WHERE user_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- presence_status: current on-site status per user (live, no retention)
-- ---------------------------------------------------------------------------

CREATE TABLE presence_status (
    user_id         UUID PRIMARY KEY REFERENCES users(id),
    on_site         BOOLEAN NOT NULL DEFAULT false,
    last_seen_at    TIMESTAMPTZ,
    last_area       VARCHAR(200),
    last_door       VARCHAR(200),
    stale_at        TIMESTAMPTZ, -- auto-timeout timestamp
    on_shift        BOOLEAN NOT NULL DEFAULT false,
    current_shift_id UUID,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_presence_status_on_site  ON presence_status (on_site)  WHERE on_site = true;
CREATE INDEX idx_presence_status_on_shift ON presence_status (on_shift) WHERE on_shift = true;

-- ---------------------------------------------------------------------------
-- shift_patterns: rotation templates
-- ---------------------------------------------------------------------------

CREATE TABLE shift_patterns (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name         VARCHAR(100) NOT NULL UNIQUE,
    pattern_type VARCHAR(20)  NOT NULL DEFAULT 'custom', -- 8x3, 12x2, dupont, pitman, custom
    description  TEXT,
    config       JSONB NOT NULL DEFAULT '{}',
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by   UUID REFERENCES users(id)
);

-- ---------------------------------------------------------------------------
-- shift_crews: named groups of personnel
-- ---------------------------------------------------------------------------

CREATE TABLE shift_crews (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    color       VARCHAR(7)   NOT NULL DEFAULT '#6366f1',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by  UUID REFERENCES users(id)
);

-- ---------------------------------------------------------------------------
-- shift_crew_members
-- ---------------------------------------------------------------------------

CREATE TABLE shift_crew_members (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    crew_id    UUID NOT NULL REFERENCES shift_crews(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id)       ON DELETE CASCADE,
    role_label VARCHAR(100),
    added_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (crew_id, user_id)
);

CREATE INDEX idx_shift_crew_members_crew_id ON shift_crew_members (crew_id);
CREATE INDEX idx_shift_crew_members_user_id ON shift_crew_members (user_id);

-- ---------------------------------------------------------------------------
-- shifts: scheduled shift instances
-- ---------------------------------------------------------------------------

CREATE TABLE shifts (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name             VARCHAR(200) NOT NULL,
    crew_id          UUID REFERENCES shift_crews(id),
    pattern_id       UUID REFERENCES shift_patterns(id),
    start_time       TIMESTAMPTZ NOT NULL,
    end_time         TIMESTAMPTZ NOT NULL,
    handover_minutes INT  NOT NULL DEFAULT 30,
    notes            TEXT,
    status           VARCHAR(20) NOT NULL DEFAULT 'scheduled', -- scheduled, active, completed, cancelled
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by       UUID REFERENCES users(id)
);

CREATE INDEX idx_shifts_start_time ON shifts (start_time);
CREATE INDEX idx_shifts_end_time   ON shifts (end_time);
CREATE INDEX idx_shifts_status     ON shifts (status);
CREATE INDEX idx_shifts_crew_id    ON shifts (crew_id) WHERE crew_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- shift_assignments: per-user shift assignment
-- ---------------------------------------------------------------------------

CREATE TABLE shift_assignments (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_id   UUID NOT NULL REFERENCES shifts(id) ON DELETE CASCADE,
    user_id    UUID NOT NULL REFERENCES users(id),
    role_label VARCHAR(100),
    source     VARCHAR(20) NOT NULL DEFAULT 'crew', -- crew, direct, external
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (shift_id, user_id)
);

CREATE INDEX idx_shift_assignments_shift_id ON shift_assignments (shift_id);
CREATE INDEX idx_shift_assignments_user_id  ON shift_assignments (user_id);

-- ---------------------------------------------------------------------------
-- muster_points: assembly locations
-- ---------------------------------------------------------------------------

CREATE TABLE muster_points (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(200) NOT NULL UNIQUE,
    description TEXT,
    area        VARCHAR(200),
    capacity    INT,
    latitude    DOUBLE PRECISION,
    longitude   DOUBLE PRECISION,
    door_ids    TEXT[] NOT NULL DEFAULT '{}',
    enabled     BOOLEAN NOT NULL DEFAULT true,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by  UUID REFERENCES users(id)
);

-- ---------------------------------------------------------------------------
-- muster_events: emergency muster declarations
-- ---------------------------------------------------------------------------

CREATE TABLE muster_events (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trigger_type   VARCHAR(30) NOT NULL DEFAULT 'manual', -- manual, alert, badge
    trigger_ref_id UUID,
    declared_by    UUID NOT NULL REFERENCES users(id),
    declared_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_by    UUID REFERENCES users(id),
    resolved_at    TIMESTAMPTZ,
    total_on_site  INT,
    notes          TEXT,
    status         VARCHAR(20) NOT NULL DEFAULT 'active' -- active, resolved
);

CREATE INDEX idx_muster_events_status      ON muster_events (status);
CREATE INDEX idx_muster_events_declared_at ON muster_events (declared_at DESC);

-- ---------------------------------------------------------------------------
-- muster_accounting: per-person accountability (indefinite retention - OSHA PSM)
-- ---------------------------------------------------------------------------

CREATE TABLE muster_accounting (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    muster_event_id UUID NOT NULL REFERENCES muster_events(id),
    user_id         UUID NOT NULL REFERENCES users(id),
    muster_point_id UUID REFERENCES muster_points(id),
    status          VARCHAR(30) NOT NULL DEFAULT 'unaccounted', -- unaccounted, accounted_badge, accounted_manual, off_site, stale
    accounted_at    TIMESTAMPTZ,
    accounted_by    UUID REFERENCES users(id),
    notes           TEXT,
    UNIQUE (muster_event_id, user_id)
);

CREATE INDEX idx_muster_accounting_event_id ON muster_accounting (muster_event_id);
CREATE INDEX idx_muster_accounting_user_id  ON muster_accounting (user_id);
CREATE INDEX idx_muster_accounting_status   ON muster_accounting (muster_event_id, status);
