# Design Docs Settings Requirements — Docs 20-39

## Summary of Implied Settings Requirements

### Authentication and Session Management
- Auth provider management: Local auth enable/disable + password policy; OIDC provider CRUD (issuer_url, client_id, client_secret, scopes, claims_mapping, JIT provisioning); SAML 2.0 provider CRUD (entity_id, metadata URL/XML, IdP/SP certs, NameID format, claims_mapping, allow_idp_initiated); LDAP/AD configuration (server_url, TLS mode, bind credentials, search_base, user_filter, group mapping, attribute mapping, referral handling, sync interval 30min-24hr); IdP role mapping table (match_type: exact/prefix/regex, priority, site_id scope)
- MFA global toggles per method (TOTP, Duo Security, SMS, Email); per-role MFA policies (required flag, allowed_methods, required_method, grace_period_hours, max_failures, lockout_duration_minutes); Duo config (api_hostname, client_id, client_secret, redirect_uri); user MFA status/reset/exempt management
- Session policy: max_concurrent_sessions (default 3, per-user override), per-role idle_timeout, visual_lock_duration (30min default), hard_session_timeout (8hr default)
- SCIM provisioning: enable/disable toggle, bearer token generation/revocation, endpoint URL display, provisioning log viewer
- Emergency access accounts: 2 pre-created, enable/disable toggle, split-password regeneration, usage audit log
- Account lockout: max_failures, lockout_duration configurable
- EULA management: create/edit/publish drafts, archive versions, view acceptance records, export acceptance audit CSV
- Kiosk account management (is_kiosk flag)
- Active sessions table with force-terminate capability
- JWT token lifetimes (access_token_lifetime_minutes, refresh_token_lifetime_days) — env vars not UI

### Email Service
- Email provider CRUD: type (SMTP/SMTP+XOAUTH2/Microsoft Graph/Gmail API/Webhook/Amazon SES), enabled/disabled, default flag, fallback flag; all type-specific config fields
- Email template management: system templates (non-deletable) and custom templates; subject_template, body_html, body_text, variables_schema; template preview; test send
- Queue settings: retry max_attempts (default 4), exponential backoff schedule, worker_concurrency (default 4), priority levels, cleanup retention days (default 30)
- Suppression list management (add/remove/import addresses)
- Delivery log viewer with filtering

### Alert System (Channel Configuration)
- Per-severity default channel mapping (configurable per deployment)
- Alert channel configuration per type: all channels disabled by default except WebSocket
  - SMS (Twilio): account_sid, auth_token, from_number, message_template, max_length, fallback_config
  - Voice (Twilio): above + twiml_template, voice (default Polly.Matthew), keypress_to_acknowledge, call_timeout
  - Radio (SmartPTT/TRBOnet): dispatch_url, auth_type, auth_value, talkgroup_mapping, message_template, include_alert_tone
  - PA System REST: url, auth_type, auth_value, zone_mapping, audio_clip_mapping, tts_enabled
  - PA System SIP: sip_uri, sip_proxy, tts_voice, audio_format
  - PA System Relay: relay_url, relay_auth, on_command, off_command, activation_duration_sec (default 30)
  - Browser Push: vapid_public_key, vapid_private_key (auto-generated), vapid_subject
- Alert template CRUD (built-in templates non-deletable)
- Recipient roster management (manual/role_group/all_users/on_shift/on_site sources)
- Escalation policy configuration (per-template: levels with delay_seconds, channels, roster_id, condition)
- Test channel connectivity per channel type

### Access Control and Shifts
- Badge source adapter configuration: adapter_type (Lenel OnGuard, CCURE 9000, Genetec, Honeywell Pro-Watch, Gallagher, Generic DB), polling_interval_sec (default 30, range 10-300), enabled flag; all per-adapter config fields
- Muster point configuration: name, reader_ids[], source_id FK, capacity, GPS coordinates, enabled
- Stale presence auto-timeout (default 16h, configurable)
- Shift-end auto-clear inference toggle (default off)
- badge_events retention days (default 90)
- shifts data retention (default 2 years)
- Shift external import: source system type, sync_interval (default 1hr); provider types: SAP HCM, Kronos/UKG
- Default handover_minutes per shift pattern (default 30)
- User employee_id mapping

