import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { pointsApi } from '../../api/points'
import { useWebSocket } from '../hooks/useWebSocket'
import TimeSeriesChart from './charts/TimeSeriesChart'

export interface PointDetailPanelProps {
  pointId: string | null
  onClose: () => void
  anchorPosition?: { x: number; y: number }
}

// ---------------------------------------------------------------------------
// Quality badge
// ---------------------------------------------------------------------------

function QualityBadge({ quality }: { quality: string }) {
  const color =
    quality === 'good'
      ? 'var(--io-status-good, #22c55e)'
      : quality === 'bad'
        ? 'var(--io-status-bad, #ef4444)'
        : 'var(--io-status-uncertain, #f59e0b)'

  return (
    <span
      style={{
        fontSize: '11px',
        fontWeight: 600,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        color,
        background: `color-mix(in srgb, ${color} 15%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 40%, transparent)`,
        borderRadius: '3px',
        padding: '1px 5px',
      }}
    >
      {quality}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Sparkline helper — converts HistoryEntry[] to uPlot-compatible arrays
// ---------------------------------------------------------------------------

function useSparklineData(pointId: string | null) {
  return useQuery({
    queryKey: ['point-sparkline', pointId],
    enabled: pointId !== null,
    queryFn: async () => {
      if (!pointId) return null
      const now = new Date()
      const end = now.toISOString()
      const start = new Date(now.getTime() - 60 * 60 * 1000).toISOString() // last 1 hour
      const result = await pointsApi.getHistory(pointId, { start, end, limit: 20 })
      if (!result.success) return null
      return result.data
    },
    staleTime: 30_000,
  })
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

export default function PointDetailPanel({
  pointId,
  onClose,
  anchorPosition,
}: PointDetailPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  // Fetch metadata
  const metaQuery = useQuery({
    queryKey: ['point-meta', pointId],
    enabled: pointId !== null,
    queryFn: async () => {
      if (!pointId) return null
      const result = await pointsApi.getMeta(pointId)
      if (!result.success) return null
      return result.data
    },
    staleTime: 60_000,
  })

  // Fetch last known value (fallback while WS connects)
  const latestQuery = useQuery({
    queryKey: ['point-latest', pointId],
    enabled: pointId !== null,
    queryFn: async () => {
      if (!pointId) return null
      const result = await pointsApi.getLatest(pointId)
      if (!result.success) return null
      return result.data
    },
    staleTime: 5_000,
  })

  // Live value via WebSocket
  const pointIds = pointId ? [pointId] : []
  const { values: wsValues } = useWebSocket(pointIds)
  const liveValue = pointId ? wsValues.get(pointId) : undefined

  // Sparkline data
  const sparkQuery = useSparklineData(pointId)

  // Determine displayed value
  const displayValue = liveValue ?? latestQuery.data
  const displayTimestamp = displayValue?.timestamp
    ? new Date(displayValue.timestamp).toLocaleTimeString()
    : null

  // Sparkline arrays
  const sparkTimestamps: number[] = []
  const sparkValues: number[] = []
  if (sparkQuery.data) {
    for (const entry of sparkQuery.data) {
      const t = new Date(entry.time).getTime() / 1000
      sparkTimestamps.push(t)
      sparkValues.push(entry.value)
    }
  }

  // Dismiss on Escape key
  useEffect(() => {
    if (!pointId) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [pointId, onClose])

  // Position and drag state
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 60, left: 0 })
  const dragState = useRef<{ startMouseX: number; startMouseY: number; startTop: number; startLeft: number } | null>(null)

  function handleHeaderMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (e.button !== 0) return
    e.preventDefault()
    dragState.current = { startMouseX: e.clientX, startMouseY: e.clientY, startTop: position.top, startLeft: position.left }
    function onMove(ev: MouseEvent) {
      if (!dragState.current) return
      const dx = ev.clientX - dragState.current.startMouseX
      const dy = ev.clientY - dragState.current.startMouseY
      setPosition({ top: dragState.current.startTop + dy, left: dragState.current.startLeft + dx })
    }
    function onUp() {
      dragState.current = null
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  useEffect(() => {
    if (!pointId) return
    if (anchorPosition) {
      // Position near anchor, keep within viewport
      const panelW = 320
      const panelH = 360
      const vw = window.innerWidth
      const vh = window.innerHeight
      let left = anchorPosition.x + 12
      let top = anchorPosition.y - 20
      if (left + panelW > vw - 12) left = anchorPosition.x - panelW - 12
      if (top + panelH > vh - 12) top = vh - panelH - 12
      if (top < 12) top = 12
      if (left < 12) left = 12
      setPosition({ top, left })
    } else {
      // Default: right edge
      const panelW = 320
      setPosition({ top: 60, left: window.innerWidth - panelW - 16 })
    }
  }, [pointId, anchorPosition])

  if (!pointId) return null

  const meta = metaQuery.data

  return (
    <div
      ref={panelRef}
      style={{
        position: 'fixed',
        top: position.top,
        left: position.left,
        width: 320,
        zIndex: 2000,
        background: 'var(--io-surface-elevated)',
        border: '1px solid var(--io-border)',
        borderRadius: '8px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        overflow: 'hidden',
      }}
    >
      {/* Header — drag handle */}
      <div
        onMouseDown={handleHeaderMouseDown}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          borderBottom: '1px solid var(--io-border)',
          background: 'var(--io-surface-secondary)',
          cursor: 'move',
          userSelect: 'none',
        }}
      >
        <div style={{ overflow: 'hidden' }}>
          <div
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--io-text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {meta?.name ?? pointId}
          </div>
          {meta?.source_name && (
            <div style={{ fontSize: '11px', color: 'var(--io-text-muted)', marginTop: 1 }}>
              {meta.source_name}
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--io-text-muted)',
            cursor: 'pointer',
            fontSize: '16px',
            lineHeight: 1,
            padding: '2px 4px',
            flexShrink: 0,
          }}
        >
          ×
        </button>
      </div>

      {/* Body */}
      <div style={{ padding: '12px 14px' }}>
        {/* Current value */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: '11px', color: 'var(--io-text-muted)', marginBottom: 4 }}>
            Current Value
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
            <span style={{ fontSize: '28px', fontWeight: 700, color: 'var(--io-text-primary)', fontVariantNumeric: 'tabular-nums' }}>
              {displayValue?.value !== undefined ? String(displayValue.value) : '—'}
            </span>
            {meta?.engineering_unit && (
              <span style={{ fontSize: '14px', color: 'var(--io-text-muted)' }}>
                {meta.engineering_unit}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            {displayValue?.quality && <QualityBadge quality={displayValue.quality} />}
            {displayTimestamp && (
              <span style={{ fontSize: '11px', color: 'var(--io-text-muted)' }}>
                {displayTimestamp}
              </span>
            )}
          </div>
        </div>

        {/* Description */}
        {meta?.description && (
          <div style={{ marginBottom: 12 }}>
            <div style={{ fontSize: '11px', color: 'var(--io-text-muted)', marginBottom: 2 }}>
              Description
            </div>
            <div style={{ fontSize: '12px', color: 'var(--io-text-secondary, var(--io-text-primary))' }}>
              {meta.description}
            </div>
          </div>
        )}

        {/* Sparkline */}
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: '11px', color: 'var(--io-text-muted)', marginBottom: 4 }}>
            Last Hour
          </div>
          <TimeSeriesChart
            timestamps={sparkTimestamps}
            series={
              sparkTimestamps.length > 0
                ? [{ label: meta?.name ?? pointId, data: sparkValues }]
                : []
            }
            height={80}
          />
        </div>

        {/* Point ID footer */}
        <div
          style={{
            marginTop: 10,
            paddingTop: 8,
            borderTop: '1px solid var(--io-border)',
            fontSize: '10px',
            color: 'var(--io-text-muted)',
            fontFamily: 'monospace',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {pointId}
        </div>
      </div>
    </div>
  )
}
