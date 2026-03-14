-- Extended auth: MFA, API keys, auth flow state, SCIM tokens

CREATE TYPE mfa_type AS ENUM ('totp', 'duo', 'sms', 'email');

-- MFA enrollment per user
CREATE TABLE user_mfa (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mfa_type mfa_type NOT NULL,
    secret TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending_verification',
    verified_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, mfa_type)
);

-- MFA recovery codes (single-use, stored as Argon2id hashes)
CREATE TABLE mfa_recovery_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash VARCHAR(255) NOT NULL,
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Per-role MFA policies
CREATE TABLE mfa_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID REFERENCES roles(id) UNIQUE,
    mfa_required BOOLEAN NOT NULL DEFAULT false,
    allowed_methods TEXT[] NOT NULL DEFAULT '{}',
    required_method TEXT,
    grace_period_hours INT NOT NULL DEFAULT 0,
    max_failures SMALLINT NOT NULL DEFAULT 5,
    lockout_duration_minutes INT NOT NULL DEFAULT 30,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- API keys for service accounts
CREATE TABLE api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    key_hash VARCHAR(255) NOT NULL,
    key_prefix VARCHAR(10) NOT NULL,
    scopes TEXT[],
    expires_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES users(id)
);

-- OIDC/SAML state storage (short-lived, in-flight auth flows)
CREATE TABLE auth_flow_state (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_type VARCHAR(20) NOT NULL,
    state_token VARCHAR(255) NOT NULL UNIQUE,
    nonce VARCHAR(255),
    code_verifier VARCHAR(255),
    relay_state TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- SCIM bearer tokens
CREATE TABLE scim_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    token_prefix VARCHAR(10) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT true,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES users(id)
);

-- Indexes
CREATE INDEX idx_user_mfa_user_id ON user_mfa(user_id);
CREATE INDEX idx_user_mfa_active ON user_mfa(user_id, mfa_type) WHERE status = 'active';
CREATE INDEX idx_mfa_recovery_codes_user ON mfa_recovery_codes(user_id) WHERE used_at IS NULL;
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_prefix ON api_keys(key_prefix);
CREATE INDEX idx_api_keys_expires ON api_keys(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX idx_auth_flow_state_token ON auth_flow_state(state_token);
CREATE INDEX idx_auth_flow_state_expiry ON auth_flow_state(expires_at);
CREATE INDEX idx_scim_tokens_enabled ON scim_tokens(enabled) WHERE enabled = true;

-- Triggers
CREATE TRIGGER trg_mfa_policies_updated_at
    BEFORE UPDATE ON mfa_policies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_audit_user_mfa
    AFTER INSERT OR UPDATE OR DELETE ON user_mfa
    FOR EACH ROW EXECUTE FUNCTION log_audit_trail();

CREATE TRIGGER trg_audit_mfa_policies
    AFTER INSERT OR UPDATE OR DELETE ON mfa_policies
    FOR EACH ROW EXECUTE FUNCTION log_audit_trail();

CREATE TRIGGER trg_audit_api_keys
    AFTER INSERT OR UPDATE OR DELETE ON api_keys
    FOR EACH ROW EXECUTE FUNCTION log_audit_trail();

CREATE TRIGGER trg_audit_scim_tokens
    AFTER INSERT OR UPDATE OR DELETE ON scim_tokens
    FOR EACH ROW EXECUTE FUNCTION log_audit_trail();
