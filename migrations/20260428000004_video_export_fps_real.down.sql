ALTER TABLE video_export_jobs
    DROP CONSTRAINT IF EXISTS video_export_jobs_fps_check,
    ALTER COLUMN fps TYPE SMALLINT USING ROUND(fps)::SMALLINT,
    ADD CONSTRAINT video_export_jobs_fps_check CHECK (fps BETWEEN 1 AND 60);
