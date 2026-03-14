# SAP Plant Maintenance (SAP PM / S/4HANA) — Maintenance Connector Profile

## Application Overview

- **Vendor**: SAP SE (Germany)
- **Product**: SAP Plant Maintenance (PM) module within SAP ECC or SAP S/4HANA Asset Management
- **Market Position**: Dominant in large refineries. ~40-50% of large refinery CMMS installations. Used by Shell, ExxonMobil, BP, Chevron, SABIC, and most major oil companies
- **Licensing**: Enterprise pricing. PM module is part of the broader S/4HANA license. On-premise: $1,500-$6,000/user + 18-22% annual maintenance. Cloud: ~$100-$300/user/month. Irrelevant to I/O -- we only call their API
- **Typical Deployment**: On-premise SAP ECC or S/4HANA with SAP Gateway exposing OData APIs. Cloud deployments via SAP S/4HANA Cloud. Refineries commonly run a mix of both during multi-year migration projects

## API Surface

- **Protocol**: OData v2 and v4 REST APIs (JSON). Legacy: SOAP/BAPI and RFC
- **Base URL**:
  - On-premise: `https://{sap_host}/sap/opu/odata/sap/` (v2) or `https://{sap_host}/sap/opu/odata4/sap/` (v4)
  - Cloud: `https://{tenant}.s4hana.cloud.sap/sap/opu/odata4/sap/`
- **Authentication**:
  - Cloud: OAuth 2.0 (`client_credentials` grant)
  - On-premise: Basic Auth or X.509 client certificates
  - CSRF token required for all write operations (`X-CSRF-Token: Fetch` on GET, pass returned token on POST/PUT/DELETE)
