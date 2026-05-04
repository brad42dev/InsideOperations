# Text Readout Array — Implementation Plan

Feature: New `text_readout_array` display element (sidecar) that renders N text readouts
(one per bound point) arranged vertically or horizontally.

## Requirements Summary

- Type: `text_readout_array` — new `DisplayElementType`
- Layout: `vertical` (stacked, default) or `horizontal` (side-by-side), user configurable
- Multi-point: binds N points; one text readout sub-element per point
- Content per item: same as `text_readout` — value, EU, point name, display name
- Single-line mode: collapses PointName / DisplayName / Value+EU into one row per item
- Text formatting: same typography options as `text_readout`; applies uniformly to all items
- Default anchor: right slot, vertical layout, single-line OFF
- Available slots: top, bottom, left, right
- Centering: on placement, center on shape midpoint; stays put if user moves it; re-centers if
  still on anchor when bindings change
- Resize: changes spacing between items only; font/content size stays constant; items may
  overlap if compressed below natural height
- Priority: directly after `text_readout` in hierarchy
- Shape sidecar JSONs: universal code fallback — no edits to any of the 87 shape files

## Key Files

- `src/shared/types/graphics.ts`
- `src/shared/graphics/sidecarCollision.ts`
- `src/shared/graphics/anchorSlots.ts`
- `src/shared/graphics/renderDisplayElementSvg.tsx`
- `src/shared/graphics/SceneRenderer.tsx`
- `src/shared/graphics/pointExtractor.ts`
- `src/pages/designer/DesignerCanvas.tsx`
- `src/pages/designer/components/CategoryShapeWizard.tsx`
- `src/pages/designer/DesignerRightPanel.tsx`

All paths relative to `/home/io/io-dev/io/frontend/`.

---

## Phase 1 — Type system, sidecar tables, universal slot fallback

**Goal:** Compile-clean type extension end-to-end. No rendering. No JSON edits to shape files.

### graphics.ts

1. Extend `DisplayElementType` union: add `| "text_readout_array"`

2. Add `TextReadoutArrayConfig` interface (after `TextReadoutConfig`):
```typescript
export interface TextReadoutArrayConfig {
  displayType: "text_readout_array";
  arrayLayout: "vertical" | "horizontal";   // default "vertical"
  singleLine: boolean;                       // default false
  additionalBindings?: PointBinding[];       // points 1..N (primary in node.binding = point 0)
  itemSpacing?: number;                      // gap between items in px, default 2
  showBox: boolean;
  showUnits: boolean;
  valueFormat: string;
  minWidth: number;
  width?: number;
  height?: number;
  showSignalLine?: boolean;
  // Same typography row types as TextReadoutConfig:
  pointNameRow?: TextReadoutConfig["pointNameRow"];
  displayNameRow?: TextReadoutConfig["displayNameRow"];
  valueRow?: TextReadoutConfig["valueRow"];
  euRow?: TextReadoutConfig["euRow"];
}
```

3. Add `TextReadoutArrayConfig` to the `DisplayElementConfig` union

### sidecarCollision.ts

1. Extend `SidecarKey` type: add `| "TextReadoutArray"`

2. Add `text_readout_array: "TextReadoutArray"` to `DE_TO_SIDECAR_KEY`

3. Shift priorities — insert TextReadoutArray at 2, push everything after TextReadout down by 1:
```
AlarmIndicator:    0  (unchanged)
TextReadout:       1  (unchanged)
TextReadoutArray:  2  (NEW)
DigitalStatus:     3  (was 2)
PointNameLabel:    4  (was 3)
FillGauge:         5  (was 4)
AnalogBar:         6  (was 5)
Sparkline:         7  (was 6)
```

4. Add canonical size to `SIDECAR_CANONICAL_SIZE`:
   `TextReadoutArray: { w: 40, h: 16 * 3 + 2 * 2 }` (3-item vertical default; actual size computed by dePixelSize)

5. Extend `DeLayoutHints` interface with:
```typescript
pointCount?: number;              // number of bound points, for text_readout_array
arrayLayout?: "vertical" | "horizontal";
arraySingleLine?: boolean;
itemSpacing?: number;
```

