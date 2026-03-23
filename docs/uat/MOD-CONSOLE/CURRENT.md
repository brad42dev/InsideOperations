---
unit: MOD-CONSOLE
date: 2026-03-23
uat_mode: auto
verdict: partial
scenarios_tested: 3
scenarios_passed: 2
scenarios_failed: 1
scenarios_skipped: 10
---

## Module Route Check

fail: Console module fails to load — dynamic import error for src/pages/console/index.tsx

## Scenarios

| # | Area | Scenario | Result | Notes |
|---|------|----------|--------|-------|
| 1 | Console | Console page renders | ❌ fail | 'Console failed to load: Failed to fetch dynamically imported module: src/pages/console/index.tsx' |
| 2 | Console | Favorites group in left nav | skipped | Module fails to load |
| 3 | Console | View mode selector | skipped | Module fails to load |
| 4 | Console | Detached window option | skipped | Module fails to load |
| 5 | Console | Aspect ratio lock | skipped | Module fails to load |
| 6 | Console | Playback bar speed values | skipped | Module fails to load |
| 7 | Console | Create workspace CTA | skipped | Module fails to load |
| 8 | Console | PointDetailPanel resizable | skipped | Module fails to load |
| 9 | Console | Skeleton loading state | skipped | Module fails to load |
| 10 | Console | Kiosk mode via URL param | ✅ pass | Sidebar and header controls hidden at /console?kiosk=true |
| 11 | Console | CSS design tokens | skipped | Module fails to load |
| 12 | Console | Pane error boundary | skipped | Module fails to load |
| 13 | Console | ErrorBoundary button label | ✅ pass | Error boundary shows 'Reload Module' button |

## New Bug Tasks Created

MOD-CONSOLE-014 — Console module fails to load due to dynamic import error

## Screenshot Notes

Console module has a dynamic import error. The ErrorBoundary catches it and shows 'Reload Module'. Kiosk mode and shell still work. Core module functionality inaccessible.
