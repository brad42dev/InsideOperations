# UAT Scenarios — MOD-DESIGNER

Tasks to test: MOD-DESIGNER-002, MOD-DESIGNER-009, MOD-DESIGNER-013, MOD-DESIGNER-024, MOD-DESIGNER-025

## Module Setup
Scenario 1: [MOD-DESIGNER-002] Designer page renders without error — navigate to /designer → page loads, no error boundary ("Something went wrong")

## Drag Ghost (MOD-DESIGNER-002)
Scenario 2: [MOD-DESIGNER-002] Shape palette visible on designer canvas — navigate to /designer/graphics/new → shape palette sidebar present with draggable shapes
Scenario 3: [MOD-DESIGNER-002] Drag ghost appears when dragging shape on canvas — click a shape on canvas and drag to new position → ghost/preview element appears during drag (element with opacity or "ghost"/"preview"/"drag" in class/identifier)
Scenario 4: [MOD-DESIGNER-002] Shape lands at drop position after drag — release drag → shape moves to target position, no ghost remains

## Point Context Menu on Display Elements (MOD-DESIGNER-009)
Scenario 5: [MOD-DESIGNER-009] Display element toolbar/palette visible — navigate to /designer/graphics/new → display element types visible in palette (Value, Gauge, etc.)
Scenario 6: [MOD-DESIGNER-009] Right-clicking display element shows context menu — add a display element to canvas then right-click it → [role="menu"] appears
Scenario 7: [MOD-DESIGNER-009] Point context menu includes point-related options — right-click a display element → menu contains point-context items (Trend, Detail, Alerts, or similar)

## Group Proportional Resize (MOD-DESIGNER-013)
Scenario 8: [MOD-DESIGNER-013] Can create and select a group on canvas — add shapes, select multiple, group them → group node present on canvas
Scenario 9: [MOD-DESIGNER-013] Group resize handles visible after selection — click/select a group → corner/edge resize handles appear around group bounding box
Scenario 10: [MOD-DESIGNER-013] Group drag-resize changes group bounds — drag a corner handle → group bounding box size changes

## Group Sub-Tabs (MOD-DESIGNER-024)
Scenario 11: [MOD-DESIGNER-024] Double-clicking group enters edit mode — double-click a group → edit mode indicator appears (toolbar label, breadcrumb, or sub-tab showing group name)
Scenario 12: [MOD-DESIGNER-024] Group sub-tab appears in tab bar — after entering group via double-click → a tab or breadcrumb for the group is visible separate from the main canvas tab

## Promote to Shape Wizard (MOD-DESIGNER-025)
Scenario 13: [MOD-DESIGNER-025] Promote to Shape option in group context menu — right-click a group → menu contains "Promote to Shape" or "Save as Shape"
Scenario 14: [MOD-DESIGNER-025] Promote to Shape wizard opens — click "Promote to Shape" in context menu → dialog/wizard opens with fields for shape name/value anchors
