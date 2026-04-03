// ---------------------------------------------------------------------------
// ChartTypePicker — left list of 39 chart types + right preview/description panel
// ---------------------------------------------------------------------------

import { useState } from "react";
import {
  CHART_DEFINITIONS,
  CHART_CATEGORIES,
  getTierLabel,
  type ChartDefinition,
  type ChartContext,
  type PointTypeCategory,
} from "./chart-definitions";
import type { ChartTypeId } from "./chart-config-types";

interface ChartTypePickerProps {
  selectedType: ChartTypeId;
  onSelect: (type: ChartTypeId) => void;
  /** When provided, hides charts that don't list this context in their `contexts` field. */
  context?: ChartContext;
  /**
   * When provided, dims (opacity 0.4, pointer-events none) chart types that
   * cannot accept the given point type categories. Charts are never hidden —
   * they remain visible so users can see what exists.
   */
  pointTypes?: PointTypeCategory[];
}

function isCompatible(
  def: ChartDefinition,
  pointTypes?: PointTypeCategory[],
): boolean {
  if (!pointTypes || pointTypes.length === 0) return true;
  if (def.acceptedPointTypes.includes("any")) return true;
  return pointTypes.some(
    (pt) => pt === "any" || def.acceptedPointTypes.includes(pt),
  );
}

// ── SVG Thumbnails ───────────────────────────────────────────────────────────
// Schematic 120×80 SVG previews for each chart type

