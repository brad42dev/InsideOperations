-- CMMS/Maintenance: work orders, spare parts, PM schedules

CREATE TABLE work_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id VARCHAR(255),
    source_system VARCHAR(100),
    wo_number VARCHAR(100),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL
        CHECK (status IN ('open', 'in_progress', 'on_hold', 'completed', 'closed', 'cancelled')),
    priority VARCHAR(20) NOT NULL DEFAULT 'medium'
        CHECK (priority IN ('critical', 'high', 'medium', 'low')),
    work_type VARCHAR(50),
    equipment_id UUID REFERENCES equipment(id),
    point_id UUID REFERENCES points_metadata(id),
    assigned_to VARCHAR(200),
    assigned_group VARCHAR(200),
    requested_by VARCHAR(200),
    scheduled_start TIMESTAMPTZ,
    scheduled_end TIMESTAMPTZ,
    actual_start TIMESTAMPTZ,
    actual_end TIMESTAMPTZ,
    labor_hours DOUBLE PRECISION,
    parts_cost DOUBLE PRECISION,
    labor_cost DOUBLE PRECISION,
    total_cost DOUBLE PRECISION,
    failure_code VARCHAR(100),
    cause_code VARCHAR(100),
    remedy_code VARCHAR(100),
    permit_required BOOLEAN NOT NULL DEFAULT false,
    comments TEXT,
    extra_data JSONB NOT NULL DEFAULT '{}',
    import_run_id UUID REFERENCES import_runs(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_work_orders_external UNIQUE (source_system, external_id)
);

CREATE TABLE spare_parts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id VARCHAR(255),
    source_system VARCHAR(100),
    part_number VARCHAR(100) NOT NULL,
    description TEXT,
    quantity_on_hand DOUBLE PRECISION,
    reorder_point DOUBLE PRECISION,
    unit_cost DOUBLE PRECISION,
    currency VARCHAR(10) DEFAULT 'USD',
    warehouse_location VARCHAR(200),
    extra_data JSONB NOT NULL DEFAULT '{}',
    import_run_id UUID REFERENCES import_runs(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_spare_parts_external UNIQUE (source_system, external_id)
);

CREATE TABLE pm_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id VARCHAR(255),
    source_system VARCHAR(100),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    equipment_id UUID REFERENCES equipment(id),
    frequency_days INTEGER,
    last_completed_at TIMESTAMPTZ,
    next_due_at TIMESTAMPTZ,
    assigned_group VARCHAR(200),
    extra_data JSONB NOT NULL DEFAULT '{}',
    import_run_id UUID REFERENCES import_runs(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_pm_schedules_external UNIQUE (source_system, external_id)
);

-- Indexes
CREATE INDEX idx_work_orders_status ON work_orders (status) WHERE status NOT IN ('closed', 'cancelled');
CREATE INDEX idx_work_orders_equipment ON work_orders (equipment_id);
CREATE INDEX idx_work_orders_priority ON work_orders (priority, status);
CREATE INDEX idx_work_orders_scheduled ON work_orders (scheduled_start);
CREATE INDEX idx_spare_parts_number ON spare_parts (part_number);
CREATE INDEX idx_spare_parts_low_stock ON spare_parts (quantity_on_hand)
    WHERE quantity_on_hand <= reorder_point;
CREATE INDEX idx_pm_schedules_equipment ON pm_schedules (equipment_id);
CREATE INDEX idx_pm_schedules_due ON pm_schedules (next_due_at);

-- Triggers
CREATE TRIGGER trg_work_orders_updated_at
    BEFORE UPDATE ON work_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_spare_parts_updated_at
    BEFORE UPDATE ON spare_parts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_pm_schedules_updated_at
    BEFORE UPDATE ON pm_schedules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
