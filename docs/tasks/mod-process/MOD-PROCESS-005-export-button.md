---
id: MOD-PROCESS-005
title: Add Export button and 6-format export to Process toolbar
unit: MOD-PROCESS
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

The Process module view toolbar must have an Export split button that exports the currently visible graphic's point values. It supports 6 formats: CSV, XLSX, PDF, JSON, Parquet, HTML. For fewer than 50,000 rows the export is synchronous (file streams to browser). For 50,000+ rows it is async with a WebSocket notification. The button is hidden entirely (not disabled) when the user lacks `process:export` permission.

## Spec Excerpt (verbatim)

> Every qualifying module table/toolbar has an **Export button**. It is not buried in a menu.
>
> Supported formats: **CSV, XLSX, PDF, JSON, Parquet, HTML** (6 formats). Fewer formats is wrong.
>
> Export button is hidden (not disabled) when user lacks `<module>:export` permission.
>
> | Module | What gets exported | Permission |
> |--------|--------------------|------------|
> | Process | Visible point values + graphic data | `process:export` |
> — SPEC_MANIFEST.md §CX-EXPORT

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/process/index.tsx:1036-1138` — view toolbar JSX; no Export button present
- `frontend/src/shared/components/DataTable.tsx` — may have export utilities to reuse
- `frontend/src/api/graphics.ts` — graphic data API

## Verification Checklist

- [ ] Export split button `[Export ▾]` appears in the toolbar between Historical toggle and Print button.
- [ ] Dropdown lists all 6 formats: CSV, XLSX, PDF, JSON, Parquet, HTML.
- [ ] Export payload includes currently visible point values (from `pointValues` Map) + graphic metadata.
- [ ] Export filename follows convention: `process_graphic_{YYYY-MM-DD_HHmm}.{ext}`.
- [ ] Export button is hidden entirely when user lacks `process:export` permission (checked via `useAuthStore`).
- [ ] Large exports (≥50,000 rows) trigger async job with 202 response + WebSocket notification.

## Assessment

- **Status**: ❌ Missing
- The entire Export feature is absent from the Process module. The toolbar at `index.tsx:1036-1138` has zoom controls, live/historical toggle, bookmark, and fullscreen — no Export button.

## Fix Instructions

In `frontend/src/pages/process/index.tsx`:

1. Import `useAuthStore` and check `process:export` permission:
```typescript
const { user } = useAuthStore()
const canExport = user?.permissions?.includes('process:export') ?? false
```

2. Add an export state and handler:
```typescript
const [exportMenuOpen, setExportMenuOpen] = useState(false)

function handleExport(format: 'csv' | 'xlsx' | 'pdf' | 'json' | 'parquet' | 'html') {
  // Collect visible point values from the pointValues Map
  const rows = Array.from(pointValues.entries()).map(([id, pv]) => ({ pointId: id, ...pv }))
  const filename = `process_graphic_${new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', '')}.${format}`
  // Call export API — same pattern as Console export
  // For <50K rows: synchronous download; for >=50K: POST to export API and show async notification
  setExportMenuOpen(false)
}
```

3. Add the export button to the toolbar (inside the right group, before fullscreen):
```tsx
{canExport && (
  <div style={{ position: 'relative' }}>
    <button
      onClick={() => setExportMenuOpen((v) => !v)}
      style={toolbarBtnStyle}
      title="Export visible point values"
    >
      Export ▾
    </button>
    {exportMenuOpen && (
      <div style={{ position: 'absolute', bottom: '100%', right: 0, /* dropdown styles */ }}>
        {(['csv', 'xlsx', 'pdf', 'json', 'parquet', 'html'] as const).map(fmt => (
          <button key={fmt} onClick={() => handleExport(fmt)}>{fmt.toUpperCase()}</button>
        ))}
      </div>
    )}
  </div>
)}
```

Do NOT:
- Disable the button when user lacks permission — hide it entirely.
- Offer fewer than 6 formats.
- Export all points in the graphic — export only the currently subscribed/visible point values (the `pointValues` Map).
