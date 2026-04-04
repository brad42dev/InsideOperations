# REST Connector Trigger and Delivery Modes

**Date:** 2026-04-04
**Author:** Research agent
**Relates to:** Import Service (`services/import-service`), Universal Import design-docs/24
**Prerequisite reading:** `01_current_architecture.md`

---

## Context and Scope

The current `GenericRestConnector` (`connectors/etl/rest.rs`) does one-shot GET/POST, materializes the entire response into a `Vec<SourceRecord>`, and returns. Pagination is handled synchronously within a single `extract()` call. There is no event-driven mode, no persistent connection, no push path.

This document covers five enhanced delivery modes for REST-based connectors, plus concrete analysis of access control and CMMS system APIs that I/O needs to integrate with.

---

## 1. Polling (Scheduled REST)

### Pattern

Call a REST endpoint on a configured schedule, extract new or changed records, import them. This is an extension of what already exists — the gap is watermark tracking and deduplication, not the HTTP call itself.

### Pagination strategies (what the current connector already handles)

| Strategy | How it works | Source config keys |
|---|---|---|
| `none` | Single page, no pagination | — |
| `cursor` | Response body contains a `next` cursor token; append `?cursor=<token>` to next request | `cursor_path`, `max_pages` |
| `offset_limit` | Advance `offset` by `page_size` until a short page is returned | `page_size`, `max_pages` |

Missing strategy: **link-header pagination** (`Link: <url>; rel="next"` HTTP response header, used by GitHub, Maximo OData, some SCIM endpoints). The current connector ignores response headers entirely. This needs to be added to `GenericRestConnector` for full RFC 5988 compliance.

### Watermark (incremental extraction)

The core idea: remember the highest timestamp (or sequence ID) seen in the last run; inject it as a query parameter on the next run so only new records are returned.

Schema support already exists: `import_runs.watermark_state JSONB` is in the DDL but never written. The implementation plan:

1. After a successful run, write `{"last_import_at": "<ISO8601 timestamp>", "last_id": "<max_id_seen>"}` into `import_runs.watermark_state`.
2. On the next scheduled run, read the most recent successful run's `watermark_state` for the same `import_definition_id`.
3. Substitute watermark values into the endpoint URL or query params using a template mechanism, e.g.:
   - `source_config.watermark_param: "since"` → appends `?since=2026-04-01T12:00:00Z`
   - `source_config.watermark_field: "updated_at"` → tells the connector which response field to use for the new high-water mark

Example for an access control badge event API:
```
GET /api/events?since=2026-04-04T08:00:00Z&limit=500
```

The `watermark_state` JSONB is flexible enough to hold cursor tokens, sequence numbers, or timestamps.

### Deduplication

Watermark alone is insufficient because:
- Clock skew on the source system may cause events to appear slightly out of order
- The watermark at run time catches `last_import_at` but not in-flight records that committed after the watermark was read
- The same record can appear in multiple pages if a new record was inserted during pagination

Deduplication strategies (pick based on source system characteristics):

| Strategy | Mechanism | When to use |
|---|---|---|
| `source_row_id` match | `custom_import_data.source_row_id` already exists; upsert rather than insert | Source has stable unique IDs (Maximo WONUM, OnGuard event ID) |
| Overlap window | Set watermark to `last_import_at - 5 minutes`; accept duplicates, rely on `source_row_id` upsert | Source timestamps are unreliable |
| Hash fingerprint | SHA-256 of the raw record; store fingerprint; skip if seen | No stable ID from source |
| `FOR UPDATE SKIP LOCKED` claim | PostgreSQL advisory lock keyed on `(definition_id, source_row_id)` | High-frequency parallelism |

The `source_row_id` column in `custom_import_data` is already designed for this. The ETL pipeline `load_records` function currently sets it to the row number within the batch — it should instead be set to the value of a configurable field from the source record (e.g., `source_config.id_field: "eventId"`).

### Concrete example: access control badge events via polling

```
Connection:
  base_url: https://acs.plant.local:8443
  auth_type: bearer_token
  auth_config.bearer_token: <token>

Definition source_config:
  source_type: generic_rest
  endpoint: /api/v1/badge-events
  method: GET
  pagination_type: offset_limit
  page_size: 500
  max_pages: 20
  records_path: data.events
  id_field: eventId                    # used as source_row_id
  watermark_param: since               # appended as ?since=<last_import_at>
  watermark_field: eventTimestamp      # response field to use as new high-water mark

Schedule:
  schedule_type: interval
  schedule_config.interval_seconds: 60
```