6. Add case to `dePixelSize()`:
```typescript
case "text_readout_array": {
  const n = Math.max(1, cfg?.pointCount ?? 1);
  const gap = cfg?.itemSpacing ?? 2;
  const singleLine = cfg?.arraySingleLine ?? false;
  const layout = cfg?.arrayLayout ?? "vertical";
  // Per-item dimensions (same logic as text_readout single item):
  const itemRows = singleLine
    ? 1
    : 1 + (cfg?.showPointName ? 1 : 0) + (cfg?.showDisplayName ? 1 : 0);
  const itemH = itemRows * 16 + (itemRows - 1) * 2;
  const itemW = 40; // minWidth baseline; renderer may expand
  if (layout === "vertical") {
    return { w: itemW, h: n * itemH + (n - 1) * gap };
  } else {
    return { w: n * itemW + (n - 1) * gap, h: itemH };
  }
}
```

7. Add case to `applyDeSlotOffset()` — mirrors text_readout (pos.x is horizontal centre):
```typescript
case "text_readout_array": {
  const { w, h } = dePixelSize(dt, cfg);
  if (isTop) y -= h;
  if (isVert) y -= h / 2;
  if (isRight) x += w / 2;
  if (isLeft) x -= w / 2;
  break;
}
```

8. Add case to `makeBBox()` — identical to text_readout (centred on x, top-aligned y):
```typescript
if (dt === "text_readout_array") {
  return { x: x - w / 2, y, r: x + w / 2, b: y + h };
}
```

### anchorSlots.ts

1. Add helper function after `getOccupiedSlots`:
```typescript
/**
 * Returns an anchorSlots record augmented with TextReadoutArray slots derived
 * from the shape's TextReadout slots. If the sidecar already declares
 * TextReadoutArray explicitly, the explicit value is kept. If TextReadout
 * slots are empty or absent, TextReadoutArray is NOT added (some shapes
 * suppress text readout intentionally).
 */
function mirrorTextReadoutSlotsForArray(
  anchorSlots: Record<string, string[]> | undefined,
): Record<string, string[]> | undefined {
  if (!anchorSlots) return anchorSlots;
  if ("TextReadoutArray" in anchorSlots) return anchorSlots; // explicit override wins
  const trSlots = anchorSlots["TextReadout"];
  if (!trSlots || trSlots.length === 0) return anchorSlots; // suppressed — don't add
  return { ...anchorSlots, TextReadoutArray: trSlots };
}
```

2. In `getEmptySlots()`, apply the helper before iterating slots:
```typescript
const anchorSlots = mirrorTextReadoutSlotsForArray(shapeEntry?.sidecar.anchorSlots);
```
(Replace the existing `const anchorSlots = shapeEntry?.sidecar.anchorSlots;` line)

3. In `resolveSlotWithSidecar()`, `TextReadoutArray` should NOT use sidecar valueAnchors
   (those are shape-specific overrides for the single text_readout only). No change needed
   since the function only special-cases `"TextReadout"` and `"AlarmIndicator"` — the new
   type falls through to `resolveNamedSlot` which is correct.

### Verification

- `pnpm tsc --noEmit` passes with zero errors
- Grep confirms no code hard-codes the old integer values for DigitalStatus priority (2),
  PointNameLabel (3), etc. — all callers use `SIDECAR_PRIORITY[key]` not raw integers

---

## Phase 2 — Renderer

**Goal:** Render `text_readout_array` to SVG. Per-item `data-point-id` enables live DOM
mutation. No React re-renders on point ticks.

### renderDisplayElementSvg.tsx

1. Extract shared item renderer from `renderTextReadoutSvg`. Create a helper:
```typescript
function renderTextReadoutItem(
  index: number,
  pvKey: string | undefined,
  pointTag: string | undefined,
  pointValue: PointValueData | undefined,
  discreteLabel: string | null | undefined,
  metaUnit: string | undefined,
  cfg: TextReadoutConfig | TextReadoutArrayConfig,
  ctx: DisplayElementRenderContext,
  offsetX: number,
  offsetY: number,
): React.ReactElement
```
This moves the existing row-building logic (point name row, display name row, value row,
EU, box rect, manual badge) out of `renderTextReadoutSvg` and into this helper.
`renderTextReadoutSvg` delegates to it with index=0, offsetX=0, offsetY=0.

