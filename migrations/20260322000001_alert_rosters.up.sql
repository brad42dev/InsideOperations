-- Migration: Add alert_rosters table
-- Recipient rosters are named groups used to determine who receives alert notifications.
-- Rosters can be manually maintained or dynamically resolved from user roles, shift data, or presence data.

CREATE TABLE IF NOT EXISTS alert_rosters (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT NOT NULL,
    description     TEXT,
    source          TEXT NOT NULL CHECK (source IN ('manual', 'role_group', 'all_users', 'on_shift', 'on_site')),
    source_config   JSONB,
    members         JSONB,
    built_in        BOOLEAN NOT NULL DEFAULT false,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by      UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by      UUID REFERENCES users(id) ON DELETE SET NULL
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_alert_rosters_source ON alert_rosters(source);
CREATE INDEX IF NOT EXISTS idx_alert_rosters_built_in ON alert_rosters(built_in);

-- Seed built-in rosters
INSERT INTO alert_rosters (id, name, description, source, source_config, members, built_in)
VALUES
    ('00000000-0000-0000-0000-000000000101'::uuid,
     'All Users',
     'All active I/O users',
     'all_users',
     NULL,
     NULL,
     true),
    ('00000000-0000-0000-0000-000000000102'::uuid,
     'Admins',
     'All users with the Admin role',
     'role_group',
     '{"role_name": "Admin"}'::jsonb,
     NULL,
     true)
ON CONFLICT (id) DO NOTHING;
