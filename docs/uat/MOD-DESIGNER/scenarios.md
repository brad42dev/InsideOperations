# UAT Scenarios — MOD-DESIGNER

Tasks in scope: MOD-DESIGNER-002, MOD-DESIGNER-004, MOD-DESIGNER-005, MOD-DESIGNER-006,
MOD-DESIGNER-007, MOD-DESIGNER-009, MOD-DESIGNER-023, MOD-DESIGNER-024, MOD-DESIGNER-029,
MOD-DESIGNER-031, MOD-DESIGNER-033, MOD-DESIGNER-037, MOD-DESIGNER-038, MOD-DESIGNER-039,
MOD-DESIGNER-040, MOD-DESIGNER-041

Seed data: UNAVAILABLE (psql not accessible)

## Page Load & Data Flow

Scenario 1: [MOD-DESIGNER-023] Designer page renders without error — navigate to /designer → page loads, no error boundary ("Something went wrong"), toolbar and left palette visible
Scenario 2: [MOD-DESIGNER-023] — data flow: GET /api/v1/graphics — navigate to /designer, wait for page load, check that graphics list or home screen renders (not stuck in "Loading..." or showing error boundary); DOM evidence: graphics list items visible OR empty-state message present (no crash)

## File Tabs (MOD-DESIGNER-023 / MOD-DESIGNER-029)

Scenario 3: [MOD-DESIGNER-029] Tab bar presence — open designer home screen, look for a tab bar area between toolbar and canvas; tab bar element (role="tablist" or visual tab strip) must be visible
Scenario 4: [MOD-DESIGNER-023] Open graphic creates tab — navigate to /designer, open a graphic from the list or click New; confirm tab appears in the tab bar with the graphic name or "Untitled"
Scenario 5: [MOD-DESIGNER-023] Closing tab removes it — if a tab is visible, close it (click x button on tab); confirm tab is removed from tab bar

## Group Sub-tabs (MOD-DESIGNER-024)

Scenario 6: [MOD-DESIGNER-024] Group right-click shows Open in Tab — place a group on canvas, right-click it; confirm "Open in Tab" menu item is visible in the context menu

## Empty Canvas Context Menu (MOD-DESIGNER-004)

Scenario 7: [MOD-DESIGNER-004] Empty canvas right-click shows correct items — navigate to new graphic canvas, right-click on empty canvas area; confirm menu contains Paste, Select All, and Grid/Zoom submenus; confirm Cut/Copy/Delete are NOT present (those are node-only items)

## Node Context Menu Base Items (MOD-DESIGNER-005)

Scenario 8: [MOD-DESIGNER-005] Node context menu has Lock/Unlock — place a rectangle on canvas, right-click it; confirm Lock or Unlock item is present in context menu
Scenario 9: [MOD-DESIGNER-005] Node context menu has Navigation Link submenu — right-click a placed node; confirm Navigation Link submenu is present
Scenario 10: [MOD-DESIGNER-005] Node context menu has Properties item — right-click a placed node; confirm Properties or Properties... item is visible

## Shape Palette Right-click (MOD-DESIGNER-007)

Scenario 11: [MOD-DESIGNER-007] Shape palette tile right-click shows menu — right-click a shape tile in the left palette; confirm a context menu appears (NOT a drag-place action); menu should contain items like Export SVG or Copy to My Shapes

## Display Element Context Menu — Point Context Items (MOD-DESIGNER-033)

Scenario 12: [MOD-DESIGNER-033] Display element right-click has point-context items — drag a Text Readout display element from palette to canvas, right-click it; confirm context menu contains Open Trend (or Trend), View Detail (or Detail), View Alerts (or Alerts)
Scenario 13: [MOD-DESIGNER-033] Existing bind items still present — right-click Text Readout; confirm Bind Point... and Change Type are still in the menu

## TextBlock Context Menu (MOD-DESIGNER-039)

Scenario 14: [MOD-DESIGNER-039] TextBlock right-click shows text-specific items — use Text tool to place a TextBlock, right-click it; confirm Edit Text, Change Font..., and Text Alignment items are present

## Drag Ghost (MOD-DESIGNER-002 / MOD-DESIGNER-031)

Scenario 15: [MOD-DESIGNER-031] Drag ghost appears during shape move — place a shape on canvas, click and drag it; confirm a translucent ghost or preview element appears following the cursor during the drag (not just element snapping at drop)

## Test Mode Point Context Menu (MOD-DESIGNER-041)

Scenario 16: [MOD-DESIGNER-041] Test mode right-click shows PointContextMenu not edit menu — place a Text Readout, enter Test mode, right-click the display element; confirm PointContextMenu (Open Trend, View Detail) appears and NOT the edit-mode menu (Cut/Copy/Delete/Lock)
