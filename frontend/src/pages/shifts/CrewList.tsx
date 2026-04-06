import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  shiftsApi,
  type ShiftCrew,
  type ShiftCrewDetail,
  type ShiftCrewMember,
  type CreateCrewPayload,
} from "../../api/shifts";
import { useContextMenu } from "../../shared/hooks/useContextMenu";
import ContextMenu from "../../shared/components/ContextMenu";

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const surface: React.CSSProperties = {
  background: "var(--io-surface)",
  border: "1px solid var(--io-border)",
  borderRadius: 8,
};

const fieldLabel: React.CSSProperties = {
  display: "block",
  fontSize: 11,
  fontWeight: 600,
  color: "var(--io-text-secondary)",
  marginBottom: 5,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "7px 11px",
  background: "var(--io-bg)",
  border: "1px solid var(--io-border)",
  borderRadius: 6,
  color: "var(--io-text-primary)",
  fontSize: 13,
  boxSizing: "border-box",
};

// ---------------------------------------------------------------------------
// Avatar
// ---------------------------------------------------------------------------

function Avatar({ name, color }: { name: string | null; color?: string }) {
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
        background: color ?? "var(--io-accent)",
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

// ---------------------------------------------------------------------------
// Crew color dot
// ---------------------------------------------------------------------------

function ColorDot({ color }: { color: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 10,
        height: 10,
        borderRadius: "50%",
        background: color,
        border: "1px solid rgba(0,0,0,0.15)",
        flexShrink: 0,
      }}
    />
  );
}

// ---------------------------------------------------------------------------
// Crew members panel (expanded)
// ---------------------------------------------------------------------------

