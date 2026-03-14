# Inside/Operations - System Architecture

## High-Level Architecture

Inside/Operations follows a service-oriented architecture with 11 backend Rust services, a React frontend, and PostgreSQL database with TimescaleDB extension.

```
┌─────────────────────────────────────────────────────────────────┐
│                    NGINX (TLS, Reverse Proxy)                    │
└─────────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        │                     │                     │
        ▼                     ▼                     ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│  Frontend    │    │ API Gateway  │    │  Data Broker │
│  React SPA   │◄──►│  Rust/Axum   │    │   WebSocket  │
│              │    │              │    │              │
│  11 Modules  │    │  REST APIs   │    │  Real-Time   │
│              │    │  Routing/CRUD│    │    Fanout    │
└──────────────┘    └──────────────┘    └──────────────┘
                          │                     ▲
                          ▼                     │
      ┌────────────────────────────────────────────────┐
      │      PostgreSQL 16 + TimescaleDB               │
      │  ┌──────────────┐  ┌─────────────────────┐    │
      │  │  Config/Auth │  │  points_current      │    │
      │  │  Workspaces  │  │  points_history      │    │
      │  │  Logs/Rounds │  │  (Hypertable)        │    │
      │  │  Imports     │  │                      │    │
      │  │  Alerts/Email│  │                      │    │
      │  └──────────────┘  └─────────────────────┘    │
      └────────────────────────────────────────────────┘
                          ▲
   ┌──────────────────────┼──────────────────────────────────────────────────┐
   │     │       │       │       │       │       │       │       │          │
┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐┌────────┐
│ OPC  ││Event ││Import││Parser││Archiv││Alert ││Email ││ Auth ││Recogn. │
│Serv. ││Serv. ││Serv. ││Serv. ││Serv. ││Serv. ││Serv. ││Serv. ││Service │
│OPC UA││MSSQL ││Univ. ││Graph.││Time- ││Emerg.││Deliv.││SSO/  ││ONNX    │
│Client││Ingest││Import││Import││scale ││Alert ││Queue ││MFA   ││Infer.  │
└──────┘└──────┘└──────┘└──────┘└──────┘└──────┘└──────┘└──────┘└────────┘
   │        │        │                       │       │              │
   ▼        ▼        ▼                       ▼       ▼              ▼
┌──────┐ ┌──────┐ ┌────────────────────┐ ┌────────────────────┐ ┌────────┐
│OPC UA│ │MSSQL │ │ Databases, Files,  │ │ Twilio, SMTP,      │ │ OIDC/  │
│Server│ │Hist. │ │ APIs, Messaging,   │ │ MS Graph, Gmail,   │ │ SAML/  │
└──────┘ └──────┘ │ Industrial, LDAP,  │ │ Radio Dispatch,    │ │ LDAP   │
                  │ S3, SFTP, etc.     │ │ PA System          │ └────────┘
                  └────────────────────┘ └────────────────────┘

QoS Service Tiers (resource priority, highest to lowest):
  ① OPC Service          - Real-time point data    (< 2s latency)
  ① Alert Service        - Safety-critical alerts  (< 5s delivery)
  ② Event Service        - Near-real-time events   (< 30s latency)
  ③ Import Service       - Batch/scheduled imports  (best-effort)
  ③ Email Service        - Queued email delivery   (best-effort)
  ③ Recognition Service  - Batch inference          (best-effort)
```

## Services Overview

### 1. API Gateway (Port 3000)

**Purpose:** Central REST API endpoint for all client requests. Handles routing, CRUD endpoints, and JWT validation middleware. Auth flows (login, SSO, MFA) are delegated to the Auth Service. Recognition inference is delegated to the Recognition Service.

**Responsibilities:**
- HTTP request routing to appropriate handlers
- JWT validation middleware (via shared `io-auth` crate)
- RBAC authorization checks
- Input validation and sanitization
- Response formatting and error handling
- Rate limiting on authentication endpoints
- Request logging and metrics
- Server-side expression evaluation (Rhai) for historical data queries

**Technology:** Rust + Axum + SQLx

**Endpoints:** (all mounted under `/api/v1/` prefix — see [21_API_DESIGN.md](21_API_DESIGN.md) for versioning policy)
- `/api/auth/*` → Auth Service (3009) - Login, logout, refresh, SSO, MFA, SCIM, API keys, WebSocket tickets
- `/api/users/*` - User management
- `/api/groups/*` - Group management
- `/api/roles/*` - Role and permission management
- `/api/settings/*` - Application settings
- `/api/workspaces/*` - Console workspace CRUD
- `/api/graphics/*` - Graphics metadata and rendering
- `/api/designer/*` - Designer module operations
- `/api/dashboards/*` - Dashboard CRUD
- `/api/reports/*` - Report generation and export
- `/api/forensics/*` - Data query and correlation
- `/api/logs/*` - Operational log entries
- `/api/rounds/*` - Equipment round management
- `/api/points/*` - Point metadata and current values
- `/api/imports/*` - Import connections, definitions, operations, and history
- `/api/exports/*` - Universal Export job creation, status, and file download
- `/api/bulk-update/*` - Admin bulk update template generation, upload, validation, diff, and apply
- `/api/snapshots/*` - Change snapshot creation, listing, restore preview, and restore execution
- `/api/recognition/*` → Recognition Service (3010) - Symbol recognition inference (P&ID and DCS), model management, variation gap reports, and feedback (see [26_PID_RECOGNITION](26_PID_RECOGNITION.md))
- `/api/shifts/*` - Shift management, patterns, crews, current shift personnel
- `/api/presence/*` - On-site personnel, badge events, presence status
- `/api/muster/*` - Muster points, muster events, emergency accounting
- `/api/badge-sources/*` - Badge system adapter configuration and health
- `/api/alert-groups/*` - Custom alert group management (doc 30)
- `/api/notifications/*` - Human-initiated notifications: send, templates, groups, muster marks (doc 31)
- `/api/alerts/*` → Alert Service (3007) - Alert definitions, rosters, escalation policies, delivery history, acknowledgment
- `/api/email/*` → Email Service (3008) - Email templates, provider configuration, send requests, delivery status
- `/healthz` - Health check endpoint
- `/readyz` - Readiness check endpoint

### 2. Data Broker (Port 3001)

**Purpose:** WebSocket server for real-time data fanout

**Responsibilities:**
- Accept WebSocket connections from clients
- Authenticate WebSocket connections (JWT)
- Manage client subscriptions to data points
- Deduplicate subscriptions across clients
- Fan out **raw** data updates to subscribed clients (values in source engineering units)
- Maintain in-memory shadow copy of latest point values (for immediate delivery on new subscription)
- Handle backpressure (slow clients)
- Monitor connection health (heartbeat/ping-pong)
- Metrics on active connections and subscriptions

**Critical design constraint:** The Data Broker pushes raw values only. It has **no knowledge of UOM conversion or user display preferences**. UOM conversion for real-time data happens client-side in the frontend. This keeps the broker as a simple O(1)-per-update fanout service (multicast pattern).

**Technology:** Rust + Axum + tokio-tungstenite + SQLx

**Protocol:**
- Client connects: `wss://hostname:3001/ws?ticket=<ticket>` (single-use ticket, 30s TTL, see doc 16)
- Client sends: `{"type": "subscribe", "points": ["uuid1", "uuid2", ...]}`
- Client sends: `{"type": "unsubscribe", "points": ["uuid1", ...]}`
- Server sends: `{"type": "update", "point_id": "uuid", "value": 123.45, "quality": "good", "timestamp": "..."}`
- Server sends: `{"type": "ping"}` (heartbeat)
- Client responds: `{"type": "pong"}` (heartbeat)

**In-Memory State:**
- Subscription registry: `point_id -> Set<client_id>` and reverse map `client_id -> Set<point_id>`
- Shadow value cache: `point_id -> {value, quality, timestamp}` (~5 MB for 50K points)
- Total memory footprint: ~10 MB

### 3. OPC Service (Port 3002)

**Purpose:** OPC UA client for industrial data acquisition

**Responsibilities:**
- Connect to multiple OPC UA servers (managed via `point_sources` table)
- Crawl metadata (browse server namespace, discover points)
- Register/update points via `upsert_point_from_source()` (idempotent discovery with automatic metadata versioning)
- Subscribe to point value changes
- Poll points if subscriptions not supported
- Write values to `points_current` table (UPSERT)
- Append historical values to `points_history_raw` hypertable (batch INSERT with deduplication)
- Notify broker of updates (batched NOTIFY for throughput)
- Update `last_seen_at` on points during metadata refresh
- Update source connection status (`point_sources.status`, `last_connected_at`, `last_error_at`)
- Handle connection failures, reconnection, and backfill of missed data
- Update points-in-use registry (prioritize subscriptions)

**Technology:** Rust + opcua + SQLx + Tokio

**Configuration per source** (stored in `point_sources.connection_config` JSONB):
- OPC endpoint URL
- Security policy (None, Basic256Sha256, etc.)
- Security mode (None, Sign, SignAndEncrypt)
- Certificate paths
- Authentication method and credentials (encrypted)
- Polling interval (if subscriptions not used)
- Batch write size
- Browse root node
- Metadata refresh interval

**OPC UA Features Used:**
- Browse service (metadata discovery)
- Read service (initial values)
- Subscription service (change notifications)
- MonitoredItem service (configure data change filters)

### 4. Event Service (Port 3003)

**Purpose:** Ingest alarms and events from MSSQL event historian

**Responsibilities:**
- Connect to MSSQL event historian database
- Query new events using watermark (last processed timestamp)
- Transform events to internal schema
- Write to `events` and `alarms` tables
- Update watermark
- Partition historical data by time
- Handle connection failures and reconnection

**Technology:** Rust + tiberius (MSSQL) + SQLx + Tokio

**Configuration:**
- MSSQL connection string
- Database and table names
- Query interval (e.g., every 5 seconds)
- Batch size
- Retention policy

**Optional:** This service is only needed if MSSQL event historian integration is required.

### 5. Parser Service (Port 3004)

**Purpose:** Import and convert 3rd party graphics files, including DCS vendor-specific formats

**Responsibilities:**
- Accept uploaded graphics files (various formats)
- Parse proprietary formats to internal representation
- Extract point bindings (tagname → point_id mapping)
- Generate SVG rendering using the Shape Library ([35_SHAPE_LIBRARY.md](35_SHAPE_LIBRARY.md)) for symbol mapping
- Store graphics metadata in `design_objects` table
- Provide SVG render cache for performance
- Validate graphics before import
- DCS Graphics Import: vendor-specific extraction modules for converting native DCS/HMI console graphics into I/O SVG format (see [34_DCS_GRAPHICS_IMPORT.md](34_DCS_GRAPHICS_IMPORT.md))

