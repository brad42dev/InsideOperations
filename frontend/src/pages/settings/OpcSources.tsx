import React, { useState, useRef, useEffect } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  pointSourcesApi,
  pointSourceStatsApi,
  historyRecoveryApi,
  PointSource,
  PointSourceStats,
  RecoveryJob,
  CreatePointSourceRequest,
  UpdatePointSourceRequest,
} from '../../api/points'
import { opcCertsApi, OpcServerCert } from '../../api/opcCerts'
import { settingsApi } from '../../api/settings'
import SupplementalConnectorsTab from './SupplementalConnectorsTab'
import { ExportButton } from '../../shared/components/ExportDialog'

// ---------------------------------------------------------------------------
// Column definitions for OPC sources export
// ---------------------------------------------------------------------------
const OPC_SOURCES_COLUMNS = [
  { id: 'name', label: 'Name' },
  { id: 'endpoint_url', label: 'Endpoint URL' },
  { id: 'status', label: 'Status' },
  { id: 'enabled', label: 'Enabled' },
  { id: 'security_policy', label: 'Security Policy' },
  { id: 'security_mode', label: 'Security Mode' },
  { id: 'last_connected_at', label: 'Last Connected' },
]

const OPC_SOURCES_DEFAULT_VISIBLE = ['name', 'endpoint_url', 'status', 'enabled', 'last_connected_at']

