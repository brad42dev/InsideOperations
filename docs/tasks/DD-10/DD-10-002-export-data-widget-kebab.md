---
id: DD-10-002
title: Implement Export Data dialog for per-widget kebab menu
unit: DD-10
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

Each dashboard widget has a three-dot (kebab) menu. When the user clicks "Export Data", a dialog should appear offering format choices (CSV, XLSX, JSON, Parquet), build the export request for that widget's current data, and either stream a file download or initiate an async export job. The option must be hidden (not disabled) when the user lacks `dashboards:export` permission.

## Spec Excerpt (verbatim)

> Per-widget export via three-dot (kebab) menu: "Export Data" option
> Export dialog supports widget-specific data (trend data, table data, KPI values)
> Supported formats: CSV, XLSX, JSON, Parquet (per widget)
> Requires `dashboards:export` permission
> — design-docs/10_DASHBOARDS_MODULE.md §Data Export

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/dashboards/widgets/WidgetContainer.tsx` — line 159: `{ label: 'Export Data', action: () => { setMenuOpen(false) } }` — stub with no implementation
- `frontend/src/pages/dashboards/widgets/LineChart.tsx` — historical data query at lines 46–64; export should send these same params
- `frontend/src/pages/dashboards/widgets/TableWidget.tsx` — rows at lines 67–69; export should export these rows
- `frontend/src/pages/dashboards/widgets/KpiCard.tsx` — current value at lines 52–54
- `frontend/src/shared/hooks/useAuthStore.ts` (or equivalent) — for permission check

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] "Export Data" kebab item triggers an export dialog (modal) with format options, not just closes the menu
- [ ] Supported formats offered: CSV, XLSX, JSON, Parquet (at minimum)
- [ ] "Export Data" item is hidden (not disabled) when the user lacks `dashboards:export` permission
- [ ] Export for LineChart sends the correct `point_ids`, `start`, `end`, and `bucket` params matching the widget config
- [ ] Export for TableWidget exports the currently displayed rows (dynamic or static)
- [ ] Export for KpiCard exports the current value with timestamp and quality
- [ ] For rows < 50,000: file download streams directly; for larger data: 202 response triggers async job

## Assessment

- **Status**: ❌ Missing (stub only)
- `WidgetContainer.tsx` line 159: the "Export Data" action body is `{ setMenuOpen(false) }` — it closes the menu and does nothing else. No export dialog component exists in the dashboards module.

## Fix Instructions

1. Create `frontend/src/pages/dashboards/widgets/ExportDataDialog.tsx` — a modal that accepts:
   - `widgetConfig: WidgetConfig` (to know what data to export)
   - `onClose: () => void`

2. The dialog renders a format selector (CSV, XLSX, JSON, Parquet as radio buttons or dropdown) and a "Download" button.

3. On submit, call `POST /api/v1/export/widget` with body:
   ```json
   { "widget_config": {...}, "format": "csv", "time_range": "..." }
   ```
   Follow the pattern from `25_EXPORT_SYSTEM.md`: synchronous for small data (stream file), async 202 for large.

4. In `WidgetContainer.tsx`, update the "Export Data" action to open the dialog:
   ```tsx
   const [showExport, setShowExport] = useState(false)
   // ...
   { label: 'Export Data', action: () => { setShowExport(true); setMenuOpen(false) } }
   ```
   Render `{showExport && <ExportDataDialog widgetConfig={config} onClose={() => setShowExport(false)} />}` at the bottom of the component.

5. Add permission check: import `useAuthStore`, get `hasPermission('dashboards:export')`, and conditionally include the "Export Data" item in the menu array. Use `filter()` to remove it when not permitted — do NOT disable the button.

Do NOT:
- Show the "Export Data" item as disabled when permission is missing — hide it entirely
- Offer PDF as a widget export format (PDF is a dashboard-definition export, not per-widget per spec)
- Use `window.open` for the download — use a proper fetch + blob URL approach for streaming
