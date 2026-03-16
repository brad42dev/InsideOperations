DROP TABLE IF EXISTS saml_request_store;
DROP TABLE IF EXISTS oidc_state_store;
DROP TABLE IF EXISTS idp_role_mappings;
DROP TABLE IF EXISTS auth_provider_configs;
ALTER TABLE users DROP COLUMN IF EXISTS auth_provider;
ALTER TABLE users DROP COLUMN IF EXISTS auth_provider_config_id;
ALTER TABLE users DROP COLUMN IF EXISTS auth_provider_user_id;
ALTER TABLE users DROP COLUMN IF EXISTS external_id;
ALTER TABLE users ALTER COLUMN password_hash SET NOT NULL;
