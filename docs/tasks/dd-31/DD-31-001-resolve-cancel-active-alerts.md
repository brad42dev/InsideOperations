---
id: DD-31-001
title: Add Resolve and Cancel actions to active alert cards
unit: DD-31
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

Each active alert card in the Active Alerts view must expose two action buttons: "Mark Resolved" and "Cancel". Clicking "Mark Resolved" calls `POST /api/notifications/:id/resolve` and moves the alert out of the active list. Clicking "Cancel" calls `POST /api/notifications/:id/cancel`, stops any escalation, and removes the alert from the active list. Both actions require `alerts:send` permission and must be hidden (not disabled) from users without it.

## Spec Excerpt (verbatim)

> `[View Details]  [Mark Resolved]`
>
> Active means sent but not yet resolved or cancelled.
> — `31_ALERTS_MODULE.md`, §Main View: Active & Recent Alerts

> `POST /api/notifications/:id/resolve` — Mark a notification as resolved. Permission: `alerts:send`
> `POST /api/notifications/:id/cancel` — Cancel a notification (stops escalation). Permission: `alerts:send`
> — `31_ALERTS_MODULE.md`, §API Endpoints / Notification History

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/alerts/index.tsx` lines 521–599 — `ActiveAlertsPanel` component; add action buttons here
- `frontend/src/api/notifications.ts` — add `resolveMessage` and `cancelMessage` API methods
- `frontend/src/App.tsx` lines 646–665 — route guards (no change needed, already guarded by `alerts:read`)

## Verification Checklist

- [ ] Each active alert card renders a "Mark Resolved" button that calls `POST /api/notifications/:id/resolve`
- [ ] Each active alert card renders a "Cancel" button that calls `POST /api/notifications/:id/cancel`
- [ ] Both buttons are hidden (not disabled) when user lacks `alerts:send` permission
- [ ] After success, the card is removed from the active list (invalidate `notification-active` query)
- [ ] `notificationsApi` in `notifications.ts` has `resolveMessage(id)` and `cancelMessage(id)` methods

## Assessment

- **Status**: ❌ Missing
- **If missing**: `ActiveAlertsPanel` in `index.tsx:521-599` shows severity, title, channels, recipients, and a "Muster" navigation button, but no Resolve or Cancel actions. The `notificationsApi` in `notifications.ts` has no resolve or cancel methods.

## Fix Instructions

1. In `frontend/src/api/notifications.ts`, add two methods to `notificationsApi`:
   ```ts
   resolveMessage(id: string): Promise<ApiResult<void>> {
     return api.post(`/api/notifications/messages/${id}/resolve`, {})
   },
   cancelMessage(id: string): Promise<ApiResult<void>> {
     return api.post(`/api/notifications/messages/${id}/cancel`, {})
   },
   ```
2. In `frontend/src/pages/alerts/index.tsx` inside `ActiveAlertsPanel` (around line 579), add two `useMutation` hooks for resolve and cancel that call the new API methods and invalidate `['notification-active']` on success.
3. In each active alert card's action area (the button area at line 579), add "Mark Resolved" and "Cancel" buttons alongside the existing "Muster" button.
4. Gate visibility on `alerts:send` permission using the existing `usePermission` hook pattern used elsewhere in the codebase (check how `PermissionGuard` is used and whether a hook-level check is available).

Do NOT:
- Disable the buttons instead of hiding them — they must be absent for unauthorized users
- Call the resolve/cancel endpoints optimistically without confirmation — a brief confirm dialog is appropriate for "Cancel" since it stops escalation
