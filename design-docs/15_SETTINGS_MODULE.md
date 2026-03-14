# Inside/Operations - Settings Module

## Overview

System configuration interface for managing users, permissions, and application settings.

## Key Features

### User Management
- Create/edit/disable users
- Set user passwords
- Assign roles to users
- Add users to groups
- View user sessions
- Terminate sessions

### Role & Permission Management
- 8 predefined roles displayed (cannot delete predefined roles, can modify their permissions)
- Custom role creation via "Clone" button on any existing role (no cap on custom roles)
- View roles and their permissions in a role list with expandable permission detail
- Assign permissions to roles via checkbox matrix
- **Group Management**: Create groups, assign one or more roles to a group, manage group membership (add/remove users). Users inherit the combined permissions of all roles assigned to their groups, in addition to any directly assigned roles.
- **Per-Role Settings**: Idle timeout (editable per role, overrides system default) and max concurrent sessions (editable per role, 0 = unlimited)

### Application Settings
- Key-value configuration
- Settings organized by category (general, opc, events, etc.)
- Setting validation
- Apply settings without restart

### Point Source Management
- Admin UI for managing data sources (`point_sources` table)
- Source types: OPC UA, Modbus, MQTT, CSV, Manual Entry
- Add/edit sources with per-type connection configuration
- Cannot remove a source if points reference it (deactivate instead)
- Enable/disable individual sources
- Source health monitoring: connection status, `last_connected_at`, error messages
- Source list view with status indicators (connected, disconnected, error, disabled)
- **Data Category**: When configuring any new data connection (OPC or import), admin selects a data category from a dropdown:
  - 9 predefined categories: Process, Event, Access Control, Personnel, Financial, Maintenance, Ticketing, Environmental, General
  - "Manage Categories" link opens a category CRUD panel where admins can create custom categories
  - Category controls which users (by role/permission) can see data from this connection
  - Category also affects which modules display data from this connection
- **OPC UA source configuration**: When adding or editing an OPC UA source, the configuration form includes: endpoint URL, security policy selection, "Client Certificate" dropdown (lists client certificates from the centralized certificate store — see Certificate Management section below), optional platform dropdown ("What platform is this?" — pre-populates connection profile defaults from doc 17), connection test button, and live connection status indicator. Connection testing and status monitoring are per-source-instance operations. OPC UA server certificates received during connection handshake are automatically stored in the Trusted CAs section of the central certificate store. A "Manage Certificates" link navigates to Settings > Certificates for certificate CRUD.
- **Global minimum publish interval**: `opc.minimum_publish_interval_ms` setting (default: 1000ms, minimum allowed: 100ms). Prevents any OPC source from being configured with a publish interval faster than this floor. Per-source intervals can be set higher but never lower. Protects DCS/historian systems from aggressive polling out of the box. Configurable under Settings > Point Sources as a global guard rail.

### Point Configuration
- Configure per-point aggregation types via `aggregation_types` bitmask on `points_metadata`
- Top-level toggles determine which aggregate operations are semantically valid for each point:
  - **Allow Averaging**: Value can be meaningfully averaged over time (e.g., temperature, pressure, PPM)
  - **Allow Sum/Totaling**: Value can be meaningfully summed over time (e.g., flow volume, production count)
  - **Allow Accumulation**: Value represents a running total or accumulator (e.g., totalizer, event counter)
  - **Custom Aggregation**: User-defined time bucket sizes via `bucket_interval` API parameter (see doc 21) and expression-based calculated values via Expression Builder (see doc 23)
- When a top-level toggle (e.g., "Allow Averaging") is enabled, all time periods for that aggregate type are available in dashboards, trends, forensics, and reports
- `min`, `max`, and `count` are always available regardless of toggle settings (statistical operations, not mathematical)
- Default for new points: `0` (no aggregation types set) - admin should configure per point based on the physical meaning of the value
- Bulk configuration: allow selecting multiple points and applying the same aggregation types
- Point configuration UI is accessible from the Settings module under a "Points" tab
- **Application config columns** (editable per point):
  - `active` toggle - deactivate points instead of deleting (never-delete policy)
  - `criticality` dropdown - safety_critical, environmental, production, informational
  - `area` text field - plant area or zone identifier
  - `default_graphic_id` picker - select from available graphics
  - `gps_latitude` / `gps_longitude` - GPS coordinates for field location
  - `barcode` - scannable identifier for rounds and mobile use
  - `notes` - free-text operational notes
  - `write_frequency_seconds` - expected update interval for staleness detection
- **Custom Conversion / Expression Builder**:
  - "Custom Conversion" button next to each point's UOM configuration in the point detail view
  - Opens Expression Builder modal with `context="conversion"` and `contextPointId` set to the selected point
  - When a custom conversion exists for a point, shows the expression name and a preview of the formula
  - "Edit" button to modify existing custom conversion, "Clear" to remove it
  - On apply: sets `points_metadata.custom_expression_id` for the point
  - See 23_EXPRESSION_BUILDER.md for full Expression Builder specification
- **Point lifecycle management**:
  - Deactivate/reactivate points with automatic timestamp tracking (`deactivated_at`, `reactivated_at`)
  - Never-delete policy enforced by `prevent_point_deletion` database trigger
  - Inactive points hidden from operational views by default, visible via filter toggle
