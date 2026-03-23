import EChart from '../../../shared/components/charts/EChart'
import type { EChartsOption } from 'echarts'
import type { WidgetConfig } from '../../../api/dashboards'

interface BarChartConfig {
  title: string
  series: { label: string; value: number }[]
  horizontal?: boolean
  color?: string
}

interface Props {
  config: WidgetConfig
  variables: Record<string, string[]>
}

/** Resolve a CSS custom property for use in ECharts options.
 *  ECharts requires resolved color strings, not CSS variable references.
 */
function resolveToken(token: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim()
}

export default function BarChart({ config }: Props) {
  const cfg = config.config as unknown as BarChartConfig
  const series = cfg.series ?? []
  const isHorizontal = cfg.horizontal ?? false
  // Use caller-supplied color if provided; otherwise resolve the first pen token.
  // --io-pen-1 is the primary chart series color (blue, static across themes).
  const color = cfg.color ?? resolveToken('--io-pen-1')

  const axisColor = resolveToken('--io-border-strong')
  const labelColor = resolveToken('--io-text-muted')
  const gridColor = resolveToken('--io-chart-grid')

  const option: EChartsOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
    },
    grid: { top: 16, right: 16, bottom: 40, left: 48 },
    xAxis: isHorizontal
      ? { type: 'value', axisLine: { lineStyle: { color: axisColor } }, axisLabel: { color: labelColor, fontSize: 11 }, splitLine: { lineStyle: { color: gridColor } } }
      : {
          type: 'category',
          data: series.map((s) => s.label),
          axisLine: { lineStyle: { color: axisColor } },
          axisLabel: { color: labelColor, fontSize: 11, interval: 0, rotate: series.length > 6 ? 30 : 0 },
        },
    yAxis: isHorizontal
      ? {
          type: 'category',
          data: series.map((s) => s.label),
          axisLine: { lineStyle: { color: axisColor } },
          axisLabel: { color: labelColor, fontSize: 11 },
        }
      : { type: 'value', axisLine: { lineStyle: { color: axisColor } }, axisLabel: { color: labelColor, fontSize: 11 }, splitLine: { lineStyle: { color: gridColor } } },
    series: [
      {
        type: 'bar',
        data: isHorizontal
          ? series.map((s) => ({ value: s.value, itemStyle: { color } }))
          : series.map((s) => ({ value: s.value, itemStyle: { color } })),
        barMaxWidth: 40,
        emphasis: { itemStyle: { opacity: 0.8 } },
      },
    ],
  }

  if (series.length === 0) {
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
        No data
      </div>
    )
  }

  return (
    <div style={{ height: '100%', minHeight: 0 }}>
      <EChart option={option} />
    </div>
  )
}
