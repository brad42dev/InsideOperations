# UAT Scenarios — MOD-DESIGNER

## File Tab Bar (MOD-DESIGNER-030)
Scenario 1: [MOD-DESIGNER-030] Designer loads without error — navigate to /designer → page renders, no error boundary text
Scenario 2: [MOD-DESIGNER-030] File tab bar visible when graphic open — navigate to /designer/graphics/new → a tab bar with a tab labeled with the file name appears, distinct from the mode selector (Graphic/Dashboard/Report)
Scenario 3: [MOD-DESIGNER-030] Active tab is visually highlighted — open a graphic → the open file's tab appears highlighted/active in the tab bar
Scenario 4: [MOD-DESIGNER-030] Mode selector distinct from file tabs — open a graphic → mode selector row (Graphic/Dashboard/Report buttons) is separate from the file tab bar

## Drag Ghost on Canvas (MOD-DESIGNER-031)
Scenario 5: [MOD-DESIGNER-031] Drag ghost appears when moving shape on canvas — click and drag a shape already on the canvas → a translucent ghost/preview element follows the cursor during drag
Scenario 6: [MOD-DESIGNER-031] Ghost disappears on mouse release — release drag → shape snaps to drop position, ghost element is gone

## Drag Ghost from Palette (MOD-DESIGNER-032)
Scenario 7: [MOD-DESIGNER-032] Drag ghost appears when dragging from palette — drag a shape from the left palette toward the canvas → a semi-transparent ghost element appears following the cursor mid-drag
Scenario 8: [MOD-DESIGNER-032] Shape lands at drop position after palette drag — drop the shape on the canvas → shape appears at the drop location on canvas

## Point Context Menu on Display Elements (MOD-DESIGNER-033)
Scenario 9: [MOD-DESIGNER-033] Right-clicking display element shows context menu — drag a Text Readout (or any display element) onto canvas, right-click it → context menu appears
Scenario 10: [MOD-DESIGNER-033] Point context items present in display element menu — right-click display element → menu contains "Open Trend"/"Trend", "View Detail"/"Detail", and "View Alerts"/"Alerts" (or equivalent CX-POINT-CONTEXT items)
Scenario 11: [MOD-DESIGNER-033] Bind Point and Change Type still present — right-click display element → "Bind Point…" and "Change Type" items are visible in the menu

## Group Sub-tab (MOD-DESIGNER-034)
Scenario 12: [MOD-DESIGNER-034] Double-clicking group opens sub-tab — place shapes, group them with Ctrl+G, double-click the group → a sub-tab appears in the tab bar for the group
Scenario 13: [MOD-DESIGNER-034] Tab bar shows parent and group sub-tab — in group edit mode → tab bar shows both the parent file tab and a group sub-tab
Scenario 14: [MOD-DESIGNER-034] Clicking parent tab exits group editing — while in group edit mode, click the parent file tab → exits group editing, returns to top-level canvas view
