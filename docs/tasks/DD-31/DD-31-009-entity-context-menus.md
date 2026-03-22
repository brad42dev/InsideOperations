---
id: DD-31-009
title: Add right-click context menus to template and group list rows (CX-ENTITY-CONTEXT)
unit: DD-31
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

Right-clicking any row in the Alert Templates list must open a context menu with: Edit, Duplicate, Send Alert from Template, Test Send (to self), Delete (grayed for built-in). Right-clicking any row in the Alert Groups list must open a context menu with: Edit, Add Members, View Members, Delete (grayed if referenced by active templates). Both menus follow the P2 base pattern from CX-ENTITY-CONTEXT with group ordering: Primary actions → Secondary → Destructive → Clipboard last.

## Spec Excerpt (verbatim)

> **Alert Templates** (RC-ALT-3): Edit, Duplicate, Send Alert from Template, Test Send (to self), Delete.
> **Contact Groups** (RC-ALT-4): Edit, Add Members, View Members, Delete (grayed if referenced by active templates/rules).
> — `docs/SPEC_MANIFEST.md`, §CX-ENTITY-CONTEXT Non-negotiable #5

> Right-clicking any row in an entity list opens a context menu. An entity list with no right-click behavior is wrong.
> — `docs/SPEC_MANIFEST.md`, §CX-ENTITY-CONTEXT Non-negotiable #1

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/alerts/AlertTemplates.tsx` — `TemplateRow` component (line 45); add `onContextMenu` handler
- `frontend/src/pages/alerts/AlertGroups.tsx` — group row (line 205); add `onContextMenu` handler
- `frontend/src/pages/alerts/index.tsx` — `TemplatesPanel` (line 766) and `GroupsPanel` (line 989) — add context menu support
- `frontend/src/shared/components/` — check for a shared `EntityContextMenu` or `ContextMenu` component to reuse

## Verification Checklist

- [ ] Right-clicking a template row opens a context menu with: Edit, Duplicate, Send Alert from Template, Test Send, Delete
- [ ] Delete in template context menu is grayed (not hidden) for built-in (`is_system: true`) templates
- [ ] Right-clicking a group row opens a context menu with: Edit, Add Members, View Members, Delete
- [ ] All destructive actions (Delete) show a confirmation dialog before executing
- [ ] Clipboard Copy items are last in the menu order
- [ ] Context menu uses Radix UI ContextMenu primitives (not a custom `<div>` implementation)

## Assessment

- **Status**: ❌ Missing
- **If missing**: `AlertTemplates.tsx TemplateRow` (line 45) and the corresponding row in `AlertGroups.tsx` have no `onContextMenu` handler. `TemplatesPanel` in `index.tsx` similarly has no right-click support. No context menu component is referenced in any of the alerts files.

## Fix Instructions

1. Check `frontend/src/shared/components/` for an existing context menu component. If the project uses Radix UI `ContextMenu` elsewhere, follow that pattern.
2. For `AlertTemplates.tsx TemplateRow`, wrap the row `<div>` in `<ContextMenu.Root>` and add a `<ContextMenu.Trigger>` on the row. Provide `<ContextMenu.Content>` with items:
   - Edit (opens template editor — currently absent, create a modal or route)
   - Duplicate (calls create with " (Copy)" suffix)
   - Send Alert from Template (navigate to send form with template pre-selected)
   - Test Send (send to self via `alerts:send`)
   - (separator)
   - Delete — grayed with tooltip when `is_system: true`
3. For `AlertGroups.tsx`, wrap the group row in `<ContextMenu.Root>` and add:
   - Edit (name/description edit modal)
   - Add Members (searchable user picker)
   - View Members (navigate to group detail or show modal)
   - (separator)
   - Delete — grayed with tooltip if group is referenced
4. All Delete actions must show a confirmation dialog before calling the API.

Do NOT:
- Implement a custom `onContextMenu + <div>` overlay — use Radix UI ContextMenu primitives
- Show permission-lacking items grayed — hide them (except Delete which stays grayed when the object has dependencies)