- **Point metadata version history viewer**:
  - View `points_metadata_versions` records for each point
  - Shows source-provided metadata changes over time (forensic history)
  - Read-only timeline of when source metadata was discovered or changed

### Import Management
- Admin UI for configuring and managing external data imports (see 24_UNIVERSAL_IMPORT.md for full specification)
- **Imports** tab in Settings module provides access to:
  - Connector Templates: browse 40 pre-built templates for known applications (SAP, ServiceNow, Maximo, etc.), select a template, enter hostname + credentials, test connection, and start syncing data in minutes
  - Import Connections: configure connections to external databases, files, APIs, messaging systems, and industrial protocols
  - Import Definitions: create imports using a 7-step wizard (connection → source → mapping → transforms → validation → options → review), or instantiate from a connector template with one-click setup
  - Import History: view run history, error details, and data quality metrics
- **Connector Template workflow**: New Import Definition wizard opens with "Start from Template" or "Manual Configuration" choice. Template browser provides search, domain filtering, and a dynamic form showing only the fields the admin needs to fill in (hostname, credentials). "Test Connection" validates before saving. "Advanced: Customize Mappings" drops into the standard wizard with all fields pre-populated. See 24_UNIVERSAL_IMPORT.md Section 5c for full specification and wireframes.
- Connection management: add/edit/delete/test connections to external systems
- Import scheduling: cron, interval, manual, file-arrival, webhook, dependency chain triggers
- Preview and dry-run before committing data
- Error review with drill-down to per-row error details
- Requires `system:import_connections`, `system:import_definitions`, `system:import_execute`, or `system:import_history` permissions

### Data Links
- Admin UI for managing cross-dataset data links (Settings > Imports > Data Links tab)
- **Link List**: Table showing all configured data links with source dataset, source column, target dataset, target column, match type, direction, enabled status
- **Add Link**: "Add Link" button opens a form: pick source dataset (by name, e.g., "RefineryBMaximo01"), pick source column, pick target dataset, pick target column, match type (exact/case_insensitive/transformed), bidirectional toggle
- **Transform Pipeline**: Each side of a link can have a chain of transforms applied. Chip stack UI — each transform is a chip showing plain English description (e.g., "Remove dashes", "Uppercase"). Add transforms from a dropdown of 12 built-in operations, plus regex fallback. Drag to reorder. Live preview with sample data from the dataset.
- **Validation**: On save, the system validates link chains. If a link's dataset has no path to a dataset with a designated point column, a warning is displayed.
- **Point Column Designator**: Visible in Import Definitions — each definition shows which column (if any) is designated as the point column. Point columns also support transforms (same chip stack UI) for tag name normalization.
- Requires `system:data_link_config` permission
- See [24_UNIVERSAL_IMPORT.md](24_UNIVERSAL_IMPORT.md) Section 22 for full Data Links specification

### Point Detail Configuration
- Admin UI for configuring the Point Detail floating panel (Settings > Imports > Point Detail tab)
- **Section Configuration**: Configure which data sections appear in the Point Detail panel and in what order
- **Per-Section Settings**: For each section (e.g., CMMS work orders, ERP inventory, tickets), configure: source dataset, display columns, sort order, row limit, enabled/disabled
- **Equipment Class Overrides**: Optionally configure different Point Detail layouts per equipment class (e.g., pumps show different data than valves)
- **Site Overrides**: Multi-site deployments can configure site-specific Point Detail layouts
- Requires `system:point_detail_config` permission
- See [32_SHARED_UI_COMPONENTS.md](32_SHARED_UI_COMPONENTS.md) for Point Detail panel component specification

### Bulk Update
- Admin-initiated bulk update workflow for modifying configuration data at scale
- Accessible from a "Bulk Update" action menu in the Settings module
- 4-step wizard: Upload (entity selection + file upload or template download) → Validate & Map (column auto-mapping, validation summary) → Diff Preview (field-level changes, conflict detection) → Results (summary, snapshot link, error report)
- Supports bulk editing of: points (app config), users, role assignments, settings, point sources, round templates, log templates, dashboard metadata, import definitions
- Template includes `__id` column (record UUID), editable columns, `[READ-ONLY]` reference columns, `_exported_at` concurrency timestamp
- Concurrency detection: flags rows modified since template export (`updated_at > _exported_at`)
- Idempotent reimport: skips rows where current values already match template values
- Automatic snapshot created before every Apply operation
- Requires `system:bulk_update` permission
- See 25_EXPORT_SYSTEM.md Section 9 for full wizard specification and ASCII mockups

### Change Snapshots
- Point-in-time configuration backup and restore capability
- Accessible from a "Change Snapshots" section in the Settings module
- Two types: automatic (before every bulk update) and manual (admin-initiated)
- Supports both full rollback and selective record restore with "what will change" diff preview
- Restoration always creates its own snapshot before applying (reversible restores)
- Snapshot data stored in PostgreSQL (not as files) with indefinite retention
- Supported tables: points_metadata, users, user_roles, settings, dashboards, workspaces, design_objects, custom_expressions, import_connections, import_definitions
- Non-snapshottable: time-series (too large), audit logs (immutable), system logs (immutable), events (immutable), file attachments (binary), user sessions (transient)
- Deletion warning if snapshot is linked to audit events
- Requires `system:change_backup` (create/view) and `system:change_restore` (restore) permissions
- See 25_EXPORT_SYSTEM.md Section 10 for full specification, restore preview UI, and retention policy

