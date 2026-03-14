# Inside/Operations - Time-Series Data with TimescaleDB

## Overview

TimescaleDB extension provides optimized storage and querying for time-series point data. All pre-computed aggregates filter by OPC UA quality status, including only values with "Good" quality by default. The application layer enforces per-point aggregation type constraints (averaging, summing, accumulation) to prevent semantically invalid calculations.

## Hypertable Design

### points_history_raw (Hypertable)
```sql
CREATE TABLE points_history_raw (
    point_id UUID NOT NULL REFERENCES points_metadata(id) ON DELETE CASCADE,
    value DOUBLE PRECISION,
    quality VARCHAR(20) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    UNIQUE (point_id, timestamp)
);

SELECT create_hypertable('points_history_raw', 'timestamp',
    chunk_time_interval => INTERVAL '1 day');
```

**Deduplication Constraint:** The `UNIQUE (point_id, timestamp)` constraint prevents duplicate readings for the same point at the same timestamp. All application INSERT paths use `ON CONFLICT (point_id, timestamp) DO NOTHING` so that replayed or overlapping data is silently deduplicated rather than raising errors.

**Partitioning:**
- Partitioned by timestamp (1-day chunks)
- Old chunks automatically compressed
- Old chunks eventually dropped (retention policy)

**Quality Column:**
- Stores OPC UA quality status: `Good`, `Bad`, or `Uncertain`
- All raw values are stored regardless of quality (preserves full history)
- Aggregates filter to `Good` quality only (see Continuous Aggregates)

## Continuous Aggregates

### Purpose
Pre-compute aggregates (avg, min, max, count, sum) at fixed clock-aligned intervals for faster queries over long time ranges. These are TimescaleDB materialized views that refresh automatically.

**Important:** All continuous aggregates include `WHERE quality = 'Good'` to exclude bad and uncertain readings. This ensures aggregate values are computed only from reliable data. Raw data retains all quality levels for forensic analysis.

### Quality Filtering Rationale

OPC UA defines three quality categories (per OPC UA Part 8):
- **Good**: Value is reliable and usable for calculations
- **Uncertain**: Value may not accurately represent the true process state (e.g., sensor not accurate, engineering units exceeded, last usable value)
- **Bad**: Value is not usable (e.g., sensor failure, device failure, no communication, configuration error)

Including `Uncertain` or `Bad` values in aggregates would produce misleading results. By filtering to `Good` only:
- Averages, sums, and other calculations reflect actual process conditions
- Periods of communication loss or sensor failure don't skew aggregate values
- The `count` field in aggregates indicates how many good readings existed in the bucket, which can be compared against expected count to assess data completeness

### Aggregate Tables

**1-Minute Aggregate:**
```sql
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
```

**5-Minute Aggregate:**
```sql
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
```

**15-Minute Aggregate:**
```sql
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
```

**1-Hour and 1-Day Aggregates:** Same pattern with `time_bucket('1 hour', ...)` and `time_bucket('1 day', ...)` respectively, both including `WHERE quality = 'Good'` and the `sum` column.

### Aggregate Column Usage by Point Type

All continuous aggregates compute avg, min, max, sum, and count for every point. However, **not all columns are semantically valid for all points**. The `aggregation_types` field on `points_metadata` (see [04_DATABASE_DESIGN](04_DATABASE_DESIGN.md)) controls which aggregate operations the application layer will expose:

| Point Type Example | avg | min/max | sum | count | Rationale |
|---|---|---|---|---|---|
| Temperature (F/C) | Yes | Yes | No | Yes | Averaging a temperature over time is meaningful; summing temperatures is not |
| Flow Rate (GPM) | Yes | Yes | Yes | Yes | Average flow rate is meaningful; total flow volume over a period is also meaningful |
| Accumulator/Counter | No | Yes | No | Yes | Each reading is already a running total; averaging or summing running totals produces garbage |
| PPM (gas concentration) | Yes | Yes | No | Yes | Average concentration is meaningful; summing concentrations is not |
| Valve Position (0/1) | No | Yes | No | Yes | Discrete state; time-weighted state analysis is a different calculation |
| Production Count | No | Yes | Yes | Yes | Sum gives total production; average of a count is rarely useful |

The application enforces these constraints at the API and UI layers, not at the database level. TimescaleDB computes all columns for all points (negligible overhead), and the application selectively exposes results based on `aggregation_types`.

### Refresh Policies

