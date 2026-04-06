# Design Docs Settings Requirements — Docs 00-19

## Summary of Implied Settings Requirements

### Auth / Users / RBAC
- User CRUD: create, edit, disable, set password, assign roles, add to groups, view sessions, terminate sessions
- Role management: 8 predefined roles (non-deletable, modifiable permissions), clone-to-create custom roles, per-role idle timeout (configurable, overrides system default), per-role max concurrent sessions
- Group management: create groups, assign one or more roles to a group, add/remove users
- Permission matrix: 118 permissions across 15 modules — all gated through the RBAC system
- Per-role idle session timeout: Admin=15min, Supervisor=30min, Operator=60min, Analyst=30min, Content Manager=30min, Maintenance=30min, Viewer=30min, Contractor=15min (all configurable by Admin)
- Concurrent session limit per role (default 3, 0 = unlimited)
- Visual lock overlay: hidden until interaction, 60-second password timeout before dismissal, configurable per-role
- Kiosk mode: dedicated kiosk accounts, non-expiring refresh tokens, optional IP restriction, remote admin termination, authenticated interactive overlay duration (default 15 minutes, per-role)
- Break-glass emergency accounts: enable/disable toggle, password reset, session duration (default 4 hours, configurable), admin notification channels on activation
- Session viewer and force-terminate capability (Admin)
- Account lockout policy: max failures and lockout duration
- Contractor account mandatory expiry date field

### Authentication Providers / SSO
- OIDC provider: issuer URL, client ID/secret, scopes, claims mapping, JIT provisioning toggle, default role, group-to-role mappings
- SAML provider: IdP metadata upload (URL or paste), SSO URL, certificate, SP metadata download, JIT provisioning
- LDAP/AD provider: server URL, TLS mode, bind DN/password, search bases, user/group filters, attribute mapping, test connection
- Default auth provider selection (which shows on login page)
- "Allow local auth alongside SSO" toggle (disabling shows a warning)
- JIT provisioning defaults: default role for JIT-created users, auto-enable toggle
- IdP role mappings: exact/prefix/regex match type, match value, mapped I/O role, site scope, priority, enabled/disabled toggle
- 7 deterministic conflict resolution rules govern IdP sync behavior (documented, not configurable)
- SCIM 2.0: enable/disable SCIM provisioning, generate/revoke bearer tokens, endpoint URL display, provisioning log

### Local Auth / Password Policy
- Enable/disable local authentication entirely
- Password policy: minimum length (default 8), complexity requirements (uppercase, lowercase, number, optional special character), password history depth
- Account lockout: max failures, lockout duration
- Session settings: access token lifetime (default 15min), refresh token lifetime (default 7 days)
- Password reset flow: time-limited token expiry (default 1 hour, single-use)

### MFA
- Enable/disable each MFA method globally: TOTP, Duo, SMS, Email
- Duo configuration fields: API hostname, client ID, client secret
- Per-role MFA policy: MFA required toggle, allowed methods, required method (or any), grace period (hours), max failures, lockout duration
- Recovery code count (default 8), regeneration rules
- User MFA status table: view enrollment, reset MFA, exempt with expiry, force MFA

### API Keys
- Create, rotate, revoke service account API keys
- Key metadata: name, scope selection, optional expiry date
- Key prefix shown for identification (`io_sk_a3b` style); full key shown once on creation

### EULA
- Version management: draft/active/archived lifecycle
- Split-pane markdown editor for draft versions
- Publish with re-acceptance warning
- Acceptance records: audit table, CSV export, pending users list

### OPC / Data Sources
- OPC UA source configuration per source: endpoint URL (including non-standard ports), security policy and mode (driven by live GetEndpoints discovery, not hardcoded), vendor profile dropdown (pre-populates rate-limit parameters), client certificate selection from centralized certificate store, optional authentication credentials
- Connection test button per source
- Enable/disable individual sources
- Source health monitoring: connection status, `last_connected_at`, last error messages
- Global minimum publish interval: `opc.minimum_publish_interval_ms` (default 1000ms, minimum allowed 100ms) — prevents any source from being configured faster than this floor
- Data category assignment per source (selects from 9 predefined + custom categories)
- Supplemental connector linkage (`is_supplemental_connector`, `point_source_id`) for DCS hybrid data architecture
- Point staleness threshold (default 60 seconds for point-level, configurable)
- Source-level connectivity alerting (alert on repeated failures after N attempts, configurable)
- IPC path selection: `IO_OPC_BROKER_IPC=unix|notify` (environment variable, restart-required)

### Point Configuration
- Per-point aggregation types bitmask: Allow Averaging, Allow Sum/Totaling, Allow Accumulation, Custom Aggregation
- Bulk configuration: select multiple points, apply same aggregation types
- Per-point application config: `active` toggle, `criticality` dropdown (safety_critical/environmental/production/informational), `area` text, `default_graphic_id` picker, `gps_latitude/longitude`, `barcode`, `notes`, `write_frequency_seconds`
- Deactivate/reactivate points (never-delete policy, timestamp tracking)
- Custom conversion expression assignment via Expression Builder modal
- Point metadata version history viewer (read-only forensic timeline)

