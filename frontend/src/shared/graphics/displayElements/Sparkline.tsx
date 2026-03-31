import type { SparklineConfig } from "../../types/graphics";
import { ALARM_COLORS, DE_COLORS } from "../displayElementColors";

interface Props {
  config: SparklineConfig;
  historicalValues?: number[];
  alarmPriority?: 1 | 2 | 3 | 4 | 5 | null;
  x?: number;
  y?: number;
}

export function Sparkline({
  historicalValues = [],
  alarmPriority,
  x = 0,
  y = 0,
}: Props) {
  const W = 110;
  const H = 18;
  const strokeColor = alarmPriority
    ? ALARM_COLORS[alarmPriority]
    : DE_COLORS.textSecondary;

  // Build polyline points
  let pointsStr = "";
  if (historicalValues.length >= 2) {
    const vals = historicalValues;
    const min = Math.min(...vals);
    const max = Math.max(...vals);
    const range = max - min || 1;
    const step = (W - 6) / (vals.length - 1);
    pointsStr = vals
      .map((v, i) => {
        const px = 3 + i * step;
        const py = 2 + (1 - (v - min) / range) * (H - 4);
        return `${px.toFixed(1)},${py.toFixed(1)}`;
      })
      .join(" ");
  } else {
    // Flat placeholder line
    pointsStr = `3,${H / 2} ${W - 3},${H / 2}`;
  }

  return (
    <g
      className="io-display-element"
      data-type="sparkline"
      transform={`translate(${x},${y})`}
    >
      <rect
        x={0}
        y={0}
        width={W}
        height={H}
        rx={1}
        fill={DE_COLORS.surfaceElevated}
      />
      <polyline
        points={pointsStr}
        fill="none"
        stroke={strokeColor}
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </g>
  );
}
