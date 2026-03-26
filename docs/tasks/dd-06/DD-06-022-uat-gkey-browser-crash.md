---
id: DD-06-022
unit: DD-06
title: G-key keyboard handler causes browser crash / page navigation to about:blank
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-06/CURRENT.md
---

## What to Build

During UAT, pressing the G key in the app shell (from /console, with body focus) intermittently causes the browser page to navigate to about:blank — a full page crash/unload. This happened on multiple attempts when using browser_press_key to dispatch a real keyboard event to the page.

Observed in UAT 2026-03-25:
- First G press: overlay appeared correctly ✅
- Subsequent G presses (after page reloads/state resets): page navigated to about:blank ❌

This suggests the G-key handler may be triggering a navigation side effect, throwing an unhandled exception that crashes the renderer, or interacting badly with the page lifecycle in a way that causes the page to unload.

The prior DD-06-019 fix specifically noted "trusted keyboard events" as a factor — the Strict Mode ref reset may have introduced a condition where a stale ref causes a crash on repeated G presses.

## Acceptance Criteria

- [ ] Pressing G on /console from BODY focus does not crash the page or navigate to about:blank
- [ ] Pressing G 3 times in succession on /console produces 3 overlay appearances and 3 auto-dismissals (no crash)
- [ ] No unhandled exceptions in the browser console during G key navigation sequence

## Verification Checklist

- [ ] Navigate to /console, ensure body has focus, press G three times (waiting 3s between each) — page remains at /console each time
- [ ] Check browser console for unhandled exceptions after each G press
- [ ] Press G then wait 2.5s for auto-dismiss — confirm overlay disappeared and page is still at /console

## Do NOT

- Do not suppress the crash without fixing the root cause
- Do not make the handler a no-op — G-key navigation must still work

## Dev Notes

UAT failure from 2026-03-25: browser_error — browser crashed (page went to about:blank) on G key press.
Crash happened on 2nd and subsequent G presses after prior navigation/page reloads.
Spec reference: DD-06-019 (trusted keyboard events / Strict Mode ref reset)
