import React, { useState, useEffect, useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  groupsApi,
  Group,
  GroupDetail,
  GroupMember,
  CreateGroupRequest,
  UpdateGroupRequest,
} from "../../api/groups";
import { rolesApi, Role } from "../../api/roles";
import { usersApi, User } from "../../api/users";
import {
  inputStyle,
  labelStyle,
  btnPrimary,
  btnSecondary,
  btnSmall,
  cellStyle,
} from "./settingsStyles";

// Groups-specific small danger button (not in shared styles)
const btnSmallDanger: React.CSSProperties = {
  ...btnSmall,
  color: "var(--io-danger)",
  border: "1px solid rgba(239,68,68,0.3)",
};

// ---------------------------------------------------------------------------
// Sub-components
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

function ModalContent({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
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
          width: "560px",
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
              x
            </button>
          </Dialog.Close>
        </div>
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  );
}

// ---------------------------------------------------------------------------
// RoleMultiSelect — select roles to assign to a group
// ---------------------------------------------------------------------------
function RoleMultiSelect({
  roles,
  selected,
  onChange,
}: {
  roles: Role[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  function toggle(id: string) {
    onChange(
      selected.includes(id)
        ? selected.filter((x) => x !== id)
        : [...selected, id],
    );
  }

  return (
    <div
      style={{
        maxHeight: "200px",
        overflowY: "auto",
        border: "1px solid var(--io-border)",
        borderRadius: "var(--io-radius)",
        padding: "4px",
      }}
    >
      {roles.length === 0 && (
        <div
          style={{
            padding: "16px",
            textAlign: "center",
            color: "var(--io-text-muted)",
            fontSize: "13px",
          }}
        >
          No roles available
        </div>
      )}
      {roles.map((role) => (
        <label
          key={role.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "6px 8px",
            cursor: "pointer",
            borderRadius: "4px",
            fontSize: "13px",
            color: "var(--io-text-primary)",
          }}
        >
          <input
            type="checkbox"
            checked={selected.includes(role.id)}
            onChange={() => toggle(role.id)}
            style={{ accentColor: "var(--io-accent)" }}
          />
          <span style={{ fontWeight: 500 }}>{role.display_name}</span>
          <span
            style={{
              fontSize: "11px",
              color: "var(--io-text-muted)",
              fontFamily: "monospace",
            }}
          >
            {role.name}
          </span>
        </label>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CreateGroupDialog
// ---------------------------------------------------------------------------
function CreateGroupDialog({
  open,
  onOpenChange,
  roles,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  roles: Role[];
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<CreateGroupRequest>({
    name: "",
    description: "",
    role_ids: [],
  });
  const [formError, setFormError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (req: CreateGroupRequest) => groupsApi.create(req),
    onSuccess: (result) => {
      if (!result.success) {
        setFormError(result.error.message);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      onOpenChange(false);
      setForm({ name: "", description: "", role_ids: [] });
      setFormError(null);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    mutation.mutate(form);
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <ModalContent title="Create Group">
        {formError && <ErrorBanner message={formError} />}
        <form onSubmit={handleSubmit}>
          <div
            style={{ display: "flex", flexDirection: "column", gap: "14px" }}
          >
            <div>
              <label style={labelStyle}>Group Name *</label>
              <input
                style={inputStyle}
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="e.g. Operations Team"
                required
              />
            </div>
            <div>
              <label style={labelStyle}>Description</label>
              <input
                style={inputStyle}
                value={form.description ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                placeholder="Optional description"
              />
            </div>
            <div>
              <label style={labelStyle}>
                Roles (members inherit all selected roles)
              </label>
              <RoleMultiSelect
                roles={roles}
                selected={form.role_ids ?? []}
                onChange={(ids) => setForm((f) => ({ ...f, role_ids: ids }))}
              />
            </div>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "8px",
              marginTop: "24px",
            }}
          >
            <Dialog.Close asChild>
              <button type="button" style={btnSecondary}>
                Cancel
              </button>
            </Dialog.Close>
            <button
              type="submit"
              style={btnPrimary}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? "Creating..." : "Create Group"}
            </button>
          </div>
        </form>
      </ModalContent>
    </Dialog.Root>
  );
}

// ---------------------------------------------------------------------------
// EditGroupDialog
// ---------------------------------------------------------------------------
function EditGroupDialog({
  group,
  open,
  onOpenChange,
  roles,
}: {
  group: Group | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  roles: Role[];
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<UpdateGroupRequest>({});
  const [formError, setFormError] = useState<string | null>(null);

  const groupDetailQuery = useQuery({
    queryKey: ["group-detail", group?.id],
    queryFn: async () => {
      if (!group) return null;
      const result = await groupsApi.get(group.id);
      if (!result.success) throw new Error(result.error.message);
      return result.data as GroupDetail;
    },
    enabled: !!group && open,
  });

  React.useEffect(() => {
    if (groupDetailQuery.data) {
      setForm({
        name: groupDetailQuery.data.name,
        description: groupDetailQuery.data.description ?? "",
        role_ids: groupDetailQuery.data.roles.map((r) => r.id),
      });
    } else if (group && !groupDetailQuery.data) {
      setForm({
        name: group.name,
        description: group.description ?? "",
        role_ids: [],
      });
    }
  }, [group, groupDetailQuery.data]);

  const mutation = useMutation({
    mutationFn: (req: UpdateGroupRequest) => groupsApi.update(group!.id, req),
    onSuccess: (result) => {
      if (!result.success) {
        setFormError(result.error.message);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      queryClient.invalidateQueries({ queryKey: ["group-detail", group?.id] });
      onOpenChange(false);
      setFormError(null);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    mutation.mutate(form);
  }

  if (!group) return null;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <ModalContent title={`Edit Group: ${group.name}`}>
        {formError && <ErrorBanner message={formError} />}
        <form onSubmit={handleSubmit}>
          <div
            style={{ display: "flex", flexDirection: "column", gap: "14px" }}
          >
            <div>
              <label style={labelStyle}>Group Name *</label>
              <input
                style={inputStyle}
                value={form.name ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, name: e.target.value }))
                }
                required
              />
            </div>
            <div>
              <label style={labelStyle}>Description</label>
              <input
                style={inputStyle}
                value={form.description ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
              />
            </div>
            <div>
              <label style={labelStyle}>
                Roles (members inherit all selected roles)
              </label>
              {groupDetailQuery.isLoading ? (
                <div
                  style={{
                    fontSize: "13px",
                    color: "var(--io-text-muted)",
                    padding: "8px 0",
                  }}
                >
                  Loading roles...
                </div>
              ) : (
                <RoleMultiSelect
                  roles={roles}
                  selected={form.role_ids ?? []}
                  onChange={(ids) => setForm((f) => ({ ...f, role_ids: ids }))}
                />
              )}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "8px",
              marginTop: "24px",
            }}
          >
            <Dialog.Close asChild>
              <button type="button" style={btnSecondary}>
                Cancel
              </button>
            </Dialog.Close>
            <button
              type="submit"
              style={btnPrimary}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </ModalContent>
    </Dialog.Root>
  );
}

// ---------------------------------------------------------------------------
// DeleteGroupDialog
// ---------------------------------------------------------------------------
function DeleteGroupDialog({
  group,
  open,
  onOpenChange,
}: {
  group: Group | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: () => groupsApi.delete(group!.id),
    onSuccess: (result) => {
      if (!result.success) {
        setError(result.error.message);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      onOpenChange(false);
      setError(null);
    },
  });

  if (!group) return null;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <ModalContent title="Delete Group">
        {error && <ErrorBanner message={error} />}
        <p
          style={{
            margin: "0 0 20px",
            fontSize: "14px",
            color: "var(--io-text-secondary)",
            lineHeight: 1.55,
          }}
        >
          Are you sure you want to delete the group{" "}
          <strong style={{ color: "var(--io-text-primary)" }}>
            {group.name}
          </strong>
          ? This will remove all memberships. This action cannot be undone.
        </p>
        <div
          style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}
        >
          <Dialog.Close asChild>
            <button type="button" style={btnSecondary}>
              Cancel
            </button>
          </Dialog.Close>
          <button
            style={{
              padding: "8px 16px",
              background: "var(--io-danger)",
              color: "#fff",
              border: "none",
              borderRadius: "var(--io-radius)",
              fontSize: "13px",
              fontWeight: 600,
              cursor: "pointer",
            }}
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
          >
            {mutation.isPending ? "Deleting..." : "Delete Group"}
          </button>
        </div>
      </ModalContent>
    </Dialog.Root>
  );
}

// ---------------------------------------------------------------------------
// MemberPanel — expandable panel for managing group members
// ---------------------------------------------------------------------------
function MemberPanel({ group }: { group: Group }) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>("");

  const membersQuery = useQuery({
    queryKey: ["group-members", group.id],
    queryFn: async () => {
      const result = await groupsApi.listMembers(group.id);
      if (!result.success) throw new Error(result.error.message);
      return result.data.data as GroupMember[];
    },
  });

  const usersQuery = useQuery({
    queryKey: ["users-search", search],
    queryFn: async () => {
      const result = await usersApi.list({ search, limit: 20 });
      if (!result.success) throw new Error(result.error.message);
      return result.data.data as User[];
    },
    enabled: search.length > 0,
  });

  const addMutation = useMutation({
    mutationFn: (userId: string) =>
      groupsApi.addMember(group.id, { user_id: userId }),
    onSuccess: (result) => {
      if (!result.success) {
        setAddError(result.error.message);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["group-members", group.id] });
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      setSearch("");
      setSelectedUserId("");
      setAddError(null);
    },
  });

  const removeMutation = useMutation({
    mutationFn: (userId: string) => groupsApi.removeMember(group.id, userId),
    onSuccess: (result) => {
      if (!result.success) return;
      queryClient.invalidateQueries({ queryKey: ["group-members", group.id] });
      queryClient.invalidateQueries({ queryKey: ["groups"] });
    },
  });

  const members = membersQuery.data ?? [];
  const memberUserIds = new Set(members.map((m) => m.user_id));
  const filteredUsers = (usersQuery.data ?? []).filter(
    (u) => !memberUserIds.has(u.id),
  );

  return (
    <div
      style={{
        background: "var(--io-surface-sunken)",
        borderTop: "1px solid var(--io-border)",
        padding: "16px",
      }}
    >
      <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
        {/* Add member */}
        <div style={{ flex: "0 0 300px" }}>
          <div
            style={{
              fontSize: "11px",
              fontWeight: 700,
              color: "var(--io-text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.07em",
              marginBottom: "8px",
            }}
          >
            Add Member
          </div>
          {addError && <ErrorBanner message={addError} />}
          <div style={{ display: "flex", gap: "6px" }}>
            <div style={{ position: "relative", flex: 1 }}>
              <input
                style={{ ...inputStyle, paddingRight: "8px" }}
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setSelectedUserId("");
                }}
                placeholder="Search users..."
              />
              {search.length > 0 &&
                filteredUsers.length > 0 &&
                !selectedUserId && (
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      right: 0,
                      background: "var(--io-surface-elevated)",
                      border: "1px solid var(--io-border)",
                      borderRadius: "var(--io-radius)",
                      zIndex: 10,
                      maxHeight: "160px",
                      overflowY: "auto",
                      boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
                    }}
                  >
                    {filteredUsers.map((u) => (
                      <div
                        key={u.id}
                        style={{
                          padding: "8px 10px",
                          cursor: "pointer",
                          fontSize: "13px",
                          color: "var(--io-text-primary)",
                          borderBottom: "1px solid var(--io-border-subtle)",
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background =
                            "var(--io-surface-secondary)")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.background = "transparent")
                        }
                        onClick={() => {
                          setSelectedUserId(u.id);
                          setSearch(u.full_name ?? u.username);
                        }}
                      >
                        <span style={{ fontWeight: 500 }}>
                          {u.full_name ?? u.username}
                        </span>
                        <span
                          style={{
                            fontSize: "11px",
                            color: "var(--io-text-muted)",
                            marginLeft: "6px",
                          }}
                        >
                          {u.email}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
            </div>
            <button
              style={{
                ...btnPrimary,
                padding: "8px 12px",
                flexShrink: 0,
                opacity: !selectedUserId || addMutation.isPending ? 0.5 : 1,
                cursor:
                  !selectedUserId || addMutation.isPending
                    ? "not-allowed"
                    : "pointer",
              }}
              disabled={!selectedUserId || addMutation.isPending}
              onClick={() =>
                selectedUserId && addMutation.mutate(selectedUserId)
              }
            >
              Add
            </button>
          </div>
        </div>

        {/* Member list */}
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: "11px",
              fontWeight: 700,
              color: "var(--io-text-muted)",
              textTransform: "uppercase",
              letterSpacing: "0.07em",
              marginBottom: "8px",
            }}
          >
            Current Members ({members.length})
          </div>
          {membersQuery.isLoading && (
            <div style={{ fontSize: "13px", color: "var(--io-text-muted)" }}>
              Loading...
            </div>
          )}
          {!membersQuery.isLoading && members.length === 0 && (
            <div style={{ fontSize: "13px", color: "var(--io-text-muted)" }}>
              No members yet. Add users using the search above.
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {members.map((m) => (
              <div
                key={m.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "6px 10px",
                  background: "var(--io-surface)",
                  border: "1px solid var(--io-border)",
                  borderRadius: "4px",
                  fontSize: "13px",
                }}
              >
                <div>
                  <span
                    style={{ fontWeight: 500, color: "var(--io-text-primary)" }}
                  >
                    {m.full_name ?? m.username}
                  </span>
                  <span
                    style={{
                      fontSize: "11px",
                      color: "var(--io-text-muted)",
                      marginLeft: "6px",
                    }}
                  >
                    {m.email}
                  </span>
                </div>
                <button
                  style={btnSmallDanger}
                  onClick={() => removeMutation.mutate(m.user_id)}
                  disabled={removeMutation.isPending}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// GroupContextMenu — right-click context menu for group table rows
// ---------------------------------------------------------------------------
interface ContextMenuPos {
  x: number;
  y: number;
}

function GroupContextMenu({
  group,
  pos,
  onClose,
  onAddMembers,
  onManageRoles,
  onDelete,
}: {
  group: Group;
  pos: ContextMenuPos;
  onClose: () => void;
  onAddMembers: (g: Group) => void;
  onManageRoles: (g: Group) => void;
  onDelete: (g: Group) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  const menuStyle: React.CSSProperties = {
    position: "fixed",
    top: pos.y,
    left: pos.x,
    zIndex: 500,
    background: "var(--io-surface-elevated)",
    border: "1px solid var(--io-border)",
    borderRadius: "var(--io-radius)",
    boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
    minWidth: "180px",
    overflow: "hidden",
    padding: "4px 0",
  };

  const itemStyle: React.CSSProperties = {
    display: "block",
    width: "100%",
    padding: "7px 14px",
    background: "transparent",
    border: "none",
    textAlign: "left",
    fontSize: "13px",
    color: "var(--io-text-secondary)",
    cursor: "pointer",
  };

  const disabledItemStyle: React.CSSProperties = {
    ...itemStyle,
    color: "var(--io-text-muted)",
    cursor: "not-allowed",
    opacity: 0.55,
  };

  const dangerItemStyle: React.CSSProperties = {
    ...itemStyle,
    color: "var(--io-danger)",
  };

  const hasMembers = group.member_count > 0;

  function menuItem(label: string, action: () => void, danger = false) {
    return (
      <button
        style={danger ? dangerItemStyle : itemStyle}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background =
            "var(--io-surface-secondary)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background =
            "transparent";
        }}
        onClick={() => {
          action();
          onClose();
        }}
      >
        {label}
      </button>
    );
  }

  return (
    <div ref={ref} style={menuStyle}>
      {menuItem("Add Members", () => onAddMembers(group))}
      {menuItem("Manage Roles", () => onManageRoles(group))}
      <div
        style={{
          height: "1px",
          background: "var(--io-border)",
          margin: "4px 0",
        }}
      />
      {hasMembers ? (
        <button
          style={disabledItemStyle}
          title="Cannot delete a group that has members"
          disabled
        >
          Delete
        </button>
      ) : (
        menuItem("Delete", () => onDelete(group), true)
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// GroupRow — single group row with expand/collapse
// ---------------------------------------------------------------------------
function GroupRow({
  group,
  index,
  total,
  onEdit,
  onDelete,
  onContextMenu,
}: {
  group: Group;
  index: number;
  total: number;
  onEdit: (g: Group) => void;
  onDelete: (g: Group) => void;
  onContextMenu: (e: React.MouseEvent, g: Group) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <tr
        style={{
          borderBottom:
            expanded || index < total - 1
              ? "1px solid var(--io-border-subtle)"
              : undefined,
        }}
        onContextMenu={(e) => onContextMenu(e, group)}
      >
        <td style={cellStyle}>
          <span style={{ fontWeight: 500, color: "var(--io-text-primary)" }}>
            {group.name}
          </span>
          {group.description && (
            <div
              style={{
                fontSize: "11px",
                color: "var(--io-text-muted)",
                marginTop: "2px",
              }}
            >
              {group.description}
            </div>
          )}
        </td>
        <td style={cellStyle}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
            {group.role_count === 0 ? (
              <span style={{ fontSize: "12px", color: "var(--io-text-muted)" }}>
                —
              </span>
            ) : (
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: "28px",
                  height: "20px",
                  padding: "0 7px",
                  background: "var(--io-accent-subtle)",
                  borderRadius: "100px",
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "var(--io-accent)",
                }}
              >
                {group.role_count}
              </span>
            )}
          </div>
        </td>
        <td style={cellStyle}>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: "28px",
              height: "20px",
              padding: "0 7px",
              background: "var(--io-surface-primary)",
              border: "1px solid var(--io-border)",
              borderRadius: "100px",
              fontSize: "11px",
              fontWeight: 600,
              color: "var(--io-text-secondary)",
            }}
          >
            {group.member_count}
          </span>
        </td>
        <td style={cellStyle}>
          <div style={{ display: "flex", gap: "6px" }}>
            <button style={btnSmall} onClick={() => setExpanded((v) => !v)}>
              {expanded ? "Hide Members" : "Members"}
            </button>
            <button style={btnSmall} onClick={() => onEdit(group)}>
              Edit
            </button>
            <button style={btnSmallDanger} onClick={() => onDelete(group)}>
              Delete
            </button>
          </div>
        </td>
      </tr>
      {expanded && (
        <tr
          style={{
            borderBottom:
              index < total - 1
                ? "1px solid var(--io-border-subtle)"
                : undefined,
          }}
        >
          <td colSpan={4} style={{ padding: 0 }}>
            <MemberPanel group={group} />
          </td>
        </tr>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// GroupsTab
// ---------------------------------------------------------------------------
export function GroupsTab() {
  const navigate = useNavigate();
  const [createOpen, setCreateOpen] = useState(false);
  const [editGroup, setEditGroup] = useState<Group | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteGroup, setDeleteGroup] = useState<Group | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [bannerError, _setBannerError] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    group: Group;
    pos: ContextMenuPos;
  } | null>(null);

  function handleContextMenu(e: React.MouseEvent, group: Group) {
    e.preventDefault();
    setContextMenu({ group, pos: { x: e.clientX, y: e.clientY } });
  }

  function handleAddMembers(group: Group) {
    // Open the group edit dialog which contains the MemberPanel
    setEditGroup(group);
    setEditOpen(true);
  }

  function handleManageRoles(group: Group) {
    setEditGroup(group);
    setEditOpen(true);
  }

  const groupsQuery = useQuery({
    queryKey: ["groups"],
    queryFn: async () => {
      const result = await groupsApi.list();
      if (!result.success) throw new Error(result.error.message);
      return result.data.data as Group[];
    },
  });

  const rolesQuery = useQuery({
    queryKey: ["roles"],
    queryFn: async () => {
      const result = await rolesApi.list();
      if (!result.success) throw new Error(result.error.message);
      return result.data.data as Role[];
    },
  });

  const groups = groupsQuery.data ?? [];
  const roles = rolesQuery.data ?? [];

  function handleEdit(group: Group) {
    setEditGroup(group);
    setEditOpen(true);
  }

  function handleDelete(group: Group) {
    setDeleteGroup(group);
    setDeleteOpen(true);
  }

  return (
    <div>
      {/* Actions row */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginBottom: "16px",
        }}
      >
        <button style={btnPrimary} onClick={() => setCreateOpen(true)}>
          + Create Group
        </button>
      </div>

      {bannerError && <ErrorBanner message={bannerError} />}

      {/* Groups table */}
      <div
        style={{
          background: "var(--io-surface-secondary)",
          border: "1px solid var(--io-border)",
          borderRadius: "8px",
          overflow: "hidden",
          marginBottom: "24px",
        }}
      >
        {groupsQuery.isLoading && (
          <div
            style={{
              padding: "40px",
              textAlign: "center",
              color: "var(--io-text-muted)",
              fontSize: "14px",
            }}
          >
            Loading groups...
          </div>
        )}
        {groupsQuery.isError && (
          <div style={{ padding: "20px" }}>
            <ErrorBanner
              message={groupsQuery.error?.message ?? "Failed to load groups"}
            />
          </div>
        )}
        {!groupsQuery.isLoading && !groupsQuery.isError && (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr
                style={{
                  borderBottom: "1px solid var(--io-border)",
                  background: "var(--io-surface-primary)",
                }}
              >
                {["Name", "Roles", "Members", "Actions"].map((col) => (
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
              {groups.length === 0 && (
                <tr>
                  <td
                    colSpan={4}
                    style={{
                      padding: "40px",
                      textAlign: "center",
                      color: "var(--io-text-muted)",
                      fontSize: "14px",
                    }}
                  >
                    No groups yet. Click "Create Group" to get started.
                  </td>
                </tr>
              )}
              {groups.map((group, i) => (
                <GroupRow
                  key={group.id}
                  group={group}
                  index={i}
                  total={groups.length}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onContextMenu={handleContextMenu}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Informational note: notification groups live in /alerts */}
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
          Notification Groups
        </strong>{" "}
        — Alert routing groups (static and dynamic) are separate from RBAC
        groups and are managed in the{" "}
        <span
          style={{
            color: "var(--io-accent)",
            cursor: "pointer",
            textDecoration: "underline",
          }}
          onClick={() => navigate("/alerts/groups")}
        >
          Alerts module
        </span>
        . Those groups control who receives notifications in escalation policies
        and are not related to RBAC role assignment.
      </div>

      {/* Dialogs */}
      <CreateGroupDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        roles={roles}
      />

      <EditGroupDialog
        group={editGroup}
        open={editOpen}
        onOpenChange={(v) => {
          setEditOpen(v);
          if (!v) setEditGroup(null);
        }}
        roles={roles}
      />

      <DeleteGroupDialog
        group={deleteGroup}
        open={deleteOpen}
        onOpenChange={(v) => {
          setDeleteOpen(v);
          if (!v) setDeleteGroup(null);
        }}
      />

      {contextMenu && (
        <GroupContextMenu
          group={contextMenu.group}
          pos={contextMenu.pos}
          onClose={() => setContextMenu(null)}
          onAddMembers={(g) => {
            handleAddMembers(g);
          }}
          onManageRoles={(g) => {
            handleManageRoles(g);
          }}
          onDelete={(g) => {
            handleDelete(g);
          }}
        />
      )}
    </div>
  );
}

export default function Groups() {
  return <GroupsTab />;
}
