# Phase 05b — XY Scatter Bubble Extension

**Goal:** Add an optional `size` slot to chart13 (XY Scatter). When bound, the renderer switches to bubble mode where each point's size is driven by the size value, normalized into a configurable pixel range.

## Read first (required)

- `/home/io/io-dev/io/docs/plans/chart-widget-system/MASTER.md`
- Phase 04 must be complete.
- `/home/io/io-dev/io/frontend/src/shared/components/charts/chart-config-types.ts` — `CHART_SLOTS[13]` (chart13 = XY Scatter).
- `/home/io/io-dev/io/frontend/src/shared/components/charts/renderers/chart13-xy-scatter.tsx` — full file.
- `/home/io/io-dev/io/frontend/src/shared/components/charts/ChartOptionsForm.tsx` — chart13 options branch.

## Context

Bubble charts are a small superset of scatter charts: each point has X, Y, and **size**. They're useful for showing a third dimension (e.g. cost per unit on top of efficiency vs. yield). chart13 is the existing 2D XY scatter; we add bubble mode by exposing an optional `size` slot. When unbound, chart13 renders as today. When bound, the marker `symbolSize` per point is driven by the size value.

ECharts (chart13's library) supports per-point `symbolSize` either as a number or a function. We'll compute it per-sample, normalizing the size value into the `extras.bubbleSizeRange` pixel range (default `[8, 60]`).

## Changes

### 1. `frontend/src/shared/components/charts/chart-config-types.ts`

Update `CHART_SLOTS[13]`:

```ts
13: [
  { id: "x", label: "X Axis", multi: false, required: true },
  { id: "y", label: "Y Axis", multi: false, required: true },
  { id: "size", label: "Bubble Size (optional)", multi: false, required: false },
],
```

### 2. `frontend/src/shared/components/charts/renderers/chart13-xy-scatter.tsx`

**2a.** Read the size slot and the size-range extras:

```ts
const xSlot = config.points.find((p) => p.role === "x");
const ySlot = config.points.find((p) => p.role === "y");
const sizeSlot = config.points.find((p) => p.role === "size") ?? null;
const bubbleMode = sizeSlot != null;
const [minPx, maxPx] = (config.extras?.bubbleSizeRange as [number, number] | undefined) ?? [8, 60];
```

**2b.** When `bubbleMode`, include `sizeSlot.pointId` in the data fetch alongside x and y. The hook chart13 uses (likely `useTimeSeriesBuffer` or a per-tag fetch) needs the third stream. Align timestamps so each rendered point has `(x, y, size)` at a common ts (or use the latest-known value from each, depending on existing chart13 behavior).

**2c.** Compute symbolSize per point. ECharts `series` config:

```ts
const sizeValues: number[] = bubbleMode ? alignedSizeValues : [];
const minVal = bubbleMode ? Math.min(...sizeValues.filter((v) => Number.isFinite(v))) : 0;
const maxVal = bubbleMode ? Math.max(...sizeValues.filter((v) => Number.isFinite(v))) : 1;
const range = maxVal - minVal || 1;

const echartsOption: EChartsOption = {
  // ...
  series: [{
    type: "scatter",
    data: alignedXY.map((pt, i) => ({
      value: [pt.x, pt.y],
      symbolSize: bubbleMode
        ? minPx + ((sizeValues[i] - minVal) / range) * (maxPx - minPx)
        : 8,
    })),
    // ... existing tooltip / styling ...
  }],
};
```

ECharts also accepts `symbolSize` as a function `(val) => number`. If chart13 already passes data with `[x, y]` tuples (no per-point objects), the function form may be cleaner — but that loses access to the size value because the function receives the data tuple. Switch to per-point objects with the `value` and `symbolSize` fields, as above.

**2d.** Tooltip should show the size value when bubble mode is active. Use ECharts' `tooltip.formatter` to include `slotLabel(sizeSlot)` plus the value.

### 3. `frontend/src/shared/components/charts/ChartOptionsForm.tsx`

Add bubble size range controls under the chart13 branch:

```tsx
if (config.chartType === 13) {
  const sizeBound = config.points.some((p) => p.role === "size");
  return (
    <div>
      {/* existing options... */}
      {sizeBound && (
        <>
          <Field label="Bubble Min Size (px)">
            <NumberInput
              value={((config.extras?.bubbleSizeRange as [number, number] | undefined) ?? [8, 60])[0]}
              onChange={(v) =>
                onChange({
                  ...config,
                  extras: {
                    ...config.extras,
                    bubbleSizeRange: [
                      v,
                      ((config.extras?.bubbleSizeRange as [number, number] | undefined) ?? [8, 60])[1],
                    ],
                  },
                })
              }
              min={2}
              max={200}
            />
          </Field>
          <Field label="Bubble Max Size (px)">
            <NumberInput
              value={((config.extras?.bubbleSizeRange as [number, number] | undefined) ?? [8, 60])[1]}
              onChange={(v) =>
                onChange({
                  ...config,
                  extras: {
                    ...config.extras,
                    bubbleSizeRange: [
                      ((config.extras?.bubbleSizeRange as [number, number] | undefined) ?? [8, 60])[0],
                      v,
                    ],
                  },
                })
              }
              min={4}
              max={200}
            />
          </Field>
        </>
      )}
    </div>
  );
}
```

The size-range fields are only visible when the size slot is bound — matches the rule "show extras when relevant".

## Gotchas

- **Negative size values**: don't render a negative-size symbol. Clamp `sizeValues[i]` to `>= minVal` before normalization (the `Math.min` already handles this if the array is consistent), or reject NaN/Infinity samples.
- **Constant-value size**: if every size sample has the same value, `range` is 0 — guard with `|| 1` (above) so all bubbles render at `minPx`.
- **Logarithmic scaling**: not added in this phase; users can pre-process if needed.
- **Performance**: ECharts handles tens of thousands of bubbles fine. Don't worry about virtualization.
- **`pnpm test` + `pnpm build`** required.

## Acceptance criteria

1. `cd frontend && pnpm exec tsc --noEmit` clean; `pnpm build` and `pnpm test` clean.
2. **Manual:** Place an XY Scatter widget. Bind X and Y. Confirm normal scatter rendering (uniform marker size).
3. Bind a Size point. Bubbles render proportional to the size value; smallest at 8px, largest at 60px.
4. Change "Bubble Max Size (px)" to 30 — bubbles shrink accordingly.
5. Tooltip shows size label and value.
6. Unbind size — chart returns to uniform scatter.
7. Saved config round-trip works.

## Phase dependencies

- **Depends on:** Phase 04.
- **Gates:** Nothing critical; can run in parallel with other 05x/06x phases.
