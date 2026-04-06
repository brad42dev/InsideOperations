# Settings Module — Code Audit

## Executive Summary

1. **Eight routed pages are missing from the nav.** `Display`, `SystemHealth`, `PointManagement`, `EventConfig`, `AlertConfig`, `Badges`, `DataSources`, and `OpcConfig` all exist as routes in App.tsx but are absent from `SUB_NAV` in `index.tsx`. `SystemHealth` and `PointManagement` are fully-functional, production-quality pages that users simply cannot discover.

2. **`Health.tsx` and `SystemHealth.tsx` are duplicates — wrong one is in the nav.** The nav labels "System Health" and links to `/settings/health` which renders the thin `Health.tsx` (simple status cards). The real system health dashboard is `SystemHealth.tsx` at `/settings/system-health` with 6 tabs of metrics — not in the nav.

3. **`Appearance.tsx` and `Display.tsx` both implement theme selection.** `Display.tsx` (not in nav) is the correct, comprehensive page (theme + density + date/time format). `Appearance.tsx` (in nav) covers only theme with a different UI. One must be deleted.

4. **`Security.tsx` is a broken aggregation.** It embeds `MfaSettings`, `ApiKeys`, `ScimTokens`, and `SmsProviders` as inline sections under `system:configure` permission. Personal API key management and personal MFA enrollment are user-profile concerns gated behind an admin permission. All four components also have independent routes, so content is duplicated.

5. **Five pages are pure stubs with no operational value:** `DataSources.tsx` (19 lines), `OpcConfig.tsx` (10 lines), `UserDetail.tsx` (12 lines), and the deferred-informational pages `EventConfig.tsx` and `Badges.tsx`. These stubs create click targets that appear functional but deliver nothing.

6. **Hardcoded hex/rgba color values appear in at least 8 files.** `Certificates.tsx`, `SystemHealth.tsx`, `MfaSettings.tsx`, `ArchiveSettings.tsx`, `BackupRestore.tsx`, `EventConfig.tsx`, `StreamingSessions.tsx`, and `Snapshots.tsx` all use hardcoded color values where CSS custom properties should be used. These will render incorrectly under theme switching.

7. **26 flat unfiltered nav items with no grouping.** The sidebar renders all 26 items regardless of user permission. An operator with no admin rights sees "Archive", "Certificates", "Bulk Update" etc. in their nav and is denied only upon clicking. The nav also has no section headers, icons, or hierarchy.

---

## Route Coverage

### Nav items (`SUB_NAV` in `index.tsx`) — 26 entries mapped to App.tsx

| Nav Label | Nav Path | App.tsx Route Exists | Notes |
|---|---|---|---|
| Users | `/settings/users` | Yes | OK |
| Roles | `/settings/roles` | Yes | OK |
| Groups | `/settings/groups` | Yes | OK |
| Sessions | `/settings/sessions` | Yes | OK |
| OPC Sources | `/settings/opc-sources` | Yes | OK |
| Expression Library | `/settings/expressions` | Yes | OK |
| Report Scheduling | `/settings/report-scheduling` | Yes | OK |
| Export Presets | `/settings/export-presets` | Yes | OK |
| Email | `/settings/email` | Yes | OK |
| Security | `/settings/security` | Yes | Aggregation page (see analysis) |
| Appearance | `/settings/appearance` | Yes | Redundant with Display.tsx |
| System Health | `/settings/health` | Yes | Points to WRONG page (thin Health.tsx) |
| Certificates | `/settings/certificates` | Yes | OK |
| Archive | `/settings/archive` | Yes | OK |
| Backup & Restore | `/settings/backup` | Yes | OK |
| Auth Providers | `/settings/auth-providers` | Yes | OK |
| MFA | `/settings/mfa` | Yes | Also inside Security |
| API Keys | `/settings/api-keys` | Yes | Also inside Security |
| SCIM | `/settings/scim` | Yes | Also inside Security |
| SMS Providers | `/settings/sms-providers` | Yes | Also inside Security |
| Bulk Update | `/settings/bulk-update` | Yes | OK |
| Change Snapshots | `/settings/snapshots` | Yes | OK |
| Import | `/settings/import` | Yes | OK |
| Streaming Sessions | `/settings/import-streaming` | Yes | OK |
| Recognition | `/settings/recognition` | Yes | OK |
| EULA | `/settings/eula` | Yes | OK |
| About | `/settings/about` | Yes | OK |

