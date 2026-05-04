# Phase 06c — Content Widget: Logs Viewer (chart53)

**Goal:** Implement chart53 — a scrolling list of recent alarms or events, subscribed to the existing alarm/event WebSocket feed.

## Read first (required)

- `/home/io/io-dev/io/docs/plans/chart-widget-system/MASTER.md`
- Phase 04 must be complete.
- `/home/io/io-dev/io/frontend/src/shared/components/charts/ChartRenderer.tsx` — chart53 commented entry from Phase 00.
- Find the alarm/event hook with grep:
  ```bash
  grep -rn "useAlarms\|useAlarmsStream\|alarms.*websocket\|/alarms.*subscribe" frontend/src/ --include="*.ts" --include="*.tsx" | head
  ```
  The existing hook (likely `useAlarmsStream` or similar in `frontend/src/shared/hooks/`) is what chart53 subscribes to.
- `/home/io/io-dev/io/frontend/src/pages/console/panes/AlarmListPane.tsx` (or a similar pane) for reference on how the existing Alarm List feature reads data.

## Context

A scrolling list of recent alarms/events placed inline in a graphic. Useful for an operator overview where the graphic shows process state on top and a live alarm feed on the side. Configurable:

- `extras.source: "alarms" | "events"` — which feed to subscribe.
- `extras.maxRows: number` — buffer cap (default 25).
- `extras.filterPriority?: number[]` — show only matching priorities (alarms only).
- `extras.autoScroll: boolean` — when new entries arrive, auto-scroll to top (most-recent-first) or bottom (chronological), depending on the order. Default: `true`, most-recent-first at top.

This is `requiresPoints: false` — no point bindings.

## Changes

### 1. Create `frontend/src/shared/components/charts/renderers/chart53-logs-viewer.tsx`

```tsx
// ---------------------------------------------------------------------------
// Chart 53 — Logs Viewer
// Live-scrolling list of alarms or events. Subscribes to the existing alarm
// or event WebSocket feed. Most-recent-first at the top (autoScroll keeps
// the view pinned to the top as new rows arrive).
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState } from "react";
import type { ChartConfig } from "../chart-config-types";
// IMPORTANT: replace the next import with the actual alarm/event hook found
// in the codebase. Likely candidates:
//   import { useAlarmsStream } from "../../../hooks/useAlarmsStream";
//   import { useEventsStream } from "../../../hooks/useEventsStream";
// If only one combined hook exists, use it; if two, use the source-appropriate one.

interface RendererProps {
  config: ChartConfig;
  bufferKey: string;
}

interface LogRow {
  id: string;
  ts: number;
  priority?: number;
  severity?: string;
  message: string;
  source?: string;
}

export default function Chart53LogsViewer({ config }: RendererProps) {
  const source = (config.extras?.source as "alarms" | "events" | undefined) ?? "alarms";
  const maxRows = (config.extras?.maxRows as number | undefined) ?? 25;
  const filterPriority = (config.extras?.filterPriority as number[] | undefined) ?? null;
  const autoScroll = (config.extras?.autoScroll as boolean | undefined) ?? true;

  // Local rolling buffer
  const [rows, setRows] = useState<LogRow[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // Subscribe to the appropriate stream. Replace the placeholder below with
  // the real hook. The hook must call `pushRow` for each incoming entry.
  // Pattern (pseudo):
  //
  //   const { latest } = source === "alarms"
  //     ? useAlarmsStream({ filter: { priorities: filterPriority ?? undefined } })
  //     : useEventsStream();
  //   useEffect(() => { if (latest) pushRow(latest); }, [latest]);

  const pushRow = (row: LogRow) => {
    setRows((prev) => {
      const next = [row, ...prev];
      if (next.length > maxRows) next.length = maxRows;
      return next;
    });
  };

  // Replace this stub with the real subscription. Keep the same `pushRow` shape.
  useEffect(() => {
    // const unsub = subscribeToFeed(source, { filterPriority }, pushRow);
    // return unsub;
  }, [source, filterPriority]);

  // Auto-scroll to top when new rows arrive.
  useEffect(() => {
    if (!autoScroll) return;
    containerRef.current?.scrollTo({ top: 0 });
  }, [rows.length, autoScroll]);

  // Mark ready for export pipeline.
  useEffect(() => {
    queueMicrotask(() => {
      containerRef.current?.setAttribute("data-chart-ready", "true");
    });
  }, []);

  if (rows.length === 0) {
    return (
      <div
        ref={containerRef}
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--io-text-muted)",
          fontSize: 12,
        }}
      >
        No {source} yet
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        overflow: "auto",
        fontSize: 11,
        fontFamily: "ui-monospace, Menlo, Consolas, monospace",
        padding: 4,
      }}
    >
      {rows.map((r) => (
        <div
          key={r.id}
          style={{
            display: "grid",
            gridTemplateColumns: "auto 56px 1fr",
            gap: 8,
            padding: "2px 4px",
            borderBottom: "1px solid var(--io-border)",
            color: priorityColor(r.priority),
          }}
        >
          <span>{new Date(r.ts).toISOString().slice(11, 19)}</span>
          <span>{r.priority != null ? `P${r.priority}` : r.severity ?? ""}</span>
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {r.message}
          </span>
        </div>
      ))}
    </div>
  );
}

function priorityColor(p?: number): string {
  if (p === 1) return "var(--io-danger, #EF4444)";
  if (p === 2) return "var(--io-warning, #F59E0B)";
  if (p === 3) return "var(--io-info, #60A5FA)";
  return "var(--io-text)";
}
```

