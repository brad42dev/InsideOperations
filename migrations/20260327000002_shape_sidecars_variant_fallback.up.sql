-- For variant shapes (opt1, opt2, etc.) that have no sidecar JSON file,
-- construct a minimal sidecar from the flat view_box in their metadata.
UPDATE design_objects
SET metadata = jsonb_set(
    metadata,
    '{sidecar}',
    jsonb_build_object(
        'geometry', jsonb_build_object(
            'viewBox', metadata->>'view_box',
            'width',   (regexp_match(metadata->>'view_box', '[\d.]+\s+[\d.]+\s+([\d.]+)'))[1]::float,
            'height',  (regexp_match(metadata->>'view_box', '[\d.]+\s+[\d.]+\s+[\d.]+\s+([\d.]+)'))[1]::float
        )
    ),
    true
)
WHERE type IN ('shape', 'shape_part')
  AND metadata->>'source' = 'library'
  AND NOT (metadata ? 'sidecar')
  AND metadata ? 'view_box';
