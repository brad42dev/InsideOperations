import { useState, useRef } from "react";
import { SettingsTabs } from "../../shared/components/SettingsTabs";
import SettingsPageLayout from "./SettingsPageLayout";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../api/client";
import {
  fetchServiceHealth,
  type ServiceStatus,
  type ServiceHealth,
} from "../../api/health";
import TimeSeriesChart from "../../shared/components/charts/TimeSeriesChart";

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<
  ServiceStatus,
  { bg: string; text: string; label: string }
> = {
  healthy: {
    bg: "color-mix(in srgb, var(--io-success) 12%, transparent)",
    text: "var(--io-success)",
    label: "Ready",
  },
  degraded: {
    bg: "color-mix(in srgb, var(--io-warning) 15%, transparent)",
    text: "var(--io-warning)",
    label: "Degraded",
  },
  unhealthy: {
    bg: "color-mix(in srgb, var(--io-danger) 12%, transparent)",
    text: "var(--io-danger)",
    label: "Not Ready",
  },
  unknown: {
    bg: "var(--io-surface-secondary)",
    text: "var(--io-text-muted)",
    label: "Unknown",
  },
};

function StatusBadge({ status }: { status: ServiceStatus }) {
  const c = STATUS_COLORS[status];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
        fontSize: "12px",
        padding: "3px 10px",
        borderRadius: "100px",
        background: c.bg,
        color: c.text,
        fontWeight: 700,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          background: c.text,
          flexShrink: 0,
        }}
      />
      {c.label}
    </span>
  );
}

// ── Tab component ─────────────────────────────────────────────────────────────

type TabId = "services" | "database" | "opc" | "websocket" | "jobs" | "metrics";

const TABS: { id: TabId; label: string }[] = [
  { id: "services", label: "Services" },
  { id: "database", label: "Database" },
  { id: "opc", label: "OPC Sources" },
  { id: "websocket", label: "WebSocket" },
  { id: "jobs", label: "Jobs" },
  { id: "metrics", label: "Metrics" },
];

// ── API shapes ────────────────────────────────────────────────────────────────

interface ServiceDetail extends ServiceHealth {
  uptime?: string;
  version?: string;
  response_p50?: number;
  response_p95?: number;
  request_rate?: number;
  error_rate?: number;
  checked_at?: string;
}

interface DatabaseHealth {
  services: Array<{
    service: string;
    pool_size: number;
    pool_idle: number;
    pool_used: number;
  }>;
  migration_version?: string;
  db_size_bytes?: number;
  timescaledb_version?: string;
  compression_ratio?: number;
  replication_lag_ms?: number | null;
}

interface OpcSourceStat {
  source_id: string;
  name: string;
  connected: boolean;
  subscribed_points?: number;
  update_rate?: number;
  last_successful_update?: string;
  reconnection_count?: number;
  recent_errors?: string[];
}

interface WebSocketHealth {
  active_connections: number;
  total_subscriptions: number;
  message_rate?: number;
  backpressure_events?: number;
  avg_connection_duration_s?: number;
}

interface JobsHealth {
  email: { pending: number; sent: number; failed: number; retry: number };
  alerts: {
    pending: number;
    dispatched: number;
    acknowledged: number;
    escalated: number;
  };
  exports: {
    active: number;
    queued: number;
    completed: number;
    failed: number;
  };
  imports: {
    running: number;
    scheduled: number;
    completed: number;
    failed: number;
  };
}

interface MetricSample {
  ts: number; // unix seconds
  value: number;
}

// Time range selection
type TimeRange = "1h" | "6h" | "24h" | "7d" | "30d";

const TIME_RANGE_LABELS: Record<TimeRange, string> = {
  "1h": "Last 1h",
  "6h": "Last 6h",
  "24h": "Last 24h",
  "7d": "Last 7d",
  "30d": "Last 30d",
};

// ── Services Tab ──────────────────────────────────────────────────────────────