### Routed in App.tsx but NOT in the nav (critical omissions)

| Route | Component | Completeness | Severity |
|---|---|---|---|
| `display` | `Display.tsx` | Full | Critical — fully functional user-prefs page, unreachable |
| `system-health` | `SystemHealth.tsx` | Full | Critical — the real health dashboard, unreachable |
| `points` | `PointManagement.tsx` | Full | Critical — point configuration, unreachable |
| `events` | `EventConfig.tsx` | Stub (informational) | Low |
| `alerts` | `AlertConfig.tsx` | Stub (link launcher) | Low |
| `badges` | `Badges.tsx` | Stub (informational) | Low |
| `sources` | `DataSources.tsx` | Stub | Low |
| `opc` | `OpcConfig.tsx` | Stub | Low |
| `users/:id` | `UserDetail.tsx` | Stub | Medium — broken click target |

---

## Per-Page Analysis

### About (/settings/about)
- File: `frontend/src/pages/settings/About.tsx`
- Completeness: Full
- Purpose: Application version info, build hash, server hostname, EULA version, full open-source license browser (by-package and by-license views, backend/frontend tabs, search filter), SBOM download.
- Missing controls: No "Check for Updates" (Phase 17). No commercial license key display.
- UI issues: Modal backdrop `rgba(0,0,0,0.5)` hardcoded. The 2-column info grid uses `background: "var(--io-border)"` for grid lines — unusual technique that may fail on high-DPI.
- Notes: One of the better-implemented pages. Correct DataTable usage, correct loading states.

### Alert Config (/settings/alerts)
- File: `frontend/src/pages/settings/AlertConfig.tsx`
- Completeness: Stub (navigation launcher only)
- Purpose: Four navigation cards that link to `/alerts/templates`, `/alerts/groups`, `/alerts/active`, `/alerts/history`. No configuration controls.
- Missing controls: Escalation policy configuration, notification sound settings, delivery channel defaults.
- UI issues: `"var(--io-surface)"` used instead of `"var(--io-surface-primary)"`. Hover effect mutates `e.currentTarget.style.borderColor` inline.
- Notes: Not in the nav. No API calls. 133 lines of link buttons. Should be removed from Settings — its purpose is better served by the Alerts module's own navigation.

### API Keys (/settings/api-keys)
- File: `frontend/src/pages/settings/ApiKeys.tsx`
- Completeness: Full
- Purpose: List/create/delete personal API keys. Create modal supports name, scopes checkbox, expiry date. RevealModal shows key once after creation.
- Missing controls: No key rotation. No description field. No IP allowlist. Available scopes are hardcoded client-side (`AVAILABLE_SCOPES` constant) — server-side scope additions won't be reflected.
- UI issues: `rgba(0,0,0,0.5)` / `rgba(0,0,0,0.6)` backdrops hardcoded. `window.confirm()` for delete — inconsistent with custom `ConfirmDialog` in `BackupRestore.tsx`. Error color `#ef4444` hardcoded instead of `var(--io-error)`. Modal uses `position:fixed` without Radix portal.
- User-profile candidate: Yes. "API keys allow programmatic access on your behalf" — these are per-user keys, not system keys.

