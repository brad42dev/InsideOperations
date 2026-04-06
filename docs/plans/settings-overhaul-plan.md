# Settings Module Overhaul Plan

## Overview

### Problem Statement

The Settings module has grown organically across 17 build phases into 38 files with no coherent information architecture. The result is a 26-item flat sidebar with no grouping, no RBAC filtering, and no visual hierarchy. Eight routed pages are missing from the nav entirely — including three fully-functional, production-quality pages (`SystemHealth`, `PointManagement`, `Display`) that users cannot discover. Five files are pure stubs or redundant duplicates. Personal user preferences (theme, MFA enrollment, API keys, sessions) are mixed with system administration under admin-only permission gates. Hardcoded hex colors appear in at least 8 files, breaking theme switching. Style constants (`inputStyle`, `labelStyle`, `btnPrimary`) are duplicated verbatim across 5+ files. A local `Tabs` component is reimplemented in 5+ files. Modals inconsistently use hand-rolled `position:fixed` overlays instead of Radix Dialog. Two undefined CSS tokens (`var(--io-bg)`, `var(--io-surface-tertiary)`) are used in multiple files.

### Goals

1. **Grouped navigation** — 7 section groups with headers, max 5 items per group, RBAC-filtered
2. **User/admin split** — Personal settings at `/profile` (accessible to all users), admin settings at `/settings` (permission-gated)
3. **Consolidation** — Merge related thin pages into tabbed views (Identity, Authentication, Data Ingestion, Data Management, System)
4. **Delete dead weight** — Remove 5 stub/redundant files, 3 informational-only stubs
5. **Shared components** — Extract duplicated `Tabs`, style constants, and `ConfirmDialog` into shared files
6. **Design token compliance** — Replace all hardcoded hex/rgba with CSS custom properties; fix undefined tokens
7. **Modal consistency** — All modals use Radix Dialog
8. **Wide-screen layout** — Max-width containers, left-aligned content, two-column forms where appropriate
9. **Missing functionality** — Wire mock `setTimeout` saves to real APIs, add missing controls identified in the audit

### Not In Scope

- Backend API changes (all frontend-only; API stubs are acceptable for new controls)
- New backend endpoints or database migrations
- Mobile/PWA layout (Settings is desktop-only per doc 20)
- Complete implementation of deferred features (badge adapters, muster points, access control) — only stub pages with correct nav placement

---

## Architecture Decisions

### Nav Structure (7 Groups)

After consolidation, the sidebar uses grouped sections with non-interactive section headers. Each group has 2-5 items. The sidebar is RBAC-filtered: groups with zero accessible items are hidden entirely.

```
IDENTITY & ACCESS
  Users & Roles          /settings/identity      (tabs: Users, Roles, Groups, Sessions)
  
AUTHENTICATION
  Auth Providers         /settings/auth-providers (existing page, improved)
  MFA Policy             /settings/mfa           (admin tabs only)
  SCIM Provisioning      /settings/scim          (existing page, improved)
  SMS Providers          /settings/sms-providers  (existing page)

DATA SOURCES
  OPC Sources            /settings/opc-sources    (existing page)
  Point Management       /settings/points         (existing page, added to nav)
  Expressions            /settings/expressions    (existing page)
  Import & Streaming     /settings/import         (tabs: existing Import tabs + Streaming Sessions)

NOTIFICATIONS
  Email                  /settings/email          (existing page)

SYSTEM
  System Health          /settings/system-health  (existing page, nav fix)
  Archive & Backup       /settings/system         (tabs: Archive, Backup & Restore)
  Certificates           /settings/certificates   (existing page)

CONTENT & EXPORT
  Report Scheduling      /settings/report-scheduling
  Export Presets          /settings/export-presets
  Bulk Update            /settings/bulk-update
  Change Snapshots       /settings/snapshots
  Recognition            /settings/recognition

ABOUT
  EULA                   /settings/eula
  About                  /settings/about
```

Total: 7 groups, 18 nav items (down from 26 flat items).

### User Profile (Outside Settings)

A new `/profile` route accessible from the user avatar menu. Contains 4 tabs:

- **Profile** — Display name, email (read-only), avatar
- **Security** — Personal MFA enrollment (from MfaSettings tab 3), personal API keys (from ApiKeys.tsx), change password
- **Sessions** — My Sessions (from Sessions.tsx "My Sessions" tab)
- **Preferences** — Theme, density, date/time format (from Display.tsx content)

### Shared Components

| Component | File | Replaces |
|-----------|------|----------|
| `SettingsTabs` | `shared/components/SettingsTabs.tsx` | Local `Tabs` in Email, Sessions, SystemHealth, MfaSettings, OpcSources, Import |
| `settingsStyles` | `pages/settings/settingsStyles.ts` | Duplicated `inputStyle`, `labelStyle`, `btnPrimary`, `btnSecondary`, `btnDanger`, `cellStyle` in 5+ files |
| `SettingsPageLayout` | `pages/settings/SettingsPageLayout.tsx` | Inconsistent page headers and max-width handling |
| `ConfirmDialog` | `shared/components/ConfirmDialog.tsx` | `window.confirm()` calls and hand-rolled confirm modals |

### CSS Token Fixes

| Bad Token | Replacement |
|-----------|-------------|
| `var(--io-bg)` | `var(--io-surface-primary)` |
| `var(--io-surface-tertiary)` | `var(--io-surface-sunken)` |
| `color: "#09090b"` in `btnPrimary` | `color: "var(--io-text-on-accent)"` |
| `color: "#fff"` on active states | `color: "var(--io-text-on-accent)"` |
| `color: "#ef4444"` for errors | `color: "var(--io-error)"` or `color: "var(--io-danger)"` |
| `rgba(0,0,0,0.5)` backdrops | `background: "var(--io-overlay)"` |
| All `STATUS_COLORS` hardcoded hex | Use `var(--io-success)`, `var(--io-warning)`, `var(--io-danger)` with opacity utilities |

---

## Phase Summary Table

| Phase | Name | Scope | Key Deliverables |
|-------|------|-------|------------------|
| 1 | Foundation | Shared components, nav restructure, stub cleanup | SettingsTabs, settingsStyles, ConfirmDialog, SettingsPageLayout, grouped nav with RBAC, delete 5 dead files |
| 2 | User Profile | `/profile` page outside Settings | Profile/Security/Sessions/Preferences tabs, migrate personal content out of Settings |
| 3 | Identity & Access | Consolidate Users/Roles/Groups/Sessions | Single `/settings/identity` page with 4 tabs, real UserDetail panel |
| 4 | Authentication | Consolidate auth pages | Improved AuthProviders, admin-only MFA, SCIM with endpoint URL |
| 5 | Data Ingestion | Consolidate OPC/Import/Streaming | Import page gains Streaming Sessions tab, OPC improvements, points in nav |
| 6 | Data Management | Consolidate Archive/Backup | Single `/settings/system` page with Archive and Backup tabs |
| 7 | Wide-Screen Layout & Visual Polish | Layout + token compliance | Max-width containers, two-column forms, all hardcoded colors fixed, ConfirmDialog everywhere |
| 8 | Missing Functionality | Spec gaps and new pages | General settings page, Graphics settings page, Access Control stub, wire mocks to APIs |

---

## Detailed Phases

---

## Phase 1: Foundation

### Goal

Extract duplicated components and style constants into shared files, restructure the Settings nav into 7 RBAC-filtered groups, delete 5 dead files, and fix the System Health nav routing bug.

### What This Phase Does

**Files to Create:**
- `frontend/src/shared/components/SettingsTabs.tsx` — Reusable tab bar component (label + content)
- `frontend/src/pages/settings/settingsStyles.ts` — Shared style constants (inputStyle, labelStyle, btnPrimary, btnSecondary, btnDanger, btnSmall, cellStyle)
- `frontend/src/shared/components/ConfirmDialog.tsx` — Radix AlertDialog wrapper for destructive confirmations
- `frontend/src/pages/settings/SettingsPageLayout.tsx` — Standard page header (title, description, action button) + max-width wrapper

**Files to Delete (after confirming content is migrated or stub):**
- `frontend/src/pages/settings/Health.tsx` — Thin duplicate; SystemHealth.tsx is the real page
- `frontend/src/pages/settings/Appearance.tsx` — Superseded by Display.tsx
- `frontend/src/pages/settings/OpcConfig.tsx` — 10-line stub; OpcSources.tsx is definitive
- `frontend/src/pages/settings/DataSources.tsx` — 19-line stub; OpcSources.tsx is definitive
- `frontend/src/pages/settings/Security.tsx` — Broken aggregation; components have their own routes

**Files to Modify:**
- `frontend/src/pages/settings/index.tsx` — Replace flat `SUB_NAV` with grouped nav structure, add section headers, add RBAC filtering via `useAuthStore`
- `frontend/src/App.tsx` — Remove routes for deleted files (`/settings/health`, `/settings/appearance`, `/settings/opc`, `/settings/sources`, `/settings/security`); redirect `/settings/health` to `/settings/system-health`

### Acceptance Criteria

- Nav has 7 section groups (IDENTITY & ACCESS, AUTHENTICATION, DATA SOURCES, NOTIFICATIONS, SYSTEM, CONTENT & EXPORT, ABOUT) with uppercase section headers
- Each section header is a non-interactive label styled with `fontSize: 11px`, `fontWeight: 600`, `color: var(--io-text-muted)`, `textTransform: uppercase`
- Sidebar width is 220px (up from 200px)
- Nav items not accessible to the current user's permissions are hidden (not grayed out)
- "System Health" nav item points to `/settings/system-health` (not `/settings/health`)
- `PointManagement` appears in nav under DATA SOURCES as "Point Management"
- `ExpressionLibrary` appears in nav under DATA SOURCES as "Expressions"
- `Display` nav entry is removed (will move to Profile in Phase 2)
- 5 dead files are deleted and their routes removed from App.tsx
- `SettingsTabs` component renders a horizontal tab bar and swaps content; matches the existing tab pattern in Email.tsx
- `settingsStyles.ts` exports `inputStyle`, `labelStyle`, `btnPrimary`, `btnSecondary`, `btnDanger`, `btnSmall`, `cellStyle` — all using design tokens (no hardcoded hex)
- `ConfirmDialog` wraps `@radix-ui/react-alert-dialog` with title, description, confirm/cancel buttons
- `SettingsPageLayout` provides a consistent header and `max-width: 960px` content wrapper
- `pnpm build` and `pnpm lint` pass with zero errors

### Dependencies

None — this is the foundation phase.

---
### IMPLEMENTATION PROMPT (copy this entire block to kick off Sonnet)

[SETTINGS OVERHAUL — PHASE 1: FOUNDATION]

You are implementing Phase 1 of the Settings module overhaul for Inside/Operations.

**Before you start:**
1. Read `/home/io/io-dev/io/docs/plans/settings-overhaul-plan.md` — find Phase 1 and read it completely
2. Read all files listed in "Files to Read" below
3. Do NOT deviate from the plan. If something in the plan conflicts with what you find in the code, note it and follow the plan.

