# Unified Rendering Pipeline — Phased Implementation Plan

**Goal:** Consolidate all graphical rendering across the application into a single shared pipeline
(`SceneRenderer`) so that shapes, composable parts, and display elements look identical in the
designer, console, process module, wizard previews, and any future surface. Fix bugs once, not
four times.

**Root cause that triggered this work:** Composable parts (actuators, supports, etc.) are lost when
a graphic is loaded in the console. The designer renders them correctly; `SceneRenderer` uses the
wrong lookup field and places all parts at top-center or renders them invisibly.

---

## Quick Reference — Key Files

| File | Role |
|---|---|
| `frontend/src/shared/graphics/SceneRenderer.tsx` | Shared renderer used by Console, Process, Version History |
| `frontend/src/shared/graphics/shapeCache.ts` | `ShapeSidecar` type (incomplete — missing critical fields) |
| `frontend/src/store/designer/libraryStore.ts` | Complete `ShapeSidecar` type (canonical reference) |
| `frontend/src/pages/designer/DesignerCanvas.tsx` | Designer renderer — correct composable algorithm at lines 1998-2058 |
| `frontend/src/pages/designer/components/CategoryShapeWizard.tsx` | Wizard with its own duplicate preview renderer |
| `frontend/src/pages/designer/components/ShapeDropDialog.tsx` | Drop dialog with yet another duplicate preview renderer |
| `frontend/public/shapes/` | Shape JSON sidecars — source of truth for composable geometry |

---

## Phase 1 — Fix the Composable Parts Bug in SceneRenderer

**Scope:** One file, ~30 lines changed. Fixes composable part rendering in Console, Process,
Process Detached, and Version History Preview simultaneously.

**Read before executing:**
- `frontend/src/shared/graphics/SceneRenderer.tsx` (focus on lines 1927-1951)
- `frontend/src/pages/designer/DesignerCanvas.tsx` (focus on lines 1971-2058 — the correct algorithm)
- `frontend/src/shared/graphics/shapeCache.ts` (current incomplete sidecar type)
- `frontend/src/store/designer/libraryStore.ts` lines 65-141 (complete sidecar type with all fields)
- `frontend/public/shapes/valves/valve-gate.json` (example shape with compositeAttachments)
- Any one actuator JSON e.g. `frontend/public/shapes/actuators/part-actuator-diaphragm.json`
  (example part with bodyBase)

**What to do:**

### 1a. Extend `ShapeSidecar` in `shapeCache.ts`

The `ShapeSidecar` interface in `shapeCache.ts` is missing:
- `geometry.bodyBase?: { x: number; y: number }` — the part's own origin point for alignment
- `addons?: Array<{ id: string; file: string; label: string; group?: string; exclusive?: boolean }>`
- `compositeAttachments?: Array<{ forPart: string; x: number; y: number; stemFrom?: { x: number; y: number } }>`
- `anchorSlots` (used by display element slot logic elsewhere)

Use `libraryStore.ts` lines 65-141 as the reference. Add all missing fields to `shapeCache.ts`
`ShapeSidecar`. Do not change `libraryStore.ts` — it already has the correct type.

Also fix `ShapeData.sidecar` — currently typed as `Record<string, unknown>`, change to `ShapeSidecar`.

### 1b. Fix `renderSymbolInstance` in `SceneRenderer.tsx`

**The bug (lines 1927-1951):** The code looks up `sidecar.anchorSlots[part.attachment]` to position
composable parts. That field maps display element type names to slot name lists (e.g.,
`"TextReadout": ["top", "right"]`). It has nothing to do with composable part placement.
`slot[0]` returns the string `"top"`, not a number. The math produces `NaN`. The fallback fires
and everything lands at 0.5, 0.0 (top-center of the base shape).

**The correct algorithm (from DesignerCanvas lines 1998-2058):**

For each composable part:
1. Look up `sidecar.compositeAttachments.find(a => a.forPart === cp.partId)` — specific match first
2. Fall back to `sidecar.compositeAttachments.find(a => a.forPart === addon?.group)` — group match
3. Get the part's `bodyBase` from the part's own sidecar (`partSidecar.geometry.bodyBase`)
4. If both `attachment` and `bodyBase` exist:
   - `px = attachment.x - bodyBase.x`
   - `py = attachment.y - bodyBase.y`
5. If `attachment.stemFrom` exists, render a `<line>` from `stemFrom` to `{attachment.x, attachment.y}`
   with `stroke="#808080" strokeWidth="1.5"`
