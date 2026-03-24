# UAT Scenarios — DD-27

## Module Load

Scenario 1: [DD-27-014] Alerts module renders without error — navigate to /alerts → page loads, no "Something went wrong" error boundary, no "Alerts failed to load" message

## Send Alert Composer

Scenario 2: [DD-27-014] Send Alert tab is visible and clickable — navigate to /alerts, look for Send Alert or compose tab/button → click it, composer view becomes visible

Scenario 3: [DD-27-014] Channels section shows all channel types — with composer open, look for Channels section → websocket, sms, pa (public address), radio, and push (BrowserPush) checkboxes all present (not just websocket alone)

Scenario 4: [DD-27-014] SMS channel checkbox is toggleable — click SMS checkbox in Channels section → checkbox state changes (checked/unchecked), no error or crash

Scenario 5: [DD-27-014] PA channel checkbox is toggleable — click PA (public address) checkbox in Channels section → checkbox state changes, no error

Scenario 6: [DD-27-014] Custom Alert template updates channels — if a template selector exists in the composer, select "Custom Alert" template → channels section reflects that template's configured channels

## Templates Section

Scenario 7: [DD-27-014] Alert templates section renders — navigate to /alerts, find Templates tab or section → renders without error (empty state or list of templates)
