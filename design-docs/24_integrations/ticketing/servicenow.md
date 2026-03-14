# ServiceNow — Ticketing / ITSM Connector Profile

## Application Overview

| Attribute | Detail |
|---|---|
| **Vendor** | ServiceNow, Inc. |
| **Product** | ServiceNow IT Service Management (Now Platform) |
| **Market Position** | Dominant market leader (~40% enterprise ITSM share). 7-time Gartner MQ Leader for ITSM. Used by most major oil & gas companies (Shell, BP, ExxonMobil, Chevron). |
| **Licensing** | API access included with ITSM license. No separate API license. Integration user requires ITIL role or equivalent. |
| **Refinery Scenario** | Virtually all large refineries with enterprise IT organizations run ServiceNow. Typically both IT and OT tickets coexist in a single instance, sometimes with a dedicated OT category tree or custom `u_domain` field. |

## API Surface

| Attribute | Value |
|---|---|
| **API Type** | REST (JSON) |
| **Base URL** | `https://<instance>.service-now.com/api/now/table` |
| **Authentication** | OAuth 2.0 Client Credentials (recommended) or Basic Auth (fallback) |
| **Token URL** | `https://<instance>.service-now.com/oauth_token.do` |
| **Pagination** | Offset-based: `sysparm_offset` + `sysparm_limit` (max 10,000/page). `X-Total-Count` header for total records. |
| **Rate Limits** | Admin-configurable per instance. Typical: 100-500 requests/min for integration accounts. Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`. |
| **API Docs** | `https://developer.servicenow.com/dev.do` |

**Key API features:**
- Table API: `GET /api/now/table/{tableName}` with query params
- `sysparm_display_value=true` resolves reference fields inline (returns display names instead of sys_ids)
- `sysparm_fields` limits returned columns (reduces payload)
- `sysparm_query` uses ServiceNow encoded query syntax
- REST API Explorer built into every instance: `https://<instance>.service-now.com/$restapi.do`

### Authentication Configuration

```jsonc
{
  "auth_method": "oauth2_client_credentials",
  "oauth2": {
    "client_id": "{{SERVICENOW_CLIENT_ID}}",
    "client_secret": "{{SERVICENOW_CLIENT_SECRET}}",
    "token_url": "https://{{instance}}.service-now.com/oauth_token.do",
    "grant_type": "password",
    "username": "{{SERVICENOW_USERNAME}}",
    "password": "{{SERVICENOW_PASSWORD}}"
  },
  "fallback_basic": {
    "username": "{{SERVICENOW_USERNAME}}",
    "password": "{{SERVICENOW_PASSWORD}}"
  }
}
```

> **Note:** ServiceNow OAuth 2.0 uses the Resource Owner Password grant (requires username/password in addition to client credentials). Pure client_credentials grant requires a separate configuration in ServiceNow's Application Registry.

## Target Tables

| I/O Table | ServiceNow Source | Priority |
|---|---|---|
| `tickets` | `incident`, `change_request`, `problem`, `sc_request` | Primary |
| `ticket_comments` | `sys_journal_field` (work notes / comments) | Secondary |

## Field Mapping — Incidents

### `incident` to `tickets`

