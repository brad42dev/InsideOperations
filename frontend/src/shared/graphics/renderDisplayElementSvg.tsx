/**
 * renderDisplayElementSvg.tsx
 *
 * Shared pure render functions for DisplayElement sub-types. Each function
 * takes a DisplayElement, a DisplayElementRenderContext, and returns React SVG
 * elements (or null).
 *
 * Used by both SceneRenderer (Console/Process runtime) and DesignerCanvas
 * (Designer) to ensure visual parity across all rendering surfaces.
 *
 * These functions are pure -- no hooks, no store access, no side effects.
 * The caller provides all needed data (point values, sparkline history, etc.)
 * through the DisplayElementRenderContext parameter.
 *
 * CRITICAL: All `data-role`, `data-node-id`, `data-lod`, `data-point-id`,
 * `data-point-tag`, `data-display-type` attributes MUST be preserved exactly.
 * They are anchors for the direct DOM mutation path (`applyPointValue`).
 */

import React from "react";
import type {
  DisplayElement,
  TextReadoutConfig,
  AnalogBarConfig,
  FillGaugeConfig,
  SparklineConfig,
  DigitalStatusConfig,
  PointNameLabelConfig,
} from "../types/graphics";
import { ALARM_COLORS, ZONE_FILLS, DE_COLORS } from "./displayElementColors";

// ---------------------------------------------------------------------------
// Shared helpers -- moved from SceneRenderer and DesignerCanvas
// ---------------------------------------------------------------------------

/** Alarm priority number to CSS class name fragment. */
export const ALARM_PRIORITY_NAMES: Record<number, string> = {
  1: "urgent",
  2: "high",
  3: "low",
  4: "diagnostic",
  5: "custom",
};

/**
 * Printf-style value formatter supporting %auto, %.Nf, %d, and %.Ng.
 * This is the SceneRenderer implementation (the more complete one).
 */
export function formatValue(
  raw: string | number | null,
  fmt: string,
): string {
  if (raw === null || raw === undefined) return "---";
  if (typeof raw === "number") {
    if (fmt === "%auto") {
      const abs = Math.abs(raw);
      if (!isFinite(raw)) return String(raw);
      if (abs === 0) return "0";
      if (abs >= 10000) return raw.toFixed(0);
      if (abs >= 1000) return raw.toFixed(1);
      if (abs >= 100) return raw.toFixed(2);
      if (abs >= 10) return raw.toFixed(3);
      if (abs >= 1) return raw.toFixed(3);
      return parseFloat(raw.toPrecision(3)).toString();
    }
    const fMatch = fmt.match(/^%\.(\d+)f/);
    if (fMatch) return raw.toFixed(parseInt(fMatch[1]));
    if (/^%\.?0?d$|^%d$/.test(fmt)) return Math.round(raw).toString();
    const gMatch = fmt.match(/^%\.(\d+)g/);
    if (gMatch)
      return parseFloat(raw.toPrecision(parseInt(gMatch[1]))).toString();
  }
  return String(raw);
}

/**
 * Returns a format-representative placeholder string for use in designer
 * preview when no point is bound. Mirrors the width/shape of real values.
 * %.2f → "--.--"  %.1f → "--.-"  %d/%i → "---"  %auto → "--.--"
 */
export function formatDesignPlaceholder(fmt: string): string {
  if (fmt === "%auto") return "--.--";
  const fMatch = fmt.match(/^%\.(\d+)f/);
  if (fMatch) {
    const decimals = parseInt(fMatch[1]);
    if (decimals === 0) return "---";
    return "--." + "-".repeat(decimals);
  }
  if (/^%\.?0?d$|^%d$|^%i$/.test(fmt)) return "---";
  const gMatch = fmt.match(/^%\.(\d+)g/);
  if (gMatch) return "--.--";
  return "---";
}

/**
 * Render the alarm indicator shape based on priority (ISA-18.2 shapes).
 * P1 Urgent = rect, P2 High = upward triangle, P3 Low = downward triangle,
 * P4 Diagnostic = ellipse, P5 Custom = diamond.
 * Ghost mode (inactive in designer/preview) always uses rect.
 */
export function renderAlarmShape(
  priority: number,
  isGhost: boolean,
  color: string,
): React.ReactElement {
  if (isGhost || priority === 1) {
    return (
      <rect
        x={-12}
        y={-9}
        width={24}
        height={18}
        rx={2}
        fill="none"
        stroke={color}
        strokeWidth={1.8}
      />
    );
  }
  if (priority === 2)
    return (
      <polygon
        points="0,-12 12,8 -12,8"
        fill="none"
        stroke={color}
        strokeWidth={1.8}
      />
    );
  if (priority === 3)
    return (
      <polygon
        points="0,12 12,-8 -12,-8"
        fill="none"
        stroke={color}
        strokeWidth={1.8}
      />
    );
  if (priority === 4)
    return (
      <ellipse rx={14} ry={10} fill="none" stroke={color} strokeWidth={1.8} />
    );
  return (
    <polygon
      points="0,-12 12,0 0,12 -12,0"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
    />
  );
}

/** Convert DisplayElementFontFamily to a CSS font-family string. */
export function deFontToCss(f: string | undefined): string {
  if (f === "IBM Plex Sans") return "'IBM Plex Sans', sans-serif";
  if (f === "Inter") return "Inter, sans-serif";
  return "'JetBrains Mono', monospace";
}

