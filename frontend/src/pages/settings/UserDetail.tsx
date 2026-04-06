import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { usersApi, UserDetail as UserDetailData } from "../../api/users";
import { sessionsApi, Session } from "../../api/sessions";
import type { PaginatedResult } from "../../api/client";
import { cellStyle } from "./settingsStyles";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function SectionHeader({ title }: { title: string }) {
  return (
    <h4
      style={{
        margin: "0 0 12px",
        fontSize: "13px",
        fontWeight: 600,
        color: "var(--io-text-primary)",
        paddingBottom: "8px",
        borderBottom: "1px solid var(--io-border)",
      }}
    >
      {title}
    </h4>
  );
}

// ---------------------------------------------------------------------------
// UserDetail Dialog
// ---------------------------------------------------------------------------

interface UserDetailProps {
  userId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function UserDetail({
  userId,
  open,
  onOpenChange,
}: UserDetailProps) {
  const queryClient = useQueryClient();
  const [revokeError, setRevokeError] = useState<string | null>(null);

  const { data: user, isLoading } = useQuery({
    queryKey: ["user-detail-dialog", userId],
    queryFn: async () => {
      const r = await usersApi.get(userId);
      if (!r.success) throw new Error(r.error.message);
      return r.data as UserDetailData;
    },
    enabled: open && !!userId,
  });

  const sessionsQuery = useQuery({
    queryKey: ["user-sessions-dialog", userId],
    queryFn: async () => {
      const r = await sessionsApi.list({ user_id: userId, limit: 10 });
      if (!r.success) throw new Error(r.error.message);
      return (r.data as PaginatedResult<Session>).data;
    },
    enabled: open && !!userId,
  });

  const revokeMutation = useMutation({
    mutationFn: (id: string) => sessionsApi.revoke(id),
    onSuccess: (r) => {
      if (!r.success) {
        setRevokeError(r.error.message);
        return;
      }
      queryClient.invalidateQueries({
        queryKey: ["user-sessions-dialog", userId],
      });
      queryClient.invalidateQueries({ queryKey: ["admin-sessions"] });
    },
  });

  const initials = user
    ? (user.full_name ?? user.username)
        .split(" ")
        .map((w) => w[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  const sessions = sessionsQuery.data ?? [];

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{
            position: "fixed",
            inset: 0,
            background: "var(--io-overlay, rgba(0,0,0,0.5))",
            zIndex: 100,
          }}
        />
        <Dialog.Content
          aria-describedby={undefined}
          style={{
            position: "fixed",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            background: "var(--io-surface-elevated)",
            border: "1px solid var(--io-border)",
            borderRadius: "10px",
            padding: "24px",
            width: "640px",
            maxWidth: "95vw",
            maxHeight: "85vh",
            overflowY: "auto",
            zIndex: 101,
            boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
          }}
        >
          {/* Dialog header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "20px",
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
              User Detail
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
              >
                ✕
              </button>
            </Dialog.Close>
          </div>

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

          {!isLoading && user && (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "24px" }}
            >
              {/* ── Profile ─────────────────────────────────────────── */}
              <div>
                <SectionHeader title="Profile" />
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "16px",
                    marginBottom: "14px",
                  }}
                >
                  <div
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "50%",
                      background: "var(--io-accent-subtle)",
                      border: "1px solid var(--io-accent)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: "16px",
                      fontWeight: 700,
                      color: "var(--io-accent)",
                      flexShrink: 0,
                    }}
                  >
                    {initials}
                  </div>
                  <div>
                    <div
                      style={{
                        fontWeight: 600,
                        fontSize: "15px",
                        color: "var(--io-text-primary)",
                      }}
                    >
                      {user.full_name ?? user.username}
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "var(--io-text-muted)",
                      }}
                    >
                      {user.email}
                    </div>
                  </div>
                  <span
                    style={{
                      marginLeft: "auto",
                      display: "inline-block",
                      padding: "2px 10px",
                      borderRadius: "100px",
                      fontSize: "11px",
                      fontWeight: 600,
                      background: user.enabled
                        ? "rgba(22,163,74,0.12)"
                        : "var(--io-surface-secondary)",
                      color: user.enabled
                        ? "var(--io-success)"
                        : "var(--io-text-muted)",
                      border: user.enabled
                        ? "1px solid rgba(22,163,74,0.3)"
                        : "1px solid var(--io-border)",
                    }}
                  >
                    {user.enabled ? "Active" : "Disabled"}
                  </span>
                </div>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "6px 16px",
                    fontSize: "13px",
                  }}
                >
                  <div>
                    <span style={{ color: "var(--io-text-muted)" }}>
                      Username:{" "}
                    </span>
                    <span style={{ color: "var(--io-text-primary)" }}>
                      {user.username}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: "var(--io-text-muted)" }}>
                      Auth Provider:{" "}
                    </span>
                    <span
                      style={{
                        color: "var(--io-text-primary)",
                        textTransform: "capitalize",
                      }}
                    >
                      {user.auth_provider}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: "var(--io-text-muted)" }}>
                      Last Login:{" "}
                    </span>
                    <span style={{ color: "var(--io-text-primary)" }}>
                      {user.last_login_at
                        ? new Date(user.last_login_at).toLocaleString()
                        : "—"}
                    </span>
                  </div>
                  <div>
                    <span style={{ color: "var(--io-text-muted)" }}>
                      Account Created:{" "}
                    </span>
                    <span style={{ color: "var(--io-text-primary)" }}>
                      {new Date(user.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              {/* ── Roles ───────────────────────────────────────────── */}
              <div>
                <SectionHeader title="Roles" />
                {user.roles.length === 0 ? (
                  <p
                    style={{
                      margin: 0,
                      fontSize: "13px",
                      color: "var(--io-text-muted)",
                    }}
                  >
                    No roles assigned
                  </p>
                ) : (
                  <div
                    style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}
                  >
                    {user.roles.map((r) => (
                      <span
                        key={r.id}
                        style={{
                          padding: "3px 10px",
                          borderRadius: "100px",
                          fontSize: "12px",
                          fontWeight: 500,
                          background: "var(--io-accent-subtle)",
                          color: "var(--io-accent)",
                          border: "1px solid var(--io-accent)",
                        }}
                      >
                        {r.display_name}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* ── MFA Status ──────────────────────────────────────── */}
              <div>
                <SectionHeader title="MFA Status" />
                <p
                  style={{
                    margin: 0,
                    fontSize: "13px",
                    color: "var(--io-text-muted)",
                    lineHeight: 1.5,
                  }}
                >
                  MFA enrollment is self-managed by the user from their profile.
                  To reset a user's MFA, use the Edit User dialog.
                </p>
              </div>

              {/* ── Active Sessions ─────────────────────────────────── */}
              <div>
                <SectionHeader title="Active Sessions" />
                {revokeError && (
                  <div
                    style={{
                      padding: "8px 12px",
                      marginBottom: "10px",
                      background: "rgba(239,68,68,0.1)",
                      border: "1px solid rgba(239,68,68,0.3)",
                      borderRadius: "var(--io-radius)",
                      color: "var(--io-danger)",
                      fontSize: "12px",
                    }}
                  >
                    {revokeError}
                  </div>
                )}
                {sessionsQuery.isLoading ? (
                  <div
                    style={{
                      padding: "12px",
                      textAlign: "center",
                      color: "var(--io-text-muted)",
                      fontSize: "13px",
                    }}
                  >
                    Loading sessions…
                  </div>
                ) : sessions.length === 0 ? (
                  <p
                    style={{
                      margin: 0,
                      fontSize: "13px",
                      color: "var(--io-text-muted)",
                    }}
                  >
                    No active sessions
                  </p>
                ) : (
                  <div
                    style={{
                      border: "1px solid var(--io-border)",
                      borderRadius: "var(--io-radius)",
                      overflow: "hidden",
                    }}
                  >
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: "13px",
                      }}
                    >
                      <thead>
                        <tr
                          style={{
                            background: "var(--io-surface-primary)",
                            borderBottom: "1px solid var(--io-border)",
                          }}
                        >
                          {["IP Address", "Last Active", "Expires In", ""].map(
                            (h) => (
                              <th
                                key={h}
                                style={{
                                  padding: "8px 12px",
                                  textAlign: "left",
                                  fontSize: "11px",
                                  fontWeight: 600,
                                  color: "var(--io-text-muted)",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.05em",
                                }}
                              >
                                {h}
                              </th>
                            ),
                          )}
                        </tr>
                      </thead>
                      <tbody>
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
                            <td style={cellStyle}>
                              {formatRelative(s.last_accessed_at)}
                            </td>
                            <td style={cellStyle}>
                              {formatExpiry(s.expires_at)}
                            </td>
                            <td style={cellStyle}>
                              <button
                                style={{
                                  padding: "3px 10px",
                                  fontSize: "12px",
                                  background: "transparent",
                                  border: "1px solid rgba(239,68,68,0.3)",
                                  borderRadius: "var(--io-radius)",
                                  color: "var(--io-danger)",
                                  cursor: revokeMutation.isPending
                                    ? "not-allowed"
                                    : "pointer",
                                  opacity: revokeMutation.isPending ? 0.5 : 1,
                                }}
                                disabled={revokeMutation.isPending}
                                onClick={() => revokeMutation.mutate(s.id)}
                              >
                                Revoke
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
