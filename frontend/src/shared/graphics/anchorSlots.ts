/**
 * Anchor slot positioning utilities for display elements and composable parts.
 *
 * Slot coordinates are normalized [nx, ny] against the base shape bounding box.
 * nx=0.0, ny=0.0 = top-left; nx=0.5, ny=0.0 = top-center; nx=1.0, ny=0.5 = mid-right.
 *
 * Offsets are derived from the canonical *-shape-sidecar-preview.html files.
 * Elements must clear the shape boundary — "right" is at nx=1.2 not nx=1.0.
 */

import type { DisplayElement, SymbolInstance } from "../types/graphics";
import type { ShapeEntry } from "../../store/designer/libraryStore";

/**
 * Returns true when the display element is an inside-fill sidecar:
 * - fill_gauge in vessel_overlay mode (clipped to vessel outline)
 * - analog_bar in inside mode (bar rendered within the shape)
 * These elements visually live inside the parent shape and should
 * rotate/scale with it rather than staying fixed in world space.
 */
export function isInsideFillSidecar(de: DisplayElement): boolean {
  if (de.displayType === "fill_gauge") {
    return (de.config as { mode?: string }).mode === "vessel_overlay";
  }
  if (de.displayType === "analog_bar") {
    return (de.config as { mode?: string }).mode === "inside";
  }
  return false;
}

/** Default position for value-type display elements (below center of shape). */
export const DEFAULT_VALUE_ANCHOR_POSITION = { nx: 0.5, ny: 1.15 };

/** Default position for alarm indicator (upper-right of shape). */
export const DEFAULT_ALARM_ANCHOR_POSITION = { nx: 1.1, ny: -0.1 };

/**
 * Canonical normalized positions for named anchor slots.
 *
 * Derived from the HTML preview reference files and the sidecar spec.
 * Mid-edge slots ("right", "left", "top", "bottom") include clearance so
 * elements don't overlap the shape boundary.
 */
export const NAMED_SLOT_POSITIONS: Record<string, { nx: number; ny: number }> =
  {
    // Mid-edge — 15–20% clearance from shape edge
    top: { nx: 0.5, ny: -0.15 },
    bottom: { nx: 0.5, ny: 1.15 },
    left: { nx: -0.2, ny: 0.5 },
    right: { nx: 1.2, ny: 0.5 },

    // Corner — 10% outside each axis
    "top-right": { nx: 1.1, ny: -0.1 },
    "top-left": { nx: -0.1, ny: -0.1 },
    "bottom-right": { nx: 1.1, ny: 1.1 },
    "bottom-left": { nx: -0.1, ny: 1.1 },

    // Near-corner (for sparklines — horizontal strip geometry)
    "right-top": { nx: 1.2, ny: 0.25 },
    "right-bottom": { nx: 1.2, ny: 0.75 },
    "left-top": { nx: -0.2, ny: 0.25 },
    "left-bottom": { nx: -0.2, ny: 0.75 },

    // Vessel interior — used for fill gauge / analog bar clipped to vessel outline
    "vessel-interior": { nx: 0.5, ny: 0.5 },
    "inside-vertical": { nx: 0.5, ny: 0.5 },
    "inside-horizontal": { nx: 0.5, ny: 0.5 },
  };

/**
 * Returns the set of slot IDs currently occupied by display element children
 * of the given SymbolInstance.
 */
export function getOccupiedSlots(si: SymbolInstance): Set<string> {
  const occupied = new Set<string>();
  for (const child of si.children) {
    if (child.slotId) occupied.add(child.slotId);
  }
  return occupied;
}

/**
 * Returns slot targets (canvas-absolute positions) for slots that have no
 * display element child yet. Slots without a NAMED_SLOT_POSITIONS entry are
 * skipped. Returns an empty array when shapeEntry is null or has no anchorSlots.
 */
export function getEmptySlots(
  si: SymbolInstance,
  shapeEntry: ShapeEntry | null,
): Array<{ slotId: string; x: number; y: number }> {
  const anchorSlots = shapeEntry?.sidecar.anchorSlots;
  if (!anchorSlots) return [];

  const geo = shapeEntry!.sidecar.geometry;
  const naturalW = geo?.baseSize?.[0] ?? geo?.width ?? 48;
  const naturalH = geo?.baseSize?.[1] ?? geo?.height ?? 48;
  const scaledW = naturalW * (si.transform.scale.x ?? 1);
  const scaledH = naturalH * (si.transform.scale.y ?? 1);
  const pos = si.transform.position;
  const bbox = { x: pos.x, y: pos.y, width: scaledW, height: scaledH };

  const occupied = getOccupiedSlots(si);

  // Collect all unique slot IDs across all element types
  const slotIds = new Set<string>();
  for (const slots of Object.values(anchorSlots)) {
    if (Array.isArray(slots)) {
      for (const s of slots) slotIds.add(s);
    }
  }

  const result: Array<{ slotId: string; x: number; y: number }> = [];
  for (const slotId of slotIds) {
    if (occupied.has(slotId)) continue;
    const norm = NAMED_SLOT_POSITIONS[slotId];
    if (!norm) continue;
    result.push({
      slotId,
      x: bbox.x + norm.nx * bbox.width,
      y: bbox.y + norm.ny * bbox.height,
    });
  }
  return result;
}