// ---------------------------------------------------------------------------
// DisplayElementRenderContext
// ---------------------------------------------------------------------------

/** Point value data passed from the caller. */
export interface PointValueData {
  value: string | number | null;
  quality?: string;
  stale?: boolean;
  manual?: boolean;
  units?: string;
  alarmPriority?: number | null;
  unacknowledged?: boolean;
}

export interface DisplayElementRenderContext {
  /** SVG transform string for this node (caller computes) */
  transform: string;
  /** Resolved point ID (UUID) used as key into point value maps */
  pvKey?: string;
  /** Point value data for this element's binding */
  pointValue?: PointValueData;
  /** Human-readable tag name */
  pointTag?: string;
  /** Discrete label resolved from point metadata (null for analog) */
  discreteLabel?: string | null;
  /** Offset from parent SymbolInstance origin (for signal lines) */
  parentOffset?: { x: number; y: number };
  /** Vessel interior clip path (for fill_gauge vessel_overlay mode) */
  vesselInteriorPath?: string;
  /** Sparkline history buffer */
  sparklineHistory?: number[];
  /** Setpoint value (for analog_bar setpoint display) */
  setpointValue?: number | null;
  /** Whether we're in designer mode (shows ghosts, placeholders) */
  designerMode?: boolean;
  /** Whether we're in preview mode (shows ghosts for inactive alarms) */
  previewMode?: boolean;
}

// ---------------------------------------------------------------------------
// Dispatch
// ---------------------------------------------------------------------------

/**
 * Render a DisplayElement as pure SVG. Dispatches to the appropriate sub-type
 * function based on `node.displayType`.
 *
 * Returns null for unknown display types.
 */
