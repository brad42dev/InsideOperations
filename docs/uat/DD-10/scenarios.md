# UAT Scenarios — DD-10

## Page Load
Scenario 1: [DD-10-012] Dashboards page renders without error — navigate to /dashboards → dashboard list visible, no error boundary ("Something went wrong")
Scenario 2: [DD-10-012] Operations Overview renders without "Unknown widget type" — click "Operations Overview" dashboard → all widgets show content or empty/loading state, no "Unknown widget type" text visible
Scenario 3: [DD-10-012] Equipment Health renders without "Unknown widget type" — open "Equipment Health" dashboard → no "Unknown widget type" text visible in any widget
Scenario 4: [DD-10-012] Executive Summary renders without "Unknown widget type" — open "Executive Summary" dashboard → no "Unknown widget type" text visible in any widget

## Export Data Dialog (per-widget kebab menu)
Scenario 5: [DD-10-002] Widget kebab menu has Export Data item — on any dashboard with widgets, click the ⋯ kebab menu on a widget → menu appears with "Export Data" item visible
Scenario 6: [DD-10-002] Export Data dialog opens — click "Export Data" from widget kebab menu → a dialog/modal opens (role="dialog" visible) with export options

## Point Context Menu
Scenario 7: [DD-10-005] Right-click on a point value in a widget shows context menu — right-click on a numeric/text value displayed in a widget → [role="menu"] context menu appears
Scenario 8: [DD-10-005] Point context menu has expected items — after right-clicking a point value → menu contains items like "View Trend", "Add to Forensics", or similar point actions

## UOM Conversion
Scenario 9: [DD-10-007] UOM conversion selector or label visible on widget — open any value/KPI widget config or display → unit of measure label or conversion option visible (e.g., "°C", "°F", "psi", "bar")

## Playback Bar
Scenario 10: [DD-10-008] Playback bar visible in dashboard time-context mode — navigate to a dashboard with time-context enabled or look for a time-mode toggle → playback bar component visible (play/pause button and timeline/scrubber)
Scenario 11: [DD-10-011] Playback bar has play/pause button — when a dashboard is in time-context/playback mode → a play or pause button is visible in the playback bar
Scenario 12: [DD-10-011] Playback bar has timeline scrubber — when playback bar is visible → a timeline or scrubber input element is present
Scenario 13: [DD-10-011] Clicking play button starts playback — click the play button in the playback bar → button changes to pause state or time indicator updates
