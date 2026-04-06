import React, { useState } from "react";
import ContextMenu from "../../shared/components/ContextMenu";
import { useContextMenu } from "../../shared/hooks/useContextMenu";
import * as Dialog from "@radix-ui/react-dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  rolesApi,
  permissionsApi,
  Role,
  RoleDetail,
  Permission,
  CreateRoleRequest,
  UpdateRoleRequest,
} from "../../api/roles";
import { ExportButton } from "../../shared/components/ExportDialog";
import {
  inputStyle,
  labelStyle,
  btnPrimary,
  btnSecondary,
  cellStyle,
} from "./settingsStyles";

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

function Badge({ label, color }: { label: string; color: string }) {
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
      }}
    >
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// ModalContent
// ---------------------------------------------------------------------------
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
// PermissionMultiSelect
// ---------------------------------------------------------------------------
function PermissionMultiSelect({
  permissions,
  selected,
  onChange,
  disabled,
}: {
  permissions: Permission[];
  selected: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  // Group by module
  const grouped = permissions.reduce<Record<string, Permission[]>>((acc, p) => {
    if (!acc[p.module]) acc[p.module] = [];
    acc[p.module].push(p);
    return acc;
  }, {});

  function toggle(name: string) {
    if (disabled) return;
    onChange(
      selected.includes(name)
        ? selected.filter((x) => x !== name)
        : [...selected, name],
    );
  }

  function toggleModule(module: string) {
    if (disabled) return;
    const moduleNames = grouped[module].map((p) => p.name);
    const allSelected = moduleNames.every((name) => selected.includes(name));
    if (allSelected) {
      onChange(selected.filter((name) => !moduleNames.includes(name)));
    } else {
      const newSelected = [...new Set([...selected, ...moduleNames])];
      onChange(newSelected);
    }
  }

  return (
    <div
      style={{
        maxHeight: "240px",
        overflowY: "auto",
        border: "1px solid var(--io-border)",
        borderRadius: "var(--io-radius)",
        padding: "4px",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {Object.entries(grouped).map(([module, perms]) => {
        const allSelected = perms.every((p) => selected.includes(p.name));
        const someSelected = perms.some((p) => selected.includes(p.name));
        return (
          <div key={module} style={{ marginBottom: "4px" }}>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 14px",
                cursor: disabled ? "not-allowed" : "pointer",
                borderRadius: "4px",
                background: "var(--io-surface-sunken)",
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--io-text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
              }}
              onClick={() => toggleModule(module)}
            >
              <input
                type="checkbox"
                checked={allSelected}
                ref={(el) => {
                  if (el) el.indeterminate = !allSelected && someSelected;
                }}
                onChange={() => toggleModule(module)}
                style={{ accentColor: "var(--io-accent)" }}
                disabled={disabled}
              />
              {module}
            </label>
            {perms.map((p) => (
              <label
                key={p.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "4px 8px 4px 24px",
                  cursor: disabled ? "not-allowed" : "pointer",
                  fontSize: "12px",
                  color: "var(--io-text-primary)",
                }}
              >
                <input
                  type="checkbox"
                  checked={selected.includes(p.name)}
                  onChange={() => toggle(p.name)}
                  style={{ accentColor: "var(--io-accent)" }}
                  disabled={disabled}
                />
                <span>{p.name}</span>
                {p.description && (
                  <span
                    style={{
                      color: "var(--io-text-muted)",
                      fontSize: "11px",
                      marginLeft: "4px",
                    }}
                  >
                    — {p.description}
                  </span>
                )}
              </label>
            ))}
          </div>
        );
      })}
      {permissions.length === 0 && (
        <div
          style={{
            padding: "16px",
            textAlign: "center",
            color: "var(--io-text-muted)",
            fontSize: "13px",
          }}
        >
          No permissions available
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CreateRoleDialog
// ---------------------------------------------------------------------------
function CreateRoleDialog({
  open,
  onOpenChange,
  permissions,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  permissions: Permission[];
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<CreateRoleRequest>({
    name: "",
    display_name: "",
    description: "",
    permissions: [],
    idle_timeout_minutes: null,
    max_concurrent_sessions: 0,
  });
  const [formError, setFormError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: (req: CreateRoleRequest) => rolesApi.create(req),
    onSuccess: (result) => {
      if (!result.success) {
        setFormError(result.error.message);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      onOpenChange(false);
      setForm({
        name: "",
        display_name: "",
        description: "",
        permissions: [],
        idle_timeout_minutes: null,
        max_concurrent_sessions: 0,
      });
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
      <ModalContent title="Create Role">
        {formError && <ErrorBanner message={formError} />}
        <form onSubmit={handleSubmit}>
          <div
            style={{ display: "flex", flexDirection: "column", gap: "14px" }}
          >
            <div>
              <label style={labelStyle}>
                Role Name * (identifier, no spaces)
              </label>
              <input
                style={inputStyle}
                value={form.name}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    name: e.target.value.replace(/\s+/g, "_").toLowerCase(),
                  }))
                }
                placeholder="e.g. shift_supervisor"
                required
              />
            </div>
            <div>
              <label style={labelStyle}>Display Name *</label>
              <input
                style={inputStyle}
                value={form.display_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, display_name: e.target.value }))
                }
                placeholder="e.g. Shift Supervisor"
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
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "12px",
              }}
            >
              <div>
                <label style={labelStyle}>Idle Timeout (minutes)</label>
                <input
                  type="number"
                  style={inputStyle}
                  value={form.idle_timeout_minutes ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      idle_timeout_minutes: e.target.value
                        ? Number(e.target.value)
                        : null,
                    }))
                  }
                  placeholder="System default"
                  min={1}
                />
              </div>
              <div>
                <label style={labelStyle}>Max Concurrent Sessions</label>
                <input
                  type="number"
                  style={inputStyle}
                  value={form.max_concurrent_sessions ?? 0}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      max_concurrent_sessions: Number(e.target.value),
                    }))
                  }
                  placeholder="0 = unlimited"
                  min={0}
                />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Permissions</label>
              <PermissionMultiSelect
                permissions={permissions}
                selected={form.permissions ?? []}
                onChange={(names) =>
                  setForm((f) => ({ ...f, permissions: names }))
                }
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
              {mutation.isPending ? "Creating…" : "Create Role"}
            </button>
          </div>
        </form>
      </ModalContent>
    </Dialog.Root>
  );
}

