# UAT Scenarios — DD-13

## Log Module Stability

Scenario 1: [DD-13-015] Log module loads without crash — navigate to /log → page renders without error boundary ("Log failed to load" text NOT present)
Scenario 2: [DD-13-015] Template editor renders on direct navigation — navigate to /log/templates/new/edit → editor renders with form/editor UI, no "Log failed to load" error boundary visible
Scenario 3: [DD-13-015] Template editor via click flow — navigate to /log, find Templates tab, click "New Template" → template editor renders with name/title field and body editor area (no crash)
Scenario 4: [DD-13-015] Reload template editor route — navigate directly to /log/templates/new/edit and take snapshot → no crash, no "allSegments.filter is not a function" error boundary
Scenario 5: [DD-13-015] Existing template opens without crash — if templates exist in the list, click edit/open on one → template editor opens without error boundary
Scenario 6: [DD-13-015] Template editor has expected fields — on template editor page → a name/title input and a rich-text body editor area are visible