### Data Categories
- 9 predefined categories: Process, Event, Access Control, Personnel, Financial, Maintenance, Ticketing, Environmental, General
- Admin CRUD for custom categories beyond the 9 predefined
- Category assignment at connection configuration time; points inherit category from source

### Data Retention / Archive
- Raw data retention period (default 90 days, configurable)
- Aggregate retention tiers (1m: 1yr, 5m: 2yr, 15m: 3yr, 1h: 5yr, 1d: 7yr) — implies these should be configurable
- Compression threshold: chunks older than 7 days compressed (configurable)

### Import Management
- Import Connections: create/edit/test/delete connections to external databases, files, APIs, messaging, industrial protocols
- Import Definitions: 7-step wizard (connection → source → mapping → transforms → validation → options → review) or template-based one-click
- Connector Templates: 40 pre-built templates for known applications (SAP, ServiceNow, Maximo, etc.)
- Import Schedules: cron, interval, manual, file-arrival, webhook, dependency chain
- Import History: run history, error details, data quality metrics
- Error review with per-row drill-down
- Dry-run capability before committing data
- Data Links: source column → target column linking rules, transform pipelines, bidirectional toggle
- Point Column Designator per import definition
- Error strategy per definition: stop/skip/quarantine/threshold

### Point Detail Configuration
- Section configuration: which data sections appear in the Point Detail panel and their order
- Per-section settings: source dataset, display columns, sort order, row limit, enabled/disabled
- Equipment class overrides for different Point Detail layouts per equipment class
- Site overrides for multi-site deployments

### Bulk Update
- 4-step wizard: Upload → Validate & Map → Diff Preview → Results
- Supports bulk editing of: points, users, role assignments, settings, point sources, round templates, log templates, dashboard metadata, import definitions
- Concurrency detection (flags rows modified since template export)
- Automatic snapshot before every Apply operation

### Change Snapshots
- Manual snapshot creation
- Automatic snapshots (pre-bulk-update)
- Selective record restore with diff preview
- Supported tables: points_metadata, users, user_roles, settings, dashboards, workspaces, design_objects, custom_expressions, import_connections, import_definitions
- Indefinite retention with deletion warning if linked to audit events

### Alerts
- Alert channels: enable/disable per channel type, per-channel configuration forms, test button
- Channel types: WebSocket (always-on, not disableable), Email, SMS (Twilio), Voice (Twilio), Radio Dispatch, PA System, Browser Push
- Alert templates: name, severity, title template, message template, channel selection, escalation policy builder, roster selection, preview
- Escalation policies: delay intervals, escalation roster chain
- Recipient rosters: name, source type (manual/role group/all users), per-member channel contact info
- Alert history view: paginated, filterable by severity/status/date range/channel/source
- Web Push (VAPID): public/private key generation, VAPID configuration

### Email
- Email provider CRUD: SMTP, SMTP+XOAUTH2, Microsoft Graph, Gmail, Webhook, Amazon SES
- Default provider selection, fallback provider selection
- Enable/disable individual providers
- Test connection button per provider
- System email templates: editable (not deletable), preview button
- Custom email templates: full CRUD
- Email delivery log: filterable by status/provider/date range/context type
- Queue status summary: pending, retry, dead letter counts

### Certificates
- Server certificate management (TLS for nginx)
- Client certificate management (for OPC UA mutual TLS)
- Trusted CA store (CA certificates the system trusts)
- ACME/Let's Encrypt issuance: HTTP-01 challenge (requires port 80 from internet) or DNS-01 challenge (automatic via DNS provider API credentials, or manual TXT record)
- Auto-renewal: checks twice daily, renews 30 days before expiry
- CSR generation: hostname/SAN, organization, key type (RSA 4096/2048/ECDSA P-256/P-384)
- Certificate import: PEM or PFX files (PFX password for extraction)
- HSTS toggle (off by default, warning text, `max-age=63072000; includeSubDomains`)
- Certificate status indicators: valid (>15 days), expiring (<15 days), expired
- Self-signed certificate generated on first install, prominent banner prompting replacement

### Recognition (P&ID + DCS Symbol Recognition)
- Model management per domain (P&ID, DCS): view loaded models, import `.iomodel` packages with hot-swap
- Model history with rollback capability
- Feedback configuration: enable/disable correction feedback collection, include anonymized symbol crops toggle
- Feedback export: generate `.iofeedback` package
- Variation gap reports: import `.iogap` packages, view coverage statistics, variation browser
- Admin-only section

### Sites (Multi-Site)
- Site CRUD: name, code, description, timezone, active/inactive
- User-site assignment (users can belong to multiple sites)
- Default site designation per user

### Backup & Restore
- Backup schedule: daily, weekly, or custom cron expression
- Backup retention: keep last N backups, age-based expiration (e.g., dailies 7 days, weeklies 4 weeks)
- Storage targets: local filesystem path, NFS mount, S3-compatible object storage
- Email notification on backup success or failure
- On-demand backup trigger with progress indicator
- Backup encryption: customer passphrase, customer recovery key (shown once at setup), vendor RSA recovery
- Restore: upload `.iobackup`, integrity verification, passphrase decryption, version compatibility check, preview, re-authenticate, restore

