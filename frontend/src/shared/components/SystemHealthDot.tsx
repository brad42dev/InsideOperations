import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { wsManager } from "../hooks/useWebSocket";
import type { WsConnectionState } from "../hooks/useWebSocket";
import { usePermission } from "../hooks/usePermission";

type ServiceStatus = "healthy" | "degraded" | "unhealthy" | "unknown";

// ── Dot color states ──────────────────────────────────────────────────────────
// Green  — all services pass + WS connected + at least 1 OPC source active
// Yellow — some services degraded, or WS reconnecting
// Red    — WS disconnected >30s, or all OPC sources offline
// Gray   — unknown / initial

type DotColor = "green" | "yellow" | "red" | "gray";

interface ServiceHealth {
  name: string;
  status: ServiceStatus;
}

// API returns { success: true, data: [{ name: "api-gateway", status: "healthy" }] }
interface HealthResponseItem {
  name: string;
  status: ServiceStatus;
}

const SERVICE_NAMES: { key: string; label: string }[] = [
  { key: "api-gateway", label: "API Gateway" },
  { key: "data-broker", label: "Data Broker" },
  { key: "opc-service", label: "OPC Service" },
  { key: "event-service", label: "Event Service" },
  { key: "parser-service", label: "Parser Service" },
  { key: "archive-service", label: "Archive Service" },
  { key: "import-service", label: "Import Service" },
  { key: "alert-service", label: "Alert Service" },
  { key: "email-service", label: "Email Service" },
  { key: "auth-service", label: "Auth Service" },
  { key: "recognition-service", label: "Recognition Service" },
];

