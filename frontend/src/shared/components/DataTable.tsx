import { useRef, useState, useEffect, useCallback } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type SortingState,
  type ColumnDef as TanstackColumnDef,
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
}

export interface DataTableProps<T extends object> {
  data: T[]
  columns: ColumnDef<T>[]
  height?: number
  rowHeight?: number
  onRowClick?: (row: T) => void
  loading?: boolean
  emptyMessage?: string
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
// Component
// ---------------------------------------------------------------------------

const VIRTUAL_BUFFER = 5

export default function DataTable<T extends object>({
  data,
  columns,
  height = 400,
  rowHeight = 36,
  onRowClick,
  loading = false,
  emptyMessage = 'No data available',
}: DataTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrollTop, setScrollTop] = useState(0)

  const tanstackColumns: TanstackColumnDef<T>[] = columns.map((col) => ({
    id: col.id,
    header: col.header,
    accessorKey: col.accessorKey as string | undefined,
    enableSorting: col.sortable ?? false,
    cell: col.cell
      ? (info) => col.cell!(info.getValue(), info.row.original)
      : undefined,
    size: col.width,
    minSize: col.minWidth,
  }))

  const table = useReactTable({
    data,
    columns: tanstackColumns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const rows = table.getRowModel().rows
  const totalHeight = rows.length * rowHeight
  const headerHeight = 36

  const visibleHeight = height - headerHeight
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - VIRTUAL_BUFFER)
  const endIndex = Math.min(
    rows.length,
    Math.ceil((scrollTop + visibleHeight) / rowHeight) + VIRTUAL_BUFFER,
  )
  const visibleRows = rows.slice(startIndex, endIndex)
  const paddingTop = startIndex * rowHeight
  const paddingBottom = (rows.length - endIndex) * rowHeight

  const handleScroll = useCallback(() => {
    if (scrollRef.current) {
      setScrollTop(scrollRef.current.scrollTop)
    }
  }, [])

  // Keep scroll position in sync on data change
  useEffect(() => {
    if (scrollRef.current) setScrollTop(scrollRef.current.scrollTop)
  }, [data])

  const headerGroups = table.getHeaderGroups()

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
      {/* Sticky header */}
      <div
        style={{
          flexShrink: 0,
          background: 'var(--io-surface-secondary)',
          borderBottom: '1px solid var(--io-border)',
        }}
      >
        {headerGroups.map((hg) => (
          <div key={hg.id} style={{ display: 'flex', height: headerHeight, alignItems: 'center' }}>
            {hg.headers.map((header) => {
              const col = columns.find((c) => c.id === header.id)
              const isSortable = col?.sortable ?? false
              const sortDir = header.column.getIsSorted()
              return (
                <div
                  key={header.id}
                  onClick={isSortable ? header.column.getToggleSortingHandler() : undefined}
                  style={{
                    flex: col?.width ? `0 0 ${col.width}px` : 1,
                    minWidth: col?.minWidth,
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
                  }}
                >
                  {flexRender(header.column.columnDef.header, header.getContext())}
                  {isSortable && (
                    <span style={{ opacity: sortDir ? 1 : 0.3, fontSize: '10px' }}>
                      {sortDir === 'asc' ? '↑' : sortDir === 'desc' ? '↓' : '↕'}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {/* Body */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', position: 'relative' }}
      >
        {/* Loading skeleton */}
        {loading && (
          <div>
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonRow key={i} columnCount={columns.length} rowHeight={rowHeight} />
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
                    height: rowHeight,
                    alignItems: 'center',
                    borderBottom: '1px solid var(--io-border)',
                    cursor: onRowClick ? 'pointer' : 'default',
                    transition: 'background 0.1s',
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
                    return (
                      <div
                        key={cell.id}
                        style={{
                          flex: col?.width ? `0 0 ${col.width}px` : 1,
                          minWidth: col?.minWidth,
                          padding: '0 12px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
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