function ThumbnailLineTrend({ step = false }: { step?: boolean }) {
  const pts = step
    ? "10,60 10,30 35,30 35,50 55,50 55,20 80,20 80,45 110,45"
    : "10,60 30,40 55,25 80,45 110,20";
  return (
    <svg viewBox="0 0 120 80" width={120} height={80}>
      <rect width={120} height={80} fill="none" />
      <line
        x1={10}
        y1={70}
        x2={115}
        y2={70}
        stroke="var(--io-border)"
        strokeWidth={1}
      />
      <line
        x1={10}
        y1={10}
        x2={10}
        y2={70}
        stroke="var(--io-border)"
        strokeWidth={1}
      />
      <polyline
        points={pts}
        fill="none"
        stroke="#4A9EFF"
        strokeWidth={2}
        strokeLinejoin={step ? "miter" : "round"}
      />
      <polyline
        points="10,55 30,65 55,55 80,60 110,50"
        fill="none"
        stroke="#F59E0B"
        strokeWidth={1.5}
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ThumbnailMultiAxis() {
  return (
    <svg viewBox="0 0 120 80" width={120} height={80}>
      <line
        x1={10}
        y1={70}
        x2={115}
        y2={70}
        stroke="var(--io-border)"
        strokeWidth={1}
      />
      <line
        x1={10}
        y1={10}
        x2={10}
        y2={70}
        stroke="#4A9EFF"
        strokeWidth={1.5}
      />
      <line
        x1={110}
        y1={10}
        x2={110}
        y2={70}
        stroke="#F59E0B"
        strokeWidth={1.5}
      />
      <polyline
        points="10,50 40,30 70,45 110,20"
        fill="none"
        stroke="#4A9EFF"
        strokeWidth={2}
      />
      <polyline
        points="10,65 40,55 70,60 110,40"
        fill="none"
        stroke="#F59E0B"
        strokeWidth={2}
      />
    </svg>
  );
}

function ThumbnailBar({ horizontal = false }: { horizontal?: boolean }) {
  if (horizontal) {
    return (
      <svg viewBox="0 0 120 80" width={120} height={80}>
        <line
          x1={20}
          y1={10}
          x2={20}
          y2={70}
          stroke="var(--io-border)"
          strokeWidth={1}
        />
        {[0, 1, 2, 3].map((i) => {
          const w = [70, 50, 80, 40][i];
          const y = 15 + i * 14;
          return (
            <rect
              key={i}
              x={20}
              y={y}
              width={w}
              height={10}
              fill={["#4A9EFF", "#F59E0B", "#10B981", "#8B5CF6"][i]}
              rx={2}
            />
          );
        })}
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 120 80" width={120} height={80}>
      <line
        x1={10}
        y1={70}
        x2={115}
        y2={70}
        stroke="var(--io-border)"
        strokeWidth={1}
      />
      {[0, 1, 2, 3, 4].map((i) => {
        const h = [45, 30, 55, 25, 40][i];
        const x = 15 + i * 20;
        return (
          <rect
            key={i}
            x={x}
            y={70 - h}
            width={14}
            height={h}
            fill={["#4A9EFF", "#F59E0B", "#10B981", "#8B5CF6", "#EC4899"][i]}
            rx={2}
          />
        );
      })}
    </svg>
  );
}

function ThumbnailPie({ donut = false }: { donut?: boolean }) {
  const cx = 60,
    cy = 40,
    r = 28;
  const segments = [
    { pct: 0.35, color: "#4A9EFF" },
    { pct: 0.25, color: "#F59E0B" },
    { pct: 0.2, color: "#10B981" },
    { pct: 0.2, color: "#8B5CF6" },
  ];
  let angle = -Math.PI / 2;
  const paths = segments.map((seg) => {
    const start = angle;
    const end = angle + seg.pct * 2 * Math.PI;
    const x1 = cx + r * Math.cos(start),
      y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end),
      y2 = cy + r * Math.sin(end);
    const large = seg.pct > 0.5 ? 1 : 0;
    angle = end;
    return {
      d: `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2} Z`,
      color: seg.color,
    };
  });
  return (
    <svg viewBox="0 0 120 80" width={120} height={80}>
      {paths.map((p, i) => (
        <path
          key={i}
          d={p.d}
          fill={p.color}
          stroke="var(--io-surface)"
          strokeWidth={1}
        />
      ))}
      {donut && <circle cx={cx} cy={cy} r={14} fill="var(--io-surface)" />}
    </svg>
  );
}

function ThumbnailGauge() {
  return (
    <svg viewBox="0 0 120 80" width={120} height={80}>
      <path
        d="M20,65 A40,40 0 0,1 100,65"
        fill="none"
        stroke="#EF4444"
        strokeWidth={8}
      />
      <path
        d="M20,65 A40,40 0 0,1 60,25"
        fill="none"
        stroke="#F59E0B"
        strokeWidth={8}
      />
      <path
        d="M20,65 A40,40 0 0,1 20,65"
        fill="none"
        stroke="#10B981"
        strokeWidth={8}
      />
      <path
        d="M20,65 A40,40 0 0,1 70,28"
        fill="none"
        stroke="#10B981"
        strokeWidth={8}
        strokeOpacity={0.8}
      />
      <line
        x1={60}
        y1={65}
        x2={72}
        y2={32}
        stroke="var(--io-text-primary)"
        strokeWidth={2.5}
        strokeLinecap="round"
      />
      <circle cx={60} cy={65} r={4} fill="var(--io-text-primary)" />
    </svg>
  );
}

function ThumbnailKpiCard() {
  return (
    <svg viewBox="0 0 120 80" width={120} height={80}>
      <rect
        x={5}
        y={5}
        width={110}
        height={70}
        rx={6}
        fill="var(--io-surface-secondary)"
        stroke="var(--io-border)"
        strokeWidth={1}
      />
      <text
        x={60}
        y={48}
        textAnchor="middle"
        fontSize={28}
        fontWeight={700}
        fill="#4A9EFF"
      >
        142.7
      </text>
      <text
        x={60}
        y={64}
        textAnchor="middle"
        fontSize={10}
        fill="var(--io-text-muted)"
      >
        °C ▲ 2.1%
      </text>
      <text
        x={60}
        y={20}
        textAnchor="middle"
        fontSize={9}
        fill="var(--io-text-muted)"
      >
        Reactor Temp
      </text>
    </svg>
  );
}

function ThumbnailSparkline() {
  return (
    <svg viewBox="0 0 120 80" width={120} height={80}>
      <polyline
        points="5,60 20,45 35,50 50,35 65,40 80,25 95,30 115,20"
        fill="none"
        stroke="#4A9EFF"
        strokeWidth={2}
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ThumbnailAnalogBar() {
  return (
    <svg viewBox="0 0 120 80" width={120} height={80}>
      <rect
        x={10}
        y={30}
        width={100}
        height={20}
        rx={3}
        fill="var(--io-surface-secondary)"
        stroke="var(--io-border)"
      />
      <rect
        x={10}
        y={30}
        width={100}
        height={20}
        rx={3}
        fill="#EF4444"
        opacity={0.3}
      />
      <rect
        x={36}
        y={30}
        width={45}
        height={20}
        rx={0}
        fill="#10B981"
        opacity={0.5}
      />
      <rect
        x={10}
        y={30}
        width={17}
        height={20}
        rx={3}
        fill="#EF4444"
        opacity={0.4}
      />
      <polygon points="75,24 71,30 79,30" fill="var(--io-text-primary)" />
      <line
        x1={58}
        y1={26}
        x2={58}
        y2={54}
        stroke="#F59E0B"
        strokeWidth={1.5}
        strokeDasharray="2,2"
      />
    </svg>
  );
}

function ThumbnailFillGauge() {
  return (
    <svg viewBox="0 0 120 80" width={120} height={80}>
      <rect
        x={40}
        y={8}
        width={40}
        height={64}
        rx={4}
        fill="var(--io-surface-secondary)"
        stroke="var(--io-border)"
      />
      <rect
        x={40}
        y={35}
        width={40}
        height={37}
        rx={4}
        fill="#4A9EFF"
        opacity={0.7}
      />
      <text
        x={60}
        y={57}
        textAnchor="middle"
        fontSize={11}
        fontWeight={600}
        fill="#fff"
      >
        62%
      </text>
    </svg>
  );
}

function ThumbnailAlarmIndicator() {
  return (
    <svg viewBox="0 0 120 80" width={120} height={80}>
      <rect x={40} y={20} width={40} height={40} rx={4} fill="#EF4444" />
      <text
        x={60}
        y={47}
        textAnchor="middle"
        fontSize={24}
        fontWeight={700}
        fill="#fff"
      >
        !!
      </text>
    </svg>
  );
}

function ThumbnailScatter() {
  const points = [
    [20, 60],
    [30, 50],
    [45, 35],
    [50, 55],
    [65, 30],
    [75, 20],
    [85, 40],
    [95, 25],
    [60, 45],
    [35, 65],
  ];
  return (
    <svg viewBox="0 0 120 80" width={120} height={80}>
      <line
        x1={10}
        y1={70}
        x2={115}
        y2={70}
        stroke="var(--io-border)"
        strokeWidth={1}
      />
      <line
        x1={10}
        y1={10}
        x2={10}
        y2={70}
        stroke="var(--io-border)"
        strokeWidth={1}
      />
      {points.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={3} fill="#4A9EFF" opacity={0.7} />
      ))}
    </svg>
  );
}

function ThumbnailTimeline() {
  return (
    <svg viewBox="0 0 120 80" width={120} height={80}>
      <line
        x1={10}
        y1={70}
        x2={115}
        y2={70}
        stroke="var(--io-border)"
        strokeWidth={1}
      />
      {[0, 1, 2].map((i) => {
        const y = 15 + i * 18;
        return (
          <g key={i}>
            <rect
              x={10}
              y={y}
              width={100}
              height={12}
              rx={2}
              fill="var(--io-surface-secondary)"
            />
            <rect
              x={20}
              y={y}
              width={35}
              height={12}
              rx={2}
              fill={["#EF4444", "#F59E0B", "#10B981"][i]}
              opacity={0.7}
            />
            <rect
              x={70}
              y={y}
              width={20}
              height={12}
              rx={2}
              fill={["#EF4444", "#F59E0B", "#10B981"][i]}
              opacity={0.5}
            />
          </g>
        );
      })}
    </svg>
  );
}

function ThumbnailTable() {
  return (
    <svg viewBox="0 0 120 80" width={120} height={80}>
      <rect
        x={5}
        y={8}
        width={110}
        height={64}
        rx={3}
        fill="none"
        stroke="var(--io-border)"
      />
      {[0, 1, 2, 3].map((i) => (
        <line
          key={i}
          x1={5}
          y1={22 + i * 14}
          x2={115}
          y2={22 + i * 14}
          stroke="var(--io-border)"
          strokeWidth={0.5}
        />
      ))}
      <rect
        x={5}
        y={8}
        width={110}
        height={14}
        rx={3}
        fill="var(--io-surface-secondary)"
      />
      {[40, 75].map((x, i) => (
        <line
          key={i}
          x1={x}
          y1={8}
          x2={x}
          y2={72}
          stroke="var(--io-border)"
          strokeWidth={0.5}
        />
      ))}
    </svg>
  );
}

function ThumbnailHeatmap() {
  const colors = [
    "#3B82F6",
    "#60A5FA",
    "#93C5FD",
    "#EF4444",
    "#F97316",
    "#F59E0B",
    "#10B981",
    "#FCA5A5",
    "#86EFAC",
    "#A5B4FC",
    "#C4B5FD",
    "#FCD34D",
  ];
  return (
    <svg viewBox="0 0 120 80" width={120} height={80}>
      {colors.map((c, i) => {
        const col = i % 4,
          row = Math.floor(i / 4);
        return (
          <rect
            key={i}
            x={10 + col * 25}
            y={10 + row * 22}
            width={22}
            height={19}
            rx={2}
            fill={c}
            opacity={0.7}
          />
        );
      })}
    </svg>
  );
}

function ThumbnailPareto() {
  const heights = [55, 38, 28, 18, 12];
  const cumulative = [55, 72, 84, 92, 97];
  return (
    <svg viewBox="0 0 120 80" width={120} height={80}>
      <line
        x1={10}
        y1={70}
        x2={115}
        y2={70}
        stroke="var(--io-border)"
        strokeWidth={1}
      />
      <line
        x1={10}
        y1={10}
        x2={10}
        y2={70}
        stroke="var(--io-border)"
        strokeWidth={1}
      />
      <line
        x1={110}
        y1={10}
        x2={110}
        y2={70}
        stroke="var(--io-border)"
        strokeWidth={1}
        strokeDasharray="3,2"
      />
      {heights.map((h, i) => (
        <rect
          key={i}
          x={15 + i * 19}
          y={70 - h}
          width={14}
          height={h}
          fill="#4A9EFF"
          rx={2}
        />
      ))}
      <polyline
        points={heights
          .map((_, i) => `${22 + i * 19},${70 - cumulative[i] * 0.6}`)
          .join(" ")}
        fill="none"
        stroke="#EF4444"
        strokeWidth={1.5}
      />
      <line
        x1={10}
        y1={22}
        x2={110}
        y2={22}
        stroke="#F59E0B"
        strokeWidth={1}
        strokeDasharray="3,2"
      />
    </svg>
  );
}

function ThumbnailBoxPlot() {
  function Box({
    x,
    q1,
    q3,
    med,
    lo,
    hi,
    color,
  }: {
    x: number;
    q1: number;
    q3: number;
    med: number;
    lo: number;
    hi: number;
    color: string;
  }) {
    return (
      <g>
        <line
          x1={x + 6}
          y1={lo}
          x2={x + 6}
          y2={hi}
          stroke={color}
          strokeWidth={1.5}
        />
        <rect
          x={x}
          y={q3}
          width={12}
          height={q1 - q3}
          fill={color}
          opacity={0.6}
          stroke={color}
          strokeWidth={1}
        />
        <line
          x1={x}
          y1={med}
          x2={x + 12}
          y2={med}
          stroke={color}
          strokeWidth={2}
        />
      </g>
    );
  }
  return (
    <svg viewBox="0 0 120 80" width={120} height={80}>
      <line
        x1={10}
        y1={70}
        x2={115}
        y2={70}
        stroke="var(--io-border)"
        strokeWidth={1}
      />
      <Box x={15} q1={55} q3={25} med={40} lo={20} hi={65} color="#4A9EFF" />
      <Box x={40} q1={60} q3={30} med={48} lo={22} hi={68} color="#F59E0B" />
      <Box x={65} q1={50} q3={20} med={35} lo={15} hi={58} color="#10B981" />
      <Box x={90} q1={65} q3={40} med={52} lo={35} hi={70} color="#8B5CF6" />
    </svg>
  );
}

function ThumbnailHistogram() {
  const bins = [3, 8, 15, 22, 18, 12, 8, 4, 2];
  const max = Math.max(...bins);
  return (
    <svg viewBox="0 0 120 80" width={120} height={80}>
      <line
        x1={10}
        y1={70}
        x2={115}
        y2={70}
        stroke="var(--io-border)"
        strokeWidth={1}
      />
      {bins.map((b, i) => {
        const h = (b / max) * 55;
        return (
          <rect
            key={i}
            x={12 + i * 11}
            y={70 - h}
            width={10}
            height={h}
            fill="#4A9EFF"
            opacity={0.75}
          />
        );
      })}
    </svg>
  );
}

function ThumbnailWaterfall() {
  const steps = [
    { h: 30, y: 40, c: "#10B981" },
    { h: 15, y: 25, c: "#10B981" },
    { h: 20, y: 45, c: "#EF4444" },
    { h: 10, y: 35, c: "#10B981" },
    { h: 35, y: 35, c: "#4A9EFF" },
  ];
  return (
    <svg viewBox="0 0 120 80" width={120} height={80}>
      <line
        x1={10}
        y1={70}
        x2={115}
        y2={70}
        stroke="var(--io-border)"
        strokeWidth={1}
      />
      {steps.map((s, i) => (
        <rect
          key={i}
          x={14 + i * 20}
          y={s.y}
          width={14}
          height={s.h}
          fill={s.c}
          rx={2}
          opacity={0.8}
        />
      ))}
    </svg>
  );
}

function ThumbnailStackedArea() {
  return (
    <svg viewBox="0 0 120 80" width={120} height={80}>
      <line
        x1={10}
        y1={70}
        x2={115}
        y2={70}
        stroke="var(--io-border)"
        strokeWidth={1}
      />
      <polygon
        points="10,70 30,55 60,50 90,45 110,42 110,70"
        fill="#4A9EFF"
        opacity={0.6}
      />
      <polygon
        points="10,55 30,45 60,35 90,28 110,25 110,42 90,45 60,50 30,55"
        fill="#F59E0B"
        opacity={0.6}
      />
      <polygon
        points="10,45 30,35 60,25 90,18 110,15 110,25 90,28 60,35 30,45"
        fill="#10B981"
        opacity={0.6}
      />
    </svg>
  );
}

function ThumbnailBullet() {
  return (
    <svg viewBox="0 0 120 80" width={120} height={80}>
      <rect
        x={10}
        y={30}
        width={100}
        height={20}
        rx={3}
        fill="#EF4444"
        opacity={0.3}
      />
      <rect
        x={10}
        y={30}
        width={70}
        height={20}
        rx={0}
        fill="#F59E0B"
        opacity={0.3}
      />
      <rect
        x={10}
        y={30}
        width={45}
        height={20}
        rx={0}
        fill="#10B981"
        opacity={0.4}
      />
      <rect x={10} y={34} width={55} height={12} rx={2} fill="#4A9EFF" />
      <line
        x1={68}
        y1={26}
        x2={68}
        y2={54}
        stroke="var(--io-text-primary)"
        strokeWidth={2}
      />
    </svg>
  );
}

function ThumbnailShewhart() {
  return (
    <svg viewBox="0 0 120 80" width={120} height={80}>
      <line
        x1={10}
        y1={40}
        x2={115}
        y2={40}
        stroke="var(--io-text-muted)"
        strokeWidth={1}
        strokeDasharray="4,2"
      />
      <line
        x1={10}
        y1={20}
        x2={115}
        y2={20}
        stroke="#EF4444"
        strokeWidth={1}
        strokeDasharray="3,2"
      />
      <line
        x1={10}
        y1={60}
        x2={115}
        y2={60}
        stroke="#EF4444"
        strokeWidth={1}
        strokeDasharray="3,2"
      />
      <polyline
        points="10,42 25,38 40,44 55,36 70,35 85,43 100,30 115,38"
        fill="none"
        stroke="#4A9EFF"
        strokeWidth={1.5}
      />
      <circle cx={100} cy={30} r={4} fill="#EF4444" />
    </svg>
  );
}

function ThumbnailRegression() {
  const pts = [
    [15, 65],
    [25, 58],
    [40, 50],
    [55, 42],
    [70, 35],
    [85, 28],
    [100, 20],
  ];
  return (
    <svg viewBox="0 0 120 80" width={120} height={80}>
      <line
        x1={10}
        y1={70}
        x2={115}
        y2={70}
        stroke="var(--io-border)"
        strokeWidth={1}
      />
      <line
        x1={10}
        y1={10}
        x2={10}
        y2={70}
        stroke="var(--io-border)"
        strokeWidth={1}
      />
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={3} fill="#4A9EFF" />
      ))}
      <line
        x1={10}
        y1={72}
        x2={115}
        y2={12}
        stroke="#EF4444"
        strokeWidth={1.5}
        strokeDasharray="4,2"
      />
    </svg>
  );
}

