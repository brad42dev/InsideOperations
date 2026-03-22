---
id: DD-36-006
title: Add io_metrics.samples compression policy and samples_5m refresh policy to migrations
unit: DD-36
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The `io_metrics.samples` hypertable should have TimescaleDB compression enabled (segment by `metric_name`, compress after 7 days) and the `io_metrics.samples_5m` continuous aggregate should have a refresh policy. Without these, raw metrics storage grows unbounded and the 5-minute aggregate never refreshes automatically.

## Spec Excerpt (verbatim)

> ```sql
> -- Enable compression on raw samples after 7 days
> ALTER TABLE io_metrics.samples SET (
>     timescaledb.compress,
>     timescaledb.compress_segmentby = 'metric_name',
>     timescaledb.compress_orderby = 'time DESC'
> );
> SELECT add_compression_policy('io_metrics.samples', INTERVAL '7 days');
>
> -- Refresh policy: materialize data older than 10 minutes
> SELECT add_continuous_aggregate_policy('io_metrics.samples_5m',
>     start_offset    => INTERVAL '1 hour',
>     end_offset      => INTERVAL '10 minutes',
>     schedule_interval => INTERVAL '5 minutes');
>
> -- 5-minute aggregate retained for 1 year
> SELECT add_retention_policy('io_metrics.samples_5m', INTERVAL '1 year');
> ```
> — design-docs/36_OBSERVABILITY.md, §TimescaleDB Storage

## Where to Look in the Codebase

Primary files:
- `migrations/20260314000031_metrics.up.sql` — creates schema, hypertable, continuous aggregate; retention NOT set here
- `migrations/20260314000032_retention_policies.up.sql:22-23` — sets `io_metrics.samples` (30d) and `io_metrics.samples_5m` (1y) retention; but no compression for `io_metrics.samples` and no `add_continuous_aggregate_policy` for `samples_5m`

## Verification Checklist

- [ ] `migrations/20260314000031_metrics.up.sql` (or the retention migration) includes `ALTER TABLE io_metrics.samples SET (timescaledb.compress, ...)`
- [ ] `add_compression_policy('io_metrics.samples', INTERVAL '7 days')` is in a migration
- [ ] `add_continuous_aggregate_policy('io_metrics.samples_5m', start_offset => INTERVAL '1 hour', end_offset => INTERVAL '10 minutes', schedule_interval => INTERVAL '5 minutes')` is in a migration
- [ ] The compression `compress_segmentby = 'metric_name'` and `compress_orderby = 'time DESC'` match the spec
- [ ] The down migration reverses these policies

## Assessment

- **Status**: ⚠️ Partial — 30-day retention for `io_metrics.samples` and 1-year retention for `io_metrics.samples_5m` are present; compression policy for `io_metrics.samples` and continuous aggregate refresh policy for `samples_5m` are absent
- **If partial/missing**: `migrations/20260314000032_retention_policies.up.sql:22-23` has retention but nothing else.

## Fix Instructions

Add the missing SQL to `migrations/20260314000032_retention_policies.up.sql` after the existing `io_metrics` retention lines:

```sql
-- io_metrics.samples: compress after 7 days (metric_name segments compress well)
ALTER TABLE io_metrics.samples SET (
    timescaledb.compress,
    timescaledb.compress_segmentby = 'metric_name',
    timescaledb.compress_orderby = 'time DESC'
);
SELECT add_compression_policy('io_metrics.samples', INTERVAL '7 days');

-- io_metrics.samples_5m: continuous aggregate auto-refresh every 5 minutes
SELECT add_continuous_aggregate_policy('io_metrics.samples_5m',
    start_offset      => INTERVAL '1 hour',
    end_offset        => INTERVAL '10 minutes',
    schedule_interval => INTERVAL '5 minutes');
```

Add corresponding reversals to `migrations/20260314000032_retention_policies.down.sql`:
```sql
SELECT remove_continuous_aggregate_policy('io_metrics.samples_5m');
SELECT remove_compression_policy('io_metrics.samples');
ALTER TABLE io_metrics.samples RESET (timescaledb.compress);
```

Do NOT add these to `20260314000031_metrics.up.sql` — that migration runs with `-- no-transaction` and mixing DDL and policy calls in the same transaction-less migration causes issues. Keep them in `20260314000032_retention_policies.up.sql` which already runs `-- no-transaction`.
