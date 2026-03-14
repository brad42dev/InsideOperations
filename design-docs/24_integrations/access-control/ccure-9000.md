# Software House C-CURE 9000 — Access Control Connector Profile

## Application Overview

- **Vendor**: Software House (Johnson Controls)
- **Product**: C-CURE 9000 (v2.9 SP2+ for REST API support)
- **Market Position**: Top-tier enterprise access control. High prevalence in Fortune 500 facilities including refineries. Competes directly with Lenel OnGuard for the same market segment.
- **Licensing**: victor Web Service REST API requires the **"victor Web Service for End-Users"** license (separate purchase). Direct database access requires no additional license.
- **Typical Deployment**: On-premise MSSQL database, C-CURE 9000 application server, iSTAR controllers and readers at access points. Often paired with victor unified video management.

## Integration Architecture

C-CURE 9000 integrates with I/O via the **BadgeAdapter trait** defined in Doc 30 (Access Control, Shifts & Presence). This is NOT a Universal Import pipeline connector. The adapter runs within the API Gateway service and feeds events directly into the `badge_events` table.

**Two integration paths** (select one per installation):

| Path | Requirements | Latency | Recommended For |
|------|-------------|---------|-----------------|
| victor Web Service (REST) | C-CURE 9000 v2.9 SP2+, Web Service license | 10-30s (poll interval) | Sites with API license |
| Direct Database (MSSQL) | Read-only SQL account, network access to C-CURE DB | 10-30s (poll interval) | Sites without API license (majority of existing installations) |

**No native push/streaming**: C-CURE 9000 does not support webhooks, WebSocket, or any push-based event delivery. Both paths are poll-based. For near-real-time on the database path, SQL Server Change Data Capture (CDC) or Service Broker can be used to detect new events more efficiently than timestamp polling.

## API Surface — victor Web Service (REST)

- **Base URL**: `https://{ccure-server}/victorWebService/api`
- **Authentication**: Token-based. POST to login endpoint returns bearer token. Include as `Authorization: Bearer {token}` on subsequent requests.
- **Data Format**: JSON
- **Pagination**: Offset/limit parameters
- **Rate Limits**: Not formally documented
- **API Docs**: Behind Johnson Controls partner portal (not public)

### Key Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/auth/login` | Obtain bearer token |
| GET | `/api/personnel` | List cardholder/personnel records |
| GET | `/api/credentials` | List badges/credentials |
| GET | `/api/events` | Query badge events (time filter) |
| GET | `/api/doors` | List doors/readers |
| GET | `/api/clearances` | List clearance/access levels |

## API Surface — Direct Database (MSSQL)

- **Engine**: Microsoft SQL Server
- **Authentication**: SQL Server auth (username/password)
- **Access**: Read-only account with SELECT on required tables

### Key Tables

| Table | Purpose |
|-------|---------|
| `JournalLog` / `EventJournal` | Event history (table name varies by version) |
| `Personnel` | Cardholder/employee master records |
| `Credential` | Badge/credential records |
| `Door` | Door/reader definitions |
| `Clearance` | Access level definitions |

**Note**: C-CURE uses "Door" as its primary unit, not "Reader." A door may have one or two readers (entry side, exit side). The adapter maps doors to I/O's reader concept.

```sql
-- Example poll query (verify table/column names per installation)
SELECT
    j.EventID,
    j.EventDateTime,
    j.EventType,
    j.EventDescription,
    c.CardNumber,
    p.EmployeeNumber,
    p.FirstName,
    p.LastName,
    p.Email,
    d.DoorName,
    d.DoorID,
    d.AreaName
FROM JournalLog j
LEFT JOIN Credential c ON j.CredentialID = c.CredentialID
LEFT JOIN Personnel p ON c.PersonnelID = p.PersonnelID
LEFT JOIN Door d ON j.DoorID = d.DoorID
WHERE j.EventDateTime > @last_checkpoint
ORDER BY j.EventDateTime ASC;
```

## Target Tables

| I/O Table | Role |
|-----------|------|
| `badge_events` | Primary — all access events |
| `access_control_sources` | Configuration — source registration |
| `presence_status` | Derived — materialized from badge_events (not directly written) |

## Event Code Mapping

