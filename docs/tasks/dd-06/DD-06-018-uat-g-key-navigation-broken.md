---
id: DD-06-018
unit: DD-06
title: G+letter navigation does not execute after hint overlay appears
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-06/CURRENT.md
---

## What to Build

The G-key hint overlay appears correctly when G is pressed (spec requirement met), but pressing the second key (e.g., P for Process, R for Reports) does not trigger navigation. The `navigate(path)` call in the `handleKeyDown` closure of AppShell.tsx is either not being reached or not functioning when invoked via keyboard events.

**Observed:** Press G → hint overlay appears (✅). Press P immediately → URL stays on /console, no navigation (❌).

**Expected:** Press G → hint overlay appears. Press P → navigate to /process, hint dismisses.

The issue was reproducible with both Playwright `browser_press_key` and `window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p', ... }))`. The `gKeyPending.current` ref should be `true` when P fires, and `G_KEY_MAP['p']` should resolve to `/process`. Investigate why the `navigate(path)` call is silently no-oping after the G key sets `gKeyPending.current = true`.

Possible causes:
1. The `navigate` function captured in the `useEffect([navigate])` closure is stale or behaving unexpectedly with React Router's internal state after a page load.
2. The `gKeyPending` ref is being reset between G and the second key press (e.g., a scroll or resize event on the palette triggering a re-render that resets the ref).
3. React Router's `useNavigate` returns a no-op when called from a window event listener rather than a synthetic React event (unlikely but worth checking).

## Acceptance Criteria

- [ ] Press G on /console, then P → navigates to /process within 500ms
- [ ] Press G on /console, then R → navigates to /reports within 500ms
- [ ] Press G on /console, then D → navigates to /designer within 500ms
- [ ] The hint overlay dismisses immediately when the second key navigates

## Verification Checklist

- [ ] Navigate to /console, press G → hint overlay appears with "Go to…" panel
- [ ] Immediately press P → URL changes to /process and hint dismisses
- [ ] Navigate to /console, press G → hint overlay appears
- [ ] Immediately press R → URL changes to /reports and hint dismisses
- [ ] No console errors during the key sequence

## Do NOT

- Do not stub this with a TODO comment
- Do not break the existing hint overlay display (Scenarios 2–5 passed and must remain passing)
- Do not change the G_KEY_MAP key assignments

## Dev Notes

UAT failure from 2026-03-24: G key sets gKeyPending.current = true and hint shows, but second key press does not trigger navigate(). Confirmed with both Playwright keyboard events and window.dispatchEvent. Screenshot: docs/uat/DD-06/fail-scenario6-g-key-navigation.png.
Spec reference: DD-06-003, DD-06-015 (both relate to G-key navigation).
