/**
 * renderNodeSvg.tsx
 *
 * Shared pure render functions for SceneNode types. Each function takes a node
 * and a context object, and returns React SVG elements.
 *
 * Used by both SceneRenderer (Console/Process) and DesignerCanvas (Designer)
 * to ensure visual parity across all rendering surfaces.
 *
 * These functions are pure — they have no hooks, no store access, no side effects.
 * The caller provides any needed context (transform strings, event handlers) via
 * the RenderContext parameter.
 *
 * DisplayElement rendering lives in renderDisplayElementSvg.tsx and is re-exported here.
 */

// Re-export display element rendering
export {
  renderDisplayElementSvg,
  renderTextReadoutSvg,
  renderAlarmIndicatorSvg,
  renderDigitalStatusSvg,
  renderAnalogBarSvg,
  renderSparklineSvg,
  renderFillGaugeSvg,
  renderPointNameLabelSvg,
  formatValue,
  formatDesignPlaceholder,
  renderAlarmShape,
  deFontToCss,
  ALARM_PRIORITY_NAMES,
  type DisplayElementRenderContext,
  type PointValueData,
} from "./renderDisplayElementSvg";

import React from "react";
import type {
  Primitive,
  TextBlock,
  Annotation,
  ImageNode,
  EmbeddedSvgNode,
  Stencil,
  WidgetNode,
  Pipe,
  SymbolInstance,
  Group,
  DisplayElement,
  SceneNode,
  SectionBreakConfig,
  HeaderConfig,
  FooterConfig,
  CalloutConfig,
  DimensionLineConfig,
  NorthArrowConfig,
  LegendConfig,
  BorderConfig,
} from "../types/graphics";
import { PIPE_SERVICE_COLORS } from "../types/graphics";
import type { ShapeSidecar } from "../types/shapes";
import { isInsideFillSidecar } from "./anchorSlots";
import { buildExteriorSidecarTransform } from "./nodeTransforms";

// ---------------------------------------------------------------------------
// RenderContext — passed by the caller (SceneRenderer or DesignerCanvas)
// ---------------------------------------------------------------------------

export interface RenderContext {
  /** SVG transform string for this node (caller computes via buildTransform / buildNodeTransform) */
  transform: string;
  /** Click handler for navigation links (optional) */
  onClick?: (e: React.MouseEvent) => void;
  /** CSS cursor style (optional — set for navigation links or designer interaction) */
  cursor?: string;
  /** LOD level for CSS-based visibility (optional — set by SceneRenderer for LOD-aware text) */
  dataLod?: string;
}

export interface StencilRenderContext extends RenderContext {
  /** Pre-fetched SVG content for the stencil, or null if not yet loaded */
  svgContent: string | null;
  /** Stencil display size */
  size: { width: number; height: number };
  /** Stencil display name (for loading placeholder) */
  displayName?: string;
}

export interface PipeRenderContext extends RenderContext {
  /** Canvas background color for triple-stroke insulation gap (SceneRenderer only) */
  canvasBgColor?: string;
}

export interface SymbolInstanceRenderContext extends RenderContext {
  /** Pre-fetched SVG content for the base shape (null if not yet loaded) */
  shapeSvg: string | null;
  /** Shape sidecar metadata (null if not yet loaded) */
  shapeSidecar: ShapeSidecar | null;
  /** Pre-fetched part shape data keyed by part shape ID (derived from addon.file) */
  partShapes: Map<string, { svg: string; sidecar: ShapeSidecar | null }>;
  /** Operational state CSS class (e.g., "io-running", "io-fault", "io-oos") */
  stateClass: string;
  /** State binding point ID for data-point-id attribute */
  statePointId?: string;
  /** Whether this node is selected (designer mode only) */
  isSelected?: boolean;
  /** Whether in designer mode (affects text zone placeholder display) */
  designerMode?: boolean;
  /** State binding point tag value (for text zone default text) */
  stateTag?: string;
  /** Callback to render a child display element (avoids circular dependency) */
  renderChild: (
    child: DisplayElement,
    parentOffset?: { x: number; y: number },
    vesselInteriorPath?: string,
    /** When set, use this pre-computed SVG transform string instead of deriving one from the
     * child's node transform. Passed for exterior sidecars to apply counter-rotation so
     * they keep their canvas position/orientation regardless of parent rotation. */
    overrideTransform?: string,
  ) => React.ReactElement | null;
}

export interface GroupRenderContext extends RenderContext {
  /** Callback to render each child node */
  renderChild: (child: SceneNode) => React.ReactElement | null;
}

// ---------------------------------------------------------------------------
// Primitive
// ---------------------------------------------------------------------------

