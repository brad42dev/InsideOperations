# Group Rotation + Confirming-Mode Locked Group — Implementation Plan

Target file: `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx`

All line numbers below are based on HEAD at the time this plan was authored. If the file has drifted, use the surrounding anchor strings in each code block to locate the correct spot. Each phase is self-contained — a fresh coding agent can execute any phase given only this file and "read group-rotation-plan.md and execute phase N".

After completing each phase, run:

```bash
cd /home/io/io-dev/io/frontend && pnpm tsc --noEmit
```

Do not proceed to the next phase until TypeScript is clean.

---

## Problem Summary

### Problem 1: Confirming-phase paste should behave as a locked group

When `placeMode.phase === "confirming"` (the two-phase paste ghost has been placed and the user is positioning it before final commit), clicking any of the pasted nodes currently selects just that one node. The multi-node drag code is already wired up — it moves every selected node together — but because only the clicked node gets selected, the group splits apart on drag. The fix is to treat any pasted-node hit as a selection of ALL pasted nodes.

### Problem 2: Rotation is single-node only

`SelectionOverlay` hides the rotate zones for multi-selection (`showRotateHandle = isSingle && !!onRotateStart`). `startRotate`, `interactionRef.rotatePivot`, the rotate mousemove preview, the rotate mouseup commit, and the rotate-cancel-on-Escape branch are all hard-coded to one node. This plan extends rotation to support N nodes rotating as a rigid group around the union-AABB center.

### Math for group rotation

For each node `i` in a multi-node group rotation with:
- Initial world position `P_i = (transform.position.x, transform.position.y)`
- Initial rotation `R_i`
- Local pivot `localPivot_i = getNodeRotationPivot(node)` (= shape center in local coords)
- Group center `C` (= union AABB center of all selected nodes at interaction start)
- Rotation delta `d` degrees

```
cosD = cos(d · π/180), sinD = sin(d · π/180)
dx_i = P_i.x - C.x
dy_i = P_i.y - C.y

newPos_i = { x: C.x + dx_i·cosD - dy_i·sinD,
             y: C.y + dx_i·sinD + dy_i·cosD }
newRot_i = ((R_i + d) mod 360 + 360) mod 360
```

DOM transform for node `i`:
```
buildTransform(newPos_i.x, newPos_i.y, newRot_i, sx, sy, mirror, localPivot_i.x, localPivot_i.y)
```

### Single-node vs. multi-node distinction (IMPORTANT)

For **single-node** rotation today, the position is NOT updated — only `rotation` changes. The visual "rotate around the shape's center" effect comes from the LOCAL pivot inside `buildTransform` (SVG `rotate(angle, pivotX, pivotY)` with `pivotX, pivotY` being shape-center coordinates in local space after the translate). The node's world-space translate is untouched.

For **multi-node** group rotation, BOTH position AND rotation must change per node because each node's world position has to orbit around the group center `C` (which is NOT the node's own visual center).

To preserve byte-identical behavior for single-node rotation, the commit and preview paths branch on `rotateInitialTransforms.size`:
- `size === 1`: keep the existing position-untouched path (only `rotation` is updated).
- `size > 1`: apply the full group math (new `position` + new `rotation` for every node).

### Sidecars

- **Exterior sidecars**: stored positions are never mutated. `buildExteriorSidecarTransform` applies a counter-rotation at render/preview time so they appear anchored to the parent shape. For group rotation, the existing per-parent exterior-sidecar update block in mousemove must run once per node in `rotateInitialTransforms`, using that node's own new rotation and initial transform.
- **Interior (inside-fill) sidecars**: `rotation += delta`, no position change. Same rule for both single and multi.

### Snap behavior in group rotation

The 90° stickiness currently uses `firstT.rotation + delta` to decide when to snap. For group rotation, keep this as-is — snap decisions are anchored to the first node's effective rotation. This is an acceptable UX compromise: when the user drags toward a right angle, the group locks to that right angle relative to its starting orientation, even though other nodes in the group may not land exactly on a 90° multiple themselves. The shift-key 15° stepping already operates on `delta` directly and needs no change.

### rotationPreview during group rotation

`rotationPreview: { nodeId: NodeId; angle: number } | null` shows a per-node rotation preview overlay. It is meaningless for multi-node rotation (the AABB box handles the visual during confirming mode, and the per-node overlays would flicker). Call `setRotationPreview(null)` in the multi-node branches of both preview and commit.

---

# Phase 1 — Confirming-Mode Locked Group

**Goal**: In `placeMode.phase === "confirming"`, any click on a pasted node selects ALL pasted nodes so the existing multi-node drag code moves the whole paste group together.

### File / location

`/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx`, around line 3253–3264 inside `handleMouseDown`.

### Current code (exact, lines ~3253–3264)

