import { useState, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ConfirmDialog } from "../../shared/components/ConfirmDialog";
import {
  bulkUpdateApi,
  snapshotsApi,
  TARGET_TYPE_LABELS,
  type TargetType,
  type DiffPreview,
  type ApplySummary,
  type Snapshot,
  type SnapshotDetail,
  type ModifiedRow,
  type ColumnMapping,
  type FailedRow,
} from "../../api/bulkUpdate";
import { showToast } from "../../shared/components/Toast";
import { RestorePreviewModal } from "./RestorePreviewModal";
import SettingsPageLayout from "./SettingsPageLayout";

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------

const CARD: React.CSSProperties = {
  background: "var(--io-surface-secondary)",
  border: "1px solid var(--io-border)",
  borderRadius: "8px",
  padding: "var(--io-space-5)",
  marginBottom: "var(--io-space-4)",
};

const BTN_PRIMARY: React.CSSProperties = {
  padding: "6px 16px",
  borderRadius: "6px",
  border: "none",
  background: "var(--io-accent)",
  color: "var(--io-text-on-accent)",
  fontWeight: 600,
  fontSize: "13px",
  cursor: "pointer",
};

const BTN_SECONDARY: React.CSSProperties = {
  padding: "6px 16px",
  borderRadius: "6px",
  border: "1px solid var(--io-border)",
  background: "var(--io-surface-sunken)",
  color: "var(--io-text-primary)",
  fontWeight: 500,
  fontSize: "13px",
  cursor: "pointer",
};

const BTN_DANGER: React.CSSProperties = {
  ...BTN_SECONDARY,
  color: "var(--io-danger)",
  borderColor: "var(--io-danger)",
};

const SELECT: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: "6px",
  border: "1px solid var(--io-border)",
  background: "var(--io-surface-sunken)",
  color: "var(--io-text-primary)",
  fontSize: "13px",
  cursor: "pointer",
  minWidth: "200px",
};

const INPUT: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: "6px",
  border: "1px solid var(--io-border)",
  background: "var(--io-surface-sunken)",
  color: "var(--io-text-primary)",
  fontSize: "13px",
  width: "280px",
};

const TABLE: React.CSSProperties = {
  width: "100%",
  borderCollapse: "collapse" as const,
  fontSize: "12px",
};

const TH: React.CSSProperties = {
  textAlign: "left" as const,
  padding: "6px 10px",
  borderBottom: "1px solid var(--io-border)",
  color: "var(--io-text-muted)",
  fontWeight: 600,
  background: "var(--io-surface-sunken)",
};

const TD: React.CSSProperties = {
  padding: "6px 10px",
  borderBottom: "1px solid var(--io-border)",
  color: "var(--io-text-primary)",
  verticalAlign: "top" as const,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function Badge({
  children,
  color,
}: {
  children: React.ReactNode;
  color: "success" | "warning" | "danger" | "accent" | "muted";
}) {
  const colors = {
    success: { bg: "var(--io-success-subtle)", fg: "var(--io-success)" },
    warning: { bg: "var(--io-warning-subtle)", fg: "var(--io-warning)" },
    danger: { bg: "var(--io-danger-subtle)", fg: "var(--io-danger)" },
    accent: { bg: "var(--io-accent-subtle)", fg: "var(--io-accent)" },
    muted: { bg: "var(--io-surface-sunken)", fg: "var(--io-text-muted)" },
  };
  const c = colors[color];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: "999px",
        fontSize: "11px",
        fontWeight: 600,
        background: c.bg,
        color: c.fg,
      }}
    >
      {children}
    </span>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3
      style={{
        margin: "0 0 var(--io-space-3)",
        fontSize: "13px",
        fontWeight: 600,
        color: "var(--io-text-secondary)",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
      }}
    >
      {children}
    </h3>
  );
}

// ---------------------------------------------------------------------------
// Tab: Bulk Update
// ---------------------------------------------------------------------------