function CrewMemberRow({
  member,
  crewId,
  onRemoved,
}: {
  member: ShiftCrewMember;
  crewId: string;
  onRemoved: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const { menuState, handleContextMenu, closeMenu } =
    useContextMenu<ShiftCrewMember>();

  const removeMutation = useMutation({
    mutationFn: async () => {
      const res = await shiftsApi.removeCrewMember(crewId, member.user_id);
      if (!res.success) throw new Error(res.error.message);
    },
    onSuccess: onRemoved,
  });

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "10px 16px",
          borderBottom: "1px solid var(--io-border)",
        }}
        onContextMenu={(e) => handleContextMenu(e, member)}
      >
        <Avatar name={member.display_name} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              color: "var(--io-text-primary)",
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            {member.display_name ?? member.email ?? "Unknown"}
          </div>
          {member.email && (
            <div style={{ color: "var(--io-text-muted)", fontSize: 12 }}>
              {member.email}
            </div>
          )}
        </div>
        {member.role_label && (
          <span
            style={{
              fontSize: 11,
              padding: "2px 8px",
              borderRadius: 100,
              background: "var(--io-surface-secondary)",
              color: "var(--io-text-secondary)",
              border: "1px solid var(--io-border)",
            }}
          >
            {member.role_label}
          </span>
        )}
        {confirming ? (
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={() => removeMutation.mutate()}
              disabled={removeMutation.isPending}
              style={{
                padding: "4px 10px",
                borderRadius: 5,
                border: "none",
                background: "#ef4444",
                color: "#fff",
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              {removeMutation.isPending ? "…" : "Remove"}
            </button>
            <button
              onClick={() => setConfirming(false)}
              style={{
                padding: "4px 10px",
                borderRadius: 5,
                border: "1px solid var(--io-border)",
                background: "transparent",
                color: "var(--io-text-secondary)",
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            style={{
              padding: "4px 10px",
              borderRadius: 5,
              border: "1px solid var(--io-border)",
              background: "transparent",
              color: "var(--io-text-muted)",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            Remove
          </button>
        )}
      </div>
      {menuState && (
        <ContextMenu
          x={menuState.x}
          y={menuState.y}
          items={[
            {
              label: "View Profile",
              onClick: () => {
                closeMenu();
              },
            },
            {
              label: "Edit",
              permission: "shifts:write",
              onClick: () => {
                closeMenu();
              },
            },
            {
              label: "Remove from Crew",
              danger: true,
              divider: true,
              onClick: () => {
                closeMenu();
                setConfirming(true);
              },
            },
          ]}
          onClose={closeMenu}
        />
      )}
    </>
  );
}

function CrewDetailPanel({ crew }: { crew: ShiftCrew }) {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<ShiftCrewDetail>({
    queryKey: ["shifts", "crew", crew.id],
    queryFn: async () => {
      const res = await shiftsApi.getCrew(crew.id);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
  });

  const members = data?.members ?? [];

  return (
    <div
      style={{
        borderTop: "1px solid var(--io-border)",
        background: "var(--io-bg)",
      }}
    >
      <div
        style={{
          padding: "10px 16px",
          fontSize: 11,
          fontWeight: 700,
          color: "var(--io-text-muted)",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          borderBottom: "1px solid var(--io-border)",
        }}
      >
        Members ({isLoading ? "…" : members.length})
      </div>
      {isLoading ? (
        <div
          style={{
            padding: "20px 16px",
            color: "var(--io-text-muted)",
            fontSize: 13,
          }}
        >
          Loading members…
        </div>
      ) : members.length === 0 ? (
        <div
          style={{
            padding: "20px 16px",
            color: "var(--io-text-muted)",
            fontSize: 13,
          }}
        >
          No members assigned to this crew.
        </div>
      ) : (
        members.map((m: ShiftCrewMember) => (
          <CrewMemberRow
            key={m.id}
            member={m}
            crewId={crew.id}
            onRemoved={() =>
              qc.invalidateQueries({ queryKey: ["shifts", "crew", crew.id] })
            }
          />
        ))
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Create crew form
// ---------------------------------------------------------------------------

const CREW_COLORS = [
  "#4a9eff",
  "#22c55e",
  "#f97316",
  "#a855f7",
  "#ef4444",
  "#eab308",
  "#06b6d4",
  "#ec4899",
];

function CreateCrewForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState(CREW_COLORS[0]);
  const [error, setError] = useState<string | null>(null);

  const createMutation = useMutation({
    mutationFn: async (payload: CreateCrewPayload) => {
      const res = await shiftsApi.createCrew(payload);
      if (!res.success) throw new Error(res.error.message);
      return res.data;
    },
    onSuccess: () => {
      setName("");
      setDescription("");
      setColor(CREW_COLORS[0]);
      setError(null);
      onCreated();
    },
    onError: (e: Error) => setError(e.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Crew name is required.");
      return;
    }
    createMutation.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
      color,
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      style={{ ...surface, padding: 20, marginBottom: 24 }}
    >
      <h3
        style={{
          margin: "0 0 16px",
          fontSize: 14,
          fontWeight: 600,
          color: "var(--io-text-primary)",
        }}
      >
        New Crew
      </h3>
      {error && (
        <div
          style={{
            padding: "8px 12px",
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: 6,
            color: "#ef4444",
            fontSize: 12,
            marginBottom: 14,
          }}
        >
          {error}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div>
          <label style={fieldLabel}>Name *</label>
          <input
            style={inputStyle}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Alpha Crew"
          />
        </div>
        <div>
          <label style={fieldLabel}>Description</label>
          <input
            style={inputStyle}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional"
          />
        </div>
      </div>
      <div style={{ marginTop: 14 }}>
        <label style={fieldLabel}>Color</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {CREW_COLORS.map((c: string) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: c,
                border:
                  color === c
                    ? "2px solid var(--io-text-primary)"
                    : "2px solid transparent",
                cursor: "pointer",
                padding: 0,
              }}
            />
          ))}
        </div>
      </div>
      <div
        style={{ marginTop: 16, display: "flex", justifyContent: "flex-end" }}
      >
        <button
          type="submit"
          disabled={createMutation.isPending}
          style={{
            padding: "7px 18px",
            borderRadius: 6,
            border: "none",
            background: createMutation.isPending
              ? "var(--io-border)"
              : "var(--io-accent)",
            color: "#fff",
            cursor: createMutation.isPending ? "not-allowed" : "pointer",
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          {createMutation.isPending ? "Creating…" : "Create Crew"}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Crew card
// ---------------------------------------------------------------------------

function CrewCard({
  crew,
  onDeleted,
}: {
  crew: ShiftCrew;
  onDeleted: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const qc = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await shiftsApi.deleteCrew(crew.id);
      if (!res.success) throw new Error(res.error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["shifts", "crews"] });
      onDeleted();
    },
  });

  return (
    <div style={{ ...surface, marginBottom: 12, overflow: "hidden" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "14px 16px",
          cursor: "pointer",
        }}
        onClick={() => setExpanded((v) => !v)}
      >
        <ColorDot color={crew.color} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              color: "var(--io-text-primary)",
              fontWeight: 600,
              fontSize: 14,
            }}
          >
            {crew.name}
          </div>
          {crew.description && (
            <div
              style={{
                color: "var(--io-text-muted)",
                fontSize: 12,
                marginTop: 1,
              }}
            >
              {crew.description}
            </div>
          )}
        </div>
        <span
          style={{
            fontSize: 12,
            color: "var(--io-text-muted)",
            background: "var(--io-surface-secondary)",
            padding: "2px 8px",
            borderRadius: 100,
            border: "1px solid var(--io-border)",
          }}
        >
          {crew.member_count ?? 0} member{crew.member_count !== 1 ? "s" : ""}
        </span>
        {confirming ? (
          <div
            style={{ display: "flex", gap: 6 }}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => deleteMutation.mutate()}
              disabled={deleteMutation.isPending}
              style={{
                padding: "4px 10px",
                borderRadius: 5,
                border: "none",
                background: "#ef4444",
                color: "#fff",
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              {deleteMutation.isPending ? "…" : "Delete"}
            </button>
            <button
              onClick={() => setConfirming(false)}
              style={{
                padding: "4px 10px",
                borderRadius: 5,
                border: "1px solid var(--io-border)",
                background: "transparent",
                color: "var(--io-text-secondary)",
                cursor: "pointer",
                fontSize: 12,
              }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setConfirming(true);
            }}
            style={{
              padding: "4px 10px",
              borderRadius: 5,
              border: "1px solid var(--io-border)",
              background: "transparent",
              color: "var(--io-text-muted)",
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            Delete
          </button>
        )}
        <span
          style={{
            color: "var(--io-text-muted)",
            fontSize: 16,
            userSelect: "none",
          }}
        >
          {expanded ? "▲" : "▼"}
        </span>
      </div>
      {expanded && <CrewDetailPanel crew={crew} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export default function CrewList() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["shifts", "crews"],
    queryFn: async () => {
      const res = await shiftsApi.listCrews();
      if (!res.success) throw new Error(res.error.message);
      return res.data.data;
    },
  });

  const crews = data ?? [];

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
            Crews
          </h2>
          <p
            style={{
              margin: "4px 0 0",
              color: "var(--io-text-muted)",
              fontSize: 13,
            }}
          >
            Manage shift crews and their members.
          </p>
        </div>
        <button
          onClick={() => setShowCreate((v) => !v)}
          style={{
            padding: "8px 16px",
            background: showCreate ? "var(--io-surface)" : "var(--io-accent)",
            color: showCreate ? "var(--io-text-secondary)" : "#fff",
            border: showCreate ? "1px solid var(--io-border)" : "none",
            borderRadius: 6,
            cursor: "pointer",
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          {showCreate ? "Cancel" : "+ New Crew"}
        </button>
      </div>

      {showCreate && (
        <CreateCrewForm
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ["shifts", "crews"] });
            setShowCreate(false);
          }}
        />
      )}

      {isLoading ? (
        <div
          style={{
            padding: 40,
            textAlign: "center",
            color: "var(--io-text-muted)",
          }}
        >
          Loading crews…
        </div>
      ) : isError ? (
        <div style={{ padding: 40, textAlign: "center", color: "#ef4444" }}>
          Failed to load crews.{" "}
          <button
            onClick={() => refetch()}
            style={{
              background: "none",
              border: "none",
              color: "var(--io-accent)",
              cursor: "pointer",
            }}
          >
            Retry
          </button>
        </div>
      ) : crews.length === 0 ? (
        <div
          style={{
            ...surface,
            padding: 40,
            textAlign: "center",
            color: "var(--io-text-muted)",
            fontSize: 13,
          }}
        >
          No crews defined yet. Create your first crew above.
        </div>
      ) : (
        <div>
          {crews.map((crew: ShiftCrew) => (
            <CrewCard
              key={crew.id}
              crew={crew}
              onDeleted={() =>
                qc.invalidateQueries({ queryKey: ["shifts", "crews"] })
              }
            />
          ))}
          <p
            style={{
              fontSize: 12,
              color: "var(--io-text-muted)",
              marginTop: 8,
            }}
          >
            {crews.length} crew{crews.length !== 1 ? "s" : ""}
          </p>
        </div>
      )}
    </div>
  );
}
