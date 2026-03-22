import React, { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usersApi, User, UserDetail, CreateUserRequest, UpdateUserRequest } from '../../api/users'
import { rolesApi, Role } from '../../api/roles'
import type { PaginatedResult } from '../../api/client'
import { ExportButton } from '../../shared/components/ExportDialog'

// ---------------------------------------------------------------------------
// Column definitions for users export
// ---------------------------------------------------------------------------
const USERS_COLUMNS = [
  { id: 'id', label: 'ID' },
  { id: 'username', label: 'Username' },
  { id: 'email', label: 'Email' },
  { id: 'full_name', label: 'Full Name' },
  { id: 'enabled', label: 'Status' },
  { id: 'auth_provider', label: 'Auth Provider' },
  { id: 'last_login_at', label: 'Last Login' },
  { id: 'created_at', label: 'Created At' },
]

const USERS_DEFAULT_VISIBLE = ['username', 'email', 'full_name', 'enabled', 'auth_provider', 'last_login_at']

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  background: 'var(--io-surface-sunken)',
  border: '1px solid var(--io-border)',
  borderRadius: 'var(--io-radius)',
  color: 'var(--io-text-primary)',
  fontSize: '13px',
  outline: 'none',
  boxSizing: 'border-box',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 500,
  color: 'var(--io-text-secondary)',
  marginBottom: '5px',
}

const btnPrimary: React.CSSProperties = {
  padding: '8px 16px',
  background: 'var(--io-accent)',
  color: '#09090b',
  border: 'none',
  borderRadius: 'var(--io-radius)',
  fontSize: '13px',
  fontWeight: 600,
  cursor: 'pointer',
}

const btnSecondary: React.CSSProperties = {
  padding: '8px 16px',
  background: 'transparent',
  color: 'var(--io-text-secondary)',
  border: '1px solid var(--io-border)',
  borderRadius: 'var(--io-radius)',
  fontSize: '13px',
  cursor: 'pointer',
}

const btnDanger: React.CSSProperties = {
  ...btnSecondary,
  color: 'var(--io-danger)',
  borderColor: 'rgba(239,68,68,0.3)',
}

// ---------------------------------------------------------------------------
// ErrorBanner
// ---------------------------------------------------------------------------
function ErrorBanner({ message }: { message: string }) {
  return (
    <div
      style={{
        background: 'rgba(239,68,68,0.1)',
        border: '1px solid rgba(239,68,68,0.3)',
        borderRadius: 'var(--io-radius)',
        padding: '10px 14px',
        color: 'var(--io-danger)',
        fontSize: '13px',
        marginBottom: '16px',
      }}
    >
      {message}
    </div>
  )
}

// ---------------------------------------------------------------------------
// RoleCheckboxList
// ---------------------------------------------------------------------------
function RoleCheckboxList({
  roles,
  selected,
  onChange,
}: {
  roles: Role[]
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
  }
  return (
    <div
      style={{
        maxHeight: '160px',
        overflowY: 'auto',
        border: '1px solid var(--io-border)',
        borderRadius: 'var(--io-radius)',
        padding: '6px',
      }}
    >
      {roles.map((role) => (
        <label
          key={role.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '5px 6px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '13px',
            color: 'var(--io-text-primary)',
          }}
        >
          <input
            type="checkbox"
            checked={selected.includes(role.id)}
            onChange={() => toggle(role.id)}
            style={{ accentColor: 'var(--io-accent)' }}
          />
          <span>{role.display_name}</span>
        </label>
      ))}
      {roles.length === 0 && (
        <div
          style={{ padding: '8px', fontSize: '12px', color: 'var(--io-text-muted)', textAlign: 'center' }}
        >
          No roles available
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// DialogOverlay / DialogContent wrapper
// ---------------------------------------------------------------------------
function ModalContent({
  title,
  children,
  onClose,
}: {
  title: string
  children: React.ReactNode
  onClose?: () => void
}) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          zIndex: 100,
        }}
      />
      <Dialog.Content
        aria-describedby={undefined}
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%,-50%)',
          background: 'var(--io-surface-elevated)',
          border: '1px solid var(--io-border)',
          borderRadius: '10px',
          padding: '24px',
          width: '480px',
          maxWidth: '95vw',
          maxHeight: '90vh',
          overflowY: 'auto',
          zIndex: 101,
          boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px',
          }}
        >
          <Dialog.Title
            style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: 'var(--io-text-primary)' }}
          >
            {title}
          </Dialog.Title>
          <Dialog.Close asChild>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--io-text-muted)',
                cursor: 'pointer',
                fontSize: '18px',
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
  )
}

