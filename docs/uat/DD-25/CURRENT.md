---
unit: DD-25
date: 2026-03-23
uat_mode: auto
verdict: partial
scenarios_tested: 3
scenarios_passed: 2
scenarios_failed: 1
scenarios_skipped: 4
---

## Module Route Check

pass: Settings loads with Export Presets link in sidebar. /settings/export-presets renders a table with Report/Preset Name/Created/Actions columns.

## Scenarios

| # | Area | Scenario | Result | Notes |
|---|------|----------|--------|-------|
| 1 | Export | [DD-25-001] Export page renders without error | ✅ pass | Export Presets page loads; table with columns Report, Preset Name, Created, Actions visible; Export CSV button present |
| 2 | Export | [DD-25-001] Export Presets table shows empty state | ✅ pass | "No export presets saved yet. Save a preset from the Reports module configuration panel." message shown |
| 3 | Export | [DD-25-003] Bulk update section accessible | ❌ fail | No bulk update wizard found — not in Settings sidebar or elsewhere in the app |
| 4 | Export | [DD-25-004] Bulk update wizard step 2 | skipped | Bulk update UI not found |
| 5 | Export | [DD-25-005] XLSX upload option | skipped | Bulk update UI not found |
| 6 | Export | [DD-25-006] Change snapshots section | skipped | Not found in any settings page |
| 7 | Export | [DD-25-007] My Exports page | skipped | Not found |

## New Bug Tasks Created

DD-25-008 — Bulk update wizard and change snapshots UI missing from Export system

## Screenshot Notes

- /settings/export-presets renders with table layout (Report, Preset Name, Created, Actions columns)
- Export CSV button visible
- 12 console errors: backend 404s for /api/reports/templates/{uuid}/presets — report template preset API not implemented
- Bulk update wizard (multi-step with Validate & Map step, XLSX upload) not found anywhere in the application
- Change snapshots feature not found