### Universal Import
- Import connection management: connector_type (60+ types), auth_type (14 types), connection_config JSONB encrypted, test connectivity
- Import definition management: source_config, target_table, target_mode, field_mappings, transform_pipeline, validation_schema, batch_size, error_strategy, error_threshold, watermark settings
- Cron-based scheduling per import definition
- DCS supplemental connectors: linked to OPC sources in Settings > Data Sources
- Permissions: system:import_connections, system:import_definitions, system:import_execute, system:import_history

### Export System
- Export file storage path (default /opt/insideoperations/exports/)
- Worker pool max concurrent exports (default 3)
- Auto-cleanup retention period (default 24h)
- PDF watermark: text (default "UNCONTROLLED COPY"), enable/disable toggle, opacity (default 10%)
- Bulk update wizard (system:bulk_update permission)
- Change snapshot management (system:change_backup, system:change_restore)

### Symbol Recognition (P&ID / DCS)
- Model management per domain (P&ID | DCS tabs): import .iomodel packages, view current model info (version, training date, class count, mAP), view model history, SHA-256 integrity verification
- Feedback configuration: enable/disable collection, enable/disable anonymized crops, export .iofeedback, view stats
- Variation gap reports (.iogap): import, list with coverage summary, drill into per-equipment coverage
- Default confidence threshold (0.5, configurable)
- Hardware: auto-detected (CUDA/CPU), no Settings UI needed

### System / Observability / Health
- System Health page: aggregates /health/ready from all 11 services, shows versions, flags version mismatches
- Active sessions list with force-terminate (system:monitoring permission)
- Metrics configuration: IO_METRICS_INTERVAL (default 15s), IO_METRICS_TIMEOUT (5s) — env vars
- Distributed tracing: IO_TRACING_ENABLED (default false), IO_OTLP_ENDPOINT — env vars
- Raw metrics retention (30 days), 5-min aggregate retention (1 year) — likely env vars

### Graphics and Display
- Shape style global setting: ISA standard vs Graphical/realistic (Settings > Graphics > Shape Style); per-instance override in Designer
- Mobile auto-generated phone layout: top N widgets (default 8, configurable)
- Mobile theme default: Light/High-Contrast as default (not Dark)

### General / Application-Level
- Application settings (GET/PUT /api/settings endpoint): various system-wide settings
- Point metadata configuration: active flag, criticality, area classification, write_frequency_seconds, aggregation_types
- UOM display unit preferences per user
- Expression sharing: requires system:expression_manage permission
- Data link management: system:data_link_config permission
- Point detail configuration: system:point_detail_config permission

---

## Per-Document Findings

### Doc 20: MOBILE_ARCHITECTURE

**Settings excluded from mobile**: The Settings module is never loaded in the mobile bundle. Settings is exclusively a desktop/workstation concern.

**Mobile-specific configurable behaviors**:
- Dashboard dual layout: `layout_desktop` and `layout_phone` are independent. `layout_phone` is a configurable subset.
- Auto-generated phone layout: Top N widgets configurable (default 8).
- Mobile theme: Light and High-Contrast themes available and default on mobile. Dark theme available but not default.
- WebSocket throttle intervals: Hardcoded by client type identification — tablet: 5s, phone: 10s. Not Settings-configurable.

**Tile pyramid configuration** (env vars, not Settings UI):
- `TILE_STORAGE_DIR`, `TILE_MAX_ZOOM=5`, `TILE_SIZE=256`, `TILE_RETENTION_HOURS=168`

**OPC buffer configuration** (env vars):
- `OPC_BUFFER_MEMORY_SECONDS=60`, `OPC_BUFFER_DISK_PATH`, `OPC_BUFFER_DISK_MAX_MB=1024`

---

### Doc 21: API_DESIGN

**Application settings endpoint**: `GET /api/settings` and `PUT /api/settings` — a generic application-level settings blob. Implies a catch-all settings store.

