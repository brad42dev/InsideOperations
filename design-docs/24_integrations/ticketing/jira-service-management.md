# Jira Service Management — Ticketing / ITSM Connector Profile

## Application Overview

| Attribute | Detail |
|---|---|
| **Vendor** | Atlassian, Inc. |
| **Product** | Jira Service Management (Cloud and Data Center) |
| **Market Position** | Fast-growing in industrial settings, especially where engineering teams already use Jira Software. Increasingly adopted by refinery IT departments that want unified IT/engineering ticketing. Lower cost than ServiceNow/BMC. |
| **Licensing** | API included in all tiers (Free, Standard, Premium, Enterprise). Data Center: included in license. No separate API cost. |
| **Refinery Scenario** | Mid-size refineries and plants where IT already uses Jira for project work. Often a single Jira instance with a dedicated JSM project for OT/IT support tickets. Custom fields and issue types heavily used. Atlassian sunsetting Server edition pushed many to Cloud or Data Center. |

## API Surface

| Attribute | Value |
|---|---|
| **API Type** | REST (JSON) |
| **Cloud Base URLs** | Service Desk: `https://<site>.atlassian.net/rest/servicedeskapi/`. Platform: `https://<site>.atlassian.net/rest/api/3/`. Assets: `https://<site>.atlassian.net/rest/assets/1.0/` |
| **Data Center Base URLs** | Service Desk: `https://<server>/rest/servicedeskapi/`. Platform: `https://<server>/rest/api/2/` |
| **Authentication** | Cloud: API Token (email + token as Basic Auth) or OAuth 2.0 (3LO). Data Center: Personal Access Token (Bearer) or Basic Auth. |
| **Pagination** | `startAt` + `maxResults` (max 100/page for most endpoints). Response includes `total` field. |
| **Rate Limits** | Cloud: Points-based system (~100 requests/10 seconds per user). Data Center: admin-configurable. |
| **API Docs** | Cloud: `https://developer.atlassian.com/cloud/jira/service-desk/rest/` |

**Key API features:**
- JQL (Jira Query Language) for powerful filtering: `project = "OT-SUPPORT" AND updated >= "2024-01-01"`
- Custom fields accessed by ID (`customfield_NNNNN`) — field discovery required during setup
- Field discovery endpoint: `GET /rest/api/3/field` returns all fields including custom
- Native webhooks: `POST /rest/webhooks/1.0/webhook` for real-time ticket events
- JSM-specific endpoints for queues, SLAs, customers vs. general Jira platform API for issue CRUD

### Authentication Configuration

**Cloud (API Token):**
```jsonc
{
  "auth_method": "basic",
  "basic": {
    "username": "{{ATLASSIAN_EMAIL}}",
    "password": "{{ATLASSIAN_API_TOKEN}}"
  }
}
```

**Cloud (OAuth 2.0 3LO):**
```jsonc
{
  "auth_method": "oauth2_authorization_code",
  "oauth2": {
    "client_id": "{{ATLASSIAN_CLIENT_ID}}",
    "client_secret": "{{ATLASSIAN_CLIENT_SECRET}}",
    "authorization_url": "https://auth.atlassian.com/authorize",
    "token_url": "https://auth.atlassian.com/oauth/token",
    "scopes": ["read:jira-work", "read:servicedesk-request"],
    "cloud_id": "{{ATLASSIAN_CLOUD_ID}}"
  }
}
```

**Data Center (PAT):**
```jsonc
{
  "auth_method": "bearer",
  "bearer": {
    "token": "{{JIRA_PERSONAL_ACCESS_TOKEN}}"
  }
}
```

## Target Tables

| I/O Table | JSM Source | Priority |
|---|---|---|
| `tickets` | Issues (Incident, Service Request, Change, Problem issue types) | Primary |
| `ticket_comments` | Issue comments (`/rest/api/3/issue/{id}/comment`) | Secondary |

## Field Mapping

### Issues to `tickets`

JSM uses Jira's issue model. All ticket types (incident, change, problem, service request) are issues differentiated by `issuetype`. Custom fields are accessed by `customfield_NNNNN` IDs that vary per instance.

