DELETE FROM role_permissions
WHERE permission_id IN (
    SELECT id FROM permissions
    WHERE name IN ('process:video_export', 'console:video_export')
);
DELETE FROM permissions
WHERE name IN ('process:video_export', 'console:video_export');
