# UAT Scenarios — DD-06

Focus: DD-06-011 (LockOverlay rewrite — retesting after partial session)
Note: Lock Screen button confirmed at AppShell.tsx:1836 — user menu contains "Lock Screen" option.

## App Shell Baseline

Scenario 1: [DD-06-011] App shell renders without error — navigate to /console → page loads with sidebar and header, no error boundary text ("Something went wrong")

## Lock Overlay — Passive State

Scenario 2: [DD-06-011] Lock overlay not visible on page load — navigate to /console, inspect DOM snapshot → no lock overlay or lock-class elements visible; page content normally accessible

## Lock Overlay — Trigger via User Menu

Scenario 3: [DD-06-011] Lock Screen button present in user menu — click user avatar/menu button in header → dropdown opens and "Lock Screen" option is visible

Scenario 4: [DD-06-011] Lock overlay appears immediately on Lock Screen click — click Lock Screen from user menu → overlay becomes visible within 1s (lockImmediate=true per source); overlay card is visible over page content

Scenario 5: [DD-06-011] Lock overlay shows password input for local admin account — after triggering lock via user menu → password input field visible in lock card (admin is local account; no PIN set by default, so password unlock shown)

Scenario 6: [DD-06-011] Lock overlay does not bypass auth on background click — after overlay appears, click the overlay background area → overlay stays visible (no click-to-dismiss behavior)

Scenario 7: [DD-06-011] Lock overlay has sign-out option — after triggering lock → sign out or emergency exit link visible in overlay card (spec: sign-out fallback always present)
