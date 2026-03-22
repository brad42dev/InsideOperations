---
id: DD-34-004
title: Implement stateful 6-endpoint DCS import job API
unit: DD-34
status: pending
priority: medium
depends-on: [DD-34-001]
---

## What This Feature Should Do

The spec defines a 6-endpoint stateful import API where each import is a job with an ID. The current implementation has only a single synchronous `POST /api/dcs-import` endpoint that parses and returns. The stateful design allows the wizard to pause at the tag mapping and symbol mapping steps, let the user make decisions, then submit those decisions before generating the final graphic. This is necessary because tag mapping may require the user to search I/O points and review auto-match confidence scores.

## Spec Excerpt (verbatim)

> ```
> POST   /api/designer/import/dcs           Upload extraction kit .zip or raw DCS files
> GET    /api/designer/import/dcs/:id        Get import job status and preview
> POST   /api/designer/import/dcs/:id/tags   Submit tag mapping decisions
> POST   /api/designer/import/dcs/:id/symbols  Submit symbol mapping decisions
> POST   /api/designer/import/dcs/:id/generate  Generate I/O graphic from mapped import
> GET    /api/designer/import/dcs/:id/report Get import report
> ```
> All endpoints require `designer:import` permission.
> — `34_DCS_GRAPHICS_IMPORT.md`, §API Endpoints

## Where to Look in the Codebase

Primary files:
- `services/api-gateway/src/main.rs` — line 535: only `POST /api/dcs-import` exists; the 5 additional endpoints are absent
- `services/parser-service/src/handlers/dcs_import.rs` — single synchronous handler; no job state
- `services/api-gateway/src/handlers/` — where the new stateful job handlers should live

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] `POST /api/designer/import/dcs` route exists in `main.rs` (in addition to or replacing `/api/dcs-import`)
- [ ] `GET /api/designer/import/dcs/:id` route exists
- [ ] `POST /api/designer/import/dcs/:id/tags` route exists
- [ ] `POST /api/designer/import/dcs/:id/symbols` route exists
- [ ] `POST /api/designer/import/dcs/:id/generate` route exists
- [ ] `GET /api/designer/import/dcs/:id/report` route exists
- [ ] All 6 endpoints check `designer:import` RBAC permission
- [ ] Import job state is persisted (in-memory or DB) between `POST /upload` and `/generate`

## Assessment

- **Status**: ❌ Missing
- `main.rs:535` has `POST /api/dcs-import` only. No job-scoped endpoints exist. The parser service handler at `dcs_import.rs:437` is entirely stateless/synchronous.

## Fix Instructions

This is a multi-step backend implementation. The simplest approach stores job state in memory (acceptable for Phase 12–13 scope):

1. **In api-gateway**, create `services/api-gateway/src/handlers/dcs_import.rs` with:

   ```rust
   // Job state — stored in AppState.dcs_import_jobs: Arc<RwLock<HashMap<Uuid, DcsImportJob>>>
   struct DcsImportJob {
       id: Uuid,
       user_id: Uuid,
       platform: String,
       parse_result: DcsImportResult,   // from parser-service call
       tag_mappings: Option<Vec<TagMapping>>,
       symbol_mappings: Option<Vec<SymbolMapping>>,
       created_at: chrono::DateTime<Utc>,
   }
   ```

2. **`POST /api/designer/import/dcs`** — receives multipart (same as current `POST /api/dcs-import`):
   - Check `designer:import` permission via `require_permission(&claims, "designer:import")?`
   - Forward to parser-service `/parse/dcs-import` (reuse proxy logic)
   - Create a `DcsImportJob`, store in map, return `{ "id": uuid, "status": "preview", ... }`

3. **`GET /api/designer/import/dcs/:id`** — return job's `parse_result` + current tag/symbol mapping state

4. **`POST /api/designer/import/dcs/:id/tags`** — accept body `{ "mappings": [{ "dcs_tag": "...", "io_point_id": "..." }] }`, update job

5. **`POST /api/designer/import/dcs/:id/symbols`** — accept body `{ "mappings": [{ "element_id": "...", "template_id": "..." }] }`, update job

6. **`POST /api/designer/import/dcs/:id/generate`** — call `POST /api/graphics` to create the graphic using the job's parse_result + mappings; return `{ "graphic_id": "..." }`

7. **`GET /api/designer/import/dcs/:id/report`** — return import statistics from the job

8. In `main.rs`, add all 6 routes and apply the jwt_auth middleware (already applied to all API routes by the layer at line 597).

9. Keep `POST /api/dcs-import` as a legacy/test route — do not remove it.

Do NOT:
- Store job state in the database for this phase — in-memory HashMap is sufficient
- Implement the auto-tag-matching algorithm in full (a pass-through returning empty matches is acceptable for the first cut)
- Block the generate step if tag or symbol mappings are not submitted — they should be optional