```typescript
        if (placeModeRef.current?.phase === "confirming") {
          const pastedSet = new Set(placeModeRef.current.pastedNodeIds);
          // Redirect a display_element hit to its pasted parent SI.
          if (
            hit?.nodeType === "display_element" &&
            hit.parentSymbolId &&
            pastedSet.has(hit.parentSymbolId)
          ) {
            hit = { nodeId: hit.parentSymbolId, nodeType: "symbol_instance" };
          }
          if (!hit || !pastedSet.has(hit.nodeId)) return;
          // Confirmed pasted-node hit — fall through to drag setup.
        } else {
```

### New code

```typescript
        if (placeModeRef.current?.phase === "confirming") {
          const pastedIds = placeModeRef.current.pastedNodeIds;
          const pastedSet = new Set(pastedIds);
          // Redirect a display_element hit to its pasted parent SI.
          if (
            hit?.nodeType === "display_element" &&
            hit.parentSymbolId &&
            pastedSet.has(hit.parentSymbolId)
          ) {
            hit = { nodeId: hit.parentSymbolId, nodeType: "symbol_instance" };
          }
          if (!hit || !pastedSet.has(hit.nodeId)) return;
          // Confirmed pasted-node hit — force-select ALL pasted nodes so the
          // group drags as a locked unit. The existing multi-node drag code
          // (which reads selectedIdsRef) handles the rest.
          const groupSel = new Set<NodeId>(pastedIds);
          selectedIdsRef.current = groupSel;
          useUiStore.getState().setSelectedNodes(Array.from(groupSel));
          // Fall through to drag setup.
        } else {
```

### Why this works

The block that runs after this `if / else` sets up drag state using `selectedIdsRef.current`. By the time the drag-initialization code reads selection, every pasted node is in it, so the existing multi-node drag path handles the move. The single-node code path (the one that sets `selectedIds = {hitNodeId}` later in `handleMouseDown`) is in the `else` branch and no longer executes for confirming-phase clicks (the `else` branch is the normal-mode DOM-precision check).

> Note: If you trace `handleMouseDown` further down and find a later block that unconditionally sets selection to just the hit node regardless of mode, it must be guarded with `if (placeModeRef.current?.phase !== "confirming")`. Grep for `selectedIdsRef.current = new Set([` and `setSelectedNodes(` inside `handleMouseDown` to check. The current code path allows the confirming-mode force-selection above to survive because drag setup only reads selection, it does not overwrite it unless the normal-mode hit-test branch is taken.

### TypeScript check

```bash
cd /home/io/io-dev/io/frontend && pnpm tsc --noEmit
```

Must pass clean.

### Manual test

1. Start frontend (`pnpm dev`).
2. Open Designer, place two or more shapes, select them, copy (Ctrl+C).
3. Paste (Ctrl+V). Ghost should be attached to cursor. Click once to drop into confirming phase.
4. Click any one of the pasted shapes and drag. All pasted shapes must move together as a rigid group (same dx/dy).
5. Press Enter or click outside to commit; confirm positions are as expected.
6. Regression: paste 1 shape. Behavior should be unchanged (single shape drags alone).

---

# Phase 2 — Group Rotation: Data Model + API

**Goal**: Change the internal API so rotation can operate on N nodes. No behavioral change yet — single-node rotation continues to work exactly as before.

### Changes

1. `interactionRef` type: `rotatePivot: { x; y }` → `rotatePivots: Map<NodeId, { x; y }>`
2. `interactionRef` default: initialize `rotatePivots: new Map()`
3. `startRotate` signature: take arrays/maps instead of scalars
4. `SelectionOverlay.onRotateStart` prop type: match the new signature
5. `SelectionOverlay` rotate-zone `onMouseDown`: call with 1-entry arrays/maps (wrapping the single-node call unchanged behaviorally)

### 2.1 — interactionRef type declaration (lines ~3090–3094)

**Old:**
```typescript
    // rotate-specific
    rotateCenter: { x: number; y: number };
    rotateStartAngle: number;
    rotatePivot: { x: number; y: number };
    rotateInitialTransforms: Map<NodeId, Transform>;
```

**New:**
```typescript
    // rotate-specific
    rotateCenter: { x: number; y: number };
    rotateStartAngle: number;
    rotatePivots: Map<NodeId, { x: number; y: number }>;
    rotateInitialTransforms: Map<NodeId, Transform>;
```

### 2.2 — interactionRef default initializer (lines ~3116–3119)

**Old:**
```typescript
    rotateCenter: { x: 0, y: 0 },
    rotateStartAngle: 0,
    rotatePivot: { x: 0, y: 0 },
    rotateInitialTransforms: new Map(),
```

**New:**
```typescript
    rotateCenter: { x: 0, y: 0 },
    rotateStartAngle: 0,
    rotatePivots: new Map(),
    rotateInitialTransforms: new Map(),
```

### 2.3 — `startRotate` signature + body (lines ~2848–2869)

