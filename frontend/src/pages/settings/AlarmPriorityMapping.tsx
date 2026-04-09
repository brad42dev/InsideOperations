import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  alarmPriorityMappingApi,
  AlarmPriorityMapping as MappingType,
  PriorityRange,
} from "../../api/points";
import SettingsPageLayout from "./SettingsPageLayout";
import {
  inputStyle,
  labelStyle,
  btnPrimary,
  btnSecondary,
} from "./settingsStyles";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PRIORITY_OPTIONS = [
  "urgent",
  "high",
  "medium",
  "low",
  "diagnostic",
] as const;

const DEFAULT_RANGES: PriorityRange[] = [
  { from: 800, to: 1000, priority: "urgent" },
  { from: 600, to: 799, priority: "high" },
  { from: 400, to: 599, priority: "medium" },
  { from: 1, to: 399, priority: "low" },
];

const RANGE_LABELS: Record<string, string> = {
  urgent: "Urgent (HH/LL)",
  high: "High (H/L)",
  medium: "Medium (Equipment)",
  low: "Low (Meta-events)",
};

// ---------------------------------------------------------------------------
// Shared table styles
// ---------------------------------------------------------------------------

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "6px 8px",
  fontSize: "12px",
  fontWeight: 600,
  color: "var(--io-text-muted)",
  borderBottom: "1px solid var(--io-border)",
};

