-- Auth provider configs
CREATE TABLE IF NOT EXISTS auth_provider_configs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_type       VARCHAR(20) NOT NULL CHECK (provider_type IN ('oidc', 'saml', 'ldap')),
    name                VARCHAR(100) NOT NULL UNIQUE,
    display_name        VARCHAR(200) NOT NULL,
    enabled             BOOLEAN NOT NULL DEFAULT false,
    config              JSONB NOT NULL DEFAULT '{}',
    jit_provisioning    BOOLEAN NOT NULL DEFAULT false,
    default_role_id     UUID REFERENCES roles(id),
    display_order       SMALLINT NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by          UUID REFERENCES users(id),
    updated_by          UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_auth_provider_configs_type ON auth_provider_configs (provider_type);
CREATE INDEX IF NOT EXISTS idx_auth_provider_configs_enabled ON auth_provider_configs (enabled) WHERE enabled = true;

-- IdP role mappings
CREATE TABLE IF NOT EXISTS idp_role_mappings (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_config_id  UUID NOT NULL REFERENCES auth_provider_configs(id) ON DELETE CASCADE,
    idp_group           VARCHAR(500) NOT NULL,
    role_id             UUID NOT NULL REFERENCES roles(id),
    match_type          VARCHAR(20) NOT NULL DEFAULT 'exact' CHECK (match_type IN ('exact', 'prefix', 'contains')),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (provider_config_id, idp_group, role_id)
);

-- OIDC state store (in-memory via DashMap is fine, but DB-backed for multi-instance)
CREATE TABLE IF NOT EXISTS oidc_state_store (
    state               VARCHAR(128) PRIMARY KEY,
    provider_config_id  UUID NOT NULL REFERENCES auth_provider_configs(id) ON DELETE CASCADE,
    pkce_verifier       TEXT NOT NULL,
    nonce               VARCHAR(128) NOT NULL,
    redirect_uri        TEXT,
    expires_at          TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '10 minutes'),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_oidc_state_store_expires ON oidc_state_store (expires_at);

-- SAML request store
CREATE TABLE IF NOT EXISTS saml_request_store (
    request_id          VARCHAR(128) PRIMARY KEY,
    provider_config_id  UUID NOT NULL REFERENCES auth_provider_configs(id) ON DELETE CASCADE,
    relay_state         VARCHAR(500),
    expires_at          TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '10 minutes'),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add auth provider columns to users if not already present
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='auth_provider') THEN
        ALTER TABLE users
            ADD COLUMN auth_provider VARCHAR(20) NOT NULL DEFAULT 'local',
            ADD COLUMN auth_provider_config_id UUID REFERENCES auth_provider_configs(id),
            ADD COLUMN auth_provider_user_id VARCHAR(500),
            ADD COLUMN external_id VARCHAR(500);
    END IF;
END$$;

-- Make password_hash nullable (external auth users have no local password)
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_users_auth_provider ON users (auth_provider, auth_provider_config_id, auth_provider_user_id)
    WHERE auth_provider != 'local';
