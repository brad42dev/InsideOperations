import React, { useState, useMemo, useRef, useEffect } from "react";
import { useContextMenu } from "../../shared/hooks/useContextMenu";
import ContextMenu from "../../shared/components/ContextMenu";
import * as Dialog from "@radix-ui/react-dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  inputStyle,
  labelStyle,
  btnPrimary,
  btnSecondary,
  btnSmall,
} from "./settingsStyles";
import {
  pointConfigApi,
  pointSourcesApi,
  AGG_AVERAGING,
  AGG_SUM,
  AGG_ACCUMULATION,
  type PointConfig,
  type UpdatePointConfigRequest,
  type PointMetadataVersion,
} from "../../api/points";
import { expressionsApi, type SavedExpression } from "../../api/expressions";
import { ExpressionBuilder } from "../../shared/components/expression/ExpressionBuilder";
import { ExportButton } from "../../shared/components/ExportDialog";

// ---------------------------------------------------------------------------
// Aggregation bitmask helpers
// ---------------------------------------------------------------------------

function hasAgg(mask: number, bit: number): boolean {
  return (mask & bit) !== 0;
}

function setAgg(mask: number, bit: number, on: boolean): number {
  return on ? mask | bit : mask & ~bit;
}

// ---------------------------------------------------------------------------
// Column definitions for export
// ---------------------------------------------------------------------------

const POINTS_COLUMNS = [
  { id: "tag_name", label: "Tag Name" },
  { id: "display_name", label: "Display Name" },
  { id: "source_name", label: "Source" },
  { id: "area", label: "Area" },
  { id: "criticality", label: "Criticality" },
  { id: "active", label: "Active" },
  { id: "data_type", label: "Data Type" },
  { id: "unit", label: "Unit" },
  { id: "aggregation_types", label: "Aggregation Types" },
  { id: "write_frequency_seconds", label: "Write Frequency (s)" },
  { id: "barcode", label: "Barcode" },
  { id: "notes", label: "Notes" },
];

const DEFAULT_VISIBLE_COLUMNS = [
  "tag_name",
  "source_name",
  "area",
  "criticality",
  "active",
  "aggregation_types",
];

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------

const btnSmallDanger: React.CSSProperties = {
  ...btnSmall,
  border: "1px solid var(--io-danger)",
  color: "var(--io-danger)",
};

const thStyle: React.CSSProperties = {
  padding: "10px 12px",
  textAlign: "left",
  fontSize: "11px",
  fontWeight: 600,
  color: "var(--io-text-muted)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  whiteSpace: "nowrap",
  userSelect: "none",
};

const tdStyle: React.CSSProperties = {
  padding: "10px 12px",
  fontSize: "13px",
  color: "var(--io-text-secondary)",
  verticalAlign: "middle",
};

// ---------------------------------------------------------------------------
// ErrorBanner
// ---------------------------------------------------------------------------

function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      style={{
        background: "var(--io-danger-subtle)",
        border: "1px solid var(--io-danger)",
        borderRadius: "var(--io-radius)",
        padding: "10px 14px",
        color: "var(--io-danger)",
        fontSize: "13px",
        marginBottom: "14px",
      }}
    >
      {message}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Criticality badge
// ---------------------------------------------------------------------------

const CRITICALITY_COLORS: Record<string, { bg: string; color: string }> = {
  safety_critical: { bg: "var(--io-danger-subtle)", color: "var(--io-danger)" },
  environmental: { bg: "var(--io-success-subtle)", color: "var(--io-success)" },
  production: { bg: "var(--io-warning-subtle)", color: "var(--io-warning)" },
  informational: {
    bg: "var(--io-surface-tertiary)",
    color: "var(--io-text-muted)",
  },
};

const CRITICALITY_LABELS: Record<string, string> = {
  safety_critical: "Safety Critical",
  environmental: "Environmental",
  production: "Production",
  informational: "Informational",
};

function CriticalityBadge({ value }: { value: string | null }) {
  if (!value) return <span style={{ color: "var(--io-text-muted)" }}>—</span>;
  const style = CRITICALITY_COLORS[value] ?? {
    bg: "var(--io-surface-secondary)",
    color: "var(--io-text-muted)",
  };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: "100px",
        fontSize: "11px",
        fontWeight: 600,
        background: style.bg,
        color: style.color,
      }}
    >
      {CRITICALITY_LABELS[value] ?? value}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Aggregation badges
// ---------------------------------------------------------------------------

