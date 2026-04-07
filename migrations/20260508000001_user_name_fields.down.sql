ALTER TABLE users DROP COLUMN IF EXISTS first_name;
ALTER TABLE users DROP COLUMN IF EXISTS last_name;
ALTER TABLE users DROP COLUMN IF EXISTS display_name;

-- Restore the original generated column
ALTER TABLE users
    ADD COLUMN display_name VARCHAR(255)
    GENERATED ALWAYS AS (COALESCE(full_name, username)) STORED;
