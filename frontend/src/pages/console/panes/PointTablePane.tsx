import { useQuery } from '@tanstack/react-query'
import { useWebSocket } from '../../../shared/hooks/useWebSocket'
import { useHistoricalValues } from '../../../shared/hooks/useHistoricalValues'
import { usePlaybackStore } from '../../../store/playback'
import DataTable, { type ColumnDef } from '../../../shared/components/DataTable'
import { pointsApi } from '../../../api/points'
import type { PaneConfig } from '../types'

interface PointTablePaneProps {
  config: PaneConfig
  editMode: boolean
  onConfigurePoints?: (paneId: string) => void
}

interface PointRow {
  id: string
  name: string
  value: string
  units: string
  quality: string
  lastUpdated: string
}

function QualityBadge({ quality }: { quality: string }) {
  const q = quality.toLowerCase()
  const color =
    q === 'good'
      ? '#10B981'
      : q === 'uncertain'
        ? '#F59E0B'
        : q === 'bad'
          ? '#EF4444'
          : 'var(--io-text-muted)'

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        fontSize: 11,
        fontWeight: 500,
        color,
      }}
    >
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: color,
          display: 'inline-block',
        }}
      />
      {quality}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Hook — batch-fetch metadata for configured points
// ---------------------------------------------------------------------------

function usePointsMeta(pointIds: string[]) {
  return useQuery({
    queryKey: ['point-meta-batch', pointIds.join(',')],
    queryFn: async () => {
      const results = await Promise.all(pointIds.map((id) => pointsApi.getMeta(id)))
      const map = new Map<string, { name: string; units: string }>()
      results.forEach((r, idx) => {
        if (r.success) {
          map.set(pointIds[idx], {
            name: r.data.name,
            units: r.data.engineering_unit ?? '',
          })
        } else {
          map.set(pointIds[idx], { name: pointIds[idx], units: '' })
        }
      })
      return map
    },
    enabled: pointIds.length > 0,
    staleTime: Infinity,
    gcTime: Infinity,
  })
}

// ---------------------------------------------------------------------------
// Columns
// ---------------------------------------------------------------------------

const columns: ColumnDef<PointRow>[] = [
  {
    id: 'name',
    header: 'Name',
    accessorKey: 'name',
    sortable: true,
  },
  {
    id: 'value',
    header: 'Value',
    accessorKey: 'value',
    width: 100,
  },
  {
    id: 'units',
    header: 'Units',
    accessorKey: 'units',
    width: 80,
  },
  {
    id: 'quality',
    header: 'Quality',
    accessorKey: 'quality',
    width: 110,
    cell: (value) => <QualityBadge quality={String(value)} />,
  },
  {
    id: 'lastUpdated',
    header: 'Last Updated',
    accessorKey: 'lastUpdated',
    width: 140,
  },
]

// ---------------------------------------------------------------------------
// PointTablePane
// ---------------------------------------------------------------------------

export default function PointTablePane({
  config,
  editMode,
  onConfigurePoints,
}: PointTablePaneProps) {
  const pointIds = config.tablePointIds ?? []

  const { mode: playbackMode, timestamp: playbackTs } = usePlaybackStore()
  const isHistorical = playbackMode === 'historical'

  const { data: metaMap } = usePointsMeta(pointIds)
  const { values: wsValues } = useWebSocket(isHistorical ? [] : pointIds)
  const historicalValues = useHistoricalValues(isHistorical ? pointIds : [], isHistorical ? playbackTs : undefined)
  const values = isHistorical ? historicalValues : wsValues

  if (pointIds.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          color: 'var(--io-text-muted)',
          fontSize: 13,
          background: 'var(--io-surface)',
        }}
      >
        <svg
          width="36"
          height="36"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="3" y1="15" x2="21" y2="15" />
          <line x1="9" y1="9" x2="9" y2="21" />
        </svg>
        <span>No points configured</span>
        {editMode && (
          <button
            onClick={() => onConfigurePoints?.(config.id)}
            style={{
              background: 'var(--io-accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 6,
              padding: '7px 14px',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            Configure Points
          </button>
        )}
      </div>
    )
  }

  const tableData: PointRow[] = pointIds.map((id) => {
    const meta = metaMap?.get(id)
    const lv = values.get(id)
    const lvTs = (lv as { timestamp?: string } | undefined)?.timestamp
    const ts = lvTs
      ? new Date(lvTs).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      : isHistorical
        ? new Date(playbackTs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : '—'

    return {
      id,
      name: meta?.name ?? id,
      value: lv != null ? String(lv.value) : '—',
      units: meta?.units ?? '',
      quality: lv?.quality ?? 'unknown',
      lastUpdated: ts,
    }
  })

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--io-surface)',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <DataTable
        data={tableData}
        columns={columns}
        height={undefined}
        rowHeight={36}
        emptyMessage="No live data"
      />

      {editMode && (
        <button
          onClick={() => onConfigurePoints?.(config.id)}
          style={{
            position: 'absolute',
            top: 8,
            right: 8,
            background: 'rgba(0,0,0,0.7)',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 6,
            padding: '5px 10px',
            cursor: 'pointer',
            fontSize: 12,
            zIndex: 10,
          }}
        >
          Configure Points
        </button>
      )}
    </div>
  )
}
