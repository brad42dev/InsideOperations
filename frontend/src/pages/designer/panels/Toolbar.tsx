import React, { useState, useRef, useEffect } from "react";
import type { DrawingTool, DesignerMode } from "../types";

export interface ToolbarProps {
  activeTool: DrawingTool;
  onToolChange: (tool: DrawingTool) => void;
  gridEnabled: boolean;
  onGridToggle: () => void;
  snapEnabled: boolean;
  onSnapToggle: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomFit: () => void;
  onZoomSet: (z: number) => void;
  onImageImport: () => void;
  zoom: number;
  mode: DesignerMode;
  // Undo/Redo
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  // Test mode
  testMode: boolean;
  onTestModeToggle: () => void;
  // Validate
  onValidateBindings: () => void;
  // Phone preview
  onPhonePreview: () => void;
  // File menu
  onFileImport: () => void;
  onFileExportSvg: () => void;
  onVersionHistory: () => void;
  onProperties: () => void;
  // Save/Publish
  isDirty: boolean;
  onSave: () => void;
  onPublish: () => void;
  // Focus
  focusMode: boolean;
  onFocusModeToggle: () => void;
}

// ---- Styles ----
const toolbarStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "2px",
  padding: "4px 8px",
  background: "var(--io-surface-secondary)",
  borderBottom: "1px solid var(--io-border)",
  flexShrink: 0,
  height: "40px",
  userSelect: "none",
};

const separatorStyle: React.CSSProperties = {
  width: "1px",
  height: "20px",
  background: "var(--io-border-subtle)",
  margin: "0 4px",
  flexShrink: 0,
};

// ---- SVG Icon components ----
function IconSelect() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M3 2L3 12L6.5 9.5L8.5 14L10 13.3L8 8.5L12 8L3 2Z"
        fill="currentColor"
      />
    </svg>
  );
}
function IconPen() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M11 2L14 5L5 14H2V11L11 2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        fill="none"
      />
      <line
        x1="9"
        y1="4"
        x2="12"
        y2="7"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}
function IconRect() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect
        x="2"
        y="3.5"
        width="12"
        height="9"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
    </svg>
  );
}
function IconEllipse() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <ellipse
        cx="8"
        cy="8"
        rx="6"
        ry="4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
      />
    </svg>
  );
}
function IconLine() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <line
        x1="2"
        y1="14"
        x2="14"
        y2="2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
function IconText() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M2 3.5H14M8 3.5V13M5.5 13H10.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IconUndo() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M4 6L2 8L4 10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M2 8H10C12.2091 8 14 9.79086 14 12V12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
function IconRedo() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M12 6L14 8L12 10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 8H6C3.79086 8 2 9.79086 2 12V12"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
function IconZoomIn() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
      <line
        x1="7"
        y1="5"
        x2="7"
        y2="9"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="5"
        y1="7"
        x2="9"
        y2="7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="10.5"
        y1="10.5"
        x2="14"
        y2="14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
function IconZoomOut() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.5" />
      <line
        x1="5"
        y1="7"
        x2="9"
        y2="7"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <line
        x1="10.5"
        y1="10.5"
        x2="14"
        y2="14"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
