// ---------------------------------------------------------------------------
// ChartOptionsForm — dynamic per-chart options panel
// Renders only the options that make sense for the selected chart type.
// ---------------------------------------------------------------------------

import type {
  ChartConfig,
  ChartTypeId,
  AggregateType,
} from "./chart-config-types";
import {
  CHART_AGGREGATE_TYPES,
  CHART_HAS_DURATION,
  AGGREGATE_LABELS,
  getValidBuckets,
} from "./chart-aggregate-config";

interface ChartOptionsFormProps {
  chartType: ChartTypeId;
  config: ChartConfig;
  onChange: (patch: Partial<ChartConfig>) => void;
}

// Which charts support real-time live mode (duration window)
const LIVE_CHARTS = new Set<ChartTypeId>([1, 4, 7, 8, 9, 10, 11, 12, 35]);
// Charts that have traditional X/Y axes where the axis-label setting is
// actually implemented. Charts NOT in this set (gauges, pies, treemaps,
// 3D surface, etc.) have no meaningful X/Y axis label to control.
const CHARTS_WITH_AXIS_LABELS = new Set<ChartTypeId>([5]);
// Charts with a legend
const LEGEND_CHARTS = new Set<ChartTypeId>([
  1, 2, 3, 4, 5, 6, 13, 16, 18, 19, 20, 21, 22, 24, 25, 26, 29, 30, 32, 33, 37,
]);
// Charts with interpolation (linear vs step)
const INTERPOLATION_CHARTS = new Set<ChartTypeId>([1, 2, 3, 4, 16, 22]);

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: "1em" }}>
      <div
        style={{
          fontSize: "0.85em",
          fontWeight: 600,
          color: "var(--io-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: "0.5em",
          paddingBottom: "0.25em",
          borderBottom: "1px solid var(--io-border)",
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function Row({
  label,
  title,
  children,
}: {
  label: string;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: "0.5em",
      }}
    >
      <label
        title={title}
        style={{
          flex: "0 0 130px",
          fontSize: "1em",
          color: "var(--io-text-muted)",
          cursor: title ? "help" : undefined,
        }}
      >
        {label}
      </label>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  height: 26,
  background: "var(--io-input-bg)",
  border: "1px solid var(--io-input-border)",
  color: "var(--io-text-primary)",
  fontSize: "1em",
  padding: "0 8px",
  borderRadius: 4,
  outline: "none",
  width: "100%",
  boxSizing: "border-box",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: "pointer",
};

const checkStyle: React.CSSProperties = {
  width: 14,
  height: 14,
  cursor: "pointer",
  accentColor: "var(--io-accent)",
};

// ---------------------------------------------------------------------------
// Per-chart extras
// ---------------------------------------------------------------------------

function ExtrasGauge({
  extras,
  onExtras,
}: {
  extras: Record<string, unknown>;
  onExtras: (e: Record<string, unknown>) => void;
}) {
  return (
    <Section title="Gauge Options">
      <Row label="Style">
        <select
          value={(extras.style as string) ?? "arc"}
          onChange={(e) => onExtras({ ...extras, style: e.target.value })}
          style={selectStyle}
        >
          <option value="arc">Arc (half-circle)</option>
          <option value="full">Full circle</option>
          <option value="clock">Clock</option>
        </select>
      </Row>
      <Row label="Show needle">
        <input
          type="checkbox"
          checked={(extras.showNeedle as boolean) ?? true}
          onChange={(e) =>
            onExtras({ ...extras, showNeedle: e.target.checked })
          }
          style={checkStyle}
        />
      </Row>
      <Row label="Target value">
        <input
          type="number"
          placeholder="(none)"
          value={(extras.target as number) ?? ""}
          onChange={(e) =>
            onExtras({
              ...extras,
              target: e.target.value ? Number(e.target.value) : undefined,
            })
          }
          style={inputStyle}
        />
      </Row>
    </Section>
  );
}

function ExtrasPieDonut({
  extras,
  onExtras,
}: {
  extras: Record<string, unknown>;
  onExtras: (e: Record<string, unknown>) => void;
}) {
  const isDonut = (extras.donut as boolean) ?? false;
  return (
    <Section title="Pie / Donut Options">
      <Row label="Donut (hollow)">
        <input
          type="checkbox"
          checked={isDonut}
          onChange={(e) => onExtras({ ...extras, donut: e.target.checked })}
          style={checkStyle}
        />
      </Row>
      <Row label="Show labels">
        <select
          value={(extras.labelType as string) ?? "percent"}
          onChange={(e) => onExtras({ ...extras, labelType: e.target.value })}
          style={selectStyle}
        >
          <option value="none">None</option>
          <option value="percent">Percent</option>
          <option value="value">Actual value</option>
          <option value="both">Both</option>
        </select>
      </Row>
      <Row label="Start angle °">
        <input
          type="number"
          value={(extras.startAngle as number) ?? -90}
          onChange={(e) =>
            onExtras({ ...extras, startAngle: Number(e.target.value) })
          }
          style={inputStyle}
        />
      </Row>
      {isDonut && (
        <Row label="Center label">
          <input
            type="text"
            placeholder="Total"
            value={(extras.centerLabel as string) ?? ""}
            onChange={(e) =>
              onExtras({ ...extras, centerLabel: e.target.value })
            }
            style={inputStyle}
          />
        </Row>
      )}
      <Row label="Other bucket label">
        <input
          type="text"
          placeholder="Other"
          value={(extras.otherLabel as string) ?? ""}
          onChange={(e) => onExtras({ ...extras, otherLabel: e.target.value })}
          style={inputStyle}
        />
      </Row>
    </Section>
  );
}

function ExtrasBarColumn({
  extras,
  onExtras,
}: {
  extras: Record<string, unknown>;
  onExtras: (e: Record<string, unknown>) => void;
}) {
  const stacked = (extras.stacked as boolean) ?? false;
  const comboLine = (extras.comboLine as boolean) ?? false;
  return (
    <Section title="Bar Options">
      <Row label="Orientation">
        <select
          value={(extras.orientation as string) ?? "vertical"}
          onChange={(e) => onExtras({ ...extras, orientation: e.target.value })}
          style={selectStyle}
        >
          <option value="vertical">Vertical (column)</option>
          <option value="horizontal">Horizontal (bar)</option>
        </select>
      </Row>
      <Row label="Stack bars">
        <input
          type="checkbox"
          checked={stacked}
          onChange={(e) => onExtras({ ...extras, stacked: e.target.checked })}
          style={checkStyle}
        />
      </Row>
      {stacked && (
        <Row label="Stack mode">
          <select
            value={(extras.stackMode as string) ?? "absolute"}
            onChange={(e) => onExtras({ ...extras, stackMode: e.target.value })}
            style={selectStyle}
          >
            <option value="absolute">Absolute values</option>
            <option value="percent">100% normalized</option>
          </select>
        </Row>
      )}
      <Row label="Error bars">
        <select
          value={(extras.errorBars as string) ?? "none"}
          onChange={(e) => onExtras({ ...extras, errorBars: e.target.value })}
          style={selectStyle}
        >
          <option value="none">None</option>
          <option value="stddev">±1 Std dev</option>
          <option value="range">Min / Max range</option>
        </select>
      </Row>
      <Row label="Combo line overlay">
        <input
          type="checkbox"
          checked={comboLine}
          onChange={(e) => onExtras({ ...extras, comboLine: e.target.checked })}
          style={checkStyle}
        />
      </Row>
      {comboLine && (
        <Row label="Line label">
          <input
            type="text"
            placeholder="Target"
            value={(extras.comboLineLabel as string) ?? ""}
            onChange={(e) =>
              onExtras({ ...extras, comboLineLabel: e.target.value })
            }
            style={inputStyle}
          />
        </Row>
      )}
      <Row label="Show values">
        <input
          type="checkbox"
          checked={(extras.showValues as boolean) ?? false}
          onChange={(e) =>
            onExtras({ ...extras, showValues: e.target.checked })
          }
          style={checkStyle}
        />
      </Row>
    </Section>
  );
}

function ExtrasKpiCard({
  extras,
  onExtras,
}: {
  extras: Record<string, unknown>;
  onExtras: (e: Record<string, unknown>) => void;
}) {
  return (
    <Section title="KPI Card Options">
      <Row label="Prefix">
        <input
          type="text"
          placeholder="e.g. $"
          value={(extras.prefix as string) ?? ""}
          onChange={(e) => onExtras({ ...extras, prefix: e.target.value })}
          style={inputStyle}
        />
      </Row>
      <Row label="Suffix">
        <input
          type="text"
          placeholder="e.g. °C"
          value={(extras.suffix as string) ?? ""}
          onChange={(e) => onExtras({ ...extras, suffix: e.target.value })}
          style={inputStyle}
        />
      </Row>
      <Row label="Decimal places">
        <input
          type="number"
          min={0}
          max={6}
          value={(extras.decimals as number) ?? 2}
          onChange={(e) =>
            onExtras({ ...extras, decimals: Number(e.target.value) })
          }
          style={inputStyle}
        />
      </Row>
      <Row label="Show sparkline">
        <input
          type="checkbox"
          checked={(extras.showSparkline as boolean) ?? true}
          onChange={(e) =>
            onExtras({ ...extras, showSparkline: e.target.checked })
          }
          style={checkStyle}
        />
      </Row>
      <Row label="Target / good above">
        <input
          type="number"
          placeholder="(none)"
          value={(extras.target as number) ?? ""}
          onChange={(e) =>
            onExtras({
              ...extras,
              target: e.target.value ? Number(e.target.value) : undefined,
            })
          }
          style={inputStyle}
        />
      </Row>
    </Section>
  );
}

function ExtrasAnalogBar({
  extras,
  onExtras,
}: {
  extras: Record<string, unknown>;
  onExtras: (e: Record<string, unknown>) => void;
}) {
  return (
    <Section title="Analog Bar Options">
      <Row label="Orientation">
        <select
          value={(extras.orientation as string) ?? "horizontal"}
          onChange={(e) => onExtras({ ...extras, orientation: e.target.value })}
          style={selectStyle}
        >
          <option value="horizontal">Horizontal</option>
          <option value="vertical">Vertical</option>
        </select>
      </Row>
      <Row label="Show setpoint line">
        <input
          type="checkbox"
          checked={(extras.showSetpoint as boolean) ?? true}
          onChange={(e) =>
            onExtras({ ...extras, showSetpoint: e.target.checked })
          }
          style={checkStyle}
        />
      </Row>
    </Section>
  );
}

function ExtrasFillGauge({
  extras,
  onExtras,
}: {
  extras: Record<string, unknown>;
  onExtras: (e: Record<string, unknown>) => void;
}) {
  return (
    <Section title="Fill Gauge Options">
      <Row label="Shape">
        <select
          value={(extras.shape as string) ?? "cylinder"}
          onChange={(e) => onExtras({ ...extras, shape: e.target.value })}
          style={selectStyle}
        >
          <option value="cylinder">Cylinder / tank</option>
          <option value="rect">Rectangle</option>
        </select>
      </Row>
      <Row label="Warn threshold %">
        <input
          type="number"
          min={0}
          max={100}
          value={(extras.warnPct as number) ?? 80}
          onChange={(e) =>
            onExtras({ ...extras, warnPct: Number(e.target.value) })
          }
          style={inputStyle}
        />
      </Row>
    </Section>
  );
}

function ExtrasScatter({
  extras,
  onExtras,
}: {
  extras: Record<string, unknown>;
  onExtras: (e: Record<string, unknown>) => void;
}) {
  const densityMode = (extras.densityMode as string) ?? "auto";
  return (
    <Section title="Scatter Options">
      <Row label="Show regression line">
        <input
          type="checkbox"
          checked={(extras.regression as boolean) ?? false}
          onChange={(e) =>
            onExtras({ ...extras, regression: e.target.checked })
          }
          style={checkStyle}
        />
      </Row>
      <Row label="Symbol size">
        <input
          type="number"
          min={2}
          max={20}
          value={(extras.symbolSize as number) ?? 6}
          onChange={(e) =>
            onExtras({ ...extras, symbolSize: Number(e.target.value) })
          }
          style={inputStyle}
        />
      </Row>
      <Row label="Color by time">
        <input
          type="checkbox"
          checked={(extras.colorByTime as boolean) ?? false}
          onChange={(e) =>
            onExtras({ ...extras, colorByTime: e.target.checked })
          }
          style={checkStyle}
        />
      </Row>
      <Row label="Point opacity">
        <input
          type="number"
          min={0.1}
          max={1}
          step={0.05}
          value={(extras.opacity as number) ?? 0.7}
          onChange={(e) =>
            onExtras({ ...extras, opacity: Number(e.target.value) })
          }
          style={inputStyle}
        />
      </Row>
      <Row label="Density mode">
        <select
          value={densityMode}
          onChange={(e) => onExtras({ ...extras, densityMode: e.target.value })}
          style={selectStyle}
        >
          <option value="off">Off — always show points</option>
          <option value="auto">Auto — switch at 1000+ points</option>
          <option value="on">On — always density heatmap</option>
        </select>
      </Row>
      {densityMode !== "off" && (
        <Row label="Density bins">
          <input
            type="number"
            min={10}
            max={200}
            value={(extras.densityBins as number) ?? 50}
            onChange={(e) =>
              onExtras({ ...extras, densityBins: Number(e.target.value) })
            }
            style={inputStyle}
          />
        </Row>
      )}
    </Section>
  );
}

function ExtrasBoxPlot({
  extras,
  onExtras,
}: {
  extras: Record<string, unknown>;
  onExtras: (e: Record<string, unknown>) => void;
}) {
  return (
    <Section title="Box Plot Options">
      <Row label="Orientation">
        <select
          value={(extras.orientation as string) ?? "vertical"}
          onChange={(e) => onExtras({ ...extras, orientation: e.target.value })}
          style={selectStyle}
        >
          <option value="vertical">Vertical</option>
          <option value="horizontal">Horizontal</option>
        </select>
      </Row>
      <Row label="Show mean marker">
        <input
          type="checkbox"
          checked={(extras.showMean as boolean) ?? false}
          onChange={(e) => onExtras({ ...extras, showMean: e.target.checked })}
          style={checkStyle}
        />
      </Row>
      <Row label="Show individual points">
        <input
          type="checkbox"
          checked={(extras.showPoints as boolean) ?? false}
          onChange={(e) =>
            onExtras({ ...extras, showPoints: e.target.checked })
          }
          style={checkStyle}
        />
      </Row>
      <Row label="Notched boxes">
        <input
          type="checkbox"
          checked={(extras.notched as boolean) ?? false}
          onChange={(e) => onExtras({ ...extras, notched: e.target.checked })}
          style={checkStyle}
        />
      </Row>
    </Section>
  );
}

function ExtrasHistogram({
  extras,
  onExtras,
}: {
  extras: Record<string, unknown>;
  onExtras: (e: Record<string, unknown>) => void;
}) {
  const showCapability = (extras.showCapability as boolean) ?? false;
  const displayMode = (extras.displayMode as string) ?? "histogram";
  const isViolin = displayMode === "violin";
  return (
    <Section title="Histogram / Violin Options">
      <Row label="Display mode">
        <select
          value={displayMode}
          onChange={(e) => onExtras({ ...extras, displayMode: e.target.value })}
          style={selectStyle}
        >
          <option value="histogram">Histogram</option>
          <option value="violin">Violin plot</option>
        </select>
      </Row>
      <Row label="Orientation">
        <select
          value={(extras.orientation as string) ?? "vertical"}
          onChange={(e) => onExtras({ ...extras, orientation: e.target.value })}
          style={selectStyle}
        >
          <option value="vertical">Vertical</option>
          <option value="horizontal">Horizontal</option>
        </select>
      </Row>
      {!isViolin && (
        <>
          <Row label="Bins">
            <input
              type="number"
              min={2}
              max={200}
              value={(extras.bins as number) ?? 20}
              onChange={(e) =>
                onExtras({ ...extras, bins: Number(e.target.value) })
              }
              style={inputStyle}
            />
          </Row>
          <Row label="Show normal curve">
            <input
              type="checkbox"
              checked={(extras.showNormal as boolean) ?? false}
              onChange={(e) =>
                onExtras({ ...extras, showNormal: e.target.checked })
              }
              style={checkStyle}
            />
          </Row>
          <Row label="Show cumulative">
            <input
              type="checkbox"
              checked={(extras.showCumulative as boolean) ?? false}
              onChange={(e) =>
                onExtras({ ...extras, showCumulative: e.target.checked })
              }
              style={checkStyle}
            />
          </Row>
          <Row label="Show capability (Cp/Cpk)">
            <input
              type="checkbox"
              checked={showCapability}
              onChange={(e) =>
                onExtras({ ...extras, showCapability: e.target.checked })
              }
              style={checkStyle}
            />
          </Row>
          {showCapability && (
            <>
              <Row label="USL (upper spec limit)">
                <input
                  type="number"
                  placeholder="(none)"
                  value={(extras.usl as number) ?? ""}
                  onChange={(e) =>
                    onExtras({
                      ...extras,
                      usl: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  style={inputStyle}
                />
              </Row>
              <Row label="LSL (lower spec limit)">
                <input
                  type="number"
                  placeholder="(none)"
                  value={(extras.lsl as number) ?? ""}
                  onChange={(e) =>
                    onExtras({
                      ...extras,
                      lsl: e.target.value ? Number(e.target.value) : undefined,
                    })
                  }
                  style={inputStyle}
                />
              </Row>
            </>
          )}
        </>
      )}
    </Section>
  );
}

interface RangeBand {
  value: number;
  color: string;
  label: string;
}

const DEFAULT_RANGES: RangeBand[] = [
  { value: 40, color: "#EF4444", label: "Poor" },
  { value: 70, color: "#F59E0B", label: "OK" },
  { value: 100, color: "#10B981", label: "Good" },
];

function ExtrasBullet({
  extras,
  onExtras,
}: {
  extras: Record<string, unknown>;
  onExtras: (e: Record<string, unknown>) => void;
}) {
  const ranges: RangeBand[] = Array.isArray(extras.ranges)
    ? (extras.ranges as RangeBand[])
    : DEFAULT_RANGES;

  function setRanges(next: RangeBand[]) {
    onExtras({ ...extras, ranges: next });
  }

  return (
    <Section title="Bullet Chart Options">
      <Row label="Orientation">
        <select
          value={(extras.orientation as string) ?? "horizontal"}
          onChange={(e) => onExtras({ ...extras, orientation: e.target.value })}
          style={selectStyle}
        >
          <option value="horizontal">Horizontal (default)</option>
          <option value="vertical">Vertical</option>
        </select>
      </Row>
      <Row label="Target value">
        <input
          type="number"
          placeholder="(none)"
          value={(extras.target as number) ?? ""}
          onChange={(e) =>
            onExtras({
              ...extras,
              target: e.target.value ? Number(e.target.value) : undefined,
            })
          }
          style={inputStyle}
        />
      </Row>
      <div style={{ marginTop: 8 }}>
        <div
          style={{
            fontSize: "0.85em",
            color: "var(--io-text-muted)",
            marginBottom: 6,
          }}
        >
          Range bands (ascending values)
        </div>
        {ranges.map((r, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              gap: 4,
              marginBottom: 4,
              alignItems: "center",
            }}
          >
            <input
              type="number"
              value={r.value}
              onChange={(e) => {
                const next = [...ranges];
                next[i] = { ...next[i], value: Number(e.target.value) };
                setRanges(next);
              }}
              style={{ ...inputStyle, width: 64 }}
              placeholder="Value"
            />
            <input
              type="color"
              value={r.color}
              onChange={(e) => {
                const next = [...ranges];
                next[i] = { ...next[i], color: e.target.value };
                setRanges(next);
              }}
              style={{
                width: 32,
                height: 26,
                border: "1px solid var(--io-input-border)",
                borderRadius: 4,
                cursor: "pointer",
                background: "none",
                padding: 1,
              }}
            />
            <input
              type="text"
              value={r.label}
              onChange={(e) => {
                const next = [...ranges];
                next[i] = { ...next[i], label: e.target.value };
                setRanges(next);
              }}
              style={{ ...inputStyle, flex: 1 }}
              placeholder="Label"
            />
            <button
              onClick={() => setRanges(ranges.filter((_, j) => j !== i))}
              title="Remove range"
              style={{
                background: "none",
                border: "none",
                color: "var(--io-text-muted)",
                cursor: "pointer",
                fontSize: 14,
                lineHeight: 1,
                padding: "0 4px",
              }}
            >
              ×
            </button>
          </div>
        ))}
        <button
          onClick={() =>
            setRanges([...ranges, { value: 0, color: "#6B7280", label: "" }])
          }
          style={{
            fontSize: 11,
            color: "var(--io-text-muted)",
            background: "none",
            border: "1px dashed var(--io-border)",
            borderRadius: 4,
            cursor: "pointer",
            padding: "3px 8px",
            marginTop: 2,
          }}
        >
          + Add range
        </button>
      </div>
    </Section>
  );
}

function ExtrasShewhart({
  extras,
  onExtras,
}: {
  extras: Record<string, unknown>;
  onExtras: (e: Record<string, unknown>) => void;
}) {
  return (
    <Section title="Shewhart (SPC) Options">
      <Row label="Sigma lines">
        <select
          value={(extras.sigmaLines as string) ?? "3"}
          onChange={(e) => onExtras({ ...extras, sigmaLines: e.target.value })}
          style={selectStyle}
        >
          <option value="1">±1σ only</option>
          <option value="2">±1σ and ±2σ</option>
          <option value="3">±1σ, ±2σ, ±3σ</option>
        </select>
      </Row>
      <Row label="Subgroup size (n)">
        <input
          type="number"
          min={1}
          max={25}
          value={(extras.subgroupSize as number) ?? 5}
          onChange={(e) =>
            onExtras({ ...extras, subgroupSize: Number(e.target.value) })
          }
          style={inputStyle}
        />
      </Row>
      <Row label="Chart type">
        <select
          value={(extras.chartSubtype as string) ?? "xbar"}
          onChange={(e) =>
            onExtras({ ...extras, chartSubtype: e.target.value })
          }
          style={selectStyle}
        >
          <option value="xbar">X-bar (mean)</option>
          <option value="r">R (range)</option>
          <option value="individual">Individual (I-MR)</option>
        </select>
      </Row>
    </Section>
  );
}

function ExtrasRegression({
  extras,
  onExtras,
}: {
  extras: Record<string, unknown>;
  onExtras: (e: Record<string, unknown>) => void;
}) {
  return (
    <Section title="Regression Options">
      <Row label="Model type">
        <select
          value={(extras.model as string) ?? "linear"}
          onChange={(e) => onExtras({ ...extras, model: e.target.value })}
          style={selectStyle}
        >
          <option value="linear">Linear</option>
          <option value="polynomial">Polynomial</option>
          <option value="exponential">Exponential</option>
          <option value="logarithmic">Logarithmic</option>
          <option value="power">Power</option>
        </select>
      </Row>
      <Row label="Polynomial degree">
        <input
          type="number"
          min={2}
          max={6}
          value={(extras.degree as number) ?? 2}
          onChange={(e) =>
            onExtras({ ...extras, degree: Number(e.target.value) })
          }
          style={inputStyle}
        />
      </Row>
      <Row label="Show confidence band">
        <input
          type="checkbox"
          checked={(extras.confidence as boolean) ?? true}
          onChange={(e) =>
            onExtras({ ...extras, confidence: e.target.checked })
          }
          style={checkStyle}
        />
      </Row>
    </Section>
  );
}

function ExtrasCusum({
  extras,
  onExtras,
}: {
  extras: Record<string, unknown>;
  onExtras: (e: Record<string, unknown>) => void;
}) {
  return (
    <Section title="CUSUM Options">
      <Row label="Target (μ₀)">
        <input
          type="number"
          placeholder="Process mean"
          value={(extras.target as number) ?? ""}
          onChange={(e) =>
            onExtras({
              ...extras,
              target: e.target.value ? Number(e.target.value) : undefined,
            })
          }
          style={inputStyle}
        />
      </Row>
      <Row
        label="Allowance (k)"
        title="Slack parameter: shifts the reference value by ±k·σ before accumulating. k=0.5 is standard (detects ≥1σ shifts). Lower k = more sensitive, more false alarms."
      >
        <input
          type="number"
          step={0.01}
          value={(extras.k as number) ?? 0.5}
          onChange={(e) => onExtras({ ...extras, k: Number(e.target.value) })}
          style={inputStyle}
        />
      </Row>
      <Row
        label="Control limit (h)"
        title="Decision interval in σ units: signals an out-of-control condition when CUSUM exceeds h·σ. h=4–5 is standard. Higher h = fewer false alarms, slower detection."
      >
        <input
          type="number"
          step={0.1}
          value={(extras.h as number) ?? 4}
          onChange={(e) => onExtras({ ...extras, h: Number(e.target.value) })}
          style={inputStyle}
        />
      </Row>
    </Section>
  );
}

function ExtrasEwma({
  extras,
  onExtras,
}: {
  extras: Record<string, unknown>;
  onExtras: (e: Record<string, unknown>) => void;
}) {
  return (
    <Section title="EWMA Options">
      <Row label="Lambda (λ)">
        <input
          type="number"
          step={0.05}
          min={0.05}
          max={1}
          value={(extras.lambda as number) ?? 0.2}
          onChange={(e) =>
            onExtras({ ...extras, lambda: Number(e.target.value) })
          }
          style={inputStyle}
        />
      </Row>
      <Row label="Control limit (L)">
        <input
          type="number"
          step={0.1}
          value={(extras.l as number) ?? 3}
          onChange={(e) => onExtras({ ...extras, l: Number(e.target.value) })}
          style={inputStyle}
        />
      </Row>
    </Section>
  );
}

function ExtrasProbabilityPlot({
  extras,
  onExtras,
}: {
  extras: Record<string, unknown>;
  onExtras: (e: Record<string, unknown>) => void;
}) {
  return (
    <Section title="Probability Plot Options">
      <Row label="Distribution">
        <select
          value={(extras.distribution as string) ?? "normal"}
          onChange={(e) =>
            onExtras({ ...extras, distribution: e.target.value })
          }
          style={selectStyle}
        >
          <option value="normal">Normal</option>
          <option value="lognormal">Log-normal</option>
          <option value="weibull">Weibull</option>
          <option value="exponential">Exponential</option>
        </select>
      </Row>
    </Section>
  );
}

function ExtrasPareto({
  extras,
  onExtras,
}: {
  extras: Record<string, unknown>;
  onExtras: (e: Record<string, unknown>) => void;
}) {
  const mode = (extras.mode as string) ?? "bad_actors";
  return (
    <Section title="Pareto Options">
      <Row label="Chart mode">
        <select
          value={mode}
          onChange={(e) => onExtras({ ...extras, mode: e.target.value })}
          style={selectStyle}
        >
          <option value="bad_actors">Bad actors (ranked)</option>
          <option value="priority_distribution">Priority distribution</option>
        </select>
      </Row>
      {mode === "bad_actors" && (
        <>
          <Row label="Rank by">
            <select
              value={(extras.rankBy as string) ?? "count"}
              onChange={(e) => onExtras({ ...extras, rankBy: e.target.value })}
              style={selectStyle}
            >
              <option value="count">Annunciation count</option>
              <option value="standing_time">
                Standing time (total active duration)
              </option>
              <option value="rate">Alarm rate (per hour)</option>
            </select>
          </Row>
          <Row label="Show 80% line">
            <input
              type="checkbox"
              checked={(extras.show80Line as boolean) ?? true}
              onChange={(e) =>
                onExtras({ ...extras, show80Line: e.target.checked })
              }
              style={checkStyle}
            />
          </Row>
          <Row label="Max categories">
            <input
              type="number"
              min={3}
              max={30}
              value={(extras.maxCategories as number) ?? 10}
              onChange={(e) =>
                onExtras({ ...extras, maxCategories: Number(e.target.value) })
              }
              style={inputStyle}
            />
          </Row>
        </>
      )}
      <Row label="Orientation">
        <select
          value={(extras.orientation as string) ?? "vertical"}
          onChange={(e) => onExtras({ ...extras, orientation: e.target.value })}
          style={selectStyle}
        >
          <option value="vertical">Vertical</option>
          <option value="horizontal">Horizontal</option>
        </select>
      </Row>
    </Section>
  );
}

function ExtrasWaterfall({
  extras,
  onExtras,
}: {
  extras: Record<string, unknown>;
  onExtras: (e: Record<string, unknown>) => void;
}) {
  return (
    <Section title="Waterfall Options">
      <Row label="Orientation">
        <select
          value={(extras.orientation as string) ?? "vertical"}
          onChange={(e) => onExtras({ ...extras, orientation: e.target.value })}
          style={selectStyle}
        >
          <option value="vertical">Vertical</option>
          <option value="horizontal">Horizontal</option>
        </select>
      </Row>
      <Row label="Show total bar">
        <input
          type="checkbox"
          checked={(extras.showTotal as boolean) ?? true}
          onChange={(e) => onExtras({ ...extras, showTotal: e.target.checked })}
          style={checkStyle}
        />
      </Row>
      <Row label="Positive color">
        <input
          type="color"
          value={(extras.positiveColor as string) ?? "#10B981"}
          onChange={(e) =>
            onExtras({ ...extras, positiveColor: e.target.value })
          }
          style={{ height: 26, cursor: "pointer" }}
        />
      </Row>
      <Row label="Negative color">
        <input
          type="color"
          value={(extras.negativeColor as string) ?? "#EF4444"}
          onChange={(e) =>
            onExtras({ ...extras, negativeColor: e.target.value })
          }
          style={{ height: 26, cursor: "pointer" }}
        />
      </Row>
    </Section>
  );
}

function ExtrasHeatmap({
  extras,
  onExtras,
}: {
  extras: Record<string, unknown>;
  onExtras: (e: Record<string, unknown>) => void;
}) {
  const calendarMode = (extras.calendarMode as boolean) ?? false;
  return (
    <>
      <Section title="Heatmap Options">
        <Row label="Mode">
          <select
            value={calendarMode ? "calendar" : "matrix"}
            onChange={(e) =>
              onExtras({
                ...extras,
                calendarMode: e.target.value === "calendar",
              })
            }
            style={selectStyle}
          >
            <option value="matrix">Matrix (hour × day-of-week)</option>
            <option value="calendar">Calendar (daily, full year)</option>
          </select>
        </Row>
        {calendarMode && (
          <Row label="Year">
            <input
              type="number"
              min={2000}
              max={2100}
              value={
                (extras.calendarYear as number) ?? new Date().getFullYear()
              }
              onChange={(e) =>
                onExtras({ ...extras, calendarYear: Number(e.target.value) })
              }
              style={inputStyle}
            />
          </Row>
        )}
        <Row label="Color scale">
          <select
            value={(extras.colorScale as string) ?? "blue-red"}
            onChange={(e) =>
              onExtras({ ...extras, colorScale: e.target.value })
            }
            style={selectStyle}
          >
            <option value="blue-red">Blue → Yellow → Red</option>
            <option value="green-red">Green → Red</option>
            <option value="viridis">Viridis</option>
            <option value="plasma">Plasma</option>
          </select>
        </Row>
      </Section>
    </>
  );
}

interface BatchDef {
  label: string;
  start: string;
  end: string;
}

function parseBatchList(extras: Record<string, unknown>): BatchDef[] {
  if (!Array.isArray(extras.batches)) return [];
  return (extras.batches as unknown[]).filter(
    (b): b is BatchDef =>
      typeof b === "object" &&
      b !== null &&
      typeof (b as BatchDef).label === "string" &&
      typeof (b as BatchDef).start === "string" &&
      typeof (b as BatchDef).end === "string",
  );
}

function ExtrasBatchComparison({
  extras,
  onExtras,
}: {
  extras: Record<string, unknown>;
  onExtras: (e: Record<string, unknown>) => void;
}) {
  const batches = parseBatchList(extras);

  function updateBatch(idx: number, patch: Partial<BatchDef>) {
    const next = batches.map((b, i) => (i === idx ? { ...b, ...patch } : b));
    onExtras({ ...extras, batches: next });
  }

  function addBatch() {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 3600_000);
    const toLocal = (d: Date) => {
      const pad = (n: number) => n.toString().padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };
    onExtras({
      ...extras,
      batches: [
        ...batches,
        {
          label: `Batch ${batches.length + 1}`,
          start: toLocal(oneHourAgo),
          end: toLocal(now),
        },
      ],
    });
  }

  function removeBatch(idx: number) {
    onExtras({ ...extras, batches: batches.filter((_, i) => i !== idx) });
  }

  return (
    <>
      <Section title="Batches">
        {batches.length === 0 && (
          <div
            style={{
              fontSize: 11,
              color: "var(--io-text-muted)",
              padding: "4px 0",
            }}
          >
            No batches configured. Add at least one to compare.
          </div>
        )}
        {batches.map((b, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
              padding: "6px 0",
              borderBottom: "1px solid var(--io-border)",
            }}
          >
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input
                type="text"
                placeholder="Batch label"
                value={b.label}
                onChange={(e) => updateBatch(i, { label: e.target.value })}
                style={{ ...inputStyle, flex: 1 }}
              />
              <button
                onClick={() => removeBatch(i)}
                title="Remove batch"
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--io-text-muted)",
                  cursor: "pointer",
                  fontSize: 14,
                  lineHeight: 1,
                  padding: "0 4px",
                }}
              >
                ×
              </button>
            </div>
            <input
              type="datetime-local"
              value={b.start}
              onChange={(e) => updateBatch(i, { start: e.target.value })}
              style={inputStyle}
            />
            <input
              type="datetime-local"
              value={b.end}
              onChange={(e) => updateBatch(i, { end: e.target.value })}
              style={inputStyle}
            />
          </div>
        ))}
        <button
          onClick={addBatch}
          style={{
            marginTop: 6,
            height: 26,
            background: "var(--io-accent)",
            border: "none",
            color: "#fff",
            fontSize: 12,
            borderRadius: 4,
            cursor: "pointer",
            width: "100%",
          }}
        >
          + Add Batch
        </button>
      </Section>
      <Section title="Batch Comparison Options">
        <Row label="Time alignment">
          <select
            value={(extras.alignment as string) ?? "absolute"}
            onChange={(e) => onExtras({ ...extras, alignment: e.target.value })}
            style={selectStyle}
          >
            <option value="absolute">Absolute timestamps</option>
            <option value="relative">Relative from batch start</option>
          </select>
        </Row>
        <Row label="Show band">
          <input
            type="checkbox"
            checked={(extras.showBand as boolean) ?? true}
            onChange={(e) =>
              onExtras({ ...extras, showBand: e.target.checked })
            }
            style={checkStyle}
          />
        </Row>
        <Row label="Reference batch label">
          <input
            type="text"
            placeholder="Golden batch"
            value={(extras.refLabel as string) ?? ""}
            onChange={(e) => onExtras({ ...extras, refLabel: e.target.value })}
            style={inputStyle}
          />
        </Row>
        <Row label="First series is reference">
          <input
            type="checkbox"
            checked={(extras.refFirst as boolean) ?? true}
            onChange={(e) =>
              onExtras({ ...extras, refFirst: e.target.checked })
            }
            style={checkStyle}
          />
        </Row>
      </Section>
    </>
  );
}

