# ManageEngine ServiceDesk Plus — Ticketing / ITSM Connector Profile

## Application Overview

| Attribute | Detail |
|---|---|
| **Vendor** | Zoho Corporation (ManageEngine division) |
| **Product** | ManageEngine ServiceDesk Plus (On-Premises and Cloud) |
| **Market Position** | Strong in cost-sensitive and mid-market segments. Popular with refineries that want on-prem ITSM without ServiceNow/BMC cost. Significant presence in Asia-Pacific and Middle East refineries. ~3% ITSM market share overall but higher in industrial mid-market. |
| **Licensing** | API access included in Professional and Enterprise editions. Standard edition: limited API. On-Prem: no extra cost. Cloud: included in subscription. |
| **Refinery Scenario** | Cost-conscious mid-size refineries, especially in Asia-Pacific and Middle East. Often on-premises deployments behind the plant firewall. Some sites use the cloud version. Typically handles both IT and OT support tickets with category-based separation. |

## API Surface

| Attribute | Value |
|---|---|
| **API Type** | REST (JSON) |
| **On-Prem Base URL** | `https://<server>:<port>/api/v3` |
| **Cloud Base URL** | `https://sdpondemand.manageengine.com/api/v3` |
| **Authentication** | On-Prem: API Key (technician-based, sent as header `authtoken`). Cloud: OAuth 2.0 via Zoho Accounts (Authorization Code grant). |
| **Pagination** | `list_info.start_index` + `list_info.row_count` (max 100/page). |
| **Rate Limits** | Cloud: 100 API calls/minute per organization. On-Prem: no enforced limit (self-hosted). |
| **API Docs** | Cloud: `https://www.manageengine.com/products/service-desk/sdpod-v3-api/`. On-Prem: `https://help.servicedeskplus.com/api/rest-api.html` |

**Key differences between On-Prem and Cloud:**

| Feature | On-Prem (v3 API) | Cloud (v3 API) |
|---|---|---|
| Auth | API Key (header or URL param) | OAuth 2.0 via Zoho Accounts |
| Rate limits | None (self-hosted) | 100/min per org |
| Base URL | `https://<server>:<port>/api/v3` | `https://sdpondemand.manageengine.com/api/v3` |
| Feature parity | Full | Full |
| Webhooks | Triggers (limited) | Webhooks (configurable) |

### Authentication Configuration

**On-Prem (API Key):**
```jsonc
{
  "auth_method": "api_key",
  "api_key": {
    "key": "{{MANAGEENGINE_API_KEY}}",
    "header_name": "authtoken",
    "location": "header"
  }
}
```

**Cloud (OAuth 2.0):**
```jsonc
{
  "auth_method": "oauth2_authorization_code",
  "oauth2": {
    "client_id": "{{ZOHO_CLIENT_ID}}",
    "client_secret": "{{ZOHO_CLIENT_SECRET}}",
    "authorization_url": "https://accounts.zoho.com/oauth/v2/auth",
    "token_url": "https://accounts.zoho.com/oauth/v2/token",
    "refresh_url": "https://accounts.zoho.com/oauth/v2/token",
    "scopes": ["SDPOnDemand.requests.ALL", "SDPOnDemand.changes.ALL", "SDPOnDemand.problems.ALL", "SDPOnDemand.assets.ALL"],
    "redirect_uri": "{{IO_CALLBACK_URL}}"
  }
}
```

> **Note:** Zoho OAuth requires app registration at `https://api-console.zoho.com/`. The redirect URI must be pre-registered. Cloud uses regional domains (zoho.com, zoho.eu, zoho.in, zoho.com.au) — detect region during setup.

## Target Tables

| I/O Table | ManageEngine Source | Priority |
|---|---|---|
| `tickets` | Requests (incidents), Changes, Problems | Primary |
| `ticket_comments` | Request notes / conversations | Secondary |

## Field Mapping — Requests (Incidents)

### `requests` to `tickets`

ManageEngine calls incidents "Requests." The API uses nested JSON objects for reference fields.

