-- no-transaction
ALTER TABLE points_history_raw SET (
    timescaledb.compress_algorithm = 'gorilla'
);
