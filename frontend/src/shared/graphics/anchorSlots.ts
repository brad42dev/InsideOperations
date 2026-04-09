/**
 * Anchor slot positioning utilities for display elements and composable parts.
 *
 * Slot coordinates are normalized [nx, ny] against the base shape bounding box.
 * nx=0.0, ny=0.0 = top-left; nx=0.5, ny=0.0 = top-center; nx=1.0, ny=0.5 = mid-right.
 */

/** Default position for value-type display elements (below center of shape). */
export const DEFAULT_VALUE_ANCHOR_POSITION = { nx: 0.5, ny: 1.15 };

/** Default position for alarm indicator (upper-right of shape). */
export const DEFAULT_ALARM_ANCHOR_POSITION = { nx: 1.1, ny: -0.1 };

/**
 * Canonical normalized positions for named anchor slots.
 * Maps slot name → (nx, ny) normalized against the shape bbox.
 */
export const NAMED_SLOT_POSITIONS: Record<string, { nx: number; ny: number }> =
  {
    top: { nx: 0.5, ny: 0.0 },
    bottom: { nx: 0.5, ny: 1.0 },
    left: { nx: 0.0, ny: 0.5 },
    right: { nx: 1.0, ny: 0.5 },
    "top-right": { nx: 1.1, ny: -0.1 },
    "top-left": { nx: -0.1, ny: -0.1 },
    "bottom-right": { nx: 1.1, ny: 1.1 },
    "bottom-left": { nx: -0.1, ny: 1.1 },
    "right-top": { nx: 1.2, ny: 0.25 },
    "right-bottom": { nx: 1.2, ny: 0.75 },
    "left-top": { nx: -0.2, ny: 0.25 },
    "left-bottom": { nx: -0.2, ny: 0.75 },
    "vessel-interior": { nx: 0.5, ny: 0.5 },
  };

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
