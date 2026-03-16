interface AnalogBarProps {
  x: number
  y: number
  width?: number
  height?: number
  value: number | null
  min: number
  max: number
  lowLow?: number
  low?: number
  high?: number
  highHigh?: number
  unit?: string
  label?: string
  quality?: string
  stale?: boolean
}

const DEFAULT_WIDTH = 100
const DEFAULT_HEIGHT = 18

function barColor(
  value: number,
  min: number,
  max: number,
  low?: number,
  lowLow?: number,
  high?: number,
  highHigh?: number,
): string {
  if (highHigh !== undefined && value >= highHigh) return '#EF4444'
  if (lowLow !== undefined && value <= lowLow) return '#EF4444'
  if (high !== undefined && value >= high) return '#F59E0B'
  if (low !== undefined && value <= low) return '#F59E0B'
  // Use range fraction to decide — no alarm zones hit
  const fraction = max === min ? 0 : (value - min) / (max - min)
  if (fraction > 0.85 || fraction < 0.15) return '#F59E0B'
  return '#22C55E'
}

function alarmTickColor(
  zoneValue: number,
  isHigh: boolean,
  isExtreme: boolean,
): string {
  void zoneValue
  void isHigh
  if (isExtreme) return '#EF4444'
  return '#F59E0B'
}

export default function AnalogBar({
  x,
  y,
  width = DEFAULT_WIDTH,
  height = DEFAULT_HEIGHT,
  value,
  min,
  max,
  lowLow,
  low,
  high,
  highHigh,
  unit,
  label,
  quality,
  stale,
}: AnalogBarProps) {
  const safeValue = value === null ? min : value
  const range = max === min ? 1 : max - min
  const fraction = Math.max(0, Math.min(1, (safeValue - min) / range))
  const barWidth = fraction * width
  const color = stale || quality === 'bad'
    ? '#6B7280'
    : barColor(safeValue, min, max, low, lowLow, high, highHigh)

  const pointerX = x + barWidth
  const pointerH = height
  const pointerPoints = [
    `${pointerX},${y - 3}`,
    `${pointerX - 4},${y - 8}`,
    `${pointerX + 4},${y - 8}`,
  ].join(' ')

  // Text display
  const displayText =
    value === null
      ? 'N/C'
      : `${value.toFixed(1)}${unit ? ` ${unit}` : ''}`

  const textY = y + height + 11

  // Zone tick helper
  function zoneTick(
    zoneVal: number,
    isHigh: boolean,
    isExtreme: boolean,
  ) {
    const f = Math.max(0, Math.min(1, (zoneVal - min) / range))
    const tx = x + f * width
    return (
      <line
        key={`tick-${zoneVal}`}
        x1={tx}
        y1={y}
        x2={tx}
        y2={y + pointerH}
        stroke={alarmTickColor(zoneVal, isHigh, isExtreme)}
        strokeWidth={1.5}
        strokeDasharray="2,1"
      />
    )
  }

  return (
    <g data-testid="analog-bar">
      {/* Optional label */}
      {label && (
        <text x={x} y={y - 4} fontSize={10} fill="#9CA3AF" fontFamily="monospace">
          {label}
        </text>
      )}

      {/* Track background */}
      <rect x={x} y={y} width={width} height={height} fill="#1F2937" rx={2} ry={2} />

      {/* Filled bar */}
      <rect x={x} y={y} width={barWidth} height={height} fill={color} rx={2} ry={2} />

      {/* Alarm zone ticks */}
      {highHigh !== undefined && zoneTick(highHigh, true, true)}
      {high !== undefined && zoneTick(high, true, false)}
      {low !== undefined && zoneTick(low, false, false)}
      {lowLow !== undefined && zoneTick(lowLow, false, true)}

      {/* Pointer triangle at current value */}
      {value !== null && (
        <polygon points={pointerPoints} fill={color} />
      )}

      {/* Value text */}
      <text
        x={x + width / 2}
        y={textY}
        textAnchor="middle"
        fontSize={10}
        fill={stale ? '#F59E0B' : quality === 'bad' ? '#EF4444' : '#E5E7EB'}
        fontFamily="monospace"
      >
        {displayText}
      </text>
    </g>
  )
}
