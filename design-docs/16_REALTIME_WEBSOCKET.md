# Inside/Operations - Real-Time WebSocket Design

## Overview

WebSocket broker service for real-time data fanout to multiple clients with subscription management.

## Data Ingestion

The WebSocket broker does not poll for data — it receives point updates pushed from upstream services.

### Primary Path: Unix Domain Socket (IPC)

OPC Service sends batch point updates to Data Broker via Unix domain socket. This is the normal operating path for real-time data flow.

- OPC Service batches point updates (typically every 250ms or on-change) and writes them as framed messages to a Unix domain socket
- Data Broker reads from the socket, updates its in-memory shadow value cache, and fans out to subscribed WebSocket clients
- Throughput: 50,000+ points/sec with sub-millisecond IPC latency
- No serialization overhead — binary framing with point ID (UUID) + value (f64) + quality (u8) + timestamp (i64)

### Fallback Path: PostgreSQL NOTIFY/LISTEN

If the Unix domain socket connection is unavailable (e.g., OPC Service and Data Broker on different hosts in a future deployment), Data Broker falls back to PostgreSQL NOTIFY/LISTEN on channel `point_updates`.

- Broker subscribes to the `point_updates` channel on startup
- OPC Service issues `NOTIFY point_updates, '<payload>'` after writing to `points_current`
- Throughput limited to ~5,000–10,000 points/sec due to PostgreSQL's 8KB payload limit per NOTIFY and single-threaded LISTEN processing
- Payloads are JSON batches: `{ "points": [{ "id": "uuid", "value": 123.45, "quality": "good", "ts": "..." }, ...] }`
- This path adds ~5–20ms latency compared to the IPC path

### Shadow Value Cache

On receiving a batch (from either path), the broker:

