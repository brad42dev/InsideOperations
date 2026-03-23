import { useQuery } from '@tanstack/react-query'
import { api } from '../../../api/client'
import type { WidgetConfig } from '../../../api/dashboards'
import EChart from '../../../shared/components/charts/EChart'
import type { EChartsOption } from 'echarts'

interface AlarmRateConfig {
  title?: string
  windowHours?: number
  bucketMinutes?: number
}

interface AlarmEvent {
  id: string
  triggered_at: string
  severity: string
}

function resolveToken(token: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim()
}

function buildBuckets(
  events: AlarmEvent[],
  windowMs: number,
  bucketMs: number,
  now: number,
): { label: string; count: number }[] {
  const bucketCount = Math.ceil(windowMs / bucketMs)
  const buckets: number[] = new Array(bucketCount).fill(0)

  for (const event of events) {
    const ts = new Date(event.triggered_at).getTime()
    const age = now - ts
    if (age < 0 || age > windowMs) continue
    const idx = Math.floor((windowMs - age) / bucketMs)
    if (idx >= 0 && idx < bucketCount) {
      buckets[idx]++
    }
  }

  return buckets.map((count, i) => {
    const bucketStart = now - windowMs + i * bucketMs
    const d = new Date(bucketStart)
    const label = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
    return { label, count }
  })
}

interface Props {
  config: WidgetConfig
  variables: Record<string, string[]>
}

export default function AlarmRateWidget({ config }: Props) {
  const cfg = config.config as unknown as AlarmRateConfig
  const windowHours = cfg.windowHours ?? 6
  const bucketMinutes = cfg.bucketMinutes ?? 30

  const windowMs = windowHours * 60 * 60 * 1000
  const bucketMs = bucketMinutes * 60 * 1000

  const query = useQuery({
    queryKey: ['alarm-rate', windowHours, bucketMinutes],
    queryFn: async () => {
      const now = new Date()
      const start = new Date(now.getTime() - windowMs)
      const result = await api.get<AlarmEvent[]>(
        `/api/alarms/history?start=${start.toISOString()}&end=${now.toISOString()}&limit=5000`,
      )
      if (!result.success) throw new Error(result.error.message)
      return { events: result.data, fetchedAt: now.getTime() }
    },
    refetchInterval: 60000,
  })

  const buckets = query.data
    ? buildBuckets(query.data.events, windowMs, bucketMs, query.data.fetchedAt)
    : []

  const maxRate = Math.max(...buckets.map((b) => b.count), 1)
  const totalAlarms = buckets.reduce((sum, b) => sum + b.count, 0)
  // Rate expressed as alarms per hour
  const alarmsPerHour = totalAlarms > 0 ? Math.round((totalAlarms / windowHours) * 10) / 10 : 0

  const penColor = resolveToken('--io-pen-1')
  const axisColor = resolveToken('--io-border-strong')
  const labelColor = resolveToken('--io-text-muted')
  const gridColor = resolveToken('--io-chart-grid')

  const option: EChartsOption = {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
    },
    grid: { top: 8, right: 8, bottom: 40, left: 36 },
    xAxis: {
      type: 'category',
      data: buckets.map((b) => b.label),
      axisLine: { lineStyle: { color: axisColor } },
      axisLabel: {
        color: labelColor,
        fontSize: 10,
        interval: Math.floor(buckets.length / 6),
        rotate: 30,
      },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: maxRate,
      minInterval: 1,
      axisLine: { lineStyle: { color: axisColor } },
      axisLabel: { color: labelColor, fontSize: 11 },
      splitLine: { lineStyle: { color: gridColor } },
    },
    series: [
      {
        type: 'bar',
        data: buckets.map((b) => b.count),
        itemStyle: { color: penColor },
        barMaxWidth: 20,
        emphasis: { itemStyle: { opacity: 0.8 } },
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
        Failed to load alarm history
      </div>
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Rate summary header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: '4px',
          padding: '4px 8px 0',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: '22px',
            fontWeight: 700,
            color: alarmsPerHour > 0 ? 'var(--io-alarm-high)' : 'var(--io-alarm-normal)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {alarmsPerHour}
        </span>
        <span style={{ fontSize: '11px', color: 'var(--io-text-muted)' }}>alarms/hr</span>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: '10px',
            color: 'var(--io-text-muted)',
          }}
        >
          last {windowHours}h
        </span>
      </div>

      {/* Histogram */}
      <div style={{ flex: 1, minHeight: 0 }}>
        {totalAlarms === 0 ? (
          <div
            style={{
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--io-alarm-normal)',
              fontSize: '12px',
            }}
          >
            No alarms in window
          </div>
        ) : (
          <EChart option={option} />
        )}
      </div>
    </div>
  )
}
