/**
 * PromoteToShapeWizard.tsx
 *
 * 8-step wizard to promote selected elements into a full I/O equipment shape
 * with connection points, state handling, and value display anchors.
 *
 * Per spec: Designer → select elements → right-click → "Promote to Shape"
 */

import React, { useState, useRef } from 'react'
import { graphicsApi } from '../../../api/graphics'
import type { ConnectionPoint, TextZone, ValueAnchor } from '../../../store/designer/libraryStore'
import type { SceneNode } from '../../../shared/types/graphics'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Direction = 'left' | 'right' | 'up' | 'down'
type ConnectionType = 'process' | 'signal' | 'actuator' | 'electrical'

interface CPDraft extends ConnectionPoint {
  id: string
  x: number
  y: number
  direction: Direction
  type: ConnectionType
}

interface WizardState {
  // Step 1
  shapeIdPrefix: string
  displayName: string
  category: string
  newCategoryInput: string
  tags: string[]
  // Step 2
  boundingBoxConfirmed: boolean
  // Step 3
  connectionPoints: CPDraft[]
  // Step 4 — supported states + stateful element IDs
  supportedStates: string[]
  statefulElements: string[]
  // Step 5
  textZones: TextZone[]
  // Step 6
  valueAnchors: ValueAnchor[]
  // Step 7
  orientations: number[]
  mirrorable: boolean
}

const SHAPE_CATEGORIES = [
  'Valves', 'Pumps', 'Rotating', 'Heat Transfer',
  'Vessels', 'Separation', 'Instrumentation', 'Control', 'Custom',
]

const DIRECTIONS: Direction[] = ['left', 'right', 'up', 'down']
const CP_TYPES: ConnectionType[] = ['process', 'signal', 'actuator', 'electrical']

