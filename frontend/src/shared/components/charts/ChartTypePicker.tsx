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
} from "./chart-definitions";
import type { ChartTypeId } from "./chart-config-types";

interface ChartTypePickerProps {
  selectedType: ChartTypeId;
  onSelect: (type: ChartTypeId) => void;
  /** When provided, hides charts that don't list this context in their `contexts` field. */
  context?: ChartContext;
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
  return (
    <svg viewBox="0 0 120 80" width={120} height={80}>
      {Array.from({ length: 4 }, (_, ri) =>
        Array.from({ length: 5 }, (_, ci) => {
          const x1 = 10 + ci * 22 + ri * 5,
            y1 = 60 - ri * 12;
          const x2 = x1 + 22,
            y2 = y1;
          const x3 = x2 + 5,
            y3 = y1 - 12;
          const x4 = x1 + 5,
            y4 = y1 - 12;
          const heat = (ri + ci) / 7;
          const r = Math.round(heat * 220),
            b = Math.round((1 - heat) * 200);
          return (
            <polygon
              key={`${ri}-${ci}`}
              points={`${x1},${y1} ${x2},${y2} ${x3},${y3} ${x4},${y4}`}
              fill={`rgb(${r},80,${b})`}
              opacity={0.7}
              stroke="var(--io-surface)"
              strokeWidth={0.5}
            />
          );
        }),
      )}
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
};

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
          width: "clamp(160px, 14%, 220px)",
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
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.75em",
                        color: TIER_COLORS[def.tier],
                        fontWeight: 700,
                        minWidth: 16,
                        textAlign: "right",
                      }}
                    >
                      {def.id}
                    </span>
                    <span
                      style={{
                        flex: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
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
          {/* Thumbnail */}
          <div
            style={{
              flexShrink: 0,
              border: "1px solid var(--io-border)",
              borderRadius: 6,
              overflow: "hidden",
              background: "var(--io-surface-secondary)",
              lineHeight: 0,
            }}
          >
            {(THUMBNAILS[previewDef.id] ?? (() => null))()}
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
                      background: "color-mix(in srgb, var(--io-accent) 12%, transparent)",
                      border: "1px solid color-mix(in srgb, var(--io-accent) 30%, transparent)",
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