2. Extend `DisplayElementRenderContext` with:
```typescript
pointValues?: PointValueData[];       // index 0 = pointValue (primary)
pvKeys?: string[];                    // index 0 = pvKey
pointTags?: string[];                 // index 0 = pointTag
discreteLabels?: (string | null)[];
metaUnits?: string[];
```
Keep existing singular fields for backwards compat (= index 0).

3. Implement `renderTextReadoutArraySvg(node, ctx)`:
```typescript
function renderTextReadoutArraySvg(
  node: DisplayElement,
  ctx: DisplayElementRenderContext,
): React.ReactElement {
  const cfg = node.config as TextReadoutArrayConfig;
  const n = Math.max(1, (ctx.pvKeys?.length ?? 1));
  const gap = cfg.itemSpacing ?? 2;
  const layout = cfg.arrayLayout ?? "vertical";
  const { w: totalW, h: totalH } = dePixelSize("text_readout_array", {
    pointCount: n,
    arrayLayout: layout,
    arraySingleLine: cfg.singleLine,
    itemSpacing: gap,
    showPointName: !!cfg.pointNameRow,
    showDisplayName: !!cfg.displayNameRow,
  });
  const hOff = Math.round(-totalW / 2);

  const items = Array.from({ length: n }, (_, i) => {
    const itemH = ...; // same per-item height calc as dePixelSize
    const itemW = ...; // per-item width
    const offsetX = layout === "horizontal" ? i * (itemW + gap) : 0;
    const offsetY = layout === "vertical"   ? i * (itemH + gap) : 0;
    return (
      <g
        key={i}
        data-array-index={i}
        data-point-id={ctx.pvKeys?.[i]}
        data-point-tag={ctx.pointTags?.[i]}
        data-node-id={node.id}
        data-display-type="text_readout_array_item"
        transform={`translate(${offsetX},${offsetY})`}
      >
        {renderTextReadoutItem(
          i,
          ctx.pvKeys?.[i],
          ctx.pointTags?.[i],
          ctx.pointValues?.[i],
          ctx.discreteLabels?.[i],
          ctx.metaUnits?.[i],
          cfg,
          ctx,
          0, 0,
        )}
      </g>
    );
  });

  return (
    <g
      key={node.id}
      className="io-display-element"
      data-node-id={node.id}
      data-display-type="text_readout_array"
      data-array-layout={layout}
      data-item-count={n}
      data-base-transform={ctx.deTransform ?? ""}
      transform={`${ctx.deTransform ?? ""} translate(${hOff},0)`}
      opacity={node.opacity}
    >
      {items}
    </g>
  );
}
```

Key points:
- Outer `<g>` has NO `data-point-id` — avoids N+1 listener conflicts
- Each item `<g>` has its own `data-point-id` for the live DOM mutation path
- `data-display-type="text_readout_array_item"` is what `applyPointValue` dispatches on (Phase 5)

4. Add dispatch: `case "text_readout_array": return renderTextReadoutArraySvg(node, ctx);`

### SceneRenderer.tsx

In the render loop where display elements are processed, add multi-binding resolution for
`text_readout_array`:

```typescript
if (node.displayType === "text_readout_array") {
  const arrayCfg = node.config as TextReadoutArrayConfig;
  const allBindings = [node.binding, ...(arrayCfg.additionalBindings ?? [])];
  const pvKeys: string[] = [];
  const pointTags: string[] = [];
  const pointValues: (PointValueData | undefined)[] = [];
  // ... resolve each binding the same way the single-binding path resolves node.binding
  extraCtx = { pvKeys, pointTags, pointValues };
}
```

Pass `extraCtx` into `DisplayElementRenderContext` when calling `renderDisplayElementSvg`.

### pointExtractor.ts

