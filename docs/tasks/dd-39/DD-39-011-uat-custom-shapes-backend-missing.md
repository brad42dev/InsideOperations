---
id: DD-39-011
unit: DD-39
title: Custom shapes backend route missing — /api/v1/shapes/user returns 404
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-39/CURRENT.md
---

## What to Build

The Symbol Library at /designer/symbols shows a "Custom Shapes" section with an "Upload SVG" button and description text. However, when the page loads, the frontend calls GET /api/v1/shapes/user which returns HTTP 404 Not Found. This causes the Custom Shapes section to display "Failed to parse server response" instead of either a proper empty state ("No custom shapes yet") or a list of uploaded shapes.

The backend route GET /api/v1/shapes/user needs to be implemented. When no custom shapes exist, it should return an empty array (HTTP 200 with `[]`) so the frontend can display a proper empty state. When shapes exist, it should return the list of user-uploaded shapes.

## Acceptance Criteria

- [ ] GET /api/v1/shapes/user returns HTTP 200 with an empty array [] when no custom shapes exist
- [ ] /designer/symbols Custom Shapes section shows an empty state message ("No custom shapes yet" or similar) when no shapes are uploaded
- [ ] No "Failed to parse server response" error shown in the Custom Shapes section

## Verification Checklist

- [ ] Navigate to /designer/symbols — Custom Shapes section shows empty state, not an error
- [ ] The empty state message is descriptive (e.g., "No custom shapes yet" or "Upload your first SVG shape")
- [ ] No 404 errors in browser console for /api/v1/shapes/user
- [ ] Upload SVG button is present and clicking it does not produce a silent no-op

## Do NOT

- Do not stub this with a TODO comment — that's what caused the failure
- Do not return 404 for an empty collection — return 200 with an empty array

## Dev Notes

UAT failure from 2026-03-23: GET /api/v1/shapes/user returns HTTP 404 Not Found.
Frontend shows "Failed to parse server response" in the Custom Shapes section of /designer/symbols.
Spec reference: DD-39-006 (shape.json sidecar), DD-39-010 (custom shapes management UI)
Screenshot: docs/uat/DD-39/scenario4-fail-custom-shapes-error-full.png
