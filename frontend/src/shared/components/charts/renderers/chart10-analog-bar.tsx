// ---------------------------------------------------------------------------
// Chart 10 — Analog Bar Indicator (ISA-101)
// Horizontal or vertical bar with desired zone, pointer triangle, optional
// setpoint line, value label, and range end labels.
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

export default function Chart10AnalogBar({ config }: RendererProps) {
  const pointSlot = config.points.find((p) => p.role === "point");
  const setpointSlot = config.points.find((p) => p.role === "setpoint");
  const pointIds = [
    ...(pointSlot ? [pointSlot.pointId] : []),
    ...(setpointSlot ? [setpointSlot.pointId] : []),
  ];

  const { values } = useWebSocket(pointIds);

  const rangeLo =
    typeof config.extras?.rangeLo === "number" ? config.extras.rangeLo : 0;
  const rangeHi =
    typeof config.extras?.rangeHi === "number" ? config.extras.rangeHi : 100;
  const desiredLo =
    typeof config.extras?.desiredLo === "number"
      ? config.extras.desiredLo
      : null;
  const desiredHi =
    typeof config.extras?.desiredHi === "number"
      ? config.extras.desiredHi
      : null;
  const isVertical = config.extras?.orientation === "vertical";

  const liveValue = pointSlot
    ? (values.get(pointSlot.pointId)?.value ?? null)
    : null;
  const setpointValue = setpointSlot
    ? (values.get(setpointSlot.pointId)?.value ?? null)
    : null;

  const span = rangeHi - rangeLo || 1;

  // Returns fraction 0..1 for a value within the range
  function frac(v: number): number {
    return clamp((v - rangeLo) / span, 0, 1);
  }

  const valueFrac = liveValue !== null ? frac(liveValue) : null;

  // Alarm state: value outside desired zone
  let pointerColor = "#4A9EFF";
  if (liveValue !== null) {
    if (desiredLo !== null && liveValue < desiredLo) pointerColor = "#EF4444";
    else if (desiredHi !== null && liveValue > desiredHi)
      pointerColor = "#F59E0B";
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

  // SVG dimensions
  const svgW = isVertical ? 60 : 300;
  const svgH = isVertical ? 300 : 60;

  // Bar geometry
  const barThick = 16;
  const barPad = isVertical ? 20 : 30;
  const barLen = (isVertical ? svgH : svgW) - barPad * 2;

  // Compute geometry for horizontal layout
  // barX/barY = top-left of bar rectangle
  const barX = isVertical ? (svgW - barThick) / 2 : barPad;
  const barY = isVertical ? barPad : (svgH - barThick) / 2;

  const barW = isVertical ? barThick : barLen;
  const barH = isVertical ? barLen : barThick;

  // Desired zone
  let desiredRect: { x: number; y: number; w: number; h: number } | null = null;
  if (desiredLo !== null && desiredHi !== null) {
    const lo = frac(desiredLo);
    const hi = frac(desiredHi);
    if (isVertical) {
      // Y axis inverted (bottom = low value)
      const y = barY + (1 - hi) * barLen;
      const h = (hi - lo) * barLen;
      desiredRect = { x: barX, y, w: barThick, h };
    } else {
      const x = barX + lo * barLen;
      const w = (hi - lo) * barLen;
      desiredRect = { x, y: barY, w, h: barThick };
    }
  }

  // Pointer triangle
  let pointerPath: string | null = null;
  const TRI = 7;
  if (valueFrac !== null) {
    if (isVertical) {
      const py = barY + (1 - valueFrac) * barLen;
      const px = barX + barThick + 2;
      pointerPath = `M ${px} ${py} L ${px + TRI} ${py - TRI / 2} L ${px + TRI} ${py + TRI / 2} Z`;
    } else {
      const px = barX + valueFrac * barLen;
      const py = barY - 2;
      pointerPath = `M ${px} ${py} L ${px - TRI / 2} ${py - TRI} L ${px + TRI / 2} ${py - TRI} Z`;
    }
  }

  // Setpoint line
  let spLine: { x1: number; y1: number; x2: number; y2: number } | null = null;
  if (setpointValue !== null) {
    const spFrac = frac(setpointValue);
    if (isVertical) {
      const y = barY + (1 - spFrac) * barLen;
      spLine = { x1: barX - 4, y1: y, x2: barX + barThick + 4, y2: y };
    } else {
      const x = barX + spFrac * barLen;
      spLine = { x1: x, y1: barY - 4, x2: x, y2: barY + barThick + 4 };
    }
  }

  // Value label
  let valueLabelX = 0,
    valueLabelY = 0;
  if (isVertical) {
    valueLabelX = svgW / 2;
    valueLabelY = barY + barLen + 16;
  } else {
    valueLabelX = svgW / 2;
    valueLabelY = barY + barThick + 14;
  }

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
        {/* Bar background */}
        <rect
          x={barX}
          y={barY}
          width={barW}
          height={barH}
          fill="var(--io-border)"
          rx={3}
        />

        {/* Desired zone */}
        {desiredRect && (
          <rect
            x={desiredRect.x}
            y={desiredRect.y}
            width={desiredRect.w}
            height={desiredRect.h}
            fill="#10B98144"
            rx={2}
          />
        )}

        {/* Setpoint line */}
        {spLine && (
          <line
            x1={spLine.x1}
            y1={spLine.y1}
            x2={spLine.x2}
            y2={spLine.y2}
            stroke="#F59E0B"
            strokeWidth={2}
            strokeDasharray="4,2"
          />
        )}

        {/* Pointer triangle */}
        {pointerPath && <path d={pointerPath} fill={pointerColor} />}

        {/* Range labels */}
        {isVertical ? (
          <>
            <text
              x={svgW / 2}
              y={barY - 6}
              textAnchor="middle"
              fontSize={10}
              fill="var(--io-text-muted)"
            >
              {rangeHi}
            </text>
            <text
              x={svgW / 2}
              y={barY + barLen + 14}
              textAnchor="middle"
              fontSize={10}
              fill="var(--io-text-muted)"
            >
              {rangeLo}
            </text>
          </>
        ) : (
          <>
            <text
              x={barPad}
              y={barY + barThick + 14}
              textAnchor="middle"
              fontSize={10}
              fill="var(--io-text-muted)"
            >
              {rangeLo}
            </text>
            <text
              x={barPad + barLen}
              y={barY + barThick + 14}
              textAnchor="middle"
              fontSize={10}
              fill="var(--io-text-muted)"
            >
              {rangeHi}
            </text>
          </>
        )}

        {/* Value label */}
        <text
          x={valueLabelX}
          y={isVertical ? valueLabelY + 14 : valueLabelY}
          textAnchor="middle"
          fontSize={12}
          fontWeight={600}
          fill="var(--io-text-primary)"
        >
          {liveValue !== null
            ? liveValue.toLocaleString(undefined, { maximumFractionDigits: 2 })
            : "—"}
        </text>
      </svg>
    </div>
  );
}
