---
id: DD-32-015
unit: DD-32
title: No toast shown when workspace duplication fails — silent 404 error
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-32/CURRENT.md
---

## What to Build

When a workspace duplicate operation fails (e.g., the API returns a 404), the UI is completely silent — no error toast appears, no feedback is given to the user. The user sees the same screen with no indication that the action failed.

The toast/notification system (Notifications F8) is present in the DOM but is not being triggered by failed workspace CRUD operations. This was observed during UAT: right-click on "Reactor Overview" tab → "Duplicate" → backend returned 404 → UI showed nothing.

The correct behavior per spec (DD-32-007): failed operations must show a persistent error toast with a clear error message.

## Acceptance Criteria

- [ ] When workspace duplication fails (network error or API error), an error toast appears in the Notifications (F8) region
- [ ] The error toast is persistent (does not auto-dismiss) per the Toast spec
- [ ] The toast includes a meaningful message (not just "Error") identifying which operation failed
- [ ] The same toast behavior applies to all workspace CRUD failures (create, duplicate, rename, delete)

## Verification Checklist

- [ ] Navigate to /console, right-click a workspace tab → Duplicate → if backend 404s, confirm error toast appears
- [ ] Verify toast persists (does not auto-dismiss after a few seconds)
- [ ] Verify Notifications (F8) region shows the toast in history
- [ ] No silent failures for any workspace context menu operation

## Do NOT

- Do not stub this with a TODO comment — that is what caused the failure
- Do not show a generic "Error" toast without context — include the operation name
- Do not auto-dismiss error toasts — per DD-32-007 spec, error toasts must persist

## Dev Notes

UAT failure from 2026-03-24: right-click → Duplicate triggered a backend 404 (`/api/v1/console/workspaces/{id}` returned 404), but the Notifications (F8) region showed an empty list. No toast was dispatched to the toast queue.

The workspace creation silent failure is tracked separately in DD-32-014. This task specifically covers the duplication path and all workspace context menu operations.

Spec reference: DD-32-007 (Toast component enforcement), DD-32-010 (workspace creation toast)
