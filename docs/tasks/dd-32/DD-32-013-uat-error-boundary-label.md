---
id: DD-32-013
unit: DD-32
title: Alerts module ErrorBoundary shows "Reload Alerts" instead of "Reload Module"
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-32/CURRENT.md
---

## What to Build

The ErrorBoundary component in the Alerts module shows "Reload Alerts" as its button label. The canonical label per spec is "Reload Module". All module error boundaries must use the standardized "Reload Module" text to ensure consistency across the application.

## Acceptance Criteria

- [ ] The Alerts module ErrorBoundary displays "Reload Module" as the button label
- [ ] No module-specific text ("Reload Alerts", "Reload Console", etc.) appears on ErrorBoundary buttons

## Verification Checklist

- [ ] Trigger an error in the Alerts module → error boundary button reads "Reload Module" not "Reload Alerts"
- [ ] Search codebase for "Reload Alerts" — should return no results after fix

## Do NOT

- Do not stub this with a TODO comment — that's what caused the failure
- Do not fix only Alerts — check all modules for the same issue

## Dev Notes

UAT failure from 2026-03-24: The Alerts module error boundary (triggered by the templates.find crash) shows "Reload Alerts" instead of "Reload Module". This is a spec violation for the shared ErrorBoundary standard.
Spec reference: DD-32-001 (ErrorBoundary standard), DD-06-009 (global error boundary spec)
