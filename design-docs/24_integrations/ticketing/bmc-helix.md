# BMC Helix ITSM — Ticketing / ITSM Connector Profile

## Application Overview

| Attribute | Detail |
|---|---|
| **Vendor** | BMC Software, Inc. |
| **Product** | BMC Helix ITSM (legacy: BMC Remedy ITSM) |
| **Market Position** | Strong #2 in enterprise ITSM. Remedy has been the de facto standard in many refineries and petrochemical plants for 20+ years. Many legacy Remedy on-prem deployments (v7.x-9.x) still active alongside modern Helix cloud. |
| **Licensing** | API access included with ITSM license. Integration accounts need AR System license (floating or fixed). Helix cloud: included in subscription. |
| **Refinery Scenario** | Heavy industrial sites that adopted Remedy in the 2000s. Often deeply customized with OT-specific forms and categories. Expect version fragmentation: some sites on Helix cloud, others on Remedy 9.x on-prem, some still on 7.x/8.x. |

## API Surface

| Attribute | Value |
|---|---|
| **API Type** | REST (JSON). Two API surfaces: Simplified REST API v2 (Helix/modern) and Legacy AR REST API (Remedy on-prem). |
| **Simplified API Base** | `https://<server>/api/com.bmc.dsm.itsm.itsm-rest-api/v2` |
| **Legacy AR REST Base** | `https://<server>/api/arsys/v1/entry` |
| **Authentication** | Token-based. `POST /api/rx/authentication/loginrequest` with JSON `{"userName": "...", "password": "..."}`. Returns auth token in response header `AR-JWT`. |
| **Pagination** | `offset` + `limit` query parameters. |
| **Rate Limits** | Server-configurable. No published global defaults. Typical: 60-120 requests/min per integration user. |
| **API Docs** | `https://docs.bmc.com/` (search "Helix ITSM simplified REST API") |

**Key differences between API surfaces:**

| Feature | Simplified API v2 | Legacy AR REST API |
|---|---|---|
| Endpoint style | `/v2/incident`, `/v2/change` | `/entry/HPD:Help Desk`, `/entry/CHG:Infrastructure Change` |
| Query syntax | `q='field'="value"` | `q='field'="value"` (same AR qualification syntax) |
| Field names | Friendly names | AR System internal names |
| Available on | Helix 21.x+ | Remedy 7.x+ and Helix |
| Recommended for | New integrations | Legacy Remedy on-prem |

### Authentication Configuration

```jsonc
{
  "auth_method": "bmc_token",
  "login_endpoint": "/api/rx/authentication/loginrequest",
  "login_body": {
    "userName": "{{BMC_USERNAME}}",
    "password": "{{BMC_PASSWORD}}"
  },
  "token_header": "AR-JWT",
  "token_usage": {
    "header_name": "Authorization",
    "header_prefix": "AR-JWT "
  },
  "token_refresh": {
    "idle_timeout_minutes": 15,
    "absolute_timeout_minutes": 60,
    "refresh_before_expiry_minutes": 5
  }
}
```

> **Note:** Token idle timeout and absolute timeout are server-configurable. Defaults vary. The connector should proactively refresh tokens before expiry and handle HTTP 401 by re-authenticating.

## Target Tables

| I/O Table | BMC Source | Priority |
|---|---|---|
| `tickets` | Incident, Change Request, Problem | Primary |
| `ticket_comments` | Work Info entries (attached to tickets) | Secondary |

## Field Mapping — Incidents

### Simplified API `incident` to `tickets`