| ServiceNow Field | I/O Column | Transform |
|---|---|---|
| `sys_id` | `extra_data.sys_id` | Store in JSONB for deep-link construction |
| `number` | `ticket_number` | Direct map |
| `number` | `external_id` | Direct map |
| — | `source_system` | Constant: `servicenow` |
| — | `ticket_type` | Constant: `incident` |
| `short_description` | `title` | Direct map |
| `description` | `description` | Direct map |
| `state` | `status` | Value map (see normalization table) |
| `priority` | `priority` | Value map (see normalization table) |
| `category` | `category` | Direct map (ServiceNow native category) |
| `subcategory` | `subcategory` | Direct map |
| `u_domain` or derived | `is_ot` | See IT/OT categorization strategy |
| `assigned_to.display_value` | `assigned_to` | Resolve via `sysparm_display_value=true` |
| `assignment_group.display_value` | `assigned_group` | Resolve via `sysparm_display_value=true` |
| `caller_id.display_value` | `requester_name` | Resolve via `sysparm_display_value=true` |
| `caller_id.email` | `requester_email` | Requires separate lookup or `sysparm_display_value=all` |
| `cmdb_ci.display_value` | `ci_name` | Resolve via `sysparm_display_value=true` |
| `cmdb_ci.value` | `ci_id` | sys_id of the CI record |
| — | `hostname` | Extract from CI record if class is Server/Computer |
| — | `ip_address` | Extract from CI record if available |
| `location.display_value` | `location` | Resolve via `sysparm_display_value=true` |
| — | `planned_start_at` | NULL for incidents |
| — | `planned_end_at` | NULL for incidents |
| `sys_created_on` | `created_at_source` | Parse: `YYYY-MM-DD HH:MM:SS` (UTC) |
| `sys_updated_on` | `updated_at_source` | Parse: `YYYY-MM-DD HH:MM:SS` (UTC) |
| `resolved_at` | `resolved_at` | Parse timestamp; NULL if unresolved |
| `closed_at` | `closed_at` | Parse timestamp; NULL if not closed |
| `impact`, `urgency` | `extra_data.impact`, `extra_data.urgency` | Store in JSONB |
| Computed URL | `extra_data.external_url` | `https://<instance>.service-now.com/nav_to.do?uri=incident.do?sys_id={sys_id}` |

### `change_request` to `tickets`

| ServiceNow Field | I/O Column | Transform |
|---|---|---|
| `number` | `ticket_number`, `external_id` | Direct map |
| — | `source_system` | Constant: `servicenow` |
| — | `ticket_type` | Constant: `change_request` |
| `short_description` | `title` | Direct map |
| `description` | `description` | Direct map |
| `state` | `status` | Change-specific value map (see below) |
| `priority` | `priority` | Same priority map as incidents |
| `category` | `category` | Direct map |
| `type` | `extra_data.change_type` | `Normal`, `Standard`, `Emergency` |
| `risk` | `extra_data.risk_level` | Store in JSONB |
| `assigned_to.display_value` | `assigned_to` | Resolve display |
| `assignment_group.display_value` | `assigned_group` | Resolve display |
| `requested_by.display_value` | `requester_name` | Resolve display |
| `cmdb_ci.display_value` | `ci_name` | Resolve display |
| `cmdb_ci.value` | `ci_id` | sys_id |
| `location.display_value` | `location` | Resolve display |
| `start_date` | `planned_start_at` | Scheduled implementation start |
| `end_date` | `planned_end_at` | Scheduled implementation end |
| `work_start` | `extra_data.actual_start` | Actual work start |
| `work_end` | `extra_data.actual_end` | Actual work end |
| `sys_created_on` | `created_at_source` | Parse timestamp |
| `sys_updated_on` | `updated_at_source` | Parse timestamp |
| `closed_at` | `closed_at` | Parse timestamp |

### `problem` to `tickets`

| ServiceNow Field | I/O Column | Transform |
|---|---|---|
| `number` | `ticket_number`, `external_id` | Direct map |
| — | `source_system` | Constant: `servicenow` |
| — | `ticket_type` | Constant: `problem` |
| `short_description` | `title` | Direct map |
| `description` | `description` | Direct map |
| `problem_state` | `status` | Problem-specific value map (see below) |
| `priority` | `priority` | Same priority map |
| `category` | `category` | Direct map |
| `assigned_to.display_value` | `assigned_to` | Resolve display |
| `assignment_group.display_value` | `assigned_group` | Resolve display |
| `cmdb_ci.display_value` | `ci_name` | Resolve display |
| `cause_notes` | `extra_data.root_cause` | Store in JSONB |
| `workaround` | `extra_data.workaround` | Store in JSONB |
| `related_incidents` | `extra_data.related_incident_count` | Count or store in JSONB |
| `sys_created_on` | `created_at_source` | Parse timestamp |
| `sys_updated_on` | `updated_at_source` | Parse timestamp |
| `resolved_at` | `resolved_at` | Parse timestamp |
| `location.display_value` | `location` | Resolve display |

