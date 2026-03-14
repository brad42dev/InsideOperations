# Genetec Security Center — Access Control Connector Profile

## Application Overview

- **Vendor**: Genetec Inc.
- **Product**: Security Center (Synergis access control module)
- **Market Position**: Strong in unified security (video + access control on one platform). Growing in industrial and critical infrastructure. Medium prevalence in refineries, more common at sites that prioritize video-access integration.
- **Licensing**: Web SDK REST API is **included** with Security Center (no separate license). Full .NET SDK requires Genetec Development Acceleration Program (DAP) partnership.
- **Typical Deployment**: On-premise Security Center server (Windows), Synergis appliances or third-party controllers, IP-based readers. Unified platform covers access control (Synergis), video (Omnicast), and intrusion detection.

## Integration Architecture

Genetec Security Center integrates with I/O via the **BadgeAdapter trait** defined in Doc 30 (Access Control, Shifts & Presence). This is NOT a Universal Import pipeline connector. The adapter runs within the API Gateway service and feeds events directly into the `badge_events` table.

**Single integration path**: Web SDK REST API is the only practical option for I/O's Rust stack. The .NET SDK is incompatible with Rust, and Genetec discourages direct database access.

| Path | Requirements | Latency | Recommended For |
|------|-------------|---------|-----------------|
| Web SDK REST API | Security Center 5.x+, network access to SC server | Near-real-time (event subscription on port 4591) | All installations |

## API Surface — Web SDK REST API

