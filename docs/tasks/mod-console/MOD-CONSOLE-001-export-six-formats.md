---
id: MOD-CONSOLE-001
title: Add 5 missing export formats (XLSX, PDF, JSON, Parquet, HTML) to Console export
unit: MOD-CONSOLE
status: pending
priority: high
depends-on: []
---

## What This Feature Should Do

The Console Export button currently only offers CSV. Users need to export workspace point values in all 6 formats specified by CX-EXPORT: CSV, XLSX, PDF, JSON, Parquet, and HTML. The export must route large datasets (≥50,000 rows) through an async job that returns a 202 response and notifies via WebSocket. Filenames must follow the convention `console_{entity}_{YYYY-MM-DD_HHmm}.{ext}`.

## Spec Excerpt (verbatim)

> Supported formats: **CSV, XLSX, PDF, JSON, Parquet, HTML** (6 formats). Fewer formats is wrong.
> Rows < 50,000: synchronous, file streams directly to browser. Rows ≥ 50,000: async job, 202 response, WebSocket `export_complete` notification → "My Exports" download link.
> Filename convention: `{module}_{entity}_{YYYY-MM-DD_HHmm}.{ext}`.
> — SPEC_MANIFEST.md, §CX-EXPORT Non-negotiables

> The workspace toolbar contains an `[Export]` split button:
> Left click: opens full export dialog
> Dropdown arrow: quick-format options (CSV, PDF, XLSX)
> — console-implementation-spec.md, §10.1

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/console/index.tsx` — lines 567-598 contain `handleExportCsv`; lines 1059-1108 contain the export button and dropdown format list
- `frontend/src/api/exports.ts` (if it exists) — backend export API client
- `frontend/src/shared/components/ExportDialog.tsx` (if it exists) — shared export dialog component

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] Export dropdown contains all 6 format options: CSV, XLSX, PDF, JSON, Parquet, HTML
- [ ] Clicking a format triggers the correct handler (CSV for small sets = synchronous blob; others may use ExportDialog)
- [ ] Filename follows `console_workspace_{YYYY-MM-DD_HHmm}.{ext}` pattern (not `{workspace.name}-export.csv`)
- [ ] Row count check exists: if ≥50,000 rows, route to async job (POST to `/api/export/jobs`) rather than synchronous blob
- [ ] Export button correctly hidden (not disabled) when user lacks `console:export` permission
- [ ] `handleExportCsv` collects point IDs from ALL pane types (graphic panes, trend panes, table panes) — not just `trendPointIds`

## Assessment

Current state: only CSV is offered (`index.tsx:1089-1091` — single-item array `[{ label: 'CSV', action: handleExportCsv }]`). The `handleExportCsv` handler only reads `pane.trendPointIds`, missing graphic pane bindings. No async export path exists. Filename uses workspace name not the spec convention.

## Fix Instructions

1. In `frontend/src/pages/console/index.tsx`, replace the single-item format array (line 1089-1091) with all 6 formats:
   ```
   { label: 'CSV', action: () => handleExport('csv') },
   { label: 'XLSX', action: () => handleExport('xlsx') },
   { label: 'JSON', action: () => handleExport('json') },
   { label: 'PDF', action: () => handleExport('pdf') },
   { label: 'Parquet', action: () => handleExport('parquet') },
   { label: 'HTML', action: () => handleExport('html') },
   ```

2. Replace `handleExportCsv` with a generic `handleExport(format)` that:
   - Collects point IDs from ALL pane types: graphic panes (via `pointsApi.byGraphicId(pane.graphicId)`), trend panes (`pane.trendPointIds`), table panes (`pane.tablePointIds`)
   - Builds filename: `console_workspace_${formatDate(new Date())}.${format}` where `formatDate` returns `YYYY-MM-DD_HHmm`
   - If estimated row count < 50,000: synchronous — `POST /api/export` with `{ format, pointIds, mode: 'sync' }`, stream response as blob download
   - If estimated row count ≥ 50,000: async — `POST /api/export/jobs` with `{ format, pointIds }`, receive `jobId`, listen on WebSocket for `export_complete` event

3. Check `frontend/src/api/exports.ts` for existing export API helpers; if present, use them rather than writing raw fetch calls.

Do NOT:
- Remove the permission check (`canExport && (`)
- Change the export button visibility from hidden to disabled
- Make synchronous calls for large datasets that would hang the browser
