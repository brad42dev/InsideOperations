DROP INDEX IF EXISTS idx_video_export_jobs_snapshot;
ALTER TABLE video_export_jobs DROP COLUMN IF EXISTS snapshot_workspace_id;