1. Updates the shadow value cache (in-memory HashMap of point_id → latest value/quality/timestamp)
2. Fans out updates to all WebSocket clients subscribed to the affected points
3. The shadow cache serves two purposes: immediate value delivery to newly subscribing clients, and deduplication (skip fanout if value hasn't changed)

## Broker Restart Recovery

When the Data Broker process restarts:

1. **Cache warm-up**: On startup, broker reads ALL rows from the `points_current` table into the shadow value cache. This ensures reconnecting clients receive current values immediately upon resubscribing, not stale or empty data.
2. **Connection acceptance**: Broker begins accepting WebSocket connections immediately after cache warm-up completes (typically 1–3 seconds for 10,000+ points).
3. **Subscription batching**: For the first 2–3 seconds after accepting connections, the broker batches incoming subscription requests rather than processing them individually. This absorbs the reconnection wave (all clients reconnect near-simultaneously) and avoids redundant subscription churn.
4. **Client reconnection**: Clients reconnect with exponential backoff + jitter (see Connection Management below). On reconnect, clients resubscribe to their previous point sets. The broker responds with current cached values for all subscribed points.
5. **Steady state**: After the batching window closes, the broker processes subscriptions individually as normal. The shadow cache is fully warm and all reconnected clients have current data.

## WebSocket Protocol

### Ticket-Based Authentication

WebSocket connections use single-use tickets instead of JWTs in the query string. Passing JWTs in URL query parameters is a security risk — URLs are logged in server access logs, proxy logs, and browser history. Tickets are single-use and short-lived, so even if logged, they are already expired or consumed.

**Ticket flow:**

1. Client sends `POST /api/auth/ws-ticket` with a valid JWT in the `Authorization` header
2. Auth Service generates a single-use opaque ticket (UUID), stores it in an in-memory map with a 30-second TTL
3. Auth Service returns `{ "ticket": "uuid" }` to the client
4. Client connects to `wss://hostname:3001/ws?ticket=<ticket>`
5. Data Broker validates the ticket by calling the Auth Service's internal ticket validation endpoint (one HTTP call, authenticated with a shared service secret)
6. Auth Service checks the ticket: if valid and not yet consumed, marks it as consumed and returns the associated user identity (user ID, roles, permissions)
7. If the ticket is invalid, expired, or already consumed, the broker rejects the WebSocket handshake with HTTP 401

**Performance impact:** One extra HTTP call (~5ms on localhost) per WebSocket connection establishment. Since WebSocket connections are long-lived (hours to days), this overhead is negligible.

### Connection
```
Client POSTs to: POST /api/auth/ws-ticket (JWT in Authorization header)
Client receives: { "ticket": "uuid" } (30-second TTL, single-use)
Client connects to: wss://hostname:3001/ws?ticket=<ticket>
Broker validates ticket via Auth Service before accepting connection
```

### Message Types

**Client → Server:**
```json
{
  "type": "subscribe",
  "points": ["uuid1", "uuid2", "uuid3"]
}

{
  "type": "unsubscribe",
  "points": ["uuid1"]
}

{
  "type": "pong"
}

{
  "type": "acknowledge_alert",
  "alert_id": "uuid"
}

{
  "type": "status_report",
  "render_fps": 45,
  "pending_updates": 12,
  "last_batch_process_ms": 8
}
```

**Server → Client:**
```json
{
  "type": "update",
  "point_id": "uuid",
  "value": 123.45,
  "quality": "good",
  "timestamp": "2026-02-12T10:30:00Z"
}

{
  "type": "ping"
}

{
  "type": "error",
  "message": "Subscription limit exceeded"
}

{
  "type": "export_notification",
  "payload": {
    "job_id": "uuid",
    "status": "completed",
    "filename": "settings_points_2026-02-22_1430.csv",
    "format": "csv",
    "row_count": 12450,
    "file_size_bytes": 1258000,
    "download_url": "/api/exports/uuid/download",
    "message": "Your export is ready: settings_points_2026-02-22_1430.csv"
  }
}

{
  "type": "export_progress",
  "payload": {
    "job_id": "uuid",
    "rows_processed": 45000,
    "rows_total": 142000,
    "percent": 31
  }
}

{
  "type": "alert_notification",
  "payload": {
    "alert_id": "uuid",
    "severity": "critical",
    "title": "High pressure alarm on V-1001",
    "message": "Pressure exceeded 150 PSI threshold",
    "triggered_at": "2026-02-12T10:30:00Z",
    "triggered_by": "expression|manual|point_alarm",
    "requires_acknowledgment": true,
    "full_screen_takeover": false,
    "channels_active": ["websocket", "email", "sms"]
  }
}

{
  "type": "alert_acknowledged",
  "payload": {
    "alert_id": "uuid",
    "acknowledged_by": "user-uuid",
    "acknowledged_by_name": "John Smith",
    "acknowledged_at": "2026-02-12T10:31:15Z"
  }
}

{
  "type": "point_stale",
  "point_id": "uuid",
  "last_updated_at": "2026-02-12T10:30:00Z"
}

{
  "type": "point_fresh",
  "point_id": "uuid",
  "value": 123.45,
  "timestamp": "2026-02-12T10:31:15Z"
}

{
  "type": "source_offline",
  "source_id": "uuid",
  "source_name": "OPC-Unit3-Primary",
  "timestamp": "2026-02-12T10:30:00Z"
}

{
  "type": "source_online",
  "source_id": "uuid",
  "source_name": "OPC-Unit3-Primary",
  "timestamp": "2026-02-12T10:32:00Z"
}

{
  "type": "server_restarting"
}
```

## Alert Broadcast Semantics

Alert messages (`alert_notification`, `alert_acknowledged`) are broadcast to **ALL** connected sessions, not filtered by point subscription. This is a different fanout pattern than point updates. The WebSocket broker auto-subscribes all authenticated sessions to an `alert` topic on connection — no explicit subscribe message is needed.

## Stale Data and Source Status Messages

The broker monitors point freshness and OPC source connectivity, pushing status changes to subscribed clients so frontends can render visual indicators (e.g., graying out stale values, showing source connection warnings).

### Point Staleness

- The broker tracks the last update timestamp for each point in the shadow value cache
- A configurable staleness threshold (default: 60 seconds) determines when a point is considered stale
- When a subscribed point exceeds the staleness threshold without receiving a new value, the broker sends `point_stale` to all clients subscribed to that point
- When a previously stale point receives a new update, the broker sends `point_fresh` (which includes the new value) instead of a regular `update` message, so the client knows to clear the stale indicator
- Staleness checks run on a periodic sweep (every 10 seconds), not per-point timers

### OPC Source Status

- When the OPC Service detects a source connection drop, it notifies the Data Broker (via the IPC socket or PostgreSQL NOTIFY)
- The broker sends `source_offline` to ALL connected clients (broadcast, like alerts — not filtered by subscription)
- On `source_offline`, all points associated with that source are immediately marked stale in the shadow cache. Clients subscribed to those points receive `point_stale` messages.
- When the source reconnects, the broker sends `source_online` to all clients. Points from the source will send `point_fresh` as new values arrive.

## Subscription Registry

### Data Structures
- **point_to_clients:** HashMap<PointId, HashSet<ClientId>>
- **client_to_points:** HashMap<ClientId, HashSet<PointId>>
- **connections:** HashMap<ClientId, WebSocketConnection>

### Operations
- **Subscribe:** Add client to point's subscriber set
- **Unsubscribe:** Remove client from point's subscriber set
- **Fanout:** Iterate subscribers for point_id, send update to each
- **Cleanup:** Remove all subscriptions when client disconnects

### Deduplication
- Track subscriptions per point across all clients
- Only request data from OPC once per point
- Fanout to N clients costs same as fanout to 1 client

### Historical Mode Interaction

When a Console workspace or Process view enters Historical Playback mode (docs 07, 08, 32), the client does **not** unsubscribe. Instead, the client-side code ignores incoming WebSocket updates for those points while the playback bar is active. This avoids the overhead of unsubscribe/resubscribe round-trips on mode toggle. The broker continues fanning out to the client; the client discards the messages. When the user returns to Live mode, the client resumes processing updates immediately — no latency gap.

## Update Efficiency

### Change-Only Delivery

The broker only fans out updates when values actually change:

1. **Shadow cache comparison**: On receiving a point update, compare against the cached value. If unchanged, skip fanout.
2. **Deadband filtering**: Configurable per-point (admin sets in point configuration). If value changes by less than the deadband threshold (e.g., 0.1%), treat as unchanged. Eliminates noise on analog points that jitter.
3. **Max-silence heartbeat**: If a point hasn't sent an update in N seconds (configurable, default 60s), send the current value anyway so the client knows the connection is alive and the value is still valid. This is separate from staleness detection — staleness means "no data from source," heartbeat means "data is same, just confirming."
4. **Batched delivery**: Accumulate updates over a short window (default 250ms) and send one JSON array message per batch. Reduces WebSocket frame overhead.
5. **Staggered fanout**: Spread batches across the interval per-client (Client A at 0ms, Client B at 50ms, etc.) to smooth CPU spikes on the broker.

### Protocol Format

JSON with batching. Browsers parse JSON extremely fast, and with change-only delivery + deadband + batching, actual update volumes are low (typically 50-200 updates/sec even with thousands of subscribed points). Binary (MessagePack/CBOR) is an additive future optimization if bandwidth-constrained deployments emerge — swap the serializer, add a capability flag on connect, no architecture change.

## Adaptive Throttling

### Client Status Reporting

Clients periodically send a lightweight status report to the broker (every 10 seconds):

```json
{
  "type": "status_report",
  "render_fps": 45,
  "pending_updates": 12,
  "last_batch_process_ms": 8
}
```

The broker uses this to adaptively throttle per-client delivery.

### Per-Client Throttle Escalation

1. **Normal** — send all updates as they arrive in batches
2. **Batch** — increase batch window (250ms → 500ms) if client reports FPS dropping or pending updates climbing
3. **Deduplicate** — only send latest value per point per batch (drop intermediate updates)
4. **Reduce frequency** — increase batch window further (500ms → 1s)
5. **Off-screen deprioritize** — points on minimized/hidden panes get updates at lowest frequency (client reports which panes are visible)

Throttling scales back automatically as the client recovers. All transparent to the user — they see smooth graphics or slightly delayed updates, never a hard cutoff.

### Server-Wide Aggregate Monitoring

- Broker tracks per-client metrics (subscription count, update rate, throttle state) plus aggregate metrics (total fanout rate, average client latency, number of clients being throttled)
- If >30% of clients are being throttled simultaneously, broker triggers server-wide measures: increase global batch interval, enforce deadband filtering even for points without explicit deadband config
- All metrics surface in System Health (doc 36) — per-client and aggregate broker stats

### Subscription Limits

No hardcoded per-client subscription cap. A single Console workspace can span 27+ graphics across multiple monitors, easily exceeding 2,000 points. The adaptive throttling system handles heavy clients gracefully.

- Actual performance limits discovered through load testing during build
- System Health surfaces per-client subscription counts for admin visibility
- Broker logs a warning when a client exceeds a configurable soft threshold (admin-tunable, no default enforcement)

## Connection Management

### Heartbeat
- Server sends ping every 30 seconds
- Client must respond with pong within 10 seconds
- Disconnect if no pong received

### Reconnection
- Client implements exponential backoff with jitter (1s, 2s, 4s, 8s, max 30s)
- Client resubscribes on reconnect
- Server sends current values for resubscribed points from shadow cache

### Graceful Shutdown
- Server sends `{ "type": "server_restarting" }` message to all clients
- Clients begin reconnection backoff immediately
- Server stops accepting new connections
- Server waits max 5 seconds, then force-closes remaining connections
- Broker restart recovery (cache warm-up, subscription batching) handles the reconnection wave

### Message Ordering

TCP guarantees message ordering within a single WebSocket connection. The broker's internal fanout loop processes updates sequentially. No additional ordering logic needed — updates for the same point always arrive in timestamp order within a connection.

## Performance Targets

- Support 200 concurrent connections (actual limits discovered through load testing)
- Fanout latency < 50ms (broker processing time)
- Memory usage < 100 MB for typical workload
- Subscription count targets determined by load testing, not hardcoded

## UOM Conversion

- WebSocket pushes **raw values** in source engineering units; no UOM conversion is performed server-side
- Frontend performs client-side UOM conversion using a cached UOM catalog (loaded on init)
- This keeps the broker lightweight and avoids per-client conversion overhead

## Implementation Notes

- Use tokio-tungstenite for WebSocket handling
- Use Tokio channels for message passing
- Use Arc<RwLock<T>> for shared state
- Implement graceful degradation under load

## Success Criteria

✅ 200 concurrent clients supported  
✅ Subscription/unsubscribe works correctly  
✅ Updates fan out to all subscribers  
✅ Slow clients don't affect fast clients  
✅ Reconnection handles gracefully

## Multi-Window Connection Pooling

### SharedWorker Architecture

When multiple browser windows are open (main + detached windows from the multi-window system described in doc 06), a SharedWorker maintains a single WebSocket connection to the data broker on behalf of all windows.

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ Main Window  │  │ Secondary 1  │  │ Secondary 2  │
│ (Console)    │  │ (Process)    │  │ (Dashboard)  │
└──────┬───────┘  └──────┬───────┘  └──────┬───────┘
       │ MessagePort      │ MessagePort      │ MessagePort
       └────────┬─────────┴────────┬─────────┘
                │                  │
         ┌──────▼──────────────────▼──────┐
         │         SharedWorker            │
         │  ┌─────────────────────────┐   │
         │  │ Subscription Registry   │   │
         │  │ (union of all windows)  │   │
         │  └─────────────────────────┘   │
         │  ┌─────────────────────────┐   │
         │  │ WebSocket Connection    │   │
         │  │ (single connection to   │   │
         │  │  data broker)           │   │
         │  └─────────────────────────┘   │
         └────────────────────────────────┘
                        │
                   wss://broker
```

Alert messages (`alert_notification`, `alert_acknowledged`) are forwarded to ALL open windows via BroadcastChannel — every window renders alerts independently (e.g., each window shows its own toast or full-screen takeover overlay).

**Browser support**: SharedWorker is supported in Chrome, Edge, and Firefox. Safari support is limited — Safari users fall back to one WebSocket connection per window (acceptable since Safari is not a target control room browser).

### Window-to-SharedWorker Protocol

Each window communicates with the SharedWorker via its MessagePort. Messages are JSON objects with a `type` field:

**Window → SharedWorker:**

| Message Type | Payload | Description |
|---|---|---|
| `subscribe` | `{ windowId, points: string[] }` | Window registers point subscriptions |
| `unsubscribe` | `{ windowId, points: string[] }` | Window removes specific subscriptions |
| `unsubscribe-all` | `{ windowId }` | Window closing — remove all its subscriptions |
| `provide-ticket` | `{ ticket: string }` | Response to `request-ticket` — window fetched a new WebSocket ticket for reconnection |

**SharedWorker → Window:**

| Message Type | Payload | Description |
|---|---|---|
| `point-update` | `{ pointId, value, quality, timestamp }` | Real-time point value update |
| `point-stale` | `{ pointId, lastUpdatedAt }` | Point exceeded staleness threshold |
| `point-fresh` | `{ pointId, value, timestamp }` | Previously stale point received new value |
| `source-offline` | `{ sourceId, sourceName, timestamp }` | OPC source connection lost |
| `source-online` | `{ sourceId, sourceName, timestamp }` | OPC source reconnected |
| `connection-status` | `{ status: 'connected' \| 'reconnecting' \| 'disconnected' }` | WebSocket connection state |
| `request-ticket` | `{}` | SharedWorker needs a new WebSocket ticket for reconnection — any window should call `POST /api/auth/ws-ticket` and respond with `provide-ticket` |
| `error` | `{ code, message }` | Error notification |

### Subscription Aggregation

The SharedWorker maintains a per-window subscription map:

```
windowSubscriptions: Map<windowId, Set<pointId>>
```

The **active server subscription** is the union of all window subscription sets. When a window subscribes or unsubscribes:
1. Update that window's subscription set
2. Recompute the union across all windows
3. Diff against the current server subscription
4. Send subscribe/unsubscribe messages to the WebSocket for any changes

This means:
- If Window A and Window B both subscribe to point `P1`, the server receives one subscription for `P1`
- If Window A closes, `P1` remains subscribed because Window B still needs it
- If Window B also closes, `P1` is unsubscribed from the server
- The server sees exactly one client per user regardless of how many windows are open

### Cleanup on Window Close

When a window closes (or its MessagePort disconnects due to crash):
1. SharedWorker detects the port close event
2. Removes all subscriptions for that window from the per-window map
3. Recomputes the subscription union
4. Unsubscribes any points that are no longer needed by any remaining window

### SharedWorker Crash Recovery

If the SharedWorker process crashes:
1. All windows detect their MessagePort has disconnected
2. The main window (or the first window to detect the crash) re-creates the SharedWorker
3. All windows reconnect to the new SharedWorker via new MessagePorts
4. Each window re-registers its subscriptions
5. The SharedWorker establishes a new WebSocket connection and subscribes to the union

This recovery is transparent to the user — it appears as a brief reconnection (the connection status indicator flashes yellow then returns to green).

### Token Refresh on Reconnection

Once a WebSocket connection is established, it does not need re-authentication — TCP keeps the channel open indefinitely. JWT expiry is irrelevant for live connections. Authentication only matters again on **reconnection** (network drop, broker restart, SharedWorker crash).

On reconnection:
1. SharedWorker detects the WebSocket disconnect
2. SharedWorker broadcasts `request-ticket` to all open windows
3. First window to respond calls `POST /api/auth/ws-ticket` (which triggers a normal JWT refresh via httpOnly cookie if needed)
4. Window sends `provide-ticket` back to the SharedWorker with the new ticket
5. SharedWorker reconnects with the fresh ticket and resubscribes

**Kiosk sessions** use non-expiring refresh tokens — their reconnection flow works identically but the refresh token never expires, so the ticket request always succeeds regardless of how long the session has been running.

**Interactive sessions** in visual lock perform a silent background refresh every 30 minutes (see doc 03). This keeps the refresh token alive and checks account status. If the account has been disabled, the refresh fails and the session terminates. If the account is still valid, new tokens are issued silently — the WebSocket connection is unaffected.

### Backpressure Handling

The SharedWorker applies backpressure when a window's MessagePort buffer fills (e.g., window is minimized or unresponsive):
- SharedWorker tracks pending message count per window port
- If a window's pending count exceeds a threshold (e.g., 100 messages), the SharedWorker drops point updates for that window (keeps connection-status and error messages)
- When the window becomes responsive and drains its buffer, normal delivery resumes
- Dropped updates are not a data loss concern — the next update for each point will carry the current value

### Single-Window Fallback

If the browser does not support SharedWorker (e.g., Safari), each window opens its own WebSocket connection directly to the data broker. The existing per-connection subscription model works unchanged. The server sees multiple connections from the same user — this is acceptable but less efficient. The data broker's existing per-user subscription deduplication (if any) handles this gracefully.

## Change Log

- **v0.8**: Added Historical Mode Interaction note to Subscription Registry. When Console/Process enters Historical Playback (docs 07, 08, 32), the client ignores incoming WebSocket updates without unsubscribing — avoids round-trip overhead on mode toggle, instant resume when returning to Live.
- **v0.7**: Deep dive: Replaced simple backpressure section with full Update Efficiency spec (change-only delivery, per-point deadband filtering, max-silence heartbeat, batched JSON delivery, staggered fanout). Added Adaptive Throttling with client `status_report` messages, 5-level per-client throttle escalation, and server-wide aggregate monitoring surfaced in System Health (doc 36). Removed hardcoded subscription limits — no per-client cap, actual limits discovered through load testing. Added `status_report` client-to-server and `server_restarting` server-to-client message types. Added Token Refresh on Reconnection section — SharedWorker `request-ticket`/`provide-ticket` protocol for re-auth after disconnect. Kiosk sessions use non-expiring refresh tokens. Interactive sessions in visual lock do silent background refresh every 30 min (doc 03). Updated graceful shutdown to 5-second close with courtesy `server_restarting` message. Confirmed TCP-based message ordering — no additional logic needed. JSON protocol confirmed for v1 with binary as future additive optimization.
- **v0.6**: Added Data Ingestion section (Unix domain socket IPC primary path, PostgreSQL NOTIFY/LISTEN fallback, shadow value cache). Added Broker Restart Recovery section (cache warm-up from `points_current`, subscription batching during reconnection wave). Replaced JWT query string auth with ticket-based WebSocket authentication (single-use opaque tickets via Auth Service, 30-second TTL). Added stale data message types (`point_stale`, `point_fresh`, `source_offline`, `source_online`) with Stale Data and Source Status Messages section. Updated SharedWorker protocol table with new message types.
- **v0.5**: Added `alert_notification` and `alert_acknowledged` server-to-client message types, `acknowledge_alert` client-to-server message type. Added Alert Broadcast Semantics section (all sessions auto-subscribed). Added SharedWorker alert forwarding via BroadcastChannel. See 27_ALERT_SYSTEM.md.
- **v0.4**: Added Multi-Window Connection Pooling section — SharedWorker architecture, window-to-worker protocol, subscription aggregation, cleanup on window close, crash recovery, backpressure handling, and single-window fallback
- **v0.3**: Added `export_notification` and `export_progress` server-to-client message types. Export notifications are routed from API Gateway to Data Broker via PostgreSQL NOTIFY, then to the user's WebSocket session(s). See 25_EXPORT_SYSTEM.md Section 8.
- **v0.2**: Added UOM Conversion section. WebSocket pushes raw values in source engineering units; frontend performs client-side conversion using cached UOM catalog.
