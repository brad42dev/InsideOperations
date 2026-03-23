-- Remove the permissions added in the up migration
DELETE FROM permissions WHERE name IN ('system:configure', 'system:certificates');
