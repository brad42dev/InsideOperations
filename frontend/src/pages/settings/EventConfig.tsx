// ISA-18.2 alarm and event configuration — informational reference + alarm definitions CRUD
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  alarmDefinitionsApi,
  type AlarmDefinition,
  type CreateAlarmDefinitionBody,
} from "../../api/alarms";
import { expressionsApi } from "../../api/expressions";
import { ExpressionBuilderModal } from "../../shared/components/expression/ExpressionBuilderModal";
import type { ExpressionAst } from "../../shared/types/expression";

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------

const CARD: React.CSSProperties = {
  background: "var(--io-surface)",
  border: "1px solid var(--io-border)",
  borderRadius: "8px",
  padding: "var(--io-space-5)",
};

const SECTION_LABEL: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 700,
  color: "var(--io-text-muted)",
  textTransform: "uppercase" as const,
  letterSpacing: "0.07em",
  marginBottom: 8,
};

const ITEM_TITLE: React.CSSProperties = {
  fontSize: "14px",
  fontWeight: 600,
  color: "var(--io-text-primary)",
  marginBottom: 4,
};

const ITEM_DESC: React.CSSProperties = {
  fontSize: "13px",
  color: "var(--io-text-secondary)",
  lineHeight: 1.55,
  margin: 0,
};

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const CONFIG_AREAS = [
  {
    title: "Alarm Shelving Policies",
    desc: "Define the maximum shelving duration for process alarms, automatic re-alarm intervals after the shelve period expires, and per-priority shelving permission rules. Shelving follows ISA-18.2 §5.7.",
    icon: "⏱",
  },
  {
    title: "Priority Definitions",
    desc: "Configure the four-tier priority scheme (Critical/High/Medium/Low, mapped to ISA-18.2 HH/H/L/LL). Assign display colors, acknowledgement time-out targets, and escalation thresholds for each tier.",
    icon: "🔢",
  },
  {
    title: "ISA-18.2 State Machine",
    desc: "Tune the lifecycle transitions: Normal → Unacknowledged → Acknowledged → Shelved → Suppressed → Out-of-Service. Set suppression rules, out-of-service overrides, and design-mode bypass behavior.",
    icon: "🔄",
  },
  {
    title: "Dead-band and Hysteresis",
    desc: "Per-priority dead-band values prevent alarm chattering when a process variable oscillates near a trip point. Configure both absolute and percentage-of-span hysteresis per alarm class.",
    icon: "📊",
  },
  {
    title: "Event Logging Retention",
    desc: "Set how long alarm and event records are retained in the time-series store. Separate retention windows apply to active alarms, historical events, and audit trail entries.",
    icon: "🗄",
  },
  {
    title: "Operator Action Audit",
    desc: "Control which operator actions are captured in the event log: acknowledgements, shelves, suppression changes, out-of-service transitions, and forced state overrides.",
    icon: "📋",
  },
];

const PRIORITY_ROWS = [
  {
    tier: "Critical (HH)",
    color: "#ef4444",
    resp: "< 5 min",
    example: "Emergency shutdown, fire/gas trip",
  },
  {
    tier: "High (H)",
    color: "#f97316",
    resp: "< 15 min",
    example: "Process limit exceeded, equipment fault",
  },
  {
    tier: "Medium (L)",
    color: "#eab308",
    resp: "< 60 min",
    example: "Off-spec condition, maintenance required",
  },
  {
    tier: "Low (LL)",
    color: "#3b82f6",
    resp: "Next shift",
    example: "Advisory, informational",
  },
];

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Alarm definitions CRUD — expression condition support
// ---------------------------------------------------------------------------

type AlarmDialogMode = "create" | "edit";

interface AlarmDialogState {
  mode: AlarmDialogMode;
  def: AlarmDefinition | null;
}

