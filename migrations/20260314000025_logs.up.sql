-- Log module: templates, segments, schedules, instances, entries, media

CREATE TABLE log_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    segment_ids UUID[] NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT uq_log_templates_name UNIQUE (name)
);

CREATE TABLE log_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    segment_type VARCHAR(20) NOT NULL
        CHECK (segment_type IN ('wysiwyg', 'field_table', 'field_list', 'point_data')),
    content_config JSONB NOT NULL DEFAULT '{}',
    is_reusable BOOLEAN NOT NULL DEFAULT true,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE log_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES log_templates(id) ON DELETE CASCADE,
    recurrence_type VARCHAR(20) NOT NULL
        CHECK (recurrence_type IN ('per_shift', 'daily', 'interval', 'weekly', 'custom')),
    recurrence_config JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE log_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES log_templates(id) ON DELETE RESTRICT,
    schedule_id UUID REFERENCES log_schedules(id) ON DELETE SET NULL,
    shift_id UUID,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'in_progress', 'completed')),
    team_name VARCHAR(100),
    assigned_to_shift UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE log_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id UUID NOT NULL REFERENCES log_instances(id) ON DELETE CASCADE,
    segment_id UUID NOT NULL REFERENCES log_segments(id) ON DELETE RESTRICT,
    content JSONB NOT NULL DEFAULT '{}',
    content_text TEXT,
    content_tsvector TSVECTOR GENERATED ALWAYS AS (
        to_tsvector('english', COALESCE(content_text, ''))
    ) STORED,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_log_entries_instance_segment UNIQUE (instance_id, segment_id)
);

CREATE TABLE log_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_id UUID NOT NULL REFERENCES log_entries(id) ON DELETE CASCADE,
    media_type VARCHAR(10) NOT NULL
        CHECK (media_type IN ('photo', 'video', 'audio')),
    file_path TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    extracted_text TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_log_templates_active ON log_templates(is_active) WHERE is_active = true AND deleted_at IS NULL;
CREATE INDEX idx_log_segments_type ON log_segments(segment_type);
CREATE INDEX idx_log_segments_reusable ON log_segments(is_reusable) WHERE is_reusable = true;
CREATE INDEX idx_log_schedules_template ON log_schedules(template_id);
CREATE INDEX idx_log_instances_template ON log_instances(template_id);
CREATE INDEX idx_log_instances_status ON log_instances(status);
CREATE INDEX idx_log_instances_shift ON log_instances(shift_id) WHERE shift_id IS NOT NULL;
CREATE INDEX idx_log_instances_team ON log_instances(team_name) WHERE team_name IS NOT NULL;
CREATE INDEX idx_log_entries_fts ON log_entries USING GIN (content_tsvector);
CREATE INDEX idx_log_entries_instance ON log_entries(instance_id);
CREATE INDEX idx_log_entries_created_by ON log_entries(created_by);
CREATE INDEX idx_log_entries_created_at ON log_entries(created_at DESC);
CREATE INDEX idx_log_media_entry ON log_media(entry_id);
CREATE INDEX idx_log_media_extracted_text ON log_media USING GIN (to_tsvector('english', extracted_text)) WHERE extracted_text IS NOT NULL;

-- Triggers
CREATE TRIGGER trg_log_templates_updated_at
    BEFORE UPDATE ON log_templates FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_log_segments_updated_at
    BEFORE UPDATE ON log_segments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_log_schedules_updated_at
    BEFORE UPDATE ON log_schedules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_log_instances_updated_at
    BEFORE UPDATE ON log_instances FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_log_entries_updated_at
    BEFORE UPDATE ON log_entries FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_audit_log_templates
    AFTER INSERT OR UPDATE OR DELETE ON log_templates
    FOR EACH ROW EXECUTE FUNCTION log_audit_trail();

CREATE TRIGGER trg_audit_log_schedules
    AFTER INSERT OR UPDATE OR DELETE ON log_schedules
    FOR EACH ROW EXECUTE FUNCTION log_audit_trail();

CREATE TRIGGER trg_audit_log_segments
    AFTER INSERT OR UPDATE OR DELETE ON log_segments
    FOR EACH ROW EXECUTE FUNCTION log_audit_trail();
