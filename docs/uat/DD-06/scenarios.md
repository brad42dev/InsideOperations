# UAT Scenarios — DD-06

## App Shell Baseline
Scenario 1: [DD-06-027] App shell renders without error — navigate to /console → page loads, no error boundary ("Something went wrong") visible
Scenario 2: [DD-06-027] Alert badge renders in header — navigate to /console → header area visible with no broken styling crash

## G-Key Hint Overlay (DD-06-028)
Scenario 3: [DD-06-028] G-key overlay appears after G press — navigate to /console, click body for body focus, press G key, wait 300ms, snapshot → hint overlay visible in DOM with "Go to" text and module shortcut entries (P, D, R)
Scenario 4: [DD-06-028] G-key overlay auto-dismisses — navigate to /console, click body, press G, wait 2500ms, snapshot → overlay is gone, page still at /console, no error boundary

## G-Key Navigation (DD-06-029)
Scenario 5: [DD-06-029] G+P navigates to /process — navigate to /console, click body, press G then P, wait 1000ms, snapshot → content reflects /process route, no error boundary
Scenario 6: [DD-06-029] G+D navigates to /designer — navigate to /console, click body, press G then D, wait 1000ms, snapshot → content reflects /designer route, no error boundary
Scenario 7: [DD-06-029] G+R navigates to /reports — navigate to /console, click body, press G then R, wait 1000ms, snapshot → content reflects /reports route, no error boundary

## Kiosk Mode (DD-06-030)
Scenario 8: [DD-06-030] User menu contains "Enter Kiosk Mode" item — navigate to /console, open user menu (avatar/user button in header), snapshot → "Enter Kiosk Mode" or "Kiosk" option visible in menu
Scenario 9: [DD-06-030] Kiosk mode activation — click "Enter Kiosk Mode", wait 1000ms, snapshot → fullscreen triggered or visible mode change (no silent no-op)
