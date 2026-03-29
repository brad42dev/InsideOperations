-- no-transaction
-- Fix continuous aggregate quality filter: OPC service writes 'good' (lowercase)
-- but the original aggregates filtered WHERE quality = 'Good', matching nothing.
-- Drop and recreate all five tiers with the correct lowercase filter.

DROP MATERIALIZED VIEW IF EXISTS points_history_1d CASCADE;
DROP MATERIALIZED VIEW IF EXISTS points_history_1h CASCADE;
DROP MATERIALIZED VIEW IF EXISTS points_history_15m CASCADE;
DROP MATERIALIZED VIEW IF EXISTS points_history_5m CASCADE;
DROP MATERIALIZED VIEW IF EXISTS points_history_1m CASCADE;

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
WHERE quality = 'good'
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
WHERE quality = 'good'
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
WHERE quality = 'good'
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
WHERE quality = 'good'
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
WHERE quality = 'good'
GROUP BY point_id, bucket;

-- Restore refresh policies
SELECT add_continuous_aggregate_policy('points_history_1m',
    start_offset      => INTERVAL '1 hour',
    end_offset        => INTERVAL '1 minute',
    schedule_interval => INTERVAL '1 minute');

SELECT add_continuous_aggregate_policy('points_history_5m',
    start_offset      => INTERVAL '2 hours',
    end_offset        => INTERVAL '5 minutes',
    schedule_interval => INTERVAL '5 minutes');

SELECT add_continuous_aggregate_policy('points_history_15m',
    start_offset      => INTERVAL '4 hours',
    end_offset        => INTERVAL '15 minutes',
    schedule_interval => INTERVAL '15 minutes');

SELECT add_continuous_aggregate_policy('points_history_1h',
    start_offset      => INTERVAL '1 day',
    end_offset        => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour');

SELECT add_continuous_aggregate_policy('points_history_1d',
    start_offset      => INTERVAL '7 days',
    end_offset        => INTERVAL '1 day',
    schedule_interval => INTERVAL '1 day');

-- Backfill all tiers immediately so historical data is available without waiting
-- for the scheduled policies to run.
CALL refresh_continuous_aggregate('points_history_1m',  NULL, NULL);
CALL refresh_continuous_aggregate('points_history_5m',  NULL, NULL);
CALL refresh_continuous_aggregate('points_history_15m', NULL, NULL);
CALL refresh_continuous_aggregate('points_history_1h',  NULL, NULL);
CALL refresh_continuous_aggregate('points_history_1d',  NULL, NULL);