| Jira Field | I/O Column | Transform |
|---|---|---|
| `key` | `ticket_number`, `external_id` | Direct map (e.g., `OTSUP-1234`) |
| — | `source_system` | Constant: `jira_service_management` |
| `fields.issuetype.name` | `ticket_type` | Value map (see below) |
| `fields.summary` | `title` | Direct map |
| `fields.description` | `description` | ADF (Atlassian Document Format) on Cloud; wiki markup on DC. Convert to plain text or store raw. |
| `fields.status.name` | `status` | Value map (see normalization table) |
| `fields.priority.name` | `priority` | Value map (see normalization table) |
| `fields.components[].name` or custom field | `category` | Instance-specific; often a custom field or component |
| Custom field or label | `subcategory` | Instance-specific |
| Derived | `is_ot` | See IT/OT categorization strategy |
| `fields.assignee.displayName` | `assigned_to` | Direct map; NULL if unassigned |
| Custom field or component | `assigned_group` | JSM doesn't have native groups on issues; often a custom field |
| `fields.reporter.displayName` | `requester_name` | Direct map |
| `fields.reporter.emailAddress` | `requester_email` | Direct map (may be hidden in Cloud depending on privacy settings) |
| Custom field (Assets/Insight link) | `ci_name` | If Assets add-on is used; field ID varies |
| Custom field | `ci_id` | Assets object ID if available |
| — | `hostname` | Extract from Assets object if available |
| — | `ip_address` | Extract from Assets object if available |
| Custom field or label | `location` | Instance-specific |
| Custom field | `planned_start_at` | Change requests only; custom date field |
| Custom field | `planned_end_at` | Change requests only; custom date field |
| `fields.created` | `created_at_source` | ISO 8601 timestamp |
| `fields.updated` | `updated_at_source` | ISO 8601 timestamp |
| `fields.resolutiondate` | `resolved_at` | ISO 8601; NULL if unresolved |
| Custom field or derived | `closed_at` | JSM uses `resolutiondate`; `closed_at` may require status-change timestamp lookup |
| `fields.labels`, custom fields | `extra_data` | Store labels, components, fix versions, etc. |
| Computed URL | `extra_data.external_url` | Cloud: `https://<site>.atlassian.net/browse/{key}`. DC: `https://<server>/browse/{key}` |

### Issue Type to `ticket_type`

| Jira `issuetype.name` | I/O `ticket_type` |
|---|---|
| `Incident` | `incident` |
| `Service Request` | `service_request` |
| `Change` | `change_request` |
| `Problem` | `problem` |
| `[ITSM] Post-Incident Review` | `problem` |
| Custom types | Map during connection wizard |

> **Note:** Issue type names are fully configurable in Jira. The connection wizard must present discovered issue types and let the admin map each to an I/O ticket_type.

### Comments to `ticket_comments`

| Jira Field | I/O Column | Transform |
|---|---|---|
| `id` | `external_id` | Comment ID |
| Parent issue key | `ticket_id` | Lookup ticket by external_id → FK |
| `body` | `comment_text` | ADF on Cloud (convert to text), wiki markup on DC |
| `visibility.type` == `"role"` | `is_internal` | If visibility is set (role-restricted) → `true`; otherwise → `false` |
| `author.displayName` | `author_name` | Direct map |
| `created` | `commented_at` | ISO 8601 timestamp |

## Status Normalization

Jira workflows are fully customizable. Status names vary per project and issue type. The table below covers JSM's default ITSM workflow:

### Default JSM ITSM Statuses to I/O `status`

| JSM Status | Status Category | I/O `status` |
|---|---|---|
| `Waiting for support` | To Do | `new` |
| `Open` | To Do | `open` |
| `Waiting for customer` | In Progress | `on_hold` |
| `In progress` | In Progress | `in_progress` |
| `Escalated` | In Progress | `in_progress` |
| `Pending` | In Progress | `on_hold` |
| `Resolved` | Done | `resolved` |
| `Closed` | Done | `closed` |
| `Canceled` | Done | `cancelled` |
| `Declined` | Done | `cancelled` |

### Fallback: Status Category Mapping

Since workflows are customizable, the connector should fall back to Jira's **status category** when an exact status name match fails:

