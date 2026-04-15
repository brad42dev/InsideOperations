/**
 * ShapeDropDialog.tsx
 *
 * 2-step dialog opened when a specific shape is dropped from the shape library panel
 * (io:shape-drop event — already know which shape, skip the category picker):
 *   Step 1 — Variant picker + add-on checkboxes
 *   Step 2 — Tabbed: "Point Bindings" (left list + right slots) | "Display Elements"
 */

import React, { useState, useEffect } from "react";
import { useLibraryStore } from "../../../store/designer";
import type { ShapeSidecar } from "../../../shared/types/shapes";
import type {
  DisplayElementType,
  DisplayElementConfig,
  DisplayElementFontFamily,
} from "../../../shared/types/graphics";
import { ShapePointSelector, resolvePointBindings } from "./ShapePointSelector";
import type { ShapeSlotDef, ShapeBindingEntry } from "./ShapePointSelector";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/** Flat user-configurable settings for a single display element.
 *  All fields optional — unset fields fall back to element defaults at placement time. */
export interface DisplayElementUserConfig {
  // Text readout — three label rows + value row, each with own font/justify/style
  showPointName?: boolean;
  pointNameFont?: string;
  pointNameFontSize?: number;
  pointNameJustify?: "left" | "center" | "right";
  pointNameStyle?: "white" | "gray" | "bold-white" | "bold-gray";
  showDisplayName?: boolean;
  displayNameFont?: string;
  displayNameFontSize?: number;
  displayNameJustify?: "left" | "center" | "right";
  displayNameStyle?: "white" | "gray" | "bold-white" | "bold-gray";
  showUnits?: boolean;
  euFont?: string;
  euFontSize?: number;
  euJustify?: "left" | "center" | "right";
  euStyle?: "white" | "gray" | "bold-white" | "bold-gray";
  // Value row
  valueFont?: string;
  valueFontSize?: number;
  valueJustify?: "left" | "center" | "right";
  valueStyle?: "white" | "gray" | "bold-white" | "bold-gray";
  showBox?: boolean;
  // Shared: text readout + fill gauge
  decimalPlaces?: number;
  // Point name label
  labelText?: string;
  labelStyle?: "hierarchy" | "uniform";
  // Analog bar + fill gauge
  rangeLo?: number;
  rangeHi?: number;
  // Analog bar
  orientation?: "vertical" | "horizontal";
  showZoneLabels?: boolean;
  showNumericReadout?: boolean;
  showPointer?: boolean;
  // Fill gauge
  fillDirection?: "up" | "down" | "left" | "right";
  showValue?: boolean;
  valuePosition?: "in-fill" | "center";
  showLevelLine?: boolean;
  // Sparkline
  timeWindowMinutes?: number;
  scaleMode?: "auto" | "fixed";
  fixedRangeLo?: number;
  fixedRangeHi?: number;
  // Alarm indicator
  alarmMode?: "single" | "multi";
  // Digital status
  normalStates?: string[];
  abnormalPriority?: number;
}

export interface PlacedShapeConfig {
  shapeId: string;
  /** Selected variant key (e.g. "opt1", "plain", "diaphragm") */
  variant: string;
  composableParts: Array<{ partId: string; attachment: string }>;
  pointBindings: Array<{
    partKey: string;
    pointId?: string;
    pointTag?: string;
    displayName?: string;
    unit?: string;
  }>;
  /** Display element types to pre-attach (e.g. ["text_readout", "alarm_indicator"]) */
  displayElements: string[];
  /** User-chosen slot per display element type key (e.g. { text_readout: "right" }).
   *  When absent the canvas handler falls back to sidecar defaultSlots then NAMED_SLOT_POSITIONS. */
  displayElementSlots?: Record<string, string>;
  /** Per-element user configuration applied at placement time. */
  displayElementConfigs?: Record<string, DisplayElementUserConfig>;
}

export interface ShapeDropDialogProps {
  shapeId: string;
  shapeDisplayName: string;
  onPlace: (config: PlacedShapeConfig) => void;
  onCancel: () => void;
  open: boolean;
  /** Edit mode: opens at Step 2 by default; Step 1 is shown when the shape has multiple variants */
  editMode?: boolean;
  /** Current variant on the shape being edited — pre-selects it in Step 1 */
  initialVariant?: string;
}

// ---------------------------------------------------------------------------
// Config conversion utilities (exported for DesignerCanvas edit-mode round-trip)
// ---------------------------------------------------------------------------

function fontFamilyToString(ff?: DisplayElementFontFamily): string | undefined {
  if (!ff) return undefined;
  if (ff === "JetBrains Mono") return "JetBrains Mono, monospace";
  if (ff === "IBM Plex Sans") return "IBM Plex Sans, sans-serif";
  return "Inter, sans-serif";
}

function stringToFontFamily(s?: string): DisplayElementFontFamily {
  if (s?.includes("JetBrains")) return "JetBrains Mono";
  if (s?.includes("IBM Plex")) return "IBM Plex Sans";
  return "Inter";
}

function parseDecimalPlaces(fmt?: string): number {
  const m = fmt?.match(/\.(\d+)f/);
  return m ? Number(m[1]) : 2;
}

type TextStyle = "white" | "gray" | "bold-white" | "bold-gray";

function styleToColorAndWeight(s?: TextStyle): {
  color: string;
  fontWeight: "normal" | "bold";
} {
  const bold = s === "bold-white" || s === "bold-gray";
  const muted = s === "gray" || s === "bold-gray";
  return {
    color: muted ? "var(--io-text-muted)" : "var(--io-text-primary)",
    fontWeight: bold ? "bold" : "normal",
  };
}

function colorAndWeightToStyle(color?: string, fontWeight?: string): TextStyle {
  const muted = color?.includes("muted");
  const bold = fontWeight === "bold";
  if (muted && bold) return "bold-gray";
  if (muted) return "gray";
  if (bold) return "bold-white";
  return "white";
}

