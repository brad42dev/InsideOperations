/**
 * nodeTransforms.ts
 *
 * Shared SVG transform and bounds utilities used by both DesignerCanvas and SceneRenderer.
 * Extracted from DesignerCanvas to eliminate duplicate transform logic across renderers.
 */

import type {
  SceneNode,
  Primitive,
  TextBlock,
  ImageNode,
  Pipe,
  WidgetNode,
  EmbeddedSvgNode,
  SymbolInstance,
  Stencil,
  DisplayElement,
  Annotation,
  TextReadoutConfig,
  PointNameLabelConfig,
} from "../types/graphics";

// ---------------------------------------------------------------------------
// buildTransform — constructs an SVG transform attribute string
// ---------------------------------------------------------------------------

/**
 * Build an SVG transform string with proper pivot-point rotation and mirror handling.
 * Mirror is folded into scale (not appended as a separate scale() call) so the
 * transform chain stays correct: translate → rotate(angle, pivotX, pivotY) → scale.
 */
export function buildTransform(
  x: number,
  y: number,
  rotation: number,
  scaleX: number,
  scaleY: number,
  mirror: string,
  pivotX = 0,
  pivotY = 0,
): string {
  let sx = scaleX;
  let sy = scaleY;
  if (mirror === "horizontal") sx = -sx;
  if (mirror === "vertical") sy = -sy;
  if (mirror === "both") {
    sx = -sx;
    sy = -sy;
  }

  const parts: string[] = [`translate(${x},${y})`];
  if (rotation !== 0) parts.push(`rotate(${rotation},${pivotX},${pivotY})`);
  if (sx !== 1 || sy !== 1) parts.push(`scale(${sx},${sy})`);
  return parts.join(" ");
}

// ---------------------------------------------------------------------------
// getNodeLocalSize — returns the local (pre-scale) width/height of a node.
// Used to compute rotation pivots without depending on libraryStore.
// ---------------------------------------------------------------------------

/**
 * Returns the local-space size { w, h } for a node. For symbol_instance nodes,
 * the optional `shapeSizeLookup` callback provides the base shape dimensions
 * (since those come from the shape sidecar, not from the node itself).
 */
