---
id: DD-29-016
unit: DD-29
title: Lock screen does not offer PIN entry after PIN is set
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-29/CURRENT.md
---

## What to Build

After a user sets a 6-digit PIN via the profile page (/profile → Security → Set PIN), the lock screen dialog should offer PIN-based unlock as an alternative to password. Currently the lock screen always shows only the password field, regardless of whether a PIN has been configured.

The correct behavior: when the authenticated user has a PIN set, the lock screen dialog should display a PIN entry field (or a toggle/tab allowing the user to switch between "PIN" and "Password" unlock). Entering the correct 6-digit PIN should dismiss the lock screen exactly as a correct password does.

## Acceptance Criteria

- [ ] When a user has a PIN set, locking the screen shows PIN entry (field or tab) alongside or instead of password
- [ ] Entering the correct 6-digit PIN on the lock screen dismisses the dialog and resumes the session
- [ ] When no PIN is set, the lock screen shows password-only (current behavior is correct for this case)
- [ ] The PIN verify path calls POST /api/auth/pin/verify (or equivalent) — not the password verify endpoint

## Verification Checklist

- [ ] Navigate to /profile → Security → Set PIN → enter 123456/123456/changeme → Save PIN → success toast
- [ ] Click "Lock Screen" from admin user menu → lock dialog shows a PIN input field or "Use PIN" option
- [ ] Enter 123456 in the PIN field → click Unlock → dialog dismisses (session resumes)
- [ ] No "Unable to verify" or 404 error in browser console
- [ ] Remove PIN via /profile → lock screen again → PIN option is gone, only password shown

## Do NOT

- Do not stub this with a TODO comment — that's what caused the failure
- Do not implement only the happy path — test that PIN entry actually dismisses the lock screen

## Dev Notes

UAT failure from 2026-03-24: PIN was set successfully (POST /api/auth/pin returned 200, "PIN set successfully." toast shown), but subsequent lock screen dialog showed only the Password field with no PIN entry option.
Screenshot: docs/uat/DD-29/s8-lock-screen-no-pin-option.png
Spec reference: DD-29-015 (PIN set/delete/verify endpoints), DD-29-014 (lock/unlock UI)
