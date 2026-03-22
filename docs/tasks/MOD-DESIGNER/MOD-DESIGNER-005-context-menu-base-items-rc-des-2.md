---
id: MOD-DESIGNER-005
title: Add missing RC-DES-2 base items to node context menu (Lock/Unlock, Navigation Link, Properties)
unit: MOD-DESIGNER
status: pending
priority: medium
depends-on: [MOD-DESIGNER-004]
---

## What This Feature Should Do

Every node right-click menu must include Lock/Unlock, a Navigation Link submenu, and a Properties item. These are base items that appear regardless of node type (RC-DES-2). Currently the node context menu has Cut/Copy/Paste/Delete/Duplicate/Z-order/Group/Ungroup/Transform items but is missing all three of these required base items.

## Spec Excerpt (verbatim)

> **Any node right-click — base items** (RC-DES-2): Cut, Copy, Paste, Delete, Duplicate, Bring to Front/Forward/Backward/Back (z-order), Group (`Ctrl+G`), Ungroup, Lock/Unlock, Navigation Link submenu, Properties. These appear for ALL node types.
> — docs/SPEC_MANIFEST.md, CX-CANVAS-CONTEXT Non-Negotiable #2

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/designer/DesignerCanvas.tsx:3877-3993` — `DesignerContextMenuContent` node menu section; ends at line 3993 with the last z-order item before node-type-specific sections
- `frontend/src/shared/types/graphics.ts` — `SceneNodeBase` interface — should have `locked: boolean` and `navigationLink?: NavigationLink`
- `frontend/src/shared/graphics/commands.ts` — verify `ChangePropertyCommand` exists for toggling `locked`

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] Node context menu has a Lock/Unlock item that calls `ChangePropertyCommand(nodeId, 'locked', !node.locked, node.locked)`
- [ ] Node context menu has a "Navigation Link" submenu with: Set Link (opens a dialog to choose target graphic or external URL), Remove Link (grayed when no link set), Navigate (grayed when no link set — allows preview navigation)
- [ ] Node context menu has a "Properties…" item that opens the right panel focused on that node's properties (or opens a Properties dialog)
- [ ] Lock/Unlock item label toggles: "Lock" when node is unlocked, "Unlock" when node is locked

## Assessment

After checking:
- **Status**: ❌ Missing — none of Lock/Unlock, Navigation Link submenu, or Properties found in DesignerContextMenuContent (lines 3877–3993)

## Fix Instructions

In `DesignerContextMenuContent` (line 3877), within the node menu branch (after the z-order separator around line 3993), add:

```tsx
<ContextMenuPrimitive.Separator style={sepStyle} />

{/* Lock/Unlock */}
<ContextMenuPrimitive.Item style={itemStyle} disabled={!nodeId || !targetNode}
  onSelect={() => {
    if (!nodeId || !targetNode) return
    executeCmd(new ChangePropertyCommand(nodeId, 'locked', !targetNode.locked, targetNode.locked))
  }}>
  {targetNode?.locked ? 'Unlock' : 'Lock'}
</ContextMenuPrimitive.Item>

{/* Navigation Link submenu */}
<ContextMenuPrimitive.Sub>
  <ContextMenuPrimitive.SubTrigger style={itemStyle}>Navigation Link</ContextMenuPrimitive.SubTrigger>
  <ContextMenuPrimitive.Portal>
    <ContextMenuPrimitive.SubContent style={subContentStyle}>
      <ContextMenuPrimitive.Item style={itemStyle} disabled={!nodeId}
        onSelect={() => { /* open Navigation Link dialog */ }}>
        Set Link…
      </ContextMenuPrimitive.Item>
      <ContextMenuPrimitive.Item style={itemStyle}
        disabled={!targetNode?.navigationLink}
        onSelect={() => {
          if (!nodeId) return
          executeCmd(new ChangePropertyCommand(nodeId, 'navigationLink', undefined, targetNode?.navigationLink))
        }}>
        Remove Link
      </ContextMenuPrimitive.Item>
    </ContextMenuPrimitive.SubContent>
  </ContextMenuPrimitive.Portal>
</ContextMenuPrimitive.Sub>

<ContextMenuPrimitive.Separator style={sepStyle} />

{/* Properties */}
<ContextMenuPrimitive.Item style={itemStyle} disabled={!nodeId}
  onSelect={() => {
    if (nodeId) {
      // Emit selection and focus right panel properties section
      selectedIdsRef.current = new Set([nodeId])
      emitSelection([nodeId])
    }
  }}>
  Properties…
</ContextMenuPrimitive.Item>
```

The Navigation Link dialog can be a simple modal with a graphic picker (search by name) and an optional URL field. The `ChangePropertyCommand` for `navigationLink` should set `targetNode.navigationLink` to `{ targetGraphicId, targetUrl }` or `undefined`.

Do NOT:
- Make Lock/Unlock hidden when already in a state (the spec says disabled items in Designer menus are grayed, not hidden)
- Skip Properties — it is required even if it just scrolls the right panel to the node's section
