# Inside/Operations - REST API Design Patterns

> **Scope:** This document is the canonical API reference for all REST endpoints in Inside/Operations. It covers infrastructure endpoints (settings, users, system monitoring, backup, sources, points, UOM, expressions, imports, exports, snapshots, window groups, recognition, alerts, email, authentication, mobile sync) and module-specific endpoints (events & alarms, designer, process, reports, forensics, logs, rounds, shifts & presence, notifications, tiles). Each module document (07-14, 30-32) defines the functional specification; this document is the single place to find every endpoint path, method, and permission.

## API Conventions

### Base URL
- **Development:** `http://localhost:3000/api`
- **Production:** `https://hostname/api`

### Authentication
- All endpoints require JWT authentication (except `/auth/login`, SSO callbacks, SCIM endpoints, and MFA verify)
- Authorization header: `Authorization: Bearer <access_token>` (JWT or `io_sk_` API key)
- Service account API keys use the same `Authorization: Bearer` header with `io_sk_` prefix to distinguish from JWTs
- SCIM endpoints (`/scim/v2/*`) use their own bearer token authentication, separate from JWT
- 401 Unauthorized if token invalid or expired
- 403 Forbidden if user lacks required permission
- See [29_AUTHENTICATION.md](29_AUTHENTICATION.md) for full authentication architecture

### Request Format
- Content-Type: `application/json`
- Request body: JSON
- URL parameters for resource IDs
- Query parameters for filters and pagination

### Response Format
- Content-Type: `application/json`
- Consistent structure:
```json
{
    "success": true,
    "data": { ... },
    "message": "Optional message"
}
```

## HTTP Methods

### GET (Read)
- List resources: `GET /api/workspaces`
- Get single resource: `GET /api/workspaces/:id`
- Return 200 OK with data
- Return 404 Not Found if resource doesn't exist

### POST (Create)
- Create resource: `POST /api/workspaces`
- Request body contains resource data
- Return 201 Created with created resource
- Return 400 Bad Request if validation fails

### PUT (Update)
- Update resource: `PUT /api/workspaces/:id`
- Request body contains updated data
- Return 200 OK with updated resource
- Return 404 Not Found if resource doesn't exist

### DELETE (Delete)
- Delete resource: `DELETE /api/workspaces/:id`
- Return 204 No Content on success
- Return 404 Not Found if resource doesn't exist
- Consider soft deletes for audit trail

## Error Handling

### Error Response Format
```json
{
    "success": false,
    "error": {
        "code": "VALIDATION_ERROR",
        "message": "Validation failed",
        "details": [
            {
                "field": "name",
                "message": "Name is required"
            }
        ]
    }
}
```

### Error Codes
- **VALIDATION_ERROR** (400): Invalid request data
- **UNAUTHORIZED** (401): Missing or invalid token
- **FORBIDDEN** (403): Insufficient permissions
- **NOT_FOUND** (404): Resource not found
- **CONFLICT** (409): Resource already exists
- **RATE_LIMITED** (429): Too many requests
- **INTERNAL_ERROR** (500): Server error

### Rate Limiting

Standard inbound API rate limiting to protect I/O from brute-force and abuse. Token bucket algorithm implemented as API Gateway middleware.

| Endpoint Category | Limit | Window | Rationale |
|-------------------|-------|--------|-----------|
| Auth endpoints (login, password reset, token refresh) | 10 requests | per minute per IP | Brute-force protection |
| SCIM provisioning | 60 requests | per minute per token | Automated provisioning can be bursty |
| All other authenticated endpoints | 600 requests | per minute per user | Generous for normal operation, catches runaway scripts |
| Unauthenticated endpoints | 30 requests | per minute per IP | Prevent enumeration attacks |

**Response on 429:**
```json
{
    "success": false,
    "error": {
        "code": "RATE_LIMITED",
        "message": "Too many requests. Retry after 12 seconds."
    }
}
```

**Headers on every response:**
- `X-RateLimit-Limit`: Maximum requests allowed in the window
- `X-RateLimit-Remaining`: Requests remaining in current window
- `X-RateLimit-Reset`: Unix timestamp when the window resets
- `Retry-After`: Seconds to wait (only on 429 responses)

Rate limits are not configurable in the Settings UI for v1 — they are hardcoded defaults. If a deployment needs tuning, it's an environment variable override.

