# Phase 05e — New Chart: Status Map / Fleet Status Grid (chart41)

**Goal:** Implement chart41 — a 2D CSS grid where each cell represents an equipment item, colored by its current point value mapped through user-defined color rules.

## Read first (required)

- `/home/io/io-dev/io/docs/plans/chart-widget-system/MASTER.md`
- Phase 04 must be complete.
- `/home/io/io-dev/io/frontend/src/shared/components/charts/chart-config-types.ts` — confirm `CHART_SLOTS[41]` (single multi slot `item`, max 64) is in place from Phase 00.
- `/home/io/io-dev/io/frontend/src/shared/components/charts/chart-definitions.ts` — chart41 stub.
- `/home/io/io-dev/io/frontend/src/shared/hooks/useWebSocket.ts` — `useWebSocket(pointIds)` returns the latest `values` map.
- `/home/io/io-dev/io/frontend/src/shared/graphics/SceneRenderer.tsx` — review the direct-DOM-mutation pattern (search for `applyPointValue`). Status Map uses a similar pattern for live updates without React re-renders, but at the chart level not the scene level.

## Context

Status Map shows up to 64 equipment items in a grid (default 4 columns, configurable). Each cell shows a label and is colored according to the current point value mapped through `extras.colorRules`. Example: pumps can be green when running, gray when stopped, red when faulted, yellow when in alarm.

Live updates: when a point's value changes, only the cell's background color and (optionally) its label needs to update. We use direct DOM mutation via `data-point-id` attributes on each cell to avoid re-rendering the React tree on every WebSocket tick. This matches the pattern documented in `/home/io/io-dev/io/frontend/src/shared/graphics/CLAUDE.md` (real-time updates bypass React).

For chart41 specifically — since it's standalone (not nested in `applyPointValue` from SceneRenderer) — we set up a small subscription via `wsManager.subscribe([pointIds...], handler)` inside a `useEffect`, where `handler` reads the cell DOM by `data-point-id` and updates `style.background`. React renders the cells once on mount and on layout changes; values are pushed in via direct DOM mutation.

## Changes

### 1. Create `frontend/src/shared/components/charts/renderers/chart41-status-map.tsx`

```tsx
// ---------------------------------------------------------------------------
// Chart 41 — Status Map / Fleet Status Grid
// CSS-grid layout of equipment items colored by current value via configurable
// color rules. Live updates bypass React via direct DOM mutation by data-point-id.
// ---------------------------------------------------------------------------

import { useEffect, useRef, useMemo } from "react";
import { wsManager } from "../../../hooks/useWebSocket";
import { useQueries } from "@tanstack/react-query";
import { pointsApi } from "../../../../api/points";
import {
  type ChartConfig,
  type ChartPointSlot,
  makeSlotLabeler,
} from "../chart-config-types";

interface RendererProps {
  config: ChartConfig;
  bufferKey: string;
}

export interface ColorRule {
  /** Lower bound (inclusive). Use -Infinity for "everything below max". */
  min: number;
  /** Upper bound (exclusive). Use Infinity for "everything above min". */
  max: number;
  color: string;
  label?: string;
}

function ruleColor(rules: ColorRule[], value: number | null | undefined): {
  color: string;
  label?: string;
} {
  if (value == null || !Number.isFinite(value)) {
    return { color: "var(--io-surface-muted, #2A2A2E)", label: "—" };
  }
  for (const r of rules) {
    if (value >= r.min && value < r.max) {
      return { color: r.color, label: r.label };
    }
  }
  return { color: "var(--io-surface-muted, #2A2A2E)" };
}

export default function Chart41StatusMap({ config }: RendererProps) {
  const slotLabel = makeSlotLabeler(config);
  const items: ChartPointSlot[] = useMemo(
    () => config.points.filter((p) => p.role === "item"),
    [config.points],
  );

  const cols = (config.extras?.cols as number | undefined) ?? Math.max(1, Math.ceil(Math.sqrt(items.length)));
  const rules: ColorRule[] = (config.extras?.colorRules as ColorRule[] | undefined) ?? [];

  // Fetch metadata for tooltip / current value labels
  const metaQueries = useQueries({
    queries: items.map((s) => ({
      queryKey: ["point-meta", s.pointId],
      queryFn: () => pointsApi.getMeta(s.pointId),
      staleTime: 60_000,
    })),
  });

  const containerRef = useRef<HTMLDivElement>(null);

  // Live updates via direct DOM mutation
  useEffect(() => {
    if (items.length === 0) return;
    const ids = items.map((s) => s.pointId);

    const handler = (pv: { pointId: string; value: number; quality: string }) => {
      const cell = containerRef.current?.querySelector<HTMLElement>(
        `[data-point-id="${CSS.escape(pv.pointId)}"]`,
      );
      if (!cell) return;
      const { color, label } = ruleColor(rules, pv.value);
      cell.style.backgroundColor = color;
      const valueEl = cell.querySelector<HTMLElement>("[data-role='value']");
      if (valueEl) {
        valueEl.textContent = label ?? String(pv.value);
      }
      // Quality fade: bad/comm_fail get reduced opacity
      cell.style.opacity =
        pv.quality === "bad" || pv.quality === "comm_fail" ? "0.5" : "1";
    };

    const unsub = wsManager.subscribe(ids, handler);
    return unsub;
  }, [items, rules]);

  // Mark ready for export pipeline once first DOM mutation has occurred.
  // For initial paint use a microtask.
  useEffect(() => {
    queueMicrotask(() => {
      containerRef.current?.setAttribute("data-chart-ready", "true");
    });
  }, []);

  if (items.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--io-text-muted)",
          fontSize: 12,
        }}
      >
        Add equipment items
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: 4,
        padding: 4,
        overflow: "auto",
      }}
    >
      {items.map((s, i) => {
        const meta = metaQueries[i]?.data;
        const tagname = meta && "success" in meta && meta.success ? meta.data.name : s.tagname ?? s.pointId;
        return (
          <div
            key={s.slotId}
            data-point-id={s.pointId}
            title={tagname}
            style={{
              backgroundColor: "var(--io-surface-muted, #2A2A2E)",
              borderRadius: 4,
              padding: 6,
              fontSize: 11,
              color: "#fff",
              display: "flex",
              flexDirection: "column",
              gap: 2,
              minHeight: 48,
            }}
          >
            <div style={{ fontWeight: 600 }}>{slotLabel(s)}</div>
            <div data-role="value" style={{ fontSize: 10, opacity: 0.85 }}>—</div>
          </div>
        );
      })}
    </div>
  );
}
```

