# Ivanti Neurons for ITSM — Ticketing / ITSM Connector Profile

## Application Overview

| Attribute | Detail |
|---|---|
| **Vendor** | Ivanti, Inc. (acquired Cherwell 2021, acquired HEAT Software 2017) |
| **Product** | Ivanti Neurons for ITSM (legacy: Cherwell Service Management, HEAT ITSM) |
| **Market Position** | Mid-market leader (~1.5% ITSM share). Cherwell had significant presence in manufacturing and industrial verticals before Ivanti acquisition. Popular with mid-size refineries and chemical plants that found ServiceNow too expensive. |
| **Licensing** | API access included with ITSM license. Integration account needs ITSM license seat. |
| **Refinery Scenario** | Mid-size plants that adopted Cherwell or HEAT before Ivanti consolidated them. Expect legacy Cherwell REST API at sites that haven't migrated to Neurons. Flexible business object schema means configurations vary significantly between deployments. |

## API Surface

| Attribute | Value |
|---|---|
| **API Type** | REST (JSON, OData query syntax) |
| **Cloud Base URL** | `https://<tenant>.ivanticloud.com/api/odata/businessobject` |
| **On-Prem Base URL** | `https://<server>/api/odata/businessobject` |
| **Legacy Cherwell API** | `https://<server>/CherwellAPI/api/V1` (may still be active at unmigrated sites) |
| **Authentication** | OAuth 2.0 Client Credentials (Neurons). REST API Key (static, simpler). Legacy Cherwell: OAuth 2.0 Resource Owner. |
| **Pagination** | OData: `$top` + `$skip`. |
| **Rate Limits** | Cloud: ~1 request/second per tenant (enforced, returns HTTP 429). On-Prem: admin-configurable. |
| **API Docs** | `https://help.ivanti.com/ht/help/en_US/ISM/` |

**Key API features:**
- OData query syntax for filtering: `$filter`, `$select`, `$orderby`, `$expand`
- All entities are "Business Objects" with configurable schemas
- Business objects identified by `RecID` (internal GUID) and display name
- Relationship API for linked objects (incident → CI → change)

### Authentication Configuration

**OAuth 2.0 Client Credentials (Neurons Cloud):**
```jsonc
{
  "auth_method": "oauth2_client_credentials",
  "oauth2": {
    "client_id": "{{IVANTI_CLIENT_ID}}",
    "client_secret": "{{IVANTI_CLIENT_SECRET}}",
    "token_url": "https://{{tenant}}.ivanticloud.com/token",
    "grant_type": "client_credentials"
  }
}
```

**REST API Key (simpler, less secure):**
```jsonc
{
  "auth_method": "api_key",
  "api_key": {
    "key": "{{IVANTI_API_KEY}}",
    "header_name": "Authorization",
    "header_prefix": "rest_api_key="
  }
}
```

**Legacy Cherwell OAuth:**
```jsonc
{
  "auth_method": "oauth2_password",
  "oauth2": {
    "client_id": "{{CHERWELL_CLIENT_ID}}",
    "grant_type": "password",
    "username": "{{CHERWELL_USERNAME}}",
    "password": "{{CHERWELL_PASSWORD}}",
    "token_url": "https://{{server}}/CherwellAPI/token"
  }
}
```

## Target Tables

| I/O Table | Ivanti Source | Priority |
|---|---|---|
| `tickets` | Incidents, Changes, Problems (Business Objects) | Primary |
| `ticket_comments` | Journal entries / notes on business objects | Secondary |

## Field Mapping — Incidents

### `incidents` Business Object to `tickets`

Ivanti Neurons uses configurable business object schemas. Field names below reflect the default ITSM configuration. Actual field names may differ per deployment.

