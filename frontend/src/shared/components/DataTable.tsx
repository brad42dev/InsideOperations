import { useRef, useState, useEffect, useCallback } from 'react'
import { useDensity } from '../theme/ThemeContext'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type SortingState,
  type ColumnFiltersState,
  type ColumnPinningState,
  type ColumnSizingState,
  type ColumnDef as TanstackColumnDef,
  type FilterFn,
} from '@tanstack/react-table'

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface ColumnDef<T> {
  id: string
  header: string
  accessorKey?: keyof T
  cell?: (value: unknown, row: T) => React.ReactNode
  width?: number
  minWidth?: number
  sortable?: boolean
  /** Filter type for the column filter row */
  filterType?: 'text' | 'numeric' | 'enum'
  /** Enum options for 'enum' filterType */
  filterOptions?: string[]
  /** Pin this column to left or right */
  pin?: 'left' | 'right'
  /** Conditional cell style based on value and row */
  conditionStyle?: (value: unknown, row: T) => React.CSSProperties
  /** Show an inline sparkline in the cell. The accessorKey should return a point ID. */
  sparkline?: { hours: number; color?: string }
}

export interface DataTableProps<T extends object> {
  data: T[]
  columns: ColumnDef<T>[]
  height?: number
  rowHeight?: number
  onRowClick?: (row: T) => void
  loading?: boolean
  emptyMessage?: string
  /** Show the export toolbar (default: true) */
  showExport?: boolean
}

// ---------------------------------------------------------------------------
// Inline sparkline for table cells (HTML SVG, not the canvas SVG element)
// ---------------------------------------------------------------------------

