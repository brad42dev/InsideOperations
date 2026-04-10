/**
 * Designer page — main orchestrator.
 *
 * Route: /designer/graphics/:id/edit  (edit existing)
 *        /designer/graphics/new         (create new)
 *
 * Layout:
 *   ┌─────────────────────────────────────────────────────┐
 *   │  DesignerToolbar (44px)                             │
 *   ├──────────┬──────────────────────────────────────────┤
 *   │  Left    │  DesignerCanvas (flex 1)                 │ Right
 *   │  Palette │                                          │ Panel
 *   │  240px   │                                          │ 300px
 *   └──────────┴──────────────────────────────────────────┘
 *
 * State management: Zustand (sceneStore, historyStore, uiStore)
 * API: graphicsApi from ../../api/graphics
 */

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  useSceneStore,
  useHistoryStore,
  useTabStore,
  MAX_TABS,
} from "../../store/designer";
import { useUiStore } from "../../store/designer/uiStore";
import { graphicsApi } from "../../api/graphics";
import { pointsApi } from "../../api/points";
import type {
  SceneNode,
  DisplayElement,
  SymbolInstance,
} from "../../shared/types/graphics";
import { wsManager } from "../../shared/hooks/useWebSocket";
import { useDesignerPermissions } from "../../shared/hooks/usePermission";
import { showToast } from "../../shared/components/Toast";
import { ErrorBoundary } from "../../shared/components/ErrorBoundary";
import DesignerToolbar from "./DesignerToolbar";
import DesignerModeTabs from "./DesignerModeTabs";
import DesignerStatusBar from "./DesignerStatusBar";
import DesignerLeftPalette from "./DesignerLeftPalette";
import DesignerRightPanel from "./DesignerRightPanel";
import DesignerCanvas, { getNodeBounds } from "./DesignerCanvas";
import DesignerTabBar from "./DesignerTabBar";
import { SceneRenderer } from "../../shared/graphics/SceneRenderer";
import VersionHistoryDialog from "./components/VersionHistoryDialog";
import ValidateBindingsDialog from "./components/ValidateBindingsDialog";
import IographicImportWizard from "./components/IographicImportWizard";
import IographicExportDialog from "./components/IographicExportDialog";
import CanvasPropertiesDialog from "./components/CanvasPropertiesDialog";
import TabClosePrompt from "./components/TabClosePrompt";
import { ConfirmDialog } from "../../shared/components/ConfirmDialog";

// ---------------------------------------------------------------------------
// New Graphic dialog
// ---------------------------------------------------------------------------

interface NewGraphicDialogProps {
  onConfirm: (
    name: string,
    mode: "graphic" | "dashboard" | "report",
    width: number,
    height: number,
    autoHeight: boolean,
    scope: "console" | "process" | null,
  ) => void;
  onCancel: () => void;
  initialMode?: "graphic" | "dashboard" | "report";
}

// ---------------------------------------------------------------------------
// Aspect presets
// ---------------------------------------------------------------------------

interface AspectPreset {
  label: string;
  width: number;
  height: number;
  reportOnly?: boolean;
}

const ASPECT_PRESETS: AspectPreset[] = [
  { label: "720p", width: 1280, height: 720 },
  { label: "1080p", width: 1920, height: 1080 },
  { label: "1440p", width: 2560, height: 1440 },
  { label: "4K", width: 3840, height: 2160 },
  { label: "16:10 M", width: 1920, height: 1200 },
  { label: "16:10 L", width: 2560, height: 1600 },
  { label: "4:3 Std", width: 1024, height: 768 },
  { label: "4:3 Lg", width: 1600, height: 1200 },
  { label: "Ultrawide", width: 3440, height: 1440 },
  { label: "Super-UW", width: 5120, height: 1440 },
  { label: "A4 Portrait", width: 794, height: 1123, reportOnly: true },
  { label: "A4 Landscape", width: 1123, height: 794, reportOnly: true },
  { label: "Letter Portrait", width: 816, height: 1056, reportOnly: true },
  { label: "Letter Landscape", width: 1056, height: 816, reportOnly: true },
];

// Defaults per mode
const MODE_DEFAULTS: Record<
  "graphic" | "dashboard" | "report",
  { width: number; height: number; autoHeight: boolean }
> = {
  graphic: { width: 1920, height: 1080, autoHeight: false },
  dashboard: { width: 1920, height: 1080, autoHeight: false },
  report: { width: 794, height: 1123, autoHeight: true },
};

// ---------------------------------------------------------------------------
// Chain-link SVG icon for proportional lock toggle
// ---------------------------------------------------------------------------

