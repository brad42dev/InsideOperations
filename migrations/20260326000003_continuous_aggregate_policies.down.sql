-- no-transaction
-- Remove continuous-aggregate refresh policies for all five points_history tiers.
-- if_exists => true prevents errors when rolling back on a database that never
-- had these policies applied (e.g., a fresh dev environment).

SELECT remove_continuous_aggregate_policy('points_history_1d',  if_exists => true);
SELECT remove_continuous_aggregate_policy('points_history_1h',  if_exists => true);
SELECT remove_continuous_aggregate_policy('points_history_15m', if_exists => true);
SELECT remove_continuous_aggregate_policy('points_history_5m',  if_exists => true);
SELECT remove_continuous_aggregate_policy('points_history_1m',  if_exists => true);
