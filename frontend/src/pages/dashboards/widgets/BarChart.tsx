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

export default function BarChart({ config }: Props) {
  const cfg = config.config as unknown as BarChartConfig
  const series = cfg.series ?? []
  const isHorizontal = cfg.horizontal ?? false
  const color = cfg.color ?? '#4A9EFF'

  const option: EChartsOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
    },
    grid: { top: 16, right: 16, bottom: 40, left: 48 },
    xAxis: isHorizontal
      ? { type: 'value', axisLine: { lineStyle: { color: '#555' } }, axisLabel: { color: '#999', fontSize: 11 }, splitLine: { lineStyle: { color: '#333' } } }
      : {
          type: 'category',
          data: series.map((s) => s.label),
          axisLine: { lineStyle: { color: '#555' } },
          axisLabel: { color: '#999', fontSize: 11, interval: 0, rotate: series.length > 6 ? 30 : 0 },
        },
    yAxis: isHorizontal
      ? {
          type: 'category',
          data: series.map((s) => s.label),
          axisLine: { lineStyle: { color: '#555' } },
          axisLabel: { color: '#999', fontSize: 11 },
        }
      : { type: 'value', axisLine: { lineStyle: { color: '#555' } }, axisLabel: { color: '#999', fontSize: 11 }, splitLine: { lineStyle: { color: '#333' } } },
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
