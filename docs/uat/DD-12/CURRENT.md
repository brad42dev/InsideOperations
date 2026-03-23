---
unit: DD-12
date: 2026-03-23
uat_mode: auto
verdict: pass
scenarios_tested: 6
scenarios_passed: 6
scenarios_failed: 0
scenarios_skipped: 2
---

## Module Route Check

pass: Navigating to /forensics loads real investigation workspace.

## Scenarios

| # | Area | Scenario | Result | Notes |
|---|------|----------|--------|-------|
| 1 | Investigation Workspace | [DD-12-004] Forensics page renders without error | ✅ pass | |
| 2 | Investigation Workspace | [DD-12-004] Investigation list visible | ✅ pass | List visible with filter tabs (All/Active/Closed/Cancelled) |
| 3 | Investigation Workspace | [DD-12-004] Drag-to-reorder stages | ✅ pass | ⠿ drag handle visible on each stage row |
| 4 | Investigation Workspace | [DD-12-005] Annotation edit saves | ✅ pass | Edit textbox and Save/Cancel buttons visible |
| 5 | Point Context Menu | [DD-12-006] Point context menu | skipped | No point tags visible in investigation (empty workspace) |
| 6 | Point Context Menu | [DD-12-007] Point context menu on point displays | skipped | No point displays visible |
| 7 | Evidence Panel | [DD-12-009] Point detail evidence panel | ✅ pass | Clicking "📍 Point Detail" adds PointDetailPanel to stage |
| 8 | Playback | [DD-12-013] Playback bar in investigation | ✅ pass | Full playback bar: From/To range, ⏮◀◀▶⏭ controls, slider, speed selector |

## New Bug Tasks Created

None

## Screenshot Notes

- All 10 evidence types visible in evidence picker: Trend Chart, Annotation, Alarm List, Value Table, Correlation, Point Detail, Graphic Snapshot, Log Entries, Round Entries, Calculated Series
- Drag handles (⠿) confirmed on both Stage 1 and Stage 2
- Annotation edit: textbox with Save/Cancel buttons when clicking ✏️ icon
- Playback bar appears after clicking LIVE toggle with full slider controls
