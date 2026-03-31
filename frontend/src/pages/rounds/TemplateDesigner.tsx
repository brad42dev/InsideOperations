import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  roundsApi,
  type Checkpoint,
  type CheckpointValidation,
  type CheckpointBarcodeGate,
  type CheckpointGpsGate,
  type CheckpointCondition,
} from "../../api/rounds";
import PointPicker from "../../shared/components/PointPicker";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type DataType = Checkpoint["data_type"];
type ValidationMode = "none" | "limit" | "alarm";

interface EditableCheckpoint {
  index: number;
  title: string;
  description: string;
  data_type: DataType;
  required: boolean;
  unit: string;
  opc_point_id: string;
  validation_mode: ValidationMode;
  hh: string;
  h: string;
  l: string;
  ll: string;
  min: string;
  max: string;
  options: string[];
  fields: Array<{ name: string; type: string }>;
  photo: string;
  video: string;
  audio: string;
  comments: string;
  // Barcode gate
  barcode_gate_enabled: boolean;
  barcode_expected: string;
  // GPS gate
  gps_gate_enabled: boolean;
  gps_lat: string;
  gps_lng: string;
  gps_radius: string;
  // Conditional visibility
  condition_enabled: boolean;
  condition_depends_on: string; // index as string
  condition_operator: string;
  condition_value: string;
}

function emptyCheckpoint(index: number): EditableCheckpoint {
  return {
    index,
    title: "",
    description: "",
    data_type: "text",
    required: false,
    unit: "",
    opc_point_id: "",
    validation_mode: "none",
    hh: "",
    h: "",
    l: "",
    ll: "",
    min: "",
    max: "",
    options: [""],
    fields: [{ name: "", type: "text" }],
    photo: "none",
    video: "none",
    audio: "none",
    comments: "optional",
    barcode_gate_enabled: false,
    barcode_expected: "",
    gps_gate_enabled: false,
    gps_lat: "",
    gps_lng: "",
    gps_radius: "50",
    condition_enabled: false,
    condition_depends_on: "",
    condition_operator: "eq",
    condition_value: "",
  };
}

function checkpointToApi(cp: EditableCheckpoint): Checkpoint {
  const base: Checkpoint = {
    index: cp.index,
    title: cp.title,
    description: cp.description || undefined,
    data_type: cp.data_type,
    required: cp.required,
    unit: cp.unit || undefined,
    opc_point_id: cp.opc_point_id || undefined,
  };

  if (cp.data_type === "numeric" && cp.validation_mode !== "none") {
    const val: CheckpointValidation = {
      mode: cp.validation_mode as "limit" | "alarm",
    };
    if (cp.hh !== "") val.hh = parseFloat(cp.hh);
    if (cp.h !== "") val.h = parseFloat(cp.h);
    if (cp.l !== "") val.l = parseFloat(cp.l);
    if (cp.ll !== "") val.ll = parseFloat(cp.ll);
    if (cp.min !== "") val.min = parseFloat(cp.min);
    if (cp.max !== "") val.max = parseFloat(cp.max);
    base.validation = val;
  }

  if (cp.data_type === "dropdown") {
    base.options = cp.options.filter((o) => o.trim() !== "");
  }

  if (cp.data_type === "multi_field") {
    base.fields = cp.fields.filter((f) => f.name.trim() !== "");
  }

  const mediaPhoto = cp.photo as
    | "optional"
    | "required"
    | "required_on_alarm"
    | "none";
  const mediaVideo = cp.video as
    | "optional"
    | "required"
    | "required_on_alarm"
    | "none";
  const mediaAudio = cp.audio as
    | "optional"
    | "required"
    | "required_on_alarm"
    | "none";
  const mediaComments = cp.comments as
    | "optional"
    | "required"
    | "required_on_alarm"
    | "none";
  if (
    mediaPhoto !== "none" ||
    mediaVideo !== "none" ||
    mediaAudio !== "none" ||
    mediaComments !== "none"
  ) {
    base.media_requirements = {
      photo: mediaPhoto !== "none" ? mediaPhoto : undefined,
      video: mediaVideo !== "none" ? mediaVideo : undefined,
      audio: mediaAudio !== "none" ? mediaAudio : undefined,
      comments: mediaComments !== "none" ? mediaComments : undefined,
    };
  }

  if (cp.barcode_gate_enabled) {
    const gate: CheckpointBarcodeGate = {};
    if (cp.barcode_expected.trim())
      gate.expected_value = cp.barcode_expected.trim();
    base.barcode_gate = gate;
  }

  if (cp.gps_gate_enabled && cp.gps_lat && cp.gps_lng) {
    const gate: CheckpointGpsGate = {
      lat: parseFloat(cp.gps_lat),
      lng: parseFloat(cp.gps_lng),
      radius_metres: parseFloat(cp.gps_radius) || 50,
    };
    base.gps_gate = gate;
  }

  if (
    cp.condition_enabled &&
    cp.condition_depends_on !== "" &&
    cp.condition_value !== ""
  ) {
    const cond: CheckpointCondition = {
      depends_on_index: parseInt(cp.condition_depends_on, 10),
      operator: cp.condition_operator as CheckpointCondition["operator"],
      value: cp.condition_value,
    };
    base.condition = cond;
  }

  return base;
}