6. Stacking fallback (no attachment or bodyBase):
   - `cp.attachment === "actuator"` or `"fail-indicator"`: stack above, centered horizontally
   - `cp.attachment === "support"`: stack below, centered horizontally
   - Unknown: overlay at origin (0, 0)

To implement this, SceneRenderer needs access to the part's sidecar, not just its SVG.
Currently `shapeMap` maps `partId -> { svg: string }`. Extend it to also carry the sidecar
`{ svg: string; sidecar: ShapeSidecar | null }` for each loaded shape. Check how
`collectShapeIds` and the shape-loading logic work — the sidecar fetch is already done in the
library store, but SceneRenderer fetches shapes independently via `shapeCache`.

### 1c. Render part SVG correctly

The part SVG must be wrapped in an `<svg>` element with explicit `x`, `y`, `width`, `height`, and
`viewBox` attributes derived from the part sidecar's `geometry` fields. Do not inject the raw SVG
string directly — the part will render at its intrinsic size rather than the correct scaled size.

The pattern used by DesignerCanvas:
- Extract inner content from the part's SVG string (strip the outer `<svg>` wrapper)
- Wrap in a new `<svg x={px} y={py} width={pw} height={ph} viewBox={pVB} overflow="visible">` element
  containing the inner content
- `pw`/`ph`/`pVB` come from the part sidecar's `geometry.width`, `geometry.height`, `geometry.viewBox`

**Verification:**
1. `pnpm build` — no TypeScript errors
2. `pnpm test` — no regressions
3. Open a graphic in the console that has a valve with an actuator — verify the actuator appears at
   the correct position on the valve body, not top-center
4. Open the same graphic in the designer — verify it still looks the same (no regression)
5. Open the Process module with the same graphic — verify parity with console

---

## Phase 2 — Merge Sidecar Types into One Canonical Definition

**Scope:** 2-3 files. No visual changes. Eliminates the two-headed type problem that causes
constant friction and will cause TypeScript errors in Phase 3.

**Read before executing:**
- `frontend/src/shared/graphics/shapeCache.ts` (updated in Phase 1)
- `frontend/src/store/designer/libraryStore.ts` lines 1-141
- `frontend/src/shared/graphics/SceneRenderer.tsx` (look for all sidecar type references)

**What to do:**

### 2a. Decide on the canonical location

The `ShapeSidecar` type in `libraryStore.ts` is the most complete. Move it to a shared types file.
`frontend/src/shared/types/shapes.ts` is a reasonable location — check if it exists first. If a
shared types file already exists that covers shape types, use that. Export `ShapeSidecar` from there.

### 2b. Update all imports

Remove `ShapeSidecar` definition from `shapeCache.ts` and `libraryStore.ts`. Import from the
shared location in both files. Search for any other files that define or import `ShapeSidecar` or
reference sidecar shape inline — update those too.

### 2c. Audit for type gaps

With a single canonical type, run `pnpm build` and fix TypeScript errors caused by previously
mismatched fields. Watch for:
- `geometry.baseSize` vs `geometry.width`/`geometry.height` — `libraryStore` supports both tuple
  and flat formats; make the canonical type handle both
- `alarmAnchor` as `[number, number]` tuple vs `{ nx: number; ny: number }` object — handle both
- `states` as `Record<string, string>` vs `string[]` — handle both

Both old implementations already handle these variants; the canonical type must too.

**Verification:**
- `pnpm build` clean with zero type errors
- `pnpm test` passes
- No visual change expected — this is a type-only refactor

---

## Phase 3 — Replace Wizard and Drop Dialog Preview Renderers

**Scope:** 2 files (`CategoryShapeWizard.tsx`, `ShapeDropDialog.tsx`). Removes ~400 lines of
duplicate preview rendering code and replaces with SceneRenderer.

**Read before executing:**
- `frontend/src/pages/designer/components/CategoryShapeWizard.tsx` (full file — find `CompositePreview`
  component and `renderDEPreview` function)
- `frontend/src/pages/designer/components/ShapeDropDialog.tsx` (full file — find preview rendering)
- `frontend/src/shared/graphics/SceneRenderer.tsx` (understand its props interface fully)

**What to do:**

### 3a. Audit SceneRenderer for preview-mode support

