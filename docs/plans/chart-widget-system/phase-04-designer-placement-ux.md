# Phase 04 — Designer Palette and Drag-Drop Placement

**Goal:** Replace the hardcoded `WIDGET_TYPES` palette tiles with `ChartDefinition`-driven tiles; rewire the drop event from `io:widget-drop` (with `widgetType` string) to `io:chart-widget-drop` (with `chartType: ChartTypeId`); update `DesignerCanvas.tsx` drop handler accordingly; auto-select and auto-open the config panel after placement.

## Read first (required)

- `/home/io/io-dev/io/docs/plans/chart-widget-system/MASTER.md`
- Phases 00, 01, 02, 03 must be complete.
- `/home/io/io-dev/io/frontend/src/pages/designer/DesignerLeftPalette.tsx` — particularly lines 1685–1900 (`WIDGET_TYPES`, `WidgetTile`, `WidgetsSection`).
- `/home/io/io-dev/io/frontend/src/pages/designer/DesignerCanvas.tsx` — lines 6690–6842 (the existing widget drop handler).
- `/home/io/io-dev/io/frontend/src/shared/components/charts/chart-definitions.ts` — the metadata you'll iterate.
- `/home/io/io-dev/io/frontend/src/shared/components/charts/chart-defaults.ts` — `makeDefaultChartConfig` from Phase 01.

## Context

Today the left palette shows 8 hardcoded widget tiles (Trend, Table, Gauge, KPI Card, Bar Chart, Pie Chart, Alarm List, Muster Point). Each fires a `io:widget-drop` CustomEvent with `{ widgetType: "trend" }` style strings. `DesignerCanvas.tsx` has a giant switch that creates a default `WidgetConfig` per widget type, then builds a `WidgetNode`.

Phase 01 already stubbed both sides to compile against `ChartTypeId`. This phase makes the palette show **all available chart types** (anything in `CHART_DEFINITIONS` with `available !== false` and a context that includes `"designer"`), grouped by `category` (Time-Series, KPI, Status, Content, etc.). The drop event carries a numeric `chartType: ChartTypeId`. The canvas creates a `WidgetNode` with `config: makeDefaultChartConfig(chartType)`.

After placement, the new node is auto-selected, and a CustomEvent is dispatched so the right panel opens its Content tab so the user can configure immediately.

## Changes

### 1. `frontend/src/pages/designer/DesignerLeftPalette.tsx`

**1a.** Remove or repurpose `WIDGET_TYPES` and `WidgetTile`. Replace them with chart-definition-driven equivalents.

Add an import:

```ts
import { CHART_DEFINITIONS } from "../../shared/components/charts/chart-definitions";
import type { ChartTypeId } from "../../shared/components/charts/chart-config-types";
```

**1b.** Build the tile list from `CHART_DEFINITIONS`. Keep only definitions that are available in the designer:

```ts
const WIDGET_CHART_TILES = CHART_DEFINITIONS.filter((d) => {
  if (d.available === false) return false;
  // Default contexts (when omitted) = available everywhere.
  if (d.contexts && !d.contexts.includes("designer")) return false;
  return true;
}).map((d) => ({
  chartType: d.id,
  label: d.name,
  category: d.category,
  // Pick a glyph from category if no explicit icon system; phase 04 uses
  // simple text glyphs. Map by category here to keep it terse.
  icon: ICON_BY_CATEGORY[d.category] ?? "▭",
}));

const ICON_BY_CATEGORY: Record<string, string> = {
  "Time-Series": "∿",
  KPI: "#",
  Gauge: "◎",
  Status: "▦",
  Content: "T",
  Production: "↗",
  Statistical: "σ",
  Distribution: "▮",
  XY: "×",
  Heatmap: "▓",
  Hierarchy: "◰",
  Flow: "→",
};
```

**1c.** Refactor `WidgetTile` (or create `ChartTile`) to take `{ chartType: ChartTypeId, label: string, icon: string, collapsed: boolean }`. Replace the `io:widget-drop` event with `io:chart-widget-drop` carrying `{ chartType, x, y }`:

```ts
function ChartWidgetTile({
  chartType,
  label,
  icon,
  collapsed,
}: {
  chartType: ChartTypeId;
  label: string;
  icon: string;
  collapsed: boolean;
}) {
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      // ... (keep the existing ghost element creation logic) ...
      const onUp = (ev: MouseEvent) => {
        ghost.remove();
        document.removeEventListener("mousemove", onMove, true);
        document.removeEventListener("mouseup", onUp, true);
        document.removeEventListener("keydown", onKeyDown, true);
        document.dispatchEvent(
          new CustomEvent("io:chart-widget-drop", {
            detail: { chartType, x: ev.clientX, y: ev.clientY },
          }),
        );
      };
      // ... rest unchanged ...
    },
    [chartType, label],
  );

  // Preserve handlePlaceAtCenter + handleAddToFavorites with the same event rename.
  // ...
}
```

**1d.** `WidgetsSection` becomes `ChartWidgetsSection`. Group tiles by `category`. Render category headers (collapsible if you like). Show all tiles when expanded; stack only icons when collapsed.

