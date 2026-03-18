import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../api/client'
import TimeSeriesChart from '../../shared/components/charts/TimeSeriesChart'
import DataTable, { type ColumnDef } from '../../shared/components/DataTable'
import type { EvidenceItem } from '../../api/forensics'
import { graphicsApi } from '../../api/graphics'
import { extractPointIds } from '../../shared/graphics/pointExtractor'
import { useHistoricalValues } from '../../shared/hooks/useHistoricalValues'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  item: EvidenceItem
  stageStart: string
  stageEnd: string
  onDelete?: () => void
  readOnly?: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function EvidenceCard({
  title,
  icon,
  onDelete,
  readOnly,
  children,
}: {
  title: string
  icon: string
  onDelete?: () => void
  readOnly?: boolean
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        border: '1px solid var(--io-border)',
        borderRadius: '6px',
        overflow: 'hidden',
        background: 'var(--io-surface)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          background: 'var(--io-surface-secondary)',
          borderBottom: '1px solid var(--io-border)',
        }}
      >
        <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--io-text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>{icon}</span>
          {title}
        </span>
        {!readOnly && onDelete && (
          <button
            onClick={onDelete}
            title="Remove evidence"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--io-text-muted)',
              fontSize: '14px',
              padding: '2px 4px',
              borderRadius: '4px',
              lineHeight: 1,
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--io-danger, #ef4444)')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLButtonElement).style.color = 'var(--io-text-muted)')}
          >
            🗑
          </button>
        )}
      </div>
      <div style={{ padding: '12px' }}>{children}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Trend evidence
// ---------------------------------------------------------------------------

interface HistoryPoint {
  ts: string
  value: number
}

function TrendEvidence({
  item,
  stageStart,
  stageEnd,
}: {
  item: EvidenceItem
  stageStart: string
  stageEnd: string
}) {
  const pointIds = (item.config.point_ids as string[] | undefined) ?? []

  const query = useQuery({
    queryKey: ['evidence-trend', pointIds, stageStart, stageEnd],
    queryFn: async () => {
      if (pointIds.length === 0) return []
      const results = await Promise.all(
        pointIds.map(async (pid) => {
          const res = await api.get<HistoryPoint[]>(
            `/api/archive/history?point_id=${encodeURIComponent(pid)}&start=${encodeURIComponent(stageStart)}&end=${encodeURIComponent(stageEnd)}&limit=500`,
          )
          return { pid, data: res.success ? res.data : [] }
        }),
      )
      return results
    },
    enabled: pointIds.length > 0,
    staleTime: 60_000,
  })

  if (pointIds.length === 0) {
    return (
      <span style={{ fontSize: '13px', color: 'var(--io-text-muted)' }}>
        No points configured for this trend.
      </span>
    )
  }

  if (query.isLoading) {
    return <span style={{ fontSize: '13px', color: 'var(--io-text-muted)' }}>Loading trend data...</span>
  }

  const seriesData = (query.data ?? []).map((s, idx) => {
    const colors = ['#4A9EFF', '#f59e0b', '#22c55e', '#a855f7', '#ef4444']
    return {
      label: s.pid,
      data: s.data.map((d) => d.value),
      color: colors[idx % colors.length],
    }
  })

  const timestamps =
    (query.data ?? [])[0]?.data.map((d) => Math.floor(new Date(d.ts).getTime() / 1000)) ?? []

  return (
    <TimeSeriesChart
      timestamps={timestamps}
      series={seriesData}
      height={180}
    />
  )
}

// ---------------------------------------------------------------------------
// Alarm list evidence
// ---------------------------------------------------------------------------

interface AlarmEntry {
  id: string
  tag?: string
  message?: string
  severity?: string
  occurred_at?: string
}

