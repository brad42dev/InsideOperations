import { useRef, useId } from "react";
import type { SparklineConfig } from "../../types/graphics";
import { ALARM_COLORS, DE_COLORS } from "../displayElementColors";
import type { PointDetail } from "../../../api/points";
import { useDataQuality, DataQualityState } from "../dataQuality";
import { useValueUpdateFlash } from "../valueUpdateFlash";

// Sparkline dimensions (fixed, not resizable per spec)
const W = 110;
const H = 18;

interface PointValue {
  value?: number | null;
  alarmPriority?: 1 | 2 | 3 | 4 | 5 | null;
  quality?: string;
  lastUpdateMs?: number;
}

interface Props {
  config: SparklineConfig;
  historicalValues?: number[];
  pointValue?: PointValue;
  pointMeta?: PointDetail;
  x?: number;
  y?: number;
}

export function Sparkline({
  historicalValues = [],
  pointValue,
  pointMeta,
  x = 0,
  y = 0,
}: Props) {
  const alarmPriority = pointValue?.alarmPriority ?? null;
  const mountRef = useRef(Date.now());
  const rawId = useId();
  const hatchId = `sp${rawId.replace(/[^a-zA-Z0-9]/g, "")}`;

  const dqState = useDataQuality(
    pointValue?.lastUpdateMs ?? mountRef.current,
    pointValue?.quality ?? "good",
  );

  const isInAlarm = !!alarmPriority;
  const isUncertain = dqState === DataQualityState.Uncertain;
  const isBadQuality =
    dqState === DataQualityState.BadPhase1 ||
    dqState === DataQualityState.BadPhase2 ||
    dqState === DataQualityState.NotConnected;

  const isFlashing = useValueUpdateFlash(
    historicalValues[historicalValues.length - 1] ?? null,
    isInAlarm,
  );

  // Stroke color: alarm priority color, or muted gray (#71717A per kickoff spec)
  const strokeColor = alarmPriority
    ? ALARM_COLORS[alarmPriority]
    : DE_COLORS.textMuted;
  const strokeOpacity = dqState === DataQualityState.Stale ? 0.4 : 1;

  // Background: brightens briefly on value update flash
  const bgFill = isFlashing ? "#3F3F46" : DE_COLORS.surfaceElevated;

  const isDiscrete =
    pointMeta?.point_category === "boolean" ||
    pointMeta?.point_category === "discrete_enum";

  // Build polyline points string
  let pointsStr = "";
  if (historicalValues.length >= 2) {
    const vals = historicalValues;
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const range = max - min || 1;
    const step = (W - 6) / (vals.length - 1);

    if (isDiscrete) {
      const segments: string[] = [];
      vals.forEach((v, i) => {
        const px = 3 + i * step;
        const py = 2 + (1 - (v - min) / range) * (H - 4);
        if (i === 0) {
          segments.push(`${px.toFixed(1)},${py.toFixed(1)}`);
        } else {
          const prevPx = 3 + (i - 1) * step;
          segments.push(`${prevPx.toFixed(1)},${py.toFixed(1)}`);
          segments.push(`${px.toFixed(1)},${py.toFixed(1)}`);
        }
      });
      pointsStr = segments.join(" ");
    } else {
      pointsStr = vals
        .map((v, i) => {
          const px = 3 + i * step;
          const py = 2 + (1 - (v - min) / range) * (H - 4);
          return `${px.toFixed(1)},${py.toFixed(1)}`;
        })
        .join(" ");
    }
  } else {
    pointsStr = `3,${H / 2} ${W - 3},${H / 2}`;
  }

  return (
    <g
      className="io-display-element"
      data-type="sparkline"
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
      {/* Background */}
      <rect
        x={0}
        y={0}
        width={W}
        height={H}
        rx={1}
        fill={bgFill}
        stroke={isUncertain ? DE_COLORS.textMuted : undefined}
        strokeWidth={isUncertain ? 0.5 : undefined}
        strokeDasharray={isUncertain ? "3 2" : undefined}
      />
      {/* BadPhase1 hatch overlay */}
      {isBadQuality && (
        <rect
          x={0}
          y={0}
          width={W}
          height={H}
          rx={1}
          fill={`url(#${hatchId})`}
          style={{ pointerEvents: "none" }}
        />
      )}
      {/* Trend line — hidden in BadPhase2/NotConnected */}
      {!isBadQuality || dqState === DataQualityState.BadPhase1 ? (
        <polyline
          points={pointsStr}
          fill="none"
          stroke={strokeColor}
          strokeWidth={1.5}
          strokeOpacity={strokeOpacity}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ) : (
        <text
          x={W / 2}
          y={H / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily="JetBrains Mono"
          fontSize={7}
          fill={DE_COLORS.textMuted}
        >
          ---
        </text>
      )}
    </g>
  );
}
