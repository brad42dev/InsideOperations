---
unit: DD-23
date: 2026-03-26
uat_mode: auto
verdict: fail
scenarios_tested: 4
scenarios_passed: 1
scenarios_failed: 3
scenarios_skipped: 0
---

## Module Route Check

pass: Navigating to /settings/expressions loads real Expression Library implementation with expression list and Edit/Delete actions.

## Scenarios

| # | Area | Scenario | Result | Notes |
|---|------|----------|--------|-------|
| 1 | Access | [DD-23-024] Expression library page renders without error | ✅ pass | "Expression Library" heading loaded, 1 row ("UAT test"), no error boundary |
| 2 | Dialog | [DD-23-024] Edit button opens expression builder dialog | ❌ fail | Error boundary fires: "Settings failed to load — Cannot read properties of null (reading 'useMemo')". React Invalid hook call — duplicate React instance. Reproducible on every Edit click. |
| 3 | Focus Trap | [DD-23-024] Escape closes expression builder dialog | ❌ fail | Untestable — dialog cannot open (same root cause as scenario 2) |
| 4 | Focus Trap | [DD-23-024] Arrow keys captured inside dialog (focus trap) | ❌ fail | Untestable — dialog cannot open (same root cause as scenario 2) |

## New Bug Tasks Created

DD-23-025 — Expression builder dialog crashes on open: Invalid hook call (duplicate React instance)

## Screenshot Notes

- s2-edit-fail-hook-error.png: Error boundary "Settings failed to load — Cannot read properties of null (reading 'useMemo')" after clicking Edit on any expression. React console errors: "Warning: Invalid hook call. Hooks can only be called inside a function component." — classic duplicate React instance symptom (chunk-AUT5C5CZ.js bundling its own React copy). Reproducible 100% of the time.
- This is a regression — the previous UAT session (same date, earlier run) passed all 13 scenarios including the dialog opening and focus trap tests. A code change since that session broke the expression builder component loading.
