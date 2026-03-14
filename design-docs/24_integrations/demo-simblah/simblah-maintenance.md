# SimBLAH Maintenance — Demo Connector Profile

## Application Overview

- **Vendor**: SimBLAH (internal demo / proof-of-concept)
- **Product**: SimBLAH Maintenance Service — part of the SimBLAH refinery simulator suite
- **Market Position**: Not a commercial product. SimBLAH simulates a petroleum refinery (Hydrocracker Unit 25 + H₂ Plant Unit 24) with physically realistic synthetic data. The Maintenance service manages tickets, work orders, and device point metadata for ~741 instruments across both units
- **Licensing**: Internal tooling. No licensing cost
- **Typical Deployment**: Single-server deployment alongside SimBLAH OPC Server and Accounting services. Rust/Axum backend with PostgreSQL. Accessed via HTTPS on port 8444

## API Surface

- **Protocol**: REST/JSON
- **Base URL**: `https://maint.simblah.in-ops.com:8444/api`
- **Authentication**:
  - **Bearer Token** (preferred for I/O integration): Users with `api_access` or `admin` privilege. Use the `lnovak` account (api_access role) or `admin`
  - **Session Cookie**: Available via `POST /api/auth/login`, but Bearer token is preferred for machine-to-machine
- **Pagination**: `page` + `per_page` parameters. Max `per_page` is 100, default 50. Response includes `pagination` object with `total_items` and `total_pages`
- **Query Syntax**: Query parameters on list endpoints (e.g., `status=open`, `priority=critical`, `from=...&to=...`). Sort via `sort` and `order` params
- **Rate Limits**: None documented. Single-tenant demo system
- **Response Envelope**: `{ "data": {...} }` for single items, `{ "data": [...], "pagination": {...} }` for lists

### Key Endpoints

| Endpoint | Purpose |
|---|---|
| `GET /api/tickets` | List maintenance tickets (paginated, filterable) |
| `GET /api/tickets/{id}` | Single ticket with linked work order IDs |
| `POST /api/tickets/{id}/close` | Mark ticket closed |
| `GET /api/workorders` | List work orders (paginated, filterable) |
| `GET /api/workorders/{id}` | Single work order with asset/device detail |
| `POST /api/workorders/{id}/complete` | Mark work order complete |
| `GET /api/points` | List all 741 device points (instrument metadata) |
| `GET /api/points/{id}` | Single device point |

## Target Tables

| Table | Role | Description |
|---|---|---|
| `tickets` | **Primary** | Maintenance tickets from `/api/tickets` |
| `work_orders` | **Primary** | Work orders from `/api/workorders` |
| `equipment` | **Primary** | Device/instrument metadata from `/api/points` |

## Field Mapping

### Tickets: `/api/tickets` → `tickets`

| SimBLAH Field | I/O Column | Required | Transform | Notes |
|---|---|---|---|---|
| `id` | `external_id` | Yes | `to_string` | SimBLAH ticket ID |
| — | `source_system` | Yes | Constant: `"simblah_maint"` | |
| `subject` | `title` | Yes | Direct | Short description |
| `description` | `description` | No | Direct | Full ticket body |
| `status` | `status` | Yes | `static_map` | See status normalization below |
| `priority` | `priority` | Yes | `static_map` | See priority normalization below |
| `assigned_to` | `assigned_to` | No | Direct | User ID of assignee |
| `assigned_to_name` | — | No | Stored in `extra_data` | Username for display reference |
| `date_opened` | `created_at` | Yes | `parse_datetime` | ISO 8601 UTC |
| `due_date` | `due_date` | No | `parse_datetime` | ISO 8601 UTC |
| `date_closed` | `closed_at` | No | `parse_datetime` | Null if still open |
| `work_order_ids` | — | No | Stored in `extra_data.work_order_ids` | Array of linked WO IDs; use for cross-reference after WO sync |

### Work Orders: `/api/workorders` → `work_orders`

| SimBLAH Field | I/O Column | Required | Transform | Notes |
|---|---|---|---|---|
| `id` | `external_id` | Yes | `to_string` | SimBLAH work order ID |
| — | `source_system` | Yes | Constant: `"simblah_maint"` | |
| `subject` | `title` | Yes | Direct | Short description |
| `description` | `description` | No | Direct | Full work order body |
| `status` | `status` | Yes | `static_map` | See status normalization below |
| `ticket_id` | — | No | Stored in `extra_data.ticket_id` | Parent ticket reference |
| `assigned_to` | `assigned_to` | No | Direct | User ID |
| `assigned_to_name` | — | No | Stored in `extra_data` | Username for display reference |
| `point_id` | `equipment_id` | No | `lookup`: match `equipment.external_id` | FK to equipment table via device point ID |
| `point_name` | — | No | Stored in `extra_data` | ISA tag name (e.g., `25-TI-1115`) |
| `point_criticality` | `priority` | No | `static_map` | Overrides if no WO-level priority; see criticality map below |
| `device_type` | — | No | Stored in `extra_data.device_type` | e.g., `Thermocouple`, `Control Valve` |
| `asset` | `asset_tag` | No | Direct | Equipment identifier (e.g., `R-2501`) |
| `asset_location` | `location` | No | Direct | Physical location (e.g., `Unit 25 - Reactor Section`) |
| `replacement_model` | — | No | Stored in `extra_data.replacement_model` | Manufacturer part/model for replacement |
| `date_opened` | `created_at` | Yes | `parse_datetime` | ISO 8601 UTC |
| `due_date` | `due_date` | No | `parse_datetime` | ISO 8601 UTC |
| `date_completed` | `completed_at` | No | `parse_datetime` | Null if not yet complete |