function InlineSparkline({
  values,
  color = '#A1A1AA',
  width = 80,
  height = 20,
}: {
  values: number[]
  color?: string
  width?: number
  height?: number
}) {
  const W = width
  const H = height

  let pointsStr = ''
  if (values.length >= 2) {
    const min = Math.min(...values)
    const max = Math.max(...values)
    const range = max - min || 1
    const step = (W - 6) / (values.length - 1)
    pointsStr = values
      .map((v, i) => {
        const px = 3 + i * step
        const py = 2 + (1 - (v - min) / range) * (H - 4)
        return `${px.toFixed(1)},${py.toFixed(1)}`
      })
      .join(' ')
  } else {
    pointsStr = `3,${H / 2} ${W - 3},${H / 2}`
  }

  return (
    <svg
      width={W}
      height={H}
      style={{ display: 'block', borderRadius: 2, background: '#1C1C1F' }}
      aria-hidden="true"
    >
      <polyline
        points={pointsStr}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Skeleton row for loading state
// ---------------------------------------------------------------------------

function SkeletonRow({ columnCount, rowHeight }: { columnCount: number; rowHeight: number }) {
  return (
    <div
      style={{
        display: 'flex',
        height: rowHeight,
        borderBottom: '1px solid var(--io-border)',
        alignItems: 'center',
        gap: 0,
      }}
    >
      {Array.from({ length: columnCount }).map((_, i) => (
        <div
          key={i}
          style={{
            flex: 1,
            padding: '0 12px',
          }}
        >
          <div
            style={{
              height: 12,
              borderRadius: 4,
              background: 'var(--io-surface-secondary)',
              width: `${50 + (i % 3) * 20}%`,
              animation: 'io-skeleton-pulse 1.5s ease-in-out infinite',
            }}
          />
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Filter types
// ---------------------------------------------------------------------------

const textFilterFn: FilterFn<unknown> = (row, columnId, filterValue: string) => {
  const val = row.getValue(columnId)
  if (val == null) return false
  return String(val).toLowerCase().includes(filterValue.toLowerCase())
}
textFilterFn.autoRemove = (v: string) => !v

const numericRangeFilterFn: FilterFn<unknown> = (
  row,
  columnId,
  filterValue: [number | '', number | ''],
) => {
  const val = row.getValue(columnId)
  const num = Number(val)
  if (isNaN(num)) return false
  const [min, max] = filterValue
  if (min !== '' && num < Number(min)) return false
  if (max !== '' && num > Number(max)) return false
  return true
}
numericRangeFilterFn.autoRemove = (v: [number | '', number | '']) => v[0] === '' && v[1] === ''

const enumFilterFn: FilterFn<unknown> = (row, columnId, filterValue: string) => {
  if (!filterValue) return true
  return String(row.getValue(columnId)) === filterValue
}
enumFilterFn.autoRemove = (v: string) => !v

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

const VIRTUAL_BUFFER = 5
const RESIZE_HANDLE_WIDTH = 4
const HEADER_HEIGHT = 36
const FILTER_ROW_HEIGHT = 32
const TOOLBAR_HEIGHT = 36

export default function DataTable<T extends object>({
  data,
  columns,
  height = 400,
  rowHeight,
  onRowClick,
  loading = false,
  emptyMessage = 'No data available',
  showExport = true,
}: DataTableProps<T>) {
  const density = useDensity()
  const densityRowHeight = density === 'compact' ? 28 : density === 'comfortable' ? 44 : 36
  const resolvedRowHeight = rowHeight ?? densityRowHeight

  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [columnPinning] = useState<ColumnPinningState>({
    left: columns.filter((c) => c.pin === 'left').map((c) => c.id),
    right: columns.filter((c) => c.pin === 'right').map((c) => c.id),
  })
  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({})
  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)

  // Determine if any column has a filter type so we show the filter row
  const hasFilters = columns.some((c) => c.filterType)

  const tanstackColumns: TanstackColumnDef<T>[] = columns.map((col) => {
    let filterFn: FilterFn<T> | undefined = undefined
    if (col.filterType === 'text') filterFn = textFilterFn as FilterFn<T>
    else if (col.filterType === 'numeric') filterFn = numericRangeFilterFn as FilterFn<T>
    else if (col.filterType === 'enum') filterFn = enumFilterFn as FilterFn<T>

    return {
      id: col.id,
      header: col.header,
      accessorKey: col.accessorKey as string | undefined,
      enableSorting: col.sortable ?? false,
      enableColumnFilter: !!col.filterType,
      filterFn: filterFn as FilterFn<T> | undefined,
      cell: col.cell
        ? (info) => col.cell!(info.getValue(), info.row.original)
        : undefined,
      size: col.width ?? 150,
      minSize: col.minWidth ?? 60,
    }
  })

  const table = useReactTable({
    data,
    columns: tanstackColumns,
    state: { sorting, columnFilters, columnPinning, columnSizing },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnSizingChange: setColumnSizing,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    columnResizeMode: 'onChange',
    isMultiSortEvent: (e) => (e as MouseEvent).shiftKey,
  })

  const rows = table.getRowModel().rows
  const totalHeight = rows.length * resolvedRowHeight
  const toolbarH = showExport ? TOOLBAR_HEIGHT : 0
  const filterRowH = hasFilters ? FILTER_ROW_HEIGHT : 0
  const fixedTop = HEADER_HEIGHT + filterRowH + toolbarH
  const visibleHeight = height - fixedTop

  const startIndex = Math.max(0, Math.floor(scrollTop / resolvedRowHeight) - VIRTUAL_BUFFER)
  const endIndex = Math.min(
    rows.length,
    Math.ceil((scrollTop + visibleHeight) / resolvedRowHeight) + VIRTUAL_BUFFER,
  )
  const visibleRows = rows.slice(startIndex, endIndex)
  const paddingTop = startIndex * resolvedRowHeight
  const paddingBottom = (rows.length - endIndex) * resolvedRowHeight

  const handleScroll = useCallback(() => {
    if (scrollRef.current) {
      setScrollTop(scrollRef.current.scrollTop)
    }
  }, [])

  useEffect(() => {
    if (scrollRef.current) setScrollTop(scrollRef.current.scrollTop)
  }, [data])

  // Compute pinned offsets for sticky columns
  const headerGroups = table.getHeaderGroups()

  function getPinnedStyle(
    columnId: string,
    isPinned: false | 'left' | 'right',
    colSizeMap: Record<string, number>,
  ): React.CSSProperties {
    if (!isPinned) return {}

    if (isPinned === 'left') {
      const leftCols = table.getLeftLeafColumns()
      const idx = leftCols.findIndex((c) => c.id === columnId)
      const offset = leftCols.slice(0, idx).reduce((sum, c) => sum + (colSizeMap[c.id] ?? 150), 0)
      return {
        position: 'sticky',
        left: offset,
        zIndex: 2,
        background: 'var(--io-surface-secondary)',
      }
    }

    if (isPinned === 'right') {
      const rightCols = [...table.getRightLeafColumns()].reverse()
      const idx = rightCols.findIndex((c) => c.id === columnId)
      const offset = rightCols.slice(0, idx).reduce((sum, c) => sum + (colSizeMap[c.id] ?? 150), 0)
      return {
        position: 'sticky',
        right: offset,
        zIndex: 2,
        background: 'var(--io-surface-secondary)',
      }
    }

    return {}
  }

  // Build a size map from current columnSizing + defaults
  function buildColSizeMap(): Record<string, number> {
    const map: Record<string, number> = {}
    columns.forEach((col) => {
      map[col.id] = columnSizing[col.id] ?? col.width ?? 150
    })
    return map
  }

  // Export to CSV
  function handleExportCSV() {
    const filteredRows = table.getFilteredRowModel().rows
    const visibleCols = table.getVisibleLeafColumns()

    const headerRow = visibleCols.map((col) => {
      const colDef = columns.find((c) => c.id === col.id)
      return `"${(colDef?.header ?? col.id).replace(/"/g, '""')}"`
    })

    const dataRows = filteredRows.map((row) =>
      visibleCols.map((col) => {
        const val = row.getValue(col.id)
        if (val == null) return '""'
        return `"${String(val).replace(/"/g, '""')}"`
      }),
    )

    const csv = [headerRow, ...dataRows].map((r) => r.join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'table-export.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const colSizeMap = buildColSizeMap()

  return (
    <div
      style={{
        height,
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid var(--io-border)',
        borderRadius: '6px',
        overflow: 'hidden',
        background: 'var(--io-surface-primary, var(--io-surface))',
        fontSize: '13px',
        color: 'var(--io-text-primary)',
      }}
    >
      {/* Export toolbar */}
      {showExport && (
        <div
          style={{
            flexShrink: 0,
            height: TOOLBAR_HEIGHT,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            padding: '0 12px',
            borderBottom: '1px solid var(--io-border)',
            background: 'var(--io-surface-secondary)',
            gap: 8,
          }}
        >
          <span style={{ flex: 1, fontSize: '12px', color: 'var(--io-text-muted)' }}>
            {table.getFilteredRowModel().rows.length} rows
          </span>
          <button
            onClick={handleExportCSV}
            style={{
              padding: '4px 10px',
              fontSize: '12px',
              border: '1px solid var(--io-border)',
              borderRadius: 4,
              background: 'transparent',
              color: 'var(--io-text-primary)',
              cursor: 'pointer',
            }}
          >
            Export CSV
          </button>
        </div>
      )}

      {/* Sticky header area */}
      <div
        style={{
          flexShrink: 0,
          background: 'var(--io-surface-secondary)',
          borderBottom: '1px solid var(--io-border)',
          overflowX: 'hidden',
        }}
      >
        {/* Header row */}
        {headerGroups.map((hg) => (
          <div
            key={hg.id}
            style={{ display: 'flex', height: HEADER_HEIGHT, alignItems: 'center', position: 'relative' }}
          >
            {hg.headers.map((header) => {
              const col = columns.find((c) => c.id === header.id)
              const isSortable = col?.sortable ?? false
              const sortDir = header.column.getIsSorted()
              const isPinned = header.column.getIsPinned()
              const colSize = header.column.getSize()
              const pinnedStyle = getPinnedStyle(header.id, isPinned, colSizeMap)
              const sortIndex = header.column.getSortIndex()

              return (
                <div
                  key={header.id}
                  onClick={
                    isSortable
                      ? (e) => header.column.getToggleSortingHandler()?.(e)
                      : undefined
                  }
                  style={{
                    width: colSize,
                    minWidth: col?.minWidth ?? 60,
                    flexShrink: 0,
                    padding: '0 12px',
                    fontWeight: 600,
                    fontSize: '12px',
                    color: 'var(--io-text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    cursor: isSortable ? 'pointer' : 'default',
                    userSelect: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    boxSizing: 'border-box',
                    position: 'relative',
                    ...pinnedStyle,
                  }}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  {isSortable && (
                    <span style={{ opacity: sortDir ? 1 : 0.3, fontSize: '10px' }}>
                      {sortDir === 'asc' ? '↑' : sortDir === 'desc' ? '↓' : '↕'}
                    </span>
                  )}
                  {isSortable && sortIndex > 0 && (
                    <span
                      style={{
                        fontSize: '10px',
                        color: 'var(--io-accent)',
                        fontWeight: 700,
                      }}
                    >
                      {sortIndex + 1}
                    </span>
                  )}
                  {/* Resize handle */}
                  <div
                    onMouseDown={header.getResizeHandler()}
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 0,
                      bottom: 0,
                      width: RESIZE_HANDLE_WIDTH,
                      cursor: 'col-resize',
                      background: header.column.getIsResizing()
                        ? 'var(--io-accent, #3B82F6)'
                        : 'transparent',
                      zIndex: 10,
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                </div>
              )
            })}
          </div>
        ))}

        {/* Filter row */}
        {hasFilters && (
          <div
            style={{
              display: 'flex',
              height: FILTER_ROW_HEIGHT,
              alignItems: 'center',
              borderTop: '1px solid var(--io-border)',
            }}
          >
            {table.getAllLeafColumns().map((column) => {
              const col = columns.find((c) => c.id === column.id)
              const colSize = column.getSize()
              const isPinned = column.getIsPinned()
              const pinnedStyle = getPinnedStyle(column.id, isPinned, colSizeMap)

              return (
                <div
                  key={column.id}
                  style={{
                    width: colSize,
                    minWidth: col?.minWidth ?? 60,
                    flexShrink: 0,
                    padding: '0 6px',
                    boxSizing: 'border-box',
                    ...pinnedStyle,
                  }}
                >
                  {col?.filterType === 'text' && (
                    <input
                      type="text"
                      placeholder="Filter…"
                      value={(column.getFilterValue() as string) ?? ''}
                      onChange={(e) => column.setFilterValue(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '2px 6px',
                        fontSize: '12px',
                        border: '1px solid var(--io-border)',
                        borderRadius: 3,
                        background: 'var(--io-surface-primary, var(--io-surface))',
                        color: 'var(--io-text-primary)',
                        boxSizing: 'border-box',
                      }}
                    />
                  )}
                  {col?.filterType === 'numeric' && (
                    <div style={{ display: 'flex', gap: 2 }}>
                      <input
                        type="number"
                        placeholder="Min"
                        value={((column.getFilterValue() as [number | '', number | ''])?.[0]) ?? ''}
                        onChange={(e) => {
                          const cur = (column.getFilterValue() as [number | '', number | '']) ?? ['', '']
                          column.setFilterValue([e.target.value === '' ? '' : Number(e.target.value), cur[1]])
                        }}
                        style={{
                          width: '50%',
                          padding: '2px 4px',
                          fontSize: '12px',
                          border: '1px solid var(--io-border)',
                          borderRadius: 3,
                          background: 'var(--io-surface-primary, var(--io-surface))',
                          color: 'var(--io-text-primary)',
                          boxSizing: 'border-box',
                        }}
                      />
                      <input
                        type="number"
                        placeholder="Max"
                        value={((column.getFilterValue() as [number | '', number | ''])?.[1]) ?? ''}
                        onChange={(e) => {
                          const cur = (column.getFilterValue() as [number | '', number | '']) ?? ['', '']
                          column.setFilterValue([cur[0], e.target.value === '' ? '' : Number(e.target.value)])
                        }}
                        style={{
                          width: '50%',
                          padding: '2px 4px',
                          fontSize: '12px',
                          border: '1px solid var(--io-border)',
                          borderRadius: 3,
                          background: 'var(--io-surface-primary, var(--io-surface))',
                          color: 'var(--io-text-primary)',
                          boxSizing: 'border-box',
                        }}
                      />
                    </div>
                  )}
                  {col?.filterType === 'enum' && (
                    <select
                      value={(column.getFilterValue() as string) ?? ''}
                      onChange={(e) => column.setFilterValue(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '2px 4px',
                        fontSize: '12px',
                        border: '1px solid var(--io-border)',
                        borderRadius: 3,
                        background: 'var(--io-surface-primary, var(--io-surface))',
                        color: 'var(--io-text-primary)',
                        boxSizing: 'border-box',
                      }}
                    >
                      <option value="">All</option>
                      {(col.filterOptions ?? []).map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Body */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{ flex: 1, overflowY: 'auto', overflowX: 'auto', position: 'relative' }}
      >
        {/* Loading skeleton */}
        {loading && (
          <div>
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonRow key={i} columnCount={columns.length} rowHeight={resolvedRowHeight} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && rows.length === 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'var(--io-text-muted)',
              fontSize: '13px',
              padding: '32px',
            }}
          >
            {emptyMessage}
          </div>
        )}

        {/* Virtual scroll container */}
        {!loading && rows.length > 0 && (
          <div style={{ height: totalHeight, position: 'relative' }}>
            <div style={{ paddingTop, paddingBottom }}>
              {visibleRows.map((row) => (
                <div
                  key={row.id}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  style={{
                    display: 'flex',
                    height: resolvedRowHeight,
                    alignItems: 'center',
                    borderBottom: '1px solid var(--io-border)',
                    cursor: onRowClick ? 'pointer' : 'default',
                    transition: 'background 0.1s',
                    position: 'relative',
                  }}
                  onMouseEnter={(e) => {
                    ;(e.currentTarget as HTMLDivElement).style.background =
                      'var(--io-surface-secondary)'
                  }}
                  onMouseLeave={(e) => {
                    ;(e.currentTarget as HTMLDivElement).style.background = 'transparent'
                  }}
                >
                  {row.getVisibleCells().map((cell) => {
                    const col = columns.find((c) => c.id === cell.column.id)
                    const colSize = cell.column.getSize()
                    const isPinned = cell.column.getIsPinned()
                    const pinnedStyle = getPinnedStyle(cell.column.id, isPinned, colSizeMap)
                    const value = cell.getValue()

                    // Conditional formatting
                    const condStyle: React.CSSProperties =
                      col?.conditionStyle ? col.conditionStyle(value, row.original) : {}

                    // Sparkline rendering
                    const renderSparkline = !!col?.sparkline

                    return (
                      <div
                        key={cell.id}
                        style={{
                          width: colSize,
                          minWidth: col?.minWidth ?? 60,
                          flexShrink: 0,
                          padding: '0 12px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          boxSizing: 'border-box',
                          ...pinnedStyle,
                          ...condStyle,
                        }}
                      >
                        {renderSparkline ? (
                          <InlineSparkline
                            values={[]}
                            color={col!.sparkline!.color}
                          />
                        ) : (
                          flexRender(cell.column.columnDef.cell, cell.getContext())
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Skeleton pulse animation */}
      <style>{`
        @keyframes io-skeleton-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  )
}
