---
id: DD-39-012
unit: DD-39
title: /api/v1/shapes/user returns 404 — Custom Shapes section shows error instead of empty state
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-39/CURRENT.md
---

## What to Build

The Custom Shapes section on `/designer/symbols` displays "Failed to parse server response" in red text because the backend route `GET /api/v1/shapes/user` returns HTTP 404 — the route is not implemented. The UI gets stuck attempting to display the error rather than showing a proper empty state.

Two things must be fixed:
1. **Backend:** Implement `GET /api/v1/shapes/user` to return `HTTP 200` with an empty JSON array `[]` when no custom shapes have been uploaded.
2. **Frontend:** The Custom Shapes section must handle the case where no shapes exist by displaying a friendly empty state (e.g. "No custom shapes yet" or "Upload your first SVG shape") rather than a raw error message.

## Acceptance Criteria

- [ ] GET /api/v1/shapes/user returns HTTP 200 with body `[]` when no custom shapes exist
- [ ] /designer/symbols Custom Shapes section shows an empty state message when no shapes are uploaded
- [ ] No "Failed to parse server response" error shown in the Custom Shapes section
- [ ] The empty state message is descriptive (e.g. "No custom shapes yet" or "Upload your first SVG shape")

## Verification Checklist

- [ ] Navigate to /designer/symbols — Custom Shapes section shows empty state, not "Failed to parse server response"
- [ ] Run `curl -s http://localhost:3000/api/v1/shapes/user` with a valid JWT → returns 200 with `[]`
- [ ] No 404 errors in browser console for /api/v1/shapes/user
- [ ] Upload SVG button remains present and clickable in the empty state

## Do NOT

- Do not stub this with a TODO comment or a hardcoded empty array in the frontend only — the backend route must actually exist
- Do not suppress the error silently; replace it with a proper empty-state UI component

## Dev Notes

UAT failure from 2026-03-23: Navigating to /designer/symbols shows "Failed to parse server response" in the Custom Shapes section. Browser console shows two 404 errors for /api/v1/shapes/user. Curl test confirms HTTP 404.

Spec reference: DD-39-011 (Custom shapes backend route missing — /api/v1/shapes/user returns 404)
Screenshot: docs/uat/DD-39/fail-custom-shapes-error-section.png