**Technology:** Rust + Axum + SQLx + XML parsers

**Supported Formats:**
- SVG import (direct)
- DCS vendor-specific formats via pluggable extraction modules — each supported DCS vendor (Honeywell Experion, Emerson DeltaV, Yokogawa CENTUM, ABB 800xA, Siemens PCS 7, AVEVA/Wonderware, GE iFIX/Cimplicity, Rockwell FactoryTalk) has a dedicated parser. See [34_DCS_GRAPHICS_IMPORT.md](34_DCS_GRAPHICS_IMPORT.md) for format details.
- Generic XML-based graphics formats

**Note:** DCS Graphics Import (doc 34) works from vendor source files/databases. For screenshot-based import, see the Recognition Service (doc 26) which uses ML-based symbol detection.

### 6. Archive Service (Port 3005)

**Purpose:** Manage time-series data in TimescaleDB

**Responsibilities:**
- Create and maintain continuous aggregates (1min, 5min, 15min, 1hr, 1day)
- All aggregates filter by OPC UA quality: only `Good` values are included
- Apply compression policies to old data
- Apply retention policies (delete data older than N days)
- Rematerialized views
- Monitor hypertable health
- Run periodic maintenance tasks
- Serve on-demand rolling average calculations

**Technology:** Rust + SQLx + Tokio

**Continuous Aggregates:**
- `points_history_1m` - 1-minute avg, min, max, sum, count (Good quality only)
- `points_history_5m` - 5-minute avg, min, max, sum, count (Good quality only)
- `points_history_15m` - 15-minute avg, min, max, sum, count (Good quality only)
- `points_history_1h` - 1-hour avg, min, max, sum, count (Good quality only)
- `points_history_1d` - 1-day avg, min, max, sum, count (Good quality only)

**Rolling Averages:**
- Computed on-the-fly from raw data or smallest fitting aggregate
- Available for any window size when point's `aggregation_types` permits averaging
- Quality filtered: only `Good` values included
- See [18_TIMESERIES_DATA](../design-docs/18_TIMESERIES_DATA.md) for details

**Aggregation Type Enforcement:**
- Each point has an `aggregation_types` bitmask on `points_metadata`
- Controls which aggregate columns (avg, sum) are exposed to users
- Prevents semantically invalid calculations (e.g., averaging an accumulator)
- min, max, and count are always available

**Policies:**
- Compression: Compress chunks older than 7 days
- Retention: Delete raw data older than 90 days (configurable)
- Retention: Keep aggregates per tier (1m: 1yr, 5m: 2yr, 15m: 3yr, 1h: 5yr, 1d: 7yr)

### 7. Import Service (Port 3006)

**Purpose:** Universal data import from external systems (databases, files, APIs, messaging, industrial protocols)

**Responsibilities:**
- Connect to any external data source via trait-based connector architecture
- Discover source schemas (table structures, file headers, API responses)
- Map source fields to I/O target tables (auto-mapping with Jaro-Winkler fuzzy matching)
- Transform data (built-in Rust transforms + Rhai custom expressions)
- Validate data (JSON Schema, cross-field, referential integrity, duplicate detection)
- Load validated data into I/O PostgreSQL tables
- Manage import schedules (cron, interval, manual, file-arrival, webhook, dependency chain)
- Track import history, errors, and data quality metrics

**Technology:** Rust + Axum + SQLx + odbc-api + native connectors

**QoS Tier:** Lowest priority. Import Service yields CPU and I/O to OPC Service and Event Service. Configured with lower OS process priority (`nice`) and database connection pool limits to protect the real-time data path.

**Configuration:**
- Connection credentials (AES-256-GCM encrypted, same pattern as `point_sources.connection_config`)
- Import definitions with field mappings, transforms, and validation rules (JSONB)
- Schedule definitions (cron expressions, polling intervals)
- Error handling strategy per import (stop, skip, quarantine, threshold)

**Key design decisions:**
- **Separate service** -- never merged with OPC Service or Event Service to protect QoS isolation
- **Statically compiled connectors** -- all connector types built into a single binary (no plugin/WASM architecture)
- **Linear pipeline** -- Extract → Map → Transform → Validate → Load (not arbitrary DAG)
- **Native Rust drivers** for the 4 most common databases (PostgreSQL, MSSQL, MySQL, Oracle); ODBC as fallback for uncommon databases

See [24_UNIVERSAL_IMPORT](../design-docs/24_UNIVERSAL_IMPORT.md) for complete design specification.

### 8. Alert Service (Port 3007)

**Purpose:** Emergency and operational alerting with multi-channel delivery and escalation

**Responsibilities:**
- Receive alert triggers from Event Service, manual user actions, OPC failures, or other services
- Route alerts through pluggable channel adapters (WebSocket, Email, SMS/Twilio, Voice/Twilio, Radio Dispatch, PA System, Browser Push)
- Run escalation engine with timer-based escalation when acknowledgment is not received
- Manage recipient rosters and on-call schedules
- Track delivery status per channel per recipient
- Maintain full audit trail of alert lifecycle (triggered → delivered → acknowledged/escalated)

**Technology:** Rust + Axum + SQLx + reqwest + lettre + web-push-native + Tokio

**Dependencies:**
- PostgreSQL (alert definitions, rosters, delivery tracking, escalation state)
- Data Broker / WebSocket (in-app alert delivery to connected clients)
- Email Service (email channel delivery delegated to Email Service)
- External: Twilio API (SMS/voice), radio dispatch software, PA system REST API

**QoS Tier:** Highest priority (tied with OPC Service). Alert delivery is safety-critical and must not be starved by lower-priority services.

See [27_ALERT_SYSTEM](../design-docs/27_ALERT_SYSTEM.md) for complete design specification.

### 9. Email Service (Port 3008)

**Purpose:** System-wide email delivery for alerts, reports, notifications, and administrative messages

**Responsibilities:**
- Accept email requests from any service via internal API
- Queue emails in PostgreSQL with SKIP LOCKED worker pattern for concurrent processing
- Select optimal provider per email based on configuration and provider health
- Support multiple simultaneous providers: SMTP, SMTP+XOAUTH2, Microsoft Graph API, Gmail API, Webhook, Amazon SES
- Render email bodies from MiniJinja templates
- Track delivery status, retries, and failures
- Provide delivery history and metrics

**Technology:** Rust + Axum + SQLx + lettre + oauth2 + minijinja + reqwest + Tokio

**Dependencies:**
- PostgreSQL (email queue, templates, delivery log, provider configuration)
- External: SMTP servers, Microsoft Graph API, Gmail API, Amazon SES, webhook endpoints

**QoS Tier:** Normal priority. Email delivery is best-effort with retry. Non-urgent emails tolerate minutes of delay.

See [28_EMAIL_SERVICE](../design-docs/28_EMAIL_SERVICE.md) for complete design specification.

### 10. Auth Service (Port 3009)

**Purpose:** Centralized authentication, identity management, and WebSocket ticket issuance

**Responsibilities:**
- Local login flows (username/password with Argon2 verification)
- SSO integration (OIDC, SAML 2.0, LDAP/Active Directory)
- MFA verification (TOTP, SMS via Twilio client, email via Email Service)
- SCIM 2.0 provisioning (user sync from external identity providers)
- API key management (create, rotate, revoke service account keys)
- WebSocket ticket issuance (in-memory ticket store, 30s TTL, single-use)
- JWT token generation (access + refresh)
- Session management (refresh token storage, revocation)

**Technology:** Rust + Axum + SQLx + argon2 + jsonwebtoken + totp-rs + Tokio

**Dependencies:**
- PostgreSQL (users, sessions, auth provider configs, API keys)
- Email Service (MFA email codes, password reset links)
- External: OIDC providers, SAML IdPs, LDAP/AD servers, Twilio (SMS MFA)

**Design note:** JWT validation does NOT require the Auth Service. All services validate JWTs independently using the shared `io-auth` crate and the signing key from environment config. The Auth Service is only needed for login/token issuance, not for request authorization.

See [29_AUTH_SERVICE](../design-docs/29_AUTH_SERVICE.md) for complete design specification.

### 11. Recognition Service (Port 3010)

**Purpose:** ONNX model inference for P&ID and DCS symbol recognition

**Responsibilities:**
- Load and manage `.iomodel` packages (P&ID and DCS, both single-model detection)
- Run ONNX inference via `ort` crate (CPU or GPU)
- P&ID recognition: single-pass symbol detection from uploaded P&ID images
- DCS recognition: multi-stage pipeline (equipment detection → line classification → text detection → text classification → post-processing)
- Variation gap report generation (`.iogap` format)
- Feedback collection (`.iofeedback` export for SymBA)
- Model version management (active model selection, rollback)

**Technology:** Rust + Axum + SQLx + ort (ONNX Runtime) + Tokio

**Dependencies:**
- PostgreSQL (`recognition_correction` table, model metadata)
- Filesystem (`.iomodel` package storage)

**QoS Tier:** Lowest priority. Recognition is batch/on-demand work that yields to real-time data and alerting paths.

See [26_PID_RECOGNITION](../design-docs/26_PID_RECOGNITION.md) for complete design specification.

### Service Workload Profiles

| Service | Port | Responsibilities | CPU Profile | Memory Profile |
|---------|------|-----------------|-------------|----------------|
| API Gateway | 3000 | HTTP routing, CRUD endpoints, JWT validation | Low-Medium | Low |
| Data Broker | 3001 | WebSocket fanout, subscription registry, shadow cache | Medium | Medium (cache) |
| OPC Service | 3002 | OPC UA client, point data ingestion, metadata crawl | Medium | Medium (buffer) |
| Event Service | 3003 | Event processing, alarm state management | Low | Low |
| Parser Service | 3004 | File format parsing, SVG processing | Low (burst) | Medium (burst) |
| Archive Service | 3005 | Data aggregation, compression, retention | Low | Low |
| Import Service | 3006 | ETL, external data connectors | Low (burst) | Medium (burst) |
| Alert Service | 3007 | Multi-channel alerting, escalation engine | Low | Low |
| Email Service | 3008 | Email queue processing, template rendering | Low | Low |
| Auth Service | 3009 | SSO flows, MFA, SCIM, API keys, WS tickets | Low | Low |
| Recognition Service | 3010 | ONNX inference, model management, gap reports | Medium (burst) | Medium (model) |

If any service becomes a bottleneck, the trait-based architecture allows extraction or horizontal scaling without changing the overall system design.

## Data Flows

### Real-Time Point Data Flow

