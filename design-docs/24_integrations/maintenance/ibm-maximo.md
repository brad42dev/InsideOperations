# IBM Maximo Application Suite (MAS) — Maintenance Connector Profile

## Application Overview

- **Vendor**: IBM (USA)
- **Product**: IBM Maximo Application Suite (MAS) 8.x, or legacy Maximo Asset Management 7.x
- **Market Position**: Second most common CMMS in large refineries. ~20-30% of large refinery installations. Strong in asset-intensive industries: oil & gas, utilities, petrochemicals, mining. Used by many national oil companies
- **Licensing**: Cloud SaaS starts ~$50/user/month (Essentials), scales to $3,150+/month for full suite. On-premise: $100,000-$500,000+ perpetual. MAS 8 uses AppPoints credit-based model. Irrelevant to I/O -- we only call their API
- **Typical Deployment**: On-premise Maximo 7.x (still very common) or MAS 8 on Red Hat OpenShift (cloud or on-premise containers). Refineries are mid-migration; expect both versions in the field for years

## API Surface

- **Protocol**: REST/JSON (OSLC-based). IBM calls these "Object Structure" APIs
- **Base URL**: `https://{maximo_host}/maximo/oslc/os/` (7.x) or `https://{mas_host}/maximo/oslc/os/` (MAS 8)
- **Authentication**:
  - **API Key** (preferred for MAS 8): `apikey` query parameter or `apikey` header. Generated from Manage admin app
  - **MAXAUTH** (legacy, 7.x): Base64-encoded `userid:password` in `MAXAUTH` header
  - **Basic Auth**: Available when `mxe.useAppServerSecurity=1` (LDAP-authenticated deployments)
  - **OIDC** (MAS 8 on OpenShift): MAS provides its own identity provider. MAXAUTH and Basic Auth are not supported in MAS 8
