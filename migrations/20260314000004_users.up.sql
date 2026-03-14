-- Users table (auth_provider_config_id FK added later to break circular ref)

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255),
    email VARCHAR(255) UNIQUE,
    full_name VARCHAR(255),
    enabled BOOLEAN DEFAULT true,
    auth_provider VARCHAR(20) NOT NULL DEFAULT 'local',
    auth_provider_user_id TEXT,
    external_id TEXT,
    is_service_account BOOLEAN NOT NULL DEFAULT false,
    is_emergency_account BOOLEAN NOT NULL DEFAULT false,
    role_source VARCHAR(20) DEFAULT 'manual'
        CHECK (role_source IN ('manual', 'idp', 'both')),
    last_login_at TIMESTAMPTZ,
    mfa_enabled BOOLEAN NOT NULL DEFAULT false,
    mfa_enrollment_deadline TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_users_external_identity
    ON users (auth_provider, auth_provider_user_id)
    WHERE auth_provider != 'local' AND auth_provider_user_id IS NOT NULL;

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_enabled ON users(enabled);
CREATE INDEX idx_users_auth_provider ON users(auth_provider);
CREATE INDEX idx_users_service_account ON users(is_service_account) WHERE is_service_account = true;
CREATE INDEX idx_users_external_id ON users(external_id) WHERE external_id IS NOT NULL;
CREATE INDEX idx_users_emergency ON users(is_emergency_account) WHERE is_emergency_account = true;

CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER audit_users
    AFTER INSERT OR UPDATE OR DELETE ON users
    FOR EACH ROW
    EXECUTE FUNCTION log_audit_trail();
