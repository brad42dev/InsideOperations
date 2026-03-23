# UAT Scenarios — DD-23

## Expression Builder (DD-23) — accessed via /designer point binding

Scenario 1: [DD-23-012] Expression builder opens from designer — navigate to /designer, open point binding → expression builder dialog opens
Scenario 2: [DD-23-012] Drag palette tile to workspace — expression builder open → drag tile from palette to workspace successfully
Scenario 3: [DD-23-003] Nesting depth limit feedback — nest tiles 5+ levels deep → tooltip or error appears at depth 5+
Scenario 4: [DD-23-004] Nesting level colors — expression builder open with nested tiles → each nesting level has distinct color
Scenario 5: [DD-23-007] Save-and-apply flow — click OK/Save in expression builder → confirmation or save action occurs (not silent no-op)
Scenario 6: [DD-23-008] Cancel prompts for unsaved changes — make change, click Cancel → confirmation dialog appears
Scenario 7: [DD-23-009] Clipboard operations — select tile, Ctrl+C, Ctrl+V → tile duplicated in workspace
Scenario 8: [DD-23-011] Insertion cursor visible — click in workspace area → blinking cursor visible at insertion point
Scenario 9: [DD-23-015] Round tile precision values — add Round tile → precision values are powers of 10 (0.1, 0.01 etc.)
Scenario 10: [DD-23-005] Test button triggers performance check — click Test button → performance result shown (not silent)
Scenario 11: [DD-23-002] Field ref tile available for rounds context — check tile palette → field_ref tile type visible
