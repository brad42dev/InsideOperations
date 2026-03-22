---
id: DD-38-001
title: Create RouteConfig registry at src/shared/routes/registry.ts
unit: DD-38
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

A central `RouteConfig[]` array in `src/shared/routes/registry.ts` should define every route in the application with its path, component, required permission, sidebar group, label, icon, G-key, breadcrumb root, and mobile flag. Both the React Router config (`App.tsx`) and the sidebar navigation (`AppShell.tsx`) must be driven from this single source of truth — not maintain duplicate parallel structures.

## Spec Excerpt (verbatim)

> "Implementation: A `RouteConfig[]` array in `src/shared/routes/registry.ts` drives both the router and the sidebar."
> — 38_FRONTEND_CONTRACTS.md, §1 Route Map & Permission Guard Registry

> ```typescript
> interface RouteConfig {
>   path: string;
>   component: string;
>   permission: string | null;
>   sidebar_group: SidebarGroup;
>   sidebar_label: string;
>   sidebar_icon: string;
>   g_key: string;
>   breadcrumb_root: string;
>   mobile: boolean;
> }
> type SidebarGroup = 'monitoring' | 'analysis' | 'operations' | 'management';
> ```
> — 38_FRONTEND_CONTRACTS.md, §1

## Where to Look in the Codebase

Primary files:
- `frontend/src/App.tsx` — current inline `<Route>` definitions, no registry used
- `frontend/src/shared/layout/AppShell.tsx:39–71` — `NAV_GROUPS`/`NAV_ITEMS` array, parallel data to what the registry should own
- `frontend/src/shared/routes/registry.ts` — does not exist, must be created

## Verification Checklist

- [ ] `frontend/src/shared/routes/registry.ts` exists
- [ ] File exports a `RouteConfig[]` array containing all 11 top-level module routes with `sidebar_group`, `sidebar_label`, `sidebar_icon`, `g_key`, and `mobile` fields
- [ ] `AppShell.tsx` `NAV_GROUPS` is derived from the registry (not a separate hardcoded array)
- [ ] The G-key map in `AppShell.tsx` is derived from `registry.g_key` fields (not a separate hardcoded `G_KEY_MAP`)
- [ ] The `interface RouteConfig` and `type SidebarGroup` are exported from the registry file

## Assessment

- **Status**: ❌ Missing
- **If partial/missing**: The file does not exist. The router (App.tsx) and sidebar (AppShell.tsx:39) maintain independent parallel data structures. Any route or permission change requires editing two places.

## Fix Instructions

Create `frontend/src/shared/routes/registry.ts`:

1. Define `interface RouteConfig` and `type SidebarGroup` as specified in doc 38 §1.
2. Export a `ROUTE_REGISTRY: RouteConfig[]` containing all 11 top-level module entries (use the Complete Route Table in doc 38 for all values).
3. Export a helper `function getSidebarGroups(permissions: string[]): NavGroup[]` that filters the registry by `permission` and groups by `sidebar_group`.
4. In `AppShell.tsx`, replace the hardcoded `NAV_GROUPS` array (lines 39–71) with a call to `getSidebarGroups(user.permissions)`.
5. In `AppShell.tsx`, replace the hardcoded `G_KEY_MAP` (lines 287–298) by deriving it from `ROUTE_REGISTRY`: `Object.fromEntries(ROUTE_REGISTRY.filter(r => r.g_key).map(r => [r.g_key.split(' ')[1].toLowerCase(), r.path]))`.

Do NOT:
- Remove the `<Route>` elements from App.tsx — those are React Router's rendering config and are separate from the registry's metadata purpose.
- Add sub-route entries to the registry — only the 11 top-level sidebar entries need to be in the registry for the sidebar and G-key concerns.
- Change the `interface RouteConfig.component` field to an actual React component reference — keep it as a `string` per spec.
