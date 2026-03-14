-- Observability metrics schema (see doc 36)

CREATE SCHEMA IF NOT EXISTS io_metrics;

CREATE TABLE io_metrics.samples (
    time TIMESTAMPTZ NOT NULL,
    metric_name TEXT NOT NULL,
    labels JSONB NOT NULL DEFAULT '{}',
    value DOUBLE PRECISION NOT NULL
);

SELECT create_hypertable('io_metrics.samples', 'time');

CREATE INDEX idx_metrics_name_time ON io_metrics.samples (metric_name, time DESC);
CREATE INDEX idx_metrics_labels ON io_metrics.samples USING GIN (labels);

-- 5-minute rollup for long-term trends
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
