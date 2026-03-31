/**
 * PromoteToShapeWizard.tsx
 *
 * 8-step wizard to promote selected elements into a full I/O equipment shape
 * with connection points, state handling, and value display anchors.
 *
 * Per spec: Designer → select elements → right-click → "Promote to Shape"
 *
 * Extended (MOD-DESIGNER-025): also accepts a group node as source.
 * When sourceType === 'group', the wizard replaces the "Upload SVG" step with
 * a "Source Analysis" step, auto-generates SVG from geometry children, and
 * inserts a "Value Anchors" step populated from the group's display elements.
 */

import React, { useState, useRef, useMemo } from "react";
import { graphicsApi } from "../../../api/graphics";
import type {
  ConnectionPoint,
  TextZone,
  ValueAnchor,
} from "../../../store/designer/libraryStore";
import { useLibraryStore } from "../../../store/designer/libraryStore";
import type {
  SceneNode,
  Group,
  DisplayElement,
  Primitive,
  SymbolInstance,
  EmbeddedSvgNode,
  ImageNode,
  TextBlock,
  Pipe,
  Annotation,
  WidgetNode,
} from "../../../shared/types/graphics";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Direction = "left" | "right" | "up" | "down";
type ConnectionType = "process" | "signal" | "actuator" | "electrical";

interface CPDraft extends ConnectionPoint {
  id: string;
  x: number;
  y: number;
  direction: Direction;
  type: ConnectionType;
}

interface WizardState {
  // Step: Name & Category
  shapeIdPrefix: string;
  displayName: string;
  category: string;
  newCategoryInput: string;
  tags: string[];
  // Step: Boundary
  boundingBoxConfirmed: boolean;
  // Step: Connection Points
  connectionPoints: CPDraft[];
  // Step: Stateful elements
  supportedStates: string[];
  statefulElements: string[];
  // Step: Text Zones
  textZones: TextZone[];
  // Step: Value Anchors (standard flow — click-to-place, normalized)
  valueAnchors: ValueAnchor[];
  // Step: Orientation
  orientations: number[];
  mirrorable: boolean;
}

// Group-source extended anchor (absolute coords in bbox space, labeled)
interface GroupValueAnchor {
  id: string;
  label: string;
  x: number; // absolute in bounding-box space (0..bboxW)
  y: number; // absolute in bounding-box space (0..bboxH)
  defaultDisplayType: string;
}

// Group-source text zone (with label + defaultText)
interface GroupTextZone {
  id: string;
  label: string;
  x: number;
  y: number;
  defaultText: string;
}

// Categorized group children
interface GroupAnalysis {
  geometryNodes: SceneNode[];
  displayElements: DisplayElement[];
  textBlocks: TextBlock[];
  pipes: Pipe[];
  widgets: WidgetNode[];
  // bounding box of all elements in canvas transform-position coords
  bboxX: number;
  bboxY: number;
  bboxW: number;
  bboxH: number;
}

const SHAPE_CATEGORIES = [
  "Valves",
  "Pumps",
  "Rotating",
  "Heat Transfer",
  "Vessels",
  "Separation",
  "Instrumentation",
  "Control",
  "Custom",
];

const DIRECTIONS: Direction[] = ["left", "right", "up", "down"];
const CP_TYPES: ConnectionType[] = [
  "process",
  "signal",
  "actuator",
  "electrical",
];

// Display type to anchor label mapping (per task spec)
const DISPLAY_TYPE_LABELS: Record<string, string> = {
  fill_gauge: "Level",
  analog_bar: "Measurement",
  text_readout: "Value",
  sparkline: "Trend",
  alarm_indicator: "Alarm",
  digital_status: "Status",
};

// Standard flow step titles
const STEP_TITLES_STANDARD = [
  "Name & Category",
  "Boundary & Sizing",
  "Connection Points",
  "Stateful Elements",
  "Text Zones",
  "Value Display Anchors",
  "Orientation & Mirror",
  "Preview & Save",
];

// Group flow step titles
const STEP_TITLES_GROUP = [
  "Source Analysis",
  "SVG Preview",
  "Value Anchors",
  "Name & Category",
  "Connection Points",
  "Text Zones",
  "Orientation & Mirror",
  "Preview & Save",
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PromoteToShapeWizardProps {
  selectedNodes: SceneNode[];
  onClose: () => void;
  onSaved: (shapeId: string) => void;
  /** Set when the wizard is triggered from a group node right-click */
  sourceType?: "group";
  sourceNodeId?: string;
  /** Callback to replace the group node with a new SymbolInstance (undoable) */
  onReplaceGroup?: (groupNodeId: string, newShapeId: string) => void;
}

// ---------------------------------------------------------------------------
// Group analysis helpers
// ---------------------------------------------------------------------------

/** Collect all direct + 1-level-deep children of a group, categorized. */
function analyzeGroup(groupNode: Group): GroupAnalysis {
  const geometry: SceneNode[] = [];
  const displayElements: DisplayElement[] = [];
  const textBlocks: TextBlock[] = [];
  const pipes: Pipe[] = [];
  const widgets: WidgetNode[] = [];

  function categorize(node: SceneNode) {
    switch (node.type) {
      case "primitive":
      case "symbol_instance":
      case "embedded_svg":
      case "image":
      case "annotation":
        geometry.push(node);
        break;
      case "display_element":
        displayElements.push(node as DisplayElement);
        break;
      case "text_block":
        textBlocks.push(node as TextBlock);
        break;
      case "pipe":
        pipes.push(node as Pipe);
        break;
      case "widget":
        widgets.push(node as WidgetNode);
        break;
      case "group": {
        // Flatten nested group 1 level deep
        const nested = node as Group;
        for (const child of nested.children) {
          categorize(child);
        }
        break;
      }
      default:
        // stencil etc — include as geometry
        geometry.push(node);
    }
  }

  for (const child of groupNode.children) {
    categorize(child);
  }

  // Compute bounding box from all element positions
  const allForBbox: SceneNode[] = [
    ...geometry,
    ...displayElements,
    ...textBlocks,
    ...pipes,
  ];

  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const n of allForBbox) {
    const px = n.transform.position.x;
    const py = n.transform.position.y;
    if (px < minX) minX = px;
    if (py < minY) minY = py;
    if (px > maxX) maxX = px;
    if (py > maxY) maxY = py;
  }

  if (!isFinite(minX)) {
    minX = 0;
    minY = 0;
    maxX = 48;
    maxY = 48;
  }

  // Ensure minimum size
  const bboxW = Math.max(maxX - minX, 1);
  const bboxH = Math.max(maxY - minY, 1);

  return {
    geometryNodes: geometry,
    displayElements,
    textBlocks,
    pipes,
    widgets,
    bboxX: minX,
    bboxY: minY,
    bboxW,
    bboxH,
  };
}

