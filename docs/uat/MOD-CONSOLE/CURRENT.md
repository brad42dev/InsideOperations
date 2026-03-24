---
unit: MOD-CONSOLE
date: 2026-03-24
uat_mode: auto
verdict: partial
scenarios_tested: 6
scenarios_passed: 4
scenarios_failed: 2
scenarios_skipped: 6
---

## Module Route Check

pass: Navigating to /console loads real implementation — workspace tabs, left nav panel, pane layout visible.

## Scenarios

| # | Area | Scenario | Result | Notes |
|---|------|----------|--------|-------|
| 1 | Loading | [MOD-CONSOLE-014] Console module loads | ✅ pass | /console loads without dynamic import error — workspace tabs and content visible |
| 2 | Navigation | [MOD-CONSOLE-001] Left nav panel renders | ✅ pass | Left navigation panel visible with workspace list and graphics list |
| 3 | Navigation | [MOD-CONSOLE-001] Favorites group in left nav | ❌ fail | No Favorites group/section visible in left nav panel — only Workspaces and Graphics tabs |
| 4 | Workspace | [MOD-CONSOLE-003] Aspect ratio lock per-workspace | skipped | Workspace settings not tested in detail this session |
| 5 | Playback | [MOD-CONSOLE-004] Historical Playback Bar | ✅ pass | Playback bar visible at bottom with LIVE button and "Click to enter historical playback" text |
| 6 | RBAC | [MOD-CONSOLE-006] Create Workspace CTA gated | skipped | RBAC gating not tested |
| 7 | Panel | [MOD-CONSOLE-007] PointDetailPanel resizable/pinnable | skipped | PointDetailPanel not opened in this session |
| 8 | Playback | [MOD-CONSOLE-008] Playback bar speed options | skipped | Did not enter historical playback to check speed options |
| 9 | Error | [MOD-CONSOLE-009] ErrorBoundary button label | skipped | No error boundary triggered in Console module |
| 10 | Loading | [MOD-CONSOLE-010] Loading skeleton | ✅ pass | Module-shaped skeleton shown during initial load (not plain text "Loading workspaces...") |
| 11 | Kiosk | [MOD-CONSOLE-011] Kiosk mode URL parameter | ❌ fail | ?kiosk=true parameter did not activate kiosk mode — navigation and header remained visible |
| 12 | Tokens | [MOD-CONSOLE-013] Design token colors | skipped | Not browser-testable without source inspection |

## New Bug Tasks Created

MOD-CONSOLE-016 — Favorites group missing from console left nav panel
MOD-CONSOLE-017 — Console kiosk mode URL parameter not activating kiosk UI

## Screenshot Notes

Left nav confirmed showing "Workspaces" and "Graphics" tabs but no Favorites group. Playback bar confirmed at bottom of console view. Kiosk mode via ?kiosk=true did not hide navigation/header — ?mode=kiosk also did not work.
