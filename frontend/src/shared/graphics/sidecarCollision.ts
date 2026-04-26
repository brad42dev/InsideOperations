import type { DisplayElementType } from "../types/graphics";

// ─── Sidecar identity ─────────────────────────────────────────────────────────

export type SidecarKey =
  | "AlarmIndicator"
  | "DigitalStatus"
  | "TextReadout"
  | "PointNameLabel"
  | "FillGauge"
  | "Sparkline"
  | "AnalogBar";

export const DE_TO_SIDECAR_KEY: Record<DisplayElementType, SidecarKey> = {
  alarm_indicator: "AlarmIndicator",
  digital_status: "DigitalStatus",
  text_readout: "TextReadout",
  point_name_label: "PointNameLabel",
  fill_gauge: "FillGauge",
  sparkline: "Sparkline",
  analog_bar: "AnalogBar",
};

// ─── Canonical default sizes (canvas units) ───────────────────────────────────
//
// Single source of truth. Values match the actual renderers in
// renderDisplayElementSvg.tsx for the default configuration.
//
//   AlarmIndicator  — 24×18 fixed; centre-anchored.
//   DigitalStatus   — min-width=40, height=22 fixed.
//   TextReadout     — single row (ROW_H=16); use dePixelSize for multi-row.
//   PointNameLabel  — fontSize=10 → h=12; w=80 hardcoded in renderer.
//   FillGauge       — barWidth=22, barHeight=90 (default config).
//   Sparkline       — sparkWidth=110, sparkHeight=18 (renderer defaults).
//   AnalogBar       — bar body (barWidth=20) + zone-label margin (≈20) = 40
//                     total visual width; barHeight=80 default.

export const SIDECAR_CANONICAL_SIZE: Record<
  SidecarKey,
  { w: number; h: number }
> = {
  AlarmIndicator: { w: 24, h: 18 },
  DigitalStatus: { w: 40, h: 22 },
  TextReadout: { w: 40, h: 16 },
  PointNameLabel: { w: 80, h: 12 },
  FillGauge: { w: 22, h: 90 },
  Sparkline: { w: 110, h: 18 },
  AnalogBar: { w: 40, h: 80 },
};

// ─── Priority ─────────────────────────────────────────────────────────────────

export const SIDECAR_PRIORITY: Record<SidecarKey, number> = {
  AlarmIndicator: 0,
  DigitalStatus: 1,
  TextReadout: 2,
  PointNameLabel: 3,
  FillGauge: 4,
  Sparkline: 5,
  AnalogBar: 6,
};

// ─── Layout-relevant config fields ────────────────────────────────────────────
//
// Minimal subset of DisplayElementUserConfig needed for layout calculations.
// Using a local interface avoids importing from pages/ into shared/.

export interface DeLayoutHints {
  showPointName?: boolean;
  showDisplayName?: boolean;
  barHeight?: number;
  barWidth?: number;
  sparkWidth?: number;
  sparkHeight?: number;
}

// ─── Pixel size ───────────────────────────────────────────────────────────────

/**
 * Returns the rendered size of a display element given optional user config.
 * This is the single source of truth used by both the canvas placement path
 * and the preview (CategoryShapeWizard).
 */
export function dePixelSize(
  dt: DisplayElementType,
  cfg?: DeLayoutHints,
): { w: number; h: number } {
  switch (dt) {
    case "text_readout": {
      const rows =
        1 + (cfg?.showPointName ? 1 : 0) + (cfg?.showDisplayName ? 1 : 0);
      return { w: 40, h: rows * 16 + (rows - 1) * 2 };
    }
    case "fill_gauge":
      return { w: cfg?.barWidth ?? 22, h: cfg?.barHeight ?? 90 };
    case "sparkline":
      return { w: cfg?.sparkWidth ?? 110, h: cfg?.sparkHeight ?? 18 };
    case "analog_bar":
      // w=40 is the total visual footprint: bar body (20) + zone-label margin (20)
      return { w: 40, h: cfg?.barHeight ?? 80 };
    default:
      return SIDECAR_CANONICAL_SIZE[DE_TO_SIDECAR_KEY[dt]];
  }
}

// ─── Slot offset ──────────────────────────────────────────────────────────────

/**
 * Adjust the raw slot anchor coordinate so the display element renders visually
 * well-placed at the slot. Single shared implementation used by both the canvas
 * placement path (DesignerCanvas) and the preview (CategoryShapeWizard).
 *
 * Rendering anchors per type:
 *   alarm_indicator — centre-anchored; no offset needed.
 *   text_readout    — renderTextReadoutSvg applies translate(-w/2, 0), so pos.x
 *                     is the horizontal centre; only y and left-slot x adjusted.
 *   all others      — top-left anchored.
 */