// ---------------------------------------------------------------------------
// EditRoleDialog
// ---------------------------------------------------------------------------
function EditRoleDialog({
  role,
  open,
  onOpenChange,
  permissions,
  isLoading,
}: {
  role: RoleDetail | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  permissions: Permission[];
  isLoading?: boolean;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<UpdateRoleRequest>({});
  const [formError, setFormError] = useState<string | null>(null);

  React.useEffect(() => {
    if (role) {
      setForm({
        display_name: role.display_name,
        description: role.description ?? "",
        // role.permissions is only present on RoleDetail (not Role); guard against undefined
        // while the detail query is still loading
        permissions: (role.permissions ?? []).map((p) => p.name),
        idle_timeout_minutes: role.idle_timeout_minutes ?? null,
        max_concurrent_sessions: role.max_concurrent_sessions ?? 0,
      });
    }
  }, [role]);

  const mutation = useMutation({
    mutationFn: (req: UpdateRoleRequest) => rolesApi.update(role!.id, req),
    onSuccess: (result) => {
      if (!result.success) {
        setFormError(result.error.message);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["roles"] });
      onOpenChange(false);
      setFormError(null);
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    mutation.mutate(form);
  }

  if (!role) return null;

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <ModalContent title={`Edit Role: ${role.display_name}`}>
        {formError && <ErrorBanner message={formError} />}
        {isLoading && (
          <div
            style={{
              padding: "24px",
              textAlign: "center",
              color: "var(--io-text-muted)",
              fontSize: "13px",
            }}
          >
            Loading role details…
          </div>
        )}
        <form
          onSubmit={handleSubmit}
          style={{ display: isLoading ? "none" : undefined }}
        >
          <div
            style={{ display: "flex", flexDirection: "column", gap: "14px" }}
          >
            {role.is_predefined && (
              <div
                style={{
                  padding: "8px 12px",
                  background: "var(--io-accent-subtle)",
                  border: "1px solid var(--io-accent)",
                  borderRadius: "var(--io-radius)",
                  fontSize: "12px",
                  color: "var(--io-accent)",
                }}
              >
                This is a predefined role. The role name cannot be changed, but
                you can modify its permissions.
              </div>
            )}
            <div>
              <label style={labelStyle}>Role Name</label>
              <input
                style={{ ...inputStyle, opacity: 0.6, cursor: "not-allowed" }}
                value={role.name}
                disabled
              />
            </div>
            <div>
              <label style={labelStyle}>Display Name *</label>
              <input
                style={inputStyle}
                value={form.display_name ?? ""}
                onChange={(e) =>
                  setForm((f) => ({ ...f, display_name: e.target.value }))
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
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "12px",
              }}
            >
              <div>
                <label style={labelStyle}>Idle Timeout (minutes)</label>
                <input
                  type="number"
                  style={inputStyle}
                  value={form.idle_timeout_minutes ?? ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      idle_timeout_minutes: e.target.value
                        ? Number(e.target.value)
                        : null,
                    }))
                  }
                  placeholder="System default"
                  min={1}
                />
              </div>
              <div>
                <label style={labelStyle}>Max Concurrent Sessions</label>
                <input
                  type="number"
                  style={inputStyle}
                  value={form.max_concurrent_sessions ?? 0}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      max_concurrent_sessions: Number(e.target.value),
                    }))
                  }
                  placeholder="0 = unlimited"
                  min={0}
                />
              </div>
            </div>
            <div>
              <label style={labelStyle}>Permissions</label>
              <PermissionMultiSelect
                permissions={permissions}
                selected={form.permissions ?? []}
                onChange={(names) =>
                  setForm((f) => ({ ...f, permissions: names }))
                }
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
              {mutation.isPending ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </ModalContent>
    </Dialog.Root>
  );
}

