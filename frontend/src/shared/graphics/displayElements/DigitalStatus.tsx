import type { DigitalStatusConfig } from "../../types/graphics";
import { ALARM_COLORS, DE_COLORS } from "../displayElementColors";

interface Props {
  config: DigitalStatusConfig;
  rawValue?: string | null;
  x?: number;
  y?: number;
}

export function DigitalStatus({ config, rawValue, x = 0, y = 0 }: Props) {
  const { stateLabels, normalStates, abnormalPriority } = config;

  const valStr =
    rawValue !== null && rawValue !== undefined ? String(rawValue) : null;
  const label = valStr !== null ? (stateLabels[valStr] ?? valStr) : "---";
  const isNormal = valStr === null || normalStates.includes(valStr);

  const fill = isNormal
    ? DE_COLORS.displayZoneInactive
    : (ALARM_COLORS[abnormalPriority] ?? DE_COLORS.border);
  const textColor = isNormal ? DE_COLORS.textSecondary : DE_COLORS.textPrimary;

  const charWidth = 7.5;
  const padding = 6;
  const w = Math.max(40, label.length * charWidth + padding * 2);
  const h = 22;

  return (
    <g
      className="io-display-element"
      data-type="digital_status"
      transform={`translate(${x},${y})`}
    >
      <rect x={0} y={0} width={w} height={h} rx={2} fill={fill} />
      <text
        x={w / 2}
        y={h / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="JetBrains Mono"
        fontSize={9}
        fill={textColor}
      >
        {label}
      </text>
    </g>
  );
}
