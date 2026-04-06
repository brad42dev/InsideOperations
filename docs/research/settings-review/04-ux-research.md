# Settings UX Research

Research compiled for the Inside/Operations Settings module overhaul. The current module has ~28 flat, ungrouped nav items, no user/admin separation, and several thin pages that exist as single-concern stubs.

---

## Navigation & IA Patterns

### The Core Problem: Flat Lists Don't Scale

A flat sidebar of 20-40 items forces users to scan the entire list to find anything. Cognitive load compounds because every item is visually equal. Nielsen Norman Group research on sidebar navigation identifies five items as the effective maximum at any single level before scan-and-recall degrades. Beyond that, grouping is not optional — it is required for usability.

### How Leading Products Handle This

**Grafana (open-source monitoring)**

Grafana uses a three-tier information architecture enforced by its design system ("Saga"):

- Tier 1: Left sidebar icons — module-level navigation (Dashboards, Alerting, Administration, etc.)
- Tier 2: Sidebar expansion — section headers with grouped child items
- Tier 3: Within-page tabs for deeply nested content

The Administration section is deliberately separate from the app's operational sections. Within Administration, items are grouped: General, Users, Teams, Plugins, Access Control. User preferences (theme, home dashboard, timezone) live in a separate "Profile" page accessed via the user avatar — not inside Administration.

