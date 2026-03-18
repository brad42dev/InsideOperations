-- no-transaction
-- TimescaleDB retention and compression policies

-- Enable compression on points_history_raw before setting a compression policy
ALTER TABLE points_history_raw
    SET (timescaledb.compress,
         timescaledb.compress_orderby = 'timestamp DESC',
         timescaledb.compress_segmentby = 'point_id');

-- points_history_raw: compress after 7 days, retain 90 days (keep aggregates longer)
SELECT add_compression_policy('points_history_raw', INTERVAL '7 days');
SELECT add_retention_policy('points_history_raw', INTERVAL '90 days');

-- Events: compress after 30 days, retain 7 years (regulatory compliance)
-- SELECT add_compression_policy('events', INTERVAL '30 days');
-- SELECT add_retention_policy('events', INTERVAL '7 years');

-- Ambient monitoring: retain 2 years
SELECT add_retention_policy('ambient_monitoring', INTERVAL '2 years');

-- Observability metrics: 30 days raw, 1 year rollups
SELECT add_retention_policy('io_metrics.samples', INTERVAL '30 days');
SELECT add_retention_policy('io_metrics.samples_5m', INTERVAL '365 days');
