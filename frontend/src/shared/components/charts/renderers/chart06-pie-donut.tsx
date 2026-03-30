// ---------------------------------------------------------------------------
// Chart 06 — Pie / Donut Chart
// One slice per series point. Live via WebSocket, fallback to batch-latest.
// ---------------------------------------------------------------------------

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { EChartsOption } from 'echarts'
import EChart from '../EChart'
import { type ChartConfig, autoColor, slotLabel } from '../chart-config-types'
import { ChartLegendLayout, type LegendItem } from '../ChartLegend'
import { useWebSocket } from '../../../hooks/useWebSocket'
import { pointsApi } from '../../../../api/points'
import { useHighlight } from '../hooks/useHighlight'
import { getEChartsClickKey, getEChartsClickMulti } from '../chart-highlight-utils'

interface RendererProps {
  config: ChartConfig
  bufferKey: string
}

function resolveToken(token: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim()
}

export default function PieDonutChart({ config }: RendererProps) {
  const seriesSlots = config.points.filter((p) => p.role === 'series')
  const pointIds = seriesSlots.map((p) => p.pointId)
  const { highlighted, toggle } = useHighlight()

  const isDonut = config.extras?.donut === true
  const legendItems: LegendItem[] = seriesSlots.map((slot, i) => ({ label: slotLabel(slot), color: slot.color ?? autoColor(i) }))

  const { values } = useWebSocket(pointIds)

  const { data: latestData, isLoading } = useQuery({
    queryKey: ['batch-latest', ...pointIds],
    queryFn: () => pointsApi.batchLatest(pointIds),
    enabled: pointIds.length > 0,
    refetchInterval: 30_000,
    select: (res) => (res.success ? res.data : []),
  })

  const option: EChartsOption = useMemo(() => {
    const textMuted = resolveToken('--io-text-muted')

    const pieData = seriesSlots.map((slot, i) => {
      const ws = values.get(slot.pointId)
      const val = ws !== undefined
        ? ws.value
        : (latestData?.find((r) => r.point_id === slot.pointId)?.value ?? 0)
      return {
        name: slotLabel(slot),
        value: Math.max(0, val),
        itemStyle: {
          color: slot.color ?? autoColor(i),
          opacity: highlighted.size > 0 ? (highlighted.has(slotLabel(slot)) ? 1 : 0.15) : 1,
        },
      }
    })

    return {
      backgroundColor: 'transparent',
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c} ({d}%)',
      },
      legend: { show: false },
      series: [
        {
          type: 'pie',
          radius: isDonut ? ['40%', '70%'] : '65%',
          center: ['50%', '50%'],
          data: pieData,
          label: {
            show: true,
            formatter: '{b}\n{d}%',
            fontSize: 11,
            color: textMuted,
          },
          labelLine: { show: true },
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0,0,0,0.3)',
            },
          },
        },
      ],
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, latestData, config, seriesSlots, isDonut, highlighted])

  const onEvents = useMemo(
    () => ({
      click: (params: unknown) => {
        const key = getEChartsClickKey(params)
        if (!key) return
        toggle(key, getEChartsClickMulti(params))
      },
    }),
    [toggle],
  )

  if (pointIds.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--io-text-muted)', fontSize: 13 }}>
        No points configured
      </div>
    )
  }

  return (
    <ChartLegendLayout legend={config.legend} items={legendItems} highlighted={highlighted} onHighlight={toggle}>
      <div style={{ position: 'relative', flex: 1, minHeight: 0, width: '100%' }}>
        {isLoading && (
          <div style={{ position: 'absolute', top: 4, right: 8, fontSize: 11, color: 'var(--io-text-muted)', zIndex: 10, pointerEvents: 'none' }}>
            Loading…
          </div>
        )}
        <EChart option={option} onEvents={onEvents} height={300} />
      </div>
    </ChartLegendLayout>
  )
}