**Old:**
```typescript
  const startRotate = useCallback(
    (
      nodeId: NodeId,
      center: { x: number; y: number },
      initialTransform: Transform,
      startHandleX: number,
      startHandleY: number,
      pivot: { x: number; y: number },
    ) => {
      const inter = interactionRef.current;
      inter.type = "rotate";
      inter.rotateCenter = center;
      inter.rotateStartAngle =
        (Math.atan2(startHandleY - center.y, startHandleX - center.x) * 180) /
        Math.PI;
      inter.rotatePivot = pivot;
      inter.rotateInitialTransforms = new Map([
        [nodeId, { ...initialTransform }],
      ]);
    },
    [],
  );
```

**New:**
```typescript
  const startRotate = useCallback(
    (
      nodeIds: NodeId[],
      groupCenter: { x: number; y: number },
      initialTransforms: Map<NodeId, Transform>,
      pivots: Map<NodeId, { x: number; y: number }>,
      startHandleX: number,
      startHandleY: number,
    ) => {
      const inter = interactionRef.current;
      inter.type = "rotate";
      inter.rotateCenter = groupCenter;
      inter.rotateStartAngle =
        (Math.atan2(
          startHandleY - groupCenter.y,
          startHandleX - groupCenter.x,
        ) *
          180) /
        Math.PI;
      // Clone maps so later scene mutations can't leak back into interaction state.
      const clonedTransforms = new Map<NodeId, Transform>();
      for (const id of nodeIds) {
        const t = initialTransforms.get(id);
        if (t) clonedTransforms.set(id, { ...t });
      }
      const clonedPivots = new Map<NodeId, { x: number; y: number }>();
      for (const id of nodeIds) {
        const p = pivots.get(id);
        if (p) clonedPivots.set(id, { ...p });
      }
      inter.rotateInitialTransforms = clonedTransforms;
      inter.rotatePivots = clonedPivots;
    },
    [],
  );
```

### 2.4 — `SelectionOverlay.onRotateStart` prop type (lines ~1434–1441)

**Old:**
```typescript
  onRotateStart?: (
    nodeId: NodeId,
    center: { x: number; y: number },
    initialTransform: Transform,
    startHandleX: number,
    startHandleY: number,
    pivot: { x: number; y: number },
  ) => void;
```

**New:**
```typescript
  onRotateStart?: (
    nodeIds: NodeId[],
    groupCenter: { x: number; y: number },
    initialTransforms: Map<NodeId, Transform>,
    pivots: Map<NodeId, { x: number; y: number }>,
    startHandleX: number,
    startHandleY: number,
  ) => void;
```

### 2.5 — `SelectionOverlay` single-node rotate-zone `onMouseDown` (lines ~1666–1677)

This is inside the `{showRotateHandle && (...)}` block — the per-node corner rotate zones for single selection. Phase 2 keeps the single-node logic exactly where it is but wraps the call in 1-entry containers to satisfy the new signature. Phase 3 replaces this block entirely with a union-AABB-based version.

**Old:**
```typescript
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        onRotateStart!(
                          id,
                          { x: cx, y: cy },
                          node.transform,
                          hwx,
                          hwy,
                          pivot,
                        );
                      }}
```

**New:**
```typescript
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        onRotateStart!(
                          [id],
                          { x: cx, y: cy },
                          new Map([[id, node.transform]]),
                          new Map([[id, pivot]]),
                          hwx,
                          hwy,
                        );
                      }}
```

### 2.6 — mousemove preview: switch reads of `inter.rotatePivot` → per-node pivot

Inside the `if (inter.type === "rotate")` block (lines ~4199–4281), there is ONE read of `inter.rotatePivot`:

```typescript
              const rp = inter.rotatePivot;
              gEl.setAttribute(
                "transform",
                buildTransform(
                  initialT.position.x,
                  initialT.position.y,
                  newRot,
                  initialT.scale?.x ?? 1,
                  initialT.scale?.y ?? 1,
                  initialT.mirror ?? "none",
                  rp.x,
                  rp.y,
                ),
              );
```

Change the single line `const rp = inter.rotatePivot;` to pull from the map:

**Old:**
```typescript
              const rp = inter.rotatePivot;
```

**New:**
```typescript
              const rp = inter.rotatePivots.get(nodeId) ?? { x: 0, y: 0 };
```

### 2.7 — Escape cancel: switch reads of `inter.rotatePivot` → per-node pivot (lines ~5926–5949)

Inside the `if (inter.type === "rotate")` cancel branch:

**Old:**
```typescript
        if (inter.type === "rotate") {
          const svgEl = containerRef.current?.querySelector("svg");
          if (svgEl) {
            for (const [id, initialT] of inter.rotateInitialTransforms) {
              const gEl = svgEl.querySelector(`[data-node-id="${id}"]`);
              if (gEl) {
                const rp = inter.rotatePivot;
                gEl.setAttribute(
                  "transform",
                  buildTransform(
                    initialT.position.x,
                    initialT.position.y,
                    initialT.rotation,
                    initialT.scale?.x ?? 1,
                    initialT.scale?.y ?? 1,
                    initialT.mirror ?? "none",
                    rp.x,
                    rp.y,
                  ),
                );
              }
            }
          }
          inter.type = "none";
          setRotationPreview(null);
          return;
        }
```