### System Monitoring
- Service health dashboard: all 11 services with status from `/healthz`, auto-refresh every 30 seconds
- System log viewer: reads from `system_logs` table, filterable by service/level/time/keyword
- Resource overview: CPU/memory/disk from Prometheus, per-service breakdown, historical graphs (1h/24h/7d)
- Threshold alerts inline: disk > 90%, memory > 85%
- Database status: connection pool utilization, active queries, replication lag, table sizes
- OPC connection status: per-source state, last communication, subscription count, data rate
- Active sessions list: username, IP, session start, last activity, device
- Recent admin actions: last 50 audit log entries filtered to admin operations
- Broker metrics: per-client subscription counts, throttle states, aggregate fanout rate (soft threshold for per-client subscription count warning, configurable by admin)

### Display / Appearance
- Theme preset: Light, Dark, HPHMI
- Accent color: 4 alarm-safe presets (Midnight Teal, Signal Green, Neon Mint, Hot Signal/Magenta)
- Border radius: Sharp (2px), Subtle (6px), Rounded (12px)
- Density mode: Compact, Default, Comfortable
- Font scale: Small (13px), Default (14px), Large (16px)
- Global UI scale: 80% / 90% / 100% / 110% / 120%
- Graphics pipe color: By Service / Monochrome toggle
- Undo/redo history depth (default 50, configurable)
- Watermark "UNCONTROLLED COPY" toggle for printable views (default on, configurable)
- These are stored per-user in `user_preferences` JSONB

### Data Export
- Export buttons on all Settings data tables: users, points, sources, events, audit log, expressions, import connections, import definitions, application settings
- Format selection per entity (CSV, XLSX, JSON, PDF, Parquet, HTML)
- Forbidden fields never exported (password_hash, refresh_token, connection secrets)

### Event Historian (Event Service)
- MSSQL connection string configuration
- Database and table names
- Query interval (e.g., every 5 seconds)
- Batch size
- Retention policy

### Configuration Reload Behavior (UI Requirement)
- Restart-required settings show warning icon in UI: database connection strings, listen ports, TLS certificate paths, IPC socket paths, `IO_SERVICE_SECRET`, Twilio credentials, SMTP credentials, OIDC/SAML config, YARA-X rule paths, `RUST_LOG`
- Hot-reload settings take effect immediately: alert thresholds, OPC intervals, email templates, RBAC changes, retention policies, display settings, point config, expressions, export formats, import definitions and schedules

---

## Per-Document Findings

### Doc 00: PROJECT_OVERVIEW

**Implied settings requirements:**
- OPC UA server configuration (endpoint URLs, security profiles) — referenced as a System Administrator responsibility
- User/role/group management as a dedicated Settings module
- Certificate authority configuration for SSL certificates
- Mobile device configuration for field personnel (touch targets, offline capability)
- Data retention: 7-year retention requirement for time-series data (configurable period)
- RBAC permissions model with 8 predefined roles
- Multi-channel emergency alerts: configurable escalation policies, Twilio API (SMS/voice), SMTP servers, radio dispatch, PA system REST API
- Email service: multiple simultaneous providers (SMTP, SMTP+XOAUTH2, Microsoft Graph API, Gmail API, Webhook, Amazon SES)

### Doc 01: TECHNOLOGY_STACK

**Implied settings requirements:**
- OPC UA `opcua` crate: connection profiles, session parameters, per-vendor rate limits (all exposed through Point Source configuration)
- Argon2 password hashing: cost parameters (memory, iterations) configurable
- JWT: access token lifetime (15min), refresh token lifetime (7 days) — configurable in Auth settings
- Rhai expression evaluation: execution time limits, recursion depth limits, operation count caps — server-side limits
- YARA-X rule paths: configurable in environment (restart-required setting)
- Backup encryption (`aes-gcm`, `rsa`): Argon2id cost parameters for DEK key derivation (memory: 64MB, iterations: 3, parallelism: 4 — referenced in backup spec)
- Certificate management: `rcgen` for self-signed/CSR generation, `x509-parser` for import validation — surfaces in Settings > Certificates
- Tesseract OCR: system dependency, not configurable in UI
- `opentelemetry`: optional, enabled via environment config for distributed tracing (restart-required)
- ACME (`instant-acme`): challenge type selection (HTTP-01 vs DNS-01), DNS API credentials for automatic DNS-01, hostname/email configuration
- Web Push VAPID: public/private key pair configuration for browser push notifications

### Doc 02: SYSTEM_ARCHITECTURE

**Implied settings requirements from service configurations:**

**API Gateway:**
- JWT signing key (`IO_JWT_SECRET`) — environment, restart-required
- Database connection string (`IO_DATABASE_URL`) — environment, restart-required
- Inter-service secret (`IO_SERVICE_SECRET`) — environment, restart-required
- Rate limiting parameters: login attempts (5/min/IP), register (3/hr/IP), general (1000/req/min/user)
- CORS: production origin whitelist
- Request size limits (configured in nginx)

