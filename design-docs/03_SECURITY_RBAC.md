# Inside/Operations - Security & RBAC Model

## Security Principles

1. **Defense in Depth** - Multiple layers of security
2. **Least Privilege** - Users have minimum necessary permissions
3. **Secure by Default** - Security enabled out of the box
4. **Audit Everything** - Complete audit trail of all actions
5. **Fail Securely** - Errors do not expose sensitive information

## Authentication

> **See 29_AUTHENTICATION.md** for the full authentication specification, including OIDC/SAML/LDAP provider integration, JIT provisioning, SCIM 2.0, MFA policies, and service account API keys. This section covers the core JWT token flow and session management.

### JWT Token-Based Authentication

**Access Token:**
- Short-lived (15 minutes)
- Stored in memory (not localStorage)
- Contains: user_id, username, roles, permissions
- Signed with HS256 algorithm
- Included in Authorization header: `Bearer <token>`

**Refresh Token:**
- Long-lived (7 days)
- Stored in httpOnly cookie (XSS protection)
- Stored in database for revocation
- Used to obtain new access token when expired
- Rotated on each refresh (one-time use)

**Token Flow:**
```
1. User logs in → receive access + refresh tokens
2. Access token used for API calls (15 min)
3. Access token expires → use refresh token to get new access token
4. Refresh token rotated → old refresh token invalidated
5. Refresh token expires → user must log in again
```

### Password Security

**Password Requirements:**
- Minimum 8 characters
- Must contain uppercase, lowercase, number
- Optional: special character requirement

**Password Storage:**
- Hashed with Argon2id
- Salt automatically generated per password
- Configurable cost parameters (memory, iterations)
- Never store or log plain text passwords

**Password Reset:**
- Time-limited reset tokens (expire after 1 hour)
- Single-use (token consumed on password change)
- Password reset uses the Email Service (doc 28) with the `password_reset` template
- Flow: user submits email → API generates time-limited single-use token → Email Service sends reset link → user clicks link → enters new password → token consumed
- Full flow design in doc 29

### Session Management

**User Sessions:**
- Tracked in `user_sessions` table
- **3 concurrent sessions per user** (IEC 62443 SR 2.7 compliance). SharedWorker means multi-tab in the same browser = 1 session. Three separate browsers/devices = 3 sessions. When exceeded, oldest session is terminated.
- Session information includes: device, IP, location, last activity, session_type (`interactive`, `kiosk`)
- Users can view and revoke their own sessions

**Session Revocation:**
- Logout: Invalidates refresh token in database
- Policy epoch: Global revocation (increment epoch, all tokens with old epoch rejected)
- Admin revocation: Admin can terminate any user session

### Visual Lock (Idle Session Lock)

Per IEC 62443 SR 2.5, idle sessions enter a "visual lock" state instead of full logout. Data continues flowing — monitoring displays stay live.

**Per-role idle timeouts** (configurable by admin):

| Role | Default Timeout |
|------|----------------|
| Admin | 15 minutes |
| Supervisor | 30 minutes |
| Operator | 60 minutes |
| Analyst | 30 minutes |
| Content Manager | 30 minutes |
| Maintenance | 30 minutes |
| Viewer | 30 minutes |
| Contractor | 15 minutes |

**Visual lock behavior:**
1. **Hidden until interaction**: The lock overlay is NOT shown when the idle timeout expires. Data keeps flowing, WebSocket stays alive, display remains useful as a monitoring screen.
2. **On interaction attempt**: When the user clicks or presses a key, a semi-transparent overlay appears with the user's name and a password prompt. Live data remains visible underneath.
3. **Password timeout**: If no password is entered within 60 seconds, the overlay fades away — back to the hidden lock state. The display resumes passive monitoring mode.
4. **Quick unlock**: User enters password → overlay disappears, full interaction restored. No page reload, no lost context. Calls `POST /api/auth/refresh` to get a new access token.
5. **Full logout option**: Button on the overlay to fully log out (clears tokens, returns to login page).
6. **WebSocket behavior**: WebSocket connection stays alive using the original ticket. No hard session timeout — the connection persists as long as the refresh token is valid.
7. **Silent background refresh**: While in visual lock, the browser silently calls `POST /api/auth/refresh` every 30 minutes. This checks whether the user account is still enabled and permissions haven't changed. If the account has been disabled or revoked, the refresh fails and the session terminates (login screen). If the account is still valid, new tokens are issued silently — the WebSocket connection is unaffected and permissions are updated.
8. **Refresh token expiry**: If the 7-day refresh token has expired when the user tries to unlock (or during a background refresh), the visual lock transitions to full logout.

**Multi-window sync**: BroadcastChannel (`io-app-sync`) synchronizes lock/unlock events across windows. Unlocking one window unlocks all (user just proved presence).

### Kiosk Mode (Dedicated Display Session)

For wall-mounted control room monitors and dedicated display screens.

**Characteristics:**
- **No idle timeout** — display runs indefinitely
- **Read-only base layer**: Shows live graphics, dashboards, and process views. WebSocket stays alive indefinitely with automatic reconnection on network interruption.
- **Hides I/O navigation**: Sidebar and top bar are hidden. Hover-to-reveal for navigation access (e.g., mouse to screen edge reveals sidebar temporarily).
- **Compatible modules**: Console and Process only
- **Authenticated interactive layer**: When someone needs to perform a write action (alarm acknowledgment, etc.), a floating "Authenticate" button appears. Clicking it shows a login dialog. The authenticated session has its own idle timeout (5 min default) and falls back to the kiosk layer when it expires.
- **Dedicated kiosk account**: A service-account-like user (e.g., `kiosk_controlroom_1`) with only `console:read`, `process:read`, `dashboards:read`, `events:read` permissions.
- **Kiosk session activation**: Via URL parameter `?mode=kiosk&display=controlroom-1`.
- **Non-expiring refresh token**: Kiosk sessions use a refresh token that never expires. The background refresh still runs (checking account status, updating permissions), but the token itself has no TTL. The only things that terminate a kiosk session are admin action (disable account or terminate session) or the machine itself dying.
- **Survives reboots**: Refresh token stored in a secure persistent cookie (not session cookie) so if the machine restarts and the browser reopens, the session is still valid. No re-login needed.
- **IP restriction (optional)**: Kiosk sessions can be restricted to specific IP addresses — only valid from the designated workstation.
- **Admin visibility**: All active kiosk sessions visible in Settings > Sessions with last heartbeat timestamp. Admin can remotely terminate any kiosk session.
- **Session tagging**: `session_type = 'kiosk'` in `user_sessions` for audit and monitoring.

