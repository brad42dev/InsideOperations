/**
 * Canonical shape sidecar types — shared across the application.
 *
 * Single source of truth for ShapeSidecar and all related types.
 * Import from here rather than from shapeCache or libraryStore.
 */

export interface ShapeVariantOption {
  file: string;
  label: string;
}

export interface ShapeVariants {
  options?: Record<string, ShapeVariantOption>;
  configurations?: Array<{ file: string; label: string }>;
}

export interface ShapeAlarmBinding {
  stateSource: string;
  priorityMapping: Record<string, string>;
  unacknowledgedFlash: boolean;
  flashRate: string;
}

/** Connection point — absolute x/y coordinates in viewBox space */
export interface ConnectionPoint {
  id: string;
  /** Absolute x coordinate in viewBox space */
  x?: number;
  /** Absolute y coordinate in viewBox space */
  y?: number;
  direction: "left" | "right" | "up" | "down" | "top" | "bottom";
  type: "process" | "signal" | "actuator" | "electrical";
  rotatesWithShape?: boolean;
}

/** Text zone — absolute x/y with width in viewBox space */
export interface TextZone {
  id: string;
  x?: number;
  y?: number;
  width?: number;
  anchor?: "start" | "middle" | "end";
  fontSize?: number;
}

/** Value anchor — normalized nx/ny (0–1) with preferredElement */
export interface ValueAnchor {
  /** Normalized x (0–1) relative to shape width */
  nx?: number;
  /** Normalized y (0–1) relative to shape height */
  ny?: number;
  preferredElement?: string;
}

/**
 * Shape sidecar — metadata attached to every shape JSON file.
 *
 * Canonical type used by shapeCache, libraryStore, SceneRenderer, and designer components.
 * Handles both the raw JSON format (snake_case fields) and the normalized load-time format.
 *
 * Field variants handled:
 * - geometry.baseSize [w,h] tuple vs geometry.width/height flat fields — both optional
 * - alarmAnchor as [nx,ny] tuple or {nx,ny} object — both accepted
 * - states as Record<string,string> map or string[] list — both accepted
 */
export interface ShapeSidecar {
  $schema?: string;
  /** Shape ID as stored in the JSON file */
  shape_id?: string;
  /** Normalized ID (populated from shape_id or filename on load) */
  id?: string;
  version?: string;
  display_name?: string;
  category?: string;
  subcategory?: string;
  tags?: string[];
  recognition_class?: string;
  isPart?: boolean;
  partClass?: string;
  /** Raw variant structure from JSON sidecar — normalized into `options` on load */
  variants?: ShapeVariants;
  alarmBinding?: ShapeAlarmBinding;
  geometry?: {
    viewBox: string;
    /** Flat width (used by most sidecar files) */
    width?: number;
    /** Flat height (used by most sidecar files) */
    height?: number;
    /** Alternative: [width, height] tuple */
    baseSize?: [number, number];
    gridSnap?: number;
    orientations?: number[];
    mirrorable?: boolean;
    /**
     * For composable parts: the point in this part's own viewBox coordinates
     * that should align to the base shape's compositeAttachment point.
     * Placement: svg.x = attachment.x − bodyBase.x, svg.y = attachment.y − bodyBase.y.
     */
    bodyBase?: { x: number; y: number };
    /** Tight bounding box of visual content in viewBox coordinate space. */
    selectionBounds?: { x: number; y: number; w: number; h: number };
  };
  connections?: ConnectionPoint[];
  textZones?: TextZone[];
  valueAnchors?: ValueAnchor[];
  /** Alarm anchor — either normalized [nx, ny] tuple or {nx, ny} object */
  alarmAnchor?: [number, number] | { nx: number; ny: number } | null;
  /** Operational state map or state name list */
  states?: Record<string, string> | string[];
  /** SVG path for vessel interior (used by vessel_overlay FillGauge clip) */
  vesselInteriorPath?: string;
  /**
   * Composable part addon definitions. Each entry describes an attachable part
   * with its shape file and group membership.
   */
  addons?: Array<{
    id: string;
    file: string;
    label: string;
    group?: string;
    exclusive?: boolean;
  }>;
  /**
   * Exact attachment points for composable parts.
   * Renderer looks up the entry whose `forPart` matches the addon id (specific)
   * or addon group (fallback).
   * Placement: svg.x = x − bodyBase.x, svg.y = y − bodyBase.y.
   * When `stemFrom` is present the renderer also draws a connecting line.
   */
  compositeAttachments?: Array<{
    /** Addon id (e.g. "fail-open") or addon group (e.g. "actuator") */
    forPart: string;
    /** Attachment x in this shape's viewBox coordinate space */
    x: number;
    /** Attachment y in this shape's viewBox coordinate space */
    y: number;
    /** Optional start point for a connecting stem line */
    stemFrom?: { x: number; y: number };
  }>;
  /** Available display element slot names per display element type */
  anchorSlots?: Partial<
    Record<
      | "PointNameLabel"
      | "AlarmIndicator"
      | "TextReadout"
      | "AnalogBar"
      | "FillGauge"
      | "Sparkline"
      | "DigitalStatus",
      string[]
    >
  >;
  defaultSlots?: Record<string, string>;
  /** Normalized variant file list (populated from variants.options on load) */
  options?: Array<{ id: string; file: string; label: string }>;
  configurations?: Array<{ id: string; label: string; file: string }>;
  bindableParts?: Array<{ partId: string; label: string; category: string }>;
}
