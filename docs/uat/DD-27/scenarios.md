# UAT Scenarios — DD-27

## Module Load

Scenario 1: [DD-27-013] Alerts module renders without crash — navigate to /alerts → no error boundary, no "Alerts failed to load" text visible
Scenario 2: [DD-27-013] Alert templates section renders — navigate to /alerts, click Templates tab/button → templates section renders without error (empty state or list, no TypeError crash)

## Send Alert Composer — Channels

Scenario 3: [DD-27-014] Send Alert composer opens — click "Send Alert" tab or button on /alerts → alert composer form visible with Title, Message, Recipient fields
Scenario 4: [DD-27-014] Channels section shows multiple channels — open Send Alert composer → Channels section shows SMS, PA, Radio, and/or Push checkboxes (not just websocket alone)
Scenario 5: [DD-27-015] — data flow: GET /api/notifications/channels/enabled — navigate to /alerts → Send Alert tab → wait 3s → Channels section must show at least 2 distinct channel options (evidence: ≥2 channel checkboxes/options visible beyond websocket alone); NOT "only websocket" or empty
Scenario 6: [DD-27-014] SMS channel checkbox is toggleable — open Send Alert composer, locate SMS checkbox in Channels section → click it → state changes (checked → unchecked or unchecked → checked), no crash

## Template Selection Updates Channels

Scenario 7: [DD-27-016] Selecting Custom Alert template updates Channels — open Send Alert composer, select "Custom Alert" from Template dropdown → Channels section updates to reflect template channels (websocket, email, sms, radio, push pre-selected)
Scenario 8: [DD-27-016] Selecting Safety Bulletin template updates Channels — open Send Alert composer, select "Safety Bulletin" from Template dropdown → Channels section updates to websocket + email only
Scenario 9: [DD-27-016] Ad-hoc selection resets channels — open Send Alert composer, select a named template then select ad-hoc option → Channels section resets to defaults

## Channel Adapter List / Settings

Scenario 10: [DD-27-017] Channels list loads without crash — navigate to /alerts → Send Alert tab → page loads without DB crash error (verified by: composer renders and shows any channel options)
Scenario 11: [DD-27-007] Alert channels config accessible — navigate to /settings/sms-providers → page renders without "Access Denied" for admin user