// ---------------------------------------------------------------------------
// Column definitions for roles export
// ---------------------------------------------------------------------------
const ROLES_COLUMNS = [
  { id: "name", label: "Name" },
  { id: "display_name", label: "Display Name" },
  { id: "description", label: "Description" },
  { id: "permission_count", label: "Permission Count" },
  { id: "is_predefined", label: "Predefined" },
];

const ROLES_DEFAULT_VISIBLE = [
  "name",
  "display_name",
  "permission_count",
  "is_predefined",
];

// ---------------------------------------------------------------------------
// TableSkeleton — shimmer rows for roles table
// ---------------------------------------------------------------------------
function TableSkeleton({
  rows = 5,
  columns = 5,
}: {
  rows?: number;
  columns?: number;
}) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr
          style={{
            borderBottom: "1px solid var(--io-border)",
            background: "var(--io-surface-primary)",
          }}
        >
          {Array.from({ length: columns }).map((_, i) => (
            <th key={i} style={{ padding: "10px 14px", textAlign: "left" }}>
              <div
                style={{
                  height: "10px",
                  borderRadius: "4px",
                  background: "var(--io-border)",
                  width:
                    i === 0 ? "80px" : i === columns - 1 ? "60px" : "120px",
                  animation: "io-shimmer 1.5s ease-in-out infinite",
                }}
              />
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: rows }).map((_, ri) => (
          <tr
            key={ri}
            style={{
              borderBottom:
                ri < rows - 1 ? "1px solid var(--io-border-subtle)" : undefined,
            }}
          >
            {Array.from({ length: columns }).map((_, ci) => (
              <td key={ci} style={{ padding: "12px 14px" }}>
                <div
                  style={{
                    height: "12px",
                    borderRadius: "4px",
                    background: "var(--io-surface-primary)",
                    width:
                      ci === columns - 1
                        ? "64px"
                        : ci === 0
                          ? "100px"
                          : "140px",
                    animation: "io-shimmer 1.5s ease-in-out infinite",
                    animationDelay: `${ri * 0.05}s`,
                  }}
                />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}


// ---------------------------------------------------------------------------
// RolesTab
// ---------------------------------------------------------------------------
export function RolesTab() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editRole, setEditRole] = useState<RoleDetail | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const { menuState: roleMenu, handleContextMenu: openRoleMenu, closeMenu: closeRoleMenu } = useContextMenu<Role>();

  const rolesQuery = useQuery({
    queryKey: ["roles"],
    queryFn: async () => {
      const result = await rolesApi.list();
      if (!result.success) throw new Error(result.error.message);
      return result.data.data as Role[];
    },
  });

  const permissionsQuery = useQuery({
    queryKey: ["permissions"],
    queryFn: async () => {
      const result = await permissionsApi.list();
      if (!result.success) throw new Error(result.error.message);
      return result.data as Permission[];
    },
  });

  const roleDetailQuery = useQuery({
    queryKey: ["role", editRole?.id],
    queryFn: async () => {
      if (!editRole) return null;
      const result = await rolesApi.get(editRole.id);
      if (!result.success) throw new Error(result.error.message);
      return result.data as RoleDetail;
    },
    enabled: !!editRole,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => rolesApi.delete(id),
    onSuccess: (result) => {
      if (!result.success) {
        setBannerError(result.error.message);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["roles"] });
    },
  });

  const cloneMutation = useMutation({
    mutationFn: async (role: Role) => {
      // Fetch full role details to get permissions
      const detailResult = await rolesApi.get(role.id);
      if (!detailResult.success) throw new Error(detailResult.error.message);
      const detail = detailResult.data as RoleDetail;
      const req: CreateRoleRequest = {
        name: `${role.name}_copy`,
        display_name: `${role.display_name} (Copy)`,
        description: role.description ?? "",
        permissions: detail.permissions.map((p: Permission) => p.name),
        idle_timeout_minutes: detail.idle_timeout_minutes ?? null,
        max_concurrent_sessions: detail.max_concurrent_sessions ?? 0,
      };
      return rolesApi.create(req);
    },
    onSuccess: (result) => {
      if (!result.success) {
        setBannerError(result.error.message);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["roles"] });
    },
    onError: (err) => {
      setBannerError(
        err instanceof Error ? err.message : "Failed to clone role",
      );
    },
  });

  function handleEdit(role: Role) {
    setEditRole(role as RoleDetail);
    setEditOpen(true);
  }


  const roles = rolesQuery.data ?? [];
  const permissions = permissionsQuery.data ?? [];

  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: "8px",
          marginBottom: "16px",
        }}
      >
        <ExportButton
          module="settings"
          entity="roles"
          filteredRowCount={roles.length}
          totalRowCount={roles.length}
          availableColumns={ROLES_COLUMNS}
          visibleColumns={ROLES_DEFAULT_VISIBLE}
        />
        <button style={btnPrimary} onClick={() => setCreateOpen(true)}>
          + Add Role
        </button>
      </div>

      {bannerError && <ErrorBanner message={bannerError} />}

      <div
        style={{
          background: "var(--io-surface-secondary)",
          border: "1px solid var(--io-border)",
          borderRadius: "8px",
          overflow: "hidden",
        }}
      >
        {rolesQuery.isLoading && <TableSkeleton rows={5} columns={5} />}
        {rolesQuery.isError && (
          <div style={{ padding: "20px" }}>
            <ErrorBanner
              message={rolesQuery.error?.message ?? "Failed to load roles"}
            />
          </div>
        )}
        {!rolesQuery.isLoading && !rolesQuery.isError && (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr
                style={{
                  borderBottom: "1px solid var(--io-border)",
                  background: "var(--io-surface-primary)",
                }}
              >
                {["Name", "Display Name", "Permissions", "Type", "Actions"].map(
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
              {roles.length === 0 && (
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
                    No roles found
                  </td>
                </tr>
              )}
              {roles.map((role, i) => (
                <tr
                  key={role.id}
                  style={{
                    borderBottom:
                      i < roles.length - 1
                        ? "1px solid var(--io-border-subtle)"
                        : undefined,
                  }}
                  onContextMenu={(e) => openRoleMenu(e, role)}
                >
                  <td style={cellStyle}>
                    <code
                      style={{
                        fontFamily: "monospace",
                        fontSize: "12px",
                        background: "var(--io-surface-primary)",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        color: "var(--io-text-primary)",
                      }}
                    >
                      {role.name}
                    </code>
                  </td>
                  <td style={cellStyle}>
                    <span
                      style={{
                        fontWeight: 500,
                        color: "var(--io-text-primary)",
                      }}
                    >
                      {role.display_name}
                    </span>
                  </td>
                  <td style={cellStyle}>
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        minWidth: "32px",
                        height: "22px",
                        padding: "0 8px",
                        background: "var(--io-surface-primary)",
                        border: "1px solid var(--io-border)",
                        borderRadius: "100px",
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "var(--io-text-secondary)",
                      }}
                    >
                      {role.permission_count}
                    </span>
                  </td>
                  <td style={cellStyle}>
                    {role.is_predefined ? (
                      <Badge label="Predefined" color="var(--io-accent)" />
                    ) : (
                      <Badge label="Custom" color="var(--io-text-muted)" />
                    )}
                  </td>
                  <td style={cellStyle}>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button
                        style={{
                          padding: "4px 10px",
                          background: "transparent",
                          border: "1px solid var(--io-border)",
                          borderRadius: "var(--io-radius)",
                          color: "var(--io-text-secondary)",
                          fontSize: "12px",
                          cursor: "pointer",
                        }}
                        onClick={() => handleEdit(role)}
                      >
                        Edit
                      </button>
                      {!role.is_predefined && (
                        <button
                          style={{
                            padding: "4px 10px",
                            background: "transparent",
                            border: "1px solid rgba(239,68,68,0.3)",
                            borderRadius: "var(--io-radius)",
                            color: "var(--io-danger)",
                            fontSize: "12px",
                            cursor: "pointer",
                          }}
                          onClick={() => deleteMutation.mutate(role.id)}
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <CreateRoleDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        permissions={permissions}
      />

      <EditRoleDialog
        role={roleDetailQuery.data ?? editRole}
        open={editOpen}
        onOpenChange={setEditOpen}
        permissions={permissions}
        isLoading={roleDetailQuery.isLoading}
      />

      {roleMenu && (
        <ContextMenu
          x={roleMenu.x}
          y={roleMenu.y}
          items={[
            { label: "Edit Permissions", onClick: () => handleEdit(roleMenu.data!) },
            { label: "Clone Role", onClick: () => cloneMutation.mutate(roleMenu.data!) },
            { label: "Delete", danger: true, divider: true, disabled: roleMenu.data!.is_predefined, onClick: () => deleteMutation.mutate(roleMenu.data!.id) },
          ]}
          onClose={closeRoleMenu}
        />
      )}
    </div>
  );
}

export default function RolesPage() {
  return <RolesTab />;
}
