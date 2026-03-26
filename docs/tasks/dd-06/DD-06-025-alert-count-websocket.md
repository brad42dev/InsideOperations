---
id: DD-06-025
title: Switch alert unacknowledged count from polling to WebSocket subscription
unit: DD-06
status: pending
priority: low
depends-on: []
---

## What This Feature Should Do

The alert bell badge shows the count of unacknowledged alerts. It should update in real-time via WebSocket subscription when new alarms arrive or existing ones are acknowledged. Currently it polls `GET /api/alarms/active?unacknowledged=true` every 30 seconds, which means badge counts can lag by up to 30 seconds.

## Spec Excerpt (verbatim)

> **Alert Notification Indicator:** Bell icon with unacknowledged alert count badge. ... Real-time count updates via WebSocket subscription.
> — design-docs/06_FRONTEND_SHELL.md, §Top Bar (2-State)

## Where to Look in the Codebase

Primary files:
- `frontend/src/shared/layout/AppShell.tsx:118–135` — `useUnacknowledgedAlertCount()` TanStack Query hook with 30s polling
- `frontend/src/shared/hooks/useWebSocket.ts` — WebSocket manager with subscription helpers
- `frontend/src/store/ui.ts` — UI store that could hold the live count

## Verification Checklist

- [ ] The alert count updates within 1–2 seconds of a new alarm arriving (not waiting 30s)
- [ ] The count decrements within 1–2 seconds of an alarm being acknowledged
- [ ] No 30-second polling interval in `useUnacknowledgedAlertCount()`
- [ ] A WebSocket message handler updates the count on `alarm_created` or `alarm_count_changed` events

## Assessment

- **Status**: ⚠️ Partial — polling works but is 30 seconds stale; WebSocket path missing

## Fix Instructions

In `frontend/src/shared/layout/AppShell.tsx`, update `useUnacknowledgedAlertCount()`:

1. Keep the initial REST fetch via TanStack Query as the bootstrap (loading the count on mount is fine).
2. Add a WebSocket subscription that increments/decrements the count on alarm events. Use `wsManager` (already imported at line 30) to subscribe to alarm-related messages.
3. Cache the live count in a `useRef` or local state that is seeded by the query result and updated by WS events.

Pattern to follow: look at how the existing WS session lock/unlock listeners are wired in AppShell.tsx:708–726 — use the same `wsManager.on*` pattern.

The specific WS event types depend on what the Data Broker publishes (see design-docs/16_REALTIME_DATA.md). Common patterns: `{ type: 'alarm_count_update', unacknowledged: number }` or incremental `alarm_created` / `alarm_acknowledged` events that require client-side count tracking.

Do NOT:
- Remove the REST fetch entirely — it bootstraps the initial count before WS connects
- Use a polling interval shorter than 30 seconds as a stopgap — fix it with WS instead
