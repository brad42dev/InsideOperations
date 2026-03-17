// Returns real-time values for an array of point IDs via WebSocket.
// Falls back gracefully when pointIds is empty.
import { useWebSocket } from './useWebSocket'
import type { PointValue } from './useWebSocket'

export type { PointValue }

export function usePointValues(pointIds: string[]): Map<string, PointValue> {
  const { values } = useWebSocket(pointIds)
  return values
}
