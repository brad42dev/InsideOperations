---
id: DD-31-019
unit: DD-31
title: "Alert History tab missing Export button (CX-EXPORT)"
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-31/CURRENT.md
---

## What to Build

The Alert History tab is missing an Export button. UAT scenario 7 failed: "History tab shows severity filter + 'No messages found.' but NO Export button." The Export button code IS present in `index.tsx` `HistoryPanel` (lines ~1046-1103) and `AlertHistory.tsx` (line ~88-195), but is hidden behind a permission check for `alerts:export`.

## Root Cause

`alerts:export` is NOT a valid permission in the system. The RBAC design doc (doc 03) defines these alerts permissions:
- `alerts:read` — view alerts, history, templates, delivery details
- `alerts:acknowledge`
- `alerts:send`
- `alerts:send_emergency`
- `alerts:manage_templates`
- `alerts:manage_groups`
- `alerts:configure`
- `alerts:muster`

`alerts:export` does not exist. `usePermission('alerts:export')` therefore always returns `false`, and `canExport` is always `false`, so the Export button is never rendered.

## Fix

Change the permission check from `alerts:export` to `alerts:read` in both locations where the History export button is rendered:

1. `frontend/src/pages/alerts/index.tsx` — `HistoryPanel` component, line ~955:
   ```typescript
   // Change:
   const canExport = usePermission('alerts:export')
   // To:
   const canExport = usePermission('alerts:read')
   ```

2. `frontend/src/pages/alerts/AlertHistory.tsx` — line ~90:
   ```typescript
   // Change:
   const canExport = usePermission('alerts:export')
   // To:
   const canExport = usePermission('alerts:read')
   ```

The `alerts:read` permission is granted to all roles (Viewer, Operator, Analyst, Supervisor, Content Manager, Maintenance, Contractor, Admin) so any authenticated user who can see the History tab can also export from it — which matches the CX-EXPORT spec's intent for universal export availability.

## Acceptance Criteria

- [ ] Alert History tab shows an Export button
- [ ] Export button is visible to users with `alerts:read` permission (all roles)
- [ ] Clicking Export opens format dropdown (CSV, Excel, JSON at minimum)
- [ ] Export initiates without error (queued or direct download)
- [ ] `cd frontend && npx tsc --noEmit` passes

## Files to Create or Modify

- `frontend/src/pages/alerts/index.tsx` — change `usePermission('alerts:export')` → `usePermission('alerts:read')` in `HistoryPanel`
- `frontend/src/pages/alerts/AlertHistory.tsx` — change `usePermission('alerts:export')` → `usePermission('alerts:read')`

## Verification Checklist

- [ ] `cd frontend && npx tsc --noEmit` passes
- [ ] History tab Export button is visible in browser (no permission guard hiding it)
- [ ] Export dropdown opens with format options

## Do NOT

- Do not add a new `alerts:export` permission to the RBAC system (not in spec)
- Do not remove the `canExport` guard entirely — keep it, just change the permission key
- Do not modify the export API call or format list

## Dev Notes

UAT failure from 2026-03-24: "DD-31-008 fix not applied" according to UAT notes. But examining the code, the Export button code IS in `HistoryPanel` (index.tsx ~1046-1103) with `handleExport` wired up to `exportsApi.create()`. The only reason it's not visible is `canExport = usePermission('alerts:export')` returning false because `alerts:export` is not a real permission. Simple one-line fix in two files.
