import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  shiftsApi,
  type Shift,
  type ShiftCrew,
  type PresenceStatus,
  type MusterEvent,
  type MusterAccounting,
  type MusterPoint,
  type BadgeSource,
  type BadgeEvent,
  type CreateShiftPayload,
  type CreateCrewPayload,
  type DeclareMusterPayload,
  type AccountPersonPayload,
  type CreateBadgeSourcePayload,
} from "../../api/shifts";
import { useAuthStore } from "../../store/auth";
import { usePermission } from "../../shared/hooks/usePermission";
import { wsManager } from "../../shared/hooks/useWebSocket";

// ---------------------------------------------------------------------------
// Shared style tokens
// ---------------------------------------------------------------------------

const surface: React.CSSProperties = {
  background: "var(--io-surface)",
  border: "1px solid var(--io-border)",
  borderRadius: 8,
};

const badge = (color: string, bg: string): React.CSSProperties => ({
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  padding: "2px 8px",
  borderRadius: 100,
  background: bg,
  color,
  border: `1px solid ${color}`,
  display: "inline-block",
  whiteSpace: "nowrap",
});

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    scheduled: ["#4a9eff", "rgba(74,158,255,0.12)"],
    active: ["#22c55e", "rgba(34,197,94,0.12)"],
    completed: ["#6b7280", "rgba(107,114,128,0.12)"],
    cancelled: ["#ef4444", "rgba(239,68,68,0.12)"],
    active_muster: ["#f97316", "rgba(249,115,22,0.15)"],
    resolved: ["#6b7280", "rgba(107,114,128,0.12)"],
    unaccounted: ["#ef4444", "rgba(239,68,68,0.12)"],
    accounted_badge: ["#22c55e", "rgba(34,197,94,0.12)"],
    accounted_manual: ["#4a9eff", "rgba(74,158,255,0.12)"],
    off_site: ["#6b7280", "rgba(107,114,128,0.12)"],
    stale: ["#eab308", "rgba(234,179,8,0.12)"],
  };
  const [color, bg] = map[status] ?? ["#6b7280", "rgba(107,114,128,0.12)"];
  return <span style={badge(color, bg)}>{status.replace(/_/g, " ")}</span>;
}

function OnSiteDot({ on }: { on: boolean }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 8,
        height: 8,
        borderRadius: "50%",
        background: on ? "#22c55e" : "#374151",
        border: on ? "1px solid #16a34a" : "1px solid #6b7280",
        marginRight: 4,
      }}
    />
  );
}

function Avatar({ name }: { name: string | null }) {
  const initials = name
    ? name
        .split(" ")
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "?";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 32,
        height: 32,
        borderRadius: "50%",
        background: "var(--io-accent)",
        color: "#fff",
        fontSize: 12,
        fontWeight: 700,
        flexShrink: 0,
      }}
    >
      {initials}
    </span>
  );
}

function SummaryCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div
      style={{
        ...surface,
        padding: "16px 20px",
        minWidth: 120,
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: 28,
          fontWeight: 700,
          color: color ?? "var(--io-text)",
        }}
      >
        {value}
      </div>
      <div
        style={{ fontSize: 12, color: "var(--io-text-muted)", marginTop: 2 }}
      >
        {label}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab bar
// ---------------------------------------------------------------------------

type Tab = "roster" | "schedule" | "presence" | "muster" | "badge-events";

