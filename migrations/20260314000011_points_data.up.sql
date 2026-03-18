-- no-transaction
-- Point metadata, versions, current values, history (TimescaleDB hypertable + aggregates)

CREATE TABLE points_metadata (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- POINT IDENTITY
    tagname VARCHAR(255) NOT NULL,
    source_id UUID NOT NULL REFERENCES point_sources(id) ON DELETE RESTRICT,

    -- CURRENT EFFECTIVE SOURCE METADATA (denormalized from latest version)
    description TEXT,
    engineering_units VARCHAR(50),
    data_type VARCHAR(50) NOT NULL,
    min_value DOUBLE PRECISION,
    max_value DOUBLE PRECISION,

    -- AGGREGATION CONTROL (bitmask)
    -- Bit 0 (1): Allow averaging
    -- Bit 1 (2): Allow sum/totaling
    -- Bit 2 (4): Allow accumulation
    aggregation_types INTEGER NOT NULL DEFAULT 0,

    -- APPLICATION CONFIGURATION
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
    write_frequency_seconds INTEGER,

    -- LIFECYCLE TIMESTAMPS
    first_seen_at TIMESTAMPTZ,
    last_seen_at TIMESTAMPTZ,
    last_good_value_at TIMESTAMPTZ,
    deactivated_at TIMESTAMPTZ,
    reactivated_at TIMESTAMPTZ,

    -- STANDARD TIMESTAMPS
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_points_metadata_tagname_source UNIQUE (tagname, source_id)
);

CREATE TABLE points_metadata_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    point_id UUID NOT NULL REFERENCES points_metadata(id) ON DELETE RESTRICT,
    version INTEGER NOT NULL DEFAULT 0,
    description TEXT,
    engineering_units VARCHAR(50),
    data_type VARCHAR(50) NOT NULL,
    min_value DOUBLE PRECISION,
    max_value DOUBLE PRECISION,
    effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source_raw JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_points_metadata_versions_point_version UNIQUE (point_id, version),
    CONSTRAINT chk_version_non_negative CHECK (version >= 0)
);

CREATE TABLE points_current (
    point_id UUID PRIMARY KEY REFERENCES points_metadata(id) ON DELETE CASCADE,
    value DOUBLE PRECISION,
    quality VARCHAR(20) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE points_current SET (fillfactor = 80);

CREATE TABLE points_history_raw (
    point_id UUID NOT NULL REFERENCES points_metadata(id) ON DELETE RESTRICT,
    value DOUBLE PRECISION,
    quality VARCHAR(20) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL
);

SELECT create_hypertable('points_history_raw', 'timestamp',
    chunk_time_interval => INTERVAL '1 day');

ALTER TABLE points_history_raw
    ADD CONSTRAINT uq_points_history_raw_point_timestamp
    UNIQUE (point_id, timestamp);

-- Points in use tracking
CREATE TABLE points_in_use (
    point_id UUID PRIMARY KEY REFERENCES points_metadata(id) ON DELETE CASCADE,
    last_accessed TIMESTAMPTZ DEFAULT NOW(),
    access_count INTEGER DEFAULT 1
);

-- Continuous aggregates (Good quality only)
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

-- Indexes
CREATE INDEX idx_points_metadata_tagname ON points_metadata(tagname);
CREATE INDEX idx_points_metadata_source_id ON points_metadata(source_id);
CREATE INDEX idx_points_metadata_active ON points_metadata(active) WHERE active = true;
CREATE INDEX idx_points_metadata_criticality ON points_metadata(criticality) WHERE criticality IS NOT NULL;
CREATE INDEX idx_points_metadata_area ON points_metadata(area) WHERE area IS NOT NULL;
CREATE INDEX idx_points_metadata_barcode ON points_metadata(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX idx_points_metadata_last_seen_at ON points_metadata(last_seen_at);
CREATE INDEX idx_points_metadata_default_graphic_id ON points_metadata(default_graphic_id) WHERE default_graphic_id IS NOT NULL;
CREATE INDEX idx_pmv_point_effective ON points_metadata_versions(point_id, effective_from);
CREATE INDEX idx_pmv_point_version_desc ON points_metadata_versions(point_id, version DESC);
CREATE INDEX idx_points_current_timestamp ON points_current(timestamp);
CREATE INDEX idx_points_history_point_timestamp ON points_history_raw(point_id, timestamp DESC);

-- Triggers
CREATE TRIGGER trg_points_metadata_updated_at
    BEFORE UPDATE ON points_metadata
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trg_prevent_point_deletion
    BEFORE DELETE ON points_metadata
    FOR EACH ROW EXECUTE FUNCTION prevent_point_deletion();

CREATE TRIGGER trg_sync_point_metadata_from_version
    AFTER INSERT ON points_metadata_versions
    FOR EACH ROW EXECUTE FUNCTION sync_point_metadata_from_version();

CREATE TRIGGER trg_handle_activation_change
    BEFORE UPDATE ON points_metadata
    FOR EACH ROW
    WHEN (OLD.active IS DISTINCT FROM NEW.active)
    EXECUTE FUNCTION handle_point_activation_change();

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
       OR OLD.active IS DISTINCT FROM NEW.active
       OR OLD.aggregation_types IS DISTINCT FROM NEW.aggregation_types)
    EXECUTE FUNCTION log_audit_trail();