- **Pagination**: OData `$top` / `$skip` server-side paging. Some systems cap at 5,000 records per request
- **Rate Limits**: Configurable at the SAP Gateway level. Cloud editions have built-in rate limiting
- **API Documentation**: [SAP API Business Hub](https://api.sap.com/package/S4HANAOPAPI/odata), [Maintenance Order OData API](https://help.sap.com/docs/SAP_S4HANA_ON-PREMISE/f296651f454c4284ade361292c633d69/abbd23f555bb482f9d2b3a838fa8ab6b.html)

### Key OData Services

| Service | Entity Set | Purpose |
|---|---|---|
| `API_MAINTORDER` | `MaintenanceOrder` | Work order CRUD |
| `API_EQUIPMENT` | `Equipment` | Equipment master records |
| `API_FUNCNLLOC` | `FunctionalLocation` | Functional location hierarchy |
| `API_MEASURINGPOINT` | `MeasuringPoint` | Measuring points (maps to I/O points) |
| `MaintenanceNotificationService` | `MaintenanceNotification` | Notifications (header, items, causes) |
| `API_BOM_HEADERS` | `BOMHeader` | Bills of material for equipment |

## Target Tables

| Table | Role | Description |
|---|---|---|
| `work_orders` | **Primary** | Maintenance orders mapped from `API_MAINTORDER` |
| `spare_parts` | Secondary | BOM components from `API_BOM_HEADERS` |
| `pm_schedules` | Secondary | Maintenance plans (requires custom OData service or BAPI) |

## Field Mapping

### Work Orders: `API_MAINTORDER/MaintenanceOrder` -> `work_orders`

| SAP Field | I/O Column | Required | Transform | Notes |
|---|---|---|---|---|
| `MaintenanceOrder` | `external_id` | Yes | Direct | SAP order number (e.g., "000004001234") |
| -- | `source_system` | Yes | Constant: `"sap_pm"` | |
| `MaintenanceOrderDesc` | `title` | Yes | Direct | Short text (40 chars in ECC, 80 in S/4) |
| `LongText` | `description` | No | Separate API call | Requires `API_MAINTORDER/MaintenanceOrderLongText` or `/LongText` navigation property |
| `MaintOrderProcessingStatus` | `status` | Yes | `static_map` | See status normalization below |
| `MaintenancePriority` | `priority` | No | `static_map` | See priority normalization below |
| `OrderType` | `work_type` | No | `static_map` | See work type normalization below |
| `Equipment` | `equipment_id` | No | `lookup`: match `equipment.external_id` | FK to equipment table |
| `FunctionalLocation` | -- | No | Stored in `extra_data` | Functional location code |
| `PersonResponsible` | `assigned_to` | No | Direct | SAP user ID (may need HR lookup for display name) |
| `MainWorkCenter` | `assigned_group` | No | Direct | Work center code |
| `CreatedByUser` | `requested_by` | No | Direct | |
| `MaintOrdBasicStartDate` | `scheduled_start` | No | `parse_date`: `yyyy-MM-dd` | |
| `MaintOrdBasicEndDate` | `scheduled_end` | No | `parse_date`: `yyyy-MM-dd` | |
| `ActualStartDate` | `actual_start` | No | `parse_date` | Populated when work begins |
| `TechnicalCompletionDate` | `actual_end` | No | `parse_date` | Set when TECO status reached |
| `ActualWorkInMinutes` | `labor_hours` | No | `expression`: `value / 60.0` | SAP stores minutes, I/O stores hours |
| `TotalActualCosts` | `total_cost` | No | Direct | May require `$expand=MaintenanceOrderCost` |
| -- | `parts_cost` | No | -- | Requires cost breakdown from operations |
| -- | `labor_cost` | No | -- | Requires cost breakdown from operations |
| `CatalogProfile` + failure fields | `failure_code` | No | Concatenate | SAP uses catalog profiles with code groups |
| `CauseCode` (from notification) | `cause_code` | No | Direct | Linked via `MaintenanceNotification` |
| `DamageCode` (from notification) | `remedy_code` | No | Direct | |
| `Permit` (user status) | `permit_required` | No | `expression`: `value != null` | SAP uses user statuses for permits |
| `MaintenanceOrderLongText` | `comments` | No | Direct | |
| Z-fields, custom statuses | `extra_data` | No | Collect all unmapped | Site-specific custom fields |
| `CreationDate` | `created_at` | Yes | `parse_datetime` | |
| `LastChangeDateTime` | `updated_at` | Yes | `parse_datetime` | OData DateTimeOffset format |

### Spare Parts: `API_BOM_HEADERS` -> `spare_parts`

| SAP Field | I/O Column | Required | Transform | Notes |
|---|---|---|---|---|
| `BillOfMaterialComponent` | `external_id` | Yes | Direct | BOM item ID |
| -- | `source_system` | Yes | Constant: `"sap_pm"` | |
| `Material` | `part_number` | Yes | Direct | SAP material number |
| `BillOfMaterialItemText` | `description` | No | Direct | |
| `BillOfMaterialItemQuantity` | `quantity_on_hand` | No | Direct | Requires inventory lookup for actual stock |
| -- | `reorder_point` | No | -- | From material master (separate API) |
| `StandardPrice` | `unit_cost` | No | Direct | From material valuation |
| `StorageLocation` | `warehouse_location` | No | Direct | |
| `Equipment` (parent BOM) | `equipment_ids` | No | Array wrap | Equipment this BOM belongs to |
| Z-fields | `extra_data` | No | Collect unmapped | |

### PM Schedules: Maintenance Plan -> `pm_schedules`

SAP maintenance plans are not fully exposed via standard OData in all versions. May require a custom CDS view or BAPI wrapper.

| SAP Field | I/O Column | Required | Transform | Notes |
|---|---|---|---|---|
| `MaintenancePlan` | `external_id` | Yes | Direct | Plan number |
| -- | `source_system` | Yes | Constant: `"sap_pm"` | |
| `MaintenancePlanDesc` | `name` | Yes | Direct | |
| `MaintenancePlanText` | `description` | No | Direct | |
| `Equipment` (from task list) | `equipment_id` | No | `lookup` | FK to equipment |
| `CycleLength` | `frequency_days` | No | Convert from plan cycle unit | Unit may be days, weeks, months |
| `LastCompletedDate` | `last_completed_at` | No | `parse_date` | |
| `PlannedDate` (next call) | `next_due_at` | No | `parse_date` | |
| `MainWorkCenter` | `assigned_group` | No | Direct | |
| Cycle unit, strategy, counters | `extra_data` | No | Collect all | SAP maintenance strategies can be complex |

## Status Normalization

| SAP System Status | SAP Description | I/O `status` |
|---|---|---|
| `CRTD` | Created | `open` |
| `REL` | Released | `open` |
| `PRC` | Partially Confirmed | `in_progress` |
| `CNF` | Confirmed | `in_progress` |
| `PCNF` | Partially Confirmed | `in_progress` |
| `TECO` | Technically Complete | `completed` |
| `CLSD` | Closed / Business Complete | `closed` |
| `DLT` | Deletion Flag | `cancelled` |
| `MANC` | Material Availability Not Checked | `open` |
| `MAC` | Material Availability Checked | `open` |

**User statuses**: SAP installations commonly define custom user statuses for `on_hold` (e.g., "HOLD", "WMTL" for waiting on material, "WPER" for waiting on permit). These must be mapped per site. The import definition includes an `extra_status_map` field in `extra_data` for site-specific overrides.

## Priority Normalization

| SAP `MaintenancePriority` | SAP Meaning (typical) | I/O `priority` |
|---|---|---|
| `1` | Emergency / Very High | `critical` |
| `2` | Urgent / High | `high` |
| `3` | Normal / Medium | `medium` |
| `4` | Low | `low` |
| (blank) | Not assigned | `medium` (default) |

## Work Type Normalization

| SAP `OrderType` | SAP Meaning (typical) | I/O `work_type` |
|---|---|---|
| `PM01` | Corrective Maintenance | `corrective` |
| `PM02` | Preventive Maintenance | `preventive` |
| `PM03` | Calibration | `calibration` |
| `PM04` | Refurbishment | `corrective` |
| `PM05` | Investment / Project | `project` |
| `PM06` | Inspection | `inspection` |
| `PM07` | Modification | `modification` |
| `PM10` | Emergency | `emergency` |

**Note**: Order types are configurable per SAP installation. The above are the SAP standard defaults. Site-specific order types are common and must be mapped during import configuration.

## Sync Strategy

| Data | Interval | Watermark Column | Method | Notes |
|---|---|---|---|---|
| Work orders | 15 min | `LastChangeDateTime` | Incremental | `$filter=LastChangeDateTime gt datetime'{watermark}'` |
| Spare parts | Daily | `LastChangeDateTime` | Incremental | Material master changes infrequently |
| PM schedules | Daily | `LastChangeDateTime` | Full or incremental | Maintenance plans change rarely |

- **Initial load**: Full sync with `$top=1000` paging. Expect 10,000-50,000 historical work orders in a typical refinery. Use `$filter` to limit to last 2-3 years for initial import, then backfill if needed
- **OData v2 datetime format**: `datetime'2024-01-15T00:00:00'` (no timezone). OData v4 uses ISO 8601 with timezone
- **Batch requests**: SAP supports OData `$batch` to combine multiple queries into a single HTTP request. Use for related entity expansion

## Pre-Built Import Definition

```jsonc
{
  "name": "SAP PM - Work Orders",
  "connector_type": "rest_json",
  "source_system": "sap_pm",
  "target_table": "work_orders",
  "connection": {
    "base_url": "https://{sap_host}/sap/opu/odata/sap/API_MAINTORDER",
    "auth_type": "basic_auth",
    "auth_config": {
      "username": "{sap_user}",
      "password": "{sap_password}"
    },
    "headers": {
      "Accept": "application/json",
      "sap-client": "{client_number}"
    },
    "csrf_token": true,
    "timeout_seconds": 60,
    "retry_count": 3,
    "retry_backoff_ms": 2000
  },
  "source": {
    "endpoint": "/MaintenanceOrder",
    "method": "GET",
    "params": {
      "$filter": "LastChangeDateTime gt datetime'{watermark}'",
      "$select": "MaintenanceOrder,MaintenanceOrderDesc,MaintOrderProcessingStatus,MaintenancePriority,OrderType,Equipment,FunctionalLocation,PersonResponsible,MainWorkCenter,CreatedByUser,MaintOrdBasicStartDate,MaintOrdBasicEndDate,ActualStartDate,TechnicalCompletionDate,ActualWorkInMinutes,TotalActualCosts,CreationDate,LastChangeDateTime",
      "$top": 1000,
      "$orderby": "LastChangeDateTime asc",
      "$inlinecount": "allpages"
    },
    "pagination": {
      "type": "odata_skip",
      "page_size": 1000
    },
    "watermark": {
      "column": "LastChangeDateTime",
      "format": "odata_datetime",
      "initial_value": "2023-01-01T00:00:00"
    }
  },
  "field_mappings": [
    { "source": "MaintenanceOrder", "target": "external_id" },
    { "source": null, "target": "source_system", "transform": "constant", "value": "sap_pm" },
    { "source": "MaintenanceOrderDesc", "target": "title" },
    { "source": "MaintOrderProcessingStatus", "target": "status", "transform": "static_map", "map": {
      "CRTD": "open", "REL": "open", "PRC": "in_progress", "CNF": "in_progress",
      "PCNF": "in_progress", "TECO": "completed", "CLSD": "closed", "DLT": "cancelled",
      "MANC": "open", "MAC": "open"
    }, "default": "open" },
    { "source": "MaintenancePriority", "target": "priority", "transform": "static_map", "map": {
      "1": "critical", "2": "high", "3": "medium", "4": "low"
    }, "default": "medium" },
    { "source": "OrderType", "target": "work_type", "transform": "static_map", "map": {
      "PM01": "corrective", "PM02": "preventive", "PM03": "calibration", "PM04": "corrective",
      "PM05": "project", "PM06": "inspection", "PM07": "modification", "PM10": "emergency"
    }, "default": "corrective" },
    { "source": "Equipment", "target": "equipment_id", "transform": "lookup", "lookup_table": "equipment", "lookup_column": "external_id" },
    { "source": "PersonResponsible", "target": "assigned_to" },
    { "source": "MainWorkCenter", "target": "assigned_group" },
    { "source": "CreatedByUser", "target": "requested_by" },
    { "source": "MaintOrdBasicStartDate", "target": "scheduled_start", "transform": "parse_date" },
    { "source": "MaintOrdBasicEndDate", "target": "scheduled_end", "transform": "parse_date" },
    { "source": "ActualStartDate", "target": "actual_start", "transform": "parse_date" },
    { "source": "TechnicalCompletionDate", "target": "actual_end", "transform": "parse_date" },
    { "source": "ActualWorkInMinutes", "target": "labor_hours", "transform": "expression", "expression": "value / 60.0" },
    { "source": "TotalActualCosts", "target": "total_cost" },
    { "source": "CreationDate", "target": "created_at", "transform": "parse_datetime" },
    { "source": "LastChangeDateTime", "target": "updated_at", "transform": "parse_datetime" }
  ]
}
```

## Notes

### Version Differences
- **ECC 6.0**: OData APIs may not be available without explicit SAP Gateway activation. BAPIs (`BAPI_ALM_ORDER_GET_DETAIL`) are the fallback. SOAP wrapper via SOA Manager
- **S/4HANA 1909-2023**: Full OData v2 support via `API_MAINTORDER`. V4 services emerging
- **S/4HANA 2024+**: OData v4 preferred. V2 services still functional but SAP is pushing migration. `API_MAINTORDER` v4 entity names may differ slightly
- **Cloud vs On-premise**: Cloud enforces OAuth 2.0. On-premise typically uses Basic Auth. Cloud has stricter rate limits but better API reliability

### Common Quirks
- **CSRF tokens**: Required for any write operation. Fetch via `GET` with `X-CSRF-Token: Fetch` header, then pass the returned token on subsequent `POST`/`PUT`/`DELETE`. Tokens expire with the HTTP session
- **Long text retrieval**: Work order descriptions beyond the 40/80-char short text require a separate API call to `MaintenanceOrderLongText` or the `$expand=to_LongText` navigation property. Not all SAP systems expose long text via OData
- **Z-fields (custom fields)**: Extremely common in refinery SAP installations. Z-fields won't appear in the standard API documentation. They may be exposed via CDS view extensions or require a custom OData service. Store in `extra_data` JSONB
- **Date handling**: OData v2 uses `datetime'yyyy-MM-ddTHH:mm:ss'` (no timezone). OData v4 uses ISO 8601 `DateTimeOffset`. The connector must handle both
- **User status vs system status**: SAP has two status layers. System statuses (CRTD, REL, TECO, CLSD) are standard. User statuses are site-specific and may represent states like "Waiting for Material", "Waiting for Permit", or "On Hold". The status mapping must be configurable per installation
- **Large result sets**: Without `$filter` and `$select`, SAP Gateway can be very slow. Always specify both. Use `$top` / `$skip` for paging, but be aware that `$skip` on large datasets can degrade performance -- prefer `$filter` by `LastChangeDateTime` for incremental sync
- **SAP client number**: On-premise SAP systems have multiple clients (e.g., 100=development, 200=QA, 300=production). The `sap-client` header must match the target environment

### Alternative Integration Paths
- **SAP Integration Suite (CPI/BTP)**: If the customer has SAP BTP, they may prefer to expose data through Integration Suite rather than direct OData calls. This adds an intermediary but simplifies authentication and monitoring
- **RFC/BAPI via middleware**: Some integrations use SAP .NET Connector or JCo for direct RFC calls. Not recommended for I/O -- OData is sufficient for read-only sync
- **Database direct**: Not recommended. SAP's database schema is heavily normalized and undocumented. Direct SQL against SAP tables is unsupported and fragile
