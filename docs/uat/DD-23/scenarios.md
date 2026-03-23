# UAT Scenarios — DD-23

## Expression Builder
Scenario 1: [DD-23-012] Expression builder opens from Designer — navigate to /designer, access expression/point binding → expression builder modal appears
Scenario 2: [DD-23-012] Palette tiles visible and draggable — in expression builder → tile palette sidebar visible with draggable tiles
Scenario 3: [DD-23-003] Nesting depth limit enforced — in expression builder, nest tiles 5 levels deep → tooltip or error appears at depth 6
Scenario 4: [DD-23-011] Insertion cursor blinking in workspace — in expression builder, click workspace → blinking cursor visible
Scenario 5: [DD-23-008] Cancel button shows unsaved-changes prompt — in expression builder, make a change, click Cancel → confirmation dialog appears
Scenario 6: [DD-23-014] Save for Future checkbox checked by default — in expression builder, open save dialog → "Save for future use" checkbox is checked by default
Scenario 7: [DD-23-013] Breadcrumb trail when inside nested container — in expression builder, click inside nested group → breadcrumb path visible above workspace
Scenario 8: [DD-23-004] Nesting level colors match Okabe-Ito palette — in expression builder → nested tiles show distinct accessible colors
Scenario 9: [DD-23-010] ARIA roles present — in expression builder → workspace has role="application" or aria-label indicating expression workspace
Scenario 10: [DD-23-009] Clipboard operations visible (Ctrl+C/X/V) — in expression builder, select a tile → clipboard action works or no JS error
