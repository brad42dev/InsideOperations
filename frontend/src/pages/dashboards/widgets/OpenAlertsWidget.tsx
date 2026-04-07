import { useQuery } from "@tanstack/react-query";
import { notificationsApi } from "../../../api/notifications";
import type { WidgetConfig } from "../../../api/dashboards";

interface Props {
  config: WidgetConfig;
  variables: Record<string, string[]>;
}

const SEVERITY_COLORS: Record<string, string> = {
  emergency: "var(--io-alarm-urgent)",
  critical: "var(--io-alarm-high)",
  warning: "var(--io-alarm-low)",
  info: "var(--io-info)",
};

function timeAgo(isoString: string): string {
  const diff = Math.floor((Date.now() - new Date(isoString).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function OpenAlertsWidget({ config: _config }: Props) {
  const query = useQuery({
    queryKey: ["open-alerts-widget"],
    queryFn: async () => {
      const result = await notificationsApi.getActive();
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    refetchInterval: 30000,
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
        Failed to load alerts
      </div>
    );
  }

  const alerts = query.data ?? [];
  const count = alerts.length;

  if (count === 0) {
    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "6px",
        }}
      >
        <div
          style={{
            fontSize: "48px",
            fontWeight: 700,
            color: "var(--io-alarm-normal)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          0
        </div>
        <div
          style={{
            fontSize: "11px",
            color: "var(--io-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
          }}
        >
          Open Alerts
        </div>
        <div style={{ fontSize: "10px", color: "var(--io-alarm-normal)" }}>
          No active alerts
        </div>
      </div>
    );
  }

  const emergencyCount = alerts.filter(
    (a) => a.severity === "emergency",
  ).length;
  const criticalCount = alerts.filter((a) => a.severity === "critical").length;

  const countColor =
    emergencyCount > 0
      ? "var(--io-alarm-urgent)"
      : criticalCount > 0
        ? "var(--io-alarm-high)"
        : "var(--io-alarm-low)";

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Count header */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: "6px",
          padding: "6px 10px 2px",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: "28px",
            fontWeight: 700,
            color: countColor,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {count}
        </span>
        <span style={{ fontSize: "11px", color: "var(--io-text-muted)" }}>
          open alerts
        </span>
      </div>

      {/* Alert list */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {alerts.map((alert) => {
          const sevColor =
            SEVERITY_COLORS[alert.severity] ?? "var(--io-text-muted)";
          return (
            <div
              key={alert.id}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "8px",
                padding: "6px 10px",
                borderBottom: "1px solid var(--io-border)",
              }}
            >
              <span
                style={{
                  flexShrink: 0,
                  marginTop: "3px",
                  width: "7px",
                  height: "7px",
                  borderRadius: "50%",
                  background: sevColor,
                  display: "inline-block",
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "12px",
                    fontWeight: 600,
                    color: "var(--io-text-primary)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {alert.title}
                </div>
                <div
                  style={{
                    fontSize: "10px",
                    color: "var(--io-text-muted)",
                    marginTop: "1px",
                    display: "flex",
                    gap: "6px",
                  }}
                >
                  <span
                    style={{
                      textTransform: "uppercase",
                      color: sevColor,
                      fontWeight: 700,
                    }}
                  >
                    {alert.severity}
                  </span>
                  <span>{timeAgo(alert.sent_at)}</span>
                  {alert.recipient_count > 0 && (
                    <span>{alert.recipient_count} recipients</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
