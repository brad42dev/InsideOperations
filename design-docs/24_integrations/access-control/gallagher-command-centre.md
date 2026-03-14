# Gallagher Command Centre — Access Control Connector Profile

## Application Overview

- **Vendor**: Gallagher Security (New Zealand, global presence)
- **Product**: Command Centre (8.x+ for current REST API)
- **Market Position**: Strong in Asia-Pacific, government, and critical infrastructure. Growing in North American industrial. Low-medium prevalence in refineries currently, but increasing. Known for the **best-documented public API** of any major access control vendor.
- **Licensing**: REST API is **included** with Command Centre (no separate license). Requires a Gallagher Technology Partner Agreement for production use.
- **Typical Deployment**: On-premise Command Centre server, Gallagher controllers (T-series, C-series), IP-based readers. Proprietary hardware ecosystem (not compatible with third-party panels).

## Integration Architecture

Gallagher Command Centre integrates with I/O via the **BadgeAdapter trait** defined in Doc 30 (Access Control, Shifts & Presence). This is NOT a Universal Import pipeline connector. The adapter runs within the API Gateway service and feeds events directly into the `badge_events` table.

**Single integration path**: REST API is the only supported method. Gallagher explicitly discourages and does not support direct database access (proprietary database engine).

| Path | Requirements | Latency | Recommended For |
|------|-------------|---------|-----------------|
| REST API | Command Centre 8.x+, REST Client item configured, network access | Near-real-time (long-poll ~1-2s latency) | All installations |

## API Surface — REST API

