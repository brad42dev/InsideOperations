# UAT Scenarios — DD-23
# Session 2026-03-26: Tasks DD-23-011, DD-23-012, DD-23-013, DD-23-014, DD-23-018, DD-23-020, DD-23-024

## Expression Builder Access & Defaults

Scenario 1: [DD-23-014] Expression editor renders without error — navigate to /settings/expressions → page loads without error boundary, expression list or empty state visible
Scenario 2: [DD-23-014] saveForFuture checkbox checked by default — open expression builder (Edit on any expression) → "Save for Future Use" checkbox is checked; Name and Description fields are NOT grayed out

## Insertion Cursor

Scenario 3: [DD-23-011] Blinking insertion cursor visible — open expression editor, click in workspace between/after tiles → a visible 2px cursor element appears at that position
Scenario 4: [DD-23-011] Cursor position changes on click — with at least one tile in workspace, click different positions → cursor moves to the clicked position each time (not stuck in one spot)

## Drag-and-Drop from Palette

Scenario 5: [DD-23-012] Drag palette tile to root workspace — open expression editor, drag "Enter Value" tile from palette into workspace drop zone → tile appears as a new workspace tile
Scenario 6: [DD-23-012] DragOverlay ghost visible while dragging — drag a palette tile slowly over workspace → a ghost/overlay element follows the drag pointer (visual feedback during drag)

## Drag-and-Drop into Container

Scenario 7: [DD-23-018] Group container shows empty drop zone — add a (…) group container to workspace, leave it empty → "Drop tiles here" text or drop target zone visible inside the group
Scenario 8: [DD-23-018] Drag tile into group container drop zone — drag palette tile onto group container's empty interior zone → tile appears inside the group with nesting color (indented/level-2 styled)

## Breadcrumb Navigation

Scenario 9: [DD-23-013] [DD-23-020] No breadcrumb at root level — open expression editor at root level (no container entered) → no breadcrumb trail above workspace (or only "Root" with no nesting path)
Scenario 10: [DD-23-013] [DD-23-020] Breadcrumb appears when cursor enters group container — add group container, click inside it → breadcrumb trail appears above workspace (e.g. "Root > (…)")
Scenario 11: [DD-23-013] [DD-23-020] Breadcrumb click returns cursor to root — with cursor inside container showing breadcrumb, click "Root" breadcrumb → cursor moves back to root, breadcrumb hides or shows only root

## Focus Trap

Scenario 12: [DD-23-024] Escape closes expression builder dialog — open expression builder dialog, press Escape → dialog closes
Scenario 13: [DD-23-024] Arrow keys stay inside dialog — open builder, click a tile (tile shows selected), press ArrowLeft → cursor moves within the expression; the page URL does NOT change (app shell does not navigate away)