export function renderPrimitiveSvg(
  node: Primitive,
  ctx: RenderContext,
): React.ReactElement | null {
  const { geometry, style } = node;
  const styleProps = {
    fill: style.fill,
    fillOpacity: style.fillOpacity,
    stroke: style.stroke,
    strokeWidth: style.strokeWidth,
    strokeDasharray: style.strokeDasharray,
    strokeLinecap: style.strokeLinecap,
    strokeLinejoin: style.strokeLinejoin,
  };

  let shape: React.ReactElement | null = null;
  switch (geometry.type) {
    case "rect":
      shape = (
        <rect
          width={geometry.width}
          height={geometry.height}
          rx={geometry.rx}
          ry={geometry.ry}
          {...styleProps}
        />
      );
      break;
    case "circle":
      shape = <circle r={geometry.r} {...styleProps} />;
      break;
    case "ellipse":
      shape = <ellipse rx={geometry.rx} ry={geometry.ry} {...styleProps} />;
      break;
    case "line":
      shape = (
        <line
          x1={geometry.x1}
          y1={geometry.y1}
          x2={geometry.x2}
          y2={geometry.y2}
          {...styleProps}
        />
      );
      break;
    case "polyline":
      shape = (
        <polyline
          points={geometry.points.map((p) => `${p.x},${p.y}`).join(" ")}
          {...styleProps}
        />
      );
      break;
    case "polygon":
      shape = (
        <polygon
          points={geometry.points.map((p) => `${p.x},${p.y}`).join(" ")}
          {...styleProps}
        />
      );
      break;
    case "path":
      shape = <path d={geometry.d} {...styleProps} />;
      break;
  }

  if (!shape) return null;
  return (
    <g
      key={node.id}
      transform={ctx.transform}
      opacity={node.opacity}
      data-node-id={node.id}
      data-canvas-x={String(Math.round(node.transform.position.x))}
      data-canvas-y={String(Math.round(node.transform.position.y))}
      onClick={ctx.onClick}
      style={ctx.cursor ? { cursor: ctx.cursor } : undefined}
    >
      {shape}
    </g>
  );
}

// ---------------------------------------------------------------------------
// TextBlock
// ---------------------------------------------------------------------------

export function renderTextBlockSvg(
  node: TextBlock,
  ctx: RenderContext,
): React.ReactElement {
  const bgPad = node.background?.padding ?? 0;
  const tbW = (node.maxWidth ?? 120) + bgPad * 2;
  const tbH = (node.fontSize ? node.fontSize * 1.4 : 20) + bgPad * 2;

  return (
    <g
      key={node.id}
      transform={ctx.transform}
      data-node-id={node.id}
      data-canvas-x={String(Math.round(node.transform.position.x))}
      data-canvas-y={String(Math.round(node.transform.position.y))}
      data-lod={ctx.dataLod}
      opacity={node.opacity}
      onClick={ctx.onClick}
      style={ctx.cursor ? { cursor: ctx.cursor } : undefined}
    >
      {node.background && (
        <rect
          x={0}
          y={0}
          width={tbW}
          height={tbH}
          rx={node.background.borderRadius ?? 2}
          fill={node.background.fill}
          stroke={node.background.stroke}
          strokeWidth={node.background.strokeWidth}
        />
      )}
      <text
        x={bgPad}
        y={bgPad}
        fontFamily={node.fontFamily}
        fontSize={node.fontSize}
        fontWeight={node.fontWeight}
        fontStyle={node.fontStyle}
        textAnchor={node.textAnchor}
        fill={node.fill}
        dominantBaseline="hanging"
      >
        {node.content}
      </text>
    </g>
  );
}

// ---------------------------------------------------------------------------
// Annotation
// ---------------------------------------------------------------------------