async function fetchHealth(): Promise<ServiceHealth[]> {
  try {
    const token = localStorage.getItem("io_access_token") ?? "";
    const r = await fetch("/api/health/services", {
      signal: AbortSignal.timeout(3000),
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!r.ok) {
      return SERVICE_NAMES.map(({ label }) => ({
        name: label,
        status: "unknown",
      }));
    }
    const body = (await r.json()) as { data?: HealthResponseItem[] };
    const items: HealthResponseItem[] = Array.isArray(body.data)
      ? body.data
      : [];
    const byName = new Map(items.map((i) => [i.name, i.status]));
    return SERVICE_NAMES.map(({ key, label }) => ({
      name: label,
      status: byName.get(key) ?? "unknown",
    }));
  } catch {
    return SERVICE_NAMES.map(({ label }) => ({
      name: label,
      status: "unknown",
    }));
  }
}

// OPC connection + data-flow status from /api/health/opc-status.
// This endpoint requires only a valid JWT (no settings:read permission),
// so it reliably reflects real state for all authenticated users.
interface OpcStatusData {
  sources_active: number;
  sources_total: number;
  all_offline: boolean;
  last_data_at: string | null;
  data_stale: boolean;
}

async function fetchOpcStatus(): Promise<OpcStatusData | null> {
  try {
    const token = localStorage.getItem("io_access_token") ?? "";
    const r = await fetch("/api/health/opc-status", {
      signal: AbortSignal.timeout(3000),
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!r.ok) return null;
    const body = (await r.json()) as { data?: OpcStatusData };
    return body.data ?? null;
  } catch {
    return null;
  }
}

const DOT_COLOR_VALUE: Record<DotColor, string> = {
  green: "#22c55e",
  yellow: "#fbbf24",
  red: "#ef4444",
  gray: "var(--io-text-muted)",
};

// ── Keyframe injection (once) ─────────────────────────────────────────────────
let pulseCssInjected = false;
function ensurePulseKeyframe() {
  if (pulseCssInjected) return;
  pulseCssInjected = true;
  const style = document.createElement("style");
  style.textContent = `
    @keyframes io-dot-pulse {
      0%   { box-shadow: 0 0 0 0 currentColor; }
      40%  { box-shadow: 0 0 0 5px transparent; }
      100% { box-shadow: 0 0 0 0 transparent; }
    }
    .io-dot-pulse-anim {
      animation: io-dot-pulse 600ms ease-out;
    }
  `;
  document.head.appendChild(style);
}

// ── Helper: format seconds-ago ────────────────────────────────────────────────
function secondsAgo(ms: number): string {
  const secs = Math.round((Date.now() - ms) / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  return `${mins}m ago`;
}

// ── Main exported dot component ───────────────────────────────────────────────

/** Aggregate single dot — used in collapsed sidebar or as overflow indicator */
export function SystemHealthDot() {
  ensurePulseKeyframe();

  const { data: services } = useQuery({
    queryKey: ["system-health-dot"],
    queryFn: fetchHealth,
    refetchInterval: 15_000,
    staleTime: 10_000,
  });

  const { data: opcStatus } = useQuery({
    queryKey: ["system-health-opc-status"],
    queryFn: fetchOpcStatus,
    refetchInterval: 15_000,
    staleTime: 10_000,
  });

  const [wsState, setWsState] = useState<WsConnectionState>(
    wsManager.getState(),
  );
  const [disconnectedAt, setDisconnectedAt] = useState<number | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());
  const [open, setOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<HTMLButtonElement>(null);
  const prevColorRef = useRef<DotColor>("gray");
  const [pulsing, setPulsing] = useState(false);
  const canMonitor = usePermission("system:monitor");
  const navigate = useNavigate();

  // Track WS state changes
  useEffect(() => {
    return wsManager.onStateChange((state) => {
      setWsState(state);
      if (state === "connected") {
        setDisconnectedAt(null);
        setLastUpdate(Date.now());
      } else if (state === "disconnected" || state === "error") {
        setDisconnectedAt((prev) => prev ?? Date.now());
      }
    });
  }, []);

  // Update lastUpdate when data refreshes
  useEffect(() => {
    if (services) setLastUpdate(Date.now());
  }, [services]);

  // Compute OPC stats
  const totalOpc = opcStatus?.sources_total ?? 0;
  const activeOpc = opcStatus?.sources_active ?? 0;
  const opcDataStale = opcStatus?.data_stale ?? false;

  // Compute aggregate service status
  let serviceAggregate: ServiceStatus = "unknown";
  if (services) {
    if (services.some((s) => s.status === "unhealthy"))
      serviceAggregate = "unhealthy";
    else if (services.some((s) => s.status === "degraded"))
      serviceAggregate = "degraded";
    else if (services.every((s) => s.status === "healthy"))
      serviceAggregate = "healthy";
    else serviceAggregate = "unknown";
  }

  // Compute dot color:
  // Red    — WS disconnected >30s, all OPC sources offline, or service unhealthy
  // Yellow — degraded services, WS reconnecting, or data flow stale
  // Green  — all pass
  // Gray   — unknown / initial
  let dotColor: DotColor = "gray";
  const wsDisconnectedTooLong =
    disconnectedAt !== null && Date.now() - disconnectedAt > 30_000;
  const allOpcOffline =
    opcStatus?.all_offline ?? (totalOpc > 0 && activeOpc === 0);
  if (
    wsDisconnectedTooLong ||
    allOpcOffline ||
    serviceAggregate === "unhealthy"
  ) {
    dotColor = "red";
  } else if (
    serviceAggregate === "degraded" ||
    wsState === "connecting" ||
    opcDataStale
  ) {
    dotColor = "yellow";
  } else if (serviceAggregate === "healthy" && wsState === "connected") {
    dotColor = "green";
  }

  // Trigger pulse when color changes
  useEffect(() => {
    if (prevColorRef.current !== dotColor) {
      prevColorRef.current = dotColor;
      setPulsing(true);
      const t = setTimeout(() => setPulsing(false), 700);
      return () => clearTimeout(t);
    }
  }, [dotColor]);

  // Close popover on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        dotRef.current &&
        !dotRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const colorValue = DOT_COLOR_VALUE[dotColor];

  const wsLabel =
    wsState === "connected"
      ? "Connected"
      : wsState === "connecting"
        ? "Connecting…"
        : wsState === "disconnected"
          ? "Disconnected"
          : "Error";

  const wsLabelColor =
    wsState === "connected"
      ? "#22c55e"
      : wsState === "connecting"
        ? "#fbbf24"
        : "#ef4444";

  const opcLabel =
    totalOpc === 0
      ? "No sources configured"
      : allOpcOffline
        ? `0/${totalOpc} offline`
        : opcDataStale
          ? `${activeOpc}/${totalOpc} active — data stale`
          : `${activeOpc}/${totalOpc} sources active`;

  const opcLabelColor = allOpcOffline
    ? "#ef4444"
    : opcDataStale || activeOpc < totalOpc
      ? "#fbbf24"
      : "#22c55e";

  const serverLabel =
    serviceAggregate === "healthy"
      ? "Reachable"
      : serviceAggregate === "unknown"
        ? "Unknown"
        : serviceAggregate === "degraded"
          ? "Degraded"
          : "Unreachable";
  const serverColor =
    serviceAggregate === "healthy"
      ? "#22c55e"
      : serviceAggregate === "degraded"
        ? "#fbbf24"
        : serviceAggregate === "unhealthy"
          ? "#ef4444"
          : "var(--io-text-muted)";

  const dotTitle =
    dotColor === "green"
      ? "All services healthy"
      : dotColor === "yellow"
        ? "Some services degraded"
        : dotColor === "red"
          ? "Critical: service offline or WS disconnected"
          : "Health status unknown";

  return (
    <div style={{ position: "relative" }}>
      <button
        ref={dotRef}
        title={dotTitle}
        aria-label={dotTitle}
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "20px",
          height: "20px",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: 0,
          borderRadius: "50%",
          color: colorValue,
        }}
      >
        <span
          className={pulsing ? "io-dot-pulse-anim" : undefined}
          style={{
            display: "block",
            width: "8px",
            height: "8px",
            borderRadius: "50%",
            background: colorValue,
            flexShrink: 0,
            boxShadow: dotColor === "red" ? `0 0 4px ${colorValue}` : undefined,
          }}
        />
      </button>

      {open && (
        <div
          ref={popoverRef}
          style={{
            position: "absolute",
            bottom: "28px",
            left: "50%",
            transform: "translateX(-50%)",
            minWidth: "220px",
            background:
              "var(--io-surface-elevated, var(--io-surface-secondary))",
            border: "1px solid var(--io-border)",
            borderRadius: "8px",
            boxShadow: "0 4px 20px rgba(0,0,0,0.25)",
            zIndex: 9999,
            padding: "12px",
            fontSize: "12px",
          }}
        >
          <div
            style={{
              fontWeight: 700,
              fontSize: "11px",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--io-text-muted)",
              marginBottom: "8px",
            }}
          >
            System Status
          </div>

          {/* WebSocket */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "6px",
            }}
          >
            <span style={{ color: "var(--io-text-secondary)" }}>WebSocket</span>
            <span style={{ color: wsLabelColor, fontWeight: 600 }}>
              {wsLabel}
            </span>
          </div>

          {/* OPC Data */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "6px",
            }}
          >
            <span style={{ color: "var(--io-text-secondary)" }}>OPC Data</span>
            <span style={{ color: opcLabelColor, fontWeight: 600 }}>
              {opcLabel}
            </span>
          </div>

          {/* Server reachability */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "10px",
            }}
          >
            <span style={{ color: "var(--io-text-secondary)" }}>Server</span>
            <span style={{ color: serverColor, fontWeight: 600 }}>
              {serverLabel}
            </span>
          </div>

          {/* Last update */}
          <div
            style={{
              color: "var(--io-text-muted)",
              fontSize: "11px",
              marginBottom: canMonitor ? "10px" : "0",
            }}
          >
            Last update: {secondsAgo(lastUpdate)}
          </div>

          {/* Link to System Health — system:monitor only */}
          {canMonitor && (
            <button
              onClick={() => {
                setOpen(false);
                void navigate("/settings/system-health");
              }}
              style={{
                display: "block",
                width: "100%",
                background: "none",
                border: "1px solid var(--io-border)",
                borderRadius: "5px",
                cursor: "pointer",
                fontSize: "11px",
                color: "var(--io-accent, #4A9EFF)",
                padding: "5px 8px",
                textAlign: "center",
                fontWeight: 600,
              }}
            >
              Open System Health
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Per-service dot row (expanded sidebar) ────────────────────────────────────

const STATUS_COLOR: Record<ServiceStatus, string> = {
  healthy: "var(--io-success)",
  degraded: "var(--io-warning)",
  unhealthy: "var(--io-danger)",
  unknown: "var(--io-text-muted)",
};

/** Expanded row of 11 per-service health dots — used in expanded sidebar footer */
export function SystemHealthDotRow() {
  const { data: services } = useQuery({
    queryKey: ["system-health-dot"],
    queryFn: fetchHealth,
    refetchInterval: 15_000,
    staleTime: 10_000,
  });

  const dots =
    services ??
    SERVICE_NAMES.map(({ label }) => ({
      name: label,
      status: "unknown" as ServiceStatus,
    }));

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "4px",
        flexWrap: "wrap",
      }}
    >
      {dots.map((svc) => (
        <div
          key={svc.name}
          title={`${svc.name}: ${svc.status}`}
          aria-label={`${svc.name}: ${svc.status}`}
          style={{
            width: "7px",
            height: "7px",
            borderRadius: "50%",
            background: STATUS_COLOR[svc.status],
            flexShrink: 0,
            boxShadow:
              svc.status === "unhealthy"
                ? `0 0 3px ${STATUS_COLOR[svc.status]}`
                : undefined,
            cursor: "default",
          }}
        />
      ))}
    </div>
  );
}