function ChainLinkIcon({ locked }: { locked: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      aria-hidden="true"
    >
      {locked ? (
        // Closed chain: two ovals linked
        <>
          <rect
            x="1"
            y="5"
            width="4"
            height="4"
            rx="2"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <rect
            x="9"
            y="5"
            width="4"
            height="4"
            rx="2"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <line
            x1="5"
            y1="7"
            x2="9"
            y2="7"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </>
      ) : (
        // Open chain: two ovals unlinked with a gap
        <>
          <rect
            x="1"
            y="5"
            width="4"
            height="4"
            rx="2"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <rect
            x="9"
            y="5"
            width="4"
            height="4"
            rx="2"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <line
            x1="5"
            y1="7"
            x2="6.5"
            y2="7"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <line
            x1="7.5"
            y1="7"
            x2="9"
            y2="7"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </>
      )}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// NewGraphicDialog
// ---------------------------------------------------------------------------

function NewGraphicDialog({
  onConfirm,
  onCancel,
  initialMode = "graphic",
}: NewGraphicDialogProps) {
  const defaultName =
    initialMode === "dashboard"
      ? "Untitled Dashboard"
      : initialMode === "report"
        ? "Untitled Report"
        : "Untitled Graphic";
  const [name, setName] = useState(defaultName);
  const [mode, setMode] = useState<"graphic" | "dashboard" | "report">(
    initialMode,
  );
  const [scope, setScope] = useState<"console" | "process">("console");
  const [width, setWidth] = useState<number>(MODE_DEFAULTS[initialMode].width);
  const [height, setHeight] = useState<number>(
    MODE_DEFAULTS[initialMode].height,
  );
  const [autoHeight, setAutoHeight] = useState<boolean>(
    MODE_DEFAULTS.graphic.autoHeight,
  );
  const [proportionalLock, setProportionalLock] = useState(false);
  const [activePreset, setActivePreset] = useState<string | null>("1080p");

  // When mode changes, reset to that mode's defaults
  function handleModeChange(newMode: "graphic" | "dashboard" | "report") {
    setMode(newMode);
    const defaults = MODE_DEFAULTS[newMode];
    setWidth(defaults.width);
    setHeight(defaults.height);
    setAutoHeight(defaults.autoHeight);
    // Check if the new defaults match a preset
    const matching = ASPECT_PRESETS.find(
      (p) => p.width === defaults.width && p.height === defaults.height,
    );
    setActivePreset(matching ? matching.label : null);
    setProportionalLock(false);
  }

  function applyPreset(preset: AspectPreset) {
    setWidth(preset.width);
    setHeight(preset.height);
    setActivePreset(preset.label);
  }

  function handleWidthChange(raw: string) {
    const val = parseInt(raw, 10);
    if (isNaN(val)) return;
    if (proportionalLock && height > 0 && width > 0) {
      const newH = Math.round(val * (height / width));
      setHeight(newH);
    }
    setWidth(val);
    // Clear active preset if no match
    const matching = ASPECT_PRESETS.find((p) => {
      const newH =
        proportionalLock && height > 0 && width > 0
          ? Math.round(val * (height / width))
          : height;
      return p.width === val && p.height === newH;
    });
    setActivePreset(matching ? matching.label : null);
  }

  function handleHeightChange(raw: string) {
    const val = parseInt(raw, 10);
    if (isNaN(val)) return;
    if (proportionalLock && width > 0 && height > 0) {
      const newW = Math.round(val * (width / height));
      setWidth(newW);
    }
    setHeight(val);
    const matching = ASPECT_PRESETS.find((p) => {
      const newW =
        proportionalLock && width > 0 && height > 0
          ? Math.round(val * (width / height))
          : width;
      return p.width === newW && p.height === val;
    });
    setActivePreset(matching ? matching.label : null);
  }

  function clampWidth(val: number): number {
    return Math.max(320, Math.min(20000, val));
  }
  function clampHeight(val: number): number {
    return Math.max(240, Math.min(15000, val));
  }

  function handleWidthBlur() {
    setWidth((w) => clampWidth(w));
  }
  function handleHeightBlur() {
    setHeight((h) => clampHeight(h));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    onConfirm(
      trimmed,
      mode,
      clampWidth(width),
      clampHeight(height),
      autoHeight,
      mode === "graphic" ? scope : null,
    );
  }

  const visiblePresets = ASPECT_PRESETS.filter(
    (p) => !p.reportOnly || mode === "report",
  );

  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "6px 8px",
    background: "var(--io-surface)",
    border: "1px solid var(--io-border)",
    borderRadius: "var(--io-radius)",
    color: "var(--io-text-primary)",
    fontSize: 13,
    outline: "none",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 11,
    fontWeight: 600,
    color: "var(--io-text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginBottom: 4,
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0,0,0,0.6)",
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          background: "var(--io-surface-elevated)",
          border: "1px solid var(--io-border)",
          borderRadius: "var(--io-radius)",
          padding: 24,
          width: 440,
          maxWidth: "92%",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <div
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: "var(--io-text-primary)",
          }}
        >
          New Graphic
        </div>

        {/* Name */}
        <div>
          <label style={labelStyle}>Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            style={inputStyle}
          />
        </div>

        {/* Type / Mode */}
        <div>
          <label style={labelStyle}>Type</label>
          <div style={{ display: "flex", gap: 8 }}>
            {(["graphic", "dashboard", "report"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => handleModeChange(m)}
                style={{
                  flex: 1,
                  padding: "6px 0",
                  background:
                    mode === m ? "var(--io-accent)" : "var(--io-surface)",
                  color:
                    mode === m
                      ? "var(--io-accent-foreground)"
                      : "var(--io-text-secondary)",
                  border: "1px solid var(--io-border)",
                  borderRadius: "var(--io-radius)",
                  fontSize: 12,
                  fontWeight: mode === m ? 600 : 400,
                  cursor: "pointer",
                  textTransform: "capitalize",
                }}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Scope — only relevant for graphic type */}
        {mode === "graphic" && (
          <div>
            <label style={labelStyle}>Module</label>
            <div style={{ display: "flex", gap: 8 }}>
              {(["console", "process"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setScope(s)}
                  style={{
                    flex: 1,
                    padding: "6px 0",
                    background:
                      scope === s ? "var(--io-accent)" : "var(--io-surface)",
                    color:
                      scope === s
                        ? "var(--io-accent-foreground)"
                        : "var(--io-text-secondary)",
                    border: "1px solid var(--io-border)",
                    borderRadius: "var(--io-radius)",
                    fontSize: 12,
                    fontWeight: scope === s ? 600 : 400,
                    cursor: "pointer",
                    textTransform: "capitalize",
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Preset chip row */}
        <div>
          <label style={labelStyle}>Canvas Preset</label>
          <div
            style={{
              overflowX: "auto",
              display: "flex",
              gap: 6,
              flexWrap: "nowrap",
              paddingBottom: 2,
            }}
          >
            {visiblePresets.map((preset) => {
              const isActive = activePreset === preset.label;
              return (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  title={`${preset.width} \u00d7 ${preset.height}`}
                  style={{
                    flexShrink: 0,
                    padding: "3px 8px",
                    fontSize: 11,
                    fontWeight: isActive ? 600 : 400,
                    background: isActive
                      ? "var(--io-accent)"
                      : "var(--io-surface)",
                    color: isActive
                      ? "var(--io-accent-foreground)"
                      : "var(--io-text-secondary)",
                    border: "1px solid var(--io-border)",
                    borderRadius: "calc(var(--io-radius) * 2)",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Width / Height inputs with proportional lock */}
        <div>
          <label style={labelStyle}>
            {mode === "report" ? "Min. Height" : "Canvas Size"}
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {/* Width */}
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: 10,
                  color: "var(--io-text-muted)",
                  marginBottom: 2,
                }}
              >
                Width
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <input
                  type="number"
                  value={width}
                  min={320}
                  max={20000}
                  onChange={(e) => handleWidthChange(e.target.value)}
                  onBlur={handleWidthBlur}
                  style={{ ...inputStyle, width: "100%" }}
                />
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--io-text-muted)",
                    flexShrink: 0,
                  }}
                >
                  px
                </span>
              </div>
            </div>

            {/* Proportional lock toggle */}
            <button
              type="button"
              onClick={() => setProportionalLock((l) => !l)}
              title={
                proportionalLock ? "Unlock proportions" : "Lock proportions"
              }
              style={{
                flexShrink: 0,
                width: 28,
                height: 28,
                marginTop: 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: proportionalLock
                  ? "var(--io-accent)"
                  : "var(--io-surface)",
                color: proportionalLock
                  ? "var(--io-accent-foreground)"
                  : "var(--io-text-muted)",
                border: "1px solid var(--io-border)",
                borderRadius: "var(--io-radius)",
                cursor: "pointer",
                padding: 0,
              }}
            >
              <ChainLinkIcon locked={proportionalLock} />
            </button>

            {/* Height */}
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: 10,
                  color: "var(--io-text-muted)",
                  marginBottom: 2,
                }}
              >
                {mode === "report" ? "Min. Height" : "Height"}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <input
                  type="number"
                  value={height}
                  min={240}
                  max={15000}
                  onChange={(e) => handleHeightChange(e.target.value)}
                  onBlur={handleHeightBlur}
                  style={{ ...inputStyle, width: "100%" }}
                />
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--io-text-muted)",
                    flexShrink: 0,
                  }}
                >
                  px
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Buttons */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            marginTop: 4,
          }}
        >
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: "6px 14px",
              background: "transparent",
              color: "var(--io-text-secondary)",
              border: "1px solid var(--io-border)",
              borderRadius: "var(--io-radius)",
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim()}
            style={{
              padding: "6px 14px",
              background: name.trim()
                ? "var(--io-accent)"
                : "var(--io-surface-elevated)",
              color: name.trim()
                ? "var(--io-accent-foreground)"
                : "var(--io-text-muted)",
              border: "none",
              borderRadius: "var(--io-radius)",
              fontSize: 12,
              fontWeight: 600,
              cursor: name.trim() ? "pointer" : "not-allowed",
            }}
          >
            Create
          </button>
        </div>
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Resizable divider
// ---------------------------------------------------------------------------

interface DividerProps {
  onDrag: (dx: number) => void;
}

