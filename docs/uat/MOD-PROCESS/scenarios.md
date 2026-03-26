# UAT Scenarios — MOD-PROCESS

6 tasks to UAT: MOD-PROCESS-012, MOD-PROCESS-015, MOD-PROCESS-019, MOD-PROCESS-023,
MOD-PROCESS-024, MOD-PROCESS-025

## Page Load & Module Health
Scenario 1: [MOD-PROCESS-023] Process page renders without error — navigate to /process → page loads, no error boundary ("Something went wrong"), module content visible
Scenario 2: [MOD-PROCESS-025] — data flow: GET /api/v1/process/views — navigate to /process, wait 3 seconds → either a graphic/view loads on canvas OR an empty-state message appears (no error boundary, no crash, not stuck "Loading...")

## View Toolbar Contents
Scenario 3: [MOD-PROCESS-023] Minimap toggle button in main toolbar — navigate to /process, snapshot toolbar → a Map/Minimap toggle button is present in the view toolbar alongside zoom controls
Scenario 4: [MOD-PROCESS-025] Open in New Window button in main toolbar — navigate to /process, snapshot toolbar → an "Open in New Window" or external-link button is visible in the view toolbar

## Bookmark Creation Dialog
Scenario 5: [MOD-PROCESS-015] Bookmark ★ button visible in toolbar — navigate to /process, snapshot → a ★ bookmark button is present in the view toolbar
Scenario 6: [MOD-PROCESS-015] Clicking ★ opens Name/Description dialog — navigate to /process, click ★ button → [role="dialog"] appears with a Name input field and a Description input field
Scenario 7: [MOD-PROCESS-015] Bookmark dialog blocks empty-Name submit — with dialog open, leave Name empty and click Save/Confirm → validation prevents submit, Name field shows an error; dialog stays open

## Kiosk Mode — Chrome Hidden
Scenario 8: [MOD-PROCESS-024] Kiosk mode hides "Process" heading/banner — navigate to /process?kiosk=true → no heading "Process" or banner element visible in accessibility snapshot
Scenario 9: [MOD-PROCESS-019] Kiosk mode hides view toolbar — navigate to /process?kiosk=true → zoom controls, Live/Historical buttons, Export, and Print are NOT visible in snapshot
Scenario 10: [MOD-PROCESS-019] Kiosk mode hides breadcrumb nav — navigate to /process?kiosk=true → no breadcrumb nav bar visible
Scenario 11: [MOD-PROCESS-024] Escape exits kiosk mode — navigate to /process?kiosk=true, press Escape → "Process" heading/banner is restored in snapshot

## Navigate-Away Toast Infrastructure
Scenario 12: [MOD-PROCESS-012] Toast container present — navigate to /process → an aria-live region or role="status" toast container exists in DOM (evidence that toast infrastructure is wired up)
