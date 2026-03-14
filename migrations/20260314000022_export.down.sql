ALTER TABLE export_jobs DROP CONSTRAINT IF EXISTS fk_export_jobs_snapshot;
DROP TABLE IF EXISTS change_snapshot_rows;
DROP TABLE IF EXISTS change_snapshots;
DROP TABLE IF EXISTS export_jobs;
