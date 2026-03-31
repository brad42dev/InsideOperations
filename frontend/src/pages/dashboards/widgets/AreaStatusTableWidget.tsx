import { useQuery } from "@tanstack/react-query";
import { api } from "../../../api/client";
import type { WidgetConfig } from "../../../api/dashboards";

interface AreaStatusTableConfig {
  title?: string;
  variable?: string;
}

interface ActiveAlarm {
  id: string;
  severity: string;
  source: string;
  state: string;
  acknowledged_at?: string | null;
}

interface AreaRow {
  area: string;
  total: number;
  critical: number;
  high: number;
  medium: number;
  unacked: number;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: "var(--io-alarm-critical)",
  high: "var(--io-alarm-high)",
  medium: "var(--io-alarm-medium)",
  low: "var(--io-info)",
};

function extractArea(source: string): string {
  // source is typically "AREA.UNIT.TAG" — take first segment
  const parts = source.split(".");
  return parts[0] ?? source;
}

interface Props {
  config: WidgetConfig;
  variables: Record<string, string[]>;
}

export default function AreaStatusTableWidget({ config, variables }: Props) {
  const cfg = config.config as unknown as AreaStatusTableConfig;
  const areaFilterVar = cfg.variable;
  const areaFilter = areaFilterVar
    ? (variables[areaFilterVar]?.[0] ?? null)
    : null;

  const query = useQuery({
    queryKey: ["area-status-alarms"],
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
          color: "var(--io-text-muted)",
          fontSize: "12px",
        }}
      >
        Loading...
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

  // Aggregate by area
  const areaMap = new Map<string, AreaRow>();
  for (const alarm of alarms) {
    const area = extractArea(alarm.source);
    if (!areaMap.has(area)) {
      areaMap.set(area, {
        area,
        total: 0,
        critical: 0,
        high: 0,
        medium: 0,
        unacked: 0,
      });
    }
    const row = areaMap.get(area)!;
    row.total++;
    if (alarm.severity === "critical") row.critical++;
    if (alarm.severity === "high") row.high++;
    if (alarm.severity === "medium") row.medium++;
    if (!alarm.acknowledged_at) row.unacked++;
  }

  let rows = Array.from(areaMap.values()).sort(
    (a, b) => b.critical - a.critical || b.high - a.high || b.total - a.total,
  );
  if (areaFilter && areaFilter !== "__all__") {
    rows = rows.filter((r) =>
      r.area.toLowerCase().includes(areaFilter.toLowerCase()),
    );
  }

  if (rows.length === 0) {
    return (
      <div
        style={{
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--io-alarm-normal)",
          fontSize: "12px",
          gap: "6px",
        }}
      >
        <span>✓</span>
        <span>No active alarms{areaFilter ? ` in ${areaFilter}` : ""}</span>
      </div>
    );
  }

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 60px 60px 60px 60px",
          padding: "4px 10px",
          borderBottom: "1px solid var(--io-border)",
          flexShrink: 0,
          background: "var(--io-surface-secondary)",
        }}
      >
        {["Area", "Crit", "High", "Med", "Unack"].map((h) => (
          <span
            key={h}
            style={{
              fontSize: "10px",
              fontWeight: 700,
              color: "var(--io-text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              textAlign: h === "Area" ? "left" : "center",
            }}
          >
            {h}
          </span>
        ))}
      </div>

      {/* Rows */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {rows.map((row) => (
          <div
            key={row.area}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 60px 60px 60px 60px",
              padding: "6px 10px",
              borderBottom: "1px solid var(--io-border)",
              alignItems: "center",
            }}
          >
            <span
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--io-text-primary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {row.area}
            </span>
            {[
              { value: row.critical, color: SEVERITY_COLORS.critical },
              { value: row.high, color: SEVERITY_COLORS.high },
              { value: row.medium, color: SEVERITY_COLORS.medium },
              { value: row.unacked, color: "var(--io-text-secondary)" },
            ].map((cell, i) => (
              <span
                key={i}
                style={{
                  fontSize: "12px",
                  fontWeight: cell.value > 0 ? 700 : 400,
                  color: cell.value > 0 ? cell.color : "var(--io-text-muted)",
                  textAlign: "center",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {cell.value > 0 ? cell.value : "—"}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