| BMC Helix Field | I/O Column | Transform |
|---|---|---|
| `Incident Number` | `ticket_number`, `external_id` | Direct map |
| — | `source_system` | Constant: `bmc_helix` |
| — | `ticket_type` | Constant: `incident` |
| `Description` | `title` | Direct map (this is the short description in BMC) |
| `Detailed Decription` | `description` | Direct map (note: BMC misspells "Description") |
| `Status` | `status` | Value map (see normalization table) |
| `Priority` | `priority` | Value map (see normalization table) |
| `Categorization Tier 1` | `category` | Direct map; also used for IT/OT derivation |
| `Categorization Tier 2` | `subcategory` | Direct map; concatenate Tier 2 + Tier 3 if both present |
| `Categorization Tier 3` | `extra_data.tier3` | Store in JSONB if present |
| Derived | `is_ot` | See IT/OT categorization strategy |
| `Assignee` | `assigned_to` | Direct map |
| `Assigned Group` | `assigned_group` | Direct map |
| `Submitter` | `requester_name` | Direct map |
| — | `requester_email` | Not directly available; lookup via Person form if needed |
| `CI Name` | `ci_name` | Direct map (CMDB reference) |
| `INTL SCCM CI ID` or `CI ReconciliationIdentity` | `ci_id` | BMC CI identifier |
| — | `hostname` | Extract from CI record if class is Computer System |
| — | `ip_address` | Extract from CI record if available |
| `Site` | `location` | Direct map |
| — | `planned_start_at` | NULL for incidents |
| — | `planned_end_at` | NULL for incidents |
| `Submit Date` | `created_at_source` | Parse timestamp |
| `Last Modified Date` | `updated_at_source` | Parse timestamp |
| `Last Resolved Date` | `resolved_at` | Parse timestamp |
| `Closed Date` | `closed_at` | Parse timestamp |
| `Impact`, `Urgency` | `extra_data.impact`, `extra_data.urgency` | Store in JSONB |
| `Request ID` | `extra_data.request_id` | Internal AR record ID for deep-link |

### Legacy AR REST API Field Names

For Remedy on-prem using the legacy AR REST API (`/api/arsys/v1/entry/HPD:Help Desk`), field names use AR System IDs or database column names. Common mappings:

| AR Field ID | Friendly Name | I/O Column |
|---|---|---|
| `1000000161` | `Incident Number` | `ticket_number` |
| `1000000000` | `Description` | `title` |
| `1000000151` | `Detailed Description` | `description` |
| `7` | `Status` | `status` |
| `1000000163` | `Priority` | `priority` |
| `1000000063` | `Categorization Tier 1` | `category` |
| `4` | `Assignee` | `assigned_to` |
| `1000000217` | `Assigned Group` | `assigned_group` |
| `2` | `Submitter` | `requester_name` |
| `3` | `Submit Date` | `created_at_source` |
| `6` | `Last Modified Date` | `updated_at_source` |

> **Note:** Field IDs vary between Remedy versions and customizations. The connection wizard must include a field discovery step for legacy deployments. Query `/api/arsys/v1/entry/HPD:Help Desk?fields=` to inspect available fields.

### Change Request to `tickets`

| BMC Helix Field | I/O Column | Transform |
|---|---|---|
| `Infrastructure Change ID` | `ticket_number`, `external_id` | Direct map |
| — | `source_system` | Constant: `bmc_helix` |
| — | `ticket_type` | Constant: `change_request` |
| `Description` | `title` | Direct map |
| `Detailed Description` | `description` | Direct map |
| `Change Request Status` | `status` | Change-specific value map (see below) |
| `Priority` | `priority` | Same priority map |
| `Change Type` | `extra_data.change_type` | `Normal`, `Standard`, `Emergency`, `Expedited`, `Latent`, `No Impact` |
| `Risk Level` | `extra_data.risk_level` | Store in JSONB |
| `Categorization Tier 1` | `category` | Direct map |
| `ASGRP` (Assigned Group) | `assigned_group` | Direct map |
| `ASGN` (Assignee) | `assigned_to` | Direct map |
| `Requester` | `requester_name` | Direct map |
| `CI Name` | `ci_name` | Direct map |
| `Location` | `location` | Direct map |
| `Scheduled Start Date` | `planned_start_at` | Parse timestamp |
| `Scheduled End Date` | `planned_end_at` | Parse timestamp |
| `Actual Start Date` | `extra_data.actual_start` | Store in JSONB |
| `Actual End Date` | `extra_data.actual_end` | Store in JSONB |
| `Submit Date` | `created_at_source` | Parse timestamp |
| `Last Modified Date` | `updated_at_source` | Parse timestamp |
| `Closed Date` | `closed_at` | Parse timestamp |

### Problem to `tickets`

