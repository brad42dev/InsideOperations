// ---------------------------------------------------------------------------
// Chart 19 — Box Plot
// One box per series point. Computes statistics client-side from history.
// ---------------------------------------------------------------------------

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import EChart from '../EChart'
import { type ChartConfig, autoColor, slotLabel } from '../chart-config-types'
import { ChartLegendLayout, type LegendItem } from '../ChartLegend'
import { usePlaybackStore } from '../../../../store/playback'
import { pointsApi } from '../../../../api/points'
import { useHighlight } from '../hooks/useHighlight'
import { getEChartsClickKey, getEChartsClickMulti } from '../chart-highlight-utils'

interface RendererProps {
  config: ChartConfig
  bufferKey: string
}

function resolveToken(token: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim()
}

function computeBoxStats(values: number[]) {
  const sorted = [...values].filter((v) => isFinite(v)).sort((a, b) => a - b)
  if (sorted.length < 4) return null
  const q1 = sorted[Math.floor(sorted.length * 0.25)]
  const median = sorted[Math.floor(sorted.length * 0.5)]
  const q3 = sorted[Math.floor(sorted.length * 0.75)]
  const iqr = q3 - q1
  const lower = sorted.find((v) => v >= q1 - 1.5 * iqr) ?? sorted[0]
  const upper = [...sorted].reverse().find((v) => v <= q3 + 1.5 * iqr) ?? sorted[0]
  const outliers = values.filter((v) => v < lower || v > upper)
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  return { q1, median, q3, lower, upper, outliers, mean }
}

export default function BoxPlotChart({ config }: RendererProps) {
  const seriesSlots = config.points.filter((p) => p.role === 'series')
  const legendItems: LegendItem[] = seriesSlots.map((slot, i) => ({ label: slotLabel(slot), color: slot.color ?? autoColor(i) }))
  const pointIds = seriesSlots.map((p) => p.pointId)

  const { highlighted, toggle } = useHighlight()

  const onEvents = useMemo(
    () => ({
      click: (params: unknown) => {
        const key = getEChartsClickKey(params)
        if (!key) return
        toggle(key, getEChartsClickMulti(params))
      },
    }),
    [toggle],
  )
  const durationMinutes = config.durationMinutes ?? 60
  const showMean = config.extras?.showMean === true
  const showPoints = config.extras?.showPoints === true
  const horizontal = config.extras?.orientation === 'horizontal'

  const { mode: playbackMode, timeRange } = usePlaybackStore()
  const isHistorical = playbackMode === 'historical'

  const end = isHistorical ? new Date(timeRange.end).toISOString() : new Date().toISOString()
  const start = isHistorical
    ? new Date(timeRange.start).toISOString()
    : new Date(Date.now() - durationMinutes * 60 * 1000).toISOString()

  const { data: historyBatch, isLoading } = useQuery({
    queryKey: ['history-batch', ...pointIds, start, end],
    queryFn: () => pointsApi.historyBatch(pointIds, { start, end, limit: 2000 }),
    enabled: pointIds.length > 0,
    select: (res) => (res.success ? res.data : []),
  })

  const { names, boxData, outlierData, allPointsData, meanData } = useMemo<{
    names: string[]
    boxData: [number, number, number, number, number][]
    outlierData: [number, number][]
    allPointsData: [number, number][]
    meanData: { xAxis?: number; yAxis?: number }[]
  }>(() => {
    const names: string[] = []
    const boxData: [number, number, number, number, number][] = []
    const outlierData: [number, number][] = []
    const allPointsData: [number, number][] = []
    const meanData: { xAxis?: number; yAxis?: number }[] = []

    seriesSlots.forEach((slot, i) => {
      const batch = historyBatch?.find((r) => r.point_id === slot.pointId)
      const vals = (batch?.rows ?? [])
        .map((r) => r.value)
        .filter((v): v is number => v !== null && v !== undefined)
      const stats = computeBoxStats(vals)
      names.push(slotLabel(slot))
      if (stats) {
        boxData.push([stats.lower, stats.q1, stats.median, stats.q3, stats.upper])
        stats.outliers.forEach((o) => {
          outlierData.push(horizontal ? [o, i] : [i, o])
        })
        if (showPoints) {
          vals.forEach((v) => allPointsData.push(horizontal ? [v, i] : [i, v]))
        }
        if (showMean) {
          meanData.push(horizontal ? { xAxis: stats.mean } : { yAxis: stats.mean })
        }
      } else {
        boxData.push([0, 0, 0, 0, 0])
      }
    })

    return { names, boxData, outlierData, allPointsData, meanData }
  }, [historyBatch, seriesSlots, horizontal, showMean, showPoints])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const option = useMemo<any>(() => {
    const textMuted = resolveToken('--io-text-muted')
    const border = resolveToken('--io-border')

    const categoryAxis = {
      type: 'category' as const,
      data: names,
      axisLabel: { color: textMuted, fontSize: 11 },
      axisLine: { lineStyle: { color: border } },
      axisTick: { show: false },
    }

    const valueAxis = {
      type: 'value' as const,
      axisLabel: { color: textMuted, fontSize: 11 },
      splitLine: { lineStyle: { color: border, opacity: 0.4 } },
    }

    return {
      backgroundColor: 'transparent',
      legend: { show: false },
      tooltip: { trigger: 'item' },
      grid: { left: 48, right: 16, top: 12, bottom: 32, containLabel: true },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      xAxis: (horizontal ? valueAxis : categoryAxis) as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      yAxis: (horizontal ? categoryAxis : valueAxis) as any,
      series: [
        {
          type: 'boxplot',
          data: boxData,
          itemStyle: { color: autoColor(0), borderColor: autoColor(0) },
          ...(showMean && meanData.length > 0 ? { markPoint: { data: meanData.map((m, i) => ({ name: `Mean ${i}`, coord: (horizontal ? [m.xAxis ?? 0, i] : [i, m.yAxis ?? 0]) as [number, number] })) } } : {}),
        },
        {
          type: 'scatter',
          data: outlierData,
          symbolSize: 4,
          itemStyle: { color: '#EF4444', opacity: 0.7 },
        },
        ...(showPoints && allPointsData.length > 0
          ? [{
              type: 'scatter' as const,
              data: allPointsData,
              symbolSize: 3,
              itemStyle: { color: '#4A9EFF', opacity: 0.35 },
              silent: true,
            }]
          : []),
      ],
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [names, boxData, outlierData, allPointsData, meanData, horizontal, showMean, showPoints])

  if (pointIds.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--io-text-muted)', fontSize: 13 }}>
        No points configured
      </div>
    )
  }

  return (
    <ChartLegendLayout legend={config.legend} items={legendItems} highlighted={highlighted} onHighlight={toggle}>
      <div style={{ position: 'relative', flex: 1, minHeight: 0, width: '100%' }}>
        {isLoading && (
          <div style={{ position: 'absolute', top: 4, right: 8, fontSize: 11, color: 'var(--io-text-muted)', zIndex: 10, pointerEvents: 'none' }}>
            Loading…
          </div>
        )}
        <EChart option={option} height={300} onEvents={onEvents} />
      </div>
    </ChartLegendLayout>
  )
}
