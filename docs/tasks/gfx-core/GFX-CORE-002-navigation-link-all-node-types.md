---
id: GFX-CORE-002
title: Add NavigationLink click handling to all 6 missing node types
unit: GFX-CORE
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

Any scene graph node can have a `navigationLink` property that, when the node is clicked, navigates to another graphic or opens an external URL. Currently only `symbol_instance` and `primitive` nodes handle clicks. Six other node types — `text_block`, `image`, `embedded_svg`, `stencil`, `annotation`, and `pipe` — render without any click handler, so navigation links on these nodes are silently ignored.

## Spec Excerpt (verbatim)

> **NavigationLink on any node.** Any `SceneNode` can have `navigationLink`. Clicking the node navigates to `targetGraphicId` or opens `targetUrl`. Not just SymbolInstances.
> — graphics-scene-graph-implementation-spec.md, §2.1 / manifest non-negotiable #8

> ```typescript
> interface SceneNodeBase {
>   ...
>   /** Optional navigation link -- clicking this node navigates to another graphic */
>   navigationLink?: NavigationLink;
> }
> ```

## Where to Look in the Codebase

Primary files:
- `frontend/src/shared/graphics/SceneRenderer.tsx` — all render functions:
  - `renderTextBlock` (line 277): no `onClick`
  - `renderImage` (line 305): no `onClick`
  - `renderEmbeddedSvg` (line 320): no `onClick`
  - `renderStencil` (line 333): no `onClick`
  - `renderAnnotation` (line 686): no `onClick`
  - `renderPipe` (line 254): no `onClick`
  - `handleNodeClick` (line 180): correct handler exists, just not wired up

## Verification Checklist

- [ ] `renderTextBlock` wraps its `<g>` with an `onClick` that calls `handleNodeClick(node, e)`.
- [ ] `renderImage` wraps its `<g>` with an `onClick` that calls `handleNodeClick(node, e)`.
- [ ] `renderEmbeddedSvg` wraps its `<g>` with an `onClick` that calls `handleNodeClick(node, e)`.
- [ ] `renderStencil` wraps its `<g>` with an `onClick` that calls `handleNodeClick(node, e)`.
- [ ] `renderAnnotation` wraps its `<g>` with an `onClick` that calls `handleNodeClick(node, e)`.
- [ ] `renderPipe` wraps its `<g>` with an `onClick` that calls `handleNodeClick(node, e)`.
- [ ] Each of the above also sets `style={{ cursor: node.navigationLink || onNodeClick ? 'pointer' : undefined }}` to match the existing pattern.

## Assessment

- **Status**: ⚠️ Wrong — handler exists but is not wired to 6 of 11 node types
- **What needs to change**: Add `onClick` and cursor style to `renderTextBlock`, `renderImage`, `renderEmbeddedSvg`, `renderStencil`, `renderAnnotation`, and `renderPipe`

## Fix Instructions

In `frontend/src/shared/graphics/SceneRenderer.tsx`, add the following to each render function's outermost `<g>` element. The pattern already exists in `renderSymbolInstance` (line 673–674) and `renderPrimitive` (line 246–247) — follow the same pattern:

```tsx
onClick={(e) => handleNodeClick(node, e)}
style={{ cursor: node.navigationLink || onNodeClick ? 'pointer' : undefined }}
```

Apply this to each of these functions:

1. **`renderTextBlock`** (line 281): add to the `<g transform={getTransformAttr(node)} ...>` element
2. **`renderImage`** (line 308): add to the `<g transform={getTransformAttr(node)} ...>` element
3. **`renderEmbeddedSvg`** (line 322): add to the `<g transform={getTransformAttr(node)} ...>` element
4. **`renderStencil`** (lines 340 and 350): add to both the placeholder `<g>` and the loaded `<g>` — both code paths return a `<g>` and both need the handler
5. **`renderAnnotation`** (lines 690 and 709): add to the `<g>` in both the `border` and `callout` branches (and future branches when GFX-CORE-003 is implemented)
6. **`renderPipe`** (line 257): add to the outer `<g data-node-id={node.id} ...>` element

Do NOT:
- Add onClick to child elements inside the `<g>` — only the outermost element needs it
- Modify `handleNodeClick` — it is already correct for all node types
- Add `pointerEvents="none"` to the `<g>` when there is no nav link — the cursor style alone is sufficient to signal no interaction
