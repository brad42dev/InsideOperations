---
id: DD-31-002
title: Enforce alerts:send_emergency permission for EMERGENCY-severity sends
unit: DD-31
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

Sending an EMERGENCY-severity alert must require the `alerts:send_emergency` permission, not just `alerts:send`. The UI must route to `/api/notifications/send-emergency` when the severity is EMERGENCY. The "Send Alert" route must check `alerts:send` for non-emergency use and `alerts:send_emergency` must be checked before the user can actually submit with EMERGENCY severity selected.

## Spec Excerpt (verbatim)

> `POST /api/notifications/send-emergency` — Send an emergency notification (same as send, but requires elevated permission). Permission: `alerts:send_emergency`
>
> `alerts:send_emergency` — Send EMERGENCY-severity notifications (triggers full-screen takeover). Default Roles: Admin
>
> `alerts:send_emergency` is intentionally restrictive. During a real emergency, you don't want every user able to trigger a plant-wide full-screen takeover.
> — `31_ALERTS_MODULE.md`, §API Endpoints and §RBAC Permissions

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/alerts/index.tsx` lines 216–236 — `handleSend` / `doSend` — currently calls same `sendMutation` regardless of severity
- `frontend/src/pages/alerts/AlertComposer.tsx` lines 101–113 — `handleSubmit` — same issue
- `frontend/src/api/notifications.ts` lines 164–166 — `sendNotification` method
- `frontend/src/App.tsx` lines 677–686 — `/alerts/send` route only guards `alerts:send`

## Verification Checklist

- [ ] `notificationsApi` has a separate `sendEmergency(payload)` method that POSTs to `/api/notifications/send-emergency`
- [ ] When `severity === 'emergency'`, `doSend` calls `sendEmergency` instead of `sendNotification`
- [ ] The EMERGENCY severity option is hidden (not shown) when the user lacks `alerts:send_emergency` permission
- [ ] Alert composer (AlertComposer.tsx) applies the same separation

## Assessment

- **Status**: ❌ Missing
- **If missing**: `index.tsx:224-236` `doSend()` always calls `sendMutation` which calls `notificationsApi.sendNotification` → `POST /api/notifications/send`. There is no `sendEmergency` API method. The EMERGENCY severity option is available to any user with `alerts:send`. `App.tsx:679` only requires `alerts:send` for the send route.

## Fix Instructions

1. In `frontend/src/api/notifications.ts`, add:
   ```ts
   sendEmergency(payload: SendNotificationPayload): Promise<ApiResult<NotificationMessage>> {
     return api.post('/api/notifications/send-emergency', payload)
   },
   ```
2. In `frontend/src/pages/alerts/index.tsx`, `doSend()` (around line 224): check `severity === 'emergency'` and call `sendEmergencyMutation` (a separate `useMutation` wrapping `notificationsApi.sendEmergency`) instead of `sendMutation`.
3. Apply the same split in `AlertComposer.tsx` `handleSubmit` (line 101).
4. Use a permission check to hide the EMERGENCY severity button/option for users who lack `alerts:send_emergency`. If the user can only send non-emergency alerts, only show CRITICAL/WARNING/INFO options.

Do NOT:
- Use a single endpoint and let the server figure it out — the separate permission check must happen in the UI before the request is made
- Disable the EMERGENCY option — hide it entirely for unauthorized users
