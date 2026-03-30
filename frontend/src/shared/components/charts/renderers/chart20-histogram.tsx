// ---------------------------------------------------------------------------
// Chart 20 — Histogram / Violin Plot
// displayMode='histogram': frequency bins with optional normal curve and Cp/Cpk.
// displayMode='violin': Plotly violin with box plot statistics overlaid inside.
// Both modes support horizontal orientation.
// ---------------------------------------------------------------------------

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { EChartsOption } from 'echarts'
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

function computeHistogram(values: number[], binCount: number) {
  const min = Math.min(...values)
  const max = Math.max(...values)
  if (min === max) return []
  const width = (max - min) / binCount
  const bins = Array.from({ length: binCount }, (_, i) => ({
    label: `${(min + i * width).toFixed(2)}–${(min + (i + 1) * width).toFixed(2)}`,
    min: min + i * width,
    max: min + (i + 1) * width,
    count: 0,
  }))
  values.forEach((v) => {
    const idx = Math.min(Math.floor((v - min) / width), binCount - 1)
    if (idx >= 0) bins[idx].count++
  })
  return bins
}

/** Compute kernel density estimate (Gaussian kernel, Silverman's bandwidth) */
function computeKDE(values: number[], points = 100): { x: number; density: number }[] {
  if (values.length < 2) return []
  const n = values.length
  const mean = values.reduce((a, b) => a + b, 0) / n
  const stddev = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / n)
  const h = 1.06 * stddev * Math.pow(n, -0.2) // Silverman's rule
  if (h === 0) return []

  const min = Math.min(...values)
  const max = Math.max(...values)
  const step = (max - min) / points

  return Array.from({ length: points + 1 }, (_, i) => {
    const x = min + i * step
    const density = values.reduce((sum, xi) => {
      const z = (x - xi) / h
      return sum + Math.exp(-0.5 * z * z) / (Math.sqrt(2 * Math.PI) * h)
    }, 0) / n
    return { x, density }
  })
}

function ViolinPlot({ values, color, horizontal }: { values: number[]; color: string; horizontal: boolean }) {
  const textMuted = resolveToken('--io-text-muted')
  const border = resolveToken('--io-border')

  const kde = useMemo(() => computeKDE(values, 80), [values])

  const stats = useMemo(() => {
    if (values.length < 4) return null
    const sorted = [...values].sort((a, b) => a - b)
    const q1 = sorted[Math.floor(sorted.length * 0.25)]
    const median = sorted[Math.floor(sorted.length * 0.5)]
    const q3 = sorted[Math.floor(sorted.length * 0.75)]
    const iqr = q3 - q1
    const lower = sorted.find((v) => v >= q1 - 1.5 * iqr) ?? sorted[0]
    const upper = [...sorted].reverse().find((v) => v <= q3 + 1.5 * iqr) ?? sorted[sorted.length - 1]
    return { q1, median, q3, lower, upper }
  }, [values])

  if (!kde.length || !stats) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: textMuted, fontSize: 13 }}>
        Insufficient data for violin
      </div>
    )
  }

  const maxDensity = Math.max(...kde.map((p) => p.density))
  const violinWidth = 80 // half-width in ECharts data units

  // Build mirrored violin shape as a custom ECharts series
  const violinData = kde.map((p) => {
    const normDensity = maxDensity > 0 ? (p.density / maxDensity) * violinWidth : 0
    return { x: p.x, left: -normDensity, right: normDensity }
  })

  const leftData = violinData.map((d) => [d.left, d.x] as [number, number])
  const rightData = violinData.map((d) => [d.right, d.x] as [number, number])

  const option: EChartsOption = {
    backgroundColor: 'transparent',
    grid: horizontal
      ? { left: 48, right: 16, top: 40, bottom: 32 }
      : { left: 48, right: 16, top: 16, bottom: 32 },
    tooltip: { trigger: 'item' },
    xAxis: horizontal
      ? { type: 'value', name: 'Value', axisLabel: { color: textMuted, fontSize: 10 }, splitLine: { lineStyle: { color: border, opacity: 0.3 } } }
      : { type: 'value', min: -violinWidth - 10, max: violinWidth + 10, show: false, axisLine: { show: false } },
    yAxis: horizontal
      ? { type: 'value', min: -violinWidth - 10, max: violinWidth + 10, show: false, axisLine: { show: false } }
      : { type: 'value', name: 'Value', axisLabel: { color: textMuted, fontSize: 10 }, splitLine: { lineStyle: { color: border, opacity: 0.3 } } },
    series: [
      // Left mirror of violin
      {
        type: 'line',
        data: horizontal ? leftData.map(([d, x]) => [x, d]) : leftData,
        smooth: true,
        symbol: 'none',
        lineStyle: { color, width: 1 },
        areaStyle: { color, opacity: 0.2 },
        z: 2,
      },
      // Right side
      {
        type: 'line',
        data: horizontal ? rightData.map(([d, x]) => [x, d]) : rightData,
        smooth: true,
        symbol: 'none',
        lineStyle: { color, width: 1 },
        areaStyle: { color, opacity: 0.2 },
        z: 2,
      },
      // Median marker
      {
        type: 'scatter',
        data: horizontal ? [[stats.median, 0]] : [[0, stats.median]],
        symbolSize: 8,
        itemStyle: { color: '#fff', borderColor: color, borderWidth: 2 },
        z: 10,
      },
      // IQR box as a thin bar
      {
        type: 'bar',
        barWidth: horizontal ? undefined : 8,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: horizontal ? [[stats.q1, 0, stats.q3 - stats.q1]] : [[0, stats.q1, stats.q3 - stats.q1]] as any,
        itemStyle: { color, opacity: 0.6 },
        z: 5,
      },
    ],
  }

  return <EChart option={option} height={300} />
}

