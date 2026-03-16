import { useState, useRef, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  bulkUpdateApi,
  snapshotsApi,
  TARGET_TYPE_LABELS,
  type TargetType,
  type DiffPreview,
  type ApplySummary,
  type Snapshot,
  type SnapshotDetail,
  type ModifiedRow,
} from '../../api/bulkUpdate'
import { showToast } from '../../shared/components/Toast'

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------

const CARD: React.CSSProperties = {
  background: 'var(--io-surface-secondary)',
  border: '1px solid var(--io-border)',
  borderRadius: '8px',
  padding: 'var(--io-space-5)',
  marginBottom: 'var(--io-space-4)',
}

const BTN_PRIMARY: React.CSSProperties = {
  padding: '6px 16px',
  borderRadius: '6px',
  border: 'none',
  background: 'var(--io-accent)',
  color: '#fff',
  fontWeight: 600,
  fontSize: '13px',
  cursor: 'pointer',
}

const BTN_SECONDARY: React.CSSProperties = {
  padding: '6px 16px',
  borderRadius: '6px',
  border: '1px solid var(--io-border)',
  background: 'var(--io-surface-tertiary)',
  color: 'var(--io-text-primary)',
  fontWeight: 500,
  fontSize: '13px',
  cursor: 'pointer',
}

const BTN_DANGER: React.CSSProperties = {
  ...BTN_SECONDARY,
  color: 'var(--io-danger)',
  borderColor: 'var(--io-danger)',
}

const SELECT: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: '6px',
  border: '1px solid var(--io-border)',
  background: 'var(--io-surface-tertiary)',
  color: 'var(--io-text-primary)',
  fontSize: '13px',
  cursor: 'pointer',
  minWidth: '200px',
}

const INPUT: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: '6px',
  border: '1px solid var(--io-border)',
  background: 'var(--io-surface-tertiary)',
  color: 'var(--io-text-primary)',
  fontSize: '13px',
  width: '280px',
}

const TABLE: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse' as const,
  fontSize: '12px',
}

const TH: React.CSSProperties = {
  textAlign: 'left' as const,
  padding: '6px 10px',
  borderBottom: '1px solid var(--io-border)',
  color: 'var(--io-text-muted)',
  fontWeight: 600,
  background: 'var(--io-surface-tertiary)',
}

const TD: React.CSSProperties = {
  padding: '6px 10px',
  borderBottom: '1px solid var(--io-border)',
  color: 'var(--io-text-primary)',
  verticalAlign: 'top' as const,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function Badge({
  children,
  color,
}: {
  children: React.ReactNode
  color: 'success' | 'warning' | 'danger' | 'accent' | 'muted'
}) {
  const colors = {
    success: { bg: 'var(--io-success-subtle)', fg: 'var(--io-success)' },
    warning: { bg: 'var(--io-warning-subtle)', fg: 'var(--io-warning)' },
    danger: { bg: 'var(--io-danger-subtle)', fg: 'var(--io-danger)' },
    accent: { bg: 'var(--io-accent-subtle)', fg: 'var(--io-accent)' },
    muted: { bg: 'var(--io-surface-tertiary)', fg: 'var(--io-text-muted)' },
  }
  const c = colors[color]
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: '999px',
        fontSize: '11px',
        fontWeight: 600,
        background: c.bg,
        color: c.fg,
      }}
    >
      {children}
    </span>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3
      style={{
        margin: '0 0 var(--io-space-3)',
        fontSize: '13px',
        fontWeight: 600,
        color: 'var(--io-text-secondary)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}
    >
      {children}
    </h3>
  )
}

function ConfirmDialog({
  message,
  onConfirm,
  onCancel,
}: {
  message: string
  onConfirm: () => void
  onCancel: () => void
}) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
    >
      <div
        style={{
          background: 'var(--io-surface-primary)',
          border: '1px solid var(--io-border)',
          borderRadius: '10px',
          padding: 'var(--io-space-6)',
          maxWidth: 480,
          width: '90%',
        }}
      >
        <p style={{ margin: '0 0 var(--io-space-5)', color: 'var(--io-text-primary)', fontSize: '14px' }}>
          {message}
        </p>
        <div style={{ display: 'flex', gap: 'var(--io-space-3)', justifyContent: 'flex-end' }}>
          <button style={BTN_SECONDARY} onClick={onCancel}>
            Cancel
          </button>
          <button style={{ ...BTN_PRIMARY, background: 'var(--io-danger)' }} onClick={onConfirm}>
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab: Bulk Update
// ---------------------------------------------------------------------------

