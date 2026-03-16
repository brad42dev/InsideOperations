# Inside/Operations - Database Design

## Database Technology

**PostgreSQL 16+** with **TimescaleDB 2.13+** extension for time-series data.

## Schema Overview

The database is organized into several logical domains:

1. **Authentication & Authorization** - Users, roles, permissions, sessions, groups, IdP role mappings
2. **Configuration** - Application settings, system configuration, sites, data categories
3. **Graphics & Workspaces** - Graphics objects, console workspaces, dashboards, window groups
4. **Point Data** - Data sources, point metadata (with versioning and lifecycle), current values, historical time-series
5. **Expression Builder** - Saved custom expressions (conversions, calculated values, future alarm conditions)
6. **Universal Import** - Import connections, definitions, schedules, runs, errors, custom data
7. **Operational Data** - Events/alarms (ISA-18.2 state model), rounds (template/instance/response), operational logs (template/segment/instance)
8. **Audit & System** - Audit trail, system logs
9. **Export & Bulk Update** - Export job queue, change snapshots, snapshot row data
10. **Recognition** - Symbol recognition correction feedback (P&ID and DCS)
11. **Alerting** - Alert templates, rosters, alerts, deliveries, escalations, channels, push subscriptions
12. **Email** - Email providers, templates, queue, delivery log
13. **Authentication (Extended)** - Auth provider configs, MFA enrollment/policies/recovery, API keys, auth flow state, SCIM tokens
14. **Sites & Certificates** - Multi-site definitions, TLS certificate tracking
15. **Integration Data** - Equipment registry, work orders, spare parts, PM schedules, inventory, purchase orders, vendors, cost centers, tickets, lab samples/results, product specs, emissions, compliance, ambient monitoring, LDAR, permits, waste manifests, MOC records, safety incidents, inspection findings, regulatory permits, risk assessments
16. **Forensics/Investigations** - Investigations with stages, evidence items, point curation, sharing, and entity linking

## Core Tables

### Authentication Tables

```sql
-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255),                  -- nullable: external auth users have no local password
    email VARCHAR(255) UNIQUE,
    full_name VARCHAR(255),
    enabled BOOLEAN DEFAULT true,
    auth_provider VARCHAR(20) NOT NULL DEFAULT 'local',
        -- CHECK (auth_provider IN ('local', 'oidc', 'saml', 'ldap'))
    auth_provider_config_id UUID REFERENCES auth_provider_configs(id),
    auth_provider_user_id TEXT,                  -- OIDC: sub claim, SAML: NameID, LDAP: DN or sAMAccountName
    external_id TEXT,                            -- SCIM externalId for provisioning
    is_service_account BOOLEAN NOT NULL DEFAULT false,
    is_emergency_account BOOLEAN NOT NULL DEFAULT false,
        -- Break-glass emergency accounts: bypass MFA, elevated audit, auto-expire sessions
    role_source VARCHAR(20) DEFAULT 'manual'
        CHECK (role_source IN ('manual', 'idp', 'both')),
        -- Tracks how roles were assigned: manual (admin), idp (IdP mapping), both (mixed)
    last_login_at TIMESTAMPTZ,
    mfa_enabled BOOLEAN NOT NULL DEFAULT false,
    mfa_enrollment_deadline TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint: one external identity per provider config
CREATE UNIQUE INDEX idx_users_external_identity
    ON users (auth_provider, auth_provider_config_id, auth_provider_user_id)
    WHERE auth_provider != 'local';

-- Groups table
CREATE TABLE groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User-Group many-to-many
CREATE TABLE user_groups (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, group_id)
);

-- Group-Role many-to-many (assign roles to groups; members inherit group roles)
CREATE TABLE group_roles (
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (group_id, role_id)
);

-- Roles table
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    is_predefined BOOLEAN NOT NULL DEFAULT false,
        -- Distinguishes built-in roles (Viewer, Operator, Engineer, etc.) from custom roles
    cloned_from UUID REFERENCES roles(id),
        -- Tracks which predefined role a custom role was cloned from (NULL for originals)
    idle_timeout_minutes INTEGER NOT NULL DEFAULT 30,
        -- Per-role idle session timeout (Admin=15, Operator=60, Viewer=30, etc.)
    max_concurrent_sessions INTEGER NOT NULL DEFAULT 3,
        -- Per-role concurrent session limit
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Permissions table
CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    module VARCHAR(50) NOT NULL
);

-- Role-Permission many-to-many
CREATE TABLE role_permissions (
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- User-Role many-to-many
CREATE TABLE user_roles (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, role_id)
);

-- User sessions for refresh token management
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    refresh_token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    device_info JSONB,
    ip_address INET,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_accessed_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Configuration Tables

```sql
-- Key-value settings
CREATE TABLE settings (
    key VARCHAR(255) PRIMARY KEY,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_by UUID REFERENCES users(id)
);
```

### Graphics & Workspace Tables

```sql
-- Design objects (graphics)
CREATE TABLE design_objects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- workspace, graphic, template
    svg_data TEXT,
    bindings JSONB, -- point_id -> element mappings
    parent_id UUID REFERENCES design_objects(id) ON DELETE CASCADE,
    metadata JSONB,
    locked_by UUID REFERENCES users(id),       -- pessimistic edit lock (NULL = unlocked)
    locked_at TIMESTAMPTZ,                     -- when lock was acquired (auto-expires after 30 min idle)
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Graphic version history (rolling draft window + permanent publish snapshots)
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
-- Draft pruning: application enforces max 10 drafts per object; oldest drafts deleted on save. Published versions are never pruned.

