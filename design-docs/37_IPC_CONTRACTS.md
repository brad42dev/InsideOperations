# Inside/Operations — Inter-Service Communication Contracts

## Purpose

This document defines the **concrete wire formats, struct definitions, error envelopes, and protocol rules** that all 11 I/O backend services must conform to. It is the single source of truth for inter-service communication. When an LLM builds Service A and a different LLM instance builds Service B, both reference this document to guarantee interoperability on the first try.

Doc 02 (System Architecture) describes the high-level architecture, interaction tables, and NOTIFY channel registry. This document specifies *exactly what goes on the wire* at each boundary.

**Implementation path:** The types and contracts defined here are implemented in the `io-models`, `io-error`, `io-health`, and `io-validate` shared workspace crates. Services import these crates — they do not define their own versions of shared types. See doc 01 for the full list of 11 shared `io-*` crates.

---

## 1. Serialization Standards

All I/O services follow these serialization rules with zero exceptions:

| Rule | Specification |
|------|--------------|
| **JSON field naming** | `snake_case` always. Never camelCase, never kebab-case. Enforced via `#[serde(rename_all = "snake_case")]` on all structs. |
| **Timestamps** | RFC 3339 with timezone: `"2025-03-11T20:57:03.000Z"`. Always UTC. Never unix epoch in JSON. Internal binary protocols may use epoch milliseconds (i64). |
| **UUIDs** | Lowercase hyphenated: `"a1b2c3d4-e5f6-7890-abcd-ef1234567890"`. Never uppercase, never unhyphenated. |
| **Enums** | Serialized as lowercase snake_case strings: `"good"`, `"not_ready"`, `"in_progress"`. Never as integers. Enforced via `#[serde(rename_all = "snake_case")]`. |
| **Null vs absent** | Absent field = not provided (use `#[serde(skip_serializing_if = "Option::is_none")]`). Explicit `null` = intentionally cleared. Both are valid for `Option<T>` fields. |
| **Numbers** | Integers as JSON numbers. Floats as JSON numbers (IEEE 754). `NaN` and `Infinity` are serialized as `null` with a quality of `"bad"`. |
| **Booleans** | JSON `true`/`false`. Never `"true"`/`"false"` strings. Never `1`/`0`. |
| **Arrays** | Empty array `[]` is valid and distinct from absent field. Never `null` for arrays. |
| **Max payload** | JSON responses: no hard limit (streaming for large results). NOTIFY payloads: 7,500 bytes max (leaving margin within PostgreSQL's 8KB limit). |

---

## 2. REST Envelope (io-error crate)

Every HTTP response from every service uses this envelope. No exceptions.

### Success Response

```rust
#[derive(Serialize)]
pub struct ApiResponse<T: Serialize> {
    pub success: bool,          // always true
    pub data: T,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
}
```

```json
{
    "success": true,
    "data": { ... },
    "message": "Optional human-readable note"
}
```

### Error Response

```rust
#[derive(Serialize)]
pub struct ApiError {
    pub success: bool,          // always false
    pub error: ErrorBody,
}

#[derive(Serialize)]
pub struct ErrorBody {
    pub code: ErrorCode,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<Vec<FieldError>>,
}

#[derive(Serialize)]
pub struct FieldError {
    pub field: String,
    pub message: String,
}
```

```json
{
    "success": false,
    "error": {
        "code": "VALIDATION_ERROR",
        "message": "Invalid request body",
        "details": [
            { "field": "name", "message": "Name is required" },
            { "field": "email", "message": "Invalid email format" }
        ]
    }
}
```

### Error Codes (exhaustive)

```rust
#[derive(Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ErrorCode {
    ValidationError,        // 400 — bad input
    InvalidAggregation,     // 400 — point doesn't support requested aggregation
    Unauthorized,           // 401 — missing or invalid token
    Forbidden,              // 403 — valid token but insufficient permissions
    NotFound,               // 404 — resource doesn't exist
    Conflict,               // 409 — duplicate or state conflict
    Gone,                   // 410 — resource was deleted (soft delete)
    RateLimited,            // 429 — too many requests
    InternalError,          // 500 — unhandled server error
    ServiceUnavailable,     // 503 — dependency down or not ready
}
```

**Rule:** Internal service-to-service HTTP calls use the same error envelope. If Auth Service returns a 401 to Data Broker during ticket validation, it's in this format. If API Gateway proxies that to the frontend, it's in this format. One format everywhere.

---

## 3. Authentication Headers

### User Requests (Frontend → API Gateway)

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...  (JWT)
```

### Service-to-Service (any service → any service)

```
Authorization: Bearer <IO_SERVICE_SECRET value>
```

The `io-auth` crate inspects the token format to determine the validation path:
- Starts with `eyJ` (base64 JSON) → JWT decode and validate
- Matches `IO_SERVICE_SECRET` → constant-time comparison, grant full service-level access
- Starts with `io_sk_` → API key lookup in database
- Anything else → 401

### WebSocket Ticket (Frontend → Data Broker)

```
wss://hostname:3001/ws?ticket=<uuid>
```

Not a header — passed as query parameter during WebSocket handshake. Data Broker validates the ticket with Auth Service via internal HTTP call before accepting the connection.

---

## 4. Unix Domain Socket Protocol

### Socket Path

```
/var/run/io/opc-broker.sock
```

### Wire Format: Length-Prefixed Binary Frames

Each frame:

```
┌──────────────────┬────────────────────────────────────────┐
│ Frame length (u32)│ Payload (MessagePack or raw binary)    │
│ 4 bytes, big-end │ Variable length                        │
└──────────────────┴────────────────────────────────────────┘
```

### Point Update Batch (OPC Service → Data Broker)

```rust
#[derive(Serialize, Deserialize)]
pub struct UdsPointBatch {
    pub source_id: Uuid,
    pub points: Vec<UdsPointUpdate>,
}

#[derive(Serialize, Deserialize)]
pub struct UdsPointUpdate {
    pub point_id: Uuid,         // 16 bytes
    pub value: f64,             // 8 bytes
    pub quality: PointQuality,  // 1 byte (see enum below)
    pub timestamp: i64,         // 8 bytes, epoch milliseconds
}

#[derive(Serialize, Deserialize, Clone, Copy)]
#[repr(u8)]
pub enum PointQuality {
    Good = 0,
    Uncertain = 1,
    Bad = 2,
}
```

**Serialization:** MessagePack (via `rmp-serde`). Compact binary, schema-compatible with serde, no hand-rolled binary parsing. A batch of 500 points ≈ 17KB.

**Batching:** OPC Service accumulates updates and flushes every 250ms or when batch reaches 500 points, whichever comes first.

### Source Status (OPC Service → Data Broker)

```rust
#[derive(Serialize, Deserialize)]
pub struct UdsSourceStatus {
    pub source_id: Uuid,
    pub status: SourceStatusChange,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SourceStatusChange {
    Online,
    Offline,
}
```

Sent on the same UDS socket. Data Broker distinguishes message types via a 1-byte type tag prepended before the length-prefixed frame:

```
┌───────────┬──────────────────┬─────────────────────┐
│ Type (u8) │ Frame length (u32)│ Payload (MessagePack)│
│ 0x01=data │ 4 bytes          │ Variable             │
│ 0x02=status│                 │                      │
└───────────┴──────────────────┴─────────────────────┘
```

### Connection Lifecycle

1. Data Broker creates and listens on `/var/run/io/opc-broker.sock`
2. OPC Service connects on startup (retry with 1s backoff if socket doesn't exist yet)
3. Connection is persistent — kept open for the lifetime of both services
4. If connection drops, OPC Service falls back to NOTIFY `point_updates` and retries UDS every 5 seconds
5. When UDS reconnects, OPC Service auto-promotes back to UDS path

### Backpressure

If Data Broker's read buffer fills (OPC Service writing faster than Broker can process), the Unix socket's kernel buffer provides ~128KB of buffering. If that fills, OPC Service's write call blocks. This is acceptable — OPC Service has its own internal ring buffer (doc 22) and will not lose data. The blocking write is the backpressure signal.

---

## 5. PostgreSQL NOTIFY/LISTEN Payloads

All NOTIFY payloads are JSON. All conform to these rules:
- UTF-8 encoded
- Max 7,500 bytes (within PostgreSQL's 8KB limit with margin)
- Channel names are static strings (no dynamic channel names)
- Every payload includes a `type` field for forward compatibility

### Channel: `point_updates`

**Publisher:** OPC Service (fallback path)
**Subscriber:** Data Broker

```rust
#[derive(Serialize, Deserialize)]
pub struct NotifyPointUpdates {
    pub r#type: String,     // always "point_updates"
    pub source_id: Uuid,
    pub points: Vec<NotifyPointValue>,
}

#[derive(Serialize, Deserialize)]
pub struct NotifyPointValue {
    pub id: Uuid,
    pub value: f64,
    pub quality: String,    // "good", "uncertain", "bad"
    pub ts: String,         // RFC 3339
}
```

**Batching:** Same 250ms / 500-point rule as UDS. If batch exceeds 7,500 bytes, split into multiple NOTIFY calls.

### Channel: `point_metadata_changed`

**Publisher:** OPC Service, Import Service
**Subscriber:** API Gateway

```rust
#[derive(Serialize, Deserialize)]
pub struct NotifyPointMetadataChanged {
    pub r#type: String,         // always "point_metadata_changed"
    pub point_id: Uuid,
    pub change_type: String,    // "new", "updated", "removed"
    pub source_id: Uuid,
}
```

### Channel: `events`

**Publisher:** Event Service
**Subscriber:** Data Broker

```rust
#[derive(Serialize, Deserialize)]
pub struct NotifyEvent {
    pub r#type: String,         // always "event"
    pub event_id: Uuid,
    pub event_type: String,     // "alarm", "system", "user_action", etc.
    pub severity: String,       // "emergency", "critical", "warning", "info"
    pub point_id: Option<Uuid>,
    pub summary: String,
}
```

### Channel: `alerts`

**Publisher:** Alert Service
**Subscriber:** Data Broker

```rust
#[derive(Serialize, Deserialize)]
pub struct NotifyAlert {
    pub r#type: String,         // always "alert"
    pub alert_id: Uuid,
    pub severity: String,       // "emergency", "critical", "warning", "info"
    pub template_name: String,
    pub title: String,
    pub requires_acknowledgment: bool,
    pub full_screen_takeover: bool,
}
```

### Channel: `alert_trigger`

**Publisher:** Event Service
**Subscriber:** Alert Service

```rust
#[derive(Serialize, Deserialize)]
pub struct NotifyAlertTrigger {
    pub r#type: String,         // always "alert_trigger"
    pub source_event_id: Uuid,
    pub trigger_type: String,   // "threshold_breach", "alarm_state_change", "opc_disconnect"
    pub severity: String,
    pub point_id: Option<Uuid>,
    pub context: serde_json::Value, // trigger-type-specific details
}
```

### Channel: `import_status`

**Publisher:** Import Service
**Subscriber:** API Gateway

```rust
#[derive(Serialize, Deserialize)]
pub struct NotifyImportStatus {
    pub r#type: String,         // always "import_status"
    pub run_id: Uuid,
    pub status: String,         // "running", "completed", "failed"
    pub progress_pct: u8,       // 0-100
    pub error_message: Option<String>,
}
```

### Channel: `export_progress`

**Publisher:** API Gateway
**Subscriber:** Data Broker

```rust
#[derive(Serialize, Deserialize)]
pub struct NotifyExportProgress {
    pub r#type: String,         // always "export_progress"
    pub job_id: Uuid,
    pub user_id: Uuid,
    pub status: String,         // "queued", "processing", "completed", "failed"
    pub progress_pct: u8,
}
```

### Channel: `presence_updates`

**Publisher:** API Gateway (badge poller)
**Subscriber:** Data Broker

```rust
#[derive(Serialize, Deserialize)]
pub struct NotifyPresenceUpdate {
    pub r#type: String,         // always "presence_update"
    pub user_id: Uuid,
    pub presence_state: String, // "on_site", "off_site"
    pub badge_event_type: Option<String>,
    pub timestamp: String,      // RFC 3339
}
```

### Channel: `email_send`

**Publisher:** Any service
**Subscriber:** Email Service

```rust
#[derive(Serialize, Deserialize)]
pub struct NotifyEmailSend {
    pub r#type: String,         // always "email_send"
    pub template_id: Option<Uuid>,
    pub to: Vec<String>,
    pub subject: Option<String>,
    pub template_variables: Option<serde_json::Value>,
    pub priority: String,       // "normal", "critical", "high", "low"
    pub context_type: String,   // "report", "alert", "export", "round", "auth", "test"
    pub context_id: Option<Uuid>,
}
```

---

## 6. Health Check Contract (io-health crate)

Every service exposes three health endpoints on its service port. No exceptions. The `io-health` crate provides the Axum handlers — services register their dependency checks and the crate handles the rest.

### `GET /health/live`

```rust
#[derive(Serialize)]
pub struct LiveResponse {
    pub status: String, // always "alive"
}
```

Response: always `200 OK`. If the process is running, this returns. No dependency checks. Used by systemd watchdog.

### `GET /health/ready`

```rust
#[derive(Serialize)]
pub struct ReadyResponse {
    pub status: ReadyStatus,
    pub service: String,        // e.g., "api-gateway", "opc-service"
    pub version: String,        // semver from Cargo.toml
    pub uptime_seconds: u64,
    pub checks: HashMap<String, CheckResult>,
}

#[derive(Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ReadyStatus {
    Ready,      // all critical checks pass
    Degraded,   // some non-critical checks failing
    NotReady,   // any critical check failing
}

#[derive(Serialize)]
pub struct CheckResult {
    pub status: String,     // "ok", "timeout", "error"
    pub latency_ms: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}
```

Response: `200` for Ready/Degraded, `503` for NotReady.

**Critical checks** (any failure → NotReady): database connection, required filesystem paths.
**Non-critical checks** (failure → Degraded): Redis, external IdPs, OPC sources.

### `GET /health/startup`

Same shape as `/health/ready` but returns `503` until initialization is complete (migrations run, caches warmed, connections established). Once ready, returns `200` for the lifetime of the process.

---

## 7. Service Identity

Every service identifies itself consistently in logs, metrics, health checks, and tracing spans.

```rust
#[derive(Clone)]
pub struct ServiceIdentity {
    pub name: &'static str,     // e.g., "api-gateway"
    pub port: u16,              // e.g., 3000
    pub version: &'static str,  // from env!("CARGO_PKG_VERSION")
}
```

### Canonical Service Names

| Service | `name` | Port |
|---------|--------|------|
| API Gateway | `api-gateway` | 3000 |
| Data Broker | `data-broker` | 3001 |
| OPC Service | `opc-service` | 3002 |
| Event Service | `event-service` | 3003 |
| Parser Service | `parser-service` | 3004 |
| Archive Service | `archive-service` | 3005 |
| Import Service | `import-service` | 3006 |
| Alert Service | `alert-service` | 3007 |
| Email Service | `email-service` | 3008 |
| Auth Service | `auth-service` | 3009 |
| Recognition Service | `recognition-service` | 3010 |

These names appear in:
- Health check `service` field
- Prometheus metric labels: `service="api-gateway"`
- OpenTelemetry `service.name` resource attribute
- Structured log `service` field
- systemd unit names: `io-api-gateway.service`

---

## 8. Shared Domain Types (`io-models` crate)

These are the types that cross service boundaries. Every service that sends or receives these types uses the exact same struct from `io-models`.

### Point Types

```rust
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PointValue {
    pub point_id: Uuid,
    pub value: f64,
    pub quality: PointQuality,
    pub timestamp: DateTime<Utc>,
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum PointQuality {
    Good,
    Uncertain,
    Bad,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PointMetadata {
    pub point_id: Uuid,
    pub tagname: String,
    pub description: Option<String>,
    pub engineering_units: Option<String>,
    pub data_type: String,
    pub source_id: Uuid,
    pub active: bool,
    pub criticality: Option<String>,
    pub area: Option<String>,
}
```

### Event Types

```rust
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Event {
    pub event_id: Uuid,
    pub event_type: EventType,
    pub severity: EventSeverity,
    pub point_id: Option<Uuid>,
    pub source_id: Option<Uuid>,
    pub summary: String,
    pub details: Option<serde_json::Value>,
    pub timestamp: DateTime<Utc>,
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug)]
#[serde(rename_all = "snake_case")]
pub enum EventType {
    Alarm,
    System,
    UserAction,
    Import,
    Authentication,
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug, PartialEq, Ord, PartialOrd, Eq)]
#[serde(rename_all = "snake_case")]
pub enum EventSeverity {
    Emergency,
    Critical,
    Warning,
    Info,
}
```

### Alert Types

```rust
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AlertDispatch {
    pub alert_id: Uuid,
    pub severity: EventSeverity,
    pub template_id: Uuid,
    pub title: String,
    pub message: String,
    pub recipients: Vec<AlertRecipient>,
    pub channels: Vec<AlertChannel>,
    pub requires_acknowledgment: bool,
    pub full_screen_takeover: bool,
    pub triggered_by: Uuid,     // user or system event that caused it
    pub triggered_at: DateTime<Utc>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct AlertRecipient {
    pub user_id: Uuid,
    pub delivery_channels: Vec<AlertChannel>,
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug)]
#[serde(rename_all = "snake_case")]
pub enum AlertChannel {
    WebSocket,
    Email,
    Sms,
    Voice,
    Radio,
    Pa,
}
```

### User/Auth Types

```rust
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct UserIdentity {
    pub user_id: Uuid,
    pub username: String,
    pub roles: Vec<String>,
    pub permissions: Vec<String>,
    pub site_id: Option<Uuid>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct WsTicket {
    pub ticket: Uuid,
    pub user: UserIdentity,
    pub issued_at: DateTime<Utc>,
    pub expires_at: DateTime<Utc>,
    pub consumed: bool,
}
```

### Source Types

```rust
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SourceStatus {
    pub source_id: Uuid,
    pub source_type: String,        // "opc_ua", "mssql", "rest_api", etc.
    pub status: SourceState,
    pub last_connected_at: Option<DateTime<Utc>>,
    pub last_error_at: Option<DateTime<Utc>>,
    pub last_error: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Copy, Debug)]
#[serde(rename_all = "snake_case")]
pub enum SourceState {
    Active,
    Inactive,
    Connecting,
    Error,
}
```

---

## 9. Pagination Contract

All list endpoints use the same pagination format. Defined in `io-models`, used everywhere.

### Request (query parameters)

```
GET /api/v1/points?page=1&per_page=50&sort=tagname&order=asc
```

| Parameter | Type | Default | Constraints |
|-----------|------|---------|-------------|
| `page` | u32 | 1 | Min 1 |
| `per_page` | u32 | 50 | Min 1, max 1000 |
| `sort` | String | Resource-specific default | Must be a sortable field |
| `order` | String | `asc` | `asc` or `desc` |

### Response

```rust
#[derive(Serialize)]
pub struct PaginatedResponse<T: Serialize> {
    pub success: bool,
    pub data: Vec<T>,
    pub pagination: PaginationMeta,
}

#[derive(Serialize)]
pub struct PaginationMeta {
    pub page: u32,
    pub per_page: u32,
    pub total_items: u64,
    pub total_pages: u32,
}
```

```json
{
    "success": true,
    "data": [ ... ],
    "pagination": {
        "page": 1,
        "per_page": 50,
        "total_items": 1234,
        "total_pages": 25
    }
}
```

---

## 10. Structured Logging Contract (io-observability crate)

All services use `tracing` with `tracing-subscriber` for structured logging. Every log line is JSON with these mandatory fields:

```json
{
    "timestamp": "2025-03-11T20:57:03.000Z",
    "level": "info",
    "service": "api-gateway",
    "message": "Request completed",
    "target": "io_api_gateway::handlers::points",
    "span": { "request_id": "uuid", "method": "GET", "path": "/api/v1/points" },
    "fields": { ... }
}
```

### Mandatory Span Fields

Every HTTP request handler creates a span with:
- `request_id` (Uuid) — generated per request, propagated to all downstream calls
- `method` (String) — HTTP method
- `path` (String) — request path

Every inter-service HTTP call propagates `request_id` via the `X-Request-Id` header. This enables distributed tracing across services without requiring a full OpenTelemetry deployment.

### Log Levels

| Level | When to Use |
|-------|-------------|
| `error` | Unrecoverable failures: database down, service crash, data corruption |
| `warn` | Recoverable problems: retry succeeded, fallback activated, rate limit hit |
| `info` | Normal operations: request completed, service started, connection established |
| `debug` | Development detail: SQL queries, payload contents, cache hits/misses |
| `trace` | Extreme detail: per-frame updates, per-point processing, binary protocol bytes |

---

## 11. Metrics Contract (io-observability crate)

All services expose `GET /metrics` on their service port in Prometheus text exposition format. The `io-observability` crate provides the registry and Axum handler.

### Naming Rules

- Prefix: `io_` for all metrics
- Snake_case: `io_http_requests_total`
- Counters end with `_total`: `io_http_requests_total`
- Durations use `_seconds` with float values: `io_http_request_duration_seconds`
- Gauges have no suffix convention: `io_ws_connections`

### Mandatory Metrics (every service)

```
# Counters
io_http_requests_total{service, method, path, status}
io_http_request_errors_total{service, method, path, error_code}

# Histograms
io_http_request_duration_seconds{service, method, path}

# Gauges
io_db_pool_connections{service, state}  # state: active, idle
io_service_uptime_seconds{service}
```

### Service-Specific Metrics (examples)

```
# Data Broker
io_ws_connections{service="data-broker"}
io_ws_subscriptions_total{service="data-broker"}
io_ws_messages_sent_total{service="data-broker"}
io_point_updates_received_total{service="data-broker", path}  # path: uds, notify

# OPC Service
io_opc_source_status{service="opc-service", source_id, status}
io_opc_points_subscribed{service="opc-service", source_id}
io_opc_updates_per_second{service="opc-service", source_id}

# Alert Service
io_alerts_dispatched_total{service="alert-service", severity, channel}

# Email Service
io_emails_sent_total{service="email-service", status}  # status: sent, failed, bounced
io_email_queue_depth{service="email-service", priority}
```

---

## 12. Inter-Service HTTP Call Contract

When one service calls another over HTTP, these rules apply:

### Request

```
POST /internal/endpoint HTTP/1.1
Host: localhost:3009
Authorization: Bearer <IO_SERVICE_SECRET>
Content-Type: application/json
X-Request-Id: <propagated-uuid>
```

### Timeout

All inter-service HTTP calls have a **5-second timeout** (configurable via `IO_INTERNAL_HTTP_TIMEOUT_MS`). If a downstream service doesn't respond in 5 seconds, the caller returns `503 ServiceUnavailable` to its own caller.

### Retry

Inter-service calls are **not retried** by default. The caller returns the error to its own caller. Retry logic is the responsibility of the outermost caller (frontend or scheduled job). Exception: Data Broker → Auth Service ticket validation retries once after 500ms on timeout (WebSocket connection establishment is latency-sensitive).

### Known Inter-Service HTTP Calls

| Caller | Target | Endpoint | Purpose |
|--------|--------|----------|---------|
| API Gateway | Auth Service (3009) | `POST /internal/auth/login` | Local/LDAP login |
| API Gateway | Auth Service (3009) | `POST /internal/auth/refresh` | Token refresh |
| API Gateway | Auth Service (3009) | `POST /internal/auth/ws-ticket` | Issue WebSocket ticket |
| API Gateway | Auth Service (3009) | Various `/internal/auth/*` | SSO, MFA, SCIM |
| API Gateway | Recognition Service (3010) | `POST /internal/recognition/*` | Proxied recognition requests |
| API Gateway | Import Service (3006) | `POST /internal/imports/*` | Proxied import operations |
| API Gateway | Alert Service (3007) | `POST /internal/alerts/*` | Alert dispatch, template CRUD |
| API Gateway | Email Service (3008) | `POST /internal/email/send` | Transactional email |
| Data Broker | Auth Service (3009) | `POST /internal/auth/validate-ticket` | WebSocket ticket validation |
| Alert Service | Email Service (3008) | `POST /internal/email/send` | Alert email delivery |

**Note:** All internal endpoints use the `/internal/` prefix to distinguish from proxied client-facing `/api/v1/` endpoints. The `io-auth` enforces that `/internal/` endpoints only accept `IO_SERVICE_SECRET` auth, never user JWTs.

---

## 13. WebSocket Protocol Types

Types used in the WebSocket protocol between Data Broker and frontend clients. Defined here because the Data Broker serializes them and the frontend TypeScript client deserializes them — both sides must agree.

### Server → Client Messages

```rust
#[derive(Serialize)]
#[serde(tag = "type", content = "payload")]
#[serde(rename_all = "snake_case")]
pub enum WsServerMessage {
    Update(WsBatchUpdate),
    PointStale(WsPointStale),
    PointFresh(WsPointFresh),
    SourceOffline(WsSourceStatus),
    SourceOnline(WsSourceStatus),
    AlertNotification(WsAlertNotification),
    AlertAcknowledged(WsAlertAcknowledged),
    ExportNotification(WsExportNotification),
    ExportProgress(WsExportProgress),
    PresenceUpdate(WsPresenceUpdate),
    Ping(WsEmpty),
    ServerRestarting(WsEmpty),
}

#[derive(Serialize)]
pub struct WsBatchUpdate {
    pub points: Vec<WsPointValue>,
}

#[derive(Serialize)]
pub struct WsPointValue {
    pub id: Uuid,       // point_id
    pub v: f64,         // value
    pub q: String,      // "good", "uncertain", "bad"
    pub t: i64,         // epoch_ms
}
```

**Note:** WebSocket point updates use abbreviated field names (`id`, `v`, `q`, `t`) for bandwidth efficiency. All other message types use full field names.

### Client → Server Messages

```rust
#[derive(Deserialize)]
#[serde(tag = "type")]
#[serde(rename_all = "snake_case")]
pub enum WsClientMessage {
    Subscribe { points: Vec<Uuid> },
    Unsubscribe { points: Vec<Uuid> },
    AcknowledgeAlert { alert_id: Uuid },
    Pong,
    StatusReport {
        render_fps: f32,
        pending_updates: u32,
        last_batch_process_ms: u32,
    },
}
```

---

## 14. Configuration Contract

### Required Environment Variables (all services)

| Variable | Type | Description |
|----------|------|-------------|
| `IO_DATABASE_URL` | String | PostgreSQL connection URL |
| `IO_SERVICE_SECRET` | String | Inter-service Bearer token |
| *(master key)* | — | Delivered via systemd `$CREDENTIALS_DIRECTORY` (see doc 03 Secrets Management). No env var needed. |
| `IO_JWT_SECRET` | String | JWT HMAC-SHA256 signing key (Auth + io-auth) |
| `IO_LOG_LEVEL` | String | `trace`, `debug`, `info`, `warn`, `error`. Default: `info` |

### Optional Environment Variables (all services)

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `IO_TRACING_ENABLED` | bool | `false` | Enable OpenTelemetry trace export |
| `IO_OTLP_ENDPOINT` | URL | — | OTLP gRPC endpoint (Jaeger) |
| `IO_TRACE_SAMPLE_RATE` | f64 | `0.1` | Fraction of traces to sample |
| `IO_METRICS_INTERVAL` | Duration | `15s` | Metrics collection interval |
| `IO_INTERNAL_HTTP_TIMEOUT_MS` | u64 | `5000` | Inter-service HTTP timeout |

### Service-Specific Variables

| Variable | Service | Description |
|----------|---------|-------------|
| `IO_OPC_BROKER_IPC` | OPC Service | `unix` (default) or `notify` |
| `IO_OPC_BUFFER_DISK_PATH` | OPC Service | Disk spill path for ring buffer |
| `IO_OPC_BUFFER_DISK_MAX_MB` | OPC Service | Max disk buffer size |
| `IO_WS_PORT` | Data Broker | WebSocket listen port (default: 3001) |
| `IO_EMAIL_QUEUE_POLL_MS` | Email Service | Queue poll interval (default: 1000) |
| `IO_EMAIL_QUEUE_BATCH_SIZE` | Email Service | Dequeue batch size (default: 10) |

**Rule:** Environment variables control startup behavior. Runtime settings are in the database `settings` table and hot-reloadable. See doc 15.

---

## 15. Versioning and Forward Compatibility

### Wire Format Versioning

The IPC contracts in this document are **v1**. If a breaking change is needed:

1. Add a version field to the affected message type
2. Services must accept both old and new formats during transition
3. Remove old format support after all services are upgraded

### Additive Changes (non-breaking)

These changes are always safe:
- Adding a new optional field to a struct (with `#[serde(default)]`)
- Adding a new variant to a `#[serde(tag = "type")]` enum (unknown variants are logged and ignored)
- Adding a new NOTIFY channel (no existing subscriber is affected)
- Adding a new health check (overall status logic handles unknown checks)

### Breaking Changes (require coordination)

These require all services to be upgraded simultaneously:
- Removing a field
- Renaming a field
- Changing a field's type
- Changing the wire format (e.g., JSON → MessagePack for a NOTIFY channel)

Since all 11 services are deployed together from the same Cargo workspace, breaking changes are applied atomically in a single build. There is no rolling upgrade scenario for v1.

---

## 16. TypeScript Type Parity (Frontend Contract)

Every Rust type in this document that crosses the WebSocket or REST boundary has a corresponding TypeScript interface. The frontend MUST use these types — no ad-hoc type definitions for API responses or WebSocket messages.

**Implementation:** These interfaces live in `src/shared/types/ipc.ts` and are the single source of truth for the frontend. They are manually maintained in lockstep with the Rust types in `io-models`. Any change to a Rust struct requires a corresponding TypeScript update in the same commit.

### REST Envelope

```typescript
interface ApiResponse<T> {
  success: true;
  data: T;
  message?: string;
}

interface ApiError {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: FieldError[];
  };
}

interface FieldError {
  field: string;
  message: string;
}

type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'INVALID_AGGREGATION'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'GONE'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR'
  | 'SERVICE_UNAVAILABLE';

interface PaginatedResponse<T> {
  success: true;
  data: T[];
  pagination: PaginationMeta;
}

interface PaginationMeta {
  page: number;
  per_page: number;
  total_items: number;
  total_pages: number;
}
```

### Point Types

```typescript
type PointQuality = 'good' | 'uncertain' | 'bad';

interface PointValue {
  point_id: string;      // UUID
  value: number;
  quality: PointQuality;
  timestamp: string;     // RFC 3339
}

interface PointMetadata {
  point_id: string;
  tagname: string;
  description?: string;
  engineering_units?: string;
  data_type: string;
  source_id: string;
  active: boolean;
  criticality?: string;
  area?: string;
}
```

### Event Types

```typescript
type EventType = 'alarm' | 'system' | 'user_action' | 'import' | 'authentication';
type EventSeverity = 'emergency' | 'critical' | 'warning' | 'info';

interface Event {
  event_id: string;
  event_type: EventType;
  severity: EventSeverity;
  point_id?: string;
  source_id?: string;
  summary: string;
  details?: Record<string, unknown>;
  timestamp: string;
}
```

### Alert Types

```typescript
type AlertChannel = 'web_socket' | 'email' | 'sms' | 'voice' | 'radio' | 'pa';

interface AlertDispatch {
  alert_id: string;
  severity: EventSeverity;
  template_id: string;
  title: string;
  message: string;
  recipients: AlertRecipient[];
  channels: AlertChannel[];
  requires_acknowledgment: boolean;
  full_screen_takeover: boolean;
  triggered_by: string;
  triggered_at: string;
}

interface AlertRecipient {
  user_id: string;
  delivery_channels: AlertChannel[];
}
```

### User/Auth Types

```typescript
interface UserIdentity {
  user_id: string;
  username: string;
  roles: string[];
  permissions: string[];
  site_id?: string;
}
```

### Source Types

```typescript
type SourceState = 'active' | 'inactive' | 'connecting' | 'error';

interface SourceStatus {
  source_id: string;
  source_type: string;
  status: SourceState;
  last_connected_at?: string;
  last_error_at?: string;
  last_error?: string;
}
```

### WebSocket Messages (see also Section 17)

```typescript
// Server → Client (discriminated union on `type`)
type WsServerMessage =
  | { type: 'update'; payload: WsBatchUpdate }
  | { type: 'point_stale'; payload: WsPointStale }
  | { type: 'point_fresh'; payload: WsPointFresh }
  | { type: 'source_offline'; payload: WsSourceStatus }
  | { type: 'source_online'; payload: WsSourceStatus }
  | { type: 'alert_notification'; payload: WsAlertNotification }
  | { type: 'alert_acknowledged'; payload: WsAlertAcknowledged }
  | { type: 'export_notification'; payload: WsExportNotification }
  | { type: 'export_progress'; payload: WsExportProgress }
  | { type: 'presence_update'; payload: WsPresenceUpdate }
  | { type: 'ping'; payload: Record<string, never> }
  | { type: 'server_restarting'; payload: Record<string, never> };

interface WsBatchUpdate {
  points: WsPointValue[];
}

interface WsPointValue {
  id: string;        // point_id UUID
  v: number;         // value
  q: PointQuality;   // quality
  t: number;         // epoch_ms
}

interface WsPointStale {
  point_id: string;
  last_updated_at: string;   // RFC 3339
}

interface WsPointFresh {
  point_id: string;
  value: number;
  timestamp: string;         // RFC 3339
}

interface WsSourceStatus {
  source_id: string;
  source_name: string;
}

interface WsAlertNotification {
  alert_id: string;
  severity: EventSeverity;
  template_name: string;
  title: string;
  message: string;
  requires_acknowledgment: boolean;
  full_screen_takeover: boolean;
  triggered_at: string;
}

interface WsAlertAcknowledged {
  alert_id: string;
  acknowledged_by: string;
  acknowledged_at: string;
}

interface WsExportNotification {
  job_id: string;
  status: 'completed' | 'failed';
  download_url?: string;
  error_message?: string;
}

interface WsExportProgress {
  job_id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress_pct: number;
}

interface WsPresenceUpdate {
  user_id: string;
  presence_state: 'on_site' | 'off_site';
  badge_event_type?: string;
  timestamp: string;
}

// Client → Server (discriminated union on `type`)
type WsClientMessage =
  | { type: 'subscribe'; points: string[] }
  | { type: 'unsubscribe'; points: string[] }
  | { type: 'acknowledge_alert'; alert_id: string }
  | { type: 'pong' }
  | { type: 'status_report'; render_fps: number; pending_updates: number; last_batch_process_ms: number };
```

### Health Check Types

```typescript
type ReadyStatus = 'ready' | 'degraded' | 'not_ready';

interface ReadyResponse {
  status: ReadyStatus;
  service: string;
  version: string;
  uptime_seconds: number;
  checks: Record<string, CheckResult>;
}

interface CheckResult {
  status: 'ok' | 'timeout' | 'error';
  latency_ms: number;
  error?: string;
}
```

---

## 17. WebSocket Message → React Handler Registry

This section defines which frontend store or hook handles each WebSocket message type. Every `WsServerMessage` variant MUST have exactly one handler registered. Unhandled message types are logged as warnings and discarded.

**Implementation:** The WebSocket client (`src/shared/ws/client.ts`) deserializes each message, reads the `type` discriminant, and dispatches to the registered handler. Handlers are registered at app initialization in `src/shared/ws/registry.ts`.

### Handler Registry

| Message Type | Handler Store/Hook | Action |
|---|---|---|
| `update` | `usePointStore` (Zustand) | Upsert point values into `pointValues: Map<string, PointValue>`. Notify subscribed components via selector. Update sparkline buffers. |
| `point_stale` | `usePointStore` | Set `stalePoints: Set<string>` flag. Components show stale indicator (gray badge, dimmed value). |
| `point_fresh` | `usePointStore` | Remove from `stalePoints` set. Components restore normal display. |
| `source_offline` | `useSourceStore` (Zustand) | Set source status to offline. Console/Process show source status banner. |
| `source_online` | `useSourceStore` | Set source status to online. Remove source status banner. |
| `alert_notification` | `useAlertStore` (Zustand) | Push to `activeAlerts` array. Increment unacknowledged count (top bar badge). If `full_screen_takeover`, trigger emergency overlay via Shell. |
| `alert_acknowledged` | `useAlertStore` | Update alert status in `activeAlerts`. Decrement unacknowledged count. |
| `export_notification` | `useExportStore` (Zustand) | Update job status. Show toast notification (success/failure). Make download URL available. |
| `export_progress` | `useExportStore` | Update progress bar in My Exports panel. |
| `presence_update` | `usePresenceStore` (Zustand) | Update user presence state. Muster dashboard and Shifts module consume this. |
| `ping` | WebSocket client (direct) | Immediately send `{ type: "pong" }`. No store interaction. Server disconnects if no pong within 10 seconds. |
| `server_restarting` | WebSocket client (direct) | Show reconnection banner. Enter exponential backoff reconnect loop. |

### Subscription Lifecycle

```typescript
// Console/Process graphics: subscribe on mount, unsubscribe on unmount
useEffect(() => {
  const pointIds = graphic.bindings.map(b => b.point_id);
  wsClient.send({ type: 'subscribe', points: pointIds });
  return () => wsClient.send({ type: 'unsubscribe', points: pointIds });
}, [graphic.id]);

// Dashboard widgets: same pattern, widget-scoped
// Forensics: no subscription (historical data only)
// Historical playback: subscriptions stay active but updates are ignored (doc 16 v0.8)
```

### Error Handling

- **Unknown message type**: Log `warn` with full message payload, discard. Forward-compatible with future message types.
- **Deserialization failure**: Log `error` with raw message, discard. Do not crash the WebSocket connection.
- **Handler throws**: Catch at dispatch level, log `error`, continue processing. One bad handler must not kill the connection.

---

## 18. RBAC Permission Enum

Machine-readable permission registry. Both Rust and TypeScript must use these exact strings. No ad-hoc permission strings anywhere in the codebase.

**Rust implementation:** `io-models` crate, `pub enum Permission` with `#[serde(rename_all = "snake_case")]` and string serialization matching the format below.

**TypeScript implementation:** `src/shared/types/permissions.ts` as a `const` enum or union type.

**Database:** `permissions.name` column stores these exact strings. Seed data must match this list exactly.

### Complete Permission List (118 permissions)

```typescript
// Console Module (7)
type ConsolePermission =
  | 'console:read'
  | 'console:write'
  | 'console:workspace_write'
  | 'console:workspace_publish'
  | 'console:workspace_delete'
  | 'console:export'
  | 'console:admin';

// Process Module (6)
type ProcessPermission =
  | 'process:read'
  | 'process:write'
  | 'process:publish'
  | 'process:delete'
  | 'process:export'
  | 'process:admin';

// Designer Module (7)
type DesignerPermission =
  | 'designer:read'
  | 'designer:write'
  | 'designer:delete'
  | 'designer:publish'
  | 'designer:import'
  | 'designer:export'
  | 'designer:admin';

// Dashboards Module (6)
type DashboardsPermission =
  | 'dashboards:read'
  | 'dashboards:write'
  | 'dashboards:delete'
  | 'dashboards:publish'
  | 'dashboards:export'
  | 'dashboards:admin';

// Reports Module (7)
type ReportsPermission =
  | 'reports:read'
  | 'reports:write'
  | 'reports:generate'
  | 'reports:schedule_manage'
  | 'reports:delete'
  | 'reports:export'
  | 'reports:admin';

// Forensics Module (7)
type ForensicsPermission =
  | 'forensics:read'
  | 'forensics:write'
  | 'forensics:share'
  | 'forensics:search'
  | 'forensics:correlate'
  | 'forensics:export'
  | 'forensics:admin';

// Events Module (5)
type EventsPermission =
  | 'events:read'
  | 'events:manage'
  | 'events:acknowledge'
  | 'events:shelve'
  | 'events:admin';

// Log Module (7)
type LogPermission =
  | 'log:read'
  | 'log:write'
  | 'log:delete'
  | 'log:template_manage'
  | 'log:schedule_manage'
  | 'log:export'
  | 'log:admin';

// Rounds Module (7)
type RoundsPermission =
  | 'rounds:read'
  | 'rounds:execute'
  | 'rounds:transfer'
  | 'rounds:template_manage'
  | 'rounds:schedule_manage'
  | 'rounds:export'
  | 'rounds:admin';

// Settings Module (4)
type SettingsPermission =
  | 'settings:read'
  | 'settings:write'
  | 'settings:export'
  | 'settings:admin';

// Alerts (8)
type AlertsPermission =
  | 'alerts:read'
  | 'alerts:acknowledge'
  | 'alerts:send'
  | 'alerts:send_emergency'
  | 'alerts:manage_templates'
  | 'alerts:manage_groups'
  | 'alerts:configure'
  | 'alerts:muster';

// Email System (4)
type EmailPermission =
  | 'email:configure'
  | 'email:manage_templates'
  | 'email:send_test'
  | 'email:view_logs';

// Authentication (3)
type AuthPermission =
  | 'auth:configure'
  | 'auth:manage_mfa'
  | 'auth:manage_api_keys';

// Shifts Module (8)
type ShiftsPermission =
  | 'shifts:read'
  | 'shifts:write'
  | 'presence:read'
  | 'presence:manage'
  | 'muster:manage'
  | 'badge_config:manage'
  | 'alert_groups:read'
  | 'alert_groups:write';

// System (27)
type SystemPermission =
  | 'system:manage_users'
  | 'system:manage_groups'
  | 'system:manage_roles'
  | 'system:view_logs'
  | 'system:system_settings'
  | 'system:opc_config'
  | 'system:source_config'
  | 'system:event_config'
  | 'system:point_config'
  | 'system:point_deactivate'
  | 'system:expression_manage'
  | 'system:import_connections'
  | 'system:import_definitions'
  | 'system:import_execute'
  | 'system:import_history'
  | 'system:bulk_update'
  | 'system:change_backup'
  | 'system:change_restore'
  | 'system:data_link_config'
  | 'system:point_detail_config'
  | 'system:monitor'
  | 'system:sessions'
  | 'system:backup'
  | 'system:restore'
  | 'system:export_data'
  | 'system:import_data'
  | 'system:admin';

// Union type — the only valid permission strings
type Permission =
  | ConsolePermission
  | ProcessPermission
  | DesignerPermission
  | DashboardsPermission
  | ReportsPermission
  | ForensicsPermission
  | EventsPermission
  | LogPermission
  | RoundsPermission
  | SettingsPermission
  | AlertsPermission
  | EmailPermission
  | AuthPermission
  | ShiftsPermission
  | SystemPermission;
```

### Rust Equivalent

```rust
// In io-models crate
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Permission {
    // Console (7)
    #[serde(rename = "console:read")]
    ConsoleRead,
    #[serde(rename = "console:write")]
    ConsoleWrite,
    #[serde(rename = "console:workspace_write")]
    ConsoleWorkspaceWrite,
    #[serde(rename = "console:workspace_publish")]
    ConsoleWorkspacePublish,
    #[serde(rename = "console:workspace_delete")]
    ConsoleWorkspaceDelete,
    #[serde(rename = "console:export")]
    ConsoleExport,
    #[serde(rename = "console:admin")]
    ConsoleAdmin,

    // ... (same pattern for all 118 permissions)
    // Full enum generated from the TypeScript list above.
    // Serde rename ensures wire format matches exactly.
}
```

**Rule:** If `Permission::from_str("console:read")` fails, the permission string is invalid. The database seed data, JWT claims, and API responses must only contain strings that round-trip through this enum.

---

## 19. Expression AST Cross-Reference

The Expression Builder AST schema is fully defined in [23_EXPRESSION_BUILDER.md](23_EXPRESSION_BUILDER.md), Section 11 (AST Serialization Format). It specifies:

- `ExpressionDocument` root type with metadata + AST tree
- `ExprNode` discriminated union: `literal`, `point_ref`, `field_ref`, `unary`, `binary`, `function`, `conditional`, `group`
- Both Rust (`io-models` crate) and TypeScript (`ExprNode`) definitions
- JSONB storage in `saved_expressions.ast_json` and `alarm_definitions.expression_ast`
- Rhai evaluation engine contract

The expression AST is **not duplicated here** to avoid drift. Doc 23 is the single source of truth. All services that read or write expression ASTs (API Gateway, Event Service for alarm evaluation, frontend Expression Builder component) import the types from `io-models` (Rust) or `src/shared/types/expression.ts` (TypeScript).

---

## Change Log

- **v0.5**: Aligned crate names to canonical list (doc 01): `io-types` → `io-models` throughout, removed `io-common` references (functionality folded into `io-models` and `io-error`), simplified `io-config` section header (no standalone crate — config is per-service), `io-auth-middleware` → `io-auth`. Updated implementation path to reference canonical crate names.
- **v0.4**: Updated `FillGaugeMapping` cross-reference: doc 19 v1.3 added `placement` (`'vessel_overlay' | 'standalone'`) and `clip_to_shape_id` (optional SVG element ID) fields to both TypeScript and Rust types. These support standalone fill gauge bars independent of vessel shapes. TypeScript and Rust definitions in lockstep. See doc 19 Bindings JSONB Schema.
- **v0.3**: Cross-reference update: doc 19 v1.2 added 4 new `BindingMapping` variants (`AnalogBarMapping`, `FillGaugeMapping`, `SparklineMapping`, `AlarmIndicatorMapping`) for Point Value Display Elements. TypeScript interfaces in `src/shared/types/graphics.ts` and Rust types in `io-models` must be updated in lockstep. See doc 19 Bindings JSONB Schema for full type definitions.
- **v0.2**: Added TypeScript type parity (Section 16) — complete TS interfaces for all Rust types that cross service/frontend boundaries. Added WebSocket message → React handler registry (Section 17) — maps every WsServerMessage variant to its Zustand store handler with subscription lifecycle and error handling. Added RBAC permission enum (Section 18) — machine-readable 118-permission registry in both TypeScript union types and Rust serde-renamed enum, organized by module. Added Expression AST cross-reference (Section 19) — pointer to doc 23 Section 11 as single source of truth for AST schema.
- **v0.1**: Initial IPC contracts document. Codifies serialization standards, REST envelope (io-error), auth header formats, UDS binary protocol (MessagePack framing), all 9 NOTIFY channel payloads, health check contract (io-health), service identity table, shared domain types (io-models), pagination contract, structured logging and metrics contracts, inter-service HTTP call rules with `/internal/` prefix convention, WebSocket protocol types, configuration contract, and versioning/forward compatibility rules. Consolidates scattered specifications from docs 01, 02, 16, 21, 27, 28, 29, 36 into a single enforceable reference.