export function renderAnnotationSvg(
  node: Annotation,
  ctx: RenderContext,
): React.ReactElement | null {
  const cfg = node.config as unknown as Record<string, unknown>;
  const aw = (cfg.width as number) ?? 200;
  const ah = (cfg.height as number) ?? 20;

  switch (node.annotationType) {
    case "section_break": {
      const sbCfg = node.config as SectionBreakConfig;
      const thickness = sbCfg.thickness ?? 1.5;
      const color = sbCfg.color ?? "var(--io-accent)";
      const dasharray =
        sbCfg.style === "dotted" ? "2 4" : undefined;
      const isSpace = sbCfg.style === "space";
      return (
        <g
          key={node.id}
          transform={ctx.transform}
          data-node-id={node.id}
          data-canvas-x={String(Math.round(node.transform.position.x))}
          data-canvas-y={String(Math.round(node.transform.position.y))}
          opacity={node.opacity}
        >
          {isSpace ? (
            <rect x={0} y={0} width={aw} height={thickness} fill="none" />
          ) : (
            <line
              x1={0}
              y1={thickness / 2}
              x2={aw}
              y2={thickness / 2}
              stroke={color}
              strokeWidth={thickness}
              strokeLinecap="round"
              strokeDasharray={dasharray}
            />
          )}
        </g>
      );
    }
    case "page_break":
      return (
        <g
          key={node.id}
          transform={ctx.transform}
          data-node-id={node.id}
          data-canvas-x={String(Math.round(node.transform.position.x))}
          data-canvas-y={String(Math.round(node.transform.position.y))}
          opacity={node.opacity}
        >
          <line
            x1={0}
            y1={10}
            x2={aw}
            y2={10}
            stroke="#EF4444"
            strokeWidth={2}
            strokeLinecap="round"
            strokeDasharray="6 4"
          />
          <rect
            x={aw / 2 - 28}
            y={2}
            width={56}
            height={14}
            rx={2}
            fill="rgba(239,68,68,0.15)"
          />
          <text
            x={aw / 2}
            y={12}
            textAnchor="middle"
            fontSize={8}
            fill="#EF4444"
            fontWeight={600}
            fontFamily="Inter"
          >
            PAGE BREAK
          </text>
        </g>
      );
    case "header": {
      const hCfg = node.config as HeaderConfig;
      const hH = hCfg.height ?? 40;
      const hFs = hCfg.fontSize ?? 11;
      const hContent = hCfg.content ?? "Header";
      const hAnchor =
        hCfg.textAlign === "center"
          ? "middle"
          : hCfg.textAlign === "right"
            ? "end"
            : "start";
      const hTx =
        hCfg.textAlign === "center"
          ? aw / 2
          : hCfg.textAlign === "right"
            ? aw - 8
            : 8;
      return (
        <g
          key={node.id}
          transform={ctx.transform}
          data-node-id={node.id}
          data-canvas-x={String(Math.round(node.transform.position.x))}
          data-canvas-y={String(Math.round(node.transform.position.y))}
          opacity={node.opacity}
        >
          <rect
            x={0}
            y={0}
            width={aw}
            height={hH}
            rx={2}
            fill="rgba(59,130,246,0.1)"
            stroke="#3b82f6"
            strokeWidth={1}
          />
          <text
            x={hTx}
            y={hH / 2 + hFs * 0.35}
            textAnchor={hAnchor}
            fontSize={hFs}
            fill="#93c5fd"
            fontWeight={500}
            fontFamily="Inter"
          >
            {hContent}
          </text>
          <line
            x1={0}
            y1={hH}
            x2={aw}
            y2={hH}
            stroke="#3b82f6"
            strokeWidth={1}
            strokeDasharray="4 3"
          />
        </g>
      );
    }
    case "footer": {
      const fCfg = node.config as FooterConfig;
      const fH = fCfg.height ?? 40;
      const fFs = fCfg.fontSize ?? 11;
      const fContent = fCfg.content ?? "Footer";
      const fAnchor =
        fCfg.textAlign === "center"
          ? "middle"
          : fCfg.textAlign === "right"
            ? "end"
            : "start";
      const fTx =
        fCfg.textAlign === "center"
          ? aw / 2
          : fCfg.textAlign === "right"
            ? aw - 8
            : 8;
      return (
        <g
          key={node.id}
          transform={ctx.transform}
          data-node-id={node.id}
          data-canvas-x={String(Math.round(node.transform.position.x))}
          data-canvas-y={String(Math.round(node.transform.position.y))}
          opacity={node.opacity}
        >
          <line
            x1={0}
            y1={0}
            x2={aw}
            y2={0}
            stroke="#3b82f6"
            strokeWidth={1}
            strokeDasharray="4 3"
          />
          <rect
            x={0}
            y={0}
            width={aw}
            height={fH}
            rx={2}
            fill="rgba(59,130,246,0.1)"
            stroke="#3b82f6"
            strokeWidth={1}
          />
          <text
            x={fTx}
            y={fH / 2 + fFs * 0.35}
            textAnchor={fAnchor}
            fontSize={fFs}
            fill="#93c5fd"
            fontWeight={500}
            fontFamily="Inter"
          >
            {fContent}
          </text>
        </g>
      );
    }
    case "callout": {
      const cCfg = node.config as CalloutConfig;
      const cFs = cCfg.fontSize ?? 11;
      const cPad = cCfg.padding ?? 6;
      const annotStyle = node.annotationStyle ?? "note";
      const styleDefaults =
        annotStyle === "warning"
          ? {
              bg: "rgba(217,119,6,0.15)",
              border: "var(--io-status-warning)",
              fill: "#FDE68A",
            }
          : annotStyle === "info"
            ? {
                bg: "rgba(59,130,246,0.15)",
                border: "var(--io-accent)",
                fill: "#93C5FD",
              }
            : { bg: "#27272A", border: "#3F3F46", fill: "#F4F4F5" };
      const cBg = cCfg.backgroundColor ?? styleDefaults.bg;
      const cBorder = cCfg.borderColor ?? styleDefaults.border;
      const cFill = cCfg.fill ?? styleDefaults.fill;
      const cRx = cCfg.borderRadius ?? 4;
      const cText = cCfg.text ?? "";
      const cW = Math.max(60, cText.length * cFs * 0.6 + cPad * 2);
      const cH = cFs + cPad * 2;
      const tp = cCfg.targetPoint ?? { x: cW / 2, y: cH + 20 };
      return (
        <g
          key={node.id}
          transform={ctx.transform}
          data-node-id={node.id}
          data-canvas-x={String(Math.round(node.transform.position.x))}
          data-canvas-y={String(Math.round(node.transform.position.y))}
          opacity={node.opacity}
        >
          <line
            x1={cW / 2}
            y1={cH}
            x2={tp.x}
            y2={tp.y}
            stroke={cBorder}
            strokeWidth={1.5}
            strokeLinecap="round"
          />
          <circle cx={tp.x} cy={tp.y} r={3} fill={cBorder} />
          <rect
            x={0}
            y={0}
            width={cW}
            height={cH}
            rx={cRx}
            fill={cBg}
            stroke={cBorder}
            strokeWidth={1}
          />
          <text
            x={cPad}
            y={cPad + cFs * 0.8}
            fontSize={cFs}
            fill={cFill}
            fontFamily="Inter"
          >
            {cText}
          </text>
        </g>
      );
    }
    case "dimension_line": {
      const dCfg = node.config as DimensionLineConfig;
      const dColor = dCfg.color ?? "#A1A1AA";
      const dFs = dCfg.fontSize ?? 9;
      const sp = dCfg.startPoint ?? { x: 0, y: 0 };
      const ep = dCfg.endPoint ?? { x: 100, y: 0 };
      const offset = dCfg.offset ?? 16;
      const dist = Math.round(Math.hypot(ep.x - sp.x, ep.y - sp.y));
      const label = dCfg.label ?? `${dist}`;
      const mx = (sp.x + ep.x) / 2;
      const my = (sp.y + ep.y) / 2 - offset - 4;
      return (
        <g
          key={node.id}
          transform={ctx.transform}
          data-node-id={node.id}
          data-canvas-x={String(Math.round(node.transform.position.x))}
          data-canvas-y={String(Math.round(node.transform.position.y))}
          opacity={node.opacity}
        >
          <line
            x1={sp.x}
            y1={sp.y}
            x2={sp.x}
            y2={sp.y - offset}
            stroke={dColor}
            strokeWidth={1}
            strokeDasharray="3 2"
          />
          <line
            x1={ep.x}
            y1={ep.y}
            x2={ep.x}
            y2={ep.y - offset}
            stroke={dColor}
            strokeWidth={1}
            strokeDasharray="3 2"
          />
          <line
            x1={sp.x}
            y1={sp.y - offset}
            x2={ep.x}
            y2={ep.y - offset}
            stroke={dColor}
            strokeWidth={1}
            markerStart="url(#arrow-start)"
            markerEnd="url(#arrow-end)"
          />
          <rect
            x={mx - label.length * dFs * 0.3 - 2}
            y={my - dFs}
            width={label.length * dFs * 0.6 + 4}
            height={dFs + 2}
            fill="var(--io-surface)"
            rx={2}
          />
          <text
            x={mx}
            y={my}
            textAnchor="middle"
            fontSize={dFs}
            fill={dColor}
            fontFamily="Inter"
          >
            {label}
          </text>
        </g>
      );
    }
    case "north_arrow": {
      const nCfg = node.config as NorthArrowConfig;
      const nSize = nCfg.size ?? 40;
      const nColor = nCfg.color ?? "#A1A1AA";
      const r = nSize / 2;
      return (
        <g
          key={node.id}
          transform={ctx.transform}
          data-node-id={node.id}
          data-canvas-x={String(Math.round(node.transform.position.x))}
          data-canvas-y={String(Math.round(node.transform.position.y))}
          opacity={node.opacity}
        >
          {nCfg.style === "compass" ? (
            <>
              <circle
                cx={r}
                cy={r}
                r={r - 1}
                fill="none"
                stroke={nColor}
                strokeWidth={1}
              />
              <polygon
                points={`${r},2 ${r - 5},${r} ${r},${r - 4} ${r + 5},${r}`}
                fill={nColor}
              />
              <polygon
                points={`${r},${nSize - 2} ${r - 5},${r} ${r},${r + 4} ${r + 5},${r}`}
                fill="none"
                stroke={nColor}
                strokeWidth={1}
              />
              <text
                x={r}
                y={nSize + 10}
                textAnchor="middle"
                fontSize={9}
                fill={nColor}
                fontFamily="Inter"
                fontWeight={600}
              >
                N
              </text>
            </>
          ) : (
            <>
              <polygon
                points={`${r},0 ${r - 5},${nSize - 8} ${r},${nSize - 4} ${r + 5},${nSize - 8}`}
                fill={nColor}
              />
              <text
                x={r}
                y={nSize + 10}
                textAnchor="middle"
                fontSize={9}
                fill={nColor}
                fontFamily="Inter"
                fontWeight={600}
              >
                N
              </text>
            </>
          )}
        </g>
      );
    }
    case "legend": {
      const lCfg = node.config as LegendConfig;
      const lFs = lCfg.fontSize ?? 10;
      const lBg = lCfg.backgroundColor ?? "var(--io-surface-primary)";
      const lBorder = lCfg.borderColor ?? "#3F3F46";
      const entries = lCfg.entries ?? [];
      const rowH = lFs + 8;
      const lW = 140;
      const lH = entries.length * rowH + 16;
      return (
        <g
          key={node.id}
          transform={ctx.transform}
          data-node-id={node.id}
          data-canvas-x={String(Math.round(node.transform.position.x))}
          data-canvas-y={String(Math.round(node.transform.position.y))}
          opacity={node.opacity}
        >
          <rect
            x={0}
            y={0}
            width={lW}
            height={Math.max(lH, 24)}
            rx={3}
            fill={lBg}
            stroke={lBorder}
            strokeWidth={1}
          />
          {entries.map((entry, i) => {
            const y = 8 + i * rowH;
            return (
              <g key={i}>
                {entry.symbol === "line" ? (
                  <line
                    x1={8}
                    y1={y + rowH / 2}
                    x2={24}
                    y2={y + rowH / 2}
                    stroke={entry.color}
                    strokeWidth={2}
                  />
                ) : entry.symbol === "circle" ? (
                  <circle
                    cx={16}
                    cy={y + rowH / 2}
                    r={5}
                    fill={entry.color}
                  />
                ) : (
                  <rect
                    x={8}
                    y={y + 2}
                    width={16}
                    height={rowH - 4}
                    fill={entry.color}
                    rx={1}
                  />
                )}
                <text
                  x={30}
                  y={y + lFs}
                  fontSize={lFs}
                  fill="#D4D4D8"
                  fontFamily="Inter"
                >
                  {entry.label}
                </text>
              </g>
            );
          })}
        </g>
      );
    }
    case "border": {
      const bCfg = node.config as BorderConfig;
      const bW = bCfg.width ?? 200;
      const bH = bCfg.height ?? 150;
      const bStroke = bCfg.strokeColor ?? "#3F3F46";
      const bSW = bCfg.strokeWidth ?? 1;
      const bRx =
        bCfg.cornerStyle === "rounded" ? (bCfg.cornerRadius ?? 4) : 0;
      const bDash = bCfg.strokeDasharray;
      const tb = bCfg.titleBlock;
      return (
        <g
          key={node.id}
          transform={ctx.transform}
          data-node-id={node.id}
          data-canvas-x={String(Math.round(node.transform.position.x))}
          data-canvas-y={String(Math.round(node.transform.position.y))}
          opacity={node.opacity}
        >
          <rect
            x={0}
            y={0}
            width={bW}
            height={bH}
            rx={bRx}
            fill="none"
            stroke={bStroke}
            strokeWidth={bSW}
            strokeDasharray={bDash}
          />
          {tb && (
            <>
              <line
                x1={0}
                y1={bH - 24}
                x2={bW}
                y2={bH - 24}
                stroke={bStroke}
                strokeWidth={bSW}
              />
              <text
                x={8}
                y={bH - 14}
                fontSize={9}
                fill="#A1A1AA"
                fontFamily="Inter"
                fontWeight={600}
              >
                {tb.title}
              </text>
              <text
                x={bW - 8}
                y={bH - 14}
                textAnchor="end"
                fontSize={8}
                fill="#71717A"
                fontFamily="Inter"
              >
                {tb.drawingNumber} Rev {tb.revision}
              </text>
              <text
                x={8}
                y={bH - 4}
                fontSize={7}
                fill="#71717A"
                fontFamily="Inter"
              >
                By: {tb.drawnBy} {tb.date}
              </text>
            </>
          )}
        </g>
      );
    }
    default:
      return (
        <g
          key={node.id}
          transform={ctx.transform}
          data-node-id={node.id}
          data-canvas-x={String(Math.round(node.transform.position.x))}
          data-canvas-y={String(Math.round(node.transform.position.y))}
          opacity={node.opacity}
        >
          <rect
            x={0}
            y={0}
            width={Math.max(aw, 60)}
            height={Math.max(ah, 20)}
            fill="none"
            stroke="var(--io-border)"
            strokeDasharray="3 2"
            rx={2}
          />
          <text x={6} y={14} fontSize={8} fill="var(--io-text-muted)">
            {node.annotationType}
          </text>
        </g>
      );
  }
}

