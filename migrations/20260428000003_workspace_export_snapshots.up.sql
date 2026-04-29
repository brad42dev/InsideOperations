ALTER TABLE video_export_jobs
    ADD COLUMN snapshot_workspace_id UUID;

CREATE INDEX idx_video_export_jobs_snapshot
    ON video_export_jobs(snapshot_workspace_id)
    WHERE snapshot_workspace_id IS NOT NULL;
