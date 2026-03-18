import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useWebSocket } from '../../../shared/hooks/useWebSocket'
import { usePlaybackStore } from '../../../store/playback'
import TimeSeriesChart, { type Series } from '../../../shared/components/charts/TimeSeriesChart'
import { pointsApi } from '../../../api/points'
import type { PaneConfig } from '../types'

// Pre-defined series color palette
const SERIES_COLORS = [
  '#4A9EFF',
  '#F59E0B',
  '#10B981',
  '#EF4444',
  '#8B5CF6',
  '#EC4899',
  '#06B6D4',
  '#84CC16',
]

const MAX_BUFFER = 3600

interface RingBuffer {
  ts: number
  v: number
}

interface TrendPaneProps {
  config: PaneConfig
  editMode: boolean
  onConfigurePoints?: (paneId: string) => void
}

// ---------------------------------------------------------------------------
// Hook — fetches metadata for a set of point IDs (aggressively cached)
// ---------------------------------------------------------------------------

function usePointMeta(pointIds: string[]) {
  return useQuery({
    queryKey: ['point-meta-batch', pointIds.join(',')],
    queryFn: async () => {
      const results = await Promise.all(pointIds.map((id) => pointsApi.getMeta(id)))
      const map = new Map<string, string>()
      results.forEach((r, idx) => {
        if (r.success) {
          map.set(pointIds[idx], r.data.name)
        } else {
          map.set(pointIds[idx], pointIds[idx])
        }
      })
      return map
    },
    enabled: pointIds.length > 0,
    staleTime: Infinity, // metadata rarely changes
    gcTime: Infinity,
  })
}

// ---------------------------------------------------------------------------
// TrendPane
// ---------------------------------------------------------------------------

export default function TrendPane({ config, editMode, onConfigurePoints }: TrendPaneProps) {
  const pointIds = config.trendPointIds ?? []
  const durationMinutes = config.trendDuration ?? 60
  // Rolling ring buffer per point: pointId → array of { ts, v }
  const buffers = useRef<Map<string, RingBuffer[]>>(new Map())

  // Force chart re-render on new data; _tick read via chartData dependency below
  const [_tick, setTick] = useState(0)

  const { mode: playbackMode, timeRange } = usePlaybackStore()
  const isHistorical = playbackMode === 'historical'

  const { data: metaMap } = usePointMeta(pointIds)
  const { values } = useWebSocket(isHistorical ? [] : pointIds)

  // Historical: fetch series data for the playback time range
  const { data: historicalSeries } = useQuery({
    queryKey: ['trend-historical', pointIds.join(','), timeRange.start, timeRange.end],
    queryFn: async () => {
      const results = await Promise.all(
        pointIds.map((id) =>
          pointsApi.getHistory(id, {
            start: new Date(timeRange.start).toISOString(),
            end: new Date(timeRange.end).toISOString(),
            resolution: 'auto',
            limit: 2000,
          }),
        ),
      )
      const map = new Map<string, RingBuffer[]>()
      results.forEach((r, i) => {
        if (r.success) {
          const entries = Array.isArray(r.data) ? r.data : []
          map.set(pointIds[i], entries.map((e: { timestamp?: string; value?: number }) => ({
            ts: new Date(e.timestamp ?? 0).getTime() / 1000,
            v: e.value ?? NaN,
          })))
        }
      })
      return map
    },
    enabled: isHistorical && pointIds.length > 0,
  })

  // Accumulate incoming values into ring buffers
  useEffect(() => {
    if (values.size === 0) return

    values.forEach((pv) => {
      const ts = new Date(pv.timestamp).getTime() / 1000 // uPlot uses Unix seconds
      if (isNaN(ts)) return

      let buf = buffers.current.get(pv.pointId) ?? []
      buf = [...buf, { ts, v: pv.value }]

      // Trim to window
      const cutoff = Date.now() / 1000 - durationMinutes * 60
      buf = buf.filter((entry) => entry.ts >= cutoff)

      // Cap at MAX_BUFFER
      if (buf.length > MAX_BUFFER) {
        buf = buf.slice(buf.length - MAX_BUFFER)
      }

      buffers.current.set(pv.pointId, buf)
    })

    setTick((t) => t + 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values])

  // Build chart data
  const chartData = (() => {
    if (pointIds.length === 0) return { timestamps: [] as number[], series: [] as Series[] }

    // Historical mode: use fetched series data
    const sourceMap: Map<string, RingBuffer[]> = isHistorical && historicalSeries
      ? historicalSeries
      : buffers.current

    // Collect all timestamps across all series, sorted
    const allTs = new Set<number>()
    pointIds.forEach((id) => {
      const buf = sourceMap.get(id) ?? []
      buf.forEach((e) => allTs.add(e.ts))
    })
    const timestamps = Array.from(allTs).sort((a, b) => a - b)

    const series: Series[] = pointIds.map((id, idx) => {
      const buf = sourceMap.get(id) ?? []
      const bufMap = new Map(buf.map((e) => [e.ts, e.v]))
      const data = timestamps.map((ts) => bufMap.get(ts) ?? NaN)
      return {
        label: metaMap?.get(id) ?? id,
        data,
        color: SERIES_COLORS[idx % SERIES_COLORS.length],
      }
    })

    return { timestamps, series }
  })()

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
          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
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
      {/* Legend */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px 14px',
          padding: '6px 10px 4px',
          borderBottom: '1px solid var(--io-border)',
        }}
      >
        {pointIds.map((id, idx) => (
          <div
            key={id}
            style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}
          >
            <span
              style={{
                display: 'inline-block',
                width: 10,
                height: 3,
                borderRadius: 2,
                background: SERIES_COLORS[idx % SERIES_COLORS.length],
              }}
            />
            <span style={{ color: 'var(--io-text-muted)' }}>
              {metaMap?.get(id) ?? id}
            </span>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div style={{ flex: 1, minHeight: 0 }}>
        {/* Suppress uPlot render until we have data; show no-data message otherwise */}
        <TimeSeriesChart
          key={`${config.id}-${durationMinutes}`}
          timestamps={chartData.timestamps}
          series={chartData.series}
          // width auto-detected by ResizeObserver inside component
        />
      </div>

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