### Break-Glass Emergency Access

2 pre-created emergency accounts (e.g., `io_emergency_1`, `io_emergency_2`) for use when all admin accounts are locked out or the IdP is down.

**Account characteristics:**
- `is_emergency_account = true` on `users` table
- Local auth only (bypasses IdP — the IdP may be the thing that's broken)
- Bypasses MFA (emergency — the MFA device may not be available)
- Disabled by default (`enabled = false`)
- Full Admin permissions when activated

**Split password (two-person rule):**
- 32+ character random password, split into two halves
- Half 1 stored in plant manager's safe
- Half 2 stored in IT manager's safe (different physical location)
- Both halves required to assemble the password

**Activation methods** (in order of preference):
1. Admin UI (if any admin account still works)
2. `io-ctl emergency enable --account io_emergency_1` (CLI tool on server, requires SSH + `/etc/io/emergency.key`)
3. Direct database update (last resort)

**Automatic safeguards:**
- Login triggers immediate notification via all configured alert channels (email, SMS) to all registered admins
- Hard 4-hour session maximum (configurable) — auto-terminates
- Account auto-disables when session ends
- All actions flagged with `is_emergency = true` in audit log
- Next admin login shows mandatory alert: "Emergency account was used. Review required."

**CLI fallback** (`io-ctl emergency` subcommands):
- `enable --account <name>` — enables the emergency account
- `reset-password --account <name>` — resets to a new random password, displays once
- `disable --account <name>` — disables the account
- `audit` — dumps all emergency account activity

**Post-use procedure** (documented in deployment guide):
- Review all actions taken during emergency session
- Rotate emergency account password
- Re-seal credentials in separate safes
- File incident report
- Determine root cause and update access procedures

Flagged for post-v1 review of procedures and quarterly testing cadence.

### Multi-Window Authentication

When users open detached windows (see doc 06 Multi-Window Architecture), each window authenticates independently using the existing token infrastructure:

- The main window spawns detached windows via `window.open()` — same-origin, so the httpOnly refresh token cookie is shared automatically
- Each detached window calls `POST /api/auth/refresh` using the shared refresh token cookie to obtain its own in-memory access token
- A BroadcastChannel (`io-app-sync`) synchronizes token refreshes — when any window refreshes its token, the new token is broadcast to all other windows
- No changes to the server-side session model. Session tracking remains per-user, not per-window. The existing httpOnly cookie design supports this pattern natively
- If the user logs out from any window, the BroadcastChannel propagates the logout event to all other windows, which clear their in-memory tokens and redirect to the login screen
- All audit log entries continue to reference the user, not individual windows

## Authorization (RBAC)

### Role Model

**Flat RBAC with 8 predefined roles, custom role support, and additive multi-role assignment.**

- Users can hold **multiple roles** (cap: 10 per user). Effective permissions are the **union** of all assigned roles.
- Predefined roles cannot be deleted but can be deactivated (`is_active = false`).
- Custom roles are created by **cloning** a predefined role and modifying permissions. No cap on total custom roles.
- No role hierarchy or inheritance — each role is an independent set of permissions.
- ALL roles (including Viewer and Contractor) grant personal Designer, Dashboard, and Report creation. Publishing/sharing requires Content Manager, Supervisor, Analyst, or Admin.

### 8 Predefined Roles

**1. Viewer** — Read-only across all accessible data categories
- Target: Finance, marketing, visiting executives, auditors
- Read-only access to Console, Process, Dashboards, Reports, Log, Rounds, Events, Shifts
- Personal creation in Designer, Dashboards, and Reports (no publish/share)
- Can generate and export reports on demand
- Can view and acknowledge alerts
- Cannot access Forensics, Settings, or system configuration
- ~20 permissions

**2. Operator** — Control room operations
- Target: Board operators, field operators
- Full Console/Process interaction with personal workspaces
- Alarm acknowledgment, log entries, round execution and transfer
- Basic Forensics access (read + search) for "what happened last shift?" troubleshooting
- Personal creation in Designer, Dashboards, and Reports (no publish/share)
- Can send non-emergency alerts, participate in muster
- Cannot manage alarm definitions, templates, schedules, or system configuration
- ~30 permissions

**3. Analyst** — Data analysis focus
- Target: Process engineers, reliability engineers, safety officers, environmental compliance
- Full Forensics (read + search + correlate) — core function
- Full Reports (create templates + schedule + publish)
- Dashboards (create + publish)
- Expression Builder access (`system:expression_manage`)
- Personal creation in Designer (no publish — add Content Manager for that)
- View-only access to Settings (point configuration reference)
- Cannot write log entries, execute rounds, or manage alarm definitions
- ~35 permissions

**4. Supervisor** — Operations management
- Target: Shift supervisors, operations managers, area supervisors
- Everything Operator has, plus:
- Workspace and process view publishing
- Log template and schedule management
- Round template, schedule, and transfer management
- Shift schedule editing, presence data access
- Alarm definition management (create/edit/shelve)
- Alert sending, group management, muster
- Full Forensics and Reports
- Personal creation in Designer (no publish — add Content Manager for that)
- ~55 permissions

**5. Content Manager** — Graphics and content
- Target: Senior process engineers, graphics specialists, documentation teams
- Full Designer access (create, edit, import, publish, export) — core function
- Console workspace and process view publishing
- Dashboard and report template creation and publishing
- Round template creation (checkpoint definitions)
- Basic Forensics (read + search)
- Cannot write log entries, execute rounds, manage alarms, or manage shifts
- ~40 permissions

**6. Maintenance** — Equipment focus
- Target: Maintenance planners, reliability technicians, instrument technicians
- Rounds execution and transfer — core function
- Full Forensics (read + search + correlate) for equipment investigation
- Log entry creation (maintenance activity logging)
- Personal creation in Designer, Dashboards, and Reports (no publish/share)
- Expression Builder access (`system:expression_manage`)
- View-only access to Settings (point/equipment configuration reference)
- Cannot publish content, manage templates/schedules, or manage alarms
- ~30 permissions

**7. Contractor** — Time-limited external access
- Target: External contractors, temporary workers, vendor representatives
- Same base as Viewer: read-only + personal creation (Designer, Dashboards, Reports — no publish/share)
- **Mandatory expiry date** on account (admin sets `account_expires_at`)
- Log entry creation (regulatory requirement for contractor work documentation)
- Round execution (assigned equipment inspections)
- Cannot access Forensics, Reports, Dashboards, Shifts, or system configuration
- Cannot export any data
- ~15 permissions

**8. Admin** — Full system access
- Target: IT administrators, system administrators
- All 119 permissions
- Exclusive access to: user/role/group management, system settings, OPC configuration, backup/restore, auth provider configuration, email configuration, alert channel configuration, emergency account management
- Should be held by very few people — the other 7 roles cover all non-admin job functions

### Role Combination Examples

| Job Function | Roles Assigned | Effective Access |
|---|---|---|
| Board operator | Operator | Log + Rounds + Console + basic Forensics |
| Shift supervisor | Operator + Supervisor | All Operator plus template management, alarm management, shift editing, presence data |
| Process engineer | Analyst | Full Forensics + Reports + Dashboards publish |
| Process engineer who creates graphics | Analyst + Content Manager | Full Forensics + Reports + Dashboards + full Designer |
| Reliability engineer | Analyst + Maintenance | Full Forensics + Rounds execute + maintenance Log |
| Maintenance supervisor | Maintenance + Supervisor | Maintenance access + template/schedule management |
| Plant manager | Viewer + Analyst | Reports + Dashboards + Forensics |
| Finance analyst | Viewer | Reports + read-only dashboards |
| IT administrator | Admin | Everything |
| Turnaround contractor | Contractor | Log + Rounds only, time-limited |
| Graphics specialist | Content Manager | Full Designer + publish capabilities |

### Groups with Role Assignment

Groups serve two purposes: (1) organizational containers for sharing content (existing), and (2) role assignment (new).

**Group-based role assignment** (Grafana/Azure AD pattern):
- `group_roles` junction table: `group_id UUID`, `role_id UUID` (composite PK)
- Users inherit roles from all groups they belong to
- Group-inherited roles are **additive** with directly-assigned roles
- Effective permissions = union of (direct roles + group-inherited roles)
- JWT carries flattened permissions resolved at token issuance time — no runtime resolution per request

**Admin UI features**:
- Group management: create group, assign roles to group, add/remove members
- User detail view: "Effective Permissions" tab showing all permissions with source (direct role vs. which group)
- Group preview: "If I add Analyst role to this group, N users would gain these permissions"
- Bulk operations: "Select users -> Add to group" and "Select users -> Assign role directly"

**IdP sync interaction**: SCIM pushes group membership changes to `user_groups`. OIDC/SAML group claims map to I/O groups at login. Groups already have roles. User gets permissions automatically. This is the primary reason for group-based roles — without it, IdP group sync can't drive permissions.

### Data Categories

Data categories control which data users can see based on the source/connection that provides it.

**9 Predefined Categories:**

| Category | Description | Example Data |
|----------|-------------|--------------|
| Process | Real-time and historical process measurements | Temperatures, pressures, flows, levels |
| Event | Alarms, events, state changes | OPC alarms, I/O-generated alarms, sequence of events |
| Access Control | Badge/access control data | Badge-in/out events, door access logs |
| Personnel | Shift schedules, crew assignments, individual activity | Who was on shift, operator actions |
| Financial | Cost-related process data | Throughput for cost accounting, energy consumption |
| Maintenance | Equipment maintenance and inspection data | Work orders, calibration records, round results |
| Ticketing | External ticketing system data (via import connectors) | SAP PM notifications, Maximo work orders |
| Environmental | Environmental compliance data | Emissions, flare events, discharge monitoring |
| General | Uncategorized data (default) | Anything not assigned to a specific category |

**How data categories work:**
- Category is assigned at **connection configuration time** (when setting up OPC sources, import connectors, or other data sources in Settings)
- Default category for new connections: General
- Admin can create **custom data categories** beyond the 9 predefined ones
- Each role defines which categories it can access (configured in role permissions)
- Module visibility: modules only show data from the user's permitted categories
- A single connection belongs to exactly one category
- Points inherit their category from their source connection

### Multi-Site Support

I/O includes basic multi-site support in v1 via a `sites` table and `site_id` on key entities.

**Schema foundation:**
- `sites` table: `id`, `name`, `code` (short code like "SITE-A"), `description`, `timezone`, `is_active`, `metadata` (JSONB for address, GPS, etc.)
- Default "Primary" site seeded on initial deployment
- `site_id` (nullable) on `user_roles` — a user can have different roles at different sites (`NULL` = global, applies to all sites)
- `site_id` on `point_sources` — each OPC/data connection belongs to a site
- `site_id` on `audit_log` — actions recorded in site context
- `user_sites` table: which sites a user can access, with `is_default` flag

**Site-scoped roles:**
- A user can be Operator at Site A and Viewer at Site B
- Partial unique indexes on `user_roles`: one for global assignments (`WHERE site_id IS NULL`), one for site-scoped (`WHERE site_id IS NOT NULL`)
- Application-level filtering via `io-db` crate (not PostgreSQL RLS) — explicit WHERE clauses, compatible with TimescaleDB hypertables

**v1 behavior:** Single-site deployments ignore site scoping entirely — all `site_id` values are NULL or point to the default Primary site. Multi-site activation is a configuration change, not a schema migration.

### IdP Group-to-Role Mapping

> **See 29_AUTHENTICATION.md** for the full IdP integration specification. This section covers the role mapping model referenced by the RBAC system.

**Dedicated `idp_role_mappings` table** (replaces the JSONB `group_role_mapping` field on `auth_provider_configs`):

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID PK | |
| `provider_id` | UUID FK → `auth_provider_configs` | Which IdP provider |
| `match_type` | VARCHAR(20) | `exact`, `prefix`, or `regex` |
| `match_value` | TEXT | The IdP group name/ID to match |
| `role_id` | UUID FK → `roles` | Which I/O role to assign |
| `site_id` | UUID FK → `sites` (nullable) | Site scope for the assignment (NULL = global) |
| `priority` | SMALLINT | Display ordering in admin UI |
| `role_source` | VARCHAR(10) | `idp`, `manual`, or `both` — tracks assignment origin |
| `enabled` | BOOLEAN | Active/inactive toggle |

**7 Conflict Resolution Rules** (deterministic, documented):

1. **Multiple IdP groups → additive roles**: User in groups mapping to Operator and Analyst gets both. Union of permissions. No "highest wins."
2. **Local admin can add, IdP sync cannot remove local**: IdP-sourced roles (`role_source = 'idp'` or `'scim'`) are managed by IdP. Locally-assigned roles (`role_source = 'local'`) are never removed by IdP sync.
3. **No automatic minimum role**: If IdP removes all roles and user has no local roles, user has zero permissions. Admin UI shows warning. User sees "no assigned roles" message. No automatic safety-net grant.
4. **IdP-sourced attributes are read-only**: When `auth_provider != 'local'`, `full_name` and `email` sync from IdP on each login. Admin override is wiped on next login.
5. **IdP down → cached roles**: JWT carries roles baked in at issuance. User continues for token lifetime. LDAP background sync skips with warning on error (preserves existing assignments, never treats error as empty).
6. **Provider switch**: Switching from IdP to local converts `role_source = 'idp'` assignments to `'local'`. Switching from local to IdP preserves existing local roles, adds IdP roles on top.
7. **Initial rollout**: Enabling IdP for existing local users — match by email/username on first SSO login, preserve local role assignments, add IdP roles additively. Optional batch operation to convert local roles to IdP-managed.

### Permission Structure

**118 Fine-Grained Permissions across 15 modules:**

**Console Module (7 permissions):**
- `console:read` - View console workspaces
- `console:write` - Create/edit personal workspaces
- `console:workspace_write` - Create/edit any workspace
- `console:workspace_publish` - Publish workspaces
- `console:workspace_delete` - Delete workspaces
- `console:export` - Export point data from console workspaces
- `console:admin` - Console module administration

**Process Module (6 permissions):**
- `process:read` - View process views and navigate between them
- `process:write` - Create/edit process views
- `process:publish` - Publish process views for other users
- `process:delete` - Delete process views
- `process:export` - Export point data from process views
- `process:admin` - Process module administration

**Designer Module (7 permissions):**
- `designer:read` - View graphics in designer
- `designer:write` - Create/edit graphics
- `designer:delete` - Delete graphics
- `designer:publish` - Publish graphics templates
- `designer:import` - Import files and run symbol recognition (P&ID and DCS)
- `designer:export` - Export graphics metadata and point bindings
- `designer:admin` - Designer module administration

**Dashboards Module (6 permissions):**
- `dashboards:read` - View dashboards
- `dashboards:write` - Create/edit personal dashboards
- `dashboards:delete` - Delete personal dashboards
- `dashboards:publish` - Publish dashboards
- `dashboards:export` - Export widget data from dashboards
- `dashboards:admin` - Dashboards module administration

**Reports Module (7 permissions):**
- `reports:read` - View reports and generated report history
- `reports:write` - Create/edit report templates (via Designer report mode)
- `reports:generate` - Run reports on demand (select template, specify time range, generate output)
- `reports:schedule_manage` - Create/edit/delete scheduled report runs (recipients, format, frequency)
- `reports:delete` - Delete report templates
- `reports:export` - Export reports to CSV/PDF/Excel/HTML/JSON
- `reports:admin` - Reports administration (manage all templates and schedules, custom SQL queries)

**Forensics Module (7 permissions):**
- `forensics:read` - Access forensics module, view own and shared investigations
- `forensics:write` - Create, edit, and close/cancel own investigations (stages, evidence, point curation)
- `forensics:share` - Share investigations with other users or roles
- `forensics:search` - Perform advanced searches (alarm search, threshold search)
- `forensics:correlate` - Run correlation engine analysis (point pair correlation, cross-correlation with time lag, spike detection)
- `forensics:export` - Export investigation results (PDF, XLSX, CSV)
- `forensics:admin` - Forensics module administration (view/edit all investigations, delete investigations)

**Events Module (5 permissions):**
- `events:read` - View events and alarms (event timeline, alarm state, alarm history)
- `events:manage` - Create/edit/disable I/O-generated alarm definitions (threshold wizard, expression-based alarms)
- `events:acknowledge` - Acknowledge I/O-generated alarms (state transition in alarm_states)
- `events:shelve` - Shelve/unshelve I/O-generated alarms (time-limited suppression per ISA-18.2, requires documented reason)
- `events:admin` - Events administration (delete alarm definitions, configure event historian settings)

**Log Module (7 permissions):**
- `log:read` - View log entries and instances
- `log:write` - Create/edit log entries (fill out log instances)
- `log:delete` - Delete log entries (own entries only)
- `log:template_manage` - Create/edit/delete log templates and reusable segments
- `log:schedule_manage` - Create/edit/delete log schedules (per-shift, by time window, per-team)
- `log:export` - Export log entries and templates
- `log:admin` - Log module administration (delete any entry, manage all templates and schedules)

> **Log Permission Migration Note:** `log:template_write` is renamed to `log:template_manage` and `log:schedule_manage` is split out from `log:admin`. Existing `log:template_write` assignments should be migrated to `log:template_manage`.

**Rounds Module (7 permissions):**
- `rounds:read` - View rounds, instances, and completion history
- `rounds:execute` - Start, complete, and save checkpoint responses for round instances
- `rounds:transfer` - Request transfer of a locked round to another user (manager/supervisor override or notification-based)
- `rounds:template_manage` - Create/edit/delete round templates (checkpoint definitions, validation rules, media requirements)
- `rounds:schedule_manage` - Create/edit/delete round schedules (per-shift, daily/interval, weekly recurrence)
- `rounds:export` - Export round data, templates, and schedules
- `rounds:admin` - Rounds administration (manage all templates, schedules, and transfers; override round locks)

> **Rounds Permission Migration Note:** `rounds:write` is renamed to `rounds:execute`, `rounds:template_write` is renamed to `rounds:template_manage`, and `rounds:assign` is replaced by `rounds:schedule_manage` (schedules assign rounds to shifts, not individuals). `rounds:transfer` is new.

**Settings Module (4 permissions):**
- `settings:read` - View settings
- `settings:write` - Modify application settings
- `settings:export` - Export settings data (users, points, sources, events)
- `settings:admin` - Full settings administration

**Alerts (8 permissions):**
- `alerts:read` - View active alerts, alert history, alert templates, and delivery details (Default: all roles)
- `alerts:acknowledge` - Acknowledge alerts (Default: all roles)
- `alerts:send` - Create manual alerts, send non-emergency notifications, resolve, cancel (Default: Operator, Supervisor, Admin)
- `alerts:send_emergency` - Send EMERGENCY-severity notifications triggering full-screen takeover (Default: Admin)
- `alerts:manage_templates` - Create, edit, delete alert templates and notification templates (Default: Admin)
- `alerts:manage_groups` - Create, edit, delete alert groups, recipient rosters, and manage membership (Default: Admin, Supervisor)
- `alerts:configure` - Configure alert channels, escalation rules (Default: Admin)
- `alerts:muster` - View muster status dashboard, mark personnel as accounted (Default: Operator, Supervisor, Admin)

> **Alert Namespace Note:** The `alerts:*` namespace is the single unified namespace for the Alert System. Previous `alerts_module:*` permissions have been merged into this namespace. `alerts:read` subsumes the former `alerts_module:access` and `alerts_module:view_history`. `alerts:send` subsumes the former `alerts:create` and `alerts_module:send`. `alerts:manage_groups` subsumes the former `alerts:manage_rosters` and `alerts_module:manage_groups`.

**Email System (4 permissions):**
- `email:configure` - Configure email providers, set default, enable/disable (Default: Admin)
- `email:manage_templates` - Create, edit, delete email templates (Default: Admin)
- `email:send_test` - Send test emails to verify provider configuration (Default: Admin)
- `email:view_logs` - View email delivery logs and queue status (Default: Admin, Supervisor)

**SMS System (1 permission):**
- `sms:configure` - Configure SMS providers (Twilio, etc.) and credentials used for MFA and alert notifications (Default: Admin)

**Authentication (3 permissions):**
- `auth:configure` - Configure authentication providers (OIDC, SAML, LDAP), manage JIT provisioning rules, IdP role mappings, set default auth method (Default: Admin)
- `auth:manage_mfa` - Configure MFA policies per role, enable/disable MFA methods, view MFA enrollment status (Default: Admin)
- `auth:manage_api_keys` - Create, revoke, and manage service account API keys (Default: Admin)

**Shifts Module (8 permissions):**
- `shifts:read` - View shifts, schedules, crews, muster points, muster events (Default: all roles except Contractor)
- `shifts:write` - Create/edit shifts, patterns, crews, shift assignments (Default: Supervisor, Admin)
- `presence:read` - View on-site personnel, badge events, presence status (Default: Supervisor, Admin)
- `presence:manage` - Manually clear stale presence entries (Default: Supervisor, Admin)
- `muster:manage` - Configure muster points, manually account personnel during muster, end muster events (Default: Admin)
- `badge_config:manage` - Configure badge system connections, adapters, polling, user mapping (Default: Admin)
- `alert_groups:read` - View custom alert groups and membership (Default: all roles except Contractor)
- `alert_groups:write` - Create, edit, delete custom alert groups and manage membership (Default: Admin)

**System (27 permissions):**
- `system:manage_users` - Create/edit/disable users
- `system:manage_groups` - Create/edit groups
- `system:manage_roles` - Assign roles to users
- `system:view_logs` - View audit logs
- `system:system_settings` - Configure system-wide settings
- `system:opc_config` - Configure OPC UA endpoints
- `system:source_config` - Manage data sources (point_sources CRUD, enable/disable)
- `system:event_config` - Configure event historian settings
- `system:point_config` - Update point application config (criticality, area, active, GPS, barcode, notes, etc.)
- `system:point_deactivate` - Deactivate/reactivate points (lifecycle management)
- `system:expression_manage` - Share expressions and manage (edit/delete) other users' expressions
- `system:import_connections` - Create, edit, delete, and test import connections to external systems
- `system:import_definitions` - Create, edit, delete import definitions (field mappings, transforms, validation)
- `system:import_execute` - Execute imports manually, trigger dry runs, and manage running imports
- `system:import_history` - View import run history, error details, and data quality metrics
- `system:bulk_update` - Access the admin bulk update wizard, upload templates, apply changes
- `system:change_backup` - Create and view change snapshots
- `system:change_restore` - Restore data from change snapshots
- `system:data_link_config` - Create, edit, delete data links between import datasets
- `system:point_detail_config` - Configure Point Detail panel sections and display settings
- `system:monitor` - View system monitoring dashboard (service health, resource usage, database status, OPC connection status)
- `system:sessions` - View and terminate active user sessions
- `system:backup` - Initiate database backups and manage scheduled backup configuration
- `system:restore` - Restore from backups (requires re-authentication as safety measure)
- `system:export_data` - Export entire database
- `system:import_data` - Import system data (backup/restore operations)
- `system:admin` - Full system administration

> **Expression Sharing Note:** Setting `shared = true` on a saved expression requires Admin role or `system:expression_manage` permission (granted to Analyst, Supervisor, Content Manager, and Maintenance roles). See 23_EXPRESSION_BUILDER.md for full expression lifecycle details.

### Permission Checking

**Backend (API Gateway):**
```rust
// Middleware checks JWT validity and extracts user claims
// Route handler checks specific permission

fn check_permission(user_roles: &[Role], required_permission: &str) -> bool {
    user_roles.iter()
        .flat_map(|role| &role.permissions)
        .any(|perm| perm.name == required_permission)
}

// Example endpoint:
#[get("/api/dashboards")]
async fn list_dashboards(user: AuthUser) -> Result<Json<Vec<Dashboard>>> {
    require_permission(&user, "dashboards:read")?;
    // ... query and return dashboards
}
```

**Frontend:**
```typescript
// Custom hook for permission checking
const hasPermission = (permission: string) => {
  const { user } = useAuthStore();
  return user?.permissions?.includes(permission) ?? false;
};

// Conditional rendering:
{hasPermission('dashboards:write') && (
  <Button onClick={createDashboard}>Create Dashboard</Button>
)}
```

## Input Validation

### API Input Validation

**Validation Rules:**
- All inputs validated before processing
- Use type-safe extractors (Axum)
- Validate: type, format, length, range, enum values
- Return 400 Bad Request with specific error message

**Example Validation:**
```rust
#[derive(Deserialize, Validate)]
struct CreateUserRequest {
    #[validate(length(min = 3, max = 50))]
    username: String,
    
    #[validate(email)]
    email: String,
    
    #[validate(length(min = 8))]
    password: String,
}
```

### SQL Injection Prevention

**Always use parameterized queries with SQLx:**
```rust
// CORRECT:
sqlx::query!("SELECT * FROM users WHERE username = $1", username)
    .fetch_one(&pool)
    .await?;

// NEVER:
sqlx::query(&format!("SELECT * FROM users WHERE username = '{}'", username))
```

### XSS Prevention

**React automatically escapes HTML content.**

**For rich text (WYSIWYG editor):**
- Sanitize HTML on backend before storing
- Use DOMPurify or similar library
- Whitelist safe tags: `<p>, <b>, <i>, <ul>, <li>, <table>, <tr>, <td>`
- Remove: `<script>, <iframe>, <object>, <embed>`

## Data Security

### Database Security

**Connection Security:**
- TLS/SSL for PostgreSQL connections
- Connection string stored in .env (not in git)
- Principle of least privilege: service-specific database users

**Access Control:**
- API Gateway user: Read/write to application tables
- OPC Service user: Read/write to points tables
- Archive Service user: Read/write to aggregates
- Backup user: Read-only for backups

**Encryption at Rest:** (Optional, configured at PostgreSQL level)
- Encrypt database files
- Encrypt backups
- Secure key management

### File Upload Security

**Parser Service File Upload:**
- Maximum file size: 10 MB
- Allowed file types: Check magic numbers (not just extension)
- Scan uploads via YARA-X (BSD-3-Clause) — malware signatures, SVG script injection, XML XXE attacks, ONNX model anomalies. Custom rules for I/O-specific threat patterns
- Store in dedicated directory with restricted permissions
- Random filename generation (prevent directory traversal)

## Network Security

### TLS/HTTPS

**Configuration:**
- TLS 1.3 preferred
- TLS 1.2 minimum
- Strong cipher suites only
- HSTS header: `Strict-Transport-Security: max-age=31536000`

**Certificate Management:**
- Production: Let's Encrypt or corporate CA
- Development: Self-signed certificate (with warning)

### CORS (Cross-Origin Resource Sharing)

**Development:**
- Allow localhost origins for frontend dev server

**Production:**
- Whitelist specific origins (frontend domain)
- No wildcard `*` in production
- Credentials: true (for cookies)

### Rate Limiting

**Protect authentication endpoints:**
- `/api/auth/login`: 5 attempts per minute per IP
- `/api/auth/register`: 3 attempts per hour per IP
- All other endpoints: 1000 requests per minute per user

Rate limiting is a security requirement, not a future enhancement. Implemented in the API Gateway and Auth Service using in-memory sliding window counters.

## Audit Logging

### Audit Trail

**Logged Actions:**
- User login/logout (including visual lock unlock events)
- User creation/modification/deletion
- Role assignment changes (with source: direct, group-inherited, IdP-synced)
- Group role assignment changes (with list of affected users)
- IdP role sync events on login (roles added/removed, source groups)
- IdP role mapping CRUD (create/edit/delete mapping rules)
- Permission changes
- Custom role create/clone/edit/delete
- Settings modifications
- Data category create/edit/assign
- Graphics create/update/delete
- Workspace publish/share
- Dashboard publish
- Report export
- Alert creation, acknowledgment, and escalation
- Alert template create/update/delete
- Alert group and roster create/update/delete
- Alert channel configuration changes
- Email provider configuration changes
- Email test sends
- I/O alarm definition create/update/delete
- Alarm acknowledgment, shelve/unshelve actions
- Round transfer requests and completions
- Report schedule create/update/delete
- Session termination by admin
- Emergency account activation, all actions during emergency session (flagged `is_emergency = true`), deactivation
- Kiosk session creation and termination
- Backup initiation and restore operations
- Site create/edit
- Any sensitive data access

**Audit Log Schema:**
```sql
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    table_name VARCHAR(100),
    record_id UUID,
    changes JSONB, -- before/after state
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Audit Log Retention:**
- Keep indefinitely (regulatory compliance)
- Readonly (no updates/deletes)
- Regular backups

### Sensitive Data

**Never Log:**
- Passwords (plain or hashed)
- JWT tokens (full token)
- API keys
- Session secrets

**Log with Caution:**
- User IP addresses (GDPR consideration)
- Email addresses (PII)
- Full request bodies (may contain sensitive data)

## Security Best Practices

### Development

1. **Never commit secrets to git**
   - Use .env files (gitignored)
   - Use environment variables
   - Master key file for at-rest encryption (see below)

### Secrets Management

**Master Key — systemd Encrypted Credentials:**
- On first install, `io-ctl generate-master-key` creates a cryptographically random 256-bit key, then encrypts it using `systemd-creds encrypt` and stores the encrypted blob at `/etc/io/creds/master-key.enc`
- The plaintext key is never stored on disk — only the encrypted credential exists at rest
- Each I/O service unit file includes `LoadCredentialEncrypted=master-key:/etc/io/creds/master-key.enc`
- At service start, systemd decrypts the credential into a tmpfs and exposes it at `$CREDENTIALS_DIRECTORY/master-key`
- When the service stops, the tmpfs is unmounted — decrypted key material is gone

**Protection tiers (automatic, based on hardware):**

| Hardware | Protection | Disk theft recovery |
|----------|-----------|-------------------|
| TPM2 present | Key sealed to TPM2 PCRs + host key | Impossible — key is bound to this specific TPM chip |
| No TPM2 | Encrypted with host key (`/var/lib/systemd/credential.secret`, root-only 0600) | Requires root on the same machine — encrypted blob is useless on a different host |

**Requirements:** systemd 250+ (Ubuntu 22.04+, RHEL 9+, Debian 12+ — all target platforms)

**At-Rest Encryption (`io-auth` crate):**
- All secrets stored in PostgreSQL JSONB fields (OPC passwords, import connection credentials, SMTP credentials, MFA TOTP secrets, DNS API keys) are encrypted at the application layer before writing
- Algorithm: AES-256-GCM with a random 96-bit nonce per encryption operation
- Storage format: base64-encoded `nonce || ciphertext || tag`
- On read, `io-auth` decrypts transparently — calling code never handles encrypted bytes directly
- Encryption happens in the service that owns the data (not at the database layer)

**Key Rotation:**
- `io-ctl rotate-master-key` decrypts the current key from systemd credentials, generates a new key, re-encrypts all stored secrets in a single database transaction, then re-encrypts and writes the new credential blob via `systemd-creds encrypt`
- Services must be restarted to pick up the new credential (systemd reloads the encrypted credential on service start)
- Rotation is logged in the audit trail

**Required Environment Variables:**

| Variable | Required | Description |
|----------|----------|-------------|
| `IO_SERVICE_SECRET` | Yes | Inter-service authentication Bearer token |
| `IO_JWT_SECRET` | Yes | JWT HMAC-SHA256 signing key |
| `IO_DATABASE_URL` | Yes | PostgreSQL connection string |

*Note: `IO_MASTER_KEY_FILE` is no longer used. The master key is delivered via systemd's `$CREDENTIALS_DIRECTORY` mechanism.*

**Future (post-v1):** HashiCorp Vault, HSM, or external KMS can be added as alternative key providers in `io-auth` without changing the encryption format or stored data. These are relevant for multi-server Enterprise HA deployments where a centralized secrets store is preferred over per-machine systemd credentials.

2. **Keep dependencies updated**
   - Regular `cargo update` and `pnpm update`
   - Monitor security advisories
   - Use `cargo audit` for known vulnerabilities

3. **Code review for security**
   - Review all auth/permission changes
   - Review SQL queries (injection prevention)
   - Review file upload handling

### Deployment

1. **Secure server**
   - Minimal installed packages
   - Firewall configured (ufw or firewalld)
   - SSH key authentication only (no password)
   - Regular OS updates

2. **Secure PostgreSQL**
   - Listen on localhost only (or private network)
   - Strong password for database users
   - Regular backups
   - Encrypted backups

3. **Secure nginx**
   - TLS 1.3 only in production
   - Security headers (HSTS, CSP, X-Frame-Options)
   - Hide server version
   - Request size limits

4. **Monitoring**
   - Failed login attempts
   - Permission denied errors
   - Unusual activity patterns
   - Database connection errors

## Compliance

### Regulatory Requirements

**Audit Trail:**
- 7-year retention of operational logs
- Immutable audit log
- Exportable for audits

**Access Control:**
- Role-based permissions
- Principle of least privilege
- Regular access reviews

**Data Retention:**
- Configurable retention policies
- Automated archival
- Secure deletion procedures

## Change Log

- **v2.3**: Added `sms:configure` permission (SMS System, 1 permission). SMS Providers moved from Authentication to Notifications group in Settings nav. Total permissions 118 → 119. Default: Admin only (SMS costs money and is more operationally impactful than email).
- **v2.2**: Renamed `io-crypto` crate references to `io-auth` (3 locations). Crypto functionality (AES-256-GCM encrypt/decrypt, master key handling) is consolidated into the `io-auth` crate per doc 01 v2.1.
- **v2.1**: Replaced file-based master key (`IO_MASTER_KEY_FILE`) with systemd encrypted credentials (`LoadCredentialEncrypted`). Master key encrypted at rest via TPM2 (if available) or host key. Plaintext key never on disk. Removed `IO_MASTER_KEY_FILE` env var — key delivered via `$CREDENTIALS_DIRECTORY`. Updated key rotation to re-encrypt credential blob. Vault/HSM/KMS remains deferred for Enterprise HA multi-server deployments.
- **v2.0**: Fixed stale permission count in header: 114 → 118. Count was not updated when Forensics and System permissions were added in v1.7-v1.8. Fixed sidebar visibility permission for Alerts module: `alerts_module:access` → `alerts:read` (namespace was merged in v1.5, cross-ref in doc 06 was stale).
- **v1.9**: Replaced `DISPLAY_SESSION_MAX_HOURS` hard timeout with silent background refresh during visual lock (every 30 min, checks account status, updates permissions). No hard session ceiling for interactive sessions — refresh token expiry (7 days) is the natural outer bound. Kiosk sessions upgraded to non-expiring refresh tokens with persistent cookies (survives reboots), optional IP restriction, remote admin termination. Removed 365-day kiosk token — kiosk tokens now have no TTL.
- **v1.8**: Added 2 Forensics permissions: `forensics:write` (create/edit/close own investigations) and `forensics:share` (share investigations with other users/roles). Forensics permissions 5 → 7. Total permissions 116 → 118. Updated permission descriptions for existing forensics permissions to reflect investigation model. See doc 12.
- **v1.7**: Added 2 System permissions: `system:data_link_config` (manage data links between import datasets) and `system:point_detail_config` (configure Point Detail panel). System permissions 25 → 27. Total permissions 114 → 116. See docs 24 and 32.
- **v1.6**: Added Secrets Management section. Master encryption key (`IO_MASTER_KEY_FILE`) loaded from file, generated via `io-ctl generate-master-key`. AES-256-GCM at-rest encryption via `io-crypto` crate (nonce || ciphertext || tag format). Key rotation via `io-ctl rotate-master-key` with zero-downtime lazy reload. Required environment variables table (4 vars). Vault/HSM/KMS deferred to post-v1.
- **v1.5**: Deep dive: Replaced 3-role hierarchy (User/Power User/Admin) with 8 predefined roles (Viewer, Operator, Analyst, Supervisor, Content Manager, Maintenance, Contractor, Admin). All roles get personal Designer/Dashboard/Report creation; publish/share requires Content Manager, Supervisor, Analyst, or Admin. Added groups with role assignment (`group_roles` junction table, Grafana/Azure AD pattern). Added data categories (9 predefined: Process, Event, Access Control, Personnel, Financial, Maintenance, Ticketing, Environmental, General) assigned at connection configuration time. Added multi-site scoping (`sites` table, site-scoped roles via `site_id` on `user_roles`). Added Visual Lock (hidden-until-interaction idle lock with per-role timeouts, live data continues flowing). Added Kiosk session mode (no timeout, hidden navigation with hover-to-reveal, Console/Process only, authenticated interactive layer for writes). Concurrent sessions capped at 3 per user (SharedWorker = multi-tab = 1 session). Added break-glass emergency access (2 pre-created accounts, split password two-person rule, `io-ctl emergency` CLI, `is_emergency_account` flag). Added IdP role mapping via dedicated `idp_role_mappings` table with exact/prefix/regex matching, site-aware scoping, and 7 deterministic conflict resolution rules. Merged `alerts:*` and `alerts_module:*` into single `alerts:*` namespace (13 → 8 permissions). Permission count 119 → 114, modules 16 → 15 (merged 2 alert sections into 1). Added audit logging for IdP sync events, group role changes, emergency account usage, data category changes, kiosk sessions, site management.
- **v1.4**: Added Events Module (5 new permissions: `events:read`, `events:manage`, `events:acknowledge`, `events:shelve`, `events:admin`). Added `forensics:correlate` to Forensics (4→5). Restructured Log Module: renamed `log:template_write` → `log:template_manage`, added `log:schedule_manage` (6→7). Restructured Rounds Module: renamed `rounds:write` → `rounds:execute`, `rounds:template_write` → `rounds:template_manage`, replaced `rounds:assign` with `rounds:schedule_manage`, added `rounds:transfer`, removed `rounds:delete` (absorbed into `rounds:admin`) (6→7). Added `reports:generate` and `reports:schedule_manage` to Reports (5→7). Added `system:monitor` and `system:sessions` to System (23→25). Permission count 102 → 119, modules 14 → 15. Updated role hierarchy descriptions. Added audit logging entries for alarm actions, round transfers, report schedules, session termination, backup/restore.
- **v1.3**: Added Shifts Module (8 permissions: `shifts:read`, `shifts:write`, `presence:read`, `presence:manage`, `muster:manage`, `badge_config:manage`, `alert_groups:read`, `alert_groups:write`) and Alerts Module (7 permissions: `alerts_module:access`, `alerts_module:send`, `alerts_module:send_emergency`, `alerts_module:manage_templates`, `alerts_module:manage_groups`, `alerts_module:view_history`, `alerts_module:muster`). Permission count 87 → 102, modules 12 → 14. See docs 30 and 31.
- **v1.2**: Promoted Rate Limiting from future to required (initial deployment). Promoted Password Reset from future to required with Email Service integration (doc 28) and full flow spec (doc 29). Replaced ClamAV with YARA-X (BSD-3-Clause) for file upload scanning.
- **v1.1**: Added 3 authentication permissions (`auth:configure`, `auth:manage_mfa`, `auth:manage_api_keys`). Permission count 84 → 87, modules 11 → 12. Updated Admin role hierarchy with auth capabilities. Added reference to 29_AUTHENTICATION.md for full auth specification.
- **v1.0**: Added Alert System (6 permissions: `alerts:read`, `alerts:acknowledge`, `alerts:create`, `alerts:manage_templates`, `alerts:manage_rosters`, `alerts:configure`) and Email System (4 permissions: `email:configure`, `email:manage_templates`, `email:send_test`, `email:view_logs`). Total permissions: 74 → 84, modules: 9 → 11. Updated role hierarchy descriptions with alert and email capabilities. Added alert and email actions to audit logging. See 27_ALERT_SERVICE.md and 28_EMAIL_SERVICE.md.
- **v0.9**: Updated `designer:import` permission description from "P&ID recognition" to "symbol recognition (P&ID and DCS)" to reflect dual-domain scope in doc 26.
- **v0.8**: Added `designer:import` permission (import files and run P&ID recognition). Designer permissions 6 → 7. Total permissions 73 → 74. Fixed audit_log inline DDL: added `DEFAULT gen_random_uuid()` on PK, renamed `timestamp` column to `created_at`. Fixed "ReToken" terminology throughout to "refresh token". See 26_PID_RECOGNITION.md for import context.
- **v0.7**: Added multi-window authentication note — detached window auth via shared refresh token cookie and BroadcastChannel token sync. No server-side session model changes required. See doc 06 for full multi-window architecture.
- **v0.6**: Added 10 Export System permissions. 7 module-level export: `console:export`, `process:export`, `designer:export`, `dashboards:export`, `log:export`, `rounds:export`, `settings:export`. 3 system-level: `system:bulk_update`, `system:change_backup`, `system:change_restore`. Module permission counts updated (Console 6→7, Process 5→6, Designer 5→6, Dashboards 5→6, Log 5→6, Rounds 5→6, Settings 3→4, System 20→23). Total permissions: 63 → 73. See 25_EXPORT_SYSTEM.md.
- **v0.5**: Added 4 Universal Import permissions: `system:import_connections`, `system:import_definitions`, `system:import_execute`, `system:import_history`. Total permissions: 59 → 63. Clarified existing `system:import_data` description as backup/restore operations (distinct from Universal Import). Updated System permissions count from 16 to 20. See 24_UNIVERSAL_IMPORT.md.
- **v0.4**: Added missing Process Module permissions section (5 permissions: read, write, publish, delete, admin). Listed count now matches stated total of 59. Fixed `system:expression_manage` description to clarify it governs sharing and admin operations on other users' expressions (expression creation is open to all authenticated users). Updated Expression Sharing Note to reference `system:expression_manage` instead of `system:point_config`.
- **v0.3**: Added `system:expression_manage` permission for Expression Builder (create, edit, delete, share saved expressions). Total permissions: 58 → 59.
- **v0.2**: Added `system:source_config`, `system:point_config`, and `system:point_deactivate` permissions for multi-source management and point lifecycle control. Updated permission count from 55 to 58.

---

**Next Steps:** Review database design document for complete schema and relationships.