function ExtrasCorrelationMatrix({
  extras,
  onExtras,
}: {
  extras: Record<string, unknown>;
  onExtras: (e: Record<string, unknown>) => void;
}) {
  return (
    <Section title="Correlation Matrix Options">
      <Row label="Method">
        <select
          value={(extras.method as string) ?? "pearson"}
          onChange={(e) => onExtras({ ...extras, method: e.target.value })}
          style={selectStyle}
        >
          <option value="pearson">Pearson (linear)</option>
          <option value="spearman">Spearman (rank)</option>
        </select>
      </Row>
      <Row label="Show values">
        <input
          type="checkbox"
          checked={(extras.showValues as boolean) ?? true}
          onChange={(e) =>
            onExtras({ ...extras, showValues: e.target.checked })
          }
          style={checkStyle}
        />
      </Row>
      <Row label="Enable clustering">
        <input
          type="checkbox"
          checked={(extras.clustering as boolean) ?? false}
          onChange={(e) =>
            onExtras({ ...extras, clustering: e.target.checked })
          }
          style={checkStyle}
        />
      </Row>
    </Section>
  );
}

const sankeyTextareaStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: "var(--io-input-bg)",
  border: "1px solid var(--io-input-border)",
  color: "var(--io-text-primary)",
  fontSize: "0.82em",
  fontFamily: "monospace",
  padding: "6px 8px",
  borderRadius: 4,
  resize: "vertical",
  outline: "none",
};

