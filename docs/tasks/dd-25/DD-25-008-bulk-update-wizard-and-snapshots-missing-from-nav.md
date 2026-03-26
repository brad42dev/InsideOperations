---
id: DD-25-008
title: "Bulk update wizard and change snapshots UI missing from Settings navigation"
unit: DD-25
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-25/CURRENT.md
---

## What to Build

The Bulk Update wizard (`frontend/src/pages/settings/BulkUpdate.tsx`) and Change Snapshots page (`frontend/src/pages/settings/Snapshots.tsx`) are fully implemented with their React components and API integrations, and their routes are registered in `App.tsx` at `/settings/bulk-update` and `/settings/snapshots`. However, they do not appear in the Settings sidebar navigation (`frontend/src/pages/settings/index.tsx`), making them unreachable via the UI.

The `SUB_NAV` array in `settings/index.tsx` is missing entries for these two pages. Add them to the navigation.

## Acceptance Criteria

- [ ] "Bulk Update" link appears in the Settings sidebar and navigates to `/settings/bulk-update`
- [ ] "Change Snapshots" link appears in the Settings sidebar and navigates to `/settings/snapshots`
- [ ] Both pages render without error when navigated to directly
- [ ] No TypeScript compilation errors

## Files to Create or Modify

- `frontend/src/pages/settings/index.tsx` — add two entries to the `SUB_NAV` array:
  - `{ path: '/settings/bulk-update', label: 'Bulk Update' }`
  - `{ path: '/settings/snapshots', label: 'Change Snapshots' }`

## Verification Checklist

- [ ] TypeScript build passes: `cd frontend && npx tsc --noEmit`
- [ ] Settings sidebar shows "Bulk Update" and "Change Snapshots" nav links
- [ ] `/settings/bulk-update` renders the BulkUpdate component without error
- [ ] `/settings/snapshots` renders the Snapshots component without error

## Do NOT

- Do not modify `App.tsx` — the routes are already registered
- Do not modify `BulkUpdate.tsx` or `Snapshots.tsx`
- Do not add PermissionGuard wrapping — the App.tsx routes already have `PermissionGuard permission="system:bulk_update"`

## Dev Notes

UAT failure 2026-03-23: Tester could not find Bulk Update wizard or Change Snapshots in the Settings sidebar or elsewhere in the app. Both pages are implemented and routed but the sidebar nav entries are simply missing. Fix is a 2-line addition to `SUB_NAV` in `settings/index.tsx`.
