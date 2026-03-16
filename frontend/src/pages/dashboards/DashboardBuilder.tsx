import { useState, useCallback, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { useDraggable } from '@dnd-kit/core'
import { useDroppable } from '@dnd-kit/core'
import {
  dashboardsApi,
  type WidgetConfig,
  type DashboardVariable,
  type Dashboard,
} from '../../api/dashboards'
import WidgetContainer from './widgets/WidgetContainer'

// ---------------------------------------------------------------------------
// Widget library definitions
// ---------------------------------------------------------------------------

interface WidgetLibraryItem {
  type: string
  label: string
  icon: string
  category: string
  defaultConfig: Record<string, unknown>
  defaultSize: { w: number; h: number }
}

const WIDGET_LIBRARY: WidgetLibraryItem[] = [
  {
    type: 'line-chart',
    label: 'Line Chart',
    icon: '📈',
    category: 'Charts',
    defaultConfig: { title: 'Line Chart', points: [], timeRange: '1h', aggregation: '5m' },
    defaultSize: { w: 6, h: 4 },
  },
  {
    type: 'bar-chart',
    label: 'Bar Chart',
    icon: '📊',
    category: 'Charts',
    defaultConfig: { title: 'Bar Chart', series: [{ label: 'A', value: 42 }, { label: 'B', value: 68 }] },
    defaultSize: { w: 4, h: 4 },
  },
  {
    type: 'pie-chart',
    label: 'Pie Chart',
    icon: '🥧',
    category: 'Charts',
    defaultConfig: { title: 'Pie Chart', series: [{ label: 'A', value: 40 }, { label: 'B', value: 60 }] },
    defaultSize: { w: 4, h: 4 },
  },
  {
    type: 'kpi-card',
    label: 'KPI Card',
    icon: '🔢',
    category: 'KPIs',
    defaultConfig: { title: 'KPI', metric: '', unit: '', staticValue: 0 },
    defaultSize: { w: 3, h: 2 },
  },
  {
    type: 'gauge',
    label: 'Gauge',
    icon: '⏱',
    category: 'KPIs',
    defaultConfig: { title: 'Gauge', pointId: '', min: 0, max: 100, unit: '', thresholds: { warning: 75, critical: 90 } },
    defaultSize: { w: 3, h: 4 },
  },
  {
    type: 'table',
    label: 'Table',
    icon: '📋',
    category: 'Tables',
    defaultConfig: { title: 'Table', columns: [{ key: 'name', label: 'Name' }, { key: 'value', label: 'Value' }], rows: [] },
    defaultSize: { w: 6, h: 4 },
  },
  {
    type: 'alert-status',
    label: 'Alert Status',
    icon: '🚨',
    category: 'Status',
    defaultConfig: { title: 'Active Alarms', maxItems: 10 },
    defaultSize: { w: 4, h: 5 },
  },
  {
    type: 'text',
    label: 'Text Label',
    icon: '🔤',
    category: 'Text',
    defaultConfig: { content: 'Enter text here...', fontSize: 14, align: 'left' },
    defaultSize: { w: 4, h: 2 },
  },
]

const CATEGORIES = ['Charts', 'KPIs', 'Tables', 'Status', 'Text']

// ---------------------------------------------------------------------------
// Draggable widget in grid
// ---------------------------------------------------------------------------

function DraggableWidget({
  widget,
  children,
}: {
  widget: WidgetConfig
  children: React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: widget.id,
    data: { type: 'grid-widget', widget },
  })

  const style = transform
    ? { transform: CSS.Translate.toString(transform), zIndex: isDragging ? 100 : undefined, opacity: isDragging ? 0.7 : 1 }
    : {}

  return (
    <div ref={setNodeRef} style={{ height: '100%', ...style }} {...attributes} {...listeners}>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Droppable grid
// ---------------------------------------------------------------------------

function DroppableGrid({ children }: { children: React.ReactNode }) {
  const { setNodeRef } = useDroppable({ id: 'grid' })
  return (
    <div ref={setNodeRef} style={{ minHeight: '100%' }}>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Widget config editor panel
// ---------------------------------------------------------------------------

function WidgetConfigPanel({
  widget,
  onUpdate,
  onClose,
}: {
  widget: WidgetConfig
  onUpdate: (updated: WidgetConfig) => void
  onClose: () => void
}) {
  const [localConfig, setLocalConfig] = useState<Record<string, unknown>>(widget.config)
  const [pointSearch, setPointSearch] = useState('')

  function setField(key: string, value: unknown) {
    const updated = { ...localConfig, [key]: value }
    setLocalConfig(updated)
    onUpdate({ ...widget, config: updated })
  }

  const cfg = localConfig

  return (
    <div
      style={{
        width: '280px',
        flexShrink: 0,
        borderLeft: '1px solid var(--io-border)',
        background: 'var(--io-surface-secondary)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 12px',
          borderBottom: '1px solid var(--io-border)',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--io-text-primary)' }}>
          Widget Config
        </span>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--io-text-muted)',
            cursor: 'pointer',
            fontSize: '16px',
            lineHeight: 1,
          }}
        >
          ×
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {/* Title */}
        {typeof cfg.title !== 'undefined' && (
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--io-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Title
            </span>
            <input
              type="text"
              value={String(cfg.title ?? '')}
              onChange={(e) => setField('title', e.target.value)}
              style={{ padding: '6px 8px', background: 'var(--io-surface-elevated)', border: '1px solid var(--io-border)', borderRadius: 'var(--io-radius)', color: 'var(--io-text-primary)', fontSize: '13px', outline: 'none' }}
            />
          </label>
        )}

        {/* Point ID (for KPI, Gauge) */}
        {(widget.type === 'kpi-card' || widget.type === 'gauge') && (
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--io-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {widget.type === 'gauge' ? 'Point ID' : 'Metric'}
            </span>
            <input
              type="text"
              placeholder="Search points..."
              value={pointSearch || String(cfg.metric ?? cfg.pointId ?? '')}
              onChange={(e) => {
                setPointSearch(e.target.value)
                const key = widget.type === 'gauge' ? 'pointId' : 'metric'
                setField(key, e.target.value)
              }}
              style={{ padding: '6px 8px', background: 'var(--io-surface-elevated)', border: '1px solid var(--io-border)', borderRadius: 'var(--io-radius)', color: 'var(--io-text-primary)', fontSize: '13px', outline: 'none' }}
            />
          </label>
        )}

        {/* Unit */}
        {typeof cfg.unit !== 'undefined' && (
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--io-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Unit
            </span>
            <input
              type="text"
              value={String(cfg.unit ?? '')}
              onChange={(e) => setField('unit', e.target.value)}
              style={{ padding: '6px 8px', background: 'var(--io-surface-elevated)', border: '1px solid var(--io-border)', borderRadius: 'var(--io-radius)', color: 'var(--io-text-primary)', fontSize: '13px', outline: 'none' }}
            />
          </label>
        )}

        {/* Min/Max for gauge */}
        {widget.type === 'gauge' && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: 'var(--io-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Min</span>
              <input
                type="number"
                value={Number(cfg.min ?? 0)}
                onChange={(e) => setField('min', parseFloat(e.target.value))}
                style={{ padding: '6px 8px', background: 'var(--io-surface-elevated)', border: '1px solid var(--io-border)', borderRadius: 'var(--io-radius)', color: 'var(--io-text-primary)', fontSize: '13px', outline: 'none' }}
              />
            </label>
            <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: 'var(--io-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Max</span>
              <input
                type="number"
                value={Number(cfg.max ?? 100)}
                onChange={(e) => setField('max', parseFloat(e.target.value))}
                style={{ padding: '6px 8px', background: 'var(--io-surface-elevated)', border: '1px solid var(--io-border)', borderRadius: 'var(--io-radius)', color: 'var(--io-text-primary)', fontSize: '13px', outline: 'none' }}
              />
            </label>
          </div>
        )}

        {/* Text content */}
        {widget.type === 'text' && (
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--io-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Content
            </span>
            <textarea
              value={String(cfg.content ?? '')}
              onChange={(e) => setField('content', e.target.value)}
              rows={4}
              style={{ padding: '6px 8px', background: 'var(--io-surface-elevated)', border: '1px solid var(--io-border)', borderRadius: 'var(--io-radius)', color: 'var(--io-text-primary)', fontSize: '13px', outline: 'none', resize: 'vertical' }}
            />
          </label>
        )}

        {/* Time range for line chart */}
        {widget.type === 'line-chart' && (
          <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--io-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Time Range
            </span>
            <select
              value={String(cfg.timeRange ?? '1h')}
              onChange={(e) => setField('timeRange', e.target.value)}
              style={{ padding: '6px 8px', background: 'var(--io-surface-elevated)', border: '1px solid var(--io-border)', borderRadius: 'var(--io-radius)', color: 'var(--io-text-primary)', fontSize: '13px', outline: 'none' }}
            >
              {['15m', '30m', '1h', '6h', '12h', '24h', '7d'].map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </label>
        )}

        {/* Widget dimensions */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--io-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Width</span>
            <select
              value={widget.w}
              onChange={(e) => onUpdate({ ...widget, w: parseInt(e.target.value) })}
              style={{ padding: '6px 8px', background: 'var(--io-surface-elevated)', border: '1px solid var(--io-border)', borderRadius: 'var(--io-radius)', color: 'var(--io-text-primary)', fontSize: '13px', outline: 'none' }}
            >
              {[1,2,3,4,5,6,7,8,9,10,11,12].map((n) => (
                <option key={n} value={n}>{n} col{n !== 1 ? 's' : ''}</option>
              ))}
            </select>
          </label>
          <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '11px', color: 'var(--io-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Height</span>
            <select
              value={widget.h}
              onChange={(e) => onUpdate({ ...widget, h: parseInt(e.target.value) })}
              style={{ padding: '6px 8px', background: 'var(--io-surface-elevated)', border: '1px solid var(--io-border)', borderRadius: 'var(--io-radius)', color: 'var(--io-text-primary)', fontSize: '13px', outline: 'none' }}
            >
              {[1,2,3,4,5,6,7,8,9,10].map((n) => (
                <option key={n} value={n}>{n} row{n !== 1 ? 's' : ''}</option>
              ))}
            </select>
          </label>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Variables editor modal
// ---------------------------------------------------------------------------

function VariablesModal({
  variables,
  onSave,
  onClose,
}: {
  variables: DashboardVariable[]
  onSave: (vars: DashboardVariable[]) => void
  onClose: () => void
}) {
  const [localVars, setLocalVars] = useState<DashboardVariable[]>(variables)

  function addVar() {
    setLocalVars((prev) => [
      ...prev,
      { name: `var${prev.length + 1}`, label: `Variable ${prev.length + 1}`, type: 'custom', options: [] },
    ])
  }

  function removeVar(idx: number) {
    setLocalVars((prev) => prev.filter((_, i) => i !== idx))
  }

  function updateVar(idx: number, updates: Partial<DashboardVariable>) {
    setLocalVars((prev) => prev.map((v, i) => (i === idx ? { ...v, ...updates } : v)))
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          background: 'var(--io-surface-elevated)',
          border: '1px solid var(--io-border)',
          borderRadius: 'var(--io-radius)',
          width: '600px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 16px',
            borderBottom: '1px solid var(--io-border)',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--io-text-primary)' }}>
            Dashboard Variables
          </span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: 'var(--io-text-muted)', cursor: 'pointer', fontSize: '18px', lineHeight: 1 }}
          >
            ×
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {localVars.map((variable, idx) => (
            <div
              key={idx}
              style={{
                background: 'var(--io-surface-secondary)',
                border: '1px solid var(--io-border)',
                borderRadius: 'var(--io-radius)',
                padding: '12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
              }}
            >
              <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--io-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Name</span>
                  <input
                    type="text"
                    value={variable.name}
                    onChange={(e) => updateVar(idx, { name: e.target.value })}
                    style={{ padding: '5px 8px', background: 'var(--io-surface-elevated)', border: '1px solid var(--io-border)', borderRadius: 'var(--io-radius)', color: 'var(--io-text-primary)', fontSize: '13px', outline: 'none' }}
                  />
                </label>
                <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--io-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Label</span>
                  <input
                    type="text"
                    value={variable.label}
                    onChange={(e) => updateVar(idx, { label: e.target.value })}
                    style={{ padding: '5px 8px', background: 'var(--io-surface-elevated)', border: '1px solid var(--io-border)', borderRadius: 'var(--io-radius)', color: 'var(--io-text-primary)', fontSize: '13px', outline: 'none' }}
                  />
                </label>
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--io-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Type</span>
                  <select
                    value={variable.type}
                    onChange={(e) => updateVar(idx, { type: e.target.value as DashboardVariable['type'] })}
                    style={{ padding: '5px 8px', background: 'var(--io-surface-elevated)', border: '1px solid var(--io-border)', borderRadius: 'var(--io-radius)', color: 'var(--io-text-primary)', fontSize: '13px', outline: 'none' }}
                  >
                    {['query', 'custom', 'text', 'interval', 'constant', 'chained'].map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </label>
                <button
                  onClick={() => removeVar(idx)}
                  style={{ marginTop: '20px', background: 'none', border: 'none', color: 'var(--io-danger, #ef4444)', cursor: 'pointer', fontSize: '16px', flexShrink: 0 }}
                >
                  ×
                </button>
              </div>

              {(variable.type === 'custom' || variable.type === 'chained') && (
                <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <span style={{ fontSize: '11px', color: 'var(--io-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Options (comma-separated)</span>
                  <input
                    type="text"
                    value={(variable.options ?? []).join(', ')}
                    onChange={(e) => updateVar(idx, { options: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })}
                    placeholder="opt1, opt2, opt3"
                    style={{ padding: '5px 8px', background: 'var(--io-surface-elevated)', border: '1px solid var(--io-border)', borderRadius: 'var(--io-radius)', color: 'var(--io-text-primary)', fontSize: '13px', outline: 'none' }}
                  />
                </label>
              )}

              <label style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ fontSize: '11px', color: 'var(--io-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Default</span>
                <input
                  type="text"
                  value={variable.default ?? ''}
                  onChange={(e) => updateVar(idx, { default: e.target.value || undefined })}
                  style={{ padding: '5px 8px', background: 'var(--io-surface-elevated)', border: '1px solid var(--io-border)', borderRadius: 'var(--io-radius)', color: 'var(--io-text-primary)', fontSize: '13px', outline: 'none' }}
                />
              </label>
            </div>
          ))}

          <button
            onClick={addVar}
            style={{
              padding: '8px',
              background: 'none',
              border: '1px dashed var(--io-border)',
              borderRadius: 'var(--io-radius)',
              color: 'var(--io-text-muted)',
              cursor: 'pointer',
              fontSize: '13px',
              transition: 'border-color 0.1s, color 0.1s',
            }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--io-accent)'
              ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--io-accent)'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--io-border)'
              ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--io-text-muted)'
            }}
          >
            + Add Variable
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px',
            padding: '12px 16px',
            borderTop: '1px solid var(--io-border)',
            flexShrink: 0,
          }}
        >
          <button
            onClick={onClose}
            style={{ padding: '7px 16px', background: 'none', border: '1px solid var(--io-border)', borderRadius: 'var(--io-radius)', color: 'var(--io-text-secondary)', cursor: 'pointer', fontSize: '13px' }}
          >
            Cancel
          </button>
          <button
            onClick={() => { onSave(localVars); onClose() }}
            style={{ padding: '7px 16px', background: 'var(--io-accent)', border: 'none', borderRadius: 'var(--io-radius)', color: '#fff', cursor: 'pointer', fontSize: '13px', fontWeight: 600 }}
          >
            Save Variables
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// DashboardBuilder
// ---------------------------------------------------------------------------

function generateId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export default function DashboardBuilder() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isNew = !id

  const [name, setName] = useState('Untitled Dashboard')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [published, setPublished] = useState(false)
  const [widgets, setWidgets] = useState<WidgetConfig[]>([])
  const [variables, setVariables] = useState<DashboardVariable[]>([])
  const [selectedWidgetId, setSelectedWidgetId] = useState<string | null>(null)
  const [showVariablesModal, setShowVariablesModal] = useState(false)
  const [widgetCategory, setWidgetCategory] = useState('Charts')
  const [saveError, setSaveError] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  )

  // Load existing dashboard
  const query = useQuery({
    queryKey: ['dashboard', id],
    queryFn: async () => {
      if (!id) return null
      const result = await dashboardsApi.get(id)
      if (!result.success) throw new Error(result.error.message)
      return result.data
    },
    enabled: !!id,
  })

  useEffect(() => {
    const d = query.data as Dashboard | null
    if (!d) return
    setName(d.name)
    setDescription(d.description ?? '')
    setCategory(d.category ?? '')
    setPublished(d.published)
    setWidgets(d.widgets ?? [])
    setVariables(d.variables ?? [])
  }, [query.data])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        description: description || undefined,
        category: category || undefined,
        layout: {},
        widgets,
        variables,
        published,
      }

      if (isNew) {
        const result = await dashboardsApi.create(payload)
        if (!result.success) throw new Error(result.error.message)
        return result.data
      } else {
        const result = await dashboardsApi.update(id!, payload)
        if (!result.success) throw new Error(result.error.message)
        return result.data
      }
    },
    onSuccess: (data) => {
      void queryClient.invalidateQueries({ queryKey: ['dashboards'] })
      void queryClient.invalidateQueries({ queryKey: ['dashboard', id] })
      setSaveError(null)
      if (isNew && data) {
        navigate(`/dashboards/${data.id}`)
      }
    },
    onError: (err: Error) => {
      setSaveError(err.message)
    },
  })

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, delta } = event
    const widgetId = String(active.id)

    setWidgets((prev) =>
      prev.map((w) => {
        if (w.id !== widgetId) return w
        const colWidth = 1
        const rowHeight = 1
        const newX = Math.max(0, Math.min(11, w.x + Math.round(delta.x / (colWidth * 60))))
        const newY = Math.max(0, w.y + Math.round(delta.y / (rowHeight * 60)))
        return { ...w, x: newX, y: newY }
      }),
    )
  }, [])

  function addWidget(item: WidgetLibraryItem) {
    const newWidget: WidgetConfig = {
      id: generateId(),
      type: item.type,
      x: 0,
      y: Math.max(0, ...widgets.map((w) => w.y + w.h)),
      w: item.defaultSize.w,
      h: item.defaultSize.h,
      config: { ...item.defaultConfig },
    }
    setWidgets((prev) => [...prev, newWidget])
    setSelectedWidgetId(newWidget.id)
  }

  function updateWidget(updated: WidgetConfig) {
    setWidgets((prev) => prev.map((w) => (w.id === updated.id ? updated : w)))
  }

  function removeWidget(widgetId: string) {
    setWidgets((prev) => prev.filter((w) => w.id !== widgetId))
    if (selectedWidgetId === widgetId) setSelectedWidgetId(null)
  }

  const selectedWidget = widgets.find((w) => w.id === selectedWidgetId) ?? null
  const filteredLibraryItems = WIDGET_LIBRARY.filter((item) => item.category === widgetCategory)

  if (!isNew && query.isLoading) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--io-text-muted)', fontSize: '14px' }}>
        Loading dashboard...
      </div>
    )
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: 'var(--io-surface-primary)', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          height: '48px',
          flexShrink: 0,
          background: 'var(--io-surface)',
          borderBottom: '1px solid var(--io-border)',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--io-text-primary)',
              fontSize: '15px',
              fontWeight: 600,
              outline: 'none',
              padding: '4px 0',
              minWidth: '120px',
              maxWidth: '280px',
            }}
            placeholder="Dashboard name..."
          />
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description (optional)"
            style={{
              padding: '4px 8px',
              background: 'var(--io-surface-elevated)',
              border: '1px solid var(--io-border)',
              borderRadius: 'var(--io-radius)',
              color: 'var(--io-text-secondary)',
              fontSize: '12px',
              outline: 'none',
              maxWidth: '200px',
            }}
          />
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
          {saveError && (
            <span style={{ fontSize: '12px', color: 'var(--io-danger, #ef4444)' }}>
              {saveError}
            </span>
          )}

          <button
            onClick={() => setShowVariablesModal(true)}
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
            Variables ({variables.length})
          </button>

          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              color: 'var(--io-text-secondary)',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={published}
              onChange={(e) => setPublished(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            Published
          </label>

          <button
            onClick={() => navigate(isNew ? '/dashboards' : `/dashboards/${id}`)}
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
            Cancel
          </button>

          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            style={{
              padding: '5px 14px',
              background: 'var(--io-accent)',
              border: 'none',
              borderRadius: 'var(--io-radius)',
              color: '#fff',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: 600,
              opacity: saveMutation.isPending ? 0.7 : 1,
            }}
          >
            {saveMutation.isPending ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        {/* Left panel — widget library */}
        <div
          style={{
            width: '200px',
            flexShrink: 0,
            borderRight: '1px solid var(--io-border)',
            background: 'var(--io-surface-secondary)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div style={{ padding: '10px 10px 0', flexShrink: 0 }}>
            <span style={{ fontSize: '11px', color: 'var(--io-text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Widgets
            </span>
          </div>

          {/* Category tabs */}
          <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: '2px', flexShrink: 0 }}>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setWidgetCategory(cat)}
                style={{
                  padding: '6px 8px',
                  borderRadius: 'var(--io-radius)',
                  border: 'none',
                  textAlign: 'left',
                  fontSize: '12px',
                  fontWeight: widgetCategory === cat ? 600 : 400,
                  cursor: 'pointer',
                  background: widgetCategory === cat ? 'var(--io-accent-subtle)' : 'transparent',
                  color: widgetCategory === cat ? 'var(--io-accent)' : 'var(--io-text-secondary)',
                  transition: 'background 0.1s',
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Widget items */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 10px 10px' }}>
            {filteredLibraryItems.map((item) => (
              <button
                key={item.type}
                onClick={() => addWidget(item)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 10px',
                  background: 'var(--io-surface-elevated)',
                  border: '1px solid var(--io-border)',
                  borderRadius: 'var(--io-radius)',
                  cursor: 'pointer',
                  fontSize: '12px',
                  color: 'var(--io-text-secondary)',
                  marginBottom: '4px',
                  transition: 'border-color 0.1s',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => {
                  ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--io-accent)'
                  ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--io-text-primary)'
                }}
                onMouseLeave={(e) => {
                  ;(e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--io-border)'
                  ;(e.currentTarget as HTMLButtonElement).style.color = 'var(--io-text-secondary)'
                }}
              >
                <span style={{ fontSize: '16px' }}>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Center — grid canvas */}
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <div style={{ flex: 1, overflow: 'auto', padding: '12px' }}>
            <DroppableGrid>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(12, 1fr)',
                  gridAutoRows: '60px',
                  gap: '8px',
                  minHeight: '400px',
                  position: 'relative',
                }}
              >
                {widgets.map((widget) => (
                  <div
                    key={widget.id}
                    onClick={() => setSelectedWidgetId(widget.id)}
                    style={{
                      gridColumn: `${widget.x + 1} / span ${widget.w}`,
                      gridRow: `${widget.y + 1} / span ${widget.h}`,
                      outline:
                        selectedWidgetId === widget.id
                          ? '2px solid var(--io-accent)'
                          : '2px solid transparent',
                      borderRadius: 'var(--io-radius)',
                      cursor: 'pointer',
                    }}
                  >
                    <DraggableWidget widget={widget}>
                      <WidgetContainer
                        config={widget}
                        variables={{}}
                        editMode={true}
                        onEdit={(wid) => setSelectedWidgetId(wid)}
                        onRemove={removeWidget}
                      />
                    </DraggableWidget>
                  </div>
                ))}

                {widgets.length === 0 && (
                  <div
                    style={{
                      gridColumn: '1 / -1',
                      gridRow: '1 / span 4',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--io-text-muted)',
                      fontSize: '13px',
                      border: '1px dashed var(--io-border)',
                      borderRadius: 'var(--io-radius)',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <span style={{ fontSize: '32px', opacity: 0.3 }}>▦</span>
                    <span>Click a widget in the left panel to add it</span>
                  </div>
                )}
              </div>
            </DroppableGrid>
          </div>
        </DndContext>

        {/* Right panel — widget config */}
        {selectedWidget && (
          <WidgetConfigPanel
            widget={selectedWidget}
            onUpdate={updateWidget}
            onClose={() => setSelectedWidgetId(null)}
          />
        )}
      </div>

      {/* Variables modal */}
      {showVariablesModal && (
        <VariablesModal
          variables={variables}
          onSave={setVariables}
          onClose={() => setShowVariablesModal(false)}
        />
      )}
    </div>
  )
}
