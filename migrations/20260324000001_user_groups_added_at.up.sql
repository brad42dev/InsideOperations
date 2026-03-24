-- Add added_at column to user_groups for tracking when users joined a group
ALTER TABLE user_groups
    ADD COLUMN IF NOT EXISTS added_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
