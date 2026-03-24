# UAT Scenarios — DD-13

## Log Module Renders

Scenario 1: [DD-13-007] Log module loads without error — navigate to /log → log module UI visible, no "Something went wrong" error boundary
Scenario 2: [DD-13-008] Log module renders schedule management section — navigate to /log → page shows real UI content (not stub placeholder or blank)

## Log Search Filter Controls (DD-13-007)

Scenario 3: [DD-13-007] Date filter control present in log search — navigate to /log, look at search/filter area → date filter input or date picker visible
Scenario 4: [DD-13-007] Author filter control present in log search — navigate to /log, look at search/filter area → author filter control visible
Scenario 5: [DD-13-007] Shift filter control present in log search — navigate to /log, look at search/filter area → shift filter control visible
Scenario 6: [DD-13-007] Template filter control present in log search — navigate to /log, look at search/filter area → template filter control visible
Scenario 7: [DD-13-007] Applying date filter is interactive — click date filter control → filter responds (opens picker, updates list, or shows active state)

## Log Schedule Management UI (DD-13-008)

Scenario 8: [DD-13-008] Schedule management section exists — navigate to /log and look for schedule or templates tab/section → schedule management area visible (not a TODO stub)
Scenario 9: [DD-13-008] Schedule management shows interactive UI — navigate to log schedule area → shows real controls (create/edit buttons, list of schedules, or form — not static text)
Scenario 10: [DD-13-008] Schedule create/edit button is present and clickable — find create or add schedule button → clicking it produces visible change (dialog opens, form expands — not a no-op)
