-- no-transaction
-- Environmental: emissions, compliance, ambient monitoring, LDAR, permits, waste manifests

CREATE TABLE emissions_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id VARCHAR(255),
    source_system VARCHAR(100),
    source_name VARCHAR(200),
    parameter_name VARCHAR(200) NOT NULL,
    value DOUBLE PRECISION NOT NULL,
    unit VARCHAR(50),
    regulatory_limit DOUBLE PRECISION,
    exceedance BOOLEAN NOT NULL DEFAULT false,
    event_time TIMESTAMPTZ NOT NULL,
    duration_minutes DOUBLE PRECISION,
    cause TEXT,
    corrective_action TEXT,
    reported BOOLEAN NOT NULL DEFAULT false,
    extra_data JSONB NOT NULL DEFAULT '{}',
    import_run_id UUID REFERENCES import_runs(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_emissions_external UNIQUE (source_system, external_id)
);

CREATE TABLE compliance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id VARCHAR(255),
    source_system VARCHAR(100),
    record_type VARCHAR(20) NOT NULL
        CHECK (record_type IN ('inspection', 'audit', 'certification', 'violation')),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    status VARCHAR(30),
    agency VARCHAR(200),
    regulation_reference VARCHAR(200),
    due_date DATE,
    completed_date DATE,
    assigned_to VARCHAR(200),
    findings_count INTEGER,
    extra_data JSONB NOT NULL DEFAULT '{}',
    import_run_id UUID REFERENCES import_runs(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_compliance_external UNIQUE (source_system, external_id)
);

CREATE TABLE ambient_monitoring (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    station_id VARCHAR(100) NOT NULL,
    station_name VARCHAR(200),
    parameter_name VARCHAR(200) NOT NULL,
    value DOUBLE PRECISION NOT NULL,
    unit VARCHAR(50),
    measurement_time TIMESTAMPTZ NOT NULL,
    quality_flag VARCHAR(20),
    extra_data JSONB NOT NULL DEFAULT '{}',
    import_run_id UUID REFERENCES import_runs(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

SELECT create_hypertable('ambient_monitoring', 'measurement_time',
    chunk_time_interval => INTERVAL '1 day');

ALTER TABLE ambient_monitoring ADD CONSTRAINT pk_ambient PRIMARY KEY (id, measurement_time);
CREATE INDEX idx_ambient_station ON ambient_monitoring (station_id, measurement_time DESC);

CREATE TABLE ldar_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id VARCHAR(255),
    source_system VARCHAR(100),
    component_id VARCHAR(100),
    component_type VARCHAR(100),
    location VARCHAR(200),
    reading_ppm DOUBLE PRECISION,
    leak_threshold_ppm DOUBLE PRECISION,
    is_leak BOOLEAN NOT NULL DEFAULT false,
    inspection_date DATE,
    inspector_name VARCHAR(200),
    repair_date DATE,
    repair_method VARCHAR(200),
    extra_data JSONB NOT NULL DEFAULT '{}',
    import_run_id UUID REFERENCES import_runs(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_ldar_external UNIQUE (source_system, external_id)
);

CREATE TABLE permits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id VARCHAR(255),
    source_system VARCHAR(100),
    permit_type VARCHAR(100),
    permit_number VARCHAR(100),
    title VARCHAR(500) NOT NULL,
    issuing_agency VARCHAR(200),
    status VARCHAR(20) NOT NULL
        CHECK (status IN ('active', 'expired', 'pending_renewal', 'suspended')),
    issue_date DATE,
    expiry_date DATE,
    conditions JSONB,
    extra_data JSONB NOT NULL DEFAULT '{}',
    import_run_id UUID REFERENCES import_runs(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_permits_external UNIQUE (source_system, external_id)
);

CREATE TABLE waste_manifests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id VARCHAR(255),
    source_system VARCHAR(100),
    manifest_number VARCHAR(100),
    waste_code VARCHAR(50),
    waste_description TEXT,
    quantity DOUBLE PRECISION,
    unit VARCHAR(50),
    generator_name VARCHAR(200),
    transporter_name VARCHAR(200),
    destination_facility VARCHAR(200),
    ship_date DATE,
    receipt_date DATE,
    extra_data JSONB NOT NULL DEFAULT '{}',
    import_run_id UUID REFERENCES import_runs(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_waste_external UNIQUE (source_system, external_id)
);

-- Indexes
CREATE INDEX idx_emissions_time ON emissions_events (event_time DESC);
CREATE INDEX idx_emissions_exceedance ON emissions_events (exceedance) WHERE exceedance = true;
CREATE INDEX idx_ldar_leaks ON ldar_records (is_leak) WHERE is_leak = true;
CREATE INDEX idx_ldar_inspection ON ldar_records (inspection_date DESC);
CREATE INDEX idx_permits_expiry ON permits (expiry_date) WHERE status = 'active';

-- Triggers
CREATE TRIGGER trg_emissions_updated_at
    BEFORE UPDATE ON emissions_events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_compliance_updated_at
    BEFORE UPDATE ON compliance_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_ldar_updated_at
    BEFORE UPDATE ON ldar_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_permits_updated_at
    BEFORE UPDATE ON permits FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_waste_manifests_updated_at
    BEFORE UPDATE ON waste_manifests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