**Data Broker:**
- IPC path selection: `IO_OPC_BROKER_IPC=unix|notify` — configurable via environment (restart-required)
- Staleness threshold: default 60 seconds per point (configurable)
- Staleness check interval: default every 10 seconds (configurable)
- Max-silence heartbeat: default 60 seconds (configurable)
- Batch delivery window: default 250ms (configurable via adaptive throttling)
- Server-wide aggregate throttle threshold: >30% of clients being throttled triggers server-wide measures
- Per-client subscription soft threshold: admin-tunable warning level
- Deadband: configurable per-point (admin sets in point configuration)

**OPC Service:**
- All OPC UA connection parameters per source (stored in `point_sources.connection_config` JSONB)
- Global minimum publish interval (from doc 15)
- Polling interval for low-priority points (default 5-minute interval)
- Subscription batch size (default 500 items per subscription)
- Reconnection backoff parameters (2s → 4s → 8s → 16s → 30s max)
- Monitored item queue size (default 50)
- Keep-alive interval (default 10 seconds)

**Event Service:**
- MSSQL connection string, database/table names, query interval, batch size, retention policy

**Archive Service:**
- Compression threshold: chunks older than N days (default 7 days)
- Raw data retention period (default 90 days)
- Aggregate retention tiers (1m: 1yr, 5m: 2yr, 15m: 3yr, 1h: 5yr, 1d: 7yr)
- Continuous aggregate refresh policies (intervals per tier)

**Import Service:**
- Connection credentials, field mappings, transforms, validation rules, schedule definitions (all in database)
- Process priority configuration (`nice` level for OS scheduling) — server config

**Alert Service:**
- Twilio account SID, auth token (restart-required)
- Radio dispatch REST API URL and credentials (restart-required)
- PA system REST API URL and credentials (restart-required)
- Channel-level enable/disable, per-channel config (hot-reload)
- Escalation policies and timer-based escalation rules

**Email Service:**
- Provider configurations (SMTP credentials — restart-required), others hot-reload
- Max retry attempts (default 4 per email)
- Queue worker concurrency

**Auth Service:**
- All auth provider configurations (OIDC/SAML/LDAP — restart-required)
- SCIM tokens, API keys (database-backed, hot-reload)
- WebSocket ticket TTL (default 30 seconds)
- MFA policies per role

**Recognition Service:**
- `.iomodel` package management (hot-swap on import)
- GPU/CPU execution provider selection (implied from ONNX Runtime configuration)
- Feedback collection toggle

### Doc 03: SECURITY_RBAC

**All RBAC permissions that gate Settings pages:**

| Permission | Gates |
|---|---|
| `settings:read` | View Settings module |
| `settings:write` | Modify application settings |
| `settings:export` | Export settings data tables |
| `settings:admin` | Full settings administration |
| `system:manage_users` | Settings > Users tab |
| `system:manage_groups` | Settings > Groups tab |
| `system:manage_roles` | Settings > Roles tab |
| `system:view_logs` | Settings > System Monitoring > Logs |
| `system:system_settings` | Settings > General / Application Settings |
| `system:opc_config` | Settings > Point Sources (OPC UA config) |
| `system:source_config` | Settings > Point Sources (CRUD, enable/disable) |
| `system:event_config` | Settings > Event Historian Settings |
| `system:point_config` | Settings > Points tab (application config columns) |
| `system:point_deactivate` | Settings > Points (deactivate/reactivate lifecycle) |
| `system:expression_manage` | Share expressions, manage other users' expressions |
| `system:import_connections` | Settings > Imports > Connections tab |
| `system:import_definitions` | Settings > Imports > Definitions tab |
| `system:import_execute` | Settings > Imports > trigger runs, dry runs |
| `system:import_history` | Settings > Imports > History tab |
| `system:bulk_update` | Settings > Bulk Update wizard |
| `system:change_backup` | Settings > Change Snapshots (create/view) |
| `system:change_restore` | Settings > Change Snapshots (restore) |
| `system:data_link_config` | Settings > Imports > Data Links tab |
| `system:point_detail_config` | Settings > Imports > Point Detail tab |
| `system:monitor` | Settings > System Monitoring dashboard |
| `system:sessions` | Settings > Sessions (view/terminate active sessions) |
| `system:backup` | Settings > Backup & Restore (initiate/schedule backups) |
| `system:restore` | Settings > Backup & Restore (restore, requires re-auth) |
| `system:export_data` | Export entire database |
| `system:import_data` | Import system data (backup/restore operations) |
| `system:admin` | Full system administration |
| `auth:configure` | Settings > Authentication > Providers, SSO Settings, SCIM |
| `auth:manage_mfa` | Settings > Authentication > MFA tab |
| `auth:manage_api_keys` | Settings > Authentication > API Keys tab |
| `email:configure` | Settings > Email > Providers tab |
| `email:manage_templates` | Settings > Email > Templates tab |
| `email:send_test` | Test email delivery per provider |
| `email:view_logs` | Settings > Email > Logs tab |
| `alerts:configure` | Settings > Alerts > Channels tab |
| `alerts:manage_templates` | Settings > Alerts > Templates tab |
| `alerts:manage_groups` | Settings > Alerts > Rosters tab |
| `alerts:read` | Settings > Alerts > History tab (read-only) |
| `badge_config:manage` | Settings > Badge Sources (badge system adapter configuration) |
| `muster:manage` | Configure muster points |

