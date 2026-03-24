---
unit: DD-23
date: 2026-03-24
uat_mode: auto
verdict: partial
scenarios_tested: 10
scenarios_passed: 6
scenarios_failed: 4
scenarios_skipped: 0
---

## Module Route Check

pass: Navigating to /settings/expressions loads the Expression Library with real implementation (expression list with Edit/Delete buttons, full expression builder modal)

## Scenarios

| # | Area | Scenario | Result | Notes |
|---|------|----------|--------|-------|
| 1 | Page Load | [DD-23-019] Expression library page renders without error | ✅ pass | Page loaded with 1 expression "UAT test", no error boundary |
| 2 | Insertion Cursor | [DD-23-019] Insertion cursor visible in empty workspace | ✅ pass | `generic "Insertion cursor"` element present in accessibility tree |
| 3 | Insertion Cursor | [DD-23-019] Cursor moves on click | ✅ pass | Cursor moved from after tile (e285) to before tile (e288) after clicking the tile |
| 4 | Drag into Container | [DD-23-018] Drag palette tile into container's empty zone | ❌ fail | Status bar showed "Draggable item palette-constant was dropped" but group content unchanged; tile NOT inserted inside container |
| 5 | Drag into Container | [DD-23-018] Drop into sibling gap inside container | ❌ fail | Container still empty after drag; gap drop untestable |
| 6 | Breadcrumb | [DD-23-020] No breadcrumb shown at root level | ✅ pass | No breadcrumb visible above workspace at root level (correct behavior) |
| 7 | Breadcrumb | [DD-23-020] Breadcrumb appears when entering a container | ❌ fail | Clicked inside group container (group became active, visual cursor line appeared inside), but no breadcrumb trail appeared above workspace |
| 8 | Breadcrumb | [DD-23-020] Breadcrumb navigation clickable | ❌ fail | No breadcrumb appeared so nothing to click |
| 9 | Save Checkbox | [DD-23-021] "Save for Future Use" checked by default on open | ✅ pass | Checkbox shows `[checked]` immediately on modal open before any interaction |
| 10 | Save Checkbox | [DD-23-021] Checkbox state persists through workspace changes | ✅ pass | Checkbox remained `[checked]` after adding a tile to the workspace |

## New Bug Tasks Created

DD-23-022 — Drag-and-drop from palette into group container interior still does not work
DD-23-023 — Breadcrumb trail still not shown above workspace when cursor is inside a nested container

## Screenshot Notes

- docs/uat/DD-23/scenario4-drag-fail.png: Shows workspace after drag attempt — group still empty, drag drop event fired but tile not placed inside container
- docs/uat/DD-23/group-click.png: Shows group active (teal border) with visual cursor line inside, but no breadcrumb area visible above workspace
- DD-23-019 FIXED: Insertion cursor is now visible and responsive — both scenarios 2 and 3 pass
- DD-23-021 FIXED: "Save for Future Use" checkbox is now checked by default — both scenarios 9 and 10 pass
- DD-23-018 STILL FAILING: Drag-and-drop from palette into container interior does not work; the HTML5 drag event fires ("was dropped" in status) but the tile is not placed inside the group
- DD-23-020 STILL FAILING: Breadcrumb navigation does not appear when cursor is inside a nested container
