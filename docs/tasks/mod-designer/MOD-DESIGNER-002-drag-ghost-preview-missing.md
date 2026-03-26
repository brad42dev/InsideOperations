---
id: MOD-DESIGNER-002
title: Implement 60fps visual drag ghost (DOM-ahead-of-store pattern)
unit: MOD-DESIGNER
status: pending
priority: high
depends-on: []
---

## What This Feature Should Do

When the user drags a selected node on the Designer canvas, the node should visually follow the cursor at 60fps. Currently, nodes remain frozen at their original positions during drag and only snap to the final position after mouseup. The spec explicitly defines this as the "Drag Preview Exception" — the SVG DOM is updated directly during drag for performance, bypassing the Zustand store. Only on mouseup is a MoveNodesCommand committed.

## Spec Excerpt (verbatim)

> **CRITICAL EXCEPTION — Drag Preview:** During a drag operation (move, resize, rotate), the SVG DOM is updated directly by SVG.js for 60fps visual feedback. The scene graph is NOT updated on every mousemove. Only on mouseup does the handler create and execute a SceneCommand with the final position.
>
> MOUSEMOVE (while dragState.active):
>   ...
>   4. SVG.js: move each selected node's <g> element to ghostPos
>      (DIRECT DOM manipulation — scene graph NOT updated yet)
> — designer-implementation-spec.md, §1.1 / §1.1.1

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/designer/DesignerCanvas.tsx:1908-1980` — `handleMouseMove` — the drag branch (inter.type === 'drag') only computes alignment guides, no DOM update
- `frontend/src/pages/designer/DesignerCanvas.tsx:1716` — `interactionRef` definition — drag state is tracked here
- `frontend/src/pages/designer/DesignerCanvas.tsx:2084-2113` — mouseup drag commit — MoveNodesCommand correctly called once on mouseup

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] `handleMouseMove` for `inter.type === 'drag'` updates the visual position of dragged node SVG elements directly (translate transform on the `<g>` elements or equivalent) — does NOT call executeCmd()
- [ ] On mouseup, `MoveNodesCommand` is still called exactly once with the final position (existing behavior, should remain)
- [ ] On Escape during drag, SVG DOM is reset to original positions and no command is committed
- [ ] The drag ghost visual does not go through React state (no setState() or Zustand set() on each mousemove)

## Assessment

After checking:
- **Status**: ❌ Missing — handleMouseMove drag branch (line 1923) computes guides only, no visual ghost position update

## Fix Instructions

The canvas renders scene nodes as SVG `<g>` elements with `data-node-id` attributes (see RenderNode function around line 617). The drag ghost should update these elements' transform attributes directly without going through React.

In `handleMouseMove`, inside the `if (inter.type === 'drag')` block (currently line 1923), after computing `dx`/`dy` and alignment guide snapping:

1. Get the container SVG element reference (use `containerRef.current?.querySelector('svg')` or a dedicated svgRef)
2. For each selected node ID in `selectedIdsRef.current`:
   - Find the SVG `<g>` element: `svg.querySelector(`[data-node-id="${id}"]`)`
   - Get original position from `inter.originalPositions.get(id)`
   - Compute ghost position: `ghostX = orig.x + dx`, `ghostY = orig.y + dy`
   - Apply snap if enabled: snap to grid or to nearest alignment guide
   - Update the element transform: `g.setAttribute('transform', `translate(${ghostX},${ghostY})`)`
3. Do NOT call `executeCmd()` during mousemove

In `handleMouseUp` (line 2038+), the existing MoveNodesCommand commit at line 2104 is correct — keep it unchanged.

Add Escape handling during drag:
```
if (inter.type === 'drag' && e.key === 'Escape') {
  // Reset DOM to original positions
  for (const [id, orig] of inter.originalPositions) {
    const g = svg.querySelector(`[data-node-id="${id}"]`)
    if (g) g.setAttribute('transform', `translate(${orig.x},${orig.y})`)
  }
  inter.type = 'none'
  endDrag()
  setAlignGuides([])
}
```

Do NOT:
- Call executeCmd() or update sceneStore during mousemove drag (only on mouseup)
- Use React setState() for the ghost position (defeats the 60fps purpose)
- Apply the snap to the ghost differently from what mouseup will compute (they must use the same snap logic)
