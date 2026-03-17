-- Down: restore simple OPC node ID string bindings from the structured format.
-- Reverses the conversion by reading point_id UUIDs back to their node_id strings.
-- Note: this requires points_metadata and point_sources to still be intact.

WITH structured_pairs AS (
  SELECT
    d.id   AS graphic_id,
    key    AS svg_id,
    (d.bindings->key->>'point_id')::uuid AS point_uuid
  FROM design_objects d,
       jsonb_object_keys(d.bindings) AS key
  WHERE d.bindings IS NOT NULL
    AND jsonb_typeof(d.bindings) = 'object'
    AND jsonb_typeof(d.bindings->key) = 'object'   -- only structured values
    AND d.bindings->key ? 'point_id'
),
resolved AS (
  SELECT
    sp.graphic_id,
    sp.svg_id,
    'ns=1;s=' || pm.tagname AS opc_node_id
  FROM structured_pairs sp
  JOIN points_metadata pm ON pm.id = sp.point_uuid
),
old_bindings AS (
  SELECT
    graphic_id,
    jsonb_object_agg(svg_id, to_jsonb(opc_node_id)) AS bindings
  FROM resolved
  GROUP BY graphic_id
)
UPDATE design_objects d
SET    bindings = ob.bindings
FROM   old_bindings ob
WHERE  d.id = ob.graphic_id;
