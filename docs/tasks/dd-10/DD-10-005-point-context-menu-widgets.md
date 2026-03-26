---
id: DD-10-005
title: Wire up shared PointContextMenu to all dashboard widget point values
unit: DD-10
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

Any point value displayed in a dashboard widget (KPI card value, gauge reading, table row point value, chart data point, alert alarm source) must respond to right-click (desktop) or 500ms long-press (mobile) by opening the shared `PointContextMenu` component. This is the cross-cutting CX-POINT-CONTEXT requirement. Individual modules must NOT implement their own version — they must use the shared component.

## Spec Excerpt (verbatim)

> Point values displayed in dashboard widgets (trend charts, KPI gauges, value tables, alert status) support the shared Point Context Menu (right-click on any point value). See `32_SHARED_UI_COMPONENTS.md` for the full menu: Point Detail, Trend Point, Investigate Point, Report on Point, plus Investigate Alarm on alarm rows.
> — design-docs/10_DASHBOARDS_MODULE.md §Point Context Menu

> Right-clicking (desktop) or long-pressing 500ms (mobile) on any point-bound element opens the unified `PointContextMenu` shared component. Individual modules must NOT implement their own version.
> The component signature is `PointContextMenu({ pointId, tagName, isAlarm, isAlarmElement })`.
> — CX-POINT-CONTEXT contract, docs/SPEC_MANIFEST.md §Wave 0

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/dashboards/widgets/KpiCard.tsx` — `pointId` is `cfg.metric`; value display div needs `onContextMenu`
- `frontend/src/pages/dashboards/widgets/GaugeWidget.tsx` — `pointId` is `cfg.pointId`; EChart container needs `onContextMenu`
- `frontend/src/pages/dashboards/widgets/LineChart.tsx` — `points` array; chart container needs `onContextMenu`
- `frontend/src/pages/dashboards/widgets/TableWidget.tsx` — `cfg.pointIds` per row; each data row needs `onContextMenu`
- `frontend/src/pages/dashboards/widgets/AlertStatusWidget.tsx` — `alarm.source` is the point reference; each alarm row needs `onContextMenu` with `isAlarm: true`
- `frontend/src/shared/components/PointContextMenu.tsx` — shared component to wire into

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] `KpiCard.tsx` value div has `onContextMenu` that calls `PointContextMenu` with the correct `pointId`
- [ ] `GaugeWidget.tsx` container has `onContextMenu` that calls `PointContextMenu` with `pointId`
- [ ] `TableWidget.tsx` rows for point-sourced data have `onContextMenu` per row with the row's `point_id`
- [ ] `AlertStatusWidget.tsx` alarm rows have `onContextMenu` with `isAlarm: true` and `isAlarmElement: true`
- [ ] All usages pass the canonical four props: `pointId`, `tagName`, `isAlarm`, `isAlarmElement`
- [ ] The shared `PointContextMenu` component is used — no custom menu implemented in any widget

## Assessment

- **Status**: ❌ Missing
- Searched all 5 widget files for `onContextMenu` — zero occurrences. Searched for `PointContextMenu` import — zero occurrences in any dashboard file. The entire CX-POINT-CONTEXT contract is unimplemented in the dashboards module.

## Fix Instructions

1. Confirm `PointContextMenu` exists at `frontend/src/shared/components/PointContextMenu.tsx`. If it does not exist, it must be created as part of the CX-POINT-CONTEXT audit before this task can be fully completed. This task assumes it exists.

2. In `KpiCard.tsx`: add `onContextMenu` to the value display `<div>` (around line 93):
```tsx
onContextMenu={(e) => {
  e.preventDefault()
  openPointContextMenu({ pointId, tagName: pointId, isAlarm: false, isAlarmElement: false, x: e.clientX, y: e.clientY })
}}
```

3. In `GaugeWidget.tsx`: add `onContextMenu` to the outer container div (line 153).

4. In `TableWidget.tsx`: add `onContextMenu` to each `<tr>` for dynamic rows (around line 170), passing `row.original.point_id as string`.

5. In `AlertStatusWidget.tsx`: add `onContextMenu` to each alarm `<div>` (around line 131), with:
```tsx
onContextMenu={(e) => {
  e.preventDefault()
  openPointContextMenu({ pointId: alarm.source, tagName: alarm.source, isAlarm: true, isAlarmElement: true, x: e.clientX, y: e.clientY })
}}
```

6. For `LineChart.tsx`: ECharts charts require the `onContextMenu` event to be attached via an ECharts event handler (`chartInstance.on('contextmenu', ...)`), not a React `onContextMenu` prop on the wrapper. Pass the handler to the `EChart` shared component or use a ref.

Do NOT:
- Implement a custom context menu in any widget — always use the shared `PointContextMenu` component
- Add `onContextMenu` to the widget chrome/title bar — only on the data value elements themselves
- Forget mobile long-press (500ms `onPointerDown` / `onPointerUp` timing) — this can be a follow-up once desktop is working, but note it in code comments
