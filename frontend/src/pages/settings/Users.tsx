import React, { useState } from "react";
import ContextMenu from "../../shared/components/ContextMenu";
import { useContextMenu } from "../../shared/hooks/useContextMenu";
import * as Dialog from "@radix-ui/react-dialog";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  usersApi,
  User,
  UserDetail,
  CreateUserRequest,
  UpdateUserRequest,
} from "../../api/users";
import { rolesApi, Role } from "../../api/roles";
import { groupsApi, Group } from "../../api/groups";
import type { PaginatedResult } from "../../api/client";
import { ExportButton } from "../../shared/components/ExportDialog";
import {
  inputStyle,
  labelStyle,
  btnPrimary,
  btnSecondary,
  btnDanger,
  cellStyle,
} from "./settingsStyles";
import UserDetailDialog from "./UserDetail";

// ---------------------------------------------------------------------------
// Column definitions for users export
// ---------------------------------------------------------------------------
const USERS_COLUMNS = [
  { id: "id", label: "ID" },
  { id: "username", label: "Username" },
  { id: "email", label: "Email" },
  { id: "first_name", label: "First Name" },
  { id: "last_name", label: "Last Name" },
  { id: "display_name", label: "Display Name" },
  { id: "phone_number", label: "Mobile" },
  { id: "enabled", label: "Status" },
  { id: "auth_provider", label: "Auth Provider" },
  { id: "last_login_at", label: "Last Login" },
  { id: "created_at", label: "Created At" },
];