References: [Grafana Administration docs](https://grafana.com/docs/grafana/latest/administration/), [Grafana roles and permissions](https://grafana.com/docs/grafana/latest/administration/roles-and-permissions/), [Grafana navigation design system](https://grafana.com/developers/saga/patterns/navigation/)

**Ignition SCADA (Inductive Automation)**

The gold standard for industrial settings IA. Ignition's Gateway web interface uses a strict functional group structure under the "Config" section:

```
System
  Overview · Backup/Restore · Licensing · Modules · Projects · Gateway Settings

Networking
  Web Server · Gateway Network · Email Settings

Security
  General · Auditing · Users and Roles · Service Security ·
  Identity Providers · OAuth2 Clients · Security Levels · Security Zones

Databases
  Connections · Drivers · Store and Forward

Alarming
  General · Journal · Notification · On-Call Rosters · Schedules

Tags
  History · Realtime

OPC Client
  OPC Connections · Quick Client

OPC UA
  Device Connections · Security · Server Settings
```

Key observation: every item belongs to a named group. No item floats alone. Related sub-items within a group are accessed as sub-pages within that section, not as top-level sidebar entries.

References: [Ignition Config docs](https://www.docs.inductiveautomation.com/docs/8.1/platform/gateway/config), [NFM Consulting Ignition gateway guide](https://nfmconsulting.com/knowledge/ignition-scada-gateway-configuration/)

**Datadog (observability/monitoring)**

Datadog separates settings into two clear contexts:

1. **Organization Settings** — accessed from the account avatar at the bottom of the left nav. Contains: Users, Teams, RBAC, API Keys, Client Tokens, Authentication (Login Methods), Safety Center, Preferences. Only Admins reach this.
2. **Personal Settings** — a separate "Account" section reached via the same avatar. Contains personal profile, notification preferences, security.

Datadog places admin settings at the *bottom* of the sidebar, not the top. The pattern reinforces that settings are utility functions, not primary workflows.

References: [Datadog Account Management](https://docs.datadoghq.com/account_management/), [Datadog Organization Settings](https://docs.datadoghq.com/account_management/org_settings/), [Datadog navigation redesign](https://www.datadoghq.com/blog/datadog-navigation-redesign/)

**PagerDuty (incident management)**

PagerDuty uses a strict two-entry model:

- **My Profile** (user icon → My Profile): contact information, notification rules, login settings, MFA, linked accounts
- **Account Settings** (user icon → Account Settings): company name, timezone, SSO, tagging, incident settings, mobile security, billing — admin-only

The Account Settings page uses a tabbed layout with distinct tabs for each concern (Subscription, Account, SSO, Incident Settings, etc.). Users never encounter admin settings unless they have the Account Owner role.

References: [PagerDuty User Profile](https://support.pagerduty.com/main/docs/user-profile), [PagerDuty Account Settings](https://support.pagerduty.com/main/docs/account-settings)

**Stripe (payments platform)**

Stripe's Settings are split into three explicit categories presented in the sidebar:

- **Personal** — profile, password, communication preferences, active sessions
- **Account** — business details, payouts, domains, legal entity, account health
- **Product** — PCI compliance, document storage

Stripe uses short group headers to label each section. The three-category split makes the user/business/product distinction immediately legible without reading any item label.

References: [Stripe Dashboard basics](https://docs.stripe.com/dashboard/basics)

**GitHub Settings**

GitHub recently upgraded their Settings pages to use the Primer `NavigationList` component, which groups similar settings pages into labeled sections. The result is a two-level sidebar where section headers are non-interactive group labels and items within each section are links. This change shipped as an explicit improvement to information architecture and discoverability.

References: [GitHub Global Navigation Optimizations](https://github.blog/changelog/2024-06-26-global-navigation-optimizations/)

### Navigation Structure Patterns: When to Use What

| Pattern | Best for | Avoid when |
|---------|----------|------------|
| Flat left sidebar | <10 items, single level | >12 items — cognitive overload |
| Grouped sidebar with section headers | 15–40 items, 5–8 natural groups | Groups have only 1-2 items each |
| Two-level sidebar (expand/collapse) | Deep hierarchies, module-scoped settings | Users need to cross groups frequently |
| Top tabs | 3–6 peer sections on one object | Sections have very different scope |
| Breadcrumb drill-down | Complex hierarchies with many leaves | Users need to compare across levels |
| Global search within settings | >30 items or power-user audience | First-time users need discoverability |

**Recommendation from PatternFly (Red Hat's enterprise design system):** Use grouped vertical navigation when you have 5+ primary items. Don't mix flyouts, drilldowns, and expansion at the same hierarchy level. Secondary horizontal navigation (tabs) is appropriate *within* a settings page, not as a replacement for the sidebar. Anything beyond two nav levels should use tabs or inline headings inside page content.

References: [PatternFly Navigation design guidelines](https://www.patternfly.org/components/navigation/design-guidelines/)

### Settings Search

For modules with 20+ items, a search/filter input at the top of the sidebar is a known pattern (used by VS Code settings, macOS System Preferences, Windows Settings). It is especially valuable for:
- Power users who know what they want but not where it lives
- New admins exploring unfamiliar settings
- Finding items after reorganization

The search does not replace grouping — it supplements it.

---

## User Profile vs Admin Settings — Standard Split

This is one of the most commonly mishandled areas in admin panel design. The split is not about access level alone — it is about *scope of effect*. A setting belongs in "My Profile/Account" when it affects only the current user. It belongs in "System Settings" when it affects all users or the system as a whole.

### Definitive Classification

**Per-User (My Profile / Account / Personal Settings)**

These items change only for the logged-in user. No admin permission required.

| Item | Rationale |
|------|-----------|
| Display name, email | Personal identity |
| Avatar / profile photo | Personal identity |
| Password change | Own credentials only |
| MFA enrollment (TOTP, hardware key, backup codes) | User's own auth factors |
| Personal API tokens | Tokens scoped to the user's identity |
| Active sessions (own only) | User's own devices |
| Notification preferences | How this user is notified |
| Display language / locale | Per-user rendering preference |
| Timezone | Per-user time display |
| Theme (light/dark/system) | Per-user visual preference |
| Accessibility options | Per-user rendering |
| Home/default dashboard | Per-user start page |

**Admin-Only (System Settings)**

These items affect all users or require elevated privilege.

| Item | Rationale |
|------|-----------|
| System-wide MFA policy (require MFA, grace periods) | Affects all users |
| Auth providers (LDAP, OIDC, SAML configuration) | Controls how everyone logs in |
| SCIM provisioning tokens | Controls directory sync |
| User management (create, suspend, assign roles) | Affects other users |
| Role definitions and permissions | Affects all users |
| Group management | Affects other users |
| All user sessions (view/revoke any) | Affects other users |
| OPC source connections | System-wide data pipeline |
| Archive and retention policies | Affects all historical data |
| Certificates (TLS, OPC UA) | System-wide security |
| Email server (SMTP) configuration | System-wide delivery |
| SMS providers | System-wide delivery |
| Alert / event configuration | System-wide behavior |
| System health monitoring | System-wide observability |
| Backup and restore | System-wide state |
| Export presets | Can be shared org-wide |
| SCIM tokens | Controls directory sync |
| EULA management | System-wide legal |
| Recognition service config | System-wide AI/ML |
| Import connectors | System-wide data ingestion |
| Bulk update tools | System-wide data changes |
| Change snapshots | System-wide audit trail |
| Report scheduling | System-wide report generation |
| Expression library | Shared org-wide formulas |
| Security settings (session policy, IP allowlists) | System-wide security posture |
| About / version information | Informational |

### The "API Keys" Edge Case

API keys are genuinely split:
- **Personal API keys** (scoped to user identity) → My Profile
- **Service/machine API keys** (scoped to the system or a service account) → System Settings → Integrations

Both Datadog and Stripe handle this: Datadog exposes API keys in Organization Settings (admin) and Client Tokens as a related but separate concept; Stripe Personal settings include only the current user's API access.

For I/O: `ApiKeys.tsx` currently lives in Settings alongside system settings. It likely mixes personal tokens and service tokens. These should be separated at the data model level and surfaced in the appropriate location.

### How Products Implement the Split

| Product | Per-User Entry | Admin Entry |
|---------|---------------|-------------|
| Grafana | User avatar → Profile | Administration section (separate nav tier) |
| PagerDuty | User icon → My Profile | User icon → Account Settings |
| Datadog | Account avatar → Personal Settings | Account avatar → Organization Settings |
| Stripe | Settings → Personal section | Settings → Account section |
| Okta | Top bar avatar → personal page | Left nav Administration section |
| GitHub | Top-right avatar → Settings | Organization → Settings (separate URL) |

The consistent pattern: per-user settings are accessed through the user avatar/profile icon, not through the main settings navigation. Admin settings are the primary destination of the Settings module.

---

## Consolidation Patterns

### When to Merge Thin Pages into Tabs

A "thin page" is one that has fewer than ~5 meaningful configuration fields. Standalone thin pages waste navigation real estate and force users to make separate route decisions for closely related concerns.

**NN/G's criteria for using tabs (from the authoritative "Tabs, Used Right" article):**

1. Content has a clear, distinct grouping
2. Only a small number of tabs are needed (ideally 3–6)
3. Users don't need to simultaneously view information from multiple tabs
4. Each tab label is concise (1–2 words)

References: [NN/G Tabs, Used Right](https://www.nngroup.com/articles/tabs-used-right/)

**Industrial/enterprise practice:** Group the configuration object first, then use tabs for sub-aspects of that object. Example from Ignition:

```
OPC UA
  ├── Device Connections     (separate page — list of devices)
  ├── Security               (tab-level within OPC UA section)
  └── Server Settings        (tab-level within OPC UA section)
```

### Consolidation Decision Framework

Merge pages into tabs when:
- They share a common **object** (same data domain, e.g., "OPC configuration")
- Their settings are edited in separate sessions (not simultaneously)
- The total field count per tab fits on one screen without scrolling
- The pages are always navigated in a cluster (users visiting one typically visit the other)

Keep as separate pages when:
- They serve meaningfully different RBAC roles (e.g., only a super-admin ever touches SCIM)
- One page is very heavy (e.g., Users list with pagination) and one is very thin
- They have substantially different visual structure (list vs. form)

### Specific Consolidation Opportunities for I/O

The current I/O module has these natural consolidation candidates:

**Authentication cluster** — `AuthProviders`, `MfaSettings`, `Security`, `ScimTokens`
These all concern how users authenticate and are provisioned. A single "Authentication" section with tabs: `Login Methods | MFA Policy | Security | SCIM` would reduce four nav items to one.

**OPC cluster** — `OpcSources`, `OpcConfig`
These are two facets of the same data source system. Merge into a single "OPC Data Sources" page with `Sources | Configuration` tabs.

**Import/Export cluster** — `Import`, `StreamingSessions`, `ExportPresets`, `BulkUpdate`, `Snapshots`
Import and streaming sessions are operationally linked. Export presets, bulk update, and snapshots relate to the export/change pipeline. Consider: `Data Management` section with sub-pages (not necessarily tabs, since these differ in scope).

**Users/Access cluster** — `Users`, `Roles`, `Groups`, `Sessions` (admin sessions, not personal sessions)
These four items are all user access management. Ignition puts them all under "Security → Users and Roles". Datadog groups them under "Users, Teams, RBAC". A "Users & Access" section with these as sub-pages is the standard pattern.

**Notifications cluster** — `Email`, `SmsProviders`
Both concern outbound notification delivery. Can be merged into "Notifications" with `Email | SMS` tabs.

---

## Wide-Screen Layout Solutions

### The Problem

At >1400px, a settings page with a 200px left sidebar and a single-column form occupies roughly 14% of screen width with meaningful content. This looks broken and feels amateur.

### Standard Approaches

**1. Max-width content container**

The most widely-used pattern. The sidebar is full-height, but the content area caps at a max-width (typically 720px–960px for forms, up to 1200px for list views). The content floats left with padding, not centered.

The left-aligned float (rather than centering) is intentional: in admin tools, the sidebar is always visible on the left, so centering content would create asymmetric whitespace. Left-aligned content at a max-width reads as a natural extension of the sidebar column.

Common values:
- Forms with simple fields: `max-width: 720px`
- Forms with two-column layouts: `max-width: 960px`
- List views (users, sessions, certificates): `max-width: 1100px`
- Dashboard-style overview pages: `max-width: 1400px` or uncapped

References: [Website Dimensions Guide 2026](https://webhelpagency.com/blog/website-dimensions/)

**2. Two-column form layout**

Technical settings forms benefit from two-column layout on wide screens because:
- Fields are short (URLs, ports, timeout values) and feel spaced-out in single-column
- Related field pairs (host/port, username/password, min/max) visually group naturally in two columns

Baymard Institute and NN/G both warn against two-column forms for checkout/consumer flows where Z-scanning causes confusion. However, these warnings do not apply to technical admin forms where:
- All fields are equally important (no "primary path")
- Fields are logically grouped in pairs by the admin's mental model
- Users are technical and form-literate

**Appropriate candidates for two-column layout:**
- OPC UA server connection (endpoint URL + port, security mode + certificate, subscription rate + batch size)
- Email server configuration (SMTP host + port, auth method + credentials)
- Archive retention (raw retention days + compressed retention days per tier)

**Single-column is still preferred for:**
- Long text fields (descriptions, certificates)
- Fields with complex validation feedback
- Wizard-style step flows

References: [PatternFly form layout patterns](https://www.patternfly.org/), [Baymard multi-column forms](https://baymard.com/blog/avoid-multi-column-forms)

**3. Sidebar + detail split within settings**

For list-heavy settings pages (Users, Certificates, OPC Sources), use a **list-detail split** within the content area:
- Left panel: scrollable list of items
- Right panel: form/detail view for the selected item

This uses the full width effectively and is standard for enterprise admin panels (macOS System Preferences uses it, most email clients use it for account settings). At narrow widths, the list covers full width and the detail is a modal or navigation push.

**4. Section cards vs. flat forms**

Grouping settings into visually distinct cards (with card headers and borders) rather than one infinite-scroll form accomplishes two things:
- Creates visual anchors for scanning
- Allows different cards to have different column counts (a two-column card for connection settings next to a single-column card for security options)

This pattern is used by Grafana's datasource configuration pages, AWS Console service settings, and Azure Portal resource settings.

---

## Industrial/OT-Specific Patterns

### OPC UA Server Configuration UI

From research into industrial tools (Kepware, Ignition, N3uron, Unified Automation):

**Required fields for an OPC UA server entry:**
- Display name (internal label)
- Endpoint URL (`opc.tcp://host:port/path`)
- Security mode: None / Sign / Sign & Encrypt
- Security policy: Basic256Sha256 / Basic256 / Aes128Sha256RsaOaep / etc.
- Certificate trust decision: Auto-accept / Manual review
- Session timeout
- Subscription rate

**Trust list management** is a recurring UX challenge. The workflow is:
1. Add server → attempt connection
2. Server presents its certificate
3. Admin must explicitly trust or reject the certificate
4. Trusted certs appear in a "Trust List" tab

UI pattern: show certificate status inline in the server list as a colored badge (Trusted / Untrusted / Expired / Error). The trust action is a primary button on the detail view, not buried in a submenu.

**Certificate expiry warnings** must be prominent and actionable. Standard pattern (used by Cloudflare, cert-manager, Azure IoT Operations):
- Banner or badge on the Certificates page showing days until expiry for any cert expiring within 30 days
- Color coding: green (>30 days) → yellow (7–30 days) → red (<7 days / expired)
- Each cert row shows expiry date; sort by expiry date ascending by default so the soonest-to-expire appears first
- "Renew" or "Replace" action directly accessible from the row (not requiring a drill-down)

References: [OPC UA certificate management Kepware](https://softwaretoolbox.com/top-server/opc-ua-configuration-settings), [OPC UA certificate infrastructure Azure IoT](https://learn.microsoft.com/en-us/azure/iot-operations/discover-manage-assets/howto-configure-opc-ua-certificates-infrastructure), [Certificate management best practices CyberArk](https://www.cyberark.com/resources/blog/certificate-management-best-practices)

### Archive / Retention Settings UX

TimescaleDB-backed systems (like I/O's archive service) expose compression and retention as a tiered policy:

| Tier | Hot (raw) | Warm (compressed) | Cold (archived/dropped) |
|------|-----------|-------------------|-------------------------|
| What | Full resolution | Compressed chunks | Deleted or exported |
| Config | — | Compress after N days | Drop after N days |

**Best practice for UI:**
- Present the tiers as a visual pipeline (left-to-right or top-to-bottom flow diagram), not as a raw form with six integer fields
- Show estimated storage impact per tier based on current data volume
- Validate that warm cutoff < cold cutoff (obvious but frequently missing)
- Provide a "current storage usage" summary card above the form (answers "is this working?")
- Warn before reducing retention periods ("This will delete data older than X. Confirm?")

Reference: [Azure data lifecycle management](https://learn.microsoft.com/en-us/purview/retention)

### Certificate Management UI

Pattern from Azure IoT Operations, Cloudflare, ServiceNow:

**List view columns:** Name · Type · Subject/CN · Expiry Date · Status (valid/expiring/expired) · Actions

**Certificate import workflow:**
1. Upload PEM/PFX file (drag-and-drop target)
2. Parse and display preview: CN, SANs, issuer, validity range, key type
3. Confirm / assign purpose (TLS server, OPC UA client, etc.)

**Automated renewal integration:**
- If using ACME (Let's Encrypt / internal CA), show "Auto-renew: ON/OFF" toggle per certificate
- Show last renewal attempt date and status

### Health Monitoring Within Admin

The Ignition Gateway Status page is the canonical example: it shows a real-time overview of the system's operational health on the first page you see when entering configuration mode.

**Standard layout for industrial system health page:**

```
[Service Status Cards]  — each backend service: UP/DOWN/DEGRADED, latency
[OPC Connection Status] — per-source: connected, error, last data time
[Database Status]       — TimescaleDB: connection pool, disk usage, oldest data
[Queue Depths]          — broker queues, pending subscriptions
[Recent Errors]         — last N errors with timestamp and service name
```

**UX patterns:**
- Status uses a three-state indicator: green/yellow/red — not traffic lights, use icons + color for accessibility
- Latency metrics: show as a sparkline or the last 5-minute average, not just current value
- Link each status card directly to the relevant settings page (clicking "OPC Service: ERROR" links to OPC Sources)
- Auto-refresh every 10–30 seconds; show "Last updated N seconds ago"
- Do not use this page for alerting — it's informational; alerts go through the alert system

References: [Health endpoint monitoring pattern Azure](https://learn.microsoft.com/en-us/azure/architecture/patterns/health-endpoint-monitoring), [Salesforce READS service health metrics](https://engineering.salesforce.com/reads-service-health-metrics-1bfa99033adc/)

---

## Recommended Approach for I/O

### Navigation Architecture

Replace the current 28-item flat list with a grouped two-level sidebar. Section headers are non-interactive labels. Items within sections are links. Maximum 5–6 items per section.

**Proposed group structure:**

```
MY ACCOUNT (per-user, visible to all)
  Profile
  Security (password, MFA enrollment, active sessions)
  API Tokens
  Preferences (theme, timezone, language)

USERS & ACCESS (admin)
  Users
  Roles
  Groups
  Sessions (all users)

AUTHENTICATION (admin)
  Login Methods (auth providers / LDAP/OIDC/SAML)
  MFA Policy
  SCIM Provisioning
  Security Policy (session lengths, IP restrictions)

DATA SOURCES (admin)
  OPC Sources       → tabs: Sources | Connection Settings
  Point Management

NOTIFICATIONS (admin)
  Email             → tabs: SMTP | Templates
  SMS Providers

DATA MANAGEMENT (admin)
  Archive & Retention
  Backup & Restore
  Import Connectors → tabs: Connectors | Streaming Sessions
  Export Presets
  Change Snapshots

CONTENT & FEATURES (admin)
  Expression Library
  Report Scheduling
  Bulk Update
  Recognition

SYSTEM (admin)
  Health
  Certificates
  EULA
  About
```

This reduces 28 flat items to 8 section groups with a maximum of 5 items each. The "MY ACCOUNT" section enables full separation of per-user settings from admin settings without requiring a separate URL context.

### Layout

- Settings shell: fixed 220px sidebar, content area with `max-width: 960px` for forms, `max-width: 1200px` for list views
- List-detail split for Users, Certificates, OPC Sources, Sessions
- Two-column form layout for OPC connection details, email server configuration, archive tier settings
- Section cards with headers to break up long configuration forms

### Key Implementation Notes

1. **RBAC enforcement at the nav level**: hide sections the current user cannot access (non-admins see only MY ACCOUNT). Do not show grayed-out items for admin sections to non-admins — hide them entirely.

2. **OPC Sources + Trust List**: the trust list workflow (certificate review) belongs as a tab within OPC Sources, not as a separate page or buried in Certificates. Certificates (page) = TLS/server certs. OPC trust list = within OPC Sources.

3. **Sessions split**: admin "Sessions" (view/revoke all users) in Users & Access. Personal "Sessions" (own devices) in My Account → Security. These are currently one page (`Sessions.tsx`) serving both purposes — separate them.

4. **Health page as entry point**: consider making the System Health page the default landing when entering Settings. This matches Ignition's "Status" overview pattern and immediately answers "is everything working?" before an admin starts changing anything.

5. **API Keys**: determine whether these are personal tokens or service tokens. Personal → My Account. Service/machine → Data Sources or a new Integrations section.

6. **Search bar**: add a filter/search input at the top of the sidebar that filters nav items by label. Given 28+ items across 8 groups, even after consolidation this meaningfully helps power users.
