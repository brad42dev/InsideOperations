# Honeywell Pro-Watch — Access Control Connector Profile

## Application Overview

- **Vendor**: Honeywell Building Technologies
- **Product**: Pro-Watch (4.x+ for REST API and SignalR support)
- **Market Position**: Strong in Honeywell-ecosystem facilities. Medium-high prevalence in refineries where Honeywell already provides DCS (Experion), fire systems, and building management. Natural fit for sites that want one vendor for process control and physical security.
- **Licensing**: REST API and SignalR event streaming are **included** with Pro-Watch 4.x+ (no separate license).
- **Typical Deployment**: On-premise MSSQL database, Pro-Watch server (Windows), PW-series controllers and readers. Often co-located with Honeywell Experion DCS infrastructure.

## Integration Architecture

Honeywell Pro-Watch integrates with I/O via the **BadgeAdapter trait** defined in Doc 30 (Access Control, Shifts & Presence). This is NOT a Universal Import pipeline connector. The adapter runs within the API Gateway service and feeds events directly into the `badge_events` table.

**Three integration paths** (ordered by preference):

| Path | Requirements | Latency | Recommended For |
|------|-------------|---------|-----------------|
| REST API + SignalR | Pro-Watch 4.x+, ports 8734 + 8735 open | **Real-time** (SignalR push) | All Pro-Watch 4.x+ installations |
| REST API (poll only) | Pro-Watch 4.x+, port 8734 open | 10-30s (poll interval) | Sites where port 8735 is blocked |
| Direct Database (MSSQL) | Read-only SQL account | 10-30s (poll interval) | Pre-4.x installations |

**SignalR is the standout feature.** Pro-Watch is the only system in the top 5 that offers true push-based real-time event streaming via SignalR. This eliminates polling latency entirely for badge events.

## API Surface — REST API (Port 8734)