| BMC Helix Field | I/O Column | Transform |
|---|---|---|
| `Problem Investigation ID` | `ticket_number`, `external_id` | Direct map |
| — | `source_system` | Constant: `bmc_helix` |
| — | `ticket_type` | Constant: `problem` |
| `Description` | `title` | Direct map |
| `Detailed Description` | `description` | Direct map |
| `Investigation Driver Status` | `status` | Problem-specific value map (see below) |
| `Priority` | `priority` | Same priority map |
| `Categorization Tier 1` | `category` | Direct map |
| `Root Cause` | `extra_data.root_cause` | Store in JSONB |
| `Workaround` | `extra_data.workaround` | Store in JSONB |
| `Assignee` | `assigned_to` | Direct map |
| `Assigned Group` | `assigned_group` | Direct map |
| `CI Name` | `ci_name` | Direct map |
| `Location` | `location` | Direct map |
| `Submit Date` | `created_at_source` | Parse timestamp |
| `Last Modified Date` | `updated_at_source` | Parse timestamp |
| `Last Resolved Date` | `resolved_at` | Parse timestamp |

### Work Info to `ticket_comments`

BMC stores ticket activity in Work Info records, accessible via the Simplified API or AR REST API.

| BMC Field | I/O Column | Transform |
|---|---|---|
| `Work Log ID` | `external_id` | Unique work info entry ID |
| Parent ticket ID | `ticket_id` | Lookup ticket by external_id → FK |
| `View Access` | `is_internal` | `Internal` → `true`; `Public` → `false` |
| `Notes` | `comment_text` | Direct map |
| `Submitter` | `author_name` | Direct map |
| `Submit Date` | `commented_at` | Parse timestamp |

## Status Normalization

### Incident `Status` to I/O `status`

| BMC `Status` | I/O `status` |
|---|---|
| `New` | `new` |
| `Assigned` | `open` |
| `In Progress` | `in_progress` |
| `Pending` | `on_hold` |
| `Resolved` | `resolved` |
| `Closed` | `closed` |
| `Cancelled` | `cancelled` |

### Change Request `Change Request Status` to I/O `status`

| BMC `Change Request Status` | I/O `status` |
|---|---|
| `Draft` | `new` |
| `Request For Authorization` | `open` |
| `Request For Change` | `open` |
| `Planning In Progress` | `open` |
| `Scheduled For Review` | `open` |
| `Scheduled For Approval` | `open` |
| `Scheduled` | `open` |
| `Implementation In Progress` | `in_progress` |
| `Pending` | `on_hold` |
| `Rejected` | `cancelled` |
| `Completed` | `resolved` |
| `Closed` | `closed` |
| `Cancelled` | `cancelled` |

### Problem `Investigation Driver Status` to I/O `status`

| BMC `Investigation Driver Status` | I/O `status` |
|---|---|
| `Draft` | `new` |
| `Under Review` | `open` |
| `Request For Authorization` | `open` |
| `Assigned` | `open` |
| `Under Investigation` | `in_progress` |
| `Pending` | `on_hold` |
| `Resolved` | `resolved` |
| `Closed` | `closed` |
| `Cancelled` | `cancelled` |

## Priority Normalization

| BMC `Priority` | I/O `priority` |
|---|---|
| `Critical` | `critical` |
| `High` | `high` |
| `Medium` | `medium` |
| `Low` | `low` |

## IT/OT Categorization Strategy

BMC Helix uses a 3-tier categorization model (Tier 1 / Tier 2 / Tier 3). OT categorization depends on how the refinery configured these tiers:

1. **Categorization Tier 1 match (common):** Many BMC deployments have top-level categories like `OT-Infrastructure`, `Process Control`, `Instrumentation`. Configure a prefix/value list: `["OT-*", "Process Control", "Instrumentation", "DCS", "SCADA"]`.

2. **Operational Categorization:** BMC has a separate `Operational Categorization` taxonomy (Tier 1/2/3) distinct from Product Categorization. Some sites use this for IT/OT domain tagging. Check both during setup.

3. **Company/Organization field:** Some refineries use the `Company` field to separate IT and OT (e.g., different cost centers). Map OT company values to `is_ot = true`.

