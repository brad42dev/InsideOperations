import { useQuery } from "@tanstack/react-query";
import { api } from "../../../api/client";
import type { WidgetConfig } from "../../../api/dashboards";

interface OpcSourceStat {
  source_id: string;
  name: string;
  connected: boolean;
  subscribed_points?: number;
  update_rate?: number;
  last_successful_update?: string;
  reconnection_count?: number;
}

interface Props {
  config: WidgetConfig;
  variables: Record<string, string[]>;
}

function ConnectedDot({ connected }: { connected: boolean }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: "8px",
        height: "8px",
        borderRadius: "50%",
        flexShrink: 0,
        background: connected ? "#22c55e" : "#ef4444",
        boxShadow: connected ? "0 0 4px rgba(34,197,94,0.6)" : undefined,
        transition: "background 0.3s",
      }}
      aria-label={connected ? "Connected" : "Disconnected"}
    />
  );
}

export default function OpcStatusWidget({ config: _config }: Props) {
  const query = useQuery({
    queryKey: ["opc-sources-stats"],
    queryFn: async () => {
      const result = await api.get<{ data: OpcSourceStat[] }>(
        "/api/opc/sources/stats",
      );
      if (!result.success) throw new Error(result.error.message);
      return Array.isArray(result.data?.data) ? result.data.data : [];
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

  const sources = query.data ?? [];

  if (sources.length === 0) {
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
          gap: "6px",
        }}
      >
        <span style={{ fontSize: "22px", opacity: 0.4 }}>⬡</span>
        <span>No OPC sources configured</span>
      </div>
    );
  }

  const connectedCount = sources.filter((s) => s.connected).length;

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Summary row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 10px",
          borderBottom: "1px solid var(--io-border)",
          flexShrink: 0,
          background: "var(--io-surface-secondary)",
        }}
      >
        <span
          style={{
            fontSize: "11px",
            color: "var(--io-text-muted)",
            fontWeight: 600,
          }}
        >
          {connectedCount}/{sources.length} connected
        </span>
        <span
          style={{
            fontSize: "11px",
            color:
              connectedCount === sources.length
                ? "var(--io-alarm-normal)"
                : "var(--io-alarm-high)",
            fontWeight: 700,
          }}
        >
          {connectedCount === sources.length ? "OK" : "DEGRADED"}
        </span>
      </div>

      {/* Source rows */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {sources.map((src) => (
          <div
            key={src.source_id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "7px 10px",
              borderBottom: "1px solid var(--io-border)",
            }}
          >
            <ConnectedDot connected={src.connected} />
            <span
              style={{
                flex: 1,
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--io-text-primary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {src.name}
            </span>
            {src.subscribed_points != null && (
              <span
                style={{
                  fontSize: "11px",
                  color: "var(--io-text-muted)",
                  fontVariantNumeric: "tabular-nums",
                  flexShrink: 0,
                }}
              >
                {src.subscribed_points.toLocaleString()} pts
              </span>
            )}
            {src.update_rate != null && (
              <span
                style={{
                  fontSize: "11px",
                  color: "var(--io-text-muted)",
                  fontVariantNumeric: "tabular-nums",
                  flexShrink: 0,
                }}
              >
                {src.update_rate.toFixed(1)}/s
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
