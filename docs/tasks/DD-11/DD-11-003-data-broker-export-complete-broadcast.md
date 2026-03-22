---
id: DD-11-003
title: Implement data-broker LISTEN on export_complete pg_notify channel
unit: DD-11
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

When a report generation job completes, the API gateway fires `pg_notify('export_complete', '{"job_id": "..."}')`. The data-broker must LISTEN on this channel and broadcast the `export_complete` message to all WebSocket clients so the frontend can show a toast with a download link without requiring the user to poll.

## Spec Excerpt (verbatim)

> WebSocket `export_complete` → toast with download link
> — docs/SPEC_MANIFEST.md, §DD-11 Key things to verify

> Async processing for large reports with progress tracking
> — design-docs/11_REPORTS_MODULE.md, §Report Generation

## Where to Look in the Codebase

Primary files:
- `services/data-broker/src/notify.rs` — LISTEN/NOTIFY handler; currently only LISTENs on `point_updates` (line 34)
- `services/data-broker/src/main.rs` — spawns the notify task at line 64
- `frontend/src/shared/hooks/useWsWorker.ts` — client handler at line 140 already handles `export_complete` message
- `frontend/src/workers/wsWorker.ts` — line 21 documents the message type in a comment (protocol is defined but not connected)
- `services/api-gateway/src/handlers/reports.rs` — fires `pg_notify('export_complete', ...)` at lines 194 and 258

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] `data-broker/src/notify.rs` contains a LISTEN statement on the `export_complete` channel
- [ ] When an `export_complete` NOTIFY is received, data-broker broadcasts a `{"type": "export_complete", "job_id": "..."}` message to the requesting user's WebSocket connection(s)
- [ ] The broadcast is scoped to the user who requested the job (not broadcast to all connected users)
- [ ] `useWsWorker.ts` `export_complete` handler at line 140 fires correctly when the WS message arrives
- [ ] The toast with download link appears without the user needing to wait for the 2-second poll cycle

## Assessment

After checking:
- **Status**: ❌ Missing — data-broker has no LISTEN on `export_complete`; client-side handler exists but is never triggered via WS

## Fix Instructions

In `services/data-broker/src/notify.rs`, add a LISTEN for `export_complete` alongside the existing `point_updates` LISTEN. When a notification arrives on this channel:

1. Parse the payload as JSON: `{"job_id": "<uuid>"}`.
2. Look up which connected WebSocket client requested this job. This requires either:
   - Querying the DB for `SELECT requested_by FROM report_jobs WHERE id = $1` (simplest approach), then finding all WS connections for that user_id.
   - Or storing a job_id → user_id map in the broker's in-memory state when the subscription is registered.
3. Send the message `{"type": "export_complete", "job_id": "<uuid>"}` to all active WebSocket connections belonging to that user.

The user-to-connection mapping already exists in the broker for point subscriptions — reuse that structure.

The WS message format to send to clients matches what `useWsWorker.ts:140` expects:
```json
{"type": "export_complete", "job_id": "..."}
```

In `wsWorker.ts`, also handle forwarding this message type from the WS to all active MessagePorts (the worker currently handles `update`, `state`, etc. — add `export_complete` to the message fan-out at the same level).

Do NOT:
- Broadcast to all connected users (only the user who requested the job)
- Remove the polling fallback in `ReportConfigPanel.tsx` — keep it as a safety net for cases where the WS connection is not active
- Change the pg_notify payload format in `handlers/reports.rs` — it already sends the right shape
