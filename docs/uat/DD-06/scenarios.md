# UAT Scenarios — DD-06

Focus: DD-06-026 (command palette cmdk fuzzy matching)
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

## Command Palette — cmdk Fuzzy Matching

Scenario 8: [DD-06-026] App shell renders without error — navigate to /console → page loads with sidebar and header, no error boundary text

Scenario 9: [DD-06-026] Command palette opens via Ctrl+K — press Ctrl+K on /console → command palette dialog appears with search input visible

Scenario 10: [DD-06-026] Command palette has search input — after opening palette → search input field is present and focused

Scenario 11: [DD-06-026] Fuzzy match "mcr" finds "Main Control Room" — open palette, type "mcr" → "Main Control Room" appears in results (fuzzy match via cmdk)

Scenario 12: [DD-06-026] Fuzzy match partial word "cons" finds Console — open palette, type "cons" → "Console" or console-related navigation item appears in results

Scenario 13: [DD-06-026] Command palette closes on Escape — open palette, press Escape → palette dialog disappears
