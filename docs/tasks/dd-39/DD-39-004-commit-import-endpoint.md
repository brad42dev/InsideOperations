---
id: DD-39-004
title: Implement commit import endpoint with options payload and tag-based binding reconstruction
unit: DD-39
status: pending
priority: high
depends-on: [DD-39-003]
---

## What This Feature Should Do

After the user completes the wizard review, the frontend calls `POST /api/v1/design-objects/import/iographic` with both the file and a JSON `options` payload containing the user's decisions (tag mappings, shape actions, overwrite flag). The backend must reconstruct proper tag-based bindings in the database and mark unresolved tags with `unresolved: true`. The existing `/api/graphics/import` endpoint does not exist at the correct URL, does not accept the options payload, and stores raw graphic model JSON in `bindings` rather than properly reconstructed bindings.

## Spec Excerpt (verbatim)

> Phase 4: Database Write
> d. Rebuild bindings JSONB:
>    - For each binding in graphic.json.bindings:
>      - If point_tag present:
>        - Replace point_tag → point_id (UUID) using resolution map from Phase 2
>      - For unresolved (kept) tags: store binding with original tag name and `unresolved: true` marker
> g. INSERT into design_objects (new UUID, new created_by, new timestamps)
> h. INSERT into design_object_versions (version 1, draft or publish per user choice)
> i. Update design_object_points index table
>
> Phase 5: Post-Import
> 12. For graphics with unresolved bindings:
>     - Register a background watcher on points_metadata INSERT trigger
>     — design-docs/39_IOGRAPHIC_FORMAT.md, §9 Import Workflow

## Where to Look in the Codebase

Primary files:
- `services/api-gateway/src/main.rs` — add route `POST /api/v1/design-objects/import/iographic`
- `services/api-gateway/src/handlers/iographic.rs` — add `pub async fn commit_iographic(...)` handler
- `frontend/src/api/graphics.ts` lines 191-206 — `commitIographic`: submits file + options as multipart
- `frontend/src/api/graphics.ts` lines 250-257 — `IographicImportOptions` interface: the shape of the `options` JSON field
- `frontend/src/api/graphics.ts` lines 259-269 — `IographicImportResult` interface: the response shape

## Verification Checklist

Read `services/api-gateway/src/main.rs` and `services/api-gateway/src/handlers/iographic.rs`:

- [ ] Route `POST /api/v1/design-objects/import/iographic` is registered in main.rs
- [ ] Handler reads both `file` and `options` fields from multipart
- [ ] `options` is deserialized into a struct matching `IographicImportOptions` (`tag_mappings`, `shape_actions`, `stencil_actions`, `target_name`, `import_as`, `overwrite`)
- [ ] For each binding in `graphic.json.bindings`: resolves `point_tag` to UUID using the tag resolution map from `options.tag_mappings`
- [ ] Unresolved tags with action `"keep"` are stored with `unresolved: true` in the binding (not stripped)
- [ ] Skipped tags are omitted from stored bindings
- [ ] `INSERT INTO design_object_versions` is called (version 1, draft or published per `import_as` option)
- [ ] Response matches `IographicImportResult`: `{ graphics_imported, shapes_imported, stencils_imported, bindings_resolved, bindings_unresolved, bindings_total, unresolved_tags, missing_shapes, graphic_ids }`

## Assessment

- **Status**: ❌ Missing
- **What needs to change**: A new `commit_iographic` handler must be written and registered. The existing `import_graphic` at `/api/graphics/import` operates differently (no options payload, stores raw model JSON) and should not be modified — it is a legacy endpoint.

## Fix Instructions

1. Register the route in `main.rs`:
   ```rust
   .route(
       "/api/v1/design-objects/import/iographic",
       post(handlers::iographic::commit_iographic),
   )
   ```

2. Add options deserialization struct:
   ```rust
   #[derive(Debug, Deserialize)]
   struct IographicImportOptions {
       tag_mappings: Vec<TagMapping>,
       shape_actions: Vec<ShapeAction>,
       stencil_actions: Vec<StencilAction>,
       target_name: Option<String>,
       import_as: String, // "draft" or "published"
       overwrite: bool,
   }
   #[derive(Debug, Deserialize)]
   struct TagMapping { original_tag: String, mapped_tag: Option<String>, action: String }
   ```

3. Handler flow:
   - Extract `file` bytes and `options` string from multipart
   - Parse ZIP → read `graphic.json.bindings` (tag-based, post DD-39-002)
   - Build tag resolution map from `options.tag_mappings`:
     - `action: "keep"` + unresolved → store with `"unresolved": true`
     - `action: "remap"` → resolve `mapped_tag` to UUID
     - `action: "skip"` → omit from stored bindings
   - Resolve remaining auto-resolved tags by querying `points_metadata WHERE tagname = $1`
   - Reconstruct bindings JSONB with `point_id` (UUID) for resolved, `point_tag` + `"unresolved": true` for kept-unresolved
   - Check `overwrite` flag: if true and graphic with same name exists, UPDATE instead of INSERT
   - `INSERT INTO design_objects` with the new name, svg_data, reconstructed bindings
   - `INSERT INTO design_object_versions (graphic_id, version=1, version_type=import_as)`
   - Import custom shapes per `shape_actions`
   - Return `IographicImportResult` with counts

Do NOT:
- Store the raw `graphic.json` model as the `bindings` column (that is the existing bug in `import_graphic`)
- Use the existing `import_graphic` function as the implementation base — it has the wrong DB write logic
- Ignore the `import_as` field — imported graphics must create a version row so they appear in the versioning UI
