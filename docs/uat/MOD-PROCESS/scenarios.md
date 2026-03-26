# UAT Scenarios — MOD-PROCESS

Tasks under test: MOD-PROCESS-011, MOD-PROCESS-020
Both had uat_status=partial (prior session crashed) — full retest required.

Seed data status: UNAVAILABLE (psql not accessible)

## Page Load & Module Health

Scenario 1: [MOD-PROCESS-011] Process page renders without error — navigate to /process → page loads, no error boundary ("Something went wrong"), no blank page, module content visible

Scenario 2: [MOD-PROCESS-011] — data flow: GET /api/v1/process/graphics — navigate to /process, wait 3s, snapshot → UI shows either a graphic view, a graphic selection list, or an empty-state message. Must NOT show error boundary or loading spinner stuck indefinitely.

## Zoom Controls (MOD-PROCESS-011)

Scenario 3: [MOD-PROCESS-011] Zoom status bar is present — navigate to /process, snapshot → zoom percentage readout visible in status bar or toolbar area

Scenario 4: [MOD-PROCESS-011] Zoom controls visible in toolbar — navigate to /process, snapshot → zoom-in, zoom-out, or zoom-to-fit button visible in view toolbar

Scenario 5: [MOD-PROCESS-011] Zoom max is not capped at 500% — navigate to /process, click zoom-in repeatedly, snapshot → zoom indicator shows value above 500% possible, or no hard 500% cap label visible. Note: pinch-to-zoom cannot be simulated in auto mode without touch hardware.

## PointContextMenu (MOD-PROCESS-020)

Scenario 6: [MOD-PROCESS-020] Right-click on canvas area is stable — navigate to /process, right-click on canvas, snapshot → page remains stable (no crash, no error boundary)

Scenario 7: [MOD-PROCESS-020] PointContextMenu renders with required items when bound element right-clicked — if graphic loaded with bound elements, right-click → menu has "Point Detail" and "Copy Tag Name". Pass if visible; skip-note if no graphic loaded.

Scenario 8: [MOD-PROCESS-020] Investigate Alarm absent for non-alarm elements — right-click non-alarm element → "Investigate Alarm" is NOT present in menu (isAlarm defaults false for non-alarm elements).

## Edge Cases

Scenario 9: [MOD-PROCESS-011] Process module sidebar/graphic list visible — navigate to /process, snapshot → sidebar or graphic selection panel present

Scenario 10: [MOD-PROCESS-011] Kiosk mode hides chrome — navigate to /process?kiosk=true, snapshot → no top navigation bar, canvas fills viewport or empty-state without chrome
