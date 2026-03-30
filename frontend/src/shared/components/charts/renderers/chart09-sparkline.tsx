// ---------------------------------------------------------------------------
// Chart 09 — Sparkline
// Minimal inline SVG sparkline for a single point. No axes, no labels, no
// grid, no legend. Uses a 60-value ring buffer fed from WebSocket.
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState } from 'react'
import { useWebSocket } from '../../../hooks/useWebSocket'
import { type ChartConfig } from '../chart-config-types'

interface RendererProps {
  config: ChartConfig
  bufferKey: string
}

const BUFFER_SIZE = 60

export default function Chart09Sparkline({ config }: RendererProps) {
  const pointSlot = config.points.find((p) => p.role === 'point')
  const pointId = pointSlot?.pointId ?? null
  const pointIds = pointId ? [pointId] : []
  const strokeColor = pointSlot?.color ?? '#4A9EFF'

  const { values } = useWebSocket(pointIds)
  const liveEntry = pointId ? values.get(pointId) : undefined
  const liveValue = liveEntry?.value

  const bufRef = useRef<number[]>([])
  const [buf, setBuf] = useState<number[]>([])

  useEffect(() => {
    if (liveValue !== undefined) {
      bufRef.current = [...bufRef.current, liveValue].slice(-BUFFER_SIZE)
      setBuf([...bufRef.current])
    }
  }, [liveValue])

  if (!pointSlot) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--io-text-muted)',
          fontSize: 13,
        }}
      >
        No point configured
      </div>
    )
  }

  if (buf.length < 2) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--io-text-muted)',
          fontSize: 11,
        }}
      >
        Waiting for data…
      </div>
    )
  }

  const minV = Math.min(...buf)
  const maxV = Math.max(...buf)
  const range = maxV - minV || 1
  const W = 100
  const H = 100
  const step = W / (buf.length - 1)

  const points = buf
    .map((v, i) => {
      const x = i * step
      const y = H - ((v - minV) / range) * H
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')

  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      style={{ display: 'block', background: 'transparent' }}
    >
      <polyline
        points={points}
        fill="none"
        stroke={strokeColor}
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  )
}
