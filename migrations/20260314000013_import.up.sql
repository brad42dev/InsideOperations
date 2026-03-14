-- Universal Import: connector templates, connections, definitions, schedules, runs, errors

CREATE TABLE connector_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    domain VARCHAR(50) NOT NULL
        CHECK (domain IN (
            'maintenance', 'equipment', 'access_control', 'erp_financial',
            'ticketing', 'environmental', 'lims_lab', 'regulatory'
        )),
    vendor VARCHAR(100) NOT NULL,
    description TEXT,
    template_config JSONB NOT NULL,
    required_fields JSONB NOT NULL,
    target_tables TEXT[] NOT NULL,
    version VARCHAR(20) NOT NULL DEFAULT '1.0',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE import_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    connection_type VARCHAR(100) NOT NULL,
    config JSONB NOT NULL DEFAULT '{}',
    auth_type VARCHAR(50) NOT NULL DEFAULT 'none',
    auth_config JSONB NOT NULL DEFAULT '{}',
    enabled BOOLEAN NOT NULL DEFAULT true,
    data_category_id UUID REFERENCES data_categories(id),
    last_tested_at TIMESTAMPTZ,
    last_test_status VARCHAR(20),
    last_test_message TEXT,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_import_connections_name UNIQUE (name)
);

CREATE TABLE import_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID NOT NULL REFERENCES import_connections(id) ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    source_config JSONB NOT NULL DEFAULT '{}',
    field_mappings JSONB NOT NULL DEFAULT '[]',
    transforms JSONB NOT NULL DEFAULT '[]',
    validation_rules JSONB NOT NULL DEFAULT '{}',
    target_table VARCHAR(100) NOT NULL,
    error_strategy VARCHAR(20) NOT NULL DEFAULT 'quarantine'
        CHECK (error_strategy IN ('stop', 'skip', 'quarantine', 'threshold')),
    error_threshold_percent NUMERIC(5,2) DEFAULT 10.00,
    batch_size INTEGER NOT NULL DEFAULT 1000,
    template_id UUID REFERENCES connector_templates(id) ON DELETE SET NULL,
    template_version VARCHAR(20),
    point_column VARCHAR(100),
    point_column_transforms JSONB,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_import_definitions_name UNIQUE (name)
);

CREATE TABLE import_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_definition_id UUID NOT NULL REFERENCES import_definitions(id) ON DELETE CASCADE,
    schedule_type VARCHAR(20) NOT NULL
        CHECK (schedule_type IN ('cron', 'interval', 'manual', 'file_arrival', 'webhook', 'dependency')),
    schedule_config JSONB NOT NULL DEFAULT '{}',
    enabled BOOLEAN NOT NULL DEFAULT true,
    next_run_at TIMESTAMPTZ,
    last_run_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE import_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_definition_id UUID NOT NULL REFERENCES import_definitions(id) ON DELETE CASCADE,
    schedule_id UUID REFERENCES import_schedules(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled', 'partial')),
    triggered_by VARCHAR(20) NOT NULL DEFAULT 'manual'
        CHECK (triggered_by IN ('manual', 'schedule', 'webhook', 'file_arrival', 'dependency', 'retry')),
    dry_run BOOLEAN NOT NULL DEFAULT false,
    rows_extracted INTEGER DEFAULT 0,
    rows_mapped INTEGER DEFAULT 0,
    rows_transformed INTEGER DEFAULT 0,
    rows_validated INTEGER DEFAULT 0,
    rows_loaded INTEGER DEFAULT 0,
    rows_errored INTEGER DEFAULT 0,
    rows_skipped INTEGER DEFAULT 0,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    watermark_state JSONB,
    run_metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE import_errors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_run_id UUID NOT NULL REFERENCES import_runs(id) ON DELETE CASCADE,
    row_number INTEGER,
    field_name VARCHAR(255),
    error_type VARCHAR(50) NOT NULL,
    error_message TEXT NOT NULL,
    raw_value TEXT,
    raw_row JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE custom_import_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_definition_id UUID NOT NULL REFERENCES import_definitions(id) ON DELETE CASCADE,
    data JSONB NOT NULL,
    source_row_id VARCHAR(255),
    imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Triggers: updated_at
CREATE TRIGGER trg_import_connections_updated_at
    BEFORE UPDATE ON import_connections
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_import_definitions_updated_at
    BEFORE UPDATE ON import_definitions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_import_schedules_updated_at
    BEFORE UPDATE ON import_schedules
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Audit triggers
CREATE TRIGGER trg_audit_import_connections
    AFTER INSERT OR UPDATE OR DELETE ON import_connections
    FOR EACH ROW EXECUTE FUNCTION log_audit_trail();

CREATE TRIGGER trg_audit_import_definitions
    AFTER INSERT OR UPDATE OR DELETE ON import_definitions
    FOR EACH ROW EXECUTE FUNCTION log_audit_trail();
