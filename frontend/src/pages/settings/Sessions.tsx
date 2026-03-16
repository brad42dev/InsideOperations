import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { sessionsApi, Session, MySession } from '../../api/sessions'
import type { PaginatedResult } from '../../api/client'
import { useAuthStore } from '../../store/auth'

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------
const btnSecondary: React.CSSProperties = {
  padding: '4px 10px',
  background: 'transparent',
  color: 'var(--io-text-secondary)',
  border: '1px solid var(--io-border)',
  borderRadius: 'var(--io-radius)',
  fontSize: '12px',
  cursor: 'pointer',
}

const btnDanger: React.CSSProperties = {
  ...btnSecondary,
  color: 'var(--io-danger)',
  borderColor: 'rgba(239,68,68,0.3)',
}

const cellStyle: React.CSSProperties = {
  padding: '10px 14px',
  fontSize: '13px',
  color: 'var(--io-text-secondary)',
  verticalAlign: 'middle',
}

const tabBase: React.CSSProperties = {
  padding: '8px 16px',
  fontSize: '13px',
  fontWeight: 500,
  background: 'none',
  border: 'none',
  borderBottom: '2px solid transparent',
  cursor: 'pointer',
  color: 'var(--io-text-muted)',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function formatExpiry(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'expired'
  const days = Math.floor(diff / 86400000)
  const hrs = Math.floor((diff % 86400000) / 3600000)
  if (days > 0) return `${days}d ${hrs}h`
  const mins = Math.floor((diff % 3600000) / 60000)
  if (hrs > 0) return `${hrs}h ${mins}m`
  return `${mins}m`
}

/** Extracts a human-readable browser/OS hint from a user-agent string. */
function parseAgent(ua: string | null): string {
  if (!ua) return '—'
  if (ua.includes('Firefox')) return 'Firefox'
  if (ua.includes('Edg/')) return 'Edge'
  if (ua.includes('Chrome')) return 'Chrome'
  if (ua.includes('Safari')) return 'Safari'
  if (ua.includes('curl')) return 'curl'
  if (ua.includes('python')) return 'Python'
  // Truncate anything else
  return ua.length > 40 ? ua.slice(0, 40) + '…' : ua
}

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

function EmptyState({ message }: { message: string }) {
  return (
    <tr>
      <td
        colSpan={99}
        style={{ padding: '40px', textAlign: 'center', color: 'var(--io-text-muted)', fontSize: '14px' }}
      >
        {message}
      </td>
    </tr>
  )
}

// ---------------------------------------------------------------------------
// AllSessionsTab — admin view of every active session
// ---------------------------------------------------------------------------
function AllSessionsTab() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [limit, setLimit] = useState(25)
  const [bannerError, setBannerError] = useState<string | null>(null)

  const { data: result, isLoading, isError, error } = useQuery({
    queryKey: ['admin-sessions', page, limit],
    queryFn: async () => {
      const r = await sessionsApi.list({ page, limit })
      if (!r.success) throw new Error(r.error.message)
      return r.data as PaginatedResult<Session>
    },
    refetchInterval: 30000, // refresh every 30s so the list stays current
  })

  const sessions: Session[] = result?.data ?? []
  const pagination = result?.pagination

  const revokeMutation = useMutation({
    mutationFn: (id: string) => sessionsApi.revoke(id),
    onSuccess: (r) => {
      if (!r.success) { setBannerError(r.error.message); return }
      queryClient.invalidateQueries({ queryKey: ['admin-sessions'] })
    },
  })

  const revokeAllMutation = useMutation({
    mutationFn: (userId: string) => sessionsApi.revokeAllForUser(userId),
    onSuccess: (r) => {
      if (!r.success) { setBannerError(r.error.message); return }
      queryClient.invalidateQueries({ queryKey: ['admin-sessions'] })
    },
  })

  return (
    <div>
      {bannerError && <ErrorBanner message={bannerError} />}

      <div
        style={{
          background: 'var(--io-surface-secondary)',
          border: '1px solid var(--io-border)',
          borderRadius: '8px',
          overflow: 'hidden',
        }}
      >
        {isLoading && (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--io-text-muted)', fontSize: '14px' }}>
            Loading sessions…
          </div>
        )}
        {isError && (
          <div style={{ padding: '20px' }}>
            <ErrorBanner message={(error as Error)?.message ?? 'Failed to load sessions'} />
          </div>
        )}
        {!isLoading && !isError && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--io-border)', background: 'var(--io-surface-primary)' }}>
                {['User', 'IP Address', 'Browser', 'Last Active', 'Expires In', 'Actions'].map((col) => (
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
                ))}
              </tr>
            </thead>
            <tbody>
              {sessions.length === 0 && <EmptyState message="No active sessions" />}
              {sessions.map((s, i) => (
                <tr
                  key={s.id}
                  style={{ borderBottom: i < sessions.length - 1 ? '1px solid var(--io-border-subtle)' : undefined }}
                >
                  <td style={cellStyle}>
                    <div style={{ fontWeight: 500, color: 'var(--io-text-primary)' }}>{s.username}</div>
                    <div style={{ fontSize: '11px', color: 'var(--io-text-muted)', marginTop: '2px' }}>
                      {s.email}
                    </div>
                  </td>
                  <td style={cellStyle}>
                    <code style={{ fontSize: '12px', color: 'var(--io-text-primary)' }}>
                      {s.ip_address ?? '—'}
                    </code>
                  </td>
                  <td style={cellStyle}>{parseAgent(s.user_agent)}</td>
                  <td style={cellStyle}>{formatRelative(s.last_accessed_at)}</td>
                  <td style={cellStyle}>
                    <span style={{ color: 'var(--io-text-muted)', fontSize: '12px' }}>
                      {formatExpiry(s.expires_at)}
                    </span>
                  </td>
                  <td style={cellStyle}>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        style={btnDanger}
                        disabled={revokeMutation.isPending}
                        onClick={() => revokeMutation.mutate(s.id)}
                        title="Revoke this session"
                      >
                        Revoke
                      </button>
                      <button
                        style={btnDanger}
                        disabled={revokeAllMutation.isPending}
                        onClick={() => revokeAllMutation.mutate(s.user_id)}
                        title={`Revoke all sessions for ${s.username}`}
                      >
                        Kick All
                      </button>
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
              {(page - 1) * limit + 1}–{Math.min(page * limit, pagination.total)} of{' '}
              {pagination.total} sessions
            </span>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              Rows:
              <select
                value={limit}
                onChange={(e) => { setLimit(Number(e.target.value)); setPage(1) }}
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
                {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
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
    </div>
  )
}

// ---------------------------------------------------------------------------
// MySessionsTab — current user's own sessions
// ---------------------------------------------------------------------------
function MySessionsTab() {
  const queryClient = useQueryClient()
  const { user } = useAuthStore()
  const [bannerError, setBannerError] = useState<string | null>(null)

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['my-sessions'],
    queryFn: async () => {
      const r = await sessionsApi.listMine()
      if (!r.success) throw new Error(r.error.message)
      return r.data as MySession[]
    },
  })

  const sessions = data ?? []

  const revokeMutation = useMutation({
    mutationFn: (id: string) => sessionsApi.revokeMine(id),
    onSuccess: (r) => {
      if (!r.success) { setBannerError(r.error.message); return }
      queryClient.invalidateQueries({ queryKey: ['my-sessions'] })
    },
  })

  return (
    <div>
      <p style={{ margin: '0 0 16px', fontSize: '13px', color: 'var(--io-text-muted)' }}>
        Active sessions for <strong style={{ color: 'var(--io-text-primary)' }}>{user?.username}</strong>.
        Revoking a session signs you out on that device.
      </p>

      {bannerError && <ErrorBanner message={bannerError} />}

      <div
        style={{
          background: 'var(--io-surface-secondary)',
          border: '1px solid var(--io-border)',
          borderRadius: '8px',
          overflow: 'hidden',
        }}
      >
        {isLoading && (
          <div style={{ padding: '40px', textAlign: 'center', color: 'var(--io-text-muted)', fontSize: '14px' }}>
            Loading…
          </div>
        )}
        {isError && (
          <div style={{ padding: '20px' }}>
            <ErrorBanner message={(error as Error)?.message ?? 'Failed to load sessions'} />
          </div>
        )}
        {!isLoading && !isError && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--io-border)', background: 'var(--io-surface-primary)' }}>
                {['IP Address', 'Browser', 'Signed In', 'Last Active', 'Expires In', 'Action'].map((col) => (
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
                    }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sessions.length === 0 && <EmptyState message="No active sessions" />}
              {sessions.map((s, i) => (
                <tr
                  key={s.id}
                  style={{ borderBottom: i < sessions.length - 1 ? '1px solid var(--io-border-subtle)' : undefined }}
                >
                  <td style={cellStyle}>
                    <code style={{ fontSize: '12px', color: 'var(--io-text-primary)' }}>
                      {s.ip_address ?? '—'}
                    </code>
                  </td>
                  <td style={cellStyle}>{parseAgent(s.user_agent)}</td>
                  <td style={cellStyle}>{formatRelative(s.created_at)}</td>
                  <td style={cellStyle}>{formatRelative(s.last_accessed_at)}</td>
                  <td style={cellStyle}>
                    <span style={{ color: 'var(--io-text-muted)', fontSize: '12px' }}>
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
  )
}

// ---------------------------------------------------------------------------
// Sessions page
// ---------------------------------------------------------------------------
export default function Sessions() {
  const { user } = useAuthStore()
  const isAdmin = user?.permissions?.includes('system:configure') ||
    user?.permissions?.includes('*')

  const [tab, setTab] = useState<'all' | 'mine'>(isAdmin ? 'all' : 'mine')

  function tabStyle(active: boolean): React.CSSProperties {
    return {
      ...tabBase,
      color: active ? 'var(--io-text-primary)' : 'var(--io-text-muted)',
      borderBottom: `2px solid ${active ? 'var(--io-accent)' : 'transparent'}`,
    }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ margin: '0 0 4px', fontSize: '18px', fontWeight: 600, color: 'var(--io-text-primary)' }}>
          Sessions
        </h2>
        <p style={{ margin: 0, fontSize: '13px', color: 'var(--io-text-muted)' }}>
          View and revoke active login sessions
        </p>
      </div>

      {/* Tabs */}
      {isAdmin && (
        <div style={{ display: 'flex', borderBottom: '1px solid var(--io-border)', marginBottom: '20px' }}>
          <button style={tabStyle(tab === 'all')} onClick={() => setTab('all')}>
            All Sessions
          </button>
          <button style={tabStyle(tab === 'mine')} onClick={() => setTab('mine')}>
            My Sessions
          </button>
        </div>
      )}

      {tab === 'all' && isAdmin ? <AllSessionsTab /> : <MySessionsTab />}
    </div>
  )
}
