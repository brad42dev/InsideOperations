---
id: DD-13-006
title: Add Export split button to log entry table toolbar (CX-EXPORT)
unit: DD-13
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The log module's completed log instances table must have an `[Export v]` split button in the toolbar. Clicking the main part triggers the default format (CSV); the dropdown chevron reveals all 6 export formats. The button is hidden for users without `log:export` permission.

## Spec Excerpt (verbatim)

> Export button on log entry table toolbar: `[Export v]` split button
> Exportable entities: log entries (filtered), single log entry with formatting (PDF/HTML), log templates
> Log entries export: rich text stripped to plain text for CSV/XLSX; PDF/HTML preserve WYSIWYG formatting
> Supported formats: CSV, XLSX, PDF, JSON (entries); PDF, HTML (single entry with formatting)
> Requires `log:export` permission
> — design-docs/13_LOG_MODULE.md, §Data Export

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/log/index.tsx:295-382` — `CompletedTable` component where the export button must appear
- `frontend/src/pages/log/index.tsx:390-394` — `LogPage` where `isAdmin` check lives; `log:export` check needed
- `frontend/src/store/auth.ts` — `useAuthStore` for permission check pattern

## Verification Checklist

- [ ] A split button `[Export v]` appears in the toolbar above `CompletedTable`
- [ ] The button is hidden (not disabled) when `user?.permissions` does not include `log:export`
- [ ] Clicking the main part triggers CSV export
- [ ] The dropdown lists: CSV, XLSX, PDF, JSON (for filtered entries), plus PDF and HTML (for single entry)
- [ ] The export calls hit the export API or triggers a download (coordinate with the CX-EXPORT / doc 25 export system)
- [ ] When `completedData` is empty, the export button is hidden or shows a tooltip "No entries to export"

## Assessment

- **Status**: ❌ Missing
- `index.tsx:295-382` (`CompletedTable`) has no toolbar — it goes directly to a `<table>` with no header action area
- `index.tsx:297-382` — no export button anywhere in the component
- No `log:export` permission check exists anywhere in the log module

## Fix Instructions

1. Add a toolbar row above the `<table>` in `CompletedTable` (after line 305):
   ```tsx
   {/* Export toolbar */}
   {hasExport && instances.length > 0 && (
     <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 16px', borderBottom: '1px solid var(--io-border)' }}>
       <ExportSplitButton
         formats={['CSV', 'XLSX', 'PDF', 'JSON']}
         onExport={(format) => handleExport(format)}
       />
     </div>
   )}
   ```

2. The `hasExport` prop should be passed from `LogPage` where the permission check lives:
   ```tsx
   const hasExport = user?.permissions.includes('log:export') || user?.permissions.includes('*')
   ```

3. The `ExportSplitButton` should follow the shared pattern from CX-EXPORT — check if a shared component exists under `frontend/src/shared/components/`. If not, implement a minimal split button:
   - Left portion: primary action button labeled "Export"
   - Right portion: chevron `v` opens a dropdown with format options
   - Each option triggers the appropriate export endpoint

4. Export endpoint: POST to `/api/logs/instances/export` (or follow doc 25 conventions) with `{ format, filters: currentFilters }`. Coordinate with the export system for the actual download mechanism.

Do NOT:
- Disable the button instead of hiding it (CX-RBAC requires hidden, not disabled)
- Show the export button when the user lacks `log:export`
- Implement a custom export that bypasses the shared export system described in doc 25
