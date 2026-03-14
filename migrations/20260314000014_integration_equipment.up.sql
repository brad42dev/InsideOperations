-- Equipment registry and related tables (vendor_master first for FK dep)

CREATE TABLE vendor_master (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id VARCHAR(255),
    source_system VARCHAR(100),
    vendor_code VARCHAR(50) NOT NULL,
    name VARCHAR(300) NOT NULL,
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100),
    contact_name VARCHAR(200),
    contact_email VARCHAR(254),
    contact_phone VARCHAR(50),
    payment_terms VARCHAR(100),
    lead_time_days INTEGER,
    performance_rating DOUBLE PRECISION,
    extra_data JSONB NOT NULL DEFAULT '{}',
    import_run_id UUID REFERENCES import_runs(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_vendor_external UNIQUE (source_system, external_id)
);

CREATE TABLE equipment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id VARCHAR(255),
    source_system VARCHAR(100),
    data_source VARCHAR(20) NOT NULL DEFAULT 'manual'
        CHECK (data_source IN ('imported', 'manual')),
    tag VARCHAR(100) NOT NULL,
    description TEXT,
    equipment_class VARCHAR(50)
        CHECK (equipment_class IN (
            'rotating', 'static', 'heat_exchanger', 'instrument',
            'electrical', 'piping', 'relief_device', 'structural'
        )),
    equipment_type VARCHAR(100),
    parent_id UUID REFERENCES equipment(id),
    functional_location VARCHAR(255),
    area VARCHAR(100),
    unit VARCHAR(100),
    site_id UUID REFERENCES sites(id),
    manufacturer VARCHAR(200),
    model_number VARCHAR(200),
    serial_number VARCHAR(200),
    year_installed INTEGER,
    design_pressure DOUBLE PRECISION,
    design_temperature DOUBLE PRECISION,
    material_of_construction VARCHAR(200),
    criticality SMALLINT CHECK (criticality BETWEEN 1 AND 5),
    safety_critical BOOLEAN NOT NULL DEFAULT false,
    environmental_critical BOOLEAN NOT NULL DEFAULT false,
    pid_reference VARCHAR(200),
    barcode VARCHAR(255),
    gps_latitude DOUBLE PRECISION,
    gps_longitude DOUBLE PRECISION,
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'inactive', 'decommissioned')),
    extra_data JSONB NOT NULL DEFAULT '{}',
    import_run_id UUID REFERENCES import_runs(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT uq_equipment_tag_site UNIQUE (tag, site_id)
);

CREATE TABLE equipment_points (
    equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
    point_id UUID NOT NULL REFERENCES points_metadata(id) ON DELETE CASCADE,
    relationship_type VARCHAR(30) NOT NULL DEFAULT 'primary_measurement'
        CHECK (relationship_type IN (
            'primary_measurement', 'secondary', 'control_output', 'diagnostic'
        )),
    PRIMARY KEY (equipment_id, point_id)
);

CREATE TABLE equipment_nameplate (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
    attribute_name VARCHAR(100) NOT NULL,
    attribute_value TEXT NOT NULL,
    unit_of_measure VARCHAR(50),
    extra_data JSONB NOT NULL DEFAULT '{}',
    CONSTRAINT uq_nameplate_attr UNIQUE (equipment_id, attribute_name)
);

CREATE TABLE equipment_criticality (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
    safety_impact SMALLINT NOT NULL CHECK (safety_impact BETWEEN 1 AND 5),
    environmental_impact SMALLINT NOT NULL CHECK (environmental_impact BETWEEN 1 AND 5),
    production_impact SMALLINT NOT NULL CHECK (production_impact BETWEEN 1 AND 5),
    maintenance_cost_impact SMALLINT NOT NULL CHECK (maintenance_cost_impact BETWEEN 1 AND 5),
    overall_criticality SMALLINT NOT NULL CHECK (overall_criticality BETWEEN 1 AND 5),
    assessment_date DATE,
    assessed_by VARCHAR(200),
    notes TEXT,
    extra_data JSONB NOT NULL DEFAULT '{}',
    import_run_id UUID REFERENCES import_runs(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_vendor_code ON vendor_master (vendor_code);
CREATE INDEX idx_equipment_class ON equipment (equipment_class);
CREATE INDEX idx_equipment_parent ON equipment (parent_id);
CREATE INDEX idx_equipment_area ON equipment (area);
CREATE INDEX idx_equipment_criticality ON equipment (criticality) WHERE criticality <= 2;
CREATE INDEX idx_equipment_external ON equipment (source_system, external_id);
CREATE INDEX idx_equipment_active ON equipment (status) WHERE status = 'active' AND deleted_at IS NULL;
CREATE INDEX idx_equipment_points_point ON equipment_points (point_id);
CREATE INDEX idx_equipment_nameplate_equip ON equipment_nameplate (equipment_id);
CREATE INDEX idx_equipment_criticality_equip ON equipment_criticality (equipment_id);

-- Updated_at triggers
CREATE TRIGGER trg_vendor_master_updated_at
    BEFORE UPDATE ON vendor_master FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_equipment_updated_at
    BEFORE UPDATE ON equipment FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Audit trigger on equipment (manually editable cross-domain entity)
CREATE TRIGGER trg_audit_equipment
    AFTER INSERT OR UPDATE OR DELETE ON equipment
    FOR EACH ROW EXECUTE FUNCTION log_audit_trail();
