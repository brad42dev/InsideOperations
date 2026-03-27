-- Remove minimal sidecar from variant shapes that had none before.
UPDATE design_objects
SET metadata = metadata - 'sidecar'
WHERE type IN ('shape', 'shape_part')
  AND metadata->>'source' = 'library'
  AND (metadata->'sidecar') IS NOT NULL
  AND NOT (metadata->'sidecar' ? 'variants')
  AND NOT (metadata->'sidecar' ? 'states');
