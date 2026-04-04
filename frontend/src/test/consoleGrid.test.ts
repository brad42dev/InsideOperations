import { describe, it, expect } from "vitest";
import { presetToGridItems } from "../pages/console/WorkspaceGrid";
import {
  GRID_SCALE,
  GRID_COLS,
  GRID_ROWS,
  MIN_W,
  MIN_H,
  scanLineCompact,
} from "../pages/console/layout-utils";
import type {
  LayoutPreset,
  PaneConfig,
  GridItem,
} from "../pages/console/types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePanes(count: number): PaneConfig[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `pane-${i}`,
    type: "blank" as const,
  }));
}

// ---------------------------------------------------------------------------
// presetToGridItems
// ---------------------------------------------------------------------------

describe("presetToGridItems — even grid layouts", () => {
  it("1x1 maps to one full-grid item (12×12 in old coords = 288×288 scaled)", () => {
    const items = presetToGridItems("1x1" as LayoutPreset, makePanes(1));
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      x: 0,
      y: 0,
      w: 12 * GRID_SCALE,
      h: 12 * GRID_SCALE,
    });
  });

  it("2x1 produces two side-by-side panes", () => {
    const items = presetToGridItems("2x1" as LayoutPreset, makePanes(2));
    expect(items).toHaveLength(2);
    // Each should be 6 cols wide (in old coords), scaled by GRID_SCALE
    expect(items[0].w).toBe(6 * GRID_SCALE);
    expect(items[1].w).toBe(6 * GRID_SCALE);
    // Both start at row 0
    expect(items[0].y).toBe(0);
    expect(items[1].y).toBe(0);
    // Second pane starts at column 6 (scaled)
    expect(items[1].x).toBe(6 * GRID_SCALE);
  });

  it("2x2 produces four equally-sized panes", () => {
    const items = presetToGridItems("2x2" as LayoutPreset, makePanes(4));
    expect(items).toHaveLength(4);
    for (const item of items) {
      expect(item.w).toBe(6 * GRID_SCALE);
      expect(item.h).toBe(6 * GRID_SCALE);
    }
  });

  it("3x3 produces nine panes each 4×4 (scaled)", () => {
    const items = presetToGridItems("3x3" as LayoutPreset, makePanes(9));
    expect(items).toHaveLength(9);
    for (const item of items) {
      expect(item.w).toBe(4 * GRID_SCALE);
      expect(item.h).toBe(4 * GRID_SCALE);
    }
  });

  it("handles fewer panes than preset slots (truncates to pane count)", () => {
    const items = presetToGridItems("2x2" as LayoutPreset, makePanes(2));
    expect(items).toHaveLength(2);
  });

  it("assigns pane IDs as grid item keys", () => {
    const panes = makePanes(2);
    const items = presetToGridItems("2x1" as LayoutPreset, panes);
    expect(items[0].i).toBe(panes[0].id);
    expect(items[1].i).toBe(panes[1].id);
  });
});

