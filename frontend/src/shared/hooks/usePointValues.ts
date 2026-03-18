/**
 * usePointValues — returns current values for a set of point IDs.
 *
 * In live mode: subscribes via WebSocket (real-time updates).
 * In historical mode: fetches values at the current playback timestamp.
 *
 * Used by Dashboard widgets (KpiCard, GaugeWidget, LineChart) and other
 * components that need point values without caring about live vs historical.
 */
import { useMemo } from 'react'
import { useWebSocket } from './useWebSocket'
import { useHistoricalValues } from './useHistoricalValues'
import { usePlaybackStore } from '../../store/playback'
import type { PointValue } from './useWebSocket'

export type { PointValue }

export function usePointValues(pointIds: string[]): Map<string, PointValue> {
  const { mode, timestamp } = usePlaybackStore()
  const isHistorical = mode === 'historical'

  const { values: wsValues } = useWebSocket(isHistorical ? [] : pointIds)
  const histValues = useHistoricalValues(isHistorical ? pointIds : [], isHistorical ? timestamp : undefined)

  return useMemo(() => {
    if (!isHistorical) return wsValues
    // Coerce SceneRenderer PointValue → WS PointValue shape
    const out = new Map<string, PointValue>()
    for (const [id, pv] of histValues) {
      out.set(id, {
        pointId: pv.pointId,
        value: (pv.value as number) ?? 0,
        quality: pv.quality ?? 'uncertain',
        timestamp: new Date(timestamp).toISOString(),
      })
    }
    return out
  }, [isHistorical, wsValues, histValues, timestamp])
}