**Per-role idle timeout configuration:**
Each role has `idle_timeout_minutes` and `max_concurrent_sessions` columns on the `roles` table — both editable per role via Settings > Roles.

**Break-glass accounts:**
- Two pre-created emergency accounts (`is_emergency_account = true`, `enabled = false` by default)
- Session maximum duration configurable (default 4 hours)
- Notification channels for emergency account activation (all configured alert channels, email/SMS to all admins)
- `io-ctl emergency` CLI as alternative activation method

**Visual Lock:**
- Per-role idle timeout (editable via Settings > Roles)
- 60-second lock-overlay password timeout (global, configurable)
- Kiosk authenticated overlay duration (per-role, default 15 minutes)

**Kiosk Mode:**
- `session_type = 'kiosk'` tracked in `user_sessions`
- Optional IP restriction per kiosk session (configurable)
- Non-expiring refresh token (implemented as no-TTL, not a settings toggle — inherent to kiosk account setup)

**Multi-Site:**
- Sites CRUD: name, code, description, timezone, active/inactive
- User-site assignments
- Site-scoped role assignments via `user_roles.site_id`

**Data Categories:**
- Category CRUD: 9 predefined + admin-created custom categories
- Category assigned at connection configuration time
- Controls which users (by role/permission) can see data from a connection

### Doc 04: DATABASE_DESIGN

**Config/settings tables in the schema (each requires Settings UI):**

| Table | Settings UI Location | What Admin Configures |
|---|---|---|
| `settings` | Settings > General (key-value store) | All application key-value configuration |
| `roles` | Settings > Roles | Role name, description, idle_timeout_minutes, max_concurrent_sessions, permissions |
| `permissions` | Settings > Roles (read-only reference) | System-seeded, read-only |
| `role_permissions` | Settings > Roles > Permission matrix | Per-role permission assignments via checkbox matrix |
| `user_roles` | Settings > Users > role assignment | User-to-role assignments (direct and site-scoped) |
| `group_roles` | Settings > Groups > role assignment | Group-to-role assignments |
| `point_sources` | Settings > Point Sources | OPC/data connection config per source |
| `data_categories` | Settings > Data Categories | 9 predefined + custom category CRUD |
| `auth_provider_configs` | Settings > Authentication > Providers | OIDC/SAML/LDAP provider config |
| `idp_role_mappings` | Settings > Authentication > Providers > IdP mapping | IdP group → I/O role mapping rules |
| `mfa_policies` | Settings > Authentication > MFA | Per-role MFA requirements and allowed methods |
| `email_providers` | Settings > Email > Providers | Email provider CRUD |
| `email_templates` | Settings > Email > Templates | Email template CRUD |
| `alert_templates` | Settings > Alerts > Templates | Alert template CRUD |
| `alert_rosters` | Settings > Alerts > Rosters | Recipient roster CRUD |
| `alert_channels` | Settings > Alerts > Channels | Channel enable/disable and config |
| `import_connections` | Settings > Imports > Connections | External system connection credentials and config |
| `import_definitions` | Settings > Imports > Definitions | Import job field mappings, transforms, validation |
| `import_schedules` | Settings > Imports > Schedules | Cron/interval/manual/file-arrival/webhook schedules |
| `connector_templates` | Settings > Imports > Templates | 40 pre-built templates (seed data, read-only) |
| `data_links` | Settings > Imports > Data Links | Cross-dataset linking rules |
| `point_detail_config` | Settings > Imports > Point Detail | Point Detail panel section configuration |
| `certificates` | Settings > Certificates | TLS cert store: server/client/CA management |
| `sites` | Settings > Sites | Multi-site CRUD |
| `eula_versions` | Settings > EULA | EULA version draft/publish lifecycle |
| `users` | Settings > Users | User CRUD: profile, auth method, emergency flag |
| `api_keys` | Settings > Authentication > API Keys | Service account API key management |
| `scim_tokens` | Settings > Authentication > SCIM | SCIM bearer token management |
| `points_metadata` (app config columns) | Settings > Points | active, criticality, area, GPS, barcode, notes, write_frequency_seconds, custom_expression_id |
| `alarm_definitions` | Events module (not Settings directly) | Threshold wizard and expression-based alarm definitions |
| `push_subscriptions` | VAPID config in alert channel settings | Browser push endpoint management |

**Notable: The `settings` table (key-value JSONB) is the catch-all for:**
- `opc.minimum_publish_interval_ms` (default 1000ms)
- `site.id` (used in OPC Service ApplicationUri)
- All application-wide configurable behavior not in dedicated tables