Mirror the `alarm_indicator` block for the new type:
```typescript
if (de.displayType === "text_readout_array") {
  const cfg = de.config as TextReadoutArrayConfig;
  if (cfg.additionalBindings) {
    for (const b of cfg.additionalBindings) {
      if (b.pointId) pointIds.add(b.pointId);
    }
  }
}
```

### Verification

- `pnpm tsc --noEmit` clean
- Place a text_readout_array node with 3 hard-coded point bindings in a test graphic;
  verify the SVG output contains 3 item `<g>` elements each with distinct `data-point-id`

---

## Phase 3 — Placement, wizard, config UI

**Goal:** Users can place, configure, and edit text_readout_array from both the wizard and
the right panel.

### CategoryShapeWizard.tsx

1. Add to `ALL_DISPLAY_ELEMENTS` directly after `text_readout` entry:
```typescript
{ id: "text_readout_array", label: "Text Readout Array" },
```

2. Add default config in `makeDefaultElementConfig` (or equivalent):
```typescript
case "text_readout_array":
  return {
    displayType: "text_readout_array",
    arrayLayout: "vertical",
    singleLine: false,
    additionalBindings: [],
    itemSpacing: 2,
    showBox: true,
    showUnits: true,
    valueFormat: "%.2f",
    minWidth: 40,
  } satisfies TextReadoutArrayConfig;
```

3. In `dePixelSize` call for preview bbox: pass `pointCount: 1` (wizard binds one point;
   additional bindings are added post-placement via right panel)

4. In `DE_FALLBACK_SLOT`: add `TextReadoutArray: "right"`

5. In `DE_SIDECAR_KEY` map: add `text_readout_array: "TextReadoutArray"`

### DesignerCanvas.tsx

1. Add `text_readout_array: "TextReadoutArray"` to the `DE_SIDECAR_KEY` / `DE_KEY_MAP`
   objects used in all three placement paths (drop, slot popover, drag-from-palette —
   grep for `text_readout: "TextReadout"` and update all occurrences)

2. Add `TextReadoutArray: "right"` to default slot maps in all three placement paths

3. Add case to `makeDefaultDisplayConfig` matching the wizard default above

4. Add `["text_readout_array"]: [40, 16]` to the `MINS` table (resize minimum)

5. Add bbox-extension case for `text_readout_array` matching the centering logic
   (centred on x, top-aligned y — same as `text_readout`)

### DesignerRightPanel.tsx

1. Add `text_readout_array` to the display type selector / switch

2. Add config case rendering:
   - **Layout** — radio buttons: Vertical | Horizontal
   - **Single line** — toggle checkbox
   - **Item spacing** — number input (px), default 2
   - **Typography rows** — reuse the same `TextReadoutRowEditor` sub-component from the
     `text_readout` case (or abstract it so both types share it)
   - **Additional points** — list of PointBinding rows:
     - Each row shows a point picker (PointSelector component) + remove button
     - "Add point" button appends a new empty PointBinding
     - Mutation dispatches `UpdateDisplayElementConfigCommand` (or equivalent)
     - This is the first UI for `additionalBindings` editing; alarm_indicator can reuse
       it later

### Verification

- Place text_readout_array via wizard → appears at right slot, vertically centered on shape
- Right panel shows correct controls
- Adding/removing points in right panel updates the rendered array immediately

---

## Phase 4 — Re-centering on binding changes

**Goal:** Array re-centers on its anchor slot when points are added/removed, unless the user
has moved it away from the slot.

### New helper (anchorSlots.ts or recenterSidecar.ts)