export function getNodeLocalSize(
  node: SceneNode,
  shapeSizeLookup?: (shapeId: string) => { w: number; h: number } | null,
): { w: number; h: number } {
  switch (node.type) {
    case "primitive": {
      const p = node as Primitive;
      if (p.geometry.type === "rect")
        return { w: p.geometry.width, h: p.geometry.height };
      if (p.geometry.type === "ellipse")
        return { w: p.geometry.rx * 2, h: p.geometry.ry * 2 };
      if (p.geometry.type === "circle")
        return { w: p.geometry.r * 2, h: p.geometry.r * 2 };
      if (p.geometry.type === "line") {
        return {
          w: Math.abs(p.geometry.x2 - p.geometry.x1) || 4,
          h: Math.abs(p.geometry.y2 - p.geometry.y1) || 4,
        };
      }
      if (
        p.geometry.type === "polyline" ||
        p.geometry.type === "polygon"
      ) {
        const xs = p.geometry.points.map((pt) => pt.x);
        const ys = p.geometry.points.map((pt) => pt.y);
        return {
          w: Math.max(...xs) - Math.min(...xs) || 4,
          h: Math.max(...ys) - Math.min(...ys) || 4,
        };
      }
      return { w: 64, h: 64 };
    }
    case "text_block": {
      const tb = node as TextBlock;
      return {
        w: tb.maxWidth ?? 120,
        h: tb.fontSize ? tb.fontSize * 2 : 20,
      };
    }
    case "image": {
      const img = node as ImageNode;
      return { w: img.displayWidth, h: img.displayHeight };
    }
    case "widget": {
      const wn = node as WidgetNode;
      return { w: wn.width, h: wn.height };
    }
    case "embedded_svg": {
      const esn = node as EmbeddedSvgNode;
      return { w: esn.width || 64, h: esn.height || 64 };
    }
    case "stencil": {
      const st = node as Stencil;
      return { w: st.size?.width ?? 48, h: st.size?.height ?? 48 };
    }
    case "symbol_instance": {
      const si = node as SymbolInstance;
      const dims = shapeSizeLookup?.(si.shapeRef.shapeId);
      return { w: dims?.w ?? 64, h: dims?.h ?? 64 };
    }
    case "display_element": {
      const de = node as DisplayElement;
      const cfg = de.config;
      switch (cfg.displayType) {
        case "text_readout": {
          const tCfg = cfg as TextReadoutConfig;
          const pnEnabled = tCfg.pointNameRow?.enabled ?? false;
          const dnEnabled = tCfg.displayNameRow?.enabled ?? false;
          const numRows = (pnEnabled ? 1 : 0) + (dnEnabled ? 1 : 0) + 1;
          const ROW_H = 16,
            GAP = 2;
          return { w: tCfg.minWidth ?? 40, h: numRows * ROW_H + (numRows - 1) * GAP };
        }
        case "analog_bar":
          return { w: 40, h: cfg.barHeight ?? 80 };
        case "fill_gauge":
          return { w: cfg.barWidth ?? 24, h: cfg.barHeight ?? 80 };
        case "sparkline":
          return { w: cfg.sparkWidth ?? 110, h: cfg.sparkHeight ?? 18 };
        case "alarm_indicator":
          return { w: 24, h: 18 };
        case "digital_status":
          return { w: 48, h: 20 };
        case "point_name_label": {
          const fs = (cfg as PointNameLabelConfig).fontSize ?? 10;
          return { w: 80, h: fs + 2 };
        }
        default:
          return { w: 80, h: 24 };
      }
    }
    case "annotation": {
      const an = node as Annotation;
      return { w: an.width || 32, h: an.height || 32 };
    }
    case "pipe": {
      const pipe = node as Pipe;
      if (pipe.waypoints && pipe.waypoints.length >= 2) {
        const xs = pipe.waypoints.map((pt) => pt.x);
        const ys = pipe.waypoints.map((pt) => pt.y);
        return {
          w: Math.max(...xs) - Math.min(...xs) || 4,
          h: Math.max(...ys) - Math.min(...ys) || 4,
        };
      }
      return { w: 64, h: 64 };
    }
    case "group": {
      // Groups: bounding box of children. For transform purposes, use default.
      return { w: 64, h: 64 };
    }
    default:
      return { w: 64, h: 64 };
  }
}

// ---------------------------------------------------------------------------
// getNodeRotationPivot — returns the rotation pivot in post-scale local space
// ---------------------------------------------------------------------------

/**
 * Returns the rotation pivot in "post-scale local" space for center-pivot rotation.
 * For shapes where content spans (0,0)→(w,h) in local coords, pivot = (w*sx/2, h*sy/2).
 * For ellipse/circle, position IS the center so pivot = (0,0).
 */
export function getNodeRotationPivot(
  node: SceneNode,
  shapeSizeLookup?: (shapeId: string) => { w: number; h: number } | null,
): { x: number; y: number } {
  const sx = node.transform.scale?.x ?? 1;
  const sy = node.transform.scale?.y ?? 1;

  // Ellipse/circle: origin IS the center
  if (node.type === "primitive") {
    const p = node as Primitive;
    if (p.geometry.type === "ellipse" || p.geometry.type === "circle")
      return { x: 0, y: 0 };
    if (p.geometry.type === "rect")
      return {
        x: (p.geometry.width * sx) / 2,
        y: (p.geometry.height * sy) / 2,
      };
    return { x: 0, y: 0 };
  }

  if (node.type === "symbol_instance") {
    // symbol_instance: scale is baked into the size lookup
    const si = node as SymbolInstance;
    const dims = shapeSizeLookup?.(si.shapeRef.shapeId);
    const w = (dims?.w ?? 64) * sx;
    const h = (dims?.h ?? 64) * sy;
    return { x: w / 2, y: h / 2 };
  }

  // All other types: local size * scale / 2
  const size = getNodeLocalSize(node, shapeSizeLookup);
  return { x: (size.w * sx) / 2, y: (size.h * sy) / 2 };
}

