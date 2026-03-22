-- DD-29-009 / DD-29-010: Lock screen columns on user_sessions.
--
-- locked_since          — set when the session is locked (NULL = unlocked).
--                         Written by the lock endpoint (DD-29-010).
-- last_successful_unlock_at — reset on a successful verify-password / verify-pin.
-- unlock_fail_count_soft — failures within the current 5-minute rolling window.
-- unlock_fail_window_start — start of the current soft-limit window.
-- unlock_fail_count_hard — cumulative failures since last_successful_unlock_at
--                          (or since session created_at). Resets on success.

ALTER TABLE user_sessions
    ADD COLUMN IF NOT EXISTS locked_since               TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS last_successful_unlock_at  TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS unlock_fail_count_soft     SMALLINT    NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS unlock_fail_window_start   TIMESTAMPTZ NULL,
    ADD COLUMN IF NOT EXISTS unlock_fail_count_hard     SMALLINT    NOT NULL DEFAULT 0;
