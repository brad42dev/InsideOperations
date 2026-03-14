-- Forensics/Investigation module: investigations, stages, evidence, points, shares, links

CREATE TABLE investigations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(500) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'closed', 'cancelled')),
    anchor_point_id UUID REFERENCES points_metadata(id),
    anchor_alarm_id UUID,
    snapshot JSONB,
    created_by UUID NOT NULL REFERENCES users(id),
    closed_at TIMESTAMPTZ,
    closed_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE investigation_stages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investigation_id UUID NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
    name VARCHAR(500) NOT NULL,
    sort_order SMALLINT NOT NULL DEFAULT 0,
    time_range_start TIMESTAMPTZ NOT NULL,
    time_range_end TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE investigation_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stage_id UUID NOT NULL REFERENCES investigation_stages(id) ON DELETE CASCADE,
    evidence_type VARCHAR(50) NOT NULL
        CHECK (evidence_type IN ('trend', 'point_detail', 'alarm_list', 'value_table',
            'graphic_snapshot', 'correlation', 'log_entries', 'round_entries',
            'calculated_series', 'annotation')),
    config JSONB NOT NULL,
    sort_order SMALLINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE investigation_points (
    investigation_id UUID NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
    point_id UUID NOT NULL REFERENCES points_metadata(id),
    status VARCHAR(20) NOT NULL DEFAULT 'included'
        CHECK (status IN ('included', 'suggested', 'removed')),
    removal_reason TEXT,
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    removed_at TIMESTAMPTZ,
    PRIMARY KEY (investigation_id, point_id)
);

CREATE TABLE investigation_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investigation_id UUID NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
    shared_with_user_id UUID REFERENCES users(id),
    shared_with_role VARCHAR(100),
    shared_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    shared_by UUID NOT NULL REFERENCES users(id)
);

CREATE TABLE investigation_links (
    investigation_id UUID NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
    linked_entity_type VARCHAR(50) NOT NULL
        CHECK (linked_entity_type IN ('log_entry', 'ticket', 'alarm_event', 'investigation')),
    linked_entity_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id),
    PRIMARY KEY (investigation_id, linked_entity_type, linked_entity_id)
);

-- Indexes
CREATE INDEX idx_investigations_created_by ON investigations(created_by);
CREATE INDEX idx_investigations_status ON investigations(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_investigations_anchor_point ON investigations(anchor_point_id) WHERE anchor_point_id IS NOT NULL;
CREATE INDEX idx_investigation_stages_investigation ON investigation_stages(investigation_id);
CREATE INDEX idx_investigation_evidence_stage ON investigation_evidence(stage_id);
CREATE INDEX idx_investigation_shares_investigation ON investigation_shares(investigation_id);
CREATE INDEX idx_investigation_shares_user ON investigation_shares(shared_with_user_id) WHERE shared_with_user_id IS NOT NULL;

-- Triggers: updated_at
CREATE TRIGGER trg_investigations_updated_at
    BEFORE UPDATE ON investigations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_investigation_stages_updated_at
    BEFORE UPDATE ON investigation_stages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_investigation_evidence_updated_at
    BEFORE UPDATE ON investigation_evidence FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Audit triggers
CREATE TRIGGER trg_audit_investigations
    AFTER INSERT OR UPDATE OR DELETE ON investigations
    FOR EACH ROW EXECUTE FUNCTION log_audit_trail();

CREATE TRIGGER trg_audit_investigation_shares
    AFTER INSERT OR UPDATE OR DELETE ON investigation_shares
    FOR EACH ROW EXECUTE FUNCTION log_audit_trail();
