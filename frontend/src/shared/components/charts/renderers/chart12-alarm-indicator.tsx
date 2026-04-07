// ---------------------------------------------------------------------------
// Chart 12 — Alarm Indicator (ISA-101)
// Shows worst-priority alarm state across all assigned points based on live
// values vs extras.thresholds. Flashes on unacknowledged state.
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState } from "react";
import { useWebSocket } from "../../../hooks/useWebSocket";
import { type ChartConfig } from "../chart-config-types";

interface RendererProps {
  config: ChartConfig;
  bufferKey: string;
}

interface ThresholdEntry {
  value: number;
  color: string;
  label: string;
  priority?: "urgent" | "high" | "low" | "diagnostic";
}

type AlarmLevel = "urgent" | "high" | "low" | "diagnostic" | "normal";

const LEVEL_ORDER: AlarmLevel[] = [
  "urgent",
  "high",
  "low",
  "diagnostic",
  "normal",
];

function worstLevel(a: AlarmLevel, b: AlarmLevel): AlarmLevel {
  return LEVEL_ORDER.indexOf(a) <= LEVEL_ORDER.indexOf(b) ? a : b;
}

function valueToLevel(value: number, thresholds: ThresholdEntry[]): AlarmLevel {
  if (thresholds.length === 0) return "normal";
  const sorted = [...thresholds].sort((a, b) => b.value - a.value);
  for (const t of sorted) {
    if (value >= t.value) {
      const p = t.priority;
      if (p === "urgent") return "urgent";
      if (p === "high") return "high";
      if (p === "low") return "low";
      if (p === "diagnostic") return "diagnostic";
      // Fall back to ISA-101 heuristic: use color
      if (t.color?.toLowerCase().includes("red")) return "urgent";
      if (t.color?.toLowerCase().includes("orange")) return "high";
      if (t.color?.toLowerCase().includes("yellow")) return "low";
      return "low";
    }
  }
  return "normal";
}

function AlarmShape({
  level,
  flashing,
}: {
  level: AlarmLevel;
  flashing: boolean;
}) {
  const [vis, setVis] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (flashing) {
      intervalRef.current = setInterval(() => setVis((v) => !v), 500);
    } else {
      setVis(true);
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [flashing]);

  const opacity = flashing && !vis ? 0.1 : 1;

  if (level === "urgent") {
    return (
      <svg width={56} height={56} viewBox="0 0 56 56" style={{ opacity }}>
        <rect x={4} y={4} width={48} height={48} fill="#EF4444" rx={4} />
        <text
          x={28}
          y={36}
          textAnchor="middle"
          fontSize={22}
          fontWeight={700}
          fill="#fff"
        >
          !!
        </text>
      </svg>
    );
  }
  if (level === "high") {
    return (
      <svg width={56} height={56} viewBox="0 0 56 56" style={{ opacity }}>
        <polygon points="28,4 52,52 4,52" fill="#F97316" />
        <text
          x={28}
          y={46}
          textAnchor="middle"
          fontSize={20}
          fontWeight={700}
          fill="#fff"
        >
          !
        </text>
      </svg>
    );
  }
  if (level === "low") {
    return (
      <svg width={56} height={56} viewBox="0 0 56 56" style={{ opacity }}>
        <polygon points="28,4 52,28 28,52 4,28" fill="#EAB308" />
        <text
          x={28}
          y={35}
          textAnchor="middle"
          fontSize={20}
          fontWeight={700}
          fill="#fff"
        >
          ?
        </text>
      </svg>
    );
  }
  if (level === "diagnostic") {
    return (
      <svg width={56} height={56} viewBox="0 0 56 56" style={{ opacity }}>
        <circle cx={28} cy={28} r={24} fill="#F4F4F5" />
        <text
          x={28}
          y={35}
          textAnchor="middle"
          fontSize={22}
          fontWeight={700}
          fill="#fff"
        >
          i
        </text>
      </svg>
    );
  }
  return null;
}

export default function Chart12AlarmIndicator({ config }: RendererProps) {
  const seriesSlots = config.points.filter((p) => p.role === "series");
  const pointIds = seriesSlots.map((s) => s.pointId);

  const rawThresholds = config.extras?.thresholds;
  const thresholds: ThresholdEntry[] = Array.isArray(rawThresholds)
    ? (rawThresholds as ThresholdEntry[])
    : [];

  const { values } = useWebSocket(pointIds);

  let worst: AlarmLevel = "normal";
  for (const slot of seriesSlots) {
    const entry = values.get(slot.pointId);
    if (entry !== undefined) {
      const lv = valueToLevel(entry.value, thresholds);
      worst = worstLevel(worst, lv);
    }
  }

  // ISA-18.2 NOTE: acknowledged alarms should NOT flash. True acknowledgment state
  // requires a subscription to the event service alarm channel (not yet threaded
  // through the WS point value stream). Until then, all active alarms flash — this
  // is conservative (noisier) rather than dangerous (hiding unacked alarms).
  const unacknowledged = worst !== "normal";

  if (worst === "normal") {
    return <div style={{ flex: 1, minHeight: 0 }} />;
  }

  const levelLabels: Record<Exclude<AlarmLevel, "normal">, string> = {
    urgent: "URGENT",
    high: "HIGH",
    low: "LOW",
    diagnostic: "DIAGNOSTIC",
  };

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 8,
        minHeight: 0,
      }}
    >
      <AlarmShape level={worst} flashing={unacknowledged} />
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "var(--io-text-secondary)",
          letterSpacing: "0.05em",
        }}
      >
        {levelLabels[worst as Exclude<AlarmLevel, "normal">]}
      </div>
    </div>
  );
}