SceneRenderer needs to work in a "static preview" mode:
- No live point subscriptions (`liveSubscribe={false}`)
- No click handlers
- No selection state
- Display elements show placeholder/no-data values instead of live values
- Fixed viewport, no pan/zoom

Check if the current props already support this. If SceneRenderer needs a placeholder display
element mode, add a `previewMode?: boolean` prop that renders display elements with visual
placeholders (em-dash or neutral state) instead of live data.

### 3b. Build a minimal `GraphicDocument` for wizard preview

The wizard knows the selected shape, selected variant, and which composable parts are attached.
Construct a minimal `GraphicDocument` with a single `symbol_instance` node representing the
current configuration. Pass it to SceneRenderer. Update it reactively as the user changes
selections in the wizard.

### 3c. Replace `CompositePreview` in `CategoryShapeWizard.tsx`

Delete `CompositePreview` component and `renderDEPreview` function. Replace the preview panel
with `<SceneRenderer document={previewDoc} liveSubscribe={false} />` (or with `previewMode` prop).

Use SceneRenderer's auto-fit logic (if it has one) to fit the preview to the available panel
width — do not hard-code dimensions.

### 3d. Repeat for `ShapeDropDialog.tsx`

Same approach — find the preview rendering, replace with SceneRenderer.

**Caveats for Phase 3:**
- The wizard shows display elements with placeholder values. Do not remove the old code until
  SceneRenderer can render display elements in placeholder/no-data mode — otherwise the wizard
  will show no display element previews at all, which is worse than the current state.
- Test the wizard end-to-end after the change.

**Verification:**
1. `pnpm build` + `pnpm test`
2. Open the designer, click to add a shape, go through the wizard:
   - Verify the preview renders the correct shape
   - Verify composable parts appear in correct positions (should now work via Phase 1 fix)
   - Verify display elements show placeholders
   - Verify that changing the variant updates the preview
   - Verify that adding/removing composable parts updates the preview
3. Drag a shape from the palette to the canvas — verify the drop dialog preview is correct
4. Compare wizard preview visually to how the shape looks on the canvas after placement

---

## Phase 4 — DesignerCanvas Delegates Rendering to SceneRenderer

**Scope:** The major structural refactor. `DesignerCanvas.tsx` (12,260 lines) has ~3,000 lines of
rendering logic fused with ~9,000 lines of interaction logic. Extract pure rendering into
SceneRenderer; DesignerCanvas becomes the interaction controller only.

**WARNING:** Highest-risk phase. DesignerCanvas is the most complex component in the codebase and
is actively worked on. Plan this as a dedicated sprint. Do not start while other designer work is
in progress — merge conflicts will be constant.

**Read before executing:**
- `frontend/src/pages/designer/DesignerCanvas.tsx` (full file — understand `RenderNode` switch
  at line 1781, composable parts at lines 1971-2058, display element rendering throughout)
- `frontend/src/shared/graphics/SceneRenderer.tsx` (full current state after Phases 1-3)
- `frontend/src/store/designer/uiStore.ts` (selection state, tool state)
- `frontend/src/store/designer/sceneStore.ts` (scene graph — source of truth)
- `frontend/src/pages/designer/CLAUDE.md` (non-negotiables — read carefully before touching anything)
- `frontend/src/shared/graphics/CLAUDE.md` (rendering spec non-negotiables — read carefully)

**What to do:**

### 4a. Add overlay hook to SceneRenderer

Add a `renderNodeOverlay?: (node: SceneNode) => ReactElement | null` prop to SceneRenderer.
After rendering each node, call this hook. DesignerCanvas will use it to inject selection rects
and resize handles per node without SceneRenderer knowing about designer concepts.

Designer-only visual elements that must NOT go into SceneRenderer's core:
- Selection highlight rect — rendered via `renderNodeOverlay`
- Resize handles (corner + edge squares) — rendered via `renderNodeOverlay`
- Rotation handle — rendered via `renderNodeOverlay`
- Smart guide lines — canvas-level overlay, keep entirely in DesignerCanvas
- Grid dots/lines — canvas-level overlay, keep entirely in DesignerCanvas
- Ruler overlay — canvas-level overlay, keep entirely in DesignerCanvas
- Drag preview ghost — separate SVG layer, keep in DesignerCanvas

### 4b. Bridge the data source

SceneRenderer takes `document: GraphicDocument` as a prop.
DesignerCanvas reads from Zustand `sceneStore`.