### Appearance (/settings/appearance)
- File: `frontend/src/pages/settings/Appearance.tsx`
- Completeness: Partial (superseded)
- Purpose: Graphical theme picker with animated preview cards. Three themes: dark, light, HP-HMI.
- Missing controls: No density, date format, or time format (all in `Display.tsx`).
- UI issues: Active checkmark uses hardcoded `color: "#000"` which breaks when accent color is light. Preview swatches use hardcoded hex intentionally (acceptable for preview, not for live UI).
- User-profile candidate: Yes. Browser-local theme preference.
- Consolidation candidate: Delete this page. `Display.tsx` already handles theme selection plus additional options.

### Archive Settings (/settings/archive)
- File: `frontend/src/pages/settings/ArchiveSettings.tsx`
- Completeness: Full
- Purpose: Configures TimescaleDB retention (6 tiers), compression threshold, maintenance interval. CRUD via `/api/archive/settings`.
- Missing controls: Current disk usage per tier. Immediate maintenance trigger. Hypertable chunk size. Aggregate refresh status and last-refresh timestamp.
- UI issues: `btnPrimary` has `color: "#09090b"` hardcoded — dark-mode value, wrong on light theme. Toast uses `"var(--io-success-subtle, #0f3d20)"` and `"var(--io-danger-subtle, #3d1a1a)"` — both fallbacks are dark-mode-only. Local `Toast` component is duplicated from `BackupRestore.tsx`.

### Auth Providers (/settings/auth-providers)
- File: `frontend/src/pages/settings/AuthProviders.tsx`
- Completeness: Full
- Purpose: CRUD for OIDC/SAML/LDAP providers. Supports role mappings per provider, JIT provisioning toggle, display order.
- Missing controls: No "Test Connection" button. No SAML metadata file upload. No OIDC discovery URL auto-populate. Role mapping requires entering role UUID rather than selecting from dropdown.
- UI issues: Config edited as raw JSON textarea — unusable for non-technical admins. `colors.ldap` uses `var(--io-warning)` without hex fallback.

### Backup & Restore (/settings/backup)
- File: `frontend/src/pages/settings/BackupRestore.tsx`
- Completeness: Full
- Purpose: `pg_dump` backup create/list/download/delete/restore. Custom `ConfirmDialog` for destructive actions. Loading spinner on create/restore.
- Missing controls: No scheduled backup configuration. No remote storage target. No backup integrity verification. No restore progress indicator (defers to server logs).
- UI issues: `rgba(0,0,0,0.55)` overlay hardcoded. `"var(--io-accent, #3b82f6)"` and `"var(--io-danger, #d94040)"` have incorrect hex fallbacks. Download handler reads `io_access_token` from `localStorage` directly — bypasses the shared API client.

### Badges (/settings/badges)
- File: `frontend/src/pages/settings/Badges.tsx`
- Completeness: Stub (informational only)
- Purpose: Documents badge reader integration architecture. "Phase 15" deferred banner.
- Missing controls: Everything operational.
- UI issues: Missing `import React` at top of file despite using `React.CSSProperties`. Emoji in UI (`🪪`).
- Consolidation candidate: Should not be a standalone Settings page. Move to a future "Access Control" settings group or remove until Phase 15 ships.

### Bulk Update (/settings/bulk-update)
- File: `frontend/src/pages/settings/BulkUpdate.tsx`
- Completeness: Full
- Purpose: CSV-driven bulk update wizard with column mapping, diff preview, apply, and error reporting. Exports `RestorePreviewModal` used by `Snapshots.tsx`.
- Missing controls: No dry-run separate from diff preview. No partial-apply. No off-hours scheduling.
- UI issues: `"var(--io-bg)"` token in `INPUT` style — this token does not exist in the design token system; should be `var(--io-surface-primary)`. `"var(--io-surface-tertiary)"` in `BTN_SECONDARY` — likely undefined in some themes.
- Notes: The `RestorePreviewModal` export coupling between `BulkUpdate.tsx` and `Snapshots.tsx` is an architectural smell — should live in a shared component directory.

