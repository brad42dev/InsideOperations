# UAT Scenarios — MOD-DESIGNER

Tasks to UAT: MOD-DESIGNER-047 (Canvas drag-to-move element position could not be confirmed in UAT)

## Page Integrity
Scenario 1: [MOD-DESIGNER-047] Designer page renders without error — navigate to /designer → no error boundary, toolbar and palette visible
Scenario 2: [MOD-DESIGNER-047] Shape palette is present — navigate to /designer → left sidebar shows palette with shape/element tiles

## Palette-to-Canvas Placement
Scenario 3: [MOD-DESIGNER-047] Placing a shape on canvas — navigate to /designer/graphics/new, drag tile from palette onto canvas → element appears on canvas, no nav away
Scenario 4: [MOD-DESIGNER-047] Clicking placed element selects it — after placing element, click it → selection handles visible

## Canvas Drag-to-Move (MOD-DESIGNER-047 core)
Scenario 5: [MOD-DESIGNER-047] Dragging placed element moves it — click placed element to select, drag 100px → element moves to new position, does NOT stay at original
Scenario 6: [MOD-DESIGNER-047] No duplicate element created after drag — after drag-to-move, canvas has same count of elements (1), not 2+

## Edge Cases
Scenario 7: [MOD-DESIGNER-047] Undo after drag reverts position — after dragging element, Undo → element returns to original position (MoveNodesCommand used, not placement)