| ManageEngine Field | I/O Column | Transform |
|---|---|---|
| `id` | `extra_data.me_id` | Internal numeric ID |
| `subject` | `title` | Direct map |
| `subject` | `external_id` | Use `id` (numeric) as external_id for uniqueness |
| `id` (as string) | `external_id` | Convert to string |
| — | `source_system` | Constant: `manageengine_servicedesk` |
| — | `ticket_type` | Constant: `incident` |
| `description` | `description` | May contain HTML |
| `status.name` | `status` | Value map (see normalization table) |
| `priority.name` | `priority` | Value map (see normalization table) |
| `category.name` | `category` | Direct map |
| `subcategory.name` | `subcategory` | Direct map |
| Derived | `is_ot` | See IT/OT categorization strategy |
| `technician.name` | `assigned_to` | Direct map |
| `group.name` | `assigned_group` | Direct map |
| `requester.name` | `requester_name` | Direct map |
| `requester.email_id` | `requester_email` | Direct map |
| `asset.name` or custom field | `ci_name` | Asset link if configured |
| `asset.id` | `ci_id` | Asset ID (string) |
| — | `hostname` | Extract from asset record |
| — | `ip_address` | Extract from asset record |
| `site.name` | `location` | Direct map |
| — | `planned_start_at` | NULL for requests |
| — | `planned_end_at` | NULL for requests |
| `created_time.value` | `created_at_source` | Epoch milliseconds → TIMESTAMPTZ |
| `last_updated_time.value` | `updated_at_source` | Epoch milliseconds → TIMESTAMPTZ |
| `resolved_time.value` | `resolved_at` | Epoch milliseconds → TIMESTAMPTZ; NULL if unresolved |
| `closed_time.value` | `closed_at` | Epoch milliseconds → TIMESTAMPTZ; NULL if not closed |
| `impact.name`, `urgency.name` | `extra_data.impact`, `extra_data.urgency` | Store in JSONB |
| `display_id` | `ticket_number` | User-facing ID (e.g., `#SR-00001234`) |
| Computed URL | `extra_data.external_url` | On-Prem: `https://<server>:<port>/WorkOrder.do?woMode=viewWO&woID={id}`. Cloud: `https://sdpondemand.manageengine.com/app/request/{id}` |

### Changes to `tickets`

| ManageEngine Field | I/O Column | Transform |
|---|---|---|
| `id` (as string) | `external_id` | Convert to string |
| `display_id` | `ticket_number` | User-facing change ID |
| — | `source_system` | Constant: `manageengine_servicedesk` |
| — | `ticket_type` | Constant: `change_request` |
| `title` | `title` | Direct map |
| `description` | `description` | May contain HTML |
| `status.name` | `status` | Change-specific value map (see below) |
| `priority.name` | `priority` | Same priority map |
| `category.name` | `category` | Direct map |
| `change_type.name` | `extra_data.change_type` | `Minor`, `Standard`, `Major`, `Significant`, `Emergency` |
| `risk.name` | `extra_data.risk_level` | Store in JSONB |
| `technician.name` | `assigned_to` | Direct map |
| `group.name` | `assigned_group` | Direct map |
| `requester.name` | `requester_name` | Direct map |
| `asset.name` | `ci_name` | Direct map |
| `site.name` | `location` | Direct map |
| `scheduled_start_time.value` | `planned_start_at` | Epoch ms → TIMESTAMPTZ |
| `scheduled_end_time.value` | `planned_end_at` | Epoch ms → TIMESTAMPTZ |
| `created_time.value` | `created_at_source` | Epoch ms → TIMESTAMPTZ |
| `last_updated_time.value` | `updated_at_source` | Epoch ms → TIMESTAMPTZ |
| `completed_time.value` | `closed_at` | Epoch ms → TIMESTAMPTZ |

### Problems to `tickets`

