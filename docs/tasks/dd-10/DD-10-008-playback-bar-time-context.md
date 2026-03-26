---
id: DD-10-008
title: Add Playback Bar in time-context mode to DashboardViewer
unit: DD-10
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The DashboardViewer must include the shared `HistoricalPlaybackBar` component in "time context" mode. In this mode, the bar acts as a global time range selector for all widgets on the dashboard. When the user changes the time range via the bar, all time-sensitive widgets (LineChart, KpiCard, TableWidget with time context) update their queries accordingly.

## Spec Excerpt (verbatim)

> Dashboards | Time context | Sets time range for all widgets
> — CX-PLAYBACK contract, docs/SPEC_MANIFEST.md §Wave 0

> Playback Bar is the same shared component across all modules — not re-implemented per module.
> — CX-PLAYBACK contract, docs/SPEC_MANIFEST.md §Wave 0

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/dashboards/DashboardViewer.tsx` — no PlaybackBar import or usage anywhere
- `frontend/src/shared/components/HistoricalPlaybackBar.tsx` — shared component to integrate
- `frontend/src/store/playback.ts` — playback/time range store
- `frontend/src/pages/dashboards/widgets/LineChart.tsx` — lines 40–44: `timeRange` from widget config; should also accept global time range override

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] `DashboardViewer.tsx` renders `<HistoricalPlaybackBar mode="time-context" />` in the main layout
- [ ] Changing the global time range in the playback bar updates `lineChart` queries (overrides per-widget `timeRange`)
- [ ] The playback bar is not rendered inside kiosk mode (or is accessible via hover-to-reveal strip)
- [ ] Playback bar state is stored in the `playback` store so all widgets can read the global time range
- [ ] Per-widget time range override still works when global time range is not set

## Assessment

- **Status**: ❌ Missing
- `DashboardViewer.tsx` has no import of `HistoricalPlaybackBar`. Widget time ranges are entirely per-widget (e.g., `LineChart.tsx` line 42: `const timeRange = cfg.timeRange ?? '1h'`). No global time context mechanism exists in the dashboards module.

## Fix Instructions

1. Check `frontend/src/shared/components/HistoricalPlaybackBar.tsx` to understand its props interface. Confirm it has a `mode` prop or equivalent for "time context" behavior.

2. In `DashboardViewer.tsx`, add the playback bar to the layout — after the variable bar and before the widget grid:
```tsx
import HistoricalPlaybackBar from '../../shared/components/HistoricalPlaybackBar'
// ...
{!isKiosk && (
  <HistoricalPlaybackBar mode="time-context" />
)}
```

3. In the playback store (`frontend/src/store/playback.ts`), ensure a `globalTimeRange` state exists: `{ start: string | null; end: string | null }`.

4. In `LineChart.tsx`, read the global time range as an override:
```ts
const { globalTimeRange } = usePlaybackStore()
const effectiveTimeRange = globalTimeRange ?? { relativeRange: cfg.timeRange ?? '1h' }
```
Use `effectiveTimeRange` when building the history query parameters.

5. `KpiCard` (current value) and `GaugeWidget` (current value) are less affected by time range — they always show "now". Time context affects only historical data queries.

Do NOT:
- Re-implement the playback bar UI from scratch in the dashboards module — use the shared component
- Show the playback bar when `isKiosk` is true (in kiosk mode the bar should be hidden or part of the hover strip)
- Break per-widget time range when no global time range is set