// ---------------------------------------------------------------------------
// Image
// ---------------------------------------------------------------------------

export function renderImageSvg(
  node: ImageNode,
  ctx: RenderContext,
): React.ReactElement {
  // Support both server-side hashes and embedded data URLs
  const url = node.assetRef.hash.startsWith("data:")
    ? node.assetRef.hash
    : `/api/v1/image-assets/${node.assetRef.hash}`;
  return (
    <g
      key={node.id}
      transform={ctx.transform}
      data-node-id={node.id}
      data-canvas-x={String(Math.round(node.transform.position.x))}
      data-canvas-y={String(Math.round(node.transform.position.y))}
      opacity={node.opacity}
      onClick={ctx.onClick}
      style={ctx.cursor ? { cursor: ctx.cursor } : undefined}
    >
      <image
        href={url}
        x={0}
        y={0}
        width={node.displayWidth}
        height={node.displayHeight}
        preserveAspectRatio={
          node.preserveAspectRatio ? "xMidYMid meet" : "none"
        }
        imageRendering={
          node.imageRendering === "auto" ? undefined : node.imageRendering
        }
      />
    </g>
  );
}

// ---------------------------------------------------------------------------
// Pipe
// ---------------------------------------------------------------------------

/**
 * Renders a Pipe node.
 *
 * resolvedPath — caller-computed geometry (DesignerCanvas auto/manual routing).
 * If omitted, node.pathData is used directly (SceneRenderer mode).
 *
 * Insulation uses the triple-stroke technique: wide color stroke → narrow gap
 * stroke in background color → thin center color stroke. This works for both
 * path and polyline geometry and matches the ISA P&ID double-line convention.
 */