### Device Points: `/api/points` → `equipment`

| SimBLAH Field | I/O Column | Required | Transform | Notes |
|---|---|---|---|---|
| `id` | `external_id` | Yes | `to_string` | SimBLAH device point ID |
| — | `source_system` | Yes | Constant: `"simblah_maint"` | |
| `point_name` | `tag_name` | Yes | Direct | ISA tag name (e.g., `25-TI-1115`) |
| `point_description` | `description` | No | Direct | Human-readable description |
| `criticality` | `criticality` | No | `static_map` | See criticality normalization below |
| `device_type` | `equipment_type` | No | Direct | e.g., `Thermocouple`, `Control Valve`, `Pressure Transmitter` |
| `asset` | `parent_asset` | No | Direct | Parent equipment tag (e.g., `R-2501`) |
| `asset_location` | `location` | No | Direct | Physical location string |
| `replacement_model` | — | No | Stored in `extra_data.replacement_model` | Manufacturer model number |

## Status Normalization

### Ticket Status

| SimBLAH Status | I/O `status` |
|---|---|
| `open` | `open` |
| `in_progress` | `in_progress` |
| `on_hold` | `on_hold` |
| `closed` | `closed` |

### Work Order Status

| SimBLAH Status | I/O `status` |
|---|---|
| `open` | `open` |
| `in_progress` | `in_progress` |
| `completed` | `completed` |
| `cancelled` | `cancelled` |

## Priority Normalization

| SimBLAH `priority` | I/O `priority` |
|---|---|
| `critical` | `critical` |
| `high` | `high` |
| `medium` | `medium` |
| `low` | `low` |

SimBLAH uses the same priority vocabulary as I/O, so the mapping is 1:1.

## Criticality Normalization

| SimBLAH `criticality` | I/O `criticality` |
|---|---|
| `urgent` | `critical` |
| `high` | `high` |
| `standard` | `medium` |
| `low` | `low` |

## Sync Strategy

| Data | Interval | Watermark Column | Method | Notes |
|---|---|---|---|---|
| Tickets | 5 min | `date_opened` | Incremental | `from={watermark}` parameter. Short interval because tickets are operationally relevant |
| Work orders | 5 min | `date_opened` | Incremental | `from={watermark}` parameter. Linked to tickets |
| Device points | Daily | — | Full sync | Only 741 records; full refresh is cheap and ensures deletions are caught |

- **Initial load**: Full sync of all three endpoints. Device points first (equipment table populates `equipment_id` lookups for work orders), then tickets and work orders
- **Watermark limitation**: SimBLAH does not expose a `_rowstamp` or `updated_at` field. The `date_opened` watermark catches new records but not updates to existing records. For a demo system this is acceptable. For completeness, run a full re-sync of open/in-progress records periodically (e.g., hourly) filtered by `status=open` and `status=in_progress`
- **Pagination**: Use `per_page=100` and iterate pages. Total dataset is small (~702 tickets, ~1,344 work orders, ~741 device points)

## Pre-Built Import Definition

### Tickets

