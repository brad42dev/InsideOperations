# UAT Scenarios — DD-23

## Page Load
Scenario 1: [DD-23-019] Expression library page renders without error — navigate to /settings/expressions → page loads with expression list, no error boundary

## Insertion Cursor (DD-23-019)
Scenario 2: [DD-23-019] Insertion cursor visible in empty workspace — open Edit on a saved expression → visible insertion cursor or position indicator is present in workspace
Scenario 3: [DD-23-019] Cursor moves on click — click a gap between tiles in workspace → cursor visually moves to that gap

## Drag-and-Drop into Container (DD-23-018)
Scenario 4: [DD-23-018] Drag palette tile into container's empty zone — add group container to workspace, drag "Enter Value" tile from palette onto the group's "Drop tiles here" zone → tile appears inside group with nesting/level-2 color styling
Scenario 5: [DD-23-018] Drop into sibling gap inside container — drag another tile onto the gap inside the group → tile inserts at that position inside the container

## Breadcrumb Navigation (DD-23-020)
Scenario 6: [DD-23-020] No breadcrumb shown at root level — open expression builder at root level → no breadcrumb trail visible above workspace (or "Root" only)
Scenario 7: [DD-23-020] Breadcrumb appears when entering a container — add group container and click inside it → breadcrumb trail appears above workspace showing nesting path (e.g. "Root > (…)")
Scenario 8: [DD-23-020] Breadcrumb navigation clickable — with breadcrumb showing, click "Root" breadcrumb item → cursor moves back to root level, breadcrumb updates

## Save For Future Use Default (DD-23-021)
Scenario 9: [DD-23-021] "Save for Future Use" checked by default on open — open Edit on a saved expression → "Save for Future Use" checkbox is checked before any interaction
Scenario 10: [DD-23-021] Checkbox state persists through workspace changes — add a tile while checkbox is checked → checkbox remains checked
