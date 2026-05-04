# Phase 05c — Data Table Pivot Mode

**Goal:** Add pivot/cross-tab mode to chart15 (Data Table). When enabled, rows and columns are derived from configurable fields with a value aggregator instead of the default 1-row-per-point layout.

## Read first (required)

- `/home/io/io-dev/io/docs/plans/chart-widget-system/MASTER.md`
- Phase 04 must be complete.
- `/home/io/io-dev/io/frontend/src/shared/components/charts/renderers/chart15-data-table.tsx` — full file. The current renderer shows one row per bound point with columns Tag/Description/Value/Quality/Timestamp.
- `/home/io/io-dev/io/frontend/src/shared/components/charts/ChartOptionsForm.tsx` — chart15 options branch.
- `/home/io/io-dev/io/frontend/src/shared/components/charts/chart-config-types.ts` — `AggregateType` union.

## Context

The current Data Table is a flat list of points. A pivot table is a cross-tab: rows = unique values of `rowField`, columns = unique values of `colField`, cells = aggregator over a value field. Users want this to summarize multi-tag data — e.g. "Average Temperature by Reactor (rows) by Hour (cols)".

We use TanStack Table's grouping support for the pivot. When `pivotMode === false`, the existing flat table renders (current behavior). When `pivotMode === true`, the rows/cols/values are computed from the data series and a cross-tab renders.

