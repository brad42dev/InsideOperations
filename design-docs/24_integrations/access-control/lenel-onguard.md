# Lenel OnGuard — Access Control Connector Profile

## Application Overview

- **Vendor**: LenelS2 (Honeywell company)
- **Product**: OnGuard (7.x+ for REST API support)
- **Market Position**: Dominant in large enterprise and industrial. Very high prevalence in oil & gas, petrochemical, and critical infrastructure. Frequently specified in refinery security RFPs.
- **Licensing**: OpenAccess REST API requires a **separate license** (not included with base OnGuard). Direct database access requires no additional license but is unsupported by vendor.
- **Typical Deployment**: On-premise MSSQL (or Oracle) database server, one or more OnGuard application servers, distributed panels and readers at gates, buildings, and restricted areas.

## Integration Architecture

Lenel OnGuard integrates with I/O via the **BadgeAdapter trait** defined in Doc 30 (Access Control, Shifts & Presence). This is NOT a Universal Import pipeline connector. The adapter runs within the API Gateway service and feeds events directly into the `badge_events` table.

**Two integration paths** (select one per installation):

| Path | Requirements | Latency | Recommended For |
|------|-------------|---------|-----------------|
| OpenAccess REST API | OnGuard 7.x+, OpenAccess license, network access to OnGuard server | 10-30s (poll interval) | New installations, sites with API license |
| Direct Database (MSSQL) | Read-only SQL account, network access to OnGuard DB | 10-30s (poll interval) | Existing installations without API license |

## API Surface — OpenAccess REST API

