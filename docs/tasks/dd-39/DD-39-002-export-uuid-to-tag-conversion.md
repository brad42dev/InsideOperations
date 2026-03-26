---
id: DD-39-002
title: Convert point UUIDs to tag names in exported graphic.json bindings
unit: DD-39
status: pending
priority: high
depends-on: []
---

## What This Feature Should Do

When exporting a graphic as `.iographic`, every binding in `graphic.json` must use `point_tag` (a string tag name) instead of `point_id` (a UUID). This is the core portability transformation — UUID references are instance-specific and mean nothing on a different I/O instance. The current export writes the raw `bindings` JSONB column directly from the database, preserving UUIDs. An importer reading this file has no portable bindings to resolve.

## Spec Excerpt (verbatim)

> This is the critical portability transformation. On export, UUIDs are resolved to tag names. On import, tag names are resolved back to UUIDs (or flagged as unresolved).
>
> For each binding entry:
> - Look up point_id → tagname via points_metadata
> - Look up point_id → source name via point_sources
> - Replace point_id with point_tag + source_hint
> - Handle nested point references (setpoint_point_id, equipment_point_ids)
> — design-docs/39_IOGRAPHIC_FORMAT.md, §8 Export Workflow

## Where to Look in the Codebase

Primary files:
- `services/api-gateway/src/handlers/iographic.rs` lines 538-539 — where `bindings` is read from DB: this is where processing should begin
- `services/api-gateway/src/handlers/iographic.rs` lines 615-623 — where `graphic_json` is built and written: this must serialize the transformed bindings, not the raw JSONB

## Verification Checklist

Read `services/api-gateway/src/handlers/iographic.rs`:

- [ ] Export function executes a SQL join: `SELECT pm.tagname, ps.name FROM points_metadata pm JOIN point_sources ps ON pm.source_id = ps.id WHERE pm.id = $1` to resolve each `point_id` to a tag name and source name
- [ ] Each binding's `point_id` field is replaced with `point_tag` in the output `graphic.json`
- [ ] Each binding gains a `source_hint` field containing the source name
- [ ] Nested references are also converted: `setpoint_point_id` → `setpoint_point_tag`, `equipment_point_ids` → `equipment_point_tags`
- [ ] If a binding's `point_id` no longer exists in `points_metadata`, the output contains `point_tag: "<DELETED:uuid>"` and `source_hint: null`
- [ ] The written `graphic.json` follows the full spec schema (includes `name`, `type`, `metadata`, `shapes`, `pipes`, `bindings`, `annotations`, `layers`) — not just the bindings object

## Assessment

- **Status**: ❌ Missing
- **What needs to change**: The `export_graphic` function at iographic.rs:616-623 currently writes `serde_json::to_string_pretty(&bindings)` which is just the raw DB JSONB object. It must be replaced with a full `graphic.json` build that: (a) resolves all `point_id` values to tag names, (b) serializes the full spec-compliant `graphic.json` structure including `shapes`, `pipes`, `bindings`, `annotations`, `layers`.

## Fix Instructions

1. After loading `bindings: Option<JsonValue>` (line 538), bulk-collect all point UUIDs referenced in bindings:
   ```rust
   // Walk bindings JSON, collect all "point_id" values
   let point_ids: Vec<Uuid> = collect_point_ids_from_bindings(&bindings);
   ```

2. Batch-resolve them in one query:
   ```sql
   SELECT pm.id, pm.tagname, ps.name AS source_name
   FROM points_metadata pm
   JOIN point_sources ps ON pm.source_id = ps.id
   WHERE pm.id = ANY($1)
   ```

3. Build a `HashMap<Uuid, (String, String)>` mapping `point_id → (tagname, source_name)`.

4. Walk the bindings JSON tree and replace:
   - `"point_id": "uuid"` → `"point_tag": "FIC-101.PV"`, add `"source_hint": "OPC-DCS-1"`
   - `"setpoint_point_id": "uuid"` → `"setpoint_point_tag": "FIC-101.SP"`
   - `"equipment_point_ids": ["uuid", ...]` → `"equipment_point_tags": ["P-101.STS", ...]`
   - Missing UUID: `"point_tag": "<DELETED:uuid>"`, `"source_hint": null`

5. Build the full `graphic.json` object:
   ```json
   {
     "name": ...,
     "type": "graphic",
     "metadata": { "viewBox": ..., "width": ..., "height": ..., ... },
     "shapes": [],
     "pipes": [],
     "bindings": { /* transformed, tag-based */ },
     "expressions": {},
     "annotations": [],
     "layers": []
   }
   ```
   The `shapes`, `pipes`, `annotations`, and `layers` arrays should be extracted from the graphic's scene data if available in the `metadata` JSONB or from SVG parsing. At minimum, `bindings` must be tag-based.

6. Write this full object as `graphics/{dir}/graphic.json` — not the raw bindings.

Do NOT:
- Write `bindings` directly from the DB JSONB column (that is what the current code does and is the bug)
- Skip the nested reference conversion (`setpoint_point_id` etc. — they are point UUIDs too)
- Use `point_id` as the key name in the output JSON (must be `point_tag`)
