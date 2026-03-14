-- Expression builder: saved custom expressions

CREATE TABLE custom_expressions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    expression JSONB NOT NULL,
    output_type VARCHAR(20) NOT NULL DEFAULT 'float'
        CHECK (output_type IN ('float', 'integer')),
    output_precision INTEGER DEFAULT 3
        CHECK (output_precision IS NULL OR (output_precision >= 0 AND output_precision <= 7)),
    expression_context VARCHAR(50) NOT NULL DEFAULT 'conversion'
        CHECK (expression_context IN ('conversion', 'calculated_value', 'alarm_condition', 'custom')),
    created_by UUID NOT NULL REFERENCES users(id),
    shared BOOLEAN NOT NULL DEFAULT false,
    referenced_point_ids UUID[] DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_custom_expressions_name UNIQUE (name)
);

-- Add expression FK to points_metadata (forward reference now resolved)
ALTER TABLE points_metadata
    ADD COLUMN custom_expression_id UUID REFERENCES custom_expressions(id) ON DELETE SET NULL;

CREATE INDEX idx_custom_expressions_created_by ON custom_expressions(created_by);
CREATE INDEX idx_custom_expressions_context ON custom_expressions(expression_context);
CREATE INDEX idx_custom_expressions_shared ON custom_expressions(shared) WHERE shared = true;
CREATE INDEX idx_custom_expressions_point_refs ON custom_expressions USING GIN (referenced_point_ids);
CREATE INDEX idx_points_metadata_custom_expression_id
    ON points_metadata(custom_expression_id) WHERE custom_expression_id IS NOT NULL;

CREATE TRIGGER trg_custom_expressions_updated_at
    BEFORE UPDATE ON custom_expressions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_audit_custom_expressions
    AFTER INSERT OR UPDATE OR DELETE ON custom_expressions
    FOR EACH ROW EXECUTE FUNCTION log_audit_trail();
