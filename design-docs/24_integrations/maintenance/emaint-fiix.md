# eMaint (Fluke Reliability) & Fiix (Rockwell Automation) — Maintenance Connector Profile

## Application Overview

This profile covers two mid-market cloud CMMS platforms commonly found in smaller refineries, terminals, and petrochemical plants. They share similar API patterns and data model complexity, so they are documented together with platform-specific differences called out.

### eMaint CMMS

- **Vendor**: Fluke Reliability (a Fortive company)
- **Product**: eMaint CMMS (SaaS-only)
- **Market Position**: Mid-market CMMS. Used by smaller refineries, terminals, and petrochemical facilities. Part of the broader Fluke Reliability suite (Prism4, eMaint, Azima vibration)
- **Licensing**: $33-$120/user/month (Team, Professional, Enterprise tiers)
- **Typical Deployment**: Cloud-only SaaS. No on-premise option. API access available on Professional and Enterprise tiers

### Fiix CMMS

- **Vendor**: Rockwell Automation (USA). Acquired Fiix in 2021
- **Product**: Fiix CMMS (SaaS-only)
- **Market Position**: Cloud CMMS growing in manufacturing and process industries due to Rockwell Automation's installed base. Newer platform with less legacy baggage than SAP/Maximo
- **Licensing**: ~$45-$75/user/month (Basic, Professional, Enterprise). API access on Professional+
- **Typical Deployment**: Cloud-only SaaS. Rockwell integration means good connectivity to Allen-Bradley PLCs (though I/O uses OPC UA for that, not Fiix)

### Combined Market Share

Together ~5-10% of refinery CMMS installations. Growing as cloud adoption increases and smaller facilities move away from spreadsheets or legacy systems.

## API Surface

### eMaint

- **Protocol**: REST/JSON
- **Base URL**: `https://api.emaint.com/v1`
- **Authentication**: API Key via `X-Api-Key` header. Keys generated in eMaint admin settings
- **Pagination**: `page` and `pageSize` query parameters. Response includes `totalCount` and `totalPages`
- **Rate Limits**: Documented. Standard REST rate limiting headers (`X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`)
- **API Documentation**: Available in eMaint admin portal (requires login). REST API guide with Swagger/OpenAPI spec

### Fiix

