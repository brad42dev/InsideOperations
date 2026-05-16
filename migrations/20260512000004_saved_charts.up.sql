CREATE TABLE saved_charts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    chart_type INTEGER NOT NULL,
    config JSONB NOT NULL,
    published BOOLEAN NOT NULL DEFAULT false,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_saved_charts_created_by ON saved_charts(created_by);
CREATE INDEX idx_saved_charts_published ON saved_charts(published) WHERE published = true;

CREATE TRIGGER trg_saved_charts_updated_at
    BEFORE UPDATE ON saved_charts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
