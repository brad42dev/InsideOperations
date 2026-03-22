---
id: MOD-DESIGNER-008
title: Add right-click context menus for layer panel (RC-DES-16) and guides (RC-DES-17)
unit: MOD-DESIGNER
status: pending
priority: low
depends-on: []
---

## What This Feature Should Do

The layer panel in the right panel and guide lines on the canvas both need right-click context menus. Layer panel (RC-DES-16): Rename, Delete (grayed if last layer), Duplicate, Show/Hide, Lock/Unlock, Move Up/Down. Guide right-click (RC-DES-17): Remove Guide, Lock/Unlock Guide.

## Spec Excerpt (verbatim)

> **Layer panel right-click** (RC-DES-16): Rename, Delete (grayed if last layer), Duplicate, Show/Hide, Lock/Unlock, Move Up/Down.
> **Guide right-click** (RC-DES-17): Remove Guide, Lock/Unlock Guide.
> — docs/SPEC_MANIFEST.md, CX-CANVAS-CONTEXT Non-Negotiables #5, #6

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/designer/DesignerRightPanel.tsx` — layer panel UI; no right-click found
- `frontend/src/pages/designer/DesignerCanvas.tsx` — `RulersOverlay` function renders guide lines (around line 3524-3560); no right-click on guide elements
- `frontend/src/store/designer/uiStore.ts` — `guides: GuideDefinition[]`, `removeGuide(id)`, `addGuide()` actions exist

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] Each layer row in DesignerRightPanel is wrapped in Radix ContextMenu with: Rename, Delete (disabled when only one layer), Duplicate, Show/Hide toggle, Lock/Unlock toggle, Move Up/Move Down
- [ ] Delete layer calls a command that moves all nodes in that layer to the default layer before deletion
- [ ] Guide elements in DesignerCanvas have a right-click menu with: Remove Guide, Lock/Unlock Guide
- [ ] Guide right-click uses Radix ContextMenu (not a custom handler)

## Assessment

After checking:
- **Status**: ❌ Missing — no right-click on layers in DesignerRightPanel.tsx; no right-click on guides in DesignerCanvas.tsx

## Fix Instructions

**Layer panel (DesignerRightPanel.tsx):**
Find the layer row rendering in the layers section. Wrap each layer row in:

```tsx
<ContextMenuPrimitive.Root>
  <ContextMenuPrimitive.Trigger asChild>
    <div /* layer row */> ... </div>
  </ContextMenuPrimitive.Trigger>
  <ContextMenuPrimitive.Portal>
    <ContextMenuPrimitive.Content style={ctxStyle}>
      <ContextMenuPrimitive.Item onSelect={() => { /* inline rename */ }}>Rename</ContextMenuPrimitive.Item>
      <ContextMenuPrimitive.Item onSelect={() => { /* duplicate layer */ }}>Duplicate</ContextMenuPrimitive.Item>
      <ContextMenuPrimitive.Separator />
      <ContextMenuPrimitive.Item onSelect={() => { /* toggle layer.visible */ }}>
        {layer.visible ? 'Hide Layer' : 'Show Layer'}
      </ContextMenuPrimitive.Item>
      <ContextMenuPrimitive.Item onSelect={() => { /* toggle layer.locked */ }}>
        {layer.locked ? 'Unlock Layer' : 'Lock Layer'}
      </ContextMenuPrimitive.Item>
      <ContextMenuPrimitive.Separator />
      <ContextMenuPrimitive.Item onSelect={() => { /* reorder up */ }} disabled={layerIndex === 0}>
        Move Up
      </ContextMenuPrimitive.Item>
      <ContextMenuPrimitive.Item onSelect={() => { /* reorder down */ }} disabled={layerIndex === layers.length - 1}>
        Move Down
      </ContextMenuPrimitive.Item>
      <ContextMenuPrimitive.Separator />
      <ContextMenuPrimitive.Item
        disabled={layers.length <= 1}
        onSelect={() => {
          if (layers.length <= 1) return
          /* delete layer — move its nodes to default layer first */
        }}>
        Delete
      </ContextMenuPrimitive.Item>
    </ContextMenuPrimitive.Content>
  </ContextMenuPrimitive.Portal>
</ContextMenuPrimitive.Root>
```

Layer mutations (rename, show/hide, lock, reorder, delete) should go through scene commands, not direct uiStore mutations, since layers are part of `doc.layers`.

**Guides (DesignerCanvas.tsx — RulersOverlay):**
Find where guide lines are rendered (around line 3524). Wrap each guide line element in Radix ContextMenu:

```tsx
{guides.map(guide => (
  <ContextMenuPrimitive.Root key={guide.id}>
    <ContextMenuPrimitive.Trigger asChild>
      <line
        x1={...} y1={...} x2={...} y2={...}
        style={{ cursor: 'pointer' }}
      />
    </ContextMenuPrimitive.Trigger>
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Content style={ctxStyle}>
        <ContextMenuPrimitive.Item onSelect={() => removeGuide(guide.id)}>
          Remove Guide
        </ContextMenuPrimitive.Item>
        <ContextMenuPrimitive.Item onSelect={() => { /* toggle guide.locked */ }}>
          {guide.locked ? 'Unlock Guide' : 'Lock Guide'}
        </ContextMenuPrimitive.Item>
      </ContextMenuPrimitive.Content>
    </ContextMenuPrimitive.Portal>
  </ContextMenuPrimitive.Root>
))}
```

Note: `GuideDefinition` interface in uiStore.ts may need a `locked?: boolean` field added.

Do NOT:
- Use a custom onContextMenu + div for either case (must be Radix ContextMenu)
- Allow deleting the last remaining layer (must be grayed/disabled)
