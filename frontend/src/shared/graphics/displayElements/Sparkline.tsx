import type { SparklineConfig } from '../../types/graphics'

interface Props {
  config: SparklineConfig
  historicalValues?: number[]
  alarmPriority?: 1 | 2 | 3 | 4 | 5 | null
  x?: number
  y?: number
}

const ALARM_COLORS: Record<number, string> = {
  1: '#EF4444', 2: '#F97316', 3: '#EAB308', 4: '#06B6D4', 5: '#7C3AED',
}

export function Sparkline({ historicalValues = [], alarmPriority, x = 0, y = 0 }: Props) {
  const W = 110
  const H = 18
  const strokeColor = alarmPriority ? ALARM_COLORS[alarmPriority] : '#A1A1AA'

  // Build polyline points
  let pointsStr = ''
  if (historicalValues.length >= 2) {
    const vals = historicalValues
    const min = Math.min(...vals)
    const max = Math.max(...vals)
    const range = max - min || 1
    const step = (W - 6) / (vals.length - 1)
    pointsStr = vals
      .map((v, i) => {
        const px = 3 + i * step
        const py = 2 + (1 - (v - min) / range) * (H - 4)
        return `${px.toFixed(1)},${py.toFixed(1)}`
      })
      .join(' ')
  } else {
    // Flat placeholder line
    pointsStr = `3,${H / 2} ${W - 3},${H / 2}`
  }

  return (
    <g className="io-display-element" data-type="sparkline" transform={`translate(${x},${y})`}>
      <rect x={0} y={0} width={W} height={H} rx={1} fill="#27272A" />
      <polyline
        points={pointsStr}
        fill="none"
        stroke={strokeColor}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </g>
  )
}
