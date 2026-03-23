import { useQuery } from '@tanstack/react-query'
import { api } from '../../../api/client'
import type { WidgetConfig } from '../../../api/dashboards'
import EChart from '../../../shared/components/charts/EChart'
import type { EChartsOption } from 'echarts'

interface AlarmCountBySeverityConfig {
  title?: string
  chartType?: 'bar' | 'pie'
}

interface AlarmSeverityCount {
  severity: string
  count: number
}

// ISA-101 alarm severity token mapping.
// Values are CSS variable references resolved at paint time.
const SEVERITY_TOKENS: Record<string, string> = {
  critical: 'var(--io-alarm-critical)',
  high: 'var(--io-alarm-high)',
  medium: 'var(--io-alarm-medium)',
  low: 'var(--io-info)',
  info: 'var(--io-text-muted)',
}

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'info']

function resolveToken(token: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim()
}

interface Props {
  config: WidgetConfig
  variables: Record<string, string[]>
}

export default function AlarmCountBySeverityWidget({ config }: Props) {
  const cfg = config.config as unknown as AlarmCountBySeverityConfig
  const chartType = cfg.chartType ?? 'bar'

  const query = useQuery({
    queryKey: ['alarm-count-by-severity'],
    queryFn: async () => {
      const result = await api.get<AlarmSeverityCount[]>('/api/alarms/active')
      if (!result.success) throw new Error(result.error.message)
      // The active alarms endpoint returns a flat list — aggregate by severity client-side.
      const raw = result.data as Array<{ severity: string }>
      const counts: Record<string, number> = {}
      for (const alarm of raw) {
        const sev = alarm.severity ?? 'info'
        counts[sev] = (counts[sev] ?? 0) + 1
      }
      return SEVERITY_ORDER
        .filter((s) => counts[s] !== undefined)
        .map((s) => ({ severity: s, count: counts[s] }))
    },
    refetchInterval: 10000,
  })

  const data = query.data ?? []

  const axisColor = resolveToken('--io-border-strong')
  const labelColor = resolveToken('--io-text-muted')
  const gridColor = resolveToken('--io-chart-grid')

  const barOption: EChartsOption = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { top: 8, right: 8, bottom: 40, left: 40 },
    xAxis: {
      type: 'category',
      data: data.map((d) => d.severity.charAt(0).toUpperCase() + d.severity.slice(1)),
      axisLine: { lineStyle: { color: axisColor } },
      axisLabel: { color: labelColor, fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      minInterval: 1,
      axisLine: { lineStyle: { color: axisColor } },
      axisLabel: { color: labelColor, fontSize: 11 },
      splitLine: { lineStyle: { color: gridColor } },
    },
    series: [
      {
        type: 'bar',
        data: data.map((d) => ({
          value: d.count,
          itemStyle: { color: resolveToken(SEVERITY_TOKENS[d.severity] ?? '--io-text-muted') },
        })),
        barMaxWidth: 40,
      },
    ],
  }

  const pieOption: EChartsOption = {
    backgroundColor: 'transparent',
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    legend: {
      orient: 'vertical',
      right: 8,
      top: 'middle',
      textStyle: { color: resolveToken('--io-text-muted'), fontSize: 11 },
      itemWidth: 10,
      itemHeight: 10,
    },
    series: [
      {
        type: 'pie',
        radius: ['40%', '70%'],
        center: ['40%', '50%'],
        data: data.map((d) => ({
          name: d.severity.charAt(0).toUpperCase() + d.severity.slice(1),
          value: d.count,
          itemStyle: { color: resolveToken(SEVERITY_TOKENS[d.severity] ?? '--io-text-muted') },
        })),
        label: { show: false },
        labelLine: { show: false },
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
          color: 'var(--io-danger)',
          fontSize: '12px',
        }}
      >
        Failed to load alarm data
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--io-alarm-normal)',
          fontSize: '12px',
          gap: '6px',
        }}
      >
        <span>No active alarms</span>
      </div>
    )
  }

  return (
    <div style={{ height: '100%', minHeight: 0 }}>
      <EChart option={chartType === 'pie' ? pieOption : barOption} />
    </div>
  )
}