- **Base URL**: `https://{command-centre}:8904/api`
- **Authentication**: API key-based. Create a "REST Client" item in Command Centre admin, which generates an API key. Sent as `Authorization: GGL-API-KEY {key}` header.
- **Data Format**: JSON (HAL+JSON with HATEOAS-style hypermedia links)
- **Pagination**: Cursor-based (`next` links in response)
- **Rate Limits**: Not formally documented; governed by server capacity
- **API Docs**: **Publicly available** on GitHub — [Gallagher CC REST API Reference](https://gallaghersecurity.github.io/cc-rest-docs/ref/index.html)

### Key Endpoints

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/cardholders` | List cardholders (paginated, filterable) |
| GET | `/api/cardholders/{id}` | Get cardholder details |
| GET | `/api/events` | Query historical events |
| GET | `/api/events?after={bookmark}` | Long-poll for live events |
| GET | `/api/cardholders/{id}/events` | Events for specific cardholder |
| GET | `/api/access_groups` | List access groups |
| GET | `/api/doors` | List doors/readers |
| GET | `/api/items?type=33` | List areas/zones |

### Long-Poll Event Subscription

Gallagher's real-time event mechanism is **HTTP long-polling** on the events endpoint:

1. GET `/api/events?after={bookmark}` — blocks until new events arrive or timeout (30-60s)
2. Response includes events and a new `bookmark` value
3. Immediately issue next request with new bookmark
4. If no events within timeout, response returns empty with updated bookmark

This creates a continuous near-real-time event stream with ~1-2s latency. It is less efficient than WebSocket/SignalR but simpler to implement and very reliable.

### HATEOAS Navigation

Gallagher's API returns HAL+JSON with `href` links to related resources. Example:

```json
{
  "id": "5678",
  "time": "2025-06-15T14:32:05Z",
  "type": { "name": "Access Granted" },
  "cardholder": { "href": "https://cc:8904/api/cardholders/1234", "name": "John Smith" },
  "source": { "href": "https://cc:8904/api/doors/42", "name": "Main Gate IN" }
}
```

The adapter should resolve `href` links to populate missing fields (e.g., follow cardholder link to get employee_id) but cache aggressively to avoid excessive API calls.

## Target Tables

| I/O Table | Role |
|-----------|------|
| `badge_events` | Primary — all access events |
| `access_control_sources` | Configuration — source registration |
| `presence_status` | Derived — materialized from badge_events (not directly written) |

## Event Code Mapping

Gallagher uses **named event types** (string labels). These are consistent across installations and well-documented in the public API reference.

### Standard Event Type Mapping

| Gallagher Event Type | I/O `event_type` | Notes |
|---------------------|-------------------|-------|
| `Access Granted` | `swipe_in` or `swipe_out` | Direction from door/zone config |
| `Access Denied` | `access_denied` | |
| `Access Denied (Card Expired)` | `access_denied` | |
| `Access Denied (Card Inactive)` | `access_denied` | |
| `Access Denied (No Access)` | `access_denied` | Wrong access group |
| `Access Denied (Timezone)` | `access_denied` | Outside schedule |
| `Access Denied (Competency Expired)` | `access_denied` | Training/certification expired — Gallagher-specific |
| `Anti-Passback Violation` | `passback_violation` | |
| `Door Forced Open` | `door_forced` | |
| `Door Held Open` | `door_held_open` | |
| `Duress` | `duress` | |
| `Tailgate` | `tailgate` | Requires compatible hardware |
| (other) | (omit or log) | Alarm zone, input, output, system events |

### Event Groups

Gallagher organizes events into event groups. The adapter should filter to the `Access` event group to avoid processing irrelevant events (alarm, system, input/output events).

Filter parameter: `GET /api/events?after={bookmark}&group=2` (group 2 = Access events). Verify group numbers per installation.

### Direction Resolution

1. **Access zones**: Gallagher supports entry/exit zones per door. When a door is configured with an entry zone and exit zone, the event indicates which zone the cardholder entered. Entry zone = `in`, exit zone = `out`.
2. **Door naming**: Parse door name for direction keywords.
3. **Access group context**: Some sites configure one-way access groups (entry-only or exit-only). The access group on the event can imply direction.
4. **Fallback**: `unknown`.

## Field Mapping — Badge Events

| Gallagher Field | I/O `badge_events` Column | Transform |
|----------------|--------------------------|-----------|
| Event `id` | `external_event_id` | Cast to string |
| Event `time` | `event_time` | ISO 8601, convert to UTC TIMESTAMPTZ |
| (configured source) | `source_id` | FK to `access_control_sources` |
| Cardholder `cards[].number` | `badge_id` | From cardholder card list |
| Personal data field (configurable) | `employee_id` | Site-specific personal data definition |
| `cardholder.name` or `firstName` + `lastName` | `person_name` | From cardholder entity |
| (mapped via `users.employee_id` or `users.email`) | `user_id` | Nullable FK lookup |
| Event `type.name` | `event_type` | Map via `event_type_map` config |
| `source.href` / `source.name` | `reader_id` / `reader_name` | Door entity reference |
| Door's zone association | `reader_area` | Via door → zone relationship |

## Field Mapping — Cardholder Sync

| Gallagher Field | Usage | Notes |
|----------------|-------|-------|
| Personal data definition (employee_id) | User correlation key (primary) | Configurable field name — site-specific |
| `email` (personal data) | User correlation key (fallback) | Standard personal data field |
| `firstName` + `lastName` | Display name | |
| `division` | Department/organizational unit | Gallagher's hierarchical org structure |
| `cards[]` → `number` | Badge ID | Multiple cards possible per cardholder |
| Card `status` | Filter | Only sync active cards |
| `competencies[]` | Certifications | **Native training/cert tracking** |
| `accessGroups[]` | Authorized areas | For clearance-level reporting |

### Competencies (Training/Certification)

Gallagher is unique among the top 5 in having **native competency tracking**. Each cardholder can have competencies with:

- `name`: Certification name (e.g., "OSHA 30", "H2S Alive", "Confined Space")
- `expiryDate`: When the certification expires
- `status`: Valid, expired, pending renewal

When competencies are configured, Gallagher can **automatically deny access** when a required competency expires. The `Access Denied (Competency Expired)` event type is specific to this feature.

I/O can display competency status in the Shifts roster and muster UI alongside presence data.

| Gallagher Competency Field | I/O Usage | Notes |
|---------------------------|-----------|-------|
| `name` | Certification display name | |
| `expiryDate` | Expiry tracking | Flag approaching expiry in UI |
| `status` | Validity check | |

## Field Mapping — Zone/Reader Sync

| Gallagher Field | Usage | Notes |
|----------------|-------|-------|
| Zone item `id` | Zone identifier | Item type 33 |
| Zone item `name` | Zone display name | |
| Zone hierarchy | Parent/child zones | Via item relationships |
| Door `href` | Reader identifier | Door entity URL |
| Door `name` | Reader display name | |
| Access group associations | Zone membership | Which doors belong to which zones |

## Sync Strategy

| Data Type | Method | Interval | Watermark |
|-----------|--------|----------|-----------|
| Badge events | Long-poll on `/api/events?after={bookmark}` | Near-real-time (~1-2s) | Event `bookmark` (opaque cursor, not timestamp) |
| Cardholders | Incremental with `modifiedSince` | Daily or hourly | `modifiedSince` timestamp |
| Competencies | Synced with cardholders | Daily or hourly | Same as cardholders |
| Zones/Doors | Full sync | Weekly or on-demand | N/A (full replace) |

### Bookmark-Based Event Streaming

Gallagher's event streaming uses an opaque **bookmark** rather than a timestamp or event ID. This is important:

- The bookmark is returned in each event response and must be persisted
- On adapter restart, resume from the last persisted bookmark
- If the bookmark is lost or expired, start from `after=0` to get the latest events (does NOT replay history — only returns the next event after the current position)
- To backfill history, use the standard `/api/events` endpoint with time range filters

### Initial Load

1. Register the source in `access_control_sources` with connection config
2. Sync zones via `/api/items?type=33`
3. Sync doors via `/api/doors`
4. Sync cardholders via `/api/cardholders` (includes competencies)
5. Begin long-poll event stream from `/api/events?after=0`
6. Optional: backfill last 24-72 hours via `/api/events` with time range filter for initial presence state

## Adapter Configuration

Stored in `access_control_sources.config` (JSONB):

```json
{
  "adapter_type": "gallagher_command_centre",
  "connection": {
    "base_url": "https://command-centre-server:8904",
    "api_key": "{{GALLAGHER_API_KEY}}"
  },
  "employee_id_field": "Employee Number",
  "event_group_filter": 2,
  "event_type_map": {
    "Access Granted": "swipe_in",
    "Access Denied": "access_denied",
    "Access Denied (Card Expired)": "access_denied",
    "Access Denied (Card Inactive)": "access_denied",
    "Access Denied (No Access)": "access_denied",
    "Access Denied (Timezone)": "access_denied",
    "Access Denied (Competency Expired)": "access_denied",
    "Anti-Passback Violation": "passback_violation",
    "Door Forced Open": "door_forced",
    "Door Held Open": "door_held_open",
    "Duress": "duress",
    "Tailgate": "tailgate"
  },
  "door_direction_map": {
    "42": "in",
    "43": "out"
  },
  "direction_keywords": {
    "in": ["IN", "ENTRY", "ENTER"],
    "out": ["OUT", "EXIT", "DEPART"]
  },
  "competency_sync_enabled": true,
  "sync": {
    "long_poll_timeout_sec": 60,
    "cardholder_sync_cron": "0 2 * * *",
    "zone_sync_cron": "0 3 * * 0"
  },
  "bookmark": null
}
```

## Notes

- **Best API documentation of any access control vendor.** The publicly available GitHub docs make this the easiest system to integrate. Implementation engineers can read the full API reference without partner portal access: [gallaghersecurity.github.io/cc-rest-docs](https://gallaghersecurity.github.io/cc-rest-docs/ref/index.html)
- **API key authentication is simpler** than the session-based or token-based auth used by other vendors. No token refresh logic needed — the API key is long-lived and managed in Command Centre admin.
- **Bookmark persistence is critical.** If the adapter loses its bookmark (e.g., database reset without backup), it cannot replay missed events. The bookmark must be stored in `access_control_sources.config` or a separate checkpoint table and updated after each successful event batch.
- **No direct database access.** This is by design — Gallagher uses a proprietary database. The REST API is the only integration path. This simplifies the adapter (one path, not two) but means there is no "cheap" fallback if the API is unavailable.
- **Competency tracking is a differentiator.** If the site uses Gallagher to track safety certifications, I/O can display cert status in the Shifts and Muster UIs without requiring a separate LMS integration. This is particularly valuable for refineries with strict training requirements (H2S, confined space, hot work permits).
- **HATEOAS link resolution**: The adapter should cache cardholder and door entities after first resolution. Links change rarely, so a 24-hour cache TTL is appropriate. Only re-resolve on cache miss.
- **Divisions** in Gallagher are hierarchical organizational units (like departments). They map to I/O's concept of departments/groups in the presence UI.
- **Multiple cards per cardholder**: Gallagher supports multiple active cards per person (e.g., proximity badge + mobile credential). All cards map to the same cardholder. The adapter should resolve any of a cardholder's cards to the same `person_name` and `user_id`.
- **Technology Partner Agreement**: While the API is publicly documented, production use requires a signed agreement with Gallagher. This is a commercial/legal requirement, not a technical one.