| Ivanti Field | I/O Column | Transform |
|---|---|---|
| `RecID` | `extra_data.rec_id` | Internal GUID; store for API reference |
| `IncidentNumber` | `ticket_number`, `external_id` | Direct map (e.g., `10001234`) |
| — | `source_system` | Constant: `ivanti_neurons` |
| — | `ticket_type` | Constant: `incident` |
| `Subject` | `title` | Direct map |
| `Symptom` | `description` | Direct map (may contain HTML) |
| `Status` | `status` | Value map (see normalization table) |
| `Priority` | `priority` | Value map (see normalization table) |
| `Category` | `category` | Direct map |
| `Subcategory` | `subcategory` | Direct map |
| Derived | `is_ot` | See IT/OT categorization strategy |
| `Owner` | `assigned_to` | Assigned technician display name |
| `OwnerTeam` | `assigned_group` | Assigned team name |
| `ProfileFullName` (Customer) | `requester_name` | Customer who raised the incident |
| `ProfileEmail` (Customer) | `requester_email` | Customer email |
| `LinkedCI` or `CIName` | `ci_name` | Linked Configuration Item name |
| `LinkedCIRecID` | `ci_id` | CI Record ID |
| — | `hostname` | Extract from CI business object |
| — | `ip_address` | Extract from CI business object |
| `Site` | `location` | Direct map |
| — | `planned_start_at` | NULL for incidents |
| — | `planned_end_at` | NULL for incidents |
| `CreatedDateTime` | `created_at_source` | ISO 8601 timestamp |
| `LastModDateTime` | `updated_at_source` | ISO 8601 timestamp |
| `ResolvedDateTime` | `resolved_at` | ISO 8601; NULL if unresolved |
| `ClosedDateTime` | `closed_at` | ISO 8601; NULL if not closed |
| `Impact`, `Urgency` | `extra_data.impact`, `extra_data.urgency` | Store in JSONB |
| Computed URL | `extra_data.external_url` | `https://<tenant>.ivanticloud.com/app/incident/{IncidentNumber}` |

### Changes Business Object to `tickets`

| Ivanti Field | I/O Column | Transform |
|---|---|---|
| `RecID` | `extra_data.rec_id` | Internal GUID |
| `ChangeNumber` | `ticket_number`, `external_id` | Direct map |
| — | `source_system` | Constant: `ivanti_neurons` |
| — | `ticket_type` | Constant: `change_request` |
| `Title` or `Subject` | `title` | Direct map |
| `Description` | `description` | Direct map |
| `Status` | `status` | Change-specific value map (see below) |
| `Priority` | `priority` | Same priority map |
| `Category` | `category` | Direct map |
| `ChangeType` | `extra_data.change_type` | `Standard`, `Normal`, `Emergency`, `Major` |
| `RiskLevel` | `extra_data.risk_level` | Store in JSONB |
| `Owner` | `assigned_to` | Direct map |
| `OwnerTeam` | `assigned_group` | Direct map |
| `Requestor` | `requester_name` | Direct map |
| `CIName` | `ci_name` | Direct map |
| `Site` | `location` | Direct map |
| `ScheduledStartDate` | `planned_start_at` | ISO 8601 |
| `ScheduledEndDate` | `planned_end_at` | ISO 8601 |
| `ActualStartDate` | `extra_data.actual_start` | Store in JSONB |
| `ActualEndDate` | `extra_data.actual_end` | Store in JSONB |
| `CreatedDateTime` | `created_at_source` | ISO 8601 |
| `LastModDateTime` | `updated_at_source` | ISO 8601 |
| `ClosedDateTime` | `closed_at` | ISO 8601 |

### Problems Business Object to `tickets`

