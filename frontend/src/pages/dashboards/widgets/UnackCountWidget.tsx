import { useQuery } from "@tanstack/react-query";
import { api } from "../../../api/client";
import type { WidgetConfig } from "../../../api/dashboards";

interface UnackCountConfig {
  title?: string;
  severities?: string[];
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

export default function UnackCountWidget({ config }: Props) {
  const cfg = config.config as unknown as UnackCountConfig;
  const filterSeverities = cfg.severities ?? [];
  const warnThreshold = cfg.warnThreshold ?? 5;
  const criticalThreshold = cfg.criticalThreshold ?? 20;

  const query = useQuery({
    queryKey: ["active-alarms-unack", filterSeverities],
    queryFn: async () => {
      const result = await api.get<ActiveAlarm[]>("/api/alarms/active");
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    refetchInterval: 5000,
  });

  const allAlarms = query.data ?? [];
  const filtered =
    filterSeverities.length > 0
      ? allAlarms.filter((a) => filterSeverities.includes(a.severity))
      : allAlarms;
  const unackCount = filtered.filter((a) => !a.acknowledged_at).length;

  function getColor(count: number): string {
    if (count >= criticalThreshold) return "var(--io-alarm-critical)";
    if (count >= warnThreshold) return "var(--io-alarm-high)";
    if (count > 0) return "var(--io-alarm-medium)";
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
            height: "48px",
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
        Failed to load alarms
      </div>
    );
  }

  const color = getColor(unackCount);

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
          fontSize: "48px",
          fontWeight: 700,
          lineHeight: 1,
          color,
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {unackCount}
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
        Unacknowledged
      </div>
      {filterSeverities.length > 0 && (
        <div style={{ fontSize: "10px", color: "var(--io-text-muted)" }}>
          {filterSeverities.join(", ")}
        </div>
      )}
    </div>
  );
}