// ---------------------------------------------------------------------------
// TableSkeleton — shimmer rows for OPC sources table
// ---------------------------------------------------------------------------
function TableSkeleton({ rows = 4, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr
          style={{
            borderBottom: '1px solid var(--io-border)',
            background: 'var(--io-surface-primary)',
          }}
        >
          {Array.from({ length: columns }).map((_, i) => (
            <th key={i} style={{ padding: '10px 14px', textAlign: 'left' }}>
              <div
                style={{
                  height: '10px',
                  borderRadius: '4px',
                  background: 'var(--io-border)',
                  width: i === columns - 1 ? '40px' : '120px',
                  animation: 'io-shimmer 1.5s ease-in-out infinite',
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
              borderBottom: ri < rows - 1 ? '1px solid var(--io-border-subtle)' : undefined,
            }}
          >
            {Array.from({ length: columns }).map((_, ci) => (
              <td key={ci} style={{ padding: '12px 14px' }}>
                <div
                  style={{
                    height: '12px',
                    borderRadius: '4px',
                    background: 'var(--io-surface-primary)',
                    width: ci === columns - 1 ? '40px' : ci === 0 ? '120px' : '160px',
                    animation: 'io-shimmer 1.5s ease-in-out infinite',
                    animationDelay: `${ri * 0.05}s`,
                  }}
                />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ---------------------------------------------------------------------------
// OpcSourceContextMenu — right-click context menu for OPC source table rows
// ---------------------------------------------------------------------------
interface ContextMenuPos { x: number; y: number }

function OpcSourceContextMenu({
  source,
  pos,
  onClose,
  onEdit,
  onToggleEnabled,
  onTestConnection,
  onDelete,
}: {
  source: PointSource
  pos: ContextMenuPos
  onClose: () => void
  onEdit: (s: PointSource) => void
  onToggleEnabled: (s: PointSource) => void
  onTestConnection: (s: PointSource) => void
  onDelete: (s: PointSource) => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    top: pos.y,
    left: pos.x,
    zIndex: 500,
    background: 'var(--io-surface-elevated)',
    border: '1px solid var(--io-border)',
    borderRadius: 'var(--io-radius)',
    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
    minWidth: '180px',
    overflow: 'hidden',
    padding: '4px 0',
  }

  const itemStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    padding: '7px 14px',
    background: 'transparent',
    border: 'none',
    textAlign: 'left',
    fontSize: '13px',
    color: 'var(--io-text-secondary)',
    cursor: 'pointer',
  }

  const dangerItemStyle: React.CSSProperties = {
    ...itemStyle,
    color: 'var(--io-danger)',
  }

  function menuItem(label: string, action: () => void, danger = false) {
    return (
      <button
        style={danger ? dangerItemStyle : itemStyle}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--io-surface-secondary)' }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
        onClick={() => { action(); onClose() }}
      >
        {label}
      </button>
    )
  }

  return (
    <div ref={ref} style={menuStyle}>
      {menuItem('Edit', () => onEdit(source))}
      {source.enabled
        ? menuItem('Disable Source', () => onToggleEnabled(source))
        : menuItem('Enable Source', () => onToggleEnabled(source))}
      {menuItem('Test Connection', () => onTestConnection(source))}
      {menuItem('Delete', () => onDelete(source), true)}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Client certificate API (GET /api/certificates?type=client)
// ---------------------------------------------------------------------------

export interface ClientCertificate {
  id: string
  name: string
  subject: string | null
  not_after: string | null
  expired: boolean
}

const clientCertsApi = {
  list: () =>
    fetch('/api/certificates?type=client', {
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    }).then(async (r) => {
      const json = await r.json()
      return json as { success: boolean; data: ClientCertificate[]; error?: { message: string } }
    }),
}

// ---------------------------------------------------------------------------
// Styles
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

const cellStyle: React.CSSProperties = {
  padding: '12px 14px',
  fontSize: '13px',
  color: 'var(--io-text-secondary)',
  verticalAlign: 'middle',
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, string> = {
  active: 'var(--io-success)',
  inactive: 'var(--io-text-muted)',
  connecting: 'var(--io-warning)',
  error: 'var(--io-danger)',
}

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status] ?? 'var(--io-text-muted)'
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        padding: '2px 8px',
        borderRadius: '9999px',
        fontSize: '11px',
        fontWeight: 600,
        background: `${color}20`,
        color,
        border: `1px solid ${color}40`,
        textTransform: 'capitalize',
      }}
    >
      <span
        style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: color,
          flexShrink: 0,
        }}
      />
      {status}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Source stats — inline chips for the table row
// ---------------------------------------------------------------------------

function fmtCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

function SourceStatsChips({ stats }: { stats: PointSourceStats | undefined }) {
  if (!stats) return null
  const chips: Array<{ label: string; value: string; color?: string }> = [
    { label: 'pts', value: fmtCount(stats.point_count) },
    { label: 'active', value: fmtCount(stats.active_subscriptions) },
  ]
  if (stats.updates_per_minute !== null) {
    chips.push({ label: '/min', value: fmtCount(stats.updates_per_minute) })
  }
  if (stats.error_count_24h > 0) {
    chips.push({ label: 'errors', value: String(stats.error_count_24h), color: 'var(--io-danger)' })
  }
  return (
    <div
      style={{ display: 'flex', gap: '6px', marginTop: '5px', flexWrap: 'wrap' }}
      onClick={(e) => e.stopPropagation()}
    >
      {chips.map((c) => (
        <span
          key={c.label}
          style={{
            display: 'inline-flex',
            alignItems: 'baseline',
            gap: '3px',
            fontSize: '11px',
            color: c.color ?? 'var(--io-text-muted)',
          }}
        >
          <strong style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{c.value}</strong>
          <span style={{ opacity: 0.7 }}>{c.label}</span>
        </span>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Source stats — tile grid for the detail panel
// ---------------------------------------------------------------------------

function SourceStatsTiles({ sourceId }: { sourceId: string }) {
  const statsQuery = useQuery({
    queryKey: ['point-source-stats', sourceId],
    queryFn: async () => {
      const r = await pointSourceStatsApi.get(sourceId)
      if (!r.success) throw new Error(r.error.message)
      return r.data as PointSourceStats
    },
    refetchInterval: 15_000,
  })

  const s = statsQuery.data
  const tiles: Array<{ label: string; value: string; sub?: string; accent?: boolean; danger?: boolean }> = [
    {
      label: 'Total Points',
      value: s ? fmtCount(s.point_count) : '—',
      sub: 'configured',
    },
    {
      label: 'Active Subs',
      value: s ? fmtCount(s.active_subscriptions) : '—',
      sub: 'subscriptions',
      accent: s ? s.active_subscriptions > 0 : false,
    },
    {
      label: 'Updates / min',
      value: s?.updates_per_minute !== null && s?.updates_per_minute !== undefined
        ? fmtCount(s.updates_per_minute)
        : '—',
      sub: 'recording',
    },
    {
      label: 'Errors (24 h)',
      value: s ? String(s.error_count_24h) : '—',
      danger: s ? s.error_count_24h > 0 : false,
    },
  ]

  return (
    <div>
      <div
        style={{
          fontSize: '11px',
          fontWeight: 600,
          color: 'var(--io-text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginBottom: '10px',
        }}
      >
        Live Statistics
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '20px' }}>
        {tiles.map((t) => (
          <div
            key={t.label}
            style={{
              background: 'var(--io-surface-secondary)',
              border: '1px solid var(--io-border-subtle)',
              borderRadius: 'var(--io-radius)',
              padding: '12px 10px',
              display: 'flex',
              flexDirection: 'column',
              gap: '2px',
            }}
          >
            <div
              style={{
                fontSize: '20px',
                fontWeight: 700,
                fontVariantNumeric: 'tabular-nums',
                color: t.danger
                  ? 'var(--io-danger)'
                  : t.accent
                    ? 'var(--io-success)'
                    : 'var(--io-text-primary)',
                lineHeight: 1.1,
              }}
            >
              {statsQuery.isLoading ? (
                <span style={{ opacity: 0.3 }}>—</span>
              ) : (
                t.value
              )}
            </div>
            <div style={{ fontSize: '11px', color: 'var(--io-text-muted)', lineHeight: 1.3 }}>
              {t.label}
              {t.sub && (
                <span style={{ display: 'block', opacity: 0.7 }}>{t.sub}</span>
              )}
            </div>
          </div>
        ))}
      </div>
      {s?.last_value_at && (
        <div style={{ fontSize: '11px', color: 'var(--io-text-muted)', marginBottom: '16px' }}>
          Last value received: {new Date(s.last_value_at).toLocaleString()}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Modal wrapper
// ---------------------------------------------------------------------------

function ModalContent({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100 }}
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
          width: '520px',
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
// Source form fields (shared between create and edit)
// ---------------------------------------------------------------------------

interface SourceFormState {
  name: string
  endpoint_url: string
  security_policy: string
  security_mode: string
  username: string
  password: string
  enabled: boolean
  client_certificate_id: string | null
  platform: string | null
  publish_interval_ms: number | null
  data_category_id: string | null
}

// ---------------------------------------------------------------------------
// Data categories
// ---------------------------------------------------------------------------

const PREDEFINED_CATEGORIES = [
  { id: 'process',        label: 'Process' },
  { id: 'event',          label: 'Event' },
  { id: 'access_control', label: 'Access Control' },
  { id: 'personnel',      label: 'Personnel' },
  { id: 'financial',      label: 'Financial' },
  { id: 'maintenance',    label: 'Maintenance' },
  { id: 'ticketing',      label: 'Ticketing' },
  { id: 'environmental',  label: 'Environmental' },
  { id: 'general',        label: 'General' },
]

interface DataCategory {
  id: string
  label: string
  predefined: boolean
}

// Simple in-memory custom categories store (backed by API in production)
function useDataCategories() {
  const query = useQuery<DataCategory[]>({
    queryKey: ['data-categories'],
    queryFn: async () => {
      try {
        const res = await fetch('/api/data-categories')
        if (!res.ok) throw new Error('API unavailable')
        const json = await res.json()
        return json.data ?? json
      } catch {
        // Fall back to predefined only
        return PREDEFINED_CATEGORIES.map((c) => ({ ...c, predefined: true }))
      }
    },
    staleTime: 60_000,
    initialData: PREDEFINED_CATEGORIES.map((c) => ({ ...c, predefined: true })),
  })
  return query
}

// ---------------------------------------------------------------------------
// Manage Categories modal
// ---------------------------------------------------------------------------

function ManageCategoriesModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const qc = useQueryClient()
  const catQuery = useDataCategories()
  const categories = catQuery.data ?? []

  const [newName, setNewName] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function handleCreate() {
    const trimmed = newName.trim()
    if (!trimmed) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/data-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: trimmed }),
      })
      if (!res.ok) throw new Error(await res.text())
      qc.invalidateQueries({ queryKey: ['data-categories'] })
      setNewName('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create category')
    } finally {
      setSaving(false)
    }
  }

  async function handleRename(id: string) {
    const trimmed = editName.trim()
    if (!trimmed) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/data-categories/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: trimmed }),
      })
      if (!res.ok) throw new Error(await res.text())
      qc.invalidateQueries({ queryKey: ['data-categories'] })
      setEditId(null)
      setEditName('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to rename category')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this custom category?')) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/data-categories/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(await res.text())
      qc.invalidateQueries({ queryKey: ['data-categories'] })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete category')
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null

  const modalOverlay: React.CSSProperties = {
    position: 'fixed',
    inset: 0,
    zIndex: 200,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'rgba(0,0,0,0.5)',
  }

  const modalBox: React.CSSProperties = {
    position: 'relative',
    width: '500px',
    maxWidth: '95vw',
    maxHeight: '80vh',
    background: 'var(--io-surface-elevated)',
    border: '1px solid var(--io-border)',
    borderRadius: '10px',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
  }

  const catInputStyle: React.CSSProperties = {
    flex: 1,
    padding: '6px 10px',
    background: 'var(--io-surface-secondary)',
    border: '1px solid var(--io-border)',
    borderRadius: 'var(--io-radius)',
    color: 'var(--io-text)',
    fontSize: '13px',
  }

  const smBtn = (variant: 'primary' | 'ghost' | 'danger'): React.CSSProperties => ({
    padding: '5px 10px',
    fontSize: '12px',
    border: variant === 'danger' ? '1px solid var(--io-danger)' : variant === 'ghost' ? '1px solid var(--io-border)' : 'none',
    borderRadius: 'var(--io-radius)',
    background: variant === 'primary' ? 'var(--io-accent)' : 'transparent',
    color: variant === 'primary' ? '#fff' : variant === 'danger' ? 'var(--io-danger)' : 'var(--io-text-secondary)',
    cursor: saving ? 'not-allowed' : 'pointer',
    opacity: saving ? 0.6 : 1,
  })

  return (
    <div style={modalOverlay} onClick={onClose}>
      <div style={modalBox} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div
          style={{
            padding: '18px 20px',
            borderBottom: '1px solid var(--io-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}
        >
          <div style={{ fontWeight: 600, fontSize: '15px' }}>Manage Data Categories</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--io-text-muted)', fontSize: '18px', lineHeight: 1 }}>
            ×
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          <div
            style={{
              fontSize: '12px',
              color: 'var(--io-text-muted)',
              marginBottom: '16px',
              lineHeight: 1.5,
            }}
          >
            Predefined categories cannot be deleted. Custom categories can be renamed or deleted.
          </div>

          {error && (
            <div
              style={{
                padding: '8px 12px',
                background: 'var(--io-danger-subtle)',
                color: 'var(--io-danger)',
                borderRadius: 'var(--io-radius)',
                fontSize: '12px',
                marginBottom: '12px',
              }}
            >
              {error}
            </div>
          )}

          {/* Category list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '20px' }}>
            {categories.map((cat) => (
              <div
                key={cat.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 10px',
                  background: 'var(--io-surface-secondary)',
                  border: '1px solid var(--io-border-subtle)',
                  borderRadius: 'var(--io-radius)',
                }}
              >
                {editId === cat.id ? (
                  <>
                    <input
                      style={catInputStyle}
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleRename(cat.id) }}
                      autoFocus
                    />
                    <button style={smBtn('primary')} onClick={() => handleRename(cat.id)} disabled={saving}>
                      Save
                    </button>
                    <button style={smBtn('ghost')} onClick={() => { setEditId(null); setEditName('') }}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <span style={{ flex: 1, fontSize: '13px', color: 'var(--io-text-primary)' }}>
                      {cat.label}
                    </span>
                    {cat.predefined ? (
                      <span style={{ fontSize: '11px', color: 'var(--io-text-muted)', fontStyle: 'italic' }}>
                        predefined
                      </span>
                    ) : (
                      <>
                        <button
                          style={smBtn('ghost')}
                          onClick={() => { setEditId(cat.id); setEditName(cat.label) }}
                          disabled={saving}
                        >
                          Rename
                        </button>
                        <button style={smBtn('danger')} onClick={() => handleDelete(cat.id)} disabled={saving}>
                          Delete
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>

          {/* Add new */}
          <div
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--io-text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: '8px',
            }}
          >
            Add Custom Category
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input
              style={catInputStyle}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Category name"
              onKeyDown={(e) => { if (e.key === 'Enter') handleCreate() }}
            />
            <button style={smBtn('primary')} onClick={handleCreate} disabled={saving || !newName.trim()}>
              Add
            </button>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 20px',
            borderTop: '1px solid var(--io-border)',
            display: 'flex',
            justifyContent: 'flex-end',
            flexShrink: 0,
          }}
        >
          <button onClick={onClose} style={smBtn('ghost')}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}

