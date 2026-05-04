DELETE FROM role_permissions
WHERE permission_id IN (
    SELECT id FROM permissions
    WHERE name IN ('video_streams:manage', 'video_streams:view')
);

DELETE FROM permissions
WHERE name IN ('video_streams:manage', 'video_streams:view');