> **Note:** OPC UA outbound rate limiting (throttling I/O's requests to external OPC servers) is a separate concern handled by the OPC Service connection profiles. See doc 17 § Connection Profiles and Rate Protection.

## Pagination

### Query Parameters
- `page`: Page number (1-indexed)
- `limit`: Items per page (default 50, max 100)
- `sort`: Sort field (e.g., `created_at`)
- `order`: Sort order (`asc` or `desc`)

### Response Format
```json
{
    "success": true,
    "data": [ ... ],
    "pagination": {
        "page": 1,
        "limit": 50,
        "total": 150,
        "pages": 3
    }
}
```

## Filtering

### Query Parameters
- Field filters: `?status=active&type=workspace`
- Date ranges: `?from=2026-01-01&to=2026-01-31`
- Search: `?q=search+term`
- Arrays: `?tags=tag1,tag2,tag3`

### Examples
- `GET /api/logs?from=2026-01-01&to=2026-01-31`
- `GET /api/workspaces?published=true&sort=name&order=asc`

## Input Validation

### Backend Validation
- Validate all inputs before processing
- Type checking (string, number, boolean, UUID)
- Range checking (min/max values)
- Format checking (email, URL, date)
- Required field checking

### Validation Libraries
- Use serde for deserialization (type safety)
- Use validator crate for validation rules
- Return 400 Bad Request with detailed error messages

## Settings & Administration Endpoints

These endpoints cover application settings, user management, system monitoring, and backup/restore. See [15_SETTINGS_MODULE.md](15_SETTINGS_MODULE.md) for the full Settings module specification.

### Application Settings (Admin)

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/settings` | `settings:read` | Get all application settings (grouped by category) |
| `PUT` | `/api/settings/:key` | `settings:write` | Update a setting value (validated per key) |

### User Management (Admin)

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/users` | `users:read` | List users (paginated, filterable by role, status) |
| `POST` | `/api/users` | `users:write` | Create a new user |
| `PUT` | `/api/users/:id` | `users:write` | Update user details (profile, role assignments) |
| `DELETE` | `/api/users/:id` | `users:write` | Disable a user (soft delete — sets inactive, does not remove) |

### System Monitoring

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/system-logs` | `system:logs` | View application logs (paginated, filterable by level, service, date range) |

See also: [System Monitoring Endpoints](#system-monitoring-endpoints) for service health, resource metrics, database status, and active session management.

### Backup & Restore (Admin)

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `POST` | `/api/backup` | `system:backup` | Initiate a database backup |

See also: [Backup & Restore Endpoints](#backup--restore-endpoints) for full backup listing, download, upload, restore, and schedule management.

### Permissions
- Application settings: `settings:read` (view), `settings:write` (modify)
- User management: `users:read` (list/view), `users:write` (create/update/disable)
- System logs: `system:logs`
- Backup: `system:backup`

## Data Sources Endpoints

### Source Management (Admin Only)
- `GET /api/sources` - List all data sources (with status, type, last_connected_at)
- `GET /api/sources/:id` - Get source details including connection config and associated point count
- `POST /api/sources` - Create a new data source (OPC UA, Modbus, MQTT, CSV, manual)
- `PUT /api/sources/:id` - Update source configuration (endpoint URL, credentials, polling interval)
- `DELETE /api/sources/:id` - Remove a source. Fails with `409 CONFLICT` if points reference this source (`ON DELETE RESTRICT`). Deactivate associated points first.
- `PUT /api/sources/:id/enable` - Enable a data source (sets `enabled = true`, triggers connection attempt)
- `PUT /api/sources/:id/disable` - Disable a data source (sets `enabled = false`, closes active connection)

## Point Data & Aggregation Endpoints

### Point Metadata
- `GET /api/points` - List points (paginated, searchable by tagname/description, filterable by source_id, active, criticality, area)
- `GET /api/points/:id` - Get point metadata including `aggregation_types`, `source_id`, `active`, `criticality`, `area`, `write_frequency_seconds`, and lifecycle timestamps (`first_seen_at`, `last_seen_at`, `deactivated_at`, `reactivated_at`)
- `PUT /api/points/:id` - Update point app config (admin only): `active`, `criticality`, `area`, `default_graphic_id`, `gps_latitude`, `gps_longitude`, `barcode`, `notes`, `app_metadata`, `write_frequency_seconds`
- `PUT /api/points/bulk/aggregation-types` - Bulk update aggregation types for multiple points (admin only)
- `PUT /api/points/:id/deactivate` - Deactivate a point (sets `active = false`, records `deactivated_at` timestamp). Requires `system:point_deactivate` permission.
- `PUT /api/points/:id/reactivate` - Reactivate a point (sets `active = true`, records `reactivated_at` timestamp). Requires `system:point_deactivate` permission.

### Point Metadata Versions
- `GET /api/points/:id/versions` - Get metadata version history (all versions from `points_metadata_versions`, ordered by version descending)
- `GET /api/points/:id/versions/at?time=...` - Get the effective metadata version at a given point in time (the latest version with `effective_from <= time`)

### Historical Data
- `GET /api/points/:id/history?from=...&to=...&resolution=...` - Get historical data
  - `resolution`: `raw`, `1m`, `5m`, `15m`, `1h`, `1d` (auto-selected if omitted based on time range)
  - Returns aggregated data from the appropriate continuous aggregate
  - Only returns aggregate columns permitted by the point's `aggregation_types` (e.g., `avg` omitted for accumulators, `sum` omitted for temperatures)
  - `min`, `max`, and `count` are always included
  - All aggregates contain only `Good` OPC UA quality data

### Batch Historical Data (Playback)
- `POST /api/points/history-batch` - Get historical data for multiple points in a single request. Primary consumer: Historical Playback Bar (doc 32) in Console/Process.
  - Body: `{ "point_ids": ["uuid1", "uuid2", ...], "start": "ISO8601", "end": "ISO8601" }`
  - Response: `{ "points": { "<point_id>": [{ "t": epoch_ms, "v": number, "q": "good|uncertain|bad" }, ...] } }`
  - Auto-selects resolution based on time range (same logic as single-point history). For ranges > 4 hours, returns aggregate data.
  - Streaming JSON response for large result sets
  - Requires `console:read` or `process:read` permission (same as viewing the graphics)
  - Max 5,000 point IDs per request. Max time range: 30 days (use pagination for longer ranges).

### Rolling Averages
- `GET /api/points/:id/rolling?window=5m` - Get rolling average for a point
  - `window`: Duration string (e.g., `1m`, `5m`, `15m`, `1h`, `4h`, `1d`)
  - Returns: `rolling_avg`, `rolling_min`, `rolling_max`, `sample_count`
  - Only available when point's `aggregation_types` permits averaging
  - Returns 400 `INVALID_AGGREGATION` if point does not support averaging
  - Computed on-the-fly from raw data or smallest fitting continuous aggregate

### Aggregation Type Validation
When a client requests an aggregate operation not permitted by the point's `aggregation_types`:
```json
{
    "success": false,
    "error": {
        "code": "INVALID_AGGREGATION",
        "message": "Point 'FI-1234.PV' does not support averaging. This point is configured as an accumulator.",
        "details": [
            {
                "field": "aggregation_type",
                "message": "Averaging is not enabled for this point",
                "allowed_types": ["accumulation"],
                "point_id": "uuid-1234"
            }
        ]
    }
}
```

### Custom Aggregation
Custom aggregation allows user-configurable time bucket sizes for point data queries. Users specify arbitrary intervals (e.g., 3 minutes, 10 minutes, 2 hours) instead of being limited to the pre-computed continuous aggregate windows (1m, 5m, 15m, 1h, 1d). Computed on-the-fly using TimescaleDB's `time_bucket()` function against the nearest smaller pre-computed aggregate.

- `GET /api/points/:id/history?from=...&to=...&bucket_interval=PT3M` - Get historical data with custom time bucket
  - `bucket_interval`: ISO 8601 duration (e.g., `PT3M` for 3 minutes, `PT10M` for 10 minutes, `PT2H` for 2 hours)
  - When `bucket_interval` is provided, `resolution` is ignored
  - Built-in aggregation functions (avg, sum, min, max, count) remain unchanged — the same per-point `aggregation_types` rules apply
  - Only returns aggregate columns permitted by the point's `aggregation_types`

## Unit of Measure (UOM) Endpoints

### UOM Reference Data
- `GET /api/uom/categories` - List UOM categories (e.g., Temperature, Pressure, Flow)
- `GET /api/uom/units` - List all units with conversion factors
- `GET /api/uom/units/:category` - List units for a specific category

### Display Unit Preferences
- `PUT /api/points/:id/display-unit` - Set the current user's preferred display unit for a point
- `GET /api/points/:id/display-unit` - Get the display unit preference for the current user

**Conversion Strategy:** Real-time values are pushed to clients in raw (source) units; the client performs UOM conversion locally for display. Historical API responses apply server-side conversion before returning data, so values are returned in the user's preferred display unit.

## Expression Builder Endpoints

### Expression CRUD
- `GET /api/expressions` - List saved expressions (paginated). Filters: `?context=conversion`, `?shared=true`, `?q=search`. Returns only the user's own expressions plus shared expressions.
- `GET /api/expressions/:id` - Get full expression details including AST JSON
- `POST /api/expressions` - Create new expression. Body includes `name`, `description`, `expression` (AST JSON), `output_type`, `output_precision`, `expression_context`. `referenced_point_ids` is auto-extracted from the AST.
- `PUT /api/expressions/:id` - Update expression (owner or Admin only). Same body as POST.
- `DELETE /api/expressions/:id` - Delete expression (owner or Admin only). Returns `409 CONFLICT` if expression is currently applied to any points (`custom_expression_id` FK).

### Expression Queries
- `GET /api/expressions/by-context/:ctx` - List expressions for a specific context (e.g., `conversion`, `calculated_value`). Returns owned + shared.
- `GET /api/expressions/by-point/:pointId` - List all expressions that reference a specific point (via `referenced_point_ids` GIN index). Useful for impact analysis when deactivating a point.

### Expression Testing
- `POST /api/expressions/test` - Test-evaluate an expression with provided variable values. Body: `{ "expression": <AST JSON>, "variables": { "current_point_value": 95.0, ... } }`. Returns: `{ "result": 47.000, "avg_eval_time_us": 8.5, "iterations": 10000 }`. Evaluation runs server-side in Rhai with sandboxing (5-second timeout).

### Expression Sharing
- Only users with `system:expression_manage` permission (Admin role) can set `shared = true` on create/update
- Non-owners see shared expressions as read-only
- Admin users can edit or delete any expression

### Point Expression Assignment
- `PUT /api/points/:id/custom-expression` - Apply a saved expression to a point. Body: `{ "expression_id": "<uuid>" }`. Sets `points_metadata.custom_expression_id`. Send `{ "expression_id": null }` to clear.
- Expression assignment is also available via the existing `PUT /api/points/:id` endpoint (include `custom_expression_id` in body).

## Universal Import Endpoints

Full import API specification (7 endpoint groups, ~25 endpoints) is defined in [24_UNIVERSAL_IMPORT.md](24_UNIVERSAL_IMPORT.md) Section 14. Summary:

### Import Connections
- `GET /api/imports/connections` - List all import connections (paginated)
- `POST /api/imports/connections` - Create a new connection
- `GET /api/imports/connections/:id` - Get connection details
- `PUT /api/imports/connections/:id` - Update connection
- `DELETE /api/imports/connections/:id` - Delete connection (fails if definitions reference it)
- `POST /api/imports/connections/:id/test` - Test connection

### Import Definitions
- `GET /api/imports/definitions` - List import definitions (paginated)
- `POST /api/imports/definitions` - Create a new import definition
- `GET /api/imports/definitions/:id` - Get definition details
- `PUT /api/imports/definitions/:id` - Update definition
- `DELETE /api/imports/definitions/:id` - Delete definition

### Schema Discovery
- `POST /api/imports/connections/:id/discover` - Discover source schema (tables, columns, types)
- `POST /api/imports/connections/:id/preview` - Preview source data (first N rows)

### Import Operations
- `POST /api/imports/definitions/:id/run` - Execute an import (manual trigger)
- `POST /api/imports/definitions/:id/dry-run` - Execute dry run (full pipeline, no commit)
- `POST /api/imports/definitions/:id/preview` - Preview transformed data
- `POST /api/imports/runs/:id/cancel` - Cancel a running import

### Import Scheduling
- `GET /api/imports/definitions/:id/schedule` - Get schedule for a definition
- `PUT /api/imports/definitions/:id/schedule` - Create or update schedule
- `DELETE /api/imports/definitions/:id/schedule` - Remove schedule

### Import History
- `GET /api/imports/definitions/:id/runs` - List runs for a definition
- `GET /api/imports/runs/:id` - Get run details
- `GET /api/imports/runs/:id/errors` - Get error details for a run

### File Upload
- `POST /api/imports/upload` - Upload file for file-based import (multipart/form-data)

### Permissions
- Import connection management: `system:import_connections`
- Import definition management: `system:import_definitions`
- Import execution (run, dry-run, preview, cancel): `system:import_execute`
- Import history and error viewing: `system:import_history`

## Data Links & Point Detail Endpoints

Cross-dataset linking and Point Detail panel configuration. Full specification in [24_UNIVERSAL_IMPORT.md](24_UNIVERSAL_IMPORT.md) Section 22 and [32_SHARED_UI_COMPONENTS.md](32_SHARED_UI_COMPONENTS.md).

### Data Links
- `GET /api/data-links` - List all data links (paginated)
- `POST /api/data-links` - Create a data link between two import datasets
- `GET /api/data-links/:id` - Get data link details
- `PUT /api/data-links/:id` - Update a data link
- `DELETE /api/data-links/:id` - Soft-delete a data link
- `POST /api/data-links/validate` - Validate a link chain reaches a point column

### Point Detail
- `GET /api/points/:id/detail` - Aggregate point detail (traverses data links, returns all correlated data)
- `GET /api/point-detail-config` - Get point detail panel configuration
- `PUT /api/point-detail-config` - Update point detail panel configuration

### Permissions
- Data link management: `system:data_link_config`
- Point detail configuration: `system:point_detail_config`
- Point detail viewing: `console:read` or `process:read` (any user who can view graphics can view point detail)

## Export System Endpoints

Full export API specification (~18 endpoints across 3 groups) is defined in [25_EXPORT_SYSTEM.md](25_EXPORT_SYSTEM.md) Section 13. Summary:

### Universal Export
- `POST /api/exports` - Create an export job (sync for <50K rows, async for >=50K)
- `GET /api/exports` - List export jobs (own; admin: all users with `?user_id=` filter)
- `GET /api/exports/:id` - Get export job status and details
- `GET /api/exports/:id/download` - Download the export file
- `DELETE /api/exports/:id` - Cancel or delete an export job

### Admin Bulk Update
- `POST /api/bulk-update/template` - Generate and download a pre-populated template (CSV/XLSX)
- `POST /api/bulk-update/upload` - Upload a modified template file (multipart/form-data)
- `POST /api/bulk-update/:id/validate` - Validate uploaded data and map columns
- `GET /api/bulk-update/:id/diff` - Get the diff preview (paginated, field-level changes)
- `POST /api/bulk-update/:id/apply` - Apply changes (creates snapshot first)
- `GET /api/bulk-update/:id/results` - Get results after apply
- `DELETE /api/bulk-update/:id` - Cancel a pending bulk update

### Change Snapshots
- `GET /api/snapshots` - List all snapshots (paginated)
- `POST /api/snapshots` - Create a manual snapshot
- `GET /api/snapshots/:id` - Get snapshot metadata
- `GET /api/snapshots/:id/rows` - Get snapshot row data (paginated)
- `GET /api/snapshots/:id/restore-preview` - Preview what restore would change
- `POST /api/snapshots/:id/restore` - Execute restore (full or selective)
- `DELETE /api/snapshots/:id` - Delete a snapshot

### Permissions
- Universal Export: per-module `<module>:export` permissions (7 module-level)
- Bulk Update: `system:bulk_update`
- Snapshot management: `system:change_backup`
- Snapshot restore: `system:change_restore`

## Window Group Endpoints

Window Groups are saved multi-window configurations for multi-monitor control room layouts. See doc 06 (Multi-Window Architecture) for the full Window Group specification and doc 04 for the `window_groups` table schema.

### Window Group CRUD

| Method | Endpoint | Description | Permission |
|--------|----------|-------------|------------|
| `GET` | `/api/window-groups` | List current user's window groups (+ published groups from others) | `console:read` |
| `POST` | `/api/window-groups` | Create a new window group | `console:write` |
| `GET` | `/api/window-groups/:id` | Get a specific window group | `console:read` |
| `PUT` | `/api/window-groups/:id` | Update a window group (owner only) | `console:write` |
| `DELETE` | `/api/window-groups/:id` | Delete a window group (owner only) | `console:write` |
| `POST` | `/api/window-groups/:id/publish` | Publish/unpublish a window group | `console:write` |

### Request/Response Examples

**`POST /api/window-groups`:**
```json
{
  "name": "Control Room A - Full Layout",
  "configuration": {
    "mainWindow": {
      "module": "console",
      "contentId": "ws-uuid-here"
    },
    "secondaryWindows": [
      {
        "module": "process",
        "contentId": "view-uuid-here",
        "screen": 1,
        "x": 0,
        "y": 0,
        "width": 1920,
        "height": 1080
      }
    ]
  }
}
```

**Response:** Standard resource response with `group_id`, `name`, `owner_id`, `is_published`, `configuration`, `created_at`, `updated_at`.

**`GET /api/window-groups`:** Returns an array of window groups. Includes the user's own groups plus any published groups from other users. Standard pagination applies.

### Permissions
- All Window Group endpoints use Console module permissions (`console:read` for listing/viewing, `console:write` for create/update/delete/publish)
- Only the owner can update or delete a window group
- Publishing a window group makes it visible (read-only) to all users with `console:read`

## Recognition Endpoints

Full symbol recognition API specification (12 endpoints across 3 groups, supporting P&ID and DCS domains) is defined in [26_PID_RECOGNITION.md](26_PID_RECOGNITION.md) Section "API Endpoints". Summary:

### Recognition Operations
- `POST /api/recognition/detect` - Run symbol recognition inference on an uploaded image (multipart/form-data; P&ID or DCS). Returns detected symbols with bounding boxes, class names, confidence scores, and OCR results.
- `GET /api/recognition/classes` - List all symbol classes in the loaded model with template availability status.
- `POST /api/recognition/generate` - Generate an SVG graphic from accepted detections (maps symbols to templates, places at coordinates, inserts point binding placeholders).
- `GET /api/recognition/status` - Get recognition service status (model loaded, hardware detected, GPU/CPU mode).

### Model Management (Admin)
- `GET /api/recognition/model` - Get currently loaded model info (version, class count, mAP, loaded timestamp).
- `POST /api/recognition/model` - Upload and activate a new `.iomodel` package (validates manifest, runs ONNX load test, hot-swaps).
- `GET /api/recognition/model/history` - List previously loaded models (version, loaded date, replaced date).
- `DELETE /api/recognition/model` - Unload the current model and disable recognition features.

### Feedback
- `POST /api/recognition/feedback/corrections` - Submit user corrections from the Designer import wizard (class changes, rejections, additions, box adjustments).
- `GET /api/recognition/feedback/stats` - Get aggregate feedback statistics (total inferences, correction rate, top confused classes).
- `POST /api/recognition/feedback/export` - Generate and download a `.iofeedback` package from collected corrections.
- `DELETE /api/recognition/feedback` - Clear collected feedback data (admin only, after export).

### Permissions
- Recognition operations (detect, generate, classes, status): `designer:import` (existing permission)
- Model management (model CRUD): Admin role required
- Feedback operations: `designer:import` for submitting corrections; Admin role for export, stats, and clear

## Alert System Endpoints

Full alert system API specification is defined in [27_ALERT_SYSTEM.md](27_ALERT_SYSTEM.md). Summary:

### Alert Operations

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | /api/alerts | alerts:read | List alerts (paginated, filterable) |
| GET | /api/alerts/active | alerts:read | List active/unacknowledged alerts |
| GET | /api/alerts/:id | alerts:read | Get alert details with deliveries and escalation history |
| POST | /api/alerts | alerts:create | Trigger a manual alert |
| POST | /api/alerts/:id/acknowledge | alerts:acknowledge | Acknowledge an alert |
| POST | /api/alerts/:id/resolve | alerts:create | Resolve an alert |
| POST | /api/alerts/:id/cancel | alerts:create | Cancel an alert |

### Alert Templates

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | /api/alerts/templates | alerts:manage_templates | List all templates |
| GET | /api/alerts/templates/:id | alerts:manage_templates | Get template details |
| POST | /api/alerts/templates | alerts:manage_templates | Create template |
| PUT | /api/alerts/templates/:id | alerts:manage_templates | Update template |
| DELETE | /api/alerts/templates/:id | alerts:manage_templates | Delete template |

### Recipient Rosters

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | /api/alerts/rosters | alerts:manage_rosters | List all rosters |
| GET | /api/alerts/rosters/:id | alerts:manage_rosters | Get roster details |
| POST | /api/alerts/rosters | alerts:manage_rosters | Create roster |
| PUT | /api/alerts/rosters/:id | alerts:manage_rosters | Update roster |
| DELETE | /api/alerts/rosters/:id | alerts:manage_rosters | Delete roster |

### Alert Channels (Admin)

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | /api/alerts/channels | alerts:configure | List channels with status |
| PUT | /api/alerts/channels/:type | alerts:configure | Configure a channel |
| PUT | /api/alerts/channels/:type/enabled | alerts:configure | Enable/disable channel |
| POST | /api/alerts/channels/:type/test | alerts:configure | Test a channel |

### Alert History

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | /api/alerts/:id/deliveries | alerts:read | Per-recipient delivery details |
| GET | /api/alerts/:id/escalations | alerts:read | Escalation history |
| GET | /api/alerts/stats | alerts:read | Alert statistics |

### Webhook Callbacks

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/alerts/webhooks/twilio/status | Twilio signature | SMS delivery status |
| POST | /api/alerts/webhooks/twilio/voice | Twilio signature | Voice call status/keypress |

### Permissions
- Alert reading (list, details, history, stats): `alerts:read`
- Alert creation and lifecycle (create, resolve, cancel): `alerts:create`
- Alert acknowledgment: `alerts:acknowledge`
- Template management: `alerts:manage_templates`
- Roster management: `alerts:manage_rosters`
- Channel configuration: `alerts:configure`

## Email Service Endpoints

Full email service API specification is defined in [28_EMAIL_SERVICE.md](28_EMAIL_SERVICE.md). Summary:

### Email Providers (Admin)

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | /api/email/providers | email:configure | List configured providers |
| GET | /api/email/providers/:id | email:configure | Get provider details (secrets masked) |
| POST | /api/email/providers | email:configure | Create provider |
| PUT | /api/email/providers/:id | email:configure | Update provider |
| DELETE | /api/email/providers/:id | email:configure | Delete provider |
| PUT | /api/email/providers/:id/default | email:configure | Set as default |
| PUT | /api/email/providers/:id/fallback | email:configure | Set as fallback |
| POST | /api/email/providers/:id/test | email:send_test | Send test email |
| PUT | /api/email/providers/:id/enabled | email:configure | Enable/disable |

### Email Templates (Admin)

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | /api/email/templates | email:manage_templates | List templates |
| GET | /api/email/templates/:id | email:manage_templates | Get template |
| POST | /api/email/templates | email:manage_templates | Create template |
| PUT | /api/email/templates/:id | email:manage_templates | Update template |
| DELETE | /api/email/templates/:id | email:manage_templates | Delete template |
| POST | /api/email/templates/:id/preview | email:manage_templates | Preview rendered template |

### Email Operations

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| POST | /api/email/send | Service-internal | Queue email for delivery |
| GET | /api/email/queue | email:view_logs | View queue status |
| POST | /api/email/queue/:id/retry | email:configure | Retry dead message |
| DELETE | /api/email/queue/:id | email:configure | Cancel pending message |

### Email Logs

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | /api/email/logs | email:view_logs | Paginated delivery log |
| GET | /api/email/logs/:id | email:view_logs | Delivery details |
| GET | /api/email/stats | email:view_logs | Delivery statistics |

### Permissions
- Provider configuration: `email:configure`
- Test email sending: `email:send_test`
- Template management: `email:manage_templates`
- Log and queue viewing: `email:view_logs`
- Queue management (retry, cancel): `email:configure`

## Authentication Endpoints

Full authentication API specification is defined in [29_AUTHENTICATION.md](29_AUTHENTICATION.md). Summary:

### Auth Flow

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/auth/providers | None | List enabled auth providers (for login page rendering) |
| POST | /api/auth/login | None | Local auth (username/password) |
| POST | /api/auth/refresh | Refresh cookie | Refresh access token |
| POST | /api/auth/logout | JWT | Invalidate refresh token |

### SSO — OIDC

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/auth/oidc/:config_id/login | None | Redirect to OIDC IdP (generates state, PKCE) |
| GET | /api/auth/oidc/callback | None | Handle IdP callback, exchange code for tokens |

### SSO — SAML

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/auth/saml/:config_id/login | None | Generate AuthnRequest, redirect to IdP |
| POST | /api/auth/saml/acs | None | Assertion Consumer Service (receive SAML response) |
| GET | /api/auth/saml/metadata | None | Serve SP metadata XML |
| POST | /api/auth/saml/slo | None | Single Logout endpoint |

Note: SSO callback endpoints (`/api/auth/oidc/callback`, `/api/auth/saml/acs`) are unauthenticated — they receive responses directly from external IdPs.

### MFA

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/auth/mfa/verify | MFA token | Verify MFA code and complete login |
| POST | /api/auth/mfa/totp/setup | JWT | Begin TOTP enrollment (returns QR code) |
| POST | /api/auth/mfa/totp/verify-setup | JWT | Confirm TOTP setup with verification code |
| DELETE | /api/auth/mfa/totp | JWT | Disable TOTP (requires current code or admin) |
| GET | /api/auth/mfa/recovery-codes | JWT | View recovery codes (only during enrollment) |
| POST | /api/auth/mfa/recovery-codes/regenerate | JWT | Regenerate recovery codes |
| GET | /api/auth/mfa/duo/:config_id/login | MFA token | Redirect to Duo Universal Prompt |
| GET | /api/auth/mfa/duo/callback | None | Handle Duo callback |

### API Keys

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | /api/auth/api-keys | auth:manage_api_keys | List API keys for service accounts |
| POST | /api/auth/api-keys | auth:manage_api_keys | Create API key (returns key value once) |
| DELETE | /api/auth/api-keys/:id | auth:manage_api_keys | Revoke API key |

### Auth Provider Admin

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | /api/auth/admin/providers | auth:configure | List all provider configs |
| GET | /api/auth/admin/providers/:id | auth:configure | Get provider config (secrets masked) |
| POST | /api/auth/admin/providers | auth:configure | Create provider config |
| PUT | /api/auth/admin/providers/:id | auth:configure | Update provider config |
| DELETE | /api/auth/admin/providers/:id | auth:configure | Delete provider config |
| POST | /api/auth/admin/providers/:id/test | auth:configure | Test provider connectivity |

### MFA Policy Admin

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | /api/auth/admin/mfa/policies | auth:manage_mfa | List MFA policies |
| PUT | /api/auth/admin/mfa/policies/:role_id | auth:manage_mfa | Set MFA policy for role |
| DELETE | /api/auth/admin/mfa/policies/:role_id | auth:manage_mfa | Remove role MFA policy |
| GET | /api/auth/admin/mfa/users | auth:manage_mfa | List users' MFA enrollment status |
| POST | /api/auth/admin/mfa/users/:id/reset | auth:manage_mfa | Reset user's MFA enrollment |
| POST | /api/auth/admin/mfa/users/:id/exempt | auth:manage_mfa | Temporarily exempt user from MFA |

### SCIM Token Admin

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | /api/auth/admin/scim/tokens | auth:configure | List SCIM tokens |
| POST | /api/auth/admin/scim/tokens | auth:configure | Generate SCIM token (returns token once) |
| DELETE | /api/auth/admin/scim/tokens/:id | auth:configure | Revoke SCIM token |

### SCIM 2.0 Provisioning

Served at `/scim/v2/` prefix (separate from `/api/`). Authenticated via SCIM bearer token (not JWT). ~15 endpoints for User and Group CRUD, bulk operations, and schema discovery. See doc 29 Section "SCIM 2.0 Provisioning" for full endpoint table.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /scim/v2/ServiceProviderConfig | SCIM bearer | Advertise SCIM capabilities |
| GET | /scim/v2/ResourceTypes | SCIM bearer | Describe User/Group schemas |
| GET | /scim/v2/Schemas | SCIM bearer | Full SCIM schema definitions |
| GET | /scim/v2/Users | SCIM bearer | List/filter users |
| GET | /scim/v2/Users/:id | SCIM bearer | Get user by SCIM ID |
| POST | /scim/v2/Users | SCIM bearer | Create user |
| PUT | /scim/v2/Users/:id | SCIM bearer | Replace user |
| PATCH | /scim/v2/Users/:id | SCIM bearer | Partial update user |
| DELETE | /scim/v2/Users/:id | SCIM bearer | Deactivate user |
| GET | /scim/v2/Groups | SCIM bearer | List/filter groups |
| GET | /scim/v2/Groups/:id | SCIM bearer | Get group |
| POST | /scim/v2/Groups | SCIM bearer | Create group |
| PUT | /scim/v2/Groups/:id | SCIM bearer | Replace group |
| PATCH | /scim/v2/Groups/:id | SCIM bearer | Partial update group |
| DELETE | /scim/v2/Groups/:id | SCIM bearer | Delete group |

### WebSocket Ticket

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/auth/ws-ticket` | JWT | Generate single-use WebSocket connection ticket (30s TTL). Returns `{ ticket: string }`. Consumed by Data Broker on WebSocket connection. |

### Permissions
- Auth flow endpoints (login, SSO callbacks, MFA verify): unauthenticated or MFA token
- User MFA self-service (setup, disable, recovery codes): user's own JWT (no special permission)
- Provider configuration and SCIM tokens: `auth:configure`
- MFA policy management and user MFA admin: `auth:manage_mfa`
- API key management: `auth:manage_api_keys`
- WebSocket ticket: any authenticated user (valid JWT)

## Events & Alarms Endpoints

Unified event model where alarms are a type of event (ISA-18.2). See [04_DATABASE_DESIGN.md](04_DATABASE_DESIGN.md) for schema and event type enums.

### Events

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/events` | `events:read` | List events (paginated, filterable by event_type, source, severity, priority, point_id, date range) |
| `GET` | `/api/events/:id` | `events:read` | Get event details including alarm state history (if alarm-type event) |

### Alarm Definitions

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/alarms/definitions` | `alarms:read` | List alarm definitions (paginated, filterable by type, enabled, point_id) |
| `GET` | `/api/alarms/definitions/:id` | `alarms:read` | Get alarm definition details |
| `POST` | `/api/alarms/definitions` | `alarms:write` | Create alarm definition (threshold, expression, or rate-of-change) |
| `PUT` | `/api/alarms/definitions/:id` | `alarms:write` | Update alarm definition |
| `DELETE` | `/api/alarms/definitions/:id` | `alarms:write` | Soft-delete alarm definition (sets `deleted_at`) |

### Alarm State Transitions

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/alarms/active` | `alarms:read` | List active alarms with current state (unacknowledged, acknowledged, shelved) |
| `POST` | `/api/alarms/:id/acknowledge` | `alarms:acknowledge` | Acknowledge an alarm (records acknowledging user and timestamp) |

### Alarm Shelving

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/alarms/shelved` | `alarms:read` | List currently shelved alarms with expiration times |
| `POST` | `/api/alarms/definitions/:id/shelve` | `alarms:shelve` | Shelve an alarm definition for a duration (seconds) |
| `DELETE` | `/api/alarms/definitions/:id/shelve` | `alarms:shelve` | Unshelve an alarm definition (cancel active shelving) |

### Permissions
- Event reading: `events:read`
- Alarm definition management: `alarms:read` (view), `alarms:write` (create/update/delete)
- Alarm acknowledgment: `alarms:acknowledge`
- Alarm shelving: `alarms:shelve`

## Designer Endpoints

Graphics editor operations. See [09_DESIGNER_MODULE.md](09_DESIGNER_MODULE.md) for full module specification.

### Graphics CRUD

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/designer/graphics` | `designer:read` | List graphics (paginated, filterable by type, mode) |
| `POST` | `/api/designer/graphics` | `designer:write` | Create a new graphic (Graphic, Dashboard, or Report mode) |
| `GET` | `/api/designer/graphics/:id` | `designer:read` | Get graphic with SVG data, bindings, and metadata |
| `PUT` | `/api/designer/graphics/:id` | `designer:write` | Update graphic (SVG, bindings, metadata) |
| `DELETE` | `/api/designer/graphics/:id` | `designer:delete` | Delete a graphic |
| `POST` | `/api/designer/graphics/:id/publish` | `designer:publish` | Publish a graphic for operational use |

### File Import

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `POST` | `/api/designer/import` | `designer:import` | Import a graphics file (multipart/form-data). Async for large files. |

### Templates

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/designer/templates` | `designer:read` | List reusable graphic templates |
| `POST` | `/api/designer/templates` | `designer:publish` | Create a template from a graphic |
| `GET` | `/api/designer/templates/:id` | `designer:read` | Get template details |

### Phone Layout

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/designer/graphics/:id/phone-layout` | `designer:read` | Get phone layout (`layout_phone` JSONB) for a dashboard graphic |
| `PUT` | `/api/designer/graphics/:id/phone-layout` | `designer:write` | Save phone layout for a dashboard graphic |

### Tile Generation

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `POST` | `/api/designer/graphics/:id/generate-tiles` | `designer:write` | Manually trigger tile pyramid regeneration for a graphic (normally automatic on save/publish) |

### Shape/Stencil SVG Export & Reimport

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/designer/shapes/:id/svg` | `designer:read` | Download shape/stencil as standalone SVG file. Works for both library and user-created shapes. |
| `PUT` | `/api/designer/shapes/:id/svg` | `designer:write` | Replace SVG content for a user-created shape/stencil. Multipart/form-data with SVG file. Returns 403 for library shapes (immutable). Validates SVG (parseable, has viewBox, no scripts). Returns dimension change warning if viewBox differs >10%. |

### Permissions
- Graphics CRUD: `designer:read`, `designer:write`, `designer:delete`, `designer:publish`
- File import and recognition: `designer:import`
- Export: `designer:export`
- Shape SVG export: `designer:read`; shape SVG reimport: `designer:write`

## Process View Endpoints

Full-screen super graphic viewer. See [08_PROCESS_MODULE.md](08_PROCESS_MODULE.md) for full module specification. Process views are created in the Designer (Graphic mode); these endpoints serve the viewer.

### Graphics Access

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/graphics/:id` | `process:read` | Get graphic metadata and SVG |
| `GET` | `/api/graphics/:id/points` | `process:read` | Get point bindings for a graphic |
| `GET` | `/api/graphics/hierarchy` | `process:read` | Get view hierarchy tree for navigation |

### Bookmarks

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/process/bookmarks` | `process:read` | List user's bookmarks (saved viewport positions and zoom levels) |
| `POST` | `/api/process/bookmarks` | `process:read` | Create a bookmark (user-scoped, no special write permission needed) |
| `PUT` | `/api/process/bookmarks/:id` | `process:read` | Update a bookmark |
| `DELETE` | `/api/process/bookmarks/:id` | `process:read` | Delete a bookmark |

### Permissions
- View and navigate: `process:read`
- Create/edit process views: `process:write` (via Designer)
- Export: `process:export`

## Reports Endpoints

Report browsing, generation, scheduling, and history. Templates are created in the Designer (Report mode). See [11_REPORTS_MODULE.md](11_REPORTS_MODULE.md) for full module specification.

### Report Templates

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/reports/templates` | `reports:read` | List report templates (paginated) |
| `POST` | `/api/reports/templates` | `reports:write` | Create template (from Designer) |
| `GET` | `/api/reports/templates/:id` | `reports:read` | Get template details |
| `PUT` | `/api/reports/templates/:id` | `reports:write` | Update template |
| `DELETE` | `/api/reports/templates/:id` | `reports:delete` | Delete template |

### Report Generation

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `POST` | `/api/reports/generate` | `reports:read` | Generate report (template ID + time range + parameters). Async for large reports. |
| `GET` | `/api/reports/:id/status` | `reports:read` | Check generation status and progress |
| `GET` | `/api/reports/:id/download` | `reports:read` | Download generated report file (PDF, CSV, XLSX, JSON, HTML) |
| `GET` | `/api/reports/history` | `reports:read` | List generated report history (paginated, filterable by template, date range, status) |

### Report Schedules

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/reports/schedules` | `reports:admin` | List scheduled reports |
| `POST` | `/api/reports/schedules` | `reports:admin` | Create scheduled report (template + schedule + recipients + format) |
| `PUT` | `/api/reports/schedules/:id` | `reports:admin` | Update schedule |
| `DELETE` | `/api/reports/schedules/:id` | `reports:admin` | Delete schedule |

### Permissions
- Report viewing, generation, and download: `reports:read`
- Template management: `reports:write`, `reports:delete`
- Schedule management: `reports:admin`
- Export: `reports:export`

## Forensics Endpoints

Advanced data correlation and investigation. See [12_FORENSICS_MODULE.md](12_FORENSICS_MODULE.md) for full module specification.

### Analysis Operations

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `POST` | `/api/forensics/search` | `forensics:search` | Execute advanced search query across multiple data sources |
| `POST` | `/api/forensics/correlate` | `forensics:search` | Run correlation analysis. Body: `{ point_ids, time_range, algorithms, options }`. Returns ranked correlations with time lag, direction, strength. |
| `POST` | `/api/forensics/detect-patterns` | `forensics:search` | Run pattern detection (change point detection, anomaly identification) |
| `POST` | `/api/forensics/export` | `forensics:export` | Export analysis results with session context (CSV, XLSX, JSON, PDF) |

### Point Selection Helpers

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/forensics/points/by-area?area=...` | `forensics:read` | Get all points sharing an area/unit (for "by unit" selection) |
| `GET` | `/api/forensics/points/by-graphic/:graphic_id` | `forensics:read` | Get all points bound to elements on a graphic (for "by graphic" selection) |
| `GET` | `/api/forensics/points/by-connection/:point_id` | `forensics:read` | Get topologically connected points via Designer pipe/line elements |

### Permissions
- Module access: `forensics:read`
- Search and analysis: `forensics:search`
- Results export: `forensics:export`

## Log Endpoints

Operational logbook with templates, segments, instances, and full-text search. See [13_LOG_MODULE.md](13_LOG_MODULE.md) for full module specification.

### Log Templates

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/logs/templates` | `log:admin` | List log templates |
| `POST` | `/api/logs/templates` | `log:admin` | Create log template (ordered list of segments) |
| `PUT` | `/api/logs/templates/:id` | `log:admin` | Update log template |
| `DELETE` | `/api/logs/templates/:id` | `log:admin` | Delete log template |

### Log Segments

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/logs/segments` | `log:admin` | List reusable log segments |
| `POST` | `/api/logs/segments` | `log:admin` | Create a segment (WYSIWYG text, table of fields, list of fields, or point data section) |
| `PUT` | `/api/logs/segments/:id` | `log:admin` | Update segment |
| `DELETE` | `/api/logs/segments/:id` | `log:admin` | Delete segment |

### Log Instances

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/logs/instances` | `log:read` | List log instances (paginated, filterable by shift, date, status, template) |
| `GET` | `/api/logs/instances/:id` | `log:read` | Get log instance with all entries |
| `PUT` | `/api/logs/instances/:id` | `log:write` | Update log instance (fill in entries, save progress) |
| `POST` | `/api/logs/instances/:id/submit` | `log:write` | Submit completed log instance |
| `DELETE` | `/api/logs/instances/:id` | `log:delete` | Soft-delete log instance (sets `deleted_at` timestamp) |

### Log Attachments & Search

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `POST` | `/api/logs/instances/:id/attachments` | `log:write` | Upload attachment to log instance (multipart/form-data; 10 MB limit) |
| `GET` | `/api/logs/search?q=...` | `log:read` | Full-text search across all log entry content (powered by `tsvector`/GIN index) |

### Log Schedules

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/logs/schedules` | `log:admin` | List log schedules (per-shift, by time window, per team) |
| `POST` | `/api/logs/schedules` | `log:admin` | Create log schedule |
| `PUT` | `/api/logs/schedules/:id` | `log:admin` | Update schedule |
| `DELETE` | `/api/logs/schedules/:id` | `log:admin` | Delete schedule |

### Permissions
- Log reading and search: `log:read`
- Log entry writing and attachments: `log:write`
- Log deletion: `log:delete`
- Template, segment, and schedule administration: `log:admin`

## Rounds Endpoints

Equipment inspection rounds with templates, schedules, instances, and media. See [14_ROUNDS_MODULE.md](14_ROUNDS_MODULE.md) for full module specification.

### Round Templates

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/rounds/templates` | `rounds:read` | List round templates |
| `POST` | `/api/rounds/templates` | `rounds:admin` | Create template (ordered checkpoint list with data types, validation, media requirements) |
| `PUT` | `/api/rounds/templates/:id` | `rounds:admin` | Update template |
| `DELETE` | `/api/rounds/templates/:id` | `rounds:delete` | Delete template |

### Round Schedules

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/rounds/schedules` | `rounds:read` | List round schedules |
| `POST` | `/api/rounds/schedules` | `rounds:admin` | Create schedule (shift-based, daily, interval, weekly) |
| `PUT` | `/api/rounds/schedules/:id` | `rounds:admin` | Update schedule |
| `DELETE` | `/api/rounds/schedules/:id` | `rounds:admin` | Delete schedule |

### Round Instances

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/rounds/instances` | `rounds:read` | List round instances (paginated, filterable by shift, date, status) |
| `GET` | `/api/rounds/instances/:id` | `rounds:read` | Get instance with all responses |
| `POST` | `/api/rounds/instances/:id/start` | `rounds:write` | Start round (locks to user) |
| `POST` | `/api/rounds/instances/:id/complete` | `rounds:write` | Submit completed round |
| `POST` | `/api/rounds/instances/:id/transfer` | `rounds:admin` | Request or force transfer (manager override or notification-based) |
| `POST` | `/api/rounds/instances/:id/responses` | `rounds:write` | Save checkpoint responses (partial save during round) |

### Round Media & History

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `POST` | `/api/rounds/instances/:id/media` | `rounds:write` | Upload media (photo, video, audio) for a checkpoint (multipart/form-data) |
| `GET` | `/api/rounds/history` | `rounds:read` | Completion history and trend data (filterable by template, shift, date range) |

### Permissions
- Round viewing and history: `rounds:read`
- Round completion and media: `rounds:write`
- Round deletion: `rounds:delete`
- Template, schedule, and transfer administration: `rounds:admin`

## System Monitoring Endpoints

Admin dashboard for monitoring system health. See [15_SETTINGS_MODULE.md](15_SETTINGS_MODULE.md) System Monitoring section.

### Service Health

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/system/services` | `system:monitoring` | List all 11 backend services with status from `/healthz` endpoints (healthy/degraded/down) |
| `GET` | `/api/system/services/:name` | `system:monitoring` | Get service detail: uptime, last restart, version, memory, CPU, request rate |

### Resource Metrics

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/system/resources` | `system:monitoring` | CPU, memory, disk usage overview (sourced from Prometheus metrics) |
| `GET` | `/api/system/resources/history?range=1h\|24h\|7d` | `system:monitoring` | Historical resource usage graphs data |

### Database Status

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/system/database` | `system:monitoring` | Connection pool utilization, active queries, replication lag, table sizes, index health |

### Active Sessions

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/system/sessions` | `system:monitoring` | List currently logged-in users (username, IP, session start, last activity, device/browser) |
| `DELETE` | `/api/system/sessions/:id` | `system:monitoring` | Force-terminate a user session |

### Permissions
- All system monitoring endpoints: `system:monitoring` (new permission, Admin only)
- System logs (already in doc 21): `system:logs`

## Backup & Restore Endpoints

Full-system backup and disaster recovery. See [15_SETTINGS_MODULE.md](15_SETTINGS_MODULE.md) Backup & Restore section. All backups use the encrypted `.iobackup` format.

### Backup Operations

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `POST` | `/api/backup` | `system:backup` | Initiate an on-demand database backup (async, returns job ID) |
| `GET` | `/api/backup` | `system:backup` | List available backups (local + configured storage targets) |
| `GET` | `/api/backup/:id` | `system:backup` | Get backup details (date, size, status, I/O version) |
| `GET` | `/api/backup/:id/download` | `system:backup` | Download a `.iobackup` file |
| `DELETE` | `/api/backup/:id` | `system:backup` | Delete a backup file |

### Restore Operations

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `POST` | `/api/backup/upload` | `system:restore` | Upload a `.iobackup` file for restore (multipart/form-data) |
| `POST` | `/api/backup/:id/verify` | `system:restore` | Verify backup integrity (HMAC check, version compatibility) and return preview (date, version, size, content summary) |
| `POST` | `/api/backup/:id/restore` | `system:restore` | Execute restore (requires re-authentication as safety measure) |

### Backup Schedules

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/backup/schedule` | `system:backup` | Get backup schedule configuration |
| `PUT` | `/api/backup/schedule` | `system:backup` | Create or update backup schedule (cron, retention policy, storage target) |
| `DELETE` | `/api/backup/schedule` | `system:backup` | Remove backup schedule |

### Permissions
- Backup operations (create, list, download, delete, schedule): `system:backup`
- Restore operations (upload, verify, restore): `system:restore` (new permission, Admin only)

## Tile Endpoints

Pre-rendered tile pyramid for phone graphics viewing. Tiles generated server-side by `resvg`. See [20_MOBILE_ARCHITECTURE.md](20_MOBILE_ARCHITECTURE.md) Phone Graphics section.

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/tiles/:graphic_id/:z/:x/:y.png` | `console:read` or `process:read` | Serve a single 256x256 PNG tile at zoom level `z`, position `(x, y)` for a graphic |
| `GET` | `/api/tiles/:graphic_id/metadata` | `console:read` or `process:read` | Get tile pyramid metadata (available zoom levels, tile counts, generation timestamp) |

## Shift & Presence Endpoints

Shift management, badge-based presence tracking, and emergency mustering. See [30_ACCESS_CONTROL_SHIFTS.md](30_ACCESS_CONTROL_SHIFTS.md) for full specification.

### Shift Management

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/shifts` | `shifts:read` | List shifts (paginated, filterable by date range, crew, pattern) |
| `GET` | `/api/shifts/current` | `shifts:read` | Get current active shift(s) |
| `GET` | `/api/shifts/current/personnel` | `shifts:read` | List personnel on the current shift (consumed by Alert Service) |
| `GET` | `/api/shifts/:id` | `shifts:read` | Get shift details with assigned personnel |
| `POST` | `/api/shifts` | `shifts:write` | Create a shift |
| `PUT` | `/api/shifts/:id` | `shifts:write` | Update a shift |
| `DELETE` | `/api/shifts/:id` | `shifts:write` | Delete a shift |

### Shift Patterns

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/shifts/patterns` | `shifts:read` | List shift patterns |
| `GET` | `/api/shifts/patterns/:id` | `shifts:read` | Get pattern details |
| `POST` | `/api/shifts/patterns` | `shifts:write` | Create shift pattern |
| `PUT` | `/api/shifts/patterns/:id` | `shifts:write` | Update shift pattern |
| `DELETE` | `/api/shifts/patterns/:id` | `shifts:write` | Delete shift pattern |
| `POST` | `/api/shifts/patterns/:id/generate` | `shifts:write` | Generate shift schedule from pattern for a date range |

### Crews

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/shifts/crews` | `shifts:read` | List crews |
| `GET` | `/api/shifts/crews/:id` | `shifts:read` | Get crew with members |
| `POST` | `/api/shifts/crews` | `shifts:write` | Create crew |
| `PUT` | `/api/shifts/crews/:id` | `shifts:write` | Update crew |
| `DELETE` | `/api/shifts/crews/:id` | `shifts:write` | Delete crew |
| `PUT` | `/api/shifts/crews/:id/members` | `shifts:write` | Set crew membership (replaces member list) |

### Presence

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/presence/on-site` | `presence:read` | List all on-site personnel (consumed by Alert Service) |
| `GET` | `/api/presence/on-site/count` | `presence:read` | On-site headcount |
| `GET` | `/api/presence/status/:user_id` | `presence:read` | Get presence status for a specific user |
| `GET` | `/api/presence/badge-events` | `presence:read` | Paginated badge event history (filterable by person, date range, area) |
| `POST` | `/api/presence/clear/:badge_id` | `presence:manage` | Manually clear on-site status for a stale entry |

### Muster Points

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/muster/points` | `shifts:read` | List configured muster points |
| `GET` | `/api/muster/points/:id` | `shifts:read` | Get muster point details |
| `POST` | `/api/muster/points` | `muster:manage` | Create muster point |
| `PUT` | `/api/muster/points/:id` | `muster:manage` | Update muster point |
| `DELETE` | `/api/muster/points/:id` | `muster:manage` | Delete muster point |

### Muster Events

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/muster/events` | `shifts:read` | List muster events (paginated, filterable by status, date range) |
| `GET` | `/api/muster/events/active` | `shifts:read` | Get active muster event (if any) |
| `GET` | `/api/muster/events/:id` | `shifts:read` | Get muster event details with per-person accounting |
| `POST` | `/api/muster/events/:id/account` | `muster:manage` | Manually mark a person as accounted |
| `POST` | `/api/muster/events/:id/end` | `muster:manage` | End (complete) a muster event |

### Custom Alert Groups

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/alert-groups` | `alert_groups:read` | List custom alert groups |
| `GET` | `/api/alert-groups/:id` | `alert_groups:read` | Get group with members |
| `POST` | `/api/alert-groups` | `alert_groups:write` | Create group |
| `PUT` | `/api/alert-groups/:id` | `alert_groups:write` | Update group |
| `DELETE` | `/api/alert-groups/:id` | `alert_groups:write` | Delete group |
| `PUT` | `/api/alert-groups/:id/members` | `alert_groups:write` | Set group membership |

### Badge Source Configuration

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/badge-sources` | `badge_config:manage` | List configured badge sources |
| `GET` | `/api/badge-sources/:id` | `badge_config:manage` | Get source details (secrets masked) |
| `POST` | `/api/badge-sources` | `badge_config:manage` | Create badge source |
| `PUT` | `/api/badge-sources/:id` | `badge_config:manage` | Update badge source |
| `DELETE` | `/api/badge-sources/:id` | `badge_config:manage` | Delete badge source |
| `POST` | `/api/badge-sources/:id/test` | `badge_config:manage` | Test badge source connectivity |
| `PUT` | `/api/badge-sources/:id/enabled` | `badge_config:manage` | Enable/disable badge source |

### Permissions
- Shift management: `shifts:read` (view), `shifts:write` (create/edit/delete)
- Presence: `presence:read` (view), `presence:manage` (clear stale entries)
- Muster points and events: `muster:manage`
- Custom alert groups: `alert_groups:read`, `alert_groups:write`
- Badge source configuration: `badge_config:manage`

## Notification Endpoints

Human-initiated alerts and system notices. Distinct from `/api/alerts` (doc 27 Alert Service engine). See [31_ALERTS_MODULE.md](31_ALERTS_MODULE.md) for full module specification.

### Send Notifications

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `POST` | `/api/notifications/send` | `alerts:send` | Send a notification (template-based or ad-hoc). Resolves group, renders template, dispatches to Alert Service. |
| `POST` | `/api/notifications/send-emergency` | `alerts:send_emergency` | Send an EMERGENCY notification (elevated permission, triggers full-screen takeover) |

### Notification History

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/notifications` | `alerts:read` | List sent notifications (paginated, filterable by severity, status, date range, sender) |
| `GET` | `/api/notifications/:id` | `alerts:read` | Get notification details including per-recipient delivery status |
| `POST` | `/api/notifications/:id/resolve` | `alerts:send` | Mark a notification as resolved |
| `POST` | `/api/notifications/:id/cancel` | `alerts:send` | Cancel a notification (stops escalation) |

### Notification Templates

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/notifications/templates` | `alerts:read` | List notification templates |
| `GET` | `/api/notifications/templates/:id` | `alerts:read` | Get template details |
| `POST` | `/api/notifications/templates` | `alerts:configure` | Create template |
| `PUT` | `/api/notifications/templates/:id` | `alerts:configure` | Update template |
| `DELETE` | `/api/notifications/templates/:id` | `alerts:configure` | Delete template (built-in cannot be deleted) |

### Notification Groups

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/notifications/groups` | `alerts:read` | List all alert groups |
| `GET` | `/api/notifications/groups/:id` | `alerts:read` | Get group with member list |
| `POST` | `/api/notifications/groups` | `alerts:configure` | Create group |
| `PUT` | `/api/notifications/groups/:id` | `alerts:configure` | Update group |
| `DELETE` | `/api/notifications/groups/:id` | `alerts:configure` | Delete group (built-in cannot be deleted) |
| `POST` | `/api/notifications/groups/:id/members` | `alerts:configure` | Add members to group |
| `DELETE` | `/api/notifications/groups/:id/members/:user_id` | `alerts:configure` | Remove member from group |

### Muster Status

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/notifications/:id/muster` | `alerts:muster` | Get muster status for an emergency notification |
| `POST` | `/api/notifications/:id/muster/mark` | `alerts:muster` | Mark a person as accounted |
| `GET` | `/api/notifications/:id/muster/export` | `alerts:muster` | Export unaccounted personnel list (CSV) |

### Permissions
- Module access, history viewing, and template/group viewing: `alerts:read`
- Sending non-emergency: `alerts:send`
- Sending emergency: `alerts:send_emergency`
- Template and group management: `alerts:configure`
- Muster operations: `alerts:muster`

## Mobile Endpoints

Mobile-specific endpoints for offline sync and batch upload. These use the same JWT authentication as all other endpoints. See [20_MOBILE_ARCHITECTURE.md](20_MOBILE_ARCHITECTURE.md) for the full mobile architecture.

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/mobile/logs/sync?since=<timestamp>` | `log:read` | Get log changes since timestamp (server → client sync) |
| `POST` | `/api/mobile/logs/batch` | `log:write` | Batch upload log entries created offline |
| `GET` | `/api/mobile/rounds/sync?since=<timestamp>` | `rounds:read` | Get round template/schedule changes since timestamp (server → client sync) |
| `POST` | `/api/mobile/rounds/batch` | `rounds:write` | Batch upload round completions created offline |
| `GET` | `/api/mobile/status` | Authenticated | Sync status check (server time, pending uploads, last sync timestamp, server version) |
| `POST` | `/api/mobile/upload/chunk` | Authenticated | Chunked media upload for large files on flaky connections (resume capable) |

## Global Search Endpoints

Unified cross-module search API powering the command palette (Ctrl+K). A single query searches across all entity types the user has permission to see, returning grouped results ranked by relevance.

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| `GET` | `/api/search?q=<query>&limit=20&scope=all` | Authenticated | Unified search across all entity types |

### Query Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `q` | string | required | Search query (min 2 chars). Supports fuzzy matching. |
| `limit` | integer | 20 | Max total results across all categories |
| `scope` | string | `all` | Filter to a single category: `all`, `points`, `graphics`, `dashboards`, `reports`, `logs`, `workspaces`, `equipment`, `users`, `rounds`, `investigations` |

### Response Format

```json
{
  "query": "reactor temp",
  "total_count": 47,
  "results": [
    {
      "category": "points",
      "count": 3,
      "items": [
        {
          "id": "uuid",
          "title": "25-TI-1101",
          "subtitle": "R-2501 Bed 1 Inlet Temperature",
          "category": "points",
          "url": "/process/graphic/hcu?focus=25-TI-1101",
          "relevance": 0.95,
          "meta": { "value": "742.3", "units": "°F", "source": "OPC-01" }
        }
      ]
    },
    {
      "category": "graphics",
      "count": 2,
      "items": [
        {
          "id": "uuid",
          "title": "HCU Reactor Section",
          "subtitle": "Process graphic",
          "category": "graphics",
          "url": "/process/graphic/hcu-reactor",
          "relevance": 0.82,
          "meta": { "type": "process", "point_count": 145 }
        }
      ]
    }
  ],
  "timing_ms": 45
}
```

### Search Strategy

- **Points**: `tsvector` GIN index on `tagname || description`. Boosted if tagname is an exact prefix match.
- **Graphics/Dashboards/Reports/Workspaces**: `tsvector` GIN index on `name || description`.
- **Log entries**: Existing full-text search via `tsvector` (doc 13). Only recent entries (last 90 days) searched to keep response fast.
- **Equipment**: `tsvector` GIN index on `tag || description || area`.
- **Users**: `ILIKE` on `display_name || username`. Only visible to users with `system:users` permission.
- **Round templates**: `tsvector` on `name || description`.
- **Investigations**: `tsvector` on `title || description`. Only user's own + shared investigations.

### Implementation

- API Gateway handles the search endpoint directly (not delegated to another service)
- Executes parallel queries to each entity table, collects results, merges by relevance score, truncates to `limit`
- Each entity query is capped at `limit` rows to prevent any single category from dominating
- RBAC filtering: each sub-query includes permission checks (e.g., log results only returned if user has `log:read`). Users never see entities they can't access.
- Target: <200ms p95 response time
- Results are stateless — no server-side search sessions

### Performance

- All searchable tables have GIN indexes on `tsvector` columns (already exist for per-module search)
- Parallel async queries via `tokio::join!` — all entity queries execute concurrently
- Query timeout: 500ms per sub-query. If a category times out, it returns 0 results for that category (degraded, not failed)
- No full table scans — every search path uses an index

---

## Rate Limiting

### Limits
- Authentication endpoints: 5 requests/minute per IP
- Registration endpoints: 3 requests/hour per IP
- Standard endpoints: 1000 requests/minute per user
- Bulk endpoints: 100 requests/minute per user

Implemented in API Gateway and Auth Service using in-memory sliding window counters. Rate limit headers included in all responses:

### Headers
- `X-RateLimit-Limit`: Total limit
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Reset time (Unix timestamp)

## API Versioning — URL Prefix

All endpoints use URL prefix versioning: `/api/v1/...`

- Every endpoint is mounted under `/api/v1/` prefix
- Axum routing: `Router::new().nest("/api/v1", v1_routes())`
- Breaking changes (removed fields, changed semantics, restructured responses) introduce `/api/v2/` for affected endpoints only — no wholesale route tree duplication
- Additive changes (new optional fields, new endpoints) stay in the current version — these are NOT breaking changes
- Deprecated endpoints return `Sunset` HTTP header with planned removal date
- Maximum 2 concurrent API versions supported at any time
- Old version removed after 6 months or the next major release, whichever is later
- WebSocket protocol is unversioned — evolution via message type additions (new message types are non-breaking)
- OpenAPI specification generated per version (`/api/v1/openapi.json`)

### What Constitutes a Breaking Change

- Removing a field from a response
- Changing a field's type or semantics
- Renaming a field
- Changing error response structure
- Removing an endpoint
- Changing authentication requirements for an endpoint

### What is NOT a Breaking Change (Stays in Current Version)

- Adding a new optional field to a response
- Adding a new endpoint
- Adding a new optional query parameter
- Adding a new error code (with existing error structure)
- Performance improvements

## Success Criteria

- API follows consistent patterns
- Error messages are clear and actionable
- Input validation catches all invalid data
- Pagination works for large datasets
- Point aggregation type validation prevents semantically invalid requests
- Rolling average endpoint computes correctly from appropriate data source
- Data source CRUD operations enforce referential integrity (no orphaned points)
- Point metadata version history returns correct effective version for any timestamp
- UOM display unit preferences persist per-user per-point
- Expression CRUD operations enforce ownership and sharing rules
- Expression test endpoint returns evaluation result with performance metrics
- Point-to-expression assignment correctly sets/clears `custom_expression_id`
- Historical data API responses apply custom expressions server-side when present
- Window Group CRUD enforces owner-only update/delete and surfaces published groups to all readers
- Events API returns alarm state history for alarm-type events
- Alarm shelving correctly enforces time-limited shelve/unshelve
- Designer graphics CRUD operations support all three design modes
- Phone layout and tile generation work end-to-end for mobile graphics
- Report schedules generate on time with email delivery
- Forensics correlation API returns ranked results within <5s target
- Log template/segment/instance lifecycle works with full-text search
- Round instance locking and transfer mechanisms prevent concurrent editing
- System monitoring endpoints return real-time service health and resource metrics
- Backup/restore endpoints support full disaster recovery workflow
- Tile serving returns correct tiles for all zoom levels and positions
- Shift, presence, and muster endpoints integrate correctly with Alert Service routing
- Notification endpoints dispatch through Alert Service (doc 27) without direct channel delivery
- API documentation is accurate and complete

## Change Log

- **v0.21**: Updated Alerts Module API endpoint permissions from old `alerts_module:*` namespace to canonical `alerts:*` per doc 31 v0.2. Mappings: `alerts_module:access`/`alerts_module:view_history` → `alerts:read`, `alerts_module:send` → `alerts:send`, `alerts_module:send_emergency` → `alerts:send_emergency`, `alerts_module:manage_templates`/`alerts_module:manage_groups` → `alerts:configure`, `alerts_module:muster` → `alerts:muster`. Consolidated permissions summary accordingly.
- **v0.20**: Added Global Search Endpoints section. Unified `GET /api/search` endpoint for command palette (Ctrl+K). Searches across points, graphics, dashboards, reports, logs, workspaces, equipment, users, rounds, investigations in parallel. RBAC-filtered per category. GIN indexes on tsvector columns. <200ms p95 target. See doc 06 (Command Palette).
- **v0.19**: Added `POST /api/points/history-batch` endpoint for batch historical data retrieval. Primary consumer: Historical Playback Bar (doc 32) in Console/Process. Streaming JSON response, auto-resolution selection, max 5,000 points × 30 days per request. Requires `console:read` or `process:read`.
- **v0.18**: Added Rate Limiting section under Error Handling. Token bucket middleware with 4 endpoint categories: auth (10/min/IP), SCIM (60/min/token), authenticated (600/min/user), unauthenticated (30/min/IP). Standard response headers (X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, Retry-After). Added RATE_LIMITED (429) to error codes. Note distinguishing API inbound rate limiting from OPC outbound throttling (doc 17).
- **v0.17**: Added Data Links & Point Detail Endpoints section. Data link CRUD (5 endpoints) + chain validation endpoint. Point detail aggregate endpoint (`GET /api/points/:id/detail`). Point detail config endpoints. Permissions: `system:data_link_config`, `system:point_detail_config`. See docs 24 and 32.
- **v0.16**: Replaced "future" API versioning placeholder with concrete URL prefix versioning specification (`/api/v1/...`). Breaking change definition, deprecation policy (Sunset header, 6-month minimum, max 2 concurrent versions), additive change rules.
- **v0.15**: Major endpoint overhaul — promoted doc 21 to canonical API reference for ALL endpoints. Added 13 new endpoint sections (~160 new endpoints): Events & Alarms (events list, alarm definitions CRUD, alarm state transitions, shelving), Designer (graphics CRUD, file import, templates, phone layout, tile generation), Process Views (graphics access, bookmarks), Reports (templates CRUD, generation/download, schedules), Forensics (search, correlate, pattern detection, point selection helpers), Logs (templates, segments, instances, attachments, full-text search, schedules), Rounds (templates, schedules, instances, start/complete/transfer, responses, media, history), System Monitoring (service health, resource metrics, database status, active sessions), Backup & Restore (full backup lifecycle, restore with verification, schedule management), Tiles (tile serving for phone graphics), Shifts & Presence (shift management, patterns, crews, presence, muster points/events, custom alert groups, badge source configuration), Notifications (send, history, templates, groups, muster status). Updated scope note. Expanded success criteria. Cross-referenced expanded System Monitoring and Backup sections from Settings. Added chunked media upload to mobile endpoints.
- **v0.14**: Added Settings & Administration Endpoints section (8 endpoints: application settings CRUD, user management CRUD, system logs, backup). Expanded Mobile Endpoints to match doc 20 sync protocol: added `GET /api/mobile/logs/sync` and `GET /api/mobile/rounds/sync` pull endpoints alongside existing batch upload endpoints. Structural fixes F12/F13.
- **v0.13**: Promoted Rate Limiting from future to required (in-memory sliding window counters, registration rate limit added). Replaced Custom Aggregation TBD with concrete spec (`bucket_interval` query parameter, ISO 8601 duration, on-the-fly `time_bucket()`). Added Mobile Endpoints section (4 endpoints for offline sync and batch upload). Added WebSocket ticket endpoint (`POST /api/auth/ws-ticket`).
- **v0.12**: Added Authentication Endpoints section (~55 endpoints across 10 groups: auth flow, OIDC, SAML, MFA, API keys, provider admin, MFA policy admin, SCIM token admin, SCIM 2.0 provisioning). Updated authentication conventions to cover API keys and SCIM bearer tokens. Updated scope note. References doc 29.
- **v0.11**: Added Alert System Endpoints section (~30 endpoints across 6 groups: operations, templates, rosters, channels, history, webhooks). Added Email Service Endpoints section (~19 endpoints across 4 groups: providers, templates, operations, logs). Updated scope note. See 27_ALERT_SYSTEM.md and 28_EMAIL_SERVICE.md.
- **v0.10**: Updated Recognition Endpoints section: description now says "symbol recognition" (P&ID and DCS) instead of P&ID-only. Updated `/api/recognition/detect` endpoint description to cover both domains. See doc 26.
- **v0.9**: Added scope note clarifying this doc covers infrastructure endpoints; module-specific endpoints are in docs 07-14. Fixed expression sharing permission from `system:point_config` to `system:expression_manage`. Fixed Window Group response field casing from camelCase to snake_case (`group_id`, `owner_id`, `is_published`, `created_at`, `updated_at`) to match all other I/O API endpoints.
- **v0.8**: Added Window Group CRUD and publish endpoints (`/api/window-groups/*`) for multi-window layout management. 6 endpoints using Console module permissions. See doc 06 for full multi-window architecture.
- **v0.7**: Added `/api/recognition/*` endpoint namespace with recognition, model management, and feedback endpoints. See `26_PID_RECOGNITION.md`.
- **v0.6**: Added Export System Endpoints section (~18 endpoints across 3 groups: Universal Export, Admin Bulk Update, Change Snapshots). Includes permission requirements per group. Full specification in 25_EXPORT_SYSTEM.md Section 13.
- **v0.5**: Added Universal Import Endpoints section (~25 endpoints across 7 groups: connections, definitions, discovery, operations, scheduling, history, file upload). Includes permission requirements per group. Full specification in 24_UNIVERSAL_IMPORT.md Section 14.
- **v0.4**: Consistency fixes: corrected `discovered_at` column reference to `effective_from` in version history endpoint. Added missing point lifecycle endpoints (`PUT /api/points/:id/deactivate`, `PUT /api/points/:id/reactivate`). Added source enable/disable endpoints (`PUT /api/sources/:id/enable`, `PUT /api/sources/:id/disable`).
- **v0.3**: Added Expression Builder Endpoints section: expression CRUD (`/api/expressions/*`), context and point query endpoints, test-evaluate endpoint with Rhai sandbox, sharing rules, and point expression assignment (`PUT /api/points/:id/custom-expression`). Added expression-related success criteria.
- **v0.2**: Added Data Sources endpoints (`/api/sources/*`) for multi-source CRUD management. Expanded point metadata responses with `source_id`, `active`, `criticality`, `area`, lifecycle timestamps, and `write_frequency_seconds`. Expanded `PUT /api/points/:id` with app config fields. Added point metadata version history endpoints. Added UOM reference data and display unit preference endpoints with conversion strategy notes.
- **v0.1**: Added Point Data & Aggregation Endpoints section covering point metadata CRUD, historical data with resolution selection, rolling averages, aggregation type validation with error format, and custom aggregation placeholder (future).