### Recognition
- Admin UI for managing symbol recognition models and feedback collection (P&ID and DCS domains)
- **Model Management**:
  - **Current Models**: displays loaded models per domain (P&ID and/or DCS), with version, training date, class count, mAP summary, hardware detected (GPU/CPU), loaded date
  - **Model Domain**: each .iomodel has a `model_domain` field (`pid` or `dcs`) that determines which recognition pipeline it activates. Multiple models from different domains can be loaded simultaneously.
  - **Import Model**: file upload for `.iomodel` packages with validation (manifest check, ONNX load test, domain detection); triggers hot-swap on success (zero downtime)
  - **Model History**: table of previously loaded models per domain (version, domain, loaded date, replaced date); rollback to a previous version by re-loading from archive
  - **DCS Multi-Model Display**: DCS .iomodel packages contain multiple models (equipment detector, line classifier, text detector, text classifier). The model detail view shows each sub-model's architecture, class count, and performance metrics.
- **Feedback Configuration**:
  - Toggle: enable/disable correction feedback collection (applies to both P&ID and DCS corrections)
  - Toggle: include anonymized symbol crops in feedback (Layer 2)
  - Export: generate `.iofeedback` package from collected corrections (includes domain field per correction)
  - Stats: total inferences per domain, total corrections, correction rate, top confused classes. DCS stats include per-model-type breakdowns (equipment vs line vs text).
  - DCS-specific correction types: `state_misclassification`, `line_misclassification` in addition to standard types
- **Variation Gap Reports** (.iogap):
  - Import: file upload for `.iogap` packages from SymBA's variation tracking system
  - Gap Summary: overall coverage percentage, per-equipment-type coverage, priority recommendations
  - Variation Browser: view representative thumbnails for each symbol variation cluster. See which variations are matched to I/O symbols and which have no match.
  - Recommendations: actionable list of symbol additions needed to improve coverage (e.g., "Add 5-8 gate valve variants to cover 80% of observed variations")
  - History: previously imported gap reports with date and coverage trend over time
- Section shows domain-specific messages: "No P&ID model loaded" and/or "No DCS model loaded" as appropriate
- Accessible to Admin users only
- See [26_PID_RECOGNITION.md](26_PID_RECOGNITION.md) for full recognition specification

### Alert Configuration
- Admin UI for configuring alert channels, templates, rosters, and viewing alert history (Settings > Alerts)
- **Channels tab**: List of channel adapters with enabled/disabled toggle, per-channel configuration forms, and "Test" button per channel
  - Channels: WebSocket (always on, not disableable), Email, SMS (Twilio), Voice (Twilio), Radio Dispatch, PA System, Browser Push
- **Templates tab**: CRUD for alert templates
  - Name, severity, title template, message template (with variable placeholders)
  - Channel selection (which channels to use for this template)
  - Escalation policy builder (delay intervals, escalation roster chain)
  - Roster selection (which rosters receive the alert)
  - Preview button to render template with sample variables
- **Rosters tab**: CRUD for recipient rosters
  - Name, source type (manual, role group, all users)
  - Member editor with per-member channel contact info (email, phone, etc.)
- **History tab**: Full alert history view
  - Paginated list, filterable by severity, status, date range, channel, source
  - Expandable rows showing per-recipient delivery details and escalation history
- Requires `alerts:configure`, `alerts:manage_templates`, `alerts:manage_rosters`, or `alerts:read` permissions (per tab)
- See [27_ALERT_SYSTEM.md](27_ALERT_SYSTEM.md) for full alert system specification

### Authentication
- Admin UI for managing authentication providers, MFA policies, API keys, and SCIM provisioning (Settings > Authentication)
- **Providers tab**: Provider list table showing name, type (OIDC/SAML/LDAP), enabled status, JIT provisioning flag, user count, last test result
  - "Add Provider" button opens provider wizard: select type → type-specific config form → group-to-role mapping editor → Test Connection → Save/Enable
  - OIDC form: issuer URL (auto-discovers endpoints), client ID, client secret, scopes, claims mapping
  - SAML form: upload IdP metadata (URL or XML paste) → auto-populate SSO URL and cert → download SP metadata for IdP configuration
  - LDAP form: server URL, TLS mode, bind DN/password, search bases, user/group filters, attribute mapping, test connection
  - Edit/Delete existing providers. Delete blocked if users are linked to the provider.
  - "Test Connection" button per provider (OIDC: discovery fetch, SAML: metadata parse, LDAP: bind test)
- **MFA tab**: Global MFA method configuration and per-role MFA policies
  - Enable/disable each MFA method: TOTP, Duo, SMS, Email
  - Duo configuration fields (API hostname, client ID, client secret) when Duo is enabled
  - Security warnings displayed for SMS and Email methods (SIM swap risk, email compromise risk)
  - Per-role MFA policy table: role name, MFA required toggle, allowed methods checkboxes, grace period input, max failures, lockout duration
  - User MFA status table (filterable): username, enrollment status, active method, last MFA use, enrollment deadline. Actions: Reset MFA, Exempt (with expiry), Force MFA.
  - Recovery code policy: display count (8), regeneration rules
