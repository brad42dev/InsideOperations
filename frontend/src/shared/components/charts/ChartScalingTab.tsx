// ---------------------------------------------------------------------------
// ChartScalingTab — Scaling configuration UI for ChartConfigPanel
//
// Three full-width stacked bubbles: Auto / Fixed / Multi-Scale.
// Inactive bubbles show all controls grayed out so users can see what's
// available before selecting a mode.
// ---------------------------------------------------------------------------

import { useRef, useState } from "react";
import type { PointMeta } from "../../../api/points";
import type {
  ChartConfig,
  ChartTypeId,
  ChartPointSlot,
  PerSeriesScale,
} from "./chart-config-types";
import { MULTISCALE_CHARTS, XY_SCALE_CHARTS } from "./chart-config-types";

interface ChartScalingTabProps {
  chartType: ChartTypeId;
  config: ChartConfig;
  points: ChartPointSlot[];
  pointMeta: Map<string, PointMeta>;
  onChange: (patch: Partial<ChartConfig>) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns slots ordered by user-defined seriesOrder, appending any new ones. */
function getOrderedSlots(
  slots: ChartPointSlot[],
  seriesOrder?: string[],
): ChartPointSlot[] {
  if (!seriesOrder || seriesOrder.length === 0) return slots;
  const map = new Map(slots.map((s) => [s.slotId, s]));
  const result: ChartPointSlot[] = [];
  for (const id of seriesOrder) {
    const s = map.get(id);
    if (s) result.push(s);
  }
  for (const s of slots) {
    if (!seriesOrder.includes(s.slotId)) result.push(s);
  }
  return result;
}

/** Recursively resolve "same_as_above" chains. */
function resolveScale(
  slotId: string,
  ordered: ChartPointSlot[],
  perSeries: Record<string, PerSeriesScale>,
  depth = 0,
): PerSeriesScale {
  if (depth > 20) return { mode: "auto" };
  const ss = perSeries[slotId] ?? { mode: "auto" };
  if (ss.mode !== "same_as_above") return ss;
  const idx = ordered.findIndex((s) => s.slotId === slotId);
  if (idx <= 0) return { mode: "auto" };
  return resolveScale(ordered[idx - 1].slotId, ordered, perSeries, depth + 1);
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 28,
  background: "var(--io-input-bg)",
  border: "1px solid var(--io-input-border)",
  color: "var(--io-text-primary)",
  fontSize: 13,
  padding: "0 8px",
  borderRadius: 4,
  outline: "none",
  boxSizing: "border-box",
};

function RadioDot({ active }: { active: boolean }) {
  return (
    <div
      style={{
        width: 16,
        height: 16,
        borderRadius: "50%",
        border: `2px solid ${active ? "var(--io-accent)" : "var(--io-border)"}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        transition: "border-color 0.12s",
      }}
    >
      {active && (
        <div
          style={{
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: "var(--io-accent)",
          }}
        />
      )}
    </div>
  );
}

function NumericInput({
  label,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 80 }}>
      <label style={{ fontSize: 11, color: "var(--io-text-muted)", fontWeight: 500 }}>
        {label}
      </label>
      <input
        type="number"
        value={value ?? ""}
        placeholder={placeholder ?? "Auto"}
        disabled={disabled}
        onChange={(e) => {
          const raw = e.target.value;
          onChange(raw === "" ? undefined : Number(raw));
        }}
        style={{
          ...inputStyle,
          opacity: disabled ? 0.45 : 1,
          cursor: disabled ? "not-allowed" : "text",
        }}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ChartScalingTab({
  chartType,
  config,
  points,
  pointMeta,
  onChange,
}: ChartScalingTabProps) {
  const scaling = config.scaling ?? { type: "auto", autoMode: "largest_visible" };
  const activeMode = scaling.type ?? "auto";
  const autoMode = scaling.autoMode ?? "largest_visible";

  const isXY = XY_SCALE_CHARTS.has(chartType);
  const supportsMultiScale = MULTISCALE_CHARTS.has(chartType);

  // Drag-and-drop state
  const dragSourceId = useRef<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const seriesSlots = points.filter(
    (p) => p.role === "series" || p.role === "y" || p.role === "point",
  );
  const orderedSlots = getOrderedSlots(seriesSlots, scaling.seriesOrder);

  // ── Patch helpers ───────────────────────────────────────────────────────

  function setMode(mode: "auto" | "fixed" | "multiscale") {
    onChange({ scaling: { ...scaling, type: mode } });
  }

  function patchScaling(patch: Partial<typeof scaling>) {
    onChange({ scaling: { ...scaling, ...patch } });
  }

  function getSeriesScale(slotId: string): PerSeriesScale {
    return scaling.perSeries?.[slotId] ?? { mode: "auto" };
  }

  function patchSeriesScale(slotId: string, patch: Partial<PerSeriesScale>) {
    const current = getSeriesScale(slotId);
    onChange({
      scaling: {
        ...scaling,
        perSeries: {
          ...(scaling.perSeries ?? {}),
          [slotId]: { ...current, ...patch },
        },
      },
    });
  }

  // ── Series ordering ─────────────────────────────────────────────────────

  function getCurrentOrder(): string[] {
    return scaling.seriesOrder ?? orderedSlots.map((s) => s.slotId);
  }

  function moveSlot(slotId: string, dir: "up" | "down") {
    const order = getCurrentOrder();
    const idx = order.indexOf(slotId);
    if (dir === "up" && idx <= 0) return;
    if (dir === "down" && idx >= order.length - 1) return;
    const next = [...order];
    const swap = dir === "up" ? idx - 1 : idx + 1;
    [next[idx], next[swap]] = [next[swap], next[idx]];
    patchScaling({ seriesOrder: next });
  }

  function handleDragStart(slotId: string) {
    dragSourceId.current = slotId;
  }

  function handleDragOver(e: React.DragEvent, slotId: string) {
    e.preventDefault();
    setDragOverId(slotId);
  }

  function handleDrop(targetSlotId: string) {
    const srcId = dragSourceId.current;
    if (!srcId || srcId === targetSlotId) {
      setDragOverId(null);
      return;
    }
    const order = getCurrentOrder();
    const srcIdx = order.indexOf(srcId);
    const dstIdx = order.indexOf(targetSlotId);
    if (srcIdx < 0 || dstIdx < 0) {
      setDragOverId(null);
      return;
    }
    const next = [...order];
    next.splice(srcIdx, 1);
    next.splice(dstIdx, 0, srcId);
    patchScaling({ seriesOrder: next });
    dragSourceId.current = null;
    setDragOverId(null);
  }

  function handleDragEnd() {
    dragSourceId.current = null;
    setDragOverId(null);
  }

  // ── Bubble wrapper styles ───────────────────────────────────────────────

  function bubbleStyle(active: boolean): React.CSSProperties {
    return {
      border: `1px solid ${active ? "var(--io-accent)" : "var(--io-border)"}`,
      borderRadius: 8,
      background: active
        ? "color-mix(in srgb, var(--io-accent) 8%, var(--io-surface))"
        : "var(--io-surface)",
      transition: "border-color 0.15s, background 0.15s",
      overflow: "hidden",
    };
  }

  function bubbleHeaderStyle(): React.CSSProperties {
    return {
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "14px 16px 12px",
      cursor: "pointer",
      userSelect: "none",
    };
  }

  function bubbleContentStyle(active: boolean): React.CSSProperties {
    return {
      padding: "0 16px 16px",
      opacity: active ? 1 : 0.45,
      pointerEvents: active ? undefined : "none",
      transition: "opacity 0.15s",
    };
  }

  // ── Tooltip helper ──────────────────────────────────────────────────────

  function slotTooltip(slot: ChartPointSlot): string {
    const meta = pointMeta.get(slot.pointId);
    const tag = slot.tagname ?? meta?.tagname ?? slot.pointId;
    const display = slot.label ?? meta?.display_name ?? null;
    if (display && display !== tag) return `${tag} — ${display}`;
    return tag;
  }

  function slotDisplayName(slot: ChartPointSlot): string {
    const meta = pointMeta.get(slot.pointId);
    return slot.label ?? meta?.display_name ?? slot.tagname ?? slot.pointId;
  }

  function slotTagname(slot: ChartPointSlot): string {
    const meta = pointMeta.get(slot.pointId);
    return slot.tagname ?? meta?.tagname ?? slot.pointId;
  }

  // ── Scale mode options ──────────────────────────────────────────────────

  function seriesModeOptions(
    slot: ChartPointSlot,
    isFirst: boolean,
  ): { value: string; label: string; disabled?: boolean }[] {
    const meta = pointMeta.get(slot.pointId);
    const hasRange = meta?.eu_range_low != null || meta?.eu_range_high != null;
    return [
      { value: "auto", label: "Auto" },
      {
        value: "range",
        label: hasRange ? "Scale to EU Range" : "Scale to EU Range (unavailable)",
        disabled: !hasRange,
      },
      { value: "custom", label: "Custom" },
      { value: "same_as_above", label: "Same as Above", disabled: isFirst },
    ];
  }

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 700 }}>

      {/* ═══ AUTO BUBBLE ═══════════════════════════════════════════════════ */}
      <div style={bubbleStyle(activeMode === "auto")}>
        <div style={bubbleHeaderStyle()} onClick={() => setMode("auto")}>
          <RadioDot active={activeMode === "auto"} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--io-text-primary)" }}>
              Auto
            </div>
            <div style={{ fontSize: 12, color: "var(--io-text-muted)", marginTop: 1 }}>
              Automatically scale axes to fit data
            </div>
          </div>
        </div>

        <div style={bubbleContentStyle(activeMode === "auto")}>
          <div style={{ display: "flex", gap: 10 }}>
            {/* Largest Visible */}
            <div
              style={{
                flex: 1,
                padding: "12px 14px",
                border: `1px solid ${activeMode === "auto" && autoMode === "largest_visible" ? "var(--io-accent)" : "var(--io-border)"}`,
                borderRadius: 6,
                cursor: "pointer",
                background:
                  activeMode === "auto" && autoMode === "largest_visible"
                    ? "color-mix(in srgb, var(--io-accent) 10%, transparent)"
                    : "var(--io-bg)",
                transition: "border-color 0.12s, background 0.12s",
              }}
              onClick={() => patchScaling({ autoMode: "largest_visible" })}
              title="Zooms the Y axis to fit only the values currently visible in the chart window. The scale adjusts as you pan or zoom in time."
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <RadioDot active={activeMode === "auto" && autoMode === "largest_visible"} />
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--io-text-primary)" }}>
                  Largest Visible
                </span>
              </div>
              <div style={{ fontSize: 12, color: "var(--io-text-muted)", paddingLeft: 24 }}>
                Scale to the range of data visible in the current time window
              </div>
            </div>

            {/* Largest EU Range */}
            <div
              style={{
                flex: 1,
                padding: "12px 14px",
                border: `1px solid ${activeMode === "auto" && autoMode === "largest_eu_range" ? "var(--io-accent)" : "var(--io-border)"}`,
                borderRadius: 6,
                cursor: "pointer",
                background:
                  activeMode === "auto" && autoMode === "largest_eu_range"
                    ? "color-mix(in srgb, var(--io-accent) 10%, transparent)"
                    : "var(--io-bg)",
                transition: "border-color 0.12s, background 0.12s",
              }}
              onClick={() => patchScaling({ autoMode: "largest_eu_range" })}
              title="Fixes the Y axis to span the full engineering unit range defined in the OPC server for these points. The scale stays constant regardless of current values."
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <RadioDot active={activeMode === "auto" && autoMode === "largest_eu_range"} />
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--io-text-primary)" }}>
                  Largest EU Range
                </span>
              </div>
              <div style={{ fontSize: 12, color: "var(--io-text-muted)", paddingLeft: 24 }}>
                Scale to the full operating range defined in the OPC server
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ FIXED BUBBLE ══════════════════════════════════════════════════ */}
      <div style={bubbleStyle(activeMode === "fixed")}>
        <div style={bubbleHeaderStyle()} onClick={() => setMode("fixed")}>
          <RadioDot active={activeMode === "fixed"} />
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--io-text-primary)" }}>
              Fixed
            </div>
            <div style={{ fontSize: 12, color: "var(--io-text-muted)", marginTop: 1 }}>
              Pin the axis to a specific range regardless of data values
            </div>
          </div>
        </div>

        <div style={bubbleContentStyle(activeMode === "fixed")}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {/* Y Axis */}
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: "var(--io-text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Y Axis Range
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <NumericInput label="Y Min" value={scaling.yMin} onChange={(v) => patchScaling({ yMin: v })} disabled={activeMode !== "fixed"} />
                <NumericInput label="Y Max" value={scaling.yMax} onChange={(v) => patchScaling({ yMax: v })} disabled={activeMode !== "fixed"} />
              </div>
            </div>

            {/* X Axis (XY charts only) */}
            {isXY && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--io-text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  X Axis Range
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  <NumericInput label="X Min" value={scaling.xMin} onChange={(v) => patchScaling({ xMin: v })} disabled={activeMode !== "fixed"} />
                  <NumericInput label="X Max" value={scaling.xMax} onChange={(v) => patchScaling({ xMax: v })} disabled={activeMode !== "fixed"} />
                </div>
              </div>
            )}

            <div style={{ fontSize: 12, color: "var(--io-text-muted)" }}>
              Leave a field blank to auto-fit that bound.
            </div>
          </div>
        </div>
      </div>

      {/* ═══ MULTI-SCALE BUBBLE ════════════════════════════════════════════ */}
      {supportsMultiScale && (
        <div style={bubbleStyle(activeMode === "multiscale")}>
          <div style={bubbleHeaderStyle()} onClick={() => setMode("multiscale")}>
            <RadioDot active={activeMode === "multiscale"} />
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--io-text-primary)" }}>
                Multi-Scale
              </div>
              <div style={{ fontSize: 12, color: "var(--io-text-muted)", marginTop: 1 }}>
                Independent scaling per point — stack similar ranges to share axis labels
              </div>
            </div>
          </div>

          <div style={bubbleContentStyle(activeMode === "multiscale")}>
            {seriesSlots.length === 0 ? (
              <div style={{ fontSize: 13, color: "var(--io-text-muted)", padding: "4px 0 8px" }}>
                No points assigned. Add points in the Data Points tab first.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {/* Header */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "52px 1fr 148px 72px 72px 36px",
                    gap: 6,
                    padding: "4px 8px 6px",
                    fontSize: 11,
                    fontWeight: 600,
                    color: "var(--io-text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  <span />
                  <span>Point</span>
                  <span>Scale Mode</span>
                  <span>Min</span>
                  <span>Max</span>
                  <span style={{ textAlign: "center" }} title="Show axis label for this series">
                    Label
                  </span>
                </div>

                {/* Rows */}
                {orderedSlots.map((slot, idx) => {
                  const ss = getSeriesScale(slot.slotId);
                  const effective = resolveScale(slot.slotId, orderedSlots, scaling.perSeries ?? {});
                  const meta = pointMeta.get(slot.pointId);
                  const hasRange =
                    meta?.eu_range_low != null || meta?.eu_range_high != null;
                  const isFirst = idx === 0;
                  const isSameAsAbove = ss.mode === "same_as_above";
                  const inputsDisabled =
                    isSameAsAbove || effective.mode === "auto" || effective.mode === "range";
                  const isDragTarget = dragOverId === slot.slotId;

                  return (
                    <div
                      key={slot.slotId}
                      draggable
                      onDragStart={() => handleDragStart(slot.slotId)}
                      onDragOver={(e) => handleDragOver(e, slot.slotId)}
                      onDrop={() => handleDrop(slot.slotId)}
                      onDragEnd={handleDragEnd}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "52px 1fr 148px 72px 72px 36px",
                        gap: 6,
                        alignItems: "center",
                        padding: "5px 8px",
                        background: isDragTarget
                          ? "color-mix(in srgb, var(--io-accent) 12%, var(--io-surface))"
                          : "var(--io-surface)",
                        border: `1px solid ${isDragTarget ? "var(--io-accent)" : "var(--io-border)"}`,
                        borderRadius: 4,
                        marginBottom: 4,
                        opacity: isSameAsAbove ? 0.7 : 1,
                        transition: "background 0.1s, border-color 0.1s",
                        cursor: "grab",
                      }}
                    >
                      {/* Drag handle + up/down */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 2,
                          color: "var(--io-text-muted)",
                        }}
                      >
                        <span
                          style={{ fontSize: 14, cursor: "grab", lineHeight: 1, padding: "0 2px", opacity: 0.6 }}
                          title="Drag to reorder"
                        >
                          ⠿
                        </span>
                        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              moveSlot(slot.slotId, "up");
                            }}
                            disabled={isFirst}
                            style={{
                              background: "none",
                              border: "none",
                              padding: "1px 3px",
                              cursor: isFirst ? "not-allowed" : "pointer",
                              color: isFirst ? "var(--io-text-disabled, #666)" : "var(--io-text-muted)",
                              fontSize: 9,
                              lineHeight: 1,
                            }}
                            title="Move up"
                          >
                            ▲
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              moveSlot(slot.slotId, "down");
                            }}
                            disabled={idx === orderedSlots.length - 1}
                            style={{
                              background: "none",
                              border: "none",
                              padding: "1px 3px",
                              cursor: idx === orderedSlots.length - 1 ? "not-allowed" : "pointer",
                              color:
                                idx === orderedSlots.length - 1
                                  ? "var(--io-text-disabled, #666)"
                                  : "var(--io-text-muted)",
                              fontSize: 9,
                              lineHeight: 1,
                            }}
                            title="Move down"
                          >
                            ▼
                          </button>
                        </div>
                      </div>

                      {/* Point name */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 6,
                          minWidth: 0,
                          overflow: "hidden",
                        }}
                        title={slotTooltip(slot)}
                      >
                        <div
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 2,
                            background: slot.color ?? "#4A9EFF",
                            flexShrink: 0,
                          }}
                        />
                        <div style={{ minWidth: 0, overflow: "hidden" }}>
                          <div
                            style={{
                              fontSize: 13,
                              color: "var(--io-text-primary)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {slotDisplayName(slot)}
                          </div>
                          {slotDisplayName(slot) !== slotTagname(slot) && (
                            <div
                              style={{
                                fontSize: 11,
                                color: "var(--io-text-muted)",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {slotTagname(slot)}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Scale mode */}
                      <select
                        value={ss.mode}
                        onChange={(e) =>
                          patchSeriesScale(slot.slotId, {
                            mode: e.target.value as PerSeriesScale["mode"],
                          })
                        }
                        style={{
                          ...inputStyle,
                          cursor: "pointer",
                        }}
                      >
                        {seriesModeOptions(slot, isFirst).map((opt) => (
                          <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                            {opt.label}
                          </option>
                        ))}
                      </select>

                      {/* Min */}
                      <div style={{ position: "relative" }}>
                        <input
                          type="number"
                          value={isSameAsAbove ? (effective.min ?? "") : (ss.min ?? "")}
                          placeholder={
                            effective.mode === "range" && hasRange
                              ? String(meta?.eu_range_low ?? "—")
                              : "Auto"
                          }
                          disabled={inputsDisabled}
                          onChange={(e) => {
                            const raw = e.target.value;
                            patchSeriesScale(slot.slotId, {
                              min: raw === "" ? undefined : Number(raw),
                            });
                          }}
                          style={{
                            ...inputStyle,
                            opacity: inputsDisabled ? 0.45 : 1,
                            cursor: inputsDisabled ? "not-allowed" : "text",
                          }}
                        />
                      </div>

                      {/* Max */}
                      <div>
                        <input
                          type="number"
                          value={isSameAsAbove ? (effective.max ?? "") : (ss.max ?? "")}
                          placeholder={
                            effective.mode === "range" && hasRange
                              ? String(meta?.eu_range_high ?? "—")
                              : "Auto"
                          }
                          disabled={inputsDisabled}
                          onChange={(e) => {
                            const raw = e.target.value;
                            patchSeriesScale(slot.slotId, {
                              max: raw === "" ? undefined : Number(raw),
                            });
                          }}
                          style={{
                            ...inputStyle,
                            opacity: inputsDisabled ? 0.45 : 1,
                            cursor: inputsDisabled ? "not-allowed" : "text",
                          }}
                        />
                      </div>

                      {/* Axis label visible */}
                      <div style={{ display: "flex", justifyContent: "center" }}>
                        <input
                          type="checkbox"
                          checked={ss.axisLabelVisible ?? false}
                          onChange={(e) =>
                            patchSeriesScale(slot.slotId, {
                              axisLabelVisible: e.target.checked,
                            })
                          }
                          title="Show Y-axis label for this series"
                          style={{ width: 15, height: 15, cursor: "pointer", accentColor: "var(--io-accent)" }}
                        />
                      </div>
                    </div>
                  );
                })}

                <div style={{ fontSize: 12, color: "var(--io-text-muted)", marginTop: 4 }}>
                  <b>Scale to EU Range</b> uses the engineering unit range from the OPC server.{" "}
                  <b>Same as Above</b> inherits the row above it — stack like-ranged points and enable one axis label to group them.
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
