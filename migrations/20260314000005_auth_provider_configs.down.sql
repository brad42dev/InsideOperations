ALTER TABLE users DROP COLUMN IF EXISTS auth_provider_config_id;
DROP INDEX IF EXISTS idx_users_external_identity_full;
DROP TABLE IF EXISTS auth_provider_configs;
DROP TYPE IF EXISTS auth_provider_type;