// ---------------------------------------------------------------------------
// buildExteriorSidecarTransform — counter-rotation for exterior sidecars
// ---------------------------------------------------------------------------

/**
 * Builds an SVG transform string for an exterior display element sidecar so that
 * it stays at a fixed canvas position and orientation regardless of parent rotation.
 *
 * The element is rendered INSIDE the parent <g> but this transform mathematically
 * cancels the parent's rotation and scale, placing the element at:
 *   canvas (px + child_x * eff_psx, py + child_y * eff_psy)
 * where child_x / child_y are stored UNSCALED parent-relative offsets.
 *
 * SVG applies the transform string right-to-left, so the transform chain is:
 *   [child scale] → [child rotate] → translate → counter-rotate → counter-scale
 * which, combined with the parent group's transforms, cancels rotation and scale.
 */
export function buildExteriorSidecarTransform(
  childPos: { x: number; y: number },
  childRotation: number,
  childScale: { x: number; y: number },
  childMirror: string,
  parentRotation: number,
  parentScale: { x: number; y: number },
  parentMirror: string,
  parentPivotX: number,
  parentPivotY: number,
  childPivotX = 0,
  childPivotY = 0,
): string {
  // Effective parent scale with mirror folded in
  let epx = parentScale.x;
  let epy = parentScale.y;
  if (parentMirror === "horizontal") epx = -epx;
  else if (parentMirror === "vertical") epy = -epy;
  else if (parentMirror === "both") { epx = -epx; epy = -epy; }

  // Effective child scale with mirror folded in
  let ecx = childScale.x;
  let ecy = childScale.y;
  if (childMirror === "horizontal") ecx = -ecx;
  else if (childMirror === "vertical") ecy = -ecy;
  else if (childMirror === "both") { ecx = -ecx; ecy = -ecy; }

  const parts: string[] = [];

  // Counter-parent scale: cancels the parent group's scale()
  if (epx !== 1 || epy !== 1) {
    parts.push(`scale(${1 / epx},${1 / epy})`);
  }

  // Counter-parent rotation: cancels the parent group's rotate()
  if (parentRotation !== 0) {
    parts.push(`rotate(${-parentRotation},${parentPivotX},${parentPivotY})`);
  }

  // Translate to child's canvas position relative to parent origin
  parts.push(`translate(${childPos.x * epx},${childPos.y * epy})`);

  // Child's own rotation (if any)
  if (childRotation !== 0) {
    parts.push(`rotate(${childRotation},${childPivotX},${childPivotY})`);
  }

  // Child's own scale (if not identity)
  if (ecx !== 1 || ecy !== 1) {
    parts.push(`scale(${ecx},${ecy})`);
  }

  return parts.join(" ");
}

// ---------------------------------------------------------------------------
// buildNodeTransform — convenience: builds the full SVG transform for a node
// ---------------------------------------------------------------------------

/**
 * Builds the complete SVG transform string for a SceneNode, including
 * correct pivot-point rotation and mirror handling.
 */
export function buildNodeTransform(
  node: SceneNode,
  shapeSizeLookup?: (shapeId: string) => { w: number; h: number } | null,
): string {
  const { transform } = node;
  const pivot =
    node.type !== "primitive"
      ? getNodeRotationPivot(node, shapeSizeLookup)
      : getNodeRotationPivot(node);

  return buildTransform(
    transform.position.x,
    transform.position.y,
    transform.rotation,
    transform.scale.x,
    transform.scale.y,
    transform.mirror,
    pivot.x,
    pivot.y,
  );
}