export function renderPipeSvg(
  node: Pipe,
  ctx: PipeRenderContext,
  resolvedPath?: { pathD: string | null; polylinePoints: string | null },
): React.ReactElement {
  const color = PIPE_SERVICE_COLORS[node.serviceType] ?? "#6B8CAE";
  const gapColor = ctx.canvasBgColor ?? "var(--io-surface-secondary)";
  const pathD = resolvedPath?.pathD ?? node.pathData ?? null;
  const polyPoints = resolvedPath?.polylinePoints ?? null;
  const pathId = `pipe-path-${node.id}`;

  const baseProps = {
    fill: "none" as const,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeDasharray: node.dashPattern,
  };

  let strokes: React.ReactElement;
  if (pathD) {
    strokes = node.insulated ? (
      <>
        <path d={pathD} {...baseProps} stroke={color} strokeWidth={node.strokeWidth * 4} />
        <path d={pathD} {...baseProps} stroke={gapColor} strokeWidth={node.strokeWidth * 2} />
        <path d={pathD} id={pathId} {...baseProps} stroke={color} strokeWidth={node.strokeWidth * 0.5} />
      </>
    ) : (
      <path d={pathD} id={pathId} {...baseProps} stroke={color} strokeWidth={node.strokeWidth} />
    );
  } else {
    const pts = polyPoints ?? "";
    strokes = node.insulated ? (
      <>
        <polyline points={pts} {...baseProps} stroke={color} strokeWidth={node.strokeWidth * 4} />
        <polyline points={pts} {...baseProps} stroke={gapColor} strokeWidth={node.strokeWidth * 2} />
        <polyline points={pts} {...baseProps} stroke={color} strokeWidth={node.strokeWidth * 0.5} />
      </>
    ) : (
      <polyline points={pts} {...baseProps} stroke={color} strokeWidth={node.strokeWidth} />
    );
  }

  return (
    <g
      key={node.id}
      transform={ctx.transform}
      data-node-id={node.id}
      data-canvas-x={String(Math.round(node.transform.position.x))}
      data-canvas-y={String(Math.round(node.transform.position.y))}
      data-lod="0"
      opacity={node.opacity}
      onClick={ctx.onClick}
      style={ctx.cursor ? { cursor: ctx.cursor } : undefined}
    >
      {strokes}
      {node.label && pathD && (
        <text fill="#71717A" fontSize={9} fontFamily="Inter">
          <textPath href={`#${pathId}`} startOffset="50%" textAnchor="middle">
            {node.label}
          </textPath>
        </text>
      )}
    </g>
  );
}

