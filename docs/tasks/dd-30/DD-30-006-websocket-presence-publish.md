---
id: DD-30-006
title: Publish presence and muster WebSocket topics from API Gateway handlers
unit: DD-30
status: pending
priority: medium
depends-on: [DD-30-001]
---

## What This Feature Should Do

After a badge swipe is processed, the `presence:headcount` and `presence:badge_event` topics must be published to the Data Broker so all subscribed WebSocket clients receive real-time updates without polling. Similarly, when a muster event accounting changes (`account_person`, `declare_muster_event`, `resolve_muster_event`), the `muster:status` and `muster:person_accounted` topics must be published. Currently the Muster Tab polls every 8–10 seconds and the Presence tab every 15 seconds; these should become live-push.

## Spec Excerpt (verbatim)

> | Topic | Payload | Description |
> | `presence:headcount` | `{ "on_site": 142, "on_shift": 48 }` | Headcount update (published on every badge event) |
> | `presence:badge_event` | `{ "person_name": "...", "event_type": "swipe_in", "area": "...", "time": "..." }` | Individual badge event (for real-time roster updates) |
> | `muster:status` | `{ "muster_event_id": "...", "accounted": 47, "unaccounted": 5, "total": 52 }` | Muster accounting update during active emergency |
> | `muster:person_accounted` | `{ "person_name": "...", "muster_point": "...", "method": "badge" }` | Individual muster accounting event |
>
> Clients subscribe to these topics using the standard WebSocket subscription protocol (doc 16). Presence topics require `presence:read` permission. Muster topics require `shifts:read` permission.
> — 30_ACCESS_CONTROL_SHIFTS.md, §WebSocket Integration

## Where to Look in the Codebase

Primary files:
- `services/api-gateway/src/handlers/shifts.rs` — `declare_muster_event` (line 1347), `resolve_muster_event` (line 1563), `account_person` (line 1624) — add publish calls here
- `services/api-gateway/src/badge/poller.rs` (to be created in DD-30-001) — add publish after each badge event insert
- `services/data-broker/src/` — check how other services publish topics (look at existing publish patterns)

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] After `declare_muster_event` succeeds, `muster:status` topic is published with initial `{ accounted: 0, unaccounted: total_on_site, total: total_on_site }`
- [ ] After `account_person` succeeds, `muster:status` and `muster:person_accounted` are published
- [ ] After `resolve_muster_event` succeeds, `muster:status` is published with final counts
- [ ] After each badge event processed by the polling engine, `presence:headcount` is published
- [ ] After each badge event processed, `presence:badge_event` is published with name, event type, area, time
- [ ] Frontend `MusterTab` subscribes to `muster:status` topic instead of (or in addition to) polling

## Assessment

- **Status**: ❌ Missing
- None of the three muster handlers (`declare_muster_event`, `resolve_muster_event`, `account_person`) call any publish function. The badge polling engine is not implemented (see DD-30-001). The frontend MusterTab (`index.tsx:730`) uses `refetchInterval: 8_000` and the Roster tab uses `refetchInterval: 15_000` — no WebSocket subscriptions.

## Fix Instructions

1. In `services/api-gateway/src/handlers/shifts.rs`, after successful muster operations, call the Data Broker publish API (check how `services/api-gateway/src/` currently sends publish messages to the data broker — look for existing UDS or HTTP calls to the broker).

2. In `declare_muster_event` (line 1429, after the accounting inserts), publish:
   ```json
   topic: "muster:status"
   payload: { "muster_event_id": "<id>", "accounted": 0, "unaccounted": <total_on_site>, "total": <total_on_site> }
   ```

3. In `account_person` (line 1658, after the upsert), re-query the accounting totals and publish `muster:status`, then also publish `muster:person_accounted`.

4. In `resolve_muster_event` (line 1592, after the update), publish `muster:status` with final counts and `status: "resolved"`.

5. In the badge polling engine (`DD-30-001`), after updating `presence_status`, re-query on-site count and publish `presence:headcount`. For each individual event, publish `presence:badge_event`.

6. In the frontend, `MusterTab` (index.tsx:718) should subscribe to `muster:status` via the WebSocket hook (`useWebSocket` or equivalent) and update accounting counts in real time. The `refetchInterval` can stay as a fallback but the primary update path should be WS.

Do NOT:
- Remove the REST polling fallback from the frontend — it is the correct degraded-mode behavior
- Publish on every database row update inside a transaction — publish after the transaction commits
