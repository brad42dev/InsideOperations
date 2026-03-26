-- no-transaction
-- Register TimescaleDB background refresh policies for all five points_history
-- continuous-aggregate views so that each tier stays fresh at its own cadence.
-- Without these policies the maintenance loop is the only refresh path and
-- refreshes every tier at the same hourly interval, making the 1m/5m/15m
-- aggregates significantly more stale than the spec requires.

-- 1-minute aggregate: refresh every minute, covering up to the last 1 hour
SELECT add_continuous_aggregate_policy('points_history_1m',
    start_offset      => INTERVAL '1 hour',
    end_offset        => INTERVAL '1 minute',
    schedule_interval => INTERVAL '1 minute');

-- 5-minute aggregate: refresh every 5 minutes, covering up to the last 2 hours
SELECT add_continuous_aggregate_policy('points_history_5m',
    start_offset      => INTERVAL '2 hours',
    end_offset        => INTERVAL '5 minutes',
    schedule_interval => INTERVAL '5 minutes');

-- 15-minute aggregate: refresh every 15 minutes, covering up to the last 4 hours
SELECT add_continuous_aggregate_policy('points_history_15m',
    start_offset      => INTERVAL '4 hours',
    end_offset        => INTERVAL '15 minutes',
    schedule_interval => INTERVAL '15 minutes');

-- 1-hour aggregate: refresh every hour, covering up to the last 1 day
SELECT add_continuous_aggregate_policy('points_history_1h',
    start_offset      => INTERVAL '1 day',
    end_offset        => INTERVAL '1 hour',
    schedule_interval => INTERVAL '1 hour');

-- 1-day aggregate: refresh every day, covering up to the last 7 days
SELECT add_continuous_aggregate_policy('points_history_1d',
    start_offset      => INTERVAL '7 days',
    end_offset        => INTERVAL '1 day',
    schedule_interval => INTERVAL '1 day');
