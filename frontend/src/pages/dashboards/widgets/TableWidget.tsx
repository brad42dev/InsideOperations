import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type SortingState,
  type ColumnDef as TanstackColumnDef,
} from '@tanstack/react-table'
import { api } from '../../../api/client'
import type { WidgetConfig } from '../../../api/dashboards'
import PointContextMenu from '../../../shared/components/PointContextMenu'

interface ColumnSpec {
  key: string
  label: string
}

interface TableWidgetConfig {
  title: string
  columns: ColumnSpec[]
  rows?: Record<string, unknown>[]
  pointIds?: string[]
}

interface PointCurrentResponse {
  value: number
  quality: string
  timestamp: string
}

interface Props {
  config: WidgetConfig
  variables: Record<string, string[]>
}

export default function TableWidget({ config }: Props) {
  const cfg = config.config as unknown as TableWidgetConfig
  const [sorting, setSorting] = useState<SortingState>([])

  const isDynamic = Array.isArray(cfg.pointIds) && cfg.pointIds.length > 0

  const query = useQuery({
    queryKey: ['table-points', cfg.pointIds],
    queryFn: async () => {
      if (!isDynamic) return []
      const results = await Promise.all(
        (cfg.pointIds ?? []).map(async (pointId) => {
          const res = await api.get<PointCurrentResponse>(
            `/api/points/${encodeURIComponent(pointId)}/current`,
          )
          if (!res.success) return { point_id: pointId, value: '—', quality: 'unknown', timestamp: '—' }
          return {
            point_id: pointId,
            value: res.data.value.toFixed(2),
            quality: res.data.quality,
            timestamp: new Date(res.data.timestamp).toLocaleTimeString(),
          }
        }),
      )
      return results
    },
    refetchInterval: 5000,
    enabled: isDynamic,
  })

  const staticRows: Record<string, unknown>[] = cfg.rows ?? []
  const dynamicRows = (query.data ?? []) as Record<string, unknown>[]
  const rows = isDynamic ? dynamicRows : staticRows

  const columns: ColumnSpec[] = isDynamic
    ? [
        { key: 'point_id', label: 'Point' },
        { key: 'value', label: 'Value' },
        { key: 'quality', label: 'Quality' },
        { key: 'timestamp', label: 'Time' },
      ]
    : (cfg.columns ?? [])

  const tanstackColumns: TanstackColumnDef<Record<string, unknown>>[] = columns.map((col) => ({
    id: col.key,
    header: col.label,
    accessorKey: col.key,
    enableSorting: true,
  }))

  const table = useReactTable({
    data: rows,
    columns: tanstackColumns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  const headerGroups = table.getHeaderGroups()
  const tableRows = table.getRowModel().rows

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          fontSize: '12px',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            {headerGroups.map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => {
                  const sortDir = header.column.getIsSorted()
                  return (
                    <th
                      key={header.id}
                      onClick={header.column.getToggleSortingHandler()}
                      style={{
                        padding: '6px 10px',
                        background: 'var(--io-surface-secondary)',
                        borderBottom: '1px solid var(--io-border)',
                        textAlign: 'left',
                        fontWeight: 600,
                        fontSize: '11px',
                        color: 'var(--io-text-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        cursor: 'pointer',
                        userSelect: 'none',
                        whiteSpace: 'nowrap',
                        position: 'sticky',
                        top: 0,
                        zIndex: 1,
                      }}
                    >
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {sortDir ? (
                        <span style={{ marginLeft: 4, fontSize: '10px' }}>
                          {sortDir === 'asc' ? '↑' : '↓'}
                        </span>
                      ) : null}
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {query.isLoading && (
              <tr>
                <td
                  colSpan={columns.length}
                  style={{ padding: '16px', textAlign: 'center', color: 'var(--io-text-muted)' }}
                >
                  Loading...
                </td>
              </tr>
            )}
            {!query.isLoading && tableRows.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length}
                  style={{ padding: '16px', textAlign: 'center', color: 'var(--io-text-muted)' }}
                >
                  No data
                </td>
              </tr>
            )}
            {!query.isLoading &&
              tableRows.map((row) => {
                const rowPointId = isDynamic ? String(row.original.point_id ?? '') : ''
                const tr = (
                  <tr
                    key={row.id}
                    style={{ borderBottom: '1px solid var(--io-border)' }}
                    onMouseEnter={(e) => {
                      ;(e.currentTarget as HTMLTableRowElement).style.background =
                        'var(--io-surface-secondary)'
                    }}
                    onMouseLeave={(e) => {
                      ;(e.currentTarget as HTMLTableRowElement).style.background = 'transparent'
                    }}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        style={{
                          padding: '6px 10px',
                          color: 'var(--io-text-primary)',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: '200px',
                        }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                )

                // Only dynamic rows have a known pointId — wrap each with PointContextMenu.
                // Static rows have no point binding, so no context menu.
                // Mobile long-press (500ms) is a future enhancement — TODO.
                if (isDynamic && rowPointId) {
                  return (
                    <PointContextMenu
                      key={row.id}
                      pointId={rowPointId}
                      tagName={rowPointId}
                      isAlarm={false}
                      isAlarmElement={false}
                    >
                      {tr}
                    </PointContextMenu>
                  )
                }
                return tr
              })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
