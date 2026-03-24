---
id: DD-32-013
unit: DD-32
title: "Alerts module ErrorBoundary shows Reload Alerts instead of Reload Module"
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-32/CURRENT.md
---

## What to Build

UAT observed the Alerts module ErrorBoundary showing "Reload Alerts" instead of the standard "Reload Module" button text. The shared `ErrorBoundary` component should show "Reload Module" regardless of which module it wraps.

## Investigation

Verify that `frontend/src/shared/components/ErrorBoundary.tsx` uses "Reload Module" as the button label (not "Reload Alerts" or any module-specific text). If the button text has already been corrected (e.g., by DD-32-009), confirm and close. If it still contains incorrect text, fix it.

## Acceptance Criteria

- [ ] `ErrorBoundary.tsx` button reads "Reload Module" (not "Reload Alerts" or any module name)
- [ ] `cd frontend && npx tsc --noEmit` passes

## Files to Create or Modify

- `frontend/src/shared/components/ErrorBoundary.tsx` — confirm or fix button label to "Reload Module"

## Verification Checklist

- [ ] Grep confirms no "Reload Alerts" string exists in the codebase
- [ ] `ErrorBoundary.tsx` button text is "Reload Module"
- [ ] TypeScript build passes

## Do NOT

- Do not add module-specific text to the reload button
- Do not change the module prop display in the error heading

## Dev Notes

UAT failure from 2026-03-24: Alerts module ErrorBoundary button showed "Reload Alerts". This issue may have been fixed already by DD-32-009. Verify current state before making any changes.
