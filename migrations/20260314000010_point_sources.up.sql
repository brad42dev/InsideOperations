-- Data source registry

CREATE TABLE point_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    source_type VARCHAR(50) NOT NULL
        CHECK (source_type IN ('opc_ua', 'modbus', 'manual', 'mqtt', 'csv')),
    status VARCHAR(20) NOT NULL DEFAULT 'inactive'
        CHECK (status IN ('active', 'inactive', 'error', 'connecting')),
    connection_config JSONB NOT NULL DEFAULT '{}',
    last_connected_at TIMESTAMPTZ,
    last_error_at TIMESTAMPTZ,
    last_error_message TEXT,
    enabled BOOLEAN NOT NULL DEFAULT true,
    description TEXT,
    data_category_id UUID REFERENCES data_categories(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_point_sources_name UNIQUE (name)
);

CREATE INDEX idx_point_sources_source_type ON point_sources(source_type);
CREATE INDEX idx_point_sources_status ON point_sources(status);
CREATE INDEX idx_point_sources_enabled ON point_sources(enabled) WHERE enabled = true;
CREATE INDEX idx_point_sources_category ON point_sources(data_category_id) WHERE data_category_id IS NOT NULL;

CREATE TRIGGER trg_point_sources_updated_at
    BEFORE UPDATE ON point_sources
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_audit_point_sources
    AFTER INSERT OR UPDATE OR DELETE ON point_sources
    FOR EACH ROW EXECUTE FUNCTION log_audit_trail();
