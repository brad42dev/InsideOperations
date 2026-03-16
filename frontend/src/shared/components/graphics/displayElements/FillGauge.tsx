interface FillGaugeProps {
  x: number
  y: number
  width: number
  height: number
  value: number | null
  min: number
  max: number
  fillDirection?: 'bottom_up' | 'top_down' | 'left_right' | 'right_left'
  unit?: string
  quality?: string
  stale?: boolean
}

function fillColor(fraction: number, stale?: boolean, quality?: string): string {
  if (stale || quality === 'bad') return '#6B7280'
  if (fraction > 0.9) return '#EF4444'
  if (fraction > 0.75) return '#F59E0B'
  return '#22C55E'
}

export default function FillGauge({
  x,
  y,
  width,
  height,
  value,
  min,
  max,
  fillDirection = 'bottom_up',
  unit,
  quality,
  stale,
}: FillGaugeProps) {
  const range = max === min ? 1 : max - min
  const fraction =
    value === null ? 0 : Math.max(0, Math.min(1, (value - min) / range))
  const color = fillColor(fraction, stale, quality)

  const pct = `${Math.round(fraction * 100)}%`
  const displayText = value === null
    ? 'N/C'
    : `${pct}${unit ? ` ${unit}` : ''}`

  // Compute fill rect based on direction
  let fillX = x
  let fillY = y
  let fillW = width
  let fillH = height

  switch (fillDirection) {
    case 'bottom_up':
      fillH = height * fraction
      fillY = y + height - fillH
      break
    case 'top_down':
      fillH = height * fraction
      break
    case 'left_right':
      fillW = width * fraction
      break
    case 'right_left':
      fillW = width * fraction
      fillX = x + width - fillW
      break
  }

  return (
    <g data-testid="fill-gauge">
      {/* Outer border */}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill="none"
        stroke="#374151"
        strokeWidth={1.5}
        rx={2}
        ry={2}
      />

      {/* Fill */}
      <rect
        x={fillX}
        y={fillY}
        width={fillW}
        height={fillH}
        fill={color}
        opacity={0.85}
        rx={1}
        ry={1}
      />

      {/* Percentage text centered */}
      <text
        x={x + width / 2}
        y={y + height / 2 + 4}
        textAnchor="middle"
        fontSize={11}
        fill="#E5E7EB"
        fontFamily="monospace"
        fontWeight="600"
        style={{ textShadow: '0 0 2px rgba(0,0,0,0.8)' }}
      >
        {displayText}
      </text>
    </g>
  )
}