**User/group/role CRUD** (Settings module):
- `GET/POST /api/users`, `GET/PUT/DELETE /api/users/{id}`
- `GET/POST /api/groups`, `GET/PUT/DELETE /api/groups/{id}`
- `GET/POST /api/roles`, `GET/PUT/DELETE /api/roles/{id}`

**System monitoring endpoints** (gated by `system:monitoring`):
- `GET /api/system/health` — aggregate health
- `GET /api/system/sessions` — active sessions list
- `DELETE /api/system/sessions/{id}` — force-terminate session

**Backup & restore**:
- `GET /api/backups`, `POST /api/backups` — list/create
- `GET /api/backups/schedule`, `PUT /api/backups/schedule` — schedule management
- `POST /api/backups/{id}/restore` — restore

**Point metadata configurable fields**:
- `active` (bool), `criticality` (enum), `area` (string), `write_frequency_seconds` (int), `aggregation_types` (int bitmask)

**Per-user UOM preferences**: Users can set preferred display units per UOM category. Stored per-user via `PUT /api/users/{id}/preferences`.

**Permission-gated Settings endpoints**:
- `system:expression_manage` — manage shared expressions
- `system:data_link_config` — manage data link sources
- `system:point_detail_config` — configure point detail page layout
- `badge_config:manage` — badge source configuration
- `alerts:configure` — alert channel configuration
- `system:import_*` — Universal Import settings
- `recognition:manage` — recognition model management

---

### Doc 22: DEPLOYMENT_GUIDE

**Settings vs env var distinction**: Doc 22 clarifies which behaviors are controlled by deployment-time env vars (not Settings UI):

**OPC Service env vars**: `OPC_BUFFER_MEMORY_SECONDS=60`, `OPC_BUFFER_DISK_PATH`, `OPC_BUFFER_DISK_MAX_MB=1024`

**Alert Service env vars**: `ALERT_HEARTBEAT_URL`, `ALERT_HEARTBEAT_INTERVAL_SEC=60`

**Parser Service env vars**: `TILE_STORAGE_DIR`, `TILE_MAX_ZOOM=5`, `TILE_SIZE=256`, `TILE_RETENTION_HOURS=168`, `YARA_RULES_PATH`

**Observability env vars**: `IO_METRICS_INTERVAL=15s`, `IO_METRICS_TIMEOUT=5s`, `IO_METRICS_BATCH_SIZE=1000`, `IO_METRICS_COLLECTOR_ENABLED=true`, `IO_TRACING_ENABLED=false`, `IO_OTLP_ENDPOINT`, `IO_LOG_LEVEL`

**Settings UI implications**: System Health page in Settings shows all 11 service versions. Version mismatch is flagged as a warning. All 11 services expose `/health/ready` — aggregated in Settings > System > Health.

---

### Doc 23: EXPRESSION_BUILDER

**Settings involvement**: Expression Builder modal is invoked from Settings when configuring point properties.

**Entry points within Settings**:
- Settings > Points > [point detail] > Expression tab
- Settings > Expressions — dedicated expression management page (system:expression_manage permission)

**Expression sharing**: Expressions shared across the system require `system:expression_manage` permission. The shared expression library is managed in Settings > Expressions.

**No additional configurable behaviors**: Rhai evaluation engine sandbox constraints are fixed in code.

---

### Doc 24: UNIVERSAL_IMPORT

**Settings location**: Settings > Data Sources (import connections and DCS supplemental connectors).

**Import connection management** (`import_connections` table):
- `connector_type`: 60+ types across 8 categories (OPC-UA, Database, REST API, File, Message Queue, DCS Native, Cloud Platform, Time-Series Database)
- `auth_type`: 14 types (none, basic, bearer, api_key, oauth2_client_credentials, oauth2_authorization_code, aws_sigv4, certificate, kerberos, ntlm, ldap, custom_header, digest, ssh_key)
- `connection_config`: JSONB encrypted at rest
- Connection testing available from UI

