/**
 * CategoryShapeWizard.tsx
 *
 * Multi-step shape configuration wizard opened when an equipment category
 * tile is dragged from the left palette.
 *
 * Step 0        — Pick base shape from category (thumbnail grid)
 * Steps 1 .. N  — One step per addon group in the selected shape's `addons`
 *                 (e.g. "actuator", "agitator", "support", "fail-indicator")
 * Final step    — Display element sidecars with slot picker + optional point bindings
 *
 * Layout: fixed-size dialog, left panel = full-height inline SVG composite preview,
 *         right panel = scrollable step content. "Place" available at every step.
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useLibraryStore } from "../../../store/designer";
import type { ShapeSidecar } from "../../../store/designer/libraryStore";
import type { DisplayElementType } from "../../../shared/types/graphics";
import type { PlacedShapeConfig } from "./ShapeDropDialog";
import { NAMED_SLOT_POSITIONS } from "../../../shared/graphics/anchorSlots";
import { pointsApi } from "../../../api/points";
import type { PointMeta } from "../../../api/points";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CategoryShapeWizardProps {
  categoryId: string;
  defaultShapeId: string;
  onPlace: (config: PlacedShapeConfig) => void;
  onCancel: () => void;
}

interface AddonGroup {
  group: string;
  label: string;
  options: Array<{ id: string; file: string; label: string }>;
}

// ---------------------------------------------------------------------------
// Static maps
// ---------------------------------------------------------------------------

const GROUP_TO_CATEGORY: Record<string, string> = {
  actuator: "actuators",
  "fail-indicator": "indicators",
  agitator: "agitators",
  support: "supports",
};

const GROUP_LABELS: Record<string, string> = {
  actuator: "Actuator",
  "fail-indicator": "Fail Position",
  agitator: "Agitator Type",
  support: "Support Type",
};

const DE_SIDECAR_KEY: Record<string, string> = {
  text_readout:     "TextReadout",
  alarm_indicator:  "AlarmIndicator",
  analog_bar:       "AnalogBar",
  fill_gauge:       "FillGauge",
  sparkline:        "Sparkline",
  digital_status:   "DigitalStatus",
  point_name_label: "PointNameLabel",
};

/** Default slot per element type when sidecar provides no override. */
const DE_FALLBACK_SLOT: Record<string, string> = {
  TextReadout:     "bottom",
  AlarmIndicator:  "top-right",
  AnalogBar:       "right",
  FillGauge:       "vessel-interior",
  Sparkline:       "right-top",
  DigitalStatus:   "bottom",
  PointNameLabel:  "top",
};

/** Default available slot list per element type when sidecar provides no anchorSlots. */
const DE_FALLBACK_SLOTS_LIST: Record<string, string[]> = {
  TextReadout:     ["top", "right", "bottom", "left"],
  AlarmIndicator:  ["top-right", "top-left", "bottom-right", "bottom-left"],
  AnalogBar:       ["right", "left"],
  FillGauge:       ["right", "left"],
  Sparkline:       ["right-top", "right-bottom", "left-top", "left-bottom"],
  DigitalStatus:   ["top", "right", "bottom", "left"],
  PointNameLabel:  ["top", "right", "bottom", "left"],
};

/** Chip color + abbreviation per display element type. */
const DE_CHIP: Record<string, { abbr: string; color: string }> = {
  text_readout:     { abbr: "TR", color: "#3b82f6" },
  alarm_indicator:  { abbr: "AI", color: "#ef4444" },
  analog_bar:       { abbr: "AB", color: "#22c55e" },
  fill_gauge:       { abbr: "FG", color: "#06b6d4" },
  sparkline:        { abbr: "SP", color: "#a855f7" },
  digital_status:   { abbr: "DS", color: "#f97316" },
  point_name_label: { abbr: "PN", color: "#eab308" },
};

// ---------------------------------------------------------------------------
// Composite geometry per category
//
// Defines shape dimensions and addon positioning rules.
// Actuator: sits above shape with bottom connector 2 units above shape top.
// Agitator: overlaid at same coords as vessel (same-viewBox compositing).
// Support:  overlaid at same coords but extended height (supportH extra units below).
// ---------------------------------------------------------------------------

interface ShapeGeo {
  w: number;       // shape SVG viewBox width
  h: number;       // shape SVG viewBox height
  actuatorCx: number;  // actuator x-center on shape (stem line x-coordinate)
  actuatorW: number;   // actuator SVG width in shape units (0 = no actuator)
  actuatorH: number;   // actuator SVG height in shape units
  isVessel: boolean;   // true = agitator overlays interior
  supportH: number;    // extra height below shape when support is present (0 = overlay only)
}