/** Convert a stored DisplayElementConfig back to the flat DisplayElementUserConfig used by the wizard. */
export function displayConfigToUserConfig(
  dc: DisplayElementConfig,
): DisplayElementUserConfig {
  switch (dc.displayType) {
    case "text_readout":
      return {
        showPointName: dc.pointNameRow?.enabled ?? false,
        pointNameFont:
          fontFamilyToString(dc.pointNameRow?.fontFamily) ??
          "JetBrains Mono, monospace",
        pointNameFontSize: dc.pointNameRow?.fontSize ?? 10,
        pointNameJustify: dc.pointNameRow?.textAlign ?? "center",
        pointNameStyle: colorAndWeightToStyle(
          dc.pointNameRow?.color,
          dc.pointNameRow?.fontWeight,
        ),
        showDisplayName: dc.displayNameRow?.enabled ?? false,
        displayNameFont:
          fontFamilyToString(dc.displayNameRow?.fontFamily) ??
          "Inter, sans-serif",
        displayNameFontSize: dc.displayNameRow?.fontSize ?? 12,
        displayNameJustify: dc.displayNameRow?.textAlign ?? "center",
        displayNameStyle: colorAndWeightToStyle(
          dc.displayNameRow?.color,
          dc.displayNameRow?.fontWeight,
        ),
        showUnits: dc.showUnits,
        euFont:
          fontFamilyToString(dc.euRow?.fontFamily) ??
          "JetBrains Mono, monospace",
        euFontSize: dc.euRow?.fontSize ?? 12,
        euJustify: dc.euRow?.textAlign ?? "center",
        euStyle: colorAndWeightToStyle(dc.euRow?.color, dc.euRow?.fontWeight),
        valueFont:
          fontFamilyToString(dc.valueRow?.fontFamily) ??
          "JetBrains Mono, monospace",
        valueFontSize: dc.valueRow?.fontSize ?? 14,
        valueJustify: dc.valueRow?.textAlign ?? "center",
        valueStyle: colorAndWeightToStyle(
          dc.valueRow?.color,
          dc.valueRow?.fontWeight,
        ),
        showBox: dc.showBox,
        decimalPlaces: parseDecimalPlaces(dc.valueFormat),
      };
    case "analog_bar":
      return {
        orientation: dc.orientation,
        rangeLo: dc.rangeLo,
        rangeHi: dc.rangeHi,
        showZoneLabels: dc.showZoneLabels,
        showNumericReadout: dc.showNumericReadout,
        showPointer: dc.showPointer,
      };
    case "fill_gauge":
      return {
        fillDirection: dc.fillDirection,
        rangeLo: dc.rangeLo,
        rangeHi: dc.rangeHi,
        showLevelLine: dc.showLevelLine,
        showValue: dc.showValue,
        valuePosition: dc.valuePosition,
        decimalPlaces: parseDecimalPlaces(dc.valueFormat),
      };
    case "sparkline":
      return {
        timeWindowMinutes: dc.timeWindowMinutes,
        scaleMode: dc.scaleMode,
        fixedRangeLo: dc.fixedRangeLo,
        fixedRangeHi: dc.fixedRangeHi,
      };
    case "alarm_indicator":
      return { alarmMode: dc.mode };
    case "digital_status":
      return {
        normalStates: dc.normalStates,
        abnormalPriority: dc.abnormalPriority,
      };
    case "point_name_label":
      return {
        labelStyle: dc.style,
        labelText: dc.staticText,
      };
  }
}