### `sys_journal_field` to `ticket_comments`

| ServiceNow Field | I/O Column | Transform |
|---|---|---|
| `sys_id` | `external_id` | Journal entry sys_id |
| `element_id` | `ticket_id` | Lookup ticket by sys_id → FK |
| `name` | `is_internal` | `work_notes` → `true`; `comments` → `false` |
| `value` | `comment_text` | Direct map (may contain HTML) |
| `sys_created_by` | `author_name` | Username; resolve to display name if needed |
| `sys_created_on` | `commented_at` | Parse timestamp |

## Status Normalization

### Incident `state` to I/O `status`

| ServiceNow `state` (int) | ServiceNow Label | I/O `status` |
|---|---|---|
| `1` | New | `new` |
| `2` | In Progress | `in_progress` |
| `3` | On Hold | `on_hold` |
| `6` | Resolved | `resolved` |
| `7` | Closed | `closed` |
| `8` | Cancelled | `cancelled` |

### Change Request `state` to I/O `status`

| ServiceNow `state` (int) | ServiceNow Label | I/O `status` |
|---|---|---|
| `-5` | New | `new` |
| `-4` | Assess | `open` |
| `-3` | Authorize | `open` |
| `-2` | Scheduled | `open` |
| `-1` | Implement | `in_progress` |
| `0` | Review | `in_progress` |
| `3` | Closed | `closed` |
| `4` | Cancelled | `cancelled` |

### Problem `problem_state` to I/O `status`

| ServiceNow `problem_state` (int) | ServiceNow Label | I/O `status` |
|---|---|---|
| `1` | Open | `open` |
| `2` | Known Error | `in_progress` |
| `3` | Pending Change | `on_hold` |
| `4` | Closed/Resolved | `resolved` |

## Priority Normalization

| ServiceNow `priority` (int) | ServiceNow Label | I/O `priority` |
|---|---|---|
| `1` | Critical | `critical` |
| `2` | High | `high` |
| `3` | Moderate | `medium` |
| `4` | Low | `low` |
| `5` | Planning | `low` |

## IT/OT Categorization Strategy

ServiceNow does not natively distinguish IT from OT tickets. The `is_ot` boolean must be derived. Configure one of these strategies in the import definition:

1. **Custom field (preferred):** Many ServiceNow admins create `u_domain` or `u_ticket_domain` with values `IT`, `OT`, `IT/OT`. Map directly: `u_domain IN ('OT', 'IT/OT')` → `is_ot = true`.

2. **Assignment group pattern:** OT tickets are often assigned to groups like `OT-Network`, `DCS-Support`, `Instrument-Maintenance`. Configure a group name pattern list: `["OT-*", "DCS-*", "Instrument-*", "SCADA-*", "PLC-*"]`.

3. **Category tree:** If ServiceNow categories include OT-specific entries (`OT > Network`, `OT > DCS`, `OT > Instrumentation`), match on the category prefix.

4. **CI class filter:** If the linked CI is classified as OT infrastructure (e.g., `cmdb_ci_computer` with `u_domain=OT`, or custom OT CI classes), derive `is_ot` from the CI record.

5. **Combined rule:** Use a Rhai expression in the import transform:
   ```
   is_ot = match_any(assignment_group, ot_group_patterns)
         || category starts_with "OT"
         || ci_class in ot_ci_classes
   ```

The connection wizard should present these options and let the admin configure the rule.

## Sync Strategy