/** Generate SVG string from geometry elements. Does NOT use any user-controlled HTML. */
function compositeSvg(
  analysis: GroupAnalysis,
  shapeSvgCache: (id: string) => string | null,
): string {
  const { geometryNodes, bboxX, bboxY, bboxW, bboxH } = analysis;

  const parts: string[] = [];

  for (const node of geometryNodes) {
    const tx = node.transform.position.x - bboxX;
    const ty = node.transform.position.y - bboxY;
    const rot = node.transform.rotation;
    const sx = node.transform.scale.x;
    const sy = node.transform.scale.y;
    const transform = `translate(${tx.toFixed(2)},${ty.toFixed(2)}) rotate(${rot}) scale(${sx},${sy})`;

    switch (node.type) {
      case "primitive": {
        const p = node as Primitive;
        const fill = escapeSvgAttr(p.style.fill);
        const stroke = escapeSvgAttr(p.style.stroke);
        const style = `fill="${fill}" fill-opacity="${p.style.fillOpacity}" stroke="${stroke}" stroke-width="${p.style.strokeWidth}"`;
        const geom = p.geometry;
        let el = "";
        switch (geom.type) {
          case "rect":
            el = `<rect width="${geom.width}" height="${geom.height}"${geom.rx ? ` rx="${geom.rx}"` : ""} ${style}/>`;
            break;
          case "circle":
            el = `<circle r="${geom.r}" ${style}/>`;
            break;
          case "ellipse":
            el = `<ellipse rx="${geom.rx}" ry="${geom.ry}" ${style}/>`;
            break;
          case "line":
            el = `<line x1="${geom.x1}" y1="${geom.y1}" x2="${geom.x2}" y2="${geom.y2}" stroke="${stroke}" stroke-width="${p.style.strokeWidth}"/>`;
            break;
          case "path":
            el = `<path d="${escapeSvgAttr(geom.d)}" ${style}/>`;
            break;
          case "polyline":
            el = `<polyline points="${geom.points.map((pt) => `${pt.x},${pt.y}`).join(" ")}" ${style}/>`;
            break;
          case "polygon":
            el = `<polygon points="${geom.points.map((pt) => `${pt.x},${pt.y}`).join(" ")}" ${style}/>`;
            break;
        }
        if (el) parts.push(`<g transform="${transform}">${el}</g>`);
        break;
      }
      case "symbol_instance": {
        const si = node as SymbolInstance;
        const shapeSvg = shapeSvgCache(si.shapeRef.shapeId);
        if (shapeSvg) {
          // Extract only the inner content between <svg> tags — never embed the raw SVG string
          // into HTML; here it goes into SVG namespace which is safe as geometry only.
          const innerContent = extractSvgInner(shapeSvg);
          parts.push(`<g transform="${transform}">${innerContent}</g>`);
        } else {
          // Placeholder rect if shape not cached
          parts.push(
            `<g transform="${transform}"><rect width="24" height="24" fill="none" stroke="#999999" stroke-width="0.5"/></g>`,
          );
        }
        break;
      }
      case "embedded_svg": {
        const esv = node as EmbeddedSvgNode;
        const innerContent = extractSvgInner(esv.svgContent);
        parts.push(`<g transform="${transform}">${innerContent}</g>`);
        break;
      }
      case "image": {
        const img = node as ImageNode;
        // Embed as image element — href is data URI which is safe in SVG image context
        parts.push(
          `<g transform="${transform}"><rect width="${img.displayWidth}" height="${img.displayHeight}" fill="#cccccc" fill-opacity="0.3" stroke="#999999" stroke-width="0.5" stroke-dasharray="4 2"/></g>`,
        );
        break;
      }
      case "annotation": {
        const ann = node as Annotation;
        parts.push(
          `<g transform="${transform}"><rect width="${ann.width}" height="${ann.height}" fill="none" stroke="#999999" stroke-width="0.5" stroke-dasharray="4 2"/></g>`,
        );
        break;
      }
      default:
        break;
    }
  }

  const w = bboxW.toFixed(2);
  const h = bboxH.toFixed(2);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">\n${parts.join("\n")}\n</svg>`;
}

/** Extract the inner content of an SVG string (between <svg...> and </svg>). */
function extractSvgInner(svgString: string): string {
  // Remove XML declaration
  let s = svgString.replace(/<\?xml[^>]*\?>/gi, "").trim();
  // Remove outer <svg ...> opening tag
  s = s.replace(/^<svg[^>]*>/i, "");
  // Remove closing </svg>
  s = s.replace(/<\/svg\s*>\s*$/i, "");
  return s.trim();
}

/** Escape a value for use as an SVG attribute (prevent attribute injection). */
function escapeSvgAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Build a data URI from an SVG string so it can be rendered via <img>. */
function svgToDataUri(svgString: string): string {
  // Use base64 encoding to avoid URI encoding issues
  const encoded = btoa(unescape(encodeURIComponent(svgString)));
  return `data:image/svg+xml;base64,${encoded}`;
}

/** Generate group value anchors from display elements. */
function buildGroupValueAnchors(analysis: GroupAnalysis): GroupValueAnchor[] {
  return analysis.displayElements.map((de, i) => {
    const x = de.transform.position.x - analysis.bboxX;
    const y = de.transform.position.y - analysis.bboxY;
    return {
      id: `anchor-${i}`,
      label: DISPLAY_TYPE_LABELS[de.displayType] ?? "Value",
      x: parseFloat(x.toFixed(2)),
      y: parseFloat(y.toFixed(2)),
      defaultDisplayType: de.displayType,
    };
  });
}

/** Generate group text zones from text_block children. */
function buildGroupTextZones(analysis: GroupAnalysis): GroupTextZone[] {
  return analysis.textBlocks.map((tb, i) => ({
    id: `zone-${i}`,
    label: tb.content || "Text Zone",
    x: parseFloat((tb.transform.position.x - analysis.bboxX).toFixed(2)),
    y: parseFloat((tb.transform.position.y - analysis.bboxY).toFixed(2)),
    defaultText: tb.content || "",
  }));
}

/** Generate connection points from pipes with dangling endpoints. */
function buildGroupConnectionPoints(analysis: GroupAnalysis): CPDraft[] {
  const groupNodeIds = new Set<string>([
    ...analysis.geometryNodes.map((n) => n.id),
    ...analysis.displayElements.map((n) => n.id),
    ...analysis.textBlocks.map((n) => n.id),
    ...analysis.pipes.map((n) => n.id),
    ...analysis.widgets.map((n) => n.id),
  ]);

  const cps: CPDraft[] = [];
  let cpIdx = 0;

  for (const pipe of analysis.pipes) {
    const startConnected = !!(
      pipe.startConnection && groupNodeIds.has(pipe.startConnection.instanceId)
    );
    const endConnected = !!(
      pipe.endConnection && groupNodeIds.has(pipe.endConnection.instanceId)
    );

    if (!startConnected && pipe.waypoints.length > 0) {
      const pt = pipe.waypoints[0];
      cps.push({
        id: `conn-${cpIdx++}`,
        x: parseFloat((pt.x - analysis.bboxX).toFixed(2)),
        y: parseFloat((pt.y - analysis.bboxY).toFixed(2)),
        direction: "left",
        type: "process",
        rotatesWithShape: true,
      });
    }
    if (!endConnected && pipe.waypoints.length > 0) {
      const pt = pipe.waypoints[pipe.waypoints.length - 1];
      cps.push({
        id: `conn-${cpIdx++}`,
        x: parseFloat((pt.x - analysis.bboxX).toFixed(2)),
        y: parseFloat((pt.y - analysis.bboxY).toFixed(2)),
        direction: "right",
        type: "process",
        rotatesWithShape: true,
      });
    }
  }

  return cps;
}

// ---------------------------------------------------------------------------
// SVG preview component — renders SVG via <img src={dataUri}> to avoid
// dangerouslySetInnerHTML. Overlays interactive SVG elements on top.
// ---------------------------------------------------------------------------