function AlarmDefinitionsSection() {
  const queryClient = useQueryClient();

  const [dialogState, setDialogState] = useState<AlarmDialogState | null>(null);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [pendingExprId, setPendingExprId] = useState<string | null>(null);
  const [pendingExprName, setPendingExprName] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Form state for create/edit
  const [form, setForm] = useState<CreateAlarmDefinitionBody>({
    name: "",
    definition_type: "threshold",
    priority: "medium",
    enabled: true,
  });

  const listQuery = useQuery({
    queryKey: ["alarm-definitions"],
    queryFn: async () => {
      const result = await alarmDefinitionsApi.list();
      if (!result.success) throw new Error(result.error.message);
      return result.data.data as AlarmDefinition[];
    },
  });

  const createMutation = useMutation({
    mutationFn: (body: CreateAlarmDefinitionBody) =>
      alarmDefinitionsApi.create(body),
    onSuccess: (result) => {
      if (!result.success) {
        setFormError(result.error.message);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["alarm-definitions"] });
      setDialogState(null);
    },
    onError: (err) => {
      setFormError(err instanceof Error ? err.message : "Create failed");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: CreateAlarmDefinitionBody;
    }) => alarmDefinitionsApi.update(id, body),
    onSuccess: (result) => {
      if (!result.success) {
        setFormError(result.error.message);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["alarm-definitions"] });
      setDialogState(null);
    },
    onError: (err) => {
      setFormError(err instanceof Error ? err.message : "Update failed");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => alarmDefinitionsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alarm-definitions"] });
      setDeleteId(null);
    },
  });

  function openCreate() {
    setForm({
      name: "",
      definition_type: "threshold",
      priority: "medium",
      enabled: true,
    });
    setPendingExprId(null);
    setPendingExprName(null);
    setFormError(null);
    setDialogState({ mode: "create", def: null });
  }

  function openEdit(def: AlarmDefinition) {
    setForm({
      name: def.name,
      description: def.description ?? undefined,
      definition_type: def.definition_type,
      priority: def.priority,
      enabled: def.enabled,
      expression_id: def.expression_id ?? undefined,
    });
    setPendingExprId(def.expression_id);
    setPendingExprName(
      def.expression_id ? `Expression ${def.expression_id.slice(0, 8)}…` : null,
    );
    setFormError(null);
    setDialogState({ mode: "edit", def });
  }

  async function handleExprApply(ast: ExpressionAst) {
    // Save the expression to get an ID, then attach it to the form.
    const saveResult = await expressionsApi.create({
      name: form.name ? `Alarm: ${form.name}` : "Alarm expression",
      context: "alarm_definition",
      ast,
    });
    if (saveResult.success) {
      setPendingExprId(saveResult.data.id);
      setPendingExprName(saveResult.data.name);
      setForm((f) => ({ ...f, expression_id: saveResult.data.id }));
    }
    setBuilderOpen(false);
  }

  function handleSave() {
    if (!form.name.trim()) {
      setFormError("Name is required.");
      return;
    }
    if (
      form.definition_type === "expression" &&
      !form.expression_id &&
      !pendingExprId
    ) {
      setFormError("Configure an expression before saving.");
      return;
    }
    const body: CreateAlarmDefinitionBody = {
      ...form,
      expression_id: pendingExprId ?? form.expression_id,
    };
    if (dialogState?.mode === "edit" && dialogState.def) {
      updateMutation.mutate({ id: dialogState.def.id, body });
    } else {
      createMutation.mutate(body);
    }
  }

  const definitions = listQuery.data ?? [];
  const isOpen = dialogState !== null;

  return (
    <div style={{ marginBottom: "var(--io-space-6)" }}>
      {/* Section header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <div style={SECTION_LABEL}>Alarm Definitions</div>
        <button
          onClick={openCreate}
          style={{
            padding: "5px 12px",
            background: "var(--io-accent)",
            border: "none",
            borderRadius: "var(--io-radius)",
            color: "#fff",
            fontSize: "12px",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          + New Alarm Definition
        </button>
      </div>

      {/* Error / loading */}
      {listQuery.isError && (
        <div
          style={{
            padding: "10px 14px",
            background: "var(--io-danger-subtle)",
            border: "1px solid var(--io-danger)",
            borderRadius: "var(--io-radius)",
            color: "var(--io-danger)",
            fontSize: "13px",
            marginBottom: 12,
          }}
        >
          {(listQuery.error as Error).message}
        </div>
      )}

      {/* Definitions list */}
      <div style={{ ...CARD, padding: 0, overflow: "hidden" }}>
        {listQuery.isLoading ? (
          <div
            style={{
              padding: "20px",
              color: "var(--io-text-muted)",
              fontSize: "13px",
            }}
          >
            Loading…
          </div>
        ) : definitions.length === 0 ? (
          <div
            style={{
              padding: "20px",
              color: "var(--io-text-muted)",
              fontSize: "13px",
            }}
          >
            No alarm definitions yet. Create one to get started.
          </div>
        ) : (
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse" as const,
              fontSize: "13px",
            }}
          >
            <thead>
              <tr>
                {["Name", "Type", "Priority", "Enabled", "Actions"].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: "left" as const,
                      padding: "8px 14px",
                      borderBottom: "1px solid var(--io-border)",
                      color: "var(--io-text-muted)",
                      fontWeight: 600,
                      fontSize: "11px",
                      textTransform: "uppercase" as const,
                      background: "var(--io-surface-secondary)",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {definitions.map((def) => (
                <tr key={def.id}>
                  <td
                    style={{
                      padding: "9px 14px",
                      borderBottom: "1px solid var(--io-border)",
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 500,
                        color: "var(--io-text-primary)",
                      }}
                    >
                      {def.name}
                    </div>
                    {def.description && (
                      <div
                        style={{
                          fontSize: "12px",
                          color: "var(--io-text-muted)",
                        }}
                      >
                        {def.description}
                      </div>
                    )}
                  </td>
                  <td
                    style={{
                      padding: "9px 14px",
                      borderBottom: "1px solid var(--io-border)",
                    }}
                  >
                    <span
                      style={{
                        padding: "2px 8px",
                        borderRadius: "100px",
                        fontSize: "11px",
                        fontWeight: 600,
                        background:
                          def.definition_type === "expression"
                            ? "var(--io-accent-subtle)"
                            : "var(--io-surface-secondary)",
                        color:
                          def.definition_type === "expression"
                            ? "var(--io-accent)"
                            : "var(--io-text-secondary)",
                      }}
                    >
                      {def.definition_type}
                    </span>
                  </td>
                  <td
                    style={{
                      padding: "9px 14px",
                      borderBottom: "1px solid var(--io-border)",
                      color: "var(--io-text-secondary)",
                    }}
                  >
                    {def.priority}
                  </td>
                  <td
                    style={{
                      padding: "9px 14px",
                      borderBottom: "1px solid var(--io-border)",
                      color: def.enabled
                        ? "var(--io-success)"
                        : "var(--io-text-muted)",
                      fontSize: "12px",
                    }}
                  >
                    {def.enabled ? "Yes" : "No"}
                  </td>
                  <td
                    style={{
                      padding: "9px 14px",
                      borderBottom: "1px solid var(--io-border)",
                    }}
                  >
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={() => openEdit(def)}
                        style={{
                          padding: "3px 10px",
                          background: "transparent",
                          border: "1px solid var(--io-border)",
                          borderRadius: "var(--io-radius)",
                          color: "var(--io-text-secondary)",
                          fontSize: "12px",
                          cursor: "pointer",
                        }}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeleteId(def.id)}
                        style={{
                          padding: "3px 10px",
                          background: "transparent",
                          border: "1px solid var(--io-danger)",
                          borderRadius: "var(--io-radius)",
                          color: "var(--io-danger)",
                          fontSize: "12px",
                          cursor: "pointer",
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Create / Edit dialog */}
      {isOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setDialogState(null);
          }}
        >
          <div
            style={{
              background: "var(--io-surface-elevated)",
              border: "1px solid var(--io-border)",
              borderRadius: "10px",
              padding: "24px",
              width: "min(520px, 95vw)",
              display: "flex",
              flexDirection: "column",
              gap: "14px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
            }}
          >
            <h3
              style={{
                margin: 0,
                fontSize: "16px",
                fontWeight: 600,
                color: "var(--io-text-primary)",
              }}
            >
              {dialogState.mode === "create"
                ? "New Alarm Definition"
                : "Edit Alarm Definition"}
            </h3>

            {formError && (
              <div
                style={{
                  padding: "8px 12px",
                  background: "var(--io-danger-subtle)",
                  border: "1px solid var(--io-danger)",
                  borderRadius: "var(--io-radius)",
                  color: "var(--io-danger)",
                  fontSize: "12px",
                }}
              >
                {formError}
              </div>
            )}

            {/* Name */}
            <div>
              <label
                style={{
                  fontSize: "12px",
                  color: "var(--io-text-muted)",
                  fontWeight: 600,
                }}
              >
                Name *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                style={{
                  display: "block",
                  width: "100%",
                  marginTop: 4,
                  padding: "7px 10px",
                  background: "var(--io-surface-sunken)",
                  border: "1px solid var(--io-border)",
                  borderRadius: "var(--io-radius)",
                  color: "var(--io-text-primary)",
                  fontSize: "13px",
                  boxSizing: "border-box" as const,
                }}
              />
            </div>

            {/* Type */}
            <div>
              <label
                style={{
                  fontSize: "12px",
                  color: "var(--io-text-muted)",
                  fontWeight: 600,
                }}
              >
                Condition Type
              </label>
              <select
                value={form.definition_type}
                onChange={(e) => {
                  setForm((f) => ({
                    ...f,
                    definition_type: e.target.value as
                      | "threshold"
                      | "expression",
                  }));
                }}
                style={{
                  display: "block",
                  width: "100%",
                  marginTop: 4,
                  padding: "7px 10px",
                  background: "var(--io-surface-sunken)",
                  border: "1px solid var(--io-border)",
                  borderRadius: "var(--io-radius)",
                  color: "var(--io-text-primary)",
                  fontSize: "13px",
                }}
              >
                <option value="threshold">Threshold</option>
                <option value="expression">Expression</option>
              </select>
            </div>

            {/* Expression condition — shown when type = "expression" */}
            {form.definition_type === "expression" && (
              <div
                style={{
                  padding: "12px",
                  background: "var(--io-surface-secondary)",
                  border: "1px solid var(--io-border)",
                  borderRadius: "var(--io-radius)",
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      fontSize: "12px",
                      fontWeight: 600,
                      color: "var(--io-text-secondary)",
                    }}
                  >
                    Expression Condition
                  </div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "var(--io-text-muted)",
                      marginTop: 2,
                    }}
                  >
                    {pendingExprName
                      ? `Configured: ${pendingExprName}`
                      : "No expression configured"}
                  </div>
                </div>
                <button
                  onClick={() => setBuilderOpen(true)}
                  style={{
                    padding: "6px 14px",
                    background: "var(--io-accent)",
                    border: "none",
                    borderRadius: "var(--io-radius)",
                    color: "#fff",
                    fontSize: "12px",
                    fontWeight: 600,
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  {pendingExprId ? "Edit Expression" : "Configure Expression"}
                </button>
              </div>
            )}

            {/* Priority */}
            <div>
              <label
                style={{
                  fontSize: "12px",
                  color: "var(--io-text-muted)",
                  fontWeight: 600,
                }}
              >
                Priority
              </label>
              <select
                value={form.priority}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    priority: e.target.value as typeof form.priority,
                  }))
                }
                style={{
                  display: "block",
                  width: "100%",
                  marginTop: 4,
                  padding: "7px 10px",
                  background: "var(--io-surface-sunken)",
                  border: "1px solid var(--io-border)",
                  borderRadius: "var(--io-radius)",
                  color: "var(--io-text-primary)",
                  fontSize: "13px",
                }}
              >
                {["urgent", "high", "medium", "low", "diagnostic"].map((p) => (
                  <option key={p} value={p}>
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            {/* Enabled */}
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={form.enabled ?? true}
                onChange={(e) =>
                  setForm((f) => ({ ...f, enabled: e.target.checked }))
                }
              />
              <span
                style={{ fontSize: "13px", color: "var(--io-text-secondary)" }}
              >
                Enabled
              </span>
            </label>

            {/* Actions */}
            <div
              style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}
            >
              <button
                onClick={() => setDialogState(null)}
                style={{
                  padding: "7px 16px",
                  background: "transparent",
                  border: "1px solid var(--io-border)",
                  borderRadius: "var(--io-radius)",
                  color: "var(--io-text-secondary)",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={createMutation.isPending || updateMutation.isPending}
                style={{
                  padding: "7px 16px",
                  background: "var(--io-accent)",
                  border: "none",
                  borderRadius: "var(--io-radius)",
                  color: "#fff",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {createMutation.isPending || updateMutation.isPending
                  ? "Saving…"
                  : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeleteId(null);
          }}
        >
          <div
            style={{
              background: "var(--io-surface-elevated)",
              border: "1px solid var(--io-border)",
              borderRadius: "10px",
              padding: "24px",
              width: "360px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
            }}
          >
            <h3
              style={{ margin: "0 0 12px", fontSize: "16px", fontWeight: 600 }}
            >
              Delete Alarm Definition?
            </h3>
            <p
              style={{
                margin: "0 0 20px",
                fontSize: "13px",
                color: "var(--io-text-secondary)",
              }}
            >
              This cannot be undone.
            </p>
            <div
              style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}
            >
              <button
                onClick={() => setDeleteId(null)}
                style={{
                  padding: "7px 14px",
                  background: "transparent",
                  border: "1px solid var(--io-border)",
                  borderRadius: "var(--io-radius)",
                  color: "var(--io-text-secondary)",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(deleteId)}
                style={{
                  padding: "7px 14px",
                  background: "var(--io-danger)",
                  border: "none",
                  borderRadius: "var(--io-radius)",
                  color: "#fff",
                  fontSize: "13px",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Expression Builder Modal */}
      <ExpressionBuilderModal
        open={builderOpen}
        context="alarm_definition"
        contextLabel="Alarm Definition"
        onApply={(ast) => void handleExprApply(ast)}
        onCancel={() => setBuilderOpen(false)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function EventConfig() {
  return (
    <div style={{ padding: "var(--io-space-6)", maxWidth: 800 }}>
      {/* Header */}
      <div style={{ marginBottom: "var(--io-space-6)" }}>
        <h2
          style={{
            margin: "0 0 6px",
            fontSize: "20px",
            fontWeight: 700,
            color: "var(--io-text-primary)",
          }}
        >
          Event &amp; Alarm Configuration
        </h2>
        <p
          style={{
            margin: 0,
            fontSize: "13px",
            color: "var(--io-text-secondary)",
            lineHeight: 1.55,
          }}
        >
          ISA-18.2 alarm management configuration — shelving policies, priority
          definitions, state machine behavior, and event retention.
        </p>
      </div>

      <AlarmDefinitionsSection />

      {/* Coming soon banner */}
      <div
        style={{
          display: "flex",
          gap: 14,
          alignItems: "flex-start",
          padding: "14px 18px",
          borderRadius: "8px",
          background: "var(--io-accent-subtle)",
          border: "1px solid var(--io-accent)",
          marginBottom: "var(--io-space-6)",
        }}
      >
        <span style={{ fontSize: "20px", lineHeight: 1 }}>🔔</span>
        <div>
          <p
            style={{
              margin: "0 0 4px",
              fontWeight: 600,
              fontSize: "14px",
              color: "var(--io-accent)",
            }}
          >
            Available in Phase 9
          </p>
          <p
            style={{
              margin: 0,
              fontSize: "13px",
              color: "var(--io-text-secondary)",
              lineHeight: 1.5,
            }}
          >
            The event and alarm configuration UI is scheduled for Phase 9,
            alongside the alarm definitions API and the ISA-18.2 state machine
            service. In the meantime, alarm thresholds and shelving policies are
            managed server-side. Contact your system administrator to adjust
            these settings.
          </p>
        </div>
      </div>

      {/* Config areas */}
      <div style={{ ...SECTION_LABEL, marginBottom: 12 }}>
        Configuration Areas
      </div>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--io-space-3)",
          marginBottom: "var(--io-space-6)",
        }}
      >
        {CONFIG_AREAS.map((area) => (
          <div
            key={area.title}
            style={{
              ...CARD,
              display: "flex",
              gap: 14,
              alignItems: "flex-start",
            }}
          >
            <span style={{ fontSize: "20px", lineHeight: 1, flexShrink: 0 }}>
              {area.icon}
            </span>
            <div>
              <div style={ITEM_TITLE}>{area.title}</div>
              <p style={ITEM_DESC}>{area.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Priority table */}
      <div style={{ ...SECTION_LABEL, marginBottom: 12 }}>
        ISA-18.2 Priority Tiers
      </div>
      <div
        style={{
          ...CARD,
          padding: 0,
          overflow: "hidden",
          marginBottom: "var(--io-space-6)",
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse" as const,
            fontSize: "13px",
          }}
        >
          <thead>
            <tr>
              {["Priority", "Response Target", "Typical Use"].map((h) => (
                <th
                  key={h}
                  style={{
                    textAlign: "left" as const,
                    padding: "8px 14px",
                    borderBottom: "1px solid var(--io-border)",
                    color: "var(--io-text-muted)",
                    fontWeight: 600,
                    fontSize: "11px",
                    textTransform: "uppercase" as const,
                    letterSpacing: "0.05em",
                    background: "var(--io-surface-secondary)",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PRIORITY_ROWS.map((row) => (
              <tr key={row.tier}>
                <td
                  style={{
                    padding: "10px 14px",
                    borderBottom: "1px solid var(--io-border)",
                  }}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      fontWeight: 600,
                      color: "var(--io-text-primary)",
                    }}
                  >
                    <span
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: "50%",
                        background: row.color,
                        flexShrink: 0,
                        display: "inline-block",
                      }}
                    />
                    {row.tier}
                  </span>
                </td>
                <td
                  style={{
                    padding: "10px 14px",
                    borderBottom: "1px solid var(--io-border)",
                    color: "var(--io-text-secondary)",
                    fontFamily: "monospace",
                    fontSize: "12px",
                  }}
                >
                  {row.resp}
                </td>
                <td
                  style={{
                    padding: "10px 14px",
                    borderBottom: "1px solid var(--io-border)",
                    color: "var(--io-text-muted)",
                    fontSize: "12px",
                  }}
                >
                  {row.example}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* State machine diagram (text) */}
      <div style={{ ...SECTION_LABEL, marginBottom: 12 }}>
        ISA-18.2 State Machine
      </div>
      <div style={{ ...CARD, marginBottom: "var(--io-space-6)" }}>
        <div
          style={{
            display: "flex",
            gap: 0,
            alignItems: "center",
            flexWrap: "wrap" as const,
            rowGap: 8,
            fontSize: "12px",
            fontWeight: 500,
          }}
        >
          {[
            "Normal",
            "Unacknowledged",
            "Acknowledged",
            "Shelved",
            "Suppressed",
            "Out-of-Service",
          ].map((state, i, arr) => (
            <span
              key={state}
              style={{ display: "flex", alignItems: "center", gap: 0 }}
            >
              <span
                style={{
                  padding: "4px 10px",
                  borderRadius: "999px",
                  background: "var(--io-surface-secondary)",
                  border: "1px solid var(--io-border)",
                  color: "var(--io-text-primary)",
                  whiteSpace: "nowrap" as const,
                }}
              >
                {state}
              </span>
              {i < arr.length - 1 && (
                <span
                  style={{ color: "var(--io-text-muted)", padding: "0 4px" }}
                >
                  →
                </span>
              )}
            </span>
          ))}
        </div>
        <p
          style={{
            margin: "var(--io-space-3) 0 0",
            fontSize: "12px",
            color: "var(--io-text-muted)",
            lineHeight: 1.55,
          }}
        >
          Alarm lifecycle per ISA-18.2 §5.3. Each transition is logged to the
          event audit trail with operator ID, timestamp, and reason code. Phase
          9 will expose transition rules, timeout thresholds, and suppression
          group configuration through this UI.
        </p>
      </div>

      {/* Admin note */}
      <div
        style={{
          padding: "14px 16px",
          background: "var(--io-surface-secondary)",
          borderRadius: "8px",
          border: "1px solid var(--io-border)",
          fontSize: "13px",
          color: "var(--io-text-secondary)",
          lineHeight: 1.55,
        }}
      >
        <strong style={{ color: "var(--io-text-primary)" }}>
          Server-side configuration
        </strong>{" "}
        — Until Phase 9, alarm limits, priority thresholds, and shelving
        policies are defined in the Event Service configuration file (
        <code style={{ fontFamily: "monospace", fontSize: "12px" }}>
          event-service.toml
        </code>
        ). Contact your system administrator to apply changes. Alarm definitions
        for individual process points are configured in the{" "}
        <strong>OPC Sources</strong> and <strong>Point Management</strong>{" "}
        settings pages.
      </div>
    </div>
  );
}