function ThumbnailCorrelation() {
  const colors = [
    ["#3B82F6", "#FAFAFA", "#EF4444", "#F97316"],
    ["#FAFAFA", "#3B82F6", "#60A5FA", "#EF4444"],
    ["#EF4444", "#60A5FA", "#3B82F6", "#FAFAFA"],
    ["#F97316", "#EF4444", "#FAFAFA", "#3B82F6"],
  ];
  return (
    <svg viewBox="0 0 120 80" width={120} height={80}>
      {colors.map((row, ri) =>
        row.map((c, ci) => (
          <rect
            key={`${ri}-${ci}`}
            x={16 + ci * 22}
            y={8 + ri * 16}
            width={20}
            height={14}
            rx={2}
            fill={c}
            opacity={0.7}
          />
        )),
      )}
    </svg>
  );
}

function ThumbnailSankey() {
  return (
    <svg viewBox="0 0 120 80" width={120} height={80}>
      <rect x={5} y={10} width={8} height={60} rx={2} fill="#4A9EFF" />
      <path
        d="M13,15 Q50,15 55,10"
        fill="none"
        stroke="#4A9EFF"
        strokeWidth={6}
        opacity={0.4}
      />
      <path
        d="M13,45 Q50,45 55,35"
        fill="none"
        stroke="#F59E0B"
        strokeWidth={10}
        opacity={0.4}
      />
      <path
        d="M13,60 Q50,60 55,60"
        fill="none"
        stroke="#10B981"
        strokeWidth={5}
        opacity={0.4}
      />
      <rect x={55} y={5} width={8} height={20} rx={2} fill="#4A9EFF" />
      <rect x={55} y={27} width={8} height={38} rx={2} fill="#F59E0B" />
      <rect x={55} y={67} width={8} height={8} rx={2} fill="#10B981" />
      <path
        d="M63,10 Q95,10 107,20"
        fill="none"
        stroke="#4A9EFF"
        strokeWidth={6}
        opacity={0.4}
      />
      <path
        d="M63,40 Q95,40 107,55"
        fill="none"
        stroke="#F59E0B"
        strokeWidth={15}
        opacity={0.4}
      />
      <rect x={107} y={15} width={8} height={12} rx={2} fill="#4A9EFF" />
      <rect x={107} y={45} width={8} height={25} rx={2} fill="#F59E0B" />
    </svg>
  );
}

function ThumbnailTreemap() {
  return (
    <svg viewBox="0 0 120 80" width={120} height={80}>
      <rect
        x={5}
        y={5}
        width={65}
        height={50}
        rx={3}
        fill="#EF4444"
        opacity={0.6}
      />
      <rect
        x={72}
        y={5}
        width={43}
        height={25}
        rx={3}
        fill="#F59E0B"
        opacity={0.6}
      />
      <rect
        x={72}
        y={32}
        width={43}
        height={23}
        rx={3}
        fill="#10B981"
        opacity={0.6}
      />
      <rect
        x={5}
        y={57}
        width={30}
        height={18}
        rx={3}
        fill="#8B5CF6"
        opacity={0.6}
      />
      <rect
        x={37}
        y={57}
        width={78}
        height={18}
        rx={3}
        fill="#4A9EFF"
        opacity={0.6}
      />
    </svg>
  );
}

function ThumbnailCusum() {
  return (
    <svg viewBox="0 0 120 80" width={120} height={80}>
      <line
        x1={10}
        y1={50}
        x2={115}
        y2={50}
        stroke="var(--io-text-muted)"
        strokeWidth={1}
        strokeDasharray="4,2"
      />
      <line
        x1={10}
        y1={20}
        x2={115}
        y2={20}
        stroke="#EF4444"
        strokeWidth={1}
        strokeDasharray="3,2"
      />
      <line
        x1={10}
        y1={70}
        x2={115}
        y2={70}
        stroke="#EF4444"
        strokeWidth={1}
        strokeDasharray="3,2"
      />
      <polyline
        points="10,50 25,48 40,44 55,38 70,30 85,20 100,15 115,12"
        fill="none"
        stroke="#4A9EFF"
        strokeWidth={1.5}
      />
      <polyline
        points="10,50 25,51 40,52 55,53 70,54 85,55 100,55"
        fill="none"
        stroke="#F59E0B"
        strokeWidth={1.5}
      />
    </svg>
  );
}

function ThumbnailEwma() {
  return (
    <svg viewBox="0 0 120 80" width={120} height={80}>
      <line
        x1={10}
        y1={20}
        x2={115}
        y2={20}
        stroke="#EF4444"
        strokeWidth={1}
        strokeDasharray="3,2"
      />
      <line
        x1={10}
        y1={60}
        x2={115}
        y2={60}
        stroke="#EF4444"
        strokeWidth={1}
        strokeDasharray="3,2"
      />
      <polyline
        points="10,55 25,38 40,52 55,35 70,48 85,30 100,42 115,28"
        fill="none"
        stroke="var(--io-text-muted)"
        strokeWidth={1}
        opacity={0.5}
      />
      <polyline
        points="10,50 25,44 40,46 55,40 70,43 85,36 100,39 115,33"
        fill="none"
        stroke="#4A9EFF"
        strokeWidth={2}
      />
    </svg>
  );
}

function ThumbnailQQ() {
  const pts = [
    [15, 65],
    [25, 55],
    [40, 42],
    [55, 33],
    [70, 26],
    [85, 20],
    [100, 15],
  ];
  return (
    <svg viewBox="0 0 120 80" width={120} height={80}>
      <line
        x1={10}
        y1={70}
        x2={115}
        y2={10}
        stroke="var(--io-text-muted)"
        strokeWidth={1}
        strokeDasharray="4,2"
      />
      {pts.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y + (i % 3) * 3 - 3} r={3} fill="#4A9EFF" />
      ))}
    </svg>
  );
}

function ThumbnailFunnel() {
  return (
    <svg viewBox="0 0 120 80" width={120} height={80}>
      {[0, 1, 2, 3].map((i) => {
        const w = 90 - i * 18;
        const x = 15 + i * 9;
        const y = 10 + i * 17;
        const colors = ["#4A9EFF", "#F59E0B", "#10B981", "#8B5CF6"];
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={w}
            height={13}
            rx={3}
            fill={colors[i]}
            opacity={0.75}
          />
        );
      })}
    </svg>
  );
}

function ThumbnailRadar() {
  const n = 6,
    cx = 60,
    cy = 40,
    r = 28;
  const outer = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * 2 * Math.PI - Math.PI / 2;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  });
  const inner = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * 2 * Math.PI - Math.PI / 2;
    const rs = [0.8, 0.6, 0.9, 0.5, 0.7, 0.85][i] * r;
    return [cx + rs * Math.cos(a), cy + rs * Math.sin(a)];
  });
  return (
    <svg viewBox="0 0 120 80" width={120} height={80}>
      {outer.map(([x, y], i) => (
        <line
          key={i}
          x1={cx}
          y1={cy}
          x2={x}
          y2={y}
          stroke="var(--io-border)"
          strokeWidth={1}
        />
      ))}
      <polygon
        points={outer.map(([x, y]) => `${x},${y}`).join(" ")}
        fill="none"
        stroke="var(--io-border)"
        strokeWidth={1}
      />
      <polygon
        points={inner.map(([x, y]) => `${x},${y}`).join(" ")}
        fill="#4A9EFF"
        fillOpacity={0.3}
        stroke="#4A9EFF"
        strokeWidth={1.5}
      />
    </svg>
  );
}

