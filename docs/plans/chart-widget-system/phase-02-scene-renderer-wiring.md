# Phase 02 — SceneRenderer Chart Mounting

**Goal:** Replace the placeholder widget rendering in `SceneRenderer.tsx` with a real `<ChartRenderer>` mount in the HTML overlay layer; extend the point extractor to walk widget point bindings; thread the correct `bufferKey`.

## Read first (required)

- `/home/io/io-dev/io/docs/plans/chart-widget-system/MASTER.md`
- Phase 00 and Phase 01 must be complete.
- `/home/io/io-dev/io/frontend/src/shared/graphics/SceneRenderer.tsx` — focus on lines 1050–1230 (widget collection + HTML overlay rendering). The current placeholder block lives at lines ~1197–1224.
- `/home/io/io-dev/io/frontend/src/shared/components/charts/ChartRenderer.tsx` — read the full file. This is what you mount.
- `/home/io/io-dev/io/frontend/src/pages/console/panes/GraphicPane.tsx` — lines 100–180 contain `extractPointIds` (and other extract* helpers). You extend this.
- `/home/io/io-dev/io/frontend/src/shared/graphics/renderNodeSvg.tsx` — `renderWidgetPlaceholderSvg` is around line 1098. We change it to a transparent rect.
- `/home/io/io-dev/io/frontend/src/shared/components/charts/chart-config-types.ts` — to confirm `CONTENT_WIDGET_IDS` is exported (Phase 00).

## Context

After Phase 01, every `WidgetNode` carries a `ChartConfig`. SceneRenderer already creates an HTML overlay div (the layer with `pointerEvents: none, overflow: hidden` at lines ~1187–1196) and walks the scene to collect widget nodes (lines ~1074–1083). The placeholder block at ~1197–1224 just renders the widget's name. We replace it with a real `<ChartRenderer>` mount.

This is **not** SVG `foreignObject` — charts render in a regular HTML overlay div positioned over the SVG. The SVG keeps a transparent `<rect>` at the widget's position so the designer's interactionRef FSM can hit-test, draw selection rings, and run alignment guides.

`pointer-events` discipline:
- **Designer mode** (`designerMode === true`): wrapper has `pointer-events: none` so events pass through to the SVG hit rect underneath. Otherwise selection breaks.
- **Viewer mode** (Console / Process / Reports / standalone): wrapper has `pointer-events: auto` so charts are interactive (highlight, context menu, click-through to detail).

`bufferKey` must be `graphic:${graphicId}:widget:${node.id}`. Without `graphicId` in the key, two graphics open in tabs with the same widget node id (impossible normally, but possible during copy-paste across docs) would share a `useTimeSeriesBuffer` ring, breaking each other's data. Phase 08 verifies this; we set the format here.

The point extractor in `GraphicPane.tsx` already walks `node.binding`, `node.stateBinding`, `node.series`, `node.slices`, and `node.children`. It does **not** walk `WidgetNode.config.points[].pointId`. We add that — but skip widgets whose `chartType` is in `CONTENT_WIDGET_IDS` (no points to subscribe to).

## Changes

### 1. `frontend/src/shared/graphics/SceneRenderer.tsx`

**1a.** Add an import near the top:

```ts
import ChartRenderer from "../components/charts/ChartRenderer";
import { CONTENT_WIDGET_IDS } from "../components/charts/chart-config-types";
```

**1b.** Determine how the component receives `graphicId` and a `viewerMode` flag.

The `SceneRenderer` component is called from `GraphicPane.tsx` (viewer) and `DesignerCanvas.tsx` (designer). Look at the existing props (search for `interface SceneRendererProps` or the `forwardRef` declaration). Add two new optional props:

```ts
interface SceneRendererProps {
  // ... existing props ...
  /** ID of the graphic document — used to scope widget chart buffers. Required when widgets are present. */
  graphicId?: string;
  /** When true, widget HTML overlays receive pointer events. Default: false (designer mode). */
  viewerMode?: boolean;
}
```

If `designerMode` already exists and is the inverse of viewerMode, you can derive: `const interactiveWidgets = !designerMode;`. Use whichever fits the existing naming.

**1c.** Replace the widget overlay block (currently lines ~1197–1224, the `widgetNodes.map(...)` returning a placeholder div). Replace with:

```tsx
{widgetNodes.map((node) => {
  const screenPos = canvasToScreen(node.transform.position, vp);
  const w = node.width * vp.zoom;
  const h = node.height * vp.zoom;
  const bufferKey = `graphic:${graphicId ?? "unknown"}:widget:${node.id}`;
  const interactive = !designerMode; // viewer mode = interactive

  return (
    <div
      key={node.id}
      data-node-id={node.id}
      data-widget-chart-type={node.chartType}
      style={{
        position: "absolute",
        left: screenPos.x,
        top: screenPos.y,
        width: w,
        height: h,
        pointerEvents: interactive ? "auto" : "none",
        background: "var(--io-surface-elevated)",
        border: "1px solid var(--io-border)",
        borderRadius: 4,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <ChartRenderer config={node.config} bufferKey={bufferKey} />
    </div>
  );
})}
```

If your `SceneRenderer` already has a `designerMode` prop in scope, use it. If it has a different name (e.g. `editable`), use that. The point is `pointerEvents: "auto"` in viewer, `"none"` in designer.

**1d.** Add a transparent SVG `<rect>` per widget inside the SVG layer for hit-testing/selection. Find the `{children.map((node) => renderNode(node))}` block (~line 1176). The `renderNode` function dispatches by node type; for `widget` it currently calls `WidgetRenderer` which calls `renderWidgetPlaceholderSvg`. We change `renderWidgetPlaceholderSvg` itself in step 2 to render only a transparent rect — no need to special-case here.

### 2. `frontend/src/shared/graphics/renderNodeSvg.tsx`

**2a.** Replace the body of `renderWidgetPlaceholderSvg`. It currently renders an icon + label. Change to a transparent rect with `data-node-id` and `data-widget="true"` attributes for hit-testing:

```tsx
export function renderWidgetPlaceholderSvg(
  node: WidgetNode,
  options: { transform: string },
): JSX.Element {
  const { width, height, id } = node;
  return (
    <g key={`widget-${id}`} transform={options.transform}>
      <rect
        x={0}
        y={0}
        width={width}
        height={height}
        fill="transparent"
        stroke="none"
        data-node-id={id}
        data-widget="true"
        data-chart-type={node.chartType}
        style={{ pointerEvents: "all" }}
      />
    </g>
  );
}
```

The transparent rect catches pointer events for designer hit-testing. The HTML overlay sits above the SVG visually, but in designer mode the overlay has `pointerEvents: none` so events fall through to this rect.

**2b.** Delete the `WIDGET_ICONS` constant if it's no longer referenced anywhere (grep first to confirm). It was the icon dictionary for the old placeholder.

### 3. `frontend/src/pages/console/panes/GraphicPane.tsx`

**3a.** Add an import at the top:

```ts
import { CONTENT_WIDGET_IDS } from "../../../shared/components/charts/chart-config-types";
```

**3b.** Extend `extractPointIds` (function around line 110). Add a `widget` branch in the `walk` function:

```ts
if (n.type === "widget") {
  const wn = n as import("../../../shared/types/graphics").WidgetNode;
  if (!CONTENT_WIDGET_IDS.has(wn.chartType)) {
    for (const slot of wn.config.points ?? []) {
      if (slot.pointId) ids.add(slot.pointId);
    }
  }
}
```

Do this **inside** the existing `walk` function, in the same style as the other branches.

**3c.** If `extractTagBindings` and `extractSparklineBindings` walk the same tree and might encounter widget nodes, add early-return guards (`if (n.type === "widget") return;`) to those, since widgets don't expose `binding`, `pointTag`, or `sparkline` patterns. Confirm by reading them — they may already be type-narrowed enough.

### 4. `frontend/src/pages/console/panes/GraphicPane.tsx` and `DesignerCanvas.tsx` — pass `graphicId` and `viewerMode`

**4a.** In `GraphicPane.tsx`, find where `<SceneRenderer ...>` is mounted. Pass:

```tsx
<SceneRenderer
  /* existing props */
  graphicId={graphicId}
  viewerMode={true}
/>
```

The `graphicId` is already a prop of `GraphicPane` (see line 104).

**4b.** In `DesignerCanvas.tsx`, find where `<SceneRenderer ...>` is mounted. Pass:

```tsx
<SceneRenderer
  /* existing props */
  graphicId={docRef.current?.id}
  viewerMode={false}
/>
```

(Use whatever variable holds the open document's id; search for `doc.id` or `docId` near the SceneRenderer mount.)

### 5. Subscription dedup

`useTimeSeriesBuffer` and `useWebSocket` already refcount subscriptions internally via `wsManager`. No change needed in those hooks. But verify by grep: `grep -n "wsManager\|useWsWorker" frontend/src/shared/components/charts/hooks/useTimeSeriesBuffer.ts`. If two charts subscribe to the same point, the wsManager opens one server-side subscription and fans out. Phase 08 verifies; just confirm no extra plumbing is needed here.

## Gotchas

- **`pointer-events`** is the trickiest piece. If you forget the wrapper-level `pointer-events: none` in designer mode, dragging on top of a widget breaks selection. If you set it to `none` in viewer mode, the chart is dead (no hover, no context menu). Test both modes before declaring done.
- **z-ordering** — the HTML overlay is `position: absolute, inset: 0` on top of the SVG within the same `io-canvas-container`. As long as the overlay div is rendered after the SVG in the JSX (it currently is — the SVG block ends ~line 1185 and the overlay starts ~line 1187), z-order is correct.
- **Chart bounding box** — the wrapper div uses `screenPos = canvasToScreen(...)` which already accounts for `vp.panX`, `vp.panY`, `vp.zoom`. Don't recompute. When the user pans/zooms, the chart wrapper re-renders with new coords. This is React state, so it updates automatically when `vp` changes — verify by panning in designer.
- **Rotation** is **not** supported on widget nodes for this phase. The HTML overlay does not apply `node.transform.rotation`. If a widget has a non-zero rotation, the SVG hit-rect rotates but the chart overlay stays axis-aligned. That's OK for now; widgets don't support rotation in the UI either. Don't add `transform: rotate(...)` to the wrapper — it would invalidate the bounding box and confuse the chart's internal layout (uPlot/ECharts measure the container).
- **`bufferKey` collisions** — make sure you use `graphic:${graphicId}:widget:${node.id}`, exactly. Different format = different module-scope buffer (see `frontend/src/shared/components/charts/hooks/useTimeSeriesBuffer.ts` line 26 `_globalBuffers`).
- **react-grid-layout transform context** — graphics are not rendered inside react-grid-layout when in designer; in console they may be inside a pane that is. The HTML overlay sits inside `io-canvas-container` which is inside the pane. Don't put `position: fixed` on anything inside this overlay (use `createPortal(el, document.body)` if you need it for tooltips later).
- **Designer Mode B selection** (interactionRef FSM) — relies on `data-node-id` attributes on SVG elements. The transparent rect carries `data-node-id={id}`. Don't forget that attribute or designer click-selection breaks for widgets.
- **`pnpm test` + `pnpm build`** — compile alone is not enough.

## Acceptance criteria

1. `cd frontend && pnpm exec tsc --noEmit` exits 0.
2. `cd frontend && pnpm build` exits 0.
3. `cd frontend && pnpm test` exits 0.
4. **Manual viewer test:** Open a graphic in Console that contains a widget with at least one bound point. The chart renders with live data — values update via WebSocket. Hovering shows tooltips. Right-click opens the chart context menu.
5. **Manual designer test:** Open the same graphic in Designer. The chart shows in the HTML overlay. Click on the chart — the widget is selected (selection ring appears). Drag the chart — the widget moves. Pan and zoom — the chart wrapper tracks correctly.
6. **Buffer key:** Open browser DevTools, set a breakpoint or `console.log` in `useTimeSeriesBuffer` and confirm the bufferKey for a widget is `graphic:<uuid>:widget:<uuid>`.
7. Save the graphic, close it, reopen — chart still renders correctly.
8. Empty / unconfigured widget: place a chart-type widget with no points bound — it shows the chart's own empty state (e.g. chart01 may show "No points configured" or just an empty axis). It does **not** crash. The Error Boundary in `ChartRenderer.tsx` catches any thrower.

## Phase dependencies

- **Depends on:** Phase 01.
- **Gates:** Phase 03 (config panel needs widget rendering live so changes show up).
