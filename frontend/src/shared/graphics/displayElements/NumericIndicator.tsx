import type { NumericIndicatorConfig } from '../../types/graphics'

interface PointValue {
  value: string | number | null
  alarmPriority?: 1 | 2 | 3 | 4 | 5 | null
  unacknowledged?: boolean
  units?: string
  tag?: string
}

interface Props {
  config: NumericIndicatorConfig
  pointValue?: PointValue
  x?: number
  y?: number
}

const ALARM_COLORS: Record<number, string> = {
  1: '#EF4444', 2: '#F97316', 3: '#EAB308', 4: '#06B6D4', 5: '#7C3AED',
}

export function NumericIndicator({ config, pointValue, x = 0, y = 0 }: Props) {
  const { fontSize, decimalPlaces, showUnit, showLabel, labelText, width } = config
  const raw = pointValue?.value ?? null
  const priority = pointValue?.alarmPriority ?? null
  const unacked = pointValue?.unacknowledged ?? false

  let displayValue = '---'
  if (raw !== null && raw !== undefined) {
    if (typeof raw === 'number') {
      displayValue = raw.toFixed(decimalPlaces)
    } else {
      const parsed = parseFloat(String(raw))
      displayValue = isNaN(parsed) ? String(raw) : parsed.toFixed(decimalPlaces)
    }
  }

  const unitStr = showUnit && pointValue?.units ? pointValue.units : null
  const label = showLabel ? (labelText ?? pointValue?.tag ?? '') : null

  const alarmColor = priority ? ALARM_COLORS[priority] : null
  const valueColor = alarmColor ?? '#F9FAFB'
  const flashClass = unacked && alarmColor ? 'io-alarm-flash' : ''

  // Compute height based on elements shown
  const labelH = label ? 14 : 0
  const unitH = unitStr ? 14 : 0
  const h = labelH + fontSize + 6 + unitH

  let cy = labelH + fontSize / 2 + 3

  return (
    <g
      className={`io-display-element ${flashClass}`}
      data-type="numeric_indicator"
      transform={`translate(${x},${y})`}
    >
      {label && (
        <text
          x={width / 2}
          y={10}
          textAnchor="middle"
          dominantBaseline="middle"
          fontFamily="Inter"
          fontSize={9}
          fill="#71717A"
          style={{ letterSpacing: '0.04em', textTransform: 'uppercase' }}
        >
          {label}
        </text>
      )}
      <text
        x={width / 2}
        y={cy}
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="JetBrains Mono"
        fontSize={fontSize}
        fontWeight="600"
        fill={valueColor}
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {displayValue}
      </text>
      {unitStr && (
        <text
          x={width / 2}
          y={h - 4}
          textAnchor="middle"
          dominantBaseline="middle"
          fontFamily="Inter"
          fontSize={10}
          fill="#71717A"
        >
          {unitStr}
        </text>
      )}
    </g>
  )
}
