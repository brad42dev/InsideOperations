---
id: DD-39-006
title: Export shape.json sidecar alongside shape.svg for custom shapes
unit: DD-39
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

When a graphic uses custom shapes (those with `.custom.*` IDs), the exporter must bundle the full shape sidecar JSON alongside the shape SVG in the `shapes/` directory. The sidecar is the doc 35 schema JSON describing connection points, attachment zones, state CSS classes, composable part declarations, and other behavioral metadata. Without the sidecar, a target I/O instance can import the shape's visual SVG but cannot connect it to pipes, accept composable parts, or drive alarm state CSS — it would be visually present but functionally inert.

## Spec Excerpt (verbatim)

> Custom shapes (those not in the built-in shape library) are packaged so the target system can import both the graphic and the shapes it depends on. Each shape directory contains:
> - **`shape.json`**: Full shape sidecar following the schema defined in doc 35 (Shape Library). Includes connection points, attachment zones, state CSS classes, composable part declarations, and all metadata needed for the Designer palette.
> - **`shape.svg`**: The shape's SVG content.
> — design-docs/39_IOGRAPHIC_FORMAT.md, §6 Shape and Stencil Packaging

## Where to Look in the Codebase

Primary files:
- `services/api-gateway/src/handlers/iographic.rs` lines 541-554 — shape query: currently only `id, name, svg_data` are selected; must also fetch sidecar/metadata
- `services/api-gateway/src/handlers/iographic.rs` lines 626-646 — shape write loop: currently only writes `shape.svg`; must also write `shape.json`

## Verification Checklist

Read `services/api-gateway/src/handlers/iographic.rs`:

- [ ] Shape query (line ~541) selects `metadata` or a dedicated sidecar column alongside `svg_data`
- [ ] For each custom shape, a `shapes/{shape_dir}/shape.json` entry is written to the ZIP
- [ ] `shape.json` content follows the doc 35 sidecar schema (has `connection_points`, `attachment_zones`, `states` etc.)
- [ ] `shapes/{shape_dir}/shape.svg` continues to be written (no regression)
- [ ] If `metadata` is null/empty for a shape, `shape.json` is written as an empty object `{}` rather than being omitted

## Assessment

- **Status**: ❌ Missing
- **What needs to change**: The shape query and write loop both need updating. The query must fetch the sidecar (stored in `design_objects.metadata` JSONB or a dedicated column). The write loop must add a `shape.json` ZIP entry.

## Fix Instructions

1. Update the shape query at iographic.rs line ~541:
   ```rust
   let shape_rows = sqlx::query(
       "SELECT id, name, svg_data, metadata FROM design_objects \
        WHERE parent_id = $1 AND type IN ('shape', 'stencil')",
   )
   ```

2. In the shape write loop (lines 626-646), after writing `shape.svg`, add:
   ```rust
   let shape_meta: Option<JsonValue> = shape_row
       .try_get::<Option<JsonValue>, _>("metadata")
       .ok()
       .flatten();
   let shape_json = serde_json::to_string_pretty(
       &shape_meta.unwrap_or(JsonValue::Object(serde_json::Map::new()))
   ).unwrap_or_else(|_| "{}".to_string());

   if let Err(e) = zip.start_file(format!("shapes/{}/shape.json", shape_dir), options) {
       tracing::warn!(error = %e, "export_graphic: skipping shape.json");
   } else {
       let _ = zip.write_all(shape_json.as_bytes());
   }
   ```

3. Ensure the manifest `shapes` array (added in DD-39-001) includes an entry for each custom shape with `directory`, `name`, and `shape_id` fields.

Do NOT:
- Skip `shape.json` when `metadata` is empty — write `{}` so the importer knows the file was intentionally minimal
- Confuse the shape's `metadata` JSONB (which holds the sidecar) with the graphic's `metadata` JSONB (which holds display properties)
