-- Add video export permissions for historical playback recording feature
INSERT INTO permissions (name, description, module) VALUES
    ('process:video_export', 'Trigger video exports of historical process playback', 'process'),
    ('console:video_export', 'Trigger video exports of historical console playback', 'console')
ON CONFLICT (name) DO NOTHING;

-- Assign to Admin role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Admin'
  AND p.name IN ('process:video_export', 'console:video_export')
ON CONFLICT DO NOTHING;

-- Assign to Shift Supervisor, Operator, Engineer
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN permissions p ON p.name IN ('process:video_export', 'console:video_export')
WHERE r.name IN ('Shift Supervisor', 'Operator', 'Engineer')
ON CONFLICT DO NOTHING;
