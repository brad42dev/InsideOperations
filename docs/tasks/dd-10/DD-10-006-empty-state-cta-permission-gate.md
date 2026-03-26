---
id: DD-10-006
title: Gate empty-state "New Dashboard" CTA on dashboards:write permission
unit: DD-10
status: pending
priority: low
depends-on: []
---

## What This Feature Should Do

The empty state on the dashboard list page shows a "New Dashboard" button. This CTA requires `dashboards:write` permission to execute. Users who lack `dashboards:write` should see the empty state explanation but not the "Create" button. Currently the button is shown unconditionally.

## Spec Excerpt (verbatim)

> "Empty-state CTAs are permission-aware: if the CTA requires a permission the user lacks, show the description but omit the action button entirely."
> — docs/SPEC_MANIFEST.md, §CX-RBAC Non-negotiables #3

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/dashboards/index.tsx` — lines 762–779: the `<button>` for "New Dashboard" in the empty state; no permission check before rendering it

## Verification Checklist

- [ ] A user with `dashboards:write` sees the "+ New Dashboard" button in the empty state
- [ ] A user without `dashboards:write` (e.g. Viewer role) sees the empty state text but no button
- [ ] The permission check uses the existing `usePermission` hook (already imported at line 6)

## Assessment

- **Status**: ⚠️ Wrong — "New Dashboard" CTA shown to all users regardless of `dashboards:write`

## Fix Instructions

In `frontend/src/pages/dashboards/index.tsx`:

1. The file already imports `usePermission` at line 6 and uses it for `canExport` (line 335).
2. Add: `const canWrite = usePermission('dashboards:write')` alongside the existing `canExport` declaration.
3. In the empty state (lines 762–779), wrap the button with `{canWrite && (…)}`:
   ```tsx
   {!search && activeCategory === 'All' && canWrite && (
     <button onClick={() => navigate('/dashboards/new')} …>
       + New Dashboard
     </button>
   )}
   ```

Do NOT:
- Disable the button when canWrite is false — omit it entirely per the spec.
- Remove the page-level "+ New Dashboard" button in the header (line 612–626) — that button is always visible in the header and is separately gated by the route guard (`dashboards:write` PermissionGuard on `/dashboards/new`).
