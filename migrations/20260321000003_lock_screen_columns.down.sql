-- Reverse DD-29-009 / DD-29-010 lock screen columns.

ALTER TABLE user_sessions
    DROP COLUMN IF EXISTS locked_since,
    DROP COLUMN IF EXISTS last_successful_unlock_at,
    DROP COLUMN IF EXISTS unlock_fail_count_soft,
    DROP COLUMN IF EXISTS unlock_fail_window_start,
    DROP COLUMN IF EXISTS unlock_fail_count_hard;
