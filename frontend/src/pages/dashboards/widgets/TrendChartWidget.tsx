import { useQuery } from '@tanstack/react-query'
import { pointsApi } from '../../../api/points'
import type { WidgetConfig } from '../../../api/dashboards'
import EChart from '../../../shared/components/charts/EChart'
import type { EChartsOption } from 'echarts'

interface TrendChartConfig {
  title?: string
  /** List of point IDs to plot */
  points?: string[]
  /** Variable name to resolve to point IDs */
  variable?: string
  /** Time window in hours (default 8) */
  window_hours?: number
  /** Chart type: 'line' or 'area' (default 'line') */
  chart_type?: 'line' | 'area'
}

interface Props {
  config: WidgetConfig
  variables: Record<string, string[]>
}

// Distinct pen colors for multiple series
const SERIES_COLORS = [
  'var(--io-pen-1)',
  'var(--io-pen-2)',
  'var(--io-pen-3)',
  'var(--io-pen-4)',
  'var(--io-pen-5)',
  'var(--io-pen-6)',
]

function resolveToken(token: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim()
}

export default function TrendChartWidget({ config, variables }: Props) {
  const cfg = config.config as unknown as TrendChartConfig
  const windowHours = cfg.window_hours ?? 8
  const chartType = cfg.chart_type ?? 'line'

  // Resolve point IDs — either from config.points directly or from a variable
  const configPoints = cfg.points ?? []
  const variableKey = cfg.variable
  const variablePointIds = variableKey ? (variables[variableKey] ?? []) : []
  const pointIds = configPoints.length > 0 ? configPoints : variablePointIds

  const now = new Date()
  const start = new Date(now.getTime() - windowHours * 60 * 60 * 1000)

  const query = useQuery({
    queryKey: ['trend-chart', pointIds, windowHours],
    queryFn: async () => {
      if (pointIds.length === 0) return []
      const result = await pointsApi.historyBatch(pointIds, {
        start: start.toISOString(),
        end: now.toISOString(),
        resolution: windowHours <= 2 ? 'raw' : windowHours <= 24 ? '1m' : '5m',
        limit: 2000,
      })
      if (!result.success) throw new Error(result.error.message)
      return result.data
    },
    refetchInterval: 60000,
    enabled: pointIds.length > 0,
  })

  if (pointIds.length === 0) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--io-text-muted)',
          fontSize: '12px',
          flexDirection: 'column',
          gap: '6px',
        }}
      >
        <span style={{ fontSize: '20px', opacity: 0.3 }}>📈</span>
        <span>No points configured for this trend chart</span>
      </div>
    )
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
        Loading trend data...
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
          color: 'var(--io-danger)',
          fontSize: '12px',
        }}
      >
        Failed to load trend data
      </div>
    )
  }

  const results = Array.isArray(query.data) ? query.data : []

  const hasData = results.some((r) => r.rows && r.rows.length > 0)
  if (!hasData) {
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
        No data in the last {windowHours}h
      </div>
    )
  }

  const axisColor = resolveToken('--io-border-strong')
  const labelColor = resolveToken('--io-text-muted')
  const gridColor = resolveToken('--io-chart-grid')

  const series = results
    .filter((r) => r.rows && r.rows.length > 0)
    .map((result, i) => {
      const color = resolveToken(SERIES_COLORS[i % SERIES_COLORS.length])
      const data: [number, number | null][] = result.rows.map((row) => [
        new Date(row.timestamp).getTime(),
        typeof row.value === 'number' ? row.value : null,
      ])

      return {
        type: chartType === 'area' ? 'line' : 'line',
        name: result.point_id,
        data,
        smooth: true,
        symbol: 'none',
        lineStyle: { color, width: 1.5 },
        itemStyle: { color },
        areaStyle: chartType === 'area' ? { opacity: 0.1 } : undefined,
        connectNulls: false,
      } as const
    })

  const option: EChartsOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'cross', animation: false },
      formatter: (params) => {
        if (!Array.isArray(params) || params.length === 0) return ''
        const firstValue = params[0].value as [number, number | null]
        const ts = new Date(firstValue[0]).toLocaleTimeString(undefined, {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
        const lines = [`<b>${ts}</b>`]
        for (const p of params) {
          const pv = p.value as [number, number | null]
          const val = pv[1]
          lines.push(
            `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};margin-right:4px;"></span>` +
              `${val != null ? val.toFixed(2) : 'N/A'}`,
          )
        }
        return lines.join('<br/>')
      },
    },
    legend:
      series.length > 1
        ? {
            show: true,
            bottom: 0,
            textStyle: { color: labelColor, fontSize: 9 },
            formatter: (name: string) => {
              // Shorten UUID-style point IDs
              if (/^[0-9a-f-]{36}$/i.test(name)) return name.slice(0, 8) + '…'
              return name
            },
          }
        : { show: false },
    grid: {
      top: 8,
      right: 12,
      bottom: series.length > 1 ? 36 : 28,
      left: 44,
    },
    xAxis: {
      type: 'time',
      axisLine: { lineStyle: { color: axisColor } },
      axisLabel: {
        color: labelColor,
        fontSize: 9,
        formatter: (val: number) => {
          const d = new Date(val)
          if (windowHours <= 6) {
            return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
          }
          return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:00`
        },
      },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      axisLine: { lineStyle: { color: axisColor } },
      axisLabel: { color: labelColor, fontSize: 10 },
      splitLine: { lineStyle: { color: gridColor } },
    },
    series,
    animation: false,
  }

  return (
    <div style={{ height: '100%', minHeight: 0 }}>
      <EChart option={option} />
    </div>
  )
}