/**
 * Resolves a named slot identifier to absolute canvas coordinates
 * using the shape's bounding box. Falls back to "bottom" slot if
 * the slotId is unrecognised.
 */
export function resolveNamedSlot(
  slotId: string,
  bbox: { x: number; y: number; width: number; height: number },
): { x: number; y: number } {
  const norm = NAMED_SLOT_POSITIONS[slotId] ?? NAMED_SLOT_POSITIONS["bottom"]!;
  return {
    x: bbox.x + norm.nx * bbox.width,
    y: bbox.y + norm.ny * bbox.height,
  };
}

/** Minimal shape fields needed for sidecar-aware slot resolution. */
interface SidecarLike {
  valueAnchors?: Array<{ nx?: number; ny?: number; preferredElement?: string }>;
  alarmAnchor?: [number, number] | { nx: number; ny: number };
}

/**
 * Resolves a display element's position using the sidecar's shape-specific
 * anchor data when available, falling back to NAMED_SLOT_POSITIONS.
 *
 * Priority:
 *  - TextReadout  at default slot → sidecar.valueAnchors[0].{nx,ny}
 *  - AlarmIndicator at default slot → sidecar.alarmAnchor.{nx,ny}
 *  - Everything else → NAMED_SLOT_POSITIONS[slotId]
 *
 * @param slotId       Named slot (e.g. "bottom", "right-top", "vessel-interior")
 * @param elementType  Sidecar key (e.g. "TextReadout", "AlarmIndicator")
 * @param sidecar      Optional sidecar data for the shape being placed
 * @param bbox         Shape bounding box in canvas coordinates
 */
export function resolveSlotWithSidecar(
  slotId: string,
  elementType: string,
  sidecar: SidecarLike | null | undefined,
  bbox: { x: number; y: number; width: number; height: number },
): { x: number; y: number } {
  // TextReadout: use shape-specific valueAnchor when the user chose the default slot
  if (
    elementType === "TextReadout" &&
    (!slotId || slotId === "bottom" || slotId === "right")
  ) {
    const vas = sidecar?.valueAnchors;
    const va =
      vas?.find((a) => a.preferredElement === "text_readout") ?? vas?.[0];
    if (va != null && va.nx != null && va.ny != null) {
      return {
        x: bbox.x + (va.nx as number) * bbox.width,
        y: bbox.y + (va.ny as number) * bbox.height,
      };
    }
  }

  // AlarmIndicator: use shape-specific alarmAnchor when the user chose the default slot
  if (elementType === "AlarmIndicator" && (!slotId || slotId === "top-right")) {
    const aa = sidecar?.alarmAnchor;
    if (aa != null) {
      const nx = Array.isArray(aa) ? aa[0] : aa.nx;
      const ny = Array.isArray(aa) ? aa[1] : aa.ny;
      return { x: bbox.x + nx * bbox.width, y: bbox.y + ny * bbox.height };
    }
  }

  return resolveNamedSlot(slotId || "bottom", bbox);
}

/**
 * Resolves an anchor slot position from a sidecar record to absolute coordinates.
 *
 * Lookup order:
 *  1. sidecar.anchorSlots[slotId] → [nx, ny]
 *  2. sidecar.valueAnchors[0].{nx, ny} (fallback)
 *  3. DEFAULT_VALUE_ANCHOR_POSITION
 */
export function resolveAnchorPosition(
  sidecar: Record<string, unknown>,
  slotId: string,
  bbox: { x: number; y: number; width: number; height: number },
): { x: number; y: number } {
  const anchorSlots = sidecar.anchorSlots as
    | Record<string, [number, number]>
    | undefined;

  let nx: number | undefined;
  let ny: number | undefined;

  if (anchorSlots) {
    const slot = anchorSlots[slotId];
    if (Array.isArray(slot) && slot.length >= 2) {
      nx = slot[0];
      ny = slot[1];
    }
  }

  if (nx === undefined || ny === undefined) {
    const valueAnchors = sidecar.valueAnchors as
      | Array<{ nx: number; ny: number }>
      | undefined;
    if (valueAnchors && valueAnchors.length > 0) {
      nx = valueAnchors[0].nx;
      ny = valueAnchors[0].ny;
    } else {
      nx = DEFAULT_VALUE_ANCHOR_POSITION.nx;
      ny = DEFAULT_VALUE_ANCHOR_POSITION.ny;
    }
  }

  return {
    x: bbox.x + nx * bbox.width,
    y: bbox.y + ny * bbox.height,
  };
}