const USERS_DEFAULT_VISIBLE = [
  "username",
  "display_name",
  "email",
  "phone_number",
  "enabled",
  "auth_provider",
  "last_login_at",
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function userDisplayName(user: User): string {
  return (
    user.display_name ||
    [user.first_name, user.last_name].filter(Boolean).join(" ") ||
    user.full_name ||
    user.username
  );
}

// ---------------------------------------------------------------------------
// ErrorBanner
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

// ---------------------------------------------------------------------------
// Badge
// ---------------------------------------------------------------------------
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
// Toggle switch (used for the Enabled/Disabled field)
// ---------------------------------------------------------------------------
function ToggleSwitch({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 14px",
        background: "var(--io-surface-sunken)",
        border: "1px solid var(--io-border)",
        borderRadius: "var(--io-radius)",
        cursor: "pointer",
        userSelect: "none",
      }}
      onClick={() => onChange(!checked)}
    >
      <div>
        <div style={{ fontSize: "13px", color: "var(--io-text-primary)", fontWeight: 500 }}>
          {label}
        </div>
        {hint && (
          <div style={{ fontSize: "12px", color: "var(--io-text-muted)", marginTop: "2px" }}>
            {hint}
          </div>
        )}
      </div>
      <div
        style={{
          width: "40px",
          height: "22px",
          borderRadius: "11px",
          background: checked ? "var(--io-accent)" : "var(--io-border)",
          position: "relative",
          transition: "background 0.15s",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "3px",
            left: checked ? "21px" : "3px",
            width: "16px",
            height: "16px",
            borderRadius: "50%",
            background: "white",
            transition: "left 0.15s",
            boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
          }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CheckboxList (roles and groups)
// ---------------------------------------------------------------------------
function CheckboxList({
  items,
  selected,
  onChange,
  emptyText,
  getLabel,
}: {
  items: { id: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
  emptyText: string;
  getLabel: (item: { id: string }) => string;
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
        maxHeight: "140px",
        overflowY: "auto",
        border: "1px solid var(--io-border)",
        borderRadius: "var(--io-radius)",
        background: "var(--io-surface-sunken)",
      }}
    >
      {items.map((item) => (
        <label
          key={item.id}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "7px 10px",
            cursor: "pointer",
            fontSize: "13px",
            color: "var(--io-text-primary)",
            borderBottom: "1px solid var(--io-border-subtle)",
          }}
        >
          <input
            type="checkbox"
            checked={selected.includes(item.id)}
            onChange={() => toggle(item.id)}
            style={{ accentColor: "var(--io-accent)", flexShrink: 0 }}
          />
          {getLabel(item)}
        </label>
      ))}
      {items.length === 0 && (
        <div
          style={{
            padding: "12px",
            fontSize: "12px",
            color: "var(--io-text-muted)",
            textAlign: "center",
            fontStyle: "italic",
          }}
        >
          {emptyText}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Large modal wrapper (matches email/sms/auth providers style)
// ---------------------------------------------------------------------------
function LargeModal({
  title,
  subtitle,
  open,
  onOpenChange,
  children,
}: {
  title: string;
  subtitle?: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
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
            width: "min(740px, 95vw)",
            maxHeight: "92vh",
            overflowY: "auto",
            zIndex: 101,
            boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              padding: "22px 24px 18px",
              borderBottom: "1px solid var(--io-border)",
            }}
          >
            <div>
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
              {subtitle && (
                <p
                  style={{
                    margin: "3px 0 0",
                    fontSize: "12px",
                    color: "var(--io-text-muted)",
                  }}
                >
                  {subtitle}
                </p>
              )}
            </div>
            <Dialog.Close asChild>
              <button
                style={{
                  background: "none",
                  border: "none",
                  color: "var(--io-text-muted)",
                  cursor: "pointer",
                  fontSize: "18px",
                  lineHeight: 1,
                  padding: "2px 4px",
                  marginTop: "-2px",
                }}
              >
                ✕
              </button>
            </Dialog.Close>
          </div>
          <div style={{ padding: "24px" }}>{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ---------------------------------------------------------------------------
// SectionHeader — visual separator within the form
// ---------------------------------------------------------------------------
function SectionHeader({ title }: { title: string }) {
  return (
    <div
      style={{
        gridColumn: "span 12",
        fontSize: "11px",
        fontWeight: 600,
        color: "var(--io-text-muted)",
        textTransform: "uppercase",
        letterSpacing: "0.07em",
        paddingBottom: "4px",
        borderBottom: "1px solid var(--io-border-subtle)",
        marginTop: "4px",
      }}
    >
      {title}
    </div>
  );
}

// ---------------------------------------------------------------------------
// FormGrid — 12-column grid layout matching email/sms/auth provider dialogs
// ---------------------------------------------------------------------------
function FormGrid({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(12, 1fr)",
        gap: "16px",
      }}
    >
      {children}
    </div>
  );
}

function Field({
  span,
  label,
  required,
  hint,
  error,
  children,
}: {
  span: 3 | 4 | 5 | 6 | 7 | 8 | 9 | 12;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ gridColumn: `span ${span}` }}>
      <label style={labelStyle}>
        {label}
        {required && (
          <span style={{ color: "var(--io-danger)", marginLeft: "2px" }}>*</span>
        )}
      </label>
      {children}
      {hint && !error && (
        <p style={{ margin: "4px 0 0", fontSize: "11px", color: "var(--io-text-muted)" }}>
          {hint}
        </p>
      )}
      {error && (
        <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--io-danger)" }}>
          {error}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// CreateUserDialog
// ---------------------------------------------------------------------------
interface CreateFormState {
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  display_name: string;
  phone_number: string;
  password: string;
  role_ids: string[];
  group_ids: string[];
}

const CREATE_FORM_DEFAULTS: CreateFormState = {
  username: "",
  email: "",
  first_name: "",
  last_name: "",
  display_name: "",
  phone_number: "",
  password: "",
  role_ids: [],
  group_ids: [],
};

function CreateUserDialog({
  open,
  onOpenChange,
  roles,
  groups,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  roles: Role[];
  groups: Group[];
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<CreateFormState>(CREATE_FORM_DEFAULTS);
  const [displayManual, setDisplayManual] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const mutation = useMutation({
    mutationFn: (req: CreateUserRequest) => usersApi.create(req),
    onSuccess: (result) => {
      if (!result.success) {
        setFormError(result.error.message);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["users"] });
      onOpenChange(false);
      resetForm();
    },
  });

  function resetForm() {
    setForm(CREATE_FORM_DEFAULTS);
    setDisplayManual(false);
    setFormError(null);
    setFieldErrors({});
  }

  function setNameField(key: "first_name" | "last_name", value: string) {
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (!displayManual) {
        const first = key === "first_name" ? value : f.first_name;
        const last = key === "last_name" ? value : f.last_name;
        next.display_name = [first, last].filter(Boolean).join(" ");
      }
      return next;
    });
    if (fieldErrors[key]) setFieldErrors((fe) => ({ ...fe, [key]: "" }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const errors: Record<string, string> = {};
    if (!form.username.trim()) errors.username = "Username is required";
    if (!form.email.trim()) errors.email = "Email is required";
    if (!form.password.trim()) errors.password = "Password is required";
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }

    const req: CreateUserRequest = {
      username: form.username,
      email: form.email,
      password: form.password,
    };
    if (form.first_name) req.first_name = form.first_name;
    if (form.last_name) req.last_name = form.last_name;
    if (form.display_name) req.display_name = form.display_name;
    if (form.phone_number) req.phone_number = form.phone_number;
    if (form.role_ids.length) req.role_ids = form.role_ids;
    if (form.group_ids.length) req.group_ids = form.group_ids;
    mutation.mutate(req);
  }

  return (
    <LargeModal
      title="Add User"
      subtitle="Create a new local user account"
      open={open}
      onOpenChange={(v) => {
        if (!v) resetForm();
        onOpenChange(v);
      }}
    >
      {formError && <ErrorBanner message={formError} />}
      <form onSubmit={handleSubmit} noValidate>
        <FormGrid>
          <SectionHeader title="Identity" />

          <Field span={6} label="First Name">
            <input
              style={inputStyle}
              value={form.first_name}
              onChange={(e) => setNameField("first_name", e.target.value)}
              placeholder="Jane"
            />
          </Field>
          <Field span={6} label="Last Name">
            <input
              style={inputStyle}
              value={form.last_name}
              onChange={(e) => setNameField("last_name", e.target.value)}
              placeholder="Smith"
            />
          </Field>

          <Field
            span={6}
            label="Display Name"
            hint="Auto-filled from first + last name"
          >
            <input
              style={inputStyle}
              value={form.display_name}
              onChange={(e) => {
                setDisplayManual(true);
                setForm((f) => ({ ...f, display_name: e.target.value }));
              }}
              placeholder="Jane Smith"
            />
          </Field>
          <Field
            span={6}
            label="Username"
            required
            error={fieldErrors.username}
          >
            <input
              style={{
                ...inputStyle,
                borderColor: fieldErrors.username ? "var(--io-danger)" : undefined,
              }}
              value={form.username}
              onChange={(e) => {
                setForm((f) => ({ ...f, username: e.target.value }));
                if (fieldErrors.username) setFieldErrors((fe) => ({ ...fe, username: "" }));
              }}
              placeholder="jsmith"
              autoComplete="off"
            />
          </Field>

          <Field span={6} label="Email" required error={fieldErrors.email}>
            <input
              type="email"
              style={{
                ...inputStyle,
                borderColor: fieldErrors.email ? "var(--io-danger)" : undefined,
              }}
              value={form.email}
              onChange={(e) => {
                setForm((f) => ({ ...f, email: e.target.value }));
                if (fieldErrors.email) setFieldErrors((fe) => ({ ...fe, email: "" }));
              }}
              placeholder="jane@example.com"
            />
          </Field>
          <Field
            span={6}
            label="Mobile Number"
            hint="Optional — required only if SMS MFA or alerts are enabled for this user"
          >
            <input
              type="tel"
              style={inputStyle}
              value={form.phone_number}
              onChange={(e) => setForm((f) => ({ ...f, phone_number: e.target.value }))}
              placeholder="+1 555 000 0000"
            />
          </Field>

          <SectionHeader title="Security" />

          <Field span={12} label="Password" required error={fieldErrors.password}>
            <input
              type="password"
              style={{
                ...inputStyle,
                borderColor: fieldErrors.password ? "var(--io-danger)" : undefined,
              }}
              value={form.password}
              onChange={(e) => {
                setForm((f) => ({ ...f, password: e.target.value }));
                if (fieldErrors.password) setFieldErrors((fe) => ({ ...fe, password: "" }));
              }}
              autoComplete="new-password"
            />
          </Field>

          <SectionHeader title="Access" />

          <Field
            span={12}
            label="Roles"
            hint="Users with no roles assigned have no access to the system"
          >
            <CheckboxList
              items={roles}
              selected={form.role_ids ?? []}
              onChange={(ids) => setForm((f) => ({ ...f, role_ids: ids }))}
              emptyText="No roles available"
              getLabel={(item) =>
                (roles.find((r) => r.id === item.id)?.display_name ?? item.id)
              }
            />
          </Field>

          <Field span={12} label="Groups">
            <CheckboxList
              items={groups}
              selected={form.group_ids ?? []}
              onChange={(ids) => setForm((f) => ({ ...f, group_ids: ids }))}
              emptyText="No groups defined"
              getLabel={(item) =>
                (groups.find((g) => g.id === item.id)?.name ?? item.id)
              }
            />
          </Field>
        </FormGrid>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "8px",
            marginTop: "28px",
            paddingTop: "20px",
            borderTop: "1px solid var(--io-border-subtle)",
          }}
        >
          <Dialog.Close asChild>
            <button type="button" style={btnSecondary} onClick={resetForm}>
              Cancel
            </button>
          </Dialog.Close>
          <button type="submit" style={btnPrimary} disabled={mutation.isPending}>
            {mutation.isPending ? "Creating…" : "Create User"}
          </button>
        </div>
      </form>
    </LargeModal>
  );
}

