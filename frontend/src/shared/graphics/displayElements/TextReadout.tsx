import type { TextReadoutConfig } from '../../types/graphics'
import { ALARM_COLORS, DE_COLORS } from '../displayElementColors'

interface PointValue {
  value: string | number | null
  alarmPriority?: 1 | 2 | 3 | 4 | 5 | null
  unacknowledged?: boolean
  units?: string
  tag?: string
}

interface Props {
  config: TextReadoutConfig
  pointValue?: PointValue
  x?: number
  y?: number
}

function formatValue(raw: string | number | null, fmt: string): string {
  if (raw === null || raw === undefined) return '---'
  if (typeof raw === 'number') {
    // Simple printf-style %.Nf support
    const match = fmt.match(/^%\.(\d+)f$/)
    if (match) return raw.toFixed(parseInt(match[1]))
    const intMatch = fmt.match(/^%\.?0?d$|^%d$/)
    if (intMatch) return Math.round(raw).toString()
  }
  return String(raw)
}

export function TextReadout({ config, pointValue, x = 0, y = 0 }: Props) {
  const { showBox, showLabel, labelText, showUnits, valueFormat, minWidth } = config
  const priority = pointValue?.alarmPriority ?? null
  const unacked = pointValue?.unacknowledged ?? false
  const valueStr = formatValue(pointValue?.value ?? null, valueFormat)
  const unitStr = showUnits && pointValue?.units ? ` ${pointValue.units}` : ''
  const label = showLabel ? (labelText ?? pointValue?.tag ?? '') : ''

  const alarmColor = priority ? ALARM_COLORS[priority] : null
  const boxFill = alarmColor ? `${alarmColor}33` : DE_COLORS.surfaceElevated
  const boxStroke = alarmColor ?? DE_COLORS.border
  const strokeWidth = alarmColor ? 2 : 1
  const valueColor = alarmColor ? DE_COLORS.textPrimary : DE_COLORS.textSecondary

  // Estimate width
  const charWidth = 7 // rough JetBrains Mono 11px char width
  const estimatedValueWidth = (valueStr.length + unitStr.length) * charWidth + 10
  const w = Math.max(minWidth, estimatedValueWidth)
  const h = showLabel && label ? 36 : 24
  const valueY = showLabel && label ? h * 0.65 : h / 2

  const flashClass = unacked && alarmColor ? 'io-alarm-flash' : ''

  return (
    <g
      className={`io-display-element ${flashClass}`}
      data-type="text_readout"
      transform={`translate(${x},${y})`}
    >
      {showBox && (
        <rect
          x={0} y={0} width={w} height={h}
          rx={2} ry={2}
          fill={boxFill}
          stroke={boxStroke}
          strokeWidth={strokeWidth}
        />
      )}
      {showLabel && label && (
        <text
          x={w / 2} y={6}
          textAnchor="middle"
          dominantBaseline="hanging"
          fontFamily="Inter"
          fontSize={8}
          fill={DE_COLORS.textMuted}
        >
          {label}
        </text>
      )}
      <text
        x={w / 2} y={valueY}
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="JetBrains Mono"
        fontSize={11}
        fill={valueColor}
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {valueStr}
        {unitStr && (
          <tspan fontFamily="Inter" fontSize={9} fill={DE_COLORS.textMuted}>{unitStr}</tspan>
        )}
      </text>
    </g>
  )
}
