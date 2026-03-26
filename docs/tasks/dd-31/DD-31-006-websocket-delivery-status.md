---
id: DD-31-006
title: Replace polling with WebSocket subscription for real-time delivery status updates
unit: DD-31
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The Active Alerts panel and Muster Dashboard must receive delivery status updates in real time via the existing WebSocket broker, not via a 30-second polling interval. As the Alert Service processes deliveries (SMS sent, email delivered, acknowledgments received), status changes must flow to the UI within seconds. The 30-second `refetchInterval` is an acceptable short-term fallback but must eventually be replaced.

## Spec Excerpt (verbatim)

> The Alerts module receives real-time delivery status updates via WebSocket subscription. As the Alert Service (doc 27) processes deliveries and receives provider callbacks (Twilio delivery receipts, etc.), status updates flow back to the Alerts module UI.
>
> **Auto-refresh**: Muster status updates in real-time via WebSocket as badge events occur and as personnel are marked accounted.
> — `31_ALERTS_MODULE.md`, §Delivery Status Updates and §Muster Status Dashboard

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/alerts/index.tsx` line 527 — `refetchInterval: 30_000` in `ActiveAlertsPanel`
- `frontend/src/pages/alerts/MusterDashboard.tsx` line 351 — `refetchInterval: 15_000`
- `frontend/src/shared/hooks/useWebSocket.ts` — existing WS hook for subscribing
- `frontend/src/store/realtimeStore.ts` — check if alert delivery events are handled

## Verification Checklist

- [ ] `ActiveAlertsPanel` subscribes to a WebSocket channel for notification status updates (e.g., `notification.status_changed`)
- [ ] `MusterDashboard` subscribes to a WebSocket channel for muster mark events
- [ ] On receiving a relevant WS event, the query cache for `['notification-active']` and `['muster-status', messageId]` is invalidated (or updated directly)
- [ ] Polling interval is either removed or set to a longer fallback (5+ minutes) once WS subscription is active

## Assessment

- **Status**: ❌ Missing
- **If missing**: `index.tsx:524-528` uses `refetchInterval: 30_000`. `MusterDashboard.tsx:351` uses `refetchInterval: 15_000`. Neither file imports or uses the WebSocket hook. `realtimeStore.ts` would need to be checked for whether notification events are handled there.

## Fix Instructions

1. Determine which WebSocket message type the Alert Service emits for delivery status changes (likely `notification_status` or similar — check `design-docs/16_REALTIME_WEBSOCKET.md` and `design-docs/37_IPC_CONTRACTS.md`).
2. In `ActiveAlertsPanel`, add a `useEffect` that subscribes to the relevant WS channel using `useWebSocket` and invalidates `['notification-active']` on delivery status events.
3. In `MusterDashboard`, subscribe to muster mark events and invalidate `['muster-status', messageId]`.
4. Keep `refetchInterval` as a fallback (e.g., 120 000 ms) in case the WS subscription is unavailable.

Do NOT:
- Remove polling entirely without ensuring WS subscription is working first
- Subscribe inside the render function without a `useEffect` cleanup (will cause duplicate subscriptions)
