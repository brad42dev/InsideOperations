---
id: DD-29-018
unit: DD-29
title: Lock screen does not display PIN entry option when user has a PIN set
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-29/CURRENT.md
---

## What to Build

The lock screen dialog ("Screen locked") shows only a Password input field regardless of whether the user has set a PIN. After successfully setting a 6-digit PIN via the profile page (POST /api/auth/pin returns 200), the lock screen should detect `has_pin: true` from the session check response and display a PIN entry option alongside or instead of the password field.

**Observed:** Lock screen always shows "Session locked. Enter your password to continue." with a single Password input — even immediately after PIN set successfully.

**Expected:** When `has_pin` is true, the lock screen should show a PIN input field (or a toggle/tab to switch between PIN and password). Entering the correct 6-digit PIN should call POST /api/auth/pin/verify (or equivalent) and dismiss the dialog.

## Acceptance Criteria

- [ ] When a user has a PIN set (`has_pin: true` in session check), locking the screen shows a PIN entry option (input field or "Use PIN" tab) alongside or instead of the password field
- [ ] Entering the correct 6-digit PIN on the lock screen dismisses the dialog and resumes the session
- [ ] When no PIN is set (`has_pin: false`), the lock screen shows password-only (current behavior is correct for this case)
- [ ] The PIN verify path calls POST /api/auth/pin/verify — not the password verify endpoint

## Verification Checklist

- [ ] Navigate to /profile → Security → Set PIN → enter 123456/123456/admin → Save PIN → success toast
- [ ] Click "A admin ▾" in header → click "Lock Screen" → lock dialog shows a PIN input field or "Use PIN" option
- [ ] Enter 123456 in the PIN field → click Unlock → dialog dismisses (session resumes)
- [ ] Navigate back to /profile → click Remove PIN → success → lock screen again → PIN option is gone, only password shown

## Do NOT

- Do not stub this with a TODO comment — that's what caused the failure
- Do not implement only the happy path — the lock screen must actually check has_pin state

## Dev Notes

UAT failure 2026-03-25: Lock screen dialog shows only Password field. POST /api/auth/pin returns 200 and profile shows "PIN set successfully." toast — so the PIN is stored server-side. The lock screen component is not reading `has_pin` from the session check endpoint or is not re-fetching it when the lock dialog opens. The `GET /api/auth/me` or session check response should include `has_pin: bool`; the lock screen component must check this before rendering.

Spec reference: DD-29-016 (original UAT bug), DD-29-011 (PIN endpoints spec), DD-29-017 (PIN set 401 fix)
Screenshot: docs/uat/DD-29/dd-29-scenario9-lock-no-pin.png
