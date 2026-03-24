-- Ensure system:configure and system:certificates are in the permissions table and
-- assigned to the Admin role. Migration 20260323000001 should have done this, but
-- UAT on 2026-03-24 (DD-15-014) showed admin still sees Access Denied on /settings/eula
-- which requires system:configure. This migration re-asserts the fix idempotently.
--
-- Root cause: system:configure and system:certificates were absent from the initial
-- seed (20260314000033) and were first added in 20260323000001. This migration
-- guarantees both permissions exist and are assigned to Admin on any installation
-- path.

INSERT INTO permissions (name, description, module) VALUES
    ('system:configure',    'Configure system-wide services (EULA, sessions, SCIM, SMS providers, auth providers)', 'system'),
    ('system:certificates', 'Manage TLS/SSL certificates',                                                          'system')
ON CONFLICT (name) DO NOTHING;

-- Assign system:configure and system:certificates to the Admin role.
-- Admin role holds all permissions; this covers the case where the role_permissions
-- row was never inserted (e.g., if 20260323000001 was not applied).
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Admin'
  AND p.name IN ('system:configure', 'system:certificates')
ON CONFLICT DO NOTHING;