function IconFit() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M2 6V2H6M10 2H14V6M14 10V14H10M6 14H2V10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect
        x="5"
        y="5"
        width="6"
        height="6"
        rx="0.5"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
      />
    </svg>
  );
}
function IconGrid() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <line
        x1="6"
        y1="2"
        x2="6"
        y2="14"
        stroke="currentColor"
        strokeWidth="1"
        strokeOpacity="0.7"
      />
      <line
        x1="10"
        y1="2"
        x2="10"
        y2="14"
        stroke="currentColor"
        strokeWidth="1"
        strokeOpacity="0.7"
      />
      <line
        x1="2"
        y1="6"
        x2="14"
        y2="6"
        stroke="currentColor"
        strokeWidth="1"
        strokeOpacity="0.7"
      />
      <line
        x1="2"
        y1="10"
        x2="14"
        y2="10"
        stroke="currentColor"
        strokeWidth="1"
        strokeOpacity="0.7"
      />
    </svg>
  );
}
function IconSnap() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect
        x="2"
        y="2"
        width="5"
        height="5"
        rx="0.5"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
      />
      <rect
        x="9"
        y="9"
        width="5"
        height="5"
        rx="0.5"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
      />
      <circle cx="4.5" cy="4.5" r="1" fill="currentColor" />
      <circle cx="11.5" cy="11.5" r="1" fill="currentColor" />
      <line
        x1="4.5"
        y1="4.5"
        x2="11.5"
        y2="11.5"
        stroke="currentColor"
        strokeWidth="1"
        strokeDasharray="2 2"
      />
    </svg>
  );
}
function IconValidate() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M3 8L6.5 11.5L13 4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IconPhone() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect
        x="4"
        y="1.5"
        width="8"
        height="13"
        rx="1.5"
        stroke="currentColor"
        strokeWidth="1.3"
        fill="none"
      />
      <line
        x1="6.5"
        y1="12.5"
        x2="9.5"
        y2="12.5"
        stroke="currentColor"
        strokeWidth="1"
        strokeLinecap="round"
      />
    </svg>
  );
}
function IconFile() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M4 2H10L13 5V14H4V2Z"
        stroke="currentColor"
        strokeWidth="1.3"
        fill="none"
        strokeLinejoin="round"
      />
      <path
        d="M10 2V5H13"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IconSave() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M3 2H11L14 5V13C14 13.5523 13.5523 14 13 14H3C2.44772 14 2 13.5523 2 13V3C2 2.44772 2.44772 2 3 2Z"
        stroke="currentColor"
        strokeWidth="1.3"
        fill="none"
      />
      <rect
        x="5"
        y="9"
        width="6"
        height="5"
        rx="0.5"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
      />
      <rect
        x="5"
        y="2"
        width="5"
        height="3"
        rx="0.5"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
      />
    </svg>
  );
}
function IconPublish() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M8 2L8 10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M5 5L8 2L11 5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 11V13H13V11"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function IconFocus() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path
        d="M2 5V2H5M11 2H14V5M14 11V14H11M5 14H2V11"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ---- Button components ----
function ToolBtn({
  icon,
  title,
  active,
  onClick,
  disabled,
}: {
  icon: React.ReactNode;
  title: string;
  active?: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "30px",
        height: "30px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: disabled ? "default" : "pointer",
        border: active ? "1px solid var(--io-accent)" : "1px solid transparent",
        borderRadius: "var(--io-radius)",
        background: active ? "var(--io-accent-subtle)" : "transparent",
        color: disabled
          ? "var(--io-text-muted)"
          : active
            ? "var(--io-accent)"
            : "var(--io-text-secondary)",
        opacity: disabled ? 0.4 : 1,
        transition: "background 0.1s, color 0.1s, border-color 0.1s",
        padding: 0,
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        if (!active && !disabled) {
          e.currentTarget.style.background = "var(--io-surface-primary)";
          e.currentTarget.style.color = "var(--io-text-primary)";
        }
      }}
      onMouseLeave={(e) => {
        if (!active && !disabled) {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "var(--io-text-secondary)";
        }
      }}
    >
      {icon}
    </button>
  );
}

function ToggleBtn({
  icon,
  title,
  active,
  label,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  active: boolean;
  label?: string;
  onClick: () => void;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      style={{
        height: "30px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: label ? "3px" : 0,
        padding: label ? "0 6px" : "0",
        width: label ? "auto" : "30px",
        cursor: "pointer",
        border: active
          ? "1px solid var(--io-accent)"
          : "1px solid var(--io-border)",
        borderRadius: "var(--io-radius)",
        background: active ? "var(--io-accent-subtle)" : "transparent",
        color: active ? "var(--io-accent)" : "var(--io-text-muted)",
        fontSize: "11px",
        flexShrink: 0,
      }}
    >
      {icon}
      {label && <span>{label}</span>}
    </button>
  );
}

