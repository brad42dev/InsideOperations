---
id: DD-32-017
unit: DD-32
title: No success toast shown on workspace creation (silent success)
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-32/CURRENT.md
---

## What to Build

After a workspace is successfully created via the Console "+"/Create Workspace flow, no toast notification appears. The user completes the creation ("Create Workspace" button → configure → "Done") and the workspace tab appears, but the Notifications (F8) region remains empty. The user has no feedback that the operation succeeded.

The spec for DD-32-010 requires that a success toast appears when workspace creation succeeds, and an error toast appears when it fails. The error path now correctly shows a toast (confirmed via UAT), but the success path is silent.

## Acceptance Criteria

- [ ] When the user clicks "Create Workspace" (or "+") and completes the workspace creation by clicking "Done", a success toast appears in the Notifications region
- [ ] The success toast message is descriptive (e.g., "Workspace created", "Workspace saved", or similar — not a generic empty message)
- [ ] The success toast auto-dismisses after ~5 seconds (it is NOT an error variant)
- [ ] The toast appears within 3 seconds of clicking "Done"

## Verification Checklist

- [ ] Navigate to /console, click "+", optionally configure layout, click "Done" → success toast appears in bottom-right/notification region within 3 seconds
- [ ] Toast text contains a workspace-related success message (not just "Success" or blank)
- [ ] After ~5 seconds, the success toast auto-dismisses
- [ ] Error path still works: if backend fails, error toast appears (no regression)

## Do NOT

- Do not stub this with a TODO comment — that's what caused the failure
- Do not fire the success toast optimistically before backend confirmation (see DD-32-016 for context on the optimistic creation bug)
- Do not remove the error toast on failure (the error path is currently working)

## Dev Notes

UAT failure from 2026-03-25: Created "Workspace 1" and "Workspace 2" via the Create Workspace → Done flow. Both workspaces appeared as tabs and the UI reflected the creation. Notifications region remained empty throughout — no success toast fired.
Spec reference: DD-32-010 (saveMutation onSuccess should call showToast with success message)
