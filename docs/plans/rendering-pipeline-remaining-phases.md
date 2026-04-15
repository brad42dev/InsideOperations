# Rendering Pipeline — Remaining Node Type Extraction

**Context:** The original `unified-rendering-pipeline-plan.md` covered 4 phases:
- Phase 1: Fixed composable parts bug in SceneRenderer (done)
- Phase 2: Merged sidecar types into one canonical definition in `shared/types/shapes.ts` (done)
- Phase 3: Replaced wizard/dialog preview renderers with SceneRenderer (done)
- Phase 4: Began DesignerCanvas delegation to shared render functions (in progress)

Phase 4 has been partially completed. A shared `renderNodeSvg.tsx` file exists at
`frontend/src/shared/graphics/renderNodeSvg.tsx` with pure render functions for 5 node types
(`primitive`, `text_block`, `annotation`, `image`, `embedded_svg`). Both DesignerCanvas and
SceneRenderer already delegate those 5 types to the shared functions.

**This file covers the remaining 6 node types:**
1. `stencil` — user-authored SVG blobs loaded by design_objects ID
2. `widget` — dashboard/report widgets rendered as HTML overlay or SVG placeholder
3. `pipe` — piping lines with service-type coloring, insulation, and auto-routing
4. `display_element` — live point value readouts (7 sub-types, bypass-React DOM mutation)
5. `symbol_instance` — shape library symbols with composable parts, text zones, state classes
6. `group` — recursive wrapper that renders children via the main renderNode dispatch

Each phase below is self-contained: an executing agent can read this file and execute a single
phase without needing the others.

---

## Phase 1 — Stencil and Widget

### Scope

Extract `stencil` and `widget` rendering into shared functions. These are the two simplest
remaining types: stencils are user-uploaded SVG blobs with no live data, and widgets are either
SVG placeholders or HTML overlay elements with no point-value integration.

### Read before executing

- `frontend/src/shared/graphics/renderNodeSvg.tsx` (entire file — understand `RenderContext` interface and the pattern used by existing functions)
- `frontend/src/shared/graphics/SceneRenderer.tsx` lines 718-770 (`renderStencil`)
- `frontend/src/shared/graphics/SceneRenderer.tsx` lines 1980-1984 (widget case — returns null, widgets go to HTML overlay)
- `frontend/src/shared/graphics/SceneRenderer.tsx` lines 2011-2020 (`collectWidgets` and HTML overlay rendering, lines 2124-2162)
- `frontend/src/pages/designer/DesignerCanvas.tsx` lines 1993-2018 (stencil case — currently a placeholder)
- `frontend/src/pages/designer/DesignerCanvas.tsx` lines 1408-1583 (`WidgetRenderer` component)
- `frontend/src/pages/designer/DesignerCanvas.tsx` lines 1980-1983 (widget case in RenderNode)
- `frontend/src/shared/types/graphics.ts` lines 416-426 (`Stencil` interface)
- `frontend/src/shared/types/graphics.ts` lines 721-731 (`WidgetNode` interface)

### What to do

#### 1a. Add `renderStencilSvg` to `renderNodeSvg.tsx`

Add a new exported function:

```typescript
export function renderStencilSvg(
  node: Stencil,
  ctx: StencilRenderContext,
): React.ReactElement;
```

This function needs access to the stencil's SVG content, which is loaded asynchronously from
`/api/v1/design-objects/{stencilId}`. The pure render function cannot do async work, so the
caller must provide the SVG content (or null if not yet loaded).

**Extend `RenderContext` with an optional field** (or create a sub-interface):

```typescript
export interface StencilRenderContext extends RenderContext {
  /** Pre-fetched SVG content for the stencil, or null if not yet loaded */
  svgContent: string | null;
  /** Stencil display size */
  size: { width: number; height: number };
  /** Stencil display name (for loading placeholder) */
  displayName?: string;
}
```