**New:**
```typescript
        if (inter.type === "rotate") {
          const svgEl = containerRef.current?.querySelector("svg");
          if (svgEl) {
            for (const [id, initialT] of inter.rotateInitialTransforms) {
              const gEl = svgEl.querySelector(`[data-node-id="${id}"]`);
              if (gEl) {
                const rp = inter.rotatePivots.get(id) ?? { x: 0, y: 0 };
                gEl.setAttribute(
                  "transform",
                  buildTransform(
                    initialT.position.x,
                    initialT.position.y,
                    initialT.rotation,
                    initialT.scale?.x ?? 1,
                    initialT.scale?.y ?? 1,
                    initialT.mirror ?? "none",
                    rp.x,
                    rp.y,
                  ),
                );
              }
            }
          }
          inter.type = "none";
          setRotationPreview(null);
          return;
        }
```

### 2.8 — grep for any other `rotatePivot` readers

Before finishing Phase 2, search the file for any remaining references to `rotatePivot` (singular) and confirm there are none:

```bash
# should return zero results after edits above
grep -n 'rotatePivot\b' /home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx
```

### TypeScript check

```bash
cd /home/io/io-dev/io/frontend && pnpm tsc --noEmit
```

Must pass clean.

### Manual test

Single-node rotation must work exactly as it did before Phase 2. The rotate handle, snap behavior, sidecar counter-rotation, commit, and Escape-cancel should all be unchanged. If any regression is visible, Phase 2 is not ready for Phase 3.

---

# Phase 3 — Group Rotation: UI + Preview + Commit + Cancel

**Goal**: Enable rotation for multi-selection and rotate the group around its union AABB center.

### 3.1 — SelectionOverlay: show rotate handle for multi-selection (line ~1524)

**Old:**
```typescript
  const isSingle = nodeIds.size === 1;
  const showRotateHandle = isSingle && !!onRotateStart;
  const showResizeHandles = !!onResizeStart;
```

**New:**
```typescript
  const isSingle = nodeIds.size === 1;
  const showRotateHandle = !!onRotateStart;
  const showResizeHandles = !!onResizeStart;
```

`isSingle` is kept because other branches may still read it. `showRotateHandle` no longer gates on selection size.

### 3.2 — SelectionOverlay: rotate zones must render on union AABB for multi-selection

The current per-node rotate-zone block (lines ~1622–1681) draws four corner zones per selected node. For multi-selection that produces a chaotic overlay. Replace the block so:

- If `isSingle` — render the existing per-node corner zones (unchanged).
- If `!isSingle` — render four corner zones at the `selectionBBox` (the union AABB already computed at lines ~1557–1562). The `onMouseDown` collects every node's transform and pivot from `nodeMap`, computes the group center from the union AABB center, and calls `onRotateStart` with all IDs.

The replacement lives in the per-node `.map((id) => { ... })` render. The per-node selection rect at lines ~1602–1615 is fine and stays. The per-node rotate zones block (lines ~1622–1681) runs inside the per-node map; for multi-selection we want to skip it and instead render the group rotate zones ONCE, outside the per-node map.

Concretely:

**3.2a — guard the existing per-node rotate zones on `isSingle` (inside the per-node map, lines ~1622–1681)**

**Old:**
```typescript
            {/* Corner rotation proximity zones (single selection only).
                Invisible rects slightly outside each corner — cursor becomes a
                rotation arrow when hovering here. The resize handle circles
                (rendered later in the SVG, so on top) reclaim their own cursor
                area, giving the "close = rotate, exact = resize" feel. */}
            {showRotateHandle &&
              (() => {
```

**New:**
```typescript
            {/* Corner rotation proximity zones — single selection only.
                For multi-selection, rotate zones are rendered ONCE at the
                union AABB corners outside the per-node map. */}
            {isSingle &&
              showRotateHandle &&
              (() => {
```

(The rest of that IIFE and its invocation are unchanged.)

**3.2b — add a group rotate zone block AFTER the per-node map (after line ~1685, before the resize handles block that starts at ~1687)**

Insert this new block between the close of `allNodeIdsArr.map((id) => { ... })` and the start of `{showResizeHandles && (...)}`:

