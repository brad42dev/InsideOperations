---
id: DD-14-006
title: Add export button to rounds tables (CX-EXPORT gap)
unit: DD-14
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The Rounds module tables (round history, templates list, schedules list) must each have an Export split button in their toolbar. Clicking it opens a format menu (CSV, XLSX, PDF, JSON, Parquet, HTML). The export reflects the current filters and visible rows. The button is hidden (not disabled) when the user lacks `rounds:export` permission. Large exports (≥50,000 rows) go async with a WebSocket notification.

## Spec Excerpt (verbatim)

> Export button on rounds table toolbars: `[Export v]` split button
> Exportable entities: round templates (catalog), round template definitions (full checklist JSONB as JSON), round instances (schedule table), completed round results (inspection data), completion history (trend data)
> Supported formats: CSV, XLSX, PDF, JSON (per entity; JSON only for template definitions)
> Requires `rounds:export` permission
> — 14_ROUNDS_MODULE.md, §Data Export

> Every qualifying module table/toolbar has an Export button. It is not buried in a menu.
> Supported formats: CSV, XLSX, PDF, JSON, Parquet, HTML (6 formats).
> Export button is hidden (not disabled) when user lacks `<module>:export` permission.
> — SPEC_MANIFEST.md, §CX-EXPORT Non-negotiables

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/rounds/RoundHistory.tsx` — history table at lines 74–122; needs Export button in toolbar
- `frontend/src/pages/rounds/RoundTemplates.tsx` — templates list header at lines 28–39; needs Export button
- `frontend/src/pages/rounds/RoundSchedules.tsx` — schedules header at lines 91–100; needs Export button
- `frontend/src/pages/rounds/index.tsx` — tab headers; History tab toolbar at lines 416–425 needs Export button
- `frontend/src/shared/types/permissions.ts` — `rounds:export` is defined at line 96
- Look for a shared `ExportButton` or `SplitButton` component in `frontend/src/shared/components/`

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] RoundHistory.tsx toolbar has an Export button adjacent to the date range filters
- [ ] RoundTemplates.tsx header has an Export button adjacent to the New Template button
- [ ] RoundSchedules.tsx header has an Export button
- [ ] Export button offers all 6 formats: CSV, XLSX, PDF, JSON, Parquet, HTML
- [ ] Export button is conditionally hidden when user does not have `rounds:export` permission
- [ ] Export payload uses current filter state (date range for history, etc.)

## Assessment

- **Status**: ❌ Missing — no Export button in any of the three rounds tables; no export-related code in any rounds file

## Fix Instructions (if needed)

1. Check if a shared `ExportButton` component exists in `frontend/src/shared/components/`. If it exists, import and use it. If not, create one following the split-button pattern described in §CX-EXPORT.

2. **RoundHistory.tsx** — add an Export button to the filter toolbar (around line 59). The button calls `GET /api/rounds/history?format={fmt}&from={from}&to={to}`. Pass current `from`/`to` state values as query params so the export respects the active date filter.

3. **RoundTemplates.tsx** — add Export button in the header row at line 36, to the left of the `+ New Template` button. Calls `GET /api/rounds/templates?format={fmt}`.

4. **RoundSchedules.tsx** — add Export button in the header row at line 99, to the left of `+ Add Schedule`. Calls `GET /api/rounds/schedules?format={fmt}`.

5. **Permission check** — wrap the Export button render in a permission check:
   ```tsx
   const canExport = usePermission('rounds:export')
   // ...
   {canExport && <ExportButton ... />}
   ```
   Use whatever permission hook pattern is established in the codebase.

6. Formats offered must include all 6: CSV, XLSX, PDF, JSON, Parquet, HTML. For rounds templates, JSON should be highlighted as the format that exports the full checklist JSONB.

Do NOT:
- Disable the Export button when the user lacks permission — spec says hidden, not disabled
- Export all rows regardless of active filters — the export must be WYSIWYG
- Implement a custom export modal from scratch if a shared ExportButton component already exists