- **Protocol**: REST/JSON (CMMS API) and GraphQL (newer endpoints)
- **Base URL**: `https://{tenant}.fiixsoftware.com/api/v2`
- **Authentication**: OAuth 2.0 (`client_credentials` grant). Token endpoint: `https://{tenant}.fiixsoftware.com/oauth/token`. Also supports API key for simpler integrations
- **Pagination**: `offset` and `limit` query parameters. Response includes `totalCount`
- **Rate Limits**: Documented via `X-RateLimit-*` headers. Tiered by subscription level
- **API Documentation**: [Fiix Developer Portal](https://fiix.io/developers/) -- well-documented REST API with OpenAPI spec

### Key Endpoints

| Purpose | eMaint Endpoint | Fiix Endpoint |
|---|---|---|
| List work orders | `GET /workorders` | `GET /api/v2/workorders` |
| WO detail | `GET /workorders/{id}` | `GET /api/v2/workorders/{id}` |
| List assets | `GET /assets` | `GET /api/v2/assets` |
| Asset detail | `GET /assets/{id}` | `GET /api/v2/assets/{id}` |
| Parts / inventory | `GET /parts` | `GET /api/v2/parts` |
| PM schedules | `GET /scheduledmaintenance` | `GET /api/v2/scheduledmaintenance` |
| Locations | `GET /locations` | `GET /api/v2/sites` |

## Target Tables

| Table | Role | Description |
|---|---|---|
| `work_orders` | **Primary** | Work orders from either platform |
| `spare_parts` | Secondary | Parts inventory |
| `pm_schedules` | Secondary | Scheduled / preventive maintenance definitions |

## Field Mapping

### Work Orders -> `work_orders`

Both platforms use intuitive, self-documenting field names. Less transformation required than SAP or Maximo.

| eMaint Field | Fiix Field | I/O Column | Required | Transform | Notes |
|---|---|---|---|---|---|
| `workOrderNumber` | `code` | `external_id` | Yes | Direct | WO identifier |
| -- | -- | `source_system` | Yes | Constant: `"emaint"` or `"fiix"` | |
| `subject` | `description` | `title` | Yes | Direct | Short description / subject |
| `description` | `longDescription` | `description` | No | Direct | Extended description |
| `status` | `status` | `status` | Yes | `static_map` | See status normalization below |
| `priority` | `priority` | `priority` | No | `static_map` | See priority normalization below |
| `workOrderType` | `workOrderType` | `work_type` | No | `static_map` | See work type normalization below |
| `assetId` | `assetId` | `equipment_id` | No | `lookup` | FK to equipment table |
| `assignedTo` | `assignedTo` | `assigned_to` | No | Direct | User name or ID |
| `assignedGroup` | `assignedGroup` | `assigned_group` | No | Direct | Team / group name |
| `requestedBy` | `requestedBy` | `requested_by` | No | Direct | |
| `scheduledStartDate` | `suggestedStartDate` | `scheduled_start` | No | `parse_datetime` | |
| `scheduledEndDate` | `suggestedCompletionDate` | `scheduled_end` | No | `parse_datetime` | |
| `actualStartDate` | `actualStartDate` | `actual_start` | No | `parse_datetime` | |
| `completedDate` | `completedDate` | `actual_end` | No | `parse_datetime` | |
| `actualLaborHours` | `actualLaborHours` | `labor_hours` | No | Direct | |
| `partsCost` | `partsCost` | `parts_cost` | No | Direct | |
| `laborCost` | `laborCost` | `labor_cost` | No | Direct | |
| `totalCost` | `totalCost` | `total_cost` | No | Direct | |
| `failureCode` | `failureCode` | `failure_code` | No | Direct | |
| `causeCode` | `causeCode` | `cause_code` | No | Direct | |
| `remedyCode` | `actionCode` | `remedy_code` | No | Direct | Fiix calls it "actionCode" |
| `requiresPermit` | -- | `permit_required` | No | Direct | Boolean. Fiix may use custom field |
| `notes` | `comments` | `comments` | No | Direct or `map_array` | May be string or array of entries |
| Custom fields | Custom fields | `extra_data` | No | Collect unmapped | Both support custom fields |
| `createdDate` | `createdDate` | `created_at` | Yes | `parse_datetime` | |
| `modifiedDate` | `modifiedDate` | `updated_at` | Yes | `parse_datetime` | |

### Spare Parts -> `spare_parts`

| eMaint Field | Fiix Field | I/O Column | Required | Transform |
|---|---|---|---|---|
| `partNumber` | `partCode` | `external_id` | Yes | Direct |
| -- | -- | `source_system` | Yes | Constant |
| `partNumber` | `partCode` | `part_number` | Yes | Direct |
| `description` | `description` | `description` | No | Direct |
| `quantityOnHand` | `quantityOnHand` | `quantity_on_hand` | No | Direct |
| `reorderPoint` | `reorderLevel` | `reorder_point` | No | Direct |
| `unitCost` | `unitCost` | `unit_cost` | No | Direct |
| `location` | `binLocation` | `warehouse_location` | No | Direct |
| -- | -- | `equipment_ids` | No | -- | Requires where-used lookup |
| Custom fields | Custom fields | `extra_data` | No | Collect unmapped |

### PM Schedules -> `pm_schedules`

| eMaint Field | Fiix Field | I/O Column | Required | Transform |
|---|---|---|---|---|
| `scheduleId` | `id` | `external_id` | Yes | Direct |
| -- | -- | `source_system` | Yes | Constant |
| `name` | `name` | `name` | Yes | Direct |
| `description` | `description` | `description` | No | Direct |
| `assetId` | `assetId` | `equipment_id` | No | `lookup` |
| `frequencyDays` | `frequencyDays` | `frequency_days` | No | Direct |
| `lastCompletedDate` | `lastCompletedDate` | `last_completed_at` | No | `parse_datetime` |
| `nextDueDate` | `nextDueDate` | `next_due_at` | No | `parse_datetime` |
| `assignedGroup` | `assignedGroup` | `assigned_group` | No | Direct |
| Meter fields, triggers | Meter fields, triggers | `extra_data` | No | Collect all |

## Status Normalization

### eMaint

| eMaint Status | I/O `status` |
|---|---|
| `Open` | `open` |
| `In Progress` | `in_progress` |
| `On Hold` | `on_hold` |
| `Waiting for Parts` | `on_hold` |
| `Completed` | `completed` |
| `Closed` | `closed` |
| `Cancelled` | `cancelled` |
| `Requested` | `open` |

### Fiix

| Fiix Status | I/O `status` |
|---|---|
| `Open` | `open` |
| `In Progress` | `in_progress` |
| `On Hold` | `on_hold` |
| `Completed` | `completed` |
| `Closed` | `closed` |
| `Cancelled` | `cancelled` |
| `Draft` | `open` |
| `Waiting for Approval` | `open` |

Both platforms use human-readable status strings that map almost directly to I/O's normalized values. Significantly simpler than SAP's cryptic status codes or EBS's numeric status types.

## Priority Normalization

### eMaint

| eMaint Priority | I/O `priority` |
|---|---|
| `Critical` or `1` | `critical` |
| `High` or `2` | `high` |
| `Medium` or `3` | `medium` |
| `Low` or `4` | `low` |
| `None` or (blank) | `medium` (default) |

### Fiix

| Fiix Priority | I/O `priority` |
|---|---|
| `Emergency` or `1` | `critical` |
| `Urgent` or `2` | `high` |
| `High` or `3` | `high` |
| `Medium` or `4` | `medium` |
| `Low` or `5` | `low` |
| (blank) | `medium` (default) |

## Work Type Normalization

Both platforms use similar work type values:

| eMaint / Fiix Value | I/O `work_type` |
|---|---|
| `Preventive Maintenance` / `PM` | `preventive` |
| `Corrective Maintenance` / `CM` | `corrective` |
| `Emergency` / `EM` | `emergency` |
| `Inspection` | `inspection` |
| `Calibration` | `calibration` |
| `Project` | `project` |
| `Safety` | `corrective` |
| (other) | `corrective` (default) |

## Sync Strategy

| Data | Interval | Watermark Column | Method | Notes |
|---|---|---|---|---|
| Work orders | 15 min | `modifiedDate` | Incremental | `?modifiedAfter={watermark}` |
| Spare parts | Daily | `modifiedDate` | Incremental | |
| PM schedules | Daily | `modifiedDate` | Full or incremental | |

- **Initial load**: Both platforms handle full export well. Use date filter for initial scope (`?createdAfter=2022-01-01`). Typical mid-size refinery: 2,000-15,000 work orders
- **Watermark**: Both support `modifiedAfter` (or `modifiedDate` filter) as a simple ISO 8601 datetime. Straightforward incremental sync
- **Rate limit compliance**: Both return `X-RateLimit-Remaining` headers. The connector should respect these and back off when approaching limits. eMaint is typically more generous; Fiix rate limits vary by subscription tier

## Pre-Built Import Definition

### eMaint

```jsonc
{
  "name": "eMaint CMMS - Work Orders",
  "connector_type": "rest_json",
  "source_system": "emaint",
  "target_table": "work_orders",
  "connection": {
    "base_url": "https://api.emaint.com/v1",
    "auth_type": "api_key",
    "auth_config": {
      "header_name": "X-Api-Key",
      "api_key": "{emaint_api_key}"
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
      "modifiedAfter": "{watermark}",
      "pageSize": 200,
      "page": 1,
      "orderBy": "modifiedDate"
    },
    "pagination": {
      "type": "page_number",
      "page_size": 200,
      "page_param": "page",
      "total_count_path": "totalCount"
    },
    "watermark": {
      "column": "modifiedDate",
      "format": "iso8601",
      "initial_value": "2023-01-01T00:00:00Z"
    },
    "response_path": "data"
  },
  "field_mappings": [
    { "source": "workOrderNumber", "target": "external_id" },
    { "source": null, "target": "source_system", "transform": "constant", "value": "emaint" },
    { "source": "subject", "target": "title" },
    { "source": "description", "target": "description" },
    { "source": "status", "target": "status", "transform": "static_map", "map": {
      "Open": "open", "In Progress": "in_progress", "On Hold": "on_hold",
      "Waiting for Parts": "on_hold", "Completed": "completed", "Closed": "closed",
      "Cancelled": "cancelled", "Requested": "open"
    }, "default": "open" },
    { "source": "priority", "target": "priority", "transform": "static_map", "map": {
      "Critical": "critical", "1": "critical", "High": "high", "2": "high",
      "Medium": "medium", "3": "medium", "Low": "low", "4": "low"
    }, "default": "medium" },
    { "source": "workOrderType", "target": "work_type", "transform": "static_map", "map": {
      "Preventive Maintenance": "preventive", "PM": "preventive",
      "Corrective Maintenance": "corrective", "CM": "corrective",
      "Emergency": "emergency", "EM": "emergency",
      "Inspection": "inspection", "Calibration": "calibration", "Project": "project"
    }, "default": "corrective" },
    { "source": "assetId", "target": "equipment_id", "transform": "lookup", "lookup_table": "equipment", "lookup_column": "external_id" },
    { "source": "assignedTo", "target": "assigned_to" },
    { "source": "assignedGroup", "target": "assigned_group" },
    { "source": "requestedBy", "target": "requested_by" },
    { "source": "scheduledStartDate", "target": "scheduled_start", "transform": "parse_datetime" },
    { "source": "scheduledEndDate", "target": "scheduled_end", "transform": "parse_datetime" },
    { "source": "actualStartDate", "target": "actual_start", "transform": "parse_datetime" },
    { "source": "completedDate", "target": "actual_end", "transform": "parse_datetime" },
    { "source": "actualLaborHours", "target": "labor_hours" },
    { "source": "partsCost", "target": "parts_cost" },
    { "source": "laborCost", "target": "labor_cost" },
    { "source": "totalCost", "target": "total_cost" },
    { "source": "failureCode", "target": "failure_code" },
    { "source": "causeCode", "target": "cause_code" },
    { "source": "remedyCode", "target": "remedy_code" },
    { "source": "requiresPermit", "target": "permit_required" },
    { "source": "createdDate", "target": "created_at", "transform": "parse_datetime" },
    { "source": "modifiedDate", "target": "updated_at", "transform": "parse_datetime" }
  ]
}
```

### Fiix

```jsonc
{
  "name": "Fiix CMMS - Work Orders",
  "connector_type": "rest_json",
  "source_system": "fiix",
  "target_table": "work_orders",
  "connection": {
    "base_url": "https://{tenant}.fiixsoftware.com/api/v2",
    "auth_type": "oauth2_client_credentials",
    "auth_config": {
      "token_url": "https://{tenant}.fiixsoftware.com/oauth/token",
      "client_id": "{fiix_client_id}",
      "client_secret": "{fiix_client_secret}"
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
      "modifiedAfter": "{watermark}",
      "limit": 200,
      "offset": 0,
      "orderBy": "modifiedDate"
    },
    "pagination": {
      "type": "offset_limit",
      "page_size": 200
    },
    "watermark": {
      "column": "modifiedDate",
      "format": "iso8601",
      "initial_value": "2023-01-01T00:00:00Z"
    },
    "response_path": "data"
  },
  "field_mappings": [
    { "source": "code", "target": "external_id" },
    { "source": null, "target": "source_system", "transform": "constant", "value": "fiix" },
    { "source": "description", "target": "title" },
    { "source": "longDescription", "target": "description" },
    { "source": "status", "target": "status", "transform": "static_map", "map": {
      "Open": "open", "In Progress": "in_progress", "On Hold": "on_hold",
      "Completed": "completed", "Closed": "closed", "Cancelled": "cancelled",
      "Draft": "open", "Waiting for Approval": "open"
    }, "default": "open" },
    { "source": "priority", "target": "priority", "transform": "static_map", "map": {
      "Emergency": "critical", "1": "critical", "Urgent": "high", "2": "high",
      "High": "high", "3": "high", "Medium": "medium", "4": "medium",
      "Low": "low", "5": "low"
    }, "default": "medium" },
    { "source": "workOrderType", "target": "work_type", "transform": "static_map", "map": {
      "Preventive Maintenance": "preventive", "PM": "preventive",
      "Corrective Maintenance": "corrective", "CM": "corrective",
      "Emergency": "emergency", "EM": "emergency",
      "Inspection": "inspection", "Calibration": "calibration", "Project": "project"
    }, "default": "corrective" },
    { "source": "assetId", "target": "equipment_id", "transform": "lookup", "lookup_table": "equipment", "lookup_column": "external_id" },
    { "source": "assignedTo", "target": "assigned_to" },
    { "source": "assignedGroup", "target": "assigned_group" },
    { "source": "requestedBy", "target": "requested_by" },
    { "source": "suggestedStartDate", "target": "scheduled_start", "transform": "parse_datetime" },
    { "source": "suggestedCompletionDate", "target": "scheduled_end", "transform": "parse_datetime" },
    { "source": "actualStartDate", "target": "actual_start", "transform": "parse_datetime" },
    { "source": "completedDate", "target": "actual_end", "transform": "parse_datetime" },
    { "source": "actualLaborHours", "target": "labor_hours" },
    { "source": "partsCost", "target": "parts_cost" },
    { "source": "laborCost", "target": "labor_cost" },
    { "source": "totalCost", "target": "total_cost" },
    { "source": "failureCode", "target": "failure_code" },
    { "source": "causeCode", "target": "cause_code" },
    { "source": "actionCode", "target": "remedy_code" },
    { "source": "createdDate", "target": "created_at", "transform": "parse_datetime" },
    { "source": "modifiedDate", "target": "updated_at", "transform": "parse_datetime" }
  ]
}
```

## Notes

### Why These Two Together
eMaint and Fiix are the most likely "not Big 4" CMMS platforms a refinery customer would have. They share similar characteristics: cloud-only, modern REST APIs, simpler data models, intuitive field names. The integration effort for either is significantly lower than SAP, Maximo, HxGN EAM, or Oracle. If a customer mentions a cloud CMMS that isn't one of the Big 4, it's probably one of these or something very similar (e.g., Limble, MaintainX, UpKeep).

### eMaint-Specific Notes
- **Fluke Reliability ecosystem**: eMaint integrates with Fluke's vibration analysis (Azima) and infrared tools. Condition monitoring data from these tools may flow through eMaint work orders. The `extra_data` field captures this
- **Custom fields**: eMaint supports user-defined fields on work orders and assets. These appear in the API response with their configured names. Store in `extra_data`
- **Reporting API**: eMaint has a separate reporting/analytics API that can return pre-aggregated data. Not needed for I/O's raw record sync, but could be useful for KPI dashboards

### Fiix-Specific Notes
- **Rockwell integration**: Fiix has native integration with Rockwell's FactoryTalk suite. If the refinery uses Allen-Bradley PLCs, condition-based work orders may be auto-generated from PLC data. These appear as normal work orders in the API
- **GraphQL API**: Fiix is introducing GraphQL endpoints alongside REST. GraphQL could be more efficient for fetching specific field subsets. The REST API remains the primary interface for now
- **Webhooks**: Fiix supports outbound webhooks for work order status changes. Future consideration for near-real-time updates. Not needed for I/O v1 polling approach
- **Tenant isolation**: Each Fiix customer gets a tenant-specific subdomain. The base URL includes the tenant name

### Shared Characteristics
- **Simpler data models**: Both have flatter data structures than SAP or Maximo. Fewer hierarchical relationships, fewer lookup tables, fewer custom configurations. This makes integration faster and more predictable
- **Better API documentation**: Both provide modern API documentation (OpenAPI/Swagger). Less tribal knowledge needed compared to SAP BAPIs or Maximo Object Structures
- **Lower customization surface**: Fewer site-specific customizations means the default field mappings will work for a higher percentage of installations without modification
- **Rate limiting transparency**: Both provide clear rate limit headers, making it easy to build compliant polling behavior

### Prometheus Group (Not Covered)
Prometheus Group targets refineries specifically but is often used as a SAP PM overlay (planning, scheduling, turnaround management) rather than a standalone CMMS. Integration with Prometheus would typically go through SAP PM's APIs since Prometheus writes back to SAP. If a customer uses Prometheus standalone, its REST API follows similar patterns to eMaint/Fiix. Add a connector profile if customer demand emerges.
