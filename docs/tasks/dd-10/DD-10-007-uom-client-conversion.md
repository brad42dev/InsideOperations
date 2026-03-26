---
id: DD-10-007
title: Add UOM client-side conversion for real-time widget values
unit: DD-10
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

Real-time widget values (KpiCard current value, GaugeWidget current reading) must be converted to the display unit using the client-side UOM catalog cache before display. Historical widget data (LineChart) uses server-side conversion and does not need client-side conversion. The UOM catalog is cached at application startup.

## Spec Excerpt (verbatim)

> Real-time widget values: client-side conversion using cached UOM catalog
> Historical widget data (trends, aggregates): server-side conversion by API Gateway before returning results
> — design-docs/10_DASHBOARDS_MODULE.md §UOM Conversion

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/dashboards/widgets/KpiCard.tsx` — lines 52–56: `value` used directly without UOM conversion
- `frontend/src/pages/dashboards/widgets/GaugeWidget.tsx` — lines 49–50: `rawValue` used directly without conversion
- Look for a UOM catalog store or hook in `frontend/src/store/` or `frontend/src/shared/hooks/`

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] A UOM catalog cache exists (store or hook) that holds the full list of unit conversions
- [ ] `KpiCard.tsx` applies the UOM conversion from the point's `engineering_unit` to the widget's configured display unit before rendering `displayValue`
- [ ] `GaugeWidget.tsx` applies the same UOM conversion to `rawValue` before rendering
- [ ] When the point has no configured display unit, the raw value is shown unchanged (no error)
- [ ] Unit label displayed in the widget reflects the converted unit, not the source unit

## Assessment

- **Status**: ❌ Missing
- `KpiCard.tsx` line 52: `const value = cfg.staticValue !== undefined ? cfg.staticValue : (livePoint?.value ?? query.data?.value ?? null)` — no unit conversion applied before display. `GaugeWidget.tsx` line 49: same pattern. No UOM catalog store or conversion hook was found in the dashboards module.

## Fix Instructions

1. First, confirm the UOM catalog hook/store location. Search for `uom` or `engineering_unit` in `frontend/src/store/` and `frontend/src/shared/`. If it does not exist, create `frontend/src/store/uomStore.ts` that fetches and caches `GET /api/v1/uom/catalog` on app load.

2. Create or import a conversion function: `convertUom(value: number, fromUnit: string, toUnit: string, catalog: UomCatalog): number`.

3. In `KpiCard.tsx`: after `const value = ...`, apply conversion:
```ts
const sourceUnit = query.data?.engineering_unit ?? livePoint?.engineering_unit
const displayUnit = cfg.unit  // widget-configured display unit
const convertedValue = (value !== null && sourceUnit && displayUnit && sourceUnit !== displayUnit)
  ? convertUom(value, sourceUnit, displayUnit, uomCatalog)
  : value
```
Then use `convertedValue` in place of `value` for display.

4. Apply the same pattern in `GaugeWidget.tsx` for `rawValue`.

5. Note that `LineChart.tsx` does NOT need this change — historical data from `/api/archive/history` is already server-side converted.

Do NOT:
- Apply UOM conversion to LineChart historical data (it is already server-converted)
- Throw an error if the unit pair is not in the catalog — fall through to raw value display
- Cache UOM catalog inside the widget component — use the application-level store