- **Base URL**: `https://{security-center}:4590/api/v1`
- **Event Streaming**: `https://{security-center}:4591` (dedicated event subscription port)
- **Authentication**: HTTP Basic auth (username:password) or Active Directory integrated authentication. All requests over HTTPS.
- **Data Format**: JSON
- **Data Model**: Entity-based — everything (cardholders, doors, areas, cameras) is an "entity" with a GUID and type
- **Pagination**: Offset/limit or continuation token
- **Rate Limits**: Not formally documented
- **API Docs**: Behind Genetec DAP portal. Reference: [Genetec DAP GitHub](https://github.com/Genetec/DAP)

### Key Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/entities?entityType=Cardholder` | List cardholders |
| GET | `/entities/{guid}` | Get entity details (any type) |
| GET | `/events?sourceEntityType=Door` | Query historical access events |
| POST | `/events/subscribe` (port 4591) | Subscribe to live event stream |
| GET | `/entities?entityType=Area` | List areas/zones |
| GET | `/entities?entityType=Door` | List doors/readers |

### Event Subscription (Port 4591)

The event subscription endpoint on port 4591 provides near-real-time event push:

1. POST to subscription endpoint with event type filters
2. Maintain a persistent HTTP connection (long-poll or streaming)
3. Events are pushed as they occur
4. On connection drop, reconnect and replay from last known event timestamp

This is Genetec's recommended path for real-time integrations and is more efficient than polling the historical events endpoint.

## Target Tables

| I/O Table | Role |
|-----------|------|
| `badge_events` | Primary — all access events |
| `access_control_sources` | Configuration — source registration |
| `presence_status` | Derived — materialized from badge_events (not directly written) |

## Event Code Mapping

Genetec uses **named event types** (string enums) rather than numeric codes. This is more stable across versions than Lenel's numeric codes, but the exact enum values should still be verified per installation.

### Standard Event Type Mapping

| Genetec Event Type | I/O `event_type` | Notes |
|--------------------|-------------------|-------|
| `AccessGranted` | `swipe_in` or `swipe_out` | Direction from door/reader config |
| `AccessGrantedNoEntry` | (omit) | Badge accepted but door not opened — not a presence event |
| `AccessDenied` | `access_denied` | |
| `AccessDeniedCredentialExpired` | `access_denied` | |
| `AccessDeniedCredentialInactive` | `access_denied` | |
| `AccessDeniedInvalidAccessRule` | `access_denied` | |
| `AccessDeniedInvalidSchedule` | `access_denied` | |
| `AntiPassbackViolation` | `passback_violation` | |
| `DoorForcedOpen` | `door_forced` | |
| `DoorHeldOpen` | `door_held_open` | |
| `DuressDetected` | `duress` | |
| `TailgateDetected` | `tailgate` | Requires compatible hardware |
| `FirstPersonIn` | `swipe_in` | First badge-in enables other access (lobby security pattern) |
| `LastPersonOut` | `swipe_out` | Last badge-out secures area |
| (other) | (omit or log) | System, video, intrusion events — not badge-relevant |

### Direction Resolution

Genetec's entity model provides better direction data than most competitors:

1. **Door sides**: Genetec doors have `side_a_reader` and `side_b_reader` properties. Events can indicate which reader (side) triggered the event. Convention: Side A = entry, Side B = exit.
2. **Area transitions**: If areas are configured with entry/exit doors, Genetec tracks "cardholder entered Area X" / "cardholder exited Area X" at the event level. This is the most reliable direction source.
3. **Door naming**: Parse door entity name for direction keywords as fallback.
4. **`FirstPersonIn` / `LastPersonOut`**: These event types inherently indicate direction.

## Field Mapping — Badge Events

| Genetec Field | I/O `badge_events` Column | Transform |
|---------------|--------------------------|-----------|
| Event GUID | `external_event_id` | GUID string |
| `Timestamp` | `event_time` | Convert to UTC TIMESTAMPTZ |
| (configured source) | `source_id` | FK to `access_control_sources` |
| Credential `CardNumber` | `badge_id` | Nested under cardholder entity → credentials[] |
| Cardholder custom field | `employee_id` | Must be configured as a custom field in Genetec |
| `FirstName` + `LastName` | `person_name` | From cardholder entity |
| (mapped via `users.employee_id` or `users.email`) | `user_id` | Nullable FK lookup |
| Event type enum | `event_type` | Map via `event_type_map` config |
| `SourceEntity` GUID | `reader_id` | Door entity GUID |
| Door entity `Name` | `reader_name` | From door entity |
| Area entity `Name` | `reader_area` | Via door-to-area association |

### Cardholder-Event Resolution

Genetec events reference the source entity (door) and may reference the cardholder entity via a link. The adapter must:

1. Maintain a local cache of cardholder entities (GUID → name, badge_id, employee_id)
2. On each event, resolve the cardholder from the event's credential reference
3. If the cardholder is not in cache, fetch via `/entities/{guid}` and cache

## Field Mapping — Cardholder Sync

| Genetec Field | Usage | Notes |
|---------------|-------|-------|
| Custom field (employee_id) | User correlation key (primary) | Must be configured in Genetec as a custom cardholder field |
| `EmailAddress` | User correlation key (fallback) | Standard cardholder field |
| `FirstName` + `LastName` | Display name | |
| `Description` | Informational | Often contains department or role |
| Credential `CardNumber` | Badge mapping | Under cardholder → `credential_list[]` |
| Credential `Status` | Filter | Only sync active credentials |
| `Picture` | Optional | Fetched via separate entity property endpoint |

**Note on employee_id**: Genetec does not have a built-in employee ID field. Most installations add it as a custom "Personal Data Definition" (PDF). The adapter config must specify which custom field name holds the employee_id. This is a per-site configuration item.

## Field Mapping — Zone/Reader Sync

| Genetec Field | Usage | Notes |
|---------------|-------|-------|
| Area entity GUID | Zone identifier | |
| Area entity `Name` | Zone display name | |
| Area `MemberList` | Child entities (doors, sub-areas) | For zone hierarchy |
| Door entity GUID | Reader identifier | |
| Door entity `Name` | Reader display name | |
| Door `SideAReader` / `SideBReader` | Direction mapping | Entry/exit reader identification |

## Sync Strategy

| Data Type | Method | Interval | Watermark |
|-----------|--------|----------|-----------|
| Badge events | Event subscription (port 4591) | Near-real-time (push) | Event timestamp / subscription cursor |
| Badge events (fallback) | REST poll on `/events` | 30s | `timestamp > @last_checkpoint` |
| Cardholders | Incremental sync with `modifiedSince` | Daily or hourly | `modifiedSince` timestamp |
| Zones/Doors | Full sync via entity query | Weekly or on-demand | N/A (full replace) |

### Initial Load

1. Register the source in `access_control_sources` with connection config
2. Sync area entities (zones)
3. Sync door entities (readers) with area associations
4. Sync cardholder entities (populate cache)
5. Establish event subscription on port 4591
6. Optional: query last 24-72 hours of historical events for initial presence state

## Adapter Configuration

Stored in `access_control_sources.config` (JSONB):

```json
{
  "adapter_type": "genetec_security_center",
  "connection": {
    "base_url": "https://security-center-server",
    "api_port": 4590,
    "event_port": 4591,
    "username": "{{GENETEC_USERNAME}}",
    "password": "{{GENETEC_PASSWORD}}",
    "auth_type": "basic"
  },
  "employee_id_field": "EmployeeNumber",
  "event_type_map": {
    "AccessGranted": "swipe_in",
    "AccessDenied": "access_denied",
    "AccessDeniedCredentialExpired": "access_denied",
    "AccessDeniedCredentialInactive": "access_denied",
    "AccessDeniedInvalidAccessRule": "access_denied",
    "AccessDeniedInvalidSchedule": "access_denied",
    "AntiPassbackViolation": "passback_violation",
    "DoorForcedOpen": "door_forced",
    "DoorHeldOpen": "door_held_open",
    "DuressDetected": "duress",
    "TailgateDetected": "tailgate",
    "FirstPersonIn": "swipe_in",
    "LastPersonOut": "swipe_out"
  },
  "door_direction_map": {
    "{door-guid-1}": { "side_a": "in", "side_b": "out" },
    "{door-guid-2}": "in"
  },
  "direction_keywords": {
    "in": ["IN", "ENTRY", "ENTER"],
    "out": ["OUT", "EXIT", "DEPART"]
  },
  "sync": {
    "use_event_subscription": true,
    "event_poll_fallback_sec": 30,
    "cardholder_sync_cron": "0 2 * * *",
    "zone_sync_cron": "0 3 * * 0"
  }
}
```

## Notes

- **Entity-based data model** is different from the table-centric model of Lenel/C-CURE. Everything in Genetec is an entity with a GUID, type, and properties. The adapter must navigate entity relationships (cardholder → credentials, door → area) rather than joining SQL tables.
- **`employee_id` is a custom field** and must be explicitly configured per site. If the site does not populate this field in Genetec, the adapter falls back to email-based user correlation.
- **Web SDK vs Full SDK**: The Web SDK (REST) has a more limited feature set than the .NET SDK. For I/O's purposes (events, cardholders, areas, doors), the Web SDK is sufficient. The full SDK is only needed for deep integration (controlling doors, triggering actions) which I/O does not require.
- **Video integration**: Genetec's unified platform means access events can be correlated with video footage. I/O does not consume video, but the event metadata may include video bookmark references that could be stored for external use.
- **IP-based architecture**: Genetec is natively IP-based. Older refineries with legacy Wiegand panel infrastructure may need Synergis gateway appliances to bridge legacy hardware into Security Center.
- **Port 4591 firewall**: The event streaming port (4591) must be open from the I/O server to the Security Center server. This is a separate port from the REST API (4590) and is frequently missed during network configuration.
- **`AccessGrantedNoEntry`**: This event means the badge was accepted but the person did not open the door (within the door strike timeout). Filtering this out prevents false presence updates.
