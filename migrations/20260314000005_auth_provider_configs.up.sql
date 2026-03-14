-- Auth provider types enum
CREATE TYPE auth_provider_type AS ENUM ('oidc', 'saml', 'ldap');

-- Auth provider configurations (OIDC, SAML, LDAP)
CREATE TABLE auth_provider_configs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_type       auth_provider_type NOT NULL,
    name                VARCHAR(100) NOT NULL UNIQUE,
    display_name        VARCHAR(200) NOT NULL,
    enabled             BOOLEAN NOT NULL DEFAULT false,
    config              JSONB NOT NULL,
    jit_provisioning    BOOLEAN NOT NULL DEFAULT false,
    default_role_id     UUID REFERENCES roles(id),
    group_role_mapping  JSONB,
    display_order       SMALLINT NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by          UUID REFERENCES users(id),
    updated_by          UUID REFERENCES users(id)
);

CREATE INDEX idx_auth_provider_configs_type ON auth_provider_configs(provider_type);
CREATE INDEX idx_auth_provider_configs_enabled ON auth_provider_configs(enabled) WHERE enabled = true;

CREATE TRIGGER trg_auth_provider_configs_updated_at
    BEFORE UPDATE ON auth_provider_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_audit_auth_provider_configs
    AFTER INSERT OR UPDATE OR DELETE ON auth_provider_configs
    FOR EACH ROW
    EXECUTE FUNCTION log_audit_trail();

-- Now add the FK from users to auth_provider_configs
ALTER TABLE users
    ADD COLUMN auth_provider_config_id UUID REFERENCES auth_provider_configs(id);

-- Unique constraint on external identity (provider-scoped)
CREATE UNIQUE INDEX idx_users_external_identity_full
    ON users (auth_provider, auth_provider_config_id, auth_provider_user_id)
    WHERE auth_provider != 'local';