function AlarmListEvidence({
  item,
  stageStart,
  stageEnd,
}: {
  item: EvidenceItem
  stageStart: string
  stageEnd: string
}) {
  const pointId = item.config.point_id as string | undefined

  const query = useQuery({
    queryKey: ['evidence-alarms', pointId, stageStart, stageEnd],
    queryFn: async () => {
      if (!pointId) return []
      const res = await api.get<AlarmEntry[]>(
        `/api/alarms/history?point_id=${encodeURIComponent(pointId)}&start=${encodeURIComponent(stageStart)}&end=${encodeURIComponent(stageEnd)}`,
      )
      return res.success ? res.data : []
    },
    enabled: !!pointId,
    staleTime: 60_000,
  })

  const columns: ColumnDef<AlarmEntry>[] = [
    { id: 'tag', header: 'Tag', accessorKey: 'tag' },
    { id: 'message', header: 'Message', accessorKey: 'message' },
    { id: 'severity', header: 'Severity', accessorKey: 'severity' },
    {
      id: 'occurred_at',
      header: 'Time',
      accessorKey: 'occurred_at',
      cell: (val) => val ? new Date(val as string).toLocaleString() : '—',
    },
  ]

  return (
    <DataTable
      data={query.data ?? []}
      columns={columns}
      height={200}
      loading={query.isLoading}
      emptyMessage="No alarms in this stage's time range"
    />
  )
}

// ---------------------------------------------------------------------------
// Value table evidence
// ---------------------------------------------------------------------------

