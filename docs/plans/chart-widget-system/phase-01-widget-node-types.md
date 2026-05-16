# Phase 01 — WidgetNode Type Unification

**Goal:** Replace the legacy `WidgetType` enum and 8 `*WidgetConfig` types with a single `ChartConfig` payload on `WidgetNode`, deleting the parallel widget type system.

## Read first (required)

- `/home/io/io-dev/io/docs/plans/chart-widget-system/MASTER.md`
- `/home/io/io-dev/io/docs/plans/chart-widget-system/phase-00-type-contract.md` (must already be implemented)
- `/home/io/io-dev/io/frontend/src/shared/types/graphics.ts` — lines 595–740 contain `WidgetType`, all 8 `*WidgetConfig` types, the `WidgetConfig` union, and `WidgetNode`.
- `/home/io/io-dev/io/frontend/src/shared/components/charts/chart-config-types.ts` — `ChartConfig` and `ChartTypeId` definitions.
- `/home/io/io-dev/io/frontend/src/shared/graphics/commands.ts` — `ChangeWidgetConfigCommand` is at line ~1547. Note the `unknown` type on `newConfig`/`prevConfig` — keep that or tighten to `ChartConfig`.

## Context

Phase 00 reserved the new chart type IDs. Now we collapse the widget system: `WidgetNode.config` becomes `ChartConfig` (the same type the chart system uses), and `WidgetNode.widgetType` is renamed to `chartType: ChartTypeId` (denormalized from `config.chartType`).

The 8 existing `*WidgetConfig` types (`TrendWidgetConfig`, `TableWidgetConfig`, `GaugeWidgetConfig`, `KpiCardWidgetConfig`, `BarChartWidgetConfig`, `PieChartWidgetConfig`, `AlarmListWidgetConfig`, `MusterPointWidgetConfig`) are **deleted outright**. They were stubs — never rendered as anything but placeholder text. Saved graphics with old widget data simply show a placeholder until the user re-edits them. No data migration is required.

Dashboard widgets (`pages/dashboards/widgets/`) are a separate, older subsystem that uses `WidgetType` strings as a tag. Don't refactor them — if any of them imports `WidgetType` from `graphics.ts`, create a local alias type in `pages/dashboards/legacy-widget-types.ts` so the dashboard module keeps compiling. The Dashboard module is being overhauled later under a different plan; we are not touching its internal types here.

## Changes

### 1. `frontend/src/shared/types/graphics.ts`

**1a.** Add an import at the top of the file (near the other type imports):

```ts
import type {
  ChartConfig,
  ChartTypeId,
} from "../components/charts/chart-config-types";
```

If a re-export pattern is preferred, do it; just don't introduce a circular import (charts → graphics is fine, but graphics → charts must not loop back).

**1b.** **Delete** the following from `graphics.ts` (lines roughly 599–722):

- `WidgetType` type alias.
- `TrendSeries` interface (was used only by `TrendWidgetConfig`; verify no other consumer with grep before deletion).
- `TrendWidgetConfig`
- `TableColumn` interface (used only by `TableWidgetConfig`; verify with grep).
- `TableWidgetConfig`
- `GaugeWidgetConfig`
- `KpiCardWidgetConfig`
- `BarChartWidgetConfig`
- `PieChartWidgetConfig`
- `AlarmListWidgetConfig`
- `MusterPointWidgetConfig`
- The `WidgetConfig` union type.

If `TrendSeries` or `TableColumn` is also used outside widget configs, leave it and just remove the widget config types.

**1c.** Replace the existing `WidgetNode` interface with:

```ts
export interface WidgetNode extends SceneNodeBase {
  type: "widget";
  /** Denormalized from config.chartType — kept on the node for cheap dispatch in the renderer. */
  chartType: ChartTypeId;
  width: number;
  height: number;
  /** Universal chart config — same type used by ChartRenderer everywhere. */
  config: ChartConfig;
  gridSpan?: { cols: number; rows: number };
  phonePriority?: number;
  /** ID of the dashboard this widget is bound to; undefined when standalone */
  dashboardSourceId?: string;
}
```

**1d.** The `SceneNode` union should still include `WidgetNode` — leave that line alone.

### 2. Create `frontend/src/shared/components/charts/chart-defaults.ts`

New file:

```ts
// ---------------------------------------------------------------------------
// chart-defaults.ts
// makeDefaultChartConfig(id) — returns a sensible default ChartConfig for a
// given chart type. Used when placing a new widget in the designer or when
// switching chart types in the config panel.
// ---------------------------------------------------------------------------

import type { ChartConfig, ChartTypeId } from "./chart-config-types";

export function makeDefaultChartConfig(id: ChartTypeId): ChartConfig {
  const base: ChartConfig = {
    chartType: id,
    points: [],
    durationMinutes: 60,
    legend: { show: true, mode: "fixed", position: "top" },
    scaling: { type: "auto" },
    xAxisLabels: "full",
    yAxisLabels: "full",
  };

  // Per-type tweaks
  switch (id) {
    case 1: // Trend
    case 2:
    case 3:
    case 4: // Step
    case 16: // Batch Comparison
    case 22: // Stacked Area
      return { ...base, interpolation: id === 4 ? "step" : "linear" };

    case 7: // KPI Card
    case 8: // Gauge
    case 9: // Sparkline
    case 10: // Analog Bar
    case 11: // Fill Gauge
    case 17: // Heatmap value
    case 23: // Bullet
      return { ...base, legend: { show: false, mode: "fixed", position: "top" } };

    case 15: // Data Table
      return { ...base, legend: { show: false, mode: "fixed", position: "top" } };

    case 20: // Histogram
      return { ...base, extras: { displayMode: "histogram", binCount: 20 } };

    case 40: // Accumulated Run
      return { ...base, extras: { resetPeriod: "shift" } };

    case 41: // Status Map
      return { ...base, extras: { cols: 4, colorRules: [] } };

    case 50: // Text / Markdown
      return { ...base, extras: { text: "Edit this text", format: "plain", align: "left" } };

    case 51: // Header / Divider
      return { ...base, extras: { text: "Section", level: 2, align: "left" } };

    case 52: // Clock / Elapsed
      return { ...base, extras: { mode: "clock", format: "HH:mm:ss" } };

    case 53: // Logs Viewer
      return { ...base, extras: { source: "alarms", maxRows: 25, autoScroll: true } };

    case 54: // IFrame
      return { ...base, extras: { url: "" } };

    case 55: // Camera Stream
      return { ...base, extras: { streamId: "" } };

    default:
      return base;
  }
}
```

### 3. Find and fix every consumer of the deleted types

Run these greps and fix every match. The compile must end clean.

```bash
cd /home/io/io-dev/io/frontend
grep -rn "WidgetType\|WidgetConfig\|TrendWidgetConfig\|TableWidgetConfig\|GaugeWidgetConfig\|KpiCardWidgetConfig\|BarChartWidgetConfig\|PieChartWidgetConfig\|AlarmListWidgetConfig\|MusterPointWidgetConfig" src/
```

Expected hits to fix:

- **`src/pages/designer/DesignerCanvas.tsx`** — imports `WidgetType` and `WidgetConfig`, has a giant `switch (wt) { case "trend": ... }` block creating default configs around line 6740. Phase 04 will rewrite this drop handler entirely. **For this phase, do the minimum:** delete the imports of `WidgetType`/`WidgetConfig`, change the existing `widgetType` property writes to `chartType` (use `ChartTypeId` 1 as a temporary placeholder), and replace the default-config switch with a single call to `makeDefaultChartConfig(1)`. The drop handler still works for placement; it'll be properly rewritten in phase 04. Leave a `// TODO(phase-04): rewrite for chart-widget-drop event` comment.

- **`src/pages/designer/DesignerRightPanel.tsx`** — imports `WidgetType` and `WidgetConfig`. Has `WIDGET_TYPE_OPTIONS` at line ~2932 and `WidgetContentTab` at ~2943 reading `node.widgetType` and `node.config`. Phase 03 will rewrite this entirely. **For this phase, do the minimum:** delete the imports, change `node.widgetType` reads to `node.chartType`, and stub `WidgetContentTab` to render a placeholder div like `<div>Configure in Phase 03</div>`. Keep the `ChangeWidgetConfigCommand` import — it stays.

- **`src/shared/graphics/renderNodeSvg.tsx`** — imports `WidgetType`, has `WIDGET_ICONS: Record<string, string>` keyed by `WidgetType` values, and `renderWidgetPlaceholderSvg` reads `node.widgetType`. Change:
  - Drop the `WidgetType` import.
  - Change `WIDGET_ICONS` to be keyed by `ChartTypeId` (number). For now, use `{ 1: "∿", 15: "⊞", 8: "◎", 7: "#", 5: "▊", 6: "◔" }` plus a default entry; full mapping comes in phase 04.
  - Change `node.widgetType` reads to `node.chartType`.
  - The placeholder text below the icon was `widgetType.replace(/_/g, " ")` — change to `String(node.chartType)` for now (phase 02 replaces this whole renderer with a transparent rect).