function TabBar({
  active,
  onChange,
}: {
  active: Tab;
  onChange: (t: Tab) => void;
}) {
  const tabs: { id: Tab; label: string }[] = [
    { id: "roster", label: "Roster" },
    { id: "schedule", label: "Schedule" },
    { id: "presence", label: "Presence" },
    { id: "muster", label: "Muster" },
    { id: "badge-events", label: "Badge Events" },
  ];
  return (
    <div
      style={{
        display: "flex",
        gap: 4,
        borderBottom: "1px solid var(--io-border)",
        marginBottom: 24,
      }}
    >
      {tabs.map((t) => (
        <button
          key={t.id}
          onClick={() => onChange(t.id)}
          style={{
            padding: "8px 16px",
            border: "none",
            background: "none",
            cursor: "pointer",
            fontSize: 14,
            fontWeight: active === t.id ? 600 : 400,
            color:
              active === t.id ? "var(--io-accent)" : "var(--io-text-secondary)",
            borderBottom:
              active === t.id
                ? "2px solid var(--io-accent)"
                : "2px solid transparent",
            marginBottom: -1,
            transition: "color 0.15s",
          }}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Roster Tab
// ---------------------------------------------------------------------------

function RosterTab({ presence }: { presence: PresenceStatus[] }) {
  const onShift = presence.filter((p) => p.on_shift);
  const onSite = presence.filter((p) => p.on_site && !p.on_shift);

  function PersonRow({ p }: { p: PresenceStatus }) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "10px 16px",
          borderBottom: "1px solid var(--io-border)",
        }}
      >
        <Avatar name={p.display_name} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{ fontWeight: 500, fontSize: 14, color: "var(--io-text)" }}
          >
            {p.display_name ?? p.email ?? p.user_id}
          </div>
          {p.last_area && (
            <div style={{ fontSize: 12, color: "var(--io-text-muted)" }}>
              {p.last_area}
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {p.on_site && (
            <span style={badge("#22c55e", "rgba(34,197,94,0.12)")}>
              On Site
            </span>
          )}
          {p.on_shift && (
            <span style={badge("#4a9eff", "rgba(74,158,255,0.12)")}>
              On Shift
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        <SummaryCard label="On Shift" value={onShift.length} color="#4a9eff" />
        <SummaryCard
          label="On Site"
          value={presence.filter((p) => p.on_site).length}
          color="#22c55e"
        />
        <SummaryCard label="Total Active" value={presence.length} />
      </div>

      {onShift.length > 0 && (
        <div style={{ ...surface, marginBottom: 20 }}>
          <div
            style={{
              padding: "12px 16px",
              borderBottom: "1px solid var(--io-border)",
              fontWeight: 600,
              fontSize: 13,
              color: "var(--io-text-secondary)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Current Shift ({onShift.length})
          </div>
          {onShift.map((p) => (
            <PersonRow key={p.user_id} p={p} />
          ))}
        </div>
      )}

      {onSite.length > 0 && (
        <div style={surface}>
          <div
            style={{
              padding: "12px 16px",
              borderBottom: "1px solid var(--io-border)",
              fontWeight: 600,
              fontSize: 13,
              color: "var(--io-text-secondary)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            On Site (badge) ({onSite.length})
          </div>
          {onSite.map((p) => (
            <PersonRow key={p.user_id} p={p} />
          ))}
        </div>
      )}

      {presence.length === 0 && (
        <div
          style={{
            textAlign: "center",
            padding: 48,
            color: "var(--io-text-muted)",
            fontSize: 14,
          }}
        >
          No active presence data. Personnel will appear here when on-site or
          on-shift.
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Schedule Tab
// ---------------------------------------------------------------------------

function ScheduleTab() {
  const qc = useQueryClient();
  const [showNewShift, setShowNewShift] = useState(false);
  const [showNewCrew, setShowNewCrew] = useState(false);

  const shiftsQ = useQuery({
    queryKey: ["shifts"],
    queryFn: async () => {
      const r = await shiftsApi.listShifts();
      if (!r.success) throw new Error(r.error.message);
      return r.data.data;
    },
  });

  const crewsQ = useQuery({
    queryKey: ["shifts-crews"],
    queryFn: async () => {
      const r = await shiftsApi.listCrews();
      if (!r.success) throw new Error(r.error.message);
      return r.data.data;
    },
  });

  const createShiftMut = useMutation({
    mutationFn: (payload: CreateShiftPayload) => shiftsApi.createShift(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shifts"] });
      setShowNewShift(false);
    },
  });

  const createCrewMut = useMutation({
    mutationFn: (payload: CreateCrewPayload) => shiftsApi.createCrew(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shifts-crews"] });
      setShowNewCrew(false);
    },
  });

  const deleteShiftMut = useMutation({
    mutationFn: (id: string) => shiftsApi.deleteShift(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shifts"] }),
  });

  const deleteCrewMut = useMutation({
    mutationFn: (id: string) => shiftsApi.deleteCrew(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["shifts-crews"] }),
  });

  const [newShift, setNewShift] = useState<Partial<CreateShiftPayload>>({});
  const [newCrew, setNewCrew] = useState<Partial<CreateCrewPayload>>({
    color: "#6366f1",
  });

  const shifts = shiftsQ.data ?? [];
  const crews = crewsQ.data ?? [];

  return (
    <div>
      {/* Upcoming shifts */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
          Upcoming Shifts
        </h3>
        <button
          onClick={() => setShowNewShift((v) => !v)}
          style={{
            padding: "6px 14px",
            border: "1px solid var(--io-accent)",
            borderRadius: 6,
            background: "var(--io-accent)",
            color: "#fff",
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          + New Shift
        </button>
      </div>

      {showNewShift && (
        <div style={{ ...surface, padding: 16, marginBottom: 16 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              marginBottom: 12,
            }}
          >
            <div>
              <label
                style={{
                  fontSize: 12,
                  color: "var(--io-text-muted)",
                  display: "block",
                  marginBottom: 4,
                }}
              >
                Shift Name *
              </label>
              <input
                value={newShift.name ?? ""}
                onChange={(e) =>
                  setNewShift((s) => ({ ...s, name: e.target.value }))
                }
                placeholder="e.g. Day Shift A"
                style={inputStyle}
              />
            </div>
            <div>
              <label
                style={{
                  fontSize: 12,
                  color: "var(--io-text-muted)",
                  display: "block",
                  marginBottom: 4,
                }}
              >
                Crew
              </label>
              <select
                value={newShift.crew_id ?? ""}
                onChange={(e) =>
                  setNewShift((s) => ({
                    ...s,
                    crew_id: e.target.value || undefined,
                  }))
                }
                style={inputStyle}
              >
                <option value="">No crew</option>
                {crews.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                style={{
                  fontSize: 12,
                  color: "var(--io-text-muted)",
                  display: "block",
                  marginBottom: 4,
                }}
              >
                Start Time *
              </label>
              <input
                type="datetime-local"
                value={newShift.start_time ?? ""}
                onChange={(e) =>
                  setNewShift((s) => ({ ...s, start_time: e.target.value }))
                }
                style={inputStyle}
              />
            </div>
            <div>
              <label
                style={{
                  fontSize: 12,
                  color: "var(--io-text-muted)",
                  display: "block",
                  marginBottom: 4,
                }}
              >
                End Time *
              </label>
              <input
                type="datetime-local"
                value={newShift.end_time ?? ""}
                onChange={(e) =>
                  setNewShift((s) => ({ ...s, end_time: e.target.value }))
                }
                style={inputStyle}
              />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label
                style={{
                  fontSize: 12,
                  color: "var(--io-text-muted)",
                  display: "block",
                  marginBottom: 4,
                }}
              >
                Notes
              </label>
              <input
                value={newShift.notes ?? ""}
                onChange={(e) =>
                  setNewShift((s) => ({ ...s, notes: e.target.value }))
                }
                placeholder="Optional notes"
                style={inputStyle}
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => {
                if (
                  !newShift.name ||
                  !newShift.start_time ||
                  !newShift.end_time
                )
                  return;
                createShiftMut.mutate({
                  name: newShift.name,
                  crew_id: newShift.crew_id,
                  start_time: new Date(newShift.start_time).toISOString(),
                  end_time: new Date(newShift.end_time).toISOString(),
                  notes: newShift.notes,
                });
              }}
              disabled={createShiftMut.isPending}
              style={primaryBtn}
            >
              {createShiftMut.isPending ? "Creating..." : "Create Shift"}
            </button>
            <button onClick={() => setShowNewShift(false)} style={ghostBtn}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div style={{ ...surface, marginBottom: 32 }}>
        {shifts.length === 0 && (
          <div
            style={{
              padding: 32,
              textAlign: "center",
              color: "var(--io-text-muted)",
              fontSize: 14,
            }}
          >
            No shifts scheduled. Create a shift to get started.
          </div>
        )}
        {shifts.map((s) => (
          <ShiftRow
            key={s.id}
            shift={s}
            onDelete={(id) => deleteShiftMut.mutate(id)}
          />
        ))}
      </div>

      {/* Crews */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Crews</h3>
        <button
          onClick={() => setShowNewCrew((v) => !v)}
          style={ghostBtnAccent}
        >
          + New Crew
        </button>
      </div>

      {showNewCrew && (
        <div style={{ ...surface, padding: 16, marginBottom: 16 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              marginBottom: 12,
            }}
          >
            <div>
              <label
                style={{
                  fontSize: 12,
                  color: "var(--io-text-muted)",
                  display: "block",
                  marginBottom: 4,
                }}
              >
                Crew Name *
              </label>
              <input
                value={newCrew.name ?? ""}
                onChange={(e) =>
                  setNewCrew((s) => ({ ...s, name: e.target.value }))
                }
                placeholder="e.g. Alpha Crew"
                style={inputStyle}
              />
            </div>
            <div>
              <label
                style={{
                  fontSize: 12,
                  color: "var(--io-text-muted)",
                  display: "block",
                  marginBottom: 4,
                }}
              >
                Color
              </label>
              <input
                type="color"
                value={newCrew.color ?? "#6366f1"}
                onChange={(e) =>
                  setNewCrew((s) => ({ ...s, color: e.target.value }))
                }
                style={{ ...inputStyle, height: 38, padding: 4 }}
              />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label
                style={{
                  fontSize: 12,
                  color: "var(--io-text-muted)",
                  display: "block",
                  marginBottom: 4,
                }}
              >
                Description
              </label>
              <input
                value={newCrew.description ?? ""}
                onChange={(e) =>
                  setNewCrew((s) => ({ ...s, description: e.target.value }))
                }
                placeholder="Optional description"
                style={inputStyle}
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => {
                if (!newCrew.name) return;
                createCrewMut.mutate({
                  name: newCrew.name,
                  description: newCrew.description,
                  color: newCrew.color,
                });
              }}
              disabled={createCrewMut.isPending}
              style={primaryBtn}
            >
              {createCrewMut.isPending ? "Creating..." : "Create Crew"}
            </button>
            <button onClick={() => setShowNewCrew(false)} style={ghostBtn}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div style={surface}>
        {crews.length === 0 && (
          <div
            style={{
              padding: 32,
              textAlign: "center",
              color: "var(--io-text-muted)",
              fontSize: 14,
            }}
          >
            No crews yet.
          </div>
        )}
        {crews.map((c) => (
          <CrewRow
            key={c.id}
            crew={c}
            onDelete={(id) => deleteCrewMut.mutate(id)}
          />
        ))}
      </div>
    </div>
  );
}

function ShiftRow({
  shift,
  onDelete,
}: {
  shift: Shift;
  onDelete: (id: string) => void;
}) {
  const start = new Date(shift.start_time);
  const end = new Date(shift.end_time);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "12px 16px",
        borderBottom: "1px solid var(--io-border)",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontWeight: 500,
            fontSize: 14,
            color: "var(--io-text)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          {shift.name}
          {shift.source === "external" && (
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
          )}
        </div>
        <div
          style={{ fontSize: 12, color: "var(--io-text-muted)", marginTop: 2 }}
        >
          {start.toLocaleDateString()}{" "}
          {start.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          {" — "}
          {end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          {shift.crew_name && ` · ${shift.crew_name}`}
        </div>
      </div>
      <StatusBadge status={shift.status} />
      {shift.source !== "external" && (
        <button
          onClick={() => onDelete(shift.id)}
          style={{
            padding: "4px 10px",
            border: "1px solid var(--io-border)",
            borderRadius: 4,
            background: "none",
            color: "var(--io-text-muted)",
            cursor: "pointer",
            fontSize: 12,
          }}
        >
          Delete
        </button>
      )}
    </div>
  );
}

function CrewRow({
  crew,
  onDelete,
}: {
  crew: ShiftCrew;
  onDelete: (id: string) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 16px",
        borderBottom: "1px solid var(--io-border)",
      }}
    >
      <span
        style={{
          display: "inline-block",
          width: 12,
          height: 12,
          borderRadius: "50%",
          background: crew.color,
          flexShrink: 0,
        }}
      />
      <div style={{ flex: 1 }}>
        <span style={{ fontWeight: 500, fontSize: 14 }}>{crew.name}</span>
        {crew.description && (
          <span
            style={{
              fontSize: 12,
              color: "var(--io-text-muted)",
              marginLeft: 8,
            }}
          >
            {crew.description}
          </span>
        )}
      </div>
      <span style={{ fontSize: 12, color: "var(--io-text-muted)" }}>
        {crew.member_count ?? 0} members
      </span>
      <button
        onClick={() => onDelete(crew.id)}
        style={{
          padding: "4px 10px",
          border: "1px solid var(--io-border)",
          borderRadius: 4,
          background: "none",
          color: "var(--io-text-muted)",
          cursor: "pointer",
          fontSize: 12,
        }}
      >
        Delete
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Presence Tab
// ---------------------------------------------------------------------------

function PresenceTab({ presence }: { presence: PresenceStatus[] }) {
  const qc = useQueryClient();
  const { user } = useAuthStore();
  const canManagePresence =
    user?.permissions.includes("presence:manage") ||
    user?.permissions.includes("*") ||
    false;

  const clearPresenceMut = useMutation({
    mutationFn: (badgeId: string) => shiftsApi.clearPresence(badgeId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["presence"] }),
  });

  const onSite = presence.filter((p) => p.on_site).length;
  const onShift = presence.filter((p) => p.on_shift).length;
  const both = presence.filter((p) => p.on_site && p.on_shift).length;

  const colTemplate = canManagePresence
    ? "1fr 80px 140px 140px 80px 80px"
    : "1fr 80px 140px 140px 80px";

  return (
    <div>
      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        <SummaryCard label="On Site" value={onSite} color="#22c55e" />
        <SummaryCard label="On Shift" value={onShift} color="#4a9eff" />
        <SummaryCard label="On Site & Shift" value={both} color="#a855f7" />
        <SummaryCard label="Total Tracked" value={presence.length} />
      </div>

      <div style={surface}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: colTemplate,
            gap: 12,
            padding: "10px 16px",
            borderBottom: "1px solid var(--io-border)",
            fontSize: 11,
            fontWeight: 600,
            color: "var(--io-text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          <span>Name</span>
          <span>On Site</span>
          <span>Last Area</span>
          <span>Last Seen</span>
          <span>On Shift</span>
          {canManagePresence && <span>Actions</span>}
        </div>
        {presence.length === 0 && (
          <div
            style={{
              padding: 32,
              textAlign: "center",
              color: "var(--io-text-muted)",
              fontSize: 14,
            }}
          >
            No presence records found.
          </div>
        )}
        {presence.map((p) => (
          <div
            key={p.user_id}
            style={{
              display: "grid",
              gridTemplateColumns: colTemplate,
              gap: 12,
              padding: "10px 16px",
              borderBottom: "1px solid var(--io-border)",
              alignItems: "center",
              fontSize: 13,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Avatar name={p.display_name} />
              <div>
                <div style={{ fontWeight: 500, color: "var(--io-text)" }}>
                  {p.display_name ?? p.email ?? p.user_id}
                </div>
                {p.email && (
                  <div style={{ fontSize: 11, color: "var(--io-text-muted)" }}>
                    {p.email}
                  </div>
                )}
              </div>
            </div>
            <div>
              <OnSiteDot on={p.on_site} />
              <span
                style={{
                  fontSize: 12,
                  color: p.on_site ? "#22c55e" : "var(--io-text-muted)",
                }}
              >
                {p.on_site ? "Yes" : "No"}
              </span>
            </div>
            <span
              style={{
                color: "var(--io-text-secondary)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {p.last_area ?? "—"}
            </span>
            <span style={{ color: "var(--io-text-secondary)", fontSize: 12 }}>
              {p.last_seen_at ? new Date(p.last_seen_at).toLocaleString() : "—"}
            </span>
            <div>
              <OnSiteDot on={p.on_shift} />
              <span
                style={{
                  fontSize: 12,
                  color: p.on_shift ? "#4a9eff" : "var(--io-text-muted)",
                }}
              >
                {p.on_shift ? "Yes" : "No"}
              </span>
            </div>
            {canManagePresence && (
              <div>
                {p.stale_at != null && (
                  <button
                    style={{
                      padding: "4px 10px",
                      border: "1px solid var(--io-border)",
                      borderRadius: 4,
                      background: "none",
                      color: "var(--io-text-muted)",
                      cursor: "pointer",
                      fontSize: 12,
                    }}
                    disabled={clearPresenceMut.isPending}
                    onClick={() => clearPresenceMut.mutate(p.user_id)}
                    title="Manually clear stale on-site status"
                  >
                    Clear
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Muster Tab
// ---------------------------------------------------------------------------

function MusterTab() {
  const qc = useQueryClient();
  const [accountingFilter, setAccountingFilter] = useState<string>("all");
  const [confirmDeclare, setConfirmDeclare] = useState(false);

  // Subscribe to real-time muster:status WebSocket events.
  // When the server publishes a muster status update, invalidate the queries
  // so the UI refreshes immediately without waiting for the polling fallback.
  useEffect(() => {
    const unsub = wsManager.onMusterStatus(() => {
      qc.invalidateQueries({ queryKey: ["muster-events"] });
      qc.invalidateQueries({ queryKey: ["muster-event"] });
    });
    return unsub;
  }, [qc]);

  const activeEventsQ = useQuery({
    queryKey: ["muster-events", "active"],
    queryFn: async () => {
      const r = await shiftsApi.listMusterEvents({ status: "active" });
      if (!r.success) throw new Error(r.error.message);
      return r.data.data;
    },
    refetchInterval: 10_000,
  });

  const historyQ = useQuery({
    queryKey: ["muster-events", "all"],
    queryFn: async () => {
      const r = await shiftsApi.listMusterEvents();
      if (!r.success) throw new Error(r.error.message);
      return r.data.data;
    },
  });

  const pointsQ = useQuery({
    queryKey: ["muster-points"],
    queryFn: async () => {
      const r = await shiftsApi.listMusterPoints();
      if (!r.success) throw new Error(r.error.message);
      return r.data.data;
    },
  });

  const activeEvent = activeEventsQ.data?.[0] ?? null;

  const eventDetailQ = useQuery({
    queryKey: ["muster-event", activeEvent?.id],
    queryFn: async () => {
      if (!activeEvent) return null;
      const r = await shiftsApi.getMusterEvent(activeEvent.id);
      if (!r.success) throw new Error(r.error.message);
      return r.data;
    },
    enabled: !!activeEvent,
    refetchInterval: 8_000,
  });

  const declareMut = useMutation({
    mutationFn: (payload: DeclareMusterPayload) =>
      shiftsApi.declareMusterEvent(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["muster-events"] });
      setConfirmDeclare(false);
    },
  });

  const resolveMut = useMutation({
    mutationFn: (id: string) => shiftsApi.resolveMusterEvent(id, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["muster-events"] });
      qc.invalidateQueries({ queryKey: ["muster-event"] });
    },
  });

  const accountMut = useMutation({
    mutationFn: ({
      eventId,
      payload,
    }: {
      eventId: string;
      payload: AccountPersonPayload;
    }) => shiftsApi.accountPerson(eventId, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["muster-event", activeEvent?.id] });
      qc.invalidateQueries({ queryKey: ["muster-events"] });
    },
  });

  const accounting = eventDetailQ.data?.accounting ?? [];
  const filtered =
    accountingFilter === "all"
      ? accounting
      : accounting.filter((a) => a.status === accountingFilter);

  const accounted = accounting.filter((a) => a.status !== "unaccounted").length;
  const total = accounting.length;
  const progressPct = total > 0 ? Math.round((accounted / total) * 100) : 0;

  const points = pointsQ.data ?? [];

  return (
    <div>
      {confirmDeclare && (
        <ConfirmDeclare
          onConfirm={() => declareMut.mutate({ trigger_type: "manual" })}
          onCancel={() => setConfirmDeclare(false)}
          isPending={declareMut.isPending}
        />
      )}

      {/* No active muster */}
      {!activeEvent && (
        <div
          style={{
            ...surface,
            padding: 32,
            textAlign: "center",
            marginBottom: 24,
          }}
        >
          <div
            style={{
              fontSize: 14,
              color: "var(--io-text-secondary)",
              marginBottom: 16,
            }}
          >
            No active muster event. Use the button below to declare an emergency
            muster.
          </div>
          <button
            onClick={() => setConfirmDeclare(true)}
            style={{
              padding: "12px 32px",
              border: "none",
              borderRadius: 6,
              background: "#f97316",
              color: "#fff",
              cursor: "pointer",
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: "0.03em",
            }}
          >
            DECLARE MUSTER
          </button>
        </div>
      )}

      {/* Active muster */}
      {activeEvent && eventDetailQ.data && (
        <div style={{ ...surface, marginBottom: 24 }}>
          {/* Header */}
          <div
            style={{
              padding: "16px 20px",
              background: "rgba(249,115,22,0.08)",
              borderBottom: "1px solid rgba(249,115,22,0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderRadius: "8px 8px 0 0",
            }}
          >
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: "#f97316" }}>
                ACTIVE MUSTER EVENT
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--io-text-muted)",
                  marginTop: 2,
                }}
              >
                Declared {new Date(activeEvent.declared_at).toLocaleString()}
                {activeEvent.declared_by_name &&
                  ` by ${activeEvent.declared_by_name}`}
                {activeEvent.total_on_site != null &&
                  ` · ${activeEvent.total_on_site} on-site at declaration`}
              </div>
            </div>
            <button
              onClick={() => resolveMut.mutate(activeEvent.id)}
              disabled={resolveMut.isPending}
              style={{
                padding: "8px 20px",
                border: "none",
                borderRadius: 6,
                background: "#22c55e",
                color: "#fff",
                cursor: "pointer",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {resolveMut.isPending ? "Resolving..." : "Resolve Muster"}
            </button>
          </div>

          {/* Progress */}
          <div
            style={{
              padding: "16px 20px",
              borderBottom: "1px solid var(--io-border)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 8,
                fontSize: 14,
              }}
            >
              <span style={{ fontWeight: 600 }}>
                {accounted} / {total} Accounted
              </span>
              <span style={{ color: "var(--io-text-muted)" }}>
                {progressPct}%
              </span>
            </div>
            <div
              style={{
                height: 8,
                background: "var(--io-surface-secondary)",
                borderRadius: 4,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  width: `${progressPct}%`,
                  background: progressPct === 100 ? "#22c55e" : "#f97316",
                  borderRadius: 4,
                  transition: "width 0.3s",
                }}
              />
            </div>
          </div>

          {/* Filter buttons */}
          <div
            style={{
              padding: "12px 16px",
              borderBottom: "1px solid var(--io-border)",
              display: "flex",
              gap: 6,
            }}
          >
            {[
              "all",
              "unaccounted",
              "accounted_manual",
              "accounted_badge",
              "off_site",
            ].map((f) => (
              <button
                key={f}
                onClick={() => setAccountingFilter(f)}
                style={{
                  padding: "4px 12px",
                  border: "1px solid var(--io-border)",
                  borderRadius: 100,
                  background:
                    accountingFilter === f
                      ? "var(--io-accent)"
                      : "var(--io-surface-secondary)",
                  color:
                    accountingFilter === f
                      ? "#fff"
                      : "var(--io-text-secondary)",
                  cursor: "pointer",
                  fontSize: 12,
                  fontWeight: 500,
                }}
              >
                {f === "all" ? "All" : f.replace(/_/g, " ")}
                {f === "unaccounted" &&
                  accounting.filter((a) => a.status === "unaccounted").length >
                    0 && (
                    <span
                      style={{
                        marginLeft: 4,
                        background: "#ef4444",
                        color: "#fff",
                        borderRadius: 100,
                        padding: "0 5px",
                        fontSize: 10,
                      }}
                    >
                      {
                        accounting.filter((a) => a.status === "unaccounted")
                          .length
                      }
                    </span>
                  )}
              </button>
            ))}
          </div>

          {/* Accounting table */}
          <div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 130px 140px 120px 160px",
                gap: 12,
                padding: "8px 16px",
                borderBottom: "1px solid var(--io-border)",
                fontSize: 11,
                fontWeight: 600,
                color: "var(--io-text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
            >
              <span>Name</span>
              <span>Status</span>
              <span>Muster Point</span>
              <span>Accounted At</span>
              <span>Actions</span>
            </div>
            {filtered.length === 0 && (
              <div
                style={{
                  padding: 24,
                  textAlign: "center",
                  color: "var(--io-text-muted)",
                  fontSize: 13,
                }}
              >
                No records match filter.
              </div>
            )}
            {filtered.map((a) => (
              <AccountingRow
                key={a.id}
                row={a}
                points={points}
                onAccount={(payload) =>
                  accountMut.mutate({ eventId: activeEvent.id, payload })
                }
              />
            ))}
          </div>
        </div>
      )}

      {/* Historical events */}
      {(historyQ.data ?? []).filter((e) => e.status === "resolved").length >
        0 && (
        <div>
          <h3
            style={{
              fontSize: 14,
              fontWeight: 600,
              margin: "0 0 12px",
              color: "var(--io-text-secondary)",
            }}
          >
            Historical Muster Events
          </h3>
          <div style={surface}>
            {(historyQ.data ?? [])
              .filter((e) => e.status === "resolved")
              .map((e) => (
                <MusterHistoryRow key={e.id} event={e} />
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AccountingRow({
  row,
  points,
  onAccount,
}: {
  row: MusterAccounting;
  points: MusterPoint[];
  onAccount: (p: AccountPersonPayload) => void;
}) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 130px 140px 120px 160px",
        gap: 12,
        padding: "10px 16px",
        borderBottom: "1px solid var(--io-border)",
        alignItems: "center",
        fontSize: 13,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <Avatar name={row.display_name} />
        <div>
          <div style={{ fontWeight: 500 }}>
            {row.display_name ?? row.email ?? row.user_id}
          </div>
        </div>
      </div>
      <StatusBadge status={row.status} />
      <span style={{ color: "var(--io-text-secondary)", fontSize: 12 }}>
        {row.muster_point_name ?? "—"}
      </span>
      <span style={{ color: "var(--io-text-secondary)", fontSize: 12 }}>
        {row.accounted_at
          ? new Date(row.accounted_at).toLocaleTimeString()
          : "—"}
      </span>
      <div style={{ display: "flex", gap: 6 }}>
        {row.status === "unaccounted" && (
          <>
            <button
              onClick={() =>
                onAccount({
                  user_id: row.user_id,
                  status: "accounted_manual",
                  muster_point_id: points[0]?.id,
                })
              }
              style={{
                padding: "3px 10px",
                border: "1px solid #22c55e",
                borderRadius: 4,
                background: "rgba(34,197,94,0.1)",
                color: "#22c55e",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 500,
              }}
            >
              Account
            </button>
            <button
              onClick={() =>
                onAccount({ user_id: row.user_id, status: "off_site" })
              }
              style={{
                padding: "3px 10px",
                border: "1px solid var(--io-border)",
                borderRadius: 4,
                background: "none",
                color: "var(--io-text-muted)",
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              Off Site
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function MusterHistoryRow({ event }: { event: MusterEvent }) {
  const pct =
    event.accounting_total && event.accounting_total > 0
      ? Math.round(
          ((event.accounting_accounted ?? 0) / event.accounting_total) * 100,
        )
      : null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "12px 16px",
        borderBottom: "1px solid var(--io-border)",
        fontSize: 13,
      }}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 500 }}>
          {new Date(event.declared_at).toLocaleString()}
          {event.declared_by_name && ` — ${event.declared_by_name}`}
        </div>
        {event.resolved_at && (
          <div
            style={{
              fontSize: 12,
              color: "var(--io-text-muted)",
              marginTop: 2,
            }}
          >
            Resolved {new Date(event.resolved_at).toLocaleString()}
            {event.total_on_site != null && ` · ${event.total_on_site} on-site`}
          </div>
        )}
      </div>
      {pct !== null && (
        <span style={{ fontSize: 12, color: "var(--io-text-muted)" }}>
          {event.accounting_accounted}/{event.accounting_total} ({pct}%)
        </span>
      )}
      <StatusBadge status={event.status} />
    </div>
  );
}

function ConfirmDeclare({
  onConfirm,
  onCancel,
  isPending,
}: {
  onConfirm: () => void;
  onCancel: () => void;
  isPending: boolean;
}) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        style={{
          background: "var(--io-surface)",
          border: "1px solid var(--io-border)",
          borderRadius: 8,
          padding: 28,
          width: 420,
          maxWidth: "90vw",
        }}
      >
        <h3 style={{ margin: "0 0 8px", color: "#f97316", fontSize: 17 }}>
          Declare Emergency Muster?
        </h3>
        <p
          style={{
            margin: "0 0 20px",
            color: "var(--io-text-secondary)",
            fontSize: 14,
            lineHeight: 1.5,
          }}
        >
          This will initiate an emergency headcount for all on-site personnel.
          Accountability rows will be created for all currently tracked
          personnel. This action is logged and cannot be undone.
        </p>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button onClick={onCancel} style={ghostBtn}>
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isPending}
            style={{
              padding: "8px 20px",
              border: "none",
              borderRadius: 6,
              background: "#f97316",
              color: "#fff",
              cursor: isPending ? "not-allowed" : "pointer",
              fontSize: 14,
              fontWeight: 700,
              opacity: isPending ? 0.7 : 1,
            }}
          >
            {isPending ? "Declaring..." : "DECLARE MUSTER"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Badge Sources settings (sub-section under Schedule or Settings)
// ---------------------------------------------------------------------------

function BadgeSourcesSection() {
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [newSource, setNewSource] = useState<Partial<CreateBadgeSourcePayload>>(
    {},
  );

  const sourcesQ = useQuery({
    queryKey: ["badge-sources"],
    queryFn: async () => {
      const r = await shiftsApi.listBadgeSources();
      if (!r.success) throw new Error(r.error.message);
      return r.data.data;
    },
  });

  const createMut = useMutation({
    mutationFn: (payload: CreateBadgeSourcePayload) =>
      shiftsApi.createBadgeSource(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["badge-sources"] });
      setShowNew(false);
      setNewSource({});
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => shiftsApi.deleteBadgeSource(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["badge-sources"] }),
  });

  const toggleMut = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      shiftsApi.updateBadgeSource(id, { enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["badge-sources"] }),
  });

  const sources: BadgeSource[] = sourcesQ.data ?? [];

  return (
    <div style={{ marginTop: 32 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 12,
        }}
      >
        <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>
          Badge Access Sources
        </h3>
        <button onClick={() => setShowNew((v) => !v)} style={ghostBtnAccent}>
          + Add Source
        </button>
      </div>

      {showNew && (
        <div style={{ ...surface, padding: 16, marginBottom: 16 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              marginBottom: 12,
            }}
          >
            <div>
              <label
                style={{
                  fontSize: 12,
                  color: "var(--io-text-muted)",
                  display: "block",
                  marginBottom: 4,
                }}
              >
                Name *
              </label>
              <input
                value={newSource.name ?? ""}
                onChange={(e) =>
                  setNewSource((s) => ({ ...s, name: e.target.value }))
                }
                placeholder="e.g. Main Building"
                style={inputStyle}
              />
            </div>
            <div>
              <label
                style={{
                  fontSize: 12,
                  color: "var(--io-text-muted)",
                  display: "block",
                  marginBottom: 4,
                }}
              >
                Adapter Type *
              </label>
              <select
                value={newSource.adapter_type ?? ""}
                onChange={(e) =>
                  setNewSource((s) => ({ ...s, adapter_type: e.target.value }))
                }
                style={inputStyle}
              >
                <option value="">Select adapter...</option>
                {[
                  "lenel",
                  "ccure",
                  "genetec",
                  "honeywell",
                  "gallagher",
                  "generic_db",
                ].map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => {
                if (!newSource.name || !newSource.adapter_type) return;
                createMut.mutate({
                  name: newSource.name,
                  adapter_type: newSource.adapter_type,
                });
              }}
              disabled={createMut.isPending}
              style={primaryBtn}
            >
              {createMut.isPending ? "Creating..." : "Add Source"}
            </button>
            <button onClick={() => setShowNew(false)} style={ghostBtn}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div style={surface}>
        {sources.length === 0 && (
          <div
            style={{
              padding: 28,
              textAlign: "center",
              color: "var(--io-text-muted)",
              fontSize: 13,
            }}
          >
            No badge sources configured.
          </div>
        )}
        {sources.map((s) => (
          <div
            key={s.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 16px",
              borderBottom: "1px solid var(--io-border)",
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 500, fontSize: 14 }}>{s.name}</div>
              <div
                style={{
                  fontSize: 12,
                  color: "var(--io-text-muted)",
                  marginTop: 2,
                }}
              >
                {s.adapter_type} · poll every {s.poll_interval_s}s
                {s.last_poll_at &&
                  ` · last poll ${new Date(s.last_poll_at).toLocaleString()}`}
                {s.last_poll_ok === false && (
                  <span style={{ color: "#ef4444", marginLeft: 6 }}>ERROR</span>
                )}
              </div>
            </div>
            <button
              onClick={() =>
                toggleMut.mutate({ id: s.id, enabled: !s.enabled })
              }
              style={{
                padding: "4px 12px",
                border: "1px solid var(--io-border)",
                borderRadius: 4,
                background: s.enabled
                  ? "rgba(34,197,94,0.1)"
                  : "var(--io-surface-secondary)",
                color: s.enabled ? "#22c55e" : "var(--io-text-muted)",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 500,
              }}
            >
              {s.enabled ? "Enabled" : "Disabled"}
            </button>
            <button
              onClick={() => deleteMut.mutate(s.id)}
              style={{
                padding: "4px 10px",
                border: "1px solid var(--io-border)",
                borderRadius: 4,
                background: "none",
                color: "var(--io-text-muted)",
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              Delete
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared button styles
// ---------------------------------------------------------------------------

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "7px 10px",
  border: "1px solid var(--io-border)",
  borderRadius: 6,
  background: "var(--io-surface-secondary)",
  color: "var(--io-text)",
  fontSize: 13,
  boxSizing: "border-box",
};

const primaryBtn: React.CSSProperties = {
  padding: "7px 16px",
  border: "none",
  borderRadius: 6,
  background: "var(--io-accent)",
  color: "#fff",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 500,
};

const ghostBtn: React.CSSProperties = {
  padding: "7px 16px",
  border: "1px solid var(--io-border)",
  borderRadius: 6,
  background: "none",
  color: "var(--io-text-secondary)",
  cursor: "pointer",
  fontSize: 13,
};

const ghostBtnAccent: React.CSSProperties = {
  padding: "6px 14px",
  border: "1px solid var(--io-accent)",
  borderRadius: 6,
  background: "none",
  color: "var(--io-accent)",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 500,
};

// ---------------------------------------------------------------------------
// BadgeEventsTab
// ---------------------------------------------------------------------------

const EVENT_TYPE_COLORS: Record<string, [string, string]> = {
  access_granted: ["#22c55e", "rgba(34,197,94,0.12)"],
  SwipeIn: ["#22c55e", "rgba(34,197,94,0.12)"],
  access_denied: ["#ef4444", "rgba(239,68,68,0.12)"],
  AccessDenied: ["#ef4444", "rgba(239,68,68,0.12)"],
  DoorForced: ["#ef4444", "rgba(239,68,68,0.12)"],
  Duress: ["#ef4444", "rgba(239,68,68,0.12)"],
  Tailgate: ["#ef4444", "rgba(239,68,68,0.12)"],
  PassbackViolation: ["#ef4444", "rgba(239,68,68,0.12)"],
  SwipeOut: ["#6b7280", "rgba(107,114,128,0.12)"],
};

function BadgeEventsTab() {
  const eventsQuery = useQuery({
    queryKey: ["badge-events"],
    queryFn: async () => {
      const result = await shiftsApi.listBadgeEvents();
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    refetchInterval: 10000,
  });

  const events: BadgeEvent[] = eventsQuery.data ?? [];

  const eventBadge = (eventType: string) => {
    const [color, bg] = EVENT_TYPE_COLORS[eventType] ?? [
      "#eab308",
      "rgba(234,179,8,0.12)",
    ];
    return (
      <span
        style={{
          ...badge(color, bg),
          fontSize: 11,
        }}
      >
        {eventType.replace(/_/g, " ")}
      </span>
    );
  };

  return (
    <div style={{ ...surface, padding: 0, overflow: "hidden" }}>
      <div
        style={{
          padding: "14px 16px",
          borderBottom: "1px solid var(--io-border)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontWeight: 600, fontSize: 14 }}>
          Recent Badge Events
        </span>
        <span style={{ fontSize: 12, color: "var(--io-text-muted)" }}>
          {eventsQuery.isFetching ? "Refreshing…" : "Auto-refresh 10s"}
        </span>
      </div>

      {eventsQuery.isError && (
        <div
          style={{
            padding: "12px 16px",
            color: "var(--io-danger)",
            fontSize: 13,
          }}
        >
          {eventsQuery.error?.message ?? "Failed to load badge events"}
        </div>
      )}

      {!eventsQuery.isLoading && events.length === 0 && (
        <div
          style={{
            padding: "32px",
            textAlign: "center",
            color: "var(--io-text-muted)",
            fontSize: 13,
          }}
        >
          No badge events recorded yet.
        </div>
      )}

      {events.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {["Time", "Employee ID", "Event Type", "Door"].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: "8px 14px",
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "var(--io-text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    textAlign: "left",
                    borderBottom: "1px solid var(--io-border)",
                    background: "var(--io-surface-secondary)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {events.map((e: BadgeEvent) => (
              <tr
                key={e.id}
                style={{ borderBottom: "1px solid var(--io-border-subtle)" }}
              >
                <td
                  style={{
                    padding: "8px 14px",
                    fontSize: 12,
                    color: "var(--io-text-muted)",
                    whiteSpace: "nowrap",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {new Date(e.event_time).toLocaleString()}
                </td>
                <td
                  style={{
                    padding: "8px 14px",
                    fontSize: 13,
                    color: "var(--io-text-primary)",
                  }}
                >
                  {e.employee_id ?? e.badge_id ?? "—"}
                </td>
                <td style={{ padding: "8px 14px" }}>
                  {eventBadge(e.event_type)}
                </td>
                <td
                  style={{
                    padding: "8px 14px",
                    fontSize: 13,
                    color: "var(--io-text-secondary)",
                  }}
                >
                  {e.door_name ?? e.door_id ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root ShiftsPage
// ---------------------------------------------------------------------------

export default function ShiftsPage() {
  const [tab, setTab] = useState<Tab>("roster");
  const canManageBadgeConfig = usePermission("badge_config:manage");

  const presenceQ = useQuery({
    queryKey: ["presence"],
    queryFn: async () => {
      const r = await shiftsApi.listPresence();
      if (!r.success) throw new Error(r.error.message);
      return r.data.data;
    },
    refetchInterval: 15_000,
  });

  const presence = presenceQ.data ?? [];

  return (
    <div
      style={{
        padding: "24px 32px",
        maxWidth: 1200,
        margin: "0 auto",
        fontFamily: "inherit",
      }}
    >
      <div style={{ marginBottom: 20 }}>
        <h1
          style={{
            margin: "0 0 4px",
            fontSize: 22,
            fontWeight: 700,
            color: "var(--io-text)",
          }}
        >
          Shifts &amp; Access Control
        </h1>
        <p style={{ margin: 0, fontSize: 14, color: "var(--io-text-muted)" }}>
          Manage shift scheduling, personnel presence, and emergency mustering.
        </p>
      </div>

      <TabBar active={tab} onChange={setTab} />

      {tab === "roster" && <RosterTab presence={presence} />}

      {tab === "schedule" && (
        <>
          <ScheduleTab />
          {canManageBadgeConfig && <BadgeSourcesSection />}
        </>
      )}

      {tab === "presence" && <PresenceTab presence={presence} />}

      {tab === "muster" && <MusterTab />}

      {tab === "badge-events" && <BadgeEventsTab />}
    </div>
  );
}
