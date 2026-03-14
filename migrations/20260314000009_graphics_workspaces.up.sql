-- Graphics, workspaces, dashboards, report templates, window groups

CREATE TABLE design_objects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    svg_data TEXT,
    bindings JSONB,
    parent_id UUID REFERENCES design_objects(id) ON DELETE CASCADE,
    metadata JSONB,
    locked_by UUID REFERENCES users(id),
    locked_at TIMESTAMPTZ,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE design_object_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    design_object_id UUID NOT NULL REFERENCES design_objects(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL,
    version_type VARCHAR(10) NOT NULL CHECK (version_type IN ('draft', 'publish')),
    svg_data TEXT NOT NULL,
    bindings JSONB,
    metadata JSONB,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_design_object_versions_object ON design_object_versions(design_object_id);
CREATE UNIQUE INDEX idx_design_object_versions_unique ON design_object_versions(design_object_id, version_number);

CREATE TABLE workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    layout JSONB NOT NULL,
    published BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE workspace_shares (
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    grantee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    grantee_type VARCHAR(10) NOT NULL DEFAULT 'user' CHECK (grantee_type IN ('user', 'group')),
    permission_level VARCHAR(20) NOT NULL DEFAULT 'view' CHECK (permission_level IN ('view', 'edit')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (workspace_id, grantee_id)
);

CREATE TABLE dashboards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    layout JSONB NOT NULL,
    widgets JSONB NOT NULL,
    published BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE dashboard_shares (
    dashboard_id UUID NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
    grantee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    grantee_type VARCHAR(10) NOT NULL DEFAULT 'user' CHECK (grantee_type IN ('user', 'group')),
    permission_level VARCHAR(20) NOT NULL DEFAULT 'view' CHECK (permission_level IN ('view', 'edit')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (dashboard_id, grantee_id)
);

CREATE TABLE report_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    template_config JSONB NOT NULL,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE window_groups (
    group_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    owner_id UUID NOT NULL REFERENCES users(id),
    is_published BOOLEAN DEFAULT FALSE,
    configuration JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_design_objects_type ON design_objects(type);
CREATE INDEX idx_design_objects_parent_id ON design_objects(parent_id);
CREATE INDEX idx_design_objects_created_by ON design_objects(created_by);
CREATE INDEX idx_workspaces_user_id ON workspaces(user_id);
CREATE INDEX idx_workspaces_published ON workspaces(published);
CREATE INDEX idx_workspace_shares_grantee ON workspace_shares(grantee_id);
CREATE INDEX idx_dashboard_shares_grantee ON dashboard_shares(grantee_id);
CREATE INDEX idx_window_groups_owner ON window_groups(owner_id);

-- Updated_at triggers
CREATE TRIGGER trg_design_objects_updated_at
    BEFORE UPDATE ON design_objects
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_workspaces_updated_at
    BEFORE UPDATE ON workspaces
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_dashboards_updated_at
    BEFORE UPDATE ON dashboards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_report_templates_updated_at
    BEFORE UPDATE ON report_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_window_groups_updated_at
    BEFORE UPDATE ON window_groups
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