| Ivanti Field | I/O Column | Transform |
|---|---|---|
| `RecID` | `extra_data.rec_id` | Internal GUID |
| `ProblemNumber` | `ticket_number`, `external_id` | Direct map |
| — | `source_system` | Constant: `ivanti_neurons` |
| — | `ticket_type` | Constant: `problem` |
| `Subject` | `title` | Direct map |
| `Description` | `description` | Direct map |
| `Status` | `status` | Problem-specific value map (see below) |
| `Priority` | `priority` | Same priority map |
| `Category` | `category` | Direct map |
| `RootCause` | `extra_data.root_cause` | Store in JSONB |
| `Workaround` | `extra_data.workaround` | Store in JSONB |
| `Owner` | `assigned_to` | Direct map |
| `OwnerTeam` | `assigned_group` | Direct map |
| `CIName` | `ci_name` | Direct map |
| `Site` | `location` | Direct map |
| `CreatedDateTime` | `created_at_source` | ISO 8601 |
| `LastModDateTime` | `updated_at_source` | ISO 8601 |
| `ResolvedDateTime` | `resolved_at` | ISO 8601 |
| `ClosedDateTime` | `closed_at` | ISO 8601 |

### Journal Entries to `ticket_comments`

Ivanti stores notes/journals as child business objects linked to the parent ticket.

| Ivanti Field | I/O Column | Transform |
|---|---|---|
| `RecID` | `external_id` | Journal entry GUID |
| Parent RecID | `ticket_id` | Lookup ticket by external_id → FK |
| `JournalTypeName` | `is_internal` | `Internal Note` → `true`; `Customer Visible` → `false` |
| `Details` | `comment_text` | Direct map; may contain HTML |
| `CreatedBy` | `author_name` | Direct map |
| `CreatedDateTime` | `commented_at` | ISO 8601 |

## Status Normalization

### Incident `Status` to I/O `status`

| Ivanti `Status` | I/O `status` |
|---|---|
| `Logged` | `new` |
| `Active` | `open` |
| `In Progress` | `in_progress` |
| `Waiting for Customer` | `on_hold` |
| `Waiting for 3rd Party` | `on_hold` |
| `Pending` | `on_hold` |
| `Resolved` | `resolved` |
| `Closed` | `closed` |
| `Cancelled` | `cancelled` |

### Change `Status` to I/O `status`

| Ivanti `Status` | I/O `status` |
|---|---|
| `Logged` | `new` |
| `Submitted` | `new` |
| `Under Review` | `open` |
| `Pending Approval` | `open` |
| `Approved` | `open` |
| `Scheduled` | `open` |
| `In Progress` / `Implementing` | `in_progress` |
| `Pending` | `on_hold` |
| `Completed` | `resolved` |
| `Closed` | `closed` |
| `Rejected` | `cancelled` |
| `Cancelled` | `cancelled` |

### Problem `Status` to I/O `status`

| Ivanti `Status` | I/O `status` |
|---|---|
| `Logged` | `new` |
| `Active` | `open` |
| `Under Investigation` | `in_progress` |
| `Root Cause Identified` | `in_progress` |
| `Known Error` | `in_progress` |
| `Pending` | `on_hold` |
| `Resolved` | `resolved` |
| `Closed` | `closed` |

## Priority Normalization

| Ivanti `Priority` | I/O `priority` |
|---|---|
| `1` / `Critical` | `critical` |
| `2` / `High` | `high` |
| `3` / `Medium` | `medium` |
| `4` / `Low` | `low` |
| `5` / `Very Low` | `low` |

> **Note:** Ivanti deployments use either numeric or named priorities depending on configuration. The value map should handle both formats.

## IT/OT Categorization Strategy

Ivanti's configurable business object schema means OT classification depends heavily on how the site customized their ITSM:

1. **Category/Subcategory match:** Default Ivanti category trees can include OT entries. Map categories: `["OT", "Process Control", "DCS", "Instrumentation", "SCADA"]` → `is_ot = true`.

2. **Service group:** Ivanti's service catalog groups can distinguish IT from OT services. If the incident is raised against an OT service, derive `is_ot`.

3. **Owner Team pattern:** OT-specific teams in the `OwnerTeam` field. Pattern match: `["OT-*", "DCS-*", "Instrument-*", "Control Systems*", "SCADA-*"]`.

