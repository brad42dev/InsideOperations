---
id: DD-10-001
title: Add PDF and HTML export formats to widget and list export
unit: DD-10
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The export dialog for widget data and the dashboard list toolbar export both need to support 6 formats: CSV, XLSX, PDF, JSON, Parquet, and HTML. Currently both paths are missing PDF and HTML. Any export initiated by a user should offer all 6 format choices.

## Spec Excerpt (verbatim)

> "Supported formats: CSV, XLSX, PDF, JSON, Parquet (per widget); JSON (dashboard definition)"
> — design-docs/10_DASHBOARDS_MODULE.md, §Data Export

> "Supported formats: CSV, XLSX, PDF, JSON, Parquet, HTML (6 formats). Fewer formats is wrong."
> — docs/SPEC_MANIFEST.md, §CX-EXPORT Non-negotiables #3

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/dashboards/widgets/ExportDataDialog.tsx` — FORMAT_OPTIONS array at lines 7–14 defines the 4 current formats; POST to `/api/v1/export/widget`
- `frontend/src/pages/dashboards/index.tsx` — `handleExport` function at lines 396–466 handles list-level export (json, csv, xlsx only)

## Verification Checklist

- [ ] `ExportDataDialog.tsx` FORMAT_OPTIONS contains exactly 6 entries: csv, xlsx, pdf, json, parquet, html
- [ ] Selecting PDF in widget export dialog sends format: 'pdf' to `/api/v1/export/widget`
- [ ] Selecting HTML in widget export dialog sends format: 'html' to `/api/v1/export/widget`
- [ ] `index.tsx` `handleExport` function accepts 'pdf' and 'html' as format arguments and calls the server export endpoint (not a client-side blob)
- [ ] Dashboard list toolbar export dropdown shows PDF and HTML options

## Assessment

- **Status**: ⚠️ Partial — 4 of 6 formats present in widget export dialog; list export supports 3 of 6

## Fix Instructions

In `frontend/src/pages/dashboards/widgets/ExportDataDialog.tsx`:

1. Change the `ExportFormat` type at line 7 from `'csv' | 'xlsx' | 'json' | 'parquet'` to include `'pdf' | 'html'`.
2. Append two entries to `FORMAT_OPTIONS` (lines 9–14):
   ```
   { value: 'pdf', label: 'PDF (.pdf)' },
   { value: 'html', label: 'HTML (.html)' },
   ```
3. The `handleDownload` function already POSTs `format` to `/api/v1/export/widget` — no changes needed there as long as the type is extended.

In `frontend/src/pages/dashboards/index.tsx`:

1. Extend the `handleExport` function signature (line 396) to accept `'pdf' | 'html'` in addition to the current union.
2. For 'pdf' and 'html' formats, call the server endpoint `/api/v1/export/dashboards` (same as the JSON path) with `format: 'pdf'` or `format: 'html'` rather than generating a client-side blob. Follow the same fetch-then-blob pattern already used for JSON at lines 402–416.
3. Add 'PDF' and 'HTML' buttons to the export dropdown rendered at lines 583–607.

Do NOT:
- Generate PDF client-side in the browser — PDF must go through the server export endpoint.
- Add HTML as a format for the "Definition" section — that section is JSON-only per the spec (dashboard JSONB definition).