function ThumbnailSurface3D() {
  // Heights (px upward) at each vertex of a 4-row × 5-col quad grid (5×6 vertex grid).
  // Two peaks (back-centre and front-right ridge) with a valley between them.
  const H = [
    [0, 2, 4, 3, 1, 0], // ri=0  front
    [1, 8, 18, 13, 5, 1],
    [2, 12, 26, 19, 9, 2],
    [1, 6, 14, 22, 13, 4],
    [0, 3, 7, 11, 5, 1], // ri=4  back
  ];
  const vx = (ri: number, ci: number) => 8 + ci * 16 + ri * 5;
  const vy = (ri: number, h: number) => 70 - ri * 9 - h;

  // Build quads back-to-front so peaks occlude the tiles behind them.
  const quads: { pts: string; r: number; g: number; b: number; key: string }[] =
    [];
  for (let ri = 3; ri >= 0; ri--) {
    for (let ci = 0; ci < 5; ci++) {
      const h00 = H[ri][ci],
        h01 = H[ri][ci + 1];
      const h10 = H[ri + 1][ci],
        h11 = H[ri + 1][ci + 1];
      const avgH = (h00 + h01 + h10 + h11) / 4;
      const pts = [
        `${vx(ri, ci)},${vy(ri, h00)}`,
        `${vx(ri, ci + 1)},${vy(ri, h01)}`,
        `${vx(ri + 1, ci + 1)},${vy(ri + 1, h11)}`,
        `${vx(ri + 1, ci)},${vy(ri + 1, h10)}`,
      ].join(" ");
      // Blue (low) → teal → yellow → red (high)
      const t = avgH / 24;
      const r = Math.round(Math.min(1, t * 2) * 220);
      const g = Math.round(Math.sin(t * Math.PI) * 120);
      const b = Math.round((1 - Math.min(1, t * 1.5)) * 200);
      quads.push({ pts, r, g, b, key: `${ri}-${ci}` });
    }
  }
  return (
    <svg viewBox="0 0 120 80" width={120} height={80}>
      {quads.map(({ pts, r, g, b, key }) => (
        <polygon
          key={key}
          points={pts}
          fill={`rgb(${r},${g},${b})`}
          opacity={0.88}
          stroke="var(--io-surface)"
          strokeWidth={0.5}
        />
      ))}
    </svg>
  );
}

function ThumbnailBatchComparison() {
  return (
    <svg viewBox="0 0 120 80" width={120} height={80}>
      <line
        x1={10}
        y1={70}
        x2={115}
        y2={70}
        stroke="var(--io-border)"
        strokeWidth={1}
      />
      <text x={12} y={76} fontSize={7} fill="var(--io-text-muted)">
        t=0
      </text>
      <text x={100} y={76} fontSize={7} fill="var(--io-text-muted)">
        t=end
      </text>
      <polyline
        points="10,45 35,35 60,30 85,40 110,25"
        fill="none"
        stroke="#4A9EFF"
        strokeWidth={2}
      />
      <polyline
        points="10,50 35,45 60,35 85,30 110,45"
        fill="none"
        stroke="#F59E0B"
        strokeWidth={1.5}
        strokeDasharray="4,2"
      />
      <polyline
        points="10,55 35,40 60,55 85,45 110,30"
        fill="none"
        stroke="#10B981"
        strokeWidth={1.5}
        strokeDasharray="2,3"
      />
    </svg>
  );
}

function ThumbnailStateTimeline() {
  // Horizontal colored bands per row showing discrete machine states over time
  const rows = [
    {
      y: 14,
      segments: [
        { x: 10, w: 35, c: "#10B981" },
        { x: 47, w: 15, c: "#F59E0B" },
        { x: 64, w: 48, c: "#10B981" },
      ],
    },
    {
      y: 30,
      segments: [
        { x: 10, w: 55, c: "#4A9EFF" },
        { x: 67, w: 20, c: "#EF4444" },
        { x: 89, w: 23, c: "#4A9EFF" },
      ],
    },
    {
      y: 46,
      segments: [
        { x: 10, w: 20, c: "#F59E0B" },
        { x: 32, w: 40, c: "#10B981" },
        { x: 74, w: 38, c: "#6B7280" },
      ],
    },
    {
      y: 62,
      segments: [
        { x: 10, w: 70, c: "#10B981" },
        { x: 82, w: 30, c: "#EF4444" },
      ],
    },
  ];
  return (
    <svg viewBox="0 0 120 80" width={120} height={80}>
      {/* Row labels */}
      <text x={2} y={23} fontSize={6} fill="var(--io-text-muted)">
        M1
      </text>
      <text x={2} y={39} fontSize={6} fill="var(--io-text-muted)">
        M2
      </text>
      <text x={2} y={55} fontSize={6} fill="var(--io-text-muted)">
        M3
      </text>
      <text x={2} y={71} fontSize={6} fill="var(--io-text-muted)">
        M4
      </text>
      {rows.map((row, ri) =>
        row.segments.map((seg, si) => (
          <rect
            key={`${ri}-${si}`}
            x={seg.x}
            y={row.y}
            width={seg.w}
            height={11}
            rx={1.5}
            fill={seg.c}
            opacity={0.85}
          />
        )),
      )}
      {/* Time axis */}
      <line
        x1={10}
        y1={75}
        x2={112}
        y2={75}
        stroke="var(--io-border)"
        strokeWidth={1}
      />
      <text x={10} y={79} fontSize={6} fill="var(--io-text-muted)">
        0h
      </text>
      <text x={100} y={79} fontSize={6} fill="var(--io-text-muted)">
        8h
      </text>
    </svg>
  );
}

function ThumbnailScorecardTable() {
  // Table with colored status indicators and values
  const rows = [
    { label: "Uptime", val: "98.2%", dot: "#10B981" },
    { label: "OEE", val: "81.4%", dot: "#F59E0B" },
    { label: "Defects", val: "0.12%", dot: "#10B981" },
    { label: "MTBF", val: "412h", dot: "#EF4444" },
    { label: "Output", val: "1,204", dot: "#10B981" },
  ];
  return (
    <svg viewBox="0 0 120 80" width={120} height={80}>
      {/* Header */}
      <rect
        x={5}
        y={4}
        width={110}
        height={10}
        rx={1}
        fill="var(--io-surface-elevated)"
      />
      <text
        x={10}
        y={11}
        fontSize={6}
        fontWeight={600}
        fill="var(--io-text-muted)"
      >
        Metric
      </text>
      <text
        x={82}
        y={11}
        fontSize={6}
        fontWeight={600}
        fill="var(--io-text-muted)"
      >
        Value
      </text>
      <text
        x={106}
        y={11}
        fontSize={6}
        fontWeight={600}
        fill="var(--io-text-muted)"
      >
        St
      </text>
      {rows.map((row, i) => {
        const y = 17 + i * 12;
        return (
          <g key={i}>
            <rect
              x={5}
              y={y}
              width={110}
              height={11}
              rx={1}
              fill={i % 2 === 0 ? "var(--io-surface)" : "transparent"}
            />
            <text x={10} y={y + 8} fontSize={6} fill="var(--io-text)">
              {row.label}
            </text>
            <text x={82} y={y + 8} fontSize={6} fill="var(--io-text)">
              {row.val}
            </text>
            <circle cx={112} cy={y + 5.5} r={3.5} fill={row.dot} />
          </g>
        );
      })}
    </svg>
  );
}

function ThumbnailParallelCoordinate() {
  // 5 vertical axes with colored polylines crossing between them
  const axes = [18, 38, 58, 78, 98, 112];
  const lines = [
    { pts: "18,20 38,45 58,30 78,55 98,25 112,40", c: "#4A9EFF" },
    { pts: "18,35 38,25 58,50 78,30 98,45 112,20", c: "#F59E0B" },
    { pts: "18,55 38,60 58,20 78,40 98,60 112,35", c: "#10B981" },
    { pts: "18,45 38,35 58,60 78,20 98,35 112,55", c: "#A78BFA" },
  ];
  return (
    <svg viewBox="0 0 120 80" width={120} height={80}>
      {/* Axes */}
      {axes.map((x) => (
        <line
          key={x}
          x1={x}
          y1={12}
          x2={x}
          y2={68}
          stroke="var(--io-border)"
          strokeWidth={1}
        />
      ))}
      {/* Axis labels */}
      {["A", "B", "C", "D", "E", "F"].map((l, i) => (
        <text
          key={l}
          x={axes[i] - 3}
          y={76}
          fontSize={7}
          fill="var(--io-text-muted)"
        >
          {l}
        </text>
      ))}
      {/* Lines */}
      {lines.map((ln, i) => (
        <polyline
          key={i}
          points={ln.pts}
          fill="none"
          stroke={ln.c}
          strokeWidth={1.5}
          opacity={0.75}
        />
      ))}
    </svg>
  );
}