function LabelBtn({
  icon,
  label,
  title,
  onClick,
  accent,
  disabled,
}: {
  icon?: React.ReactNode;
  label: string;
  title: string;
  onClick: () => void;
  accent?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        height: "30px",
        display: "flex",
        alignItems: "center",
        gap: "4px",
        padding: "0 10px",
        cursor: disabled ? "default" : "pointer",
        border: accent ? "none" : "1px solid var(--io-border)",
        borderRadius: "var(--io-radius)",
        background: accent ? "var(--io-accent)" : "transparent",
        color: accent ? "#09090b" : "var(--io-text-secondary)",
        fontSize: "12px",
        fontWeight: accent ? 600 : 400,
        flexShrink: 0,
        opacity: disabled ? 0.5 : 1,
      }}
      onMouseEnter={(e) => {
        if (!accent && !disabled) {
          e.currentTarget.style.background = "var(--io-surface-primary)";
          e.currentTarget.style.color = "var(--io-text-primary)";
        }
      }}
      onMouseLeave={(e) => {
        if (!accent && !disabled) {
          e.currentTarget.style.background = "transparent";
          e.currentTarget.style.color = "var(--io-text-secondary)";
        }
      }}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

// ---- Zoom popover ----
const ZOOM_PRESETS = [25, 50, 75, 100, 150, 200, 400];

function ZoomPopover({
  zoom,
  onZoomSet,
  onClose,
}: {
  zoom: number;
  onZoomSet: (z: number) => void;
  onClose: () => void;
}) {
  const [custom, setCustom] = useState(String(Math.round(zoom * 100)));
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        top: "100%",
        left: 0,
        marginTop: "2px",
        background: "var(--io-surface-elevated)",
        border: "1px solid var(--io-border)",
        borderRadius: "var(--io-radius)",
        padding: "4px",
        zIndex: 200,
        minWidth: "100px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
      }}
    >
      {ZOOM_PRESETS.map((p) => (
        <button
          key={p}
          onClick={() => {
            onZoomSet(p / 100);
            onClose();
          }}
          style={{
            display: "block",
            width: "100%",
            padding: "4px 8px",
            fontSize: "12px",
            border: "none",
            background:
              Math.round(zoom * 100) === p
                ? "var(--io-accent-subtle)"
                : "transparent",
            color:
              Math.round(zoom * 100) === p
                ? "var(--io-accent)"
                : "var(--io-text-primary)",
            cursor: "pointer",
            textAlign: "left",
            borderRadius: "2px",
          }}
        >
          {p}%
        </button>
      ))}
      <div
        style={{
          borderTop: "1px solid var(--io-border-subtle)",
          margin: "4px 0",
        }}
      />
      <div style={{ display: "flex", gap: "4px", padding: "0 4px" }}>
        <input
          type="number"
          min={10}
          max={800}
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              const v = parseInt(custom, 10);
              if (v >= 10 && v <= 800) {
                onZoomSet(v / 100);
                onClose();
              }
            }
          }}
          style={{
            flex: 1,
            width: "60px",
            padding: "3px 6px",
            fontSize: "12px",
            border: "1px solid var(--io-border)",
            borderRadius: "var(--io-radius)",
            background: "var(--io-surface-sunken)",
            color: "var(--io-text-primary)",
            outline: "none",
          }}
        />
        <span
          style={{
            fontSize: "12px",
            color: "var(--io-text-muted)",
            lineHeight: "26px",
          }}
        >
          %
        </span>
      </div>
    </div>
  );
}

