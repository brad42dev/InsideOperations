---
id: DD-39-003
title: Implement analyze endpoint for iographic import wizard
unit: DD-39
status: pending
priority: high
depends-on: []
---

## What This Feature Should Do

The import wizard (Step 1 → "Analyze") calls `POST /api/v1/design-objects/import/iographic/analyze` with the uploaded file. The backend must parse the ZIP, validate the manifest, resolve all point tags against the local `points_metadata` table, check shape availability, and return a structured `IographicAnalysis` response. The wizard then shows the user which tags resolved, which are ambiguous, and which are unresolved — before any data is written to the database. Without this endpoint the "Analyze" button always fails.

## Spec Excerpt (verbatim)

> Phase 2: Dependency Analysis and Shape/Stencil Import
> 10. Point tag resolution:
>     For each tag in manifest.point_tags:
>       - Search points_metadata WHERE tagname = <tag>
>       - If exactly 1 match → ✅ Auto-resolved (store UUID)
>       - If multiple matches (different sources) → ⚠️ Ambiguous (use source_hint to narrow; if still ambiguous, present picker)
>       - If 0 matches → ❌ Unresolved
>
> Phase 3: Import Wizard UI — Step 1 Package Overview: Summary: "3 graphics, 12 shapes needed (2 custom), 1 stencil, 47 point tags"
> — design-docs/39_IOGRAPHIC_FORMAT.md, §9 Import Workflow

## Where to Look in the Codebase

Primary files:
- `services/api-gateway/src/main.rs` — add route: `POST /api/v1/design-objects/import/iographic/analyze`
- `services/api-gateway/src/handlers/iographic.rs` — add `pub async fn analyze_iographic(...)` function
- `frontend/src/api/graphics.ts` line 177 — the URL the frontend calls: `/api/v1/design-objects/import/iographic/analyze`
- `frontend/src/api/graphics.ts` lines 241-248 — `IographicAnalysis` TypeScript interface: return shape must match

## Verification Checklist

Read `services/api-gateway/src/main.rs` and `services/api-gateway/src/handlers/iographic.rs`:

- [ ] Route `POST /api/v1/design-objects/import/iographic/analyze` is registered in main.rs
- [ ] Handler reads multipart `file` field, parses ZIP, reads manifest.json
- [ ] Handler validates `format == "iographic"` and rejects with error if not
- [ ] Handler verifies checksum and includes failure in `errors` if it fails (non-fatal — still returns analysis)
- [ ] For each tag in `manifest.point_tags`: queries `points_metadata` and classifies as `resolved` / `ambiguous` / `unresolved`
- [ ] For each `shape_id` in `manifest.shape_dependencies`: checks local `design_objects` table and classifies as `available` / `missing` / `custom_new` / `custom_exists`
- [ ] Response matches `IographicAnalysis` interface: `{ manifest, tag_resolutions, shape_statuses, stencil_statuses, valid, errors }`

## Assessment

- **Status**: ❌ Missing
- **What needs to change**: A new `analyze_iographic` handler function must be written and the route registered. The frontend TypeScript interface at graphics.ts:241-248 defines the exact response shape expected.

## Fix Instructions

1. In `main.rs`, add the route before the existing `/api/graphics/import` route:
   ```rust
   .route(
       "/api/v1/design-objects/import/iographic/analyze",
       post(handlers::iographic::analyze_iographic),
   )
   ```

2. Implement `pub async fn analyze_iographic(State(state): State<AppState>, Extension(claims): Extension<Claims>, mut multipart: Multipart) -> impl IntoResponse` in `iographic.rs`:
   - Extract file bytes from multipart `file` field (same as current `import_graphic`)
   - Parse ZIP and read `manifest.json` → `IographicManifest`
   - Validate format field
   - Verify checksum: re-read all files except manifest.json sorted by path, compute SHA-256, compare
   - For each `point_tag` in `manifest.point_tags`:
     ```sql
     SELECT pm.id, pm.tagname, ps.name AS source
     FROM points_metadata pm
     JOIN point_sources ps ON pm.source_id = ps.id
     WHERE pm.tagname = $1
     ```
     If 0 rows → `unresolved`. If 1 row → `resolved` with `resolved_to: UUID`. If >1 rows → `ambiguous` with `candidates: [...]`.
   - For each `shape_id` in `manifest.shape_dependencies`:
     If `.custom.*` → query `design_objects WHERE type='shape' AND metadata->>'shape_id' = $1` → `custom_new` or `custom_exists`
     Otherwise → same query → `available` or `missing`
   - Build and return `IographicAnalysis` JSON.

3. Response type to serialize (must match TypeScript `IographicAnalysis` interface at graphics.ts:241):
   ```rust
   #[derive(Serialize)]
   struct IographicAnalysis {
       manifest: IographicManifest,
       tag_resolutions: Vec<TagResolution>,
       shape_statuses: Vec<ShapeStatus>,
       stencil_statuses: Vec<StencilStatus>,
       valid: bool,
       errors: Vec<String>,
   }
   ```

Do NOT:
- Write any database rows in this endpoint — analyze is read-only
- Return an error when tags are unresolved — that is an expected condition returned in the `tag_resolutions` array, not a 4xx response
- Confuse the existing `/api/graphics/import` endpoint with this endpoint — they are separate
