-- no-transaction
ALTER TABLE points_history_raw RESET (timescaledb.compress_algorithm);
