import * as Tooltip from '@radix-ui/react-tooltip'
import { ISA101 } from '../ISA101Colors'

interface AlarmIndicatorProps {
  x: number
  y: number
  priority?: 'critical' | 'high' | 'medium' | 'low'
  active?: boolean
  message?: string
  quality?: string
}

function priorityColor(priority?: 'critical' | 'high' | 'medium' | 'low'): string {
  switch (priority) {
    case 'critical': return ISA101.ALARM_CRITICAL
    case 'high':     return ISA101.ALARM_HIGH
    case 'medium':   return ISA101.ALARM_MEDIUM
    case 'low':      return ISA101.ALARM_LOW
    default:         return ISA101.ALARM_HIGH
  }
}

const DIAMOND_SIZE = 8

export default function AlarmIndicator({
  x,
  y,
  priority,
  active = false,
  message,
  quality,
}: AlarmIndicatorProps) {
  const blink =
    active && (priority === 'critical' || priority === 'high')

  const indicator = active ? (
    // Diamond shape for active alarm
    <polygon
      points={`${x},${y - DIAMOND_SIZE} ${x + DIAMOND_SIZE},${y} ${x},${y + DIAMOND_SIZE} ${x - DIAMOND_SIZE},${y}`}
      fill={quality === 'bad' ? '#6B7280' : priorityColor(priority)}
      stroke="rgba(0,0,0,0.4)"
      strokeWidth={0.5}
      style={blink ? { animation: 'alarm-blink 1s step-start infinite' } : undefined}
    />
  ) : (
    // Small gray circle for no alarm
    <circle
      cx={x}
      cy={y}
      r={4}
      fill="#374151"
      stroke="#6B7280"
      strokeWidth={1}
    />
  )

  if (!message) {
    return <g data-testid="alarm-indicator">{indicator}</g>
  }

  return (
    <Tooltip.Provider delayDuration={300}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <g data-testid="alarm-indicator" style={{ cursor: 'default' }}>
            {indicator}
          </g>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            sideOffset={4}
            style={{
              background: '#1F2937',
              color: '#E5E7EB',
              fontSize: 11,
              padding: '4px 8px',
              borderRadius: 4,
              border: '1px solid #374151',
              maxWidth: 220,
              zIndex: 9999,
            }}
          >
            {message}
            <Tooltip.Arrow style={{ fill: '#1F2937' }} />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  )
}
