// ---------------------------------------------------------------------------
// Chart 22 — Stacked Area
// Uses ECharts with areaStyle + optional stack mode.
// When scaling.type === 'fixed', stacks series absolutely (stack: 'total').
// Otherwise renders as overlapping filled areas.
// ---------------------------------------------------------------------------

import { useMemo } from 'react'
import EChart from '../EChart'
import { useTimeSeriesBuffer } from '../hooks/useTimeSeriesBuffer'
import { type ChartConfig, autoColor, slotLabel } from '../chart-config-types'
import { ChartLegendLayout, type LegendItem } from '../ChartLegend'
import type { EChartsOption } from 'echarts'
import { useHighlight } from '../hooks/useHighlight'
import { applyEChartsHighlight, getEChartsClickKey, getEChartsClickMulti } from '../chart-highlight-utils'

interface RendererProps {
  config: ChartConfig
  bufferKey: string
}

// Hex or named color → rgba string with given alpha
function withAlpha(color: string, alpha: number): string {
  // ECharts accepts rgba() directly.
  // Attempt a basic hex parse; fall back to the color string with opacity.
  const hex = color.replace('#', '')
  if (hex.length === 6) {
    const r = parseInt(hex.slice(0, 2), 16)
    const g = parseInt(hex.slice(2, 4), 16)
    const b = parseInt(hex.slice(4, 6), 16)
    return `rgba(${r},${g},${b},${alpha})`
  }
  // For non-hex colors just return with the original value — ECharts handles named colors
  return color
}

export default function Chart22StackedArea({ config, bufferKey }: RendererProps) {
  const durationMinutes = config.durationMinutes ?? 60
  const seriesSlots = config.points.filter((p) => p.role === 'series')
  const { highlighted, toggle } = useHighlight()
  const pointIds = seriesSlots.map((p) => p.pointId)

  const { timestamps, seriesData, isFetching } = useTimeSeriesBuffer({
    bufferKey,
    pointIds,
    durationMinutes,
    interpolation: config.interpolation ?? 'linear',
  })

  const useStack = config.scaling?.type === 'fixed'
  const legendItems: LegendItem[] = seriesSlots.map((slot, i) => ({ label: slotLabel(slot), color: slot.color ?? autoColor(i) }))

  const option: EChartsOption = useMemo(() => {
    // Convert timestamps (Unix seconds) to ECharts format (ms)
    const xData = timestamps.map((ts) => ts * 1000)

    const echartsSeries: EChartsOption['series'] = seriesSlots.map((slot, i) => {
      const color = slot.color ?? autoColor(i)
      const data = seriesData.get(slot.pointId) ?? []
      return {
        name: slotLabel(slot),
        type: 'line',
        data: xData.map((_, idx) => data[idx] ?? null),
        smooth: config.interpolation !== 'step',
        step: config.interpolation === 'step' ? 'end' : false,
        symbol: 'none',
        lineStyle: { color, width: 1.5 },
        itemStyle: { color },
        areaStyle: {
          color: withAlpha(color, 0.3),
          opacity: 1,
        },
        ...(useStack ? { stack: 'total' } : {}),
        connectNulls: false,
      }
    })

    return {
      animation: false,
      grid: {
        left: 8,
        right: 12,
        top: 12,
        bottom: 28,
        containLabel: true,
      },
      legend: { show: false },
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' },
      },
      xAxis: {
        type: 'time',
        axisLine: { lineStyle: { color: 'var(--io-text-muted)' } },
        axisTick: { lineStyle: { color: 'var(--io-border)' } },
        axisLabel: {
          fontSize: 10,
          formatter: (val: number) => {
            const d = new Date(val)
            return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
          },
        },
        splitLine: { show: false },
        min: timestamps.length > 0 ? (timestamps[0] * 1000) : undefined,
        max: timestamps.length > 0 ? (timestamps[timestamps.length - 1] * 1000) : undefined,
      },
      yAxis: {
        type: 'value',
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { fontSize: 10 },
        splitLine: { lineStyle: { type: 'dashed', opacity: 0.3 } },
        ...(config.scaling?.type === 'fixed' && config.scaling.yMin !== undefined
          ? { min: config.scaling.yMin }
          : {}),
        ...(config.scaling?.type === 'fixed' && config.scaling.yMax !== undefined
          ? { max: config.scaling.yMax }
          : {}),
      },
      series: echartsSeries,
    }
  }, [timestamps, seriesData, seriesSlots, config, useStack])

  const displayOption = useMemo(
    () => applyEChartsHighlight(option, highlighted),
    [option, highlighted],
  )

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
        {/* Loading indicator */}
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

        {/* Empty state */}
        {pointIds.length === 0 && (
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
            No points configured
          </div>
        )}

        {pointIds.length > 0 && (
          <div style={{ flex: 1, minHeight: 0 }}>
            <EChart option={displayOption} onEvents={onEvents} />
          </div>
        )}
      </div>
    </ChartLegendLayout>
  )
}
