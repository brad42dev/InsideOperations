# HxGN EAM (Hexagon / formerly Infor EAM) — Maintenance Connector Profile

## Application Overview

- **Vendor**: Hexagon AB (Sweden). Acquired Infor EAM in 2022
- **Product**: HxGN EAM (Enterprise Asset Management), version 12.x. Formerly Infor EAM, formerly Datastream MP2/7i
- **Market Position**: ~10-15% of refinery CMMS installations. Strong in mid-to-large refineries, especially those not on SAP. Popular in utilities, mining, and oil & gas. 30+ year heritage. Used by CERN (good open-source reference material available)
- **Licensing**: Subscription-based, mid-market pricing. ~$50-$150/user/month for cloud. Significantly less expensive than SAP or Maximo
- **Typical Deployment**: On-premise (Java/Oracle or SQL Server stack) or cloud via Infor CloudSuite. Cloud deployments route through Infor ION API gateway. On-premise can be accessed directly

## API Surface

- **Protocol**: REST/JSON (OpenAPI 3 spec with Swagger UI) and SOAP/XML web services
- **Base URL**:
  - On-premise REST: `https://{eam_host}/apis/rest/`
  - On-premise SOAP: `https://{eam_host}/axis/services/EWS/`
  - Cloud (via ION): `https://{tenant}.inforcloudsuite.com/EAM/apis/rest/`
- **Authentication**:
  - **API Key** (recommended): Generated via Application Configuration in EAM. Requires Connector license on the user. Key expiration controlled by `APIKEXPD` install parameter
  - **Bearer Token (JWT)**: Standard JWT auth
  - **Basic Auth**: Supported on-premise
  - **Infor ION (cloud)**: OAuth 2.0 (`client_credentials`, `resource_owner`, `authorization_code`, `implicit` grants) via ION API gateway