export function applyDeSlotOffset(
  dt: DisplayElementType,
  slotName: string,
  pos: { x: number; y: number },
  cfg?: DeLayoutHints,
): { x: number; y: number } {
  let { x, y } = pos;
  const isTop = slotName === "top";
  const isBottom = slotName === "bottom";
  const isHoriz = isTop || isBottom;
  const isRight = slotName.startsWith("right");
  const isLeft = slotName.startsWith("left");
  const isVert = isRight || isLeft;

  switch (dt) {
    case "text_readout": {
      const { h } = dePixelSize(dt, cfg);
      if (isTop) y -= h;
      if (isVert) y -= h / 2;
      if (isLeft) x -= 40; // pos.x is h-centre; pull right edge to slot line
      break;
    }
    case "alarm_indicator":
      break; // centre-based rendering — no adjustment
    case "analog_bar": {
      const h = cfg?.barHeight ?? 80;
      // zone labels sit at x−15; push right so they clear the shape boundary
      if (isRight) x += 15;
      if (isLeft) x -= 25; // right extent (x+25) at slot edge
      y -= h / 2;
      break;
    }
    case "fill_gauge": {
      const { w, h } = dePixelSize(dt, cfg);
      if (isHoriz) x -= w / 2;
      if (isTop) y -= h;
      if (isVert) y -= h / 2;
      if (isLeft) x -= w;
      break;
    }
    case "sparkline": {
      const { w, h } = dePixelSize(dt, cfg);
      if (isHoriz) x -= w / 2;
      if (isTop) y -= h;
      if (isVert) y -= h / 2;
      if (isLeft) x -= w;
      break;
    }
    case "digital_status": {
      const { w, h } = SIDECAR_CANONICAL_SIZE.DigitalStatus;
      if (isHoriz) x -= w / 2;
      if (isTop) y -= h;
      if (isVert) y -= h / 2;
      if (isLeft) x -= w;
      break;
    }
    case "point_name_label": {
      const { w, h } = SIDECAR_CANONICAL_SIZE.PointNameLabel;
      if (isHoriz) x -= w / 2;
      if (isTop) y -= h;
      if (isVert) y -= h / 2;
      if (isLeft) x -= w;
      break;
    }
  }
  return { x, y };
}

// ─── Collision avoidance ──────────────────────────────────────────────────────

const COLLISION_GAP_PX = 4;

// Slots whose sidecars are contained inside the shape — never participate in
// collision detection with exterior sidecars.
export const EXCLUDED_COLLISION_SLOTS = new Set([
  "vessel-interior",
  "inside-vertical",
  "inside-horizontal",
]);

interface Axis {
  ux: -1 | 0 | 1;
  uy: -1 | 0 | 1;
}

// Displacement direction for each named slot. Lower-priority sidecars that
// collide with higher-priority ones are pushed along this axis.
const SLOT_AXIS: Record<string, Axis> = {
  top: { ux: 0, uy: -1 },
  bottom: { ux: 0, uy: 1 },
  left: { ux: -1, uy: 0 },
  right: { ux: 1, uy: 0 },
  "top-right": { ux: 1, uy: -1 },
  "top-left": { ux: -1, uy: -1 },
  "bottom-right": { ux: 1, uy: 1 },
  "bottom-left": { ux: -1, uy: 1 },
  "right-top": { ux: 1, uy: -1 },
  "right-bottom": { ux: 1, uy: 1 },
  "left-top": { ux: -1, uy: -1 },
  "left-bottom": { ux: -1, uy: 1 },
};

type BBox = { x: number; y: number; r: number; b: number };

function makeBBox(
  pos: { x: number; y: number },
  size: { w: number; h: number },
  dt: DisplayElementType,
): BBox {
  const { x, y } = pos;
  const { w, h } = size;
  if (dt === "alarm_indicator") {
    return { x: x - w / 2, y: y - h / 2, r: x + w / 2, b: y + h / 2 };
  }
  if (dt === "text_readout") {
    // pos.x is horizontal centre, pos.y is top edge
    return { x: x - w / 2, y, r: x + w / 2, b: y + h };
  }
  if (dt === "analog_bar") {
    // Zone labels extend 15px left of pos.x; bar body is 20px; w=40 total
    return { x: x - 15, y, r: x + (w - 15), b: y + h };
  }
  return { x, y, r: x + w, b: y + h };
}

function bboxOverlap(a: BBox, b: BBox): { ox: number; oy: number } {
  return {
    ox: Math.min(a.r, b.r) - Math.max(a.x, b.x),
    oy: Math.min(a.b, b.b) - Math.max(a.y, b.y),
  };
}

export interface SidecarInput {
  key: SidecarKey;
  deType: DisplayElementType;
  slotName: string;
  pos: { x: number; y: number };
  cfg?: DeLayoutHints;
}

