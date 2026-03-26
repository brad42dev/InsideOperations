# UAT Scenarios — MOD-DESIGNER

Seed data: 0 rows (no seed data). Empty states are ✅ if handled gracefully.
⚠️ No seed data — data flow scenarios accept graceful empty state as pass.

---

## Page Load and Layout

Scenario 1: [MOD-DESIGNER-023] Designer renders without error — navigate to /designer → designer UI visible (toolbar, canvas area, left palette, right panel), no error boundary ("Something went wrong") text

Scenario 2: [MOD-DESIGNER-023] — data flow: GET /api/v1/design-objects — navigate to /designer, wait 3s, verify page is not stuck in "Loading..." and does not show error boundary; empty state or design objects list both pass; DOM must show designer layout not a crash
  Specific API: GET /api/v1/design-objects
  DOM evidence: designer toolbar or canvas area is visible; no "Something went wrong" boundary

## File Tab Bar (MOD-DESIGNER-023 / MOD-DESIGNER-029 / MOD-DESIGNER-037)

Scenario 3: [MOD-DESIGNER-029] File tab bar component visible in designer — navigate to /designer → a tab bar area is visible between the top toolbar and the canvas (even if empty of tabs, the bar container exists)

Scenario 4: [MOD-DESIGNER-037] Opening File→New creates a new file tab — navigate to /designer, find and click File menu or New button → a tab appears in the tab bar for the new untitled graphic

## Shape Palette Context Menu (MOD-DESIGNER-007 / MOD-DESIGNER-040)

Scenario 5: [MOD-DESIGNER-040] Right-click palette tile shows context menu, not element placement — navigate to /designer, find the shape palette on the left, right-click any palette tile → [role="menu"] appears with items, no new element placed on canvas

Scenario 6: [MOD-DESIGNER-007] Palette context menu has expected items — after right-clicking a palette tile and seeing the menu → menu contains at minimum "Place at Center" and "Add to Favorites" options (or equivalent library-shape items per spec)

Scenario 7: [MOD-DESIGNER-040] Left-click palette tile places element on canvas — navigate to /designer, left-click a palette tile → element is placed on the canvas; no context menu appears

## Canvas Context Menus (MOD-DESIGNER-004 / MOD-DESIGNER-005 / MOD-DESIGNER-006)

Scenario 8: [MOD-DESIGNER-004] Empty canvas right-click shows canvas-only menu — navigate to /designer, ensure no elements selected, right-click on empty canvas area → menu appears with "Paste", "Select All", "Grid" and/or "Zoom" items; does NOT show node-specific items like "Lock" or "Delete"

Scenario 9: [MOD-DESIGNER-005] Node right-click shows base items: Lock/Unlock, Navigation Link, Properties — place a shape on canvas (left-click palette), click to select it, right-click → menu contains "Lock" or "Unlock", "Navigation Link", and "Properties…" items

Scenario 10: [MOD-DESIGNER-004] Node menu differs from empty canvas menu — right-click an element on canvas → shows node-specific items (Cut, Copy, Delete, Lock) which are NOT in the empty-canvas menu

## Display Element Point Context Items (MOD-DESIGNER-033 / MOD-DESIGNER-041)

Scenario 11: [MOD-DESIGNER-033] Display element right-click shows point context items — place a Text Readout or display element from palette, right-click it → context menu contains "Open Trend" and/or "View Detail" and/or "View Alerts" (point-context items) in addition to "Bind Point…" and "Change Type"

## Drag Ghost (MOD-DESIGNER-002 / MOD-DESIGNER-031 / MOD-DESIGNER-038)

Scenario 12: [MOD-DESIGNER-031] Drag ghost visible when moving shape on canvas — place an element on canvas, select it, drag to a new position → a ghost/preview element (translucent or dashed outline) is visible during the drag; shape lands at new position on mouse-up

## Group and Widget Context Menus (MOD-DESIGNER-024 / MOD-DESIGNER-039)

Scenario 13: [MOD-DESIGNER-024] Group right-click shows "Open in Tab" option — place multiple elements, group them (if grouping available), right-click the group → menu contains "Open in Tab" item

Scenario 14: [MOD-DESIGNER-039] Widget node right-click has "Refresh Data" and "Detach from Dashboard" — if a widget element is on canvas, right-click it → menu shows "Refresh Data" and "Detach from Dashboard"
