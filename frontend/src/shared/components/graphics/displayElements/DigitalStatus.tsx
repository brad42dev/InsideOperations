interface StateDefinition {
  label: string
  color: string
}

interface DigitalStatusProps {
  x: number
  y: number
  value: number | string | null
  states: Record<string, StateDefinition>
  defaultState?: string
  fontSize?: number
}

const DEFAULT_FONT_SIZE = 12

export default function DigitalStatus({
  x,
  y,
  value,
  states,
  defaultState,
  fontSize = DEFAULT_FONT_SIZE,
}: DigitalStatusProps) {
  const key = value === null ? '' : String(value)
  const state = states[key]
  const label = state?.label ?? defaultState ?? key
  const color = state?.color ?? '#9CA3AF'

  return (
    <text
      x={x}
      y={y}
      fontSize={fontSize}
      fill={color}
      fontFamily="monospace"
      fontWeight="600"
      data-testid="digital-status"
    >
      {label}
    </text>
  )
}
