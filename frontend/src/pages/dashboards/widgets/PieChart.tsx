import EChart from '../../../shared/components/charts/EChart'
import type { EChartsOption } from 'echarts'
import type { WidgetConfig } from '../../../api/dashboards'

interface PieChartConfig {
  title: string
  series: { label: string; value: number; color?: string }[]
  donut?: boolean
}

/** Resolve a CSS custom property for use in ECharts options. */
function resolveToken(token: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim()
}

interface Props {
  config: WidgetConfig
  variables: Record<string, string[]>
}

export default function PieChart({ config }: Props) {
  const cfg = config.config as unknown as PieChartConfig
  const series = cfg.series ?? []
  const isDonut = cfg.donut ?? false

  // Chart series colors resolved from pen tokens so they reflect the active theme.
  // ECharts requires resolved color values, not CSS variable strings.
  const defaultColors = [
    resolveToken('--io-pen-1'),
    resolveToken('--io-pen-3'),
    resolveToken('--io-pen-4'),
    resolveToken('--io-pen-2'),
    resolveToken('--io-pen-5'),
    resolveToken('--io-pen-6'),
    resolveToken('--io-pen-7'),
    resolveToken('--io-pen-8'),
  ]

  const option: EChartsOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} ({d}%)',
    },
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
        radius: isDonut ? ['40%', '70%'] : '65%',
        center: ['40%', '50%'],
        data: series.map((s, idx) => ({
          name: s.label,
          value: s.value,
          itemStyle: { color: s.color ?? defaultColors[idx % defaultColors.length] },
        })),
        label: { show: false },
        labelLine: { show: false },
        emphasis: {
          itemStyle: { shadowBlur: 8, shadowOffsetX: 0, shadowColor: resolveToken('--io-surface-overlay') },
        },
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