/** Convert DisplayElementUserConfig from the wizard into a stored DisplayElementConfig. */
export function userConfigToDisplayConfig(
  type: DisplayElementType,
  uc: DisplayElementUserConfig,
  opts?: { vesselOverlay?: boolean },
): DisplayElementConfig {
  switch (type) {
    case "text_readout": {
      const pnStyle = styleToColorAndWeight(uc.pointNameStyle as TextStyle);
      const dnStyle = styleToColorAndWeight(uc.displayNameStyle as TextStyle);
      const euStyle = styleToColorAndWeight(uc.euStyle as TextStyle);
      const valStyle = styleToColorAndWeight(uc.valueStyle as TextStyle);
      return {
        displayType: "text_readout",
        valueFormat: `%.${uc.decimalPlaces ?? 2}f`,
        showBox: uc.showBox ?? true,
        showLabel: false,
        showUnits: uc.showUnits ?? false,
        minWidth: 40,
        pointNameRow: {
          enabled: uc.showPointName ?? false,
          fontFamily: stringToFontFamily(uc.pointNameFont),
          fontSize: uc.pointNameFontSize ?? 10,
          color: pnStyle.color,
          fontWeight: pnStyle.fontWeight,
          textAlign: uc.pointNameJustify ?? "center",
          showBackground: false,
        },
        displayNameRow: {
          enabled: uc.showDisplayName ?? false,
          fontFamily: stringToFontFamily(uc.displayNameFont),
          fontSize: uc.displayNameFontSize ?? 12,
          color: dnStyle.color,
          fontWeight: dnStyle.fontWeight,
          textAlign: uc.displayNameJustify ?? "center",
          showBackground: false,
        },
        valueRow: {
          fontFamily: stringToFontFamily(uc.valueFont),
          fontSize: uc.valueFontSize ?? 14,
          color: valStyle.color,
          fontWeight: valStyle.fontWeight,
          textAlign: uc.valueJustify ?? "center",
          showBackground: false,
          // EU style stored separately — euRow not in TextReadoutConfig yet, but euStyle/euJustify
          // are carried in DisplayElementUserConfig for future use
        },
        euRow: {
          fontFamily: stringToFontFamily(uc.euFont),
          fontSize: uc.euFontSize ?? 12,
          color: euStyle.color,
          fontWeight: euStyle.fontWeight,
          textAlign: uc.euJustify ?? "center",
        },
      };
    }
    case "analog_bar":
      return {
        displayType: "analog_bar",
        orientation: uc.orientation ?? "vertical",
        rangeLo: uc.rangeLo ?? 0,
        rangeHi: uc.rangeHi ?? 100,
        barWidth: 20,
        barHeight: 80,
        showPointer: uc.showPointer ?? false,
        showZoneLabels: uc.showZoneLabels ?? true,
        showSetpoint: false,
        showNumericReadout: uc.showNumericReadout ?? true,
        showSignalLine: false,
      };
    case "fill_gauge":
      return {
        displayType: "fill_gauge",
        mode: opts?.vesselOverlay ? "vessel_overlay" : "standalone",
        fillDirection: uc.fillDirection ?? "up",
        rangeLo: uc.rangeLo ?? 0,
        rangeHi: uc.rangeHi ?? 100,
        showLevelLine: uc.showLevelLine ?? true,
        showValue: uc.showValue ?? true,
        valuePosition: uc.valuePosition ?? "in-fill",
        valueFormat: `%.${uc.decimalPlaces ?? 0}f`,
        barWidth: 22,
        barHeight: 90,
      };
    case "sparkline":
      return {
        displayType: "sparkline",
        timeWindowMinutes: uc.timeWindowMinutes ?? 30,
        scaleMode: uc.scaleMode ?? "auto",
        fixedRangeLo: uc.fixedRangeLo,
        fixedRangeHi: uc.fixedRangeHi,
        dataPoints: 14,
      };
    case "alarm_indicator":
      return { displayType: "alarm_indicator", mode: uc.alarmMode ?? "single" };
    case "digital_status":
      return {
        displayType: "digital_status",
        normalStates: uc.normalStates ?? [],
        stateLabels: {},
        abnormalPriority: (uc.abnormalPriority as 1 | 2 | 3 | 4 | 5) ?? 3,
      };
    case "point_name_label":
      return {
        displayType: "point_name_label",
        style: uc.labelStyle ?? "hierarchy",
        staticText: uc.labelText,
      };
  }
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ALL_ELEMENTS: Array<{ id: DisplayElementType; label: string }> = [
  { id: "text_readout", label: "Text Readout" },
  { id: "alarm_indicator", label: "Alarm Indicator" },
  { id: "analog_bar", label: "Analog Bar" },
  { id: "fill_gauge", label: "Fill Gauge" },
  { id: "sparkline", label: "Sparkline" },
  { id: "digital_status", label: "Digital Status" },
  { id: "point_name_label", label: "Shape Label" },
];

export const DE_SIDECAR_KEY: Record<string, string> = {
  text_readout: "TextReadout",
  alarm_indicator: "AlarmIndicator",
  analog_bar: "AnalogBar",
  fill_gauge: "FillGauge",
  sparkline: "Sparkline",
  digital_status: "DigitalStatus",
  point_name_label: "PointNameLabel",
};

export const DE_FALLBACK_SLOT: Record<string, string> = {
  TextReadout: "bottom",
  AlarmIndicator: "top-right",
  AnalogBar: "right",
  // Vessel/tank shapes declare "vessel-interior" in their own defaultSlots JSON.
  // This fallback only fires for shapes that lack that entry (pumps, valves, etc.)
  // — those should get an external bar to the left, not a misplaced interior fill.
  FillGauge: "left",
  Sparkline: "right-top",
  DigitalStatus: "bottom",
  PointNameLabel: "top",
};

export const DE_FALLBACK_SLOTS_LIST: Record<string, string[]> = {
  TextReadout: ["top", "right", "bottom", "left"],
  AlarmIndicator: ["top-right", "top-left", "bottom-right", "bottom-left"],
  AnalogBar: ["right", "left"],
  FillGauge: ["vessel-interior", "right", "left"],
  Sparkline: ["right-top", "right-bottom", "left-top", "left-bottom"],
  DigitalStatus: ["top", "right", "bottom", "left"],
  PointNameLabel: ["top", "right", "bottom", "left"],
};

export const DE_CHIP: Record<string, { abbr: string; color: string }> = {
  text_readout: { abbr: "TR", color: "#3b82f6" },
  alarm_indicator: { abbr: "AI", color: "#ef4444" },
  analog_bar: { abbr: "AB", color: "#22c55e" },
  fill_gauge: { abbr: "FG", color: "#06b6d4" },
  sparkline: { abbr: "SP", color: "#a855f7" },
  digital_status: { abbr: "DS", color: "#f97316" },
  point_name_label: { abbr: "PN", color: "#eab308" },
};

// ---------------------------------------------------------------------------
// makeDefaultElementConfig
// ---------------------------------------------------------------------------

export function makeDefaultElementConfig(
  type: DisplayElementType,
  bodyBinding?: Pick<
    ShapeBindingEntry,
    "tag" | "displayName" | "unit" | "rangeLo" | "rangeHi"
  >,
): DisplayElementUserConfig {
  const rangeLo = bodyBinding?.rangeLo ?? 0;
  const rangeHi = bodyBinding?.rangeHi ?? 100;
  switch (type) {
    case "text_readout":
      return {
        showPointName: Boolean(bodyBinding?.tag),
        pointNameFont: "JetBrains Mono, monospace",
        pointNameFontSize: 10,
        pointNameJustify: "center",
        pointNameStyle: "white",
        showDisplayName: Boolean(bodyBinding?.displayName),
        displayNameFont: "Inter, sans-serif",
        displayNameFontSize: 12,
        displayNameJustify: "center",
        displayNameStyle: "gray",
        showUnits: Boolean(bodyBinding?.unit),
        euFont: "JetBrains Mono, monospace",
        euFontSize: 12,
        euJustify: "center",
        euStyle: "gray",
        valueFont: "JetBrains Mono, monospace",
        valueFontSize: 14,
        valueJustify: "center",
        valueStyle: "white",
        showBox: true,
        decimalPlaces: 2,
      };
    case "analog_bar":
      return {
        orientation: "vertical",
        rangeLo,
        rangeHi,
        showZoneLabels: true,
        showNumericReadout: true,
        showPointer: false,
      };
    case "fill_gauge":
      return {
        fillDirection: "up",
        rangeLo,
        rangeHi,
        showValue: true,
        showLevelLine: true,
        decimalPlaces: 1,
      };
    case "sparkline":
      return { timeWindowMinutes: 60, scaleMode: "auto" };
    case "alarm_indicator":
      return { alarmMode: "single" };
    case "digital_status":
      return { normalStates: [], abnormalPriority: 3 };
    case "point_name_label":
      return { labelText: bodyBinding?.tag || "", labelStyle: "hierarchy" };
    default:
      return {};
  }
}

// ---------------------------------------------------------------------------
// DEConfigPanel — config editor for a single display element
// ---------------------------------------------------------------------------

export function DEConfigPanel({
  elementType,
  config,
  onChange,
  slot,
  availableSlots,
  onSlotChange,
  bodyBinding,
}: {
  elementType: DisplayElementType;
  config: DisplayElementUserConfig;
  onChange: (updates: Partial<DisplayElementUserConfig>) => void;
  slot: string;
  availableSlots: string[];
  onSlotChange: (slot: string) => void;
  bodyBinding?: Pick<
    ShapeBindingEntry,
    "tag" | "displayName" | "unit" | "rangeLo" | "rangeHi"
  >;
}) {
  const inp: React.CSSProperties = {
    background: "var(--io-surface)",
    border: "1px solid var(--io-border)",
    borderRadius: "var(--io-radius)",
    color: "var(--io-text-primary)",
    fontSize: 12,
    padding: "3px 8px",
    outline: "none",
    height: 26,
    width: "100%",
    boxSizing: "border-box",
  };
  const lbl: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 600,
    color: "var(--io-text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom: 3,
    display: "block",
  };
  const row: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 8,
    fontSize: 12,
    color: "var(--io-text-primary)",
    cursor: "pointer",
  };
  const grp: React.CSSProperties = { marginBottom: 14 };

  const names: Partial<Record<DisplayElementType, string>> = {
    text_readout: "Text Readout",
    analog_bar: "Analog Bar",
    fill_gauge: "Fill Gauge",
    sparkline: "Sparkline",
    alarm_indicator: "Alarm Indicator",
    digital_status: "Digital Status",
    point_name_label: "Shape Label",
  };

  const slotPicker = (
    <div style={grp}>
      <span style={lbl}>Position Slot</span>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {availableSlots.map((s) => (
          <button
            key={s}
            onClick={() => onSlotChange(s)}
            style={{
              padding: "2px 8px",
              fontSize: 10,
              cursor: "pointer",
              border: `1px solid ${s === slot ? "var(--io-accent)" : "var(--io-border)"}`,
              borderRadius: "var(--io-radius)",
              background:
                s === slot
                  ? "color-mix(in srgb, var(--io-accent) 15%, transparent)"
                  : "transparent",
              color: s === slot ? "var(--io-accent)" : "var(--io-text-muted)",
              fontFamily: "JetBrains Mono, monospace",
            }}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ padding: "4px 0 12px" }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: "var(--io-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.07em",
          marginBottom: 14,
        }}
      >
        {names[elementType] ?? elementType}
      </div>

      {elementType === "text_readout" &&
        (() => {
          const fontOpts = (
            <>
              <option value="JetBrains Mono, monospace">JetBrains Mono</option>
              <option value="Inter, sans-serif">Inter</option>
              <option value="IBM Plex Sans, sans-serif">IBM Plex Sans</option>
            </>
          );
          const sizeOpts = [8, 9, 10, 11, 12, 13, 14, 16].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ));
          const styleOpts = (
            <>
              <option value="white">White</option>
              <option value="gray">Gray</option>
              <option value="bold-white">Bold White</option>
              <option value="bold-gray">Bold Gray</option>
            </>
          );
          const justifyBtn = (
            current: string | undefined,
            val: "left" | "center" | "right",
            label: string,
            onChg: () => void,
          ) => (
            <button
              key={val}
              onClick={onChg}
              title={val[0]!.toUpperCase() + val.slice(1)}
              style={{
                flex: 1,
                padding: "3px 0",
                fontSize: 10,
                cursor: "pointer",
                border: `1px solid ${(current ?? "center") === val ? "var(--io-accent)" : "var(--io-border)"}`,
                borderRadius: 3,
                background:
                  (current ?? "center") === val
                    ? "color-mix(in srgb, var(--io-accent) 18%, transparent)"
                    : "transparent",
                color:
                  (current ?? "center") === val
                    ? "var(--io-accent)"
                    : "var(--io-text-muted)",
              }}
            >
              {label}
            </button>
          );
          const rowControls = (
            active: boolean,
            font: string | undefined,
            defaultFont: string,
            fontKey: keyof DisplayElementUserConfig,
            size: number | undefined,
            defaultSize: number,
            sizeKey: keyof DisplayElementUserConfig,
            justify: string | undefined,
            justifyKey: keyof DisplayElementUserConfig,
            style: string | undefined,
            styleKey: keyof DisplayElementUserConfig,
          ) => (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 52px 72px 90px",
                gap: 6,
                paddingLeft: 20,
                marginTop: 8,
                opacity: active ? 1 : 0.4,
                pointerEvents: active ? "auto" : "none",
              }}
            >
              <div>
                <span style={lbl}>Font</span>
                <select
                  style={inp}
                  value={font ?? defaultFont}
                  onChange={(e) =>
                    onChange({
                      [fontKey]: e.target.value,
                    } as Partial<DisplayElementUserConfig>)
                  }
                >
                  {fontOpts}
                </select>
              </div>
              <div>
                <span style={lbl}>Size</span>
                <select
                  style={inp}
                  value={size ?? defaultSize}
                  onChange={(e) =>
                    onChange({
                      [sizeKey]: Number(e.target.value),
                    } as Partial<DisplayElementUserConfig>)
                  }
                >
                  {sizeOpts}
                </select>
              </div>
              <div>
                <span style={lbl}>Align</span>
                <div style={{ display: "flex", gap: 2 }}>
                  {justifyBtn(justify, "left", "L", () =>
                    onChange({
                      [justifyKey]: "left",
                    } as Partial<DisplayElementUserConfig>),
                  )}
                  {justifyBtn(justify, "center", "C", () =>
                    onChange({
                      [justifyKey]: "center",
                    } as Partial<DisplayElementUserConfig>),
                  )}
                  {justifyBtn(justify, "right", "R", () =>
                    onChange({
                      [justifyKey]: "right",
                    } as Partial<DisplayElementUserConfig>),
                  )}
                </div>
              </div>
              <div>
                <span style={lbl}>Style</span>
                <select
                  style={inp}
                  value={style ?? "white"}
                  onChange={(e) =>
                    onChange({
                      [styleKey]: e.target.value,
                    } as Partial<DisplayElementUserConfig>)
                  }
                >
                  {styleOpts}
                </select>
              </div>
            </div>
          );
          return (
            <>
              {/* Show Point Name */}
              <div
                style={{
                  marginBottom: 10,
                  padding: "10px 12px",
                  background: "var(--io-surface-raised)",
                  borderRadius: 6,
                }}
              >
                <label style={row}>
                  <input
                    type="checkbox"
                    checked={config.showPointName ?? false}
                    onChange={(e) =>
                      onChange({ showPointName: e.target.checked })
                    }
                    style={{ accentColor: "var(--io-accent)" }}
                  />
                  <span style={{ fontWeight: 600, fontSize: 12 }}>
                    Show Point Name
                  </span>
                </label>
                {rowControls(
                  config.showPointName ?? false,
                  config.pointNameFont,
                  "JetBrains Mono, monospace",
                  "pointNameFont",
                  config.pointNameFontSize,
                  10,
                  "pointNameFontSize",
                  config.pointNameJustify,
                  "pointNameJustify",
                  config.pointNameStyle,
                  "pointNameStyle",
                )}
              </div>
              {/* Show Display Name */}
              <div
                style={{
                  marginBottom: 10,
                  padding: "10px 12px",
                  background: "var(--io-surface-raised)",
                  borderRadius: 6,
                }}
              >
                <label style={row}>
                  <input
                    type="checkbox"
                    checked={config.showDisplayName ?? false}
                    onChange={(e) =>
                      onChange({ showDisplayName: e.target.checked })
                    }
                    style={{ accentColor: "var(--io-accent)" }}
                  />
                  <span style={{ fontWeight: 600, fontSize: 12 }}>
                    Show Display Name
                  </span>
                </label>
                {rowControls(
                  config.showDisplayName ?? false,
                  config.displayNameFont,
                  "Inter, sans-serif",
                  "displayNameFont",
                  config.displayNameFontSize,
                  12,
                  "displayNameFontSize",
                  config.displayNameJustify,
                  "displayNameJustify",
                  config.displayNameStyle,
                  "displayNameStyle",
                )}
              </div>
              {/* Show EU */}
              <div
                style={{
                  marginBottom: 10,
                  padding: "10px 12px",
                  background: "var(--io-surface-raised)",
                  borderRadius: 6,
                }}
              >
                <label style={row} title="Show Engineering Units">
                  <input
                    type="checkbox"
                    checked={config.showUnits ?? false}
                    onChange={(e) => onChange({ showUnits: e.target.checked })}
                    style={{ accentColor: "var(--io-accent)" }}
                  />
                  <span style={{ fontWeight: 600, fontSize: 12 }}>
                    Show EU{bodyBinding?.unit ? ` (${bodyBinding.unit})` : ""}
                  </span>
                </label>
                {rowControls(
                  config.showUnits ?? false,
                  config.euFont,
                  "JetBrains Mono, monospace",
                  "euFont",
                  config.euFontSize,
                  12,
                  "euFontSize",
                  config.euJustify,
                  "euJustify",
                  config.euStyle,
                  "euStyle",
                )}
              </div>
              {/* Value */}
              <div
                style={{
                  marginBottom: 10,
                  padding: "10px 12px",
                  background: "var(--io-surface-raised)",
                  borderRadius: 6,
                }}
              >
                <span
                  style={{
                    fontWeight: 600,
                    fontSize: 12,
                    display: "block",
                    marginBottom: 2,
                  }}
                >
                  Value
                </span>
                {rowControls(
                  true,
                  config.valueFont,
                  "JetBrains Mono, monospace",
                  "valueFont",
                  config.valueFontSize,
                  14,
                  "valueFontSize",
                  config.valueJustify,
                  "valueJustify",
                  config.valueStyle,
                  "valueStyle",
                )}
              </div>
              {/* Shared options */}
              <div
                style={{
                  display: "flex",
                  gap: 14,
                  marginBottom: 14,
                  paddingTop: 4,
                }}
              >
                <label style={row}>
                  <input
                    type="checkbox"
                    checked={config.showBox ?? true}
                    onChange={(e) => onChange({ showBox: e.target.checked })}
                    style={{ accentColor: "var(--io-accent)" }}
                  />{" "}
                  Show box
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ ...lbl, marginBottom: 0 }}>Decimals</span>
                  <select
                    style={{ ...inp, width: 60 }}
                    value={config.decimalPlaces ?? 2}
                    onChange={(e) =>
                      onChange({ decimalPlaces: Number(e.target.value) })
                    }
                  >
                    {[0, 1, 2, 3, 4, 5, 6].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          );
        })()}

      {elementType === "analog_bar" && (
        <>
          <div
            style={{
              display: "flex",
              gap: 16,
              alignItems: "center",
              marginBottom: 14,
            }}
          >
            <span style={{ ...lbl, marginBottom: 0 }}>Orientation</span>
            {(["vertical", "horizontal"] as const).map((ori) => (
              <label key={ori} style={row}>
                <input
                  type="radio"
                  name="ab-ori"
                  checked={(config.orientation ?? "vertical") === ori}
                  onChange={() => onChange({ orientation: ori })}
                  style={{ accentColor: "var(--io-accent)" }}
                />
                {ori[0]!.toUpperCase() + ori.slice(1)}
              </label>
            ))}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
              marginBottom: 14,
            }}
          >
            <div>
              <span style={lbl}>Range Low</span>
              <input
                type="number"
                style={inp}
                value={config.rangeLo ?? bodyBinding?.rangeLo ?? 0}
                onChange={(e) => onChange({ rangeLo: Number(e.target.value) })}
              />
            </div>
            <div>
              <span style={lbl}>Range High</span>
              <input
                type="number"
                style={inp}
                value={config.rangeHi ?? bodyBinding?.rangeHi ?? 100}
                onChange={(e) => onChange({ rangeHi: Number(e.target.value) })}
              />
            </div>
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 14,
              marginBottom: 14,
            }}
          >
            <label style={row}>
              <input
                type="checkbox"
                checked={config.showZoneLabels ?? true}
                onChange={(e) => onChange({ showZoneLabels: e.target.checked })}
                style={{ accentColor: "var(--io-accent)" }}
              />{" "}
              Zone labels
            </label>
            <label style={row}>
              <input
                type="checkbox"
                checked={config.showNumericReadout ?? true}
                onChange={(e) =>
                  onChange({ showNumericReadout: e.target.checked })
                }
                style={{ accentColor: "var(--io-accent)" }}
              />{" "}
              Numeric readout
            </label>
            <label style={row}>
              <input
                type="checkbox"
                checked={config.showPointer ?? false}
                onChange={(e) => onChange({ showPointer: e.target.checked })}
                style={{ accentColor: "var(--io-accent)" }}
              />{" "}
              Pointer
            </label>
          </div>
        </>
      )}

      {elementType === "fill_gauge" && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr 70px",
              gap: 8,
              marginBottom: 14,
            }}
          >
            <div>
              <span style={lbl}>Direction</span>
              <select
                style={inp}
                value={config.fillDirection ?? "up"}
                onChange={(e) =>
                  onChange({
                    fillDirection: e.target.value as
                      | "up"
                      | "down"
                      | "left"
                      | "right",
                  })
                }
              >
                {(["up", "down", "left", "right"] as const).map((d) => (
                  <option key={d} value={d}>
                    {d[0]!.toUpperCase() + d.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span style={lbl}>Range Low</span>
              <input
                type="number"
                style={inp}
                value={config.rangeLo ?? bodyBinding?.rangeLo ?? 0}
                onChange={(e) => onChange({ rangeLo: Number(e.target.value) })}
              />
            </div>
            <div>
              <span style={lbl}>Range High</span>
              <input
                type="number"
                style={inp}
                value={config.rangeHi ?? bodyBinding?.rangeHi ?? 100}
                onChange={(e) => onChange({ rangeHi: Number(e.target.value) })}
              />
            </div>
            <div>
              <span style={lbl}>Decimals</span>
              <select
                style={inp}
                value={config.decimalPlaces ?? 1}
                onChange={(e) =>
                  onChange({ decimalPlaces: Number(e.target.value) })
                }
              >
                {[0, 1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              gap: 14,
              marginBottom: 8,
              alignItems: "center",
            }}
          >
            <label style={row}>
              <input
                type="checkbox"
                checked={config.showValue ?? true}
                onChange={(e) => onChange({ showValue: e.target.checked })}
                style={{ accentColor: "var(--io-accent)" }}
              />{" "}
              Show value
            </label>
            <label style={row}>
              <input
                type="checkbox"
                checked={config.showLevelLine ?? true}
                onChange={(e) => onChange({ showLevelLine: e.target.checked })}
                style={{ accentColor: "var(--io-accent)" }}
              />{" "}
              Level line
            </label>
          </div>
          {(config.showValue ?? true) && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 14,
              }}
            >
              <span style={lbl}>Value position</span>
              <select
                style={{ ...inp, width: 100 }}
                value={config.valuePosition ?? "in-fill"}
                onChange={(e) =>
                  onChange({
                    valuePosition: e.target.value as "in-fill" | "center",
                  })
                }
              >
                <option value="in-fill">In fill</option>
                <option value="center">Center</option>
              </select>
            </div>
          )}
        </>
      )}

      {elementType === "sparkline" && (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 14,
            }}
          >
            <div style={{ flex: 1 }}>
              <span style={lbl}>Time Window</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input
                  type="number"
                  style={{ ...inp, flex: 1 }}
                  min={1}
                  value={config.timeWindowMinutes ?? 60}
                  onChange={(e) =>
                    onChange({
                      timeWindowMinutes: Math.max(1, Number(e.target.value)),
                    })
                  }
                />
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--io-text-muted)",
                    whiteSpace: "nowrap",
                  }}
                >
                  min
                </span>
              </div>
            </div>
          </div>
          <div
            style={{
              display: "flex",
              gap: 16,
              alignItems: "center",
              marginBottom: config.scaleMode === "fixed" ? 8 : 14,
            }}
          >
            <span style={{ ...lbl, marginBottom: 0 }}>Scale</span>
            {(["auto", "fixed"] as const).map((m) => (
              <label key={m} style={row}>
                <input
                  type="radio"
                  name="sp-scale"
                  checked={(config.scaleMode ?? "auto") === m}
                  onChange={() => onChange({ scaleMode: m })}
                  style={{ accentColor: "var(--io-accent)" }}
                />
                {m[0]!.toUpperCase() + m.slice(1)}
              </label>
            ))}
          </div>
          {config.scaleMode === "fixed" && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
                marginBottom: 14,
              }}
            >
              <div>
                <span style={lbl}>Fixed Low</span>
                <input
                  type="number"
                  style={inp}
                  value={config.fixedRangeLo ?? bodyBinding?.rangeLo ?? 0}
                  onChange={(e) =>
                    onChange({ fixedRangeLo: Number(e.target.value) })
                  }
                />
              </div>
              <div>
                <span style={lbl}>Fixed High</span>
                <input
                  type="number"
                  style={inp}
                  value={config.fixedRangeHi ?? bodyBinding?.rangeHi ?? 100}
                  onChange={(e) =>
                    onChange({ fixedRangeHi: Number(e.target.value) })
                  }
                />
              </div>
            </div>
          )}
        </>
      )}

      {elementType === "alarm_indicator" && (
        <div
          style={{
            display: "flex",
            gap: 16,
            alignItems: "center",
            marginBottom: 14,
          }}
        >
          <span style={{ ...lbl, marginBottom: 0 }}>Mode</span>
          {(["single", "multi"] as const).map((m) => (
            <label key={m} style={row}>
              <input
                type="radio"
                name="ai-mode"
                checked={(config.alarmMode ?? "single") === m}
                onChange={() => onChange({ alarmMode: m })}
                style={{ accentColor: "var(--io-accent)" }}
              />
              {m === "single" ? "Single point" : "Multi-point"}
            </label>
          ))}
        </div>
      )}

      {elementType === "digital_status" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "90px 1fr",
            gap: 8,
            marginBottom: 14,
          }}
        >
          <div>
            <span style={lbl}>Priority</span>
            <select
              style={inp}
              value={config.abnormalPriority ?? 3}
              onChange={(e) =>
                onChange({ abnormalPriority: Number(e.target.value) })
              }
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  P{n}
                </option>
              ))}
            </select>
          </div>
          <div>
            <span style={lbl}>Normal States (comma-separated)</span>
            <input
              type="text"
              style={inp}
              value={(config.normalStates ?? []).join(", ")}
              placeholder="0, false, off"
              onChange={(e) =>
                onChange({
                  normalStates: e.target.value
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                })
              }
            />
          </div>
        </div>
      )}

      {elementType === "point_name_label" && (
        <>
          <div
            style={{
              display: "flex",
              gap: 16,
              alignItems: "center",
              marginBottom: 14,
            }}
          >
            <span style={{ ...lbl, marginBottom: 0 }}>Style</span>
            {(["hierarchy", "uniform"] as const).map((s) => (
              <label key={s} style={row}>
                <input
                  type="radio"
                  name="pnl-style"
                  checked={(config.labelStyle ?? "hierarchy") === s}
                  onChange={() => onChange({ labelStyle: s })}
                  style={{ accentColor: "var(--io-accent)" }}
                />
                {s[0]!.toUpperCase() + s.slice(1)}
              </label>
            ))}
          </div>
          <div style={grp}>
            <span style={lbl}>Static Text Override</span>
            <input
              type="text"
              style={inp}
              value={config.labelText ?? ""}
              placeholder={
                bodyBinding?.displayName ||
                bodyBinding?.tag ||
                "Uses tag name by default"
              }
              onChange={(e) =>
                onChange({ labelText: e.target.value || undefined })
              }
            />
          </div>
        </>
      )}

      {slotPicker}
    </div>
  );
}

