/**
 * DesignerRightPanel.tsx
 *
 * Context-sensitive property inspector panel.
 * Uses concern-based tabs (Layout / Style / Data / Shape / Content / Doc)
 * that appear conditionally based on the selected node type.
 */

import React, { useState, useCallback, useEffect, useRef } from "react";
import {
  useSceneStore,
  useHistoryStore,
  useLibraryStore,
  useUiStore,
} from "../../store/designer";
import type { NodeId } from "../../shared/types/graphics";
import type {
  SceneNode,
  SymbolInstance,
  TextBlock,
  Primitive,
  Pipe,
  DisplayElement,
  LayerDefinition,
  GraphicDocument,
  NavigationLink,
  WidgetNode,
  WidgetConfig,
  DisplayElementType,
  DisplayElementConfig,
  TextReadoutConfig,
  AnalogBarConfig,
  FillGaugeConfig,
  SparklineConfig,
  DigitalStatusConfig,
  PointNameLabelConfig,
  DisplayElementFontFamily,
  ImageNode,
  EmbeddedSvgNode,
  Group,
  Annotation,
  Stencil,
  Transform,
} from "../../shared/types/graphics";
import {
  ChangePropertyCommand,
  ChangeTextCommand,
  ChangeBindingCommand,
  ChangeStyleCommand,
  ChangeLayerPropertyCommand,
  ChangeNavigationLinkCommand,
  ChangeShapeVariantCommand,
  ChangeShapeConfigurationCommand,
  ChangeDisplayElementConfigCommand,
  ChangeDisplayElementTypeCommand,
  AddDisplayElementCommand,
  RemoveDisplayElementCommand,
  HideDisplayElementCommand,
  ChangeWidgetConfigCommand,
  AlignNodesCommand,
  DistributeNodesCommand,
  DeleteNodesCommand,
  GroupNodesCommand,
  ReorderNodeCommand,
} from "../../shared/graphics/commands";
import type {
  SceneCommand,
  AlignmentType,
} from "../../shared/graphics/commands";
import type { ShapeEntry, ValueAnchor } from "../../store/designer";
import { PIPE_SERVICE_COLORS } from "../../shared/types/graphics";
import { pointsApi } from "../../api/points";

// ---------------------------------------------------------------------------
// PointResolutionIndicator — shows a yellow dot when a pointId is unresolved
// ---------------------------------------------------------------------------

function PointResolutionIndicator({
  pointId,
}: {
  pointId: string | undefined;
}) {
  const [status, setStatus] = useState<
    "idle" | "checking" | "found" | "notfound"
  >("idle");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!pointId) {
      setStatus("idle");
      return;
    }
    setStatus("checking");
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const result = await pointsApi
        .list({ search: pointId, limit: 1 })
        .catch(() => null);
      if (!result?.success) {
        setStatus("idle");
        return;
      }
      const exact = result.data.data.find(
        (p) => p.id === pointId || p.tagname === pointId,
      );
      setStatus(exact ? "found" : "notfound");
    }, 400);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [pointId]);

  if (status === "idle" || !pointId) return null;
  if (status === "checking")
    return (
      <span
        title="Checking…"
        style={{ fontSize: 10, color: "var(--io-text-muted)", marginLeft: 4 }}
      >
        …
      </span>
    );
  if (status === "found")
    return (
      <span
        title="Tag resolved"
        style={{ fontSize: 10, color: "#22c55e", marginLeft: 4 }}
      >
        ✓
      </span>
    );
  return (
    <span
      title="Tag not found — bindings with unresolved tags display N/C at runtime"
      style={{ fontSize: 10, color: "#facc15", marginLeft: 4 }}
    >
      ⚠ not found
    </span>
  );
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DesignerRightPanelProps {
  collapsed: boolean;
  width: number;
}

// ---------------------------------------------------------------------------
// Find node by ID anywhere in the doc tree
// ---------------------------------------------------------------------------

function findNodeById(doc: GraphicDocument, id: NodeId): SceneNode | null {
  function search(nodes: SceneNode[]): SceneNode | null {
    for (const n of nodes) {
      if (n.id === id) return n;
      if ("children" in n && Array.isArray(n.children)) {
        const found = search(n.children as SceneNode[]);
        if (found) return found;
      }
    }
    return null;
  }
  return search(doc.children);
}

// ---------------------------------------------------------------------------
// Small helper components
// ---------------------------------------------------------------------------

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label
      style={{
        display: "block",
        fontSize: 10,
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        color: "var(--io-text-muted)",
        marginBottom: 3,
      }}
    >
      {children}
    </label>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "4px 7px",
  background: "var(--io-surface)",
  border: "1px solid var(--io-border)",
  borderRadius: "var(--io-radius)",
  color: "var(--io-text-primary)",
  fontSize: 12,
  outline: "none",
  boxSizing: "border-box",
};

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 10 }}>
      <FieldLabel>{label}</FieldLabel>
      {children}
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  value: number | undefined;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  const safeValue =
    value === undefined || value === null || isNaN(value as number)
      ? ""
      : value;
  return (
    <input
      type="number"
      value={safeValue}
      min={min}
      max={max}
      step={step}
      onChange={(e) => {
        const v = parseFloat(e.target.value);
        if (!isNaN(v)) onChange(v);
      }}
      style={inputStyle}
    />
  );
}

// ISA-101 / ISA-18.2 reserved colors — never use for decorative fills.
// These map directly to alarm priority, operational state, and connection indicators.
const RESERVED_COLOR_SET = new Set([
  "#ef4444",
  "#b91c1c", // P1 Urgent
  "#f97316",
  "#ea580c", // P2 High
  "#eab308",
  "#c8a800",
  "#facc15", // P3 Low + yellow adjacents
  "#d946ef",
  "#c026d3", // Shelved / Fault
  "#60a5fa",
  "#2563eb", // Custom alarm
  "#2dd4bf",
  "#0d9488",
  "#14b8a6", // Teal — connection points only
  "#059669",
  "#047857", // Running/Open operational state
  "#f87171", // near-alarm red
]);

function ColorInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const isHex = /^#[0-9a-fA-F]{3,8}$/.test(value);
  const isReserved = isHex && RESERVED_COLOR_SET.has(value.toLowerCase());
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <label
          style={{
            position: "relative",
            flexShrink: 0,
            cursor: "pointer",
            display: "block",
            width: 28,
            height: 28,
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              background: value,
              border: "1px solid var(--io-border)",
              borderRadius: "var(--io-radius)",
            }}
          />
          <input
            type="color"
            value={isHex ? value : "#ffffff"}
            onChange={(e) => onChange(e.target.value)}
            style={{
              position: "absolute",
              inset: 0,
              opacity: 0,
              cursor: "pointer",
              width: "100%",
              height: "100%",
            }}
          />
        </label>
        {isHex ? (
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            style={{ ...inputStyle, flex: 1 }}
          />
        ) : (
          <span
            style={{
              flex: 1,
              fontSize: 10,
              color: "var(--io-text-muted)",
              fontFamily: "monospace",
              padding: "0 4px",
            }}
          >
            Theme default
          </span>
        )}
      </div>
      {isReserved && (
        <span style={{ fontSize: 9, color: "#f97316" }}>
          Reserved for alarm/status — choose another color
        </span>
      )}
    </div>
  );
}

// ISA-101 compliant text color presets — only tokens from the display element spec.
// Teal, yellow, red, and orange are excluded: reserved for alarm priority indicators.
const TEXT_COLOR_PRESETS = [
  { label: "White", value: "var(--io-text-primary)" },
  { label: "Gray", value: "var(--io-text-secondary)" },
  { label: "Muted", value: "var(--io-text-muted)" },
];

/**
 * Dropdown color selector for text/label colors.
 * Only exposes the three ISA-101 compliant text tokens — no custom hex picker.
 * Alarm-adjacent colors (red, orange, yellow, teal) are intentionally excluded.
 */