| ManageEngine Field | I/O Column | Transform |
|---|---|---|
| `id` (as string) | `external_id` | Convert to string |
| `display_id` | `ticket_number` | User-facing problem ID |
| — | `source_system` | Constant: `manageengine_servicedesk` |
| — | `ticket_type` | Constant: `problem` |
| `title` | `title` | Direct map |
| `description` | `description` | May contain HTML |
| `status.name` | `status` | Problem-specific value map (see below) |
| `priority.name` | `priority` | Same priority map |
| `category.name` | `category` | Direct map |
| `root_cause` | `extra_data.root_cause` | Store in JSONB |
| `workaround` | `extra_data.workaround` | Store in JSONB |
| `technician.name` | `assigned_to` | Direct map |
| `group.name` | `assigned_group` | Direct map |
| `asset.name` | `ci_name` | Direct map |
| `site.name` | `location` | Direct map |
| `created_time.value` | `created_at_source` | Epoch ms → TIMESTAMPTZ |
| `last_updated_time.value` | `updated_at_source` | Epoch ms → TIMESTAMPTZ |
| `closed_time.value` | `resolved_at` | Epoch ms → TIMESTAMPTZ |

### Request Notes to `ticket_comments`

| ManageEngine Field | I/O Column | Transform |
|---|---|---|
| `note.id` | `external_id` | Note ID |
| Parent request ID | `ticket_id` | Lookup ticket by external_id → FK |
| `show_to_requester` | `is_internal` | `false` → `true` (internal); `true` → `false` (public). Inverted logic. |
| `description` | `comment_text` | May contain HTML; strip tags |
| `created_by.name` | `author_name` | Direct map |
| `created_time.value` | `commented_at` | Epoch ms → TIMESTAMPTZ |

## Status Normalization

### Request `status.name` to I/O `status`

| ManageEngine Status | I/O `status` |
|---|---|
| `Open` | `open` |
| `In Progress` | `in_progress` |
| `On Hold` | `on_hold` |
| `Resolved` | `resolved` |
| `Closed` | `closed` |

> **Note:** ManageEngine allows custom statuses. The connection wizard should query available statuses and present for mapping. Custom statuses are common in refinery deployments (e.g., `Awaiting Parts`, `Vendor Engaged`, `Field Verification`).

### Change `status.name` to I/O `status`

| ManageEngine Change Status | I/O `status` |
|---|---|
| `Submitted` | `new` |
| `Planning` | `open` |
| `Awaiting Approval` | `open` |
| `Approved` | `open` |
| `Implementation` | `in_progress` |
| `Review` | `in_progress` |
| `Completed` | `resolved` |
| `Closed` | `closed` |
| `Rejected` | `cancelled` |
| `Cancelled` | `cancelled` |

### Problem `status.name` to I/O `status`

| ManageEngine Problem Status | I/O `status` |
|---|---|
| `Open` | `open` |
| `Analysis In Progress` | `in_progress` |
| `Pending` | `on_hold` |
| `Root Cause Identified` | `in_progress` |
| `Known Error` | `in_progress` |
| `Resolved` | `resolved` |
| `Closed` | `closed` |

## Priority Normalization

| ManageEngine `priority.name` | I/O `priority` |
|---|---|
| `Urgent` | `critical` |
| `High` | `high` |
| `Medium` / `Normal` | `medium` |
| `Low` | `low` |

## IT/OT Categorization Strategy

ManageEngine has a multi-level category/subcategory/item structure and a separate site hierarchy. OT classification options:

1. **Category match (most common):** ManageEngine's category tree often includes OT-specific entries. Map categories: `["OT", "Process Control", "DCS", "Instrumentation", "SCADA", "PLC"]` → `is_ot = true`.

2. **Site-based:** ManageEngine supports multi-site. If the refinery has separate sites for IT and OT (e.g., `Site: Plant Operations`, `Site: Control Room`), map OT site names.

3. **Group-based:** Assignment groups named for OT teams. Pattern match: `["OT-*", "DCS-*", "Instrument-*", "Control Systems*"]`.

4. **Custom field (Additional Fields):** ManageEngine supports "Additional Fields" (custom fields) on requests. An `OT Domain` dropdown is a clean solution. Discover additional fields during connection wizard.

5. **Asset class:** If assets are classified by type (e.g., `Workstation > DCS Console`, `Network > OT Switch`), derive `is_ot` from the linked asset's product type.

## Sync Strategy

