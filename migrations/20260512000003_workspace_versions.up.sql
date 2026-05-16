CREATE TABLE workspace_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    workspace_id UUID NOT NULL REFERENCES design_objects(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    version_type VARCHAR(10) NOT NULL CHECK (version_type IN ('save', 'publish')),
    layout JSONB NOT NULL,
    label TEXT,
    parent_version_number INTEGER,
    metadata JSONB,
    deleted_at TIMESTAMPTZ,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (workspace_id, version_number)
);

CREATE INDEX idx_workspace_versions_workspace ON workspace_versions(workspace_id);