-- Console workspaces
CREATE TABLE workspaces (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    layout JSONB NOT NULL, -- grid layout configuration
    published BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Workspace sharing (replaces shared_with UUID[] array)
CREATE TABLE workspace_shares (
    workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    grantee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    grantee_type VARCHAR(10) NOT NULL DEFAULT 'user' CHECK (grantee_type IN ('user', 'group')),
    permission_level VARCHAR(20) NOT NULL DEFAULT 'view' CHECK (permission_level IN ('view', 'edit')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (workspace_id, grantee_id)
);

-- Dashboards
CREATE TABLE dashboards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    layout JSONB NOT NULL,
    widgets JSONB NOT NULL, -- widget configurations
    published BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dashboard sharing (replaces shared_with UUID[] array)
CREATE TABLE dashboard_shares (
    dashboard_id UUID NOT NULL REFERENCES dashboards(id) ON DELETE CASCADE,
    grantee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    grantee_type VARCHAR(10) NOT NULL DEFAULT 'user' CHECK (grantee_type IN ('user', 'group')),
    permission_level VARCHAR(20) NOT NULL DEFAULT 'view' CHECK (permission_level IN ('view', 'edit')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (dashboard_id, grantee_id)
);

-- Report templates
CREATE TABLE report_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    template_config JSONB NOT NULL,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Window Group Tables

```sql
-- Window Groups: saved multi-window configurations for multi-monitor layouts
-- See doc 06 (Multi-Window Architecture) for full Window Group specification
CREATE TABLE window_groups (
    group_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    owner_id UUID NOT NULL REFERENCES users(id),
    is_published BOOLEAN DEFAULT FALSE,
    configuration JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_window_groups_owner ON window_groups(owner_id);
```

The `configuration` JSONB column stores the full multi-window layout:
```jsonc
{
  "mainWindow": {
    "module": "console",       // "console" | "process" | "dashboard"
    "contentId": "<uuid>"      // workspaceId, viewId, or dashboardId
  },
  "secondaryWindows": [
    {
      "module": "process",
      "contentId": "<uuid>",
      "screen": 1,             // screen index (Window Management API)
      "x": 0, "y": 0,         // position relative to screen
      "width": 1920,
      "height": 1080
    }
  ]
}
```

### Point Data Tables

```sql
-- Data source registry (OPC servers, future Modbus/MQTT/CSV/manual sources)
CREATE TABLE point_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    source_type VARCHAR(50) NOT NULL
        CHECK (source_type IN ('opc_ua', 'modbus', 'manual', 'mqtt', 'csv')),
    status VARCHAR(20) NOT NULL DEFAULT 'inactive'
        CHECK (status IN ('active', 'inactive', 'error', 'connecting')),
    connection_config JSONB NOT NULL DEFAULT '{}',
    -- For opc_ua: {endpoint_url, security_policy, security_mode, certificate_path,
    --   private_key_path, auth_type, username, polling_interval_ms, browse_root_node,
    --   batch_subscribe_size}. Passwords/secrets encrypted by application layer.
    last_connected_at TIMESTAMPTZ,
    last_error_at TIMESTAMPTZ,
    last_error_message TEXT,
    enabled BOOLEAN NOT NULL DEFAULT true,
    description TEXT,
    data_category_id UUID REFERENCES data_categories(id),
        -- Links data source to its category (Process, Event, Maintenance, etc.)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_point_sources_name UNIQUE (name)
);

-- Point metadata: identity + current source metadata (trigger-synced) + app config
CREATE TABLE points_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- POINT IDENTITY
    tagname VARCHAR(255) NOT NULL,
    source_id UUID NOT NULL REFERENCES point_sources(id) ON DELETE RESTRICT,

    -- CURRENT EFFECTIVE SOURCE METADATA (denormalized from latest version)
    -- Kept in sync by trg_sync_point_metadata_from_version trigger.
    -- These columns are the READ path for graphic displays -- no JOIN needed.
    description TEXT,
    engineering_units VARCHAR(50),
    data_type VARCHAR(50) NOT NULL,
    min_value DOUBLE PRECISION,       -- EURange.low from OPC UA Part 8 AnalogItemType; engineering scale low
    max_value DOUBLE PRECISION,       -- EURange.high from OPC UA Part 8 AnalogItemType; engineering scale high

    -- ALARM LIMITS (sourced in priority order: OPC UA Part 8/9 → supplemental connector → I/O threshold wizard)
    -- See doc 17 § OPC UA Optional Services for sourcing logic.
    -- NULL = not configured from any source (I/O threshold wizard can still define limits independently in alarm_definitions)
    alarm_limit_hh DOUBLE PRECISION,  -- High-High trip limit (OPC UA HighHighLimit property)
    alarm_limit_h  DOUBLE PRECISION,  -- High trip limit (OPC UA HighLimit property)
    alarm_limit_l  DOUBLE PRECISION,  -- Low trip limit (OPC UA LowLimit property)
    alarm_limit_ll DOUBLE PRECISION,  -- Low-Low trip limit (OPC UA LowLowLimit property)
    alarm_limit_source VARCHAR(20)    -- Where limits came from: 'opc_ua' | 'supplemental' | 'wizard' | NULL
        CHECK (alarm_limit_source IS NULL OR alarm_limit_source IN ('opc_ua', 'supplemental', 'wizard')),

    -- AGGREGATION CONTROL (bitmask)
    aggregation_types INTEGER NOT NULL DEFAULT 0,
    -- 32-bit bitmask controlling which aggregate operations are semantically valid.
    --   Bit 0 (1):  Allow averaging
    --   Bit 1 (2):  Allow sum/totaling
    --   Bit 2 (4):  Allow accumulation
    --   Bit 3 (8):  Reserved for custom aggregation (future)
    --   Bits 4-31:  Reserved
    -- min, max, and count are always available

    -- APPLICATION CONFIGURATION (admin-managed, not from OPC source)
    active BOOLEAN NOT NULL DEFAULT true,
    criticality VARCHAR(20)
        CHECK (criticality IS NULL OR criticality IN (
            'safety_critical', 'environmental', 'production', 'informational'
        )),
    area VARCHAR(100),
    default_graphic_id UUID REFERENCES design_objects(id) ON DELETE SET NULL,
    gps_latitude DOUBLE PRECISION,
    gps_longitude DOUBLE PRECISION,
    barcode VARCHAR(255),
    notes TEXT,
    app_metadata JSONB NOT NULL DEFAULT '{}',
    write_frequency_seconds INTEGER, -- for smart backfill gap detection

    -- LIFECYCLE TIMESTAMPS
    first_seen_at TIMESTAMPTZ,
    last_seen_at TIMESTAMPTZ,
    last_good_value_at TIMESTAMPTZ,
    deactivated_at TIMESTAMPTZ,
    reactivated_at TIMESTAMPTZ,

    -- STANDARD TIMESTAMPS
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- CONSTRAINTS
    CONSTRAINT uq_points_metadata_tagname_source UNIQUE (tagname, source_id)
);

-- Versioned source metadata (forensic history of OPC-reported metadata changes)
CREATE TABLE points_metadata_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    point_id UUID NOT NULL REFERENCES points_metadata(id) ON DELETE RESTRICT,
    version INTEGER NOT NULL DEFAULT 0,
    description TEXT,
    engineering_units VARCHAR(50),
    data_type VARCHAR(50) NOT NULL,
    min_value DOUBLE PRECISION,
    max_value DOUBLE PRECISION,
    alarm_limit_hh DOUBLE PRECISION,
    alarm_limit_h  DOUBLE PRECISION,
    alarm_limit_l  DOUBLE PRECISION,
    alarm_limit_ll DOUBLE PRECISION,
    alarm_limit_source VARCHAR(20),
    effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source_raw JSONB, -- full raw metadata from source for debugging (includes instrument_range, value_precision, enum_strings, EU unitId)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_points_metadata_versions_point_version UNIQUE (point_id, version),
    CONSTRAINT chk_version_non_negative CHECK (version >= 0)
);

-- Current point values (HOT-update optimized)
CREATE TABLE points_current (
    point_id UUID PRIMARY KEY REFERENCES points_metadata(id) ON DELETE CASCADE,
    value DOUBLE PRECISION,
    quality VARCHAR(20) NOT NULL, -- good, bad, uncertain
    timestamp TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
-- Enable HOT (Heap Only Tuple) updates: since point_id (PK) never changes,
-- most UPSERTs only modify value/quality/timestamp and can skip index maintenance.
ALTER TABLE points_current SET (fillfactor = 80);

-- Historical point values (TimescaleDB hypertable)
CREATE TABLE points_history_raw (
    point_id UUID NOT NULL REFERENCES points_metadata(id) ON DELETE RESTRICT,
    -- RESTRICT prevents accidental deletion of historical data; point must be explicitly archived first
    value DOUBLE PRECISION,
    quality VARCHAR(20) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL
);

-- Convert to hypertable (partitioned by timestamp)
SELECT create_hypertable('points_history_raw', 'timestamp',
    chunk_time_interval => INTERVAL '1 day');

-- Deduplication constraint: prevents duplicate history from OPC reconnection,
-- backfill overlaps, or retries. Application uses ON CONFLICT DO NOTHING.
ALTER TABLE points_history_raw
    ADD CONSTRAINT uq_points_history_raw_point_timestamp
    UNIQUE (point_id, timestamp);

-- Continuous aggregates for different time resolutions
-- All aggregates filter to Good quality only (OPC UA status codes).
-- All aggregates include sum column alongside avg/min/max/count.
-- The application layer uses points_metadata.aggregation_types to control
-- which columns are exposed to users (e.g., avg hidden for accumulators,
-- sum hidden for temperatures). See 18_TIMESERIES_DATA for full rationale.

CREATE MATERIALIZED VIEW points_history_1m
WITH (timescaledb.continuous) AS
SELECT point_id,
    time_bucket('1 minute', timestamp) AS bucket,
    avg(value) AS avg,
    min(value) AS min,
    max(value) AS max,
    sum(value) AS sum,
    count(*) AS count
FROM points_history_raw
WHERE quality = 'Good'
GROUP BY point_id, bucket;

CREATE MATERIALIZED VIEW points_history_5m
WITH (timescaledb.continuous) AS
SELECT point_id,
    time_bucket('5 minutes', timestamp) AS bucket,
    avg(value) AS avg,
    min(value) AS min,
    max(value) AS max,
    sum(value) AS sum,
    count(*) AS count
FROM points_history_raw
WHERE quality = 'Good'
GROUP BY point_id, bucket;

CREATE MATERIALIZED VIEW points_history_15m
WITH (timescaledb.continuous) AS
SELECT point_id,
    time_bucket('15 minutes', timestamp) AS bucket,
    avg(value) AS avg,
    min(value) AS min,
    max(value) AS max,
    sum(value) AS sum,
    count(*) AS count
FROM points_history_raw
WHERE quality = 'Good'
GROUP BY point_id, bucket;

CREATE MATERIALIZED VIEW points_history_1h
WITH (timescaledb.continuous) AS
SELECT point_id,
    time_bucket('1 hour', timestamp) AS bucket,
    avg(value) AS avg,
    min(value) AS min,
    max(value) AS max,
    sum(value) AS sum,
    count(*) AS count
FROM points_history_raw
WHERE quality = 'Good'
GROUP BY point_id, bucket;

CREATE MATERIALIZED VIEW points_history_1d
WITH (timescaledb.continuous) AS
SELECT point_id,
    time_bucket('1 day', timestamp) AS bucket,
    avg(value) AS avg,
    min(value) AS min,
    max(value) AS max,
    sum(value) AS sum,
    count(*) AS count
FROM points_history_raw
WHERE quality = 'Good'
GROUP BY point_id, bucket;

-- Points in use tracking (for subscription prioritization)
CREATE TABLE points_in_use (
    point_id UUID PRIMARY KEY REFERENCES points_metadata(id) ON DELETE CASCADE,
    last_accessed TIMESTAMPTZ DEFAULT NOW(),
    access_count INTEGER DEFAULT 1
);
```

### Expression Builder Tables

```sql
-- Saved expressions (custom conversions, calculated values, alarm conditions, round calculations)
-- See 23_EXPRESSION_BUILDER.md for full AST JSON format and evaluation architecture
CREATE TABLE custom_expressions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Expression definition (AST JSON, see 23_EXPRESSION_BUILDER.md Section 10)
    expression JSONB NOT NULL,

    -- Output configuration
    output_type VARCHAR(20) NOT NULL DEFAULT 'float'
        CHECK (output_type IN ('float', 'integer')),
    output_precision INTEGER DEFAULT 3
        CHECK (output_precision IS NULL OR (output_precision >= 0 AND output_precision <= 7)),

    -- Context: what kind of expression this is
    expression_context VARCHAR(50) NOT NULL DEFAULT 'conversion'
        CHECK (expression_context IN ('conversion', 'calculated_value', 'alarm_condition', 'custom')),

    -- Ownership and sharing
    created_by UUID NOT NULL REFERENCES users(id),
    shared BOOLEAN NOT NULL DEFAULT false,

    -- Denormalized point references (for querying "which expressions use point X?")
    referenced_point_ids UUID[] DEFAULT '{}',

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_custom_expressions_name UNIQUE (name)
);

-- Add expression FK after custom_expressions table exists
ALTER TABLE points_metadata
    ADD COLUMN custom_expression_id UUID REFERENCES custom_expressions(id) ON DELETE SET NULL;
```

### Universal Import Tables

Full DDL for import tables (7 tables with indexes, triggers, and audit logging) is defined in [24_UNIVERSAL_IMPORT.md](24_UNIVERSAL_IMPORT.md) Section 5. Summary:

```sql
-- Pre-built connector templates (seed data, 40 templates for known applications)
CREATE TABLE connector_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(100) UNIQUE NOT NULL,          -- 'servicenow-itsm', 'sap-pm-work-orders'
    name VARCHAR(200) NOT NULL,                 -- 'ServiceNow ITSM'
    domain VARCHAR(50) NOT NULL
        CHECK (domain IN (
            'maintenance', 'equipment', 'access_control', 'erp_financial',
            'ticketing', 'environmental', 'lims_lab', 'regulatory',
            'dcs_supplemental'  -- DCS supplemental REST/SQL connectors linked to OPC UA sources
        )),
    vendor VARCHAR(100) NOT NULL,               -- 'ServiceNow', 'SAP', 'IBM'
    description TEXT,
    template_config JSONB NOT NULL,             -- Complete pre-built import definition (with {{placeholders}})
    required_fields JSONB NOT NULL,             -- Fields the user must fill in
    target_tables TEXT[] NOT NULL,              -- I/O tables this template populates
    version VARCHAR(20) NOT NULL DEFAULT '1.0',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- External system connections (credentials encrypted at application layer)
CREATE TABLE import_connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    connection_type VARCHAR(100) NOT NULL,
    config JSONB NOT NULL DEFAULT '{}',
    auth_type VARCHAR(50) NOT NULL DEFAULT 'none',
    auth_config JSONB NOT NULL DEFAULT '{}',
    enabled BOOLEAN NOT NULL DEFAULT true,
    data_category_id UUID REFERENCES data_categories(id),
        -- Links import connection to its category (Maintenance, Financial, etc.)

    -- DCS supplemental connector linkage (NULL for general-purpose connectors).
    -- When set, this connection supplements an OPC UA source rather than performing
    -- a standalone import. Displayed as "Supplemental Point Data" in the UI and
    -- configured from Settings > Data Sources rather than the Import wizard.
    -- Supported DCS supplemental connection_types (see doc 24 § 3.2.1):
    --   Custom REST: pi_web_api, experion_rest, siemens_sph_rest, wincc_oa_rest,
    --                s800xa_rest, kepware_rest, canary_rest
    --   SQL/ODBC via existing types: 'mssql' (DeltaV Event Chronicle, ABB brownfield,
    --                Yokogawa), 'odbc' (any remaining ODBC-capable historian)
    point_source_id UUID REFERENCES point_sources(id) ON DELETE SET NULL,
    is_supplemental_connector BOOLEAN NOT NULL DEFAULT false,

    last_tested_at TIMESTAMPTZ,
    last_test_status VARCHAR(20),
    last_test_message TEXT,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_import_connections_name UNIQUE (name),
    CONSTRAINT chk_supplemental_has_source
        CHECK (NOT is_supplemental_connector OR point_source_id IS NOT NULL)
);

-- Import job definitions (source query, field mappings, transforms, validation)
CREATE TABLE import_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    connection_id UUID NOT NULL REFERENCES import_connections(id) ON DELETE RESTRICT,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    source_config JSONB NOT NULL DEFAULT '{}',
    field_mappings JSONB NOT NULL DEFAULT '[]',
    transforms JSONB NOT NULL DEFAULT '[]',
    validation_rules JSONB NOT NULL DEFAULT '{}',
    target_table VARCHAR(100) NOT NULL,
    error_strategy VARCHAR(20) NOT NULL DEFAULT 'quarantine'
        CHECK (error_strategy IN ('stop', 'skip', 'quarantine', 'threshold')),
    error_threshold_percent NUMERIC(5,2) DEFAULT 10.00,
    batch_size INTEGER NOT NULL DEFAULT 1000,
    template_id UUID REFERENCES connector_templates(id) ON DELETE SET NULL,
    template_version VARCHAR(20),     -- Version of template used to create this definition
    point_column VARCHAR(100),        -- Column in source data containing point/tag names matching points_metadata.tag_name
    point_column_transforms JSONB,    -- Ordered transform pipeline applied to point_column values before matching (e.g., [{"op":"strip_after_dot"},{"op":"remove_dashes"},{"op":"uppercase"}])
    enabled BOOLEAN NOT NULL DEFAULT true,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_import_definitions_name UNIQUE (name)
);

-- Schedule configuration per import definition
CREATE TABLE import_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_definition_id UUID NOT NULL REFERENCES import_definitions(id) ON DELETE CASCADE,
    schedule_type VARCHAR(20) NOT NULL
        CHECK (schedule_type IN ('cron', 'interval', 'manual', 'file_arrival', 'webhook', 'dependency')),
    schedule_config JSONB NOT NULL DEFAULT '{}',
    enabled BOOLEAN NOT NULL DEFAULT true,
    next_run_at TIMESTAMPTZ,
    last_run_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Import execution history
CREATE TABLE import_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_definition_id UUID NOT NULL REFERENCES import_definitions(id) ON DELETE CASCADE,
    schedule_id UUID REFERENCES import_schedules(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled', 'partial')),
    triggered_by VARCHAR(20) NOT NULL DEFAULT 'manual'
        CHECK (triggered_by IN ('manual', 'schedule', 'webhook', 'file_arrival', 'dependency', 'retry')),
    dry_run BOOLEAN NOT NULL DEFAULT false,
    rows_extracted INTEGER DEFAULT 0,
    rows_mapped INTEGER DEFAULT 0,
    rows_transformed INTEGER DEFAULT 0,
    rows_validated INTEGER DEFAULT 0,
    rows_loaded INTEGER DEFAULT 0,
    rows_errored INTEGER DEFAULT 0,
    rows_skipped INTEGER DEFAULT 0,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    watermark_state JSONB,
    run_metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Per-row error details from failed imports
CREATE TABLE import_errors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_run_id UUID NOT NULL REFERENCES import_runs(id) ON DELETE CASCADE,
    row_number INTEGER,
    field_name VARCHAR(255),
    error_type VARCHAR(50) NOT NULL,
    error_message TEXT NOT NULL,
    raw_value TEXT,
    raw_row JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Generic target for data not mapping to existing I/O tables
CREATE TABLE custom_import_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_definition_id UUID NOT NULL REFERENCES import_definitions(id) ON DELETE CASCADE,
    data JSONB NOT NULL,
    source_row_id VARCHAR(255),
    imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

See 24_UNIVERSAL_IMPORT.md Section 5 for complete indexes, triggers, and audit trigger assignments.

### Data Links & Point Detail Tables

```sql
-- Cross-dataset linking rules (admin-configured correlations between any imported datasets)
-- Example: spare_parts.part_number links to inventory_items.material_number
CREATE TABLE data_links (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,                      -- "CMMS Parts → ERP Inventory"
    description TEXT,

    -- Source side (references an import definition by name, plus column)
    source_definition_id UUID NOT NULL REFERENCES import_definitions(id) ON DELETE CASCADE,
    source_column VARCHAR(100) NOT NULL,             -- Column name in source dataset

    -- Target side
    target_definition_id UUID NOT NULL REFERENCES import_definitions(id) ON DELETE CASCADE,
    target_column VARCHAR(100) NOT NULL,             -- Column name in target dataset

    -- Transform pipeline applied before matching (same chip-stack format as point_column_transforms)
    source_transforms JSONB NOT NULL DEFAULT '[]',   -- Transforms applied to source values
    target_transforms JSONB NOT NULL DEFAULT '[]',   -- Transforms applied to target values

    -- Match configuration
    match_type VARCHAR(20) NOT NULL DEFAULT 'exact'
        CHECK (match_type IN ('exact', 'case_insensitive', 'transformed')),
        -- 'transformed' = match after applying transform pipelines

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

-- Denormalized point-to-graphic reverse lookup (maintained by trigger on design_objects.bindings changes)
CREATE TABLE design_object_points (
    design_object_id UUID NOT NULL REFERENCES design_objects(id) ON DELETE CASCADE,
    point_id UUID NOT NULL,  -- Intentionally no FK: bindings may reference not-yet-imported points
    PRIMARY KEY (design_object_id, point_id)
);
CREATE INDEX idx_design_object_points_point ON design_object_points (point_id);

-- Point Detail popup configuration (section layout, field visibility, custom fields)
CREATE TABLE point_detail_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipment_class VARCHAR(50),         -- NULL = global default; non-NULL = override for equipment class
    site_id UUID REFERENCES sites(id),
    config JSONB NOT NULL,               -- Section ordering, field visibility, custom fields
    -- Config structure: { sections: [{key, label, enabled, order, definition_id, display_columns, sort_by, max_items}], custom_fields: [{label, definition_id, column}] }
    created_by UUID NOT NULL REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_point_detail_config UNIQUE (equipment_class, site_id)
);
```

See 24_UNIVERSAL_IMPORT.md Section 6 for Data Links specification and 32_SHARED_UI_COMPONENTS.md for the Point Detail floating panel component.

### Integration Data Tables

Typed target tables for imported data from external systems. All tables follow the same pattern: typed columns for the standard schema, `extra_data JSONB` for source-specific overflow, `import_run_id` for provenance tracking. Universal Import handles all source-to-schema transforms — application code only reads these tables. See 24_UNIVERSAL_IMPORT.md Section 5b for architecture overview and `24_integrations/` for connector profiles.

#### Equipment Registry

```sql
-- Equipment master registry (imported from CMMS or manually maintained)
CREATE TABLE equipment (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id VARCHAR(255),
    source_system VARCHAR(100),               -- 'sap_pm', 'maximo', 'manual', etc.
    data_source VARCHAR(20) NOT NULL DEFAULT 'manual'
        CHECK (data_source IN ('imported', 'manual')),
        -- imported = read-only except I/O-specific fields; manual = fully editable
    tag VARCHAR(100) NOT NULL,                -- Equipment tag (P-101A, FIC-301, E-205)
    description TEXT,
    equipment_class VARCHAR(50)
        CHECK (equipment_class IN (
            'rotating', 'static', 'heat_exchanger', 'instrument',
            'electrical', 'piping', 'relief_device', 'structural'
        )),
    equipment_type VARCHAR(100),              -- Subtype (centrifugal_pump, shell_tube, control_valve)
    parent_id UUID REFERENCES equipment(id),  -- Self-referential hierarchy
    functional_location VARCHAR(255),
    area VARCHAR(100),
    unit VARCHAR(100),
    site_id UUID REFERENCES sites(id),
    manufacturer VARCHAR(200),
    model_number VARCHAR(200),
    serial_number VARCHAR(200),
    year_installed INTEGER,
    design_pressure DOUBLE PRECISION,
    design_temperature DOUBLE PRECISION,
    material_of_construction VARCHAR(200),
    criticality SMALLINT CHECK (criticality BETWEEN 1 AND 5),
        -- 1 = most critical, 5 = least critical
    safety_critical BOOLEAN NOT NULL DEFAULT false,
    environmental_critical BOOLEAN NOT NULL DEFAULT false,
    pid_reference VARCHAR(200),               -- P&ID drawing number
    barcode VARCHAR(255),
    gps_latitude DOUBLE PRECISION,
    gps_longitude DOUBLE PRECISION,
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'inactive', 'decommissioned')),
    extra_data JSONB NOT NULL DEFAULT '{}',
    import_run_id UUID REFERENCES import_runs(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT uq_equipment_tag_site UNIQUE (tag, site_id)
);

CREATE INDEX idx_equipment_class ON equipment (equipment_class);
CREATE INDEX idx_equipment_parent ON equipment (parent_id);
CREATE INDEX idx_equipment_area ON equipment (area);
CREATE INDEX idx_equipment_criticality ON equipment (criticality) WHERE criticality <= 2;
CREATE INDEX idx_equipment_external ON equipment (source_system, external_id);
CREATE INDEX idx_equipment_active ON equipment (status) WHERE status = 'active' AND deleted_at IS NULL;

-- Equipment-to-point junction table
CREATE TABLE equipment_points (
    equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
    point_id UUID NOT NULL REFERENCES points_metadata(id) ON DELETE CASCADE,
    relationship_type VARCHAR(30) NOT NULL DEFAULT 'primary_measurement'
        CHECK (relationship_type IN (
            'primary_measurement', 'secondary', 'control_output', 'diagnostic'
        )),
    PRIMARY KEY (equipment_id, point_id)
);

CREATE INDEX idx_equipment_points_point ON equipment_points (point_id);

-- Equipment nameplate data (flexible key-value for varying specs per class)
CREATE TABLE equipment_nameplate (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
    attribute_name VARCHAR(100) NOT NULL,
    attribute_value TEXT NOT NULL,
    unit_of_measure VARCHAR(50),
    extra_data JSONB NOT NULL DEFAULT '{}',
    CONSTRAINT uq_nameplate_attr UNIQUE (equipment_id, attribute_name)
);

CREATE INDEX idx_equipment_nameplate_equip ON equipment_nameplate (equipment_id);

-- Equipment criticality assessments
CREATE TABLE equipment_criticality (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    equipment_id UUID NOT NULL REFERENCES equipment(id) ON DELETE CASCADE,
    safety_impact SMALLINT NOT NULL CHECK (safety_impact BETWEEN 1 AND 5),
    environmental_impact SMALLINT NOT NULL CHECK (environmental_impact BETWEEN 1 AND 5),
    production_impact SMALLINT NOT NULL CHECK (production_impact BETWEEN 1 AND 5),
    maintenance_cost_impact SMALLINT NOT NULL CHECK (maintenance_cost_impact BETWEEN 1 AND 5),
    overall_criticality SMALLINT NOT NULL CHECK (overall_criticality BETWEEN 1 AND 5),
    assessment_date DATE,
    assessed_by VARCHAR(200),
    notes TEXT,
    extra_data JSONB NOT NULL DEFAULT '{}',
    import_run_id UUID REFERENCES import_runs(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_equipment_criticality_equip ON equipment_criticality (equipment_id);
```

#### Maintenance / CMMS

```sql
-- Work orders from CMMS systems
CREATE TABLE work_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id VARCHAR(255),
    source_system VARCHAR(100),
    wo_number VARCHAR(100),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL
        CHECK (status IN ('open', 'in_progress', 'on_hold', 'completed', 'closed', 'cancelled')),
    priority VARCHAR(20) NOT NULL DEFAULT 'medium'
        CHECK (priority IN ('critical', 'high', 'medium', 'low')),
    work_type VARCHAR(50),                    -- corrective, preventive, predictive, emergency, inspection
    equipment_id UUID REFERENCES equipment(id),
    point_id UUID REFERENCES points_metadata(id),
    assigned_to VARCHAR(200),
    assigned_group VARCHAR(200),
    requested_by VARCHAR(200),
    scheduled_start TIMESTAMPTZ,
    scheduled_end TIMESTAMPTZ,
    actual_start TIMESTAMPTZ,
    actual_end TIMESTAMPTZ,
    labor_hours DOUBLE PRECISION,
    parts_cost DOUBLE PRECISION,
    labor_cost DOUBLE PRECISION,
    total_cost DOUBLE PRECISION,
    failure_code VARCHAR(100),
    cause_code VARCHAR(100),
    remedy_code VARCHAR(100),
    permit_required BOOLEAN NOT NULL DEFAULT false,
    comments TEXT,
    extra_data JSONB NOT NULL DEFAULT '{}',
    import_run_id UUID REFERENCES import_runs(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_work_orders_external UNIQUE (source_system, external_id)
);

CREATE INDEX idx_work_orders_status ON work_orders (status) WHERE status NOT IN ('closed', 'cancelled');
CREATE INDEX idx_work_orders_equipment ON work_orders (equipment_id);
CREATE INDEX idx_work_orders_priority ON work_orders (priority, status);
CREATE INDEX idx_work_orders_scheduled ON work_orders (scheduled_start);

-- Spare parts inventory
CREATE TABLE spare_parts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id VARCHAR(255),
    source_system VARCHAR(100),
    part_number VARCHAR(100) NOT NULL,
    description TEXT,
    quantity_on_hand DOUBLE PRECISION,
    reorder_point DOUBLE PRECISION,
    unit_cost DOUBLE PRECISION,
    currency VARCHAR(10) DEFAULT 'USD',
    warehouse_location VARCHAR(200),
    extra_data JSONB NOT NULL DEFAULT '{}',
    import_run_id UUID REFERENCES import_runs(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_spare_parts_external UNIQUE (source_system, external_id)
);

CREATE INDEX idx_spare_parts_number ON spare_parts (part_number);
CREATE INDEX idx_spare_parts_low_stock ON spare_parts (quantity_on_hand)
    WHERE quantity_on_hand <= reorder_point;

-- Preventive maintenance schedules
CREATE TABLE pm_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id VARCHAR(255),
    source_system VARCHAR(100),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    equipment_id UUID REFERENCES equipment(id),
    frequency_days INTEGER,
    last_completed_at TIMESTAMPTZ,
    next_due_at TIMESTAMPTZ,
    assigned_group VARCHAR(200),
    extra_data JSONB NOT NULL DEFAULT '{}',
    import_run_id UUID REFERENCES import_runs(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_pm_schedules_external UNIQUE (source_system, external_id)
);

CREATE INDEX idx_pm_schedules_equipment ON pm_schedules (equipment_id);
CREATE INDEX idx_pm_schedules_due ON pm_schedules (next_due_at);
```

#### ERP / Financial

```sql
-- Inventory / spare parts from ERP
CREATE TABLE inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id VARCHAR(255),
    source_system VARCHAR(100),
    part_number VARCHAR(100) NOT NULL,
    description TEXT,
    quantity_on_hand DOUBLE PRECISION,
    quantity_reserved DOUBLE PRECISION,
    quantity_available DOUBLE PRECISION,
    reorder_point DOUBLE PRECISION,
    unit_cost DOUBLE PRECISION,
    currency VARCHAR(10) DEFAULT 'USD',
    warehouse_id VARCHAR(100),
    warehouse_name VARCHAR(200),
    bin_location VARCHAR(100),
    last_receipt_date DATE,
    last_issue_date DATE,
    extra_data JSONB NOT NULL DEFAULT '{}',
    import_run_id UUID REFERENCES import_runs(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_inventory_external UNIQUE (source_system, external_id)
);

CREATE INDEX idx_inventory_part ON inventory_items (part_number);

-- Purchase orders
CREATE TABLE purchase_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id VARCHAR(255),
    source_system VARCHAR(100),
    po_number VARCHAR(100) NOT NULL,
    status VARCHAR(30) NOT NULL
        CHECK (status IN ('draft', 'approved', 'ordered', 'partially_received', 'received', 'closed', 'cancelled')),
    vendor_id UUID REFERENCES vendor_master(id),
    vendor_name VARCHAR(200),
    order_date DATE,
    expected_delivery_date DATE,
    total_amount DOUBLE PRECISION,
    currency VARCHAR(10) DEFAULT 'USD',
    created_by_name VARCHAR(200),
    extra_data JSONB NOT NULL DEFAULT '{}',
    import_run_id UUID REFERENCES import_runs(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_purchase_orders_external UNIQUE (source_system, external_id)
);

CREATE INDEX idx_purchase_orders_status ON purchase_orders (status) WHERE status NOT IN ('closed', 'cancelled');
CREATE INDEX idx_purchase_orders_vendor ON purchase_orders (vendor_id);

-- Purchase order line items
CREATE TABLE purchase_order_lines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    purchase_order_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
    line_number INTEGER NOT NULL,
    part_number VARCHAR(100),
    description TEXT,
    quantity_ordered DOUBLE PRECISION,
    quantity_received DOUBLE PRECISION,
    unit_price DOUBLE PRECISION,
    currency VARCHAR(10) DEFAULT 'USD',
    delivery_date DATE,
    extra_data JSONB NOT NULL DEFAULT '{}',
    CONSTRAINT uq_po_lines UNIQUE (purchase_order_id, line_number)
);

-- Vendor master
CREATE TABLE vendor_master (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id VARCHAR(255),
    source_system VARCHAR(100),
    vendor_code VARCHAR(50) NOT NULL,
    name VARCHAR(300) NOT NULL,
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100),
    contact_name VARCHAR(200),
    contact_email VARCHAR(254),
    contact_phone VARCHAR(50),
    payment_terms VARCHAR(100),
    lead_time_days INTEGER,
    performance_rating DOUBLE PRECISION,
    extra_data JSONB NOT NULL DEFAULT '{}',
    import_run_id UUID REFERENCES import_runs(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_vendor_external UNIQUE (source_system, external_id)
);

CREATE INDEX idx_vendor_code ON vendor_master (vendor_code);

-- Cost centers / budget tracking
CREATE TABLE cost_centers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id VARCHAR(255),
    source_system VARCHAR(100),
    code VARCHAR(50) NOT NULL,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    parent_id UUID REFERENCES cost_centers(id),
    budget_amount DOUBLE PRECISION,
    currency VARCHAR(10) DEFAULT 'USD',
    fiscal_year INTEGER,
    extra_data JSONB NOT NULL DEFAULT '{}',
    import_run_id UUID REFERENCES import_runs(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_cost_centers_external UNIQUE (source_system, external_id)
);
```

#### Ticketing / ITSM

```sql
-- IT/OT tickets from ITSM systems
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
    is_ot BOOLEAN NOT NULL DEFAULT false,     -- IT vs OT ticket distinction
    assigned_to VARCHAR(200),
    assigned_group VARCHAR(200),
    requester_name VARCHAR(200),
    requester_email VARCHAR(254),
    equipment_id UUID REFERENCES equipment(id), -- Linked equipment (resolved during import or via data links)
    ci_name VARCHAR(200),                     -- Configuration item name
    ci_id VARCHAR(100),
    hostname VARCHAR(200),
    ip_address INET,
    location VARCHAR(200),
    planned_start_at TIMESTAMPTZ,             -- For change requests
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

CREATE INDEX idx_tickets_status ON tickets (status) WHERE status NOT IN ('closed', 'cancelled');
CREATE INDEX idx_tickets_type ON tickets (ticket_type);
CREATE INDEX idx_tickets_ot ON tickets (is_ot) WHERE is_ot = true;
CREATE INDEX idx_tickets_change_window ON tickets (planned_start_at, planned_end_at)
    WHERE ticket_type = 'change_request' AND planned_start_at IS NOT NULL;
CREATE INDEX idx_tickets_fts ON tickets USING GIN (to_tsvector('english', title || ' ' || COALESCE(description, '')));

-- Ticket comments / work notes
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

CREATE INDEX idx_ticket_comments_ticket ON ticket_comments (ticket_id, commented_at);
```

#### LIMS / Lab

```sql
-- Lab sample points (bridge between physical locations and I/O points)
CREATE TABLE sample_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id VARCHAR(255),
    source_system VARCHAR(100),
    name VARCHAR(200) NOT NULL,
    description TEXT,
    location VARCHAR(200),
    unit VARCHAR(100),
    area VARCHAR(100),
    stream_type VARCHAR(30)
        CHECK (stream_type IN ('feed', 'product', 'intermediate', 'utility', 'environmental')),
    linked_point_id UUID REFERENCES points_metadata(id),
    extra_data JSONB NOT NULL DEFAULT '{}',
    import_run_id UUID REFERENCES import_runs(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_sample_points_external UNIQUE (source_system, external_id)
);

-- Lab samples
CREATE TABLE lab_samples (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id VARCHAR(255),
    source_system VARCHAR(100),
    sample_number VARCHAR(100) NOT NULL,
    sample_type VARCHAR(30) NOT NULL
        CHECK (sample_type IN (
            'product', 'process', 'environmental', 'water_chemistry',
            'crude_assay', 'equipment_analysis'
        )),
    sample_point_id UUID REFERENCES sample_points(id),
    equipment_id UUID REFERENCES equipment(id),
    description TEXT,
    collected_by VARCHAR(200),
    collected_at TIMESTAMPTZ,                 -- Use this for process correlation, not approved_at
    received_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    status VARCHAR(20) NOT NULL DEFAULT 'collected'
        CHECK (status IN ('collected', 'received', 'in_progress', 'approved', 'rejected')),
    batch_id VARCHAR(100),
    product_grade VARCHAR(100),
    extra_data JSONB NOT NULL DEFAULT '{}',
    import_run_id UUID REFERENCES import_runs(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_lab_samples_external UNIQUE (source_system, external_id)
);

CREATE INDEX idx_lab_samples_collected ON lab_samples (collected_at DESC);
CREATE INDEX idx_lab_samples_type ON lab_samples (sample_type);
CREATE INDEX idx_lab_samples_equipment ON lab_samples (equipment_id);
CREATE INDEX idx_lab_samples_point ON lab_samples (sample_point_id);

-- Lab results (individual test results within a sample)
CREATE TABLE lab_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sample_id UUID NOT NULL REFERENCES lab_samples(id) ON DELETE CASCADE,
    external_id VARCHAR(255),
    test_name VARCHAR(200) NOT NULL,
    test_method VARCHAR(100),                 -- ASTM reference (e.g., D86, D2699)
    parameter_name VARCHAR(200) NOT NULL,
    value DOUBLE PRECISION,
    value_text VARCHAR(500),                  -- For non-numeric results
    unit VARCHAR(50),
    spec_low DOUBLE PRECISION,
    spec_high DOUBLE PRECISION,
    in_spec BOOLEAN,
    result_source VARCHAR(20) DEFAULT 'lab'
        CHECK (result_source IN ('lab', 'online_analyzer')),
    analyst_name VARCHAR(200),
    approved_by VARCHAR(200),
    approved_at TIMESTAMPTZ,
    extra_data JSONB NOT NULL DEFAULT '{}',
    import_run_id UUID REFERENCES import_runs(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lab_results_sample ON lab_results (sample_id);
CREATE INDEX idx_lab_results_parameter ON lab_results (parameter_name);
CREATE INDEX idx_lab_results_out_of_spec ON lab_results (in_spec) WHERE in_spec = false;

-- Product quality specifications
CREATE TABLE product_specifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id VARCHAR(255),
    source_system VARCHAR(100),
    product_name VARCHAR(200) NOT NULL,
    product_grade VARCHAR(100),
    parameter_name VARCHAR(200) NOT NULL,
    test_method VARCHAR(100),
    spec_min DOUBLE PRECISION,
    spec_max DOUBLE PRECISION,
    unit VARCHAR(50),
    regulatory BOOLEAN NOT NULL DEFAULT false,
    customer_specific BOOLEAN NOT NULL DEFAULT false,
    extra_data JSONB NOT NULL DEFAULT '{}',
    import_run_id UUID REFERENCES import_runs(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_product_specs UNIQUE (product_name, product_grade, parameter_name)
);
```

#### Environmental

```sql
-- Emissions exceedance events
CREATE TABLE emissions_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id VARCHAR(255),
    source_system VARCHAR(100),
    source_name VARCHAR(200),                 -- Stack, flare, vent name
    parameter_name VARCHAR(200) NOT NULL,     -- SO2, NOx, CO, PM, VOC, etc.
    value DOUBLE PRECISION NOT NULL,
    unit VARCHAR(50),
    regulatory_limit DOUBLE PRECISION,
    exceedance BOOLEAN NOT NULL DEFAULT false,
    event_time TIMESTAMPTZ NOT NULL,
    duration_minutes DOUBLE PRECISION,
    cause TEXT,
    corrective_action TEXT,
    reported BOOLEAN NOT NULL DEFAULT false,
    extra_data JSONB NOT NULL DEFAULT '{}',
    import_run_id UUID REFERENCES import_runs(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_emissions_external UNIQUE (source_system, external_id)
);

CREATE INDEX idx_emissions_time ON emissions_events (event_time DESC);
CREATE INDEX idx_emissions_exceedance ON emissions_events (exceedance) WHERE exceedance = true;

-- Environmental compliance records
CREATE TABLE compliance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id VARCHAR(255),
    source_system VARCHAR(100),
    record_type VARCHAR(20) NOT NULL
        CHECK (record_type IN ('inspection', 'audit', 'certification', 'violation')),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    status VARCHAR(30),
    agency VARCHAR(200),
    regulation_reference VARCHAR(200),
    due_date DATE,
    completed_date DATE,
    assigned_to VARCHAR(200),
    findings_count INTEGER,
    extra_data JSONB NOT NULL DEFAULT '{}',
    import_run_id UUID REFERENCES import_runs(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_compliance_external UNIQUE (source_system, external_id)
);

-- Ambient / fenceline monitoring (hypertable candidate)
CREATE TABLE ambient_monitoring (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    station_id VARCHAR(100) NOT NULL,
    station_name VARCHAR(200),
    parameter_name VARCHAR(200) NOT NULL,
    value DOUBLE PRECISION NOT NULL,
    unit VARCHAR(50),
    measurement_time TIMESTAMPTZ NOT NULL,
    quality_flag VARCHAR(20),
    extra_data JSONB NOT NULL DEFAULT '{}',
    import_run_id UUID REFERENCES import_runs(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

SELECT create_hypertable('ambient_monitoring', 'measurement_time',
    chunk_time_interval => INTERVAL '1 day');
ALTER TABLE ambient_monitoring ADD CONSTRAINT pk_ambient PRIMARY KEY (id, measurement_time);
CREATE INDEX idx_ambient_station ON ambient_monitoring (station_id, measurement_time DESC);

-- LDAR (Leak Detection and Repair) records
CREATE TABLE ldar_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id VARCHAR(255),
    source_system VARCHAR(100),
    component_id VARCHAR(100),
    component_type VARCHAR(100),
    location VARCHAR(200),
    reading_ppm DOUBLE PRECISION,
    leak_threshold_ppm DOUBLE PRECISION,
    is_leak BOOLEAN NOT NULL DEFAULT false,
    inspection_date DATE,
    inspector_name VARCHAR(200),
    repair_date DATE,
    repair_method VARCHAR(200),
    extra_data JSONB NOT NULL DEFAULT '{}',
    import_run_id UUID REFERENCES import_runs(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_ldar_external UNIQUE (source_system, external_id)
);

CREATE INDEX idx_ldar_leaks ON ldar_records (is_leak) WHERE is_leak = true;
CREATE INDEX idx_ldar_inspection ON ldar_records (inspection_date DESC);

-- Environmental permits
CREATE TABLE permits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id VARCHAR(255),
    source_system VARCHAR(100),
    permit_type VARCHAR(100),
    permit_number VARCHAR(100),
    title VARCHAR(500) NOT NULL,
    issuing_agency VARCHAR(200),
    status VARCHAR(20) NOT NULL
        CHECK (status IN ('active', 'expired', 'pending_renewal', 'suspended')),
    issue_date DATE,
    expiry_date DATE,
    conditions JSONB,
    extra_data JSONB NOT NULL DEFAULT '{}',
    import_run_id UUID REFERENCES import_runs(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_permits_external UNIQUE (source_system, external_id)
);

CREATE INDEX idx_permits_expiry ON permits (expiry_date) WHERE status = 'active';

-- Waste manifests
CREATE TABLE waste_manifests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id VARCHAR(255),
    source_system VARCHAR(100),
    manifest_number VARCHAR(100),
    waste_code VARCHAR(50),
    waste_description TEXT,
    quantity DOUBLE PRECISION,
    unit VARCHAR(50),
    generator_name VARCHAR(200),
    transporter_name VARCHAR(200),
    destination_facility VARCHAR(200),
    ship_date DATE,
    receipt_date DATE,
    extra_data JSONB NOT NULL DEFAULT '{}',
    import_run_id UUID REFERENCES import_runs(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_waste_external UNIQUE (source_system, external_id)
);
```

#### Regulatory / Compliance

```sql
-- Management of Change records
CREATE TABLE moc_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id VARCHAR(255),
    source_system VARCHAR(100),
    moc_number VARCHAR(100),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    status VARCHAR(20) NOT NULL
        CHECK (status IN ('draft', 'submitted', 'under_review', 'approved', 'implemented', 'closed', 'rejected')),
    category VARCHAR(30)
        CHECK (category IN ('process', 'equipment', 'procedure', 'organization', 'temporary')),
    risk_level VARCHAR(10)
        CHECK (risk_level IN ('high', 'medium', 'low')),
    originator VARCHAR(200),
    approver VARCHAR(200),
    submitted_at TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,
    implementation_due_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    affected_equipment_ids UUID[],
    affected_point_ids UUID[],
    extra_data JSONB NOT NULL DEFAULT '{}',
    import_run_id UUID REFERENCES import_runs(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_moc_external UNIQUE (source_system, external_id)
);

CREATE INDEX idx_moc_status ON moc_records (status) WHERE status NOT IN ('closed', 'rejected');
CREATE INDEX idx_moc_due ON moc_records (implementation_due_at)
    WHERE status IN ('approved', 'implemented');

-- Safety incidents and near-misses
CREATE TABLE safety_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id VARCHAR(255),
    source_system VARCHAR(100),
    incident_number VARCHAR(100),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    incident_type VARCHAR(30) NOT NULL
        CHECK (incident_type IN (
            'injury', 'near_miss', 'property_damage',
            'environmental_release', 'process_safety', 'fire'
        )),
    severity VARCHAR(20)
        CHECK (severity IN ('catastrophic', 'major', 'moderate', 'minor', 'negligible')),
    status VARCHAR(30) NOT NULL
        CHECK (status IN ('reported', 'under_investigation', 'corrective_action', 'closed')),
    location VARCHAR(200),
    area VARCHAR(100),
    occurred_at TIMESTAMPTZ,
    reported_at TIMESTAMPTZ,
    reported_by VARCHAR(200),
    root_cause TEXT,
    corrective_actions JSONB,
    extra_data JSONB NOT NULL DEFAULT '{}',
    import_run_id UUID REFERENCES import_runs(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_incidents_external UNIQUE (source_system, external_id)
);

CREATE INDEX idx_incidents_type ON safety_incidents (incident_type);
CREATE INDEX idx_incidents_occurred ON safety_incidents (occurred_at DESC);
CREATE INDEX idx_incidents_open ON safety_incidents (status) WHERE status != 'closed';

-- Inspection and audit findings
CREATE TABLE inspection_findings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id VARCHAR(255),
    source_system VARCHAR(100),
    inspection_type VARCHAR(30) NOT NULL
        CHECK (inspection_type IN ('regulatory', 'internal', 'insurance', 'mechanical_integrity')),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    finding_type VARCHAR(20) NOT NULL
        CHECK (finding_type IN ('observation', 'minor_finding', 'major_finding', 'critical_finding')),
    status VARCHAR(20) NOT NULL
        CHECK (status IN ('open', 'in_progress', 'closed', 'overdue')),
    equipment_id UUID REFERENCES equipment(id),
    assigned_to VARCHAR(200),
    due_date DATE,
    closed_date DATE,
    regulation_reference VARCHAR(200),
    extra_data JSONB NOT NULL DEFAULT '{}',
    import_run_id UUID REFERENCES import_runs(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_findings_external UNIQUE (source_system, external_id)
);

CREATE INDEX idx_findings_status ON inspection_findings (status) WHERE status NOT IN ('closed');
CREATE INDEX idx_findings_equipment ON inspection_findings (equipment_id);
CREATE INDEX idx_findings_due ON inspection_findings (due_date) WHERE status IN ('open', 'in_progress');

-- Regulatory permits (separate from environmental permits — covers PSM, operating, etc.)
CREATE TABLE regulatory_permits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id VARCHAR(255),
    source_system VARCHAR(100),
    permit_type VARCHAR(100),
    permit_number VARCHAR(100),
    title VARCHAR(500) NOT NULL,
    issuing_agency VARCHAR(200),
    status VARCHAR(20) NOT NULL
        CHECK (status IN ('active', 'expired', 'pending_renewal', 'suspended')),
    issue_date DATE,
    expiry_date DATE,
    conditions JSONB,
    responsible_person VARCHAR(200),
    extra_data JSONB NOT NULL DEFAULT '{}',
    import_run_id UUID REFERENCES import_runs(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_reg_permits_external UNIQUE (source_system, external_id)
);

CREATE INDEX idx_reg_permits_expiry ON regulatory_permits (expiry_date) WHERE status = 'active';

-- Risk assessments (PHA, HAZOP, LOPA, etc.)
CREATE TABLE risk_assessments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id VARCHAR(255),
    source_system VARCHAR(100),
    assessment_type VARCHAR(20) NOT NULL
        CHECK (assessment_type IN ('pha', 'hazop', 'lopa', 'what_if', 'bowtie')),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    status VARCHAR(30),
    facility_area VARCHAR(200),
    unit VARCHAR(100),
    assessment_date DATE,
    next_revalidation_date DATE,
    team_lead VARCHAR(200),
    recommendations_count INTEGER,
    open_actions_count INTEGER,
    extra_data JSONB NOT NULL DEFAULT '{}',
    import_run_id UUID REFERENCES import_runs(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_risk_external UNIQUE (source_system, external_id)
);

CREATE INDEX idx_risk_revalidation ON risk_assessments (next_revalidation_date);
```

#### Integration Table Triggers

```sql
-- updated_at triggers for all integration tables with updated_at columns
CREATE TRIGGER trg_equipment_updated_at BEFORE UPDATE ON equipment FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_work_orders_updated_at BEFORE UPDATE ON work_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_spare_parts_updated_at BEFORE UPDATE ON spare_parts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_pm_schedules_updated_at BEFORE UPDATE ON pm_schedules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_inventory_items_updated_at BEFORE UPDATE ON inventory_items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_purchase_orders_updated_at BEFORE UPDATE ON purchase_orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_vendor_master_updated_at BEFORE UPDATE ON vendor_master FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_cost_centers_updated_at BEFORE UPDATE ON cost_centers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_tickets_updated_at BEFORE UPDATE ON tickets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_sample_points_updated_at BEFORE UPDATE ON sample_points FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_lab_samples_updated_at BEFORE UPDATE ON lab_samples FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_product_specs_updated_at BEFORE UPDATE ON product_specifications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_emissions_updated_at BEFORE UPDATE ON emissions_events FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_compliance_updated_at BEFORE UPDATE ON compliance_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_ldar_updated_at BEFORE UPDATE ON ldar_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_permits_updated_at BEFORE UPDATE ON permits FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_waste_manifests_updated_at BEFORE UPDATE ON waste_manifests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_moc_records_updated_at BEFORE UPDATE ON moc_records FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_safety_incidents_updated_at BEFORE UPDATE ON safety_incidents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_inspection_findings_updated_at BEFORE UPDATE ON inspection_findings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_regulatory_permits_updated_at BEFORE UPDATE ON regulatory_permits FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_risk_assessments_updated_at BEFORE UPDATE ON risk_assessments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- No audit triggers on integration tables (same rationale as import_runs).
-- The import_runs table tracks what changed and when. Equipment table gets audit triggers
-- since it can be manually edited.
CREATE TRIGGER trg_audit_equipment AFTER INSERT OR UPDATE OR DELETE ON equipment FOR EACH ROW EXECUTE FUNCTION log_audit_trail();
```

### Export & Bulk Update Tables

Full DDL for export tables (3 tables with indexes, triggers, and audit logging) is defined in [25_EXPORT_SYSTEM.md](25_EXPORT_SYSTEM.md) Section 12. Summary:

```sql
-- Export and bulk update job queue
CREATE TABLE export_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_type VARCHAR(30) NOT NULL
        CHECK (job_type IN ('data_export', 'bulk_update_template', 'bulk_update_apply')),
    status VARCHAR(20) NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'processing', 'completed', 'failed', 'cancelled')),
    module VARCHAR(50) NOT NULL,
    entity VARCHAR(100) NOT NULL,
    format VARCHAR(20)
        CHECK (format IN ('csv', 'xlsx', 'pdf', 'json', 'parquet', 'html')),
    filters JSONB DEFAULT '{}',
    columns TEXT[],
    sort_field VARCHAR(100),
    sort_order VARCHAR(4) DEFAULT 'asc'
        CHECK (sort_order IN ('asc', 'desc')),
    file_path VARCHAR(500),
    file_size_bytes BIGINT,
    original_filename VARCHAR(255),
    rows_total INTEGER,
    rows_processed INTEGER DEFAULT 0,
    error_message TEXT,
    notify_email BOOLEAN NOT NULL DEFAULT false,
    email_address VARCHAR(255),
    snapshot_id UUID,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Point-in-time configuration snapshots
CREATE TABLE change_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name VARCHAR(100) NOT NULL,
    snapshot_type VARCHAR(20) NOT NULL
        CHECK (snapshot_type IN ('automatic', 'manual')),
    description TEXT,
    row_count INTEGER NOT NULL DEFAULT 0,
    filter_criteria JSONB,
    related_job_id UUID REFERENCES export_jobs(id) ON DELETE SET NULL,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Individual row data within a snapshot
CREATE TABLE change_snapshot_rows (
    id BIGSERIAL PRIMARY KEY,
    snapshot_id UUID NOT NULL REFERENCES change_snapshots(id) ON DELETE CASCADE,
    record_id UUID NOT NULL,
    row_data JSONB NOT NULL
);
```

See 25_EXPORT_SYSTEM.md Section 12 for complete indexes, triggers, FK constraints, and audit trigger assignments.

### Recognition Tables

Stores user corrections to symbol recognition results (P&ID and DCS) for feedback export to SymBA. See [26_PID_RECOGNITION.md](26_PID_RECOGNITION.md) for full recognition architecture and `.iofeedback` export format.

```sql
-- User corrections to model predictions (for feedback export)
CREATE TABLE recognition_correction (
    correction_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    image_hash      VARCHAR(64) NOT NULL,       -- SHA-256 of source image
    correction_type VARCHAR(20) NOT NULL,        -- 'class_change', 'rejection', 'addition', 'box_adjust'
    original_data   JSONB,                       -- original detection
    corrected_data  JSONB NOT NULL,              -- corrected annotation
    model_version   VARCHAR(20) NOT NULL,
    created_by      UUID NOT NULL REFERENCES users(id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_correction_model ON recognition_correction(model_version);
CREATE INDEX idx_correction_created ON recognition_correction(created_at);
```

### Forensics/Investigation Tables

Investigations with staged analysis, evidence toolkit, point curation, sharing, and entity linking. See [12_FORENSICS_MODULE.md](12_FORENSICS_MODULE.md) for the full investigation model.

```sql
-- Investigations (top-level forensic analysis container)
CREATE TABLE investigations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(500) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'closed', 'cancelled')),
    anchor_point_id UUID REFERENCES points_metadata(point_id),
    anchor_alarm_id UUID,                  -- references alarm_states but no FK (alarm may be cleared)
    snapshot JSONB,                        -- frozen state on close (all stages, evidence, points)
    created_by UUID NOT NULL REFERENCES users(id),
    closed_at TIMESTAMPTZ,
    closed_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ                 -- soft delete
);

CREATE INDEX idx_investigations_created_by ON investigations(created_by);
CREATE INDEX idx_investigations_status ON investigations(status) WHERE deleted_at IS NULL;
CREATE INDEX idx_investigations_anchor_point ON investigations(anchor_point_id) WHERE anchor_point_id IS NOT NULL;

-- Investigation stages (sequential narrative sections with own time ranges)
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

CREATE INDEX idx_investigation_stages_investigation ON investigation_stages(investigation_id);

-- Investigation evidence (items within a stage: trends, snapshots, correlations, etc.)
CREATE TABLE investigation_evidence (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stage_id UUID NOT NULL REFERENCES investigation_stages(id) ON DELETE CASCADE,
    evidence_type VARCHAR(50) NOT NULL
        CHECK (evidence_type IN ('trend', 'point_detail', 'alarm_list', 'value_table',
            'graphic_snapshot', 'correlation', 'log_entries', 'round_entries',
            'calculated_series', 'annotation')),
    config JSONB NOT NULL,                 -- type-specific configuration (point_ids, time range, graphic_id, timestamp, etc.)
    sort_order SMALLINT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_investigation_evidence_stage ON investigation_evidence(stage_id);

-- Investigation points (curated point list: included, suggested, or removed with reason)
CREATE TABLE investigation_points (
    investigation_id UUID NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
    point_id UUID NOT NULL REFERENCES points_metadata(point_id),
    status VARCHAR(20) NOT NULL DEFAULT 'included'
        CHECK (status IN ('included', 'suggested', 'removed')),
    removal_reason TEXT,                   -- logged reason when investigator removes a suggested point
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    removed_at TIMESTAMPTZ,
    PRIMARY KEY (investigation_id, point_id)
);

-- Investigation shares (who can see a private investigation)
CREATE TABLE investigation_shares (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    investigation_id UUID NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
    shared_with_user_id UUID REFERENCES users(id),
    shared_with_role VARCHAR(100),          -- role name, NULL if sharing with specific user
    shared_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    shared_by UUID NOT NULL REFERENCES users(id)
);

CREATE INDEX idx_investigation_shares_investigation ON investigation_shares(investigation_id);
CREATE INDEX idx_investigation_shares_user ON investigation_shares(shared_with_user_id) WHERE shared_with_user_id IS NOT NULL;

-- Investigation entity links (link to log entries, tickets, alarms, other investigations)
CREATE TABLE investigation_links (
    investigation_id UUID NOT NULL REFERENCES investigations(id) ON DELETE CASCADE,
    linked_entity_type VARCHAR(50) NOT NULL
        CHECK (linked_entity_type IN ('log_entry', 'ticket', 'alarm_event', 'investigation')),
    linked_entity_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id),
    PRIMARY KEY (investigation_id, linked_entity_type, linked_entity_id)
);
```

`updated_at` triggers: `investigations`, `investigation_stages`, `investigation_evidence`. Audit triggers: `investigations` (create, status change, delete), `investigation_shares` (share, revoke).

### Alerting Tables

Alert templates, recipient rosters, alert instances with delivery tracking, escalation history, channel configuration, and push subscriptions. See [27_ALERT_SYSTEM.md](27_ALERT_SYSTEM.md) for full alert architecture.

```sql
CREATE TYPE alert_severity AS ENUM ('emergency', 'critical', 'warning', 'info');
CREATE TYPE alert_status AS ENUM ('active', 'acknowledged', 'resolved', 'cancelled');

CREATE TABLE alert_templates (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                    VARCHAR(200) NOT NULL UNIQUE,
    severity                alert_severity NOT NULL,
    title_template          TEXT NOT NULL,
    message_template        TEXT NOT NULL,
    channels                TEXT[] NOT NULL,
    default_roster_id       UUID REFERENCES alert_rosters(id),
    escalation_policy       JSONB,
    requires_acknowledgment BOOLEAN NOT NULL DEFAULT false,
    auto_resolve_minutes    INT,
    category                VARCHAR(50) NOT NULL DEFAULT 'custom',
    variables               TEXT[],
    enabled                 BOOLEAN NOT NULL DEFAULT true,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by              UUID REFERENCES users(id),
    updated_by              UUID REFERENCES users(id)
);

CREATE TABLE alert_rosters (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(200) NOT NULL UNIQUE,
    description     TEXT,
    source          VARCHAR(20) NOT NULL DEFAULT 'manual',
    source_config   JSONB,
    members         JSONB NOT NULL DEFAULT '[]',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      UUID REFERENCES users(id),
    updated_by      UUID REFERENCES users(id)
);

CREATE TABLE alerts (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id         UUID REFERENCES alert_templates(id),
    severity            alert_severity NOT NULL,
    status              alert_status NOT NULL DEFAULT 'active',
    title               VARCHAR(500) NOT NULL,
    message             TEXT NOT NULL,
    source              VARCHAR(100) NOT NULL,
    source_reference_id UUID,
    roster_id           UUID REFERENCES alert_rosters(id),
    escalation_policy   JSONB,
    current_escalation  SMALLINT NOT NULL DEFAULT 0,
    channels_used       TEXT[] NOT NULL,
    triggered_by        UUID REFERENCES users(id),
    triggered_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    acknowledged_by     UUID REFERENCES users(id),
    acknowledged_at     TIMESTAMPTZ,
    resolved_by         UUID REFERENCES users(id),
    resolved_at         TIMESTAMPTZ,
    cancelled_by        UUID REFERENCES users(id),
    cancelled_at        TIMESTAMPTZ,
    metadata            JSONB
);

CREATE INDEX idx_alerts_status ON alerts (status) WHERE status = 'active';
CREATE INDEX idx_alerts_severity_time ON alerts (severity, triggered_at DESC);
CREATE INDEX idx_alerts_source ON alerts (source, source_reference_id);

CREATE TABLE alert_deliveries (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id          UUID NOT NULL REFERENCES alerts(id),
    channel_type      VARCHAR(30) NOT NULL,
    recipient_user_id UUID REFERENCES users(id),
    recipient_name    VARCHAR(200),
    recipient_contact VARCHAR(300),
    status            VARCHAR(30) NOT NULL DEFAULT 'pending',
    sent_at           TIMESTAMPTZ,
    delivered_at      TIMESTAMPTZ,
    acknowledged_at   TIMESTAMPTZ,
    failure_reason    TEXT,
    external_id       VARCHAR(200),
    escalation_level  SMALLINT NOT NULL DEFAULT 0,
    metadata          JSONB
);

CREATE INDEX idx_alert_deliveries_alert ON alert_deliveries (alert_id);
CREATE INDEX idx_alert_deliveries_status ON alert_deliveries (alert_id, status) WHERE status IN ('pending', 'sending');

CREATE TABLE alert_escalations (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id     UUID NOT NULL REFERENCES alerts(id),
    from_level   SMALLINT NOT NULL,
    to_level     SMALLINT NOT NULL,
    reason       VARCHAR(100) NOT NULL,
    escalated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_alert_escalations_alert ON alert_escalations (alert_id);

CREATE TABLE alert_channels (
    channel_type    VARCHAR(30) PRIMARY KEY,
    display_name    VARCHAR(100) NOT NULL,
    enabled         BOOLEAN NOT NULL DEFAULT false,
    config          JSONB NOT NULL DEFAULT '{}',
    last_tested_at  TIMESTAMPTZ,
    last_test_ok    BOOLEAN,
    last_test_error TEXT,
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by      UUID REFERENCES users(id)
);

CREATE TABLE push_subscriptions (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id),
    endpoint    TEXT NOT NULL UNIQUE,
    p256dh_key  TEXT NOT NULL,
    auth_key    TEXT NOT NULL,
    user_agent  VARCHAR(500),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_used_at TIMESTAMPTZ
);

CREATE INDEX idx_push_subscriptions_user ON push_subscriptions (user_id);
```

### Email Tables

Email provider configuration with failover, MiniJinja-based email templates, persistent send queue with retry, and delivery logging. See [28_EMAIL_SERVICE.md](28_EMAIL_SERVICE.md) for full email architecture.

```sql
CREATE TABLE email_providers (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            VARCHAR(100) NOT NULL UNIQUE,
    provider_type   VARCHAR(20) NOT NULL,
    config          JSONB NOT NULL,
    is_default      BOOLEAN NOT NULL DEFAULT false,
    is_fallback     BOOLEAN NOT NULL DEFAULT false,
    enabled         BOOLEAN NOT NULL DEFAULT true,
    from_address    VARCHAR(254) NOT NULL,
    from_name       VARCHAR(200),
    last_tested_at  TIMESTAMPTZ,
    last_test_ok    BOOLEAN,
    last_test_error TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      UUID REFERENCES users(id),
    updated_by      UUID REFERENCES users(id)
);

CREATE UNIQUE INDEX idx_email_providers_default ON email_providers (is_default) WHERE is_default = true;

CREATE TABLE email_templates (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name              VARCHAR(100) NOT NULL UNIQUE,
    category          VARCHAR(20) NOT NULL DEFAULT 'custom',
    subject_template  TEXT NOT NULL,
    body_html         TEXT NOT NULL,
    body_text         TEXT,
    variables_schema  JSONB,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by        UUID REFERENCES users(id),
    updated_by        UUID REFERENCES users(id)
);

CREATE TABLE email_queue (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id     UUID REFERENCES email_providers(id),
    template_id     UUID REFERENCES email_templates(id),
    to_addresses    TEXT[] NOT NULL,
    cc_addresses    TEXT[] DEFAULT '{}',
    bcc_addresses   TEXT[] DEFAULT '{}',
    reply_to        VARCHAR(254),
    subject         TEXT NOT NULL,
    body_html       TEXT NOT NULL,
    body_text       TEXT,
    attachments     JSONB,
    priority        SMALLINT NOT NULL DEFAULT 2,
    status          VARCHAR(20) NOT NULL DEFAULT 'pending',
    attempts        SMALLINT NOT NULL DEFAULT 0,
    max_attempts    SMALLINT NOT NULL DEFAULT 4,
    next_attempt    TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_error      TEXT,
    context_type    VARCHAR(50),
    context_id      UUID,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    sent_at         TIMESTAMPTZ,
    created_by      UUID REFERENCES users(id)
);

CREATE INDEX idx_email_queue_pending ON email_queue (priority, next_attempt) WHERE status IN ('pending', 'retry');
CREATE INDEX idx_email_queue_context ON email_queue (context_type, context_id);

CREATE TABLE email_delivery_log (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    queue_id            UUID NOT NULL REFERENCES email_queue(id),
    provider_id         UUID NOT NULL REFERENCES email_providers(id),
    attempt_number      SMALLINT NOT NULL,
    status              VARCHAR(20) NOT NULL,
    provider_message_id VARCHAR(200),
    provider_response   TEXT,
    error_details       TEXT,
    sent_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_email_delivery_log_queue ON email_delivery_log (queue_id);
```

### Authentication (Extended) Tables

Auth provider configurations, multi-factor authentication, API keys for service accounts, OIDC/SAML flow state, and SCIM provisioning tokens. See [29_AUTHENTICATION.md](29_AUTHENTICATION.md) for full authentication architecture.

```sql
CREATE TYPE auth_provider_type AS ENUM ('oidc', 'saml', 'ldap');
CREATE TYPE mfa_type AS ENUM ('totp', 'duo', 'sms', 'email');

-- Auth provider configurations (OIDC, SAML, LDAP)
CREATE TABLE auth_provider_configs (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_type       auth_provider_type NOT NULL,
    name                VARCHAR(100) NOT NULL UNIQUE,
    display_name        VARCHAR(200) NOT NULL,      -- shown on login page button
    enabled             BOOLEAN NOT NULL DEFAULT false,
    config              JSONB NOT NULL,             -- provider-specific config (secrets encrypted)
    jit_provisioning    BOOLEAN NOT NULL DEFAULT false,
    default_role_id     UUID REFERENCES roles(id),
    group_role_mapping  JSONB,                      -- {"idp_group": "io_role_name", ...}
    display_order       SMALLINT NOT NULL DEFAULT 0,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by          UUID REFERENCES users(id),
    updated_by          UUID REFERENCES users(id)
);

-- MFA enrollment per user
CREATE TABLE user_mfa (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    mfa_type    mfa_type NOT NULL,
    secret      TEXT,                    -- encrypted TOTP secret (NULL for Duo)
    status      VARCHAR(20) NOT NULL DEFAULT 'pending_verification',
                -- 'pending_verification', 'active', 'disabled'
    verified_at TIMESTAMPTZ,
    last_used_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, mfa_type)
);

-- MFA recovery codes (single-use, stored as Argon2id hashes)
CREATE TABLE mfa_recovery_codes (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    code_hash   VARCHAR(255) NOT NULL,  -- Argon2id hash
    used_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_mfa_recovery_codes_user ON mfa_recovery_codes (user_id) WHERE used_at IS NULL;

-- Per-role MFA policies
CREATE TABLE mfa_policies (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id             UUID REFERENCES roles(id) UNIQUE,  -- NULL = system default
    mfa_required        BOOLEAN NOT NULL DEFAULT false,
    allowed_methods     TEXT[] NOT NULL DEFAULT '{}',  -- {'totp', 'duo', 'sms', 'email'}
    required_method     TEXT,                           -- NULL = any allowed method
    grace_period_hours  INT NOT NULL DEFAULT 0,
    max_failures        SMALLINT NOT NULL DEFAULT 5,
    lockout_duration_minutes INT NOT NULL DEFAULT 30,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- API keys for service accounts
CREATE TABLE api_keys (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,
    key_hash        VARCHAR(255) NOT NULL,  -- Argon2id hash of the API key
    key_prefix      VARCHAR(10) NOT NULL,   -- First 8 chars for identification (e.g., "io_sk_a3b")
    scopes          TEXT[],                 -- optional permission restrictions
    expires_at      TIMESTAMPTZ,
    last_used_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by      UUID REFERENCES users(id)
);

-- OIDC/SAML state storage (short-lived, for in-flight auth flows)
CREATE TABLE auth_flow_state (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_type   VARCHAR(20) NOT NULL,
    state_token     VARCHAR(255) NOT NULL UNIQUE,
    nonce           VARCHAR(255),
    code_verifier   VARCHAR(255),       -- PKCE (OIDC only)
    relay_state     TEXT,               -- SAML RelayState
    expires_at      TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_auth_flow_state_token ON auth_flow_state (state_token);
CREATE INDEX idx_auth_flow_state_expiry ON auth_flow_state (expires_at);

-- SCIM bearer tokens
CREATE TABLE scim_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(100) NOT NULL,
    token_hash  VARCHAR(255) NOT NULL,
    token_prefix VARCHAR(10) NOT NULL,
    enabled     BOOLEAN NOT NULL DEFAULT true,
    last_used_at TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by  UUID REFERENCES users(id)
);
```

### Operational Tables — Events & Alarms

Unified event model where alarms are a type of event. Based on ISA-18.2 alarm state model and OPC UA Alarms & Conditions (Part 9). See `research-industrial-events-alarms.md` for full background and `category-c-decisions.md` (C2) for design decisions.

**Key principle:** OPC-sourced alarms are READ-ONLY mirrors from the DCS — I/O displays but does not modify their state. I/O-generated alarms (threshold wizard + expression builder) have full state machine ownership: users can acknowledge, shelve, suppress.

```sql
-- Event type categories (from ISA-18.2 + OPC UA A&C research)
-- process_alarm:        HH, H, L, LL, deviation, ROC, bad PV, OOR, discrepancy, trip
-- operator_action:      setpoint change, mode change, output change, override
-- system_event:         controller failover, comm loss, module fault, redundancy switch
-- config_change:        module download, alarm config change, database change
-- safety_event:         SIS trip, SIS bypass, SIS test, SIS fault
-- io_alarm:             I/O-generated alarm from threshold wizard (single point, HH/H/L/LL)
-- io_expression_alarm:  I/O-generated alarm from expression builder (multi-point logic)
CREATE TYPE event_type_enum AS ENUM (
    'process_alarm', 'operator_action', 'system_event',
    'config_change', 'safety_event', 'io_alarm', 'io_expression_alarm'
);

-- Where the event originated
CREATE TYPE event_source_enum AS ENUM (
    'opc', 'supplemental', 'io_threshold', 'io_expression', 'system', 'operator', 'scheduled'
);
-- 'opc'         — event written directly by OPC UA A&C subscription
-- 'supplemental' — event fetched from a DCS supplemental REST/SQL connector (PI Web API, Experion EPDOC, etc.)

-- ISA-18.2 alarm states (four basic states + overlay states)
-- active:          Alarm condition present, unacknowledged (annunciating)
-- acknowledged:    Alarm condition present, operator acknowledged
-- rtn:             Alarm condition cleared, unacknowledged (return to normal)
-- cleared:         Alarm condition cleared and acknowledged (normal state)
-- shelved:         Operator-initiated temporary suppression (time-limited)
-- suppressed:      System-initiated suppression by design (state-based)
-- out_of_service:  Removed from monitoring for maintenance
-- disabled:        Alarm point disabled in configuration
-- latched:         Alarm remains active-state even after condition clears (manual reset required)
CREATE TYPE alarm_state_enum AS ENUM (
    'active', 'acknowledged', 'rtn', 'cleared',
    'shelved', 'suppressed', 'out_of_service', 'disabled', 'latched'
);

-- ISA-18.2 priority levels (max 4 for process alarms)
-- urgent:      Safety/life/major environmental — immediate response (< 5 min)
-- high:        Equipment damage, significant production loss — response < 15 min
-- medium:      Minor production impact, quality deviation — response < 60 min
-- low:         Informational, maintenance planning — response in hours
-- diagnostic:  Instrument/system self-diagnostics — no operator action required
CREATE TYPE alarm_priority_enum AS ENUM (
    'urgent', 'high', 'medium', 'low', 'diagnostic'
);

-- Unified event table (all event types stored here)
-- TimescaleDB hypertable for efficient time-range queries and retention
CREATE TABLE events (
    id UUID NOT NULL DEFAULT gen_random_uuid(),
    event_type event_type_enum NOT NULL,
    source event_source_enum NOT NULL,
    severity SMALLINT NOT NULL DEFAULT 500,
        -- OPC UA convention: 1 (lowest) to 1000 (highest)
    priority alarm_priority_enum,
        -- ISA-18.2 priority — populated for alarm-type events, NULL for non-alarm events
    point_id UUID REFERENCES points_metadata(id),
        -- nullable: system events and config changes may not have a point
    message TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
        -- When the event occurred (source time)
    source_timestamp TIMESTAMPTZ,
        -- Original OPC UA source timestamp — may differ from received time due to
        -- network latency, buffering, or time sync differences between DCS and I/O
    metadata JSONB NOT NULL DEFAULT '{}',
        -- Extensible key-value data. Contents vary by event_type:
        -- process_alarm:   { "alarm_type": "HH"|"H"|"L"|"LL"|"DEV_H"|"DEV_L"|"ROC"|"BAD_PV"|"OOR"|"DISC"|"TRIP",
        --                     "limit_value": number, "actual_value": number, "deadband": number,
        --                     "setpoint_value": number, "opc_event_id": string, "opc_source_node": string,
        --                     "opc_condition_id": string, "opc_branch_id": string, "quality": number }
        -- operator_action: { "action_type": "sp_change"|"mode_change"|"output_change"|"alarm_ack"|...,
        --                     "old_value": string, "new_value": string, "user_id": uuid }
        -- system_event:    { "subsystem": string, "device": string, "previous_state": string, "new_state": string }
        -- config_change:   { "change_type": string, "target": string, "old_config": object, "new_config": object }
        -- safety_event:    { "sif_id": string, "demand_type": string }
        -- io_alarm/io_expression_alarm: { "alarm_definition_id": uuid, "actual_value": number, "limit_value": number }
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Convert to hypertable (partitioned by timestamp, 1-day chunks)
SELECT create_hypertable('events', 'timestamp',
    chunk_time_interval => INTERVAL '1 day');

-- NOTE: TimescaleDB hypertables require unique constraints to include the partitioning column.
-- We use (id, timestamp) as the primary key equivalent.
ALTER TABLE events ADD CONSTRAINT pk_events PRIMARY KEY (id, timestamp);

-- ISA-18.2 alarm state machine tracking
-- Only alarm-type events (process_alarm, io_alarm, io_expression_alarm) get entries here.
-- Each row represents a state transition.
CREATE TABLE alarm_states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id UUID NOT NULL,
        -- FK to events table. Cannot use standard REFERENCES on hypertable;
        -- application-layer enforced. Indexed for join performance.
    event_timestamp TIMESTAMPTZ NOT NULL,
        -- Denormalized from events.timestamp for efficient hypertable joins
    state alarm_state_enum NOT NULL,
    previous_state alarm_state_enum,
        -- NULL on first state entry (alarm trip)
    transitioned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    transitioned_by UUID REFERENCES users(id),
        -- Non-null for user-initiated transitions: ack, shelve, suppress, out-of-service
        -- NULL for system-initiated transitions: alarm trip, alarm clear, auto-unshelve
    comment TEXT,
        -- Operator comment on state transition (e.g., reason for ack, shelve justification)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- I/O-generated alarm definitions (threshold wizard + expression builder)
-- These are the alarm configurations that I/O evaluates against live point data.
-- OPC-sourced alarms do NOT have entries here — they are mirrored as-is.
CREATE TABLE alarm_definitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    point_id UUID REFERENCES points_metadata(id),
        -- Non-null for threshold alarms (single point). Null for expression-based alarms
        -- that may reference multiple points.
    definition_type VARCHAR(20) NOT NULL
        CHECK (definition_type IN ('threshold', 'expression')),

    -- Threshold wizard config (populated when definition_type = 'threshold')
    -- JSONB Schema:
    -- {
    --   "hh": number|null,           -- High-High limit
    --   "h": number|null,            -- High limit
    --   "l": number|null,            -- Low limit
    --   "ll": number|null,           -- Low-Low limit
    --   "oor_low": number|null,      -- Out-of-range low
    --   "oor_high": number|null,     -- Out-of-range high
    --   "deadband": number|null      -- Hysteresis to prevent chattering
    -- }
    threshold_config JSONB,

    -- Expression builder FK (populated when definition_type = 'expression')
    expression_id UUID REFERENCES custom_expressions(id) ON DELETE SET NULL,

    -- ISA-18.2 priority assignment
    priority alarm_priority_enum NOT NULL DEFAULT 'low',

    enabled BOOLEAN NOT NULL DEFAULT true,
    created_by UUID NOT NULL REFERENCES users(id),
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
        -- Soft delete per system-wide F4 policy

    CONSTRAINT uq_alarm_definitions_name UNIQUE (name),
    CONSTRAINT chk_alarm_def_threshold CHECK (
        definition_type != 'threshold' OR threshold_config IS NOT NULL
    ),
    CONSTRAINT chk_alarm_def_expression CHECK (
        definition_type != 'expression' OR expression_id IS NOT NULL
    )
);

-- Active alarm shelves (operator-initiated temporary suppression)
-- ISA-18.2 requires shelves to be time-limited, tracked, and highly visible.
CREATE TABLE alarm_shelving (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alarm_definition_id UUID NOT NULL REFERENCES alarm_definitions(id) ON DELETE CASCADE,
    shelved_by UUID NOT NULL REFERENCES users(id),
    shelved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    shelf_duration_seconds INTEGER NOT NULL,
    shelf_expires_at TIMESTAMPTZ NOT NULL,
    reason TEXT NOT NULL,
        -- ISA-18.2 requires documented reason for every shelve action
    unshelved_at TIMESTAMPTZ,
        -- Non-null when manually unshelved before expiry
    unshelved_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Operational Tables — Rounds

Template/instance/response model supporting compound checkpoints, expression builder integration, GPS/barcode gates, and media attachments. See `category-c-decisions.md` (C3) for design decisions.

```sql
-- Round checklist definitions (versioned templates)
CREATE TABLE round_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    version INTEGER NOT NULL DEFAULT 1,

    -- Ordered array of checkpoint definitions (JSONB schema documented below)
    checkpoints JSONB NOT NULL DEFAULT '[]',

    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
        -- Soft delete per system-wide F4 policy

    CONSTRAINT uq_round_templates_name UNIQUE (name)
);

-- JSONB Schema: round_templates.checkpoints[]
-- Each element in the array is a checkpoint definition:
-- {
--   "index": 0,                            -- Position in checklist (0-based)
--   "label": "Pump P-101 Discharge Pressure",
--   "type": "numeric",                     -- "text" | "numeric" | "boolean" | "dropdown" | "multi_field"
--   "required": true,
--   "fields": [                            -- For multi_field type: array of sub-field definitions
--     { "name": "feet", "type": "numeric", "label": "Feet" },
--     { "name": "inches", "type": "numeric", "label": "Inches" },
--     { "name": "eighths", "type": "numeric", "label": "Eighths" }
--   ],
--   "expression_id": null,                 -- UUID FK to custom_expressions for calculated values
--                                          -- (e.g., compound measurement → decimal conversion,
--                                          --  compare manual reading to live OPC value)
--   "dropdown_options": ["Auto", "On", "Off", "Manual"],
--   "range_validation": {                  -- Data entry limits (not alarms)
--     "min": 0, "max": 500,
--     "unit": "psig",
--     "mode": "limit"                      -- "limit" = reject out-of-range entry
--   },                                     -- "alarm" = accept but trigger alarm actions
--   "alarm_thresholds": {                  -- ISA-18.2 style alarm limits on field readings
--     "hh": 450, "h": 400, "l": 50, "ll": 25
--   },
--   "alarm_actions": {                     -- Forced requirements when alarm threshold exceeded
--     "require_photo": true,
--     "require_comment": true,
--     "require_video": false
--   },
--   "barcode_required": true,              -- Entry GATE: must scan barcode to proceed
--   "barcode_value": "EQ-P101",            -- Expected barcode value
--   "gps_gate": {                          -- Entry GATE: must be within radius to proceed
--     "latitude": 29.7604,
--     "longitude": -95.3698,
--     "radius_meters": 50
--   },
--   "media_requirements": {                -- Per-checkpoint media requirements
--     "photo": "optional",                 -- "none" | "optional" | "required"
--     "video": "none",
--     "audio": "optional",
--     "comments": "optional"
--   }
-- }

-- Round scheduling configuration
CREATE TABLE round_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES round_templates(id) ON DELETE CASCADE,
    recurrence_type VARCHAR(20) NOT NULL
        CHECK (recurrence_type IN ('per_shift', 'daily', 'interval', 'weekly', 'custom')),

    -- Scheduling config (varies by recurrence_type):
    -- per_shift:  { "shift_ids": [uuid, ...], "frequency": 1 }
    --             (e.g., every shift, or every 3rd shift)
    -- daily:      { "time_of_day": "08:00", "timezone": "America/Chicago" }
    -- interval:   { "interval_hours": 4, "start_time": "06:00" }
    -- weekly:     { "days_of_week": [1, 3, 5], "time_of_day": "08:00" }
    -- custom:     { "cron": "0 */6 * * *" }
    recurrence_config JSONB NOT NULL DEFAULT '{}',

    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Individual round instances (generated per schedule)
CREATE TABLE round_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES round_templates(id) ON DELETE RESTRICT,
    schedule_id UUID REFERENCES round_schedules(id) ON DELETE SET NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'in_progress', 'completed', 'missed', 'transferred')),
    assigned_to_shift UUID,
        -- FK to shifts table (doc 30). NULL for unassigned/ad-hoc rounds.
    locked_to_user UUID REFERENCES users(id),
        -- Set when user starts the round. Transfer requires manager override
        -- or 1-minute no-acknowledgment auto-transfer.
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    due_by TIMESTAMPTZ,
    transfer_reason TEXT,
        -- Populated when status = 'transferred'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Individual checkpoint responses within a round instance
CREATE TABLE round_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id UUID NOT NULL REFERENCES round_instances(id) ON DELETE CASCADE,
    checkpoint_index INTEGER NOT NULL,
        -- Maps to checkpoints[index] in the round_template

    -- Response data
    response_type VARCHAR(20) NOT NULL
        CHECK (response_type IN ('text', 'numeric', 'boolean', 'dropdown', 'multi_field')),

    -- Actual response data (JSONB schema varies by response_type):
    -- text:        { "value": "string" }
    -- numeric:     { "value": 123.45 }
    -- boolean:     { "value": true }
    -- dropdown:    { "value": "Auto" }
    -- multi_field: { "fields": { "feet": 12, "inches": 6, "eighths": 3 } }
    response_value JSONB NOT NULL,

    -- Expression builder calculated result (e.g., compound measurement → decimal)
    calculated_value NUMERIC,
    expression_id UUID REFERENCES custom_expressions(id) ON DELETE SET NULL,

    -- Location verification
    gps_latitude DECIMAL(10,7),
        -- Logged on EVERY round entry (not just GPS-gated ones)
    gps_longitude DECIMAL(10,7),
    barcode_scanned VARCHAR(255),
        -- Actual barcode value scanned (for gate verification)

    -- Alarm state for this response
    is_out_of_range BOOLEAN NOT NULL DEFAULT false,
    alarm_triggered BOOLEAN NOT NULL DEFAULT false,
        -- True if response value exceeded alarm_thresholds in checkpoint definition

    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_round_responses_instance_checkpoint UNIQUE (instance_id, checkpoint_index)
);

-- Media attachments per round response (photos, video, audio)
CREATE TABLE round_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    response_id UUID NOT NULL REFERENCES round_responses(id) ON DELETE CASCADE,
    media_type VARCHAR(10) NOT NULL
        CHECK (media_type IN ('photo', 'video', 'audio')),
    file_path TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    is_required BOOLEAN NOT NULL DEFAULT false,
        -- True if this media was forced by an alarm_action requirement
    extracted_text TEXT,                    -- OCR-extracted text from image attachments (Tesseract, async on upload)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Operational Tables — Logs

Template/segment/instance model supporting WYSIWYG text, field tables, field lists, and point-data-populated sections. See `category-c-decisions.md` (C9/C13) for design decisions.

```sql
-- Log templates assembled from reusable segments
CREATE TABLE log_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    version INTEGER NOT NULL DEFAULT 1,

    -- Ordered array of segment IDs defining the template structure
    segment_ids UUID[] NOT NULL DEFAULT '{}',

    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
        -- Soft delete per system-wide F4 policy

    CONSTRAINT uq_log_templates_name UNIQUE (name)
);

-- Reusable building-block segments for log templates
CREATE TABLE log_segments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    segment_type VARCHAR(20) NOT NULL
        CHECK (segment_type IN ('wysiwyg', 'field_table', 'field_list', 'point_data')),

    -- Segment configuration (JSONB schema varies by segment_type):
    -- wysiwyg:     { "template_html": "<p>Shift notes...</p>",
    --                "placeholder_text": "Enter shift notes here" }
    -- field_table: { "columns": [
    --                  { "name": "equipment", "label": "Equipment", "type": "text" },
    --                  { "name": "reading", "label": "Reading", "type": "numeric", "unit": "psig" },
    --                  { "name": "status", "label": "Status", "type": "dropdown",
    --                    "options": ["Normal", "Abnormal", "N/A"] }
    --                ],
    --                "min_rows": 1, "max_rows": 50 }
    -- field_list:  { "fields": [
    --                  { "name": "shift_supervisor", "label": "Shift Supervisor", "type": "text", "required": true },
    --                  { "name": "personnel_count", "label": "Personnel on Shift", "type": "numeric" }
    --                ] }
    -- point_data:  { "point_ids": [uuid, ...],
    --                "display_columns": ["tagname", "value", "unit", "quality"],
    --                "snapshot_on_create": true }
    content_config JSONB NOT NULL DEFAULT '{}',

    is_reusable BOOLEAN NOT NULL DEFAULT true,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Log scheduling configuration
CREATE TABLE log_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES log_templates(id) ON DELETE CASCADE,
    recurrence_type VARCHAR(20) NOT NULL
        CHECK (recurrence_type IN ('per_shift', 'daily', 'interval', 'weekly', 'custom')),
    recurrence_config JSONB NOT NULL DEFAULT '{}',
        -- Same schema as round_schedules.recurrence_config
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Log instances generated per schedule
CREATE TABLE log_instances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES log_templates(id) ON DELETE RESTRICT,
    schedule_id UUID REFERENCES log_schedules(id) ON DELETE SET NULL,
    shift_id UUID,
        -- FK to shifts table (doc 30). NULL for non-shift-tagged logs.
    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'in_progress', 'completed')),
    team_name VARCHAR(100),
        -- For multiple logs per shift (e.g., "logistics" vs "utilities")
    assigned_to_shift UUID,
        -- FK to shifts table (doc 30)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ,
        -- Soft delete per system-wide F4 policy
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Operator-filled content per segment per log instance
CREATE TABLE log_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    instance_id UUID NOT NULL REFERENCES log_instances(id) ON DELETE CASCADE,
    segment_id UUID NOT NULL REFERENCES log_segments(id) ON DELETE RESTRICT,

    -- Actual entered data (JSONB schema varies by segment_type):
    -- wysiwyg:     { "html": "<p>Boiler tripped at 0300...</p>" }
    -- field_table: { "rows": [
    --                  { "equipment": "P-101", "reading": 125.3, "status": "Normal" },
    --                  { "equipment": "P-102", "reading": 89.7, "status": "Abnormal" }
    --                ] }
    -- field_list:  { "fields": { "shift_supervisor": "John Smith", "personnel_count": 12 } }
    -- point_data:  { "snapshot": [
    --                  { "point_id": uuid, "tagname": "TI-101", "value": 350.2,
    --                    "unit": "degF", "quality": "Good", "captured_at": "2026-03-10T..." }
    --                ] }
    content JSONB NOT NULL DEFAULT '{}',

    -- Plain text extraction for full-text search (C17)
    -- Application layer extracts searchable text from JSONB content and writes here.
    content_text TEXT,

    -- Full-text search vector (auto-generated from content_text)
    content_tsvector TSVECTOR GENERATED ALWAYS AS (
        to_tsvector('english', COALESCE(content_text, ''))
    ) STORED,

    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_log_entries_instance_segment UNIQUE (instance_id, segment_id)
);

-- Full-text search GIN index on log entries
CREATE INDEX idx_log_entries_fts ON log_entries USING GIN (content_tsvector);

-- Media attachments per log entry
CREATE TABLE log_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entry_id UUID NOT NULL REFERENCES log_entries(id) ON DELETE CASCADE,
    media_type VARCHAR(10) NOT NULL
        CHECK (media_type IN ('photo', 'video', 'audio')),
    file_path TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    extracted_text TEXT,                    -- OCR-extracted text from image attachments (Tesseract, async on upload)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### Sites, Data Categories & Certificates Tables

```sql
-- Sites: multi-site deployment support (site-scoped data, role assignments, dashboards)
CREATE TABLE sites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL UNIQUE,
    code VARCHAR(20) NOT NULL UNIQUE,
        -- Short code for display, filtering, and API use (e.g., 'HOU', 'BAY3')
    description TEXT,
    timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User-Site many-to-many (users can be assigned to multiple sites)
CREATE TABLE user_sites (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, site_id)
);

-- Data categories for classifying data sources / import connections
CREATE TABLE data_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    is_predefined BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- IdP role mappings: map external IdP groups/claims to I/O roles
-- Replaces the simple JSONB group_role_mapping on auth_provider_configs
-- with a fully queryable, site-aware mapping table.
CREATE TABLE idp_role_mappings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider_id UUID NOT NULL REFERENCES auth_provider_configs(id) ON DELETE CASCADE,
    match_type VARCHAR(20) NOT NULL CHECK (match_type IN ('exact', 'prefix', 'regex')),
        -- exact: IdP group name must match match_value exactly
        -- prefix: IdP group name must start with match_value
        -- regex: IdP group name must match match_value as a regex pattern
    match_value VARCHAR(500) NOT NULL,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    site_id UUID REFERENCES sites(id) ON DELETE CASCADE,
        -- NULL = all sites. Non-null = role applies only to this site.
    priority INTEGER NOT NULL DEFAULT 0,
        -- Higher priority mappings take precedence when multiple rules match
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (provider_id, match_type, match_value, role_id, site_id)
);

-- TLS certificate tracking (metadata stored in DB; actual cert files on disk)
CREATE TABLE certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    cert_type VARCHAR(20) NOT NULL CHECK (cert_type IN ('server', 'client', 'ca_trust')),
        -- server: web TLS cert (nginx), client: OPC UA client cert, ca_trust: trusted CA
    subject_cn VARCHAR(500),
    issuer_cn VARCHAR(500),
    serial_number VARCHAR(200),
    not_before TIMESTAMPTZ,
    not_after TIMESTAMPTZ,
    fingerprint_sha256 VARCHAR(64),
    is_active BOOLEAN NOT NULL DEFAULT false,
        -- Only one server cert active at a time; enforced by application layer
    auto_renew BOOLEAN NOT NULL DEFAULT false,
        -- True for ACME-managed certificates
    acme_account_id VARCHAR(200),
        -- ACME account identifier (for Let's Encrypt or other ACME CAs)
    cert_path VARCHAR(500),
        -- Filesystem path to certificate PEM (e.g., /etc/io/certs/fullchain.pem)
    key_path VARCHAR(500),
        -- Filesystem path to private key PEM (e.g., /etc/io/certs/privkey.pem)
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**Site scoping notes:** The `sites` table enables multi-site deployments where data, views, and access are scoped per site. Site association uses different patterns depending on entity ownership:

- **Many-to-many (junction tables)**: `user_sites` (users can access multiple sites), `role_sites` (future: roles scoped to sites via `idp_role_mappings.site_id`)
- **Direct FK (`site_id UUID REFERENCES sites(id)`)**: `point_sources`, `design_objects`, `dashboards`, `report_templates`, `log_instances`, `round_instances`, `alerts`. These are owned entities where each record belongs to exactly one site.
- **NULL means "all sites"**: When `site_id` is NULL on an owned entity, it is visible to all sites (global). This is the default for backward compatibility with single-site deployments.
- **Site FK columns are NOT added inline above** to avoid breaking the existing DDL. They will be added via ALTER TABLE during the migration that introduces multi-site support.

### Audit & System Tables

```sql
-- EULA versions (draft → active → archived lifecycle)
CREATE TABLE eula_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version VARCHAR(20) NOT NULL UNIQUE,       -- e.g., '1.0', '1.1', '2.0'
    title VARCHAR(255) NOT NULL DEFAULT 'End User License Agreement',
    content TEXT NOT NULL,                      -- full EULA text in markdown
    content_hash VARCHAR(64) NOT NULL,          -- SHA-256 of content (proves content wasn't altered after acceptance)
    is_active BOOLEAN NOT NULL DEFAULT false,   -- only one active at a time
    published_at TIMESTAMPTZ,                   -- null = draft, non-null = published
    archived_at TIMESTAMPTZ,                    -- when this version was superseded
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by UUID REFERENCES users(id),
    published_by UUID REFERENCES users(id)
);

-- Enforce exactly one active EULA version
CREATE UNIQUE INDEX idx_eula_versions_active ON eula_versions (is_active) WHERE is_active = true;

-- EULA acceptance records (append-only, immutable — legal audit trail)
CREATE TABLE eula_acceptances (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id),
    eula_version_id UUID NOT NULL REFERENCES eula_versions(id),
    accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    accepted_from_ip INET NOT NULL,
    accepted_as_role TEXT NOT NULL,             -- user's role(s) at time of acceptance, comma-separated
    username_snapshot VARCHAR(50) NOT NULL,     -- username at time of acceptance (immutable record)
    user_agent TEXT NOT NULL,                   -- full browser User-Agent string
    content_hash VARCHAR(64) NOT NULL           -- SHA-256 of EULA content at acceptance time (proof of what was shown)
);

-- No unique constraint on (user_id, eula_version_id): every acceptance is a separate record.
-- No update or delete allowed — enforced by triggers (see Triggers section).

-- Audit log (immutable)
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    table_name VARCHAR(100),
    record_id UUID,
    changes JSONB, -- before/after state
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- System logs
CREATE TABLE system_logs (
    id BIGSERIAL PRIMARY KEY,
    level VARCHAR(20) NOT NULL, -- error, warn, info, debug
    service VARCHAR(50) NOT NULL, -- api-gateway, broker, opc-service, etc.
    message TEXT NOT NULL,
    metadata JSONB,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);
```

## Indexes

### Performance Indexes

```sql
-- Users
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_enabled ON users(enabled);

-- Sessions
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_expires_at ON user_sessions(expires_at);

-- EULA acceptances (login-time check + admin audit queries)
CREATE INDEX idx_eula_acceptances_user_version ON eula_acceptances (user_id, eula_version_id);
CREATE INDEX idx_eula_acceptances_version_date ON eula_acceptances (eula_version_id, accepted_at);

-- Design objects
CREATE INDEX idx_design_objects_type ON design_objects(type);
CREATE INDEX idx_design_objects_parent_id ON design_objects(parent_id);
CREATE INDEX idx_design_objects_created_by ON design_objects(created_by);

-- Workspaces
CREATE INDEX idx_workspaces_user_id ON workspaces(user_id);
CREATE INDEX idx_workspaces_published ON workspaces(published);

-- Workspace shares
CREATE INDEX idx_workspace_shares_grantee ON workspace_shares(grantee_id);

-- Dashboard shares
CREATE INDEX idx_dashboard_shares_grantee ON dashboard_shares(grantee_id);

-- Window Groups (index defined inline with table; listed here for completeness)
-- CREATE INDEX idx_window_groups_owner ON window_groups(owner_id);

-- Point sources
CREATE INDEX idx_point_sources_source_type ON point_sources(source_type);
CREATE INDEX idx_point_sources_status ON point_sources(status);
CREATE INDEX idx_point_sources_enabled ON point_sources(enabled) WHERE enabled = true;

-- Points metadata
CREATE INDEX idx_points_metadata_tagname ON points_metadata(tagname);
CREATE INDEX idx_points_metadata_source_id ON points_metadata(source_id);
CREATE INDEX idx_points_metadata_active ON points_metadata(active) WHERE active = true;
CREATE INDEX idx_points_metadata_criticality ON points_metadata(criticality) WHERE criticality IS NOT NULL;
CREATE INDEX idx_points_metadata_area ON points_metadata(area) WHERE area IS NOT NULL;
CREATE INDEX idx_points_metadata_barcode ON points_metadata(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX idx_points_metadata_last_seen_at ON points_metadata(last_seen_at);
CREATE INDEX idx_points_metadata_default_graphic_id ON points_metadata(default_graphic_id) WHERE default_graphic_id IS NOT NULL;

-- Points metadata versions
CREATE INDEX idx_pmv_point_effective ON points_metadata_versions(point_id, effective_from);
CREATE INDEX idx_pmv_point_version_desc ON points_metadata_versions(point_id, version DESC);

-- Points metadata custom expression FK
CREATE INDEX idx_points_metadata_custom_expression_id
    ON points_metadata(custom_expression_id) WHERE custom_expression_id IS NOT NULL;

-- Custom expressions
CREATE INDEX idx_custom_expressions_created_by ON custom_expressions(created_by);
CREATE INDEX idx_custom_expressions_context ON custom_expressions(expression_context);
CREATE INDEX idx_custom_expressions_shared ON custom_expressions(shared) WHERE shared = true;
CREATE INDEX idx_custom_expressions_point_refs ON custom_expressions USING GIN (referenced_point_ids);

-- Points current and history
CREATE INDEX idx_points_current_timestamp ON points_current(timestamp);
CREATE INDEX idx_points_history_point_timestamp ON points_history_raw(point_id, timestamp DESC);

-- Events (hypertable — indexes on hypertables are per-chunk)
CREATE INDEX idx_events_timestamp ON events(timestamp DESC);
CREATE INDEX idx_events_event_type ON events(event_type, timestamp DESC);
CREATE INDEX idx_events_point_id ON events(point_id, timestamp DESC) WHERE point_id IS NOT NULL;
CREATE INDEX idx_events_severity ON events(severity, timestamp DESC);
CREATE INDEX idx_events_source ON events(source, timestamp DESC);
CREATE INDEX idx_events_priority ON events(priority, timestamp DESC) WHERE priority IS NOT NULL;

-- Alarm states
CREATE INDEX idx_alarm_states_event ON alarm_states(event_id);
CREATE INDEX idx_alarm_states_state ON alarm_states(state, transitioned_at DESC);
CREATE INDEX idx_alarm_states_event_timestamp ON alarm_states(event_timestamp DESC);

-- Alarm definitions
CREATE INDEX idx_alarm_definitions_point ON alarm_definitions(point_id) WHERE point_id IS NOT NULL;
CREATE INDEX idx_alarm_definitions_type ON alarm_definitions(definition_type);
CREATE INDEX idx_alarm_definitions_enabled ON alarm_definitions(enabled) WHERE enabled = true;
CREATE INDEX idx_alarm_definitions_active ON alarm_definitions(id) WHERE enabled = true AND deleted_at IS NULL;

-- Alarm shelving
CREATE INDEX idx_alarm_shelving_definition ON alarm_shelving(alarm_definition_id);
CREATE INDEX idx_alarm_shelving_active ON alarm_shelving(shelf_expires_at)
    WHERE unshelved_at IS NULL;

-- Round templates
CREATE INDEX idx_round_templates_active ON round_templates(is_active) WHERE is_active = true AND deleted_at IS NULL;

-- Round schedules
CREATE INDEX idx_round_schedules_template ON round_schedules(template_id);
CREATE INDEX idx_round_schedules_active ON round_schedules(is_active) WHERE is_active = true;

-- Round instances
CREATE INDEX idx_round_instances_template ON round_instances(template_id);
CREATE INDEX idx_round_instances_status ON round_instances(status, due_by);
CREATE INDEX idx_round_instances_shift ON round_instances(assigned_to_shift) WHERE assigned_to_shift IS NOT NULL;
CREATE INDEX idx_round_instances_user ON round_instances(locked_to_user) WHERE locked_to_user IS NOT NULL;
CREATE INDEX idx_round_instances_due ON round_instances(due_by) WHERE status IN ('pending', 'in_progress');

-- Round responses
CREATE INDEX idx_round_responses_instance ON round_responses(instance_id);
CREATE INDEX idx_round_responses_alarm ON round_responses(instance_id) WHERE alarm_triggered = true;

-- Round media
CREATE INDEX idx_round_media_response ON round_media(response_id);
CREATE INDEX idx_round_media_extracted_text ON round_media USING GIN (to_tsvector('english', extracted_text)) WHERE extracted_text IS NOT NULL;

-- Log templates
CREATE INDEX idx_log_templates_active ON log_templates(is_active) WHERE is_active = true AND deleted_at IS NULL;

-- Log segments
CREATE INDEX idx_log_segments_type ON log_segments(segment_type);
CREATE INDEX idx_log_segments_reusable ON log_segments(is_reusable) WHERE is_reusable = true;

-- Log schedules
CREATE INDEX idx_log_schedules_template ON log_schedules(template_id);

-- Log instances
CREATE INDEX idx_log_instances_template ON log_instances(template_id);
CREATE INDEX idx_log_instances_status ON log_instances(status);
CREATE INDEX idx_log_instances_shift ON log_instances(shift_id) WHERE shift_id IS NOT NULL;
CREATE INDEX idx_log_instances_team ON log_instances(team_name) WHERE team_name IS NOT NULL;

-- Log entries (FTS index defined inline with table; listed here for completeness)
-- CREATE INDEX idx_log_entries_fts ON log_entries USING GIN (content_tsvector);
CREATE INDEX idx_log_entries_instance ON log_entries(instance_id);
CREATE INDEX idx_log_entries_created_by ON log_entries(created_by);
CREATE INDEX idx_log_entries_created_at ON log_entries(created_at DESC);

-- Log media
CREATE INDEX idx_log_media_entry ON log_media(entry_id);
CREATE INDEX idx_log_media_extracted_text ON log_media USING GIN (to_tsvector('english', extracted_text)) WHERE extracted_text IS NOT NULL;

-- Audit log
CREATE INDEX idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX idx_audit_log_table_name ON audit_log(table_name);

-- System logs
CREATE INDEX idx_system_logs_timestamp ON system_logs(timestamp DESC);
CREATE INDEX idx_system_logs_level ON system_logs(level);
CREATE INDEX idx_system_logs_service ON system_logs(service);

-- Auth provider configs
CREATE INDEX idx_auth_provider_configs_type ON auth_provider_configs(provider_type);
CREATE INDEX idx_auth_provider_configs_enabled ON auth_provider_configs(enabled) WHERE enabled = true;

-- User MFA
CREATE INDEX idx_user_mfa_user_id ON user_mfa(user_id);
CREATE INDEX idx_user_mfa_active ON user_mfa(user_id, mfa_type) WHERE status = 'active';

-- MFA policies (role_id has UNIQUE constraint; additional index not needed)

-- API keys
CREATE INDEX idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX idx_api_keys_prefix ON api_keys(key_prefix);
CREATE INDEX idx_api_keys_expires ON api_keys(expires_at) WHERE expires_at IS NOT NULL;

-- Auth flow state (state_token has UNIQUE constraint; expiry index defined inline)

-- SCIM tokens
CREATE INDEX idx_scim_tokens_enabled ON scim_tokens(enabled) WHERE enabled = true;

-- Users (auth provider columns)
CREATE INDEX idx_users_auth_provider ON users(auth_provider);
CREATE INDEX idx_users_service_account ON users(is_service_account) WHERE is_service_account = true;
CREATE INDEX idx_users_external_id ON users(external_id) WHERE external_id IS NOT NULL;
CREATE INDEX idx_users_emergency ON users(is_emergency_account) WHERE is_emergency_account = true;

-- Sites
CREATE INDEX idx_sites_active ON sites(is_active);

-- User sites
CREATE INDEX idx_user_sites_site ON user_sites(site_id);

-- Data categories
CREATE INDEX idx_data_categories_predefined ON data_categories(is_predefined);

-- Point sources (data category)
CREATE INDEX idx_point_sources_category ON point_sources(data_category_id) WHERE data_category_id IS NOT NULL;

-- IdP role mappings
CREATE INDEX idx_idp_role_mappings_provider ON idp_role_mappings(provider_id);
CREATE INDEX idx_idp_role_mappings_active ON idp_role_mappings(provider_id, is_active);

-- Certificates
CREATE INDEX idx_certificates_type ON certificates(cert_type);
CREATE INDEX idx_certificates_expiry ON certificates(not_after) WHERE is_active = true;
```

## Database Functions & Triggers

### Automatic Timestamp Updates

```sql
-- Function to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at column
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_point_sources_updated_at
    BEFORE UPDATE ON point_sources
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_points_metadata_updated_at
    BEFORE UPDATE ON points_metadata
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_custom_expressions_updated_at
    BEFORE UPDATE ON custom_expressions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_window_groups_updated_at
    BEFORE UPDATE ON window_groups
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_auth_provider_configs_updated_at
    BEFORE UPDATE ON auth_provider_configs
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_mfa_policies_updated_at
    BEFORE UPDATE ON mfa_policies
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_groups_updated_at
    BEFORE UPDATE ON groups
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_sites_updated_at
    BEFORE UPDATE ON sites
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_data_categories_updated_at
    BEFORE UPDATE ON data_categories
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_idp_role_mappings_updated_at
    BEFORE UPDATE ON idp_role_mappings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_certificates_updated_at
    BEFORE UPDATE ON certificates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_design_objects_updated_at
    BEFORE UPDATE ON design_objects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_workspaces_updated_at
    BEFORE UPDATE ON workspaces
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_dashboards_updated_at
    BEFORE UPDATE ON dashboards
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_report_templates_updated_at
    BEFORE UPDATE ON report_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_settings_updated_at
    BEFORE UPDATE ON settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_import_connections_updated_at
    BEFORE UPDATE ON import_connections
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_import_definitions_updated_at
    BEFORE UPDATE ON import_definitions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_import_schedules_updated_at
    BEFORE UPDATE ON import_schedules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_alert_templates_updated_at
    BEFORE UPDATE ON alert_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_alert_rosters_updated_at
    BEFORE UPDATE ON alert_rosters
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_email_providers_updated_at
    BEFORE UPDATE ON email_providers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_email_templates_updated_at
    BEFORE UPDATE ON email_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Operational tables (events/alarms, rounds, logs)
CREATE TRIGGER trg_alarm_definitions_updated_at
    BEFORE UPDATE ON alarm_definitions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_round_templates_updated_at
    BEFORE UPDATE ON round_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_round_schedules_updated_at
    BEFORE UPDATE ON round_schedules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_round_instances_updated_at
    BEFORE UPDATE ON round_instances
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_log_templates_updated_at
    BEFORE UPDATE ON log_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_log_segments_updated_at
    BEFORE UPDATE ON log_segments
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_log_schedules_updated_at
    BEFORE UPDATE ON log_schedules
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_log_instances_updated_at
    BEFORE UPDATE ON log_instances
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_log_entries_updated_at
    BEFORE UPDATE ON log_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

### Point Data Model Functions & Triggers

```sql
-- Prevent point deletion (never-delete policy, database-enforced)
CREATE OR REPLACE FUNCTION prevent_point_deletion()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Points cannot be deleted. Set active = false instead. point_id=%, tagname=%',
        OLD.id, OLD.tagname;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_point_deletion
    BEFORE DELETE ON points_metadata
    FOR EACH ROW
    EXECUTE FUNCTION prevent_point_deletion();

-- Sync current metadata from latest version (trigger-synced denormalization)
CREATE OR REPLACE FUNCTION sync_point_metadata_from_version()
RETURNS TRIGGER AS $$
DECLARE
    max_version INTEGER;
BEGIN
    SELECT MAX(version) INTO max_version
    FROM points_metadata_versions
    WHERE point_id = NEW.point_id;

    IF NEW.version = max_version THEN
        UPDATE points_metadata
        SET description       = NEW.description,
            engineering_units = NEW.engineering_units,
            data_type         = NEW.data_type,
            min_value         = NEW.min_value,
            max_value         = NEW.max_value
        WHERE id = NEW.point_id;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_point_metadata_from_version
    AFTER INSERT ON points_metadata_versions
    FOR EACH ROW
    EXECUTE FUNCTION sync_point_metadata_from_version();

-- Track activation/deactivation timestamps
CREATE OR REPLACE FUNCTION handle_point_activation_change()
RETURNS TRIGGER AS $$
BEGIN
    IF OLD.active = true AND NEW.active = false THEN
        NEW.deactivated_at = NOW();
    ELSIF OLD.active = false AND NEW.active = true THEN
        NEW.reactivated_at = NOW();
        NEW.deactivated_at = NULL;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_handle_activation_change
    BEFORE UPDATE ON points_metadata
    FOR EACH ROW
    WHEN (OLD.active IS DISTINCT FROM NEW.active)
    EXECUTE FUNCTION handle_point_activation_change();

-- Idempotent point discovery and metadata versioning
-- Called by connector services (OPC Service, etc.) during browse/refresh.
-- Creates new points, detects metadata changes, creates new versions.
-- See point-model-merged.md for full function body.
CREATE OR REPLACE FUNCTION upsert_point_from_source(
    p_source_id UUID,
    p_tagname VARCHAR(255),
    p_description TEXT DEFAULT NULL,
    p_engineering_units VARCHAR(50) DEFAULT NULL,
    p_data_type VARCHAR(50) DEFAULT 'Double',
    p_min_value DOUBLE PRECISION DEFAULT NULL,
    p_max_value DOUBLE PRECISION DEFAULT NULL,
    p_source_raw JSONB DEFAULT NULL
) RETURNS UUID AS $$ ... $$ LANGUAGE plpgsql;

-- Batch backfill with deduplication
-- Called during gap recovery after reconnection or reactivation.
CREATE OR REPLACE FUNCTION backfill_upsert_history(
    p_point_ids UUID[],
    p_values DOUBLE PRECISION[],
    p_qualities VARCHAR(20)[],
    p_timestamps TIMESTAMPTZ[]
) RETURNS INTEGER AS $$ ... $$ LANGUAGE plpgsql;

-- Forensic: get metadata effective at a specific time
CREATE OR REPLACE FUNCTION get_effective_point_metadata(
    p_point_id UUID,
    p_at_time TIMESTAMPTZ
) RETURNS TABLE (...) AS $$ ... $$ LANGUAGE plpgsql STABLE;

-- Helper: get next version number for a point
CREATE OR REPLACE FUNCTION get_next_point_metadata_version(p_point_id UUID)
RETURNS INTEGER AS $$ ... $$ LANGUAGE plpgsql;
```

**Note:** Full function bodies for `upsert_point_from_source`, `backfill_upsert_history`, `get_effective_point_metadata`, and `get_next_point_metadata_version` are defined in the point data model schema specification.

### EULA Integrity Triggers

```sql
-- Prevent deleting published EULA versions (legal audit permanence)
CREATE OR REPLACE FUNCTION prevent_eula_version_delete() RETURNS TRIGGER AS $$
BEGIN
    IF OLD.published_at IS NOT NULL THEN
        RAISE EXCEPTION 'Cannot delete a published EULA version (id: %). Published versions are permanent for legal audit purposes.', OLD.id;
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_eula_version_delete
    BEFORE DELETE ON eula_versions
    FOR EACH ROW EXECUTE FUNCTION prevent_eula_version_delete();

-- Prevent modifying content of published EULA versions
CREATE OR REPLACE FUNCTION prevent_eula_version_content_edit() RETURNS TRIGGER AS $$
BEGIN
    IF OLD.published_at IS NOT NULL AND (NEW.content != OLD.content OR NEW.title != OLD.title) THEN
        RAISE EXCEPTION 'Cannot modify the content or title of a published EULA version (id: %). Create a new version instead.', OLD.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_eula_version_content_edit
    BEFORE UPDATE ON eula_versions
    FOR EACH ROW EXECUTE FUNCTION prevent_eula_version_content_edit();

-- EULA acceptances are append-only (no updates, no deletes — ever)
CREATE OR REPLACE FUNCTION prevent_eula_acceptance_modify() RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'EULA acceptance records are append-only and cannot be modified or deleted.';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_eula_acceptance_update
    BEFORE UPDATE ON eula_acceptances
    FOR EACH ROW EXECUTE FUNCTION prevent_eula_acceptance_modify();

CREATE TRIGGER trg_prevent_eula_acceptance_delete
    BEFORE DELETE ON eula_acceptances
    FOR EACH ROW EXECUTE FUNCTION prevent_eula_acceptance_modify();
```

### Audit Logging Trigger

```sql
-- Function to log changes
CREATE OR REPLACE FUNCTION log_audit_trail()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        INSERT INTO audit_log (user_id, action, table_name, record_id, changes)
        VALUES (
            current_setting('app.current_user_id', true)::UUID,
            'DELETE',
            TG_TABLE_NAME,
            OLD.id,
            jsonb_build_object('old', row_to_json(OLD))
        );
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_log (user_id, action, table_name, record_id, changes)
        VALUES (
            current_setting('app.current_user_id', true)::UUID,
            'UPDATE',
            TG_TABLE_NAME,
            NEW.id,
            jsonb_build_object('old', row_to_json(OLD), 'new', row_to_json(NEW))
        );
        RETURN NEW;
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO audit_log (user_id, action, table_name, record_id, changes)
        VALUES (
            current_setting('app.current_user_id', true)::UUID,
            'INSERT',
            TG_TABLE_NAME,
            NEW.id,
            jsonb_build_object('new', row_to_json(NEW))
        );
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Apply to sensitive tables (cold-path only)
CREATE TRIGGER audit_users
    AFTER INSERT OR UPDATE OR DELETE ON users
    FOR EACH ROW
    EXECUTE FUNCTION log_audit_trail();

CREATE TRIGGER trg_audit_point_sources
    AFTER INSERT OR UPDATE OR DELETE ON point_sources
    FOR EACH ROW
    EXECUTE FUNCTION log_audit_trail();

CREATE TRIGGER trg_audit_points_metadata
    AFTER INSERT OR DELETE ON points_metadata
    FOR EACH ROW EXECUTE FUNCTION log_audit_trail();

CREATE TRIGGER trg_audit_points_metadata_update
    AFTER UPDATE ON points_metadata
    FOR EACH ROW
    WHEN (OLD.tagname IS DISTINCT FROM NEW.tagname
       OR OLD.description IS DISTINCT FROM NEW.description
       OR OLD.engineering_units IS DISTINCT FROM NEW.engineering_units
       OR OLD.data_type IS DISTINCT FROM NEW.data_type
       OR OLD.source_id IS DISTINCT FROM NEW.source_id
       OR OLD.enabled IS DISTINCT FROM NEW.enabled
       OR OLD.aggregation_types IS DISTINCT FROM NEW.aggregation_types)
    EXECUTE FUNCTION log_audit_trail();

CREATE TRIGGER trg_audit_custom_expressions
    AFTER INSERT OR UPDATE OR DELETE ON custom_expressions
    FOR EACH ROW
    EXECUTE FUNCTION log_audit_trail();

CREATE TRIGGER trg_audit_auth_provider_configs
    AFTER INSERT OR UPDATE OR DELETE ON auth_provider_configs
    FOR EACH ROW
    EXECUTE FUNCTION log_audit_trail();

CREATE TRIGGER trg_audit_user_mfa
    AFTER INSERT OR UPDATE OR DELETE ON user_mfa
    FOR EACH ROW
    EXECUTE FUNCTION log_audit_trail();

CREATE TRIGGER trg_audit_mfa_policies
    AFTER INSERT OR UPDATE OR DELETE ON mfa_policies
    FOR EACH ROW
    EXECUTE FUNCTION log_audit_trail();

CREATE TRIGGER trg_audit_api_keys
    AFTER INSERT OR UPDATE OR DELETE ON api_keys
    FOR EACH ROW
    EXECUTE FUNCTION log_audit_trail();

CREATE TRIGGER trg_audit_scim_tokens
    AFTER INSERT OR UPDATE OR DELETE ON scim_tokens
    FOR EACH ROW
    EXECUTE FUNCTION log_audit_trail();

CREATE TRIGGER trg_audit_idp_role_mappings
    AFTER INSERT OR UPDATE OR DELETE ON idp_role_mappings
    FOR EACH ROW
    EXECUTE FUNCTION log_audit_trail();

CREATE TRIGGER trg_audit_sites
    AFTER INSERT OR UPDATE OR DELETE ON sites
    FOR EACH ROW
    EXECUTE FUNCTION log_audit_trail();

CREATE TRIGGER trg_audit_certificates
    AFTER INSERT OR UPDATE OR DELETE ON certificates
    FOR EACH ROW
    EXECUTE FUNCTION log_audit_trail();

CREATE TRIGGER trg_audit_group_roles
    AFTER INSERT OR UPDATE OR DELETE ON group_roles
    FOR EACH ROW
    EXECUTE FUNCTION log_audit_trail();

CREATE TRIGGER trg_audit_roles
    AFTER INSERT OR UPDATE OR DELETE ON roles
    FOR EACH ROW
    EXECUTE FUNCTION log_audit_trail();

CREATE TRIGGER trg_audit_role_permissions
    AFTER INSERT OR UPDATE OR DELETE ON role_permissions
    FOR EACH ROW
    EXECUTE FUNCTION log_audit_trail();

CREATE TRIGGER trg_audit_user_roles
    AFTER INSERT OR UPDATE OR DELETE ON user_roles
    FOR EACH ROW
    EXECUTE FUNCTION log_audit_trail();

CREATE TRIGGER trg_audit_user_groups
    AFTER INSERT OR UPDATE OR DELETE ON user_groups
    FOR EACH ROW
    EXECUTE FUNCTION log_audit_trail();

CREATE TRIGGER trg_audit_alert_templates
    AFTER INSERT OR UPDATE OR DELETE ON alert_templates
    FOR EACH ROW
    EXECUTE FUNCTION log_audit_trail();

CREATE TRIGGER trg_audit_alert_rosters
    AFTER INSERT OR UPDATE OR DELETE ON alert_rosters
    FOR EACH ROW
    EXECUTE FUNCTION log_audit_trail();

CREATE TRIGGER trg_audit_alert_channels
    AFTER INSERT OR UPDATE OR DELETE ON alert_channels
    FOR EACH ROW
    EXECUTE FUNCTION log_audit_trail();

CREATE TRIGGER trg_audit_email_providers
    AFTER INSERT OR UPDATE OR DELETE ON email_providers
    FOR EACH ROW
    EXECUTE FUNCTION log_audit_trail();

CREATE TRIGGER trg_audit_settings
    AFTER INSERT OR UPDATE OR DELETE ON settings
    FOR EACH ROW
    EXECUTE FUNCTION log_audit_trail();

CREATE TRIGGER trg_audit_import_connections
    AFTER INSERT OR UPDATE OR DELETE ON import_connections
    FOR EACH ROW
    EXECUTE FUNCTION log_audit_trail();

CREATE TRIGGER trg_audit_import_definitions
    AFTER INSERT OR UPDATE OR DELETE ON import_definitions
    FOR EACH ROW
    EXECUTE FUNCTION log_audit_trail();

-- Operational tables — alarm definitions and shelving are admin-configurable
-- and security-relevant (ISA-18.2 requires shelving to be audited).
CREATE TRIGGER trg_audit_alarm_definitions
    AFTER INSERT OR UPDATE OR DELETE ON alarm_definitions
    FOR EACH ROW
    EXECUTE FUNCTION log_audit_trail();

CREATE TRIGGER trg_audit_alarm_shelving
    AFTER INSERT OR UPDATE OR DELETE ON alarm_shelving
    FOR EACH ROW
    EXECUTE FUNCTION log_audit_trail();

-- Round and log templates are admin-configurable operational definitions.
CREATE TRIGGER trg_audit_round_templates
    AFTER INSERT OR UPDATE OR DELETE ON round_templates
    FOR EACH ROW
    EXECUTE FUNCTION log_audit_trail();

CREATE TRIGGER trg_audit_round_schedules
    AFTER INSERT OR UPDATE OR DELETE ON round_schedules
    FOR EACH ROW
    EXECUTE FUNCTION log_audit_trail();

CREATE TRIGGER trg_audit_log_templates
    AFTER INSERT OR UPDATE OR DELETE ON log_templates
    FOR EACH ROW
    EXECUTE FUNCTION log_audit_trail();

CREATE TRIGGER trg_audit_log_schedules
    AFTER INSERT OR UPDATE OR DELETE ON log_schedules
    FOR EACH ROW
    EXECUTE FUNCTION log_audit_trail();

CREATE TRIGGER trg_audit_log_segments
    AFTER INSERT OR UPDATE OR DELETE ON log_segments
    FOR EACH ROW
    EXECUTE FUNCTION log_audit_trail();

-- CRITICAL: Do NOT add audit triggers to events, alarm_states, round_instances,
-- round_responses, log_instances, log_entries, or media tables.
-- Events and alarm_states are high-volume write paths (mirroring OPC UA A&C stream).
-- Round/log instances and responses are operator working data — audited via
-- created_by/updated_at columns, not per-row audit triggers.

-- CRITICAL: Do NOT add audit triggers to points_current or points_history_raw.
-- These are the hot-path tables (50K writes/second). Audit triggers on them
-- would be catastrophic for performance.
```

## Data Retention Policies

### TimescaleDB Retention

```sql
-- Compress old data (save storage)
SELECT add_compression_policy('points_history_raw', INTERVAL '7 days');

-- Delete old raw data (keep aggregates)
SELECT add_retention_policy('points_history_raw', INTERVAL '90 days');

-- Aggregate retention (see 18_TIMESERIES_DATA for full details):
-- 1-minute aggregates: 1 year
-- 5-minute aggregates: 2 years
-- 15-minute aggregates: 3 years
-- 1-hour aggregates: 5 years
-- 1-day aggregates: 7 years (regulatory compliance)
```

### Manual Cleanup

```sql
-- Clean up expired sessions
DELETE FROM user_sessions WHERE expires_at < NOW();

-- Events hypertable retention (compress after 30 days, retain per regulatory requirements)
-- Event data is critical for Forensics module — retention aligned with points_history.
-- SELECT add_compression_policy('events', INTERVAL '30 days');
-- SELECT add_retention_policy('events', INTERVAL '7 years');  -- regulatory compliance
```

## Seed Data

Seed data is delivered in two tiers and applied via the `api-gateway seed` CLI command. Both tiers are idempotent (safe to re-run). Seed data is embedded in the binary via `include_str!()` (SQL) and `include_bytes!()` (SVG, markdown) — no external files needed at runtime.

**Tier 1 — Bootstrap** (required, runs on first install): Creates the minimum data needed for the application to start and accept its first login. Must complete before any service is started.

**Tier 2 — Content** (optional, runs after bootstrap): Loads canned templates, dashboards, reports, connector templates, symbol library, and help content. These provide out-of-box value but are not required for the application to function.

**CLI usage:**
- `api-gateway seed` — runs both tiers (default for fresh install)
- `api-gateway seed --tier1` — bootstrap only
- `api-gateway seed --tier2` — content only

**Version tracking:** The `settings` table stores `seed_version_tier1` and `seed_version_tier2`. On upgrade, if the bundled seed version is newer than the stored version, the upgrade procedure re-runs that tier to add new content.

**Upgrade behavior:**
- Tier 1: Additive only (new permissions, new settings keys). Never modifies existing values.
- Tier 2: Adds new canned content. System templates (`is_system_template = true` or `is_system = true`) are updated if the bundled version is newer. User-customized copies (duplicated from system templates) are never touched.

### Tier 1 — Bootstrap Seed Data

#### Default Admin User

```sql
-- Insert default admin user (password: changeme)
INSERT INTO users (id, username, password_hash, email, full_name, enabled)
VALUES (
    gen_random_uuid(),
    'admin',
    '$argon2id$...',  -- Hash of 'changeme'
    'admin@example.com',
    'System Administrator',
    true
);
```

### Default Roles

```sql
-- Insert predefined roles (8 roles; see research-roles-groups-breakglass.md for full rationale)
INSERT INTO roles (name, description, is_predefined, idle_timeout_minutes, max_concurrent_sessions) VALUES
    ('Viewer', 'Read-only access to high-level data (finance, executives, visitors)', true, 30, 3),
    ('Operator', 'Console operation, alarm acknowledgment, rounds, logs', true, 60, 3),
    ('Shift Supervisor', 'Operator permissions + alarm management, shelving, round oversight', true, 60, 3),
    ('Engineer', 'Dashboard/report creation, forensics, expression builder', true, 30, 5),
    ('Maintenance Technician', 'Rounds, equipment data, maintenance-focused access', true, 30, 3),
    ('Safety Officer', 'Safety event access, environmental data, audit reports', true, 30, 3),
    ('Data Steward', 'Import/export management, point configuration, data quality', true, 30, 3),
    ('Admin', 'Full system access including user management and system configuration', true, 15, 5);
```

### Default Data Categories

```sql
-- Seed 9 predefined data categories for classifying data sources and imports
INSERT INTO data_categories (name, description, is_predefined) VALUES
    ('Process', 'Real-time process data from control systems', true),
    ('Event', 'System and process events and alarms', true),
    ('Access Control', 'Physical access and security data', true),
    ('Personnel', 'Staff and personnel information', true),
    ('Financial', 'Cost and financial operational data', true),
    ('Maintenance', 'Equipment maintenance and work orders', true),
    ('Ticketing', 'Work tickets and task management', true),
    ('Environmental', 'Environmental monitoring data', true),
    ('General', 'Uncategorized or general-purpose data', true);
```

### Default Permissions

```sql
-- Insert all permissions defined in 03_SECURITY_RBAC.md
-- (See doc 03 for the authoritative, complete list)
INSERT INTO permissions (name, description, module) VALUES
    ('console:read', 'View console workspaces', 'console'),
    ('console:write', 'Create/edit personal workspaces', 'console'),
    -- ... includes designer:import ('Import files and run symbol recognition', 'designer')
    -- ... (all permissions per doc 03)
```

### Role-Permission Assignments

```sql
-- Assign 118 permissions to 8 predefined roles
-- Viewer: read-only across all modules
-- Operator: Viewer + write log entries, execute rounds, acknowledge alerts
-- Analyst: Operator + create reports/dashboards, forensics write, export
-- Supervisor: Analyst + publish, manage templates, manage groups, shifts write
-- Content Manager: Analyst + designer publish, template management
-- Maintenance: Operator + rounds create, equipment data
-- Contractor: read-only, scoped by site/data category
-- Admin: All permissions
```

### Point Data Seed Data

```sql
-- Default "Manual Entry" source for manually-entered data points
INSERT INTO point_sources (id, name, source_type, status, description, enabled)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Manual Entry',
    'manual',
    'active',
    'Built-in source for manually entered data points.',
    true
);

-- Backfill and point management settings
INSERT INTO settings (key, value, description) VALUES
    ('point_source_stale_threshold_hours', '"24"',
     'Hours without being seen before a point is considered stale'),
    ('point_metadata_refresh_interval_minutes', '"60"',
     'How often connector services re-browse source metadata'),
    ('point_backfill_enabled', '"true"',
     'Whether to auto-trigger backfill on point reactivation'),
    ('point_backfill_max_lookback_days', '"30"',
     'Maximum number of days to look back during backfill')
ON CONFLICT (key) DO NOTHING;

-- Events/Alarms settings
INSERT INTO settings (key, value, description) VALUES
    ('alarm_eval_interval_seconds', '"10"',
     'How often the I/O alarm evaluation engine checks threshold and expression alarms'),
    ('alarm_shelve_max_duration_hours', '"24"',
     'Maximum duration an alarm can be shelved (ISA-18.2 compliance)'),
    ('alarm_shelve_default_duration_minutes', '"60"',
     'Default shelve duration when operator does not specify'),
    ('event_retention_days', '"2555"',
     'Days to retain events before archival (7 years default for regulatory compliance)'),
    ('alarm_chattering_threshold', '"5"',
     'Number of state transitions in 60 seconds before an alarm is flagged as chattering')
ON CONFLICT (key) DO NOTHING;

-- Rounds settings
INSERT INTO settings (key, value, description) VALUES
    ('rounds_gps_proximity_meters', '"50"',
     'Maximum distance from checkpoint GPS coordinate for location verification'),
    ('rounds_transfer_timeout_seconds', '"60"',
     'Seconds to wait for acknowledgment before auto-transferring a round to a new user'),
    ('rounds_photo_max_size_mb', '"10"',
     'Maximum upload size for round checkpoint photos'),
    ('rounds_video_max_duration_seconds', '"120"',
     'Maximum recording duration for round checkpoint videos')
ON CONFLICT (key) DO NOTHING;

-- Log settings
INSERT INTO settings (key, value, description) VALUES
    ('log_auto_create_on_shift_start', '"true"',
     'Automatically create log instances from templates when a shift begins')
ON CONFLICT (key) DO NOTHING;

-- Forensics settings
INSERT INTO settings (key, value, description) VALUES
    ('forensics_max_correlation_points', '"50"',
     'Maximum number of points in a single correlation analysis'),
    ('forensics_max_time_window_days', '"30"',
     'Maximum time window for forensic analysis queries'),
    ('forensics_result_cache_ttl_seconds', '"60"',
     'Time-to-live for cached correlation results')
ON CONFLICT (key) DO NOTHING;

-- Tile rendering settings
INSERT INTO settings (key, value, description) VALUES
    ('tile_auto_regenerate_on_save', '"true"',
     'Automatically regenerate tile pyramids when a graphic is saved in the Designer'),
    ('tile_max_zoom_level', '"5"',
     'Maximum zoom level for tile pyramid generation (0 = overview, 5 = full detail)')
ON CONFLICT (key) DO NOTHING;

-- OPC settings
INSERT INTO settings (key, value, description) VALUES
    ('opc.minimum_publish_interval_ms', '"1000"',
     'Global minimum OPC UA publish interval in milliseconds (min: 100). No source can poll faster than this.')
ON CONFLICT (key) DO NOTHING;

-- Backup settings
INSERT INTO settings (key, value, description) VALUES
    ('backup_enabled', '"true"',
     'Whether automated scheduled backups are enabled'),
    ('backup_include_uploads', '"true"',
     'Include uploaded files (SVGs, photos, attachments) in backups')
ON CONFLICT (key) DO NOTHING;
```

### Tier 2 — Content Seed Data

Tier 2 loads canned templates and content that provide out-of-box value. All Tier 2 inserts use `ON CONFLICT DO NOTHING` or version-aware upserts for system-owned records.

```sql
-- 38 canned report templates (see doc 11 for full list)
-- Inserted as design_objects with type='template', is_system_template=true
-- Example: Alarm Performance Summary, Shift Handover, Environmental Compliance...

-- 19 canned dashboard templates (see doc 10 for full list)
-- Inserted as design_objects with is_system=true
-- Example: Process Overview, Alarm KPI, Equipment Health...

-- 40 connector templates for Universal Import (see doc 24)
-- Inserted into connector_templates table
-- Example: SAP PM Work Orders, ServiceNow Incidents, Maximo Assets...

-- ISA-101 symbol library SVG templates (see docs 19, 35)
-- Inserted as design_objects with type='template'
-- 27 equipment types × variants, embedded via include_bytes!()

-- Recognition class-to-template mappings (see doc 19)
-- Inserted into settings: recognition_class_template_map, recognition_dcs_class_template_map

-- Help content markdown files (see doc 06)
-- Bundled in binary, served as static assets (not stored in DB)

-- Seed version tracking
INSERT INTO settings (key, value, description) VALUES
    ('seed_version_tier1', '"1"', 'Bootstrap seed data version'),
    ('seed_version_tier2', '"1"', 'Content seed data version')
ON CONFLICT (key) DO NOTHING;
```

---

**Next Steps:** Review development phases document for implementation sequence.

## Database Migration Policy

### Tooling

**sqlx embedded migrations** (`sqlx::migrate!()` macro). Migrations are baked into each service binary and run automatically on startup. For development, use `sqlx-cli` (`sqlx migrate add`, `sqlx migrate run`, `sqlx migrate revert`).

### Versioning

Timestamp-based filenames: `YYYYMMDDHHMMSS_name.sql` (sqlx default). This prevents merge conflicts in multi-developer teams compared to sequential numbering. All schema changes use reversible migration pairs (`.up.sql` / `.down.sql`).

### Zero-Downtime Migration Rules (Mandatory)

These rules are non-negotiable for all migrations against production databases:

1. **`SET lock_timeout = '5s'`** before every DDL statement — prevents cascading lock waits that block all queries. If the lock isn't acquired in 5 seconds, the statement fails rather than queuing behind long-running queries.

2. **Run each DDL statement in a separate transaction** — minimizes lock hold time. Never bundle multiple `ALTER TABLE` or `CREATE INDEX` statements in a single transaction.

3. **`CREATE INDEX CONCURRENTLY`** — never use blocking index creation on populated tables. Note: `CONCURRENTLY` cannot run inside a transaction, so these must be standalone statements.

4. **Adding columns**: `ALTER TABLE ADD COLUMN` with a non-null default is fast in PostgreSQL 16 (catalog-only change, no table rewrite). For the nullable-then-constrain pattern: add the column as nullable → backfill in batches → add the `NOT NULL` constraint.

5. **Never rename or drop columns in the same release that changes application code.** Use expand-and-contract:
   - **Expand**: Add the new column, deploy code that writes to both old and new columns
   - **Contract**: In a later migration, drop the old column after code no longer reads it

6. **Never change column types in-place** — `ALTER COLUMN TYPE` rewrites the entire table and holds an `ACCESS EXCLUSIVE` lock for the duration. Instead: add a new column with the desired type → backfill → swap reads → drop the old column.

7. **Data backfills in batches** (1,000–5,000 rows per batch) with explicit `LIMIT`. Never run a backfill in the same transaction as DDL. Example pattern:
   ```sql
   -- Run in a loop until 0 rows affected
   UPDATE target_table
   SET new_col = compute_value(old_col)
   WHERE new_col IS NULL
   LIMIT 5000;
   ```

8. **Never drop tables or columns that active service code still references** — deploy the code changes first (removing reads/writes to the old artifact), then migrate the schema after all service instances are running the new code.

### Backward Compatibility Contract

Services at version **N+1** must work with database schema at version **N** (the expand phase). Schema at version **N+1** removes deprecated artifacts only after all services have been upgraded (the contract phase). This allows rolling service restarts without downtime — at any point during an upgrade, both old and new service binaries can operate against the same database.

## Observability Metrics Schema

```sql
-- Observability metrics storage (see doc 36)
CREATE SCHEMA io_metrics;

CREATE TABLE io_metrics.samples (
    time TIMESTAMPTZ NOT NULL,
    metric_name TEXT NOT NULL,
    labels JSONB NOT NULL DEFAULT '{}',
    value DOUBLE PRECISION NOT NULL
);

SELECT create_hypertable('io_metrics.samples', 'time');

CREATE INDEX idx_metrics_name_time ON io_metrics.samples (metric_name, time DESC);
CREATE INDEX idx_metrics_labels ON io_metrics.samples USING GIN (labels);

-- Retention: 30 days raw samples
SELECT add_retention_policy('io_metrics.samples', INTERVAL '30 days');

-- 5-minute rollup for long-term trends (1 year retention)
CREATE MATERIALIZED VIEW io_metrics.samples_5m
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('5 minutes', time) AS bucket,
    metric_name,
    labels,
    avg(value) AS avg_value,
    max(value) AS max_value,
    min(value) AS min_value,
    count(*) AS sample_count
FROM io_metrics.samples
GROUP BY bucket, metric_name, labels;

SELECT add_retention_policy('io_metrics.samples_5m', INTERVAL '365 days');
```

## Change Log

- **v0.28**: Fixed canned report count 37→38 in seed data comment. Fixed stale doc link `27_ALERT_SERVICE`→`27_ALERT_SYSTEM` in Alerting Tables section.
- **v0.27**: Added `extracted_text TEXT` column to `log_media` and `round_media` for OCR-extracted text from image attachments. Added partial GIN indexes on both tables for full-text search on extracted text. See doc 13.
- **v0.26**: Added `locked_by` and `locked_at` columns to `design_objects` for pessimistic edit locking. Added `design_object_versions` table for graphic version history (rolling 10-draft window + permanent publish snapshots). Added `opc.minimum_publish_interval_ms` to operational seed settings. See doc 09.
- **v0.25**: Removed hardcoded permission count from seed data comment — now references doc 03 as authoritative source (same pattern as doc 33).
- **v0.24**: Added Forensics/Investigation schema domain (16). 6 new tables: `investigations` (top-level container with status lifecycle and snapshot on close), `investigation_stages` (sequential narrative sections with own time ranges), `investigation_evidence` (10 evidence types per stage), `investigation_points` (curated point list with removal reasons), `investigation_shares` (user and role sharing), `investigation_links` (entity links to log entries, tickets, alarms, other investigations). Indexes, `updated_at` triggers, and audit triggers. See doc 12.
- **v0.23**: Added Data Links & Point Detail tables. `data_links` table for admin-configured cross-dataset correlations (source/target definition + column + transform pipeline + match type). `design_object_points` denormalized reverse lookup for point-to-graphic queries. `point_detail_config` for popup section layout with per-equipment-class overrides. Added `point_column` and `point_column_transforms` to `import_definitions` for point name designation with transform pipeline. Added `equipment_id` FK to `tickets` table (was documented in doc 24 architecture but missing from DDL). See doc 24 Section 6 (Data Links) and doc 32 (Point Detail component).
- **v0.25**: Added migrations 46–49 for OPC UA supplemental work. Migration 46: added `alarm_limit_hh`, `alarm_limit_h`, `alarm_limit_l`, `alarm_limit_ll DOUBLE PRECISION` and `alarm_limit_source VARCHAR(20)` (CHECK: 'opc_ua'|'supplemental'|'wizard') to `points_metadata` and `points_metadata_versions`; partial index `idx_points_metadata_alarm_limits` on `source_id WHERE alarm_limit_source IS NOT NULL`. Migration 47: added `point_source_id UUID REFERENCES point_sources(id) ON DELETE SET NULL` and `is_supplemental_connector BOOLEAN NOT NULL DEFAULT false` to `import_connections`; CONSTRAINT `chk_supplemental_has_source` (NOT is_supplemental_connector OR point_source_id IS NOT NULL); partial index `idx_import_connections_supplemental`. Migration 48: added `'dcs_supplemental'` to `connector_templates.domain` CHECK; seeded 8 DCS supplemental templates (pi-web-api, honeywell-experion-epdoc, siemens-sph-rest, siemens-wincc-oa-rest, abb-information-manager-rest, kepware-rest, canary-labs-rest, deltav-event-chronicle). Migration 49: `ALTER TYPE event_source_enum ADD VALUE IF NOT EXISTS 'supplemental'` — required for DCS REST connector events; forward-only (PostgreSQL cannot remove enum values without type recreation).
- **v0.24**: Updated `import_connections` DDL to include `point_source_id` and `is_supplemental_connector` columns with FK and CHECK constraint. These ship in migration 47 but their DDL is reflected in the authoritative schema here. See 24_UNIVERSAL_IMPORT.md §3.2.1.
- **v0.23**: Added alarm limit columns and `alarm_limit_source` to `points_metadata` and `points_metadata_versions` (migration 46). Priority: OPC UA > supplemental connector > I/O wizard. See 17_OPC_INTEGRATION.md §5.4.
- **v0.22**: Formalized seed data strategy with two-tier system. Tier 1 (Bootstrap): admin user, roles, permissions, data categories, settings, alert channels, EULA, site — required for first startup. Tier 2 (Content): 37 canned reports, 19 canned dashboards, 40 connector templates, symbol library SVGs, recognition mappings — optional out-of-box content. CLI flags (`--tier1`, `--tier2`). Version tracking via settings keys. Upgrade behavior: Tier 1 additive only, Tier 2 updates system templates without touching user copies.
- **v0.21**: Added Database Migration Policy section (zero-downtime rules: lock_timeout, CONCURRENTLY, expand-and-contract, batch backfills, backward compatibility contract). Added `io_metrics` schema for observability metrics storage (hypertable with 30-day raw retention, 5-minute continuous aggregate with 1-year retention). See doc 36.
- **v0.20**: Added `eula_versions` and `eula_acceptances` tables. `eula_versions`: draft/active/archived lifecycle with `content_hash` (SHA-256) for tamper-proof content verification, unique partial index enforcing single active version. `eula_acceptances`: append-only legal audit trail with `content_hash`, `username_snapshot`, IP, role, and user agent. Three integrity triggers: prevent published version deletion, prevent published version content edit, prevent acceptance update/delete. Two performance indexes for login-time check and admin audit queries. Tables are immutable/non-snapshottable (same category as `audit_log`). See 29_AUTHENTICATION.md EULA Acceptance Gate.
- **v0.19**: Added `connector_templates` table (pre-built import definitions for 40 known applications, seed data). Domain CHECK constraint for 8 integration domains, `template_config` JSONB for complete import definition with `{{placeholder}}` variables, `required_fields` JSONB for wizard dynamic form generation, `target_tables TEXT[]` for target table list. Added `template_id` and `template_version` provenance columns to `import_definitions`. Universal Import tables count updated from 6 to 7.
- **v0.18**: Added Integration Data Tables (schema domain 15) — 28 new typed tables across 7 data domains: Equipment Registry (equipment, equipment_points, equipment_nameplate, equipment_criticality), Maintenance/CMMS (work_orders, spare_parts, pm_schedules), ERP/Financial (inventory_items, purchase_orders, purchase_order_lines, vendor_master, cost_centers), Ticketing/ITSM (tickets, ticket_comments), LIMS/Lab (sample_points, lab_samples, lab_results, product_specifications), Environmental (emissions_events, compliance_records, ambient_monitoring hypertable, ldar_records, permits, waste_manifests), Regulatory/Compliance (moc_records, safety_incidents, inspection_findings, regulatory_permits, risk_assessments). All tables use typed columns with `extra_data JSONB` overflow, `import_run_id` provenance tracking, and `(source_system, external_id)` unique constraints. Equipment table serves as cross-domain join key. 22 `updated_at` triggers, audit trigger on equipment table. See 24_UNIVERSAL_IMPORT.md Section 5b and `24_integrations/` for 40 connector profiles.
- **v0.17**: Deep dive: Added `sites` table with `user_sites` junction for multi-site scoping. Added `data_categories` table (9 predefined seed categories). Added `group_roles` junction table for group-to-role assignment. Added `idp_role_mappings` table for structured IdP group-to-role mapping with match types (exact/prefix/regex), site scoping, and priority. Added `certificates` table for TLS certificate tracking. Added `is_emergency_account` and `role_source` columns to `users`. Added `is_predefined`, `cloned_from`, `idle_timeout_minutes`, and `max_concurrent_sessions` columns to `roles`. Added `data_category_id` FK to `point_sources`. Updated default roles seed from 3 generic roles to 8 predefined roles (Viewer, Operator, Shift Supervisor, Engineer, Maintenance Technician, Safety Officer, Data Steward, Admin). Added schema domain 14 (Sites & Certificates). Added indexes, `updated_at` triggers, and audit triggers for all new tables. Added site scoping implementation notes.
- **v0.16**: Updated seed data permission count (87→119, per doc 03 v1.4). Added 17 operational seed settings across 6 categories: Events/Alarms (5 settings incl. eval interval, shelve limits, retention, chattering threshold), Rounds (4 settings incl. GPS proximity, transfer timeout, media limits), Log (1 setting for auto-create on shift start), Forensics (3 settings incl. max correlation points, time window, cache TTL), Tile rendering (2 settings for auto-regenerate and max zoom), Backup (2 settings for enable and uploads inclusion).
- **v0.15**: Major schema overhaul — replaced single `events` table with ISA-18.2 compliant unified event model (`events` hypertable, `alarm_states`, `alarm_definitions`, `alarm_shelving`; 4 new enums: `event_type_enum`, `event_source_enum`, `alarm_state_enum`, `alarm_priority_enum`). Replaced single `rounds` table with template/instance/response model (`round_templates`, `round_schedules`, `round_instances`, `round_responses`, `round_media`) supporting compound checkpoints, expression builder integration, GPS/barcode gates, and media attachments. Replaced `log_entries`/`log_attachments` tables with template/segment/instance model (`log_templates`, `log_segments`, `log_schedules`, `log_instances`, `log_entries`, `log_media`) supporting WYSIWYG, field tables, field lists, point data segments, and full-text search via tsvector/GIN. Defined JSONB column schemas for all new JSONB fields. Added `deleted_at` soft delete columns per system-wide F4 policy on `alarm_definitions`, `round_templates`, `log_templates`, `log_instances`. Added `updated_at` triggers for 9 new tables. Added audit triggers for 7 admin-configurable tables (alarm definitions/shelving, round/log templates/schedules/segments). Added events hypertable retention/compression policy comments.
- **v0.14**: Replaced `shared_with UUID[]` columns with join tables (`workspace_shares`, `dashboard_shares`). Supports FK enforcement, group sharing (future), permission levels (view/edit), and indexed grantee lookups.
- **v0.13**: Fixed seed data permission count (74→87). Auth tables now use enum types (`auth_provider_configs.provider_type` uses `auth_provider_type`, `user_mfa.mfa_type` uses `mfa_type`). Audit trigger on `points_metadata` excludes `last_seen_at`-only updates (split into INSERT/DELETE trigger + conditional UPDATE trigger with WHEN clause). Changed `points_history_raw` FK to `ON DELETE RESTRICT` (prevents accidental deletion of historical data). Added missing `updated_at` triggers for 13 tables (`groups`, `design_objects`, `workspaces`, `dashboards`, `report_templates`, `settings`, `import_connections`, `import_definitions`, `import_schedules`, `alert_templates`, `alert_rosters`, `email_providers`, `email_templates`). Added missing audit triggers for 11 sensitive tables (`roles`, `role_permissions`, `user_roles`, `user_groups`, `alert_templates`, `alert_rosters`, `alert_channels`, `email_providers`, `settings`, `import_connections`, `import_definitions`).
- **v0.12**: Added Domain 13 (Authentication Extended): 7 new tables (`auth_provider_configs`, `user_mfa`, `mfa_recovery_codes`, `mfa_policies`, `api_keys`, `auth_flow_state`, `scim_tokens`), 2 new enums (`auth_provider_type`, `mfa_type`). Modified `users` table: `password_hash` nullable, added `auth_provider`, `auth_provider_config_id`, `auth_provider_user_id`, `external_id`, `is_service_account`, `last_login_at`, `mfa_enabled`, `mfa_enrollment_deadline` columns with unique index on external identity. Added indexes, `updated_at` triggers, and audit triggers for new tables. See 29_AUTHENTICATION.md.
- **v0.11**: Added Alerting schema domain (8 tables: `alert_templates`, `alert_rosters`, `alerts`, `alert_deliveries`, `alert_escalations`, `alert_channels`, `push_subscriptions`) and Email schema domain (4 tables: `email_providers`, `email_templates`, `email_queue`, `email_delivery_log`). Full DDL with indexes, enums, and FK constraints. Updated schema overview to include domains 11 (Alerting) and 12 (Email). See 27_ALERT_SERVICE.md and 28_EMAIL_SERVICE.md.
- **v0.10**: Updated Recognition schema domain description, `recognition_correction` table description, and seed data comment from "P&ID recognition" to "symbol recognition (P&ID and DCS)" to reflect dual-domain scope in doc 26.
- **v0.9**: Fixed `user_sessions` comment from "retoken management" to "refresh token management". Updated seed data permission count from 73 to 74, added `designer:import` to seed INSERT. Renamed `audit_log.timestamp` column to `created_at` and updated corresponding index.
- **v0.8**: Added `window_groups` table for saved multi-window configurations. JSONB `configuration` column stores main window and secondary window layout with per-screen positioning (Window Management API). Added owner index, updated_at trigger. Updated schema overview domain 3 to include window groups. See doc 06 for full Window Group specification.
- **v0.7**: Added Recognition schema domain with `recognition_correction` table and indexes. See `26_PID_RECOGNITION.md`.
- **v0.6**: Added Export & Bulk Update tables section (3 tables: export_jobs, change_snapshots, change_snapshot_rows). Full DDL with constraints, defaults, CHECK constraints, and FK relationships. Added schema domain 9 (Export & Bulk Update). Updated seed data permission count from 63 to 73. Complete indexes, triggers, and audit assignments in 25_EXPORT_SYSTEM.md Section 12.
- **v0.5**: Added Universal Import tables section (6 tables: import_connections, import_definitions, import_schedules, import_runs, import_errors, custom_import_data). Full DDL with constraints, defaults, and CHECK constraints. Updated schema overview to include Universal Import domain. Updated seed data permission count from 59 to 63. Complete indexes, triggers, and audit assignments in 24_UNIVERSAL_IMPORT.md Section 5.
- **v0.4**: Moved `custom_expression_id` column from inline `points_metadata` CREATE TABLE to ALTER TABLE after `custom_expressions` definition (fixes DDL forward reference). Removed duplicate UNIQUE index on `custom_expressions.name` (inline constraint already creates it). Updated seed data permission count from 55 to 59.
- **v0.3**: Added `custom_expressions` table for Expression Builder (AST JSON storage, context types, ownership/sharing, denormalized point references with GIN index). Added `custom_expression_id` FK on `points_metadata` (ON DELETE SET NULL) linking points to saved custom conversions. Added indexes, updated_at trigger, and audit trigger for custom_expressions. Updated schema overview to include Expression Builder domain.
- **v0.2**: Added `point_sources` table for multi-source support (OPC UA, Modbus, manual, MQTT, CSV) with VARCHAR+CHECK constraints, connection config JSONB, and connection status tracking. Refactored `points_metadata`: tagname uniqueness now (tagname, source_id), added source_id FK (ON DELETE RESTRICT), denormalized current source metadata (trigger-synced from versions), application config columns (active, criticality, area, default_graphic_id, GPS, barcode, notes, app_metadata JSONB, write_frequency_seconds), lifecycle timestamps (first_seen_at, last_seen_at, last_good_value_at, deactivated_at, reactivated_at). Added `points_metadata_versions` for versioned source metadata with forensic history. Added `fillfactor=80` on points_current for HOT update optimization. Added UNIQUE (point_id, timestamp) deduplication constraint on points_history_raw. Added functions: prevent_point_deletion (trigger), sync_point_metadata_from_version (trigger), handle_point_activation_change (trigger), upsert_point_from_source, backfill_upsert_history, get_effective_point_metadata, get_next_point_metadata_version. Added audit triggers on point_sources and points_metadata (NOT on hot-path tables). Added seed data for Manual Entry source and backfill settings.
- **v0.1**: Added `aggregation_types` INTEGER bitmask column to `points_metadata` for controlling which aggregate operations are semantically valid per point (averaging, summing, accumulation). Added `points_history_15m` continuous aggregate. Added `WHERE quality = 'Good'` filtering to all continuous aggregate views (only Good OPC UA quality values are aggregated). Added `sum` column to all aggregates. Added aggregate retention policy summary.