**Import definition management** (`import_definitions` table):
- `source_config`, `target_table`, `target_mode`, `field_mappings`, `transform_pipeline`, `validation_schema`
- `batch_size`, `error_strategy` (stop/skip/quarantine), `error_threshold`
- Watermark settings for incremental import

**DCS supplemental connectors**: Special case — linked to existing OPC sources. Not managed through the Import wizard; configured in Settings > Data Sources.

**Permissions**: `system:import_connections`, `system:import_definitions`, `system:import_execute`, `system:import_history`

---

### Doc 25: EXPORT_SYSTEM

**Configurable behaviors in Settings > General**:
- Export file storage path (default: `/opt/insideoperations/exports/`)
- Worker pool max concurrent exports (default: 3)
- Auto-cleanup retention period (default: 24h)
- PDF watermark text (default: "UNCONTROLLED COPY")
- PDF watermark enabled/disabled toggle
- PDF watermark opacity (default: 10%)

**Change snapshot management** (Settings > Backup or Settings > System):
- Accessed via `system:change_backup` and `system:change_restore` permissions
- Bulk update wizard accessed via `system:bulk_update` permission

---

### Doc 26: PID_RECOGNITION

**Settings location**: Settings > Recognition

**Domain tabs**: P&ID | DCS — independent configuration per domain.

**Model management per domain**:
- Current model info: version, training date, class count, mAP score, model_domain
- Import new model: upload `.iomodel` package, SHA-256 integrity verification
- Model history table with rollback capability

**Feedback configuration**:
- Enable/disable feedback collection toggle
- Enable/disable anonymized crop export toggle
- Export `.iofeedback` package
- Stats display: total inferences, correction rate, top confused classes

**Variation gap reports** (`.iogap` files):
- Import `.iogap` from SymBA
- List gap reports with coverage summary
- Drill into per-equipment-type coverage detail

**Confidence threshold**: Default 0.5. System-wide default configurable; implied in Settings but not definitively stated.

**Hardware detection**: Auto-detected (CUDA GPU preferred, CPU fallback). No Settings UI.

**Permission**: `recognition:manage`

---

### Doc 27: ALERT_SYSTEM

**Settings location**: Settings > Alerts

**Alert channel configuration** (`alert_channels` table):

Schema: `channel_type` (PK), `display_name`, `enabled` (bool), `config` (JSONB encrypted), `last_tested_at`, `last_test_ok`, `last_test_error`

Factory defaults: All channels disabled except WebSocket (always-on, no config needed, cannot be disabled).

**Per-channel config fields:**

**WebSocket**: No configuration.

**SMS (Twilio)**:
- `account_sid`, `auth_token` (encrypted), `from_number` (E.164 format)
- `message_template` (Handlebars, max 160 chars), `max_length` (default 160)
- `fallback_config` (JSONB)

**Voice (Twilio)**:
- All SMS fields, plus: `twiml_template` (TwiML XML), `voice` (default "Polly.Matthew"), `keypress_to_acknowledge` (default 1), `call_timeout` (default 30s)

**Radio (SmartPTT/TRBOnet)**:
- `dispatch_url`, `auth_type`, `auth_value` (encrypted)
- `talkgroup_mapping` (JSONB: severity → talkgroup ID)
- `message_template` (Handlebars), `include_alert_tone` (bool)

**PA System — REST**:
- `url`, `auth_type`, `auth_value` (encrypted)
- `zone_mapping` (JSONB: roster → PA zones)
- `audio_clip_mapping` (JSONB: severity → audio clip ID)
- `tts_enabled` (bool)

**PA System — SIP**:
- `sip_uri`, `sip_proxy`, `tts_voice`, `audio_format`

**PA System — Relay**:
- `relay_url`, `relay_auth` (encrypted)
- `on_command`, `off_command`
- `activation_duration_sec` (default 30)

**Browser Push (VAPID)**:
- `vapid_public_key` (auto-generated, display only)
- `vapid_private_key` (auto-generated, stored encrypted)
- `vapid_subject` (mailto: or URL for VAPID identity)

**Alert templates** (CRUD):
- Built-in templates (non-deletable, can be cloned)
- Custom templates: title_template, message_template, severity (default), default_roster_id, default_channels[], escalation_policy_id

