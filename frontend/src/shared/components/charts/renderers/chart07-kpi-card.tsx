// ---------------------------------------------------------------------------
// Chart 07 — KPI Card
// Single-point live value display with trend arrow, threshold coloring, and
// an optional inline sparkline drawn from a 20-value circular buffer.
// ---------------------------------------------------------------------------

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useWebSocket } from "../../../hooks/useWebSocket";
import { pointsApi } from "../../../../api/points";
import { type ChartConfig } from "../chart-config-types";

interface RendererProps {
  config: ChartConfig;
  bufferKey: string;
}

interface ThresholdEntry {
  value: number;
  color: string;
  label: string;
}

const SPARKLINE_SIZE = 20;

function buildSparklinePath(buf: number[], w: number, h: number): string {
  if (buf.length < 2) return "";
  const minV = Math.min(...buf);
  const maxV = Math.max(...buf);
  const range = maxV - minV || 1;
  const step = w / (buf.length - 1);
  const points = buf.map((v, i) => {
    const x = i * step;
    const y = h - ((v - minV) / range) * h;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return `M ${points.join(" L ")}`;
}

export default function Chart07KpiCard({ config }: RendererProps) {
  const pointSlot = config.points.find((p) => p.role === "point");
  const pointId = pointSlot?.pointId ?? null;
  const pointIds = pointId ? [pointId] : [];

  const { values } = useWebSocket(pointIds);
  const liveEntry = pointId ? values.get(pointId) : undefined;
  const liveValue = liveEntry?.value;

  // Metadata
  const { data: metaResult } = useQuery({
    queryKey: ["kpi-meta", pointId],
    queryFn: () => pointsApi.getMeta(pointId!),
    enabled: !!pointId,
    staleTime: 60_000,
  });
  const meta = metaResult?.success ? metaResult.data : null;

  // Sparkline circular buffer
  const sparkBuf = useRef<number[]>([]);
  useEffect(() => {
    if (liveValue !== undefined) {
      sparkBuf.current = [...sparkBuf.current, liveValue].slice(
        -SPARKLINE_SIZE,
      );
    }
  }, [liveValue]);

  // Trend: compare current value to value ~5 minutes ago.
  // The interval is mounted once so it is never cleared by WS updates.
  // liveValueRef keeps the interval callback reading the latest value.
  const liveValueRef = useRef<number | undefined>(liveValue);
  useEffect(() => {
    liveValueRef.current = liveValue;
  }, [liveValue]);

  const fiveMinAgoRef = useRef<number | undefined>(undefined);
  const [trendDir, setTrendDir] = useState<"up" | "down" | "flat">("flat");

  // Update trend direction on every live value change
  useEffect(() => {
    if (liveValue === undefined) return;
    if (fiveMinAgoRef.current === undefined) {
      fiveMinAgoRef.current = liveValue;
      return;
    }
    const prev = fiveMinAgoRef.current;
    if (liveValue > prev + 0.001) setTrendDir("up");
    else if (liveValue < prev - 0.001) setTrendDir("down");
    else setTrendDir("flat");
  }, [liveValue]);

  // Snapshot baseline every 5 minutes — mounted once, not tied to liveValue
  useEffect(() => {
    const timer = setInterval(
      () => {
        if (liveValueRef.current !== undefined) {
          fiveMinAgoRef.current = liveValueRef.current;
        }
      },
      5 * 60 * 1000,
    );
    return () => clearInterval(timer);
  }, []);

  // Threshold background coloring
  const rawThresholds = config.extras?.thresholds;
  const thresholds: ThresholdEntry[] = Array.isArray(rawThresholds)
    ? (rawThresholds as ThresholdEntry[])
    : [];

  let bgColor = "var(--io-surface)";
  if (liveValue !== undefined && thresholds.length > 0) {
    const sorted = [...thresholds].sort((a, b) => a.value - b.value);
    for (const t of sorted) {
      if (liveValue >= t.value) bgColor = t.color;
    }
  }

  const showSparkline = config.extras?.showSparkline !== false;
  const [sparkBufState, setSparkBufState] = useState<number[]>([]);

  useEffect(() => {
    setSparkBufState([...sparkBuf.current]);
  }, [liveValue]);

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

  const displayValue =
    liveValue !== undefined
      ? liveValue.toLocaleString(undefined, { maximumFractionDigits: 3 })
      : "—";

  const unit = meta?.engineering_unit ?? "";
  const label = meta?.description ?? meta?.name ?? pointId ?? "";

  const trendArrow = trendDir === "up" ? "▲" : trendDir === "down" ? "▼" : "▶";
  const trendColor =
    trendDir === "up"
      ? "#10B981"
      : trendDir === "down"
        ? "#EF4444"
        : "var(--io-text-muted)";

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: bgColor,
        transition: "background 0.4s ease",
        padding: 16,
        gap: 4,
        position: "relative",
        minHeight: 0,
      }}
    >
      {/* Trend arrow */}
      <div
        style={{
          position: "absolute",
          top: 10,
          right: 14,
          fontSize: 18,
          color: trendColor,
          lineHeight: 1,
        }}
      >
        {trendArrow}
      </div>

      {/* Value */}
      <div
        style={{
          fontSize: 48,
          fontWeight: 700,
          color: "var(--io-text-primary)",
          lineHeight: 1,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {displayValue}
      </div>

      {/* Unit */}
      {unit && (
        <div
          style={{
            fontSize: 16,
            color: "var(--io-text-secondary)",
            marginTop: 2,
          }}
        >
          {unit}
        </div>
      )}

      {/* Label */}
      <div
        style={{
          fontSize: 12,
          color: "var(--io-text-muted)",
          marginTop: 4,
          textAlign: "center",
          maxWidth: "80%",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {label}
      </div>

      {/* Sparkline */}
      {showSparkline && sparkBufState.length >= 2 && (
        <svg
          width="100%"
          height={32}
          viewBox="0 0 100 32"
          preserveAspectRatio="none"
          style={{ marginTop: 8, opacity: 0.7 }}
        >
          <path
            d={buildSparklinePath(sparkBufState, 100, 30)}
            fill="none"
            stroke={pointSlot.color ?? "#4A9EFF"}
            strokeWidth="1.5"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      )}
    </div>
  );
}
