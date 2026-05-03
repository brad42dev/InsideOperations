// ---------------------------------------------------------------------------
// ChartConfigPanel — chart configuration UI
// Two modes:
//   "modal" (default) — full-screen fixed overlay via createPortal
//   "embedded" — inline, no chrome, for Designer right panel
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
import { makeDefaultChartConfig } from "./chart-defaults";

// ---------------------------------------------------------------------------
// migrateConfigToType — carry compatible fields when switching chart type
// ---------------------------------------------------------------------------

function migrateConfigToType(
  prev: ChartConfig,
  newType: ChartTypeId,
): ChartConfig {
  const fresh = makeDefaultChartConfig(newType);
  const newSlots = CHART_SLOTS[newType] ?? [];
  const validRoles = new Set(newSlots.map((s) => s.id));
  const compatPoints = prev.points.filter((p) => validRoles.has(p.role));
  return {
    ...fresh,
    points: compatPoints,
    legend: prev.legend ?? fresh.legend,
    scaling: {
      ...fresh.scaling,
      ...prev.scaling,
      type: prev.scaling?.type ?? "auto",
    },
    durationMinutes: prev.durationMinutes ?? fresh.durationMinutes,
    aggregateType: prev.aggregateType,
    aggregateSize: prev.aggregateSize,
    aggregateSizeUnit: prev.aggregateSizeUnit,
  };
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ChartConfigPanelModalProps {
  mode?: "modal";
  initialConfig: ChartConfig;
  onSave: (config: ChartConfig) => void;
  onClose: () => void;
  context?: ChartContext;
  onSaveChart?: (
    config: ChartConfig,
    name: string,
    description: string,
    publish: boolean,
  ) => void;
  canPublish?: boolean;
}

interface ChartConfigPanelEmbeddedProps {
  mode: "embedded";
  value: ChartConfig;
  onChange: (next: ChartConfig) => void;
  context?: ChartContext;
}

type ChartConfigPanelProps =
  | ChartConfigPanelModalProps
  | ChartConfigPanelEmbeddedProps;

type Tab = "type" | "points" | "scaling" | "options";

const BASE_TABS: { id: Tab; label: string }[] = [
  { id: "type", label: "Chart Type" },
  { id: "points", label: "Data Points" },
  { id: "scaling", label: "Scaling" },
  { id: "options", label: "Options" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ChartConfigPanel(props: ChartConfigPanelProps) {
  const isEmbedded = props.mode === "embedded";

  // Internal config state. In embedded mode this is semi-controlled — initialized
  // from props.value (via key={node.id} in the parent) and kept in sync on every
  // change via setConfigAndNotify. The parent debounces onChange into undo commands.
  const [config, setConfig] = useState<ChartConfig>(() =>
    isEmbedded
      ? (props as ChartConfigPanelEmbeddedProps).value
      : {
          durationMinutes: 60,
          ...(props as ChartConfigPanelModalProps).initialConfig,
        },
  );

  const [tab, setTab] = useState<Tab>("type");
  const [saveModal, setSaveModal] = useState<{ publish: boolean } | null>(null);

  // Update config and notify parent (embedded only)
  const setConfigAndNotify = useCallback(
    (next: ChartConfig) => {
      setConfig(next);
      if (isEmbedded) {
        (props as ChartConfigPanelEmbeddedProps).onChange(next);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isEmbedded],
  );

  // Fetch real point metadata for all configured points.
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

  const configuredPointTypes: PointTypeCategory[] | undefined = (() => {
    const resolved = config.points
      .map((p) => pointMeta.get(p.pointId)?.point_category)
      .filter((c): c is "analog" | "boolean" | "discrete_enum" => Boolean(c));
    if (resolved.length === 0) return undefined;
    return [...new Set(resolved)] as PointTypeCategory[];
  })();

  // Derive visible tabs: hide Scaling for charts without configurable axes,
  // hide Points for content widgets (requiresPoints === false).
  const def = CHART_DEFINITIONS.find((d) => d.id === config.chartType);
  let TABS = SCALING_TAB_CHARTS.has(config.chartType)
    ? BASE_TABS
    : BASE_TABS.filter((t) => t.id !== "scaling");
  if (def?.requiresPoints === false) {
    TABS = TABS.filter((t) => t.id !== "points");
  }

  // If the active tab was filtered out (e.g. switching to a content widget type),
  // fall back to "type".
  useEffect(() => {
    if (!TABS.find((t) => t.id === tab)) {
      setTab("type");
    }
    // Only re-evaluate when the chart type changes (which is what alters TABS).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.chartType]);

  // Measure sidebar/topbar for modal positioning (modal mode only).
  const [sidebarWidth, setSidebarWidth] = useState(0);
  const [topbarHeight, setTopbarHeight] = useState(0);
  useLayoutEffect(() => {
    if (isEmbedded) return;
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
  }, [isEmbedded]);

  // Close on Escape (modal mode only).
  useEffect(() => {
    if (isEmbedded) return;
    const modalProps = props as ChartConfigPanelModalProps;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") modalProps.onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEmbedded]);

  // Single-click: migrate config but stay on the type tab so the user can read about it.
  function handleTypeSelect(type: ChartTypeId) {
    setConfigAndNotify(migrateConfigToType(config, type));
  }

  // Double-click (or explicit Next navigation): migrate config and advance to the next tab.
  function handleTypeCommit(type: ChartTypeId) {
    setConfigAndNotify(migrateConfigToType(config, type));
    const nextDef = CHART_DEFINITIONS.find((d) => d.id === type);
    setTab(nextDef?.requiresPoints === false ? "options" : "points");
  }

  function patchConfig(patch: Partial<ChartConfig>) {
    setConfigAndNotify({ ...config, ...patch });
  }

  const slotDefs = CHART_SLOTS[config.chartType] ?? [];

  const isOverCapacity = slotDefs.some((slot) => {
    const count = config.points.filter((p) => p.role === slot.id).length;
    const max = slot.multi ? (slot.maxPoints ?? 12) : 1;
    return count > max;
  });

  const handleSave = useCallback(() => {
    const modalProps = props as ChartConfigPanelModalProps;
    modalProps.onSave(config);
    modalProps.onClose();
  }, [config, props]);

  // ---------------------------------------------------------------------------
  // Shared tab content
  // ---------------------------------------------------------------------------

  const tabContent = (
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
            onCommit={handleTypeCommit}
            context={props.context}
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
              maxWidth: isEmbedded ? undefined : 640,
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
  );

  // ---------------------------------------------------------------------------
  // Embedded mode — inline render, no modal chrome
  // ---------------------------------------------------------------------------

  if (isEmbedded) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          overflow: "hidden",
        }}
      >
        {/* Tabs */}
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
                padding: "8px 12px",
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
                fontSize: 12,
                cursor: "pointer",
                marginBottom: -1,
                whiteSpace: "nowrap",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        {tabContent}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Modal mode — createPortal with full chrome
  // ---------------------------------------------------------------------------

  const modalProps = props as ChartConfigPanelModalProps;
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
        if (e.target === e.currentTarget) modalProps.onClose();
      }}
      onDoubleClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
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
        {/* Header */}
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
            onClick={modalProps.onClose}
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

        {/* Tabs */}
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

        {tabContent}

        {/* Footer */}
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
              const isNextFromType = tab === "type" && !isPrev;
              return (
                <button
                  key={t.id}
                  onClick={() =>
                    isNextFromType
                      ? handleTypeCommit(config.chartType)
                      : setTab(t.id)
                  }
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
            {isOverCapacity && (
              <span
                style={{
                  fontSize: 12,
                  color: "var(--io-alarm-urgent)",
                  fontWeight: 500,
                }}
              >
                Too many points — remove excess from Data Points to apply
              </span>
            )}
            {modalProps.onSaveChart && (
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
            {modalProps.onSaveChart && modalProps.canPublish && (
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
              onClick={modalProps.onClose}
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
              onClick={isOverCapacity ? undefined : handleSave}
              disabled={isOverCapacity}
              title={
                isOverCapacity
                  ? "Remove excess points before applying"
                  : undefined
              }
              style={{
                background: isOverCapacity
                  ? "var(--io-surface-secondary)"
                  : "var(--io-accent)",
                border: isOverCapacity ? "1px solid var(--io-border)" : "none",
                color: isOverCapacity ? "var(--io-text-muted)" : "#fff",
                borderRadius: 6,
                padding: "7px 20px",
                fontSize: 13,
                fontWeight: 600,
                cursor: isOverCapacity ? "not-allowed" : "pointer",
                opacity: isOverCapacity ? 0.6 : 1,
              }}
              onMouseEnter={(e) => {
                if (!isOverCapacity) e.currentTarget.style.opacity = "0.9";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = isOverCapacity ? "0.6" : "1";
              }}
            >
              Apply
            </button>
          </div>
          {saveModal && modalProps.onSaveChart && (
            <SaveChartModal
              publish={saveModal.publish}
              onConfirm={(name, description) => {
                modalProps.onSaveChart!(
                  config,
                  name,
                  description,
                  saveModal.publish,
                );
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
