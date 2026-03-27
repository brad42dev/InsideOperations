---
id: DD-26-013
unit: DD-26
title: /api/recognition/models endpoint returns 404; models table never renders
status: pending
priority: high
depends-on: ["DD-26-011"]
source: uat
uat_session: docs/uat/DD-26/CURRENT.md
---

## What to Build

The `GET /api/recognition/models` endpoint returns HTTP 404 when called via the API gateway. The Settings > Recognition page uses this endpoint to populate the "Loaded Models" table, which never renders as a result. The UI silently falls back to the "No models uploaded" empty state message rather than showing an error — masking the underlying routing failure.

The models endpoint is one of the core CRUD operations for the recognition service's `ModelManager` architecture (implemented by DD-26-011). Without it, users cannot:
- See which models are currently loaded (including the domain — pid vs dcs)
- Remove a model via the Remove button
- Access the right-click context menu (View Details, Set as Active, View Feedback History)

The endpoint `GET /api/recognition/models` should return an array of `ModelInfo` objects (domain, version, filename, class_count, loaded, uploaded_at, file_size_bytes) reflecting the current state of `ModelManager.pid_domain` and `ModelManager.dcs_domain`.

## Acceptance Criteria

- [ ] `GET /api/recognition/models` returns HTTP 200 (not 404) with a JSON array in the standard API envelope `{ "success": true, "data": [...] }`
- [ ] The models table renders on /settings/recognition (even if the array is empty — empty array shows "No models uploaded" message)
- [ ] The table renders a "Domain" column header when at least one model is present
- [ ] Existing endpoints `GET /api/recognition/status` and `POST /api/recognition/models` (upload) continue to work

## Verification Checklist

- [ ] Navigate to /settings/recognition, open browser devtools Network tab — `GET /api/recognition/models` returns 200
- [ ] "Loaded Models" section renders the table header row (Domain, Filename, Version, Classes, Size, Loaded, Uploaded columns)
- [ ] If no models are loaded, the empty state "No models uploaded" message is shown (table still renders with correct structure, or empty state is intentional)
- [ ] No console errors for recognition models fetch

## Do NOT

- Do not stub with a hardcoded empty array — the endpoint must delegate to `model_manager.list_models()` so that uploaded models appear correctly
- Do not change the `ModelInfo` struct shape — the frontend expects `id`, `domain`, `version`, `filename`, `class_count`, `loaded`, `uploaded_at`, `file_size_bytes`

## Dev Notes

UAT failure from 2026-03-26: GET /api/recognition/models returns 404 in the API gateway. The Rust ModelManager implementation (DD-26-011) is in place in services/recognition-service/src/model_manager.rs. The gap is that the `/api/recognition/models` route is either not registered in the API gateway routing table or the recognition service handler for this path is missing.

Check:
- services/recognition-service/src/main.rs — are GET/models and DELETE/models/:id handlers registered?
- API gateway routing config — is /api/recognition/* proxied to the recognition service on port 3010?

The `/api/recognition/status` route works (returns 200), so the service itself is reachable. The models route specifically is missing.

Spec reference: DD-26-011 (ModelManager architecture), DD-26-012 (hot-swap per-domain model)
