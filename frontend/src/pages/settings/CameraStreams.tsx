import React, { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { ConfirmDialog } from "../../shared/components/ConfirmDialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  videoStreamsApi,
  type VideoStream,
  type CreateVideoStreamInput,
  type VideoStreamAccess,
} from "../../api/videoStreams";
import { rolesApi, type Role } from "../../api/roles";
import { usersApi, type User } from "../../api/users";
import SettingsPageLayout from "./SettingsPageLayout";
import {
  inputStyle,
  labelStyle,
  btnPrimary,
  btnSecondary,
  btnSmall,
  cellStyle,
} from "./settingsStyles";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function ErrorBanner({ message }: { message: string }) {
  return (
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
      {message}
    </div>
  );
}

function SuccessBanner({ message }: { message: string }) {
  return (
    <div
      style={{
        background: "rgba(34,197,94,0.1)",
        border: "1px solid rgba(34,197,94,0.3)",
        borderRadius: "var(--io-radius)",
        padding: "10px 14px",
        color: "var(--io-success, #22c55e)",
        fontSize: "13px",
        marginBottom: "16px",
      }}
    >
      {message}
    </div>
  );
}

function ModalContent({
  title,
  children,
  width = 560,
}: {
  title: string;
  children: React.ReactNode;
  width?: number;
}) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.6)",
          zIndex: 100,
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
          width,
          maxWidth: "95vw",
          maxHeight: "90vh",
          overflowY: "auto",
          zIndex: 101,
          boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
        }}
      >
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
            {title}
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
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  );
}