```
1. OPC UA Server sends value change notification
   ↓
2. OPC Service receives update
   ↓
3. OPC Service writes to points_current (UPSERT, HOT-optimized with fillfactor=80)
   ↓
4. OPC Service writes to points_history_raw (batch INSERT with ON CONFLICT DO NOTHING)
   ↓
5. OPC Service sends batch update to Data Broker via Unix domain socket (primary)
   or PostgreSQL NOTIFY (fallback)
   ↓
6. Broker receives batch, updates shadow value cache
   ↓
7. Broker looks up subscribed clients for each point_id
   ↓
8. Broker sends raw value via WebSocket to each subscribed client
   ↓
9. Frontend receives update, applies client-side UOM conversion, updates UI (< 2s end-to-end)
```

**OPC → Broker notification mechanism (dual-path):**

**Primary path — Unix domain socket IPC:**
OPC Service writes batched point updates directly to Data Broker via a Unix domain socket (`/var/run/io/opc-broker.sock`). The protocol is a simple length-prefixed binary frame containing the batch of `(point_id, value, quality, timestamp)` tuples. Unix domain socket IPC handles 50K+ points/sec with sub-millisecond latency.

**Fallback path — PostgreSQL NOTIFY:**
If the Unix socket is unavailable (Broker restarting, socket file missing), OPC Service falls back to PostgreSQL NOTIFY/LISTEN. This path is limited to ~5-10K points/sec depending on payload size (8KB NOTIFY payload limit, single-threaded LISTEN) and should be treated as a fallback, not the primary path.

```sql
-- Fallback: OPC Service batches updates within a ~100ms window
NOTIFY point_update, '{"batch_id": 12345, "count": 50}';

-- Broker:
LISTEN point_update;
-- Broker fetches batch from points_current or decodes batch payload
```

**Path selection:** Configurable via environment variable (`IO_OPC_BROKER_IPC=unix|notify`). Default is `unix`. OPC Service auto-falls back to NOTIFY if Unix socket connection fails, and auto-promotes back to Unix socket when it becomes available. This is a config-level switch, not a code change — both paths produce identical downstream behavior.

### Historical Data Query Flow

```
1. User requests historical data (e.g., 30-day trend)
   ↓
2. Frontend calls API Gateway: GET /api/points/{id}/history?from=...&to=...&resolution=...
   ↓
3. API Gateway determines appropriate aggregate table:
   - < 1 hour: points_history_raw or points_history_1m
   - 1 hour - 1 day: points_history_5m
   - 1-7 days: points_history_15m
   - 8-30 days: points_history_1h
   - > 30 days: points_history_1d
   Note: All aggregates contain only Good quality data.
   API validates requested aggregate type against point's aggregation_types bitmask.
   ↓
4. API Gateway queries TimescaleDB continuous aggregate
   ↓
5. TimescaleDB returns aggregated data (fast query < 100ms)
   ↓
6. API Gateway returns JSON to frontend
   ↓
7. Frontend renders chart or table
```

### Graphics Import Flow

```
1. User uploads graphics file via Designer module
   ↓
2. Frontend sends file to API Gateway: POST /api/designer/import
   ↓
3. API Gateway forwards to Parser Service
   ↓
4. Parser Service detects file format
   ↓
5. Parser Service parses file structure
   ↓
6. Parser Service extracts point bindings
   ↓
7. Parser Service generates SVG representation
   ↓
8. Parser Service writes to design_objects table
   ↓
9. API Gateway returns graphics_id to frontend
   ↓
10. Frontend displays imported graphic in designer canvas
```

### DCS Graphics Import Flow

DCS graphics import follows the same general flow as P&ID, using the same single-model detection architecture but trained on DCS classes. Recognition is a fallback for when native DCS configuration files are not available -- it converts screenshots into editable SVG graphics.

```
1. User uploads a DCS graphics image via Designer module
   ↓
2. Frontend sends file to API Gateway: POST /api/designer/import
   ↓
3. API Gateway forwards to Recognition Service, which runs DCS inference:
   a. Detection model identifies DCS equipment symbols (27 types)
   b. Post-processing: NMS, confidence filtering, class mapping
   c. Heuristic post-processor associates nearby text with detected equipment
   ↓
4. Parser Service generates SVG representation with detected components
   ↓
5. Recognition Service returns results for user review in Designer import wizard
   ↓
6. Frontend displays imported graphic in designer canvas
```

The `model_domain` field in the `.iomodel` manifest determines which class map and symbol template set (P&ID or DCS) the Recognition Service uses.

### Alert Trigger Flow

```
1. Alert triggered (Event Service condition / Manual action / OPC failure)
   ↓
2. Alert Service receives trigger, resolves recipient roster
   ↓
3. Alert Service fans out to channel adapters:
   - WebSocket → Data Broker → connected clients (in-app notification)
   - Email → Email Service queue → provider → recipient inbox
   - SMS → Twilio API → recipient phone
   - Voice → Twilio API → recipient phone (voice call)
   - Radio → Radio dispatch REST API → field radios
   - PA → PA system REST API → plant speakers
   - Browser Push → Web Push API → browser notification
   ↓
4. Delivery tracking: per-channel, per-recipient status logged
   ↓
5. Escalation engine: if no acknowledgment within timeout, escalate to next tier
   ↓
6. Acknowledgment received → alert closed, audit trail finalized
```

### Email Delivery Flow

```
1. Any service (Alert Service, Report generation, Admin action, etc.)
   submits email request to Email Service internal API
   ↓
2. Email Service inserts into PostgreSQL email queue
   ↓
3. SKIP LOCKED worker picks up queued email
   ↓
4. Worker selects provider (based on config, health, priority)
   ↓
5. Worker renders body from MiniJinja template (if templated)
   ↓
6. Worker delivers via selected provider (SMTP, Graph API, Gmail, SES, Webhook)
   ↓
7. Delivery result logged (success/failure/retry)
```

### Authentication Flow

```
1. User submits credentials via login form
   ↓
2. Frontend POSTs to API Gateway: POST /api/auth/login
   ↓
3. API Gateway proxies to Auth Service (3009)
   ↓
4. Auth Service queries users table, determines auth provider
   ↓
5. Auth Service verifies credentials (Argon2 for local, redirect for SSO, LDAP bind for AD)
   ↓
6. Auth Service checks MFA requirement, verifies MFA if enabled
   ↓
7. Auth Service generates JWT access token (15min expiry)
   ↓
8. Auth Service generates refresh token (7 days, stored in DB)
   ↓
9. Auth Service returns both tokens to frontend (via API Gateway)
   ↓
10. Frontend stores tokens (memory for access, httpOnly cookie for refresh)
   ↓
11. Frontend includes access token in Authorization header for all API calls
   ↓
12. When access token expires, frontend uses refresh token to get new access token
```

**Note:** JWT validation does not require the Auth Service. All services validate JWTs independently using the shared `io-auth` crate and the signing key loaded from environment config. The Auth Service is only involved in token issuance (login, refresh, SSO callbacks).

### Authorization Flow (RBAC)

```
1. Client makes API request with JWT in Authorization header
   ↓
2. API Gateway extracts and validates JWT
   ↓
3. API Gateway extracts user_id and role from JWT claims
   ↓
4. API Gateway checks if role has required permission for endpoint
   ↓
5. If authorized: proceed to handler
   If not authorized: return 403 Forbidden
```

## Database Schema Overview

### Core Tables

**users** - User accounts
- Columns: id, username, password_hash (nullable), email, full_name, enabled, auth_provider, auth_provider_config_id, auth_provider_user_id, external_id, is_service_account, last_login_at, mfa_enabled, mfa_enrollment_deadline, created_at, updated_at
- Indexes: username (unique), email (unique)

**groups** - User groups
- Columns: id, name, description, created_at, updated_at

**user_groups** - Many-to-many relationship
- Columns: user_id, group_id

**roles** - 8 predefined roles (Viewer, Operator, Analyst, Supervisor, Content Manager, Maintenance, Contractor, Admin)
- Columns: id, name, description

**permissions** - Fine-grained permissions
- Columns: id, name, description, module

**role_permissions** - Role → Permission mapping
- Columns: role_id, permission_id

**user_roles** - User → Role assignment
- Columns: user_id, role_id

**user_sessions** - Session tracking
- Columns: id, user_id, refresh_token, expires_at, device_info, ip_address, last_accessed_at, created_at

**settings** - Key-value configuration
- Columns: key, value (JSONB), updated_at, updated_by

### Graphics Tables

**workspaces** - Console workspaces
- Columns: id, name, user_id, layout (JSONB), published, created_at
- Sharing via `workspace_shares` join table (grantee_id, grantee_type, permission_level)

**design_objects** - Graphics objects
- Columns: id, name, type, svg_data, bindings (JSONB), parent_id, metadata (JSONB), created_by, created_at, updated_at

**dashboards** - Dashboard configurations
- Columns: id, name, user_id, layout (JSONB), widgets (JSONB), published, created_at
- Sharing via `dashboard_shares` join table (grantee_id, grantee_type, permission_level)

**report_templates** - Report template definitions
- Columns: id, name, template_config (JSONB), created_by, created_at, updated_at

### Point Data Tables

**point_sources** - Data source registry
- Columns: id (UUID), name, source_type (VARCHAR+CHECK: opc_ua, modbus, manual, mqtt, csv), status (VARCHAR+CHECK: active, inactive, error, connecting), connection_config (JSONB), last_connected_at, last_error_at, last_error_message, enabled, description, created_at, updated_at
- Tracks all data sources (OPC servers; Modbus TCP and MQTT planned for Phase 3)
- Connection configuration stored as JSONB per source type
- Unique constraint on name

**points_metadata** - Point definitions with application configuration
- Columns: id (UUID), tagname, source_id (FK to point_sources), description, engineering_units, data_type, min_value, max_value, aggregation_types (INTEGER bitmask), active, criticality, area, default_graphic_id, gps_latitude, gps_longitude, barcode, notes, app_metadata (JSONB), write_frequency_seconds, first_seen_at, last_seen_at, last_good_value_at, deactivated_at, reactivated_at, created_at, updated_at
- Identity: unique (tagname, source_id) -- same tagname on different sources gets separate UUIDs
- Current source metadata (description, engineering_units, data_type, min/max) denormalized from latest version, kept in sync by trigger
- aggregation_types controls which aggregate operations are valid: bit 0 = averaging, bit 1 = summing, bit 2 = accumulation
- Never-delete policy enforced by database trigger; deactivate instead
- Points_metadata(id) remains the universal FK for all downstream tables

**points_metadata_versions** - Versioned source metadata history
- Columns: id (UUID), point_id (FK), version (INTEGER), description, engineering_units, data_type, min_value, max_value, effective_from, source_raw (JSONB), created_at
- Per-point version numbering (version 0 = initial discovery)
- Forensic history: "what were this point's units on a given date?"
- Trigger syncs latest version to denormalized columns on points_metadata

