// ---------------------------------------------------------------------------
// Chart 30 — EWMA Chart
// Exponentially Weighted Moving Average SPC chart.
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

export default function Chart30Ewma({ config }: RendererProps) {
  const { highlighted, toggle } = useHighlight()
  const pointSlot = config.points.find((p) => p.role === 'point')
  const legendItems: LegendItem[] = pointSlot ? [{ label: slotLabel(pointSlot), color: '#4A9EFF' }] : []
  const pointId = pointSlot?.pointId ?? null

  const lambda = typeof config.extras?.lambda === 'number' ? config.extras.lambda : 0.2
  const L = typeof config.extras?.l === 'number' ? config.extras.l : 3
  const showRawData = config.extras?.showRawData === true

  const durationMinutes = config.durationMinutes ?? 120
  const nowISO = new Date().toISOString()
  const startISO = new Date(Date.now() - durationMinutes * 60_000).toISOString()

  const { data: histResult, isFetching } = useQuery({
    queryKey: ['chart30-ewma', pointId, startISO, lambda, L],
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
    const vals = rows
      .map((r) => (r.value ?? r.avg ?? null) as number | null)
      .filter((v): v is number => v !== null)

    if (vals.length < 4) return { timestamps: [], series: [], xRange: undefined }

    const mean = math.mean(vals) as number
    const sigma = math.std(vals, 'uncorrected') as number

    let ewmaVal = mean
    const ewmaValues: number[] = []
    const uclValues: number[] = []
    const lclValues: number[] = []

    vals.forEach((v, i) => {
      ewmaVal = lambda * v + (1 - lambda) * ewmaVal
      ewmaValues.push(ewmaVal)
      const sigmaEwma =
        sigma * Math.sqrt((lambda / (2 - lambda)) * (1 - (1 - lambda) ** (2 * (i + 1))))
      uclValues.push(mean + L * sigmaEwma)
      lclValues.push(mean - L * sigmaEwma)
    })

    // Align back to all rows (including nulls)
    let vi = 0
    const fullEwma: (number | null)[] = []
    const fullUcl: (number | null)[] = []
    const fullLcl: (number | null)[] = []
    const fullRaw: (number | null)[] = []
    const fullMean: (number | null)[] = []

    rows.forEach((r) => {
      const v = (r.value ?? r.avg ?? null) as number | null
      fullMean.push(mean)
      fullRaw.push(v)
      if (v !== null) {
        fullEwma.push(ewmaValues[vi] ?? null)
        fullUcl.push(uclValues[vi] ?? null)
        fullLcl.push(lclValues[vi] ?? null)
        vi++
      } else {
        fullEwma.push(null)
        fullUcl.push(null)
        fullLcl.push(null)
      }
    })

    const builtSeries: Series[] = [
      {
        label: 'EWMA',
        data: fullEwma,
        color: '#4A9EFF',
        strokeWidth: 2,
      },
      {
        label: 'UCL',
        data: fullUcl,
        color: '#EF4444',
        strokeWidth: 1,
      },
      {
        label: 'LCL',
        data: fullLcl,
        color: '#EF4444',
        strokeWidth: 1,
      },
      {
        label: 'Mean',
        data: fullMean,
        color: '#10B981',
        strokeWidth: 1,
      },
    ]

    if (showRawData) {
      builtSeries.unshift({
        label: pointSlot ? slotLabel(pointSlot) : 'Raw',
        data: fullRaw,
        color: '#8B5CF6',
        strokeWidth: 1,
      })
    }

    return {
      timestamps: tsArr,
      series: builtSeries,
      xRange: { min: tsArr[0], max: tsArr[tsArr.length - 1] },
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [histResult, lambda, L, showRawData])

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
            Insufficient data for EWMA chart
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
