-- Add missing system permissions that are referenced in code but were absent from the initial seed.
-- system:configure — used by EULA admin, Sessions admin, SCIM token admin, SMS providers, auth providers
-- system:certificates — used by the Certificates settings page

INSERT INTO permissions (name, description, module) VALUES
    ('system:configure',    'Configure system-wide services (EULA, sessions, SCIM, SMS providers, auth providers)', 'system'),
    ('system:certificates', 'Manage TLS/SSL certificates',                                                          'system')
ON CONFLICT (name) DO NOTHING;

-- Assign new permissions to the Admin role (which holds all permissions)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Admin'
  AND p.name IN ('system:configure', 'system:certificates')
ON CONFLICT DO NOTHING;
