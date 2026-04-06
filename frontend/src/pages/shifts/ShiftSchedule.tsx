import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { shiftsApi, type Shift } from "../../api/shifts";
import { showToast } from "../../shared/components/Toast";
import { useContextMenu } from "../../shared/hooks/useContextMenu";
import ContextMenu from "../../shared/components/ContextMenu";

// ---------------------------------------------------------------------------
// Pattern Wizard — pre-built shift pattern templates (doc 30 §Pattern Templates)
// ---------------------------------------------------------------------------

interface PatternTemplate {
  key: string;
  name: string;
  description: string;
  // Generates shift blocks: each entry is { offsetDays, startHour, durationHours, label }
  blocks: {
    offsetDays: number;
    startHour: number;
    durationHours: number;
    label: string;
  }[];
}

const PATTERN_TEMPLATES: PatternTemplate[] = [
  {
    key: "8h-3",
    name: "8h × 3 Shifts",
    description:
      "3 rotating 8-hour shifts: Day, Swing, Night. Repeating weekly.",
    blocks: [
      { offsetDays: 0, startHour: 6, durationHours: 8, label: "Day" },
      { offsetDays: 0, startHour: 14, durationHours: 8, label: "Swing" },
      { offsetDays: 0, startHour: 22, durationHours: 8, label: "Night" },
      { offsetDays: 1, startHour: 6, durationHours: 8, label: "Day" },
      { offsetDays: 1, startHour: 14, durationHours: 8, label: "Swing" },
      { offsetDays: 1, startHour: 22, durationHours: 8, label: "Night" },
      { offsetDays: 2, startHour: 6, durationHours: 8, label: "Day" },
      { offsetDays: 2, startHour: 14, durationHours: 8, label: "Swing" },
      { offsetDays: 2, startHour: 22, durationHours: 8, label: "Night" },
    ],
  },
  {
    key: "12h-2",
    name: "12h × 2 Shifts",
    description:
      "2 rotating 12-hour shifts: Day and Night. Standard continental pattern.",
    blocks: [
      { offsetDays: 0, startHour: 6, durationHours: 12, label: "Day" },
      { offsetDays: 0, startHour: 18, durationHours: 12, label: "Night" },
      { offsetDays: 1, startHour: 6, durationHours: 12, label: "Day" },
      { offsetDays: 1, startHour: 18, durationHours: 12, label: "Night" },
      { offsetDays: 2, startHour: 6, durationHours: 12, label: "Day" },
      { offsetDays: 2, startHour: 18, durationHours: 12, label: "Night" },
    ],
  },
  {
    key: "dupont",
    name: "DuPont 12h",
    description:
      "4-week rotating pattern: 4 nights on, 3 off, 3 days on, 1 off, 3 nights on, 3 off, 4 days on, 7 off.",
    blocks: [
      { offsetDays: 0, startHour: 18, durationHours: 12, label: "Night 1" },
      { offsetDays: 1, startHour: 18, durationHours: 12, label: "Night 2" },
      { offsetDays: 2, startHour: 18, durationHours: 12, label: "Night 3" },
      { offsetDays: 3, startHour: 18, durationHours: 12, label: "Night 4" },
      { offsetDays: 7, startHour: 6, durationHours: 12, label: "Day 1" },
      { offsetDays: 8, startHour: 6, durationHours: 12, label: "Day 2" },
      { offsetDays: 9, startHour: 6, durationHours: 12, label: "Day 3" },
    ],
  },
  {
    key: "pitman",
    name: "Pitman 12h",
    description:
      "2-week rotating pattern: 2 on, 2 off, 3 on, 2 off, 2 on, 3 off.",
    blocks: [
      { offsetDays: 0, startHour: 6, durationHours: 12, label: "Day 1" },
      { offsetDays: 1, startHour: 6, durationHours: 12, label: "Day 2" },
      { offsetDays: 4, startHour: 6, durationHours: 12, label: "Day 3" },
      { offsetDays: 5, startHour: 6, durationHours: 12, label: "Day 4" },
      { offsetDays: 6, startHour: 6, durationHours: 12, label: "Day 5" },
      { offsetDays: 9, startHour: 18, durationHours: 12, label: "Night 1" },
      { offsetDays: 10, startHour: 18, durationHours: 12, label: "Night 2" },
    ],
  },
  {
    key: "custom",
    name: "Custom",
    description:
      "Single 12-hour day shift as a starting point. Customize before creating.",
    blocks: [{ offsetDays: 0, startHour: 6, durationHours: 12, label: "Day" }],
  },
];

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 3_600_000);
}

function PatternWizardDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const qc = useQueryClient();
  const [step, setStep] = useState<"pick" | "config">("pick");
  const [selected, setSelected] = useState<PatternTemplate | null>(null);
  const [startDate, setStartDate] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [crewId, setCrewId] = useState("");

  const { data: crewsData } = useQuery({
    queryKey: ["shifts", "crews"],
    queryFn: async () => {
      const res = await shiftsApi.listCrews();
      if (!res.success) throw new Error(res.error.message);
      return res.data.data;
    },
    enabled: open,
  });
  const crews = crewsData ?? [];

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!selected) return;
      const base = new Date(`${startDate}T00:00:00`);
      await Promise.all(
        selected.blocks.map((b) => {
          const start = new Date(base);
          start.setDate(start.getDate() + b.offsetDays);
          start.setHours(b.startHour, 0, 0, 0);
          const end = addHours(start, b.durationHours);
          return shiftsApi.createShift({
            name: `${selected.name} — ${b.label}`,
            crew_id: crewId || undefined,
            start_time: start.toISOString(),
            end_time: end.toISOString(),
            handover_minutes: 30,
          });
        }),
      );
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["shifts", "list"] });
      showToast({
        title: "Shifts created",
        description: `${selected?.blocks.length ?? 0} shifts added from pattern.`,
        variant: "success",
      });
      onCreated();
      onClose();
    },
    onError: () => {
      showToast({
        title: "Failed",
        description: "Could not create shifts.",
        variant: "error",
      });
    },
  });

  if (!open) return null;

  const overlayStyle: React.CSSProperties = {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.5)",
    zIndex: 1000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  };
  const dialogStyle: React.CSSProperties = {
    background: "var(--io-surface-elevated)",
    border: "1px solid var(--io-border)",
    borderRadius: 10,
    padding: 24,
    width: 560,
    maxWidth: "95vw",
    maxHeight: "90vh",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 16,
    zIndex: 1001,
  };
  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 10px",
    background: "var(--io-surface-secondary)",
    border: "1px solid var(--io-border)",
    borderRadius: 6,
    color: "var(--io-text-primary)",
    fontSize: 13,
    boxSizing: "border-box",
  };

  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={dialogStyle} onClick={(e) => e.stopPropagation()}>
        <h3
          style={{
            margin: 0,
            fontSize: 16,
            fontWeight: 700,
            color: "var(--io-text-primary)",
          }}
        >
          {step === "pick"
            ? "Choose a Shift Pattern"
            : `Configure — ${selected?.name}`}
        </h3>

        {step === "pick" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {PATTERN_TEMPLATES.map((pt) => (
              <div
                key={pt.key}
                onClick={() => {
                  setSelected(pt);
                  setStep("config");
                }}
                style={{
                  padding: "12px 14px",
                  border: "1px solid var(--io-border)",
                  borderRadius: 8,
                  cursor: "pointer",
                  background: "var(--io-surface)",
                  transition: "border-color 0.15s",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor =
                    "var(--io-accent)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.borderColor =
                    "var(--io-border)";
                }}
              >
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: 14,
                    color: "var(--io-text-primary)",
                    marginBottom: 2,
                  }}
                >
                  {pt.name}
                </div>
                <div style={{ fontSize: 12, color: "var(--io-text-muted)" }}>
                  {pt.description}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: "var(--io-text-muted)",
                    marginTop: 4,
                  }}
                >
                  {pt.blocks.length} shifts generated
                </div>
              </div>
            ))}
          </div>
        )}

        {step === "config" && selected && (
          <>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--io-text-secondary)",
                  marginBottom: 4,
                }}
              >
                Pattern Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={inputStyle}
              />
            </div>
            <div>
              <label
                style={{
                  display: "block",
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--io-text-secondary)",
                  marginBottom: 4,
                }}
              >
                Crew (optional)
              </label>
              <select
                value={crewId}
                onChange={(e) => setCrewId(e.target.value)}
                style={inputStyle}
              >
                <option value="">No crew assigned</option>
                {crews.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div
              style={{
                background: "var(--io-surface-secondary)",
                borderRadius: 6,
                padding: "10px 12px",
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "var(--io-text-secondary)",
                  marginBottom: 6,
                }}
              >
                Preview ({selected.blocks.length} shifts)
              </div>
              {selected.blocks.map((b, i) => {
                const base = new Date(`${startDate}T00:00:00`);
                const start = new Date(base);
                start.setDate(start.getDate() + b.offsetDays);
                start.setHours(b.startHour, 0, 0, 0);
                return (
                  <div
                    key={i}
                    style={{
                      fontSize: 12,
                      color: "var(--io-text-primary)",
                      padding: "2px 0",
                    }}
                  >
                    {b.label} —{" "}
                    {start.toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}{" "}
                    {b.startHour}:00 ({b.durationHours}h)
                  </div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={() => setStep("pick")}
                style={{
                  flex: 1,
                  padding: "8px 0",
                  background: "none",
                  border: "1px solid var(--io-border)",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 13,
                  color: "var(--io-text-secondary)",
                }}
              >
                ← Back
              </button>
              <button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending}
                style={{
                  flex: 2,
                  padding: "8px 0",
                  background: "var(--io-accent)",
                  border: "none",
                  borderRadius: 6,
                  cursor: createMutation.isPending ? "not-allowed" : "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "#fff",
                  opacity: createMutation.isPending ? 0.6 : 1,
                }}
              >
                {createMutation.isPending
                  ? "Creating…"
                  : `Create ${selected.blocks.length} Shifts`}
              </button>
            </div>
          </>
        )}

        <button
          onClick={onClose}
          style={{
            alignSelf: "center",
            background: "none",
            border: "none",
            cursor: "pointer",
            fontSize: 12,
            color: "var(--io-text-muted)",
            padding: "4px 8px",
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(start: string, end: string): string {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const h = Math.floor(ms / 3_600_000);
  const m = Math.round((ms % 3_600_000) / 60_000);
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// ---------------------------------------------------------------------------
// External badge
// ---------------------------------------------------------------------------

function ExternalBadge({ shift }: { shift: Shift }) {
  if (shift.source !== "external") return null;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        padding: "2px 8px",
        borderRadius: 100,
        background: "rgba(99, 102, 241, 0.12)",
        color: "#6366f1",
        border: "1px solid rgba(99, 102, 241, 0.3)",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ fontSize: 12 }}>&#128274;</span>
      {shift.source_system || "External"}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, [string, string]> = {
  scheduled: ["#4a9eff", "rgba(74,158,255,0.12)"],
  active: ["#22c55e", "rgba(34,197,94,0.12)"],
  completed: ["#6b7280", "rgba(107,114,128,0.12)"],
  cancelled: ["#ef4444", "rgba(239,68,68,0.12)"],
};

function StatusBadge({ status }: { status: Shift["status"] }) {
  const [color, bg] = STATUS_COLORS[status] ?? [
    "#6b7280",
    "rgba(107,114,128,0.12)",
  ];
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        padding: "2px 8px",
        borderRadius: 100,
        background: bg,
        color,
        border: `1px solid ${color}`,
        whiteSpace: "nowrap",
      }}
    >
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Row
// ---------------------------------------------------------------------------

function ShiftRow({ shift }: { shift: Shift }) {
  const navigate = useNavigate();
  const { menuState, handleContextMenu, closeMenu } = useContextMenu<Shift>();

  return (
    <>
    <tr
      onClick={() => navigate(`/shifts/schedule/${shift.id}`)}
      onContextMenu={(e) => handleContextMenu(e, shift)}
      style={{ cursor: "pointer", borderBottom: "1px solid var(--io-border)" }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLTableRowElement).style.background =
          "var(--io-surface-secondary)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLTableRowElement).style.background =
          "transparent";
      }}
    >
      <td
        style={{
          padding: "12px 16px",
          color: "var(--io-text-primary)",
          fontWeight: 500,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {shift.name}
          <ExternalBadge shift={shift} />
        </div>
      </td>
      <td
        style={{
          padding: "12px 16px",
          color: "var(--io-text-secondary)",
          fontSize: 13,
        }}
      >
        {shift.crew_name ?? (
          <span style={{ color: "var(--io-text-muted)" }}>—</span>
        )}
      </td>
      <td
        style={{
          padding: "12px 16px",
          color: "var(--io-text-secondary)",
          fontSize: 13,
        }}
      >
        {formatDateTime(shift.start_time)}
      </td>
      <td
        style={{
          padding: "12px 16px",
          color: "var(--io-text-secondary)",
          fontSize: 13,
        }}
      >
        {formatDateTime(shift.end_time)}
      </td>
      <td
        style={{
          padding: "12px 16px",
          color: "var(--io-text-muted)",
          fontSize: 13,
        }}
      >
        {formatDuration(shift.start_time, shift.end_time)}
      </td>
      <td style={{ padding: "12px 16px" }}>
        <StatusBadge status={shift.status} />
      </td>
    </tr>
    {menuState && (
      <ContextMenu
        x={menuState.x}
        y={menuState.y}
        items={[
          { label: "Edit Shift", permission: "shifts:write", onClick: () => { closeMenu(); } },
          { label: "Copy Shift", permission: "shifts:write", onClick: () => { closeMenu(); } },
          { label: "Delete Shift", danger: true, divider: true, onClick: () => { closeMenu(); } },
        ]}
        onClose={closeMenu}
      />
    )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Filter bar
// ---------------------------------------------------------------------------

type StatusFilter = "all" | Shift["status"];

const STATUSES: StatusFilter[] = [
  "all",
  "scheduled",
  "active",
  "completed",
  "cancelled",
];

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ShiftSchedule() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showWizard, setShowWizard] = useState(false);

  // Default: next 30 days
  const from = new Date().toISOString();
  const toDate = new Date();
  toDate.setDate(toDate.getDate() + 30);
  const to = toDate.toISOString();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["shifts", "list", statusFilter],
    queryFn: async () => {
      const params: Record<string, string> = { from, to };
      if (statusFilter !== "all") params.status = statusFilter;
      const res = await shiftsApi.listShifts(params);
      if (!res.success) throw new Error(res.error.message);
      return res.data.data;
    },
  });

  const shifts = data ?? [];

  return (
    <div style={{ padding: "var(--io-space-6)" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 24,
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              color: "var(--io-text-primary)",
              fontSize: 20,
              fontWeight: 600,
            }}
          >
            Shift Schedule
          </h2>
          <p
            style={{
              margin: "4px 0 0",
              color: "var(--io-text-muted)",
              fontSize: 13,
            }}
          >
            Upcoming shifts — next 30 days
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setShowWizard(true)}
            style={{
              padding: "8px 14px",
              background: "var(--io-surface-elevated)",
              color: "var(--io-text-secondary)",
              border: "1px solid var(--io-border)",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            Use Pattern…
          </button>
          <button
            onClick={() => navigate("/shifts/schedule/new")}
            style={{
              padding: "8px 16px",
              background: "var(--io-accent)",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            + New Shift
          </button>
        </div>
      </div>

      {/* Filters */}
      <div
        style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}
      >
        {STATUSES.map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            style={{
              padding: "5px 12px",
              borderRadius: 6,
              border: "1px solid var(--io-border)",
              background:
                statusFilter === s ? "var(--io-accent)" : "var(--io-surface)",
              color: statusFilter === s ? "#fff" : "var(--io-text-secondary)",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 500,
              textTransform: "capitalize",
            }}
          >
            {s === "all" ? "All" : s}
          </button>
        ))}
        <button
          onClick={() => refetch()}
          style={{
            marginLeft: "auto",
            padding: "5px 12px",
            borderRadius: 6,
            border: "1px solid var(--io-border)",
            background: "var(--io-surface)",
            color: "var(--io-text-secondary)",
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          Refresh
        </button>
      </div>

      {/* Table */}
      <div
        style={{
          background: "var(--io-surface)",
          border: "1px solid var(--io-border)",
          borderRadius: 8,
          overflow: "hidden",
        }}
      >
        {isLoading ? (
          <div
            style={{
              padding: 40,
              textAlign: "center",
              color: "var(--io-text-muted)",
            }}
          >
            Loading shifts…
          </div>
        ) : isError ? (
          <div style={{ padding: 40, textAlign: "center", color: "#ef4444" }}>
            Failed to load shifts.{" "}
            <button
              onClick={() => refetch()}
              style={{
                background: "none",
                border: "none",
                color: "var(--io-accent)",
                cursor: "pointer",
                fontSize: 13,
              }}
            >
              Retry
            </button>
          </div>
        ) : shifts.length === 0 ? (
          <div
            style={{
              padding: 40,
              textAlign: "center",
              color: "var(--io-text-muted)",
            }}
          >
            No shifts found for this period.
          </div>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr
                style={{
                  borderBottom: "1px solid var(--io-border)",
                  background: "var(--io-bg)",
                }}
              >
                {["Name", "Crew", "Start", "End", "Duration", "Status"].map(
                  (h) => (
                    <th
                      key={h}
                      style={{
                        padding: "10px 16px",
                        textAlign: "left",
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        color: "var(--io-text-muted)",
                      }}
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {shifts.map((shift: Shift) => (
                <ShiftRow key={shift.id} shift={shift} />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Count footer */}
      {!isLoading && !isError && shifts.length > 0 && (
        <p
          style={{ marginTop: 10, fontSize: 12, color: "var(--io-text-muted)" }}
        >
          {shifts.length} shift{shifts.length !== 1 ? "s" : ""}
        </p>
      )}

      {/* Pattern wizard dialog */}
      <PatternWizardDialog
        open={showWizard}
        onClose={() => setShowWizard(false)}
        onCreated={() => {
          void refetch();
        }}
      />
    </div>
  );
}