function AggBadges({ mask }: { mask: number }) {
  const flags = [
    { bit: AGG_AVERAGING, label: "Avg" },
    { bit: AGG_SUM, label: "Sum" },
    { bit: AGG_ACCUMULATION, label: "Acc" },
  ];
  const active = flags.filter((f) => hasAgg(mask, f.bit));
  if (active.length === 0)
    return (
      <span style={{ color: "var(--io-text-muted)", fontSize: "12px" }}>
        none
      </span>
    );
  return (
    <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
      {active.map((f) => (
        <span
          key={f.bit}
          style={{
            display: "inline-block",
            padding: "2px 6px",
            borderRadius: "4px",
            fontSize: "11px",
            fontWeight: 600,
            background: "var(--io-accent-subtle)",
            color: "var(--io-accent)",
          }}
        >
          {f.label}
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Active badge
// ---------------------------------------------------------------------------

function ActiveBadge({ active }: { active: boolean }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        fontSize: "12px",
        color: active ? "var(--io-success)" : "var(--io-text-muted)",
      }}
    >
      <span
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          background: active ? "var(--io-success)" : "var(--io-text-muted)",
          display: "inline-block",
        }}
      />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Table skeleton loader
// ---------------------------------------------------------------------------

function TableSkeleton({ cols, rows = 8 }: { cols: number; rows?: number }) {
  return (
    <tbody>
      {Array.from({ length: rows }).map((_, ri) => (
        <tr
          key={ri}
          style={{ borderBottom: "1px solid var(--io-border-subtle)" }}
        >
          {Array.from({ length: cols }).map((_, ci) => (
            <td key={ci} style={{ padding: "12px" }}>
              <div
                style={{
                  height: "12px",
                  borderRadius: "4px",
                  background: "var(--io-surface-secondary)",
                  width: ci === 0 ? "140px" : ci === 1 ? "90px" : "70px",
                  animation: "pulse 1.4s ease-in-out infinite",
                }}
              />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

// ---------------------------------------------------------------------------
// Deactivate / Reactivate confirmation dialog
// ---------------------------------------------------------------------------

function LifecycleDialog({
  point,
  open,
  onOpenChange,
  onConfirm,
  isPending,
}: {
  point: PointConfig | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onConfirm: () => void;
  isPending: boolean;
}) {
  if (!point) return null;
  const isDeactivate = point.active;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: "fixed",
            inset: 0,
            background: "var(--io-overlay, rgba(0,0,0,0.5))",
            zIndex: 200,
          }}
        />
        <Dialog.Content
          aria-describedby={undefined}
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%,-50%)",
            background: "var(--io-surface-elevated)",
            border: "1px solid var(--io-border)",
            borderRadius: "10px",
            padding: "24px",
            width: "440px",
            maxWidth: "95vw",
            zIndex: 201,
            boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
          }}
        >
          <Dialog.Title
            style={{
              margin: "0 0 12px",
              fontSize: "16px",
              fontWeight: 600,
              color: "var(--io-text-primary)",
            }}
          >
            {isDeactivate ? "Deactivate Point" : "Reactivate Point"}
          </Dialog.Title>
          {isDeactivate ? (
            <p
              style={{
                margin: "0 0 24px",
                fontSize: "14px",
                color: "var(--io-text-secondary)",
                lineHeight: 1.55,
              }}
            >
              This will hide{" "}
              <strong style={{ color: "var(--io-text-primary)" }}>
                {point.tag_name}
              </strong>{" "}
              from operational views. It can be reactivated later.
            </p>
          ) : (
            <p
              style={{
                margin: "0 0 24px",
                fontSize: "14px",
                color: "var(--io-text-secondary)",
                lineHeight: 1.55,
              }}
            >
              Reactivate{" "}
              <strong style={{ color: "var(--io-text-primary)" }}>
                {point.tag_name}
              </strong>{" "}
              and restore it to operational views?
            </p>
          )}
          <div
            style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}
          >
            <Dialog.Close asChild>
              <button type="button" style={btnSecondary}>
                Cancel
              </button>
            </Dialog.Close>
            <button
              style={
                isDeactivate
                  ? {
                      padding: "8px 16px",
                      background: "var(--io-danger)",
                      color: "var(--io-text-on-accent)",
                      border: "none",
                      borderRadius: "var(--io-radius)",
                      fontSize: "13px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }
                  : btnPrimary
              }
              disabled={isPending}
              onClick={onConfirm}
            >
              {isPending
                ? isDeactivate
                  ? "Deactivating..."
                  : "Reactivating..."
                : isDeactivate
                  ? "Deactivate"
                  : "Reactivate"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ---------------------------------------------------------------------------
// Metadata version history tab content
// ---------------------------------------------------------------------------

function HistoryTab({ pointId }: { pointId: string }) {
  const query = useQuery({
    queryKey: ["point-metadata-versions", pointId],
    queryFn: async () => {
      const result = await pointConfigApi.getMetadataVersions(pointId);
      if (!result.success) throw new Error(result.error.message);
      return result.data as PointMetadataVersion[];
    },
  });

  if (query.isLoading) {
    return (
      <div
        style={{
          padding: "20px",
          textAlign: "center",
          color: "var(--io-text-muted)",
          fontSize: "13px",
        }}
      >
        Loading history...
      </div>
    );
  }

  if (query.isError) {
    return (
      <ErrorBanner
        message={
          query.error instanceof Error
            ? query.error.message
            : "Failed to load history"
        }
      />
    );
  }

  const versions = query.data ?? [];

  if (versions.length === 0) {
    return (
      <div
        style={{
          padding: "32px",
          textAlign: "center",
          color: "var(--io-text-muted)",
          fontSize: "13px",
        }}
      >
        No version history recorded for this point.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {versions.map((v) => (
        <div
          key={v.id}
          style={{
            background: "var(--io-surface-sunken)",
            border: "1px solid var(--io-border)",
            borderRadius: "6px",
            padding: "10px 14px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "6px",
            }}
          >
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                color: "var(--io-text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Version {v.version}
            </span>
            <span style={{ fontSize: "11px", color: "var(--io-text-muted)" }}>
              {new Date(v.changed_at).toLocaleString()}
              {v.changed_by ? ` · ${v.changed_by}` : ""}
            </span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
            {Object.entries(v.changes).map(([field, change]) => (
              <div
                key={field}
                style={{ fontSize: "12px", color: "var(--io-text-secondary)" }}
              >
                <span
                  style={{ fontWeight: 500, color: "var(--io-text-primary)" }}
                >
                  {field}
                </span>
                {": "}
                <span
                  style={{
                    color: "var(--io-danger)",
                    textDecoration: "line-through",
                    marginRight: "4px",
                  }}
                >
                  {change.old == null ? "null" : String(change.old)}
                </span>
                <span style={{ color: "var(--io-success)" }}>
                  {change.new == null ? "null" : String(change.new)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Point config dialog — tabbed panel
// ---------------------------------------------------------------------------

type ConfigTab =
  | "general"
  | "aggregation"
  | "location"
  | "conversion"
  | "history";

function PointConfigDialog({
  point,
  open,
  onOpenChange,
}: {
  point: PointConfig | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<ConfigTab>("general");
  const [form, setForm] = useState<UpdatePointConfigRequest>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [expressionBuilderOpen, setExpressionBuilderOpen] = useState(false);
  const [expressionInfo, setExpressionInfo] = useState<{
    id: string;
    name: string;
  } | null>(null);

  // Reset form when point changes
  useEffect(() => {
    if (point && open) {
      setForm({
        active: point.active,
        criticality: point.criticality,
        area: point.area ?? "",
        barcode: point.barcode ?? "",
        notes: point.notes ?? "",
        write_frequency_seconds: point.write_frequency_seconds,
        aggregation_types: point.aggregation_types,
        gps_latitude: point.gps_latitude,
        gps_longitude: point.gps_longitude,
        default_graphic_id: point.default_graphic_id,
        custom_expression_id: point.custom_expression_id,
      });
      setExpressionInfo(
        point.custom_expression_id && point.custom_expression_name
          ? {
              id: point.custom_expression_id,
              name: point.custom_expression_name,
            }
          : null,
      );
      setFormError(null);
      setTab("general");
    }
  }, [point, open]);

  const updateMutation = useMutation({
    mutationFn: (req: UpdatePointConfigRequest) =>
      pointConfigApi.update(point!.id, req),
    onSuccess: (result) => {
      if (!result.success) {
        setFormError(result.error.message);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["points-config"] });
      onOpenChange(false);
    },
  });

  if (!point) return null;

  function handleSave() {
    setFormError(null);
    updateMutation.mutate(form);
  }

  const aggMask = form.aggregation_types ?? 0;

  const TABS: { id: ConfigTab; label: string }[] = [
    { id: "general", label: "General" },
    { id: "aggregation", label: "Aggregation" },
    { id: "location", label: "Location" },
    { id: "conversion", label: "Conversion" },
    { id: "history", label: "History" },
  ];

  return (
    <>
      <Dialog.Root open={open} onOpenChange={onOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay
            style={{
              position: "fixed",
              inset: 0,
              background: "var(--io-overlay, rgba(0,0,0,0.5))",
              zIndex: 200,
            }}
          />
          <Dialog.Content
            aria-describedby={undefined}
            style={{
              position: "fixed",
              top: "50%",
              left: "50%",
              transform: "translate(-50%,-50%)",
              background: "var(--io-surface-elevated)",
              border: "1px solid var(--io-border)",
              borderRadius: "10px",
              padding: "24px",
              width: "560px",
              maxWidth: "95vw",
              maxHeight: "90vh",
              overflowY: "auto",
              zIndex: 201,
              boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
            }}
          >
            {/* Header */}
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "space-between",
                marginBottom: "16px",
              }}
            >
              <div>
                <Dialog.Title
                  style={{
                    margin: "0 0 2px",
                    fontSize: "16px",
                    fontWeight: 600,
                    color: "var(--io-text-primary)",
                  }}
                >
                  Configure Point
                </Dialog.Title>
                <div
                  style={{
                    fontSize: "12px",
                    color: "var(--io-text-muted)",
                    fontFamily: "monospace",
                  }}
                >
                  {point.tag_name}
                </div>
              </div>
              <Dialog.Close asChild>
                <button
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--io-text-muted)",
                    cursor: "pointer",
                    fontSize: "18px",
                    lineHeight: 1,
                    marginTop: "2px",
                  }}
                  aria-label="Close"
                >
                  &#x2715;
                </button>
              </Dialog.Close>
            </div>

            {/* Tabs */}
            <div
              style={{
                display: "flex",
                borderBottom: "1px solid var(--io-border)",
                marginBottom: "20px",
                gap: "2px",
              }}
            >
              {TABS.map((t) => (
                <button
                  key={t.id}
                  style={{
                    padding: "6px 14px",
                    background: "none",
                    border: "none",
                    borderBottom:
                      tab === t.id
                        ? "2px solid var(--io-accent)"
                        : "2px solid transparent",
                    color:
                      tab === t.id
                        ? "var(--io-text-primary)"
                        : "var(--io-text-muted)",
                    fontSize: "13px",
                    fontWeight: tab === t.id ? 600 : 400,
                    cursor: "pointer",
                    marginBottom: "-1px",
                    paddingBottom: "8px",
                  }}
                  onClick={() => setTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {formError && <ErrorBanner message={formError} />}

            {/* Tab: General */}
            {tab === "general" && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px",
                }}
              >
                {/* Active toggle */}
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    cursor: "pointer",
                    fontSize: "13px",
                    color: "var(--io-text-primary)",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={form.active ?? false}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, active: e.target.checked }))
                    }
                    style={{
                      accentColor: "var(--io-accent)",
                      width: "15px",
                      height: "15px",
                    }}
                  />
                  <div>
                    <div style={{ fontWeight: 500 }}>Active</div>
                    <div
                      style={{
                        fontSize: "11px",
                        color: "var(--io-text-muted)",
                        marginTop: "1px",
                      }}
                    >
                      Inactive points are hidden from operational views
                    </div>
                  </div>
                </label>

                {/* Criticality */}
                <div>
                  <label style={labelStyle}>Criticality</label>
                  <select
                    style={{
                      ...inputStyle,
                      cursor: "pointer",
                    }}
                    value={form.criticality ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        criticality:
                          e.target.value === ""
                            ? null
                            : (e.target
                                .value as UpdatePointConfigRequest["criticality"]),
                      }))
                    }
                  >
                    <option value="">— Not set —</option>
                    <option value="safety_critical">Safety Critical</option>
                    <option value="environmental">Environmental</option>
                    <option value="production">Production</option>
                    <option value="informational">Informational</option>
                  </select>
                </div>

                {/* Area */}
                <div>
                  <label style={labelStyle}>Area</label>
                  <input
                    style={inputStyle}
                    value={form.area ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, area: e.target.value || null }))
                    }
                    placeholder="e.g. Unit 5, Boiler Area"
                  />
                </div>

                {/* Write frequency */}
                <div>
                  <label style={labelStyle}>Write Frequency (seconds)</label>
                  <input
                    style={inputStyle}
                    type="number"
                    min={0}
                    step={1}
                    value={form.write_frequency_seconds ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        write_frequency_seconds:
                          e.target.value === "" ? null : Number(e.target.value),
                      }))
                    }
                    placeholder="Leave blank for default"
                  />
                </div>
              </div>
            )}

            {/* Tab: Aggregation */}
            {tab === "aggregation" && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px",
                }}
              >
                <div
                  style={{
                    padding: "10px 12px",
                    background: "var(--io-surface-sunken)",
                    border: "1px solid var(--io-border)",
                    borderRadius: "var(--io-radius)",
                    fontSize: "12px",
                    color: "var(--io-text-muted)",
                    lineHeight: 1.55,
                  }}
                >
                  <strong style={{ color: "var(--io-text-secondary)" }}>
                    Note:
                  </strong>{" "}
                  min, max, and count aggregations are always available for all
                  points. The toggles below control which additional operations
                  are semantically meaningful for this point.
                </div>

                {[
                  {
                    bit: AGG_AVERAGING,
                    label: "Allow Averaging",
                    description: "Value can be meaningfully averaged over time",
                  },
                  {
                    bit: AGG_SUM,
                    label: "Allow Sum / Totaling",
                    description: "Value can be meaningfully summed over time",
                  },
                  {
                    bit: AGG_ACCUMULATION,
                    label: "Allow Accumulation",
                    description:
                      "Value represents a running total or accumulator",
                  },
                ].map(({ bit, label, description }) => (
                  <label
                    key={bit}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "10px",
                      cursor: "pointer",
                      padding: "10px 12px",
                      background: hasAgg(aggMask, bit)
                        ? "rgba(var(--io-accent-rgb, 234,179,8),0.08)"
                        : "var(--io-surface-secondary)",
                      border: `1px solid ${hasAgg(aggMask, bit) ? "rgba(var(--io-accent-rgb, 234,179,8),0.3)" : "var(--io-border)"}`,
                      borderRadius: "var(--io-radius)",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={hasAgg(aggMask, bit)}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          aggregation_types: setAgg(
                            aggMask,
                            bit,
                            e.target.checked,
                          ),
                        }))
                      }
                      style={{
                        accentColor: "var(--io-accent)",
                        width: "14px",
                        height: "14px",
                        marginTop: "2px",
                        flexShrink: 0,
                      }}
                    />
                    <div>
                      <div
                        style={{
                          fontSize: "13px",
                          fontWeight: 500,
                          color: "var(--io-text-primary)",
                        }}
                      >
                        {label}
                      </div>
                      <div
                        style={{
                          fontSize: "12px",
                          color: "var(--io-text-muted)",
                          marginTop: "2px",
                        }}
                      >
                        {description}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            )}

            {/* Tab: Location */}
            {tab === "location" && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px",
                }}
              >
                <div style={{ display: "flex", gap: "12px" }}>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>GPS Latitude</label>
                    <input
                      style={inputStyle}
                      type="number"
                      step="any"
                      value={form.gps_latitude ?? ""}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          gps_latitude:
                            e.target.value === ""
                              ? null
                              : Number(e.target.value),
                        }))
                      }
                      placeholder="e.g. 51.5074"
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={labelStyle}>GPS Longitude</label>
                    <input
                      style={inputStyle}
                      type="number"
                      step="any"
                      value={form.gps_longitude ?? ""}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          gps_longitude:
                            e.target.value === ""
                              ? null
                              : Number(e.target.value),
                        }))
                      }
                      placeholder="e.g. -0.1278"
                    />
                  </div>
                </div>
                <div>
                  <label style={labelStyle}>Barcode</label>
                  <input
                    style={inputStyle}
                    value={form.barcode ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        barcode: e.target.value || null,
                      }))
                    }
                    placeholder="Equipment barcode or QR code value"
                  />
                </div>
                <div>
                  <label style={labelStyle}>Notes</label>
                  <textarea
                    style={{
                      ...inputStyle,
                      minHeight: "80px",
                      resize: "vertical",
                      fontFamily: "inherit",
                    }}
                    value={form.notes ?? ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, notes: e.target.value || null }))
                    }
                    placeholder="Internal notes about this point"
                  />
                </div>
              </div>
            )}

            {/* Tab: Conversion */}
            {tab === "conversion" && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px",
                }}
              >
                <div
                  style={{
                    fontSize: "13px",
                    color: "var(--io-text-secondary)",
                    lineHeight: 1.55,
                  }}
                >
                  A custom conversion expression transforms the raw OPC value
                  before it is stored. Leave unset to use the raw value.
                </div>

                {expressionInfo ? (
                  <div
                    style={{
                      padding: "12px 14px",
                      background: "var(--io-surface-sunken)",
                      border: "1px solid var(--io-border)",
                      borderRadius: "var(--io-radius)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "10px",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: "13px",
                          fontWeight: 500,
                          color: "var(--io-text-primary)",
                        }}
                      >
                        {expressionInfo.name}
                      </div>
                      <div
                        style={{
                          fontSize: "11px",
                          color: "var(--io-text-muted)",
                          marginTop: "2px",
                        }}
                      >
                        Custom conversion expression active
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                      <button
                        style={btnSmall}
                        onClick={() => setExpressionBuilderOpen(true)}
                      >
                        Edit
                      </button>
                      <button
                        style={btnSmallDanger}
                        onClick={() => {
                          setExpressionInfo(null);
                          setForm((f) => ({
                            ...f,
                            custom_expression_id: null,
                          }));
                        }}
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    style={{
                      ...btnSecondary,
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      width: "fit-content",
                    }}
                    onClick={() => setExpressionBuilderOpen(true)}
                  >
                    + Custom Conversion
                  </button>
                )}
              </div>
            )}

            {/* Tab: History */}
            {tab === "history" && <HistoryTab pointId={point.id} />}

            {/* Footer — only show save on editable tabs */}
            {tab !== "history" && (
              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: "8px",
                  marginTop: "24px",
                  paddingTop: "16px",
                  borderTop: "1px solid var(--io-border)",
                }}
              >
                <Dialog.Close asChild>
                  <button type="button" style={btnSecondary}>
                    Cancel
                  </button>
                </Dialog.Close>
                <button
                  type="button"
                  style={btnPrimary}
                  disabled={updateMutation.isPending}
                  onClick={handleSave}
                >
                  {updateMutation.isPending ? "Saving..." : "Save Changes"}
                </button>
              </div>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Expression Builder modal */}
      {expressionBuilderOpen && (
        <Dialog.Root
          open={expressionBuilderOpen}
          onOpenChange={setExpressionBuilderOpen}
        >
          <Dialog.Portal>
            <Dialog.Overlay
              style={{
                position: "fixed",
                inset: 0,
                background: "var(--io-overlay, rgba(0,0,0,0.5))",
                zIndex: 210,
              }}
            />
            <Dialog.Content
              style={{
                position: "fixed",
                top: "50%",
                left: "50%",
                transform: "translate(-50%,-50%)",
                background: "var(--io-surface-elevated)",
                border: "1px solid var(--io-border)",
                borderRadius: "10px",
                padding: "24px",
                width: "min(900px, 96vw)",
                maxHeight: "92vh",
                overflowY: "auto",
                zIndex: 211,
                boxShadow: "0 24px 80px rgba(0,0,0,0.5)",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}
              aria-describedby={undefined}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexShrink: 0,
                }}
              >
                <Dialog.Title
                  style={{
                    margin: 0,
                    fontSize: "16px",
                    fontWeight: 600,
                    color: "var(--io-text-primary)",
                  }}
                >
                  Custom Conversion — {point.tag_name}
                </Dialog.Title>
                <Dialog.Close asChild>
                  <button
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--io-text-muted)",
                      cursor: "pointer",
                      fontSize: "18px",
                      lineHeight: 1,
                    }}
                    aria-label="Close"
                  >
                    &#x2715;
                  </button>
                </Dialog.Close>
              </div>
              <ExpressionBuilder
                context="point_config"
                contextLabel="Point Conversion"
                onApply={async (ast) => {
                  // Save expression and link it to the point
                  const saveResult = await expressionsApi.create({
                    name: `Conversion: ${point.tag_name}`,
                    description: `Custom conversion for ${point.tag_name}`,
                    context: "point_config",
                    ast,
                    is_shared: false,
                  });
                  if (saveResult.success) {
                    const expr = saveResult.data as SavedExpression;
                    setExpressionInfo({ id: expr.id, name: expr.name });
                    setForm((f) => ({ ...f, custom_expression_id: expr.id }));
                  }
                  setExpressionBuilderOpen(false);
                }}
                onCancel={() => setExpressionBuilderOpen(false)}
              />
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Bulk aggregation toolbar
// ---------------------------------------------------------------------------