A 60-second polling interval gives 1-minute latency for badge event data — adequate for mustering reporting and occupancy dashboards. Real-time badge alerts should use webhooks instead (see section 2).

---

## 2. Webhooks (Push-Based)

### Pattern

The external system POSTs events to I/O when they occur. I/O exposes a stable HTTPS endpoint. The external system is configured with that URL and a shared secret. This eliminates polling latency entirely — badge swipe events arrive within the same HTTP round-trip the source system uses to record the event.

### Endpoint structure

```
POST /import/webhook/{definition_id}/{secret_token}
```

- `definition_id`: UUID of the `import_definition` this webhook feeds. Allows one webhook URL per connector definition.
- `secret_token`: URL-embedded secret (32-byte random hex). Short-circuits auth before any DB lookup. This is a convenience token, not the HMAC secret — it prevents random internet scanners from triggering pipeline processing.
- Full HMAC signature validation happens after this check (see below).

The public URL after nginx proxying:
```
https://io.plant.local/api/import/webhook/{definition_id}/{secret_token}
```

Route registration adds to the existing route table in `handlers/import.rs`:
```rust
.route(
    "/import/webhook/:definition_id/:token",
    post(handlers::webhook::receive_webhook)
)
```

Note: This endpoint must be accessible to the external system. If I/O is behind a firewall, webhook delivery requires either a NAT rule or an MQTT/polling fallback.

### HMAC signature validation

Standard approach across all major webhook providers (GitHub, Stripe, Shopify, CMMS vendors):

1. External system signs the raw request body with the shared secret using HMAC-SHA256.
2. Signature is sent in a request header, e.g. `X-Hub-Signature-256: sha256=<hex>` or `X-Signature: <base64>`.
3. I/O reads the raw body bytes before any deserialization, computes the HMAC, and compares using constant-time equality.

**Critical**: Read raw bytes from the request body before any JSON parsing. Once deserialized and re-serialized, byte-for-byte equality is not guaranteed.

Rust implementation crates (all in workspace or easily addable):
- `hmac` crate (MIT/Apache-2.0) — HMAC computation
- `sha2` crate (MIT/Apache-2.0) — SHA-256
- `hex` crate (MIT/Apache-2.0) — hex decoding of the incoming signature

```rust
use hmac::{Hmac, Mac};
use sha2::Sha256;

type HmacSha256 = Hmac<Sha256>;

fn verify_signature(secret: &[u8], body: &[u8], received_sig: &str) -> bool {
    let mut mac = HmacSha256::new_from_slice(secret).unwrap();
    mac.update(body);
    let computed = mac.finalize().into_bytes();
    let computed_hex = hex::encode(computed);
    // Constant-time compare — do NOT use == on strings
    constant_time_eq::constant_time_eq(computed_hex.as_bytes(), received_sig.as_bytes())
}
```

`constant_time_eq` crate (CC0 / public domain) provides the timing-safe comparison.

Axum requires `bytes::Bytes` extractor to get the raw body before JSON parsing:
```rust
async fn receive_webhook(
    Path((definition_id, token)): Path<(Uuid, String)>,
    headers: HeaderMap,
    body: Bytes,  // raw bytes — parse JSON manually after verification
) -> impl IntoResponse { ... }
```

### Queue pattern

Webhook delivery must be fast. The external system expects an HTTP 200 within ~5 seconds or it will retry. I/O should not run the full ETL pipeline synchronously in the request handler.

Recommended queue pattern:

```
External System → POST /import/webhook/{id}/{token}
                         ↓
              [Verify HMAC, token]
                         ↓
              INSERT INTO webhook_buffer (definition_id, payload, received_at)
              HTTP 200 immediately
                         ↓
              Background task drains buffer → pipeline::execute()
```

Implementation options for the buffer:
1. **`import_webhook_buffer` PostgreSQL table** — simplest, fits the existing architecture, durable across restarts. Add `SELECT FOR UPDATE SKIP LOCKED` drain loop. Recommended.
2. **In-process `tokio::mpsc` channel** — zero persistence, lost on crash. Only viable if webhook events are low-volume and duplicates are acceptable.
3. **Redis queue** — not in the current stack; adds operational complexity. Not recommended unless volumes exceed PostgreSQL capacity.

