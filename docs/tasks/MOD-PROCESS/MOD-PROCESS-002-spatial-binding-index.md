---
id: MOD-PROCESS-002
title: Pre-build spatial binding index on graphic load
unit: MOD-PROCESS
status: pending
priority: high
depends-on: []
---

## What This Feature Should Do

When a graphic loads, the Process module should build a flat sorted array of all node bounding boxes and their point IDs once. Subsequent viewport changes query this pre-built index instead of walking the full scene graph tree on every debounced viewport change. For graphics with more than 2,000 bound elements, upgrade the index to an `rbush` R-tree for O(log n) intersection queries.

## Spec Excerpt (verbatim)

> On graphic load, before the viewport subscription algorithm runs, the frontend builds a **spatial binding index** for fast viewport queries:
>
> ```typescript
> interface SpatialBindingEntry {
>   nodeId: string;
>   bbox: { left: number; top: number; right: number; bottom: number };
>   lodLevel: number;
>   pointIds: Set<string>;
> }
>
> // Flat array, sorted by bbox.left for sweep-line intersection
> const bindingIndex: SpatialBindingEntry[] = [];
> ```
>
> For graphics with >2,000 bound elements, an R-tree spatial index (`rbush`, MIT license) is used instead of the flat array for O(log n) viewport intersection queries.
> — process-implementation-spec.md, §5.6 Binding Index Pre-Computation

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/process/index.tsx:141-186` — `getVisiblePointIds()` currently walks the full scene graph on every debounced viewport change
- `frontend/src/pages/process/index.tsx:728-737` — `visiblePointIds` useMemo that calls `getVisiblePointIds` on every debounced viewport change

## Verification Checklist

- [ ] A `buildBindingIndex(doc)` function exists that walks the scene graph once and returns `SpatialBindingEntry[]` sorted by `bbox.left`.
- [ ] The binding index is rebuilt (via useMemo or useEffect) only when `graphic?.scene_data` changes — not on every viewport change.
- [ ] The `visiblePointIds` computation queries the pre-built index against the current viewport rect, not the full scene graph.
- [ ] When the bound element count exceeds 2,000, `rbush` is used instead of the flat array sweep.
- [ ] LOD level filtering is applied in the index query (nodes with `lodLevel > currentLOD` are excluded).

## Assessment

- **Status**: ❌ Missing
- `index.tsx:141-185` — `getVisiblePointIds()` does a full recursive tree walk on every debounced viewport change (every 200ms during pan/zoom). No pre-built index exists.
- `index.tsx:734-737` — `visiblePointIds` useMemo depends on `[graphic?.scene_data, debouncedVp]` — correctly recalculates on viewport change, but doing a full scene walk is expensive for 10,000-element graphics.

## Fix Instructions

1. Add a `buildBindingIndex` function (can be in `index.tsx` or a new `frontend/src/pages/process/bindingIndex.ts`):

```typescript
interface SpatialBindingEntry {
  nodeId: string
  bbox: { left: number; top: number; right: number; bottom: number }
  lodLevel: number
  pointIds: Set<string>
}

function buildBindingIndex(doc: { children: SceneNode[] }): SpatialBindingEntry[] {
  const entries: SpatialBindingEntry[] = []
  function scanNode(node: SceneNode) {
    const { x, y } = node.transform.position
    if (node.type === 'display_element') {
      const de = node as DisplayElement
      const [w, h] = displayElementSize(de)
      const pointIds = new Set<string>()
      if (de.binding?.pointId) pointIds.add(de.binding.pointId)
      if (de.binding?.expressionId) pointIds.add(de.binding.expressionId)
      if (pointIds.size > 0) {
        entries.push({ nodeId: de.id, bbox: { left: x, top: y, right: x + w, bottom: y + h }, lodLevel: displayElementLod(de.displayType), pointIds })
      }
    } else if (node.type === 'symbol_instance') {
      const si = node as SymbolInstance
      const pointIds = new Set<string>()
      if (si.stateBinding?.pointId) pointIds.add(si.stateBinding.pointId)
      if (si.stateBinding?.expressionId) pointIds.add(si.stateBinding.expressionId)
      if (pointIds.size > 0) {
        entries.push({ nodeId: si.id, bbox: { left: x, top: y, right: x + 200, bottom: y + 200 }, lodLevel: 0, pointIds })
      }
    }
    if ('children' in node && Array.isArray(node.children)) {
      for (const child of node.children) scanNode(child as SceneNode)
    }
  }
  for (const node of doc.children) scanNode(node)
  return entries.sort((a, b) => a.bbox.left - b.bbox.left)
}
```

2. Build the index with `useMemo` (rebuild only when graphic changes):

```typescript
const bindingIndex = useMemo(() => {
  if (!graphic?.scene_data) return []
  return buildBindingIndex(graphic.scene_data)
}, [graphic?.scene_data])
```

3. Replace `getVisiblePointIds` call in the `visiblePointIds` useMemo with an index query:

```typescript
const visiblePointIds = useMemo(() => {
  if (!bindingIndex.length) return []
  const bufFrac = getBufferFraction(debouncedVp.zoom * 100)
  const visW = debouncedVp.screenWidth / debouncedVp.zoom
  const visH = debouncedVp.screenHeight / debouncedVp.zoom
  const buf = Math.max(visW, visH) * bufFrac
  const left = debouncedVp.panX - buf
  const top = debouncedVp.panY - buf
  const right = debouncedVp.panX + visW + buf
  const bottom = debouncedVp.panY + visH + buf
  const currentLod = zoomToLod(debouncedVp.zoom)
  const visible = new Set<string>()
  for (const entry of bindingIndex) {
    if (entry.bbox.left > right) break  // sorted by left — past right edge
    if (entry.lodLevel > currentLod) continue
    if (entry.bbox.right < left || entry.bbox.top > bottom || entry.bbox.bottom < top) continue
    for (const id of entry.pointIds) visible.add(id)
  }
  return Array.from(visible)
}, [bindingIndex, debouncedVp])
```

4. For the rbush upgrade: if `bindingIndex.length > 2000`, build a `RBush` index instead. Install `rbush` (MIT license) with `pnpm add rbush`. The rbush index replaces the sweep-line linear scan with a proper R-tree query.

Do NOT:
- Remove the 200ms debounce on viewport changes — the debounce is still needed even with the index.
- Use rbush unconditionally regardless of element count — spec requires flat array by default.
- Walk `graphic.scene_data` inside the `visiblePointIds` useMemo — that defeats the purpose of pre-computation.
