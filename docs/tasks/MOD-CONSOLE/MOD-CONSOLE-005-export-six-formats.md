---
id: MOD-CONSOLE-005
title: Implement all 6 export formats and async export path for Console workspace data
unit: MOD-CONSOLE
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The Console Export button must offer all 6 formats: CSV, XLSX, PDF, JSON, Parquet, and HTML. For exports with fewer than 50,000 rows, the file downloads synchronously. For 50,000+ rows, the backend creates an async job, the UI gets a 202 response, and the WebSocket delivers an `export_complete` notification linking to a download in "My Exports." The filename must follow the `{module}_{entity}_{YYYY-MM-DD_HHmm}.{ext}` convention.

## Spec Excerpt (verbatim)

> Supported formats: **CSV, XLSX, PDF, JSON, Parquet, HTML** (6 formats). Fewer formats is wrong.
> Rows < 50,000: synchronous, file streams directly to browser. Rows >= 50,000: async job, 202 response, WebSocket `export_complete` notification.
> Filename convention: `{module}_{entity}_{YYYY-MM-DD_HHmm}.{ext}`.
> — SPEC_MANIFEST.md, CX-EXPORT non-negotiables

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/console/index.tsx` — lines 543-574: `handleExportCsv` — only CSV, no format dispatch. Lines 1065-1067: export menu only has `{ label: 'CSV', action: handleExportCsv }`.
- `frontend/src/api/exports.ts` — check if an export API client exists (this should be a shared utility).
- `frontend/src/shared/components/ExportDialog.tsx` — check if a shared export dialog component exists.

## Verification Checklist

- [ ] Export dropdown shows all 6 format options: CSV, XLSX, PDF, JSON, Parquet, HTML.
- [ ] Each format calls the correct backend export endpoint (or uses the shared ExportDialog component).
- [ ] For row count < 50,000: response triggers a file download with the correct filename pattern.
- [ ] For row count >= 50,000: UI shows async progress; WebSocket `export_complete` notification leads to a download link.
- [ ] Filename follows `console_workspace_{YYYY-MM-DD_HHmm}.{ext}` pattern.
- [ ] Current `handleExportCsv` custom filename `${activeWorkspace.name}-export.csv` is replaced with the spec convention.

## Assessment

- **Status**: ❌ Missing (5 of 6 formats)
- index.tsx:1065-1067: export menu only has CSV. handleExportCsv (lines 543-574) is a custom inline implementation with wrong filename pattern and no other formats.

## Fix Instructions

1. Check `frontend/src/api/exports.ts` — if a shared export API client exists, use it. If not, create one that calls `POST /api/exports` with `{ module: 'console', entity: 'workspace', format: string, filters: object }`.

2. Check `frontend/src/shared/components/ExportDialog.tsx` — if this exists, replace the inline export dropdown with the shared dialog.

3. Replace the export menu items in index.tsx (lines 1065-1067) with all 6 formats:
   ```typescript
   {(['CSV', 'XLSX', 'PDF', 'JSON', 'Parquet', 'HTML'] as const).map((fmt) => ({
     label: fmt,
     action: () => handleExport(fmt.toLowerCase()),
   }))}
   ```

4. Replace `handleExportCsv` with a generic `handleExport(format: string)` that:
   - Collects the active workspace's point IDs.
   - Calls `exportsApi.create({ module: 'console', entity: 'workspace', format, pointIds, workspaceId: activeWorkspace.id })`.
   - If response is 200 with a blob: trigger download with filename `console_workspace_${formatDate(new Date())}.${format.toLowerCase()}`.
   - If response is 202 (async): show a toast "Export started — you'll be notified when ready."

5. Fix the filename: use `console_workspace_${new Date().toISOString().slice(0,16).replace('T','_').replace(':','')}` not `${ws.name}-export.csv`.

Do NOT:
- Implement XLSX/PDF generation in the browser — delegate to the backend export endpoint.
- Remove the CSV path — keep it working through the same generic handler.
- Show the export button when the user lacks `console:export` permission (this is already correct — preserve it).