4. **Custom field:** Ivanti's configurable schema makes it easy to add an `OT_Domain` field to business objects. Discover custom fields during the connection wizard.

5. **CI class:** If the linked CI belongs to an OT-specific class or category in Ivanti's CMDB, derive `is_ot` from the CI record.

The connection wizard should:
1. Test API connectivity and detect Neurons vs. legacy Cherwell
2. Fetch business object schema (`GET /api/odata/businessobject/incidents?$top=1`) to discover available fields
3. Present field names for mapping
4. Configure OT classification rule

## Sync Strategy

| Parameter | Value |
|---|---|
| **Watermark Column** | `LastModDateTime` |
| **Watermark Query** | OData: `$filter=LastModDateTime gt {last_sync_iso}` |
| **Incidents** | Every 10 minutes, incremental by watermark |
| **Change Requests** | Every 15 minutes, incremental by watermark |
| **Problems** | Every 60 minutes, incremental by watermark |
| **Comments** | Every 15 minutes; fetch journals for recently modified tickets |
| **Initial Load** | Filter by `CreatedDateTime` (last 12 months). Paginate with `$top=100` + `$skip`. |
| **Full Reconciliation** | Weekly full sync for records modified in last 90 days. |
| **Rate Limit Handling** | Cloud enforces ~1 req/sec. Implement 1-second delay between requests. On HTTP 429, backoff with `Retry-After` header. |

### Endpoint Templates

**Incidents (incremental):**
```
GET /api/odata/businessobject/incidents
  ?$filter=LastModDateTime gt {{last_sync_iso}}
  &$select=RecID,IncidentNumber,Subject,Symptom,Category,Subcategory,Priority,Status,Owner,OwnerTeam,ProfileFullName,ProfileEmail,CIName,LinkedCIRecID,Site,CreatedDateTime,LastModDateTime,ResolvedDateTime,ClosedDateTime,Impact,Urgency
  &$orderby=LastModDateTime asc
  &$top=100
  &$skip={{offset}}
```

**Changes (incremental):**
```
GET /api/odata/businessobject/changes
  ?$filter=LastModDateTime gt {{last_sync_iso}}
  &$select=RecID,ChangeNumber,Title,Description,Category,Priority,Status,ChangeType,RiskLevel,Owner,OwnerTeam,Requestor,CIName,Site,ScheduledStartDate,ScheduledEndDate,ActualStartDate,ActualEndDate,CreatedDateTime,LastModDateTime,ClosedDateTime
  &$orderby=LastModDateTime asc
  &$top=100
  &$skip={{offset}}
```

**Problems (incremental):**
```
GET /api/odata/businessobject/problems
  ?$filter=LastModDateTime gt {{last_sync_iso}}
  &$select=RecID,ProblemNumber,Subject,Description,Category,Priority,Status,RootCause,Workaround,Owner,OwnerTeam,CIName,Site,CreatedDateTime,LastModDateTime,ResolvedDateTime,ClosedDateTime
  &$orderby=LastModDateTime asc
  &$top=100
  &$skip={{offset}}
```

**Journal entries for incident:**
```
GET /api/odata/businessobject/incidents('{{RecID}}')/Journal
  ?$select=RecID,JournalTypeName,Details,CreatedBy,CreatedDateTime
  &$orderby=CreatedDateTime asc
  &$top=100
  &$skip=0
```

## Pre-Built Import Definition

