import React, { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../api/client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EulaVersionAdmin {
  id: string
  version: string
  title: string
  content: string
  is_active: boolean
  published_at: string | null
  acceptance_count?: number
}

interface EulaAcceptanceRow {
  id: string
  user_id: string
  username: string
  full_name: string | null
  email: string
  eula_version: string
  eula_version_id: string
  accepted_at: string
  accepted_from_ip: string
  accepted_as_role: string
  content_hash: string
}


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

const btnSmall: React.CSSProperties = {
  padding: '4px 10px',
  fontSize: '12px',
  borderRadius: 'var(--io-radius)',
  cursor: 'pointer',
  border: '1px solid var(--io-border)',
  background: 'transparent',
  color: 'var(--io-text-secondary)',
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.5)',
  zIndex: 50,
}

const dialogStyle: React.CSSProperties = {
  position: 'fixed',
  top: '50%',
  left: '50%',
  transform: 'translate(-50%, -50%)',
  zIndex: 51,
  background: 'var(--io-surface-elevated)',
  border: '1px solid var(--io-border)',
  borderRadius: 'var(--io-radius-lg)',
  padding: '24px',
  width: '700px',
  maxWidth: '95vw',
  maxHeight: '90vh',
  overflowY: 'auto',
}

// ---------------------------------------------------------------------------
// Create Version Dialog
// ---------------------------------------------------------------------------

interface CreateVersionDialogProps {
  open: boolean
  onClose: () => void
  onCreated: () => void
}