// ---------------------------------------------------------------------------
// CreateUserDialog
// ---------------------------------------------------------------------------
function CreateUserDialog({
  open,
  onOpenChange,
  roles,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  roles: Role[]
}) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<CreateUserRequest>({
    username: '',
    email: '',
    full_name: '',
    password: '',
    role_ids: [],
  })
  const [formError, setFormError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: (req: CreateUserRequest) => usersApi.create(req),
    onSuccess: (result) => {
      if (!result.success) {
        setFormError(result.error.message)
        return
      }
      queryClient.invalidateQueries({ queryKey: ['users'] })
      onOpenChange(false)
      setForm({ username: '', email: '', full_name: '', password: '', role_ids: [] })
      setFormError(null)
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    const req: CreateUserRequest = { ...form }
    if (!req.full_name) delete req.full_name
    mutation.mutate(req)
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <ModalContent title="Add User">
        {formError && <ErrorBanner message={formError} />}
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={labelStyle}>Username *</label>
              <input
                style={inputStyle}
                value={form.username}
                onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                required
              />
            </div>
            <div>
              <label style={labelStyle}>Email *</label>
              <input
                type="email"
                style={inputStyle}
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                required
              />
            </div>
            <div>
              <label style={labelStyle}>Full Name</label>
              <input
                style={inputStyle}
                value={form.full_name ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
              />
            </div>
            <div>
              <label style={labelStyle}>Password *</label>
              <input
                type="password"
                style={inputStyle}
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                required
              />
            </div>
            <div>
              <label style={labelStyle}>Roles</label>
              <RoleCheckboxList
                roles={roles}
                selected={form.role_ids ?? []}
                onChange={(ids) => setForm((f) => ({ ...f, role_ids: ids }))}
              />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '24px' }}>
            <Dialog.Close asChild>
              <button type="button" style={btnSecondary}>
                Cancel
              </button>
            </Dialog.Close>
            <button type="submit" style={btnPrimary} disabled={mutation.isPending}>
              {mutation.isPending ? 'Creating…' : 'Create User'}
            </button>
          </div>
        </form>
      </ModalContent>
    </Dialog.Root>
  )
}

// ---------------------------------------------------------------------------
// EditUserDialog
// ---------------------------------------------------------------------------
function EditUserDialog({
  user,
  open,
  onOpenChange,
  roles,
}: {
  user: UserDetail | null
  open: boolean
  onOpenChange: (v: boolean) => void
  roles: Role[]
}) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<UpdateUserRequest & { password?: string }>({})
  const [formError, setFormError] = useState<string | null>(null)

  React.useEffect(() => {
    if (user) {
      setForm({
        email: user.email,
        full_name: user.full_name ?? '',
        enabled: user.enabled,
        role_ids: user.roles.map((r) => r.id),
        password: '',
      })
    }
  }, [user])

  const mutation = useMutation({
    mutationFn: (req: UpdateUserRequest) => usersApi.update(user!.id, req),
    onSuccess: (result) => {
      if (!result.success) {
        setFormError(result.error.message)
        return
      }
      queryClient.invalidateQueries({ queryKey: ['users'] })
      onOpenChange(false)
      setFormError(null)
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)
    const req: UpdateUserRequest = {
      email: form.email,
      full_name: form.full_name || undefined,
      enabled: form.enabled,
      role_ids: form.role_ids,
    }
    if (form.password) req.password = form.password
    mutation.mutate(req)
  }

  if (!user) return null

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <ModalContent title={`Edit User: ${user.username}`}>
        {formError && <ErrorBanner message={formError} />}
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={labelStyle}>Email *</label>
              <input
                type="email"
                style={inputStyle}
                value={form.email ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                required
              />
            </div>
            <div>
              <label style={labelStyle}>Full Name</label>
              <input
                style={inputStyle}
                value={form.full_name ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
              />
            </div>
            <div>
              <label style={labelStyle}>New Password (leave blank to keep current)</label>
              <input
                type="password"
                style={inputStyle}
                value={form.password ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="Leave blank to keep current password"
              />
            </div>
            <div>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  color: 'var(--io-text-primary)',
                }}
              >
                <input
                  type="checkbox"
                  checked={form.enabled ?? true}
                  onChange={(e) => setForm((f) => ({ ...f, enabled: e.target.checked }))}
                  style={{ accentColor: 'var(--io-accent)' }}
                />
                Account enabled
              </label>
            </div>
            <div>
              <label style={labelStyle}>Roles</label>
              <RoleCheckboxList
                roles={roles}
                selected={form.role_ids ?? []}
                onChange={(ids) => setForm((f) => ({ ...f, role_ids: ids }))}
              />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '24px' }}>
            <Dialog.Close asChild>
              <button type="button" style={btnSecondary}>
                Cancel
              </button>
            </Dialog.Close>
            <button type="submit" style={btnPrimary} disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </ModalContent>
    </Dialog.Root>
  )
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
  open: boolean
  onOpenChange: (v: boolean) => void
  title: string
  message: string
  confirmLabel: string
  onConfirm: () => void
  danger?: boolean
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <ModalContent title={title}>
        <p style={{ margin: '0 0 24px', fontSize: '14px', color: 'var(--io-text-secondary)' }}>
          {message}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
          <Dialog.Close asChild>
            <button type="button" style={btnSecondary}>
              Cancel
            </button>
          </Dialog.Close>
          <button
            type="button"
            style={danger ? btnDanger : btnPrimary}
            onClick={() => {
              onConfirm()
              onOpenChange(false)
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </ModalContent>
    </Dialog.Root>
  )
}

