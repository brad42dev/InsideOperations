---
id: DD-06-017
unit: DD-06
title: ErrorBoundary button uses module-specific text instead of "Reload Module"
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-06/CURRENT.md
---

## What to Build

The ErrorBoundary component in the app shell should display "Reload Module" as the button label. In UAT, the Alerts module error boundary displayed "Reload Alerts" instead of the canonical "Reload Module" text. All module error boundaries must use the same standardized label.

## Acceptance Criteria

- [ ] All module ErrorBoundary components display "Reload Module" as the button label
- [ ] No module uses a module-specific label (e.g., "Reload Alerts", "Reload Console")

## Verification Checklist

- [ ] Trigger an error boundary in any module → button reads "Reload Module"
- [ ] Check all ErrorBoundary component instances across modules for consistent label

## Do NOT

- Do not stub this with a TODO comment — that's what caused the failure
- Do not implement only for one module — fix all modules consistently

## Dev Notes

UAT failure from 2026-03-24: DD-32 scenario testing found "Reload Alerts" on the Alerts module error boundary. The canonical text per spec is "Reload Module".
Spec reference: DD-06-009 (error boundary standard), DD-32-013 (Alerts specific)
