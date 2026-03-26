# UAT Scenarios — DD-31

**Session tasks:** DD-31-021, DD-31-022, DD-31-023
**Seed data status:** UNAVAILABLE

## Page Load & Render

Scenario 1: [DD-31-021] Alerts page renders without error — navigate to /alerts → page loads, no error boundary ("Something went wrong") visible, tab navigation (Active, History, Management) present

## Channels API — Cold-Start (DD-31-022)

Scenario 2: [DD-31-022] — data flow: GET /api/notifications/channels/enabled — navigate to /alerts fresh, open compose dialog, inspect Channels section → multiple channel checkboxes visible (DOM evidence: checkbox elements for channel options, not just one "websocket" entry)
Scenario 3: [DD-31-022] Browser console shows no 404 for channels/enabled — navigate to /alerts, capture console messages → no 404 error logged for /api/notifications/channels/enabled

## Template Variable Labels (DD-31-023)

Scenario 4: [DD-31-023] Compose form opens and template selector is visible — navigate to /alerts, click "New Alert"/compose button → compose form or dialog opens, template selector field is visible
Scenario 5: [DD-31-023] — data flow: GET /api/notifications/templates — open compose form → template list loads, at least one template option visible (e.g., "Fire Alarm" present in selector)
Scenario 6: [DD-31-023] Variable inputs use human-readable label — select "Fire Alarm" template → variable field label reads "Location" (capitalized/human-readable), NOT "location" (raw snake_case)
Scenario 7: [DD-31-023] Required variable shows asterisk/required indicator — after selecting template with required variable → asterisk (*) or "required" text visible next to field label
Scenario 8: [DD-31-023] Send button disabled when required field empty — after selecting template, clear required variable field → Send button is disabled (aria-disabled or visually inactive)

## Muster Dashboard (DD-31-021)

Scenario 9: [DD-31-021] Active tab shows alerts list or empty-state without crash — navigate to /alerts Active tab → no error boundary; either alerts list or empty-state message ("No active alerts" or similar) visible
