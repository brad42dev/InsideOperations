import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { roundsApi, type RoundInstance } from "../../api/rounds";
import { useContextMenu } from "../../shared/hooks/useContextMenu";
import ContextMenu from "../../shared/components/ContextMenu";

function statusBadge(status: RoundInstance["status"]) {
  const map: Record<string, { bg: string; text: string }> = {
    pending: { bg: "rgba(251,191,36,0.15)", text: "var(--io-alarm-high)" },
    in_progress: { bg: "rgba(74,158,255,0.15)", text: "var(--io-accent)" },
    completed: { bg: "rgba(34,197,94,0.12)", text: "var(--io-alarm-normal)" },
    missed: { bg: "rgba(239,68,68,0.12)", text: "var(--io-alarm-urgent)" },
    transferred: {
      bg: "rgba(168,85,247,0.12)",
      text: "var(--io-warning)",
    },
  };
  const c = map[status] ?? {
    bg: "var(--io-surface-secondary)",
    text: "var(--io-text-muted)",
  };
  return (
    <span
      style={{
        fontSize: "11px",
        padding: "2px 8px",
        borderRadius: "100px",
        background: c.bg,
        color: c.text,
        fontWeight: 700,
        letterSpacing: "0.04em",
      }}
    >
      {status.replace("_", " ")}
    </span>
  );
}

function DueBadge({ due }: { due?: string }) {
  if (!due) return null;
  const d = new Date(due);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  if (diff < 0)
    return (
      <span
        style={{
          color: "var(--io-alarm-urgent)",
          fontWeight: 600,
          fontSize: "12px",
        }}
      >
        Overdue
      </span>
    );
  if (diff < 60 * 60 * 1000)
    return (
      <span
        style={{
          color: "var(--io-alarm-high)",
          fontWeight: 600,
          fontSize: "12px",
        }}
      >
        Due in {Math.round(diff / 60000)}m
      </span>
    );
  return (
    <span style={{ fontSize: "12px", color: "var(--io-text-muted)" }}>
      Due {d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
    </span>
  );
}

export default function ActiveRounds() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: activeData, isLoading } = useQuery({
    queryKey: ["rounds", "instances", "in_progress"],
    queryFn: () => roundsApi.listInstances({ status: "in_progress" }),
    refetchInterval: 30_000,
  });

  const { data: pendingData } = useQuery({
    queryKey: ["rounds", "instances", "pending"],
    queryFn: () => roundsApi.listInstances({ status: "pending" }),
    refetchInterval: 30_000,
  });

  const startMutation = useMutation({
    mutationFn: (id: string) => roundsApi.startInstance(id),
    onSuccess: (result, id) => {
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ["rounds", "instances"] });
        navigate(`/rounds/${id}`);
      }
    },
  });

  const activeInstances = activeData?.success ? activeData.data : [];
  const pendingInstances = pendingData?.success ? pendingData.data : [];
  const { menuState, handleContextMenu, closeMenu } =
    useContextMenu<RoundInstance>();

  const cardStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "14px 16px",
    background: "var(--io-surface)",
    border: "1px solid var(--io-border)",
    borderRadius: "8px",
    cursor: "pointer",
    transition: "border-color 0.15s",
  };

  return (
    <div
      style={{
        padding: "var(--io-space-6)",
        display: "flex",
        flexDirection: "column",
        gap: "24px",
      }}
    >
      <div>
        <h2
          style={{
            margin: 0,
            fontSize: "20px",
            fontWeight: 700,
            color: "var(--io-text-primary)",
          }}
        >
          Active Rounds
        </h2>
        <p
          style={{
            margin: "4px 0 0",
            fontSize: "14px",
            color: "var(--io-text-secondary)",
          }}
        >
          Currently running and pending inspection rounds.
        </p>
      </div>

      {/* In-Progress */}
      <section>
        <h3
          style={{
            margin: "0 0 12px",
            fontSize: "13px",
            fontWeight: 700,
            color: "var(--io-text-secondary)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          In Progress ({activeInstances.length})
        </h3>
        {isLoading ? (
          <div style={{ color: "var(--io-text-muted)", fontSize: "14px" }}>
            Loading…
          </div>
        ) : activeInstances.length === 0 ? (
          <div
            style={{
              padding: "24px",
              textAlign: "center",
              color: "var(--io-text-muted)",
              fontSize: "14px",
              background: "var(--io-surface)",
              borderRadius: "8px",
              border: "1px solid var(--io-border)",
            }}
          >
            No rounds currently in progress.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {activeInstances.map((inst) => (
              <div
                key={inst.id}
                onClick={() => navigate(`/rounds/${inst.id}`)}
                onContextMenu={(e) => handleContextMenu(e, inst)}
                style={cardStyle}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.borderColor = "var(--io-accent)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.borderColor = "var(--io-border)")
                }
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: "14px",
                      color: "var(--io-text-primary)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {inst.template_name ?? "Unnamed template"}
                  </div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "var(--io-text-muted)",
                      marginTop: "2px",
                    }}
                  >
                    Started{" "}
                    {inst.started_at
                      ? new Date(inst.started_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                    {inst.locked_to_user && ` · ${inst.locked_to_user}`}
                  </div>
                </div>
                <div
                  style={{ display: "flex", alignItems: "center", gap: "10px" }}
                >
                  <DueBadge due={inst.due_by} />
                  {statusBadge(inst.status)}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Pending */}
      {pendingInstances.length > 0 && (
        <section>
          <h3
            style={{
              margin: "0 0 12px",
              fontSize: "13px",
              fontWeight: 700,
              color: "var(--io-text-secondary)",
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            Pending ({pendingInstances.length})
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {pendingInstances.map((inst) => (
              <div
                key={inst.id}
                onContextMenu={(e) => handleContextMenu(e, inst)}
                style={{ ...cardStyle, cursor: "default" }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 600,
                      fontSize: "14px",
                      color: "var(--io-text-primary)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {inst.template_name ?? "Unnamed template"}
                  </div>
                  <div
                    style={{
                      fontSize: "12px",
                      color: "var(--io-text-muted)",
                      marginTop: "2px",
                    }}
                  >
                    Created{" "}
                    {new Date(inst.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
                <div
                  style={{ display: "flex", alignItems: "center", gap: "10px" }}
                >
                  <DueBadge due={inst.due_by} />
                  {statusBadge(inst.status)}
                  <button
                    onClick={() => startMutation.mutate(inst.id)}
                    disabled={startMutation.isPending}
                    style={{
                      padding: "6px 14px",
                      background: "var(--io-accent)",
                      border: "none",
                      borderRadius: "6px",
                      color: "var(--io-accent-foreground)",
                      fontSize: "13px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Start
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
      {menuState && (
        <ContextMenu
          x={menuState.x}
          y={menuState.y}
          items={[
            {
              label: "View",
              onClick: () => {
                closeMenu();
                navigate(`/rounds/${menuState.data!.id}`);
              },
            },
            {
              label: "Resume",
              permission: "rounds:execute",
              onClick: () => {
                closeMenu();
                navigate(`/rounds/${menuState.data!.id}`);
              },
            },
            {
              label: "Abandon",
              danger: true,
              divider: true,
              onClick: () => {
                closeMenu();
              },
            },
          ]}
          onClose={closeMenu}
        />
      )}
    </div>
  );
}