function ExtrasSankey({
  extras,
  onExtras,
}: {
  extras: Record<string, unknown>;
  onExtras: (e: Record<string, unknown>) => void;
}) {
  return (
    <Section title="Sankey Options">
      <Row label="Node alignment">
        <select
          value={(extras.nodeAlign as string) ?? "justify"}
          onChange={(e) => onExtras({ ...extras, nodeAlign: e.target.value })}
          style={selectStyle}
        >
          <option value="justify">Justify</option>
          <option value="left">Left</option>
          <option value="right">Right</option>
        </select>
      </Row>
      <div style={{ marginTop: 8 }}>
        <div
          style={{
            fontSize: "0.85em",
            color: "var(--io-text-muted)",
            marginBottom: 4,
          }}
        >
          Nodes — JSON array of <code>{`{name}`}</code>
        </div>
        <textarea
          key={JSON.stringify(extras.nodes)}
          defaultValue={JSON.stringify(extras.nodes ?? [], null, 2)}
          rows={5}
          placeholder={'[{"name":"A"},{"name":"B"}]'}
          style={sankeyTextareaStyle}
          onBlur={(e) => {
            try {
              onExtras({ ...extras, nodes: JSON.parse(e.target.value) });
            } catch {
              /* ignore invalid JSON while editing */
            }
          }}
        />
        <div
          style={{
            fontSize: "0.85em",
            color: "var(--io-text-muted)",
            marginBottom: 4,
            marginTop: 8,
          }}
        >
          Links — JSON array of <code>{`{source,target,value}`}</code>
        </div>
        <textarea
          key={JSON.stringify(extras.links)}
          defaultValue={JSON.stringify(extras.links ?? [], null, 2)}
          rows={5}
          placeholder={'[{"source":"A","target":"B","value":10}]'}
          style={sankeyTextareaStyle}
          onBlur={(e) => {
            try {
              onExtras({ ...extras, links: JSON.parse(e.target.value) });
            } catch {
              /* ignore invalid JSON while editing */
            }
          }}
        />
      </div>
    </Section>
  );
}

