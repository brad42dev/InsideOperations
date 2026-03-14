-- Settings, audit log, system logs, EULA tables

CREATE TABLE settings (
    key VARCHAR(255) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES users(id)
);

CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    table_name VARCHAR(100),
    record_id UUID,
    changes JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE system_logs (
    id BIGSERIAL PRIMARY KEY,
    level VARCHAR(20) NOT NULL,
    service VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- EULA versions (draft → active → archived lifecycle)
CREATE TABLE eula_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version VARCHAR(20) NOT NULL UNIQUE,
    title VARCHAR(255) NOT NULL DEFAULT 'End User License Agreement',
    content TEXT NOT NULL,
    content_hash VARCHAR(64) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT false,
    published_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES users(id),
    published_by UUID REFERENCES users(id)
);

CREATE UNIQUE INDEX idx_eula_versions_active ON eula_versions (is_active) WHERE is_active = true;

-- EULA acceptances (append-only, immutable)
CREATE TABLE eula_acceptances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    eula_version_id UUID NOT NULL REFERENCES eula_versions(id),
    accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    accepted_from_ip INET NOT NULL,
    accepted_as_role TEXT NOT NULL,
    username_snapshot VARCHAR(50) NOT NULL,
    user_agent TEXT NOT NULL,
    content_hash VARCHAR(64) NOT NULL
);

CREATE INDEX idx_eula_acceptances_user_version ON eula_acceptances (user_id, eula_version_id);
CREATE INDEX idx_eula_acceptances_version_date ON eula_acceptances (eula_version_id, accepted_at);

-- Indexes
CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX idx_audit_log_table_name ON audit_log(table_name);
CREATE INDEX idx_system_logs_timestamp ON system_logs(timestamp DESC);
CREATE INDEX idx_system_logs_level ON system_logs(level);
CREATE INDEX idx_system_logs_service ON system_logs(service);

-- Settings updated_at trigger
CREATE TRIGGER trg_settings_updated_at
    BEFORE UPDATE ON settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- EULA integrity triggers
CREATE TRIGGER trg_prevent_eula_version_delete
    BEFORE DELETE ON eula_versions
    FOR EACH ROW EXECUTE FUNCTION prevent_eula_version_delete();

CREATE TRIGGER trg_prevent_eula_version_content_edit
    BEFORE UPDATE ON eula_versions
    FOR EACH ROW EXECUTE FUNCTION prevent_eula_version_content_edit();

CREATE TRIGGER trg_prevent_eula_acceptance_update
    BEFORE UPDATE ON eula_acceptances
    FOR EACH ROW EXECUTE FUNCTION prevent_eula_acceptance_modify();

CREATE TRIGGER trg_prevent_eula_acceptance_delete
    BEFORE DELETE ON eula_acceptances
    FOR EACH ROW EXECUTE FUNCTION prevent_eula_acceptance_modify();

-- Audit trigger on settings
CREATE TRIGGER trg_audit_settings
    AFTER INSERT OR UPDATE OR DELETE ON settings
    FOR EACH ROW EXECUTE FUNCTION log_audit_trail();
