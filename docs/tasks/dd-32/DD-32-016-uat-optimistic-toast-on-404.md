---
id: DD-32-016
unit: DD-32
title: Optimistic success toast fires on workspace creation even when backend returns 404
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-32/CURRENT.md
---

## What to Build

After clicking "+" to create a new workspace in the Console, a "Workspace created" toast fires immediately — even when the backend returns a 404 on the subsequent workspace fetch. The workspace tab count does not increment and no new tab appears, yet the user sees a success toast. This is a false-positive notification.

The same issue was observed for Duplicate: a "Workspace duplicated" toast appeared, but the backend returned 404 and no new tab appeared.

Expected behavior: the success toast should only fire after the backend confirms the workspace was persisted. If the backend returns an error (4xx/5xx), an error toast should appear instead.

UAT scenario that failed: Scenario 3 — "Workspace tab count increments after creation" — tab count stayed at 1, console logged 404 on `/api/v1/console/workspaces/{uuid}`.

## Acceptance Criteria

- [ ] After clicking "+" and completing workspace creation, the success toast only fires when the backend confirms the workspace exists (2xx response)
- [ ] If the backend returns an error, an error toast appears with the failure reason (not a silent failure and not a false success)
- [ ] The workspace tab count increments by 1 after a successful creation
- [ ] The same behavior applies to Duplicate — toast only fires on confirmed backend success

## Verification Checklist

- [ ] Navigate to /console, click "+", click "Done" → if backend succeeds: success toast + new tab appears + Workspaces count increments
- [ ] If backend fails: error toast appears, no new tab, count unchanged
- [ ] Right-click workspace → Duplicate → same toast/count behavior as creation
- [ ] No optimistic "success" toasts that fire before backend confirmation

## Do NOT

- Do not keep optimistic toasts that fire before API response — this misleads users about operation success
- Do not suppress toasts entirely — failures must still be reported

## Dev Notes

UAT failure from 2026-03-24: After clicking "+" then "Done", "Workspace created" toast fired but console logged:
  "Failed to load resource: 404 Not Found @ /api/v1/console/workspaces/{uuid}"
  Workspace tab count remained at 1; no new tab appeared in the UI.
Spec reference: DD-32-014 (workspace creation toast), DD-32-015 (duplicate toast)
Screenshot: docs/uat/DD-32/scenario3-fail-tab-count.png
