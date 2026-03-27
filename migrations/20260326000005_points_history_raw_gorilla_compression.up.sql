-- no-transaction
-- timescaledb.compress_algorithm is not a valid ALTER TABLE storage parameter in TimescaleDB 2.x.
-- Gorilla compression for double precision columns is selected automatically by the engine
-- when compression is enabled. points_history_raw already has compression enabled.
SELECT 1;
