---
id: DD-18-013
title: Register add_continuous_aggregate_policy for all five aggregate tiers
unit: DD-18
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

Each of the five continuous-aggregate views (`points_history_1m`, `_5m`, `_15m`, `_1h`, `_1d`) should have a TimescaleDB background refresh policy registered so that freshness is maintained automatically at the per-tier interval. Currently no `add_continuous_aggregate_policy` call exists in any migration; the maintenance service calls `CALL refresh_continuous_aggregate(...)` for all five at a single 1-hour interval, meaning the 1-minute aggregate can be up to 1 hour stale and dashboard trend charts can appear hours behind real data.

## Spec Excerpt (verbatim)

> ```sql
> -- 1-minute aggregate: refresh every minute
> SELECT add_continuous_aggregate_policy('points_history_1m',
>     start_offset => INTERVAL '1 hour',
>     end_offset => INTERVAL '1 minute',
>     schedule_interval => INTERVAL '1 minute');
> -- ... (5m, 15m, 1h, 1d with their own intervals)
> ```
> — design-docs/18_TIMESERIES_DATA.md, §Refresh Policies

## Where to Look in the Codebase

Primary files:
- `migrations/20260314000032_retention_policies.up.sql` — only `add_continuous_aggregate_policy` call is for `io_metrics.samples_5m`; none for `points_history_*`
- `services/archive-service/src/maintenance.rs:113–141` — manual refresh loop; all 5 called but at `maintenance_interval_secs` (default 3600s) regardless of tier

## Verification Checklist

- [ ] A migration contains `add_continuous_aggregate_policy('points_history_1m', ...)` with `schedule_interval => INTERVAL '1 minute'`
- [ ] A migration contains `add_continuous_aggregate_policy('points_history_5m', ...)` with `schedule_interval => INTERVAL '5 minutes'`
- [ ] A migration contains `add_continuous_aggregate_policy('points_history_15m', ...)` with `schedule_interval => INTERVAL '15 minutes'`
- [ ] A migration contains `add_continuous_aggregate_policy('points_history_1h', ...)` with `schedule_interval => INTERVAL '1 hour'`
- [ ] A migration contains `add_continuous_aggregate_policy('points_history_1d', ...)` with `schedule_interval => INTERVAL '1 day'`
- [ ] Corresponding down migration calls `remove_continuous_aggregate_policy(...)` for all five

## Assessment

- **Status**: ❌ Missing
- **If missing**: No migration registers these policies. The maintenance loop is a fallback but refreshes all tiers at the same (hourly) interval, making the 1m/5m/15m aggregates significantly more stale than the spec intends.

## Fix Instructions

1. Write a new migration (next sequence after `20260322000003`):
   ```sql
   -- no-transaction
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
   ```

2. Down migration:
   ```sql
   -- no-transaction
   SELECT remove_continuous_aggregate_policy('points_history_1d', if_exists => true);
   SELECT remove_continuous_aggregate_policy('points_history_1h', if_exists => true);
   SELECT remove_continuous_aggregate_policy('points_history_15m', if_exists => true);
   SELECT remove_continuous_aggregate_policy('points_history_5m', if_exists => true);
   SELECT remove_continuous_aggregate_policy('points_history_1m', if_exists => true);
   ```

3. The maintenance loop's `CALL refresh_continuous_aggregate(...)` block in `maintenance.rs` can remain as a safety backstop for manual runs but is no longer the primary refresh mechanism.

Do NOT:
- Remove the maintenance loop refresh calls — they serve as a safety backstop for manual maintenance runs
- Set `schedule_interval` the same for all tiers — each tier has its own interval per the spec