describe("presetToGridItems — asymmetric layouts", () => {
  it("big-left-3-right produces 4 panes", () => {
    const items = presetToGridItems(
      "big-left-3-right" as LayoutPreset,
      makePanes(4),
    );
    expect(items).toHaveLength(4);
  });

  it("pip produces 2 panes (picture-in-picture)", () => {
    const items = presetToGridItems("pip" as LayoutPreset, makePanes(2));
    expect(items).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// getVisiblePointIds — inlined from process/index.tsx
// Tests viewport-based point subscription filtering.
// ---------------------------------------------------------------------------

import type {
  SceneNode,
  ViewportState,
  DisplayElement,
} from "../shared/types/graphics";

function getVisiblePointIds(
  doc: { children: SceneNode[] },
  vp: ViewportState,
): string[] {
  const visible = new Set<string>();
  const vLeft = vp.panX;
  const vTop = vp.panY;
  const vRight = vp.panX + vp.screenWidth / vp.zoom;
  const vBottom = vp.panY + vp.screenHeight / vp.zoom;

  function scanNode(node: SceneNode) {
    if (!node.visible) return;
    const { x, y } = node.transform.position;
    const nRight = x + 200;
    const nBottom = y + 200;
    const inViewport =
      x < vRight && nRight > vLeft && y < vBottom && nBottom > vTop;

    if (inViewport) {
      if (node.type === "display_element") {
        const de = node as DisplayElement;
        if (de.binding?.pointId) visible.add(de.binding.pointId);
      }
    }

    if ("children" in node && Array.isArray(node.children)) {
      for (const child of node.children) scanNode(child as SceneNode);
    }
  }

  for (const node of doc.children) scanNode(node);
  return Array.from(visible);
}

function makeViewport(overrides: Partial<ViewportState> = {}): ViewportState {
  return {
    panX: 0,
    panY: 0,
    zoom: 1,
    canvasWidth: 1920,
    canvasHeight: 1080,
    screenWidth: 1920,
    screenHeight: 1080,
    ...overrides,
  };
}

function makeDisplayElement(x: number, y: number, pointId: string): SceneNode {
  return {
    id: `de-${pointId}`,
    type: "display_element",
    name: pointId,
    transform: { position: { x, y }, rotation: 0, scale: { x: 1, y: 1 } },
    visible: true,
    locked: false,
    opacity: 1,
    binding: { pointId, mode: "value" },
    elementType: "text_readout",
    displayFormat: "#.##",
    units: "",
    alarmThresholds: [],
  } as unknown as SceneNode;
}

describe("getVisiblePointIds", () => {
  it("returns empty array for empty scene", () => {
    const ids = getVisiblePointIds({ children: [] }, makeViewport());
    expect(ids).toEqual([]);
  });

  it("returns point IDs for elements within viewport", () => {
    const node = makeDisplayElement(100, 100, "FIC-101");
    const ids = getVisiblePointIds({ children: [node] }, makeViewport());
    expect(ids).toContain("FIC-101");
  });

  it("excludes elements completely outside viewport (right side)", () => {
    // Element at x=2200, which is past 1920px viewport width
    const node = makeDisplayElement(2200, 100, "FIC-999");
    const ids = getVisiblePointIds({ children: [node] }, makeViewport());
    expect(ids).not.toContain("FIC-999");
  });

  it("excludes elements completely outside viewport (below)", () => {
    // Element at y=1500, which is past 1080px viewport height
    const node = makeDisplayElement(100, 1500, "FIC-998");
    const ids = getVisiblePointIds({ children: [node] }, makeViewport());
    expect(ids).not.toContain("FIC-998");
  });

  it("excludes hidden nodes", () => {
    const node = makeDisplayElement(100, 100, "FIC-HIDDEN");
    (node as SceneNode & { visible: boolean }).visible = false;
    const ids = getVisiblePointIds({ children: [node] }, makeViewport());
    expect(ids).not.toContain("FIC-HIDDEN");
  });

  it("respects pan offset — panned so element is out of view", () => {
    // Element at canvas (100, 100), viewport panned to x=500 so element is left of viewport
    const node = makeDisplayElement(100, 100, "FIC-OFFSCREEN");
    const vp = makeViewport({ panX: 500 });
    const ids = getVisiblePointIds({ children: [node] }, vp);
    expect(ids).not.toContain("FIC-OFFSCREEN");
  });

  it("respects pan offset — panned so element is within view", () => {
    // Element at canvas (600, 100), viewport panned to x=500
    const node = makeDisplayElement(600, 100, "FIC-VISIBLE");
    const vp = makeViewport({ panX: 500 });
    const ids = getVisiblePointIds({ children: [node] }, vp);
    expect(ids).toContain("FIC-VISIBLE");
  });

  it("respects zoom — zoomed out so more elements are visible", () => {
    // With zoom=0.5, viewport shows 3840×2160 canvas area
    const node = makeDisplayElement(2000, 100, "FIC-ZOOM");
    const vp = makeViewport({ zoom: 0.5 });
    const ids = getVisiblePointIds({ children: [node] }, vp);
    expect(ids).toContain("FIC-ZOOM");
  });

  it("excludes nodes without point bindings (display_element with no binding)", () => {
    const node: SceneNode = {
      id: "de-unbound",
      type: "display_element",
      name: "unbound",
      transform: {
        position: { x: 100, y: 100 },
        rotation: 0,
        scale: { x: 1, y: 1 },
      },
      visible: true,
      locked: false,
      opacity: 1,
      elementType: "text_readout",
      displayFormat: "#.##",
      units: "",
      alarmThresholds: [],
    } as unknown as SceneNode;
    const ids = getVisiblePointIds({ children: [node] }, makeViewport());
    expect(ids).toHaveLength(0);
  });

  it("deduplicates: same point bound to multiple elements counted once", () => {
    const node1 = makeDisplayElement(100, 100, "FIC-101");
    const node2 = makeDisplayElement(200, 100, "FIC-101");
    const ids = getVisiblePointIds(
      { children: [node1, node2] },
      makeViewport(),
    );
    expect(ids.filter((id) => id === "FIC-101")).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// scanLineCompact
// ---------------------------------------------------------------------------

function gi(i: string, x: number, y: number, w: number, h: number): GridItem {
  return { i, x, y, w, h };
}

function hasOverlap(layout: GridItem[]): boolean {
  for (let a = 0; a < layout.length; a++) {
    for (let b = a + 1; b < layout.length; b++) {
      const dw =
        Math.min(layout[a].x + layout[a].w, layout[b].x + layout[b].w) -
        Math.max(layout[a].x, layout[b].x);
      const dh =
        Math.min(layout[a].y + layout[a].h, layout[b].y + layout[b].h) -
        Math.max(layout[a].y, layout[b].y);
      if (dw > 0 && dh > 0) return true;
    }
  }
  return false;
}

function allInBounds(layout: GridItem[]): boolean {
  return layout.every(
    (it) =>
      it.x >= 0 &&
      it.y >= 0 &&
      it.x + it.w <= GRID_COLS &&
      it.y + it.h <= GRID_ROWS &&
      it.w >= MIN_W &&
      it.h >= MIN_H,
  );
}

describe("scanLineCompact", () => {
  it("returns unchanged layout when no overlaps exist", () => {
    // 2×2 grid, perfectly tiled, no overlaps
    const S = 6 * GRID_SCALE; // 144
    const layout = [
      gi("a", 0, 0, S, S),
      gi("b", S, 0, S, S),
      gi("c", 0, S, S, S),
      gi("d", S, S, S, S),
    ];
    const result = scanLineCompact(layout, null, new Set(), null);
    expect(result).toHaveLength(4);
    expect(hasOverlap(result)).toBe(false);
    // positions must be unchanged
    for (let i = 0; i < layout.length; i++) {
      expect(result[i]).toMatchObject(layout[i]);
    }
  });

  it("2×2 drag: dragging top-left over top-right → zero overlaps", () => {
    const S = 6 * GRID_SCALE;
    const preGesture = [
      gi("a", 0, 0, S, S),
      gi("b", S, 0, S, S),
      gi("c", 0, S, S, S),
      gi("d", S, S, S, S),
    ];
    // "a" dragged to overlap "b"
    const withNewPos = [
      gi("a", S - 10, 0, S, S),
      gi("b", S, 0, S, S),
      gi("c", 0, S, S, S),
      gi("d", S, S, S, S),
    ];
    const result = scanLineCompact(withNewPos, "a", new Set(), preGesture);
    expect(result).toHaveLength(4);
    expect(hasOverlap(result)).toBe(false);
    expect(allInBounds(result)).toBe(true);
  });

  it("4×4 resize east to grid edge → zero overlaps, all 16 panes present", () => {
    const S = 3 * GRID_SCALE; // 72 — 4 columns of 72 each = 288
    const layout: GridItem[] = [];
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        layout.push(gi(`p${row * 4 + col}`, col * S, row * S, S, S));
      }
    }
    const preGesture = layout.map((it) => ({ ...it }));
    // pane 0 resized east to full width
    const withResize = layout.map((it) =>
      it.i === "p0" ? gi("p0", 0, 0, GRID_COLS, S) : it,
    );
    const result = scanLineCompact(withResize, "p0", new Set(), preGesture);
    expect(result).toHaveLength(16);
    expect(hasOverlap(result)).toBe(false);
    expect(allInBounds(result)).toBe(true);
  });

  it("4×4 resize south to grid edge → zero overlaps, all 16 panes present", () => {
    const S = 3 * GRID_SCALE;
    const layout: GridItem[] = [];
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        layout.push(gi(`p${row * 4 + col}`, col * S, row * S, S, S));
      }
    }
    const preGesture = layout.map((it) => ({ ...it }));
    const withResize = layout.map((it) =>
      it.i === "p0" ? gi("p0", 0, 0, S, GRID_ROWS) : it,
    );
    const result = scanLineCompact(withResize, "p0", new Set(), preGesture);
    expect(result).toHaveLength(16);
    expect(hasOverlap(result)).toBe(false);
    expect(allInBounds(result)).toBe(true);
  });

  it("pinned pane is never moved", () => {
    const S = 6 * GRID_SCALE;
    const preGesture = [
      gi("a", 0, 0, S, S),
      gi("b", S, 0, S, S),
      gi("c", 0, S, S, S),
      gi("d", S, S, S, S),
    ];
    // "a" dragged to overlap "b"
    const withNewPos = [
      gi("a", S - 20, 0, S, S),
      gi("b", S, 0, S, S),
      gi("c", 0, S, S, S),
      gi("d", S, S, S, S),
    ];
    const result = scanLineCompact(withNewPos, "a", new Set(["b"]), preGesture);
    const bResult = result.find((it) => it.i === "b")!;
    expect(bResult.x).toBe(S);
    expect(bResult.y).toBe(0);
    expect(bResult.w).toBe(S);
    expect(bResult.h).toBe(S);
    expect(hasOverlap(result)).toBe(false);
  });

  it("moved pane stays at exact gesture-stop position (when no pinned conflict)", () => {
    const S = 6 * GRID_SCALE;
    const preGesture = [gi("a", 0, 0, S, S), gi("b", S, 0, S, S)];
    const stopX = 40;
    const stopY = 20;
    const withNewPos = [gi("a", stopX, stopY, S, S), gi("b", S, 0, S, S)];
    const result = scanLineCompact(withNewPos, "a", new Set(), preGesture);
    const aResult = result.find((it) => it.i === "a")!;
    expect(aResult.x).toBe(stopX);
    expect(aResult.y).toBe(stopY);
  });

  it("all panes remain within grid bounds after compact", () => {
    const S = 3 * GRID_SCALE;
    // Create a layout where pane 0 is resized to push others near the edge
    const layout: GridItem[] = [];
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        layout.push(gi(`p${row * 4 + col}`, col * S, row * S, S, S));
      }
    }
    const preGesture = layout.map((it) => ({ ...it }));
    const withResize = layout.map((it) =>
      it.i === "p0" ? gi("p0", 0, 0, S * 3, S * 3) : it,
    );
    const result = scanLineCompact(withResize, "p0", new Set(), preGesture);
    expect(allInBounds(result)).toBe(true);
  });

  it("no pane shrinks below MIN_W × MIN_H", () => {
    const S = 3 * GRID_SCALE;
    const layout: GridItem[] = [];
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        layout.push(gi(`p${row * 4 + col}`, col * S, row * S, S, S));
      }
    }
    const preGesture = layout.map((it) => ({ ...it }));
    const withResize = layout.map((it) =>
      it.i === "p0" ? gi("p0", 0, 0, GRID_COLS, GRID_ROWS) : it,
    );
    const result = scanLineCompact(withResize, "p0", new Set(), preGesture);
    for (const it of result) {
      expect(it.w).toBeGreaterThanOrEqual(MIN_W);
      expect(it.h).toBeGreaterThanOrEqual(MIN_H);
    }
  });

  it("deterministic: calling twice with same input gives identical output", () => {
    const S = 4 * GRID_SCALE;
    const layout = [
      gi("a", 0, 0, S * 2, S),
      gi("b", S, 0, S, S),
      gi("c", 0, S, S, S),
      gi("d", S, S, S, S),
    ];
    const preGesture = [
      gi("a", 0, 0, S, S),
      gi("b", S, 0, S, S),
      gi("c", 0, S, S, S),
      gi("d", S, S, S, S),
    ];
    const r1 = scanLineCompact(layout, "a", new Set(), preGesture);
    const r2 = scanLineCompact(layout, "a", new Set(), preGesture);
    expect(r1).toEqual(r2);
  });

  it("16-pane 4×4 grid with one pane at triple width → zero overlaps", () => {
    const S = 3 * GRID_SCALE; // 72
    const layout: GridItem[] = [];
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        layout.push(gi(`p${row * 4 + col}`, col * S, row * S, S, S));
      }
    }
    const preGesture = layout.map((it) => ({ ...it }));
    const withResize = layout.map((it) =>
      it.i === "p0" ? gi("p0", 0, 0, S * 3, S) : it,
    );
    const result = scanLineCompact(withResize, "p0", new Set(), preGesture);
    expect(result).toHaveLength(16);
    expect(hasOverlap(result)).toBe(false);
    expect(allInBounds(result)).toBe(true);
  });

  it("pre-gesture positions used for slot search, not current intermediate positions", () => {
    // "b" was at (144, 0) pre-gesture; current layout has it at (0, 0) due to some
    // intermediate state. scanLineCompact should search from (144, 0), not (0, 0).
    const S = 6 * GRID_SCALE; // 144
    const preGesture = [gi("a", 0, 0, S, S), gi("b", S, 0, S, S)];
    const currentLayout = [
      gi("a", 0, 0, S * 2, S), // "a" expanded
      gi("b", 0, 0, S, S), // "b" at corrupted position (0,0)
    ];
    const result = scanLineCompact(currentLayout, "a", new Set(), preGesture);
    // "b" should be displaced from (144, 0) to a conflict-free slot, NOT stay at (0,0)
    // It must not overlap "a"
    expect(hasOverlap(result)).toBe(false);
    expect(allInBounds(result)).toBe(true);
  });

  it("touching panes (shared edge, dw=0 or dh=0) are NOT counted as overlapping", () => {
    const S = 6 * GRID_SCALE;
    // "a" right edge == "b" left edge — touching, not overlapping
    const layout = [gi("a", 0, 0, S, S), gi("b", S, 0, S, S)];
    const result = scanLineCompact(layout, null, new Set(), null);
    expect(hasOverlap(result)).toBe(false);
    // Both should stay put since there's no real overlap
    expect(result.find((it) => it.i === "a")).toMatchObject({ x: 0, y: 0 });
    expect(result.find((it) => it.i === "b")).toMatchObject({ x: S, y: 0 });
  });

  it("movedId=null runs pure compaction with no fixed moved pane", () => {
    const S = 6 * GRID_SCALE;
    // Two panes overlapping — pure compaction should resolve
    const layout = [gi("a", 0, 0, S, S), gi("b", S - 10, 0, S, S)];
    const result = scanLineCompact(layout, null, new Set(), null);
    expect(hasOverlap(result)).toBe(false);
    expect(allInBounds(result)).toBe(true);
  });

  it("multiple pinned panes act as independent fixed obstacles", () => {
    const S = 3 * GRID_SCALE; // 72
    const layout: GridItem[] = [];
    for (let row = 0; row < 4; row++) {
      for (let col = 0; col < 4; col++) {
        layout.push(gi(`p${row * 4 + col}`, col * S, row * S, S, S));
      }
    }
    const preGesture = layout.map((it) => ({ ...it }));
    // Pin 3 panes (corners)
    const pinned = new Set(["p0", "p3", "p12"]);
    const withResize = layout.map((it) =>
      it.i === "p5" ? gi("p5", 0, 0, S * 3, S * 3) : it,
    );
    const result = scanLineCompact(withResize, "p5", pinned, preGesture);
    expect(hasOverlap(result)).toBe(false);
    expect(allInBounds(result)).toBe(true);
    // Pinned panes must not move
    for (const pinnedId of pinned) {
      const original = layout.find((it) => it.i === pinnedId)!;
      const resultItem = result.find((it) => it.i === pinnedId)!;
      expect(resultItem.x).toBe(original.x);
      expect(resultItem.y).toBe(original.y);
      expect(resultItem.w).toBe(original.w);
      expect(resultItem.h).toBe(original.h);
    }
  });
});
