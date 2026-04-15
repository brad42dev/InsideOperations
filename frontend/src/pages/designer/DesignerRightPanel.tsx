/**
 * DesignerRightPanel.tsx
 *
 * Context-sensitive property panel.
 * Shows different fields depending on what is selected in the scene.
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
  ComposablePart,
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
  AddComposablePartCommand,
  RemoveComposablePartCommand,
  ChangeDisplayElementConfigCommand,
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

function ColorInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <input
        type="color"
        value={value.startsWith("#") ? value : "#6366f1"}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: 28,
          height: 28,
          padding: 2,
          background: "var(--io-surface)",
          border: "1px solid var(--io-border)",
          borderRadius: "var(--io-radius)",
          cursor: "pointer",
          flexShrink: 0,
        }}
      />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ ...inputStyle, flex: 1 }}
      />
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
// SymbolInstance panels — split across three tabs:
//   SymbolInstancePanel     → Properties tab (transform, opacity, layer, nav link)
//   SymbolInstanceShapeTab  → Shape tab (variant, config, composable parts)
//   SymbolInstanceSidecarTab→ Sidecar tab (binding, text zones, display elements)
// ---------------------------------------------------------------------------

// Properties tab: transform, opacity, layer assignment, navigation link only
function SymbolInstancePanel({ node }: { node: SymbolInstance }) {
  const executeCmd = useExecuteCmd();
  const doc = useSceneStore((s) => s.doc);

  return (
    <div style={{ padding: "0 12px" }}>
      <Field label="X">
        <NumberInput
          value={Math.round(node.transform.position.x)}
          onChange={(v) =>
            executeCmd(
              new ChangePropertyCommand(
                node.id,
                "transform",
                {
                  ...node.transform,
                  position: { ...node.transform.position, x: v },
                },
                node.transform,
              ),
            )
          }
        />
      </Field>
      <Field label="Y">
        <NumberInput
          value={Math.round(node.transform.position.y)}
          onChange={(v) =>
            executeCmd(
              new ChangePropertyCommand(
                node.id,
                "transform",
                {
                  ...node.transform,
                  position: { ...node.transform.position, y: v },
                },
                node.transform,
              ),
            )
          }
        />
      </Field>
      <Field label="Rotation">
        <NumberInput
          value={Math.round(node.transform.rotation)}
          min={-360}
          max={360}
          onChange={(v) =>
            executeCmd(
              new ChangePropertyCommand(
                node.id,
                "transform",
                { ...node.transform, rotation: v },
                node.transform,
              ),
            )
          }
        />
      </Field>
      <Field label="Opacity">
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
    </div>
  );
}

// Shape tab: variant, physical configuration, composable parts
function SymbolInstanceShapeTab({ node }: { node: SymbolInstance }) {
  const executeCmd = useExecuteCmd();
  const getShape = useLibraryStore((s) => s.getShape);
  const shapeEntry = getShape(node.shapeRef.shapeId);
  const variants = shapeEntry?.sidecar.options ?? [];

  return (
    <div style={{ padding: "0 12px" }}>
      <Field label="Shape ID">
        <input
          readOnly
          value={node.shapeRef.shapeId}
          style={{ ...inputStyle, color: "var(--io-text-muted)" }}
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

      {shapeEntry?.sidecar.configurations &&
        shapeEntry.sidecar.configurations.length > 0 && (
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
                ...shapeEntry.sidecar.configurations.map((cfg) => ({
                  value: cfg.id,
                  label: cfg.label,
                })),
              ]}
            />
          </Field>
        )}

      {shapeEntry?.sidecar.options && shapeEntry.sidecar.options.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <FieldLabel>Composable Parts</FieldLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {node.composableParts.map((part: ComposablePart) => (
              <div
                key={part.partId}
                style={{ display: "flex", alignItems: "center", gap: 6 }}
              >
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--io-text-secondary)",
                    flex: 1,
                  }}
                >
                  {part.partId}
                </span>
                <button
                  onClick={() =>
                    executeCmd(
                      new RemoveComposablePartCommand(node.id, part.partId),
                    )
                  }
                  style={{
                    fontSize: 10,
                    color: "var(--io-text-muted)",
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                  }}
                  title="Remove part"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              onClick={() =>
                executeCmd(
                  new AddComposablePartCommand(node.id, {
                    partId: crypto.randomUUID(),
                    attachment: "default",
                  }),
                )
              }
              style={{
                fontSize: 11,
                color: "var(--io-accent)",
                background: "transparent",
                border: "1px dashed var(--io-border)",
                borderRadius: "var(--io-radius)",
                padding: "3px 8px",
                cursor: "pointer",
              }}
            >
              + Add Part
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Sidecar tab: point binding, text zone overrides, display element children
function SymbolInstanceSidecarTab({ node }: { node: SymbolInstance }) {
  const executeCmd = useExecuteCmd();
  const getShape = useLibraryStore((s) => s.getShape);
  const shapeEntry = getShape(node.shapeRef.shapeId);

  return (
    <div style={{ padding: "0 12px" }}>
      <Field label="Point Binding (Tag)">
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <input
            type="text"
            key={node.id}
            defaultValue={
              node.stateBinding?.pointTag ?? node.stateBinding?.pointId ?? ""
            }
            onBlur={(e) => {
              const val = e.target.value.trim();
              const newBinding = val ? { pointTag: val } : undefined;
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
      </Field>

      {shapeEntry && (shapeEntry.sidecar.textZones ?? []).length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <FieldLabel>Text Zones</FieldLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {(shapeEntry.sidecar.textZones ?? []).map((zone) => {
              const overrideVal =
                (node.textZoneOverrides as Record<string, string>)?.[zone.id] ??
                "";
              return (
                <div
                  key={zone.id}
                  style={{ display: "flex", alignItems: "center", gap: 4 }}
                >
                  <span
                    style={{
                      fontSize: 10,
                      color: "var(--io-text-muted)",
                      minWidth: 52,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={zone.id}
                  >
                    {zone.id}
                  </span>
                  <input
                    type="text"
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
                    style={{ ...inputStyle, flex: 1 }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ marginBottom: 8 }}>
        <FieldLabel>Display Elements</FieldLabel>
        {node.children && node.children.length > 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 2,
              marginBottom: 4,
            }}
          >
            {node.children.map((child) => {
              const de = child as DisplayElement;
              return (
                <div
                  key={child.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 4,
                    fontSize: 11,
                    color: "var(--io-text-secondary)",
                  }}
                >
                  <span
                    style={{
                      flex: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {de.config?.displayType ?? child.type} —{" "}
                    {de.binding?.pointId ?? "Unbound"}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div
            style={{
              fontSize: 11,
              color: "var(--io-text-muted)",
              marginBottom: 4,
            }}
          >
            No display elements
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TextBlock panel
// ---------------------------------------------------------------------------

function TextBlockPanel({ node }: { node: TextBlock }) {
  const executeCmd = useExecuteCmd();
  const doc = useSceneStore((s) => s.doc);
  const bg = node.background;
  const [showBg, setShowBg] = useState(!!bg);

  return (
    <div style={{ padding: "0 12px" }}>
      <Field label="Content">
        <textarea
          defaultValue={node.content}
          onBlur={(e) => {
            const v = e.target.value;
            if (v !== node.content)
              executeCmd(new ChangeTextCommand(node.id, v, node.content));
          }}
          rows={3}
          style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
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
        <ColorInput
          value={node.fill}
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

      {/* Background toggle */}
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
          Background
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

      <Field label="Opacity">
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// Primitive panel
// ---------------------------------------------------------------------------