The PostgreSQL buffer table (new, to be added via migration):
```sql
CREATE TABLE import_webhook_buffer (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    import_definition_id UUID NOT NULL REFERENCES import_definitions(id) ON DELETE CASCADE,
    payload JSONB NOT NULL,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ,
    processing_status VARCHAR(20) DEFAULT 'pending'
        CHECK (processing_status IN ('pending', 'processing', 'done', 'failed'))
);
CREATE INDEX ON import_webhook_buffer (import_definition_id, processing_status, received_at)
    WHERE processing_status = 'pending';
```

A drain task (started in `main.rs` alongside the existing scheduler tasks) polls `import_webhook_buffer WHERE processing_status = 'pending'` every 1–5 seconds and processes batches.

### Replay attack prevention

- Include a timestamp in the signed payload or a `X-Webhook-Timestamp` header.
- Reject payloads where the timestamp is more than 5 minutes old.
- Record processed webhook IDs and reject duplicates (use the `import_webhook_buffer.id` or a vendor-provided idempotency key).

### Concrete example: CMMS work order events

```
CMMS (IBM Maximo) → POST https://io.plant.local/api/import/webhook/{def_id}/{token}
Headers:
  X-Maximo-Signature: sha256=<hmac_hex>
  Content-Type: application/json
Body:
{
  "eventType": "WORKORDER_CHANGED",
  "wonum": "WO-2026-1234",
  "status": "COMP",
  "asset": "PUMP-101",
  "changedAt": "2026-04-04T10:32:00Z"
}
```

```
Access control (Genetec ClearID) → POST https://io.plant.local/api/import/webhook/{def_id}/{token}
Body:
{
  "event": "CARDHOLDER_ACCESS_GRANTED",
  "cardholderName": "John Smith",
  "doorId": "DOOR-CONTROL-ROOM-01",
  "timestamp": "2026-04-04T10:33:01Z"
}
```

### Webhook source config fields

```json
{
  "source_type": "webhook",
  "hmac_header": "X-Hub-Signature-256",
  "hmac_algorithm": "sha256",
  "hmac_prefix": "sha256=",
  "timestamp_header": "X-Webhook-Timestamp",
  "replay_window_seconds": 300,
  "records_path": ""
}
```

The HMAC secret is stored in `import_connections.auth_config` (encrypted at rest by the existing `crypto.rs` layer). Field name: `secret`.

---

## 3. Server-Sent Events (SSE)

### Pattern

I/O establishes a long-running HTTP connection to an external system that streams events using the SSE protocol (`Content-Type: text/event-stream`). Events arrive as they are emitted without polling. I/O processes each event and routes it through the import pipeline.

This is a client-initiated persistent connection, unlike webhooks where the external system initiates. I/O acts as the SSE client.

### Rust crate options

Two credible options, both with acceptable licenses:

| Crate | License | Approach | Reconnect |
|---|---|---|---|
| `reqwest-eventsource` | MIT OR Apache-2.0 | Wraps `reqwest`; uses `eventsource-stream` internally; `ExponentialBackoff` struct built in | Yes — automatic with configurable backoff |
| `eventsource-client` | Apache-2.0 | Full SSE implementation over `hyper v1`; pluggable transport; `ReconnectOptions` builder | Yes — 1s initial, exponential, 1 min max |

Recommendation: **`reqwest-eventsource`** because `reqwest` is already in the workspace (`reqwest.workspace = true` in `services/import-service/Cargo.toml`). Adding `reqwest-eventsource` requires one new dependency; `eventsource-client` would add a second HTTP stack (hyper) alongside the existing reqwest one.

`reqwest-eventsource` `ExponentialBackoff` configuration:
```rust
use reqwest_eventsource::{EventSource, ExponentialBackoff};

let es = EventSource::new(client.get(url))
    .backoff(ExponentialBackoff::new(
        Duration::from_millis(500),   // start
        2.0,                           // factor
        Duration::from_secs(60),       // max delay
        Some(10),                      // max retries (None = infinite)
    ));
```

### Long-running connection management

SSE connections are fundamentally incompatible with the current ETL trait design (`extract()` returns `Vec<SourceRecord>` — a completed batch). SSE is a continuous stream.

Implementation approach: SSE connectors run as long-lived background tasks, not as ETL pipeline jobs. They are structurally similar to the existing DCS supplemental connector poller but event-driven rather than polled:

```
tokio::spawn(sse_connector_task(connection_id, definition_id, db, config))
  ↓
loop {
  connect EventSource to external SSE URL
  for each Event {
    parse event payload
    route through mini-pipeline (map + transform + validate)
    INSERT INTO custom_import_data (or target table)
    emit pg_notify('import_status', ...)
  }
  on disconnect: exponential backoff, reconnect
}
```

The `import_runs` table is problematic here — SSE tasks don't have discrete run boundaries. Options:
1. Create a new `import_run` row for each reconnection session (clean boundary per connection).
2. Log events in real-time as they arrive (row-level metrics accumulate on a long-lived run row).
3. Don't use `import_runs` at all for SSE — track session state in a separate `import_stream_sessions` table.

Option 1 is simplest and fits the existing model. Create a run on connect, close it on disconnect (with `partial` status if some events were processed), open a new run on reconnect.

### Reconnect and failure handling

- **Exponential backoff**: start at 500ms, double per attempt, cap at 60 seconds.
- **Jitter**: add random ±20% to avoid thundering herd if multiple SSE connectors reconnect simultaneously.
- **Max retries**: configurable per connector (default: unlimited — industrial systems should keep trying).
- **Circuit breaker**: after N consecutive failures within a window, alert via `pg_notify('import_alert', ...)` and pause for a longer interval before retrying.

SSE servers may send a `retry:` field in events to specify the client reconnect delay. Respect this if present.

### Concrete example: historian REST API SSE stream

```
OSIsoft PI Web API (newer versions) streams data changes as SSE
GET https://pi.plant.local/piwebapi/streams/{webId}/value?updatesOnly=true
Content-Type: text/event-stream

event: Update
data: {"Timestamp":"2026-04-04T10:33:01Z","Value":42.7,"Good":true}
```

```
Connection source_config:
  source_type: sse
  url_path: /piwebapi/streams/{point_webid}/value
  query_params: {updatesOnly: true}
  event_type_filter: ["Update"]         # only process events of this type
  records_path:                          # each event data IS the record
  reconnect_initial_ms: 500
  reconnect_max_ms: 60000
  reconnect_jitter: true
```

### When to use SSE vs webhooks vs polling

| Factor | SSE | Webhooks | Polling |
|---|---|---|---|
| Latency | Sub-second | Sub-second | Depends on interval (30–300s typical) |
| Infrastructure | I/O must reach external system | External must reach I/O | I/O must reach external system |
| External system support | Rare in industrial systems | Growing (Genetec ClearID, some CMMS) | Universal |
| Connection durability | Long-lived, needs reconnect logic | Stateless per event | Stateless per poll |
| Firewall complexity | I/O initiates (simpler) | External initiates inbound (harder) | I/O initiates (simpler) |

---

## 4. WebSocket Client

### Pattern

I/O connects outbound to an external WebSocket server and processes messages as they arrive. Similar to SSE but bidirectional and with a different framing protocol. The external system streams events (equipment status changes, real-time access events) over the WebSocket connection.

### Rust crate

**`tokio-tungstenite`** (MIT OR Apache-2.0) is already in the workspace as a direct dependency (`tokio-tungstenite = { version = "0.21" }` in `Cargo.toml`). No new dependency required.

For automatic reconnection, `tokio-tungstenite` itself has no built-in reconnect logic. Options:

1. **Custom reconnect loop** (recommended for control):
```rust
loop {
    match tokio_tungstenite::connect_async(&url).await {
        Ok((ws_stream, _)) => {
            process_stream(ws_stream, db.clone()).await;
            // Reached only on clean close or error
        }
        Err(e) => {
            tracing::warn!("WebSocket connect failed: {e}");
        }
    }
    // Exponential backoff before reconnect
    backoff.wait().await;
}
```

2. **`stream-reconnect` crate** (MIT) — wraps the WebSocket stream to automatically attempt reconnection on failure. Provides `ReconnectStream` wrapper. Less control than a custom loop for complex scenarios (authentication on reconnect, state reset).

For WebSocket connections that require re-authentication on reconnect (common in industrial APIs), a custom reconnect loop with explicit auth handshake is cleaner than `stream-reconnect`.

### Message format handling

WebSocket messages arrive as `tokio_tungstenite::tungstenite::Message` variants:

