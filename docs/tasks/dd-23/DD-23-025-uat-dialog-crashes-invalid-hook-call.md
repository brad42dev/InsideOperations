---
id: DD-23-025
unit: DD-23
title: Expression builder dialog crashes on open — Invalid hook call (duplicate React instance)
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-23/CURRENT.md
---

## What to Build

Clicking "Edit" on any expression in the Expression Library (/settings/expressions) throws a React error boundary:

> Settings failed to load
> Cannot read properties of null (reading 'useMemo')

Console errors:
- `Warning: Invalid hook call. Hooks can only be called inside a function component.` (repeated)
- `TypeError: Cannot read properties of null (reading 'useMemo')` in chunk-EMBGZOEE.js
- `[IO ErrorBoundary / Settings] TypeError: C...` in src/shared/components/ErrorBoundary.tsx

The offending chunk is `chunk-AUT5C5CZ.js` — it appears to be bundling its own copy of React, causing the classic "two copies of React" / "Invalid hook call" failure. This means the ExpressionBuilder component (or one of its dependencies recently changed) is importing React from a different path or module resolution is broken.

The error fires every time Edit is clicked, and persists after "Reload Module" (clicking Reload just restores the library list, but clicking Edit crashes again immediately).

This is a **regression** — a prior UAT session on the same date successfully opened the expression builder dialog and tested all focus-trap scenarios. A code change since that session broke the component.

## Acceptance Criteria

- [ ] Clicking Edit on an expression in /settings/expressions opens the expression builder dialog without error
- [ ] No "Invalid hook call" or "Cannot read properties of null (reading 'useMemo')" in the console when the dialog opens
- [ ] The dialog renders the expression workspace with tiles and palette
- [ ] All previously-passing scenarios from DD-23-024 still pass after fix: Escape closes dialog, ArrowLeft captured within dialog

## Verification Checklist

- [ ] Navigate to /settings/expressions, click Edit on any expression
- [ ] Confirm no error boundary fires ("Settings failed to load" must NOT appear)
- [ ] Confirm [role="dialog"] appears with workspace content visible
- [ ] Check browser console — no "Invalid hook call" or "duplicate React" warnings
- [ ] Press Escape — confirm dialog closes
- [ ] Click a tile in workspace, press ArrowLeft — confirm URL stays /settings/expressions (focus trap intact)

## Do NOT

- Do not stub the dialog with a TODO — the full expression builder must render
- Do not suppress the error boundary — fix the root cause (duplicate React import)

## Dev Notes

UAT failure 2026-03-26: Every click of "Edit" on expression rows triggers error boundary.
Root cause: chunk-AUT5C5CZ.js bundles its own React copy — check that ExpressionBuilder and all its sub-imports resolve React from the same node_modules instance. Common causes: (1) a dependency added with its own React peer dep, (2) a barrel import creating a circular reference, (3) a new dynamic import() that resolves React separately.
Console trace: chunk-AUT5C5CZ.js → chunk-EMBGZOEE.js line 19765 → ErrorBoundary.tsx line 10.
Spec reference: DD-23-024 (focus trap), DD-23-007 (save/apply OK flow both require dialog to open).