- **API Keys tab**: Manage service account API keys
  - List table showing key name, prefix (e.g., `io_sk_a3b`), assigned permissions/scopes, last used timestamp, expiration date
  - "Create API Key" button: name, scope selection, optional expiry. Key value shown once on creation (not retrievable afterward).
  - Revoke button per key (confirmation dialog)
- **SSO Settings** (within Providers tab or as sub-section):
  - Default auth provider dropdown (which provider is pre-selected on login page)
  - "Allow local auth alongside SSO" toggle (warning if disabling: ensure SSO is tested first)
  - JIT provisioning defaults: default role for JIT-created users, auto-enable toggle
- **Local Auth** sub-section:
  - Enable/disable local authentication
  - Password policy: minimum length, complexity requirements, password history depth
  - Account lockout: max failures, lockout duration
  - Session settings: access token lifetime, refresh token lifetime
- **SCIM** sub-section:
  - Enable/disable SCIM 2.0 provisioning
  - Generate/revoke SCIM bearer tokens (token shown once on creation)
  - SCIM endpoint URL display (copy-paste for IdP configuration)
  - Provisioning log: recent SCIM operations (user created, updated, deactivated) with timestamps
- Requires `auth:configure` (provider and SCIM config), `auth:manage_mfa` (MFA policies and user MFA status), or `auth:manage_api_keys` (API key management) permissions
- See [29_AUTHENTICATION.md](29_AUTHENTICATION.md) for full authentication specification

### EULA Management
- Admin UI for managing EULA versions and viewing acceptance records (Settings > EULA)
- Requires `system:configure` permission
- **Versions tab**:
  - Table showing all EULA versions: version number, status badge (Draft / Active / Archived), published date, published by, acceptance count
  - Active version highlighted with green badge
  - "Create New Version" button → opens markdown editor pre-populated with the current active version's content (as a starting point for edits)
  - Draft versions show "Edit" and "Delete" buttons
  - Draft versions show "Publish" button with confirmation dialog: *"Publishing this version will require all users to re-accept the EULA on their next login. The current active version (v{X}) will be archived. This cannot be undone."*
  - Active and archived versions show "View" button (read-only)
  - Published versions cannot be edited or deleted (enforced at DB level)
  - Version content editor: split-pane markdown editor (left: raw markdown, right: rendered preview). Full-screen toggle for editing.
- **Acceptance Records tab**:
  - Searchable, sortable table of all acceptance records across all versions
  - Columns: Username, Version, Accepted At, IP Address, Role(s), User Agent
  - Filter controls: version dropdown, date range picker, username search
  - **Acceptance summary cards** at top: Total Users, Accepted Current Version (count + percentage), Pending Acceptance (count + percentage)
  - Pending users list: users who have not yet accepted the current active version (filterable, useful after publishing a new version to track rollout)
  - "Export CSV" button → downloads complete acceptance history for legal/audit purposes. Export includes all columns plus `content_hash` for cryptographic proof of what was shown.
  - Acceptance records are read-only — no edit or delete actions available (append-only by design)
- See [29_AUTHENTICATION.md](29_AUTHENTICATION.md) for EULA acceptance gate flow, schema, and API endpoints

### Email Configuration
- Admin UI for managing email providers, templates, and delivery logs (Settings > Email)
- **Providers tab**: CRUD for email providers
  - Supported provider types: SMTP, SMTP+XOAUTH2, Microsoft Graph, Gmail, Webhook, Amazon SES
  - Set default provider, set fallback provider, enable/disable individual providers
  - Test connection button per provider
- **Templates tab**: CRUD for email templates
  - System templates are editable but not deletable; custom templates are fully manageable
  - Preview button renders template with sample variables
- **Logs tab**: Paginated email delivery log
  - Filterable by status, provider, date range, context type
  - Queue status summary showing pending, retry, and dead letter counts
- Requires `email:configure`, `email:manage_templates`, or `email:view_logs` permissions (per tab)
- See [28_EMAIL_SERVICE.md](28_EMAIL_SERVICE.md) for full email service specification

### Certificate Management

Centralized certificate management for all TLS and mutual-TLS needs across I/O. Replaces any per-service certificate handling with a single management point at Settings > Certificates.

**Three certificate types managed centrally:**

| Type | Purpose |
|------|---------|
| Server Certificates | TLS for I/O's own HTTPS endpoint (nginx) |
| Client Certificates | Mutual TLS for OPC UA connections, external APIs |
| Trusted CAs | CA certificates the system trusts for verification |

**Certificate List View:**
Table showing all installed certificates with: name, type (server/client/CA), subject CN, issuer, expiry date, status indicator, active/inactive toggle. Sortable and filterable by type.

**Status Indicators:**
- Green: Valid, >15 days to expiry (for very short-lived certificates, use percentage-based threshold instead of fixed 15 days)
- Amber: Expiring within 15 days
- Red: Expired or invalid

Status is visible to all authenticated users via a status bar/indicator. Configuration requires `system:certificates` permission (admin-only).

**Certificate Operations:**

1. **Self-Signed Generation**: Auto-generated on first install via `rcgen` crate. Used as default until the admin configures a proper certificate. Prominent banner displayed: "This server is using a self-signed certificate. Configure a trusted certificate in Settings > Certificates."