// ---- File menu dropdown ----
function FileMenu({
  onImport,
  onExportSvg,
  onVersionHistory,
  onProperties,
  onClose,
}: {
  onImport: () => void;
  onExportSvg: () => void;
  onVersionHistory: () => void;
  onProperties: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClose]);

  const items = [
    { label: "Import...", action: onImport },
    { label: "Export SVG", action: onExportSvg },
    { label: "divider", action: () => {} },
    { label: "Version History...", action: onVersionHistory },
    { label: "Properties...", action: onProperties },
  ];

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        top: "100%",
        right: 0,
        marginTop: "2px",
        background: "var(--io-surface-elevated)",
        border: "1px solid var(--io-border)",
        borderRadius: "var(--io-radius)",
        padding: "4px",
        zIndex: 200,
        minWidth: "160px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
      }}
    >
      {items.map((item, i) =>
        item.label === "divider" ? (
          <div
            key={i}
            style={{
              borderTop: "1px solid var(--io-border-subtle)",
              margin: "4px 0",
            }}
          />
        ) : (
          <button
            key={item.label}
            onClick={() => {
              item.action();
              onClose();
            }}
            style={{
              display: "block",
              width: "100%",
              padding: "5px 10px",
              fontSize: "12px",
              border: "none",
              background: "transparent",
              color: "var(--io-text-primary)",
              cursor: "pointer",
              textAlign: "left",
              borderRadius: "2px",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--io-accent-subtle)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            {item.label}
          </button>
        ),
      )}
    </div>
  );
}

// ---- Draw tools definition ----
const DRAW_TOOLS: {
  tool: DrawingTool;
  icon: React.ReactNode;
  title: string;
}[] = [
  { tool: "select", icon: <IconSelect />, title: "Select (V)" },
  { tool: "pencil", icon: <IconPen />, title: "Pen / Freehand (F)" },
  { tool: "rect", icon: <IconRect />, title: "Rectangle (R)" },
  { tool: "ellipse", icon: <IconEllipse />, title: "Ellipse (E)" },
  { tool: "line", icon: <IconLine />, title: "Line (L)" },
  { tool: "text", icon: <IconText />, title: "Text (T)" },
];

