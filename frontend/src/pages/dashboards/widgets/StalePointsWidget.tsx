import { useQuery } from "@tanstack/react-query";
import { api } from "../../../api/client";
import type { WidgetConfig } from "../../../api/dashboards";

interface StalePointsConfig {
  title?: string;
  threshold_minutes?: number;
}

interface Props {
  config: WidgetConfig;
  variables: Record<string, string[]>;
}

interface StalePoint {
  point_id: string;
  tagname: string;
  display_name?: string | null;
  source_name?: string | null;
  last_update?: string | null;
  minutes_stale?: number;
}

export default function StalePointsWidget({ config }: Props) {
  const cfg = config.config as unknown as StalePointsConfig;
  const thresholdMinutes = cfg.threshold_minutes ?? 5;

  const query = useQuery({
    queryKey: ["stale-points", thresholdMinutes],
    queryFn: async () => {
      const result = await api.get<StalePoint[]>(
        `/api/opc/points/stale?threshold_minutes=${thresholdMinutes}`,
      );
      if (!result.success) throw new Error(result.error.message);
      return result.data;
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
    return <StalePointsFallback thresholdMinutes={thresholdMinutes} />;
  }

  const points = Array.isArray(query.data) ? query.data : [];
  const count = points.length;

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
            fontSize: "40px",
            fontWeight: 700,
            color: "var(--io-alarm-normal)",
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
          Stale Points
        </div>
        <div style={{ fontSize: "10px", color: "var(--io-alarm-normal)" }}>
          All points current (&gt;{thresholdMinutes}m threshold)
        </div>
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
      {/* Count header */}
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: "6px",
          padding: "8px 10px 4px",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: "32px",
            fontWeight: 700,
            color:
              count > 10 ? "var(--io-alarm-high)" : "var(--io-alarm-medium)",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {count}
        </span>
        <span style={{ fontSize: "11px", color: "var(--io-text-muted)" }}>
          stale (&gt;{thresholdMinutes}m)
        </span>
      </div>

      {/* Point list */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {points.slice(0, 20).map((pt) => (
          <div
            key={pt.point_id}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "5px 10px",
              borderBottom: "1px solid var(--io-border)",
              gap: "8px",
            }}
          >
            <span
              style={{
                fontSize: "11px",
                color: "var(--io-text-primary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                flex: 1,
              }}
            >
              {pt.display_name ?? pt.tagname}
            </span>
            {pt.minutes_stale != null && (
              <span
                style={{
                  fontSize: "10px",
                  color: "var(--io-alarm-high)",
                  fontVariantNumeric: "tabular-nums",
                  flexShrink: 0,
                }}
              >
                {Math.round(pt.minutes_stale ?? 0)}m
              </span>
            )}
          </div>
        ))}
        {count > 20 && (
          <div
            style={{
              padding: "6px 10px",
              fontSize: "11px",
              color: "var(--io-text-muted)",
              textAlign: "center",
            }}
          >
            +{count - 20} more
          </div>
        )}
      </div>
    </div>
  );
}

/** Shown when the stale-points endpoint is unavailable */
function StalePointsFallback({
  thresholdMinutes,
}: {
  thresholdMinutes: number;
}) {
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "6px",
        color: "var(--io-text-muted)",
        fontSize: "12px",
      }}
    >
      <span style={{ fontSize: "22px", opacity: 0.4 }}>⏱</span>
      <span>Stale Points (&gt;{thresholdMinutes}m)</span>
      <span style={{ fontSize: "11px" }}>No data available</span>
    </div>
  );
}