### Doc 05: DEVELOPMENT_PHASES

**Settings incremental build plan (which phase delivers which Settings pages):**

| Phase | Settings Tab(s) Delivered |
|---|---|
| Phase 2 | Users tab, Role Management tab (clone-based custom roles) |
| Phase 3 | OPC Configuration tab (connection wizard, browse/subscribe, metadata explorer), Point Source Management tab |
| Phase 4 | System Health page, Appearance tab (theme/density/scale), Certificate Management tab, Backup/Restore tab, About page |
| Phase 6 | Designer-related settings (graphics preferences) |
| Phase 8 | Expression Builder expression sharing permissions |
| Phase 9 | Report schedule management settings |
| Phase 10 | Dashboard-related settings |
| Phase 11 | Forensics admin |
| Phase 12 | Log template and schedule management, Rounds template and schedule management |
| Phase 13 | Alert Configuration, Email Configuration, Shifts/Badge Configuration |
| Phase 14 | Import Management, Data Links, Point Detail Configuration |
| Phase 15 | Recognition model management, feedback configuration, variation gap reports |
| Phase 16 | Authentication providers, MFA policies, API keys, SCIM, EULA management |

**Key finding:** Settings is explicitly described as "not a single phase" — each phase that introduces configurable features builds the corresponding Settings tabs/pages.

### Doc 06: FRONTEND_SHELL

**Implied settings requirements:**

**Appearance / Display Settings (stored in `user_preferences` JSONB):**
- Theme preset: Light / Dark / HPHMI
- Accent color: 4 alarm-safe presets only (Midnight Teal, Signal Green, Neon Mint, Hot Signal/Magenta)
- Border radius: Sharp (2px), Subtle (6px), Rounded (12px)
- Density mode: Compact (28px rows), Default (36px), Comfortable (44px)
- Font scale: Small (13px body), Default (14px), Large (16px body)
- Global UI scale: 80% / 90% / 100% / 110% / 120%
- Sidebar state persistence: `user_preferences.sidebar_state`
- Top bar visibility persistence: `user_preferences.topbar_visible`

**These are user-level preferences, not admin-level system settings, but they live in Settings > Appearance.**

**ISA-101 alarm colors are NOT configurable** — they are fixed, safety-critical, and non-negotiable.

**Kiosk mode setup requirements (Admin-level):**
- Creating dedicated kiosk accounts with restricted permissions
- Enabling kiosk URL parameter support (`?mode=kiosk&display=<id>`)
- Configuring optional IP restriction per kiosk session
- Configuring kiosk authenticated interactive layer timeout per role
- Admin visibility of all active kiosk sessions in Settings > Sessions

**Visual lock:**
- Per-role idle timeout is the primary configurable value (via Settings > Roles)
- 60-second password overlay timeout before auto-dismiss (hardcoded in spec, but described as a parameter in other places)

### Doc 07: CONSOLE_MODULE

**Implied settings requirements:**
- Undo/redo history depth: default 50 changes, configurable in user settings
- Watermark "UNCONTROLLED COPY" toggle: default on, configurable in Settings
- Point stale threshold: 60 seconds (source: doc 16, configurable)

**No dedicated Settings tab for Console** — workspace configuration is inline in the Console module itself. Point source settings belong in Settings > Point Sources.

### Doc 08: PROCESS_MODULE

**Implied settings requirements:**
- LOD (Level of Detail) transition thresholds: configurable per graphic in Designer property panel
- These are graphic-level properties, not system-level settings

**No dedicated Settings tab for Process.**

### Doc 09: DESIGNER_MODULE

**No dedicated Settings tab** — Designer has its own module UI. Settings-relevant aspects:
- Designer permissions gated by `designer:*` permissions (configured via Settings > Roles)
- DCS graphics import uses Parser Service and Recognition Service — admin configures recognition model via Settings > Recognition

### Doc 10: DASHBOARDS_MODULE

**Implied settings requirements:**
- Dashboard template variable defaults (user-configurable per dashboard, not system settings)
- Dashboard playlist dwell time: configurable per dashboard in playlist (default 30 seconds)
- Widget configuration respects `aggregation_types` bitmask from Settings > Points
- Dashboard sharing: Settings > Groups controls which groups can access published dashboards

**No dedicated Settings tab** — dashboard settings are inline in the Dashboards module.

### Doc 11: REPORTS_MODULE

**Implied settings requirements:**
- Report schedules: create/edit/delete scheduled report runs, configure recipients and format (`reports:schedule_manage` permission)
- Email delivery of reports: uses Email Service providers configured in Settings > Email
- Custom SQL queries: admin-only (`reports:admin` permission — requires `system:admin`)
- Standing/stale alarms threshold: default 24h (configurable in report configuration, not system settings)

**No dedicated Settings tab** — schedules use Email Service configuration from Settings > Email.

### Doc 12: FORENSICS_MODULE

**No dedicated Settings tab** — Forensics is self-configuring per investigation.

Admin override via `forensics:admin`: view all investigations (RBAC-gated, configured via Settings > Roles).

### Doc 13: LOG_MODULE

