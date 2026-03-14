-- Rounds module: templates, schedules, instances, responses, media

CREATE TABLE round_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    checkpoints JSONB NOT NULL DEFAULT '[]',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT uq_round_templates_name UNIQUE (name)
);

CREATE TABLE round_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES round_templates(id) ON DELETE CASCADE,
    recurrence_type VARCHAR(20) NOT NULL
        CHECK (recurrence_type IN ('per_shift', 'daily', 'interval', 'weekly', 'custom')),
    recurrence_config JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE round_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES round_templates(id) ON DELETE RESTRICT,
    schedule_id UUID REFERENCES round_schedules(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'in_progress', 'completed', 'missed', 'transferred')),
    assigned_to_shift UUID,
    locked_to_user UUID REFERENCES users(id),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    due_by TIMESTAMPTZ,
    transfer_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE round_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id UUID NOT NULL REFERENCES round_instances(id) ON DELETE CASCADE,
    checkpoint_index INTEGER NOT NULL,
    response_type VARCHAR(20) NOT NULL
        CHECK (response_type IN ('text', 'numeric', 'boolean', 'dropdown', 'multi_field')),
    response_value JSONB NOT NULL,
    calculated_value NUMERIC,
    expression_id UUID REFERENCES custom_expressions(id) ON DELETE SET NULL,
    gps_latitude DECIMAL(10,7),
    gps_longitude DECIMAL(10,7),
    barcode_scanned VARCHAR(255),
    is_out_of_range BOOLEAN NOT NULL DEFAULT false,
    alarm_triggered BOOLEAN NOT NULL DEFAULT false,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_round_responses_instance_checkpoint UNIQUE (instance_id, checkpoint_index)
);

CREATE TABLE round_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    response_id UUID NOT NULL REFERENCES round_responses(id) ON DELETE CASCADE,
    media_type VARCHAR(10) NOT NULL
        CHECK (media_type IN ('photo', 'video', 'audio')),
    file_path TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    is_required BOOLEAN NOT NULL DEFAULT false,
    extracted_text TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_round_templates_active ON round_templates(is_active) WHERE is_active = true AND deleted_at IS NULL;
CREATE INDEX idx_round_schedules_template ON round_schedules(template_id);
CREATE INDEX idx_round_schedules_active ON round_schedules(is_active) WHERE is_active = true;
CREATE INDEX idx_round_instances_template ON round_instances(template_id);
CREATE INDEX idx_round_instances_status ON round_instances(status, due_by);
CREATE INDEX idx_round_instances_shift ON round_instances(assigned_to_shift) WHERE assigned_to_shift IS NOT NULL;
CREATE INDEX idx_round_instances_user ON round_instances(locked_to_user) WHERE locked_to_user IS NOT NULL;
CREATE INDEX idx_round_instances_due ON round_instances(due_by) WHERE status IN ('pending', 'in_progress');
CREATE INDEX idx_round_responses_instance ON round_responses(instance_id);
CREATE INDEX idx_round_responses_alarm ON round_responses(instance_id) WHERE alarm_triggered = true;
CREATE INDEX idx_round_media_response ON round_media(response_id);
CREATE INDEX idx_round_media_extracted_text ON round_media USING GIN (to_tsvector('english', extracted_text)) WHERE extracted_text IS NOT NULL;

-- Triggers
CREATE TRIGGER trg_round_templates_updated_at
    BEFORE UPDATE ON round_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_round_schedules_updated_at
    BEFORE UPDATE ON round_schedules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_round_instances_updated_at
    BEFORE UPDATE ON round_instances FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_audit_round_templates
    AFTER INSERT OR UPDATE OR DELETE ON round_templates
    FOR EACH ROW EXECUTE FUNCTION log_audit_trail();

CREATE TRIGGER trg_audit_round_schedules
    AFTER INSERT OR UPDATE OR DELETE ON round_schedules
    FOR EACH ROW EXECUTE FUNCTION log_audit_trail();
