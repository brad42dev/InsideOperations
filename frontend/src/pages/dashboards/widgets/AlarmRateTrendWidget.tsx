import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../../api/client'
import type { WidgetConfig } from '../../../api/dashboards'
import EChart from '../../../shared/components/charts/EChart'
import ChartToolbar from '../../../shared/components/charts/ChartToolbar'
import type { EChartsOption } from 'echarts'

interface AlarmRateTrendConfig {
  title?: string
  window_hours?: number
  bucket_hours?: number
}

interface AlarmEvent {
  id: string
  transitioned_at: string
}

interface Props {
  config: WidgetConfig
  variables: Record<string, string[]>
}

function resolveToken(token: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim()
}

function buildDailyBuckets(
  events: AlarmEvent[],
  windowHours: number,
  bucketHours: number,
  now: number,
): { label: string; count: number }[] {
  const windowMs = windowHours * 60 * 60 * 1000
  const bucketMs = bucketHours * 60 * 60 * 1000
  const bucketCount = Math.ceil(windowMs / bucketMs)
  const buckets: number[] = new Array(bucketCount).fill(0)

  for (const event of events) {
    const ts = new Date(event.transitioned_at).getTime()
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
    let label: string
    if (bucketHours >= 24) {
      label = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    } else {
      label = `${d.getMonth() + 1}/${d.getDate()} ${d.getHours().toString().padStart(2, '0')}:00`
    }
    return { label, count }
  })
}

export default function AlarmRateTrendWidget({ config }: Props) {
  const cfg = config.config as unknown as AlarmRateTrendConfig
  // Local duration state — toolbar controls this; initialised from saved config
  const [durationMinutes, setDurationMinutes] = useState((cfg.window_hours ?? 168) * 60)
  const windowHours = durationMinutes / 60
  const bucketHours = cfg.bucket_hours ?? (windowHours >= 72 ? 24 : 6)

  const windowMs = durationMinutes * 60 * 1000

  const query = useQuery({
    queryKey: ['alarm-rate-trend', durationMinutes],
    queryFn: async () => {
      const now = new Date()
      const start = new Date(now.getTime() - windowMs)
      const result = await api.get<{ data: AlarmEvent[] }>(
        `/api/alarms/history?from=${start.toISOString()}&to=${now.toISOString()}&per_page=10000`,
      )
      if (!result.success) throw new Error(result.error.message)
      return { events: Array.isArray(result.data?.data) ? result.data.data : [], fetchedAt: now.getTime() }
    },
    refetchInterval: 5 * 60 * 1000,
  })

  const buckets = query.data
    ? buildDailyBuckets(query.data.events, windowHours, bucketHours, query.data.fetchedAt)
    : []

  const maxRate = Math.max(...buckets.map((b) => b.count), 1)
  const totalAlarms = buckets.reduce((sum, b) => sum + b.count, 0)
  const alarmsPerDay =
    totalAlarms > 0 ? Math.round((totalAlarms / (windowHours / 24)) * 10) / 10 : 0

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
    grid: { top: 8, right: 8, bottom: 48, left: 36 },
    xAxis: {
      type: 'category',
      data: buckets.map((b) => b.label),
      axisLine: { lineStyle: { color: axisColor } },
      axisLabel: {
        color: labelColor,
        fontSize: 9,
        interval: Math.max(0, Math.floor(buckets.length / 7) - 1),
        rotate: 30,
      },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: maxRate,
      minInterval: 1,
      axisLine: { lineStyle: { color: axisColor } },
      axisLabel: { color: labelColor, fontSize: 10 },
      splitLine: { lineStyle: { color: gridColor } },
    },
    series: [
      {
        type: 'bar',
        data: buckets.map((b) => b.count),
        itemStyle: { color: penColor },
        barMaxWidth: 24,
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
      {/* Summary header */}
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
            fontSize: '20px',
            fontWeight: 700,
            color: alarmsPerDay > 0 ? 'var(--io-alarm-high)' : 'var(--io-alarm-normal)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {alarmsPerDay}
        </span>
        <span style={{ fontSize: '11px', color: 'var(--io-text-muted)' }}>alarms/day avg</span>
        <span
          style={{
            marginLeft: 'auto',
            fontSize: '10px',
            color: 'var(--io-text-muted)',
          }}
        >
          last {windowHours >= 24 ? `${Math.round(windowHours / 24)}d` : `${windowHours}h`}
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

      <ChartToolbar durationMinutes={durationMinutes} onDurationChange={setDurationMinutes} />
    </div>
  )
}
