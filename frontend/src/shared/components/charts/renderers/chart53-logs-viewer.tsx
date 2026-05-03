// ---------------------------------------------------------------------------
// Chart 53 — Logs Viewer
// Live-scrolling list of recent alarms or events, sourced from the REST API
// with live invalidation from the shared WebSocket (alarm_created /
// alarm_acknowledged push events). Most-recent-first at the top.
// ---------------------------------------------------------------------------

import { useEffect, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../../api/client";
import { alarmsApi, type AlarmEvent } from "../../../../api/alarms";
import { wsManager } from "../../../hooks/useWebSocket";
import type { ChartConfig } from "../chart-config-types";

interface RendererProps {
  config: ChartConfig;
  bufferKey: string;
}

type AlarmSeverity = "urgent" | "high" | "low" | "diagnostic" | "info";

interface ApiAlarm {
  id: string;
  title: string;
  severity: AlarmSeverity;
  source: string;
  state: string;
  triggered_at: string;
  acknowledged_at?: string | null;
  tag?: string;
  message?: string;
}

interface LogRow {
  id: string;
  ts: number;
  priorityNum: number;
  severityLabel: string;
  message: string;
}

const SEVERITY_PRIORITY: Record<AlarmSeverity, number> = {
  urgent: 1,
  high: 2,
  low: 3,
  diagnostic: 4,
  info: 5,
};

const SEVERITY_LABEL: Record<AlarmSeverity, string> = {
  urgent: "URGNT",
  high: "HIGH",
  low: "LOW",
  diagnostic: "DIAG",
  info: "INFO",
};

function priorityColor(p: number): string {
  if (p === 1) return "var(--io-danger, #EF4444)";
  if (p === 2) return "#F97316";
  if (p === 3) return "#EAB308";
  return "var(--io-text-muted)";
}

function fmtTime(ts: number): string {
  return new Date(ts).toISOString().slice(11, 19);
}

export default function Chart53LogsViewer({ config }: RendererProps) {
  const source =
    (config.extras?.source as "alarms" | "events" | undefined) ?? "alarms";
  const maxRows = (config.extras?.maxRows as number | undefined) ?? 25;
  const filterPriority =
    (config.extras?.filterPriority as number[] | undefined) ?? null;
  const autoScroll = (config.extras?.autoScroll as boolean | undefined) ?? true;

  const containerRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  // Invalidate on live alarm push events (alarms feed only).
  useEffect(() => {
    if (source !== "alarms") return;
    const off1 = wsManager.onAlarmCreated(() => {
      void qc.invalidateQueries({ queryKey: ["chart53-alarms"] });
    });
    const off2 = wsManager.onAlarmAcknowledged(() => {
      void qc.invalidateQueries({ queryKey: ["chart53-alarms"] });
    });
    return () => {
      off1();
      off2();
    };
  }, [source, qc]);

  const alarmsQuery = useQuery<LogRow[]>({
    queryKey: ["chart53-alarms"],
    queryFn: async () => {
      const result = await api.get<{ data: ApiAlarm[] } | ApiAlarm[]>(
        "/api/alarms/active",
      );
      if (!result.success) return [];
      const list: ApiAlarm[] = Array.isArray(result.data)
        ? (result.data as ApiAlarm[])
        : ((result.data as { data: ApiAlarm[] }).data ?? []);
      return list
        .sort(
          (a: ApiAlarm, b: ApiAlarm) =>
            new Date(b.triggered_at).getTime() -
            new Date(a.triggered_at).getTime(),
        )
        .map((a: ApiAlarm) => ({
          id: a.id,
          ts: new Date(a.triggered_at).getTime(),
          priorityNum: SEVERITY_PRIORITY[a.severity] ?? 5,
          severityLabel: SEVERITY_LABEL[a.severity] ?? a.severity.toUpperCase(),
          message: a.message ?? a.title,
        }));
    },
    enabled: source === "alarms",
    refetchInterval: 30_000,
    staleTime: 10_000,
  });

  const eventsQuery = useQuery<LogRow[]>({
    queryKey: ["chart53-events"],
    queryFn: async () => {
      const end = new Date().toISOString();
      const start = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const result = await alarmsApi.getEvents({ start, end, limit: maxRows });
      if (!result.success) return [];
      return result.data.map((e: AlarmEvent) => ({
        id: e.id,
        ts: new Date(e.timestamp).getTime(),
        priorityNum: SEVERITY_PRIORITY[e.priority as AlarmSeverity] ?? 5,
        severityLabel:
          SEVERITY_LABEL[e.priority as AlarmSeverity] ??
          e.priority.toUpperCase(),
        message: e.message,
      }));
    },
    enabled: source === "events",
    refetchInterval: 15_000,
    staleTime: 10_000,
  });

  const rawRows =
    source === "alarms" ? (alarmsQuery.data ?? []) : (eventsQuery.data ?? []);
  const isLoading =
    source === "alarms" ? alarmsQuery.isLoading : eventsQuery.isLoading;

  const rows = rawRows
    .filter((r) => {
      if (!filterPriority || filterPriority.length === 0) return true;
      return filterPriority.includes(r.priorityNum);
    })
    .slice(0, maxRows);

  useEffect(() => {
    if (!autoScroll) return;
    containerRef.current?.scrollTo({ top: 0 });
  }, [rows.length, autoScroll]);

  if (isLoading) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--io-text-muted)",
          fontSize: 12,
        }}
      >
        Loading…
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div
        ref={containerRef}
        data-chart-ready="true"
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--io-text-muted)",
          fontSize: 12,
        }}
      >
        No {source} yet
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      data-chart-ready="true"
      style={{
        flex: 1,
        overflow: "auto",
        fontSize: 11,
        fontFamily: "ui-monospace, Menlo, Consolas, monospace",
        padding: 4,
      }}
    >
      {rows.map((r) => (
        <div
          key={r.id}
          style={{
            display: "grid",
            gridTemplateColumns: "58px 48px 1fr",
            gap: 6,
            padding: "3px 4px",
            borderBottom: "1px solid var(--io-border)",
          }}
        >
          <span style={{ color: "var(--io-text-muted)" }}>{fmtTime(r.ts)}</span>
          <span
            style={{ fontWeight: 600, color: priorityColor(r.priorityNum) }}
          >
            {r.severityLabel}
          </span>
          <span
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              color: "var(--io-text)",
            }}
          >
            {r.message}
          </span>
        </div>
      ))}
    </div>
  );
}