| Variant | Handling |
|---|---|
| `Message::Text(s)` | Parse as JSON via `serde_json::from_str` |
| `Message::Binary(b)` | Depends on protocol: Protobuf, MessagePack, raw bytes. Need per-connector deserializer. |
| `Message::Ping(data)` | Must reply with `Message::Pong(data)` — required for connection keepalive |
| `Message::Pong(_)` | Ignore (response to our sent Ping) |
| `Message::Close(frame)` | Log, break out of inner loop, trigger reconnect |

The current ETL connector model has no mechanism for the Ping/Pong keepalive requirement. WebSocket connectors must run as long-lived tasks (same as SSE), not as one-shot ETL jobs.

### Subscription handshake

Most real-time WebSocket APIs require a subscription message after connect before events flow:

```json
// After connect, send:
{"type": "subscribe", "channels": ["badge_events", "door_status"], "token": "<auth_token>"}

// Server responds:
{"type": "subscribed", "channels": ["badge_events", "door_status"]}

// Then events flow:
{"type": "badge_event", "cardholderId": "...", "door": "...", "timestamp": "..."}
```

The subscription handshake payload must be stored in `source_config` as a configurable field:
```json
{
  "source_type": "websocket",
  "url": "wss://acs.plant.local:8444/events",
  "subscribe_message": {"type": "subscribe", "channels": ["badge_events"]},
  "message_type_field": "type",
  "message_type_filter": ["badge_event"],
  "records_path": ""
}
```

### Concrete example: real-time access control events

Some modern access control cloud APIs (HID Origo, Genetec Cloud) stream events via WebSocket. An on-premise system with a WebSocket-capable integration layer (e.g., custom Kepware or Node-RED bridge) follows the same pattern:

```
wss://acs.plant.local:8444/events/stream
→ {"type":"badge_event","door":"CTRL-ROOM-01","cardholder":"jsmith","ts":"2026-04-04T10:33:01Z"}
→ {"type":"badge_event","door":"LAB-A","cardholder":"mtaylor","ts":"2026-04-04T10:33:07Z"}
```

### Structural note

Both SSE and WebSocket connectors require the same architectural addition: long-lived background task management distinct from the ETL pipeline. A `ConnectorSession` concept (session ID, definition ID, status, reconnect count, last event timestamp) stored in the database would give operators visibility into these persistent connections without forcing them into the `import_runs` model.

---

## 5. GraphQL

### Is it worth supporting?

**Short answer: No, not in the current phase. Document it as a future option.**

Rationale:

1. **Negligible industrial adoption**: Genetec, Lenel, IBM Maximo, SAP PM, Honeywell, ABB, Siemens process historians — none expose GraphQL as their primary integration API as of 2026. Industrial middleware uses REST/OData, SOAP, or vendor-proprietary protocols. GraphQL is a web-application pattern that has not penetrated process-industry back-office systems.

2. **GraphQL queries are functionally equivalent to REST for our purpose**: I/O's import pipeline extracts records and maps fields. Whether the source is `GET /workorders?filter=...` or `{workOrders(filter: {...}) { wonum status ... }}` makes no difference to the ETL stages. The only connector difference is the HTTP layer.

3. **GraphQL subscriptions add significant complexity**: Subscriptions use WebSocket transport underneath. Supporting them would require a WebSocket client (already planned — section 4) plus a GraphQL subscription protocol layer (Apollo `graphql-ws` or `subscriptions-transport-ws`). The marginal benefit over a direct WebSocket connector is near zero.

4. **Rust GraphQL client options are available but add dependencies**: `cynic` (MIT), `graphql_client` (MIT) — both work, both are MIT-licensed. The tooling exists; the industrial demand does not justify adding it now.

**Future trigger for adding GraphQL**: If a target system (e.g., a new CMMS, MES, or cloud historian) lists GraphQL as its primary integration API and no REST alternative exists. In that case, the `GenericRestConnector` can be extended with a GraphQL variant — the HTTP transport is identical (POST to `/graphql`), only the request body structure changes.

**GraphQL for polling (non-subscription) costs nothing extra**: A GraphQL query is just a POST with a `{"query": "...", "variables": {...}}` body. The existing `GenericRestConnector` with `method: POST` and a configurable `request_body` already handles this case. No new connector type is needed.

---

## 6. Access Control Systems — Industrial Context

### What data industrial facilities want from access control