const CATEGORY_GEOMETRY: Record<string, ShapeGeo> = {
  valves:            { w: 48,  h: 24,  actuatorCx: 24, actuatorW: 30, actuatorH: 30, isVessel: false, supportH: 0 },
  "control-valves":  { w: 48,  h: 24,  actuatorCx: 24, actuatorW: 30, actuatorH: 30, isVessel: false, supportH: 0 },
  vessels:           { w: 40,  h: 80,  actuatorCx: 20, actuatorW: 0,  actuatorH: 0,  isVessel: true,  supportH: 6 },
  reactors:          { w: 48,  h: 80,  actuatorCx: 24, actuatorW: 0,  actuatorH: 0,  isVessel: true,  supportH: 0 },
  columns:           { w: 40,  h: 120, actuatorCx: 20, actuatorW: 0,  actuatorH: 0,  isVessel: true,  supportH: 0 },
  filters:           { w: 40,  h: 60,  actuatorCx: 20, actuatorW: 0,  actuatorH: 0,  isVessel: false, supportH: 0 },
  dryers:            { w: 40,  h: 80,  actuatorCx: 20, actuatorW: 0,  actuatorH: 0,  isVessel: false, supportH: 0 },
  pumps:             { w: 48,  h: 32,  actuatorCx: 24, actuatorW: 0,  actuatorH: 0,  isVessel: false, supportH: 0 },
  compressors:       { w: 56,  h: 40,  actuatorCx: 28, actuatorW: 0,  actuatorH: 0,  isVessel: false, supportH: 0 },
  "heat-exchangers": { w: 60,  h: 40,  actuatorCx: 30, actuatorW: 0,  actuatorH: 0,  isVessel: false, supportH: 0 },
  agitators:         { w: 40,  h: 80,  actuatorCx: 20, actuatorW: 0,  actuatorH: 0,  isVessel: true,  supportH: 0 },
  annunciators:      { w: 48,  h: 48,  actuatorCx: 24, actuatorW: 0,  actuatorH: 0,  isVessel: false, supportH: 0 },
};
const DEFAULT_GEO: ShapeGeo = {
  w: 48, h: 48, actuatorCx: 24, actuatorW: 30, actuatorH: 30, isVessel: false, supportH: 0,
};

// Gap between shape top and actuator bottom connector (in SVG units)
const ACTUATOR_CONNECTOR_GAP = 2;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getAddonAttachment(addonId: string): string {
  if (addonId.startsWith("actuator-") || addonId.includes("actuator")) return "actuator";
  if (addonId.startsWith("fail-")) return "fail-indicator";
  if (addonId.startsWith("agitator-")) return "agitator";
  if (addonId.startsWith("support-")) return "support";
  return addonId;
}

function deriveAddonGroups(sidecar: ShapeSidecar | null): AddonGroup[] {
  if (!sidecar?.addons?.length) return [];
  const groups = new Map<string, AddonGroup>();
  for (const addon of sidecar.addons) {
    const g = addon.group ?? "addon";
    if (!groups.has(g)) {
      groups.set(g, {
        group: g,
        label: GROUP_LABELS[g] ?? g.replace(/-/g, " "),
        options: [],
      });
    }
    groups.get(g)!.options.push(addon);
  }
  return Array.from(groups.values());
}

// ---------------------------------------------------------------------------
// ALL_DISPLAY_ELEMENTS — ordered list shown in the sidecar step
// ---------------------------------------------------------------------------

const ALL_DISPLAY_ELEMENTS: Array<{ id: DisplayElementType; label: string }> = [
  { id: "text_readout",     label: "Text Readout" },
  { id: "alarm_indicator",  label: "Alarm Indicator" },
  { id: "analog_bar",       label: "Analog Bar" },
  { id: "fill_gauge",       label: "Fill Gauge" },
  { id: "sparkline",        label: "Sparkline" },
  { id: "digital_status",   label: "Digital Status" },
  { id: "point_name_label", label: "Shape Label" },
];

// ---------------------------------------------------------------------------
// PointSearch — debounced OPC point picker
// ---------------------------------------------------------------------------

interface PointSearchProps {
  label: string;
  selectedTag: string;
  selectedId: string;
  onSelect: (tag: string, pointId: string) => void;
}