4. **CI Class derivation:** BMC Atrium CMDB has CI classes. If the linked CI belongs to class `BMC_ControlSystem`, `BMC_NetworkDevice` with OT subnet, etc., derive `is_ot` from CI metadata.

5. **Custom field:** Legacy Remedy deployments often have custom fields added for IT/OT domain. Discover during connection wizard.

The connection wizard should query the `Categorization Tier 1` distinct values and present them for IT/OT mapping.

## Sync Strategy

| Parameter | Value |
|---|---|
| **Watermark Column** | `Last Modified Date` |
| **Watermark Query** | `q='Last Modified Date'>"{last_sync_iso}"` |
| **Incidents** | Every 10 minutes, incremental by watermark |
| **Change Requests** | Every 15 minutes, incremental by watermark |
| **Problems** | Every 60 minutes, incremental by watermark |
| **Comments** | Every 15 minutes, incremental; keyed off parent ticket watermark |
| **Initial Load** | Filter by `Submit Date` (last 12 months). Paginate with `offset` + `limit=100`. |
| **Full Reconciliation** | Weekly full sync for records modified in last 90 days. |

### Endpoint Templates

**Incidents (Simplified API, incremental):**
```
GET /api/com.bmc.dsm.itsm.itsm-rest-api/v2/incident
  ?q='Last Modified Date'>"{last_sync}"
  &offset={offset}
  &limit=100
```

**Incidents (Legacy AR REST, incremental):**
```
GET /api/arsys/v1/entry/HPD:Help Desk
  ?q='Last Modified Date'>"{last_sync}"
  &offset={offset}
  &limit=100
```

**Change Requests (Simplified API):**
```
GET /api/com.bmc.dsm.itsm.itsm-rest-api/v2/change
  ?q='Last Modified Date'>"{last_sync}"
  &offset={offset}
  &limit=100
```

**Problems (Simplified API):**
```
GET /api/com.bmc.dsm.itsm.itsm-rest-api/v2/problem
  ?q='Last Modified Date'>"{last_sync}"
  &offset={offset}
  &limit=100
```

## Pre-Built Import Definition

