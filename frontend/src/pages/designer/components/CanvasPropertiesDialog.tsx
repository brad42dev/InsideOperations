/**
 * CanvasPropertiesDialog.tsx
 *
 * Floating dialog for canvas properties:
 *   - Canvas width / height (with proportional lock + preset chips)
 *   - Auto-grow vertically (report mode)
 *   - Background color
 *   - Grid size
 *
 * Changes are live (no "Apply" button). W/H changes are debounced 500ms.
 * Out-of-bounds warning shows count of nodes that would fall outside the new canvas.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  useSceneStore,
  useHistoryStore,
  useUiStore,
} from "../../../store/designer";
import { ChangePropertyCommand } from "../../../shared/graphics/commands";
import { getNodeBounds } from "../DesignerCanvas";
import type { SceneNode } from "../../../shared/types/graphics";
import { AspectPreset, ASPECT_PRESETS, ChainLinkIcon } from "./canvasPresets";

const GRID_OPTIONS = [4, 8, 10, 16, 32];

// ---------------------------------------------------------------------------
// Count nodes outside the given bounds
// ---------------------------------------------------------------------------

function countOutOfBounds(
  nodes: SceneNode[],
  w: number,
  h: number,
): { count: number; ids: string[] } {
  const ids: string[] = [];
  for (const node of nodes) {
    const bounds = getNodeBounds(node);
    const right = bounds.x + bounds.w;
    const bottom = bounds.y + bounds.h;
    if (bounds.x < 0 || bounds.y < 0 || right > w || bottom > h) {
      ids.push(node.id);
    }
  }
  return { count: ids.length, ids };
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CanvasPropertiesDialogProps {
  onClose: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function CanvasPropertiesDialog({
  onClose,
}: CanvasPropertiesDialogProps) {
  const doc = useSceneStore((s) => s.doc);
  const execute = useSceneStore((s) => s.execute);
  const push = useHistoryStore((s) => s.push);

  const executeCmd = useCallback(
    (cmd: ChangePropertyCommand) => {
      if (!doc) return;
      const before = doc;
      execute(cmd);
      push(cmd, before);
    },
    [doc, execute, push],
  );

  // Local state (mirrors doc values; updates live)
  const [width, setWidth] = useState<number>(doc?.canvas.width ?? 1920);
  const [height, setHeight] = useState<number>(doc?.canvas.height ?? 1080);
  const [autoHeight, setAutoHeight] = useState<boolean>(
    doc?.canvas.autoHeight ?? false,
  );
  const [bgColor, setBgColor] = useState<string>(
    doc?.canvas.backgroundColor ?? "var(--io-accent-foreground)",
  );
  const [gridSize, setGridSize] = useState<number>(doc?.metadata.gridSize ?? 8);
  const [proportionalLock, setProportionalLock] = useState(false);

  // Active preset chip
  const [activePreset, setActivePreset] = useState<string | null>(() => {
    if (!doc) return null;
    const match = ASPECT_PRESETS.find(
      (p) => p.width === doc.canvas.width && p.height === doc.canvas.height,
    );
    return match ? match.label : null;
  });

  // Out-of-bounds warning state
  const [oobCount, setOobCount] = useState<number>(0);
  const [oobIds, setOobIds] = useState<string[]>([]);

  // Debounce refs for W/H
  const wDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const oobDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const designMode = doc?.metadata.designMode ?? "graphic";
  const isReport = designMode === "report";
  const visiblePresets = ASPECT_PRESETS.filter(
    (p) => !p.reportOnly || isReport,
  );

  // Sync local state when doc changes externally (e.g. undo)
  useEffect(() => {
    if (!doc) return;
    setWidth(doc.canvas.width);
    setHeight(doc.canvas.height);
    setAutoHeight(doc.canvas.autoHeight ?? false);
    setBgColor(doc.canvas.backgroundColor);
    setGridSize(doc.metadata.gridSize);
    const match = ASPECT_PRESETS.find(
      (p) => p.width === doc.canvas.width && p.height === doc.canvas.height,
    );
    setActivePreset(match ? match.label : null);
  }, [doc]);

  // Update oob warning (debounced 300ms after typing)
  function scheduleOobCheck(newW: number, newH: number) {
    if (oobDebounceRef.current) clearTimeout(oobDebounceRef.current);
    oobDebounceRef.current = setTimeout(() => {
      if (!doc) return;
      const result = countOutOfBounds(doc.children, newW, newH);
      setOobCount(result.count);
      setOobIds(result.ids);
    }, 300);
  }

  function clampW(v: number) {
    return Math.max(320, Math.min(20000, v));
  }
  function clampH(v: number) {
    return Math.max(240, Math.min(15000, v));
  }

  // Commit width change to doc (debounced 500ms)
  function commitWidth(newW: number) {
    if (wDebounceRef.current) clearTimeout(wDebounceRef.current);
    wDebounceRef.current = setTimeout(() => {
      if (!doc) return;
      executeCmd(
        new ChangePropertyCommand(
          doc.id,
          "canvas",
          { ...doc.canvas, width: clampW(newW) },
          doc.canvas,
        ),
      );
    }, 500);
  }

  function commitHeight(newH: number) {
    if (hDebounceRef.current) clearTimeout(hDebounceRef.current);
    hDebounceRef.current = setTimeout(() => {
      if (!doc) return;
      executeCmd(
        new ChangePropertyCommand(
          doc.id,
          "canvas",
          { ...doc.canvas, height: clampH(newH) },
          doc.canvas,
        ),
      );
    }, 500);
  }

  function handleWidthChange(raw: string) {
    const val = parseInt(raw, 10);
    if (isNaN(val)) return;
    let newH = height;
    if (proportionalLock && height > 0 && width > 0) {
      newH = Math.round(val * (height / width));
      setHeight(newH);
      commitHeight(newH);
    }
    setWidth(val);
    commitWidth(val);
    scheduleOobCheck(val, newH);
    const match = ASPECT_PRESETS.find(
      (p) => p.width === val && p.height === newH,
    );
    setActivePreset(match ? match.label : null);
  }

  function handleHeightChange(raw: string) {
    const val = parseInt(raw, 10);
    if (isNaN(val)) return;
    let newW = width;
    if (proportionalLock && width > 0 && height > 0) {
      newW = Math.round(val * (width / height));
      setWidth(newW);
      commitWidth(newW);
    }
    setHeight(val);
    commitHeight(val);
    scheduleOobCheck(newW, val);
    const match = ASPECT_PRESETS.find(
      (p) => p.width === newW && p.height === val,
    );
    setActivePreset(match ? match.label : null);
  }

  function handleWidthBlur() {
    setWidth((w) => clampW(w));
  }
  function handleHeightBlur() {
    setHeight((h) => clampH(h));
  }

  function applyPreset(preset: AspectPreset) {
    setWidth(preset.width);
    setHeight(preset.height);
    setActivePreset(preset.label);
    scheduleOobCheck(preset.width, preset.height);
    if (wDebounceRef.current) clearTimeout(wDebounceRef.current);
    if (hDebounceRef.current) clearTimeout(hDebounceRef.current);
    if (!doc) return;
    executeCmd(
      new ChangePropertyCommand(
        doc.id,
        "canvas",
        {
          ...doc.canvas,
          width: preset.width,
          height: preset.height,
        },
        doc.canvas,
      ),
    );
  }

  function handleBgColorChange(newColor: string) {
    setBgColor(newColor);
    if (!doc) return;
    executeCmd(
      new ChangePropertyCommand(
        doc.id,
        "canvas",
        { ...doc.canvas, backgroundColor: newColor },
        doc.canvas,
      ),
    );
  }

  function handleGridSizeChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = parseInt(e.target.value, 10);
    setGridSize(val);
    if (!doc) return;
    executeCmd(
      new ChangePropertyCommand(
        doc.id,
        "metadata",
        { ...doc.metadata, gridSize: val },
        doc.metadata,
      ),
    );
  }

  function handleAutoHeightChange(checked: boolean) {
    setAutoHeight(checked);
    if (!doc) return;
    executeCmd(
      new ChangePropertyCommand(
        doc.id,
        "canvas",
        { ...doc.canvas, autoHeight: checked },
        doc.canvas,
      ),
    );
  }

  function handleSelectOobNodes() {
    if (oobIds.length === 0) return;
    useUiStore.getState().setSelectedNodes(oobIds);
  }

  // Styles
  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "5px 7px",
    background: "var(--io-surface)",
    border: "1px solid var(--io-border)",
    borderRadius: "var(--io-radius)",
    color: "var(--io-text-primary)",
    fontSize: 12,
    outline: "none",
    boxSizing: "border-box",
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: 10,
    fontWeight: 600,
    color: "var(--io-text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginBottom: 4,
  };

  const sectionLabelStyle: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    color: "var(--io-text-secondary)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginBottom: 8,
    paddingBottom: 4,
    borderBottom: "1px solid var(--io-border)",
  };

  if (!doc) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 80,
        right: 320,
        zIndex: 500,
        width: 320,
        background: "var(--io-surface-elevated)",
        border: "1px solid var(--io-border)",
        borderRadius: "var(--io-radius)",
        boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
      role="dialog"
      aria-label="Canvas Properties"
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "10px 14px 8px",
          borderBottom: "1px solid var(--io-border)",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--io-text-primary)",
          }}
        >
          Canvas Properties
        </span>
        <button
          onClick={onClose}
          title="Close"
          aria-label="Close"
          style={{
            width: 22,
            height: 22,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "transparent",
            border: "none",
            borderRadius: "var(--io-radius)",
            color: "var(--io-text-muted)",
            fontSize: 14,
            cursor: "pointer",
            padding: 0,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background =
              "var(--io-surface)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background =
              "transparent";
          }}
        >
          ×
        </button>
      </div>

      {/* Scrollable body */}
      <div
        style={{
          padding: "14px 14px 14px",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {/* Canvas section */}
        <div>
          <div style={sectionLabelStyle}>Canvas</div>

          {/* Preset chips */}
          <div style={{ marginBottom: 10 }}>
            <label style={labelStyle}>Preset</label>
            <div
              style={{
                overflowX: "auto",
                display: "flex",
                gap: 4,
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
                      padding: "2px 7px",
                      fontSize: 10,
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

          {/* Width / Height with proportional lock */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: 6,
              marginBottom: 8,
            }}
          >
            {/* Width */}
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>Width</label>
              <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
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

            {/* Proportional lock */}
            <button
              type="button"
              onClick={() => setProportionalLock((l) => !l)}
              title={
                proportionalLock ? "Unlock proportions" : "Lock proportions"
              }
              style={{
                flexShrink: 0,
                width: 26,
                height: 26,
                marginBottom: 1,
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
              <label style={labelStyle}>
                {autoHeight ? "Min. Height / Page Height" : "Height"}
              </label>
              <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <input
                  type="number"
                  value={height}
                  min={240}
                  max={15000}
                  onChange={(e) => handleHeightChange(e.target.value)}
                  onBlur={handleHeightBlur}
                  title={
                    autoHeight
                      ? "The canvas grows automatically to fit content. This value sets the minimum height."
                      : undefined
                  }
                  style={{
                    ...inputStyle,
                    width: "100%",
                  }}
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

          {/* Auto-grow checkbox (report and dashboard modes) */}
          {(isReport || designMode === "dashboard") && (
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                fontSize: 12,
                color: "var(--io-text-secondary)",
                cursor: "pointer",
                marginBottom: 4,
                userSelect: "none",
              }}
            >
              <input
                type="checkbox"
                checked={autoHeight}
                onChange={(e) => handleAutoHeightChange(e.target.checked)}
                style={{ accentColor: "var(--io-accent)", cursor: "pointer" }}
              />
              Auto-grow vertically (for scrollable content)
            </label>
          )}

          {/* Out-of-bounds warning */}
          {oobCount > 0 && (
            <div
              style={{
                marginTop: 6,
                padding: "6px 8px",
                background: "rgba(234,179,8,0.1)",
                border: "1px solid rgba(234,179,8,0.3)",
                borderRadius: "var(--io-radius)",
                fontSize: 11,
                color: "#eab308",
                lineHeight: 1.4,
              }}
            >
              <span>
                &#9888; {oobCount} element{oobCount !== 1 ? "s" : ""} will be
                outside the canvas boundary after this change.{" "}
              </span>
              <button
                onClick={handleSelectOobNodes}
                style={{
                  background: "none",
                  border: "none",
                  color: "#eab308",
                  textDecoration: "underline",
                  cursor: "pointer",
                  fontSize: 11,
                  padding: 0,
                  fontWeight: 600,
                }}
              >
                [Select those elements]
              </button>
            </div>
          )}
        </div>

        {/* Background color */}
        <div>
          <div style={sectionLabelStyle}>Background</div>
          <label style={labelStyle}>Background Color</label>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Color swatch (triggers native color picker) */}
            <div
              style={{
                position: "relative",
                width: 28,
                height: 28,
                borderRadius: "var(--io-radius)",
                border: "1px solid var(--io-border)",
                overflow: "hidden",
                flexShrink: 0,
                cursor: "pointer",
                background: bgColor,
              }}
            >
              <input
                type="color"
                value={bgColor}
                onChange={(e) => handleBgColorChange(e.target.value)}
                style={{
                  position: "absolute",
                  inset: 0,
                  opacity: 0,
                  width: "100%",
                  height: "100%",
                  cursor: "pointer",
                  border: "none",
                  padding: 0,
                }}
                title="Pick background color"
              />
            </div>

            {/* Hex text input */}
            <input
              type="text"
              value={bgColor}
              onChange={(e) => {
                const val = e.target.value;
                setBgColor(val);
                // Only commit when it looks like a valid hex color
                if (/^#[0-9a-fA-F]{6}$/.test(val)) {
                  if (!doc) return;
                  executeCmd(
                    new ChangePropertyCommand(
                      doc.id,
                      "canvas",
                      { ...doc.canvas, backgroundColor: val },
                      doc.canvas,
                    ),
                  );
                }
              }}
              style={{
                ...inputStyle,
                fontFamily: "var(--io-font-mono)",
                flex: 1,
              }}
              placeholder="#000000"
              maxLength={7}
            />
          </div>
        </div>

        {/* Grid section */}
        <div>
          <div style={sectionLabelStyle}>Grid</div>
          <label style={labelStyle}>Grid Size</label>
          <select
            value={gridSize}
            onChange={handleGridSizeChange}
            style={{
              ...inputStyle,
              cursor: "pointer",
            }}
          >
            {GRID_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}px
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