function ServicesTab() {
  const {
    data: services,
    isLoading,
    dataUpdatedAt,
    refetch,
  } = useQuery({
    queryKey: ["health", "services", "detail"],
    queryFn: async (): Promise<ServiceDetail[]> => {
      // First get basic health
      const base = await fetchServiceHealth();
      // Attempt to get detail metrics — returns base data if endpoint not ready
      const result = await api.get<ServiceDetail[]>(
        "/api/health/services/detail",
      );
      if (result.success && result.data.length > 0) return result.data;
      // Fallback: return base health data shaped as ServiceDetail
      return base.map((s) => ({
        ...s,
        checked_at: new Date().toISOString(),
      }));
    },
    refetchInterval: 15_000,
  });

  const all = services ?? [];
  const lastChecked = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
    : "—";

  const cols = [
    "Service",
    "Status",
    "Uptime",
    "Version",
    "p50 (ms)",
    "p95 (ms)",
    "Req/s",
    "Error %",
    "Last Check",
  ];

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px",
        }}
      >
        <p
          style={{
            margin: 0,
            fontSize: "13px",
            color: "var(--io-text-secondary)",
          }}
        >
          Auto-refreshes every 15 seconds. Last checked: {lastChecked}
        </p>
        <button
          onClick={() => void refetch()}
          style={{
            padding: "4px 12px",
            background: "none",
            border: "1px solid var(--io-border)",
            borderRadius: "6px",
            cursor: "pointer",
            fontSize: "12px",
            color: "var(--io-text-secondary)",
          }}
        >
          Refresh
        </button>
      </div>

      <div
        style={{
          border: "1px solid var(--io-border)",
          borderRadius: "8px",
          overflow: "hidden",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: "12px",
              minWidth: "750px",
            }}
          >
            <thead>
              <tr style={{ background: "var(--io-surface-secondary)" }}>
                {cols.map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "8px 12px",
                      textAlign: "left",
                      fontWeight: 600,
                      color: "var(--io-text-muted)",
                      fontSize: "11px",
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      borderBottom: "1px solid var(--io-border)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td
                    colSpan={cols.length}
                    style={{
                      padding: "24px",
                      textAlign: "center",
                      color: "var(--io-text-muted)",
                    }}
                  >
                    Checking services…
                  </td>
                </tr>
              ) : all.length === 0 ? (
                <tr>
                  <td
                    colSpan={cols.length}
                    style={{
                      padding: "24px",
                      textAlign: "center",
                      color: "var(--io-text-muted)",
                    }}
                  >
                    No services found.
                  </td>
                </tr>
              ) : (
                all.map((svc, i) => (
                  <tr
                    key={svc.name}
                    style={{
                      background:
                        i % 2 === 0
                          ? "transparent"
                          : "var(--io-surface-secondary)",
                      borderTop: "1px solid var(--io-border)",
                    }}
                  >
                    <td
                      style={{
                        padding: "10px 12px",
                        fontWeight: 600,
                        color: "var(--io-text-primary)",
                        fontFamily: "var(--io-font-mono, monospace)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {svc.name}
                    </td>
                    <td style={{ padding: "10px 12px" }}>
                      <StatusBadge status={svc.status} />
                    </td>
                    <td
                      style={{
                        padding: "10px 12px",
                        color: "var(--io-text-secondary)",
                      }}
                    >
                      {svc.uptime ?? "—"}
                    </td>
                    <td
                      style={{
                        padding: "10px 12px",
                        color: "var(--io-text-secondary)",
                        fontFamily: "var(--io-font-mono, monospace)",
                      }}
                    >
                      {svc.version ?? "—"}
                    </td>
                    <td
                      style={{
                        padding: "10px 12px",
                        color: "var(--io-text-secondary)",
                      }}
                    >
                      {svc.response_p50 != null
                        ? svc.response_p50.toFixed(1)
                        : "—"}
                    </td>
                    <td
                      style={{
                        padding: "10px 12px",
                        color: "var(--io-text-secondary)",
                      }}
                    >
                      {svc.response_p95 != null
                        ? svc.response_p95.toFixed(1)
                        : "—"}
                    </td>
                    <td
                      style={{
                        padding: "10px 12px",
                        color: "var(--io-text-secondary)",
                      }}
                    >
                      {svc.request_rate != null
                        ? svc.request_rate.toFixed(1)
                        : "—"}
                    </td>
                    <td
                      style={{
                        padding: "10px 12px",
                        color:
                          svc.error_rate != null && svc.error_rate > 0
                            ? "var(--io-danger)"
                            : "var(--io-text-secondary)",
                      }}
                    >
                      {svc.error_rate != null
                        ? `${svc.error_rate.toFixed(2)}%`
                        : "—"}
                    </td>
                    <td
                      style={{
                        padding: "10px 12px",
                        color: "var(--io-text-muted)",
                        whiteSpace: "nowrap",
                        fontSize: "11px",
                      }}
                    >
                      {svc.checked_at
                        ? new Date(svc.checked_at).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })
                        : "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── Database Tab ──────────────────────────────────────────────────────────────

function DatabaseTab() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["health", "database"],
    queryFn: async (): Promise<DatabaseHealth | null> => {
      const r = await api.get<DatabaseHealth>("/api/health/database");
      return r.success ? r.data : null;
    },
    refetchInterval: 30_000,
  });

  if (isLoading) return <LoadingState message="Loading database health…" />;
  if (error || !data)
    return (
      <EmptyState message="Database health data not available. Endpoint may not be implemented yet." />
    );

  const formatBytes = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024)
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Summary tiles */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
          gap: "12px",
        }}
      >
        {[
          { label: "Migration Version", value: data.migration_version ?? "—" },
          {
            label: "Database Size",
            value:
              data.db_size_bytes != null
                ? formatBytes(data.db_size_bytes)
                : "—",
          },
          { label: "TimescaleDB", value: data.timescaledb_version ?? "—" },
          {
            label: "Compression Ratio",
            value:
              data.compression_ratio != null
                ? `${data.compression_ratio.toFixed(2)}x`
                : "—",
          },
          {
            label: "Replication Lag",
            value:
              data.replication_lag_ms != null
                ? `${data.replication_lag_ms} ms`
                : "N/A",
          },
        ].map((tile) => (
          <div
            key={tile.label}
            style={{
              padding: "14px",
              background: "var(--io-surface-secondary)",
              border: "1px solid var(--io-border)",
              borderRadius: "8px",
            }}
          >
            <div
              style={{
                fontSize: "11px",
                color: "var(--io-text-muted)",
                marginBottom: "6px",
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              {tile.label}
            </div>
            <div
              style={{
                fontSize: "16px",
                fontWeight: 700,
                color: "var(--io-text-primary)",
                fontFamily: "var(--io-font-mono, monospace)",
              }}
            >
              {tile.value}
            </div>
          </div>
        ))}
      </div>

      {/* Connection Pool Table */}
      {data.services && data.services.length > 0 && (
        <div>
          <h3
            style={{
              margin: "0 0 12px",
              fontSize: "14px",
              fontWeight: 700,
              color: "var(--io-text-primary)",
            }}
          >
            Connection Pool Utilization
          </h3>
          <div
            style={{
              border: "1px solid var(--io-border)",
              borderRadius: "8px",
              overflow: "hidden",
            }}
          >
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                fontSize: "12px",
              }}
            >
              <thead>
                <tr style={{ background: "var(--io-surface-secondary)" }}>
                  {["Service", "Pool Size", "Idle", "Used", "Utilization"].map(
                    (h) => (
                      <th
                        key={h}
                        style={{
                          padding: "8px 12px",
                          textAlign: "left",
                          fontWeight: 600,
                          color: "var(--io-text-muted)",
                          fontSize: "11px",
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                          borderBottom: "1px solid var(--io-border)",
                        }}
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {data.services.map((svc, i) => {
                  const utilPct =
                    svc.pool_size > 0
                      ? ((svc.pool_used / svc.pool_size) * 100).toFixed(0)
                      : "0";
                  const utilColor =
                    Number(utilPct) > 80
                      ? "var(--io-danger)"
                      : Number(utilPct) > 60
                        ? "var(--io-warning)"
                        : "var(--io-success)";
                  return (
                    <tr
                      key={svc.service}
                      style={{
                        background:
                          i % 2 === 0
                            ? "transparent"
                            : "var(--io-surface-secondary)",
                        borderTop: "1px solid var(--io-border)",
                      }}
                    >
                      <td
                        style={{
                          padding: "10px 12px",
                          fontFamily: "var(--io-font-mono, monospace)",
                          color: "var(--io-text-primary)",
                          fontWeight: 600,
                        }}
                      >
                        {svc.service}
                      </td>
                      <td
                        style={{
                          padding: "10px 12px",
                          color: "var(--io-text-secondary)",
                        }}
                      >
                        {svc.pool_size}
                      </td>
                      <td
                        style={{
                          padding: "10px 12px",
                          color: "var(--io-text-secondary)",
                        }}
                      >
                        {svc.pool_idle}
                      </td>
                      <td
                        style={{
                          padding: "10px 12px",
                          color: "var(--io-text-secondary)",
                        }}
                      >
                        {svc.pool_used}
                      </td>
                      <td
                        style={{
                          padding: "10px 12px",
                          color: utilColor,
                          fontWeight: 700,
                        }}
                      >
                        {utilPct}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ── OPC Sources Tab ───────────────────────────────────────────────────────────

function OpcSourcesTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["health", "opc-sources"],
    queryFn: async (): Promise<OpcSourceStat[]> => {
      const r = await api.get<OpcSourceStat[]>("/api/opc/sources/stats");
      if (!r.success) return [];
      const d = r.data;
      if (Array.isArray(d)) return d;
      return [];
    },
    refetchInterval: 15_000,
  });

  if (isLoading) return <LoadingState message="Loading OPC source data…" />;
  if (!data || data.length === 0)
    return (
      <EmptyState message="No OPC sources configured or endpoint not available." />
    );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {data.map((src) => (
        <div
          key={src.source_id}
          style={{
            border: "1px solid var(--io-border)",
            borderRadius: "8px",
            overflow: "hidden",
          }}
        >
          {/* Source header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 16px",
              background: "var(--io-surface-secondary)",
              borderBottom: "1px solid var(--io-border)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <span
                style={{
                  display: "inline-block",
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  background: src.connected
                    ? "var(--io-success)"
                    : "var(--io-danger)",
                  boxShadow: src.connected ? "0 0 4px #22c55e" : undefined,
                }}
              />
              <span
                style={{
                  fontWeight: 700,
                  color: "var(--io-text-primary)",
                  fontSize: "14px",
                }}
              >
                {src.name}
              </span>
              <span
                style={{
                  fontSize: "11px",
                  color: "var(--io-text-muted)",
                  fontFamily: "var(--io-font-mono, monospace)",
                }}
              >
                {src.source_id}
              </span>
            </div>
            <StatusBadge status={src.connected ? "healthy" : "unhealthy"} />
          </div>
          {/* Source metrics */}
          <div
            style={{
              padding: "12px 16px",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
              gap: "12px",
            }}
          >
            {[
              {
                label: "Subscribed Points",
                value: src.subscribed_points?.toLocaleString() ?? "—",
              },
              {
                label: "Update Rate",
                value:
                  src.update_rate != null
                    ? `${src.update_rate.toFixed(1)}/s`
                    : "—",
              },
              {
                label: "Last Update",
                value: src.last_successful_update
                  ? new Date(src.last_successful_update).toLocaleTimeString()
                  : "—",
              },
              {
                label: "Reconnections",
                value: src.reconnection_count?.toString() ?? "—",
              },
            ].map((m) => (
              <div key={m.label}>
                <div
                  style={{
                    fontSize: "11px",
                    color: "var(--io-text-muted)",
                    marginBottom: "2px",
                  }}
                >
                  {m.label}
                </div>
                <div
                  style={{
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "var(--io-text-primary)",
                    fontFamily: "var(--io-font-mono, monospace)",
                  }}
                >
                  {m.value}
                </div>
              </div>
            ))}
          </div>
          {/* Error history */}
          {src.recent_errors && src.recent_errors.length > 0 && (
            <div style={{ padding: "0 16px 12px" }}>
              <div
                style={{
                  fontSize: "11px",
                  color: "var(--io-text-muted)",
                  marginBottom: "6px",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                Recent Errors (last {src.recent_errors.length})
              </div>
              <div
                style={{
                  background:
                    "color-mix(in srgb, var(--io-danger) 5%, transparent)",
                  border:
                    "1px solid color-mix(in srgb, var(--io-danger) 15%, transparent)",
                  borderRadius: "6px",
                  padding: "8px 10px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                }}
              >
                {src.recent_errors.map((err, j) => (
                  <div
                    key={j}
                    style={{
                      fontSize: "11px",
                      color: "var(--io-danger)",
                      fontFamily: "var(--io-font-mono, monospace)",
                    }}
                  >
                    {err}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── WebSocket Tab ─────────────────────────────────────────────────────────────

function WebSocketTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["health", "websocket"],
    queryFn: async (): Promise<WebSocketHealth | null> => {
      const r = await api.get<WebSocketHealth>("/api/health/websocket");
      return r.success ? r.data : null;
    },
    refetchInterval: 10_000,
  });

  if (isLoading) return <LoadingState message="Loading WebSocket metrics…" />;
  if (!data)
    return (
      <EmptyState message="WebSocket health data not available. Endpoint may not be implemented yet." />
    );

  const tiles = [
    {
      label: "Active Connections",
      value: data.active_connections?.toLocaleString() ?? "—",
    },
    {
      label: "Total Subscriptions",
      value: data.total_subscriptions?.toLocaleString() ?? "—",
    },
    {
      label: "Message Rate",
      value:
        data.message_rate != null ? `${data.message_rate.toFixed(1)}/s` : "—",
    },
    {
      label: "Backpressure Events",
      value: data.backpressure_events?.toLocaleString() ?? "—",
    },
    {
      label: "Avg Connection Duration",
      value:
        data.avg_connection_duration_s != null
          ? `${data.avg_connection_duration_s.toFixed(0)}s`
          : "—",
    },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
        gap: "12px",
      }}
    >
      {tiles.map((t) => (
        <div
          key={t.label}
          style={{
            padding: "16px",
            background: "var(--io-surface-secondary)",
            border: "1px solid var(--io-border)",
            borderRadius: "8px",
          }}
        >
          <div
            style={{
              fontSize: "11px",
              color: "var(--io-text-muted)",
              marginBottom: "8px",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            {t.label}
          </div>
          <div
            style={{
              fontSize: "22px",
              fontWeight: 800,
              color: "var(--io-text-primary)",
              fontFamily: "var(--io-font-mono, monospace)",
            }}
          >
            {t.value}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Jobs Tab ──────────────────────────────────────────────────────────────────

function JobsTab() {
  const { data, isLoading } = useQuery({
    queryKey: ["health", "jobs"],
    queryFn: async (): Promise<JobsHealth | null> => {
      const r = await api.get<JobsHealth>("/api/health/jobs");
      return r.success ? r.data : null;
    },
    refetchInterval: 30_000,
  });

  if (isLoading) return <LoadingState message="Loading job queue data…" />;
  if (!data)
    return (
      <EmptyState message="Job health data not available. Endpoint may not be implemented yet." />
    );

  function JobSection({
    title,
    rows,
  }: {
    title: string;
    rows: Array<{ label: string; value: number; color?: string }>;
  }) {
    return (
      <div
        style={{
          border: "1px solid var(--io-border)",
          borderRadius: "8px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            padding: "10px 14px",
            background: "var(--io-surface-secondary)",
            borderBottom: "1px solid var(--io-border)",
            fontWeight: 700,
            fontSize: "13px",
            color: "var(--io-text-primary)",
          }}
        >
          {title}
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${rows.length}, 1fr)`,
          }}
        >
          {rows.map((r) => (
            <div
              key={r.label}
              style={{
                padding: "14px",
                textAlign: "center",
                borderRight: "1px solid var(--io-border)",
              }}
            >
              <div
                style={{
                  fontSize: "24px",
                  fontWeight: 800,
                  color: r.color ?? "var(--io-text-primary)",
                }}
              >
                {r.value.toLocaleString()}
              </div>
              <div
                style={{
                  fontSize: "11px",
                  color: "var(--io-text-muted)",
                  marginTop: "4px",
                  textTransform: "uppercase",
                  letterSpacing: "0.03em",
                }}
              >
                {r.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <JobSection
        title="Email"
        rows={[
          {
            label: "Pending",
            value: data.email.pending,
            color: "var(--io-warning)",
          },
          { label: "Sent", value: data.email.sent, color: "var(--io-success)" },
          {
            label: "Failed",
            value: data.email.failed,
            color: "var(--io-danger)",
          },
          { label: "Retry", value: data.email.retry, color: "#fb923c" },
        ]}
      />
      <JobSection
        title="Alerts"
        rows={[
          {
            label: "Pending",
            value: data.alerts.pending,
            color: "var(--io-warning)",
          },
          { label: "Dispatched", value: data.alerts.dispatched },
          {
            label: "Acknowledged",
            value: data.alerts.acknowledged,
            color: "var(--io-success)",
          },
          {
            label: "Escalated",
            value: data.alerts.escalated,
            color: "var(--io-danger)",
          },
        ]}
      />
      <JobSection
        title="Exports"
        rows={[
          {
            label: "Active",
            value: data.exports.active,
            color: "var(--io-accent)",
          },
          {
            label: "Queued",
            value: data.exports.queued,
            color: "var(--io-warning)",
          },
          {
            label: "Completed",
            value: data.exports.completed,
            color: "var(--io-success)",
          },
          {
            label: "Failed",
            value: data.exports.failed,
            color: "var(--io-danger)",
          },
        ]}
      />
      <JobSection
        title="Imports"
        rows={[
          {
            label: "Running",
            value: data.imports.running,
            color: "var(--io-accent)",
          },
          {
            label: "Scheduled",
            value: data.imports.scheduled,
            color: "var(--io-warning)",
          },
          {
            label: "Completed",
            value: data.imports.completed,
            color: "var(--io-success)",
          },
          {
            label: "Failed",
            value: data.imports.failed,
            color: "var(--io-danger)",
          },
        ]}
      />
    </div>
  );
}

// ── Metrics Tab ───────────────────────────────────────────────────────────────

const METRIC_CHARTS: Array<{ metric: string; label: string; unit: string }> = [
  { metric: "io_http_requests_total", label: "Request Rate", unit: "req/s" },
  { metric: "io_http_request_duration_p95", label: "Latency p95", unit: "ms" },
  { metric: "io_http_errors_total", label: "Error Rate", unit: "err/s" },
  {
    metric: "io_ws_active_connections",
    label: "WS Connections",
    unit: "connections",
  },
  { metric: "io_opc_update_rate", label: "OPC Update Rate", unit: "updates/s" },
  { metric: "io_db_pool_utilization", label: "DB Pool Utilization", unit: "%" },
];

function MetricChart({
  metric,
  label,
  unit,
  from,
  to,
}: {
  metric: string;
  label: string;
  unit: string;
  from: number;
  to: number;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["health", "metrics", metric, from, to],
    queryFn: async (): Promise<MetricSample[]> => {
      const r = await api.get<MetricSample[]>(
        `/api/health/metrics?metric=${encodeURIComponent(metric)}&from=${from}&to=${to}`,
      );
      return r.success ? r.data : [];
    },
    refetchInterval: 60_000,
  });

  const containerRef = useRef<HTMLDivElement>(null);

  if (isLoading) {
    return (
      <div
        style={{
          border: "1px solid var(--io-border)",
          borderRadius: "8px",
          padding: "16px",
        }}
      >
        <div
          style={{
            fontSize: "12px",
            fontWeight: 700,
            color: "var(--io-text-primary)",
            marginBottom: "8px",
          }}
        >
          {label}
        </div>
        <div
          style={{
            height: "160px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--io-text-muted)",
            fontSize: "12px",
          }}
        >
          Loading…
        </div>
      </div>
    );
  }

  const samples = data ?? [];
  const timestamps = samples.map((s) => s.ts);
  const values = samples.map((s) => s.value);

  return (
    <div
      ref={containerRef}
      style={{
        border: "1px solid var(--io-border)",
        borderRadius: "8px",
        padding: "16px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: "10px",
        }}
      >
        <span
          style={{
            fontSize: "12px",
            fontWeight: 700,
            color: "var(--io-text-primary)",
          }}
        >
          {label}
        </span>
        <span style={{ fontSize: "11px", color: "var(--io-text-muted)" }}>
          {unit}
        </span>
      </div>
      <TimeSeriesChart
        timestamps={timestamps}
        series={[{ label, data: values, color: "var(--io-accent)" }]}
        height={160}
      />
    </div>
  );
}

function MetricsTab() {
  const [timeRange, setTimeRange] = useState<TimeRange>("1h");

  const now = Math.floor(Date.now() / 1000);
  const rangeSeconds: Record<TimeRange, number> = {
    "1h": 3600,
    "6h": 21600,
    "24h": 86400,
    "7d": 604800,
    "30d": 2592000,
  };
  const from = now - rangeSeconds[timeRange];
  const to = now;

  return (
    <div>
      {/* Time range selector */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          marginBottom: "20px",
        }}
      >
        <span style={{ fontSize: "12px", color: "var(--io-text-muted)" }}>
          Time range:
        </span>
        <div
          style={{
            display: "flex",
            border: "1px solid var(--io-border)",
            borderRadius: "6px",
            overflow: "hidden",
          }}
        >
          {(["1h", "6h", "24h", "7d", "30d"] as TimeRange[]).map((r) => (
            <button
              key={r}
              onClick={() => setTimeRange(r)}
              style={{
                padding: "4px 12px",
                border: "none",
                borderRight:
                  r !== "30d" ? "1px solid var(--io-border)" : "none",
                background:
                  timeRange === r ? "var(--io-accent)" : "transparent",
                color: timeRange === r ? "#fff" : "var(--io-text-secondary)",
                cursor: "pointer",
                fontSize: "12px",
                fontWeight: timeRange === r ? 700 : 400,
              }}
            >
              {TIME_RANGE_LABELS[r]}
            </button>
          ))}
        </div>
      </div>

      {/* Charts grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(380px, 1fr))",
          gap: "16px",
        }}
      >
        {METRIC_CHARTS.map((chart) => (
          <MetricChart
            key={chart.metric}
            metric={chart.metric}
            label={chart.label}
            unit={chart.unit}
            from={from}
            to={to}
          />
        ))}
      </div>

      <p
        style={{
          marginTop: "16px",
          fontSize: "11px",
          color: "var(--io-text-muted)",
        }}
      >
        Uses raw samples for ranges &le;24h, 5-minute aggregates for longer
        ranges. Data sourced from <code>io_metrics.samples</code>.
      </p>
    </div>
  );
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function LoadingState({ message }: { message: string }) {
  return (
    <div
      style={{
        padding: "40px",
        textAlign: "center",
        color: "var(--io-text-muted)",
        fontSize: "14px",
      }}
    >
      {message}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div
      style={{
        padding: "40px",
        textAlign: "center",
        color: "var(--io-text-muted)",
        fontSize: "13px",
        border: "1px dashed var(--io-border)",
        borderRadius: "8px",
      }}
    >
      {message}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function SystemHealth() {
  const [activeTab, setActiveTab] = useState<TabId>("services");

  // Summary stats for the header — use services query
  const { data: services } = useQuery({
    queryKey: ["health", "services"],
    queryFn: fetchServiceHealth,
    refetchInterval: 30_000,
  });

  const all = services ?? [];
  const healthyCnt = all.filter((s) => s.status === "healthy").length;
  const unhealthyCnt = all.filter((s) => s.status === "unhealthy").length;
  const degradedCnt = all.filter((s) => s.status === "degraded").length;

  const overallStatus: ServiceStatus =
    unhealthyCnt > 0
      ? "unhealthy"
      : degradedCnt > 0
        ? "degraded"
        : healthyCnt === all.length && all.length > 0
          ? "healthy"
          : "unknown";

  return (
    <SettingsPageLayout
      title="System Health"
      description="Deep operational visibility across all services and infrastructure."
      variant="list"
      action={<StatusBadge status={overallStatus} />}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        {/* Summary tiles */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "12px",
            maxWidth: "480px",
          }}
        >
          {[
            {
              label: "Healthy",
              count: healthyCnt,
              color: "var(--io-success)",
              bg: "color-mix(in srgb, var(--io-success) 8%, transparent)",
              borderColor:
                "color-mix(in srgb, var(--io-success) 30%, transparent)",
            },
            {
              label: "Degraded",
              count: degradedCnt,
              color: "var(--io-warning)",
              bg: "color-mix(in srgb, var(--io-warning) 8%, transparent)",
              borderColor:
                "color-mix(in srgb, var(--io-warning) 30%, transparent)",
            },
            {
              label: "Unhealthy",
              count: unhealthyCnt,
              color: "var(--io-danger)",
              bg: "color-mix(in srgb, var(--io-danger) 8%, transparent)",
              borderColor:
                "color-mix(in srgb, var(--io-danger) 30%, transparent)",
            },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                padding: "14px",
                background: s.bg,
                border: `1px solid ${s.borderColor}`,
                borderRadius: "8px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  fontSize: "26px",
                  fontWeight: 800,
                  color: s.color,
                  lineHeight: 1,
                }}
              >
                {s.count}
              </div>
              <div
                style={{
                  fontSize: "11px",
                  color: s.color,
                  fontWeight: 600,
                  marginTop: "4px",
                }}
              >
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* Tab navigation */}
        <SettingsTabs
          tabs={TABS}
          activeTab={activeTab}
          onTabChange={(id) => setActiveTab(id as TabId)}
        >
          <div>
            {activeTab === "services" && <ServicesTab />}
            {activeTab === "database" && <DatabaseTab />}
            {activeTab === "opc" && <OpcSourcesTab />}
            {activeTab === "websocket" && <WebSocketTab />}
            {activeTab === "jobs" && <JobsTab />}
            {activeTab === "metrics" && <MetricsTab />}
          </div>
        </SettingsTabs>
      </div>
    </SettingsPageLayout>
  );
}
