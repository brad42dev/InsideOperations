---
id: DD-25-002
title: Implement shared ExportDialog component and wire to qualifying module tables
unit: DD-25
status: pending
priority: high
depends-on: [DD-25-001]
---

## What This Feature Should Do

Every data table in the application (Settings > Points, Users, etc.; Log entries; Rounds results; etc.) has a split Export button in its toolbar. Clicking it opens a shared ExportDialog that shows the row count, allows scope selection (filtered view vs all), format selection (6 formats), column picker (pre-seeded from current visible columns), and a 5-row preview. For large exports (>=50K rows), the button text changes to "Start Export" and shows a confirmation before queuing. The dialog POST to `/api/exports`.

## Spec Excerpt (verbatim)

> The [Export v] is a split button: Left click: Opens the full Export Dialog. Dropdown arrow: Quick-format picker (CSV, XLSX, PDF, JSON, Parquet) that exports immediately with current settings.
>
> Filter Inheritance: The dialog pre-populates with the current view's state: Scope defaults to "Current filtered view". Column checkboxes default to currently visible columns. Sort order carries through to the exported file.
>
> If estimated rows >= 50,000: Button text changes to [Start Export]. Clicking shows a confirmation: "This export contains ~142,000 rows and will be generated in the background. You'll be notified when it's ready."
— design-docs/25_EXPORT_SYSTEM.md, §4.1, §4.2, §4.3

## Where to Look in the Codebase

Primary files:
- `frontend/src/shared/components/` — create `ExportDialog.tsx` here; no file exists yet
- `frontend/src/pages/settings/PointManagement.tsx` — first table to wire the button to (high-value target: `points_metadata`)
- `frontend/src/pages/settings/Users.tsx` — second table target
- `frontend/src/api/` — create `exports.ts` API client for `/api/exports`; currently absent

## Verification Checklist

- [ ] `ExportDialog.tsx` exists in `frontend/src/shared/components/`
- [ ] Dialog accepts props: `module`, `entity`, `filteredRowCount`, `totalRowCount`, `activeFilters`, `visibleColumns`, `sortField`, `sortOrder`
- [ ] All 6 formats selectable: CSV, XLSX, PDF, JSON, Parquet, HTML
- [ ] Column picker shows all available columns; pre-checks currently visible columns
- [ ] 5-row preview table renders and refreshes when scope or columns change
- [ ] Rows < 50K: Export button triggers sync download, shows progress "Exporting... 67%" then "Exported!" briefly
- [ ] Rows >= 50K: Button says "Start Export", click shows async confirmation before queuing
- [ ] Export button hidden (not disabled) when user lacks `<module>:export` permission
- [ ] Split button dropdown offers quick-format export (CSV, XLSX, PDF, JSON, Parquet)
- [ ] At least PointManagement.tsx and Users.tsx have the Export button wired

## Assessment

- **Status**: ❌ Missing
- **If partial/missing**: No `ExportDialog` component exists anywhere in `frontend/src/`. The only export-related dialog is `IographicExportDialog.tsx` in the Designer, which exports `.iographic` packages (different system). No export button exists in any settings table.

## Fix Instructions (if needed)

1. Create `frontend/src/shared/components/ExportDialog.tsx`. Props interface:
   ```typescript
   interface ExportDialogProps {
     open: boolean
     onClose: () => void
     module: string         // e.g. "settings"
     entity: string         // e.g. "points"
     filteredRowCount: number
     totalRowCount: number
     activeFilters: Record<string, unknown>
     availableColumns: { id: string; label: string }[]
     visibleColumns: string[]
     sortField?: string
     sortOrder?: 'asc' | 'desc'
   }
   ```

2. Create `frontend/src/api/exports.ts` with `exportsApi.create(params)` that POSTs to `/api/exports`. For sync responses (200), trigger a file download via URL blob or `Content-Disposition` redirect. For async responses (202), show toast directing user to My Exports.

3. The split button (ExportButton): left side opens dialog; right chevron opens a dropdown with CSV, XLSX, PDF, JSON, Parquet that each call `exportsApi.create(...)` directly with current filters/sort.

4. Wire `ExportButton` into `PointManagement.tsx`, `Users.tsx` tables as priority targets.

5. Permission check: read user permissions from the auth store. If `${module}:export` is absent, do not render the ExportButton at all (hidden, not disabled).

6. Format-specific options per §4.3: CSV shows delimiter and BOM options; XLSX shows metadata sheet option; PDF shows orientation, page size, watermark toggle; JSON shows pretty-print option; Parquet shows compression (Snappy/Zstd).

Do NOT:
- Implement a per-module custom export dialog — one shared `ExportDialog` component used everywhere.
- Disable the button when permission is missing — hide it entirely per §4.3 and CX-EXPORT non-negotiable #5.
- Export all rows by default — default scope is "Current filtered view".
