import type { AlarmIndicatorConfig } from '../../types/graphics'
import { ALARM_COLORS, DE_COLORS } from '../displayElementColors'

interface AlarmState {
  priority: 1 | 2 | 3 | 4 | 5
  unacknowledged: boolean
  active: boolean
}

interface Props {
  config: AlarmIndicatorConfig
  alarmState?: AlarmState | null
  /** Designer mode — show ghost placeholder even when inactive */
  designerMode?: boolean
  x?: number
  y?: number
}

const ALARM_PRIORITY_NAMES: Record<number, string> = { 1: '1', 2: '2', 3: '3', 4: '4', 5: 'C' }

function getFlashClass(priority: number): string {
  const names: Record<number, string> = { 1: 'critical', 2: 'high', 3: 'medium', 4: 'advisory', 5: 'custom' }
  return `io-alarm-flash-${names[priority] ?? 'critical'}`
}

export function AlarmIndicator({ alarmState, designerMode = false, x = 0, y = 0 }: Props) {
  if (!alarmState?.active && !designerMode) {
    return null
  }

  const priority = alarmState?.priority ?? 1
  const unacked = alarmState?.unacknowledged ?? false
  const isGhost = !alarmState?.active && designerMode
  const color = isGhost ? DE_COLORS.equipStroke : ALARM_COLORS[priority]
  const flashClass = unacked && !isGhost ? getFlashClass(priority) : ''
  const opacity = isGhost ? 0.25 : 1
  const label = isGhost ? '—' : ALARM_PRIORITY_NAMES[priority]

  const shapeEl = (() => {
    if (isGhost || priority === 1) {
      return (
        <rect x={-12} y={-9} width={24} height={18} rx={2}
          fill="none" stroke={color} strokeWidth={1.8} />
      )
    }
    if (priority === 2) {
      return <polygon points="0,-12 12,8 -12,8" fill="none" stroke={color} strokeWidth={1.8} />
    }
    if (priority === 3) {
      return <polygon points="0,12 12,-8 -12,-8" fill="none" stroke={color} strokeWidth={1.8} />
    }
    if (priority === 4) {
      return <ellipse rx={14} ry={10} fill="none" stroke={color} strokeWidth={1.8} />
    }
    // Custom / priority 5 — diamond
    return <polygon points="0,-12 12,0 0,12 -12,0" fill="none" stroke={color} strokeWidth={1.8} />
  })()

  return (
    <g
      className={`io-alarm-indicator ${flashClass}`}
      data-priority={priority}
      opacity={opacity}
      transform={`translate(${x},${y})`}
    >
      {shapeEl}
      <text
        x={0} y={0}
        textAnchor="middle" dominantBaseline="central"
        fontFamily="JetBrains Mono" fontSize={9} fontWeight={600}
        fill={color}
      >
        {label}
      </text>
    </g>
  )
}
