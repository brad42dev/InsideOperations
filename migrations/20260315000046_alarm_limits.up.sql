-- Migration: Add alarm limit columns to points_metadata and points_metadata_versions
-- Sourced from OPC UA Part 8 AnalogItemType (HighHighLimit, HighLimit, LowLimit, LowLowLimit)
-- with fallback to supplemental connectors or the I/O threshold wizard.
-- See doc 17 § OPC UA Optional Services — Part 8 Data Access.

ALTER TABLE points_metadata
    ADD COLUMN IF NOT EXISTS alarm_limit_hh     DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS alarm_limit_h      DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS alarm_limit_l      DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS alarm_limit_ll     DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS alarm_limit_source VARCHAR(20)
        CHECK (alarm_limit_source IS NULL OR alarm_limit_source IN ('opc_ua', 'supplemental', 'wizard'));

ALTER TABLE points_metadata_versions
    ADD COLUMN IF NOT EXISTS alarm_limit_hh     DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS alarm_limit_h      DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS alarm_limit_l      DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS alarm_limit_ll     DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS alarm_limit_source VARCHAR(20)
        CHECK (alarm_limit_source IS NULL OR alarm_limit_source IN ('opc_ua', 'supplemental', 'wizard'));

-- Index for quick lookup of points that have OPC-sourced alarm limits
-- (used by the alarm display and the threshold wizard to show pre-populated limits)
CREATE INDEX IF NOT EXISTS idx_points_metadata_alarm_limits
    ON points_metadata (source_id)
    WHERE alarm_limit_source IS NOT NULL;

COMMENT ON COLUMN points_metadata.alarm_limit_hh IS
    'High-High trip limit. Source priority: OPC UA Part 8/9 HighHighLimit > supplemental connector > I/O threshold wizard';
COMMENT ON COLUMN points_metadata.alarm_limit_h IS
    'High trip limit. Source priority: OPC UA Part 8/9 HighLimit > supplemental connector > I/O threshold wizard';
COMMENT ON COLUMN points_metadata.alarm_limit_l IS
    'Low trip limit. Source priority: OPC UA Part 8/9 LowLimit > supplemental connector > I/O threshold wizard';
COMMENT ON COLUMN points_metadata.alarm_limit_ll IS
    'Low-Low trip limit. Source priority: OPC UA Part 8/9 LowLowLimit > supplemental connector > I/O threshold wizard';
COMMENT ON COLUMN points_metadata.alarm_limit_source IS
    'Which system provided the alarm limits: opc_ua | supplemental | wizard';