**points_current** - Latest point values
- Columns: point_id, value, quality, timestamp, updated_at
- `fillfactor=80` for HOT (Heap Only Tuple) update optimization
- Indexes: point_id (PK), updated_at

**points_history_raw** (TimescaleDB Hypertable)
- Columns: point_id, value, quality, timestamp
- Stores all quality levels (Good, Bad, Uncertain) for full history
- UNIQUE constraint on (point_id, timestamp) for deduplication
- Partitioned by: timestamp (1-day chunks)
- Indexes: (point_id, timestamp) composite

**points_history_1m, 5m, 15m, 1h, 1d** - Continuous aggregates
- Columns: point_id, bucket (timestamp), avg, min, max, sum, count
- Materialized views refreshed periodically
- Only include values with Good OPC UA quality status

**points_in_use** - Prioritized subscription registry
- Columns: point_id, last_accessed, access_count
- Tracks which points are actively displayed

### Import Tables

**import_connections** - External system connection configurations
- Columns: id, name, connection_type, config (JSONB, encrypted credentials), auth_type, enabled, last_tested_at, last_test_status, created_by, created_at, updated_at

**import_definitions** - Import job definitions (source query, field mappings, transforms, validation)
- Columns: id, connection_id (FK), name, source_config (JSONB), field_mappings (JSONB), transforms (JSONB), validation_rules (JSONB), target_table, error_strategy, enabled, created_by, created_at, updated_at

**import_schedules** - Schedule configuration per import definition
- Columns: id, import_definition_id (FK), schedule_type, schedule_config (JSONB), enabled, next_run_at, last_run_at

**import_runs** - Import execution history
- Columns: id, import_definition_id (FK), status, rows_extracted/mapped/transformed/validated/loaded/errored, started_at, completed_at, error_message, watermark_state (JSONB)

**import_errors** - Per-row error details from failed imports
- Columns: id, import_run_id (FK), row_number, field_name, error_type, error_message, raw_value, created_at

**custom_import_data** - Generic target table for data that doesn't map to existing I/O tables
- Columns: id, import_definition_id (FK), data (JSONB), source_row_id, imported_at

### Expression Builder Tables

**custom_expressions** - Saved expression definitions
- Columns: id (UUID), name, description, expression (JSONB AST), output_type, output_precision, expression_context, created_by, shared, referenced_point_ids (UUID[]), created_at, updated_at
- FK from points_metadata.custom_expression_id (ON DELETE SET NULL)

### Recognition Tables

**recognition_correction** - User corrections to P&ID and DCS recognition results for feedback export
- Columns: correction_id (UUID), image_hash, correction_type, original_data (JSONB), corrected_data (JSONB), model_version, created_by, created_at
- Indexes: model_version, created_at
- See [26_PID_RECOGNITION](26_PID_RECOGNITION.md)

### Alerting Tables (Domain 11)

**alert_templates** - Alert rule definitions
- Columns: id, name, description, trigger_type, trigger_config (JSONB), roster_id, escalation_policy_id, enabled, created_by, created_at, updated_at

**alert_rosters** - Recipient roster definitions
- Columns: id, name, members (JSONB), on_call_schedule (JSONB), created_by, created_at, updated_at

**alerts** - Active/historical alert instances
- Columns: id, template_id, status, triggered_at, acknowledged_at, acknowledged_by, escalation_level, resolved_at, metadata (JSONB)

**alert_deliveries** - Per-channel, per-recipient delivery tracking
- Columns: id, alert_id, recipient_id, channel, status, sent_at, delivered_at, failed_at, error_message

**alert_escalations** - Escalation tier definitions with timeouts
- Columns: id, alert_id, from_level, to_level, escalated_at, reason

### Email Tables (Domain 12)

**email_queue** - PostgreSQL-backed email delivery queue
- Columns: id, from_address, to_addresses, cc_addresses, bcc_addresses, subject, body_html, body_text, template_id, template_data (JSONB), priority, status, provider_id, attempts, next_retry_at, created_at, sent_at, error_message

**email_templates** - MiniJinja email templates
- Columns: id, name, subject_template, body_template, created_by, created_at, updated_at

**email_providers** - Provider configuration
- Columns: id, name, provider_type, config (JSONB, encrypted credentials), enabled, priority, health_status, last_check_at, created_at, updated_at

**email_delivery_log** - Delivery audit trail
- Columns: id, email_queue_id, provider_id, status, provider_message_id, sent_at, error_message

### Operational Tables

**log_entries** - Operational log book
- Columns: id, title, content (rich text), user_id, tags (array), created_at

**rounds** - Equipment round definitions
- Columns: id, name, checklist (JSONB), assigned_to, due_at, completed_at

**events** - Alarm/event history
- Columns: id, event_type, severity, message, source, timestamp

**log_attachments** - Log entry file attachments
- Columns: id, log_entry_id, file_path, filename, file_type, file_size, uploaded_at

**system_logs** - Application system logs
- Columns: id, level, service, message, metadata (JSONB), timestamp

**audit_log** - Audit trail
- Columns: id, user_id, action, table_name, record_id, changes (JSONB), created_at

## Security Architecture