2. **ACME / Let's Encrypt** (Phase 2):
   - Admin enters hostname, clicks "Issue Certificate"
   - `instant-acme` (Apache-2.0, pure Rust) handles ACME protocol natively, compiled into API Gateway (no subprocess). See doc 01 v1.9 and doc 22 v1.4.
   - **HTTP-01 challenge** (default): Requires port 80 reachable from the internet. API Gateway places a file at `http://<DOMAIN>/.well-known/acme-challenge/<TOKEN>`, Let's Encrypt verifies it.
   - **DNS-01 challenge** (alternative, works behind firewalls): Two paths:
     - **Automatic**: Admin provides DNS API credentials. System creates the required `_acme-challenge` TXT record automatically.
     - **Manual**: System displays the required TXT record name and value. Admin adds it to their DNS provider manually, then clicks "Verify" in the UI.
   - Auto-renewal via API Gateway internal renewal endpoint triggered on schedule (checks twice daily, renews 30 days before expiry)
   - Zero-downtime certificate swap: write cert files atomically, validate with `nginx -t`, then `systemctl reload nginx` (SIGHUP — graceful worker rotation)

3. **CSR Generation**: For corporate CA workflows.
   - Admin fills in hostname (CN), optional SANs, organization, key type (RSA 4096 default / RSA 2048 / ECDSA P-256 / P-384)
   - System generates key pair + CSR via `rcgen` — private key stored on server, never shown to user
   - CSR displayed as copyable PEM text with "Copy to Clipboard" and "Download CSR" buttons
   - Admin submits CSR to their corporate CA, receives signed certificate, returns to import it
   - On import, system detects key match and uses the existing private key from CSR generation

4. **Certificate Import**: Upload PEM (`.pem`, `.crt`) or PFX (`.pfx`, `.p12`) files, or paste PEM text directly.
   - PFX import: password prompt to decrypt, extracts cert + key + chain automatically. Password used once for extraction, never stored.
   - Validation on import: PEM parsing, key-certificate match, chain completeness check, expiry check, hostname match (warning if mismatch, allow override), key strength check (minimum 2048-bit RSA or P-256 ECDSA)
   - Validation results displayed with green checks / red X marks before install

5. **HSTS**: Off by default. Admin toggle to enable. Warning text: "Only enable HSTS after confirming your TLS certificate is valid and trusted." When enabled: `Strict-Transport-Security: max-age=63072000; includeSubDomains`. HSTS preload is explicitly out of scope (internal hostnames, dynamic deployments).

**OPC UA Certificates:** Client certificates for OPC UA connections are managed from this central store. OPC connection configuration (in Point Source Management) gets a "Select Certificate" dropdown pointing to client certificates here, replacing any per-connection certificate upload. OPC UA server certificates received during connection are stored in the Trusted CAs section. See [17_OPC_INTEGRATION.md](17_OPC_INTEGRATION.md) § Connection Parameters.

**Permission:** `system:certificates` — admin-only for all certificate configuration operations. Certificate status (valid/expiring/expired indicator) is visible to all authenticated users.

**Rust crates** (all MIT/Apache-2.0):
- `rcgen`: Generate self-signed certs, CSRs, key pairs (part of the rustls project)
- `x509-parser`: Parse and inspect imported certificates (pure Rust, zero-copy)
- `rustls-pemfile`: Parse PEM files for keys and certificates

**Certificate API Endpoints:**
- `GET /api/certificates` — List all certificates in the store
- `GET /api/certificates/:id` — Certificate detail (subject, issuer, expiry, SANs, type, status)
- `POST /api/certificates/import` — Upload certificate + key (multipart form or JSON with PEM text)
- `POST /api/certificates/import/pfx` — Upload PFX file with password
- `POST /api/certificates/csr/generate` — Generate CSR with provided parameters, returns CSR PEM
- `GET /api/certificates/csr/download` — Download latest generated CSR as file
- `POST /api/certificates/acme/configure` — Configure ACME (hostname, email, challenge type, DNS provider credentials)
- `POST /api/certificates/acme/issue` — Issue or force-renew certificate now
- `PUT /api/certificates/hsts` — Enable/disable HSTS, set max-age
- `GET /api/certificates/history` — List of previous certificates
- `PUT /api/certificates/:id/activate` — Set a certificate as the active server or client cert
- `DELETE /api/certificates/:id` — Remove a certificate from the store (blocked if in use by an OPC connection)

### Data Export
- Export buttons on all Settings data tables: users, points, sources, events, audit log, expressions, import connections, import definitions, application settings
- Standard `[Export v]` split button on each table toolbar
- Settings data exports respect field classification: Forbidden fields (password_hash, refresh_token, connection secrets) are never exported
- Requires `settings:export` permission
- See 25_EXPORT_SYSTEM.md Section 6 for full per-entity exportable data inventory

### System Monitoring

Admin dashboard for monitoring system health, resource usage, and operational status.

**Service Health Dashboard:**
- All 11 backend services displayed with status from `/healthz` endpoints
- Status indicators: Green (healthy), Yellow (degraded), Red (down)
- Auto-refresh every 30 seconds
- Click any service for detail panel: uptime, last restart, version, memory usage, CPU usage, request rate

**System Log Viewer:**
- Reads from `system_logs` table (operator-facing events, not raw application logs)
- Filterable by: service, log level (info/warn/error), time range, keyword search
- Auto-refresh with new entries appearing at top
- Export filtered results to CSV
- Color-coded by severity level

