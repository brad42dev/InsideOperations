DROP TRIGGER IF EXISTS video_streams_set_updated_at ON video_streams;
-- CASCADE handles video_stream_access FK dependency when rolling back migration 1 alone.
DROP TABLE IF EXISTS video_streams CASCADE;
DROP TYPE IF EXISTS video_stream_connection_mode;
DROP TYPE IF EXISTS video_stream_visibility;