C-CURE 9000 uses string-based event type descriptions rather than pure numeric codes. The exact strings vary somewhat by version but are more readable than Lenel's numeric codes. The adapter matches on the `EventType` or `EventDescription` field.

### Standard Event Type Mapping

| C-CURE Event Type / Description | I/O `event_type` | Notes |
|---------------------------------|-------------------|-------|
| `Access Granted` | `swipe_in` or `swipe_out` | Direction from door/reader config |
| `Valid Card` | `swipe_in` or `swipe_out` | Alternate phrasing, same meaning |
| `Access Denied` | `access_denied` | |
| `Invalid Card` | `access_denied` | Unrecognized credential |
| `Card Expired` | `access_denied` | Expired credential |
| `Invalid Access Level` | `access_denied` | Wrong clearance |
| `Invalid Timezone` | `access_denied` | Outside allowed schedule |
| `Anti-Passback Violation` | `passback_violation` | |
| `Door Forced` / `Door Forced Open` | `door_forced` | |
| `Door Held` / `Door Held Open` | `door_held_open` | |
| `Duress` / `Duress Alarm` | `duress` | Requires duress PIN feature |
| `Tailgate` / `Tailgate Detected` | `tailgate` | Requires tailgate detection hardware |
| (other) | (omit or log) | System events, hardware events, etc. |

### Direction Resolution

C-CURE's "Door" model means direction depends on which reader on the door was used:

1. **Door reader sides**: C-CURE configures doors with Side A (typically entry) and Side B (typically exit). The event record may indicate which side triggered the event. Map Side A → `in`, Side B → `out`.
2. **Door naming convention**: Sites often name doors with directional suffixes (e.g., "Main Gate Entry", "Bldg 4 Exit"). Parse `DoorName` for direction keywords.
3. **Reader-level config**: In `access_control_sources.config`, map each door_id to a direction, or map door + side combinations.
4. **Fallback**: `unknown` if direction cannot be resolved.

## Field Mapping — Badge Events

| C-CURE Field | I/O `badge_events` Column | Transform |
|--------------|--------------------------|-----------|
| `EventID` | `external_event_id` | Cast to string |
| `EventDateTime` | `event_time` | Convert to UTC TIMESTAMPTZ |
| (configured source) | `source_id` | FK to `access_control_sources` |
| `CardNumber` | `badge_id` | Cast to string |
| `EmployeeNumber` | `employee_id` | Cast to string |
| `FirstName` + `LastName` | `person_name` | Concatenate with space |
| (mapped via `users.employee_id` or `users.email`) | `user_id` | Nullable FK lookup |
| `EventType` / `EventDescription` | `event_type` | Map via `event_type_map` config |
| `DoorID` | `reader_id` | Cast to string |
| `DoorName` | `reader_name` | Direct (C-CURE uses "door" terminology) |
| `AreaName` | `reader_area` | Via door-to-area association |

## Field Mapping — Cardholder Sync

| C-CURE Field | Usage | Notes |
|--------------|-------|-------|
| `EmployeeNumber` | User correlation key (primary) | Match against `users.employee_id` |
| `Email` | User correlation key (fallback) | Match against `users.email` |
| `FirstName` + `LastName` | Display name on badge events | |
| `Department` | Informational | Visible in presence/muster UIs |
| `Company` | Contractor identification | Non-owner company = contractor |
| Badge `Status` | Filter | Only sync active credentials |
| Photo (if available) | Optional | Separate retrieval path |

## Field Mapping — Zone/Reader Sync

| C-CURE Field | Usage | Notes |
|--------------|-------|-------|
| `AreaID` / `AreaName` | Zone identifier/name | C-CURE areas map to I/O zones |
| `DoorID` | Reader identifier | One door = one or two readers |
| `DoorName` | Reader display name | |
| `ControllerID` | Grouping | For diagnostic/health purposes |

## Sync Strategy

| Data Type | Method | Interval | Watermark |
|-----------|--------|----------|-----------|
| Badge events (API) | REST poll on `/api/events` | 10-30s | `EventDateTime > @last_checkpoint` |
| Badge events (DB) | SQL poll on `JournalLog` | 10-30s | `EventDateTime > @last_checkpoint` |
| Badge events (DB — CDC) | SQL Server Change Data Capture | Near-real-time (~2-5s) | CDC LSN (log sequence number) |
| Cardholders | Full sync via API or DB | Daily (default), configurable | N/A (full diff) |
| Zones/Doors | Full sync via API or DB | Weekly or on-demand | N/A (full replace) |