function ExtrasTreemap({
  extras,
  onExtras,
}: {
  extras: Record<string, unknown>;
  onExtras: (e: Record<string, unknown>) => void;
}) {
  return (
    <Section title="Treemap Options">
      <Row label="Show labels">
        <input
          type="checkbox"
          checked={(extras.showLabels as boolean) ?? true}
          onChange={(e) =>
            onExtras({ ...extras, showLabels: e.target.checked })
          }
          style={checkStyle}
        />
      </Row>
      <Row label="Drilldown enabled">
        <input
          type="checkbox"
          checked={(extras.drilldown as boolean) ?? false}
          onChange={(e) => onExtras({ ...extras, drilldown: e.target.checked })}
          style={checkStyle}
        />
      </Row>
    </Section>
  );
}

function ExtrasFunnel({
  extras,
  onExtras,
}: {
  extras: Record<string, unknown>;
  onExtras: (e: Record<string, unknown>) => void;
}) {
  return (
    <Section title="Funnel Options">
      <Row label="Orientation">
        <select
          value={(extras.orientation as string) ?? "vertical"}
          onChange={(e) => onExtras({ ...extras, orientation: e.target.value })}
          style={selectStyle}
        >
          <option value="vertical">Vertical (top to bottom)</option>
          <option value="horizontal">Horizontal</option>
        </select>
      </Row>
      <Row label="Show percentages">
        <input
          type="checkbox"
          checked={(extras.showPct as boolean) ?? true}
          onChange={(e) => onExtras({ ...extras, showPct: e.target.checked })}
          style={checkStyle}
        />
      </Row>
    </Section>
  );
}