// ---------------------------------------------------------------------------
// RelayInputsEditor — edit the go2rtc input URL list
// ---------------------------------------------------------------------------
function RelayInputsEditor({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}) {
  function setLine(i: number, text: string) {
    const next = [...value];
    next[i] = text;
    onChange(next);
  }
  function removeLine(i: number) {
    onChange(value.filter((_, idx) => idx !== i));
  }
  function addLine() {
    onChange([...value, ""]);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {value.map((url, i) => (
        <div key={i} style={{ display: "flex", gap: "6px" }}>
          <input
            style={{
              ...inputStyle,
              flex: 1,
              fontFamily: "ui-monospace, monospace",
              fontSize: "12px",
            }}
            value={url}
            onChange={(e) => setLine(i, e.target.value)}
            placeholder="rtsp://camera.local/stream1"
          />
          <button
            type="button"
            style={{
              ...btnSmall,
              color: "var(--io-danger)",
              borderColor: "rgba(239,68,68,0.3)",
            }}
            onClick={() => removeLine(i)}
          >
            ✕
          </button>
        </div>
      ))}
      <button type="button" style={btnSmall} onClick={addLine}>
        + Add URL
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CameraStreamDialog — create and edit
// ---------------------------------------------------------------------------
type StreamFormState = {
  name: string;
  description: string;
  visibility: VideoStream["visibility"];
  connection_mode: VideoStream["connection_mode"];
  direct_url: string;
  relay_inputs: string[];
};

function defaultFormState(stream: VideoStream | null): StreamFormState {
  return {
    name: stream?.name ?? "",
    description: stream?.description ?? "",
    visibility: stream?.visibility ?? "managed",
    connection_mode: stream?.connection_mode ?? "relay",
    direct_url: stream?.direct_url ?? "",
    relay_inputs: stream?.relay_config?.go2rtc_inputs ?? [""],
  };
}

function validateForm(form: StreamFormState): string | null {
  if (!form.name.trim()) return "Name is required.";
  if (
    (form.connection_mode === "direct" || form.connection_mode === "auto") &&
    !form.direct_url.trim()
  ) {
    return "Direct URL is required for the selected connection mode.";
  }
  if (
    (form.connection_mode === "relay" || form.connection_mode === "auto") &&
    form.relay_inputs.every((u) => !u.trim())
  ) {
    return "At least one relay input URL is required for the selected connection mode.";
  }
  return null;
}

function buildPayload(form: StreamFormState): CreateVideoStreamInput {
  const payload: CreateVideoStreamInput = {
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    visibility: form.visibility,
    connection_mode: form.connection_mode,
  };
  if (form.connection_mode === "direct" || form.connection_mode === "auto") {
    payload.direct_url = form.direct_url.trim() || undefined;
  }
  if (form.connection_mode === "relay" || form.connection_mode === "auto") {
    const inputs = form.relay_inputs.map((u) => u.trim()).filter(Boolean);
    payload.relay_config = { go2rtc_inputs: inputs };
  }
  return payload;
}

function CameraStreamDialog({
  stream,
  onClose,
}: {
  stream: VideoStream | null;
  onClose: () => void;
}) {
  const isNew = stream === null;
  const qc = useQueryClient();
  const [form, setForm] = useState<StreamFormState>(() =>
    defaultFormState(stream),
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<
    "idle" | "testing" | "ok" | "fail"
  >("idle");
  const [testMessage, setTestMessage] = useState("");

  function patch(partial: Partial<StreamFormState>) {
    setForm((f) => ({ ...f, ...partial }));
  }

  const saveMut = useMutation({
    mutationFn: (payload: CreateVideoStreamInput) =>
      isNew
        ? videoStreamsApi.create(payload)
        : videoStreamsApi.update(stream!.id, payload),
    onSuccess: (result) => {
      if (!result.success) {
        setFormError(result.error.message);
        return;
      }
      qc.invalidateQueries({ queryKey: ["video-streams"] });
      onClose();
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    const err = validateForm(form);
    if (err) {
      setFormError(err);
      return;
    }
    saveMut.mutate(buildPayload(form));
  }

  async function handleTestConnection() {
    if (!stream) return;
    setTestStatus("testing");
    setTestMessage("");
    const result = await videoStreamsApi.token(stream.id);
    if (result.success) {
      setTestStatus("ok");
      setTestMessage("go2rtc connection confirmed.");
    } else {
      setTestStatus("fail");
      setTestMessage(result.error.message);
    }
  }

  const showDirectUrl =
    form.connection_mode === "direct" || form.connection_mode === "auto";
  const showRelay =
    form.connection_mode === "relay" || form.connection_mode === "auto";

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <ModalContent
        title={isNew ? "Add Camera Stream" : `Edit: ${stream?.name}`}
      >
        {formError && <ErrorBanner message={formError} />}
        {testStatus === "ok" && <SuccessBanner message={testMessage} />}
        {testStatus === "fail" && <ErrorBanner message={testMessage} />}

        <form onSubmit={handleSubmit}>
          <div
            style={{ display: "flex", flexDirection: "column", gap: "14px" }}
          >
            <div>
              <label style={labelStyle}>Name *</label>
              <input
                style={inputStyle}
                value={form.name}
                onChange={(e) => patch({ name: e.target.value })}
                placeholder="e.g. Line 3 Camera"
                required
              />
            </div>

            <div>
              <label style={labelStyle}>Description</label>
              <input
                style={inputStyle}
                value={form.description}
                onChange={(e) => patch({ description: e.target.value })}
                placeholder="Optional description"
              />
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "12px",
              }}
            >
              <div>
                <label style={labelStyle}>Visibility</label>
                <select
                  style={inputStyle}
                  value={form.visibility}
                  onChange={(e) =>
                    patch({
                      visibility: e.target.value as VideoStream["visibility"],
                    })
                  }
                >
                  <option value="public">Public — everyone can view</option>
                  <option value="managed">
                    Managed — admin adds, anyone views
                  </option>
                  <option value="private">
                    Private — explicit ACL required
                  </option>
                </select>
              </div>

              <div>
                <label style={labelStyle}>Connection Mode</label>
                <select
                  style={inputStyle}
                  value={form.connection_mode}
                  onChange={(e) =>
                    patch({
                      connection_mode: e.target
                        .value as VideoStream["connection_mode"],
                    })
                  }
                >
                  <option value="direct">
                    Direct — browser reaches camera
                  </option>
                  <option value="relay">Relay — go2rtc proxy</option>
                  <option value="auto">
                    Auto — direct first, relay fallback
                  </option>
                </select>
              </div>
            </div>

            {showDirectUrl && (
              <div>
                <label style={labelStyle}>
                  Direct URL{form.connection_mode === "direct" ? " *" : ""}
                </label>
                <input
                  style={{
                    ...inputStyle,
                    fontFamily: "ui-monospace, monospace",
                    fontSize: "12px",
                  }}
                  value={form.direct_url}
                  onChange={(e) => patch({ direct_url: e.target.value })}
                  placeholder="rtsp://camera.local/stream1"
                />
                <p
                  style={{
                    margin: "4px 0 0",
                    fontSize: "11px",
                    color: "var(--io-text-muted)",
                  }}
                >
                  Direct mode requires the browser to reach the camera; intended
                  for private networks.
                </p>
              </div>
            )}

            {showRelay && (
              <div>
                <label style={labelStyle}>
                  go2rtc Input URLs
                  {form.connection_mode === "relay" ? " *" : ""}
                </label>
                <RelayInputsEditor
                  value={form.relay_inputs}
                  onChange={(inputs) => patch({ relay_inputs: inputs })}
                />
              </div>
            )}
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "8px",
              marginTop: "24px",
            }}
          >
            <div>
              {!isNew && showRelay && (
                <button
                  type="button"
                  style={btnSmall}
                  disabled={testStatus === "testing"}
                  onClick={handleTestConnection}
                >
                  {testStatus === "testing" ? "Testing…" : "Test Connection"}
                </button>
              )}
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <Dialog.Close asChild>
                <button type="button" style={btnSecondary}>
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="submit"
                style={btnPrimary}
                disabled={saveMut.isPending}
              >
                {saveMut.isPending
                  ? "Saving…"
                  : isNew
                    ? "Add Stream"
                    : "Save Changes"}
              </button>
            </div>
          </div>
        </form>
      </ModalContent>
    </Dialog.Root>
  );
}