// ---------------------------------------------------------------------------
// Badge
// ---------------------------------------------------------------------------
function Badge({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: '100px',
        fontSize: '11px',
        fontWeight: 600,
        background: `${color}20`,
        color,
        border: `1px solid ${color}40`,
      }}
    >
      {label}
    </span>
  )
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

// ---------------------------------------------------------------------------
// UsersPage
// ---------------------------------------------------------------------------
export default function UsersPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(50)
  const [createOpen, setCreateOpen] = useState(false)
  const [editUser, setEditUser] = useState<UserDetail | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [confirmUser, setConfirmUser] = useState<User | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [bannerError, setBannerError] = useState<string | null>(null)

  const usersQuery = useQuery({
    queryKey: ['users', page, limit],
    queryFn: async () => {
      const result = await usersApi.list({ page, limit })
      if (!result.success) throw new Error(result.error.message)
      return result.data as PaginatedResult<User>
    },
  })

  const rolesQuery = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const result = await rolesApi.list()
      if (!result.success) throw new Error(result.error.message)
      return result.data.data as Role[]
    },
  })

  const userDetailQuery = useQuery({
    queryKey: ['user', editUser?.id],
    queryFn: async () => {
      if (!editUser) return null
      const result = await usersApi.get(editUser.id)
      if (!result.success) throw new Error(result.error.message)
      return result.data as UserDetail
    },
    enabled: !!editUser,
  })

  const disableMutation = useMutation({
    mutationFn: (user: User) =>
      usersApi.update(user.id, { enabled: false }),
    onSuccess: (result) => {
      if (!result.success) {
        setBannerError(result.error.message)
        return
      }
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })

  function handleEdit(user: User) {
    setEditUser(user as UserDetail)
    setEditOpen(true)
  }

  function handleDisable(user: User) {
    setConfirmUser(user)
    setConfirmOpen(true)
  }

  const pagination = usersQuery.data?.pagination
  const users = usersQuery.data?.data ?? []
  const roles = rolesQuery.data ?? []

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '20px',
        }}
      >
        <div>
          <h2
            style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: 600, color: 'var(--io-text-primary)' }}
          >
            Users
          </h2>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--io-text-muted)' }}>
            Manage user accounts and access
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
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
      </div>

      {bannerError && <ErrorBanner message={bannerError} />}

      {/* Table */}
      <div
        style={{
          background: 'var(--io-surface-secondary)',
          border: '1px solid var(--io-border)',
          borderRadius: '8px',
          overflow: 'hidden',
        }}
      >
        {usersQuery.isLoading && (
          <div
            style={{
              padding: '40px',
              textAlign: 'center',
              color: 'var(--io-text-muted)',
              fontSize: '14px',
            }}
          >
            Loading users…
          </div>
        )}
        {usersQuery.isError && (
          <div style={{ padding: '20px' }}>
            <ErrorBanner message={usersQuery.error?.message ?? 'Failed to load users'} />
          </div>
        )}
        {!usersQuery.isLoading && !usersQuery.isError && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr
                style={{
                  borderBottom: '1px solid var(--io-border)',
                  background: 'var(--io-surface-primary)',
                }}
              >
                {['Username', 'Email', 'Full Name', 'Status', 'Auth Provider', 'Last Login', 'Actions'].map(
                  (col) => (
                    <th
                      key={col}
                      style={{
                        padding: '10px 14px',
                        textAlign: 'left',
                        fontSize: '11px',
                        fontWeight: 600,
                        color: 'var(--io-text-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        whiteSpace: 'nowrap',
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
                      padding: '40px',
                      textAlign: 'center',
                      color: 'var(--io-text-muted)',
                      fontSize: '14px',
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
                      i < users.length - 1 ? '1px solid var(--io-border-subtle)' : undefined,
                  }}
                >
                  <td style={cellStyle}>
                    <span style={{ fontWeight: 500, color: 'var(--io-text-primary)' }}>
                      {user.username}
                    </span>
                  </td>
                  <td style={cellStyle}>{user.email}</td>
                  <td style={cellStyle}>{user.full_name ?? '—'}</td>
                  <td style={cellStyle}>
                    <Badge
                      label={user.enabled ? 'Active' : 'Disabled'}
                      color={user.enabled ? 'var(--io-success)' : 'var(--io-text-muted)'}
                    />
                  </td>
                  <td style={cellStyle}>
                    <span
                      style={{
                        fontSize: '12px',
                        color: 'var(--io-text-muted)',
                        textTransform: 'capitalize',
                      }}
                    >
                      {user.auth_provider}
                    </span>
                  </td>
                  <td style={cellStyle}>
                    <span style={{ fontSize: '12px', color: 'var(--io-text-muted)' }}>
                      {formatDate(user.last_login_at)}
                    </span>
                  </td>
                  <td style={cellStyle}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        style={{
                          padding: '4px 10px',
                          background: 'transparent',
                          border: '1px solid var(--io-border)',
                          borderRadius: 'var(--io-radius)',
                          color: 'var(--io-text-secondary)',
                          fontSize: '12px',
                          cursor: 'pointer',
                        }}
                        onClick={() => handleEdit(user)}
                      >
                        Edit
                      </button>
                      {user.enabled && (
                        <button
                          style={{
                            padding: '4px 10px',
                            background: 'transparent',
                            border: '1px solid rgba(239,68,68,0.3)',
                            borderRadius: 'var(--io-radius)',
                            color: 'var(--io-danger)',
                            fontSize: '12px',
                            cursor: 'pointer',
                          }}
                          onClick={() => handleDisable(user)}
                        >
                          Disable
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
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: '16px',
            fontSize: '13px',
            color: 'var(--io-text-muted)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span>
              Showing {(page - 1) * limit + 1}–{Math.min(page * limit, pagination.total)} of{' '}
              {pagination.total} users
            </span>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}>
              Rows per page:
              <select
                value={limit}
                onChange={(e) => {
                  setLimit(Number(e.target.value))
                  setPage(1)
                }}
                style={{
                  padding: '3px 6px',
                  background: 'var(--io-surface-sunken)',
                  border: '1px solid var(--io-border)',
                  borderRadius: 'var(--io-radius)',
                  color: 'var(--io-text-primary)',
                  fontSize: '13px',
                  cursor: 'pointer',
                }}
              >
                {[10, 25, 50, 100].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </label>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              style={btnSecondary}
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
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
      <CreateUserDialog open={createOpen} onOpenChange={setCreateOpen} roles={roles} />

      <EditUserDialog
        user={userDetailQuery.data ?? editUser}
        open={editOpen}
        onOpenChange={setEditOpen}
        roles={roles}
      />

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Disable User"
        message={`Are you sure you want to disable "${confirmUser?.username}"? They will not be able to log in.`}
        confirmLabel="Disable User"
        danger
        onConfirm={() => {
          if (confirmUser) disableMutation.mutate(confirmUser)
        }}
      />
    </div>
  )
}

const cellStyle: React.CSSProperties = {
  padding: '12px 14px',
  fontSize: '13px',
  color: 'var(--io-text-secondary)',
  verticalAlign: 'middle',
}
