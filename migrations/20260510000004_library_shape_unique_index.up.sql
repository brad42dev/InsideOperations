CREATE UNIQUE INDEX IF NOT EXISTS uq_library_shape_id
ON design_objects ((metadata->>'shape_id'))
WHERE type IN ('shape', 'shape_part')
  AND metadata->>'source' = 'library';
