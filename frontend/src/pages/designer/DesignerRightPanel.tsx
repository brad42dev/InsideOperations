/**
 * DesignerRightPanel.tsx
 *
 * Context-sensitive property panel.
 * Shows different fields depending on what is selected in the scene.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react'
import { useSceneStore, useHistoryStore, useLibraryStore } from '../../store/designer'
import type { NodeId } from '../../shared/types/graphics'
import type {
  SceneNode,
  SymbolInstance,
  TextBlock,
  Primitive,
  Pipe,
  DisplayElement,
  LayerDefinition,
  GraphicDocument,
  NavigationLink,
  ComposablePart,
  WidgetNode,
  WidgetConfig,
  DisplayElementType,
  DisplayElementConfig,
  TextReadoutConfig,
  AnalogBarConfig,
  FillGaugeConfig,
  SparklineConfig,
  DigitalStatusConfig,
  ImageNode,
  EmbeddedSvgNode,
  Group,
  Annotation,
  Stencil,
} from '../../shared/types/graphics'
import {
  ChangePropertyCommand,
  ChangeTextCommand,
  ChangeBindingCommand,
  ChangeStyleCommand,
  ChangeLayerPropertyCommand,
  ChangeNavigationLinkCommand,
  ChangeShapeVariantCommand,
  AddComposablePartCommand,
  RemoveComposablePartCommand,
  ChangeDisplayElementConfigCommand,
  ChangeWidgetConfigCommand,
  AlignNodesCommand,
  DistributeNodesCommand,
  DeleteNodesCommand,
  GroupNodesCommand,
  AddLayerCommand,
  RemoveLayerCommand,
} from '../../shared/graphics/commands'
import type { SceneCommand, AlignmentType } from '../../shared/graphics/commands'
import { PIPE_SERVICE_COLORS } from '../../shared/types/graphics'
import { pointsApi } from '../../api/points'

// ---------------------------------------------------------------------------
// PointResolutionIndicator — shows a yellow dot when a pointId is unresolved
// ---------------------------------------------------------------------------

function PointResolutionIndicator({ pointId }: { pointId: string | undefined }) {
  const [status, setStatus] = useState<'idle' | 'checking' | 'found' | 'notfound'>('idle')
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!pointId) { setStatus('idle'); return }
    setStatus('checking')
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      const result = await pointsApi.list({ search: pointId, limit: 1 }).catch(() => null)
      if (!result?.success) { setStatus('idle'); return }
      const exact = result.data.data.find(p => p.id === pointId || p.tagname === pointId)
      setStatus(exact ? 'found' : 'notfound')
    }, 400)
    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [pointId])

  if (status === 'idle' || !pointId) return null
  if (status === 'checking') return (
    <span title="Checking…" style={{ fontSize: 10, color: 'var(--io-text-muted)', marginLeft: 4 }}>…</span>
  )
  if (status === 'found') return (
    <span title="Tag resolved" style={{ fontSize: 10, color: '#22c55e', marginLeft: 4 }}>✓</span>
  )
  return (
    <span title="Tag not found — bindings with unresolved tags display N/C at runtime" style={{ fontSize: 10, color: '#facc15', marginLeft: 4 }}>⚠ not found</span>
  )
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface DesignerRightPanelProps {
  collapsed: boolean
  width: number
}

// ---------------------------------------------------------------------------
// Selection state — extend uiStore to track selectedIds
// ---------------------------------------------------------------------------

// We use a module-level set to track selection because uiStore doesn't have it.
// The canvas sets this via CustomEvents; we subscribe via a simple React state.
// If uiStore gains selectedIds, replace this.

// ---------------------------------------------------------------------------
// Find node by ID anywhere in the doc tree
// ---------------------------------------------------------------------------

function findNodeById(doc: GraphicDocument, id: NodeId): SceneNode | null {
  function search(nodes: SceneNode[]): SceneNode | null {
    for (const n of nodes) {
      if (n.id === id) return n
      if ('children' in n && Array.isArray(n.children)) {
        const found = search(n.children as SceneNode[])
        if (found) return found
      }
    }
    return null
  }
  return search(doc.children)
}

// ---------------------------------------------------------------------------
// Small helper components
// ---------------------------------------------------------------------------

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label style={{
      display: 'block',
      fontSize: 10,
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      color: 'var(--io-text-muted)',
      marginBottom: 3,
    }}>
      {children}
    </label>
  )
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '4px 7px',
  background: 'var(--io-surface)',
  border: '1px solid var(--io-border)',
  borderRadius: 'var(--io-radius)',
  color: 'var(--io-text-primary)',
  fontSize: 12,
  outline: 'none',
  boxSizing: 'border-box',
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <FieldLabel>{label}</FieldLabel>
      {children}
    </div>
  )
}

function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
}: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
}) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={e => {
        const v = parseFloat(e.target.value)
        if (!isNaN(v)) onChange(v)
      }}
      style={inputStyle}
    />
  )
}

function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      <input
        type="color"
        value={value.startsWith('#') ? value : '#6366f1'}
        onChange={e => onChange(e.target.value)}
        style={{
          width: 28,
          height: 28,
          padding: 2,
          background: 'var(--io-surface)',
          border: '1px solid var(--io-border)',
          borderRadius: 'var(--io-radius)',
          cursor: 'pointer',
          flexShrink: 0,
        }}
      />
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{ ...inputStyle, flex: 1 }}
      />
    </div>
  )
}

function SelectInput({
  value,
  onChange,
  options,
}: {
  value: string
  onChange: (v: string) => void
  options: Array<{ value: string; label: string }>
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        ...inputStyle,
        cursor: 'pointer',
      }}
    >
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

// ---------------------------------------------------------------------------
// Section header
// ---------------------------------------------------------------------------

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.07em',
      color: 'var(--io-text-muted)',
      padding: '10px 12px 4px',
      borderBottom: '1px solid var(--io-border)',
      marginBottom: 8,
      flexShrink: 0,
    }}>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// NavigationLinkEditor
// ---------------------------------------------------------------------------

function NavigationLinkEditor({
  nodeId,
  link,
  prevLink,
  executeCmd,
}: {
  nodeId: NodeId
  link: NavigationLink | undefined
  prevLink: NavigationLink | undefined
  executeCmd: (cmd: SceneCommand) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const hasLink = !!link?.targetGraphicId || !!link?.targetUrl

  return (
    <div style={{ marginBottom: 10 }}>
      <button
        onClick={() => setExpanded(e => !e)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'transparent',
          border: '1px solid var(--io-border)',
          borderRadius: 'var(--io-radius)',
          color: hasLink ? 'var(--io-accent)' : 'var(--io-text-secondary)',
          fontSize: 11,
          padding: '4px 8px',
          cursor: 'pointer',
          textAlign: 'left',
        }}
      >
        <span>Navigation Link {hasLink ? '(set)' : '(none)'}</span>
        <span style={{ fontSize: 9 }}>{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        <div style={{ marginTop: 6, padding: 8, background: 'var(--io-surface-elevated)', borderRadius: 'var(--io-radius)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div>
            <FieldLabel>Target Graphic ID</FieldLabel>
            <input
              type="text"
              defaultValue={link?.targetGraphicId ?? ''}
              onBlur={e => {
                const val = e.target.value.trim()
                const newLink = { ...link, targetGraphicId: val || undefined, targetUrl: undefined }
                executeCmd(new ChangeNavigationLinkCommand(nodeId, newLink, prevLink))
              }}
              style={inputStyle}
              placeholder="graphic-uuid"
            />
          </div>
          <div style={{ fontSize: 10, color: 'var(--io-text-muted)', textAlign: 'center' }}>— or —</div>
          <div>
            <FieldLabel>External URL</FieldLabel>
            <input
              type="text"
              defaultValue={link?.targetUrl ?? ''}
              onBlur={e => {
                const val = e.target.value.trim()
                const newLink = { ...link, targetUrl: val || undefined, targetGraphicId: undefined }
                executeCmd(new ChangeNavigationLinkCommand(nodeId, newLink, prevLink))
              }}
              style={inputStyle}
              placeholder="https://…"
            />
          </div>
          {hasLink && (
            <button
              onClick={() => executeCmd(new ChangeNavigationLinkCommand(nodeId, undefined, prevLink))}
              style={{ fontSize: 11, color: 'var(--io-text-muted)', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', padding: 0 }}
            >
              Clear link
            </button>
          )}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Hook: execute + push to history
// ---------------------------------------------------------------------------

function useExecuteCmd() {
  const doc     = useSceneStore(s => s.doc)
  const execute = useSceneStore(s => s.execute)
  const push    = useHistoryStore(s => s.push)

  return useCallback((cmd: SceneCommand) => {
    if (!doc) return
    const before = doc
    execute(cmd)
    push(cmd, before)
  }, [doc, execute, push])
}

// ---------------------------------------------------------------------------
// Document properties panel
// ---------------------------------------------------------------------------

function DocPropertiesPanel({ doc }: { doc: GraphicDocument }) {
  const executeCmd = useExecuteCmd()

  return (
    <div style={{ padding: '0 12px' }}>
      <Field label="Canvas Width">
        <NumberInput
          value={doc.canvas.width}
          min={100}
          onChange={v => executeCmd(new ChangePropertyCommand(doc.id, 'canvas', { ...doc.canvas, width: v }, doc.canvas))}
        />
      </Field>
      <Field label="Canvas Height">
        <NumberInput
          value={doc.canvas.height}
          min={100}
          onChange={v => executeCmd(new ChangePropertyCommand(doc.id, 'canvas', { ...doc.canvas, height: v }, doc.canvas))}
        />
      </Field>
      <Field label="Background Color">
        <ColorInput
          value={doc.canvas.backgroundColor}
          onChange={v => executeCmd(new ChangePropertyCommand(doc.id, 'canvas', { ...doc.canvas, backgroundColor: v }, doc.canvas))}
        />
      </Field>
      <Field label="Grid Size">
        <NumberInput
          value={doc.metadata.gridSize}
          min={1}
          max={128}
          onChange={v => executeCmd(new ChangePropertyCommand(doc.id, 'metadata', { ...doc.metadata, gridSize: v }, doc.metadata))}
        />
      </Field>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SymbolInstance panel
// ---------------------------------------------------------------------------

function SymbolInstancePanel({ node }: { node: SymbolInstance }) {
  const executeCmd = useExecuteCmd()
  const doc = useSceneStore(s => s.doc)
  const getShape = useLibraryStore(s => s.getShape)
  const shapeEntry = getShape(node.shapeRef.shapeId)
  const variants = shapeEntry?.sidecar.options ?? []

  return (
    <div style={{ padding: '0 12px' }}>
      <Field label="Shape">
        <input
          readOnly
          value={node.shapeRef.shapeId}
          style={{ ...inputStyle, color: 'var(--io-text-muted)' }}
        />
      </Field>

      {/* Variant picker */}
      {variants.length > 0 && (
        <Field label="Variant">
          <SelectInput
            value={node.shapeRef.variant ?? 'default'}
            onChange={v => executeCmd(new ChangeShapeVariantCommand(node.id, v, node.shapeRef.variant ?? 'default'))}
            options={[
              { value: 'default', label: 'Default' },
              ...variants.map(opt => ({ value: opt.id, label: opt.label })),
            ]}
          />
        </Field>
      )}

      {/* Composable parts */}
      {shapeEntry && shapeEntry.sidecar.options && shapeEntry.sidecar.options.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <FieldLabel>Composable Parts</FieldLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {node.composableParts.map((part: ComposablePart) => (
              <div key={part.partId} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--io-text-secondary)', flex: 1 }}>{part.partId}</span>
                <button
                  onClick={() => executeCmd(new RemoveComposablePartCommand(node.id, part.partId))}
                  style={{ fontSize: 10, color: 'var(--io-text-muted)', background: 'transparent', border: 'none', cursor: 'pointer' }}
                  title="Remove part"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              onClick={() => {
                const partId = crypto.randomUUID()
                executeCmd(new AddComposablePartCommand(node.id, { partId, attachment: 'default' }))
              }}
              style={{ fontSize: 11, color: 'var(--io-accent)', background: 'transparent', border: '1px dashed var(--io-border)', borderRadius: 'var(--io-radius)', padding: '3px 8px', cursor: 'pointer' }}
            >
              + Add Part
            </button>
          </div>
        </div>
      )}

      <Field label="Binding (Point ID)">
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input
            type="text"
            defaultValue={node.stateBinding?.pointId ?? ''}
            onBlur={e => {
              const val = e.target.value.trim()
              executeCmd(new ChangeBindingCommand(node.id, { pointId: val || undefined }, node.stateBinding ?? {}))
            }}
            style={{ ...inputStyle, flex: 1 }}
            placeholder="tag.point"
          />
          <PointResolutionIndicator pointId={node.stateBinding?.pointId} />
        </div>
      </Field>
      <Field label="X">
        <NumberInput
          value={Math.round(node.transform.position.x)}
          onChange={v => executeCmd(new ChangePropertyCommand(node.id, 'transform', {
            ...node.transform,
            position: { ...node.transform.position, x: v },
          }, node.transform))}
        />
      </Field>
      <Field label="Y">
        <NumberInput
          value={Math.round(node.transform.position.y)}
          onChange={v => executeCmd(new ChangePropertyCommand(node.id, 'transform', {
            ...node.transform,
            position: { ...node.transform.position, y: v },
          }, node.transform))}
        />
      </Field>
      <Field label="Rotation">
        <NumberInput
          value={Math.round(node.transform.rotation)}
          min={-360}
          max={360}
          onChange={v => executeCmd(new ChangePropertyCommand(node.id, 'transform', {
            ...node.transform, rotation: v,
          }, node.transform))}
        />
      </Field>
      <Field label="Opacity">
        <NumberInput
          value={Math.round(node.opacity * 100)}
          min={0}
          max={100}
          onChange={v => executeCmd(new ChangePropertyCommand(node.id, 'opacity', v / 100, node.opacity))}
        />
      </Field>
      {doc && (
        <Field label="Layer">
          <SelectInput
            value={node.layerId ?? ''}
            onChange={v => executeCmd(new ChangePropertyCommand(node.id, 'layerId', v || undefined, node.layerId))}
            options={[
              { value: '', label: '— None —' },
              ...doc.layers.map(l => ({ value: l.id, label: l.name })),
            ]}
          />
        </Field>
      )}
      <NavigationLinkEditor
        nodeId={node.id}
        link={node.navigationLink}
        prevLink={node.navigationLink}
        executeCmd={executeCmd}
      />

      {/* Text Zone Overrides — one row per zone defined in the sidecar */}
      {shapeEntry && (shapeEntry.sidecar.textZones ?? []).length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <FieldLabel>Text Zones</FieldLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {(shapeEntry.sidecar.textZones ?? []).map(zone => {
              const overrideVal = (node.textZoneOverrides as Record<string, string>)?.[zone.id] ?? ''
              return (
                <div key={zone.id} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ fontSize: 10, color: 'var(--io-text-muted)', minWidth: 52, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    title={zone.id}>{zone.id}</span>
                  <input
                    type="text"
                    defaultValue={overrideVal}
                    placeholder="(live data)"
                    onBlur={e => {
                      const v = e.target.value
                      const overrides = { ...(node.textZoneOverrides as Record<string, string> ?? {}) }
                      if (v) overrides[zone.id] = v
                      else delete overrides[zone.id]
                      executeCmd(new ChangePropertyCommand(node.id, 'textZoneOverrides', overrides, node.textZoneOverrides))
                    }}
                    style={{ ...inputStyle, flex: 1 }}
                  />
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Display Elements — list children, allow adding new ones */}
      <div style={{ marginBottom: 8 }}>
        <FieldLabel>Display Elements</FieldLabel>
        {node.children && node.children.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 4 }}>
            {node.children.map(child => {
              const de = child as import('../../shared/types/graphics').DisplayElement
              return (
                <div key={child.id} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--io-text-secondary)' }}>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {de.config?.displayType ?? child.type} — {de.binding?.pointId ?? 'Unbound'}
                  </span>
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ fontSize: 11, color: 'var(--io-text-muted)', marginBottom: 4 }}>No display elements</div>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// TextBlock panel
// ---------------------------------------------------------------------------

function TextBlockPanel({ node }: { node: TextBlock }) {
  const executeCmd = useExecuteCmd()
  const doc = useSceneStore(s => s.doc)
  const bg = node.background
  const [showBg, setShowBg] = useState(!!bg)

  return (
    <div style={{ padding: '0 12px' }}>
      <Field label="Content">
        <textarea
          defaultValue={node.content}
          onBlur={e => {
            const v = e.target.value
            if (v !== node.content) executeCmd(new ChangeTextCommand(node.id, v, node.content))
          }}
          rows={3}
          style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
        />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
        <Field label="Font Family">
          <SelectInput
            value={node.fontFamily}
            onChange={v => executeCmd(new ChangePropertyCommand(node.id, 'fontFamily', v, node.fontFamily))}
            options={[
              { value: 'Inter', label: 'Inter' },
              { value: 'JetBrains Mono', label: 'JetBrains Mono' },
            ]}
          />
        </Field>
        <Field label="Font Size">
          <NumberInput value={node.fontSize} min={6} max={256}
            onChange={v => executeCmd(new ChangePropertyCommand(node.id, 'fontSize', v, node.fontSize))} />
        </Field>
        <Field label="Weight">
          <SelectInput
            value={String(node.fontWeight)}
            onChange={v => executeCmd(new ChangePropertyCommand(node.id, 'fontWeight', parseInt(v), node.fontWeight))}
            options={[
              { value: '300', label: 'Light' },
              { value: '400', label: 'Regular' },
              { value: '500', label: 'Medium' },
              { value: '600', label: 'Semi-Bold' },
              { value: '700', label: 'Bold' },
            ]}
          />
        </Field>
        <Field label="Align">
          <SelectInput
            value={node.textAnchor}
            onChange={v => executeCmd(new ChangePropertyCommand(node.id, 'textAnchor', v, node.textAnchor))}
            options={[
              { value: 'start',  label: 'Left' },
              { value: 'middle', label: 'Center' },
              { value: 'end',    label: 'Right' },
            ]}
          />
        </Field>
      </div>
      <Field label="Color">
        <ColorInput value={node.fill}
          onChange={v => executeCmd(new ChangePropertyCommand(node.id, 'fill', v, node.fill))} />
      </Field>
      <Field label="Max Width (0=none)">
        <NumberInput value={node.maxWidth ?? 0} min={0} max={4000}
          onChange={v => executeCmd(new ChangePropertyCommand(node.id, 'maxWidth', v || undefined, node.maxWidth))} />
      </Field>

      {/* Background toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <input type="checkbox" id="tb-bg" checked={showBg} onChange={e => {
          setShowBg(e.target.checked)
          if (!e.target.checked) {
            executeCmd(new ChangePropertyCommand(node.id, 'background', undefined, node.background))
          } else {
            executeCmd(new ChangePropertyCommand(node.id, 'background', { fill: '#27272A', stroke: '#3F3F46', strokeWidth: 1, padding: 8, borderRadius: 2 }, node.background))
          }
        }} style={{ cursor: 'pointer' }} />
        <label htmlFor="tb-bg" style={{ fontSize: 11, color: 'var(--io-text-muted)', cursor: 'pointer' }}>Background</label>
      </div>
      {showBg && bg && (
        <div style={{ paddingLeft: 8, borderLeft: '2px solid var(--io-border)', marginBottom: 8 }}>
          <Field label="Fill">
            <ColorInput value={bg.fill}
              onChange={v => executeCmd(new ChangePropertyCommand(node.id, 'background', { ...bg, fill: v }, bg))} />
          </Field>
          <Field label="Border Color">
            <ColorInput value={bg.stroke}
              onChange={v => executeCmd(new ChangePropertyCommand(node.id, 'background', { ...bg, stroke: v }, bg))} />
          </Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <Field label="Padding">
              <NumberInput value={bg.padding} min={0} max={40}
                onChange={v => executeCmd(new ChangePropertyCommand(node.id, 'background', { ...bg, padding: v }, bg))} />
            </Field>
            <Field label="Radius">
              <NumberInput value={bg.borderRadius} min={0} max={20}
                onChange={v => executeCmd(new ChangePropertyCommand(node.id, 'background', { ...bg, borderRadius: v }, bg))} />
            </Field>
          </div>
        </div>
      )}

      <Field label="Opacity">
        <NumberInput value={Math.round(node.opacity * 100)} min={0} max={100}
          onChange={v => executeCmd(new ChangePropertyCommand(node.id, 'opacity', v / 100, node.opacity))} />
      </Field>
      {doc && (
        <Field label="Layer">
          <SelectInput
            value={node.layerId ?? ''}
            onChange={v => executeCmd(new ChangePropertyCommand(node.id, 'layerId', v || undefined, node.layerId))}
            options={[{ value: '', label: '— None —' }, ...doc.layers.map(l => ({ value: l.id, label: l.name }))]}
          />
        </Field>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Primitive panel
// ---------------------------------------------------------------------------

function PrimitivePanel({ node }: { node: Primitive }) {
  const executeCmd = useExecuteCmd()

  const style = node.style
  const pos = node.transform.position

  return (
    <div style={{ padding: '0 12px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 10 }}>
        <Field label="X">
          <NumberInput value={Math.round(pos.x)} onChange={v => executeCmd(new ChangePropertyCommand(node.id, 'transform', { ...node.transform, position: { ...pos, x: v } }, node.transform))} />
        </Field>
        <Field label="Y">
          <NumberInput value={Math.round(pos.y)} onChange={v => executeCmd(new ChangePropertyCommand(node.id, 'transform', { ...node.transform, position: { ...pos, y: v } }, node.transform))} />
        </Field>
        <Field label="Rotation">
          <NumberInput value={Math.round(node.transform.rotation)} min={-360} max={360}
            onChange={v => executeCmd(new ChangePropertyCommand(node.id, 'transform', { ...node.transform, rotation: v }, node.transform))} />
        </Field>
        <Field label="Opacity %">
          <NumberInput value={Math.round(node.opacity * 100)} min={0} max={100}
            onChange={v => executeCmd(new ChangePropertyCommand(node.id, 'opacity', v / 100, node.opacity))} />
        </Field>
      </div>
      <Field label="Fill">
        <ColorInput
          value={style.fill === 'none' ? '#000000' : style.fill}
          onChange={v => executeCmd(new ChangeStyleCommand(node.id, { ...style, fill: v }, style))}
        />
      </Field>
      <Field label="Fill Opacity %">
        <NumberInput value={Math.round(style.fillOpacity * 100)} min={0} max={100}
          onChange={v => executeCmd(new ChangeStyleCommand(node.id, { ...style, fillOpacity: v / 100 }, style))} />
      </Field>
      <Field label="Stroke">
        <ColorInput
          value={style.stroke === 'none' ? '#000000' : style.stroke}
          onChange={v => executeCmd(new ChangeStyleCommand(node.id, { ...style, stroke: v }, style))}
        />
      </Field>
      <Field label="Stroke Width">
        <NumberInput
          value={style.strokeWidth}
          min={0}
          step={0.5}
          onChange={v => executeCmd(new ChangeStyleCommand(node.id, { ...style, strokeWidth: v }, style))}
        />
      </Field>
      <Field label="Stroke Dash">
        <SelectInput
          value={style.strokeDasharray ?? ''}
          onChange={v => executeCmd(new ChangeStyleCommand(node.id, { ...style, strokeDasharray: v || undefined }, style))}
          options={[
            { value: '',       label: 'Solid' },
            { value: '4 2',    label: 'Dashed' },
            { value: '2 2',    label: 'Dotted' },
            { value: '8 4 2 4', label: 'Dash-Dot' },
          ]}
        />
      </Field>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Pipe panel
// ---------------------------------------------------------------------------

const PIPE_SERVICE_OPTIONS = Object.keys(PIPE_SERVICE_COLORS).map(k => ({
  value: k,
  label: k.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
}))

function PipePanel({ node }: { node: Pipe }) {
  const executeCmd = useExecuteCmd()

  return (
    <div style={{ padding: '0 12px' }}>
      <Field label="Service Type">
        <SelectInput
          value={node.serviceType}
          onChange={v => executeCmd(new ChangePropertyCommand(node.id, 'serviceType', v, node.serviceType))}
          options={PIPE_SERVICE_OPTIONS}
        />
      </Field>
      <Field label="Routing">
        <SelectInput
          value={node.routingMode}
          onChange={v => executeCmd(new ChangePropertyCommand(node.id, 'routingMode', v, node.routingMode))}
          options={[
            { value: 'manual', label: 'Manual' },
            { value: 'auto',   label: 'Auto (Orthogonal)' },
          ]}
        />
      </Field>
      {node.label !== undefined || true ? (
        <Field label="Label">
          <input
            type="text"
            defaultValue={node.label ?? ''}
            onBlur={e => executeCmd(new ChangePropertyCommand(node.id, 'label', e.target.value || undefined, node.label))}
            style={inputStyle}
            placeholder="Optional label…"
          />
        </Field>
      ) : null}
      <Field label="Stroke Width">
        <NumberInput
          value={node.strokeWidth}
          min={1}
          step={0.5}
          onChange={v => executeCmd(new ChangePropertyCommand(node.id, 'strokeWidth', v, node.strokeWidth))}
        />
      </Field>
      <Field label="Opacity">
        <NumberInput
          value={Math.round(node.opacity * 100)}
          min={0} max={100}
          onChange={v => executeCmd(new ChangePropertyCommand(node.id, 'opacity', v / 100, node.opacity))}
        />
      </Field>
      <Field label="Line Style">
        <SelectInput
          value={node.dashPattern ?? ''}
          onChange={v => executeCmd(new ChangePropertyCommand(node.id, 'dashPattern', v || undefined, node.dashPattern))}
          options={[
            { value: '',      label: 'Solid' },
            { value: '8 4',   label: 'Dashed' },
            { value: '2 4',   label: 'Dotted' },
            { value: '12 4 2 4', label: 'Dash-Dot' },
          ]}
        />
      </Field>
      <Field label="Insulated">
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12 }}>
          <input
            type="checkbox"
            checked={!!node.insulated}
            onChange={e => executeCmd(new ChangePropertyCommand(node.id, 'insulated', e.target.checked || undefined, node.insulated))}
          />
          <span style={{ color: 'var(--io-text-secondary)' }}>Show insulation indicator</span>
        </label>
      </Field>
    </div>
  )
}

// ---------------------------------------------------------------------------
// DisplayElement panel
// ---------------------------------------------------------------------------

const DISPLAY_ELEMENT_TYPE_OPTIONS: Array<{ value: DisplayElementType; label: string }> = [
  { value: 'text_readout',       label: 'Text Readout' },
  { value: 'analog_bar',         label: 'Analog Bar' },
  { value: 'fill_gauge',         label: 'Fill Gauge' },
  { value: 'sparkline',          label: 'Sparkline' },
  { value: 'alarm_indicator',    label: 'Alarm Indicator' },
  { value: 'digital_status',     label: 'Digital Status' },
]

/** Build a minimal valid default config for a given display element type */
function defaultConfig(type: DisplayElementType): DisplayElementConfig {
  switch (type) {
    case 'text_readout':       return { displayType: 'text_readout', showBox: false, showLabel: false, showUnits: false, valueFormat: '0.##', minWidth: 60 }
    case 'analog_bar':         return { displayType: 'analog_bar', orientation: 'vertical', barWidth: 20, barHeight: 80, rangeLo: 0, rangeHi: 100, showZoneLabels: false, showPointer: true, showSetpoint: false, showNumericReadout: false, showSignalLine: false }
    case 'fill_gauge':         return { displayType: 'fill_gauge', mode: 'standalone', fillDirection: 'up', rangeLo: 0, rangeHi: 100, showLevelLine: false, showValue: false, valueFormat: '0.#' }
    case 'sparkline':          return { displayType: 'sparkline', timeWindowMinutes: 60, scaleMode: 'auto', dataPoints: 60, width: 110, height: 18 }
    case 'alarm_indicator':    return { displayType: 'alarm_indicator', mode: 'single' }
    case 'digital_status':     return { displayType: 'digital_status', stateLabels: {}, normalStates: [], abnormalPriority: 3 }
  }
}

function DisplayElementTypeFields({ node, executeCmd }: { node: DisplayElement; executeCmd: (cmd: SceneCommand) => void }) {
  function patchConfig(patch: Partial<DisplayElementConfig>) {
    const newConfig = { ...node.config, ...patch } as DisplayElementConfig
    executeCmd(new ChangeDisplayElementConfigCommand(node.id, newConfig, node.config))
  }

  switch (node.displayType) {
    case 'text_readout': {
      const cfg = node.config as TextReadoutConfig
      return (
        <>
          <Field label="Value Format">
            <input type="text" defaultValue={cfg.valueFormat ?? '0.##'}
              onBlur={e => patchConfig({ valueFormat: e.target.value } as Partial<TextReadoutConfig>)}
              style={inputStyle} placeholder="0.##" />
          </Field>
          <Field label="Min Width">
            <NumberInput value={cfg.minWidth ?? 60} min={20} max={400}
              onChange={v => patchConfig({ minWidth: v } as Partial<TextReadoutConfig>)} />
          </Field>
          <Field label="Show Box">
            <input type="checkbox" checked={cfg.showBox}
              onChange={e => patchConfig({ showBox: e.target.checked } as Partial<TextReadoutConfig>)}
              style={{ cursor: 'pointer' }} />
          </Field>
          <Field label="Show Label">
            <input type="checkbox" checked={cfg.showLabel}
              onChange={e => patchConfig({ showLabel: e.target.checked } as Partial<TextReadoutConfig>)}
              style={{ cursor: 'pointer' }} />
          </Field>
          <Field label="Show Units">
            <input type="checkbox" checked={cfg.showUnits}
              onChange={e => patchConfig({ showUnits: e.target.checked } as Partial<TextReadoutConfig>)}
              style={{ cursor: 'pointer' }} />
          </Field>
        </>
      )
    }
    case 'analog_bar': {
      const cfg = node.config as AnalogBarConfig
      return (
        <>
          <Field label="Orientation">
            <SelectInput value={cfg.orientation}
              onChange={v => patchConfig({ orientation: v as 'vertical' | 'horizontal' } as Partial<AnalogBarConfig>)}
              options={[{ value: 'vertical', label: 'Vertical' }, { value: 'horizontal', label: 'Horizontal' }]} />
          </Field>
          <Field label="Range Low">
            <NumberInput value={cfg.rangeLo} step={0.1}
              onChange={v => patchConfig({ rangeLo: v } as Partial<AnalogBarConfig>)} />
          </Field>
          <Field label="Range High">
            <NumberInput value={cfg.rangeHi} step={0.1}
              onChange={v => patchConfig({ rangeHi: v } as Partial<AnalogBarConfig>)} />
          </Field>
          <Field label="Bar Width">
            <NumberInput value={cfg.barWidth} min={4} max={120}
              onChange={v => patchConfig({ barWidth: v } as Partial<AnalogBarConfig>)} />
          </Field>
          <Field label="Bar Height">
            <NumberInput value={cfg.barHeight} min={20} max={400}
              onChange={v => patchConfig({ barHeight: v } as Partial<AnalogBarConfig>)} />
          </Field>
          <Field label="Show Numeric Readout">
            <input type="checkbox" checked={cfg.showNumericReadout}
              onChange={e => patchConfig({ showNumericReadout: e.target.checked } as Partial<AnalogBarConfig>)}
              style={{ cursor: 'pointer' }} />
          </Field>
          <Field label="Show Pointer">
            <input type="checkbox" checked={cfg.showPointer}
              onChange={e => patchConfig({ showPointer: e.target.checked } as Partial<AnalogBarConfig>)}
              style={{ cursor: 'pointer' }} />
          </Field>
          <Field label="Show Setpoint">
            <input type="checkbox" checked={cfg.showSetpoint}
              onChange={e => patchConfig({ showSetpoint: e.target.checked } as Partial<AnalogBarConfig>)}
              style={{ cursor: 'pointer' }} />
          </Field>
          <Field label="Show Zone Labels">
            <input type="checkbox" checked={cfg.showZoneLabels}
              onChange={e => patchConfig({ showZoneLabels: e.target.checked } as Partial<AnalogBarConfig>)}
              style={{ cursor: 'pointer' }} />
          </Field>
          <div style={{ marginTop: 8, marginBottom: 4, fontSize: 10, fontWeight: 600, color: 'var(--io-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Thresholds
          </div>
          <Field label="HH">
            <NumberInput value={cfg.thresholds?.hh ?? NaN} step={0.1}
              onChange={v => patchConfig({ thresholds: { ...cfg.thresholds, hh: isNaN(v) ? undefined : v } } as Partial<AnalogBarConfig>)} />
          </Field>
          <Field label="H">
            <NumberInput value={cfg.thresholds?.h ?? NaN} step={0.1}
              onChange={v => patchConfig({ thresholds: { ...cfg.thresholds, h: isNaN(v) ? undefined : v } } as Partial<AnalogBarConfig>)} />
          </Field>
          <Field label="L">
            <NumberInput value={cfg.thresholds?.l ?? NaN} step={0.1}
              onChange={v => patchConfig({ thresholds: { ...cfg.thresholds, l: isNaN(v) ? undefined : v } } as Partial<AnalogBarConfig>)} />
          </Field>
          <Field label="LL">
            <NumberInput value={cfg.thresholds?.ll ?? NaN} step={0.1}
              onChange={v => patchConfig({ thresholds: { ...cfg.thresholds, ll: isNaN(v) ? undefined : v } } as Partial<AnalogBarConfig>)} />
          </Field>
        </>
      )
    }
    case 'fill_gauge': {
      const cfg = node.config as FillGaugeConfig
      return (
        <>
          <Field label="Fill Direction">
            <SelectInput value={cfg.fillDirection}
              onChange={v => patchConfig({ fillDirection: v as FillGaugeConfig['fillDirection'] } as Partial<FillGaugeConfig>)}
              options={[
                { value: 'up', label: 'Up' },
                { value: 'down', label: 'Down' },
                { value: 'left', label: 'Left' },
                { value: 'right', label: 'Right' },
              ]} />
          </Field>
          <Field label="Range Low">
            <NumberInput value={cfg.rangeLo} step={0.1}
              onChange={v => patchConfig({ rangeLo: v } as Partial<FillGaugeConfig>)} />
          </Field>
          <Field label="Range High">
            <NumberInput value={cfg.rangeHi} step={0.1}
              onChange={v => patchConfig({ rangeHi: v } as Partial<FillGaugeConfig>)} />
          </Field>
          <Field label="Show Value">
            <input type="checkbox" checked={cfg.showValue}
              onChange={e => patchConfig({ showValue: e.target.checked } as Partial<FillGaugeConfig>)}
              style={{ cursor: 'pointer' }} />
          </Field>
          <Field label="Value Format">
            <input type="text" defaultValue={cfg.valueFormat ?? '0.#'}
              onBlur={e => patchConfig({ valueFormat: e.target.value } as Partial<FillGaugeConfig>)}
              style={inputStyle} placeholder="0.#" />
          </Field>
        </>
      )
    }
    case 'sparkline': {
      const cfg = node.config as SparklineConfig
      return (
        <>
          <Field label="Time Window (min)">
            <NumberInput value={cfg.timeWindowMinutes} min={1} max={1440}
              onChange={v => patchConfig({ timeWindowMinutes: v } as Partial<SparklineConfig>)} />
          </Field>
          <Field label="Data Points">
            <NumberInput value={cfg.dataPoints} min={10} max={500}
              onChange={v => patchConfig({ dataPoints: v } as Partial<SparklineConfig>)} />
          </Field>
          <Field label="Scale Mode">
            <SelectInput value={cfg.scaleMode}
              onChange={v => patchConfig({ scaleMode: v as 'auto' | 'fixed' } as Partial<SparklineConfig>)}
              options={[{ value: 'auto', label: 'Auto' }, { value: 'fixed', label: 'Fixed' }]} />
          </Field>
        </>
      )
    }
    case 'digital_status': {
      const cfg = node.config as DigitalStatusConfig
      const stateEntries = Object.entries(cfg.stateLabels ?? {})
      return (
        <>
          <Field label="Abnormal Priority">
            <SelectInput value={String(cfg.abnormalPriority)}
              onChange={v => patchConfig({ abnormalPriority: parseInt(v) as 1|2|3|4|5 } as Partial<DigitalStatusConfig>)}
              options={[
                { value: '1', label: 'P1 — Critical' },
                { value: '2', label: 'P2 — High' },
                { value: '3', label: 'P3 — Medium' },
                { value: '4', label: 'P4 — Low' },
                { value: '5', label: 'P5 — Diagnostic' },
              ]} />
          </Field>
          <div style={{ marginTop: 8, marginBottom: 4, fontSize: 10, fontWeight: 600, color: 'var(--io-text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            State Labels
          </div>
          {stateEntries.map(([stateVal, stateLabel]) => (
            <div key={stateVal} style={{ display: 'flex', gap: 4, alignItems: 'center', marginBottom: 4 }}>
              <input
                defaultValue={stateVal}
                placeholder="Value"
                style={{ ...inputStyle, width: 60 }}
                onBlur={e => {
                  const newVal = e.target.value.trim()
                  if (!newVal || newVal === stateVal) return
                  const labels = { ...cfg.stateLabels }
                  const normals = [...(cfg.normalStates ?? [])]
                  const label = labels[stateVal]
                  delete labels[stateVal]
                  labels[newVal] = label
                  const normIdx = normals.indexOf(stateVal)
                  if (normIdx >= 0) { normals.splice(normIdx, 1); normals.push(newVal) }
                  patchConfig({ stateLabels: labels, normalStates: normals } as Partial<DigitalStatusConfig>)
                }}
              />
              <input
                defaultValue={stateLabel}
                placeholder="Label"
                style={{ ...inputStyle, flex: 1 }}
                onBlur={e => {
                  const labels = { ...cfg.stateLabels, [stateVal]: e.target.value }
                  patchConfig({ stateLabels: labels } as Partial<DigitalStatusConfig>)
                }}
              />
              <input
                type="checkbox"
                title="Normal state"
                checked={(cfg.normalStates ?? []).includes(stateVal)}
                onChange={e => {
                  const normals = [...(cfg.normalStates ?? [])]
                  if (e.target.checked) { if (!normals.includes(stateVal)) normals.push(stateVal) }
                  else { const i = normals.indexOf(stateVal); if (i >= 0) normals.splice(i, 1) }
                  patchConfig({ normalStates: normals } as Partial<DigitalStatusConfig>)
                }}
                style={{ cursor: 'pointer', flexShrink: 0 }}
              />
              <button
                title="Remove state"
                onClick={() => {
                  const labels = { ...cfg.stateLabels }
                  delete labels[stateVal]
                  const normals = (cfg.normalStates ?? []).filter(s => s !== stateVal)
                  patchConfig({ stateLabels: labels, normalStates: normals } as Partial<DigitalStatusConfig>)
                }}
                style={{ background: 'none', border: 'none', color: 'var(--io-text-secondary)', cursor: 'pointer', fontSize: 14, padding: '0 2px', lineHeight: 1 }}
              >×</button>
            </div>
          ))}
          <button
            onClick={() => {
              const labels = { ...cfg.stateLabels }
              const newKey = `state${Object.keys(labels).length}`
              labels[newKey] = newKey
              patchConfig({ stateLabels: labels } as Partial<DigitalStatusConfig>)
            }}
            style={{ marginTop: 4, fontSize: 11, padding: '3px 8px', background: 'var(--io-surface-raised)', border: '1px solid var(--io-border)', borderRadius: 3, cursor: 'pointer', color: 'var(--io-text-primary)' }}
          >+ Add State</button>
        </>
      )
    }
    case 'alarm_indicator':
    default:
      return null
  }
}

function DisplayElementPanel({ node }: { node: DisplayElement }) {
  const executeCmd = useExecuteCmd()

  return (
    <div style={{ padding: '0 12px' }}>
      <Field label="Type">
        <SelectInput
          value={node.displayType}
          onChange={v => {
            const newType = v as DisplayElementType
            if (newType !== node.displayType) {
              executeCmd(new ChangeDisplayElementConfigCommand(node.id, defaultConfig(newType), node.config))
            }
          }}
          options={DISPLAY_ELEMENT_TYPE_OPTIONS}
        />
      </Field>
      <Field label="Binding (Point ID)">
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <input
            type="text"
            defaultValue={node.binding.pointId ?? ''}
            onBlur={e => {
              const val = e.target.value.trim()
              executeCmd(new ChangeBindingCommand(node.id, { pointId: val || undefined }, node.binding))
            }}
            style={{ ...inputStyle, flex: 1 }}
            placeholder="tag.point"
          />
          <PointResolutionIndicator pointId={node.binding.pointId} />
        </div>
      </Field>
      <DisplayElementTypeFields node={node} executeCmd={executeCmd} />
      <Field label="Opacity">
        <NumberInput
          value={Math.round(node.opacity * 100)}
          min={0} max={100}
          onChange={v => executeCmd(new ChangePropertyCommand(node.id, 'opacity', v / 100, node.opacity))}
        />
      </Field>
      <NavigationLinkEditor
        nodeId={node.id}
        link={node.navigationLink}
        prevLink={node.navigationLink}
        executeCmd={executeCmd}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Widget panel
// ---------------------------------------------------------------------------

const WIDGET_TYPE_OPTIONS = [
  { value: 'trend',        label: 'Trend' },
  { value: 'table',        label: 'Table' },
  { value: 'gauge',        label: 'Gauge' },
  { value: 'kpi_card',     label: 'KPI Card' },
  { value: 'bar_chart',    label: 'Bar Chart' },
  { value: 'pie_chart',    label: 'Pie Chart' },
  { value: 'alarm_list',   label: 'Alarm List' },
  { value: 'muster_point', label: 'Muster Point' },
]

function WidgetPanel({ node }: { node: WidgetNode }) {
  const executeCmd = useExecuteCmd()

  function patchConfig(patch: Partial<WidgetConfig>) {
    const newConfig = { ...node.config, ...patch } as WidgetConfig
    executeCmd(new ChangeWidgetConfigCommand(node.id, newConfig, node.config))
  }

  const title = (node.config as { title?: string }).title ?? ''

  return (
    <div style={{ padding: '0 12px' }}>
      <Field label="Widget Type">
        <SelectInput
          value={node.widgetType}
          onChange={() => {/* type change not supported here — drag new widget */}}
          options={WIDGET_TYPE_OPTIONS}
        />
      </Field>
      <Field label="Title">
        <input
          type="text"
          defaultValue={title}
          onBlur={e => patchConfig({ title: e.target.value } as Partial<WidgetConfig>)}
          style={inputStyle}
          placeholder="Widget title…"
        />
      </Field>
      <Field label="Width">
        <NumberInput
          value={node.width}
          min={80} max={2000}
          onChange={v => executeCmd(new ChangePropertyCommand(node.id, 'width', v, node.width))}
        />
      </Field>
      <Field label="Height">
        <NumberInput
          value={node.height}
          min={60} max={1200}
          onChange={v => executeCmd(new ChangePropertyCommand(node.id, 'height', v, node.height))}
        />
      </Field>
      <Field label="Opacity">
        <NumberInput
          value={Math.round(node.opacity * 100)}
          min={0} max={100}
          onChange={v => executeCmd(new ChangePropertyCommand(node.id, 'opacity', v / 100, node.opacity))}
        />
      </Field>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ImageNode panel
// ---------------------------------------------------------------------------

function ImageNodePanel({ node }: { node: ImageNode }) {
  const executeCmd = useExecuteCmd()
  const pos = node.transform.position

  return (
    <div style={{ padding: '0 12px' }}>
      <Field label="Source">
        <input readOnly value={node.assetRef.originalFilename ?? node.assetRef.hash.slice(0, 12) + '…'}
          style={{ ...inputStyle, color: 'var(--io-text-muted)' }} />
      </Field>
      <Field label="Original Size">
        <input readOnly value={`${node.assetRef.originalWidth} × ${node.assetRef.originalHeight} px`}
          style={{ ...inputStyle, color: 'var(--io-text-muted)' }} />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
        <Field label="X">
          <NumberInput value={Math.round(pos.x)} onChange={v => executeCmd(new ChangePropertyCommand(node.id, 'transform', { ...node.transform, position: { ...pos, x: v } }, node.transform))} />
        </Field>
        <Field label="Y">
          <NumberInput value={Math.round(pos.y)} onChange={v => executeCmd(new ChangePropertyCommand(node.id, 'transform', { ...node.transform, position: { ...pos, y: v } }, node.transform))} />
        </Field>
        <Field label="Display W">
          <NumberInput value={node.displayWidth} min={1}
            onChange={v => executeCmd(new ChangePropertyCommand(node.id, 'displayWidth', v, node.displayWidth))} />
        </Field>
        <Field label="Display H">
          <NumberInput value={node.displayHeight} min={1}
            onChange={v => executeCmd(new ChangePropertyCommand(node.id, 'displayHeight', v, node.displayHeight))} />
        </Field>
      </div>
      <Field label="Preserve Aspect Ratio">
        <input type="checkbox" checked={node.preserveAspectRatio}
          onChange={e => executeCmd(new ChangePropertyCommand(node.id, 'preserveAspectRatio', e.target.checked, node.preserveAspectRatio))}
          style={{ cursor: 'pointer' }} />
      </Field>
      <Field label="Image Rendering">
        <SelectInput
          value={node.imageRendering}
          onChange={v => executeCmd(new ChangePropertyCommand(node.id, 'imageRendering', v, node.imageRendering))}
          options={[
            { value: 'auto',        label: 'Auto (Smooth)' },
            { value: 'pixelated',   label: 'Pixelated' },
            { value: 'crisp-edges', label: 'Crisp Edges' },
          ]}
        />
      </Field>
      <Field label="Opacity">
        <NumberInput value={Math.round(node.opacity * 100)} min={0} max={100}
          onChange={v => executeCmd(new ChangePropertyCommand(node.id, 'opacity', v / 100, node.opacity))} />
      </Field>
      <NavigationLinkEditor nodeId={node.id} link={node.navigationLink} prevLink={node.navigationLink} executeCmd={executeCmd} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// EmbeddedSvg panel
// ---------------------------------------------------------------------------

function EmbeddedSvgPanel({ node }: { node: EmbeddedSvgNode }) {
  const executeCmd = useExecuteCmd()
  const pos = node.transform.position

  return (
    <div style={{ padding: '0 12px' }}>
      {node.source && (
        <Field label="Source">
          <input readOnly value={node.source.importedFrom}
            style={{ ...inputStyle, color: 'var(--io-text-muted)' }} />
        </Field>
      )}
      <Field label="ViewBox">
        <input readOnly value={node.viewBox}
          style={{ ...inputStyle, color: 'var(--io-text-muted)', fontFamily: 'monospace', fontSize: 11 }} />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
        <Field label="X">
          <NumberInput value={Math.round(pos.x)} onChange={v => executeCmd(new ChangePropertyCommand(node.id, 'transform', { ...node.transform, position: { ...pos, x: v } }, node.transform))} />
        </Field>
        <Field label="Y">
          <NumberInput value={Math.round(pos.y)} onChange={v => executeCmd(new ChangePropertyCommand(node.id, 'transform', { ...node.transform, position: { ...pos, y: v } }, node.transform))} />
        </Field>
        <Field label="Width">
          <NumberInput value={node.width} min={1}
            onChange={v => executeCmd(new ChangePropertyCommand(node.id, 'width', v, node.width))} />
        </Field>
        <Field label="Height">
          <NumberInput value={node.height} min={1}
            onChange={v => executeCmd(new ChangePropertyCommand(node.id, 'height', v, node.height))} />
        </Field>
      </div>
      <Field label="Opacity">
        <NumberInput value={Math.round(node.opacity * 100)} min={0} max={100}
          onChange={v => executeCmd(new ChangePropertyCommand(node.id, 'opacity', v / 100, node.opacity))} />
      </Field>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Group panel
// ---------------------------------------------------------------------------

function GroupPanel({ node }: { node: Group }) {
  const executeCmd = useExecuteCmd()
  const doc = useSceneStore(s => s.doc)
  const pos = node.transform.position

  return (
    <div style={{ padding: '0 12px' }}>
      <Field label="Children">
        <input readOnly value={`${node.children.length} elements`}
          style={{ ...inputStyle, color: 'var(--io-text-muted)' }} />
      </Field>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 6 }}>
        <Field label="X">
          <NumberInput value={Math.round(pos.x)} onChange={v => executeCmd(new ChangePropertyCommand(node.id, 'transform', { ...node.transform, position: { ...pos, x: v } }, node.transform))} />
        </Field>
        <Field label="Y">
          <NumberInput value={Math.round(pos.y)} onChange={v => executeCmd(new ChangePropertyCommand(node.id, 'transform', { ...node.transform, position: { ...pos, y: v } }, node.transform))} />
        </Field>
      </div>
      <Field label="Opacity">
        <NumberInput value={Math.round(node.opacity * 100)} min={0} max={100}
          onChange={v => executeCmd(new ChangePropertyCommand(node.id, 'opacity', v / 100, node.opacity))} />
      </Field>
      {doc && (
        <Field label="Layer">
          <SelectInput
            value={node.layerId ?? ''}
            onChange={v => executeCmd(new ChangePropertyCommand(node.id, 'layerId', v || undefined, node.layerId))}
            options={[{ value: '', label: '— None —' }, ...doc.layers.map(l => ({ value: l.id, label: l.name }))]}
          />
        </Field>
      )}
      <NavigationLinkEditor nodeId={node.id} link={node.navigationLink} prevLink={node.navigationLink} executeCmd={executeCmd} />
    </div>
  )
}

// ---------------------------------------------------------------------------
// Annotation panel
// ---------------------------------------------------------------------------

function AnnotationPanel({ node }: { node: Annotation }) {
  const executeCmd = useExecuteCmd()
  const cfg = node.config as unknown as Record<string, unknown>

  return (
    <div style={{ padding: '0 12px' }}>
      <Field label="Type">
        <input readOnly value={node.annotationType.replace(/_/g, ' ')}
          style={{ ...inputStyle, color: 'var(--io-text-muted)', textTransform: 'capitalize' }} />
      </Field>
      {'width' in cfg && (
        <Field label="Width">
          <NumberInput value={cfg.width as number} min={1}
            onChange={v => executeCmd(new ChangePropertyCommand(node.id, 'config', { ...cfg, width: v }, cfg))} />
        </Field>
      )}
      {'height' in cfg && (
        <Field label="Height">
          <NumberInput value={cfg.height as number} min={1}
            onChange={v => executeCmd(new ChangePropertyCommand(node.id, 'config', { ...cfg, height: v }, cfg))} />
        </Field>
      )}
      {'color' in cfg && (
        <Field label="Color">
          <ColorInput value={cfg.color as string}
            onChange={v => executeCmd(new ChangePropertyCommand(node.id, 'config', { ...cfg, color: v }, cfg))} />
        </Field>
      )}
      {'content' in cfg && (
        <Field label="Content">
          <input type="text" defaultValue={cfg.content as string ?? ''}
            onBlur={e => executeCmd(new ChangePropertyCommand(node.id, 'config', { ...cfg, content: e.target.value }, cfg))}
            style={inputStyle} />
        </Field>
      )}
      {'text' in cfg && (
        <Field label="Text">
          <input type="text" defaultValue={cfg.text as string ?? ''}
            onBlur={e => executeCmd(new ChangePropertyCommand(node.id, 'config', { ...cfg, text: e.target.value }, cfg))}
            style={inputStyle} />
        </Field>
      )}
      <Field label="Opacity">
        <NumberInput value={Math.round(node.opacity * 100)} min={0} max={100}
          onChange={v => executeCmd(new ChangePropertyCommand(node.id, 'opacity', v / 100, node.opacity))} />
      </Field>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Stencil panel (§5.11)
// ---------------------------------------------------------------------------

function StencilPanel({ node }: { node: Stencil }) {
  const executeCmd = useExecuteCmd()
  return (
    <div style={{ padding: '0 12px' }}>
      <Field label="Stencil ID">
        <input readOnly value={node.stencilRef.stencilId}
          style={{ ...inputStyle, color: 'var(--io-text-muted)' }} />
      </Field>
      {node.stencilRef.version && (
        <Field label="Version">
          <input readOnly value={node.stencilRef.version}
            style={{ ...inputStyle, color: 'var(--io-text-muted)' }} />
        </Field>
      )}
      <Field label="X">
        <NumberInput value={Math.round(node.transform.position.x)}
          onChange={v => executeCmd(new ChangePropertyCommand(node.id, 'transform',
            { ...node.transform, position: { ...node.transform.position, x: v } },
            node.transform))} />
      </Field>
      <Field label="Y">
        <NumberInput value={Math.round(node.transform.position.y)}
          onChange={v => executeCmd(new ChangePropertyCommand(node.id, 'transform',
            { ...node.transform, position: { ...node.transform.position, y: v } },
            node.transform))} />
      </Field>
      {node.size && (
        <>
          <Field label="Width">
            <NumberInput value={node.size.width} min={1}
              onChange={v => executeCmd(new ChangePropertyCommand(node.id, 'size',
                { ...node.size, width: v }, node.size))} />
          </Field>
          <Field label="Height">
            <NumberInput value={node.size.height} min={1}
              onChange={v => executeCmd(new ChangePropertyCommand(node.id, 'size',
                { ...node.size, height: v }, node.size))} />
          </Field>
        </>
      )}
      <Field label="Opacity">
        <NumberInput value={Math.round(node.opacity * 100)} min={0} max={100}
          onChange={v => executeCmd(new ChangePropertyCommand(node.id, 'opacity', v / 100, node.opacity))} />
      </Field>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Multi-selection panel
// ---------------------------------------------------------------------------

const ALIGN_BUTTONS: Array<{ alignment: AlignmentType; label: string; title: string }> = [
  { alignment: 'left',     label: '⬤←', title: 'Align Left' },
  { alignment: 'center-h', label: '⬤↔', title: 'Align Center (H)' },
  { alignment: 'right',    label: '→⬤', title: 'Align Right' },
  { alignment: 'top',      label: '⬤↑', title: 'Align Top' },
  { alignment: 'center-v', label: '⬤↕', title: 'Align Middle (V)' },
  { alignment: 'bottom',   label: '↓⬤', title: 'Align Bottom' },
]

function MultiSelectionPanel({ ids }: { ids: NodeId[] }) {
  const executeCmd = useExecuteCmd()
  const doc = useSceneStore(s => s.doc)

  const btnBase: React.CSSProperties = {
    flex: 1, padding: '4px', fontSize: 11,
    border: '1px solid var(--io-border)', borderRadius: 'var(--io-radius)',
    background: 'var(--io-surface)', color: 'var(--io-text-secondary)',
    cursor: 'pointer',
  }

  return (
    <div style={{ padding: '0 12px' }}>
      <div style={{ fontSize: 12, color: 'var(--io-text-secondary)', marginBottom: 10 }}>
        {ids.length} items selected
      </div>

      {/* Alignment */}
      <div style={{ marginBottom: 8 }}>
        <FieldLabel>Align</FieldLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3, marginBottom: 3 }}>
          {ALIGN_BUTTONS.slice(0, 3).map(({ alignment, label, title }) => (
            <button key={alignment} title={title} style={btnBase}
              onClick={() => executeCmd(new AlignNodesCommand(ids, alignment))}>
              {label}
            </button>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 3 }}>
          {ALIGN_BUTTONS.slice(3).map(({ alignment, label, title }) => (
            <button key={alignment} title={title} style={btnBase}
              onClick={() => executeCmd(new AlignNodesCommand(ids, alignment))}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Distribution */}
      <div style={{ marginBottom: 10 }}>
        <FieldLabel>Distribute</FieldLabel>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
          <button title="Distribute Horizontally" style={btnBase}
            onClick={() => executeCmd(new DistributeNodesCommand(ids, 'horizontal'))}>
            ↔ Horizontal
          </button>
          <button title="Distribute Vertically" style={btnBase}
            onClick={() => executeCmd(new DistributeNodesCommand(ids, 'vertical'))}>
            ↕ Vertical
          </button>
        </div>
      </div>

      <Field label="Opacity (all)">
        <NumberInput
          value={100}
          min={0} max={100}
          onChange={v => {
            if (!doc) return
            for (const id of ids) {
              const node = findNodeById(doc, id)
              if (!node) continue
              executeCmd(new ChangePropertyCommand(id, 'opacity', v / 100, node.opacity))
            }
          }}
        />
      </Field>
      {doc && (
        <Field label="Layer (all)">
          <SelectInput
            value=""
            onChange={v => {
              if (!doc || !v) return
              for (const id of ids) {
                const node = findNodeById(doc, id)
                executeCmd(new ChangePropertyCommand(id, 'layerId', v, node?.layerId))
              }
            }}
            options={[{ value: '', label: '— Choose layer —' }, ...doc.layers.map(l => ({ value: l.id, label: l.name }))]}
          />
        </Field>
      )}

      {/* Bulk Display Configuration — only when all selected are display_element */}
      {(() => {
        if (!doc) return null
        const nodes = ids.map(id => findNodeById(doc, id)).filter(Boolean)
        const allDisplayElements = nodes.every(n => n?.type === 'display_element')
        if (!allDisplayElements || nodes.length === 0) return null
        const des = nodes as DisplayElement[]
        const allTextReadout = des.every(de => de.displayType === 'text_readout')

        return (
          <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--io-border)' }}>
            <FieldLabel>Bulk Display Config</FieldLabel>
            <Field label="Decimal precision (all)">
              <NumberInput
                value={NaN}
                min={0} max={6}
                step={1}
                onChange={v => {
                  if (isNaN(v)) return
                  for (const de of des) {
                    const fmt = `%.${Math.round(v)}f`
                    const newCfg = { ...de.config, valueFormat: fmt }
                    executeCmd(new ChangeDisplayElementConfigCommand(de.id, newCfg as typeof de.config, de.config))
                  }
                }}
              />
            </Field>
            {allTextReadout && (
              <Field label="Show background (all)">
                <input
                  type="checkbox"
                  defaultChecked={false}
                  onChange={e => {
                    for (const de of des) {
                      const cfg = de.config as TextReadoutConfig
                      const newCfg: TextReadoutConfig = { ...cfg, showBox: e.target.checked }
                      executeCmd(new ChangeDisplayElementConfigCommand(de.id, newCfg, de.config))
                    }
                  }}
                  style={{ cursor: 'pointer' }}
                />
              </Field>
            )}
            <Field label="Show label (all)">
              <input
                type="checkbox"
                defaultChecked={false}
                onChange={e => {
                  for (const de of des) {
                    const newCfg = { ...de.config, showLabel: e.target.checked }
                    executeCmd(new ChangeDisplayElementConfigCommand(de.id, newCfg as typeof de.config, de.config))
                  }
                }}
                style={{ cursor: 'pointer' }}
              />
            </Field>
          </div>
        )
      })()}

      {/* Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, marginTop: 8 }}>
        <button style={{ ...btnBase, flex: 'unset', color: 'var(--io-accent)' }}
          onClick={() => executeCmd(new GroupNodesCommand(ids))}>
          Group (Ctrl+G)
        </button>
        <button style={{ ...btnBase, flex: 'unset', color: 'var(--io-danger)' }}
          onClick={() => executeCmd(new DeleteNodesCommand(ids))}>
          Delete
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Layer properties panel
// ---------------------------------------------------------------------------

function LayerPropertiesPanel({ layer }: { layer: LayerDefinition }) {
  const executeCmd = useExecuteCmd()
  const [name, setName] = useState(layer.name)

  return (
    <div style={{ padding: '0 12px' }}>
      <Field label="Layer Name">
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onBlur={() => {
            const trimmed = name.trim()
            if (trimmed && trimmed !== layer.name) {
              executeCmd(new ChangeLayerPropertyCommand(layer.id, { name: trimmed }, { name: layer.name }))
            }
          }}
          style={inputStyle}
        />
      </Field>
      <Field label="Visible">
        <input
          type="checkbox"
          checked={layer.visible}
          onChange={e => executeCmd(new ChangeLayerPropertyCommand(layer.id, { visible: e.target.checked }, { visible: layer.visible }))}
          style={{ cursor: 'pointer' }}
        />
      </Field>
      <Field label="Locked">
        <input
          type="checkbox"
          checked={layer.locked}
          onChange={e => executeCmd(new ChangeLayerPropertyCommand(layer.id, { locked: e.target.checked }, { locked: layer.locked }))}
          style={{ cursor: 'pointer' }}
        />
      </Field>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Layers Panel — always visible at the bottom of the right panel (spec §15)
// ---------------------------------------------------------------------------

function LayersPanel() {
  const executeCmd = useExecuteCmd()
  const doc = useSceneStore(s => s.doc)
  const [collapsed, setCollapsed] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')
  const [layerCtx, setLayerCtx] = useState<{ x: number; y: number; layerId: string } | null>(null)

  if (!doc) return null

  // Layers ordered top→bottom display (highest order = frontmost)
  const layers = [...doc.layers].sort((a, b) => b.order - a.order)

  function handleToggleVisible(layer: LayerDefinition) {
    executeCmd(new ChangeLayerPropertyCommand(layer.id, { visible: !layer.visible }, { visible: layer.visible }))
  }
  function handleToggleLocked(layer: LayerDefinition) {
    executeCmd(new ChangeLayerPropertyCommand(layer.id, { locked: !layer.locked }, { locked: layer.locked }))
  }
  function handleRenameStart(layer: LayerDefinition) {
    setEditingId(layer.id); setEditName(layer.name)
  }
  function handleRenameCommit(layer: LayerDefinition) {
    const trimmed = editName.trim()
    if (trimmed && trimmed !== layer.name) {
      executeCmd(new ChangeLayerPropertyCommand(layer.id, { name: trimmed }, { name: layer.name }))
    }
    setEditingId(null)
  }
  function handleAddLayer() {
    if (!doc) return
    const maxOrder = doc.layers.reduce((m, l) => Math.max(m, l.order), 0)
    const n = doc.layers.length + 1
    executeCmd(new AddLayerCommand({
      id: crypto.randomUUID(),
      name: `Layer ${n}`,
      visible: true,
      locked: false,
      order: maxOrder + 1,
    }))
  }
  function handleDeleteLayer(layerId: string) {
    if (!doc || doc.layers.length <= 1) return
    executeCmd(new RemoveLayerCommand(layerId))
    setLayerCtx(null)
  }

  const iconBtn: React.CSSProperties = {
    background: 'none', border: 'none', cursor: 'pointer', padding: '0 2px',
    color: 'var(--io-text-secondary)', fontSize: 13, lineHeight: 1,
  }

  return (
    <div style={{ borderTop: '1px solid var(--io-border)', flexShrink: 0 }}>
      {/* Header */}
      <div
        style={{ display: 'flex', alignItems: 'center', padding: '6px 12px', cursor: 'pointer', userSelect: 'none' }}
        onClick={() => setCollapsed(v => !v)}
      >
        <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--io-text-secondary)', textTransform: 'uppercase', flex: 1 }}>
          Layers
        </span>
        <span style={{ fontSize: 11, color: 'var(--io-text-muted)' }}>{collapsed ? '▸' : '▾'}</span>
      </div>

      {!collapsed && (
        <div>
          {/* Layer rows */}
          {layers.map(layer => (
            <div
              key={layer.id}
              onContextMenu={e => { e.preventDefault(); setLayerCtx({ x: e.clientX, y: e.clientY, layerId: layer.id }) }}
              style={{
                display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px 3px 12px',
                fontSize: 12, color: layer.visible ? 'var(--io-text-primary)' : 'var(--io-text-muted)',
              }}
            >
              {/* Visibility toggle */}
              <button title={layer.visible ? 'Hide' : 'Show'} style={iconBtn} onClick={() => handleToggleVisible(layer)}>
                {layer.visible ? '👁' : '○'}
              </button>
              {/* Lock toggle */}
              <button title={layer.locked ? 'Unlock' : 'Lock'} style={iconBtn} onClick={() => handleToggleLocked(layer)}>
                {layer.locked ? '🔒' : '🔓'}
              </button>
              {/* Name — double-click to edit */}
              {editingId === layer.id ? (
                <input
                  autoFocus
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  onBlur={() => handleRenameCommit(layer)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleRenameCommit(layer)
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                  style={{ ...inputStyle, flex: 1, height: 20, fontSize: 12 }}
                />
              ) : (
                <span
                  style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'default' }}
                  onDoubleClick={() => handleRenameStart(layer)}
                >
                  {layer.name}
                </span>
              )}
            </div>
          ))}

          {/* Add layer */}
          <div style={{ padding: '4px 12px 6px' }}>
            <button
              onClick={handleAddLayer}
              style={{
                width: '100%', padding: '3px 0', fontSize: 11,
                border: '1px dashed var(--io-border)', borderRadius: 'var(--io-radius)',
                background: 'none', color: 'var(--io-text-secondary)', cursor: 'pointer',
              }}
            >
              + Add Layer
            </button>
          </div>
        </div>
      )}

      {/* Layer context menu */}
      {layerCtx && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 999 }} onMouseDown={() => setLayerCtx(null)} />
          <div style={{
            position: 'fixed', left: layerCtx.x, top: layerCtx.y, zIndex: 1000,
            background: 'var(--io-surface-elevated)', border: '1px solid var(--io-border)',
            borderRadius: 'var(--io-radius)', boxShadow: 'var(--io-shadow-lg)', padding: '4px 0', minWidth: 140,
          }}>
            {[
              {
                label: 'Delete Layer',
                disabled: doc.layers.length <= 1,
                onClick: () => handleDeleteLayer(layerCtx.layerId),
              },
              {
                label: 'Duplicate Layer',
                disabled: false,
                onClick: () => {
                  const orig = doc.layers.find(l => l.id === layerCtx.layerId)
                  if (!orig) return
                  const maxOrder = doc.layers.reduce((m, l) => Math.max(m, l.order), 0)
                  executeCmd(new AddLayerCommand({ ...orig, id: crypto.randomUUID(), name: orig.name + ' Copy', order: maxOrder + 1 }))
                  setLayerCtx(null)
                },
              },
            ].map(item => (
              <div
                key={item.label}
                style={{
                  padding: '5px 14px', fontSize: 12, cursor: item.disabled ? 'default' : 'pointer',
                  color: item.disabled ? 'var(--io-text-muted)' : (item.label === 'Delete Layer' ? 'var(--io-danger)' : 'var(--io-text-primary)'),
                }}
                onMouseEnter={e => { if (!item.disabled) (e.currentTarget as HTMLElement).style.background = 'var(--io-surface-elevated)' }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '' }}
                onClick={item.disabled ? undefined : item.onClick}
              >
                {item.label}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function DesignerRightPanel({ collapsed, width }: DesignerRightPanelProps) {
  const doc = useSceneStore(s => s.doc)

  // Selection is tracked via a simple local state updated from uiStore selectedIds
  // Since uiStore doesn't have selectedIds yet, we use a local state here
  // that is populated by CustomEvents from the canvas.
  const [selectedIds, setSelectedIds] = useState<NodeId[]>([])

  // Listen for selection events from DesignerCanvas
  React.useEffect(() => {
    const handler = (e: Event) => {
      const ce = e as CustomEvent<{ ids: NodeId[] }>
      setSelectedIds(ce.detail.ids)
    }
    document.addEventListener('io:selection-change', handler)
    return () => document.removeEventListener('io:selection-change', handler)
  }, [])

  if (collapsed) {
    return (
      <div style={{
        width,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--io-surface)',
        borderLeft: '1px solid var(--io-border)',
        alignItems: 'center',
        paddingTop: 8,
      }}>
        <div style={{ fontSize: 9, color: 'var(--io-text-muted)', writingMode: 'vertical-lr', transform: 'rotate(180deg)', userSelect: 'none' }}>
          PROPERTIES
        </div>
      </div>
    )
  }

  function renderContent() {
    if (!doc) {
      return (
        <div style={{ padding: 16, fontSize: 12, color: 'var(--io-text-muted)' }}>
          No document open
        </div>
      )
    }

    if (selectedIds.length === 0) {
      return (
        <>
          <SectionHeader>Document</SectionHeader>
          <DocPropertiesPanel doc={doc} />
        </>
      )
    }

    if (selectedIds.length > 1) {
      return (
        <>
          <SectionHeader>Selection ({selectedIds.length})</SectionHeader>
          <MultiSelectionPanel ids={selectedIds} />
        </>
      )
    }

    const nodeId = selectedIds[0]
    const node = findNodeById(doc, nodeId)

    if (!node) {
      // Check if it's a layer ID
      const layer = doc.layers.find(l => l.id === nodeId)
      if (layer) {
        return (
          <>
            <SectionHeader>Layer</SectionHeader>
            <LayerPropertiesPanel key={layer.id} layer={layer} />
          </>
        )
      }
      return (
        <div style={{ padding: 16, fontSize: 12, color: 'var(--io-text-muted)' }}>
          Selected item not found
        </div>
      )
    }

    switch (node.type) {
      case 'symbol_instance':
        return (
          <>
            <SectionHeader>Symbol</SectionHeader>
            <SymbolInstancePanel key={node.id} node={node as SymbolInstance} />
          </>
        )
      case 'text_block':
        return (
          <>
            <SectionHeader>Text</SectionHeader>
            <TextBlockPanel key={node.id} node={node as TextBlock} />
          </>
        )
      case 'primitive':
        return (
          <>
            <SectionHeader>Shape</SectionHeader>
            <PrimitivePanel key={node.id} node={node as Primitive} />
          </>
        )
      case 'pipe':
        return (
          <>
            <SectionHeader>Pipe</SectionHeader>
            <PipePanel key={node.id} node={node as Pipe} />
          </>
        )
      case 'display_element':
        return (
          <>
            <SectionHeader>Display Element</SectionHeader>
            <DisplayElementPanel key={node.id} node={node as DisplayElement} />
          </>
        )
      case 'widget':
        return (
          <>
            <SectionHeader>Widget</SectionHeader>
            <WidgetPanel key={node.id} node={node as WidgetNode} />
          </>
        )
      case 'image':
        return (
          <>
            <SectionHeader>Image</SectionHeader>
            <ImageNodePanel key={node.id} node={node as ImageNode} />
          </>
        )
      case 'embedded_svg':
        return (
          <>
            <SectionHeader>Embedded SVG</SectionHeader>
            <EmbeddedSvgPanel key={node.id} node={node as EmbeddedSvgNode} />
          </>
        )
      case 'group':
        return (
          <>
            <SectionHeader>Group</SectionHeader>
            <GroupPanel key={node.id} node={node as Group} />
          </>
        )
      case 'annotation':
        return (
          <>
            <SectionHeader>Annotation</SectionHeader>
            <AnnotationPanel key={node.id} node={node as Annotation} />
          </>
        )
      case 'stencil':
        return (
          <>
            <SectionHeader>Stencil</SectionHeader>
            <StencilPanel key={node.id} node={node as Stencil} />
          </>
        )
      default:
        return (
          <>
            <SectionHeader>{node.type.replace(/_/g, ' ')}</SectionHeader>
            <div style={{ padding: '0 12px' }}>
              <Field label="Opacity">
                <NumberInput
                  value={Math.round(node.opacity * 100)}
                  min={0} max={100}
                  onChange={_v => {}}
                />
              </Field>
            </div>
          </>
        )
    }
  }

  return (
    <div style={{
      width,
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--io-surface)',
      borderLeft: '1px solid var(--io-border)',
      overflow: 'hidden',
    }}>
      <div style={{ overflowY: 'auto', flex: 1 }}>
        {renderContent()}
      </div>
      {/* Layer panel — always visible at the bottom */}
      <LayersPanel />
    </div>
  )
}