function PointSearch({ label, selectedTag, selectedId, onSelect }: PointSearchProps) {
  const [search, setSearch] = useState(selectedTag);
  const [results, setResults] = useState<PointMeta[]>([]);
  const [dropOpen, setDropOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const doSearch = useCallback((term: string) => {
    if (term.length < 2) { setResults([]); setDropOpen(false); return; }
    void pointsApi.list({ search: term, limit: 8 }).then((res) => {
      if (res.success) { setResults(res.data.data); setDropOpen(true); }
    });
  }, []);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setSearch(v);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => doSearch(v), 300);
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 10, fontWeight: 600, color: "var(--io-text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ position: "relative" }}>
        <input
          value={search}
          onChange={handleChange}
          onFocus={() => search.length >= 2 && setDropOpen(true)}
          onBlur={() => { timerRef.current = setTimeout(() => setDropOpen(false), 150); }}
          placeholder="Search by tag name…"
          style={{
            width: "100%", padding: "5px 28px 5px 8px",
            background: "var(--io-surface-sunken)",
            border: `1px solid ${selectedId ? "var(--io-accent)" : "var(--io-border)"}`,
            borderRadius: "var(--io-radius)", color: "var(--io-text-primary)",
            fontSize: 12, outline: "none", boxSizing: "border-box",
          }}
        />
        {search && (
          <button
            onMouseDown={() => { setSearch(""); setResults([]); setDropOpen(false); onSelect("", ""); }}
            style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "var(--io-text-muted)", fontSize: 14, padding: "0 2px" }}
          >×</button>
        )}
        {dropOpen && results.length > 0 && (
          <div style={{ position: "absolute", top: "calc(100% + 2px)", left: 0, right: 0, background: "var(--io-surface-elevated)", border: "1px solid var(--io-border)", borderRadius: "var(--io-radius)", zIndex: 20, maxHeight: 160, overflowY: "auto", boxShadow: "0 4px 16px rgba(0,0,0,0.3)" }}>
            {results.map(pt => (
              <button key={pt.id} onMouseDown={() => { setSearch(pt.tagname); setDropOpen(false); onSelect(pt.tagname, pt.id); }}
                style={{ display: "block", width: "100%", textAlign: "left", padding: "5px 10px", background: "transparent", border: "none", borderBottom: "1px solid var(--io-border)", cursor: "pointer" }}>
                <div style={{ fontFamily: "JetBrains Mono, monospace", fontSize: 11, color: "var(--io-text-primary)" }}>{pt.tagname}</div>
                {pt.display_name && <div style={{ fontSize: 10, color: "var(--io-text-muted)", marginTop: 1 }}>{pt.display_name}</div>}
              </button>
            ))}
          </div>
        )}
      </div>
      {selectedId && <div style={{ fontSize: 10, color: "var(--io-accent)", marginTop: 3 }}>✓ {selectedTag}</div>}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ShapeThumbnailCard
// ---------------------------------------------------------------------------

