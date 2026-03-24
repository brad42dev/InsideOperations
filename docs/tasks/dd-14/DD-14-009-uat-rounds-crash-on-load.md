---
id: DD-14-009
unit: DD-14
title: Rounds module crashes on load — pendingInstances.map is not a function
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-14/CURRENT.md
---

## What to Build

The Rounds module (/rounds) crashes immediately on load with an error boundary displaying:

> "Rounds failed to load — pendingInstances.map is not a function"

The error occurs in the RoundsPage component which calls `.map()` on `pendingInstances`. The root cause is that the API is returning a non-array value (null, undefined, or an object) for pending round instances where the UI code expects an array.

This crash blocks ALL functionality in the Rounds module — the print checklist (DD-14-004), the export button (DD-14-006), and every other rounds feature.

## Acceptance Criteria

- [ ] Navigating to /rounds loads the rounds module without an error boundary
- [ ] The rounds list (Available, In Progress, History tabs) renders correctly even with zero data
- [ ] The API response for pending instances is safely handled — if the API returns null/undefined/object instead of array, the UI should treat it as an empty array rather than crashing
- [ ] All tabs (Available, In Progress, History, Templates, Schedules) are accessible without crashes

## Verification Checklist

- [ ] Navigate to /rounds — confirm no error boundary appears
- [ ] Confirm "Available", "In Progress", "History", "Templates", "Schedules" tabs are visible and clickable
- [ ] Even if no rounds data exists, show empty state — do not crash
- [ ] Inspect the API response for `/api/v1/rounds` or equivalent — ensure it returns an array (even if empty `[]`) not null
- [ ] Add defensive fallback: `pendingInstances ?? []` or similar guard before calling `.map()`

## Do NOT

- Do not stub this with a TODO comment — the module must load
- Do not suppress the error without fixing the root cause (API shape mismatch or missing null guard)

## Dev Notes

UAT failure from 2026-03-24: Navigating to /rounds causes RoundsPage to crash with "pendingInstances.map is not a function". The Print button was briefly visible in the DOM before the error boundary replaced content, confirming the print feature is implemented — it's only this crash blocking it.
Screenshot: docs/uat/DD-14/fail-rounds-error-boundary.png
Spec reference: DD-14-004 (print checklist), DD-14-006 (export button) — both blocked by this crash.
