DELETE FROM role_permissions
WHERE permission_id = (SELECT id FROM permissions WHERE name = 'sms:configure');

DELETE FROM permissions WHERE name = 'sms:configure';