| Jira Status Category | I/O `status` |
|---|---|
| `new` (To Do) | `new` |
| `indeterminate` (In Progress) | `in_progress` |
| `done` (Done) | `closed` |

This ensures any custom status maps to a reasonable I/O status even without explicit configuration.

## Priority Normalization

| Jira `priority.name` | I/O `priority` |
|---|---|
| `Highest` / `Blocker` | `critical` |
| `High` | `high` |
| `Medium` | `medium` |
| `Low` | `low` |
| `Lowest` | `low` |

> **Note:** Like statuses, priority names can be customized. The connection wizard should present discovered priorities for mapping.

## IT/OT Categorization Strategy

JSM does not natively distinguish IT from OT. Since Jira is highly customizable, the approach depends on how the site organized their ITSM:

1. **Separate projects (preferred if available):** Some sites run dedicated JSM projects for OT support (e.g., project key `OTSUP`). Map by project key: `project IN ("OTSUP", "DCS", "INSTMNT")` → `is_ot = true`.

2. **Component-based:** Jira components can represent OT domains (e.g., `DCS`, `Network-OT`, `Instrumentation`). Map component names to `is_ot`.

3. **Label-based:** Labels like `OT`, `DCS`, `SCADA` on issues. Check `fields.labels` for OT-related values.

4. **Custom field:** A dropdown custom field like `Domain` with values `IT`, `OT`, `IT/OT`. Discovered during field discovery step.

5. **JQL filter:** Configure a JQL expression that selects OT tickets. E.g., `project = OTSUP OR labels = OT OR component in (DCS, SCADA, Instrumentation)`. This JQL is applied as an additional filter during sync.

The connection wizard flow:
1. User enters site URL and credentials
2. Connector fetches projects (`GET /rest/api/3/project`) and presents list
3. User selects which projects to sync
4. Connector runs field discovery (`GET /rest/api/3/field`)
5. User maps issue types, configures OT classification rule
6. Connector validates with a test query

## Sync Strategy

| Parameter | Value |
|---|---|
| **Watermark Column** | `updated` (Jira issue field) |
| **Watermark Query** | JQL: `updated >= "{last_sync_iso}"` |
| **Incidents / Service Requests** | Every 5 minutes, incremental by watermark |
| **Change Requests** | Every 15 minutes, incremental by watermark |
| **Problems** | Every 30 minutes, incremental by watermark |
| **Comments** | Every 10 minutes; fetch comments for recently updated issues |
| **Initial Load** | JQL with date range: `created >= "-12M"`. Paginate with `startAt` + `maxResults=100`. |
| **Full Reconciliation** | Weekly full sync for records updated in last 90 days. |

### Endpoint Templates

**Incidents (Cloud, incremental):**
```
GET /rest/api/3/search
  ?jql=project IN ({{projects}}) AND issuetype IN ("Incident","Service Request") AND updated >= "{{last_sync}}"
  &fields=summary,description,issuetype,status,priority,assignee,reporter,components,labels,created,updated,resolutiondate,{{custom_fields}}
  &startAt={{offset}}
  &maxResults=100
```

**Change Requests (Cloud, incremental):**
```
GET /rest/api/3/search
  ?jql=project IN ({{projects}}) AND issuetype = "Change" AND updated >= "{{last_sync}}"
  &fields=summary,description,issuetype,status,priority,assignee,reporter,components,labels,created,updated,resolutiondate,{{custom_fields}}
  &startAt={{offset}}
  &maxResults=100
```

**Comments for issue:**
```
GET /rest/api/3/issue/{{issue_key}}/comment
  ?startAt=0
  &maxResults=100
  &orderBy=created
```

**Field discovery:**
```
GET /rest/api/3/field
```

## Pre-Built Import Definition

