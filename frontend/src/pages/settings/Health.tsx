import { useQuery } from "@tanstack/react-query";
import {
  fetchServiceHealth,
  type ServiceHealth,
  type ServiceStatus,
} from "../../api/health";

function statusColor(status: ServiceStatus): string {
  switch (status) {
    case "healthy":
      return "var(--io-success)";
    case "degraded":
      return "var(--io-warning)";
    case "unhealthy":
      return "var(--io-danger)";
    default:
      return "var(--io-text-muted)";
  }
}

function statusLabel(status: ServiceStatus): string {
  switch (status) {
    case "healthy":
      return "Healthy";
    case "degraded":
      return "Degraded";
    case "unhealthy":
      return "Unhealthy";
    default:
      return "Unknown";
  }
}

function StatusBadge({ status }: { status: ServiceStatus }) {
  const color = statusColor(status);
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        fontSize: "12px",
        fontWeight: 500,
        color,
        padding: "3px 8px",
        borderRadius: "12px",
        background: `${color}18`,
        border: `1px solid ${color}40`,
      }}
    >
      <span
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          background: color,
          display: "inline-block",
          flexShrink: 0,
        }}
      />
      {statusLabel(status)}
    </span>
  );
}

function ServiceCard({ service }: { service: ServiceHealth }) {
  return (
    <div
      style={{
        background: "var(--io-surface-secondary)",
        border: "1px solid var(--io-border)",
        borderRadius: "8px",
        padding: "16px 20px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "16px",
      }}
    >
      <div>
        <div
          style={{
            fontSize: "14px",
            fontWeight: 600,
            color: "var(--io-text-primary)",
            marginBottom: "4px",
          }}
        >
          {service.name}
        </div>
        <div style={{ fontSize: "12px", color: "var(--io-text-muted)" }}>
          Port {service.port}
          {service.message && (
            <span
              style={{ marginLeft: "8px", color: "var(--io-text-secondary)" }}
            >
              — {service.message}
            </span>
          )}
        </div>
      </div>
      <StatusBadge status={service.status} />
    </div>
  );
}

export default function HealthPage() {
  const { data, isLoading, error, dataUpdatedAt } = useQuery({
    queryKey: ["service-health"],
    queryFn: fetchServiceHealth,
    refetchInterval: 10_000,
    retry: false,
  });

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString()
    : null;

  const healthyCount = data?.filter((s) => s.status === "healthy").length ?? 0;
  const totalCount = data?.length ?? 0;

  return (
    <div style={{ maxWidth: "700px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: "24px",
          gap: "16px",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2
            style={{
              margin: "0 0 4px",
              fontSize: "18px",
              fontWeight: 600,
              color: "var(--io-text-primary)",
            }}
          >
            System Health
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: "13px",
              color: "var(--io-text-muted)",
            }}
          >
            Service status refreshes every 10 seconds.
            {lastUpdated && ` Last updated at ${lastUpdated}.`}
          </p>
        </div>

        {data && (
          <div
            style={{
              padding: "8px 16px",
              borderRadius: "8px",
              background: "var(--io-surface-secondary)",
              border: "1px solid var(--io-border)",
              fontSize: "13px",
              color: "var(--io-text-secondary)",
              flexShrink: 0,
            }}
          >
            <span style={{ fontWeight: 600, color: "var(--io-text-primary)" }}>
              {healthyCount}/{totalCount}
            </span>{" "}
            services healthy
          </div>
        )}
      </div>

      {isLoading && (
        <div
          style={{
            padding: "32px",
            textAlign: "center",
            color: "var(--io-text-muted)",
            fontSize: "13px",
          }}
        >
          Loading service health...
        </div>
      )}

      {error && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "8px",
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.3)",
            color: "var(--io-danger)",
            fontSize: "13px",
            marginBottom: "16px",
          }}
        >
          Failed to fetch service health. Showing cached/default status.
        </div>
      )}

      {data && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {data.map((service) => (
            <ServiceCard key={service.name} service={service} />
          ))}
        </div>
      )}
    </div>
  );
}