export default function HistogramChart({ config }: RendererProps) {
  const pointSlot = config.points.find((p) => p.role === 'point')
  const legendItems: LegendItem[] = pointSlot ? [{ label: slotLabel(pointSlot), color: pointSlot.color ?? autoColor(0) }] : []

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
  const normalOverlay = config.extras?.normalOverlay === true || config.extras?.showNormal === true
  const extraBinCount = typeof config.extras?.bins === 'number' ? config.extras.bins
    : typeof config.extras?.binCount === 'number' ? config.extras.binCount : null
  const displayMode = (config.extras?.displayMode as string) ?? 'histogram'
  const horizontal = config.extras?.orientation === 'horizontal'

  const { mode: playbackMode, timeRange } = usePlaybackStore()
  const isHistorical = playbackMode === 'historical'

  const end = isHistorical ? new Date(timeRange.end).toISOString() : new Date().toISOString()
  const start = isHistorical
    ? new Date(timeRange.start).toISOString()
    : new Date(Date.now() - durationMinutes * 60 * 1000).toISOString()

  const { data: rows, isLoading } = useQuery({
    queryKey: ['history', pointSlot?.pointId, start, end, 'histogram'],
    queryFn: () => pointsApi.history(pointSlot!.pointId, { start, end, limit: 10000 }),
    enabled: !!pointSlot,
    select: (res) => (res.success ? res.data.rows : []),
  })

  const vals = useMemo(() =>
    (rows ?? [])
      .map((r) => r.value)
      .filter((v): v is number => v !== null && v !== undefined && isFinite(v)),
    [rows]
  )

  const { labels, counts, normalCurve, cpk } = useMemo(() => {
    if (vals.length < 2) return { labels: [], counts: [], normalCurve: [], cpk: null }

    const n = vals.length
    const binCount = extraBinCount ?? Math.ceil(Math.log2(n) + 1)
    const bins = computeHistogram(vals, binCount)

    if (!bins.length) return { labels: [], counts: [], normalCurve: [], cpk: null }

    const mean = vals.reduce((a, b) => a + b, 0) / n
    const stddev = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / n)

    const normalCurveData: number[] = normalOverlay && stddev > 0
      ? bins.map((b) => {
          const x = (b.min + b.max) / 2
          const density = (1 / (stddev * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * ((x - mean) / stddev) ** 2)
          return parseFloat((density * n * ((b.max - b.min))).toFixed(4))
        })
      : []

    const showCapability = config.extras?.showCapability === true
    let cpkResult: { cp: number; cpk: number; mean: number; sigma: number } | null = null
    if (showCapability && stddev > 0) {
      const usl = typeof config.extras?.usl === 'number' ? config.extras.usl : null
      const lsl = typeof config.extras?.lsl === 'number' ? config.extras.lsl : null
      if (usl !== null && lsl !== null) {
        const cp = (usl - lsl) / (6 * stddev)
        const cpu = (usl - mean) / (3 * stddev)
        const cpl = (mean - lsl) / (3 * stddev)
        const cpk = Math.min(cpu, cpl)
        cpkResult = { cp, cpk, mean, sigma: stddev }
      }
    }

    return { labels: bins.map((b) => b.label), counts: bins.map((b) => b.count), normalCurve: normalCurveData, cpk: cpkResult }
  }, [vals, extraBinCount, normalOverlay, config.extras])

  const histogramOption: EChartsOption = useMemo(() => {
    const textMuted = resolveToken('--io-text-muted')
    const border = resolveToken('--io-border')

    const barColor = pointSlot?.color ?? '#4A9EFF'
    const series: EChartsOption['series'] = []

    if (horizontal) {
      series.push({
        type: 'bar',
        data: counts,
        barCategoryGap: '2%',
        itemStyle: { color: barColor, opacity: 0.8 },
      })
    } else {
      series.push({
        type: 'bar',
        data: counts,
        barCategoryGap: '2%',
        itemStyle: { color: barColor, opacity: 0.8 },
      })
    }

    if (normalOverlay && normalCurve.length) {
      (series as unknown[]).push({
        type: 'line',
        data: normalCurve,
        smooth: true,
        symbol: 'none',
        lineStyle: { color: '#F59E0B', width: 2 },
        name: 'Normal',
      })
    }

    const categoryAxis = {
      type: 'category' as const,
      data: labels,
      axisLabel: { color: textMuted, fontSize: 9, rotate: horizontal ? 0 : 30 },
      axisLine: { lineStyle: { color: border } },
      axisTick: { show: false },
    }
    const countAxis = {
      type: 'value' as const,
      name: 'Count',
      nameTextStyle: { color: textMuted, fontSize: 10 },
      axisLabel: { color: textMuted, fontSize: 11 },
      splitLine: { lineStyle: { color: border, opacity: 0.4 } },
    }

    return {
      backgroundColor: 'transparent',
      legend: { show: false },
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: 48, right: 16, top: 12, bottom: 40, containLabel: true },
      xAxis: horizontal ? countAxis : categoryAxis,
      yAxis: horizontal ? categoryAxis : countAxis,
      series,
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labels, counts, normalCurve, normalOverlay, pointSlot, horizontal])

  if (!pointSlot) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--io-text-muted)', fontSize: 13 }}>
        No point configured
      </div>
    )
  }

  if (displayMode === 'violin') {
    if (isLoading) {
      return (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--io-text-muted)', fontSize: 13 }}>
          Loading…
        </div>
      )
    }
    if (vals.length < 4) {
      return (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--io-text-muted)', fontSize: 13 }}>
          Not enough data for violin plot
        </div>
      )
    }
    return (
      <ChartLegendLayout legend={config.legend} items={legendItems} highlighted={highlighted} onHighlight={toggle}>
        <div style={{ position: 'relative', flex: 1, minHeight: 0, width: '100%' }}>
          <ViolinPlot values={vals} color={pointSlot.color ?? '#4A9EFF'} horizontal={horizontal} />
        </div>
      </ChartLegendLayout>
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
        {!isLoading && labels.length === 0 && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--io-text-muted)', fontSize: 13 }}>
            No data
          </div>
        )}
        {labels.length > 0 && (
          <div style={{ position: 'relative' }}>
            <EChart option={histogramOption} height={300} onEvents={onEvents} />
            {cpk && (
              <div style={{
                position: 'absolute', top: 8, left: 8,
                background: 'var(--io-surface)', border: '1px solid var(--io-border)',
                borderRadius: 4, padding: '4px 8px', fontSize: 11, color: 'var(--io-text-muted)',
              }}>
                Cp: {cpk.cp.toFixed(3)} | Cpk: {cpk.cpk.toFixed(3)} | σ: {cpk.sigma.toFixed(4)}
              </div>
            )}
          </div>
        )}
      </div>
    </ChartLegendLayout>
  )
}