```tsx
function ChartWidgetsSection({ collapsed }: { collapsed: boolean }) {
  const byCategory = new Map<string, typeof WIDGET_CHART_TILES>();
  for (const t of WIDGET_CHART_TILES) {
    if (!byCategory.has(t.category)) byCategory.set(t.category, []);
    byCategory.get(t.category)!.push(t);
  }

  if (collapsed) {
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, padding: 4 }}>
        {WIDGET_CHART_TILES.map((t) => (
          <ChartWidgetTile key={t.chartType} {...t} collapsed />
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, padding: 4 }}>
      {[...byCategory.entries()].map(([cat, tiles]) => (
        <div key={cat}>
          <div style={{
            fontSize: 11,
            fontWeight: 600,
            color: "var(--io-text-muted)",
            textTransform: "uppercase",
            padding: "4px 4px 2px",
          }}>{cat}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {tiles.map((t) => (
              <ChartWidgetTile key={t.chartType} {...t} collapsed={false} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
```

**1e.** Update the call sites where `WidgetsSection` is mounted (around lines 2487–2644 in the original — the layout section that toggles between collapsed and expanded). Replace `<WidgetsSection ...>` with `<ChartWidgetsSection ...>`. The `widgetsOpen`, `setWidgetsOpen`, and `sectionHeights.widgets` state can keep their current names — section title can stay "Widgets" or change to "Charts" / "Widgets & Charts" — pick one and be consistent.