### Certificates (/settings/certificates)
- File: `frontend/src/pages/settings/Certificates.tsx`
- Completeness: Full
- Purpose: TLS certificate CRUD (list, upload PEM cert+key pair, delete, view details via context menu). OPC UA server certificate trust/reject management in a secondary section.
- Missing controls: No ACME/Let's Encrypt auto-renewal UI. No CSR generation. "Copy Fingerprint" context menu action actually copies `cert.subject` (bug — `CertInfo` has no fingerprint field).
- UI issues: OPC status colors `rgba(34,197,94,0.12)`, `#22C55E`, `rgba(234,179,8,0.12)`, `#EAB308`, `rgba(239,68,68,0.12)`, `#EF4444` hardcoded in `OPC_STATUS` constant. Context menu uses `position:fixed` without Radix portal.

### Data Sources (/settings/sources)
- File: `frontend/src/pages/settings/DataSources.tsx`
- Completeness: Stub
- Purpose: 19-line placeholder. "Phase 7" label.
- Missing controls: Everything.
- UI issues: No design tokens for spacing/color.
- Notes: Not in nav. Redundant with `OpcSources.tsx`. Should be deleted.

### Display (/settings/display)
- File: `frontend/src/pages/settings/Display.tsx`
- Completeness: Full
- Purpose: Per-user display preferences: theme, density, date format, time format. Persists to `localStorage`. Immediately applies changes.
- Missing controls: No language/locale selector. No font size. No accessibility options (reduced motion, high contrast). The "default" density value can be persisted to storage but is never selectable in the UI once overwritten.
- UI issues: Active `OptionBtn` uses hardcoded `color: "#fff"` for active label — breaks when accent is light. `OptionBtn` is defined inside the parent function, causing re-creation each render.
- User-profile candidate: Yes, entirely. Every option is a per-user browser preference.
- Notes: NOT in the nav. This is the correct and complete version of what `Appearance.tsx` partially implements. Must be added to nav (and `Appearance.tsx` deleted).

### Email (/settings/email)
- File: `frontend/src/pages/settings/Email.tsx`
- Completeness: Full
- Purpose: Three-tab email settings: SMTP provider configuration, email template management (subject/body), email queue monitoring.
- Missing controls: TLS/STARTTLS toggle visibility unconfirmed from partial read. No bounce handling config. No SPF/DKIM verification.
- UI issues: Local `Tabs` component is a duplicated pattern — identical or near-identical code appears in Sessions.tsx, SystemHealth.tsx, MfaSettings.tsx, and OpcSources.tsx. Should be extracted to a shared component.

### EULA Admin (/settings/eula)
- File: `frontend/src/pages/settings/EulaAdmin.tsx`
- Completeness: Full
- Purpose: Admin CRUD for EULA versions (installer and end-user types). Create, publish, unpublish versions. View per-version acceptance audit log.
- Missing controls: No bulk acceptance export (CSV). No diff between EULA versions.
- UI issues: Uses `var(--io-radius-lg)` — verify this token exists in all themes. Fullscreen dialog is `position:fixed` at 95vw without Radix portal.

### Event Config (/settings/events)
- File: `frontend/src/pages/settings/EventConfig.tsx`
- Completeness: Stub (informational only)
- Purpose: Documents ISA-18.2 alarm configuration areas and state machine. "Phase 9" deferred banner.
- Missing controls: Everything operational — shelving policies, priority definitions, dead-band, retention.
- UI issues: Priority colors `#ef4444`, `#f97316`, `#eab308`, `#3b82f6` hardcoded. Multiple emoji throughout.
- Notes: Not in nav. 399 lines of static content. Should become inline documentation or help text, not a settings page.

### Export Presets (/settings/export-presets)
- File: `frontend/src/pages/settings/ExportPresets.tsx`
- Completeness: Full
- Purpose: Lists and deletes export presets. Click on row navigates to Reports module to edit.
- Missing controls: No create flow from this page. No preset duplication. No bulk delete.
- UI issues: Row click to navigate is not visually indicated as clickable. No empty state illustration/icon.