function DiffSection({ title, color, rows }: { title: string; color: 'success' | 'warning' | 'danger'; rows: Record<string, unknown>[] }) {
  if (rows.length === 0) return null
  const keys = Object.keys(rows[0])
  return (
    <div style={{ marginBottom: 'var(--io-space-4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--io-space-2)', marginBottom: 'var(--io-space-2)' }}>
        <Badge color={color}>{title}</Badge>
        <span style={{ color: 'var(--io-text-muted)', fontSize: '12px' }}>{rows.length} row{rows.length !== 1 ? 's' : ''}</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={TABLE}>
          <thead>
            <tr>
              {keys.map((k) => (
                <th key={k} style={TH}>{k}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {keys.map((k) => (
                  <td key={k} style={TD}>{String(row[k] ?? '')}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function ModifiedSection({ rows }: { rows: ModifiedRow[] }) {
  if (rows.length === 0) return null
  return (
    <div style={{ marginBottom: 'var(--io-space-4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--io-space-2)', marginBottom: 'var(--io-space-2)' }}>
        <Badge color="warning">Modified</Badge>
        <span style={{ color: 'var(--io-text-muted)', fontSize: '12px' }}>{rows.length} row{rows.length !== 1 ? 's' : ''}</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={TABLE}>
          <thead>
            <tr>
              <th style={TH}>ID</th>
              <th style={TH}>Changed Fields</th>
              <th style={TH}>Before</th>
              <th style={TH}>After</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td style={{ ...TD, fontFamily: 'monospace', fontSize: '11px' }}>{row.id}</td>
                <td style={TD}>
                  {row.changed_fields.map((f) => (
                    <Badge key={f} color="accent">{f}</Badge>
                  ))}
                </td>
                <td style={{ ...TD, fontFamily: 'monospace', fontSize: '11px', color: 'var(--io-danger)' }}>
                  {row.changed_fields.map((f) => (
                    <div key={f}>{f}: {String(row.before[f] ?? '')}</div>
                  ))}
                </td>
                <td style={{ ...TD, fontFamily: 'monospace', fontSize: '11px', color: 'var(--io-success)' }}>
                  {row.changed_fields.map((f) => (
                    <div key={f}>{f}: {String(row.after[f] ?? '')}</div>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function BulkUpdateTab() {
  const [targetType, setTargetType] = useState<TargetType>('users')
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [preview, setPreview] = useState<DiffPreview | null>(null)
  const [applyResult, setApplyResult] = useState<ApplySummary | null>(null)
  const [showApplyConfirm, setShowApplyConfirm] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const previewMutation = useMutation({
    mutationFn: ({ type, f }: { type: TargetType; f: File }) =>
      bulkUpdateApi.preview(type, f),
    onSuccess: (res) => {
      if (res.success) {
        setPreview(res.data)
        setApplyResult(null)
      } else {
        showToast({ title: 'Preview failed', description: res.error.message, variant: 'error' })
      }
    },
    onError: () => {
      showToast({ title: 'Preview failed', description: 'Network error', variant: 'error' })
    },
  })

  const applyMutation = useMutation({
    mutationFn: ({ type, f }: { type: TargetType; f: File }) =>
      bulkUpdateApi.apply(type, f),
    onSuccess: (res) => {
      if (res.success) {
        setApplyResult(res.data)
        setPreview(null)
        showToast({ title: 'Bulk update applied', description: `Modified: ${res.data.modified}, Unchanged: ${res.data.unchanged}`, variant: 'success' })
      } else {
        showToast({ title: 'Apply failed', description: res.error.message, variant: 'error' })
      }
    },
    onError: () => {
      showToast({ title: 'Apply failed', description: 'Network error', variant: 'error' })
    },
  })

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) {
      setFile(dropped)
      setPreview(null)
      setApplyResult(null)
    }
  }, [])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) {
      setFile(f)
      setPreview(null)
      setApplyResult(null)
    }
  }

  const handleDownloadTemplate = async () => {
    try {
      await bulkUpdateApi.downloadTemplate(targetType)
    } catch (e) {
      showToast({ title: 'Download failed', description: String(e), variant: 'error' })
    }
  }

  const handlePreview = () => {
    if (!file) return
    setApplyResult(null)
    previewMutation.mutate({ type: targetType, f: file })
  }

  const handleApply = () => {
    if (!file || !preview) return
    setShowApplyConfirm(true)
  }

  const confirmApply = () => {
    setShowApplyConfirm(false)
    if (!file) return
    applyMutation.mutate({ type: targetType, f: file })
  }

  const hasChanges =
    preview && (preview.added.length > 0 || preview.modified.length > 0 || preview.removed.length > 0)

  return (
    <div>
      {showApplyConfirm && (
        <ConfirmDialog
          message={`This will apply ${preview?.modified.length ?? 0} modification(s) to ${TARGET_TYPE_LABELS[targetType]}. A safety snapshot will be created first. Continue?`}
          onConfirm={confirmApply}
          onCancel={() => setShowApplyConfirm(false)}
        />
      )}

      <div style={CARD}>
        <SectionTitle>Step 1 — Choose Target &amp; Download Template</SectionTitle>
        <div style={{ display: 'flex', gap: 'var(--io-space-3)', flexWrap: 'wrap', alignItems: 'center' }}>
          <select
            style={SELECT}
            value={targetType}
            onChange={(e) => {
              setTargetType(e.target.value as TargetType)
              setFile(null)
              setPreview(null)
              setApplyResult(null)
            }}
          >
            {(Object.entries(TARGET_TYPE_LABELS) as [TargetType, string][]).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <button style={BTN_SECONDARY} onClick={handleDownloadTemplate}>
            Download Template (CSV)
          </button>
        </div>
      </div>

      <div style={CARD}>
        <SectionTitle>Step 2 — Upload Modified CSV</SectionTitle>
        <div
          style={{
            border: `2px dashed ${isDragging ? 'var(--io-accent)' : 'var(--io-border)'}`,
            borderRadius: '8px',
            padding: 'var(--io-space-6)',
            textAlign: 'center',
            cursor: 'pointer',
            background: isDragging ? 'var(--io-accent-subtle)' : 'var(--io-surface-tertiary)',
            transition: 'border-color 0.15s, background 0.15s',
          }}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: 'none' }}
            onChange={handleFileChange}
          />
          {file ? (
            <span style={{ color: 'var(--io-text-primary)', fontWeight: 500, fontSize: '13px' }}>
              {file.name} ({(file.size / 1024).toFixed(1)} KB)
            </span>
          ) : (
            <span style={{ color: 'var(--io-text-muted)', fontSize: '13px' }}>
              Drag and drop a CSV file here, or click to browse
            </span>
          )}
        </div>
        {file && (
          <div style={{ display: 'flex', gap: 'var(--io-space-3)', marginTop: 'var(--io-space-3)' }}>
            <button
              style={BTN_PRIMARY}
              onClick={handlePreview}
              disabled={previewMutation.isPending}
            >
              {previewMutation.isPending ? 'Previewing…' : 'Preview Changes'}
            </button>
            <button
              style={{ ...BTN_PRIMARY, background: 'var(--io-success)', opacity: !preview || !hasChanges ? 0.5 : 1 }}
              onClick={handleApply}
              disabled={!preview || !hasChanges || applyMutation.isPending}
            >
              {applyMutation.isPending ? 'Applying…' : 'Apply Changes'}
            </button>
          </div>
        )}
      </div>

      {preview && (
        <div style={CARD}>
          <SectionTitle>Step 3 — Review Changes</SectionTitle>
          <div style={{ display: 'flex', gap: 'var(--io-space-3)', marginBottom: 'var(--io-space-4)', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', color: 'var(--io-text-secondary)' }}>
              Added: <strong>{preview.added.length}</strong>
            </span>
            <span style={{ fontSize: '13px', color: 'var(--io-text-secondary)' }}>
              Modified: <strong>{preview.modified.length}</strong>
            </span>
            <span style={{ fontSize: '13px', color: 'var(--io-text-secondary)' }}>
              Removed: <strong>{preview.removed.length}</strong>
            </span>
            <span style={{ fontSize: '13px', color: 'var(--io-text-muted)' }}>
              Unchanged: {preview.unchanged_count}
            </span>
          </div>
          {!hasChanges && (
            <p style={{ color: 'var(--io-text-muted)', fontSize: '13px' }}>
              No changes detected — the uploaded CSV matches current data.
            </p>
          )}
          <DiffSection title="Added" color="success" rows={preview.added} />
          <ModifiedSection rows={preview.modified} />
          <DiffSection title="Removed" color="danger" rows={preview.removed} />
        </div>
      )}

      {applyResult && (
        <div style={{ ...CARD, borderColor: 'var(--io-success)' }}>
          <SectionTitle>Result</SectionTitle>
          <div style={{ display: 'flex', gap: 'var(--io-space-5)', flexWrap: 'wrap' }}>
            <div style={{ fontSize: '13px', color: 'var(--io-text-secondary)' }}>
              Modified: <strong style={{ color: 'var(--io-success)' }}>{applyResult.modified}</strong>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--io-text-secondary)' }}>
              Unchanged: <strong>{applyResult.unchanged}</strong>
            </div>
            <div style={{ fontSize: '13px', color: 'var(--io-text-muted)' }}>
              Safety snapshot: <span style={{ fontFamily: 'monospace', fontSize: '11px' }}>{applyResult.snapshot_id}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab: Snapshots
// ---------------------------------------------------------------------------

function SnapshotDataTable({ data }: { data: Record<string, unknown>[] }) {
  if (!data || data.length === 0) return <p style={{ color: 'var(--io-text-muted)', fontSize: '12px' }}>No data.</p>
  const keys = Object.keys(data[0])
  return (
    <div style={{ overflowX: 'auto', marginTop: 'var(--io-space-3)' }}>
      <table style={{ ...TABLE, fontSize: '11px' }}>
        <thead>
          <tr>{keys.map((k) => <th key={k} style={TH}>{k}</th>)}</tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr key={i}>
              {keys.map((k) => (
                <td key={k} style={{ ...TD, fontFamily: 'monospace' }}>{String(row[k] ?? '')}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function SnapshotsTab() {
  const qc = useQueryClient()
  const [expanded, setExpanded] = useState<string | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createType, setCreateType] = useState<TargetType>('users')
  const [createLabel, setCreateLabel] = useState('')
  const [restoreId, setRestoreId] = useState<string | null>(null)
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [page, setPage] = useState(1)

  const { data: listData, isLoading } = useQuery({
    queryKey: ['snapshots', page],
    queryFn: async () => {
      const token = localStorage.getItem('io_access_token')
      const res = await fetch(`/api/snapshots?page=${page}&limit=20`, {
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        credentials: 'include',
      })
      if (!res.ok) throw new Error('Failed to load snapshots')
      const json = await res.json() as { success: boolean; data: Snapshot[]; pagination?: { pages: number; page: number } }
      if (!json.success) throw new Error('Failed to load snapshots')
      return { data: json.data ?? [], pagination: json.pagination ?? null }
    },
  })

  const { data: detailResult } = useQuery({
    queryKey: ['snapshot-detail', expanded],
    queryFn: () => snapshotsApi.get(expanded!),
    enabled: !!expanded,
  })

  const createMutation = useMutation({
    mutationFn: () => snapshotsApi.create({ target_type: createType, label: createLabel || undefined }),
    onSuccess: (res) => {
      if (res.success) {
        qc.invalidateQueries({ queryKey: ['snapshots'] })
        setShowCreateForm(false)
        setCreateLabel('')
        showToast({ title: 'Snapshot created', variant: 'success' })
      } else {
        showToast({ title: 'Failed to create snapshot', description: res.error.message, variant: 'error' })
      }
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => snapshotsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['snapshots'] })
      setDeleteId(null)
      showToast({ title: 'Snapshot deleted', variant: 'success' })
    },
  })

  const restoreMutation = useMutation({
    mutationFn: (id: string) => snapshotsApi.restore(id),
    onSuccess: (res) => {
      if (res.success) {
        setRestoreId(null)
        showToast({
          title: 'Snapshot restored',
          description: `${res.data.rows_restored} rows restored. Safety snapshot: ${res.data.safety_snapshot_id.slice(0, 8)}…`,
          variant: 'success',
        })
      } else {
        showToast({ title: 'Restore failed', description: res.error.message, variant: 'error' })
      }
    },
  })

  const snapshots = (listData?.data ?? []) as Snapshot[]
  const pagination = listData?.pagination ?? null
  const detail = detailResult?.success ? (detailResult.data as SnapshotDetail) : null

  return (
    <div>
      {deleteId && (
        <ConfirmDialog
          message="Delete this snapshot? This cannot be undone."
          onConfirm={() => deleteMutation.mutate(deleteId)}
          onCancel={() => setDeleteId(null)}
        />
      )}
      {restoreId && (
        <ConfirmDialog
          message="This will overwrite current data with the snapshot values. A safety snapshot of the current state will be created first. Continue?"
          onConfirm={() => restoreMutation.mutate(restoreId)}
          onCancel={() => setRestoreId(null)}
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--io-space-4)' }}>
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: 'var(--io-text-primary)' }}>
          Saved Snapshots
        </h3>
        <button style={BTN_PRIMARY} onClick={() => setShowCreateForm((v) => !v)}>
          {showCreateForm ? 'Cancel' : '+ Create Snapshot'}
        </button>
      </div>

      {showCreateForm && (
        <div style={{ ...CARD, borderColor: 'var(--io-accent)' }}>
          <SectionTitle>New Snapshot</SectionTitle>
          <div style={{ display: 'flex', gap: 'var(--io-space-3)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--io-text-muted)', marginBottom: 4 }}>Target Type</label>
              <select style={SELECT} value={createType} onChange={(e) => setCreateType(e.target.value as TargetType)}>
                {(Object.entries(TARGET_TYPE_LABELS) as [TargetType, string][]).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: 'var(--io-text-muted)', marginBottom: 4 }}>Label (optional)</label>
              <input
                style={INPUT}
                placeholder="e.g. pre-maintenance-window"
                value={createLabel}
                onChange={(e) => setCreateLabel(e.target.value)}
              />
            </div>
            <button
              style={BTN_PRIMARY}
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? 'Creating…' : 'Create'}
            </button>
          </div>
        </div>
      )}

      {isLoading && (
        <p style={{ color: 'var(--io-text-muted)', fontSize: '13px' }}>Loading snapshots…</p>
      )}

      {!isLoading && snapshots.length === 0 && (
        <p style={{ color: 'var(--io-text-muted)', fontSize: '13px' }}>No snapshots yet.</p>
      )}

      {snapshots.length > 0 && (
        <div style={{ overflowX: 'auto' }}>
          <table style={TABLE}>
            <thead>
              <tr>
                <th style={TH}>Target Type</th>
                <th style={TH}>Label</th>
                <th style={TH}>Rows</th>
                <th style={TH}>Created</th>
                <th style={TH}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {snapshots.map((snap) => (
                <>
                  <tr key={snap.id}>
                    <td style={TD}>
                      <Badge color="accent">{TARGET_TYPE_LABELS[snap.target_type] ?? snap.target_type}</Badge>
                    </td>
                    <td style={{ ...TD, color: snap.label ? 'var(--io-text-primary)' : 'var(--io-text-muted)' }}>
                      {snap.label ?? '—'}
                    </td>
                    <td style={TD}>{snap.row_count}</td>
                    <td style={{ ...TD, fontSize: '11px', fontFamily: 'monospace' }}>{fmtDate(snap.created_at)}</td>
                    <td style={TD}>
                      <div style={{ display: 'flex', gap: 'var(--io-space-2)' }}>
                        <button
                          style={{ ...BTN_SECONDARY, fontSize: '11px', padding: '3px 8px' }}
                          onClick={() => setExpanded(expanded === snap.id ? null : snap.id)}
                        >
                          {expanded === snap.id ? 'Hide' : 'View Data'}
                        </button>
                        <button
                          style={{ ...BTN_SECONDARY, fontSize: '11px', padding: '3px 8px' }}
                          onClick={() => setRestoreId(snap.id)}
                        >
                          Restore
                        </button>
                        <button
                          style={{ ...BTN_DANGER, fontSize: '11px', padding: '3px 8px' }}
                          onClick={() => setDeleteId(snap.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expanded === snap.id && (
                    <tr key={`${snap.id}-detail`}>
                      <td colSpan={5} style={{ background: 'var(--io-surface-tertiary)', padding: 'var(--io-space-3)' }}>
                        {detail && detail.id === snap.id ? (
                          <SnapshotDataTable data={detail.snapshot_data} />
                        ) : (
                          <p style={{ color: 'var(--io-text-muted)', fontSize: '12px' }}>Loading…</p>
                        )}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pagination && pagination.pages > 1 && (
        <div style={{ display: 'flex', gap: 'var(--io-space-2)', marginTop: 'var(--io-space-3)', alignItems: 'center' }}>
          <button
            style={BTN_SECONDARY}
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Prev
          </button>
          <span style={{ fontSize: '12px', color: 'var(--io-text-muted)' }}>
            Page {page} of {pagination.pages}
          </span>
          <button
            style={BTN_SECONDARY}
            disabled={page >= pagination.pages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Tab: History
// ---------------------------------------------------------------------------

function HistoryTab() {
  const { data: listResult, isLoading } = useQuery({
    queryKey: ['snapshots-history'],
    queryFn: async () => {
      const result = await snapshotsApi.list({ page: 1, limit: 20 })
      if (!result.success) throw new Error(result.error.message)
      return result.data
    },
  })

  const snapshots = (listResult ?? []) as Snapshot[]

  if (isLoading) {
    return <p style={{ color: 'var(--io-text-muted)', fontSize: '13px' }}>Loading…</p>
  }

  if (snapshots.length === 0) {
    return <p style={{ color: 'var(--io-text-muted)', fontSize: '13px' }}>No snapshot history yet.</p>
  }

  return (
    <div>
      <h3 style={{ margin: '0 0 var(--io-space-4)', fontSize: '14px', fontWeight: 600, color: 'var(--io-text-primary)' }}>
        Last 20 Snapshots
      </h3>
      <div style={{ position: 'relative', paddingLeft: 'var(--io-space-6)' }}>
        {/* Timeline line */}
        <div
          style={{
            position: 'absolute',
            left: 10,
            top: 0,
            bottom: 0,
            width: 2,
            background: 'var(--io-border)',
          }}
        />
        {snapshots.map((snap) => (
          <div
            key={snap.id}
            style={{
              position: 'relative',
              marginBottom: 'var(--io-space-4)',
              paddingLeft: 'var(--io-space-4)',
            }}
          >
            {/* Dot */}
            <div
              style={{
                position: 'absolute',
                left: -16,
                top: 4,
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: 'var(--io-accent)',
                border: '2px solid var(--io-surface-primary)',
              }}
            />
            <div style={{ display: 'flex', gap: 'var(--io-space-3)', alignItems: 'baseline', flexWrap: 'wrap' }}>
              <Badge color="accent">{TARGET_TYPE_LABELS[snap.target_type] ?? snap.target_type}</Badge>
              {snap.label && (
                <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--io-text-primary)' }}>
                  {snap.label}
                </span>
              )}
              <span style={{ fontSize: '11px', color: 'var(--io-text-muted)', fontFamily: 'monospace' }}>
                {fmtDate(snap.created_at)}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--io-text-secondary)' }}>
                {snap.row_count} row{snap.row_count !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

type Tab = 'bulk-update' | 'snapshots' | 'history'

export default function BulkUpdate() {
  const [tab, setTab] = useState<Tab>('bulk-update')

  const tabs: { id: Tab; label: string }[] = [
    { id: 'bulk-update', label: 'Bulk Update' },
    { id: 'snapshots', label: 'Snapshots' },
    { id: 'history', label: 'History' },
  ]

  return (
    <div style={{ padding: 'var(--io-space-6)', maxWidth: 1100 }}>
      <div style={{ marginBottom: 'var(--io-space-5)' }}>
        <h2 style={{ margin: '0 0 4px', color: 'var(--io-text-primary)', fontSize: '20px', fontWeight: 700 }}>
          Bulk Update &amp; Change Snapshots
        </h2>
        <p style={{ margin: 0, color: 'var(--io-text-muted)', fontSize: '13px' }}>
          Download, edit, and reimport configuration data in bulk. Create and restore point-in-time snapshots.
        </p>
      </div>

      {/* Tab bar */}
      <div
        style={{
          display: 'flex',
          gap: 0,
          borderBottom: '1px solid var(--io-border)',
          marginBottom: 'var(--io-space-5)',
        }}
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '8px 20px',
              border: 'none',
              borderBottom: tab === t.id ? '2px solid var(--io-accent)' : '2px solid transparent',
              background: 'none',
              color: tab === t.id ? 'var(--io-accent)' : 'var(--io-text-muted)',
              fontWeight: tab === t.id ? 600 : 400,
              fontSize: '13px',
              cursor: 'pointer',
              transition: 'color 0.15s, border-color 0.15s',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'bulk-update' && <BulkUpdateTab />}
      {tab === 'snapshots' && <SnapshotsTab />}
      {tab === 'history' && <HistoryTab />}
    </div>
  )
}