const STEP_TITLES = [
  'Name & Category',
  'Boundary & Sizing',
  'Connection Points',
  'Stateful Elements',
  'Text Zones',
  'Value Display Anchors',
  'Orientation & Mirror',
  'Preview & Save',
]

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PromoteToShapeWizardProps {
  selectedNodes: SceneNode[]
  onClose: () => void
  onSaved: (shapeId: string) => void
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PromoteToShapeWizard({ selectedNodes, onClose, onSaved }: PromoteToShapeWizardProps) {
  const [step, setStep] = useState(0)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [tagInput, setTagInput] = useState('')
  const [state, setState] = useState<WizardState>({
    shapeIdPrefix: '',
    displayName: '',
    category: 'Custom',
    newCategoryInput: '',
    tags: [],
    boundingBoxConfirmed: true,
    connectionPoints: [],
    supportedStates: ['normal'],
    statefulElements: [],
    textZones: [],
    valueAnchors: [],
    orientations: [0],
    mirrorable: false,
  })

  // SVG preview area ref for click interactions
  const svgPreviewRef = useRef<SVGSVGElement>(null)

  function updateState(patch: Partial<WizardState>) {
    setState(prev => ({ ...prev, ...patch }))
  }

  // Compute a simple bounding box for preview (48×48 viewBox)
  const VIEWBOX = '0 0 48 48'

  // ---------------------------------------------------------------------------
  // Step renderers
  // ---------------------------------------------------------------------------

  function renderStep0() {
    const allCategories = [...SHAPE_CATEGORIES, ...(state.newCategoryInput ? [state.newCategoryInput] : [])]
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Field label="Shape ID Prefix *">
          <input
            type="text"
            value={state.shapeIdPrefix}
            onChange={e => updateState({ shapeIdPrefix: e.target.value.replace(/\s+/g, '-').toLowerCase() })}
            placeholder="e.g., wet-gas-scrubber"
            style={inputStyle}
          />
          <span style={{ fontSize: 10, color: 'var(--io-text-muted)' }}>System appends .custom.&lt;id&gt; automatically</span>
        </Field>
        <Field label="Display Name *">
          <input
            type="text"
            value={state.displayName}
            onChange={e => {
              updateState({
                displayName: e.target.value,
                shapeIdPrefix: state.shapeIdPrefix || e.target.value.replace(/\s+/g, '-').toLowerCase(),
              })
            }}
            placeholder="Wet Gas Scrubber"
            style={inputStyle}
          />
        </Field>
        <Field label="Category">
          <select
            value={state.category}
            onChange={e => {
              if (e.target.value === '__new__') {
                updateState({ category: state.newCategoryInput || 'New Category' })
              } else {
                updateState({ category: e.target.value })
              }
            }}
            style={inputStyle}
          >
            {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
            <option value="__new__">New Category…</option>
          </select>
          {!SHAPE_CATEGORIES.includes(state.category) && (
            <input
              type="text"
              value={state.newCategoryInput}
              onChange={e => updateState({ newCategoryInput: e.target.value, category: e.target.value })}
              placeholder="New category name"
              style={{ ...inputStyle, marginTop: 4 }}
            />
          )}
        </Field>
        <Field label="Tags">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
            {state.tags.map((tag, i) => (
              <span key={i} style={{ background: 'var(--io-surface-elevated)', border: '1px solid var(--io-border)', borderRadius: 10, padding: '2px 8px', fontSize: 11, display: 'flex', alignItems: 'center', gap: 4 }}>
                {tag}
                <button onClick={() => updateState({ tags: state.tags.filter((_, j) => j !== i) })}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--io-text-muted)', fontSize: 12, padding: 0, lineHeight: 1 }}>×</button>
              </span>
            ))}
          </div>
          <input
            type="text"
            value={tagInput}
            onChange={e => setTagInput(e.target.value)}
            onKeyDown={e => {
              if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
                e.preventDefault()
                updateState({ tags: [...state.tags, tagInput.trim()] })
                setTagInput('')
              }
            }}
            placeholder="scrubber, gas, wash — press Enter to add"
            style={inputStyle}
          />
        </Field>
      </div>
    )
  }

  function renderStep1() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--io-text-secondary)', lineHeight: 1.5 }}>
          The selected elements will be normalized to a <strong>48×48 viewBox</strong>,
          matching the built-in shape library convention.
        </p>
        <div style={{ border: '1px solid var(--io-border)', borderRadius: 4, padding: 16, textAlign: 'center', background: 'var(--io-surface-elevated)' }}>
          <svg width="96" height="96" viewBox={VIEWBOX} style={{ border: '1px dashed var(--io-accent)', background: 'var(--io-surface)' }}>
            <rect x="8" y="8" width="32" height="32" fill="var(--io-accent)" fillOpacity="0.2" stroke="var(--io-accent)" strokeWidth="1" rx="2" />
            <text x="24" y="26" textAnchor="middle" fontSize="5" fill="var(--io-text-primary)">{selectedNodes.length} node{selectedNodes.length !== 1 ? 's' : ''}</text>
          </svg>
          <p style={{ margin: '8px 0 0', fontSize: 11, color: 'var(--io-text-muted)' }}>
            Elements: {selectedNodes.map(n => n.name || n.type).join(', ')}
          </p>
        </div>
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, cursor: 'pointer' }}>
          <input type="checkbox" checked={state.boundingBoxConfirmed}
            onChange={e => updateState({ boundingBoxConfirmed: e.target.checked })} />
          Bounding box looks correct — proceed with normalization
        </label>
      </div>
    )
  }

  function renderStep2() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--io-text-secondary)', lineHeight: 1.5 }}>
          Click on the shape preview to place connection points.
          Each point gets an ID, direction, and type.
        </p>
        <div style={{ display: 'flex', gap: 12 }}>
          <svg
            ref={svgPreviewRef}
            width="144" height="144" viewBox={VIEWBOX}
            style={{ border: '1px solid var(--io-border)', background: 'var(--io-surface-elevated)', cursor: 'crosshair', flexShrink: 0 }}
            onClick={e => {
              const rect = svgPreviewRef.current?.getBoundingClientRect()
              if (!rect) return
              const scale = 48 / rect.width
              const x = Math.round((e.clientX - rect.left) * scale)
              const y = Math.round((e.clientY - rect.top) * scale)
              const newCp: CPDraft = {
                id: `cp${state.connectionPoints.length + 1}`,
                x, y, direction: 'right', type: 'process', rotatesWithShape: true,
              }
              updateState({ connectionPoints: [...state.connectionPoints, newCp] })
            }}
          >
            <rect x="8" y="8" width="32" height="32" fill="var(--io-accent)" fillOpacity="0.1" stroke="var(--io-accent)" strokeWidth="1" rx="2"/>
            {state.connectionPoints.map((cp, i) => (
              <g key={i}>
                <circle cx={cp.x} cy={cp.y} r="2.5" fill="var(--io-accent)" stroke="white" strokeWidth="0.5" />
                <text x={cp.x + 3} y={cp.y - 1} fontSize="3" fill="var(--io-text-primary)">{cp.id}</text>
              </g>
            ))}
          </svg>
          <div style={{ flex: 1, overflow: 'auto', maxHeight: 160 }}>
            {state.connectionPoints.length === 0 && (
              <p style={{ fontSize: 11, color: 'var(--io-text-muted)', margin: 0 }}>
                Click the shape to add connection points.
              </p>
            )}
            {state.connectionPoints.map((cp, i) => (
              <div key={i} style={{ display: 'flex', gap: 4, marginBottom: 6, alignItems: 'center', fontSize: 11 }}>
                <input
                  value={cp.id} placeholder="id"
                  style={{ ...inputStyle, width: 60 }}
                  onChange={e => {
                    const pts = [...state.connectionPoints]
                    pts[i] = { ...pts[i], id: e.target.value }
                    updateState({ connectionPoints: pts })
                  }}
                />
                <select
                  value={cp.direction}
                  style={{ ...inputStyle, width: 64 }}
                  onChange={e => {
                    const pts = [...state.connectionPoints]
                    pts[i] = { ...pts[i], direction: e.target.value as Direction }
                    updateState({ connectionPoints: pts })
                  }}
                >
                  {DIRECTIONS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <select
                  value={cp.type}
                  style={{ ...inputStyle, width: 72 }}
                  onChange={e => {
                    const pts = [...state.connectionPoints]
                    pts[i] = { ...pts[i], type: e.target.value as ConnectionType }
                    updateState({ connectionPoints: pts })
                  }}
                >
                  {CP_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <button onClick={() => updateState({ connectionPoints: state.connectionPoints.filter((_, j) => j !== i) })}
                  style={{ background: 'none', border: 'none', color: 'var(--io-text-muted)', cursor: 'pointer', fontSize: 14, padding: '0 2px' }}>×</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  function renderStep3() {
    const ALL_STATES = ['normal', 'running', 'stopped', 'open', 'closed', 'transitioning', 'fault', 'manual', 'out_of_service']
    const STATE_LABELS: Record<string, string> = {
      normal: 'Normal', running: 'Running', stopped: 'Stopped', open: 'Open', closed: 'Closed',
      transitioning: 'Transitioning', fault: 'Fault', manual: 'Manual', out_of_service: 'Out of Service',
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--io-text-secondary)', lineHeight: 1.5, fontWeight: 500 }}>
            Supported operational states:
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {ALL_STATES.map(s => (
              <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: s === 'normal' ? 'default' : 'pointer', color: s === 'normal' ? 'var(--io-text-muted)' : 'var(--io-text-primary)' }}>
                <input
                  type="checkbox"
                  checked={state.supportedStates.includes(s)}
                  disabled={s === 'normal'}
                  onChange={e => {
                    if (s === 'normal') return
                    const states = e.target.checked
                      ? [...state.supportedStates, s]
                      : state.supportedStates.filter(st => st !== s)
                    updateState({ supportedStates: states })
                  }}
                />
                {STATE_LABELS[s]}
              </label>
            ))}
          </div>
        </div>
        <div>
          <p style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--io-text-secondary)', lineHeight: 1.5, fontWeight: 500 }}>
            Stateful SVG element IDs (receive <code>io-stateful</code> CSS class):
          </p>
          <p style={{ margin: '0 0 8px', fontSize: 11, color: 'var(--io-text-muted)' }}>
            Enter element IDs from your SVG (e.g., <code>body</code>, <code>fill-region</code>).
            If left empty, the shape is purely structural.
          </p>
          {state.statefulElements.map((el, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
              <input
                value={el}
                style={{ ...inputStyle, flex: 1 }}
                placeholder="SVG element ID"
                onChange={e => {
                  const els = [...state.statefulElements]
                  els[i] = e.target.value
                  updateState({ statefulElements: els })
                }}
              />
              <button onClick={() => updateState({ statefulElements: state.statefulElements.filter((_, j) => j !== i) })}
                style={{ background: 'none', border: 'none', color: 'var(--io-text-muted)', cursor: 'pointer', fontSize: 14 }}>×</button>
            </div>
          ))}
          <button
            onClick={() => updateState({ statefulElements: [...state.statefulElements, ''] })}
            style={addBtnStyle}
          >+ Add Element ID</button>
        </div>
      </div>
    )
  }

  function renderStep4() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--io-text-secondary)', lineHeight: 1.5 }}>
          Click on the shape preview to place text zone anchors (tag name / value label positions).
        </p>
        <div style={{ display: 'flex', gap: 12 }}>
          <svg
            width="144" height="144" viewBox={VIEWBOX}
            style={{ border: '1px solid var(--io-border)', background: 'var(--io-surface-elevated)', cursor: 'crosshair', flexShrink: 0 }}
            onClick={e => {
              const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
              const scale = 48 / rect.width
              const x = Math.round((e.clientX - rect.left) * scale)
              const y = Math.round((e.clientY - rect.top) * scale)
              const tz: TextZone = { id: `tz${state.textZones.length + 1}`, x, y, width: 40, anchor: 'middle', fontSize: 8 }
              updateState({ textZones: [...state.textZones, tz] })
            }}
          >
            <rect x="8" y="8" width="32" height="32" fill="var(--io-accent)" fillOpacity="0.1" stroke="var(--io-accent)" strokeWidth="1" rx="2"/>
            {state.textZones.map((tz, i) => (
              <g key={i}>
                <circle cx={tz.x ?? 24} cy={tz.y ?? 24} r="2" fill="var(--io-warning)" />
                <text x={(tz.x ?? 24) + 3} y={(tz.y ?? 24) - 1} fontSize="3" fill="var(--io-text-primary)">{tz.id}</text>
              </g>
            ))}
          </svg>
          <div style={{ flex: 1, fontSize: 11, color: 'var(--io-text-muted)' }}>
            {state.textZones.length === 0 && <p style={{ margin: 0 }}>Click to add text zones.</p>}
            {state.textZones.map((tz, i) => (
              <div key={i} style={{ marginBottom: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ color: 'var(--io-text-primary)' }}>{tz.id}</span>
                <span>({tz.x},{tz.y})</span>
                <button onClick={() => updateState({ textZones: state.textZones.filter((_, j) => j !== i) })}
                  style={{ background: 'none', border: 'none', color: 'var(--io-text-muted)', cursor: 'pointer', fontSize: 14 }}>×</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  function renderStep5() {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--io-text-secondary)', lineHeight: 1.5 }}>
          Click on the shape preview to place value display anchor positions (where Text Readouts,
          Analog Bars, and Alarm Indicators snap by default — "Quick Bind" positions).
        </p>
        <div style={{ display: 'flex', gap: 12 }}>
          <svg
            width="144" height="144" viewBox={VIEWBOX}
            style={{ border: '1px solid var(--io-border)', background: 'var(--io-surface-elevated)', cursor: 'crosshair', flexShrink: 0 }}
            onClick={e => {
              const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
              const nx = parseFloat(((e.clientX - rect.left) / rect.width).toFixed(2))
              const ny = parseFloat(((e.clientY - rect.top) / rect.height).toFixed(2))
              const va: ValueAnchor = { nx, ny }
              updateState({ valueAnchors: [...state.valueAnchors, va] })
            }}
          >
            <rect x="8" y="8" width="32" height="32" fill="var(--io-accent)" fillOpacity="0.1" stroke="var(--io-accent)" strokeWidth="1" rx="2"/>
            {state.valueAnchors.map((va, i) => {
              const px = (va.nx ?? 0.5) * 48
              const py = (va.ny ?? 0.5) * 48
              return (
                <g key={i}>
                  <rect x={px - 2} y={py - 1.5} width="4" height="3" fill="none" stroke="var(--io-success)" strokeWidth="0.7" />
                  <text x={px + 3} y={py - 0.5} fontSize="3" fill="var(--io-text-muted)">{i + 1}</text>
                </g>
              )
            })}
          </svg>
          <div style={{ flex: 1, fontSize: 11, color: 'var(--io-text-muted)' }}>
            {state.valueAnchors.length === 0 && <p style={{ margin: 0 }}>Click to add value anchors.</p>}
            {state.valueAnchors.map((va, i) => (
              <div key={i} style={{ marginBottom: 4, display: 'flex', gap: 4, alignItems: 'center' }}>
                <span style={{ color: 'var(--io-text-primary)' }}>Anchor {i + 1}</span>
                <span>({va.nx?.toFixed(2)}, {va.ny?.toFixed(2)})</span>
                <button onClick={() => updateState({ valueAnchors: state.valueAnchors.filter((_, j) => j !== i) })}
                  style={{ background: 'none', border: 'none', color: 'var(--io-text-muted)', cursor: 'pointer', fontSize: 14 }}>×</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  function renderStep6() {
    const allOrientations = [0, 90, 180, 270]
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Field label="Valid Orientations">
          <div style={{ display: 'flex', gap: 12 }}>
            {allOrientations.map(deg => (
              <label key={deg} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={state.orientations.includes(deg)}
                  onChange={e => {
                    const ors = e.target.checked
                      ? [...state.orientations, deg]
                      : state.orientations.filter(o => o !== deg)
                    if (ors.length === 0) return // must have at least one
                    updateState({ orientations: ors })
                  }}
                />
                {deg}°
              </label>
            ))}
          </div>
        </Field>
        <Field label="Mirror">
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
            <input type="checkbox" checked={state.mirrorable}
              onChange={e => updateState({ mirrorable: e.target.checked })} />
            Can be mirrored horizontally/vertically
          </label>
        </Field>
      </div>
    )
  }

  function renderStep7() {
    const shapeId = `${state.shapeIdPrefix}.custom`
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
          <SummaryRow label="Shape ID" value={shapeId} />
          <SummaryRow label="Display Name" value={state.displayName} />
          <SummaryRow label="Category" value={state.category} />
          <SummaryRow label="Orientations" value={state.orientations.map(o => o + '°').join(', ')} />
          <SummaryRow label="Connection Points" value={String(state.connectionPoints.length)} />
          <SummaryRow label="Text Zones" value={String(state.textZones.length)} />
          <SummaryRow label="Value Anchors" value={String(state.valueAnchors.length)} />
          <SummaryRow label="Mirrorable" value={state.mirrorable ? 'Yes' : 'No'} />
          <SummaryRow label="Supported States" value={state.supportedStates.join(', ')} />
          {state.tags.length > 0 && <SummaryRow label="Tags" value={state.tags.join(', ')} />}
        </div>
        <div style={{ marginTop: 8, padding: 12, background: 'var(--io-surface-elevated)', borderRadius: 4, border: '1px solid var(--io-border)', display: 'flex', justifyContent: 'center' }}>
          <svg width="120" height="120" viewBox={VIEWBOX} style={{ border: '1px dashed var(--io-accent)' }}>
            <rect x="8" y="8" width="32" height="32" fill="var(--io-accent)" fillOpacity="0.15" stroke="var(--io-accent)" strokeWidth="1" rx="2"/>
            {state.connectionPoints.map((cp, i) => (
              <circle key={i} cx={cp.x} cy={cp.y} r="2" fill="var(--io-accent)" />
            ))}
            {state.textZones.map((tz, i) => (
              <circle key={i} cx={tz.x ?? 24} cy={tz.y ?? 24} r="1.5" fill="var(--io-warning)" />
            ))}
            {state.valueAnchors.map((va, i) => (
              <rect key={i} x={(va.nx ?? 0.5) * 48 - 2} y={(va.ny ?? 0.5) * 48 - 1.5} width="4" height="3"
                fill="none" stroke="var(--io-success)" strokeWidth="0.7" />
            ))}
          </svg>
        </div>
        {error && (
          <div style={{ padding: '8px 10px', background: 'rgba(239,68,68,0.1)', border: '1px solid var(--io-alarm-high)', borderRadius: 4, color: 'var(--io-alarm-high)', fontSize: 12 }}>
            {error}
          </div>
        )}
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  function canAdvance(): boolean {
    if (step === 0) return state.shapeIdPrefix.trim().length > 0 && state.displayName.trim().length > 0
    if (step === 1) return state.boundingBoxConfirmed
    return true
  }

  async function handleFinish() {
    setSaving(true)
    setError(null)
    try {
      const sidecar = {
        id: `${state.shapeIdPrefix}.custom`,
        category: state.category,
        tags: state.tags,
        geometry: {
          viewBox: VIEWBOX,
          width: 48,
          height: 48,
          orientations: state.orientations,
          mirrorable: state.mirrorable,
        },
        connections: state.connectionPoints,
        textZones: state.textZones,
        valueAnchors: state.valueAnchors,
        supportedStates: state.supportedStates,
        statefulElements: state.statefulElements.filter(Boolean),
      }

      const result = await graphicsApi.createStencil({
        name: state.displayName,
        category: state.category,
        svgData: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${VIEWBOX}"><rect x="8" y="8" width="32" height="32" fill="var(--io-accent)" fill-opacity="0.2" stroke="var(--io-accent)" stroke-width="1" rx="2"/></svg>`,
        nodes: { type: 'shape', sidecar, nodes: selectedNodes },
      })
      if (!result.success) throw new Error(result.error.message)
      onSaved(result.data.data.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
      setSaving(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Step content
  // ---------------------------------------------------------------------------

  const stepRenderers = [
    renderStep0, renderStep1, renderStep2, renderStep3,
    renderStep4, renderStep5, renderStep6, renderStep7,
  ]

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000 }} onClick={onClose} />
      <div style={{
        position: 'fixed', left: '50%', top: '50%', transform: 'translate(-50%,-50%)',
        zIndex: 2001, background: 'var(--io-surface)', border: '1px solid var(--io-border)',
        borderRadius: 'var(--io-radius-lg)', boxShadow: 'var(--io-shadow-lg)',
        width: 480, maxHeight: '80vh', display: 'flex', flexDirection: 'column',
      }}>
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--io-border)', flexShrink: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--io-text-primary)' }}>
            Promote to Shape
          </div>
          <div style={{ fontSize: 11, color: 'var(--io-text-muted)', marginTop: 4 }}>
            Step {step + 1} of {STEP_TITLES.length}: {STEP_TITLES[step]}
          </div>
          {/* Step dots */}
          <div style={{ display: 'flex', gap: 4, marginTop: 10 }}>
            {STEP_TITLES.map((_, i) => (
              <div key={i} style={{
                width: 24, height: 3, borderRadius: 2,
                background: i === step ? 'var(--io-accent)' : i < step ? 'var(--io-accent-muted, #3b82f6)' : 'var(--io-border)',
              }} />
            ))}
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 20px', flex: 1, overflow: 'auto' }}>
          {stepRenderers[step]()}
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--io-border)', display: 'flex', justifyContent: 'flex-end', gap: 8, flexShrink: 0 }}>
          <button onClick={onClose} style={cancelBtnStyle}>Cancel</button>
          {step > 0 && (
            <button onClick={() => setStep(s => s - 1)} style={cancelBtnStyle}>Back</button>
          )}
          {step < STEP_TITLES.length - 1 ? (
            <button
              onClick={() => setStep(s => s + 1)}
              disabled={!canAdvance()}
              style={{ ...primaryBtnStyle, opacity: canAdvance() ? 1 : 0.5 }}
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={saving}
              style={{ ...primaryBtnStyle, opacity: saving ? 0.7 : 1 }}
            >
              {saving ? 'Saving…' : 'Save Shape'}
            </button>
          )}
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// Small helper components & styles
// ---------------------------------------------------------------------------

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ fontSize: 11, color: 'var(--io-text-secondary)', display: 'block', marginBottom: 4 }}>{label}</label>
      {children}
    </div>
  )
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ fontSize: 10, color: 'var(--io-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</span>
      <span style={{ fontSize: 12, color: 'var(--io-text-primary)' }}>{value || '—'}</span>
    </div>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 8px',
  background: 'var(--io-surface-elevated)',
  border: '1px solid var(--io-border)',
  borderRadius: 'var(--io-radius)',
  color: 'var(--io-text-primary)',
  fontSize: 12,
  boxSizing: 'border-box',
}

const addBtnStyle: React.CSSProperties = {
  fontSize: 11, padding: '4px 10px',
  background: 'var(--io-surface-elevated)',
  border: '1px solid var(--io-border)',
  borderRadius: 'var(--io-radius)', cursor: 'pointer',
  color: 'var(--io-text-primary)', alignSelf: 'flex-start',
}

const cancelBtnStyle: React.CSSProperties = {
  padding: '6px 14px',
  background: 'var(--io-surface-elevated)',
  border: '1px solid var(--io-border)',
  borderRadius: 'var(--io-radius)', cursor: 'pointer',
  fontSize: 13, color: 'var(--io-text-primary)',
}

const primaryBtnStyle: React.CSSProperties = {
  padding: '6px 14px',
  background: 'var(--io-accent)',
  border: 'none',
  borderRadius: 'var(--io-radius)', cursor: 'pointer',
  fontSize: 13, color: '#fff',
}