| Parameter | Value |
|---|---|
| **Watermark Column** | `sys_updated_on` |
| **Watermark Query** | `sysparm_query=sys_updated_on>={last_sync_iso}` |
| **Incidents** | Every 5 minutes, incremental by watermark |
| **Change Requests** | Every 15 minutes, incremental by watermark |
| **Problems** | Every 30 minutes, incremental by watermark |
| **Comments** | Every 10 minutes, incremental; filter by parent ticket type |
| **Initial Load** | Full sync with `sysparm_limit=1000`, paginate through all records. Filter by date range (e.g., last 12 months) to avoid pulling decades of history. |
| **Full Reconciliation** | Weekly full sync (all records updated in last 90 days) to catch any missed incremental updates. |

### Endpoint Templates

**Incidents (incremental):**
```
GET /api/now/table/incident
  ?sysparm_query=sys_updated_on>={last_sync}
  &sysparm_fields=sys_id,number,short_description,description,category,subcategory,priority,state,assigned_to,assignment_group,caller_id,cmdb_ci,sys_created_on,sys_updated_on,resolved_at,closed_at,impact,urgency,location
  &sysparm_display_value=true
  &sysparm_limit=1000
  &sysparm_offset={offset}
```

**Change Requests (incremental):**
```
GET /api/now/table/change_request
  ?sysparm_query=sys_updated_on>={last_sync}
  &sysparm_fields=sys_id,number,short_description,description,type,category,risk,state,assigned_to,assignment_group,requested_by,cmdb_ci,start_date,end_date,work_start,work_end,sys_created_on,sys_updated_on,closed_at,impact,location
  &sysparm_display_value=true
  &sysparm_limit=1000
  &sysparm_offset={offset}
```

**Problems (incremental):**
```
GET /api/now/table/problem
  ?sysparm_query=sys_updated_on>={last_sync}
  &sysparm_fields=sys_id,number,short_description,description,cause_notes,workaround,category,priority,problem_state,assigned_to,assignment_group,related_incidents,cmdb_ci,sys_created_on,sys_updated_on,resolved_at,location
  &sysparm_display_value=true
  &sysparm_limit=1000
  &sysparm_offset={offset}
```

## Pre-Built Import Definition

