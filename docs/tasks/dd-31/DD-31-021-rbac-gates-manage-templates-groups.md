---
id: DD-31-021
title: Add alerts:manage_templates and alerts:manage_groups permission gates
unit: DD-31
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The "New Template" button in the Templates panel and the "New Group" button in the Groups panel (plus all Edit and Delete context-menu items) must be hidden from users who lack the required permission. `alerts:manage_templates` gates template create/edit/delete. `alerts:manage_groups` gates group create/edit/delete. Currently these actions are visible to anyone with `alerts:read`, letting operators and viewers see edit controls they cannot authorize.

## Spec Excerpt (verbatim)

> | Permission | Description | Default Roles |
> |------------|-------------|---------------|
> | `alerts:manage_templates` | Create, edit, delete notification templates | Admin |
> | `alerts:manage_groups` | Create, edit, delete alert groups and membership | Admin, Supervisor |
> — design-docs/31_ALERTS_MODULE.md, §RBAC Permissions

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/alerts/index.tsx` — `TemplatesPanel` function (~line 1219); "New Template" button (~line 1302); context-menu Edit (~line 1543), Duplicate (~line 1551), Delete (~line 1582)
- `frontend/src/pages/alerts/index.tsx` — `GroupsPanel` function (~line 1606); "New Group" button (~line 1680); context-menu Edit (~line 2003), Add Members (~line 2015), Delete (~line 2034)
- `frontend/src/shared/hooks/usePermission.ts` — `usePermission(permission: string): boolean`

## Verification Checklist

- [ ] `TemplatesPanel` calls `const canManageTemplates = usePermission('alerts:manage_templates')`
- [ ] "New Template" button is conditionally rendered: `{canManageTemplates && <button ...>}`
- [ ] Context-menu Edit, Duplicate, and Delete items in the templates panel are hidden (`disabled` or not rendered) when `!canManageTemplates`
- [ ] `GroupsPanel` calls `const canManageGroups = usePermission('alerts:manage_groups')`
- [ ] "New Group" button is conditionally rendered: `{canManageGroups && <button ...>}`
- [ ] Context-menu Edit, Add Members, and Delete items in the groups panel are hidden when `!canManageGroups`
- [ ] Read-only users (Viewer, Operator) see the template/group lists but no create/edit/delete controls

## Assessment

- **Status**: ❌ Missing
- **Current state**: `TemplatesPanel` (line ~1219) has no `usePermission` call. "New Template" button at line ~1302 is always rendered. Context-menu items Edit, Duplicate, Delete are always rendered for all users with `alerts:read`. Same issue in `GroupsPanel` (~line 1606): no permission check; "New Group" always visible; Edit/Delete context-menu items always visible.

## Fix Instructions

In `frontend/src/pages/alerts/index.tsx`:

**TemplatesPanel** (around line 1219):
1. Add at the top of the function:
   ```ts
   const canManageTemplates = usePermission('alerts:manage_templates')
   ```
2. Wrap "New Template" button: `{canManageTemplates && <button ...>+ New Template</button>}`
3. In the context menu for each template row, gate Edit, Duplicate, and Delete items:
   ```tsx
   {canManageTemplates && (
     <ContextMenuPrimitive.Item onSelect={...}>Edit</ContextMenuPrimitive.Item>
   )}
   {canManageTemplates && (
     <ContextMenuPrimitive.Item onSelect={...}>Duplicate</ContextMenuPrimitive.Item>
   )}
   {/* "Send Alert from Template" and "Test Send" are read-only — always show */}
   {canManageTemplates && (
     <>
       <ContextMenuPrimitive.Separator ... />
       <ContextMenuPrimitive.Item ...>Delete...</ContextMenuPrimitive.Item>
     </>
   )}
   ```

**GroupsPanel** (around line 1606):
1. Add at the top of the function:
   ```ts
   const canManageGroups = usePermission('alerts:manage_groups')
   ```
2. Wrap "New Group" button: `{canManageGroups && <button ...>+ New Group</button>}`
3. Gate context-menu Edit, Add Members, and Delete items on `canManageGroups`.
4. The inline Delete button in each group row (line ~1988) should also be gated: `{canManageGroups && <button ...>Delete</button>}`

Do NOT:
- Gate the "Send Alert from Template" or "Test Send" context-menu items — those require `alerts:send`, which is separate
- Gate the "View Members" context-menu item on groups — that is a read-only action covered by `alerts:read`
- Remove the context menu wrapper entirely — keep it but omit the destructive items for read-only users
