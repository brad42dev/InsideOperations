/**
 * @deprecated Compatibility shim. New code must use
 * `@/shared/clipboard` (useIOClipboardStore).
 *
 * Preserves the v1 designer-only API used by existing callers
 * (DesignerCanvas, commands) until Phase 6 migrates them.
 */
import { create } from "zustand";
import type { ClipboardData, SceneNode } from "../types/graphics";
import { useIOClipboardStore } from "../clipboard";
import { buildIOClipboardPayload } from "../clipboard";
import {
  computeTextRepresentation,
  extractPointsFromNodes,
} from "../clipboard";

interface ClipboardState {
  data: ClipboardData | null;
  copy: (nodes: SceneNode[], sourceGraphicId: string) => void;
  clear: () => void;
}

function computeBounds(nodes: SceneNode[]) {
  if (nodes.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const n of nodes) {
    const { x, y } = n.transform.position;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export const useClipboardStore = create<ClipboardState>((set) => ({
  data: null,

  copy(nodes, sourceGraphicId) {
    const bounds = computeBounds(nodes);
    const legacy: ClipboardData = {
      source: "io-designer",
      version: "1.0",
      sourceGraphicId,
      nodes: JSON.parse(JSON.stringify(nodes)),
      expressions: {},
      originalBounds: bounds,
    };
    set({ data: legacy });

    const payload = buildIOClipboardPayload({
      originContext: "designer",
      originGraphicId: sourceGraphicId,
      contents: {
        nodes: legacy.nodes,
        expressions: legacy.expressions,
        originalBounds: bounds,
        textRepresentation: computeTextRepresentation({ nodes: legacy.nodes }),
        points: extractPointsFromNodes(legacy.nodes),
      },
    });
    void useIOClipboardStore.getState().writeToClipboard(payload);
  },

  clear() {
    set({ data: null });
  },
}));

export async function readClipboard(
  fallback: ClipboardData | null,
): Promise<ClipboardData | null> {
  const payload = await useIOClipboardStore
    .getState()
    .readFromSystemClipboard();
  if (payload?.contents.nodes?.length) {
    return {
      source: "io-designer",
      version: "1.0",
      sourceGraphicId: payload.originGraphicId ?? "",
      nodes: payload.contents.nodes,
      expressions: payload.contents.expressions ?? {},
      originalBounds: payload.contents.originalBounds ?? {
        x: 0,
        y: 0,
        width: 0,
        height: 0,
      },
    };
  }
  return fallback;
}