```jsonc
{
  "name": "ServiceNow ITSM",
  "connector_type": "rest_api",
  "description": "Import incidents, change requests, and problems from ServiceNow",
  "connection": {
    "base_url": "https://{{instance}}.service-now.com",
    "auth_method": "oauth2_password",
    "oauth2": {
      "client_id": "{{SERVICENOW_CLIENT_ID}}",
      "client_secret": "{{SERVICENOW_CLIENT_SECRET}}",
      "token_url": "https://{{instance}}.service-now.com/oauth_token.do",
      "username": "{{SERVICENOW_USERNAME}}",
      "password": "{{SERVICENOW_PASSWORD}}"
    },
    "headers": {
      "Accept": "application/json"
    },
    "rate_limit_rpm": 300,
    "timeout_seconds": 30
  },
  "sources": [
    {
      "name": "incidents",
      "target_table": "tickets",
      "endpoint": "/api/now/table/incident",
      "method": "GET",
      "params": {
        "sysparm_query": "sys_updated_on>={{last_sync}}",
        "sysparm_fields": "sys_id,number,short_description,description,category,subcategory,priority,state,assigned_to,assignment_group,caller_id,cmdb_ci,sys_created_on,sys_updated_on,resolved_at,closed_at,impact,urgency,location",
        "sysparm_display_value": "true",
        "sysparm_limit": "1000"
      },
      "pagination": {
        "type": "offset",
        "offset_param": "sysparm_offset",
        "limit_param": "sysparm_limit",
        "total_header": "X-Total-Count"
      },
      "response_root": "result",
      "watermark_column": "sys_updated_on",
      "sync_interval_minutes": 5,
      "field_mappings": [
        { "source": "number", "target": "ticket_number" },
        { "source": "number", "target": "external_id" },
        { "source": null, "target": "source_system", "default": "servicenow" },
        { "source": null, "target": "ticket_type", "default": "incident" },
        { "source": "short_description", "target": "title" },
        { "source": "description", "target": "description" },
        { "source": "state", "target": "status", "transform": "status_map" },
        { "source": "priority", "target": "priority", "transform": "priority_map" },
        { "source": "category", "target": "category" },
        { "source": "subcategory", "target": "subcategory" },
        { "source": "assigned_to.display_value", "target": "assigned_to" },
        { "source": "assignment_group.display_value", "target": "assigned_group" },
        { "source": "caller_id.display_value", "target": "requester_name" },
        { "source": "cmdb_ci.display_value", "target": "ci_name" },
        { "source": "cmdb_ci.value", "target": "ci_id" },
        { "source": "location.display_value", "target": "location" },
        { "source": "sys_created_on", "target": "created_at_source", "transform": "parse_timestamp" },
        { "source": "sys_updated_on", "target": "updated_at_source", "transform": "parse_timestamp" },
        { "source": "resolved_at", "target": "resolved_at", "transform": "parse_timestamp" },
        { "source": "closed_at", "target": "closed_at", "transform": "parse_timestamp" }
      ],
      "value_maps": {
        "status_map": {
          "1": "new",
          "2": "in_progress",
          "3": "on_hold",
          "6": "resolved",
          "7": "closed",
          "8": "cancelled"
        },
        "priority_map": {
          "1": "critical",
          "2": "high",
          "3": "medium",
          "4": "low",
          "5": "low"
        }
      }
    },
    {
      "name": "change_requests",
      "target_table": "tickets",
      "endpoint": "/api/now/table/change_request",
      "method": "GET",
      "params": {
        "sysparm_query": "sys_updated_on>={{last_sync}}",
        "sysparm_fields": "sys_id,number,short_description,description,type,category,risk,state,assigned_to,assignment_group,requested_by,cmdb_ci,start_date,end_date,work_start,work_end,sys_created_on,sys_updated_on,closed_at,impact,location",
        "sysparm_display_value": "true",
        "sysparm_limit": "1000"
      },
      "pagination": {
        "type": "offset",
        "offset_param": "sysparm_offset",
        "limit_param": "sysparm_limit",
        "total_header": "X-Total-Count"
      },
      "response_root": "result",
      "watermark_column": "sys_updated_on",
      "sync_interval_minutes": 15,
      "field_mappings": [
        { "source": "number", "target": "ticket_number" },
        { "source": "number", "target": "external_id" },
        { "source": null, "target": "source_system", "default": "servicenow" },
        { "source": null, "target": "ticket_type", "default": "change_request" },
        { "source": "short_description", "target": "title" },
        { "source": "description", "target": "description" },
        { "source": "state", "target": "status", "transform": "change_status_map" },
        { "source": "priority", "target": "priority", "transform": "priority_map" },
        { "source": "category", "target": "category" },
        { "source": "assigned_to.display_value", "target": "assigned_to" },
        { "source": "assignment_group.display_value", "target": "assigned_group" },
        { "source": "requested_by.display_value", "target": "requester_name" },
        { "source": "cmdb_ci.display_value", "target": "ci_name" },
        { "source": "cmdb_ci.value", "target": "ci_id" },
        { "source": "location.display_value", "target": "location" },
        { "source": "start_date", "target": "planned_start_at", "transform": "parse_timestamp" },
        { "source": "end_date", "target": "planned_end_at", "transform": "parse_timestamp" },
        { "source": "sys_created_on", "target": "created_at_source", "transform": "parse_timestamp" },
        { "source": "sys_updated_on", "target": "updated_at_source", "transform": "parse_timestamp" },
        { "source": "closed_at", "target": "closed_at", "transform": "parse_timestamp" }
      ],
      "value_maps": {
        "change_status_map": {
          "-5": "new",
          "-4": "open",
          "-3": "open",
          "-2": "open",
          "-1": "in_progress",
          "0": "in_progress",
          "3": "closed",
          "4": "cancelled"
        },
        "priority_map": {
          "1": "critical",
          "2": "high",
          "3": "medium",
          "4": "low",
          "5": "low"
        }
      }
    },
    {
      "name": "problems",
      "target_table": "tickets",
      "endpoint": "/api/now/table/problem",
      "method": "GET",
      "params": {
        "sysparm_query": "sys_updated_on>={{last_sync}}",
        "sysparm_fields": "sys_id,number,short_description,description,cause_notes,workaround,category,priority,problem_state,assigned_to,assignment_group,related_incidents,cmdb_ci,sys_created_on,sys_updated_on,resolved_at,location",
        "sysparm_display_value": "true",
        "sysparm_limit": "1000"
      },
      "pagination": {
        "type": "offset",
        "offset_param": "sysparm_offset",
        "limit_param": "sysparm_limit",
        "total_header": "X-Total-Count"
      },
      "response_root": "result",
      "watermark_column": "sys_updated_on",
      "sync_interval_minutes": 30,
      "field_mappings": [
        { "source": "number", "target": "ticket_number" },
        { "source": "number", "target": "external_id" },
        { "source": null, "target": "source_system", "default": "servicenow" },
        { "source": null, "target": "ticket_type", "default": "problem" },
        { "source": "short_description", "target": "title" },
        { "source": "description", "target": "description" },
        { "source": "problem_state", "target": "status", "transform": "problem_status_map" },
        { "source": "priority", "target": "priority", "transform": "priority_map" },
        { "source": "category", "target": "category" },
        { "source": "assigned_to.display_value", "target": "assigned_to" },
        { "source": "assignment_group.display_value", "target": "assigned_group" },
        { "source": "cmdb_ci.display_value", "target": "ci_name" },
        { "source": "cmdb_ci.value", "target": "ci_id" },
        { "source": "location.display_value", "target": "location" },
        { "source": "sys_created_on", "target": "created_at_source", "transform": "parse_timestamp" },
        { "source": "sys_updated_on", "target": "updated_at_source", "transform": "parse_timestamp" },
        { "source": "resolved_at", "target": "resolved_at", "transform": "parse_timestamp" }
      ],
      "value_maps": {
        "problem_status_map": {
          "1": "open",
          "2": "in_progress",
          "3": "on_hold",
          "4": "resolved"
        },
        "priority_map": {
          "1": "critical",
          "2": "high",
          "3": "medium",
          "4": "low",
          "5": "low"
        }
      }
    }
  ],
  "ot_classification": {
    "strategy": "combined",
    "rules": [
      { "type": "field_match", "field": "u_domain", "values": ["OT", "IT/OT"] },
      { "type": "group_pattern", "field": "assignment_group", "patterns": ["OT-*", "DCS-*", "Instrument-*", "SCADA-*", "PLC-*"] },
      { "type": "category_prefix", "field": "category", "prefix": "OT" }
    ],
    "default_is_ot": false
  }
}
```