// ---- Main component ----
export default function Toolbar(props: ToolbarProps) {
  const {
    activeTool,
    onToolChange,
    gridEnabled,
    onGridToggle,
    snapEnabled,
    onSnapToggle,
    onZoomIn,
    onZoomOut,
    onZoomFit,
    onZoomSet,
    zoom,
    mode,
    canUndo,
    canRedo,
    onUndo,
    onRedo,
    testMode,
    onTestModeToggle,
    onValidateBindings,
    onPhonePreview,
    onFileImport,
    onFileExportSvg,
    onVersionHistory,
    onProperties,
    isDirty,
    onSave,
    onPublish,
    focusMode,
    onFocusModeToggle,
  } = props;

  const [showZoom, setShowZoom] = useState(false);
  const [showFileMenu, setShowFileMenu] = useState(false);

  return (
    <div style={toolbarStyle}>
      {/* Drawing tools */}
      {DRAW_TOOLS.map(({ tool, icon, title }) => (
        <ToolBtn
          key={tool}
          icon={icon}
          title={title}
          active={activeTool === tool}
          onClick={() => onToolChange(tool)}
        />
      ))}

      <div style={separatorStyle} />

      {/* Canvas controls */}
      <ToggleBtn
        icon={<IconSnap />}
        title="Snap to grid"
        active={snapEnabled}
        onClick={onSnapToggle}
      />
      <ToggleBtn
        icon={<IconGrid />}
        title="Show grid"
        active={gridEnabled}
        onClick={onGridToggle}
      />

      <div style={separatorStyle} />

      {/* Undo/Redo */}
      <ToolBtn
        icon={<IconUndo />}
        title="Undo (Ctrl+Z)"
        onClick={onUndo}
        disabled={!canUndo}
      />
      <ToolBtn
        icon={<IconRedo />}
        title="Redo (Ctrl+Shift+Z)"
        onClick={onRedo}
        disabled={!canRedo}
      />

      <div style={separatorStyle} />

      {/* Zoom */}
      <div
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: "2px",
        }}
      >
        <button
          onClick={() => setShowZoom(!showZoom)}
          style={{
            height: "30px",
            minWidth: "50px",
            padding: "0 6px",
            fontSize: "11px",
            fontVariantNumeric: "tabular-nums",
            color: "var(--io-text-secondary)",
            background: "transparent",
            border: "1px solid var(--io-border)",
            borderRadius: "var(--io-radius)",
            cursor: "pointer",
            textAlign: "center",
          }}
        >
          {Math.round(zoom * 100)}%
        </button>
        {showZoom && (
          <ZoomPopover
            zoom={zoom}
            onZoomSet={onZoomSet}
            onClose={() => setShowZoom(false)}
          />
        )}
      </div>
      <ToolBtn
        icon={<IconFit />}
        title="Fit to screen (Ctrl+0)"
        onClick={onZoomFit}
      />
      <ToolBtn
        icon={<IconZoomIn />}
        title="Zoom in (Ctrl+=)"
        onClick={onZoomIn}
      />
      <ToolBtn
        icon={<IconZoomOut />}
        title="Zoom out (Ctrl+-)"
        onClick={onZoomOut}
      />

      <div style={separatorStyle} />

      {/* Validate + Test */}
      <LabelBtn
        icon={<IconValidate />}
        label="Validate"
        title="Validate point bindings"
        onClick={onValidateBindings}
      />
      <button
        onClick={onTestModeToggle}
        title={
          testMode ? "Stop test mode" : "Start test mode — connect to live data"
        }
        style={{
          height: "30px",
          display: "flex",
          alignItems: "center",
          gap: "5px",
          padding: "0 10px",
          cursor: "pointer",
          border: testMode
            ? "1px solid var(--io-success)"
            : "1px solid var(--io-border)",
          borderRadius: "var(--io-radius)",
          background: testMode ? "rgba(34,197,94,0.1)" : "transparent",
          color: testMode ? "var(--io-success)" : "var(--io-text-secondary)",
          fontSize: "12px",
          flexShrink: 0,
        }}
      >
        {testMode && (
          <span
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background: "var(--io-success)",
              animation: "pulse-dot 1.5s infinite",
              flexShrink: 0,
            }}
          />
        )}
        <span>{testMode ? "Stop" : "Test"}</span>
      </button>

      {/* Phone preview — not shown in report mode */}
      {mode !== "report" && (
        <>
          <div style={separatorStyle} />
          <ToolBtn
            icon={<IconPhone />}
            title="Phone preview"
            onClick={onPhonePreview}
          />
        </>
      )}

      <div style={{ flex: 1 }} />

      {/* Focus mode */}
      <ToolBtn
        icon={<IconFocus />}
        title={focusMode ? "Exit focus mode" : "Focus mode (Ctrl+Shift+F)"}
        onClick={onFocusModeToggle}
      />

      <div style={separatorStyle} />

      {/* File menu */}
      <div style={{ position: "relative" }}>
        <ToolBtn
          icon={<IconFile />}
          title="File menu"
          onClick={() => setShowFileMenu(!showFileMenu)}
        />
        {showFileMenu && (
          <FileMenu
            onImport={onFileImport}
            onExportSvg={onFileExportSvg}
            onVersionHistory={onVersionHistory}
            onProperties={onProperties}
            onClose={() => setShowFileMenu(false)}
          />
        )}
      </div>

      {/* Publish */}
      <LabelBtn
        icon={<IconPublish />}
        label="Publish"
        title="Publish this graphic"
        onClick={onPublish}
        accent
      />

      {/* Save with dirty indicator */}
      <div style={{ position: "relative" }}>
        <LabelBtn
          icon={<IconSave />}
          label="Save"
          title="Save (Ctrl+S)"
          onClick={onSave}
        />
        {isDirty && (
          <span
            style={{
              position: "absolute",
              top: "2px",
              right: "2px",
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              background: "var(--io-warning)",
            }}
          />
        )}
      </div>
    </div>
  );
}
