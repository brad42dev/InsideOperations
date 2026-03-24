---
id: DD-29-017
unit: DD-29
title: PIN set endpoint returns 401 Unauthorized — lock screen PIN cannot be set
status: pending
priority: high
depends-on: []
source: uat
uat_session: docs/uat/DD-29/CURRENT.md
---

## What to Build

The POST /api/auth/pin endpoint returns 401 Unauthorized when an authenticated user attempts to set a 6-digit lock screen PIN from the profile page (/profile). The UI correctly renders the PIN setup form (New PIN, Confirm PIN, Current Password fields) and sends the request, but the backend rejects it with 401.

This prevents the core feature of DD-29-016 from being verified: the lock screen cannot offer PIN entry because no PIN can be persisted.

Observed: POST /api/auth/pin → 401 Unauthorized → UI shows "Failed to set PIN. Please try again."
Expected: POST /api/auth/pin with valid credentials → 200 OK → PIN saved, lock screen shows PIN entry option.

Note: The prior task DD-29-015 reported a 404 on this endpoint. The endpoint now exists (returns 401 instead of 404), suggesting partial implementation. The auth gate on this route may be mis-configured (e.g., requiring a wrong scope or role, or rejecting the session token format).

## Acceptance Criteria

- [ ] POST /api/auth/pin with a valid session JWT, 6-digit PIN, and correct current password returns 200 (not 401)
- [ ] After a successful PIN set, the lock screen dialog shows a PIN entry option alongside the password field
- [ ] The PIN verify path calls POST /api/auth/pin/verify (or the established equivalent) — not the password verify endpoint
- [ ] DELETE /api/auth/pin to remove the PIN returns 200 (not 401)

## Verification Checklist

- [ ] Navigate to /profile → Security → click "Set PIN" → enter 123456 / 123456 / admin → click "Save PIN" → success toast (no "Failed to set PIN" error)
- [ ] Click "A admin ▾" in header → click "Lock Screen" → lock dialog shows both PIN and Password input options (or PIN field prominently)
- [ ] Enter 123456 in the PIN field → click Unlock → dialog dismisses
- [ ] Navigate back to /profile → click "Remove PIN" → success → lock screen returns to password-only

## Do NOT

- Do not stub the endpoint with a 200 that doesn't actually persist the PIN
- Do not change the endpoint path without updating the frontend PIN setup form to match

## Dev Notes

UAT failure from 2026-03-24: POST http://localhost:5173/api/auth/pin → 401 Unauthorized
Console error: "Failed to load resource: the server responded with a status of 401 (Unauthorized) @ http://localhost:5173/api/auth/pin"
Screenshot: docs/uat/DD-29/scenario4-pin-save-fail.png
Spec reference: DD-29-011 (Add PIN set/delete/verify endpoints), DD-29-015 (PIN endpoints missing — prior UAT fail), DD-29-016 (Lock screen PIN entry — this session)