function BulkAggregationBar({
  selectedCount,
  onApply,
  isPending,
}: {
  selectedCount: number;
  onApply: (mask: number) => void;
  isPending: boolean;
}) {
  const [mask, setMask] = useState(0);

  if (selectedCount === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "16px",
        padding: "10px 14px",
        background: "rgba(var(--io-accent-rgb, 234,179,8),0.08)",
        border: "1px solid rgba(var(--io-accent-rgb, 234,179,8),0.25)",
        borderRadius: "var(--io-radius)",
        marginBottom: "12px",
        flexWrap: "wrap",
      }}
    >
      <span
        style={{
          fontSize: "13px",
          color: "var(--io-text-secondary)",
          fontWeight: 500,
        }}
      >
        {selectedCount} point{selectedCount !== 1 ? "s" : ""} selected
      </span>
      <div
        style={{
          display: "flex",
          gap: "10px",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        {[
          { bit: AGG_AVERAGING, label: "Allow Averaging" },
          { bit: AGG_SUM, label: "Allow Sum" },
          { bit: AGG_ACCUMULATION, label: "Allow Accumulation" },
        ].map(({ bit, label }) => (
          <label
            key={bit}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "5px",
              cursor: "pointer",
              fontSize: "12px",
              color: "var(--io-text-secondary)",
            }}
          >
            <input
              type="checkbox"
              checked={hasAgg(mask, bit)}
              onChange={(e) => setMask((m) => setAgg(m, bit, e.target.checked))}
              style={{ accentColor: "var(--io-accent)" }}
            />
            {label}
          </label>
        ))}
      </div>
      <button
        style={{
          ...btnPrimary,
          padding: "6px 14px",
          fontSize: "12px",
          marginLeft: "auto",
        }}
        disabled={isPending}
        onClick={() => onApply(mask)}
      >
        {isPending ? "Applying..." : "Apply to Selected"}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main PointManagement page
