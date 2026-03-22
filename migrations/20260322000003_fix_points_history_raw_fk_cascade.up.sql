-- Fix points_history_raw FK: change ON DELETE RESTRICT to ON DELETE CASCADE
-- per design-doc 18_TIMESERIES_DATA.md

ALTER TABLE points_history_raw
    DROP CONSTRAINT IF EXISTS points_history_raw_point_id_fkey;

ALTER TABLE points_history_raw
    ADD CONSTRAINT points_history_raw_point_id_fkey
    FOREIGN KEY (point_id)
    REFERENCES points_metadata(id)
    ON DELETE CASCADE;
