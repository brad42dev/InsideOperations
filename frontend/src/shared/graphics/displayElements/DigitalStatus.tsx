import { useRef, useId } from "react";
import type { DigitalStatusConfig } from "../../types/graphics";
import { ALARM_COLORS, DE_COLORS } from "../displayElementColors";
import type { PointDetail } from "../../../api/points";
import { resolvePointLabel } from "../../utils/resolvePointLabel";
import { useDataQuality, DataQualityState } from "../dataQuality";

interface Props {
  config: DigitalStatusConfig;
  rawValue?: string | null;
  pointMeta?: PointDetail;
  quality?: string;
  lastUpdateMs?: number;
  x?: number;
  y?: number;
}

export function DigitalStatus({
  config,
  rawValue,
  pointMeta,
  quality,
  lastUpdateMs,
  x = 0,
  y = 0,
}: Props) {
  const { stateLabels, normalStates, abnormalPriority } = config;

  const mountRef = useRef(Date.now());
  const rawId = useId();
  const hatchId = `ds${rawId.replace(/[^a-zA-Z0-9]/g, "")}`;

  const dqState = useDataQuality(
    lastUpdateMs ?? mountRef.current,
    quality ?? "good",
  );

  const isStale = dqState === DataQualityState.Stale;
  const isUncertain = dqState === DataQualityState.Uncertain;
  const isBadQuality =
    dqState === DataQualityState.BadPhase1 ||
    dqState === DataQualityState.BadPhase2 ||
    dqState === DataQualityState.NotConnected;
  const isValueHidden =
    dqState === DataQualityState.BadPhase2 ||
    dqState === DataQualityState.NotConnected;

  const valStr =
    rawValue !== null && rawValue !== undefined ? String(rawValue) : null;

  // Resolve discrete label from enum_labels (OPC boolean/discrete_enum)
  const numericVal = valStr !== null ? Number(valStr) : null;
  const discreteLabel =
    pointMeta && numericVal !== null && !Number.isNaN(numericVal)
      ? resolvePointLabel(
          numericVal,
          pointMeta.point_category,
          pointMeta.enum_labels,
        )
      : null;

  // stateLabels config takes precedence, then enum resolution, then raw value
  const resolvedLabel =
    valStr !== null ? (stateLabels[valStr] ?? discreteLabel ?? valStr) : "---";
  const label = isValueHidden ? "---" : resolvedLabel;
  const isNormal = valStr === null || normalStates.includes(valStr);

  const fill = isBadQuality
    ? DE_COLORS.surfaceElevated
    : isNormal
      ? DE_COLORS.displayZoneInactive
      : (ALARM_COLORS[abnormalPriority] ?? DE_COLORS.border);
  const textColor =
    isBadQuality || isValueHidden
      ? DE_COLORS.textMuted
      : isNormal
        ? DE_COLORS.textSecondary
        : DE_COLORS.textPrimary;

  const charWidth = 7.5;
  const padding = 6;
  const w = Math.max(40, resolvedLabel.length * charWidth + padding * 2);
  const h = 22;

  return (
    <g
      className="io-display-element"
      data-type="digital_status"
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
      <rect
        x={0}
        y={0}
        width={w}
        height={h}
        rx={2}
        fill={fill}
        fillOpacity={isStale ? 0.6 : 1}
        stroke={isBadQuality ? "#52525B" : DE_COLORS.border}
        strokeWidth={1}
        strokeDasharray={isUncertain ? "3 2" : undefined}
      />
      {isBadQuality && (
        <rect
          x={0}
          y={0}
          width={w}
          height={h}
          rx={2}
          fill={`url(#${hatchId})`}
          style={{ pointerEvents: "none" }}
        />
      )}
      <text
        x={w / 2}
        y={h / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="JetBrains Mono"
        fontSize={9}
        fill={isStale ? DE_COLORS.textStale : textColor}
      >
        {label}
      </text>
    </g>
  );
}
