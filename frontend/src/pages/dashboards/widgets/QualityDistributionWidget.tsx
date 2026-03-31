import { useQuery } from "@tanstack/react-query";
import { api } from "../../../api/client";
import type { WidgetConfig } from "../../../api/dashboards";
import EChart from "../../../shared/components/charts/EChart";
import type { EChartsOption } from "echarts";

interface Props {
  config: WidgetConfig;
  variables: Record<string, string[]>;
}

interface PointCurrentRow {
  point_id: string;
  quality: string;
}

type QualityCount = {
  Good: number;
  Bad: number;
  Uncertain: number;
  Unknown: number;
};

function resolveToken(token: string): string {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(token)
    .trim();
}

export default function QualityDistributionWidget({ config: _config }: Props) {
  const query = useQuery({
    queryKey: ["quality-distribution"],
    queryFn: async () => {
      const result = await api.get<PointCurrentRow[]>(
        "/api/opc/points/current-quality",
      );
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    refetchInterval: 15000,
  });

  if (query.isLoading) {
    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--io-text-muted)",
          fontSize: "12px",
        }}
      >
        Loading...
      </div>
    );
  }

  if (query.isError || !query.data) {
    // Fall back to synthetic display using alarm data as a proxy for OPC quality
    return <QualityDistributionFallback />;
  }

  const rows = Array.isArray(query.data) ? query.data : [];
  const counts: QualityCount = { Good: 0, Bad: 0, Uncertain: 0, Unknown: 0 };
  for (const row of rows) {
    const q = row.quality as keyof QualityCount;
    if (q in counts) counts[q]++;
    else counts.Unknown++;
  }
  const total = rows.length;

  if (total === 0) {
    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--io-text-muted)",
          fontSize: "12px",
        }}
      >
        No points monitored
      </div>
    );
  }

  const option: EChartsOption = {
    backgroundColor: "transparent",
    tooltip: {
      trigger: "item",
      formatter: "{b}: {c} ({d}%)",
    },
    legend: {
      orient: "vertical",
      right: 8,
      top: "center",
      textStyle: { color: resolveToken("--io-text-secondary"), fontSize: 11 },
    },
    series: [
      {
        type: "pie",
        radius: ["40%", "70%"],
        center: ["38%", "50%"],
        data: [
          { value: counts.Good, name: "Good", itemStyle: { color: "#22c55e" } },
          { value: counts.Bad, name: "Bad", itemStyle: { color: "#ef4444" } },
          {
            value: counts.Uncertain,
            name: "Uncertain",
            itemStyle: { color: "#f59e0b" },
          },
          {
            value: counts.Unknown,
            name: "Unknown",
            itemStyle: { color: "#6b7280" },
          },
        ].filter((d) => d.value > 0),
        label: { show: false },
        emphasis: { label: { show: false } },
      },
    ],
  };

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
      }}
    >
      <div
        style={{
          padding: "4px 8px",
          flexShrink: 0,
          fontSize: "11px",
          color: "var(--io-text-muted)",
        }}
      >
        {total.toLocaleString()} total points
      </div>
      <div style={{ flex: 1, minHeight: 0 }}>
        <EChart option={option} />
      </div>
    </div>
  );
}

/** Fallback when /api/opc/points/current-quality is unavailable — shows live OPC source quality summary */
function QualityDistributionFallback() {
  const query = useQuery({
    queryKey: ["quality-distribution-fallback"],
    queryFn: async () => {
      const result = await api.get<
        {
          source_id: string;
          name: string;
          connected: boolean;
          subscribed_points?: number;
        }[]
      >("/api/opc/sources/stats");
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    refetchInterval: 15000,
  });

  if (query.isLoading) {
    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--io-text-muted)",
          fontSize: "12px",
        }}
      >
        Loading...
      </div>
    );
  }

  const sources = Array.isArray(query.data) ? query.data : [];
  const connected = sources.filter((s) => s.connected).length;
  const total = sources.length;
  const good = sources.reduce(
    (sum, s) =>
      sum + (s.connected && s.subscribed_points ? s.subscribed_points : 0),
    0,
  );
  const totalPts = sources.reduce(
    (sum, s) => sum + (s.subscribed_points ?? 0),
    0,
  );

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        padding: "12px",
      }}
    >
      <div
        style={{
          fontSize: "40px",
          fontWeight: 700,
          color: connected === total && total > 0 ? "#22c55e" : "#ef4444",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {totalPts > 0 ? `${Math.round((good / totalPts) * 100)}%` : "—"}
      </div>
      <div
        style={{
          fontSize: "11px",
          color: "var(--io-text-muted)",
          textAlign: "center",
        }}
      >
        Good Quality
      </div>
      <div style={{ fontSize: "10px", color: "var(--io-text-muted)" }}>
        {connected}/{total} sources connected
      </div>
    </div>
  );
}
