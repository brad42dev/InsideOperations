# UAT Scenarios — DD-23

## Expression Builder

Scenario 1: [DD-23-001] Expression builder renders — open expression builder (from designer point binding or settings) → builder UI loads without error
Scenario 2: [DD-23-003] Nesting depth limit — try to nest tiles more than 5 levels deep → tooltip/error feedback shown, nesting blocked
Scenario 3: [DD-23-004] Nesting level colors — open expression builder with nested tiles → each nesting level has distinct color per Okabe-Ito palette
Scenario 4: [DD-23-006] Share checkbox visible — open expression builder → Share checkbox present in dialog
Scenario 5: [DD-23-008] Cancel with unsaved changes — make a change then click Cancel → confirmation prompt asking about unsaved changes appears
Scenario 6: [DD-23-009] Clipboard operations — select a tile → Ctrl+C, Ctrl+X, Ctrl+V keyboard shortcuts work (tile copied/pasted)
Scenario 7: [DD-23-010] ARIA roles present — open expression builder → workspace has ARIA roles for screen reader support
Scenario 8: [DD-23-011] Insertion cursor visible — click in workspace → blinking cursor indicator visible at insertion position
Scenario 9: [DD-23-012] Drag tile from palette — drag a tile from palette to workspace → tile appears in workspace
Scenario 10: [DD-23-013] Breadcrumb trail — enter nested container → breadcrumb trail shown above workspace
Scenario 11: [DD-23-014] saveForFuture checked by default — open save dialog → "Save for future use" checkbox is checked by default
Scenario 12: [DD-23-015] Round tile precision — open Round tile properties → precision values use powers-of-10 (0.1, 0.01, etc.)