- **Base URL**: `https://{onguard-server}/api/access/onguard/openaccess`
- **Authentication**: Session-based. POST `/authentication` with `Application-Id` header + username/password credentials. Returns a session token. Token must be refreshed on HTTP 401.
- **Data Format**: JSON
- **Pagination**: Offset-based via query parameters
- **Rate Limits**: Not formally documented; governed by server capacity
- **API Docs**: Behind LenelS2 partner portal (not public). Reference: [LenelS2 OpenAccess KB](https://kb.lenels2.com/home/openaccess)

### Key Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/authentication` | Obtain session token |
| GET | `/instances?type_name=Lnl_Cardholder` | List cardholders |
| GET | `/instances?type_name=Lnl_Badge` | List badges/credentials |
| POST | `/event_subscriptions` | Create event subscription |
| GET | `/event_subscriptions/{id}/events` | Poll subscribed events |
| GET | `/instances?type_name=Lnl_Reader` | List readers |
| GET | `/instances?type_name=Lnl_Area` | List areas |

## API Surface — Direct Database (MSSQL)

- **Engine**: Microsoft SQL Server (or Oracle at some sites)
- **Authentication**: SQL Server auth (username/password) or Windows integrated auth
- **Access**: Read-only account with SELECT on required tables/views

### Key Tables

| Table | Purpose |
|-------|---------|
| `EVENTS` | Badge event history (join with `EMP`, `BADGE`, `READER`) |
| `EMP` | Employee/cardholder master records |
| `BADGE` | Badge/credential records |
| `READER` | Reader definitions |
| `AREA` | Area/zone definitions |

**Recommended approach**: Create a read-only SQL Server view that joins `EVENTS` with `BADGE`, `EMP`, `READER`, and `AREA` tables. Poll this view with a timestamp watermark.

```sql
-- Example view (schema varies by OnGuard version — verify column names)
CREATE VIEW io_badge_events_vw AS
SELECT
    e.EVENT_ID,
    e.EVENT_TIME,
    e.EVENT_TYPE,
    b.BADGEID,
    emp.EMPID,
    emp.FIRST_NAME,
    emp.LAST_NAME,
    emp.EMAIL,
    r.READER_ID,
    r.READER_NAME,
    a.AREA_NAME
FROM EVENTS e
LEFT JOIN BADGE b ON e.BADGEID = b.BADGEID
LEFT JOIN EMP emp ON b.EMPID = emp.EMPID
LEFT JOIN READER r ON e.READER_ID = r.READER_ID
LEFT JOIN AREA a ON r.AREA_ID = a.AREA_ID
WHERE e.EVENT_TIME > @last_checkpoint;
```

## Target Tables

| I/O Table | Role |
|-----------|------|
| `badge_events` | Primary — all access events |
| `access_control_sources` | Configuration — source registration |
| `presence_status` | Derived — materialized from badge_events (not directly written) |

## Event Code Mapping

**Critical quirk**: Lenel OnGuard event type codes are **numeric and installation-specific**. Code 1001 might mean "Access Granted" at one site and something different at another. The mapping table below shows typical defaults, but **every installation requires verification of its event code configuration**.

The adapter stores a configurable `event_code_map` (JSON object in `access_control_sources.config`) that maps vendor codes to I/O's `BadgeEventType` enum.

### Typical Default Event Codes

| OnGuard Event Code | Typical Meaning | I/O `event_type` | Notes |
|--------------------|----------------|-------------------|-------|
| 1001 | Access Granted | `swipe_in` or `swipe_out` | Direction determined by reader config |
| 1002 | Access Denied — Invalid Card | `access_denied` | |
| 1003 | Access Denied — Expired Card | `access_denied` | |
| 1004 | Access Denied — Wrong Access Level | `access_denied` | |
| 1005 | Access Denied — Wrong Time Zone | `access_denied` | |
| 1020 | Anti-Passback Violation | `passback_violation` | |
| 1030 | Door Forced Open | `door_forced` | |
| 1031 | Door Held Open | `door_held_open` | |
| 1040 | Duress Alarm | `duress` | Requires duress PIN feature enabled |
| 1021 | Tailgate Detected | `tailgate` | Requires tailgate detection hardware |
| (other) | Unmapped | (omit or log) | Not all OnGuard events are badge-relevant |

### Direction Resolution

OnGuard does not natively distinguish in/out in a single event field. Direction is resolved by:

1. **Reader naming convention**: Sites typically name readers with IN/OUT suffix (e.g., "Main Gate IN", "Main Gate OUT"). The adapter parses `reader_name` for direction keywords.
2. **Reader configuration**: Pair readers as entry/exit in `access_control_sources.config`. Each reader_id maps to `in`, `out`, or `bidirectional`.
3. **Fallback**: If neither method resolves direction, set to `unknown`. Presence engine uses heuristics (alternating in/out from same area).

## Field Mapping — Badge Events

| OnGuard Field | I/O `badge_events` Column | Transform |
|---------------|--------------------------|-----------|
| `EVENT_ID` / `EVENTID` | `external_event_id` | Cast to string |
| `EVENT_TIME` | `event_time` | Convert to UTC TIMESTAMPTZ |
| (configured source) | `source_id` | FK to `access_control_sources` |
| `BADGEID` | `badge_id` | Cast to string |
| `EMPID` | `employee_id` | Cast to string |
| `FIRST_NAME` + `LAST_NAME` | `person_name` | Concatenate with space |
| (mapped via `users.employee_id` or `users.email`) | `user_id` | Nullable FK lookup |
| Event type code | `event_type` | Map via `event_code_map` config |
| `READER_ID` | `reader_id` | Cast to string |
| `READER_NAME` | `reader_name` | Direct |
| `AREA_NAME` | `reader_area` | Via reader-to-area join |

## Field Mapping — Cardholder Sync

Cardholder data is used for user correlation and display enrichment, not stored in a separate I/O table. The adapter caches cardholder records and uses them to resolve `person_name`, `employee_id`, and `user_id` on badge events.

| OnGuard Field | Usage | Notes |
|---------------|-------|-------|
| `EMPID` | User correlation key (primary) | Match against `users.employee_id` |
| `EMAIL` | User correlation key (fallback) | Match against `users.email`. May be in custom fields. |
| `FIRST_NAME` + `LAST_NAME` | Display name on badge events | |
| `DEPT` / department | Informational | Visible in presence/muster UIs |
| `BADGE_STATUS` | Filter | Only sync events for active badges |
| Photo (binary) | Optional | Fetch via separate API call if needed |

## Field Mapping — Zone/Reader Sync

| OnGuard Field | Usage | Notes |
|---------------|-------|-------|
| `AREA_ID` | Zone identifier | |
| `AREA_NAME` | Zone display name | Maps to `reader_area` on badge events |
| `PARENT_AREA_ID` | Zone hierarchy | For drill-down in presence dashboards |
| `READER_ID` | Reader identifier | |
| `READER_NAME` | Reader display name | Includes direction suffix at most sites |

## Sync Strategy

| Data Type | Method | Interval | Watermark |
|-----------|--------|----------|-----------|
| Badge events (API) | OpenAccess event subscription polling | 10-30s | Subscription cursor |
| Badge events (DB) | SQL poll on `EVENTS` table | 10-30s | `EVENT_TIME > @last_checkpoint` |
| Cardholders | Full sync via API or DB | Daily (default), configurable | `LAST_CHANGED` if available |
| Zones/Readers | Full sync via API or DB | Weekly or on-demand from Settings UI | N/A (full replace) |

### Initial Load

1. Register the source in `access_control_sources` with connection config and `event_code_map`
2. Sync zones/readers first (provides area context for events)
3. Sync cardholders (provides name/ID context for events)
4. Begin event polling from current time (do not backfill historical events unless explicitly configured)
5. Optional: backfill last 24-72 hours of events for immediate presence state

## Adapter Configuration

Stored in `access_control_sources.config` (JSONB):

```json
{
  "adapter_type": "lenel_onguard",
  "connection": {
    "mode": "api",
    "base_url": "https://onguard-server/api/access/onguard/openaccess",
    "application_id": "{{LENEL_APP_ID}}",
    "username": "{{LENEL_USERNAME}}",
    "password": "{{LENEL_PASSWORD}}"
  },
  "connection_db": {
    "mode": "database",
    "driver": "mssql",
    "host": "{{LENEL_DB_HOST}}",
    "port": 1433,
    "database": "{{LENEL_DB_NAME}}",
    "username": "{{LENEL_DB_USER}}",
    "password": "{{LENEL_DB_PASSWORD}}",
    "view_name": "io_badge_events_vw"
  },
  "event_code_map": {
    "1001": "swipe_in",
    "1002": "access_denied",
    "1003": "access_denied",
    "1004": "access_denied",
    "1005": "access_denied",
    "1020": "passback_violation",
    "1030": "door_forced",
    "1031": "door_held_open",
    "1040": "duress",
    "1021": "tailgate"
  },
  "reader_direction_map": {
    "RDR-001": "in",
    "RDR-002": "out"
  },
  "direction_keywords": {
    "in": ["IN", "ENTRY", "ENTER"],
    "out": ["OUT", "EXIT", "DEPART"]
  },
  "sync": {
    "event_poll_interval_sec": 15,
    "cardholder_sync_cron": "0 2 * * *",
    "zone_sync_cron": "0 3 * * 0"
  }
}
```

## Notes

- **Event codes MUST be verified per installation.** The default mapping above is a starting point. During commissioning, export the OnGuard event type configuration and build the site-specific `event_code_map`.
- **DataConduIT (COM/WMI)** is a legacy real-time interface. It is Windows-only and COM-based, making it incompatible with I/O's Rust stack. Do not pursue this path.
- **Database schema is undocumented** by LenelS2 for third-party use and varies between OnGuard versions. The SQL view approach isolates I/O from schema changes — if OnGuard is upgraded, only the view definition needs updating.
- **OpenAccess API license cost** is non-trivial. Many existing installations do not have it. The database path exists specifically for these sites.
- **Photo retrieval**: Badge photos are stored as BLOBs in the database or served via a separate API endpoint. Fetching photos is optional and should be done during cardholder sync, not per-event.
- **Multi-server deployments**: Large refinery installations may have multiple OnGuard servers (e.g., one per gate complex). Each server is registered as a separate `access_control_sources` entry with its own connection config.