**Recipient rosters**:
- Source types: `manual`, `role_group`, `all_users`, `on_shift` (badge-based), `on_site` (presence-based)
- Roster CRUD with test membership evaluation

**Escalation policies**: Per-template configuration. JSONB: levels array, each level: `delay_seconds`, `channels[]`, `roster_id`, `condition` (if_no_acknowledgment/always).

**Per-severity default channel mapping**: Configurable per deployment. Maps INFO/WARNING/CRITICAL/EMERGENCY to default channel sets.

**Permissions**: `alerts:configure`, `alerts:read`, `alerts:send`, `alerts:resolve`, `alerts:templates_manage`, `alerts:rosters_manage`

---

### Doc 28: EMAIL_SERVICE

**Settings location**: Settings > Email (with three tabs: Providers, Templates, Logs)

**Email provider management**: Each provider has: unique name, type, enabled flag, default flag, fallback flag, last tested timestamp and result.

**Per-type config fields:**

**SMTP**:
- `host`, `port`, `tls_mode` (none/starttls/tls)
- `auth_method` (plain/login/xoauth2/none)
- `username`, `password` (encrypted), `from_address`, `from_name`
- `connection_pool_size`

**SMTP + XOAUTH2** (extends SMTP):
- `token_endpoint`, `client_id`, `client_secret`, `scope`, `username`

**Microsoft Graph**:
- `tenant_id`, `client_id`, `client_secret` (encrypted)
- `send_as_user` (UPN), `save_to_sent` (bool)

**Gmail API**:
- `service_account_key` (encrypted JSON blob)
- `send_as_user` (email address), `domain`

**Webhook**:
- `url`, `method` (POST/PUT), `auth_type`, `auth_value` (encrypted)
- `header_name` (custom auth header)
- `payload_template` (Handlebars JSON)

**Amazon SES**:
- `access_key_id`, `secret_access_key` (encrypted)
- `region`, `from_address`, `configuration_set`

**Email template management**:
- System templates: non-deletable; user can edit subject and body content
- Custom templates: full CRUD; `subject_template`, `body_html`, `body_text`, `variables_schema` JSONB
- Template preview with sample data; test send to specified address

**Queue settings**:
- `retry_max_attempts` (default 4), exponential backoff schedule
- `worker_concurrency` (default 4), priority levels: critical/high/normal/low
- Queue cleanup retention (default 30 days)

**Suppression list**: UI for managing suppressed addresses (add/remove/bulk import).

**Delivery logs**: Filterable log viewer (by date range, status, recipient, template, provider).

**Permissions**: `email:configure`, `email:templates_manage`, `email:logs_read`, `email:suppression_manage`

---

### Doc 29: AUTHENTICATION

**Settings location**: Settings > Authentication (sub-sections: Providers, MFA, SCIM, Sessions, Emergency Access, Local)

**Local Auth**:
- Enable/disable local authentication entirely
- Password policy: min_length, complexity requirements (uppercase/lowercase/number/special), password_history count
- Account lockout: max_failures, lockout_duration

**OIDC Providers** (multiple supported):
- `name`, `display_name` (shown on login button)
- `issuer_url`, `client_id`, `client_secret`
- `scopes` array, `claims_mapping` JSONB, `additional_params` JSONB
- `allow_signup` (bool), `jit_provisioning` (bool), `display_order` (int), `enabled` (bool)

**SAML 2.0 Providers** (multiple supported):
- `entity_id` (I/O SP entity ID)
- `idp_metadata_url` OR `idp_metadata_xml` (mutually exclusive)
- `idp_sso_url`, `idp_slo_url`, `idp_certificate` (PEM)
- `sp_signing_key` (PEM encrypted), `sp_signing_cert` (PEM)
- `nameid_format` (email/persistent/transient), `claims_mapping` JSONB, `allow_idp_initiated` (bool)

