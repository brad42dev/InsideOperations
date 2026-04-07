import { useQuery } from "@tanstack/react-query";
import { api } from "../../../api/client";
import type { WidgetConfig } from "../../../api/dashboards";

interface AlarmKpiConfig {
  title?: string;
  metric?: "active_count" | "unack_count" | "critical_count";
  warnThreshold?: number;
  criticalThreshold?: number;
}

interface ActiveAlarm {
  id: string;
  severity: string;
  acknowledged_at?: string | null;
}

interface Props {
  config: WidgetConfig;
  variables: Record<string, string[]>;
}

export default function AlarmKpiWidget({ config }: Props) {
  const cfg = config.config as unknown as AlarmKpiConfig;
  const metric = cfg.metric ?? "active_count";
  const warnThreshold = cfg.warnThreshold ?? 5;
  const criticalThreshold = cfg.criticalThreshold ?? 20;

  const query = useQuery({
    queryKey: ["alarm-kpi", metric],
    queryFn: async () => {
      const result = await api.get<ActiveAlarm[]>("/api/alarms/active");
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    refetchInterval: 5000,
  });

  const alarms = query.data ?? [];

  function computeValue(): number {
    switch (metric) {
      case "unack_count":
        return alarms.filter((a) => !a.acknowledged_at).length;
      case "critical_count":
        return alarms.filter((a) => a.severity === "critical").length;
      case "active_count":
      default:
        return alarms.length;
    }
  }

  function getLabel(): string {
    switch (metric) {
      case "unack_count":
        return "Unacknowledged";
      case "critical_count":
        return "Critical Alarms";
      case "active_count":
      default:
        return "Active Alarms";
    }
  }

  function getColor(count: number): string {
    if (count >= criticalThreshold) return "var(--io-alarm-urgent)";
    if (count >= warnThreshold) return "var(--io-alarm-high)";
    if (count > 0) return "var(--io-alarm-low)";
    return "var(--io-alarm-normal)";
  }

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
            width: "80px",
            height: "56px",
            borderRadius: 4,
            background: "var(--io-surface-secondary)",
            animation: "io-skeleton-pulse 1.5s ease-in-out infinite",
          }}
        />
      </div>
    );
  }

  if (query.isError) {
    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--io-danger)",
          fontSize: "12px",
        }}
      >
        Failed to load alarm data
      </div>
    );
  }

  const value = computeValue();
  const color = getColor(value);

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "6px",
        padding: "12px",
      }}
    >
      <div
        style={{
          fontSize: "56px",
          fontWeight: 700,
          lineHeight: 1,
          color,
          fontVariantNumeric: "tabular-nums",
          transition: "color 0.3s",
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: "11px",
          color: "var(--io-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          fontWeight: 600,
          textAlign: "center",
        }}
      >
        {getLabel()}
      </div>
      {value === 0 && (
        <div style={{ fontSize: "10px", color: "var(--io-alarm-normal)" }}>
          All clear
        </div>
      )}
    </div>
  );
}
