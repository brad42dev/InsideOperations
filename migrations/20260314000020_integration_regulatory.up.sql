-- Regulatory/Compliance: MOC, safety incidents, inspection findings, regulatory permits, risk assessments

CREATE TABLE moc_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id VARCHAR(255),
    source_system VARCHAR(100),
    moc_number VARCHAR(100),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL
        CHECK (status IN ('draft', 'submitted', 'under_review', 'approved', 'implemented', 'closed', 'rejected')),
    category VARCHAR(30)
        CHECK (category IN ('process', 'equipment', 'procedure', 'organization', 'temporary')),
    risk_level VARCHAR(10)
        CHECK (risk_level IN ('high', 'medium', 'low')),
    originator VARCHAR(200),
    approver VARCHAR(200),
    submitted_at TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,
    implementation_due_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    affected_equipment_ids UUID[],
    affected_point_ids UUID[],
    extra_data JSONB NOT NULL DEFAULT '{}',
    import_run_id UUID REFERENCES import_runs(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_moc_external UNIQUE (source_system, external_id)
);

CREATE TABLE safety_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id VARCHAR(255),
    source_system VARCHAR(100),
    incident_number VARCHAR(100),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    incident_type VARCHAR(30) NOT NULL
        CHECK (incident_type IN (
            'injury', 'near_miss', 'property_damage',
            'environmental_release', 'process_safety', 'fire'
        )),
    severity VARCHAR(20)
        CHECK (severity IN ('catastrophic', 'major', 'moderate', 'minor', 'negligible')),
    status VARCHAR(30) NOT NULL
        CHECK (status IN ('reported', 'under_investigation', 'corrective_action', 'closed')),
    location VARCHAR(200),
    area VARCHAR(100),
    occurred_at TIMESTAMPTZ,
    reported_at TIMESTAMPTZ,
    reported_by VARCHAR(200),
    root_cause TEXT,
    corrective_actions JSONB,
    extra_data JSONB NOT NULL DEFAULT '{}',
    import_run_id UUID REFERENCES import_runs(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_incidents_external UNIQUE (source_system, external_id)
);

CREATE TABLE inspection_findings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id VARCHAR(255),
    source_system VARCHAR(100),
    inspection_type VARCHAR(30) NOT NULL
        CHECK (inspection_type IN ('regulatory', 'internal', 'insurance', 'mechanical_integrity')),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    finding_type VARCHAR(20) NOT NULL
        CHECK (finding_type IN ('observation', 'minor_finding', 'major_finding', 'critical_finding')),
    status VARCHAR(20) NOT NULL
        CHECK (status IN ('open', 'in_progress', 'closed', 'overdue')),
    equipment_id UUID REFERENCES equipment(id),
    assigned_to VARCHAR(200),
    due_date DATE,
    closed_date DATE,
    regulation_reference VARCHAR(200),
    extra_data JSONB NOT NULL DEFAULT '{}',
    import_run_id UUID REFERENCES import_runs(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_findings_external UNIQUE (source_system, external_id)
);

CREATE TABLE regulatory_permits (
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
    responsible_person VARCHAR(200),
    extra_data JSONB NOT NULL DEFAULT '{}',
    import_run_id UUID REFERENCES import_runs(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_reg_permits_external UNIQUE (source_system, external_id)
);

CREATE TABLE risk_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id VARCHAR(255),
    source_system VARCHAR(100),
    assessment_type VARCHAR(20) NOT NULL
        CHECK (assessment_type IN ('pha', 'hazop', 'lopa', 'what_if', 'bowtie')),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    status VARCHAR(30),
    facility_area VARCHAR(200),
    unit VARCHAR(100),
    assessment_date DATE,
    next_revalidation_date DATE,
    team_lead VARCHAR(200),
    recommendations_count INTEGER,
    open_actions_count INTEGER,
    extra_data JSONB NOT NULL DEFAULT '{}',
    import_run_id UUID REFERENCES import_runs(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_risk_external UNIQUE (source_system, external_id)
);

-- Indexes
CREATE INDEX idx_moc_status ON moc_records (status) WHERE status NOT IN ('closed', 'rejected');
CREATE INDEX idx_moc_due ON moc_records (implementation_due_at)
    WHERE status IN ('approved', 'implemented');
CREATE INDEX idx_incidents_type ON safety_incidents (incident_type);
CREATE INDEX idx_incidents_occurred ON safety_incidents (occurred_at DESC);
CREATE INDEX idx_incidents_open ON safety_incidents (status) WHERE status != 'closed';
CREATE INDEX idx_findings_status ON inspection_findings (status) WHERE status NOT IN ('closed');
CREATE INDEX idx_findings_equipment ON inspection_findings (equipment_id);
CREATE INDEX idx_findings_due ON inspection_findings (due_date) WHERE status IN ('open', 'in_progress');
CREATE INDEX idx_reg_permits_expiry ON regulatory_permits (expiry_date) WHERE status = 'active';
CREATE INDEX idx_risk_revalidation ON risk_assessments (next_revalidation_date);

-- Triggers
CREATE TRIGGER trg_moc_records_updated_at
    BEFORE UPDATE ON moc_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_safety_incidents_updated_at
    BEFORE UPDATE ON safety_incidents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_inspection_findings_updated_at
    BEFORE UPDATE ON inspection_findings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_regulatory_permits_updated_at
    BEFORE UPDATE ON regulatory_permits FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_risk_assessments_updated_at
    BEFORE UPDATE ON risk_assessments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