const tdStyle: React.CSSProperties = {
  padding: "6px 8px",
  borderBottom: "1px solid var(--io-border-subtle)",
};

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function RangeModeEditor({
  ranges,
  onChange,
}: {
  ranges: PriorityRange[];
  onChange: (r: PriorityRange[]) => void;
}) {
  const update = (idx: number, field: "from" | "to", val: string) => {
    const n = parseInt(val, 10);
    if (isNaN(n)) return;
    onChange(ranges.map((r, i) => (i === idx ? { ...r, [field]: n } : r)));
  };

  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr>
          <th style={thStyle}>Priority</th>
          <th style={thStyle}>From (OPC Severity)</th>
          <th style={thStyle}>To (OPC Severity)</th>
        </tr>
      </thead>
      <tbody>
        {ranges.map((r, i) => (
          <tr key={i}>
            <td style={tdStyle}>
              <span
                style={{ fontWeight: 500, color: "var(--io-text-primary)" }}
              >
                {RANGE_LABELS[r.priority] ?? r.priority}
              </span>
            </td>
            <td style={tdStyle}>
              <input
                type="number"
                min={0}
                max={1000}
                value={r.from}
                onChange={(e) => update(i, "from", e.target.value)}
                style={{ ...inputStyle, width: "90px" }}
              />
            </td>
            <td style={tdStyle}>
              <input
                type="number"
                min={0}
                max={1000}
                value={r.to}
                onChange={(e) => update(i, "to", e.target.value)}
                style={{ ...inputStyle, width: "90px" }}
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function DiscreteModeEditor({
  discrete,
  onChange,
}: {
  discrete: Record<string, string>;
  onChange: (d: Record<string, string>) => void;
}) {
  const entries = Object.entries(discrete);

  const updateKey = (oldKey: string, newKey: string) => {
    const next: Record<string, string> = {};
    for (const [k, v] of Object.entries(discrete)) {
      next[k === oldKey ? newKey : k] = v;
    }
    onChange(next);
  };

  const updateVal = (key: string, val: string) => {
    onChange({ ...discrete, [key]: val });
  };

  const remove = (key: string) => {
    const next = { ...discrete };
    delete next[key];
    onChange(next);
  };

  const add = () => {
    const existing = Object.keys(discrete)
      .map(Number)
      .filter((n) => !isNaN(n));
    const newKey = String(
      existing.length > 0 ? Math.max(...existing) + 100 : 500,
    );
    onChange({ ...discrete, [newKey]: "high" });
  };

  return (
    <div>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          marginBottom: "8px",
        }}
      >
        <thead>
          <tr>
            <th style={thStyle}>OPC Severity</th>
            <th style={thStyle}>Priority</th>
            <th style={{ ...thStyle, width: "40px" }}></th>
          </tr>
        </thead>
        <tbody>
          {entries.map(([k, v]) => (
            <tr key={k}>
              <td style={tdStyle}>
                <input
                  type="number"
                  min={0}
                  max={1000}
                  value={k}
                  onChange={(e) => updateKey(k, e.target.value)}
                  style={{ ...inputStyle, width: "90px" }}
                />
              </td>
              <td style={tdStyle}>
                <select
                  value={v}
                  onChange={(e) => updateVal(k, e.target.value)}
                  style={{ ...inputStyle, width: "120px" }}
                >
                  {PRIORITY_OPTIONS.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </td>
              <td style={tdStyle}>
                <button
                  onClick={() => remove(k)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "var(--io-text-muted)",
                    fontSize: "16px",
                    lineHeight: 1,
                    padding: "2px 4px",
                  }}
                  aria-label="Remove"
                >
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button style={btnSecondary} onClick={add}>
        + Add mapping
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface Props {
  /** OPC source UUID — from route params or parent component. */
  sourceId: string | null;
}

export default function AlarmPriorityMappingPage({ sourceId }: Props) {
  const qc = useQueryClient();

  const { data: serverMapping, isLoading } = useQuery({
    queryKey: ["alarm-priority-mapping", sourceId],
    queryFn: async () => {
      const result = await alarmPriorityMappingApi.get(sourceId!);
      if (!result.success) return null;
      return result.data;
    },
    enabled: !!sourceId,
  });

  const [mode, setMode] = useState<"range" | "discrete" | "custom_property">(
    "range",
  );
  const [ranges, setRanges] = useState<PriorityRange[]>(DEFAULT_RANGES);
  const [discrete, setDiscrete] = useState<Record<string, string>>({});
  const [customProperty, setCustomProperty] = useState("");
  const [dirty, setDirty] = useState(false);

  // Sync server mapping into local draft state.
  useEffect(() => {
    const m = serverMapping ?? null;
    if (!m) {
      setMode("range");
      setRanges(DEFAULT_RANGES);
      setDiscrete({});
      setCustomProperty("");
    } else if (m.mode === "range") {
      setMode("range");
      setRanges(m.ranges);
    } else if (m.mode === "discrete") {
      setMode("discrete");
      setDiscrete(m.discrete);
    } else if (m.mode === "custom_property") {
      setMode("custom_property");
      setCustomProperty(m.customProperty);
    }
    setDirty(false);
  }, [serverMapping]);

  const mutation = useMutation({
    mutationFn: (mapping: MappingType | null) =>
      alarmPriorityMappingApi.put(sourceId!, mapping),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["alarm-priority-mapping", sourceId] });
      setDirty(false);
    },
  });

  const handleSave = () => {
    let mapping: MappingType | null = null;
    if (mode === "range") {
      mapping = { mode: "range", ranges };
    } else if (mode === "discrete") {
      mapping = { mode: "discrete", discrete };
    } else {
      mapping = { mode: "custom_property", customProperty };
    }
    mutation.mutate(mapping);
  };

  const handleReset = () => {
    mutation.mutate(null);
  };

  if (!sourceId) {
    return (
      <SettingsPageLayout
        title="Alarm Priority Mapping"
        description="Map OPC UA alarm severity values to I/O alarm priority levels."
      >
        <p style={{ color: "var(--io-text-muted)", fontSize: "13px" }}>
          Select an OPC source first to configure its alarm priority mapping.
        </p>
      </SettingsPageLayout>
    );
  }

  return (
    <SettingsPageLayout
      title="Alarm Priority Mapping"
      description="Override how OPC UA alarm severity values (1–1000) map to I/O priority levels. Clearing the mapping restores ISA-18.2 defaults."
      action={
        <div style={{ display: "flex", gap: "8px" }}>
          <button
            style={btnSecondary}
            onClick={handleReset}
            disabled={mutation.isPending}
            title="Clear mapping and restore ISA-18.2 defaults"
          >
            Reset to defaults
          </button>
          <button
            style={btnPrimary}
            onClick={handleSave}
            disabled={!dirty || mutation.isPending}
          >
            {mutation.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      }
    >
      {isLoading ? (
        <p style={{ color: "var(--io-text-muted)", fontSize: "13px" }}>
          Loading…
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {/* Mode selector */}
          <div>
            <label
              style={{ ...labelStyle, display: "block", marginBottom: "8px" }}
            >
              Mapping mode
            </label>
            <div style={{ display: "flex", gap: "24px" }}>
              {(["range", "discrete", "custom_property"] as const).map((m) => (
                <label
                  key={m}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    cursor: "pointer",
                    fontSize: "13px",
                    color: "var(--io-text-primary)",
                  }}
                >
                  <input
                    type="radio"
                    name="mapping-mode"
                    value={m}
                    checked={mode === m}
                    onChange={() => {
                      setMode(m);
                      setDirty(true);
                    }}
                  />
                  {m === "range"
                    ? "Range"
                    : m === "discrete"
                      ? "Discrete"
                      : "Custom Property"}
                </label>
              ))}
            </div>
          </div>

          {/* Mode-specific editor */}
          {mode === "range" && (
            <div>
              <p
                style={{
                  margin: "0 0 12px",
                  fontSize: "13px",
                  color: "var(--io-text-muted)",
                }}
              >
                Map OPC severity ranges to priority levels. First matching range
                wins.
              </p>
              <RangeModeEditor
                ranges={ranges}
                onChange={(r) => {
                  setRanges(r);
                  setDirty(true);
                }}
              />
            </div>
          )}

          {mode === "discrete" && (
            <div>
              <p
                style={{
                  margin: "0 0 12px",
                  fontSize: "13px",
                  color: "var(--io-text-muted)",
                }}
              >
                Map exact OPC severity values to priority. Falls back to
                ISA-18.2 defaults for unmatched values.
              </p>
              <DiscreteModeEditor
                discrete={discrete}
                onChange={(d) => {
                  setDiscrete(d);
                  setDirty(true);
                }}
              />
            </div>
          )}

          {mode === "custom_property" && (
            <div>
              <p
                style={{
                  margin: "0 0 12px",
                  fontSize: "13px",
                  color: "var(--io-text-muted)",
                }}
              >
                Read priority from a named OPC alarm event property. Falls back
                to ISA-18.2 defaults when the property is absent.
              </p>
              <label
                style={{ ...labelStyle, display: "block", marginBottom: "6px" }}
              >
                Property name
              </label>
              <input
                type="text"
                value={customProperty}
                onChange={(e) => {
                  setCustomProperty(e.target.value);
                  setDirty(true);
                }}
                placeholder="e.g. io:Priority"
                style={{ ...inputStyle, width: "320px" }}
              />
              <p
                style={{
                  margin: "8px 0 0",
                  fontSize: "12px",
                  color: "var(--io-text-muted)",
                }}
              >
                The OPC alarm event property whose value matches an I/O priority
                name (urgent, high, medium, low, diagnostic).
              </p>
            </div>
          )}

          {mutation.isError && (
            <p
              style={{ color: "var(--io-error)", fontSize: "13px", margin: 0 }}
            >
              Failed to save: {String(mutation.error)}
            </p>
          )}
        </div>
      )}
    </SettingsPageLayout>
  );
}