- **Pagination**: `oslc.pageSize=N` with stable paging (holds MboSet reference for consistent results). Follow `oslc.nextPage` link from response
- **Query Syntax**: `oslc.where` clause (e.g., `oslc.where=status="APPR"`), `oslc.select` for field selection, `oslc.orderBy` for sorting. Not standard SQL or OData -- Maximo has its own OSLC query grammar
- **Rate Limits**: Not standardized; depends on server configuration
- **API Documentation**: [IBM Maximo REST API Guide](https://ibm-maximo-dev.github.io/maximo-restapi-documentation/)

### Key Endpoints

| Endpoint | Purpose |
|---|---|
| `GET /oslc/os/mxapiwodetail` | Work orders (detailed, with operations/labor/materials) |
| `GET /oslc/os/mxapiasset` | Assets / equipment |
| `GET /oslc/os/mxapioperloc` | Operating locations (functional locations) |
| `GET /oslc/os/mxapiinventory` | Inventory / spare parts |
| `GET /oslc/os/mxapipm` | Preventive maintenance schedules |
| `GET /oslc/os/mxapifailurelist` | Failure codes / failure reports |
| `GET /oslc/os/mxapisr` | Service requests |

## Target Tables

| Table | Role | Description |
|---|---|---|
| `work_orders` | **Primary** | Work orders from `mxapiwodetail` |
| `spare_parts` | Secondary | Inventory items from `mxapiinventory` |
| `pm_schedules` | Secondary | PM records from `mxapipm` |

## Field Mapping

### Work Orders: `mxapiwodetail` -> `work_orders`

| Maximo Field | I/O Column | Required | Transform | Notes |
|---|---|---|---|---|
| `wonum` | `external_id` | Yes | Direct | Maximo work order number |
| -- | `source_system` | Yes | Constant: `"maximo"` | |
| `description` | `title` | Yes | Direct | Short description |
| `description_longdescription` | `description` | No | Direct | Long text body (HTML may be present) |
| `status` | `status` | Yes | `static_map` | See status normalization below |
| `wopriority` | `priority` | No | `static_map` | See priority normalization below |
| `worktype` | `work_type` | No | `static_map` | See work type normalization below |
| `assetnum` | `equipment_id` | No | `lookup`: match `equipment.external_id` | FK to equipment table |
| `location` | -- | No | Stored in `extra_data` | Operating location code |
| `lead` | `assigned_to` | No | Direct | Lead technician |
| `crewid` | `assigned_group` | No | Direct | Crew / work group |
| `reportedby` | `requested_by` | No | Direct | |
| `schedstart` | `scheduled_start` | No | `parse_datetime` | ISO 8601 |
| `schedfinish` | `scheduled_end` | No | `parse_datetime` | |
| `actstart` | `actual_start` | No | `parse_datetime` | |
| `actfinish` | `actual_end` | No | `parse_datetime` | |
| `estlabhrs` | -- | No | Stored in `extra_data` | Estimated labor hours |
| `actlabhrs` | `labor_hours` | No | Direct | Actual labor hours |
| `actmatcost` | `parts_cost` | No | Direct | Actual material cost |
| `actlabcost` | `labor_cost` | No | Direct | Actual labor cost |
| `actmatcost` + `actlabcost` + `actservcost` + `acttoolcost` | `total_cost` | No | `expression`: `actmatcost + actlabcost + actservcost + acttoolcost` | Sum of all cost categories |
| `failurecode` | `failure_code` | No | Direct | Top-level failure class |
| `problemcode` | `cause_code` | No | Direct | Problem / cause code |
| `remedycode` | `remedy_code` | No | Direct | |
| -- | `permit_required` | No | -- | Check `hassafetyhazard` or safety plan fields |
| `parent` | -- | No | Stored in `extra_data.parent_wo` | Parent work order number |
| `worklog` (child collection) | `comments` | No | `map_array` | Array of `{description, logtype, createdate, createby}` |
| `siteid`, `orgid`, custom fields | `extra_data` | No | Collect unmapped | |
| `reportdate` | `created_at` | Yes | `parse_datetime` | When the WO was reported/created |
| `changedate` + `_rowstamp` | `updated_at` | Yes | `parse_datetime` | Last modification time |

### Spare Parts: `mxapiinventory` -> `spare_parts`

| Maximo Field | I/O Column | Required | Transform | Notes |
|---|---|---|---|---|
| `itemnum` | `external_id` | Yes | Direct | Item number |
| -- | `source_system` | Yes | Constant: `"maximo"` | |
| `itemnum` | `part_number` | Yes | Direct | Same as external_id in Maximo |
| `description` | `description` | No | Direct | |
| `curbal` | `quantity_on_hand` | No | Direct | Current balance |
| `reorder` | `reorder_point` | No | Direct | |
| `avgcost` | `unit_cost` | No | Direct | Average cost |
| `storeloc` + `binnum` | `warehouse_location` | No | `expression`: `storeloc + '/' + binnum` | Storeroom and bin |
| -- | `equipment_ids` | No | -- | Requires `sparepartasset` relationship query |
| Vendor, commodity group, etc. | `extra_data` | No | Collect unmapped | |

### PM Schedules: `mxapipm` -> `pm_schedules`

| Maximo Field | I/O Column | Required | Transform | Notes |
|---|---|---|---|---|
| `pmnum` | `external_id` | Yes | Direct | PM number |
| -- | `source_system` | Yes | Constant: `"maximo"` | |
| `description` | `name` | Yes | Direct | |
| `description_longdescription` | `description` | No | Direct | |
| `assetnum` | `equipment_id` | No | `lookup` | FK to equipment |
| `frequency` | `frequency_days` | No | `expression` | Depends on `frequnit` (DAYS, WEEKS, MONTHS) |
| `lastcompdate` | `last_completed_at` | No | `parse_datetime` | |
| `nextdate` | `next_due_at` | No | `parse_datetime` | |
| `leadcraft` or `crewid` | `assigned_group` | No | Direct | |
| `frequnit`, `pmassetwo`, `pmcounter` | `extra_data` | No | Collect all | Meter-based PM details |

## Status Normalization

| Maximo Status | Maximo Description | I/O `status` |
|---|---|---|
| `WAPPR` | Waiting for Approval | `open` |
| `APPR` | Approved | `open` |
| `WMATL` | Waiting on Material | `on_hold` |
| `WSCH` | Waiting to be Scheduled | `on_hold` |
| `INPRG` | In Progress | `in_progress` |
| `COMP` | Complete | `completed` |
| `CLOSE` | Closed | `closed` |
| `CAN` | Cancelled | `cancelled` |
| `WPCOND` | Waiting on Plant Condition | `on_hold` |
| `HISTEDIT` | History Edit | `closed` |

**Custom statuses**: Maximo installations frequently add custom statuses (e.g., "REVIEW", "PERMIT", "SHUTDOWN"). These must be mapped per site. The import definition supports an `extra_status_map` in the connection config for site-specific overrides.

## Priority Normalization

Maximo `wopriority` is an integer. The mapping varies by installation, but a common convention:

| Maximo `wopriority` | Typical Meaning | I/O `priority` |
|---|---|---|
| `1` | Emergency | `critical` |
| `2` | Urgent | `high` |
| `3` | High | `high` |
| `4` | Medium | `medium` |
| `5` | Low | `low` |
| (null) | Not assigned | `medium` (default) |

**Note**: Some sites use 1-3 scale, others 1-10. The `static_map` must be configured per installation.

## Work Type Normalization

| Maximo `worktype` | Maximo Meaning | I/O `work_type` |
|---|---|---|
| `PM` | Preventive Maintenance | `preventive` |
| `CM` | Corrective Maintenance | `corrective` |
| `EM` | Emergency Maintenance | `emergency` |
| `CAL` | Calibration | `calibration` |
| `INSP` | Inspection | `inspection` |
| `CP` | Capital Project | `project` |
| `MOD` | Modification | `modification` |
| (null/other) | Unspecified | `corrective` (default) |

## Sync Strategy

| Data | Interval | Watermark Column | Method | Notes |
|---|---|---|---|---|
| Work orders | 15 min | `_rowstamp` | Incremental | `oslc.where=_rowstamp>"{watermark}"` |
| Spare parts | Daily | `_rowstamp` | Incremental | Inventory changes less frequently |
| PM schedules | Daily | `_rowstamp` | Incremental | PM definitions change rarely |

- **`_rowstamp`**: Maximo's built-in change tracking mechanism. A database-level sequence that increments on any row modification. Very reliable for incremental sync -- more so than date-based watermarks because it's immune to clock skew
- **Initial load**: Full sync with `oslc.pageSize=200`. Expect 20,000-100,000 work orders in a mature refinery Maximo installation. Filter by `reportdate>="2022-01-01"` for initial import, backfill later
- **Stable paging**: Maximo holds the MboSet (result set) reference across pages within a session, guaranteeing consistent results during pagination. However, idle sessions time out (default 30 min), which can break long-running paged queries

## Pre-Built Import Definition

```jsonc
{
  "name": "IBM Maximo - Work Orders",
  "connector_type": "rest_json",
  "source_system": "maximo",
  "target_table": "work_orders",
  "connection": {
    "base_url": "https://{maximo_host}/maximo",
    "auth_type": "api_key",
    "auth_config": {
      "header_name": "apikey",
      "api_key": "{maximo_api_key}"
    },
    "headers": {
      "Accept": "application/json"
    },
    "params": {
      "_dropnulls": "0"
    },
    "timeout_seconds": 90,
    "retry_count": 3,
    "retry_backoff_ms": 2000
  },
  "source": {
    "endpoint": "/oslc/os/mxapiwodetail",
    "method": "GET",
    "params": {
      "oslc.where": "_rowstamp>\"{watermark}\"",
      "oslc.select": "wonum,description,description_longdescription,status,wopriority,worktype,assetnum,location,lead,crewid,reportedby,reportdate,schedstart,schedfinish,actstart,actfinish,actlabhrs,actmatcost,actlabcost,actservcost,acttoolcost,failurecode,problemcode,remedycode,parent,changedate,_rowstamp,siteid,orgid",
      "oslc.pageSize": 200,
      "oslc.orderBy": "+_rowstamp"
    },
    "pagination": {
      "type": "oslc_nextpage",
      "page_size": 200
    },
    "watermark": {
      "column": "_rowstamp",
      "format": "string",
      "initial_value": "0"
    },
    "response_path": "member"
  },
  "field_mappings": [
    { "source": "wonum", "target": "external_id" },
    { "source": null, "target": "source_system", "transform": "constant", "value": "maximo" },
    { "source": "description", "target": "title" },
    { "source": "description_longdescription", "target": "description" },
    { "source": "status", "target": "status", "transform": "static_map", "map": {
      "WAPPR": "open", "APPR": "open", "WMATL": "on_hold", "WSCH": "on_hold",
      "INPRG": "in_progress", "COMP": "completed", "CLOSE": "closed", "CAN": "cancelled",
      "WPCOND": "on_hold", "HISTEDIT": "closed"
    }, "default": "open" },
    { "source": "wopriority", "target": "priority", "transform": "static_map", "map": {
      "1": "critical", "2": "high", "3": "high", "4": "medium", "5": "low"
    }, "default": "medium" },
    { "source": "worktype", "target": "work_type", "transform": "static_map", "map": {
      "PM": "preventive", "CM": "corrective", "EM": "emergency", "CAL": "calibration",
      "INSP": "inspection", "CP": "project", "MOD": "modification"
    }, "default": "corrective" },
    { "source": "assetnum", "target": "equipment_id", "transform": "lookup", "lookup_table": "equipment", "lookup_column": "external_id" },
    { "source": "lead", "target": "assigned_to" },
    { "source": "crewid", "target": "assigned_group" },
    { "source": "reportedby", "target": "requested_by" },
    { "source": "schedstart", "target": "scheduled_start", "transform": "parse_datetime" },
    { "source": "schedfinish", "target": "scheduled_end", "transform": "parse_datetime" },
    { "source": "actstart", "target": "actual_start", "transform": "parse_datetime" },
    { "source": "actfinish", "target": "actual_end", "transform": "parse_datetime" },
    { "source": "actlabhrs", "target": "labor_hours" },
    { "source": "actmatcost", "target": "parts_cost" },
    { "source": "actlabcost", "target": "labor_cost" },
    { "source": ["actmatcost", "actlabcost", "actservcost", "acttoolcost"], "target": "total_cost", "transform": "expression", "expression": "actmatcost + actlabcost + actservcost + acttoolcost" },
    { "source": "failurecode", "target": "failure_code" },
    { "source": "problemcode", "target": "cause_code" },
    { "source": "remedycode", "target": "remedy_code" },
    { "source": "reportdate", "target": "created_at", "transform": "parse_datetime" },
    { "source": "changedate", "target": "updated_at", "transform": "parse_datetime" }
  ]
}
```

## Notes

### Version Differences
- **Maximo 7.6.x**: OSLC APIs available but less mature. Use MAXAUTH or Basic Auth. Object Structures may need explicit activation. Some `mxapi*` endpoints may not exist -- fall back to base Object Structures (e.g., `MXWO` instead of `mxapiwodetail`)
- **MAS 8.x (Manage)**: Full OSLC API support. API Key required (MAXAUTH not supported). Runs on OpenShift, so the base URL may include a route path. OIDC tokens available for SSO-authenticated access
- **MAS 9 (if released)**: Check for API changes. IBM has been consistent with OSLC, so breaking changes are unlikely

### Common Quirks
- **`_dropnulls=0`**: By default, Maximo omits null attributes from JSON responses. Always include `_dropnulls=0` as a query parameter to get complete records. Without this, a field being absent could mean either "null" or "not requested"
- **Non-persistent attributes**: Calculated fields (e.g., `totalcost`, `statusdesc`) must be explicitly listed in `oslc.select`. They don't appear by default even with `_dropnulls=0`
- **Long descriptions**: The `description_longdescription` field contains HTML in some installations (rich text editor). May need HTML stripping for clean display in I/O
- **OSLC query syntax**: Not SQL, not OData. Examples: `oslc.where=status in ["APPR","INPRG"]`, `oslc.where=reportdate>="2024-01-01T00:00:00"`. String values must be double-quoted inside the OSLC where clause
- **Custom Object Structures**: Maximo administrators can customize Object Structures, adding or removing fields. A field present in the standard `mxapiwodetail` might be missing in a customized installation. The connector must handle missing fields gracefully
- **Site and org context**: Maximo is multi-site. Queries may need `siteid` and `orgid` filters to scope to the correct plant. Without these, the API returns data across all sites the API key has access to
- **Timezone handling**: Maximo stores dates in the server's timezone by default. The `MXTIMEZONE` property on the user profile controls display timezone. API responses may or may not include timezone info depending on version and configuration
- **Worklog entries**: Work order comments are stored as child `worklog` records. To retrieve them, include `worklog{*}` in `oslc.select` to expand the child collection. This increases response size significantly

### Alternative Integration Paths
- **Maximo Integration Framework (MIF)**: Maximo has its own integration framework for outbound push (publish channels) and inbound processing. If the Maximo admin prefers push-based integration, I/O could expose a webhook endpoint. Not recommended for I/O v1 -- pull is simpler
- **Database direct**: Maximo's database schema (typically on Db2, Oracle, or SQL Server) is documented but complex. Direct SQL is faster for bulk reads but bypasses Maximo's business logic layer. Not recommended unless API performance is a problem
- **Maximo-Kafka connector**: MAS 8 supports Kafka-based event streaming. Future consideration if near-real-time WO updates are needed
