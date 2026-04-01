import type { DigitalStatusConfig } from "../../types/graphics";
import { ALARM_COLORS, DE_COLORS } from "../displayElementColors";
import type { PointDetail } from "../../../api/points";
import { resolvePointLabel } from "../../utils/resolvePointLabel";

interface Props {
  config: DigitalStatusConfig;
  rawValue?: string | null;
  pointMeta?: PointDetail;
  x?: number;
  y?: number;
}

export function DigitalStatus({
  config,
  rawValue,
  pointMeta,
  x = 0,
  y = 0,
}: Props) {
  const { stateLabels, normalStates, abnormalPriority } = config;

  const valStr =
    rawValue !== null && rawValue !== undefined ? String(rawValue) : null;

  // For numeric OPC UA discrete/boolean points, resolve via enum_labels first
  const numericVal = valStr !== null ? Number(valStr) : null;
  const discreteLabel =
    pointMeta && numericVal !== null && !Number.isNaN(numericVal)
      ? resolvePointLabel(
          numericVal,
          pointMeta.point_category,
          pointMeta.enum_labels,
        )
      : null;

  // stateLabels config takes precedence (designer-configured overrides), then
  // enum_labels resolution, then raw value string, then placeholder
  const label =
    valStr !== null ? (stateLabels[valStr] ?? discreteLabel ?? valStr) : "---";
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
