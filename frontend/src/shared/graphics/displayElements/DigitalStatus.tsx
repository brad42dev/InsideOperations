import type { DigitalStatusConfig } from '../../types/graphics'

interface Props {
  config: DigitalStatusConfig
  rawValue?: string | null
  x?: number
  y?: number
}

const ALARM_COLORS: Record<number, string> = {
  1: '#EF4444', 2: '#F97316', 3: '#EAB308', 4: '#06B6D4', 5: '#7C3AED',
}

export function DigitalStatus({ config, rawValue, x = 0, y = 0 }: Props) {
  const { stateLabels, normalStates, abnormalPriority } = config

  const valStr = rawValue !== null && rawValue !== undefined ? String(rawValue) : null
  const label = valStr !== null ? (stateLabels[valStr] ?? valStr) : '---'
  const isNormal = valStr === null || normalStates.includes(valStr)

  const fill = isNormal ? '#3F3F46' : ALARM_COLORS[abnormalPriority] ?? '#EF4444'
  const textColor = isNormal ? '#A1A1AA' : '#F9FAFB'

  const charWidth = 7.5
  const padding = 6
  const w = Math.max(40, label.length * charWidth + padding * 2)
  const h = 22

  return (
    <g className="io-display-element" data-type="digital_status" transform={`translate(${x},${y})`}>
      <rect x={0} y={0} width={w} height={h} rx={2} fill={fill} />
      <text
        x={w / 2} y={h / 2}
        textAnchor="middle" dominantBaseline="central"
        fontFamily="JetBrains Mono" fontSize={9}
        fill={textColor}
      >
        {label}
      </text>
    </g>
  )
}