// ---------------------------------------------------------------------------
// EmbeddedSvg
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Stencil
// ---------------------------------------------------------------------------

/**
 * Renders a Stencil node. The caller must pre-fetch the SVG content and pass
 * it via ctx.svgContent. If null, a dashed loading placeholder is shown.
 *
 * SVG content originates from design_objects (admin-uploaded), same trust
 * level as base shape SVGs fetched from /shapes/.
 */
export function renderStencilSvg(
  node: Stencil,
  ctx: StencilRenderContext,
): React.ReactElement {
  const {
    size: { width: w, height: h },
    svgContent,
    displayName,
  } = ctx;

  if (!svgContent) {
    return (
      <g
        key={node.id}
        transform={ctx.transform}
        opacity={node.opacity}
        data-node-id={node.id}
        data-lod="0"
        onClick={ctx.onClick}
        style={ctx.cursor ? { cursor: ctx.cursor } : undefined}
      >
        <rect
          width={w}
          height={h}
          fill="none"
          stroke="var(--io-border, #3F3F46)"
          strokeWidth={1}
          strokeDasharray="4 2"
        />
        <text
          x={w / 2}
          y={h / 2 + 4}
          textAnchor="middle"
          fontSize={8}
          fill="var(--io-text-muted, #71717A)"
        >
          {displayName ?? "Stencil"}
        </text>
      </g>
    );
  }

  return (
    <g
      key={node.id}
      transform={ctx.transform}
      opacity={node.opacity}
      data-node-id={node.id}
      data-lod="0"
      onClick={ctx.onClick}
      style={ctx.cursor ? { cursor: ctx.cursor } : undefined}
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  );
}

// ---------------------------------------------------------------------------
// Widget placeholder (designer SVG mode only)
// ---------------------------------------------------------------------------

const WIDGET_ICONS: Record<string, string> = {
  trend: "📈",
  table: "▦",
  gauge: "⏱",
  kpi_card: "◈",
  bar_chart: "📊",
  pie_chart: "◕",
  alarm_list: "🔔",
  muster_point: "📍",
};

/**
 * Renders the static SVG placeholder used by DesignerCanvas for widget nodes.
 * Does NOT handle the live foreignObject preview or the SceneRenderer HTML
 * overlay — those stay in their respective callers.
 */
export function renderWidgetPlaceholderSvg(
  node: WidgetNode,
  ctx: RenderContext,
): React.ReactElement {
  const { widgetType, width, height, config } = node;
  const title =
    ("title" in config ? (config as { title?: string }).title : undefined) ??
    widgetType.replace(/_/g, " ");
  const icon = WIDGET_ICONS[widgetType] ?? "▭";
  const isSmall = width < 80 || height < 50;
  const w = Math.max(width, 40);
  const h = Math.max(height, 28);

  return (
    <g
      transform={ctx.transform}
      data-node-id={node.id}
      data-canvas-x={String(Math.round(node.transform.position.x))}
      data-canvas-y={String(Math.round(node.transform.position.y))}
      opacity={node.opacity}
    >
      {/* Background */}
      <rect
        x={0}
        y={0}
        width={w}
        height={h}
        fill="var(--io-surface-elevated)"
        stroke="var(--io-border)"
        strokeWidth={1}
        rx={3}
      />
      {/* Title bar */}
      <rect x={0} y={0} width={w} height={18} fill="rgba(99,102,241,0.12)" rx={3} />
      <rect x={0} y={14} width={w} height={4} fill="rgba(99,102,241,0.12)" />
      <text x={6} y={12} fontSize={9} fill="var(--io-accent)" fontWeight={500}>
        {title}
      </text>
      {/* Center icon + type label */}
      {!isSmall && (
        <>
          <text
            x={w / 2}
            y={h / 2 + 10}
            textAnchor="middle"
            fontSize={22}
            fill="rgba(99,102,241,0.25)"
            fontFamily="serif"
          >
            {icon}
          </text>
          <text
            x={w / 2}
            y={h - 6}
            textAnchor="middle"
            fontSize={8}
            fill="var(--io-text-muted)"
          >
            {widgetType.replace(/_/g, " ")}
          </text>
        </>
      )}
    </g>
  );
}

// ---------------------------------------------------------------------------
// EmbeddedSvg
// ---------------------------------------------------------------------------

/**
 * Renders an EmbeddedSvgNode. The svgContent is server-authored SVG markup
 * (same trust level as base shape SVGs fetched from /shapes/).
 */
export function renderEmbeddedSvgSvg(
  node: EmbeddedSvgNode,
  ctx: RenderContext,
): React.ReactElement {
  // eslint-disable-next-line react/no-danger
  return React.createElement("g", {
    key: node.id,
    transform: ctx.transform,
    "data-node-id": node.id,
    "data-canvas-x": String(Math.round(node.transform.position.x)),
    "data-canvas-y": String(Math.round(node.transform.position.y)),
    opacity: node.opacity,
    onClick: ctx.onClick,
    style: ctx.cursor ? { cursor: ctx.cursor } : undefined,
    dangerouslySetInnerHTML: { __html: node.svgContent },
  });
}

// ---------------------------------------------------------------------------
// Group
// ---------------------------------------------------------------------------

