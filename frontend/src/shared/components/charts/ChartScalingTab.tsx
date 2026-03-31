// ---------------------------------------------------------------------------
// ChartScalingTab — Scaling configuration UI for ChartConfigPanel
// Three modes: Auto / Fixed / Multi-Scale (multi-scale only for eligible charts)
// ---------------------------------------------------------------------------

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

const MODE_CARDS = [
  {
    id: "auto" as const,
    label: "Auto",
    desc: "Scale to fit visible data",
  },
  {
    id: "fixed" as const,
    label: "Fixed",
    desc: "Set a fixed axis range",
  },
  {
    id: "multiscale" as const,
    label: "Multi-Scale",
    desc: "Different range per point",
  },
];

const SERIES_MODE_LABELS: Record<string, string> = {
  auto: "Auto",
  range: "Scale to Range",
  custom: "Custom",
};

const inputStyle: React.CSSProperties = {
  width: 90,
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

function NumericInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  placeholder?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label
        style={{ fontSize: 11, color: "var(--io-text-muted)", fontWeight: 500 }}
      >
        {label}
      </label>
      <input
        type="number"
        value={value ?? ""}
        placeholder={placeholder ?? ""}
        onChange={(e) => {
          const raw = e.target.value;
          onChange(raw === "" ? undefined : Number(raw));
        }}
        style={inputStyle}
      />
    </div>
  );
}

