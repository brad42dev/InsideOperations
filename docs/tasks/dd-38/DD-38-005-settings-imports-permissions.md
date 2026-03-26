---
id: DD-38-005
title: Fix /settings/imports sub-route permission guards — use granular import permissions
unit: DD-38
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The three `/settings/imports/*` sub-routes (connections, definitions, history) should each use their own specific permission rather than the generic `settings:write`. This allows RBAC to grant users access to view import history without also granting them access to manage connections or definitions.

## Spec Excerpt (verbatim)

> | `/settings/imports/connections` | `ConnectionList` | `system:import_connections` | Settings > Imports > Connections |
> | `/settings/imports/definitions` | `DefinitionList` | `system:import_definitions` | Settings > Imports > Definitions |
> | `/settings/imports/history` | `ImportHistory` | `system:import_history` | Settings > Imports > History |
> — 38_FRONTEND_CONTRACTS.md, §1 Settings Sub-Routes

## Where to Look in the Codebase

Primary files:
- `frontend/src/App.tsx:981–1005` — the three `imports/connections`, `imports/definitions`, `imports/history` routes, all using `settings:write`
- `frontend/src/shared/types/permissions.ts` — verify `system:import_connections`, `system:import_definitions`, `system:import_history` are defined

## Verification Checklist

- [ ] `settings/imports/connections` route uses `permission="system:import_connections"`
- [ ] `settings/imports/definitions` route uses `permission="system:import_definitions"`
- [ ] `settings/imports/history` route uses `permission="system:import_history"`
- [ ] All three permissions exist in `frontend/src/shared/types/permissions.ts`

## Assessment

- **Status**: ⚠️ Wrong
- **If partial/missing**: App.tsx:983, 990, 998 all pass `permission="settings:write"`. The spec requires three distinct import-specific permissions.

## Fix Instructions

In `frontend/src/App.tsx`, update the three import sub-routes (currently around lines 981–1005):

```tsx
// BEFORE (all three use same wrong permission):
<Route path="imports/connections" element={<PermissionGuard permission="settings:write">...

// AFTER — each uses its specific permission:
<Route
  path="imports/connections"
  element={
    <PermissionGuard permission="system:import_connections">
      <ImportSettingsPage defaultTab="connections" />
    </PermissionGuard>
  }
/>
<Route
  path="imports/definitions"
  element={
    <PermissionGuard permission="system:import_definitions">
      <ImportSettingsPage defaultTab="definitions" />
    </PermissionGuard>
  }
/>
<Route
  path="imports/history"
  element={
    <PermissionGuard permission="system:import_history">
      <ImportSettingsPage defaultTab="runs" />
    </PermissionGuard>
  }
/>
```

Do NOT:
- Change the parent `settings/imports` route (currently `settings:write` or `system:import_connections`) — only the three sub-routes change.
- Change the `defaultTab` props — those are correct and should remain as-is.
