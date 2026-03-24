---
id: DD-29-014
unit: DD-29
title: Session lock/unlock API endpoints missing — /api/auth/lock and /api/auth/verify-password return 404
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-29/CURRENT.md
---

## What to Build

Two API endpoints are missing from the backend, causing the lock screen feature to be client-side only:

1. `POST /api/auth/lock` — Lock the current session server-side. Returns 404 currently. This is called when the user clicks "Lock Screen" in the user menu. Without this endpoint, the lock state is not persisted server-side, WebSocket events are not pushed on lock, and the session is not actually locked from a security standpoint.

2. `POST /api/auth/verify-password` — Verify the user's password to unlock the session. Returns an error currently (observed "Unable to verify. Check your connection." in the UI). This endpoint is called when the user enters their password in the lock screen and clicks "Unlock".

The UI for the lock screen dialog (DD-29-010 task requirement) exists and works correctly on the client side — it shows a dialog with the password field, user avatar, and Unlock button. The missing piece is the server-side persistence.

## Acceptance Criteria

- [ ] `POST /api/auth/lock` responds with 200 and persists the lock state for the session server-side
- [ ] `POST /api/auth/verify-password` responds with 200 and allows the UI to dismiss the lock screen on correct password
- [ ] Lock screen unlock succeeds with correct password (admin/admin in dev)
- [ ] WebSocket event is pushed to client on lock/unlock (per task DD-29-010 title)

## Verification Checklist

- [ ] Navigate to /console, click "A admin ▾" → "Lock Screen" → lock dialog appears
- [ ] Enter "admin" password in lock screen → Unlock button enables → click Unlock → dialog dismisses (no "Unable to verify" error)
- [ ] Network tab (or console) shows no 404 on /api/auth/lock when locking
- [ ] Network tab shows no error on /api/auth/verify-password when unlocking

## Do NOT

- Do not stub these with TODO comments — that's what caused the UAT failure
- Do not implement only the lock path — the unlock path must also work

## Dev Notes

UAT failure from 2026-03-24:
- /api/auth/lock → 404 Not Found (observed in browser console on lock)
- /api/auth/verify-password → error response (observed "Unable to verify. Check your connection." on unlock attempt)
- Screenshot: docs/uat/DD-29/fail-lock-screen-no-pin-field.png
Spec reference: DD-29-010 (Persist session lock state server-side and push WebSocket events on lock/unlock)