### Expression Library (/settings/expressions)
- File: `frontend/src/pages/settings/ExpressionLibrary.tsx`
- Completeness: Full
- Purpose: CRUD for named saved expressions. DataTable list, create/edit via full `ExpressionBuilder` dialog, delete. Context-type filter.
- Missing controls: No expression test/evaluation sandbox. No import/export of library. No versioning/audit trail.
- UI issues: `btnDanger` border color uses `rgba(239,68,68,0.3)` hardcoded.

### Groups (/settings/groups)
- File: `frontend/src/pages/settings/Groups.tsx`
- Completeness: Full
- Purpose: CRUD for user groups. Member management, role assignment per group.
- Missing controls: No LDAP-sourced dynamic groups. No membership export. No group hierarchy.
- UI issues: Inline styles `inputStyle`, `labelStyle`, `btnPrimary`, `btnSecondary`, `btnDanger`, `cellStyle` are duplicated verbatim from `Users.tsx`, `Roles.tsx`. Should be extracted to a shared style object.

### Health (/settings/health)
- File: `frontend/src/pages/settings/Health.tsx`
- Completeness: Partial (thin)
- Purpose: Simple service status card grid. Polls `fetchServiceHealth` API.
- Missing controls: Database, OPC, WebSocket, job queue, metrics — all absent. Those are in `SystemHealth.tsx`.
- Notes: Should be deleted. The nav entry "System Health" should point to `/settings/system-health`.

### MFA Settings (/settings/mfa)
- File: `frontend/src/pages/settings/MfaSettings.tsx`
- Completeness: Partial
- Purpose: Three tabs: (1) Global MFA method enable/disable, (2) Per-role MFA policies (stub), (3) Personal TOTP enrollment. Tab 3 is wired to real API. Tab 1 uses `setTimeout` to simulate saves — no real backend wiring.
- Missing controls: Per-role MFA policy API calls are missing (interface exists, no query/mutation). Duo/SMS/Email method configuration doesn't link to actual provider setup.
- UI issues: Success badge background `"var(--io-success-subtle, #f0fdf4)"` — fallback is light-mode-only, incorrect in dark theme. Methods tab state is not server-persisted (mock setTimeout).
- User-profile candidate: Tab 3 (personal TOTP enrollment, backup codes) belongs on the user profile page.

### OPC Config (/settings/opc)
- File: `frontend/src/pages/settings/OpcConfig.tsx`
- Completeness: Stub
- Purpose: 10-line placeholder. "Phase 7" label.
- Missing controls: Everything.
- Notes: Not in nav. Redundant with `OpcSources.tsx`. Should be deleted.

### OPC Sources (/settings/opc-sources)
- File: `frontend/src/pages/settings/OpcSources.tsx`
- Completeness: Full
- Purpose: Full OPC UA source management with tabbed interface. Sources tab (create/edit/delete/test), supplemental connectors tab, OPC server certificate management, history recovery jobs, export.
- Missing controls: No bulk enable/disable of sources. No connection pool sizing settings.
- Notes: This is the definitive data source page. `OpcConfig.tsx` and `DataSources.tsx` are both dead stubs that overlap with this.

### Point Management (/settings/points)
- File: `frontend/src/pages/settings/PointManagement.tsx`
- Completeness: Full
- Purpose: Lists and edits all data points. Filter by source/area/tag. Edit display name, unit, aggregation types (bitmask), criticality, alarm enable, and expression binding. Export with column picker.
- Missing controls: No inline alarm threshold definition. No point deletion UI.
- UI issues: NOT in the nav — zero discoverability for this critical page.

### Recognition (/settings/recognition)
- File: `frontend/src/pages/settings/Recognition.tsx`
- Completeness: Full
- Purpose: `.iomodel` recognition package management: list, upload, activate, deactivate, delete.
- Missing controls: No model test/preview. No `.iogap` gap report viewer.
- UI issues: `"var(--io-surface-tertiary)"` — verify this token exists in all themes.

