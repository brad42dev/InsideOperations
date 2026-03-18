/**
 * DesignerRightPanel.tsx
 *
 * Context-sensitive property panel.
 * Shows different fields depending on what is selected in the scene.
 */

import React, { useState, useCallback } from 'react'
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
} from '../../shared/graphics/commands'
import type { SceneCommand } from '../../shared/graphics/commands'
import { PIPE_SERVICE_COLORS } from '../../shared/types/graphics'

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
        <input
          type="text"
          defaultValue={node.stateBinding?.pointId ?? ''}
          onBlur={e => {
            const val = e.target.value.trim()
            executeCmd(new ChangeBindingCommand(node.id, { pointId: val || undefined }, node.stateBinding ?? {}))
          }}
          style={inputStyle}
          placeholder="tag.point"
        />
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
    </div>
  )
}

// ---------------------------------------------------------------------------
// TextBlock panel
// ---------------------------------------------------------------------------

function TextBlockPanel({ node }: { node: TextBlock }) {
  const executeCmd = useExecuteCmd()
  const doc = useSceneStore(s => s.doc)

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
          style={{
            ...inputStyle,
            resize: 'vertical',
            fontFamily: 'inherit',
          }}
        />
      </Field>
      <Field label="Font Size">
        <NumberInput
          value={node.fontSize}
          min={6}
          max={256}
          onChange={v => executeCmd(new ChangePropertyCommand(node.id, 'fontSize', v, node.fontSize))}
        />
      </Field>
      <Field label="Color">
        <ColorInput
          value={node.fill}
          onChange={v => executeCmd(new ChangePropertyCommand(node.id, 'fill', v, node.fill))}
        />
      </Field>
      <Field label="Font Weight">
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
      <Field label="Text Align">
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
      <Field label="Opacity">
        <NumberInput
          value={Math.round(node.opacity * 100)}
          min={0} max={100}
          onChange={v => executeCmd(new ChangePropertyCommand(node.id, 'opacity', v / 100, node.opacity))}
        />
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

  return (
    <div style={{ padding: '0 12px' }}>
      <Field label="Fill">
        <ColorInput
          value={style.fill === 'none' ? '#000000' : style.fill}
          onChange={v => executeCmd(new ChangeStyleCommand(node.id, { ...style, fill: v }, style))}
        />
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
    </div>
  )
}

// ---------------------------------------------------------------------------
// DisplayElement panel
// ---------------------------------------------------------------------------

import type { DisplayElementType, DisplayElementConfig } from '../../shared/types/graphics'

const DISPLAY_ELEMENT_TYPE_OPTIONS: Array<{ value: DisplayElementType; label: string }> = [
  { value: 'text_readout',       label: 'Text Readout' },
  { value: 'numeric_indicator',  label: 'Numeric Indicator' },
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
    case 'numeric_indicator':  return { displayType: 'numeric_indicator', fontSize: 24, decimalPlaces: 1, showUnit: true, showLabel: false, width: 100 }
    case 'analog_bar':         return { displayType: 'analog_bar', orientation: 'vertical', barWidth: 20, barHeight: 80, rangeLo: 0, rangeHi: 100, showZoneLabels: false, showPointer: true, showSetpoint: false, showNumericReadout: false, showSignalLine: false }
    case 'fill_gauge':         return { displayType: 'fill_gauge', mode: 'standalone', fillDirection: 'up', rangeLo: 0, rangeHi: 100, showLevelLine: false, showValue: false, valueFormat: '0.#' }
    case 'sparkline':          return { displayType: 'sparkline', timeWindowMinutes: 60, scaleMode: 'auto', dataPoints: 60, width: 110, height: 18 }
    case 'alarm_indicator':    return { displayType: 'alarm_indicator', mode: 'single' }
    case 'digital_status':     return { displayType: 'digital_status', stateLabels: {}, normalStates: [], abnormalPriority: 3 }
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
        <input
          type="text"
          defaultValue={node.binding.pointId ?? ''}
          onBlur={e => {
            const val = e.target.value.trim()
            executeCmd(new ChangeBindingCommand(node.id, { pointId: val || undefined }, node.binding))
          }}
          style={inputStyle}
          placeholder="tag.point"
        />
      </Field>
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
// Multi-selection panel
// ---------------------------------------------------------------------------

function MultiSelectionPanel({ ids }: { ids: NodeId[] }) {
  const executeCmd = useExecuteCmd()
  const doc = useSceneStore(s => s.doc)

  return (
    <div style={{ padding: '0 12px' }}>
      <div style={{ fontSize: 12, color: 'var(--io-text-secondary)', marginBottom: 12 }}>
        {ids.length} items selected
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
    </div>
  )
}
