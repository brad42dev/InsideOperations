// ---------------------------------------------------------------------------
// Chart 11 — Fill Gauge
// Vertical fill bar (vessel visualization) with range coloring.
// Green = normal, yellow = warning, red = critical.
// ---------------------------------------------------------------------------

import { useWebSocket } from "../../../hooks/useWebSocket";
import { type ChartConfig } from "../chart-config-types";

interface RendererProps {
  config: ChartConfig;
  bufferKey: string;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export default function Chart11FillGauge({ config }: RendererProps) {
  const pointSlot = config.points.find((p) => p.role === "point");
  const pointId = pointSlot?.pointId ?? null;
  const pointIds = pointId ? [pointId] : [];

  const { values } = useWebSocket(pointIds);
  const liveValue = pointId ? (values.get(pointId)?.value ?? null) : null;

  const rangeLo =
    typeof config.extras?.rangeLo === "number" ? config.extras.rangeLo : 0;
  const rangeHi =
    typeof config.extras?.rangeHi === "number" ? config.extras.rangeHi : 100;
  const warnHi =
    typeof config.extras?.warnHi === "number" ? config.extras.warnHi : null;
  const warnLo =
    typeof config.extras?.warnLo === "number" ? config.extras.warnLo : null;
  const critHi =
    typeof config.extras?.critHi === "number" ? config.extras.critHi : null;
  const critLo =
    typeof config.extras?.critLo === "number" ? config.extras.critLo : null;

  const span = rangeHi - rangeLo || 1;
  const fillFrac =
    liveValue !== null ? clamp((liveValue - rangeLo) / span, 0, 1) : 0;

  // Determine fill color based on thresholds
  let fillColor = "#10B981";
  if (liveValue !== null) {
    if (
      (critHi !== null && liveValue >= critHi) ||
      (critLo !== null && liveValue <= critLo)
    ) {
      fillColor = "#EF4444";
    } else if (
      (warnHi !== null && liveValue >= warnHi) ||
      (warnLo !== null && liveValue <= warnLo)
    ) {
      fillColor = "#F59E0B";
    }
  }

  if (!pointSlot) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--io-text-muted)",
          fontSize: 13,
        }}
      >
        No point configured
      </div>
    );
  }

  // SVG geometry
  const svgW = 80;
  const svgH = 200;
  const padX = 20;
  const padTop = 16;
  const padBottom = 16;
  const vesselX = padX;
  const vesselY = padTop;
  const vesselW = svgW - padX * 2;
  const vesselH = svgH - padTop - padBottom;

  const fillH = fillFrac * vesselH;
  const fillY = vesselY + vesselH - fillH;

  const displayVal =
    liveValue !== null
      ? liveValue.toLocaleString(undefined, { maximumFractionDigits: 1 })
      : "—";

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: 0,
      }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${svgW} ${svgH}`}
        preserveAspectRatio="xMidYMid meet"
        style={{ overflow: "visible" }}
      >
        {/* Vessel outline */}
        <rect
          x={vesselX}
          y={vesselY}
          width={vesselW}
          height={vesselH}
          fill="var(--io-surface-raised)"
          stroke="var(--io-border)"
          strokeWidth={1.5}
          rx={4}
        />

        {/* Fill */}
        {fillH > 0 && (
          <rect
            x={vesselX + 1}
            y={fillY}
            width={vesselW - 2}
            height={fillH}
            fill={fillColor}
            opacity={0.75}
            rx={3}
            style={{ transition: "height 0.3s ease, y 0.3s ease" }}
          />
        )}

        {/* Value label centered in vessel */}
        <text
          x={vesselX + vesselW / 2}
          y={vesselY + vesselH / 2 + 4}
          textAnchor="middle"
          fontSize={12}
          fontWeight={700}
          fill="var(--io-text-primary)"
        >
          {displayVal}
        </text>

        {/* Range labels */}
        <text
          x={vesselX + vesselW + 4}
          y={vesselY + 4}
          fontSize={9}
          fill="var(--io-text-muted)"
        >
          {rangeHi}
        </text>
        <text
          x={vesselX + vesselW + 4}
          y={vesselY + vesselH}
          fontSize={9}
          fill="var(--io-text-muted)"
        >
          {rangeLo}
        </text>
      </svg>
    </div>
  );
}
