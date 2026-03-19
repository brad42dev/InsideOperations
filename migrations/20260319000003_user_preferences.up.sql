-- Stores per-user preferences as a JSONB blob.
-- Used by Process (viewport bookmarks, sidebar state, minimap state) and
-- Console (palette visibility, layout preferences, etc.)

CREATE TABLE IF NOT EXISTS user_preferences (
    user_id     UUID        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    preferences JSONB       NOT NULL DEFAULT '{}',
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