```typescript
      {/* Multi-selection group rotation zones — four corner proximity zones
          at the union AABB corners. Clicking any of them starts a group
          rotation around the union AABB center. */}
      {!isSingle &&
        showRotateHandle &&
        selectionBBox.w > 0 &&
        selectionBBox.h > 0 &&
        (() => {
          const pad = Math.max(1.5, 3 / zoom);
          const zoneSize = 16 / zoom;
          const zoneHalf = zoneSize / 2;
          const zoneOutset = 3 / zoom;
          const bx = selectionBBox.x;
          const by = selectionBBox.y;
          const bw = selectionBBox.w;
          const bh = selectionBBox.h;
          const gcx = bx + bw / 2;
          const gcy = by + bh / 2;
          return [
            { lx: bx - pad - zoneOutset, ly: by - pad - zoneOutset },
            { lx: bx + bw + pad + zoneOutset, ly: by - pad - zoneOutset },
            { lx: bx - pad - zoneOutset, ly: by + bh + pad + zoneOutset },
            {
              lx: bx + bw + pad + zoneOutset,
              ly: by + bh + pad + zoneOutset,
            },
          ].map(({ lx, ly }, i) => {
            // Cursor pick: hump points away from group center.
            const dirAngle = Math.atan2(gcy - ly, gcx - lx);
            const dirDeg = ((((dirAngle * 180) / Math.PI) % 360) + 360) % 360;
            const rDeg = (((dirDeg - 45) % 360) + 360) % 360;
            const rotateCursor = rotateCursors[Math.round(rDeg / 45) % 8];
            return (
              <rect
                key={`group-rot-zone-${i}`}
                x={lx - zoneHalf}
                y={ly - zoneHalf}
                width={zoneSize}
                height={zoneSize}
                fill="transparent"
                style={{
                  pointerEvents: dragActive ? "none" : "all",
                  cursor: rotateCursor,
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  const initialTransforms = new Map<NodeId, Transform>();
                  const pivots = new Map<
                    NodeId,
                    { x: number; y: number }
                  >();
                  for (const nid of allNodeIdsArr) {
                    const n = nodeMap.get(nid);
                    if (!n) continue;
                    initialTransforms.set(nid, n.transform);
                    pivots.set(nid, getNodeRotationPivot(n));
                  }
                  onRotateStart!(
                    allNodeIdsArr,
                    { x: gcx, y: gcy },
                    initialTransforms,
                    pivots,
                    lx,
                    ly,
                  );
                }}
              />
            );
          });
        })()}
```

Notes:
- `allNodeIdsArr`, `nodeMap`, `selectionBBox`, `zoom`, `dragActive`, `rotateCursors`, and `onRotateStart` are all in scope at this point in `SelectionOverlay`.
- The group rotation does not rotate the AABB itself — the AABB is axis-aligned and represents the current union bounds. Using its corners as start-handle positions for the initial angle seed is fine; the handle position only affects the initial angle reference, not the rotation math.

### 3.3 — mousemove preview: loop over all nodes, single vs. multi branch

Replace the entire `if (inter.type === "rotate")` block inside mousemove (lines ~4199–4281):

**Old:**
```typescript
      if (inter.type === "rotate") {
        const center = inter.rotateCenter;
        const currentAngle =
          (Math.atan2(cy - center.y, cx - center.x) * 180) / Math.PI;
        let delta = currentAngle - inter.rotateStartAngle;
        if (e.shiftKey) {
          delta = Math.round(delta / 15) * 15;
        }
        const nodeId = Array.from(inter.rotateInitialTransforms.keys())[0];
        const initialT = nodeId
          ? inter.rotateInitialTransforms.get(nodeId)
          : undefined;
        if (nodeId && initialT) {
          // Stickiness at right angles: snap to nearest 90° multiple within ±5°
          if (!e.shiftKey) {
            const rawRot = initialT.rotation + delta;
            const nearest90 = Math.round(rawRot / 90) * 90;
            if (Math.abs(rawRot - nearest90) <= 5)
              delta = nearest90 - initialT.rotation;
          }
          const newRot = initialT.rotation + delta;
          // DOM preview: rotate the SVG element directly for 60fps feedback
          const svgEl = containerRef.current?.querySelector("svg");
          if (svgEl) {
            const gEl = svgEl.querySelector(`[data-node-id="${nodeId}"]`);
            if (gEl) {
              const rp = inter.rotatePivots.get(nodeId) ?? { x: 0, y: 0 };
              gEl.setAttribute(
                "transform",
                buildTransform(
                  initialT.position.x,
                  initialT.position.y,
                  newRot,
                  initialT.scale?.x ?? 1,
                  initialT.scale?.y ?? 1,
                  initialT.mirror ?? "none",
                  rp.x,
                  rp.y,
                ),
              );
              // Also update counter-rotation transforms on exterior sidecar children
              // so they keep their canvas position as the parent rotates.
              const rotNode = docRef.current?.children.find(
                (n) => n.id === nodeId,
              ) as SymbolInstance | undefined;
              if (rotNode?.type === "symbol_instance") {
                const rotEntry = useLibraryStore
                  .getState()
                  .getShape(rotNode.shapeRef.shapeId);
                const rotGeo = rotEntry?.sidecar?.geometry;
                const rotNatW = rotGeo?.baseSize?.[0] ?? rotGeo?.width ?? 64;
                const rotNatH = rotGeo?.baseSize?.[1] ?? rotGeo?.height ?? 64;
                const rotPivX = (rotNatW * (initialT.scale?.x ?? 1)) / 2;
                const rotPivY = (rotNatH * (initialT.scale?.y ?? 1)) / 2;
                for (const child of rotNode.children) {
                  if (isInsideFillSidecar(child)) continue;
                  const cEl = svgEl.querySelector(
                    `[data-node-id="${child.id}"]`,
                  );
                  if (cEl) {
                    cEl.setAttribute(
                      "transform",
                      buildExteriorSidecarTransform(
                        child.transform.position,
                        child.transform.rotation,
                        child.transform.scale,
                        child.transform.mirror,
                        newRot,
                        initialT.scale ?? { x: 1, y: 1 },
                        initialT.mirror ?? "none",
                        rotPivX,
                        rotPivY,
                      ),
                    );
                  }
                }
              }
            }
          }
          setRotationPreview({ nodeId, angle: newRot });
        }
        return;
      }
```