| Data type | Use in I/O | Latency requirement |
|---|---|---|
| Badge swipe events (access granted/denied) | Mustering (doc 30/31), occupancy dashboards, shift presence tracking | Real-time for mustering; 30–60s for occupancy reporting |
| Person/cardholder sync (name, badge ID, department) | Person lookup in muster roll, display in alerts | Near-real-time or hourly batch |
| Door/reader status (open, forced, held) | Process display overlays, alarm integration | Real-time for alarm; 60s for status display |
| Access group/clearance sync | RBAC augmentation (which doors can a person access) | Daily batch |
| Credential lifecycle (issue, revoke, expiry) | Security audit trail in I/O Log module | Event-driven or hourly |

### Genetec Security Center

**API surface**: Two distinct APIs:

1. **WebSDK REST API** — on-premise Security Center. HTTP on TCP port 4590/4591. Proprietary REST-ish API. Third-party tools (EvTrack, Robin, Envoy) poll it for badge events. No native webhook delivery to external systems from the on-premise SC server.

2. **ClearID REST API** (cloud/SaaS) — API-first, built on REST + OAuth 2.0. Supports **outbound webhooks**: when configured, ClearID POSTs events to external URLs when access events, cardholder changes, or visitor events occur. Webhook events include `CARDHOLDER_ACCESS_GRANTED`, `CARDHOLDER_ACCESS_DENIED`, and cardholder lifecycle events.

**I/O integration strategy for Genetec**:
- On-premise Security Center: polling via `GenericRestConnector`, 30–60 second interval. The WebSDK REST API returns event logs with timestamps; use watermark on `EventTimestamp`.
- ClearID (cloud): configure ClearID to POST webhooks to `https://io.plant.local/api/import/webhook/{def_id}/{token}`. Delivers real-time badge events.

**Authentication**: ClearID uses OAuth 2.0 client credentials. The existing `auth_type: oauth2` support in `import_connections` needs to cover this (token refresh lifecycle management — not currently implemented). On-premise SC uses session tokens obtained via login endpoint.

### Lenel OnGuard (LenelS2 OpenAccess)

**API surface**: REST API called **OpenAccess**. Runs on TCP port 8080 (default). Authentication: POST to `/authentication` returns a session token; each subsequent request requires `Session-Token` header and `Application-Id` header.

**Event polling**: OpenAccess does not support outbound webhooks. Events must be polled. The API exposes logged events with filter parameters. Third-party integrations (Google Chronicle, SureView) implement middleware that polls OpenAccess and forwards events.

**Event types available via polling**: Access Granted, Access Denied, Door Held Open, Door Forced Open, Alarm Events, Cardholder Events, Badge Events, Status Events.

**I/O integration strategy for Lenel OnGuard**:
- Polling only. Interval: 30–60 seconds for badge events.
- Session token has a TTL — connector must handle 401 responses by re-authenticating.
- Watermark on event timestamp or sequence ID.
- `source_config.id_field: "EventId"` for deduplication via `source_row_id`.

The OpenAccess "Event Connection" mechanism (KB article: Open Access Event Connection steps) provides a long-poll or subscription-style event stream within the API — this is worth investigating as it may deliver events faster than a pure poll loop.

### C•CURE 9000 (Software House, now Johnson Controls)

**API surface**: **Victor Web Services** — a SOAP/REST hybrid API. Badge event polling was introduced in **v2.9 SP2**. Integration third parties (Milestone, HID) use the Victor Web Services API to receive events.

**Real-time delivery**: No native webhook push. Event polling through Victor Web Services. Some integrations use a local agent/service that runs on the C•CURE server and bridges events to external systems.

