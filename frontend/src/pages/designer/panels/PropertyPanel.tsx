import React, { useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { pointsApi, type PointMeta } from '../../../api/points'
import type { GraphicBindings, ElementBinding, BindingAttribute, BindingMapping } from '../../../shared/types/graphics'
import type { DesignerMode } from '../types'

interface PropertyPanelProps {
  selectedIds: string[]
  svgRef: React.RefObject<SVGSVGElement | null>
  bindings: GraphicBindings
  onBindingsChange: (bindings: GraphicBindings) => void
  mode: DesignerMode
}

type Tab = 'style' | 'binding' | 'position'

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const panelStyle: React.CSSProperties = {
  width: '280px',
  flexShrink: 0,
  background: 'var(--io-surface-secondary)',
  borderLeft: '1px solid var(--io-border)',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
}

const emptyStateStyle: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '24px 16px',
  fontSize: '13px',
  color: 'var(--io-text-muted)',
  textAlign: 'center',
}

const tabBarStyle: React.CSSProperties = {
  display: 'flex',
  borderBottom: '1px solid var(--io-border)',
  flexShrink: 0,
}

const scrollAreaStyle: React.CSSProperties = {
  flex: 1,
  overflowY: 'auto',
  padding: '12px',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '11px',
  fontWeight: 500,
  color: 'var(--io-text-muted)',
  marginBottom: '4px',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  background: 'var(--io-surface-sunken)',
  border: '1px solid var(--io-border)',
  borderRadius: 'var(--io-radius)',
  color: 'var(--io-text-primary)',
  fontSize: '12px',
  outline: 'none',
  boxSizing: 'border-box',
}

const fieldGroupStyle: React.CSSProperties = {
  marginBottom: '12px',
}

const btnPrimaryStyle: React.CSSProperties = {
  padding: '6px 12px',
  background: 'var(--io-accent)',
  color: '#09090b',
  border: 'none',
  borderRadius: 'var(--io-radius)',
  fontSize: '12px',
  fontWeight: 600,
  cursor: 'pointer',
  width: '100%',
}

const btnDangerStyle: React.CSSProperties = {
  padding: '6px 12px',
  background: 'transparent',
  color: 'var(--io-danger)',
  border: '1px solid var(--io-danger)',
  borderRadius: 'var(--io-radius)',
  fontSize: '12px',
  cursor: 'pointer',
  width: '100%',
}

// ---------------------------------------------------------------------------
// Tab button
// ---------------------------------------------------------------------------
function TabBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        padding: '8px 4px',
        fontSize: '12px',
        fontWeight: active ? 600 : 400,
        background: 'transparent',
        border: 'none',
        borderBottom: active ? '2px solid var(--io-accent)' : '2px solid transparent',
        color: active ? 'var(--io-accent)' : 'var(--io-text-secondary)',
        cursor: 'pointer',
        transition: 'color 0.1s',
      }}
    >
      {label}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Style tab