function ExtrasRadar({
  extras,
  onExtras,
}: {
  extras: Record<string, unknown>;
  onExtras: (e: Record<string, unknown>) => void;
}) {
  return (
    <Section title="Radar Options">
      <Row label="Fill area">
        <input
          type="checkbox"
          checked={(extras.fill as boolean) ?? true}
          onChange={(e) => onExtras({ ...extras, fill: e.target.checked })}
          style={checkStyle}
        />
      </Row>
      <Row label="Shape">
        <select
          value={(extras.shape as string) ?? "polygon"}
          onChange={(e) => onExtras({ ...extras, shape: e.target.value })}
          style={selectStyle}
        >
          <option value="polygon">Polygon</option>
          <option value="circle">Circle</option>
        </select>
      </Row>
      <Row label="Max value per axis">
        <input
          type="number"
          min={1}
          value={(extras.maxValue as number) ?? 100}
          onChange={(e) =>
            onExtras({ ...extras, maxValue: Number(e.target.value) })
          }
          style={inputStyle}
        />
      </Row>
      <Row label="Show axis labels">
        <input
          type="checkbox"
          checked={(extras.showAxisLabels as boolean) ?? true}
          onChange={(e) =>
            onExtras({ ...extras, showAxisLabels: e.target.checked })
          }
          style={checkStyle}
        />
      </Row>
    </Section>
  );
}