```typescript
/**
 * Returns a new position if the array should re-center, or null if the user
 * has moved it away from its slot.
 *
 * "Still on slot" = current position matches applyDeSlotOffset(oldHints) within 1px.
 */
export function recenterArrayOnBindingChange(
  de: DisplayElement,
  parentSi: SymbolInstance,
  shapeEntry: ShapeEntry,
  oldPointCount: number,
  newPointCount: number,
): { x: number; y: number } | null {
  if (!de.slotId) return null;

  const geo = shapeEntry.sidecar.geometry;
  const naturalW = geo?.baseSize?.[0] ?? geo?.width ?? 48;
  const naturalH = geo?.baseSize?.[1] ?? geo?.height ?? 48;
  const scaledW = naturalW * (parentSi.transform.scale.x ?? 1);
  const scaledH = naturalH * (parentSi.transform.scale.y ?? 1);
  const parentOrigin = parentSi.transform.position;
  const bbox = { x: parentOrigin.x, y: parentOrigin.y, width: scaledW, height: scaledH };

  const cfg = de.config as TextReadoutArrayConfig;
  const hints: DeLayoutHints = {
    pointCount: oldPointCount,
    arrayLayout: cfg.arrayLayout,
    arraySingleLine: cfg.singleLine,
    itemSpacing: cfg.itemSpacing,
  };

  const slotCenter = resolveNamedSlot(de.slotId, bbox);
  const oldPos = applyDeSlotOffset("text_readout_array", de.slotId, slotCenter, hints);

  const dx = Math.abs(de.transform.position.x - oldPos.x);
  const dy = Math.abs(de.transform.position.y - oldPos.y);
  if (dx > 1 || dy > 1) return null; // user has moved it

  const newHints = { ...hints, pointCount: newPointCount };
  const newSlotCenter = resolveNamedSlot(de.slotId, bbox); // same slot, same bbox
  return applyDeSlotOffset("text_readout_array", de.slotId, newSlotCenter, newHints);
}
```

### DesignerRightPanel.tsx

When "Add point" or "Remove point" fires in the additional bindings editor:
1. Compute `oldPointCount` (current bindings length + 1 for primary)
2. Compute `newPointCount` after the change
3. Call `recenterArrayOnBindingChange(...)` to get new position (or null)
4. Dispatch a single `CompositeCommand` (or extend `UpdateDisplayElementConfigCommand` to
   accept an optional position override) so config + position update atomically in undo history

### Verification

- Array with 2 points at right slot: add a 3rd → top edge moves up by `(itemH + gap) / 2`
- Drag array 50px down; add a 4th point → position unchanged

---

## Phase 5 — Live DOM mutation path

**Goal:** Per-item value updates via direct DOM mutation, no React re-renders on point ticks.

### SceneRenderer.tsx (`applyPointValue`)

1. Extract the existing `case "text_readout"` body into a shared helper:
```typescript
function applyTextReadoutLikeMutation(
  el: SVGGElement,
  cfg: TextReadoutConfig | TextReadoutArrayConfig,
  pv: WsPointValue,
  pointId: string | undefined,
  metaMap: Map<string, PointDetail> | undefined,
): void {
  // ... existing text_readout mutation logic
}
```

2. Update `case "text_readout"` to call the helper

3. Add new case:
```typescript
case "text_readout_array_item": {
  // el is the per-item <g data-display-type="text_readout_array_item">
  // The parent node config is on the outer <g data-node-id> — query up:
  const nodeId = el.dataset.nodeId;
  const cfg = nodeConfigMapRef.current.get(nodeId ?? "") as
    TextReadoutArrayConfig | undefined;
  if (cfg) applyTextReadoutLikeMutation(el, cfg, pv, pointId, metaMap);
  break;
}
```

### Verification

- In live console with a graphic containing a 3-point text_readout_array, values update
  independently per item on each WebSocket tick
- No React component re-renders on point ticks (verify with React DevTools profiler)

---

## Phase 6 — Verify universal slot fallback (no file edits)

**Goal:** Confirm all 87 shapes expose TextReadoutArray slots without JSON changes.

Run a verification script:
```bash
node -e "
const fs = require('fs');
const glob = require('glob');
const files = glob.sync('public/shapes/**/*.json');
let ok = 0, missing = 0;
for (const f of files) {
  const j = JSON.parse(fs.readFileSync(f, 'utf8'));
  const slots = j.anchorSlots;
  if (!slots) continue;
  const tr = slots.TextReadout;
  const tra = slots.TextReadoutArray;
  // After code fallback: if TextReadout is non-empty, TextReadoutArray should be available
  if (tr && tr.length > 0 && !tra) ok++;   // will be patched by code fallback
  else if (tra) ok++;                        // explicit — also fine
  else missing++;
}
console.log('Will get TextReadoutArray via fallback:', ok);
console.log('Neither TextReadout nor TextReadoutArray:', missing);
"
```