```jsonc
{
  "name": "BMC Helix ITSM",
  "connector_type": "rest_api",
  "description": "Import incidents, change requests, and problems from BMC Helix ITSM / Remedy",
  "connection": {
    "base_url": "https://{{bmc_server}}",
    "auth_method": "bmc_token",
    "login": {
      "endpoint": "/api/rx/authentication/loginrequest",
      "method": "POST",
      "body": {
        "userName": "{{BMC_USERNAME}}",
        "password": "{{BMC_PASSWORD}}"
      },
      "token_location": "header",
      "token_header": "AR-JWT",
      "request_header_name": "Authorization",
      "request_header_prefix": "AR-JWT "
    },
    "headers": {
      "Accept": "application/json",
      "Content-Type": "application/json"
    },
    "rate_limit_rpm": 60,
    "timeout_seconds": 30
  },
  "sources": [
    {
      "name": "incidents",
      "target_table": "tickets",
      "endpoint": "/api/com.bmc.dsm.itsm.itsm-rest-api/v2/incident",
      "method": "GET",
      "params": {
        "q": "'Last Modified Date'>\"{last_sync}\""
      },
      "pagination": {
        "type": "offset",
        "offset_param": "offset",
        "limit_param": "limit",
        "page_size": 100
      },
      "response_root": "entries",
      "watermark_column": "Last Modified Date",
      "sync_interval_minutes": 10,
      "field_mappings": [
        { "source": "values.Incident Number", "target": "ticket_number" },
        { "source": "values.Incident Number", "target": "external_id" },
        { "source": null, "target": "source_system", "default": "bmc_helix" },
        { "source": null, "target": "ticket_type", "default": "incident" },
        { "source": "values.Description", "target": "title" },
        { "source": "values.Detailed Decription", "target": "description" },
        { "source": "values.Status", "target": "status", "transform": "status_map" },
        { "source": "values.Priority", "target": "priority", "transform": "priority_map" },
        { "source": "values.Categorization Tier 1", "target": "category" },
        { "source": "values.Categorization Tier 2", "target": "subcategory" },
        { "source": "values.Assignee", "target": "assigned_to" },
        { "source": "values.Assigned Group", "target": "assigned_group" },
        { "source": "values.Submitter", "target": "requester_name" },
        { "source": "values.CI Name", "target": "ci_name" },
        { "source": "values.Site", "target": "location" },
        { "source": "values.Submit Date", "target": "created_at_source", "transform": "parse_timestamp" },
        { "source": "values.Last Modified Date", "target": "updated_at_source", "transform": "parse_timestamp" },
        { "source": "values.Last Resolved Date", "target": "resolved_at", "transform": "parse_timestamp" },
        { "source": "values.Closed Date", "target": "closed_at", "transform": "parse_timestamp" }
      ],
      "value_maps": {
        "status_map": {
          "New": "new",
          "Assigned": "open",
          "In Progress": "in_progress",
          "Pending": "on_hold",
          "Resolved": "resolved",
          "Closed": "closed",
          "Cancelled": "cancelled"
        },
        "priority_map": {
          "Critical": "critical",
          "High": "high",
          "Medium": "medium",
          "Low": "low"
        }
      }
    },
    {
      "name": "change_requests",
      "target_table": "tickets",
      "endpoint": "/api/com.bmc.dsm.itsm.itsm-rest-api/v2/change",
      "method": "GET",
      "params": {
        "q": "'Last Modified Date'>\"{last_sync}\""
      },
      "pagination": {
        "type": "offset",
        "offset_param": "offset",
        "limit_param": "limit",
        "page_size": 100
      },
      "response_root": "entries",
      "watermark_column": "Last Modified Date",
      "sync_interval_minutes": 15,
      "field_mappings": [
        { "source": "values.Infrastructure Change ID", "target": "ticket_number" },
        { "source": "values.Infrastructure Change ID", "target": "external_id" },
        { "source": null, "target": "source_system", "default": "bmc_helix" },
        { "source": null, "target": "ticket_type", "default": "change_request" },
        { "source": "values.Description", "target": "title" },
        { "source": "values.Detailed Description", "target": "description" },
        { "source": "values.Change Request Status", "target": "status", "transform": "change_status_map" },
        { "source": "values.Priority", "target": "priority", "transform": "priority_map" },
        { "source": "values.Categorization Tier 1", "target": "category" },
        { "source": "values.Assignee", "target": "assigned_to" },
        { "source": "values.Assigned Group", "target": "assigned_group" },
        { "source": "values.Requester", "target": "requester_name" },
        { "source": "values.CI Name", "target": "ci_name" },
        { "source": "values.Location", "target": "location" },
        { "source": "values.Scheduled Start Date", "target": "planned_start_at", "transform": "parse_timestamp" },
        { "source": "values.Scheduled End Date", "target": "planned_end_at", "transform": "parse_timestamp" },
        { "source": "values.Submit Date", "target": "created_at_source", "transform": "parse_timestamp" },
        { "source": "values.Last Modified Date", "target": "updated_at_source", "transform": "parse_timestamp" },
        { "source": "values.Closed Date", "target": "closed_at", "transform": "parse_timestamp" }
      ],
      "value_maps": {
        "change_status_map": {
          "Draft": "new",
          "Request For Authorization": "open",
          "Request For Change": "open",
          "Planning In Progress": "open",
          "Scheduled For Review": "open",
          "Scheduled For Approval": "open",
          "Scheduled": "open",
          "Implementation In Progress": "in_progress",
          "Pending": "on_hold",
          "Rejected": "cancelled",
          "Completed": "resolved",
          "Closed": "closed",
          "Cancelled": "cancelled"
        },
        "priority_map": {
          "Critical": "critical",
          "High": "high",
          "Medium": "medium",
          "Low": "low"
        }
      }
    },
    {
      "name": "problems",
      "target_table": "tickets",
      "endpoint": "/api/com.bmc.dsm.itsm.itsm-rest-api/v2/problem",
      "method": "GET",
      "params": {
        "q": "'Last Modified Date'>\"{last_sync}\""
      },
      "pagination": {
        "type": "offset",
        "offset_param": "offset",
        "limit_param": "limit",
        "page_size": 100
      },
      "response_root": "entries",
      "watermark_column": "Last Modified Date",
      "sync_interval_minutes": 60,
      "field_mappings": [
        { "source": "values.Problem Investigation ID", "target": "ticket_number" },
        { "source": "values.Problem Investigation ID", "target": "external_id" },
        { "source": null, "target": "source_system", "default": "bmc_helix" },
        { "source": null, "target": "ticket_type", "default": "problem" },
        { "source": "values.Description", "target": "title" },
        { "source": "values.Detailed Description", "target": "description" },
        { "source": "values.Investigation Driver Status", "target": "status", "transform": "problem_status_map" },
        { "source": "values.Priority", "target": "priority", "transform": "priority_map" },
        { "source": "values.Categorization Tier 1", "target": "category" },
        { "source": "values.Assignee", "target": "assigned_to" },
        { "source": "values.Assigned Group", "target": "assigned_group" },
        { "source": "values.CI Name", "target": "ci_name" },
        { "source": "values.Location", "target": "location" },
        { "source": "values.Submit Date", "target": "created_at_source", "transform": "parse_timestamp" },
        { "source": "values.Last Modified Date", "target": "updated_at_source", "transform": "parse_timestamp" },
        { "source": "values.Last Resolved Date", "target": "resolved_at", "transform": "parse_timestamp" }
      ],
      "value_maps": {
        "problem_status_map": {
          "Draft": "new",
          "Under Review": "open",
          "Request For Authorization": "open",
          "Assigned": "open",
          "Under Investigation": "in_progress",
          "Pending": "on_hold",
          "Resolved": "resolved",
          "Closed": "closed",
          "Cancelled": "cancelled"
        },
        "priority_map": {
          "Critical": "critical",
          "High": "high",
          "Medium": "medium",
          "Low": "low"
        }
      }
    }
  ],
  "ot_classification": {
    "strategy": "combined",
    "rules": [
      { "type": "field_match", "field": "Categorization Tier 1", "values": ["OT-Infrastructure", "Process Control", "Instrumentation", "DCS", "SCADA"] },
      { "type": "group_pattern", "field": "Assigned Group", "patterns": ["OT-*", "DCS-*", "Instrument-*", "SCADA-*", "Control Systems*"] },
      { "type": "field_match", "field": "Operational Categorization Tier 1", "values": ["OT", "Process Control"] }
    ],
    "default_is_ot": false
  }
}
```