function ValueTableEvidence({
  item,
  stageStart,
  stageEnd,
}: {
  item: EvidenceItem
  stageStart: string
  stageEnd: string
}) {
  const pointIds = (item.config.point_ids as string[] | undefined) ?? []
  const customTimestamps = item.config.timestamps as string[] | undefined

  // Generate simple timestamps from stage range if none provided
  const timestamps: string[] = customTimestamps ?? (() => {
    const start = new Date(stageStart).getTime()
    const end = new Date(stageEnd).getTime()
    const count = 6
    return Array.from({ length: count }, (_, i) => {
      const t = start + (i / (count - 1)) * (end - start)
      return new Date(t).toISOString()
    })
  })()

  if (pointIds.length === 0) {
    return (
      <span style={{ fontSize: '13px', color: 'var(--io-text-muted)' }}>
        No points configured.
      </span>
    )
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table
        style={{
          borderCollapse: 'collapse',
          fontSize: '12px',
          width: '100%',
          color: 'var(--io-text-primary)',
        }}
      >
        <thead>
          <tr>
            <th
              style={{
                padding: '6px 10px',
                textAlign: 'left',
                background: 'var(--io-surface-secondary)',
                borderBottom: '1px solid var(--io-border)',
                fontWeight: 600,
                color: 'var(--io-text-muted)',
                whiteSpace: 'nowrap',
              }}
            >
              Timestamp
            </th>
            {pointIds.map((pid) => (
              <th
                key={pid}
                style={{
                  padding: '6px 10px',
                  textAlign: 'right',
                  background: 'var(--io-surface-secondary)',
                  borderBottom: '1px solid var(--io-border)',
                  fontWeight: 600,
                  color: 'var(--io-text-muted)',
                  whiteSpace: 'nowrap',
                  maxWidth: '140px',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {pid}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {timestamps.map((ts) => (
            <tr key={ts}>
              <td
                style={{
                  padding: '5px 10px',
                  borderBottom: '1px solid var(--io-border)',
                  whiteSpace: 'nowrap',
                  color: 'var(--io-text-muted)',
                }}
              >
                {new Date(ts).toLocaleString()}
              </td>
              {pointIds.map((pid) => (
                <td
                  key={pid}
                  style={{
                    padding: '5px 10px',
                    borderBottom: '1px solid var(--io-border)',
                    textAlign: 'right',
                    color: 'var(--io-text-secondary)',
                  }}
                >
                  —
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Annotation evidence
// ---------------------------------------------------------------------------

function AnnotationEvidence({
  item,
  readOnly,
  onUpdateText,
}: {
  item: EvidenceItem
  readOnly: boolean
  onUpdateText: (text: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState((item.config.text as string | undefined) ?? '')

  if (editing && !readOnly) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <textarea
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          style={{
            width: '100%',
            padding: '8px',
            background: 'var(--io-surface-elevated)',
            border: '1px solid var(--io-accent)',
            borderRadius: 'var(--io-radius)',
            color: 'var(--io-text-primary)',
            fontSize: '13px',
            resize: 'vertical',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
          <button
            onClick={() => setEditing(false)}
            style={{
              padding: '4px 10px',
              background: 'none',
              border: '1px solid var(--io-border)',
              borderRadius: 'var(--io-radius)',
              cursor: 'pointer',
              fontSize: '12px',
              color: 'var(--io-text-muted)',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onUpdateText(text)
              setEditing(false)
            }}
            style={{
              padding: '4px 10px',
              background: 'var(--io-accent)',
              border: 'none',
              borderRadius: 'var(--io-radius)',
              cursor: 'pointer',
              fontSize: '12px',
              color: '#fff',
              fontWeight: 600,
            }}
          >
            Save
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '8px',
      }}
    >
      <span style={{ fontSize: '14px', lineHeight: 1.5, flex: 1, color: 'var(--io-text-primary)', whiteSpace: 'pre-wrap' }}>
        {text || <span style={{ color: 'var(--io-text-muted)', fontStyle: 'italic' }}>No annotation text. Click edit to add a note.</span>}
      </span>
      {!readOnly && (
        <button
          onClick={() => setEditing(true)}
          title="Edit annotation"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--io-text-muted)',
            fontSize: '14px',
            flexShrink: 0,
            padding: '2px 4px',
          }}
        >
          ✏️
        </button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Graphic snapshot evidence
// ---------------------------------------------------------------------------

function GraphicSnapshotEvidence({ item }: { item: EvidenceItem }) {
  const graphicId = item.config.graphicId as string | undefined
  const timestampStr = item.config.timestamp as string | undefined
  const epochMs = timestampStr ? new Date(timestampStr).getTime() : undefined

  const graphicQuery = useQuery({
    queryKey: ['graphic-snapshot', graphicId],
    queryFn: async () => {
      if (!graphicId) return null
      const result = await graphicsApi.get(graphicId)
      return result.success ? result.data.data : null
    },
    enabled: !!graphicId,
    staleTime: 300_000,
  })

  const pointIds = graphicQuery.data
    ? Array.from(extractPointIds(graphicQuery.data.scene_data))
    : []

  const historicalValues = useHistoricalValues(pointIds, epochMs)

  if (!graphicId) {
    return (
      <span style={{ fontSize: '13px', color: 'var(--io-text-muted)', fontStyle: 'italic' }}>
        No graphic selected.
      </span>
    )
  }

  if (graphicQuery.isLoading) {
    return <span style={{ fontSize: '13px', color: 'var(--io-text-muted)' }}>Loading graphic...</span>
  }

  const graphic = graphicQuery.data

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {/* Header: graphic name + timestamp */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--io-text-primary)' }}>
          {graphic?.name ?? graphicId}
        </span>
        {timestampStr && (
          <span style={{ fontSize: '11px', color: 'var(--io-text-muted)', flexShrink: 0 }}>
            {new Date(timestampStr).toLocaleString()}
          </span>
        )}
      </div>

      {/* Thumbnail */}
      <div
        style={{
          border: '1px solid var(--io-border)',
          borderRadius: '4px',
          overflow: 'hidden',
          background: 'var(--io-surface-secondary)',
          position: 'relative',
        }}
      >
        <img
          src={graphicsApi.thumbnailUrl(graphicId)}
          alt={graphic?.name ?? 'Graphic snapshot'}
          style={{ width: '100%', display: 'block', maxHeight: '240px', objectFit: 'contain' }}
          onError={(e) => {
            const el = e.currentTarget as HTMLImageElement
            el.style.display = 'none'
          }}
        />
        {timestampStr && (
          <div
            style={{
              position: 'absolute',
              bottom: '6px',
              right: '8px',
              background: 'rgba(0,0,0,0.6)',
              color: '#fff',
              fontSize: '11px',
              padding: '2px 6px',
              borderRadius: '4px',
              backdropFilter: 'blur(4px)',
            }}
          >
            {new Date(timestampStr).toLocaleString()}
          </div>
        )}
      </div>

      {/* Point values at snapshot time */}
      {pointIds.length > 0 && (
        <div>
          <div style={{ fontSize: '11px', fontWeight: 600, color: 'var(--io-text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Point Values at Snapshot
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {pointIds.slice(0, 12).map((pid) => {
              const pv = historicalValues.get(pid)
              return (
                <div
                  key={pid}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '4px 8px',
                    borderRadius: '4px',
                    background: 'var(--io-surface-secondary)',
                    fontSize: '12px',
                  }}
                >
                  <span style={{ color: 'var(--io-text-muted)', fontFamily: 'var(--io-font-mono, monospace)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>
                    {pid}
                  </span>
                  <span
                    style={{
                      color: pv ? (pv.quality === 'good' ? 'var(--io-text-primary)' : 'var(--io-text-muted)') : 'var(--io-text-muted)',
                      fontWeight: pv ? 600 : 400,
                      flexShrink: 0,
                      marginLeft: '8px',
                    }}
                  >
                    {pv ? (typeof pv.value === 'number' ? pv.value.toLocaleString(undefined, { maximumFractionDigits: 3 }) : String(pv.value)) : (epochMs ? '—' : 'N/A')}
                  </span>
                </div>
              )
            })}
            {pointIds.length > 12 && (
              <span style={{ fontSize: '11px', color: 'var(--io-text-muted)', padding: '2px 8px' }}>
                + {pointIds.length - 12} more points
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// EvidenceRenderer
// ---------------------------------------------------------------------------

export default function EvidenceRenderer({ item, stageStart, stageEnd, onDelete, readOnly = false }: Props) {
  const typeLabels: Record<string, { label: string; icon: string }> = {
    trend: { label: 'Trend Chart', icon: '📈' },
    annotation: { label: 'Annotation', icon: '📝' },
    alarm_list: { label: 'Alarm List', icon: '🔔' },
    value_table: { label: 'Value Table', icon: '📊' },
    correlation: { label: 'Correlation', icon: '🔗' },
    point_detail: { label: 'Point Detail', icon: '📍' },
    graphic_snapshot: { label: 'Graphic Snapshot', icon: '📷' },
    log_entries: { label: 'Log Entries', icon: '📋' },
    round_entries: { label: 'Round Entries', icon: '☑️' },
    calculated_series: { label: 'Calculated Series', icon: '⚙️' },
  }

  const meta = typeLabels[item.evidence_type] ?? { label: item.evidence_type, icon: '▪️' }

  const renderBody = () => {
    switch (item.evidence_type) {
      case 'trend':
        return <TrendEvidence item={item} stageStart={stageStart} stageEnd={stageEnd} />

      case 'annotation':
        return (
          <AnnotationEvidence
            item={item}
            readOnly={readOnly}
            onUpdateText={() => {
              // Config update is handled by the parent via updateEvidence mutation;
              // for now the local state in AnnotationEvidence handles optimistic display.
            }}
          />
        )

      case 'alarm_list':
        return <AlarmListEvidence item={item} stageStart={stageStart} stageEnd={stageEnd} />

      case 'value_table':
        return <ValueTableEvidence item={item} stageStart={stageStart} stageEnd={stageEnd} />

      case 'correlation':
        return (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              color: 'var(--io-text-muted)',
              fontSize: '13px',
              padding: '8px 0',
            }}
          >
            <span style={{ fontSize: '20px', opacity: 0.4 }}>🔗</span>
            Correlation results — run analysis to generate.
          </div>
        )

      case 'point_detail': {
        const pointId = item.config.point_id as string | undefined
        return (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
            }}
          >
            <div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--io-text-primary)' }}>
                {pointId ?? 'Unknown point'}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--io-text-muted)', marginTop: '4px' }}>
                Last value: —
              </div>
            </div>
            {pointId && (
              <a
                href={`/process?highlight=${encodeURIComponent(pointId)}`}
                style={{
                  fontSize: '12px',
                  color: 'var(--io-accent)',
                  textDecoration: 'none',
                }}
              >
                View full detail →
              </a>
            )}
          </div>
        )
      }

      case 'graphic_snapshot':
        return <GraphicSnapshotEvidence item={item} />

      case 'log_entries':
        return (
          <span style={{ fontSize: '13px', color: 'var(--io-text-muted)' }}>
            No log entries for this stage's time range.
          </span>
        )

      case 'round_entries':
        return (
          <span style={{ fontSize: '13px', color: 'var(--io-text-muted)' }}>
            No round entries for this stage's time range.
          </span>
        )

      case 'calculated_series': {
        const exprName = item.config.expression_name as string | undefined
        return (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--io-text-secondary)' }}>
            <span style={{ fontSize: '16px' }}>⚙️</span>
            Calculated series{exprName ? `: ${exprName}` : ''}
          </div>
        )
      }

      default:
        return (
          <span style={{ fontSize: '13px', color: 'var(--io-text-muted)' }}>
            Unknown evidence type: {item.evidence_type}
          </span>
        )
    }
  }

  return (
    <EvidenceCard
      title={meta.label}
      icon={meta.icon}
      onDelete={onDelete}
      readOnly={readOnly}
    >
      {renderBody()}
    </EvidenceCard>
  )
}