function ThemedColorSelect({
  value,
  defaultValue,
  onChange,
}: {
  value: string | undefined;
  defaultValue: string;
  onChange: (v: string) => void;
}) {
  const isPreset = TEXT_COLOR_PRESETS.some((p) => p.value === value);
  const selectValue = isPreset ? value! : "__default__";
  const swatchColor = isPreset ? value! : defaultValue;

  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <div
        style={{
          width: 20,
          height: 20,
          background: swatchColor,
          border: "1px solid var(--io-border)",
          borderRadius: 3,
          flexShrink: 0,
        }}
      />
      <select
        value={selectValue}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "__default__" ? defaultValue : v);
        }}
        style={{ ...inputStyle, flex: 1 }}
      >
        <option value="__default__">Default</option>
        {TEXT_COLOR_PRESETS.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function SelectInput({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        ...inputStyle,
        cursor: "pointer",
      }}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// ---------------------------------------------------------------------------
// NavigationLinkEditor
// ---------------------------------------------------------------------------

function NavigationLinkEditor({
  nodeId,
  link,
  prevLink,
  executeCmd,
}: {
  nodeId: NodeId;
  link: NavigationLink | undefined;
  prevLink: NavigationLink | undefined;
  executeCmd: (cmd: SceneCommand) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const hasLink = !!link?.targetGraphicId || !!link?.targetUrl;

  return (
    <div style={{ marginBottom: 10 }}>
      <button
        onClick={() => setExpanded((e) => !e)}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "transparent",
          border: "1px solid var(--io-border)",
          borderRadius: "var(--io-radius)",
          color: hasLink ? "var(--io-accent)" : "var(--io-text-secondary)",
          fontSize: 11,
          padding: "4px 8px",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <span>Navigation Link {hasLink ? "(set)" : "(none)"}</span>
        <span style={{ fontSize: 9 }}>{expanded ? "▲" : "▼"}</span>
      </button>
      {expanded && (
        <div
          style={{
            marginTop: 6,
            padding: 8,
            background: "var(--io-surface-elevated)",
            borderRadius: "var(--io-radius)",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          <div>
            <FieldLabel>Target Graphic ID</FieldLabel>
            <input
              type="text"
              defaultValue={link?.targetGraphicId ?? ""}
              onBlur={(e) => {
                const val = e.target.value.trim();
                const newLink = {
                  ...link,
                  targetGraphicId: val || undefined,
                  targetUrl: undefined,
                };
                executeCmd(
                  new ChangeNavigationLinkCommand(nodeId, newLink, prevLink),
                );
              }}
              style={inputStyle}
              placeholder="graphic-uuid"
            />
          </div>
          <div
            style={{
              fontSize: 10,
              color: "var(--io-text-muted)",
              textAlign: "center",
            }}
          >
            — or —
          </div>
          <div>
            <FieldLabel>External URL</FieldLabel>
            <input
              type="text"
              defaultValue={link?.targetUrl ?? ""}
              onBlur={(e) => {
                const val = e.target.value.trim();
                const newLink = {
                  ...link,
                  targetUrl: val || undefined,
                  targetGraphicId: undefined,
                };
                executeCmd(
                  new ChangeNavigationLinkCommand(nodeId, newLink, prevLink),
                );
              }}
              style={inputStyle}
              placeholder="https://…"
            />
          </div>
          {hasLink && (
            <button
              onClick={() =>
                executeCmd(
                  new ChangeNavigationLinkCommand(nodeId, undefined, prevLink),
                )
              }
              style={{
                fontSize: 11,
                color: "var(--io-text-muted)",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
                padding: 0,
              }}
            >
              Clear link
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Hook: execute + push to history
// ---------------------------------------------------------------------------

function useExecuteCmd() {
  const doc = useSceneStore((s) => s.doc);
  const execute = useSceneStore((s) => s.execute);
  const push = useHistoryStore((s) => s.push);

  return useCallback(
    (cmd: SceneCommand) => {
      if (!doc) return;
      const before = doc;
      execute(cmd);
      push(cmd, before);
    },
    [doc, execute, push],
  );
}

// ---------------------------------------------------------------------------
// Document properties panel
// ---------------------------------------------------------------------------

function DocPropertiesPanel({ doc }: { doc: GraphicDocument }) {
  const executeCmd = useExecuteCmd();

  return (
    <div style={{ padding: "0 12px" }}>
      <Field label="Canvas Width">
        <NumberInput
          value={doc.canvas.width}
          min={100}
          onChange={(v) =>
            executeCmd(
              new ChangePropertyCommand(
                doc.id,
                "canvas",
                { ...doc.canvas, width: v },
                doc.canvas,
              ),
            )
          }
        />
      </Field>
      <Field label="Canvas Height">
        <NumberInput
          value={doc.canvas.height}
          min={100}
          onChange={(v) =>
            executeCmd(
              new ChangePropertyCommand(
                doc.id,
                "canvas",
                { ...doc.canvas, height: v },
                doc.canvas,
              ),
            )
          }
        />
      </Field>
      <Field label="Background Color">
        <ColorInput
          value={doc.canvas.backgroundColor}
          onChange={(v) =>
            executeCmd(
              new ChangePropertyCommand(
                doc.id,
                "canvas",
                { ...doc.canvas, backgroundColor: v },
                doc.canvas,
              ),
            )
          }
        />
      </Field>
      <Field label="Grid Size">
        <NumberInput
          value={doc.metadata.gridSize}
          min={1}
          max={128}
          onChange={(v) =>
            executeCmd(
              new ChangePropertyCommand(
                doc.id,
                "metadata",
                { ...doc.metadata, gridSize: v },
                doc.metadata,
              ),
            )
          }
        />
      </Field>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TransformSection — universal layout tab for all nodes
// ---------------------------------------------------------------------------

function TransformSection({
  node,
  doc,
  executeCmd,
  showRotation = true,
}: {
  node: SceneNode;
  doc: GraphicDocument | null;
  executeCmd: (cmd: SceneCommand) => void;
  showRotation?: boolean;
}) {
  const t = node.transform;
  const pos = t.position;
  const scale = t.scale ?? { x: 1, y: 1 };
  const mirror = t.mirror ?? "none";

  function setTransform(patch: Partial<Transform>) {
    executeCmd(
      new ChangePropertyCommand(node.id, "transform", { ...t, ...patch }, t),
    );
  }

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 6,
          marginBottom: 6,
        }}
      >
        <Field label="X">
          <NumberInput
            value={Math.round(pos.x)}
            onChange={(v) => setTransform({ position: { ...pos, x: v } })}
          />
        </Field>
        <Field label="Y">
          <NumberInput
            value={Math.round(pos.y)}
            onChange={(v) => setTransform({ position: { ...pos, y: v } })}
          />
        </Field>
        {showRotation && (
          <Field label="Rotation °">
            <NumberInput
              value={Math.round(t.rotation)}
              min={-360}
              max={360}
              onChange={(v) => setTransform({ rotation: v })}
            />
          </Field>
        )}
        <Field label="Opacity %">
          <NumberInput
            value={Math.round(node.opacity * 100)}
            min={0}
            max={100}
            onChange={(v) =>
              executeCmd(
                new ChangePropertyCommand(
                  node.id,
                  "opacity",
                  v / 100,
                  node.opacity,
                ),
              )
            }
          />
        </Field>
        <Field label="Scale X %">
          <NumberInput
            value={Math.round(scale.x * 100)}
            min={1}
            max={2000}
            onChange={(v) => setTransform({ scale: { ...scale, x: v / 100 } })}
          />
        </Field>
        <Field label="Scale Y %">
          <NumberInput
            value={Math.round(scale.y * 100)}
            min={1}
            max={2000}
            onChange={(v) => setTransform({ scale: { ...scale, y: v / 100 } })}
          />
        </Field>
      </div>

      <Field label="Mirror">
        <SelectInput
          value={mirror}
          onChange={(v) => setTransform({ mirror: v as Transform["mirror"] })}
          options={[
            { value: "none", label: "None" },
            { value: "horizontal", label: "Horizontal" },
            { value: "vertical", label: "Vertical" },
            { value: "both", label: "Both" },
          ]}
        />
      </Field>

      <div style={{ display: "flex", gap: 12, marginBottom: 10 }}>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontSize: 11,
            cursor: "pointer",
            color: "var(--io-text-secondary)",
          }}
        >
          <input
            type="checkbox"
            checked={node.visible}
            onChange={(e) =>
              executeCmd(
                new ChangePropertyCommand(
                  node.id,
                  "visible",
                  e.target.checked,
                  node.visible,
                ),
              )
            }
            style={{ cursor: "pointer" }}
          />
          Visible
        </label>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontSize: 11,
            cursor: "pointer",
            color: "var(--io-text-secondary)",
          }}
        >
          <input
            type="checkbox"
            checked={node.locked}
            onChange={(e) =>
              executeCmd(
                new ChangePropertyCommand(
                  node.id,
                  "locked",
                  e.target.checked,
                  node.locked,
                ),
              )
            }
            style={{ cursor: "pointer" }}
          />
          Locked
        </label>
      </div>

      {doc && (
        <Field label="Layer">
          <SelectInput
            value={node.layerId ?? ""}
            onChange={(v) =>
              executeCmd(
                new ChangePropertyCommand(
                  node.id,
                  "layerId",
                  v || undefined,
                  node.layerId,
                ),
              )
            }
            options={[
              { value: "", label: "— None —" },
              ...doc.layers.map((l) => ({ value: l.id, label: l.name })),
            ]}
          />
        </Field>
      )}

      <NavigationLinkEditor
        nodeId={node.id}
        link={node.navigationLink}
        prevLink={node.navigationLink}
        executeCmd={executeCmd}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Primitive geometry size fields (rect/circle/ellipse)
// ---------------------------------------------------------------------------

function PrimitiveGeometrySection({
  node,
  executeCmd,
}: {
  node: Primitive;
  executeCmd: (cmd: SceneCommand) => void;
}) {
  const geo = node.geometry;
  if (geo.type === "rect") {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        <Field label="Width">
          <NumberInput
            value={geo.width}
            min={1}
            onChange={(v) =>
              executeCmd(
                new ChangePropertyCommand(
                  node.id,
                  "geometry",
                  { ...geo, width: v },
                  geo,
                ),
              )
            }
          />
        </Field>
        <Field label="Height">
          <NumberInput
            value={geo.height}
            min={1}
            onChange={(v) =>
              executeCmd(
                new ChangePropertyCommand(
                  node.id,
                  "geometry",
                  { ...geo, height: v },
                  geo,
                ),
              )
            }
          />
        </Field>
        <Field label="Corner Radius">
          <NumberInput
            value={geo.rx ?? 0}
            min={0}
            onChange={(v) =>
              executeCmd(
                new ChangePropertyCommand(
                  node.id,
                  "geometry",
                  { ...geo, rx: v, ry: v },
                  geo,
                ),
              )
            }
          />
        </Field>
      </div>
    );
  }
  if (geo.type === "circle") {
    return (
      <Field label="Radius">
        <NumberInput
          value={geo.r}
          min={1}
          onChange={(v) =>
            executeCmd(
              new ChangePropertyCommand(
                node.id,
                "geometry",
                { ...geo, r: v },
                geo,
              ),
            )
          }
        />
      </Field>
    );
  }
  if (geo.type === "ellipse") {
    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        <Field label="Radius X">
          <NumberInput
            value={geo.rx}
            min={1}
            onChange={(v) =>
              executeCmd(
                new ChangePropertyCommand(
                  node.id,
                  "geometry",
                  { ...geo, rx: v },
                  geo,
                ),
              )
            }
          />
        </Field>
        <Field label="Radius Y">
          <NumberInput
            value={geo.ry}
            min={1}
            onChange={(v) =>
              executeCmd(
                new ChangePropertyCommand(
                  node.id,
                  "geometry",
                  { ...geo, ry: v },
                  geo,
                ),
              )
            }
          />
        </Field>
      </div>
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// Primitive style section (fill + stroke)
// ---------------------------------------------------------------------------

function PrimitiveStyleSection({
  node,
  executeCmd,
}: {
  node: Primitive;
  executeCmd: (cmd: SceneCommand) => void;
}) {
  const style = node.style;

  return (
    <>
      <Field label="Fill">
        <ColorInput
          value={style.fill === "none" ? "#000000" : style.fill}
          onChange={(v) =>
            executeCmd(
              new ChangeStyleCommand(node.id, { ...style, fill: v }, style),
            )
          }
        />
      </Field>
      <Field label="Fill Opacity %">
        <NumberInput
          value={Math.round(style.fillOpacity * 100)}
          min={0}
          max={100}
          onChange={(v) =>
            executeCmd(
              new ChangeStyleCommand(
                node.id,
                { ...style, fillOpacity: v / 100 },
                style,
              ),
            )
          }
        />
      </Field>
      <Field label="Stroke">
        <ColorInput
          value={style.stroke === "none" ? "#000000" : style.stroke}
          onChange={(v) =>
            executeCmd(
              new ChangeStyleCommand(node.id, { ...style, stroke: v }, style),
            )
          }
        />
      </Field>
      <Field label="Stroke Width">
        <NumberInput
          value={style.strokeWidth}
          min={0}
          step={0.5}
          onChange={(v) =>
            executeCmd(
              new ChangeStyleCommand(
                node.id,
                { ...style, strokeWidth: v },
                style,
              ),
            )
          }
        />
      </Field>
      <Field label="Stroke Dash">
        <SelectInput
          value={style.strokeDasharray ?? ""}
          onChange={(v) =>
            executeCmd(
              new ChangeStyleCommand(
                node.id,
                { ...style, strokeDasharray: v || undefined },
                style,
              ),
            )
          }
          options={[
            { value: "", label: "Solid" },
            { value: "4 2", label: "Dashed" },
            { value: "2 2", label: "Dotted" },
            { value: "8 4 2 4", label: "Dash-Dot" },
          ]}
        />
      </Field>
      <Field label="Line Cap">
        <SelectInput
          value={style.strokeLinecap ?? "butt"}
          onChange={(v) =>
            executeCmd(
              new ChangeStyleCommand(
                node.id,
                {
                  ...style,
                  strokeLinecap: v as "butt" | "round" | "square",
                },
                style,
              ),
            )
          }
          options={[
            { value: "butt", label: "Butt" },
            { value: "round", label: "Round" },
            { value: "square", label: "Square" },
          ]}
        />
      </Field>
      <Field label="Line Join">
        <SelectInput
          value={style.strokeLinejoin ?? "miter"}
          onChange={(v) =>
            executeCmd(
              new ChangeStyleCommand(
                node.id,
                {
                  ...style,
                  strokeLinejoin: v as "miter" | "round" | "bevel",
                },
                style,
              ),
            )
          }
          options={[
            { value: "miter", label: "Miter" },
            { value: "round", label: "Round" },
            { value: "bevel", label: "Bevel" },
          ]}
        />
      </Field>
    </>
  );
}

// ---------------------------------------------------------------------------
// TextBlock style section (font + color + background)
// ---------------------------------------------------------------------------

function TextBlockStyleSection({
  node,
  executeCmd,
}: {
  node: TextBlock;
  executeCmd: (cmd: SceneCommand) => void;
}) {
  const bg = node.background;
  const [showBg, setShowBg] = useState(!!bg);

  return (
    <>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 6,
          marginBottom: 6,
        }}
      >
        <Field label="Font Family">
          <SelectInput
            value={node.fontFamily}
            onChange={(v) =>
              executeCmd(
                new ChangePropertyCommand(
                  node.id,
                  "fontFamily",
                  v,
                  node.fontFamily,
                ),
              )
            }
            options={[
              { value: "Inter", label: "Inter" },
              { value: "JetBrains Mono", label: "JetBrains Mono" },
              { value: "IBM Plex Sans", label: "IBM Plex Sans" },
            ]}
          />
        </Field>
        <Field label="Font Size">
          <NumberInput
            value={node.fontSize}
            min={6}
            max={256}
            onChange={(v) =>
              executeCmd(
                new ChangePropertyCommand(
                  node.id,
                  "fontSize",
                  v,
                  node.fontSize,
                ),
              )
            }
          />
        </Field>
        <Field label="Weight">
          <SelectInput
            value={String(node.fontWeight)}
            onChange={(v) =>
              executeCmd(
                new ChangePropertyCommand(
                  node.id,
                  "fontWeight",
                  parseInt(v),
                  node.fontWeight,
                ),
              )
            }
            options={[
              { value: "300", label: "Light" },
              { value: "400", label: "Regular" },
              { value: "500", label: "Medium" },
              { value: "600", label: "Semi-Bold" },
              { value: "700", label: "Bold" },
            ]}
          />
        </Field>
        <Field label="Style">
          <SelectInput
            value={node.fontStyle}
            onChange={(v) =>
              executeCmd(
                new ChangePropertyCommand(
                  node.id,
                  "fontStyle",
                  v,
                  node.fontStyle,
                ),
              )
            }
            options={[
              { value: "normal", label: "Normal" },
              { value: "italic", label: "Italic" },
            ]}
          />
        </Field>
        <Field label="Align">
          <SelectInput
            value={node.textAnchor}
            onChange={(v) =>
              executeCmd(
                new ChangePropertyCommand(
                  node.id,
                  "textAnchor",
                  v,
                  node.textAnchor,
                ),
              )
            }
            options={[
              { value: "start", label: "Left" },
              { value: "middle", label: "Center" },
              { value: "end", label: "Right" },
            ]}
          />
        </Field>
      </div>

      <Field label="Color">
        <ThemedColorSelect
          value={node.fill}
          defaultValue="var(--io-text-primary)"
          onChange={(v) =>
            executeCmd(new ChangePropertyCommand(node.id, "fill", v, node.fill))
          }
        />
      </Field>

      <Field label="Max Width (0=none)">
        <NumberInput
          value={node.maxWidth ?? 0}
          min={0}
          max={4000}
          onChange={(v) =>
            executeCmd(
              new ChangePropertyCommand(
                node.id,
                "maxWidth",
                v || undefined,
                node.maxWidth,
              ),
            )
          }
        />
      </Field>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          marginBottom: 8,
        }}
      >
        <input
          type="checkbox"
          id="tb-bg"
          checked={showBg}
          onChange={(e) => {
            setShowBg(e.target.checked);
            if (!e.target.checked) {
              executeCmd(
                new ChangePropertyCommand(
                  node.id,
                  "background",
                  undefined,
                  node.background,
                ),
              );
            } else {
              executeCmd(
                new ChangePropertyCommand(
                  node.id,
                  "background",
                  {
                    fill: "#27272A",
                    stroke: "#3F3F46",
                    strokeWidth: 1,
                    padding: 8,
                    borderRadius: 2,
                  },
                  node.background,
                ),
              );
            }
          }}
          style={{ cursor: "pointer" }}
        />
        <label
          htmlFor="tb-bg"
          style={{
            fontSize: 11,
            color: "var(--io-text-muted)",
            cursor: "pointer",
          }}
        >
          Background Box
        </label>
      </div>

      {showBg && bg && (
        <div
          style={{
            paddingLeft: 8,
            borderLeft: "2px solid var(--io-border)",
            marginBottom: 8,
          }}
        >
          <Field label="Fill">
            <ColorInput
              value={bg.fill}
              onChange={(v) =>
                executeCmd(
                  new ChangePropertyCommand(
                    node.id,
                    "background",
                    { ...bg, fill: v },
                    bg,
                  ),
                )
              }
            />
          </Field>
          <Field label="Border Color">
            <ColorInput
              value={bg.stroke}
              onChange={(v) =>
                executeCmd(
                  new ChangePropertyCommand(
                    node.id,
                    "background",
                    { ...bg, stroke: v },
                    bg,
                  ),
                )
              }
            />
          </Field>
          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}
          >
            <Field label="Padding">
              <NumberInput
                value={bg.padding}
                min={0}
                max={40}
                onChange={(v) =>
                  executeCmd(
                    new ChangePropertyCommand(
                      node.id,
                      "background",
                      { ...bg, padding: v },
                      bg,
                    ),
                  )
                }
              />
            </Field>
            <Field label="Radius">
              <NumberInput
                value={bg.borderRadius}
                min={0}
                max={20}
                onChange={(v) =>
                  executeCmd(
                    new ChangePropertyCommand(
                      node.id,
                      "background",
                      { ...bg, borderRadius: v },
                      bg,
                    ),
                  )
                }
              />
            </Field>
          </div>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Pipe style section (stroke + dash + insulated)
// ---------------------------------------------------------------------------

function PipeStyleSection({
  node,
  executeCmd,
}: {
  node: Pipe;
  executeCmd: (cmd: SceneCommand) => void;
}) {
  return (
    <>
      <Field label="Stroke Width">
        <NumberInput
          value={node.strokeWidth}
          min={1}
          step={0.5}
          onChange={(v) =>
            executeCmd(
              new ChangePropertyCommand(
                node.id,
                "strokeWidth",
                v,
                node.strokeWidth,
              ),
            )
          }
        />
      </Field>
      <Field label="Line Style">
        <SelectInput
          value={node.dashPattern ?? ""}
          onChange={(v) =>
            executeCmd(
              new ChangePropertyCommand(
                node.id,
                "dashPattern",
                v || undefined,
                node.dashPattern,
              ),
            )
          }
          options={[
            { value: "", label: "Solid" },
            { value: "8 4", label: "Dashed" },
            { value: "2 4", label: "Dotted" },
            { value: "12 4 2 4", label: "Dash-Dot" },
          ]}
        />
      </Field>
      <Field label="Insulated">
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          <input
            type="checkbox"
            checked={!!node.insulated}
            onChange={(e) =>
              executeCmd(
                new ChangePropertyCommand(
                  node.id,
                  "insulated",
                  e.target.checked || undefined,
                  node.insulated,
                ),
              )
            }
          />
          <span style={{ color: "var(--io-text-secondary)" }}>
            Show insulation indicator
          </span>
        </label>
      </Field>
      <div
        style={{
          marginTop: 4,
          padding: "6px 8px",
          background: "var(--io-surface-elevated)",
          borderRadius: "var(--io-radius)",
          fontSize: 10,
          color: "var(--io-text-muted)",
        }}
      >
        Pipe color is fixed by ISA 18.2 service type — change service in the
        Data tab.
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Pipe data section (service type + routing + label)
// ---------------------------------------------------------------------------

const PIPE_SERVICE_OPTIONS = Object.entries(PIPE_SERVICE_COLORS).map(
  ([k, color]) => ({
    value: k,
    label: k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    color,
  }),
);

function PipeDataSection({
  node,
  executeCmd,
}: {
  node: Pipe;
  executeCmd: (cmd: SceneCommand) => void;
}) {
  const currentColor =
    PIPE_SERVICE_COLORS[node.serviceType as keyof typeof PIPE_SERVICE_COLORS] ??
    "#6B8CAE";

  return (
    <>
      <Field label="Service Type">
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div
            style={{
              width: 16,
              height: 16,
              borderRadius: 3,
              background: currentColor,
              border: "1px solid var(--io-border)",
              flexShrink: 0,
            }}
            title={`ISA 18.2 service color: ${currentColor}`}
          />
          <div style={{ flex: 1 }}>
            <SelectInput
              value={node.serviceType}
              onChange={(v) =>
                executeCmd(
                  new ChangePropertyCommand(
                    node.id,
                    "serviceType",
                    v,
                    node.serviceType,
                  ),
                )
              }
              options={PIPE_SERVICE_OPTIONS}
            />
          </div>
        </div>
      </Field>
      <Field label="Routing">
        <SelectInput
          value={node.routingMode}
          onChange={(v) =>
            executeCmd(
              new ChangePropertyCommand(
                node.id,
                "routingMode",
                v,
                node.routingMode,
              ),
            )
          }
          options={[
            { value: "manual", label: "Manual" },
            { value: "auto", label: "Auto (Orthogonal)" },
          ]}
        />
      </Field>
      <Field label="Label">
        <input
          type="text"
          key={node.id}
          defaultValue={node.label ?? ""}
          onBlur={(e) =>
            executeCmd(
              new ChangePropertyCommand(
                node.id,
                "label",
                e.target.value || undefined,
                node.label,
              ),
            )
          }
          style={inputStyle}
          placeholder="Optional label…"
        />
      </Field>
    </>
  );
}

// ---------------------------------------------------------------------------
// SymbolInstance — Shape tab (variant + configuration, no composable parts)
// ---------------------------------------------------------------------------

function SymbolInstanceShapeTab({ node }: { node: SymbolInstance }) {
  const executeCmd = useExecuteCmd();
  const getShape = useLibraryStore((s) => s.getShape);
  const shapeEntry = getShape(node.shapeRef.shapeId);
  const variants = shapeEntry?.sidecar.options ?? [];
  const configurations = shapeEntry?.sidecar.configurations ?? [];
  const connections = shapeEntry?.sidecar.connections ?? [];
  const textZones = shapeEntry?.sidecar.textZones ?? [];
  const valueAnchors = shapeEntry?.sidecar.valueAnchors ?? [];

  return (
    <div style={{ padding: "0 12px" }}>
      <Field label="Shape ID">
        <input
          readOnly
          value={node.shapeRef.shapeId}
          style={{
            ...inputStyle,
            color: "var(--io-text-muted)",
            fontFamily: "monospace",
            fontSize: 10,
          }}
        />
      </Field>

      {variants.length > 0 && (
        <Field label="Variant">
          <SelectInput
            value={node.shapeRef.variant ?? "default"}
            onChange={(v) =>
              executeCmd(
                new ChangeShapeVariantCommand(
                  node.id,
                  v,
                  node.shapeRef.variant ?? "default",
                ),
              )
            }
            options={[
              { value: "default", label: "Default" },
              ...variants.map((opt) => ({ value: opt.id, label: opt.label })),
            ]}
          />
        </Field>
      )}

      {configurations.length > 0 && (
        <Field label="Configuration">
          <SelectInput
            value={node.shapeRef.configuration ?? "default"}
            onChange={(v) =>
              executeCmd(
                new ChangeShapeConfigurationCommand(
                  node.id,
                  v === "default" ? undefined : v,
                  node.shapeRef.configuration,
                ),
              )
            }
            options={[
              { value: "default", label: "Default" },
              ...configurations.map((cfg) => ({
                value: cfg.id,
                label: cfg.label,
              })),
            ]}
          />
        </Field>
      )}

      {shapeEntry && (
        <div
          style={{
            marginTop: 8,
            padding: "8px 10px",
            background: "var(--io-surface-elevated)",
            borderRadius: "var(--io-radius)",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--io-text-muted)",
              marginBottom: 2,
            }}
          >
            Shape Info
          </div>
          {[
            { label: "Connections", count: connections.length },
            { label: "Text Zones", count: textZones.length },
            { label: "Data Anchors", count: valueAnchors.length },
          ].map(({ label, count }) => (
            <div
              key={label}
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 11,
              }}
            >
              <span style={{ color: "var(--io-text-secondary)" }}>{label}</span>
              <span
                style={{
                  color:
                    count > 0 ? "var(--io-accent)" : "var(--io-text-muted)",
                  fontWeight: 600,
                }}
              >
                {count}
              </span>
            </div>
          ))}
          {shapeEntry.sidecar.category && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: 11,
              }}
            >
              <span style={{ color: "var(--io-text-secondary)" }}>
                Category
              </span>
              <span style={{ color: "var(--io-text-muted)" }}>
                {shapeEntry.sidecar.category}
              </span>
            </div>
          )}
        </div>
      )}

      <div
        style={{
          marginTop: 8,
          padding: "6px 8px",
          background: "var(--io-surface-elevated)",
          borderRadius: "var(--io-radius)",
          fontSize: 10,
          color: "var(--io-text-muted)",
        }}
      >
        Colors follow the ISA 18.2 operational state and alarm priority model —
        not individually configurable. Use variants to change appearance.
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SymbolInstance — Data tab (primary binding + child DE bindings)
// ---------------------------------------------------------------------------

function SymbolInstanceDataTab({ node }: { node: SymbolInstance }) {
  const executeCmd = useExecuteCmd();
  const children = node.children ?? [];

  return (
    <div style={{ padding: "0 12px" }}>
      <Field label="Primary Point (State)">
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <input
            type="text"
            key={node.id}
            defaultValue={
              node.stateBinding?.pointTag ?? node.stateBinding?.pointId ?? ""
            }
            onBlur={(e) => {
              const val = e.target.value.trim();
              const isUuid =
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
                  val,
                );
              const newBinding = val
                ? isUuid
                  ? { pointId: val }
                  : { pointTag: val }
                : undefined;
              executeCmd(
                new ChangePropertyCommand(
                  node.id,
                  "stateBinding",
                  newBinding,
                  node.stateBinding,
                ),
              );
            }}
            style={{ ...inputStyle, flex: 1 }}
            placeholder="e.g. 25-AI-1401"
          />
          <PointResolutionIndicator
            pointId={node.stateBinding?.pointTag ?? node.stateBinding?.pointId}
          />
        </div>
        <div
          style={{ fontSize: 10, color: "var(--io-text-muted)", marginTop: 3 }}
        >
          Drives alarm state, operational status, and shape animation
        </div>
      </Field>

      {children.length > 0 && (
        <div style={{ marginTop: 4 }}>
          <FieldLabel>Display Element Bindings</FieldLabel>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              marginTop: 4,
            }}
          >
            {children.map((child) => {
              const de = child as DisplayElement;
              const boundTag =
                de.binding?.pointTag ?? de.binding?.pointId ?? "";
              return (
                <div key={de.id}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      marginBottom: 3,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        color: "var(--io-accent)",
                        background: "var(--io-surface-elevated)",
                        padding: "1px 5px",
                        borderRadius: 3,
                      }}
                    >
                      {de.displayType?.replace(/_/g, " ") ?? "DE"}
                    </span>
                    <button
                      onClick={() =>
                        useUiStore.getState().setSelectedNodes([de.id])
                      }
                      style={{
                        fontSize: 10,
                        color: "var(--io-text-muted)",
                        background: "transparent",
                        border: "none",
                        cursor: "pointer",
                        padding: 0,
                        textDecoration: "underline",
                      }}
                      title="Select this display element"
                    >
                      configure →
                    </button>
                  </div>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: 4 }}
                  >
                    <input
                      type="text"
                      key={de.id}
                      defaultValue={boundTag}
                      onBlur={(e) => {
                        const val = e.target.value.trim();
                        const isUuid =
                          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
                            val,
                          );
                        const newBinding = val
                          ? isUuid
                            ? { pointId: val }
                            : { pointTag: val }
                          : {};
                        executeCmd(
                          new ChangeBindingCommand(
                            de.id,
                            newBinding,
                            de.binding,
                          ),
                        );
                      }}
                      style={{ ...inputStyle, flex: 1 }}
                      placeholder="Point tag…"
                    />
                    <PointResolutionIndicator
                      pointId={de.binding?.pointTag ?? de.binding?.pointId}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {children.length === 0 && (
        <div
          style={{
            marginTop: 4,
            padding: "8px 10px",
            background: "var(--io-surface-elevated)",
            borderRadius: "var(--io-radius)",
            fontSize: 11,
            color: "var(--io-text-muted)",
          }}
        >
          No display elements on this shape. Select a display element slot from
          the canvas to configure secondary data bindings.
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SymbolInstance — Sidecars tab (inline anchor slots + extras + add)
// ---------------------------------------------------------------------------

const cardStyle: React.CSSProperties = {
  background: "var(--io-surface-elevated)",
  border: "1px solid var(--io-border)",
  borderRadius: "var(--io-radius)",
  padding: 8,
};

const chipStyle: React.CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--io-accent)",
};

function DeBindingAndConfig({
  de,
  executeCmd,
}: {
  de: DisplayElement;
  executeCmd: (cmd: SceneCommand) => void;
}) {
  return (
    <div
      style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 8 }}
    >
      <Field label="Type">
        <SelectInput
          value={de.displayType}
          onChange={(v) => {
            const newType = v as DisplayElementType;
            if (newType !== de.displayType) {
              executeCmd(
                new ChangeDisplayElementTypeCommand(
                  de.id,
                  newType,
                  defaultConfig(newType),
                  de.displayType,
                  de.config,
                ),
              );
            }
          }}
          options={DISPLAY_ELEMENT_TYPE_OPTIONS}
        />
      </Field>
      <Field label="Binding (Point Tag)">
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <input
            type="text"
            key={de.id + "-binding"}
            defaultValue={de.binding?.pointTag ?? de.binding?.pointId ?? ""}
            onBlur={(e) => {
              const val = e.target.value.trim();
              const isUuid =
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
                  val,
                );
              const newBinding = val
                ? isUuid
                  ? { pointId: val }
                  : { pointTag: val }
                : {};
              executeCmd(
                new ChangeBindingCommand(de.id, newBinding, de.binding),
              );
            }}
            style={{ ...inputStyle, flex: 1 }}
            placeholder="e.g. 25-AI-1401"
          />
          <PointResolutionIndicator
            pointId={de.binding?.pointTag ?? de.binding?.pointId}
          />
        </div>
      </Field>
      <DisplayElementTypeFields node={de} executeCmd={executeCmd} />
    </div>
  );
}

function AnchorSlotCard({
  index,
  anchor,
  slotId,
  activeDe,
  symbolId,
  executeCmd,
}: {
  index: number;
  anchor: ValueAnchor;
  slotId: string;
  activeDe: DisplayElement | undefined;
  symbolId: NodeId;
  executeCmd: (cmd: SceneCommand) => void;
}) {
  const active = !!activeDe && !activeDe.hidden;

  function handleToggle() {
    if (activeDe) {
      executeCmd(new HideDisplayElementCommand(activeDe.id));
    } else {
      const preferred =
        (anchor.preferredElement as DisplayElementType) ?? "text_readout";
      executeCmd(
        new AddDisplayElementCommand(symbolId, {
          id: crypto.randomUUID() as NodeId,
          type: "display_element",
          displayType: preferred,
          transform: {
            position: { x: 0, y: 0 },
            rotation: 0,
            scale: { x: 1, y: 1 },
            mirror: "none",
          },
          binding: {},
          config: defaultConfig(preferred),
          opacity: 1,
          visible: true,
          locked: false,
          slotId,
        }),
      );
    }
  }

  return (
    <div style={cardStyle}>
      {/* Header row — always full opacity so checkbox is always clickable */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <input
          type="checkbox"
          checked={active}
          onChange={handleToggle}
          style={{ cursor: "pointer" }}
        />
        <span
          style={{
            fontSize: 11,
            fontWeight: 600,
            color: "var(--io-text-primary)",
            flex: 1,
          }}
        >
          Slot {index + 1}
        </span>
        {anchor.preferredElement && (
          <span style={chipStyle}>
            {anchor.preferredElement.replace(/_/g, " ")}
          </span>
        )}
      </div>
      {/* Body — dimmed when inactive */}
      {activeDe && (
        <div style={{ opacity: active ? 1 : 0.45 }}>
          <DeBindingAndConfig de={activeDe} executeCmd={executeCmd} />
          <button
            onClick={() =>
              executeCmd(new RemoveDisplayElementCommand(activeDe.id))
            }
            style={{
              marginTop: 6,
              background: "transparent",
              border: "none",
              color: "var(--io-text-muted)",
              fontSize: 10,
              cursor: "pointer",
              padding: 0,
            }}
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}

function ExtraSidecarCard({
  de,
  executeCmd,
}: {
  de: DisplayElement;
  executeCmd: (cmd: SceneCommand) => void;
}) {
  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={chipStyle}>
          {de.displayType?.replace(/_/g, " ") ?? "DE"}
        </span>
        <button
          onClick={() => executeCmd(new RemoveDisplayElementCommand(de.id))}
          style={{
            marginLeft: "auto",
            background: "transparent",
            border: "none",
            color: "var(--io-text-muted)",
            fontSize: 14,
            cursor: "pointer",
            padding: "0 2px",
            lineHeight: 1,
          }}
          title="Remove this sidecar"
        >
          ×
        </button>
      </div>
      <DeBindingAndConfig de={de} executeCmd={executeCmd} />
    </div>
  );
}

function AddSidecarRow({
  open,
  setOpen,
  onPick,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  onPick: (t: DisplayElementType) => void;
}) {
  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          width: "100%",
          padding: "6px 8px",
          background: "transparent",
          border: "1px dashed var(--io-border)",
          borderRadius: "var(--io-radius)",
          color: "var(--io-text-secondary)",
          fontSize: 11,
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        + Add Sidecar
      </button>
    );
  }
  return (
    <div
      style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 4,
        padding: 6,
        background: "var(--io-surface-elevated)",
        border: "1px solid var(--io-border)",
        borderRadius: "var(--io-radius)",
      }}
    >
      {DISPLAY_ELEMENT_TYPE_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onPick(opt.value)}
          style={{
            padding: "4px 8px",
            fontSize: 11,
            background: "var(--io-surface)",
            border: "1px solid var(--io-border)",
            borderRadius: "var(--io-radius)",
            color: "var(--io-text-primary)",
            cursor: "pointer",
          }}
        >
          {opt.label}
        </button>
      ))}
      <button
        onClick={() => setOpen(false)}
        style={{
          marginLeft: "auto",
          padding: "4px 8px",
          fontSize: 11,
          background: "transparent",
          border: "none",
          color: "var(--io-text-muted)",
          cursor: "pointer",
        }}
      >
        Cancel
      </button>
    </div>
  );
}