Pivot fields are picked from a small fixed set: tag name, point category, source, custom point metadata fields. For phase 05c, support `rowField` ∈ {"tagname", "source", "category"} and `colField` ∈ {"hour", "shift", "day"} (time bucket of the most-recent value's timestamp). Value aggregator is one of `AggregateType`. This keeps the surface small enough to ship.

## Changes

### 1. `frontend/src/shared/components/charts/renderers/chart15-data-table.tsx`

**1a.** Read pivot config from extras:

```ts
const pivotMode = (config.extras?.pivotMode as boolean | undefined) ?? false;
const pivotConfig = config.extras?.pivotConfig as
  | {
      rowField: "tagname" | "source" | "category";
      colField: "hour" | "shift" | "day";
      valueAggregator: AggregateType;
    }
  | undefined;
```

**1b.** Branch on `pivotMode`:

```tsx
if (!pivotMode || !pivotConfig) {
  return <FlatDataTable config={config} />; // existing rendering, refactor into a helper
}
return <PivotDataTable config={config} pivot={pivotConfig} />;
```

**1c.** Implement `PivotDataTable`:

- Subscribe to all bound point IDs (existing `useWebSocket(pointIds)`).
- Fetch metadata via `useQueries` (already present).
- For each point, derive its `rowKey` from `pivotConfig.rowField`:
  - `"tagname"` → meta.tagname
  - `"source"` → meta.source_id (resolve to source name via the points API or just show the id)
  - `"category"` → meta.point_category
- Derive `colKey` from `pivotConfig.colField` based on the latest value's timestamp:
  - `"hour"` → "00:00", "01:00", … "23:00" (use `new Date(ts).getHours()`)
  - `"shift"` → "Day" / "Night" (configurable boundary; for phase 05c hardcode 06:00 day, 18:00 night, document as TODO)
  - `"day"` → ISO date "YYYY-MM-DD"
- Aggregate values into the matrix using the chosen aggregator:
  - Build `Map<rowKey, Map<colKey, number[]>>`, push each value into its bucket, then reduce per-bucket using `applyAggregate(aggregator, samples)`.
- Render with TanStack Table:
  - Unique rowKeys → rows.
  - Unique colKeys → dynamic columns.
  - First column header: rowField label.
  - Cells: aggregated value formatted via the existing number formatter.

A minimal TanStack Table setup:

```ts
import { useReactTable, getCoreRowModel, flexRender } from "@tanstack/react-table";
```

Define columns with `columnHelper.accessor`. The dynamic columns are built from the unique colKeys discovered in the data.

**1d.** Empty state: if no data has arrived, render "Waiting for data…" centered. If pivotConfig is missing fields, render "Configure pivot row/column/aggregator in Options."

### 2. `frontend/src/shared/components/charts/ChartOptionsForm.tsx`

Add the chart15 options:

```tsx
if (config.chartType === 15) {
  const pivotMode = (config.extras?.pivotMode as boolean | undefined) ?? false;
  const pc = (config.extras?.pivotConfig as { rowField: string; colField: string; valueAggregator: AggregateType } | undefined) ?? {
    rowField: "tagname",
    colField: "hour",
    valueAggregator: "avg",
  };

  return (
    <div>
      <Field label="Pivot Mode">
        <Checkbox
          checked={pivotMode}
          onChange={(checked) =>
            onChange({
              ...config,
              extras: { ...config.extras, pivotMode: checked, pivotConfig: pc },
            })
          }
        />
      </Field>
      {pivotMode && (
        <>
          <Field label="Row Field">
            <Select
              value={pc.rowField}
              onChange={(v) =>
                onChange({
                  ...config,
                  extras: {
                    ...config.extras,
                    pivotConfig: { ...pc, rowField: v as "tagname" | "source" | "category" },
                  },
                })
              }
              options={[
                { value: "tagname", label: "Tag Name" },
                { value: "source", label: "Source" },
                { value: "category", label: "Category" },
              ]}
            />
          </Field>
          <Field label="Column Field">
            <Select
              value={pc.colField}
              onChange={(v) =>
                onChange({
                  ...config,
                  extras: {
                    ...config.extras,
                    pivotConfig: { ...pc, colField: v as "hour" | "shift" | "day" },
                  },
                })
              }
              options={[
                { value: "hour", label: "Hour of Day" },
                { value: "shift", label: "Shift (Day/Night)" },
                { value: "day", label: "Date" },
              ]}
            />
          </Field>
          <Field label="Value Aggregator">
            <Select
              value={pc.valueAggregator}
              onChange={(v) =>
                onChange({
                  ...config,
                  extras: {
                    ...config.extras,
                    pivotConfig: { ...pc, valueAggregator: v as AggregateType },
                  },
                })
              }
              options={[
                { value: "avg", label: "Average" },
                { value: "sum", label: "Sum" },
                { value: "last", label: "Last" },
                { value: "max", label: "Max" },
                { value: "min", label: "Min" },
                { value: "count", label: "Count" },
              ]}
            />
          </Field>
        </>
      )}
    </div>
  );
}
```

### 3. Aggregator helper

If `applyAggregate(type, samples)` doesn't already exist, add a small helper near `chart-config-types.ts` or in a new `chart-aggregate.ts`:

```ts
export function applyAggregate(type: AggregateType, samples: number[]): number {
  if (samples.length === 0) return NaN;
  switch (type) {
    case "avg": return samples.reduce((a, b) => a + b, 0) / samples.length;
    case "sum": return samples.reduce((a, b) => a + b, 0);
    case "last": return samples[samples.length - 1];
    case "first": return samples[0];
    case "max": return Math.max(...samples);
    case "min": return Math.min(...samples);
    case "count": return samples.length;
    case "median": {
      const sorted = [...samples].sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    }
    case "range": return Math.max(...samples) - Math.min(...samples);
    case "stddev": {
      const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
      const variance = samples.reduce((s, x) => s + (x - mean) ** 2, 0) / samples.length;
      return Math.sqrt(variance);
    }
    default: return NaN;
  }
}
```

If this helper exists already, reuse it.

## Gotchas

- **Live updates in pivot mode**: a live WebSocket only delivers one sample per point at a time, so "average over an hour" needs historical data. For phase 05c, the pivot uses the latest-known value per point per bucket — meaning each (row, col) cell is the **latest sample** that fell in that bucket. Document this limitation. Full historical aggregation can be added later via the history API.
- **Empty buckets**: render as empty cells, not "0".
- **NaN cells**: render as "—".
- **Many unique colKeys**: with `colField: "day"` and 30+ days of data, the table becomes wide. That's expected — let the user scroll horizontally. Container `overflow-x: auto` already on the existing data table.
- **TanStack Table version**: confirm with `cat frontend/package.json | grep tanstack`. The codebase uses `@tanstack/react-table` already.
- **`pnpm test` + `pnpm build`** required.

## Acceptance criteria

1. `cd frontend && pnpm exec tsc --noEmit` clean; `pnpm build` and `pnpm test` clean.
2. **Manual:** Place a Data Table widget with 3 points. With pivot mode off, existing flat table renders.
3. Enable pivot mode in Options with row=Tag Name, col=Hour, aggregator=Average. Table renders 3 rows × 24 cols. Cells populate as values arrive.
4. Switch aggregator to Max — cells update.
5. Switch row=Source — rows collapse to unique sources.
6. Disable pivot mode — flat table returns.
7. Saved config round-trip works.

## Phase dependencies

- **Depends on:** Phase 04.
- **Gates:** Nothing critical; can run in parallel with other 05x/06x phases.
