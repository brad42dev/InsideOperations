-- Reverse SMS provider migration
DROP TABLE IF EXISTS sms_mfa_codes;
DROP TABLE IF EXISTS sms_providers;

-- Note: phone_number column on users is intentionally left in place on down
-- to avoid accidental data loss. Remove manually if required:
-- ALTER TABLE users DROP COLUMN IF EXISTS phone_number;
