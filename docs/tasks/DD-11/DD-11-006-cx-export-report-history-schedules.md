---
id: DD-11-006
title: Add CX-EXPORT button to Report History and Report Schedules tables
unit: DD-11
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The CX-EXPORT contract requires every module table/toolbar to have an Export button that allows the user to export the current filtered view in one of 6 formats (CSV, XLSX, PDF, JSON, Parquet, HTML). The Report History table and Report Schedules table both lack an export button entirely. Users should be able to export their report history (list of jobs) and schedules as CSV/XLSX for record-keeping or sharing.

## Spec Excerpt (verbatim)

> **Reports** | Report data (adds to existing reports export) | `reports:export`
> — docs/SPEC_MANIFEST.md, §CX-EXPORT Applies to

> Every qualifying module table/toolbar has an **Export button**. It is not buried in a menu.
> Export inherits the current view's active filters, sort order, and visible columns — **WYSIWYG export**.
> Supported formats: **CSV, XLSX, PDF, JSON, Parquet, HTML** (6 formats). Fewer formats is wrong.
> Export button is hidden (not disabled) when user lacks `reports:export` permission.
> — docs/SPEC_MANIFEST.md, §CX-EXPORT Non-negotiables

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/reports/ReportHistory.tsx` — header section at line 215; `DataTable` at line 242
- `frontend/src/pages/reports/ReportSchedules.tsx` — header section at line 627; `DataTable` at line 693
- `frontend/src/shared/components/DataTable.tsx` — check if DataTable accepts an `exportButton` or `toolbar` prop
- `frontend/src/api/reports.ts` — no export-list endpoint currently exists

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] ReportHistory page header contains an Export button visible when user has `reports:export` permission
- [ ] Export button is hidden (not disabled) when user lacks `reports:export` permission
- [ ] Export button supports at minimum CSV and XLSX formats
- [ ] Export uses the current filtered state (not a fresh unfiltered query)
- [ ] ReportSchedules page header contains an Export button with the same permission gating
- [ ] Filename follows convention: `reports_history_YYYY-MM-DD_HHmm.csv` and `reports_schedules_YYYY-MM-DD_HHmm.csv`

## Assessment

After checking:
- **Status**: ❌ Missing — no Export button in either table

## Fix Instructions

**Pattern:** Add an Export button to the right of each table's header row. For small datasets (report history and schedules lists are typically <50,000 rows), synchronous client-side export via the existing DataTable data is appropriate.

For `ReportHistory.tsx` — in the header `div` at line 212, add after the title+description block:
```tsx
{user?.permissions.includes('reports:export') && (
  <ExportMenu
    data={jobs}
    columns={columns}
    filenameBase="reports_history"
  />
)}
```

For `ReportSchedules.tsx` — in the header `div` at line 620, add similarly:
```tsx
{canManage && user?.permissions.includes('reports:export') && (
  <ExportMenu
    data={schedules}
    columns={columns}
    filenameBase="reports_schedules"
  />
)}
```

If a shared `ExportMenu` component does not exist, create one at `frontend/src/shared/components/ExportMenu.tsx` that accepts `data`, `columns`, and `filenameBase` props and renders a dropdown button offering CSV, XLSX, JSON, PDF, HTML, and Parquet. CSV and JSON can be generated client-side. XLSX should use the existing `SheetJS` or equivalent library already in the project. PDF/Parquet can call the server-side export endpoint.

Check `useAuthStore` for the current user's permissions. Import pattern: `import { useAuthStore } from '../../store/auth'` then `const { user } = useAuthStore()`.

Do NOT:
- Use the report job generation pipeline for exporting the history/schedules list — those are metadata exports, not report generation
- Disable the button when user lacks permission — spec requires hiding it
- Add the export button inside the DataTable component itself as a generic feature — add it to the module-specific page header
