import React, { useReducer, useRef, useState, useEffect } from 'react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ExpressionAst, ExpressionContext, ExpressionTile, TileType } from '../../types/expression'
import { evaluateExpression } from './evaluator'
import { expressionToString } from './preview'
import { tilesToAst } from './ast'
import { useAuthStore } from '../../../store/auth'
import { api } from '../../../api/client'
import type { PointMeta } from '../../../api/points'
import { showToast } from '../Toast'

// ---------------------------------------------------------------------------
// Palette definition
// ---------------------------------------------------------------------------

interface PaletteItem {
  type: TileType
  label: string
  group: string
}

const BASE_PALETTE: PaletteItem[] = [
  // Values
  { type: 'point_ref', label: 'Point Ref', group: 'Values' },
  { type: 'constant',  label: 'Enter Value', group: 'Values' },
  // Operators
  { type: 'add',      label: '+', group: 'Operators' },
  { type: 'subtract', label: '−', group: 'Operators' },
  { type: 'multiply', label: '×', group: 'Operators' },
  { type: 'divide',   label: '÷', group: 'Operators' },
  { type: 'modulus',  label: 'mod', group: 'Operators' },
  { type: 'power',    label: 'x^y', group: 'Operators' },
  // Functions
  { type: 'group',    label: '(…)', group: 'Functions' },
  { type: 'square',   label: 'x²', group: 'Functions' },
  { type: 'cube',     label: 'x³', group: 'Functions' },
  { type: 'round',    label: 'round', group: 'Functions' },
  { type: 'negate',   label: '−x', group: 'Functions' },
  { type: 'abs',      label: '|x|', group: 'Functions' },
  // Compare
  { type: 'gt',  label: '>',  group: 'Compare' },
  { type: 'lt',  label: '<',  group: 'Compare' },
  { type: 'gte', label: '≥',  group: 'Compare' },
  { type: 'lte', label: '≤',  group: 'Compare' },
]

const ALARM_EXTRA: PaletteItem[] = [
  { type: 'and', label: 'AND', group: 'Boolean' },
  { type: 'or',  label: 'OR',  group: 'Boolean' },
  { type: 'not', label: 'NOT', group: 'Boolean' },
  { type: 'if_then_else',   label: 'IF…THEN…ELSE', group: 'Control' },
  { type: 'time_now',       label: 'now()', group: 'Time' },
  { type: 'elapsed_since',  label: 'elapsed_since', group: 'Time' },
  { type: 'duration_above', label: 'duration_above', group: 'Time' },
  { type: 'duration_below', label: 'duration_below', group: 'Time' },
]

const WIDGET_EXTRA: PaletteItem[] = [
  { type: 'if_then_else', label: 'IF…THEN…ELSE', group: 'Control' },
  { type: 'agg_avg',   label: 'avg()', group: 'Aggregation' },
  { type: 'agg_sum',   label: 'sum()', group: 'Aggregation' },
  { type: 'agg_min',   label: 'min()', group: 'Aggregation' },
  { type: 'agg_max',   label: 'max()', group: 'Aggregation' },
  { type: 'agg_count', label: 'count()', group: 'Aggregation' },
]

const ROUNDS_EXTRA: PaletteItem[] = [
  { type: 'field_ref', label: 'Field Ref', group: 'Values' },
  { type: 'if_then_else', label: 'IF…THEN…ELSE', group: 'Control' },
]

const LOG_EXTRA: PaletteItem[] = [
  { type: 'field_ref', label: 'Field Ref', group: 'Values' },
  { type: 'if_then_else', label: 'IF…THEN…ELSE', group: 'Control' },
]

function getPaletteItems(context: ExpressionContext): PaletteItem[] {
  switch (context) {
    case 'alarm_definition':
      return [...BASE_PALETTE, ...ALARM_EXTRA]
    case 'widget':
      return [...BASE_PALETTE, ...WIDGET_EXTRA]
    case 'rounds_checkpoint':
      return [...BASE_PALETTE, ...ROUNDS_EXTRA]
    case 'log_segment':
      return [...BASE_PALETTE, ...LOG_EXTRA]
    default:
      return BASE_PALETTE
  }
}

// ---------------------------------------------------------------------------
// Tile color logic
// ---------------------------------------------------------------------------

function getTileColor(type: TileType): string {
  const operators = ['add', 'subtract', 'multiply', 'divide', 'modulus', 'power']
  const compares = ['gt', 'lt', 'gte', 'lte']
  const containers = ['group', 'square', 'cube', 'round', 'negate', 'abs']
  const booleans = ['and', 'or', 'not']
  const controlFlow = ['if_then_else']
  const aggregation = ['agg_avg', 'agg_sum', 'agg_min', 'agg_max', 'agg_count']
  const time = ['time_now', 'elapsed_since', 'duration_above', 'duration_below']

  if (type === 'point_ref' || type === 'field_ref' || type === 'constant') return '#2563eb'
  if (operators.includes(type)) return '#16a34a'
  if (compares.includes(type)) return '#d97706'
  if (booleans.includes(type)) return '#4f46e5'
  if (controlFlow.includes(type)) return '#7c3aed'
  if (containers.includes(type)) return '#b45309'
  if (aggregation.includes(type)) return '#0369a1'
  if (time.includes(type)) return '#0f766e'
  return '#52525b'
}

// Okabe-Ito colors for nesting levels
const NESTING_COLORS = ['#E69F00', '#56B4E9', '#009E73', '#F0E442', '#CC79A7']

function getNestingColor(depth: number): string {
  return NESTING_COLORS[depth % NESTING_COLORS.length]
}

// ---------------------------------------------------------------------------
// UUID helper
// ---------------------------------------------------------------------------

function newId(): string {
  return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)
}

// ---------------------------------------------------------------------------
// Nesting depth limit
// ---------------------------------------------------------------------------

const MAX_NESTING_DEPTH = 5

const CONTAINER_TILE_TYPES: TileType[] = [
  'group', 'square', 'cube', 'round', 'negate', 'abs', 'if_then_else',
]

