# UAT Scenarios — DD-12

## Page Renders

Scenario 1: [DD-12-010] Forensics page renders without error — navigate to /forensics → page loads with no error boundary ("Something went wrong")
Scenario 2: [DD-12-012] Forensics empty state loads without error — navigate to /forensics → page loads, no error boundary, content or empty state visible

## Historical Playback Bar (DD-12-010)

Scenario 3: [DD-12-010] No datetime-local input in investigation workspace — navigate to /forensics, open an investigation → no raw datetime-local input visible for graphic snapshot timestamp control
Scenario 4: [DD-12-010] Historical Playback Bar present in investigation workspace — navigate to /forensics, open an investigation → Playback Bar component visible (slider or playback controls, not a raw date input)

## Empty State and Loading (DD-12-012)

Scenario 5: [DD-12-012] Empty state CTA visible to admin — navigate to /forensics with no investigations → CTA button/link visible (e.g., "Create Investigation" or "New Investigation")
Scenario 6: [DD-12-012] Heatmap renders without obvious hardcoded colors — if heatmap is visible, it uses theme-consistent styling (not bright hardcoded colors inconsistent with theme)
Scenario 7: [DD-12-012] Loading skeleton appears during load — navigate to /forensics → skeleton/loading indicator or content loads without error

## Investigation Workspace

Scenario 8: [DD-12-010] Investigation workspace loads and shows panels — open an investigation from the list → workspace panels appear, no error boundary
Scenario 9: [DD-12-012] Empty state message shown when no investigations — if investigation list is empty → empty state message visible with a CTA
