import { useQuery } from "@tanstack/react-query";
import { shiftsApi, type Shift } from "../../../api/shifts";
import type { WidgetConfig } from "../../../api/dashboards";

interface Props {
  config: WidgetConfig;
  variables: Record<string, string[]>;
}

function formatShiftTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatShiftDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

function timeUntil(isoString: string): string {
  const diff = new Date(isoString).getTime() - Date.now();
  if (diff < 0) return "ended";
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m remaining`;
  return `${m}m remaining`;
}

export default function ShiftInfoWidget({ config: _config }: Props) {
  const query = useQuery({
    queryKey: ["shifts-active"],
    queryFn: async () => {
      const result = await shiftsApi.listShifts({ status: "active" });
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    refetchInterval: 60000,
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
            width: "120px",
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
        Failed to load shift data
      </div>
    );
  }

  const shifts: Shift[] = query.data ?? [];
  const activeShift = shifts.length > 0 ? shifts[0] : null;

  if (!activeShift) {
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
        <span style={{ fontSize: "24px", opacity: 0.3 }}>☾</span>
        <span>No active shift</span>
      </div>
    );
  }

  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: "12px",
        gap: "8px",
        overflow: "hidden",
      }}
    >
      {/* Shift name */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <span
          style={{
            display: "inline-block",
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: "#22c55e",
            boxShadow: "0 0 4px rgba(34,197,94,0.6)",
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: "14px",
            fontWeight: 700,
            color: "var(--io-text-primary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {activeShift.name}
        </span>
        {activeShift.crew_name && (
          <span
            style={{
              fontSize: "11px",
              color: "var(--io-text-muted)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            {activeShift.crew_name}
          </span>
        )}
      </div>

      {/* Time window */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "2px",
          fontSize: "12px",
          color: "var(--io-text-secondary)",
        }}
      >
        <span>
          {formatShiftDate(activeShift.start_time)} &nbsp;
          {formatShiftTime(activeShift.start_time)} –{" "}
          {formatShiftTime(activeShift.end_time)}
        </span>
        <span style={{ fontSize: "11px", color: "var(--io-text-muted)" }}>
          {timeUntil(activeShift.end_time)}
        </span>
      </div>

      {/* Handover note */}
      {activeShift.handover_minutes > 0 && (
        <div
          style={{
            fontSize: "11px",
            color: "var(--io-text-muted)",
          }}
        >
          Handover: {activeShift.handover_minutes}m before end
        </div>
      )}

      {/* Notes */}
      {activeShift.notes && (
        <div
          style={{
            fontSize: "11px",
            color: "var(--io-text-secondary)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            marginTop: "auto",
          }}
        >
          {activeShift.notes}
        </div>
      )}
    </div>
  );
}
