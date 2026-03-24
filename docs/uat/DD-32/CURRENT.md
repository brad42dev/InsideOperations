---
unit: DD-32
date: 2026-03-24
uat_mode: auto
verdict: partial
scenarios_tested: 7
scenarios_passed: 6
scenarios_failed: 1
scenarios_skipped: 0
---

## Module Route Check

pass: Navigating to /console loads real implementation (workspace tabs, assets palette, notifications region all present)

## Scenarios

| # | Area | Scenario | Result | Notes |
|---|------|----------|--------|-------|
| 1 | Console Route Health | [DD-32-014] Console page renders without error | ✅ pass | Workspace tabs visible, no app-level error boundary |
| 2 | Workspace Creation Toast | [DD-32-014] Create workspace via "+" shows success toast | ✅ pass | "Workspace created" toast appeared in Notifications (F8) immediately on "+" click |
| 3 | Workspace Creation Toast | [DD-32-014] Workspace tab count increments after creation | ❌ fail | "Workspaces 1" counter stayed at 1 after create; backend returned 404 on new workspace fetch; optimistic success toast fires even when backend fails |
| 4 | Notifications Panel (F8) | [DD-32-014] F8 keypress opens Notifications panel | ✅ pass | Pressing F8 set the notifications list to [active] state |
| 5 | Workspace Context Menu | [DD-32-015] Right-click workspace tab shows Duplicate option | ✅ pass | Context menu appeared with "Duplicate" menuitem |
| 6 | Workspace Context Menu | [DD-32-015] Context menu shows full CRUD actions | ✅ pass | Menu contained: Switch to Workspace, Remove from Favorites, Rename…, Duplicate, Publish, Delete |
| 7 | Workspace Duplication Toast | [DD-32-015] Duplicating a workspace shows a toast | ✅ pass | "Workspace duplicated" toast appeared in Notifications region; not silent |

## New Bug Tasks Created

DD-32-016 — Optimistic success toast fires on workspace creation even when backend returns 404

## Screenshot Notes

- Scenario 3 screenshot: docs/uat/DD-32/scenario3-fail-tab-count.png
- After clicking "+" and then "Done", the workspace tab bar still shows only "Reactor Overview" (count=1). Console logged: "Failed to load resource: 404 Not Found @ /api/v1/console/workspaces/{uuid}". The "Workspace created" toast fired before or without confirming backend success.
- Duplicate (Scenario 7) also triggered a backend 404 on the new workspace fetch, but the toast correctly appeared. The duplicate workspace similarly did not appear as a new tab.
- Login: default credentials admin/admin failed; seed credentials admin/changeme succeeded.