**1f.** Favorites: keep the localStorage-backed favorites list under `favs["widgets"]`, but store `chartType` numbers as strings (so existing JSON parsing keeps working). Old favorites with string widget types like `"trend"` will be ignored harmlessly (they don't match any tile).

### 2. `frontend/src/pages/designer/DesignerCanvas.tsx`

**2a.** Replace the `io:widget-drop` listener (around line 6690 — `useEffect(() => { function onWidgetDrop(e) { ... } document.addEventListener("io:widget-drop", onWidgetDrop); ... })`) with an `io:chart-widget-drop` listener.

```tsx
useEffect(() => {
  function onChartWidgetDrop(e: Event) {
    const ce = e as CustomEvent<{
      chartType: ChartTypeId;
      x: number;
      y: number;
    }>;
    const rect = getRect();
    if (!rect || !docRef.current) return;
    const vp = viewportRef.current;
    const rawX = (ce.detail.x - rect.left - vp.panX) / vp.zoom;
    const rawY = (ce.detail.y - rect.top - vp.panY) / vp.zoom;

    const currentDoc = docRef.current;
    const mode = useSceneStore.getState().designMode;

    // Default sizes by category — chart needs more area than a KPI card.
    const def = CHART_DEFINITIONS.find((d) => d.id === ce.detail.chartType);
    const cat = def?.category ?? "Time-Series";
    let defaultW = 320;
    let defaultH = 200;
    switch (cat) {
      case "KPI":
      case "Gauge":
        defaultW = 160; defaultH = 120; break;
      case "Content":
        if (ce.detail.chartType === 51) { defaultW = 320; defaultH = 48; }   // header
        else if (ce.detail.chartType === 52) { defaultW = 180; defaultH = 80; } // clock
        else if (ce.detail.chartType === 50) { defaultW = 240; defaultH = 120; } // text
        else if (ce.detail.chartType === 54) { defaultW = 480; defaultH = 320; } // iframe
        else if (ce.detail.chartType === 55) { defaultW = 480; defaultH = 320; } // camera
        else { defaultW = 320; defaultH = 200; }
        break;
      case "Status":
        defaultW = 400; defaultH = 240; break;
      default:
        defaultW = 360; defaultH = 220;
    }

    let cx: number;
    let cy: number;
    let gridSpan: { cols: number; rows: number } | undefined;
    if (mode === "dashboard") {
      const COLS = 12;
      const ROW_H =
        (currentDoc.metadata as Record<string, unknown> & { rowHeight?: number })
          .rowHeight ?? 80;
      const colW = currentDoc.canvas.width / COLS;
      const col = Math.max(0, Math.min(COLS - 1, Math.round(rawX / colW)));
      const row = Math.max(0, Math.round(rawY / ROW_H));
      const spanCols = Math.max(1, Math.round(defaultW / colW));
      const spanRows = Math.max(1, Math.round(defaultH / ROW_H));
      cx = col * colW;
      cy = row * ROW_H;
      defaultW = spanCols * colW;
      defaultH = spanRows * ROW_H;
      gridSpan = { cols: spanCols, rows: spanRows };
    } else {
      cx = snap(rawX);
      cy = snap(rawY);
    }

    const config = makeDefaultChartConfig(ce.detail.chartType);
    const node: WidgetNode = {
      id: crypto.randomUUID(),
      type: "widget",
      chartType: ce.detail.chartType,
      name: def?.name ?? `Chart ${ce.detail.chartType}`,
      transform: {
        position: { x: cx, y: cy },
        rotation: 0,
        scale: { x: 1, y: 1 },
        mirror: "none",
      },
      visible: true,
      locked: false,
      opacity: 1,
      width: defaultW,
      height: defaultH,
      ...(gridSpan ? { gridSpan } : {}),
      config,
    };
    executeCmd(new AddNodeCommand(node, null));
    selectedIdsRef.current = new Set([node.id]);
    useUiStore.getState().setSelectedNodes([node.id]);

    // Open the right panel Content tab so the user can configure immediately.
    document.dispatchEvent(
      new CustomEvent("io:designer-open-config", {
        detail: { nodeId: node.id, tab: "content" },
      }),
    );
  }

  document.addEventListener("io:chart-widget-drop", onChartWidgetDrop);
  return () =>
    document.removeEventListener("io:chart-widget-drop", onChartWidgetDrop);
}, [snap]);
```

**2b.** Remove the old `onWidgetDrop` listener and the `WidgetType`/`WidgetConfig` switch block left over from Phase 01. Phase 01 had a TODO comment — this phase deletes it.

**2c.** Imports at the top of the file:

```ts
import { makeDefaultChartConfig } from "../../shared/components/charts/chart-defaults";
import { CHART_DEFINITIONS } from "../../shared/components/charts/chart-definitions";
import type { ChartTypeId } from "../../shared/components/charts/chart-config-types";
```

Drop any leftover imports of the deleted `WidgetType` / `WidgetConfig`.

### 3. `frontend/src/pages/designer/DesignerRightPanel.tsx`

**3a.** Listen for `io:designer-open-config` and switch the right-panel tab to "content" when fired:

```tsx
useEffect(() => {
  function onOpenConfig(e: Event) {
    const ce = e as CustomEvent<{ nodeId: string; tab: string }>;
    if (ce.detail.tab === "content") {
      // setActiveTab is whatever the right panel uses to switch tabs;
      // grep for "activeTab" / "setActiveTab" inside DesignerRightPanel.
      setActiveTab("content");
    }
  }
  document.addEventListener("io:designer-open-config", onOpenConfig);
  return () =>
    document.removeEventListener("io:designer-open-config", onOpenConfig);
}, []);
```

If the right panel auto-shows the Content tab when a `WidgetNode` is selected anyway, this listener is belt-and-suspenders and you can omit it. Verify by behavior.

### 4. Empty-state hint inside the chart wrapper

When `config.points` is empty and the chart's `requiresPoints !== false`, the chart's internal renderer typically shows an empty state ("No points configured"). Verify this happens for newly-placed widgets. If a renderer doesn't show such a state, leave it; it's per-renderer polish. The Designer flow makes the user immediately add points, so the empty state is fleeting.

For content widgets where `requiresPoints === false`, the renderer doesn't need points and shouldn't show the hint. Phase 06a–07c handle their own empty states.

## Gotchas

- **Event name change**: every place that fires `io:widget-drop` must be updated to `io:chart-widget-drop`. Grep:
  ```bash
  grep -rn "io:widget-drop" frontend/src/
  ```
  All matches must be updated. Otherwise old palette tiles silently no-op.
- **Default sizes**: a Trend chart at 200×100 px is unreadable. Use the per-category defaults above. KPI cards stay small.
- **Grid mode** (`mode === "dashboard"`): keep the existing snap-to-12-column logic. Only the per-category default size logic is new.
- **Auto-select**: writing `useUiStore.getState().setSelectedNodes([node.id])` is the standard pattern in this file (already used on line 6837 of the old handler). Keep it.
- **Designer Mode B selection**: do not introduce `useNodeMarquee`/`useNodeClick` for the new widget tiles or drop handler. The existing FSM in `interactionRef` handles selection — auto-select via `setSelectedNodes` is the supported entry point.
- **Favorites collisions**: existing localStorage entries with string widget types ("trend", etc.) won't match any tile after this phase — they're harmless dead entries. Don't bother migrating.
- **`pnpm test` + `pnpm build`** required.

## Acceptance criteria

1. `cd frontend && pnpm exec tsc --noEmit` exits 0.
2. `cd frontend && pnpm build` exits 0.
3. `cd frontend && pnpm test` exits 0.
4. `grep -rn "io:widget-drop" frontend/src/` returns no matches (all converted to `io:chart-widget-drop`).
5. **Manual:** Open Designer Graphic mode. Left palette "Widgets" section shows tiles for every chart type that's `available` and includes `"designer"` in its contexts. Categories are visible.
6. Drag a Trend tile onto canvas — node lands at the drop position, gets auto-selected, right panel opens to Content tab showing the chart config.
7. Configure a couple of points — the chart in the canvas renders with live data within 250ms.
8. Drag a Histogram (chart20) tile — lands smaller (around 360×220 default), right panel opens to its config.
9. Drag a Gauge (chart08) tile — lands at 160×120.
10. In dashboard mode, drop snaps to the 12-column grid as before.
11. Undo (Ctrl+Z) removes the placed widget. Redo restores it.
12. The currently-stubbed chart types (40, 41, 50–55) do **not** appear in the palette (their `available: false` filters them out).

## Phase dependencies

- **Depends on:** Phase 03.
- **Gates:** All 05x and 06x phases (which set `available: true` on their chart types) and 07c.
