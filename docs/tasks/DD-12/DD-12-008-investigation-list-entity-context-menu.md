---
id: DD-12-008
title: Add right-click context menu to investigation list rows
unit: DD-12
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

Right-clicking a row in the Forensics investigation list (InvestigationCard) must open a CX-ENTITY-CONTEXT context menu with investigation-specific actions: Open, Close/Cancel (when active), Export, Share, Delete. This follows the P2 pattern defined in the context-menu spec.

## Spec Excerpt (verbatim)

> Right-clicking any row in an entity list opens a context menu. An entity list with no right-click behavior is wrong.
> — SPEC_MANIFEST.md, §CX-ENTITY-CONTEXT, Non-negotiable #1

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/forensics/index.tsx` — `InvestigationCard` at lines 182–236; has `onClick` and mouse hover handlers but no `onContextMenu`
- `frontend/src/shared/components/` — look for a shared `EntityContextMenu` or `ContextMenu` component used by other modules

## Verification Checklist

- [ ] Right-clicking an InvestigationCard opens a Radix UI ContextMenu (not a custom div)
- [ ] Menu includes: Open, Close (when status=active), Cancel (when status=active), Export, Share, Delete
- [ ] Destructive actions (Delete, Cancel) are separated from navigational actions by a separator
- [ ] Delete is only shown when investigation is active (closed investigations cannot be deleted per spec)
- [ ] Permission-lacking items are hidden (not disabled) — e.g., Export hidden without `forensics:export`

## Assessment

- **Status**: ❌ Missing
- **If partial/missing**: InvestigationCard (index.tsx:182–236) has only `onClick` and `onMouseEnter`/`onMouseLeave` hover styling. No `onContextMenu` handler, no Radix ContextMenu wrapper.

## Fix Instructions

In `frontend/src/pages/forensics/index.tsx`, update `InvestigationCard`:

1. Import Radix `ContextMenu` primitives: `import * as ContextMenu from '@radix-ui/react-context-menu'`

2. Wrap the card `<div>` in `<ContextMenu.Root><ContextMenu.Trigger asChild>...</ContextMenu.Trigger>`:
   ```tsx
   <ContextMenu.Root>
     <ContextMenu.Trigger asChild>
       <div onClick={onClick} ...>
         {/* existing card content */}
       </div>
     </ContextMenu.Trigger>
     <ContextMenu.Portal>
       <ContextMenu.Content style={menuContentStyle}>
         <ContextMenu.Item onSelect={() => navigate(`/forensics/${inv.id}`)}>Open</ContextMenu.Item>
         <ContextMenu.Separator />
         {inv.status === 'active' && <ContextMenu.Item onSelect={handleClose}>Close</ContextMenu.Item>}
         {inv.status === 'active' && <ContextMenu.Item onSelect={handleCancel}>Cancel</ContextMenu.Item>}
         <ContextMenu.Separator />
         {canExport && <ContextMenu.Item onSelect={handleExport}>Export…</ContextMenu.Item>}
         {canShare && <ContextMenu.Item onSelect={handleShare}>Share…</ContextMenu.Item>}
         <ContextMenu.Separator />
         {inv.status === 'active' && <ContextMenu.Item onSelect={handleDelete} style={{ color: 'var(--io-danger)' }}>Delete</ContextMenu.Item>}
       </ContextMenu.Content>
     </ContextMenu.Portal>
   </ContextMenu.Root>
   ```

3. Menu items that require permissions (Export, Share) must use `usePermission` and be omitted when permission is lacking — not disabled.

4. Close/Cancel/Delete actions call the corresponding `forensicsApi` methods and invalidate the investigations query.

Do NOT:
- Implement the context menu as a custom positioned `<div>` — use Radix `ContextMenu` primitives
- Show Delete for closed investigations (spec: "closed investigations cannot be deleted")
