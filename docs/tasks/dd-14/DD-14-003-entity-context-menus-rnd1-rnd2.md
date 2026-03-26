---
id: DD-14-003
title: Implement RC-RND-1 and RC-RND-2 right-click context menus on template and instance list rows
unit: DD-14
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

Right-clicking any row in the Round Templates list must open the RC-RND-1 context menu (Edit Template, Duplicate, Manage Schedule, View History, Delete grayed if has active instances, Export Template Definition). Right-clicking any row in the instance lists (available, in-progress) must open the RC-RND-2 context menu (Pending: Start Round, Transfer; In-Progress: Open, Transfer; Completed: View Details, Export PDF, Reopen admin-only). These context menus follow the P2 base pattern plus entity-specific extensions.

## Spec Excerpt (verbatim)

> **Round Templates** (RC-RND-1): Edit Template, Duplicate, Manage Schedule, View History, Delete (grayed if has active instances), Export Template Definition.
> **Round Instances** (RC-RND-2): Menu varies by status — Pending: Start Round (grayed if not on assigned shift), Transfer; In-Progress: Open, Transfer; Completed: View Details, Export PDF, Reopen (admin only).
> — docs/SPEC_MANIFEST.md, §CX-ENTITY-CONTEXT Non-negotiables #5

> Right-clicking any row in an entity list opens a context menu. An entity list with no right-click behavior is wrong.
> — docs/SPEC_MANIFEST.md, §CX-ENTITY-CONTEXT Non-negotiables #1

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/rounds/RoundTemplates.tsx` — template card rows at lines 69-98, no `onContextMenu` handler
- `frontend/src/pages/rounds/ActiveRounds.tsx` — instance card rows at lines 94-117 (in-progress) and 128-152 (pending), no `onContextMenu` handler
- `frontend/src/pages/rounds/index.tsx` — template cards at lines 494-543, instance cards at lines 435-442, no `onContextMenu` handlers
- `frontend/src/shared/components/` — check for an existing `EntityContextMenu` or Radix ContextMenu wrapper to reuse

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] Template list rows in RoundTemplates.tsx have an `onContextMenu` (or Radix ContextMenu root wrapper) that opens RC-RND-1 menu
- [ ] RC-RND-1 menu contains at minimum: Edit Template, Duplicate, Manage Schedule, View History, Delete
- [ ] Delete in RC-RND-1 is grayed when the template has active instances, not hidden
- [ ] Instance card rows in ActiveRounds.tsx have context menus that vary by status per RC-RND-2
- [ ] Duplicate creates a copy with " (Copy)" suffix (not "Copy of…")
- [ ] Delete confirmation dialog appears before executing delete

## Assessment

After checking:
- **Status**: ❌ Missing
- **What's missing**: No `onContextMenu` handlers exist anywhere in the rounds pages. Template rows have only an Edit button and Print button (RoundTemplates.tsx:89-97). Schedule rows have only Pause/Resume (RoundSchedules.tsx:195-200). Instance cards have only Start/Continue buttons (ActiveRounds.tsx:141-148).

## Fix Instructions (if needed)

1. Check `frontend/src/shared/components/` for an existing Radix ContextMenu wrapper component. If one exists, use it. If not, build with `@radix-ui/react-context-menu` primitives.

2. For `RoundTemplates.tsx`, wrap each template card `<div>` (currently line 70) with a `ContextMenu.Root` + `ContextMenu.Trigger` + `ContextMenu.Content` containing RC-RND-1 items:
   - Edit Template → `navigate('/rounds/templates/${t.id}/edit')` — requires `rounds:template_manage`, hidden if lacking
   - Duplicate → POST to create a copy with name `${t.name} (Copy)` — requires `rounds:template_manage`, hidden if lacking
   - Manage Schedule → navigate to schedules view filtered by template
   - View History → navigate to history filtered by template
   - *Separator*
   - Delete → confirmation dialog then DELETE endpoint — grayed (not hidden) if template has active instances; tooltip "This template has active instances"
   - *Separator*
   - Export Template Definition → trigger JSON export of template JSONB

3. For `ActiveRounds.tsx` instance cards (lines 94-117 and 128-152), wrap with ContextMenu per RC-RND-2 pattern. The menu content varies by `inst.status`:
   - Pending: "Start Round" (grayed if not on assigned shift), "Transfer"
   - In-Progress: "Open", "Transfer"
   - Completed: "View Details", "Export PDF", "Reopen" (hidden unless user has `rounds:admin`)

4. The same context menu logic should be applied to the inline template/instance cards in `index.tsx` (lines 435-443, 494-543).

Do NOT:
- Implement custom `<div>` menus — use Radix ContextMenu primitives
- Gray out items the user lacks permission for — hidden is correct per CX-ENTITY-CONTEXT §Permission gating
- Execute delete without a confirmation dialog
- Use "Copy of…" as the duplicate suffix — spec requires " (Copy)"
