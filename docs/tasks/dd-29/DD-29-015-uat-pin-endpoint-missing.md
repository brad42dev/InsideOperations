---
id: DD-29-015
unit: DD-29
title: PIN set/delete/verify endpoints missing — /api/auth/pin returns 404
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-29/CURRENT.md
---

## What to Build

The PIN management API endpoint `/api/auth/pin` is missing from the backend. The frontend UI for PIN setup is fully implemented and well-formed (the Profile page at /profile has a "Lock Screen PIN" section with a Set PIN form containing New PIN, Confirm PIN, and Current Password fields), but clicking "Save PIN" results in a 404 and the error "Failed to parse server response".

The following REST endpoints are required:

1. `POST /api/auth/pin` — Set or change the user's lock screen PIN. Body: `{ pin: string, currentPassword: string }`. Should validate PIN is 6 digits and password is correct.
2. `DELETE /api/auth/pin` — Remove the user's lock screen PIN. Body: `{ currentPassword: string }`.
3. `POST /api/auth/pin/verify` (or equivalent) — Verify a PIN during lock screen unlock. Called when the user enters their PIN on the lock screen instead of their password.

Once a PIN is set, the lock screen should offer PIN entry as an alternative to the password.

## Acceptance Criteria

- [ ] `POST /api/auth/pin` accepts a 6-digit PIN + current password and persists the PIN hash for the user
- [ ] `DELETE /api/auth/pin` removes the PIN for the user (requires current password)
- [ ] Lock screen shows PIN entry option once a PIN has been set
- [ ] Lock screen allows unlock via PIN OR password
- [ ] "Remove PIN" button on profile page works when a PIN is set

## Verification Checklist

- [ ] Navigate to /profile → Security → "Set PIN" → enter 123456 / 123456 / admin → click "Save PIN" → success (no "Failed to parse server response")
- [ ] After setting PIN: click "Lock Screen" from user menu → lock dialog shows both "PIN" and "Password" options (or a single PIN field replacing/supplementing password)
- [ ] Enter PIN 123456 on lock screen → unlocks session
- [ ] Navigate back to /profile → click "Remove PIN" → PIN is removed → lock screen returns to password-only
- [ ] No 404 on /api/auth/pin in browser console

## Do NOT

- Do not stub this with a TODO comment
- Do not implement only PIN set — delete and verify paths are equally required

## Dev Notes

UAT failure from 2026-03-24:
- POST /api/auth/pin → 404 Not Found
- UI shows: "Failed to parse server response" alert on PIN form submission
- Screenshot: docs/uat/DD-29/fail-pin-endpoint-404.png
Spec reference: DD-29-011 (Add PIN set/delete/verify endpoints for lock screen unlock)
