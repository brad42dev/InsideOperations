import { useQuery } from '@tanstack/react-query'
import EChart from '../../../shared/components/charts/EChart'
import type { EChartsOption } from 'echarts'
import { api } from '../../../api/client'
import type { WidgetConfig } from '../../../api/dashboards'
import { usePointValues } from '../../../shared/hooks/usePointValues'

interface GaugeConfig {
  title: string
  pointId: string
  min: number
  max: number
  unit?: string
  thresholds: { warning: number; critical: number }
}

interface PointCurrentResponse {
  value: number
  quality: string
  timestamp: string
}

interface Props {
  config: WidgetConfig
  variables: Record<string, string[]>
}

export default function GaugeWidget({ config }: Props) {
  const cfg = config.config as unknown as GaugeConfig
  const { pointId, min = 0, max = 100, unit = '', thresholds } = cfg

  const query = useQuery({
    queryKey: ['point-current', pointId],
    queryFn: async () => {
      const result = await api.get<PointCurrentResponse>(
        `/api/points/${encodeURIComponent(pointId)}/current`,
      )
      if (!result.success) throw new Error(result.error.message)
      return result.data
    },
    refetchInterval: 5000,
    enabled: !!pointId,
  })

  // Real-time WebSocket subscription — overrides the API-fetched value when available
  const liveValues = usePointValues(pointId ? [pointId] : [])
  const livePoint = pointId ? liveValues.get(pointId) : undefined

  const rawValue = livePoint?.value ?? query.data?.value ?? min
  const clampedValue = Math.min(max, Math.max(min, rawValue))
  const quality = livePoint?.quality ?? query.data?.quality ?? 'unknown'
  const isStale = livePoint?.stale === true || quality === 'uncertain' || quality === 'bad'

  function getColor(val: number): string {
    if (!thresholds) return '#4A9EFF'
    if (val >= thresholds.critical) return '#ef4444'
    if (val >= thresholds.warning) return '#f59e0b'
    return '#22c55e'
  }

  const color = getColor(clampedValue)

  const axisLineData: [number, string][] = thresholds
    ? [
        [thresholds.warning / max, '#22c55e'],
        [thresholds.critical / max, '#f59e0b'],
        [1, '#ef4444'],
      ]
    : [[1, '#4A9EFF']]

  const option: EChartsOption = {
    backgroundColor: 'transparent',
    series: [
      {
        type: 'gauge',
        startAngle: 200,
        endAngle: -20,
        min,
        max,
        radius: '85%',
        center: ['50%', '55%'],
        splitNumber: 5,
        axisLine: {
          lineStyle: {
            width: 12,
            color: axisLineData,
          },
        },
        pointer: {
          itemStyle: { color },
          length: '55%',
          width: 4,
        },
        axisTick: { show: false },
        splitLine: {
          length: 8,
          lineStyle: { color: '#555', width: 1 },
        },
        axisLabel: {
          color: '#999',
          fontSize: 10,
          distance: 14,
        },
        detail: {
          valueAnimation: true,
          formatter: (v: number) => `${v.toFixed(1)}${unit ? ' ' + unit : ''}`,
          color,
          fontSize: 18,
          fontWeight: 600,
          offsetCenter: [0, '30%'],
        },
        data: [{ value: clampedValue, name: '' }],
        title: { show: false },
      },
    ],
  }

  if (query.isLoading) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--io-text-muted)',
          fontSize: '12px',
        }}
      >
        Loading...
      </div>
    )
  }

  if (query.isError) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--io-danger, #ef4444)',
          fontSize: '12px',
        }}
      >
        Error loading value
      </div>
    )
  }

  return (
    <div style={{ height: '100%', minHeight: 0, position: 'relative' }}>
      <EChart option={option} />
      {isStale && (
        <div
          style={{
            position: 'absolute',
            top: 6,
            right: 8,
            display: 'flex',
            alignItems: 'center',
            gap: '3px',
          }}
        >
          <span
            style={{
              display: 'inline-block',
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: quality === 'bad' ? 'var(--io-danger, #ef4444)' : 'var(--io-warning, #f59e0b)',
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: '9px',
              color: 'var(--io-text-muted)',
              letterSpacing: '0.05em',
            }}
          >
            {quality === 'bad' ? 'BAD' : 'STALE'}
          </span>
        </div>
      )}
    </div>
  )
}