// ---------------------------------------------------------------------------
function StyleTab() {
  return (
    <div style={scrollAreaStyle}>
      <div style={fieldGroupStyle}>
        <label style={labelStyle}>Fill Color</label>
        <input type="text" placeholder="#ffffff" style={inputStyle} />
      </div>
      <div style={fieldGroupStyle}>
        <label style={labelStyle}>Stroke Color</label>
        <input type="text" placeholder="#000000" style={inputStyle} />
      </div>
      <div style={fieldGroupStyle}>
        <label style={labelStyle}>Stroke Width</label>
        <input type="number" min={0} max={20} step={0.5} defaultValue={1} style={inputStyle} />
      </div>
      <div style={fieldGroupStyle}>
        <label style={labelStyle}>Opacity</label>
        <input type="range" min={0} max={1} step={0.01} defaultValue={1} style={{ width: '100%' }} />
      </div>
      <div style={fieldGroupStyle}>
        <label style={labelStyle}>Font Size</label>
        <input type="number" min={8} max={144} defaultValue={14} style={inputStyle} />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Position tab
// ---------------------------------------------------------------------------
function PositionTab({ elementId, svgRef }: { elementId: string; svgRef: React.RefObject<SVGSVGElement | null> }) {
  const [x, setX] = useState(0)
  const [y, setY] = useState(0)
  const [w, setW] = useState(100)
  const [h, setH] = useState(100)

  useEffect(() => {
    if (!svgRef.current || !elementId) return
    const el = svgRef.current.querySelector(`[data-id="${elementId}"]`)
    if (!el) return
    const bbox = (el as SVGGraphicsElement).getBBox?.()
    if (bbox) {
      setX(Math.round(bbox.x))
      setY(Math.round(bbox.y))
      setW(Math.round(bbox.width))
      setH(Math.round(bbox.height))
    }
  }, [elementId, svgRef])

  return (
    <div style={scrollAreaStyle}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
        {[
          { label: 'X', value: x, setter: setX },
          { label: 'Y', value: y, setter: setY },
          { label: 'W', value: w, setter: setW },
          { label: 'H', value: h, setter: setH },
        ].map(({ label, value, setter }) => (
          <div key={label} style={fieldGroupStyle}>
            <label style={labelStyle}>{label}</label>
            <input
              type="number"
              value={value}
              onChange={(e) => setter(Number(e.target.value))}
              style={inputStyle}
            />
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Binding tab
// ---------------------------------------------------------------------------
const BINDING_ATTRS: BindingAttribute[] = ['fill', 'stroke', 'text', 'opacity', 'visibility']
const MAPPING_TYPES = ['linear', 'threshold', 'text', 'visibility'] as const

function BindingTab({
  elementId,
  bindings,
  onBindingsChange,
}: {
  elementId: string
  bindings: GraphicBindings
  onBindingsChange: (b: GraphicBindings) => void
}) {
  const [search, setSearch] = useState('')
  const [selectedPoint, setSelectedPoint] = useState<PointMeta | null>(null)
  const [selectedAttr, setSelectedAttr] = useState<BindingAttribute>('fill')
  const [mappingType, setMappingType] = useState<'linear' | 'threshold' | 'text' | 'visibility'>('linear')
  const [showResults, setShowResults] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [debouncedQ, setDebouncedQ] = useState('')

  const existing: ElementBinding | undefined = bindings[elementId]

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedQ(search), 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [search])

  const pointsQuery = useQuery({
    queryKey: ['points-search', debouncedQ],
    queryFn: () => pointsApi.list({ search: debouncedQ, limit: 20 }),
    enabled: debouncedQ.length >= 2,
    staleTime: 30_000,
  })

  const results: PointMeta[] =
    pointsQuery.data?.success ? ((pointsQuery.data.data as unknown as PointMeta[]) ?? []) : []

  const buildMapping = (): BindingMapping => {
    if (mappingType === 'linear') {
      return { type: 'linear', min: 0, max: 100, color_scale: ['#22c55e', '#ef4444'] }
    }
    if (mappingType === 'threshold') {
      return { type: 'threshold', thresholds: [{ value: 50, color: '#ef4444' }], default_color: '#22c55e' }
    }
    if (mappingType === 'text') {
      return { type: 'text', decimal_places: 2 }
    }
    return { type: 'visibility', visible_when: 'nonzero' }
  }

  const handleBind = () => {
    if (!selectedPoint) return
    const updated: GraphicBindings = {
      ...bindings,
      [elementId]: {
        point_id: selectedPoint.id,
        attribute: selectedAttr,
        mapping: buildMapping(),
      },
    }
    onBindingsChange(updated)
    setSearch('')
    setSelectedPoint(null)
    setShowResults(false)
  }

  const handleUnbind = () => {
    const updated = { ...bindings }
    delete updated[elementId]
    onBindingsChange(updated)
  }

  return (
    <div style={scrollAreaStyle}>
      {existing && (
        <div
          style={{
            padding: '10px',
            background: 'var(--io-accent-subtle)',
            border: '1px solid var(--io-accent)',
            borderRadius: 'var(--io-radius)',
            marginBottom: '12px',
            fontSize: '12px',
            color: 'var(--io-text-primary)',
          }}
        >
          <div style={{ fontWeight: 600, marginBottom: '4px' }}>Bound</div>
          <div style={{ color: 'var(--io-text-secondary)' }}>
            Point ID: {existing.point_id}
          </div>
          <div style={{ color: 'var(--io-text-secondary)' }}>
            Attr: {existing.attribute} / {existing.mapping.type}
          </div>
          <button onClick={handleUnbind} style={{ ...btnDangerStyle, marginTop: '8px' }}>
            Unbind
          </button>
        </div>
      )}

      <div style={fieldGroupStyle}>
        <label style={labelStyle}>Search Points</label>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            placeholder="Type to search OPC points…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setShowResults(true)
              setSelectedPoint(null)
            }}
            onFocus={() => setShowResults(true)}
            onBlur={() => setTimeout(() => setShowResults(false), 200)}
            style={inputStyle}
          />
          {showResults && results.length > 0 && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                zIndex: 100,
                background: 'var(--io-surface-elevated)',
                border: '1px solid var(--io-border)',
                borderRadius: 'var(--io-radius)',
                maxHeight: '160px',
                overflowY: 'auto',
                marginTop: '2px',
              }}
            >
              {results.map((p) => (
                <div
                  key={p.id}
                  onMouseDown={() => {
                    setSelectedPoint(p)
                    setSearch(p.tagname)
                    setShowResults(false)
                  }}
                  style={{
                    padding: '6px 10px',
                    fontSize: '12px',
                    cursor: 'pointer',
                    color: 'var(--io-text-primary)',
                    borderBottom: '1px solid var(--io-border-subtle)',
                  }}
                  onMouseEnter={(e) => {
                    ;(e.currentTarget as HTMLElement).style.background =
                      'var(--io-accent-subtle)'
                  }}
                  onMouseLeave={(e) => {
                    ;(e.currentTarget as HTMLElement).style.background = 'transparent'
                  }}
                >
                  <div style={{ fontWeight: 500 }}>{p.tagname}</div>
                  {p.display_name && (
                    <div style={{ color: 'var(--io-text-muted)', fontSize: '11px' }}>
                      {p.display_name}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        {selectedPoint && (
          <div
            style={{
              marginTop: '4px',
              fontSize: '11px',
              color: 'var(--io-accent)',
            }}
          >
            Selected: {selectedPoint.tagname}
          </div>
        )}
      </div>

      <div style={fieldGroupStyle}>
        <label style={labelStyle}>Attribute</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {BINDING_ATTRS.map((attr) => (
            <button
              key={attr}
              onClick={() => setSelectedAttr(attr)}
              style={{
                padding: '3px 8px',
                fontSize: '11px',
                cursor: 'pointer',
                border: selectedAttr === attr ? '1px solid var(--io-accent)' : '1px solid var(--io-border)',
                borderRadius: 'var(--io-radius)',
                background: selectedAttr === attr ? 'var(--io-accent-subtle)' : 'transparent',
                color: selectedAttr === attr ? 'var(--io-accent)' : 'var(--io-text-secondary)',
              }}
            >
              {attr}
            </button>
          ))}
        </div>
      </div>

      <div style={fieldGroupStyle}>
        <label style={labelStyle}>Mapping Type</label>
        <select
          value={mappingType}
          onChange={(e) => setMappingType(e.target.value as typeof mappingType)}
          style={{ ...inputStyle }}
        >
          {MAPPING_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <button onClick={handleBind} disabled={!selectedPoint} style={btnPrimaryStyle}>
        Bind Point
      </button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export default function PropertyPanel({
  selectedIds,
  svgRef,
  bindings,
  onBindingsChange,
  mode,
}: PropertyPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('style')

  if (selectedIds.length === 0) {
    return (
      <div style={panelStyle}>
        <div style={emptyStateStyle}>Select an element to see properties</div>
      </div>
    )
  }

  const primaryId = selectedIds[0]
  const tabs: { id: Tab; label: string }[] = [
    { id: 'style', label: 'Style' },
    ...(mode === 'graphic' ? [{ id: 'binding' as Tab, label: 'Binding' }] : []),
    { id: 'position', label: 'Position' },
  ]

  return (
    <div style={panelStyle}>
      <div style={tabBarStyle}>
        {tabs.map((t) => (
          <TabBtn
            key={t.id}
            label={t.label}
            active={activeTab === t.id}
            onClick={() => setActiveTab(t.id)}
          />
        ))}
      </div>

      {activeTab === 'style' && <StyleTab />}
      {activeTab === 'binding' && mode === 'graphic' && (
        <BindingTab
          elementId={primaryId}
          bindings={bindings}
          onBindingsChange={onBindingsChange}
        />
      )}
      {activeTab === 'position' && (
        <PositionTab elementId={primaryId} svgRef={svgRef} />
      )}
    </div>
  )
}