The function should:
1. If `ctx.svgContent` is null, render a placeholder: dashed rect + centered text with the
   stencil name (match SceneRenderer's pattern at line 724-754)
2. If `ctx.svgContent` is available, render a `<g>` with innerHTML containing the SVG content
   (match SceneRenderer's pattern at lines 756-769). Note: stencil SVG content is
   server-authored from design_objects — same trust level as base shape SVGs fetched from
   /shapes/. Use `React.createElement("g", { ..., dangerouslySetInnerHTML: { __html: ... } })`
   as the existing `renderEmbeddedSvgSvg` does.
3. Include standard `data-node-id`, `data-lod="0"`, `opacity`, `onClick`, `cursor` from ctx

Import `Stencil` from `../../shared/types/graphics`.

#### 1b. Add `renderWidgetPlaceholderSvg` to `renderNodeSvg.tsx`

Add a new exported function for the SVG-mode widget placeholder (designer mode):

```typescript
export function renderWidgetPlaceholderSvg(
  node: WidgetNode,
  ctx: RenderContext,
): React.ReactElement;
```

This renders the static SVG placeholder used by DesignerCanvas (lines 1519-1583): a rounded
rect with a title bar, centered icon, and type label. It does NOT handle the live
foreignObject preview or the HTML overlay — those stay in their respective callers.

The function should:
1. Render the background rect, title bar, title text, center icon, and type label
2. Use the `WIDGET_ICONS` map (move it to `renderNodeSvg.tsx` or keep it local)
3. Include standard `data-node-id`, `opacity`, `transform` from ctx

Note: SceneRenderer renders widgets in an HTML overlay div (not SVG) and returns `null` from
the SVG switch case. This function is only for the DesignerCanvas SVG placeholder. SceneRenderer
will continue returning null and rendering widgets in its HTML overlay layer.

#### 1c. Update SceneRenderer to use `renderStencilSvg`

In `SceneRenderer.tsx`:
1. Import `renderStencilSvg` and `StencilRenderContext` from `./renderNodeSvg`
2. Replace the `renderStencil` function (lines 718-770) with a call to `renderStencilSvg`,
   building a `StencilRenderContext` from the existing `stencilMap`, `getTransformAttr`, and
   `handleNodeClick`:

```typescript
function renderStencil(node: Stencil): React.ReactElement {
  const ctx: StencilRenderContext = {
    ...makeRenderCtx(node),
    svgContent: stencilMap.get(node.stencilRef.stencilId) ?? null,
    size: { width: node.size?.width ?? 48, height: node.size?.height ?? 48 },
    displayName: node.name,
  };
  return renderStencilSvg(node, ctx);
}
```

#### 1d. Update DesignerCanvas to use `renderStencilSvg`

In `DesignerCanvas.tsx`:
1. Import `renderStencilSvg` and `StencilRenderContext` from the shared module
2. Replace the stencil case (lines 1993-2018) with a call to `renderStencilSvg`
3. DesignerCanvas currently shows a generic placeholder for stencils. The stencil SVG data
   is available via `useLibraryStore.getState().getStencil(stencilId)` — wire it up:

```typescript
case "stencil": {
  const st = node as Stencil;
  const stencilSvg = useLibraryStore.getState().getStencil(st.stencilRef.stencilId);
  const stCtx: StencilRenderContext = {
    transform: tx,
    svgContent: stencilSvg,
    size: { width: st.size?.width ?? 48, height: st.size?.height ?? 48 },
    displayName: st.name || "Stencil",
  };
  return renderStencilSvg(st, stCtx);
}
```

4. If `useLibraryStore.getState().getStencil` returns null, trigger a load:
   check if there's already a `loadStencil` call happening; if not, call
   `useLibraryStore.getState().loadStencil(st.stencilRef.stencilId)` (fire-and-forget).
   The placeholder will render until the next React render when the cache is populated.

#### 1e. Widget — DesignerCanvas only change

The DesignerCanvas `WidgetRenderer` component (lines 1408-1583) is a React component with
hooks (`useUiStore`, `useSceneStore`, `useContext`). Because it uses hooks and has two render
modes (SVG placeholder vs. foreignObject live preview), it cannot be a pure function.

**Do not extract `WidgetRenderer` to a shared module.** Instead:
1. Extract only the static SVG placeholder portion (lines 1519-1583) into the shared
   `renderWidgetPlaceholderSvg` function
2. Have `WidgetRenderer` call `renderWidgetPlaceholderSvg` for its static mode
3. The live foreignObject preview mode stays in `WidgetRenderer`
4. SceneRenderer continues returning null for widgets in SVG and rendering them in its
   HTML overlay div — no change needed

### RenderContext additions

Add `StencilRenderContext` as described above. No changes to the base `RenderContext` interface.

### Async loading pattern

Stencil SVG content is fetched asynchronously. Both callers handle this differently:
- **SceneRenderer**: fetches all stencil IDs in a `useEffect` (lines 517-552), stores results
  in `stencilMap` state. The render function reads from `stencilMap` synchronously.
- **DesignerCanvas**: uses `libraryStore.getStencil()` for sync lookup and
  `libraryStore.loadStencil()` to trigger async fetch. Zustand subscription drives re-render.

The shared `renderStencilSvg` function is pure — it takes `svgContent: string | null` and
renders either the SVG or a placeholder. The async loading responsibility stays with the caller.

### Hard constraints

- `sceneStore` remains single source of truth — SceneRenderer must not own or mutate node data
- Point value updates bypass React — write directly to SVG DOM via `data-point-id` attributes
- LOD thresholds: React > 3,000 elements; hybrid 1,500-3,000; direct DOM < 1,500
- LOD class on container div, not SVG element
- Exactly 11 SceneNode types — do not add new ones
- `pnpm build` must be clean after this phase

### Verification

1. `cd frontend && pnpm build` — zero errors
2. `cd frontend && pnpm test` — no regressions
3. Open a graphic containing stencils in the Console — verify stencils render (not just
   placeholders). If no test graphic has stencils, create one in the Designer.
4. Open the same graphic in the Designer — verify stencils look the same
5. Open a dashboard graphic with widgets in the Designer — verify widget placeholders still
   render correctly in design mode and live preview mode
6. Open a dashboard graphic in Console — verify widgets still render in HTML overlay

---

## Phase 2 — Pipe

### Scope

Extract pipe rendering into a shared function. Pipes are medium complexity: they use
service-type color mapping, support insulation rendering (double/triple lines), and have two
routing modes (auto with waypoints vs. manual polyline). DesignerCanvas and SceneRenderer use
significantly different pipe rendering approaches that must be reconciled.

### Read before executing

- `frontend/src/shared/graphics/renderNodeSvg.tsx` (entire file — understand existing pattern)
- `frontend/src/shared/graphics/SceneRenderer.tsx` lines 645-701 (`renderPipe`)
- `frontend/src/pages/designer/DesignerCanvas.tsx` lines 1654-1745 (pipe case in RenderNode)
- `frontend/src/shared/types/graphics.ts` lines 377-391 (`Pipe` interface)
- `frontend/src/shared/types/graphics.ts` lines 800-809 (`PIPE_SERVICE_COLORS`)
- `frontend/src/shared/graphics/pipeRouter.ts` (the `routePipe` function used by DesignerCanvas)

### What to do

#### 2a. Understand the rendering differences

The two renderers handle pipes differently:

**SceneRenderer (lines 645-701):**
- Uses `node.pathData` directly (pre-computed SVG path string)
- Insulation: triple-stroke technique (wide color stroke, narrower gap stroke, thin center stroke)
- Renders an optional text label via `<textPath>`
- No auto-routing — pathData is already resolved

**DesignerCanvas (lines 1654-1745):**
- Two modes: `routingMode === "auto"` uses `routePipe()` to compute path from waypoints;
  `routingMode === "manual"` builds a polyline from waypoints
- Insulation: parallel offset lines (dashed) above and below the main path
- Does NOT use `node.pathData` — computes geometry from waypoints at render time
- Does NOT render a text label

These differences are intentional: the Designer needs live waypoint-based routing for
interactive pipe drawing, while the Console uses pre-computed pathData from the saved document.

#### 2b. Create `renderPipeSvg` with mode parameter

Add to `renderNodeSvg.tsx`:

```typescript
export interface PipeRenderContext extends RenderContext {
  /** Canvas background color for insulation gap stroke (SceneRenderer only) */
  canvasBgColor?: string;
}

export function renderPipeSvg(
  node: Pipe,
  ctx: PipeRenderContext,
  resolvedPath?: { pathD: string | null; polylinePoints: string | null },
): React.ReactElement;
```

The function should:
1. Look up color from `PIPE_SERVICE_COLORS[node.serviceType]` (import from graphics types)
2. If `resolvedPath` is provided (DesignerCanvas auto-route mode), use its `pathD`/`polylinePoints`
3. Otherwise use `node.pathData` (SceneRenderer mode, and DesignerCanvas manual mode fallback)
4. Render insulation using SceneRenderer's triple-stroke technique (it is more visually
   accurate than DesignerCanvas's parallel offset approach, and simpler to implement)
5. Render optional `node.label` via `<textPath>` (currently only SceneRenderer does this —
   adding it to the shared function gives DesignerCanvas label support for free)
6. Include standard data attributes (`data-node-id`, `data-lod="0"`)

Import `Pipe` and `PIPE_SERVICE_COLORS` from the types module.

#### 2c. Update SceneRenderer

Replace `renderPipe` (lines 645-701) with a call to `renderPipeSvg`:

```typescript
function renderPipe(node: Pipe): React.ReactElement {
  const ctx: PipeRenderContext = {
    ...makeRenderCtx(node),
    canvasBgColor: canvas.backgroundColor ?? "var(--io-surface-secondary)",
  };
  return renderPipeSvg(node, ctx);
}
```

#### 2d. Update DesignerCanvas

Replace the pipe case (lines 1654-1745). For auto-routing mode, compute the resolved path
and pass it:

```typescript
case "pipe": {
  const pipe = node as Pipe;
  const pipeCtx: PipeRenderContext = { transform: tx };
  if (pipe.routingMode === "auto" && pipe.waypoints.length >= 2) {
    const [start, ...rest] = pipe.waypoints;
    const end = rest[rest.length - 1];
    const midWaypoints = rest.slice(0, -1);
    const pathD = routePipe(start, end, new Set(), midWaypoints);
    return renderPipeSvg(pipe, pipeCtx, { pathD, polylinePoints: null });
  }
  const pts = pipe.waypoints.map((p) => `${p.x},${p.y}`).join(" ");
  return renderPipeSvg(pipe, pipeCtx, { pathD: null, polylinePoints: pts });
}
```

#### 2e. Reconcile insulation rendering

DesignerCanvas uses parallel offset lines; SceneRenderer uses triple-stroke. The shared
function should use the triple-stroke approach because:
- It works with both path and polyline geometry
- It doesn't need separate `<path>` and `<polyline>` duplication for insulation lines
- It is visually closer to the ISA convention

However, the DesignerCanvas insulation approach has a CSS `transform: translate(...)` offset
that may look different from the triple-stroke. Test both and pick whichever looks correct.
If the DesignerCanvas insulation was intentionally different for interactive editing
feedback, keep both approaches and add an `insulationStyle` parameter to the context.

### RenderContext additions

Add `PipeRenderContext` with `canvasBgColor?: string` for the triple-stroke gap color.

### Hard constraints

- `sceneStore` remains single source of truth — SceneRenderer must not own or mutate node data
- Point value updates bypass React — write directly to SVG DOM via `data-point-id` attributes
- LOD thresholds: React > 3,000 elements; hybrid 1,500-3,000; direct DOM < 1,500
- LOD class on container div, not SVG element
- Exactly 11 SceneNode types — do not add new ones
- `pnpm build` must be clean after this phase

### Verification

1. `cd frontend && pnpm build` — zero errors
2. `cd frontend && pnpm test` — no regressions
3. Open a P&ID graphic with pipes in the Console — verify:
   - Pipe colors match service types
   - Insulated pipes render with triple-line effect
   - Pipe labels appear on the path
4. Open the same graphic in the Designer — verify:
   - Pipes still render in all routing modes (auto, manual)
   - Insulation looks correct
   - Pipe editing (moving waypoints) still works
5. Draw a new pipe in the Designer — verify it renders correctly during and after drawing

---

## Phase 3 — Display Element

### Scope

Extract `display_element` rendering into shared functions. This is complex because:
- There are 7 display sub-types: `text_readout`, `alarm_indicator`, `digital_status`,
  `analog_bar`, `fill_gauge`, `sparkline`, `point_name_label`
- SceneRenderer renders with live point data and direct DOM mutation
- DesignerCanvas renders in two modes: static design preview and live test mode
- Display elements are children of `symbol_instance` nodes (nested rendering)
- `text_readout` in DesignerCanvas uses `useLayoutEffect` + `getComputedTextLength()` for
  dynamic width measurement — this is a React hook and cannot go into a pure function

This phase must be done BEFORE Phase 4 (symbol_instance) because symbol_instance contains
nested display elements.

### Read before executing

- `frontend/src/shared/graphics/renderNodeSvg.tsx` (entire file)
- `frontend/src/shared/graphics/SceneRenderer.tsx` lines 775-1691 (`renderDisplayElement`)
- `frontend/src/shared/graphics/SceneRenderer.tsx` lines 2165-2250 (helper functions:
  `ALARM_PRIORITY_NAMES`, `formatValue`, `renderAlarmShape`)
- `frontend/src/shared/graphics/SceneRenderer.tsx` lines 2252-end (`applyPointValue` — the
  direct DOM mutation function; DO NOT MOVE this, just understand it)
- `frontend/src/shared/graphics/displayElementColors.ts` (entire file — `ALARM_COLORS`,
  `ZONE_FILLS`, `DE_COLORS`)
- `frontend/src/pages/designer/DesignerCanvas.tsx` lines 667-674 (`formatValue`)
- `frontend/src/pages/designer/DesignerCanvas.tsx` lines 691-695 (`deFontToCss`)
- `frontend/src/pages/designer/DesignerCanvas.tsx` lines 702-849 (`TextReadoutDE`)
- `frontend/src/pages/designer/DesignerCanvas.tsx` lines 851-1391 (`DisplayElementRenderer`)
- `frontend/src/pages/designer/DesignerCanvas.tsx` lines 1942-1945 (display_element case)
- `frontend/src/shared/types/graphics.ts` lines 308-375 (`DisplayElement` interface and
  config types)

### What to do

#### 3a. Move shared helper functions to `renderNodeSvg.tsx` (or a new `displayElementHelpers.ts`)

The following functions exist in SceneRenderer and are needed by the shared render functions.
Move them to a shared location (either `renderNodeSvg.tsx` or a new dedicated file like
`frontend/src/shared/graphics/displayElementHelpers.ts`):

1. `formatValue(raw, fmt)` — value formatting. DesignerCanvas has its own simpler version;
   use SceneRenderer's version (more complete, handles `%auto`, `%g`, etc.)
2. `renderAlarmShape(priority, isGhost, color)` — alarm indicator shapes per priority
3. `ALARM_PRIORITY_NAMES` constant — maps priority numbers to CSS class name suffixes
4. `deFontToCss(f)` — font family name to CSS font-family string (from DesignerCanvas)

Do NOT move `applyPointValue` — it is the direct DOM mutation function and stays in
SceneRenderer. It operates on raw DOM elements, not React elements.

#### 3b. Create `DisplayElementRenderContext`

```typescript
export interface DisplayElementRenderContext extends RenderContext {
  /** Resolved point value for this element (null if no binding or no data) */
  pointValue?: {
    value: string | number | null;
    units?: string;
    alarmPriority?: 1 | 2 | 3 | 4 | 5 | null;
    unacknowledged?: boolean;
    quality?: string;
    stale?: boolean;
    manual?: boolean;
    tag?: string;
  } | null;
  /** Resolved point ID (UUID) for data-point-id attribute */
  resolvedPointId?: string;
  /** Point tag name for data-point-tag attribute */
  pointTag?: string;
  /** Offset from parent symbol_instance origin (for signal line rendering) */
  parentOffset?: { x: number; y: number };
  /** Vessel interior SVG path (for fill_gauge vessel_overlay mode) */
  vesselInteriorPath?: string;
  /** Sparkline history data (array of numeric values, oldest first) */
  sparklineHistory?: number[];
  /** Whether in designer/preview mode (affects alarm_indicator ghost rendering) */
  designerMode?: boolean;
  /** Setpoint binding point value (for analog_bar setpoint diamond) */
  setpointValue?: number | null;
  /** Point metadata for discrete label resolution */
  pointMeta?: {
    point_category?: string;
    enum_labels?: Record<string, string>;
    engineering_unit?: string;
  };
}
```

#### 3c. Create shared render functions per display sub-type

Add to `renderNodeSvg.tsx` (or a new `renderDisplayElementSvg.tsx` file — if the file is
getting too large, split it):

```typescript
export function renderDisplayElementSvg(
  node: DisplayElement,
  ctx: DisplayElementRenderContext,
): React.ReactElement | null;
```

This is the main dispatch function. It switches on `node.displayType` and calls sub-functions:
- `renderTextReadoutSvg(node, ctx)` — the SceneRenderer version (row-based layout with
  alarm colors, quality states, manual badge). Does NOT use `getComputedTextLength()`.
- `renderAlarmIndicatorSvg(node, ctx)`
- `renderDigitalStatusSvg(node, ctx)`
- `renderAnalogBarSvg(node, ctx)`
- `renderFillGaugeSvg(node, ctx)` — handles both standalone and vessel_overlay modes
- `renderSparklineSvg(node, ctx)`
- `renderPointNameLabelSvg(node, ctx)`

Each function follows SceneRenderer's rendering logic exactly (lines 800-1691). The
SceneRenderer versions are more feature-complete than DesignerCanvas (they handle alarm
states, quality indicators, signal lines, etc.).

**Critical data attributes:** Each display element MUST include these attributes for the
direct DOM mutation path to work:
- `data-node-id={node.id}`
- `data-lod="1"` or `data-lod="2"` (varies by sub-type)
- `data-point-id={ctx.resolvedPointId}` (when bound to a point)
- `data-point-tag={ctx.pointTag}`
- `data-display-type={node.displayType}`
- `data-role` attributes on child SVG elements (e.g., `data-role="value"`,
  `data-role="box"`, `data-role="fill"`, `data-role="pointer"`) — these are the anchors
  that `applyPointValue` uses to find and mutate elements

If these attributes are missing or wrong, live point updates will silently break.

#### 3d. Update SceneRenderer to use shared functions

Replace `renderDisplayElement` (lines 775-1691) with a wrapper that builds
`DisplayElementRenderContext` from the component's state:

```typescript
function renderDisplayElement(
  node: DisplayElement,
  parentOffset?: { x: number; y: number },
  vesselInteriorPath?: string,
): React.ReactElement | null {
  // ... existing point value resolution logic (lines 780-796) ...
  const ctx: DisplayElementRenderContext = {
    transform: getTransformAttr(node),
    pointValue: pv ? { /* map fields */ } : null,
    resolvedPointId: pvKey,
    pointTag,
    parentOffset,
    vesselInteriorPath,
    sparklineHistory: pvKey ? sparklineHistories.get(pvKey) : undefined,
    designerMode,
    setpointValue: /* resolve from config */,
    pointMeta: pvKey ? pointMetaMap.get(pvKey) : undefined,
  };
  return renderDisplayElementSvg(node, ctx);
}
```

The point value resolution logic (UUID detection, tag resolution, fallback chain at lines
780-796) stays in SceneRenderer because it depends on `resolvedTagMap` and `pointValues`
state. The shared function receives already-resolved values.

#### 3e. Update DesignerCanvas

DesignerCanvas has two rendering modes for display elements:
1. **Design mode** (static preview) — `DisplayElementRenderer` lines 1086-1391
2. **Test mode** (live values from TestModeContext) — `DisplayElementRenderer` lines 884-1083

**For design mode:** Replace the static preview cases with calls to `renderDisplayElementSvg`
passing null point values. The shared function with null `pointValue` should produce output
equivalent to the current design-mode placeholders.

**For test mode:** Replace the live cases with calls to `renderDisplayElementSvg` passing
the test mode point values from `TestModeContext`.

**Exception — `TextReadoutDE`:** DesignerCanvas uses `useLayoutEffect` +
`getComputedTextLength()` for pixel-accurate text_readout box width measurement. The shared
pure function cannot use hooks. Two options:

*Option A (recommended):* Keep `TextReadoutDE` as a DesignerCanvas-local React component
for the designer's text_readout rendering. The shared `renderTextReadoutSvg` uses the
SceneRenderer's character-count width estimation (`rawValueStr.length * 7 + euSuffix.length * 5 + 8`),
which is what Console and Process already use. The slight width difference in the Designer
is acceptable because the Designer already has a different visual style for design mode.

*Option B:* Create a thin React wrapper component in the shared module that uses the pure
render function for layout but adds the measurement hook. This is more work and creates a
React component in what is supposed to be a pure-function module.

Go with Option A.

#### 3f. Delete DesignerCanvas `formatValue`

After migration, delete the `formatValue` function at DesignerCanvas line 667-674 and import
the shared version.

### RenderContext additions

Add `DisplayElementRenderContext` as described above.

### Async loading pattern

Display elements do not load external assets. All data comes from point value subscriptions
(already resolved by the caller). No async changes needed.

### Hard constraints

- `sceneStore` remains single source of truth — SceneRenderer must not own or mutate node data
- Point value updates bypass React — write directly to SVG DOM via `data-point-id` attributes
- LOD thresholds: React > 3,000 elements; hybrid 1,500-3,000; direct DOM < 1,500
- LOD class on container div, not SVG element
- Exactly 11 SceneNode types — do not add new ones
- `pnpm build` must be clean after this phase
- **Critical:** `data-role` attributes on sub-elements must be preserved exactly — they are
  the anchors for `applyPointValue` direct DOM mutation

### Verification

1. `cd frontend && pnpm build` — zero errors
2. `cd frontend && pnpm test` — no regressions
3. Open a graphic with display elements in the Console with live data flowing:
   - `text_readout`: value updates in real time, alarm colors change, EU units display,
     manual badge appears when applicable, stale styling applies after 60s timeout
   - `analog_bar`: bar fills, pointer moves, zone colors correct, alarm zone highlight works
   - `fill_gauge`: fill level animates, vessel_overlay mode clips to vessel path
   - `sparkline`: line draws from history data
   - `digital_status`: label changes on state change, color changes for normal/abnormal
   - `alarm_indicator`: appears on alarm, flashes when unacknowledged, correct shape per priority
   - `point_name_label`: displays tag hierarchy with correct coloring
4. Open the same graphic in the Designer:
   - Design mode: all display element types show static placeholders
   - Test mode (enable test mode toggle): values animate correctly
5. Open a graphic with a symbol_instance that has display element children — verify the
   children render with correct `parentOffset` signal lines

---

## Phase 4 — Symbol Instance and Group

### Scope

Extract `symbol_instance` and `group` rendering. These are done together because:
- `group` is trivial (6 lines: a `<g>` wrapper that recursively renders children)
- `symbol_instance` is the most complex node type, and it must be done after `display_element`
  (Phase 3) because it renders display element children
- Both require a recursive render callback, which creates a circular dependency that must be
  resolved via a callback parameter

### Read before executing

- `frontend/src/shared/graphics/renderNodeSvg.tsx` (entire file after Phase 3 changes)
- `frontend/src/shared/graphics/SceneRenderer.tsx` lines 1693-1930 (`renderSymbolInstance`)
- `frontend/src/shared/graphics/SceneRenderer.tsx` lines 1936-1947 (`renderGroup`)
- `frontend/src/shared/graphics/SceneRenderer.tsx` lines 1949-2009 (`renderNode` — the dispatch)
- `frontend/src/shared/graphics/SceneRenderer.tsx` lines 444-515 (shape loading useEffect —
  two-phase: base shapes then part shapes)
- `frontend/src/shared/graphics/SceneRenderer.tsx` lines 517-552 (stencil loading useEffect)
- `frontend/src/pages/designer/DesignerCanvas.tsx` lines 1752-1939 (symbol_instance case)
- `frontend/src/pages/designer/DesignerCanvas.tsx` lines 1952-1972 (group case)
- `frontend/src/pages/designer/DesignerCanvas.tsx` lines 1590-1617 (`ComposablePartSvg`)
- `frontend/src/shared/types/graphics.ts` lines 140-200 (`SymbolInstance` interface)
- `frontend/src/shared/types/graphics.ts` lines 430-433 (`Group` interface)
- `frontend/src/shared/types/shapes.ts` lines 67+ (`ShapeSidecar` — geometry, addons,
  compositeAttachments, textZones, vesselInteriorPath, states)

### What to do

#### 4a. Create `SymbolInstanceRenderContext`

```typescript
export interface SymbolInstanceRenderContext extends RenderContext {
  /** Pre-fetched SVG content for the base shape (null if not yet loaded) */
  shapeSvg: string | null;
  /** Shape sidecar metadata (null if not yet loaded) */
  shapeSidecar: ShapeSidecar | null;
  /** Pre-fetched part shape data keyed by part shape ID (derived from addon.file) */
  partShapes: Map<string, { svg: string; sidecar: ShapeSidecar | null }>;
  /** Operational state CSS class (e.g., "io-running", "io-fault", "io-oos") */
  stateClass: string;
  /** State binding point ID for data-point-id attribute */
  statePointId?: string;
  /** Whether this node is selected (designer mode only) */
  isSelected?: boolean;
  /** Whether in designer mode (affects text zone placeholder display) */
  designerMode?: boolean;
  /** State binding point tag value (for text zone default text) */
  stateTag?: string;
  /** Callback to render a child display element (avoids circular dependency) */
  renderChild: (child: DisplayElement, parentOffset?: { x: number; y: number },
    vesselInteriorPath?: string) => React.ReactElement | null;
}
```

#### 4b. Create `renderSymbolInstanceSvg`

Add to `renderNodeSvg.tsx`:

```typescript
export function renderSymbolInstanceSvg(
  node: SymbolInstance,
  ctx: SymbolInstanceRenderContext,
): React.ReactElement;
```

The function should implement the full algorithm from SceneRenderer lines 1693-1930:

1. **SVG content preparation** (lines 1701-1726): If `ctx.shapeSvg` is available, inject
   `width` and `height` attributes into the outer `<svg>` tag using sidecar geometry (or
   parse viewBox as fallback). If no SVG, render a placeholder rect with the shape ID.

2. **Text zone rendering** (lines 1770-1812): Iterate `ctx.shapeSidecar.textZones`, resolve
   overrides from `node.textZoneOverrides`, render `<text>` elements with correct font,
   size, anchor, auto-fit (`textLength`/`lengthAdjust`). In designer mode, show
   `[${zone.id}]` placeholder for empty zones.

3. **Composable part rendering** (lines 1818-1897): For each `node.composableParts`:
   - Look up addon in `ctx.shapeSidecar.addons` by `partId`
   - Derive part shape ID from `addon.file.replace(/\.svg$/, "")`
   - Look up part data in `ctx.partShapes`
   - Compute placement via `compositeAttachments` + `bodyBase` (exact placement) or
     stacking fallback (actuator above, support below)
   - Render stem lines when `attachment.stemFrom` exists
   - Wrap part SVG inner content in `<svg x={px} y={py} width={pw} height={ph} viewBox={pVB}>`
     with the inner SVG content set via `React.createElement` and innerHTML. Note: part SVG
     content comes from server-fetched static files in /shapes/ — same trust level as base
     shapes.

4. **Assembly** (lines 1900-1929): Wrap everything in a `<g>` with transform, opacity,
   data attributes, state class, and click handler. Render base SVG, composable parts, text
   zones, then child display elements via `ctx.renderChild`.

#### 4c. Handle the DB `part_id` vs `partId` inconsistency

SceneRenderer (line 1826) handles both `part.partId` and `part.part_id`:
```typescript
const pid = part.partId ?? (part as unknown as Record<string, string>)["part_id"];
```
The shared function must include this same fallback.

#### 4d. Create `renderGroupSvg`

```typescript
export interface GroupRenderContext extends RenderContext {
  /** Callback to render each child node */
  renderChild: (child: SceneNode) => React.ReactElement | null;
}

export function renderGroupSvg(
  node: Group,
  ctx: GroupRenderContext,
): React.ReactElement;
```

This is simple: render a `<g>` with transform, opacity, data-node-id, then map children
through `ctx.renderChild`.

#### 4e. Update SceneRenderer

Replace `renderSymbolInstance` (lines 1693-1930) with a wrapper that builds context:

```typescript
function renderSymbolInstance(node: SymbolInstance): React.ReactElement {
  const shapeData = shapeMap.get(node.shapeRef.shapeId);
  // ... state binding resolution (existing lines 1729-1767) ...
  const ctx: SymbolInstanceRenderContext = {
    ...makeRenderCtx(node),
    shapeSvg: shapeData?.svg ?? null,
    shapeSidecar: shapeData?.sidecar ?? null,
    partShapes: /* build from shapeMap */,
    stateClass,
    statePointId: statePvKey,
    designerMode,
    stateTag: statePv?.tag,
    renderChild: (child, parentOffset, vesselInteriorPath) =>
      renderDisplayElement(child, parentOffset, vesselInteriorPath),
  };
  return renderSymbolInstanceSvg(node, ctx);
}
```

The state binding resolution logic (UUID detection, tag resolution at lines 1729-1767)
stays in SceneRenderer because it depends on `resolvedTagMap` and `pointValues` state.

Replace `renderGroup` (lines 1936-1947):
```typescript
function renderGroup(node: Group): React.ReactElement {
  const ctx: GroupRenderContext = {
    ...makeRenderCtx(node),
    renderChild: (child) => renderNode(child as SceneNode),
  };
  return renderGroupSvg(node, ctx);
}
```

#### 4f. Update DesignerCanvas

Replace the `symbol_instance` case (lines 1752-1939). The key differences from SceneRenderer:

1. **Shape data source**: DesignerCanvas uses `useLibraryStore.getState().getShape()` instead
   of `shapeMap`. Wire it into the context.

2. **Part shape data**: DesignerCanvas uses `useLibraryStore.getState().getShape(partShapeId)`
   for each part. Build the `partShapes` map from libraryStore.

3. **Association highlight**: DesignerCanvas (lines 1914-1937) applies brightness filter and
   opacity dimming to child display elements based on `uiStore.highlightedPointId`. This
   designer-specific logic should wrap the `renderChild` callback:

   ```typescript
   renderChild: (child, parentOffset, vesselInteriorPath) => {
     const activeHighlight = useUiStore.getState().highlightedPointId;
     let childFilter: string | undefined;
     let childOpacity: number | undefined;
     if (activeHighlight) {
       if (child.binding?.pointId === activeHighlight) {
         childFilter = "brightness(1.3)";
       } else {
         childOpacity = 0.5;
       }
     }
     const el = /* render child via shared function */;
     if (!el) return null;
     return <g key={child.id} style={{ filter: childFilter, opacity: childOpacity }}>{el}</g>;
   }
   ```

4. **No state binding**: DesignerCanvas does not resolve stateBinding point values (no live
   data in designer). Pass `stateClass: ""` and no `statePointId`.

Replace the `group` case (lines 1952-1972):
```typescript
case "group": {
  const grp = node as Group;
  const grpCtx: GroupRenderContext = {
    transform: tx,
    renderChild: (child) => (
      <RenderNode key={child.id} node={child} getShapeSvg={getShapeSvg} selectedIds={selectedIds} />
    ),
  };
  return renderGroupSvg(grp, grpCtx);
}
```

#### 4g. Delete `ComposablePartSvg` from DesignerCanvas

After migration, delete the `ComposablePartSvg` component (lines 1590-1617). The shared
`renderSymbolInstanceSvg` renders parts inline using `React.createElement` with innerHTML
(same as SceneRenderer's approach). Part SVG content comes from server-fetched static files
in /shapes/ — same trust level as base shapes.

### RenderContext additions

Add `SymbolInstanceRenderContext` and `GroupRenderContext` as described above.

### Async loading pattern

Symbol instance rendering depends on async shape data:
- **SceneRenderer**: two-phase `useEffect` at lines 461-515: first fetches base shapes, then
  derives part shape IDs from base sidecars and fetches those. Results stored in `shapeMap`
  state. Render reads synchronously from `shapeMap`.
- **DesignerCanvas**: uses `libraryStore.loadShape()` / `getShape()`. Zustand subscription
  drives re-render when shapes arrive.

The shared `renderSymbolInstanceSvg` is pure — it takes pre-loaded shape data via context.
If a shape isn't loaded yet, `ctx.shapeSvg` will be null and the function renders a
placeholder. The async loading responsibility stays with the caller.

### Hard constraints

- `sceneStore` remains single source of truth — SceneRenderer must not own or mutate node data
- Point value updates bypass React — write directly to SVG DOM via `data-point-id` attributes
- LOD thresholds: React > 3,000 elements; hybrid 1,500-3,000; direct DOM < 1,500
- LOD class on container div, not SVG element
- Exactly 11 SceneNode types — do not add new ones
- `pnpm build` must be clean after this phase

### Verification

1. `cd frontend && pnpm build` — zero errors
2. `cd frontend && pnpm test` — no regressions
3. Open a P&ID graphic in the Console with symbol instances:
   - Base shapes render at correct size and position
   - Composable parts (actuators, supports) render at correct attachment points
   - Stem lines connect actuators to valve bodies
   - Text zones display (designation, tag, etc.)
   - Operational state classes apply (running=green pulse, fault=red, etc.)
   - Child display elements render with live data
4. Open the same graphic in the Designer:
   - Shapes render identically to Console (minus live data)
   - Composable parts render correctly
   - Text zones show placeholders in empty zones
   - Association highlight (hover on point in properties) dims/brightens correct DEs
5. Open a graphic with groups — verify groups render children correctly in both surfaces
6. Add a new symbol via the wizard — verify it appears correctly on the canvas
7. Select, move, resize, rotate symbols — verify no regression in interaction
8. Undo/redo symbol placement — verify no regression

---

## Phase Dependency Summary

```
Phase 1 — Stencil + Widget (low risk, ~2 hours)
    |
Phase 2 — Pipe (medium risk, ~3 hours)
    |
Phase 3 — Display Element (high risk, ~1-2 days)
    |
Phase 4 — Symbol Instance + Group (highest risk, ~1-2 days)
```

Phases 1 and 2 are independent of each other and could theoretically be done in parallel,
but sequential execution is recommended for cleaner git history. Phase 3 must precede Phase 4
because symbol_instance contains nested display elements. Phase 4 completes the extraction.

After all 4 phases, every node type's rendering logic will be shared between DesignerCanvas
and SceneRenderer via `renderNodeSvg.tsx`. The only rendering code remaining in each caller
will be:
- **SceneRenderer**: point value resolution, async shape/stencil loading, live DOM mutation,
  widget HTML overlay, viewport/LOD management
- **DesignerCanvas**: interaction handling (selection, drag, resize, rotate), test mode
  context, association highlight, TextReadoutDE measurement hook, live foreignObject widgets
