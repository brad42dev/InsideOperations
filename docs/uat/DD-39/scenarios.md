# UAT Scenarios — DD-39

## Page Load

Scenario 1: [DD-39-011] Designer page renders without error — navigate to /designer → no error boundary ("Something went wrong") visible

## Custom Shapes Section

Scenario 2: [DD-39-011] /designer/symbols loads Custom Shapes section — navigate to /designer/symbols → Custom Shapes or "My Shapes" section is visible in the UI

Scenario 3: [DD-39-011] Custom Shapes shows empty state message, not API error — navigate to /designer/symbols → empty state message ("No custom shapes yet" or similar) visible; no "Failed to parse server response" or "404" error text visible

Scenario 4: [DD-39-011] Upload SVG button is present — navigate to /designer/symbols → Upload SVG or equivalent button visible in Custom Shapes section

Scenario 5: [DD-39-011] Clicking Upload button produces visible change — click Upload SVG button → file picker or dialog appears (not a silent no-op)

Scenario 6: [DD-39-011] /api/v1/shapes/user does not return 404 — navigate to /designer/symbols, check network → GET /api/v1/shapes/user returns HTTP 200, not 404
