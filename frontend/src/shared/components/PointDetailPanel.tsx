/**
 * PointDetailPanel — floating, draggable, resizable, pinnable, minimizable.
 *
 * Spec: CX-POINT-DETAIL non-negotiables #1, #3, #6
 *   - Floating window (not a modal): draggable, resizable, pinnable, minimizable.
 *   - Session-persisted position and size under key `io-point-detail-{pointId}`.
 *   - Panel data from GET /api/v1/points/:id/detail (single request).
 *   - Alarm Data section: HH/H/L/LL thresholds, alarm count 30d, time in alarm, last 5 alarms.
 *   - Graphics section: clickable links to all graphics containing this point.
 *   - Action buttons: "View in Forensics", "Open Trend".
 *   - Resizable (default 400×600px, min 320×400px).
 *   - Pin toggle, minimize to compact bar, instanceId for multi-instance support.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { pointsApi } from "../../api/points";
import type { PointDetailResponse } from "../../api/points";
import { useWebSocket } from "../hooks/useWebSocket";
import TimeSeriesChart from "./charts/TimeSeriesChart";
import { usePointDetailStore } from "../../store/pointDetailStore";

// ---------------------------------------------------------------------------
// Session storage helpers
// ---------------------------------------------------------------------------

interface PanelState {
  top: number;
  left: number;
  width: number;
  height: number;
  minimized: boolean;
}

function sessionKey(pointId: string): string {
  return `io-point-detail-${pointId}`;
}

function loadPanelState(pointId: string): PanelState | null {
  try {
    const raw = sessionStorage.getItem(sessionKey(pointId));
    if (!raw) return null;
    return JSON.parse(raw) as PanelState;
  } catch {
    return null;
  }
}

function savePanelState(pointId: string, state: PanelState): void {
  try {
    sessionStorage.setItem(sessionKey(pointId), JSON.stringify(state));
  } catch {
    // Ignore quota errors
  }
}

const DEFAULT_WIDTH = 400;
const DEFAULT_HEIGHT = 600;
const MIN_WIDTH = 320;
const MIN_HEIGHT = 400;

function defaultPanelState(anchorPosition?: {
  x: number;
  y: number;
}): PanelState {
  const width = DEFAULT_WIDTH;
  const height = DEFAULT_HEIGHT;
  let left: number;
  let top: number;

  if (anchorPosition) {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    left = anchorPosition.x + 12;
    top = anchorPosition.y - 20;
    if (left + width > vw - 12) left = anchorPosition.x - width - 12;
    if (top + height > vh - 12) top = vh - height - 12;
    if (top < 12) top = 12;
    if (left < 12) left = 12;
  } else {
    left = window.innerWidth - width - 16;
    top = 60;
  }

  return { top, left, width, height, minimized: false };
}

// ---------------------------------------------------------------------------
// Quality badge
// ---------------------------------------------------------------------------

function QualityBadge({ quality }: { quality: string }) {
  const color =
    quality === "good"
      ? "var(--io-status-good, #22c55e)"
      : quality === "bad"
        ? "var(--io-status-bad, #ef4444)"
        : "var(--io-status-uncertain, #f59e0b)";

  return (
    <span
      style={{
        fontSize: "11px",
        fontWeight: 600,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        color,
        background: `color-mix(in srgb, ${color} 15%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 40%, transparent)`,
        borderRadius: "3px",
        padding: "1px 5px",
      }}
    >
      {quality}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Sparkline helper
// ---------------------------------------------------------------------------

function useSparklineData(
  pointId: string | null,
  startTime?: string,
  endTime?: string,
) {
  return useQuery({
    queryKey: ["point-sparkline", pointId, startTime, endTime],
    enabled: pointId !== null,
    queryFn: async () => {
      if (!pointId) return null;
      let start: string;
      let end: string;
      if (startTime && endTime) {
        start = startTime;
        end = endTime;
      } else {
        const now = new Date();
        end = now.toISOString();
        start = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
      }
      const result = await pointsApi.getHistory(pointId, {
        start,
        end,
        limit: 20,
      });
      if (!result.success) return null;
      return result.data;
    },
    staleTime: 30_000,
  });
}

// ---------------------------------------------------------------------------
// Section container — collapsible with loading/error states
// ---------------------------------------------------------------------------

function SectionContainer({
  title,
  isLoading,
  isError,
  onRetry,
  children,
  defaultOpen = true,
}: {
  title: string;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div
      style={{
        marginTop: 10,
        borderTop: "1px solid var(--io-border)",
        paddingTop: 6,
      }}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          width: "100%",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "2px 0",
          color: "var(--io-text-muted)",
          fontSize: "11px",
          fontWeight: 600,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          textAlign: "left",
        }}
        aria-expanded={open}
      >
        <svg
          width="10"
          height="10"
          viewBox="0 0 16 16"
          fill="currentColor"
          style={{
            flexShrink: 0,
            transform: open ? "rotate(90deg)" : "none",
            transition: "transform 0.15s",
          }}
        >
          <path d="M4 1l8 7-8 7V1z" />
        </svg>
        {title}
      </button>

      {open && (
        <div style={{ marginTop: 6 }}>
          {isLoading && (
            <div
              style={{
                fontSize: "12px",
                color: "var(--io-text-muted)",
                padding: "4px 0",
              }}
            >
              Loading...
            </div>
          )}
          {isError && !isLoading && (
            <div
              style={{
                fontSize: "12px",
                color: "var(--io-status-bad, #ef4444)",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              Unable to load
              {onRetry && (
                <button
                  onClick={onRetry}
                  style={{
                    fontSize: "11px",
                    color: "var(--io-accent, #3b82f6)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "0 2px",
                    textDecoration: "underline",
                  }}
                >
                  Retry
                </button>
              )}
            </div>
          )}
          {!isLoading && !isError && children}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Alarm Data section content
// ---------------------------------------------------------------------------

function AlarmDataSection({ pointId }: { pointId: string }) {
  const alarmQuery = useQuery({
    queryKey: ["point-alarm-data", pointId],
    queryFn: async () => {
      const result = await pointsApi.getAlarmData(pointId);
      if (!result.success) throw new Error("Failed to load alarm data");
      return result.data;
    },
    staleTime: 60_000,
    retry: 1,
  });

  return (
    <SectionContainer
      title="Alarm Data"
      isLoading={alarmQuery.isLoading}
      isError={alarmQuery.isError}
      onRetry={() => alarmQuery.refetch()}
    >
      {alarmQuery.data && (
        <>
          {/* Threshold table */}
          <div style={{ marginBottom: 8 }}>
            <table
              style={{
                width: "100%",
                fontSize: "12px",
                borderCollapse: "collapse",
              }}
            >
              <thead>
                <tr>
                  {(["HH", "H", "L", "LL"] as const).map((level) => (
                    <th
                      key={level}
                      style={{
                        textAlign: "right",
                        padding: "2px 4px",
                        color: "var(--io-text-muted)",
                        fontWeight: 600,
                        fontSize: "10px",
                        letterSpacing: "0.04em",
                      }}
                    >
                      {level}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {(["HH", "H", "L", "LL"] as const).map((level) => {
                    const threshold = alarmQuery.data!.thresholds.find(
                      (t) => t.level === level,
                    );
                    return (
                      <td
                        key={level}
                        style={{
                          textAlign: "right",
                          padding: "2px 4px",
                          color: threshold?.enabled
                            ? "var(--io-text-primary)"
                            : "var(--io-text-muted)",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {threshold?.value !== undefined &&
                        threshold?.value !== null
                          ? String(threshold.value)
                          : "—"}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </div>

          {/* Summary stats */}
          <div
            style={{
              display: "flex",
              gap: 12,
              marginBottom: 8,
              fontSize: "12px",
            }}
          >
            <div>
              <div style={{ color: "var(--io-text-muted)", fontSize: "10px" }}>
                Count (30d)
              </div>
              <div style={{ fontWeight: 600, color: "var(--io-text-primary)" }}>
                {alarmQuery.data.alarm_count_30d}
              </div>
            </div>
            <div>
              <div style={{ color: "var(--io-text-muted)", fontSize: "10px" }}>
                Time in alarm
              </div>
              <div style={{ fontWeight: 600, color: "var(--io-text-primary)" }}>
                {alarmQuery.data.time_in_alarm_minutes >= 60
                  ? `${Math.round(alarmQuery.data.time_in_alarm_minutes / 60)}h`
                  : `${alarmQuery.data.time_in_alarm_minutes}m`}
              </div>
            </div>
          </div>

          {/* Last 5 alarm events */}
          {alarmQuery.data.last_alarms.length > 0 && (
            <div>
              <div
                style={{
                  fontSize: "10px",
                  color: "var(--io-text-muted)",
                  marginBottom: 4,
                }}
              >
                Recent alarms
              </div>
              {alarmQuery.data.last_alarms.map((event) => (
                <div
                  key={event.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    padding: "3px 0",
                    borderBottom: "1px solid var(--io-border)",
                    fontSize: "11px",
                  }}
                >
                  <div>
                    <div
                      style={{
                        color: "var(--io-text-primary)",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {event.value !== null ? String(event.value) : "—"}
                    </div>
                    <div
                      style={{
                        color: "var(--io-text-muted)",
                        fontSize: "10px",
                      }}
                    >
                      {new Date(event.timestamp).toLocaleString()}
                    </div>
                  </div>
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 600,
                      letterSpacing: "0.03em",
                      textTransform: "uppercase",
                      color:
                        event.priority === "critical" ||
                        event.priority === "high"
                          ? "var(--io-status-bad, #ef4444)"
                          : "var(--io-status-uncertain, #f59e0b)",
                    }}
                  >
                    {event.priority}
                  </span>
                </div>
              ))}
            </div>
          )}

          {alarmQuery.data.last_alarms.length === 0 && (
            <div style={{ fontSize: "12px", color: "var(--io-text-muted)" }}>
              No recent alarms
            </div>
          )}
        </>
      )}
    </SectionContainer>
  );
}

// ---------------------------------------------------------------------------
// Graphics section content
// ---------------------------------------------------------------------------

function GraphicsSection({ pointId }: { pointId: string }) {
  const navigate = useNavigate();

  const graphicsQuery = useQuery({
    queryKey: ["point-linked-graphics", pointId],
    queryFn: async () => {
      const result = await pointsApi.getLinkedGraphics(pointId);
      if (!result.success) throw new Error("Failed to load linked graphics");
      return result.data;
    },
    staleTime: 120_000,
    retry: 1,
  });

  return (
    <SectionContainer
      title="Graphics"
      isLoading={graphicsQuery.isLoading}
      isError={graphicsQuery.isError}
      onRetry={() => graphicsQuery.refetch()}
    >
      {graphicsQuery.data && graphicsQuery.data.length === 0 && (
        <div style={{ fontSize: "12px", color: "var(--io-text-muted)" }}>
          No graphics contain this point
        </div>
      )}
      {graphicsQuery.data && graphicsQuery.data.length > 0 && (
        <div>
          {graphicsQuery.data.map((graphic) => (
            <button
              key={graphic.id}
              onClick={() => navigate(graphic.route)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "4px 0",
                fontSize: "12px",
                color: "var(--io-accent, #3b82f6)",
                textDecoration: "none",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={graphic.name}
            >
              {graphic.name}
            </button>
          ))}
        </div>
      )}
    </SectionContainer>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface PointDetailPanelProps {
  pointId: string | null;
  onClose?: () => void;
  anchorPosition?: { x: number; y: number };
  /**
   * When true, the panel is rendered at the shell level (App.tsx) so it
   * survives navigation. When false, the panel is local to the current view.
   */
  isPinned?: boolean;
  /**
   * Stable panel ID used to identify this instance in the pin store.
   * Required when isPinned=true.
   */
  panelId?: string;
  /**
   * Unique instance ID for multi-instance support (up to 3 concurrent panels).
   * Parent manages an array of { instanceId, pointId } entries.
   */
  instanceId?: string;
  /**
   * When true, renders inline (no floating/draggable behaviour) suitable for
   * embedding inside evidence cards or other container layouts.
   */
  inline?: boolean;
  /**
   * Start of the time window to scope historical data queries.
   * When provided together with endTime, overrides the default "last hour" range.
   */
  startTime?: string;
  /**
   * End of the time window to scope historical data queries.
   * When provided together with startTime, overrides the default "last hour" range.
   */
  endTime?: string;
}

// ---------------------------------------------------------------------------
// Header icon button
// ---------------------------------------------------------------------------

function IconButton({
  onClick,
  title,
  active,
  children,
}: {
  onClick: () => void;
  title: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={active}
      style={{
        background: active ? "var(--io-accent, #3b82f6)" : "none",
        border: "none",
        color: active ? "#fff" : "var(--io-text-muted)",
        cursor: "pointer",
        fontSize: "13px",
        lineHeight: 1,
        padding: "3px 5px",
        borderRadius: "4px",
        flexShrink: 0,
        transition: "background 0.15s",
      }}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Panel
// ---------------------------------------------------------------------------

export default function PointDetailPanel({
  pointId,
  onClose,
  anchorPosition,
  isPinned = false,
  panelId,
  instanceId: _instanceId,
  inline = false,
  startTime,
  endTime,
}: PointDetailPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const { pinPanel, unpinPanel } = usePointDetailStore();
  const navigate = useNavigate();

  // ── Panel state (position, size, minimized) — session-persisted ──────────

  const [panelState, setPanelStateRaw] = useState<PanelState>(() => {
    if (!pointId) return defaultPanelState(anchorPosition);
    return loadPanelState(pointId) ?? defaultPanelState(anchorPosition);
  });

  const setPanelState = useCallback(
    (updater: PanelState | ((prev: PanelState) => PanelState)) => {
      setPanelStateRaw((prev) => {
        const next = typeof updater === "function" ? updater(prev) : updater;
        if (pointId) savePanelState(pointId, next);
        return next;
      });
    },
    [pointId],
  );

  // When a new pointId opens (and no session state), position near anchor
  useEffect(() => {
    if (!pointId) return;
    const saved = loadPanelState(pointId);
    if (!saved) {
      setPanelState(defaultPanelState(anchorPosition));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointId]);

  // ── Drag ─────────────────────────────────────────────────────────────────

  const dragState = useRef<{
    startMouseX: number;
    startMouseY: number;
    startTop: number;
    startLeft: number;
  } | null>(null);

  function handleHeaderMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    // Ignore clicks on buttons inside the header
    if ((e.target as HTMLElement).closest("button")) return;
    e.preventDefault();
    dragState.current = {
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startTop: panelState.top,
      startLeft: panelState.left,
    };

    function onMove(ev: MouseEvent) {
      if (!dragState.current) return;
      const dx = ev.clientX - dragState.current.startMouseX;
      const dy = ev.clientY - dragState.current.startMouseY;
      setPanelState((prev) => ({
        ...prev,
        top: dragState.current!.startTop + dy,
        left: dragState.current!.startLeft + dx,
      }));
    }

    function onUp() {
      dragState.current = null;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    }

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  // ── Resize via ResizeObserver (CSS resize: both) ─────────────────────────

  useEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width > 0 && height > 0) {
          setPanelState((prev) => ({
            ...prev,
            width: Math.max(MIN_WIDTH, Math.round(width)),
            height: Math.max(MIN_HEIGHT, Math.round(height)),
          }));
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [setPanelState]);

  // ── Minimize ─────────────────────────────────────────────────────────────

  function toggleMinimize() {
    setPanelState((prev) => ({ ...prev, minimized: !prev.minimized }));
  }

  // ── Pin / Unpin ───────────────────────────────────────────────────────────

  function handlePinToggle() {
    if (!pointId) return;
    if (isPinned && panelId) {
      // Unpin: remove from shell store, also close the local panel
      unpinPanel(panelId);
      onClose?.();
    } else {
      // Pin: add to shell store. The shell will render this panel; the local
      // instance (inside GraphicPane) should close.
      const id = panelId ?? crypto.randomUUID();
      pinPanel({ id, pointId, anchorPosition });
      onClose?.();
    }
  }

  // ── Dismiss on Escape — only in floating mode ─────────────────────────────

  useEffect(() => {
    if (!pointId || inline) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [pointId, onClose, inline]);

  // ── Data fetching — single /detail endpoint, fallback to getMeta+getLatest ─

  const detailQuery = useQuery({
    queryKey: ["point-detail", pointId, startTime, endTime],
    enabled: pointId !== null,
    queryFn: async () => {
      if (!pointId) return null;
      // When time range is provided (inline/evidence mode), scope the detail query
      const url =
        startTime && endTime
          ? `/api/v1/points/${encodeURIComponent(pointId)}/detail?start=${encodeURIComponent(startTime)}&end=${encodeURIComponent(endTime)}`
          : `/api/v1/points/${encodeURIComponent(pointId)}/detail`;
      const result = await api.get<PointDetailResponse>(url);
      if (!result.success) return null;
      return result.data;
    },
    staleTime: 5_000,
  });

  // Fallback: if /detail endpoint not yet implemented (404 / error), use getMeta
  const metaFallbackQuery = useQuery({
    queryKey: ["point-meta", pointId],
    enabled: pointId !== null && detailQuery.isError,
    queryFn: async () => {
      if (!pointId) return null;
      const result = await pointsApi.getMeta(pointId);
      if (!result.success) return null;
      return result.data;
    },
    staleTime: 60_000,
  });

  const latestFallbackQuery = useQuery({
    queryKey: ["point-latest", pointId],
    enabled: pointId !== null && detailQuery.isError,
    queryFn: async () => {
      if (!pointId) return null;
      const result = await pointsApi.getLatest(pointId);
      if (!result.success) return null;
      return result.data;
    },
    staleTime: 5_000,
  });

  // Live value via WebSocket
  const pointIds = pointId ? [pointId] : [];
  const { values: wsValues } = useWebSocket(pointIds);
  const liveValue = pointId ? wsValues.get(pointId) : undefined;

  // Sparkline data — scoped to startTime/endTime if provided (inline evidence mode)
  const sparkQuery = useSparklineData(pointId, startTime, endTime);

  // Resolve displayed data: prefer /detail, fall back to getMeta+getLatest
  const meta = detailQuery.data ?? metaFallbackQuery.data;
  const latestFromDetail = detailQuery.data?.latest;
  const latestFromFallback = latestFallbackQuery.data;

  const displayValue =
    liveValue ??
    (latestFromDetail
      ? {
          value: latestFromDetail.value,
          quality: latestFromDetail.quality,
          timestamp: latestFromDetail.timestamp,
        }
      : latestFromFallback);

  const displayTimestamp = displayValue?.timestamp
    ? new Date(displayValue.timestamp).toLocaleTimeString()
    : null;

  // Sparkline arrays
  const sparkTimestamps: number[] = [];
  const sparkValues: number[] = [];
  if (sparkQuery.data) {
    for (const entry of sparkQuery.data) {
      const t = new Date(entry.time).getTime() / 1000;
      sparkTimestamps.push(t);
      sparkValues.push(entry.value);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (!pointId) return null;

  // Shared body content (used in both inline and floating modes)
  const sparkLabel =
    startTime && endTime
      ? `${new Date(startTime).toLocaleDateString()} – ${new Date(endTime).toLocaleDateString()}`
      : "Last Hour";

  const panelBody = (
    <div style={{ padding: "12px 14px", overflowY: "auto", flex: 1 }}>
      {/* Current / historical value */}
      <div style={{ marginBottom: 12 }}>
        <div
          style={{
            fontSize: "11px",
            color: "var(--io-text-muted)",
            marginBottom: 4,
          }}
        >
          {startTime && endTime ? "Value at Window Start" : "Current Value"}
        </div>
        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
          <span
            style={{
              fontSize: "28px",
              fontWeight: 700,
              color: "var(--io-text-primary)",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {displayValue?.value !== undefined
              ? String(displayValue.value)
              : "—"}
          </span>
          {(meta as { engineering_unit?: string | null } | null | undefined)
            ?.engineering_unit && (
            <span style={{ fontSize: "14px", color: "var(--io-text-muted)" }}>
              {(meta as { engineering_unit?: string | null }).engineering_unit}
            </span>
          )}
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginTop: 4,
          }}
        >
          {displayValue?.quality && (
            <QualityBadge quality={displayValue.quality} />
          )}
          {displayTimestamp && (
            <span style={{ fontSize: "11px", color: "var(--io-text-muted)" }}>
              {displayTimestamp}
            </span>
          )}
        </div>
      </div>

      {/* Description */}
      {(meta as { description?: string | null } | null | undefined)
        ?.description && (
        <div style={{ marginBottom: 12 }}>
          <div
            style={{
              fontSize: "11px",
              color: "var(--io-text-muted)",
              marginBottom: 2,
            }}
          >
            Description
          </div>
          <div
            style={{
              fontSize: "12px",
              color: "var(--io-text-secondary, var(--io-text-primary))",
            }}
          >
            {(meta as { description?: string | null }).description}
          </div>
        </div>
      )}

      {/* Sparkline / trend */}
      <div style={{ marginTop: 8 }}>
        <div
          style={{
            fontSize: "11px",
            color: "var(--io-text-muted)",
            marginBottom: 4,
          }}
        >
          {sparkLabel}
        </div>
        <TimeSeriesChart
          timestamps={sparkTimestamps}
          series={
            sparkTimestamps.length > 0
              ? [
                  {
                    label:
                      (meta as { name?: string } | null | undefined)?.name ??
                      pointId,
                    data: sparkValues,
                  },
                ]
              : []
          }
          height={80}
        />
      </div>

      {/* Alarm Data section */}
      <AlarmDataSection pointId={pointId} />

      {/* Graphics section */}
      <GraphicsSection pointId={pointId} />

      {/* Action buttons */}
      <div
        style={{
          display: "flex",
          gap: 8,
          marginTop: 12,
          paddingTop: 10,
          borderTop: "1px solid var(--io-border)",
        }}
      >
        <button
          onClick={() =>
            navigate(`/forensics?point=${encodeURIComponent(pointId)}`)
          }
          style={{
            flex: 1,
            padding: "6px 8px",
            fontSize: "12px",
            fontWeight: 500,
            background: "var(--io-surface-secondary)",
            border: "1px solid var(--io-border)",
            borderRadius: "5px",
            color: "var(--io-text-primary)",
            cursor: "pointer",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
          title="Open this point in Forensics for historical analysis"
        >
          View in Forensics
        </button>
        <button
          onClick={() =>
            navigate(`/console?trend=${encodeURIComponent(pointId)}`)
          }
          style={{
            flex: 1,
            padding: "6px 8px",
            fontSize: "12px",
            fontWeight: 500,
            background: "var(--io-accent, #3b82f6)",
            border: "none",
            borderRadius: "5px",
            color: "#fff",
            cursor: "pointer",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
          title="Open trend for this point"
        >
          Open Trend
        </button>
      </div>

      {/* Point ID footer */}
      <div
        style={{
          marginTop: 10,
          paddingTop: 8,
          borderTop: "1px solid var(--io-border)",
          fontSize: "10px",
          color: "var(--io-text-muted)",
          fontFamily: "monospace",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {pointId}
      </div>
    </div>
  );

  // ── Inline mode: render flat inside the parent container ─────────────────

  if (inline) {
    const inlineMeta = meta as
      | { name?: string; source_name?: string }
      | null
      | undefined;
    return (
      <div style={{ display: "flex", flexDirection: "column" }}>
        {/* Inline header: point name + source */}
        <div style={{ marginBottom: 8 }}>
          <div
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: "var(--io-text-primary)",
            }}
          >
            {inlineMeta?.name ?? pointId}
          </div>
          {inlineMeta?.source_name && (
            <div
              style={{
                fontSize: "11px",
                color: "var(--io-text-muted)",
                marginTop: 2,
              }}
            >
              {inlineMeta.source_name}
            </div>
          )}
        </div>
        {panelBody}
      </div>
    );
  }

  // ── Floating mode: draggable, resizable, pinnable ─────────────────────────

  const { top, left, width, height, minimized } = panelState;

  return (
    <div
      ref={panelRef}
      style={{
        position: "fixed",
        top,
        left,
        width: minimized ? width : width,
        height: minimized ? "auto" : height,
        minWidth: MIN_WIDTH,
        minHeight: minimized ? "auto" : MIN_HEIGHT,
        // CSS resize: both — browser draws resize handles on all edges/corners
        resize: minimized ? "none" : "both",
        overflow: "hidden",
        zIndex: 2000,
        background: "var(--io-surface-elevated)",
        border: "1px solid var(--io-border)",
        borderRadius: "8px",
        boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header — drag handle */}
      <div
        onMouseDown={handleHeaderMouseDown}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 10px",
          borderBottom: minimized ? "none" : "1px solid var(--io-border)",
          background: "var(--io-surface-secondary)",
          cursor: "move",
          userSelect: "none",
          flexShrink: 0,
          gap: 6,
        }}
      >
        {/* Title area */}
        <div style={{ overflow: "hidden", flex: 1 }}>
          <div
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: "var(--io-text-primary)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {(meta as { name?: string } | null | undefined)?.name ?? pointId}
          </div>
          {!minimized &&
            (meta as { source_name?: string } | null | undefined)
              ?.source_name && (
              <div
                style={{
                  fontSize: "11px",
                  color: "var(--io-text-muted)",
                  marginTop: 1,
                }}
              >
                {(meta as { source_name?: string }).source_name}
              </div>
            )}
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          {/* Pin button */}
          <IconButton
            onClick={handlePinToggle}
            title={
              isPinned
                ? "Unpin panel (will close on navigation)"
                : "Pin panel (keep open during navigation)"
            }
            active={isPinned}
          >
            {/* Pin icon: simple SVG */}
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              {isPinned ? (
                // Filled pin = pinned
                <path d="M9.828.722a.5.5 0 0 1 .354.146l4.95 4.95a.5.5 0 0 1 0 .707c-.48.48-1.072.588-1.503.588-.177 0-.335-.018-.46-.039l-3.134 3.134a5.927 5.927 0 0 1 .16 1.013c.046.702-.032 1.687-.72 2.375a.5.5 0 0 1-.707 0l-2.829-2.828-3.182 3.182c-.195.195-1.219.902-1.414.707-.195-.195.512-1.22.707-1.414l3.182-3.182-2.828-2.829a.5.5 0 0 1 0-.707c.688-.688 1.673-.767 2.375-.72a5.922 5.922 0 0 1 1.013.16l3.134-3.133a2.772 2.772 0 0 1-.04-.461c0-.43.108-1.022.589-1.503a.5.5 0 0 1 .353-.146z" />
              ) : (
                // Outline pin = unpinned
                <path d="M9.828.722a.5.5 0 0 1 .354.146l4.95 4.95a.5.5 0 0 1 0 .707c-.48.48-1.072.588-1.503.588-.177 0-.335-.018-.46-.039l-3.134 3.134a5.927 5.927 0 0 1 .16 1.013c.046.702-.032 1.687-.72 2.375a.5.5 0 0 1-.707 0l-2.829-2.828-3.182 3.182c-.195.195-1.219.902-1.414.707-.195.195.512-1.22.707-1.414l3.182-3.182-2.828-2.829a.5.5 0 0 1 0-.707c.688-.688 1.673-.767 2.375-.72a5.922 5.922 0 0 1 1.013.16l3.134-3.133a2.772 2.772 0 0 1-.04-.461c0-.43.108-1.022.589-1.503a.5.5 0 0 1 .353-.146zm.122 2.073-.799.8 1.323 1.323.8-.799c.428-.429.745-.8.484-1.06L10.011 2.3c-.26-.26-.63.057-1.06.495zm-1.428 1.851L5.477 7.692c-.38.38-.69.81-.894 1.26l2.464 2.464c.45-.204.881-.514 1.26-.894l3.045-3.045-2.83-2.831zM6.585 9.4l-1.1 1.1-2.01 2.01L5 14.046l2.01-2.01 1.1-1.1L6.585 9.4z" />
              )}
            </svg>
          </IconButton>

          {/* Minimize button */}
          <IconButton
            onClick={toggleMinimize}
            title={minimized ? "Restore panel" : "Minimize panel"}
          >
            {minimized ? (
              // Maximize / restore icon
              <svg
                width="12"
                height="12"
                viewBox="0 0 16 16"
                fill="currentColor"
              >
                <path d="M1.5 1h13A1.5 1.5 0 0 1 16 2.5v11A1.5 1.5 0 0 1 14.5 15h-13A1.5 1.5 0 0 1 0 13.5v-11A1.5 1.5 0 0 1 1.5 1zm13 1h-13a.5.5 0 0 0-.5.5v11a.5.5 0 0 0 .5.5h13a.5.5 0 0 0 .5-.5v-11a.5.5 0 0 0-.5-.5z" />
              </svg>
            ) : (
              // Minimize (dash) icon
              <svg
                width="12"
                height="12"
                viewBox="0 0 16 16"
                fill="currentColor"
              >
                <path d="M2 8a.5.5 0 0 1 .5-.5h11a.5.5 0 0 1 0 1h-11A.5.5 0 0 1 2 8z" />
              </svg>
            )}
          </IconButton>

          {/* Close button */}
          <IconButton onClick={() => onClose?.()} title="Close">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4.646 4.646a.5.5 0 0 1 .708 0L8 7.293l2.646-2.647a.5.5 0 0 1 .708.708L8.707 8l2.647 2.646a.5.5 0 0 1-.708.708L8 8.707l-2.646 2.647a.5.5 0 0 1-.708-.708L7.293 8 4.646 5.354a.5.5 0 0 1 0-.708z" />
            </svg>
          </IconButton>
        </div>
      </div>

      {/* Body — hidden when minimized */}
      {!minimized && panelBody}
    </div>
  );
}
