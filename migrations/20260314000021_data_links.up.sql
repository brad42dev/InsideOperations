-- Data links, design object points reverse lookup, point detail config

CREATE TABLE data_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    source_definition_id UUID NOT NULL REFERENCES import_definitions(id) ON DELETE CASCADE,
    source_column VARCHAR(100) NOT NULL,
    target_definition_id UUID NOT NULL REFERENCES import_definitions(id) ON DELETE CASCADE,
    target_column VARCHAR(100) NOT NULL,
    source_transforms JSONB NOT NULL DEFAULT '[]',
    target_transforms JSONB NOT NULL DEFAULT '[]',
    match_type VARCHAR(20) NOT NULL DEFAULT 'exact'
        CHECK (match_type IN ('exact', 'case_insensitive', 'transformed')),
    bidirectional BOOLEAN NOT NULL DEFAULT true,
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT uq_data_link UNIQUE (source_definition_id, source_column, target_definition_id, target_column)
);

CREATE INDEX idx_data_links_source ON data_links (source_definition_id) WHERE enabled AND deleted_at IS NULL;
CREATE INDEX idx_data_links_target ON data_links (target_definition_id) WHERE enabled AND deleted_at IS NULL;

-- Denormalized point-to-graphic reverse lookup
CREATE TABLE design_object_points (
    design_object_id UUID NOT NULL REFERENCES design_objects(id) ON DELETE CASCADE,
    point_id UUID NOT NULL,
    PRIMARY KEY (design_object_id, point_id)
);

CREATE INDEX idx_design_object_points_point ON design_object_points (point_id);

-- Point detail popup configuration
CREATE TABLE point_detail_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipment_class VARCHAR(50),
    site_id UUID REFERENCES sites(id),
    config JSONB NOT NULL,
    created_by UUID NOT NULL REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_point_detail_config UNIQUE (equipment_class, site_id)
);
