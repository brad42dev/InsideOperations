import { useQuery } from "@tanstack/react-query";
import { api } from "../../../api/client";
import type { WidgetConfig } from "../../../api/dashboards";

interface Props {
  config: WidgetConfig;
  variables: Record<string, string[]>;
}

interface ActiveAlarm {
  id: string;
  severity: string;
  acknowledged_at?: string | null;
  triggered_at: string;
}

/**
 * Alarm Health KPI — displays a composite alarm health score based on:
 * - Active alarm count
 * - Unacknowledged ratio
 * - Critical alarm presence
 *
 * Score: 100 (all clear) → 0 (critical alarms, high unacked ratio)
 */
function computeHealthScore(alarms: ActiveAlarm[]): number {
  if (alarms.length === 0) return 100;
  const total = alarms.length;
  const unacked = alarms.filter((a) => !a.acknowledged_at).length;
  const critical = alarms.filter((a) => a.severity === "critical").length;

  // Penalties: each alarm costs points, critical alarms cost more
  const countPenalty = Math.min(total * 2, 40);
  const unackedPenalty = total > 0 ? Math.round((unacked / total) * 30) : 0;
  const criticalPenalty = Math.min(critical * 10, 30);

  return Math.max(0, 100 - countPenalty - unackedPenalty - criticalPenalty);
}

function healthColor(score: number): string {
  if (score >= 80) return "var(--io-alarm-normal)";
  if (score >= 50) return "var(--io-alarm-medium)";
  if (score >= 25) return "var(--io-alarm-high)";
  return "var(--io-alarm-critical)";
}

function healthLabel(score: number): string {
  if (score >= 80) return "HEALTHY";
  if (score >= 50) return "FAIR";
  if (score >= 25) return "POOR";
  return "CRITICAL";
}

export default function AlarmHealthKpiWidget({ config: _config }: Props) {
  const query = useQuery({
    queryKey: ["alarm-health-kpi"],
    queryFn: async () => {
      const result = await api.get<ActiveAlarm[]>("/api/alarms/active");
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    refetchInterval: 10000,
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

  const alarms = query.data ?? [];
  const score = computeHealthScore(alarms);
  const color = healthColor(score);
  const label = healthLabel(score);
  const unacked = alarms.filter((a) => !a.acknowledged_at).length;
  const critical = alarms.filter((a) => a.severity === "critical").length;

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "4px",
        padding: "10px",
      }}
    >
      {/* Score */}
      <div
        style={{
          fontSize: "48px",
          fontWeight: 700,
          lineHeight: 1,
          color,
          fontVariantNumeric: "tabular-nums",
          transition: "color 0.3s",
        }}
      >
        {score}
      </div>
      <div
        style={{
          fontSize: "11px",
          color: "var(--io-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          fontWeight: 700,
        }}
      >
        {label}
      </div>

      {/* Stats row */}
      <div
        style={{
          display: "flex",
          gap: "12px",
          marginTop: "4px",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: "16px",
              fontWeight: 700,
              color:
                alarms.length > 0
                  ? "var(--io-alarm-medium)"
                  : "var(--io-text-muted)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {alarms.length}
          </div>
          <div
            style={{
              fontSize: "9px",
              color: "var(--io-text-muted)",
              textTransform: "uppercase",
            }}
          >
            Active
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: "16px",
              fontWeight: 700,
              color:
                unacked > 0 ? "var(--io-alarm-high)" : "var(--io-text-muted)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {unacked}
          </div>
          <div
            style={{
              fontSize: "9px",
              color: "var(--io-text-muted)",
              textTransform: "uppercase",
            }}
          >
            Unack
          </div>
        </div>
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: "16px",
              fontWeight: 700,
              color:
                critical > 0
                  ? "var(--io-alarm-critical)"
                  : "var(--io-text-muted)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {critical}
          </div>
          <div
            style={{
              fontSize: "9px",
              color: "var(--io-text-muted)",
              textTransform: "uppercase",
            }}
          >
            Critical
          </div>
        </div>
      </div>
    </div>
  );
}
