CREATE TABLE saved_chart_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chart_id UUID NOT NULL REFERENCES saved_charts(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    version_type VARCHAR(10) NOT NULL CHECK (version_type IN ('save', 'publish')),
    config JSONB NOT NULL,
    label VARCHAR(255),
    parent_version_number INTEGER,
    metadata JSONB,
    deleted_at TIMESTAMPTZ,
    created_by UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (chart_id, version_number)
);

CREATE INDEX idx_saved_chart_versions_chart_id ON saved_chart_versions(chart_id);
CREATE INDEX idx_saved_chart_versions_deleted ON saved_chart_versions(deleted_at) WHERE deleted_at IS NOT NULL;
