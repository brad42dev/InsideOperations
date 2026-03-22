---
id: MOD-CONSOLE-002
title: Implement 6-format export (CSV, XLSX, PDF, JSON, Parquet, HTML) for Console workspace
unit: MOD-CONSOLE
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The Console Export button must offer all 6 formats: CSV, XLSX, PDF, JSON, Parquet, and HTML. Exports under 50,000 rows stream directly to the browser. Exports at or above 50,000 rows submit an async job and notify via WebSocket `export_complete` event. The filename must follow the convention `console_workspace_{YYYY-MM-DD_HHmm}.{ext}`. Currently only CSV is implemented.

## Spec Excerpt (verbatim)

> Supported formats: CSV, XLSX, PDF, JSON, Parquet, HTML (6 formats). Fewer formats is wrong.
> Rows < 50,000: synchronous, file streams directly to browser. Rows ≥ 50,000: async job, 202 response, WebSocket `export_complete` notification.
> Filename convention: `{module}_{entity}_{YYYY-MM-DD_HHmm}.{ext}`.
> — docs/SPEC_MANIFEST.md, CX-EXPORT non-negotiables

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/console/index.tsx` — lines 543–574: `handleExportCsv` (CSV only, wrong filename, no format choice)
- `frontend/src/pages/console/index.tsx` — lines 1065–1079: export dropdown with single item
- `frontend/src/api/exports.ts` — shared export API client (if it exists, check for multi-format support)
- `frontend/src/shared/components/ExportDialog.tsx` — may be a shared export component to use

## Verification Checklist

- [ ] Export dropdown shows all 6 format options: CSV, XLSX, PDF, JSON, Parquet, HTML
- [ ] Each format option calls the correct export endpoint or shared export function
- [ ] Filename produced is `console_workspace_{YYYY-MM-DD_HHmm}.{ext}` (e.g., `console_workspace_2026-03-21_1430.csv`)
- [ ] Exports for all pane types (graphic point values, trend data, table data) are included — not only `trendPointIds`
- [ ] Large export (>=50,000 rows) shows async progress path (202 response → WebSocket `export_complete` toast)

## Assessment

- **Status**: ❌ Missing (partial — CSV exists but wrong format and wrong filename)
- `index.tsx:1065-1079` — only one export format in the array: `{ label: 'CSV', action: handleExportCsv }`
- `index.tsx:569` — filename: `${activeWorkspace.name}-export.csv` — violates naming convention
- `index.tsx:548-552` — only collects `trendPointIds`; graphic pane point IDs are not included

## Fix Instructions

**Step 1 — Check `frontend/src/api/exports.ts` and `frontend/src/shared/components/ExportDialog.tsx`.** If the shared export dialog already implements multi-format support, use it instead of the inline export dropdown.

**Step 2 — Expand the export dropdown items in `index.tsx` around line 1065:**
```typescript
const EXPORT_FORMATS = [
  { label: 'CSV', ext: 'csv', contentType: 'text/csv' },
  { label: 'XLSX', ext: 'xlsx', contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  { label: 'JSON', ext: 'json', contentType: 'application/json' },
  { label: 'PDF', ext: 'pdf', contentType: 'application/pdf' },
  { label: 'Parquet', ext: 'parquet', contentType: 'application/octet-stream' },
  { label: 'HTML', ext: 'html', contentType: 'text/html' },
]
```

**Step 3 — Fix filename convention.** Replace:
```typescript
a.download = `${activeWorkspace.name ?? 'console'}-export.csv`
```
With a helper that produces the spec-compliant name:
```typescript
function exportFilename(ext: string): string {
  const now = new Date()
  const datePart = now.toISOString().slice(0, 10)
  const timePart = now.toTimeString().slice(0, 5).replace(':', '')
  return `console_workspace_${datePart}_${timePart}.${ext}`
}
```

**Step 4 — Collect all point IDs from all pane types**, not only `trendPointIds`:
```typescript
for (const pane of activeWorkspace.panes) {
  if (pane.type === 'trend' && pane.trendConfig?.pointIds) pointIds.push(...pane.trendConfig.pointIds)
  if (pane.type === 'table' && pane.tableConfig?.pointIds) pointIds.push(...pane.tableConfig.pointIds)
  // Graphic pane points come from RealtimeStore.subscribedPointCount (already subscribed)
}
```

**Step 5 — Add async export path.** For exports expected to exceed 50,000 rows (rarely in Console), call the server-side export endpoint that returns 202 and sends `export_complete` via WebSocket. The `wsWorkerConnector` already handles `export_complete` in `useWsWorker.ts:165-183`.

Do NOT:
- Remove the export permission gate at `index.tsx:1036` — it must remain
- Use AGPL libraries for XLSX/Parquet generation (check license before adding any dependency)
- Show the export dropdown when the user lacks `console:export` permission
