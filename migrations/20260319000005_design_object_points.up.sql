-- Denormalized reverse index: "which graphics contain point X?"
-- Maintained by application logic on scene_data save (per spec §4.5).

CREATE TABLE IF NOT EXISTS design_object_points (
    design_object_id UUID  NOT NULL REFERENCES design_objects(id) ON DELETE CASCADE,
    point_id         UUID  NOT NULL,  -- Point UUID (foreign key into points table)
    PRIMARY KEY (design_object_id, point_id)
);

CREATE INDEX IF NOT EXISTS idx_design_object_points_point
    ON design_object_points (point_id);

COMMENT ON TABLE design_object_points IS
    'Reverse index: which graphics use each point. Updated on every graphic save.';