- **`src/shared/graphics/SceneRenderer.tsx`** — line 1221 reads `node.widgetType` to render the placeholder text. Change to `node.chartType` (phase 02 will replace this whole block with a `<ChartRenderer>` mount).

- **`src/shared/graphics/commands.ts`** — `ChangeWidgetConfigCommand` uses `unknown` types for `newConfig`/`prevConfig`. Tighten to `ChartConfig`:
  ```ts
  constructor(
    private nodeId: NodeId,
    private newConfig: ChartConfig,
    private prevConfig: ChartConfig,
  ) {}
  ```
  Add `import type { ChartConfig } from "../components/charts/chart-config-types";` at the top.

- **`src/pages/dashboards/widgets/`** — if any widget file imports `WidgetType` from `graphics.ts`, that's the dashboard module which is out of scope for this plan. Create `src/pages/dashboards/legacy-widget-types.ts`:
  ```ts
  // Local alias preserved for the legacy dashboard widget system, which is
  // being overhauled in a separate plan. Do not export this from a barrel.
  export type LegacyDashboardWidgetType =
    | "trend"
    | "table"
    | "gauge"
    | "kpi_card"
    | "bar_chart"
    | "pie_chart"
    | "alarm_list"
    | "muster_point";
  ```
  Then in each dashboard widget that imported `WidgetType`, swap to `LegacyDashboardWidgetType` from this local file. This isolates the dashboard module's churn from the chart-widget plan.

- **`src/pages/dashboards/dashboardConverter.ts`** — likely uses `WidgetType` and `WidgetConfig`. Same treatment: move types into `legacy-widget-types.ts` and re-import. The dashboard system has its own widget shape; we're severing the link to the graphics `WidgetNode`.

- **Any other file** that grep finds — apply the same logic: if it's a dashboard-internal file, give it a local alias; if it's a designer/graphics file, switch to `ChartTypeId`/`ChartConfig`.

### 4. Update barrel exports if any

If `frontend/src/shared/types/index.ts` (or similar) re-exports `WidgetType`, `WidgetConfig`, etc., remove those re-exports. Re-export `ChartTypeId` and `ChartConfig` from charts if convenient, but it's not required — most consumers should import directly from charts.

## Gotchas

- **Old graphics in the database** still have widgets with the old `widgetType: "trend"` / nested `config` shape. After this phase, deserializing them yields `chartType: undefined` and `config: <old shape>`. The chart renderer in `ChartRenderer.tsx` returns `<UnknownChart>` for missing chart types — that's the placeholder. Don't write a migration. The user re-edits the widget in designer; phase 04 onward handles fresh placement cleanly.
- **Don't accidentally break the dashboard module.** It still uses string `widgetType` values; keep the alias in `legacy-widget-types.ts` so its code keeps building.
- **Designer uses Mode B selection** (interactionRef FSM in `DesignerCanvas.tsx`). Do not introduce `useNodeMarquee`/`useNodeClick` for widget paths in this phase.
- **`tsc --noEmit` is necessary but not sufficient.** Also run `pnpm build` and `pnpm test`. Compile alone misses runtime/import bugs.
- **Do not delete `ChangeWidgetConfigCommand`.** It stays as the undo unit for config edits — phase 03 wires the right panel to it.
- **`graphicScope` is `doc.metadata.graphicScope`**, not `doc.scope`. Don't introduce a new bug while editing.

## Acceptance criteria

1. `cd frontend && pnpm exec tsc --noEmit` exits 0.
2. `cd frontend && pnpm build` exits 0.
3. `cd frontend && pnpm test` exits 0.
4. `grep -rn "WidgetType\|TrendWidgetConfig\|TableWidgetConfig\|GaugeWidgetConfig\|KpiCardWidgetConfig\|BarChartWidgetConfig\|PieChartWidgetConfig\|AlarmListWidgetConfig\|MusterPointWidgetConfig\|export type WidgetConfig" frontend/src/` returns **only** matches inside `frontend/src/pages/dashboards/legacy-widget-types.ts` or files that import from it.
5. `grep -n "chartType: ChartTypeId" frontend/src/shared/types/graphics.ts` matches.
6. `frontend/src/shared/components/charts/chart-defaults.ts` exists and exports `makeDefaultChartConfig`.
7. Open Designer in dev mode (`./dev.sh start`, `cd frontend && pnpm dev`); place a "trend" widget — it shows the temporary placeholder. No console errors. Save and reload; placeholder still renders. (Phase 02 wires the real chart.)

## Phase dependencies

- **Depends on:** Phase 00.
- **Gates:** Phase 02 (and everything downstream).