**New:**
```typescript
      if (inter.type === "rotate") {
        const center = inter.rotateCenter;
        const currentAngle =
          (Math.atan2(cy - center.y, cx - center.x) * 180) / Math.PI;
        let delta = currentAngle - inter.rotateStartAngle;
        if (e.shiftKey) {
          delta = Math.round(delta / 15) * 15;
        }

        // 90° stickiness — anchor snap decision to the first node's rotation.
        // Acceptable UX compromise for group rotation: group locks to a
        // right-angle delta from its starting orientation, not to each
        // individual node landing on a 90° multiple.
        const firstKey = Array.from(inter.rotateInitialTransforms.keys())[0];
        const firstT = firstKey
          ? inter.rotateInitialTransforms.get(firstKey)
          : undefined;
        if (!firstKey || !firstT) return;
        if (!e.shiftKey) {
          const rawRot = firstT.rotation + delta;
          const nearest90 = Math.round(rawRot / 90) * 90;
          if (Math.abs(rawRot - nearest90) <= 5)
            delta = nearest90 - firstT.rotation;
        }

        const svgEl = containerRef.current?.querySelector("svg");
        if (!svgEl) return;

        const isMulti = inter.rotateInitialTransforms.size > 1;
        const dRad = (delta * Math.PI) / 180;
        const cosD = Math.cos(dRad);
        const sinD = Math.sin(dRad);

        for (const [nodeId, initialT] of inter.rotateInitialTransforms) {
          const newRot = initialT.rotation + delta;
          // Single-node rotation leaves position untouched (local pivot in
          // buildTransform handles the "rotate around shape center" visual).
          // Multi-node group rotation orbits each node's position around C.
          let newX = initialT.position.x;
          let newY = initialT.position.y;
          if (isMulti) {
            const dxI = initialT.position.x - center.x;
            const dyI = initialT.position.y - center.y;
            newX = center.x + dxI * cosD - dyI * sinD;
            newY = center.y + dxI * sinD + dyI * cosD;
          }
          const rp = inter.rotatePivots.get(nodeId) ?? { x: 0, y: 0 };
          const gEl = svgEl.querySelector(`[data-node-id="${nodeId}"]`);
          if (gEl) {
            gEl.setAttribute(
              "transform",
              buildTransform(
                newX,
                newY,
                newRot,
                initialT.scale?.x ?? 1,
                initialT.scale?.y ?? 1,
                initialT.mirror ?? "none",
                rp.x,
                rp.y,
              ),
            );
          }

          // Exterior sidecar counter-rotations — keep their canvas positions
          // visually fixed as the parent rotates. Skip interior (inside-fill)
          // sidecars here; they follow the parent's rotation via their own
          // transform and are updated at commit time, not preview time.
          const rotNode = docRef.current?.children.find(
            (n) => n.id === nodeId,
          ) as SymbolInstance | undefined;
          if (rotNode?.type === "symbol_instance") {
            const rotEntry = useLibraryStore
              .getState()
              .getShape(rotNode.shapeRef.shapeId);
            const rotGeo = rotEntry?.sidecar?.geometry;
            const rotNatW = rotGeo?.baseSize?.[0] ?? rotGeo?.width ?? 64;
            const rotNatH = rotGeo?.baseSize?.[1] ?? rotGeo?.height ?? 64;
            const rotPivX = (rotNatW * (initialT.scale?.x ?? 1)) / 2;
            const rotPivY = (rotNatH * (initialT.scale?.y ?? 1)) / 2;
            for (const child of rotNode.children) {
              if (isInsideFillSidecar(child)) continue;
              const cEl = svgEl.querySelector(
                `[data-node-id="${child.id}"]`,
              );
              if (cEl) {
                cEl.setAttribute(
                  "transform",
                  buildExteriorSidecarTransform(
                    child.transform.position,
                    child.transform.rotation,
                    child.transform.scale,
                    child.transform.mirror,
                    newRot,
                    initialT.scale ?? { x: 1, y: 1 },
                    initialT.mirror ?? "none",
                    rotPivX,
                    rotPivY,
                  ),
                );
              }
            }
          }
        }

        // Per-node rotation preview overlay is only meaningful for single-node.
        // For multi-selection the AABB/per-node selection rects already reflect
        // the live rotation via the DOM mutation loop above.
        if (!isMulti && firstKey) {
          setRotationPreview({
            nodeId: firstKey,
            angle: firstT.rotation + delta,
          });
        } else {
          setRotationPreview(null);
        }
        return;
      }
```