**Resource Overview:**
- CPU, memory, disk usage sourced from Prometheus metrics via API Gateway
- Per-service resource breakdown (which service is consuming what)
- Historical graphs with selectable time range: last 1 hour, 24 hours, 7 days
- Threshold alerts displayed inline: disk > 90%, memory > 85%
- Disk usage includes breakdown: database, uploads, backups, logs

**Database Status:**
- Connection pool utilization (active / idle / max connections)
- Active queries count (with option to view long-running queries)
- Replication lag (visible only for Resilient and Enterprise HA deployment profiles)
- Table sizes for largest tables (time-series hypertables, audit_log, events)
- Index health summary

**OPC Connection Status:**
- Per-source status from Point Source Management
- Connected / Disconnected / Error state per source
- Last communication timestamp per source
- Subscription count and current data rate per source
- Quick link to Point Source Management for configuration

**Active Sessions:**
- Currently logged-in users listed with: username, IP address, session start time, last activity timestamp, device/browser (from User-Agent)
- Sortable and filterable
- Admin can force-terminate any session (confirmation dialog required)
- Count of total active sessions displayed prominently

**Recent Admin Actions:**
- Sourced from `audit_log`, filtered to admin-level operations
- Last 50 entries by default, paginated
- Categories: role changes, permission changes, config changes, user management, backup operations, import operations
- Each entry shows: timestamp, user, action type, target entity, summary
- Click for full audit detail including before/after values

### Backup & Restore

Full-system backup and disaster recovery capability.

**Backup Scope:**
- Database: full `pg_dump` of all PostgreSQL databases
- Configuration files: environment files, service configurations
- TLS certificates and keys
- Uploaded files: SVGs, photos, attachments, .iomodel files
- Everything needed to rebuild a complete I/O installation from scratch on bare hardware

**Custom `.iobackup` Format:**
AES-256-GCM encrypted single-file container with the following structure:

```
backup_20260310_143000.iobackup
├── manifest.json         # I/O version, backup timestamp, content inventory, per-file checksums
├── database.sql.zst      # pg_dump output, zstd compressed
├── config/               # Environment files, service configurations
├── certs/                # TLS certificates and keys
├── uploads/              # All user-uploaded files (SVGs, photos, attachments, .iomodel)
└── signature             # HMAC-SHA256 integrity verification
```

- Version-tagged in manifest: restore process detects version mismatch and knows whether database migrations are needed
- Manifest includes SHA-256 checksums for every file in the archive

### Encryption & Key Recovery (Triple-Wrapped DEK)

Each `.iobackup` file is encrypted with a random 256-bit DEK (Data Encryption Key) using AES-256-GCM. The DEK is independently wrapped three ways — any single path can decrypt the backup:

1. **Customer Passphrase** (normal use): DEK wrapped with a KEK derived from the customer's passphrase via Argon2id (memory: 64MB, iterations: 3, parallelism: 4). Salt stored in backup manifest. Customer enters passphrase at restore time.

2. **Customer Recovery Key** (self-service recovery): A random 256-bit recovery key generated during initial I/O setup. Displayed once as a formatted string (like BitLocker recovery keys) for the customer to print and store securely (e.g., in a safe). DEK wrapped with this key. If the customer forgets their passphrase, they use this key instead.

3. **Vendor Recovery Key** (last-resort): DEK wrapped with an RSA-4096 public key (OAEP-SHA256) belonging to the I/O vendor. The vendor's private key is stored on an air-gapped machine with Shamir Secret Sharing splits at separate physical locations. Recovery requires the customer to contact the vendor, verify identity, and receive assistance.

**Rust crates** (all MIT/Apache-2.0): `aes-gcm`, `argon2`, `rsa`, `rand`, `sha2`

**Setup workflow:**
- On first I/O installation, system generates the customer recovery key
- Admin is shown the key and prompted to print/save it — this screen cannot be revisited
- Admin sets a backup passphrase
- Both are used to wrap the DEK for every subsequent backup
- Vendor public key is embedded in the I/O binary

**Important:** The recovery key is shown ONCE during setup. If lost, the vendor recovery path is the only remaining option.

HMAC-SHA256 signature for tamper detection (verified before decryption).

**Scheduled Backups:**
- Configurable schedule: daily, weekly, or custom cron expression
- Retention policy: keep last N backups, age-based expiration (e.g., keep dailies for 7 days, weeklies for 4 weeks)
- Storage targets: local filesystem path, NFS mount, S3-compatible object storage (MinIO, AWS S3, etc.)
- Email notification on success or failure via Email Service (doc 28)
- Backup job runs as a background task — does not block the UI or other services

**On-Demand Backup:**
- Manual trigger from Backup & Restore UI
- Progress indicator showing current phase (database dump, file collection, compression, encryption)
- Download button available when complete
- On-demand backups respect the same `.iobackup` format and encryption

**Restore:**
1. Upload `.iobackup` file (or select from configured storage target)
2. Integrity verification: HMAC signature check before decryption
3. Enter backup passphrase for decryption
4. Version compatibility check: warn if backup is from a different I/O version
5. Preview: display backup date, I/O version, database size, file count, content summary
6. Confirm and restore (requires re-authentication as a safety measure)
7. Must work on a completely fresh I/O installation — full disaster recovery capability

