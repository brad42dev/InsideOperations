// ---------------------------------------------------------------------------
// Chart 08 — Gauge
// Single point gauge with threshold zones. Live value via WebSocket.
// ---------------------------------------------------------------------------

import { useMemo } from 'react'
import type { EChartsOption } from 'echarts'
import EChart from '../EChart'
import { type ChartConfig } from '../chart-config-types'
import { useWebSocket } from '../../../hooks/useWebSocket'

interface RendererProps {
  config: ChartConfig
  bufferKey: string
}

interface ThresholdZone {
  value: number
  color: string
}

function resolveToken(token: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim()
}

// DEFAULT_THRESHOLDS use absolute values in the same unit as min/max.
// The gauge defaults to min=0, max=100, so these represent 60%, 80%, 100%.
const DEFAULT_THRESHOLDS: ThresholdZone[] = [
  { value: 60, color: '#10B981' },
  { value: 80, color: '#F59E0B' },
  { value: 100, color: '#EF4444' },
]

export default function GaugeChart({ config }: RendererProps) {
  const pointSlot = config.points.find((p) => p.role === 'point')
  const pointIds = pointSlot ? [pointSlot.pointId] : []

  const min = typeof config.extras?.min === 'number' ? config.extras.min : 0
  const max = typeof config.extras?.max === 'number' ? config.extras.max : 100

  const rawThresholds = config.extras?.thresholds
  const thresholds: ThresholdZone[] = Array.isArray(rawThresholds)
    ? (rawThresholds as ThresholdZone[])
    : DEFAULT_THRESHOLDS

  const { values } = useWebSocket(pointIds)

  const liveValue = pointSlot ? (values.get(pointSlot.pointId)?.value ?? min) : min

  const option: EChartsOption = useMemo(() => {
    const textMuted = resolveToken('--io-text-muted')
    const textPrimary = resolveToken('--io-text-primary')
    const range = max - min

    // Convert absolute threshold values to ECharts axisLine color pairs [fraction, color]
    const colorPairs: [number, string][] = thresholds.map((t) => [
      Math.min(1, Math.max(0, (t.value - min) / range)),
      t.color,
    ])

    return {
      backgroundColor: 'transparent',
      series: [
        {
          type: 'gauge',
          min,
          max,
          startAngle: 225,
          endAngle: -45,
          splitNumber: 5,
          axisLine: {
            lineStyle: {
              width: 12,
              color: colorPairs,
            },
          },
          pointer: {
            itemStyle: { color: 'auto' },
          },
          axisTick: {
            distance: -14,
            length: 6,
            lineStyle: { color: '#fff', width: 1 },
          },
          splitLine: {
            distance: -18,
            length: 12,
            lineStyle: { color: '#fff', width: 2 },
          },
          axisLabel: {
            color: textMuted,
            distance: 16,
            fontSize: 10,
          },
          detail: {
            valueAnimation: true,
            formatter: '{value}',
            color: textPrimary,
            fontSize: 18,
            offsetCenter: [0, '60%'],
          },
          data: [{ value: liveValue, name: pointSlot?.pointId ?? '' }],
          title: {
            fontSize: 11,
            color: textMuted,
            offsetCenter: [0, '80%'],
          },
        },
      ],
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveValue, min, max, thresholds, pointSlot])

  if (!pointSlot) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--io-text-muted)', fontSize: 13 }}>
        No point configured
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', flex: 1, minHeight: 0, width: '100%' }}>
      <EChart option={option} height={300} />
    </div>
  )
}
