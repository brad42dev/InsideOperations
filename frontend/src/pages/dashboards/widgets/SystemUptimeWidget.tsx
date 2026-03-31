import { useQuery } from "@tanstack/react-query";
import { fetchServiceHealth } from "../../../api/health";
import { systemApi } from "../../../api/system";
import type { WidgetConfig } from "../../../api/dashboards";

interface Props {
  config: WidgetConfig;
  variables: Record<string, string[]>;
}

export default function SystemUptimeWidget({ config: _config }: Props) {
  const healthQuery = useQuery({
    queryKey: ["system-uptime-health"],
    queryFn: () => fetchServiceHealth(),
    refetchInterval: 30000,
  });

  const aboutQuery = useQuery({
    queryKey: ["system-about"],
    queryFn: async () => {
      const result = await systemApi.about();
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const isLoading = healthQuery.isLoading || aboutQuery.isLoading;

  if (isLoading) {
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
            height: "64px",
            borderRadius: 4,
            background: "var(--io-surface-secondary)",
            animation: "io-skeleton-pulse 1.5s ease-in-out infinite",
          }}
        />
      </div>
    );
  }

  const services = healthQuery.data ?? [];
  const totalServices = services.length;
  const healthyServices = services.filter((s) => s.status === "healthy").length;
  const degradedServices = services.filter(
    (s) => s.status === "degraded",
  ).length;
  const unhealthyServices = services.filter(
    (s) => s.status === "unhealthy",
  ).length;

  // Derive uptime percentage: healthy = 100%, degraded = partial, unhealthy = down
  const uptimePct =
    totalServices > 0
      ? Math.round(
          ((healthyServices + degradedServices * 0.5) / totalServices) * 1000,
        ) / 10
      : 100;

  const isFullyUp = healthyServices === totalServices && totalServices > 0;
  const uptimeColor =
    uptimePct >= 99.9
      ? "var(--io-alarm-normal)"
      : uptimePct >= 95
        ? "var(--io-alarm-medium)"
        : "var(--io-alarm-high)";

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
      {/* Big uptime number */}
      <div
        style={{
          fontSize: "40px",
          fontWeight: 700,
          lineHeight: 1,
          color: uptimeColor,
          fontVariantNumeric: "tabular-nums",
          letterSpacing: "-0.02em",
        }}
      >
        {uptimePct.toFixed(1)}%
      </div>
      <div
        style={{
          fontSize: "11px",
          color: "var(--io-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.08em",
        }}
      >
        System Uptime
      </div>

      {/* Version info */}
      {aboutQuery.data && (
        <div style={{ fontSize: "10px", color: "var(--io-text-muted)" }}>
          v{aboutQuery.data.version}
        </div>
      )}

      {/* Service summary */}
      {totalServices > 0 && (
        <div
          style={{
            display: "flex",
            gap: "10px",
            marginTop: "6px",
          }}
        >
          {healthyServices > 0 && (
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: "16px",
                  fontWeight: 700,
                  color: "var(--io-alarm-normal)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {healthyServices}
              </div>
              <div
                style={{
                  fontSize: "9px",
                  color: "var(--io-text-muted)",
                  textTransform: "uppercase",
                }}
              >
                Healthy
              </div>
            </div>
          )}
          {degradedServices > 0 && (
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: "16px",
                  fontWeight: 700,
                  color: "var(--io-alarm-medium)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {degradedServices}
              </div>
              <div
                style={{
                  fontSize: "9px",
                  color: "var(--io-text-muted)",
                  textTransform: "uppercase",
                }}
              >
                Degraded
              </div>
            </div>
          )}
          {unhealthyServices > 0 && (
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  fontSize: "16px",
                  fontWeight: 700,
                  color: "var(--io-alarm-critical)",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {unhealthyServices}
              </div>
              <div
                style={{
                  fontSize: "9px",
                  color: "var(--io-text-muted)",
                  textTransform: "uppercase",
                }}
              >
                Down
              </div>
            </div>
          )}
        </div>
      )}

      {isFullyUp && (
        <div
          style={{
            fontSize: "10px",
            color: "var(--io-alarm-normal)",
            marginTop: "2px",
          }}
        >
          All services operational
        </div>
      )}
    </div>
  );
}
