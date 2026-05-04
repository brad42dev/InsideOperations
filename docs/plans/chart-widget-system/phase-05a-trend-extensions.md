# Phase 05a — Trend Extensions: Band/Envelope and Deviation Mode

**Goal:** Extend chart01 (Trend) with optional `band-high` / `band-low` slots (filled band area between two series) and an optional `setpoint` slot driving deviation mode (`actual − setpoint` rendering).

## Read first (required)

- `/home/io/io-dev/io/docs/plans/chart-widget-system/MASTER.md`
- Phase 04 must be complete.
- `/home/io/io-dev/io/frontend/src/shared/components/charts/chart-config-types.ts` — particularly `CHART_SLOTS[1]` (Trend) and the slot model.
- `/home/io/io-dev/io/frontend/src/shared/components/charts/renderers/chart01-live-trend.tsx` — full file (the renderer you're extending).
- `/home/io/io-dev/io/frontend/src/shared/components/charts/TimeSeriesChart.tsx` — the underlying uPlot wrapper. Skim to see how series are passed in and whether area-fill is already supported.
- `/home/io/io-dev/io/frontend/src/shared/components/charts/ChartOptionsForm.tsx` — the per-chart "Options" tab body. You'll add band/deviation toggles here.

## Context

Process trends commonly need to show:
- **Band/envelope** — an upper and lower limit envelope (e.g. control limits, spec limits) drawn as a translucent filled area behind the data series. Operators see at a glance when a value is outside its band.
- **Deviation mode** — instead of rendering a process variable's raw value, render `value − setpoint`, with a zero line. Useful for tuning, where deviation matters more than absolute value.

We extend chart01 in place rather than creating new chart IDs because both are minor variants of the same Trend behavior (same data, same time axis, same legend, same scaling tab). Slot definitions are optional — when unset, chart01 behaves exactly as before.

## Changes

### 1. `frontend/src/shared/components/charts/chart-config-types.ts`

Update `CHART_SLOTS[1]` to add optional band and setpoint slots:

```ts
1: [
  { id: "series", label: "Trend Lines", multi: true, required: true },
  { id: "band-high", label: "Band: High Limit", multi: false, required: false },
  { id: "band-low", label: "Band: Low Limit", multi: false, required: false },
  { id: "setpoint", label: "Setpoint (Deviation Mode)", multi: false, required: false },
],
```

Also update `CHART_SLOTS[2]` and `CHART_SLOTS[3]` identically — chart 2 and 3 are merged into chart01 in the renderer dispatch (see `ChartRenderer.tsx` lines 67–69), so configs saved with `chartType: 2` or `3` use the same slots.

### 2. `frontend/src/shared/components/charts/renderers/chart01-live-trend.tsx`

**2a.** Read `extras.showBands` and `extras.deviationMode` from the config:

```ts
const showBands = (config.extras?.showBands as boolean | undefined) ?? false;
const deviationMode = (config.extras?.deviationMode as boolean | undefined) ?? false;

const bandHighSlot = config.points.find((p) => p.role === "band-high") ?? null;
const bandLowSlot = config.points.find((p) => p.role === "band-low") ?? null;
const setpointSlot = config.points.find((p) => p.role === "setpoint") ?? null;
```

**2b.** Include band and setpoint pointIds in the `pointIds` array passed to `useTimeSeriesBuffer` so they're subscribed and seeded:

```ts
const seriesPointIds = seriesSlots.map((p) => p.pointId);
const extraPointIds: string[] = [];
if (showBands && bandHighSlot) extraPointIds.push(bandHighSlot.pointId);
if (showBands && bandLowSlot) extraPointIds.push(bandLowSlot.pointId);
if (deviationMode && setpointSlot) extraPointIds.push(setpointSlot.pointId);

const allPointIds = [...seriesPointIds, ...extraPointIds];
// ...feed allPointIds to useTimeSeriesBuffer
```

**2c.** **Deviation mode**: if `deviationMode && setpointSlot`, derive a new dataset for each visible series where each sample becomes `seriesValue − setpointValue` interpolated to the same timestamp. The interpolation is the same as uPlot already does (linear or step). Easiest implementation: after `useTimeSeriesBuffer` returns aligned timestamps + per-series arrays, iterate the timestamps and subtract the setpoint's interpolated value at each ts.

```ts
function alignAndDeviate(
  timestamps: number[],
  seriesArrays: Array<Array<number | null>>,
  setpointTimestamps: number[],
  setpointValues: Array<number | null>,
): Array<Array<number | null>> {
  // For each ts in `timestamps`, find the setpoint value at that ts using
  // step-interpolation (last known value <= ts). Then subtract from each series.
  const devSeries = seriesArrays.map((arr) =>
    arr.map((v, i) => {
      if (v == null) return null;
      const sp = lookupAt(setpointTimestamps, setpointValues, timestamps[i]);
      return sp == null ? null : v - sp;
    }),
  );
  return devSeries;
}

function lookupAt(ts: number[], vals: Array<number | null>, target: number): number | null {
  if (ts.length === 0) return null;
  let lo = 0, hi = ts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (ts[mid] <= target) lo = mid; else hi = mid - 1;
  }
  return vals[lo];
}
```

When deviation mode is active, also draw a zero reference line. uPlot has a `hooks.draw` extension point or you can pass a horizontal reference line as an extra series with `{ value: () => 0, stroke: "var(--io-border-strong)", dash: [4,4] }`. Use whichever pattern is already established in the codebase (search `chart01` and `chart24-shewhart` for control-limit reference lines).

In deviation mode, **the y-axis units are deltas, not raw values.** Adjust the y-axis label accordingly: append " (Δ)" to each scale label.

**2d.** **Band rendering**: if `showBands && bandHighSlot && bandLowSlot`, add two extra uPlot series for the high and low limits, with a translucent fill between them. uPlot supports `band` rendering via `{ bands: [{ series: [hiIdx, loIdx], fill: "rgba(...)" }] }`. Look at the existing `TimeSeriesChart` props — if it passes through `bands`, use that. If not, extend `TimeSeriesChart` to accept an optional `bands` prop and forward it to uPlot.

```ts
const bands: { series: [number, number]; fill: string }[] | undefined =
  showBands && bandHighSlot && bandLowSlot
    ? [{
        series: [bandHighSeriesIndex, bandLowSeriesIndex],
        fill: "rgba(96, 165, 250, 0.15)", // translucent blue
      }]
    : undefined;
```

The high and low band series themselves can be rendered as thin dashed lines (`dash: [4, 2]`) with low alpha so the visual weight is on the fill.

**2e.** **Empty/incomplete config**: if `showBands` is true but only one of the two band slots is bound, log a soft warning and skip band rendering (don't crash). Same for deviation mode without a setpoint — fall back to raw value rendering.

### 3. `frontend/src/shared/components/charts/ChartOptionsForm.tsx`

Add a new section for chart01's band/deviation toggles. The form likely already dispatches by `config.chartType`. Find the chart01 branch (or create it):

```tsx
if (config.chartType === 1 || config.chartType === 2 || config.chartType === 3) {
  return (
    <div>
      {/* ...existing trend options (interpolation, x/y labels, etc.)... */}

      <Field label="Show Band/Envelope">
        <Checkbox
          checked={(config.extras?.showBands as boolean) ?? false}
          onChange={(checked) =>
            onChange({
              ...config,
              extras: { ...config.extras, showBands: checked },
            })
          }
        />
      </Field>
      {(config.extras?.showBands as boolean) && (
        <p style={{ fontSize: 11, color: "var(--io-text-muted)" }}>
          Bind High and Low limit points in the Data Points tab.
        </p>
      )}

      <Field label="Deviation Mode">
        <Checkbox
          checked={(config.extras?.deviationMode as boolean) ?? false}
          onChange={(checked) =>
            onChange({
              ...config,
              extras: { ...config.extras, deviationMode: checked },
            })
          }
        />
      </Field>
      {(config.extras?.deviationMode as boolean) && (
        <p style={{ fontSize: 11, color: "var(--io-text-muted)" }}>
          Renders <code>value − setpoint</code>. Bind a Setpoint point in the Data Points tab.
        </p>
      )}
    </div>
  );
}
```

The `Field` and `Checkbox` components used in `ChartOptionsForm` already exist — match the surrounding pattern.

### 4. Point selector: show optional slots

`ChartPointSelector.tsx` (the Points tab body) reads `CHART_SLOTS[chartType]`. After step 1, it'll automatically show the new optional slots. Confirm by inspection that optional (`required: false`) slots render with a clear "(optional)" or muted appearance — match existing styling for chart 10 (`setpoint` already uses `required: false`).

## Gotchas

- **Aligned timestamps**: uPlot wants all series to share a single x-axis array. The setpoint stream may have different timestamps than the variable streams. The `alignAndDeviate` helper interpolates to the variable timestamps. Don't naïvely zip arrays of different lengths.
- **Step vs linear setpoint**: setpoints typically change in steps. Use last-known-value (step interpolation) when looking up the setpoint at an arbitrary ts. The helper above does this. Don't linearly interpolate a setpoint between two values — it implies a smooth ramp the controller never executed.
- **Band fill alpha**: keep low (0.10–0.20). Higher and the trend lines are obscured.
- **Multiscale charts**: bands and series should share the same y-scale (otherwise the band visualization is meaningless). When `scaling.type === "multiscale"`, force the band series and the variable series onto the same `scaleKey` (the variable's). Document this constraint in a comment near the band rendering.
- **Deviation mode with multiscale**: messy — each series has a different setpoint potentially. For phase 05a, support deviation mode only when there is exactly one series in the chart. If multiple, render raw and surface a soft warning ("Deviation mode supports a single series; rendering raw values"). Tighten later if needed.
- **`requiresPoints` not affected** — chart01 still requires points; the optional slots are extras.
- **`pnpm test` + `pnpm build`** required. Visually inspect with at least one band-bound chart and one deviation-mode chart.

## Acceptance criteria

1. `cd frontend && pnpm exec tsc --noEmit` exits 0; `pnpm build` and `pnpm test` exit 0.
2. **Manual:** Place a Trend widget. Bind 1 series. Bind a band-high and band-low to two limit points. Enable "Show Band/Envelope" in Options. The translucent band renders between the high and low lines; main series sits on top.
3. Disable "Show Band/Envelope" — the band disappears; main series renders normally.
4. Deviation mode: bind a single series and a setpoint. Enable "Deviation Mode". Chart shows `value − setpoint`; a dashed zero line is visible.
5. Saved config round-trip: save graphic, reload, both modes still work.
6. Undo: enabling/disabling band or deviation mode is one undo entry each (per the 250ms debounce in Phase 03).

## Phase dependencies

- **Depends on:** Phase 04.
- **Gates:** Nothing critical; can run in parallel with 05b–06c.
