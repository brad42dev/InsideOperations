import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { sessionsApi, MySession } from "../../api/sessions";
import { useAuthStore } from "../../store/auth";

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatExpiry(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return "expired";
  const days = Math.floor(diff / 86400000);
  const hrs = Math.floor((diff % 86400000) / 3600000);
  if (days > 0) return `${days}d ${hrs}h`;
  const mins = Math.floor((diff % 3600000) / 60000);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

function parseAgent(ua: string | null): string {
  if (!ua) return "—";
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Edg/")) return "Edge";
  if (ua.includes("Chrome")) return "Chrome";
  if (ua.includes("Safari")) return "Safari";
  if (ua.includes("curl")) return "curl";
  if (ua.includes("python")) return "Python";
  return ua.length > 40 ? ua.slice(0, 40) + "…" : ua;
}

const cellStyle: React.CSSProperties = {
  padding: "10px 14px",
  fontSize: "13px",
  color: "var(--io-text-secondary)",
  verticalAlign: "middle",
};

const btnDanger: React.CSSProperties = {
  padding: "4px 10px",
  background: "transparent",
  color: "var(--io-danger)",
  border: "1px solid rgba(239,68,68,0.3)",
  borderRadius: "var(--io-radius)",
  fontSize: "12px",
  cursor: "pointer",
};

export default function SessionsTab() {
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const [bannerError, setBannerError] = useState<string | null>(null);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["my-sessions"],
    queryFn: async () => {
      const r = await sessionsApi.listMine();
      if (!r.success) throw new Error(r.error.message);
      return r.data as MySession[];
    },
  });

  const sessions = data ?? [];

  const revokeMutation = useMutation({
    mutationFn: (id: string) => sessionsApi.revokeMine(id),
    onSuccess: (r) => {
      if (!r.success) {
        setBannerError(r.error.message);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["my-sessions"] });
    },
  });

  return (
    <div>
      <p
        style={{
          margin: "0 0 16px",
          fontSize: "13px",
          color: "var(--io-text-muted)",
        }}
      >
        Active sessions for{" "}
        <strong style={{ color: "var(--io-text-primary)" }}>
          {user?.username}
        </strong>
        . Revoking a session signs you out on that device.
      </p>

      {bannerError && (
        <div
          style={{
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: "var(--io-radius)",
            padding: "10px 14px",
            color: "var(--io-danger)",
            fontSize: "13px",
            marginBottom: "16px",
          }}
        >
          {bannerError}
        </div>
      )}

      <div
        style={{
          background: "var(--io-surface-secondary)",
          border: "1px solid var(--io-border)",
          borderRadius: "8px",
          overflow: "hidden",
        }}
      >
        {isLoading && (
          <div
            style={{
              padding: "40px",
              textAlign: "center",
              color: "var(--io-text-muted)",
              fontSize: "14px",
            }}
          >
            Loading…
          </div>
        )}
        {isError && (
          <div
            style={{
              padding: "10px 14px",
              color: "var(--io-danger)",
              fontSize: "13px",
            }}
          >
            {(error as Error)?.message ?? "Failed to load sessions"}
          </div>
        )}
        {!isLoading && !isError && (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr
                style={{
                  borderBottom: "1px solid var(--io-border)",
                  background: "var(--io-surface-primary)",
                }}
              >
                {[
                  "IP Address",
                  "Browser",
                  "Signed In",
                  "Last Active",
                  "Expires In",
                  "Action",
                ].map((col) => (
                  <th
                    key={col}
                    style={{
                      padding: "10px 14px",
                      textAlign: "left",
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "var(--io-text-muted)",
                      textTransform: "uppercase",
                      letterSpacing: "0.06em",
                    }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sessions.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    style={{
                      padding: "40px",
                      textAlign: "center",
                      color: "var(--io-text-muted)",
                      fontSize: "14px",
                    }}
                  >
                    No active sessions
                  </td>
                </tr>
              )}
              {sessions.map((s, i) => (
                <tr
                  key={s.id}
                  style={{
                    borderBottom:
                      i < sessions.length - 1
                        ? "1px solid var(--io-border-subtle)"
                        : undefined,
                  }}
                >
                  <td style={cellStyle}>
                    <code
                      style={{
                        fontSize: "12px",
                        color: "var(--io-text-primary)",
                      }}
                    >
                      {s.ip_address ?? "—"}
                    </code>
                  </td>
                  <td style={cellStyle}>{parseAgent(s.user_agent)}</td>
                  <td style={cellStyle}>{formatRelative(s.created_at)}</td>
                  <td style={cellStyle}>
                    {formatRelative(s.last_accessed_at)}
                  </td>
                  <td style={cellStyle}>
                    <span
                      style={{
                        color: "var(--io-text-muted)",
                        fontSize: "12px",
                      }}
                    >
                      {formatExpiry(s.expires_at)}
                    </span>
                  </td>
                  <td style={cellStyle}>
                    <button
                      style={btnDanger}
                      disabled={revokeMutation.isPending}
                      onClick={() => revokeMutation.mutate(s.id)}
                    >
                      Sign Out
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
