---
id: DD-14-002
title: Replace CSV-only export in index.tsx history tab with 6-format ExportButton
unit: DD-14
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The history tab inside the main Rounds page (index.tsx) must provide the same 6-format export capability (CSV, XLSX, PDF, JSON, Parquet, HTML) with `rounds:export` permission gating that the dedicated RoundHistory page already has. Currently it uses a DataTable whose built-in export toolbar only offers CSV with no permission check.

## Spec Excerpt (verbatim)

> Export button on rounds table toolbars: `[Export v]` split button
> Supported formats: CSV, XLSX, PDF, JSON (per entity; JSON only for template definitions)
> Requires `rounds:export` permission
> — 14_ROUNDS_MODULE.md, §Data Export

> Every qualifying module table/toolbar has an Export button. It is not buried in a menu.
> Export button is hidden (not disabled) when user lacks `<module>:export` permission.
> — docs/SPEC_MANIFEST.md, §CX-EXPORT Non-negotiables 1 & 5

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/rounds/index.tsx` — line 471-479, the history tab renders `<DataTable>` with default `showExport={true}` which triggers a CSV-only toolbar
- `frontend/src/shared/components/DataTable.tsx` — line 383-396, the built-in "Export CSV" button has no permission check and is CSV only
- `frontend/src/pages/rounds/RoundHistory.tsx` — the standalone history page (line 82-91) correctly uses `ExportButton` from ExportDialog with permission gating — use this as the reference implementation

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] The history tab in index.tsx (line 471-479) passes `showExport={false}` to DataTable to suppress the built-in CSV toolbar
- [ ] An `ExportButton` from `../../shared/components/ExportDialog` is rendered alongside or above the DataTable in the history tab
- [ ] ExportButton is configured with `module="rounds"`, `entity="Round History"`, and the history columns/filters
- [ ] ExportButton is hidden when user lacks `rounds:export` permission (handled automatically by ExportButton's internal permission check)
- [ ] The 6 formats (CSV, XLSX, PDF, JSON, Parquet, HTML) are available via the ExportButton

## Assessment

After checking:
- **Status**: ⚠️ Wrong
- **What's wrong**: index.tsx line 471 uses `<DataTable data={historyEntries} ...>` without `showExport={false}`, causing DataTable's built-in CSV-only "Export CSV" button to appear (DataTable.tsx:383-396). That button has no permission check and offers only CSV. The standalone RoundHistory page already has the correct implementation.

## Fix Instructions (if needed)

In `frontend/src/pages/rounds/index.tsx`:

1. Add `showExport={false}` to the DataTable in the history tab (line 471):
   ```tsx
   <DataTable
     data={historyEntries}
     columns={historyColumns}
     height={600}
     loading={loadingHistory}
     emptyMessage="No completed rounds."
     onRowClick={(row) => navigate(`/rounds/${row.id}`)}
     showExport={false}
   />
   ```

2. Import `ExportButton` from the shared component (it's already imported in RoundHistory.tsx — same import path):
   ```tsx
   import { ExportButton } from '../../shared/components/ExportDialog'
   ```

3. Add the ExportButton above or in a toolbar row above the DataTable, inside the history tab block:
   ```tsx
   {tab === 'history' && (
     <>
       <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
         <ExportButton
           module="rounds"
           entity="Round History"
           filteredRowCount={historyEntries.length}
           totalRowCount={historyEntries.length}
           availableColumns={historyColumns.map(c => ({ id: c.id, label: c.header }))}
           visibleColumns={historyColumns.map(c => c.id)}
         />
       </div>
       <DataTable ... showExport={false} />
     </>
   )}
   ```

Do NOT:
- Remove ExportButton from the standalone RoundHistory.tsx page — it should remain there
- Add a permission check manually — ExportButton handles `rounds:export` permission gating internally