```jsonc
{
  "name": "SimBLAH Maintenance - Tickets",
  "connector_type": "rest_json",
  "source_system": "simblah_maint",
  "target_table": "tickets",
  "connection": {
    "base_url": "https://maint.simblah.in-ops.com:8444/api",
    "auth_type": "bearer_token",
    "auth_config": {
      "token": "{simblah_maint_token}"
    },
    "headers": {
      "Accept": "application/json"
    },
    "timeout_seconds": 30,
    "retry_count": 3,
    "retry_backoff_ms": 1000
  },
  "source": {
    "endpoint": "/tickets",
    "method": "GET",
    "params": {
      "from": "{watermark}",
      "per_page": 100,
      "sort": "date_opened",
      "order": "asc"
    },
    "pagination": {
      "type": "page_number",
      "page_param": "page",
      "page_size": 100
    },
    "watermark": {
      "column": "date_opened",
      "format": "iso8601",
      "initial_value": "2025-01-01T00:00:00Z"
    },
    "response_path": "data"
  },
  "field_mappings": [
    { "source": "id", "target": "external_id", "transform": "to_string" },
    { "source": null, "target": "source_system", "transform": "constant", "value": "simblah_maint" },
    { "source": "subject", "target": "title" },
    { "source": "description", "target": "description" },
    { "source": "status", "target": "status", "transform": "static_map", "map": {
      "open": "open", "in_progress": "in_progress", "on_hold": "on_hold", "closed": "closed"
    }, "default": "open" },
    { "source": "priority", "target": "priority", "transform": "static_map", "map": {
      "critical": "critical", "high": "high", "medium": "medium", "low": "low"
    }, "default": "medium" },
    { "source": "assigned_to_name", "target": "assigned_to" },
    { "source": "date_opened", "target": "created_at", "transform": "parse_datetime" },
    { "source": "due_date", "target": "due_date", "transform": "parse_datetime" },
    { "source": "date_closed", "target": "closed_at", "transform": "parse_datetime" }
  ]
}
```

### Work Orders

```jsonc
{
  "name": "SimBLAH Maintenance - Work Orders",
  "connector_type": "rest_json",
  "source_system": "simblah_maint",
  "target_table": "work_orders",
  "connection": {
    "base_url": "https://maint.simblah.in-ops.com:8444/api",
    "auth_type": "bearer_token",
    "auth_config": {
      "token": "{simblah_maint_token}"
    },
    "headers": {
      "Accept": "application/json"
    },
    "timeout_seconds": 30,
    "retry_count": 3,
    "retry_backoff_ms": 1000
  },
  "source": {
    "endpoint": "/workorders",
    "method": "GET",
    "params": {
      "from": "{watermark}",
      "per_page": 100,
      "sort": "date_opened",
      "order": "asc"
    },
    "pagination": {
      "type": "page_number",
      "page_param": "page",
      "page_size": 100
    },
    "watermark": {
      "column": "date_opened",
      "format": "iso8601",
      "initial_value": "2025-01-01T00:00:00Z"
    },
    "response_path": "data"
  },
  "field_mappings": [
    { "source": "id", "target": "external_id", "transform": "to_string" },
    { "source": null, "target": "source_system", "transform": "constant", "value": "simblah_maint" },
    { "source": "subject", "target": "title" },
    { "source": "description", "target": "description" },
    { "source": "status", "target": "status", "transform": "static_map", "map": {
      "open": "open", "in_progress": "in_progress", "completed": "completed", "cancelled": "cancelled"
    }, "default": "open" },
    { "source": "point_criticality", "target": "priority", "transform": "static_map", "map": {
      "urgent": "critical", "high": "high", "standard": "medium", "low": "low"
    }, "default": "medium" },
    { "source": "point_id", "target": "equipment_id", "transform": "lookup", "lookup_table": "equipment", "lookup_column": "external_id" },
    { "source": "assigned_to_name", "target": "assigned_to" },
    { "source": "asset", "target": "asset_tag" },
    { "source": "asset_location", "target": "location" },
    { "source": "date_opened", "target": "created_at", "transform": "parse_datetime" },
    { "source": "due_date", "target": "due_date", "transform": "parse_datetime" },
    { "source": "date_completed", "target": "completed_at", "transform": "parse_datetime" }
  ]
}
```

## Notes

### Demo System Characteristics
- **Data volume is small**: ~702 tickets, ~1,344 work orders, ~741 device points. Full syncs complete in seconds. This makes SimBLAH ideal for testing the import pipeline without worrying about pagination edge cases or timeout issues
- **Seeded historical data**: 12 months of pre-generated maintenance activity (March 2025 -- March 2026) with realistic seasonal patterns (summer peak). Work orders link to specific device points with real instrument part numbers
- **Live data generation**: The SimBLAH simulator's automated fault injection cycles generate new tickets and work orders continuously, providing a steady stream of incremental sync activity
- **No `updated_at` field**: SimBLAH does not return a last-modified timestamp on records. The watermark strategy uses `date_opened`, which only catches new records. Updates to existing records (e.g., status changes, assignment changes) require periodic full re-sync of open records

### Cross-References to OPC Tags
- SimBLAH maintenance `point_name` values (e.g., `25-TI-1115`) match the OPC UA tag namespace exactly. This allows I/O to correlate maintenance activity with live process data by joining on tag name
- The `asset` field (e.g., `R-2501`) maps to major equipment vessels and can be used to group related instruments in the I/O equipment hierarchy

### Authentication Setup
- Use the `lnovak` account (`api_access` role, password `Refinery1!`) for Bearer token access
- Tokens are managed via the SimBLAH Maintenance web UI at `https://maint.simblah.in-ops.com:8444` under Configuration → Users
- For development without nginx TLS: `http://localhost:3002/api`
