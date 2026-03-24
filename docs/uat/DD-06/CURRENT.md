---
unit: DD-06
date: 2026-03-24
uat_mode: auto
verdict: fail
scenarios_tested: 6
scenarios_passed: 1
scenarios_failed: 5
scenarios_skipped: 0
---

## Module Route Check

pass: Navigating to /console loads real implementation (app shell with sidebar, topbar, navigation)

## Scenarios

| # | Area | Scenario | Result | Notes |
|---|------|----------|--------|-------|
| 1 | G-Key Navigation | [DD-06-018] Page renders without error | ✅ pass | /console loads correctly |
| 2 | G-Key Navigation | [DD-06-018] G key shows hint overlay | ❌ fail | Hint overlay never appears in DOM after trusted G keypress; setGKeyHintVisible(true) has no visible DOM effect |
| 3 | G-Key Navigation | [DD-06-018] G+P navigates to Process | ❌ fail | URL stayed at /console; spy showed G=prevented:true but P=prevented:false (navigation block never entered) |
| 4 | G-Key Navigation | [DD-06-018] G+R navigates to Reports | ❌ fail | URL stayed at /console |
| 5 | G-Key Navigation | [DD-06-018] G+D navigates to Designer | ❌ fail | URL stayed at /console |
| 6 | G-Key Navigation | [DD-06-018] Hint overlay auto-dismisses | ❌ fail | Cannot verify — overlay never appeared |

## New Bug Tasks Created

DD-06-019 — G-key navigation broken with trusted keyboard events — React Strict Mode ref reset

## Screenshot Notes

- docs/uat/DD-06/scenario2-g-key-after.png — After pressing G, no hint overlay visible in viewport
- docs/uat/DD-06/scenario3-g-p-navigation-fail.png — After G+P, still at /console ("No workspaces yet" state)
- docs/uat/DD-06/scenario2-hint-after-g.png — After fresh G press on /console, still no hint overlay

**Root cause analysis:**
- With JS-dispatched untrusted events, G+letter navigation WORKS (verified: G+P→/process, G+R→/reports, G+D→/designer in ~56ms)
- With Playwright trusted keyboard events (simulating real user input), G is handled (`prevented:true`) but second key is NOT (`prevented:false`)
- MutationObserver confirmed: hint overlay NEVER appears after trusted G press (setGKeyHintVisible(true) has no DOM effect)
- Root cause: React 18 Strict Mode in dev causes AppShell component to remount during G key processing, resetting `gKeyPending` useRef to initial value `false` before the second key fires. The old handler's state setter is orphaned (React silently ignores setState on unmounted component in React 18).
- The feature IS implemented and works with untrusted JS events — the underlying logic (G_KEY_MAP, navigateRef, gKeyPending) is correct.
- Fix needed: either (1) remove StrictMode, (2) store gKeyPending in a module-level variable outside React, or (3) use a stable cross-render mechanism that survives Strict Mode remounts.
