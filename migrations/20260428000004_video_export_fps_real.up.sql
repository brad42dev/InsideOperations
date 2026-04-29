ALTER TABLE video_export_jobs
    ALTER COLUMN fps TYPE DOUBLE PRECISION USING fps::DOUBLE PRECISION,
    DROP CONSTRAINT IF EXISTS video_export_jobs_fps_check,
    ADD CONSTRAINT video_export_jobs_fps_check CHECK (fps > 0 AND fps <= 60);
