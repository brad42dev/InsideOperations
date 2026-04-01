// ---------------------------------------------------------------------------
// ChartConfigPanel — full-screen modal for chart configuration
// Orchestrates: ChartTypePicker + ChartPointSelector + ChartOptionsForm
// Rendered as a viewport-level fixed overlay (panes can be very small).
// ---------------------------------------------------------------------------

import { useState, useEffect, useLayoutEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useQueries } from "@tanstack/react-query";
import { pointsApi } from "../../../api/points";
import type { ChartConfig, ChartTypeId } from "./chart-config-types";
import { CHART_SLOTS, SCALING_TAB_CHARTS } from "./chart-config-types";
import ChartTypePicker from "./ChartTypePicker";
import ChartPointSelector from "./ChartPointSelector";
import ChartOptionsForm from "./ChartOptionsForm";
import ChartScalingTab from "./ChartScalingTab";
import {
  CHART_DEFINITIONS,
  type ChartContext,
  type PointTypeCategory,
} from "./chart-definitions";
import SaveChartModal from "./SaveChartModal";

interface ChartConfigPanelProps {
  /** Initial config to populate the panel from */
  initialConfig: ChartConfig;
  onSave: (config: ChartConfig) => void;
  onClose: () => void;
  /** Restricts chart type picker to types available in this context. */
  context?: ChartContext;
  /** Called when the user saves the chart via Save As or Publish. */
  onSaveChart?: (config: ChartConfig, name: string, description: string, publish: boolean) => void;
  /** Whether the current user can publish charts. */
  canPublish?: boolean;
}

type Tab = "type" | "points" | "scaling" | "options";

const BASE_TABS: { id: Tab; label: string }[] = [
  { id: "type", label: "Chart Type" },
  { id: "points", label: "Data Points" },
  { id: "scaling", label: "Scaling" },
  { id: "options", label: "Options" },
];