### Initial Load

1. Register the source in `access_control_sources` with connection config and `event_type_map`
2. Sync zones/doors first (provides area context for events)
3. Sync cardholders (provides name/ID context for events)
4. Begin event polling from current time
5. Optional: backfill last 24-72 hours for initial presence state

### CDC Setup (Database Path — Recommended for Near-Real-Time)

If using the direct database path and near-real-time is required:

```sql
-- Enable CDC on the C-CURE database (requires sysadmin)
EXEC sys.sp_cdc_enable_db;

-- Enable CDC on the event journal table
EXEC sys.sp_cdc_enable_table
    @source_schema = N'dbo',
    @source_name = N'JournalLog',
    @role_name = N'cdc_reader';
```

The adapter polls the CDC change table (`cdc.dbo_JournalLog_CT`) using LSN watermarks instead of timestamp-based polling. This is more reliable (no clock skew issues) and catches all events including those inserted out of order.

## Adapter Configuration

Stored in `access_control_sources.config` (JSONB):

```json
{
  "adapter_type": "ccure_9000",
  "connection": {
    "mode": "api",
    "base_url": "https://ccure-server/victorWebService/api",
    "username": "{{CCURE_USERNAME}}",
    "password": "{{CCURE_PASSWORD}}"
  },
  "connection_db": {
    "mode": "database",
    "driver": "mssql",
    "host": "{{CCURE_DB_HOST}}",
    "port": 1433,
    "database": "{{CCURE_DB_NAME}}",
    "username": "{{CCURE_DB_USER}}",
    "password": "{{CCURE_DB_PASSWORD}}",
    "use_cdc": true,
    "event_table": "JournalLog"
  },
  "event_type_map": {
    "Access Granted": "swipe_in",
    "Valid Card": "swipe_in",
    "Access Denied": "access_denied",
    "Invalid Card": "access_denied",
    "Card Expired": "access_denied",
    "Invalid Access Level": "access_denied",
    "Invalid Timezone": "access_denied",
    "Anti-Passback Violation": "passback_violation",
    "Door Forced": "door_forced",
    "Door Forced Open": "door_forced",
    "Door Held": "door_held_open",
    "Door Held Open": "door_held_open",
    "Duress": "duress",
    "Duress Alarm": "duress",
    "Tailgate": "tailgate",
    "Tailgate Detected": "tailgate"
  },
  "door_direction_map": {
    "DOOR-001": "in",
    "DOOR-002": "out",
    "DOOR-003": { "side_a": "in", "side_b": "out" }
  },
  "direction_keywords": {
    "in": ["ENTRY", "IN", "ENTER"],
    "out": ["EXIT", "OUT", "DEPART"]
  },
  "sync": {
    "event_poll_interval_sec": 15,
    "cardholder_sync_cron": "0 2 * * *",
    "zone_sync_cron": "0 3 * * 0"
  }
}
```

## Notes

- **"Door" vs "Reader" terminology**: C-CURE models access points as "doors" with one or two readers (sides). I/O models them as "readers." The adapter maps C-CURE doors to I/O readers. If a door has two sides, each side can be mapped as a separate logical reader with opposite directions.
- **Event type strings may vary by version.** The mapping table above covers the most common phrasings. During commissioning, query the distinct `EventType` values from the event journal and verify the mapping.
- **REST API availability is uncommon on existing installations.** Most refinery C-CURE deployments pre-date the Web Service feature. Plan for the database path as the primary integration for brownfield sites.
- **API documentation is not public.** Implementation requires Johnson Controls partner access or reverse-engineering the API from the victor client's network traffic.
- **victor unified platform**: Some newer installations run the "victor" unified platform that combines C-CURE 9000 (access) with victor VMS (video). The API surface is the same — the Web Service covers both products.
- **Clearance data** (which areas a cardholder can access) is useful for anomaly detection in Forensics — flagging when someone badges into an area their clearance doesn't cover (possible misconfiguration or tailgating).