function SymbolInstanceSidecarsTab({ node }: { node: SymbolInstance }) {
  const executeCmd = useExecuteCmd();
  const getShape = useLibraryStore((s) => s.getShape);
  const shapeEntry = getShape(node.shapeRef.shapeId);
  const anchors: ValueAnchor[] = shapeEntry?.sidecar.valueAnchors ?? [];
  const textZones = shapeEntry?.sidecar.textZones ?? [];
  const children = (node.children ?? []) as DisplayElement[];
  const [addPickerOpen, setAddPickerOpen] = useState(false);

  const slotIdFor = (i: number) => `anchor-${i}`;
  const anchorSlotIds = new Set(anchors.map((_, i) => slotIdFor(i)));
  const findSlotDe = (sid: string) => children.find((c) => c.slotId === sid);
  const extras = children.filter(
    (c) => !c.slotId || !anchorSlotIds.has(c.slotId),
  );

  const isEmpty =
    anchors.length === 0 && extras.length === 0 && textZones.length === 0;

  return (
    <div
      style={{
        padding: "0 12px",
        display: "flex",
        flexDirection: "column",
        gap: 14,
      }}
    >
      {/* Anchor slots */}
      {anchors.length > 0 && (
        <div>
          <FieldLabel>Anchor Slots</FieldLabel>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              marginTop: 4,
            }}
          >
            {anchors.map((anchor, i) => (
              <AnchorSlotCard
                key={i}
                index={i}
                anchor={anchor}
                slotId={slotIdFor(i)}
                activeDe={findSlotDe(slotIdFor(i))}
                symbolId={node.id}
                executeCmd={executeCmd}
              />
            ))}
          </div>
        </div>
      )}

      {/* Text zone overrides */}
      {textZones.length > 0 && (
        <div>
          <FieldLabel>Text Zone Overrides</FieldLabel>
          <div
            style={{
              fontSize: 10,
              color: "var(--io-text-muted)",
              marginBottom: 6,
              marginTop: 2,
            }}
          >
            Override static text zones. Leave blank to show live data.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {textZones.map((zone) => {
              const overrideVal =
                (node.textZoneOverrides as Record<string, string>)?.[zone.id] ??
                "";
              return (
                <div key={zone.id}>
                  <div
                    style={{
                      fontSize: 10,
                      color: "var(--io-text-secondary)",
                      marginBottom: 2,
                      fontWeight: 600,
                    }}
                    title={zone.id}
                  >
                    {zone.id}
                  </div>
                  <input
                    type="text"
                    key={`${node.id}-${zone.id}`}
                    defaultValue={overrideVal}
                    placeholder="(live data)"
                    onBlur={(e) => {
                      const v = e.target.value;
                      const overrides = {
                        ...((node.textZoneOverrides as Record<
                          string,
                          string
                        >) ?? {}),
                      };
                      if (v) overrides[zone.id] = v;
                      else delete overrides[zone.id];
                      executeCmd(
                        new ChangePropertyCommand(
                          node.id,
                          "textZoneOverrides",
                          overrides,
                          node.textZoneOverrides,
                        ),
                      );
                    }}
                    style={inputStyle}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Extra sidecars (no matching anchor slot) */}
      {extras.length > 0 && (
        <div>
          <FieldLabel>Extra Sidecars</FieldLabel>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              marginTop: 4,
            }}
          >
            {extras.map((de) => (
              <ExtraSidecarCard key={de.id} de={de} executeCmd={executeCmd} />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {isEmpty && (
        <div
          style={{
            padding: "12px 0",
            fontSize: 11,
            color: "var(--io-text-muted)",
          }}
        >
          This shape has no anchor slots. Use "Add Sidecar" below to attach a
          display element.
        </div>
      )}

      {/* Add sidecar */}
      <AddSidecarRow
        open={addPickerOpen}
        setOpen={setAddPickerOpen}
        onPick={(t) => {
          executeCmd(
            new AddDisplayElementCommand(node.id, {
              id: crypto.randomUUID() as NodeId,
              type: "display_element",
              displayType: t,
              transform: {
                position: { x: 0, y: 0 },
                rotation: 0,
                scale: { x: 1, y: 1 },
                mirror: "none",
              },
              binding: {},
              config: defaultConfig(t),
              opacity: 1,
              visible: true,
              locked: false,
              sidecarOrder: children.length,
            }),
          );
          setAddPickerOpen(false);
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// DisplayElement — Data tab (type switcher + binding)
// ---------------------------------------------------------------------------

function DisplayElementDataTab({ node }: { node: DisplayElement }) {
  const executeCmd = useExecuteCmd();

  return (
    <div style={{ padding: "0 12px" }}>
      <Field label="Type">
        <SelectInput
          value={node.displayType}
          onChange={(v) => {
            const newType = v as DisplayElementType;
            if (newType !== node.displayType) {
              executeCmd(
                new ChangeDisplayElementConfigCommand(
                  node.id,
                  defaultConfig(newType),
                  node.config,
                ),
              );
            }
          }}
          options={DISPLAY_ELEMENT_TYPE_OPTIONS}
        />
      </Field>
      <Field label="Binding (Point Tag)">
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <input
            type="text"
            key={node.id}
            defaultValue={node.binding.pointTag ?? node.binding.pointId ?? ""}
            onBlur={(e) => {
              const val = e.target.value.trim();
              const isUuid =
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
                  val,
                );
              const newBinding = val
                ? isUuid
                  ? { pointId: val }
                  : { pointTag: val }
                : {};
              executeCmd(
                new ChangeBindingCommand(node.id, newBinding, node.binding),
              );
            }}
            style={{ ...inputStyle, flex: 1 }}
            placeholder="e.g. 25-AI-1401"
          />
          <PointResolutionIndicator
            pointId={node.binding.pointTag ?? node.binding.pointId}
          />
        </div>
      </Field>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DisplayElement — Content tab (type-specific config fields)
// ---------------------------------------------------------------------------

function DisplayElementContentTab({ node }: { node: DisplayElement }) {
  const executeCmd = useExecuteCmd();
  return (
    <div style={{ padding: "0 12px" }}>
      <DisplayElementTypeFields node={node} executeCmd={executeCmd} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// DisplayElement — Layout tab (opacity + nav link)
// ---------------------------------------------------------------------------

function DisplayElementLayoutTab({ node }: { node: DisplayElement }) {
  const executeCmd = useExecuteCmd();
  return (
    <div style={{ padding: "0 12px" }}>
      <Field label="Opacity %">
        <NumberInput
          value={Math.round(node.opacity * 100)}
          min={0}
          max={100}
          onChange={(v) =>
            executeCmd(
              new ChangePropertyCommand(
                node.id,
                "opacity",
                v / 100,
                node.opacity,
              ),
            )
          }
        />
      </Field>
      <div style={{ display: "flex", gap: 12, marginBottom: 10 }}>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontSize: 11,
            cursor: "pointer",
            color: "var(--io-text-secondary)",
          }}
        >
          <input
            type="checkbox"
            checked={node.visible}
            onChange={(e) =>
              executeCmd(
                new ChangePropertyCommand(
                  node.id,
                  "visible",
                  e.target.checked,
                  node.visible,
                ),
              )
            }
            style={{ cursor: "pointer" }}
          />
          Visible
        </label>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontSize: 11,
            cursor: "pointer",
            color: "var(--io-text-secondary)",
          }}
        >
          <input
            type="checkbox"
            checked={node.locked}
            onChange={(e) =>
              executeCmd(
                new ChangePropertyCommand(
                  node.id,
                  "locked",
                  e.target.checked,
                  node.locked,
                ),
              )
            }
            style={{ cursor: "pointer" }}
          />
          Locked
        </label>
      </div>
      <NavigationLinkEditor
        nodeId={node.id}
        link={node.navigationLink}
        prevLink={node.navigationLink}
        executeCmd={executeCmd}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Group — special name field with sync
// ---------------------------------------------------------------------------

function GroupNameField({
  node,
  executeCmd,
}: {
  node: Group;
  executeCmd: (cmd: SceneCommand) => void;
}) {
  const [nameValue, setNameValue] = useState(node.name ?? "");
  React.useEffect(() => {
    setNameValue(node.name ?? "");
  }, [node.name]);

  return (
    <>
      <Field label="Name">
        <input
          value={nameValue}
          onChange={(e) => setNameValue(e.target.value)}
          onBlur={() => {
            const trimmed = nameValue.trim();
            if (trimmed !== (node.name ?? "")) {
              executeCmd(
                new ChangePropertyCommand(
                  node.id,
                  "name",
                  trimmed || undefined,
                  node.name,
                ),
              );
            } else {
              setNameValue(node.name ?? "");
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") {
              setNameValue(node.name ?? "");
              (e.target as HTMLInputElement).blur();
            }
          }}
          style={inputStyle}
          placeholder="Group name"
        />
      </Field>
      <Field label="Children">
        <input
          readOnly
          value={`${node.children.length} elements`}
          style={{ ...inputStyle, color: "var(--io-text-muted)" }}
        />
      </Field>
    </>
  );
}

// ---------------------------------------------------------------------------
// Image node layout extras
// ---------------------------------------------------------------------------

function ImageLayoutExtras({
  node,
  executeCmd,
}: {
  node: ImageNode;
  executeCmd: (cmd: SceneCommand) => void;
}) {
  return (
    <>
      <Field label="Source">
        <input
          readOnly
          value={
            node.assetRef.originalFilename ??
            node.assetRef.hash.slice(0, 12) + "…"
          }
          style={{ ...inputStyle, color: "var(--io-text-muted)" }}
        />
      </Field>
      <Field label="Original Size">
        <input
          readOnly
          value={`${node.assetRef.originalWidth} × ${node.assetRef.originalHeight} px`}
          style={{ ...inputStyle, color: "var(--io-text-muted)" }}
        />
      </Field>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 6,
          marginBottom: 6,
        }}
      >
        <Field label="Display W">
          <NumberInput
            value={node.displayWidth}
            min={1}
            onChange={(v) =>
              executeCmd(
                new ChangePropertyCommand(
                  node.id,
                  "displayWidth",
                  v,
                  node.displayWidth,
                ),
              )
            }
          />
        </Field>
        <Field label="Display H">
          <NumberInput
            value={node.displayHeight}
            min={1}
            onChange={(v) =>
              executeCmd(
                new ChangePropertyCommand(
                  node.id,
                  "displayHeight",
                  v,
                  node.displayHeight,
                ),
              )
            }
          />
        </Field>
      </div>
      <Field label="Preserve Aspect Ratio">
        <input
          type="checkbox"
          checked={node.preserveAspectRatio}
          onChange={(e) =>
            executeCmd(
              new ChangePropertyCommand(
                node.id,
                "preserveAspectRatio",
                e.target.checked,
                node.preserveAspectRatio,
              ),
            )
          }
          style={{ cursor: "pointer" }}
        />
      </Field>
      <Field label="Image Rendering">
        <SelectInput
          value={node.imageRendering}
          onChange={(v) =>
            executeCmd(
              new ChangePropertyCommand(
                node.id,
                "imageRendering",
                v,
                node.imageRendering,
              ),
            )
          }
          options={[
            { value: "auto", label: "Auto (Smooth)" },
            { value: "pixelated", label: "Pixelated" },
            { value: "crisp-edges", label: "Crisp Edges" },
          ]}
        />
      </Field>
    </>
  );
}

// ---------------------------------------------------------------------------
// EmbeddedSvg layout extras
// ---------------------------------------------------------------------------

function EmbeddedSvgLayoutExtras({
  node,
  executeCmd,
}: {
  node: EmbeddedSvgNode;
  executeCmd: (cmd: SceneCommand) => void;
}) {
  return (
    <>
      {node.source && (
        <Field label="Source">
          <input
            readOnly
            value={node.source.importedFrom}
            style={{ ...inputStyle, color: "var(--io-text-muted)" }}
          />
        </Field>
      )}
      <Field label="ViewBox">
        <input
          readOnly
          value={node.viewBox}
          style={{
            ...inputStyle,
            color: "var(--io-text-muted)",
            fontFamily: "monospace",
            fontSize: 11,
          }}
        />
      </Field>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 6,
          marginBottom: 6,
        }}
      >
        <Field label="Width">
          <NumberInput
            value={node.width}
            min={1}
            onChange={(v) =>
              executeCmd(
                new ChangePropertyCommand(node.id, "width", v, node.width),
              )
            }
          />
        </Field>
        <Field label="Height">
          <NumberInput
            value={node.height}
            min={1}
            onChange={(v) =>
              executeCmd(
                new ChangePropertyCommand(node.id, "height", v, node.height),
              )
            }
          />
        </Field>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Stencil layout extras
// ---------------------------------------------------------------------------

function StencilLayoutExtras({
  node,
  executeCmd,
}: {
  node: Stencil;
  executeCmd: (cmd: SceneCommand) => void;
}) {
  return (
    <>
      <Field label="Stencil ID">
        <input
          readOnly
          value={node.stencilRef.stencilId}
          style={{
            ...inputStyle,
            color: "var(--io-text-muted)",
            fontFamily: "monospace",
            fontSize: 10,
          }}
        />
      </Field>
      {node.stencilRef.version && (
        <Field label="Version">
          <input
            readOnly
            value={node.stencilRef.version}
            style={{ ...inputStyle, color: "var(--io-text-muted)" }}
          />
        </Field>
      )}
      {node.size && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 6,
            marginBottom: 6,
          }}
        >
          <Field label="Width">
            <NumberInput
              value={node.size.width}
              min={1}
              onChange={(v) =>
                executeCmd(
                  new ChangePropertyCommand(
                    node.id,
                    "size",
                    { ...node.size, width: v },
                    node.size,
                  ),
                )
              }
            />
          </Field>
          <Field label="Height">
            <NumberInput
              value={node.size.height}
              min={1}
              onChange={(v) =>
                executeCmd(
                  new ChangePropertyCommand(
                    node.id,
                    "size",
                    { ...node.size, height: v },
                    node.size,
                  ),
                )
              }
            />
          </Field>
        </div>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Widget layout extras + content
// ---------------------------------------------------------------------------

function WidgetLayoutExtras({
  node,
  executeCmd,
}: {
  node: WidgetNode;
  executeCmd: (cmd: SceneCommand) => void;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 6,
        marginBottom: 6,
      }}
    >
      <Field label="Width">
        <NumberInput
          value={node.width}
          min={80}
          max={2000}
          onChange={(v) =>
            executeCmd(
              new ChangePropertyCommand(node.id, "width", v, node.width),
            )
          }
        />
      </Field>
      <Field label="Height">
        <NumberInput
          value={node.height}
          min={60}
          max={1200}
          onChange={(v) =>
            executeCmd(
              new ChangePropertyCommand(node.id, "height", v, node.height),
            )
          }
        />
      </Field>
    </div>
  );
}

const WIDGET_TYPE_OPTIONS = [
  { value: "trend", label: "Trend" },
  { value: "table", label: "Table" },
  { value: "gauge", label: "Gauge" },
  { value: "kpi_card", label: "KPI Card" },
  { value: "bar_chart", label: "Bar Chart" },
  { value: "pie_chart", label: "Pie Chart" },
  { value: "alarm_list", label: "Alarm List" },
  { value: "muster_point", label: "Muster Point" },
];

function WidgetContentTab({ node }: { node: WidgetNode }) {
  const executeCmd = useExecuteCmd();
  function patchConfig(patch: Partial<WidgetConfig>) {
    const newConfig = { ...node.config, ...patch } as WidgetConfig;
    executeCmd(new ChangeWidgetConfigCommand(node.id, newConfig, node.config));
  }
  const title = (node.config as { title?: string }).title ?? "";

  return (
    <div style={{ padding: "0 12px" }}>
      <Field label="Widget Type">
        <SelectInput
          value={node.widgetType}
          onChange={() => {
            /* type change not supported here — drag new widget */
          }}
          options={WIDGET_TYPE_OPTIONS}
        />
      </Field>
      <Field label="Title">
        <input
          type="text"
          key={node.id}
          defaultValue={title}
          onBlur={(e) =>
            patchConfig({ title: e.target.value } as Partial<WidgetConfig>)
          }
          style={inputStyle}
          placeholder="Widget title…"
        />
      </Field>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Annotation content tab
// ---------------------------------------------------------------------------

function AnnotationContentTab({ node }: { node: Annotation }) {
  const executeCmd = useExecuteCmd();
  const cfg = node.config as unknown as Record<string, unknown>;

  return (
    <div style={{ padding: "0 12px" }}>
      <Field label="Type">
        <input
          readOnly
          value={node.annotationType.replace(/_/g, " ")}
          style={{
            ...inputStyle,
            color: "var(--io-text-muted)",
            textTransform: "capitalize",
          }}
        />
      </Field>
      {"color" in cfg && (
        <Field label="Color">
          <ThemedColorSelect
            value={cfg.color as string | undefined}
            defaultValue="var(--io-text-secondary)"
            onChange={(v) =>
              executeCmd(
                new ChangePropertyCommand(
                  node.id,
                  "config",
                  { ...cfg, color: v },
                  cfg,
                ),
              )
            }
          />
        </Field>
      )}
      {"content" in cfg && (
        <Field label="Content">
          <input
            type="text"
            key={node.id + "-content"}
            defaultValue={(cfg.content as string) ?? ""}
            onBlur={(e) =>
              executeCmd(
                new ChangePropertyCommand(
                  node.id,
                  "config",
                  { ...cfg, content: e.target.value },
                  cfg,
                ),
              )
            }
            style={inputStyle}
          />
        </Field>
      )}
      {"text" in cfg && (
        <Field label="Text">
          <input
            type="text"
            key={node.id + "-text"}
            defaultValue={(cfg.text as string) ?? ""}
            onBlur={(e) =>
              executeCmd(
                new ChangePropertyCommand(
                  node.id,
                  "config",
                  { ...cfg, text: e.target.value },
                  cfg,
                ),
              )
            }
            style={inputStyle}
          />
        </Field>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Annotation layout extras (width/height from node, not config)
// ---------------------------------------------------------------------------

function AnnotationLayoutExtras({
  node,
  executeCmd,
}: {
  node: Annotation;
  executeCmd: (cmd: SceneCommand) => void;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 6,
        marginBottom: 6,
      }}
    >
      <Field label="Width">
        <NumberInput
          value={node.width}
          min={1}
          onChange={(v) =>
            executeCmd(
              new ChangePropertyCommand(node.id, "width", v, node.width),
            )
          }
        />
      </Field>
      <Field label="Height">
        <NumberInput
          value={node.height}
          min={1}
          onChange={(v) =>
            executeCmd(
              new ChangePropertyCommand(node.id, "height", v, node.height),
            )
          }
        />
      </Field>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pipe opacity field (pipes have no positional transform fields in the panel)
// ---------------------------------------------------------------------------

function PipeLayoutTab({
  node,
  doc,
  executeCmd,
}: {
  node: Pipe;
  doc: GraphicDocument | null;
  executeCmd: (cmd: SceneCommand) => void;
}) {
  return (
    <div style={{ padding: "0 12px" }}>
      <Field label="Opacity %">
        <NumberInput
          value={Math.round(node.opacity * 100)}
          min={0}
          max={100}
          onChange={(v) =>
            executeCmd(
              new ChangePropertyCommand(
                node.id,
                "opacity",
                v / 100,
                node.opacity,
              ),
            )
          }
        />
      </Field>
      <div style={{ display: "flex", gap: 12, marginBottom: 10 }}>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontSize: 11,
            cursor: "pointer",
            color: "var(--io-text-secondary)",
          }}
        >
          <input
            type="checkbox"
            checked={node.visible}
            onChange={(e) =>
              executeCmd(
                new ChangePropertyCommand(
                  node.id,
                  "visible",
                  e.target.checked,
                  node.visible,
                ),
              )
            }
            style={{ cursor: "pointer" }}
          />
          Visible
        </label>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontSize: 11,
            cursor: "pointer",
            color: "var(--io-text-secondary)",
          }}
        >
          <input
            type="checkbox"
            checked={node.locked}
            onChange={(e) =>
              executeCmd(
                new ChangePropertyCommand(
                  node.id,
                  "locked",
                  e.target.checked,
                  node.locked,
                ),
              )
            }
            style={{ cursor: "pointer" }}
          />
          Locked
        </label>
      </div>
      {doc && (
        <Field label="Layer">
          <SelectInput
            value={node.layerId ?? ""}
            onChange={(v) =>
              executeCmd(
                new ChangePropertyCommand(
                  node.id,
                  "layerId",
                  v || undefined,
                  node.layerId,
                ),
              )
            }
            options={[
              { value: "", label: "— None —" },
              ...doc.layers.map((l) => ({ value: l.id, label: l.name })),
            ]}
          />
        </Field>
      )}
      <div
        style={{
          padding: "6px 8px",
          background: "var(--io-surface-elevated)",
          borderRadius: "var(--io-radius)",
          fontSize: 10,
          color: "var(--io-text-muted)",
          marginTop: 4,
        }}
      >
        Pipe routing is defined by connection endpoints on the canvas.
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DisplayElement type options + default config
// ---------------------------------------------------------------------------

const DISPLAY_ELEMENT_TYPE_OPTIONS: Array<{
  value: DisplayElementType;
  label: string;
}> = [
  { value: "text_readout", label: "Text Readout" },
  { value: "analog_bar", label: "Analog Bar" },
  { value: "fill_gauge", label: "Fill Gauge" },
  { value: "sparkline", label: "Sparkline" },
  { value: "alarm_indicator", label: "Alarm Indicator" },
  { value: "digital_status", label: "Digital Status" },
  { value: "point_name_label", label: "Point Name Label" },
];

/** Build a minimal valid default config for a given display element type */
function defaultConfig(type: DisplayElementType): DisplayElementConfig {
  switch (type) {
    case "text_readout":
      return {
        displayType: "text_readout",
        showBox: false,
        showLabel: false,
        showUnits: false,
        valueFormat: "0.##",
        minWidth: 60,
      };
    case "analog_bar":
      return {
        displayType: "analog_bar",
        orientation: "vertical",
        barWidth: 20,
        barHeight: 80,
        rangeLo: 0,
        rangeHi: 100,
        showZoneLabels: false,
        showPointer: true,
        showSetpoint: false,
        showNumericReadout: false,
        showSignalLine: false,
      };
    case "fill_gauge":
      return {
        displayType: "fill_gauge",
        mode: "standalone",
        fillDirection: "up",
        rangeLo: 0,
        rangeHi: 100,
        showLevelLine: false,
        showValue: false,
        valueFormat: "0.#",
      };
    case "sparkline":
      return {
        displayType: "sparkline",
        timeWindowMinutes: 60,
        scaleMode: "auto",
        dataPoints: 60,
      };
    case "alarm_indicator":
      return { displayType: "alarm_indicator", mode: "single" };
    case "digital_status":
      return {
        displayType: "digital_status",
        stateLabels: {},
        normalStates: [],
        abnormalPriority: 3,
      };
    case "point_name_label":
      return {
        displayType: "point_name_label",
        style: "hierarchy" as const,
      };
  }
}

// ---------------------------------------------------------------------------
// Font options shared by row editors
// ---------------------------------------------------------------------------

const FONT_OPTIONS: Array<{ value: DisplayElementFontFamily; label: string }> =
  [
    { value: "JetBrains Mono", label: "JetBrains Mono" },
    { value: "Inter", label: "Inter" },
    { value: "IBM Plex Sans", label: "IBM Plex Sans" },
  ];

// ---------------------------------------------------------------------------
// RowSection — collapsible section with optional enable toggle
// ---------------------------------------------------------------------------

function RowSection({
  title,
  enabledCheck,
  open,
  onToggleOpen,
  children,
}: {
  title: string;
  enabledCheck?: React.ReactNode;
  open: boolean;
  onToggleOpen: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        marginBottom: 8,
        border: "1px solid var(--io-border)",
        borderRadius: 4,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "5px 8px",
          cursor: "pointer",
          background: "var(--io-surface-raised)",
          userSelect: "none" as const,
        }}
        onClick={onToggleOpen}
      >
        <span
          style={{
            flex: 1,
            fontSize: 11,
            fontWeight: 600,
            color: "var(--io-text-secondary)",
          }}
        >
          {title}
        </span>
        {enabledCheck}
        <span
          style={{ fontSize: 8, color: "var(--io-text-muted)", marginLeft: 6 }}
        >
          {open ? "▲" : "▼"}
        </span>
      </div>
      {open && (
        <div
          style={{
            padding: "8px 8px 4px",
            borderTop: "1px solid var(--io-border)",
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TextReadoutFields — three-row collapsible config editor
// ---------------------------------------------------------------------------

function TextReadoutFields({
  node,
  executeCmd,
}: {
  node: DisplayElement;
  executeCmd: (cmd: SceneCommand) => void;
}) {
  const cfg = node.config as TextReadoutConfig;
  const [pnOpen, setPnOpen] = useState(cfg.pointNameRow?.enabled ?? false);
  const [dnOpen, setDnOpen] = useState(cfg.displayNameRow?.enabled ?? false);
  const [vOpen, setVOpen] = useState(true);

  function patch(p: Partial<TextReadoutConfig>) {
    executeCmd(
      new ChangeDisplayElementConfigCommand(
        node.id,
        { ...node.config, ...p } as DisplayElementConfig,
        node.config,
      ),
    );
  }

  const pnRow = cfg.pointNameRow ?? {
    enabled: false,
    fontFamily: "JetBrains Mono" as DisplayElementFontFamily,
    fontSize: 10,
    color: "var(--io-text-primary)",
    showBackground: false,
  };
  const dnRow = cfg.displayNameRow ?? {
    enabled: false,
    fontFamily: "JetBrains Mono" as DisplayElementFontFamily,
    fontSize: 9,
    color: "var(--io-text-secondary)",
    showBackground: false,
  };
  const vRow = cfg.valueRow ?? {
    fontFamily: "JetBrains Mono" as DisplayElementFontFamily,
    fontSize: 11,
    showBackground: true,
  };

  return (
    <>
      <Field label="Value Format">
        <input
          type="text"
          defaultValue={cfg.valueFormat ?? "0.##"}
          onBlur={(e) => patch({ valueFormat: e.target.value })}
          style={inputStyle}
          placeholder="0.##"
        />
      </Field>
      <Field label="Min Width">
        <NumberInput
          value={cfg.minWidth ?? 60}
          min={20}
          max={400}
          onChange={(v) => patch({ minWidth: v })}
        />
      </Field>

      <RowSection
        title="Point Name Row"
        open={pnOpen}
        onToggleOpen={() => setPnOpen((o) => !o)}
        enabledCheck={
          <input
            type="checkbox"
            checked={pnRow.enabled}
            title="Enable row"
            onChange={(e) =>
              patch({ pointNameRow: { ...pnRow, enabled: e.target.checked } })
            }
            onClick={(e) => e.stopPropagation()}
            style={{ cursor: "pointer", marginRight: 4 }}
          />
        }
      >
        <Field label="Font">
          <SelectInput
            value={pnRow.fontFamily}
            onChange={(v) =>
              patch({
                pointNameRow: {
                  ...pnRow,
                  fontFamily: v as DisplayElementFontFamily,
                },
              })
            }
            options={FONT_OPTIONS}
          />
        </Field>
        <Field label="Size">
          <NumberInput
            value={pnRow.fontSize}
            min={6}
            max={32}
            onChange={(v) => patch({ pointNameRow: { ...pnRow, fontSize: v } })}
          />
        </Field>
        <Field label="Color">
          <ThemedColorSelect
            value={pnRow.color}
            defaultValue="var(--io-text-primary)"
            onChange={(v) => patch({ pointNameRow: { ...pnRow, color: v } })}
          />
        </Field>
        <Field label="Bold">
          <input
            type="checkbox"
            checked={pnRow.fontWeight === "bold"}
            onChange={(e) =>
              patch({
                pointNameRow: {
                  ...pnRow,
                  fontWeight: e.target.checked ? "bold" : "normal",
                },
              })
            }
            style={{ cursor: "pointer" }}
          />
        </Field>
        <Field label="Background">
          <input
            type="checkbox"
            checked={pnRow.showBackground}
            onChange={(e) =>
              patch({
                pointNameRow: { ...pnRow, showBackground: e.target.checked },
              })
            }
            style={{ cursor: "pointer" }}
          />
        </Field>
      </RowSection>

      <RowSection
        title="Display Name Row"
        open={dnOpen}
        onToggleOpen={() => setDnOpen((o) => !o)}
        enabledCheck={
          <input
            type="checkbox"
            checked={dnRow.enabled}
            title="Enable row"
            onChange={(e) =>
              patch({ displayNameRow: { ...dnRow, enabled: e.target.checked } })
            }
            onClick={(e) => e.stopPropagation()}
            style={{ cursor: "pointer", marginRight: 4 }}
          />
        }
      >
        <Field label="Font">
          <SelectInput
            value={dnRow.fontFamily}
            onChange={(v) =>
              patch({
                displayNameRow: {
                  ...dnRow,
                  fontFamily: v as DisplayElementFontFamily,
                },
              })
            }
            options={FONT_OPTIONS}
          />
        </Field>
        <Field label="Size">
          <NumberInput
            value={dnRow.fontSize}
            min={6}
            max={32}
            onChange={(v) =>
              patch({ displayNameRow: { ...dnRow, fontSize: v } })
            }
          />
        </Field>
        <Field label="Color">
          <ThemedColorSelect
            value={dnRow.color}
            defaultValue="var(--io-text-secondary)"
            onChange={(v) => patch({ displayNameRow: { ...dnRow, color: v } })}
          />
        </Field>
        <Field label="Bold">
          <input
            type="checkbox"
            checked={dnRow.fontWeight === "bold"}
            onChange={(e) =>
              patch({
                displayNameRow: {
                  ...dnRow,
                  fontWeight: e.target.checked ? "bold" : "normal",
                },
              })
            }
            style={{ cursor: "pointer" }}
          />
        </Field>
        <Field label="Background">
          <input
            type="checkbox"
            checked={dnRow.showBackground}
            onChange={(e) =>
              patch({
                displayNameRow: { ...dnRow, showBackground: e.target.checked },
              })
            }
            style={{ cursor: "pointer" }}
          />
        </Field>
      </RowSection>

      <RowSection
        title="Value + EU Row"
        open={vOpen}
        onToggleOpen={() => setVOpen((o) => !o)}
      >
        <Field label="Font">
          <SelectInput
            value={vRow.fontFamily}
            onChange={(v) =>
              patch({
                valueRow: {
                  ...vRow,
                  fontFamily: v as DisplayElementFontFamily,
                },
              })
            }
            options={FONT_OPTIONS}
          />
        </Field>
        <Field label="Size">
          <NumberInput
            value={vRow.fontSize}
            min={6}
            max={32}
            onChange={(v) => patch({ valueRow: { ...vRow, fontSize: v } })}
          />
        </Field>
        <Field label="Background">
          <input
            type="checkbox"
            checked={vRow.showBackground}
            onChange={(e) =>
              patch({ valueRow: { ...vRow, showBackground: e.target.checked } })
            }
            style={{ cursor: "pointer" }}
          />
        </Field>
      </RowSection>
    </>
  );
}

// ---------------------------------------------------------------------------
// PointNameLabelFields — static text toggle + style + font controls
// ---------------------------------------------------------------------------

function PointNameLabelFields({
  node,
  executeCmd,
}: {
  node: DisplayElement;
  executeCmd: (cmd: SceneCommand) => void;
}) {
  const cfg = node.config as PointNameLabelConfig;

  function patch(p: Partial<PointNameLabelConfig>) {
    executeCmd(
      new ChangeDisplayElementConfigCommand(
        node.id,
        { ...node.config, ...p } as DisplayElementConfig,
        node.config,
      ),
    );
  }

  const isStatic = cfg.staticText !== undefined;

  return (
    <>
      <Field label="Style">
        <SelectInput
          value={cfg.style}
          onChange={(v) => patch({ style: v as "hierarchy" | "uniform" })}
          options={[
            { value: "hierarchy", label: "Hierarchy (ISA colored)" },
            { value: "uniform", label: "Uniform (plain)" },
          ]}
        />
      </Field>
      <Field label="Use Static Text">
        <input
          type="checkbox"
          checked={isStatic}
          onChange={(e) =>
            patch({
              staticText: e.target.checked
                ? (node.binding.pointId ?? "")
                : undefined,
            })
          }
          style={{ cursor: "pointer" }}
        />
      </Field>
      {isStatic && (
        <Field label="Static Text">
          <input
            type="text"
            defaultValue={cfg.staticText ?? ""}
            onBlur={(e) => patch({ staticText: e.target.value })}
            style={inputStyle}
            placeholder="Label text…"
          />
        </Field>
      )}
      <Field label="Font">
        <SelectInput
          value={cfg.fontFamily ?? "JetBrains Mono"}
          onChange={(v) => patch({ fontFamily: v as DisplayElementFontFamily })}
          options={FONT_OPTIONS}
        />
      </Field>
      <Field label="Size">
        <NumberInput
          value={cfg.fontSize ?? 10}
          min={6}
          max={32}
          onChange={(v) => patch({ fontSize: v })}
        />
      </Field>
      <Field label="Color">
        <ThemedColorSelect
          value={cfg.color}
          defaultValue="var(--io-text-secondary)"
          onChange={(v) => patch({ color: v })}
        />
      </Field>
      <Field label="Bold">
        <input
          type="checkbox"
          checked={cfg.fontWeight === "bold"}
          onChange={(e) =>
            patch({ fontWeight: e.target.checked ? "bold" : "normal" })
          }
          style={{ cursor: "pointer" }}
        />
      </Field>
    </>
  );
}

function DisplayElementTypeFields({
  node,
  executeCmd,
}: {
  node: DisplayElement;
  executeCmd: (cmd: SceneCommand) => void;
}) {
  function patchConfig(patch: Partial<DisplayElementConfig>) {
    const newConfig = { ...node.config, ...patch } as DisplayElementConfig;
    executeCmd(
      new ChangeDisplayElementConfigCommand(node.id, newConfig, node.config),
    );
  }

  switch (node.displayType) {
    case "text_readout":
      return <TextReadoutFields node={node} executeCmd={executeCmd} />;
    case "point_name_label":
      return <PointNameLabelFields node={node} executeCmd={executeCmd} />;
    case "analog_bar": {
      const cfg = node.config as AnalogBarConfig;
      return (
        <>
          <Field label="Orientation">
            <SelectInput
              value={cfg.orientation}
              onChange={(v) =>
                patchConfig({
                  orientation: v as "vertical" | "horizontal",
                } as Partial<AnalogBarConfig>)
              }
              options={[
                { value: "vertical", label: "Vertical" },
                { value: "horizontal", label: "Horizontal" },
              ]}
            />
          </Field>
          <Field label="Range Low">
            <NumberInput
              value={cfg.rangeLo}
              step={0.1}
              onChange={(v) =>
                patchConfig({ rangeLo: v } as Partial<AnalogBarConfig>)
              }
            />
          </Field>
          <Field label="Range High">
            <NumberInput
              value={cfg.rangeHi}
              step={0.1}
              onChange={(v) =>
                patchConfig({ rangeHi: v } as Partial<AnalogBarConfig>)
              }
            />
          </Field>
          <Field label="Bar Width">
            <NumberInput
              value={cfg.barWidth}
              min={4}
              max={120}
              onChange={(v) =>
                patchConfig({ barWidth: v } as Partial<AnalogBarConfig>)
              }
            />
          </Field>
          <Field label="Bar Height">
            <NumberInput
              value={cfg.barHeight}
              min={20}
              max={400}
              onChange={(v) =>
                patchConfig({ barHeight: v } as Partial<AnalogBarConfig>)
              }
            />
          </Field>
          <Field label="Show Numeric Readout">
            <input
              type="checkbox"
              checked={cfg.showNumericReadout}
              onChange={(e) =>
                patchConfig({
                  showNumericReadout: e.target.checked,
                } as Partial<AnalogBarConfig>)
              }
              style={{ cursor: "pointer" }}
            />
          </Field>
          <Field label="Show Pointer">
            <input
              type="checkbox"
              checked={cfg.showPointer}
              onChange={(e) =>
                patchConfig({
                  showPointer: e.target.checked,
                } as Partial<AnalogBarConfig>)
              }
              style={{ cursor: "pointer" }}
            />
          </Field>
          <Field label="Show Setpoint">
            <input
              type="checkbox"
              checked={cfg.showSetpoint}
              onChange={(e) =>
                patchConfig({
                  showSetpoint: e.target.checked,
                } as Partial<AnalogBarConfig>)
              }
              style={{ cursor: "pointer" }}
            />
          </Field>
          <Field label="Show Zone Labels">
            <input
              type="checkbox"
              checked={cfg.showZoneLabels}
              onChange={(e) =>
                patchConfig({
                  showZoneLabels: e.target.checked,
                } as Partial<AnalogBarConfig>)
              }
              style={{ cursor: "pointer" }}
            />
          </Field>
          <div
            style={{
              marginTop: 8,
              marginBottom: 4,
              fontSize: 10,
              fontWeight: 600,
              color: "var(--io-text-secondary)",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            Thresholds
          </div>
          <Field label="HH">
            <NumberInput
              value={cfg.thresholds?.hh}
              step={0.1}
              onChange={(v) =>
                patchConfig({
                  thresholds: { ...cfg.thresholds, hh: v },
                } as Partial<AnalogBarConfig>)
              }
            />
          </Field>
          <Field label="H">
            <NumberInput
              value={cfg.thresholds?.h}
              step={0.1}
              onChange={(v) =>
                patchConfig({
                  thresholds: { ...cfg.thresholds, h: v },
                } as Partial<AnalogBarConfig>)
              }
            />
          </Field>
          <Field label="L">
            <NumberInput
              value={cfg.thresholds?.l}
              step={0.1}
              onChange={(v) =>
                patchConfig({
                  thresholds: { ...cfg.thresholds, l: v },
                } as Partial<AnalogBarConfig>)
              }
            />
          </Field>
          <Field label="LL">
            <NumberInput
              value={cfg.thresholds?.ll}
              step={0.1}
              onChange={(v) =>
                patchConfig({
                  thresholds: { ...cfg.thresholds, ll: v },
                } as Partial<AnalogBarConfig>)
              }
            />
          </Field>
        </>
      );
    }
    case "fill_gauge": {
      const cfg = node.config as FillGaugeConfig;
      return (
        <>
          <Field label="Fill Direction">
            <SelectInput
              value={cfg.fillDirection}
              onChange={(v) =>
                patchConfig({
                  fillDirection: v as FillGaugeConfig["fillDirection"],
                } as Partial<FillGaugeConfig>)
              }
              options={[
                { value: "up", label: "Up" },
                { value: "down", label: "Down" },
                { value: "left", label: "Left" },
                { value: "right", label: "Right" },
              ]}
            />
          </Field>
          <Field label="Range Low">
            <NumberInput
              value={cfg.rangeLo}
              step={0.1}
              onChange={(v) =>
                patchConfig({ rangeLo: v } as Partial<FillGaugeConfig>)
              }
            />
          </Field>
          <Field label="Range High">
            <NumberInput
              value={cfg.rangeHi}
              step={0.1}
              onChange={(v) =>
                patchConfig({ rangeHi: v } as Partial<FillGaugeConfig>)
              }
            />
          </Field>
          <Field label="Show Level Line">
            <input
              type="checkbox"
              checked={cfg.showLevelLine}
              onChange={(e) =>
                patchConfig({
                  showLevelLine: e.target.checked,
                } as Partial<FillGaugeConfig>)
              }
              style={{ cursor: "pointer" }}
            />
          </Field>
          <Field label="Show Value">
            <input
              type="checkbox"
              checked={cfg.showValue}
              onChange={(e) =>
                patchConfig({
                  showValue: e.target.checked,
                } as Partial<FillGaugeConfig>)
              }
              style={{ cursor: "pointer" }}
            />
          </Field>
          {cfg.showValue && (
            <>
              <Field label="Value Format">
                <input
                  type="text"
                  defaultValue={cfg.valueFormat ?? "0.#"}
                  onBlur={(e) =>
                    patchConfig({
                      valueFormat: e.target.value,
                    } as Partial<FillGaugeConfig>)
                  }
                  style={inputStyle}
                  placeholder="0.#"
                />
              </Field>
              <Field label="Value Position">
                <SelectInput
                  value={
                    (cfg as FillGaugeConfig & { valuePosition?: string })
                      .valuePosition ?? "in-fill"
                  }
                  onChange={(v) =>
                    patchConfig({
                      valuePosition: v,
                    } as Partial<FillGaugeConfig>)
                  }
                  options={[
                    { value: "in-fill", label: "In Fill" },
                    { value: "center", label: "Center" },
                  ]}
                />
              </Field>
            </>
          )}
          <Field label="Mode">
            <SelectInput
              value={cfg.mode}
              onChange={(v) =>
                patchConfig({
                  mode: v as FillGaugeConfig["mode"],
                } as Partial<FillGaugeConfig>)
              }
              options={[
                { value: "standalone", label: "Standalone" },
                { value: "vessel_overlay", label: "Vessel Overlay" },
              ]}
            />
          </Field>
        </>
      );
    }
    case "sparkline": {
      const cfg = node.config as SparklineConfig;
      return (
        <>
          <Field label="Time Window (min)">
            <NumberInput
              value={cfg.timeWindowMinutes}
              min={1}
              max={1440}
              onChange={(v) =>
                patchConfig({
                  timeWindowMinutes: v,
                } as Partial<SparklineConfig>)
              }
            />
          </Field>
          <Field label="Data Points">
            <NumberInput
              value={cfg.dataPoints}
              min={10}
              max={500}
              onChange={(v) =>
                patchConfig({ dataPoints: v } as Partial<SparklineConfig>)
              }
            />
          </Field>
          <Field label="Scale Mode">
            <SelectInput
              value={cfg.scaleMode}
              onChange={(v) =>
                patchConfig({
                  scaleMode: v as SparklineConfig["scaleMode"],
                } as Partial<SparklineConfig>)
              }
              options={[
                { value: "auto", label: "Auto" },
                { value: "fixed", label: "Fixed" },
              ]}
            />
          </Field>
          {cfg.scaleMode === "fixed" && (
            <>
              <Field label="Scale Low">
                <NumberInput
                  value={cfg.fixedRangeLo}
                  step={0.1}
                  onChange={(v) =>
                    patchConfig({ fixedRangeLo: v } as Partial<SparklineConfig>)
                  }
                />
              </Field>
              <Field label="Scale High">
                <NumberInput
                  value={cfg.fixedRangeHi}
                  step={0.1}
                  onChange={(v) =>
                    patchConfig({ fixedRangeHi: v } as Partial<SparklineConfig>)
                  }
                />
              </Field>
            </>
          )}
        </>
      );
    }
    case "digital_status": {
      const cfg = node.config as DigitalStatusConfig;

      function patchDs(p: Partial<DigitalStatusConfig>) {
        patchConfig(p as Partial<DisplayElementConfig>);
      }

      return (
        <>
          <Field label="Abnormal Priority">
            <NumberInput
              value={cfg.abnormalPriority}
              min={1}
              max={5}
              onChange={(v) =>
                patchDs({ abnormalPriority: v as 1 | 2 | 3 | 4 | 5 })
              }
            />
          </Field>
          <div style={{ marginBottom: 6 }}>
            <FieldLabel>Normal States</FieldLabel>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
              {(cfg.normalStates ?? []).map((s, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 2,
                    background: "var(--io-surface-elevated)",
                    borderRadius: 3,
                    padding: "1px 4px",
                  }}
                >
                  <span style={{ fontSize: 11 }}>{s}</span>
                  <button
                    onClick={() =>
                      patchDs({
                        normalStates: cfg.normalStates.filter(
                          (_, j) => j !== i,
                        ),
                      })
                    }
                    style={{
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      color: "var(--io-text-muted)",
                      fontSize: 12,
                      padding: "0 2px",
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
              <input
                type="text"
                placeholder="+ add"
                style={{ ...inputStyle, width: 60 }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && e.currentTarget.value.trim()) {
                    patchDs({
                      normalStates: [
                        ...(cfg.normalStates ?? []),
                        e.currentTarget.value.trim(),
                      ],
                    });
                    e.currentTarget.value = "";
                  }
                }}
              />
            </div>
          </div>
          <div style={{ marginBottom: 6 }}>
            <FieldLabel>State Labels</FieldLabel>
            {Object.entries(cfg.stateLabels).map(([k, v]) => (
              <div
                key={k}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  marginBottom: 3,
                }}
              >
                <input
                  type="text"
                  defaultValue={k}
                  style={{ ...inputStyle, flex: 1 }}
                  readOnly
                />
                <span style={{ color: "var(--io-text-muted)", fontSize: 12 }}>
                  →
                </span>
                <input
                  type="text"
                  defaultValue={v}
                  onBlur={(e) => {
                    const labels = { ...cfg.stateLabels };
                    labels[k] = e.target.value;
                    patchDs({ stateLabels: labels });
                  }}
                  style={{ ...inputStyle, flex: 1 }}
                />
                <button
                  onClick={() => {
                    const labels = { ...cfg.stateLabels };
                    delete labels[k];
                    patchDs({ stateLabels: labels });
                  }}
                  style={{
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--io-text-secondary)",
                    fontSize: 14,
                    padding: "0 2px",
                    lineHeight: 1,
                  }}
                >
                  ×
                </button>
              </div>
            ))}
            <button
              onClick={() => {
                const labels = { ...cfg.stateLabels };
                const newKey = `state${Object.keys(labels).length}`;
                labels[newKey] = newKey;
                patchDs({
                  stateLabels: labels,
                } as Partial<DigitalStatusConfig>);
              }}
              style={{
                marginTop: 4,
                fontSize: 11,
                padding: "3px 8px",
                background: "var(--io-surface-raised)",
                border: "1px solid var(--io-border)",
                borderRadius: 3,
                cursor: "pointer",
                color: "var(--io-text-primary)",
              }}
            >
              + Add State
            </button>
          </div>
        </>
      );
    }
    case "alarm_indicator":
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Multi-selection panel
// ---------------------------------------------------------------------------

const ALIGN_BUTTONS: Array<{
  alignment: AlignmentType;
  label: string;
  title: string;
}> = [
  { alignment: "left", label: "⬤←", title: "Align Left" },
  { alignment: "center-h", label: "⬤↔", title: "Align Center (H)" },
  { alignment: "right", label: "→⬤", title: "Align Right" },
  { alignment: "top", label: "⬤↑", title: "Align Top" },
  { alignment: "center-v", label: "⬤↕", title: "Align Middle (V)" },
  { alignment: "bottom", label: "↓⬤", title: "Align Bottom" },
];

function MultiSelectionPanel({ ids }: { ids: NodeId[] }) {
  const executeCmd = useExecuteCmd();
  const doc = useSceneStore((s) => s.doc);

  const btnBase: React.CSSProperties = {
    flex: 1,
    padding: "4px",
    fontSize: 11,
    border: "1px solid var(--io-border)",
    borderRadius: "var(--io-radius)",
    background: "var(--io-surface)",
    color: "var(--io-text-secondary)",
    cursor: "pointer",
  };

  return (
    <div style={{ padding: "0 12px" }}>
      <div
        style={{
          fontSize: 12,
          color: "var(--io-text-secondary)",
          marginBottom: 10,
        }}
      >
        {ids.length} items selected
      </div>

      {/* Alignment */}
      <div style={{ marginBottom: 8 }}>
        <FieldLabel>Align</FieldLabel>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 3,
            marginBottom: 3,
          }}
        >
          {ALIGN_BUTTONS.slice(0, 3).map(({ alignment, label, title }) => (
            <button
              key={alignment}
              title={title}
              style={btnBase}
              onClick={() => executeCmd(new AlignNodesCommand(ids, alignment))}
            >
              {label}
            </button>
          ))}
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: 3,
          }}
        >
          {ALIGN_BUTTONS.slice(3).map(({ alignment, label, title }) => (
            <button
              key={alignment}
              title={title}
              style={btnBase}
              onClick={() => executeCmd(new AlignNodesCommand(ids, alignment))}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Distribution */}
      <div style={{ marginBottom: 10 }}>
        <FieldLabel>Distribute</FieldLabel>
        <div
          style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 3 }}
        >
          <button
            title="Distribute Horizontally"
            style={btnBase}
            onClick={() =>
              executeCmd(new DistributeNodesCommand(ids, "horizontal"))
            }
          >
            ↔ Horizontal
          </button>
          <button
            title="Distribute Vertically"
            style={btnBase}
            onClick={() =>
              executeCmd(new DistributeNodesCommand(ids, "vertical"))
            }
          >
            ↕ Vertical
          </button>
        </div>
      </div>

      <Field label="Opacity (all)">
        <NumberInput
          value={100}
          min={0}
          max={100}
          onChange={(v) => {
            if (!doc) return;
            for (const id of ids) {
              const node = findNodeById(doc, id);
              if (!node) continue;
              executeCmd(
                new ChangePropertyCommand(id, "opacity", v / 100, node.opacity),
              );
            }
          }}
        />
      </Field>
      {doc && (
        <Field label="Layer (all)">
          <SelectInput
            value=""
            onChange={(v) => {
              if (!doc || !v) return;
              for (const id of ids) {
                const node = findNodeById(doc, id);
                executeCmd(
                  new ChangePropertyCommand(id, "layerId", v, node?.layerId),
                );
              }
            }}
            options={[
              { value: "", label: "— Choose layer —" },
              ...doc.layers.map((l) => ({ value: l.id, label: l.name })),
            ]}
          />
        </Field>
      )}

      {/* Bulk Display Configuration — only when all selected are display_element */}
      {(() => {
        if (!doc) return null;
        const nodes = ids.map((id) => findNodeById(doc, id)).filter(Boolean);
        const allDisplayElements = nodes.every(
          (n) => n?.type === "display_element",
        );
        if (!allDisplayElements || nodes.length === 0) return null;
        const des = nodes as DisplayElement[];
        const allTextReadout = des.every(
          (de) => de.displayType === "text_readout",
        );

        return (
          <div
            style={{
              marginTop: 10,
              paddingTop: 10,
              borderTop: "1px solid var(--io-border)",
            }}
          >
            <FieldLabel>Bulk Display Config</FieldLabel>
            <Field label="Decimal precision (all)">
              <NumberInput
                value={NaN}
                min={0}
                max={6}
                step={1}
                onChange={(v) => {
                  if (isNaN(v)) return;
                  for (const de of des) {
                    const fmt = `%.${Math.round(v)}f`;
                    const newCfg = { ...de.config, valueFormat: fmt };
                    executeCmd(
                      new ChangeDisplayElementConfigCommand(
                        de.id,
                        newCfg as typeof de.config,
                        de.config,
                      ),
                    );
                  }
                }}
              />
            </Field>
            {allTextReadout && (
              <Field label="Show background (all)">
                <input
                  type="checkbox"
                  defaultChecked={false}
                  onChange={(e) => {
                    for (const de of des) {
                      const cfg = de.config as TextReadoutConfig;
                      const newCfg: TextReadoutConfig = {
                        ...cfg,
                        showBox: e.target.checked,
                      };
                      executeCmd(
                        new ChangeDisplayElementConfigCommand(
                          de.id,
                          newCfg,
                          de.config,
                        ),
                      );
                    }
                  }}
                  style={{ cursor: "pointer" }}
                />
              </Field>
            )}
            {allTextReadout && (
              <Field label="Show label (all)">
                <input
                  type="checkbox"
                  defaultChecked={false}
                  onChange={(e) => {
                    for (const de of des) {
                      const newCfg = {
                        ...de.config,
                        showLabel: e.target.checked,
                      };
                      executeCmd(
                        new ChangeDisplayElementConfigCommand(
                          de.id,
                          newCfg as typeof de.config,
                          de.config,
                        ),
                      );
                    }
                  }}
                  style={{ cursor: "pointer" }}
                />
              </Field>
            )}
          </div>
        );
      })()}

      {/* Actions */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 4,
          marginTop: 8,
        }}
      >
        <button
          style={{ ...btnBase, flex: "unset", color: "var(--io-accent)" }}
          onClick={() => executeCmd(new GroupNodesCommand(ids))}
        >
          Group (Ctrl+G)
        </button>
        <button
          style={{ ...btnBase, flex: "unset", color: "var(--io-danger)" }}
          onClick={() => executeCmd(new DeleteNodesCommand(ids))}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Layer properties panel
// ---------------------------------------------------------------------------

function LayerPropertiesPanel({ layer }: { layer: LayerDefinition }) {
  const executeCmd = useExecuteCmd();
  const [name, setName] = useState(layer.name);

  return (
    <div style={{ padding: "0 12px" }}>
      <Field label="Layer Name">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            const trimmed = name.trim();
            if (trimmed && trimmed !== layer.name) {
              executeCmd(
                new ChangeLayerPropertyCommand(
                  layer.id,
                  { name: trimmed },
                  { name: layer.name },
                ),
              );
            }
          }}
          style={inputStyle}
        />
      </Field>
      <Field label="Visible">
        <input
          type="checkbox"
          checked={layer.visible}
          onChange={(e) =>
            executeCmd(
              new ChangeLayerPropertyCommand(
                layer.id,
                { visible: e.target.checked },
                { visible: layer.visible },
              ),
            )
          }
          style={{ cursor: "pointer" }}
        />
      </Field>
      <Field label="Locked">
        <input
          type="checkbox"
          checked={layer.locked}
          onChange={(e) =>
            executeCmd(
              new ChangeLayerPropertyCommand(
                layer.id,
                { locked: e.target.checked },
                { locked: layer.locked },
              ),
            )
          }
          style={{ cursor: "pointer" }}
        />
      </Field>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TabBar
// ---------------------------------------------------------------------------

interface TabDef {
  id: string;
  label: string;
}

function TabBar({
  tabs,
  activeTab,
  onTabChange,
}: {
  tabs: TabDef[];
  activeTab: string;
  onTabChange: (id: string) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexShrink: 0,
        borderBottom: "1px solid var(--io-border)",
        background: "var(--io-surface)",
        overflowX: "auto",
      }}
    >
      {tabs.map((tab) => {
        const isActive = activeTab === tab.id;
        const isDoc = tab.id === "doc";
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            style={{
              flex: isDoc ? "0 0 auto" : 1,
              marginLeft: isDoc ? "auto" : 0,
              padding: "6px 8px",
              fontSize: 10,
              fontWeight: isActive ? 700 : 500,
              border: "none",
              borderBottom: isActive
                ? "2px solid var(--io-accent)"
                : "2px solid transparent",
              background: "transparent",
              color: isActive
                ? "var(--io-text-primary)"
                : "var(--io-text-muted)",
              cursor: "pointer",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              whiteSpace: "nowrap",
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Canvas Layers Panel — shows all canvas objects in z-order with controls.
// ---------------------------------------------------------------------------

function getNodeTypeShort(type: string): string {
  const map: Record<string, string> = {
    symbol_instance: "SYM",
    display_element: "DE",
    primitive: "GEO",
    pipe: "PIPE",
    text_block: "TXT",
    group: "GRP",
    annotation: "ANN",
    image: "IMG",
    widget: "WGT",
    embedded_svg: "SVG",
    stencil: "STN",
  };
  return map[type] ?? type.slice(0, 3).toUpperCase();
}

function getNodeDisplayName(node: SceneNode): string {
  if (node.name) return node.name;
  switch (node.type) {
    case "symbol_instance":
      return (
        (node as SymbolInstance).shapeRef.shapeId.split("/").pop() ?? "Symbol"
      );
    case "display_element":
      return (
        (node as DisplayElement).config?.displayType ?? "Display"
      ).replace(/_/g, " ");
    case "primitive":
      return (
        ((node as Primitive).geometry as { type?: string })?.type ?? "Shape"
      );
    case "group":
      return "Group";
    case "text_block":
      return "Text";
    case "pipe":
      return "Pipe";
    case "annotation":
      return "Annotation";
    case "image":
      return "Image";
    case "widget":
      return "Widget";
    case "embedded_svg":
      return "SVG";
    case "stencil":
      return "Stencil";
    default:
      return node.type;
  }
}

function getNodeBindingTag(node: SceneNode): string | null {
  if (node.type === "symbol_instance") {
    const sym = node as SymbolInstance;
    return sym.stateBinding?.pointTag ?? sym.stateBinding?.pointId ?? null;
  }
  if (node.type === "display_element") {
    const de = node as DisplayElement;
    return de.binding?.pointTag ?? de.binding?.pointId ?? null;
  }
  return null;
}

const LAYER_ICON_BTN: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  width: 16,
  height: 16,
  padding: 0,
  border: "none",
  background: "transparent",
  color: "var(--io-text-muted)",
  cursor: "pointer",
  fontSize: 10,
  flexShrink: 0,
  borderRadius: 2,
  lineHeight: 1,
};

function CanvasLayerRow({
  node,
  depth,
  actualIndex,
  siblingCount,
  expandedIds,
  onExpand,
  executeCmd,
}: {
  node: SceneNode;
  depth: number;
  actualIndex: number;
  siblingCount: number;
  expandedIds: Set<string>;
  onExpand: (id: string) => void;
  executeCmd: (cmd: SceneCommand) => void;
}) {
  const isSelected = useUiStore((s) => s.selectedNodeIds.has(node.id));

  const childNodes: SceneNode[] =
    node.type === "group"
      ? ((node as Group).children as SceneNode[])
      : node.type === "symbol_instance"
        ? ((node as SymbolInstance).children as SceneNode[])
        : [];
  const hasChildren = childNodes.length > 0;
  const isExpanded = expandedIds.has(node.id);

  const binding = getNodeBindingTag(node);
  const canMoveUp = depth === 0 && actualIndex < siblingCount - 1;
  const canMoveDown = depth === 0 && actualIndex > 0;

  return (
    <>
      <div
        onClick={() => useUiStore.getState().setSelectedNodes([node.id])}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 2,
          paddingLeft: 4 + depth * 14,
          paddingRight: 4,
          paddingTop: 2,
          paddingBottom: 2,
          cursor: "pointer",
          background: isSelected
            ? "var(--io-accent-subtle, rgba(99,102,241,0.1))"
            : "transparent",
          borderLeft: isSelected
            ? "2px solid var(--io-accent)"
            : "2px solid transparent",
          color: node.visible
            ? "var(--io-text-primary)"
            : "var(--io-text-muted)",
        }}
      >
        {/* Expand toggle */}
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onExpand(node.id);
            }}
            style={{ ...LAYER_ICON_BTN, fontSize: 8 }}
          >
            {isExpanded ? "▼" : "▶"}
          </button>
        ) : (
          <span style={{ width: 16, flexShrink: 0 }} />
        )}

        {/* Type badge */}
        <span
          style={{
            fontSize: 8,
            fontWeight: 700,
            color: "var(--io-text-muted)",
            minWidth: 24,
            letterSpacing: "0.04em",
          }}
        >
          {getNodeTypeShort(node.type)}
        </span>

        {/* Name */}
        <span
          style={{
            flex: 1,
            fontSize: 11,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            color: isSelected
              ? "var(--io-accent)"
              : node.locked
                ? "var(--io-text-muted)"
                : "inherit",
          }}
        >
          {getNodeDisplayName(node)}
        </span>

        {/* Binding badge */}
        {binding && (
          <span
            style={{
              fontSize: 9,
              color: "var(--io-text-muted)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              maxWidth: 56,
            }}
            title={binding}
          >
            {binding}
          </span>
        )}

        {/* Visibility toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            executeCmd(
              new ChangePropertyCommand(
                node.id,
                "visible",
                !node.visible,
                node.visible,
              ),
            );
          }}
          style={{
            ...LAYER_ICON_BTN,
            opacity: node.visible ? 1 : 0.4,
          }}
          title={node.visible ? "Hide" : "Show"}
        >
          {node.visible ? "👁" : "○"}
        </button>

        {/* Lock toggle */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            executeCmd(
              new ChangePropertyCommand(
                node.id,
                "locked",
                !node.locked,
                node.locked,
              ),
            );
          }}
          style={{
            ...LAYER_ICON_BTN,
            opacity: node.locked ? 1 : 0.3,
          }}
          title={node.locked ? "Unlock" : "Lock"}
        >
          {node.locked ? "🔒" : "○"}
        </button>

        {/* Reorder arrows */}
        {depth === 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            <button
              style={{ ...LAYER_ICON_BTN, fontSize: 7 }}
              disabled={!canMoveUp}
              onClick={(e) => {
                e.stopPropagation();
                executeCmd(
                  new ReorderNodeCommand(actualIndex + 1, actualIndex, null),
                );
              }}
              title="Move forward (up in stack)"
            >
              ↑
            </button>
            <button
              style={{ ...LAYER_ICON_BTN, fontSize: 7 }}
              disabled={!canMoveDown}
              onClick={(e) => {
                e.stopPropagation();
                executeCmd(
                  new ReorderNodeCommand(actualIndex - 1, actualIndex, null),
                );
              }}
              title="Move backward (down in stack)"
            >
              ↓
            </button>
          </div>
        )}
      </div>

      {/* Children */}
      {hasChildren &&
        isExpanded &&
        [...childNodes].reverse().map((child, ri) => {
          const childActualIdx = childNodes.length - 1 - ri;
          return (
            <CanvasLayerRow
              key={(child as SceneNode).id}
              node={child as SceneNode}
              depth={depth + 1}
              actualIndex={childActualIdx}
              siblingCount={childNodes.length}
              expandedIds={expandedIds}
              onExpand={onExpand}
              executeCmd={executeCmd}
            />
          );
        })}
    </>
  );
}

function CanvasLayersPanel() {
  const doc = useSceneStore((s) => s.doc);
  const executeCmd = useExecuteCmd();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  if (!doc) return null;

  function handleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Reverse so frontmost node appears at the top of the list
  const reversed = [...doc.children].reverse();

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        minHeight: 0,
        overflow: "hidden",
        borderTop: "1px solid var(--io-border)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "5px 10px 5px 12px",
          flexShrink: 0,
          borderBottom: "1px solid var(--io-border)",
        }}
      >
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "var(--io-text-muted)",
            flex: 1,
          }}
        >
          Layers
        </span>
        <span style={{ fontSize: 10, color: "var(--io-text-muted)" }}>
          {doc.children.length}
        </span>
      </div>

      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        {reversed.length === 0 ? (
          <div
            style={{
              padding: "8px 12px",
              fontSize: 11,
              color: "var(--io-text-muted)",
            }}
          >
            Canvas is empty
          </div>
        ) : (
          reversed.map((node, revIdx) => {
            const actualIdx = doc.children.length - 1 - revIdx;
            return (
              <CanvasLayerRow
                key={(node as SceneNode).id}
                node={node as SceneNode}
                depth={0}
                actualIndex={actualIdx}
                siblingCount={doc.children.length}
                expandedIds={expandedIds}
                onExpand={handleExpand}
                executeCmd={executeCmd}
              />
            );
          })
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab routing helpers
// ---------------------------------------------------------------------------

function tabIdsForNode(
  node: SceneNode,
  shapeEntry: ShapeEntry | null,
): string[] {
  const tabs: string[] = [];

  switch (node.type) {
    case "symbol_instance": {
      const sym = node as SymbolInstance;
      tabs.push("layout");
      tabs.push("data");
      tabs.push("shape");
      const textZones = shapeEntry?.sidecar.textZones ?? [];
      const hasChildren = (sym.children ?? []).length > 0;
      if (textZones.length > 0 || hasChildren) {
        tabs.push("content");
      }
      break;
    }
    case "display_element":
      tabs.push("layout");
      tabs.push("data");
      tabs.push("content");
      break;
    case "primitive":
      tabs.push("layout");
      tabs.push("style");
      break;
    case "pipe":
      tabs.push("layout");
      tabs.push("style");
      tabs.push("data");
      break;
    case "text_block":
      tabs.push("layout");
      tabs.push("style");
      tabs.push("content");
      break;
    case "widget":
      tabs.push("layout");
      tabs.push("content");
      break;
    case "annotation":
      tabs.push("layout");
      tabs.push("content");
      break;
    case "image":
    case "embedded_svg":
    case "group":
    case "stencil":
    default:
      tabs.push("layout");
      break;
  }

  return tabs;
}

function getDefaultTabId(node: SceneNode): string {
  switch (node.type) {
    case "symbol_instance":
    case "display_element":
    case "pipe":
      return "data";
    case "text_block":
    case "widget":
    case "annotation":
      return "content";
    default:
      return "layout";
  }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function DesignerRightPanel({
  collapsed,
  width,
}: DesignerRightPanelProps) {
  const doc = useSceneStore((s) => s.doc);
  const executeCmd = useExecuteCmd();
  const selectedNodeIds = useUiStore((s) => s.selectedNodeIds);
  const selectedIds = Array.from(selectedNodeIds);
  const getShape = useLibraryStore((s) => s.getShape);

  const [activeTab, setActiveTab] = useState<string>("doc");

  const singleId = selectedIds.length === 1 ? selectedIds[0] : null;
  const singleNode = singleId && doc ? findNodeById(doc, singleId) : null;
  const shapeEntry =
    singleNode?.type === "symbol_instance"
      ? getShape((singleNode as SymbolInstance).shapeRef.shapeId)
      : null;

  // Auto-scroll to top when a display_element is selected
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!singleId || !doc) return;
    const node = findNodeById(doc, singleId);
    if (node?.type !== "display_element") return;
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [singleId]);

  // Switch to default tab when selection changes; fall back to "doc" when cleared
  const prevSelKey = useRef("");
  useEffect(() => {
    const key = selectedIds.join(",");
    if (key === prevSelKey.current) return;
    prevSelKey.current = key;
    if (selectedIds.length === 0) {
      setActiveTab("doc");
    } else if (selectedIds.length === 1 && singleNode) {
      const defaultTab = getDefaultTabId(singleNode);
      setActiveTab(defaultTab);
    } else {
      setActiveTab("multi");
    }
  }, [selectedIds.join(",")]);

  if (collapsed) {
    return (
      <div
        style={{
          width,
          display: "flex",
          flexDirection: "column",
          background: "var(--io-surface)",
          borderLeft: "1px solid var(--io-border)",
          alignItems: "center",
          paddingTop: 8,
        }}
      >
        <div
          style={{
            fontSize: 9,
            color: "var(--io-text-muted)",
            writingMode: "vertical-lr",
            transform: "rotate(180deg)",
            userSelect: "none",
          }}
        >
          INSPECTOR
        </div>
      </div>
    );
  }

  // Build tab list dynamically based on selection state
  const tabs: TabDef[] = [];

  if (!doc) {
    // No document
  } else if (selectedIds.length === 0) {
    // No selection — Doc tab only (pushed below)
  } else if (selectedIds.length > 1) {
    tabs.push({ id: "multi", label: `${selectedIds.length} Items` });
  } else if (singleNode) {
    const nodeTabs = tabIdsForNode(singleNode, shapeEntry ?? null);
    const tabLabels: Record<string, string> = {
      layout: "Layout",
      style: "Style",
      data: "Data",
      shape: "Shape",
      content: "Content",
    };
    for (const tid of nodeTabs) {
      tabs.push({ id: tid, label: tabLabels[tid] ?? tid });
    }
  } else if (singleId) {
    const layer = doc.layers.find((l) => l.id === singleId);
    if (layer) tabs.push({ id: "layer", label: "Layer" });
  }

  // Doc tab always last / rightmost
  tabs.push({ id: "doc", label: "Doc" });

  const validTab = tabs.find((t) => t.id === activeTab)
    ? activeTab
    : (tabs[0]?.id ?? "doc");

  function renderTabContent() {
    if (validTab === "doc") {
      if (!doc) {
        return (
          <div
            style={{ padding: 16, fontSize: 12, color: "var(--io-text-muted)" }}
          >
            No document open
          </div>
        );
      }
      return <DocPropertiesPanel doc={doc} />;
    }

    if (!doc) return null;

    if (validTab === "multi" && selectedIds.length > 1) {
      return <MultiSelectionPanel ids={selectedIds} />;
    }

    if (validTab === "layer" && singleId) {
      const layer = doc.layers.find((l) => l.id === singleId);
      if (layer) return <LayerPropertiesPanel key={layer.id} layer={layer} />;
    }

    if (!singleNode) {
      return (
        <div
          style={{ padding: 16, fontSize: 12, color: "var(--io-text-muted)" }}
        >
          Selected item not found
        </div>
      );
    }

    const node = singleNode;

    // --- LAYOUT TAB ---
    if (validTab === "layout") {
      return (
        <div key={node.id} style={{ padding: "0 12px" }}>
          {/* Group: name + children count first */}
          {node.type === "group" && (
            <GroupNameField node={node as Group} executeCmd={executeCmd} />
          )}
          {/* Stencil extras */}
          {node.type === "stencil" && (
            <StencilLayoutExtras
              node={node as Stencil}
              executeCmd={executeCmd}
            />
          )}
          {/* Image extras */}
          {node.type === "image" && (
            <ImageLayoutExtras
              node={node as ImageNode}
              executeCmd={executeCmd}
            />
          )}
          {/* EmbeddedSvg extras */}
          {node.type === "embedded_svg" && (
            <EmbeddedSvgLayoutExtras
              node={node as EmbeddedSvgNode}
              executeCmd={executeCmd}
            />
          )}
          {/* Annotation size */}
          {node.type === "annotation" && (
            <AnnotationLayoutExtras
              node={node as Annotation}
              executeCmd={executeCmd}
            />
          )}
          {/* Widget size */}
          {node.type === "widget" && (
            <WidgetLayoutExtras
              node={node as WidgetNode}
              executeCmd={executeCmd}
            />
          )}
          {/* Primitive geometry (size fields) */}
          {node.type === "primitive" && (
            <PrimitiveGeometrySection
              node={node as Primitive}
              executeCmd={executeCmd}
            />
          )}
          {/* Pipe: special layout (no X/Y, just opacity/visible/locked/layer) */}
          {node.type === "pipe" ? (
            <PipeLayoutTab
              node={node as Pipe}
              doc={doc}
              executeCmd={executeCmd}
            />
          ) : node.type === "display_element" ? (
            /* DisplayElement: no positional transform in panel */
            <DisplayElementLayoutTab node={node as DisplayElement} />
          ) : (
            /* Universal TransformSection for all other nodes */
            <TransformSection
              node={node}
              doc={doc}
              executeCmd={executeCmd}
              showRotation={node.type !== "group"}
            />
          )}
        </div>
      );
    }

    // --- STYLE TAB ---
    if (validTab === "style") {
      return (
        <div key={node.id} style={{ padding: "0 12px" }}>
          {node.type === "primitive" && (
            <PrimitiveStyleSection
              node={node as Primitive}
              executeCmd={executeCmd}
            />
          )}
          {node.type === "text_block" && (
            <TextBlockStyleSection
              node={node as TextBlock}
              executeCmd={executeCmd}
            />
          )}
          {node.type === "pipe" && (
            <PipeStyleSection node={node as Pipe} executeCmd={executeCmd} />
          )}
        </div>
      );
    }

    // --- DATA TAB ---
    if (validTab === "data") {
      return (
        <div key={node.id}>
          {node.type === "symbol_instance" && (
            <SymbolInstanceDataTab node={node as SymbolInstance} />
          )}
          {node.type === "display_element" && (
            <DisplayElementDataTab node={node as DisplayElement} />
          )}
          {node.type === "pipe" && (
            <div style={{ padding: "0 12px" }}>
              <PipeDataSection node={node as Pipe} executeCmd={executeCmd} />
            </div>
          )}
        </div>
      );
    }

    // --- SHAPE TAB (symbol_instance only) ---
    if (validTab === "shape" && node.type === "symbol_instance") {
      return (
        <SymbolInstanceShapeTab key={node.id} node={node as SymbolInstance} />
      );
    }

    // --- CONTENT TAB ---
    if (validTab === "content") {
      return (
        <div key={node.id}>
          {node.type === "symbol_instance" && (
            <SymbolInstanceSidecarsTab node={node as SymbolInstance} />
          )}
          {node.type === "display_element" && (
            <DisplayElementContentTab node={node as DisplayElement} />
          )}
          {node.type === "text_block" && (
            <div style={{ padding: "0 12px" }}>
              <Field label="Content">
                <textarea
                  key={node.id}
                  defaultValue={(node as TextBlock).content}
                  onBlur={(e) => {
                    const v = e.target.value;
                    if (v !== (node as TextBlock).content)
                      executeCmd(
                        new ChangeTextCommand(
                          node.id,
                          v,
                          (node as TextBlock).content,
                        ),
                      );
                  }}
                  rows={5}
                  style={{
                    ...inputStyle,
                    resize: "vertical",
                    fontFamily: "inherit",
                  }}
                />
              </Field>
            </div>
          )}
          {node.type === "widget" && (
            <WidgetContentTab node={node as WidgetNode} />
          )}
          {node.type === "annotation" && (
            <AnnotationContentTab node={node as Annotation} />
          )}
        </div>
      );
    }

    return (
      <div style={{ padding: 16, fontSize: 12, color: "var(--io-text-muted)" }}>
        No content for this tab.
      </div>
    );
  }

  return (
    <div
      style={{
        width,
        flex: 1,
        display: "flex",
        flexDirection: "column",
        background: "var(--io-surface)",
        borderLeft: "1px solid var(--io-border)",
        overflow: "hidden",
        height: "100%",
      }}
    >
      {/* Tab bar */}
      <TabBar tabs={tabs} activeTab={validTab} onTabChange={setActiveTab} />

      {/* Tab content — scrollable, takes top half */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          overflowY: "auto",
          minHeight: 0,
          paddingTop: 8,
        }}
      >
        {renderTabContent()}
      </div>

      {/* Canvas Layers — bottom half, full height remaining */}
      <CanvasLayersPanel />
    </div>
  );
}