```jsonc
{
  "name": "Ivanti Neurons for ITSM",
  "connector_type": "rest_api",
  "description": "Import incidents, changes, and problems from Ivanti Neurons for ITSM",
  "connection": {
    "base_url": "https://{{tenant}}.ivanticloud.com",
    "auth_method": "oauth2_client_credentials",
    "oauth2": {
      "client_id": "{{IVANTI_CLIENT_ID}}",
      "client_secret": "{{IVANTI_CLIENT_SECRET}}",
      "token_url": "https://{{tenant}}.ivanticloud.com/token",
      "grant_type": "client_credentials"
    },
    "headers": {
      "Accept": "application/json"
    },
    "rate_limit_rpm": 60,
    "request_delay_ms": 1000,
    "timeout_seconds": 30
  },
  "sources": [
    {
      "name": "incidents",
      "target_table": "tickets",
      "endpoint": "/api/odata/businessobject/incidents",
      "method": "GET",
      "params": {
        "$filter": "LastModDateTime gt {{last_sync_iso}}",
        "$select": "RecID,IncidentNumber,Subject,Symptom,Category,Subcategory,Priority,Status,Owner,OwnerTeam,ProfileFullName,ProfileEmail,CIName,LinkedCIRecID,Site,CreatedDateTime,LastModDateTime,ResolvedDateTime,ClosedDateTime,Impact,Urgency",
        "$orderby": "LastModDateTime asc",
        "$top": "100"
      },
      "pagination": {
        "type": "offset",
        "offset_param": "$skip",
        "limit_param": "$top",
        "page_size": 100
      },
      "response_root": "value",
      "watermark_column": "LastModDateTime",
      "sync_interval_minutes": 10,
      "field_mappings": [
        { "source": "IncidentNumber", "target": "ticket_number" },
        { "source": "IncidentNumber", "target": "external_id" },
        { "source": null, "target": "source_system", "default": "ivanti_neurons" },
        { "source": null, "target": "ticket_type", "default": "incident" },
        { "source": "Subject", "target": "title" },
        { "source": "Symptom", "target": "description", "transform": "strip_html" },
        { "source": "Status", "target": "status", "transform": "status_map" },
        { "source": "Priority", "target": "priority", "transform": "priority_map" },
        { "source": "Category", "target": "category" },
        { "source": "Subcategory", "target": "subcategory" },
        { "source": "Owner", "target": "assigned_to" },
        { "source": "OwnerTeam", "target": "assigned_group" },
        { "source": "ProfileFullName", "target": "requester_name" },
        { "source": "ProfileEmail", "target": "requester_email" },
        { "source": "CIName", "target": "ci_name" },
        { "source": "LinkedCIRecID", "target": "ci_id" },
        { "source": "Site", "target": "location" },
        { "source": "CreatedDateTime", "target": "created_at_source", "transform": "parse_iso8601" },
        { "source": "LastModDateTime", "target": "updated_at_source", "transform": "parse_iso8601" },
        { "source": "ResolvedDateTime", "target": "resolved_at", "transform": "parse_iso8601" },
        { "source": "ClosedDateTime", "target": "closed_at", "transform": "parse_iso8601" }
      ],
      "value_maps": {
        "status_map": {
          "Logged": "new",
          "Active": "open",
          "In Progress": "in_progress",
          "Waiting for Customer": "on_hold",
          "Waiting for 3rd Party": "on_hold",
          "Pending": "on_hold",
          "Resolved": "resolved",
          "Closed": "closed",
          "Cancelled": "cancelled"
        },
        "priority_map": {
          "1": "critical",
          "Critical": "critical",
          "2": "high",
          "High": "high",
          "3": "medium",
          "Medium": "medium",
          "4": "low",
          "Low": "low",
          "5": "low",
          "Very Low": "low"
        }
      }
    },
    {
      "name": "changes",
      "target_table": "tickets",
      "endpoint": "/api/odata/businessobject/changes",
      "method": "GET",
      "params": {
        "$filter": "LastModDateTime gt {{last_sync_iso}}",
        "$select": "RecID,ChangeNumber,Title,Description,Category,Priority,Status,ChangeType,RiskLevel,Owner,OwnerTeam,Requestor,CIName,Site,ScheduledStartDate,ScheduledEndDate,ActualStartDate,ActualEndDate,CreatedDateTime,LastModDateTime,ClosedDateTime",
        "$orderby": "LastModDateTime asc",
        "$top": "100"
      },
      "pagination": {
        "type": "offset",
        "offset_param": "$skip",
        "limit_param": "$top",
        "page_size": 100
      },
      "response_root": "value",
      "watermark_column": "LastModDateTime",
      "sync_interval_minutes": 15,
      "field_mappings": [
        { "source": "ChangeNumber", "target": "ticket_number" },
        { "source": "ChangeNumber", "target": "external_id" },
        { "source": null, "target": "source_system", "default": "ivanti_neurons" },
        { "source": null, "target": "ticket_type", "default": "change_request" },
        { "source": "Title", "target": "title" },
        { "source": "Description", "target": "description", "transform": "strip_html" },
        { "source": "Status", "target": "status", "transform": "change_status_map" },
        { "source": "Priority", "target": "priority", "transform": "priority_map" },
        { "source": "Category", "target": "category" },
        { "source": "Owner", "target": "assigned_to" },
        { "source": "OwnerTeam", "target": "assigned_group" },
        { "source": "Requestor", "target": "requester_name" },
        { "source": "CIName", "target": "ci_name" },
        { "source": "Site", "target": "location" },
        { "source": "ScheduledStartDate", "target": "planned_start_at", "transform": "parse_iso8601" },
        { "source": "ScheduledEndDate", "target": "planned_end_at", "transform": "parse_iso8601" },
        { "source": "CreatedDateTime", "target": "created_at_source", "transform": "parse_iso8601" },
        { "source": "LastModDateTime", "target": "updated_at_source", "transform": "parse_iso8601" },
        { "source": "ClosedDateTime", "target": "closed_at", "transform": "parse_iso8601" }
      ],
      "value_maps": {
        "change_status_map": {
          "Logged": "new",
          "Submitted": "new",
          "Under Review": "open",
          "Pending Approval": "open",
          "Approved": "open",
          "Scheduled": "open",
          "In Progress": "in_progress",
          "Implementing": "in_progress",
          "Pending": "on_hold",
          "Completed": "resolved",
          "Closed": "closed",
          "Rejected": "cancelled",
          "Cancelled": "cancelled"
        },
        "priority_map": {
          "1": "critical",
          "Critical": "critical",
          "2": "high",
          "High": "high",
          "3": "medium",
          "Medium": "medium",
          "4": "low",
          "Low": "low",
          "5": "low",
          "Very Low": "low"
        }
      }
    },
    {
      "name": "problems",
      "target_table": "tickets",
      "endpoint": "/api/odata/businessobject/problems",
      "method": "GET",
      "params": {
        "$filter": "LastModDateTime gt {{last_sync_iso}}",
        "$select": "RecID,ProblemNumber,Subject,Description,Category,Priority,Status,RootCause,Workaround,Owner,OwnerTeam,CIName,Site,CreatedDateTime,LastModDateTime,ResolvedDateTime,ClosedDateTime",
        "$orderby": "LastModDateTime asc",
        "$top": "100"
      },
      "pagination": {
        "type": "offset",
        "offset_param": "$skip",
        "limit_param": "$top",
        "page_size": 100
      },
      "response_root": "value",
      "watermark_column": "LastModDateTime",
      "sync_interval_minutes": 60,
      "field_mappings": [
        { "source": "ProblemNumber", "target": "ticket_number" },
        { "source": "ProblemNumber", "target": "external_id" },
        { "source": null, "target": "source_system", "default": "ivanti_neurons" },
        { "source": null, "target": "ticket_type", "default": "problem" },
        { "source": "Subject", "target": "title" },
        { "source": "Description", "target": "description", "transform": "strip_html" },
        { "source": "Status", "target": "status", "transform": "problem_status_map" },
        { "source": "Priority", "target": "priority", "transform": "priority_map" },
        { "source": "Category", "target": "category" },
        { "source": "Owner", "target": "assigned_to" },
        { "source": "OwnerTeam", "target": "assigned_group" },
        { "source": "CIName", "target": "ci_name" },
        { "source": "Site", "target": "location" },
        { "source": "CreatedDateTime", "target": "created_at_source", "transform": "parse_iso8601" },
        { "source": "LastModDateTime", "target": "updated_at_source", "transform": "parse_iso8601" },
        { "source": "ResolvedDateTime", "target": "resolved_at", "transform": "parse_iso8601" },
        { "source": "ClosedDateTime", "target": "closed_at", "transform": "parse_iso8601" }
      ],
      "value_maps": {
        "problem_status_map": {
          "Logged": "new",
          "Active": "open",
          "Under Investigation": "in_progress",
          "Root Cause Identified": "in_progress",
          "Known Error": "in_progress",
          "Pending": "on_hold",
          "Resolved": "resolved",
          "Closed": "closed"
        },
        "priority_map": {
          "1": "critical",
          "Critical": "critical",
          "2": "high",
          "High": "high",
          "3": "medium",
          "Medium": "medium",
          "4": "low",
          "Low": "low",
          "5": "low",
          "Very Low": "low"
        }
      }
    }
  ],
  "ot_classification": {
    "strategy": "combined",
    "rules": [
      { "type": "category_match", "field": "Category", "values": ["OT", "Process Control", "DCS", "Instrumentation", "SCADA"] },
      { "type": "group_pattern", "field": "OwnerTeam", "patterns": ["OT-*", "DCS-*", "Instrument-*", "Control Systems*", "SCADA-*"] },
      { "type": "custom_field", "field": "{{ot_domain_field}}", "values": ["OT", "IT/OT"] }
    ],
    "default_is_ot": false
  }
}
```