**LDAP/AD**:
- `server_url` (ldap:// or ldaps://), `tls_mode` (none/starttls/tls)
- `bind_dn`, `bind_password` (encrypted), `search_base`, `user_filter`
- `group_search_base`, `group_filter`, `group_role_mapping` JSONB
- `username_attribute`, `email_attribute`, `display_name_attribute`
- `referral_handling` (follow/ignore), `connection_timeout_ms`

**IdP role mapping table**: provider_id, claim_value, match_type (exact/prefix/regex), I/O role, priority, site_id scope (optional).

**LDAP background sync interval**: Configurable (range 30min to 24hr).

**MFA Configuration:**

Global toggles per method: TOTP enabled/disabled, Duo enabled/disabled, SMS enabled/disabled, Email MFA enabled/disabled.

**Duo Security config**: `api_hostname`, `client_id`, `client_secret`, `redirect_uri`

**Per-role MFA policies**:
- `mfa_required` (bool), `allowed_methods` array, `required_method` (optional)
- `grace_period_hours`, `max_failures`, `lockout_duration_minutes`

**User-level MFA management**: View enrolled methods, reset MFA (force re-enrollment), exempt user from MFA requirement.

**Session Management**:
- `max_concurrent_sessions` (default 3, per-user override available)
- Per-role idle timeout configuration
- `visual_lock_duration` (default 30 minutes)
- `hard_session_timeout` (default 8 hours)

**Active sessions table**: user, IP, browser/client, login time, last activity. Force-terminate per session.

**Kiosk accounts**: List accounts with `is_kiosk=true`. Enable/disable kiosk flag per account.

**Emergency Access Accounts**:
- 2 pre-created emergency accounts
- Enable/disable toggle (should be disabled when not needed)
- Split-password regeneration (requires two authorized users — split knowledge control)
- Usage audit log

**SCIM Provisioning**:
- Enable/disable SCIM 2.0 endpoint
- Bearer token management (generate, view once, revoke)
- Endpoint URL display (read-only, for IdP configuration)
- Provisioning log (sync events, errors, users created/updated/deprovisioned)

**API Key Management**: Create scoped API keys, list active keys, revoke, per-key last-used tracking.

**EULA Management**:
- Create draft EULA version, edit draft, publish (triggers re-acceptance requirement)
- Archive old versions
- View acceptance records (who accepted, when, from what IP)
- Export acceptance audit CSV

**Permissions**: `auth:configure` (covers providers, MFA, SCIM, session policy), `auth:emergency_access` (emergency accounts), `auth:sessions_manage` (force-terminate sessions)

---

### Doc 30: ACCESS_CONTROL_SHIFTS

**Settings location**: Settings > Access Control (badge system config only — NOT shift scheduling)

**Note**: The Shifts module handles shift scheduling. Settings > Access Control handles only badge reader/access system configuration.

**Badge source configuration** (`access_control_sources` table):
- `adapter_type`: Lenel OnGuard, CCURE 9000, Genetec Security Center, Honeywell Pro-Watch, Gallagher Command Centre, Generic Database
- `polling_interval_sec` (default 30, range 10-300), `enabled` (bool), `config` (JSONB encrypted)

**Per-adapter config fields:**
- **Lenel OnGuard**: `api_url`, `username`, `password`, `panel_ids[]`, `reader_group_filter`
- **CCURE 9000**: `server_host`, `port`, `username`, `password`, `credential_partition`
- **Genetec**: `server_url`, `username`, `password`, `partition_guid`, `door_ids[]`
- **Honeywell Pro-Watch**: `database_host`, `database_name`, `username`, `password`, `reader_filter`
- **Gallagher**: `rest_api_url`, `api_key`, `cardholder_division_filter`
- **Generic Database**: `connection_string` (encrypted), `query`, `badge_field`, `timestamp_field`, `event_type_field`, `location_field`, `employee_id_field`

**Muster point configuration** (Settings > Access Control > Muster Points):
- `name`, `reader_ids[]`, `source_id` (FK), `capacity`, `gps_coordinates`, `enabled`

**Presence management settings**:
- `stale_presence_timeout` (default 16 hours)
- `shift_end_auto_clear` (bool, default off)
- `badge_events_retention_days` (default 90)
- `shifts_retention_days` (default 730)

**Shift external import**: Source system type (SAP HCM, Kronos/UKG), sync interval (default 1hr), credentials and endpoint config per source type.

**Handover default**: `default_handover_minutes` (default 30) per shift pattern.

**User attribute**: `employee_id` field on user accounts — maps I/O users to badge system employee IDs.

**Permissions**: `badge_config:manage`, `muster:manage`, `presence:manage`, `shifts:read`, `shifts:write`

---

### Doc 31: ALERTS_MODULE

This is the frontend Alerts module (human-initiated communications), not the alert system backend (doc 27). Settings implications:

- Template management for alert templates accessed via Settings > Alerts (not within the Alerts module itself). Requires `alerts:templates_manage`.
- Roster management accessed via Settings > Alerts. Requires `alerts:rosters_manage`.
- The Alerts module frontend itself does not have Settings UI — it consumes configured templates and rosters.
- Muster command center displays muster point data configured in Settings > Access Control.

---

### Doc 32: SHARED_UI_COMPONENTS

No direct Settings module requirements. Shared components are consumed by Settings like all other modules.

**Indirect implications**:
- Point Picker component is used in Settings when configuring point bindings, data link sources, and DCS supplemental connectors.
- Expression Builder Modal is invoked from Settings > Points and Settings > Expressions.
- Time Range Picker appears in Settings > Email > Logs and Settings > Alerts > Delivery History.
- TanStack Table virtual scrolling used in: user list, role list, session list, alert template list, import definition list, etc.

---

### Doc 33: TESTING_STRATEGY

No direct Settings requirements.

**Implication**: Settings module endpoints are integration-tested (real PostgreSQL). Auth provider configuration flows (OIDC, SAML, LDAP) are mocked at the external IdP boundary. Email/SMS/alert channel tests use mock adapters.

---

### Doc 34: DCS_GRAPHICS_IMPORT

**Settings involvement**: Minimal. DCS graphics import is primarily a Designer module feature.

**Indirect**: DCS supplemental connectors (which enhance OPC sources with DCS database metadata) are configured in Settings > Data Sources. This is the overlap between doc 24 and doc 34.

---

### Doc 35: SHAPE_LIBRARY

**Settings location**: Settings > Graphics

**Shape style global setting**:
- `shape_style`: `isa_standard` (Option 1 — clean geometric ISA/IEC 62264 style) or `graphical` (Option 2 — more realistic/detailed equipment icons)
- System-wide default. Per-instance override available within the Designer.

**No other shape library Settings**: Individual shapes are part of the I/O installation. Custom shapes managed within the Designer module.

---

### Doc 36: OBSERVABILITY

**Settings location**: Settings > System > Health

**System Health page** (requires `system:monitoring`):
- Aggregates `/health/ready` responses from all 11 services
- Shows: service name, version, status (ready/degraded/down), last checked
- Version mismatch flagged as warning
- Service dependency graph

**Active sessions in system monitoring**: Live list with force-terminate button. Duplicate of Sessions view in Settings > Authentication > Sessions.

**Metrics configuration** (env vars, potentially exposed in Advanced Settings):
- `IO_METRICS_INTERVAL=15s`, `IO_METRICS_TIMEOUT=5s`, `IO_METRICS_BATCH_SIZE=1000`
- `IO_METRICS_COLLECTOR_ENABLED=true` — disable if external Prometheus handles collection
- `IO_TRACING_ENABLED=false`, `IO_OTLP_ENDPOINT` — distributed tracing
- `IO_LOG_LEVEL` — service log level

**Retention** (likely env vars not Settings UI): Raw metrics: 30-day retention. 5-min aggregates: 1-year retention.

**Shell status indicator**: Top nav status dot (red/amber/green) opens a popover showing per-service health summary. Always visible, not configurable. Fed by the same health check data as the full Settings > System > Health page.

---

### Doc 37: IPC_CONTRACTS

No new Settings requirements. Doc 37 defines wire formats for inter-service communication.

**Settings-relevant NOTIFY patterns**: When Settings changes something requiring immediate effect, the API Gateway sends PostgreSQL NOTIFY payloads:
- Auth Service listens for auth provider config changes
- Alert Service listens for channel config changes
- Email Service listens for provider config changes
- OPC Service listens for data source enable/disable changes

---

### Doc 38: FRONTEND_CONTRACTS

**Settings routes — complete list of 28 distinct `/settings/*` routes defined:**

| Route | Description |
|-------|-------------|
| `/settings` | Settings root / redirect to first accessible section |
| `/settings/users` | User management |
| `/settings/users/:id` | User detail |
| `/settings/roles` | Role management |
| `/settings/roles/:id` | Role detail |
| `/settings/groups` | Group management |
| `/settings/groups/:id` | Group detail |
| `/settings/auth` | Authentication providers overview |
| `/settings/auth/local` | Local auth configuration |
| `/settings/auth/oidc` | OIDC providers list |
| `/settings/auth/oidc/:id` | OIDC provider detail |
| `/settings/auth/saml` | SAML providers list |
| `/settings/auth/saml/:id` | SAML provider detail |
| `/settings/auth/ldap` | LDAP configuration |
| `/settings/auth/mfa` | MFA configuration |
| `/settings/auth/sessions` | Active sessions + session policy |
| `/settings/auth/scim` | SCIM provisioning |
| `/settings/auth/emergency` | Emergency access accounts |
| `/settings/email` | Email providers + templates + logs |
| `/settings/alerts` | Alert channels + templates + rosters |
| `/settings/access-control` | Badge source adapters + muster points |
| `/settings/import` | Universal import connections + definitions |
| `/settings/recognition` | P&ID + DCS model management |
| `/settings/expressions` | Shared expression library |
| `/settings/graphics` | Shape style + graphics defaults |
| `/settings/system` | System health + observability |
| `/settings/backup` | Backup schedule + restore |
| `/settings/general` | Application-level settings (watermark, export path, etc.) |

**Permission guard pattern**: Every settings route is wrapped in `<PermissionGuard required={["..."]} />` that redirects to the first accessible settings section if the user lacks the required permission.

**Sidebar rules**: The Settings module sidebar shows only the sections the user has permission to access.

---

### Doc 39: IOGRAPHIC_FORMAT

No direct Settings requirements. The `.iographic` format is a file interchange format for the Designer module.

**Indirect implication**: Settings > Points must treat tag strings as stable identifiers because `.iographic` portability depends on them. If Settings allows renaming tag identifiers, exported `.iographic` files may break on re-import. This is a cross-cutting concern: point tag strings are effectively API contracts.

---

## Key Findings Summary

**28 distinct /settings/* routes** are defined in doc 38 (FRONTEND_CONTRACTS), covering users/roles/groups, auth (local/OIDC/SAML/LDAP/MFA/SCIM/sessions/emergency), email, alerts, access control, import, recognition, expressions, graphics, system, backup, and general.

**Docs 27/28/29/30 are the richest**:
- **Doc 27 (ALERT_SYSTEM)**: 7 channel types each with detailed config schemas, plus templates, rosters, escalation policies, and 6 permissions
- **Doc 28 (EMAIL_SERVICE)**: 6 provider types each with detailed config schemas, template management, queue settings, suppression list, delivery logs, and 4 permissions
- **Doc 29 (AUTHENTICATION)**: 4 auth provider types, MFA config for 4 methods + Duo, session policy, SCIM, emergency accounts, EULA management, API keys — the deepest settings section in the entire system
- **Doc 30 (ACCESS_CONTROL)**: 6 badge adapter types with per-type config, muster points, stale presence timeout, retention settings, external shift import

**Key design boundary**: Deployment-time env vars (docs 22/20) are explicitly NOT Settings UI — they cover OPC buffer sizes, tile pyramid storage, YARA rules path, metrics collection intervals, and distributed tracing. Settings UI owns everything that can change at runtime without a service restart.

**Tag stability constraint** (doc 39): Settings > Points must treat tag strings as stable identifiers because `.iographic` portability depends on them.