| Parameter | Value |
|---|---|
| **Watermark Column** | `last_updated_time` |
| **Watermark Format** | Epoch milliseconds |
| **Watermark Query** | `search_criteria: {"field": "last_updated_time", "condition": "greater than", "value": "{last_sync_epoch_ms}"}` |
| **Requests** | Every 10 minutes, incremental by watermark |
| **Changes** | Every 15 minutes, incremental by watermark |
| **Problems** | Every 60 minutes, incremental by watermark |
| **Comments** | Every 15 minutes; fetch notes for recently updated requests |
| **Initial Load** | Filter by `created_time` (last 12 months). Page with `start_index` + `row_count=100`. |
| **Full Reconciliation** | Weekly full sync for records updated in last 90 days. |

### Endpoint Templates

**Requests (incremental):**
```
GET /api/v3/requests
  ?list_info={
    "start_index": {{offset}},
    "row_count": 100,
    "sort_field": "last_updated_time",
    "sort_order": "desc",
    "search_criteria": {
      "field": "last_updated_time",
      "condition": "greater than",
      "value": "{{last_sync_epoch_ms}}"
    }
  }
```

**Changes (incremental):**
```
GET /api/v3/changes
  ?list_info={
    "start_index": {{offset}},
    "row_count": 100,
    "search_criteria": {
      "field": "last_updated_time",
      "condition": "greater than",
      "value": "{{last_sync_epoch_ms}}"
    }
  }
```

**Problems (incremental):**
```
GET /api/v3/problems
  ?list_info={
    "start_index": {{offset}},
    "row_count": 100,
    "search_criteria": {
      "field": "last_updated_time",
      "condition": "greater than",
      "value": "{{last_sync_epoch_ms}}"
    }
  }
```

**Request Notes:**
```
GET /api/v3/requests/{{request_id}}/notes
  ?list_info={"row_count": 100, "start_index": 0}
```

## Pre-Built Import Definition

