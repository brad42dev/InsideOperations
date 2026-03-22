import type { FillGaugeConfig } from '../../types/graphics'
import { ALARM_COLORS, DE_COLORS } from '../displayElementColors'

interface PointValue {
  value: number | null
  alarmPriority?: 1 | 2 | 3 | 4 | 5 | null
  unacknowledged?: boolean
}

interface Props {
  config: FillGaugeConfig
  pointValue?: PointValue
  vesselClipPath?: string // SVG path for vessel interior clip (vessel_overlay mode)
  vesselBounds?: { x: number; y: number; width: number; height: number }
  x?: number
  y?: number
  nodeId: string
}

export function FillGauge({ config, pointValue, vesselClipPath, vesselBounds, x = 0, y = 0, nodeId }: Props) {
  const { mode, rangeLo, rangeHi, barWidth = 22, barHeight = 90, showLevelLine, showValue, valueFormat } = config

  const value = pointValue?.value ?? null
  const alarmPriority = pointValue?.alarmPriority ?? null
  const unacked = pointValue?.unacknowledged ?? false

  const range = rangeHi - rangeLo || 1
  const pct = value !== null ? Math.max(0, Math.min(1, (value - rangeLo) / range)) : 0

  const fillColor = alarmPriority ? `${ALARM_COLORS[alarmPriority]}4D` : 'rgba(71,85,105,0.6)'
  const flashClass = unacked && alarmPriority ? 'io-alarm-flash' : ''
  const clipId = `fill-clip-${nodeId}`

  const formattedValue = (() => {
    if (value === null) return '---'
    const match = valueFormat.match(/^%\.(\d+)f%%$/)
    if (match) return `${(pct * 100).toFixed(parseInt(match[1]))}%`
    const match2 = valueFormat.match(/^%\.(\d+)f$/)
    if (match2) return value.toFixed(parseInt(match2[1]))
    return String(value)
  })()

  if (mode === 'standalone' || !vesselClipPath || !vesselBounds) {
    // Standalone bar mode
    const fillH = pct * (barHeight - 2)
    const fillY = barHeight - 1 - fillH

    return (
      <g className={`io-display-element ${flashClass}`} data-type="fill_gauge" transform={`translate(${x},${y})`}>
        <rect x={0} y={0} width={barWidth} height={barHeight} rx={2} fill="none" stroke={DE_COLORS.borderStrong} strokeWidth={0.5} />
        <rect x={1} y={fillY} width={barWidth - 2} height={fillH} rx={1} fill={fillColor} />
        {showLevelLine && fillH > 0 && (
          <line x1={1} y1={fillY} x2={barWidth - 1} y2={fillY} stroke={DE_COLORS.borderStrong} strokeWidth={1} strokeDasharray="5 3" />
        )}
        {showValue && (
          <text
            x={barWidth / 2} y={fillY + fillH / 2}
            textAnchor="middle" dominantBaseline="central"
            fontFamily="JetBrains Mono" fontSize={10} fill={DE_COLORS.textSecondary}
          >
            {formattedValue}
          </text>
        )}
      </g>
    )
  }

  // Vessel overlay mode — clip fill to vessel interior
  const { x: vx, y: vy, width: vw, height: vh } = vesselBounds
  const fillH = pct * vh
  const fillY = vy + vh - fillH

  return (
    <g className={`io-display-element ${flashClass}`} data-type="fill_gauge" transform={`translate(${x},${y})`}>
      <defs>
        <clipPath id={clipId}>
          <path d={vesselClipPath} />
        </clipPath>
      </defs>
      <rect
        x={vx} y={fillY} width={vw} height={fillH + 20}
        fill={fillColor}
        clipPath={`url(#${clipId})`}
      />
      {showLevelLine && fillH > 0 && (
        <line x1={vx} y1={fillY} x2={vx + vw} y2={fillY} stroke={DE_COLORS.borderStrong} strokeWidth={1} strokeDasharray="5 3" clipPath={`url(#${clipId})`} />
      )}
      {showValue && (
        <text
          x={vx + vw / 2} y={fillY + fillH / 2}
          textAnchor="middle" dominantBaseline="central"
          fontFamily="JetBrains Mono" fontSize={11} fill={DE_COLORS.textSecondary}
        >
          {formattedValue}
        </text>
      )}
    </g>
  )
}