**Backup Health Monitoring:**
- Alert (via Alert Service) if scheduled backup has not run within expected window
- Display last successful backup date/time prominently on the System Monitoring dashboard
- Warning banner in Settings if no backup exists or last backup is older than configured threshold

## User Stories

1. **As an admin, I want to create new users and assign them roles, so they can access the system.**

2. **As a system admin, I want to add and configure OPC UA sources (with certificates and connection testing), so the system connects to our data sources.**

3. **As a manager, I want to view application logs, so I can troubleshoot issues.**

## Technical Requirements

### User Interface
- Tabbed interface for different settings categories
- Form validation
- Confirmation dialogs for destructive actions
- Live status indicators

### Security
- Only Admin role can access Settings module
- Password changes require current password
- Audit all setting changes

### Persistence
- Settings in settings table (key-value JSONB)
- Apply settings by updating in-memory cache
- Some settings require service restart (noted in UI)

### Configuration Reload Behavior

Settings fall into two categories based on how they take effect after a change.

**Restart required** (environment variables / config files, read once at service startup):
- Database connection strings (`DATABASE_URL`)
- Listen ports and bind addresses (per-service)
- TLS certificates and key paths
- IPC socket paths (Unix domain sockets)
- `IO_SERVICE_SECRET` (inter-service auth)
- Twilio credentials (account SID, auth token)
- SMTP server credentials (host, port, username, password)
- OIDC/SAML provider configuration (issuer URLs, client secrets, IdP metadata)
- YARA-X rule paths
- `RUST_LOG` level configuration

**Hot-reload** (database-backed, changes take effect immediately or within cache TTL):
- Alert thresholds and escalation policies
- OPC polling intervals
- Email templates
- RBAC permission and role changes
- Data retention policies
- Display settings and themes
- Point configuration (aggregation types, criticality, area, active status)
- Expression definitions
- Export format settings
- Import definitions and schedules
- All Settings UI fields not listed in the restart-required category above

**UI treatment:** The Settings UI displays a warning icon next to any setting that requires a service restart, with text: "Requires service restart to take effect." Changed values in the restart-required category are persisted immediately but do not take effect until the relevant service is restarted.

## API Endpoints

- `GET /api/settings` - Get all settings
- `PUT /api/settings/:key` - Update setting
- `GET /api/users` - List users
- `POST /api/users` - Create user
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Disable user
- `GET /api/system-logs` - View application logs
- `POST /api/backup` - Initiate backup
- `GET /api/points` - List points with metadata (paginated, searchable by tagname)
- `GET /api/points/:id` - Get point metadata including aggregation_types
- `PUT /api/points/:id` - Update point application config (aggregation_types, active, criticality, area, write_frequency_seconds, default_graphic_id, GPS, barcode, notes, app_metadata)
- `PUT /api/points/bulk/aggregation-types` - Bulk update aggregation_types for multiple points
- `PUT /api/points/:id/deactivate` - Deactivate a point (sets active=false, records timestamp)
- `PUT /api/points/:id/reactivate` - Reactivate a point (sets active=true, records timestamp)
- `GET /api/points/:id/versions` - Get metadata version history for a point
- `PUT /api/points/:id/custom-expression` - Apply or clear custom conversion expression for a point
- `GET /api/sources` - List all point sources with status
- `POST /api/sources` - Create a new point source
- `PUT /api/sources/:id` - Update source configuration
- `DELETE /api/sources/:id` - Remove source (fails if points reference it)
- `PUT /api/sources/:id/enable` - Enable a source
- `PUT /api/sources/:id/disable` - Disable a source

## Success Criteria

- Admins can manage users and roles
- Settings can be configured via UI
- OPC UA sources can be configured with certificates, tested, and monitored from Point Source Management
- Point aggregation types can be configured per point and in bulk
- Aggregation type settings correctly filter available options in dashboards, trends, forensics, and reports
- Point sources can be added, configured, enabled/disabled, and monitored
- Point application config (criticality, area, active, etc.) can be edited per point
- Points can be deactivated and reactivated with proper timestamp tracking
- Point metadata version history is viewable for forensic review
- Custom conversions can be created, tested, saved, and applied to points via Expression Builder
- Points with custom expressions display the expression name and formula preview
- Logs are accessible for troubleshooting
- Backup/restore functions work reliably

## Change Log