// ---------------------------------------------------------------------------
// EditUserDialog
// ---------------------------------------------------------------------------
interface EditFormState {
  email: string;
  first_name: string;
  last_name: string;
  display_name: string;
  phone_number: string;
  enabled: boolean;
  role_ids: string[];
  group_ids: string[];
  password: string;
}

function EditUserDialog({
  user,
  open,
  onOpenChange,
  roles,
  groups,
}: {
  user: UserDetail | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  roles: Role[];
  groups: Group[];
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<EditFormState>({
    email: "",
    first_name: "",
    last_name: "",
    display_name: "",
    phone_number: "",
    enabled: true,
    role_ids: [],
    group_ids: [],
    password: "",
  });
  const [displayManual, setDisplayManual] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  React.useEffect(() => {
    if (user) {
      setForm({
        email: user.email,
        first_name: user.first_name ?? "",
        last_name: user.last_name ?? "",
        display_name: user.display_name ?? "",
        phone_number: user.phone_number ?? "",
        enabled: user.enabled,
        role_ids: user.roles?.map((r) => r.id) ?? [],
        group_ids: user.groups?.map((g) => g.id) ?? [],
        password: "",
      });
      setDisplayManual(!!user.display_name);
      setFormError(null);
    }
  }, [user]);

  const mutation = useMutation({
    mutationFn: (req: UpdateUserRequest) => usersApi.update(user!.id, req),
    onSuccess: (result) => {
      if (!result.success) {
        setFormError(result.error.message);
        return;
      }
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["user", user!.id] });
      onOpenChange(false);
      setFormError(null);
    },
  });

  function setNameField(key: "first_name" | "last_name", value: string) {
    setForm((f) => {
      const next = { ...f, [key]: value };
      if (!displayManual) {
        const first = key === "first_name" ? value : f.first_name;
        const last = key === "last_name" ? value : f.last_name;
        next.display_name = [first, last].filter(Boolean).join(" ");
      }
      return next;
    });
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const req: UpdateUserRequest = {
      email: form.email,
      first_name: form.first_name || undefined,
      last_name: form.last_name || undefined,
      display_name: form.display_name || undefined,
      phone_number: form.phone_number || undefined,
      enabled: form.enabled,
      role_ids: form.role_ids,
      group_ids: form.group_ids,
    };
    if (form.password) req.password = form.password;
    mutation.mutate(req);
  }

  if (!user) return null;

  return (
    <LargeModal
      title={`Edit User: ${user.username}`}
      subtitle={userDisplayName(user)}
      open={open}
      onOpenChange={onOpenChange}
    >
      {formError && <ErrorBanner message={formError} />}
      <form onSubmit={handleSubmit}>
        <FormGrid>
          <SectionHeader title="Identity" />

          <Field span={6} label="First Name">
            <input
              style={inputStyle}
              value={form.first_name}
              onChange={(e) => setNameField("first_name", e.target.value)}
            />
          </Field>
          <Field span={6} label="Last Name">
            <input
              style={inputStyle}
              value={form.last_name}
              onChange={(e) => setNameField("last_name", e.target.value)}
            />
          </Field>

          <Field
            span={6}
            label="Display Name"
            hint="Auto-filled from first + last name"
          >
            <input
              style={inputStyle}
              value={form.display_name}
              onChange={(e) => {
                setDisplayManual(true);
                setForm((f) => ({ ...f, display_name: e.target.value }));
              }}
            />
          </Field>
          <Field span={6} label="Email" required>
            <input
              type="email"
              style={inputStyle}
              value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              required
            />
          </Field>

          <Field
            span={6}
            label="Mobile Number"
            hint="Optional — required for SMS MFA/alerts"
          >
            <input
              type="tel"
              style={inputStyle}
              value={form.phone_number}
              onChange={(e) => setForm((f) => ({ ...f, phone_number: e.target.value }))}
              placeholder="+1 555 000 0000"
            />
          </Field>
          <Field span={6} label="Username">
            <input
              style={{ ...inputStyle, opacity: 0.6, cursor: "not-allowed" }}
              value={user.username}
              readOnly
            />
          </Field>

          <SectionHeader title="Security" />

          <Field
            span={12}
            label="New Password"
            hint="Leave blank to keep the current password"
          >
            <input
              type="password"
              style={inputStyle}
              value={form.password}
              onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
              placeholder="Leave blank to keep current"
              autoComplete="new-password"
            />
          </Field>

          <div style={{ gridColumn: "span 12" }}>
            <ToggleSwitch
              checked={form.enabled ?? true}
              onChange={(v) => setForm((f) => ({ ...f, enabled: v }))}
              label="Account enabled"
              hint={
                form.enabled
                  ? "User can log in"
                  : "User cannot log in — all active sessions will be revoked on save"
              }
            />
          </div>

          <SectionHeader title="Access" />

          <Field
            span={12}
            label="Roles"
            hint="Users with no roles assigned have no access to the system"
          >
            <CheckboxList
              items={roles}
              selected={form.role_ids ?? []}
              onChange={(ids) => setForm((f) => ({ ...f, role_ids: ids }))}
              emptyText="No roles available"
              getLabel={(item) =>
                (roles.find((r) => r.id === item.id)?.display_name ?? item.id)
              }
            />
          </Field>

          <Field span={12} label="Groups">
            <CheckboxList
              items={groups}
              selected={form.group_ids ?? []}
              onChange={(ids) => setForm((f) => ({ ...f, group_ids: ids }))}
              emptyText="No groups defined"
              getLabel={(item) =>
                (groups.find((g) => g.id === item.id)?.name ?? item.id)
              }
            />
          </Field>
        </FormGrid>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "8px",
            marginTop: "28px",
            paddingTop: "20px",
            borderTop: "1px solid var(--io-border-subtle)",
          }}
        >
          <Dialog.Close asChild>
            <button type="button" style={btnSecondary}>
              Cancel
            </button>
          </Dialog.Close>
          <button type="submit" style={btnPrimary} disabled={mutation.isPending}>
            {mutation.isPending ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </form>
    </LargeModal>
  );
}

