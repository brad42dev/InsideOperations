INSERT INTO permissions (name, description, module) VALUES
  ('video_streams:manage', 'Create, edit, and delete video streams; manage ACL', 'video_streams'),
  ('video_streams:view', 'View video streams (subject to per-stream ACL for private)', 'video_streams')
ON CONFLICT (name) DO NOTHING;

INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Admin'
  AND p.name IN ('video_streams:manage', 'video_streams:view')
ON CONFLICT DO NOTHING;
