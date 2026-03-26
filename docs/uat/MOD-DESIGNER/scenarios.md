# UAT Scenarios — MOD-DESIGNER

## Page Load
Scenario 1: [MOD-DESIGNER-035] Designer route renders without error — navigate to /designer → UI loads, no error boundary text ("Something went wrong"), navigation visible

## Shape Palette and Canvas
Scenario 2: [MOD-DESIGNER-035] Shape palette visible on new graphic — navigate to /designer/graphics/new → sidebar palette with equipment shapes is visible
Scenario 3: [MOD-DESIGNER-035] Drag shape from palette to canvas — drag shape from palette to canvas area → shape appears on canvas
Scenario 4: [MOD-DESIGNER-035] Canvas shape can be moved by drag — click to select an existing shape on canvas, drag it to a new position → shape lands at the new position (position changed from original)
Scenario 5: [MOD-DESIGNER-035] Ghost/preview element during canvas drag — evaluate DOM while dragging shape on canvas → ghost/overlay element with reduced opacity or "ghost"/"dragging" class present in DOM during drag

## Display Element Context Menu
Scenario 6: [MOD-DESIGNER-036] Right-clicking display element shows context menu — right-click a display element on canvas → [role="menu"] appears
Scenario 7: [MOD-DESIGNER-036] Context menu contains View Alerts item — right-click display element, inspect menu → "View Alerts", "Alerts", "Active Alarms for Point", or alerts-equivalent item is visible in menu
Scenario 8: [MOD-DESIGNER-036] Context menu contains Trend This Point — right-click display element → menu contains "Trend This Point" or "Open Trend"
Scenario 9: [MOD-DESIGNER-036] Context menu contains Point Detail — right-click display element → menu contains "Point Detail" or "View Detail"
Scenario 10: [MOD-DESIGNER-036] Context menu contains Bind Point — right-click display element → menu contains "Bind Point…" or equivalent binding option

## TextBlock Context Menu (MOD-DESIGNER-006)
Scenario 11: [MOD-DESIGNER-039] TextBlock can be placed programmatically — dispatch CustomEvent('io:test-add-text-block', { detail: { x: 200, y: 150, content: 'Test label' } }) on document → a text_block node appears in the scene graph (sceneStore doc.children contains type==='text_block')
Scenario 12: [MOD-DESIGNER-039] TextBlock context menu shows text-specific items — place TextBlock via io:test-add-text-block, right-click it → context menu contains "Edit Text", "Change Font…", and "Text Alignment"; these items must NOT appear when right-clicking a non-text node (display element)
