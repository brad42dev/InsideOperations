import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useWebSocket } from '../../../shared/hooks/useWebSocket'
import { usePlaybackStore } from '../../../store/playback'
import TimeSeriesChart, { type Series } from '../../../shared/components/charts/TimeSeriesChart'
import ChartToolbar from '../../../shared/components/charts/ChartToolbar'
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

interface RingBuffer {
  ts: number
  v: number
}

// ─── Module-level buffer store ───────────────────────────────────────────────
// Stored outside React so buffers survive component remounts (full-screen
// toggle, navigating away and back). Keyed by pane config ID.
const _paneBuffers = new Map<string, Map<string, RingBuffer[]>>()
const _paneLastTs  = new Map<string, Map<string, number>>()

function getPaneBuffers(id: string): Map<string, RingBuffer[]> {
  let m = _paneBuffers.get(id)
  if (!m) { m = new Map(); _paneBuffers.set(id, m) }
  return m
}
function getPaneLastTs(id: string): Map<string, number> {
  let m = _paneLastTs.get(id)
  if (!m) { m = new Map(); _paneLastTs.set(id, m) }
  return m
}

// Resolution and row limit scaled to fetch window size.
// Raw at 1 Hz × 785 points runs out fast — use aggregated resolutions for
// longer windows so the full window is always visible on load.
function seedResolution(minutes: number): 'raw' | '5m' | '1h' {
  if (minutes <= 120)   return 'raw'  // ≤ 2 h  — raw 1 Hz data
  if (minutes <= 10080) return '5m'   // ≤ 7 d  — 5-min aggregate (288–2016 buckets)
  return '1h'                          // > 7 d  — 1-h aggregate
}

function seedLimit(minutes: number): number {
  if (minutes <= 120)   return 7_500   // raw: up to 2h × 1Hz
  if (minutes <= 10080) return 2_500   // 5-min buckets: 7d = 2016 rows
  return 2_000                          // 1-h buckets: months of data
}

// Ring buffer cap scales with window so long windows keep their full history
function maxBuffer(durationMinutes: number): number {
  return Math.max(3_600, durationMinutes * 60)
}

interface TrendPaneProps {
  config: PaneConfig
  editMode: boolean
  onConfigurePoints?: (paneId: string) => void
}

// ---------------------------------------------------------------------------
// Hook — fetches metadata for a set of point IDs (aggressively cached)
// ---------------------------------------------------------------------------

interface PointMeta {
  name: string
  description: string | null
  unit: string | null
  source: string
}