function CreateVersionDialog({ open, onClose, onCreated }: CreateVersionDialogProps) {
  const [version, setVersion] = useState('')
  const [title, setTitle] = useState('Inside/Operations — Terms of Use')
  const [content, setContent] = useState('')
  const [error, setError] = useState<string | null>(null)

  const mutation = useMutation({
    mutationFn: () =>
      api.post<EulaVersionAdmin>('/api/auth/admin/eula/versions', { version, title, content }),
    onSuccess: () => {
      onCreated()
      onClose()
      setVersion('')
      setContent('')
      setError(null)
    },
    onError: (e: Error) => setError(e.message),
  })

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay style={overlayStyle} />
        <Dialog.Content aria-describedby={undefined} style={dialogStyle}>
          <Dialog.Title
            style={{ margin: '0 0 20px', fontSize: '16px', fontWeight: 600, color: 'var(--io-text-primary)' }}
          >
            Create New EULA Version (Draft)
          </Dialog.Title>

          <p style={{ margin: '0 0 20px', fontSize: '13px', color: 'var(--io-text-secondary)' }}>
            New versions start as drafts. They become active only when you explicitly publish them.
            Publishing will require all users to re-accept on their next login.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
              <div>
                <label style={labelStyle}>Version string *</label>
                <input
                  style={inputStyle}
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  placeholder="e.g. 1.1"
                />
              </div>
              <div>
                <label style={labelStyle}>Title *</label>
                <input
                  style={inputStyle}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label style={labelStyle}>Content (Markdown) *</label>
              <textarea
                style={{ ...inputStyle, minHeight: '320px', resize: 'vertical', fontFamily: 'monospace', fontSize: '12px' }}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="# Inside/Operations — Terms of Use&#10;&#10;Version 1.x | Effective: ..."
              />
              <div style={{ fontSize: '11px', color: 'var(--io-text-muted)', marginTop: '4px' }}>
                Content is stored as-is in the database. A SHA-256 hash is recorded in every
                user acceptance row, permanently tying each signature to this exact text.
              </div>
            </div>
          </div>

          {error && (
            <div style={{ marginTop: '12px', padding: '8px 12px', background: 'var(--io-error-subtle)', borderRadius: 'var(--io-radius)', fontSize: '13px', color: 'var(--io-error)' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '20px' }}>
            <button style={btnSecondary} onClick={onClose}>Cancel</button>
            <button
              style={{ ...btnPrimary, opacity: (!version.trim() || !content.trim()) ? 0.5 : 1 }}
              disabled={!version.trim() || !content.trim() || mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? 'Creating…' : 'Save as Draft'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// ---------------------------------------------------------------------------
// View Version Dialog (read-only content preview)
// ---------------------------------------------------------------------------

function ViewVersionDialog({ version, onClose }: { version: EulaVersionAdmin | null; onClose: () => void }) {
  if (!version) return null
  return (
    <Dialog.Root open={!!version} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay style={overlayStyle} />
        <Dialog.Content aria-describedby={undefined} style={dialogStyle}>
          <Dialog.Title
            style={{ margin: '0 0 4px', fontSize: '16px', fontWeight: 600, color: 'var(--io-text-primary)' }}
          >
            {version.title}
          </Dialog.Title>
          <div style={{ fontSize: '12px', color: 'var(--io-text-muted)', marginBottom: '16px' }}>
            Version {version.version} · {version.is_active ? '● Active' : 'Draft'} ·{' '}
            {version.published_at ? `Published ${new Date(version.published_at).toLocaleDateString()}` : 'Not published'}
          </div>
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              fontFamily: 'inherit',
              fontSize: '13px',
              color: 'var(--io-text-secondary)',
              lineHeight: 1.6,
              background: 'var(--io-surface-sunken)',
              borderRadius: 'var(--io-radius)',
              padding: '16px',
              maxHeight: '50vh',
              overflowY: 'auto',
              margin: '0 0 20px',
            }}
          >
            {version.content}
          </pre>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button style={btnSecondary} onClick={onClose}>Close</button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

// ---------------------------------------------------------------------------
// Acceptances audit log panel
// ---------------------------------------------------------------------------

function AcceptancesPanel({ versionId }: { versionId?: string }) {
  const [page, setPage] = useState(1)
  const perPage = 25

  const { data, isLoading } = useQuery({
    queryKey: ['eula-acceptances', versionId, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        per_page: String(perPage),
        ...(versionId ? { version_id: versionId } : {}),
      })
      // Backend returns Vec<EulaAcceptanceRecord> (plain array wrapped in ApiResponse)
      const result = await api.get<EulaAcceptanceRow[]>(`/api/auth/admin/eula/acceptances?${params}`)
      if (result.success) return result.data
      return []
    },
  })

  const rows = data ?? []
  const hasMore = rows.length === perPage

  return (
    <div>
      <div style={{ marginBottom: '12px', fontSize: '13px', color: 'var(--io-text-secondary)' }}>
        {isLoading ? 'Loading…' : `${rows.length} record${rows.length === 1 ? '' : 's'} on page ${page}`}
        {versionId && ' (filtered by version)'}
      </div>

      {isLoading ? (
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--io-text-muted)', fontSize: '13px' }}>Loading…</div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--io-border)' }}>
              {['User', 'Version', 'Accepted At', 'Role', 'IP', 'Content Hash'].map((h) => (
                <th key={h} style={{ padding: '6px 10px', textAlign: 'left', fontWeight: 600, color: 'var(--io-text-muted)', whiteSpace: 'nowrap' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} style={{ borderBottom: '1px solid var(--io-border-subtle, var(--io-border))' }}>
                <td style={{ padding: '6px 10px', color: 'var(--io-text-primary)' }}>
                  <div style={{ fontWeight: 500 }}>{row.username}</div>
                  <div style={{ color: 'var(--io-text-muted)', fontSize: '11px' }}>{row.email}</div>
                </td>
                <td style={{ padding: '6px 10px', color: 'var(--io-text-secondary)' }}>{row.eula_version}</td>
                <td style={{ padding: '6px 10px', color: 'var(--io-text-secondary)', whiteSpace: 'nowrap' }}>
                  {new Date(row.accepted_at).toLocaleString()}
                </td>
                <td style={{ padding: '6px 10px', color: 'var(--io-text-secondary)' }}>{row.accepted_as_role}</td>
                <td style={{ padding: '6px 10px', color: 'var(--io-text-muted)', fontFamily: 'monospace', fontSize: '11px' }}>{row.accepted_from_ip}</td>
                <td style={{ padding: '6px 10px', color: 'var(--io-text-muted)', fontFamily: 'monospace', fontSize: '11px' }}>
                  {row.content_hash.slice(0, 12)}…
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: 'var(--io-text-muted)' }}>
                  No acceptances found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}

      {(page > 1 || hasMore) && (
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '12px' }}>
          <button style={btnSmall} disabled={page === 1} onClick={() => setPage((p) => p - 1)}>← Prev</button>
          <span style={{ fontSize: '12px', color: 'var(--io-text-muted)', alignSelf: 'center' }}>
            Page {page}
          </span>
          <button style={btnSmall} disabled={!hasMore} onClick={() => setPage((p) => p + 1)}>Next →</button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main EULA Admin Page
// ---------------------------------------------------------------------------

type ActiveTab = 'versions' | 'acceptances'

export default function EulaAdminPage() {
  const queryClient = useQueryClient()
  const [activeTab, setActiveTab] = useState<ActiveTab>('versions')
  const [createOpen, setCreateOpen] = useState(false)
  const [viewVersion, setViewVersion] = useState<EulaVersionAdmin | null>(null)
  const [filterVersionId, setFilterVersionId] = useState<string | undefined>()
  const [publishConfirmId, setPublishConfirmId] = useState<string | null>(null)
  const [publishError, setPublishError] = useState<string | null>(null)

  const { data: versions, isLoading: versionsLoading } = useQuery({
    queryKey: ['eula-versions-admin'],
    queryFn: async () => {
      const result = await api.get<EulaVersionAdmin[]>('/api/auth/admin/eula/versions')
      if (result.success) return result.data
      return []
    },
  })

  const publishMutation = useMutation({
    mutationFn: (id: string) =>
      api.post<EulaVersionAdmin>(`/api/auth/admin/eula/versions/${id}/publish`, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['eula-versions-admin'] })
      setPublishConfirmId(null)
      setPublishError(null)
    },
    onError: (e: Error) => setPublishError(e.message),
  })

  const tabStyle = (tab: ActiveTab): React.CSSProperties => ({
    padding: '8px 16px',
    fontSize: '13px',
    fontWeight: activeTab === tab ? 600 : 400,
    color: activeTab === tab ? 'var(--io-accent)' : 'var(--io-text-secondary)',
    background: 'none',
    border: 'none',
    borderBottom: activeTab === tab ? '2px solid var(--io-accent)' : '2px solid transparent',
    cursor: 'pointer',
    paddingBottom: '10px',
  })

  return (
    <div style={{ maxWidth: '900px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
        <div>
          <h2 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: 600, color: 'var(--io-text-primary)' }}>
            Terms of Use Management
          </h2>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--io-text-secondary)' }}>
            Manage end-user Terms of Use versions and view the acceptance audit log.
            Every version is retained permanently. Every user acceptance is permanently recorded
            with a SHA-256 hash of the exact text they agreed to.
          </p>
        </div>
        <button style={{ ...btnPrimary, whiteSpace: 'nowrap', marginLeft: '16px' }} onClick={() => setCreateOpen(true)}>
          New Version
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--io-border)', margin: '20px 0 0', gap: '0' }}>
        <button style={tabStyle('versions')} onClick={() => setActiveTab('versions')}>Versions</button>
        <button style={tabStyle('acceptances')} onClick={() => setActiveTab('acceptances')}>Acceptance Log</button>
      </div>

      <div style={{ paddingTop: '20px' }}>
        {/* Versions tab */}
        {activeTab === 'versions' && (
          <>
            {versionsLoading ? (
              <div style={{ padding: '32px', textAlign: 'center', color: 'var(--io-text-muted)', fontSize: '13px' }}>Loading…</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {(versions ?? []).length === 0 && (
                  <div style={{ padding: '32px', textAlign: 'center', color: 'var(--io-text-muted)', fontSize: '13px' }}>
                    No EULA versions found. The active version is seeded automatically on startup.
                  </div>
                )}
                {(versions ?? []).map((v) => (
                  <div
                    key={v.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '14px 16px',
                      background: 'var(--io-surface-secondary)',
                      border: `1px solid ${v.is_active ? 'var(--io-accent)' : 'var(--io-border)'}`,
                      borderRadius: 'var(--io-radius)',
                    }}
                  >
                    {/* Status badge */}
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '999px',
                        fontSize: '11px',
                        fontWeight: 600,
                        background: v.is_active ? 'var(--io-accent-subtle)' : 'var(--io-surface-sunken)',
                        color: v.is_active ? 'var(--io-accent)' : 'var(--io-text-muted)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {v.is_active ? 'Active' : 'Draft'}
                    </span>

                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--io-text-primary)' }}>
                        {v.title}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--io-text-muted)', marginTop: '2px' }}>
                        v{v.version}
                        {v.published_at && ` · Published ${new Date(v.published_at).toLocaleDateString()}`}
                        {v.acceptance_count != null && ` · ${v.acceptance_count.toLocaleString()} acceptances`}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button style={btnSmall} onClick={() => setViewVersion(v)}>View</button>
                      <button
                        style={btnSmall}
                        onClick={() => {
                          setFilterVersionId(v.id)
                          setActiveTab('acceptances')
                        }}
                      >
                        Signatures
                      </button>
                      {!v.is_active && (
                        <button
                          style={{ ...btnSmall, color: 'var(--io-accent)', borderColor: 'var(--io-accent)' }}
                          onClick={() => { setPublishConfirmId(v.id); setPublishError(null) }}
                        >
                          Publish
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Publish confirmation */}
            {publishConfirmId && (
              <div
                style={{
                  marginTop: '16px',
                  padding: '16px',
                  background: 'var(--io-warning-subtle, var(--io-surface-sunken))',
                  border: '1px solid var(--io-warning, var(--io-border))',
                  borderRadius: 'var(--io-radius)',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--io-text-primary)', marginBottom: '8px' }}>
                  Confirm publish
                </div>
                <p style={{ margin: '0 0 12px', fontSize: '13px', color: 'var(--io-text-secondary)' }}>
                  Publishing this version will make it the active Terms of Use. All users will
                  be required to re-accept on their next login. This action cannot be undone.
                </p>
                {publishError && (
                  <div style={{ marginBottom: '12px', fontSize: '13px', color: 'var(--io-error)' }}>{publishError}</div>
                )}
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button style={btnSecondary} onClick={() => { setPublishConfirmId(null); setPublishError(null) }}>Cancel</button>
                  <button
                    style={btnPrimary}
                    disabled={publishMutation.isPending}
                    onClick={() => publishMutation.mutate(publishConfirmId)}
                  >
                    {publishMutation.isPending ? 'Publishing…' : 'Publish this version'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Acceptances tab */}
        {activeTab === 'acceptances' && (
          <>
            {filterVersionId && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <span style={{ fontSize: '13px', color: 'var(--io-text-secondary)' }}>
                  Filtered by version ID: <code style={{ fontFamily: 'monospace', fontSize: '11px' }}>{filterVersionId.slice(0, 8)}…</code>
                </span>
                <button
                  style={{ ...btnSmall, fontSize: '11px' }}
                  onClick={() => setFilterVersionId(undefined)}
                >
                  Clear filter
                </button>
              </div>
            )}
            <AcceptancesPanel versionId={filterVersionId} />
          </>
        )}
      </div>

      {/* Dialogs */}
      <CreateVersionDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => queryClient.invalidateQueries({ queryKey: ['eula-versions-admin'] })}
      />
      <ViewVersionDialog version={viewVersion} onClose={() => setViewVersion(null)} />
    </div>
  )
}