/**
 * Returns the nesting depth of the tile identified by `targetId` within the
 * tile tree rooted at `tiles`. Top-level tiles have depth 0, tiles inside a
 * top-level container have depth 1, and so on.
 * Returns -1 if the tile is not found.
 */
function getTileDepth(tiles: ExpressionTile[], targetId: string, currentDepth = 0): number {
  for (const t of tiles) {
    if (t.id === targetId) return currentDepth
    for (const sub of [t.children, t.condition, t.thenBranch, t.elseBranch]) {
      if (!sub) continue
      const found = getTileDepth(sub, targetId, currentDepth + 1)
      if (found !== -1) return found
    }
  }
  return -1
}

// ---------------------------------------------------------------------------
// Factory: create a blank tile from palette
// ---------------------------------------------------------------------------

function createTile(type: TileType): ExpressionTile {
  const base: ExpressionTile = { id: newId(), type }
  switch (type) {
    case 'constant':
      return { ...base, value: 0 }
    case 'field_ref':
      return { ...base, fieldName: '' }
    case 'round':
      return { ...base, precision: 2, children: [] }
    case 'group':
    case 'square':
    case 'cube':
    case 'negate':
    case 'abs':
      return { ...base, children: [] }
    case 'if_then_else':
      return { ...base, condition: [], thenBranch: [], elseBranch: [] }
    default:
      return base
  }
}

// ---------------------------------------------------------------------------
// State / Reducer
// ---------------------------------------------------------------------------

interface ExprBuilderState {
  tiles: ExpressionTile[]
  // selection
  selectedIds: string[]
  // cursor position: { parentId: null = top-level, index }
  cursorParentId: string | null
  cursorIndex: number
  // name/desc/output config
  name: string
  description: string
  outputType: 'float' | 'integer'
  outputPrecision: number
  saveForFuture: boolean
  shareExpression: boolean
  // undo/redo stacks (store snapshots of tiles)
  past: ExpressionTile[][]
  future: ExpressionTile[][]
}

type Action =
  | { type: 'INSERT_TILE'; tile: ExpressionTile; parentId: string | null; index: number }
  | { type: 'MOVE_TILE'; fromParentId: string | null; fromIndex: number; toParentId: string | null; toIndex: number }
  | { type: 'DELETE_TILE'; id: string }
  | { type: 'UPDATE_TILE'; id: string; patch: Partial<ExpressionTile> }
  | { type: 'SET_CURSOR'; parentId: string | null; index: number }
  | { type: 'SELECT'; ids: string[]; additive: boolean }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'SET_NAME'; value: string }
  | { type: 'SET_DESC'; value: string }
  | { type: 'SET_OUTPUT_TYPE'; value: 'float' | 'integer' }
  | { type: 'SET_OUTPUT_PRECISION'; value: number }
  | { type: 'SET_SAVE_FUTURE'; value: boolean }
  | { type: 'SET_SHARE'; value: boolean }

const MAX_HISTORY = 50

function cloneTiles(tiles: ExpressionTile[]): ExpressionTile[] {
  return JSON.parse(JSON.stringify(tiles)) as ExpressionTile[]
}

// Find a tile by id in a tree and return the parent array + index
function findTileLocation(
  tiles: ExpressionTile[],
  id: string,
): { arr: ExpressionTile[]; index: number } | null {
  for (let i = 0; i < tiles.length; i++) {
    if (tiles[i].id === id) return { arr: tiles, index: i }
    const t = tiles[i]
    for (const sub of [t.children, t.condition, t.thenBranch, t.elseBranch]) {
      if (!sub) continue
      const found = findTileLocation(sub, id)
      if (found) return found
    }
  }
  return null
}

// Find all tile ids in a tree
function collectIds(tiles: ExpressionTile[]): string[] {
  const ids: string[] = []
  for (const t of tiles) {
    ids.push(t.id)
    for (const sub of [t.children, t.condition, t.thenBranch, t.elseBranch]) {
      if (sub) ids.push(...collectIds(sub))
    }
  }
  return ids
}

// Get child array by parentId (null = top-level)
function getChildArray(
  tiles: ExpressionTile[],
  parentId: string | null,
): ExpressionTile[] | null {
  if (parentId === null) return tiles
  const loc = findTileLocation(tiles, parentId)
  if (!loc) return null
  const parent = loc.arr[loc.index]
  // Return the first available child array for container tiles
  return parent.children ?? parent.condition ?? null
}