Recommended approach: DesignerCanvas subscribes to `sceneStore` and derives a `GraphicDocument`
to pass as a prop to SceneRenderer. This keeps SceneRenderer store-agnostic. Overhead is one
derivation per render — acceptable for typical graphic sizes.

Do not couple SceneRenderer to `sceneStore` directly. That makes it impossible to use SceneRenderer
outside the designer context.

### 4c. Handle the 60fps drag exception

The designer spec (DesignerCanvas CLAUDE.md) explicitly requires: during active drag, the SVG DOM
may temporarily diverge from `sceneStore` for 60fps performance.

Approach: during drag, DesignerCanvas renders a "drag ghost" layer (the dragged node at its new
position) as a separate SVG overlay on top of SceneRenderer. SceneRenderer continues rendering the
pre-drag sceneStore state. On mouseup, commit via `MoveNodeCommand` — sceneStore updates, SceneRenderer
re-renders from the committed state.

Do not route active-drag position through React state or SceneRenderer — that will not hit 60fps
at any meaningful node count.

### 4d. Extract `RenderNode` one node type at a time

Do NOT attempt to replace all of `RenderNode` in one commit. Extract type by type and verify
between each:

1. `primitive` (rect, circle, line, text — simplest, lowest risk)
2. `text_block`
3. `annotation`
4. `image`
5. `embedded_svg`
6. `stencil`
7. `widget`
8. `pipe`
9. `display_element` (standalone display elements)
10. `symbol_instance` (most complex — save for last; composable parts, display element children,
    state classes, text zones)
11. `group` (recursive — verify last since it wraps everything else)

For each type: make SceneRenderer handle it correctly in designer mode, update DesignerCanvas to
delegate that type's rendering to SceneRenderer, verify visually, commit, move on.

### 4e. Delete dead code as each type migrates

As each rendering path moves out of DesignerCanvas, delete the old code immediately in the same
commit. Do not leave dead code "just in case." Leaving it creates confusion about which path is
active and is how the file got to 12,260 lines in the first place.

**Hard constraints — do not violate:**
- `sceneStore` remains single source of truth. SceneRenderer must not own or mutate node data.
- Point value updates must still bypass React and write directly to the SVG DOM via `data-point-id`
  attribute mutations. Do not route live values through React state.
- LOD thresholds: React above 3,000 elements; hybrid at 1,500-3,000; direct DOM mutation below
  1,500. These numbers come from the spec — do not invent different thresholds.
- LOD class (`.lod-0` through `.lod-3`) goes on the container div, not the SVG element.
- Drag performance must not regress — test at 100+ nodes with active drag before declaring done.

**Verification:**
1. `pnpm build` + `pnpm test` after each node type extraction
2. Full designer UAT after all types extracted:
   - Add shapes of every node type
   - Select, move, resize, rotate shapes
   - Add composable parts via wizard
   - Add display elements
   - Draw pipes
   - Add annotations, text blocks, images
   - Undo/redo all of the above
   - Test with 50+ node graphic for performance
3. Console rendering parity: same graphic must look identical in designer and console
4. Process module parity: same graphic, same look
5. Wizard preview parity: wizard preview must match placed result

---

## Surfaces That Will NOT Be Unified (By Design)

These are out of scope and correct as-is:

| Surface | Why it stays separate |
|---|---|
| **TileGraphicViewer** (phone) | Leaflet CRS.Simple tiles, server-side rendered — fundamentally different tech stack |
| **Server-side thumbnails** | `resvg` PNG generation — frontend has no control; fix separately if broken |
| **Shape palette thumbnails** | Raw `<img src="shape.svg">` — intentionally shows individual shapes, not composites |

If composable parts are missing from server-generated thumbnails after Phase 1, that is a separate
backend issue in the `resvg` tile/thumbnail rendering path and needs its own investigation.

---

## Phase Dependency Summary

```
Phase 1 — Fix composable bug in SceneRenderer (hours, low risk)
    └── Phase 2 — Merge sidecar types (1 day, low risk)
            └── Phase 3 — Replace wizard preview renderers (1-2 days, low risk)
                    └── Phase 4 — Designer canvas delegates to SceneRenderer (2-4 weeks, high risk)
```

Phases 1-3 are worth doing regardless of whether Phase 4 ever happens. They fix the immediate
user-visible bug, eliminate wizard duplication, and set up the type foundations. Phase 4 eliminates
the remaining dual-maintenance problem for the designer specifically and should be planned as a
dedicated sprint when no other designer features are in flight.
