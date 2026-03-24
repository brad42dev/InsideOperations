# UAT Scenarios — DD-23

## Drag-and-Drop Into Container (DD-23-022)

Scenario 1: [DD-23-022] Expression builder opens without error — navigate to /settings/expressions → page loads, no error boundary, expression list visible
Scenario 2: [DD-23-022] Add group container to workspace — open/edit expression, click (…) group container in palette → group tile appears in workspace with "Click palette tiles to insert, or drag them here" zone
Scenario 3: [DD-23-022] Drag tile from palette into group container interior — drag "Enter Value" from VALUES palette and drop onto group's drop zone → tile appears INSIDE the group (indented, level-2 styled), not outside it
Scenario 4: [DD-23-022] Group error clears after tile dropped inside — after dropping tile into group → "(…) container must have at least one child tile" error message is no longer shown
Scenario 5: [DD-23-022] Second tile drops into sibling gap inside group — drag second tile onto gap between existing children inside group → tile inserts between existing children correctly

## Breadcrumb Navigation in Nested Containers (DD-23-023)

Scenario 6: [DD-23-023] No breadcrumb at root level — open expression editor at root level → no breadcrumb trail visible above workspace (or only "Root" shown, no nesting path)
Scenario 7: [DD-23-023] Breadcrumb appears when cursor enters container — add (…) group container, click inside it to move cursor into it → breadcrumb trail (e.g. "Root > (…)") appears above workspace
Scenario 8: [DD-23-023] Breadcrumb is clickable — with cursor inside container, click "Root" breadcrumb item → cursor returns to root level, breadcrumb hides/resets
Scenario 9: [DD-23-023] Breadcrumb updates dynamically on deeper nesting — add nested (…) inside outer group and enter it → breadcrumb shows both levels (e.g. "Root > (…) > (…)")
