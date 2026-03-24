-- Reverse: remove system:configure and system:certificates
-- WARNING: Only run this if you are reverting to a state before these permissions existed.
-- Running this on a live system will cause Access Denied on EULA, Sessions, SCIM,
-- SMS providers, and auth provider settings pages for all users including Admin.

DELETE FROM role_permissions
WHERE permission_id IN (
    SELECT id FROM permissions WHERE name IN ('system:configure', 'system:certificates')
);

DELETE FROM permissions WHERE name IN ('system:configure', 'system:certificates');
