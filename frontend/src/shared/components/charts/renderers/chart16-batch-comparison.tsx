// ---------------------------------------------------------------------------
// Chart 16 — Batch Comparison
// Overlays multiple historical time windows on a relative time axis (offset
// from each batch's start time). Each batch is a separate series.
//
// extras.batches: { label: string; start: string; end: string }[]
// ---------------------------------------------------------------------------

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import TimeSeriesChart, { type Series } from '../TimeSeriesChart'
import { type ChartConfig, autoColor } from '../chart-config-types'
import { ChartLegendLayout, type LegendItem } from '../ChartLegend'
import { pointsApi } from '../../../../api/points'
import { useHighlight } from '../hooks/useHighlight'

interface BatchDef {
  label: string
  start: string
  end: string
}

interface RendererProps {
  config: ChartConfig
  bufferKey: string
}

function parseBatches(extras: Record<string, unknown> | undefined): BatchDef[] {
  if (!extras || !Array.isArray(extras.batches)) return []
  return (extras.batches as unknown[]).filter(
    (b): b is BatchDef =>
      typeof b === 'object' &&
      b !== null &&
      typeof (b as BatchDef).label === 'string' &&
      typeof (b as BatchDef).start === 'string' &&
      typeof (b as BatchDef).end === 'string',
  )
}

export default function Chart16BatchComparison({ config }: RendererProps) {
  const { highlighted, toggle } = useHighlight()
  const batches = parseBatches(config.extras)
  // Use the first 'series' point for comparison (or any point-role).
  const primarySlot = config.points.find((p) => p.role === 'series') ?? config.points[0] ?? null
  const pointId = primarySlot?.pointId ?? null

  const queryEnabled = batches.length > 0 && pointId !== null

  // Fetch each batch independently. We use a single query key that encodes all
  // batches so React Query caches the full set as one unit.
  const batchesKey = useMemo(
    () => batches.map((b) => `${b.label}:${b.start}:${b.end}`).join('|'),
    [batches],
  )

  const { data: batchData, isFetching } = useQuery({
    queryKey: ['chart16-batch', pointId, batchesKey],
    queryFn: async () => {
      if (!pointId) return []
      const results = await Promise.all(
        batches.map((batch) =>
          pointsApi.history(pointId, {
            start: new Date(batch.start).toISOString(),
            end: new Date(batch.end).toISOString(),
            resolution: 'auto',
            limit: 2000,
          }),
        ),
      )
      return results.map((r, i) => ({
        batch: batches[i],
        rows: r.success && r.data?.rows ? r.data.rows : [],
      }))
    },
    enabled: queryEnabled,
    staleTime: 5 * 60 * 1000,
  })

  // Build aligned time-series: all batches mapped to offset-from-start (seconds).
  // Find the maximum relative duration across batches to define the X window.
  const { timestamps, series, xRange } = useMemo(() => {
    if (!batchData || batchData.length === 0) {
      return { timestamps: [], series: [], xRange: undefined }
    }

    // For each batch, build offset→value pairs.
    const batchSeries: Array<{ label: string; points: Map<number, number | null> }> = batchData.map(
      ({ batch, rows }) => {
        const startMs = new Date(batch.start).getTime()
        const pts = new Map<number, number | null>()
        for (const row of rows) {
          const offsetSec = Math.round((new Date(row.timestamp).getTime() - startMs) / 1000)
          const v =
            typeof row.value === 'number'
              ? row.value
              : typeof row.avg === 'number'
                ? row.avg
                : null
          pts.set(offsetSec, v)
        }
        return { label: batch.label, points: pts }
      },
    )

    // Union of all offset timestamps, sorted.
    const allOffsets = new Set<number>()
    batchSeries.forEach(({ points }) => points.forEach((_, k) => allOffsets.add(k)))
    const sortedTs = Array.from(allOffsets).sort((a, b) => a - b)

    if (sortedTs.length === 0) {
      return { timestamps: [], series: [], xRange: undefined }
    }

    const maxOffset = sortedTs[sortedTs.length - 1]
    const built: Series[] = batchSeries.map(({ label, points }, i) => ({
      label,
      data: sortedTs.map((t) => points.get(t) ?? null),
      color: autoColor(i),
      strokeWidth: 1.5,
    }))

    return {
      timestamps: sortedTs,
      series: built,
      xRange: { min: 0, max: maxOffset },
    }
  }, [batchData])

  // Empty / unconfigured state
  if (batches.length === 0) {
    return (
      <div
        style={{
          display: 'flex',
          flex: 1,
          minHeight: 0,
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          gap: 8,
          color: 'var(--io-text-muted)',
          fontSize: 13,
        }}
      >
        <span>Configure batches in options</span>
        <span style={{ fontSize: 11 }}>
          Add time ranges to extras.batches to compare batch runs
        </span>
      </div>
    )
  }

  if (!pointId) {
    return (
      <div
        style={{
          display: 'flex',
          flex: 1,
          minHeight: 0,
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--io-text-muted)',
          fontSize: 13,
        }}
      >
        No point configured
      </div>
    )
  }

  const legendItems: LegendItem[] = series.map((s, i) => ({
    label: s.label,
    color: s.color ?? autoColor(i),
  }))

  return (
    <ChartLegendLayout legend={config.legend} items={legendItems} highlighted={highlighted} onHighlight={toggle}>
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
        position: 'relative',
      }}
    >
      {/* X axis hint */}
      <div
        style={{
          padding: '3px 8px',
          fontSize: 10,
          color: 'var(--io-text-muted)',
          background: 'var(--io-surface)',
          borderBottom: '1px solid var(--io-border)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexShrink: 0,
        }}
      >
        <span>X axis: offset from batch start (seconds)</span>

        {isFetching && (
          <span style={{ marginLeft: 8, color: 'var(--io-text-muted)' }}>Loading…</span>
        )}
      </div>

      <div style={{ flex: 1, minHeight: 0 }}>
        <TimeSeriesChart
          timestamps={timestamps}
          series={series}
          xRange={xRange}
        />
      </div>
    </div>
    </ChartLegendLayout>
  )
}
