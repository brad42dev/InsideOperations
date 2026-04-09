import { useRef, useId } from "react";
import type { AnalogBarConfig } from "../../types/graphics";
import { ALARM_COLORS, ZONE_FILLS, DE_COLORS } from "../displayElementColors";
import type { PointDetail } from "../../../api/points";
import { resolvePointLabel } from "../../utils/resolvePointLabel";
import { useDataQuality, DataQualityState } from "../dataQuality";

interface PointValue {
  value: number | null;
  alarmPriority?: 1 | 2 | 3 | 4 | 5 | null;
  unacknowledged?: boolean;
  quality?: string;
  lastUpdateMs?: number;
}

interface Props {
  config: AnalogBarConfig;
  pointValue?: PointValue;
  pointMeta?: PointDetail;
  setpointValue?: number | null;
  x?: number;
  y?: number;
}

export function AnalogBar({
  config,
  pointValue,
  pointMeta,
  setpointValue,
  x = 0,
  y = 0,
}: Props) {
  const {
    barWidth,
    barHeight,
    rangeLo,
    rangeHi,
    showZoneLabels,
    showPointer,
    showSetpoint,
    showNumericReadout,
    thresholds,
  } = config;

  const value = pointValue?.value ?? null;
  const alarmPriority = pointValue?.alarmPriority ?? null;

  const mountRef = useRef(Date.now());
  const rawId = useId();
  const hatchId = `ab${rawId.replace(/[^a-zA-Z0-9]/g, "")}`;

  const dqState = useDataQuality(
    pointValue?.lastUpdateMs ?? mountRef.current,
    pointValue?.quality ?? "good",
  );

  const isUncertain = dqState === DataQualityState.Uncertain;
  const isBadQuality =
    dqState === DataQualityState.BadPhase1 ||
    dqState === DataQualityState.BadPhase2 ||
    dqState === DataQualityState.NotConnected;
  const isValueHidden =
    dqState === DataQualityState.BadPhase2 ||
    dqState === DataQualityState.NotConnected;

  // Resolve discrete label for numeric readout
  const discreteLabel =
    pointMeta && value !== null
      ? resolvePointLabel(
          value,
          pointMeta.point_category,
          pointMeta.enum_labels,
        )
      : null;

  const range = rangeHi - rangeLo || 1;
  const pct =
    value !== null ? Math.max(0, Math.min(1, (value - rangeLo) / range)) : 0;
  const spPct =
    setpointValue !== null && setpointValue !== undefined
      ? Math.max(0, Math.min(1, (setpointValue - rangeLo) / range))
      : null;

  // Zone heights (proportional to range)
  const hhH =
    thresholds?.hh !== undefined
      ? ((rangeHi - thresholds.hh) / range) * barHeight
      : barHeight * 0.1;
  const hH =
    thresholds?.hh !== undefined && thresholds?.h !== undefined
      ? ((thresholds.hh - thresholds.h) / range) * barHeight
      : barHeight * 0.18;
  const llH =
    thresholds?.ll !== undefined
      ? ((thresholds.ll - rangeLo) / range) * barHeight
      : barHeight * 0.1;
  const lH =
    thresholds?.ll !== undefined && thresholds?.l !== undefined
      ? ((thresholds.l - thresholds.ll) / range) * barHeight
      : barHeight * 0.18;
  const normalH = barHeight - hhH - hH - llH - lH;

  // Pointer position (vertical: top = 1 - pct)
  const pointerY = (1 - pct) * barHeight;
  const spY = spPct !== null ? (1 - spPct) * barHeight : null;

  const zones = [
    {
      key: "hh",
      fill: ZONE_FILLS.hh,
      y: 0,
      h: hhH,
      label: "HH",
      labelY: hhH / 2,
    },
    {
      key: "h",
      fill: ZONE_FILLS.h,
      y: hhH,
      h: hH,
      label: "H",
      labelY: hhH + hH / 2,
    },
    {
      key: "n",
      fill: ZONE_FILLS.normal,
      y: hhH + hH,
      h: normalH,
      label: "",
      labelY: 0,
    },
    {
      key: "l",
      fill: ZONE_FILLS.l,
      y: hhH + hH + normalH,
      h: lH,
      label: "L",
      labelY: hhH + hH + normalH + lH / 2,
    },
    {
      key: "ll",
      fill: ZONE_FILLS.ll,
      y: hhH + hH + normalH + lH,
      h: llH,
      label: "LL",
      labelY: hhH + hH + normalH + lH + llH / 2,
    },
  ];

  const pointerColor = alarmPriority
    ? ALARM_COLORS[alarmPriority]
    : DE_COLORS.textSecondary;

  return (
    <g
      className="io-display-element"
      data-type="analog_bar"
      transform={`translate(${x},${y})`}
    >
      {isBadQuality && (
        <defs>
          <pattern
            id={hatchId}
            patternUnits="userSpaceOnUse"
            width={4}
            height={4}
          >
            <path
              d="M-1,1 l2,-2 M0,4 l4,-4 M3,5 l2,-2"
              stroke="#808080"
              strokeWidth={0.75}
              strokeOpacity={0.4}
            />
          </pattern>
        </defs>
      )}

      {/* Outer border */}
      <rect
        x={0}
        y={0}
        width={barWidth}
        height={barHeight}
        fill={DE_COLORS.surfaceElevated}
        stroke={isBadQuality ? "#52525B" : DE_COLORS.borderStrong}
        strokeWidth={0.5}
        strokeDasharray={isUncertain ? "3 2" : undefined}
      />

      {/* Zone fills */}
      {zones.map((z) => (
        <rect
          key={z.key}
          x={1}
          y={z.y}
          width={barWidth - 2}
          height={Math.max(0, z.h)}
          fill={z.fill}
          stroke={DE_COLORS.borderStrong}
          strokeWidth={0.5}
        />
      ))}

      {/* Zone labels */}
      {showZoneLabels &&
        zones
          .filter((z) => z.label)
          .map((z) => (
            <text
              key={`lbl-${z.key}`}
              x={-3}
              y={z.labelY}
              textAnchor="end"
              dominantBaseline="central"
              fontFamily="JetBrains Mono"
              fontSize={7}
              fill={DE_COLORS.textMuted}
            >
              {z.label}
            </text>
          ))}

      {/* BadPhase1 hatch overlay */}
      {isBadQuality && (
        <rect
          x={0}
          y={0}
          width={barWidth}
          height={barHeight}
          fill={`url(#${hatchId})`}
          style={{ pointerEvents: "none" }}
        />
      )}

      {/* BadPhase2 / NotConnected: hide bar content, show "---" */}
      {isValueHidden ? (
        <text
          x={barWidth / 2}
          y={barHeight / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily="JetBrains Mono"
          fontSize={9}
          fill={DE_COLORS.textMuted}
        >
          ---
        </text>
      ) : (
        <>
          {/* Value pointer */}
          {showPointer && value !== null && (
            <>
              <polygon
                points={`${barWidth},${pointerY - 3} ${barWidth + 6},${pointerY} ${barWidth},${pointerY + 3}`}
                fill={pointerColor}
              />
              <line
                x1={1}
                y1={pointerY}
                x2={barWidth - 1}
                y2={pointerY}
                stroke={pointerColor}
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
              x={barWidth / 2}
              y={barHeight + 10}
              textAnchor="middle"
              dominantBaseline="central"
              fontFamily="JetBrains Mono"
              fontSize={11}
              fill={
                dqState === DataQualityState.Stale
                  ? DE_COLORS.textStale
                  : alarmPriority
                    ? ALARM_COLORS[alarmPriority]
                    : DE_COLORS.textSecondary
              }
              style={{ fontVariantNumeric: "tabular-nums" }}
            >
              {discreteLabel !== null ? discreteLabel : value.toFixed(1)}
            </text>
          )}
        </>
      )}
    </g>
  );
}
