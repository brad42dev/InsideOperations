-- Revert points_history_raw FK: change ON DELETE CASCADE back to ON DELETE RESTRICT

ALTER TABLE points_history_raw
    DROP CONSTRAINT IF EXISTS points_history_raw_point_id_fkey;

ALTER TABLE points_history_raw
    ADD CONSTRAINT points_history_raw_point_id_fkey
    FOREIGN KEY (point_id)
    REFERENCES points_metadata(id)
    ON DELETE RESTRICT;