function exprReducer(state: ExprBuilderState, action: Action): ExprBuilderState {
  switch (action.type) {
    case 'SET_NAME':   return { ...state, name: action.value }
    case 'SET_DESC':   return { ...state, description: action.value }
    case 'SET_OUTPUT_TYPE': return { ...state, outputType: action.value }
    case 'SET_OUTPUT_PRECISION': return { ...state, outputPrecision: action.value }
    case 'SET_SAVE_FUTURE': return { ...state, saveForFuture: action.value }
    case 'SET_SHARE':  return { ...state, shareExpression: action.value }

    case 'SET_CURSOR':
      return { ...state, cursorParentId: action.parentId, cursorIndex: action.index }

    case 'SELECT':
      return {
        ...state,
        selectedIds: action.additive
          ? [...new Set([...state.selectedIds, ...action.ids])]
          : action.ids,
      }

    case 'INSERT_TILE': {
      const newTiles = cloneTiles(state.tiles)
      const arr = getChildArray(newTiles, action.parentId)
      if (!arr) return state
      arr.splice(action.index, 0, action.tile)
      return {
        ...state,
        tiles: newTiles,
        past: [cloneTiles(state.tiles), ...state.past].slice(0, MAX_HISTORY),
        future: [],
        cursorParentId: action.parentId,
        cursorIndex: action.index + 1,
      }
    }

    case 'MOVE_TILE': {
      const newTiles = cloneTiles(state.tiles)
      const srcArr = getChildArray(newTiles, action.fromParentId)
      if (!srcArr) return state
      const [tile] = srcArr.splice(action.fromIndex, 1)
      const dstArr = getChildArray(newTiles, action.toParentId)
      if (!dstArr) return state
      const toIndex = action.toIndex > srcArr.length ? dstArr.length : action.toIndex
      dstArr.splice(toIndex, 0, tile)
      return {
        ...state,
        tiles: newTiles,
        past: [cloneTiles(state.tiles), ...state.past].slice(0, MAX_HISTORY),
        future: [],
      }
    }

    case 'DELETE_TILE': {
      const newTiles = cloneTiles(state.tiles)
      const loc = findTileLocation(newTiles, action.id)
      if (!loc) return state
      loc.arr.splice(loc.index, 1)
      return {
        ...state,
        tiles: newTiles,
        selectedIds: state.selectedIds.filter((id) => id !== action.id),
        past: [cloneTiles(state.tiles), ...state.past].slice(0, MAX_HISTORY),
        future: [],
      }
    }

    case 'UPDATE_TILE': {
      const newTiles = cloneTiles(state.tiles)
      const loc = findTileLocation(newTiles, action.id)
      if (!loc) return state
      loc.arr[loc.index] = { ...loc.arr[loc.index], ...action.patch }
      return {
        ...state,
        tiles: newTiles,
        past: [cloneTiles(state.tiles), ...state.past].slice(0, MAX_HISTORY),
        future: [],
      }
    }

    case 'UNDO': {
      if (state.past.length === 0) return state
      const [prev, ...rest] = state.past
      return {
        ...state,
        tiles: prev,
        past: rest,
        future: [cloneTiles(state.tiles), ...state.future].slice(0, MAX_HISTORY),
      }
    }

    case 'REDO': {
      if (state.future.length === 0) return state
      const [next, ...rest] = state.future
      return {
        ...state,
        tiles: next,
        past: [cloneTiles(state.tiles), ...state.past].slice(0, MAX_HISTORY),
        future: rest,
      }
    }

    default:
      return state
  }
}

// ---------------------------------------------------------------------------
// Point search popover
// ---------------------------------------------------------------------------

interface PointSearchPopoverProps {
  onSelect: (point: PointMeta) => void
  onClose: () => void
}