function ThumbnailXbarR() {
  // Two stacked control charts (X-bar on top, R on bottom) with UCL/LCL lines
  return (
    <svg viewBox="0 0 120 80" width={120} height={80}>
      {/* Divider */}
      <line
        x1={8}
        y1={40}
        x2={116}
        y2={40}
        stroke="var(--io-border)"
        strokeWidth={1}
        strokeDasharray="3,2"
      />
      {/* X-bar chart (top half) */}
      <text
        x={8}
        y={10}
        fontSize={6}
        fontWeight={600}
        fill="var(--io-text-muted)"
      >
        X̄
      </text>
      <line
        x1={8}
        y1={16}
        x2={116}
        y2={16}
        stroke="#EF4444"
        strokeWidth={0.8}
        strokeDasharray="3,2"
      />
      <line
        x1={8}
        y1={28}
        x2={116}
        y2={28}
        stroke="#6B7280"
        strokeWidth={0.8}
        strokeDasharray="2,3"
      />
      <line
        x1={8}
        y1={36}
        x2={116}
        y2={36}
        stroke="#EF4444"
        strokeWidth={0.8}
        strokeDasharray="3,2"
      />
      <polyline
        points="8,28 24,24 40,30 56,22 72,27 88,25 104,29 116,23"
        fill="none"
        stroke="#4A9EFF"
        strokeWidth={1.5}
      />
      {/* R chart (bottom half) */}
      <text
        x={8}
        y={50}
        fontSize={6}
        fontWeight={600}
        fill="var(--io-text-muted)"
      >
        R
      </text>
      <line
        x1={8}
        y1={55}
        x2={116}
        y2={55}
        stroke="#EF4444"
        strokeWidth={0.8}
        strokeDasharray="3,2"
      />
      <line
        x1={8}
        y1={68}
        x2={116}
        y2={68}
        stroke="#6B7280"
        strokeWidth={0.8}
        strokeDasharray="2,3"
      />
      <polyline
        points="8,62 24,58 40,65 56,55 72,63 88,60 104,64 116,57"
        fill="none"
        stroke="#F59E0B"
        strokeWidth={1.5}
      />
    </svg>
  );
}

function ThumbnailAttributeControl() {
  // p-chart / c-chart style: count/proportion data with UCL and stepped bars
  const pts = [12, 30, 18, 25, 35, 22, 28, 15, 40, 20];
  const barH = (v: number) => 65 - v * 0.7;
  const bw = 9;
  return (
    <svg viewBox="0 0 120 80" width={120} height={80}>
      {/* UCL */}
      <line
        x1={8}
        y1={18}
        x2={116}
        y2={18}
        stroke="#EF4444"
        strokeWidth={0.8}
        strokeDasharray="4,2"
      />
      <text x={109} y={16} fontSize={5} fill="#EF4444">
        UCL
      </text>
      {/* CL */}
      <line
        x1={8}
        y1={40}
        x2={116}
        y2={40}
        stroke="#6B7280"
        strokeWidth={0.8}
        strokeDasharray="2,3"
      />
      {/* Bars */}
      {pts.map((v, i) => (
        <rect
          key={i}
          x={8 + i * 11}
          y={barH(v)}
          width={bw}
          height={65 - barH(v)}
          rx={1}
          fill="#4A9EFF"
          opacity={0.7}
        />
      ))}
      {/* Line overlay */}
      <polyline
        points={pts
          .map((v, i) => `${8 + i * 11 + bw / 2},${barH(v)}`)
          .join(" ")}
        fill="none"
        stroke="#4A9EFF"
        strokeWidth={1.2}
      />
      {/* Axis */}
      <line
        x1={8}
        y1={65}
        x2={116}
        y2={65}
        stroke="var(--io-border)"
        strokeWidth={1}
      />
      <text x={8} y={73} fontSize={5} fill="var(--io-text-muted)">
        p-chart
      </text>
    </svg>
  );
}

// ── Thumbnail registry ───────────────────────────────────────────────────────

const THUMBNAILS: Record<number, () => JSX.Element> = {
  1: () => <ThumbnailLineTrend />,
  2: () => <ThumbnailLineTrend />,
  3: () => <ThumbnailMultiAxis />,
  4: () => <ThumbnailLineTrend step />,
  5: () => <ThumbnailBar />,
  6: () => <ThumbnailPie />,
  7: () => <ThumbnailKpiCard />,
  8: () => <ThumbnailGauge />,
  9: () => <ThumbnailSparkline />,
  10: () => <ThumbnailAnalogBar />,
  11: () => <ThumbnailFillGauge />,
  12: () => <ThumbnailAlarmIndicator />,
  13: () => <ThumbnailScatter />,
  14: () => <ThumbnailTimeline />,
  15: () => <ThumbnailTable />,
  16: () => <ThumbnailBatchComparison />,
  17: () => <ThumbnailHeatmap />,
  18: () => <ThumbnailPareto />,
  19: () => <ThumbnailBoxPlot />,
  20: () => <ThumbnailHistogram />,
  21: () => <ThumbnailWaterfall />,
  22: () => <ThumbnailStackedArea />,
  23: () => <ThumbnailBullet />,
  24: () => <ThumbnailShewhart />,
  25: () => <ThumbnailRegression />,
  26: () => <ThumbnailCorrelation />,
  27: () => <ThumbnailSankey />,
  28: () => <ThumbnailTreemap />,
  29: () => <ThumbnailCusum />,
  30: () => <ThumbnailEwma />,
  31: () => <ThumbnailQQ />,
  32: () => <ThumbnailFunnel />,
  33: () => <ThumbnailRadar />,
  34: () => <ThumbnailSurface3D />,
  35: () => <ThumbnailStateTimeline />,
  36: () => <ThumbnailScorecardTable />,
  37: () => <ThumbnailParallelCoordinate />,
  38: () => <ThumbnailXbarR />,
  39: () => <ThumbnailAttributeControl />,
};

// ── Micro-icons for the list ─────────────────────────────────────────────────
// 24×16 viewBox, uses currentColor so tier color flows through.

