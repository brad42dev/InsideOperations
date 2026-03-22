---
id: DD-32-001
title: Implement DataTable must-have features (filtering, pinning, resizing, multi-sort, sparklines, conditional formatting, export)
unit: DD-32
status: pending
priority: high
depends-on: []
---

## What This Feature Should Do

The shared DataTable must support the full set of "must-have" features listed in the spec. Currently it only implements sorting and manual virtual scroll. Seven must-have features are completely absent: per-column filtering, frozen/pinned columns, column resizing by drag, multi-column sort (Shift+click), conditional cell formatting, inline sparklines in cells, and CSV/clipboard export.

## Spec Excerpt (verbatim)

> | **Virtual scrolling** | Render only visible rows. Handles 100K+ rows without jank. | Must-have |
> | **Frozen columns** | Pin columns to left or right edge while scrolling horizontally. | Must-have |
> | **Sortable columns** | Click header for asc/desc. Multi-column sort (hold Shift + click). | Must-have |
> | **Filterable columns** | Per-column filters: text search, numeric range, enum dropdown. | Must-have |
> | **Conditional formatting** | Cell background/text color based on value. Alarm state colors. Threshold highlighting. | Must-have |
> | **Inline sparklines** | Embedded `<Sparkline />` component in table cells. | Must-have |
> | **Column resizing** | Drag column borders to resize width. | Must-have |
> | **Export** | Export visible/filtered data to CSV or clipboard. Integrates with export system. | Must-have |
> — design-docs/32_SHARED_UI_COMPONENTS.md, §Data Table Component

## Where to Look in the Codebase

Primary files:
- `frontend/src/shared/components/DataTable.tsx` — the entire table component; all changes go here
- `frontend/src/shared/graphics/displayElements/index.ts` — exports Sparkline; import from here for inline sparklines
- `frontend/src/shared/graphics/displayElements/Sparkline.tsx` — existing Sparkline display element (check its interface)

## Verification Checklist

- [ ] `DataTable.tsx` imports `getFilteredRowModel` and `ColumnFiltersState` from @tanstack/react-table and renders a filter input row below the header
- [ ] Column filter types: text search (string columns), numeric range (number columns), enum dropdown (categorical columns) — controlled by a `filterType` field on ColumnDef
- [ ] `DataTable.tsx` imports `columnPinningRowModel` or uses `getLeftPinnedColumns()` / `getRightPinnedColumns()` and renders pinned columns with sticky left/right positioning
- [ ] Column header dividers have a drag handle that updates `columnSizing` state via `onColumnSizingChange`
- [ ] Header click handler checks `event.shiftKey` and passes `isMultiSortEvent` to TanStack Table so Shift+click adds a second sort column
- [ ] `ColumnDef<T>` interface has a `conditionStyle?: (value: unknown, row: T) => React.CSSProperties` field; cell renderer applies this style when defined
- [ ] `ColumnDef<T>` has a `sparkline?: { hours: number }` field; cell renders `<Sparkline>` when this field is set
- [ ] An export toolbar button renders above or below the table; clicking it serialises visible rows to CSV and triggers download (or copies to clipboard)

## Assessment

- **Status**: ❌ Missing (all 7 features absent)
- **If partial/missing**: DataTable.tsx currently implements sorting and manual virtual scroll only. No filtering, no column pinning, no resize handles, no multi-sort, no conditional formatting API, no sparkline cell support, no export.

## Fix Instructions

1. **Multi-column sort**: In `useReactTable` config add `isMultiSortEvent: (e) => (e as MouseEvent).shiftKey`. The existing `getSortedRowModel()` already supports multi-sort; this one option enables it.

2. **Column filtering**: Add `getFilteredRowModel` import. Add `columnFilters` to state, `onColumnFiltersChange` handler. Add a `filterType?: 'text' | 'numeric' | 'enum'` field to `ColumnDef<T>`. Render a filter row below the header row with the appropriate input (text input / dual number inputs / select). Pass `column.setFilterValue()` on change.

3. **Column pinning**: Add `columnPinning` to table state. Add a `pin?: 'left' | 'right'` field to `ColumnDef<T>`. In header and cell rendering, use `column.getIsPinned()` to apply `position: sticky` with computed `left`/`right` offset from `column.getPinnedIndex()`.

4. **Column resizing**: Add `columnResizeMode: 'onChange'` to `useReactTable` config. In the header cell, render a `<div onMouseDown={header.getResizeHandler()}>` drag handle on the right edge (4px wide, `cursor: col-resize`). Apply `width: column.getSize()` to header and data cells.

5. **Conditional formatting**: Add `conditionStyle?: (value: unknown, row: T) => React.CSSProperties` to `ColumnDef<T>`. In the cell renderer block (around line 259), if `col.conditionStyle` is defined, compute the style and apply it to the cell div.

6. **Inline sparklines**: Add `sparkline?: { hours: number; color?: string }` to `ColumnDef<T>`. If set, render `<Sparkline>` (from `frontend/src/shared/graphics/displayElements/`) inside the cell. The Sparkline component needs a `pointId` prop — the cell's `accessorKey` column should return a point ID string.

7. **Export**: Add a toolbar row above the table. Include a "Export CSV" button. On click: iterate `table.getFilteredRowModel().rows`, map each row's visible cells to a string array, join with commas, add header row, create a Blob, and trigger `URL.createObjectURL` download.

Do NOT:
- Replace the existing manual virtual scroll with @tanstack/virtual unless that work is scoped separately — the existing scroll math works
- Remove the existing sort/header behaviour while adding multi-sort
- Add pagination controls at this stage — the spec lists pagination as must-have but the virtual scroll already satisfies the "no jank" requirement; add paginated mode only if a specific module requires it
