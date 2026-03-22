---
id: DD-10-006
title: Implement aggregation type awareness in widget config panel
unit: DD-10
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

When a user configures a widget with a point data source, the available aggregate options (avg, sum, min, max, count, rolling average) must be filtered by the point's `aggregation_types` bitmask from `points_metadata`. If a point does not allow averaging, the avg option and rolling average trend option must not appear. `min`, `max`, and `count` are always available.

## Spec Excerpt (verbatim)

> When configuring a widget with a point data source, only show aggregate options permitted by the point's `aggregation_types`
> If a point does not permit averaging, do not offer avg/trend options; if it does not permit summing, do not offer sum/total options
> `min`, `max`, and `count` are always available for all points
> Rolling averages available as a trend option when averaging is permitted
> — design-docs/10_DASHBOARDS_MODULE.md §Aggregation Type Awareness

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/dashboards/DashboardBuilder.tsx` — `WidgetConfigPanel` function, lines 148–346: the "Time Range" and aggregation inputs for `line-chart` use static options with no bitmask check
- `frontend/src/api/dashboards.ts` — API types for dashboard/widget config
- Endpoint `GET /api/v1/points/:id/metadata` should return `aggregation_types` bitmask

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] WidgetConfigPanel fetches the point's metadata when a point ID is entered (for kpi-card and gauge widgets)
- [ ] Available aggregation options are filtered against `aggregation_types` bitmask before rendering
- [ ] `avg` option is hidden when the bitmask does not include the avg bit
- [ ] `sum` option is hidden when the bitmask does not include the sum bit
- [ ] `min`, `max`, `count` are always shown regardless of bitmask
- [ ] For line-chart widget, rolling average option only appears when averaging is permitted by the point

## Assessment

- **Status**: ❌ Missing
- `DashboardBuilder.tsx` `WidgetConfigPanel` (lines 298–314): the aggregation config for `line-chart` is a static `<select>` offering `['15m', '30m', '1h', '6h', '12h', '24h', '7d']` (bucket intervals). There is no aggregation type selector at all, and no `aggregation_types` bitmask lookup. The KPI/gauge config panel (lines 224–241) has a point ID text input but fetches no metadata.

## Fix Instructions

1. In `WidgetConfigPanel` in `DashboardBuilder.tsx`, when the widget type is `kpi-card`, `gauge`, or `line-chart` and a point ID is set, fetch the point's metadata:

```ts
const pointMetaQuery = useQuery({
  queryKey: ['point-meta', cfg.pointId ?? cfg.metric],
  queryFn: async () => {
    const id = cfg.pointId ?? cfg.metric
    if (!id) return null
    const res = await api.get(`/api/v1/points/${encodeURIComponent(id)}/metadata`)
    if (!res.success) return null
    return res.data as { aggregation_types: number }
  },
  enabled: !!(cfg.pointId ?? cfg.metric),
})
const aggTypes = pointMetaQuery.data?.aggregation_types ?? 0xFF // default: all allowed
```

2. Define bitmask constants (match the database schema in doc 04):
```ts
const AGG_AVG  = 0x01
const AGG_SUM  = 0x02
const AGG_MIN  = 0x04  // always available per spec
const AGG_MAX  = 0x08  // always available per spec
const AGG_COUNT = 0x10 // always available per spec
```

3. For the `line-chart` aggregation type selector, build the options array dynamically:
```ts
const aggOptions = [
  { value: 'avg', label: 'Average', enabled: (aggTypes & AGG_AVG) !== 0 },
  { value: 'sum', label: 'Sum', enabled: (aggTypes & AGG_SUM) !== 0 },
  { value: 'min', label: 'Min', enabled: true },
  { value: 'max', label: 'Max', enabled: true },
  { value: 'count', label: 'Count', enabled: true },
].filter(o => o.enabled)
```

4. Render a proper aggregation type `<select>` for line-chart (currently missing entirely — only bucket interval exists).

5. For rolling average: add a checkbox "Rolling average" that only renders when `(aggTypes & AGG_AVG) !== 0`.

Do NOT:
- Show unavailable aggregate options grayed — filter them out entirely (they should not appear)
- Fetch metadata on every keystroke — debounce the point ID input or only fetch on blur
- Default to `avg` as the selected aggregation type without checking the bitmask
