---
unit: DD-12
date: 2026-03-23
uat_mode: auto
verdict: partial
scenarios_tested: 6
scenarios_passed: 4
scenarios_failed: 1
scenarios_skipped: 1
---

## Module Route Check

pass: Navigating to /forensics loads real implementation — Investigations list with New Investigation button, Threshold Search, Alarm Search tabs, filter controls.

## Scenarios

| # | Area | Scenario | Result | Notes |
|---|------|----------|--------|-------|
| 1 | Forensics | [DD-12-011] Forensics page renders without error | ✅ pass | Page loads, no error boundary |
| 2 | Forensics | [DD-12-011] Investigation list shows empty state | ✅ pass | "No investigations found" with emoji and CTA |
| 3 | Investigation Toolbar | [DD-12-003] Export/Share/Print buttons in toolbar | ✅ pass | Export, Share, Print, Save, Close, Cancel all visible in investigation toolbar |
| 4 | Investigation List | [DD-12-008] Right-click on investigation list row | ✅ pass | Context menu appears with Open, Close, Cancel, Export…, Share…, Delete |
| 5 | Threshold Search | [DD-12-002] Threshold trend view accessible | ✅ pass | Threshold Search tab opens with Point, Operator, Threshold, Lookback fields; List View and Trend View buttons present |
| 6 | Investigation | [DD-12-010] Historical playback bar in forensics | ❌ fail | Investigation workspace (stages panel) has no Historical Playback Bar. Only Analysis Results panel with static buttons. |
| 7 | Point Context Menu | [DD-12-006] Point context menu on forensics tag | ⏭ skipped | No OPC points connected; no point tag displays to test on |

## New Bug Tasks Created

DD-12-013 — Historical Playback Bar missing from investigation workspace (graphic snapshot timestamp still uses no playback control)

## Screenshot Notes

Investigation workspace (created "UAT Test Investigation") shows: toolbar with Export/Share/Print/Save/Close/Cancel, Included Points panel, Stages panel ("No stages yet"), Analysis Results panel with Correlations/Heatmap/Change Points/Spikes/Run Analysis. No Historical Playback Bar component visible. Right-click context menu on investigation row works correctly with 6 actions.
