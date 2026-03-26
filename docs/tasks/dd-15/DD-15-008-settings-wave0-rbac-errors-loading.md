---
id: DD-15-008
title: Add ErrorBoundary wrapper, export buttons, entity right-click menus, and skeleton loading to Settings module
unit: DD-15
status: pending
priority: medium
depends-on: [DD-15-001]
---

## What This Feature Should Do

The Settings module must satisfy four Wave 0 cross-cutting contracts: (1) a React ErrorBoundary wrapping the module so a crash in one settings page doesn't take down the app shell; (2) export buttons on all entity tables (users, roles, OPC sources, etc.) supporting all 6 formats; (3) entity right-click context menus on table rows for CRUD actions; (4) module-shaped skeleton loading states instead of plain text spinners.

## Spec Excerpt (verbatim)

> Each module's content area is wrapped in a **React error boundary**. A crash in one module does not take down the app shell or other modules.
> — SPEC_MANIFEST.md, §CX-ERROR Non-negotiables #1

> Every qualifying module table/toolbar has an **Export button**. It is not buried in a menu.
> Supported formats: **CSV, XLSX, PDF, JSON, Parquet, HTML** (6 formats).
> Module: Settings — What gets exported: Points, users, roles, OPC sources, etc. Permission: `settings:export`
> — SPEC_MANIFEST.md, §CX-EXPORT Non-negotiables

> Right-clicking any row in an entity list opens a context menu. An entity list with no right-click behavior is wrong.
> — SPEC_MANIFEST.md, §CX-ENTITY-CONTEXT Non-negotiables #1

> Each module provides a **module-shaped skeleton** that matches the structure of the content being loaded.
> — SPEC_MANIFEST.md, §CX-LOADING Non-negotiables #1

## Where to Look in the Codebase

Primary files:
- `frontend/src/App.tsx` line 791 — the `<Route path="settings" element={<SettingsShell />}>` definition
- `frontend/src/shared/components/ErrorBoundary.tsx` — existing ErrorBoundary component used by other modules
- `frontend/src/pages/settings/Users.tsx` lines 611–870 — table with "Loading users..." text at line 648
- `frontend/src/pages/settings/Roles.tsx` — similar table loading pattern
- `frontend/src/pages/settings/OpcSources.tsx` — table loading pattern

## Verification Checklist

- [ ] `SettingsShell` is wrapped in `<ErrorBoundary module="Settings">` in App.tsx
- [ ] Users table toolbar has an `[Export v]` split button (6 formats, permission `settings:export`)
- [ ] Roles table toolbar has an `[Export v]` split button
- [ ] OPC Sources table toolbar has an `[Export v]` split button
- [ ] Users table rows respond to right-click with a context menu (Edit, Disable/Enable, Delete actions)
- [ ] Roles table rows respond to right-click with a context menu (Edit, Clone, Delete actions)
- [ ] Users table loading state is a skeleton (rows with shimmer cells) not a "Loading users..." text
- [ ] Roles table loading state is a skeleton not a text spinner

## Assessment

- **Status**: ❌ Missing (all four Wave 0 checks fail)
- **If partial/missing**: App.tsx:791 has no ErrorBoundary around SettingsShell. Users.tsx:648 shows "Loading users…" plain text. No `onContextMenu` handlers in any settings file. No export buttons in any settings table.

## Fix Instructions

**1. ErrorBoundary wrapper** — in `frontend/src/App.tsx`, wrap the settings Route:
```tsx
<Route path="settings" element={
  <ErrorBoundary module="Settings">
    <SettingsShell />
  </ErrorBoundary>
}>
```

**2. Export buttons** — add to Users, Roles, and OpcSources table toolbars. The existing `ExportButton` or `ExportSplitButton` shared component used in other modules should be reused here. Place it in the header row next to "+ Add User" / "+ Add Role" / "+ Add Source". Pass the current data + filters to the export handler. Permission: `settings:export`.

If no shared export button component exists, check other modules that already have export (Console, Process — per the Wave 0 applies-to matrix) for the pattern to follow.

**3. Entity right-click menus** — add `onContextMenu` handler to each `<tr>` in the entity tables. The `EntityContextMenu` shared component (if it exists from the CX-ENTITY-CONTEXT audit) should be used. If not yet implemented, create context menus using Radix UI `DropdownMenu` triggered on right-click:
- Users row: Edit, Disable/Enable, View Sessions, Copy Username
- Roles row: Edit Permissions, Clone Role (copies permissions to a new role), Delete (blocked for predefined roles)
- OPC Sources row: Edit, Enable/Disable, Test Connection, Delete

**4. Skeleton loading states** — replace plain "Loading..." text with table skeleton components. A table skeleton renders the same number of columns as the real table, with each cell containing a shimmer rectangle. See how other modules implement this (search for `Skeleton` or `shimmer` in `frontend/src/shared/components/`). If no shared skeleton exists, create one that accepts `rows` and `columns` props.

Also fix the hardcoded `#09090b` color in Users.tsx:34 — replace with `var(--io-text-on-accent)` or whatever token is used for button label colors on accent backgrounds.

Do NOT:
- Use a generic full-page spinner for loading states — the skeleton must match the table structure
- Put export buttons inside a dropdown menu — they must be visible in the toolbar
- Export forbidden fields (password_hash, refresh_token, connection secrets) per spec §Data Export
