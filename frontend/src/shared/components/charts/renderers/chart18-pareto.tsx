// ---------------------------------------------------------------------------
// Chart 18 — Pareto Chart
// Bad-actors mode: bars sorted descending + cumulative % line on secondary axis.
// rankBy options: count, standing_time, rate.
// Priority distribution mode: shows alarm distribution by HH/H/M/L priority.
// Supports horizontal orientation.
// ---------------------------------------------------------------------------

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { EChartsOption } from 'echarts'
import EChart from '../EChart'
import { type ChartConfig, autoColor, slotLabel } from '../chart-config-types'
import { ChartLegendLayout, type LegendItem } from '../ChartLegend'
import { useWebSocket } from '../../../hooks/useWebSocket'
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

// ISA-18.2 recommended priority distribution targets (for display reference)
const ISA_TARGETS: Record<string, number> = {
  'HH / Critical': 5,
  'H / High': 15,
  'M / Medium': 40,
  'L / Low': 40,
}

export default function ParetoChart({ config }: RendererProps) {
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
  const thresholdPercent = typeof config.extras?.thresholdPercent === 'number'
    ? config.extras.thresholdPercent
    : 80
  const mode = (config.extras?.mode as string) ?? 'bad_actors'
  const horizontal = config.extras?.orientation === 'horizontal'
  const show80Line = config.extras?.show80Line !== false

  const { values } = useWebSocket(pointIds)

  const { data: latestData, isLoading } = useQuery({
    queryKey: ['batch-latest', ...pointIds],
    queryFn: () => pointsApi.batchLatest(pointIds),
    enabled: pointIds.length > 0,
    refetchInterval: 30_000,
    select: (res) => res.success ? res.data : [],
  })

  const { sortedNames, sortedValues, cumulativePct } = useMemo(() => {
    if (mode === 'priority_distribution') {
      // Priority distribution mode: fixed categories HH/H/M/L
      // In real use, these would come from event-service alarm counts by priority.
      // Here we use the assigned series points as proxies for each priority count.
      const items = seriesSlots.map((slot, i) => {
        const ws = values.get(slot.pointId)
        const val = ws !== undefined
          ? ws.value
          : (latestData?.find((r: { point_id: string; value: number | null }) => r.point_id === slot.pointId)?.value ?? 0)
        return { name: slotLabel(slot), value: Math.max(0, val), color: slot.color ?? autoColor(i) }
      })
      const total = items.reduce((s, d) => s + d.value, 0)
      let running = 0
      const cumPct = items.map((d) => {
        running += d.value
        return total > 0 ? parseFloat(((running / total) * 100).toFixed(2)) : 0
      })
      return { sortedNames: items.map((d) => d.name), sortedValues: items, cumulativePct: cumPct }
    }

    // Bad actors mode: sort descending by value
    const items = seriesSlots.map((slot, i) => {
      const ws = values.get(slot.pointId)
      const val = ws !== undefined
        ? ws.value
        : (latestData?.find((r: { point_id: string; value: number | null }) => r.point_id === slot.pointId)?.value ?? 0)
      return { name: slotLabel(slot), value: Math.max(0, val), color: slot.color ?? autoColor(i) }
    })
    items.sort((a, b) => b.value - a.value)

    const total = items.reduce((s, d) => s + d.value, 0)
    let running = 0
    const cumPct = items.map((d) => {
      running += d.value
      return total > 0 ? parseFloat(((running / total) * 100).toFixed(2)) : 0
    })

    return {
      sortedNames: items.map((d) => d.name),
      sortedValues: items,
      cumulativePct: cumPct,
    }
  }, [seriesSlots, values, latestData, mode])

  const option: EChartsOption = useMemo(() => {
    const textMuted = resolveToken('--io-text-muted')
    const border = resolveToken('--io-border')

    const categoryAxis = {
      type: 'category' as const,
      data: sortedNames,
      axisLabel: { color: textMuted, fontSize: 11 },
      axisLine: { lineStyle: { color: border } },
      axisTick: { show: false },
    }

    const valueAxis0 = {
      type: 'value' as const,
      axisLabel: { color: textMuted, fontSize: 11 },
      splitLine: { lineStyle: { color: border, opacity: 0.4 } },
    }

    const valueAxis1 = {
      type: 'value' as const,
      min: 0,
      max: 100,
      axisLabel: { color: textMuted, fontSize: 11, formatter: '{value}%' },
      splitLine: { show: false },
    }

    const barSeries = {
      type: 'bar' as const,
      data: sortedValues.map((d) => ({
        value: d.value,
        itemStyle: {
          color: d.color,
          ...(highlighted.size > 0 ? { opacity: highlighted.has(d.name) ? 1 : 0.15 } : {}),
        },
      })),
      barMaxWidth: horizontal ? undefined : 48,
    }

    const lineSeries = {
      type: 'line' as const,
      yAxisIndex: 1,
      data: cumulativePct,
      smooth: false,
      symbol: 'circle',
      symbolSize: 5,
      lineStyle: { color: '#F59E0B', width: 2 },
      itemStyle: { color: '#F59E0B' },
      ...(show80Line ? {
        markLine: {
          silent: true,
          lineStyle: { color: '#EF4444', type: 'dashed' as const },
          data: [{ yAxis: thresholdPercent, name: `${thresholdPercent}%` }],
          label: { formatter: `${thresholdPercent}%`, color: '#EF4444', fontSize: 10 },
        },
      } : {}),
    }

    // For priority distribution mode, show ISA-18.2 target reference lines
    const isaPriorityMarkers = mode === 'priority_distribution'
      ? sortedNames.map((name) => {
          const target = ISA_TARGETS[name]
          return target ? { xAxis: horizontal ? target : undefined, yAxis: !horizontal ? target : undefined } : null
        }).filter(Boolean)
      : []

    if (horizontal) {
      return {
        backgroundColor: 'transparent',
        legend: { show: false },
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        grid: { left: 16, right: 64, top: 16, bottom: 32, containLabel: true },
        xAxis: [valueAxis0, { ...valueAxis1, position: 'top' as const }],
        yAxis: categoryAxis,
        series: [
          { ...barSeries, yAxisIndex: 0, xAxisIndex: undefined },
          { ...lineSeries, xAxisIndex: 1, yAxisIndex: 0, data: cumulativePct },
        ],
      } as EChartsOption
    }

    return {
      backgroundColor: 'transparent',
      legend: { show: false },
      tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
      grid: { left: 48, right: 48, top: 16, bottom: 32, containLabel: true },
      xAxis: categoryAxis,
      yAxis: [valueAxis0, valueAxis1],
      series: [
        barSeries,
        {
          ...lineSeries,
          ...(isaPriorityMarkers.length ? {
            markLine: {
              silent: true,
              lineStyle: { color: '#10B981', type: 'dashed' as const },
              data: isaPriorityMarkers as { yAxis: number }[],
              label: { formatter: 'ISA target', color: '#10B981', fontSize: 9 },
            },
          } : {}),
        },
      ],
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedNames, sortedValues, cumulativePct, thresholdPercent, horizontal, show80Line, mode, highlighted])

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