function PointSearchPopover({ onSelect, onClose }: PointSearchPopoverProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PointMeta[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (query.length < 1) {
      setResults([])
      return
    }
    setLoading(true)
    const timeout = setTimeout(async () => {
      const res = await api.get<{ data: PointMeta[] }>(`/api/points?q=${encodeURIComponent(query)}&limit=20`)
      setLoading(false)
      if (res.success) {
        setResults((res.data as unknown as PointMeta[]) ?? [])
      }
    }, 250)
    return () => clearTimeout(timeout)
  }, [query])

  return (
    <div
      style={{
        position: 'absolute',
        top: '100%',
        left: 0,
        zIndex: 200,
        background: 'var(--io-surface-elevated)',
        border: '1px solid var(--io-border)',
        borderRadius: 'var(--io-radius)',
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        width: '280px',
        padding: '8px',
      }}
    >
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search points..."
        style={{
          width: '100%',
          padding: '7px 10px',
          background: 'var(--io-surface-sunken)',
          border: '1px solid var(--io-border)',
          borderRadius: 'var(--io-radius)',
          color: 'var(--io-text-primary)',
          fontSize: '13px',
          outline: 'none',
          boxSizing: 'border-box',
        }}
      />
      {loading && (
        <div style={{ padding: '8px', fontSize: '12px', color: 'var(--io-text-muted)' }}>
          Searching…
        </div>
      )}
      <div style={{ maxHeight: '200px', overflowY: 'auto', marginTop: '4px' }}>
        {results.map((p) => (
          <div
            key={p.id}
            onClick={() => onSelect(p)}
            style={{
              padding: '6px 8px',
              borderRadius: 'var(--io-radius)',
              cursor: 'pointer',
              fontSize: '13px',
              color: 'var(--io-text-primary)',
            }}
            onMouseEnter={(e) => {
              ;(e.currentTarget as HTMLDivElement).style.background = 'var(--io-surface-secondary)'
            }}
            onMouseLeave={(e) => {
              ;(e.currentTarget as HTMLDivElement).style.background = 'transparent'
            }}
          >
            <div style={{ fontWeight: 500 }}>{p.tagname}</div>
            {p.display_name && (
              <div style={{ fontSize: '11px', color: 'var(--io-text-muted)' }}>{p.display_name}</div>
            )}
          </div>
        ))}
        {!loading && results.length === 0 && query.length > 0 && (
          <div style={{ padding: '8px', fontSize: '12px', color: 'var(--io-text-muted)' }}>
            No points found
          </div>
        )}
      </div>
      <div style={{ marginTop: '8px', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={onClose}
          style={{
            padding: '5px 12px',
            background: 'transparent',
            border: '1px solid var(--io-border)',
            borderRadius: 'var(--io-radius)',
            color: 'var(--io-text-secondary)',
            fontSize: '12px',
            cursor: 'pointer',
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Draggable tile in workspace
// ---------------------------------------------------------------------------

interface WorkspaceTileProps {
  tile: ExpressionTile
  selected: boolean
  depth: number
  dispatch: React.Dispatch<Action>
  allSelectedIds: string[]
}

function WorkspaceTile({ tile, selected, depth, dispatch, allSelectedIds }: WorkspaceTileProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tile.id })

  const [showPointSearch, setShowPointSearch] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const isContainer = ['group', 'square', 'cube', 'round', 'negate', 'abs'].includes(tile.type)
  const isControlFlow = tile.type === 'if_then_else'

  const bg = isContainer || isControlFlow
    ? 'transparent'
    : getTileColor(tile.type)

  const borderColor = isContainer || isControlFlow
    ? getNestingColor(depth)
    : 'transparent'

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation()
    dispatch({ type: 'SELECT', ids: [tile.id], additive: e.ctrlKey || e.metaKey })
    dispatch({ type: 'SET_CURSOR', parentId: null, index: 0 })
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      const idsToDelete = allSelectedIds.includes(tile.id) ? allSelectedIds : [tile.id]
      for (const id of idsToDelete) {
        dispatch({ type: 'DELETE_TILE', id })
      }
    }
  }

  const tileLabel = getTileLabel(tile)

  return (
    <div
      ref={(el) => {
        setNodeRef(el)
        ;(containerRef as React.MutableRefObject<HTMLDivElement | null>).current = el
      }}
      style={{
        ...style,
        display: 'inline-flex',
        flexDirection: isContainer || isControlFlow ? 'column' : 'row',
        alignItems: isContainer || isControlFlow ? 'flex-start' : 'center',
        gap: '4px',
        padding: isContainer || isControlFlow ? '6px 8px' : '4px 10px',
        borderRadius: 'var(--io-radius)',
        border: `2px solid ${borderColor}`,
        background: isContainer || isControlFlow ? 'rgba(255,255,255,0.04)' : bg,
        color: '#fff',
        fontSize: '12px',
        fontWeight: 500,
        cursor: 'grab',
        userSelect: 'none',
        position: 'relative',
        outline: selected ? '2px solid var(--io-accent)' : 'none',
        outlineOffset: '2px',
        flexShrink: 0,
      }}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      {...attributes}
      {...listeners}
      tabIndex={0}
    >
      {/* Tile label or editable content */}
      {tile.type === 'constant' ? (
        <ConstantEditor tile={tile} dispatch={dispatch} />
      ) : tile.type === 'point_ref' ? (
        <PointRefEditor
          tile={tile}
          dispatch={dispatch}
          showSearch={showPointSearch}
          onToggleSearch={() => setShowPointSearch((v) => !v)}
          onCloseSearch={() => setShowPointSearch(false)}
        />
      ) : tile.type === 'field_ref' ? (
        <FieldRefEditor tile={tile} dispatch={dispatch} />
      ) : isContainer ? (
        <ContainerTileContent tile={tile} depth={depth} dispatch={dispatch} allSelectedIds={allSelectedIds} />
      ) : isControlFlow ? (
        <IfThenElseContent tile={tile} depth={depth} dispatch={dispatch} allSelectedIds={allSelectedIds} />
      ) : (
        <span>{tileLabel}</span>
      )}
    </div>
  )
}

function getTileLabel(tile: ExpressionTile): string {
  switch (tile.type) {
    case 'add':      return '+'
    case 'subtract': return '−'
    case 'multiply': return '×'
    case 'divide':   return '÷'
    case 'modulus':  return 'mod'
    case 'power':    return 'x^y'
    case 'gt':       return '>'
    case 'lt':       return '<'
    case 'gte':      return '≥'
    case 'lte':      return '≤'
    case 'and':      return 'AND'
    case 'or':       return 'OR'
    case 'not':      return 'NOT'
    case 'group':    return '(…)'
    case 'square':   return 'x²'
    case 'cube':     return 'x³'
    case 'round':    return `round(${tile.precision ?? 2})`
    case 'negate':   return '−x'
    case 'abs':      return '|x|'
    case 'if_then_else': return 'IF…THEN…ELSE'
    case 'time_now': return 'now()'
    case 'elapsed_since': return 'elapsed_since'
    case 'duration_above': return 'duration_above'
    case 'duration_below': return 'duration_below'
    case 'agg_avg':  return 'avg()'
    case 'agg_sum':  return 'sum()'
    case 'agg_min':  return 'min()'
    case 'agg_max':  return 'max()'
    case 'agg_count': return 'count()'
    case 'point_ref': return tile.pointLabel ?? tile.pointId ?? 'current_point'
    case 'field_ref': return tile.fieldName ? tile.fieldName : 'field?'
    case 'constant':  return String(tile.value ?? 0)
    default: return tile.type
  }
}

// ---------------------------------------------------------------------------
// Constant editor (inline value editing)
// ---------------------------------------------------------------------------

function ConstantEditor({ tile, dispatch }: { tile: ExpressionTile; dispatch: React.Dispatch<Action> }) {
  const [editing, setEditing] = useState(false)
  const [temp, setTemp] = useState(String(tile.value ?? 0))
  const inputRef = useRef<HTMLInputElement>(null)

  function startEdit(e: React.MouseEvent) {
    e.stopPropagation()
    setTemp(String(tile.value ?? 0))
    setEditing(true)
  }

  function commit() {
    const n = parseFloat(temp)
    if (!isNaN(n)) {
      dispatch({ type: 'UPDATE_TILE', id: tile.id, patch: { value: n } })
    }
    setEditing(false)
  }

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={temp}
        onChange={(e) => setTemp(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') setEditing(false)
          e.stopPropagation()
        }}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '60px',
          padding: '2px 6px',
          background: 'rgba(255,255,255,0.15)',
          border: '1px solid rgba(255,255,255,0.4)',
          borderRadius: '4px',
          color: '#fff',
          fontSize: '12px',
          outline: 'none',
        }}
      />
    )
  }

  return (
    <span
      onDoubleClick={startEdit}
      title="Double-click to edit value"
      style={{ cursor: 'text' }}
    >
      {tile.value ?? 0}
    </span>
  )
}

// ---------------------------------------------------------------------------
// PointRef editor
// ---------------------------------------------------------------------------

