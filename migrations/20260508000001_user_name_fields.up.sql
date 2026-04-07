-- Split full_name into first_name + last_name, make display_name editable.
--
-- display_name was GENERATED ALWAYS AS (COALESCE(full_name, username)) STORED.
-- We drop that and add a regular settable column instead.

ALTER TABLE users DROP COLUMN IF EXISTS display_name;

ALTER TABLE users ADD COLUMN IF NOT EXISTS first_name  VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name   VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name VARCHAR(255);

-- Backfill display_name from existing full_name or username
UPDATE users
   SET display_name = COALESCE(full_name, username)
 WHERE display_name IS NULL;
