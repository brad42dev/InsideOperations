-- Reverse DD-29-011 PIN management column.

ALTER TABLE users DROP COLUMN IF EXISTS lock_pin_hash;
