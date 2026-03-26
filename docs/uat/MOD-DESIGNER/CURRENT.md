---
unit: MOD-DESIGNER
date: 2026-03-26
uat_mode: auto
verdict: partial
scenarios_tested: 14
scenarios_passed: 10
scenarios_failed: 4
scenarios_skipped: 0
---

## Module Route Check

✅ pass: Navigating to /designer loads real implementation — toolbar, palette, canvas visible; no error boundary.

## Scenarios

| # | Area | Scenario | Result | Notes |
|---|------|----------|--------|-------|
| 1 | Designer Page Load | [MOD-DESIGNER-038] Designer page renders without error | ✅ pass | Toolbar, palette, canvas all visible; no error boundary |
| 2 | Designer Page Load | [MOD-DESIGNER-038] New graphic canvas loads cleanly | ✅ pass | /designer/graphics/new creates canvas; no 429 error |
| 3 | Multi-Tab File Management | [MOD-DESIGNER-037] File→New creates a second tab | ✅ pass | Two tabs visible in tablist "Open graphics" after creating second graphic |
| 4 | Multi-Tab File Management | [MOD-DESIGNER-037] Tab switching between graphics | ✅ pass | Clicking first tab switches canvas without error |
| 5 | Palette Tile Right-Click | [MOD-DESIGNER-043] Palette tile right-click shows context menu | ✅ pass | [role="menu"] appeared; no element placed on canvas |
| 6 | Palette Tile Right-Click | [MOD-DESIGNER-040] Context menu has "Place at Center" and "Add to Favorites" | ✅ pass | Both items present in palette tile context menu |
| 7 | Canvas Node Context Menus | [MOD-DESIGNER-042] Annotation right-click includes "Change Style" | ❌ fail | Context menu lacked "Change Style"; items seen: Cut/Copy/Paste/Duplicate/Delete/Group/Ungroup/Rotate/Flip/Lock/Bind Point/Rename/Properties — no "Change Style" |
| 8 | Canvas Node Context Menus | [MOD-DESIGNER-039] TextBlock context menu shows text-specific items | ✅ pass | "Edit Text" visible in TextBlock context menu |
| 9 | Test Mode PointContextMenu | [MOD-DESIGNER-041] Test mode right-click shows PointContextMenu not edit menu | ✅ pass | Test mode context menu showed data-point options (trend, view detail, acknowledge) — not the edit menu |
| 10 | Canvas Drag Interactions | [MOD-DESIGNER-047] Canvas drag-to-move repositions element | ❌ fail | browser_drag timed out with "subtree intercepts pointer events"; JS pointer event dispatch also failed — undo remained "Undo: Resize" not "Undo: Move" |
| 11 | Canvas Drag Interactions | [MOD-DESIGNER-048] Escape key cancels in-progress drag | ❌ fail | Untestable — underlying drag-to-move is broken; cannot test cancel of a drag that never starts |
| 12 | Canvas Drag Interactions | [MOD-DESIGNER-044] Drag ghost visible during palette→canvas drag | ❌ fail | MutationObserver (window.__ghostSeen) confirmed ghostSeen=false; #io-canvas-drag-ghost never added to DOM during palette→canvas drag |
| 13 | Group Management | [MOD-DESIGNER-046] Ctrl+G creates group node in scene tree | ✅ pass | Undo showed "Undo: Group"; scene tree showed "Group 1 / Group" with 3 children |
| 14 | Group Management | [MOD-DESIGNER-046] Group context menu has "Open in Tab" | ✅ pass | "Open in Tab" present in group context menu |

## New Bug Tasks Created

MOD-DESIGNER-050 — Annotation node right-click "Change Style" still absent after MOD-DESIGNER-042 fix
MOD-DESIGNER-051 — Canvas drag-to-move still broken after MOD-DESIGNER-047 fix
MOD-DESIGNER-052 — Escape key drag-cancel untestable — depends on broken canvas drag-to-move (MOD-DESIGNER-051)
MOD-DESIGNER-053 — Palette-to-canvas drag ghost #io-canvas-drag-ghost still absent after MOD-DESIGNER-044 fix

## Screenshot Notes

- fail-s7-change-style-missing.png — Annotation context menu snapshot; no "Change Style" item present
- fail-s10-drag-move.png — Canvas after failed drag-to-move attempt; element did not move
- fail-s12-no-drag-ghost.png — Canvas after palette→canvas drag; MutationObserver confirmed ghost element never appeared
- Seed data: UNAVAILABLE (psql not accessible) — data flow scenarios not applicable to MOD-DESIGNER (graphics editor, not data-display unit)
