-- Add sms:configure permission and assign to Admin role
INSERT INTO permissions (name, description, module)
VALUES ('sms:configure', 'Configure SMS providers (Twilio, etc.) and credentials', 'sms')
ON CONFLICT (name) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Admin'
  AND p.name = 'sms:configure'
ON CONFLICT DO NOTHING;
