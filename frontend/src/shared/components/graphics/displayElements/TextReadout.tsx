interface TextReadoutProps {
  x: number
  y: number
  value: number | null
  unit?: string
  label?: string
  decimalPlaces?: number
  fontSize?: number
  quality?: string
  stale?: boolean
  background?: boolean
  onPointClick?: () => void
}

const DEFAULT_FONT_SIZE = 12

function valueColor(quality?: string, stale?: boolean): string {
  if (stale) return '#F59E0B'
  if (!quality || quality === 'bad') return '#EF4444'
  if (quality === 'uncertain') return '#F59E0B'
  return '#E5E7EB'
}

export default function TextReadout({
  x,
  y,
  value,
  unit,
  label,
  decimalPlaces = 2,
  fontSize = DEFAULT_FONT_SIZE,
  quality,
  stale,
  background = false,
  onPointClick,
}: TextReadoutProps) {
  const displayValue =
    value === null ? 'N/C' : `${value.toFixed(decimalPlaces)}${unit ? ` ${unit}` : ''}`

  const labelHeight = label ? fontSize + 2 : 0
  const valueY = y + labelHeight + fontSize
  const textColor = valueColor(quality, stale)
  const totalWidth = displayValue.length * fontSize * 0.65
  const bgHeight = labelHeight + fontSize + 4
  const bgWidth = Math.max(totalWidth, label ? label.length * (fontSize * 0.6) : 0) + 8

  return (
    <g
      style={{
        cursor: onPointClick ? 'pointer' : undefined,
        pointerEvents: onPointClick ? 'auto' : 'none',
      }}
      onClick={onPointClick}
      data-testid="text-readout"
    >
      {background && (
        <rect
          x={x - 4}
          y={y - 2}
          width={bgWidth}
          height={bgHeight}
          fill="rgba(0,0,0,0.55)"
          rx={2}
          ry={2}
        />
      )}
      {label && (
        <text
          x={x}
          y={y + fontSize}
          fontSize={fontSize - 1}
          fill="#9CA3AF"
          fontFamily="monospace"
        >
          {label}
        </text>
      )}
      <text
        x={x}
        y={valueY}
        fontSize={fontSize}
        fill={textColor}
        fontFamily="monospace"
        fontWeight="500"
      >
        {displayValue}
      </text>
    </g>
  )
}
