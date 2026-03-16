import { useQuery } from '@tanstack/react-query'
import { api } from '../../../api/client'
import TimeSeriesChart from '../../../shared/components/charts/TimeSeriesChart'
import type { WidgetConfig } from '../../../api/dashboards'

interface LineChartConfig {
  title: string
  points: string[]
  timeRange?: string
  aggregation?: string
}

interface HistoryPoint {
  timestamp: string
  value: number
}

interface HistoryResponse {
  point_id: string
  data: HistoryPoint[]
}

function parseTimeRange(range: string): { start: string; end: string } {
  const end = new Date()
  const hours = parseInt(range.replace('h', '').replace('m', '').replace('d', ''), 10)
  const unit = range.slice(-1)
  let ms = hours * 3600 * 1000
  if (unit === 'm') ms = hours * 60 * 1000
  if (unit === 'd') ms = hours * 86400 * 1000
  const start = new Date(end.getTime() - ms)
  return { start: start.toISOString(), end: end.toISOString() }
}

interface Props {
  config: WidgetConfig
  variables: Record<string, string[]>
}

export default function LineChart({ config }: Props) {
  const cfg = config.config as unknown as LineChartConfig
  const timeRange = cfg.timeRange ?? '1h'
  const aggregation = cfg.aggregation ?? '5m'
  const points = cfg.points ?? []

  const query = useQuery({
    queryKey: ['archive-history', points, timeRange, aggregation],
    queryFn: async () => {
      if (points.length === 0) return []
      const { start, end } = parseTimeRange(timeRange)
      const results = await Promise.all(
        points.map(async (pointId) => {
          const res = await api.get<HistoryResponse>(
            `/api/archive/history?point_id=${encodeURIComponent(pointId)}&start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}&bucket=${encodeURIComponent(aggregation)}`,
          )
          if (!res.success) return { point_id: pointId, data: [] as HistoryPoint[] }
          return res.data
        }),
      )
      return results
    },
    refetchInterval: 30000,
    enabled: points.length > 0,
  })

  const seriesData = (query.data ?? []).map((result, idx) => {
    const sortedData = [...(result.data ?? [])].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
    )
    const colors = ['#4A9EFF', '#22c55e', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4']
    return {
      label: points[idx] ?? `Series ${idx + 1}`,
      data: sortedData.map((d) => d.value),
      color: colors[idx % colors.length],
    }
  })

  const timestamps =
    query.data && query.data[0]
      ? [...(query.data[0].data ?? [])].sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
        ).map((d) => Math.floor(new Date(d.timestamp).getTime() / 1000))
      : []

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
        Failed to load data
      </div>
    )
  }

  return (
    <div style={{ height: '100%', minHeight: 0 }}>
      <TimeSeriesChart
        timestamps={timestamps}
        series={seriesData}
      />
    </div>
  )
}