## Notes

- **Version detection is critical.** The connection wizard must probe both the Simplified API and the Legacy AR REST API during setup. Test `GET /api/com.bmc.dsm.itsm.itsm-rest-api/v2/incident?limit=1` first; if it 404s, fall back to `GET /api/arsys/v1/entry/HPD:Help Desk?limit=1`.
- **BMC misspells "Detailed Decription"** in the incident form. This is a known, longstanding BMC issue. The field name is literally `Detailed Decription` (missing an "s"). The connector must use this exact misspelling.
- **AR qualification syntax** uses single quotes around field names and double quotes around values: `'Priority'="Critical" AND 'Status'!="Closed"`. This differs from standard URL query syntax.
- **Timestamp format:** BMC returns timestamps in the server's configured timezone. Confirm timezone setting during connection wizard. Most enterprise deployments use UTC, but some on-prem installations use local time.
- **Token management:** BMC tokens have both idle timeout (default 15 min) and absolute timeout (default varies). The connector must track token age and proactively re-authenticate. On 401 response, re-login and retry the request.
- **CMDB access:** BMC Atrium CMDB uses a separate API surface (`/api/arsys/v1/entry/BMC.CORE:BMC_BaseElement`). CI lookups for hostname/IP extraction require additional API calls. Consider caching CI data locally with daily refresh.
- **Legacy SOAP:** Some Remedy 7.x deployments only expose SOAP/WSDL. This connector does not support SOAP. Sites on Remedy 7.x must upgrade to at least 8.x or expose the AR REST API (available since Remedy 8.0).
- **Heavy customization:** BMC/Remedy deployments in refineries are often heavily customized with additional forms, fields, and workflows. The field discovery step is not optional for this connector.
