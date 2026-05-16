CREATE TYPE video_stream_visibility AS ENUM ('public', 'managed', 'private');
CREATE TYPE video_stream_connection_mode AS ENUM ('direct', 'relay', 'auto');

CREATE TABLE video_streams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  visibility video_stream_visibility NOT NULL DEFAULT 'managed',
  connection_mode video_stream_connection_mode NOT NULL DEFAULT 'auto',
  -- Direct stream URL (browser → camera). NULL when connection_mode = 'relay'.
  direct_url TEXT,
  -- go2rtc stream name + auxiliary config; JSON for forward compatibility.
  -- Example: { "stream_name": "stream_abc123", "go2rtc_inputs": ["rtsp://..."] }
  relay_config JSONB,
  -- ONVIF discovery / PTZ / auth metadata for future phases. Not used by widget yet.
  onvif_config JSONB,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX video_streams_visibility_idx ON video_streams(visibility);

CREATE TRIGGER video_streams_set_updated_at
  BEFORE UPDATE ON video_streams
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