Note: during multi-node group rotation, the parent `<g>` element's transform is overwritten with the new world position — but because exterior sidecars are children rendered beneath the parent SVG-group, moving the parent alone would already translate them. However, our rendering structure stores exterior sidecars at the SAME level in the DOM as the parent (not as children in the SVG), with their own `data-node-id` lookup. That is why the existing exterior-sidecar update loop runs and must continue to run for each parent in the multi-node case. If a future change nests sidecars as direct SVG children of the parent group, this block can simplify; do not assume that yet.

If you are unsure about the sidecar DOM layout, grep for `buildExteriorSidecarTransform` call sites and read `renderDisplayElementSvg` — the existing single-node preview code already handles sidecars via this independent loop, and Phase 3 simply iterates that same logic once per parent node.

### 3.4 — mouseup commit: single vs. multi branch (lines ~5269–5333)

**Old:**
```typescript
      if (inter.type === "rotate") {
        const angle =
          (Math.atan2(cy - inter.rotateCenter.y, cx - inter.rotateCenter.x) *
            180) /
          Math.PI;
        let delta = angle - inter.rotateStartAngle;
        if (e.shiftKey) {
          delta = Math.round(delta / 15) * 15;
        } else {
          // Stickiness at right angles: snap to nearest 90° multiple within ±5°
          const firstKey = Array.from(inter.rotateInitialTransforms.keys())[0];
          const firstT = firstKey
            ? inter.rotateInitialTransforms.get(firstKey)
            : undefined;
          if (firstT) {
            const rawRot = firstT.rotation + delta;
            const nearest90 = Math.round(rawRot / 90) * 90;
            if (Math.abs(rawRot - nearest90) <= 5)
              delta = nearest90 - firstT.rotation;
          }
        }

        const newTransforms = new Map<NodeId, Transform>();
        const prevTransforms = new Map<NodeId, Transform>();
        for (const [id, prevT] of inter.rotateInitialTransforms) {
          prevTransforms.set(id, { ...prevT });
          newTransforms.set(id, {
            ...prevT,
            rotation: (((prevT.rotation + delta) % 360) + 360) % 360,
          });

          // Propagate rotation only to interior (inside-fill) sidecar children.
          // Exterior sidecars must NOT have their stored positions modified —
          // buildExteriorSidecarTransform applies counter-rotation at render time
          // to keep their canvas position fixed. Mutating stored positions here
          // double-compensates and causes visible jumps on every rotation commit.
          if (d) {
            const siNode = d.children.find((n) => n.id === id);
            if (siNode?.type === "symbol_instance") {
              const si = siNode as SymbolInstance;
              for (const child of si.children) {
                if (!isInsideFillSidecar(child)) continue;
                const deT = child.transform;
                prevTransforms.set(child.id, { ...deT });
                newTransforms.set(child.id, {
                  ...deT,
                  rotation: (((deT.rotation + delta) % 360) + 360) % 360,
                });
              }
            }
          }
        }
        if (newTransforms.size > 0) {
          executeCmd(
            new RotateNodesCommand(
              Array.from(newTransforms.keys()),
              newTransforms,
              prevTransforms,
            ),
          );
        }
        setRotationPreview(null);
        inter.type = "none";
        return;
      }
```

