import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { importApi, type StreamSession } from "../../api/import";

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, [string, string]> = {
  active: ["#22c55e", "rgba(34,197,94,0.12)"],
  connecting: ["#4a9eff", "rgba(74,158,255,0.12)"],
  reconnecting: ["#eab308", "rgba(234,179,8,0.12)"],
  failed: ["#ef4444", "rgba(239,68,68,0.12)"],
  stopped: ["#6b7280", "rgba(107,114,128,0.12)"],
};

function StatusBadge({ status }: { status: string }) {
  const [color, bg] = STATUS_COLORS[status] ?? STATUS_COLORS.stopped;
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: "999px",
        fontSize: "11px",
        fontWeight: 600,
        background: bg,
        color,
        textTransform: "capitalize",
        whiteSpace: "nowrap",
      }}
    >
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Relative time helper
// ---------------------------------------------------------------------------

function relativeTime(isoString: string | null): string {
  if (!isoString) return "—";
  const diff = Date.now() - new Date(isoString).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function StreamingSessionsPage() {
  const qc = useQueryClient();

  const sessionsQuery = useQuery({
    queryKey: ["import-stream-sessions"],
    queryFn: async () => {
      const result = await importApi.listStreamSessions();
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
    refetchInterval: 5000,
  });

  const stopMutation = useMutation({
    mutationFn: (defId: string) => importApi.stopStreamSession(defId),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["import-stream-sessions"] }),
  });

  const restartMutation = useMutation({
    mutationFn: (defId: string) => importApi.restartStreamSession(defId),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ["import-stream-sessions"] }),
  });

  const sessions = sessionsQuery.data ?? [];

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 20,
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: "17px",
              fontWeight: 600,
              color: "var(--io-text-primary)",
            }}
          >
            Streaming Sessions
          </h2>
          <p
            style={{
              margin: "4px 0 0",
              fontSize: "13px",
              color: "var(--io-text-muted)",
            }}
          >
            Active SSE/WebSocket import streams — auto-refreshes every 5s
          </p>
        </div>
      </div>

      {sessionsQuery.isLoading && (
        <div style={{ color: "var(--io-text-muted)", fontSize: 13 }}>
          Loading...
        </div>
      )}

      {sessionsQuery.isError && (
        <div
          style={{
            padding: "12px 16px",
            background: "var(--io-danger-subtle)",
            color: "var(--io-danger)",
            borderRadius: 6,
            fontSize: 13,
          }}
        >
          {sessionsQuery.error?.message ?? "Failed to load sessions"}
        </div>
      )}

      {!sessionsQuery.isLoading && sessions.length === 0 && (
        <div
          style={{
            padding: "32px",
            textAlign: "center",
            color: "var(--io-text-muted)",
            fontSize: 13,
          }}
        >
          No stream session definitions found. Create import definitions with a
          stream_session schedule to see them here.
        </div>
      )}

      {sessions.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              {[
                "Definition",
                "Connection",
                "Status",
                "Events",
                "Last Event",
                "Reconnects",
                "Actions",
              ].map((h) => (
                <th
                  key={h}
                  style={{
                    padding: "10px 14px",
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "var(--io-text-muted)",
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    textAlign: "left",
                    borderBottom: "1px solid var(--io-border)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sessions.map((s: StreamSession) => (
              <SessionRow
                key={s.definition_id}
                session={s}
                stopping={
                  stopMutation.isPending &&
                  stopMutation.variables === s.definition_id
                }
                restarting={
                  restartMutation.isPending &&
                  restartMutation.variables === s.definition_id
                }
                onStop={() => stopMutation.mutate(s.definition_id)}
                onRestart={() => restartMutation.mutate(s.definition_id)}
              />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Row component
// ---------------------------------------------------------------------------

interface SessionRowProps {
  session: StreamSession;
  stopping: boolean;
  restarting: boolean;
  onStop: () => void;
  onRestart: () => void;
}

function SessionRow({
  session,
  stopping,
  restarting,
  onStop,
  onRestart,
}: SessionRowProps) {
  const busy = stopping || restarting;

  return (
    <tr
      style={{
        borderBottom: "1px solid var(--io-border-subtle)",
      }}
    >
      <td
        style={{
          padding: "10px 14px",
          fontSize: 13,
          color: "var(--io-text-primary)",
          fontWeight: 500,
        }}
      >
        {session.definition_name}
      </td>
      <td
        style={{
          padding: "10px 14px",
          fontSize: 13,
          color: "var(--io-text-secondary)",
        }}
      >
        {session.connection_name}
      </td>
      <td style={{ padding: "10px 14px" }}>
        <StatusBadge status={session.status} />
        {session.error_message && (
          <div
            style={{
              fontSize: 11,
              color: "var(--io-danger)",
              marginTop: 2,
              maxWidth: 200,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
            title={session.error_message}
          >
            {session.error_message}
          </div>
        )}
      </td>
      <td
        style={{
          padding: "10px 14px",
          fontSize: 13,
          color: "var(--io-text-secondary)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {session.events_received.toLocaleString()}
      </td>
      <td
        style={{
          padding: "10px 14px",
          fontSize: 13,
          color: "var(--io-text-muted)",
          whiteSpace: "nowrap",
        }}
      >
        {relativeTime(session.last_event_at)}
      </td>
      <td
        style={{
          padding: "10px 14px",
          fontSize: 13,
          color: "var(--io-text-muted)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {session.reconnect_count}
      </td>
      <td style={{ padding: "10px 14px" }}>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            onClick={onStop}
            disabled={busy || session.status === "stopped"}
            style={{
              padding: "4px 10px",
              fontSize: 12,
              fontWeight: 500,
              borderRadius: 4,
              border: "1px solid var(--io-border)",
              background: "var(--io-surface-secondary)",
              color:
                busy || session.status === "stopped"
                  ? "var(--io-text-muted)"
                  : "var(--io-text-primary)",
              cursor:
                busy || session.status === "stopped"
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            {stopping ? "Stopping…" : "Stop"}
          </button>
          <button
            onClick={onRestart}
            disabled={busy}
            style={{
              padding: "4px 10px",
              fontSize: 12,
              fontWeight: 500,
              borderRadius: 4,
              border: "1px solid var(--io-accent)",
              background: "var(--io-accent-subtle)",
              color: busy ? "var(--io-text-muted)" : "var(--io-accent)",
              cursor: busy ? "not-allowed" : "pointer",
            }}
          >
            {restarting ? "Restarting…" : "Restart"}
          </button>
        </div>
      </td>
    </tr>
  );
}