/**
 * Renders a Group node -- a wrapper that recursively renders children
 * via the caller-provided renderChild callback.
 */
export function renderGroupSvg(
  node: Group,
  ctx: GroupRenderContext,
): React.ReactElement {
  return (
    <g
      key={node.id}
      transform={ctx.transform}
      opacity={node.opacity}
      data-node-id={node.id}
      data-canvas-x={String(Math.round(node.transform.position.x))}
      data-canvas-y={String(Math.round(node.transform.position.y))}
    >
      {node.children.map((child) => ctx.renderChild(child))}
    </g>
  );
}

// ---------------------------------------------------------------------------
// SymbolInstance
// ---------------------------------------------------------------------------

/**
 * Renders a SymbolInstance node -- the most complex node type.
 *
 * Includes:
 *  - Base shape SVG with injected width/height
 *  - Text zone overlays from shape sidecar
 *  - Composable parts (actuators, supports, etc.) with exact placement
 *  - Child display elements rendered via ctx.renderChild callback
 *
 * This is a pure function -- all state resolution (point bindings, shape loading)
 * is handled by the caller and passed in via SymbolInstanceRenderContext.
 *
 * SVG content originates from server-fetched static files under /shapes/ --
 * same trust level as base shape SVGs. Not user input.
 */
export function renderSymbolInstanceSvg(
  node: SymbolInstance,
  ctx: SymbolInstanceRenderContext,
): React.ReactElement {
  const sidecar = ctx.shapeSidecar;

  // Shape SVG files include a full <svg> wrapper without explicit width/height.
  // Inject geometry dimensions so nested SVGs don't default to 300x150.
  // Fall back to parsing the SVG's own viewBox when sidecar.geometry is absent.
  let svgContent = ctx.shapeSvg ?? "";
  let shapeW: number | undefined = sidecar?.geometry?.width;
  let shapeH: number | undefined = sidecar?.geometry?.height;
  if (svgContent) {
    let w: number | undefined = shapeW;
    let h: number | undefined = shapeH;
    if (w == null || h == null) {
      const vbMatch = svgContent.match(/viewBox=["']([^"']+)["']/);
      if (vbMatch) {
        const parts = vbMatch[1].trim().split(/[\s,]+/);
        if (parts.length >= 4) {
          w = parseFloat(parts[2]);
          h = parseFloat(parts[3]);
          shapeW = w;
          shapeH = h;
        }
      }
    }
    if (w != null && h != null) {
      svgContent = svgContent.replace(
        /(<svg\b[^>]*?)>/,
        `$1 width="${w}" height="${h}">`,
      );
    }
  }

  // If no SVG content, render a dashed placeholder box with the shape ID
  if (!svgContent) {
    const placeholderW =
      sidecar?.geometry?.baseSize?.[0] ?? sidecar?.geometry?.width ?? 64;
    const placeholderH =
      sidecar?.geometry?.baseSize?.[1] ?? sidecar?.geometry?.height ?? 64;
    return (
      <g
        key={node.id}
        transform={ctx.transform}
        data-node-id={node.id}
        data-canvas-x={String(Math.round(node.transform.position.x))}
        data-canvas-y={String(Math.round(node.transform.position.y))}
        opacity={node.opacity}
      >
        <rect
          x={0}
          y={0}
          width={placeholderW}
          height={placeholderH}
          fill="none"
          stroke="var(--io-border)"
          strokeDasharray="4 2"
          rx={2}
        />
        <text
          x={placeholderW / 2}
          y={placeholderH / 2 + 4}
          textAnchor="middle"
          fontSize={9}
          fill="var(--io-text-muted)"
        >
          {node.shapeRef.shapeId.replace(/_/g, " ")}
        </text>
      </g>
    );
  }

  // ---- Text zone rendering (spec: Shape Library Text Zones) ----
  const textZoneElements = (sidecar?.textZones ?? []).map((zone) => {
    const override = node.textZoneOverrides?.[zone.id];
    if (override?.visible === false) return null;
    // Determine text content: static override > tag from bound point > empty
    const text = override?.staticText ?? ctx.stateTag ?? "";
    if (!text && !ctx.designerMode) return null;
    const displayText = text || (ctx.designerMode ? `[${zone.id}]` : "");

    // Instrument designation zones (spec: Shape Library Typography):
    // Use Arial 12px weight 600 with textLength auto-fit when zone.width is defined.
    const isDesignation = zone.id === "designation";
    const fontFamily = isDesignation ? "Arial" : "Inter";
    const fontSize =
      override?.fontSize ?? zone.fontSize ?? (isDesignation ? 12 : 10);
    const fontWeight = isDesignation ? 600 : undefined;

    // Apply textLength + lengthAdjust="spacingAndGlyphs" whenever zone.width is set
    const autoFitProps =
      zone.width != null
        ? {
            textLength: zone.width,
            lengthAdjust: "spacingAndGlyphs" as const,
          }
        : {};

    return (
      <text
        key={`tz-${zone.id}`}
        x={zone.x}
        y={zone.y}
        textAnchor={(zone.anchor as "start" | "middle" | "end") ?? "middle"}
        dominantBaseline="auto"
        fontFamily={fontFamily}
        fontSize={fontSize}
        fontWeight={fontWeight}
        fill="#71717A"
        data-lod="2"
        {...autoFitProps}
      >
        {displayText}
      </text>
    );
  });

  // ---- Composable part rendering (spec: Shape Library Composable Parts) ----
  // Algorithm: resolve part shape via base sidecar addons, then compute
  // exact placement from compositeAttachments + part bodyBase. Falls back to stacking.
  // SVG content is server-fetched static files from /shapes/ -- same trust level as base shapes.
  const bw =
    sidecar?.geometry?.baseSize?.[0] ?? sidecar?.geometry?.width ?? 64;
  const bh =
    sidecar?.geometry?.baseSize?.[1] ?? sidecar?.geometry?.height ?? 64;
  let highestAboveY = 0;
  let belowStacked = bh;
  const composablePartElements: React.ReactElement[] = [];
  for (const part of node.composableParts ?? []) {
    // DB may store partId as snake_case (part_id) -- handle both
    const pid =
      part.partId ?? (part as unknown as Record<string, string>)["part_id"];
    if (!pid) continue;

    // Part shape file lives in base sidecar addons -- partId is the addon id, not shape id
    const addon = sidecar?.addons?.find((a) => a.id === pid);
    if (!addon) continue;
    const partShapeId = addon.file.replace(/\.svg$/, "");
    const partData = ctx.partShapes.get(partShapeId);
    if (!partData?.svg) continue;

    const pGeo = partData.sidecar?.geometry;
    const pw = pGeo?.baseSize?.[0] ?? pGeo?.width ?? 32;
    const ph = pGeo?.baseSize?.[1] ?? pGeo?.height ?? 32;
    const pVB =
      partData.svg.match(/viewBox=["']([^"']+)["']/)?.[1] ??
      `0 0 ${pw} ${ph}`;
    // Strip outer <svg> wrapper -- content is re-wrapped with explicit geometry below
    const pInner =
      partData.svg.match(/<svg[^>]*>([\s\S]*?)<\/svg>/i)?.[1] ?? "";

    // Prefer specific-id match on compositeAttachments, fall back to addon group
    const attachment =
      sidecar?.compositeAttachments?.find((a) => a.forPart === pid) ??
      sidecar?.compositeAttachments?.find((a) => a.forPart === addon.group);
    const bodyBase = pGeo?.bodyBase;

    let px: number;
    let py: number;

    if (attachment && bodyBase) {
      px = attachment.x - bodyBase.x;
      py = attachment.y - bodyBase.y;
      if (py < highestAboveY) highestAboveY = py;
      if (attachment.stemFrom) {
        composablePartElements.push(
          <line
            key={`${pid}-stem`}
            x1={attachment.stemFrom.x}
            y1={attachment.stemFrom.y}
            x2={attachment.x}
            y2={attachment.y}
            stroke="#808080"
            strokeWidth="1.5"
          />,
        );
      }
    } else if (
      part.attachment === "actuator" ||
      part.attachment === "fail-indicator"
    ) {
      py = highestAboveY - ph;
      highestAboveY = py;
      px = (bw - pw) / 2;
    } else if (part.attachment === "support") {
      py = belowStacked;
      belowStacked += ph;
      px = (bw - pw) / 2;
    } else {
      px = 0;
      py = 0;
    }

    // eslint-disable-next-line react/no-danger
    composablePartElements.push(
      <svg
        key={pid}
        x={px}
        y={py}
        width={pw}
        height={ph}
        viewBox={pVB}
        overflow="visible"
        style={{ pointerEvents: "none" }}
        dangerouslySetInnerHTML={{ __html: pInner }}
      />,
    );
  }

  // ---- Pivot for counter-rotation transform ----
  // Derived from the shape's natural size (from sidecar geometry) scaled by parent scale.
  const sidecarGeo = sidecar?.geometry;
  const naturalW = sidecarGeo?.baseSize?.[0] ?? sidecarGeo?.width ?? 64;
  const naturalH = sidecarGeo?.baseSize?.[1] ?? sidecarGeo?.height ?? 64;
  const parentPivotX = (naturalW * (node.transform.scale?.x ?? 1)) / 2;
  const parentPivotY = (naturalH * (node.transform.scale?.y ?? 1)) / 2;

  // ---- Assembly: ALL children stay inside the parent <g> ----
  // Interior sidecars (vessel_overlay fill gauge, inside analog bar) inherit parent transforms normally.
  // Exterior sidecars receive a counter-rotation transform that cancels the parent's rotation/scale
  // so they keep their fixed canvas position and orientation regardless of parent rotation.
  return (
    <g
      key={node.id}
      transform={ctx.transform}
      opacity={node.opacity}
      data-node-id={node.id}
      data-lod="0"
      data-point-id={ctx.statePointId || undefined}
      className={
        [ctx.stateClass, ctx.isSelected ? "io-selected" : ""]
          .filter(Boolean)
          .join(" ") || undefined
      }
      onClick={ctx.onClick}
      style={ctx.cursor ? { cursor: ctx.cursor } : undefined}
    >
      {/* Base shape SVG -- server-fetched trusted content */}
      {svgContent && (
        <g dangerouslySetInnerHTML={{ __html: svgContent }} />
      )}
      {composablePartElements}
      {textZoneElements}
      {node.children.map((child) => {
        if (isInsideFillSidecar(child)) {
          // Interior sidecar: rotates/scales with parent
          return ctx.renderChild(
            child,
            child.transform.position,
            sidecar?.vesselInteriorPath,
          );
        }
        // Exterior sidecar: counter-rotation keeps canvas position fixed
        return ctx.renderChild(
          child,
          child.transform.position,
          undefined,
          buildExteriorSidecarTransform(
            child.transform.position,
            child.transform.rotation,
            child.transform.scale,
            child.transform.mirror,
            node.transform.rotation,
            node.transform.scale,
            node.transform.mirror,
            parentPivotX,
            parentPivotY,
          ),
        );
      })}
    </g>
  );
}