### Report Scheduling (/settings/report-scheduling)
- File: `frontend/src/pages/settings/ReportScheduling.tsx`
- Completeness: Full
- Purpose: Manages report schedules — list, create (cron + template + recipients + format), pause/resume, delete. Read-only mode for non-admin users.
- Missing controls: No per-schedule run history. No "run now". No visual cron builder (free-text only).
- UI issues: `humanizeCron` function has incomplete cron pattern coverage. `🔒` emoji in `LockedNotice`. Permission check uses `useAuthStore` directly rather than shared `PermissionGuard` — inconsistent.

### Roles (/settings/roles)
- File: `frontend/src/pages/settings/Roles.tsx`
- Completeness: Full
- Purpose: CRUD for roles with inline permission checkbox matrix. ExportButton integration.
- Missing controls: No role hierarchy. No "users in this role" count. With 118 permissions, the checkbox matrix needs section headers for usability.
- UI issues: Comment `// Shared styles (duplicated for isolation — will be extracted in Phase 3)` still present — has not been extracted.

### SCIM Tokens (/settings/scim)
- File: `frontend/src/pages/settings/ScimTokens.tsx`
- Completeness: Full
- Purpose: SCIM provisioning bearer token CRUD (create, reveal-once, list, delete).
- Missing controls: No SCIM endpoint URL display. No test connection. No attribute mapping configuration.
- UI issues: `result as any` type cast. Hand-rolled `position:fixed` modal (not Radix Dialog).
- Notes: Also rendered inside `Security.tsx`.

### Security (/settings/security)
- File: `frontend/src/pages/settings/Security.tsx`
- Completeness: Partial (composition only)
- Purpose: Aggregates `MfaSettings`, `ApiKeysPage`, `ScimTokensSection`, `SmsProvidersSection` on a single scrollable page.
- Missing controls: Page is gated by `system:configure` but embeds personal API keys which any user should be able to manage.
- UI issues: Header copy says "Manage your account security settings" (personal framing) while SCIM/SMS are system-admin concerns.
- Notes: This page has the wrong architecture. Personal and admin security concerns are mixed under one admin permission gate.

