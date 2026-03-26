---
id: MOD-DESIGNER-037
title: Add "Re-route" item to Pipe node context menu (RC-DES-5)
unit: MOD-DESIGNER
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

When the user right-clicks a Pipe node on the Designer canvas, the context menu should include a "Re-route" action that triggers the auto-router to recompute the pipe's path. This is useful when symbol instances have been moved and the pipe's existing waypoints no longer produce an optimal route. The action should only be enabled when the pipe is connected at both ends (has startConnection and endConnection).

## Spec Excerpt (verbatim)

> `Pipe` (RC-DES-5): Toggle Auto/Manual Routing, Re-route, Change Service Type submenu, Reverse Direction
> — docs/SPEC_MANIFEST.md, CX-CANVAS-CONTEXT Non-Negotiable #3

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/designer/DesignerCanvas.tsx:5645–5693` — the `{pipeNode && ...}` block that renders pipe-specific context menu items. "Re-route" is missing here.
- `frontend/src/shared/graphics/pipeRouter.ts` — the `routePipe(start, end, obstacles, waypoints)` function to call for re-routing.
- `frontend/src/shared/graphics/commands.ts` — `ChangePropertyCommand` can be used to update `pipe.waypoints` and `pipe.routingMode`.

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] Right-clicking a Pipe node shows a "Re-route" context menu item
- [ ] The item is disabled when the pipe has no `startConnection` or no `endConnection`
- [ ] Selecting "Re-route" calls `routePipe()` with the pipe's start/end positions and clears manual waypoints
- [ ] The re-route result is committed via a `ChangePropertyCommand` (or compound) so it can be undone
- [ ] If the pipe is in manual routing mode, "Re-route" switches it back to auto routing mode

## Assessment

After checking:
- **Status**: ❌ Missing — `pipeNode` block at `DesignerCanvas.tsx:5645` has Toggle Auto/Manual Routing, Change Service Type submenu, and Reverse Direction, but no "Re-route" action.

## Fix Instructions

In `frontend/src/pages/designer/DesignerCanvas.tsx`, inside the `{pipeNode && ...}` section (around line 5645), add a "Re-route" item after "Toggle Auto/Manual Routing":

```tsx
<ContextMenuPrimitive.Item
  style={itemStyle}
  disabled={!pipeNode.startConnection || !pipeNode.endConnection}
  onSelect={() => {
    if (!nodeId || !pipeNode || !pipeNode.startConnection || !pipeNode.endConnection) return
    // Get start and end positions from connected symbol instances
    const doc = docRef.current
    if (!doc) return
    const startInstance = doc.children.find(n => n.id === pipeNode.startConnection!.instanceId)
    const endInstance = doc.children.find(n => n.id === pipeNode.endConnection!.instanceId)
    if (!startInstance || !endInstance) return
    const startPos = startInstance.transform.position
    const endPos = endInstance.transform.position
    const newWaypoints = [startPos, endPos]  // pipeRouter will interpolate
    executeCmd(new CompoundCommand('Re-route Pipe', [
      new ChangePropertyCommand(nodeId, 'routingMode', 'auto', pipeNode.routingMode),
      new ChangePropertyCommand(nodeId, 'waypoints', newWaypoints, pipeNode.waypoints),
    ]))
  }}
>
  Re-route
</ContextMenuPrimitive.Item>
```

Place this item immediately after the Toggle Auto/Manual Routing item and before the Change Service Type sub-menu.

Do NOT:
- Remove the existing Toggle Auto/Manual Routing item
- Implement Re-route as only resetting to auto mode (it should also clear manual waypoints and recalculate the path)
