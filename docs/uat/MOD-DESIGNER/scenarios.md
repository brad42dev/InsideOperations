# UAT Scenarios — MOD-DESIGNER

Generated: 2026-03-26
Tasks: MOD-DESIGNER-037, 038, 039, 040, 041, 042, 043, 044, 046, 047, 048
Mode: auto
Seed data: UNAVAILABLE

---

## Designer Page Load

Scenario 1: [MOD-DESIGNER-038] Designer page renders without error — navigate to /designer → page loads with toolbar, palette, canvas visible; no error boundary; no "Something went wrong"

Scenario 2: [MOD-DESIGNER-038] New graphic canvas loads cleanly — navigate to /designer/graphics/new, fill form → canvas visible with empty state, no 429 error shown

---

## Multi-Tab File Management

Scenario 3: [MOD-DESIGNER-037] File→New creates a second tab — open /designer (one tab visible), use File menu→New Graphic, create second graphic → two tabs now visible in the file tab bar (not just one)

Scenario 4: [MOD-DESIGNER-037] Tab switching between graphics — with two tabs open, click the first tab → first graphic canvas shown without error

---

## Palette Tile Right-Click Context Menu

Scenario 5: [MOD-DESIGNER-043] Palette tile right-click shows context menu — right-click a Display Elements palette tile (e.g. Text Readout) → [role="menu"] appears with items; no element placed on canvas

Scenario 6: [MOD-DESIGNER-040] Palette context menu has Place at Center and Add to Favorites — after right-click on palette tile → context menu contains "Place at Center" and "Add to Favorites" items

---

## Canvas Node Context Menus

Scenario 7: [MOD-DESIGNER-042] Annotation node right-click includes Change Style — place text annotation via T key, switch to Select (V), right-click the annotation → context menu shows "Change Style" item

Scenario 8: [MOD-DESIGNER-039] TextBlock context menu shows text-specific items — place TextBlock on canvas (T key), right-click it → "Edit Text", "Change Font…", or "Text Alignment" visible in context menu

---

## Test Mode PointContextMenu

Scenario 9: [MOD-DESIGNER-041] Test mode right-click shows PointContextMenu not edit menu — place Text Readout on canvas, switch to Test mode (Test button), right-click element → PointContextMenu shown (NOT Cut/Copy/Delete/Lock/Bind Point menu)

---

## Canvas Drag Interactions

Scenario 10: [MOD-DESIGNER-047] Canvas drag-to-move repositions element — place element on canvas, click to select, drag element 100px → element settles at new position (not original), no extra elements created

Scenario 11: [MOD-DESIGNER-048] Escape key cancels in-progress drag — place element, begin drag, press Escape → element returns to original position, undo history does NOT say "Undo: Move"

Scenario 12: [MOD-DESIGNER-044] Drag ghost visible during palette→canvas drag — begin dragging shape from palette toward canvas → #io-canvas-drag-ghost element present in DOM during drag

---

## Group Management

Scenario 13: [MOD-DESIGNER-046] Ctrl+G creates group node in scene tree — place 2+ elements, press Ctrl+A (select all), press Ctrl+G → scene tree shows a "Group" node (not all separate nodes)

Scenario 14: [MOD-DESIGNER-046] Group context menu has Open in Tab — after grouping elements and right-clicking the group → "Open in Tab" appears in context menu