export function MicroIcon({ id }: { id: number }) {
  const s = {
    stroke: "currentColor",
    fill: "none",
    strokeWidth: 1.5,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  const f = { fill: "currentColor", stroke: "none" };
  const props = { viewBox: "0 0 24 16", width: 24, height: 16 };

  switch (id) {
    case 1: // Trend — wave line with live dot
      return (
        <svg {...props}>
          <polyline
            points="1,12 5,7 9,10 13,4 17,8 21,3"
            {...s}
            strokeWidth={1.5}
          />
          <circle cx={21} cy={3} r={1} {...f} />
        </svg>
      );
    case 2: // Historical Trend — wave with end marker
      return (
        <svg {...props}>
          <polyline
            points="1,12 5,7 9,10 13,4 17,8 21,8"
            {...s}
            strokeWidth={1.5}
          />
          <line
            x1={21}
            y1={4}
            x2={21}
            y2={12}
            {...s}
            strokeWidth={1}
            strokeDasharray="2,1"
          />
        </svg>
      );
    case 3: // Multi-Axis Trend — two lines, colored axes
      return (
        <svg {...props}>
          <line x1={2} y1={2} x2={2} y2={14} {...s} strokeWidth={1} />
          <line
            x1={22}
            y1={2}
            x2={22}
            y2={14}
            {...s}
            strokeWidth={1}
            opacity={0.5}
          />
          <polyline points="2,10 8,6 14,9 22,4" {...s} strokeWidth={1.5} />
          <polyline
            points="2,13 8,11 14,12 22,8"
            {...s}
            strokeWidth={1}
            opacity={0.6}
          />
        </svg>
      );
    case 4: // Step Chart — staircase
      return (
        <svg {...props}>
          <polyline
            points="1,13 1,9 6,9 6,5 11,5 11,10 16,10 16,6 21,6 21,3"
            {...s}
            strokeWidth={1.5}
          />
        </svg>
      );
    case 5: // Bar / Column — vertical bars
      return (
        <svg {...props}>
          <line x1={1} y1={14} x2={23} y2={14} {...s} strokeWidth={1} />
          {[
            [2, 8],
            [6, 5],
            [10, 10],
            [14, 4],
            [18, 7],
          ].map(([x, h], i) => (
            <rect
              key={i}
              x={x}
              y={14 - h}
              width={3}
              height={h}
              fill="currentColor"
              opacity={[1, 0.8, 0.9, 0.7, 0.85][i]}
              rx={0.5}
            />
          ))}
        </svg>
      );
    case 6: // Pie — circle with slice
      return (
        <svg {...props}>
          <circle cx={12} cy={8} r={6} {...s} strokeWidth={1} />
          <path
            d="M12,8 L12,2 A6,6 0 0,1 17.2,11 Z"
            fill="currentColor"
            opacity={0.9}
          />
          <path
            d="M12,8 L17.2,11 A6,6 0 0,1 7.4,13 Z"
            fill="currentColor"
            opacity={0.5}
          />
        </svg>
      );
    case 7: // KPI Card — large number / value readout
      return (
        <svg {...props}>
          <rect
            x={2}
            y={2}
            width={20}
            height={12}
            rx={2}
            {...s}
            strokeWidth={1}
          />
          <text
            x={12}
            y={11}
            textAnchor="middle"
            fontSize={7}
            fill="currentColor"
            stroke="none"
            fontWeight="bold"
          >
            42
          </text>
        </svg>
      );
    case 8: // Gauge — semicircle with needle
      return (
        <svg {...props}>
          <path d="M3,13 A9,9 0 0,1 21,13" {...s} strokeWidth={1.5} />
          <path
            d="M3,13 A9,9 0 0,1 14,5"
            stroke="currentColor"
            fill="none"
            strokeWidth={2.5}
          />
          <line x1={12} y1={13} x2={16} y2={6} {...s} strokeWidth={1.5} />
          <circle cx={12} cy={13} r={1.5} fill="currentColor" stroke="none" />
        </svg>
      );
    case 9: // Sparkline — tiny compact wave
      return (
        <svg {...props}>
          <polyline
            points="1,13 4,9 7,11 10,6 13,9 16,7 19,10 22,5"
            {...s}
            strokeWidth={1.5}
          />
        </svg>
      );
    case 10: // Analog Bar — horizontal bar with fill
      return (
        <svg {...props}>
          <rect
            x={2}
            y={5}
            width={20}
            height={6}
            rx={1}
            {...s}
            strokeWidth={1}
          />
          <rect
            x={2}
            y={5}
            width={13}
            height={6}
            rx={1}
            fill="currentColor"
            opacity={0.8}
            stroke="none"
          />
          <line x1={2} y1={11} x2={2} y2={13} {...s} strokeWidth={1} />
          <line x1={22} y1={11} x2={22} y2={13} {...s} strokeWidth={1} />
        </svg>
      );
    case 11: // Fill Gauge — circle partially filled
      return (
        <svg {...props}>
          <circle cx={12} cy={8} r={6} {...s} strokeWidth={1} />
          <path
            d="M6,10 A6,6 0 0,1 18,10 Z"
            fill="currentColor"
            opacity={0.9}
            stroke="none"
          />
          <path
            d="M8,12.5 A6,6 0 0,1 16,12.5"
            fill="currentColor"
            opacity={0.5}
            stroke="none"
          />
        </svg>
      );
    case 12: // Alarm Indicator — bell shape
      return (
        <svg {...props}>
          <path
            d="M12,2 C9,2 7,4 7,7 L7,11 L5,13 L19,13 L17,11 L17,7 C17,4 15,2 12,2 Z"
            {...s}
            strokeWidth={1}
          />
          <line x1={10} y1={13} x2={14} y2={13} {...s} strokeWidth={1} />
          <circle cx={12} cy={15} r={1} fill="currentColor" stroke="none" />
        </svg>
      );
    case 13: // XY Scatter — dots scattered
      return (
        <svg {...props}>
          {[
            [3, 12],
            [6, 8],
            [9, 11],
            [11, 5],
            [14, 9],
            [17, 6],
            [20, 10],
            [8, 4],
            [15, 13],
          ].map(([x, y], i) => (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={1.2}
              fill="currentColor"
              opacity={0.8}
              stroke="none"
            />
          ))}
        </svg>
      );
    case 14: // Event Timeline — horizontal line with event markers
      return (
        <svg {...props}>
          <line x1={1} y1={8} x2={23} y2={8} {...s} strokeWidth={1} />
          {[4, 9, 15, 20].map((x, i) => (
            <rect
              key={i}
              x={x - 1.5}
              y={5}
              width={3}
              height={6}
              rx={1}
              fill={
                [
                  "currentColor",
                  "currentColor",
                  "currentColor",
                  "currentColor",
                ][i]
              }
              opacity={[0.9, 0.6, 0.8, 0.5][i]}
              stroke="none"
            />
          ))}
        </svg>
      );
    case 15: // Data Table — grid
      return (
        <svg {...props}>
          <rect
            x={1}
            y={2}
            width={22}
            height={12}
            rx={1}
            {...s}
            strokeWidth={1}
          />
          <line x1={1} y1={6} x2={23} y2={6} {...s} strokeWidth={0.75} />
          {[1, 2, 3].map((i) => (
            <line
              key={i}
              x1={1}
              y1={6 + i * 2.5}
              x2={23}
              y2={6 + i * 2.5}
              {...s}
              strokeWidth={0.5}
              opacity={0.5}
            />
          ))}
          <line x1={8} y1={2} x2={8} y2={14} {...s} strokeWidth={0.75} />
          <line x1={15} y1={2} x2={15} y2={14} {...s} strokeWidth={0.75} />
        </svg>
      );
    case 16: // Batch Comparison — overlapping lines from origin
      return (
        <svg {...props}>
          <polyline points="2,13 8,8 14,10 22,5" {...s} strokeWidth={1.5} />
          <polyline
            points="2,13 7,10 12,7 22,9"
            {...s}
            strokeWidth={1.5}
            opacity={0.6}
          />
          <polyline
            points="2,13 9,11 15,12 22,7"
            {...s}
            strokeWidth={1.5}
            opacity={0.4}
          />
        </svg>
      );
    case 17: // Heatmap — colored cell grid
      return (
        <svg {...props}>
          {[0, 1, 2, 3].flatMap((col) =>
            [0, 1, 2].map((row) => {
              const ops = [
                0.9, 0.4, 0.7, 0.3, 0.8, 0.5, 0.6, 0.2, 0.95, 0.35, 0.75, 0.55,
              ][col * 3 + row];
              return (
                <rect
                  key={`${col}-${row}`}
                  x={2 + col * 5}
                  y={2 + row * 4}
                  width={4}
                  height={3}
                  rx={0.5}
                  fill="currentColor"
                  opacity={ops}
                  stroke="none"
                />
              );
            }),
          )}
        </svg>
      );
    case 18: // Pareto — bars with cumulative line
      return (
        <svg {...props}>
          <line x1={1} y1={14} x2={23} y2={14} {...s} strokeWidth={1} />
          {[
            [2, 9],
            [6, 6],
            [10, 4],
            [14, 3],
            [18, 2],
          ].map(([x, h], i) => (
            <rect
              key={i}
              x={x}
              y={14 - h}
              width={3}
              height={h}
              fill="currentColor"
              opacity={0.7}
              rx={0.5}
            />
          ))}
          <polyline
            points="3.5,5 7.5,8 11.5,10 15.5,11 19.5,12"
            stroke="currentColor"
            fill="none"
            strokeWidth={1.2}
            opacity={0.9}
            strokeDasharray="2,1"
          />
        </svg>
      );
    case 19: // Box Plot — box with whiskers
      return (
        <svg {...props}>
          <line x1={7} y1={4} x2={7} y2={12} {...s} strokeWidth={1} />
          <line x1={17} y1={4} x2={17} y2={12} {...s} strokeWidth={1} />
          <rect x={7} y={5} width={10} height={6} {...s} strokeWidth={1.5} />
          <line x1={7} y1={8} x2={17} y2={8} {...s} strokeWidth={1.5} />
          <line x1={4} y1={4} x2={10} y2={4} {...s} strokeWidth={1} />
          <line x1={14} y1={12} x2={20} y2={12} {...s} strokeWidth={1} />
        </svg>
      );
    case 20: // Histogram — bell distribution bars
      return (
        <svg {...props}>
          <line x1={1} y1={14} x2={23} y2={14} {...s} strokeWidth={1} />
          {[
            [1, 3],
            [4, 6],
            [7, 10],
            [10, 13],
            [13, 11],
            [16, 7],
            [19, 4],
            [22, 2],
          ].map(([x, h], i) => (
            <rect
              key={i}
              x={x}
              y={14 - h}
              width={2.5}
              height={h}
              fill="currentColor"
              opacity={0.7}
              rx={0.3}
            />
          ))}
        </svg>
      );
    case 21: // Waterfall — floating bars
      return (
        <svg {...props}>
          <line x1={1} y1={14} x2={23} y2={14} {...s} strokeWidth={1} />
          {[
            [2, 9, 4, true],
            [6, 5, 3, false],
            [10, 8, 3, true],
            [14, 6, 2, false],
            [18, 9, 4, true],
          ].map(([x, y, h, pos], i) => (
            <rect
              key={i}
              x={x as number}
              y={y as number}
              width={3}
              height={h as number}
              fill="currentColor"
              opacity={pos ? 0.8 : 0.4}
              rx={0.5}
              stroke="none"
            />
          ))}
        </svg>
      );
    case 22: // Stacked Area — filled overlapping areas
      return (
        <svg {...props}>
          <polygon
            points="1,14 5,10 9,11 13,7 17,9 22,6 22,14"
            fill="currentColor"
            opacity={0.6}
            stroke="none"
          />
          <polygon
            points="1,14 5,12 9,13 13,10 17,11 22,9 22,14"
            fill="currentColor"
            opacity={0.3}
            stroke="none"
          />
          <polyline
            points="1,10 5,8 9,9 13,5 17,7 22,4"
            {...s}
            strokeWidth={1.5}
            opacity={0.9}
          />
        </svg>
      );
    case 23: // Bullet — nested horizontal bars
      return (
        <svg {...props}>
          <rect
            x={2}
            y={4}
            width={20}
            height={8}
            rx={1}
            fill="currentColor"
            opacity={0.15}
            stroke="none"
          />
          <rect
            x={2}
            y={5}
            width={14}
            height={6}
            rx={1}
            fill="currentColor"
            opacity={0.4}
            stroke="none"
          />
          <rect
            x={2}
            y={6}
            width={9}
            height={4}
            rx={1}
            fill="currentColor"
            opacity={0.9}
            stroke="none"
          />
          <line
            x1={13}
            y1={3}
            x2={13}
            y2={13}
            {...s}
            strokeWidth={1.5}
            opacity={0.7}
          />
        </svg>
      );
    case 24: // Shewhart SPC — control chart with UCL/LCL
      return (
        <svg {...props}>
          <line
            x1={1}
            y1={5}
            x2={23}
            y2={5}
            {...s}
            strokeWidth={0.75}
            strokeDasharray="3,1"
            opacity={0.6}
          />
          <line
            x1={1}
            y1={8}
            x2={23}
            y2={8}
            {...s}
            strokeWidth={0.75}
            opacity={0.4}
          />
          <line
            x1={1}
            y1={11}
            x2={23}
            y2={11}
            {...s}
            strokeWidth={0.75}
            strokeDasharray="3,1"
            opacity={0.6}
          />
          <polyline
            points="2,8 5,7 8,9 11,6 14,8 17,7 20,5 23,6"
            {...s}
            strokeWidth={1.5}
          />
        </svg>
      );
    case 25: // Regression — scatter with trend line
      return (
        <svg {...props}>
          {[
            [3, 12],
            [6, 10],
            [8, 8],
            [11, 8],
            [14, 6],
            [17, 5],
            [20, 4],
          ].map(([x, y], i) => (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={1.2}
              fill="currentColor"
              opacity={0.7}
              stroke="none"
            />
          ))}
          <line
            x1={2}
            y1={13}
            x2={22}
            y2={3}
            {...s}
            strokeWidth={1.5}
            opacity={0.8}
          />
        </svg>
      );
    case 26: // Correlation Matrix — grid with varying shades
      return (
        <svg {...props}>
          {[0, 1, 2, 3].flatMap((c) =>
            [0, 1, 2, 3].map((r) => {
              const ops = c === r ? 0.9 : Math.abs(c - r) === 1 ? 0.5 : 0.2;
              return (
                <rect
                  key={`${c}-${r}`}
                  x={2 + c * 5}
                  y={2 + r * 3.5}
                  width={4.5}
                  height={3}
                  rx={0.5}
                  fill="currentColor"
                  opacity={ops}
                  stroke="none"
                />
              );
            }),
          )}
        </svg>
      );
    case 27: // Sankey / Flow — converging bands
      return (
        <svg {...props}>
          <path
            d="M1,3 C8,3 8,7 13,7 C18,7 18,11 23,11"
            {...s}
            strokeWidth={2}
          />
          <path
            d="M1,7 C8,7 8,8 13,8 C18,8 18,11.5 23,11.5"
            {...s}
            strokeWidth={1.5}
            opacity={0.6}
          />
          <path
            d="M1,11 C8,11 8,9 13,9 C18,9 18,12 23,12"
            {...s}
            strokeWidth={1}
            opacity={0.4}
          />
        </svg>
      );
    case 28: // Treemap — nested rectangles
      return (
        <svg {...props}>
          <rect
            x={1}
            y={1}
            width={22}
            height={14}
            rx={1}
            {...s}
            strokeWidth={1}
          />
          <rect
            x={1}
            y={1}
            width={13}
            height={14}
            rx={1}
            fill="currentColor"
            opacity={0.2}
            stroke="none"
          />
          <rect
            x={14}
            y={1}
            width={9}
            height={8}
            rx={1}
            fill="currentColor"
            opacity={0.35}
            stroke="none"
          />
          <rect
            x={14}
            y={9}
            width={9}
            height={6}
            rx={1}
            fill="currentColor"
            opacity={0.55}
            stroke="none"
          />
          <line x1={14} y1={1} x2={14} y2={15} {...s} strokeWidth={0.75} />
          <line x1={14} y1={9} x2={23} y2={9} {...s} strokeWidth={0.75} />
        </svg>
      );
    case 29: // CUSUM — cumulative sum line
      return (
        <svg {...props}>
          <line
            x1={1}
            y1={8}
            x2={23}
            y2={8}
            {...s}
            strokeWidth={0.75}
            strokeDasharray="3,1"
            opacity={0.5}
          />
          <polyline
            points="2,8 5,9 8,11 11,10 14,7 17,5 20,4 23,3"
            {...s}
            strokeWidth={1.5}
          />
        </svg>
      );
    case 30: // EWMA — smooth exponential line
      return (
        <svg {...props}>
          <polyline
            points="1,12 4,11 7,9 10,7 13,6 16,5 19,5 22,4"
            {...s}
            strokeWidth={1.5}
          />
          <polyline
            points="1,12 3,10 5,11 8,8 11,9 14,7 17,6 22,5"
            {...s}
            strokeWidth={1}
            opacity={0.4}
            strokeDasharray="2,1"
          />
        </svg>
      );
    case 31: // Probability Plot — diagonal with dots
      return (
        <svg {...props}>
          <line
            x1={2}
            y1={14}
            x2={22}
            y2={2}
            {...s}
            strokeWidth={1}
            opacity={0.5}
            strokeDasharray="2,1"
          />
          {[
            [4, 12],
            [7, 10],
            [10, 8],
            [13, 7],
            [16, 5],
            [19, 4],
          ].map(([x, y], i) => (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={1.3}
              fill="currentColor"
              opacity={0.8}
              stroke="none"
            />
          ))}
        </svg>
      );
    case 32: // Funnel — trapezoid shape
      return (
        <svg {...props}>
          <polygon
            points="3,2 21,2 17,6 15,10 13,14 11,14 9,10 7,6"
            fill="currentColor"
            opacity={0.5}
            stroke="currentColor"
            strokeWidth={1}
          />
          <polygon
            points="7,6 17,6 15,10 9,10"
            fill="currentColor"
            opacity={0.3}
            stroke="none"
          />
          <polygon
            points="9,10 15,10 13,14 11,14"
            fill="currentColor"
            opacity={0.7}
            stroke="none"
          />
        </svg>
      );
    case 33: // Radar / Spider — polygon
      return (
        <svg {...props}>
          <polygon
            points="12,2 20,7 17,14 7,14 4,7"
            fill="currentColor"
            opacity={0.25}
            stroke="currentColor"
            strokeWidth={1}
          />
          <polygon
            points="12,4 17,8 15,13 9,13 7,8"
            fill="none"
            stroke="currentColor"
            strokeWidth={0.75}
            opacity={0.4}
          />
          <circle
            cx={12}
            cy={8}
            r={1}
            fill="currentColor"
            stroke="none"
            opacity={0.5}
          />
        </svg>
      );
    case 34: // Surface 3D — perspective grid
      return (
        <svg {...props}>
          <polygon
            points="12,1 23,6 23,13 12,14 1,9 1,3"
            fill="currentColor"
            opacity={0.1}
            stroke="currentColor"
            strokeWidth={0.75}
          />
          <line
            x1={12}
            y1={1}
            x2={12}
            y2={14}
            {...s}
            strokeWidth={0.5}
            opacity={0.4}
          />
          <line
            x1={1}
            y1={6}
            x2={23}
            y2={6}
            {...s}
            strokeWidth={0.5}
            opacity={0.4}
          />
          <line
            x1={1}
            y1={9}
            x2={23}
            y2={9}
            {...s}
            strokeWidth={0.5}
            opacity={0.4}
          />
          <line
            x1={6}
            y1={2}
            x2={17}
            y2={13}
            {...s}
            strokeWidth={0.5}
            opacity={0.3}
          />
          <line
            x1={17}
            y1={2}
            x2={6}
            y2={13}
            {...s}
            strokeWidth={0.5}
            opacity={0.3}
          />
        </svg>
      );
    case 35: // State Timeline — horizontal colored blocks
      return (
        <svg {...props}>
          {[
            [1, 6, "0.9"],
            [7, 4, "0.5"],
            [11, 7, "0.8"],
            [18, 5, "0.3"],
          ].map(([x, w, op], i) => (
            <rect
              key={i}
              x={x as number}
              y={5}
              width={w as number}
              height={6}
              rx={0.5}
              fill="currentColor"
              opacity={parseFloat(op as string)}
              stroke="none"
            />
          ))}
          <line
            x1={1}
            y1={5}
            x2={1}
            y2={11}
            {...s}
            strokeWidth={1}
            opacity={0.3}
          />
          <line
            x1={23}
            y1={5}
            x2={23}
            y2={11}
            {...s}
            strokeWidth={1}
            opacity={0.3}
          />
        </svg>
      );
    case 36: // Scorecard Table — metric cards in a grid
      return (
        <svg {...props}>
          <rect
            x={1}
            y={1}
            width={10}
            height={6}
            rx={1}
            fill="currentColor"
            opacity={0.2}
            stroke="currentColor"
            strokeWidth={0.75}
          />
          <rect
            x={13}
            y={1}
            width={10}
            height={6}
            rx={1}
            fill="currentColor"
            opacity={0.5}
            stroke="currentColor"
            strokeWidth={0.75}
          />
          <rect
            x={1}
            y={9}
            width={10}
            height={6}
            rx={1}
            fill="currentColor"
            opacity={0.35}
            stroke="currentColor"
            strokeWidth={0.75}
          />
          <rect
            x={13}
            y={9}
            width={10}
            height={6}
            rx={1}
            fill="currentColor"
            opacity={0.7}
            stroke="currentColor"
            strokeWidth={0.75}
          />
        </svg>
      );
    case 37: // Parallel Coord — vertical axes with crossing lines
      return (
        <svg {...props}>
          {[3, 9, 15, 21].map((x, i) => (
            <line key={i} x1={x} y1={2} x2={x} y2={14} {...s} strokeWidth={1} />
          ))}
          <polyline points="3,4 9,11 15,6 21,10" {...s} strokeWidth={1.5} />
          <polyline
            points="3,10 9,5 15,12 21,4"
            {...s}
            strokeWidth={1.5}
            opacity={0.5}
          />
        </svg>
      );
    case 38: // Subgroup SPC — xbar chart with range
      return (
        <svg {...props}>
          <line
            x1={1}
            y1={5}
            x2={23}
            y2={5}
            {...s}
            strokeWidth={0.75}
            strokeDasharray="3,1"
            opacity={0.5}
          />
          <line
            x1={1}
            y1={9}
            x2={23}
            y2={9}
            {...s}
            strokeWidth={0.75}
            opacity={0.4}
          />
          <polyline
            points="2,9 5,8 8,6 11,7 14,10 17,8 20,7 23,6"
            {...s}
            strokeWidth={1.5}
          />
          {[2, 5, 8, 11, 14, 17, 20].map((x) => (
            <circle
              key={x}
              cx={x}
              cy={
                x === 2
                  ? 9
                  : x === 5
                    ? 8
                    : x === 8
                      ? 6
                      : x === 11
                        ? 7
                        : x === 14
                          ? 10
                          : x === 17
                            ? 8
                            : 7
              }
              r={1}
              fill="currentColor"
              stroke="none"
            />
          ))}
        </svg>
      );
    case 39: // Attribute Control (p/u) — bars with control line
      return (
        <svg {...props}>
          <line
            x1={1}
            y1={6}
            x2={23}
            y2={6}
            {...s}
            strokeWidth={0.75}
            strokeDasharray="3,1"
            opacity={0.6}
          />
          {[
            [2, 5],
            [6, 3],
            [10, 6],
            [14, 4],
            [18, 5],
            [22, 3],
          ].map(([x, h], i) => (
            <rect
              key={i}
              x={x}
              y={14 - h}
              width={2.5}
              height={h}
              fill="currentColor"
              opacity={0.7}
              rx={0.5}
              stroke="none"
            />
          ))}
        </svg>
      );
    default:
      return (
        <svg {...props}>
          <rect
            x={4}
            y={4}
            width={16}
            height={8}
            rx={1}
            {...s}
            strokeWidth={1}
          />
        </svg>
      );
  }
}

// ── Component ────────────────────────────────────────────────────────────────

const TIER_COLORS: Record<string, string> = {
  initial: "var(--io-accent)",
  mid: "#F59E0B",
  late: "#8B5CF6",
};

export default function ChartTypePicker({
  selectedType,
  onSelect,
  context,
  pointTypes,
}: ChartTypePickerProps) {
  const [hoveredDef, setHoveredDef] = useState<ChartDefinition | null>(null);

  const visibleDefs = context
    ? CHART_DEFINITIONS.filter(
        (d) => !d.contexts || d.contexts.includes(context),
      )
    : CHART_DEFINITIONS;

  const selectedDef =
    visibleDefs.find((d) => d.id === selectedType) ?? visibleDefs[0];
  const previewDef = hoveredDef ?? selectedDef;

  return (
    <div
      style={{
        display: "flex",
        gap: 0,
        flex: 1,
        minHeight: 0,
        border: "1px solid var(--io-border)",
        borderRadius: 6,
        overflow: "hidden",
      }}
    >
      {/* Left: category + type list */}
      <div
        style={{
          width: "clamp(210px, 20%, 280px)",
          flexShrink: 0,
          overflowY: "auto",
          borderRight: "1px solid var(--io-border)",
          background: "var(--io-surface-secondary)",
        }}
      >
        {CHART_CATEGORIES.map((cat) => {
          const items = visibleDefs.filter((d) => d.category === cat);
          if (items.length === 0) return null;
          return (
            <div key={cat}>
              <div
                style={{
                  padding: "6px 10px 4px",
                  fontSize: "0.75em",
                  fontWeight: 700,
                  color: "var(--io-text-muted)",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  borderTop: "1px solid var(--io-border)",
                }}
              >
                {cat}
              </div>
              {items.map((def) => {
                const isSelected = def.id === selectedType;
                const compatible = isCompatible(def, pointTypes);
                return (
                  <button
                    key={def.id}
                    onClick={() => onSelect(def.id)}
                    onMouseEnter={() => setHoveredDef(def)}
                    onMouseLeave={() => setHoveredDef(null)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      width: "100%",
                      padding: "5px 10px",
                      border: "none",
                      background: isSelected
                        ? "color-mix(in srgb, var(--io-accent) 15%, transparent)"
                        : "transparent",
                      color: isSelected
                        ? "var(--io-accent)"
                        : "var(--io-text-primary)",
                      cursor: "pointer",
                      textAlign: "left",
                      fontSize: "1em",
                      opacity: compatible ? 1 : 0.4,
                    }}
                  >
                    <span
                      style={{
                        color: TIER_COLORS[def.tier],
                        flexShrink: 0,
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      <MicroIcon id={def.id} />
                    </span>
                    <span
                      style={{
                        flex: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        maxWidth: "30ch",
                      }}
                    >
                      {def.name}
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Right: preview + description — fills remaining height */}
      <div
        style={{
          flex: 1,
          padding: "14px 16px",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "0.8em",
        }}
      >
        <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
          {/* Thumbnail — 240×160 clip box; inner div scaled 2× from top-left */}
          <div
            style={{
              flexShrink: 0,
              width: 240,
              height: 160,
              border: "1px solid var(--io-border)",
              borderRadius: 6,
              overflow: "hidden",
              background: "var(--io-surface-secondary)",
              lineHeight: 0,
            }}
          >
            <div style={{ transformOrigin: "top left", transform: "scale(2)" }}>
              {(THUMBNAILS[previewDef.id] ?? (() => null))()}
            </div>
          </div>

          {/* Name + meta */}
          <div style={{ flex: 1 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: "0.4em",
              }}
            >
              <span
                style={{
                  fontSize: "1.15em",
                  fontWeight: 600,
                  color: "var(--io-text-primary)",
                }}
              >
                {previewDef.name}
              </span>
              <span
                style={{
                  fontSize: "0.75em",
                  padding: "2px 6px",
                  borderRadius: 10,
                  background: TIER_COLORS[previewDef.tier],
                  color: "#fff",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                {getTierLabel(previewDef.tier)}
              </span>
              <span
                style={{ fontSize: "0.75em", color: "var(--io-text-muted)" }}
              >
                {previewDef.realTime === true
                  ? "Live"
                  : previewDef.realTime === "optional"
                    ? "Live/Historical"
                    : "Historical"}
              </span>
            </div>
            <p
              style={{
                fontSize: "0.95em",
                color: "var(--io-text-secondary)",
                margin: 0,
                lineHeight: 1.6,
              }}
            >
              {previewDef.description}
            </p>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "0.8em",
          }}
        >
          {/* Benefits */}
          <div>
            <div
              style={{
                fontSize: "0.8em",
                fontWeight: 600,
                color: "#10B981",
                marginBottom: "0.3em",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Benefits
            </div>
            <ul
              style={{
                margin: 0,
                paddingLeft: "1.2em",
                fontSize: "0.9em",
                color: "var(--io-text-secondary)",
                lineHeight: 1.7,
              }}
            >
              {previewDef.benefits.map((b, i) => (
                <li key={i}>{b}</li>
              ))}
            </ul>
          </div>
          {/* Downsides */}
          <div>
            <div
              style={{
                fontSize: "0.8em",
                fontWeight: 600,
                color: "#EF4444",
                marginBottom: "0.3em",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Limitations
            </div>
            <ul
              style={{
                margin: 0,
                paddingLeft: "1.2em",
                fontSize: "0.9em",
                color: "var(--io-text-secondary)",
                lineHeight: 1.7,
              }}
            >
              {previewDef.downsides.map((d, i) => (
                <li key={i}>{d}</li>
              ))}
            </ul>
          </div>
        </div>

        {previewDef.usage && (
          <div
            style={{
              padding: "0.7em 0.9em",
              background: "var(--io-surface-secondary)",
              borderRadius: 6,
              border: "1px solid var(--io-border)",
              borderLeft: "3px solid var(--io-accent)",
            }}
          >
            <div
              style={{
                fontSize: "0.8em",
                fontWeight: 600,
                color: "var(--io-accent)",
                marginBottom: "0.25em",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Usage
            </div>
            <p
              style={{
                margin: 0,
                fontSize: "0.9em",
                color: "var(--io-text-secondary)",
                lineHeight: 1.6,
              }}
            >
              {previewDef.usage}
            </p>
          </div>
        )}

        {previewDef.scenarios && previewDef.scenarios.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div
              style={{
                fontSize: "0.8em",
                fontWeight: 600,
                color: "var(--io-accent)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Real-World Scenarios
            </div>
            {previewDef.scenarios.map((scenario, i) => (
              <div
                key={i}
                style={{
                  padding: "0.7em 0.9em",
                  background: "var(--io-surface-secondary)",
                  borderRadius: 6,
                  border: "1px solid var(--io-border)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      fontSize: "0.72em",
                      fontWeight: 600,
                      color: "var(--io-accent)",
                      background:
                        "color-mix(in srgb, var(--io-accent) 12%, transparent)",
                      border:
                        "1px solid color-mix(in srgb, var(--io-accent) 30%, transparent)",
                      borderRadius: 4,
                      padding: "1px 7px",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {scenario.role}
                  </span>
                  <span
                    style={{
                      fontSize: "0.88em",
                      fontWeight: 600,
                      color: "var(--io-text-primary)",
                      lineHeight: 1.3,
                    }}
                  >
                    {scenario.title}
                  </span>
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: "0.88em",
                    color: "var(--io-text-secondary)",
                    lineHeight: 1.6,
                  }}
                >
                  {scenario.description}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
