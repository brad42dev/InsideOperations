// ---------------------------------------------------------------------------
// Chart 24 — Shewhart Control Chart
// Fetches historical data, computes control limits (UCL/LCL/sigma zones),
// applies Western Electric rules, and renders via TimeSeriesChart.
// ---------------------------------------------------------------------------

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import * as math from 'mathjs'
import TimeSeriesChart, { type Series } from '../TimeSeriesChart'
import { type ChartConfig, slotLabel } from '../chart-config-types'
import { ChartLegendLayout, type LegendItem } from '../ChartLegend'
import { pointsApi } from '../../../../api/points'
import { useHighlight } from '../hooks/useHighlight'

interface RendererProps {
  config: ChartConfig
  bufferKey: string
}

// Western Electric Rules — returns true if the index is a violation
function weRules(values: number[], mean: number, sigma: number, i: number): boolean {
  const v = values[i]

  // Rule 1: one point beyond 3σ
  if (Math.abs(v - mean) > 3 * sigma) return true

  // Rule 2: nine consecutive points on same side of center
  if (i >= 8) {
    const side = v > mean ? 1 : -1
    if (values.slice(i - 8, i + 1).every((x) => (x > mean ? 1 : -1) === side)) return true
  }

  // Rule 3: six consecutive points trending in same direction
  if (i >= 5) {
    const seg = values.slice(i - 5, i + 1)
    let allUp = true, allDown = true
    for (let j = 1; j < seg.length; j++) {
      if (seg[j] <= seg[j - 1]) allUp = false
      if (seg[j] >= seg[j - 1]) allDown = false
    }
    if (allUp || allDown) return true
  }

  // Rule 4: two of three consecutive points beyond 2σ on same side
  if (i >= 2) {
    const seg = [values[i - 2], values[i - 1], values[i]]
    const beyond2SigmaPos = seg.filter((x) => x > mean + 2 * sigma).length
    const beyond2SigmaNeg = seg.filter((x) => x < mean - 2 * sigma).length
    if (beyond2SigmaPos >= 2 || beyond2SigmaNeg >= 2) return true
  }

  return false
}

export default function Chart24Shewhart({ config }: RendererProps) {
  const { highlighted, toggle } = useHighlight()
  const pointSlot = config.points.find((p) => p.role === 'point')
  const legendItems: LegendItem[] = pointSlot ? [{ label: slotLabel(pointSlot), color: '#4A9EFF' }] : []
  const pointId = pointSlot?.pointId ?? null

  const durationMinutes = config.durationMinutes ?? 120
  const nowISO = new Date().toISOString()
  // Truncate to nearest minute so the query key is stable within a minute window,
  // preventing TanStack Query from refetching on every render.
  const startISO = new Date(Math.floor((Date.now() - durationMinutes * 60_000) / 60_000) * 60_000).toISOString()

  const { data: histResult, isFetching } = useQuery({
    queryKey: ['chart24-shewhart', pointId, startISO],
    queryFn: () =>
      pointsApi.history(pointId!, {
        start: startISO,
        end: nowISO,
        resolution: 'auto',
        limit: 500,
      }),
    enabled: !!pointId,
    staleTime: 30_000,
  })

  const { timestamps, series, xRange } = useMemo(() => {
    const rows =
      histResult?.success && histResult.data?.rows ? histResult.data.rows : []
    if (rows.length < 4) return { timestamps: [], series: [], xRange: undefined }

    const tsArr = rows.map((r) => new Date(r.timestamp).getTime() / 1000)
    const vals = rows.map((r) => (r.value ?? r.avg) as number | null).filter((v): v is number => v !== null)

    if (vals.length < 4) return { timestamps: [], series: [], xRange: undefined }

    const mean = math.mean(vals) as number
    const sigma = math.std(vals) as unknown as number  // sample std dev (N-1), correct for SPC

    const ucl = mean + 3 * sigma
    const lcl = mean - 3 * sigma

    // Map vals back to full row indices (skip nulls by reindexing)
    const valIdx: number[] = []
    rows.forEach((r, i) => {
      if ((r.value ?? r.avg) !== null) valIdx.push(i)
    })

    const dataArr: (number | null)[] = rows.map((r) => (r.value ?? r.avg ?? null) as number | null)
    const uclArr: (number | null)[] = rows.map(() => ucl)
    const lclArr: (number | null)[] = rows.map(() => lcl)
    const meanArr: (number | null)[] = rows.map(() => mean)

    // Violation markers — null everywhere except violation indices
    const violationArr: (number | null)[] = rows.map(() => null)
    vals.forEach((v, vi) => {
      if (weRules(vals, mean, sigma, vi)) {
        const rowIdx = valIdx[vi]
        if (rowIdx !== undefined) violationArr[rowIdx] = v
      }
    })

    const builtSeries: Series[] = [
      {
        label: pointSlot ? slotLabel(pointSlot) : 'Value',
        data: dataArr,
        color: pointSlot?.color ?? '#4A9EFF',
        strokeWidth: 1.5,
      },
      {
        label: 'Mean',
        data: meanArr,
        color: '#10B981',
        strokeWidth: 1,
      },
      {
        label: 'UCL',
        data: uclArr,
        color: '#EF4444',
        strokeWidth: 1,
      },
      {
        label: 'LCL',
        data: lclArr,
        color: '#EF4444',
        strokeWidth: 1,
      },
      {
        label: 'Violations',
        data: violationArr,
        color: '#EF4444',
        strokeWidth: 0,
      },
    ]

    return {
      timestamps: tsArr,
      series: builtSeries,
      xRange: { min: tsArr[0], max: tsArr[tsArr.length - 1] },
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [histResult])

  if (!pointSlot) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
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
        {isFetching && (
          <div
            style={{
              position: 'absolute',
              top: 4,
              right: 8,
              fontSize: 11,
              color: 'var(--io-text-muted)',
              zIndex: 10,
              pointerEvents: 'none',
            }}
          >
            Loading…
          </div>
        )}
        {timestamps.length === 0 && !isFetching ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--io-text-muted)',
              fontSize: 13,
            }}
          >
            Insufficient data for control chart
          </div>
        ) : (
          <div style={{ flex: 1, minHeight: 0 }}>
            <TimeSeriesChart timestamps={timestamps} series={series} xRange={xRange} />
          </div>
        )}
      </div>
    </ChartLegendLayout>
  )
}
