# UAT Scenarios — DD-27

Tasks to test: DD-27-012, DD-27-013
Route: /alerts

## Alerts Module Load

Scenario 1: [DD-27-012] Alerts page renders without error — navigate to /alerts → page loads without error boundary ("Alerts failed to load" or "Something went wrong" not visible)
Scenario 2: [DD-27-012] No templates.find crash — navigate to /alerts → page is interactive, no crash; module shows content or empty state
Scenario 3: [DD-27-012] Empty state when no templates — navigate to /alerts templates section → appropriate empty state shown (not error boundary)

## Alert Composer / Channel Adapters

Scenario 4: [DD-27-013] Alert composer opens — click "New Alert" or equivalent compose button → alert composer dialog/panel opens without error
Scenario 5: [DD-27-013] Channel options visible in composer — open composer → SMS, PA, Radio, or Push channel checkboxes/options visible
Scenario 6: [DD-27-013] SMS channel checkbox toggleable — open composer, find SMS checkbox → click to toggle → state changes, no error
Scenario 7: [DD-27-013] Templates section renders — navigate to templates tab/section in alerts module → renders without error (empty state or list visible)
