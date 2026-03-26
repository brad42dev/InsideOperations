---
id: DD-32-023
unit: DD-32
title: Success toast auto-dismiss regression unverifiable — backend returns 404 on all workspace creation calls
status: pending
priority: high
depends-on: [DD-32-022]
source: uat
uat_session: docs/uat/DD-32/CURRENT.md
---

## What to Build

UAT session 2026-03-26 verified that error toasts now correctly persist until manually dismissed (DD-32-018/021 fix confirmed). However, the regression check — confirming that success/info toasts still auto-dismiss after ~5 seconds — could not be performed because the backend returns 404 for all workspace creation calls, making it impossible to trigger a success toast.

This task tracks the required regression verification:
- Success toasts (green/teal variant) must auto-dismiss after ~5 seconds
- Error toasts (red variant) must NOT auto-dismiss — user must click × to dismiss
- These two behaviors must coexist correctly in the Toast/NotificationStore

## Acceptance Criteria

- [ ] Error variant toasts do NOT auto-dismiss — persist until user clicks × (already verified ✅)
- [ ] Success/info variant toasts DO auto-dismiss after ~5 seconds (needs verification)
- [ ] No setTimeout or auto-dismiss timer is attached to error toast instances
- [ ] After clicking × on error toast it disappears immediately (already verified ✅)

## Verification Checklist

- [ ] Navigate to /console, trigger a success toast (create workspace successfully with working backend)
- [ ] Wait 8 seconds → success toast has auto-dismissed
- [ ] Trigger an error toast (cause a backend failure)
- [ ] Wait 10 seconds → error toast still visible
- [ ] Click × on error toast → disappears immediately
- [ ] Both behaviors verified in the same session

## Do NOT

- Do not introduce a timer on error toasts
- Do not remove auto-dismiss from success toasts

## Dev Notes

UAT failure from 2026-03-26: Success toast auto-dismiss regression could not be tested because backend always returned 404 on workspace creation — only error toasts could be triggered during this session.
Error toast persistence is confirmed working (Scenarios 7, 8 passed in 2026-03-26 session).
Spec reference: DD-32-018, DD-32-021
Depends on: DD-32-022 (backend must be functional to trigger success toasts)