**Implied settings requirements:**
- Log templates: create/edit/delete via `log:template_manage` permission
- Log schedules: per-shift, daily, interval, weekly, custom cron (`log:schedule_manage` permission)
- Email notifications for assignments: configured via Email Service in Settings > Email

**No dedicated Settings tab** — log template and schedule management is inline in the Log module.

### Doc 14: ROUNDS_MODULE

**Implied settings requirements:**
- Round templates: checkpoint definitions, validation rules, media requirements — `rounds:template_manage` permission
- Round schedules: `rounds:schedule_manage` permission
- Escalation thresholds and recipients per round template
- Overdue round alerts: trigger via Alert System with configurable escalation chain

**No dedicated Settings tab** — rounds template/schedule management is inline in the Rounds module.

### Doc 15: SETTINGS_MODULE

**This is the primary settings specification. Full exhaustive listing:**

**1. User Management tab:**
- User CRUD: username, email, full_name, enabled toggle, auth_provider, roles assignment, group membership
- View user sessions, terminate sessions
- Mandatory expiry date for Contractor accounts
- Emergency account enable/disable controls

**2. Role & Permission Management tab:**
- 8 predefined roles displayed (non-deletable, modifiable permissions)
- Clone button to create custom roles
- Permission matrix (checkbox grid: roles × permissions)
- Per-role idle timeout (editable per role)
- Per-role max concurrent sessions (0 = unlimited)
- Group management: create groups, assign roles to group, add/remove members
- "Effective Permissions" view per user (shows source: direct role vs group-inherited)

**3. Application Settings tab (key-value):**
- Settings organized by category (general, opc, events, etc.)
- Setting validation (type checking, range validation)
- Hot-reload vs restart-required indicator per setting
- No restart required for most DB-backed settings

**4. Point Source Management tab:**
- Source types: OPC UA, Modbus, MQTT, CSV, Manual Entry
- Cannot remove a source if points reference it (deactivate instead)
- Enable/disable individual sources
- OPC UA form: endpoint URL, vendor profile dropdown, GetEndpoints-driven security selection, client certificate dropdown, optional auth credentials
- Data category assignment per source
- Global minimum publish interval guard rail
- Connection test button + live status indicator

**5. Point Configuration tab:**
- Per-point aggregation types bitmask
- Bulk configuration across multiple selected points
- Application config columns: active, criticality, area, default_graphic_id, GPS, barcode, notes, write_frequency_seconds
- Custom conversion via Expression Builder modal
- Deactivate/reactivate with timestamp tracking
- Point metadata version history (read-only)

**6. Import Management tab:**
- Connector Templates browser (40 pre-built, search, domain filter, dynamic form)
- Import Connections: CRUD, test, enable/disable
- Import Definitions: 7-step wizard or template-based
- Import History: run results, error drill-down
- Dry-run capability
- Data Links sub-tab
- Point Detail sub-tab

**7. Bulk Update:**
- 4-step wizard: Upload → Validate & Map → Diff Preview → Results
- Template download and upload
- Concurrency detection
- Automatic snapshot before Apply

**8. Change Snapshots:**
- Manual snapshot creation
- Automatic snapshots list
- Full rollback and selective record restore
- Restore diff preview
- Deletion confirmation if linked to audit events

**9. Recognition tab:**
- Current models per domain with metadata
- Import `.iomodel` package with validation and hot-swap
- Model history with rollback
- Feedback enable/disable toggles
- Feedback export to `.iofeedback`
- Variation gap reports: import `.iogap`, coverage statistics, variation browser

**10. Alert Configuration tab:**
- Channels tab: per-channel enable/disable, config forms, test button
- Templates tab: severity, title/message templates, channel selection, escalation policy, roster selection, preview
- Rosters tab: name, source type, member editor with per-member contact info
- History tab: paginated, filterable alert history

**11. Authentication tab:**
- Providers tab: provider list, add/edit/delete providers, test connection, group-to-role mapping editor
- MFA tab: global method enable/disable, Duo config, per-role MFA policy table, user MFA status table
- API Keys tab: create/revoke keys, scope selection, expiry
- SSO Settings: default provider, local auth alongside SSO toggle, JIT provisioning defaults
- Local Auth: enable/disable, password policy, lockout policy, session settings
- SCIM: enable/disable, token management, endpoint URL display, provisioning log

**12. EULA Management tab:**
- Versions table: draft/active/archived lifecycle
- Split-pane markdown editor for draft versions
- Publish with re-acceptance warning
- Acceptance Records: searchable audit table, CSV export

**13. Email Configuration tab:**
- Providers tab: SMTP/XOAUTH2/Graph/Gmail/Webhook/SES CRUD, default/fallback selection, test
- Templates tab: system templates (editable/not-deletable), custom templates (full CRUD), preview
- Logs tab: paginated delivery log, queue status summary

**14. Certificate Management tab:**
- List view with status indicators
- Self-signed auto-generated on install (prominent replacement banner)
- ACME: hostname, email, challenge type selection, DNS provider credentials
- CSR generation: hostname, SANs, organization, key type
- Certificate import: PEM or PFX
- HSTS toggle with warning text

