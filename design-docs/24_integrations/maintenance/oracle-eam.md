# Oracle Enterprise Asset Management (Oracle eAM) — Maintenance Connector Profile

## Application Overview

- **Vendor**: Oracle Corporation (USA)
- **Product**: Oracle eAM -- exists in two distinct forms:
  - **Oracle E-Business Suite (EBS) eAM**: Legacy on-premise module within Oracle ERP. PL/SQL-based, SOAP APIs
  - **Oracle Fusion Cloud Maintenance (SCM Cloud)**: Modern cloud SaaS with REST APIs. Part of Oracle Supply Chain Management Cloud
- **Market Position**: ~5-10% of refinery CMMS installations. Common in refineries already running Oracle EBS or Fusion Cloud as their ERP. Less standalone market share than SAP or Maximo
- **Licensing**: EBS: perpetual license + annual maintenance. Fusion Cloud: subscription ~$200-$500/user/month (part of broader SCM Cloud). eAM is not sold standalone -- it's a module within the Oracle ERP
- **Typical Deployment**: Many refineries are still on EBS (on-premise). Active migration to Fusion Cloud is underway across the industry but will take years. Expect to encounter both platforms in the field. Some sites run both during transition

## API Surface

### Fusion Cloud (Modern)

- **Protocol**: REST/JSON
- **Base URL**: `https://{oracle_host}/fscmRestApi/resources/11.13.18.05/`
- **Authentication**: OAuth 2.0 (`client_credentials` or JWT assertion via Oracle Identity Cloud Service / IDCS). Basic Auth also supported
- **Pagination**: Standard `offset` / `limit` query parameters. `?q=` filter syntax
- **Rate Limits**: Oracle Cloud has built-in rate limiting. Varies by subscription tier
- **API Documentation**: [Oracle Fusion Cloud SCM - Maintenance Work Orders](https://docs.oracle.com/en/cloud/saas/supply-chain-and-manufacturing/26a/fasrp/api-maintenance-maintenance-work-orders.html)

### EBS (Legacy)

- **Protocol**: SOAP/XML web services. PL/SQL APIs exposed via SOA Manager
- **Base URL**: `https://{ebs_host}/webservices/SOAProvider/plsql/`
- **Authentication**: Basic Auth or Oracle token-based
- **Key APIs**: `EAM_PROCESS_WO_PUB.Process_WO`, `EAM_PROCESS_WO_PUB.Process_Master_Child_WO`
- **Note**: EBS SOAP APIs are designed primarily for write operations and are inefficient for bulk reads. For read-heavy integration (which is what I/O needs), direct database queries against EAM tables are often more practical

### Key API Calls (Fusion Cloud)

| Purpose | Endpoint | Method | Notes |
|---|---|---|---|
| List work orders | `GET /maintenanceWorkOrders?q=LastUpdateDate>{watermark}` | GET | Incremental by LastUpdateDate |
| WO detail | `GET /maintenanceWorkOrders/{WorkOrderId}` | GET | Full work order record |
| WO route assets | `GET /maintenanceWorkOrders/{id}/child/RouteAssets` | GET | Assets associated with WO |
| Service history | `GET /maintenanceWorkOrderServiceHistories` | GET | Historical service records |
| Parts requirements | `GET /partRequirementLines` | GET | Parts needed for WOs |
| Assets | `GET /installedBaseAssets` | GET | Asset / equipment registry |
| Fixed asset links | `GET /fixedAssetAssociations` | GET | Financial asset associations |

### Key API Calls (EBS)

| Purpose | API | Notes |
|---|---|---|
| Work order CRUD | `EAM_PROCESS_WO_PUB.Process_WO` | SOAP. Primarily for writes |
| WO with children | `EAM_PROCESS_WO_PUB.Process_Master_Child_WO` | Parent-child WO hierarchy |
| Bulk read | Direct SQL against `WIP_DISCRETE_JOBS`, `WIP_ENTITIES`, `EAM_WORK_ORDERS` | More practical for I/O's read-only sync |

## Target Tables

| Table | Role | Description |
|---|---|---|
| `work_orders` | **Primary** | Maintenance work orders from either Fusion REST or EBS |
| `spare_parts` | Secondary | Part requirements from `partRequirementLines` (Fusion) or `BOM_INVENTORY_COMPONENTS` (EBS) |
| `pm_schedules` | Secondary | PM definitions (limited API exposure in both platforms) |

## Field Mapping

### Work Orders (Fusion Cloud): `/maintenanceWorkOrders` -> `work_orders`

| Oracle Fusion Field | I/O Column | Required | Transform | Notes |
|---|---|---|---|---|
| `WorkOrderNumber` | `external_id` | Yes | Direct | |
| -- | `source_system` | Yes | Constant: `"oracle_eam"` | |
| `WorkOrderDescription` | `title` | Yes | Direct | |
| `LongDescription` | `description` | No | Direct | |
| `WorkOrderStatusId` | `status` | Yes | `static_map` | See status normalization below |
| `Priority` | `priority` | No | `static_map` | See priority normalization below |
| `WorkOrderType` | `work_type` | No | `static_map` | See work type normalization below |
| `AssetNumber` | `equipment_id` | No | `lookup`: match `equipment.external_id` | FK to equipment table |
| `MaintenanceOrganization` | -- | No | Stored in `extra_data` | Organization context |
| `AssignedTo` | `assigned_to` | No | Direct | |
| `OwningDepartment` | `assigned_group` | No | Direct | |
| `ReportedBy` | `requested_by` | No | Direct | |
| `ScheduledStartDate` | `scheduled_start` | No | `parse_datetime` | |
| `ScheduledCompletionDate` | `scheduled_end` | No | `parse_datetime` | |
| `ActualStartDate` | `actual_start` | No | `parse_datetime` | |
| `ActualCompletionDate` | `actual_end` | No | `parse_datetime` | |
| -- | `labor_hours` | No | -- | Requires operation/resource detail expansion |
| -- | `parts_cost` | No | -- | Requires cost rollup from child resources |
| -- | `labor_cost` | No | -- | Requires cost rollup from child resources |
| `EstimatedCost` | `total_cost` | No | Direct | Estimated; actuals require rollup |
| `FailureCode` | `failure_code` | No | Direct | |
| `CauseCode` | `cause_code` | No | Direct | |
| `ResolutionCode` | `remedy_code` | No | Direct | |
| `ShutdownType` | `permit_required` | No | `expression`: `value != null && value != "None"` | Shutdown implies permit |
| -- | `comments` | No | -- | Requires separate notes/attachments API |
| Custom flex fields | `extra_data` | No | Collect unmapped | Oracle uses Descriptive Flexfields (DFF) |
| `CreationDate` | `created_at` | Yes | `parse_datetime` | |
| `LastUpdateDate` | `updated_at` | Yes | `parse_datetime` | |

### Work Orders (EBS): Direct SQL -> `work_orders`

For EBS, the recommended approach is database connector with SQL queries rather than SOAP APIs.

| EBS Table.Column | I/O Column | Required | Transform | Notes |
|---|---|---|---|---|
| `WE.WIP_ENTITY_NAME` | `external_id` | Yes | Direct | `WIP_ENTITIES` table |
| -- | `source_system` | Yes | Constant: `"oracle_ebs_eam"` | Distinct from Fusion |
| `WDJ.DESCRIPTION` | `title` | Yes | Direct | `WIP_DISCRETE_JOBS` table |
| -- | `description` | No | -- | Long text in `FND_DOCUMENTS_LONG_TEXT` |
| `WDJ.STATUS_TYPE` | `status` | Yes | `static_map` | See EBS status map below |
| `EWO.PRIORITY_ID` | `priority` | No | `static_map` via lookup | `EAM_WORK_ORDERS` table |
| `WE.ENTITY_TYPE` | `work_type` | No | `static_map` | |
| `EWO.ASSET_NUMBER` | `equipment_id` | No | `lookup` | |
| `EWO.OWNING_DEPARTMENT` | `assigned_group` | No | Lookup `HR_ALL_ORGANIZATION_UNITS.NAME` | Department ID -> name |
| `WDJ.SCHEDULED_START_DATE` | `scheduled_start` | No | Direct | Oracle DATE type |
| `WDJ.SCHEDULED_COMPLETION_DATE` | `scheduled_end` | No | Direct | |
| `WDJ.DATE_RELEASED` | `actual_start` | No | Direct | Approximate; actual start per operation |
| `WDJ.DATE_COMPLETED` | `actual_end` | No | Direct | |
| `WDJ.CREATION_DATE` | `created_at` | Yes | Direct | |
| `WDJ.LAST_UPDATE_DATE` | `updated_at` | Yes | Direct | |

### Spare Parts (Fusion): `/partRequirementLines` -> `spare_parts`

| Oracle Fusion Field | I/O Column | Required | Transform | Notes |
|---|---|---|---|---|
| `ItemNumber` | `external_id` | Yes | Direct | |
| -- | `source_system` | Yes | Constant: `"oracle_eam"` | |
| `ItemNumber` | `part_number` | Yes | Direct | |
| `ItemDescription` | `description` | No | Direct | |
| `RequiredQuantity` | `quantity_on_hand` | No | -- | This is required qty, not on-hand. On-hand requires inventory API |
| -- | `reorder_point` | No | -- | Not directly available; requires inventory planning API |
| `UnitPrice` | `unit_cost` | No | Direct | |
| `Subinventory` | `warehouse_location` | No | Direct | |
| `WorkOrderNumber` -> asset | `equipment_ids` | No | Derived | Link through WO to asset |
| Organization, line type | `extra_data` | No | Collect unmapped | |

### PM Schedules -> `pm_schedules`

PM schedule exposure via Oracle APIs is limited in both platforms. Fusion Cloud has maintenance program features but the REST API coverage is incomplete. EBS stores PM data in `EAM_PM_SCHEDULINGS` and `EAM_PM_ACTIVITIES` tables.

| Field (Fusion or EBS) | I/O Column | Required | Transform | Notes |
|---|---|---|---|---|
| PM program / schedule ID | `external_id` | Yes | Direct | |
| -- | `source_system` | Yes | Constant: `"oracle_eam"` | |
| PM name | `name` | Yes | Direct | |
| PM description | `description` | No | Direct | |
| Asset number | `equipment_id` | No | `lookup` | |
| Interval days | `frequency_days` | No | Direct | Calendar-based PMs |
| Last completion date | `last_completed_at` | No | `parse_datetime` | |
| Next due date | `next_due_at` | No | `parse_datetime` | |
| Department | `assigned_group` | No | Direct | |
| Meter intervals, counters | `extra_data` | No | Collect all | |

## Status Normalization

### Fusion Cloud

| Oracle Fusion Status | Description | I/O `status` |
|---|---|---|
| `Draft` | Draft / not yet released | `open` |
| `Released` | Released for execution | `open` |
| `On Hold` | On hold | `on_hold` |
| `In Progress` | Work actively underway | `in_progress` |
| `Complete` | Work completed | `completed` |
| `Closed` | Fully closed | `closed` |
| `Cancelled` | Cancelled | `cancelled` |

### EBS (`WIP_DISCRETE_JOBS.STATUS_TYPE`)

| EBS Status Code | Description | I/O `status` |
|---|---|---|
| `1` | Unreleased | `open` |
| `3` | Released | `open` |
| `4` | Complete | `completed` |
| `5` | Complete - No Charges | `completed` |
| `6` | On Hold | `on_hold` |
| `7` | Cancelled | `cancelled` |
| `12` | Closed | `closed` |
| `14` | Pending Close | `completed` |
| `15` | Failed Close | `completed` |

## Priority Normalization

| Oracle Priority | Typical Meaning | I/O `priority` |
|---|---|---|
| `1` or `Critical` | Emergency / Critical | `critical` |
| `2` or `High` | High | `high` |
| `3` or `Medium` | Medium (default) | `medium` |
| `4` or `Low` | Low | `low` |
| (null) | Not assigned | `medium` (default) |

**Note**: Fusion Cloud uses descriptive strings; EBS uses numeric `PRIORITY_ID` that maps to `MFG_LOOKUPS` values. Both must be handled.

## Work Type Normalization

| Oracle Work Type | Meaning | I/O `work_type` |
|---|---|---|
| `Preventive` / PM entity | Preventive Maintenance | `preventive` |
| `Corrective` / CM entity | Corrective Maintenance | `corrective` |
| `Emergency` | Emergency | `emergency` |
| `Inspection` | Inspection | `inspection` |
| `Calibration` | Calibration | `calibration` |
| (null / other) | Unspecified | `corrective` (default) |

## Sync Strategy

### Fusion Cloud

| Data | Interval | Watermark Column | Method | Notes |
|---|---|---|---|---|
| Work orders | 15 min | `LastUpdateDate` | Incremental | `?q=LastUpdateDate>{watermark}` |
| Spare parts | Daily | `LastUpdateDate` | Incremental | |
| PM schedules | Daily | `LastUpdateDate` | Full or incremental | Limited API coverage |

### EBS (Database Connector)

| Data | Interval | Watermark Column | Method | Notes |
|---|---|---|---|---|
| Work orders | 15 min | `LAST_UPDATE_DATE` | Incremental | SQL: `WHERE LAST_UPDATE_DATE > :watermark` |
| Spare parts | Daily | `LAST_UPDATE_DATE` | Incremental | From `MTL_SYSTEM_ITEMS_B` |
| PM schedules | Daily | `LAST_UPDATE_DATE` | Full | From `EAM_PM_SCHEDULINGS` |

- **Initial load (Fusion)**: Use `?q=CreationDate>2022-01-01` to scope initial import. Pagination via `offset`/`limit`
- **Initial load (EBS)**: SQL query with date filter. Expect 10,000-50,000 WOs in a mature EBS installation
- **EBS database access**: Requires Oracle DB credentials with SELECT access to EAM schema objects. Often easier to get than SOAP API configuration

## Pre-Built Import Definition

### Fusion Cloud

```jsonc
{
  "name": "Oracle Fusion Cloud - Work Orders",
  "connector_type": "rest_json",
  "source_system": "oracle_eam",
  "target_table": "work_orders",
  "connection": {
    "base_url": "https://{oracle_host}/fscmRestApi/resources/11.13.18.05",
    "auth_type": "basic_auth",
    "auth_config": {
      "username": "{oracle_user}",
      "password": "{oracle_password}"
    },
    "headers": {
      "Accept": "application/json",
      "REST-Framework-Version": "4"
    },
    "timeout_seconds": 60,
    "retry_count": 3,
    "retry_backoff_ms": 2000
  },
  "source": {
    "endpoint": "/maintenanceWorkOrders",
    "method": "GET",
    "params": {
      "q": "LastUpdateDate>{watermark}",
      "limit": 500,
      "offset": 0,
      "orderBy": "LastUpdateDate:asc"
    },
    "pagination": {
      "type": "offset_limit",
      "page_size": 500
    },
    "watermark": {
      "column": "LastUpdateDate",
      "format": "iso8601",
      "initial_value": "2023-01-01T00:00:00Z"
    },
    "response_path": "items"
  },
  "field_mappings": [
    { "source": "WorkOrderNumber", "target": "external_id" },
    { "source": null, "target": "source_system", "transform": "constant", "value": "oracle_eam" },
    { "source": "WorkOrderDescription", "target": "title" },
    { "source": "LongDescription", "target": "description" },
    { "source": "WorkOrderStatusId", "target": "status", "transform": "static_map", "map": {
      "Draft": "open", "Released": "open", "On Hold": "on_hold",
      "In Progress": "in_progress", "Complete": "completed", "Closed": "closed", "Cancelled": "cancelled"
    }, "default": "open" },
    { "source": "Priority", "target": "priority", "transform": "static_map", "map": {
      "1": "critical", "Critical": "critical", "2": "high", "High": "high",
      "3": "medium", "Medium": "medium", "4": "low", "Low": "low"
    }, "default": "medium" },
    { "source": "WorkOrderType", "target": "work_type", "transform": "static_map", "map": {
      "Preventive": "preventive", "Corrective": "corrective", "Emergency": "emergency",
      "Inspection": "inspection", "Calibration": "calibration"
    }, "default": "corrective" },
    { "source": "AssetNumber", "target": "equipment_id", "transform": "lookup", "lookup_table": "equipment", "lookup_column": "external_id" },
    { "source": "AssignedTo", "target": "assigned_to" },
    { "source": "OwningDepartment", "target": "assigned_group" },
    { "source": "ReportedBy", "target": "requested_by" },
    { "source": "ScheduledStartDate", "target": "scheduled_start", "transform": "parse_datetime" },
    { "source": "ScheduledCompletionDate", "target": "scheduled_end", "transform": "parse_datetime" },
    { "source": "ActualStartDate", "target": "actual_start", "transform": "parse_datetime" },
    { "source": "ActualCompletionDate", "target": "actual_end", "transform": "parse_datetime" },
    { "source": "FailureCode", "target": "failure_code" },
    { "source": "CauseCode", "target": "cause_code" },
    { "source": "ResolutionCode", "target": "remedy_code" },
    { "source": "CreationDate", "target": "created_at", "transform": "parse_datetime" },
    { "source": "LastUpdateDate", "target": "updated_at", "transform": "parse_datetime" }
  ]
}
```

### EBS (Database Connector)

```jsonc
{
  "name": "Oracle EBS eAM - Work Orders",
  "connector_type": "database",
  "source_system": "oracle_ebs_eam",
  "target_table": "work_orders",
  "connection": {
    "driver": "oracle",
    "host": "{ebs_db_host}",
    "port": 1521,
    "database": "{ebs_sid}",
    "username": "{db_user}",
    "password": "{db_password}"
  },
  "source": {
    "query": "SELECT WE.WIP_ENTITY_NAME AS external_id, WDJ.DESCRIPTION AS title, WDJ.STATUS_TYPE AS status_raw, EWO.PRIORITY_ID AS priority_raw, WE.ENTITY_TYPE AS work_type_raw, EWO.ASSET_NUMBER AS asset_external_id, EWO.OWNING_DEPARTMENT AS department_id, WDJ.SCHEDULED_START_DATE, WDJ.SCHEDULED_COMPLETION_DATE, WDJ.DATE_RELEASED AS actual_start, WDJ.DATE_COMPLETED AS actual_end, WDJ.CREATION_DATE, WDJ.LAST_UPDATE_DATE FROM WIP_ENTITIES WE JOIN WIP_DISCRETE_JOBS WDJ ON WE.WIP_ENTITY_ID = WDJ.WIP_ENTITY_ID LEFT JOIN EAM_WORK_ORDERS EWO ON WE.WIP_ENTITY_ID = EWO.WIP_ENTITY_ID WHERE WDJ.LAST_UPDATE_DATE > :watermark ORDER BY WDJ.LAST_UPDATE_DATE ASC",
    "watermark": {
      "column": "LAST_UPDATE_DATE",
      "format": "oracle_date",
      "initial_value": "2023-01-01"
    }
  },
  "field_mappings": [
    { "source": "EXTERNAL_ID", "target": "external_id" },
    { "source": null, "target": "source_system", "transform": "constant", "value": "oracle_ebs_eam" },
    { "source": "TITLE", "target": "title" },
    { "source": "STATUS_RAW", "target": "status", "transform": "static_map", "map": {
      "1": "open", "3": "open", "4": "completed", "5": "completed",
      "6": "on_hold", "7": "cancelled", "12": "closed", "14": "completed", "15": "completed"
    }, "default": "open" },
    { "source": "PRIORITY_RAW", "target": "priority", "transform": "static_map", "map": {
      "1": "critical", "2": "high", "3": "medium", "4": "low"
    }, "default": "medium" },
    { "source": "ASSET_EXTERNAL_ID", "target": "equipment_id", "transform": "lookup", "lookup_table": "equipment", "lookup_column": "external_id" },
    { "source": "DEPARTMENT_ID", "target": "assigned_group", "transform": "lookup", "lookup_table": "oracle_departments", "lookup_column": "department_id" },
    { "source": "SCHEDULED_START_DATE", "target": "scheduled_start", "transform": "parse_datetime" },
    { "source": "SCHEDULED_COMPLETION_DATE", "target": "scheduled_end", "transform": "parse_datetime" },
    { "source": "ACTUAL_START", "target": "actual_start", "transform": "parse_datetime" },
    { "source": "ACTUAL_END", "target": "actual_end", "transform": "parse_datetime" },
    { "source": "CREATION_DATE", "target": "created_at", "transform": "parse_datetime" },
    { "source": "LAST_UPDATE_DATE", "target": "updated_at", "transform": "parse_datetime" }
  ]
}
```

## Notes

### Two Completely Different Platforms
This is the single most important thing about Oracle eAM integration: **EBS and Fusion Cloud are entirely different products with different APIs, different schemas, different field names, and different authentication**. The import wizard must let the user choose which platform they're connecting to. The `source_system` values are distinct (`oracle_eam` for Fusion, `oracle_ebs_eam` for EBS) so records from both can coexist during migration.

### Fusion Cloud Specifics
- **REST API versioning**: The version number in the URL (e.g., `11.13.18.05`) changes with Oracle releases. The connector should allow configuring this version string. Oracle documents API changes per release
- **Descriptive Flexfields (DFF)**: Oracle's mechanism for custom fields. Exposed as child resources on the REST API. Store in `extra_data`
- **Cost rollups**: Total cost, labor cost, and parts cost are not always top-level fields on the work order. They may require expanding child resources (operations, resource requirements, material requirements) and summing
- **AI features**: Oracle Fusion 26A+ includes `generateRepairSuggestion` and condition-based WO creation endpoints. Interesting but irrelevant to I/O's read-only sync

### EBS Specifics
- **SOAP API limitations**: The `EAM_PROCESS_WO_PUB` SOAP APIs are designed for transactional write operations, not bulk reads. They require `FND_GLOBAL.APPS_INITIALIZE` context (responsibility, user, org) before any call. For I/O's read-only sync, direct database queries are almost always more practical
- **Database schema**: EAM data spans multiple Oracle EBS tables: `WIP_ENTITIES`, `WIP_DISCRETE_JOBS`, `EAM_WORK_ORDERS`, `WIP_OPERATIONS`, `WIP_REQUIREMENT_OPERATIONS`, `CSI_ITEM_INSTANCES` (assets), `EAM_PM_SCHEDULINGS`. Complex JOINs required
- **Multi-org**: EBS is multi-organization. Queries must include `ORGANIZATION_ID` filter to scope to the correct plant
- **Apps schema access**: The database user needs SELECT grants on the relevant EBS views or tables. Oracle provides pre-built views (e.g., `WIP_DISCRETE_JOBS_V`) that simplify queries

### Common Quirks (Both Platforms)
- **Oracle licensing sensitivity**: Oracle customers are sometimes hesitant to expose APIs or grant database access due to licensing audit concerns. Work with the customer's Oracle DBA/admin team
- **Migration coexistence**: Sites mid-migration may have some work orders in EBS and newer ones in Fusion Cloud. I/O must handle both source systems simultaneously, with distinct `source_system` values to avoid ID collisions
- **Timezone handling**: EBS stores dates without timezone (assumes server timezone). Fusion Cloud uses UTC. The connector must normalize both to UTC

### Alternative Integration Paths
- **Oracle Integration Cloud (OIC)**: Oracle's iPaaS for integration. If the customer has OIC, they may prefer to route data through it. Adds a middleware layer but simplifies auth and monitoring
- **Oracle BI Publisher reports**: Some customers export maintenance data via BI Publisher scheduled reports (CSV/XML). I/O's file connector could consume these. Lower-tech but sometimes easier to get approved
- **Informatica / MuleSoft**: Enterprise integration platforms commonly used with Oracle. If the customer already has one, they may prefer to push data to I/O rather than having I/O pull directly
