# UAT Scenarios — DD-06

## App Shell Renders
Scenario 1: [DD-06-008] App shell renders without error — navigate to /console → page loads without error boundary, nav and header visible

## G-Key Navigation Hint Overlay
Scenario 2: [DD-06-003] G-key hint panel appears — navigate to /console, press G key → small hint panel appears near bottom-left showing "Go to…" with module shortcuts
Scenario 3: [DD-06-015] G-key hint panel shows correct shortcuts — panel contains at minimum C/Console, P/Process entries with kbd hints
Scenario 4: [DD-06-015] G-key hint auto-dismisses — press G key, wait 2+ seconds → panel disappears automatically
Scenario 5: [DD-06-015] G-key Escape dismissal — press G key then press Escape → panel dismisses without navigating
Scenario 6: [DD-06-003] G-key navigation works — press G then C → navigates to console module (or stays if already on console)

## Lock Overlay
Scenario 7: [DD-06-016] Lock button visible in header — navigate to /console → lock icon/button present in top bar
Scenario 8: [DD-06-016] Lock overlay appears on trigger — click lock button → full-screen lock overlay appears covering viewport
Scenario 9: [DD-06-016] Lock overlay has password input — overlay contains password/PIN input and an unlock/submit button

## ErrorBoundary Label
Scenario 10: [DD-06-017] ErrorBoundary "Reload Module" label — inject a React render error via browser_evaluate → error boundary renders with "Reload Module" button text
Scenario 11: [DD-06-008] ErrorBoundary button text verified — check source-level that button reads "Reload Module" not "Try again"