function PointRefEditor({
  tile,
  dispatch,
  showSearch,
  onToggleSearch,
  onCloseSearch,
}: {
  tile: ExpressionTile
  dispatch: React.Dispatch<Action>
  showSearch: boolean
  onToggleSearch: () => void
  onCloseSearch: () => void
}) {
  const label = tile.pointLabel ?? tile.pointId ?? 'current_point'

  function handleSelect(point: PointMeta) {
    dispatch({
      type: 'UPDATE_TILE',
      id: tile.id,
      patch: {
        pointId: point.id,
        pointLabel: point.tagname,
      },
    })
    onCloseSearch()
  }

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <span>{label}</span>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onToggleSearch()
          }}
          style={{
            background: 'rgba(255,255,255,0.2)',
            border: 'none',
            borderRadius: '3px',
            color: '#fff',
            fontSize: '10px',
            padding: '1px 4px',
            cursor: 'pointer',
          }}
          title="Change point"
        >
          ▾
        </button>
      </div>
      {showSearch && (
        <PointSearchPopover onSelect={handleSelect} onClose={onCloseSearch} />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// FieldRef editor
// ---------------------------------------------------------------------------

function FieldRefEditor({ tile, dispatch }: { tile: ExpressionTile; dispatch: React.Dispatch<Action> }) {
  const [editing, setEditing] = useState(false)
  const [temp, setTemp] = useState(tile.fieldName ?? '')
  const inputRef = useRef<HTMLInputElement>(null)

  function startEdit(e: React.MouseEvent) {
    e.stopPropagation()
    setTemp(tile.fieldName ?? '')
    setEditing(true)
  }

  function commit() {
    dispatch({ type: 'UPDATE_TILE', id: tile.id, patch: { fieldName: temp.trim() } })
    setEditing(false)
  }

  useEffect(() => {
    if (editing) inputRef.current?.focus()
  }, [editing])

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={temp}
        onChange={(e) => setTemp(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') setEditing(false)
          e.stopPropagation()
        }}
        onClick={(e) => e.stopPropagation()}
        placeholder="field name"
        style={{
          width: '80px',
          padding: '2px 6px',
          background: 'rgba(255,255,255,0.15)',
          border: '1px solid rgba(255,255,255,0.4)',
          borderRadius: '4px',
          color: '#fff',
          fontSize: '12px',
          outline: 'none',
        }}
      />
    )
  }

  return (
    <span
      onDoubleClick={startEdit}
      title="Double-click to set field name"
      style={{ cursor: 'text' }}
    >
      {tile.fieldName ? tile.fieldName : 'field?'}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Container tile content
// ---------------------------------------------------------------------------

function ContainerTileContent({
  tile,
  depth,
  dispatch,
  allSelectedIds,
}: {
  tile: ExpressionTile
  depth: number
  dispatch: React.Dispatch<Action>
  allSelectedIds: string[]
}) {
  const children = tile.children ?? []
  const label = getTileLabel(tile)

  return (
    <div>
      <div style={{ fontSize: '11px', color: getNestingColor(depth), marginBottom: '4px', fontWeight: 600 }}>
        {label}
      </div>
      <DropZoneRow
        tiles={children}
        parentId={tile.id}
        depth={depth + 1}
        dispatch={dispatch}
        allSelectedIds={allSelectedIds}
      />
      {tile.type === 'round' && (
        <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '11px', color: 'var(--io-text-muted)' }}>decimals:</span>
          <select
            value={tile.precision ?? 2}
            onChange={(e) => dispatch({ type: 'UPDATE_TILE', id: tile.id, patch: { precision: parseInt(e.target.value) } })}
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--io-surface-sunken)',
              border: '1px solid var(--io-border)',
              borderRadius: '4px',
              color: 'var(--io-text-primary)',
              fontSize: '11px',
              padding: '2px 4px',
            }}
          >
            {[0,1,2,3,4,5,6,7].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// IF…THEN…ELSE content
// ---------------------------------------------------------------------------

function IfThenElseContent({
  tile,
  depth,
  dispatch,
  allSelectedIds,
}: {
  tile: ExpressionTile
  depth: number
  dispatch: React.Dispatch<Action>
  allSelectedIds: string[]
}) {
  const sections = [
    { label: 'IF', tiles: tile.condition ?? [], key: 'condition' as const },
    { label: 'THEN', tiles: tile.thenBranch ?? [], key: 'thenBranch' as const },
    { label: 'ELSE', tiles: tile.elseBranch ?? [], key: 'elseBranch' as const },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {sections.map((sec) => (
        <div key={sec.key}>
          <div style={{ fontSize: '10px', color: getNestingColor(depth), fontWeight: 700, marginBottom: '3px' }}>
            {sec.label}
          </div>
          <DropZoneRow
            tiles={sec.tiles}
            parentId={tile.id}
            depth={depth + 1}
            dispatch={dispatch}
            allSelectedIds={allSelectedIds}
            sectionKey={sec.key}
          />
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Drop zone row (sortable children area)
// ---------------------------------------------------------------------------

interface DropZoneRowProps {
  tiles: ExpressionTile[]
  parentId: string | null
  depth: number
  dispatch: React.Dispatch<Action>
  allSelectedIds: string[]
  sectionKey?: 'condition' | 'thenBranch' | 'elseBranch' | 'children'
}

function DropZoneRow({ tiles, parentId, depth, dispatch, allSelectedIds }: DropZoneRowProps) {
  // When the depth at this zone equals or exceeds MAX_NESTING_DEPTH, container
  // tiles cannot be dropped here. We show a subtle visual hint.
  const depthBlocked = depth >= MAX_NESTING_DEPTH

  return (
    <SortableContext
      items={tiles.map((t) => t.id)}
      strategy={horizontalListSortingStrategy}
    >
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '4px',
          minHeight: '36px',
          padding: '4px',
          border: depthBlocked
            ? '1px dashed var(--io-danger, #ef4444)'
            : '1px dashed var(--io-border)',
          borderRadius: 'var(--io-radius)',
          alignItems: 'flex-start',
          background: depthBlocked
            ? 'rgba(239,68,68,0.05)'
            : 'rgba(255,255,255,0.02)',
        }}
        data-parent-id={parentId ?? 'root'}
        data-depth-blocked={depthBlocked ? 'true' : undefined}
        title={depthBlocked ? 'Maximum nesting depth (5 levels) reached.' : undefined}
      >
        {tiles.map((tile) => (
          <WorkspaceTile
            key={tile.id}
            tile={tile}
            selected={allSelectedIds.includes(tile.id)}
            depth={depth}
            dispatch={dispatch}
            allSelectedIds={allSelectedIds}
          />
        ))}
        {tiles.length === 0 && (
          <div style={{ fontSize: '11px', color: 'var(--io-text-muted)', padding: '4px 6px', alignSelf: 'center' }}>
            Drop tiles here
          </div>
        )}
      </div>
    </SortableContext>
  )
}

// ---------------------------------------------------------------------------
// Palette tile (draggable from palette)
// ---------------------------------------------------------------------------

function PaletteTile({
  item,
  onClickAdd,
}: {
  item: PaletteItem
  onClickAdd: (type: TileType) => void
}) {
  const bg = getTileColor(item.type)
  const isContainer = ['group', 'square', 'cube', 'round', 'negate', 'abs', 'if_then_else'].includes(item.type)

  return (
    <button
      onClick={() => onClickAdd(item.type)}
      title={`Add ${item.label}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '5px 10px',
        borderRadius: 'var(--io-radius)',
        border: isContainer ? `2px solid ${getNestingColor(0)}` : 'none',
        background: isContainer ? 'rgba(255,255,255,0.06)' : bg,
        color: '#fff',
        fontSize: '12px',
        fontWeight: 500,
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        transition: 'opacity 0.15s',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '0.8' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
    >
      {item.label}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

interface ValidationResult {
  valid: boolean
  errors: string[]
}

function validateExpression(
  state: ExprBuilderState,
): ValidationResult {
  const errors: string[] = []

  if (state.tiles.length === 0) {
    errors.push('Expression must have at least one tile.')
  }

  function checkTiles(tiles: ExpressionTile[]) {
    for (const tile of tiles) {
      if (tile.type === 'constant' && (tile.value === undefined || isNaN(tile.value))) {
        errors.push('All constant tiles must have a numeric value.')
      }
      if (tile.type === 'point_ref' && tile.pointId === undefined && tile.pointLabel === undefined) {
        // null pointId is valid (means current_point), only check if explicitly undefined
      }
      const containers = ['group', 'square', 'cube', 'round', 'negate', 'abs']
      if (containers.includes(tile.type) && (!tile.children || tile.children.length === 0)) {
        errors.push(`"${getTileLabel(tile)}" container must have at least one child tile.`)
      }
      if (tile.type === 'if_then_else') {
        if (!tile.condition || tile.condition.length === 0) {
          errors.push('IF…THEN…ELSE must have a condition.')
        }
        if (!tile.thenBranch || tile.thenBranch.length === 0) {
          errors.push('IF…THEN…ELSE must have a THEN branch.')
        }
        if (!tile.elseBranch || tile.elseBranch.length === 0) {
          errors.push('IF…THEN…ELSE must have an ELSE branch.')
        }
      }
      if (tile.children) checkTiles(tile.children)
      if (tile.condition) checkTiles(tile.condition)
      if (tile.thenBranch) checkTiles(tile.thenBranch)
      if (tile.elseBranch) checkTiles(tile.elseBranch)
    }
  }

  checkTiles(state.tiles)

  if (state.saveForFuture && !state.name.trim()) {
    errors.push('Name is required when "Save for Future Use" is checked.')
  }

  // Deduplicate
  const unique = [...new Set(errors)]
  return { valid: unique.length === 0, errors: unique }
}

// ---------------------------------------------------------------------------
// Collect point references for Test panel
// ---------------------------------------------------------------------------

function collectPointRefs(tiles: ExpressionTile[]): Array<{ id: string; label: string }> {
  const refs: Array<{ id: string; label: string }> = []
  function walk(t: ExpressionTile[]) {
    for (const tile of t) {
      if (tile.type === 'point_ref' && tile.pointId) {
        refs.push({ id: tile.pointId, label: tile.pointLabel ?? tile.pointId })
      }
      if (tile.children) walk(tile.children)
      if (tile.condition) walk(tile.condition)
      if (tile.thenBranch) walk(tile.thenBranch)
      if (tile.elseBranch) walk(tile.elseBranch)
    }
  }
  walk(tiles)
  // Deduplicate by id
  return refs.filter((r, i, arr) => arr.findIndex((x) => x.id === r.id) === i)
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ExpressionBuilderProps {
  context: ExpressionContext
  contextLabel: string
  contextPointId?: string
  contextObjectName?: string
  initialExpression?: ExpressionAst
  onApply: (ast: ExpressionAst) => void
  onCancel: () => void
}

// ---------------------------------------------------------------------------
// Main ExpressionBuilder
// ---------------------------------------------------------------------------

export function ExpressionBuilder({
  context,
  contextLabel,
  contextPointId: _contextPointId,
  contextObjectName,
  initialExpression,
  onApply,
  onCancel,
}: ExpressionBuilderProps) {
  const { user } = useAuthStore()
  const isAdmin = user?.permissions.includes('users:write') ?? false

  const [state, dispatch] = useReducer(exprReducer, {
    tiles: [],
    selectedIds: [],
    cursorParentId: null,
    cursorIndex: 0,
    name: '',
    description: '',
    outputType: initialExpression?.output?.type ?? 'float',
    outputPrecision: initialExpression?.output?.precision ?? 2,
    saveForFuture: false,
    shareExpression: false,
    past: [],
    future: [],
  })

  const [showTest, setShowTest] = useState(false)
  const [testValues, setTestValues] = useState<Record<string, string>>({})
  const [showPreview, setShowPreview] = useState(true)
  const [activeDragId, setActiveDragId] = useState<string | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }))

  const paletteItems = getPaletteItems(context)
  const paletteGroups = [...new Set(paletteItems.map((p) => p.group))]

  const previewStr = expressionToString(state.tiles)
  const pointRefs = collectPointRefs(state.tiles)
  const testNumericValues: Record<string, number> = {}
  for (const ref of pointRefs) {
    const v = parseFloat(testValues[ref.id] ?? '0')
    testNumericValues[ref.id] = isNaN(v) ? 0 : v
  }
  const testResult = evaluateExpression(state.tiles, testNumericValues, undefined)

  const validation = validateExpression(state)

  // Keyboard shortcut undo/redo
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault()
          dispatch({ type: 'UNDO' })
        } else if ((e.key === 'y') || (e.key === 'z' && e.shiftKey)) {
          e.preventDefault()
          dispatch({ type: 'REDO' })
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  function handleAddFromPalette(type: TileType) {
    // Enforce nesting depth limit for container tiles
    if (CONTAINER_TILE_TYPES.includes(type) && state.cursorParentId !== null) {
      const parentDepth = getTileDepth(state.tiles, state.cursorParentId)
      if (parentDepth !== -1 && parentDepth + 1 >= MAX_NESTING_DEPTH) {
        showToast({
          title: 'Nesting limit reached',
          description: 'Maximum nesting depth (5 levels) reached.',
          variant: 'warning',
          duration: 4000,
        })
        return
      }
    }
    const tile = createTile(type)
    dispatch({
      type: 'INSERT_TILE',
      tile,
      parentId: state.cursorParentId,
      index: state.tiles.length,
    })
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveDragId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveDragId(null)
    if (!over || active.id === over.id) return

    // Find in tree
    const activeIds = collectIds(state.tiles)
    if (activeIds.includes(String(active.id)) && activeIds.includes(String(over.id))) {
      // Reorder within workspace
      const fromLoc = findTileLocation(state.tiles, String(active.id))
      const toLoc = findTileLocation(state.tiles, String(over.id))
      if (!fromLoc || !toLoc) return

      // Enforce nesting depth limit: if we are moving a container tile, check
      // that the destination depth will not exceed MAX_NESTING_DEPTH.
      const activeTile = fromLoc.arr[fromLoc.index]
      if (CONTAINER_TILE_TYPES.includes(activeTile.type)) {
        const destDepth = getTileDepth(state.tiles, String(over.id))
        if (destDepth !== -1 && destDepth >= MAX_NESTING_DEPTH) {
          showToast({
            title: 'Nesting limit reached',
            description: 'Maximum nesting depth (5 levels) reached.',
            variant: 'warning',
            duration: 4000,
          })
          return
        }
      }

      // Check same parent array by reference equality (use JSON comparison as fallback)
      dispatch({
        type: 'MOVE_TILE',
        fromParentId: null,
        fromIndex: fromLoc.index,
        toParentId: null,
        toIndex: toLoc.index,
      })
    }
  }

  function handleApply() {
    if (!validation.valid) return
    const root = tilesToAst(state.tiles, context)
    const ast: ExpressionAst = {
      version: 1,
      context,
      root,
      output: {
        type: state.outputType,
        precision: state.outputPrecision,
      },
    }
    onApply(ast)
  }

  // Shared button styles
  const btnPrimary: React.CSSProperties = {
    padding: '8px 20px',
    background: 'var(--io-accent)',
    color: '#09090b',
    border: 'none',
    borderRadius: 'var(--io-radius)',
    fontSize: '13px',
    fontWeight: 600,
    cursor: validation.valid ? 'pointer' : 'not-allowed',
    opacity: validation.valid ? 1 : 0.5,
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

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '7px 10px',
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
    fontSize: '11px',
    fontWeight: 600,
    color: 'var(--io-text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    marginBottom: '4px',
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
        gap: '16px',
      }}
    >
      {/* Header: Name, Description, checkboxes */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Expression Name</label>
            <input
              style={inputStyle}
              placeholder="e.g. Pump Efficiency Formula"
              value={state.name}
              onChange={(e) => dispatch({ type: 'SET_NAME', value: e.target.value })}
            />
          </div>
          <div style={{ flex: 2 }}>
            <label style={labelStyle}>Description</label>
            <input
              style={inputStyle}
              placeholder="Optional description"
              value={state.description}
              onChange={(e) => dispatch({ type: 'SET_DESC', value: e.target.value })}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
          {/* Save for future use */}
          <label style={{ display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer', fontSize: '13px', color: 'var(--io-text-secondary)' }}>
            <input
              type="checkbox"
              checked={state.saveForFuture}
              onChange={(e) => dispatch({ type: 'SET_SAVE_FUTURE', value: e.target.checked })}
              style={{ accentColor: 'var(--io-accent)' }}
            />
            Save for Future Use
          </label>

          {/* Share (admin only) */}
          {isAdmin && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer', fontSize: '13px', color: 'var(--io-text-secondary)' }}>
              <input
                type="checkbox"
                checked={state.shareExpression}
                onChange={(e) => dispatch({ type: 'SET_SHARE', value: e.target.checked })}
                style={{ accentColor: 'var(--io-accent)' }}
              />
              Shared (visible to all users)
            </label>
          )}

          {/* Output config */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginLeft: 'auto' }}>
            <span style={{ fontSize: '12px', color: 'var(--io-text-muted)' }}>Output:</span>
            {(['float', 'integer'] as const).map((opt) => (
              <label key={opt} style={{ display: 'flex', alignItems: 'center', gap: '5px', cursor: 'pointer', fontSize: '13px', color: 'var(--io-text-secondary)' }}>
                <input
                  type="radio"
                  name="outputType"
                  checked={state.outputType === opt}
                  onChange={() => dispatch({ type: 'SET_OUTPUT_TYPE', value: opt })}
                  style={{ accentColor: 'var(--io-accent)' }}
                />
                {opt === 'float' ? 'Float' : 'Integer'}
              </label>
            ))}
            {state.outputType === 'float' && (
              <select
                value={state.outputPrecision}
                onChange={(e) => dispatch({ type: 'SET_OUTPUT_PRECISION', value: parseInt(e.target.value) })}
                style={{
                  background: 'var(--io-surface-sunken)',
                  border: '1px solid var(--io-border)',
                  borderRadius: '4px',
                  color: 'var(--io-text-primary)',
                  fontSize: '12px',
                  padding: '3px 6px',
                }}
              >
                {[0,1,2,3,4,5,6,7].map((n) => (
                  <option key={n} value={n}>{n} decimals</option>
                ))}
              </select>
            )}
          </div>
        </div>
      </div>

      {/* Context label */}
      <div style={{ fontSize: '12px', color: 'var(--io-text-muted)' }}>
        Context: <strong style={{ color: 'var(--io-text-secondary)' }}>{contextLabel}</strong>
        {contextObjectName && (
          <> — <strong style={{ color: 'var(--io-text-secondary)' }}>{contextObjectName}</strong></>
        )}
      </div>

      {/* Palette */}
      <div
        style={{
          background: 'var(--io-surface-secondary)',
          border: '1px solid var(--io-border)',
          borderRadius: 'var(--io-radius)',
          padding: '10px 12px',
        }}
      >
        {paletteGroups.map((group) => (
          <div key={group} style={{ marginBottom: '8px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--io-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '5px' }}>
              {group}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {paletteItems.filter((p) => p.group === group).map((item) => (
                <PaletteTile
                  key={item.type}
                  item={item}
                  onClickAdd={handleAddFromPalette}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Workspace */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div
          style={{
            flex: 1,
            minHeight: '100px',
            maxHeight: '280px',
            overflowY: 'auto',
            background: 'var(--io-surface-sunken)',
            border: '1px solid var(--io-border)',
            borderRadius: 'var(--io-radius)',
            padding: '10px',
          }}
          onClick={() => {
            dispatch({ type: 'SELECT', ids: [], additive: false })
            dispatch({ type: 'SET_CURSOR', parentId: null, index: state.tiles.length })
          }}
        >
          <DropZoneRow
            tiles={state.tiles}
            parentId={null}
            depth={0}
            dispatch={dispatch}
            allSelectedIds={state.selectedIds}
          />
        </div>

        <DragOverlay>
          {activeDragId && (() => {
            const loc = findTileLocation(state.tiles, activeDragId)
            const tile = loc ? loc.arr[loc.index] : null
            if (!tile) return null
            return (
              <div style={{
                padding: '4px 10px',
                borderRadius: 'var(--io-radius)',
                background: getTileColor(tile.type),
                color: '#fff',
                fontSize: '12px',
                fontWeight: 500,
                boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                pointerEvents: 'none',
              }}>
                {getTileLabel(tile)}
              </div>
            )
          })()}
        </DragOverlay>
      </DndContext>

      {/* Undo/Redo bar */}
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
        <button
          style={{ ...btnSecondary, padding: '5px 12px', fontSize: '12px', opacity: state.past.length > 0 ? 1 : 0.4 }}
          disabled={state.past.length === 0}
          onClick={() => dispatch({ type: 'UNDO' })}
          title="Undo (Ctrl+Z)"
        >
          ↩ Undo
        </button>
        <button
          style={{ ...btnSecondary, padding: '5px 12px', fontSize: '12px', opacity: state.future.length > 0 ? 1 : 0.4 }}
          disabled={state.future.length === 0}
          onClick={() => dispatch({ type: 'REDO' })}
          title="Redo (Ctrl+Y)"
        >
          ↪ Redo
        </button>
        <button
          style={{ ...btnSecondary, padding: '5px 12px', fontSize: '12px', marginLeft: 'auto' }}
          onClick={() => setShowTest((v) => !v)}
        >
          {showTest ? 'Hide Test' : 'Test'}
        </button>
      </div>

      {/* Test panel */}
      {showTest && (
        <div
          style={{
            background: 'var(--io-surface-secondary)',
            border: '1px solid var(--io-border)',
            borderRadius: 'var(--io-radius)',
            padding: '12px 14px',
          }}
        >
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--io-text-secondary)', marginBottom: '10px' }}>
            Test Values
          </div>
          {pointRefs.length === 0 && (
            <div style={{ fontSize: '13px', color: 'var(--io-text-muted)' }}>
              No point references in expression.
            </div>
          )}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '10px' }}>
            {pointRefs.map((ref) => (
              <div key={ref.id} style={{ display: 'flex', flexDirection: 'column', gap: '3px', minWidth: '140px' }}>
                <label style={{ fontSize: '11px', color: 'var(--io-text-muted)' }}>{ref.label}</label>
                <input
                  type="number"
                  value={testValues[ref.id] ?? '0'}
                  onChange={(e) => setTestValues((v) => ({ ...v, [ref.id]: e.target.value }))}
                  style={{ ...inputStyle, width: '100px' }}
                />
              </div>
            ))}
          </div>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--io-text-primary)' }}>
            Result:{' '}
            <span style={{ color: testResult === null ? 'var(--io-danger)' : 'var(--io-accent)' }}>
              {testResult === null ? 'Error (incomplete expression or division by zero)' : String(testResult)}
            </span>
          </div>
        </div>
      )}

      {/* Expression preview */}
      <div
        style={{
          background: 'var(--io-surface-secondary)',
          border: '1px solid var(--io-border)',
          borderRadius: 'var(--io-radius)',
          overflow: 'hidden',
        }}
      >
        <button
          onClick={() => setShowPreview((v) => !v)}
          style={{
            width: '100%',
            background: 'none',
            border: 'none',
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            cursor: 'pointer',
            color: 'var(--io-text-muted)',
            fontSize: '12px',
            fontWeight: 600,
          }}
        >
          <span>Expression Preview</span>
          <span>{showPreview ? '▲' : '▼'}</span>
        </button>
        {showPreview && (
          <div
            style={{
              padding: '8px 12px 12px',
              fontFamily: 'monospace',
              fontSize: '13px',
              color: previewStr ? 'var(--io-text-primary)' : 'var(--io-text-muted)',
              borderTop: '1px solid var(--io-border)',
              wordBreak: 'break-all',
            }}
          >
            {previewStr ? `= ${previewStr}` : 'No tiles yet — add tiles from the palette above.'}
          </div>
        )}
      </div>

      {/* Validation errors */}
      {!validation.valid && (
        <div
          style={{
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 'var(--io-radius)',
            padding: '10px 14px',
          }}
        >
          {validation.errors.map((err, i) => (
            <div key={i} style={{ fontSize: '13px', color: 'var(--io-danger)', marginBottom: i < validation.errors.length - 1 ? '4px' : 0 }}>
              • {err}
            </div>
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '4px' }}>
        <button style={btnSecondary} onClick={onCancel}>
          Cancel
        </button>
        <button style={btnPrimary} disabled={!validation.valid} onClick={handleApply}>
          OK
        </button>
      </div>
    </div>
  )
}
