import EChart from '../../../shared/components/charts/EChart'
import type { EChartsOption } from 'echarts'
import type { WidgetConfig } from '../../../api/dashboards'

interface PieChartConfig {
  title: string
  series: { label: string; value: number; color?: string }[]
  donut?: boolean
}

const DEFAULT_COLORS = ['#4A9EFF', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4', '#ec4899', '#84cc16']

interface Props {
  config: WidgetConfig
  variables: Record<string, string[]>
}

export default function PieChart({ config }: Props) {
  const cfg = config.config as unknown as PieChartConfig
  const series = cfg.series ?? []
  const isDonut = cfg.donut ?? false

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
      textStyle: { color: '#999', fontSize: 11 },
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
          itemStyle: { color: s.color ?? DEFAULT_COLORS[idx % DEFAULT_COLORS.length] },
        })),
        label: { show: false },
        labelLine: { show: false },
        emphasis: {
          itemStyle: { shadowBlur: 8, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.5)' },
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