```sql
-- 1-minute aggregate: refresh every minute
SELECT add_continuous_aggregate_policy('points_history_1m',
    start_offset => INTERVAL '1 hour',
    end_offset => INTERVAL '1 minute',
    schedule_interval => INTERVAL '1 minute');

-- 5-minute aggregate: refresh every 5 minutes
SELECT add_continuous_aggregate_policy('points_history_5m',
    start_offset => INTERVAL '2 hours',
    end_offset => INTERVAL '5 minutes',
    schedule_interval => INTERVAL '5 minutes');

-- 15-minute aggregate: refresh every 15 minutes
SELECT add_continuous_aggregate_policy('points_history_15m',
    start_offset => INTERVAL '4 hours',
    end_offset => INTERVAL '15 minutes',
    schedule_interval => INTERVAL '15 minutes');

-- 1-hour aggregate: refresh every hour
SELECT add_continuous_aggregate_policy('points_history_1h',
    start_offset => INTERVAL '1 day',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour');

-- 1-day aggregate: refresh every day
SELECT add_continuous_aggregate_policy('points_history_1d',
    start_offset => INTERVAL '7 days',
    end_offset => INTERVAL '1 day',
    schedule_interval => INTERVAL '1 day');
```

- Each aggregate refreshes at its own interval
- `start_offset` determines how far back to re-compute on each refresh (handles late-arriving data)
- `end_offset` excludes very recent data not yet settled
- Recent data within the end_offset window uses the raw table

## Rolling Averages

### Purpose
Rolling averages provide a trailing-window calculation from the current time backwards. Unlike continuous aggregates which are aligned to fixed clock boundaries (e.g., every minute on the minute), rolling averages always represent "the last N minutes from now."

### Behavior
A rolling average for a given window size includes all `Good` quality raw data points within that window, regardless of how many points exist:
- A point sampled every 5 seconds with a 5-minute rolling average: up to 60 data points
- A point sampled every 1 second with a 5-minute rolling average: up to 300 data points
- A point sampled every 1 minute with a 5-minute rolling average: up to 5 data points

The window is strictly time-based, not count-based. If a point has no data in the last 5 minutes (e.g., due to communication loss), the rolling average returns null or indicates insufficient data.

### Computation
Rolling averages are always computed **on-the-fly** via SQL queries against the raw data or the smallest appropriate continuous aggregate. They are never pre-stored.

```sql
-- 5-minute rolling average for a point
SELECT avg(value) AS rolling_avg,
       min(value) AS rolling_min,
       max(value) AS rolling_max,
       count(*) AS sample_count
FROM points_history_raw
WHERE point_id = $1
  AND quality = 'Good'
  AND timestamp >= NOW() - INTERVAL '5 minutes';
```

For larger rolling windows, the query can use continuous aggregates as the source for better performance:
```sql
-- 1-hour rolling average using 1-minute aggregates
SELECT avg(avg) AS rolling_avg,
       min(min) AS rolling_min,
       max(max) AS rolling_max,
       sum(count) AS sample_count
FROM points_history_1m
WHERE point_id = $1
  AND bucket >= NOW() - INTERVAL '1 hour';
```

### Availability
Rolling averages are available for any point where the `aggregation_types` bitmask permits averaging. No separate configuration is needed per rolling window size. The API accepts arbitrary window durations and selects the most efficient data source (raw table or smallest fitting continuous aggregate).

### Performance Considerations
- Small windows (< 5 minutes): Query raw data directly; index on `(point_id, timestamp DESC)` ensures fast lookups
- Medium windows (5 minutes - 1 hour): Use 1-minute aggregates as source
- Large windows (1 hour - 1 day): Use 5-minute or 15-minute aggregates
- Very large windows (> 1 day): Use 1-hour aggregates
- Results can be cached briefly (e.g., 5-10 seconds) for frequently-requested rolling averages in dashboards

## Query Optimization

### Resolution Selection
Choose aggregate table based on query time range for fixed-period historical queries:
- **< 1 hour:** Use `points_history_raw` or `points_history_1m`
- **1 hour - 1 day:** Use `points_history_5m`
- **1-7 days:** Use `points_history_15m`
- **8-30 days:** Use `points_history_1h`
- **> 30 days:** Use `points_history_1d`

### Example Query
```sql
-- Query for 30-day trend (use 1-hour aggregate)
SELECT bucket, avg
FROM points_history_1h
WHERE point_id = $1
  AND bucket >= NOW() - INTERVAL '30 days'
  AND bucket <= NOW()
ORDER BY bucket;
```
**Result:** ~720 rows (30 days x 24 hours) instead of ~2.6M rows from raw data.

### Aggregation Type Validation
Before returning aggregate results, the API must check the point's `aggregation_types` field:
- If a client requests an `avg` trend for a point that does not permit averaging, return a 400 error with a clear message
- If a client requests a `sum` for a point that does not permit summing, return a 400 error
- The `min`, `max`, and `count` columns are generally available for all points (these are statistical properties, not mathematical operations on the values themselves)
- For longer aggregate periods not stored as continuous aggregates (e.g., weekly, monthly), compute on-the-fly from the longest stored aggregate