**15. System Monitoring:**
- Service health dashboard (11 services, 30s auto-refresh)
- System log viewer (service/level/time/keyword filter)
- Resource overview (CPU/memory/disk, per-service, historical graphs)
- Database status (connection pools, active queries, replication lag, table sizes)
- OPC connection status (per-source)
- Active sessions list with force-terminate
- Recent admin actions (last 50 audit entries)

**16. Backup & Restore:**
- Scheduled backup: cron schedule, retention policy, storage target
- Email notification on success/failure
- On-demand backup trigger with progress
- Backup passphrase configuration
- Restore workflow with integrity verification, preview, re-auth gate

**Configuration Reload Behavior (critical for UI):**
- Restart-required: database URL, listen ports, TLS paths, IPC socket paths, IO_SERVICE_SECRET, Twilio credentials, SMTP credentials, OIDC/SAML config, YARA-X paths, RUST_LOG
- Hot-reload: everything else

### Doc 16: REALTIME_WEBSOCKET

**Implied settings requirements:**
- Point staleness threshold: default 60 seconds (configurable)
- Staleness check sweep interval: default every 10 seconds
- Max-silence heartbeat interval: default 60 seconds (configurable)
- Batch delivery window: default 250ms (scales via adaptive throttling to 500ms → 1s)
- Per-client subscription soft threshold: "admin-tunable, no default enforcement"
- Deadband per point: configurable via Settings > Points
- IPC path: `IO_OPC_BROKER_IPC=unix|notify` — environment variable (restart-required)

### Doc 17: OPC_INTEGRATION

**Implied settings requirements:**
- Per-source OPC UA connection parameters (all in `point_sources.connection_config` JSONB):
  - Endpoint URL (port always visible/editable, default 4840)
  - Security policy and mode (driven by live GetEndpoints, not hardcoded preset)
  - Client certificate (dropdown from centralized cert store)
  - Optional auth credentials (username/password or certificate auth)
  - Vendor profile selection (pre-populates rate-limit parameters only)
  - Per-vendor overridable parameters: max sessions, items per subscription, items per call, publish interval
- Global minimum publish interval floor: `opc.minimum_publish_interval_ms` default 1000ms, minimum 100ms
- OPC UA certificate application URI: depends on `settings.site.id`
- Adaptive throttling thresholds: response latency monitoring
- Reconnection backoff parameters (2s → 4s → 8s → 16s → 30s max)
- Monitored item queue size: default 50 items (configurable per source)
- Keep-alive interval: default 10 seconds (configurable per source)
- Supplemental connector: `is_supplemental_connector` flag, `point_source_id` FK

### Doc 18: TIMESERIES_DATA

**Implied settings requirements:**
- Raw data retention period: default 90 days (configurable)
- Compression threshold: chunks older than 7 days (configurable)
- Aggregate retention tiers:
  - 1-minute: 1 year
  - 5-minute: 2 years
  - 15-minute: 3 years
  - 1-hour: 5 years
  - 1-day: 7 years (regulatory compliance floor)
- Continuous aggregate refresh schedule intervals (configurable per tier)
- Aggregation type per point (`aggregation_types` bitmask) — configured via Settings > Points

**NOTE: Doc 15 does not explicitly enumerate a "Data Retention" settings page — this is an implied gap.**

### Doc 19: GRAPHICS_SYSTEM

**Implied settings requirements:**
- Pipe color mode: "By Service" vs "Monochrome" — stored in `user_preferences`, accessible via Settings > Appearance
- Hybrid SVG/Canvas rendering auto-switch threshold: hardcoded per spec (not configurable)
- LOD transitions: configurable per graphic in Designer (not a system setting)
- ISA-101 alarm colors: NOT configurable per spec
- `default_graphic_id` per point: surfaces in Settings > Points

---

## Settings Sections Not in Doc 15 but Implied by Other Docs (Gaps)

1. **Data Retention / Archive Settings** (docs 02, 18): Raw data retention period, aggregate retention per tier, compression threshold — no explicit Settings tab in doc 15
2. **Event Historian Configuration** (doc 02): MSSQL connection string, database/table names, query interval, batch size — doc 15 mentions `system:event_config` permission but no UI section described
3. **WebSocket Broker Settings** (doc 16): Staleness threshold, heartbeat interval, batch window — appear to be `settings` table entries needing UI exposure
4. **VAPID / Web Push Configuration** (doc 01): VAPID key pair generation for browser push notifications — sub-section of Alert Channels
5. **Data Category Management** (doc 03): Custom categories beyond 9 predefined — doc 15 mentions a "Manage Categories" link but no standalone Settings > Data Categories tab
6. **Sites Management** (doc 03): Site CRUD for multi-site deployments — mentioned in passing but no explicit Settings > Sites section
7. **Deadband per point** (doc 16): Configurable deadband threshold per point — surfaces through Settings > Points
8. **Recognition GPU/CPU selection** (doc 02): ONNX Runtime execution provider selection — implied but not documented as Settings UI control