### Sessions (/settings/sessions)
- File: `frontend/src/pages/settings/Sessions.tsx`
- Completeness: Full
- Purpose: Two tabs — "My Sessions" (current user's JWT sessions, revoke own sessions) and "All Sessions" (admin view, paginated, revoke any).
- Missing controls: No session detail (device/browser/IP). No "revoke all for user". No session duration configuration.
- User-profile candidate: "My Sessions" tab belongs on user profile.

### SMS Providers (/settings/sms-providers)
- File: `frontend/src/pages/settings/SmsProviders.tsx`
- Completeness: Full
- Purpose: CRUD for SMS gateway providers with create/edit/delete/set-default/test-send.
- Missing controls: No delivery report log. No rate limit configuration.
- UI issues: Hand-rolled `position:fixed` overlay. `color: "#09090b"` hardcoded in `btnPrimary`.
- Notes: Also rendered inside `Security.tsx`.

### Change Snapshots (/settings/snapshots)
- File: `frontend/src/pages/settings/Snapshots.tsx`
- Completeness: Full
- Purpose: Configuration change snapshot management — list by target type, create, view diff, restore via `RestorePreviewModal`, delete.
- Missing controls: No snapshot scheduling. No snapshot comparison. No export.
- UI issues: `"var(--io-bg)"` token in `INPUT` style — undefined token. Cross-file dependency on `RestorePreviewModal` from `BulkUpdate.tsx`.

### Supplemental Connectors Tab (embedded in OpcSources)
- File: `frontend/src/pages/settings/SupplementalConnectorsTab.tsx`
- Completeness: Full (tab component, not standalone page)
- Notes: Not a routed page. Embedded as a tab within `OpcSources`. No nav entry needed.

### System Health (/settings/system-health)
- File: `frontend/src/pages/settings/SystemHealth.tsx`
- Completeness: Full
- Purpose: Six-tab health dashboard: Services, Database (pool/migration/size/compression), OPC Sources, WebSocket, Jobs, Metrics (time-series charts).
- Missing controls: No alert threshold config inline. No drill-down to service logs. No health snapshot export.
- UI issues: Status colors in `STATUS_COLORS` constant are all hardcoded hex/rgba values: `rgba(34,197,94,0.12)`, `#22c55e`, `rgba(251,191,36,0.15)`, `#fbbf24`, `rgba(239,68,68,0.12)`, `#ef4444`. Should use CSS custom properties.
- Notes: NOT in the nav. The nav's "System Health" item points to the wrong file.

### User Detail (/settings/users/:id)
- File: `frontend/src/pages/settings/UserDetail.tsx`
- Completeness: Stub
- Purpose: Shows user ID from URL params only. No data fetched.
- Missing controls: Everything. Profile fields, role assignments, group memberships, MFA status, API keys, login history.
- Notes: Clicking a user row in `Users.tsx` navigates here. The broken click target erodes trust in the entire users table.

### Users (/settings/users)
- File: `frontend/src/pages/settings/Users.tsx`
- Completeness: Full
- Purpose: User CRUD with search/filter/pagination, create (with role), edit, enable/disable, export with column picker.
- Missing controls: No admin-initiated password reset. No bulk role assignment. No user import from CSV (handled separately by Import module).
- UI issues: `var(--io-text-on-accent)` in `btnPrimary` — verify this token exists. Row click navigates to stub `UserDetail` — broken UX.

### Import (/settings/import)
- File: `frontend/src/pages/settings/Import.tsx`
- Completeness: Full
- Purpose: Multi-tab Universal Import management: Connections (40 connector templates), Definitions (field mapping configs), Runs (history + log detail), Data Links (transform rules).
- Missing controls: "Run Now" button for a definition may be absent. No run cancel for in-progress jobs.
- UI issues: `"var(--io-bg)"` undefined token used in some input styles.

### Streaming Sessions (/settings/import-streaming)
- File: `frontend/src/pages/settings/StreamingSessions.tsx`
- Completeness: Full
- Purpose: Live view of streaming import sessions (Kafka, MQTT, Modbus TCP). Auto-refreshes every 5 seconds. Stop/restart per session.
- Missing controls: No session creation here (via Import). No session log viewer.
- UI issues: All status colors in `STATUS_COLORS` constant are hardcoded hex strings — `"#22c55e"`, `"#4a9eff"`, `"#eab308"`, `"#ef4444"`, `"#6b7280"`. Should use CSS custom properties.

---

## Consolidation Map

### Merge: Identity & Access Management (4 pages → 1 page, 4 tabs)
- `Users.tsx` → Users tab
- `Roles.tsx` → Roles tab
- `Groups.tsx` → Groups tab
- `Sessions.tsx` → Sessions tab (admin "All Sessions" only; "My Sessions" → user profile)

**Rationale:** Always navigated together. Placing in a single tabbed page reduces nav from 3 items to 1.

### Merge: Authentication (4 pages → 1 page, 4 tabs)
- `AuthProviders.tsx` → Providers tab
- `MfaSettings.tsx` (admin tabs only) → MFA tab
- `ScimTokens.tsx` → SCIM tab
- `SmsProviders.tsx` → SMS tab (SMS is an MFA delivery mechanism)

**Rationale:** All are identity federation configuration.

### Merge: Data Ingestion (3 pages → 1 page, 3 tabs)
- `OpcSources.tsx` → OPC Sources tab
- `Import.tsx` → Universal Import tab
- `StreamingSessions.tsx` → Streaming Sessions tab

**Rationale:** All are data ingestion methods configured by the same person.

### Merge: Data Management (2 pages → 1 page, 2 tabs)
- `PointManagement.tsx` → Points tab
- `ExpressionLibrary.tsx` → Expressions tab

**Rationale:** Expressions are attached to points; configured together.

### Merge: System Durability (2 pages → 1 page, 2 tabs)
- `BackupRestore.tsx` → Backup tab
- `ArchiveSettings.tsx` → Archive tab

**Rationale:** Both are about data lifecycle and durability.

### Delete (5 pages)
- `Health.tsx` — superseded by `SystemHealth.tsx`
- `Appearance.tsx` — superseded by `Display.tsx`
- `OpcConfig.tsx` — stub, superseded by `OpcSources.tsx`
- `DataSources.tsx` — stub, superseded by `OpcSources.tsx`
- `Security.tsx` — decompose into proper groups; delete the aggregation wrapper

### Relocate to User Profile (not Settings)
- `Display.tsx` (all content)
- Personal MFA enrollment tab from `MfaSettings.tsx`
- Personal API key management from `ApiKeys.tsx`
- "My Sessions" tab from `Sessions.tsx`

### Demote to documentation / inline help
- `EventConfig.tsx` — static Phase 9 preview; not a settings page
- `Badges.tsx` — static Phase 15 preview; not a settings page

### Relocate within module
- `AlertConfig.tsx` — links only to Alerts module; move to Alerts nav or remove

---

## User Profile vs Admin Settings

| Setting | Current Location | Correct Location |
|---|---|---|
| Theme selection | `Appearance.tsx` + `Display.tsx` | User profile page |
| Layout density | `Display.tsx` | User profile page |
| Date format | `Display.tsx` | User profile page |
| Time format | `Display.tsx` | User profile page |
| My Sessions (own session list + revoke) | `Sessions.tsx` "My Sessions" tab | User profile page |
| Personal API keys | `ApiKeys.tsx` + `Security.tsx` | User profile page |
| Personal TOTP enrollment | `MfaSettings.tsx` "my-mfa" tab | User profile page |
| Backup codes view | `MfaSettings.tsx` | User profile page |

All other pages are legitimately admin settings.

---

## Nav Structure Problems

1. **No grouping.** 26 items spanning trivial preferences (theme) and complex enterprise config (SCIM, LDAP) with no visual separation.

2. **Permission-unaware nav.** All 26 items render regardless of user permissions. An operator without `system:configure` sees archive, certificate, backup links and is denied only upon clicking.

3. **Three critical pages missing from the nav.** `Display` (user preferences), `SystemHealth` (admin dashboard), and `PointManagement` (data config) are fully functional but have no nav entry.

4. **Wrong page linked for "System Health".** Nav links `/settings/health` (thin `Health.tsx`) but the real system health dashboard is at `/settings/system-health`.

5. **Four pages in the nav are either redundant, stubs, or deferred-informational:** `Appearance` (superseded by `Display`), `Health` (superseded by `SystemHealth`), and four sub-pages that duplicate content already inside `Security.tsx`.

6. **200px sidebar width.** Labels like "Expression Library", "Report Scheduling", "Streaming Sessions", "Change Snapshots", "Auth Providers", "Import Streaming" overflow or are visually cramped.

7. **No icons.** Icon-only collapse for narrow viewports is not possible without icon support.

### Recommended restructuring (7 groups, ~24 items total after consolidation)

```
IDENTITY
  Users, Roles, Groups
  Sessions (admin)

AUTHENTICATION
  Auth Providers
  MFA Settings
  SCIM Tokens
  SMS Providers

DATA INGESTION
  OPC Sources
  Universal Import
  Streaming Sessions

DATA MANAGEMENT
  Points
  Expression Library

SYSTEM
  Archive & Backup
  Certificates
  Email
  Recognition
  Bulk Update
  Change Snapshots

OPERATIONS
  Report Scheduling
  Export Presets
  System Health

ABOUT
  EULA
  About
```

This produces 7 collapsible group headers with 3–5 items each, scannable without scrolling on a 1080p display.
