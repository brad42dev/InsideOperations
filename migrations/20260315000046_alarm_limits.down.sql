-- Rollback: Remove alarm limit columns
ALTER TABLE points_metadata_versions
    DROP COLUMN IF EXISTS alarm_limit_source,
    DROP COLUMN IF EXISTS alarm_limit_ll,
    DROP COLUMN IF EXISTS alarm_limit_l,
    DROP COLUMN IF EXISTS alarm_limit_h,
    DROP COLUMN IF EXISTS alarm_limit_hh;

ALTER TABLE points_metadata
    DROP COLUMN IF EXISTS alarm_limit_source,
    DROP COLUMN IF EXISTS alarm_limit_ll,
    DROP COLUMN IF EXISTS alarm_limit_l,
    DROP COLUMN IF EXISTS alarm_limit_h,
    DROP COLUMN IF EXISTS alarm_limit_hh;

DROP INDEX IF EXISTS idx_points_metadata_alarm_limits;