```jsonc
{
  "name": "ManageEngine ServiceDesk Plus",
  "connector_type": "rest_api",
  "description": "Import requests, changes, and problems from ManageEngine ServiceDesk Plus",
  "connection": {
    "base_url": "https://{{server}}:{{port}}",
    "auth_method": "api_key",
    "api_key": {
      "key": "{{MANAGEENGINE_API_KEY}}",
      "header_name": "authtoken",
      "location": "header"
    },
    "headers": {
      "Accept": "application/json",
      "Content-Type": "application/json"
    },
    "rate_limit_rpm": 0,
    "timeout_seconds": 30
  },
  "sources": [
    {
      "name": "requests",
      "target_table": "tickets",
      "endpoint": "/api/v3/requests",
      "method": "GET",
      "params": {
        "list_info": "{\"start_index\":{{offset}},\"row_count\":100,\"sort_field\":\"last_updated_time\",\"sort_order\":\"desc\",\"search_criteria\":{\"field\":\"last_updated_time\",\"condition\":\"greater than\",\"value\":\"{{last_sync_epoch_ms}}\"}}"
      },
      "pagination": {
        "type": "offset",
        "offset_source": "list_info.start_index",
        "page_size": 100,
        "total_field": "response_status.list_info.total_count"
      },
      "response_root": "requests",
      "watermark_column": "last_updated_time.value",
      "watermark_format": "epoch_ms",
      "sync_interval_minutes": 10,
      "field_mappings": [
        { "source": "id", "target": "external_id", "transform": "to_string" },
        { "source": "display_id", "target": "ticket_number" },
        { "source": null, "target": "source_system", "default": "manageengine_servicedesk" },
        { "source": null, "target": "ticket_type", "default": "incident" },
        { "source": "subject", "target": "title" },
        { "source": "description", "target": "description", "transform": "strip_html" },
        { "source": "status.name", "target": "status", "transform": "status_map" },
        { "source": "priority.name", "target": "priority", "transform": "priority_map" },
        { "source": "category.name", "target": "category" },
        { "source": "subcategory.name", "target": "subcategory" },
        { "source": "technician.name", "target": "assigned_to" },
        { "source": "group.name", "target": "assigned_group" },
        { "source": "requester.name", "target": "requester_name" },
        { "source": "requester.email_id", "target": "requester_email" },
        { "source": "asset.name", "target": "ci_name" },
        { "source": "asset.id", "target": "ci_id", "transform": "to_string" },
        { "source": "site.name", "target": "location" },
        { "source": "created_time.value", "target": "created_at_source", "transform": "epoch_ms_to_timestamp" },
        { "source": "last_updated_time.value", "target": "updated_at_source", "transform": "epoch_ms_to_timestamp" },
        { "source": "resolved_time.value", "target": "resolved_at", "transform": "epoch_ms_to_timestamp" },
        { "source": "closed_time.value", "target": "closed_at", "transform": "epoch_ms_to_timestamp" }
      ],
      "value_maps": {
        "status_map": {
          "Open": "open",
          "In Progress": "in_progress",
          "On Hold": "on_hold",
          "Resolved": "resolved",
          "Closed": "closed"
        },
        "priority_map": {
          "Urgent": "critical",
          "High": "high",
          "Medium": "medium",
          "Normal": "medium",
          "Low": "low"
        }
      }
    },
    {
      "name": "changes",
      "target_table": "tickets",
      "endpoint": "/api/v3/changes",
      "method": "GET",
      "params": {
        "list_info": "{\"start_index\":{{offset}},\"row_count\":100,\"search_criteria\":{\"field\":\"last_updated_time\",\"condition\":\"greater than\",\"value\":\"{{last_sync_epoch_ms}}\"}}"
      },
      "pagination": {
        "type": "offset",
        "offset_source": "list_info.start_index",
        "page_size": 100,
        "total_field": "response_status.list_info.total_count"
      },
      "response_root": "changes",
      "watermark_column": "last_updated_time.value",
      "watermark_format": "epoch_ms",
      "sync_interval_minutes": 15,
      "field_mappings": [
        { "source": "id", "target": "external_id", "transform": "to_string" },
        { "source": "display_id", "target": "ticket_number" },
        { "source": null, "target": "source_system", "default": "manageengine_servicedesk" },
        { "source": null, "target": "ticket_type", "default": "change_request" },
        { "source": "title", "target": "title" },
        { "source": "description", "target": "description", "transform": "strip_html" },
        { "source": "status.name", "target": "status", "transform": "change_status_map" },
        { "source": "priority.name", "target": "priority", "transform": "priority_map" },
        { "source": "category.name", "target": "category" },
        { "source": "technician.name", "target": "assigned_to" },
        { "source": "group.name", "target": "assigned_group" },
        { "source": "requester.name", "target": "requester_name" },
        { "source": "asset.name", "target": "ci_name" },
        { "source": "site.name", "target": "location" },
        { "source": "scheduled_start_time.value", "target": "planned_start_at", "transform": "epoch_ms_to_timestamp" },
        { "source": "scheduled_end_time.value", "target": "planned_end_at", "transform": "epoch_ms_to_timestamp" },
        { "source": "created_time.value", "target": "created_at_source", "transform": "epoch_ms_to_timestamp" },
        { "source": "last_updated_time.value", "target": "updated_at_source", "transform": "epoch_ms_to_timestamp" },
        { "source": "completed_time.value", "target": "closed_at", "transform": "epoch_ms_to_timestamp" }
      ],
      "value_maps": {
        "change_status_map": {
          "Submitted": "new",
          "Planning": "open",
          "Awaiting Approval": "open",
          "Approved": "open",
          "Implementation": "in_progress",
          "Review": "in_progress",
          "Completed": "resolved",
          "Closed": "closed",
          "Rejected": "cancelled",
          "Cancelled": "cancelled"
        },
        "priority_map": {
          "Urgent": "critical",
          "High": "high",
          "Medium": "medium",
          "Normal": "medium",
          "Low": "low"
        }
      }
    },
    {
      "name": "problems",
      "target_table": "tickets",
      "endpoint": "/api/v3/problems",
      "method": "GET",
      "params": {
        "list_info": "{\"start_index\":{{offset}},\"row_count\":100,\"search_criteria\":{\"field\":\"last_updated_time\",\"condition\":\"greater than\",\"value\":\"{{last_sync_epoch_ms}}\"}}"
      },
      "pagination": {
        "type": "offset",
        "offset_source": "list_info.start_index",
        "page_size": 100,
        "total_field": "response_status.list_info.total_count"
      },
      "response_root": "problems",
      "watermark_column": "last_updated_time.value",
      "watermark_format": "epoch_ms",
      "sync_interval_minutes": 60,
      "field_mappings": [
        { "source": "id", "target": "external_id", "transform": "to_string" },
        { "source": "display_id", "target": "ticket_number" },
        { "source": null, "target": "source_system", "default": "manageengine_servicedesk" },
        { "source": null, "target": "ticket_type", "default": "problem" },
        { "source": "title", "target": "title" },
        { "source": "description", "target": "description", "transform": "strip_html" },
        { "source": "status.name", "target": "status", "transform": "problem_status_map" },
        { "source": "priority.name", "target": "priority", "transform": "priority_map" },
        { "source": "category.name", "target": "category" },
        { "source": "technician.name", "target": "assigned_to" },
        { "source": "group.name", "target": "assigned_group" },
        { "source": "asset.name", "target": "ci_name" },
        { "source": "site.name", "target": "location" },
        { "source": "created_time.value", "target": "created_at_source", "transform": "epoch_ms_to_timestamp" },
        { "source": "last_updated_time.value", "target": "updated_at_source", "transform": "epoch_ms_to_timestamp" },
        { "source": "closed_time.value", "target": "resolved_at", "transform": "epoch_ms_to_timestamp" }
      ],
      "value_maps": {
        "problem_status_map": {
          "Open": "open",
          "Analysis In Progress": "in_progress",
          "Pending": "on_hold",
          "Root Cause Identified": "in_progress",
          "Known Error": "in_progress",
          "Resolved": "resolved",
          "Closed": "closed"
        },
        "priority_map": {
          "Urgent": "critical",
          "High": "high",
          "Medium": "medium",
          "Normal": "medium",
          "Low": "low"
        }
      }
    }
  ],
  "ot_classification": {
    "strategy": "combined",
    "rules": [
      { "type": "category_match", "field": "category.name", "values": ["OT", "Process Control", "DCS", "Instrumentation", "SCADA", "PLC"] },
      { "type": "site_match", "field": "site.name", "values": ["{{ot_site_names}}"] },
      { "type": "group_pattern", "field": "group.name", "patterns": ["OT-*", "DCS-*", "Instrument-*", "Control Systems*"] }
    ],
    "default_is_ot": false
  }
}
```