/** Actuator variant patterns → implied composable part */
const ACTUATOR_PATTERNS: Array<{ pattern: RegExp; partId: string }> = [
  { pattern: /actuator-diaphragm|^diaphragm$/, partId: "actuator-diaphragm" },
  { pattern: /actuator-motor|^motor$/, partId: "actuator-motor" },
  { pattern: /actuator-solenoid|^solenoid$/, partId: "actuator-solenoid" },
];

function getVariantImpliedParts(
  variantKey: string,
): Array<{ partId: string; attachment: string }> {
  for (const { pattern, partId } of ACTUATOR_PATTERNS) {
    if (pattern.test(variantKey)) {
      return [{ partId, attachment: "actuator" }];
    }
  }
  return [];
}

function getAddonAttachment(addonId: string): string {
  if (addonId.startsWith("fail-")) return "fail-indicator";
  if (addonId.startsWith("agitator-")) return "agitator";
  if (addonId.startsWith("support-")) return "support";
  return addonId;
}

function variantHasActuator(variantKey: string): boolean {
  return ACTUATOR_PATTERNS.some(({ pattern }) => pattern.test(variantKey));
}

// ---------------------------------------------------------------------------
// VariantCard
// ---------------------------------------------------------------------------

function VariantCard({
  label,
  isSelected,
  onClick,
}: {
  label: string;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 6,
        padding: 8,
        background: isSelected
          ? "color-mix(in srgb, var(--io-accent) 12%, transparent)"
          : "var(--io-surface-sunken)",
        border: `2px solid ${isSelected ? "var(--io-accent)" : "var(--io-border)"}`,
        borderRadius: "var(--io-radius)",
        cursor: "pointer",
        minWidth: 80,
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          background: isSelected
            ? "color-mix(in srgb, var(--io-accent) 20%, transparent)"
            : "color-mix(in srgb, var(--io-border) 60%, transparent)",
          borderRadius: 4,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <rect
            x="4"
            y="4"
            width="20"
            height="20"
            rx="2"
            stroke={isSelected ? "var(--io-accent)" : "var(--io-text-muted)"}
            strokeWidth="1.5"
            fill="none"
          />
          <line
            x1="9"
            y1="14"
            x2="19"
            y2="14"
            stroke={isSelected ? "var(--io-accent)" : "var(--io-text-muted)"}
            strokeWidth="1.5"
          />
          <line
            x1="14"
            y1="9"
            x2="14"
            y2="19"
            stroke={isSelected ? "var(--io-accent)" : "var(--io-text-muted)"}
            strokeWidth="1.5"
          />
        </svg>
      </div>
      <span
        style={{
          fontSize: 10,
          color: isSelected ? "var(--io-accent)" : "var(--io-text-muted)",
          textAlign: "center",
          lineHeight: 1.3,
          maxWidth: 80,
          wordBreak: "break-word",
        }}
      >
        {label}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// ShapeDropDialog
// ---------------------------------------------------------------------------

export function ShapeDropDialog({
  shapeId,
  shapeDisplayName,
  onPlace,
  onCancel,
  open,
  editMode = false,
  initialVariant,
}: ShapeDropDialogProps) {
  const loadShape = useLibraryStore((s) => s.loadShape);

  const [sidecar, setSidecar] = useState<ShapeSidecar | null>(null);
  const [loading, setLoading] = useState(true);

  // Step 1 state
  const [selectedVariant, setSelectedVariant] = useState<string>("");
  const [selectedAddons, setSelectedAddons] = useState<Set<string>>(new Set());

  // Step 2+ state
  const [bindings, setBindings] = useState<ShapeBindingEntry[]>([]);
  const [selectedElements, setSelectedElements] = useState<Set<string>>(
    new Set(),
  );
  const [elementConfigs, setElementConfigs] = useState<
    Record<string, DisplayElementUserConfig>
  >({});
  const [sdElementSlots, setSdElementSlots] = useState<Record<string, string>>(
    {},
  );
  const [focusedElement, setFocusedElement] =
    useState<DisplayElementType | null>(null);

  const [step, setStep] = useState<1 | 2 | 3>(editMode ? 2 : 1);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setSidecar(null);

    void loadShape(shapeId).then((entry) => {
      if (!entry) {
        setLoading(false);
        return;
      }
      const sc = entry.sidecar;
      setSidecar(sc);

      const opts = sc.options ?? [];
      const startVariant =
        initialVariant && opts.some((o) => o.id === initialVariant)
          ? initialVariant
          : (opts[0]?.id ?? "default");
      setSelectedVariant(startVariant);
      setSelectedAddons(new Set());

      const parts = sc.bindableParts ?? [
        { partId: "body", label: "Equipment Body", category: "process" },
      ];
      setBindings(
        parts.map((p) => ({ partKey: p.partId, tag: "", pointId: "" })),
      );
      setSelectedElements(new Set());
      setElementConfigs({});
      setFocusedElement(null);

      // Initialize element slots from sidecar.defaultSlots
      const dSlots =
        (sc.defaultSlots as Record<string, string> | undefined) ?? {};
      const initSlots: Record<string, string> = {};
      for (const { id } of ALL_ELEMENTS) {
        const key = DE_SIDECAR_KEY[id]!;
        initSlots[id] = dSlots[key] ?? DE_FALLBACK_SLOT[key] ?? "bottom";
      }
      setSdElementSlots(initSlots);

      const hasMultipleOpts = opts.length > 1;
      const hasAddons = (sc.addons ?? []).length > 0;
      setStep(hasMultipleOpts || (!editMode && hasAddons) ? 1 : 2);
      setLoading(false);
    });
  }, [open, shapeId, editMode, initialVariant, loadShape]);

  if (!open) return null;

  const variantOptions = sidecar?.options ?? [];
  const addons = sidecar?.addons ?? [];
  const allBindableParts = sidecar?.bindableParts ?? [
    { partId: "body", label: "Equipment Body", category: "process" },
  ];

  // Only show bindings for parts that are currently active
  const impliedPartIds = new Set(
    getVariantImpliedParts(selectedVariant).map((p) => p.partId),
  );
  const activeBindableParts = allBindableParts.filter(
    (p) =>
      p.partId === "body" ||
      impliedPartIds.has(p.partId) ||
      selectedAddons.has(p.partId),
  );

  const slotDefs: ShapeSlotDef[] = activeBindableParts.map((p) => ({
    partId: p.partId,
    label: p.label,
    isDefault: p.partId === "body",
  }));

  function buildComposableParts() {
    return [
      ...getVariantImpliedParts(selectedVariant),
      ...Array.from(selectedAddons).map((id) => ({
        partId: id,
        attachment: getAddonAttachment(id),
      })),
    ];
  }

  function buildConfig(): PlacedShapeConfig {
    return {
      shapeId,
      variant: selectedVariant || "default",
      composableParts: buildComposableParts(),
      pointBindings: resolvePointBindings(activeBindableParts, bindings),
      displayElements: Array.from(selectedElements),
      displayElementSlots: Object.fromEntries(
        Array.from(selectedElements).map((id) => [id, elementSlotFor(id)]),
      ),
      displayElementConfigs: Object.fromEntries(
        Array.from(selectedElements)
          .filter((id) => elementConfigs[id])
          .map((id) => [id, elementConfigs[id]!]),
      ),
    };
  }

  function elementSlotFor(id: string): string {
    // elementSlots state lives in CategoryShapeWizard; ShapeDropDialog uses a local map
    return sdElementSlots[id] ?? "bottom";
  }

  function handleUseDefaults() {
    const firstKey = variantOptions[0]?.id ?? "default";
    onPlace({
      shapeId,
      variant: firstKey,
      composableParts: getVariantImpliedParts(firstKey),
      pointBindings: [],
      displayElements: [],
    });
  }

  function handleSkipBinding() {
    onPlace({
      shapeId,
      variant: selectedVariant || "default",
      composableParts: buildComposableParts(),
      pointBindings: [],
      displayElements: Array.from(selectedElements),
    });
  }

  function toggleAddon(id: string) {
    setSelectedAddons((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // ---------------------------------------------------------------------------
  // Styles
  // ---------------------------------------------------------------------------

  const overlayStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    zIndex: 1100,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(0,0,0,0.55)",
  };

  const dialogStyle: React.CSSProperties = {
    background: "var(--io-surface-elevated)",
    border: "1px solid var(--io-border)",
    borderRadius: "var(--io-radius)",
    width: step === 1 ? 560 : 920,
    maxWidth: "94vw",
    height: step >= 2 ? "min(660px, 85vh)" : undefined,
    maxHeight: "85vh",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  };

  const sectionLabel: React.CSSProperties = {
    fontSize: 10,
    fontWeight: 600,
    color: "var(--io-text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom: 10,
  };

  function btnStyle(primary?: boolean): React.CSSProperties {
    return {
      padding: "6px 14px",
      borderRadius: "var(--io-radius)",
      fontSize: 12,
      fontWeight: 500,
      cursor: "pointer",
      border: "1px solid var(--io-border)",
      background: primary ? "var(--io-accent)" : "var(--io-surface)",
      color: primary ? "#09090b" : "var(--io-text-primary)",
    };
  }

  // ---------------------------------------------------------------------------
  // Loading
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div style={overlayStyle}>
        <div
          style={{
            ...dialogStyle,
            minHeight: 120,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div style={{ color: "var(--io-text-muted)", fontSize: 13 }}>
            Loading shape…
          </div>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div
      style={overlayStyle}
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div style={dialogStyle}>
        {/* ── Header ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "12px 16px",
            borderBottom: "1px solid var(--io-border)",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontWeight: 600,
              fontSize: 14,
              color: "var(--io-text-primary)",
              flex: 1,
            }}
          >
            {editMode ? "Shape Configuration" : `Place ${shapeDisplayName}`}
          </span>
          {!editMode && (
            <span style={{ fontSize: 11, color: "var(--io-text-muted)" }}>
              Step {step} of 3
            </span>
          )}
          <button
            onClick={onCancel}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--io-text-muted)",
              fontSize: 18,
              lineHeight: 1,
              padding: "0 2px",
            }}
          >
            ×
          </button>
        </div>

        {/* ── Body ── */}
        <div
          style={{
            flex: 1,
            overflowY: step >= 2 ? "hidden" : "auto",
            padding: 16,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          {/* Step 1 — Variants + add-ons */}
          {step === 1 && (
            <>
              {variantOptions.length > 0 && (
                <>
                  <div style={sectionLabel}>Select Variant</div>
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 8,
                      marginBottom: 20,
                    }}
                  >
                    {variantOptions.map((opt) => (
                      <VariantCard
                        key={opt.id}
                        label={opt.label}
                        isSelected={opt.id === selectedVariant}
                        onClick={() => setSelectedVariant(opt.id)}
                      />
                    ))}
                  </div>
                </>
              )}
              {addons.length > 0 && (
                <>
                  <div style={sectionLabel}>Add-ons</div>
                  <div
                    style={{ display: "flex", flexDirection: "column", gap: 8 }}
                  >
                    {addons.map((addon) => {
                      const isFailPos = addon.id.startsWith("fail-");
                      const disabled =
                        isFailPos && !variantHasActuator(selectedVariant);
                      return (
                        <label
                          key={addon.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            cursor: disabled ? "default" : "pointer",
                            opacity: disabled ? 0.4 : 1,
                            fontSize: 12,
                            color: "var(--io-text-primary)",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={selectedAddons.has(addon.id)}
                            disabled={disabled}
                            onChange={() => !disabled && toggleAddon(addon.id)}
                            style={{ accentColor: "var(--io-accent)" }}
                          />
                          {addon.label}
                          {disabled && (
                            <span
                              style={{
                                fontSize: 10,
                                color: "var(--io-text-muted)",
                              }}
                            >
                              (requires actuator variant)
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </>
              )}
              {variantOptions.length === 0 && addons.length === 0 && (
                <div
                  style={{
                    color: "var(--io-text-muted)",
                    fontSize: 12,
                    textAlign: "center",
                    padding: "24px 0",
                  }}
                >
                  No variants available. Click Next to configure display
                  elements.
                </div>
              )}
            </>
          )}

          {/* Step 2 — Display Elements */}
          {step === 2 &&
            (() => {
              const bodyBinding = bindings.find((b) => b.partKey === "body");
              return (
                <div style={{ display: "flex", gap: 0, flex: 1, minHeight: 0 }}>
                  {/* Left — element checklist */}
                  <div
                    style={{
                      width: 200,
                      flexShrink: 0,
                      borderRight: "1px solid var(--io-border)",
                      paddingRight: 12,
                      display: "flex",
                      flexDirection: "column",
                      gap: 2,
                    }}
                  >
                    <div style={sectionLabel}>Elements</div>
                    {ALL_ELEMENTS.map(({ id, label }) => {
                      const isChecked = selectedElements.has(id);
                      const isFocused = focusedElement === id;
                      return (
                        <div
                          key={id}
                          onClick={() =>
                            setFocusedElement(id as DisplayElementType)
                          }
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            padding: "5px 6px",
                            borderRadius: "var(--io-radius)",
                            cursor: "pointer",
                            background: isFocused
                              ? "color-mix(in srgb, var(--io-accent) 10%, transparent)"
                              : "transparent",
                            border: `1px solid ${isFocused ? "var(--io-accent)" : "transparent"}`,
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              e.stopPropagation();
                              if (!isChecked) {
                                setSelectedElements(
                                  (prev) => new Set([...prev, id]),
                                );
                                if (!elementConfigs[id]) {
                                  setElementConfigs((prev) => ({
                                    ...prev,
                                    [id]: makeDefaultElementConfig(
                                      id as DisplayElementType,
                                      bodyBinding,
                                    ),
                                  }));
                                }
                                setFocusedElement(id as DisplayElementType);
                              } else {
                                setSelectedElements((prev) => {
                                  const n = new Set(prev);
                                  n.delete(id);
                                  return n;
                                });
                                if (focusedElement === id)
                                  setFocusedElement(null);
                              }
                            }}
                            style={{
                              accentColor: "var(--io-accent)",
                              flexShrink: 0,
                            }}
                          />
                          <div
                            style={{
                              width: 14,
                              height: 10,
                              borderRadius: 2,
                              background:
                                DE_CHIP[id]?.color ?? "var(--io-border)",
                              flexShrink: 0,
                            }}
                          />
                          <span
                            style={{
                              fontSize: 12,
                              color: "var(--io-text-primary)",
                            }}
                          >
                            {label}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                  {/* Right — config panel */}
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      paddingLeft: 16,
                      overflowY: "auto",
                    }}
                  >
                    {focusedElement ? (
                      selectedElements.has(focusedElement) ? (
                        <DEConfigPanel
                          elementType={focusedElement}
                          config={elementConfigs[focusedElement] ?? {}}
                          onChange={(updates) =>
                            setElementConfigs((prev) => ({
                              ...prev,
                              [focusedElement]: {
                                ...(prev[focusedElement] ?? {}),
                                ...updates,
                              },
                            }))
                          }
                          slot={
                            sdElementSlots[focusedElement] ??
                            DE_FALLBACK_SLOT[DE_SIDECAR_KEY[focusedElement]!] ??
                            "bottom"
                          }
                          availableSlots={
                            (
                              sidecar?.anchorSlots as
                                | Record<string, string[]>
                                | undefined
                            )?.[DE_SIDECAR_KEY[focusedElement]!] ??
                            DE_FALLBACK_SLOTS_LIST[
                              DE_SIDECAR_KEY[focusedElement]!
                            ] ?? ["bottom"]
                          }
                          onSlotChange={(slot) =>
                            setSdElementSlots((prev) => ({
                              ...prev,
                              [focusedElement]: slot,
                            }))
                          }
                          bodyBinding={bodyBinding}
                        />
                      ) : (
                        <div
                          style={{
                            color: "var(--io-text-muted)",
                            fontSize: 12,
                            textAlign: "center",
                            padding: "40px 16px",
                          }}
                        >
                          Enable this element to configure it.
                        </div>
                      )
                    ) : (
                      <div
                        style={{
                          color: "var(--io-text-muted)",
                          fontSize: 12,
                          textAlign: "center",
                          padding: "40px 16px",
                        }}
                      >
                        Select an element on the left to configure it.
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

          {/* Step 3 — Point Bindings */}
          {step === 3 && (
            <ShapePointSelector
              slots={slotDefs}
              bindings={bindings}
              onChange={setBindings}
            />
          )}
        </div>

        {/* ── Footer ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 16px",
            borderTop: "1px solid var(--io-border)",
            flexShrink: 0,
          }}
        >
          {step === 1 && (
            <>
              {!editMode && (
                <button style={btnStyle()} onClick={handleUseDefaults}>
                  Use Defaults
                </button>
              )}
              <div style={{ flex: 1 }} />
              <button style={btnStyle()} onClick={onCancel}>
                Cancel
              </button>
              <button style={btnStyle(true)} onClick={() => setStep(2)}>
                Next →
              </button>
            </>
          )}
          {step === 2 && (
            <>
              {(!editMode || variantOptions.length > 1) && (
                <button style={btnStyle()} onClick={() => setStep(1)}>
                  ← Back
                </button>
              )}
              <div style={{ flex: 1 }} />
              <button style={btnStyle()} onClick={onCancel}>
                Cancel
              </button>
              <button style={btnStyle(true)} onClick={() => setStep(3)}>
                Next →
              </button>
            </>
          )}
          {step === 3 && (
            <>
              <button style={btnStyle()} onClick={() => setStep(2)}>
                ← Back
              </button>
              <div style={{ flex: 1 }} />
              <button style={btnStyle()} onClick={onCancel}>
                Cancel
              </button>
              <button style={btnStyle()} onClick={handleSkipBinding}>
                Skip Binding
              </button>
              <button
                style={btnStyle(true)}
                onClick={() => onPlace(buildConfig())}
              >
                {editMode ? "Save" : "Place"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
