import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../api/client";
import { useWebSocket } from "../../../shared/hooks/useWebSocket";
import type { PaneConfig } from "../types";

// ─── Types ──────────────────────────────────────────────────────────────────

interface AlarmRow {
  id: string;
  priority: "urgent" | "high" | "low" | "diagnostic";
  tag: string;
  message: string;
  time: string;
  state: "active" | "unacknowledged" | "acknowledged";
}

interface ApiAlarm {
  id: string;
  title: string;
  severity: "urgent" | "high" | "low" | "diagnostic" | "info";
  source: string;
  state: string;
  triggered_at: string;
  acknowledged_at?: string | null;
  tag?: string;
  message?: string;
}

// ─── Colors / labels ────────────────────────────────────────────────────────

const PRIORITY_COLOR: Record<AlarmRow["priority"], string> = {
  urgent: "#EF4444",
  high: "#F97316",
  low: "#EAB308",
  diagnostic: "#F4F4F5",
};

const PRIORITY_LABEL: Record<AlarmRow["priority"], string> = {
  urgent: "URGNT",
  high: "HIGH",
  low: "LOW",
  diagnostic: "DIAG",
};

function PriorityBadge({ priority }: { priority: AlarmRow["priority"] }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "1px 6px",
        borderRadius: 4,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.05em",
        background: `${PRIORITY_COLOR[priority]}22`,
        color: PRIORITY_COLOR[priority],
        border: `1px solid ${PRIORITY_COLOR[priority]}44`,
      }}
    >
      {PRIORITY_LABEL[priority]}
    </span>
  );
}

function StateBadge({ state }: { state: AlarmRow["state"] }) {
  const color =
    state === "active"
      ? "#EF4444"
      : state === "unacknowledged"
        ? "#F59E0B"
        : "var(--io-text-muted)";

  return (
    <span
      style={{
        fontSize: 12,
        color,
        fontWeight: state !== "acknowledged" ? 600 : 400,
      }}
    >
      {state === "active"
        ? "Active"
        : state === "unacknowledged"
          ? "Unack"
          : "Acked"}
    </span>
  );
}

// ─── Adapter ────────────────────────────────────────────────────────────────

function toAlarmRow(a: ApiAlarm): AlarmRow {
  const priority: AlarmRow["priority"] =
    a.severity === "info" ? "low" : (a.severity as AlarmRow["priority"]);
  const state: AlarmRow["state"] = a.acknowledged_at
    ? "acknowledged"
    : a.state === "active"
      ? "active"
      : "unacknowledged";
  const ts = new Date(a.triggered_at);
  return {
    id: a.id,
    priority,
    tag: a.tag ?? a.source,
    message: a.message ?? a.title,
    time: ts.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }),
    state,
  };
}

// ─── Component ──────────────────────────────────────────────────────────────

type FilterOption = "all" | "active" | "unacknowledged";

interface AlarmListPaneProps {
  config: PaneConfig;
}