- **v2.2**: Replaced acme.sh (ISC, subprocess) with instant-acme (Apache-2.0, pure Rust) for ACME certificate issuance. instant-acme compiles into API Gateway natively — no subprocess, no shell dependency. Removed "150+ providers supported via acme.sh plugins" claim. Updated auto-renewal from systemd timer to API Gateway internal renewal endpoint. See doc 01 v1.9 and doc 22 v1.4.
- **v2.1**: Replaced Custom Aggregation TBD with concrete references to `bucket_interval` (doc 21) and Expression Builder (doc 23).
- **v2.0**: Added global minimum publish interval setting (`opc.minimum_publish_interval_ms`, default 1000ms, min 100ms) under Point Sources. Prevents any OPC source from being configured faster than the floor. Added platform dropdown to OPC UA source configuration form (pre-populates connection profile defaults from doc 17).
- **v1.9**: Added Data Links section (Settings > Imports > Data Links tab) — link list, add/edit form, transform pipeline chip stack UI, chain validation, point column designator. Added Point Detail Configuration section (Settings > Imports > Point Detail tab) — section configuration, per-section settings, equipment class overrides, site overrides. 2 new permissions: `system:data_link_config`, `system:point_detail_config`. See docs 24 and 32.
- **v1.8**: Added EULA Management section (Settings > EULA). Versions tab with draft/active/archived lifecycle, split-pane markdown editor, publish confirmation with re-acceptance warning. Acceptance Records tab with searchable audit table, acceptance summary cards, pending users list, CSV export for legal audit. All records read-only (append-only by design). See 29_AUTHENTICATION.md for schema and API.
- **v1.7**: Added Connector Templates to Import Management. Imports tab now includes template browser with 40 pre-built templates for known applications. New Import Definition wizard gains "Step 0" choice between template-based and manual configuration. Template workflow: browse by domain/vendor → enter hostname + credentials → test → save & sync. "Advanced: Customize Mappings" link drops into standard wizard with pre-populated fields. See 24_UNIVERSAL_IMPORT.md Section 5c.
- **v1.6**: Deep dive: Centralized certificate management (server/client/CA trust), ACME/Let's Encrypt with HTTP-01 + DNS-01 (manual and automatic), self-signed auto-generation, CSR generation, certificate import (PEM/PFX), status indicators, HSTS toggle. Data category selection in connection config (9 predefined + custom categories). Updated role management for 8 predefined roles + clone-based custom roles + groups + per-role idle timeout and max concurrent sessions.
- **v1.5**: Added triple-wrapped DEK encryption detail for .iobackup files — customer passphrase, customer recovery key, vendor RSA recovery. Argon2id KDF, AES-256-GCM, all crates MIT/Apache-2.0.
- **v1.4**: Expanded System Monitoring — service health dashboard, system log viewer, resource overview, database status, OPC connection status, active sessions, recent admin actions. Expanded Backup & Restore — .iobackup encrypted container format, scheduled backups with retention, S3-compatible storage, restore on fresh installation, backup health monitoring.
- **v1.3**: Merged OPC Configuration into Point Source Management; OPC UA certificate upload, connection test, and status are now per-source operations. Removed standalone OPC Configuration section. Updated user story and success criteria.
- **v1.2**: Added Configuration Reload Behavior section enumerating restart-required settings (DB connections, ports, TLS, IPC paths, service secret, Twilio/SMTP credentials, OIDC/SAML config, YARA-X paths, RUST_LOG) vs hot-reload settings (alert thresholds, OPC intervals, email templates, RBAC, retention, display, point config, expressions, exports, imports). UI warning icon spec for restart-required settings.
- **v1.1**: Added Authentication section (Settings > Authentication) with Providers, MFA, API Keys, SSO Settings, Local Auth, and SCIM sub-sections. References doc 29.
- **v1.0**: Added Alert Configuration section (Settings > Alerts) with Channels, Templates, Rosters, and History tabs. Added Email Configuration section (Settings > Email) with Providers, Templates, and Logs tabs. See 27_ALERT_SYSTEM.md and 28_EMAIL_SERVICE.md.
- **v0.9**: Expanded Recognition section for dual-domain support (P&ID + DCS). Added DCS multi-model display, DCS-specific correction types, variation gap report (.iogap) import and browser. See SymBA 17_IO_INTEGRATION.md.
- **v0.8**: Removed duplicate `PUT /api/points/:id/config` endpoint (canonical endpoint is `PUT /api/points/:id` per doc 21). Renamed `GET /api/logs` to `GET /api/system-logs` to avoid collision with operational Log Module's `GET /api/logs`.
- **v0.7**: Added Recognition administration section for model management and feedback configuration. See `26_PID_RECOGNITION.md`.
- **v0.6**: Added Bulk Update section (4-step wizard for bulk configuration editing), Change Snapshots section (point-in-time backup/restore), and Data Export section (export buttons on all Settings tables). Added 3 new system permissions: `system:bulk_update`, `system:change_backup`, `system:change_restore`. Added `settings:export` permission. See 25_EXPORT_SYSTEM.md.
- **v0.5**: Added Import Management section. Settings module gains an "Imports" tab for managing external data import connections, definitions (wizard-based), scheduling, history, and error review. Requires 4 new RBAC permissions. Full specification in 24_UNIVERSAL_IMPORT.md.
- **v0.4**: Fixed `PUT /api/points/:id` endpoint description to list application config fields only (removed source-provided fields `description` and `engineering_units` which are synced from metadata versions, not admin-editable).
- **v0.3**: Added Custom Conversion / Expression Builder integration to Point Configuration. Points gain a "Custom Conversion" button that opens the Expression Builder modal (23_EXPRESSION_BUILDER.md). Added custom-expression assignment endpoint, success criteria for expression management, and user story for custom conversion workflow.
- **v0.2**: Added Point Source Management section for multi-source CRUD (OPC UA, Modbus, MQTT, CSV, Manual). Expanded Point Configuration with application config columns (active, criticality, area, GPS, barcode, notes, write_frequency_seconds), point lifecycle management (deactivate/reactivate, never-delete policy), and metadata version history viewer. Added source and point lifecycle API endpoints.
- **v0.1**: Added Point Configuration section for managing per-point aggregation type eligibility (averaging, summing, accumulation). Added point management API endpoints. Added bulk update capability.
