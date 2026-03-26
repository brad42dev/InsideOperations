---
id: DD-15-001
title: Add PermissionGuard to unprotected settings routes
unit: DD-15
status: pending
priority: high
depends-on: []
---

## What This Feature Should Do

Every settings sub-route must require the appropriate RBAC permission before rendering. Currently nine routes render their components without any permission check, meaning any authenticated user — regardless of role — can access Certificates, Backup & Restore, Expression Library, Report Scheduling, Export Presets, Security, Display, Appearance, Health, and About pages.

## Spec Excerpt (verbatim)

> Only Admin role can access Settings module
> Password changes require current password
> Audit all setting changes
> — 15_SETTINGS_MODULE.md, §Security

> Every module route checks the required permission on load. No module is accessible without the correct permission.
> — SPEC_MANIFEST.md, §CX-RBAC Non-negotiables #1

## Where to Look in the Codebase

Primary files:
- `frontend/src/App.tsx` lines 921–937, 946 — the nine unguarded routes inside the `<Route path="settings">` block

## Verification Checklist

- [ ] `/settings/certificates` route is wrapped with `<PermissionGuard permission="system:certificates">` or `"system:configure"`
- [ ] `/settings/backup` route is wrapped with `<PermissionGuard permission="system:change_backup">`
- [ ] `/settings/expressions` route is wrapped with an appropriate permission guard
- [ ] `/settings/report-scheduling` route is wrapped with an appropriate permission guard
- [ ] `/settings/export-presets` route is wrapped with an appropriate permission guard
- [ ] `/settings/security` route is wrapped with `<PermissionGuard permission="system:configure">` or `"auth:configure"`
- [ ] `/settings/display`, `/settings/appearance`, `/settings/health`, `/settings/about` routes are wrapped (use `permission={null}` for truly public-to-all-authenticated routes, or an appropriate permission)

## Assessment

- **Status**: ❌ Missing
- **If partial/missing**: App.tsx lines 921–924 and 933–937, 946 have bare `<Route path="..." element={<Component />} />` with no PermissionGuard

## Fix Instructions

In `frontend/src/App.tsx`, wrap each of the following routes in a `<PermissionGuard>`:

```tsx
// Lines ~921-924 (display, appearance, health, about)
// These are accessible to all authenticated users — use permission={null} to retain auth check
<Route path="display" element={<PermissionGuard permission={null}><Display /></PermissionGuard>} />
<Route path="appearance" element={<PermissionGuard permission={null}><AppearancePage /></PermissionGuard>} />
<Route path="health" element={<PermissionGuard permission="system:monitor"><HealthPage /></PermissionGuard>} />
<Route path="about" element={<PermissionGuard permission={null}><AboutPage /></PermissionGuard>} />

// Lines ~933-937 (admin-only pages)
<Route path="certificates" element={<PermissionGuard permission="system:certificates"><CertificatesPage /></PermissionGuard>} />
<Route path="backup" element={<PermissionGuard permission="system:change_backup"><BackupRestorePage /></PermissionGuard>} />
<Route path="expressions" element={<PermissionGuard permission="system:configure"><ExpressionLibrary /></PermissionGuard>} />
<Route path="report-scheduling" element={<PermissionGuard permission="reports:schedule_manage"><ReportScheduling /></PermissionGuard>} />
<Route path="export-presets" element={<PermissionGuard permission="settings:export"><ExportPresets /></PermissionGuard>} />

// Line ~946
<Route path="security" element={<PermissionGuard permission="system:configure"><SecurityPage /></PermissionGuard>} />
```

Cross-reference `design-docs/03_SECURITY_RBAC.md` for the canonical permission name for each page. Use the permissions already applied to similar routes as a guide (`system:configure` is used for `eula` at line 928).

Do NOT:
- Remove existing PermissionGuards on routes that already have them
- Use `permission={null}` for admin-only pages — null means "any authenticated user is allowed"
- Introduce new permission strings not defined in doc 03