function VerticalDivider({ onDrag }: DividerProps) {
  const startX = useRef(0);
  const active = useRef(false);

  function handleMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    active.current = true;
    startX.current = e.clientX;

    const onMove = (ev: MouseEvent) => {
      if (!active.current) return;
      const dx = ev.clientX - startX.current;
      startX.current = ev.clientX;
      onDrag(dx);
    };
    const onUp = () => {
      active.current = false;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }

  return (
    <div
      onMouseDown={handleMouseDown}
      style={{
        width: 4,
        cursor: "col-resize",
        flexShrink: 0,
        background: "transparent",
        position: "relative",
        zIndex: 10,
        transition: "background 0.15s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "var(--io-accent)";
        e.currentTarget.style.opacity = "0.4";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function LoadingSkeleton() {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        background: "var(--io-surface-primary)",
        overflow: "hidden",
      }}
    >
      {/* Toolbar row */}
      <div
        style={{
          height: 40,
          background: "var(--io-surface)",
          borderBottom: "1px solid var(--io-border)",
          flexShrink: 0,
        }}
      />
      {/* Body row */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Left palette */}
        <div
          style={{
            width: 240,
            background: "var(--io-surface-secondary)",
            borderRight: "1px solid var(--io-border)",
            flexShrink: 0,
          }}
        />
        {/* Canvas */}
        <div style={{ flex: 1, background: "var(--io-surface-primary)" }} />
        {/* Right panel */}
        <div
          style={{
            width: 300,
            background: "var(--io-surface-secondary)",
            borderLeft: "1px solid var(--io-border)",
            flexShrink: 0,
          }}
        />
      </div>
      {/* Status bar */}
      <div
        style={{
          height: 28,
          background: "var(--io-surface)",
          borderTop: "1px solid var(--io-border)",
          flexShrink: 0,
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Error state
// ---------------------------------------------------------------------------

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "var(--io-surface-primary)",
        gap: 12,
      }}
    >
      <div style={{ color: "var(--io-alarm-urgent)", fontSize: 14 }}>
        Failed to load graphic
      </div>
      <div style={{ color: "var(--io-text-muted)", fontSize: 12 }}>
        {message}
      </div>
      <button
        onClick={onRetry}
        style={{
          padding: "6px 16px",
          background: "var(--io-accent)",
          color: "var(--io-accent-foreground)",
          border: "none",
          borderRadius: "var(--io-radius)",
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        Retry
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function DesignerPage() {
  const { id: graphicId } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const isNew = !graphicId || graphicId === "new";

  // Derive initial mode from the route path so that /designer/dashboards/new
  // pre-selects "dashboard" and /designer/reports/new pre-selects "report".
  const routeInitialMode: "graphic" | "dashboard" | "report" =
    location.pathname.includes("/dashboards")
      ? "dashboard"
      : location.pathname.includes("/reports")
        ? "report"
        : "graphic";

  // Store actions
  const loadGraphic = useSceneStore((s) => s.loadGraphic);
  const newDocument = useSceneStore((s) => s.newDocument);
  const markClean = useSceneStore((s) => s.markClean);
  const historyMarkClean = useHistoryStore((s) => s.markClean);
  const historyClear = useHistoryStore((s) => s.clear);

  const graphicIdInStore = useSceneStore((s) => s.graphicId);
  const doc = useSceneStore((s) => s.doc);
  const { canPublish, canDelete } = useDesignerPermissions();

  // Tab store
  const tabs = useTabStore((s) => s.tabs);
  const activeTabId = useTabStore((s) => s.activeTabId);
  const tabStoreOpenTab = useTabStore((s) => s.openTab);
  const tabStoreSetActive = useTabStore((s) => s.setActiveTab);
  const tabStoreCloseTab = useTabStore((s) => s.closeTab);
  const tabStoreSetModified = useTabStore((s) => s.setTabModified);
  const tabStoreSaveViewport = useTabStore((s) => s.saveTabViewport);
  const tabStoreSaveScene = useTabStore((s) => s.saveTabScene);
  const tabStoreCloseOthers = useTabStore((s) => s.closeOtherTabs);
  const tabStoreCloseAll = useTabStore((s) => s.closeAllTabs);
  const tabStoreFindByGraphic = useTabStore((s) => s.findTabByGraphicId);
  const tabStoreOpenGroupTab = useTabStore((s) => s.openGroupTab);
  const tabStoreCloseGroupTabs = useTabStore((s) => s.closeGroupTabsForGraphic);
  const tabStoreSetGraphicId = useTabStore((s) => s.setTabGraphicId);
  const setViewport = useUiStore((s) => s.setViewport);
  const setActiveGroup = useUiStore((s) => s.setActiveGroup);

  // Derived: current active tab object
  const activeTab = useTabStore(
    (s) => s.tabs.find((t) => t.id === s.activeTabId) ?? null,
  );

  // Tab close prompt state
  const [tabClosePrompt, setTabClosePrompt] = useState<{
    tabId: string;
    graphicName: string;
    onAfterClose: () => void;
  } | null>(null);
  const [isTabSaving, setIsTabSaving] = useState(false);

  // Panel widths
  const [leftWidth, setLeftWidth] = useState(240);
  const [rightWidth, setRightWidth] = useState(300);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  // Load/save state
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  // Pessimistic lock state — non-null means WE do NOT hold the lock
  const [lockState, setLockState] = useState<{
    lockedByName: string;
    lockedAt: string;
  } | null>(null);
  const lockHeldRef = useRef(false); // true when this session holds the lock

  // New doc dialog
  const [showNewDialog, setShowNewDialog] = useState(false);

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDeleteActiveGraphic = useCallback(async () => {
    const gid = useSceneStore.getState().graphicId;
    if (!gid || gid.startsWith("new-")) return;
    try {
      const result = await graphicsApi.remove(gid);
      if (!result.success)
        throw new Error((result as { error?: { message?: string } }).error?.message ?? "Delete failed");
      tabStoreCloseAll();
      navigate("/designer/graphics");
      showToast({ title: "Graphic deleted", variant: "success" });
    } catch {
      showToast({
        title: "Delete failed",
        description: "Could not delete the graphic. Please try again.",
        variant: "error",
      });
    }
  }, [navigate, tabStoreCloseAll]);

  // Crash recovery — includes the saved doc so Recover action can load it
  const [crashRecovery, setCrashRecovery] = useState<{
    id: string;
    savedAt: number;
    savedDoc: unknown;
  } | null>(null);
  const [showCrashPreview, setShowCrashPreview] = useState(false);

  // Dialogs
  const [showVersionHistory, setShowVersionHistory] = useState(false);
  const [showValidateBindings, setShowValidateBindings] = useState(false);
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [showExportDialog, setShowExportDialog] = useState(false);
  const [showPropertiesDialog, setShowPropertiesDialog] = useState(false);

  // Validate bindings results
  const [bindingValidation, setBindingValidation] = useState<{
    unresolvedBindings: { elementId: string; tag: string; reason: string }[];
    totalBound: number;
    resolvedCount: number;
  }>({ unresolvedBindings: [], totalBound: 0, resolvedCount: 0 });

  // Auto-save timestamp (updated whenever IndexedDB auto-save fires)
  const [lastAutoSave, setLastAutoSave] = useState<number | null>(null);

  // WebSocket connection state for status bar
  const [wsConnected, setWsConnected] = useState(
    wsManager.getState() === "connected",
  );
  useEffect(() => {
    return wsManager.onStateChange((s) => setWsConnected(s === "connected"));
  }, []);

  // -------------------------------------------------------------------------
  // Load graphic on mount
  // -------------------------------------------------------------------------

  const loadDoc = useCallback(async () => {
    if (isNew) {
      // Before showing the New dialog, check if there are already open tabs to restore.
      // This handles: refreshing on /new with open tabs, and navigating back to designer.
      const existingTabs = useTabStore.getState().tabs;
      if (existingTabs.length > 0) {
        const activeId = useTabStore.getState().activeTabId;
        const targetTab =
          existingTabs.find((t) => t.id === activeId) ??
          existingTabs[existingTabs.length - 1];
        if (targetTab) {
          if (!targetTab.graphicId.startsWith("new-")) {
            // Saved tab — navigate to its edit URL; loadDoc re-fires without isNew.
            navigate(`/designer/graphics/${targetTab.graphicId}/edit`, {
              replace: true,
            });
          } else if (targetTab.savedScene) {
            // Unsaved tab — restore scene directly, stay on /new, skip dialog.
            tabStoreSetActive(targetTab.id);
            loadGraphic(null as unknown as string, targetTab.savedScene.scene);
            historyClear();
          }
          return;
        }
      }
      setShowNewDialog(true);
      return;
    }
    if (!graphicId) return;
    // Already loaded
    if (graphicIdInStore === graphicId && doc) return;

    const gid: string = graphicId;

    setLoading(true);
    setLoadError(null);
    try {
      const resp = await graphicsApi.get(gid);
      if (!resp.success) {
        setLoadError(resp.error.message);
        return;
      }
      const record = resp.data;
      loadGraphic(record.id, record.scene_data);
      historyClear();

      // Register a tab for this graphic so the file tab bar is visible
      tabStoreOpenTab(record.id, record.name);

      // Try to acquire the pessimistic edit lock
      const lockResp = await graphicsApi.acquireLock(gid).catch(() => null);
      if (lockResp?.success) {
        if (lockResp.data.data.acquired) {
          lockHeldRef.current = true;
          setLockState(null);
        } else {
          // Lock held by another user — open read-only
          lockHeldRef.current = false;
          setLockState({
            lockedByName: lockResp.data.data.locked_by_name ?? "another user",
            lockedAt: lockResp.data.data.locked_at ?? new Date().toISOString(),
          });
        }
      } else if (record.locked_by && record.locked_by_name) {
        // Fallback: use info from the GET response
        lockHeldRef.current = false;
        setLockState({
          lockedByName: record.locked_by_name,
          lockedAt: record.locked_at ?? new Date().toISOString(),
        });
      } else {
        lockHeldRef.current = true;
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [
    graphicId,
    isNew,
    graphicIdInStore,
    doc,
    loadGraphic,
    historyClear,
    tabStoreOpenTab,
    tabStoreSetActive,
    navigate,
  ]);

  useEffect(() => {
    loadDoc();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphicId]);

  // Release lock on unmount
  useEffect(() => {
    return () => {
      if (lockHeldRef.current && graphicId && graphicId !== "new") {
        graphicsApi.releaseLock(graphicId).catch(() => {
          /* best-effort */
        });
        lockHeldRef.current = false;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphicId]);

  // -------------------------------------------------------------------------
  // Save
  // -------------------------------------------------------------------------

  const handleSave = useCallback(
    async ({ explicit = false }: { explicit?: boolean } = {}) => {
      const currentDoc = useSceneStore.getState().doc;
      const currentId = useSceneStore.getState().graphicId;
      // For new (unsaved) documents there is no lock yet — allow save.
      // For existing documents, block save if this session doesn't hold the lock.
      if (!currentDoc || isSaving) return;
      if (currentId && lockHeldRef.current === false) return;

      setIsSaving(true);
      try {
        const docName = currentDoc.name ?? "Untitled";
        if (currentId) {
          // Update existing
          const result = await graphicsApi.update(currentId, {
            name: docName,
            scene_data: currentDoc,
          });
          if (!result.success) {
            console.error(
              "[DesignerPage] Update failed:",
              result.error.message,
            );
            showToast({
              title: "Save failed",
              description:
                result.error.message ||
                "Could not save the document. Please try again.",
              variant: "error",
            });
            return;
          }
        } else {
          // Create new — send designMode so the DB type is graphic/dashboard/report
          const designMode = useSceneStore.getState().designMode;
          const scopeMeta = currentDoc.metadata.graphicScope;
          const resp = await graphicsApi.create({
            name: docName,
            scene_data: currentDoc,
            type: designMode,
            ...(scopeMeta ? { metadata: { module: scopeMeta } } : {}),
          });
          if (!resp.success) {
            console.error("[DesignerPage] Create failed:", resp.error.message);
            showToast({
              title: "Save failed",
              description:
                resp.error.message ||
                "Could not create the document. Please try again.",
              variant: "error",
            });
            return;
          }
          // Update graphicId in store via loadGraphic (sets graphicId in scene state)
          loadGraphic(resp.data.id, currentDoc);
          // Upgrade the active placeholder tab to the real server-assigned graphicId.
          // We use activeTabId here because: (a) the active tab IS the one being saved,
          // (b) multiple unsaved tabs each get a unique 'new-<uuid>' placeholder so we
          //     cannot reliably search by the old static 'new' string.
          const activeTabId = useTabStore.getState().activeTabId;
          if (activeTabId) {
            const activeTabRecord = useTabStore.getState().getTab(activeTabId);
            if (
              activeTabRecord &&
              activeTabRecord.graphicId.startsWith("new-")
            ) {
              tabStoreSetGraphicId(activeTabId, resp.data.id, docName);
            }
          }
        }
        markClean();
        historyMarkClean();

        // Success toast — only for explicit saves (Ctrl+S / toolbar Save), not auto-save
        if (explicit) {
          const mode = useSceneStore.getState().designMode;
          const modeLabel =
            mode === "dashboard"
              ? "Dashboard"
              : mode === "report"
                ? "Report"
                : "Graphic";
          showToast({
            title: `${modeLabel} saved`,
            variant: "success",
            duration: 3000,
          });
        }
        // Re-acquire lock after save to confirm we still hold it (release + re-acquire cycle)
        const gid = useSceneStore.getState().graphicId;
        if (gid && lockHeldRef.current) {
          graphicsApi.releaseLock(gid).catch(() => {
            /* best-effort */
          });
          const relock = await graphicsApi.acquireLock(gid).catch(() => null);
          if (relock?.success && relock.data.data.acquired) {
            lockHeldRef.current = true;
          }
        }

        // Out-of-bounds warning — only for explicit saves (Ctrl+S / File→Save), not auto-save
        if (explicit && currentDoc.children.length > 0) {
          const cw = currentDoc.canvas.width;
          const ch = currentDoc.canvas.height;
          const outOfBoundsIds = currentDoc.children
            .filter((node) => {
              const b = getNodeBounds(node);
              return b.x < 0 || b.y < 0 || b.x + b.w > cw || b.y + b.h > ch;
            })
            .map((node) => node.id);
          if (outOfBoundsIds.length > 0) {
            const n = outOfBoundsIds.length;
            const label = n === 1 ? "element" : "elements";
            showToast({
              title: `${n} ${label} outside the canvas boundary`,
              variant: "warning",
              duration: 8000,
              action: {
                label: "Select",
                onClick: () => {
                  useUiStore.getState().setSelectedNodes(outOfBoundsIds);
                },
              },
            });
          }
        }
      } catch (err) {
        console.error("[DesignerPage] Save failed:", err);
        showToast({
          title: "Save failed",
          description:
            err instanceof Error
              ? err.message
              : "An unexpected error occurred. Please try again.",
          variant: "error",
        });
      } finally {
        setIsSaving(false);
      }
    },
    [isSaving, markClean, historyMarkClean, loadGraphic, tabStoreSetGraphicId],
  );

  /** Stable callback for UI-initiated saves (toolbar, menu) — marks explicit for toast warnings. */
  const handleExplicitSave = useCallback(
    () => handleSave({ explicit: true }),
    [handleSave],
  );

  /**
   * Export the current graphic as a clean standalone SVG.
   * Builds the export SVG from [data-node-id] scene elements (canvas coords)
   * rather than serialising the editor DOM, which includes grid, selection
   * handles, viewport transforms, and other chrome.
   */
  const handleExportSvg = useCallback(() => {
    const currentDoc = useSceneStore.getState().doc;
    if (!currentDoc) return;
    const svgEl = document.querySelector<SVGSVGElement>(
      '[data-testid="designer-canvas-svg"]',
    );
    if (!svgEl) return;

    const { width: cw, height: ch, backgroundColor } = currentDoc.canvas;
    const ns = "http://www.w3.org/2000/svg";

    // Fresh SVG with proper viewBox — no editor chrome, no viewport transform
    const exportSvg = document.createElementNS(ns, "svg") as SVGSVGElement;
    exportSvg.setAttribute("xmlns", ns);
    exportSvg.setAttribute("viewBox", `0 0 ${cw} ${ch}`);
    exportSvg.setAttribute("width", String(cw));
    exportSvg.setAttribute("height", String(ch));

    // Copy defs (shape markers, gradients) — strip editor grid patterns
    const defsEl = svgEl.querySelector("defs");
    if (defsEl) {
      const exportDefs = defsEl.cloneNode(true) as Element;
      for (const child of Array.from(exportDefs.children)) {
        if (child.id.startsWith("grid-")) exportDefs.removeChild(child);
      }
      if (exportDefs.children.length > 0) {
        exportSvg.appendChild(exportDefs);
      }
    }

    // Canvas background rect
    const bg = document.createElementNS(ns, "rect");
    bg.setAttribute("x", "0");
    bg.setAttribute("y", "0");
    bg.setAttribute("width", String(cw));
    bg.setAttribute("height", String(ch));
    bg.setAttribute("fill", backgroundColor ?? "#0d0d0d");
    exportSvg.appendChild(bg);

    // Clone only top-level scene node elements (those with data-node-id that
    // are NOT nested inside another data-node-id — avoids duplicating children
    // of groups that are also individually matched by querySelectorAll).
    const allNodes = Array.from(
      svgEl.querySelectorAll<SVGElement>("[data-node-id]"),
    );
    const topLevel = allNodes.filter(
      (el) => el.parentElement?.closest("[data-node-id]") === null,
    );
    for (const el of topLevel) {
      exportSvg.appendChild(el.cloneNode(true));
    }

    const svgStr = new XMLSerializer().serializeToString(exportSvg);
    const blob = new Blob([svgStr], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${currentDoc.name ?? "graphic"}.svg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  // -------------------------------------------------------------------------
  // Publish — create permanent version snapshot
  // -------------------------------------------------------------------------

  const handlePublish = useCallback(async () => {
    const currentId = useSceneStore.getState().graphicId;
    // Block publish only if another user explicitly holds the lock (lockState is set)
    if (!currentId || isPublishing) return;
    if (
      !window.confirm(
        "Publish this graphic? This creates a permanent, immutable snapshot that cannot be deleted.",
      )
    )
      return;

    setIsPublishing(true);
    try {
      // Save first to ensure the snapshot captures the latest content
      await handleSave();
      const result = await graphicsApi.publishGraphic(currentId);
      if (result.success) {
        // Show brief success indication via the version history panel
        setShowVersionHistory(true);
      } else {
        console.error(
          "[DesignerPage] Publish failed:",
          (result as { error: { message: string } }).error?.message,
        );
      }
    } catch (err) {
      console.error("[DesignerPage] Publish failed:", err);
    } finally {
      setIsPublishing(false);
    }
  }, [isPublishing, handleSave]);

  // -------------------------------------------------------------------------
  // Version history — preview and restore
  // -------------------------------------------------------------------------

  const handlePreviewVersion = useCallback(
    (
      _versionId: string,
      doc: import("../../shared/types/graphics").GraphicDocument,
    ) => {
      // Load the version content into the scene for preview (non-destructive — user can still close without saving)
      loadGraphic(useSceneStore.getState().graphicId ?? "", doc);
    },
    [loadGraphic],
  );

  const handleRestoreVersion = useCallback(
    async (versionId: string) => {
      const currentId = useSceneStore.getState().graphicId;
      if (!currentId) return;
      // Restore creates a new draft server-side; reload the graphic to show the restored content
      const result = await graphicsApi
        .restoreVersion(currentId, versionId)
        .catch(() => null);
      if (result?.success) {
        const fresh = await graphicsApi.get(currentId).catch(() => null);
        if (fresh?.success && fresh.data.scene_data) {
          loadGraphic(currentId, fresh.data.scene_data);
        }
      }
    },
    [loadGraphic],
  );

  // -------------------------------------------------------------------------
  // Validate bindings — scan scene graph, check point resolution
  // -------------------------------------------------------------------------

  const handleValidateBindings = useCallback(async () => {
    const currentDoc = useSceneStore.getState().doc;
    if (!currentDoc) {
      setShowValidateBindings(true);
      return;
    }

    // Collect all point IDs from the scene graph
    type BindingEntry = {
      elementId: string;
      pointId: string;
      elementName: string;
    };
    const bindings: BindingEntry[] = [];

    function walk(nodes: SceneNode[]) {
      for (const n of nodes) {
        if (n.type === "display_element") {
          const de = n as DisplayElement;
          if (de.binding.pointId) {
            bindings.push({
              elementId: de.id,
              pointId: de.binding.pointId,
              elementName: de.name ?? de.id,
            });
          }
        }
        if (n.type === "symbol_instance") {
          const si = n as SymbolInstance;
          if (si.stateBinding?.pointId) {
            bindings.push({
              elementId: si.id,
              pointId: si.stateBinding.pointId,
              elementName: si.name ?? si.id,
            });
          }
          if (si.children) walk(si.children as SceneNode[]);
        }
        if ("children" in n && Array.isArray(n.children)) {
          walk(n.children as SceneNode[]);
        }
      }
    }
    walk(currentDoc.children);

    if (bindings.length === 0) {
      setBindingValidation({
        unresolvedBindings: [],
        totalBound: 0,
        resolvedCount: 0,
      });
      setShowValidateBindings(true);
      return;
    }

    // Check unique point IDs in batch via search
    const uniqueIds = [...new Set(bindings.map((b) => b.pointId))];
    const resolvedIds = new Set<string>();

    await Promise.all(
      uniqueIds.map(async (pid) => {
        const result = await pointsApi
          .list({ search: pid, limit: 5 })
          .catch(() => null);
        if (result?.success) {
          const exact = result.data.data.find(
            (p) => p.id === pid || p.tagname === pid,
          );
          if (exact) resolvedIds.add(pid);
        }
      }),
    );

    const unresolvedBindings = bindings
      .filter((b) => !resolvedIds.has(b.pointId))
      .map((b) => ({
        elementId: b.elementName || b.elementId,
        tag: b.pointId,
        reason: "Not found",
      }));

    setBindingValidation({
      unresolvedBindings,
      totalBound: bindings.length,
      resolvedCount: bindings.filter((b) => resolvedIds.has(b.pointId)).length,
    });
    setShowValidateBindings(true);
  }, []);

  // -------------------------------------------------------------------------
  // Tab management helpers
  // -------------------------------------------------------------------------

  /**
   * Open a graphic in a tab. Called from DesignerGraphicsList (and anywhere
   * else that wants to open a graphic). If the graphic is already open in a
   * tab, focuses that tab. Otherwise creates a new tab and loads the graphic.
   */
  const openGraphicInTab = useCallback(
    async (gId: string, gName: string) => {
      // Save current active tab's scene + viewport before possibly switching
      const currentActiveId = useTabStore.getState().activeTabId;
      if (currentActiveId) {
        const currentDoc = useSceneStore.getState().doc;
        if (currentDoc) {
          tabStoreSaveScene(currentActiveId, currentDoc);
        }
        tabStoreSaveViewport(currentActiveId, useUiStore.getState().viewport);
      }

      // Detect LRU eviction — check tab count before opening
      const tabsBefore = useTabStore.getState().tabs;
      const willEvict =
        tabsBefore.length >= MAX_TABS &&
        !tabsBefore.find((t) => t.graphicId === gId);
      let evictedName: string | null = null;
      if (willEvict) {
        // The LRU candidate is the tab with oldest lastFocusedAt, excluding active
        const currentActiveId = useTabStore.getState().activeTabId;
        const candidates = tabsBefore.filter((t) => t.id !== currentActiveId);
        if (candidates.length > 0) {
          candidates.sort((a, b) => a.lastFocusedAt - b.lastFocusedAt);
          evictedName = candidates[0].graphicName;
        }
      }

      const { tabId, isNew: isNewTab } = tabStoreOpenTab(gId, gName);

      if (willEvict && evictedName) {
        showToast({
          title: "Max tabs reached",
          description: `"${evictedName}" was closed to make room.`,
          variant: "info",
        });
      }

      if (!isNewTab) {
        // Already open — restore its scene and viewport
        const tab = useTabStore.getState().getTab(tabId);
        if (tab?.savedScene) {
          loadGraphic(gId, tab.savedScene.scene);
          historyClear();
        }
        setViewport(tab?.viewport ?? { panX: 0, panY: 0, zoom: 1 });
        return;
      }

      // New tab — load from server
      setLoading(true);
      setLoadError(null);
      try {
        const resp = await graphicsApi.get(gId);
        if (!resp.success) {
          setLoadError(resp.error.message);
          tabStoreCloseTab(tabId);
          return;
        }
        const record = resp.data;
        loadGraphic(record.id, record.scene_data);
        historyClear();
        setViewport({ panX: 0, panY: 0, zoom: 1 });
        // Update name in case it changed
        useTabStore.getState().setTabName(tabId, record.name);

        // Acquire lock
        const lockResp = await graphicsApi.acquireLock(gId).catch(() => null);
        if (lockResp?.success) {
          if (lockResp.data.data.acquired) {
            lockHeldRef.current = true;
            setLockState(null);
          } else {
            lockHeldRef.current = false;
            setLockState({
              lockedByName: lockResp.data.data.locked_by_name ?? "another user",
              lockedAt:
                lockResp.data.data.locked_at ?? new Date().toISOString(),
            });
          }
        } else {
          lockHeldRef.current = true;
        }
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "Unknown error");
        tabStoreCloseTab(tabId);
      } finally {
        setLoading(false);
      }
    },
    [
      tabStoreOpenTab,
      tabStoreSaveScene,
      tabStoreSaveViewport,
      tabStoreCloseTab,
      loadGraphic,
      historyClear,
      setViewport,
    ],
  );

  /**
   * Open a group node in a dedicated sub-tab.
   * Called from DesignerCanvas's "Open in Tab" context menu item.
   * Group sub-tabs share the parent graphic's sceneStore — no server fetch needed.
   */
  const openGroupInTab = useCallback(
    (groupNodeId: string, groupName: string) => {
      // The current active tab must be a graphic tab — get its info
      const currentState = useTabStore.getState();
      const currentTab = currentState.getTab(currentState.activeTabId ?? "");
      if (!currentTab || currentTab.type !== "graphic") return;

      // Save outgoing tab's viewport before switching
      tabStoreSaveViewport(currentTab.id, useUiStore.getState().viewport);

      // Compute a fit-to-group viewport using window dimensions as a proxy for canvas size
      const doc = useSceneStore.getState().doc;
      const groupNode = doc?.children.find((n) => n.id === groupNodeId);
      let viewport = { panX: 0, panY: 0, zoom: 1 };
      if (groupNode) {
        const b = getNodeBounds(groupNode);
        // Approximate canvas size: window minus toolbar/panel/tabbar chrome (~44+36+300+240 px)
        const vw = Math.max(200, window.innerWidth - 240 - 300 - 4);
        const vh = Math.max(200, window.innerHeight - 44 - 36 - 24);
        const scaleX = vw / (b.w || 1);
        const scaleY = vh / (b.h || 1);
        const zoom = Math.min(scaleX, scaleY) * 0.9;
        const panX = vw / 2 - (b.x + b.w / 2) * zoom;
        const panY = vh / 2 - (b.y + b.h / 2) * zoom;
        viewport = { panX, panY, zoom };
      }

      const { tabId, isNew } = tabStoreOpenGroupTab(
        currentTab.graphicId,
        currentTab.graphicName,
        groupNodeId,
        groupName,
        viewport,
      );

      if (!isNew) {
        // Already open — just switch to it and restore its viewport
        const existing = useTabStore.getState().getTab(tabId);
        setViewport(existing?.viewport ?? viewport);
        setActiveGroup(groupNodeId);
        return;
      }

      // New sub-tab — apply the computed viewport
      setViewport(viewport);
      // Enter the group context so palette drops and commands target group children
      setActiveGroup(groupNodeId);
    },
    [tabStoreOpenGroupTab, tabStoreSaveViewport, setViewport, setActiveGroup],
  );

  /**
   * Switch to an existing tab. Saves the current scene/viewport into the
   * outgoing tab, then restores the incoming tab's saved state.
   */
  const switchToTab = useCallback(
    async (tabId: string) => {
      const currentActiveId = useTabStore.getState().activeTabId;
      if (tabId === currentActiveId) return;

      // Save outgoing tab's viewport (and scene if it's a graphic tab)
      if (currentActiveId) {
        const outgoingTab = useTabStore.getState().getTab(currentActiveId);
        if (outgoingTab?.type === "graphic") {
          const currentDoc = useSceneStore.getState().doc;
          if (currentDoc) {
            tabStoreSaveScene(currentActiveId, currentDoc);
          }
        }
        tabStoreSaveViewport(currentActiveId, useUiStore.getState().viewport);
      }

      tabStoreSetActive(tabId);

      const incomingTab = useTabStore.getState().getTab(tabId);
      if (!incomingTab) return;

      // Group sub-tab: the scene is already loaded (shared sceneStore). Just restore
      // viewport and set the active group context.
      if (incomingTab.type === "group") {
        setViewport(incomingTab.viewport);
        setActiveGroup(incomingTab.groupNodeId ?? null);
        return;
      }

      // Graphic tab: switching back from a group sub-tab — clear group context
      setActiveGroup(null);

      if (incomingTab.savedScene) {
        // Restore from cached scene.
        // For unsaved tabs (placeholder graphicId starting with 'new-'), we must NOT
        // call loadGraphic(placeholderId, ...) because that would set graphicId to the
        // placeholder string in sceneStore, causing the save flow to attempt an update
        // (PUT) instead of a create (POST). Instead, restore the doc directly and keep
        // graphicId null so the save path correctly creates a new server record.
        if (incomingTab.graphicId.startsWith("new-")) {
          const savedDoc = incomingTab.savedScene.scene;
          useSceneStore.setState({
            doc: savedDoc,
            graphicId: null,
            isDirty: true,
            designMode: savedDoc.metadata.designMode,
            version: 0,
          });
          historyClear();
        } else {
          loadGraphic(incomingTab.graphicId, incomingTab.savedScene.scene);
          historyClear();
        }
        setViewport(incomingTab.viewport);
      } else {
        // First time loading this tab — either a saved graphic (fetch from server) or a
        // brand-new unsaved tab whose scene is still live in sceneStore (the user created
        // the graphic and immediately clicked away before any switch happened). In the
        // latter case the placeholder graphicId would never get here (savedScene is only
        // null for tabs that have never been the outgoing tab in switchToTab), so we
        // only reach this branch for real server-side graphics.
        setLoading(true);
        setLoadError(null);
        try {
          const resp = await graphicsApi.get(incomingTab.graphicId);
          if (!resp.success) {
            setLoadError(resp.error.message);
            return;
          }
          const record = resp.data;
          loadGraphic(record.id, record.scene_data);
          historyClear();
          setViewport({ panX: 0, panY: 0, zoom: 1 });
        } catch (err) {
          setLoadError(err instanceof Error ? err.message : "Unknown error");
        } finally {
          setLoading(false);
        }
      }
    },
    [
      tabStoreSetActive,
      tabStoreSaveScene,
      tabStoreSaveViewport,
      loadGraphic,
      historyClear,
      setViewport,
      setActiveGroup,
    ],
  );

  /**
   * Request closing a tab. Shows save prompt if modified, otherwise closes immediately.
   * afterClose callback is called after the tab is actually removed.
   */
  const requestCloseTab = useCallback(
    (tabId: string, afterClose?: () => void) => {
      const tab = useTabStore.getState().getTab(tabId);
      if (!tab) return;

      const doClose = async () => {
        // If closing a graphic tab, first silently close all its group sub-tabs
        if (tab.type === "graphic") {
          tabStoreCloseGroupTabs(tab.graphicId);
          // If we were in a group sub-tab context, clear the active group
          setActiveGroup(null);
        }

        // If closing the active tab, save its current scene first (graphic tabs only)
        const currentActiveId = useTabStore.getState().activeTabId;
        if (currentActiveId === tabId && tab.type === "graphic") {
          const currentDoc = useSceneStore.getState().doc;
          if (currentDoc) {
            tabStoreSaveScene(tabId, currentDoc);
          }
        }

        const newActiveId = tabStoreCloseTab(tabId);

        // If there's a new active tab, restore it
        if (newActiveId) {
          const nextTab = useTabStore.getState().getTab(newActiveId);
          if (nextTab?.type === "group") {
            // Switching to a group sub-tab — restore viewport and group context
            setViewport(nextTab.viewport);
            setActiveGroup(nextTab.groupNodeId ?? null);
          } else if (nextTab?.savedScene) {
            // Same unsaved-tab guard as in switchToTab: placeholder IDs must not be
            // passed into loadGraphic or the save flow will try PUT instead of POST.
            if (nextTab.graphicId.startsWith("new-")) {
              const savedDoc = nextTab.savedScene.scene;
              useSceneStore.setState({
                doc: savedDoc,
                graphicId: null,
                isDirty: true,
                designMode: savedDoc.metadata.designMode,
                version: 0,
              });
              historyClear();
            } else {
              loadGraphic(nextTab.graphicId, nextTab.savedScene.scene);
              historyClear();
            }
            setViewport(nextTab.viewport);
            setActiveGroup(null);
          } else if (nextTab) {
            // Load from server if no saved scene
            setActiveGroup(null);
            setLoading(true);
            try {
              const resp = await graphicsApi.get(nextTab.graphicId);
              if (resp.success) {
                loadGraphic(resp.data.id, resp.data.scene_data);
                historyClear();
                setViewport({ panX: 0, panY: 0, zoom: 1 });
              }
            } finally {
              setLoading(false);
            }
          }
        } else {
          // No tabs left — clear scene, navigate to home
          setActiveGroup(null);
          useSceneStore.getState().reset();
          navigate("/designer/graphics");
        }
        afterClose?.();
      };

      // Group sub-tabs: no independent save prompt — changes persist via parent graphic
      if (tab.type === "group") {
        doClose();
        return;
      }

      if (tab.isModified) {
        setTabClosePrompt({
          tabId,
          graphicName: tab.graphicName,
          onAfterClose:
            afterClose ??
            (() => {
              /* noop */
            }),
        });
      } else {
        doClose();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [
      tabStoreCloseTab,
      tabStoreSaveScene,
      tabStoreCloseGroupTabs,
      loadGraphic,
      historyClear,
      setViewport,
      setActiveGroup,
      navigate,
    ],
  );

  /**
   * Save handler for the tab close prompt (Save button).
   * Saves the current doc, then closes the tab.
   */
  const handleTabPromptSave = useCallback(async () => {
    if (!tabClosePrompt) return;
    const { tabId, onAfterClose } = tabClosePrompt;

    setIsTabSaving(true);
    try {
      // If the tab being closed is active, its scene is in sceneStore already.
      // If not active, we need to temporarily work with its saved scene.
      const isActive = useTabStore.getState().activeTabId === tabId;
      const tab = useTabStore.getState().getTab(tabId);

      let docToSave = isActive
        ? useSceneStore.getState().doc
        : (tab?.savedScene?.scene ?? null);

      const gid = tab?.graphicId;
      if (!docToSave || !gid) {
        setTabClosePrompt(null);
        return;
      }

      const result = await graphicsApi.update(gid, {
        name: docToSave.name ?? "Untitled",
        scene_data: docToSave,
      });
      if (result.success) {
        tabStoreSetModified(tabId, false);
        if (isActive) {
          markClean();
          historyMarkClean();
        }
      }
    } catch (err) {
      console.error("[DesignerPage] Tab save failed:", err);
    } finally {
      setIsTabSaving(false);
    }

    setTabClosePrompt(null);
    // Now close without re-showing prompt
    const tab = useTabStore.getState().getTab(tabClosePrompt.tabId);
    if (tab) {
      // Temporarily mark as clean so requestCloseTab won't prompt again
      tabStoreSetModified(tabClosePrompt.tabId, false);
    }
    requestCloseTab(tabClosePrompt.tabId, onAfterClose);
  }, [
    tabClosePrompt,
    tabStoreSetModified,
    markClean,
    historyMarkClean,
    requestCloseTab,
  ]);

  // Sync isDirty → active tab's isModified
  // For group sub-tabs, also mark the parent graphic tab modified (changes go to shared scene).
  const isDirtyFromStore = useSceneStore((s) => s.isDirty);
  useEffect(() => {
    if (!activeTabId) return;
    const currentActiveTab = useTabStore.getState().getTab(activeTabId);
    if (currentActiveTab?.type === "group") {
      // Mark the group sub-tab itself
      tabStoreSetModified(activeTabId, isDirtyFromStore);
      // Also mark the parent graphic tab so the save indicator appears there
      const parentTab = useTabStore
        .getState()
        .tabs.find(
          (t) =>
            t.type === "graphic" && t.graphicId === currentActiveTab.graphicId,
        );
      if (parentTab) {
        tabStoreSetModified(parentTab.id, isDirtyFromStore);
      }
    } else {
      tabStoreSetModified(activeTabId, isDirtyFromStore);
    }
  }, [isDirtyFromStore, activeTabId, tabStoreSetModified]);

  // Sync graphicId param → open in tab (on route change)
  useEffect(() => {
    if (isNew || !graphicId) return;
    // If no active tab or the active tab is for a different graphic, open/switch
    const existingTab = tabStoreFindByGraphic(graphicId);
    if (!existingTab) {
      // Route-based open: create a tab for the graphic being navigated to
      const gName = doc?.name ?? graphicId;
      openGraphicInTab(graphicId, gName);
    } else if (useTabStore.getState().activeTabId !== existingTab.id) {
      switchToTab(existingTab.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphicId]);

  // -------------------------------------------------------------------------
  // Ctrl+S global save
  // -------------------------------------------------------------------------

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        handleSave({ explicit: true });
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSave]);

  // -------------------------------------------------------------------------
  // Tab keyboard shortcuts: Ctrl+W, Ctrl+Tab, Ctrl+Shift+Tab, Ctrl+1-9
  // -------------------------------------------------------------------------

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const ctrl = e.ctrlKey || e.metaKey;

      // Ctrl+W — close active tab
      if (ctrl && e.key === "w") {
        const currentTabs = useTabStore.getState().tabs;
        const currentActiveId = useTabStore.getState().activeTabId;
        if (currentTabs.length > 0 && currentActiveId) {
          e.preventDefault();
          requestCloseTab(currentActiveId);
        }
        return;
      }

      // Ctrl+Tab — next tab
      if (ctrl && !e.shiftKey && e.key === "Tab") {
        const currentTabs = useTabStore.getState().tabs;
        const currentActiveId = useTabStore.getState().activeTabId;
        if (currentTabs.length < 2) return;
        e.preventDefault();
        const idx = currentTabs.findIndex((t) => t.id === currentActiveId);
        const nextIdx = (idx + 1) % currentTabs.length;
        switchToTab(currentTabs[nextIdx].id);
        return;
      }

      // Ctrl+Shift+Tab — previous tab
      if (ctrl && e.shiftKey && e.key === "Tab") {
        const currentTabs = useTabStore.getState().tabs;
        const currentActiveId = useTabStore.getState().activeTabId;
        if (currentTabs.length < 2) return;
        e.preventDefault();
        const idx = currentTabs.findIndex((t) => t.id === currentActiveId);
        const prevIdx = (idx - 1 + currentTabs.length) % currentTabs.length;
        switchToTab(currentTabs[prevIdx].id);
        return;
      }

      // Ctrl+1–9 — jump to tab by 1-indexed position
      if (ctrl && e.key >= "1" && e.key <= "9") {
        const currentTabs = useTabStore.getState().tabs;
        if (currentTabs.length === 0) return;
        const pos = parseInt(e.key, 10) - 1;
        if (pos < currentTabs.length) {
          e.preventDefault();
          switchToTab(currentTabs[pos].id);
        }
      }
    }

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [requestCloseTab, switchToTab]);

  // -------------------------------------------------------------------------
  // Auto-save to IndexedDB (every 60s when dirty)
  // -------------------------------------------------------------------------

  const isDirty = useSceneStore((s) => s.isDirty);

  useEffect(() => {
    if (typeof window === "undefined" || !window.indexedDB) return;

    const STORE = "designer-autosave";
    const DB_NAME = "io-designer";
    const DB_VERSION = 2;

    // Open/upgrade IndexedDB
    const openReq = indexedDB.open(DB_NAME, DB_VERSION);
    openReq.onupgradeneeded = () => {
      const upgradeDb = openReq.result;
      if (!upgradeDb.objectStoreNames.contains(STORE)) {
        upgradeDb.createObjectStore(STORE);
      }
    };

    let db: IDBDatabase | null = null;
    openReq.onsuccess = () => {
      db = openReq.result;

      // Check for crash recovery on first open
      const key = graphicId ?? "__new__";
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => {
        if (req.result) {
          const { doc: savedDoc, savedAt } = req.result as {
            doc: unknown;
            savedAt: number;
          };
          // Only offer recovery if there's something meaningful
          if (savedDoc && !doc && !isNew) {
            setCrashRecovery({ id: key, savedAt, savedDoc });
          }
        }
      };
    };

    const interval = setInterval(() => {
      if (!isDirty || !db) return;
      const currentDoc = useSceneStore.getState().doc;
      if (!currentDoc) return;
      const key = graphicId ?? "__new__";
      try {
        const now = Date.now();
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put({ doc: currentDoc, savedAt: now }, key);
        setLastAutoSave(now);
      } catch {
        // Silently ignore IDB errors
      }
    }, 60_000);

    return () => {
      clearInterval(interval);
      if (db) db.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [graphicId, isNew]);

  // -------------------------------------------------------------------------
  // New graphic dialog confirm
  // -------------------------------------------------------------------------

  function handleNewConfirm(
    name: string,
    mode: "graphic" | "dashboard" | "report",
    width: number,
    height: number,
    autoHeight: boolean,
    scope: "console" | "process" | null,
  ) {
    // Save the outgoing tab's scene and viewport before replacing it with the new document.
    // Without this, the previous graphic is lost: newDocument() replaces the scene in
    // sceneStore immediately, and the outgoing tab's savedScene slot remains null.
    // When the user later clicks the original tab, switchToTab() would find savedScene=null
    // and attempt a server fetch using the placeholder 'new-...' ID — which fails.
    const outgoingTabId = useTabStore.getState().activeTabId;
    if (outgoingTabId) {
      const currentDoc = useSceneStore.getState().doc;
      if (currentDoc) {
        tabStoreSaveScene(outgoingTabId, currentDoc);
      }
      tabStoreSaveViewport(outgoingTabId, useUiStore.getState().viewport);
    }

    newDocument(mode, name, width, height, autoHeight, scope ?? "console");
    historyClear();
    setShowNewDialog(false);
    // Register a placeholder tab with a unique ID so that opening multiple new graphics
    // each gets its own tab (the static 'new' string caused idempotency collisions).
    tabStoreOpenTab("new-" + crypto.randomUUID(), name);
  }

  function handleNewCancel() {
    setShowNewDialog(false);
    if (!isNew) {
      // Dialog was opened from toolbar (not via /new route) — just close it, stay on current URL.
      return;
    }
    // On the /new route — find a tab to return to instead of going to DesignerHome.
    const currentTabs = useTabStore.getState().tabs;
    const currentActiveId = useTabStore.getState().activeTabId;
    const targetTab =
      currentTabs.find((t) => t.id === currentActiveId) ??
      currentTabs[currentTabs.length - 1] ??
      null;
    if (!targetTab) {
      navigate("/designer/graphics");
      return;
    }
    if (!targetTab.graphicId.startsWith("new-")) {
      // Saved tab — navigate to its edit URL.
      navigate(`/designer/graphics/${targetTab.graphicId}/edit`, {
        replace: true,
      });
    } else if (targetTab.savedScene) {
      // Unsaved tab — restore scene directly, stay on /new (dialog is already closed).
      tabStoreSetActive(targetTab.id);
      loadGraphic(null as unknown as string, targetTab.savedScene.scene);
      historyClear();
    } else {
      navigate("/designer/graphics");
    }
  }

  // -------------------------------------------------------------------------
  // Panel resize handlers
  // -------------------------------------------------------------------------

  const handleLeftDividerDrag = useCallback((dx: number) => {
    setLeftWidth((w) => Math.max(160, Math.min(480, w + dx)));
  }, []);

  const handleRightDividerDrag = useCallback((dx: number) => {
    setRightWidth((w) => Math.max(200, Math.min(520, w - dx)));
  }, []);

  // -------------------------------------------------------------------------
  // Collapse toggle buttons
  // -------------------------------------------------------------------------

  function CollapseBtn({
    side,
    collapsed,
    onToggle,
  }: {
    side: "left" | "right";
    collapsed: boolean;
    onToggle: () => void;
  }) {
    const label =
      side === "left" ? (collapsed ? "▶" : "◀") : collapsed ? "◀" : "▶";
    return (
      <button
        onClick={onToggle}
        title={collapsed ? `Expand ${side} panel` : `Collapse ${side} panel`}
        style={{
          position: "absolute",
          top: "50%",
          transform: "translateY(-50%)",
          ...(side === "left" ? { right: -10 } : { left: -10 }),
          zIndex: 20,
          width: 14,
          height: 32,
          background: "var(--io-surface-elevated)",
          border: "1px solid var(--io-border)",
          borderRadius: side === "left" ? "0 4px 4px 0" : "4px 0 0 4px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 8,
          color: "var(--io-text-muted)",
          padding: 0,
        }}
      >
        {label}
      </button>
    );
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
        background: "var(--io-surface-primary)",
      }}
    >
      {/* New graphic dialog */}
      {showNewDialog && (
        <NewGraphicDialog
          onConfirm={handleNewConfirm}
          onCancel={handleNewCancel}
          initialMode={routeInitialMode}
        />
      )}

      {/* Crash recovery banner */}
      {crashRecovery && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 2100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              background: "var(--io-surface-elevated)",
              border: "1px solid var(--io-border)",
              borderRadius: "var(--io-radius)",
              boxShadow: "0 12px 32px rgba(0,0,0,0.5)",
              padding: "24px 28px",
              maxWidth: 460,
              width: "100%",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <div
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: "var(--io-text-primary)",
              }}
            >
              Recover Unsaved Changes?
            </div>
            <div
              style={{
                fontSize: 13,
                color: "var(--io-text-secondary)",
                lineHeight: 1.5,
              }}
            >
              Auto-saved changes were found from{" "}
              <strong>
                {new Date(crashRecovery.savedAt).toLocaleTimeString()}
              </strong>{" "}
              ({new Date(crashRecovery.savedAt).toLocaleDateString()}). Would
              you like to recover them?
            </div>
            <div
              style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}
            >
              <button
                onClick={() => setShowCrashPreview(true)}
                style={{
                  padding: "6px 14px",
                  fontSize: 12,
                  background: "transparent",
                  border: "1px solid var(--io-border)",
                  borderRadius: "var(--io-radius)",
                  color: "var(--io-text-secondary)",
                  cursor: "pointer",
                }}
              >
                Preview
              </button>
              <button
                onClick={() => {
                  // Discard — delete the auto-save from IndexedDB and load normally
                  const STORE = "designer-autosave";
                  const openReq = indexedDB.open("io-designer", 1);
                  openReq.onsuccess = () => {
                    try {
                      const db = openReq.result;
                      const tx = db.transaction(STORE, "readwrite");
                      tx.objectStore(STORE).delete(crashRecovery.id);
                      db.close();
                    } catch {
                      /* best-effort */
                    }
                  };
                  setCrashRecovery(null);
                }}
                style={{
                  padding: "6px 14px",
                  fontSize: 12,
                  background: "transparent",
                  border: "1px solid var(--io-border)",
                  borderRadius: "var(--io-radius)",
                  color: "var(--io-text-secondary)",
                  cursor: "pointer",
                }}
              >
                Discard
              </button>
              <button
                onClick={() => {
                  // Recover — load the auto-saved doc into the editor
                  if (crashRecovery.savedDoc) {
                    try {
                      const savedSceneGraph = crashRecovery.savedDoc;
                      if (graphicId) {
                        loadGraphic(
                          graphicId,
                          savedSceneGraph as Parameters<typeof loadGraphic>[1],
                        );
                      }
                    } catch {
                      /* ignore parse errors */
                    }
                    // Delete auto-save after recovery
                    const STORE = "designer-autosave";
                    const openReq = indexedDB.open("io-designer", 1);
                    openReq.onsuccess = () => {
                      try {
                        const db = openReq.result;
                        const tx = db.transaction(STORE, "readwrite");
                        tx.objectStore(STORE).delete(crashRecovery.id);
                        db.close();
                      } catch {
                        /* best-effort */
                      }
                    };
                  }
                  setCrashRecovery(null);
                }}
                style={{
                  padding: "6px 14px",
                  fontSize: 12,
                  background: "var(--io-accent)",
                  border: "none",
                  borderRadius: "var(--io-radius)",
                  color: "#000",
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Recover
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Crash recovery split-view preview overlay (spec §18 [Preview]) */}
      {crashRecovery &&
        showCrashPreview &&
        (() => {
          const currentDoc = useSceneStore.getState().doc;
          const savedDoc = crashRecovery.savedDoc as
            | import("../../shared/types/graphics").GraphicDocument
            | null;
          return (
            <div
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: "rgba(0,0,0,0.85)",
                zIndex: 2200,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div
                style={{
                  padding: "10px 16px",
                  background: "var(--io-surface)",
                  borderBottom: "1px solid var(--io-border)",
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                }}
              >
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "var(--io-text-primary)",
                  }}
                >
                  Preview: Compare Versions
                </span>
                <span
                  style={{ fontSize: 12, color: "var(--io-text-secondary)" }}
                >
                  Left: Current server version — Right: Auto-saved{" "}
                  {new Date(crashRecovery.savedAt).toLocaleTimeString()}
                </span>
                <button
                  onClick={() => setShowCrashPreview(false)}
                  style={{
                    marginLeft: "auto",
                    padding: "4px 12px",
                    fontSize: 12,
                    background: "transparent",
                    border: "1px solid var(--io-border)",
                    borderRadius: "var(--io-radius)",
                    color: "var(--io-text-secondary)",
                    cursor: "pointer",
                  }}
                >
                  Close Preview
                </button>
              </div>
              <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
                <div
                  style={{
                    flex: 1,
                    borderRight: "2px solid var(--io-border)",
                    overflow: "hidden",
                    position: "relative",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: 8,
                      left: 8,
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--io-text-secondary)",
                      background: "var(--io-surface)",
                      padding: "2px 8px",
                      borderRadius: 4,
                      border: "1px solid var(--io-border)",
                    }}
                  >
                    Server version
                  </div>
                  {currentDoc && <SceneRenderer document={currentDoc} />}
                </div>
                <div
                  style={{ flex: 1, overflow: "hidden", position: "relative" }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: 8,
                      left: 8,
                      fontSize: 11,
                      fontWeight: 600,
                      color: "var(--io-accent)",
                      background: "var(--io-surface)",
                      padding: "2px 8px",
                      borderRadius: 4,
                      border: "1px solid var(--io-accent)",
                      zIndex: 1,
                    }}
                  >
                    Auto-saved version
                  </div>
                  {savedDoc && <SceneRenderer document={savedDoc} />}
                </div>
              </div>
            </div>
          );
        })()}

      {/* Pessimistic lock banner — shown when the graphic is locked by someone else */}
      {lockState && (
        <div
          style={{
            background: "#7c3aed22",
            borderBottom: "1px solid #7c3aed55",
            padding: "6px 16px",
            display: "flex",
            alignItems: "center",
            gap: 12,
            fontSize: 12,
            color: "var(--io-text-primary)",
            flexShrink: 0,
          }}
        >
          <span style={{ color: "#a78bfa", fontWeight: 600 }}>Read-only</span>
          <span style={{ color: "var(--io-text-muted)" }}>
            Locked by{" "}
            <strong style={{ color: "var(--io-text-primary)" }}>
              {lockState.lockedByName}
            </strong>{" "}
            since{" "}
            {new Date(lockState.lockedAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button
              onClick={async () => {
                // Fork: Save As — create a copy the current user can edit
                const currentDoc = useSceneStore.getState().doc;
                if (!currentDoc) return;
                const copyName = `${currentDoc.name ?? "Untitled"} (copy)`;
                const resp = await graphicsApi
                  .create({ name: copyName, scene_data: currentDoc })
                  .catch(() => null);
                if (resp?.success) {
                  navigate(`/designer/graphics/${resp.data.id}/edit`);
                }
              }}
              style={{
                padding: "3px 10px",
                background: "var(--io-surface-elevated)",
                border: "1px solid var(--io-border)",
                borderRadius: "var(--io-radius)",
                color: "var(--io-text-primary)",
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              Fork (Save As)
            </button>
          </div>
        </div>
      )}

      {/* Version history dialog */}
      <VersionHistoryDialog
        open={showVersionHistory}
        onClose={() => setShowVersionHistory(false)}
        graphicId={graphicId ?? null}
        onPreview={handlePreviewVersion}
        onRestore={handleRestoreVersion}
      />

      {/* Validate bindings dialog */}
      <ValidateBindingsDialog
        open={showValidateBindings}
        onClose={() => setShowValidateBindings(false)}
        unresolvedBindings={bindingValidation.unresolvedBindings}
        totalBound={bindingValidation.totalBound}
        resolvedCount={bindingValidation.resolvedCount}
      />

      {/* Import wizard */}
      {showImportWizard && (
        <IographicImportWizard
          onClose={() => setShowImportWizard(false)}
          onImported={(result) => {
            setShowImportWizard(false);
            // Navigate to the first imported graphic so it can be edited
            if (result.graphic_ids.length > 0) {
              navigate(`/designer/graphics/${result.graphic_ids[0]}/edit`);
            }
          }}
        />
      )}

      {/* Export dialog */}
      {showExportDialog && doc && (
        <IographicExportDialog
          graphicId={graphicIdInStore ?? ""}
          graphicName={doc.name ?? "Untitled"}
          onClose={() => setShowExportDialog(false)}
        />
      )}

      {/* Canvas properties dialog */}
      {showPropertiesDialog && (
        <CanvasPropertiesDialog
          onClose={() => setShowPropertiesDialog(false)}
        />
      )}

      {/* Mode tabs */}
      <DesignerModeTabs
        onSave={handleExplicitSave}
        onShowVersionHistory={() => setShowVersionHistory(true)}
        onValidateBindings={handleValidateBindings}
        onImport={() => setShowImportWizard(true)}
        onExport={() => setShowExportDialog(true)}
        onExportSvg={handleExportSvg}
        onNew={() => setShowNewDialog(true)}
        onOpen={() => navigate("/designer/graphics")}
        onProperties={() => setShowPropertiesDialog(true)}
      />

      {/* Tab close prompt */}
      {tabClosePrompt && (
        <TabClosePrompt
          graphicName={tabClosePrompt.graphicName}
          isSaving={isTabSaving}
          onSave={handleTabPromptSave}
          onDiscard={() => {
            const { tabId, onAfterClose } = tabClosePrompt;
            setTabClosePrompt(null);
            tabStoreSetModified(tabId, false);
            requestCloseTab(tabId, onAfterClose);
          }}
          onCancel={() => setTabClosePrompt(null)}
        />
      )}

      {/* Delete confirmation */}
      <ConfirmDialog
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Delete graphic?"
        description={`"${doc?.name ?? "Untitled"}" will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
        onConfirm={handleDeleteActiveGraphic}
      />

      {/* Toolbar */}
      <DesignerToolbar
        onSave={handleExplicitSave}
        isSaving={isSaving}
        onPublish={canPublish ? handlePublish : undefined}
        isPublishing={isPublishing}
        onShowVersionHistory={() => setShowVersionHistory(true)}
        onValidateBindings={handleValidateBindings}
        onNew={() => setShowNewDialog(true)}
        onDelete={
          canDelete && graphicIdInStore && !graphicIdInStore.startsWith("new-")
            ? () => setShowDeleteConfirm(true)
            : undefined
        }
        canDelete={
          canDelete && !!graphicIdInStore && !graphicIdInStore.startsWith("new-")
        }
      />

      {/* File tab bar — between toolbar and canvas area */}
      <DesignerTabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onSwitchTab={switchToTab}
        onCloseTab={(tabId) => requestCloseTab(tabId)}
        onCloseOthers={(keepTabId) => {
          const toClose = tabStoreCloseOthers(keepTabId);
          // Save prompt for each modified tab being closed
          // Process sequentially
          const modifiedTabs = toClose.filter((t) => t.isModified);
          modifiedTabs.forEach((t) => {
            graphicsApi
              .update(t.graphicId, {
                name: t.savedScene?.scene.name ?? "Untitled",
                scene_data:
                  t.savedScene?.scene ?? useSceneStore.getState().doc!,
              })
              .catch(() => {
                /* best-effort */
              });
          });
          // Switch to the kept tab
          switchToTab(keepTabId);
        }}
        onCloseAll={() => {
          const toClose = tabStoreCloseAll();
          const modifiedTabs = toClose.filter((t) => t.isModified);
          modifiedTabs.forEach((t) => {
            const sceneToSave = t.savedScene?.scene ?? null;
            if (sceneToSave) {
              graphicsApi
                .update(t.graphicId, {
                  name: sceneToSave.name ?? "Untitled",
                  scene_data: sceneToSave,
                })
                .catch(() => {
                  /* best-effort */
                });
            }
          });
          useSceneStore.getState().reset();
          navigate("/designer/graphics");
        }}
      />

      {/* Body */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Left palette */}
        {!leftCollapsed && (
          <div
            style={{
              width: leftWidth,
              flexShrink: 0,
              position: "relative",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <ErrorBoundary module="Designer Palette">
              <DesignerLeftPalette collapsed={false} width={leftWidth} />
            </ErrorBoundary>
            <CollapseBtn
              side="left"
              collapsed={false}
              onToggle={() => setLeftCollapsed(true)}
            />
          </div>
        )}

        {/* Left divider */}
        {!leftCollapsed && <VerticalDivider onDrag={handleLeftDividerDrag} />}

        {/* Collapsed left re-expand tab */}
        {leftCollapsed && (
          <button
            onClick={() => setLeftCollapsed(false)}
            title="Expand left panel"
            style={{
              width: 16,
              flexShrink: 0,
              background: "var(--io-surface)",
              border: "none",
              borderRight: "1px solid var(--io-border)",
              cursor: "pointer",
              color: "var(--io-text-muted)",
              fontSize: 9,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ▶
          </button>
        )}

        {/* Canvas */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            minWidth: 200,
          }}
        >
          {loading && <LoadingSkeleton />}
          {loadError && <ErrorState message={loadError} onRetry={loadDoc} />}
          {!loading && !loadError && (
            <ErrorBoundary module="Designer Canvas">
              <DesignerCanvas
                style={{ flex: 1 }}
                onPropertiesOpen={() => setShowPropertiesDialog(true)}
                onOpenGroupInTab={openGroupInTab}
                groupSubTabNodeId={
                  activeTab?.type === "group"
                    ? (activeTab.groupNodeId ?? null)
                    : null
                }
              />
            </ErrorBoundary>
          )}
        </div>

        {/* Right divider */}
        {!rightCollapsed && <VerticalDivider onDrag={handleRightDividerDrag} />}

        {/* Collapsed right re-expand tab */}
        {rightCollapsed && (
          <button
            onClick={() => setRightCollapsed(false)}
            title="Expand right panel"
            style={{
              width: 16,
              flexShrink: 0,
              background: "var(--io-surface)",
              border: "none",
              borderLeft: "1px solid var(--io-border)",
              cursor: "pointer",
              color: "var(--io-text-muted)",
              fontSize: 9,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ◀
          </button>
        )}

        {/* Right panel */}
        {!rightCollapsed && (
          <div
            style={{
              width: rightWidth,
              flexShrink: 0,
              position: "relative",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <ErrorBoundary module="Designer Properties">
              <DesignerRightPanel collapsed={false} width={rightWidth} />
            </ErrorBoundary>
            <CollapseBtn
              side="right"
              collapsed={false}
              onToggle={() => setRightCollapsed(true)}
            />
          </div>
        )}
      </div>

      {/* Status bar */}
      <DesignerStatusBar
        wsConnected={wsConnected}
        lastAutoSave={lastAutoSave}
        onValidateBindings={handleValidateBindings}
      />
    </div>
  );
}
