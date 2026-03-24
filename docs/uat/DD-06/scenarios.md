# UAT Scenarios — DD-06

## App Shell Basic Rendering
Scenario 1: [DD-06-019] App shell renders without error — navigate to /console → page loads with navigation, no error boundary text

## G-Key Navigation Overlay
Scenario 2: [DD-06-019] G-key hint overlay appears — press G on /console → hint overlay appears with "Go to" text and module shortcuts listed
Scenario 3: [DD-06-019] Overlay lists correct module shortcuts — after pressing G → overlay shows key letters (P, R, D, etc.) for modules
Scenario 4: [DD-06-019] G+P navigates to /process — press G then P on /console → URL changes to /process, overlay dismissed
Scenario 5: [DD-06-019] G+R navigates to /reports — navigate back to /console, press G then R → URL changes to /reports
Scenario 6: [DD-06-019] G+D navigates to /designer — navigate back to /console, press G then D → URL changes to /designer
Scenario 7: [DD-06-019] Overlay auto-dismisses after timeout — press G then wait 2.5s → overlay disappears without navigation, URL stays at /console
