---
id: DD-15-015
unit: DD-15
title: Groups page still shows "Failed to parse server response" — /api/groups returns 404
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-15/CURRENT.md
---

## What to Build

The Group Management page at /settings/groups displays a "Failed to parse server response" error because
the API endpoint GET /api/groups returns HTTP 404. The DD-15-013 task was marked verified but the fix
did not resolve the root cause — the /api/groups route is still missing or not registered in the API gateway.

Observed in browser console: `GET http://localhost:5173/api/groups 404 (Not Found)`

The UI shell loads correctly (heading, description, "+ Create Group" button all render), and the Create Group
dialog opens and shows a full form with roles checkboxes. Only the group list fetch is broken.

The correct behavior: GET /api/groups should return 200 with an array of groups (or an empty array `[]`
if no groups exist). The page should then display either a group list or a clean empty state.

## Acceptance Criteria

- [ ] GET /api/groups returns 200 with a group list or empty array (no 404)
- [ ] /settings/groups page loads without "Failed to parse server response" error
- [ ] When no groups exist, the page shows a clean empty state (not an error message)
- [ ] Group list populates after creating a group via the "+ Create Group" dialog

## Verification Checklist

- [ ] Navigate to /settings/groups → no red error card, no "Failed to parse server response"
- [ ] Page shows group list or clean empty state
- [ ] Create a group via "+ Create Group" → group appears in list
- [ ] No 404 in browser console for /api/groups

## Do NOT

- Do not stub this with a TODO comment — that's what caused the failure
- Do not return a 404 for a missing groups route — add the route properly
- Do not implement only the happy path — empty array [] is a valid success response

## Dev Notes

UAT failure from 2026-03-24: /api/groups returns 404. The UI shell renders correctly but the
group list area shows "Failed to parse server response" after ~3 seconds.
Screenshot: docs/uat/DD-15/fail-groups-api-404.png
Spec reference: DD-15-004 (Group Management CRUD), DD-15-012 (sidebar link), DD-15-013 (prior fix attempt)
