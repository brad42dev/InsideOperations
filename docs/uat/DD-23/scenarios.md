# UAT Scenarios — DD-23
# Session 2026-03-26 (session 3): Task DD-23-024 only — DB write recovery

## Focus Trap

Scenario 1: [DD-23-024] Expression library page renders without error — navigate to /settings/expressions → page loads with expression list, no error boundary, no "Access Denied"

Scenario 2: [DD-23-024] Edit button opens expression builder dialog — click Edit on first expression row → [role="dialog"] appears with workspace area visible

Scenario 3: [DD-23-024] Escape closes expression builder dialog — open expression builder dialog, press Escape → dialog closes (no [role="dialog"] in snapshot)

Scenario 4: [DD-23-024] Arrow keys captured inside dialog (focus trap) — open builder, click a tile in workspace (tile shows selected/active), press ArrowLeft → cursor moves within expression, page URL does NOT change (stays /settings/expressions, app shell does not navigate away)
