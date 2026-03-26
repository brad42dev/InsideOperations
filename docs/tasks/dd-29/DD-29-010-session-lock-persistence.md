---
id: DD-29-010
unit: DD-29
title: Persist session lock state server-side and push WebSocket events on lock/unlock
status: pending
priority: high
depends-on: [DD-29-009]
source: feature
decision: docs/decisions/visual-lock-overhaul.md
---

## What to Build

Make the visual lock screen's locked/unlocked state durable. Currently `isLocked` lives only
in Zustand — a page refresh while locked produces an unlocked session. This task makes lock
state survive refreshes and synchronise across all open tabs.

### Two deliverables

**1. Lock/unlock endpoints in auth-service**

```
POST /api/auth/lock
Authorization: Bearer <access_token>
```
Sets `locked_since = now()` on the matching `active_sessions` row. Returns `200 OK`.
Called by the frontend when the idle timer fires.

(Unlock is handled by `verify-password` (DD-29-009) and `verify-pin` (DD-29-011) — they clear
`locked_since` on success. No separate unlock endpoint needed.)

**2. WebSocket push events for lock state changes**

When `locked_since` is set or cleared on a session, auth-service must notify the data broker
so it can fan out to all WebSocket clients sharing that session.

Event types (published over the internal bus / data broker):
```json
{ "type": "session.locked",   "session_id": "<uuid>" }
{ "type": "session.unlocked", "session_id": "<uuid>" }
```

The data broker delivers these to all WebSocket connections authenticated with the same
`session_id`. The frontend WebSocket client (useWebSocket.ts) listens for these event types
and updates lock state in the auth/ui store accordingly.

**Kiosk sessions** (`active_sessions.is_kiosk = true`) never receive `session.locked` events
from the idle path — kiosk sessions have no idle timeout. However, if a kiosk session is
manually locked (e.g., future admin action), the same event applies.

### Session check response extension

The existing session verification response (used on page load / token refresh) must include:
```json
{
  "is_locked": true,
  "auth_provider": "local" | "oidc" | "saml" | "ldap"
}
```

`is_locked = (locked_since IS NOT NULL)`. `auth_provider` comes from the user's
`external_provider` or equivalent column.

On page load, if `is_locked = true`, the frontend enters locked state immediately and renders
the overlay on the next user interaction — without a flash or redirect.

### Migration

The `locked_since` column is defined in the DD-29-009 migration. Do not redefine it here.
If implementing this task independently of DD-29-009, create the migration here and note the
dependency.

## Acceptance Criteria

- [ ] `POST /api/auth/lock` sets `locked_since = now()` for the session; returns 200
- [ ] Session check response includes `is_locked` and `auth_provider`
- [ ] Page refresh while locked → session check returns `is_locked: true` → frontend shows overlay on next interaction
- [ ] Locking a session pushes `session.locked` event to the data broker
- [ ] Unlocking (via verify-password or verify-pin) pushes `session.unlocked` event
- [ ] All open tabs for the same session receive and apply lock/unlock events
- [ ] Kiosk sessions do not auto-lock on idle (no idle timer fires for `is_kiosk = true` sessions)

## Verification Checklist

- [ ] `POST /api/auth/lock` handler exists and sets the DB column
- [ ] Session check handler returns `is_locked` and `auth_provider` fields
- [ ] `session.locked` WS event is published when `locked_since` is written
- [ ] `session.unlocked` WS event is published when `locked_since` is cleared
- [ ] Frontend test: open two tabs, lock in one, second tab shows lock overlay
- [ ] Frontend test: refresh while locked → lock overlay appears on next click/keypress

## Do NOT

- Lock kiosk sessions via the idle timer (kiosk has no idle timeout)
- Issue new tokens or modify session expiry when locking
- Use `sessionStorage` or `localStorage` as the lock state source of truth (server-side is canonical)

## Dev Notes

Decision file: `docs/decisions/visual-lock-overhaul.md`

Auth-service: `services/auth-service/src/handlers/auth.rs` (add lock handler).

Data broker integration: check how other services publish events to the broker. The broker
delivers typed events to WebSocket clients. Look at existing event publishing patterns in
`services/api-gateway/` or `services/alert-service/` for the publish call pattern.

Frontend WebSocket listener: `frontend/src/shared/hooks/useWebSocket.ts` and
`frontend/src/shared/layout/AppShell.tsx`. The frontend already has a Zustand store for lock
state (`isLocked` in ui store or auth store) — extend it to also write from the WS event
handler, not just the idle timer.

The `auth_provider` field may need to be stored on the `active_sessions` row at login time if
it isn't already, so it's available without a users table join on every session check.
