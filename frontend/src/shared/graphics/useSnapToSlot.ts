/**
 * useSnapToSlot.ts
 *
 * Hook that activates when a display element is being dragged onto a
 * SymbolInstance. Returns:
 *   - ghostTargets: all slot positions for the target shape (for rendering
 *     as drop-zone indicators)
 *   - snapTarget: the nearest slot when the cursor is within SNAP_RADIUS px
 *     (null otherwise)
 *
 * Usage:
 *   const { snapTarget, ghostTargets } = useSnapToSlot(targetInstanceId, cursorPos);
 */

import { useMemo } from "react";
import { useSceneStore, useLibraryStore } from "../../store/designer";
import type { NodeId, SceneNode, SymbolInstance } from "../types/graphics";
import { NAMED_SLOT_POSITIONS } from "./anchorSlots";

/** Snap-to-slot attraction radius in canvas units (pixels at zoom=1). */
const SNAP_RADIUS = 12;

export interface SlotTarget {
  slotId: string;
  x: number;
  y: number;
}

/**
 * Returns ghost slot positions and the nearest snap target for
 * display-element drag-over on a SymbolInstance.
 *
 * When targetInstanceId or cursorPos is null, returns empty results.
 * The cursorPos must be in canvas (scene) coordinates, not screen pixels.
 */
export function useSnapToSlot(
  targetInstanceId: NodeId | null,
  cursorPos: { x: number; y: number } | null,
): {
  snapTarget: SlotTarget | null;
  ghostTargets: SlotTarget[];
} {
  const doc = useSceneStore((s) => s.doc);
  const getShape = useLibraryStore((s) => s.getShape);

  return useMemo(() => {
    const empty = { snapTarget: null, ghostTargets: [] };
    if (!targetInstanceId || !cursorPos || !doc) return empty;

    // Find the SymbolInstance anywhere in the scene tree
    const findSym = (nodes: SceneNode[]): SymbolInstance | null => {
      for (const n of nodes) {
        if (n.id === targetInstanceId && n.type === "symbol_instance") {
          return n as SymbolInstance;
        }
        if ("children" in n && Array.isArray(n.children)) {
          const found = findSym(n.children as SceneNode[]);
          if (found) return found;
        }
      }
      return null;
    };
    const sym = findSym(doc.children);
    if (!sym) return empty;

    const shapeEntry = getShape(sym.shapeRef.shapeId);
    const anchorSlots = shapeEntry?.sidecar.anchorSlots;
    if (!anchorSlots) return empty;

    const geo = shapeEntry.sidecar.geometry;
    const naturalW = geo?.baseSize?.[0] ?? geo?.width ?? 48;
    const naturalH = geo?.baseSize?.[1] ?? geo?.height ?? 48;
    const scaledW = naturalW * (sym.transform.scale.x ?? 1);
    const scaledH = naturalH * (sym.transform.scale.y ?? 1);
    const pos = sym.transform.position;
    const bbox = { x: pos.x, y: pos.y, width: scaledW, height: scaledH };

    // Collect the union of all slot IDs across element types
    const slotIds = new Set<string>();
    for (const slots of Object.values(anchorSlots)) {
      if (Array.isArray(slots)) {
        for (const s of slots) slotIds.add(s);
      }
    }

    // Resolve each slot to absolute coordinates
    const ghostTargets: SlotTarget[] = [];
    for (const slotId of slotIds) {
      const norm = NAMED_SLOT_POSITIONS[slotId];
      if (!norm) continue;
      ghostTargets.push({
        slotId,
        x: bbox.x + norm.nx * bbox.width,
        y: bbox.y + norm.ny * bbox.height,
      });
    }

    // Find nearest slot within SNAP_RADIUS
    let snapTarget: SlotTarget | null = null;
    let minDist = SNAP_RADIUS;
    for (const gt of ghostTargets) {
      const dist = Math.hypot(cursorPos.x - gt.x, cursorPos.y - gt.y);
      if (dist < minDist) {
        minDist = dist;
        snapTarget = gt;
      }
    }

    return { snapTarget, ghostTargets };
  }, [targetInstanceId, cursorPos, doc, getShape]);
}
