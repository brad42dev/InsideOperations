import React from "react";
import type { AutoSaveStatus } from "../types";

interface StatusBarProps {
  wsConnected: boolean;
  boundPoints: number;
  unresolvedPoints: number;
  gridSize: number;
  zoom: number;
  testMode: boolean;
  onGridSizeClick: () => void;
  onZoomClick: () => void;
  autoSaveStatus: AutoSaveStatus;
  autoSaveAge: number;
}

const barStyle: React.CSSProperties = {
  height: "28px",
  flexShrink: 0,
  display: "flex",
  alignItems: "center",
  background: "var(--io-surface-secondary)",
  borderTop: "1px solid var(--io-border)",
  fontSize: "11px",
  color: "var(--io-text-secondary)",
  padding: "0 8px",
  gap: 0,
  userSelect: "none",
  overflow: "hidden",
};

const dividerStyle: React.CSSProperties = {
  width: "1px",
  height: "16px",
  background: "var(--io-border-subtle)",
  margin: "0 8px",
  flexShrink: 0,
};

const segmentStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "4px",
  whiteSpace: "nowrap",
};

const clickableSegmentStyle: React.CSSProperties = {
  ...segmentStyle,
  cursor: "pointer",
  borderRadius: "var(--io-radius)",
  padding: "2px 4px",
};

function ConnectedDot({ connected }: { connected: boolean }) {
  return (
    <svg width="8" height="8" viewBox="0 0 8 8">
      <circle
        cx="4"
        cy="4"
        r="3.5"
        fill={connected ? "var(--io-success)" : "var(--io-danger)"}
      />
    </svg>
  );
}

function formatAutoSave(
  status: AutoSaveStatus,
  age: number,
): { text: string; color: string } {
  switch (status) {
    case "saving":
      return { text: "Saving...", color: "var(--io-text-muted)" };
    case "failed":
      return { text: "Save failed", color: "var(--io-danger)" };
    case "dirty":
      return { text: "Unsaved changes", color: "var(--io-warning)" };
    case "saved": {
      if (age < 5) return { text: "Saved", color: "var(--io-success)" };
      if (age < 60)
        return {
          text: `Auto-saved ${age}s ago`,
          color: "var(--io-text-muted)",
        };
      const mins = Math.floor(age / 60);
      return { text: `Auto-saved ${mins}m ago`, color: "var(--io-text-muted)" };
    }
  }
}

export default function StatusBar({
  wsConnected,
  boundPoints,
  unresolvedPoints,
  gridSize,
  zoom,
  testMode,
  onGridSizeClick,
  onZoomClick,
  autoSaveStatus,
  autoSaveAge,
}: StatusBarProps) {
  const autoSave = formatAutoSave(autoSaveStatus, autoSaveAge);

  return (
    <div style={barStyle}>
      {/* Connection status */}
      <div style={segmentStyle}>
        <ConnectedDot connected={wsConnected} />
        <span>{wsConnected ? "Connected" : "Disconnected"}</span>
      </div>

      <div style={dividerStyle} />

      {/* Point binding summary */}
      <div style={segmentStyle}>
        <span>Points: {boundPoints} bound</span>
        {unresolvedPoints > 0 && (
          <span style={{ color: "var(--io-warning)" }}>
            ({unresolvedPoints} unresolved)
          </span>
        )}
      </div>

      <div style={dividerStyle} />

      {/* Grid size */}
      <div
        style={clickableSegmentStyle}
        onClick={onGridSizeClick}
        title="Click to cycle grid size (4, 8, 16, 32)"
      >
        <span>Grid: {gridSize}px</span>
      </div>

      <div style={dividerStyle} />

      {/* Zoom level */}
      <div
        style={clickableSegmentStyle}
        onClick={onZoomClick}
        title="Click for zoom presets"
      >
        <span>{Math.round(zoom * 100)}%</span>
      </div>

      <div style={dividerStyle} />

      {/* Mode indicator */}
      <div style={segmentStyle}>
        {testMode ? (
          <span style={{ color: "var(--io-success)", fontWeight: 600 }}>
            Test Mode
          </span>
        ) : (
          <span>Edit</span>
        )}
      </div>

      {/* Right-aligned auto-save */}
      <div style={{ flex: 1 }} />
      <div style={{ ...segmentStyle, color: autoSave.color }}>
        {autoSaveStatus === "failed" && (
          <svg
            width="12"
            height="12"
            viewBox="0 0 12 12"
            style={{ flexShrink: 0 }}
          >
            <path
              d="M6 1L11 10H1L6 1Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.2"
            />
            <line
              x1="6"
              y1="4"
              x2="6"
              y2="7"
              stroke="currentColor"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
            <circle cx="6" cy="8.5" r="0.6" fill="currentColor" />
          </svg>
        )}
        <span>{autoSave.text}</span>
      </div>
    </div>
  );
}
