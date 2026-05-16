CREATE TYPE video_stream_acl_entity_type AS ENUM ('role', 'user');

CREATE TABLE video_stream_access (
  stream_id UUID NOT NULL REFERENCES video_streams(id) ON DELETE CASCADE,
  entity_type video_stream_acl_entity_type NOT NULL,
  entity_id TEXT NOT NULL,    -- role name (slug) or user UUID, depending on entity_type
  granted_by UUID REFERENCES users(id) ON DELETE SET NULL,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (stream_id, entity_type, entity_id)
);

CREATE INDEX video_stream_access_stream_idx ON video_stream_access(stream_id);