function usePointMeta(pointIds: string[]) {
  return useQuery({
    queryKey: ['point-meta-batch', pointIds.join(',')],
    queryFn: async () => {
      const results = await Promise.all(pointIds.map((id) => pointsApi.getMeta(id)))
      const map = new Map<string, PointMeta>()
      results.forEach((r, idx) => {
        if (r.success) {
          map.set(pointIds[idx], {
            name: r.data.name,
            description: r.data.description,
            unit: r.data.engineering_unit,
            source: r.data.source_name,
          })
        } else {
          map.set(pointIds[idx], { name: pointIds[idx], description: null, unit: null, source: '' })
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
// TrendPane
// ---------------------------------------------------------------------------

export default function TrendPane({ config, editMode, onConfigurePoints }: TrendPaneProps) {
  const pointIds = config.trendPointIds ?? []

  // Duration persisted to localStorage per-pane so it survives refresh without
  // triggering workspace store re-renders that could disrupt in-flight fetches.
  const durationKey = `io_trend_duration_${config.id}`
  const [durationMinutes, setDurationMinutes] = useState(() => {
    const saved = localStorage.getItem(durationKey)
    if (saved) { const n = parseInt(saved, 10); if (n > 0) return n }
    return config.trendDuration ?? 60
  })
  useEffect(() => {
    localStorage.setItem(durationKey, String(durationMinutes))
  }, [durationKey, durationMinutes])
  // Ring buffers live at module scope — survive unmount/remount (full-screen toggle, etc.)
  const buffers      = useRef(getPaneBuffers(config.id))
  const lastAppendedTs = useRef(getPaneLastTs(config.id))

  // Trim buffer whenever the window changes (covers both mount and toolbar changes).
  // Shrinking the window removes data that is now out of range; expanding leaves
  // the existing data in place — the seed query fetches the historical gap.
  useEffect(() => {
    const cutoff = Date.now() / 1000 - durationMinutes * 60
    let changed = false
    buffers.current.forEach((buf, id) => {
      const trimmed = buf.filter((e) => e.ts >= cutoff)
      if (trimmed.length < buf.length) { buffers.current.set(id, trimmed); changed = true }
    })
    if (changed) setTick((t) => t + 1)
  }, [durationMinutes])

  // Force chart re-render on new data; _tick read via chartData dependency below
  const [_tick, setTick] = useState(0)

  const { mode: playbackMode, timeRange } = usePlaybackStore()
  const isHistorical = playbackMode === 'historical'

  // Legend hover tooltip
  const [legendTip, setLegendTip] = useState<{ meta: PointMeta; x: number; y: number } | null>(null)

  const { data: metaMap } = usePointMeta(pointIds)
  const { values } = useWebSocket(isHistorical ? [] : pointIds)

  // Historical: fetch series data for the playback time range.
  // pointsApi.history returns HistoryResult { point_id, resolution, start, end, rows: HistoryRow[] }
  // wrapped in ApiResponse, so r.data is the HistoryResult object and rows are at r.data.rows.
  const { data: historicalSeries } = useQuery({
    queryKey: ['trend-historical', pointIds.join(','), timeRange.start, timeRange.end],
    queryFn: async () => {
      const results = await Promise.all(
        pointIds.map((id) =>
          pointsApi.history(id, {
            start: new Date(timeRange.start).toISOString(),
            end: new Date(timeRange.end).toISOString(),
            resolution: 'auto',
            limit: 2000,
          }),
        ),
      )
      const map = new Map<string, RingBuffer[]>()
      results.forEach((r, i) => {
        if (r.success && r.data?.rows) {
          map.set(pointIds[i], r.data.rows.map((row) => ({
            ts: new Date(row.timestamp).getTime() / 1000,
            v: typeof row.value === 'number' ? row.value
              : typeof row.avg === 'number' ? row.avg
              : NaN,
          })))
        }
      })
      return map
    },
    enabled: isHistorical && pointIds.length > 0,
  })

  // Live seed: pre-populate ring buffers on mount or when duration changes.
  // Gap-aware: checks both ends of the existing buffer to determine what to fetch.
  //
  //  • Buffer empty, or oldest entry is after window start (window expanded beyond
  //    what we have) → fetch from window start to oldest buffered point so we fill
  //    the historical gap. WS live updates cover the tiny recent gap.
  //
  //  • Buffer already reaches back to window start → only fetch from latest buffered
  //    point to now (e.g. after a full-screen toggle or short reconnect gap).
  const seedQuery = useQuery({
    queryKey: ['trend-seed', pointIds.join(','), durationMinutes],
    queryFn: async () => {
      const now = new Date()
      const nowSec = now.getTime() / 1000
      const windowStart = new Date(now.getTime() - durationMinutes * 60 * 1000)
      const cutoff = nowSec - durationMinutes * 60

      const results = await Promise.all(
        pointIds.map((id) => {
          const existing = buffers.current.get(id) ?? []
          const inWindow = existing.filter((e) => e.ts >= cutoff)

          if (inWindow.length === 0) {
            // Nothing in window — full seed
            return pointsApi.history(id, {
              start: windowStart.toISOString(),
              end: now.toISOString(),
              resolution: seedResolution(durationMinutes),
              limit: seedLimit(durationMinutes),
            })
          }

          const earliestTs = inWindow[0].ts
          const latestTs = inWindow[inWindow.length - 1].ts

          if (earliestTs > cutoff + 60) {
            // Buffer doesn't reach the window start (window was expanded).
            // Fetch the historical gap from window start up to what we already have.
            const gapMinutes = (earliestTs - cutoff) / 60
            return pointsApi.history(id, {
              start: windowStart.toISOString(),
              end: new Date(earliestTs * 1000).toISOString(),
              resolution: seedResolution(gapMinutes),
              limit: seedLimit(gapMinutes),
            })
          }

          // Buffer covers the window start — fill only the recent gap.
          const fetchMinutes = (nowSec - latestTs) / 60
          return pointsApi.history(id, {
            start: new Date(latestTs * 1000).toISOString(),
            end: now.toISOString(),
            resolution: seedResolution(fetchMinutes),
            limit: seedLimit(fetchMinutes),
          })
        }),
      )

      results.forEach((r, i) => {
        if (!r.success || !r.data?.rows) return
        const id = pointIds[i]
        const existing = buffers.current.get(id) ?? []
        const existingTs = new Set(existing.map((e) => e.ts))
        const newEntries: RingBuffer[] = r.data.rows
          .map((row) => ({
            ts: Math.round(new Date(row.timestamp).getTime() / 1000),
            // Aggregate resolutions return null value with avg/min/max fields.
            // Fall back to midpoint of min/max if avg is absent (e.g. older data
            // with aggregation_types = 0 that predates the migration).
            v: typeof row.value === 'number' ? row.value
              : typeof row.avg === 'number' ? row.avg
              : (typeof row.min === 'number' && typeof row.max === 'number')
                ? (row.min + row.max) / 2
              : NaN,
          }))
          .filter((e) => e.ts >= cutoff && !isNaN(e.ts) && !existingTs.has(e.ts))
        if (newEntries.length > 0) {
          buffers.current.set(id, [...existing, ...newEntries].sort((a, b) => a.ts - b.ts))
        }
      })
      setTick((t) => t + 1)
      return null
    },
    enabled: !isHistorical && pointIds.length > 0,
    staleTime: Infinity, // run once per mount; gcTime:0 evicts on unmount so remount re-runs
    gcTime: 0,
  })

  // Accumulate incoming values into ring buffers.
  // The values Map holds the latest value for ALL subscribed points, and a new
  // Map reference is created on every WebSocket message. Without the lastAppendedTs
  // guard, iterating values.forEach on every update would re-append the unchanged
  // "latest value" for every other point, filling MAX_BUFFER with duplicates and
  // shrinking effective history from 60 min down to 60/N min for N points.
  //
  // Ticks are bucketed to match the seed resolution so live data stays visually
  // consistent with the historical aggregates (no jagged full-Hz tail on smooth
  // 5-min or 1-hour historical data). Each incoming tick overwrites the last
  // entry when it falls in the same bucket.
  useEffect(() => {
    if (values.size === 0) return

    const res = seedResolution(durationMinutes)
    const bucketSec = res === '1h' ? 3600 : res === '5m' ? 300 : 1

    const cutoff = Date.now() / 1000 - durationMinutes * 60
    let changed = false

    values.forEach((pv) => {
      const rawTs = new Date(pv.timestamp).getTime() / 1000
      if (isNaN(rawTs)) return
      const ts = bucketSec > 1 ? Math.floor(rawTs / bucketSec) * bucketSec : Math.round(rawTs)

      // Skip if this point's bucket hasn't changed — stale carry-over from the
      // accumulated values Map.
      if (lastAppendedTs.current.get(pv.pointId) === ts) return

      lastAppendedTs.current.set(pv.pointId, ts)

      const buf = buffers.current.get(pv.pointId) ?? []

      // Overwrite last entry if it's the same bucket (latest value wins),
      // otherwise append. Avoids accumulating multiple ticks per bucket.
      const last = buf[buf.length - 1]
      let next: RingBuffer[]
      if (last && last.ts === ts) {
        next = [...buf.slice(0, -1), { ts, v: pv.value }]
      } else {
        next = [...buf, { ts, v: pv.value }]
      }

      // Trim to window
      next = next.filter((entry) => entry.ts >= cutoff)

      // Cap buffer so it doesn't grow unbounded
      const cap = maxBuffer(durationMinutes)
      if (next.length > cap) next = next.slice(next.length - cap)

      buffers.current.set(pv.pointId, next)
      changed = true
    })

    if (changed) setTick((t) => t + 1)
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
      const data = timestamps.map((ts) => bufMap.get(ts) ?? null)
      return {
        label: metaMap?.get(id)?.name ?? id,
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
      data-trend-pane
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
        {pointIds.map((id, idx) => {
          const meta = metaMap?.get(id)
          return (
            <div
              key={id}
              style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, cursor: 'default' }}
              onMouseEnter={(e) => {
                if (!meta) return
                const r = e.currentTarget.getBoundingClientRect()
                const parent = e.currentTarget.closest('[data-trend-pane]')?.getBoundingClientRect()
                setLegendTip({
                  meta,
                  x: r.left - (parent?.left ?? 0),
                  y: r.bottom - (parent?.top ?? 0) + 4,
                })
              }}
              onMouseLeave={() => setLegendTip(null)}
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
                {meta?.name ?? id}
              </span>
            </div>
          )
        })}
      </div>

      {/* Legend hover tooltip */}
      {legendTip && (
        <div
          style={{
            position: 'absolute',
            left: legendTip.x,
            top: legendTip.y,
            zIndex: 100,
            pointerEvents: 'none',
            background: 'var(--io-surface-elevated)',
            border: '1px solid var(--io-border)',
            borderRadius: 6,
            padding: '7px 11px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
            fontSize: 12,
            color: 'var(--io-text-primary)',
            maxWidth: 260,
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: legendTip.meta.description ? 3 : 0 }}>
            {legendTip.meta.name}
          </div>
          {legendTip.meta.description && (
            <div style={{ color: 'var(--io-text-muted)', fontSize: 11, marginBottom: 4 }}>
              {legendTip.meta.description}
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, fontSize: 10, color: 'var(--io-text-muted)', marginTop: 2 }}>
            {legendTip.meta.unit && <span>{legendTip.meta.unit}</span>}
            {legendTip.meta.source && <span>{legendTip.meta.source}</span>}
          </div>
        </div>
      )}

      {/* Chart */}
      <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
        {seedQuery.isFetching && (
          <div style={{
            position: 'absolute', top: 6, right: 8, zIndex: 10,
            fontSize: 10, color: 'var(--io-text-muted)',
            pointerEvents: 'none',
          }}>
            Loading…
          </div>
        )}
        <TimeSeriesChart
          key={`${config.id}-${durationMinutes}`}
          timestamps={chartData.timestamps}
          series={chartData.series}
          xRange={{ min: Date.now() / 1000 - durationMinutes * 60, max: Date.now() / 1000 }}
        />
      </div>

      {/* Toolbar */}
      <ChartToolbar
        durationMinutes={durationMinutes}
        onDurationChange={setDurationMinutes}
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