/**
 * Resolve collisions among a set of sidecars already positioned via
 * applyDeSlotOffset. Interior-slot sidecars pass through unchanged.
 * Sidecars are processed in priority order; higher-priority ones are never
 * moved. Lower-priority ones are pushed along their slot's axis until clear.
 */
export function resolveSidecarCollisions(
  inputs: SidecarInput[],
): Map<SidecarKey, { x: number; y: number }> {
  const result = new Map<SidecarKey, { x: number; y: number }>();

  // Separate excluded (interior) slots — pass them through unchanged
  const active: Array<{
    key: SidecarKey;
    deType: DisplayElementType;
    slotName: string;
    pos: { x: number; y: number };
    size: { w: number; h: number };
    priority: number;
  }> = [];

  for (const inp of inputs) {
    if (EXCLUDED_COLLISION_SLOTS.has(inp.slotName)) {
      result.set(inp.key, inp.pos);
      continue;
    }
    active.push({
      key: inp.key,
      deType: inp.deType,
      slotName: inp.slotName,
      pos: { ...inp.pos },
      size: dePixelSize(inp.deType, inp.cfg),
      priority: SIDECAR_PRIORITY[inp.key],
    });
  }

  // Process in priority order (0 = highest). Index j < i are already finalised.
  active.sort((a, b) => a.priority - b.priority);

  for (let i = 0; i < active.length; i++) {
    const cur = active[i];
    const axis = SLOT_AXIS[cur.slotName];
    if (!axis) {
      result.set(cur.key, cur.pos);
      continue;
    }
    const isDiag = axis.ux !== 0 && axis.uy !== 0;

    for (let iter = 0; iter < 8; iter++) {
      let needed = 0;
      const curBox = makeBBox(cur.pos, cur.size, cur.deType);

      for (let j = 0; j < i; j++) {
        const fixed = active[j];
        const { ox, oy } = bboxOverlap(
          curBox,
          makeBBox(fixed.pos, fixed.size, fixed.deType),
        );
        if (ox <= 0 || oy <= 0) continue;

        const step = isDiag
          ? Math.min(ox, oy) * Math.SQRT2 + COLLISION_GAP_PX
          : (axis.ux !== 0 ? ox : oy) + COLLISION_GAP_PX;
        if (step > needed) needed = step;
      }

      if (needed === 0) break;

      if (isDiag) {
        const c = needed / Math.SQRT2;
        cur.pos = { x: cur.pos.x + axis.ux * c, y: cur.pos.y + axis.uy * c };
      } else {
        cur.pos = {
          x: cur.pos.x + axis.ux * needed,
          y: cur.pos.y + axis.uy * needed,
        };
      }

      if (iter === 7) {
        console.warn(`[sidecarCollision] ${cur.key}: hit displacement cap`);
      }
    }

    result.set(cur.key, cur.pos);
  }

  return result;
}

/**
 * Displace a single new sidecar against a set of fixed (already-placed)
 * sidecars. Used when adding a sidecar to an existing shape — existing
 * sidecars stay put.
 */
export function resolveSingleSidecarAgainstFixed(
  newSidecar: SidecarInput,
  fixed: Array<{
    deType: DisplayElementType;
    pos: { x: number; y: number };
    cfg?: DeLayoutHints;
  }>,
): { x: number; y: number } {
  if (EXCLUDED_COLLISION_SLOTS.has(newSidecar.slotName) || fixed.length === 0) {
    return newSidecar.pos;
  }
  const axis = SLOT_AXIS[newSidecar.slotName];
  if (!axis) return newSidecar.pos;

  const newSize = dePixelSize(newSidecar.deType, newSidecar.cfg);
  const isDiag = axis.ux !== 0 && axis.uy !== 0;
  let pos = { ...newSidecar.pos };

  const fixedBoxes = fixed.map((f) =>
    makeBBox(f.pos, dePixelSize(f.deType, f.cfg), f.deType),
  );

  for (let iter = 0; iter < 8; iter++) {
    let needed = 0;
    const curBox = makeBBox(pos, newSize, newSidecar.deType);

    for (const fixedBox of fixedBoxes) {
      const { ox, oy } = bboxOverlap(curBox, fixedBox);
      if (ox <= 0 || oy <= 0) continue;
      const step = isDiag
        ? Math.min(ox, oy) * Math.SQRT2 + COLLISION_GAP_PX
        : (axis.ux !== 0 ? ox : oy) + COLLISION_GAP_PX;
      if (step > needed) needed = step;
    }

    if (needed === 0) break;

    if (isDiag) {
      const c = needed / Math.SQRT2;
      pos = { x: pos.x + axis.ux * c, y: pos.y + axis.uy * c };
    } else {
      pos = { x: pos.x + axis.ux * needed, y: pos.y + axis.uy * needed };
    }

    if (iter === 7) {
      console.warn(
        `[sidecarCollision] ${newSidecar.key}: hit displacement cap`,
      );
    }
  }

  return pos;
}