export default function ChartConfigPanel({
  initialConfig,
  onSave,
  onClose,
  context,
  onSaveChart,
  canPublish,
}: ChartConfigPanelProps) {
  const [config, setConfig] = useState<ChartConfig>(() => ({
    durationMinutes: 60,
    ...initialConfig,
  }));
  const [tab, setTab] = useState<Tab>("type");
  const [saveModal, setSaveModal] = useState<{ publish: boolean } | null>(null);

  // Fetch real point metadata (including eu_range_low/eu_range_high) for all
  // configured points. Only needed for the Scaling tab, but cheap enough to
  // always keep warm. Falls back to slot label if the query hasn't resolved yet.
  const uniquePointIds = [...new Set(config.points.map((p) => p.pointId))];
  const metaQueries = useQueries({
    queries: uniquePointIds.map((id) => ({
      queryKey: ["point-meta", id],
      queryFn: () => pointsApi.getMeta(id),
      staleTime: 5 * 60 * 1000,
    })),
  });

  const pointMeta = new Map(
    config.points.map((p) => {
      const fetched = metaQueries[uniquePointIds.indexOf(p.pointId)]?.data;
      const detail =
        fetched && "success" in fetched && fetched.success
          ? fetched.data
          : null;
      return [
        p.pointId,
        {
          id: p.pointId,
          tagname: detail?.name ?? p.tagname ?? p.label ?? p.pointId,
          display_name: detail?.description ?? p.label ?? null,
          source_id: detail?.source_id ?? "",
          unit: detail?.engineering_unit ?? null,
          data_type: detail?.data_type ?? null,
          eu_range_low: detail?.eu_range_low ?? null,
          eu_range_high: detail?.eu_range_high ?? null,
          point_category: detail?.point_category ?? "analog",
        } as import("../../../api/points").PointMeta,
      ];
    }),
  );

  // Derive the set of point categories from all configured points whose metadata
  // has resolved. Used to dim incompatible chart types in the Chart Type tab.
  const configuredPointTypes: PointTypeCategory[] | undefined = (() => {
    const resolved = config.points
      .map((p) => pointMeta.get(p.pointId)?.point_category)
      .filter((c): c is "analog" | "boolean" | "discrete_enum" => Boolean(c));
    if (resolved.length === 0) return undefined;
    return [...new Set(resolved)] as PointTypeCategory[];
  })();

  // Only show Scaling tab for chart types that have configurable axes
  const TABS = SCALING_TAB_CHARTS.has(config.chartType)
    ? BASE_TABS
    : BASE_TABS.filter((t) => t.id !== "scaling");

  // Measure sidebar width and topbar height live so the panel sits entirely
  // within the workspace area and never overlaps the top console bar.
  const [sidebarWidth, setSidebarWidth] = useState(0);
  const [topbarHeight, setTopbarHeight] = useState(0);
  useLayoutEffect(() => {
    const measure = () => {
      const sidebar = document.querySelector(".sidebar");
      setSidebarWidth(sidebar ? sidebar.getBoundingClientRect().width : 0);
      const header = document.querySelector("header");
      setTopbarHeight(header ? header.getBoundingClientRect().height : 0);
    };
    measure();
    const ro = new ResizeObserver(measure);
    const sidebar = document.querySelector(".sidebar");
    const header = document.querySelector("header");
    if (sidebar) ro.observe(sidebar);
    if (header) ro.observe(header);
    return () => ro.disconnect();
  }, []);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // When chart type changes, reset points that don't have valid roles for the new type
  function handleTypeSelect(type: ChartTypeId) {
    const newSlots = CHART_SLOTS[type];
    const validRoles = new Set(newSlots.map((s) => s.id));
    const newDef = CHART_DEFINITIONS.find((d) => d.id === type);
    const accepted = newDef?.acceptedPointTypes ?? ["any"];
    const filteredPoints = config.points.filter((p) => {
      if (!validRoles.has(p.role)) return false;
      // Clear points whose category is incompatible with the new chart type
      if (accepted.includes("any")) return true;
      const cat = pointMeta.get(p.pointId)?.point_category ?? "analog";
      return accepted.includes(cat as PointTypeCategory);
    });
    setConfig((c) => ({ ...c, chartType: type, points: filteredPoints }));
  }

  function patchConfig(patch: Partial<ChartConfig>) {
    setConfig((c) => ({ ...c, ...patch }));
  }

  const slotDefs = CHART_SLOTS[config.chartType];

  const handleSave = useCallback(() => {
    onSave(config);
    onClose();
  }, [config, onSave, onClose]);

  // Backdrop covers the workspace area only (right of sidebar, below topbar).
  // Panel is 95% of that area so a sliver of the workspace peeks through.
  const gap = "2.5%";

  return createPortal(
    <div
      style={{
        position: "fixed",
        top: topbarHeight,
        left: sidebarWidth,
        right: 0,
        bottom: 0,
        zIndex: 2000,
        background: "rgba(0,0,0,0.55)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={(e) => {
        e.stopPropagation();
        if (e.target === e.currentTarget) onClose();
      }}
      onDoubleClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Panel — 95% of the workspace area, responsive font size */}
      <div
        style={{
          width: `calc(100% - 2 * ${gap})`,
          height: `calc(100% - 2 * ${gap})`,
          display: "flex",
          flexDirection: "column",
          background: "var(--io-surface-elevated)",
          border: "1px solid var(--io-border)",
          borderRadius: 10,
          boxShadow: "0 16px 48px rgba(0,0,0,0.6)",
          overflow: "hidden",
          fontSize: "clamp(12px, 1.3vw, 18px)",
        }}
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 20px",
            height: 52,
            borderBottom: "1px solid var(--io-border)",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontWeight: 600,
              fontSize: 15,
              color: "var(--io-text-primary)",
            }}
          >
            Configure Chart
          </span>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--io-text-muted)",
              fontSize: 20,
              lineHeight: 1,
              padding: "4px 6px",
              borderRadius: 4,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--io-text-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--io-text-muted)";
            }}
          >
            ×
          </button>
        </div>

        {/* ── Tabs ────────────────────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid var(--io-border)",
            background: "var(--io-surface)",
            flexShrink: 0,
          }}
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: "10px 20px",
                background: "none",
                border: "none",
                borderBottom:
                  tab === t.id
                    ? "2px solid var(--io-accent)"
                    : "2px solid transparent",
                color:
                  tab === t.id
                    ? "var(--io-text-primary)"
                    : "var(--io-text-muted)",
                fontWeight: tab === t.id ? 600 : 400,
                fontSize: 13,
                cursor: "pointer",
                marginBottom: -1,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Tab content ─────────────────────────────────────────────── */}
        <div
          style={{
            flex: 1,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {tab === "type" && (
            <div
              style={{
                flex: 1,
                overflow: "hidden",
                padding: 20,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <ChartTypePicker
                selectedType={config.chartType}
                onSelect={handleTypeSelect}
                context={context}
                pointTypes={configuredPointTypes}
              />
            </div>
          )}

          {tab === "points" && (
            <div
              style={{
                flex: 1,
                overflow: "hidden",
                padding: 20,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <ChartPointSelector
                slotDefs={slotDefs}
                points={config.points}
                onChange={(pts) => patchConfig({ points: pts })}
                acceptedPointTypes={
                  CHART_DEFINITIONS.find((d) => d.id === config.chartType)
                    ?.acceptedPointTypes
                }
              />
            </div>
          )}

          {tab === "scaling" && (
            <div
              style={{
                flex: 1,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
                <ChartScalingTab
                  chartType={config.chartType}
                  config={config}
                  points={config.points}
                  pointMeta={pointMeta}
                  onChange={patchConfig}
                />
              </div>
            </div>
          )}

          {tab === "options" && (
            <div
              style={{
                flex: 1,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: 20,
                  maxWidth: 640,
                }}
              >
                <ChartOptionsForm
                  chartType={config.chartType}
                  config={config}
                  onChange={patchConfig}
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 20px",
            borderTop: "1px solid var(--io-border)",
            background: "var(--io-surface)",
            flexShrink: 0,
            gap: 8,
          }}
        >
          {/* Tab navigation shortcuts */}
          <div style={{ display: "flex", gap: 6 }}>
            {TABS.map((t, i) => {
              const isCurrent = tab === t.id;
              if (isCurrent) return null;
              const isPrev = TABS.findIndex((x) => x.id === tab) > i;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  style={{
                    background: "var(--io-surface-secondary)",
                    border: "1px solid var(--io-border)",
                    color: "var(--io-text-muted)",
                    borderRadius: 4,
                    padding: "5px 12px",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  {isPrev ? `← ${t.label}` : `${t.label} →`}
                </button>
              );
            })}
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {onSaveChart && (
              <button
                onClick={() => setSaveModal({ publish: false })}
                title="Save this chart configuration for reuse"
                style={{
                  background: "transparent",
                  border: "1px solid var(--io-border)",
                  color: "var(--io-text-muted)",
                  borderRadius: 6,
                  padding: "7px 14px",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Save As…
              </button>
            )}
            {onSaveChart && canPublish && (
              <button
                onClick={() => setSaveModal({ publish: true })}
                title="Save and publish this chart to all users"
                style={{
                  background: "transparent",
                  border: "1px solid var(--io-border)",
                  color: "var(--io-text-muted)",
                  borderRadius: 6,
                  padding: "7px 14px",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Publish…
              </button>
            )}
            <button
              onClick={onClose}
              style={{
                background: "var(--io-surface-secondary)",
                border: "1px solid var(--io-border)",
                color: "var(--io-text-primary)",
                borderRadius: 6,
                padding: "7px 16px",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              style={{
                background: "var(--io-accent)",
                border: "none",
                color: "#fff",
                borderRadius: 6,
                padding: "7px 20px",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.opacity = "0.9"; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = "1"; }}
            >
              Apply
            </button>
          </div>
          {saveModal && onSaveChart && (
            <SaveChartModal
              publish={saveModal.publish}
              onConfirm={(name, description) => {
                onSaveChart(config, name, description, saveModal.publish);
                setSaveModal(null);
              }}
              onCancel={() => setSaveModal(null)}
            />
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
