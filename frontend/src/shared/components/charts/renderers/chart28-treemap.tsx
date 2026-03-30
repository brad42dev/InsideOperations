// ---------------------------------------------------------------------------
// Chart 28 — Treemap
// Points as leaf nodes; value = latest reading. Color scaled to min/max.
// ---------------------------------------------------------------------------

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { EChartsOption } from 'echarts'
import EChart from '../EChart'
import { type ChartConfig } from '../chart-config-types'
import { useWebSocket } from '../../../hooks/useWebSocket'
import { pointsApi } from '../../../../api/points'

interface RendererProps {
  config: ChartConfig
  bufferKey: string
}

function resolveToken(token: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(token).trim()
}

export default function TreemapChart({ config }: RendererProps) {
  const seriesSlots = config.points.filter((p) => p.role === 'series')
  const pointIds = seriesSlots.map((p) => p.pointId)

  const { values } = useWebSocket(pointIds)

  const { data: latestData, isLoading } = useQuery({
    queryKey: ['batch-latest', ...pointIds],
    queryFn: () => pointsApi.batchLatest(pointIds),
    enabled: pointIds.length > 0,
    refetchInterval: 30_000,
    select: (res) => (res.success ? res.data : []),
  })

  const option: EChartsOption = useMemo(() => {
    const textPrimary = resolveToken('--io-text-primary')

    const leafData = seriesSlots.map((slot) => {
      const ws = values.get(slot.pointId)
      const val = ws !== undefined
        ? ws.value
        : (latestData?.find((r) => r.point_id === slot.pointId)?.value ?? 0)
      return { name: slot.pointId, value: Math.max(0, val) }
    })

    const allVals = leafData.map((d) => d.value)
    const minVal = allVals.length ? Math.min(...allVals) : 0
    const maxVal = allVals.length ? Math.max(...allVals) : 1

    return {
      backgroundColor: 'transparent',
      tooltip: {
        formatter: (params: unknown) => {
          const p = params as { name: string; value: number }
          return `${p.name}: ${p.value.toFixed(3)}`
        },
      },
      visualMap: {
        show: true,
        min: minVal,
        max: maxVal,
        inRange: { color: ['#3B82F6', '#10B981', '#F59E0B', '#EF4444'] },
        calculable: false,
        orient: 'horizontal' as const,
        bottom: 0,
        left: 'center' as const,
        textStyle: { color: textPrimary, fontSize: 10 },
      },
      series: [
        {
          type: 'treemap',
          data: leafData,
          width: '100%',
          height: '85%',
          roam: false,
          nodeClick: false,
          breadcrumb: { show: false },
          label: {
            show: true,
            fontSize: 11,
            color: '#fff',
            formatter: (params: unknown) => {
              const p = params as { name: string; value: number }
              return `${p.name}\n${p.value.toFixed(2)}`
            },
          },
          itemStyle: {
            borderColor: 'var(--io-surface)',
            borderWidth: 2,
            gapWidth: 2,
          },
          emphasis: {
            itemStyle: { shadowBlur: 8, shadowColor: 'rgba(0,0,0,0.4)' },
          },
        },
      ],
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values, latestData, seriesSlots])

  if (pointIds.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--io-text-muted)', fontSize: 13 }}>
        No points configured
      </div>
    )
  }

  return (
    <div style={{ position: 'relative', flex: 1, minHeight: 0, width: '100%' }}>
      {isLoading && (
        <div style={{ position: 'absolute', top: 4, right: 8, fontSize: 11, color: 'var(--io-text-muted)', zIndex: 10, pointerEvents: 'none' }}>
          Loading…
        </div>
      )}
      <EChart option={option} height={300} />
    </div>
  )
}
