-- Denormalized reverse index: "which graphics use shape X?"
-- Maintained by application logic on scene_data save (per spec §4.4).

CREATE TABLE IF NOT EXISTS design_object_shapes (
    design_object_id UUID  NOT NULL REFERENCES design_objects(id) ON DELETE CASCADE,
    shape_id         TEXT  NOT NULL,  -- Shape library ID (e.g., "pump-centrifugal")
    PRIMARY KEY (design_object_id, shape_id)
);

CREATE INDEX IF NOT EXISTS idx_design_object_shapes_shape
    ON design_object_shapes (shape_id);

COMMENT ON TABLE design_object_shapes IS
    'Reverse index: which graphics use each shape. Updated on every graphic save.';
