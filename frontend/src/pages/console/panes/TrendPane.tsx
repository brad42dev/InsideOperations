import { useCallback, useEffect, useRef, useState, lazy, Suspense } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useWebSocket } from '../../../shared/hooks/useWebSocket'
import { usePlaybackStore } from '../../../store/playback'
import TimeSeriesChart, { type Series } from '../../../shared/components/charts/TimeSeriesChart'
import ChartToolbar, { INSTANT_READOUT_CHART_TYPES } from '../../../shared/components/charts/ChartToolbar'
import { pointsApi } from '../../../api/points'
import type { PaneConfig } from '../types'
import type { ChartConfig } from '../../../shared/components/charts/chart-config-types'
import { useWorkspaceStore } from '../../../store/workspaceStore'

const ChartConfigPanel = lazy(() => import('../../../shared/components/charts/ChartConfigPanel'))
const ChartRenderer = lazy(() => import('../../../shared/components/charts/ChartRenderer'))

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
function seedResolution(minutes: number): 'raw' | '5m' | '1h' {
  if (minutes <= 120)   return 'raw'
  if (minutes <= 10080) return '5m'
  return '1h'
}

function seedLimit(minutes: number): number {
  if (minutes <= 120)   return 7_500
  if (minutes <= 10080) return 2_500
  return 2_000
}

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
  const [showConfig, setShowConfig] = useState(false)
  const { updatePane, activeId } = useWorkspaceStore()

  // If a full ChartConfig is present, delegate to ChartRenderer entirely.
  // Legacy mode uses the inline trend logic below.
  const chartConfig = config.chartConfig

  // ── Legacy trend mode ──────────────────────────────────────────────────────
  const pointIds = config.trendPointIds ?? []

  const durationKey = `io_trend_duration_${config.id}`
  const [durationMinutes, setDurationMinutes] = useState(() => {
    const saved = localStorage.getItem(durationKey)
    if (saved) { const n = parseInt(saved, 10); if (n > 0) return n }
    return config.trendDuration ?? 60
  })
  useEffect(() => {
    localStorage.setItem(durationKey, String(durationMinutes))
  }, [durationKey, durationMinutes])

  const buffers         = useRef(getPaneBuffers(config.id))
  const lastAppendedTs  = useRef(getPaneLastTs(config.id))

  useEffect(() => {
    const cutoff = Date.now() / 1000 - durationMinutes * 60
    let changed = false
    buffers.current.forEach((buf, id) => {
      const trimmed = buf.filter((e) => e.ts >= cutoff)
      if (trimmed.length < buf.length) { buffers.current.set(id, trimmed); changed = true }
    })
    if (changed) setTick((t) => t + 1)
  }, [durationMinutes])

  const [_tick, setTick] = useState(0)

  const { mode: playbackMode, timeRange } = usePlaybackStore()
  const isHistorical = playbackMode === 'historical'

  const [legendTip, setLegendTip] = useState<{ meta: PointMeta; x: number; y: number } | null>(null)
  const [highlighted, setHighlighted] = useState<Set<string>>(new Set())
  const toggleHighlight = useCallback((label: string, multi: boolean) => {
    setHighlighted((prev) => {
      const next = new Set(prev)
      if (multi) {
        if (next.has(label)) next.delete(label)
        else next.add(label)
        return next
      }
      if (next.size === 1 && next.has(label)) return new Set()
      return new Set([label])
    })
  }, [])

  const { data: metaMap } = usePointMeta(pointIds)
  const { values } = useWebSocket(isHistorical ? [] : pointIds)

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
            const gapMinutes = (earliestTs - cutoff) / 60
            return pointsApi.history(id, {
              start: windowStart.toISOString(),
              end: new Date(earliestTs * 1000).toISOString(),
              resolution: seedResolution(gapMinutes),
              limit: seedLimit(gapMinutes),
            })
          }

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
    enabled: !isHistorical && pointIds.length > 0 && !chartConfig,
    staleTime: Infinity,
    gcTime: 0,
  })

  useEffect(() => {
    if (values.size === 0) return

    const res = seedResolution(durationMinutes)
    const bucketSec = res === '1h' ? 3600 : res === '5m' ? 300 : 1

    const cutoff = Date.now() / 1000 - durationMinutes * 60
    let changed = false

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    values.forEach((pv: any) => {
      const rawTs = new Date(pv.timestamp).getTime() / 1000
      if (isNaN(rawTs)) return
      const ts = bucketSec > 1 ? Math.floor(rawTs / bucketSec) * bucketSec : Math.round(rawTs)

      if (lastAppendedTs.current.get(pv.pointId) === ts) return

      lastAppendedTs.current.set(pv.pointId, ts)

      const buf = buffers.current.get(pv.pointId) ?? []

      const last = buf[buf.length - 1]
      let next: RingBuffer[]
      if (last && last.ts === ts) {
        next = [...buf.slice(0, -1), { ts, v: pv.value }]
      } else {
        next = [...buf, { ts, v: pv.value }]
      }

      next = next.filter((entry) => entry.ts >= cutoff)

      const cap = maxBuffer(durationMinutes)
      if (next.length > cap) next = next.slice(next.length - cap)

      buffers.current.set(pv.pointId, next)
      changed = true
    })

    if (changed) setTick((t) => t + 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values])

  // Build chart data (legacy mode only)
  const chartData = (() => {
    if (pointIds.length === 0) return { timestamps: [] as number[], series: [] as Series[] }

    const sourceMap: Map<string, RingBuffer[]> = isHistorical && historicalSeries
      ? historicalSeries
      : buffers.current

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

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleSaveConfig(newConfig: ChartConfig) {
    if (activeId) updatePane(activeId, { ...config, chartConfig: newConfig })
  }

  // ── Render: ChartRenderer mode (when chartConfig present) ─────────────────
  if (chartConfig) {
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
        <Suspense fallback={null}>
          <ChartRenderer config={chartConfig} bufferKey={config.id} />
        </Suspense>

        <ChartToolbar
          durationMinutes={chartConfig.durationMinutes ?? durationMinutes}
          onDurationChange={(m) => handleSaveConfig({ ...chartConfig, durationMinutes: m })}
          onConfigure={() => setShowConfig(true)}
          allowSeconds={INSTANT_READOUT_CHART_TYPES.has(chartConfig.chartType)}
        />

        {showConfig && (
          <Suspense fallback={null}>
            <ChartConfigPanel
              initialConfig={chartConfig}
              onSave={handleSaveConfig}
              onClose={() => setShowConfig(false)}
              context="console"
            />
          </Suspense>
        )}
      </div>
    )
  }

  // ── Render: legacy mode (no chartConfig) ──────────────────────────────────

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
        <button
          onClick={() => setShowConfig(true)}
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
          Configure Chart
        </button>
        {showConfig && (
          <Suspense fallback={null}>
            <ChartConfigPanel
              initialConfig={{ chartType: 1, points: [], durationMinutes: 60 }}
              onSave={handleSaveConfig}
              onClose={() => setShowConfig(false)}
              context="console"
            />
          </Suspense>
        )}
        {editMode && (
          <button
            onClick={() => onConfigurePoints?.(config.id)}
            style={{
              background: 'var(--io-surface-secondary)',
              color: 'var(--io-text-muted)',
              border: '1px solid var(--io-border)',
              borderRadius: 6,
              padding: '6px 12px',
              cursor: 'pointer',
              fontSize: 12,
            }}
          >
            Legacy Point Config
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
          const label = meta?.name ?? id
          const isActive = highlighted.size === 0 || highlighted.has(label)
          return (
            <div
              key={id}
              onClick={(e) => { e.stopPropagation(); toggleHighlight(label, e.ctrlKey || e.metaKey) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 5, fontSize: 11,
                cursor: 'pointer', userSelect: 'none',
                opacity: isActive ? 1 : 0.35,
                transition: 'opacity 0.15s',
              }}
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
              <span style={{ color: 'var(--io-text-muted)', fontWeight: highlighted.has(label) ? 700 : 400 }}>
                {label}
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
          highlighted={highlighted}
          onSeriesClick={toggleHighlight}
        />
      </div>

      {/* Toolbar */}
      <ChartToolbar
        durationMinutes={durationMinutes}
        onDurationChange={setDurationMinutes}
        onConfigure={() => setShowConfig(true)}
      />

      {showConfig && (
        <Suspense fallback={null}>
          <ChartConfigPanel
            initialConfig={{ chartType: 1, points: pointIds.map((id, i) => ({ slotId: `series-${i}`, role: 'series', pointId: id })), durationMinutes }}
            onSave={handleSaveConfig}
            onClose={() => setShowConfig(false)}
            context="console"
          />
        </Suspense>
      )}

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
