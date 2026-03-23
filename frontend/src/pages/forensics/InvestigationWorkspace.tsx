import { useState, useRef, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  forensicsApi,
  type Investigation,
  type InvestigationStage,
  type EvidenceItem,
  type EvidenceType,
  type InvestigationPoint,
  type InvestigationLink,
  type InvestigationLinkType,
  type CorrelationResult,
} from '../../api/forensics'
import { graphicsApi } from '../../api/graphics'
import DataTable, { type ColumnDef } from '../../shared/components/DataTable'
import EChart from '../../shared/components/charts/EChart'
import EvidenceRenderer from './EvidenceRenderer'
import { ErrorBoundary } from '../../shared/components/ErrorBoundary'
import { useAuthStore } from '../../store/auth'
import PointContextMenu from '../../shared/components/PointContextMenu'
import ForensicsPlaybackBar from '../../shared/components/ForensicsPlaybackBar'

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: Investigation['status'] }) {
  const colors: Record<Investigation['status'], { bg: string; text: string }> = {
    active: { bg: 'var(--io-accent-subtle, rgba(74,158,255,0.15))', text: 'var(--io-accent, #4A9EFF)' },
    closed: { bg: 'rgba(34,197,94,0.12)', text: '#22c55e' },
    cancelled: { bg: 'var(--io-surface-secondary)', text: 'var(--io-text-muted)' },
  }
  const c = colors[status]
  return (
    <span
      style={{
        fontSize: '11px',
        padding: '2px 8px',
        borderRadius: '100px',
        background: c.bg,
        color: c.text,
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'capitalize',
        flexShrink: 0,
      }}
    >
      {status}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Evidence type menu
// ---------------------------------------------------------------------------

const EVIDENCE_TYPES: { type: EvidenceType; label: string; icon: string }[] = [
  { type: 'trend', label: 'Trend Chart', icon: '📈' },
  { type: 'annotation', label: 'Annotation', icon: '📝' },
  { type: 'alarm_list', label: 'Alarm List', icon: '🔔' },
  { type: 'value_table', label: 'Value Table', icon: '📊' },
  { type: 'correlation', label: 'Correlation', icon: '🔗' },
  { type: 'point_detail', label: 'Point Detail', icon: '📍' },
  { type: 'graphic_snapshot', label: 'Graphic Snapshot', icon: '📷' },
  { type: 'log_entries', label: 'Log Entries', icon: '📋' },
  { type: 'round_entries', label: 'Round Entries', icon: '☑️' },
  { type: 'calculated_series', label: 'Calculated Series', icon: '⚙️' },
]

// ---------------------------------------------------------------------------
// Stage card
// ---------------------------------------------------------------------------

function StageCard({
  stage,
  investigationId,
  readOnly,
  onRefresh,
  dragHandleProps,
}: {
  stage: InvestigationStage
  investigationId: string
  readOnly: boolean
  onRefresh: () => void
  dragHandleProps?: React.HTMLAttributes<HTMLSpanElement>
}) {
  const queryClient = useQueryClient()
  const [editingName, setEditingName] = useState(false)
  const [stageName, setStageName] = useState(stage.name)
  const [editingRange, setEditingRange] = useState(false)
  const [rangeStart, setRangeStart] = useState(stage.time_range_start.slice(0, 16))
  const [rangeEnd, setRangeEnd] = useState(stage.time_range_end.slice(0, 16))
  const [showEvidenceMenu, setShowEvidenceMenu] = useState(false)
  const [showSnapshotDialog, setShowSnapshotDialog] = useState(false)
  const [snapshotGraphicId, setSnapshotGraphicId] = useState('')
  const [snapshotTimestamp, setSnapshotTimestamp] = useState(stage.time_range_start)
  const menuRef = useRef<HTMLDivElement>(null)

  // Load graphic list only when snapshot dialog is open
  const graphicsQuery = useQuery({
    queryKey: ['graphics-list-for-snapshot'],
    queryFn: async () => {
      const result = await graphicsApi.list()
      return result.success ? (result.data.data ?? []) : []
    },
    enabled: showSnapshotDialog,
    staleTime: 60_000,
  })

  const updateStageMutation = useMutation({
    mutationFn: async (patch: Partial<{ name: string; time_range_start: string; time_range_end: string }>) => {
      const result = await forensicsApi.updateStage(investigationId, stage.id, patch)
      if (!result.success) throw new Error(result.error.message)
      return result.data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['investigation', investigationId] })
      setEditingName(false)
      setEditingRange(false)
      onRefresh()
    },
  })

  const deleteStageMutation = useMutation({
    mutationFn: async () => {
      const result = await forensicsApi.deleteStage(investigationId, stage.id)
      if (!result.success) throw new Error(result.error.message)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['investigation', investigationId] })
      onRefresh()
    },
  })

  const addEvidenceMutation = useMutation({
    mutationFn: async ({ type, config = {} }: { type: EvidenceType; config?: Record<string, unknown> }) => {
      const result = await forensicsApi.addEvidence(investigationId, stage.id, {
        evidence_type: type,
        config,
        sort_order: (stage.evidence?.length ?? 0) + 1,
      })
      if (!result.success) throw new Error(result.error.message)
      return result.data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['investigation', investigationId] })
      setShowEvidenceMenu(false)
      setShowSnapshotDialog(false)
      onRefresh()
    },
  })

  const deleteEvidenceMutation = useMutation({
    mutationFn: async (evidenceId: string) => {
      const result = await forensicsApi.deleteEvidence(investigationId, stage.id, evidenceId)
      if (!result.success) throw new Error(result.error.message)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['investigation', investigationId] })
      onRefresh()
    },
  })

  const updateEvidenceMutation = useMutation({
    mutationFn: async ({ evidenceId, config }: { evidenceId: string; config: Record<string, unknown> }) => {
      const result = await forensicsApi.updateEvidence(investigationId, stage.id, evidenceId, config)
      if (!result.success) throw new Error(result.error.message)
      return result.data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['investigation', investigationId] })
    },
  })

  const formatRange = (start: string, end: string) => {
    const s = new Date(start).toLocaleString()
    const e = new Date(end).toLocaleString()
    return `${s} → ${e}`
  }

  return (
    <div
      style={{
        border: '1px solid var(--io-border)',
        borderRadius: '8px',
        overflow: 'hidden',
        background: 'var(--io-surface)',
      }}
    >
      {/* Stage header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '10px 14px',
          background: 'var(--io-surface-secondary)',
          borderBottom: '1px solid var(--io-border)',
        }}
      >
        {!readOnly && dragHandleProps && (
          <span
            {...dragHandleProps}
            title="Drag to reorder"
            style={{
              color: 'var(--io-text-muted)',
              cursor: 'grab',
              fontSize: '14px',
              flexShrink: 0,
              userSelect: 'none',
              lineHeight: 1,
            }}
          >
            ⠿
          </span>
        )}
        {editingName && !readOnly ? (
          <input
            autoFocus
            value={stageName}
            onChange={(e) => setStageName(e.target.value)}
            onBlur={() => {
              if (stageName.trim() && stageName !== stage.name) {
                updateStageMutation.mutate({ name: stageName.trim() })
              } else {
                setStageName(stage.name)
                setEditingName(false)
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                if (stageName.trim() && stageName !== stage.name) {
                  updateStageMutation.mutate({ name: stageName.trim() })
                } else {
                  setEditingName(false)
                }
              }
              if (e.key === 'Escape') {
                setStageName(stage.name)
                setEditingName(false)
              }
            }}
            style={{
              padding: '2px 6px',
              background: 'var(--io-surface-elevated)',
              border: '1px solid var(--io-accent)',
              borderRadius: '4px',
              color: 'var(--io-text-primary)',
              fontSize: '13px',
              fontWeight: 600,
              outline: 'none',
              flex: 1,
            }}
          />
        ) : (
          <span
            onClick={() => !readOnly && setEditingName(true)}
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--io-text-primary)',
              cursor: readOnly ? 'default' : 'text',
              flex: 1,
            }}
          >
            {stageName}
          </span>
        )}

        {editingRange && !readOnly ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
            <input
              type="datetime-local"
              value={rangeStart}
              onChange={(e) => setRangeStart(e.target.value)}
              style={{
                padding: '2px 6px',
                background: 'var(--io-surface-elevated)',
                border: '1px solid var(--io-accent)',
                borderRadius: '4px',
                color: 'var(--io-text-primary)',
                fontSize: '11px',
                outline: 'none',
              }}
            />
            <span style={{ fontSize: '11px', color: 'var(--io-text-muted)' }}>→</span>
            <input
              type="datetime-local"
              value={rangeEnd}
              onChange={(e) => setRangeEnd(e.target.value)}
              style={{
                padding: '2px 6px',
                background: 'var(--io-surface-elevated)',
                border: '1px solid var(--io-accent)',
                borderRadius: '4px',
                color: 'var(--io-text-primary)',
                fontSize: '11px',
                outline: 'none',
              }}
            />
            <button
              onClick={() => {
                if (rangeStart && rangeEnd) {
                  updateStageMutation.mutate({
                    time_range_start: new Date(rangeStart).toISOString(),
                    time_range_end: new Date(rangeEnd).toISOString(),
                  })
                }
              }}
              style={{ padding: '2px 8px', background: 'var(--io-accent)', border: 'none', borderRadius: '4px', color: '#fff', cursor: 'pointer', fontSize: '11px', fontWeight: 600 }}
            >
              Set
            </button>
            <button
              onClick={() => {
                setRangeStart(stage.time_range_start.slice(0, 16))
                setRangeEnd(stage.time_range_end.slice(0, 16))
                setEditingRange(false)
              }}
              style={{ padding: '2px 6px', background: 'none', border: '1px solid var(--io-border)', borderRadius: '4px', color: 'var(--io-text-muted)', cursor: 'pointer', fontSize: '11px' }}
            >
              ✕
            </button>
          </div>
        ) : (
          <span
            onClick={() => !readOnly && setEditingRange(true)}
            title={readOnly ? undefined : 'Click to edit time range'}
            style={{
              fontSize: '11px',
              color: 'var(--io-text-muted)',
              flexShrink: 0,
              cursor: readOnly ? 'default' : 'pointer',
              padding: '2px 4px',
              borderRadius: '4px',
            }}
            onMouseEnter={(e) => { if (!readOnly) (e.currentTarget as HTMLElement).style.background = 'var(--io-surface-elevated)' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent' }}
          >
            {formatRange(stage.time_range_start, stage.time_range_end)}
          </span>
        )}

        {!readOnly && (
          <button
            onClick={() => {
              if (confirm(`Delete stage "${stage.name}"?`)) {
                deleteStageMutation.mutate()
              }
            }}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--io-text-muted)',
              fontSize: '13px',
              padding: '2px 4px',
              flexShrink: 0,
            }}
            title="Delete stage"
          >
            🗑
          </button>
        )}
      </div>

      {/* Evidence list */}
      <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {(stage.evidence ?? []).length === 0 && (
          <p style={{ margin: 0, fontSize: '13px', color: 'var(--io-text-muted)', fontStyle: 'italic' }}>
            No evidence added to this stage yet.
          </p>
        )}

        {(stage.evidence ?? [])
          .slice()
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((ev: EvidenceItem) => (
            <EvidenceRenderer
              key={ev.id}
              item={ev}
              stageStart={stage.time_range_start}
              stageEnd={stage.time_range_end}
              onDelete={
                readOnly
                  ? undefined
                  : () => deleteEvidenceMutation.mutate(ev.id)
              }
              readOnly={readOnly}
              onUpdateConfig={
                readOnly
                  ? undefined
                  : (evidenceId, patch) => updateEvidenceMutation.mutate({ evidenceId, config: patch })
              }
              isUpdating={
                updateEvidenceMutation.isPending &&
                updateEvidenceMutation.variables?.evidenceId === ev.id
              }
            />
          ))}

        {/* Graphic snapshot picker dialog */}
        {showSnapshotDialog && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.55)',
              zIndex: 200,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            onClick={(e) => { if (e.target === e.currentTarget) setShowSnapshotDialog(false) }}
          >
            <div
              style={{
                background: 'var(--io-surface-elevated)',
                border: '1px solid var(--io-border)',
                borderRadius: '8px',
                padding: '20px',
                width: '380px',
                display: 'flex',
                flexDirection: 'column',
                gap: '14px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700, color: 'var(--io-text-primary)' }}>
                📷 Add Graphic Snapshot
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', color: 'var(--io-text-muted)', fontWeight: 600 }}>Graphic</label>
                <select
                  value={snapshotGraphicId}
                  onChange={(e) => setSnapshotGraphicId(e.target.value)}
                  style={{
                    padding: '6px 10px',
                    background: 'var(--io-surface)',
                    border: '1px solid var(--io-border)',
                    borderRadius: 'var(--io-radius)',
                    color: 'var(--io-text-primary)',
                    fontSize: '13px',
                    outline: 'none',
                  }}
                >
                  <option value="">— Select a graphic —</option>
                  {graphicsQuery.isLoading && <option disabled>Loading...</option>}
                  {(graphicsQuery.data ?? []).map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '12px', color: 'var(--io-text-muted)', fontWeight: 600 }}>Snapshot Timestamp</label>
                {/* ForensicsPlaybackBar — scrub + step controls scoped to stage time range, with alarm markers */}
                <ForensicsPlaybackBar
                  startTime={stage.time_range_start}
                  endTime={stage.time_range_end}
                  value={snapshotTimestamp}
                  onChange={(ts) => setSnapshotTimestamp(ts)}
                  showAlarmMarkers={true}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
                <button
                  onClick={() => setShowSnapshotDialog(false)}
                  style={{ padding: '6px 14px', background: 'none', border: '1px solid var(--io-border)', borderRadius: 'var(--io-radius)', cursor: 'pointer', fontSize: '13px', color: 'var(--io-text-muted)' }}
                >
                  Cancel
                </button>
                <button
                  disabled={!snapshotGraphicId || !snapshotTimestamp || addEvidenceMutation.isPending}
                  onClick={() => {
                    if (!snapshotGraphicId || !snapshotTimestamp) return
                    addEvidenceMutation.mutate({
                      type: 'graphic_snapshot',
                      config: {
                        graphicId: snapshotGraphicId,
                        timestamp: new Date(snapshotTimestamp).toISOString(),
                      },
                    })
                  }}
                  style={{
                    padding: '6px 16px',
                    background: snapshotGraphicId && snapshotTimestamp ? 'var(--io-accent)' : 'var(--io-surface-secondary)',
                    border: 'none',
                    borderRadius: 'var(--io-radius)',
                    cursor: snapshotGraphicId && snapshotTimestamp ? 'pointer' : 'not-allowed',
                    fontSize: '13px',
                    color: '#fff',
                    fontWeight: 600,
                  }}
                >
                  {addEvidenceMutation.isPending ? 'Adding...' : 'Add Snapshot'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add evidence button */}
        {!readOnly && (
          <div style={{ position: 'relative' }} ref={menuRef}>
            <button
              onClick={() => setShowEvidenceMenu((v) => !v)}
              style={{
                padding: '5px 12px',
                background: 'none',
                border: '1px dashed var(--io-border)',
                borderRadius: 'var(--io-radius)',
                cursor: 'pointer',
                fontSize: '12px',
                color: 'var(--io-text-muted)',
                width: '100%',
              }}
            >
              + Add Evidence
            </button>

            {showEvidenceMenu && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: '4px',
                  background: 'var(--io-surface-elevated)',
                  border: '1px solid var(--io-border)',
                  borderRadius: '6px',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
                  zIndex: 50,
                  minWidth: '200px',
                  overflow: 'hidden',
                }}
              >
                {EVIDENCE_TYPES.map((et) => (
                  <button
                    key={et.type}
                    onClick={() => {
                      if (et.type === 'graphic_snapshot') {
                        setShowEvidenceMenu(false)
                        setSnapshotGraphicId('')
                        setSnapshotTimestamp(stage.time_range_start.slice(0, 16))
                        setShowSnapshotDialog(true)
                      } else {
                        addEvidenceMutation.mutate({ type: et.type })
                      }
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      width: '100%',
                      padding: '8px 12px',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '13px',
                      color: 'var(--io-text-primary)',
                      textAlign: 'left',
                    }}
                    onMouseEnter={(e) =>
                      ((e.currentTarget as HTMLButtonElement).style.background =
                        'var(--io-surface-secondary)')
                    }
                    onMouseLeave={(e) =>
                      ((e.currentTarget as HTMLButtonElement).style.background = 'none')
                    }
                  >
                    <span>{et.icon}</span>
                    {et.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Links panel — bidirectional links to log entries, alarms, investigations
// (doc 12 §Investigation Linking)
// ---------------------------------------------------------------------------

const LINK_TYPE_LABELS: Record<InvestigationLinkType, string> = {
  log_entry: 'Log Entry',
  alarm_event: 'Alarm Event',
  investigation: 'Investigation',
  ticket: 'Ticket',
}

function LinksPanel({
  investigationId,
  readOnly,
}: {
  investigationId: string
  readOnly: boolean
}) {
  const queryClient = useQueryClient()
  const [expanded, setExpanded] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [linkType, setLinkType] = useState<InvestigationLinkType>('log_entry')
  const [targetId, setTargetId] = useState('')
  const [targetLabel, setTargetLabel] = useState('')

  const linksQuery = useQuery({
    queryKey: ['investigation-links', investigationId],
    queryFn: async () => {
      const result = await forensicsApi.listLinks(investigationId)
      if (!result.success) throw new Error(result.error.message)
      return result.data
    },
    enabled: expanded,
    staleTime: 30_000,
  })

  const addMutation = useMutation({
    mutationFn: () =>
      forensicsApi.addLink(investigationId, {
        link_type: linkType,
        target_id: targetId.trim(),
        target_label: targetLabel.trim() || targetId.trim(),
      }),
    onSuccess: (result) => {
      if (result.success) {
        void queryClient.invalidateQueries({ queryKey: ['investigation-links', investigationId] })
        setShowForm(false)
        setTargetId('')
        setTargetLabel('')
      }
    },
  })

  const removeMutation = useMutation({
    mutationFn: (linkId: string) => forensicsApi.removeLink(investigationId, linkId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['investigation-links', investigationId] })
    },
  })

  const links = linksQuery.data ?? []

  return (
    <div style={{ borderTop: '1px solid var(--io-border)', flexShrink: 0 }}>
      {/* Section header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        style={{
          width: '100%',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          fontSize: '10px',
          fontWeight: 700,
          letterSpacing: '0.06em',
          color: 'var(--io-text-muted)',
          textTransform: 'uppercase',
        }}
      >
        {expanded ? '▾' : '▸'} Links ({links.length})
      </button>

      {expanded && (
        <div style={{ padding: '0 12px 10px' }}>
          {links.map((link: InvestigationLink) => (
            <div
              key={link.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '3px 0',
              }}
            >
              <span
                style={{
                  fontSize: '10px',
                  padding: '1px 5px',
                  borderRadius: '4px',
                  background: 'var(--io-surface-elevated)',
                  color: 'var(--io-text-muted)',
                  fontWeight: 600,
                  flexShrink: 0,
                }}
              >
                {LINK_TYPE_LABELS[link.link_type]}
              </span>
              <span
                style={{
                  fontSize: '12px',
                  color: 'var(--io-text-primary)',
                  flex: 1,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={link.target_id}
              >
                {link.target_label}
              </span>
              {!readOnly && (
                <button
                  onClick={() => removeMutation.mutate(link.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--io-text-muted)', fontSize: '11px', padding: '1px 3px', flexShrink: 0 }}
                >
                  ✕
                </button>
              )}
            </div>
          ))}

          {links.length === 0 && !showForm && (
            <p style={{ margin: 0, fontSize: '12px', color: 'var(--io-text-muted)', fontStyle: 'italic' }}>
              No links yet.
            </p>
          )}

          {!readOnly && !showForm && (
            <button
              onClick={() => setShowForm(true)}
              style={{
                marginTop: '6px',
                padding: '3px 8px',
                background: 'none',
                border: '1px dashed var(--io-border)',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '11px',
                color: 'var(--io-text-muted)',
              }}
            >
              + Add Link
            </button>
          )}

          {showForm && (
            <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <select
                value={linkType}
                onChange={(e) => setLinkType(e.target.value as InvestigationLinkType)}
                style={{ fontSize: '12px', padding: '4px 6px', background: 'var(--io-surface-elevated)', border: '1px solid var(--io-border)', borderRadius: '4px', color: 'var(--io-text-primary)' }}
              >
                {(Object.keys(LINK_TYPE_LABELS) as InvestigationLinkType[]).map((t) => (
                  <option key={t} value={t}>{LINK_TYPE_LABELS[t]}</option>
                ))}
              </select>
              <input
                placeholder="Target ID"
                value={targetId}
                onChange={(e) => setTargetId(e.target.value)}
                style={{ fontSize: '12px', padding: '4px 6px', background: 'var(--io-surface-elevated)', border: '1px solid var(--io-border)', borderRadius: '4px', color: 'var(--io-text-primary)' }}
              />
              <input
                placeholder="Label (optional)"
                value={targetLabel}
                onChange={(e) => setTargetLabel(e.target.value)}
                style={{ fontSize: '12px', padding: '4px 6px', background: 'var(--io-surface-elevated)', border: '1px solid var(--io-border)', borderRadius: '4px', color: 'var(--io-text-primary)' }}
              />
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  onClick={() => { if (targetId.trim()) addMutation.mutate() }}
                  disabled={!targetId.trim() || addMutation.isPending}
                  style={{ flex: 1, padding: '4px 0', background: 'var(--io-accent)', border: 'none', borderRadius: '4px', color: '#fff', fontSize: '11px', fontWeight: 600, cursor: targetId.trim() ? 'pointer' : 'not-allowed', opacity: targetId.trim() ? 1 : 0.5 }}
                >
                  {addMutation.isPending ? '…' : 'Add'}
                </button>
                <button
                  onClick={() => { setShowForm(false); setTargetId(''); setTargetLabel('') }}
                  style={{ flex: 1, padding: '4px 0', background: 'none', border: '1px solid var(--io-border)', borderRadius: '4px', color: 'var(--io-text-muted)', fontSize: '11px', cursor: 'pointer' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Left panel — points
// ---------------------------------------------------------------------------

function PointsPanel({
  investigationId,
  readOnly,
  onRefresh,
}: {
  investigationId: string
  readOnly: boolean
  onRefresh: () => void
}) {
  const queryClient = useQueryClient()
  const [addInput, setAddInput] = useState('')
  const [showRemoved, setShowRemoved] = useState(false)

  const pointsQuery = useQuery({
    queryKey: ['investigation-points', investigationId],
    queryFn: async () => {
      const result = await forensicsApi.listPoints(investigationId)
      if (!result.success) throw new Error(result.error.message)
      return result.data
    },
    staleTime: 30_000,
  })

  const addPointsMutation = useMutation({
    mutationFn: async (pointIds: string[]) => {
      const result = await forensicsApi.addPoints(investigationId, pointIds)
      if (!result.success) throw new Error(result.error.message)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['investigation-points', investigationId] })
      setAddInput('')
      onRefresh()
    },
  })

  const removePointMutation = useMutation({
    mutationFn: async ({ pointId, reason }: { pointId: string; reason?: string }) => {
      const result = await forensicsApi.removePoint(investigationId, pointId, reason)
      if (!result.success) throw new Error(result.error.message)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['investigation-points', investigationId] })
      onRefresh()
    },
  })

  const points = pointsQuery.data ?? []
  const included = points.filter((p: InvestigationPoint) => p.status === 'included')
  const suggested = points.filter((p: InvestigationPoint) => p.status === 'suggested')
  const removed = points.filter((p: InvestigationPoint) => p.status === 'removed')

  const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <div
      style={{
        fontSize: '10px',
        fontWeight: 700,
        letterSpacing: '0.06em',
        color: 'var(--io-text-muted)',
        textTransform: 'uppercase',
        padding: '8px 0 4px',
      }}
    >
      {children}
    </div>
  )

  const PointRow = ({
    point,
    showRemove,
  }: {
    point: InvestigationPoint
    showRemove: boolean
  }) => (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '4px 0',
        gap: '6px',
      }}
    >
      <PointContextMenu
        pointId={point.point_id}
        tagName={point.point_tag ?? point.point_id}
        isAlarm={false}
        isAlarmElement={false}
      >
        <span
          style={{
            fontSize: '12px',
            color: 'var(--io-text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}
          title={point.point_id}
        >
          {point.point_name ?? point.point_tag ?? point.point_id}
        </span>
      </PointContextMenu>
      {showRemove && !readOnly && (
        <button
          onClick={() => removePointMutation.mutate({ pointId: point.point_id })}
          title="Remove point"
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--io-text-muted)',
            fontSize: '12px',
            padding: '1px 3px',
            flexShrink: 0,
          }}
        >
          ✕
        </button>
      )}
    </div>
  )

  return (
    <div style={{ padding: '10px 12px' }}>
        <SectionLabel>Included Points ({included.length})</SectionLabel>

        {included.length === 0 && (
          <p style={{ fontSize: '12px', color: 'var(--io-text-muted)', fontStyle: 'italic', margin: 0 }}>
            No points added yet.
          </p>
        )}
        {included.map((p: InvestigationPoint) => (
          <PointRow key={p.point_id} point={p} showRemove={true} />
        ))}

        {!readOnly && (
          <div style={{ display: 'flex', gap: '4px', marginTop: '8px' }}>
            <input
              type="text"
              placeholder="Point ID or tag"
              value={addInput}
              onChange={(e) => setAddInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && addInput.trim()) {
                  addPointsMutation.mutate([addInput.trim()])
                }
              }}
              style={{
                flex: 1,
                padding: '4px 8px',
                background: 'var(--io-surface-elevated)',
                border: '1px solid var(--io-border)',
                borderRadius: 'var(--io-radius)',
                color: 'var(--io-text-primary)',
                fontSize: '12px',
                outline: 'none',
                minWidth: 0,
              }}
            />
            <button
              onClick={() => {
                if (addInput.trim()) addPointsMutation.mutate([addInput.trim()])
              }}
              style={{
                padding: '4px 8px',
                background: 'var(--io-accent)',
                border: 'none',
                borderRadius: 'var(--io-radius)',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 600,
                flexShrink: 0,
              }}
            >
              Add
            </button>
          </div>
        )}

        {suggested.length > 0 && (
          <>
            <SectionLabel>Suggested ({suggested.length})</SectionLabel>
            {suggested.map((p: InvestigationPoint) => (
              <PointRow key={p.point_id} point={p} showRemove={false} />
            ))}
          </>
        )}

        {removed.length > 0 && (
          <>
            <button
              onClick={() => setShowRemoved((v) => !v)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '10px',
                fontWeight: 700,
                letterSpacing: '0.06em',
                color: 'var(--io-text-muted)',
                textTransform: 'uppercase',
                padding: '8px 0 4px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              {showRemoved ? '▾' : '▸'} Removed ({removed.length})
            </button>
            {showRemoved &&
              removed.map((p: InvestigationPoint) => (
                <div key={p.point_id}>
                  <PointRow point={p} showRemove={false} />
                  {p.removal_reason && (
                    <div style={{ fontSize: '11px', color: 'var(--io-text-muted)', paddingLeft: '4px', marginTop: '-2px' }}>
                      {p.removal_reason}
                    </div>
                  )}
                </div>
              ))}
          </>
        )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// Correlation heatmap — ECharts N×N matrix
// ---------------------------------------------------------------------------

function CorrelationHeatmap({ correlations }: { correlations: CorrelationResult[] }) {
  // Build unique ordered point list
  const pointIds = Array.from(
    new Set(correlations.flatMap((c) => [c.point_id_a, c.point_id_b])),
  ).sort()

  // Build value array for ECharts heatmap: [xIdx, yIdx, value]
  const data: [number, number, number][] = []
  const lookup = new Map<string, number>()
  for (const c of correlations) {
    lookup.set(`${c.point_id_a}__${c.point_id_b}`, c.pearson)
    lookup.set(`${c.point_id_b}__${c.point_id_a}`, c.pearson)
  }
  for (let yi = 0; yi < pointIds.length; yi++) {
    for (let xi = 0; xi < pointIds.length; xi++) {
      const key = `${pointIds[xi]}__${pointIds[yi]}`
      const val = xi === yi ? 1 : (lookup.get(key) ?? null)
      if (val !== null) data.push([xi, yi, parseFloat(val.toFixed(3))])
    }
  }

  // Short labels — last segment of tag path (e.g. "HCU.FIC101.PV" → "FIC101.PV")
  const shortLabels = pointIds.map((id) => {
    const parts = id.split('.')
    return parts.length > 2 ? parts.slice(-2).join('.') : id
  })

  const option: import('echarts').EChartsOption = {
    backgroundColor: 'transparent',
    tooltip: {
      position: 'top',
      formatter: (params: unknown) => {
        const p = params as { data: [number, number, number] }
        const a = shortLabels[p.data[0]]
        const b = shortLabels[p.data[1]]
        return `${a} ↔ ${b}<br/>Pearson: ${p.data[2].toFixed(4)}`
      },
    },
    grid: { top: 24, bottom: 80, left: 80, right: 24 },
    xAxis: {
      type: 'category',
      data: shortLabels,
      axisLabel: { rotate: 45, fontSize: 10, color: '#a1a1aa' },
      axisLine: { lineStyle: { color: '#3f3f46' } },
      splitArea: { show: true },
    },
    yAxis: {
      type: 'category',
      data: shortLabels,
      axisLabel: { fontSize: 10, color: '#a1a1aa' },
      axisLine: { lineStyle: { color: '#3f3f46' } },
      splitArea: { show: true },
    },
    visualMap: {
      min: -1,
      max: 1,
      calculable: true,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      textStyle: { color: '#a1a1aa', fontSize: 10 },
      inRange: {
        color: ['#2563eb', '#27272a', '#2dd4bf'],
      },
    },
    series: [
      {
        name: 'Pearson r',
        type: 'heatmap',
        data,
        label: { show: pointIds.length <= 8, fontSize: 9, color: '#f9fafb' },
        emphasis: { itemStyle: { shadowBlur: 6, shadowColor: 'rgba(0,0,0,0.5)' } },
      },
    ],
  }

  if (pointIds.length < 2) {
    return (
      <div style={{ padding: '16px', fontSize: 13, color: 'var(--io-text-muted)' }}>
        Need at least 2 points to render a heatmap.
      </div>
    )
  }

  return (
    <EChart option={option} height={Math.max(240, pointIds.length * 40 + 100)} />
  )
}

// Results panel — correlations, change points, spikes
// ---------------------------------------------------------------------------

type ResultsTab = 'correlations' | 'heatmap' | 'change_points' | 'spikes'

function ResultsPanel({
  investigationId,
  investigation,
}: {
  investigationId: string
  investigation: Investigation
}) {
  const [activeTab, setActiveTab] = useState<ResultsTab>('correlations')
  const [results, setResults] = useState<{
    correlations: CorrelationResult[]
    change_points: unknown[]
    spikes: unknown[]
  } | null>(null)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const runAnalysis = async () => {
    // Gather included point IDs from investigation
    const pointIdsResult = await forensicsApi.listPoints(investigationId)
    if (!pointIdsResult.success) {
      setError(pointIdsResult.error.message)
      return
    }
    const included = pointIdsResult.data
      .filter((p: InvestigationPoint) => p.status === 'included')
      .map((p: InvestigationPoint) => p.point_id)

    if (included.length < 2) {
      setError('Add at least 2 included points to run correlation analysis.')
      return
    }

    // Derive time range from all stages
    const stages = investigation.stages ?? []
    if (stages.length === 0) {
      setError('Add at least one stage to define a time range.')
      return
    }

    const starts = stages.map((s) => new Date(s.time_range_start).getTime())
    const ends = stages.map((s) => new Date(s.time_range_end).getTime())
    const start = new Date(Math.min(...starts)).toISOString()
    const end = new Date(Math.max(...ends)).toISOString()

    setRunning(true)
    setError(null)
    try {
      const res = await forensicsApi.runCorrelation({ point_ids: included, start, end })
      if (!res.success) {
        setError(res.error.message)
      } else {
        setResults(res.data)
      }
    } finally {
      setRunning(false)
    }
  }

  const corrColumns: ColumnDef<CorrelationResult>[] = [
    { id: 'point_id_a', header: 'Point A', accessorKey: 'point_id_a', sortable: true },
    { id: 'point_id_b', header: 'Point B', accessorKey: 'point_id_b', sortable: true },
    {
      id: 'pearson',
      header: 'Pearson',
      accessorKey: 'pearson',
      sortable: true,
      cell: (val) => (val as number).toFixed(4),
      width: 90,
    },
    {
      id: 'spearman',
      header: 'Spearman',
      accessorKey: 'spearman',
      sortable: true,
      cell: (val) => (val as number).toFixed(4),
      width: 90,
    },
    {
      id: 'lag_ms',
      header: 'Lag (ms)',
      accessorKey: 'lag_ms',
      sortable: true,
      cell: (val) => (val as number).toLocaleString(),
      width: 90,
    },
  ]

  const tabs: { key: ResultsTab; label: string }[] = [
    { key: 'correlations', label: 'Correlations' },
    { key: 'heatmap', label: 'Heatmap' },
    { key: 'change_points', label: 'Change Points' },
    { key: 'spikes', label: 'Spikes' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Results panel toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 16px',
          borderBottom: '1px solid var(--io-border)',
          background: 'var(--io-surface-secondary)',
          flexShrink: 0,
        }}
      >
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            style={{
              padding: '3px 10px',
              background: activeTab === t.key ? 'var(--io-surface-elevated)' : 'none',
              border: activeTab === t.key ? '1px solid var(--io-border)' : '1px solid transparent',
              borderRadius: 'var(--io-radius)',
              color: activeTab === t.key ? 'var(--io-text-primary)' : 'var(--io-text-muted)',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: activeTab === t.key ? 600 : 400,
            }}
          >
            {t.label}
          </button>
        ))}

        <div style={{ flex: 1 }} />

        {error && (
          <span style={{ fontSize: '12px', color: 'var(--io-danger, #ef4444)' }}>{error}</span>
        )}

        <button
          onClick={() => void runAnalysis()}
          disabled={running}
          style={{
            padding: '4px 12px',
            background: 'var(--io-accent)',
            border: 'none',
            borderRadius: 'var(--io-radius)',
            color: '#fff',
            cursor: running ? 'not-allowed' : 'pointer',
            fontSize: '12px',
            fontWeight: 600,
            opacity: running ? 0.7 : 1,
          }}
        >
          {running ? 'Running...' : 'Run Analysis'}
        </button>
      </div>

      {/* Results body */}
      <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px' }}>
        {!results && !running && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'var(--io-text-muted)',
              fontSize: '13px',
            }}
          >
            No analysis results yet. Click "Run Analysis" to correlate included points.
          </div>
        )}

        {activeTab === 'correlations' && results && (
          <DataTable
            data={results.correlations}
            columns={corrColumns}
            height={200}
            loading={running}
            emptyMessage="No correlations computed"
          />
        )}

        {activeTab === 'heatmap' && results && (
          <CorrelationHeatmap correlations={results.correlations} />
        )}

        {activeTab === 'change_points' && results && (
          <div style={{ fontSize: '13px', color: 'var(--io-text-muted)' }}>
            {results.change_points.length === 0
              ? 'No change points detected.'
              : `${results.change_points.length} change point(s) detected.`}
          </div>
        )}

        {activeTab === 'spikes' && results && (
          <div style={{ fontSize: '13px', color: 'var(--io-text-muted)' }}>
            {results.spikes.length === 0
              ? 'No spikes detected.'
              : `${results.spikes.length} spike(s) detected.`}
          </div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SortableStageCard — wraps StageCard with @dnd-kit useSortable
// ---------------------------------------------------------------------------

function SortableStageCard({
  stage,
  investigationId,
  readOnly,
  onRefresh,
}: {
  stage: InvestigationStage
  investigationId: string
  readOnly: boolean
  onRefresh: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: stage.id,
    disabled: readOnly,
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div ref={setNodeRef} style={style}>
      <StageCard
        stage={stage}
        investigationId={investigationId}
        readOnly={readOnly}
        onRefresh={onRefresh}
        dragHandleProps={readOnly ? undefined : { ...attributes, ...listeners }}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// InvestigationWorkspace
// ---------------------------------------------------------------------------

export default function InvestigationWorkspace() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [resultsCollapsed, setResultsCollapsed] = useState(false)
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)
  const [showExportPicker, setShowExportPicker] = useState(false)
  const [showShareDialog, setShowShareDialog] = useState(false)
  const [exportStatus, setExportStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [shareUserIds, setShareUserIds] = useState('')
  const [shareRoleIds, setShareRoleIds] = useState('')
  const [shareStatus, setShareStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle')
  const [localStageOrder, setLocalStageOrder] = useState<string[]>([])

  // Reset local stage order when the investigation changes
  useEffect(() => {
    setLocalStageOrder([])
  }, [id])

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  const { user } = useAuthStore()
  const canExport = user?.permissions.includes('forensics:export') ?? false
  const canShare = user?.permissions.includes('forensics:share') ?? false

  const query = useQuery({
    queryKey: ['investigation', id],
    queryFn: async () => {
      if (!id) throw new Error('No investigation ID')
      const result = await forensicsApi.getInvestigation(id)
      if (!result.success) throw new Error(result.error.message)
      return result.data
    },
    enabled: !!id,
    staleTime: 15_000,
  })

  const investigation = query.data

  const saveMutation = useMutation({
    mutationFn: async (name: string) => {
      if (!id) return
      const result = await forensicsApi.updateInvestigation(id, { name })
      if (!result.success) throw new Error(result.error.message)
      return result.data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['investigation', id] })
      setEditingName(false)
    },
  })

  const closeMutation = useMutation({
    mutationFn: async () => {
      if (!id) return
      const result = await forensicsApi.closeInvestigation(id)
      if (!result.success) throw new Error(result.error.message)
      return result.data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['investigation', id] })
      setShowCloseConfirm(false)
    },
  })

  const cancelMutation = useMutation({
    mutationFn: async () => {
      if (!id) return
      const result = await forensicsApi.cancelInvestigation(id)
      if (!result.success) throw new Error(result.error.message)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['investigation', id] })
    },
  })

  const addStageMutation = useMutation({
    mutationFn: async () => {
      if (!id) return
      const now = new Date()
      const end = now.toISOString()
      const start = new Date(now.getTime() - 60 * 60 * 1000).toISOString()
      const stages = investigation?.stages ?? []
      const result = await forensicsApi.addStage(id, {
        name: `Stage ${stages.length + 1}`,
        time_range_start: start,
        time_range_end: end,
        sort_order: stages.length + 1,
      })
      if (!result.success) throw new Error(result.error.message)
      return result.data
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['investigation', id] })
    },
  })

  // ---------------------------------------------------------------------------
  // Loading / error states
  // ---------------------------------------------------------------------------

  if (query.isLoading) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--io-text-muted)',
          fontSize: '14px',
        }}
      >
        Loading investigation...
      </div>
    )
  }

  if (query.isError || !investigation) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          color: 'var(--io-danger, #ef4444)',
          fontSize: '14px',
        }}
      >
        <span>Failed to load investigation.</span>
        <button
          onClick={() => navigate('/forensics')}
          style={{
            padding: '6px 14px',
            background: 'var(--io-surface-elevated)',
            border: '1px solid var(--io-border)',
            borderRadius: 'var(--io-radius)',
            cursor: 'pointer',
            fontSize: '13px',
            color: 'var(--io-text-secondary)',
          }}
        >
          Back to Forensics
        </button>
      </div>
    )
  }

  const isReadOnly = investigation.status !== 'active'
  const serverStages = (investigation.stages ?? []).slice().sort((a, b) => a.sort_order - b.sort_order)
  // Apply local optimistic ordering if set, otherwise use server order
  const stages =
    localStageOrder.length === serverStages.length && localStageOrder.length > 0
      ? localStageOrder.map((sid) => serverStages.find((s) => s.id === sid)!).filter(Boolean)
      : serverStages

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = stages.findIndex((s) => s.id === active.id)
    const newIndex = stages.findIndex((s) => s.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return

    const reordered = arrayMove(stages, oldIndex, newIndex)
    // Optimistically update local order immediately
    setLocalStageOrder(reordered.map((s) => s.id))

    // Persist new sort_order values for every stage in the reordered list
    if (!id) return
    reordered.forEach((stage, idx) => {
      const newSortOrder = idx + 1
      if (stage.sort_order !== newSortOrder) {
        void forensicsApi.updateStage(id, stage.id, { sort_order: newSortOrder }).then(() => {
          void queryClient.invalidateQueries({ queryKey: ['investigation', id] })
        })
      }
    })
  }

  const handleSaveName = () => {
    if (nameInput.trim() && nameInput !== investigation.name) {
      saveMutation.mutate(nameInput.trim())
    } else {
      setEditingName(false)
    }
  }

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--io-surface-primary)',
        overflow: 'hidden',
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '0 16px',
          height: '44px',
          flexShrink: 0,
          background: 'var(--io-surface)',
          borderBottom: '1px solid var(--io-border)',
        }}
      >
        <button
          onClick={() => navigate('/forensics')}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--io-text-muted)',
            cursor: 'pointer',
            fontSize: '13px',
            padding: '4px',
            flexShrink: 0,
          }}
          title="Back to Forensics"
        >
          ←
        </button>

        {/* Editable name */}
        {editingName && !isReadOnly ? (
          <input
            autoFocus
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            onBlur={handleSaveName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSaveName()
              if (e.key === 'Escape') setEditingName(false)
            }}
            style={{
              flex: 1,
              maxWidth: '400px',
              padding: '4px 8px',
              background: 'var(--io-surface-elevated)',
              border: '1px solid var(--io-accent)',
              borderRadius: '4px',
              color: 'var(--io-text-primary)',
              fontSize: '14px',
              fontWeight: 600,
              outline: 'none',
            }}
          />
        ) : (
          <span
            onClick={() => {
              if (!isReadOnly) {
                setNameInput(investigation.name)
                setEditingName(true)
              }
            }}
            style={{
              fontSize: '14px',
              fontWeight: 700,
              color: 'var(--io-text-primary)',
              cursor: isReadOnly ? 'default' : 'text',
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              maxWidth: '400px',
            }}
            title={isReadOnly ? investigation.name : 'Click to rename'}
          >
            {investigation.name}
          </span>
        )}

        <StatusBadge status={investigation.status} />

        <div style={{ flex: 1 }} />

        {/* Export / Share / Print buttons */}
        {canExport && (
          <button
            onClick={() => setShowExportPicker(true)}
            style={{
              padding: '5px 12px',
              background: 'none',
              border: '1px solid var(--io-border)',
              borderRadius: 'var(--io-radius)',
              color: 'var(--io-text-secondary)',
              cursor: 'pointer',
              fontSize: '12px',
            }}
            title="Export investigation"
          >
            Export
          </button>
        )}

        {canShare && (
          <button
            onClick={() => setShowShareDialog(true)}
            style={{
              padding: '5px 12px',
              background: 'none',
              border: '1px solid var(--io-border)',
              borderRadius: 'var(--io-radius)',
              color: 'var(--io-text-secondary)',
              cursor: 'pointer',
              fontSize: '12px',
            }}
            title="Share investigation"
          >
            Share
          </button>
        )}

        <button
          onClick={() => window.print()}
          style={{
            padding: '5px 12px',
            background: 'none',
            border: '1px solid var(--io-border)',
            borderRadius: 'var(--io-radius)',
            color: 'var(--io-text-secondary)',
            cursor: 'pointer',
            fontSize: '12px',
          }}
          title="Print investigation"
        >
          Print
        </button>

        {/* Action buttons */}
        {!isReadOnly && (
          <>
            <button
              onClick={() => saveMutation.mutate(investigation.name)}
              disabled={saveMutation.isPending}
              style={{
                padding: '5px 12px',
                background: 'var(--io-accent)',
                border: 'none',
                borderRadius: 'var(--io-radius)',
                color: '#fff',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              Save
            </button>

            <button
              onClick={() => setShowCloseConfirm(true)}
              style={{
                padding: '5px 12px',
                background: 'none',
                border: '1px solid var(--io-border)',
                borderRadius: 'var(--io-radius)',
                color: 'var(--io-text-secondary)',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              Close
            </button>

            <button
              onClick={() => {
                if (confirm('Cancel this investigation? This action cannot be undone.')) {
                  cancelMutation.mutate()
                }
              }}
              style={{
                padding: '5px 12px',
                background: 'none',
                border: '1px solid var(--io-border)',
                borderRadius: 'var(--io-radius)',
                color: 'var(--io-text-muted)',
                cursor: 'pointer',
                fontSize: '12px',
              }}
            >
              Cancel
            </button>
          </>
        )}

        {isReadOnly && (
          <span style={{ fontSize: '12px', color: 'var(--io-text-muted)', fontStyle: 'italic' }}>
            Read-only
          </span>
        )}
      </div>

      {/* Body: left panel + main canvas */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        {/* Left panel */}
        <ErrorBoundary module="Forensics — Points Panel">
          <div style={{ width: '260px', flexShrink: 0, borderRight: '1px solid var(--io-border)', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--io-surface-secondary)' }}>
            <div style={{ flex: 1, overflowY: 'auto' }}>
              <PointsPanel
                investigationId={investigation.id}
                readOnly={isReadOnly}
                onRefresh={() => void queryClient.invalidateQueries({ queryKey: ['investigation', id] })}
              />
            </div>
            <LinksPanel investigationId={investigation.id} readOnly={isReadOnly} />
          </div>
        </ErrorBoundary>

        {/* Main canvas + results */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          {/* Scrollable stages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {stages.length === 0 && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  padding: '60px 24px',
                  color: 'var(--io-text-muted)',
                  textAlign: 'center',
                }}
              >
                <span style={{ fontSize: '32px', opacity: 0.25 }}>📋</span>
                <p style={{ margin: 0, fontSize: '14px', color: 'var(--io-text-secondary)' }}>
                  No stages yet. Add a stage to begin organizing your investigation.
                </p>
              </div>
            )}

            <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
              <SortableContext items={stages.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                {stages.map((stage) => (
                  <ErrorBoundary key={stage.id} module={`Forensics — Stage: ${stage.name}`}>
                    <SortableStageCard
                      stage={stage}
                      investigationId={investigation.id}
                      readOnly={isReadOnly}
                      onRefresh={() =>
                        void queryClient.invalidateQueries({ queryKey: ['investigation', id] })
                      }
                    />
                  </ErrorBoundary>
                ))}
              </SortableContext>
            </DndContext>

            {!isReadOnly && (
              <button
                onClick={() => addStageMutation.mutate()}
                disabled={addStageMutation.isPending}
                style={{
                  padding: '8px 16px',
                  background: 'none',
                  border: '1px dashed var(--io-border)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '13px',
                  color: 'var(--io-text-muted)',
                  alignSelf: 'flex-start',
                }}
              >
                {addStageMutation.isPending ? 'Adding...' : '+ Add Stage'}
              </button>
            )}
          </div>

          {/* Results panel — collapsible */}
          <ErrorBoundary module="Forensics — Analysis Results">
          <div
            style={{
              borderTop: '1px solid var(--io-border)',
              flexShrink: 0,
              height: resultsCollapsed ? '36px' : '260px',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
              transition: 'height 0.2s ease',
            }}
          >
            {/* Results header */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '0 16px',
                height: '36px',
                flexShrink: 0,
                background: 'var(--io-surface-secondary)',
                borderBottom: resultsCollapsed ? 'none' : '1px solid var(--io-border)',
                cursor: 'pointer',
              }}
              onClick={() => setResultsCollapsed((v) => !v)}
            >
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--io-text-muted)', userSelect: 'none', flex: 1 }}>
                {resultsCollapsed ? '▸' : '▾'} Analysis Results
              </span>
            </div>

            {!resultsCollapsed && id && (
              <div style={{ flex: 1, overflow: 'hidden' }}>
                <ResultsPanel investigationId={id} investigation={investigation} />
              </div>
            )}
          </div>
          </ErrorBoundary>
        </div>
      </div>

      {/* Export format picker */}
      {showExportPicker && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
          onClick={() => { if (exportStatus !== 'loading') { setShowExportPicker(false); setExportStatus('idle') } }}
        >
          <div
            style={{
              background: 'var(--io-surface)',
              border: '1px solid var(--io-border)',
              borderRadius: '8px',
              padding: '24px',
              width: '340px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--io-text-primary)' }}>
              Export Investigation
            </h3>
            {exportStatus === 'done' ? (
              <p style={{ margin: 0, fontSize: '13px', color: '#22c55e' }}>
                Export started. You will be notified when it is ready.
              </p>
            ) : exportStatus === 'error' ? (
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--io-danger, #ef4444)' }}>
                Export failed. Please try again.
              </p>
            ) : (
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--io-text-secondary)' }}>
                Choose a format to export this investigation.
              </p>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {(['csv', 'xlsx', 'json', 'pdf', 'html'] as const).map((fmt) => (
                <button
                  key={fmt}
                  disabled={exportStatus === 'loading'}
                  onClick={async () => {
                    if (!id) return
                    setExportStatus('loading')
                    try {
                      const result = await forensicsApi.exportInvestigation(id, fmt)
                      if (!result.success) throw new Error(result.error.message)
                      setExportStatus('done')
                    } catch {
                      setExportStatus('error')
                    }
                  }}
                  style={{
                    padding: '6px 14px',
                    background: 'var(--io-surface-elevated)',
                    border: '1px solid var(--io-border)',
                    borderRadius: 'var(--io-radius)',
                    cursor: exportStatus === 'loading' ? 'not-allowed' : 'pointer',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: 'var(--io-text-primary)',
                    textTransform: 'uppercase',
                  }}
                >
                  {fmt}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setShowExportPicker(false); setExportStatus('idle') }}
                style={{
                  padding: '6px 14px',
                  background: 'none',
                  border: '1px solid var(--io-border)',
                  borderRadius: 'var(--io-radius)',
                  cursor: 'pointer',
                  fontSize: '13px',
                  color: 'var(--io-text-secondary)',
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share dialog */}
      {showShareDialog && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
          onClick={() => { if (shareStatus !== 'loading') { setShowShareDialog(false); setShareStatus('idle') } }}
        >
          <div
            style={{
              background: 'var(--io-surface)',
              border: '1px solid var(--io-border)',
              borderRadius: '8px',
              padding: '24px',
              width: '380px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--io-text-primary)' }}>
              Share Investigation
            </h3>
            {shareStatus === 'done' ? (
              <p style={{ margin: 0, fontSize: '13px', color: '#22c55e' }}>
                Investigation shared successfully.
              </p>
            ) : shareStatus === 'error' ? (
              <p style={{ margin: 0, fontSize: '13px', color: 'var(--io-danger, #ef4444)' }}>
                Share failed. Please try again.
              </p>
            ) : null}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--io-text-secondary)' }}>
                User IDs (comma-separated)
                <input
                  value={shareUserIds}
                  onChange={(e) => setShareUserIds(e.target.value)}
                  placeholder="e.g. user-uuid-1, user-uuid-2"
                  style={{
                    display: 'block',
                    marginTop: '4px',
                    width: '100%',
                    padding: '6px 8px',
                    background: 'var(--io-surface-elevated)',
                    border: '1px solid var(--io-border)',
                    borderRadius: 'var(--io-radius)',
                    color: 'var(--io-text-primary)',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </label>
              <label style={{ fontSize: '12px', fontWeight: 600, color: 'var(--io-text-secondary)' }}>
                Role IDs (comma-separated)
                <input
                  value={shareRoleIds}
                  onChange={(e) => setShareRoleIds(e.target.value)}
                  placeholder="e.g. role-uuid-1"
                  style={{
                    display: 'block',
                    marginTop: '4px',
                    width: '100%',
                    padding: '6px 8px',
                    background: 'var(--io-surface-elevated)',
                    border: '1px solid var(--io-border)',
                    borderRadius: 'var(--io-radius)',
                    color: 'var(--io-text-primary)',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box',
                  }}
                />
              </label>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                onClick={() => { setShowShareDialog(false); setShareStatus('idle'); setShareUserIds(''); setShareRoleIds('') }}
                style={{
                  padding: '6px 14px',
                  background: 'none',
                  border: '1px solid var(--io-border)',
                  borderRadius: 'var(--io-radius)',
                  cursor: 'pointer',
                  fontSize: '13px',
                  color: 'var(--io-text-secondary)',
                }}
              >
                Cancel
              </button>
              <button
                disabled={shareStatus === 'loading' || (shareUserIds.trim() === '' && shareRoleIds.trim() === '')}
                onClick={async () => {
                  if (!id) return
                  setShareStatus('loading')
                  const userIds = shareUserIds.split(',').map((s) => s.trim()).filter(Boolean)
                  const roleIds = shareRoleIds.split(',').map((s) => s.trim()).filter(Boolean)
                  try {
                    const result = await forensicsApi.shareInvestigation(id, {
                      user_ids: userIds.length > 0 ? userIds : undefined,
                      role_ids: roleIds.length > 0 ? roleIds : undefined,
                    })
                    if (!result.success) throw new Error(result.error.message)
                    setShareStatus('done')
                  } catch {
                    setShareStatus('error')
                  }
                }}
                style={{
                  padding: '6px 14px',
                  background: 'var(--io-accent)',
                  border: 'none',
                  borderRadius: 'var(--io-radius)',
                  cursor: shareStatus === 'loading' ? 'not-allowed' : 'pointer',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#fff',
                }}
              >
                {shareStatus === 'loading' ? 'Sharing...' : 'Share'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close confirmation */}
      {showCloseConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
          }}
        >
          <div
            style={{
              background: 'var(--io-surface)',
              border: '1px solid var(--io-border)',
              borderRadius: '8px',
              padding: '24px',
              width: '380px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: 'var(--io-text-primary)' }}>
              Close Investigation
            </h3>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--io-text-secondary)' }}>
              Closing this investigation will lock it for editing. You can still view it.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                onClick={() => setShowCloseConfirm(false)}
                style={{
                  padding: '6px 14px',
                  background: 'none',
                  border: '1px solid var(--io-border)',
                  borderRadius: 'var(--io-radius)',
                  cursor: 'pointer',
                  fontSize: '13px',
                  color: 'var(--io-text-secondary)',
                }}
              >
                Keep Active
              </button>
              <button
                onClick={() => closeMutation.mutate()}
                disabled={closeMutation.isPending}
                style={{
                  padding: '6px 14px',
                  background: '#22c55e',
                  border: 'none',
                  borderRadius: 'var(--io-radius)',
                  cursor: 'pointer',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#fff',
                }}
              >
                {closeMutation.isPending ? 'Closing...' : 'Close Investigation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
