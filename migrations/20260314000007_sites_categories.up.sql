-- Sites, data categories, IdP role mappings, certificates

CREATE TABLE sites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL UNIQUE,
    code VARCHAR(20) NOT NULL UNIQUE,
    description TEXT,
    timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE user_sites (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, site_id)
);

CREATE TABLE data_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    is_predefined BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- IdP role mappings: structured external group → I/O role mapping
CREATE TABLE idp_role_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id UUID NOT NULL REFERENCES auth_provider_configs(id) ON DELETE CASCADE,
    match_type VARCHAR(20) NOT NULL CHECK (match_type IN ('exact', 'prefix', 'regex')),
    match_value VARCHAR(500) NOT NULL,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
    priority INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (provider_id, match_type, match_value, role_id, site_id)
);

-- TLS certificate tracking
CREATE TABLE certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    cert_type VARCHAR(20) NOT NULL CHECK (cert_type IN ('server', 'client', 'ca_trust')),
    subject_cn VARCHAR(500),
    issuer_cn VARCHAR(500),
    serial_number VARCHAR(200),
    not_before TIMESTAMPTZ,
    not_after TIMESTAMPTZ,
    fingerprint_sha256 VARCHAR(64),
    is_active BOOLEAN NOT NULL DEFAULT false,
    auto_renew BOOLEAN NOT NULL DEFAULT false,
    acme_account_id VARCHAR(200),
    cert_path VARCHAR(500),
    key_path VARCHAR(500),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_sites_active ON sites(is_active);
CREATE INDEX idx_user_sites_site ON user_sites(site_id);
CREATE INDEX idx_data_categories_predefined ON data_categories(is_predefined);
CREATE INDEX idx_idp_role_mappings_provider ON idp_role_mappings(provider_id);
CREATE INDEX idx_idp_role_mappings_active ON idp_role_mappings(provider_id, is_active);
CREATE INDEX idx_certificates_type ON certificates(cert_type);
CREATE INDEX idx_certificates_expiry ON certificates(not_after) WHERE is_active = true;

-- Triggers: updated_at
CREATE TRIGGER trg_sites_updated_at
    BEFORE UPDATE ON sites
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_data_categories_updated_at
    BEFORE UPDATE ON data_categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_idp_role_mappings_updated_at
    BEFORE UPDATE ON idp_role_mappings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_certificates_updated_at
    BEFORE UPDATE ON certificates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Audit triggers
CREATE TRIGGER trg_audit_sites
    AFTER INSERT OR UPDATE OR DELETE ON sites
    FOR EACH ROW EXECUTE FUNCTION log_audit_trail();

CREATE TRIGGER trg_audit_idp_role_mappings
    AFTER INSERT OR UPDATE OR DELETE ON idp_role_mappings
    FOR EACH ROW EXECUTE FUNCTION log_audit_trail();

CREATE TRIGGER trg_audit_certificates
    AFTER INSERT OR UPDATE OR DELETE ON certificates
    FOR EACH ROW EXECUTE FUNCTION log_audit_trail();
