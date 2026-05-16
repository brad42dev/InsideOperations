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
  TextReadoutArrayConfig,
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
export function formatValue(raw: string | number | null, fmt: string): string {
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
 * Pad a numeric value string so decimal points align across a TRA array.
 * Non-numeric strings (COMM, ????, discrete labels) are returned unchanged.
 * Uses non-breaking spaces so monospace SVG text doesn't collapse them.
 */
export function decimalPadValue(
  raw: string,
  maxIntLen: number,
  maxFracLen: number,
): string {
  if (!/^-?[\d.]/.test(raw)) return raw;
  const dotIdx = raw.indexOf(".");
  const intPart = dotIdx >= 0 ? raw.slice(0, dotIdx) : raw;
  const fracPart = dotIdx >= 0 ? raw.slice(dotIdx + 1) : "";
  const paddedInt = intPart.padStart(maxIntLen, " ");
  if (maxFracLen === 0) return paddedInt;
  if (dotIdx < 0) {
    // Integer value mixed with decimal values — pad frac slot with spaces
    return paddedInt + " ".repeat(maxFracLen + 1);
  }
  return `${paddedInt}.${fracPart.padEnd(maxFracLen, " ")}`;
}

/**
 * Derive stable decimal alignment info from the configured value format string.
 * Uses conservative integer-digit counts so the layout doesn't break when live
 * values arrive with more digits than the initial "0" placeholder.
 * charW: estimated pixel width per character for JetBrains Mono at the given size.
 */
export function estimateFormatDecimalInfo(
  fmt: string,
  valueFontSize: number,
): { maxIntLen: number; maxFracLen: number; charW: number } {
  // 3 integer digits covers typical process values (0–999); the box widens
  // automatically if the user sets a larger minWidth on the element.
  const maxIntLen = 3;
  const charW = Math.ceil(valueFontSize * 0.62);

  if (/^%\.?0?d$|^%d$|^%i$/.test(fmt)) {
    return { maxIntLen, maxFracLen: 0, charW };
  }
  const fMatch = fmt.match(/^%\.(\d+)f/);
  if (fMatch) {
    return { maxIntLen, maxFracLen: parseInt(fMatch[1]), charW };
  }
  const gMatch = fmt.match(/^%\.(\d+)g/);
  if (gMatch) {
    return {
      maxIntLen,
      maxFracLen: Math.max(0, parseInt(gMatch[1]) - 1),
      charW,
    };
  }
  // %auto: produces 0-3 decimal places
  return { maxIntLen, maxFracLen: 3, charW };
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
  /** Point category from metadata — used by digital_status to detect analog misuse */
  pointCategory?: "analog" | "boolean" | "discrete_enum";
  /**
   * Parent SymbolInstance scale.x — used by digital_status and point_name_label
   * to correct horizontal centering at non-unity scale without a data migration.
   * Stored positions are (slotCenter - canonicalW/2); renderer adds canonicalW/2 * parentScaleX
   * so the visual centre lands at slotCenter * parentScaleX regardless of scale.
   * Omit (or pass 1) for interior sidecars and standalone display elements.
   */
  parentScaleX?: number;
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
  // Multi-binding arrays for text_readout_array (index 0 mirrors the singular fields above)
  pvKeys?: string[];
  pointTags?: string[];
  pointValues?: (PointValueData | undefined)[];
  discreteLabels?: (string | null)[];
  metaUnits?: string[];
  displayNames?: string[];
  bindingUnits?: string[];
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
    case "text_readout_array":
      return renderTextReadoutArraySvg(node, ctx);
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
// text_readout \u2014 shared content builder + renderer
// ---------------------------------------------------------------------------

/**
 * Builds the visual row elements for a text_readout or text_readout_array item.
 * Returns the element array, computed width, value-box y-offset, EU state, and
 * alarm flash class so the caller can assemble the outer <g> with correct attrs.
 */
function renderTextReadoutContent(
  pointTag: string | undefined,
  displayName: string | undefined,
  bindingUnit: string | undefined,
  pv: PointValueData | undefined,
  discreteLabel: string | null | undefined,
  metaUnit: string | undefined,
  cfg: TextReadoutConfig | TextReadoutArrayConfig,
  opts?: {
    /** X offset where the value box starts (>0 when an inline label precedes it). */
    labelXOffset?: number;
    /** Override computed box width (uniform across TRA items). */
    fixedValueW?: number;
    /** Decimal alignment info derived from format string — positions the decimal at a stable x. */
    decimalPad?: {
      maxIntLen: number;
      maxFracLen: number;
      charW: number;
    } | null;
  },
): {
  els: React.ReactNode[];
  w: number;
  yOff: number;
  totalH: number;
  euEnabled: boolean;
  unitText: string;
  flashClass: string;
  isStale: boolean;
} {
  const alarmPriority = (pv?.alarmPriority ?? null) as 1 | 2 | 3 | 4 | 5 | null;
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
      : discreteLabel !== null && discreteLabel !== undefined
        ? discreteLabel
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
  const valueColor = isCommFail
    ? DE_COLORS.textMuted
    : isBad
      ? ALARM_COLORS[1]
      : alarmColor
        ? DE_COLORS.textPrimary
        : DE_COLORS.textSecondary;
  const flashClass = unacked && alarmColor ? "io-alarm-flash" : "";

  const ROW_H = 16;
  const GAP = 2;
  const isSingleLine =
    "singleLine" in cfg && (cfg as TextReadoutArrayConfig).singleLine;
  const pnEnabled = !isSingleLine && (cfg.pointNameRow?.enabled ?? false);
  const pnInlineEnabled = isSingleLine && (cfg.pointNameRow?.enabled ?? false);
  const dnEnabled = !isSingleLine && (cfg.displayNameRow?.enabled ?? false);
  const dnInlineEnabled =
    isSingleLine && (cfg.displayNameRow?.enabled ?? false);
  const unitText = (pv?.units ?? metaUnit ?? bindingUnit) || "";
  const euEnabled = cfg.showUnits && !!unitText && !isCommFail && !isBad;
  const labelRows = (pnEnabled ? 1 : 0) + (dnEnabled ? 1 : 0);
  const valueBoxH = ROW_H;
  const totalH = labelRows * (ROW_H + GAP) + valueBoxH;
  const euSuffix = euEnabled ? ` ${unitText}` : "";
  const computedW = Math.max(
    cfg.minWidth ?? 40,
    rawValueStr.length * 7 + euSuffix.length * 5 + 8,
  );
  const w = opts?.fixedValueW ?? computedW;
  const boxX = opts?.labelXOffset ?? 0;

  const els: React.ReactNode[] = [];
  let yOff = 0;

  if (pnEnabled) {
    const r = cfg.pointNameRow!;
    if (r.showBackground) {
      els.push(
        <rect
          key="pn-bg"
          data-role="pn-bg"
          x={boxX}
          y={yOff}
          width={w}
          height={ROW_H}
          rx={1}
          fill="rgba(0,0,0,0.5)"
        />,
      );
    }
    els.push(
      <text
        key="pn"
        data-role="pn"
        x={boxX + w / 2}
        y={yOff + ROW_H - 4}
        textAnchor="middle"
        fontFamily="JetBrains Mono"
        fontSize={r.fontSize ?? 10}
        fontWeight={r.fontWeight ?? "normal"}
        fill={r.color || DE_COLORS.textPrimary}
      >
        {pointTag ?? "\u2014"}
      </text>,
    );
    yOff += ROW_H + GAP;
  }

  if (dnEnabled) {
    const r = cfg.displayNameRow!;
    if (r.showBackground) {
      els.push(
        <rect
          key="dn-bg"
          data-role="dn-bg"
          x={boxX}
          y={yOff}
          width={w}
          height={ROW_H}
          rx={1}
          fill="rgba(0,0,0,0.5)"
        />,
      );
    }
    els.push(
      <text
        key="dn"
        data-role="dn"
        x={boxX + w / 2}
        y={yOff + ROW_H - 4}
        textAnchor="middle"
        fontFamily="Inter"
        fontSize={r.fontSize ?? 12}
        fontWeight={r.fontWeight ?? "normal"}
        fill={r.color || DE_COLORS.textMuted}
      >
        {displayName ?? "\u2014"}
      </text>,
    );
    yOff += ROW_H + GAP;
  }

  if (pnInlineEnabled || dnInlineEnabled) {
    const parts: string[] = [];
    if (pnInlineEnabled && pointTag) parts.push(pointTag);
    if (dnInlineEnabled && displayName) parts.push(displayName);
    if (parts.length > 0) {
      const r =
        cfg.pointNameRow ?? ({} as NonNullable<typeof cfg.pointNameRow>);
      els.push(
        <text
          key="label-inline"
          data-role="pn"
          x={boxX - 6}
          y={yOff + ROW_H - 4}
          textAnchor="end"
          fontFamily="JetBrains Mono"
          fontSize={r.fontSize ?? 10}
          fontWeight={r.fontWeight ?? "normal"}
          fill={r.color || DE_COLORS.textMuted}
        >
          {parts.join(" ")}
        </text>,
      );
    }
  }

  if (cfg.showBox !== false) {
    els.push(
      <rect
        key="box"
        data-role="box"
        x={boxX}
        y={yOff}
        width={w}
        height={valueBoxH}
        rx={2}
        fill={boxFill}
        stroke={boxStroke}
        strokeWidth={strokeWidth}
        strokeDasharray={effectiveDash}
      />,
    );
  }

  const vr = cfg.valueRow;
  const er = cfg.euRow;
  const isNumericValue = /^-?[\d.]/.test(rawValueStr);

  if (opts?.decimalPad) {
    // Two-element decimal-aligned rendering: integer part right-anchored at the
    // decimal position, fractional+EU part left-anchored at the same x.
    // Always use this structure when decimalPad is set (even for "---" / "COMM" /
    // "????" placeholders) so the DOM shape is consistent with the mutation path,
    // which expects v-int + v-frac and has no fallback to re-render the elements.
    const { maxIntLen, maxFracLen, charW } = opts.decimalPad;
    const decimalX = boxX + 6 + maxIntLen * charW;
    const dotIdx = isNumericValue ? rawValueStr.indexOf(".") : -1;
    const intPart = dotIdx >= 0 ? rawValueStr.slice(0, dotIdx) : rawValueStr;
    const fracPart = dotIdx >= 0 ? rawValueStr.slice(dotIdx + 1) : "";
    const hasFrac = dotIdx >= 0 && maxFracLen > 0;

    els.push(
      <text
        key="v-int"
        data-role="v-int"
        x={decimalX}
        y={yOff + ROW_H - 4}
        textAnchor="end"
        fontFamily="JetBrains Mono"
        fontSize={vr?.fontSize ?? 11}
        fontWeight={vr?.fontWeight ?? "normal"}
        fill={valueColor}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {intPart}
      </text>,
    );
    els.push(
      <text
        key="v-frac"
        data-role="v-frac"
        x={decimalX}
        y={yOff + ROW_H - 4}
        textAnchor="start"
        fontFamily="JetBrains Mono"
        fontSize={vr?.fontSize ?? 11}
        fontWeight={vr?.fontWeight ?? "normal"}
        fill={valueColor}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        <tspan data-role="v-frac-content">
          {hasFrac ? `.${fracPart}` : ""}
        </tspan>
        <tspan
          data-role="eu"
          fontFamily="Inter"
          fontSize={er?.fontSize ?? 9}
          fill={er?.color || DE_COLORS.textMuted}
          style={{ display: euEnabled ? "" : "none" }}
        >
          {" "}
          {unitText}
        </tspan>
      </text>,
    );
  } else {
    // Standard centered rendering (non-decimal-aligned, or non-numeric value).
    els.push(
      <text
        key="value"
        data-role="value"
        x={boxX + Math.round(w / 2)}
        y={yOff + ROW_H - 4}
        textAnchor="middle"
        fontFamily="JetBrains Mono"
        fontSize={vr?.fontSize ?? 11}
        fontWeight={vr?.fontWeight ?? "normal"}
        fill={valueColor}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        <tspan data-role="v">{rawValueStr}</tspan>
        <tspan
          data-role="eu"
          fontFamily="Inter"
          fontSize={er?.fontSize ?? 9}
          fill={er?.color || DE_COLORS.textMuted}
          style={{ display: euEnabled ? "" : "none" }}
        >
          {" "}
          {unitText}
        </tspan>
      </text>,
    );
  }

  if (isManual) {
    els.push(
      <text
        key="manual-badge"
        data-role="manual-badge"
        x={boxX + w - 2}
        y={yOff + 2}
        textAnchor="end"
        dominantBaseline="hanging"
        fontFamily="Inter"
        fontSize={7}
        fontWeight={700}
        fill={DE_COLORS.manualBadge}
      >
        M
      </text>,
    );
  }

  return { els, w, yOff, totalH, euEnabled, unitText, flashClass, isStale };
}

export function renderTextReadoutSvg(
  node: DisplayElement,
  ctx: DisplayElementRenderContext,
): React.ReactElement {
  const cfg = node.config as TextReadoutConfig;
  const deTransform = ctx.transform;
  const pvKey = ctx.pvKey;
  const pointTag = ctx.pointTag;

  const { els, w, yOff, totalH, euEnabled, unitText, flashClass, isStale } =
    renderTextReadoutContent(
      node.binding.pointTag,
      node.binding.displayName,
      node.binding.unit,
      ctx.pointValue,
      ctx.discreteLabel,
      ctx.metaUnits?.[0],
      cfg,
    );

  const opacity = isStale ? 0.6 : node.opacity;
  const hOff = Math.round(-w / 2);
  const parentOffset = ctx.parentOffset;

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
// text_readout_array
// ---------------------------------------------------------------------------

function renderTextReadoutArraySvg(
  node: DisplayElement,
  ctx: DisplayElementRenderContext,
): React.ReactElement {
  const cfg = node.config as TextReadoutArrayConfig;
  const deTransform = ctx.transform;
  const n = Math.max(1, ctx.pvKeys?.length ?? 1);
  const gap = cfg.itemSpacing ?? 2;
  const layout = cfg.arrayLayout ?? "vertical";

  const ROW_H = 16;
  const ROW_GAP = 2;
  const singleLine = cfg.singleLine ?? false;
  const pnRows = !singleLine && (cfg.pointNameRow?.enabled ?? false) ? 1 : 0;
  const dnRows = !singleLine && (cfg.displayNameRow?.enabled ?? false) ? 1 : 0;
  const pnInline = singleLine && (cfg.pointNameRow?.enabled ?? false);
  const dnInline = singleLine && (cfg.displayNameRow?.enabled ?? false);
  const hasInlineLabel = pnInline || dnInline;
  const itemRows = 1 + pnRows + dnRows;
  const itemH = itemRows * ROW_H + (itemRows - 1) * ROW_GAP;

  // --- Pass 1: compute uniform label width and EU width ---
  // Decimal info is derived from the format string (not current values) so the
  // layout stays stable when live values arrive with more digits than the startup "0".
  let maxLabelTextLen = 0;
  let maxEuTextLen = 0;

  for (let i = 0; i < n; i++) {
    if (hasInlineLabel) {
      const tag = ctx.pointTags?.[i] ?? "";
      const dn = ctx.displayNames?.[i] ?? "";
      let labelText = "";
      if (pnInline && tag) labelText = tag;
      if (dnInline && dn) labelText = labelText ? `${labelText} ${dn}` : dn;
      maxLabelTextLen = Math.max(maxLabelTextLen, labelText.length);
    }
    if (cfg.showUnits) {
      const unitText =
        (ctx.pointValues?.[i]?.units ??
          ctx.metaUnits?.[i] ??
          ctx.bindingUnits?.[i]) ||
        "";
      if (unitText) maxEuTextLen = Math.max(maxEuTextLen, unitText.length + 1);
    }
  }

  // Derive stable decimal layout from the configured value format.
  const valueFontSize = cfg.valueRow?.fontSize ?? 11;
  const { maxIntLen, maxFracLen, charW } = estimateFormatDecimalInfo(
    cfg.valueFormat,
    valueFontSize,
  );

  // 6px label-gap + maxIntLen*charW puts the decimal anchor; label chars use 6.5px/char estimate.
  const maxLabelW = hasInlineLabel ? Math.ceil(maxLabelTextLen * 6.5) + 6 : 0;
  const decimalCharCount = maxIntLen + (maxFracLen > 0 ? 1 + maxFracLen : 0);
  // 6px left-pad + value + EU + 6px right-pad (matches decimalX = boxX + 6 + maxIntLen*charW)
  const fixedValueW = Math.max(
    cfg.minWidth ?? 40,
    6 + decimalCharCount * charW + maxEuTextLen * 5 + 6,
  );
  const effectiveItemW = maxLabelW + fixedValueW;
  const decimalPad =
    maxFracLen > 0 || maxIntLen > 0 ? { maxIntLen, maxFracLen, charW } : null;

  const totalW =
    layout === "vertical" ? effectiveItemW : n * effectiveItemW + (n - 1) * gap;
  const hOff = Math.round(-totalW / 2);

  // --- Pass 2: render items with computed layout ---
  const items = Array.from({ length: n }, (_, i) => {
    const offsetX = layout === "horizontal" ? i * (effectiveItemW + gap) : 0;
    const offsetY = layout === "vertical" ? i * (itemH + gap) : 0;
    const pvKey = ctx.pvKeys?.[i];
    const pointTag = ctx.pointTags?.[i];
    const pv = ctx.pointValues?.[i];
    const discreteLabel = ctx.discreteLabels?.[i];
    const metaUnit = ctx.metaUnits?.[i];
    const displayName = ctx.displayNames?.[i];
    const bindingUnit = ctx.bindingUnits?.[i];

    const { els, yOff, euEnabled, unitText, flashClass, isStale } =
      renderTextReadoutContent(
        pointTag,
        displayName,
        bindingUnit,
        pv,
        discreteLabel,
        metaUnit,
        cfg,
        {
          labelXOffset: maxLabelW,
          fixedValueW,
          decimalPad,
        },
      );

    const itemLayoutTransform = `translate(${offsetX},${offsetY})`;

    return (
      <g
        key={i}
        className={flashClass || undefined}
        data-array-index={i}
        data-point-id={pvKey}
        data-point-tag={pointTag}
        data-node-id={node.id}
        data-display-type="text_readout_array_item"
        data-value-box-y={String(yOff)}
        data-eu-unit={euEnabled ? unitText : ""}
        data-min-width={String(cfg.minWidth ?? 40)}
        data-fixed-layout="true"
        data-label-offset={hasInlineLabel ? String(maxLabelW) : undefined}
        data-decimal-int-len={decimalPad ? String(maxIntLen) : undefined}
        data-decimal-frac-len={decimalPad ? String(maxFracLen) : undefined}
        data-fixed-value-w={String(fixedValueW)}
        data-base-transform={itemLayoutTransform}
        transform={itemLayoutTransform}
        opacity={isStale ? 0.6 : 1}
      >
        {els}
      </g>
    );
  });

  return (
    <g
      key={node.id}
      className="io-display-element"
      data-node-id={node.id}
      data-display-type="text_readout_array"
      data-array-layout={layout}
      data-item-count={n}
      data-item-gap={gap}
      data-effective-item-w={String(effectiveItemW)}
      data-base-transform={deTransform}
      transform={`${deTransform} translate(${hOff},0)`}
      opacity={node.opacity}
    >
      {items}
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
      style={{
        display: active || designerMode || previewMode ? undefined : "none",
      }}
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

  const isAnalogMismatch = ctx.pvKey != null && ctx.pointCategory === "analog";

  const rawVal =
    pv?.value !== undefined && pv.value !== null ? String(pv.value) : null;
  const label = isAnalogMismatch
    ? "ANALOG"
    : rawVal !== null
      ? (cfg.stateLabels[rawVal] ?? ctx.discreteLabel ?? rawVal)
      : "---";
  const isNormal =
    !isAnalogMismatch && (rawVal === null || cfg.normalStates.includes(rawVal));
  const fill = isAnalogMismatch
    ? "#7F1D1D"
    : isNormal
      ? DE_COLORS.displayZoneInactive
      : (ALARM_COLORS[cfg.abnormalPriority] ?? ALARM_COLORS[1]);
  const textColor = isAnalogMismatch
    ? "#FCA5A5"
    : isNormal
      ? DE_COLORS.textSecondary
      : DE_COLORS.textPrimary;
  const w = Math.max(40, label.length * 7.5 + 12);
  // pos.x stores slotCenter - 20 (canonical w/2). After counter-scale, group origin
  // is (slotCenter - 20) * scale canvas px from shape origin. Adding 20 * scale centres
  // the element at slotCenter * scale at any parent scale.
  const cx = 20 * (ctx.parentScaleX ?? 1);

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
        x={cx - w / 2}
        y={0}
        width={w}
        height={22}
        rx={2}
        fill={fill}
      />
      <text
        data-role="value"
        x={cx}
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
              x1={cx}
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
      valueZone === "hh" && alarmPriority && cfg.thresholds?.hhAlarmPriority
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
      valueZone === "ll" && alarmPriority && cfg.thresholds?.llAlarmPriority
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
      {cfg.showPointer && (
        <>
          <polygon
            data-role="pointer"
            points={`${bw},${pointerY - 3} ${bw + 6},${pointerY} ${bw},${pointerY + 3}`}
            fill={
              alarmPriority
                ? (ALARM_COLORS[alarmPriority] ?? DE_COLORS.textSecondary)
                : DE_COLORS.textSecondary
            }
            style={{ display: value !== null ? "" : "none" }}
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
            style={{ display: value !== null ? "" : "none" }}
          />
        </>
      )}
      {cfg.showSetpoint &&
        (() => {
          const spVal = ctx.setpointValue ?? null;
          if (spVal === null) return null;
          const spPct = Math.max(0, Math.min(1, (spVal - cfg.rangeLo) / range));
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
      {cfg.showNumericReadout && (
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
          style={{ display: value !== null ? "" : "none" }}
        >
          {value !== null ? value.toFixed(1) : ""}
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
    const nums = rawHistory.filter((v) => typeof v === "number" && isFinite(v));
    const sampled =
      nums.length <= targetPoints
        ? nums
        : (() => {
            const out: number[] = [];
            for (let i = 0; i < targetPoints; i++) {
              out.push(
                nums[Math.round((i * (nums.length - 1)) / (targetPoints - 1))],
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
export function getPathBBox(d: string): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
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
        curX = nums[0];
        curY = nums[1];
        extend(curX, curY);
        for (let i = 2; i + 1 < nums.length; i += 2) {
          curX = nums[i];
          curY = nums[i + 1];
          extend(curX, curY);
        }
        break;
      }
      case "L": {
        for (let i = 0; i + 1 < nums.length; i += 2) {
          curX = nums[i];
          curY = nums[i + 1];
          extend(curX, curY);
        }
        break;
      }
      case "H": {
        for (const n of nums) {
          curX = n;
          extend(curX, curY);
        }
        break;
      }
      case "V": {
        for (const n of nums) {
          curY = n;
          extend(curX, curY);
        }
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
            let _rx = rx,
              _ry = ry;
            const lambda = Math.sqrt(
              (dx * dx) / (_rx * _rx) + (dy * dy) / (_ry * _ry),
            );
            if (lambda > 1) {
              _rx *= lambda;
              _ry *= lambda;
            }
            const rx2 = _rx * _rx,
              ry2 = _ry * _ry;
            const dq = rx2 * dy * dy + ry2 * dx * dx;
            const pq = Math.max(0, (rx2 * ry2 - dq) / dq);
            const sign = largeArc !== sweep ? 1 : -1;
            const sq = sign * Math.sqrt(pq);
            const arcCx = (sq * (_rx * dy)) / _ry + (curX + x2) / 2;
            const arcCy = (sq * (-_ry * dx)) / _rx + (curY + y2) / 2;

            const theta1 = Math.atan2(
              (curY - arcCy) / _ry,
              (curX - arcCx) / _rx,
            );
            let dtheta =
              Math.atan2((y2 - arcCy) / _ry, (x2 - arcCx) / _rx) - theta1;
            if (!sweep && dtheta > 0) dtheta -= 2 * Math.PI;
            if (sweep && dtheta < 0) dtheta += 2 * Math.PI;

            // x-extremes at 0/π, y-extremes at π/2 and 3π/2 (phi=0)
            for (const angle of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
              if (inArcRange(angle, theta1, dtheta)) {
                extend(
                  arcCx + _rx * Math.cos(angle),
                  arcCy + _ry * Math.sin(angle),
                );
              }
            }
          }
          curX = x2;
          curY = y2;
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
            y={
              cfg.valuePosition === "center"
                ? localY + localH / 2
                : fillH > 4
                  ? fillY + fillH / 2
                  : localY + localH / 2
            }
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
          y={
            cfg.valuePosition === "center"
              ? bh / 2
              : fillH > 4
                ? fillY + fillH / 2
                : bh / 2
          }
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
        i === last ? TAG_COLOR : i === secondLast ? UNIT_COLOR : AREA_COLOR;
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
        x={40 * (ctx.parentScaleX ?? 1)}
        y={0}
        fontFamily="Inter"
        fontSize={9}
        fill={cfg.style === "uniform" ? UNIT_COLOR : TAG_COLOR}
        fontWeight={cfg.fontWeight ?? "normal"}
        textAnchor="middle"
        dominantBaseline="hanging"
        style={{ pointerEvents: "none" }}
      >
        {labelContent}
      </text>
    </g>
  );
}