### Transport Security
- TLS 1.3 termination at nginx
- HTTPS only (no HTTP)
- WebSocket over TLS (wss://)
- Certificate management (Let's Encrypt or self-signed)

### Authentication
- JWT tokens (access + refresh)
- Access token: 15-minute expiry, stored in memory
- Refresh token: 7-day expiry, stored in httpOnly cookie
- Password hashing: Argon2 (configurable cost)
- Session management: refresh tokens in database with revocation

### Authorization
- Role-Based Access Control (RBAC)
- 8 predefined roles: Viewer, Operator, Analyst, Supervisor, Content Manager, Maintenance, Contractor, Admin
- 118 fine-grained permissions across 15 modules
- Permission checks on every API endpoint
- Permission checks in UI (hide unauthorized features)

### Input Validation
- All API inputs validated before processing
- SQLx parameterized queries (SQL injection prevention)
- React automatic escaping (XSS prevention)
- File upload validation (size limits, type checking)
- Rate limiting on authentication endpoints (future)

### Audit Logging
- All mutations logged to audit_log table
- Track: who, what, when, before/after state
- Immutable audit trail (no updates/deletes)

## Architectural Patterns

### Shared Crate First

Common functionality is implemented as internal Cargo workspace crates (`io-*`), compiled into each service at build time. This eliminates runtime inter-service dependencies for critical-path operations — if the Auth Service is down, other services can still validate JWTs because the validation logic is compiled in via `io-auth`, not called over the network.

**Decision framework:** When deciding whether shared functionality should be a crate or a standalone service:
- **Shared crate** if the functionality is stateless and on the critical path (e.g., JWT validation, error formatting, health checks)
- **Standalone service** if the functionality is stateful and needs its own queue, persistence, or lifecycle (e.g., email delivery, alert escalation)

**Internal workspace crates (11):**

| Crate | Purpose |
|-------|---------|
| `io-auth` | JWT validation, service token validation, RBAC permission checks, master key encrypt/decrypt |
| `io-bus` | IPC messaging — UDS frame codec, NOTIFY channel helpers, message routing |
| `io-db` | SQLx pool setup, connection management, migration helpers, audit log writing |
| `io-error` | Unified error types, API error response formatting |
| `io-models` | Shared domain types — Rust structs mirroring DB schema, serde derives |
| `io-opc` | OPC UA data types, subscription helpers, tag path parsing |
| `io-time` | Timestamp handling, timezone utilities, duration formatting |
| `io-validate` | Input validation rules, sanitization, constraint checking |
| `io-export` | Export format utilities (CSV, PDF/Typst, HTML, JSON, .iobackup, .iographic) |
| `io-health` | Three-tier health check endpoints (live/ready/startup). See doc 36 |
| `io-observability` | Unified tracing + metrics + health init, structured logging, Prometheus `/metrics`. See doc 36 |

All crates are workspace members in the Cargo workspace. Adding a new crate is a `cargo new --lib io-<name>` + workspace member entry.

> **Consolidated from earlier design:** `io-telemetry` merged into `io-observability`. `io-config` is per-service (not shared). `io-crypto` merged into `io-auth`. `io-audit` merged into `io-db`. `io-sms` is a direct dependency of Alert/Auth services, not a shared crate.

### Inter-Service Authentication

All inter-service HTTP calls include an `Authorization: Bearer <IO_SERVICE_SECRET>` header. The shared service secret is loaded from the `IO_SERVICE_SECRET` environment variable, which is the same across all services in a deployment.

The `io-auth` crate handles validation of both user JWTs and service tokens. The middleware inspects the Bearer token format to determine which validation path to use (JWT decode vs. constant-time service secret comparison).

For single-server localhost deployments, the service secret provides defense-in-depth alongside firewall rules. For multi-server deployments, it ensures services authenticate even across network boundaries.

### Delete Semantics

All data deletion follows one of two policies depending on the nature of the record.

**Soft delete (default for business entities):**
- Add a `deleted_at TIMESTAMPTZ` column (NULL = active, non-NULL = deleted).
- All queries filter `WHERE deleted_at IS NULL` by default. Admins can toggle visibility of soft-deleted records where the UI supports it.
- Records are never physically removed from the database.
- Applies to: `dashboards`, `reports`, `report_templates`, `designs`, `design_objects`, `log_entries`, `log_templates`, `round_templates`, `round_instances`, `alert_templates`, `alert_escalations`, `custom_expressions`, `point_sources`, `points_metadata` (via existing deactivation), `workspaces`, `users` (deactivation via existing `deactivated_at`).

**Hard delete (transient/operational data):**
- Physical DELETE for ephemeral records that have no long-term business value.
- Applies to: WebSocket tickets (in-memory, 30s TTL), expired `refresh_tokens`, expired `auth_flow_states`, `notification_queue` items after delivery, export temp files on disk, expired MFA codes.
- No audit trail is recorded for these deletions — they are routine housekeeping of ephemeral data.

**Audit logging of deletes:**
- Both soft deletes and hard deletes of **business entities** are recorded in `audit_log` before execution.
- The audit entry captures the full record state at deletion time (`changes` JSONB with `before` snapshot).
- Housekeeping deletions of transient data (listed above) are exempt from audit logging.

### Logging Architecture

The system uses two parallel logging systems that serve different audiences at different granularity levels.

**`system_logs` table (operator-facing):**
- Receives `info`, `warn`, and `error` level operational events only. No `debug` or `trace`.
- Queryable from Settings > System Monitoring UI via `GET /api/system-logs`.
- Event types: service start/stop, OPC connection failures, configuration changes, health check failures, backup status, upgrade events, database failover events.
- Retention policy applies (configurable, default aligned with other operational data).
- Inserted by services via `io-observability` crate helper that writes to both the table and structured file logs simultaneously.

**Structured file logging via `tracing` crate (developer-facing):**
- Full `debug` and `trace` output to structured log files in JSON format.
- Used for development diagnostics and production troubleshooting.
- Rotated by size (default: 100 MB per file) and age (default: 7 days retention).
- Not exposed in the I/O UI — accessed via SSH or log aggregation tools.
- Configured per-service via `RUST_LOG` environment variable (e.g., `RUST_LOG=io_api_gateway=debug,sqlx=warn`).

Both systems run in parallel. `system_logs` is the curated operational view for plant staff. File logs are the raw diagnostic stream for developers and sysadmins.

## Performance Architecture

### Scalability Strategies

**Vertical Scaling (Initial):**
- Single server deployment
- PostgreSQL on same server or dedicated database server
- Adequate for 200 concurrent users

**Horizontal Scaling (Future):**
- Multiple API Gateway instances behind load balancer
- Multiple Broker instances (sticky sessions or subscription coordination)
- PostgreSQL read replicas for read-heavy queries
- Redis for session sharing (if needed)

### Caching Strategies

**Data Broker (in-memory, ~10 MB):**
- Subscription registry: point_id ↔ client_id mappings (HashMap)
- Shadow value cache: latest value/quality/timestamp per point (~5 MB for 50K points)
- No metadata, no UOM, no user preferences

**API Gateway (in-memory, ~1 MB):**
- UOM catalog: categories + units + conversion factors (TTL: 1 hour)
- Source UOM mappings (TTL: 1 hour)
- User display preferences (per-session, TTL: 5 minutes)
- RBAC permissions and role mappings (TTL: 5 minutes)
- Application settings (TTL: 5 minutes)

**Frontend (in-memory):**
- UOM catalog fetched on app init (~103 units, used for client-side real-time conversion)
- User's display preferences (TanStack Query cache)
- Point metadata for open graphics (TanStack Query cache, stale-while-revalidate)
- Real-time point values from WebSocket (React state)
- Graphic SVG + bindings (TanStack Query cache, session lifetime)

**Database-Level:**
- PostgreSQL query plan cache
- TimescaleDB continuous aggregates (pre-computed)
- Connection pooling (SQLx) — see pool sizing below
- 50K points_metadata fits entirely in PostgreSQL buffer cache

### Database Connection Pool Sizing

Each service gets an independent SQLx connection pool sized to its workload. The `io-db` crate reads `IO_DB_POOL_MAX` and `IO_DB_POOL_MIN` environment variables, falling back to service-specific defaults:

| Service | Default Max | Rationale |
|---------|------------|-----------|
| API Gateway | 20 | Handles all REST traffic, concurrent request headroom |
| Data Broker | 10 | Mostly reads from shadow cache, DB for subscriptions/catchup |
| OPC Service | 5 | Writes are batched, rarely >2 concurrent transactions |
| Event Service | 10 | Alarm evaluation + event writes, moderate concurrency |
| Parser Service | 5 | Import processing is sequential per job |
| Archive Service | 3 | Background compression/retention, single-threaded |
| Import Service | 10 | Batch writes during imports, multiple concurrent runs |
| Alert Service | 5 | Alert evaluation and delivery tracking |
| Email Service | 3 | Queue polling, low concurrency |
| Auth Service | 10 | Login bursts at shift change |
| Recognition Service | 3 | Model inference is CPU-bound, minimal DB |

**Total: 84 connections** across all services. PostgreSQL `max_connections` should be set to at least 120 (84 + buffer for admin queries, monitoring, replication slots).

**Pool settings (all services):**
- `acquire_timeout`: 5 seconds (fail fast rather than queue indefinitely)
- `idle_timeout`: 10 minutes
- `max_lifetime`: 30 minutes (rotate connections to prevent stale TCP)
- `min_connections`: 1 (keep at least one warm connection per service)

**Deployment profile adjustments:**
- **Standalone**: Defaults above, `max_connections = 120`
- **Resilient**: Same per-service sizes, `max_connections = 150` (replication slots use a few)
- **Enterprise HA**: Scale per-service pools by instance count (e.g., 2 API Gateway instances = 40 connections for that service). Set `max_connections = 300+`

### Performance Monitoring

**Metrics Collected:**
- Request latency (p50, p95, p99)
- Database query time
- WebSocket connection count
- Subscription count per point
- OPC connection status
- Error rates
- System resources (CPU, memory, disk)

**Alerting:**
- High error rate (> 1%)
- Slow queries (> 500ms)
- Connection failures
- Disk space low (< 10%)

## Deployment Architecture

### Development Environment

```
Developer Machine
├── Docker Compose
│   ├── PostgreSQL + TimescaleDB (container)
│   └── nginx (container, optional)
├── Rust services (cargo run)
│   └── Hot reload with cargo-watch (optional)
└── Frontend (pnpm dev)
    └── Vite dev server with HMR
```

### Production Environment

```
Linux Server (Ubuntu/RHEL/Debian)
├── nginx (systemd service)
│   ├── TLS termination
│   ├── Static file serving
│   └── Reverse proxy to services
├── API Gateway (systemd service)
├── Data Broker (systemd service)
├── OPC Service (systemd service)
├── Event Service (systemd service, optional)
├── Parser Service (systemd service)
├── Archive Service (systemd service)
├── Import Service (systemd service)
├── Alert Service (systemd service)
├── Email Service (systemd service)
├── Auth Service (systemd service)
├── Recognition Service (systemd service)
└── PostgreSQL + TimescaleDB
    ├── Dedicated server (recommended)
    └── Or same server (smaller deployments)
```

### Deployment Profiles

Three deployment profiles address different availability requirements. See [22_DEPLOYMENT_GUIDE](../design-docs/22_DEPLOYMENT_GUIDE.md) for full configuration details.

**Standalone:** Single server/VM runs all 11 services, nginx, and PostgreSQL. Watchdog timers auto-restart failed services. External health monitoring recommended. Suitable for single-site deployments with acceptable maintenance windows.

**Resilient:** Primary + standby VM. Primary runs the full stack. Standby runs a replicated PostgreSQL database and a survivable alerting core (Alert Service, Email Service, minimal monitoring UI). If the primary dies, the standby keeps alerting alive — operators still receive critical notifications while the primary is being restored. PostgreSQL streaming replication with automatic failover via SQLx multi-host connection strings.

**Enterprise HA:** Load balancer in front of multiple frontend/service instances. Replicated database backend. Full redundancy across all services. Rolling upgrades with zero downtime. Sticky sessions for WebSocket connections or subscription coordination across Broker instances.

## Failure Handling

### Graceful Shutdown

All 11 Rust/Axum services implement a standard shutdown sequence via `tokio::signal`:

1. **SIGTERM received** (from systemd `ExecStop` or `systemctl stop`)
2. **Stop accepting new connections** — Axum `graceful_shutdown` signal fires, listener closes
3. **Drain in-flight requests** — wait up to 30 seconds (configurable via `IO_SHUTDOWN_TIMEOUT_SECS`) for active HTTP requests and WebSocket frames to complete
4. **Flush service-specific work:**

| Service | Shutdown Flush Behavior |
|---------|------------------------|
| OPC Service | Flush ring buffer to DB (or disk spill if DB unavailable) |
| Data Broker | Send WebSocket `close` frames to all clients, flush pending NOTIFY |
| Alert Service | Complete in-progress escalation evaluations, persist pending deliveries |
| Email Service | Complete in-progress SMTP sends (do not dequeue new items) |
| Import Service | Mark running imports as `interrupted` (resumable on next start) |
| All services | Flush pending metrics and traces via `io-observability` shutdown guard (see doc 36) |

5. **Close database connections** — SQLx pool `close()` waits for checked-out connections to return
6. **Exit 0**

**systemd configuration:**
```ini
[Service]
TimeoutStopSec=45       # 15s grace beyond the 30s application drain
KillMode=mixed           # Main process gets SIGTERM; children get SIGKILL after timeout
```

The `io-observability` crate's `shutdown_guard` (doc 36) handles trace and metric flushing. Services register additional shutdown callbacks via a `ShutdownHooks` struct in `io-observability` that runs registered closures in order before the guard drops.

### Service Failures
- **API Gateway down:** nginx returns 503, clients retry
- **Broker down:** Clients reconnect with exponential backoff
- **OPC Service down:** Restart via systemd, no data loss (subscriptions re-established)
- **Alert Service down:** Alerts queued in PostgreSQL by triggering services, recovered and delivered on restart. Escalation timers resume from persisted state.
- **Email Service down:** Email queue persists in PostgreSQL, retried on recovery. No email loss.
- **Auth Service down:** Existing JWTs continue to validate (all services validate independently via `io-auth`). New logins, token refresh, and SSO callbacks fail until Auth Service recovers. Active sessions unaffected.
- **Recognition Service down:** Symbol recognition requests return 503. No impact on real-time data, alerting, or other operations.
- **Database down:** Database resilience stack activates (see below)

### Network Failures
- **OPC connection lost:** Automatic reconnection with backoff
- **Database connection lost:** SQLx pool handles reconnection
- **Client WebSocket disconnect:** Broker cleans up subscriptions, client auto-reconnects

### Data Consistency
- **Duplicate writes:** UPSERT for points_current; UNIQUE (point_id, timestamp) + ON CONFLICT DO NOTHING for points_history_raw
- **Missed updates:** Client can request current value via API on reconnect; Data Broker shadow cache provides immediate value on new subscription
- **Concurrent updates:** Optimistic locking with version numbers (where needed)
- **Point lifecycle:** Points are never deleted (database trigger enforced). Deactivated points retain all historical data and FK references.
- **Metadata versioning:** Source metadata changes are captured as new versions in points_metadata_versions. Current effective metadata is trigger-synced to points_metadata for zero-JOIN reads.

### Database Resilience Stack

When PostgreSQL becomes unavailable, the OPC Service activates a multi-tier buffering strategy to prevent data loss:

1. **In-memory ring buffer:** OPC Service maintains a configurable ring buffer (default: 60 seconds of data at current ingestion rate). New point updates are written to the buffer while DB write attempts fail. Oldest data is evicted if the buffer fills before disk spill activates.

2. **Disk spill:** If the in-memory buffer reaches capacity, OPC Service spills buffered data to a WAL-style append-only file on local disk. This extends survivability from seconds to hours, limited only by available disk space.

3. **Replay on recovery:** When the database connection is re-established, the OPC Service replays all buffered data (memory + disk) in chronological order. Replay uses the same UPSERT/INSERT logic as normal operation, so duplicate handling is automatic.

4. **Optional streaming replication:** For deployments requiring higher database availability, PostgreSQL streaming replication to a standby server provides automatic failover. The SQLx connection string supports multiple hosts (`host=primary,standby`) for transparent failover. See [22_DEPLOYMENT_GUIDE](../design-docs/22_DEPLOYMENT_GUIDE.md) for deployment profiles.

**Other services during DB outage:** Non-OPC services (API Gateway, Auth Service, etc.) return 503 with a `Retry-After` header. Alert Service and Email Service have their own PostgreSQL-backed queues that survive restart but not extended DB outages — the Resilient deployment profile addresses this with a standby database.

### Stale Data Detection

The system distinguishes between stale data (can't read new data from source) and unchanged data (value is the same because the process is stable). Staleness is about data freshness, not value change.

**Point-level staleness:**
- Data Broker tracks `last_update_timestamp` per point in the shadow cache
- If no update is received for a point beyond a configurable threshold (default: 60 seconds), the Broker marks the point as stale
- Broker pushes a `point_stale` status message to all WebSocket clients subscribed to that point
- When a new update arrives, the stale flag auto-clears and a normal update is sent

**Source-level offline:**
- If an OPC source connection drops, OPC Service publishes a `source_offline` event (via the same IPC/NOTIFY path used for data)
- Data Broker instantly flags ALL points from that source as stale — does not wait for per-point timeout
- When the source reconnects, OPC Service publishes `source_online` and the Broker clears stale flags for all points from that source

**Frontend treatment:**
- Stale points render with a muted/dimmed value and a warning indicator (icon or badge)
- Hover tooltip shows "Last updated: [timestamp]" with relative time (e.g., "3 minutes ago")
- When data resumes, the stale indicator auto-clears with no user action required

---

**Next Steps:** Review security model and RBAC design for detailed permission structure.

---

## Service Interaction Matrix

This section maps every service-to-service communication path in the system. Use it to understand who talks to whom, by what mechanism, and what data flows across each link.

### Communication Methods

I/O services communicate through three IPC mechanisms, selected based on throughput requirements and coupling preferences:

| Method | Description | Use Case |
|--------|-------------|----------|
| **HTTP (IO_SERVICE_SECRET)** | Synchronous request/response. API Gateway proxies client requests to backend services. Services authenticate to each other using a shared `IO_SERVICE_SECRET` Bearer token. | Request/response workflows, proxied client requests, inter-service commands |
| **PostgreSQL NOTIFY/LISTEN** | Async pub/sub for event propagation. Services emit notifications after data changes; other services listen on named channels and react. 8KB payload limit per message. | Event-driven reactions to data changes, decoupled fanout, fire-and-forget messaging |
| **Unix Domain Sockets (UDS)** | Binary-framed high-throughput IPC. Primary path for the OPC Service → Data Broker real-time data flow. Falls back to NOTIFY/LISTEN if UDS is unavailable (e.g., services on different hosts). | High-frequency point value streaming (50,000+ points/sec) |

### Interaction Tables

A single 11×11 matrix is too wide for readable markdown. The interactions are split into focused tables grouped by data flow domain.

#### Real-Time Data Path

How live process data moves from OPC UA servers to browser clients.

| From → To | Method | What Flows |
|-----------|--------|------------|
| OPC Service → Data Broker | UDS (primary), NOTIFY `point_updates` (fallback) | Batched point values: ID + value + quality + timestamp |
| OPC Service → PostgreSQL | SQL | UPSERT `points_current`, INSERT `points_history_raw`, call `upsert_point_from_source()` |
| OPC Service → (emits) | NOTIFY `point_updates` | Point ID + value + quality + timestamp (fallback consumers) |
| OPC Service → (emits) | NOTIFY `point_metadata_changed` | Point ID + change type (new, updated, stale) |
| Data Broker → PostgreSQL | SQL (startup only) | Reads all `points_current` rows to warm shadow value cache |
| Data Broker → Frontend | WS | Fan-out of subscribed point updates to WebSocket clients |
| Data Broker ← (listens) | LISTEN `point_updates` | Fallback ingestion when UDS unavailable |
| Data Broker ← (listens) | LISTEN `events` | Event notifications for WebSocket broadcast |
| Data Broker ← (listens) | LISTEN `alerts` | Alert notifications for emergency overlay broadcast |
| Data Broker ← (listens) | LISTEN `export_progress` | Export job progress for WebSocket broadcast |
| Data Broker ← (listens) | LISTEN `presence_updates` | User presence state changes for WebSocket broadcast |

#### API Gateway Routing

How the API Gateway proxies client requests to specialized backend services and manages its own CRUD responsibilities.

| From → To | Method | What Flows |
|-----------|--------|------------|
| API Gateway → Auth Service | HTTP | Auth flow delegation: login, SSO callbacks, MFA verification, token refresh, WS ticket validation |
| API Gateway → Recognition Service | HTTP | Proxied `/api/recognition/*` requests (upload, status, corrections) |
| API Gateway → Import Service | HTTP | Proxied `/api/imports/*` requests (create run, status, cancel) |
| API Gateway → Alert Service | HTTP | Alert dispatch: trigger alerts, manage templates, query alert history |
| API Gateway → Email Service | HTTP | Transactional email: password resets, export notifications, report delivery |
| API Gateway → PostgreSQL | SQL | CRUD for all module data: workspaces, dashboards, logs, rounds, settings, design objects, expressions, exports |
| API Gateway ← (listens) | LISTEN `import_status` | Import run progress updates (relayed to requesting client) |
| API Gateway ← (listens) | LISTEN `export_progress` | Export job progress updates (relayed to requesting client) |
| API Gateway ← (listens) | LISTEN `point_metadata_changed` | Point metadata changes (cache invalidation, UI refresh triggers) |
| API Gateway → (emits) | NOTIFY `export_progress` | Export job status changes (picked up by Data Broker for WS broadcast) |
| API Gateway → (emits) | NOTIFY `presence_updates` | Badge reader polling results (user presence state changes) |

#### Alert & Email Pipeline

How alerts are triggered, routed, escalated, and delivered across channels.

| From → To | Method | What Flows |
|-----------|--------|------------|
| Event Service → Alert Service | NOTIFY `alert_trigger` | Threshold breaches, OPC alarm state changes |
| API Gateway → Alert Service | HTTP | Manual alert triggers, overdue round alerts, scheduled alerts |
| Alert Service → Email Service | HTTP | Email channel delivery requests (template ID + recipients + variables) |
| Alert Service → External (Twilio) | HTTP | SMS and voice call delivery |
| Alert Service → External (Radio) | HTTP | SmartPTT/TRBOnet radio dispatch |
| Alert Service → External (PA) | HTTP/SIP/Relay | PA system announcements and sirens |
| Alert Service → (emits) | NOTIFY `alerts` | Alert ID + severity + template (Data Broker broadcasts via WS) |
| Alert Service → PostgreSQL | SQL | INSERT/UPDATE `alerts`, `alert_deliveries`, `alert_escalations`, `alert_acknowledgments` |
| Email Service → External (SMTP/API) | SMTP, HTTP | Rendered email delivery via configured provider (SMTP relay, MS Graph, Gmail, SES, webhook) |
| Email Service → PostgreSQL | SQL | `email_queue` processing, `email_delivery_log` tracking, bounce handling |
| Email Service ← (listens) | LISTEN `email_send` | Fire-and-forget email requests from any service |

#### Auth Pipeline

How authentication flows are handled between the API Gateway, Auth Service, and external identity providers.

| From → To | Method | What Flows |
|-----------|--------|------------|
| API Gateway → Auth Service | HTTP | Login (local/LDAP), OIDC/SAML callback processing, MFA challenge/verify, token refresh, WS ticket issue/validate |
| Auth Service → External (OIDC IdP) | HTTP | Authorization code + PKCE flow, token exchange, userinfo |
| Auth Service → External (SAML IdP) | HTTP | SP-initiated AuthnRequest, assertion consumption |
| Auth Service → External (LDAP/AD) | LDAP | Bind authentication, group membership queries |
| Auth Service → PostgreSQL | SQL | `user_sessions`, `user_mfa`, `auth_flow_state`, SCIM provisioning writes |
| Data Broker → Auth Service | HTTP | WebSocket ticket validation (one call per WS connection establishment) |

#### Event, Import & Support Services

Remaining service interactions that don't fit the above categories.

| From → To | Method | What Flows |
|-----------|--------|------------|
| Event Service → PostgreSQL | SQL | INSERT `events`, `alarm_states` |
| Event Service → (emits) | NOTIFY `events` | Event ID + type + severity (Data Broker broadcasts via WS) |
| Event Service → (emits) | NOTIFY `alert_trigger` | Threshold breach or alarm state change requiring alert dispatch |
| Parser Service → PostgreSQL | SQL | INSERT `design_objects` (parsed SVG/file structure) |
| Parser Service ← API Gateway | HTTP | Receives uploaded file data, returns parsed result (stateless) |
| Archive Service → PostgreSQL | SQL | TimescaleDB compression, retention policy execution, continuous aggregate refresh |
| Import Service → PostgreSQL | SQL | Writes to target tables, `import_runs`, `import_errors` |
| Import Service → External | Various | Database connectors, REST APIs, file readers (60+ connector types) |
| Import Service → (emits) | NOTIFY `import_status` | Run ID + status + progress percentage |
| Import Service → (emits) | NOTIFY `point_metadata_changed` | Point ID + change type (when imports create/update points) |
| Recognition Service → PostgreSQL | SQL | `recognition_correction` reads/writes |
| Recognition Service → Filesystem | Read | `.iomodel` package loading (ONNX models + class maps) |

### NOTIFY Channel Registry

All PostgreSQL NOTIFY channels used for inter-service communication.

| Channel | Publisher(s) | Subscriber(s) | Payload Summary |
|---------|-------------|---------------|-----------------|
| `point_updates` | OPC Service | Data Broker | Batched point values: `{ "points": [{ "id", "value", "quality", "ts" }] }` |
| `point_metadata_changed` | OPC Service, Import Service | API Gateway | Point ID + change type (`new`, `updated`, `removed`) |
| `events` | Event Service | Data Broker | Event ID + type + severity |
| `alerts` | Alert Service | Data Broker | Alert ID + severity + template name |
| `alert_trigger` | Event Service | Alert Service | Source event ID + trigger type + severity + context |
| `import_status` | Import Service | API Gateway | Run ID + status (`running`, `completed`, `failed`) + progress % |
| `export_progress` | API Gateway | Data Broker | Job ID + status + progress % |
| `presence_updates` | API Gateway (badge poller) | Data Broker | User ID + presence state (`on_site`, `off_site`) |
| `email_send` | Any service | Email Service | Template ID + recipients + variables (fire-and-forget email) |

### Service Communication Summary

Quick-reference showing each service's communication profile:

| Service (Port) | Outbound HTTP | Outbound NOTIFY | Inbound HTTP | Listens (NOTIFY) | Direct SQL | Other |
|----------------|---------------|-----------------|--------------|-------------------|------------|-------|
| API Gateway (3000) | Auth, Recognition, Import, Alert, Email | `export_progress`, `presence_updates` | — (receives from nginx) | `import_status`, `export_progress`, `point_metadata_changed` | Yes | — |
| Data Broker (3001) | Auth (ticket validation) | — | — (receives from nginx for WS) | `point_updates`, `events`, `alerts`, `export_progress`, `presence_updates` | Yes (startup cache warm) | UDS listener, WS server |
| OPC Service (3002) | — | `point_updates`, `point_metadata_changed` | — | — | Yes | UDS sender |
| Event Service (3003) | — | `events`, `alert_trigger` | — | — | Yes | — |
| Parser Service (3004) | — | — | Yes (from API GW) | — | Yes | Stateless |
| Archive Service (3005) | — | — | — | — | Yes | Scheduled (cron-like) |
| Import Service (3006) | External systems | `import_status`, `point_metadata_changed` | Yes (from API GW) | — | Yes | — |
| Alert Service (3007) | Email Service, Twilio, radio, PA | `alerts` | Yes (from API GW, Event Svc via NOTIFY) | `alert_trigger` | Yes | — |
| Email Service (3008) | External SMTP/APIs | — | Yes (from API GW, Alert Svc) | `email_send` | Yes | — |
| Auth Service (3009) | External IdPs (OIDC, SAML, LDAP) | — | Yes (from API GW, Data Broker) | — | Yes | — |
| Recognition Service (3010) | — | — | Yes (from API GW) | — | Yes | Filesystem (`.iomodel`) |

---

## End-to-End Data Flows

This section traces four critical data paths through the system end-to-end, from external source to user-facing result. Each diagram shows the component chain, and the notes below it call out the behavioral details that matter for implementation.

### 1. OPC Alarm Data Flow

How an OPC UA alarm event flows from the DCS through to the operator's screen.

```
┌─────────┐    ┌──────────┐    ┌────────────────────────────────────────────┐
│ DCS/PLC │───►│ OPC UA   │───►│ OPC Service (port 3001)                    │
│         │    │ Server   │    │  - Subscription callback receives alarm    │
└─────────┘    └──────────┘    │  - Normalizes to internal event struct     │
                               │  - Forwards raw event (no state tracking)  │
                               └──────────────────┬─────────────────────────┘
                                                  │ Unix domain socket IPC
                                                  │ (NOTIFY fallback)
                                                  ▼
                               ┌────────────────────────────────────────────┐
                               │ Event Service (port 3002)                  │
                               │  - INSERT into events hypertable           │
                               │  - State machine transition in             │
                               │    alarm_states table                      │
                               │    (active → ack → rtn → cleared)         │
                               └──────────────────┬─────────────────────────┘
                                                  │ PostgreSQL NOTIFY
                                                  │ on 'events' channel
                                                  ▼
                               ┌────────────────────────────────────────────┐
                               │ Data Broker (port 3005)                    │
                               │  - Picks up NOTIFY payload                 │
                               │  - Fans out to subscribed WebSocket        │
                               │    clients based on subscription registry  │
                               └──────────────────┬─────────────────────────┘
                                                  │ WebSocket push
                                                  ▼
                               ┌────────────────────────────────────────────┐
                               │ Frontend                                   │
                               │  - Console/Process: alarm banner update    │
                               │  - Event timeline: new row appended        │
                               │  - Audio alert (if configured)             │
                               └────────────────────────────────────────────┘
```

**Key behavioral notes:**

- OPC alarms are **read-only mirrors** — I/O displays alarm state but does not write back to the DCS
- Operators acknowledge OPC-sourced alarms on the DCS console, not in I/O; I/O sees the ack as a subsequent state-change event from OPC UA
- Alarm state (`active`, `ack`, `rtn`, `cleared`) is tracked in the `alarm_states` table by Event Service
- OPC Service is a pass-through for alarm events — it normalizes and forwards but does not track state
- Event Service owns the insert and the state machine; this keeps alarm logic centralized

### 2. I/O Alarm Evaluation Flow

How I/O-generated alarms (threshold and expression-based) are evaluated and fired.

```
┌─────────────────────────────────────────────────────────────────────────┐
│ OPC Service writes point value                                          │
│  - UPSERT points_current (latest value)                                 │
│  - INSERT points_history_raw (time-series record)                       │
└─────────────────────────────┬───────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ API Gateway — Alarm Evaluation Engine                                    │
│  - Periodic scan (default: every 10s, configurable)                     │
│  - Reads points_current for monitored points                            │
│                                                                         │
│  ┌─────────────────────────────┐  ┌──────────────────────────────────┐  │
│  │ Threshold Alarms            │  │ Expression Alarms                │  │
│  │  - alarm_definitions with   │  │  - alarm_definitions with       │  │
│  │    threshold_config          │  │    expression_id → Rhai eval    │  │
│  │  - Compare HH / H / L / LL │  │  - Multi-point logic            │  │
│  │  - Deadband check           │  │    (2-of-3 voting, rate of      │  │
│  │    (prevents chattering)    │  │    change, complex conditions)  │  │
│  └──────────────┬──────────────┘  └───────────────┬──────────────────┘  │
│                 │                                  │                     │
│                 └──────────┬───────────────────────┘                     │
│                            │ Alarm condition met?                        │
│                            ▼                                             │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │ YES: INSERT event + alarm_state transition (UNACK_ACTIVE)      │    │
│  │ CLEAR: INSERT RTN event + alarm_state transition (RTN_UNACK)   │    │
│  │ NO CHANGE: skip (no event generated)                           │    │
│  └─────────────────────────────────────────────────────────────────┘    │
└─────────────────────────────┬───────────────────────────────────────────┘
                              │ PostgreSQL NOTIFY on 'events' channel
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Data Broker → WebSocket → Frontend                                       │
│  - Same fanout path as OPC alarms (Section 1 above)                     │
│  - Console/Process alarm banner, event timeline, audio                  │
└─────────────────────────────────────────────────────────────────────────┘
```

**Key behavioral notes:**

- I/O alarms support the **full ISA-18.2 state model**: acknowledge, shelve, suppress, out-of-service
- Unlike OPC alarms, users **can** acknowledge, shelve, and suppress I/O-generated alarms directly in the UI
- **Threshold wizard** covers ~80% of use cases: HH/H/L/LL limits on a single point with configurable deadband
- **Expression builder** covers the remaining complex cases: multi-point logic via Rhai engine (see doc 23)
- Deadband prevents chattering — alarm does not clear until value moves past threshold by the deadband amount
- Evaluation is periodic (not event-driven) to bound CPU cost; 10s default is configurable per alarm definition

### 3. Human Alert Flow (Alerts Module)

How a human-initiated emergency alert flows from the UI through delivery channels to recipients.

```
┌─────────────────────────────────────────────────────────────────────────┐
│ Safety Manager / Authorized User                                         │
│  - Opens Alerts module                                                  │
│  - Selects alert template + fills variables (location, nature, etc.)    │
│  - Selects recipient targeting: on-shift / on-site / role / custom list │
│  - Sends                                                                │
└─────────────────────────────┬───────────────────────────────────────────┘
                              │ POST /api/notifications/send
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ API Gateway (port 3000)                                                  │
│  - Validates permissions (alert:send)                                   │
│  - Resolves recipient groups at SEND TIME:                              │
│      on-shift → current shift roster lookup                             │
│      on-site  → badge-in presence data                                  │
│      role     → users with matching roles                               │
│      custom   → explicit user list                                      │
│  - POST to Alert Service with resolved recipient list                   │
└─────────────────────────────┬───────────────────────────────────────────┘
                              │ HTTP (IO_SERVICE_SECRET)
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Alert Service (port 3007)                                                │
│  - Persists alert record + per-recipient delivery records               │
│  - Fans out to delivery channels in parallel:                           │
│                                                                         │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐  │
│  │  WebSocket   │ │  Browser     │ │  SMS         │ │  Voice Call  │  │
│  │  Broadcast   │ │  Push (VAPID)│ │  (Twilio)    │ │  (Twilio)    │  │
│  └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘  │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐                    │
│  │  Email       │ │  Radio       │ │  PA System   │                    │
│  │  (via Email  │ │  Dispatch    │ │  (SIP/REST)  │                    │
│  │   Service)   │ │  (HTTP)      │ │              │                    │
│  └──────────────┘ └──────────────┘ └──────────────┘                    │
│                                                                         │
│  - Tracks delivery status per recipient per channel                     │
│  - Escalation engine: no ack within configured time → next level        │
│  - Muster integration: if emergency type, triggers badge accounting     │
│    at designated muster points                                          │
└─────────────────────────────────────────────────────────────────────────┘
                              │ WebSocket broadcast
                              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ Frontend — All Connected Clients                                         │
│  - Emergency Alert Overlay: shell-level banner at top of viewport       │
│  - Non-blocking: pushes content down, does not cover controls           │
│  - Persists until dismissed or alert is resolved                        │
│  - Audio tone on arrival                                                │
└─────────────────────────────────────────────────────────────────────────┘
```

**Key behavioral notes:**

- Human alerts are **completely separate** from process alarms (Sections 1-2); different tables, different services, different UI
- Recipient resolution happens at **send time**, not at template creation time — the on-shift roster may have changed since the template was configured
- Emergency Alert Overlay is rendered at the **shell level** (doc 06), not within any module, so it is visible regardless of which module the operator is in
- Alert Service handles delivery tracking and escalation **independently** of the API Gateway — once dispatched, the Alert Service owns the lifecycle
- Escalation is time-based: if a recipient has not acknowledged within the configured window, the alert escalates to the next tier of recipients
- Muster integration triggers badge accounting at physical muster points for personnel accountability during emergencies

### 4. Real-Time Point Data Flow

How a point value update flows from the DCS to the operator's SVG graphic element.

```
┌─────────┐    ┌──────────┐    ┌────────────────────────────────────────────┐
│ DCS/PLC │───►│ OPC UA   │───►│ OPC Service (port 3001)                    │
│         │    │ Server   │    │  - Subscription callback receives value    │
│         │    │          │    │  - Batches updates (configurable interval) │
└─────────┘    └──────────┘    └──────────────────┬─────────────────────────┘
                                                  │
                               ┌──────────────────┼──────────────────────┐
                               │                  │                      │
                               ▼                  ▼                      │
               ┌──────────────────────┐  ┌──────────────────────┐       │
               │ PostgreSQL           │  │ Unix Domain Socket   │       │
               │  - UPSERT            │  │  (primary IPC path)  │       │
               │    points_current    │  │                      │       │
               │  - INSERT            │  │  NOTIFY fallback if  │       │
               │    points_history_raw│  │  UDS unavailable     │       │
               └──────────────────────┘  └──────────┬───────────┘       │
                                                    │                   │
                                                    ▼                   │
                               ┌────────────────────────────────────────┘
                               │
                               ▼
               ┌────────────────────────────────────────────────────────┐
               │ Data Broker (port 3005)                                │
               │  - Updates shadow cache (latest value per point)       │
               │  - Checks subscription registry                       │
               │  - Fans out to subscribed WebSocket clients only       │
               │  - New subscriptions get initial value from cache      │
               └──────────────────────┬─────────────────────────────────┘
                                      │ WebSocket push
                                      ▼
               ┌────────────────────────────────────────────────────────┐
               │ Frontend (Console / Process Module)                    │
               │  - Receives point update message                      │
               │  - Value mapping: raw value → display representation  │
               │    (color, text, rotation, visibility, fill, etc.)    │
               │  - Updates bound SVG element in place                 │
               │  - Stale detection: if no update within threshold,    │
               │    dims value and shows warning indicator              │
               └────────────────────────────────────────────────────────┘
```

**Key behavioral notes:**

- Target end-to-end latency: **< 2 seconds** from DCS value change to SVG element update on screen
- Data Broker maintains a **shadow cache** so that newly opened graphics get current values immediately without waiting for the next OPC subscription tick
- **Points-in-use registry** prevents the Data Broker from subscribing to points that no open graphic needs — OPC Service only maintains subscriptions for points that at least one client is viewing
- OPC Service writes to PostgreSQL (for persistence/history) and sends to Data Broker via IPC **in parallel** — the real-time display path does not wait for the database write
- **Adaptive resolution** for historical queries: raw data for short windows, pre-aggregated data (1min → 5min → 15min → 1hr) for longer windows, selected automatically based on the requested time range
- Stale detection is **dual-layer**: per-point timeout (default 60s, configurable) and source-level offline detection (instant, via OPC Service source status events)

---

## Change Log

- **v2.4**: Reconciled shared crate table to canonical 11-crate list matching doc 01 v2.1. Renamed `io-auth-middleware` → `io-auth` throughout (prose + table). Merged `io-telemetry` into `io-observability`. Removed `io-config`, `io-crypto`, `io-audit` as separate crates (consolidated into `io-auth`, `io-db`). Added `io-bus`, `io-models`, `io-opc`, `io-time`, `io-validate`, `io-export`. Reclassified `io-sms` as utility crate.
- **v2.3**: Updated roles table schema overview description from old 3-role model to 8 predefined roles with clone-based customization per doc 03.
- **v2.2**: Fixed stale WebSocket URL from `?token=<jwt>` to `?ticket=<ticket>` (ticket-based auth per doc 16). Updated role/permission counts from 3 roles/102 perms to 8 roles/118 perms across 15 modules per doc 03.
- **v2.1**: Updated `point_sources` table description — Modbus TCP and MQTT planned for Phase 3 (was "future").
- **v2.0**: Added Graceful Shutdown section (SIGTERM → drain → flush → exit sequence, per-service flush behavior, systemd `TimeoutStopSec=45`, `ShutdownHooks` in `io-observability`). Added Database Connection Pool Sizing section (per-service defaults totaling 84 connections, pool settings, deployment profile adjustments).
- **v1.9**: Added `/api/v1/` URL prefix to API Gateway routing (see doc 21 versioning spec). Added `io-health` and `io-observability` shared crates (11 total, was 9). See doc 36 (Observability).
- **v1.8**: Updated Parser Service (Port 3004) with DCS Graphics Import responsibilities, vendor-specific format list, and cross-references to docs 34 (DCS Graphics Import) and 35 (Shape Library). Clarified distinction between file-based import (Parser Service) and screenshot-based recognition (Recognition Service).
- **v1.7**: Added Service Interaction Matrix section before End-to-End Data Flows. Includes communication methods summary (HTTP/NOTIFY/UDS), five focused interaction tables (Real-Time Data Path, API Gateway Routing, Alert & Email Pipeline, Auth Pipeline, Event/Import/Support Services), NOTIFY Channel Registry (9 channels), and per-service communication summary table. All 11 services covered.
- **v1.6**: Updated recognition references to match SymBA's actual implementation. Recognition Service now loads single-model detection for both P&ID and DCS (was "DCS multi-model"). DCS import flow simplified to single detection model with heuristic post-processing. model_domain determines class map and template set, not pipeline type. Added note that DCS recognition is a fallback when native DCS files are unavailable.
- **v1.5**: Added End-to-End Data Flows section with four diagrammed critical paths: OPC Alarm Data Flow (read-only DCS alarm mirroring), I/O Alarm Evaluation Flow (threshold + expression-based with ISA-18.2 state model), Human Alert Flow (emergency alert dispatch through 7 channels with escalation), and Real-Time Point Data Flow (OPC → Data Broker → SVG update within 2s target).
- **v1.4**: Updated frontend module count from 9 to 11 (added Shifts and Alerts modules). Added API Gateway endpoint routes for shifts, presence, muster, badge sources, alert groups, and notifications. Updated permission count from 87 to 102 across 14 modules. Shifts and Alerts modules run through API Gateway — no new backend services. See docs 30 and 31.
- **v1.3**: Updated schema overview: replaced `shared_with` array on workspaces with `workspace_shares` join table reference. Added `dashboard_shares` join table reference to dashboards.
- **v1.2**: Added Delete Semantics policy (soft delete with `deleted_at` for business entities, hard delete for transient/operational data, audit logging requirements). Added Logging Architecture section clarifying `system_logs` table (operator-facing operational events) vs structured file logging via `tracing` crate (developer-facing diagnostics).
- **v1.1**: Major architectural update. Service count 9→11: Auth Service (port 3009) and Recognition Service (port 3010) split from API Gateway. API Gateway narrowed to routing, CRUD, and JWT validation. Added Shared Crate First principle with 9 `io-*` workspace crates. Unix domain socket IPC as primary OPC→Broker real-time path (PostgreSQL NOTIFY as fallback). Database resilience stack (in-memory ring buffer → disk spill → replay on recovery → optional streaming replication). Stale data detection system (point-level staleness + source-level offline + frontend treatment). Inter-service authentication via shared `IO_SERVICE_SECRET`. Service workload profile table. Three deployment profiles (Standalone, Resilient, Enterprise HA). Updated authentication flow, DCS import flow, failure handling, and production deployment listing.
- **v1.0**: Corrected permission count (87 across 12 modules). Fixed alert table names to match doc 04 (`alert_definitions`→`alert_templates`, `alert_instances`→`alerts`, `escalation_policies`→`alert_escalations`). Fixed doc 27 link (`27_ALERT_SERVICE`→`27_ALERT_SYSTEM`). Updated users table schema overview with auth provider columns, full_name, service account, MFA fields. Fixed audit_log `timestamp`→`created_at`. Added missing `created_by` and `updated_at` to design_objects schema overview.
- **v0.9**: Added Alert Service (Port 3007) and Email Service (Port 3008) as services 8 and 9. Updated service count from 7 to 9. Updated architecture diagram with both services and external delivery targets. Added `/api/alerts/*` and `/api/email/*` endpoint routing. Added Alert Trigger Flow and Email Delivery Flow to Data Flows. Added Alert and Email service failure handling. Added Alerting (Domain 11) and Email (Domain 12) tables to schema overview. Updated permission count from 74 to 84. Added both services to production deployment listing. Updated QoS tiers: Alert Service at tier 1 (safety-critical), Email Service at tier 3 (best-effort). See docs 27 and 28.
- **v0.8**: Updated recognition descriptions to cover both P&ID and DCS domains. Added DCS Graphics Import Flow showing multi-model inference pipeline. Updated permission count from 73 to 74. See SymBA 17_IO_INTEGRATION.md.
- **v0.7**: Fixed "retoken" prose references to "refresh token". Fixed user_sessions schema: `device` to `device_info`, added `last_accessed_at`. Fixed log_attachments schema: `file_name` to `filename`, `created_at` to `uploaded_at`. All changes align with 04_DATABASE_DESIGN.md canonical schema.
- **v0.6**: Added P&ID recognition handlers, `/api/recognition/*` endpoints, and `recognition_correction` table reference. See `26_PID_RECOGNITION.md`.
- **v0.5**: Added export, bulk-update, and snapshot endpoint namespaces to API Gateway. Updated permission count from 63 to 73. See 25_EXPORT_SYSTEM.md.
- **v0.4**: Added Import Service as 7th Rust/Axum service (Port 3006). Updated architecture diagram to show all 7 services with QoS tiers and external data sources. Added import tables to schema overview (import_connections, import_definitions, import_schedules, import_runs, import_errors, custom_import_data). Added Import Service to production deployment listing. Updated permission count from 59 to 63. See 24_UNIVERSAL_IMPORT.md.
- **v0.3**: Updated permission count from 55 to 59. Added server-side expression evaluation to API Gateway responsibilities. Added missing tables to schema overview: user_sessions, report_templates, custom_expressions, log_attachments, system_logs.
- **v0.2**: Added `point_sources` table (multi-source support). Refactored `points_metadata` with source_id FK, denormalized current metadata (trigger-synced from versions), application config columns (active, criticality, area, GPS, barcode, notes, app_metadata), lifecycle timestamps (first_seen_at, last_seen_at, deactivated_at, reactivated_at), write_frequency_seconds. Added `points_metadata_versions` for versioned source metadata. Added fillfactor=80 on points_current for HOT updates. Added UNIQUE deduplication constraint on points_history_raw. Updated OPC Service for multi-source management, idempotent point discovery, batched NOTIFY. Updated Data Broker as raw-value-only fanout with shadow cache (no UOM knowledge). Added caching architecture (Broker, API Gateway, Frontend). UOM conversion: client-side for real-time, server-side for historical.
- **v0.1**: Updated Archive Service to include 15-minute continuous aggregate, quality filtering (`Good` only), rolling averages, `sum` column, and aggregation type enforcement. Updated historical data query resolution selection to include 15-minute tier. Updated `points_metadata` to include `aggregation_types` bitmask. Updated aggregate retention to per-tier policy.