function DiffSection({
  title,
  color,
  rows,
}: {
  title: string;
  color: "success" | "warning" | "danger";
  rows: Record<string, unknown>[];
}) {
  if (rows.length === 0) return null;
  const keys = Object.keys(rows[0]);
  return (
    <div style={{ marginBottom: "var(--io-space-4)" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--io-space-2)",
          marginBottom: "var(--io-space-2)",
        }}
      >
        <Badge color={color}>{title}</Badge>
        <span style={{ color: "var(--io-text-muted)", fontSize: "12px" }}>
          {rows.length} row{rows.length !== 1 ? "s" : ""}
        </span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={TABLE}>
          <thead>
            <tr>
              {keys.map((k) => (
                <th key={k} style={TH}>
                  {k}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {keys.map((k) => (
                  <td key={k} style={TD}>
                    {String(row[k] ?? "")}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ModifiedSection({ rows }: { rows: ModifiedRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div style={{ marginBottom: "var(--io-space-4)" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--io-space-2)",
          marginBottom: "var(--io-space-2)",
        }}
      >
        <Badge color="warning">Modified</Badge>
        <span style={{ color: "var(--io-text-muted)", fontSize: "12px" }}>
          {rows.length} row{rows.length !== 1 ? "s" : ""}
        </span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={TABLE}>
          <thead>
            <tr>
              <th style={TH}>ID</th>
              <th style={TH}>Changed Fields</th>
              <th style={TH}>Before</th>
              <th style={TH}>After</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td
                  style={{ ...TD, fontFamily: "monospace", fontSize: "11px" }}
                >
                  {row.id}
                </td>
                <td style={TD}>
                  {row.changed_fields.map((f) => (
                    <Badge key={f} color="accent">
                      {f}
                    </Badge>
                  ))}
                </td>
                <td
                  style={{
                    ...TD,
                    fontFamily: "monospace",
                    fontSize: "11px",
                    color: "var(--io-danger)",
                  }}
                >
                  {row.changed_fields.map((f) => (
                    <div key={f}>
                      {f}: {String(row.before[f] ?? "")}
                    </div>
                  ))}
                </td>
                <td
                  style={{
                    ...TD,
                    fontFamily: "monospace",
                    fontSize: "11px",
                    color: "var(--io-success)",
                  }}
                >
                  {row.changed_fields.map((f) => (
                    <div key={f}>
                      {f}: {String(row.after[f] ?? "")}
                    </div>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ConflictedSection({
  rows,
  resolution,
  onChangeResolution,
}: {
  rows: ModifiedRow[];
  resolution: "skip" | "overwrite";
  onChangeResolution: (v: "skip" | "overwrite") => void;
}) {
  if (rows.length === 0) return null;
  return (
    <div
      style={{
        marginBottom: "var(--io-space-4)",
        border: "1px solid var(--io-warning)",
        borderRadius: "6px",
        padding: "var(--io-space-3)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--io-space-2)",
          marginBottom: "var(--io-space-3)",
        }}
      >
        <span style={{ fontSize: "16px" }}>⚠</span>
        <Badge color="warning">Conflict</Badge>
        <span
          style={{
            color: "var(--io-warning)",
            fontSize: "13px",
            fontWeight: 600,
          }}
        >
          {rows.length} row{rows.length !== 1 ? "s" : ""} modified in database
          since template was exported
        </span>
      </div>
      <p
        style={{
          fontSize: "12px",
          color: "var(--io-text-secondary)",
          marginBottom: "var(--io-space-3)",
        }}
      >
        These rows were updated by another user or process after you downloaded
        the template. Choose how to resolve:
      </p>
      <div
        style={{
          display: "flex",
          gap: "var(--io-space-4)",
          marginBottom: "var(--io-space-3)",
        }}
      >
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--io-space-2)",
            fontSize: "13px",
            cursor: "pointer",
          }}
        >
          <input
            type="radio"
            name="conflict_resolution"
            value="skip"
            checked={resolution === "skip"}
            onChange={() => onChangeResolution("skip")}
          />
          Skip conflicted rows (default — preserve newer database values)
        </label>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--io-space-2)",
            fontSize: "13px",
            cursor: "pointer",
          }}
        >
          <input
            type="radio"
            name="conflict_resolution"
            value="overwrite"
            checked={resolution === "overwrite"}
            onChange={() => onChangeResolution("overwrite")}
          />
          Overwrite with template values
        </label>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={TABLE}>
          <thead>
            <tr>
              <th style={TH}>ID</th>
              <th style={TH}>Changed Fields</th>
              <th style={{ ...TH, color: "var(--io-warning)" }}>
                Template Value (after)
              </th>
              <th style={TH}>Current DB Value (before)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.id}
                style={{
                  background:
                    "color-mix(in srgb, var(--io-warning) 5%, transparent)",
                }}
              >
                <td
                  style={{ ...TD, fontFamily: "monospace", fontSize: "11px" }}
                >
                  <span style={{ marginRight: "4px" }}>⚠</span>
                  {row.id}
                </td>
                <td style={TD}>
                  {row.changed_fields.length > 0 ? (
                    row.changed_fields.map((f) => (
                      <Badge key={f} color="warning">
                        {f}
                      </Badge>
                    ))
                  ) : (
                    <span
                      style={{
                        color: "var(--io-text-muted)",
                        fontSize: "11px",
                      }}
                    >
                      conflict (no field changes)
                    </span>
                  )}
                </td>
                <td
                  style={{
                    ...TD,
                    fontFamily: "monospace",
                    fontSize: "11px",
                    color: "var(--io-warning)",
                  }}
                >
                  {row.changed_fields.map((f) => (
                    <div key={f}>
                      {f}: {String(row.after[f] ?? "")}
                    </div>
                  ))}
                </td>
                <td
                  style={{
                    ...TD,
                    fontFamily: "monospace",
                    fontSize: "11px",
                    color: "var(--io-text-secondary)",
                  }}
                >
                  {row.changed_fields.map((f) => (
                    <div key={f}>
                      {f}: {String(row.before[f] ?? "")}
                    </div>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2 sub-component: Validate & Map
// ---------------------------------------------------------------------------

// Known system fields per target type (for the unmapped column dropdown)
const SYSTEM_FIELDS_BY_TARGET: Record<TargetType, string[]> = {
  users: ["full_name", "email", "enabled"],
  opc_sources: ["name", "endpoint_url", "enabled"],
  alarm_definitions: [
    "name",
    "point_tag",
    "high_high",
    "high",
    "low",
    "low_low",
    "enabled",
  ],
  import_connections: ["name", "connector_type", "enabled"],
  points_metadata: [
    "active",
    "criticality",
    "area",
    "aggregation_types",
    "barcode",
    "notes",
    "gps_latitude",
    "gps_longitude",
    "write_frequency_seconds",
    "default_graphic_id",
  ],
  user_roles: ["role_id"],
  application_settings: ["value"],
  point_sources: ["name", "description", "enabled"],
  dashboard_metadata: ["name", "published"],
  import_definitions: [
    "name",
    "description",
    "enabled",
    "batch_size",
    "error_strategy",
  ],
};

function ColumnMappingTable({
  mappings,
  targetType,
  onRemap,
}: {
  mappings: ColumnMapping[];
  targetType: TargetType;
  onRemap: (fileColumn: string, systemField: string | null) => void;
}) {
  const availableFields = SYSTEM_FIELDS_BY_TARGET[targetType] ?? [];

  const statusBadge = (status: ColumnMapping["status"]) => {
    if (status === "matched") return <Badge color="success">Matched</Badge>;
    if (status === "read_only")
      return <Badge color="muted">Read-only skip</Badge>;
    return <Badge color="warning">Unmapped</Badge>;
  };

  return (
    <div style={{ overflowX: "auto", marginBottom: "var(--io-space-4)" }}>
      <table style={TABLE}>
        <thead>
          <tr>
            <th style={TH}>File Column</th>
            <th style={TH}>System Field</th>
            <th style={TH}>Status</th>
          </tr>
        </thead>
        <tbody>
          {mappings.map((m, i) => (
            <tr key={i}>
              <td style={{ ...TD, fontFamily: "monospace", fontSize: "11px" }}>
                {m.file_column}
              </td>
              <td style={{ ...TD, fontFamily: "monospace", fontSize: "11px" }}>
                {m.status === "unmapped" ? (
                  <select
                    style={{
                      ...SELECT,
                      minWidth: "unset",
                      fontSize: "11px",
                      padding: "2px 6px",
                    }}
                    value={m.system_field || ""}
                    onChange={(e) =>
                      onRemap(m.file_column, e.target.value || null)
                    }
                  >
                    <option value="">— Ignore —</option>
                    {availableFields.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                ) : (
                  m.system_field
                )}
              </td>
              <td style={TD}>{statusBadge(m.status)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ValidationSummaryPanel({
  validation,
  onDownloadErrorReport,
}: {
  validation: DiffPreview["validation"];
  onDownloadErrorReport: () => void;
}) {
  const totalErrors =
    validation.invalid_id_count +
    validation.duplicate_id_count +
    validation.type_error_count +
    validation.required_field_error_count;

  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: "var(--io-space-4)",
          flexWrap: "wrap",
          marginBottom: "var(--io-space-3)",
        }}
      >
        <span style={{ fontSize: "13px", color: "var(--io-text-secondary)" }}>
          <Badge color="success">[OK]</Badge>{" "}
          <strong>{validation.valid_id_count}</strong> rows have valid record
          IDs
        </span>
        {validation.duplicate_id_count > 0 && (
          <span style={{ fontSize: "13px", color: "var(--io-text-secondary)" }}>
            <Badge color="danger">[!!]</Badge>{" "}
            <strong>{validation.duplicate_id_count}</strong> duplicate IDs
          </span>
        )}
        {validation.invalid_id_count > 0 && (
          <span style={{ fontSize: "13px", color: "var(--io-text-secondary)" }}>
            <Badge color="danger">[!!]</Badge>{" "}
            <strong>{validation.invalid_id_count}</strong> invalid record IDs
          </span>
        )}
        {validation.type_error_count > 0 && (
          <span style={{ fontSize: "13px", color: "var(--io-text-secondary)" }}>
            <Badge color="danger">[!!]</Badge>{" "}
            <strong>{validation.type_error_count}</strong> type errors
          </span>
        )}
        {validation.required_field_error_count > 0 && (
          <span style={{ fontSize: "13px", color: "var(--io-text-secondary)" }}>
            <Badge color="warning">[!!]</Badge>{" "}
            <strong>{validation.required_field_error_count}</strong> required
            field errors
          </span>
        )}
      </div>

      {totalErrors > 0 && (
        <>
          <div
            style={{
              overflowX: "auto",
              maxHeight: 200,
              marginBottom: "var(--io-space-3)",
            }}
          >
            <table style={TABLE}>
              <thead>
                <tr>
                  <th style={TH}>Row</th>
                  <th style={TH}>ID</th>
                  <th style={TH}>Field</th>
                  <th style={TH}>Error</th>
                </tr>
              </thead>
              <tbody>
                {validation.errors.slice(0, 50).map((err, i) => (
                  <tr key={i}>
                    <td style={TD}>{err.row}</td>
                    <td
                      style={{
                        ...TD,
                        fontFamily: "monospace",
                        fontSize: "11px",
                      }}
                    >
                      {err.id || "—"}
                    </td>
                    <td
                      style={{
                        ...TD,
                        fontFamily: "monospace",
                        fontSize: "11px",
                      }}
                    >
                      {err.field ?? "—"}
                    </td>
                    <td
                      style={{
                        ...TD,
                        color: "var(--io-danger)",
                        fontSize: "12px",
                      }}
                    >
                      {err.error}
                    </td>
                  </tr>
                ))}
                {validation.errors.length > 50 && (
                  <tr>
                    <td
                      colSpan={4}
                      style={{
                        ...TD,
                        color: "var(--io-text-muted)",
                        fontStyle: "italic",
                      }}
                    >
                      … and {validation.errors.length - 50} more errors
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <button style={BTN_SECONDARY} onClick={onDownloadErrorReport}>
            Download error report (CSV)
          </button>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 4 sub-component: Results
// ---------------------------------------------------------------------------

function FailedRowsTable({ rows }: { rows: FailedRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div style={{ overflowX: "auto", marginBottom: "var(--io-space-4)" }}>
      <table style={TABLE}>
        <thead>
          <tr>
            <th style={TH}>Row</th>
            <th style={TH}>ID</th>
            <th style={TH}>Reason Type</th>
            <th style={TH}>Reason</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td style={TD}>{r.row > 0 ? r.row : "—"}</td>
              <td style={{ ...TD, fontFamily: "monospace", fontSize: "11px" }}>
                {r.id || "—"}
              </td>
              <td style={TD}>
                <Badge
                  color={
                    r.reason_type === "validation_error" ? "danger" : "warning"
                  }
                >
                  {r.reason_type === "validation_error"
                    ? "Validation"
                    : r.reason_type === "apply_error"
                      ? "Apply Error"
                      : "Skipped"}
                </Badge>
              </td>
              <td
                style={{ ...TD, fontSize: "12px", color: "var(--io-danger)" }}
              >
                {r.reason}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Wizard step indicator
// ---------------------------------------------------------------------------

function StepIndicator({ current, total }: { current: number; total: number }) {
  const labels = [
    "Choose Target",
    "Validate & Map",
    "Review Changes",
    "Results",
  ];
  return (
    <div
      style={{
        display: "flex",
        gap: 0,
        marginBottom: "var(--io-space-4)",
        alignItems: "center",
      }}
    >
      {labels.slice(0, total).map((label, i) => {
        const step = i + 1;
        const isActive = step === current;
        const isDone = step < current;
        return (
          <div key={step} style={{ display: "flex", alignItems: "center" }}>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 4,
              }}
            >
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 700,
                  fontSize: "12px",
                  background: isActive
                    ? "var(--io-accent)"
                    : isDone
                      ? "var(--io-success)"
                      : "var(--io-surface-sunken)",
                  color: isActive || isDone ? "#fff" : "var(--io-text-muted)",
                  border: `2px solid ${isActive ? "var(--io-accent)" : isDone ? "var(--io-success)" : "var(--io-border)"}`,
                }}
              >
                {isDone ? "✓" : step}
              </div>
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: isActive ? 600 : 400,
                  color: isActive
                    ? "var(--io-text-primary)"
                    : "var(--io-text-muted)",
                  whiteSpace: "nowrap",
                }}
              >
                {label}
              </span>
            </div>
            {i < total - 1 && (
              <div
                style={{
                  width: 40,
                  height: 2,
                  background: isDone ? "var(--io-success)" : "var(--io-border)",
                  margin: "0 4px",
                  marginBottom: 20,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main BulkUpdateTab — 4-step wizard
// ---------------------------------------------------------------------------

function BulkUpdateTab() {
  // Step: 1 = Choose Target, 2 = Validate & Map, 3 = Review Changes, 4 = Results
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [targetType, setTargetType] = useState<TargetType>("users");
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<DiffPreview | null>(null);
  // Local overrides for unmapped columns (file_column → system_field or null=ignore)
  const [columnMappingOverrides, setColumnMappingOverrides] = useState<
    Record<string, string | null>
  >({});
  const [applyResult, setApplyResult] = useState<ApplySummary | null>(null);
  const [showApplyConfirm, setShowApplyConfirm] = useState(false);
  const [showUndoConfirm, setShowUndoConfirm] = useState(false);
  const [undoDone, setUndoDone] = useState(false);
  const [conflictResolution, setConflictResolution] = useState<
    "skip" | "overwrite"
  >("skip");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const previewMutation = useMutation({
    mutationFn: ({ type, f }: { type: TargetType; f: File }) =>
      bulkUpdateApi.preview(type, f),
    onSuccess: (res) => {
      if (res.success) {
        setPreview(res.data);
        setApplyResult(null);
        setStep(2);
      } else {
        showToast({
          title: "Preview failed",
          description: res.error.message,
          variant: "error",
        });
      }
    },
    onError: () => {
      showToast({
        title: "Preview failed",
        description: "Network error",
        variant: "error",
      });
    },
  });

  const applyMutation = useMutation({
    mutationFn: ({
      type,
      f,
      conflictRes,
    }: {
      type: TargetType;
      f: File;
      conflictRes?: "skip" | "overwrite";
    }) => bulkUpdateApi.apply(type, f, conflictRes ?? "skip"),
    onSuccess: (res) => {
      if (res.success) {
        setApplyResult(res.data);
        setPreview(null);
        setStep(4);
        showToast({
          title: "Bulk update applied",
          description: `Modified: ${res.data.modified}, Unchanged: ${res.data.unchanged}${res.data.validation_failed > 0 ? `, Failed: ${res.data.validation_failed}` : ""}`,
          variant: "success",
        });
      } else {
        showToast({
          title: "Apply failed",
          description: res.error.message,
          variant: "error",
        });
      }
    },
    onError: () => {
      showToast({
        title: "Apply failed",
        description: "Network error",
        variant: "error",
      });
    },
  });

  const undoMutation = useMutation({
    mutationFn: (snapshotId: string) => snapshotsApi.restore(snapshotId),
    onSuccess: (res) => {
      if (res.success) {
        setUndoDone(true);
        showToast({
          title: "Changes undone",
          description: `Restored from safety snapshot. ${res.data.rows_restored} rows restored.`,
          variant: "success",
        });
      } else {
        showToast({
          title: "Undo failed",
          description: res.error.message,
          variant: "error",
        });
      }
    },
    onError: () => {
      showToast({
        title: "Undo failed",
        description: "Could not restore from snapshot",
        variant: "error",
      });
    },
  });

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) {
      setFile(dropped);
      setPreview(null);
      setApplyResult(null);
      setColumnMappingOverrides({});
      setStep(1);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setPreview(null);
      setApplyResult(null);
      setColumnMappingOverrides({});
      setStep(1);
    }
  };

  const handleRemap = useCallback(
    (fileColumn: string, systemField: string | null) => {
      setColumnMappingOverrides((prev) => ({
        ...prev,
        [fileColumn]: systemField,
      }));
    },
    [],
  );

  const handleDownloadTemplate = async () => {
    try {
      await bulkUpdateApi.downloadTemplate(targetType);
    } catch (e) {
      showToast({
        title: "Download failed",
        description: String(e),
        variant: "error",
      });
    }
  };

  const handlePreview = () => {
    if (!file) return;
    setApplyResult(null);
    previewMutation.mutate({ type: targetType, f: file });
  };

  const handleApply = () => {
    setShowApplyConfirm(true);
  };

  const confirmApply = () => {
    setShowApplyConfirm(false);
    if (!file) return;
    applyMutation.mutate({
      type: targetType,
      f: file,
      conflictRes: conflictResolution,
    });
  };

  const handleDownloadValidationErrorReport = () => {
    if (!preview) return;
    bulkUpdateApi
      .downloadErrorReport(
        "",
        preview.validation.errors.map((e) => ({
          row: e.row,
          id: e.id,
          reason_type: "validation_error" as const,
          reason: e.error,
        })),
      )
      .catch((err) => {
        showToast({
          title: "Download failed",
          description: String(err),
          variant: "error",
        });
      });
  };

  const handleDownloadResultErrorReport = () => {
    if (!applyResult) return;
    bulkUpdateApi
      .downloadErrorReport(applyResult.snapshot_id, applyResult.failed_rows)
      .catch((err) => {
        showToast({
          title: "Download failed",
          description: String(err),
          variant: "error",
        });
      });
  };

  const handleDownloadFullResults = () => {
    if (!applyResult) return;
    bulkUpdateApi.downloadFullResults(applyResult, targetType);
  };

  const confirmUndo = () => {
    setShowUndoConfirm(false);
    if (!applyResult) return;
    undoMutation.mutate(applyResult.snapshot_id);
  };

  const hasChanges =
    preview &&
    (preview.added.length > 0 ||
      preview.modified.length > 0 ||
      preview.removed.length > 0 ||
      (preview.conflicted?.length ?? 0) > 0);

  const resetWizard = () => {
    setStep(1);
    setFile(null);
    setPreview(null);
    setApplyResult(null);
    setColumnMappingOverrides({});
    setUndoDone(false);
    setConflictResolution("skip");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div>
      <ConfirmDialog
        open={showApplyConfirm}
        onOpenChange={(open) => {
          if (!open) setShowApplyConfirm(false);
        }}
        title="Apply Bulk Update"
        description={`This will apply ${preview?.modified.length ?? 0} modification(s) to ${TARGET_TYPE_LABELS[targetType]}. A safety snapshot will be created first. Valid rows will be applied; rows with validation errors will be skipped. Continue?`}
        confirmLabel="Apply"
        onConfirm={confirmApply}
      />
      <ConfirmDialog
        open={showUndoConfirm}
        onOpenChange={(open) => {
          if (!open) setShowUndoConfirm(false);
        }}
        title="Undo Bulk Update"
        description={`This will restore ${TARGET_TYPE_LABELS[targetType]} data from the safety snapshot created before the bulk update. All changes will be reverted. Continue?`}
        confirmLabel="Undo"
        onConfirm={confirmUndo}
      />

      <StepIndicator current={step} total={4} />

      {/* ------------------------------------------------------------------ */}
      {/* Step 1 — Choose Target & Upload                                      */}
      {/* ------------------------------------------------------------------ */}
      <div style={CARD}>
        <SectionTitle>
          Step 1 — Choose Target &amp; Download Template
        </SectionTitle>
        <div
          style={{
            display: "flex",
            gap: "var(--io-space-3)",
            flexWrap: "wrap",
            alignItems: "center",
            marginBottom: "var(--io-space-4)",
          }}
        >
          <select
            style={SELECT}
            value={targetType}
            onChange={(e) => {
              setTargetType(e.target.value as TargetType);
              setFile(null);
              setPreview(null);
              setApplyResult(null);
              setColumnMappingOverrides({});
              setStep(1);
            }}
          >
            {(Object.entries(TARGET_TYPE_LABELS) as [TargetType, string][]).map(
              ([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ),
            )}
          </select>
          <button style={BTN_SECONDARY} onClick={handleDownloadTemplate}>
            Download Template (CSV)
          </button>
        </div>

        <SectionTitle>Upload Modified File (CSV or XLSX)</SectionTitle>
        <div
          style={{
            border: `2px dashed ${isDragging ? "var(--io-accent)" : "var(--io-border)"}`,
            borderRadius: "8px",
            padding: "var(--io-space-6)",
            textAlign: "center",
            cursor: "pointer",
            background: isDragging
              ? "var(--io-accent-subtle)"
              : "var(--io-surface-sunken)",
            transition: "border-color 0.15s, background 0.15s",
          }}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            style={{ display: "none" }}
            onChange={handleFileChange}
          />
          {file ? (
            <span
              style={{
                color: "var(--io-text-primary)",
                fontWeight: 500,
                fontSize: "13px",
              }}
            >
              {file.name} ({(file.size / 1024).toFixed(1)} KB)
            </span>
          ) : (
            <span style={{ color: "var(--io-text-muted)", fontSize: "13px" }}>
              Drag and drop a CSV file here, or click to browse
            </span>
          )}
        </div>
        {file && (
          <div
            style={{
              display: "flex",
              gap: "var(--io-space-3)",
              marginTop: "var(--io-space-3)",
            }}
          >
            <button
              style={BTN_PRIMARY}
              onClick={handlePreview}
              disabled={previewMutation.isPending}
            >
              {previewMutation.isPending
                ? "Analysing…"
                : "Next: Validate & Map"}
            </button>
          </div>
        )}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Step 2 — Validate & Map                                             */}
      {/* ------------------------------------------------------------------ */}
      {step >= 2 && preview && (
        <div style={CARD}>
          <SectionTitle>Step 2 — Validate &amp; Map</SectionTitle>
          <p
            style={{
              fontSize: "13px",
              color: "var(--io-text-muted)",
              marginBottom: "var(--io-space-3)",
            }}
          >
            File: <strong>{file?.name}</strong>{" "}
            {(() => {
              const total =
                preview.added.length +
                preview.modified.length +
                preview.removed.length +
                preview.unchanged_count;
              return `(${total} rows detected)`;
            })()}
          </p>

          <div style={{ marginBottom: "var(--io-space-4)" }}>
            <p
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--io-text-secondary)",
                marginBottom: "var(--io-space-2)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Column Mapping
            </p>
            {preview.column_mapping.length > 0 ? (
              <ColumnMappingTable
                mappings={preview.column_mapping.map((m) =>
                  m.status === "unmapped" &&
                  columnMappingOverrides[m.file_column] !== undefined
                    ? {
                        ...m,
                        system_field:
                          columnMappingOverrides[m.file_column] ?? "",
                      }
                    : m,
                )}
                targetType={targetType}
                onRemap={handleRemap}
              />
            ) : (
              <p style={{ color: "var(--io-text-muted)", fontSize: "13px" }}>
                No column mapping data available.
              </p>
            )}
          </div>

          <div style={{ marginBottom: "var(--io-space-4)" }}>
            <p
              style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--io-text-secondary)",
                marginBottom: "var(--io-space-2)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              Validation
            </p>
            <ValidationSummaryPanel
              validation={preview.validation}
              onDownloadErrorReport={handleDownloadValidationErrorReport}
            />
          </div>

          <div style={{ display: "flex", gap: "var(--io-space-3)" }}>
            <button style={BTN_SECONDARY} onClick={() => setStep(1)}>
              Back
            </button>
            <button style={BTN_PRIMARY} onClick={() => setStep(3)}>
              Next: Review Changes
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Step 3 — Review Changes                                             */}
      {/* ------------------------------------------------------------------ */}
      {step >= 3 && preview && (
        <div style={CARD}>
          <SectionTitle>Step 3 — Review Changes</SectionTitle>
          <div
            style={{
              display: "flex",
              gap: "var(--io-space-3)",
              marginBottom: "var(--io-space-4)",
              flexWrap: "wrap",
            }}
          >
            <span
              style={{ fontSize: "13px", color: "var(--io-text-secondary)" }}
            >
              Added: <strong>{preview.added.length}</strong>
            </span>
            <span
              style={{ fontSize: "13px", color: "var(--io-text-secondary)" }}
            >
              Modified: <strong>{preview.modified.length}</strong>
            </span>
            <span
              style={{ fontSize: "13px", color: "var(--io-text-secondary)" }}
            >
              Removed: <strong>{preview.removed.length}</strong>
            </span>
            <span style={{ fontSize: "13px", color: "var(--io-text-muted)" }}>
              Unchanged: {preview.unchanged_count}
            </span>
            {(preview.conflicted?.length ?? 0) > 0 && (
              <span style={{ fontSize: "13px", color: "var(--io-warning)" }}>
                ⚠ Conflicted: <strong>{preview.conflicted.length}</strong>{" "}
                (modified since export)
              </span>
            )}
            {preview.validation.errors.length > 0 && (
              <span style={{ fontSize: "13px", color: "var(--io-danger)" }}>
                Validation errors:{" "}
                <strong>{preview.validation.errors.length}</strong> (rows will
                be skipped)
              </span>
            )}
          </div>
          {!hasChanges && (preview.conflicted?.length ?? 0) === 0 && (
            <p style={{ color: "var(--io-text-muted)", fontSize: "13px" }}>
              No changes detected — the uploaded file matches current data.
            </p>
          )}
          <ConflictedSection
            rows={preview.conflicted ?? []}
            resolution={conflictResolution}
            onChangeResolution={setConflictResolution}
          />
          <DiffSection title="Added" color="success" rows={preview.added} />
          <ModifiedSection rows={preview.modified} />
          <DiffSection title="Removed" color="danger" rows={preview.removed} />

          <div
            style={{
              display: "flex",
              gap: "var(--io-space-3)",
              marginTop: "var(--io-space-4)",
            }}
          >
            <button style={BTN_SECONDARY} onClick={() => setStep(2)}>
              Back
            </button>
            <button
              style={{
                ...BTN_PRIMARY,
                background: "var(--io-success)",
                opacity: !hasChanges ? 0.5 : 1,
              }}
              onClick={handleApply}
              disabled={!hasChanges || applyMutation.isPending}
            >
              {applyMutation.isPending ? "Applying…" : "Apply Changes"}
            </button>
          </div>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Step 4 — Results                                                    */}
      {/* ------------------------------------------------------------------ */}
      {step === 4 && applyResult && (
        <div
          style={{
            ...CARD,
            borderColor:
              applyResult.failed_rows.length > 0
                ? "var(--io-warning)"
                : "var(--io-success)",
          }}
        >
          <SectionTitle>Step 4 — Results</SectionTitle>

          {/* Count summary */}
          <div
            style={{
              display: "flex",
              gap: "var(--io-space-5)",
              flexWrap: "wrap",
              marginBottom: "var(--io-space-4)",
            }}
          >
            <div style={{ fontSize: "13px" }}>
              <Badge color="success">[OK]</Badge>{" "}
              <strong style={{ color: "var(--io-success)" }}>
                {applyResult.modified}
              </strong>{" "}
              rows updated
            </div>
            <div style={{ fontSize: "13px" }}>
              <Badge color="muted">Unchanged</Badge>{" "}
              <strong>{applyResult.unchanged}</strong> rows unchanged
            </div>
            {applyResult.added > 0 && (
              <div style={{ fontSize: "13px" }}>
                <Badge color="accent">Added</Badge>{" "}
                <strong>{applyResult.added}</strong> rows added
              </div>
            )}
            {applyResult.validation_failed > 0 && (
              <div style={{ fontSize: "13px" }}>
                <Badge color="danger">[!!]</Badge>{" "}
                <strong>{applyResult.validation_failed}</strong> rows failed
                validation
              </div>
            )}
            {applyResult.failed_rows.filter(
              (r) => r.reason_type === "skipped_conflict",
            ).length > 0 && (
              <div style={{ fontSize: "13px" }}>
                <Badge color="warning">[!]</Badge>{" "}
                <strong>
                  {
                    applyResult.failed_rows.filter(
                      (r) => r.reason_type === "skipped_conflict",
                    ).length
                  }
                </strong>{" "}
                rows skipped (conflict)
              </div>
            )}
          </div>

          {/* Safety snapshot info */}
          <div
            style={{
              fontSize: "12px",
              color: "var(--io-text-muted)",
              marginBottom: "var(--io-space-4)",
              fontFamily: "monospace",
            }}
          >
            Safety snapshot ID: {applyResult.snapshot_id}
          </div>

          {/* Failed/skipped rows table */}
          {applyResult.failed_rows.length > 0 && (
            <div style={{ marginBottom: "var(--io-space-4)" }}>
              <p
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  color: "var(--io-text-secondary)",
                  marginBottom: "var(--io-space-2)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Failed / Skipped Rows
              </p>
              <FailedRowsTable rows={applyResult.failed_rows} />
            </div>
          )}

          {/* Action buttons */}
          <div
            style={{
              display: "flex",
              gap: "var(--io-space-3)",
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            {applyResult.failed_rows.length > 0 && (
              <button
                style={BTN_SECONDARY}
                onClick={handleDownloadResultErrorReport}
              >
                Download Error Report
              </button>
            )}
            <button style={BTN_SECONDARY} onClick={handleDownloadFullResults}>
              Download Full Results
            </button>
            {!undoDone ? (
              <button
                style={BTN_DANGER}
                onClick={() => setShowUndoConfirm(true)}
                disabled={undoMutation.isPending}
              >
                {undoMutation.isPending ? "Undoing…" : "Undo All Changes"}
              </button>
            ) : (
              <Badge color="success">Changes undone</Badge>
            )}
            <button
              style={{ ...BTN_SECONDARY, marginLeft: "auto" }}
              onClick={resetWizard}
            >
              Start New Bulk Update
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: Snapshots
// ---------------------------------------------------------------------------

function SnapshotDataTable({ data }: { data: Record<string, unknown>[] }) {
  if (!data || data.length === 0)
    return (
      <p style={{ color: "var(--io-text-muted)", fontSize: "12px" }}>
        No data.
      </p>
    );
  const keys = Object.keys(data[0]);
  return (
    <div style={{ overflowX: "auto", marginTop: "var(--io-space-3)" }}>
      <table style={{ ...TABLE, fontSize: "11px" }}>
        <thead>
          <tr>
            {keys.map((k) => (
              <th key={k} style={TH}>
                {k}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i}>
              {keys.map((k) => (
                <td key={k} style={{ ...TD, fontFamily: "monospace" }}>
                  {String(row[k] ?? "")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SnapshotsTab() {
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createType, setCreateType] = useState<TargetType>("users");
  const [createLabel, setCreateLabel] = useState("");
  const [restoreId, setRestoreId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  const { data: listData, isLoading } = useQuery({
    queryKey: ["snapshots", page],
    queryFn: async () => {
      const token = localStorage.getItem("io_access_token");
      const res = await fetch(`/api/snapshots?page=${page}&limit=20`, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load snapshots");
      const json = (await res.json()) as {
        success: boolean;
        data: Snapshot[];
        pagination?: { pages: number; page: number };
      };
      if (!json.success) throw new Error("Failed to load snapshots");
      return { data: json.data ?? [], pagination: json.pagination ?? null };
    },
  });

  const { data: detailResult } = useQuery({
    queryKey: ["snapshot-detail", expanded],
    queryFn: () => snapshotsApi.get(expanded!),
    enabled: !!expanded,
  });

  const createMutation = useMutation({
    mutationFn: () =>
      snapshotsApi.create({
        target_type: createType,
        label: createLabel || undefined,
      }),
    onSuccess: (res) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ["snapshots"] });
        setShowCreateForm(false);
        setCreateLabel("");
        showToast({ title: "Snapshot created", variant: "success" });
      } else {
        showToast({
          title: "Failed to create snapshot",
          description: res.error.message,
          variant: "error",
        });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => snapshotsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["snapshots"] });
      setDeleteId(null);
      showToast({ title: "Snapshot deleted", variant: "success" });
    },
  });

  const snapshots = (listData?.data ?? []) as Snapshot[];
  const pagination = listData?.pagination ?? null;
  const detail = detailResult?.success
    ? (detailResult.data as SnapshotDetail)
    : null;
  const restoreSnap = restoreId
    ? snapshots.find((s) => s.id === restoreId)
    : null;

  return (
    <div>
      <ConfirmDialog
        open={!!deleteId}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
        title="Delete Snapshot"
        description="Delete this snapshot? This cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => {
          if (deleteId) deleteMutation.mutate(deleteId);
        }}
      />
      {restoreId && (
        <RestorePreviewModal
          snapshotId={restoreId}
          snapshotLabel={restoreSnap?.label}
          onClose={() => setRestoreId(null)}
          onRestored={(result) => {
            setRestoreId(null);
            qc.invalidateQueries({ queryKey: ["snapshots"] });
            showToast({
              title: "Snapshot restored",
              description: `${result.rows_restored} rows restored.${result.safety_snapshot_id ? ` Safety snapshot: ${result.safety_snapshot_id.slice(0, 8)}…` : ""}`,
              variant: "success",
            });
          }}
        />
      )}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "var(--io-space-4)",
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: "14px",
            fontWeight: 600,
            color: "var(--io-text-primary)",
          }}
        >
          Saved Snapshots
        </h3>
        <button
          style={BTN_PRIMARY}
          onClick={() => setShowCreateForm((v) => !v)}
        >
          {showCreateForm ? "Cancel" : "+ Create Snapshot"}
        </button>
      </div>

      {showCreateForm && (
        <div style={{ ...CARD, borderColor: "var(--io-accent)" }}>
          <SectionTitle>New Snapshot</SectionTitle>
          <div
            style={{
              display: "flex",
              gap: "var(--io-space-3)",
              flexWrap: "wrap",
              alignItems: "flex-end",
            }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "12px",
                  color: "var(--io-text-muted)",
                  marginBottom: 4,
                }}
              >
                Target Type
              </label>
              <select
                style={SELECT}
                value={createType}
                onChange={(e) => setCreateType(e.target.value as TargetType)}
              >
                {(
                  Object.entries(TARGET_TYPE_LABELS) as [TargetType, string][]
                ).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: "12px",
                  color: "var(--io-text-muted)",
                  marginBottom: 4,
                }}
              >
                Label (optional)
              </label>
              <input
                style={INPUT}
                placeholder="e.g. pre-maintenance-window"
                value={createLabel}
                onChange={(e) => setCreateLabel(e.target.value)}
              />
            </div>
            <button
              style={BTN_PRIMARY}
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "Creating…" : "Create"}
            </button>
          </div>
        </div>
      )}

      {isLoading && (
        <p style={{ color: "var(--io-text-muted)", fontSize: "13px" }}>
          Loading snapshots…
        </p>
      )}

      {!isLoading && snapshots.length === 0 && (
        <p style={{ color: "var(--io-text-muted)", fontSize: "13px" }}>
          No snapshots yet.
        </p>
      )}

      {snapshots.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={TABLE}>
            <thead>
              <tr>
                <th style={TH}>Target Type</th>
                <th style={TH}>Label</th>
                <th style={TH}>Rows</th>
                <th style={TH}>Created</th>
                <th style={TH}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {snapshots.map((snap) => (
                <>
                  <tr key={snap.id}>
                    <td style={TD}>
                      <Badge color="accent">
                        {TARGET_TYPE_LABELS[snap.target_type] ??
                          snap.target_type}
                      </Badge>
                    </td>
                    <td
                      style={{
                        ...TD,
                        color: snap.label
                          ? "var(--io-text-primary)"
                          : "var(--io-text-muted)",
                      }}
                    >
                      {snap.label ?? "—"}
                    </td>
                    <td style={TD}>{snap.row_count}</td>
                    <td
                      style={{
                        ...TD,
                        fontSize: "11px",
                        fontFamily: "monospace",
                      }}
                    >
                      {fmtDate(snap.created_at)}
                    </td>
                    <td style={TD}>
                      <div
                        style={{ display: "flex", gap: "var(--io-space-2)" }}
                      >
                        <button
                          style={{
                            ...BTN_SECONDARY,
                            fontSize: "11px",
                            padding: "3px 8px",
                          }}
                          onClick={() =>
                            setExpanded(expanded === snap.id ? null : snap.id)
                          }
                        >
                          {expanded === snap.id ? "Hide" : "View Data"}
                        </button>
                        <button
                          style={{
                            ...BTN_SECONDARY,
                            fontSize: "11px",
                            padding: "3px 8px",
                          }}
                          onClick={() => setRestoreId(snap.id)}
                        >
                          Restore
                        </button>
                        <button
                          style={{
                            ...BTN_DANGER,
                            fontSize: "11px",
                            padding: "3px 8px",
                          }}
                          onClick={() => setDeleteId(snap.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expanded === snap.id && (
                    <tr key={`${snap.id}-detail`}>
                      <td
                        colSpan={5}
                        style={{
                          background: "var(--io-surface-sunken)",
                          padding: "var(--io-space-3)",
                        }}
                      >
                        {detail && detail.id === snap.id ? (
                          <SnapshotDataTable data={detail.snapshot_data} />
                        ) : (
                          <p
                            style={{
                              color: "var(--io-text-muted)",
                              fontSize: "12px",
                            }}
                          >
                            Loading…
                          </p>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination && pagination.pages > 1 && (
        <div
          style={{
            display: "flex",
            gap: "var(--io-space-2)",
            marginTop: "var(--io-space-3)",
            alignItems: "center",
          }}
        >
          <button
            style={BTN_SECONDARY}
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Prev
          </button>
          <span style={{ fontSize: "12px", color: "var(--io-text-muted)" }}>
            Page {page} of {pagination.pages}
          </span>
          <button
            style={BTN_SECONDARY}
            disabled={page >= pagination.pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab: History
// ---------------------------------------------------------------------------

function HistoryTab() {
  const { data: listResult, isLoading } = useQuery({
    queryKey: ["snapshots-history"],
    queryFn: async () => {
      const result = await snapshotsApi.list({ page: 1, limit: 20 });
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
  });

  const snapshots = (listResult ?? []) as Snapshot[];

  if (isLoading) {
    return (
      <p style={{ color: "var(--io-text-muted)", fontSize: "13px" }}>
        Loading…
      </p>
    );
  }

  if (snapshots.length === 0) {
    return (
      <p style={{ color: "var(--io-text-muted)", fontSize: "13px" }}>
        No snapshot history yet.
      </p>
    );
  }

  return (
    <div>
      <h3
        style={{
          margin: "0 0 var(--io-space-4)",
          fontSize: "14px",
          fontWeight: 600,
          color: "var(--io-text-primary)",
        }}
      >
        Last 20 Snapshots
      </h3>
      <div style={{ position: "relative", paddingLeft: "var(--io-space-6)" }}>
        {/* Timeline line */}
        <div
          style={{
            position: "absolute",
            left: 10,
            top: 0,
            bottom: 0,
            width: 2,
            background: "var(--io-border)",
          }}
        />
        {snapshots.map((snap) => (
          <div
            key={snap.id}
            style={{
              position: "relative",
              marginBottom: "var(--io-space-4)",
              paddingLeft: "var(--io-space-4)",
            }}
          >
            {/* Dot */}
            <div
              style={{
                position: "absolute",
                left: -16,
                top: 4,
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: "var(--io-accent)",
                border: "2px solid var(--io-surface-primary)",
              }}
            />
            <div
              style={{
                display: "flex",
                gap: "var(--io-space-3)",
                alignItems: "baseline",
                flexWrap: "wrap",
              }}
            >
              <Badge color="accent">
                {TARGET_TYPE_LABELS[snap.target_type] ?? snap.target_type}
              </Badge>
              {snap.label && (
                <span
                  style={{
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "var(--io-text-primary)",
                  }}
                >
                  {snap.label}
                </span>
              )}
              <span
                style={{
                  fontSize: "11px",
                  color: "var(--io-text-muted)",
                  fontFamily: "monospace",
                }}
              >
                {fmtDate(snap.created_at)}
              </span>
              <span
                style={{ fontSize: "12px", color: "var(--io-text-secondary)" }}
              >
                {snap.row_count} row{snap.row_count !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

type Tab = "bulk-update" | "snapshots" | "history";

export default function BulkUpdate() {
  const [tab, setTab] = useState<Tab>("bulk-update");

  const tabs: { id: Tab; label: string }[] = [
    { id: "bulk-update", label: "Bulk Update" },
    { id: "snapshots", label: "Snapshots" },
    { id: "history", label: "History" },
  ];

  return (
    <SettingsPageLayout
      title="Bulk Update & Change Snapshots"
      description="Download, edit, and reimport configuration data in bulk. Create and restore point-in-time snapshots."
      variant="list"
    >
      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          gap: 0,
          borderBottom: "1px solid var(--io-border)",
          marginBottom: "var(--io-space-5)",
        }}
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: "8px 20px",
              border: "none",
              borderBottom:
                tab === t.id
                  ? "2px solid var(--io-accent)"
                  : "2px solid transparent",
              background: "none",
              color: tab === t.id ? "var(--io-accent)" : "var(--io-text-muted)",
              fontWeight: tab === t.id ? 600 : 400,
              fontSize: "13px",
              cursor: "pointer",
              transition: "color 0.15s, border-color 0.15s",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "bulk-update" && <BulkUpdateTab />}
      {tab === "snapshots" && <SnapshotsTab />}
      {tab === "history" && <HistoryTab />}
    </SettingsPageLayout>
  );
}
