-- Convert simple OPC node ID string bindings to structured ElementBinding format.
--
-- The seed migration stored bindings as { "svg-id": "ns=1;s=TAGNAME" } (plain strings
-- from the SimBLAH point list).  PointBindingLayer expects the richer wire format:
--   { "svg-id": { "point_id": "<uuid>", "attribute": "text", "mapping": { "type": "text", "decimal_places": 1 } } }
--
-- This migration resolves each OPC node ID to a UUID in points_metadata (stripping
-- the "ns=1;s=" prefix to match the tagname column) and rewrites the bindings column.
-- Entries that cannot be resolved (no matching point) are silently dropped.

WITH binding_pairs AS (
  SELECT
    d.id   AS graphic_id,
    key    AS svg_id,
    d.bindings->>key AS opc_node_id
  FROM design_objects d,
       jsonb_object_keys(d.bindings) AS key
  WHERE d.bindings IS NOT NULL
    AND jsonb_typeof(d.bindings) = 'object'
    AND jsonb_typeof(d.bindings->key) = 'string'   -- only plain-string values
),
resolved AS (
  SELECT
    bp.graphic_id,
    bp.svg_id,
    pm.id AS point_uuid
  FROM binding_pairs bp
  JOIN points_metadata pm
    ON pm.tagname = replace(bp.opc_node_id, 'ns=1;s=', '')
),
new_bindings AS (
  SELECT
    graphic_id,
    jsonb_object_agg(
      svg_id,
      jsonb_build_object(
        'point_id',  point_uuid::text,
        'attribute', 'text',
        'mapping',   jsonb_build_object('type', 'text', 'decimal_places', 1)
      )
    ) AS bindings
  FROM resolved
  GROUP BY graphic_id
)
UPDATE design_objects d
SET    bindings = nb.bindings
FROM   new_bindings nb
WHERE  d.id = nb.graphic_id;
