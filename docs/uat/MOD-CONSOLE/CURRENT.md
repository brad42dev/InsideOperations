---
unit: MOD-CONSOLE
date: 2026-03-23
uat_mode: auto
verdict: fail
scenarios_tested: 5
scenarios_passed: 2
scenarios_failed: 3
scenarios_skipped: 8
---

## Module Route Check

❌ fail: Navigating to /console loads an error boundary — "Console failed to load / Cannot read properties of undefined (reading 'reduce')"

## Scenarios

| # | Area | Scenario | Result | Notes |
|---|------|----------|--------|-------|
| 1 | Console Module | [MOD-CONSOLE-014] Console module loads | ❌ fail | Error boundary: "Console failed to load / Cannot read properties of undefined (reading 'reduce')" |
| 2 | Console Module | [MOD-CONSOLE-009] ErrorBoundary button label | ❌ fail | Button reads "Reload Console" not "[Reload Module]" |
| 3 | Console Module | [MOD-CONSOLE-010] Loading skeleton state | ❌ fail | Module crashes immediately — no loading skeleton visible |
| 4 | Console Module | [MOD-CONSOLE-006] Empty state CTA gated | skipped | Module crashes before rendering any content |
| 5 | Kiosk | [MOD-CONSOLE-011] Kiosk URL ?kiosk=true | ❌ fail | ?kiosk=true does NOT activate kiosk mode (sidebar still shows); ?mode=kiosk does work |
| 6 | Workspace | [MOD-CONSOLE-002] Detach pane to window | skipped | Module crashes |
| 7 | Workspace | [MOD-CONSOLE-003] Aspect ratio lock | skipped | Module crashes |
| 8 | Workspace | [MOD-CONSOLE-004] Playback bar controls | skipped | Module crashes |
| 9 | Workspace | [MOD-CONSOLE-005] Pane error boundaries | ✅ pass | Error boundary IS working — it caught the TypeError crash |
| 10 | Workspace | [MOD-CONSOLE-007] PointDetailPanel resizable | skipped | Module crashes |
| 11 | Workspace | [MOD-CONSOLE-008] Playback bar loop region | skipped | Module crashes |
| 12 | Workspace | [MOD-CONSOLE-012] Nested per-pane boundaries | ✅ pass | Error boundary caught crash — nested boundary working |
| 13 | Workspace | [MOD-CONSOLE-013] No hardcoded hex colors | skipped | Module crashes |

## New Bug Tasks Created

MOD-CONSOLE-015 — Console module crashes with TypeError reading 'reduce' on workspaces selector

## Screenshot Notes

Screenshot saved: docs/uat/MOD-CONSOLE/console-error.png
The console module crashes with "Cannot read properties of undefined (reading 'reduce')" — likely a data store issue where useSelector or useStore returns undefined. The error boundary catches it and shows "Reload Console" (should read "[Reload Module]"). Kiosk via ?kiosk=true doesn't work; ?mode=kiosk does.