- **Base URL**: `https://{prowatch-server}:8734/api`
- **Authentication**: Token-based. POST to `/api/auth` returns auth token.
- **Data Format**: JSON
- **Pagination**: Offset/limit parameters
- **Rate Limits**: Not formally documented
- **API Docs**: Behind Honeywell partner portal. Reference: [Pro-Watch API Documentation (Scribd)](https://www.scribd.com/document/562763651/Honeywell-Pro-Watch-API-Service-Documentation)

### Key Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/auth` | Obtain auth token |
| GET | `/api/cardholders` | List badge holders |
| GET | `/api/badges` | List badges/credentials |
| GET | `/api/events` | Query historical events (time filter) |
| GET | `/api/readers` | List readers |
| GET | `/api/areas` | List areas/zones |

## API Surface — SignalR Real-Time Events (Port 8735)

- **URL**: `https://{prowatch-server}:8735/signalr`
- **Protocol**: ASP.NET SignalR (JSON over WebSocket, with fallback to Server-Sent Events or long-polling)
- **Authentication**: Same auth token from REST API, carried in the SignalR connection handshake
- **Requires**: `ProWatchWorkstation` setting enabled for event sync

### SignalR Connection Flow

1. Obtain auth token from REST API (`POST :8734/api/auth`)
2. Negotiate SignalR connection (`POST :8735/signalr/negotiate` with auth token)
3. Establish WebSocket connection to the negotiated endpoint
4. Subscribe to the access event hub
5. Receive events as JSON messages pushed by the server
6. On disconnect, reconnect with exponential backoff and replay from last event timestamp

### Rust SignalR Client Considerations

Rust SignalR client libraries are **less mature** than the .NET or JavaScript ecosystems. Implementation options:

1. **Minimal transport handler**: Implement the SignalR negotiate + WebSocket handshake manually using `reqwest` (HTTP) + `tokio-tungstenite` (WebSocket). This avoids depending on a SignalR-specific crate. Pro-Watch uses the simpler SignalR protocol (not the newer ASP.NET Core SignalR), which has a straightforward wire format.
2. **REST polling fallback**: If SignalR proves unreliable in a specific deployment, fall back to REST API polling on port 8734. The adapter should support both modes.
3. **Potential crate**: Check crates.io for `signalrs` or similar at implementation time. Verify MIT/Apache licensing.

## API Surface — Direct Database (MSSQL)

- **Engine**: Microsoft SQL Server
- **Authentication**: SQL Server auth
- **Access**: Read-only account

### Key Tables

| Table | Purpose |
|-------|---------|
| Events table (name varies) | Badge event history |
| Cardholders / BadgeHolder | Cardholder master records |
| Badges | Badge/credential records |
| Readers | Reader definitions |
| Areas | Area/zone definitions |

**Note**: Pro-Watch database schema documentation is limited. The SQL view approach (as with Lenel) is recommended to isolate from schema changes between versions.

## Target Tables

| I/O Table | Role |
|-----------|------|
| `badge_events` | Primary — all access events |
| `access_control_sources` | Configuration — source registration |
| `presence_status` | Derived — materialized from badge_events (not directly written) |

## Event Code Mapping

Pro-Watch uses numeric event type codes similar to Lenel. However, the codes are more standardized across installations than Lenel's. The mapping should still be verified per site during commissioning.

### Standard Event Type Mapping

| Pro-Watch Event Code | Meaning | I/O `event_type` | Notes |
|---------------------|---------|-------------------|-------|
| `AccessGranted` / code 1 | Valid badge, door opened | `swipe_in` or `swipe_out` | Direction from reader config |
| `AccessDenied` / code 2 | Badge rejected | `access_denied` | |
| `InvalidCard` / code 3 | Unrecognized credential | `access_denied` | |
| `ExpiredCard` / code 4 | Expired badge | `access_denied` | |
| `InvalidAccessLevel` / code 5 | Wrong clearance | `access_denied` | |
| `InvalidTimeZone` / code 6 | Outside schedule | `access_denied` | |
| `AntiPassback` / code 10 | Anti-passback violation | `passback_violation` | |
| `DoorForced` / code 20 | Door opened without badge | `door_forced` | |
| `DoorHeld` / code 21 | Door held past timeout | `door_held_open` | |
| `Duress` / code 30 | Duress code entered | `duress` | |
| `Tailgate` / code 40 | Multiple entries detected | `tailgate` | Requires compatible hardware |
| (other) | System/hardware events | (omit or log) | |

**Note**: Pro-Watch may report event codes as numeric values, string labels, or both depending on the API path (REST vs SignalR vs DB). The adapter normalizes all three representations.

### Direction Resolution

1. **Reader naming**: Pro-Watch reader names typically include direction (e.g., "Gate 1 IN Reader", "Bldg 3 OUT Reader"). Parse `ReaderDescription` for direction keywords.
2. **Reader configuration**: Map each reader_id to a direction in `access_control_sources.config`.
3. **Area transitions**: Pro-Watch supports entry/exit areas per reader. If configured, the adapter can derive direction from the area transition (entering area = in, leaving area = out).
4. **Fallback**: `unknown`.

## Field Mapping — Badge Events

| Pro-Watch Field | I/O `badge_events` Column | Transform |
|----------------|--------------------------|-----------|
| `EventID` | `external_event_id` | Cast to string |
| `EventDateTime` | `event_time` | Convert to UTC TIMESTAMPTZ |
| (configured source) | `source_id` | FK to `access_control_sources` |
| `BadgeNumber` | `badge_id` | Cast to string |
| `EmployeeID` | `employee_id` | Cast to string |
| Name fields | `person_name` | Concatenate first + last |
| (mapped via `users.employee_id` or `users.email`) | `user_id` | Nullable FK lookup |
| `EventTypeCode` | `event_type` | Map via `event_code_map` config |
| `ReaderID` | `reader_id` | Cast to string |
| `ReaderDescription` | `reader_name` | Direct |
| `AreaName` | `reader_area` | Via reader-to-area association |

### SignalR Event Payload

SignalR events arrive as JSON messages. The adapter parses these directly:

```json
{
  "EventId": 123456,
  "EventTime": "2025-06-15T14:32:05Z",
  "EventType": 1,
  "EventDescription": "Access Granted",
  "BadgeNumber": "10045",
  "CardholderName": "Smith, John",
  "EmployeeId": "EMP-2341",
  "ReaderId": "RDR-105",
  "ReaderName": "Unit 3 Gate IN",
  "AreaName": "Unit 3 Operating Area"
}
```

## Field Mapping — Cardholder Sync

| Pro-Watch Field | Usage | Notes |
|----------------|-------|-------|
| `EmployeeID` | User correlation key (primary) | Match against `users.employee_id` |
| `Email` | User correlation key (fallback) | If configured in Pro-Watch |
| `FirstName` + `LastName` | Display name | |
| `Department` | Informational | Visible in presence/muster UIs |
| `Company` | Contractor identification | |
| `AccessLevel` | Informational | Authorized clearance name |
| Badge `Status` | Filter | Only sync active badges |
| Photo | Optional | Separate retrieval endpoint |

## Field Mapping — Zone/Reader Sync

| Pro-Watch Field | Usage | Notes |
|----------------|-------|-------|
| `AreaID` | Zone identifier | |
| `AreaName` | Zone display name | |
| `ParentArea` | Zone hierarchy | For drill-down |
| `ReaderID` | Reader identifier | |
| `ReaderDescription` | Reader display name | Often includes direction |
| `PanelID` | Controller grouping | Diagnostic |

## Sync Strategy

| Data Type | Method | Interval | Watermark |
|-----------|--------|----------|-----------|
| Badge events (SignalR) | SignalR push on port 8735 | **Real-time** | Event ID / timestamp |
| Badge events (REST fallback) | REST poll on `:8734/api/events` | 30s | `EventDateTime > @last_checkpoint` |
| Badge events (DB) | SQL poll | 30s | Timestamp watermark |
| Cardholders | REST API full sync | Daily (default) | N/A |
| Zones/Readers | REST API full sync | Weekly or on-demand | N/A |

### Initial Load

1. Register the source in `access_control_sources` with connection config and `event_code_map`
2. Sync areas (zones) via REST API
3. Sync readers via REST API
4. Sync cardholders via REST API
5. Establish SignalR connection for real-time events
6. Optional: backfill last 24-72 hours via REST API `/api/events` for initial presence state

## Adapter Configuration

Stored in `access_control_sources.config` (JSONB):

```json
{
  "adapter_type": "honeywell_prowatch",
  "connection": {
    "base_url": "https://prowatch-server",
    "api_port": 8734,
    "signalr_port": 8735,
    "username": "{{PROWATCH_USERNAME}}",
    "password": "{{PROWATCH_PASSWORD}}"
  },
  "connection_db": {
    "mode": "database",
    "driver": "mssql",
    "host": "{{PROWATCH_DB_HOST}}",
    "port": 1433,
    "database": "{{PROWATCH_DB_NAME}}",
    "username": "{{PROWATCH_DB_USER}}",
    "password": "{{PROWATCH_DB_PASSWORD}}"
  },
  "event_code_map": {
    "1": "swipe_in",
    "2": "access_denied",
    "3": "access_denied",
    "4": "access_denied",
    "5": "access_denied",
    "6": "access_denied",
    "10": "passback_violation",
    "20": "door_forced",
    "21": "door_held_open",
    "30": "duress",
    "40": "tailgate",
    "AccessGranted": "swipe_in",
    "AccessDenied": "access_denied",
    "AntiPassback": "passback_violation",
    "DoorForced": "door_forced",
    "DoorHeld": "door_held_open",
    "Duress": "duress",
    "Tailgate": "tailgate"
  },
  "reader_direction_map": {
    "RDR-105": "in",
    "RDR-106": "out"
  },
  "direction_keywords": {
    "in": ["IN", "ENTRY", "ENTER"],
    "out": ["OUT", "EXIT", "DEPART"]
  },
  "sync": {
    "use_signalr": true,
    "signalr_reconnect_delay_ms": 5000,
    "signalr_max_reconnect_delay_ms": 60000,
    "event_poll_fallback_sec": 30,
    "cardholder_sync_cron": "0 2 * * *",
    "zone_sync_cron": "0 3 * * 0"
  }
}
```

## Notes

- **SignalR is the primary differentiator.** Pro-Watch is the only top-5 system with true push-based event streaming. This gives the best possible latency for presence tracking and mustering. Prioritize SignalR over REST polling in all Pro-Watch 4.x+ installations.
- **Honeywell ecosystem advantage**: At refinery sites running Honeywell Experion DCS, Pro-Watch is often already deployed or easy to justify. The same IT infrastructure (network, servers, support contracts) covers both process control and physical security.
- **SignalR protocol version matters.** Pro-Watch uses the older ASP.NET SignalR protocol (not ASP.NET Core SignalR). These are different wire protocols. Ensure the Rust client implementation targets the correct version.
- **Dual event code formats**: The `event_code_map` includes both numeric codes and string labels because Pro-Watch may report events in either format depending on the API path. The adapter checks both.
- **Pre-4.x installations**: Older Pro-Watch versions (3.x and earlier) have limited or no API support. These require the direct database path. The database schema is poorly documented, so the SQL view approach is recommended.
- **Port 8735 firewall**: The SignalR port (8735) must be open from the I/O server to the Pro-Watch server. This is separate from the REST API port (8734). Both must be allowed through site firewalls.
- **Honeywell Pro-Watch vs Lenel OnGuard**: Both are Honeywell-owned (Lenel via LenelS2 acquisition). They are separate product lines with completely different architectures, APIs, and databases. Do not confuse them. A site may have either, but rarely both.