function apiToEditable(cp: Checkpoint): EditableCheckpoint {
  const v = cp.validation;
  return {
    index: cp.index,
    title: cp.title,
    description: cp.description ?? "",
    data_type: cp.data_type,
    required: cp.required,
    unit: cp.unit ?? "",
    opc_point_id: cp.opc_point_id ?? "",
    validation_mode: v ? (v.mode as ValidationMode) : "none",
    hh: v?.hh !== undefined ? String(v.hh) : "",
    h: v?.h !== undefined ? String(v.h) : "",
    l: v?.l !== undefined ? String(v.l) : "",
    ll: v?.ll !== undefined ? String(v.ll) : "",
    min: v?.min !== undefined ? String(v.min) : "",
    max: v?.max !== undefined ? String(v.max) : "",
    options: cp.options?.length ? cp.options : [""],
    fields: cp.fields?.length ? cp.fields : [{ name: "", type: "text" }],
    photo: cp.media_requirements?.photo ?? "none",
    video: cp.media_requirements?.video ?? "none",
    audio: cp.media_requirements?.audio ?? "none",
    comments: cp.media_requirements?.comments ?? "optional",
    barcode_gate_enabled: !!cp.barcode_gate,
    barcode_expected: cp.barcode_gate?.expected_value ?? "",
    gps_gate_enabled: !!cp.gps_gate,
    gps_lat: cp.gps_gate ? String(cp.gps_gate.lat) : "",
    gps_lng: cp.gps_gate ? String(cp.gps_gate.lng) : "",
    gps_radius: cp.gps_gate ? String(cp.gps_gate.radius_metres) : "50",
    condition_enabled: !!cp.condition,
    condition_depends_on: cp.condition
      ? String(cp.condition.depends_on_index)
      : "",
    condition_operator: cp.condition?.operator ?? "eq",
    condition_value: cp.condition?.value ?? "",
  };
}

// ---------------------------------------------------------------------------
// Label/Input helper
// ---------------------------------------------------------------------------

