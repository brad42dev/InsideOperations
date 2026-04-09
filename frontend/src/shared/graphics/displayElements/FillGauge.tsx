import { useRef, useId } from "react";
import type { FillGaugeConfig } from "../../types/graphics";
import { ALARM_COLORS, DE_COLORS } from "../displayElementColors";
import type { PointDetail } from "../../../api/points";
import { resolvePointLabel } from "../../utils/resolvePointLabel";
import { useDataQuality, DataQualityState } from "../dataQuality";

// Level line stroke per spec: #64748B (slate-500)
const LEVEL_LINE_STROKE = "#64748B";

interface PointValue {
  value: number | null;
  alarmPriority?: 1 | 2 | 3 | 4 | 5 | null;
  unacknowledged?: boolean;
  quality?: string;
  lastUpdateMs?: number;
}

interface Props {
  config: FillGaugeConfig;
  pointValue?: PointValue;
  pointMeta?: PointDetail;
  vesselClipPath?: string;
  vesselBounds?: { x: number; y: number; width: number; height: number };
  x?: number;
  y?: number;
  nodeId: string;
}

export function FillGauge({
  config,
  pointValue,
  pointMeta,
  vesselClipPath,
  vesselBounds,
  x = 0,
  y = 0,
  nodeId,
}: Props) {
  const {
    mode,
    rangeLo,
    rangeHi,
    barWidth = 22,
    barHeight = 90,
    showLevelLine,
    showValue,
    valueFormat,
  } = config;

  const value = pointValue?.value ?? null;
  const alarmPriority = pointValue?.alarmPriority ?? null;
  const unacked = pointValue?.unacknowledged ?? false;

  const mountRef = useRef(Date.now());
  const rawId = useId();
  const hatchId = `fg${rawId.replace(/[^a-zA-Z0-9]/g, "")}`;
  const clipId = `fill-clip-${nodeId}`;

  const dqState = useDataQuality(
    pointValue?.lastUpdateMs ?? mountRef.current,
    pointValue?.quality ?? "good",
  );

  const isUncertain = dqState === DataQualityState.Uncertain;
  const isBadQuality =
    dqState === DataQualityState.BadPhase1 ||
    dqState === DataQualityState.BadPhase2 ||
    dqState === DataQualityState.NotConnected;

  const range = rangeHi - rangeLo || 1;
  const pct =
    value !== null ? Math.max(0, Math.min(1, (value - rangeLo) / range)) : 0;

  // Fill color: normal = #475569 at fill-normal-opacity; alarm = priority color at 30%
  // Stale: opacity drops to fill-stale-opacity
  const alarmColor = alarmPriority ? ALARM_COLORS[alarmPriority] : null;
  const fillColor = alarmColor
    ? `${alarmColor}4D`
    : "var(--io-fill-normal, #475569)";
  const fillOpacity = alarmColor
    ? 1
    : dqState === DataQualityState.Stale
      ? "var(--io-fill-stale-opacity, 0.3)"
      : "var(--io-fill-normal-opacity, 0.6)";

  // Unacknowledged alarm: 1Hz flash between priority-color and transparent
  const flashClass = unacked && alarmColor ? "io-alarm-flash" : "";

  // Resolve value display string
  const discreteLabel =
    pointMeta && value !== null
      ? resolvePointLabel(
          value,
          pointMeta.point_category,
          pointMeta.enum_labels,
        )
      : null;

  const formattedValue = (() => {
    if (value === null) return "---";
    if (discreteLabel !== null) return discreteLabel;
    const match = valueFormat.match(/^%\.(\d+)f%%$/);
    if (match) return `${(pct * 100).toFixed(parseInt(match[1]))}%`;
    const match2 = valueFormat.match(/^%\.(\d+)f$/);
    if (match2) return value.toFixed(parseInt(match2[1]));
    return String(value);
  })();

  const hatchDefs = isBadQuality ? (
    <defs>
      <pattern id={hatchId} patternUnits="userSpaceOnUse" width={4} height={4}>
        <path
          d="M-1,1 l2,-2 M0,4 l4,-4 M3,5 l2,-2"
          stroke="#808080"
          strokeWidth={0.75}
          strokeOpacity={0.4}
        />
      </pattern>
    </defs>
  ) : null;

  if (mode === "standalone" || !vesselClipPath || !vesselBounds) {
    const fillH = pct * (barHeight - 2);
    const fillY = barHeight - 1 - fillH;

    return (
      <g
        className={`io-display-element ${flashClass}`}
        data-type="fill_gauge"
        transform={`translate(${x},${y})`}
      >
        {hatchDefs}
        <rect
          x={0}
          y={0}
          width={barWidth}
          height={barHeight}
          rx={2}
          fill="none"
          stroke={isBadQuality ? "#52525B" : DE_COLORS.borderStrong}
          strokeWidth={0.5}
          strokeDasharray={isUncertain ? "3 2" : undefined}
        />
        {!isBadQuality || dqState === DataQualityState.BadPhase1 ? (
          <rect
            x={1}
            y={fillY}
            width={barWidth - 2}
            height={fillH}
            rx={1}
            fill={fillColor}
            opacity={fillOpacity as number | string}
          />
        ) : null}
        {isBadQuality && (
          <rect
            x={0}
            y={0}
            width={barWidth}
            height={barHeight}
            rx={2}
            fill={`url(#${hatchId})`}
            style={{ pointerEvents: "none" }}
          />
        )}
        {showLevelLine && fillH > 0 && !isBadQuality && (
          <line
            x1={1}
            y1={fillY}
            x2={barWidth - 1}
            y2={fillY}
            stroke={LEVEL_LINE_STROKE}
            strokeWidth={1}
            strokeDasharray="5 3"
          />
        )}
        {showValue && (
          <text
            x={barWidth / 2}
            y={fillY + fillH / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily="JetBrains Mono"
            fontSize={10}
            fill={
              dqState === DataQualityState.Stale
                ? DE_COLORS.textStale
                : DE_COLORS.textSecondary
            }
          >
            {formattedValue}
          </text>
        )}
      </g>
    );
  }

  // Vessel overlay mode — clip fill to vessel interior
  const { x: vx, y: vy, width: vw, height: vh } = vesselBounds;
  const fillH = pct * vh;
  const fillY = vy + vh - fillH;

  return (
    <g
      className={`io-display-element ${flashClass}`}
      data-type="fill_gauge"
      transform={`translate(${x},${y})`}
    >
      <defs>
        <clipPath id={clipId}>
          <path d={vesselClipPath} />
        </clipPath>
        {isBadQuality && (
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
        )}
      </defs>
      <rect
        x={vx}
        y={fillY}
        width={vw}
        height={fillH + 20}
        fill={fillColor}
        opacity={fillOpacity as number | string}
        clipPath={`url(#${clipId})`}
      />
      {isBadQuality && (
        <rect
          x={vx}
          y={vy}
          width={vw}
          height={vh}
          fill={`url(#${hatchId})`}
          clipPath={`url(#${clipId})`}
          style={{ pointerEvents: "none" }}
        />
      )}
      {showLevelLine && fillH > 0 && !isBadQuality && (
        <line
          x1={vx}
          y1={fillY}
          x2={vx + vw}
          y2={fillY}
          stroke={LEVEL_LINE_STROKE}
          strokeWidth={1}
          strokeDasharray="5 3"
          clipPath={`url(#${clipId})`}
        />
      )}
      {showValue && (
        <text
          x={vx + vw / 2}
          y={fillY + fillH / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily="JetBrains Mono"
          fontSize={11}
          fill={
            dqState === DataQualityState.Stale
              ? DE_COLORS.textStale
              : DE_COLORS.textSecondary
          }
        >
          {formattedValue}
        </text>
      )}
    </g>
  );
}
