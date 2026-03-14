-- LIMS / Lab: sample points, samples, results, product specifications

CREATE TABLE sample_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id VARCHAR(255),
    source_system VARCHAR(100),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    location VARCHAR(200),
    unit VARCHAR(100),
    area VARCHAR(100),
    stream_type VARCHAR(30)
        CHECK (stream_type IN ('feed', 'product', 'intermediate', 'utility', 'environmental')),
    linked_point_id UUID REFERENCES points_metadata(id),
    extra_data JSONB NOT NULL DEFAULT '{}',
    import_run_id UUID REFERENCES import_runs(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_sample_points_external UNIQUE (source_system, external_id)
);

CREATE TABLE lab_samples (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id VARCHAR(255),
    source_system VARCHAR(100),
    sample_number VARCHAR(100) NOT NULL,
    sample_type VARCHAR(30) NOT NULL
        CHECK (sample_type IN (
            'product', 'process', 'environmental', 'water_chemistry',
            'crude_assay', 'equipment_analysis'
        )),
    sample_point_id UUID REFERENCES sample_points(id),
    equipment_id UUID REFERENCES equipment(id),
    description TEXT,
    collected_by VARCHAR(200),
    collected_at TIMESTAMPTZ,
    received_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    status VARCHAR(20) NOT NULL DEFAULT 'collected'
        CHECK (status IN ('collected', 'received', 'in_progress', 'approved', 'rejected')),
    batch_id VARCHAR(100),
    product_grade VARCHAR(100),
    extra_data JSONB NOT NULL DEFAULT '{}',
    import_run_id UUID REFERENCES import_runs(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_lab_samples_external UNIQUE (source_system, external_id)
);

CREATE TABLE lab_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sample_id UUID NOT NULL REFERENCES lab_samples(id) ON DELETE CASCADE,
    external_id VARCHAR(255),
    test_name VARCHAR(200) NOT NULL,
    test_method VARCHAR(100),
    parameter_name VARCHAR(200) NOT NULL,
    value DOUBLE PRECISION,
    value_text VARCHAR(500),
    unit VARCHAR(50),
    spec_low DOUBLE PRECISION,
    spec_high DOUBLE PRECISION,
    in_spec BOOLEAN,
    result_source VARCHAR(20) DEFAULT 'lab'
        CHECK (result_source IN ('lab', 'online_analyzer')),
    analyst_name VARCHAR(200),
    approved_by VARCHAR(200),
    approved_at TIMESTAMPTZ,
    extra_data JSONB NOT NULL DEFAULT '{}',
    import_run_id UUID REFERENCES import_runs(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE product_specifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id VARCHAR(255),
    source_system VARCHAR(100),
    product_name VARCHAR(200) NOT NULL,
    product_grade VARCHAR(100),
    parameter_name VARCHAR(200) NOT NULL,
    test_method VARCHAR(100),
    spec_min DOUBLE PRECISION,
    spec_max DOUBLE PRECISION,
    unit VARCHAR(50),
    regulatory BOOLEAN NOT NULL DEFAULT false,
    customer_specific BOOLEAN NOT NULL DEFAULT false,
    extra_data JSONB NOT NULL DEFAULT '{}',
    import_run_id UUID REFERENCES import_runs(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_product_specs UNIQUE (product_name, product_grade, parameter_name)
);

-- Indexes
CREATE INDEX idx_lab_samples_collected ON lab_samples (collected_at DESC);
CREATE INDEX idx_lab_samples_type ON lab_samples (sample_type);
CREATE INDEX idx_lab_samples_equipment ON lab_samples (equipment_id);
CREATE INDEX idx_lab_samples_point ON lab_samples (sample_point_id);
CREATE INDEX idx_lab_results_sample ON lab_results (sample_id);
CREATE INDEX idx_lab_results_parameter ON lab_results (parameter_name);
CREATE INDEX idx_lab_results_out_of_spec ON lab_results (in_spec) WHERE in_spec = false;

-- Triggers
CREATE TRIGGER trg_sample_points_updated_at
    BEFORE UPDATE ON sample_points FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_lab_samples_updated_at
    BEFORE UPDATE ON lab_samples FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_product_specs_updated_at
    BEFORE UPDATE ON product_specifications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