function PrimitivePanel({ node }: { node: Primitive }) {
  const executeCmd = useExecuteCmd();

  const style = node.style;
  const pos = node.transform.position;

  return (
    <div style={{ padding: "0 12px" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 6,
          marginBottom: 10,
        }}
      >
        <Field label="X">
          <NumberInput
            value={Math.round(pos.x)}
            onChange={(v) =>
              executeCmd(
                new ChangePropertyCommand(
                  node.id,
                  "transform",
                  { ...node.transform, position: { ...pos, x: v } },
                  node.transform,
                ),
              )
            }
          />
        </Field>
        <Field label="Y">
          <NumberInput
            value={Math.round(pos.y)}
            onChange={(v) =>
              executeCmd(
                new ChangePropertyCommand(
                  node.id,
                  "transform",
                  { ...node.transform, position: { ...pos, y: v } },
                  node.transform,
                ),
              )
            }
          />
        </Field>
        <Field label="Rotation">
          <NumberInput
            value={Math.round(node.transform.rotation)}
            min={-360}
            max={360}
            onChange={(v) =>
              executeCmd(
                new ChangePropertyCommand(
                  node.id,
                  "transform",
                  { ...node.transform, rotation: v },
                  node.transform,
                ),
              )
            }
          />
        </Field>
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
      </div>
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pipe panel
// ---------------------------------------------------------------------------

const PIPE_SERVICE_OPTIONS = Object.keys(PIPE_SERVICE_COLORS).map((k) => ({
  value: k,
  label: k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
}));

function PipePanel({ node }: { node: Pipe }) {
  const executeCmd = useExecuteCmd();

  return (
    <div style={{ padding: "0 12px" }}>
      <Field label="Service Type">
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
      {node.label !== undefined || true ? (
        <Field label="Label">
          <input
            type="text"
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
      ) : null}
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
      <Field label="Opacity">
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// DisplayElement panel
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
          <ColorInput
            value={pnRow.color}
            onChange={(v) => patch({ pointNameRow: { ...pnRow, color: v } })}
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
          <ColorInput
            value={dnRow.color}
            onChange={(v) => patch({ displayNameRow: { ...dnRow, color: v } })}
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
        <ColorInput
          value={cfg.color ?? "var(--io-text-secondary)"}
          onChange={(v) => patch({ color: v })}
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
            <Field label="Value Position">
              <SelectInput
                value={cfg.valuePosition ?? "in-fill"}
                onChange={(v) =>
                  patchConfig({
                    valuePosition: v as FillGaugeConfig["valuePosition"],
                  } as Partial<FillGaugeConfig>)
                }
                options={[
                  { value: "in-fill", label: "In fill" },
                  { value: "center", label: "Center" },
                ]}
              />
            </Field>
          )}
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
                  scaleMode: v as "auto" | "fixed",
                } as Partial<SparklineConfig>)
              }
              options={[
                { value: "auto", label: "Auto" },
                { value: "fixed", label: "Fixed" },
              ]}
            />
          </Field>
        </>
      );
    }
    case "digital_status": {
      const cfg = node.config as DigitalStatusConfig;
      const stateEntries = Object.entries(cfg.stateLabels ?? {});
      return (
        <>
          <Field label="Abnormal Priority">
            <SelectInput
              value={String(cfg.abnormalPriority)}
              onChange={(v) =>
                patchConfig({
                  abnormalPriority: parseInt(v) as 1 | 2 | 3 | 4 | 5,
                } as Partial<DigitalStatusConfig>)
              }
              options={[
                { value: "1", label: "P1 — Critical" },
                { value: "2", label: "P2 — High" },
                { value: "3", label: "P3 — Medium" },
                { value: "4", label: "P4 — Low" },
                { value: "5", label: "P5 — Diagnostic" },
              ]}
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
            State Labels
          </div>
          {stateEntries.map(([stateVal, stateLabel]) => (
            <div
              key={stateVal}
              style={{
                display: "flex",
                gap: 4,
                alignItems: "center",
                marginBottom: 4,
              }}
            >
              <input
                defaultValue={stateVal}
                placeholder="Value"
                style={{ ...inputStyle, width: 60 }}
                onBlur={(e) => {
                  const newVal = e.target.value.trim();
                  if (!newVal || newVal === stateVal) return;
                  const labels = { ...cfg.stateLabels };
                  const normals = [...(cfg.normalStates ?? [])];
                  const label = labels[stateVal];
                  delete labels[stateVal];
                  labels[newVal] = label;
                  const normIdx = normals.indexOf(stateVal);
                  if (normIdx >= 0) {
                    normals.splice(normIdx, 1);
                    normals.push(newVal);
                  }
                  patchConfig({
                    stateLabels: labels,
                    normalStates: normals,
                  } as Partial<DigitalStatusConfig>);
                }}
              />
              <input
                defaultValue={stateLabel}
                placeholder="Label"
                style={{ ...inputStyle, flex: 1 }}
                onBlur={(e) => {
                  const labels = {
                    ...cfg.stateLabels,
                    [stateVal]: e.target.value,
                  };
                  patchConfig({
                    stateLabels: labels,
                  } as Partial<DigitalStatusConfig>);
                }}
              />
              <input
                type="checkbox"
                title="Normal state"
                checked={(cfg.normalStates ?? []).includes(stateVal)}
                onChange={(e) => {
                  const normals = [...(cfg.normalStates ?? [])];
                  if (e.target.checked) {
                    if (!normals.includes(stateVal)) normals.push(stateVal);
                  } else {
                    const i = normals.indexOf(stateVal);
                    if (i >= 0) normals.splice(i, 1);
                  }
                  patchConfig({
                    normalStates: normals,
                  } as Partial<DigitalStatusConfig>);
                }}
                style={{ cursor: "pointer", flexShrink: 0 }}
              />
              <button
                title="Remove state"
                onClick={() => {
                  const labels = { ...cfg.stateLabels };
                  delete labels[stateVal];
                  const normals = (cfg.normalStates ?? []).filter(
                    (s) => s !== stateVal,
                  );
                  patchConfig({
                    stateLabels: labels,
                    normalStates: normals,
                  } as Partial<DigitalStatusConfig>);
                }}
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--io-text-secondary)",
                  cursor: "pointer",
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
              patchConfig({
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
        </>
      );
    }
    case "alarm_indicator":
    default:
      return null;
  }
}

function DisplayElementPanel({ node }: { node: DisplayElement }) {
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
      <DisplayElementTypeFields node={node} executeCmd={executeCmd} />
      <Field label="Opacity">
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
// Widget panel
// ---------------------------------------------------------------------------

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

function WidgetPanel({ node }: { node: WidgetNode }) {
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
          defaultValue={title}
          onBlur={(e) =>
            patchConfig({ title: e.target.value } as Partial<WidgetConfig>)
          }
          style={inputStyle}
          placeholder="Widget title…"
        />
      </Field>
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
      <Field label="Opacity">
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// ImageNode panel
// ---------------------------------------------------------------------------

function ImageNodePanel({ node }: { node: ImageNode }) {
  const executeCmd = useExecuteCmd();
  const pos = node.transform.position;

  return (
    <div style={{ padding: "0 12px" }}>
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
        <Field label="X">
          <NumberInput
            value={Math.round(pos.x)}
            onChange={(v) =>
              executeCmd(
                new ChangePropertyCommand(
                  node.id,
                  "transform",
                  { ...node.transform, position: { ...pos, x: v } },
                  node.transform,
                ),
              )
            }
          />
        </Field>
        <Field label="Y">
          <NumberInput
            value={Math.round(pos.y)}
            onChange={(v) =>
              executeCmd(
                new ChangePropertyCommand(
                  node.id,
                  "transform",
                  { ...node.transform, position: { ...pos, y: v } },
                  node.transform,
                ),
              )
            }
          />
        </Field>
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
      <Field label="Opacity">
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
// EmbeddedSvg panel
// ---------------------------------------------------------------------------

function EmbeddedSvgPanel({ node }: { node: EmbeddedSvgNode }) {
  const executeCmd = useExecuteCmd();
  const pos = node.transform.position;

  return (
    <div style={{ padding: "0 12px" }}>
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
        <Field label="X">
          <NumberInput
            value={Math.round(pos.x)}
            onChange={(v) =>
              executeCmd(
                new ChangePropertyCommand(
                  node.id,
                  "transform",
                  { ...node.transform, position: { ...pos, x: v } },
                  node.transform,
                ),
              )
            }
          />
        </Field>
        <Field label="Y">
          <NumberInput
            value={Math.round(pos.y)}
            onChange={(v) =>
              executeCmd(
                new ChangePropertyCommand(
                  node.id,
                  "transform",
                  { ...node.transform, position: { ...pos, y: v } },
                  node.transform,
                ),
              )
            }
          />
        </Field>
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
      <Field label="Opacity">
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// Group panel
// ---------------------------------------------------------------------------

function GroupPanel({ node }: { node: Group }) {
  const executeCmd = useExecuteCmd();
  const doc = useSceneStore((s) => s.doc);
  const pos = node.transform.position;
  const [nameValue, setNameValue] = useState(node.name ?? "");

  // Keep local name in sync if node changes externally (e.g. undo)
  React.useEffect(() => {
    setNameValue(node.name ?? "");
  }, [node.name]);

  return (
    <div style={{ padding: "0 12px" }}>
      <Field label="Name">
        <input
          value={nameValue}
          onChange={(e) => setNameValue(e.target.value)}
          onBlur={() => {
            const trimmed = nameValue.trim();
            if (trimmed && trimmed !== (node.name ?? "")) {
              executeCmd(
                new ChangePropertyCommand(
                  node.id,
                  "name",
                  trimmed,
                  node.name ?? "",
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
            onChange={(v) =>
              executeCmd(
                new ChangePropertyCommand(
                  node.id,
                  "transform",
                  { ...node.transform, position: { ...pos, x: v } },
                  node.transform,
                ),
              )
            }
          />
        </Field>
        <Field label="Y">
          <NumberInput
            value={Math.round(pos.y)}
            onChange={(v) =>
              executeCmd(
                new ChangePropertyCommand(
                  node.id,
                  "transform",
                  { ...node.transform, position: { ...pos, y: v } },
                  node.transform,
                ),
              )
            }
          />
        </Field>
      </div>
      <Field label="Opacity">
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// Annotation panel
// ---------------------------------------------------------------------------

function AnnotationPanel({ node }: { node: Annotation }) {
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
      {"width" in cfg && (
        <Field label="Width">
          <NumberInput
            value={cfg.width as number}
            min={1}
            onChange={(v) =>
              executeCmd(
                new ChangePropertyCommand(
                  node.id,
                  "config",
                  { ...cfg, width: v },
                  cfg,
                ),
              )
            }
          />
        </Field>
      )}
      {"height" in cfg && (
        <Field label="Height">
          <NumberInput
            value={cfg.height as number}
            min={1}
            onChange={(v) =>
              executeCmd(
                new ChangePropertyCommand(
                  node.id,
                  "config",
                  { ...cfg, height: v },
                  cfg,
                ),
              )
            }
          />
        </Field>
      )}
      {"color" in cfg && (
        <Field label="Color">
          <ColorInput
            value={cfg.color as string}
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
      <Field label="Opacity">
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
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stencil panel (§5.11)
// ---------------------------------------------------------------------------

function StencilPanel({ node }: { node: Stencil }) {
  const executeCmd = useExecuteCmd();
  return (
    <div style={{ padding: "0 12px" }}>
      <Field label="Stencil ID">
        <input
          readOnly
          value={node.stencilRef.stencilId}
          style={{ ...inputStyle, color: "var(--io-text-muted)" }}
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
      <Field label="X">
        <NumberInput
          value={Math.round(node.transform.position.x)}
          onChange={(v) =>
            executeCmd(
              new ChangePropertyCommand(
                node.id,
                "transform",
                {
                  ...node.transform,
                  position: { ...node.transform.position, x: v },
                },
                node.transform,
              ),
            )
          }
        />
      </Field>
      <Field label="Y">
        <NumberInput
          value={Math.round(node.transform.position.y)}
          onChange={(v) =>
            executeCmd(
              new ChangePropertyCommand(
                node.id,
                "transform",
                {
                  ...node.transform,
                  position: { ...node.transform.position, y: v },
                },
                node.transform,
              ),
            )
          }
        />
      </Field>
      {node.size && (
        <>
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
        </>
      )}
      <Field label="Opacity">
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
    </div>
  );
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
// Tab bar
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
// Canvas Layers Panel — replaces SceneTreePanel + LayersPanel.
// Shows all canvas objects in z-order (front = top) with eye/lock toggles,
// type labels, point binding badges, and move up/down arrows.
// Groups and symbol_instances expand to reveal children as sub-rows.
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
          userSelect: "none",
        }}
      >
        {/* Expand toggle */}
        <button
          style={{
            ...LAYER_ICON_BTN,
            visibility: hasChildren ? "visible" : "hidden",
          }}
          onClick={(e) => {
            e.stopPropagation();
            onExpand(node.id);
          }}
          title={isExpanded ? "Collapse" : "Expand"}
        >
          {isExpanded ? "▾" : "▸"}
        </button>

        {/* Visibility */}
        <button
          style={LAYER_ICON_BTN}
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
          title={node.visible ? "Hide" : "Show"}
        >
          {node.visible ? "◉" : "○"}
        </button>

        {/* Lock */}
        <button
          style={LAYER_ICON_BTN}
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
          title={node.locked ? "Unlock" : "Lock"}
        >
          {node.locked ? "⊠" : "⊡"}
        </button>

        {/* Type pill */}
        <span
          style={{
            fontSize: 8,
            padding: "1px 3px",
            background: "var(--io-surface-elevated)",
            border: "1px solid var(--io-border)",
            borderRadius: 2,
            color: "var(--io-text-muted)",
            flexShrink: 0,
            letterSpacing: "0.02em",
          }}
        >
          {getNodeTypeShort(node.type)}
        </span>

        {/* Name */}
        <span
          style={{
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontSize: 11,
            paddingLeft: 3,
          }}
        >
          {getNodeDisplayName(node)}
        </span>

        {/* Binding badge */}
        {binding && (
          <span
            style={{
              fontSize: 8,
              padding: "1px 4px",
              background: "var(--io-accent)",
              color: "#fff",
              borderRadius: 2,
              flexShrink: 0,
              maxWidth: 60,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={binding}
          >
            {binding}
          </span>
        )}

        {/* Move up / down — top-level canvas nodes only */}
        {depth === 0 && (
          <div
            style={{ display: "flex", gap: 1, flexShrink: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              style={{ ...LAYER_ICON_BTN, opacity: canMoveUp ? 1 : 0.25 }}
              disabled={!canMoveUp}
              onClick={() =>
                executeCmd(
                  new ReorderNodeCommand(actualIndex + 1, actualIndex, null),
                )
              }
              title="Move forward (up in stack)"
            >
              ↑
            </button>
            <button
              style={{ ...LAYER_ICON_BTN, opacity: canMoveDown ? 1 : 0.25 }}
              disabled={!canMoveDown}
              onClick={() =>
                executeCmd(
                  new ReorderNodeCommand(actualIndex - 1, actualIndex, null),
                )
              }
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
// Main component
// ---------------------------------------------------------------------------

export default function DesignerRightPanel({
  collapsed,
  width,
}: DesignerRightPanelProps) {
  const doc = useSceneStore((s) => s.doc);
  const selectedNodeIds = useUiStore((s) => s.selectedNodeIds);
  const selectedIds = Array.from(selectedNodeIds);
  const getShape = useLibraryStore((s) => s.getShape);

  const [activeTab, setActiveTab] = useState<string>("doc");

  const singleId = selectedIds.length === 1 ? selectedIds[0] : null;
  const singleNode = singleId && doc ? findNodeById(doc, singleId) : null;
  const isSymbol = singleNode?.type === "symbol_instance";
  const shapeEntry = isSymbol
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

  // Switch to "properties" when selection changes; fall back to "doc" when cleared
  const prevSelKey = useRef("");
  useEffect(() => {
    const key = selectedIds.join(",");
    if (key === prevSelKey.current) return;
    prevSelKey.current = key;
    if (selectedIds.length === 0) {
      setActiveTab("doc");
    } else {
      setActiveTab("properties");
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
          PROPERTIES
        </div>
      </div>
    );
  }

  // Build tab list dynamically based on selection state
  const tabs: TabDef[] = [];

  if (!doc) {
    // No document — just Doc tab
  } else if (selectedIds.length === 0) {
    // No selection — Doc tab only (pushed below)
  } else if (selectedIds.length > 1) {
    tabs.push({ id: "properties", label: `${selectedIds.length} Items` });
  } else if (singleNode) {
    const propertiesLabel: Record<string, string> = {
      symbol_instance: "Properties",
      text_block: "Text",
      primitive: "Shape",
      pipe: "Pipe",
      display_element: "Display",
      widget: "Widget",
      image: "Image",
      embedded_svg: "SVG",
      group: "Group",
      annotation: "Annotation",
      stencil: "Stencil",
    };
    tabs.push({
      id: "properties",
      label: propertiesLabel[singleNode.type] ?? "Properties",
    });
    if (isSymbol) {
      tabs.push({ id: "shape", label: "Shape" });
      if (shapeEntry) {
        tabs.push({ id: "sidecar", label: "Sidecar" });
      }
    }
  } else if (singleId) {
    // May be a layer ID
    const layer = doc.layers.find((l) => l.id === singleId);
    if (layer) tabs.push({ id: "properties", label: "Layer" });
  }

  // Document tab is always last / rightmost
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

    if (validTab === "shape" && singleNode?.type === "symbol_instance") {
      return (
        <SymbolInstanceShapeTab
          key={singleNode.id}
          node={singleNode as SymbolInstance}
        />
      );
    }

    if (validTab === "sidecar" && singleNode?.type === "symbol_instance") {
      return (
        <SymbolInstanceSidecarTab
          key={singleNode.id}
          node={singleNode as SymbolInstance}
        />
      );
    }

    // "properties" tab
    if (selectedIds.length === 0) return null;

    if (selectedIds.length > 1) {
      return <MultiSelectionPanel ids={selectedIds} />;
    }

    const nodeId = selectedIds[0];
    const node = findNodeById(doc, nodeId);

    if (!node) {
      const layer = doc.layers.find((l) => l.id === nodeId);
      if (layer) return <LayerPropertiesPanel key={layer.id} layer={layer} />;
      return (
        <div
          style={{ padding: 16, fontSize: 12, color: "var(--io-text-muted)" }}
        >
          Selected item not found
        </div>
      );
    }

    switch (node.type) {
      case "symbol_instance":
        return (
          <SymbolInstancePanel key={node.id} node={node as SymbolInstance} />
        );
      case "text_block":
        return <TextBlockPanel key={node.id} node={node as TextBlock} />;
      case "primitive":
        return <PrimitivePanel key={node.id} node={node as Primitive} />;
      case "pipe":
        return <PipePanel key={node.id} node={node as Pipe} />;
      case "display_element":
        return (
          <DisplayElementPanel key={node.id} node={node as DisplayElement} />
        );
      case "widget":
        return <WidgetPanel key={node.id} node={node as WidgetNode} />;
      case "image":
        return <ImageNodePanel key={node.id} node={node as ImageNode} />;
      case "embedded_svg":
        return (
          <EmbeddedSvgPanel key={node.id} node={node as EmbeddedSvgNode} />
        );
      case "group":
        return <GroupPanel key={node.id} node={node as Group} />;
      case "annotation":
        return <AnnotationPanel key={node.id} node={node as Annotation} />;
      case "stencil":
        return <StencilPanel key={node.id} node={node as Stencil} />;
      default:
        return (
          <div style={{ padding: "0 12px" }}>
            <Field label="Opacity">
              <NumberInput
                value={Math.round(node.opacity * 100)}
                min={0}
                max={100}
                onChange={() => {}}
              />
            </Field>
          </div>
        );
    }
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