function ExtrasSurface3D({
  extras,
  onExtras,
}: {
  extras: Record<string, unknown>;
  onExtras: (e: Record<string, unknown>) => void;
}) {
  return (
    <Section title="3D Surface Options">
      <Row label="Color palette">
        <select
          value={(extras.palette as string) ?? "viridis"}
          onChange={(e) => onExtras({ ...extras, palette: e.target.value })}
          style={selectStyle}
        >
          <option value="viridis">Viridis</option>
          <option value="rainbow">Rainbow</option>
          <option value="hot">Hot</option>
          <option value="jet">Jet</option>
          <option value="blues">Blues</option>
        </select>
      </Row>
      <Row
        label="Grid resolution"
        title="N×N grid cells used to bin the data (higher = smoother surface, more compute)"
      >
        <select
          value={(extras.resolution as number) ?? 20}
          onChange={(e) =>
            onExtras({ ...extras, resolution: Number(e.target.value) })
          }
          style={selectStyle}
        >
          <option value={10}>10×10 (coarse)</option>
          <option value={15}>15×15</option>
          <option value={20}>20×20 (default)</option>
          <option value={30}>30×30</option>
          <option value={40}>40×40 (fine)</option>
          <option value={50}>50×50</option>
        </select>
      </Row>
      <Row label="Wireframe">
        <input
          type="checkbox"
          checked={(extras.wireframe as boolean) ?? false}
          onChange={(e) => onExtras({ ...extras, wireframe: e.target.checked })}
          style={checkStyle}
        />
      </Row>
    </Section>
  );
}

function ExtrasDataTable({
  extras,
  onExtras,
}: {
  extras: Record<string, unknown>;
  onExtras: (e: Record<string, unknown>) => void;
}) {
  const cols = (extras.columns as string[]) ?? [
    "value",
    "quality",
    "timestamp",
    "description",
  ];
  const toggleCol = (col: string) => {
    const next = cols.includes(col)
      ? cols.filter((c) => c !== col)
      : [...cols, col];
    onExtras({ ...extras, columns: next });
  };
  return (
    <Section title="Data Table Options">
      <Row label="Columns to show">
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {(["value", "quality", "timestamp", "description"] as const).map(
            (col) => (
              <label
                key={col}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: "1em",
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={cols.includes(col)}
                  onChange={() => toggleCol(col)}
                  style={checkStyle}
                />
                {col.charAt(0).toUpperCase() + col.slice(1)}
              </label>
            ),
          )}
        </div>
      </Row>
      <Row label="Sort order">
        <select
          value={(extras.sortOrder as string) ?? "newest"}
          onChange={(e) => onExtras({ ...extras, sortOrder: e.target.value })}
          style={selectStyle}
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
      </Row>
      <Row label="Updates">
        <select
          value={(extras.refresh as string) ?? "live"}
          onChange={(e) => onExtras({ ...extras, refresh: e.target.value })}
          style={selectStyle}
        >
          <option value="live">Live updates</option>
          <option value="manual">Manual refresh</option>
        </select>
      </Row>
    </Section>
  );
}

function ExtrasEventTimeline({
  extras,
  onExtras,
}: {
  extras: Record<string, unknown>;
  onExtras: (e: Record<string, unknown>) => void;
}) {
  const priorities = (extras.priorities as string[]) ?? ["HH", "H", "M", "L"];
  const togglePriority = (p: string) => {
    const next = priorities.includes(p)
      ? priorities.filter((x) => x !== p)
      : [...priorities, p];
    onExtras({ ...extras, priorities: next });
  };
  return (
    <Section title="Event Timeline Options">
      <Row label="Priority filter">
        <div style={{ display: "flex", gap: 8 }}>
          {(["HH", "H", "M", "L"] as const).map((p) => (
            <label
              key={p}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: "1em",
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={priorities.includes(p)}
                onChange={() => togglePriority(p)}
                style={checkStyle}
              />
              {p}
            </label>
          ))}
        </div>
      </Row>
      <Row label="Show duration bars">
        <input
          type="checkbox"
          checked={(extras.showDuration as boolean) ?? true}
          onChange={(e) =>
            onExtras({ ...extras, showDuration: e.target.checked })
          }
          style={checkStyle}
        />
      </Row>
    </Section>
  );
}

function ExtrasStackedArea({
  extras,
  onExtras,
}: {
  extras: Record<string, unknown>;
  onExtras: (e: Record<string, unknown>) => void;
}) {
  return (
    <Section title="Stacked Area Options">
      <Row label="Stack series">
        <input
          type="checkbox"
          checked={(extras.stacked as boolean) ?? true}
          onChange={(e) => onExtras({ ...extras, stacked: e.target.checked })}
          style={checkStyle}
        />
      </Row>
    </Section>
  );
}

interface StateMapRow {
  value: string;
  label: string;
  color: string;
}

const DEFAULT_STATE_MAP: StateMapRow[] = [
  { value: "0", label: "Stopped", color: "#4B5563" },
  { value: "1", label: "Running", color: "#10B981" },
  { value: "2", label: "Standby", color: "#F59E0B" },
  { value: "3", label: "Fault", color: "#EF4444" },
  { value: "4", label: "Maintenance", color: "#8B5CF6" },
];

function ExtrasStateTimeline({
  extras,
  onExtras,
}: {
  extras: Record<string, unknown>;
  onExtras: (e: Record<string, unknown>) => void;
}) {
  const stateColors = (extras.stateColors as Record<string, string>) ?? {};
  const stateLabels = (extras.stateLabels as Record<string, string>) ?? {};
  const hasCustom =
    Object.keys(stateColors).length > 0 || Object.keys(stateLabels).length > 0;
  const stateRows: StateMapRow[] = hasCustom
    ? Array.from(
        new Set([...Object.keys(stateColors), ...Object.keys(stateLabels)]),
      ).map((v) => ({
        value: v,
        label: stateLabels[v] ?? v,
        color: stateColors[v] ?? "#6B7280",
      }))
    : DEFAULT_STATE_MAP;

  function setStateRows(next: StateMapRow[]) {
    const colors: Record<string, string> = {};
    const labels: Record<string, string> = {};
    next.forEach((r) => {
      colors[r.value] = r.color;
      labels[r.value] = r.label;
    });
    onExtras({ ...extras, stateColors: colors, stateLabels: labels });
  }

  return (
    <Section title="State Timeline Options">
      <Row label="Row height (px)">
        <input
          type="number"
          min={16}
          max={64}
          value={(extras.rowHeight as number) ?? 28}
          onChange={(e) =>
            onExtras({ ...extras, rowHeight: Number(e.target.value) })
          }
          style={inputStyle}
        />
      </Row>
      <Row label="Show current state">
        <input
          type="checkbox"
          checked={(extras.showCurrentValue as boolean) ?? true}
          onChange={(e) =>
            onExtras({ ...extras, showCurrentValue: e.target.checked })
          }
          style={checkStyle}
        />
      </Row>
      <div style={{ marginTop: 8 }}>
        <div
          style={{
            fontSize: "0.85em",
            color: "var(--io-text-muted)",
            marginBottom: 6,
          }}
        >
          State mappings (value → label / color)
        </div>
        {stateRows.map((r, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              gap: 4,
              marginBottom: 4,
              alignItems: "center",
            }}
          >
            <input
              type="number"
              value={r.value}
              onChange={(e) => {
                const next = [...stateRows];
                next[i] = { ...next[i], value: e.target.value };
                setStateRows(next);
              }}
              style={{ ...inputStyle, width: 44 }}
              placeholder="#"
            />
            <input
              type="text"
              value={r.label}
              onChange={(e) => {
                const next = [...stateRows];
                next[i] = { ...next[i], label: e.target.value };
                setStateRows(next);
              }}
              style={{ ...inputStyle, flex: 1 }}
              placeholder="Label"
            />
            <input
              type="color"
              value={r.color}
              onChange={(e) => {
                const next = [...stateRows];
                next[i] = { ...next[i], color: e.target.value };
                setStateRows(next);
              }}
              style={{
                width: 32,
                height: 26,
                border: "1px solid var(--io-input-border)",
                borderRadius: 4,
                cursor: "pointer",
                background: "none",
                padding: 1,
              }}
            />
            <button
              onClick={() => setStateRows(stateRows.filter((_, j) => j !== i))}
              title="Remove state"
              style={{
                background: "none",
                border: "none",
                color: "var(--io-text-muted)",
                cursor: "pointer",
                fontSize: 14,
                lineHeight: 1,
                padding: "0 4px",
              }}
            >
              ×
            </button>
          </div>
        ))}
        <button
          onClick={() =>
            setStateRows([
              ...stateRows,
              { value: String(stateRows.length), label: "", color: "#6B7280" },
            ])
          }
          style={{
            fontSize: 11,
            color: "var(--io-text-muted)",
            background: "none",
            border: "1px dashed var(--io-border)",
            borderRadius: 4,
            cursor: "pointer",
            padding: "3px 8px",
            marginTop: 2,
          }}
        >
          + Add state
        </button>
      </div>
    </Section>
  );
}

