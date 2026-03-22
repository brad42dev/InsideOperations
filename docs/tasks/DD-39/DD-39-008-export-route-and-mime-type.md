---
id: DD-39-008
title: Fix export route path, HTTP method, and MIME type
unit: DD-39
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The frontend export dialog calls `POST /api/v1/design-objects/{id}/export/iographic` with a JSON body containing `description`. The backend registers `GET /api/graphics/:id/export` — wrong path prefix (`/api/graphics` vs `/api/v1/design-objects`), wrong HTTP method (`GET` vs `POST`), and wrong sub-path (`/export` vs `/export/iographic`). Additionally, the response uses `Content-Type: application/zip` instead of the MIME type specified by doc 39. All of these must be corrected so the export button in the Designer actually works.

## Spec Excerpt (verbatim)

> MIME Type: `application/vnd.insideops.iographic+zip`
>
> User initiates export from:
> - **Designer**: File → Export → `.iographic` (single graphic)
> — design-docs/39_IOGRAPHIC_FORMAT.md, §1 Format Overview and §8 Export Workflow

## Where to Look in the Codebase

Primary files:
- `services/api-gateway/src/main.rs` lines 228-230 — current route: `GET /api/graphics/:id/export`
- `services/api-gateway/src/handlers/iographic.rs` lines 509-513 — `export_graphic` function signature: currently `GET`, no body
- `services/api-gateway/src/handlers/iographic.rs` line 671 — `Content-Type: application/zip`: must change to `application/vnd.insideops.iographic+zip`
- `frontend/src/api/graphics.ts` lines 162-171 — `exportIographic`: calls `POST /api/v1/design-objects/{id}/export/iographic` with description body

## Verification Checklist

Read `services/api-gateway/src/main.rs` and `iographic.rs`:

- [ ] Route is registered as `POST /api/v1/design-objects/:id/export/iographic`
- [ ] Handler accepts an optional JSON body with `description: Option<String>` and uses it when building the manifest
- [ ] Response `Content-Type` header is `application/vnd.insideops.iographic+zip`
- [ ] Frontend call at graphics.ts:163 (`/api/v1/design-objects/${id}/export/iographic`) matches the registered route

## Assessment

- **Status**: ⚠️ Wrong
- **What needs to change**: Three things: (1) route path and method, (2) MIME type header, (3) handler must accept a POST body to receive `description`.

## Fix Instructions

1. In `main.rs`, replace:
   ```rust
   .route(
       "/api/graphics/:id/export",
       get(handlers::iographic::export_graphic),
   )
   ```
   With:
   ```rust
   .route(
       "/api/v1/design-objects/:id/export/iographic",
       post(handlers::iographic::export_graphic),
   )
   ```

2. Change `export_graphic` signature to accept a POST body:
   ```rust
   #[derive(Debug, Deserialize)]
   pub struct ExportIographicBody {
       pub description: Option<String>,
   }

   pub async fn export_graphic(
       State(state): State<AppState>,
       Extension(claims): Extension<Claims>,
       Path(id): Path<Uuid>,
       Json(body): Json<ExportIographicBody>,
   ) -> impl IntoResponse {
   ```
   Use `body.description` when constructing the manifest (set `manifest.description = body.description`).

3. Change the Content-Type at iographic.rs line 671:
   ```rust
   response.headers_mut().insert(
       header::CONTENT_TYPE,
       HeaderValue::from_static("application/vnd.insideops.iographic+zip"),
   );
   ```

4. If the old `GET /api/graphics/:id/export` route needs to stay for backward compatibility, keep it as a redirect or alias — but the new route must exist at the correct path.

Do NOT:
- Remove the route from main.rs without adding the new one — that would break all export functionality
- Change the handler to require the JSON body (use `Option<Json<ExportIographicBody>>` if backward compat with GET callers is needed)
