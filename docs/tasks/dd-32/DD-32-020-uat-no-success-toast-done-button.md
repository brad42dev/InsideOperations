---
id: DD-32-020
unit: DD-32
title: No success toast shown after workspace creation (Done button)
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-32/CURRENT.md
---

## What to Build

When the user clicks "+" to create a new workspace and then clicks "Done" to confirm, no success toast appears in the Notifications region. The interaction is completely silent on success — the user has no feedback that the workspace was saved.

Observed behavior: clicking "+" enters edit mode with toolbar (Undo/Redo/Clear/Rename/Publish/Done). After clicking "Done", the toolbar disappears and the page returns to normal view, but the `region "Notifications (F8)"` list remains empty.

Expected behavior: a success toast should appear in the Notifications region within 3 seconds of clicking "Done", containing a workspace-related success message (e.g., "Workspace created", "Workspace saved").

Note: An error toast does fire (correctly) when the backend returns 404 on initial creation — so the toast infrastructure works. The missing piece is firing a success toast on successful save when "Done" is clicked.

## Acceptance Criteria

- [ ] Clicking "+" then "Done" fires a success toast with a workspace-related message (not blank, not generic "Success")
- [ ] Toast appears within 3 seconds of clicking "Done"
- [ ] Toast is a success/info variant (auto-dismisses after ~5s — NOT an error variant)
- [ ] The toast is visible in the Notifications region and persists in F8 history

## Verification Checklist

- [ ] Navigate to /console, click "+", accept default layout, click "Done" → success toast appears within 3 seconds
- [ ] Toast text contains a workspace-related success message
- [ ] After ~5 seconds, the success toast auto-dismisses (it is a success variant, not error)
- [ ] Press F8 → Notifications history shows the workspace success toast

## Do NOT

- Do not stub with a setTimeout or fake success toast that fires before backend confirms
- Do not use a generic "Success" message — include workspace context

## Dev Notes

UAT failure from 2026-03-26: Clicked "+" → editing mode entered; clicked "Done" → editing mode exited; Notifications region list was empty after 3-second wait. No toast fired on the Done path.
Spec reference: DD-32-017 (workspace creation success toast requirement)
