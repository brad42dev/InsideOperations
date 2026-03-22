---
id: DD-39-007
title: Serialize expression ASTs in graphic.json during export
unit: DD-39
status: pending
priority: medium
depends-on: [DD-39-002]
---

## What This Feature Should Do

Some bindings are driven by calculated expressions (e.g., delta-T = TI-201A minus TI-201B) rather than a direct point tag. These expressions contain an AST with `tag_ref` nodes that must also be converted to portable tag names during export. The exported `graphic.json` must include an `expressions` object containing each expression's AST and description, keyed by a local expression key. Expression-bound bindings reference the expression by key rather than by `point_tag`. Without this, expression-driven bindings are silently lost on export.

## Spec Excerpt (verbatim)

> `expressions` | object | No | Expression definitions keyed by local expression key. Expression ASTs follow the format defined in doc 23.
>
> For each expression-bound element:
> - Serialize the expression AST (already JSON per doc 23)
> - Assign a local expression key
> - Replace point_id references within the AST with tag names
>
> Expression ASTs may reference point tags internally via `tag_ref` nodes. The importer walks the AST tree and resolves each `tag_ref` node's `tag` field using the same resolution logic as binding `point_tag` fields.
> — design-docs/39_IOGRAPHIC_FORMAT.md, §4 graphic.json and §8 Export Workflow

## Where to Look in the Codebase

Primary files:
- `services/api-gateway/src/handlers/iographic.rs` lines 508-676 — `export_graphic` function: expressions must be extracted from the graphic's data and added to the `graphic.json` build
- The graphic's `bindings` or `metadata` JSONB likely stores expression definitions; inspect the `design_objects` schema to confirm where expressions are stored

## Verification Checklist

Read `services/api-gateway/src/handlers/iographic.rs` and the database schema:

- [ ] `export_graphic` queries expression definitions associated with the graphic (from DB)
- [ ] For each expression, `tag_ref` nodes in the AST have their `point_id` replaced with `point_tag` (tag name)
- [ ] `graphic.json` includes an `expressions` object keyed by local expression key (e.g., `"expr-001"`)
- [ ] Binding entries that use expressions have `expression_key` (not `point_tag`) pointing to the local key
- [ ] If no expressions exist, `expressions` is an empty object `{}`

## Assessment

- **Status**: ❌ Missing
- **What needs to change**: The export function has no expression handling at all — the `expressions` key is absent from the exported `graphic.json`. This requires understanding where expressions are stored in the DB schema and extracting them.

## Fix Instructions

1. First, determine where expressions are stored. Check `design_objects.bindings` JSONB structure — if expressions are embedded in bindings as `expression_key` references with inline ASTs, they can be extracted from there. Otherwise check for a separate `design_object_expressions` table.

2. In the export flow, after building the tag resolution map (DD-39-002):
   - Walk the bindings and find all entries with `expression_key` or inline AST
   - For each expression AST, recursively replace `{ "type": "tag_ref", "point_id": "uuid" }` → `{ "type": "tag_ref", "tag": "FIC-101.PV" }` using the bulk-resolved tag map
   - Assign a stable local key (e.g., `"expr-001"`, `"expr-002"`) keyed by expression UUID or content hash
   - Build the `expressions` object

3. In `graphic.json`, include:
   ```json
   {
     ...
     "expressions": {
       "expr-001": {
         "ast": { "type": "subtract", "left": { "type": "tag_ref", "tag": "TI-201A" }, ... },
         "description": "Delta T across exchanger"
       }
     }
   }
   ```

4. In the `bindings` section, expression-bound elements use:
   ```json
   "element-id": {
     "expression_key": "expr-001",
     "attribute": "text",
     "mapping": { ... }
   }
   ```
   NOT `"point_tag"`.

Do NOT:
- Emit both `expression_key` and `point_tag` in the same binding entry — the spec says they are mutually exclusive
- Skip expressions when they contain unresolvable UUIDs — include the expression with the `<DELETED:uuid>` placeholder in tag_ref nodes instead