// ---------------------------------------------------------------------------

const PAGE_SIZE = 100;

export default function PointManagement() {
  const queryClient = useQueryClient();

  // Filters
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<
    "active" | "inactive" | "all"
  >("active");
  const [sourceFilter, setSourceFilter] = useState<string>("");
  const [areaFilter, setAreaFilter] = useState("");

  // Debounce search input
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(
      () => setDebouncedSearch(search),
      300,
    );
    return () => {
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    };
  }, [search]);

  // Pagination
  const [page, setPage] = useState(1);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Config panel
  const [configPoint, setConfigPoint] = useState<PointConfig | null>(null);
  const [configOpen, setConfigOpen] = useState(false);

  // Lifecycle dialog
  const [lifecyclePoint, setLifecyclePoint] = useState<PointConfig | null>(
    null,
  );
  const [lifecycleOpen, setLifecycleOpen] = useState(false);

  // Banner error
  const [bannerError, setBannerError] = useState<string | null>(null);
  const { menuState, handleContextMenu, closeMenu } = useContextMenu<PointConfig>();

  // Build query params
  const queryParams = useMemo(() => {
    const p: Parameters<typeof pointConfigApi.list>[0] = {
      page,
      limit: PAGE_SIZE,
    };
    if (debouncedSearch) p.search = debouncedSearch;
    if (sourceFilter) p.source_id = sourceFilter;
    if (areaFilter) p.area = areaFilter;
    if (activeFilter !== "all") p.active = activeFilter === "active";
    return p;
  }, [page, debouncedSearch, sourceFilter, areaFilter, activeFilter]);

  // Data queries
  const pointsQuery = useQuery({
    queryKey: ["points-config", queryParams],
    queryFn: async () => {
      const result = await pointConfigApi.list(queryParams);
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
  });

  const sourcesQuery = useQuery({
    queryKey: ["point-sources"],
    queryFn: async () => {
      const result = await pointSourcesApi.list();
      if (!result.success) throw new Error(result.error.message);
      return result.data.data;
    },
  });

  const points = pointsQuery.data?.data ?? [];
  const pagination = pointsQuery.data?.pagination;
  const sources = sourcesQuery.data ?? [];

  // Mutations
  const lifecycleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      active ? pointConfigApi.deactivate(id) : pointConfigApi.reactivate(id),
    onSuccess: (result) => {
      if (!result.success) {
        setBannerError(result.error.message);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["points-config"] });
      setLifecycleOpen(false);
      setLifecyclePoint(null);
    },
    onError: (err) => {
      setBannerError(err instanceof Error ? err.message : "Operation failed");
    },
  });

  const bulkAggMutation = useMutation({
    mutationFn: ({ ids, mask }: { ids: string[]; mask: number }) =>
      pointConfigApi.bulkUpdateAggregation(ids, mask),
    onSuccess: (result) => {
      if (!result.success) {
        setBannerError(result.error.message);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["points-config"] });
      setSelectedIds(new Set());
    },
    onError: (err) => {
      setBannerError(err instanceof Error ? err.message : "Bulk update failed");
    },
  });

  // Selection helpers
  const allPageIds = useMemo(() => points.map((p) => p.id), [points]);
  const allSelected =
    allPageIds.length > 0 && allPageIds.every((id) => selectedIds.has(id));
  const someSelected = allPageIds.some((id) => selectedIds.has(id));

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        allPageIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        allPageIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, sourceFilter, areaFilter, activeFilter]);

  // Filter row
  const totalRows = pagination?.total ?? 0;
  const filteredCount = points.length;

  function openConfig(point: PointConfig) {
    setConfigPoint(point);
    setConfigOpen(true);
  }

  function openLifecycle(point: PointConfig) {
    setLifecyclePoint(point);
    setLifecycleOpen(true);
  }

  const COL_COUNT = 8; // checkbox + tag_name + source + area + criticality + active + agg + actions

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "20px",
        }}
      >
        <div>
          <h2
            style={{
              margin: "0 0 4px",
              fontSize: "18px",
              fontWeight: 600,
              color: "var(--io-text-primary)",
            }}
          >
            Points
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: "13px",
              color: "var(--io-text-muted)",
            }}
          >
            Configure per-point aggregation types, application settings, and
            lifecycle
          </p>
        </div>
        <ExportButton
          module="settings"
          entity="points"
          filteredRowCount={filteredCount}
          totalRowCount={totalRows}
          availableColumns={POINTS_COLUMNS}
          visibleColumns={DEFAULT_VISIBLE_COLUMNS}
        />
      </div>

      {bannerError && <ErrorBanner message={bannerError} />}

      {pointsQuery.isError && (
        <ErrorBanner
          message={
            pointsQuery.error instanceof Error
              ? pointsQuery.error.message
              : "Failed to load points"
          }
        />
      )}

      {/* Filter bar */}
      <div
        style={{
          display: "flex",
          gap: "10px",
          marginBottom: "12px",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        {/* Search */}
        <input
          style={{ ...inputStyle, maxWidth: "260px", flex: "1 1 180px" }}
          placeholder="Search tag name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {/* Active filter */}
        <div
          style={{
            display: "flex",
            border: "1px solid var(--io-border)",
            borderRadius: "var(--io-radius)",
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          {(["active", "inactive", "all"] as const).map((v) => (
            <button
              key={v}
              style={{
                padding: "7px 12px",
                background:
                  activeFilter === v
                    ? "var(--io-surface-secondary)"
                    : "transparent",
                border: "none",
                borderRight:
                  v !== "all" ? "1px solid var(--io-border)" : "none",
                color:
                  activeFilter === v
                    ? "var(--io-text-primary)"
                    : "var(--io-text-muted)",
                fontSize: "12px",
                fontWeight: activeFilter === v ? 600 : 400,
                cursor: "pointer",
                textTransform: "capitalize",
              }}
              onClick={() => setActiveFilter(v)}
            >
              {v}
            </button>
          ))}
        </div>

        {/* Source filter */}
        <select
          style={{
            ...inputStyle,
            maxWidth: "200px",
            flex: "0 1 160px",
            cursor: "pointer",
          }}
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
        >
          <option value="">All Sources</option>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>

        {/* Area filter */}
        <input
          style={{ ...inputStyle, maxWidth: "160px", flex: "0 1 130px" }}
          placeholder="Filter by area..."
          value={areaFilter}
          onChange={(e) => setAreaFilter(e.target.value)}
        />

        {/* Row count */}
        {pagination && (
          <span
            style={{
              fontSize: "12px",
              color: "var(--io-text-muted)",
              marginLeft: "auto",
              flexShrink: 0,
            }}
          >
            {totalRows.toLocaleString()} points
          </span>
        )}
      </div>

      {/* Bulk aggregation toolbar */}
      <BulkAggregationBar
        selectedCount={selectedIds.size}
        onApply={(mask) =>
          bulkAggMutation.mutate({ ids: Array.from(selectedIds), mask })
        }
        isPending={bulkAggMutation.isPending}
      />

      {/* Table */}
      <div
        style={{
          background: "var(--io-surface-secondary)",
          border: "1px solid var(--io-border)",
          borderRadius: "8px",
          overflow: "hidden",
          marginBottom: "16px",
        }}
      >
        <div style={{ overflowX: "auto" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              minWidth: "720px",
            }}
          >
            <thead>
              <tr
                style={{
                  borderBottom: "1px solid var(--io-border)",
                  background: "var(--io-surface-primary)",
                }}
              >
                {/* Select all checkbox */}
                <th style={{ ...thStyle, width: "40px", paddingRight: "4px" }}>
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someSelected && !allSelected;
                    }}
                    onChange={toggleSelectAll}
                    style={{
                      accentColor: "var(--io-accent)",
                      cursor: "pointer",
                    }}
                  />
                </th>
                <th style={thStyle}>Tag Name</th>
                <th style={thStyle}>Source</th>
                <th style={thStyle}>Area</th>
                <th style={thStyle}>Criticality</th>
                <th style={thStyle}>Status</th>
                <th style={thStyle}>Aggregation</th>
                <th style={{ ...thStyle, width: "150px" }}>Actions</th>
              </tr>
            </thead>
            {pointsQuery.isLoading ? (
              <TableSkeleton cols={COL_COUNT} rows={10} />
            ) : (
              <tbody>
                {points.length === 0 && !pointsQuery.isLoading && (
                  <tr>
                    <td
                      colSpan={COL_COUNT}
                      style={{
                        padding: "48px",
                        textAlign: "center",
                        color: "var(--io-text-muted)",
                        fontSize: "14px",
                      }}
                    >
                      No points found matching the current filters.
                    </td>
                  </tr>
                )}
                {points.map((point, i) => {
                  const selected = selectedIds.has(point.id);
                  return (
                    <tr
                      key={point.id}
                      onContextMenu={(e) => handleContextMenu(e, point)}
                      style={{
                        borderBottom:
                          i < points.length - 1
                            ? "1px solid var(--io-border-subtle)"
                            : undefined,
                        background: selected
                          ? "rgba(var(--io-accent-rgb, 234,179,8),0.05)"
                          : undefined,
                        cursor: "context-menu",
                      }}
                    >
                      {/* Checkbox */}
                      <td
                        style={{
                          ...tdStyle,
                          width: "40px",
                          paddingRight: "4px",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => toggleSelect(point.id)}
                          style={{
                            accentColor: "var(--io-accent)",
                            cursor: "pointer",
                          }}
                        />
                      </td>

                      {/* Tag name */}
                      <td style={tdStyle}>
                        <div
                          style={{
                            fontWeight: 500,
                            color: "var(--io-text-primary)",
                            fontSize: "13px",
                            fontFamily: "monospace",
                          }}
                        >
                          {point.tag_name}
                        </div>
                        {point.display_name && (
                          <div
                            style={{
                              fontSize: "11px",
                              color: "var(--io-text-muted)",
                              marginTop: "1px",
                            }}
                          >
                            {point.display_name}
                          </div>
                        )}
                      </td>

                      {/* Source */}
                      <td style={tdStyle}>
                        <span style={{ fontSize: "12px" }}>
                          {point.source_name ?? "—"}
                        </span>
                      </td>

                      {/* Area */}
                      <td style={tdStyle}>
                        <span style={{ fontSize: "12px" }}>
                          {point.area ?? "—"}
                        </span>
                      </td>

                      {/* Criticality */}
                      <td style={tdStyle}>
                        <CriticalityBadge value={point.criticality} />
                      </td>

                      {/* Active */}
                      <td style={tdStyle}>
                        <ActiveBadge active={point.active} />
                      </td>

                      {/* Aggregation */}
                      <td style={tdStyle}>
                        <AggBadges mask={point.aggregation_types} />
                      </td>

                      {/* Actions */}
                      <td style={tdStyle}>
                        <div style={{ display: "flex", gap: "5px" }}>
                          <button
                            style={btnSmall}
                            onClick={() => openConfig(point)}
                          >
                            Configure
                          </button>
                          {point.active ? (
                            <button
                              style={btnSmallDanger}
                              onClick={() => openLifecycle(point)}
                            >
                              Deactivate
                            </button>
                          ) : (
                            <button
                              style={{
                                ...btnSmall,
                                color: "var(--io-success)",
                                borderColor: "var(--io-success)",
                              }}
                              onClick={() => openLifecycle(point)}
                            >
                              Reactivate
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            )}
          </table>
        </div>
      </div>

      {/* Pagination */}
      {pagination && pagination.pages > 1 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            justifyContent: "center",
          }}
        >
          <button
            style={{
              ...btnSmall,
              opacity: page <= 1 ? 0.4 : 1,
              cursor: page <= 1 ? "not-allowed" : "pointer",
            }}
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </button>
          <span style={{ fontSize: "13px", color: "var(--io-text-muted)" }}>
            Page {page} of {pagination.pages}
          </span>
          <button
            style={{
              ...btnSmall,
              opacity: page >= pagination.pages ? 0.4 : 1,
              cursor: page >= pagination.pages ? "not-allowed" : "pointer",
            }}
            disabled={page >= pagination.pages}
            onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
          >
            Next
          </button>
        </div>
      )}

      {/* Dialogs */}
      <PointConfigDialog
        point={configPoint}
        open={configOpen}
        onOpenChange={(v) => {
          setConfigOpen(v);
          if (!v) setConfigPoint(null);
        }}
      />

      <LifecycleDialog
        point={lifecyclePoint}
        open={lifecycleOpen}
        onOpenChange={(v) => {
          setLifecycleOpen(v);
          if (!v) setLifecyclePoint(null);
        }}
        onConfirm={() => {
          if (lifecyclePoint) {
            lifecycleMutation.mutate({
              id: lifecyclePoint.id,
              active: lifecyclePoint.active,
            });
          }
        }}
        isPending={lifecycleMutation.isPending}
      />
      {menuState && (
        <ContextMenu
          x={menuState.x}
          y={menuState.y}
          items={[
            { label: "Configure", permission: "points:configure", onClick: () => { setConfigPoint(menuState.data!); setConfigOpen(true); closeMenu(); } },
            { label: "View History", onClick: () => { closeMenu(); } },
            { label: "Export", onClick: () => { closeMenu(); } },
            { label: "Deactivate", danger: true, divider: true, permission: "points:configure", onClick: () => { setLifecyclePoint(menuState.data!); setLifecycleOpen(true); closeMenu(); } },
          ]}
          onClose={closeMenu}
        />
      )}
    </div>
  );
}
