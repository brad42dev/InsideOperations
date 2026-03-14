-- ERP/Financial: inventory, purchase orders, cost centers

CREATE TABLE inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id VARCHAR(255),
    source_system VARCHAR(100),
    part_number VARCHAR(100) NOT NULL,
    description TEXT,
    quantity_on_hand DOUBLE PRECISION,
    quantity_reserved DOUBLE PRECISION,
    quantity_available DOUBLE PRECISION,
    reorder_point DOUBLE PRECISION,
    unit_cost DOUBLE PRECISION,
    currency VARCHAR(10) DEFAULT 'USD',
    warehouse_id VARCHAR(100),
    warehouse_name VARCHAR(200),
    bin_location VARCHAR(100),
    last_receipt_date DATE,
    last_issue_date DATE,
    extra_data JSONB NOT NULL DEFAULT '{}',
    import_run_id UUID REFERENCES import_runs(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_inventory_external UNIQUE (source_system, external_id)
);

CREATE TABLE purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id VARCHAR(255),
    source_system VARCHAR(100),
    po_number VARCHAR(100) NOT NULL,
    status VARCHAR(30) NOT NULL
        CHECK (status IN ('draft', 'approved', 'ordered', 'partially_received', 'received', 'closed', 'cancelled')),
    vendor_id UUID REFERENCES vendor_master(id),
    vendor_name VARCHAR(200),
    order_date DATE,
    expected_delivery_date DATE,
    total_amount DOUBLE PRECISION,
    currency VARCHAR(10) DEFAULT 'USD',
    created_by_name VARCHAR(200),
    extra_data JSONB NOT NULL DEFAULT '{}',
    import_run_id UUID REFERENCES import_runs(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_purchase_orders_external UNIQUE (source_system, external_id)
);

CREATE TABLE purchase_order_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,
    part_number VARCHAR(100),
    description TEXT,
    quantity_ordered DOUBLE PRECISION,
    quantity_received DOUBLE PRECISION,
    unit_price DOUBLE PRECISION,
    currency VARCHAR(10) DEFAULT 'USD',
    delivery_date DATE,
    extra_data JSONB NOT NULL DEFAULT '{}',
    CONSTRAINT uq_po_lines UNIQUE (purchase_order_id, line_number)
);

CREATE TABLE cost_centers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id VARCHAR(255),
    source_system VARCHAR(100),
    code VARCHAR(50) NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES cost_centers(id),
    budget_amount DOUBLE PRECISION,
    currency VARCHAR(10) DEFAULT 'USD',
    fiscal_year INTEGER,
    extra_data JSONB NOT NULL DEFAULT '{}',
    import_run_id UUID REFERENCES import_runs(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_cost_centers_external UNIQUE (source_system, external_id)
);

-- Indexes
CREATE INDEX idx_inventory_part ON inventory_items (part_number);
CREATE INDEX idx_purchase_orders_status ON purchase_orders (status) WHERE status NOT IN ('closed', 'cancelled');
CREATE INDEX idx_purchase_orders_vendor ON purchase_orders (vendor_id);

-- Triggers
CREATE TRIGGER trg_inventory_items_updated_at
    BEFORE UPDATE ON inventory_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_purchase_orders_updated_at
    BEFORE UPDATE ON purchase_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_cost_centers_updated_at
    BEFORE UPDATE ON cost_centers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