## Compression

### Compression Policy
```sql
SELECT add_compression_policy('points_history_raw', INTERVAL '7 days');
```
- Compress chunks older than 7 days
- Reduces storage by 90%+
- Decompression automatic on query

### Compression Settings
- Segment by: point_id
- Order by: timestamp
- Compression algorithm: Gorilla (optimized for time-series)

## Retention Policies

### Raw Data Retention
```sql
SELECT add_retention_policy('points_history_raw', INTERVAL '90 days');
```
- Delete raw data older than 90 days
- Continuous aggregates preserved
- Configurable retention period

### Aggregate Retention
- Keep 1-minute aggregates for 1 year
- Keep 5-minute aggregates for 2 years
- Keep 15-minute aggregates for 3 years
- Keep 1-hour aggregates for 5 years
- Keep 1-day aggregates for 7 years (regulatory compliance)

## Write Performance

### Batch Inserts
```rust
// Batch insert 1000 rows at once, dedup on conflict
sqlx::query!(
    "INSERT INTO points_history_raw (point_id, value, quality, timestamp)
     SELECT * FROM UNNEST($1::uuid[], $2::float8[], $3::text[], $4::timestamptz[])
     ON CONFLICT (point_id, timestamp) DO NOTHING",
    &point_ids, &values, &qualities, &timestamps
)
.execute(&pool)
.await?;
```
**Performance:** 10,000+ inserts/second achievable with batching.

**Note:** All quality levels (Good, Bad, Uncertain) are written to the raw table. Quality filtering happens only at the aggregate level, preserving full fidelity in raw data for forensic analysis.

### Backfill Function

The `backfill_upsert_history(p_point_ids, p_values, p_qualities, p_timestamps)` database function provides batch dedup backfill for reconnection scenarios. It uses the same `ON CONFLICT (point_id, timestamp) DO NOTHING` pattern internally, making it safe to call with overlapping time ranges. The `write_frequency_seconds` column on `points_metadata` is used for smart gap detection -- the backfill logic can identify expected sample intervals and flag gaps where data is missing rather than simply absent.

### Async Writes
- OPC Service writes asynchronously
- Use Tokio channels to queue writes
- Batch and write every second or 1000 points (whichever comes first)

### points_current Tuning

The `points_current` table uses `fillfactor = 80` to reserve free space on each page for HOT (Heap-Only Tuple) updates. Since every incoming value UPSERTs this table, the reduced fill factor allows PostgreSQL to place updated tuples on the same page without requiring index updates, significantly improving write throughput.

```sql
ALTER TABLE points_current SET (fillfactor = 80);
```

### No Audit Triggers on Hot-Path Tables

Do **not** add audit triggers (e.g., `audit_trigger`) to `points_current` or `points_history_raw`. These tables receive high-frequency machine-generated writes (thousands per second) and audit logging on every row would introduce unacceptable overhead. Forensic history is already preserved in `points_history_raw` itself and in `points_metadata_versions` for metadata changes.

## Success Criteria

- Hypertable handles millions of data points
- Continuous aggregates (1m, 5m, 15m, 1h, 1d) provide fast queries
- Quality filtering ensures only Good values are aggregated
- Rolling averages compute correctly from raw data or aggregates
- Aggregation type constraints prevent semantically invalid calculations
- Compression reduces storage significantly
- Retention policies manage data lifecycle
- Write performance meets requirements (10K+ inserts/sec)

## Change Log

- **v0.3**: Fixed `points_history_raw` DDL to match canonical schema in doc 04: added `NOT NULL` constraint on `quality` column, added `REFERENCES points_metadata(id) ON DELETE CASCADE` FK on `point_id`.
- **v0.2**: Added `UNIQUE (point_id, timestamp)` deduplication constraint on `points_history_raw` with `ON CONFLICT DO NOTHING` insert pattern. Added `backfill_upsert_history()` function for batch dedup backfill. Added `fillfactor = 80` on `points_current` for HOT update optimization. Documented `write_frequency_seconds` usage for smart gap detection during backfill. Added explicit no-audit-triggers policy for hot-path tables.
- **v0.1**: Added 15-minute continuous aggregate (`points_history_15m`). Added `WHERE quality = 'Good'` filtering to all continuous aggregates with rationale based on OPC UA status codes. Added `sum` column to all aggregates. Added Rolling Averages section for on-demand trailing-window calculations. Added Aggregation Type Validation section explaining per-point semantic constraints via `aggregation_types` bitmask. Added aggregate column usage table by point type. Expanded refresh policies to cover all five aggregate levels. Updated resolution selection to include 15-minute tier. Added 15-minute aggregate retention (3 years).
