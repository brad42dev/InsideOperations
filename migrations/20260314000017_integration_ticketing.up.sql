-- Ticketing / ITSM: tickets and comments

CREATE TABLE tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id VARCHAR(255),
    source_system VARCHAR(100),
    ticket_number VARCHAR(100) NOT NULL,
    ticket_type VARCHAR(30) NOT NULL
        CHECK (ticket_type IN ('incident', 'change_request', 'problem', 'service_request')),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL
        CHECK (status IN ('new', 'open', 'in_progress', 'on_hold', 'resolved', 'closed', 'cancelled')),
    priority VARCHAR(20) NOT NULL DEFAULT 'medium'
        CHECK (priority IN ('critical', 'high', 'medium', 'low')),
    category VARCHAR(100),
    subcategory VARCHAR(100),
    is_ot BOOLEAN NOT NULL DEFAULT false,
    assigned_to VARCHAR(200),
    assigned_group VARCHAR(200),
    requester_name VARCHAR(200),
    requester_email VARCHAR(254),
    equipment_id UUID REFERENCES equipment(id),
    ci_name VARCHAR(200),
    ci_id VARCHAR(100),
    hostname VARCHAR(200),
    ip_address INET,
    location VARCHAR(200),
    planned_start_at TIMESTAMPTZ,
    planned_end_at TIMESTAMPTZ,
    created_at_source TIMESTAMPTZ,
    updated_at_source TIMESTAMPTZ,
    resolved_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    extra_data JSONB NOT NULL DEFAULT '{}',
    import_run_id UUID REFERENCES import_runs(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_tickets_external UNIQUE (source_system, external_id)
);

CREATE TABLE ticket_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
    external_id VARCHAR(255),
    author_name VARCHAR(200),
    comment_text TEXT NOT NULL,
    is_internal BOOLEAN NOT NULL DEFAULT false,
    commented_at TIMESTAMPTZ NOT NULL,
    extra_data JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_tickets_status ON tickets (status) WHERE status NOT IN ('closed', 'cancelled');
CREATE INDEX idx_tickets_type ON tickets (ticket_type);
CREATE INDEX idx_tickets_ot ON tickets (is_ot) WHERE is_ot = true;
CREATE INDEX idx_tickets_change_window ON tickets (planned_start_at, planned_end_at)
    WHERE ticket_type = 'change_request' AND planned_start_at IS NOT NULL;
CREATE INDEX idx_tickets_fts ON tickets USING GIN (to_tsvector('english', title || ' ' || COALESCE(description, '')));
CREATE INDEX idx_ticket_comments_ticket ON ticket_comments (ticket_id, commented_at);

-- Triggers
CREATE TRIGGER trg_tickets_updated_at
    BEFORE UPDATE ON tickets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
