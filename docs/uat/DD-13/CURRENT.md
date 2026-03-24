---
unit: DD-13
date: 2026-03-24
uat_mode: auto
verdict: partial
scenarios_tested: 10
scenarios_passed: 4
scenarios_failed: 6
scenarios_skipped: 0
---

## Module Route Check

partial: Navigating to /log briefly loads real implementation (heading, filter controls, tabs visible) then crashes with "(templatesData ?? []).map is not a function" error boundary consistently on every load/reload.

## Scenarios

| # | Area | Scenario | Result | Notes |
|---|------|----------|--------|-------|
| 1 | Log Module Renders | [DD-13-007] Log module loads without error | ❌ fail | Module crashes every load with "(templatesData ?? []).map is not a function" — error boundary shown |
| 2 | Log Module Renders | [DD-13-008] Log module renders schedule management section | ❌ fail | Module crashes before Templates tab is accessible |
| 3 | Log Search Filter Controls | [DD-13-007] Date filter control present | ✅ pass | "From date" and "To date" textboxes visible in initial load |
| 4 | Log Search Filter Controls | [DD-13-007] Author filter control present | ✅ pass | "Filter by author" textbox with Author placeholder visible |
| 5 | Log Search Filter Controls | [DD-13-007] Shift filter control present | ✅ pass | "Shift ID" textbox visible |
| 6 | Log Search Filter Controls | [DD-13-007] Template filter control present | ✅ pass | Combobox with "All templates" option visible |
| 7 | Log Search Filter Controls | [DD-13-007] Date filter is interactive | ❌ fail | Module crashes before interaction can be performed |
| 8 | Log Schedule Management UI | [DD-13-008] Schedule management section exists | ❌ fail | Crash blocks access to Templates tab entirely |
| 9 | Log Schedule Management UI | [DD-13-008] Schedule management shows interactive UI | ❌ fail | Cannot access due to crash |
| 10 | Log Schedule Management UI | [DD-13-008] Schedule create/edit button clickable | ❌ fail | Cannot access due to crash |

## New Bug Tasks Created

None — all failures are blocked by the existing crash tracked in pending tasks DD-13-013 and DD-13-014 ("(templatesData ?? []).map is not a function"). No new bug tasks warranted.

## Screenshot Notes

- docs/uat/DD-13/crash-templates-map.png — Error boundary: "Log failed to load / (templatesData ?? []).map is not a function"
- The crash is triggered by the templates API returning a non-array (e.g. 429 Too Many Requests response), which then hits the un-guarded .map call
- Four DD-13-007 filter controls (date, author, shift, template) ARE present and visible in the brief window before the crash confirms that DD-13-007's filter UI implementation is in place
- DD-13-008's Templates tab (schedule management) could not be verified at all — blocked entirely by the crash
