import { useQuery } from "@tanstack/react-query";
import { api } from "../../../api/client";
import type { WidgetConfig } from "../../../api/dashboards";

interface ApiResponseTimeConfig {
  title?: string;
  percentile?: 50 | 95 | 99;
}

interface ServiceDetail {
  name: string;
  status: string;
  response_p50?: number;
  response_p95?: number;
  response_p99?: number;
}

interface Props {
  config: WidgetConfig;
  variables: Record<string, string[]>;
}

function getStatusColor(pct: number): string {
  if (pct > 1000) return "var(--io-alarm-critical)";
  if (pct > 500) return "var(--io-alarm-high)";
  if (pct > 200) return "var(--io-alarm-medium)";
  return "var(--io-alarm-normal)";
}

export default function ApiResponseTimeWidget({ config }: Props) {
  const cfg = config.config as unknown as ApiResponseTimeConfig;
  const percentile = cfg.percentile ?? 95;

  const query = useQuery({
    queryKey: ["service-health-detail"],
    queryFn: async () => {
      const result = await api.get<ServiceDetail[]>(
        "/api/health/services/detail",
      );
      if (!result.success) throw new Error(result.error.message);
      const data = result.data;
      if (Array.isArray(data) && data.length > 0) return data;
      return null;
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
        }}
      >
        <div
          style={{
            width: "100px",
            height: "56px",
            borderRadius: 4,
            background: "var(--io-surface-secondary)",
            animation: "io-skeleton-pulse 1.5s ease-in-out infinite",
          }}
        />
      </div>
    );
  }

  if (query.isError || !query.data) {
    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--io-text-muted)",
          fontSize: "12px",
          flexDirection: "column",
          gap: "4px",
        }}
      >
        <span>Response time data unavailable</span>
      </div>
    );
  }

  // Compute the max p95 across all services as the headline number
  const services = query.data;
  const fieldKey = percentile === 50 ? "response_p50" : "response_p95";
  const values = services
    .map((s) => s[fieldKey as keyof ServiceDetail] as number | undefined)
    .filter((v): v is number => v != null);
  const maxValue = values.length > 0 ? Math.max(...values) : null;
  const avgValue =
    values.length > 0
      ? values.reduce((a, b) => a + b, 0) / values.length
      : null;

  const displayValue = maxValue != null ? maxValue.toFixed(1) : "—";
  const color =
    maxValue != null ? getStatusColor(maxValue) : "var(--io-text-muted)";

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "4px",
        padding: "12px",
      }}
    >
      <div
        style={{
          fontSize: "40px",
          fontWeight: 700,
          color,
          fontFamily: "var(--io-font-mono, monospace)",
          lineHeight: 1,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {displayValue}
      </div>
      <div
        style={{
          fontSize: "11px",
          color: "var(--io-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          fontWeight: 600,
        }}
      >
        p{percentile} ms (max)
      </div>
      {avgValue != null && (
        <div
          style={{
            fontSize: "11px",
            color: "var(--io-text-muted)",
            marginTop: "2px",
          }}
        >
          avg {avgValue.toFixed(1)} ms across {services.length} services
        </div>
      )}
    </div>
  );
}
