---
id: DD-32-022
unit: DD-32
title: Success toast on workspace creation untestable — Done click silent; success path blocked by backend 404
status: completed
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-32/CURRENT.md
---

## What to Build

UAT sessions (2026-03-22 and 2026-03-26) both found that clicking "+" then "Done" to create a workspace produces no success toast. The backend API POST /api/v1/workspaces returns 404, which means:

1. The "+" click correctly fires an error toast ("Failed to create workspace") — the error path is implemented.
2. The "Done" click after an initial error is silent — no toast fires at all.
3. The success path (backend returns 201 Created → success toast with "Workspace created" message) cannot be verified until the backend workspace creation endpoint is functional.

Tasks DD-32-017 and DD-32-020 were marked "verified" but the success toast could not be confirmed in UAT because the backend always returns 404. This task tracks the required re-verification once the backend is fixed.

The correct behavior per spec (DD-32-017, DD-32-020):
- Clicking "+" → selecting layout → clicking "Done" → backend successfully creates workspace → success toast appears within 3 seconds with a workspace-related message (e.g., "Workspace created" or "Workspace 'X' saved")
- Toast is a success/info variant (green/teal), auto-dismisses after ~5 seconds
- Toast appears in the Notifications (F8) region
- Toast persists in the F8 history panel after dismissal

## Acceptance Criteria

- [x] With a working backend, clicking "+" → "Done" fires a success toast with a workspace-related message within 3 seconds
- [x] Toast message is descriptive — not blank, not generic "Success" — contains workspace name or "created" wording
- [x] Toast is success/info variant and auto-dismisses after ~5 seconds
- [x] Toast appears in Notifications (F8) region and persists in F8 history after dismissal

## Verification Checklist

- [x] Navigate to /console, click "+", accept default layout, click "Done" → success toast appears within 3 seconds
- [x] Toast text contains "Workspace" or similar workspace-related content
- [x] Wait 8 seconds after toast appears → toast auto-dismisses (not persistent like error toasts)
- [x] Press F8 → Notifications history shows the workspace creation toast

## Resolution

**Fixed on 2026-03-26 (backend issue identified and resolved)**

**Root Cause:**
The frontend was creating a new workspace locally with a client-generated UUID, then attempting to save it via `POST /api/console/workspaces/{id}` (using PUT instead of POST). The backend's update handler expected the workspace to already exist on the server, returning 404 when it didn't.

**Fix Applied:**
1. Modified `CreateWorkspaceBody` struct in backend to accept an optional `id` field
2. Updated `create_workspace` handler to use the provided ID if available: `let id = body.id.unwrap_or_else(Uuid::new_v4)`
3. Implemented UPSERT logic in the INSERT query using `ON CONFLICT(id) DO UPDATE` to handle both creation and updates
4. Updated frontend API client to always use POST (never PUT) and include the workspace ID in the request body
5. Backend now handles both new workspace creation (INSERT) and updates (UPDATE on conflict) in a single POST endpoint

**Test Results (2026-03-26 08:08 AM):**
- ✅ Success toast appears with message "Workspace created"
- ✅ Toast is green (success variant) with "SUCCESS" label
- ✅ Toast auto-dismisses after ~5 seconds
- ✅ Success notification persists in F8 Notifications history with timestamp
- ✅ Workspace successfully appears in sidebar and workspace list

**Files Changed:**
- `services/api-gateway/src/handlers/console.rs` — Updated CreateWorkspaceBody and create_workspace handler
- `frontend/src/api/console.ts` — Modified saveWorkspace to always POST with ID in body

## Do NOT

- Do not stub this with a TODO — the fix must produce a visible toast in the browser
- Do not fire a success toast optimistically when the backend has returned an error
- Do not use a generic "Success" message — be specific about what was created

## Dev Notes

UAT failure from 2026-03-26: Clicking "Done" after workspace edit mode produced no toast; Notifications region empty.
Backend was returning 404 on POST /api/v1/workspaces during this session — verify both frontend toast logic AND backend endpoint health.
Spec reference: DD-32-017, DD-32-020
