import { useRef, useState, useEffect, useId } from "react";
import type { TextReadoutConfig } from "../../types/graphics";
import { ALARM_COLORS, DE_COLORS } from "../displayElementColors";
import type { PointDetail } from "../../../api/points";
import { resolvePointLabel } from "../../utils/resolvePointLabel";
import { useDataQuality, DataQualityState } from "../dataQuality";
import { useValueUpdateFlash } from "../valueUpdateFlash";

interface PointValue {
  value: string | number | null;
  alarmPriority?: 1 | 2 | 3 | 4 | 5 | null;
  unacknowledged?: boolean;
  units?: string;
  tag?: string;
  quality?: string;
  lastUpdateMs?: number;
}

interface Props {
  config: TextReadoutConfig;
  pointValue?: PointValue;
  pointMeta?: PointDetail;
  x?: number;
  y?: number;
}

function formatValue(raw: string | number | null, fmt: string): string {
  if (raw === null || raw === undefined) return "---";
  if (typeof raw === "number") {
    const match = fmt.match(/^%\.(\d+)f$/);
    if (match) return raw.toFixed(parseInt(match[1]));
    const intMatch = fmt.match(/^%\.?0?d$|^%d$/);
    if (intMatch) return Math.round(raw).toString();
  }
  return String(raw);
}

export function TextReadout({
  config,
  pointValue,
  pointMeta,
  x = 0,
  y = 0,
}: Props) {
  const { showBox, showLabel, labelText, showUnits, valueFormat, minWidth } =
    config;
  const priority = pointValue?.alarmPriority ?? null;
  const unacked = pointValue?.unacknowledged ?? false;

  const mountRef = useRef(Date.now());
  const rawId = useId();
  const hatchId = `tr${rawId.replace(/[^a-zA-Z0-9]/g, "")}`;

  const dqState = useDataQuality(
    pointValue?.lastUpdateMs ?? mountRef.current,
    pointValue?.quality ?? "good",
  );

  const alarmColor = priority ? ALARM_COLORS[priority] : null;
  const isInAlarm = !!priority;

  // JS-driven 1Hz alarm flash — box/border only; value text never flashes
  const [flashOn, setFlashOn] = useState(true);
  useEffect(() => {
    if (!unacked || !alarmColor) {
      setFlashOn(true);
      return;
    }
    const id = setInterval(() => setFlashOn((v) => !v), 500);
    return () => clearInterval(id);
  }, [unacked, alarmColor]);

  // Resolve value string
  const rawNumeric =
    typeof pointValue?.value === "number" ? pointValue.value : null;
  const discreteLabel =
    pointMeta && rawNumeric !== null
      ? resolvePointLabel(
          rawNumeric,
          pointMeta.point_category,
          pointMeta.enum_labels,
        )
      : null;

  const isUncertain = dqState === DataQualityState.Uncertain;
  const isBadQuality =
    dqState === DataQualityState.BadPhase1 ||
    dqState === DataQualityState.BadPhase2 ||
    dqState === DataQualityState.NotConnected;
  const isValueHidden =
    dqState === DataQualityState.BadPhase2 ||
    dqState === DataQualityState.NotConnected;

  const valueStr = isValueHidden
    ? "---"
    : discreteLabel !== null
      ? discreteLabel
      : formatValue(pointValue?.value ?? null, valueFormat);

  const unitStr =
    !isValueHidden && discreteLabel === null && showUnits && pointValue?.units
      ? ` ${pointValue.units}`
      : "";

  const label = showLabel ? (labelText ?? pointValue?.tag ?? "") : "";

  const isFlashing = useValueUpdateFlash(
    isValueHidden ? null : (pointValue?.value ?? null),
    isInAlarm,
  );

  // Box styling
  const showAlarmTint = isInAlarm && flashOn;
  let boxFill = showAlarmTint ? `${alarmColor}33` : DE_COLORS.surfaceElevated;
  let boxStroke = showAlarmTint ? alarmColor! : DE_COLORS.border;
  let boxStrokeWidth = showAlarmTint ? 2 : 1;

  if (isBadQuality) {
    boxStroke = "#52525B";
    boxStrokeWidth = 1;
    // Alarm tint continues during bad quality (spec: "Alarm tint: continues if alarm active")
    if (!showAlarmTint) boxFill = DE_COLORS.surfaceElevated;
  } else if (!isInAlarm && isFlashing) {
    // Value-update flash: border brightens briefly (150ms)
    boxStroke = "#71717A";
  }

  // Value text color
  let valueColor: string;
  if (isValueHidden) {
    valueColor = DE_COLORS.textMuted;
  } else if (dqState === DataQualityState.Stale) {
    valueColor = DE_COLORS.textStale;
  } else if (isInAlarm) {
    valueColor = DE_COLORS.textPrimary;
  } else {
    valueColor = DE_COLORS.textSecondary;
  }

  // Estimate dimensions
  const charWidth = 7;
  const estimatedValueWidth =
    (valueStr.length + unitStr.length) * charWidth + 10;
  const w = Math.max(minWidth, estimatedValueWidth);
  const h = showLabel && label ? 36 : 24;
  const valueY = showLabel && label ? h * 0.65 : h / 2;

  return (
    <g
      className="io-display-element"
      data-type="text_readout"
      transform={`translate(${x},${y})`}
      opacity={dqState === DataQualityState.Stale ? 0.6 : undefined}
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
      {showBox && (
        <rect
          x={0}
          y={0}
          width={w}
          height={h}
          rx={2}
          ry={2}
          fill={boxFill}
          stroke={boxStroke}
          strokeWidth={boxStrokeWidth}
          strokeDasharray={isUncertain ? "3 2" : undefined}
        />
      )}
      {isBadQuality && showBox && (
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
      {showLabel && label && (
        <text
          x={w / 2}
          y={6}
          textAnchor="middle"
          dominantBaseline="hanging"
          fontFamily="Inter"
          fontSize={8}
          fill={DE_COLORS.textMuted}
        >
          {label}
        </text>
      )}
      <text
        x={w / 2}
        y={valueY}
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="JetBrains Mono"
        fontSize={11}
        fill={valueColor}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {valueStr}
        {unitStr && (
          <tspan fontFamily="Inter" fontSize={9} fill={DE_COLORS.textMuted}>
            {unitStr}
          </tspan>
        )}
      </text>
    </g>
  );
}