### 2. `frontend/src/shared/components/charts/ChartRenderer.tsx`

Uncomment the chart41 entry:

```ts
41: lazy(() => import("./renderers/chart41-status-map")),
```

### 3. `frontend/src/shared/components/charts/chart-definitions.ts`

Set chart41's `available: true` and refine the description/benefits text:

```ts
{
  id: 41,
  name: "Status Map",
  category: "Status",
  tier: "mid",
  library: "Custom",
  realTime: true,
  acceptedPointTypes: ["any"],
  description:
    "2D grid of equipment items colored by current state. Each cell maps a point's current value to a color rule. Live updates bypass React via direct DOM mutation for fleet-scale data.",
  benefits: [
    "See dozens of asset states in one view",
    "Configurable color rules for any state model",
    "Works with discrete or analog values",
  ],
  downsides: ["Loses temporal context — only current state"],
  available: true,
},
```

### 4. `frontend/src/shared/components/charts/ChartOptionsForm.tsx`

Add chart41 options — column count and color rules editor:

```tsx
if (config.chartType === 41) {
  const cols = (config.extras?.cols as number | undefined) ?? 4;
  const rules = (config.extras?.colorRules as ColorRule[] | undefined) ?? [];

  return (
    <div>
      <Field label="Columns">
        <NumberInput
          value={cols}
          min={1}
          max={16}
          onChange={(v) => onChange({ ...config, extras: { ...config.extras, cols: v } })}
        />
      </Field>

      <Field label="Color Rules">
        <ColorRuleEditor
          rules={rules}
          onChange={(next) =>
            onChange({ ...config, extras: { ...config.extras, colorRules: next } })
          }
        />
      </Field>
    </div>
  );
}
```

Implement `ColorRuleEditor` as a small inline component within `ChartOptionsForm.tsx` (or as a sibling file `ColorRuleEditor.tsx`):

- Renders one row per rule: `[min] [max] [color picker] [label] [delete]`.
- "+ Add rule" button appends `{ min: 0, max: 1, color: "#10B981", label: "" }`.
- Reorder via drag-handles (optional for phase 05e; skip if it's a heavy lift).

For the color picker, reuse whichever component the rest of the codebase uses (search `<input type="color">` or a Radix/Headless equivalent).

`ColorRule` type lives in chart41-status-map.tsx — re-export it from there or duplicate the type locally in ChartOptionsForm to avoid an import cycle.

## Gotchas

- **`wsManager.subscribe` API**: confirm the actual function signature with `grep -n "subscribe" frontend/src/shared/hooks/useWsWorker.ts`. The handler signature must match what wsManager dispatches. If it's `subscribe(ids, callback)` returning an unsubscribe function, the code above is correct. If it's different, adapt.
- **CSS.escape** for the data-point-id selector — pointIds are UUIDs which don't strictly need escaping, but defensive coding (some legacy pointIds may be tag strings).
- **Initial paint shows "—"** until first WS tick. That's expected. The `useWebSocket(pointIds)` flag already-subscribed-cached values may be used to get the initial value if available; reading `wsManager.getCurrent(id)` (if such a method exists) on mount lets you pre-populate. Optional polish.
- **Direct DOM mutation must not break under React StrictMode double-invocation**. The `useEffect` cleanup must always unsubscribe.
- **Cell click → drill to detail**: out of scope for phase 05e. Just hover-tooltip via `title=`.
- **Color contrast**: rule colors are user-defined. If a color is dark, the white text becomes unreadable. For phase 05e accept this; later we can compute contrast and switch label color.
- **Designer mode**: the chart's HTML overlay has `pointer-events: none` in designer (Phase 02). The Status Map cells therefore can't be clicked in designer. That's fine — the user clicks the SVG hit-rect underneath to select the widget. Verify.
- **`pnpm test` + `pnpm build`** required.

## Acceptance criteria

1. `cd frontend && pnpm exec tsc --noEmit` clean; `pnpm build` and `pnpm test` clean.
2. **Manual:** Place a Status Map widget. Bind 6 boolean / discrete points (e.g. pump statuses).
3. In Options, set columns to 3. Add color rules: `min=0 max=1 color=#10B981 label=Stopped`, `min=1 max=2 color=#F59E0B label=Running`, `min=2 max=3 color=#EF4444 label=Faulted`.
4. Cells render in a 3-column grid. As values arrive, cell backgrounds change without a React re-render (verify via React DevTools Profiler — no chart41 render after initial paint when values update).
5. Bad-quality points show with reduced opacity.
6. Saved config round-trip works — color rules persist.
7. Phase 04 palette shows Status Map as available.

## Phase dependencies

- **Depends on:** Phase 04.
- **Gates:** Nothing critical.