- **Pagination**: Standard `offset` / `limit` query parameters
- **Rate Limits**: Not explicitly documented. ION gateway may impose limits on cloud deployments
- **API Documentation**: [HxGN EAM REST Web Services](https://docs.hexagonppm.com/r/en-US/HxGN-EAM-Rest-Web-Services/1264213), [API Key Management](https://docs.hexagonppm.com/r/en-US/HxGN-EAM-Integration-Configuration/12.1/1354756). CERN publishes helpful reference: [CERN EAM Web Services Swagger](https://eamws.docs.cern.ch/web_services/rest/swagger.html)

### Key REST Endpoints

| Endpoint | Purpose |
|---|---|
| `GET /apis/rest/workorders` | Work order list and search |
| `GET /apis/rest/workorders/{wo_number}` | Work order detail |
| `GET /apis/rest/workorders/{wo_number}/activities` | WO activities / labor bookings |
| `GET /apis/rest/equipment` | Equipment list and search |
| `GET /apis/rest/equipment/{equipment_code}` | Equipment detail |
| `GET /apis/rest/parts` | Parts catalog |
| `GET /apis/rest/parts/{part_number}` | Part detail |
| `GET /apis/rest/issuereturn` | Parts transactions (issues and returns) |
| `GET /apis/rest/pmschedules` | Preventive maintenance schedules |
| `GET /apis/rest/comments` | Notes / attachments on entities |

## Target Tables

| Table | Role | Description |
|---|---|---|
| `work_orders` | **Primary** | Work orders from `/workorders` |
| `spare_parts` | Secondary | Parts inventory from `/parts` |
| `pm_schedules` | Secondary | PM definitions from `/pmschedules` |

## Field Mapping

### Work Orders: `/workorders` -> `work_orders`

| HxGN EAM Field | I/O Column | Required | Transform | Notes |
|---|---|---|---|---|
| `wo_number` | `external_id` | Yes | Direct | Work order number |
| -- | `source_system` | Yes | Constant: `"hxgn_eam"` | |
| `wo_description` | `title` | Yes | Direct | Short description |
| `wo_long_description` | `description` | No | Direct | Extended description text |
| `wo_statuscode` | `status` | Yes | `static_map` | See status normalization below |
| `wo_priority` | `priority` | No | `static_map` | See priority normalization below |
| `wo_type` | `work_type` | No | `static_map` | See work type normalization below |
| `equipment_code` | `equipment_id` | No | `lookup`: match `equipment.external_id` | FK to equipment table |
| `location_code` | -- | No | Stored in `extra_data` | Functional location |
| `assigned_to` | `assigned_to` | No | Direct | Assigned person |
| `department` | `assigned_group` | No | Direct | HxGN uses "department" where others use "work group" |
| `reported_by` | `requested_by` | No | Direct | |
| `scheduled_start_date` | `scheduled_start` | No | `parse_datetime` | |
| `scheduled_end_date` | `scheduled_end` | No | `parse_datetime` | |
| `actual_start_date` | `actual_start` | No | `parse_datetime` | |
| `completed_date` | `actual_end` | No | `parse_datetime` | |
| `total_labor_hours` | `labor_hours` | No | Direct | Rolled up from activities |
| `total_material_cost` | `parts_cost` | No | Direct | |
| `total_labor_cost` | `labor_cost` | No | Direct | |
| `total_cost` | `total_cost` | No | Direct | Sum of all cost categories |
| `failure_code` | `failure_code` | No | Direct | |
| `cause_code` | `cause_code` | No | Direct | |
| `action_code` | `remedy_code` | No | Direct | HxGN calls it "action code" |
| `permit_required` | `permit_required` | No | `expression`: `value == "Y"` | "Y"/"N" flag |
| `wo_comments` | `comments` | No | Direct | May require separate `/comments` call |
| Custom fields, class codes | `extra_data` | No | Collect unmapped | |
| `created_date` | `created_at` | Yes | `parse_datetime` | |
| `last_updated` | `updated_at` | Yes | `parse_datetime` | |

### Spare Parts: `/parts` -> `spare_parts`

| HxGN EAM Field | I/O Column | Required | Transform | Notes |
|---|---|---|---|---|
| `part_code` | `external_id` | Yes | Direct | Part identifier |
| -- | `source_system` | Yes | Constant: `"hxgn_eam"` | |
| `part_code` | `part_number` | Yes | Direct | |
| `part_description` | `description` | No | Direct | |
| `qty_on_hand` | `quantity_on_hand` | No | Direct | Current stock level |
| `reorder_point` | `reorder_point` | No | Direct | |
| `average_cost` | `unit_cost` | No | Direct | |
| `store` + `bin` | `warehouse_location` | No | `expression`: `store + '/' + bin` | Store and bin location |
| -- | `equipment_ids` | No | -- | Requires where-used query |
| UOM, commodity, class | `extra_data` | No | Collect unmapped | |

### PM Schedules: `/pmschedules` -> `pm_schedules`

| HxGN EAM Field | I/O Column | Required | Transform | Notes |
|---|---|---|---|---|
| `pm_code` | `external_id` | Yes | Direct | PM schedule identifier |
| -- | `source_system` | Yes | Constant: `"hxgn_eam"` | |
| `pm_description` | `name` | Yes | Direct | |
| `pm_long_description` | `description` | No | Direct | |
| `equipment_code` | `equipment_id` | No | `lookup` | FK to equipment |
| `frequency` | `frequency_days` | No | Convert based on `frequency_uom` | May be days, weeks, months |
| `last_done_date` | `last_completed_at` | No | `parse_datetime` | |
| `next_due_date` | `next_due_at` | No | `parse_datetime` | |
| `department` | `assigned_group` | No | Direct | |
| Meter-based fields, route info | `extra_data` | No | Collect all | |

## Status Normalization

| HxGN EAM Status | Description | I/O `status` |
|---|---|---|
| `R` | Requested | `open` |
| `A` | Approved | `open` |
| `O` | Open / Active | `in_progress` |
| `H` | On Hold | `on_hold` |
| `C` | Completed | `completed` |
| `CL` | Closed | `closed` |
| `X` | Cancelled | `cancelled` |
| `P` | Planned | `open` |
| `S` | Scheduled | `open` |

**Note**: HxGN EAM status codes are single letters (or two for CL), making them the most concise of the major CMMS systems. Custom statuses are possible but less common than in SAP or Maximo.

## Priority Normalization

| HxGN EAM `wo_priority` | Typical Meaning | I/O `priority` |
|---|---|---|
| `*` or `H` | Highest / Emergency | `critical` |
| `1` | High | `high` |
| `2` | Medium | `medium` |
| `3` | Low | `low` |
| (blank) | Not assigned | `medium` (default) |

**Note**: Priority codes in HxGN EAM are configurable. Some installations use numeric (1-5), others use letter codes. Map must be configured per site.

## Work Type Normalization

| HxGN EAM `wo_type` | Meaning | I/O `work_type` |
|---|---|---|
| `PM` | Preventive Maintenance | `preventive` |
| `CM` | Corrective Maintenance | `corrective` |
| `EM` | Emergency | `emergency` |
| `IN` | Inspection | `inspection` |
| `CA` | Calibration | `calibration` |
| `PR` | Project | `project` |
| `MO` | Modification | `modification` |
| (other) | Unspecified | `corrective` (default) |

## Sync Strategy

| Data | Interval | Watermark Column | Method | Notes |
|---|---|---|---|---|
| Work orders | 15 min | `last_updated` | Incremental | `?modified_after={watermark}` |
| Spare parts | Daily | `last_updated` | Incremental | Parts catalog changes infrequently |
| PM schedules | Daily | `last_updated` | Full or incremental | PM definitions change rarely |

- **Initial load**: Full sync with pagination (`offset=0&limit=500`). Typical refinery: 5,000-30,000 work orders. Filter by `created_date` to limit initial scope
- **`modified_after` parameter**: ISO 8601 datetime. This is the primary watermark mechanism -- simpler than SAP's OData filter syntax or Maximo's `_rowstamp`
- **Cloud via ION**: Responses may include ION-specific envelope fields. Parse the actual data payload from within the ION response structure

## Pre-Built Import Definition

```jsonc
{
  "name": "HxGN EAM - Work Orders",
  "connector_type": "rest_json",
  "source_system": "hxgn_eam",
  "target_table": "work_orders",
  "connection": {
    "base_url": "https://{eam_host}/apis/rest",
    "auth_type": "api_key",
    "auth_config": {
      "header_name": "Authorization",
      "api_key_prefix": "Bearer",
      "api_key": "{eam_api_key}"
    },
    "headers": {
      "Accept": "application/json"
    },
    "timeout_seconds": 60,
    "retry_count": 3,
    "retry_backoff_ms": 2000
  },
  "source": {
    "endpoint": "/workorders",
    "method": "GET",
    "params": {
      "modified_after": "{watermark}",
      "limit": 500,
      "offset": 0
    },
    "pagination": {
      "type": "offset_limit",
      "page_size": 500
    },
    "watermark": {
      "column": "last_updated",
      "format": "iso8601",
      "initial_value": "2023-01-01T00:00:00Z"
    }
  },
  "field_mappings": [
    { "source": "wo_number", "target": "external_id" },
    { "source": null, "target": "source_system", "transform": "constant", "value": "hxgn_eam" },
    { "source": "wo_description", "target": "title" },
    { "source": "wo_long_description", "target": "description" },
    { "source": "wo_statuscode", "target": "status", "transform": "static_map", "map": {
      "R": "open", "A": "open", "O": "in_progress", "H": "on_hold",
      "C": "completed", "CL": "closed", "X": "cancelled", "P": "open", "S": "open"
    }, "default": "open" },
    { "source": "wo_priority", "target": "priority", "transform": "static_map", "map": {
      "*": "critical", "H": "critical", "1": "high", "2": "medium", "3": "low"
    }, "default": "medium" },
    { "source": "wo_type", "target": "work_type", "transform": "static_map", "map": {
      "PM": "preventive", "CM": "corrective", "EM": "emergency", "IN": "inspection",
      "CA": "calibration", "PR": "project", "MO": "modification"
    }, "default": "corrective" },
    { "source": "equipment_code", "target": "equipment_id", "transform": "lookup", "lookup_table": "equipment", "lookup_column": "external_id" },
    { "source": "assigned_to", "target": "assigned_to" },
    { "source": "department", "target": "assigned_group" },
    { "source": "reported_by", "target": "requested_by" },
    { "source": "scheduled_start_date", "target": "scheduled_start", "transform": "parse_datetime" },
    { "source": "scheduled_end_date", "target": "scheduled_end", "transform": "parse_datetime" },
    { "source": "actual_start_date", "target": "actual_start", "transform": "parse_datetime" },
    { "source": "completed_date", "target": "actual_end", "transform": "parse_datetime" },
    { "source": "total_labor_hours", "target": "labor_hours" },
    { "source": "total_material_cost", "target": "parts_cost" },
    { "source": "total_labor_cost", "target": "labor_cost" },
    { "source": "total_cost", "target": "total_cost" },
    { "source": "failure_code", "target": "failure_code" },
    { "source": "cause_code", "target": "cause_code" },
    { "source": "action_code", "target": "remedy_code" },
    { "source": "permit_required", "target": "permit_required", "transform": "expression", "expression": "value == 'Y'" },
    { "source": "created_date", "target": "created_at", "transform": "parse_datetime" },
    { "source": "last_updated", "target": "updated_at", "transform": "parse_datetime" }
  ]
}
```

## Notes

### Version Differences
- **Infor EAM 11.x (pre-Hexagon)**: SOAP web services primary. REST API may be limited or absent. Use SOAP connector type with XML parsing
- **HxGN EAM 12.0-12.2**: Full REST API with OpenAPI 3 spec and Swagger UI. Both SOAP and REST supported
- **HxGN EAM 12.3 (Nov 2025)**: Latest version. Verify endpoint compatibility -- field names may have minor changes from 12.0
- **Cloud (Infor CloudSuite)**: All API calls route through Infor ION API gateway. This adds OAuth 2.0 authentication, rate limiting, and request logging. The base URL changes and responses may be wrapped in ION envelope

### Common Quirks
- **Documentation migration**: Historical documentation was under Infor's documentation portal. Hexagon is migrating to their own docs site (docs.hexagonppm.com). Links to old Infor docs may break. Bookmark the Hexagon versions
- **CERN as reference**: CERN publishes open-source EAM web service client components on GitHub ([cern-eam/eam-light](https://github.com/cern-eam/eam-light)). Valuable reference for understanding the API structure and field names, though CERN's customizations may not match a refinery installation
- **Infor ION gateway (cloud)**: Adds a layer of complexity. Authentication goes through ION's OAuth 2.0 flow, not directly to EAM. The ION API SDK ([infor-cloud/ion-api-sdk](https://github.com/infor-cloud/ion-api-sdk)) provides reference implementations
- **Department vs work group**: HxGN EAM uses "department" for what SAP calls "work center" and Maximo calls "crew". The mapping is straightforward but the terminology difference can cause confusion during configuration
- **SOAP fallback**: For older installations or features not yet exposed via REST, SOAP web services remain available. The WSDL at `/axis/services/EWS?wsdl` documents all available operations. SOAP is more complete than REST in some areas (e.g., complex multi-record updates)
- **Connector license**: API key generation in HxGN EAM requires the user to have a "Connector" license type. Regular user licenses cannot generate API keys. Ensure the customer provisions the correct license type
- **Custom fields via class codes**: HxGN EAM uses "class codes" and "class attributes" for custom fields on work orders and equipment. These are exposed via the API but require knowledge of the site's class code configuration. Store in `extra_data`
- **Databridge Pro**: Hexagon's own data integration module (powered by Apache NiFi). Irrelevant to I/O -- we use our own Import Service. But if a customer already has Databridge Pro, they may want to push data to I/O rather than having I/O pull. Future consideration for webhook endpoints

### Alternative Integration Paths
- **Infor ION + BODs**: Infor's integration framework uses Business Object Documents (BODs) in OAGIS/XML format for event-driven integration. If the customer is already on Infor CloudSuite, BOD-based push integration could be an option. Not recommended for I/O v1
- **Database direct**: HxGN EAM uses Oracle or SQL Server. Database schema is reasonably documented. Direct SQL could be faster for bulk reads but bypasses application logic. Not recommended
- **Databridge Pro push**: If the customer has Databridge Pro, they could configure NiFi flows to push data to an I/O webhook endpoint. Future consideration