```jsonc
{
  "name": "Jira Service Management",
  "connector_type": "rest_api",
  "description": "Import incidents, changes, and problems from Jira Service Management",
  "connection": {
    "base_url": "https://{{site}}.atlassian.net",
    "auth_method": "basic",
    "basic": {
      "username": "{{ATLASSIAN_EMAIL}}",
      "password": "{{ATLASSIAN_API_TOKEN}}"
    },
    "headers": {
      "Accept": "application/json"
    },
    "rate_limit_rpm": 600,
    "timeout_seconds": 30
  },
  "setup_steps": [
    {
      "step": "discover_projects",
      "endpoint": "/rest/api/3/project",
      "prompt": "Select JSM projects to import tickets from",
      "store_as": "projects"
    },
    {
      "step": "discover_fields",
      "endpoint": "/rest/api/3/field",
      "prompt": "Map custom fields to I/O columns",
      "store_as": "custom_fields"
    },
    {
      "step": "discover_issue_types",
      "endpoint": "/rest/api/3/issuetype",
      "prompt": "Map issue types to I/O ticket_type values",
      "store_as": "issue_type_map"
    }
  ],
  "sources": [
    {
      "name": "incidents_and_requests",
      "target_table": "tickets",
      "endpoint": "/rest/api/3/search",
      "method": "GET",
      "params": {
        "jql": "project IN ({{projects}}) AND issuetype IN ({{incident_types}}) AND updated >= \"{{last_sync}}\"",
        "fields": "summary,description,issuetype,status,priority,assignee,reporter,components,labels,created,updated,resolutiondate,{{mapped_custom_fields}}"
      },
      "pagination": {
        "type": "offset",
        "offset_param": "startAt",
        "limit_param": "maxResults",
        "page_size": 100,
        "total_field": "total"
      },
      "response_root": "issues",
      "watermark_source": "fields.updated",
      "sync_interval_minutes": 5,
      "field_mappings": [
        { "source": "key", "target": "ticket_number" },
        { "source": "key", "target": "external_id" },
        { "source": null, "target": "source_system", "default": "jira_service_management" },
        { "source": "fields.issuetype.name", "target": "ticket_type", "transform": "issue_type_map" },
        { "source": "fields.summary", "target": "title" },
        { "source": "fields.description", "target": "description", "transform": "adf_to_text" },
        { "source": "fields.status.name", "target": "status", "transform": "status_map" },
        { "source": "fields.status.statusCategory.key", "target": "extra_data.status_category" },
        { "source": "fields.priority.name", "target": "priority", "transform": "priority_map" },
        { "source": "fields.components[0].name", "target": "category" },
        { "source": "fields.assignee.displayName", "target": "assigned_to" },
        { "source": "fields.reporter.displayName", "target": "requester_name" },
        { "source": "fields.reporter.emailAddress", "target": "requester_email" },
        { "source": "fields.created", "target": "created_at_source", "transform": "parse_iso8601" },
        { "source": "fields.updated", "target": "updated_at_source", "transform": "parse_iso8601" },
        { "source": "fields.resolutiondate", "target": "resolved_at", "transform": "parse_iso8601" },
        { "source": "fields.labels", "target": "extra_data.labels" }
      ],
      "value_maps": {
        "issue_type_map": {
          "Incident": "incident",
          "Service Request": "service_request",
          "Change": "change_request",
          "Problem": "problem",
          "[ITSM] Post-Incident Review": "problem"
        },
        "status_map": {
          "Waiting for support": "new",
          "Open": "open",
          "Waiting for customer": "on_hold",
          "In progress": "in_progress",
          "Escalated": "in_progress",
          "Pending": "on_hold",
          "Resolved": "resolved",
          "Closed": "closed",
          "Canceled": "cancelled",
          "Declined": "cancelled"
        },
        "status_category_fallback": {
          "new": "new",
          "indeterminate": "in_progress",
          "done": "closed"
        },
        "priority_map": {
          "Highest": "critical",
          "Blocker": "critical",
          "High": "high",
          "Medium": "medium",
          "Low": "low",
          "Lowest": "low"
        }
      }
    },
    {
      "name": "change_requests",
      "target_table": "tickets",
      "endpoint": "/rest/api/3/search",
      "method": "GET",
      "params": {
        "jql": "project IN ({{projects}}) AND issuetype IN ({{change_types}}) AND updated >= \"{{last_sync}}\"",
        "fields": "summary,description,issuetype,status,priority,assignee,reporter,components,labels,created,updated,resolutiondate,{{mapped_custom_fields}}"
      },
      "pagination": {
        "type": "offset",
        "offset_param": "startAt",
        "limit_param": "maxResults",
        "page_size": 100,
        "total_field": "total"
      },
      "response_root": "issues",
      "watermark_source": "fields.updated",
      "sync_interval_minutes": 15,
      "field_mappings": [
        { "source": "key", "target": "ticket_number" },
        { "source": "key", "target": "external_id" },
        { "source": null, "target": "source_system", "default": "jira_service_management" },
        { "source": null, "target": "ticket_type", "default": "change_request" },
        { "source": "fields.summary", "target": "title" },
        { "source": "fields.description", "target": "description", "transform": "adf_to_text" },
        { "source": "fields.status.name", "target": "status", "transform": "status_map" },
        { "source": "fields.priority.name", "target": "priority", "transform": "priority_map" },
        { "source": "fields.assignee.displayName", "target": "assigned_to" },
        { "source": "fields.reporter.displayName", "target": "requester_name" },
        { "source": "fields.created", "target": "created_at_source", "transform": "parse_iso8601" },
        { "source": "fields.updated", "target": "updated_at_source", "transform": "parse_iso8601" },
        { "source": "fields.resolutiondate", "target": "resolved_at", "transform": "parse_iso8601" }
      ],
      "value_maps": {
        "status_map": {
          "Waiting for support": "new",
          "Open": "open",
          "Authorize": "open",
          "Planning": "open",
          "Waiting for implementation": "open",
          "Implementing": "in_progress",
          "Peer review": "in_progress",
          "Completed": "resolved",
          "Closed": "closed",
          "Canceled": "cancelled",
          "Declined": "cancelled"
        },
        "priority_map": {
          "Highest": "critical",
          "Blocker": "critical",
          "High": "high",
          "Medium": "medium",
          "Low": "low",
          "Lowest": "low"
        }
      }
    }
  ],
  "ot_classification": {
    "strategy": "combined",
    "rules": [
      { "type": "project_match", "values": ["{{ot_projects}}"] },
      { "type": "label_match", "values": ["OT", "DCS", "SCADA", "PLC", "Instrumentation"] },
      { "type": "component_match", "values": ["{{ot_components}}"] },
      { "type": "custom_field", "field_id": "{{ot_domain_field_id}}", "values": ["OT", "IT/OT"] }
    ],
    "default_is_ot": false
  }
}
```