function ExtrasScorecardTable({
  extras,
  onExtras,
}: {
  extras: Record<string, unknown>;
  onExtras: (e: Record<string, unknown>) => void;
}) {
  return (
    <Section title="Scorecard Options">
      <Row label="Table mode">
        <select
          value={(extras.tableMode as string) ?? "scorecard"}
          onChange={(e) => onExtras({ ...extras, tableMode: e.target.value })}
          style={selectStyle}
        >
          <option value="scorecard">Scorecard (time periods)</option>
          <option value="event_stats">Event statistics</option>
        </select>
      </Row>
      <Row label="Aggregate function">
        <select
          value={(extras.aggregateFunction as string) ?? "mean"}
          onChange={(e) =>
            onExtras({ ...extras, aggregateFunction: e.target.value })
          }
          style={selectStyle}
        >
          <option value="mean">Mean</option>
          <option value="last">Last value</option>
          <option value="min">Minimum</option>
          <option value="max">Maximum</option>
          <option value="sum">Sum</option>
          <option value="count">Count</option>
        </select>
      </Row>
      <Row label="Row period">
        <select
          value={(extras.rowPeriod as string) ?? "hour"}
          onChange={(e) => onExtras({ ...extras, rowPeriod: e.target.value })}
          style={selectStyle}
        >
          <option value="hour">Hour</option>
          <option value="shift">Shift (8 h)</option>
          <option value="day">Day</option>
          <option value="week">Week</option>
        </select>
      </Row>
      <Row label="Refresh interval (s)">
        <input
          type="number"
          min={10}
          max={3600}
          value={(extras.refreshSeconds as number) ?? 60}
          onChange={(e) =>
            onExtras({ ...extras, refreshSeconds: Number(e.target.value) })
          }
          style={inputStyle}
        />
      </Row>
    </Section>
  );
}

function ExtrasParallelCoord({
  extras,
  onExtras,
}: {
  extras: Record<string, unknown>;
  onExtras: (e: Record<string, unknown>) => void;
}) {
  return (
    <Section title="Parallel Coordinate Options">
      <Row label="Bucket size">
        <select
          value={(extras.bucketSize as string) ?? "shift"}
          onChange={(e) => onExtras({ ...extras, bucketSize: e.target.value })}
          style={selectStyle}
        >
          <option value="hour">Hour</option>
          <option value="shift">Shift (8 h)</option>
          <option value="day">Day</option>
          <option value="week">Week</option>
        </select>
      </Row>
      <Row label="Color by">
        <select
          value={(extras.colorBy as string) ?? "time"}
          onChange={(e) => onExtras({ ...extras, colorBy: e.target.value })}
          style={selectStyle}
        >
          <option value="time">Time (oldest → newest)</option>
          <option value="none">None (single color)</option>
        </select>
      </Row>
      <Row label="Line opacity">
        <input
          type="number"
          min={0.05}
          max={1}
          step={0.05}
          value={(extras.lineOpacity as number) ?? 0.4}
          onChange={(e) =>
            onExtras({ ...extras, lineOpacity: Number(e.target.value) })
          }
          style={inputStyle}
        />
      </Row>
      <Row label="Highlight outliers">
        <input
          type="checkbox"
          checked={(extras.highlightOutliers as boolean) ?? false}
          onChange={(e) =>
            onExtras({ ...extras, highlightOutliers: e.target.checked })
          }
          style={checkStyle}
        />
      </Row>
    </Section>
  );
}

function ExtrasSubgroupSPC({
  extras,
  onExtras,
}: {
  extras: Record<string, unknown>;
  onExtras: (e: Record<string, unknown>) => void;
}) {
  return (
    <Section title="X-bar/R & X-bar/S Options">
      <Row label="Bottom panel">
        <select
          value={(extras.subchartType as string) ?? "R"}
          onChange={(e) =>
            onExtras({ ...extras, subchartType: e.target.value })
          }
          style={selectStyle}
        >
          <option value="R">R chart — range (for n ≤ 10)</option>
          <option value="S">S chart — std dev (for n &gt; 10)</option>
        </select>
      </Row>
      <Row label="Subgroup size (n)">
        <input
          type="number"
          min={2}
          max={25}
          value={(extras.subgroupSize as number) ?? 5}
          onChange={(e) =>
            onExtras({ ...extras, subgroupSize: Number(e.target.value) })
          }
          style={inputStyle}
        />
      </Row>
      <Row label="Western Electric rules">
        <input
          type="checkbox"
          checked={(extras.showWERules as boolean) ?? true}
          onChange={(e) =>
            onExtras({ ...extras, showWERules: e.target.checked })
          }
          style={checkStyle}
        />
      </Row>
      <Row label="Nelson rules">
        <input
          type="checkbox"
          checked={(extras.showNelsonRules as boolean) ?? false}
          onChange={(e) =>
            onExtras({ ...extras, showNelsonRules: e.target.checked })
          }
          style={checkStyle}
        />
      </Row>
    </Section>
  );
}