**New:**
```typescript
      if (inter.type === "rotate") {
        const angle =
          (Math.atan2(cy - inter.rotateCenter.y, cx - inter.rotateCenter.x) *
            180) /
          Math.PI;
        let delta = angle - inter.rotateStartAngle;
        if (e.shiftKey) {
          delta = Math.round(delta / 15) * 15;
        } else {
          // 90° stickiness — anchor snap decision to the first node's rotation.
          const firstKey = Array.from(inter.rotateInitialTransforms.keys())[0];
          const firstT = firstKey
            ? inter.rotateInitialTransforms.get(firstKey)
            : undefined;
          if (firstT) {
            const rawRot = firstT.rotation + delta;
            const nearest90 = Math.round(rawRot / 90) * 90;
            if (Math.abs(rawRot - nearest90) <= 5)
              delta = nearest90 - firstT.rotation;
          }
        }

        const isMulti = inter.rotateInitialTransforms.size > 1;
        const center = inter.rotateCenter;
        const dRad = (delta * Math.PI) / 180;
        const cosD = Math.cos(dRad);
        const sinD = Math.sin(dRad);

        const newTransforms = new Map<NodeId, Transform>();
        const prevTransforms = new Map<NodeId, Transform>();
        for (const [id, prevT] of inter.rotateInitialTransforms) {
          prevTransforms.set(id, { ...prevT });
          const newRot = (((prevT.rotation + delta) % 360) + 360) % 360;
          // Single-node: position untouched — local pivot handles the visual.
          // Multi-node: each node's position orbits the group center C.
          let newPos = { ...prevT.position };
          if (isMulti) {
            const dxI = prevT.position.x - center.x;
            const dyI = prevT.position.y - center.y;
            newPos = {
              x: center.x + dxI * cosD - dyI * sinD,
              y: center.y + dxI * sinD + dyI * cosD,
            };
          }
          newTransforms.set(id, {
            ...prevT,
            position: newPos,
            rotation: newRot,
          });

          // Propagate rotation only to interior (inside-fill) sidecar children.
          // Exterior sidecars must NOT have their stored positions modified —
          // buildExteriorSidecarTransform applies counter-rotation at render
          // time to keep their canvas position fixed. Mutating stored
          // positions here double-compensates and causes visible jumps on
          // every rotation commit.
          if (d) {
            const siNode = d.children.find((n) => n.id === id);
            if (siNode?.type === "symbol_instance") {
              const si = siNode as SymbolInstance;
              for (const child of si.children) {
                if (!isInsideFillSidecar(child)) continue;
                const deT = child.transform;
                prevTransforms.set(child.id, { ...deT });
                newTransforms.set(child.id, {
                  ...deT,
                  rotation: (((deT.rotation + delta) % 360) + 360) % 360,
                });
              }
            }
          }
        }
        if (newTransforms.size > 0) {
          executeCmd(
            new RotateNodesCommand(
              Array.from(newTransforms.keys()),
              newTransforms,
              prevTransforms,
            ),
          );
        }
        setRotationPreview(null);
        inter.type = "none";
        return;
      }
```

`RotateNodesCommand` already spreads the full transform (`transform: clone(t)`), so supplying `position` in `newTransforms` applies cleanly without any change to `commands.ts`.

### 3.5 — Escape cancel path: already handled by Phase 2.7

The cancel branch (lines ~5927–5953 after Phase 2) iterates every entry in `rotateInitialTransforms` and restores the original transform using each node's own pivot from `rotatePivots`. Because cancel restores the ORIGINAL `initialT.position` (not a computed position), it works for both single- and multi-node rotation without modification.

Double-check by re-reading the cancel branch after Phase 2 is complete. No additional edits for Phase 3.

### 3.6 — `dragActive` propagation

The group rotate zones use `dragActive` to disable pointer-events during active drag. `dragActive` is already passed to `SelectionOverlay` and destructured. No additional wiring.

### TypeScript check

```bash
cd /home/io/io-dev/io/frontend && pnpm tsc --noEmit
```

Must pass clean.

### Manual test

Single-node:
1. Select ONE shape. Rotate via corner handle. Behavior must be identical to pre-change (rotates around its own center, no position drift, sidecars stay anchored, 90° snap works, shift=15° works, Escape cancels cleanly).

Multi-node:
2. Select TWO OR MORE shapes (shift-click or marquee). Rotate via a corner of the union AABB.
   - The whole group orbits the union AABB center rigidly.
   - Each shape's body rotates around its own center as it orbits (both rotations composited).
   - Exterior sidecars stay anchored to their shapes.
   - Interior (inside-fill) sidecars rotate with their parent.
   - 90° snap fires based on first node's effective rotation (acceptable UX compromise).
   - Shift-drag = 15° delta stepping.
   - Escape cancels — all shapes snap back to original positions and rotations.
3. Mix with paste confirming mode:
   - Paste 3+ shapes, enter confirming phase, commit (Enter). Then multi-select them and rotate — should work with the normal-mode overlay.
4. Undo (Ctrl+Z) after group rotation — every rotated shape must return to its pre-rotation position AND rotation.
5. Redo (Ctrl+Y) — same group rotation reapplies correctly.

### Known quirks / deferred items

- Rotation overlay during confirming mode is intentionally suppressed (see the existing comment at ~line 7407). Group rotation therefore only surfaces outside confirming mode. If the user asks for rotation during confirming phase later, the group rotate zones can be added to the confirming-phase AABB block at ~line 7423. That is out of scope for this plan.
- The rotate zones' corner positions are computed from the axis-aligned `selectionBBox`. They do not rotate with the group during the drag. That matches the resize-handle behavior and is the simplest correct UX.
- `setRotationPreview(null)` is called in both multi-node preview and multi-node commit to ensure the per-node preview overlay never shows for a group rotation. The AABB and per-node selection rects already reflect the live rotation via the DOM mutation loop.

---

## Execution order

1. Phase 1 — `pnpm tsc --noEmit` clean — manual-test paste group drag — proceed.
2. Phase 2 — `pnpm tsc --noEmit` clean — confirm single-node rotation still works — proceed.
3. Phase 3 — `pnpm tsc --noEmit` clean — run all manual tests above.

If any phase fails typecheck or regresses single-node rotation, STOP and resolve before moving on. Do not combine phases into one commit unless all three have been verified end-to-end.