// ---------------------------------------------------------------------------
// CameraStreamAclDialog — manage ACL grants for a private stream
// ---------------------------------------------------------------------------
type EntityType = "role" | "user";

function CameraStreamAclDialog({
  stream,
  onClose,
}: {
  stream: VideoStream;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [addType, setAddType] = useState<EntityType>("role");
  const [addId, setAddId] = useState("");
  const [addError, setAddError] = useState<string | null>(null);

  const accessQuery = useQuery({
    queryKey: ["video-stream-access", stream.id],
    queryFn: async () => {
      const result = await videoStreamsApi.listAccess(stream.id);
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
  });

  const rolesQuery = useQuery({
    queryKey: ["roles"],
    queryFn: async () => {
      const result = await rolesApi.list();
      if (!result.success) throw new Error(result.error.message);
      return (result.data as { data: Role[] }).data;
    },
  });

  const usersQuery = useQuery({
    queryKey: ["users", { page: 1, limit: 200 }],
    queryFn: async () => {
      const result = await usersApi.list({ page: 1, limit: 200 });
      if (!result.success) throw new Error(result.error.message);
      return (result.data as { data: User[] }).data;
    },
  });

  const addMut = useMutation({
    mutationFn: ({ type, id }: { type: EntityType; id: string }) =>
      videoStreamsApi.addAccess(stream.id, type, id),
    onSuccess: (result) => {
      if (!result.success) {
        setAddError(result.error.message);
        return;
      }
      qc.invalidateQueries({ queryKey: ["video-stream-access", stream.id] });
      setAddId("");
      setAddError(null);
    },
  });

  const removeMut = useMutation({
    mutationFn: (grant: VideoStreamAccess) =>
      videoStreamsApi.removeAccess(
        stream.id,
        grant.entity_type,
        grant.entity_id,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["video-stream-access", stream.id] });
    },
  });

  const grants = accessQuery.data ?? [];
  const roles = rolesQuery.data ?? [];
  const users = usersQuery.data ?? [];

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);
    if (!addId) {
      setAddError("Select a role or user to add.");
      return;
    }
    addMut.mutate({ type: addType, id: addId });
  }

  function labelFor(grant: VideoStreamAccess): string {
    if (grant.entity_name) return grant.entity_name;
    if (grant.entity_type === "role") {
      const r = roles.find((x) => x.id === grant.entity_id);
      return r ? r.display_name : grant.entity_id;
    }
    const u = users.find((x) => x.id === grant.entity_id);
    return u ? (u.display_name ?? u.username) : grant.entity_id;
  }

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <ModalContent title={`Access — ${stream.name}`} width={480}>
        <div style={{ marginBottom: "20px" }}>
          <p
            style={{
              margin: "0 0 12px",
              fontSize: "13px",
              color: "var(--io-text-muted)",
            }}
          >
            Only listed roles and users can view this stream.
          </p>

          {accessQuery.isLoading && (
            <div
              style={{
                padding: "12px",
                color: "var(--io-text-muted)",
                fontSize: "13px",
              }}
            >
              Loading…
            </div>
          )}

          {grants.length === 0 && !accessQuery.isLoading && (
            <div
              style={{
                padding: "16px",
                textAlign: "center",
                color: "var(--io-text-muted)",
                fontSize: "13px",
                border: "1px dashed var(--io-border)",
                borderRadius: "var(--io-radius)",
                marginBottom: "16px",
              }}
            >
              No access grants — no one can view this stream.
            </div>
          )}

          {grants.length > 0 && (
            <div
              style={{
                border: "1px solid var(--io-border)",
                borderRadius: "var(--io-radius)",
                overflow: "hidden",
                marginBottom: "16px",
              }}
            >
              {grants.map((grant, i) => (
                <div
                  key={`${grant.entity_type}:${grant.entity_id}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 12px",
                    borderBottom:
                      i < grants.length - 1
                        ? "1px solid var(--io-border-subtle)"
                        : undefined,
                  }}
                >
                  <div>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        color: "var(--io-text-muted)",
                        textTransform: "uppercase",
                        marginRight: "8px",
                      }}
                    >
                      {grant.entity_type}
                    </span>
                    <span
                      style={{
                        fontSize: "13px",
                        color: "var(--io-text-primary)",
                      }}
                    >
                      {labelFor(grant)}
                    </span>
                  </div>
                  <button
                    style={{
                      ...btnSmall,
                      color: "var(--io-danger)",
                      borderColor: "rgba(239,68,68,0.3)",
                    }}
                    onClick={() => removeMut.mutate(grant)}
                    disabled={removeMut.isPending}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          {addError && <ErrorBanner message={addError} />}

          <form onSubmit={handleAdd}>
            <div
              style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}
            >
              <div style={{ width: "100px" }}>
                <label style={labelStyle}>Type</label>
                <select
                  style={inputStyle}
                  value={addType}
                  onChange={(e) => {
                    setAddType(e.target.value as EntityType);
                    setAddId("");
                  }}
                >
                  <option value="role">Role</option>
                  <option value="user">User</option>
                </select>
              </div>

              <div style={{ flex: 1 }}>
                <label style={labelStyle}>
                  {addType === "role" ? "Role" : "User"}
                </label>
                <select
                  style={inputStyle}
                  value={addId}
                  onChange={(e) => setAddId(e.target.value)}
                >
                  <option value="">— select —</option>
                  {addType === "role" &&
                    roles.map((r) => (
                      <option key={r.id} value={r.name}>
                        {r.display_name}
                      </option>
                    ))}
                  {addType === "user" &&
                    users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.display_name ?? u.username}
                      </option>
                    ))}
                </select>
              </div>

              <button
                type="submit"
                style={{ ...btnPrimary, flexShrink: 0 }}
                disabled={addMut.isPending}
              >
                {addMut.isPending ? "Adding…" : "Add"}
              </button>
            </div>
          </form>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Dialog.Close asChild>
            <button style={btnSecondary}>Close</button>
          </Dialog.Close>
        </div>
      </ModalContent>
    </Dialog.Root>
  );
}

// ---------------------------------------------------------------------------
// Visibility badge
// ---------------------------------------------------------------------------
const VISIBILITY_COLORS: Record<VideoStream["visibility"], string> = {
  public: "var(--io-accent, #3b82f6)",
  managed: "#a855f7",
  private: "var(--io-danger, #ef4444)",
};

function VisibilityBadge({ value }: { value: VideoStream["visibility"] }) {
  const color = VISIBILITY_COLORS[value];
  return (
    <span
      style={{
        display: "inline-block",
        padding: "2px 8px",
        borderRadius: "100px",
        fontSize: "11px",
        fontWeight: 600,
        background: `${color}20`,
        color,
        border: `1px solid ${color}40`,
        textTransform: "capitalize",
      }}
    >
      {value}
    </span>
  );
}

// ---------------------------------------------------------------------------
// CameraStreamsTab — main page
// ---------------------------------------------------------------------------
export default function CameraStreamsTab() {
  const qc = useQueryClient();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<VideoStream | null>(null);
  const [aclFor, setAclFor] = useState<VideoStream | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<VideoStream | null>(null);

  const streamsQuery = useQuery({
    queryKey: ["video-streams"],
    queryFn: async () => {
      const result = await videoStreamsApi.list();
      if (!result.success) throw new Error(result.error.message);
      return result.data;
    },
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => videoStreamsApi.remove(id),
    onSuccess: (result) => {
      if (!result.success) {
        setDeleteError(result.error.message);
        return;
      }
      qc.invalidateQueries({ queryKey: ["video-streams"] });
    },
  });

  const streams = streamsQuery.data ?? [];

  return (
    <SettingsPageLayout
      title="Camera Streams"
      description="Configure live video sources for Camera Stream widgets."
      variant="list"
      action={
        <button style={btnPrimary} onClick={() => setCreating(true)}>
          + Add Stream
        </button>
      }
    >
      {deleteError && <ErrorBanner message={deleteError} />}

      <div
        style={{
          background: "var(--io-surface-secondary)",
          border: "1px solid var(--io-border)",
          borderRadius: "8px",
          overflow: "hidden",
        }}
      >
        {streamsQuery.isLoading && (
          <div
            style={{
              padding: "40px",
              textAlign: "center",
              color: "var(--io-text-muted)",
              fontSize: "13px",
            }}
          >
            Loading…
          </div>
        )}
        {streamsQuery.isError && (
          <div style={{ padding: "20px" }}>
            <ErrorBanner
              message={
                streamsQuery.error instanceof Error
                  ? streamsQuery.error.message
                  : "Failed to load streams"
              }
            />
          </div>
        )}
        {!streamsQuery.isLoading && !streamsQuery.isError && (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr
                style={{
                  borderBottom: "1px solid var(--io-border)",
                  background: "var(--io-surface-primary)",
                }}
              >
                {["Name", "Visibility", "Mode", "URL / Inputs", "Actions"].map(
                  (col) => (
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
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {streams.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    style={{
                      padding: "40px",
                      textAlign: "center",
                      color: "var(--io-text-muted)",
                      fontSize: "14px",
                    }}
                  >
                    No streams configured
                  </td>
                </tr>
              )}
              {streams.map((s, i) => (
                <tr
                  key={s.id}
                  style={{
                    borderBottom:
                      i < streams.length - 1
                        ? "1px solid var(--io-border-subtle)"
                        : undefined,
                  }}
                >
                  <td style={cellStyle}>
                    <span
                      style={{
                        fontWeight: 500,
                        color: "var(--io-text-primary)",
                      }}
                    >
                      {s.name}
                    </span>
                    {s.description && (
                      <div
                        style={{
                          fontSize: "11px",
                          color: "var(--io-text-muted)",
                          marginTop: "2px",
                        }}
                      >
                        {s.description}
                      </div>
                    )}
                  </td>
                  <td style={cellStyle}>
                    <VisibilityBadge value={s.visibility} />
                  </td>
                  <td style={cellStyle}>
                    <span
                      style={{
                        fontSize: "12px",
                        color: "var(--io-text-secondary)",
                        textTransform: "capitalize",
                      }}
                    >
                      {s.connection_mode}
                    </span>
                  </td>
                  <td style={{ ...cellStyle, maxWidth: "300px" }}>
                    <code
                      style={{
                        fontFamily: "ui-monospace, monospace",
                        fontSize: "11px",
                        color: "var(--io-text-secondary)",
                        display: "block",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {s.direct_url ??
                        s.relay_config?.go2rtc_inputs?.join(", ") ??
                        "—"}
                    </code>
                  </td>
                  <td style={cellStyle}>
                    <div
                      style={{
                        display: "flex",
                        gap: "6px",
                        flexWrap: "nowrap",
                      }}
                    >
                      <button style={btnSmall} onClick={() => setEditing(s)}>
                        Edit
                      </button>
                      {s.visibility === "private" && (
                        <button style={btnSmall} onClick={() => setAclFor(s)}>
                          Access
                        </button>
                      )}
                      <button
                        style={{
                          ...btnSmall,
                          color: "var(--io-danger)",
                          borderColor: "rgba(239,68,68,0.3)",
                        }}
                        disabled={removeMut.isPending}
                        onClick={() => setConfirmDelete(s)}
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

      {creating && (
        <CameraStreamDialog stream={null} onClose={() => setCreating(false)} />
      )}
      {editing && (
        <CameraStreamDialog stream={editing} onClose={() => setEditing(null)} />
      )}
      {aclFor && (
        <CameraStreamAclDialog
          stream={aclFor}
          onClose={() => setAclFor(null)}
        />
      )}
      <ConfirmDialog
        open={confirmDelete !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDelete(null);
        }}
        title="Delete camera stream?"
        description={
          confirmDelete
            ? `Delete "${confirmDelete.name}"? This cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => {
          if (confirmDelete) {
            setDeleteError(null);
            removeMut.mutate(confirmDelete.id);
          }
        }}
      />
    </SettingsPageLayout>
  );
}