export default function AlarmListPane({ config }: AlarmListPaneProps) {
  const [filter, setFilter] = useState<FilterOption>(
    config.alarmFilter ?? "active",
  );
  const qc = useQueryClient();

  // Subscribe to alarm-related WebSocket messages to trigger refetch
  useWebSocket([]); // establishes WS connection for side-effects

  const { data: alarms = [], isLoading } = useQuery<AlarmRow[]>({
    queryKey: ["console-alarms", filter],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (filter === "active") params["state"] = "active";
      if (filter === "unacknowledged") params["unacknowledged"] = "true";
      const qs = Object.keys(params).length
        ? "?" +
          Object.entries(params)
            .map(([k, v]) => `${k}=${v}`)
            .join("&")
        : "";
      const result = await api.get<{ data: ApiAlarm[] } | ApiAlarm[]>(
        `/api/alarms/active${qs}`,
      );
      if (!result.success) return [];
      const list = Array.isArray(result.data)
        ? result.data
        : ((result.data as { data: ApiAlarm[] }).data ?? []);
      return list.map(toAlarmRow);
    },
    refetchInterval: 15_000,
    staleTime: 10_000,
  });

  const ackMutation = useMutation({
    mutationFn: (alarmId: string) =>
      api.post(`/api/alarms/${alarmId}/acknowledge`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["console-alarms"] }),
  });

  const handleAcknowledge = useCallback(
    (alarmId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      ackMutation.mutate(alarmId);
    },
    [ackMutation],
  );

  const filtered = alarms.filter((a) => {
    if (filter === "all") return true;
    if (filter === "active") return a.state === "active";
    if (filter === "unacknowledged") return a.state === "unacknowledged";
    return true;
  });

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        background: "var(--io-surface)",
        overflow: "hidden",
      }}
    >
      {/* Filter bar */}
      <div
        style={{
          display: "flex",
          gap: 4,
          padding: "6px 10px",
          borderBottom: "1px solid var(--io-border)",
          alignItems: "center",
        }}
      >
        {(["all", "active", "unacknowledged"] as FilterOption[]).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              background: filter === f ? "var(--io-accent)" : "transparent",
              color: filter === f ? "#fff" : "var(--io-text-muted)",
              border: `1px solid ${filter === f ? "var(--io-accent)" : "var(--io-border)"}`,
              borderRadius: 4,
              padding: "3px 10px",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 500,
              textTransform: "capitalize",
            }}
          >
            {f === "unacknowledged"
              ? "Unacked"
              : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
        {isLoading && (
          <span
            style={{
              marginLeft: "auto",
              fontSize: 11,
              color: "var(--io-text-muted)",
            }}
          >
            Loading…
          </span>
        )}
        {!isLoading && (
          <span
            style={{
              marginLeft: "auto",
              fontSize: 11,
              color: "var(--io-text-muted)",
            }}
          >
            {filtered.length} alarm{filtered.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Table header */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "60px 90px 1fr 80px 90px 70px",
          padding: "0 10px",
          height: 32,
          alignItems: "center",
          background: "var(--io-surface-secondary)",
          borderBottom: "1px solid var(--io-border)",
          fontSize: 11,
          fontWeight: 600,
          color: "var(--io-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          flexShrink: 0,
        }}
      >
        <span>Priority</span>
        <span>Tag</span>
        <span>Message</span>
        <span>Time</span>
        <span>State</span>
        <span></span>
      </div>

      {/* Table body */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {!isLoading && filtered.length === 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "100%",
              color: "var(--io-text-muted)",
              fontSize: 13,
            }}
          >
            No alarms matching filter
          </div>
        )}
        {filtered.map((alarm) => (
          <div
            key={alarm.id}
            style={{
              display: "grid",
              gridTemplateColumns: "60px 90px 1fr 80px 90px 70px",
              padding: "0 10px",
              height: 38,
              alignItems: "center",
              borderBottom: "1px solid var(--io-border)",
              fontSize: 12,
              color: "var(--io-text-primary)",
              background:
                alarm.state === "active"
                  ? "rgba(239,68,68,0.04)"
                  : "transparent",
            }}
          >
            <span>
              <PriorityBadge priority={alarm.priority} />
            </span>
            <span style={{ fontFamily: "monospace", fontSize: 12 }}>
              {alarm.tag}
            </span>
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                paddingRight: 8,
              }}
            >
              {alarm.message}
            </span>
            <span
              style={{
                fontFamily: "monospace",
                fontSize: 11,
                color: "var(--io-text-muted)",
              }}
            >
              {alarm.time}
            </span>
            <span>
              <StateBadge state={alarm.state} />
            </span>
            <span>
              {alarm.state !== "acknowledged" && (
                <button
                  onClick={(e) => handleAcknowledge(alarm.id, e)}
                  disabled={ackMutation.isPending}
                  style={{
                    padding: "2px 7px",
                    fontSize: 10,
                    border: "1px solid var(--io-border)",
                    borderRadius: 3,
                    background: "transparent",
                    color: "var(--io-text-muted)",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  Ack
                </button>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
