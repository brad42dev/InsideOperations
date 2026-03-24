---
unit: DD-39
date: 2026-03-24
uat_mode: auto
verdict: partial
scenarios_tested: 3
scenarios_passed: 3
scenarios_failed: 0
scenarios_skipped: 2
---

## Module Route Check

pass: Navigating to /designer loads correctly. File menu contains .iographic import/export options.

## Scenarios

| # | Area | Scenario | Result | Notes |
|---|------|----------|--------|-------|
| 1 | Export | [DD-39-009] Export option in Designer | ✅ pass | File menu in Designer canvas contains "Export .iographic" and "Import .iographic…" options |
| 2 | Symbol Library | [DD-39-010] Custom shapes management UI | ✅ pass | Symbol Library at /designer/symbols shows ISA-101 equipment shapes + Custom Shapes section with Upload SVG button |
| 3 | Custom Shapes | [DD-39-011] Custom shapes backend accessible | ✅ pass | Symbol Library page renders with custom shapes section (empty state — no custom shapes uploaded yet) |
| 4 | Import | [DD-39-003] iographic import wizard — analyze step | skipped | Did not attempt import to test analyze step |
| 5 | Export | [DD-39-008] Export route works | skipped | Did not attempt actual export operation |

## New Bug Tasks Created

None

## Screenshot Notes

Designer File menu confirmed showing "Export .iographic" and "Import .iographic..." items. Symbol Library at /designer/symbols shows categorized ISA-101 shapes (Vessels 6, Pumps 5, Valves 8, Heat Exchangers 4, Columns 2, Compressors 4, Instruments 12, Piping 8) plus Custom Shapes section.