**I/O integration strategy for C•CURE 9000**:
- Polling via `GenericRestConnector` if Victor Web Services exposes a clean REST JSON endpoint.
- If Victor Web Services is SOAP-only, a dedicated SOAP connector is needed (not currently in the ETL connector registry).
- For real-time badge swipes in muster scenarios, an on-premise bridge agent (small service running on the C•CURE host that POSTs events to I/O's webhook endpoint) is the practical path.

---

## 7. CMMS / ERP Systems — Industrial Context

### What data industrial facilities want from CMMS/ERP

| Data type | Use in I/O | Update frequency |
|---|---|---|
| Work order status (open, in-progress, complete) | Asset context panels, process display overlays | Hourly or event-driven |
| Work order details (asset, description, assigned tech) | Maintenance history in Forensics module | Hourly |
| Asset maintenance history | Failure pattern analysis in Forensics | Daily batch |
| Planned shutdown schedules | Overlays on time-series charts (Forensics, Console) | Daily |
| Failure reports / problem codes | Root cause analysis | On-close event |
| Spare parts availability | Context for maintenance decisions | Daily |
| Safety permits (LOTO status) | Critical — process display overlays | Near-real-time |

### IBM Maximo (OSLC REST API)

**API surface**: Two REST API generations:

1. **OSLC/JSON REST API** — primary integration API. Base URL: `/maximo/oslc`. Object structures map to REST endpoints: `/oslc/os/mxwodetail` (work orders), `/oslc/os/mxasset` (assets), `/oslc/os/mxfailurereport` (failure reports).

2. **Maximo Application Framework REST** (newer) — similar capabilities, cleaner JSON.

**Incremental sync (watermark) for work orders**:
```
GET /maximo/oslc/os/mxwodetail
  ?oslc.where=changedate>"2026-04-04T08:00:00-00:00"
  &oslc.pageSize=100
  &oslc.select=wonum,description,status,assetnum,changedate
```

The `changedate` field on `WORKORDER` is the correct watermark field. It updates whenever any field on the work order changes.

**Pagination**: OSLC uses `rdfs:member` array in response plus a `rdf:next-page` link for link-header-style pagination. The current `GenericRestConnector` does not handle link-header pagination — this is a known gap.

**Authentication**: API key or Basic auth. Token-based auth available in newer versions.

**I/O integration strategy for Maximo**:
- Polling with `changedate` watermark, 60-minute interval for work orders.
- Add link-header pagination support to `GenericRestConnector`.
- Map `wonum` → `source_row_id` for deduplication/upsert.
- Webhook delivery possible if Maximo's **Integration Framework** is licensed and configured to push outbound events — but this is rare in practice.

### SAP Plant Maintenance (S/4HANA OData API)

**API surface**: SAP exposes plant maintenance data through **OData V2 and V4** APIs on the SAP Business Technology Platform (BTP) or directly from S/4HANA.

Relevant OData services:
- `API_MAINTENANCEORDER` — maintenance orders/work orders
- `API_EQUIPMENT_SRV` — equipment master data
- Functional location APIs

**Delta / incremental queries**:
- OData V4 supports delta tokens: `GET /maintenanceorders?$deltatoken=<token>` returns only changed records since the delta token was issued.
- OData V2 (more common in older SAP deployments): filter by `LastChangeDateTime ge datetime'2026-04-04T08:00:00'`. The `EntityLastChangedOn` field is the watermark field.

**Authentication**: SAP BTP uses OAuth 2.0. On-premise S/4HANA uses Basic auth or SAML. I/O's `auth_type: oauth2` support needs to handle BTP token refresh.

**I/O integration strategy for SAP PM**:
- OData queries are just HTTP GET with URL parameters — standard `GenericRestConnector` handles them.
- Pagination: OData uses `$top`, `$skip`, `$skiptoken`. Current connector's `offset_limit` mode works for `$top`/`$skip`. `$skiptoken` is cursor-based and can be mapped to `cursor` mode.
- Watermark: `oslc.where` equivalent is `$filter=LastChangeDateTime ge datetime'<watermark>'`.
- Delta tokens (OData V4): store the delta token in `watermark_state.delta_token`; inject into next request.

### Infor EAM / HxGN EAM (Hexagon)

**API surface**: Hexagon HxGN EAM (formerly Infor EAM) exposes REST web services. The API uses JSON. Base URL format: `https://<host>/web/v1/<resource>`. Work orders: `/web/v1/workorders`. The Hexagon PPM documentation (`docs.hexagonppm.com/r/en-US/HxGN-EAM-Rest-Web-Services`) covers the REST endpoints.

**Incremental sync**: Filter parameters support date range queries on `changedate` or `modifieddate`. Specific field names vary by version.

**I/O integration strategy for HxGN EAM**:
- Standard polling via `GenericRestConnector`.
- Interval: 30–60 minutes for work order sync.
- 5-minute interval for safety-critical data (LOTO status, permit-to-work).

---

## 8. Real-Time vs Near-Real-Time Analysis

### Badge swipe data latency requirements

| Use case | Acceptable latency | Recommended delivery mode |
|---|---|---|
| Emergency mustering (muster command center) | **Sub-5-second** — must know who badged in/out of which zones in near-real-time | Webhook (if system supports) or dedicated short-poll (5–10s) |
| Occupancy dashboard (how many people in Area A) | 30–60 seconds | 30-second polling |
| Shift presence confirmation | 5 minutes | 5-minute polling |
| Badge event audit trail (historical forensics) | Minutes to hours | 60-second polling, watermark-based |
| Security alerts (repeated access denied) | Sub-30-second | Webhook or 15-second polling |

The muster command center (doc 30/31) is the only I/O context where badge data latency is operationally critical. A 5-second delay between a badge swipe and the muster roll update is acceptable for physical safety scenarios (compared to manual paper-based mustering). Sub-second latency is ideal but not typically achievable through polling.

**Recommendation**: For facilities with Genetec ClearID (webhook-capable), configure webhooks. For facilities with Lenel OnGuard, C•CURE 9000, or other polling-only systems, implement a dedicated short-poll connector (10–30 second interval) specifically for muster-critical badge events, separate from the general import pipeline's hourly/daily sync jobs.

### Polling vs webhook tradeoffs

| Factor | Polling | Webhooks |
|---|---|---|
| External system support | Universal — every system with a REST API | System must support outbound HTTP delivery |
| Network topology | I/O initiates outbound (simpler firewall) | External system initiates inbound to I/O (requires inbound NAT or DMZ) |
| Latency | Bounded by poll interval | Near-zero (event-driven) |
| Reliability | I/O controls retry logic | External system controls retry; I/O must handle duplicates |
| Event ordering | Guaranteed by timestamp filter | Not guaranteed (network delivery variability) |
| Volume handling | Pull-based — I/O controls load | Push-based — external system can flood I/O |
| Data recovery after I/O downtime | Easy — resume from last watermark | Requires external system to have retry queue; may miss events if TTL exceeded |
| Implementation complexity | Low | Moderate (HMAC validation, buffer queue, replay protection) |

**Practical industrial reality**: Most on-premise industrial systems (Lenel, C•CURE, legacy Maximo deployments) do not support outbound webhook delivery. Polling is the pragmatic default. Webhooks should be implemented as an opt-in delivery mode for systems that support them, not as the primary path.

---

## 9. Implementation Priority

Based on the current state (`01_current_architecture.md`) and the industrial use cases above:

| Priority | Work item | Rationale |
|---|---|---|
| 1 | Fix `import_schedules` schema mismatch | Blocker — scheduled polling is non-functional today |
| 2 | Implement watermark in `GenericRestConnector` | Required for incremental badge event and work order polling |
| 3 | `source_row_id` from configurable field | Required for deduplication |
| 4 | Link-header pagination | Required for Maximo OSLC and OData |
| 5 | Webhook receiver endpoint + HMAC validation | Required for Genetec ClearID, future CMMS webhook delivery |
| 6 | Webhook buffer table + drain task | Required to make webhook receipt durable |
| 7 | SSE connector type | Required for historian SSE streams; lower priority if PI Web API is covered by DCS connector |
| 8 | WebSocket client connector type | Required for modern real-time access control APIs |
| 9 | OAuth 2.0 token refresh in connector auth | Required for SAP BTP, ClearID; currently auth_type=oauth2 has no refresh implementation |

---

## 10. Rust Crate Summary

| Crate | License | Purpose | Already in workspace? |
|---|---|---|---|
| `reqwest` 0.12 | MIT OR Apache-2.0 | HTTP client for polling, webhooks | Yes |
| `tokio-tungstenite` 0.21 | MIT OR Apache-2.0 | WebSocket client | Yes |
| `reqwest-eventsource` | MIT OR Apache-2.0 | SSE client with ExponentialBackoff | No — add if SSE implemented |
| `eventsource-client` | Apache-2.0 | SSE client (LaunchDarkly) | No — alternative to reqwest-eventsource |
| `hmac` | MIT OR Apache-2.0 | HMAC computation for webhook validation | No — add when webhooks implemented |
| `sha2` | MIT OR Apache-2.0 | SHA-256 for HMAC | No — add when webhooks implemented |
| `hex` | MIT OR Apache-2.0 | Hex encoding/decoding for signature comparison | No — add when webhooks implemented |
| `constant_time_eq` | CC0 (public domain) | Timing-safe comparison for HMAC signatures | No — add when webhooks implemented |
| `stream-reconnect` | MIT | WebSocket auto-reconnect wrapper | No — likely not needed with custom reconnect loop |

All crates listed are royalty-free commercially licensed (MIT, Apache-2.0, or CC0). None are GPL/LGPL/AGPL.
