SELECT remove_continuous_aggregate_policy('io_metrics.samples_5m');
SELECT remove_compression_policy('io_metrics.samples');
ALTER TABLE io_metrics.samples RESET (timescaledb.compress);
SELECT remove_retention_policy('io_metrics.samples_5m', if_exists => true);
SELECT remove_retention_policy('io_metrics.samples', if_exists => true);
SELECT remove_retention_policy('ambient_monitoring', if_exists => true);
SELECT remove_retention_policy('points_history_raw', if_exists => true);
SELECT remove_compression_policy('points_history_raw', if_exists => true);