function Field({
  label,
  children,
  required,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <label
        style={{
          fontSize: "12px",
          color: "var(--io-text-secondary)",
          fontWeight: 600,
        }}
      >
        {label}
        {required && (
          <span
            style={{ color: "var(--io-alarm-critical)", marginLeft: "2px" }}
          >
            *
          </span>
        )}
      </label>
      {children}
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "8px 10px",
  background: "var(--io-surface-secondary)",
  border: "1px solid var(--io-border)",
  borderRadius: "6px",
  color: "var(--io-text-primary)",
  fontSize: "13px",
  width: "100%",
  boxSizing: "border-box",
};

// ---------------------------------------------------------------------------
// Checkpoint editor
// ---------------------------------------------------------------------------

function CheckpointEditor({
  cp,
  index,
  total,
  allCheckpoints,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  cp: EditableCheckpoint;
  index: number;
  total: number;
  allCheckpoints: EditableCheckpoint[];
  onChange: (updated: EditableCheckpoint) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const [expanded, setExpanded] = useState(true);

  function set<K extends keyof EditableCheckpoint>(
    key: K,
    value: EditableCheckpoint[K],
  ) {
    onChange({ ...cp, [key]: value });
  }

  return (
    <div
      style={{
        border: "1px solid var(--io-border)",
        borderRadius: "8px",
        overflow: "hidden",
        background: "var(--io-surface)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "10px 14px",
          background: "var(--io-surface-secondary)",
          cursor: "pointer",
        }}
        onClick={() => setExpanded((e) => !e)}
      >
        <span
          style={{
            color: "var(--io-text-muted)",
            fontSize: "12px",
            minWidth: "20px",
          }}
        >
          {index + 1}.
        </span>
        <span
          style={{
            flex: 1,
            fontWeight: 600,
            fontSize: "13px",
            color: "var(--io-text-primary)",
          }}
        >
          {cp.title || (
            <em style={{ fontWeight: 400, color: "var(--io-text-muted)" }}>
              Untitled checkpoint
            </em>
          )}
        </span>
        <span
          style={{
            fontSize: "11px",
            color: "var(--io-text-muted)",
            background: "var(--io-surface)",
            padding: "2px 6px",
            borderRadius: "4px",
          }}
        >
          {cp.data_type}
        </span>
        <div
          style={{ display: "flex", gap: "4px" }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={onMoveUp}
            disabled={index === 0}
            title="Move up"
            style={{
              background: "none",
              border: "none",
              cursor: index === 0 ? "not-allowed" : "pointer",
              color: "var(--io-text-muted)",
              opacity: index === 0 ? 0.3 : 1,
              padding: "2px 6px",
            }}
          >
            ↑
          </button>
          <button
            onClick={onMoveDown}
            disabled={index === total - 1}
            title="Move down"
            style={{
              background: "none",
              border: "none",
              cursor: index === total - 1 ? "not-allowed" : "pointer",
              color: "var(--io-text-muted)",
              opacity: index === total - 1 ? 0.3 : 1,
              padding: "2px 6px",
            }}
          >
            ↓
          </button>
          <button
            onClick={onRemove}
            title="Remove checkpoint"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--io-alarm-critical)",
              padding: "2px 6px",
            }}
          >
            ×
          </button>
        </div>
        <span style={{ color: "var(--io-text-muted)", fontSize: "12px" }}>
          {expanded ? "▲" : "▼"}
        </span>
      </div>

      {/* Body */}
      {expanded && (
        <div
          style={{
            padding: "16px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "12px",
            }}
          >
            <Field label="Title" required>
              <input
                value={cp.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="Checkpoint title"
                style={inputStyle}
              />
            </Field>
            <Field label="Data Type">
              <select
                value={cp.data_type}
                onChange={(e) => set("data_type", e.target.value as DataType)}
                style={inputStyle}
              >
                <option value="text">Text</option>
                <option value="numeric">Numeric</option>
                <option value="boolean">Yes / No</option>
                <option value="dropdown">Dropdown</option>
                <option value="multi_field">Multi-field</option>
              </select>
            </Field>
          </div>

          <Field label="Description">
            <textarea
              value={cp.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Optional description or instructions"
              rows={2}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </Field>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <input
              type="checkbox"
              id={`req-${cp.index}`}
              checked={cp.required}
              onChange={(e) => set("required", e.target.checked)}
              style={{ width: "16px", height: "16px", cursor: "pointer" }}
            />
            <label
              htmlFor={`req-${cp.index}`}
              style={{
                fontSize: "13px",
                color: "var(--io-text-secondary)",
                cursor: "pointer",
              }}
            >
              Required
            </label>
          </div>

          {/* OPC Point binding */}
          <Field label="OPC Point (auto-capture)">
            <div
              style={{
                border: "1px solid var(--io-border)",
                borderRadius: "6px",
                padding: "10px",
                background: "var(--io-surface-secondary)",
              }}
            >
              {cp.opc_point_id ? (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    marginBottom: "8px",
                  }}
                >
                  <span
                    style={{
                      flex: 1,
                      fontSize: "12px",
                      fontFamily: "monospace",
                      color: "var(--io-accent)",
                      background:
                        "var(--io-accent-subtle, rgba(74,158,255,0.1))",
                      padding: "3px 8px",
                      borderRadius: "4px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {cp.opc_point_id}
                  </span>
                  <button
                    onClick={() => set("opc_point_id", "")}
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "var(--io-text-muted)",
                      fontSize: "14px",
                      padding: "2px 6px",
                      flexShrink: 0,
                    }}
                    title="Clear point binding"
                  >
                    ×
                  </button>
                </div>
              ) : (
                <div
                  style={{
                    fontSize: "12px",
                    color: "var(--io-text-muted)",
                    marginBottom: "8px",
                  }}
                >
                  No point bound — select one below to enable automatic value
                  capture.
                </div>
              )}
              <PointPicker
                selected={cp.opc_point_id ? [cp.opc_point_id] : []}
                onChange={(ids) => set("opc_point_id", ids[0] ?? "")}
                singleSelect
              />
            </div>
          </Field>

          {/* Numeric extras */}
          {cp.data_type === "numeric" && (
            <>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "12px",
                }}
              >
                <Field label="Unit">
                  <input
                    value={cp.unit}
                    onChange={(e) => set("unit", e.target.value)}
                    placeholder="PSI, °C, RPM…"
                    style={inputStyle}
                  />
                </Field>
                <Field label="Validation">
                  <select
                    value={cp.validation_mode}
                    onChange={(e) =>
                      set("validation_mode", e.target.value as ValidationMode)
                    }
                    style={inputStyle}
                  >
                    <option value="none">None</option>
                    <option value="limit">Limit (min/max)</option>
                    <option value="alarm">Alarm (HH/H/L/LL)</option>
                  </select>
                </Field>
              </div>

              {cp.validation_mode === "alarm" && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr 1fr 1fr",
                    gap: "8px",
                  }}
                >
                  {(["hh", "h", "l", "ll"] as const).map((key) => (
                    <Field key={key} label={key.toUpperCase()}>
                      <input
                        type="number"
                        value={cp[key]}
                        onChange={(e) => set(key, e.target.value)}
                        style={inputStyle}
                      />
                    </Field>
                  ))}
                </div>
              )}

              {cp.validation_mode === "limit" && (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "8px",
                  }}
                >
                  <Field label="Min">
                    <input
                      type="number"
                      value={cp.min}
                      onChange={(e) => set("min", e.target.value)}
                      style={inputStyle}
                    />
                  </Field>
                  <Field label="Max">
                    <input
                      type="number"
                      value={cp.max}
                      onChange={(e) => set("max", e.target.value)}
                      style={inputStyle}
                    />
                  </Field>
                </div>
              )}
            </>
          )}

          {/* Dropdown options */}
          {cp.data_type === "dropdown" && (
            <Field label="Options">
              <div
                style={{ display: "flex", flexDirection: "column", gap: "6px" }}
              >
                {cp.options.map((opt, i) => (
                  <div key={i} style={{ display: "flex", gap: "6px" }}>
                    <input
                      value={opt}
                      onChange={(e) => {
                        const next = [...cp.options];
                        next[i] = e.target.value;
                        set("options", next);
                      }}
                      placeholder={`Option ${i + 1}`}
                      style={{ ...inputStyle, flex: 1 }}
                    />
                    <button
                      onClick={() =>
                        set(
                          "options",
                          cp.options.filter((_, j) => j !== i),
                        )
                      }
                      disabled={cp.options.length === 1}
                      style={{
                        background: "none",
                        border: "1px solid var(--io-border)",
                        borderRadius: "6px",
                        cursor: "pointer",
                        color: "var(--io-alarm-critical)",
                        padding: "0 10px",
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  onClick={() => set("options", [...cp.options, ""])}
                  style={{
                    alignSelf: "flex-start",
                    background: "none",
                    border: "1px dashed var(--io-border)",
                    borderRadius: "6px",
                    cursor: "pointer",
                    color: "var(--io-text-secondary)",
                    padding: "6px 12px",
                    fontSize: "12px",
                  }}
                >
                  + Add option
                </button>
              </div>
            </Field>
          )}

          {/* Multi-field sub-fields */}
          {cp.data_type === "multi_field" && (
            <Field label="Sub-fields">
              <div
                style={{ display: "flex", flexDirection: "column", gap: "6px" }}
              >
                {cp.fields.map((field, i) => (
                  <div key={i} style={{ display: "flex", gap: "6px" }}>
                    <input
                      value={field.name}
                      onChange={(e) => {
                        const next = [...cp.fields];
                        next[i] = { ...field, name: e.target.value };
                        set("fields", next);
                      }}
                      placeholder="Field name"
                      style={{ ...inputStyle, flex: 2 }}
                    />
                    <select
                      value={field.type}
                      onChange={(e) => {
                        const next = [...cp.fields];
                        next[i] = { ...field, type: e.target.value };
                        set("fields", next);
                      }}
                      style={{ ...inputStyle, flex: 1 }}
                    >
                      <option value="text">Text</option>
                      <option value="numeric">Numeric</option>
                    </select>
                    <button
                      onClick={() =>
                        set(
                          "fields",
                          cp.fields.filter((_, j) => j !== i),
                        )
                      }
                      disabled={cp.fields.length === 1}
                      style={{
                        background: "none",
                        border: "1px solid var(--io-border)",
                        borderRadius: "6px",
                        cursor: "pointer",
                        color: "var(--io-alarm-critical)",
                        padding: "0 10px",
                      }}
                    >
                      ×
                    </button>
                  </div>
                ))}
                <button
                  onClick={() =>
                    set("fields", [...cp.fields, { name: "", type: "text" }])
                  }
                  style={{
                    alignSelf: "flex-start",
                    background: "none",
                    border: "1px dashed var(--io-border)",
                    borderRadius: "6px",
                    cursor: "pointer",
                    color: "var(--io-text-secondary)",
                    padding: "6px 12px",
                    fontSize: "12px",
                  }}
                >
                  + Add sub-field
                </button>
              </div>
            </Field>
          )}

          {/* Media requirements */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "12px",
            }}
          >
            <Field label="Photo requirement">
              <select
                value={cp.photo}
                onChange={(e) => set("photo", e.target.value)}
                style={inputStyle}
              >
                <option value="none">None</option>
                <option value="optional">Optional</option>
                <option value="required">Required</option>
                <option value="required_on_alarm">Required on alarm</option>
              </select>
            </Field>
            <Field label="Video requirement">
              <select
                value={cp.video}
                onChange={(e) => set("video", e.target.value)}
                style={inputStyle}
              >
                <option value="none">None</option>
                <option value="optional">Optional</option>
                <option value="required">Required</option>
                <option value="required_on_alarm">Required on alarm</option>
              </select>
            </Field>
            <Field label="Audio requirement">
              <select
                value={cp.audio}
                onChange={(e) => set("audio", e.target.value)}
                style={inputStyle}
              >
                <option value="none">None</option>
                <option value="optional">Optional</option>
                <option value="required">Required</option>
                <option value="required_on_alarm">Required on alarm</option>
              </select>
            </Field>
            <Field label="Comments requirement">
              <select
                value={cp.comments}
                onChange={(e) => set("comments", e.target.value)}
                style={inputStyle}
              >
                <option value="none">None</option>
                <option value="optional">Optional</option>
                <option value="required">Required</option>
                <option value="required_on_alarm">Required on alarm</option>
              </select>
            </Field>
          </div>

          {/* Barcode gate */}
          <div
            style={{
              borderTop: "1px solid var(--io-border)",
              paddingTop: "12px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "8px",
              }}
            >
              <input
                type="checkbox"
                id={`barcode-${cp.index}`}
                checked={cp.barcode_gate_enabled}
                onChange={(e) => set("barcode_gate_enabled", e.target.checked)}
                style={{ width: "16px", height: "16px", cursor: "pointer" }}
              />
              <label
                htmlFor={`barcode-${cp.index}`}
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "var(--io-text-secondary)",
                  cursor: "pointer",
                }}
              >
                Barcode gate
              </label>
              <span style={{ fontSize: "11px", color: "var(--io-text-muted)" }}>
                — operator must scan a barcode before entering data
              </span>
            </div>
            {cp.barcode_gate_enabled && (
              <Field label="Expected barcode value (leave blank to accept any scan)">
                <input
                  value={cp.barcode_expected}
                  onChange={(e) => set("barcode_expected", e.target.value)}
                  placeholder="e.g. PUMP-101-A"
                  style={inputStyle}
                />
              </Field>
            )}
          </div>

          {/* GPS gate */}
          <div
            style={{
              borderTop: "1px solid var(--io-border)",
              paddingTop: "12px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "8px",
              }}
            >
              <input
                type="checkbox"
                id={`gps-${cp.index}`}
                checked={cp.gps_gate_enabled}
                onChange={(e) => set("gps_gate_enabled", e.target.checked)}
                style={{ width: "16px", height: "16px", cursor: "pointer" }}
              />
              <label
                htmlFor={`gps-${cp.index}`}
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "var(--io-text-secondary)",
                  cursor: "pointer",
                }}
              >
                GPS gate
              </label>
              <span style={{ fontSize: "11px", color: "var(--io-text-muted)" }}>
                — operator must be at the configured location
              </span>
            </div>
            {cp.gps_gate_enabled && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr 1fr",
                  gap: "8px",
                }}
              >
                <Field label="Latitude">
                  <input
                    type="number"
                    value={cp.gps_lat}
                    onChange={(e) => set("gps_lat", e.target.value)}
                    placeholder="e.g. 51.5074"
                    step="any"
                    style={inputStyle}
                  />
                </Field>
                <Field label="Longitude">
                  <input
                    type="number"
                    value={cp.gps_lng}
                    onChange={(e) => set("gps_lng", e.target.value)}
                    placeholder="e.g. -0.1278"
                    step="any"
                    style={inputStyle}
                  />
                </Field>
                <Field label="Radius (metres)">
                  <input
                    type="number"
                    value={cp.gps_radius}
                    onChange={(e) => set("gps_radius", e.target.value)}
                    min={1}
                    max={10000}
                    style={inputStyle}
                  />
                </Field>
              </div>
            )}
          </div>

          {/* Conditional visibility — not available on the first checkpoint (index 0) */}
          {index > 0 && (
            <div
              style={{
                borderTop: "1px solid var(--io-border)",
                paddingTop: "12px",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "8px",
                }}
              >
                <input
                  type="checkbox"
                  id={`cond-${cp.index}`}
                  checked={cp.condition_enabled}
                  onChange={(e) => set("condition_enabled", e.target.checked)}
                  style={{ width: "16px", height: "16px", cursor: "pointer" }}
                />
                <label
                  htmlFor={`cond-${cp.index}`}
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "var(--io-text-secondary)",
                    cursor: "pointer",
                  }}
                >
                  Conditional
                </label>
                <span
                  style={{ fontSize: "11px", color: "var(--io-text-muted)" }}
                >
                  — show this checkpoint only when a condition is met
                </span>
              </div>
              {cp.condition_enabled && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    flexWrap: "wrap",
                  }}
                >
                  <span
                    style={{
                      fontSize: "13px",
                      color: "var(--io-text-secondary)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Show only if
                  </span>
                  <select
                    value={cp.condition_depends_on}
                    onChange={(e) =>
                      set("condition_depends_on", e.target.value)
                    }
                    style={{
                      ...inputStyle,
                      width: "auto",
                      flex: 2,
                      minWidth: "120px",
                    }}
                  >
                    <option value="">Select checkpoint…</option>
                    {allCheckpoints.slice(0, index).map((prev, pi) => (
                      <option key={pi} value={String(pi)}>
                        {pi + 1}. {prev.title || `Checkpoint ${pi + 1}`}
                      </option>
                    ))}
                  </select>
                  <select
                    value={cp.condition_operator}
                    onChange={(e) => set("condition_operator", e.target.value)}
                    style={{
                      ...inputStyle,
                      width: "auto",
                      flex: 1,
                      minWidth: "90px",
                    }}
                  >
                    <option value="eq">= (equals)</option>
                    <option value="ne">≠ (not equals)</option>
                    <option value="gt">&gt; (greater than)</option>
                    <option value="lt">&lt; (less than)</option>
                    <option value="gte">≥ (at least)</option>
                    <option value="lte">≤ (at most)</option>
                    <option value="contains">contains</option>
                  </select>
                  <input
                    value={cp.condition_value}
                    onChange={(e) => set("condition_value", e.target.value)}
                    placeholder="Value…"
                    style={{ ...inputStyle, flex: 2, minWidth: "80px" }}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function TemplateDesigner() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = id === "new";

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [checkpoints, setCheckpoints] = useState<EditableCheckpoint[]>([
    emptyCheckpoint(0),
  ]);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { data: tmplResult } = useQuery({
    queryKey: ["rounds", "template", id],
    queryFn: () => roundsApi.getTemplate(id!),
    enabled: !isNew && !!id,
  });

  // Populate form when editing existing template
  useEffect(() => {
    if (!tmplResult?.success) return;
    const t = tmplResult.data;
    setName(t.name);
    setDescription(t.description ?? "");
    const cps = Array.isArray(t.checkpoints) ? t.checkpoints : [];
    setCheckpoints(cps.length ? cps.map(apiToEditable) : [emptyCheckpoint(0)]);
  }, [tmplResult]);

  const saveMutation = useMutation({
    mutationFn: (payload: {
      name: string;
      description?: string;
      checkpoints: Checkpoint[];
    }) =>
      isNew
        ? roundsApi.createTemplate(payload)
        : roundsApi.updateTemplate(id!, payload),
    onSuccess: (result) => {
      if (!result.success) {
        setSaveError(result.error.message);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["rounds", "templates"] });
      navigate("/rounds");
    },
    onError: (err: Error) => setSaveError(err.message),
  });

  function handleSave() {
    setSaveError(null);

    if (!name.trim()) {
      setSaveError("Template name is required.");
      return;
    }

    // Re-index checkpoints
    const apiCheckpoints: Checkpoint[] = checkpoints.map((cp, i) =>
      checkpointToApi({ ...cp, index: i }),
    );

    saveMutation.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
      checkpoints: apiCheckpoints,
    });
  }

  function addCheckpoint() {
    setCheckpoints((prev) => [...prev, emptyCheckpoint(prev.length)]);
  }

  function removeCheckpoint(i: number) {
    setCheckpoints((prev) => prev.filter((_, j) => j !== i));
  }

  function moveCheckpoint(i: number, dir: -1 | 1) {
    setCheckpoints((prev) => {
      const next = [...prev];
      const swap = i + dir;
      if (swap < 0 || swap >= next.length) return prev;
      [next[i], next[swap]] = [next[swap], next[i]];
      return next;
    });
  }

  function updateCheckpoint(i: number, updated: EditableCheckpoint) {
    setCheckpoints((prev) => prev.map((cp, j) => (j === i ? updated : cp)));
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px 24px",
          borderBottom: "1px solid var(--io-border)",
          background: "var(--io-surface)",
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          gap: "16px",
        }}
      >
        <button
          onClick={() => navigate("/rounds")}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            color: "var(--io-text-secondary)",
            fontSize: "18px",
            padding: "4px",
          }}
        >
          ←
        </button>
        <h1
          style={{
            margin: 0,
            fontSize: "18px",
            fontWeight: 700,
            color: "var(--io-text-primary)",
            flex: 1,
          }}
        >
          {isNew ? "New Template" : "Edit Template"}
        </h1>
        <button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          style={{
            padding: "8px 20px",
            background: "var(--io-accent, #4A9EFF)",
            color: "var(--io-accent-foreground)",
            border: "none",
            borderRadius: "6px",
            cursor: saveMutation.isPending ? "not-allowed" : "pointer",
            fontSize: "13px",
            fontWeight: 600,
            opacity: saveMutation.isPending ? 0.7 : 1,
          }}
        >
          {saveMutation.isPending ? "Saving…" : "Save Template"}
        </button>
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
        }}
      >
        {/* Template meta */}
        <div
          style={{
            background: "var(--io-surface)",
            border: "1px solid var(--io-border)",
            borderRadius: "8px",
            padding: "20px",
            display: "flex",
            flexDirection: "column",
            gap: "14px",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: "14px",
              fontWeight: 700,
              color: "var(--io-text-primary)",
            }}
          >
            Template Details
          </h2>
          <Field label="Name" required>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Daily Pump Inspection"
              style={inputStyle}
            />
          </Field>
          <Field label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description for operators"
              rows={2}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </Field>
        </div>

        {/* Error */}
        {saveError && (
          <div
            style={{
              padding: "10px 14px",
              background: "rgba(239,68,68,0.1)",
              border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: "6px",
              color: "var(--io-alarm-critical)",
              fontSize: "13px",
            }}
          >
            {saveError}
          </div>
        )}

        {/* Checkpoints */}
        <div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "12px",
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: "14px",
                fontWeight: 700,
                color: "var(--io-text-primary)",
              }}
            >
              Checkpoints ({checkpoints.length})
            </h2>
            <button
              onClick={addCheckpoint}
              style={{
                padding: "6px 14px",
                background: "none",
                border: "1px solid var(--io-border)",
                borderRadius: "6px",
                cursor: "pointer",
                color: "var(--io-text-secondary)",
                fontSize: "12px",
                fontWeight: 600,
              }}
            >
              + Add Checkpoint
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {checkpoints.map((cp, i) => (
              <CheckpointEditor
                key={i}
                cp={cp}
                index={i}
                total={checkpoints.length}
                allCheckpoints={checkpoints}
                onChange={(updated) => updateCheckpoint(i, updated)}
                onRemove={() => removeCheckpoint(i)}
                onMoveUp={() => moveCheckpoint(i, -1)}
                onMoveDown={() => moveCheckpoint(i, 1)}
              />
            ))}
          </div>

          {checkpoints.length === 0 && (
            <div
              style={{
                textAlign: "center",
                padding: "32px",
                color: "var(--io-text-muted)",
                fontSize: "13px",
              }}
            >
              No checkpoints. Add one to get started.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
