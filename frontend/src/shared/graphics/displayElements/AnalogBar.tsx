import type { AnalogBarConfig } from '../../types/graphics'
import { ALARM_COLORS, ZONE_FILLS, DE_COLORS } from '../displayElementColors'

interface PointValue {
  value: number | null
  alarmPriority?: 1 | 2 | 3 | 4 | 5 | null
  unacknowledged?: boolean
}

interface Props {
  config: AnalogBarConfig
  pointValue?: PointValue
  setpointValue?: number | null
  x?: number
  y?: number
}

export function AnalogBar({ config, pointValue, setpointValue, x = 0, y = 0 }: Props) {
  const {
    barWidth, barHeight, rangeLo, rangeHi,
    showZoneLabels, showPointer, showSetpoint, showNumericReadout,
    thresholds,
  } = config

  const value = pointValue?.value ?? null
  const alarmPriority = pointValue?.alarmPriority ?? null

  const range = rangeHi - rangeLo || 1
  const pct = value !== null ? Math.max(0, Math.min(1, (value - rangeLo) / range)) : 0
  const spPct = setpointValue !== null && setpointValue !== undefined
    ? Math.max(0, Math.min(1, (setpointValue - rangeLo) / range))
    : null

  // Calculate zone heights (proportional to range)
  const hhH = thresholds?.hh !== undefined ? ((rangeHi - thresholds.hh) / range) * barHeight : barHeight * 0.1
  const hH = thresholds?.h !== undefined && thresholds?.hh !== undefined
    ? ((thresholds.hh - thresholds.h) / range) * barHeight
    : barHeight * 0.18
  const llH = thresholds?.ll !== undefined ? ((thresholds.ll - rangeLo) / range) * barHeight : barHeight * 0.1
  const lH = thresholds?.l !== undefined && thresholds?.ll !== undefined
    ? ((thresholds.l - thresholds.ll) / range) * barHeight
    : barHeight * 0.18
  const normalH = barHeight - hhH - hH - llH - lH

  // Pointer position (vertical: from top = 1 - pct)
  const pointerY = (1 - pct) * barHeight
  const spY = spPct !== null ? (1 - spPct) * barHeight : null

  const zones = [
    { key: 'hh', fill: ZONE_FILLS.hh, y: 0, h: hhH, label: 'HH', labelY: hhH / 2 },
    { key: 'h', fill: ZONE_FILLS.h, y: hhH, h: hH, label: 'H', labelY: hhH + hH / 2 },
    { key: 'normal', fill: ZONE_FILLS.normal, y: hhH + hH, h: normalH, label: '', labelY: 0 },
    { key: 'l', fill: ZONE_FILLS.l, y: hhH + hH + normalH, h: lH, label: 'L', labelY: hhH + hH + normalH + lH / 2 },
    { key: 'll', fill: ZONE_FILLS.ll, y: hhH + hH + normalH + lH, h: llH, label: 'LL', labelY: hhH + hH + normalH + lH + llH / 2 },
  ]

  return (
    <g className="io-display-element" data-type="analog_bar" transform={`translate(${x},${y})`}>
      {/* Outer border */}
      <rect x={0} y={0} width={barWidth} height={barHeight} fill={DE_COLORS.surfaceElevated} stroke={DE_COLORS.borderStrong} strokeWidth={0.5} />

      {/* Zones */}
      {zones.map((z) => (
        <rect
          key={z.key}
          x={1} y={z.y} width={barWidth - 2} height={Math.max(0, z.h)}
          fill={z.fill}
          stroke={DE_COLORS.borderStrong}
          strokeWidth={0.5}
        />
      ))}

      {/* Zone labels */}
      {showZoneLabels && zones.filter((z) => z.label).map((z) => (
        <text
          key={`label-${z.key}`}
          x={-3} y={z.labelY}
          textAnchor="end"
          dominantBaseline="central"
          fontFamily="JetBrains Mono"
          fontSize={7}
          fill={DE_COLORS.textMuted}
        >
          {z.label}
        </text>
      ))}

      {/* Pointer */}
      {showPointer && value !== null && (
        <>
          <polygon
            points={`${barWidth},${pointerY - 3} ${barWidth + 6},${pointerY} ${barWidth},${pointerY + 3}`}
            fill={alarmPriority ? ALARM_COLORS[alarmPriority] : DE_COLORS.textSecondary}
          />
          <line
            x1={1} y1={pointerY} x2={barWidth - 1} y2={pointerY}
            stroke={alarmPriority ? ALARM_COLORS[alarmPriority] : DE_COLORS.textSecondary}
            strokeWidth={1}
          />
        </>
      )}

      {/* Setpoint diamond */}
      {showSetpoint && spY !== null && (
        <polygon
          points={`${barWidth + 6},${spY} ${barWidth + 10},${spY - 4} ${barWidth + 14},${spY} ${barWidth + 10},${spY + 4}`}
          fill="none"
          stroke={DE_COLORS.accent}
          strokeWidth={1.2}
        />
      )}

      {/* Numeric readout below */}
      {showNumericReadout && value !== null && (
        <text
          x={barWidth / 2} y={barHeight + 10}
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily="JetBrains Mono"
          fontSize={11}
          fill={alarmPriority ? ALARM_COLORS[alarmPriority] : DE_COLORS.textSecondary}
          style={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {value.toFixed(1)}
        </text>
      )}
    </g>
  )
}