## Notes

- **Custom field discovery is mandatory.** Jira fields like `customfield_10001` are opaque without discovery. The connection wizard must run `GET /rest/api/3/field`, present the list of custom fields, and let the admin map relevant ones (CI reference, location, planned start/end dates, OT domain flag, etc.).
- **Atlassian Document Format (ADF):** Cloud API v3 returns `description` and comments in ADF (a structured JSON format), not plain text or HTML. The connector must convert ADF to plain text for `description` and `comment_text` columns. A lightweight ADF-to-text converter strips nodes to their text content.
- **Data Center uses API v2.** Field names and response format differ slightly from Cloud v3. The connector must detect the deployment type during setup and adjust endpoints accordingly.
- **JQL date format:** JQL accepts `"yyyy-MM-dd HH:mm"` or `"-1h"` relative formats. Use ISO format for watermark queries.
- **Rate limiting (Cloud):** Atlassian's points-based rate limiting (effective March 2026) assigns different point costs to different endpoints. Search (`/rest/api/3/search`) is relatively expensive. Monitor `X-RateLimit-*` headers and implement backoff.
- **Max 100 results per page.** For large JSM deployments, the initial load may require many pages. JQL with date range filters keeps page counts manageable.
- **Webhooks for near-real-time:** JSM supports native webhooks (`Administration > System > WebHooks`). Configure for `jira:issue_created` and `jira:issue_updated` events to push ticket changes to I/O's webhook endpoint. More efficient than polling for change management correlation.
- **Assets/CMDB integration:** Requires the Assets (formerly Insight) add-on (included in Premium/Enterprise tiers). If available, CI data is linked to issues via a custom field (Assets object link). The Assets API (`/rest/assets/1.0/`) provides object details including IP address, hostname, and location.