export function renderDisplayElementSvg(
  node: DisplayElement,
  ctx: DisplayElementRenderContext,
): React.ReactElement | null {
  switch (node.displayType) {
    case "text_readout":
      return renderTextReadoutSvg(node, ctx);
    case "alarm_indicator":
      return renderAlarmIndicatorSvg(node, ctx);
    case "digital_status":
      return renderDigitalStatusSvg(node, ctx);
    case "analog_bar":
      return renderAnalogBarSvg(node, ctx);
    case "sparkline":
      return renderSparklineSvg(node, ctx);
    case "fill_gauge":
      return renderFillGaugeSvg(node, ctx);
    case "point_name_label":
      return renderPointNameLabelSvg(node, ctx);
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// text_readout
// ---------------------------------------------------------------------------

export function renderTextReadoutSvg(
  node: DisplayElement,
  ctx: DisplayElementRenderContext,
): React.ReactElement {
  const cfg = node.config as TextReadoutConfig;
  const pv = ctx.pointValue;
  const deTransform = ctx.transform;
  const pvKey = ctx.pvKey;
  const pointTag = ctx.pointTag;

  const alarmPriority = (pv?.alarmPriority ?? null) as
    | 1 | 2 | 3 | 4 | 5 | null;
  const unacked = pv?.unacknowledged ?? false;
  const quality = pv?.quality ?? "good";
  const isStale = pv?.stale ?? false;
  const isCommFail = quality === "comm_fail";
  const isBad = quality === "bad" && !isCommFail;
  const isManual = pv?.manual ?? false;

  const rawValueStr = isCommFail
    ? "COMM"
    : isBad
      ? "????"
      : ctx.discreteLabel !== null && ctx.discreteLabel !== undefined
        ? ctx.discreteLabel
        : formatValue(pv?.value ?? null, cfg.valueFormat);
  const alarmColor = alarmPriority ? ALARM_COLORS[alarmPriority] : null;
  const boxFill = isCommFail
    ? DE_COLORS.displayZoneInactive
    : alarmColor
      ? `${alarmColor}33`
      : DE_COLORS.surfaceElevated;
  const boxStroke = isBad
    ? ALARM_COLORS[1]
    : isCommFail
      ? DE_COLORS.borderStrong
      : (alarmColor ?? DE_COLORS.border);
  const strokeWidth = isBad || alarmColor ? 2 : 1;
  const strokeDash = isStale ? "4 2" : isBad ? "4 2" : undefined;
  const strokeDotted = quality === "uncertain" ? "2 2" : undefined;
  const effectiveDash = strokeDash ?? strokeDotted;
  const opacity = isStale ? 0.6 : node.opacity;
  const valueColor = isCommFail
    ? DE_COLORS.textMuted
    : isBad
      ? ALARM_COLORS[1]
      : alarmColor
        ? DE_COLORS.textPrimary
        : DE_COLORS.textSecondary;
  const flashClass = unacked && alarmColor ? "io-alarm-flash" : "";

  // Row-based layout
  const ROW_H = 16;
  const GAP = 2;
  const pnEnabled = cfg.pointNameRow?.enabled ?? false;
  const dnEnabled = cfg.displayNameRow?.enabled ?? false;
  const unitText = (pv?.units ?? node.binding.unit) || "";
  const euEnabled = cfg.showUnits && !!unitText && !isCommFail && !isBad;
  const labelRows = (pnEnabled ? 1 : 0) + (dnEnabled ? 1 : 0);
  const valueBoxH = ROW_H;
  const totalH = labelRows * (ROW_H + GAP) + valueBoxH;
  const euSuffix = euEnabled ? ` ${unitText}` : "";
  const w = Math.max(
    cfg.minWidth ?? 40,
    rawValueStr.length * 7 + euSuffix.length * 5 + 8,
  );
  const textX = Math.round(w / 2);

  const els: React.ReactNode[] = [];
  let yOff = 0;

  if (pnEnabled) {
    const r = cfg.pointNameRow!;
    if (r.showBackground) {
      els.push(
        <rect key="pn-bg" data-role="pn-bg" x={0} y={yOff} width={w} height={ROW_H} rx={1} fill="rgba(0,0,0,0.5)" />,
      );
    }
    els.push(
      <text
        key="pn" data-role="pn" x={w / 2} y={yOff + ROW_H - 4} textAnchor="middle"
        fontFamily="JetBrains Mono" fontSize={r.fontSize ?? 10}
        fontWeight={r.fontWeight ?? "normal"} fill={r.color || DE_COLORS.textPrimary}
      >
        {node.binding.pointTag ?? "\u2014"}
      </text>,
    );
    yOff += ROW_H + GAP;
  }

  if (dnEnabled) {
    const r = cfg.displayNameRow!;
    if (r.showBackground) {
      els.push(
        <rect key="dn-bg" data-role="dn-bg" x={0} y={yOff} width={w} height={ROW_H} rx={1} fill="rgba(0,0,0,0.5)" />,
      );
    }
    els.push(
      <text
        key="dn" data-role="dn" x={w / 2} y={yOff + ROW_H - 4} textAnchor="middle"
        fontFamily="Inter" fontSize={r.fontSize ?? 12}
        fontWeight={r.fontWeight ?? "normal"} fill={r.color || DE_COLORS.textMuted}
      >
        {node.binding.displayName ?? "\u2014"}
      </text>,
    );
    yOff += ROW_H + GAP;
  }

  // Value box
  if (cfg.showBox !== false) {
    els.push(
      <rect
        key="box" data-role="box" x={0} y={yOff} width={w} height={valueBoxH}
        rx={2} fill={boxFill} stroke={boxStroke} strokeWidth={strokeWidth}
        strokeDasharray={effectiveDash}
      />,
    );
  }

  const vr = cfg.valueRow;
  const er = cfg.euRow;
  els.push(
    <text
      key="value" data-role="value" x={textX} y={yOff + ROW_H - 4}
      textAnchor="middle" fontFamily="JetBrains Mono"
      fontSize={vr?.fontSize ?? 11} fontWeight={vr?.fontWeight ?? "normal"}
      fill={valueColor} style={{ fontVariantNumeric: "tabular-nums" }}
    >
      <tspan data-role="v">{rawValueStr}</tspan>
      {euEnabled && (
        <tspan
          data-role="eu" fontFamily="Inter"
          fontSize={er?.fontSize ?? 9}
          fill={er?.color || DE_COLORS.textMuted}
        > {unitText}</tspan>
      )}
    </text>,
  );

  if (isManual) {
    els.push(
      <text
        key="manual-badge" data-role="manual-badge" x={w - 2} y={yOff + 2}
        textAnchor="end" dominantBaseline="hanging"
        fontFamily="Inter" fontSize={7} fontWeight={700} fill={DE_COLORS.manualBadge}
      >
        M
      </text>,
    );
  }

  const parentOffset = ctx.parentOffset;
  const hOff = Math.round(20 - w / 2);
  return (
    <g
      key={node.id}
      className={`io-display-element ${flashClass}`}
      transform={`${deTransform} translate(${hOff},0)`}
      opacity={opacity}
      data-node-id={node.id}
      data-lod="1"
      data-point-id={pvKey}
      data-point-tag={pointTag}
      data-display-type="text_readout"
      data-value-box-y={String(yOff)}
      data-eu-unit={euEnabled ? unitText : ""}
      data-min-width={String(cfg.minWidth ?? 40)}
      data-base-transform={deTransform}
    >
      {els}
      {cfg.showSignalLine &&
        parentOffset &&
        (() => {
          const ex = -parentOffset.x;
          const ey = -parentOffset.y;
          return (
            <line
              x1={0}
              y1={totalH / 2}
              x2={ex}
              y2={ey}
              stroke="#52525B"
              strokeWidth={0.75}
              strokeDasharray="3 2"
            />
          );
        })()}
    </g>
  );
}

// ---------------------------------------------------------------------------
// alarm_indicator
// ---------------------------------------------------------------------------

export function renderAlarmIndicatorSvg(
  node: DisplayElement,
  ctx: DisplayElementRenderContext,
): React.ReactElement {
  const pv = ctx.pointValue;
  const pvKey = ctx.pvKey;
  const pointTag = ctx.pointTag;
  const deTransform = ctx.transform;
  const designerMode = ctx.designerMode ?? false;
  const previewMode = ctx.previewMode ?? false;

  const active = !!pv?.alarmPriority;
  const priority = (pv?.alarmPriority ?? 1) as 1 | 2 | 3 | 4 | 5;
  const unacked = pv?.unacknowledged ?? false;
  const isGhost = !active && (designerMode || previewMode);
  const color = isGhost
    ? DE_COLORS.equipStroke
    : (ALARM_COLORS[priority] ?? ALARM_COLORS[1]);
  const flashClass =
    unacked && !isGhost
      ? `io-alarm-flash-${ALARM_PRIORITY_NAMES[priority]}`
      : "";
  const label = isGhost ? "\u2014" : String(priority);
  const shapeEl = renderAlarmShape(priority, isGhost, color);

  return (
    <g
      key={node.id}
      className={`io-alarm-indicator ${flashClass}`}
      data-node-id={node.id}
      data-lod="1"
      data-lod-override="always"
      opacity={isGhost ? 0.25 : node.opacity}
      transform={deTransform}
      data-point-tag={pointTag}
      data-display-type="alarm_indicator"
      data-point-id={pvKey}
      style={{ display: active || designerMode || previewMode ? undefined : "none" }}
    >
      {shapeEl}
      <text
        x={0}
        y={0}
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="JetBrains Mono"
        fontSize={9}
        fontWeight={600}
        fill={color}
      >
        {label}
      </text>
    </g>
  );
}

// ---------------------------------------------------------------------------
// digital_status
// ---------------------------------------------------------------------------

export function renderDigitalStatusSvg(
  node: DisplayElement,
  ctx: DisplayElementRenderContext,
): React.ReactElement {
  const cfg = node.config as DigitalStatusConfig;
  const pv = ctx.pointValue;
  const pvKey = ctx.pvKey;
  const pointTag = ctx.pointTag;
  const deTransform = ctx.transform;
  const parentOffset = ctx.parentOffset;

  const rawVal =
    pv?.value !== undefined && pv.value !== null
      ? String(pv.value)
      : null;
  const label =
    rawVal !== null
      ? (cfg.stateLabels[rawVal] ?? ctx.discreteLabel ?? rawVal)
      : "---";
  const isNormal = rawVal === null || cfg.normalStates.includes(rawVal);
  const fill = isNormal
    ? DE_COLORS.displayZoneInactive
    : (ALARM_COLORS[cfg.abnormalPriority] ?? ALARM_COLORS[1]);
  const textColor = isNormal
    ? DE_COLORS.textSecondary
    : DE_COLORS.textPrimary;
  const w = Math.max(40, label.length * 7.5 + 12);

  return (
    <g
      key={node.id}
      className="io-display-element"
      data-node-id={node.id}
      data-lod="2"
      opacity={node.opacity}
      transform={deTransform}
      data-point-tag={pointTag}
      data-display-type="digital_status"
      data-point-id={pvKey}
    >
      <rect
        data-role="bg"
        x={0}
        y={0}
        width={w}
        height={22}
        rx={2}
        fill={fill}
      />
      <text
        data-role="value"
        x={w / 2}
        y={11}
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="JetBrains Mono"
        fontSize={9}
        fill={textColor}
      >
        {label}
      </text>
      {cfg.showSignalLine &&
        parentOffset &&
        (() => {
          const h = 22;
          const ex = -parentOffset.x;
          const ey = -parentOffset.y;
          return (
            <line
              x1={0}
              y1={h / 2}
              x2={ex}
              y2={ey}
              stroke="#52525B"
              strokeWidth={0.75}
              strokeDasharray="3 2"
            />
          );
        })()}
    </g>
  );
}

// ---------------------------------------------------------------------------
// analog_bar
// ---------------------------------------------------------------------------

export function renderAnalogBarSvg(
  node: DisplayElement,
  ctx: DisplayElementRenderContext,
): React.ReactElement {
  const cfg = node.config as AnalogBarConfig;
  const pv = ctx.pointValue;
  const pvKey = ctx.pvKey;
  const pointTag = ctx.pointTag;
  const deTransform = ctx.transform;
  const parentOffset = ctx.parentOffset;

  const value = typeof pv?.value === "number" ? pv.value : null;
  const alarmPriority = pv?.alarmPriority as
    | (1 | 2 | 3 | 4 | 5)
    | null
    | undefined;
  const range = cfg.rangeHi - cfg.rangeLo || 1;
  const pct =
    value !== null
      ? Math.max(0, Math.min(1, (value - cfg.rangeLo) / range))
      : 0;
  const { barWidth: bw, barHeight: bh, thresholds } = cfg;
  const hhH =
    thresholds?.hh !== undefined
      ? ((cfg.rangeHi - thresholds.hh) / range) * bh
      : bh * 0.1;
  const hH =
    thresholds?.h !== undefined && thresholds?.hh !== undefined
      ? ((thresholds.hh - thresholds.h) / range) * bh
      : bh * 0.18;
  const llH =
    thresholds?.ll !== undefined
      ? ((thresholds.ll - cfg.rangeLo) / range) * bh
      : bh * 0.1;
  const lH =
    thresholds?.l !== undefined && thresholds?.ll !== undefined
      ? ((thresholds.l - thresholds.ll) / range) * bh
      : bh * 0.18;
  const normalH = bh - hhH - hH - llH - lH;
  const pointerY = (1 - pct) * bh;

  // Determine which zone the current value falls in
  const valueZone = (() => {
    if (value === null) return null;
    const { hh, h, l, ll } = cfg.thresholds ?? {};
    if (hh !== undefined && value >= hh) return "hh";
    if (h !== undefined && value >= h) return "h";
    if (ll !== undefined && value < ll) return "ll";
    if (l !== undefined && value < l) return "l";
    return "normal";
  })();

  // Zone fill with alarm replacement
  const zoneFills = {
    hh:
      valueZone === "hh" &&
      alarmPriority &&
      cfg.thresholds?.hhAlarmPriority
        ? ALARM_COLORS[cfg.thresholds.hhAlarmPriority]
        : ZONE_FILLS.hh,
    h:
      valueZone === "h" && alarmPriority && cfg.thresholds?.hAlarmPriority
        ? ALARM_COLORS[cfg.thresholds.hAlarmPriority]
        : ZONE_FILLS.h,
    normal: ZONE_FILLS.normal,
    l:
      valueZone === "l" && alarmPriority && cfg.thresholds?.lAlarmPriority
        ? ALARM_COLORS[cfg.thresholds.lAlarmPriority]
        : ZONE_FILLS.l,
    ll:
      valueZone === "ll" &&
      alarmPriority &&
      cfg.thresholds?.llAlarmPriority
        ? ALARM_COLORS[cfg.thresholds.llAlarmPriority]
        : ZONE_FILLS.ll,
  };
  const zones = [
    { fill: zoneFills.hh, y: 0, h: hhH, label: "HH", role: "zone-hh" },
    { fill: zoneFills.h, y: hhH, h: hH, label: "H", role: "zone-h" },
    {
      fill: zoneFills.normal,
      y: hhH + hH,
      h: normalH,
      label: "",
      role: "zone-normal",
    },
    {
      fill: zoneFills.l,
      y: hhH + hH + normalH,
      h: lH,
      label: "L",
      role: "zone-l",
    },
    {
      fill: zoneFills.ll,
      y: hhH + hH + normalH + lH,
      h: llH,
      label: "LL",
      role: "zone-ll",
    },
  ];

  return (
    <g
      key={node.id}
      className="io-display-element"
      data-node-id={node.id}
      data-lod="2"
      opacity={node.opacity}
      transform={deTransform}
      data-point-tag={pointTag}
      data-display-type="analog_bar"
      data-point-id={pvKey}
    >
      <rect
        x={0}
        y={0}
        width={bw}
        height={bh}
        fill={DE_COLORS.surfaceElevated}
        stroke={DE_COLORS.borderStrong}
        strokeWidth={0.5}
      />
      {zones.map((z, i) => (
        <rect
          key={i}
          data-role={z.role}
          x={1}
          y={z.y}
          width={bw - 2}
          height={Math.max(0, z.h)}
          fill={z.fill}
          stroke={DE_COLORS.borderStrong}
          strokeWidth={0.5}
        />
      ))}
      {cfg.showZoneLabels &&
        zones
          .filter((z) => z.label)
          .map((z, i) => (
            <text
              key={i}
              x={-3}
              y={z.y + z.h / 2}
              textAnchor="end"
              dominantBaseline="central"
              fontFamily="JetBrains Mono"
              fontSize={7}
              fill={DE_COLORS.textMuted}
            >
              {z.label}
            </text>
          ))}
      {cfg.showPointer && value !== null && (
        <>
          <polygon
            data-role="pointer"
            points={`${bw},${pointerY - 3} ${bw + 6},${pointerY} ${bw},${pointerY + 3}`}
            fill={
              alarmPriority
                ? (ALARM_COLORS[alarmPriority] ?? DE_COLORS.textSecondary)
                : DE_COLORS.textSecondary
            }
          />
          <line
            data-role="pointer-line"
            x1={1}
            y1={pointerY}
            x2={bw - 1}
            y2={pointerY}
            stroke={
              alarmPriority
                ? (ALARM_COLORS[alarmPriority] ?? DE_COLORS.textSecondary)
                : DE_COLORS.textSecondary
            }
            strokeWidth={1}
          />
        </>
      )}
      {cfg.showSetpoint &&
        (() => {
          const spVal = ctx.setpointValue ?? null;
          if (spVal === null) return null;
          const spPct = Math.max(
            0,
            Math.min(1, (spVal - cfg.rangeLo) / range),
          );
          const spY = (1 - spPct) * bh;
          return (
            <polygon
              points={`${bw},${spY - 4} ${bw + 5},${spY} ${bw},${spY + 4} ${bw - 5},${spY}`}
              fill="none"
              stroke={DE_COLORS.accent}
              strokeWidth={1}
            />
          );
        })()}
      {cfg.showNumericReadout && value !== null && (
        <text
          data-role="numeric"
          x={bw / 2}
          y={bh + 10}
          textAnchor="middle"
          fontFamily="JetBrains Mono"
          fontSize={11}
          fill={
            alarmPriority
              ? (ALARM_COLORS[alarmPriority] ?? DE_COLORS.textSecondary)
              : DE_COLORS.textSecondary
          }
        >
          {value.toFixed(1)}
        </text>
      )}
      {cfg.showSignalLine &&
        parentOffset &&
        (() => {
          const ex = -parentOffset.x;
          const ey = -parentOffset.y;
          return (
            <line
              x1={0}
              y1={bh / 2}
              x2={ex}
              y2={ey}
              stroke={DE_COLORS.borderStrong}
              strokeWidth={0.75}
              strokeDasharray="3 2"
            />
          );
        })()}
    </g>
  );
}

// ---------------------------------------------------------------------------
// sparkline
// ---------------------------------------------------------------------------

export function renderSparklineSvg(
  node: DisplayElement,
  ctx: DisplayElementRenderContext,
): React.ReactElement {
  const cfg = node.config as SparklineConfig;
  const pv = ctx.pointValue;
  const pvKey = ctx.pvKey;
  const pointTag = ctx.pointTag;
  const deTransform = ctx.transform;
  const parentOffset = ctx.parentOffset;

  const W = cfg.sparkWidth ?? 110;
  const H = cfg.sparkHeight ?? 18;
  const targetPoints = cfg.dataPoints ?? 60;
  const alarmPriority = pv?.alarmPriority as number | null | undefined;
  const strokeColor = alarmPriority
    ? (ALARM_COLORS[alarmPriority] ?? DE_COLORS.textSecondary)
    : DE_COLORS.textSecondary;

  const rawHistory = ctx.sparklineHistory;
  let polylinePoints = "";
  if (rawHistory && rawHistory.length >= 2) {
    const nums = rawHistory.filter(
      (v) => typeof v === "number" && isFinite(v),
    );
    const sampled =
      nums.length <= targetPoints
        ? nums
        : (() => {
            const out: number[] = [];
            for (let i = 0; i < targetPoints; i++) {
              out.push(
                nums[
                  Math.round((i * (nums.length - 1)) / (targetPoints - 1))
                ],
              );
            }
            return out;
          })();
    if (sampled.length >= 2) {
      const lo = Math.min(...sampled);
      const hi = Math.max(...sampled);
      const range = hi - lo || 1;
      const pad = 2;
      polylinePoints = sampled
        .map((v, i) => {
          const px = pad + (i / (sampled.length - 1)) * (W - pad * 2);
          const py = pad + (1 - (v - lo) / range) * (H - pad * 2);
          return `${px.toFixed(1)},${py.toFixed(1)}`;
        })
        .join(" ");
    }
  }

  return (
    <g
      key={node.id}
      className="io-display-element"
      data-node-id={node.id}
      data-lod="2"
      opacity={node.opacity}
      transform={deTransform}
      data-point-tag={pointTag}
      data-display-type="sparkline"
      data-point-id={pvKey}
    >
      <rect
        x={0}
        y={0}
        width={W}
        height={H}
        rx={1}
        fill={DE_COLORS.surfaceElevated}
      />
      {polylinePoints ? (
        <polyline
          points={polylinePoints}
          fill="none"
          stroke={strokeColor}
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ) : (
        <line
          x1={3}
          y1={H / 2}
          x2={W - 3}
          y2={H / 2}
          stroke={strokeColor}
          strokeWidth={1.5}
          strokeLinecap="round"
          opacity={0.3}
        />
      )}
      {cfg.showSignalLine &&
        parentOffset &&
        (() => {
          const ex = -parentOffset.x;
          const ey = -parentOffset.y;
          return (
            <line
              x1={0}
              y1={H / 2}
              x2={ex}
              y2={ey}
              stroke="#52525B"
              strokeWidth={0.75}
              strokeDasharray="3 2"
            />
          );
        })()}
    </g>
  );
}

// ---------------------------------------------------------------------------
// fill_gauge helpers
// ---------------------------------------------------------------------------

/**
 * Computes the bounding box of an SVG path `d` string.
 * Handles M, L, H, V, A, Z commands (uppercase/absolute only).
 * Arcs are handled with full center-parameterization to get exact extremes.
 */
export function getPathBBox(
  d: string,
): { x: number; y: number; width: number; height: number } {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  let curX = 0,
    curY = 0;

  const extend = (x: number, y: number) => {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  };

  // Returns true if angle a falls within the arc swept from theta1 by dtheta.
  // dtheta > 0 = clockwise (sweep=1), dtheta < 0 = counter-clockwise (sweep=0).
  const inArcRange = (a: number, theta1: number, dtheta: number): boolean => {
    if (dtheta === 0) return false;
    if (Math.abs(dtheta) >= 2 * Math.PI) return true;
    if (dtheta > 0) {
      let offset = (a - theta1) % (2 * Math.PI);
      if (offset < 0) offset += 2 * Math.PI;
      return offset <= dtheta;
    } else {
      let offset = (theta1 - a) % (2 * Math.PI);
      if (offset < 0) offset += 2 * Math.PI;
      return offset <= -dtheta;
    }
  };

  const cmdRe = /([MmLlHhVvAaZz])([^MmLlHhVvAaZz]*)/g;
  let mt: RegExpExecArray | null;

  while ((mt = cmdRe.exec(d)) !== null) {
    const cmd = mt[1];
    const nums = (mt[2] || "")
      .trim()
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number);

    switch (cmd) {
      case "M": {
        curX = nums[0]; curY = nums[1];
        extend(curX, curY);
        for (let i = 2; i + 1 < nums.length; i += 2) {
          curX = nums[i]; curY = nums[i + 1];
          extend(curX, curY);
        }
        break;
      }
      case "L": {
        for (let i = 0; i + 1 < nums.length; i += 2) {
          curX = nums[i]; curY = nums[i + 1];
          extend(curX, curY);
        }
        break;
      }
      case "H": {
        for (const n of nums) { curX = n; extend(curX, curY); }
        break;
      }
      case "V": {
        for (const n of nums) { curY = n; extend(curX, curY); }
        break;
      }
      case "A": {
        // A rx ry x-rotation large-arc-flag sweep-flag x y  (all shapes use phi=0)
        for (let i = 0; i + 6 < nums.length; i += 7) {
          const rx = Math.abs(nums[i]);
          const ry = Math.abs(nums[i + 1]);
          const largeArc = nums[i + 3] !== 0;
          const sweep = nums[i + 4] !== 0;
          const x2 = nums[i + 5];
          const y2 = nums[i + 6];

          extend(curX, curY);
          extend(x2, y2);

          if (rx > 0 && ry > 0) {
            const dx = (curX - x2) / 2;
            const dy = (curY - y2) / 2;
            let _rx = rx, _ry = ry;
            const lambda = Math.sqrt(dx * dx / (_rx * _rx) + dy * dy / (_ry * _ry));
            if (lambda > 1) { _rx *= lambda; _ry *= lambda; }
            const rx2 = _rx * _rx, ry2 = _ry * _ry;
            const dq = rx2 * dy * dy + ry2 * dx * dx;
            const pq = Math.max(0, (rx2 * ry2 - dq) / dq);
            const sign = largeArc !== sweep ? 1 : -1;
            const sq = sign * Math.sqrt(pq);
            const arcCx = sq * (_rx * dy) / _ry + (curX + x2) / 2;
            const arcCy = sq * (-_ry * dx) / _rx + (curY + y2) / 2;

            const theta1 = Math.atan2((curY - arcCy) / _ry, (curX - arcCx) / _rx);
            let dtheta = Math.atan2((y2 - arcCy) / _ry, (x2 - arcCx) / _rx) - theta1;
            if (!sweep && dtheta > 0) dtheta -= 2 * Math.PI;
            if (sweep && dtheta < 0) dtheta += 2 * Math.PI;

            // x-extremes at 0/π, y-extremes at π/2 and 3π/2 (phi=0)
            for (const angle of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
              if (inArcRange(angle, theta1, dtheta)) {
                extend(arcCx + _rx * Math.cos(angle), arcCy + _ry * Math.sin(angle));
              }
            }
          }
          curX = x2; curY = y2;
        }
        break;
      }
    }
  }

  if (!isFinite(minX)) return { x: 0, y: 0, width: 0, height: 0 };
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

// ---------------------------------------------------------------------------
// fill_gauge
// ---------------------------------------------------------------------------

export function renderFillGaugeSvg(
  node: DisplayElement,
  ctx: DisplayElementRenderContext,
): React.ReactElement {
  const cfg = node.config as FillGaugeConfig;
  const pv = ctx.pointValue;
  const pvKey = ctx.pvKey;
  const pointTag = ctx.pointTag;
  const deTransform = ctx.transform;
  const parentOffset = ctx.parentOffset;
  const vesselInteriorPath = ctx.vesselInteriorPath;

  const value = typeof pv?.value === "number" ? pv.value : null;
  const alarmPriority = pv?.alarmPriority as number | null | undefined;
  const range = cfg.rangeHi - cfg.rangeLo || 1;
  const pct =
    value !== null
      ? Math.max(0, Math.min(1, (value - cfg.rangeLo) / range))
      : 0;
  const bw = cfg.barWidth ?? 22;
  const bh = cfg.barHeight ?? 90;
  const fillColor = alarmPriority
    ? `${ALARM_COLORS[alarmPriority]}4D`
    : "var(--io-fill-normal)";
  const fillOpacity = alarmPriority ? 1 : 0.6;
  const fmtPct = `${(pct * 100).toFixed(0)}%`;
  const clipId = `fg-clip-${node.id.replace(/[^a-z0-9]/gi, "")}`;

  if (cfg.mode === "vessel_overlay") {
    // The fill gauge DE is positioned at parentOffset (e.g. center of shape) in the
    // parent shape's local/viewBox coordinate space.  vesselInteriorPath is expressed
    // in that same viewBox space (origin 0,0).  To align the clip path and fill rect
    // with the vessel interior we shift everything by -parentOffset so coordinates
    // land correctly in the fill gauge's own local space.
    const offX = parentOffset?.x ?? 0;
    const offY = parentOffset?.y ?? 0;
    const clipPathData = vesselInteriorPath ?? `M0,0 H${bw} V${bh} H0 Z`;

    // Bounding box of the vessel interior path in viewBox space
    const bounds = getPathBBox(clipPathData);
    // Convert to fill gauge local space
    const localX = bounds.x - offX;
    const localY = bounds.y - offY;
    const localW = bounds.width;
    const localH = bounds.height || bh; // fall back to barHeight if parse failed

    // Fill grows from bottom (larger local y) upward
    const fillH = pct * localH;
    const localBottom = localY + localH;
    const fillY = localBottom - fillH;

    return (
      <g
        key={node.id}
        className="io-display-element"
        data-node-id={node.id}
        data-lod="2"
        opacity={node.opacity}
        transform={deTransform}
        data-point-tag={pointTag}
        data-display-type="fill_gauge"
        data-point-id={pvKey}
      >
        <defs>
          <clipPath id={clipId}>
            {/* Shift path from viewBox space into fill gauge's local space */}
            <path d={clipPathData} transform={`translate(${-offX},${-offY})`} />
          </clipPath>
        </defs>
        <rect
          data-role="fill"
          data-vessel-h={localH}
          data-vessel-base-y={localBottom}
          x={localX}
          y={fillY}
          width={localW}
          height={Math.max(0, fillH) + 1}
          fill={fillColor}
          opacity={fillOpacity}
          clipPath={`url(#${clipId})`}
        />
        {cfg.showLevelLine && (
          <line
            data-role="level-line"
            data-vessel-h={localH}
            data-vessel-base-y={localBottom}
            x1={localX}
            y1={fillY}
            x2={localX + localW}
            y2={fillY}
            stroke={DE_COLORS.borderStrong}
            strokeWidth={1}
            strokeDasharray="5 3"
            clipPath={`url(#${clipId})`}
          />
        )}
        {cfg.showValue && (
          <text
            data-role="value"
            data-vessel-h={localH}
            data-vessel-base-y={localBottom}
            data-vessel-mid-y={localY + localH / 2}
            data-value-position={cfg.valuePosition ?? "in-fill"}
            x={localX + localW / 2}
            y={cfg.valuePosition === "center"
              ? localY + localH / 2
              : fillH > 4 ? fillY + fillH / 2 : localY + localH / 2}
            textAnchor="middle"
            dominantBaseline="central"
            fontFamily="JetBrains Mono"
            fontSize={10}
            fill={DE_COLORS.textSecondary}
          >
            {fmtPct}
          </text>
        )}
      </g>
    );
  }

  // Standalone bar mode
  const fillH = pct * (bh - 2);
  const fillY = bh - 1 - fillH;
  return (
    <g
      key={node.id}
      className="io-display-element"
      data-node-id={node.id}
      data-lod="2"
      opacity={node.opacity}
      transform={deTransform}
      data-point-tag={pointTag}
      data-display-type="fill_gauge"
      data-point-id={pvKey}
    >
      <rect
        x={0}
        y={0}
        width={bw}
        height={bh}
        rx={2}
        fill="none"
        stroke={DE_COLORS.borderStrong}
        strokeWidth={0.5}
      />
      <rect
        data-role="fill"
        x={1}
        y={fillY}
        width={bw - 2}
        height={fillH}
        rx={1}
        fill={fillColor}
        opacity={fillOpacity}
      />
      {cfg.showLevelLine && (
        <line
          data-role="level-line"
          x1={1}
          y1={fillY}
          x2={bw - 1}
          y2={fillY}
          stroke={DE_COLORS.borderStrong}
          strokeWidth={1}
          strokeDasharray="5 3"
        />
      )}
      {cfg.showValue && (
        <text
          data-role="value"
          data-value-position={cfg.valuePosition ?? "in-fill"}
          x={bw / 2}
          y={cfg.valuePosition === "center"
            ? bh / 2
            : fillH > 4 ? fillY + fillH / 2 : bh / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontFamily="JetBrains Mono"
          fontSize={10}
          fill={DE_COLORS.textSecondary}
        >
          {fmtPct}
        </text>
      )}
      {cfg.showSignalLine &&
        parentOffset &&
        (() => {
          const ex = -parentOffset.x;
          const ey = -parentOffset.y;
          return (
            <line
              x1={0}
              y1={bh / 2}
              x2={ex}
              y2={ey}
              stroke="#52525B"
              strokeWidth={0.75}
              strokeDasharray="3 2"
            />
          );
        })()}
    </g>
  );
}

// ---------------------------------------------------------------------------
// point_name_label
// ---------------------------------------------------------------------------

export function renderPointNameLabelSvg(
  node: DisplayElement,
  ctx: DisplayElementRenderContext,
): React.ReactElement {
  const cfg = node.config as PointNameLabelConfig;
  const pointTag = ctx.pointTag;
  const pvKey = ctx.pvKey;
  const deTransform = ctx.transform;

  const text = cfg.staticText ?? pointTag ?? pvKey ?? "";
  const AREA_COLOR = "#52525B";
  const UNIT_COLOR = "#71717A";
  const TAG_COLOR = "#A1A1AA";
  const SEP_COLOR = "#3F3F46";

  let labelContent: React.ReactNode;
  if (cfg.style === "hierarchy" && text.includes(".")) {
    const parts = text.split(".");
    const last = parts.length - 1;
    const secondLast = parts.length - 2;
    const spans: React.ReactNode[] = [];
    parts.forEach((part: string, i: number) => {
      if (i > 0)
        spans.push(
          <tspan key={`sep-${i}`} fill={SEP_COLOR}>
            .
          </tspan>,
        );
      const color =
        i === last
          ? TAG_COLOR
          : i === secondLast
            ? UNIT_COLOR
            : AREA_COLOR;
      spans.push(
        <tspan key={`part-${i}`} fill={color}>
          {part}
        </tspan>,
      );
    });
    labelContent = spans;
  } else {
    labelContent = text;
  }

  return (
    <g
      key={node.id}
      className="io-display-element"
      data-node-id={node.id}
      data-lod="2"
      opacity={node.opacity}
      transform={deTransform}
      data-point-tag={pointTag}
      data-display-type="point_name_label"
    >
      <text
        x={0}
        y={0}
        fontFamily="Inter"
        fontSize={9}
        fill={cfg.style === "uniform" ? UNIT_COLOR : undefined}
        dominantBaseline="hanging"
        style={{ pointerEvents: "none" }}
      >
        {labelContent}
      </text>
    </g>
  );
}
