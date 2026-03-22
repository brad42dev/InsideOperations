-- DD-29-011: PIN management for lock screen unlock.
--
-- lock_pin_hash — Argon2 hash of the user's optional 6-digit numeric PIN.
--                 NULL means no PIN is set.

ALTER TABLE users ADD COLUMN IF NOT EXISTS lock_pin_hash TEXT NULL;