// ---------------------------------------------------------------------------
// ConfirmDialog
// ---------------------------------------------------------------------------
function ConfirmDialog({
  open,
  onOpenChange,
  title,
  message,
  confirmLabel,
  onConfirm,
  danger,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  danger?: boolean;
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 100 }}
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
            width: "420px",
            maxWidth: "95vw",
            zIndex: 101,
            boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
          }}
        >
          <Dialog.Title
            style={{ margin: "0 0 12px", fontSize: "16px", fontWeight: 600, color: "var(--io-text-primary)" }}
          >
            {title}
          </Dialog.Title>
          <p style={{ margin: "0 0 24px", fontSize: "14px", color: "var(--io-text-secondary)" }}>
            {message}
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
            <Dialog.Close asChild>
              <button type="button" style={btnSecondary}>
                Cancel
              </button>
            </Dialog.Close>
            <button
              type="button"
              style={danger ? btnDanger : btnPrimary}
              onClick={() => {
                onConfirm();
                onOpenChange(false);
              }}
            >
              {confirmLabel}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

// ---------------------------------------------------------------------------
// TableSkeleton
// ---------------------------------------------------------------------------
function TableSkeleton({ rows = 5, columns = 7 }: { rows?: number; columns?: number }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead>
        <tr style={{ borderBottom: "1px solid var(--io-border)", background: "var(--io-surface-primary)" }}>
          {Array.from({ length: columns }).map((_, i) => (
            <th key={i} style={{ padding: "10px 14px", textAlign: "left" }}>
              <div
                style={{
                  height: "10px",
                  borderRadius: "4px",
                  background: "var(--io-border)",
                  width: i === 0 ? "80px" : i === columns - 1 ? "60px" : "120px",
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
            style={{ borderBottom: ri < rows - 1 ? "1px solid var(--io-border-subtle)" : undefined }}
          >
            {Array.from({ length: columns }).map((_, ci) => (
              <td key={ci} style={{ padding: "12px 14px" }}>
                <div
                  style={{
                    height: "12px",
                    borderRadius: "4px",
                    background: "var(--io-surface-primary)",
                    width: ci === columns - 1 ? "64px" : ci === 0 ? "100px" : "140px",
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
// UsersTab
// ---------------------------------------------------------------------------
export function UsersTab() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState<UserDetail | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmUser, setConfirmUser] = useState<User | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [detailUserId, setDetailUserId] = useState<string | null>(null);
  const {
    menuState: userMenu,
    handleContextMenu: openUserMenu,
    closeMenu: closeUserMenu,
  } = useContextMenu<User>();

  const usersQuery = useQuery({
    queryKey: ["users", page, limit],
    queryFn: async () => {
      const result = await usersApi.list({ page, limit });
      if (!result.success) throw new Error(result.error.message);
      return result.data as PaginatedResult<User>;
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

  const groupsQuery = useQuery({
    queryKey: ["groups-list"],
    queryFn: async () => {
      const result = await groupsApi.list({ limit: 200 });
      if (!result.success) throw new Error(result.error.message);
      return result.data.data as Group[];
    },
  });

  const userDetailQuery = useQuery({
    queryKey: ["user", editUser?.id],
    queryFn: async () => {
      if (!editUser) return null;
      const result = await usersApi.get(editUser.id);
      if (!result.success) throw new Error(result.error.message);
      return result.data as UserDetail;
    },
    enabled: !!editUser,
  });

  const disableMutation = useMutation({
    mutationFn: (user: User) => usersApi.update(user.id, { enabled: false }),
    onSuccess: (result) => {
      if (!result.success) { setBannerError(result.error.message); return; }
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

  const enableMutation = useMutation({
    mutationFn: (user: User) => usersApi.update(user.id, { enabled: true }),
    onSuccess: (result) => {
      if (!result.success) { setBannerError(result.error.message); return; }
      queryClient.invalidateQueries({ queryKey: ["users"] });
    },
  });

  function handleEdit(user: User) {
    setEditUser(user as UserDetail);
    setEditOpen(true);
  }

  function handleDisable(user: User) {
    setConfirmUser(user);
    setConfirmOpen(true);
  }

  const pagination = usersQuery.data?.pagination;
  const users = usersQuery.data?.data ?? [];
  const roles = rolesQuery.data ?? [];
  const groups = groupsQuery.data ?? [];

  return (
    <div>
      {/* Actions row */}
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
          entity="users"
          filteredRowCount={pagination?.total ?? users.length}
          totalRowCount={pagination?.total ?? users.length}
          availableColumns={USERS_COLUMNS}
          visibleColumns={USERS_DEFAULT_VISIBLE}
        />
        <button style={btnPrimary} onClick={() => setCreateOpen(true)}>
          + Add User
        </button>
      </div>

      {bannerError && <ErrorBanner message={bannerError} />}

      {/* Table */}
      <div
        style={{
          background: "var(--io-surface-secondary)",
          border: "1px solid var(--io-border)",
          borderRadius: "8px",
          overflow: "hidden",
        }}
      >
        {usersQuery.isLoading && <TableSkeleton rows={5} columns={7} />}
        {usersQuery.isError && (
          <div style={{ padding: "20px" }}>
            <ErrorBanner message={usersQuery.error?.message ?? "Failed to load users"} />
          </div>
        )}
        {!usersQuery.isLoading && !usersQuery.isError && (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr
                style={{
                  borderBottom: "1px solid var(--io-border)",
                  background: "var(--io-surface-primary)",
                }}
              >
                {["User", "Email", "Mobile", "Status", "Auth Provider", "Last Login", "Actions"].map(
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
                        whiteSpace: "nowrap",
                      }}
                    >
                      {col}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    style={{
                      padding: "40px",
                      textAlign: "center",
                      color: "var(--io-text-muted)",
                      fontSize: "14px",
                      fontStyle: "italic",
                    }}
                  >
                    No users found
                  </td>
                </tr>
              )}
              {users.map((user, i) => (
                <tr
                  key={user.id}
                  style={{
                    borderBottom:
                      i < users.length - 1 ? "1px solid var(--io-border-subtle)" : undefined,
                  }}
                  onContextMenu={(e) => openUserMenu(e, user)}
                >
                  {/* User column — username + display name */}
                  <td style={cellStyle}>
                    <div>
                      <span style={{ fontWeight: 500, color: "var(--io-text-primary)" }}>
                        {user.username}
                      </span>
                      {userDisplayName(user) !== user.username && (
                        <div style={{ fontSize: "12px", color: "var(--io-text-muted)", marginTop: "1px" }}>
                          {userDisplayName(user)}
                        </div>
                      )}
                    </div>
                  </td>
                  <td style={cellStyle}>{user.email}</td>
                  <td style={cellStyle}>
                    <span style={{ fontSize: "12px", color: "var(--io-text-muted)" }}>
                      {user.phone_number ?? "—"}
                    </span>
                  </td>
                  <td style={cellStyle}>
                    <Badge
                      label={user.enabled ? "Active" : "Disabled"}
                      color={user.enabled ? "var(--io-success)" : "var(--io-text-muted)"}
                    />
                  </td>
                  <td style={cellStyle}>
                    <span style={{ fontSize: "12px", color: "var(--io-text-muted)", textTransform: "capitalize" }}>
                      {user.auth_provider}
                    </span>
                  </td>
                  <td style={cellStyle}>
                    <span style={{ fontSize: "12px", color: "var(--io-text-muted)" }}>
                      {formatDate(user.last_login_at)}
                    </span>
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
                        onClick={() => handleEdit(user)}
                      >
                        Edit
                      </button>
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
                        onClick={() => setDetailUserId(user.id)}
                      >
                        View
                      </button>
                      {user.enabled ? (
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
                          onClick={() => handleDisable(user)}
                        >
                          Disable
                        </button>
                      ) : (
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
                          onClick={() => enableMutation.mutate(user)}
                        >
                          Enable
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

      {/* Pagination */}
      {pagination && pagination.total > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: "16px",
            fontSize: "13px",
            color: "var(--io-text-muted)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span>
              Showing {(page - 1) * limit + 1}–{Math.min(page * limit, pagination.total)} of{" "}
              {pagination.total} users
            </span>
            <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "13px" }}>
              Rows per page:
              <select
                value={limit}
                onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }}
                style={{
                  padding: "3px 6px",
                  background: "var(--io-surface-sunken)",
                  border: "1px solid var(--io-border)",
                  borderRadius: "var(--io-radius)",
                  color: "var(--io-text-primary)",
                  fontSize: "13px",
                  cursor: "pointer",
                }}
              >
                {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          </div>
          <div style={{ display: "flex", gap: "6px" }}>
            <button style={btnSecondary} disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              ← Prev
            </button>
            <button
              style={btnSecondary}
              disabled={page >= pagination.pages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <CreateUserDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        roles={roles}
        groups={groups}
      />

      <EditUserDialog
        user={userDetailQuery.data ?? editUser}
        open={editOpen}
        onOpenChange={setEditOpen}
        roles={roles}
        groups={groups}
      />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Disable User"
        message={`Are you sure you want to disable "${confirmUser?.username}"? They will not be able to log in.`}
        confirmLabel="Disable User"
        danger
        onConfirm={() => { if (confirmUser) disableMutation.mutate(confirmUser); }}
      />

      {userMenu && (
        <ContextMenu
          x={userMenu.x}
          y={userMenu.y}
          items={[
            { label: "Edit", onClick: () => handleEdit(userMenu.data!) },
            userMenu.data!.enabled
              ? {
                  label: "Disable Account",
                  danger: true,
                  divider: true,
                  onClick: () => handleDisable(userMenu.data!),
                }
              : {
                  label: "Enable Account",
                  divider: true,
                  onClick: () => enableMutation.mutate(userMenu.data!),
                },
            { label: "View Sessions", onClick: () => setDetailUserId(userMenu.data!.id) },
            {
              label: "Copy Username",
              onClick: () => { navigator.clipboard.writeText(userMenu.data!.username).catch(() => {}); },
            },
          ]}
          onClose={closeUserMenu}
        />
      )}

      <UserDetailDialog
        userId={detailUserId ?? ""}
        open={!!detailUserId}
        onOpenChange={(v) => { if (!v) setDetailUserId(null); }}
      />
    </div>
  );
}

export default function UsersPage() {
  return <UsersTab />;
}