**Important:** the implementer **must** find the real alarm/event subscription hook in the codebase and wire it. Above is the shape; the actual hook name may differ. Confirm with:

```bash
grep -rn "useAlarmsStream\|useAlarmsLive\|useEventsStream\|alarmsApi.subscribe" frontend/src/
```

If a Zustand store holds the alarm list (e.g. `useAlarmsStore`), prefer subscribing to it via `useAlarmsStore((s) => s.recent)` and slicing top N rather than holding a parallel buffer.

### 2. `frontend/src/shared/components/charts/ChartRenderer.tsx`

Uncomment chart53:

```ts
53: lazy(() => import("./renderers/chart53-logs-viewer")),
```

### 3. `frontend/src/shared/components/charts/chart-definitions.ts`

Set chart53 `available: true`.

### 4. `frontend/src/shared/components/charts/ChartOptionsForm.tsx`

```tsx
if (config.chartType === 53) {
  const filterPriority = (config.extras?.filterPriority as number[] | undefined) ?? [];
  return (
    <div>
      <Field label="Source">
        <Select
          value={(config.extras?.source as string | undefined) ?? "alarms"}
          onChange={(v) =>
            onChange({ ...config, extras: { ...config.extras, source: v as "alarms" | "events" } })
          }
          options={[
            { value: "alarms", label: "Alarms" },
            { value: "events", label: "Events" },
          ]}
        />
      </Field>
      <Field label="Max Rows">
        <NumberInput
          value={(config.extras?.maxRows as number | undefined) ?? 25}
          min={5}
          max={500}
          onChange={(v) => onChange({ ...config, extras: { ...config.extras, maxRows: v } })}
        />
      </Field>
      {(config.extras?.source ?? "alarms") === "alarms" && (
        <Field label="Filter Priorities">
          <MultiCheckbox
            options={[1, 2, 3, 4, 5].map((p) => ({ value: p, label: `Priority ${p}` }))}
            value={filterPriority}
            onChange={(v) =>
              onChange({
                ...config,
                extras: { ...config.extras, filterPriority: v.length ? v : undefined },
              })
            }
          />
        </Field>
      )}
      <Field label="Auto-Scroll">
        <Checkbox
          checked={(config.extras?.autoScroll as boolean | undefined) ?? true}
          onChange={(v) => onChange({ ...config, extras: { ...config.extras, autoScroll: v } })}
        />
      </Field>
    </div>
  );
}
```

`MultiCheckbox` may not exist; if not, render a column of `<Checkbox>` rows inline.

## Gotchas

- **Use the existing alarm/event subscription** — do not open a new WebSocket. The codebase has a SharedWorker-backed connection (see `useWebSocket` / `wsManager`) and dedicated alarm/event streams; pick the right one. Per the Console module CLAUDE.md, **do not open per-component WebSockets**.
- **Buffer cap**: `maxRows` is the cap; rolling buffer drops oldest at the bottom (or end of array, depending on order).
- **Performance**: 25–100 rows of plain divs is fine. Don't bother with virtualization unless `maxRows > 500` (rare).
- **Priority filter**: applied client-side here, not at the subscription level (unless the hook supports server-side filtering — preferred if available).
- **Cleanup**: unsubscribe on unmount and on source/filter change so the buffer doesn't leak.
- **`pnpm test` + `pnpm build`** required.

## Acceptance criteria

1. `cd frontend && pnpm exec tsc --noEmit` clean; `pnpm build` and `pnpm test` clean.
2. **Manual:** Place a Logs Viewer widget. Trigger an alarm in the system (or wait for one). Row appears at top. As more arrive, top stays pinned.
3. Switch source to Events — different feed, rows still scroll.
4. Set Max Rows to 5 — buffer truncates at 5.
5. Filter to priority 1 only — only P1 rows appear.
6. Saved config round-trip works.
7. Palette shows Logs Viewer.

## Phase dependencies

- **Depends on:** Phase 04.
- **Gates:** Nothing critical.