## Notes

- **Timestamps are epoch milliseconds.** ManageEngine returns timestamps as `{"display_value": "Nov 10, 2023 02:30 PM", "value": "1699610400000"}`. Always use the `.value` field (epoch ms) and convert to TIMESTAMPTZ. The `.display_value` is locale-dependent and unreliable for parsing.
- **Cloud OAuth regional domains.** Zoho has regional data centers. The OAuth token URL varies: `accounts.zoho.com` (US), `accounts.zoho.eu` (EU), `accounts.zoho.in` (India), `accounts.zoho.com.au` (Australia). The connection wizard must detect or ask for the region.
- **On-Prem API Key generation:** Admin > Technicians > select technician > API Key > Generate. Each key is tied to a specific technician account. Use a dedicated integration technician account.
- **list_info parameter quirk:** The `list_info` parameter is a JSON string passed as a query parameter. Some on-prem versions require it URL-encoded; others accept it raw. The connector should URL-encode by default.
- **HTML in descriptions:** ManageEngine stores rich text as HTML. The `description` and note `description` fields may contain HTML tags. Apply `strip_html` transform to store plain text, or store raw and strip on display.
- **API version detection:** Some older on-prem installations may still run v1 API (uses `input_data` form parameter format). The connector should test `GET /api/v3/requests?list_info={"row_count":1}` first; if it fails, fall back to v1 endpoint detection. v1 support is lower priority.
- **Webhook support (Cloud):** ManageEngine Cloud supports webhooks for ticket create/update events. Configure under Admin > Developer Space > Webhooks. Useful for near-real-time change management correlation.
- **Max 100 rows per page.** This is a hard limit in both on-prem and cloud. Large initial loads will require many pages. Use date filters to keep page counts reasonable.