Expected: `missing = 0` (any shape without TextReadout also has no TextReadoutArray,
which is correct — the fallback only mirrors when TextReadout is non-empty).

---

## Phase 7 — Resize behavior

**Goal:** Resizing the array node changes inter-item spacing only; content size is constant;
overlap is allowed.

### DesignerCanvas.tsx (resize handler)

Add to the resize switch (find by grep for `case "fill_gauge"` in the resize section):
```typescript
case "text_readout_array": {
  const arrayCfg = cfg as TextReadoutArrayConfig;
  const n = Math.max(1, 1 + (arrayCfg.additionalBindings?.length ?? 0));
  const layout = arrayCfg.arrayLayout ?? "vertical";

  // Per-item dimensions (same calc as dePixelSize, single item)
  const singleHints: DeLayoutHints = {
    pointCount: 1,
    arrayLayout: layout,
    arraySingleLine: arrayCfg.singleLine,
  };
  const { w: itemW, h: itemH } = dePixelSize("text_readout_array", singleHints);

  let newSpacing: number;
  if (layout === "vertical") {
    // Distribute extra height as gap; allow negative (overlap) but not inversion
    const minSpacing = -(itemH - 1);
    newSpacing = n > 1
      ? Math.max(minSpacing, (newVisualH - n * itemH) / (n - 1))
      : 0;
  } else {
    const minSpacing = -(itemW - 1);
    newSpacing = n > 1
      ? Math.max(minSpacing, (newVisualW - n * itemW) / (n - 1))
      : 0;
  }
  newConfig = { ...arrayCfg, itemSpacing: newSpacing };
  break;
}
```

Note: `newVisualH` / `newVisualW` are the resize target dimensions already computed by the
surrounding resize handler.

Remove `text_readout_array` from the list of types that are blocked from resizing (if any).

### Verification

- Array with 3 points, natural height 54px: drag handle to 80px → items have 13px spacing
- Drag to 20px → items overlap (negative spacing), no crash

---

## Phase 8 — Tests

Files to add/update:
- `src/test/sidecarCollision.test.ts` — `dePixelSize("text_readout_array", ...)` cases
  (vertical n=3, horizontal n=2, single-line, default)
- `src/test/anchorSlots.test.ts` — `mirrorTextReadoutSlotsForArray` cases:
  (has TextReadout → gets TextReadoutArray; empty TextReadout → no TextReadoutArray;
  explicit TextReadoutArray → not overridden)
- `src/test/recenterSidecar.test.ts` (new) — `recenterArrayOnBindingChange` cases:
  (on slot → re-centers; moved → returns null; n=1 edge case)
- `src/test/pointExtractor.test.ts` — `text_readout_array` with additionalBindings
- Snapshot test: render array 3-point vertical; render array 2-point horizontal single-line

---

## Cross-cutting notes

1. **Spec authority**: Before editing files in `shared/graphics/` or `pages/designer/`,
   check `shared/graphics/CLAUDE.md` and `pages/designer/CLAUDE.md`. Adding a new
   `DisplayElementType` is NOT the same as adding a SceneNode type — the non-negotiable
   of "exactly 11 SceneNode types" is unaffected.

2. **Real-time updates must bypass React.** The per-item `data-point-id` design in Phase 2
   preserves this. Never push `pointValues[]` through React state on the hot path.

3. **Priority shift in Phase 1** is logically a no-op (only relative order matters) but
   grep for any code that compares `SIDECAR_PRIORITY[x] === 2` or similar before committing.

4. **Backwards compatibility.** Existing scenes have no `text_readout_array` nodes;
   the new dispatch branch is only entered when `displayType === "text_readout_array"`.

5. **Phases 1–2 are pure shared code** (no designer-specific files). They can be reviewed
   and tested before touching `DesignerCanvas.tsx` or the wizard.