function ShapeThumbnailCard({
  shapeId, category, label, selected, onClick,
}: { shapeId: string; category: string; label: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
        padding: 8,
        background: selected ? "color-mix(in srgb, var(--io-accent) 12%, transparent)" : "var(--io-surface-sunken)",
        border: `2px solid ${selected ? "var(--io-accent)" : "var(--io-border)"}`,
        borderRadius: "var(--io-radius)", cursor: "pointer",
        minWidth: 76, maxWidth: 96, flex: "0 0 auto",
      }}
    >
      <div style={{ width: 56, height: 56, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <img
          src={`/shapes/${category}/${shapeId}.svg`}
          alt={label}
          style={{ maxWidth: 52, maxHeight: 52, objectFit: "contain", opacity: selected ? 1 : 0.75 }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        />
      </div>
      <span style={{ fontSize: 10, color: selected ? "var(--io-accent)" : "var(--io-text-secondary)", textAlign: "center", lineHeight: 1.3, wordBreak: "break-word" }}>
        {label}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// AddonThumbnailCard
// ---------------------------------------------------------------------------

function AddonThumbnailCard({
  file, group, label, selected, onClick,
}: { addonId: string; file: string; group: string; label: string; selected: boolean; onClick: () => void }) {
  const addonCategory = GROUP_TO_CATEGORY[group] ?? group;
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
        padding: 8,
        background: selected ? "color-mix(in srgb, var(--io-accent) 12%, transparent)" : "var(--io-surface-sunken)",
        border: `2px solid ${selected ? "var(--io-accent)" : "var(--io-border)"}`,
        borderRadius: "var(--io-radius)", cursor: "pointer",
        minWidth: 76, maxWidth: 96, flex: "0 0 auto",
      }}
    >
      <div style={{ width: 56, height: 56, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <img
          src={`/shapes/${addonCategory}/${file}`}
          alt={label}
          style={{ maxWidth: 52, maxHeight: 52, objectFit: "contain", opacity: selected ? 1 : 0.75 }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        />
      </div>
      <span style={{ fontSize: 10, color: selected ? "var(--io-accent)" : "var(--io-text-secondary)", textAlign: "center", lineHeight: 1.3, wordBreak: "break-word" }}>
        {label}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// CompositePreview — inline SVG compositing, proper attachment geometry
//
// All elements share a single coordinate space derived from the base shape's
// SVG viewBox. Addons are positioned per the HTML reference files:
//
//   Valve + actuator:  actuator above at (cx - w/2, -actuatorH), stem from
//                      (cx, shapeH/2) to (cx, -CONNECTOR_GAP)
//   Vessel + agitator: agitator overlaid at same coords (0 0 w h)
//   Vessel + support:  support overlaid at same x, extended height (0 0 w h+supportH)
//   Fail indicator:    small overlay at top-right of actuator (or top-right of shape)
//
// Display element chips are SVG rect+text at their slot-normalized positions.
// ---------------------------------------------------------------------------

interface CompositePreviewProps {
  shapeId: string;
  categoryId: string;
  selectedAddons: Record<string, string>;
  addonGroups: AddonGroup[];
  selectedElements: Set<DisplayElementType>;
  elementSlots: Record<string, string>;
}

function CompositePreview({
  shapeId, categoryId, selectedAddons, addonGroups,
  selectedElements, elementSlots,
}: CompositePreviewProps) {
  const geo = CATEGORY_GEOMETRY[categoryId] ?? DEFAULT_GEO;
  const { w: shapeW, h: shapeH, actuatorCx, actuatorW, actuatorH, isVessel, supportH } = geo;

  const actuatorAddonId = selectedAddons["actuator"];
  const agitatorAddonId = selectedAddons["agitator"];
  const supportAddonId  = selectedAddons["support"];
  const failIndAddonId  = selectedAddons["fail-indicator"];

  const hasActuator = Boolean(actuatorAddonId) && actuatorW > 0;
  const hasAgitator = Boolean(agitatorAddonId) && isVessel;
  const hasSupport  = Boolean(supportAddonId);
  const hasFailInd  = Boolean(failIndAddonId);

  function getAddonOpt(group: string) {
    const addonId = selectedAddons[group];
    if (!addonId) return null;
    const ag = addonGroups.find(g => g.group === group);
    return ag?.options.find(o => o.id === addonId) ?? null;
  }

  // Actuator is placed with its bottom at y = -ACTUATOR_CONNECTOR_GAP (just above shape top)
  // so actuator spans from y = -actuatorH to y = 0
  const actuatorY = -actuatorH;
  const actuatorX = actuatorCx - actuatorW / 2;

  // Support: overlaid at same origin but taller than shape
  const supportVH = shapeH + supportH;

  // Composite bounds in shape coordinate space
  let minX = 0, minY = 0, maxX = shapeW, maxY = shapeH;
  if (hasActuator) minY = Math.min(minY, actuatorY);
  if (hasSupport && supportH > 0) maxY = Math.max(maxY, supportVH);

  // Include fail indicator extent
  if (hasFailInd && hasActuator) {
    maxX = Math.max(maxX, actuatorX + actuatorW + actuatorW * 0.5);
  } else if (hasFailInd) {
    maxX = Math.max(maxX, shapeW * 1.35);
    minY = Math.min(minY, -shapeH * 0.25);
  }

  // Margin to accommodate display element chips (normalized positions go outside [0,1])
  const marginH = (maxX - minX) * 0.30;
  const marginV = (maxY - minY) * 0.30;
  const vx = minX - marginH;
  const vy = minY - marginV;
  const vw = (maxX - minX) + marginH * 2;
  const vh = (maxY - minY) + marginV * 2;

  // Element unit: base size for display element visuals, scaled to shorter shape dimension
  const eu = Math.min(shapeW, shapeH) * 0.10;

  return (
    <svg
      viewBox={`${vx} ${vy} ${vw} ${vh}`}
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
      style={{ display: "block" }}
    >
      {/* Actuator — above shape, bottom connector at y = -ACTUATOR_CONNECTOR_GAP */}
      {hasActuator && (() => {
        const opt = getAddonOpt("actuator");
        if (!opt) return null;
        return (
          <g key="actuator">
            <image
              href={`/shapes/actuators/${opt.file}`}
              x={actuatorX} y={actuatorY}
              width={actuatorW} height={actuatorH}
            />
            {/* Stem: valve body center → actuator bottom connector */}
            <line
              x1={actuatorCx} y1={shapeH / 2}
              x2={actuatorCx} y2={-ACTUATOR_CONNECTOR_GAP}
              stroke="#808080" strokeWidth={1.5}
            />
          </g>
        );
      })()}

      {/* Fail indicator — at top-right of actuator or top-right of shape */}
      {hasFailInd && (() => {
        const opt = getAddonOpt("fail-indicator");
        if (!opt) return null;
        const fiW = actuatorW > 0 ? actuatorW * 0.36 : shapeW * 0.22;
        const fiH = fiW;
        const fix = hasActuator
          ? actuatorX + actuatorW - fiW * 0.4
          : shapeW * 0.78;
        const fiy = hasActuator
          ? actuatorY
          : -shapeH * 0.2;
        const addonCat = GROUP_TO_CATEGORY["fail-indicator"] ?? "indicators";
        return (
          <image
            key="fail-ind"
            href={`/shapes/${addonCat}/${opt.file}`}
            x={fix} y={fiy} width={fiW} height={fiH}
          />
        );
      })()}

      {/* Main shape body */}
      <image
        href={`/shapes/${categoryId}/${shapeId}.svg`}
        x={0} y={0} width={shapeW} height={shapeH}
      />

      {/* Agitator — overlaid at identical coords (same-viewBox compositing) */}
      {hasAgitator && (() => {
        const opt = getAddonOpt("agitator");
        if (!opt) return null;
        return (
          <image
            key="agitator"
            href={`/shapes/agitators/${opt.file}`}
            x={0} y={0} width={shapeW} height={shapeH}
          />
        );
      })()}

      {/* Support — overlaid at same origin, extended to supportVH */}
      {hasSupport && (() => {
        const opt = getAddonOpt("support");
        if (!opt) return null;
        return (
          <image
            key="support"
            href={`/shapes/supports/${opt.file}`}
            x={0} y={0} width={shapeW} height={supportVH}
          />
        );
      })()}

      {/* Display elements — rendered as visual representations at their slot positions */}
      {Array.from(selectedElements).map((dt) => {
        const slot = elementSlots[dt] ?? "bottom";
        const norm = NAMED_SLOT_POSITIONS[slot] ?? NAMED_SLOT_POSITIONS["bottom"]!;
        const cx = norm.nx * shapeW;
        const cy = norm.ny * shapeH;

        if (dt === "text_readout") {
          const w = eu * 5.5, h = eu * 1.6;
          return (
            <g key={dt}>
              <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} rx={h * 0.28}
                fill="rgba(10,10,20,0.82)" stroke="#3b82f6" strokeWidth={0.45}/>
              <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central"
                fill="#93c5fd" fontSize={h * 0.58} fontFamily="monospace">0.0</text>
            </g>
          );
        }

        if (dt === "alarm_indicator") {
          const r = eu * 0.85;
          return (
            <g key={dt}>
              <circle cx={cx} cy={cy} r={r} fill="#ef4444"/>
              <circle cx={cx} cy={cy} r={r * 0.65} fill="#fca5a5" opacity={0.5}/>
              <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central"
                fill="white" fontSize={r * 1.1} fontWeight="bold" fontFamily="sans-serif">!</text>
            </g>
          );
        }

        if (dt === "analog_bar") {
          // Vertical bar gauge
          const bw = eu * 0.75, bh = eu * 4.5;
          const fillFrac = 0.62;
          return (
            <g key={dt}>
              <rect x={cx - bw / 2} y={cy - bh / 2} width={bw} height={bh} rx={bw * 0.25}
                fill="rgba(10,10,20,0.7)" stroke="#374151" strokeWidth={0.35}/>
              <rect x={cx - bw / 2} y={cy - bh / 2 + bh * (1 - fillFrac)} width={bw} height={bh * fillFrac}
                rx={bw * 0.25} fill="#22c55e" opacity={0.9}/>
            </g>
          );
        }

        if (dt === "fill_gauge") {
          // Level indicator inside vessel
          const fw = shapeW * 0.55, fh = shapeH * 0.28;
          const fillFrac = 0.58;
          return (
            <g key={dt}>
              <rect x={cx - fw / 2} y={cy - fh / 2} width={fw} height={fh} rx={eu * 0.2}
                fill="rgba(6,182,212,0.12)" stroke="#06b6d4" strokeWidth={0.4}/>
              <rect x={cx - fw / 2} y={cy - fh / 2 + fh * (1 - fillFrac)} width={fw} height={fh * fillFrac}
                rx={eu * 0.2} fill="#06b6d4" opacity={0.45}/>
              <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central"
                fill="#67e8f9" fontSize={eu * 0.7} fontFamily="monospace">62%</text>
            </g>
          );
        }

        if (dt === "sparkline") {
          const sw = eu * 5.5, sh = eu * 1.5;
          // Simple zigzag trend line
          const ys = [0.5, 0.2, 0.65, 0.3, 0.55, 0.15, 0.6];
          const pts = ys.map((y, i) => {
            const px = cx - sw / 2 + (i / (ys.length - 1)) * sw;
            const py = cy - sh / 2 + y * sh;
            return `${i === 0 ? "M" : "L"}${px},${py}`;
          }).join(" ");
          return (
            <g key={dt}>
              <rect x={cx - sw / 2} y={cy - sh / 2} width={sw} height={sh} rx={sh * 0.2}
                fill="rgba(10,10,20,0.65)" stroke="#374151" strokeWidth={0.3}/>
              <path d={pts} fill="none" stroke="#a855f7" strokeWidth={0.5}/>
            </g>
          );
        }

        if (dt === "digital_status") {
          const w = eu * 4.5, h = eu * 1.45;
          const dotR = h * 0.3;
          return (
            <g key={dt}>
              <rect x={cx - w / 2} y={cy - h / 2} width={w} height={h} rx={h * 0.28}
                fill="rgba(10,10,20,0.8)" stroke="#22c55e" strokeWidth={0.4}/>
              <circle cx={cx - w / 2 + dotR * 1.5} cy={cy} r={dotR} fill="#22c55e"/>
              <text x={cx + dotR * 0.5} y={cy} textAnchor="middle" dominantBaseline="central"
                fill="#86efac" fontSize={h * 0.52} fontFamily="monospace">ON</text>
            </g>
          );
        }

        if (dt === "point_name_label") {
          return (
            <text key={dt} x={cx} y={cy} textAnchor="middle" dominantBaseline="central"
              fill="#eab308" fontSize={eu * 0.8} fontFamily="sans-serif"
              fontWeight="500" opacity={0.9}>TAG-001</text>
          );
        }

        return null;
      })}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// CategoryShapeWizard — main component
// ---------------------------------------------------------------------------

export function CategoryShapeWizard({
  categoryId,
  defaultShapeId,
  onPlace,
  onCancel,
}: CategoryShapeWizardProps) {
  const index = useLibraryStore(s => s.index);
  const loadShape = useLibraryStore(s => s.loadShape);
  const loadShapes = useLibraryStore(s => s.loadShapes);

  // All non-part shapes visible in this category
  const categoryShapes = index.filter(s => s.category === categoryId);

  // Wizard state
  const [step, setStep] = useState(0);
  const [selectedId, setSelectedId] = useState(defaultShapeId);
  const [sidecar, setSidecar] = useState<ShapeSidecar | null>(null);
  const [addonGroups, setAddonGroups] = useState<AddonGroup[]>([]);
  const [selectedAddons, setSelectedAddons] = useState<Record<string, string>>({});
  const [selectedElements, setSelectedElements] = useState<Set<DisplayElementType>>(new Set());
  const [elementSlots, setElementSlots] = useState<Record<string, string>>({});
  const [bindings, setBindings] = useState<Array<{ partKey: string; tag: string; pointId: string }>>([]);

  // Steps: 0 (variant) + N addon groups + 1 (sidecars)
  const totalSteps = 1 + addonGroups.length + 1;
  const lastStep = totalSteps - 1;
  const isLastStep = step === lastStep;

  // Pre-load all category shape SVGs
  useEffect(() => {
    if (categoryShapes.length > 0) {
      void loadShapes(categoryShapes.map(s => s.id));
    }
  }, [categoryId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load sidecar for selected shape
  useEffect(() => {
    void loadShape(selectedId).then(entry => {
      if (!entry) return;
      const sc = entry.sidecar;
      setSidecar(sc);
      const groups = deriveAddonGroups(sc);
      setAddonGroups(groups);
      setSelectedAddons({});

      // Initialize element slots from sidecar.defaultSlots
      const dSlots = (sc.defaultSlots as Record<string, string> | undefined) ?? {};
      const initialSlots: Record<string, string> = {};
      for (const { id } of ALL_DISPLAY_ELEMENTS) {
        const key = DE_SIDECAR_KEY[id]!;
        initialSlots[id] = dSlots[key] ?? DE_FALLBACK_SLOT[key] ?? "bottom";
      }
      setElementSlots(initialSlots);

      // Point bindings per bindable part
      const parts = sc.bindableParts ?? [{ partId: "body", label: "Equipment Body", category: "equipment" }];
      setBindings(parts.map(p => ({ partKey: p.partId, tag: "", pointId: "" })));
    });
  }, [selectedId, loadShape]);

  // Build PlacedShapeConfig from current wizard state
  const buildConfig = useCallback((): PlacedShapeConfig => {
    const variant = sidecar?.options?.[0]?.id ?? "opt1";
    return {
      shapeId: selectedId,
      variant,
      composableParts: Object.values(selectedAddons)
        .filter(Boolean)
        .map(id => ({ partId: id, attachment: getAddonAttachment(id) })),
      pointBindings: bindings
        .filter(b => b.tag || b.pointId)
        .map(b => ({ partKey: b.partKey, pointId: b.pointId || undefined, pointTag: b.tag || undefined })),
      displayElements: Array.from(selectedElements) as string[],
      displayElementSlots: Object.fromEntries(
        Array.from(selectedElements).map(dt => [dt, elementSlots[dt] ?? DE_FALLBACK_SLOT[DE_SIDECAR_KEY[dt]!] ?? "bottom"])
      ),
    };
  }, [selectedId, sidecar, selectedAddons, bindings, selectedElements, elementSlots]);

  function handlePlace() { onPlace(buildConfig()); }

  function handleSelectShape(id: string) {
    setSelectedId(id);
    setStep(0);
  }

  function handleAddonToggle(group: string, addonId: string) {
    setSelectedAddons(prev => {
      if (prev[group] === addonId) {
        const next = { ...prev };
        delete next[group];
        return next;
      }
      return { ...prev, [group]: addonId };
    });
  }

  function handleElementToggle(type: DisplayElementType) {
    setSelectedElements(prev => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type); else next.add(type);
      return next;
    });
  }

  // ── Styles ─────────────────────────────────────────────────────────────────

  const overlayStyle: React.CSSProperties = {
    position: "fixed", inset: 0, zIndex: 1100,
    display: "flex", alignItems: "center", justifyContent: "center",
    background: "rgba(0,0,0,0.55)",
  };

  // Fixed dialog: left preview panel + right step content
  const dialogStyle: React.CSSProperties = {
    background: "var(--io-surface-elevated)",
    border: "1px solid var(--io-border)",
    borderRadius: "var(--io-radius)",
    width: 920,
    height: 560,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  };

  const sectionLabel: React.CSSProperties = {
    fontSize: 10, fontWeight: 600, color: "var(--io-text-muted)",
    textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10,
  };

  function btnStyle(primary?: boolean): React.CSSProperties {
    return {
      padding: "7px 16px", borderRadius: "var(--io-radius)", fontSize: 12,
      fontWeight: 500, cursor: "pointer",
      border: `1px solid ${primary ? "transparent" : "var(--io-border)"}`,
      background: primary ? "var(--io-accent)" : "var(--io-surface)",
      color: primary ? "#09090b" : "var(--io-text-primary)",
    };
  }

  function stepLabel(): string {
    if (step === 0) return "Pick Type";
    if (step <= addonGroups.length) return addonGroups[step - 1]?.label ?? "Configure";
    return "Display Elements";
  }

  const categoryLabel = categoryId.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  return (
    <div style={overlayStyle} onClick={e => { if (e.target === e.currentTarget) onCancel(); }}>
      <div style={dialogStyle}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "12px 16px", borderBottom: "1px solid var(--io-border)", flexShrink: 0,
        }}>
          <span style={{ fontWeight: 600, fontSize: 14, color: "var(--io-text-primary)", flex: 1 }}>
            Place {categoryLabel}
          </span>
          {/* Step dots */}
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            {Array.from({ length: totalSteps }, (_, i) => (
              <div key={i} style={{
                width: i === step ? 20 : 8, height: 8, borderRadius: 4,
                background: i === step
                  ? "var(--io-accent)"
                  : i < step
                  ? "color-mix(in srgb, var(--io-accent) 40%, transparent)"
                  : "var(--io-border)",
                transition: "width 0.2s, background 0.2s",
              }} />
            ))}
          </div>
          <span style={{ fontSize: 11, color: "var(--io-text-muted)", minWidth: 80, textAlign: "right" }}>
            {stepLabel()}
          </span>
          <button
            onClick={onCancel}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--io-text-muted)", fontSize: 18, lineHeight: 1, padding: "0 2px" }}
          >×</button>
        </div>

        {/* ── Body: left preview + right step content ──────────────────── */}
        <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "row" }}>

          {/* Left panel — composite SVG preview, full height */}
          <div style={{
            width: 460, flexShrink: 0,
            borderRight: "1px solid var(--io-border)",
            background: "var(--io-surface-sunken)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: 16,
          }}>
            <CompositePreview
              shapeId={selectedId}
              categoryId={categoryId}
              selectedAddons={selectedAddons}
              addonGroups={addonGroups}
              selectedElements={selectedElements}
              elementSlots={elementSlots}
            />
          </div>

          {/* Right panel — step content, scrollable */}
          <div style={{ flex: 1, minWidth: 0, overflowY: "auto", padding: 16 }}>

            {/* Step 0: Shape variant picker */}
            {step === 0 && (
              <>
                <div style={sectionLabel}>Select {categoryLabel} Type</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {categoryShapes.map(shape => (
                    <ShapeThumbnailCard
                      key={shape.id}
                      shapeId={shape.id}
                      category={categoryId}
                      label={shape.label}
                      selected={shape.id === selectedId}
                      onClick={() => handleSelectShape(shape.id)}
                    />
                  ))}
                  {categoryShapes.length === 0 && (
                    <div style={{ color: "var(--io-text-muted)", fontSize: 12 }}>No shapes in this category yet.</div>
                  )}
                </div>
              </>
            )}

            {/* Steps 1-N: Addon group pickers */}
            {step > 0 && step <= addonGroups.length && (() => {
              const ag = addonGroups[step - 1]!;
              const selectedAddon = selectedAddons[ag.group] ?? null;
              return (
                <>
                  <div style={sectionLabel}>Select {ag.label} (optional)</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {/* "None" option */}
                    <button
                      onClick={() => { const next = { ...selectedAddons }; delete next[ag.group]; setSelectedAddons(next); }}
                      style={{
                        display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                        padding: 8,
                        background: !selectedAddon ? "color-mix(in srgb, var(--io-accent) 12%, transparent)" : "var(--io-surface-sunken)",
                        border: `2px solid ${!selectedAddon ? "var(--io-accent)" : "var(--io-border)"}`,
                        borderRadius: "var(--io-radius)", cursor: "pointer", minWidth: 76,
                      }}
                    >
                      <div style={{ width: 56, height: 56, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <span style={{ fontSize: 22, color: "var(--io-text-muted)" }}>∅</span>
                      </div>
                      <span style={{ fontSize: 10, color: !selectedAddon ? "var(--io-accent)" : "var(--io-text-secondary)" }}>None</span>
                    </button>
                    {ag.options.map(opt => (
                      <AddonThumbnailCard
                        key={opt.id}
                        addonId={opt.id}
                        file={opt.file}
                        group={ag.group}
                        label={opt.label}
                        selected={selectedAddon === opt.id}
                        onClick={() => handleAddonToggle(ag.group, opt.id)}
                      />
                    ))}
                  </div>
                </>
              );
            })()}

            {/* Final step: Display elements with slot picker + point bindings */}
            {isLastStep && (
              <>
                {/* Point bindings */}
                {bindings.length > 0 && (
                  <>
                    <div style={sectionLabel}>Point Bindings (optional)</div>
                    {(sidecar?.bindableParts ?? [{ partId: "body", label: "Equipment Body", category: "equipment" }]).map(part => {
                      const b = bindings.find(x => x.partKey === part.partId);
                      return (
                        <PointSearch
                          key={part.partId}
                          label={part.label}
                          selectedTag={b?.tag ?? ""}
                          selectedId={b?.pointId ?? ""}
                          onSelect={(tag, pointId) =>
                            setBindings(prev => prev.map(x => x.partKey === part.partId ? { ...x, tag, pointId } : x))
                          }
                        />
                      );
                    })}
                    <div style={{ height: 1, background: "var(--io-border)", margin: "12px 0" }} />
                  </>
                )}

                {/* Display element checklist + slot picker */}
                <div style={sectionLabel}>Display Elements</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {ALL_DISPLAY_ELEMENTS.map(({ id, label }) => {
                    const isSelected = selectedElements.has(id);
                    const key = DE_SIDECAR_KEY[id]!;
                    const availableSlots: string[] =
                      (sidecar?.anchorSlots as Record<string, string[]> | undefined)?.[key] ??
                      DE_FALLBACK_SLOTS_LIST[key] ??
                      ["bottom"];
                    const currentSlot = elementSlots[id] ?? availableSlots[0] ?? "bottom";

                    return (
                      <div key={id}>
                        <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleElementToggle(id)}
                            style={{ accentColor: "var(--io-accent)", width: 14, height: 14, flexShrink: 0 }}
                          />
                          <div
                            style={{
                              width: 18, height: 12, borderRadius: 2,
                              background: DE_CHIP[id]?.color ?? "var(--io-border)",
                              flexShrink: 0,
                            }}
                          />
                          <span style={{ fontSize: 12, color: "var(--io-text-primary)" }}>{label}</span>
                        </label>

                        {/* Slot picker — only shown when element is selected */}
                        {isSelected && (
                          <div style={{ marginLeft: 22, marginTop: 6, display: "flex", flexWrap: "wrap", gap: 4 }}>
                            {availableSlots.map(slot => (
                              <button
                                key={slot}
                                onClick={() => setElementSlots(prev => ({ ...prev, [id]: slot }))}
                                style={{
                                  padding: "2px 8px", fontSize: 10,
                                  border: `1px solid ${currentSlot === slot ? "var(--io-accent)" : "var(--io-border)"}`,
                                  borderRadius: "var(--io-radius)",
                                  background: currentSlot === slot ? "color-mix(in srgb, var(--io-accent) 15%, transparent)" : "transparent",
                                  color: currentSlot === slot ? "var(--io-accent)" : "var(--io-text-muted)",
                                  cursor: "pointer",
                                  fontFamily: "JetBrains Mono, monospace",
                                }}
                              >
                                {slot}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        {/* ── Footer ──────────────────────────────────────────────────────── */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          padding: "10px 16px", borderTop: "1px solid var(--io-border)", flexShrink: 0,
        }}>
          {step > 0 && (
            <button style={btnStyle()} onClick={() => setStep(s => s - 1)}>← Back</button>
          )}
          <div style={{ flex: 1 }} />
          <button style={btnStyle()} onClick={onCancel}>Cancel</button>
          <button style={btnStyle(true)} onClick={handlePlace}>Place ↗</button>
          {!isLastStep && (
            <button style={btnStyle()} onClick={() => setStep(s => s + 1)}>Next →</button>
          )}
        </div>

      </div>
    </div>
  );
}