**Files to Read:**
- `/home/io/io-dev/io/frontend/src/pages/settings/index.tsx` — current nav (will be rewritten)
- `/home/io/io-dev/io/frontend/src/pages/settings/Email.tsx` — reference for Tabs pattern to extract
- `/home/io/io-dev/io/frontend/src/pages/settings/Sessions.tsx` — another Tabs pattern instance
- `/home/io/io-dev/io/frontend/src/pages/settings/SystemHealth.tsx` — another Tabs pattern instance
- `/home/io/io-dev/io/frontend/src/pages/settings/MfaSettings.tsx` — another Tabs pattern instance
- `/home/io/io-dev/io/frontend/src/pages/settings/AuthProviders.tsx` — reference for shared styles to extract
- `/home/io/io-dev/io/frontend/src/pages/settings/Users.tsx` — reference for shared styles to extract
- `/home/io/io-dev/io/frontend/src/pages/settings/Groups.tsx` — reference for shared styles to extract
- `/home/io/io-dev/io/frontend/src/pages/settings/Roles.tsx` — reference for shared styles to extract
- `/home/io/io-dev/io/frontend/src/pages/settings/BackupRestore.tsx` — has ConfirmDialog to extract pattern from
- `/home/io/io-dev/io/frontend/src/pages/settings/Health.tsx` — will be deleted (confirm it's a thin stub)
- `/home/io/io-dev/io/frontend/src/pages/settings/Appearance.tsx` — will be deleted (confirm superseded by Display.tsx)
- `/home/io/io-dev/io/frontend/src/pages/settings/OpcConfig.tsx` — will be deleted (confirm it's a stub)
- `/home/io/io-dev/io/frontend/src/pages/settings/DataSources.tsx` — will be deleted (confirm it's a stub)
- `/home/io/io-dev/io/frontend/src/pages/settings/Security.tsx` — will be deleted (confirm it's just an aggregation wrapper)
- `/home/io/io-dev/io/frontend/src/App.tsx` — routes to update
- `/home/io/io-dev/io/frontend/src/stores/authStore.ts` — for RBAC permission checking

**Files to Create:**
- `/home/io/io-dev/io/frontend/src/shared/components/SettingsTabs.tsx`
- `/home/io/io-dev/io/frontend/src/pages/settings/settingsStyles.ts`
- `/home/io/io-dev/io/frontend/src/shared/components/ConfirmDialog.tsx`
- `/home/io/io-dev/io/frontend/src/pages/settings/SettingsPageLayout.tsx`

**Files to Modify:**
- `/home/io/io-dev/io/frontend/src/pages/settings/index.tsx`
- `/home/io/io-dev/io/frontend/src/App.tsx`

**Files to Delete:**
- `/home/io/io-dev/io/frontend/src/pages/settings/Health.tsx`
- `/home/io/io-dev/io/frontend/src/pages/settings/Appearance.tsx`
- `/home/io/io-dev/io/frontend/src/pages/settings/OpcConfig.tsx`
- `/home/io/io-dev/io/frontend/src/pages/settings/DataSources.tsx`
- `/home/io/io-dev/io/frontend/src/pages/settings/Security.tsx`

**Implementation Steps:**

1. **Read all files listed above.** Understand the current Tabs pattern (look for the local `Tabs` function in Email.tsx, Sessions.tsx, SystemHealth.tsx, MfaSettings.tsx). Understand the shared style constants (look for `inputStyle`, `labelStyle`, `btnPrimary`, etc. in AuthProviders.tsx, Users.tsx, Groups.tsx, Roles.tsx). Understand the ConfirmDialog in BackupRestore.tsx.

2. **Create `SettingsTabs.tsx`** at `/home/io/io-dev/io/frontend/src/shared/components/SettingsTabs.tsx`:
   - Props: `tabs: Array<{ id: string; label: string }>`, `activeTab: string`, `onTabChange: (id: string) => void`, optional `children: React.ReactNode`
   - Renders a horizontal tab bar with each tab as a button
   - Active tab: `color: var(--io-accent)`, `borderBottom: 2px solid var(--io-accent)`, `fontWeight: 600`
   - Inactive tab: `color: var(--io-text-secondary)`, `borderBottom: 2px solid transparent`
   - Tab bar has `borderBottom: 1px solid var(--io-border)` on the container
   - Tab buttons: `padding: 10px 16px`, `fontSize: 13px`, `background: transparent`, `border: none`, `cursor: pointer`
   - Export as named export `SettingsTabs`

3. **Create `settingsStyles.ts`** at `/home/io/io-dev/io/frontend/src/pages/settings/settingsStyles.ts`:
   - Export `inputStyle: React.CSSProperties` — width 100%, padding 8px 10px, background `var(--io-surface-sunken)`, border `1px solid var(--io-border)`, borderRadius `var(--io-radius)`, color `var(--io-text-primary)`, fontSize 13px, outline none, boxSizing border-box
   - Export `labelStyle: React.CSSProperties` — display block, fontSize 12px, fontWeight 500, color `var(--io-text-secondary)`, marginBottom 5px
   - Export `btnPrimary: React.CSSProperties` — padding 8px 16px, background `var(--io-accent)`, color `var(--io-text-on-accent)`, border none, borderRadius `var(--io-radius)`, fontSize 13px, fontWeight 600, cursor pointer
   - Export `btnSecondary: React.CSSProperties` — padding 8px 16px, background transparent, color `var(--io-text-secondary)`, border `1px solid var(--io-border)`, borderRadius `var(--io-radius)`, fontSize 13px, cursor pointer
   - Export `btnDanger: React.CSSProperties` — padding 8px 16px, background transparent, color `var(--io-danger)`, border `1px solid var(--io-danger)`, borderRadius `var(--io-radius)`, fontSize 13px, fontWeight 600, cursor pointer
   - Export `btnSmall: React.CSSProperties` — padding 4px 10px, fontSize 12px, borderRadius `var(--io-radius)`, cursor pointer, border `1px solid var(--io-border)`, background transparent, color `var(--io-text-secondary)`
   - Export `cellStyle: React.CSSProperties` — padding 12px 14px, fontSize 13px, color `var(--io-text-secondary)`, verticalAlign middle
   - CRITICAL: No hardcoded hex values anywhere. `btnPrimary.color` must be `var(--io-text-on-accent)`, NOT `#09090b`.

4. **Create `ConfirmDialog.tsx`** at `/home/io/io-dev/io/frontend/src/shared/components/ConfirmDialog.tsx`:
   - Use `@radix-ui/react-alert-dialog` (verify it's installed; if not, use `@radix-ui/react-dialog` with role="alertdialog")
   - Props: `open: boolean`, `onOpenChange: (open: boolean) => void`, `title: string`, `description: string`, `confirmLabel?: string` (default "Confirm"), `cancelLabel?: string` (default "Cancel"), `onConfirm: () => void`, `variant?: 'danger' | 'default'` (default 'default')
   - Overlay: `position: fixed`, inset 0, `background: var(--io-overlay, rgba(0,0,0,0.5))`, zIndex 100
   - Content: centered, `background: var(--io-surface-secondary)`, border, borderRadius 10px, padding 24px, width 420px, max-width calc(100vw - 32px)
   - Confirm button uses `btnDanger` style when variant is 'danger', `btnPrimary` when default
   - Export as named export `ConfirmDialog`

5. **Create `SettingsPageLayout.tsx`** at `/home/io/io-dev/io/frontend/src/pages/settings/SettingsPageLayout.tsx`:
   - Props: `title: string`, `description?: string`, `action?: React.ReactNode`, `maxWidth?: number` (default 960), `children: React.ReactNode`
   - Renders a header row with title (h2, fontSize 18px, fontWeight 600, color var(--io-text-primary)) + description (p, fontSize 13px, color var(--io-text-muted)) on the left, action on the right
   - Content wrapper with `maxWidth` applied, NOT centered — left-aligned
   - Export as default export

6. **Rewrite `index.tsx`** at `/home/io/io-dev/io/frontend/src/pages/settings/index.tsx`:
   - Define a `NavGroup` interface: `{ header: string; permission?: string; items: Array<{ path: string; label: string; permission?: string }> }`
   - Define 7 groups matching the Architecture Decisions section of the plan:
     ```
     IDENTITY & ACCESS: Users & Roles (/settings/identity)
     AUTHENTICATION: Auth Providers (/settings/auth-providers), MFA Policy (/settings/mfa), SCIM (/settings/scim), SMS Providers (/settings/sms-providers)
     DATA SOURCES: OPC Sources (/settings/opc-sources), Point Management (/settings/points), Expressions (/settings/expressions), Import (/settings/import)
     NOTIFICATIONS: Email (/settings/email)
     SYSTEM: System Health (/settings/system-health), Archive & Backup (/settings/system), Certificates (/settings/certificates)
     CONTENT & EXPORT: Report Scheduling (/settings/report-scheduling), Export Presets (/settings/export-presets), Bulk Update (/settings/bulk-update), Change Snapshots (/settings/snapshots), Recognition (/settings/recognition)
     ABOUT: EULA (/settings/eula), About (/settings/about)
     ```
   - RBAC filtering: import `useAuthStore` from the auth store. For each nav item with a `permission` field, check if the user has that permission. Hide items the user cannot access. Hide entire groups if all items are hidden. For this phase, set permissions on items as follows:
     - IDENTITY & ACCESS items: `system:manage_users`
     - AUTHENTICATION items: `auth:configure`
     - DATA SOURCES > OPC Sources: `system:opc_config`
     - DATA SOURCES > Point Management: `system:point_config`
     - DATA SOURCES > Expressions: `system:expression_manage`
     - DATA SOURCES > Import: `system:import_connections`
     - NOTIFICATIONS > Email: `email:configure`
     - SYSTEM > System Health: `system:monitor`
     - SYSTEM > Archive & Backup: `system:backup`
     - SYSTEM > Certificates: `system:admin`
     - CONTENT & EXPORT > Report Scheduling: `reports:schedule_manage`
     - CONTENT & EXPORT > Export Presets: `system:admin`
     - CONTENT & EXPORT > Bulk Update: `system:bulk_update`
     - CONTENT & EXPORT > Change Snapshots: `system:change_backup`
     - CONTENT & EXPORT > Recognition: `recognition:manage`
     - ABOUT items: no permission (visible to all Settings visitors)
   - If the user has ANY `settings:*` or `system:*` permission, they can see the Settings module. The ABOUT group is always visible.
   - Sidebar width: 220px
   - Section headers: non-interactive div with `fontSize: 11px`, `fontWeight: 600`, `color: var(--io-text-muted)`, `textTransform: uppercase`, `letterSpacing: 0.08em`, `padding: 12px 8px 6px`
   - First group header has no top padding (or reduced to 4px)
   - Nav items use the same `NavLink` styling as the current implementation

7. **Update `App.tsx`** at `/home/io/io-dev/io/frontend/src/App.tsx`:
   - Remove lazy imports for `Health`, `Appearance`, `OpcConfig`, `DataSources`, `Security`
   - Remove routes: `/settings/health`, `/settings/appearance`, `/settings/opc`, `/settings/sources`, `/settings/security`
   - Add a redirect from `/settings/health` to `/settings/system-health` (use `<Navigate to="/settings/system-health" replace />`)
   - Verify that `/settings/system-health`, `/settings/points`, `/settings/display` routes exist and have correct lazy imports
   - Note: `/settings/identity` route does not exist yet — it will be created in Phase 3. For now, keep `/settings/users`, `/settings/roles`, `/settings/groups` as separate routes. The nav item "Users & Roles" should point to `/settings/users` temporarily until Phase 3 creates the consolidated page.

8. **Delete the 5 files:**
   - Delete `/home/io/io-dev/io/frontend/src/pages/settings/Health.tsx`
   - Delete `/home/io/io-dev/io/frontend/src/pages/settings/Appearance.tsx`
   - Delete `/home/io/io-dev/io/frontend/src/pages/settings/OpcConfig.tsx`
   - Delete `/home/io/io-dev/io/frontend/src/pages/settings/DataSources.tsx`
   - Delete `/home/io/io-dev/io/frontend/src/pages/settings/Security.tsx`

9. **Verify:** Run `pnpm build` from `/home/io/io-dev/io/frontend` and fix any TypeScript errors. Run `pnpm lint` and fix any ESLint errors. Confirm no remaining imports of the deleted files.

**Strict Rules for This Phase:**
- Use CSS custom properties exclusively — never hardcode hex/rgb colors
- Use Radix AlertDialog (or Dialog with alertdialog role) for ConfirmDialog — never hand-roll position:fixed overlays
- All new components must use design tokens from var(--io-*) namespace
- Do NOT modify any existing page files other than index.tsx and App.tsx in this phase — those changes come in later phases
- The nav must render correctly even if `/settings/identity` and `/settings/system` routes don't exist yet — use temporary paths pointing to existing routes
- Keep the `COMING_SOON_ITEMS` pattern removed — it's not needed with the grouped nav

**When Done:**
- Run `pnpm build` from `/home/io/io-dev/io/frontend` and fix any TypeScript errors
- Run `pnpm lint` and fix any ESLint errors
- Verify the nav renders correctly and all routes are reachable
- Post the next phase's implementation prompt (Phase 2) into the Claude Code window

[End of Phase 1 Implementation Prompt]

---

## Phase 2: User Profile Page

### Goal

Create a standalone `/profile` page outside Settings that contains all per-user preferences and personal security settings, removing them from the admin Settings module.

### What This Phase Does

**Files to Create:**
- `frontend/src/pages/profile/index.tsx` — Profile page shell with 4 tabs
- `frontend/src/pages/profile/ProfileTab.tsx` — Display name, email, avatar placeholder
- `frontend/src/pages/profile/SecurityTab.tsx` — Personal MFA enrollment + personal API keys + change password
- `frontend/src/pages/profile/SessionsTab.tsx` — My Sessions (own sessions, revoke own)
- `frontend/src/pages/profile/PreferencesTab.tsx` — Theme, density, date/time format (migrated from Display.tsx)

**Files to Modify:**
- `frontend/src/App.tsx` — Add `/profile` route, remove `/settings/display` and `/settings/api-keys` routes
- `frontend/src/pages/settings/index.tsx` — Remove any remaining Display/API Keys nav references
- `frontend/src/pages/settings/Sessions.tsx` — Remove "My Sessions" tab, keep only "All Sessions" (admin)
- `frontend/src/pages/settings/MfaSettings.tsx` — Remove personal enrollment tab ("my-mfa"), keep only admin tabs

**Files to Delete:**
- `frontend/src/pages/settings/Display.tsx` — Content migrated to PreferencesTab
- `frontend/src/pages/settings/ApiKeys.tsx` — Content migrated to SecurityTab

### Acceptance Criteria

- `/profile` page renders with 4 tabs: Profile, Security, Sessions, Preferences
- Profile tab shows user's display name, email, and username (read from auth store)
- Security tab has MFA enrollment section (TOTP setup, backup codes) and API Keys section (list, create, delete)
- Sessions tab shows current user's sessions with revoke capability
- Preferences tab has theme selector (dark/light/hphmi), density picker, date format picker, time format picker
- All preferences persist to localStorage (same behavior as Display.tsx)
- `/settings/display` route redirects to `/profile?tab=preferences`
- `/settings/api-keys` route redirects to `/profile?tab=security`
- Sessions page in Settings only shows "All Sessions" tab (admin view)
- MfaSettings page in Settings only shows admin tabs (global methods, per-role policies)
- User avatar menu in the app shell includes a "My Profile" link to `/profile`
- `pnpm build` and `pnpm lint` pass

### Dependencies

Phase 1 (SettingsTabs component, settingsStyles)

---
### IMPLEMENTATION PROMPT (copy this entire block to kick off Sonnet)

[SETTINGS OVERHAUL — PHASE 2: USER PROFILE PAGE]

You are implementing Phase 2 of the Settings module overhaul for Inside/Operations.

**Before you start:**
1. Read `/home/io/io-dev/io/docs/plans/settings-overhaul-plan.md` — find Phase 2 and read it completely
2. Read all files listed in "Files to Read" below
3. Do NOT deviate from the plan. If something in the plan conflicts with what you find in the code, note it and follow the plan.

**Files to Read:**
- `/home/io/io-dev/io/docs/plans/settings-overhaul-plan.md` — Phase 2 section
- `/home/io/io-dev/io/frontend/src/pages/settings/Display.tsx` — Content to migrate to PreferencesTab
- `/home/io/io-dev/io/frontend/src/pages/settings/ApiKeys.tsx` — Content to migrate to SecurityTab
- `/home/io/io-dev/io/frontend/src/pages/settings/Sessions.tsx` — "My Sessions" tab to migrate, "All Sessions" to keep
- `/home/io/io-dev/io/frontend/src/pages/settings/MfaSettings.tsx` — Personal enrollment tab to migrate, admin tabs to keep
- `/home/io/io-dev/io/frontend/src/shared/components/SettingsTabs.tsx` — Tab component from Phase 1
- `/home/io/io-dev/io/frontend/src/pages/settings/settingsStyles.ts` — Shared styles from Phase 1
- `/home/io/io-dev/io/frontend/src/App.tsx` — Routes to update
- `/home/io/io-dev/io/frontend/src/stores/authStore.ts` — User info for profile
- `/home/io/io-dev/io/frontend/src/shared/components/Sidebar.tsx` — Or wherever the app shell user menu lives, to add "My Profile" link

**Files to Create:**
- `/home/io/io-dev/io/frontend/src/pages/profile/index.tsx`
- `/home/io/io-dev/io/frontend/src/pages/profile/ProfileTab.tsx`
- `/home/io/io-dev/io/frontend/src/pages/profile/SecurityTab.tsx`
- `/home/io/io-dev/io/frontend/src/pages/profile/SessionsTab.tsx`
- `/home/io/io-dev/io/frontend/src/pages/profile/PreferencesTab.tsx`

**Files to Modify:**
- `/home/io/io-dev/io/frontend/src/App.tsx`
- `/home/io/io-dev/io/frontend/src/pages/settings/Sessions.tsx`
- `/home/io/io-dev/io/frontend/src/pages/settings/MfaSettings.tsx`
- `/home/io/io-dev/io/frontend/src/pages/settings/index.tsx` (remove any Display/API Keys nav entries if present)
- The app shell component that renders the user avatar menu (find it — likely in `shared/components/` or the layout component)

**Files to Delete:**
- `/home/io/io-dev/io/frontend/src/pages/settings/Display.tsx`
- `/home/io/io-dev/io/frontend/src/pages/settings/ApiKeys.tsx`

**Implementation Steps:**

1. **Read all files listed above.** Understand the Display.tsx content (theme picker, density picker, date/time format pickers, localStorage persistence). Understand ApiKeys.tsx (list, create modal, reveal modal, delete). Understand Sessions.tsx tab structure ("My Sessions" vs "All Sessions"). Understand MfaSettings.tsx tab structure (methods, role-policies, my-mfa).

2. **Create `/home/io/io-dev/io/frontend/src/pages/profile/index.tsx`:**
   - Import `SettingsTabs` from `../../shared/components/SettingsTabs`
   - Define 4 tabs: `profile`, `security`, `sessions`, `preferences`
   - Support URL query param `?tab=` to set initial active tab
   - Render a page header "My Profile" with description "Manage your personal settings and security"
   - Use `SettingsTabs` for tab navigation
   - Lazy-render each tab's content based on active tab
   - Page has `maxWidth: 960px`, left-aligned, `padding: 24px`

3. **Create `ProfileTab.tsx`:**
   - Read user info from `useAuthStore` (username, email, display_name)
   - Show display name in an input (disabled for now — no edit API yet)
   - Show email (read-only)
   - Show username (read-only)
   - Show role badges (from user's roles)
   - Use styles from `settingsStyles.ts`

4. **Create `SecurityTab.tsx`:**
   - **MFA Enrollment section**: Migrate the "my-mfa" tab content from MfaSettings.tsx. This includes TOTP setup (QR code, verify code, backup codes). Keep the same API calls.
   - **API Keys section**: Migrate the full ApiKeys.tsx content (list, create, reveal, delete). Replace `window.confirm()` with `ConfirmDialog` from Phase 1. Replace hand-rolled modals with Radix Dialog. Fix hardcoded `#ef4444` error color to `var(--io-danger)`. Fix `rgba(0,0,0,0.5)` backdrop to `var(--io-overlay, rgba(0,0,0,0.5))`.
   - **Change Password section**: Simple form with current password, new password, confirm password fields. Wire to `PUT /api/auth/password` or similar endpoint.
   - Use styles from `settingsStyles.ts`

5. **Create `SessionsTab.tsx`:**
   - Migrate the "My Sessions" tab content from Sessions.tsx
   - Show current user's sessions with device/IP info
   - Revoke button per session (except current session)
   - Use styles from `settingsStyles.ts`

6. **Create `PreferencesTab.tsx`:**
   - Migrate the FULL content of Display.tsx: theme selector, density picker, date format picker, time format picker
   - Keep localStorage persistence behavior
   - Fix: Move the `OptionBtn` component outside the parent function (it's currently defined inside, causing re-creation on each render)
   - Fix hardcoded `color: "#fff"` in active OptionBtn to `color: "var(--io-text-on-accent)"`
   - Use styles from `settingsStyles.ts`

7. **Modify `Sessions.tsx`:**
   - Remove the "My Sessions" tab entirely
   - Remove the tab bar if only one tab remains — render "All Sessions" content directly
   - Update the page title/description to indicate this is admin session management

8. **Modify `MfaSettings.tsx`:**
   - Remove the "my-mfa" / personal enrollment tab
   - Keep only the "methods" (global toggle) and "role-policies" (per-role) tabs
   - Update the page title/description to indicate this is admin MFA policy configuration

9. **Update `App.tsx`:**
   - Add lazy import for Profile page: `const Profile = lazy(() => import('./pages/profile/index'))`
   - Add route: `<Route path="/profile" element={<Profile />} />`
   - Remove `/settings/display` route (or redirect to `/profile?tab=preferences`)
   - Remove `/settings/api-keys` route (or redirect to `/profile?tab=security`)

10. **Update the user avatar menu** in the app shell to include a "My Profile" link pointing to `/profile`. Find the relevant component (check `Sidebar.tsx`, the top bar, or user menu component).

11. **Delete files:**
    - Delete `/home/io/io-dev/io/frontend/src/pages/settings/Display.tsx`
    - Delete `/home/io/io-dev/io/frontend/src/pages/settings/ApiKeys.tsx`

12. **Verify:** Run `pnpm build` and `pnpm lint`. Fix all errors.

**Strict Rules for This Phase:**
- Use CSS custom properties exclusively — never hardcode hex/rgb colors
- Use Radix Dialog for all modals — never hand-roll position:fixed overlays (except Radix's own overlay)
- All new components must use design tokens from var(--io-*) namespace
- The Profile page must work for ALL authenticated users, not just admins
- API Keys: replace `window.confirm()` with the ConfirmDialog component from Phase 1
- Do not break the existing Settings module — Sessions and MfaSettings must still work after removing their personal tabs

**When Done:**
- Run `pnpm build` from `/home/io/io-dev/io/frontend` and fix any TypeScript errors
- Run `pnpm lint` and fix any ESLint errors
- Verify `/profile` page renders all 4 tabs correctly
- Verify Settings > Sessions only shows admin view
- Verify Settings > MFA only shows admin tabs
- Post the next phase's implementation prompt (Phase 3) into the Claude Code window

[End of Phase 2 Implementation Prompt]

---

## Phase 3: Identity & Access Consolidation

### Goal

Merge Users, Roles, Groups, and Sessions (admin-only) into a single `/settings/identity` page with 4 tabs. Build out the UserDetail panel from its current 12-line stub into a real user detail view.

### What This Phase Does

**Files to Create:**
- `frontend/src/pages/settings/IdentityAccess.tsx` — Consolidated page with 4 tabs: Users, Roles, Groups, Sessions

**Files to Modify:**
- `frontend/src/App.tsx` — Add `/settings/identity` route, redirect old routes
- `frontend/src/pages/settings/index.tsx` — Update "Users & Roles" nav item to point to `/settings/identity`
- `frontend/src/pages/settings/Users.tsx` — Refactor to be importable as a tab component (remove page-level wrapper if needed)
- `frontend/src/pages/settings/Roles.tsx` — Refactor: add section headers to the 118-permission matrix; make importable as tab component
- `frontend/src/pages/settings/Groups.tsx` — Refactor to be importable as tab component
- `frontend/src/pages/settings/Sessions.tsx` — Already admin-only after Phase 2; make importable as tab component
- `frontend/src/pages/settings/UserDetail.tsx` — Build out from 12-line stub into a real detail panel

**Files to Delete:**
None in this phase — the individual files are kept as tab content components.

### Acceptance Criteria

- `/settings/identity` renders a page with 4 tabs: Users, Roles, Groups, Sessions
- URL supports `?tab=users|roles|groups|sessions` for deep linking
- Each tab renders the existing page's content (no functional regressions)
- `/settings/users`, `/settings/roles`, `/settings/groups`, `/settings/sessions` redirect to `/settings/identity?tab=<name>`
- Users tab: clicking a user row opens UserDetail as a side panel or modal (not a separate route)
- UserDetail shows: user profile fields, role assignments with add/remove, group memberships, MFA enrollment status, session list, login history (recent)
- Roles tab: permission matrix has section headers grouping the 118 permissions by module (e.g., "Console", "Process", "Designer", "Settings", "System", etc.)
- All styles use `settingsStyles.ts` imports — no local duplicate style constants
- RBAC: entire page gated by `system:manage_users` (any tab requires this; individual tabs may have additional guards)
- `pnpm build` and `pnpm lint` pass

### Dependencies

Phase 1 (SettingsTabs, settingsStyles), Phase 2 (Sessions admin-only)

---
### IMPLEMENTATION PROMPT (copy this entire block to kick off Sonnet)

[SETTINGS OVERHAUL — PHASE 3: IDENTITY & ACCESS CONSOLIDATION]

You are implementing Phase 3 of the Settings module overhaul for Inside/Operations.

**Before you start:**
1. Read `/home/io/io-dev/io/docs/plans/settings-overhaul-plan.md` — find Phase 3 and read it completely
2. Read all files listed in "Files to Read" below
3. Do NOT deviate from the plan. If something in the plan conflicts with what you find in the code, note it and follow the plan.

**Files to Read:**
- `/home/io/io-dev/io/docs/plans/settings-overhaul-plan.md` — Phase 3 section
- `/home/io/io-dev/io/frontend/src/pages/settings/Users.tsx` — Full users page to become a tab
- `/home/io/io-dev/io/frontend/src/pages/settings/Roles.tsx` — Full roles page to become a tab
- `/home/io/io-dev/io/frontend/src/pages/settings/Groups.tsx` — Full groups page to become a tab
- `/home/io/io-dev/io/frontend/src/pages/settings/Sessions.tsx` — Admin sessions to become a tab
- `/home/io/io-dev/io/frontend/src/pages/settings/UserDetail.tsx` — 12-line stub to build out
- `/home/io/io-dev/io/frontend/src/shared/components/SettingsTabs.tsx` — Tab component
- `/home/io/io-dev/io/frontend/src/pages/settings/settingsStyles.ts` — Shared styles
- `/home/io/io-dev/io/frontend/src/pages/settings/SettingsPageLayout.tsx` — Page layout
- `/home/io/io-dev/io/frontend/src/shared/components/ConfirmDialog.tsx` — For delete confirmations
- `/home/io/io-dev/io/frontend/src/App.tsx` — Routes to update
- `/home/io/io-dev/io/frontend/src/pages/settings/index.tsx` — Nav to update
- `/home/io/io-dev/io/frontend/src/api/users.ts` — or wherever user API functions live
- `/home/io/io-dev/io/frontend/src/api/roles.ts` — or wherever role API functions live

**Files to Create:**
- `/home/io/io-dev/io/frontend/src/pages/settings/IdentityAccess.tsx`

**Files to Modify:**
- `/home/io/io-dev/io/frontend/src/pages/settings/Users.tsx` — Replace local styles with imports from settingsStyles.ts; replace `window.confirm()` with ConfirmDialog; export inner content as a component (not just default export page wrapper)
- `/home/io/io-dev/io/frontend/src/pages/settings/Roles.tsx` — Replace local styles; add section headers to permission matrix; export as tab component
- `/home/io/io-dev/io/frontend/src/pages/settings/Groups.tsx` — Replace local styles; export as tab component
- `/home/io/io-dev/io/frontend/src/pages/settings/Sessions.tsx` — Export as tab component
- `/home/io/io-dev/io/frontend/src/pages/settings/UserDetail.tsx` — Rewrite from stub
- `/home/io/io-dev/io/frontend/src/App.tsx` — Add identity route, redirect old routes
- `/home/io/io-dev/io/frontend/src/pages/settings/index.tsx` — Update nav item path

**Implementation Steps:**

1. **Read all listed files.** Understand the current structure of each page. Note: each page currently has its own page header, local style constants, and is a standalone routed page. They need to become embeddable tab content.

2. **Refactor each page file** (Users.tsx, Roles.tsx, Groups.tsx, Sessions.tsx):
   - Replace all local `inputStyle`, `labelStyle`, `btnPrimary`, `btnSecondary`, `btnDanger`, `btnSmall`, `cellStyle` with imports from `settingsStyles.ts`
   - Replace `window.confirm()` calls with `ConfirmDialog` component
   - Export a named component (e.g., `export function UsersTab()`) that renders just the content (no page-level header) in addition to the existing default export that includes the header. The tab version omits the top-level h2/description since the parent IdentityAccess page provides those.
   - Keep the existing default export working so old routes still function during the transition

3. **Add section headers to the Roles permission matrix:**
   - Group the 118 permissions by their module prefix (e.g., `console:*`, `process:*`, `designer:*`, `dashboards:*`, `reports:*`, `forensics:*`, `log:*`, `rounds:*`, `settings:*`, `system:*`, `auth:*`, `email:*`, `alerts:*`, `badge_config:*`, `recognition:*`)
   - Before each group, render a section header row spanning the full width with the module name (e.g., "Console", "Process", etc.)
   - Section header style: `background: var(--io-surface-sunken)`, `fontSize: 12px`, `fontWeight: 600`, `color: var(--io-text-muted)`, `padding: 8px 14px`, `textTransform: uppercase`

4. **Rewrite UserDetail.tsx:**
   - Accept `userId: string` as a prop (not from URL params)
   - Fetch user data: `GET /api/users/{userId}` (check the API client for the correct function)
   - Display sections:
     - **Profile**: username, email, display_name, enabled status, created_at, last_login_at
     - **Roles**: list of assigned roles with remove button, "Add Role" dropdown
     - **Groups**: list of group memberships
     - **MFA Status**: enrolled methods (read-only indicator)
     - **Sessions**: active sessions for this user with force-terminate
   - Render as a right-side panel (width 480px, slide-in from right) or a Radix Dialog — choose based on what fits the existing UI pattern
   - Loading and error states
   - Use styles from settingsStyles.ts

5. **Create `IdentityAccess.tsx`:**
   - Import `SettingsTabs`, `SettingsPageLayout`
   - Import tab components: `UsersTab`, `RolesTab`, `GroupsTab`, `SessionsTab` (the new named exports)
   - 4 tabs: Users, Roles, Groups, Sessions
   - Support `?tab=` URL param for deep linking (use `useSearchParams`)
   - Page title: "Identity & Access"
   - Page description: "Manage users, roles, groups, and active sessions"
   - Render `SettingsPageLayout` with the appropriate `maxWidth` (1200px for list tabs, 960px for form tabs)

6. **Update App.tsx:**
   - Add lazy import: `const IdentityAccess = lazy(() => import('./pages/settings/IdentityAccess'))`
   - Add route: `<Route path="identity" element={<IdentityAccess />} />` inside the settings routes
   - Add redirects: `/settings/users` → `/settings/identity?tab=users`, `/settings/roles` → `/settings/identity?tab=roles`, `/settings/groups` → `/settings/identity?tab=groups`, `/settings/sessions` → `/settings/identity?tab=sessions`
   - Keep the UserDetail route as `/settings/users/:id` but update it to redirect to the identity page with user detail open

7. **Update index.tsx nav:** Change "Users & Roles" path from `/settings/users` to `/settings/identity`

8. **Verify:** Run `pnpm build` and `pnpm lint`. Fix all errors.

**Strict Rules for This Phase:**
- Use CSS custom properties exclusively — never hardcode hex/rgb colors
- Use Radix Dialog for UserDetail panel — never hand-roll position:fixed overlays
- All new components must use design tokens from var(--io-*) namespace
- Replace ALL `window.confirm()` in the 4 page files with ConfirmDialog
- The individual pages (Users.tsx, Roles.tsx, etc.) must still compile as standalone — keep their default exports working
- Permission matrix section headers must not break the checkbox toggle functionality

**When Done:**
- Run `pnpm build` from `/home/io/io-dev/io/frontend` and fix any TypeScript errors
- Run `pnpm lint` and fix any ESLint errors
- Verify `/settings/identity` renders all 4 tabs
- Verify clicking a user opens UserDetail with real data
- Verify permission matrix has section headers
- Post the next phase's implementation prompt (Phase 4) into the Claude Code window

[End of Phase 3 Implementation Prompt]

---

## Phase 4: Authentication Consolidation

### Goal

Improve the authentication-related pages: fix AuthProviders (raw JSON config → structured forms, add Test Connection), wire MfaSettings admin tabs to real API, add SCIM endpoint URL display, and clean up hardcoded colors.

### What This Phase Does

**Files to Modify:**
- `frontend/src/pages/settings/AuthProviders.tsx` — Replace raw JSON textarea with structured form fields per provider type (OIDC/SAML/LDAP), add "Test Connection" button, replace role UUID text input with role dropdown, fix `rgba` hardcoded colors
- `frontend/src/pages/settings/MfaSettings.tsx` — Wire global method toggles to real API (remove `setTimeout` mock), fix hardcoded color fallbacks
- `frontend/src/pages/settings/ScimTokens.tsx` — Add SCIM endpoint URL display (read-only field showing the base URL), replace hand-rolled modal with Radix Dialog, fix `as any` cast
- `frontend/src/pages/settings/SmsProviders.tsx` — Replace hand-rolled modal with Radix Dialog, fix `color: "#09090b"` in btnPrimary

### Acceptance Criteria

- AuthProviders: creating/editing an OIDC provider shows structured fields (issuer_url, client_id, client_secret, scopes) instead of raw JSON
- AuthProviders: creating/editing a SAML provider shows structured fields (entity_id, idp_metadata_url, nameid_format)
- AuthProviders: creating/editing an LDAP provider shows structured fields (server_url, bind_dn, bind_password, search_base, user_filter)
- AuthProviders: "Test Connection" button appears per provider row, calls `POST /api/auth-providers/{id}/test`
- AuthProviders: role mapping "Role ID" input replaced with a dropdown populated from the roles API
- MfaSettings: toggling a method (TOTP/Duo/SMS/Email) calls `PUT /api/settings/mfa/methods` (or equivalent) — no `setTimeout`
- ScimTokens: shows SCIM endpoint URL (e.g., `https://<host>/api/scim/v2`) in a read-only input with copy button
- ScimTokens: token creation modal uses Radix Dialog
- SmsProviders: all modals use Radix Dialog
- No hardcoded hex/rgba values in any modified file
- `pnpm build` and `pnpm lint` pass

### Dependencies

Phase 1 (settingsStyles, ConfirmDialog)

---
### IMPLEMENTATION PROMPT (copy this entire block to kick off Sonnet)

[SETTINGS OVERHAUL — PHASE 4: AUTHENTICATION CONSOLIDATION]

You are implementing Phase 4 of the Settings module overhaul for Inside/Operations.

**Before you start:**
1. Read `/home/io/io-dev/io/docs/plans/settings-overhaul-plan.md` — find Phase 4 and read it completely
2. Read all files listed in "Files to Read" below
3. Do NOT deviate from the plan. If something in the plan conflicts with what you find in the code, note it and follow the plan.

**Files to Read:**
- `/home/io/io-dev/io/docs/plans/settings-overhaul-plan.md` — Phase 4 section
- `/home/io/io-dev/io/frontend/src/pages/settings/AuthProviders.tsx` — Full file, to be improved
- `/home/io/io-dev/io/frontend/src/pages/settings/MfaSettings.tsx` — Full file, to be improved
- `/home/io/io-dev/io/frontend/src/pages/settings/ScimTokens.tsx` — Full file, to be improved
- `/home/io/io-dev/io/frontend/src/pages/settings/SmsProviders.tsx` — Full file, to be improved
- `/home/io/io-dev/io/frontend/src/pages/settings/settingsStyles.ts` — Shared styles
- `/home/io/io-dev/io/frontend/src/shared/components/ConfirmDialog.tsx` — For delete confirmations
- `/home/io/io-dev/io/frontend/src/api/authProviders.ts` — Auth providers API client
- `/home/io/io-dev/io/frontend/src/api/roles.ts` — Roles API (for dropdown in role mappings)
- `/home/io/io-dev/io/frontend/src/api/settings.ts` — Settings API (for MFA method toggles)

**Files to Create:**
None.

**Files to Modify:**
- `/home/io/io-dev/io/frontend/src/pages/settings/AuthProviders.tsx`
- `/home/io/io-dev/io/frontend/src/pages/settings/MfaSettings.tsx`
- `/home/io/io-dev/io/frontend/src/pages/settings/ScimTokens.tsx`
- `/home/io/io-dev/io/frontend/src/pages/settings/SmsProviders.tsx`

**Files to Delete:**
None.

**Implementation Steps:**

1. **Read all listed files thoroughly.**

2. **Improve AuthProviders.tsx:**
   - Replace local style constants with imports from `settingsStyles.ts`
   - Replace the raw JSON textarea in `ProviderDialog` with structured form fields based on `providerType`:
     - **OIDC**: issuer_url (input), client_id (input), client_secret (password input), scopes (comma-separated input or tag input)
     - **SAML**: entity_id (input), idp_metadata_url (input), nameid_format (select: email/persistent/transient)
     - **LDAP**: server_url (input), bind_dn (input), bind_password (password input), search_base (input), user_filter (input)
   - Keep a "Raw JSON" toggle/expander for advanced users who want to edit the full config object
   - Add "Test Connection" button to each provider row (next to Edit/Delete). Wire to `POST /api/auth-providers/{id}/test`. Show success/failure inline with a brief message.
   - In `RoleMappings`, replace the "Role ID" text input with a `<select>` dropdown populated by fetching roles from the API (`GET /api/roles`). Display role name, store role ID.
   - Replace `window.confirm()` delete with `ConfirmDialog`
   - Fix all hardcoded `rgba(239,68,68,...)` to use `var(--io-danger)` / `var(--io-danger-subtle)`
   - Fix `rgba(0,0,0,0.5)` overlay to `var(--io-overlay, rgba(0,0,0,0.5))`

3. **Wire MfaSettings.tsx admin tabs to real API:**
   - Replace local style constants with imports from `settingsStyles.ts`
   - In the "Methods" tab, the global method toggles (TOTP, Duo, SMS, Email enabled/disabled) currently use `setTimeout` to simulate saves. Replace with real API calls:
     - Fetch current state: `GET /api/settings/mfa/methods` (or `GET /api/settings` and extract MFA keys)
     - Save toggles: `PUT /api/settings/mfa/methods` (or `PUT /api/settings` with MFA keys)
     - If these endpoints don't exist yet, use `settingsApi.get()` / `settingsApi.update()` with appropriate keys
   - Fix `var(--io-success-subtle, #f0fdf4)` — the fallback `#f0fdf4` is light-mode only. Remove the fallback or use a theme-safe value.

4. **Improve ScimTokens.tsx:**
   - Replace local style constants with imports from `settingsStyles.ts`
   - Add a "SCIM Endpoint URL" section at the top showing: `{window.location.origin}/api/scim/v2` in a read-only input with a "Copy" button
   - Replace hand-rolled `position:fixed` modal with Radix Dialog (for token creation and token reveal)
   - Fix `result as any` type cast — use proper type narrowing
   - Replace `window.confirm()` with ConfirmDialog

5. **Improve SmsProviders.tsx:**
   - Replace local style constants with imports from `settingsStyles.ts`
   - Replace hand-rolled `position:fixed` overlay modal with Radix Dialog
   - Fix `color: "#09090b"` in btnPrimary to `color: "var(--io-text-on-accent)"`
   - Replace `window.confirm()` with ConfirmDialog

6. **Verify:** Run `pnpm build` and `pnpm lint`. Fix all errors.

**Strict Rules for This Phase:**
- Use CSS custom properties exclusively — never hardcode hex/rgb colors
- Use Radix Dialog for ALL modals — never hand-roll position:fixed overlays
- All components must use design tokens from var(--io-*) namespace
- When replacing the JSON textarea with structured fields, keep backward compatibility — the form must produce the same JSON structure that the API expects
- If an API endpoint doesn't exist yet, create the API call function but handle 404 gracefully (show a "not yet available" message)

**When Done:**
- Run `pnpm build` from `/home/io/io-dev/io/frontend` and fix any TypeScript errors
- Run `pnpm lint` and fix any ESLint errors
- Verify AuthProviders structured form works for OIDC, SAML, and LDAP
- Verify MFA method toggles persist (or show appropriate API error if backend not ready)
- Post the next phase's implementation prompt (Phase 5) into the Claude Code window

[End of Phase 4 Implementation Prompt]

---

## Phase 5: Data Ingestion Consolidation

### Goal

Add Streaming Sessions as a tab within the Import page, add Point Management and Expressions to the nav, and fix hardcoded colors across data source pages.

### What This Phase Does

**Files to Modify:**
- `frontend/src/pages/settings/Import.tsx` — Add "Streaming" tab that renders StreamingSessions content
- `frontend/src/pages/settings/StreamingSessions.tsx` — Replace local styles with settingsStyles imports, fix all `STATUS_COLORS` hardcoded hex, export as embeddable component
- `frontend/src/pages/settings/OpcSources.tsx` — Replace local styles with settingsStyles imports, fix hardcoded colors
- `frontend/src/pages/settings/PointManagement.tsx` — Replace local styles with settingsStyles imports (already in nav from Phase 1)
- `frontend/src/pages/settings/ExpressionLibrary.tsx` — Replace local styles, fix `btnDanger` hardcoded rgba
- `frontend/src/pages/settings/index.tsx` — Remove standalone "Streaming Sessions" nav item (now inside Import)
- `frontend/src/App.tsx` — Redirect `/settings/import-streaming` to `/settings/import?tab=streaming`

### Acceptance Criteria

- Import page has a new "Streaming" tab that shows the StreamingSessions content
- `/settings/import-streaming` redirects to `/settings/import?tab=streaming`
- "Streaming Sessions" no longer appears as a standalone nav item
- All `STATUS_COLORS` in StreamingSessions.tsx use CSS custom properties
- All hardcoded hex colors in OpcSources.tsx, PointManagement.tsx, ExpressionLibrary.tsx are replaced with design tokens
- `pnpm build` and `pnpm lint` pass

### Dependencies

Phase 1 (settingsStyles, SettingsTabs)

---
### IMPLEMENTATION PROMPT (copy this entire block to kick off Sonnet)

[SETTINGS OVERHAUL — PHASE 5: DATA INGESTION CONSOLIDATION]

You are implementing Phase 5 of the Settings module overhaul for Inside/Operations.

**Before you start:**
1. Read `/home/io/io-dev/io/docs/plans/settings-overhaul-plan.md` — find Phase 5 and read it completely
2. Read all files listed in "Files to Read" below
3. Do NOT deviate from the plan. If something in the plan conflicts with what you find in the code, note it and follow the plan.

**Files to Read:**
- `/home/io/io-dev/io/docs/plans/settings-overhaul-plan.md` — Phase 5 section
- `/home/io/io-dev/io/frontend/src/pages/settings/Import.tsx` — Full file
- `/home/io/io-dev/io/frontend/src/pages/settings/StreamingSessions.tsx` — Full file (will become embedded tab)
- `/home/io/io-dev/io/frontend/src/pages/settings/OpcSources.tsx` — Full file (color fixes)
- `/home/io/io-dev/io/frontend/src/pages/settings/PointManagement.tsx` — Full file (color fixes)
- `/home/io/io-dev/io/frontend/src/pages/settings/ExpressionLibrary.tsx` — Full file (color fixes)
- `/home/io/io-dev/io/frontend/src/pages/settings/settingsStyles.ts` — Shared styles
- `/home/io/io-dev/io/frontend/src/pages/settings/index.tsx` — Nav to update
- `/home/io/io-dev/io/frontend/src/App.tsx` — Routes to update

**Files to Create:**
None.

**Files to Modify:**
- `/home/io/io-dev/io/frontend/src/pages/settings/Import.tsx`
- `/home/io/io-dev/io/frontend/src/pages/settings/StreamingSessions.tsx`
- `/home/io/io-dev/io/frontend/src/pages/settings/OpcSources.tsx`
- `/home/io/io-dev/io/frontend/src/pages/settings/PointManagement.tsx`
- `/home/io/io-dev/io/frontend/src/pages/settings/ExpressionLibrary.tsx`
- `/home/io/io-dev/io/frontend/src/pages/settings/index.tsx`
- `/home/io/io-dev/io/frontend/src/App.tsx`

**Files to Delete:**
None (StreamingSessions.tsx is kept as a component, just no longer a standalone route).

**Implementation Steps:**

1. **Read all listed files thoroughly.** Note the existing tab structure in Import.tsx (it likely already has tabs for Connections, Definitions, Runs, Data Links).

2. **Modify StreamingSessions.tsx:**
   - Replace all local style constants with imports from `settingsStyles.ts`
   - Replace the `STATUS_COLORS` constant — change every hardcoded hex string:
     - `"#22c55e"` → `"var(--io-success)"`
     - `"#4a9eff"` → `"var(--io-accent)"`
     - `"#eab308"` → `"var(--io-warning)"`
     - `"#ef4444"` → `"var(--io-danger)"`
     - `"#6b7280"` → `"var(--io-text-muted)"`
   - Export a named component `StreamingSessionsContent` that renders just the content (no page header), in addition to the existing default export

3. **Modify Import.tsx:**
   - Add a "Streaming" tab to the existing tab bar
   - When "Streaming" tab is active, render `StreamingSessionsContent` from StreamingSessions.tsx
   - Support `?tab=streaming` URL param
   - Replace local style constants with imports from `settingsStyles.ts`
   - Fix any `var(--io-bg)` usage to `var(--io-surface-primary)`

4. **Modify OpcSources.tsx:**
   - Replace local style constants with imports from `settingsStyles.ts`
   - Fix all hardcoded colors (search for hex values like `#`, `rgba(`, `rgb(`)
   - Replace `window.confirm()` with ConfirmDialog if present

5. **Modify PointManagement.tsx:**
   - Replace local style constants with imports from `settingsStyles.ts`
   - Fix all hardcoded colors

6. **Modify ExpressionLibrary.tsx:**
   - Replace local style constants with imports from `settingsStyles.ts`
   - Fix `btnDanger` border color `rgba(239,68,68,0.3)` → `border: 1px solid var(--io-danger)`

7. **Update index.tsx nav:** Remove the "Streaming Sessions" nav item (now accessed as a tab within Import)

8. **Update App.tsx:** Add redirect from `/settings/import-streaming` to `/settings/import?tab=streaming`

9. **Verify:** Run `pnpm build` and `pnpm lint`. Fix all errors.

**Strict Rules for This Phase:**
- Use CSS custom properties exclusively — never hardcode hex/rgb colors
- When adding the Streaming tab to Import, do not break the existing tab functionality
- StreamingSessions.tsx must still compile standalone (keep default export) even though it's now primarily used as an embedded component
- Use `var(--io-overlay, rgba(0,0,0,0.5))` for any overlay backgrounds

**When Done:**
- Run `pnpm build` from `/home/io/io-dev/io/frontend` and fix any TypeScript errors
- Run `pnpm lint` and fix any ESLint errors
- Verify Import page shows the new Streaming tab
- Verify all hardcoded colors are replaced in modified files
- Post the next phase's implementation prompt (Phase 6) into the Claude Code window

[End of Phase 5 Implementation Prompt]

---

## Phase 6: Data Management Consolidation (Archive & Backup)

### Goal

Merge ArchiveSettings and BackupRestore into a single `/settings/system` page with 2 tabs. Fix hardcoded colors. Add disk usage display to archive and scheduled backup configuration.

### What This Phase Does

**Files to Create:**
- `frontend/src/pages/settings/SystemSettings.tsx` — Consolidated page with tabs: Archive, Backup & Restore

**Files to Modify:**
- `frontend/src/pages/settings/ArchiveSettings.tsx` — Replace local styles, fix hardcoded colors, add disk usage per tier display, export as tab component
- `frontend/src/pages/settings/BackupRestore.tsx` — Replace local styles, fix hardcoded colors, replace local ConfirmDialog with shared one, add scheduled backup section, export as tab component
- `frontend/src/App.tsx` — Add `/settings/system` route, redirect `/settings/archive` and `/settings/backup`
- `frontend/src/pages/settings/index.tsx` — Update "Archive & Backup" nav item to point to `/settings/system`

### Acceptance Criteria

- `/settings/system` renders a page with 2 tabs: Archive, Backup & Restore
- `/settings/archive` redirects to `/settings/system?tab=archive`
- `/settings/backup` redirects to `/settings/system?tab=backup`
- Archive tab includes a "Current Storage" summary card showing estimated disk usage per tier (call appropriate API or show placeholder if API unavailable)
- Backup tab includes a "Schedule" section with cron expression input, retention count, and enable/disable toggle
- All hardcoded hex colors in both files are replaced with CSS custom properties
- The local `Toast` component duplication between ArchiveSettings and BackupRestore is resolved (use a single shared implementation or remove in favor of a simpler pattern)
- `ConfirmDialog` from Phase 1 replaces the local ConfirmDialog in BackupRestore
- `pnpm build` and `pnpm lint` pass

### Dependencies

Phase 1 (settingsStyles, ConfirmDialog, SettingsTabs)

---
### IMPLEMENTATION PROMPT (copy this entire block to kick off Sonnet)

[SETTINGS OVERHAUL — PHASE 6: DATA MANAGEMENT CONSOLIDATION]

You are implementing Phase 6 of the Settings module overhaul for Inside/Operations.

**Before you start:**
1. Read `/home/io/io-dev/io/docs/plans/settings-overhaul-plan.md` — find Phase 6 and read it completely
2. Read all files listed in "Files to Read" below
3. Do NOT deviate from the plan. If something in the plan conflicts with what you find in the code, note it and follow the plan.

**Files to Read:**
- `/home/io/io-dev/io/docs/plans/settings-overhaul-plan.md` — Phase 6 section
- `/home/io/io-dev/io/frontend/src/pages/settings/ArchiveSettings.tsx` — Full file
- `/home/io/io-dev/io/frontend/src/pages/settings/BackupRestore.tsx` — Full file
- `/home/io/io-dev/io/frontend/src/pages/settings/settingsStyles.ts` — Shared styles
- `/home/io/io-dev/io/frontend/src/shared/components/SettingsTabs.tsx` — Tab component
- `/home/io/io-dev/io/frontend/src/shared/components/ConfirmDialog.tsx` — For confirmations
- `/home/io/io-dev/io/frontend/src/pages/settings/SettingsPageLayout.tsx` — Page layout
- `/home/io/io-dev/io/frontend/src/App.tsx` — Routes to update
- `/home/io/io-dev/io/frontend/src/pages/settings/index.tsx` — Nav to update
- `/home/io/io-dev/io/frontend/src/api/settings.ts` — Settings API
- `/home/io/io-dev/io/frontend/src/api/backups.ts` — or wherever backup API functions live

**Files to Create:**
- `/home/io/io-dev/io/frontend/src/pages/settings/SystemSettings.tsx`

**Files to Modify:**
- `/home/io/io-dev/io/frontend/src/pages/settings/ArchiveSettings.tsx`
- `/home/io/io-dev/io/frontend/src/pages/settings/BackupRestore.tsx`
- `/home/io/io-dev/io/frontend/src/App.tsx`
- `/home/io/io-dev/io/frontend/src/pages/settings/index.tsx`

**Files to Delete:**
None.

**Implementation Steps:**

1. **Read all listed files.** Note the local Toast and ConfirmDialog components in BackupRestore.tsx — these will be replaced. Note all hardcoded hex colors in both files.

2. **Modify ArchiveSettings.tsx:**
   - Replace all local style constants with imports from `settingsStyles.ts`
   - Fix all hardcoded colors:
     - `color: "#09090b"` in btnPrimary → `color: "var(--io-text-on-accent)"`
     - `"var(--io-success-subtle, #0f3d20)"` → `"var(--io-success-subtle)"`
     - `"var(--io-danger-subtle, #3d1a1a)"` → `"var(--io-danger-subtle)"`
     - Remove all dark-mode-specific hex fallbacks
   - Remove the local `Toast` component — use a simpler inline success/error message pattern, or create a minimal shared Toast if needed
   - Add a "Current Storage" summary card above the retention form:
     - Call `GET /api/archive/stats` (or appropriate endpoint) to get per-tier disk usage
     - Display as a simple table or card grid: tier name, current size, row count
     - If the API doesn't exist yet, show placeholder text "Storage statistics unavailable"
   - Export a named component `ArchiveTab` for embedding in SystemSettings

3. **Modify BackupRestore.tsx:**
   - Replace all local style constants with imports from `settingsStyles.ts`
   - Replace the local `ConfirmDialog` with the shared `ConfirmDialog` from `/home/io/io-dev/io/frontend/src/shared/components/ConfirmDialog.tsx`
   - Fix hardcoded colors:
     - `rgba(0,0,0,0.55)` overlay → handled by ConfirmDialog
     - `"var(--io-accent, #3b82f6)"` → `"var(--io-accent)"` (remove incorrect fallback)
     - `"var(--io-danger, #d94040)"` → `"var(--io-danger)"` (remove incorrect fallback)
   - Remove the local Toast component
   - Fix the download handler that reads `io_access_token` from localStorage directly — use the shared API client or auth store instead
   - Add a "Schedule" section:
     - Cron expression input (text input with placeholder like `0 2 * * *`)
     - Retention: "Keep last N backups" number input
     - Enable/disable toggle
     - Wire to `GET/PUT /api/backups/schedule` (handle 404 gracefully if not implemented yet)
   - Export a named component `BackupTab` for embedding in SystemSettings

4. **Create `SystemSettings.tsx`:**
   - Import `SettingsTabs`, `SettingsPageLayout`
   - Import `ArchiveTab` from ArchiveSettings, `BackupTab` from BackupRestore
   - 2 tabs: "Archive" and "Backup & Restore"
   - Support `?tab=` URL param
   - Page title: "System"
   - Page description: "Archive retention, backup management, and system maintenance"

5. **Update App.tsx:**
   - Add lazy import for SystemSettings
   - Add route `/settings/system` rendering SystemSettings
   - Add redirects: `/settings/archive` → `/settings/system?tab=archive`, `/settings/backup` → `/settings/system?tab=backup`

6. **Update index.tsx nav:** Change "Archive & Backup" path to `/settings/system`

7. **Verify:** Run `pnpm build` and `pnpm lint`. Fix all errors.

**Strict Rules for This Phase:**
- Use CSS custom properties exclusively — never hardcode hex/rgb colors
- Remove ALL hex fallback values from var() expressions (e.g., `var(--io-accent, #3b82f6)` becomes `var(--io-accent)`)
- Use the shared ConfirmDialog — do not keep the local one
- The backup download handler must not access localStorage directly for the auth token

**When Done:**
- Run `pnpm build` from `/home/io/io-dev/io/frontend` and fix any TypeScript errors
- Run `pnpm lint` and fix any ESLint errors
- Verify `/settings/system` renders both tabs
- Verify all hardcoded colors are gone from modified files
- Post the next phase's implementation prompt (Phase 7) into the Claude Code window

[End of Phase 6 Implementation Prompt]

---

## Phase 7: Wide-Screen Layout & Visual Polish

### Goal

Apply consistent wide-screen layout constraints, two-column form layouts, standardized empty/loading/error states, and replace all remaining `window.confirm()` calls and hardcoded colors across the entire Settings module.

### What This Phase Does

**Files to Modify (all remaining settings pages not yet touched):**
- `frontend/src/pages/settings/Certificates.tsx` — Fix all hardcoded OPC_STATUS hex colors, replace context menu position:fixed with proper handling
- `frontend/src/pages/settings/SystemHealth.tsx` — Fix all STATUS_COLORS hardcoded hex, replace local Tabs with SettingsTabs
- `frontend/src/pages/settings/Email.tsx` — Replace local Tabs with SettingsTabs, replace local styles with settingsStyles
- `frontend/src/pages/settings/About.tsx` — Fix `rgba(0,0,0,0.5)` modal backdrop
- `frontend/src/pages/settings/EulaAdmin.tsx` — Fix fullscreen dialog to use Radix Dialog, verify `var(--io-radius-lg)` token exists
- `frontend/src/pages/settings/BulkUpdate.tsx` — Fix `var(--io-bg)` to `var(--io-surface-primary)`, fix `var(--io-surface-tertiary)`
- `frontend/src/pages/settings/Snapshots.tsx` — Fix `var(--io-bg)`, decouple `RestorePreviewModal` from BulkUpdate
- `frontend/src/pages/settings/ReportScheduling.tsx` — Replace `useAuthStore` permission check with consistent pattern, remove emoji
- `frontend/src/pages/settings/ExportPresets.tsx` — Add empty state, add visual row-click indicator
- `frontend/src/pages/settings/Recognition.tsx` — Fix `var(--io-surface-tertiary)`, replace local styles

**Also modify:**
- `frontend/src/pages/settings/SettingsPageLayout.tsx` — Ensure it applies `maxWidth` correctly with left-alignment

### Acceptance Criteria

- All settings form pages have `max-width: 960px` content containers
- All settings list pages have `max-width: 1200px` content containers
- Content is left-aligned (not centered) within the settings content area
- All remaining `window.confirm()` calls are replaced with ConfirmDialog
- All remaining hardcoded hex/rgba colors are replaced with CSS custom properties
- All remaining local `Tabs` components are replaced with shared `SettingsTabs`
- All remaining local style constant definitions are replaced with imports from `settingsStyles.ts`
- `var(--io-bg)` replaced with `var(--io-surface-primary)` everywhere
- `var(--io-surface-tertiary)` replaced with `var(--io-surface-sunken)` everywhere
- `RestorePreviewModal` extracted from BulkUpdate.tsx into its own file (used by both BulkUpdate and Snapshots)
- No emoji characters in any settings page
- `pnpm build` and `pnpm lint` pass

### Dependencies

Phase 1 (all shared components), Phase 5 (some files already touched)

---
### IMPLEMENTATION PROMPT (copy this entire block to kick off Sonnet)

[SETTINGS OVERHAUL — PHASE 7: WIDE-SCREEN LAYOUT & VISUAL POLISH]

You are implementing Phase 7 of the Settings module overhaul for Inside/Operations.

**Before you start:**
1. Read `/home/io/io-dev/io/docs/plans/settings-overhaul-plan.md` — find Phase 7 and read it completely
2. Read all files listed in "Files to Read" below
3. Do NOT deviate from the plan. If something in the plan conflicts with what you find in the code, note it and follow the plan.

**Files to Read:**
- `/home/io/io-dev/io/docs/plans/settings-overhaul-plan.md` — Phase 7 section
- `/home/io/io-dev/io/frontend/src/pages/settings/Certificates.tsx` — Full file
- `/home/io/io-dev/io/frontend/src/pages/settings/SystemHealth.tsx` — Full file
- `/home/io/io-dev/io/frontend/src/pages/settings/Email.tsx` — Full file
- `/home/io/io-dev/io/frontend/src/pages/settings/About.tsx` — Full file
- `/home/io/io-dev/io/frontend/src/pages/settings/EulaAdmin.tsx` — Full file
- `/home/io/io-dev/io/frontend/src/pages/settings/BulkUpdate.tsx` — Full file
- `/home/io/io-dev/io/frontend/src/pages/settings/Snapshots.tsx` — Full file
- `/home/io/io-dev/io/frontend/src/pages/settings/ReportScheduling.tsx` — Full file
- `/home/io/io-dev/io/frontend/src/pages/settings/ExportPresets.tsx` — Full file
- `/home/io/io-dev/io/frontend/src/pages/settings/Recognition.tsx` — Full file
- `/home/io/io-dev/io/frontend/src/pages/settings/settingsStyles.ts` — Shared styles
- `/home/io/io-dev/io/frontend/src/shared/components/SettingsTabs.tsx` — Shared tabs
- `/home/io/io-dev/io/frontend/src/shared/components/ConfirmDialog.tsx` — Shared confirm dialog
- `/home/io/io-dev/io/frontend/src/pages/settings/SettingsPageLayout.tsx` — Page layout

**Files to Create:**
- `/home/io/io-dev/io/frontend/src/pages/settings/RestorePreviewModal.tsx` — Extracted from BulkUpdate.tsx

**Files to Modify:**
- `/home/io/io-dev/io/frontend/src/pages/settings/Certificates.tsx`
- `/home/io/io-dev/io/frontend/src/pages/settings/SystemHealth.tsx`
- `/home/io/io-dev/io/frontend/src/pages/settings/Email.tsx`
- `/home/io/io-dev/io/frontend/src/pages/settings/About.tsx`
- `/home/io/io-dev/io/frontend/src/pages/settings/EulaAdmin.tsx`
- `/home/io/io-dev/io/frontend/src/pages/settings/BulkUpdate.tsx`
- `/home/io/io-dev/io/frontend/src/pages/settings/Snapshots.tsx`
- `/home/io/io-dev/io/frontend/src/pages/settings/ReportScheduling.tsx`
- `/home/io/io-dev/io/frontend/src/pages/settings/ExportPresets.tsx`
- `/home/io/io-dev/io/frontend/src/pages/settings/Recognition.tsx`
- `/home/io/io-dev/io/frontend/src/pages/settings/SettingsPageLayout.tsx`

**Implementation Steps:**

1. **Read all listed files.** For each file, note: (a) hardcoded hex/rgba values, (b) local style constants that duplicate settingsStyles, (c) local Tabs components, (d) `window.confirm()` calls, (e) undefined tokens like `var(--io-bg)` or `var(--io-surface-tertiary)`, (f) hand-rolled position:fixed modals.

2. **Update SettingsPageLayout.tsx:**
   - Ensure the content wrapper uses `maxWidth` prop with `marginRight: 'auto'` (left-aligned, not centered)
   - Add a `variant` prop: `'form'` (max-width 960px) or `'list'` (max-width 1200px), default `'form'`

3. **Extract RestorePreviewModal** from BulkUpdate.tsx:
   - Create `/home/io/io-dev/io/frontend/src/pages/settings/RestorePreviewModal.tsx`
   - Move the `RestorePreviewModal` component and its types from BulkUpdate.tsx into this new file
   - Update BulkUpdate.tsx to import from the new file
   - Update Snapshots.tsx to import from the new file (instead of from BulkUpdate)

4. **For each file listed in "Files to Modify"**, apply these fixes:

   **Certificates.tsx:**
   - Replace `OPC_STATUS` hardcoded colors: `rgba(34,197,94,0.12)` → `color-mix(in srgb, var(--io-success) 12%, transparent)` or inline opacity, `#22C55E` → `var(--io-success)`, `rgba(234,179,8,0.12)` → success pattern with warning, `#EAB308` → `var(--io-warning)`, `rgba(239,68,68,0.12)` → danger pattern, `#EF4444` → `var(--io-danger)`
   - Replace context menu `position:fixed` with proper handling
   - Replace local styles with settingsStyles imports

   **SystemHealth.tsx:**
   - Replace `STATUS_COLORS` constant: same pattern as Certificates — use `var(--io-success)`, `var(--io-warning)`, `var(--io-danger)` with appropriate background opacity
   - Replace local `Tabs` component with `SettingsTabs`
   - Replace local styles with settingsStyles imports

   **Email.tsx:**
   - Replace local `Tabs` component with `SettingsTabs`
   - Replace local styles with settingsStyles imports
   - Check for hardcoded colors and fix

   **About.tsx:**
   - Fix `rgba(0,0,0,0.5)` modal backdrop → `var(--io-overlay, rgba(0,0,0,0.5))`
   - Verify modal uses Radix Dialog; if not, convert

   **EulaAdmin.tsx:**
   - Replace fullscreen dialog `position:fixed` at 95vw with Radix Dialog (fullscreen variant)
   - Verify `var(--io-radius-lg)` exists; if not, replace with `calc(var(--io-radius) * 2)` or `10px`

   **BulkUpdate.tsx:**
   - Fix `var(--io-bg)` → `var(--io-surface-primary)`
   - Fix `var(--io-surface-tertiary)` → `var(--io-surface-sunken)`
   - Remove `RestorePreviewModal` export (now in its own file)
   - Replace local styles with settingsStyles imports

   **Snapshots.tsx:**
   - Fix `var(--io-bg)` → `var(--io-surface-primary)`
   - Update import of `RestorePreviewModal` to new file path
   - Replace local styles with settingsStyles imports

   **ReportScheduling.tsx:**
   - Replace `useAuthStore` direct permission check with consistent pattern (check how other pages do it after Phase 1)
   - Remove `🔒` emoji — replace with a text label or icon
   - Replace local styles with settingsStyles imports

   **ExportPresets.tsx:**
   - Add empty state with descriptive text when no presets exist
   - Add `cursor: pointer` to clickable rows
   - Replace local styles with settingsStyles imports

   **Recognition.tsx:**
   - Fix `var(--io-surface-tertiary)` → `var(--io-surface-sunken)`
   - Replace local styles with settingsStyles imports

5. **Verify:** Run `pnpm build` and `pnpm lint`. Fix all errors.

**Strict Rules for This Phase:**
- Use CSS custom properties exclusively — never hardcode hex/rgb colors
- Use Radix Dialog for ALL modals
- All components must use design tokens from var(--io-*) namespace
- For status color backgrounds with opacity, use inline `opacity` on a child element or `background: var(--io-success); opacity: 0.12` on a wrapper — do NOT use rgba with hardcoded values
- Do NOT change any functional behavior — this phase is purely visual/structural
- Remove ALL emoji characters from settings pages

**When Done:**
- Run `pnpm build` from `/home/io/io-dev/io/frontend` and fix any TypeScript errors
- Run `pnpm lint` and fix any ESLint errors
- Verify all settings pages render correctly with no visible hardcoded-color artifacts
- Verify all modals use consistent Radix Dialog styling
- Post the next phase's implementation prompt (Phase 8) into the Claude Code window

[End of Phase 7 Implementation Prompt]

---

## Phase 8: Missing Functionality from Spec

### Goal

Add the remaining settings pages and controls required by the design docs that don't yet exist: General settings, Graphics settings, Access Control stub, and various missing controls flagged in the audit.

### What This Phase Does

**Files to Create:**
- `frontend/src/pages/settings/GeneralSettings.tsx` — Application-level settings (export path, watermark toggle/text/opacity, worker pool size, auto-cleanup retention)
- `frontend/src/pages/settings/GraphicsSettings.tsx` — Shape style global setting (ISA standard vs Graphical/realistic)
- `frontend/src/pages/settings/AccessControl.tsx` — Badge source adapters and muster point configuration (stub with correct structure for future implementation)

**Files to Modify:**
- `frontend/src/pages/settings/index.tsx` — Add General, Graphics, Access Control to nav
- `frontend/src/App.tsx` — Add routes for new pages
- `frontend/src/pages/settings/Certificates.tsx` — Add ACME/Let's Encrypt section, add CSR generation section
- `frontend/src/pages/settings/PointManagement.tsx` — Add deadband column, add data category assignment

**Files to Delete:**
- `frontend/src/pages/settings/AlertConfig.tsx` — Navigation launcher only; alerts config belongs in the Alerts module
- `frontend/src/pages/settings/EventConfig.tsx` — Static informational only; not a settings page
- `frontend/src/pages/settings/Badges.tsx` — Static informational only; superseded by AccessControl.tsx

### Acceptance Criteria

- `/settings/general` page exists with: export file storage path, worker pool concurrent exports, auto-cleanup retention, PDF watermark text + enable/disable + opacity
- `/settings/graphics` page exists with: shape style toggle (ISA Standard vs Graphical), description of what each style looks like
- `/settings/access-control` page exists with: badge source adapter list (empty state with explanation), muster point configuration list (empty state), presence management settings (stale timeout, shift-end auto-clear toggle, retention days)
- General, Graphics, Access Control appear in the nav under appropriate groups
- Certificates page has an "ACME / Auto-Renewal" section with: enable toggle, challenge type select (HTTP-01/DNS-01), email input, and status display
- Certificates page has a "Generate CSR" section with: hostname input, SANs textarea, organization input, key type select
- PointManagement has deadband column (number input per point) and data category dropdown per point
- AlertConfig.tsx, EventConfig.tsx, and Badges.tsx are deleted
- Their routes are removed from App.tsx
- `pnpm build` and `pnpm lint` pass

### Dependencies

Phase 1 (all shared components), Phase 7 (Certificates already cleaned up)

---
### IMPLEMENTATION PROMPT (copy this entire block to kick off Sonnet)

[SETTINGS OVERHAUL — PHASE 8: MISSING FUNCTIONALITY FROM SPEC]

You are implementing Phase 8 of the Settings module overhaul for Inside/Operations. This is the final phase.

**Before you start:**
1. Read `/home/io/io-dev/io/docs/plans/settings-overhaul-plan.md` — find Phase 8 and read it completely
2. Read all files listed in "Files to Read" below
3. Do NOT deviate from the plan. If something in the plan conflicts with what you find in the code, note it and follow the plan.

**Files to Read:**
- `/home/io/io-dev/io/docs/plans/settings-overhaul-plan.md` — Phase 8 section
- `/home/io/io-dev/io/docs/research/settings-review/02-design-docs-part1.md` — For General settings requirements (doc 25: export system)
- `/home/io/io-dev/io/docs/research/settings-review/03-design-docs-part2.md` — For Access Control requirements (doc 30), Graphics requirements (doc 35)
- `/home/io/io-dev/io/frontend/src/pages/settings/Certificates.tsx` — To add ACME and CSR sections
- `/home/io/io-dev/io/frontend/src/pages/settings/PointManagement.tsx` — To add deadband and category columns
- `/home/io/io-dev/io/frontend/src/pages/settings/AlertConfig.tsx` — To be deleted
- `/home/io/io-dev/io/frontend/src/pages/settings/EventConfig.tsx` — To be deleted
- `/home/io/io-dev/io/frontend/src/pages/settings/Badges.tsx` — To be deleted
- `/home/io/io-dev/io/frontend/src/pages/settings/settingsStyles.ts` — Shared styles
- `/home/io/io-dev/io/frontend/src/pages/settings/SettingsPageLayout.tsx` — Page layout
- `/home/io/io-dev/io/frontend/src/shared/components/SettingsTabs.tsx` — Tabs
- `/home/io/io-dev/io/frontend/src/pages/settings/index.tsx` — Nav to update
- `/home/io/io-dev/io/frontend/src/App.tsx` — Routes to update
- `/home/io/io-dev/io/frontend/src/api/settings.ts` — Settings API for General settings

**Files to Create:**
- `/home/io/io-dev/io/frontend/src/pages/settings/GeneralSettings.tsx`
- `/home/io/io-dev/io/frontend/src/pages/settings/GraphicsSettings.tsx`
- `/home/io/io-dev/io/frontend/src/pages/settings/AccessControl.tsx`

**Files to Modify:**
- `/home/io/io-dev/io/frontend/src/pages/settings/Certificates.tsx`
- `/home/io/io-dev/io/frontend/src/pages/settings/PointManagement.tsx`
- `/home/io/io-dev/io/frontend/src/pages/settings/index.tsx`
- `/home/io/io-dev/io/frontend/src/App.tsx`

**Files to Delete:**
- `/home/io/io-dev/io/frontend/src/pages/settings/AlertConfig.tsx`
- `/home/io/io-dev/io/frontend/src/pages/settings/EventConfig.tsx`
- `/home/io/io-dev/io/frontend/src/pages/settings/Badges.tsx`

**Implementation Steps:**

1. **Read all listed files.**

2. **Create GeneralSettings.tsx** at `/home/io/io-dev/io/frontend/src/pages/settings/GeneralSettings.tsx`:
   - Use `SettingsPageLayout` with title "General", description "Application-wide settings"
   - Fetch current settings from `GET /api/settings` (use `settingsApi` or create appropriate API call)
   - Save via `PUT /api/settings`
   - Settings sections (use section cards with headers):
     - **Export Configuration**: 
       - Export file storage path (text input, default `/opt/insideoperations/exports/`)
       - Max concurrent exports (number input, default 3)
       - Auto-cleanup retention period (number input + unit select, default 24 hours)
     - **PDF Watermark**:
       - Enabled toggle (default on)
       - Watermark text (text input, default "UNCONTROLLED COPY")
       - Opacity (range slider or number input, 1-100%, default 10%)
   - Use styles from settingsStyles.ts
   - Handle loading/error/saving states

3. **Create GraphicsSettings.tsx** at `/home/io/io-dev/io/frontend/src/pages/settings/GraphicsSettings.tsx`:
   - Use `SettingsPageLayout` with title "Graphics", description "Global graphics and shape rendering settings"
   - **Shape Style** section:
     - Radio button group: "ISA Standard" (clean geometric ISA/IEC 62264 style) vs "Graphical" (more realistic/detailed equipment icons)
     - Description text under each option explaining the visual difference
     - Note: "Per-instance overrides are available in the Designer module"
   - Fetch/save via settings API with key `graphics.shape_style` (value: `isa_standard` or `graphical`)
   - Use styles from settingsStyles.ts

4. **Create AccessControl.tsx** at `/home/io/io-dev/io/frontend/src/pages/settings/AccessControl.tsx`:
   - Use `SettingsPageLayout` with title "Access Control", description "Badge reader integration and muster point management"
   - Use `SettingsTabs` with 3 tabs: "Badge Sources", "Muster Points", "Presence Settings"
   - **Badge Sources tab**:
     - Empty state: "No badge source adapters configured. Badge sources connect I/O to physical access control systems (Lenel OnGuard, CCURE 9000, Genetec, etc.)."
     - "Add Badge Source" button (disabled with tooltip "Configuration available when badge integration is deployed")
     - If API exists, list badge sources with adapter_type, polling_interval, enabled status
   - **Muster Points tab**:
     - Empty state: "No muster points configured. Muster points define assembly locations for emergency accountability."
     - "Add Muster Point" button (similar pattern)
   - **Presence Settings tab**:
     - Stale presence timeout (number input, default 16 hours, range description "10-300 seconds")
     - Shift-end auto-clear toggle (default off)
     - Badge events retention (number input, default 90 days)
     - Shifts data retention (number input, default 730 days)
   - Wire to appropriate APIs; handle 404 gracefully

5. **Modify Certificates.tsx — add ACME section:**
   - Add a section card "ACME / Auto-Renewal" below the existing certificate list:
     - Enable auto-renewal toggle
     - Challenge type select: HTTP-01, DNS-01
     - Account email input
     - If DNS-01 selected: DNS provider select (Cloudflare, Route53, etc.) + API credentials inputs
     - Status display: "Last check: [timestamp]", "Next renewal: [date]", "Status: [active/inactive/error]"
   - Wire to `GET/PUT /api/certificates/acme` (handle 404 gracefully)

6. **Modify Certificates.tsx — add CSR generation section:**
   - Add a section card "Generate Certificate Signing Request" below ACME:
     - Hostname input (required)
     - Subject Alternative Names textarea (one per line)
     - Organization input
     - Key type select: RSA 4096, RSA 2048, ECDSA P-256, ECDSA P-384
     - "Generate CSR" button → calls `POST /api/certificates/csr` → displays PEM output in a readonly textarea with copy button
   - Handle API errors gracefully

7. **Modify PointManagement.tsx:**
   - Add a "Deadband" column to the points table — number input per point (save on blur or via edit modal)
   - Add a "Category" column with a dropdown populated from data categories
   - Wire deadband to point metadata update API
   - Wire category to point metadata update API

8. **Update index.tsx nav:**
   - Add "General" to the SYSTEM group: `{ path: "/settings/general", label: "General", permission: "system:system_settings" }`
   - Add "Graphics" to the DATA SOURCES group (or CONTENT & EXPORT): `{ path: "/settings/graphics", label: "Graphics" }`
   - Add "Access Control" to the IDENTITY & ACCESS group: `{ path: "/settings/access-control", label: "Access Control", permission: "badge_config:manage" }`
   - Remove AlertConfig, EventConfig, Badges from any nav references (they should already be absent, but verify)

9. **Update App.tsx:**
   - Add lazy imports for GeneralSettings, GraphicsSettings, AccessControl
   - Add routes: `/settings/general`, `/settings/graphics`, `/settings/access-control`
   - Remove routes for AlertConfig (`/settings/alerts`), EventConfig (`/settings/events`), Badges (`/settings/badges`)

10. **Delete files:**
    - Delete `/home/io/io-dev/io/frontend/src/pages/settings/AlertConfig.tsx`
    - Delete `/home/io/io-dev/io/frontend/src/pages/settings/EventConfig.tsx`
    - Delete `/home/io/io-dev/io/frontend/src/pages/settings/Badges.tsx`

11. **Verify:** Run `pnpm build` and `pnpm lint`. Fix all errors. Verify all new routes are reachable from the nav.

**Strict Rules for This Phase:**
- Use CSS custom properties exclusively — never hardcode hex/rgb colors
- Use Radix Dialog for any modals
- All new components must use design tokens from var(--io-*) namespace
- New pages that call APIs that don't exist yet must handle 404/network errors gracefully with a user-friendly message — never show raw error JSON
- Access Control page is a functional stub — it should have the correct UI structure and API wiring even if the backend isn't implemented yet
- Do not include emoji in any new page

**When Done:**
- Run `pnpm build` from `/home/io/io-dev/io/frontend` and fix any TypeScript errors
- Run `pnpm lint` and fix any ESLint errors
- Verify all new pages render correctly
- Verify the nav has all new entries in the correct groups
- This is the final phase. Post a completion summary into the Claude Code window listing:
  1. Total files created, modified, and deleted across all 8 phases
  2. Final nav structure with all groups and items
  3. Any known issues or future work items discovered during implementation

[End of Phase 8 Implementation Prompt]

---

## Appendix: File Inventory After All Phases

### New Files Created
| File | Phase | Purpose |
|------|-------|---------|
| `shared/components/SettingsTabs.tsx` | 1 | Reusable tab bar |
| `pages/settings/settingsStyles.ts` | 1 | Shared style constants |
| `shared/components/ConfirmDialog.tsx` | 1 | Radix AlertDialog wrapper |
| `pages/settings/SettingsPageLayout.tsx` | 1 | Standard page header + max-width |
| `pages/profile/index.tsx` | 2 | Profile page shell |
| `pages/profile/ProfileTab.tsx` | 2 | User profile info |
| `pages/profile/SecurityTab.tsx` | 2 | Personal MFA + API keys |
| `pages/profile/SessionsTab.tsx` | 2 | My sessions |
| `pages/profile/PreferencesTab.tsx` | 2 | Theme/density/format |
| `pages/settings/IdentityAccess.tsx` | 3 | Consolidated identity page |
| `pages/settings/SystemSettings.tsx` | 6 | Consolidated archive + backup |
| `pages/settings/RestorePreviewModal.tsx` | 7 | Extracted shared modal |
| `pages/settings/GeneralSettings.tsx` | 8 | Application settings |
| `pages/settings/GraphicsSettings.tsx` | 8 | Shape style global setting |
| `pages/settings/AccessControl.tsx` | 8 | Badge/muster config |

### Files Deleted
| File | Phase | Reason |
|------|-------|--------|
| `pages/settings/Health.tsx` | 1 | Superseded by SystemHealth.tsx |
| `pages/settings/Appearance.tsx` | 1 | Superseded by Display.tsx |
| `pages/settings/OpcConfig.tsx` | 1 | 10-line stub; OpcSources is definitive |
| `pages/settings/DataSources.tsx` | 1 | 19-line stub; OpcSources is definitive |
| `pages/settings/Security.tsx` | 1 | Broken aggregation; components have own routes |
| `pages/settings/Display.tsx` | 2 | Migrated to profile/PreferencesTab |
| `pages/settings/ApiKeys.tsx` | 2 | Migrated to profile/SecurityTab |
| `pages/settings/AlertConfig.tsx` | 8 | Navigation launcher only; belongs in Alerts module |
| `pages/settings/EventConfig.tsx` | 8 | Static informational; not a settings page |
| `pages/settings/Badges.tsx` | 8 | Static informational; superseded by AccessControl |

### Final Nav Structure
```
IDENTITY & ACCESS
  Users & Roles          /settings/identity
  Access Control         /settings/access-control

AUTHENTICATION
  Auth Providers         /settings/auth-providers
  MFA Policy             /settings/mfa
  SCIM                   /settings/scim
  SMS Providers          /settings/sms-providers

DATA SOURCES
  OPC Sources            /settings/opc-sources
  Point Management       /settings/points
  Expressions            /settings/expressions
  Import                 /settings/import
  Graphics               /settings/graphics

NOTIFICATIONS
  Email                  /settings/email

SYSTEM
  General                /settings/general
  System Health          /settings/system-health
  Archive & Backup       /settings/system
  Certificates           /settings/certificates

CONTENT & EXPORT
  Report Scheduling      /settings/report-scheduling
  Export Presets          /settings/export-presets
  Bulk Update            /settings/bulk-update
  Change Snapshots       /settings/snapshots
  Recognition            /settings/recognition

ABOUT
  EULA                   /settings/eula
  About                  /settings/about
```

Total: 7 groups, 21 nav items (down from 26 flat + 8 hidden = 34 total routes).