interface SvgPreviewWithOverlayProps {
  svgString: string;
  viewBox: string; // e.g. "0 0 120 80"
  width: number;
  height: number;
  overlayChildren?: React.ReactNode;
  onSvgRef?: (el: SVGSVGElement | null) => void;
  onMouseMove?: (e: React.MouseEvent<SVGSVGElement>) => void;
  onMouseUp?: (e: React.MouseEvent<SVGSVGElement>) => void;
  onMouseLeave?: (e: React.MouseEvent<SVGSVGElement>) => void;
}

function SvgPreviewWithOverlay({
  svgString,
  viewBox,
  width,
  height,
  overlayChildren,
  onSvgRef,
  onMouseMove,
  onMouseUp,
  onMouseLeave,
}: SvgPreviewWithOverlayProps) {
  const dataUri = useMemo(() => svgToDataUri(svgString), [svgString]);

  return (
    <div style={{ position: "relative", width, height, flexShrink: 0 }}>
      {/* SVG rendered as image — sandboxed, no script execution */}
      <img
        src={dataUri}
        width={width}
        height={height}
        alt="Shape SVG preview"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          border: "1px solid var(--io-border)",
          background: "var(--io-surface-elevated)",
          display: "block",
        }}
      />
      {/* Transparent overlay SVG for interactive elements (dots, click targets) */}
      <svg
        ref={onSvgRef}
        viewBox={viewBox}
        width={width}
        height={height}
        style={{ position: "absolute", top: 0, left: 0, cursor: "crosshair" }}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
      >
        {overlayChildren}
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PromoteToShapeWizard({
  selectedNodes,
  onClose,
  onSaved,
  sourceType,
  sourceNodeId,
  onReplaceGroup,
}: PromoteToShapeWizardProps) {
  const getShapeSvg = useLibraryStore((s) => s.getShapeSvg);

  const isGroupSource = sourceType === "group";
  const groupNode =
    isGroupSource &&
    selectedNodes.length === 1 &&
    selectedNodes[0].type === "group"
      ? (selectedNodes[0] as Group)
      : null;

  // Analyze the group once on mount
  const [groupAnalysis] = useState<GroupAnalysis | null>(() =>
    groupNode ? analyzeGroup(groupNode) : null,
  );

  // Generate SVG string from geometry elements (synchronous — uses cached shapes)
  const [groupSvg] = useState<string>(() =>
    groupAnalysis ? compositeSvg(groupAnalysis, getShapeSvg) : "",
  );

  const [groupValueAnchors, setGroupValueAnchors] = useState<
    GroupValueAnchor[]
  >(() => (groupAnalysis ? buildGroupValueAnchors(groupAnalysis) : []));
  const [groupTextZonesState] = useState<GroupTextZone[]>(() =>
    groupAnalysis ? buildGroupTextZones(groupAnalysis) : [],
  );
  const [replaceGroupWithShape, setReplaceGroupWithShape] = useState(true);

  // Drag state for anchor dots
  const draggingAnchorIdx = useRef<number | null>(null);
  const overlaySvgRef = useRef<SVGSVGElement | null>(null);

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [widgetWarningDismissed, setWidgetWarningDismissed] = useState(false);

  const [state, setState] = useState<WizardState>(() => ({
    shapeIdPrefix: "",
    displayName: "",
    category: "Custom",
    newCategoryInput: "",
    tags: [],
    boundingBoxConfirmed: true,
    connectionPoints: groupAnalysis
      ? buildGroupConnectionPoints(groupAnalysis)
      : [],
    supportedStates: ["normal"],
    statefulElements: [],
    textZones: groupAnalysis
      ? buildGroupTextZones(groupAnalysis).map((gz, i) => ({
          id: `tz${i + 1}`,
          x: gz.x,
          y: gz.y,
          width: 40,
          anchor: "middle" as const,
          fontSize: 8,
        }))
      : [],
    valueAnchors: [],
    orientations: [0],
    mirrorable: false,
  }));

  const svgPreviewRef = useRef<SVGSVGElement>(null);

  function updateState(patch: Partial<WizardState>) {
    setState((prev) => ({ ...prev, ...patch }));
  }

  const VIEWBOX = "0 0 48 48";

  const groupViewBox = groupAnalysis
    ? `0 0 ${groupAnalysis.bboxW.toFixed(2)} ${groupAnalysis.bboxH.toFixed(2)}`
    : VIEWBOX;

  const STEP_TITLES = isGroupSource ? STEP_TITLES_GROUP : STEP_TITLES_STANDARD;

  // ---------------------------------------------------------------------------
  // Group-source step renderers
  // ---------------------------------------------------------------------------

  function renderGroupStep0_SourceAnalysis() {
    const analysis = groupAnalysis;
    if (!analysis) {
      return (
        <p style={{ color: "var(--io-alarm-high)", fontSize: 12, margin: 0 }}>
          Error: no group node provided.
        </p>
      );
    }

    const widgetCount = analysis.widgets.length;
    const hasWidgets = widgetCount > 0 && !widgetWarningDismissed;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <p
          style={{
            margin: 0,
            fontSize: 12,
            color: "var(--io-text-secondary)",
            lineHeight: 1.5,
          }}
        >
          The group's children have been categorized. Review the summary below
          before proceeding.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <SummaryCard
            icon="checkmark"
            count={analysis.geometryNodes.length}
            text="geometry element"
            detail="will become shape SVG"
          />
          <SummaryCard
            icon="checkmark"
            count={analysis.displayElements.length}
            text="data slot"
            detail="will become value anchors"
          />
          <SummaryCard
            icon="checkmark"
            count={analysis.textBlocks.length}
            text="text zone"
            detail="will become text zones"
          />
          <SummaryCard
            icon="checkmark"
            count={analysis.pipes.length}
            text="pipe"
            detail="dangling endpoints become connection points"
          />
          {widgetCount > 0 && (
            <SummaryCard
              icon="warning"
              count={widgetCount}
              text="widget"
              detail="will be EXCLUDED — widgets cannot be included in shapes"
            />
          )}
        </div>

        {hasWidgets && (
          <div
            style={{
              padding: "10px 12px",
              background: "rgba(234,179,8,0.1)",
              border: "1px solid var(--io-warning)",
              borderRadius: 4,
              fontSize: 12,
              color: "var(--io-text-primary)",
              lineHeight: 1.5,
            }}
          >
            <strong>Warning:</strong> {widgetCount} widget
            {widgetCount !== 1 ? "s" : ""} will be excluded from the shape. Only
            vector elements, display elements, and text blocks can be promoted.
            Proceed without the widget{widgetCount !== 1 ? "s" : ""}, or cancel
            and remove
            {widgetCount !== 1 ? " them" : " it"} from the group first.
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <button
                onClick={() => setWidgetWarningDismissed(true)}
                style={primaryBtnStyle}
              >
                Proceed without widget{widgetCount !== 1 ? "s" : ""}
              </button>
              <button onClick={onClose} style={cancelBtnStyle}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderGroupStep1_SvgPreview() {
    if (!groupAnalysis) return null;

    // Placeholder SVG if no geometry
    const displaySvg =
      groupSvg ||
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${groupViewBox}"><rect width="${groupAnalysis.bboxW}" height="${groupAnalysis.bboxH}" fill="none" stroke="#999" stroke-width="0.5"/></svg>`;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <p
          style={{
            margin: 0,
            fontSize: 12,
            color: "var(--io-text-secondary)",
            lineHeight: 1.5,
          }}
        >
          The following SVG has been generated from the group's vector elements.
          Display elements, text blocks, and pipes are not included here — they
          become value anchors and connection points in the next steps.
        </p>
        <div
          style={{
            border: "1px solid var(--io-border)",
            borderRadius: 4,
            padding: 16,
            textAlign: "center",
            background: "var(--io-surface-elevated)",
          }}
        >
          <img
            src={svgToDataUri(displaySvg)}
            width={144}
            height={144}
            alt="Generated shape SVG preview"
            style={{
              border: "1px dashed var(--io-accent)",
              display: "inline-block",
            }}
          />
        </div>
        <p style={{ margin: 0, fontSize: 11, color: "var(--io-text-muted)" }}>
          Bounding box: {groupAnalysis.bboxW.toFixed(1)} x{" "}
          {groupAnalysis.bboxH.toFixed(1)} units |{" "}
          {groupAnalysis.geometryNodes.length} geometry element
          {groupAnalysis.geometryNodes.length !== 1 ? "s" : ""}
        </p>
      </div>
    );
  }

  function renderGroupStep2_ValueAnchors() {
    if (!groupAnalysis) return null;
    const bboxW = groupAnalysis.bboxW;
    const bboxH = groupAnalysis.bboxH;
    const PREVIEW_SIZE = 144;

    const dotR = Math.max(bboxW, bboxH) * 0.045;
    const labelFontSize = Math.max(bboxW, bboxH) * 0.07;

    function onAnchorMouseDown(e: React.MouseEvent, idx: number) {
      e.preventDefault();
      e.stopPropagation();
      draggingAnchorIdx.current = idx;
    }

    function onOverlayMouseMove(e: React.MouseEvent<SVGSVGElement>) {
      if (draggingAnchorIdx.current === null) return;
      const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
      const rawX = (e.clientX - rect.left) / rect.width;
      const rawY = (e.clientY - rect.top) / rect.height;
      const x = parseFloat((Math.max(0, Math.min(1, rawX)) * bboxW).toFixed(2));
      const y = parseFloat((Math.max(0, Math.min(1, rawY)) * bboxH).toFixed(2));
      const idx = draggingAnchorIdx.current;
      setGroupValueAnchors((prev) => {
        const next = [...prev];
        next[idx] = { ...next[idx], x, y };
        return next;
      });
    }

    function onOverlayMouseUp() {
      draggingAnchorIdx.current = null;
    }

    // Render background shape outline as a plain SVG (no user content, safe)
    const bgSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${bboxW} ${bboxH}"><rect width="${bboxW}" height="${bboxH}" fill="none" stroke="#3b82f6" stroke-width="0.5" stroke-dasharray="3 2"/></svg>`;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <p
          style={{
            margin: 0,
            fontSize: 12,
            color: "var(--io-text-secondary)",
            lineHeight: 1.5,
          }}
        >
          Value anchors have been auto-generated from the group's display
          elements. Drag the dots on the preview to adjust positions, rename
          labels, or delete unwanted anchors.
        </p>

        {groupValueAnchors.length === 0 && (
          <p style={{ margin: 0, fontSize: 12, color: "var(--io-text-muted)" }}>
            No display elements found in this group — no value anchors will be
            created.
          </p>
        )}

        {groupValueAnchors.length > 0 && (
          <div style={{ display: "flex", gap: 12 }}>
            <SvgPreviewWithOverlay
              svgString={bgSvg}
              viewBox={groupViewBox}
              width={PREVIEW_SIZE}
              height={PREVIEW_SIZE}
              onSvgRef={(el) => {
                overlaySvgRef.current = el;
              }}
              onMouseMove={onOverlayMouseMove}
              onMouseUp={onOverlayMouseUp}
              onMouseLeave={onOverlayMouseUp}
              overlayChildren={
                <>
                  {groupValueAnchors.map((anchor, i) => (
                    <g key={anchor.id}>
                      <circle
                        cx={anchor.x}
                        cy={anchor.y}
                        r={dotR}
                        fill="var(--io-success, #22c55e)"
                        stroke="white"
                        strokeWidth="0.5"
                        style={{ cursor: "grab" }}
                        onMouseDown={(e) => onAnchorMouseDown(e, i)}
                      />
                      <text
                        x={anchor.x + dotR * 1.2}
                        y={anchor.y - dotR * 0.5}
                        fontSize={labelFontSize}
                        fill="var(--io-text-primary)"
                        style={{ pointerEvents: "none", userSelect: "none" }}
                      >
                        {anchor.label}
                      </text>
                    </g>
                  ))}
                </>
              }
            />

            <div style={{ flex: 1, overflow: "auto", maxHeight: 200 }}>
              {groupValueAnchors.map((anchor, i) => (
                <div
                  key={anchor.id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                    marginBottom: 10,
                    paddingBottom: 8,
                    borderBottom: "1px solid var(--io-border)",
                  }}
                >
                  <div
                    style={{ display: "flex", gap: 4, alignItems: "center" }}
                  >
                    <input
                      value={anchor.label}
                      style={{ ...inputStyle, flex: 1 }}
                      placeholder="Label"
                      onChange={(e) => {
                        const val = e.target.value;
                        setGroupValueAnchors((prev) => {
                          const next = [...prev];
                          next[i] = { ...next[i], label: val };
                          return next;
                        });
                      }}
                    />
                    <button
                      onClick={() =>
                        setGroupValueAnchors((prev) =>
                          prev.filter((_, j) => j !== i),
                        )
                      }
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--io-text-muted)",
                        cursor: "pointer",
                        fontSize: 14,
                      }}
                    >
                      x
                    </button>
                  </div>
                  <select
                    value={anchor.defaultDisplayType}
                    style={inputStyle}
                    onChange={(e) => {
                      const val = e.target.value;
                      setGroupValueAnchors((prev) => {
                        const next = [...prev];
                        next[i] = { ...next[i], defaultDisplayType: val };
                        return next;
                      });
                    }}
                  >
                    <option value="text_readout">Text Readout (Value)</option>
                    <option value="analog_bar">Analog Bar (Measurement)</option>
                    <option value="fill_gauge">Fill Gauge (Level)</option>
                    <option value="sparkline">Sparkline (Trend)</option>
                    <option value="alarm_indicator">Alarm Indicator</option>
                    <option value="digital_status">Digital Status</option>
                  </select>
                  <span style={{ fontSize: 10, color: "var(--io-text-muted)" }}>
                    Position: ({anchor.x.toFixed(1)}, {anchor.y.toFixed(1)})
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Standard step renderers
  // ---------------------------------------------------------------------------

  function renderNameAndCategory() {
    const allCategories = [
      ...SHAPE_CATEGORIES,
      ...(state.newCategoryInput ? [state.newCategoryInput] : []),
    ];
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label="Shape ID Prefix *">
          <input
            type="text"
            value={state.shapeIdPrefix}
            onChange={(e) =>
              updateState({
                shapeIdPrefix: e.target.value
                  .replace(/\s+/g, "-")
                  .toLowerCase(),
              })
            }
            placeholder="e.g., wet-gas-scrubber"
            style={inputStyle}
          />
          <span style={{ fontSize: 10, color: "var(--io-text-muted)" }}>
            System appends .custom.&lt;id&gt; automatically
          </span>
        </Field>
        <Field label="Display Name *">
          <input
            type="text"
            value={state.displayName}
            onChange={(e) => {
              updateState({
                displayName: e.target.value,
                shapeIdPrefix:
                  state.shapeIdPrefix ||
                  e.target.value.replace(/\s+/g, "-").toLowerCase(),
              });
            }}
            placeholder="Wet Gas Scrubber"
            style={inputStyle}
          />
        </Field>
        <Field label="Category">
          <select
            value={state.category}
            onChange={(e) => {
              if (e.target.value === "__new__") {
                updateState({
                  category: state.newCategoryInput || "New Category",
                });
              } else {
                updateState({ category: e.target.value });
              }
            }}
            style={inputStyle}
          >
            {allCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            <option value="__new__">New Category...</option>
          </select>
          {!SHAPE_CATEGORIES.includes(state.category) && (
            <input
              type="text"
              value={state.newCategoryInput}
              onChange={(e) =>
                updateState({
                  newCategoryInput: e.target.value,
                  category: e.target.value,
                })
              }
              placeholder="New category name"
              style={{ ...inputStyle, marginTop: 4 }}
            />
          )}
        </Field>
        <Field label="Tags">
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 4,
              marginBottom: 4,
            }}
          >
            {state.tags.map((tag, i) => (
              <span
                key={i}
                style={{
                  background: "var(--io-surface-elevated)",
                  border: "1px solid var(--io-border)",
                  borderRadius: 10,
                  padding: "2px 8px",
                  fontSize: 11,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                {tag}
                <button
                  onClick={() =>
                    updateState({ tags: state.tags.filter((_, j) => j !== i) })
                  }
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--io-text-muted)",
                    fontSize: 12,
                    padding: 0,
                    lineHeight: 1,
                  }}
                >
                  x
                </button>
              </span>
            ))}
          </div>
          <input
            type="text"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => {
              if ((e.key === "Enter" || e.key === ",") && tagInput.trim()) {
                e.preventDefault();
                updateState({ tags: [...state.tags, tagInput.trim()] });
                setTagInput("");
              }
            }}
            placeholder="scrubber, gas, wash -- press Enter to add"
            style={inputStyle}
          />
        </Field>
      </div>
    );
  }

  function renderBoundaryAndSizing() {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <p
          style={{
            margin: 0,
            fontSize: 12,
            color: "var(--io-text-secondary)",
            lineHeight: 1.5,
          }}
        >
          The selected elements will be normalized to a{" "}
          <strong>48x48 viewBox</strong>, matching the built-in shape library
          convention.
        </p>
        <div
          style={{
            border: "1px solid var(--io-border)",
            borderRadius: 4,
            padding: 16,
            textAlign: "center",
            background: "var(--io-surface-elevated)",
          }}
        >
          <svg
            width="96"
            height="96"
            viewBox={VIEWBOX}
            style={{
              border: "1px dashed var(--io-accent)",
              background: "var(--io-surface)",
            }}
          >
            <rect
              x="8"
              y="8"
              width="32"
              height="32"
              fill="var(--io-accent)"
              fillOpacity="0.2"
              stroke="var(--io-accent)"
              strokeWidth="1"
              rx="2"
            />
            <text
              x="24"
              y="26"
              textAnchor="middle"
              fontSize="5"
              fill="var(--io-text-primary)"
            >
              {selectedNodes.length} node{selectedNodes.length !== 1 ? "s" : ""}
            </text>
          </svg>
          <p
            style={{
              margin: "8px 0 0",
              fontSize: 11,
              color: "var(--io-text-muted)",
            }}
          >
            Elements: {selectedNodes.map((n) => n.name ?? n.type).join(", ")}
          </p>
        </div>
        <label
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={state.boundingBoxConfirmed}
            onChange={(e) =>
              updateState({ boundingBoxConfirmed: e.target.checked })
            }
          />
          Bounding box looks correct -- proceed with normalization
        </label>
      </div>
    );
  }

  function renderConnectionPoints() {
    const vb = isGroupSource && groupAnalysis ? groupViewBox : VIEWBOX;
    const previewW = isGroupSource && groupAnalysis ? groupAnalysis.bboxW : 48;
    const previewH = isGroupSource && groupAnalysis ? groupAnalysis.bboxH : 48;
    const dotR = Math.max(previewW, previewH) * 0.05;
    const labelFontSize = Math.max(previewW, previewH) * 0.07;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <p
          style={{
            margin: 0,
            fontSize: 12,
            color: "var(--io-text-secondary)",
            lineHeight: 1.5,
          }}
        >
          {isGroupSource
            ? "Connection points have been pre-populated from pipes with dangling endpoints. Add, move, or remove as needed."
            : "Click on the shape preview to place connection points. Each point gets an ID, direction, and type."}
        </p>
        <div style={{ display: "flex", gap: 12 }}>
          <svg
            ref={svgPreviewRef}
            width="144"
            height="144"
            viewBox={vb}
            style={{
              border: "1px solid var(--io-border)",
              background: "var(--io-surface-elevated)",
              cursor: "crosshair",
              flexShrink: 0,
            }}
            onClick={(e) => {
              const rect = svgPreviewRef.current?.getBoundingClientRect();
              if (!rect) return;
              const scaleX = previewW / rect.width;
              const scaleY = previewH / rect.height;
              const x = Math.round((e.clientX - rect.left) * scaleX);
              const y = Math.round((e.clientY - rect.top) * scaleY);
              const newCp: CPDraft = {
                id: `cp${state.connectionPoints.length + 1}`,
                x,
                y,
                direction: "right",
                type: "process",
                rotatesWithShape: true,
              };
              updateState({
                connectionPoints: [...state.connectionPoints, newCp],
              });
            }}
          >
            <rect
              x="0"
              y="0"
              width={previewW}
              height={previewH}
              fill="var(--io-accent)"
              fillOpacity="0.1"
              stroke="var(--io-accent)"
              strokeWidth="0.5"
              rx="1"
            />
            {state.connectionPoints.map((cp, i) => (
              <g key={i}>
                <circle
                  cx={cp.x}
                  cy={cp.y}
                  r={dotR}
                  fill="var(--io-accent)"
                  stroke="white"
                  strokeWidth="0.5"
                />
                <text
                  x={cp.x + dotR * 1.2}
                  y={cp.y - dotR * 0.4}
                  fontSize={labelFontSize}
                  fill="var(--io-text-primary)"
                >
                  {cp.id}
                </text>
              </g>
            ))}
          </svg>
          <div style={{ flex: 1, overflow: "auto", maxHeight: 160 }}>
            {state.connectionPoints.length === 0 && (
              <p
                style={{
                  fontSize: 11,
                  color: "var(--io-text-muted)",
                  margin: 0,
                }}
              >
                Click the shape to add connection points.
              </p>
            )}
            {state.connectionPoints.map((cp, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: 4,
                  marginBottom: 6,
                  alignItems: "center",
                  fontSize: 11,
                }}
              >
                <input
                  value={cp.id}
                  placeholder="id"
                  style={{ ...inputStyle, width: 60 }}
                  onChange={(e) => {
                    const pts = [...state.connectionPoints];
                    pts[i] = { ...pts[i], id: e.target.value };
                    updateState({ connectionPoints: pts });
                  }}
                />
                <select
                  value={cp.direction}
                  style={{ ...inputStyle, width: 64 }}
                  onChange={(e) => {
                    const pts = [...state.connectionPoints];
                    pts[i] = {
                      ...pts[i],
                      direction: e.target.value as Direction,
                    };
                    updateState({ connectionPoints: pts });
                  }}
                >
                  {DIRECTIONS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
                <select
                  value={cp.type}
                  style={{ ...inputStyle, width: 72 }}
                  onChange={(e) => {
                    const pts = [...state.connectionPoints];
                    pts[i] = {
                      ...pts[i],
                      type: e.target.value as ConnectionType,
                    };
                    updateState({ connectionPoints: pts });
                  }}
                >
                  {CP_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() =>
                    updateState({
                      connectionPoints: state.connectionPoints.filter(
                        (_, j) => j !== i,
                      ),
                    })
                  }
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--io-text-muted)",
                    cursor: "pointer",
                    fontSize: 14,
                    padding: "0 2px",
                  }}
                >
                  x
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  function renderStatefulElements() {
    const ALL_STATES = [
      "normal",
      "running",
      "stopped",
      "open",
      "closed",
      "transitioning",
      "fault",
      "manual",
      "out_of_service",
    ];
    const STATE_LABELS: Record<string, string> = {
      normal: "Normal",
      running: "Running",
      stopped: "Stopped",
      open: "Open",
      closed: "Closed",
      transitioning: "Transitioning",
      fault: "Fault",
      manual: "Manual",
      out_of_service: "Out of Service",
    };
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <div>
          <p
            style={{
              margin: "0 0 8px",
              fontSize: 12,
              color: "var(--io-text-secondary)",
              lineHeight: 1.5,
              fontWeight: 500,
            }}
          >
            Supported operational states:
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {ALL_STATES.map((s) => (
              <label
                key={s}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 12,
                  cursor: s === "normal" ? "default" : "pointer",
                  color:
                    s === "normal"
                      ? "var(--io-text-muted)"
                      : "var(--io-text-primary)",
                }}
              >
                <input
                  type="checkbox"
                  checked={state.supportedStates.includes(s)}
                  disabled={s === "normal"}
                  onChange={(e) => {
                    if (s === "normal") return;
                    const states = e.target.checked
                      ? [...state.supportedStates, s]
                      : state.supportedStates.filter((st) => st !== s);
                    updateState({ supportedStates: states });
                  }}
                />
                {STATE_LABELS[s]}
              </label>
            ))}
          </div>
        </div>
        <div>
          <p
            style={{
              margin: "0 0 8px",
              fontSize: 12,
              color: "var(--io-text-secondary)",
              lineHeight: 1.5,
              fontWeight: 500,
            }}
          >
            Stateful SVG element IDs:
          </p>
          <p
            style={{
              margin: "0 0 8px",
              fontSize: 11,
              color: "var(--io-text-muted)",
            }}
          >
            Enter element IDs from your SVG. If left empty, the shape is purely
            structural.
          </p>
          {state.statefulElements.map((el, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                gap: 6,
                alignItems: "center",
                marginBottom: 4,
              }}
            >
              <input
                value={el}
                style={{ ...inputStyle, flex: 1 }}
                placeholder="SVG element ID"
                onChange={(e) => {
                  const els = [...state.statefulElements];
                  els[i] = e.target.value;
                  updateState({ statefulElements: els });
                }}
              />
              <button
                onClick={() =>
                  updateState({
                    statefulElements: state.statefulElements.filter(
                      (_, j) => j !== i,
                    ),
                  })
                }
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--io-text-muted)",
                  cursor: "pointer",
                  fontSize: 14,
                }}
              >
                x
              </button>
            </div>
          ))}
          <button
            onClick={() =>
              updateState({ statefulElements: [...state.statefulElements, ""] })
            }
            style={addBtnStyle}
          >
            + Add Element ID
          </button>
        </div>
      </div>
    );
  }

  function renderTextZones() {
    const vb = isGroupSource && groupAnalysis ? groupViewBox : VIEWBOX;
    const previewW = isGroupSource && groupAnalysis ? groupAnalysis.bboxW : 48;
    const previewH = isGroupSource && groupAnalysis ? groupAnalysis.bboxH : 48;
    const dotR = Math.max(previewW, previewH) * 0.04;
    const labelFontSize = Math.max(previewW, previewH) * 0.07;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <p
          style={{
            margin: 0,
            fontSize: 12,
            color: "var(--io-text-secondary)",
            lineHeight: 1.5,
          }}
        >
          {isGroupSource
            ? "Text zones have been pre-populated from the group's text blocks. Click to add more."
            : "Click on the shape preview to place text zone anchors."}
        </p>
        <div style={{ display: "flex", gap: 12 }}>
          <svg
            width="144"
            height="144"
            viewBox={vb}
            style={{
              border: "1px solid var(--io-border)",
              background: "var(--io-surface-elevated)",
              cursor: "crosshair",
              flexShrink: 0,
            }}
            onClick={(e) => {
              const rect = (
                e.currentTarget as SVGSVGElement
              ).getBoundingClientRect();
              const scaleX = previewW / rect.width;
              const scaleY = previewH / rect.height;
              const x = Math.round((e.clientX - rect.left) * scaleX);
              const y = Math.round((e.clientY - rect.top) * scaleY);
              const tz: TextZone = {
                id: `tz${state.textZones.length + 1}`,
                x,
                y,
                width: 40,
                anchor: "middle",
                fontSize: 8,
              };
              updateState({ textZones: [...state.textZones, tz] });
            }}
          >
            <rect
              x="0"
              y="0"
              width={previewW}
              height={previewH}
              fill="var(--io-accent)"
              fillOpacity="0.1"
              stroke="var(--io-accent)"
              strokeWidth="0.5"
              rx="1"
            />
            {state.textZones.map((tz, i) => (
              <g key={i}>
                <circle
                  cx={tz.x ?? 24}
                  cy={tz.y ?? 24}
                  r={dotR}
                  fill="var(--io-warning)"
                />
                <text
                  x={(tz.x ?? 24) + dotR * 1.2}
                  y={(tz.y ?? 24) - dotR * 0.4}
                  fontSize={labelFontSize}
                  fill="var(--io-text-primary)"
                >
                  {tz.id}
                </text>
              </g>
            ))}
          </svg>
          <div style={{ flex: 1, fontSize: 11, color: "var(--io-text-muted)" }}>
            {state.textZones.length === 0 && (
              <p style={{ margin: 0 }}>Click to add text zones.</p>
            )}
            {state.textZones.map((tz, i) => (
              <div
                key={i}
                style={{
                  marginBottom: 4,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <span style={{ color: "var(--io-text-primary)" }}>{tz.id}</span>
                <span>
                  ({tz.x},{tz.y})
                </span>
                <button
                  onClick={() =>
                    updateState({
                      textZones: state.textZones.filter((_, j) => j !== i),
                    })
                  }
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--io-text-muted)",
                    cursor: "pointer",
                    fontSize: 14,
                  }}
                >
                  x
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  function renderValueDisplayAnchors() {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <p
          style={{
            margin: 0,
            fontSize: 12,
            color: "var(--io-text-secondary)",
            lineHeight: 1.5,
          }}
        >
          Click on the shape preview to place value display anchor positions
          (Quick Bind positions).
        </p>
        <div style={{ display: "flex", gap: 12 }}>
          <svg
            width="144"
            height="144"
            viewBox={VIEWBOX}
            style={{
              border: "1px solid var(--io-border)",
              background: "var(--io-surface-elevated)",
              cursor: "crosshair",
              flexShrink: 0,
            }}
            onClick={(e) => {
              const rect = (
                e.currentTarget as SVGSVGElement
              ).getBoundingClientRect();
              const nx = parseFloat(
                ((e.clientX - rect.left) / rect.width).toFixed(2),
              );
              const ny = parseFloat(
                ((e.clientY - rect.top) / rect.height).toFixed(2),
              );
              const va: ValueAnchor = { nx, ny };
              updateState({ valueAnchors: [...state.valueAnchors, va] });
            }}
          >
            <rect
              x="8"
              y="8"
              width="32"
              height="32"
              fill="var(--io-accent)"
              fillOpacity="0.1"
              stroke="var(--io-accent)"
              strokeWidth="1"
              rx="2"
            />
            {state.valueAnchors.map((va, i) => {
              const px = (va.nx ?? 0.5) * 48;
              const py = (va.ny ?? 0.5) * 48;
              return (
                <g key={i}>
                  <rect
                    x={px - 2}
                    y={py - 1.5}
                    width="4"
                    height="3"
                    fill="none"
                    stroke="var(--io-success)"
                    strokeWidth="0.7"
                  />
                  <text
                    x={px + 3}
                    y={py - 0.5}
                    fontSize="3"
                    fill="var(--io-text-muted)"
                  >
                    {i + 1}
                  </text>
                </g>
              );
            })}
          </svg>
          <div style={{ flex: 1, fontSize: 11, color: "var(--io-text-muted)" }}>
            {state.valueAnchors.length === 0 && (
              <p style={{ margin: 0 }}>Click to add value anchors.</p>
            )}
            {state.valueAnchors.map((va, i) => (
              <div
                key={i}
                style={{
                  marginBottom: 4,
                  display: "flex",
                  gap: 4,
                  alignItems: "center",
                }}
              >
                <span style={{ color: "var(--io-text-primary)" }}>
                  Anchor {i + 1}
                </span>
                <span>
                  ({va.nx?.toFixed(2)}, {va.ny?.toFixed(2)})
                </span>
                <button
                  onClick={() =>
                    updateState({
                      valueAnchors: state.valueAnchors.filter(
                        (_, j) => j !== i,
                      ),
                    })
                  }
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--io-text-muted)",
                    cursor: "pointer",
                    fontSize: 14,
                  }}
                >
                  x
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  function renderOrientationAndMirror() {
    const allOrientations = [0, 90, 180, 270];
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <Field label="Valid Orientations">
          <div style={{ display: "flex", gap: 12 }}>
            {allOrientations.map((deg) => (
              <label
                key={deg}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={state.orientations.includes(deg)}
                  onChange={(e) => {
                    const ors = e.target.checked
                      ? [...state.orientations, deg]
                      : state.orientations.filter((o) => o !== deg);
                    if (ors.length === 0) return;
                    updateState({ orientations: ors });
                  }}
                />
                {deg} deg
              </label>
            ))}
          </div>
        </Field>
        <Field label="Mirror">
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={state.mirrorable}
              onChange={(e) => updateState({ mirrorable: e.target.checked })}
            />
            Can be mirrored horizontally/vertically
          </label>
        </Field>
      </div>
    );
  }

  function renderPreviewAndSave() {
    const shapeId = `${state.shapeIdPrefix}.custom`;
    const effectiveAnchorCount = isGroupSource
      ? groupValueAnchors.length
      : state.valueAnchors.length;
    const effectiveTextZoneCount = isGroupSource
      ? groupTextZonesState.length
      : state.textZones.length;

    // Build a simple preview SVG for the standard-flow case
    const previewSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEWBOX}"><rect x="8" y="8" width="32" height="32" fill="#3b82f6" fill-opacity="0.15" stroke="#3b82f6" stroke-width="1" rx="2"/></svg>`;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 8,
            fontSize: 12,
          }}
        >
          <SummaryRow label="Shape ID" value={shapeId} />
          <SummaryRow label="Display Name" value={state.displayName} />
          <SummaryRow label="Category" value={state.category} />
          <SummaryRow
            label="Orientations"
            value={state.orientations.map((o) => o + " deg").join(", ")}
          />
          <SummaryRow
            label="Connection Points"
            value={String(state.connectionPoints.length)}
          />
          <SummaryRow
            label="Text Zones"
            value={String(effectiveTextZoneCount)}
          />
          <SummaryRow
            label="Value Anchors"
            value={String(effectiveAnchorCount)}
          />
          <SummaryRow
            label="Mirrorable"
            value={state.mirrorable ? "Yes" : "No"}
          />
          <SummaryRow
            label="Supported States"
            value={state.supportedStates.join(", ")}
          />
          {state.tags.length > 0 && (
            <SummaryRow label="Tags" value={state.tags.join(", ")} />
          )}
          {isGroupSource && <SummaryRow label="Source" value="Group" />}
        </div>

        {/* SVG preview */}
        <div
          style={{
            marginTop: 8,
            padding: 12,
            background: "var(--io-surface-elevated)",
            borderRadius: 4,
            border: "1px solid var(--io-border)",
            display: "flex",
            justifyContent: "center",
          }}
        >
          <img
            src={svgToDataUri(
              isGroupSource && groupSvg ? groupSvg : previewSvg,
            )}
            width={120}
            height={120}
            alt="Shape preview"
            style={{ border: "1px dashed var(--io-accent)" }}
          />
        </div>

        {/* Replace group toggle (group source only) */}
        {isGroupSource && groupNode && (
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontSize: 12,
              cursor: "pointer",
              padding: "8px 10px",
              background: "var(--io-surface-elevated)",
              borderRadius: 4,
              border: "1px solid var(--io-border)",
            }}
          >
            <input
              type="checkbox"
              checked={replaceGroupWithShape}
              onChange={(e) => setReplaceGroupWithShape(e.target.checked)}
            />
            Replace group in current graphic with this shape
          </label>
        )}

        {error && (
          <div
            style={{
              padding: "8px 10px",
              background: "rgba(239,68,68,0.1)",
              border: "1px solid var(--io-alarm-high)",
              borderRadius: 4,
              color: "var(--io-alarm-high)",
              fontSize: 12,
            }}
          >
            {error}
          </div>
        )}
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Step routing
  // ---------------------------------------------------------------------------

  const groupStepRenderers = [
    renderGroupStep0_SourceAnalysis,
    renderGroupStep1_SvgPreview,
    renderGroupStep2_ValueAnchors,
    renderNameAndCategory,
    renderConnectionPoints,
    renderTextZones,
    renderOrientationAndMirror,
    renderPreviewAndSave,
  ];

  const standardStepRenderers = [
    renderNameAndCategory,
    renderBoundaryAndSizing,
    renderConnectionPoints,
    renderStatefulElements,
    renderTextZones,
    renderValueDisplayAnchors,
    renderOrientationAndMirror,
    renderPreviewAndSave,
  ];

  const stepRenderers = isGroupSource
    ? groupStepRenderers
    : standardStepRenderers;

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  function canAdvance(): boolean {
    if (isGroupSource) {
      if (step === 0) {
        const widgetCount = groupAnalysis?.widgets.length ?? 0;
        if (widgetCount > 0 && !widgetWarningDismissed) return false;
        return true;
      }
      // Step 3 in group flow = Name & Category
      if (step === 3)
        return (
          state.shapeIdPrefix.trim().length > 0 &&
          state.displayName.trim().length > 0
        );
      return true;
    }
    if (step === 0)
      return (
        state.shapeIdPrefix.trim().length > 0 &&
        state.displayName.trim().length > 0
      );
    if (step === 1) return state.boundingBoxConfirmed;
    return true;
  }

  async function handleFinish() {
    setSaving(true);
    setError(null);
    try {
      // Build effective value anchors (normalized nx/ny)
      const effectiveValueAnchors: ValueAnchor[] = isGroupSource
        ? groupValueAnchors.map((ga) => ({
            nx: parseFloat((ga.x / (groupAnalysis?.bboxW ?? 48)).toFixed(4)),
            ny: parseFloat((ga.y / (groupAnalysis?.bboxH ?? 48)).toFixed(4)),
            preferredElement: ga.defaultDisplayType,
          }))
        : state.valueAnchors;

      const effectiveTextZones: TextZone[] = isGroupSource
        ? groupTextZonesState.map((gz, i) => ({
            id: `tz${i + 1}`,
            x: gz.x,
            y: gz.y,
            width: 40,
            anchor: "middle" as const,
            fontSize: 8,
          }))
        : state.textZones;

      const svgViewBox =
        isGroupSource && groupAnalysis
          ? `0 0 ${groupAnalysis.bboxW.toFixed(2)} ${groupAnalysis.bboxH.toFixed(2)}`
          : VIEWBOX;

      const svgWidth =
        isGroupSource && groupAnalysis ? groupAnalysis.bboxW : 48;
      const svgHeight =
        isGroupSource && groupAnalysis ? groupAnalysis.bboxH : 48;

      const svgData =
        isGroupSource && groupSvg
          ? groupSvg
          : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEWBOX}"><rect x="8" y="8" width="32" height="32" fill="var(--io-accent)" fill-opacity="0.2" stroke="var(--io-accent)" stroke-width="1" rx="2"/></svg>`;

      const sidecar = {
        id: `${state.shapeIdPrefix}.custom`,
        category: state.category,
        tags: state.tags,
        geometry: {
          viewBox: svgViewBox,
          width: svgWidth,
          height: svgHeight,
          orientations: state.orientations,
          mirrorable: state.mirrorable,
        },
        connections: state.connectionPoints,
        textZones: effectiveTextZones,
        valueAnchors: effectiveValueAnchors,
        supportedStates: state.supportedStates,
        statefulElements: state.statefulElements.filter(Boolean),
        // Group-source extended fields stored in sidecar for placement
        ...(isGroupSource && {
          sourceType: "group" as const,
          groupAnchors: groupValueAnchors,
          groupTextZones: groupTextZonesState,
        }),
      };

      const result = await graphicsApi.createStencil({
        name: state.displayName,
        category: state.category,
        svgData,
        nodes: { type: "shape", sidecar, nodes: selectedNodes },
      });
      if (!result.success) throw new Error(result.error.message);

      const newShapeId = result.data.data.id;

      // If group-source and toggle is on, call replace callback (DesignerCanvas handles the command)
      if (
        isGroupSource &&
        replaceGroupWithShape &&
        sourceNodeId &&
        onReplaceGroup
      ) {
        onReplaceGroup(sourceNodeId, newShapeId);
      }

      onSaved(newShapeId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
      setSaving(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <>
      <div
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.5)",
          zIndex: 2000,
        }}
        onClick={onClose}
      />
      <div
        style={{
          position: "fixed",
          left: "50%",
          top: "50%",
          transform: "translate(-50%,-50%)",
          zIndex: 2001,
          background: "var(--io-surface)",
          border: "1px solid var(--io-border)",
          borderRadius: "var(--io-radius-lg)",
          boxShadow: "var(--io-shadow-lg)",
          width: 520,
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid var(--io-border)",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: "var(--io-text-primary)",
              }}
            >
              Promote to Shape
            </span>
            {isGroupSource && (
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 400,
                  color: "var(--io-text-muted)",
                  background: "var(--io-surface-elevated)",
                  border: "1px solid var(--io-border)",
                  borderRadius: 10,
                  padding: "1px 8px",
                }}
              >
                Group source
              </span>
            )}
          </div>
          <div
            style={{
              fontSize: 11,
              color: "var(--io-text-muted)",
              marginTop: 4,
            }}
          >
            Step {step + 1} of {STEP_TITLES.length}: {STEP_TITLES[step]}
          </div>
          {/* Step progress dots */}
          <div style={{ display: "flex", gap: 4, marginTop: 10 }}>
            {STEP_TITLES.map((_, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: 3,
                  borderRadius: 2,
                  background:
                    i === step
                      ? "var(--io-accent)"
                      : i < step
                        ? "var(--io-accent-muted, #3b82f6)"
                        : "var(--io-border)",
                }}
              />
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: "16px 20px", flex: 1, overflow: "auto" }}>
          {stepRenderers[step]()}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "12px 20px",
            borderTop: "1px solid var(--io-border)",
            display: "flex",
            justifyContent: "flex-end",
            gap: 8,
            flexShrink: 0,
          }}
        >
          <button onClick={onClose} style={cancelBtnStyle}>
            Cancel
          </button>
          {step > 0 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              style={cancelBtnStyle}
            >
              Back
            </button>
          )}
          {step < STEP_TITLES.length - 1 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              disabled={!canAdvance()}
              style={{ ...primaryBtnStyle, opacity: canAdvance() ? 1 : 0.5 }}
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={saving}
              style={{ ...primaryBtnStyle, opacity: saving ? 0.7 : 1 }}
            >
              {saving ? "Saving..." : "Save Shape"}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Helper components & styles
// ---------------------------------------------------------------------------

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label
        style={{
          fontSize: 11,
          color: "var(--io-text-secondary)",
          display: "block",
          marginBottom: 4,
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span
        style={{
          fontSize: 10,
          color: "var(--io-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 12, color: "var(--io-text-primary)" }}>
        {value || "--"}
      </span>
    </div>
  );
}

function SummaryCard({
  icon,
  count,
  text,
  detail,
}: {
  icon: "checkmark" | "warning";
  count: number;
  text: string;
  detail: string;
}) {
  const plural = count !== 1 ? "s" : "";
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 8,
        padding: "8px 10px",
        background:
          icon === "warning"
            ? "rgba(234,179,8,0.08)"
            : "var(--io-surface-elevated)",
        border: `1px solid ${icon === "warning" ? "var(--io-warning)" : "var(--io-border)"}`,
        borderRadius: 4,
        fontSize: 12,
      }}
    >
      <span
        style={{
          color:
            icon === "warning"
              ? "var(--io-warning)"
              : "var(--io-success, #22c55e)",
          fontWeight: 600,
          flexShrink: 0,
          marginTop: 1,
        }}
      >
        {icon === "checkmark" ? "\u2713" : "\u26A0"}
      </span>
      <div>
        <span style={{ color: "var(--io-text-primary)", fontWeight: 500 }}>
          {count} {text}
          {plural}
        </span>
        <span style={{ color: "var(--io-text-muted)", marginLeft: 6 }}>
          {detail}
        </span>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "6px 8px",
  background: "var(--io-surface-elevated)",
  border: "1px solid var(--io-border)",
  borderRadius: "var(--io-radius)",
  color: "var(--io-text-primary)",
  fontSize: 12,
  boxSizing: "border-box",
};

const addBtnStyle: React.CSSProperties = {
  fontSize: 11,
  padding: "4px 10px",
  background: "var(--io-surface-elevated)",
  border: "1px solid var(--io-border)",
  borderRadius: "var(--io-radius)",
  cursor: "pointer",
  color: "var(--io-text-primary)",
  alignSelf: "flex-start",
};

const cancelBtnStyle: React.CSSProperties = {
  padding: "6px 14px",
  background: "var(--io-surface-elevated)",
  border: "1px solid var(--io-border)",
  borderRadius: "var(--io-radius)",
  cursor: "pointer",
  fontSize: 13,
  color: "var(--io-text-primary)",
};

const primaryBtnStyle: React.CSSProperties = {
  padding: "6px 14px",
  background: "var(--io-accent)",
  border: "none",
  borderRadius: "var(--io-radius)",
  cursor: "pointer",
  fontSize: 13,
  color: "#fff",
};