export default function ChartScalingTab({
  chartType,
  config,
  points,
  pointMeta,
  onChange,
}: ChartScalingTabProps) {
  const scaling = config.scaling ?? { type: "auto" };
  const activeMode = scaling.type ?? "auto";

  const isXY = XY_SCALE_CHARTS.has(chartType);
  const supportsMultiScale = MULTISCALE_CHARTS.has(chartType);

  const visibleCards = supportsMultiScale
    ? MODE_CARDS
    : MODE_CARDS.filter((c) => c.id !== "multiscale");

  function setMode(mode: "auto" | "fixed" | "multiscale") {
    onChange({ scaling: { ...scaling, type: mode } });
  }

  function patchScaling(patch: Partial<typeof scaling>) {
    onChange({ scaling: { ...scaling, ...patch } });
  }

  // Series points (the ones that get per-series scaling)
  const seriesSlots = points.filter(
    (p) => p.role === "series" || p.role === "y" || p.role === "point",
  );

  function getSeriesScale(slotId: string): PerSeriesScale {
    return scaling.perSeries?.[slotId] ?? { mode: "auto" };
  }

  function patchSeriesScale(slotId: string, patch: Partial<PerSeriesScale>) {
    const current = getSeriesScale(slotId);
    const updated = { ...current, ...patch };
    onChange({
      scaling: {
        ...scaling,
        perSeries: { ...(scaling.perSeries ?? {}), [slotId]: updated },
      },
    });
  }

  const cardStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: "14px 16px",
    border: `1px solid ${active ? "var(--io-accent)" : "var(--io-border)"}`,
    borderRadius: 6,
    cursor: "pointer",
    background: active
      ? "color-mix(in srgb, var(--io-accent) 10%, transparent)"
      : "var(--io-surface)",
    transition: "border-color 0.12s, background 0.12s",
  });

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 20,
        maxWidth: 640,
      }}
    >
      {/* ── Mode cards ─────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 10 }}>
        {visibleCards.map((card) => (
          <div
            key={card.id}
            style={cardStyle(activeMode === card.id)}
            onClick={() => setMode(card.id)}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 4,
              }}
            >
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: "50%",
                  border: `2px solid ${activeMode === card.id ? "var(--io-accent)" : "var(--io-border)"}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {activeMode === card.id && (
                  <div
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: "var(--io-accent)",
                    }}
                  />
                )}
              </div>
              <span
                style={{
                  fontWeight: 600,
                  fontSize: 13,
                  color: "var(--io-text-primary)",
                }}
              >
                {card.label}
              </span>
            </div>
            <div
              style={{
                fontSize: 12,
                color: "var(--io-text-muted)",
                paddingLeft: 22,
              }}
            >
              {card.desc}
            </div>
          </div>
        ))}
      </div>

      {/* ── Fixed mode: axis range inputs ──────────────────────────────── */}
      {activeMode === "fixed" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: "var(--io-text-primary)",
            }}
          >
            Y Axis Range
          </div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <NumericInput
              label="Y Min"
              value={scaling.yMin}
              onChange={(v) => patchScaling({ yMin: v })}
              placeholder="Auto"
            />
            <NumericInput
              label="Y Max"
              value={scaling.yMax}
              onChange={(v) => patchScaling({ yMax: v })}
              placeholder="Auto"
            />
          </div>
          {isXY && (
            <>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--io-text-primary)",
                }}
              >
                X Axis Range
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <NumericInput
                  label="X Min"
                  value={scaling.xMin}
                  onChange={(v) => patchScaling({ xMin: v })}
                  placeholder="Auto"
                />
                <NumericInput
                  label="X Max"
                  value={scaling.xMax}
                  onChange={(v) => patchScaling({ xMax: v })}
                  placeholder="Auto"
                />
              </div>
            </>
          )}
          <div style={{ fontSize: 12, color: "var(--io-text-muted)" }}>
            Leave a field blank to let that axis bound scale automatically.
          </div>
        </div>
      )}

      {/* ── Multi-Scale: per-series rows ───────────────────────────────── */}
      {activeMode === "multiscale" && supportsMultiScale && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {seriesSlots.length === 0 && (
            <div
              style={{
                fontSize: 13,
                color: "var(--io-text-muted)",
                padding: "12px 0",
              }}
            >
              No points assigned. Add points in the Data Points tab first.
            </div>
          )}
          {seriesSlots.length > 0 && (
            <>
              {/* Header row */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 160px 80px 80px",
                  gap: 8,
                  padding: "4px 8px",
                  fontSize: 11,
                  fontWeight: 600,
                  color: "var(--io-text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                <span>Point</span>
                <span>Scale Mode</span>
                <span>Min</span>
                <span>Max</span>
              </div>

              {seriesSlots.map((slot) => {
                const meta = pointMeta.get(slot.pointId);
                const ss = getSeriesScale(slot.slotId);
                const hasRange =
                  meta?.eu_range_low != null || meta?.eu_range_high != null;

                return (
                  <div
                    key={slot.slotId}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 160px 80px 80px",
                      gap: 8,
                      alignItems: "center",
                      padding: "6px 8px",
                      background: "var(--io-surface)",
                      border: "1px solid var(--io-border)",
                      borderRadius: 4,
                    }}
                  >
                    {/* Point name */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        minWidth: 0,
                      }}
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
                      <span
                        style={{
                          fontSize: 12,
                          color: "var(--io-text-primary)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={meta?.tagname ?? slot.pointId}
                      >
                        {meta?.tagname ?? slot.pointId}
                      </span>
                    </div>

                    {/* Scale mode select */}
                    <div>
                      <select
                        value={ss.mode}
                        onChange={(e) =>
                          patchSeriesScale(slot.slotId, {
                            mode: e.target.value as PerSeriesScale["mode"],
                          })
                        }
                        style={{
                          ...inputStyle,
                          width: "100%",
                          cursor: "pointer",
                        }}
                        title={
                          !hasRange && ss.mode === "range"
                            ? "No OPC EU range available for this point"
                            : undefined
                        }
                      >
                        {Object.entries(SERIES_MODE_LABELS).map(
                          ([val, label]) => (
                            <option
                              key={val}
                              value={val}
                              disabled={val === "range" && !hasRange}
                            >
                              {label}
                              {val === "range" && !hasRange
                                ? " (no range)"
                                : ""}
                            </option>
                          ),
                        )}
                      </select>
                    </div>

                    {/* Min / Max (only for 'custom' mode) */}
                    <div>
                      {ss.mode === "custom" && (
                        <input
                          type="number"
                          value={ss.min ?? ""}
                          placeholder="Auto"
                          onChange={(e) => {
                            const raw = e.target.value;
                            patchSeriesScale(slot.slotId, {
                              min: raw === "" ? undefined : Number(raw),
                            });
                          }}
                          style={inputStyle}
                        />
                      )}
                      {ss.mode === "range" && (
                        <span
                          style={{
                            fontSize: 11,
                            color: "var(--io-text-muted)",
                          }}
                        >
                          {meta?.eu_range_low != null ? meta.eu_range_low : "—"}
                        </span>
                      )}
                    </div>

                    <div>
                      {ss.mode === "custom" && (
                        <input
                          type="number"
                          value={ss.max ?? ""}
                          placeholder="Auto"
                          onChange={(e) => {
                            const raw = e.target.value;
                            patchSeriesScale(slot.slotId, {
                              max: raw === "" ? undefined : Number(raw),
                            });
                          }}
                          style={inputStyle}
                        />
                      )}
                      {ss.mode === "range" && (
                        <span
                          style={{
                            fontSize: 11,
                            color: "var(--io-text-muted)",
                          }}
                        >
                          {meta?.eu_range_high != null
                            ? meta.eu_range_high
                            : "—"}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              <div
                style={{
                  fontSize: 12,
                  color: "var(--io-text-muted)",
                  marginTop: 4,
                }}
              >
                <b>Scale to Range</b> uses the engineering unit range configured
                in the OPC server for each point.
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