## Notes

- **Timestamp format:** ServiceNow returns timestamps as `YYYY-MM-DD HH:MM:SS` in the instance timezone (usually UTC). Always confirm timezone setting: System Properties > `glide.sys.date_format`. Parse as UTC unless instance is configured otherwise.
- **Display values:** Always use `sysparm_display_value=true` for reference fields. Without it, you get sys_ids (32-char GUIDs) instead of human-readable names.
- **Custom fields:** Many ServiceNow instances have custom `u_*` fields for OT categorization. The connection wizard should include a field discovery step that queries `/api/now/table/sys_dictionary?sysparm_query=name=incident^elementSTARTSWITHu_` to list custom fields.
- **Encoded queries:** ServiceNow's `sysparm_query` uses encoded query syntax (e.g., `state!=7^state!=8` for non-closed). The import definition supports raw query strings for advanced filtering.
- **Large instances:** Some enterprise ServiceNow instances have millions of incident records. The initial load MUST use a date filter (e.g., `sys_created_on>=javascript:gs.beginningOfLast12Months()`) to avoid timeout/memory issues.
- **Webhook alternative:** ServiceNow can push ticket updates via Business Rules or Flow Designer (outbound REST message). If near-real-time change correlation is needed, configure a ServiceNow business rule to POST to I/O's webhook endpoint on change_request insert/update.