const SECURITY_POLICIES = ['None', 'Basic256Sha256', 'Aes128Sha256RsaOaep', 'Aes256Sha256RsaPss']
const SECURITY_MODES = ['None', 'Sign', 'SignAndEncrypt']

// DCS platform options from doc 17 §Connection Profiles
const DCS_PLATFORMS = [
  { value: '', label: 'Unknown / Generic' },
  { value: 'siemens_s7_1500', label: 'Siemens S7-1500 (TIA Portal)' },
  { value: 'siemens_s7_1200', label: 'Siemens S7-1200 (TIA Portal)' },
  { value: 'siemens_wincc_oa', label: 'Siemens WinCC OA' },
  { value: 'siemens_wincc_v7', label: 'Siemens WinCC V7 / RT Pro' },
  { value: 'honeywell_experion', label: 'Honeywell Experion PKS' },
  { value: 'abb_800xa', label: 'ABB 800xA' },
  { value: 'emerson_deltav_pk', label: 'Emerson DeltaV PK Controller' },
  { value: 'emerson_deltav_app', label: 'Emerson DeltaV Application Station' },
  { value: 'yokogawa_exaopc', label: 'Yokogawa Exaopc' },
]

function SourceFormFields({
  form,
  onChange,
  showEnabled,
  clientCerts,
}: {
  form: SourceFormState
  onChange: (patch: Partial<SourceFormState>) => void
  showEnabled?: boolean
  clientCerts?: ClientCertificate[]
}) {
  const [manageCatsOpen, setManageCatsOpen] = useState(false)
  const catQuery = useDataCategories()
  const categories = catQuery.data ?? []
  const field = (
    label: string,
    key: keyof SourceFormState,
    type = 'text',
    placeholder?: string,
    required?: boolean,
  ) => (
    <div>
      <label style={labelStyle}>
        {label}
        {required && ' *'}
      </label>
      <input
        type={type}
        style={inputStyle}
        value={form[key] as string}
        onChange={(e) => onChange({ [key]: e.target.value })}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
      />
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {field('Name', 'name', 'text', 'OPC-Unit3-Primary', true)}
      {field('Endpoint URL', 'endpoint_url', 'text', 'opc.tcp://hostname:4840', true)}

      <div style={{ display: 'flex', gap: '12px' }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Security Policy</label>
          <select
            style={{ ...inputStyle, cursor: 'pointer' }}
            value={form.security_policy}
            onChange={(e) => onChange({ security_policy: e.target.value })}
          >
            {SECURITY_POLICIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Security Mode</label>
          <select
            style={{ ...inputStyle, cursor: 'pointer' }}
            value={form.security_mode}
            onChange={(e) => onChange({ security_mode: e.target.value })}
          >
            {SECURITY_MODES.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Client Certificate dropdown */}
      <div>
        <label style={labelStyle}>Client Certificate</label>
        <select
          style={{ ...inputStyle, cursor: 'pointer' }}
          value={form.client_certificate_id ?? ''}
          onChange={(e) => onChange({ client_certificate_id: e.target.value || null })}
        >
          <option value="">(none)</option>
          {(clientCerts ?? []).map((cert) => (
            <option key={cert.id} value={cert.id}>
              {cert.name}
              {cert.expired ? ' [EXPIRED]' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Platform dropdown */}
      <div>
        <label style={labelStyle}>Platform</label>
        <select
          style={{ ...inputStyle, cursor: 'pointer' }}
          value={form.platform ?? ''}
          onChange={(e) => onChange({ platform: e.target.value || null })}
        >
          {DCS_PLATFORMS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      {/* Data Category dropdown */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <label style={labelStyle}>Data Category</label>
          <button
            type="button"
            onClick={() => setManageCatsOpen(true)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--io-accent)',
              fontSize: '11px',
              cursor: 'pointer',
              padding: '0',
              textDecoration: 'underline',
            }}
          >
            Manage Categories
          </button>
        </div>
        <select
          style={{ ...inputStyle, cursor: 'pointer' }}
          value={form.data_category_id ?? ''}
          onChange={(e) => onChange({ data_category_id: e.target.value || null })}
        >
          <option value="">(none)</option>
          {categories.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.label}
            </option>
          ))}
        </select>
      </div>

      <ManageCategoriesModal open={manageCatsOpen} onClose={() => setManageCatsOpen(false)} />

      {field('Username', 'username', 'text', 'Optional')}
      {field('Password', 'password', 'password', 'Optional')}

      {showEnabled && (
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
            checked={form.enabled}
            onChange={(e) => onChange({ enabled: e.target.checked })}
            style={{ accentColor: 'var(--io-accent)' }}
          />
          Enabled
        </label>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Create dialog
// ---------------------------------------------------------------------------

const EMPTY_FORM: SourceFormState = {
  name: '',
  endpoint_url: '',
  security_policy: 'None',
  security_mode: 'None',
  username: '',
  password: '',
  enabled: true,
  client_certificate_id: null,
  platform: null,
  publish_interval_ms: null,
  data_category_id: null,
}

function CreateSourceDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const qc = useQueryClient()
  const [form, setForm] = useState<SourceFormState>(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)

  const certsQuery = useQuery({
    queryKey: ['client-certificates'],
    queryFn: async () => {
      const result = await clientCertsApi.list()
      if (!result.success) return [] as ClientCertificate[]
      return result.data
    },
    staleTime: 60_000,
  })

  const mutation = useMutation({
    mutationFn: (req: CreatePointSourceRequest) => pointSourcesApi.create(req),
    onSuccess: (result) => {
      if (!result.success) {
        setError(result.error.message)
        return
      }
      qc.invalidateQueries({ queryKey: ['point-sources'] })
      onOpenChange(false)
      setForm(EMPTY_FORM)
      setError(null)
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const req: CreatePointSourceRequest = {
      name: form.name,
      endpoint_url: form.endpoint_url,
      source_type: 'opc_ua',
      security_policy: form.security_policy || undefined,
      security_mode: form.security_mode || undefined,
      username: form.username || undefined,
      password: form.password || undefined,
      client_certificate_id: form.client_certificate_id,
      platform: form.platform,
      publish_interval_ms: form.publish_interval_ms,
    }
    mutation.mutate(req)
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <ModalContent title="Add OPC UA Source">
        {error && (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 'var(--io-radius)',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.25)',
              color: 'var(--io-danger)',
              fontSize: '13px',
              marginBottom: '16px',
            }}
          >
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <SourceFormFields
            form={form}
            onChange={(p) => setForm((f) => ({ ...f, ...p }))}
            clientCerts={certsQuery.data}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '24px' }}>
            <Dialog.Close asChild>
              <button type="button" style={btnSecondary}>
                Cancel
              </button>
            </Dialog.Close>
            <button type="submit" style={btnPrimary} disabled={mutation.isPending}>
              {mutation.isPending ? 'Adding…' : 'Add Source'}
            </button>
          </div>
        </form>
      </ModalContent>
    </Dialog.Root>
  )
}

// ---------------------------------------------------------------------------
// Edit dialog
// ---------------------------------------------------------------------------

function EditSourceDialog({
  source,
  open,
  onOpenChange,
}: {
  source: PointSource | null
  open: boolean
  onOpenChange: (v: boolean) => void
}) {
  const qc = useQueryClient()
  const [form, setForm] = useState<SourceFormState>({
    name: source?.name ?? '',
    endpoint_url: source?.endpoint_url ?? '',
    security_policy: source?.security_policy ?? 'None',
    security_mode: source?.security_mode ?? 'None',
    username: source?.username ?? '',
    password: '',
    enabled: source?.enabled ?? true,
    client_certificate_id: null,
    platform: null,
    publish_interval_ms: null,
    data_category_id: null,
  })
  const [error, setError] = useState<string | null>(null)
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'ok' | 'fail'>('idle')
  const [testMessage, setTestMessage] = useState<string>('')

  const certsQuery = useQuery({
    queryKey: ['client-certificates'],
    queryFn: async () => {
      const result = await clientCertsApi.list()
      if (!result.success) return [] as ClientCertificate[]
      return result.data
    },
    staleTime: 60_000,
  })

  React.useEffect(() => {
    if (source) {
      setForm({
        name: source.name,
        endpoint_url: source.endpoint_url,
        security_policy: source.security_policy ?? 'None',
        security_mode: source.security_mode ?? 'None',
        username: source.username ?? '',
        password: '',
        enabled: source.enabled,
        client_certificate_id: null,
        platform: null,
        publish_interval_ms: null,
        data_category_id: null,
      })
      setTestStatus('idle')
      setTestMessage('')
    }
  }, [source])

  const mutation = useMutation({
    mutationFn: (req: UpdatePointSourceRequest) => pointSourcesApi.update(source!.id, req),
    onSuccess: (result) => {
      if (!result.success) {
        setError(result.error.message)
        return
      }
      qc.invalidateQueries({ queryKey: ['point-sources'] })
      onOpenChange(false)
      setError(null)
    },
  })

  const testMutation = useMutation({
    mutationFn: () => pointSourcesApi.testConnection(source!.id),
    onSuccess: (result) => {
      if (!result.success) {
        setTestStatus('fail')
        setTestMessage(result.error.message)
        return
      }
      if (result.data.success) {
        setTestStatus('ok')
        setTestMessage(
          result.data.message +
            (result.data.latency_ms != null ? ` (${result.data.latency_ms}ms)` : ''),
        )
      } else {
        setTestStatus('fail')
        setTestMessage(result.data.message)
      }
    },
    onError: (e: Error) => {
      setTestStatus('fail')
      setTestMessage(e.message)
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const req: UpdatePointSourceRequest = {
      name: form.name,
      endpoint_url: form.endpoint_url,
      security_policy: form.security_policy,
      security_mode: form.security_mode,
      username: form.username || undefined,
      password: form.password || undefined,
      enabled: form.enabled,
      client_certificate_id: form.client_certificate_id,
      platform: form.platform,
      publish_interval_ms: form.publish_interval_ms,
    }
    mutation.mutate(req)
  }

  if (!source) return null

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <ModalContent title={`Edit: ${source.name}`}>
        {error && (
          <div
            style={{
              padding: '10px 12px',
              borderRadius: 'var(--io-radius)',
              background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.25)',
              color: 'var(--io-danger)',
              fontSize: '13px',
              marginBottom: '16px',
            }}
          >
            {error}
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <SourceFormFields
            form={form}
            onChange={(p) => setForm((f) => ({ ...f, ...p }))}
            showEnabled
            clientCerts={certsQuery.data}
          />
          {/* Test connection */}
          <div style={{ marginTop: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              type="button"
              style={btnSecondary}
              disabled={testMutation.isPending}
              onClick={() => {
                setTestStatus('testing')
                setTestMessage('')
                testMutation.mutate()
              }}
            >
              {testMutation.isPending ? 'Testing…' : 'Test Connection'}
            </button>
            {testStatus === 'ok' && (
              <span style={{ fontSize: '12px', color: 'var(--io-success)' }}>
                Connected — {testMessage}
              </span>
            )}
            {testStatus === 'fail' && (
              <span style={{ fontSize: '12px', color: 'var(--io-danger)' }}>
                Failed — {testMessage}
              </span>
            )}
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
// ---------------------------------------------------------------------------
// OPC Server Certificate tab
// ---------------------------------------------------------------------------

const CERT_STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  trusted:  { bg: 'rgba(34,197,94,0.12)',  text: '#22C55E', label: 'Trusted'  },
  pending:  { bg: 'rgba(234,179,8,0.12)',   text: '#EAB308', label: 'Pending'  },
  rejected: { bg: 'rgba(239,68,68,0.12)',   text: '#EF4444', label: 'Rejected' },
}

function CertStatusBadge({ status }: { status: string }) {
  const s = CERT_STATUS_COLORS[status] ?? CERT_STATUS_COLORS.pending
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 10px',
        borderRadius: 99,
        background: s.bg,
        color: s.text,
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {s.label}
    </span>
  )
}

function ServerCertCard({
  cert,
  onTrust,
  onReject,
  onDelete,
  loading,
}: {
  cert: OpcServerCert
  onTrust: () => void
  onReject: () => void
  onDelete: () => void
  loading: boolean
}) {
  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : '—'

  const btnStyle = (variant: 'primary' | 'danger' | 'ghost'): React.CSSProperties => ({
    padding: '5px 12px',
    borderRadius: 6,
    border: variant === 'ghost' ? '1px solid var(--io-border)' : 'none',
    background:
      variant === 'primary' ? 'var(--io-accent)' :
      variant === 'danger'  ? '#EF4444' : 'transparent',
    color:
      variant === 'ghost' ? 'var(--io-text-secondary)' : '#fff',
    fontSize: 12,
    fontWeight: 500,
    cursor: loading ? 'not-allowed' : 'pointer',
    opacity: loading ? 0.6 : 1,
  })

  return (
    <div
      style={{
        border: '1px solid var(--io-border)',
        borderRadius: 8,
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        background: 'var(--io-surface-secondary)',
      }}
    >
      {/* Header row: fingerprint + status badge */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, justifyContent: 'space-between' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: 'var(--io-text-muted)', marginBottom: 3 }}>SHA-256 Fingerprint</div>
          <div
            style={{
              fontFamily: 'monospace',
              fontSize: 11,
              color: 'var(--io-text-secondary)',
              wordBreak: 'break-all',
              lineHeight: 1.5,
            }}
          >
            {cert.fingerprint_display}
          </div>
        </div>
        <CertStatusBadge status={cert.status} />
      </div>

      {/* Cert fields */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
        {[
          { label: 'Subject', value: cert.subject },
          { label: 'Issuer',  value: cert.issuer  },
          { label: 'Valid From', value: formatDate(cert.not_before) },
          { label: 'Valid To',   value: formatDate(cert.not_after)  },
        ].map(({ label, value }) => (
          <div key={label}>
            <div style={{ fontSize: 11, color: 'var(--io-text-muted)', marginBottom: 2 }}>{label}</div>
            <div style={{ fontSize: 12, color: 'var(--io-text-primary)', fontFamily: label === 'Subject' || label === 'Issuer' ? 'monospace' : undefined }}>
              {value ?? '—'}
              {label === 'Valid To' && cert.expired && (
                <span style={{ marginLeft: 6, color: '#EF4444', fontSize: 11 }}>EXPIRED</span>
              )}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--io-text-muted)', marginBottom: 2 }}>First Seen</div>
          <div style={{ fontSize: 12, color: 'var(--io-text-secondary)' }}>{formatDate(cert.first_seen_at)}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--io-text-muted)', marginBottom: 2 }}>Last Seen</div>
          <div style={{ fontSize: 12, color: 'var(--io-text-secondary)' }}>{formatDate(cert.last_seen_at)}</div>
        </div>
      </div>

      {cert.auto_trusted && (
        <div
          style={{
            fontSize: 11,
            color: '#EAB308',
            background: 'rgba(234,179,8,0.08)',
            border: '1px solid rgba(234,179,8,0.25)',
            borderRadius: 6,
            padding: '6px 10px',
          }}
        >
          Auto-trusted — this certificate was accepted automatically because <strong>OPC Auto-Trust</strong> is
          enabled on this server. Disable it in Settings to require manual approval for new connections.
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8 }}>
        {cert.status !== 'trusted' && (
          <button style={btnStyle('primary')} onClick={onTrust} disabled={loading}>
            Trust
          </button>
        )}
        {cert.status !== 'rejected' && (
          <button style={btnStyle('danger')} onClick={onReject} disabled={loading}>
            Reject
          </button>
        )}
        <button style={btnStyle('ghost')} onClick={onDelete} disabled={loading}>
          Remove
        </button>
      </div>
    </div>
  )
}

function ServerCertTab({ sourceId }: { sourceId: string }) {
  const queryClient = useQueryClient()

  const { data: certs, isLoading } = useQuery({
    queryKey: ['opc-server-certs'],
    queryFn: async () => {
      const result = await opcCertsApi.list()
      if (!result.success) throw new Error(result.error.message)
      return result.data
    },
    staleTime: 15_000,
  })

  const sourceCerts = (certs ?? []).filter(
    (c) => c.source_id === sourceId || c.source_id === null,
  )

  const mutOpts = {
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['opc-server-certs'] }),
  }
  const trustMut   = useMutation({ mutationFn: (id: string) => opcCertsApi.trust(id),   ...mutOpts })
  const rejectMut  = useMutation({ mutationFn: (id: string) => opcCertsApi.reject(id),  ...mutOpts })
  const deleteMut  = useMutation({ mutationFn: (id: string) => opcCertsApi.delete(id),  ...mutOpts })

  const isBusy = trustMut.isPending || rejectMut.isPending || deleteMut.isPending

  if (isLoading) {
    return (
      <div style={{ color: 'var(--io-text-muted)', fontSize: 13 }}>Loading certificates…</div>
    )
  }

  if (sourceCerts.length === 0) {
    return (
      <div
        style={{
          textAlign: 'center',
          padding: '40px 0',
          color: 'var(--io-text-muted)',
          fontSize: 13,
        }}
      >
        <div style={{ marginBottom: 8, fontSize: 32 }}>🔒</div>
        <div style={{ fontWeight: 500, marginBottom: 6 }}>No server certificate on record</div>
        <div style={{ fontSize: 12, lineHeight: 1.6, maxWidth: 340, margin: '0 auto' }}>
          The OPC UA server certificate will appear here the first time this source connects.
          Once seen, you can approve or reject it.
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 12, color: 'var(--io-text-muted)', lineHeight: 1.6 }}>
        The certificate(s) below were presented by the OPC UA server during connection.
        Trust a certificate to allow connections; reject it to block them.
      </div>
      {sourceCerts.map((cert) => (
        <ServerCertCard
          key={cert.id}
          cert={cert}
          loading={isBusy}
          onTrust={()  => trustMut.mutate(cert.id)}
          onReject={() => rejectMut.mutate(cert.id)}
          onDelete={() => deleteMut.mutate(cert.id)}
        />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// History Recovery tab
// ---------------------------------------------------------------------------

const SHORTCUT_HOURS = [1, 4, 8, 24, 48, 72, 168] as const

function fmtDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function statusColor(status: RecoveryJob['status']): string {
  switch (status) {
    case 'complete': return 'var(--io-success)'
    case 'running':  return 'var(--io-accent)'
    case 'failed':   return 'var(--io-danger)'
    default:         return 'var(--io-text-muted)'
  }
}

function HistoryRecoveryTab({ sourceId }: { sourceId: string }) {
  const qc = useQueryClient()

  // Default: last 1 hour
  const now = new Date()
  const oneHourAgo = new Date(now.getTime() - 3600_000)
  const [fromValue, setFromValue] = useState(fmtDatetimeLocal(oneHourAgo))
  const [toValue, setToValue]     = useState(fmtDatetimeLocal(now))
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitOk, setSubmitOk]   = useState(false)

  const jobsQuery = useQuery({
    queryKey: ['history-recovery-jobs', sourceId],
    queryFn: async () => {
      const r = await historyRecoveryApi.listJobs(sourceId)
      if (!r.success) throw new Error(r.error.message)
      return r.data as RecoveryJob[]
    },
    refetchInterval: (query) => {
      const data = query.state.data
      if (!data) return 10_000
      const hasActive = data.some((j) => j.status === 'pending' || j.status === 'running')
      return hasActive ? 3_000 : 15_000
    },
  })

  const createMutation = useMutation({
    mutationFn: async () => {
      const from = new Date(fromValue).toISOString()
      const to   = new Date(toValue).toISOString()
      const r = await historyRecoveryApi.createJob(sourceId, from, to)
      if (!r.success) throw new Error(r.error.message)
      return r.data
    },
    onSuccess: () => {
      setSubmitOk(true)
      setSubmitError(null)
      setTimeout(() => setSubmitOk(false), 4000)
      qc.invalidateQueries({ queryKey: ['history-recovery-jobs', sourceId] })
    },
    onError: (e: Error) => {
      setSubmitError(e.message)
      setSubmitOk(false)
    },
  })

  function applyShortcut(hours: number) {
    const t = new Date()
    const f = new Date(t.getTime() - hours * 3600_000)
    setFromValue(fmtDatetimeLocal(f))
    setToValue(fmtDatetimeLocal(t))
  }

  const jobs = jobsQuery.data ?? []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Request form */}
      <div
        style={{
          background: 'var(--io-surface-secondary)',
          border: '1px solid var(--io-border-subtle)',
          borderRadius: 'var(--io-radius)',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--io-text-primary)' }}>
          Request Historical Data Recovery
        </div>

        {/* Quick shortcuts */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {SHORTCUT_HOURS.map((h) => (
            <button
              key={h}
              onClick={() => applyShortcut(h)}
              style={{
                padding: '4px 10px',
                fontSize: '12px',
                background: 'var(--io-surface-sunken)',
                border: '1px solid var(--io-border)',
                borderRadius: '4px',
                color: 'var(--io-text-secondary)',
                cursor: 'pointer',
              }}
            >
              {h < 24 ? `Last ${h}h` : `Last ${h / 24}d`}
            </button>
          ))}
        </div>

        {/* Date range */}
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '11px', color: 'var(--io-text-muted)', marginBottom: '4px' }}>
              From
            </div>
            <input
              type="datetime-local"
              value={fromValue}
              onChange={(e) => setFromValue(e.target.value)}
              style={{
                width: '100%',
                padding: '7px 9px',
                background: 'var(--io-surface-sunken)',
                border: '1px solid var(--io-border)',
                borderRadius: '4px',
                color: 'var(--io-text-primary)',
                fontSize: '13px',
              }}
            />
          </div>
          <div style={{ paddingTop: '18px', color: 'var(--io-text-muted)', fontSize: '12px' }}>→</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '11px', color: 'var(--io-text-muted)', marginBottom: '4px' }}>
              To
            </div>
            <input
              type="datetime-local"
              value={toValue}
              onChange={(e) => setToValue(e.target.value)}
              style={{
                width: '100%',
                padding: '7px 9px',
                background: 'var(--io-surface-sunken)',
                border: '1px solid var(--io-border)',
                borderRadius: '4px',
                color: 'var(--io-text-primary)',
                fontSize: '13px',
              }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending}
            style={{
              padding: '8px 16px',
              background: 'var(--io-accent)',
              border: 'none',
              borderRadius: '4px',
              color: '#fff',
              fontSize: '13px',
              fontWeight: 500,
              cursor: createMutation.isPending ? 'not-allowed' : 'pointer',
              opacity: createMutation.isPending ? 0.7 : 1,
            }}
          >
            {createMutation.isPending ? 'Submitting…' : 'Request Recovery'}
          </button>
          {submitOk && (
            <span style={{ fontSize: '12px', color: 'var(--io-success)' }}>
              Job queued — the OPC service will process it shortly.
            </span>
          )}
          {submitError && (
            <span style={{ fontSize: '12px', color: 'var(--io-danger)' }}>{submitError}</span>
          )}
        </div>
      </div>

      {/* Recent jobs */}
      <div>
        <div
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--io-text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom: '10px',
          }}
        >
          Recent Jobs
        </div>
        {jobs.length === 0 ? (
          <div
            style={{
              padding: '20px',
              textAlign: 'center',
              color: 'var(--io-text-muted)',
              fontSize: '13px',
              background: 'var(--io-surface-secondary)',
              border: '1px solid var(--io-border-subtle)',
              borderRadius: 'var(--io-radius)',
            }}
          >
            No recovery jobs yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {jobs.map((job) => (
              <div
                key={job.id}
                style={{
                  background: 'var(--io-surface-secondary)',
                  border: '1px solid var(--io-border-subtle)',
                  borderRadius: 'var(--io-radius)',
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '6px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: statusColor(job.status),
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                    }}
                  >
                    {job.status}
                  </span>
                  <span style={{ fontSize: '11px', color: 'var(--io-text-muted)' }}>
                    {new Date(job.created_at).toLocaleString()}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--io-text-secondary)', fontFamily: 'monospace' }}>
                  {new Date(job.from_time).toLocaleString()} → {new Date(job.to_time).toLocaleString()}
                </div>
                {job.status === 'complete' && (
                  <div style={{ fontSize: '12px', color: 'var(--io-success)' }}>
                    {job.points_recovered.toLocaleString()} points recovered
                  </div>
                )}
                {job.error_message && (
                  <div style={{ fontSize: '12px', color: 'var(--io-danger)', fontFamily: 'monospace' }}>
                    {job.error_message}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Detail panel (slide-over with tabs)
// ---------------------------------------------------------------------------

const TAB_TRIGGER: React.CSSProperties = {
  padding: '8px 14px',
  background: 'transparent',
  border: 'none',
  borderBottom: '2px solid transparent',
  color: 'var(--io-text-secondary)',
  fontSize: '13px',
  fontWeight: 500,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

const TAB_TRIGGER_ACTIVE: React.CSSProperties = {
  ...TAB_TRIGGER,
  borderBottomColor: 'var(--io-accent)',
  color: 'var(--io-text-primary)',
}

function SourceDetailPanel({
  source,
  open,
  onOpenChange,
  onEdit,
  onReconnect,
  reconnecting,
}: {
  source: PointSource | null
  open: boolean
  onOpenChange: (v: boolean) => void
  onEdit: () => void
  onReconnect: () => void
  reconnecting: boolean
}) {
  const [activeTab, setActiveTab] = useState('details')

  React.useEffect(() => {
    if (open) setActiveTab('details')
  }, [open, source?.id])

  if (!source) return null

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 100 }}
        />
        <Dialog.Content
          aria-describedby={undefined}
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            bottom: 0,
            width: '560px',
            maxWidth: '95vw',
            background: 'var(--io-surface-elevated)',
            borderLeft: '1px solid var(--io-border)',
            zIndex: 101,
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '-20px 0 60px rgba(0,0,0,0.3)',
          }}
        >
          {/* Panel header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '18px 20px 0',
              flexShrink: 0,
            }}
          >
            <div>
              <Dialog.Title
                style={{
                  margin: '0 0 2px',
                  fontSize: '16px',
                  fontWeight: 600,
                  color: 'var(--io-text-primary)',
                }}
              >
                {source.name}
              </Dialog.Title>
              <div style={{ fontSize: '12px', color: 'var(--io-text-muted)', fontFamily: 'monospace' }}>
                {source.endpoint_url}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {source.status !== 'active' && source.enabled && (
                <button
                  style={{
                    ...btnSecondary,
                    borderColor: 'var(--io-accent)',
                    color: 'var(--io-accent)',
                    opacity: reconnecting ? 0.6 : 1,
                    cursor: reconnecting ? 'not-allowed' : 'pointer',
                  }}
                  onClick={onReconnect}
                  disabled={reconnecting}
                  title="Trigger an immediate reconnect attempt"
                >
                  {reconnecting ? 'Reconnecting…' : 'Reconnect'}
                </button>
              )}
              <button style={btnPrimary} onClick={onEdit}>
                Edit
              </button>
              <Dialog.Close asChild>
                <button
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--io-text-muted)',
                    cursor: 'pointer',
                    fontSize: '18px',
                    lineHeight: 1,
                    padding: '4px',
                  }}
                >
                  &#x2715;
                </button>
              </Dialog.Close>
            </div>
          </div>

          {/* Tabs */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            {/* Tab list */}
            <div
              style={{
                display: 'flex',
                borderBottom: '1px solid var(--io-border)',
                padding: '0 20px',
                marginTop: '12px',
                flexShrink: 0,
              }}
            >
              <button
                style={activeTab === 'details' ? TAB_TRIGGER_ACTIVE : TAB_TRIGGER}
                onClick={() => setActiveTab('details')}
              >
                Connection Details
              </button>
              <button
                style={activeTab === 'supplemental' ? TAB_TRIGGER_ACTIVE : TAB_TRIGGER}
                onClick={() => setActiveTab('supplemental')}
              >
                Supplemental Point Data
              </button>
              <button
                style={activeTab === 'server-cert' ? TAB_TRIGGER_ACTIVE : TAB_TRIGGER}
                onClick={() => setActiveTab('server-cert')}
              >
                Server Certificate
              </button>
              <button
                style={activeTab === 'history-recovery' ? TAB_TRIGGER_ACTIVE : TAB_TRIGGER}
                onClick={() => setActiveTab('history-recovery')}
              >
                History Recovery
              </button>
            </div>

            {/* Details tab content */}
            {activeTab === 'details' && (
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                <SourceStatsTiles sourceId={source.id} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <DetailRow label="Status">
                    <StatusBadge status={source.status} />
                  </DetailRow>
                  <DetailRow label="Source Type">
                    <span style={{ fontSize: '13px', color: 'var(--io-text-primary)' }}>
                      {source.source_type}
                    </span>
                  </DetailRow>
                  <DetailRow label="Security Policy">
                    <span style={{ fontSize: '13px', color: 'var(--io-text-primary)' }}>
                      {source.security_policy || '—'}
                    </span>
                  </DetailRow>
                  <DetailRow label="Security Mode">
                    <span style={{ fontSize: '13px', color: 'var(--io-text-primary)' }}>
                      {source.security_mode || '—'}
                    </span>
                  </DetailRow>
                  <DetailRow label="Username">
                    <span style={{ fontSize: '13px', color: 'var(--io-text-primary)' }}>
                      {source.username || '—'}
                    </span>
                  </DetailRow>
                  <DetailRow label="Enabled">
                    <span style={{ fontSize: '13px', color: 'var(--io-text-primary)' }}>
                      {source.enabled ? 'Yes' : 'No'}
                    </span>
                  </DetailRow>
                  <DetailRow label="Last Connected">
                    <span style={{ fontSize: '13px', color: 'var(--io-text-primary)' }}>
                      {source.last_connected_at
                        ? new Date(source.last_connected_at).toLocaleString()
                        : '—'}
                    </span>
                  </DetailRow>
                  {source.last_error_message && (
                    <DetailRow label="Last Error">
                      <span
                        style={{
                          fontSize: '12px',
                          color: 'var(--io-danger)',
                          fontFamily: 'monospace',
                          wordBreak: 'break-word',
                          lineHeight: 1.5,
                        }}
                      >
                        {source.last_error_message}
                        {source.last_error_at && (
                          <span style={{ color: 'var(--io-text-muted)', fontFamily: 'inherit', marginLeft: 8 }}>
                            ({new Date(source.last_error_at).toLocaleString()})
                          </span>
                        )}
                      </span>
                    </DetailRow>
                  )}
                  <DetailRow label="Created">
                    <span style={{ fontSize: '13px', color: 'var(--io-text-primary)' }}>
                      {new Date(source.created_at).toLocaleString()}
                    </span>
                  </DetailRow>
                </div>
              </div>
            )}

            {/* Supplemental Point Data tab content */}
            {activeTab === 'supplemental' && (
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                <SupplementalConnectorsTab
                  pointSourceId={source.id}
                  pointSourceName={source.name}
                />
              </div>
            )}

            {/* Server Certificate tab content */}
            {activeTab === 'server-cert' && (
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                <ServerCertTab sourceId={source.id} />
              </div>
            )}

            {/* History Recovery tab content */}
            {activeTab === 'history-recovery' && (
              <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
                <HistoryRecoveryTab sourceId={source.id} />
              </div>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

function DetailRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '10px 12px',
        background: 'var(--io-surface-secondary)',
        borderRadius: 'var(--io-radius)',
        border: '1px solid var(--io-border-subtle)',
      }}
    >
      <span
        style={{
          fontSize: '12px',
          fontWeight: 500,
          color: 'var(--io-text-muted)',
          width: '120px',
          flexShrink: 0,
        }}
      >
        {label}
      </span>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Global minimum publish interval control
// ---------------------------------------------------------------------------

const MIN_INTERVAL_FLOOR = 100
const MIN_INTERVAL_KEY = 'opc.minimum_publish_interval_ms'
const MIN_INTERVAL_DEFAULT = 1000

function MinPublishIntervalControl() {
  const qc = useQueryClient()
  const [localValue, setLocalValue] = useState<string>('')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved' | 'error'>('idle')
  const [saveError, setSaveError] = useState<string>('')

  const settingQuery = useQuery({
    queryKey: ['setting', MIN_INTERVAL_KEY],
    queryFn: async () => {
      const result = await settingsApi.list()
      if (!result.success) return MIN_INTERVAL_DEFAULT
      const setting = (result.data as import('../../api/settings').Setting[]).find(
        (s) => s.key === MIN_INTERVAL_KEY,
      )
      return setting ? (setting.value as number) : MIN_INTERVAL_DEFAULT
    },
    staleTime: 30_000,
  })

  React.useEffect(() => {
    if (settingQuery.data != null) {
      setLocalValue(String(settingQuery.data))
    }
  }, [settingQuery.data])

  const saveMutation = useMutation({
    mutationFn: (val: number) => settingsApi.update(MIN_INTERVAL_KEY, val),
    onSuccess: (result) => {
      if (!result.success) {
        setSaveStatus('error')
        setSaveError(result.error.message)
        return
      }
      setSaveStatus('saved')
      setSaveError('')
      qc.invalidateQueries({ queryKey: ['setting', MIN_INTERVAL_KEY] })
      setTimeout(() => setSaveStatus('idle'), 3000)
    },
    onError: (e: Error) => {
      setSaveStatus('error')
      setSaveError(e.message)
    },
  })

  function handleSave() {
    const parsed = parseInt(localValue, 10)
    if (isNaN(parsed) || parsed < MIN_INTERVAL_FLOOR) {
      setSaveStatus('error')
      setSaveError(`Minimum allowed value is ${MIN_INTERVAL_FLOOR}ms`)
      return
    }
    setSaveStatus('idle')
    setSaveError('')
    saveMutation.mutate(parsed)
  }

  return (
    <div
      style={{
        background: 'var(--io-surface-secondary)',
        border: '1px solid var(--io-border)',
        borderRadius: '8px',
        padding: '16px 20px',
        marginBottom: '20px',
      }}
    >
      <div
        style={{
          fontSize: '13px',
          fontWeight: 600,
          color: 'var(--io-text-primary)',
          marginBottom: '4px',
        }}
      >
        Global Minimum Publish Interval
      </div>
      <div style={{ fontSize: '12px', color: 'var(--io-text-muted)', marginBottom: '12px' }}>
        No OPC source can be configured below this floor. Protects DCS/historian systems from
        aggressive polling. Default: {MIN_INTERVAL_DEFAULT}ms. Minimum allowed: {MIN_INTERVAL_FLOOR}ms.
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <input
          type="number"
          min={MIN_INTERVAL_FLOOR}
          step={100}
          style={{ ...inputStyle, width: '140px' }}
          value={localValue}
          onChange={(e) => {
            setLocalValue(e.target.value)
            setSaveStatus('idle')
          }}
          placeholder={String(MIN_INTERVAL_DEFAULT)}
        />
        <span style={{ fontSize: '12px', color: 'var(--io-text-muted)' }}>ms</span>
        <button
          style={btnPrimary}
          type="button"
          onClick={handleSave}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? 'Saving…' : 'Save'}
        </button>
        {saveStatus === 'saved' && (
          <span style={{ fontSize: '12px', color: 'var(--io-success)' }}>Saved</span>
        )}
        {saveStatus === 'error' && (
          <span style={{ fontSize: '12px', color: 'var(--io-danger)' }}>{saveError}</span>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function OpcSourcesPage() {
  const qc = useQueryClient()
  const [createOpen, setCreateOpen] = useState(false)
  const [editSource, setEditSource] = useState<PointSource | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [detailSource, setDetailSource] = useState<PointSource | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ source: PointSource; pos: ContextMenuPos } | null>(null)

  const sourcesQuery = useQuery({
    queryKey: ['point-sources'],
    queryFn: async () => {
      const result = await pointSourcesApi.list()
      if (!result.success) throw new Error(result.error.message)
      return result.data.data as PointSource[]
    },
    // Poll faster when any source is in a transitional/error state
    refetchInterval: (query) => {
      const data = query.state.data
      if (!data) return 5_000
      const hasActive = data.some((s) => s.status === 'connecting' || s.status === 'error')
      return hasActive ? 3_000 : 8_000
    },
  })

  const statsQuery = useQuery({
    queryKey: ['point-sources-stats'],
    queryFn: async () => {
      const r = await pointSourceStatsApi.listAll()
      if (!r.success) return [] as PointSourceStats[]
      return r.data.data
    },
    refetchInterval: 30_000,
  })

  const statsById = React.useMemo(() => {
    const m = new Map<string, PointSourceStats>()
    for (const s of statsQuery.data ?? []) m.set(s.source_id, s)
    return m
  }, [statsQuery.data])

  const deleteMutation = useMutation({
    mutationFn: (id: string) => pointSourcesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['point-sources'] }),
  })

  const reconnectMutation = useMutation({
    mutationFn: (id: string) => pointSourcesApi.reconnect(id),
    onSuccess: () => {
      // Refresh immediately after reconnect trigger
      setTimeout(() => qc.invalidateQueries({ queryKey: ['point-sources'] }), 500)
    },
  })

  const toggleEnabledMutation = useMutation({
    mutationFn: (src: PointSource) =>
      pointSourcesApi.update(src.id, { enabled: !src.enabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['point-sources'] }),
  })

  function handleContextMenu(e: React.MouseEvent, src: PointSource) {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ source: src, pos: { x: e.clientX, y: e.clientY } })
  }

  async function handleTestConnection(src: PointSource) {
    try {
      await pointSourcesApi.testConnection(src.id)
    } finally {
      qc.invalidateQueries({ queryKey: ['point-sources'] })
    }
  }

  const sources = sourcesQuery.data ?? []

  return (
    <div>
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
            OPC UA Sources
          </h2>
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--io-text-muted)' }}>
            Configure connections to OPC UA servers
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <ExportButton
            module="settings"
            entity="opc-sources"
            filteredRowCount={sources.length}
            totalRowCount={sources.length}
            availableColumns={OPC_SOURCES_COLUMNS}
            visibleColumns={OPC_SOURCES_DEFAULT_VISIBLE}
          />
          <button style={btnPrimary} onClick={() => setCreateOpen(true)}>
            + Add Source
          </button>
        </div>
      </div>

      <MinPublishIntervalControl />

      <div
        style={{
          background: 'var(--io-surface-secondary)',
          border: '1px solid var(--io-border)',
          borderRadius: '8px',
          overflow: 'hidden',
        }}
      >
        {sourcesQuery.isLoading && <TableSkeleton rows={4} columns={5} />}
        {!sourcesQuery.isLoading && sources.length === 0 && (
          <div
            style={{ padding: '48px', textAlign: 'center', color: 'var(--io-text-muted)', fontSize: '14px' }}
          >
            <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚙</div>
            <p style={{ margin: '0 0 4px', color: 'var(--io-text-secondary)', fontWeight: 500 }}>
              No OPC UA sources configured
            </p>
            <p style={{ margin: 0 }}>Add a source to start receiving real-time data.</p>
          </div>
        )}
        {sources.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr
                style={{
                  borderBottom: '1px solid var(--io-border)',
                  background: 'var(--io-surface-primary)',
                }}
              >
                {['Name', 'Endpoint', 'Status', 'Last Connected', ''].map((col) => (
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
              {sources.map((src, i) => (
                <tr
                  key={src.id}
                  style={{
                    borderBottom: i < sources.length - 1 ? '1px solid var(--io-border-subtle)' : undefined,
                    cursor: 'pointer',
                  }}
                  onContextMenu={(e) => handleContextMenu(e, src)}
                  onClick={() => {
                    setDetailSource(src)
                    setDetailOpen(true)
                  }}
                >
                  <td style={cellStyle}>
                    <div style={{ fontWeight: 500, color: 'var(--io-text-primary)' }}>
                      {src.name}
                    </div>
                    {!src.enabled && (
                      <div style={{ fontSize: '11px', color: 'var(--io-text-muted)', marginTop: '2px' }}>
                        disabled
                      </div>
                    )}
                    <SourceStatsChips stats={statsById.get(src.id)} />
                  </td>
                  <td style={cellStyle}>
                    <span
                      style={{
                        fontFamily: 'monospace',
                        fontSize: '12px',
                        color: 'var(--io-text-muted)',
                      }}
                    >
                      {src.endpoint_url}
                    </span>
                  </td>
                  <td style={cellStyle}>
                    <StatusBadge status={src.status} />
                    {src.last_error_message && src.status !== 'active' && (
                      <div
                        style={{
                          fontSize: '11px',
                          color: 'var(--io-danger)',
                          marginTop: '4px',
                          maxWidth: '220px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={src.last_error_message}
                      >
                        {src.last_error_message}
                      </div>
                    )}
                  </td>
                  <td style={{ ...cellStyle, fontSize: '12px', color: 'var(--io-text-muted)' }}>
                    {src.last_connected_at
                      ? new Date(src.last_connected_at).toLocaleString()
                      : '—'}
                  </td>
                  <td
                    style={cellStyle}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                      {src.status !== 'active' && src.enabled && (
                        <button
                          style={{
                            padding: '4px 10px',
                            background: 'transparent',
                            border: '1px solid var(--io-accent)',
                            borderRadius: 'var(--io-radius)',
                            color: 'var(--io-accent)',
                            fontSize: '12px',
                            cursor: reconnectMutation.isPending ? 'not-allowed' : 'pointer',
                            opacity: reconnectMutation.isPending ? 0.6 : 1,
                          }}
                          onClick={() => reconnectMutation.mutate(src.id)}
                          disabled={reconnectMutation.isPending}
                          title="Trigger an immediate reconnect attempt"
                        >
                          Reconnect
                        </button>
                      )}
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
                        onClick={() => {
                          setEditSource(src)
                          setEditOpen(true)
                        }}
                      >
                        Edit
                      </button>
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
                        onClick={() => {
                          if (confirm(`Delete "${src.name}"?`)) {
                            deleteMutation.mutate(src.id)
                          }
                        }}
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

      <CreateSourceDialog open={createOpen} onOpenChange={setCreateOpen} />
      <EditSourceDialog source={editSource} open={editOpen} onOpenChange={setEditOpen} />
      <SourceDetailPanel
        source={detailSource}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onEdit={() => {
          setDetailOpen(false)
          setEditSource(detailSource)
          setEditOpen(true)
        }}
        onReconnect={() => detailSource && reconnectMutation.mutate(detailSource.id)}
        reconnecting={reconnectMutation.isPending}
      />

      {contextMenu && (
        <OpcSourceContextMenu
          source={contextMenu.source}
          pos={contextMenu.pos}
          onClose={() => setContextMenu(null)}
          onEdit={(s) => { setEditSource(s); setEditOpen(true) }}
          onToggleEnabled={(s) => { toggleEnabledMutation.mutate(s) }}
          onTestConnection={(s) => { handleTestConnection(s) }}
          onDelete={(s) => { if (confirm(`Delete "${s.name}"?`)) deleteMutation.mutate(s.id) }}
        />
      )}
    </div>
  )
}