function ExtrasAttributeControl({
  extras,
  onExtras,
}: {
  extras: Record<string, unknown>;
  onExtras: (e: Record<string, unknown>) => void;
}) {
  const variant = (extras.chartVariant as string) ?? "p";
  const needsFixed = variant === "np" || variant === "c";
  return (
    <Section title="Attribute Control Chart Options">
      <Row label="Chart variant">
        <select
          value={variant}
          onChange={(e) =>
            onExtras({ ...extras, chartVariant: e.target.value })
          }
          style={selectStyle}
        >
          <option value="p">p-chart — fraction defective (variable n)</option>
          <option value="np">np-chart — count defective (fixed n)</option>
          <option value="c">c-chart — defects per unit (fixed n)</option>
          <option value="u">u-chart — defects per unit (variable n)</option>
        </select>
      </Row>
      {needsFixed && (
        <Row label="Fixed sample size (n)">
          <input
            type="number"
            min={1}
            value={(extras.fixedSampleSize as number) ?? 100}
            onChange={(e) =>
              onExtras({ ...extras, fixedSampleSize: Number(e.target.value) })
            }
            style={inputStyle}
          />
        </Row>
      )}
      <Row label="Western Electric rules">
        <input
          type="checkbox"
          checked={(extras.showWERules as boolean) ?? false}
          onChange={(e) =>
            onExtras({ ...extras, showWERules: e.target.checked })
          }
          style={checkStyle}
        />
      </Row>
    </Section>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ChartOptionsForm({
  chartType,
  config,
  onChange,
}: ChartOptionsFormProps) {
  const extras = (config.extras ?? {}) as Record<string, unknown>;

  function onExtras(e: Record<string, unknown>) {
    onChange({ extras: e });
  }

  function patchLegend(patch: Partial<NonNullable<ChartConfig["legend"]>>) {
    const existing = config.legend;
    // Migrate old format: position='floating' → mode='floating', position='top'
    const baseLegend: NonNullable<ChartConfig["legend"]> = {
      show: true,
      mode: "fixed",
      position: "top",
    };
    if (existing) {
      const rawPos = existing.position as string;
      baseLegend.show = existing.show;
      baseLegend.mode =
        existing.mode ?? (rawPos === "floating" ? "floating" : "fixed");
      baseLegend.position = (
        ["top", "bottom", "left", "right"].includes(rawPos) ? rawPos : "top"
      ) as "top" | "bottom" | "left" | "right";
    }
    onChange({ legend: { ...baseLegend, ...patch } });
  }

  return (
    <div style={{ fontSize: "inherit" }}>
      {/* ── Duration / time window ───────────────────────────────────────── */}
      {CHART_HAS_DURATION.has(chartType) &&
        (() => {
          const chartAggs = CHART_AGGREGATE_TYPES[chartType];
          const validBuckets = getValidBuckets(config.durationMinutes ?? 60);
          return (
            <Section
              title={
                LIVE_CHARTS.has(chartType) ? "Live Window" : "History Window"
              }
            >
              <Row label="Duration">
                <div style={{ display: "flex", gap: 4 }}>
                  <input
                    type="number"
                    min={1}
                    value={config.durationMinutes ?? 60}
                    onChange={(e) =>
                      onChange({ durationMinutes: Number(e.target.value) })
                    }
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <span
                    style={{
                      lineHeight: "26px",
                      color: "var(--io-text-muted)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    minutes
                  </span>
                </div>
              </Row>
              {chartAggs && chartAggs.length > 0 && (
                <>
                  <Row label="Bucket size">
                    <select
                      value={config.aggregateSize ?? ""}
                      onChange={(e) =>
                        onChange({
                          aggregateSize:
                            e.target.value === ""
                              ? undefined
                              : Number(e.target.value),
                        })
                      }
                      style={selectStyle}
                    >
                      <option value="">Auto</option>
                      {validBuckets.map((b) => (
                        <option key={b.seconds} value={b.seconds}>
                          {b.label}
                        </option>
                      ))}
                    </select>
                  </Row>
                  <Row label="Aggregate">
                    <select
                      value={config.aggregateType ?? chartAggs[0]}
                      onChange={(e) =>
                        onChange({
                          aggregateType: e.target.value as AggregateType,
                        })
                      }
                      style={selectStyle}
                    >
                      {chartAggs.map((a) => (
                        <option key={a} value={a}>
                          {AGGREGATE_LABELS[a].full}
                        </option>
                      ))}
                    </select>
                  </Row>
                </>
              )}
            </Section>
          );
        })()}

      {/* ── Interpolation ───────────────────────────────────────────────── */}
      {INTERPOLATION_CHARTS.has(chartType) && (
        <Section title="Line Style">
          <Row label="Interpolation">
            <select
              value={config.interpolation ?? "linear"}
              onChange={(e) =>
                onChange({ interpolation: e.target.value as "linear" | "step" })
              }
              style={selectStyle}
            >
              <option value="linear">Linear (smooth)</option>
              <option value="step">Step (hold last value)</option>
            </select>
          </Row>
        </Section>
      )}

      {/* ── Axis labels ─────────────────────────────────────────────────── */}
      {CHARTS_WITH_AXIS_LABELS.has(chartType) && (
        <Section title="Axis Labels">
          <Row label="X axis">
            <select
              value={config.xAxisLabels ?? "full"}
              onChange={(e) =>
                onChange({
                  xAxisLabels: e.target.value as "full" | "simplified" | "none",
                })
              }
              style={selectStyle}
            >
              <option value="full">Full</option>
              <option value="simplified">Simplified</option>
              <option value="none">None</option>
            </select>
          </Row>
          <Row label="Y axis">
            <select
              value={config.yAxisLabels ?? "full"}
              onChange={(e) =>
                onChange({
                  yAxisLabels: e.target.value as "full" | "simplified" | "none",
                })
              }
              style={selectStyle}
            >
              <option value="full">Full</option>
              <option value="simplified">Simplified</option>
              <option value="none">None</option>
            </select>
          </Row>
        </Section>
      )}

      {/* ── Legend ──────────────────────────────────────────────────────── */}
      {LEGEND_CHARTS.has(chartType) && (
        <Section title="Legend">
          <Row label="Show legend">
            <input
              type="checkbox"
              checked={config.legend?.show ?? true}
              onChange={(e) => patchLegend({ show: e.target.checked })}
              style={checkStyle}
            />
          </Row>
          {config.legend?.show !== false && (
            <>
              <Row label="Style">
                <select
                  value={config.legend?.mode ?? "fixed"}
                  onChange={(e) =>
                    patchLegend({
                      mode: e.target.value as "fixed" | "floating",
                    })
                  }
                  style={selectStyle}
                >
                  <option value="fixed">Fixed</option>
                  <option value="floating">Floating</option>
                </select>
              </Row>
              {(config.legend?.mode ?? "fixed") === "fixed" && (
                <Row label="Position">
                  <select
                    value={config.legend?.position ?? "top"}
                    onChange={(e) =>
                      patchLegend({
                        position: e.target.value as
                          | "top"
                          | "bottom"
                          | "left"
                          | "right",
                      })
                    }
                    style={selectStyle}
                  >
                    <option value="top">Top</option>
                    <option value="bottom">Bottom</option>
                    <option value="left">Left</option>
                    <option value="right">Right</option>
                  </select>
                </Row>
              )}
              <Row label="Label">
                <select
                  value={config.legend?.labelMode ?? "display_name"}
                  onChange={(e) =>
                    patchLegend({
                      labelMode: e.target.value as
                        | "tagname"
                        | "display_name"
                        | "both",
                    })
                  }
                  style={selectStyle}
                >
                  <option value="display_name">Display name</option>
                  <option value="tagname">Tag name</option>
                  <option value="both">Both</option>
                </select>
              </Row>
            </>
          )}
        </Section>
      )}

      {/* ── Per-chart extras ────────────────────────────────────────────── */}
      {chartType === 5 && (
        <ExtrasBarColumn extras={extras} onExtras={onExtras} />
      )}
      {chartType === 6 && (
        <ExtrasPieDonut extras={extras} onExtras={onExtras} />
      )}
      {chartType === 14 && (
        <ExtrasEventTimeline extras={extras} onExtras={onExtras} />
      )}
      {chartType === 15 && (
        <ExtrasDataTable extras={extras} onExtras={onExtras} />
      )}
      {chartType === 7 && <ExtrasKpiCard extras={extras} onExtras={onExtras} />}
      {chartType === 8 && <ExtrasGauge extras={extras} onExtras={onExtras} />}
      {chartType === 10 && (
        <ExtrasAnalogBar extras={extras} onExtras={onExtras} />
      )}
      {chartType === 11 && (
        <ExtrasFillGauge extras={extras} onExtras={onExtras} />
      )}
      {chartType === 13 && (
        <ExtrasScatter extras={extras} onExtras={onExtras} />
      )}
      {chartType === 17 && (
        <ExtrasHeatmap extras={extras} onExtras={onExtras} />
      )}
      {chartType === 18 && <ExtrasPareto extras={extras} onExtras={onExtras} />}
      {chartType === 19 && (
        <ExtrasBoxPlot extras={extras} onExtras={onExtras} />
      )}
      {chartType === 20 && (
        <ExtrasHistogram extras={extras} onExtras={onExtras} />
      )}
      {chartType === 21 && (
        <ExtrasWaterfall extras={extras} onExtras={onExtras} />
      )}
      {chartType === 22 && (
        <ExtrasStackedArea extras={extras} onExtras={onExtras} />
      )}
      {chartType === 23 && <ExtrasBullet extras={extras} onExtras={onExtras} />}
      {chartType === 24 && (
        <ExtrasShewhart extras={extras} onExtras={onExtras} />
      )}
      {chartType === 25 && (
        <ExtrasRegression extras={extras} onExtras={onExtras} />
      )}
      {chartType === 26 && (
        <ExtrasCorrelationMatrix extras={extras} onExtras={onExtras} />
      )}
      {chartType === 27 && <ExtrasSankey extras={extras} onExtras={onExtras} />}
      {chartType === 28 && (
        <ExtrasTreemap extras={extras} onExtras={onExtras} />
      )}
      {chartType === 29 && <ExtrasCusum extras={extras} onExtras={onExtras} />}
      {chartType === 30 && <ExtrasEwma extras={extras} onExtras={onExtras} />}
      {chartType === 31 && (
        <ExtrasProbabilityPlot extras={extras} onExtras={onExtras} />
      )}
      {chartType === 32 && <ExtrasFunnel extras={extras} onExtras={onExtras} />}
      {chartType === 33 && <ExtrasRadar extras={extras} onExtras={onExtras} />}
      {chartType === 34 && (
        <ExtrasSurface3D extras={extras} onExtras={onExtras} />
      )}
      {chartType === 16 && (
        <ExtrasBatchComparison extras={extras} onExtras={onExtras} />
      )}
      {chartType === 35 && (
        <ExtrasStateTimeline extras={extras} onExtras={onExtras} />
      )}
      {chartType === 36 && (
        <ExtrasScorecardTable extras={extras} onExtras={onExtras} />
      )}
      {chartType === 37 && (
        <ExtrasParallelCoord extras={extras} onExtras={onExtras} />
      )}
      {chartType === 38 && (
        <ExtrasSubgroupSPC extras={extras} onExtras={onExtras} />
      )}
      {chartType === 39 && (
        <ExtrasAttributeControl extras={extras} onExtras={onExtras} />
      )}
    </div>
  );
}
