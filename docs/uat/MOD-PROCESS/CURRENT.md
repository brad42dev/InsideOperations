---
unit: MOD-PROCESS
date: 2026-03-26
uat_mode: auto
verdict: partial
scenarios_tested: 16
scenarios_passed: 12
scenarios_failed: 4
scenarios_skipped: 0
---

## Module Route Check

✅ pass: Navigating to /process loads real implementation — sidebar with Views/Bookmarks/Navigation, view toolbar, status bar all present. No error boundary.

## Scenarios

| # | Area | Scenario | Result | Notes |
|---|------|----------|--------|-------|
| 1 | Data Flow | [MOD-PROCESS-002] Page loads without error boundary | ✅ pass | Sidebar loads graphics list; ⚠️ seed data status unknown |
| 2 | Data Flow | [MOD-PROCESS-002] Sidebar navigation visible | ✅ pass | Views, Bookmarks, Navigation, Recent Views sections present |
| 3 | Toolbar | [MOD-PROCESS-014] Print button visible | ✅ pass | "Print" button present in view toolbar, right of Export |
| 4 | Toolbar | [MOD-PROCESS-014] Print button consistent styling | ✅ pass | Screenshot confirms consistent dark-theme button styling |
| 5 | Toolbar | [MOD-PROCESS-005] Export split button visible | ✅ pass | "Export" + "Choose export format" split button present |
| 6 | Toolbar | [MOD-PROCESS-015] ★ bookmark button visible | ✅ pass | ★ button present in view toolbar |
| 7 | Bookmark | [MOD-PROCESS-015] Clicking ★ opens Name/Description dialog | ❌ fail | Click only toggles button active state — no dialog appeared; expected [role="dialog"] with Name input |
| 8 | Kiosk | [MOD-PROCESS-019] Kiosk hides breadcrumb nav bar | ❌ fail | Banner with "Process" heading still rendered at top in kiosk mode; expected hidden |
| 9 | Kiosk | [MOD-PROCESS-019] Kiosk hides view toolbar | ✅ pass | Zoom controls, Live/Historical, Export, Print NOT rendered |
| 10 | Kiosk | [MOD-PROCESS-007] Kiosk hides sidebar | ✅ pass | Left sidebar (complementary) NOT rendered in kiosk mode |
| 11 | Kiosk | [MOD-PROCESS-007] Escape exits kiosk mode | ✅ pass | Full UI chrome (sidebar, top bar, toolbar) restored after Escape |
| 12 | Detached | [MOD-PROCESS-016] Detached route renders | ✅ pass | /detached/process/test-view-id loads; "View not found" shown (no 404, no error boundary) |
| 13 | Detached | [MOD-PROCESS-016] Detached route has no app chrome | ✅ pass | No sidebar, no module switcher, no app top bar; thin title bar with time/status/controls |
| 14 | Minimap | [MOD-PROCESS-017] Minimap toggle button visible | ❌ fail | No Map/Minimap button in main process toolbar; M key no effect; detached view has "Map" button but main view doesn't |
| 15 | Minimap | [MOD-PROCESS-017] Minimap state persists across reload | ❌ fail | Cannot test — minimap toggle not accessible in main process view |
| 16 | Design Tokens | [MOD-PROCESS-018] No color artifacts in dark theme | ✅ pass | Status dot, Live button, UI all use consistent dark theme colors; no jarring hardcoded hex colors visible |

## New Bug Tasks Created

MOD-PROCESS-021 — Bookmark ★ button does not open Name/Description dialog
MOD-PROCESS-022 — Kiosk mode leaves breadcrumb nav bar ("Process" header) visible
MOD-PROCESS-023 — No minimap toggle button in main Process view toolbar

## Screenshot Notes

- s7-bookmark-no-dialog.png: ★ button clicked, turned active (gold/highlighted) — no dialog, no modal appeared
- s8-kiosk-breadcrumb-present.png: Kiosk mode at /process?kiosk=true — thin "Process" bar still visible at very top
- process-graphic-selected.png: "Air Cooler / Fin-Fan" selected — blank canvas (no backend), no minimap visible
- ⚠️ Seed data status: UNAVAILABLE — psql not accessible; data flow evaluated on structural basis only
- MOD-PROCESS-015: S15 (persistence) failed as dependent on S14; both attributed to minimap toggle absence
