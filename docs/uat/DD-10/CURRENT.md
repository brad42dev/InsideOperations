---
unit: DD-10
date: 2026-03-23
uat_mode: auto
verdict: partial
scenarios_tested: 4
scenarios_passed: 3
scenarios_failed: 1
scenarios_skipped: 5
---

## Module Route Check

✅ pass: Navigating to /dashboards loads dashboard list with multiple dashboard cards

## Scenarios

| # | Area | Scenario | Result | Notes |
|---|------|----------|--------|-------|
| 1 | Dashboard List | [DD-10-001] Dashboard list renders | ✅ pass | Page loads with 9 dashboard cards, category filters, search input |
| 2 | Dashboard List | [DD-10-003] Export button in toolbar | ✅ pass | "Export ▾" button visible in dashboard list toolbar |
| 3 | Dashboard List | [DD-10-004] Publish checkbox visible | ✅ pass | Dashboard cards show "Published" badge; publish checkbox visible in card details |
| 4 | Dashboard Viewer | [DD-10-002] Widget kebab menu export | ❌ fail | Could not open a dashboard to test widget kebab menu — API returns 404 for existing dashboards |
| 5 | Dashboard Viewer | [DD-10-005] Point context menu on values | skipped | Cannot access dashboard viewer |
| 6 | Dashboard Viewer | [DD-10-006] Widget config aggregation type | skipped | Cannot access dashboard viewer |
| 7 | Dashboard Viewer | [DD-10-007] UOM conversion in values | skipped | Cannot access dashboard viewer |
| 8 | Dashboard Viewer | [DD-10-008] Playback bar in time-context | skipped | Cannot access dashboard viewer |
| 9 | Theme | [DD-10-009] No hardcoded hex colors | skipped | Cannot verify from list page alone |

## New Bug Tasks Created

None

## Screenshot Notes

Dashboard list page works. Cards show: title, description, category tags, Published badge, kebab (⋯) menu button. Playlist section visible at bottom. Dashboard viewer not testable due to 404 API responses.
