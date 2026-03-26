# UAT Scenarios — DD-06

## App Shell Baseline
Scenario 1: [DD-06-022] Page renders without crash — navigate to /console → page loads, no error boundary, URL stays at /console (not about:blank)

## G-Key Overlay Rendering
Scenario 2: [DD-06-023] G-key overlay appears on G press — navigate to /console, click body, press G → visible hint overlay appears within 100ms containing module shortcuts (P, R, D)
Scenario 3: [DD-06-023] G-key overlay auto-dismisses — press G on /console, wait 2.5s → overlay disappears, URL still /console
Scenario 4: [DD-06-022] G pressed 3 times without crash — press G on /console, wait 3s, press G again, wait 3s, press G again → page remains at /console each time, no crash

## G-Key Navigation
Scenario 5: [DD-06-021] G+P navigates to /process — navigate to /console, press G then P → URL changes to /process within 500ms, overlay dismissed
Scenario 6: [DD-06-024] G+D navigates to /designer — navigate to /console, press G then D → URL changes to /designer within 500ms, overlay dismissed
Scenario 7: [DD-06-021] G+R navigates to /reports — navigate to /console, press G then R → URL changes to /reports within 500ms, overlay dismissed

## Command Palette (cmdk)
Scenario 8: [DD-06-026] Command palette opens with Ctrl+K — press Ctrl+K → command palette dialog opens (role="dialog" or role="combobox" visible)
Scenario 9: [DD-06-026] Command palette fuzzy matching — open palette, type "cons" → "Console" result appears and ranks before less-relevant matches
Scenario 10: [DD-06-026] Command palette close — open palette, press Escape → palette closes