## Notes

- **Rate limiting is the primary constraint.** Ivanti Cloud enforces ~1 request/second per tenant. This means a bulk sync of 10,000 incidents at 100/page takes ~100 seconds minimum. The connector must implement a 1-second delay between requests and respect HTTP 429 responses with `Retry-After` backoff.
- **Business object schema is configurable.** Ivanti Neurons lets admins rename fields, add custom fields, and restructure business objects. Field names in this profile reflect defaults. The connection wizard must include a schema discovery step: fetch one record from each business object type and present the actual field names for mapping.
- **Legacy Cherwell detection.** Some sites still run Cherwell Service Management (pre-Ivanti). The connection wizard should test `GET /api/odata/businessobject/incidents?$top=1` for Neurons. If that fails, test `GET /CherwellAPI/api/V1/getbusinessobjectsummary/busobname/Incident` for legacy Cherwell. The legacy API uses a different authentication flow and response format.
- **OData query complexity.** OData `$filter` supports rich expressions: `$filter=Status ne 'Closed' and Priority eq 'Critical' and LastModDateTime gt 2024-01-01T00:00:00Z`. Useful for pre-filtering OT tickets at the API level to reduce data transfer.
- **Relationship expansion.** OData `$expand` can inline related objects (e.g., `$expand=CI` to include CI details inline). This reduces the need for separate CI lookup calls but increases response size. Use for initial load; skip for incremental sync.
- **Ivanti Neurons vs. Ivanti Service Manager.** Ivanti has multiple ITSM products from acquisitions. "Ivanti Neurons for ITSM" is the Cherwell successor. "Ivanti Service Manager" is the HEAT successor. Their APIs are different. This profile covers Neurons (Cherwell lineage). If a site runs Service Manager (HEAT lineage), a separate profile would be needed, but this is uncommon in refineries.
- **No native webhook support.** Ivanti Neurons does not offer webhooks for business object changes as of current versions. Polling is the only option. The tight rate limit makes this a slower near-real-time integration compared to ServiceNow or JSM.
