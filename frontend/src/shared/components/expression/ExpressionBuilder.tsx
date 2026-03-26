import React, { useReducer, useRef, useState, useEffect, useCallback } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  pointerWithin,
  closestCenter,
  type DragEndEvent,
  type DragStartEvent,
  type CollisionDetection,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { ExpressionAst, ExpressionContext, ExpressionTile, TileType } from '../../types/expression'
import { expressionToString } from './preview'
import { tilesToAst } from './ast'
import { useAuthStore } from '../../../store/auth'
import { api } from '../../../api/client'
import type { PointMeta } from '../../../api/points'
import { showToast } from '../Toast'
import { expressionsApi } from '../../../api/expressions'
import { useThemeName } from '../../theme/ThemeContext'
import type { Theme } from '../../theme/tokens'

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
// Collision detection — prefer innermost droppable at pointer position.
//
// dnd-kit's default rectIntersection picks the droppable with the largest
// overlap area. When nested droppables exist (e.g. container-zone-{id} is
// rendered inside the container tile's sortable node, which is itself inside
// root-zone), the outermost droppable often wins because it has a larger rect.
//
// This custom strategy first uses pointerWithin (finds droppables that
// physically contain the pointer — returns the smallest matching one),
// and falls back to closestCenter when the pointer is not directly inside any
// droppable rect.
// ---------------------------------------------------------------------------

const customCollisionDetection: CollisionDetection = (args) => {
  // Try pointer-within first — gives priority to the smallest droppable that
  // physically contains the current pointer position.
  const pointerCollisions = pointerWithin(args)
  if (pointerCollisions.length > 0) return pointerCollisions

  // Fall back to closest-center for cases where the pointer is not inside any
  // droppable rect (e.g. drag started from palette, pointer still over palette).
  return closestCenter(args)
}

// ---------------------------------------------------------------------------
// Round tile increment values — powers of 10 from 0.0000001 to 1000000
// ---------------------------------------------------------------------------

const ROUND_INCREMENTS = [
  0.0000001, 0.000001, 0.00001, 0.0001, 0.001, 0.01, 0.1,
  1, 10, 100, 1000, 10000, 100000, 1000000,
]

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

// Okabe-Ito colorblind-safe palette — nesting levels (depth 0–4, clamped)
const NESTING_LIGHT  = ['#0072B2', '#D55E00', '#009E73', '#CC3311', '#7B2D8E']
const NESTING_DARK   = ['#56B4E9', '#E69F00', '#40C9A2', '#EE6677', '#AA88CC']
const NESTING_BORDER_STYLES = ['solid 2px', 'dashed 2px', 'dotted 2.5px', 'double 3px', 'solid 3.5px']

/** Convert a #rrggbb hex color to "r, g, b" string for use in rgba(). */
function hexToRgb(hex: string): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return `${r}, ${g}, ${b}`
}

interface NestingStyle {
  color: string
  borderStyle: string // e.g. 'solid 2px'
  bgAlpha: number    // opacity for rgba background tint
}

function getNestingStyle(depth: number, theme: Theme): NestingStyle {
  const idx = Math.min(depth, 4)
  const isHighContrast = theme === 'hphmi'
  const isDark = theme === 'dark' || isHighContrast
  const color = isDark ? NESTING_DARK[idx] : NESTING_LIGHT[idx]
  const borderStyle = NESTING_BORDER_STYLES[idx]
  const bgAlpha = isHighContrast ? 0.15 : isDark ? 0.10 : 0.08
  return { color, borderStyle, bgAlpha }
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
      return { ...base, precision: 1, children: [] }
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
  // clipboard for copy/cut/paste
  clipboard: ExpressionTile[] | null
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
  | { type: 'COPY_SELECTION' }
  | { type: 'CUT_SELECTION' }
  | { type: 'PASTE' }

const MAX_HISTORY = 50

function cloneTiles(tiles: ExpressionTile[]): ExpressionTile[] {
  return JSON.parse(JSON.stringify(tiles)) as ExpressionTile[]
}

/**
 * Deep-clone tiles and replace every `id` in the tree with a fresh UUID.
 * This prevents duplicate IDs when pasting, which would break dnd-kit and
 * findTileLocation.
 */
function reassignIds(tiles: ExpressionTile[]): ExpressionTile[] {
  return tiles.map((tile) => {
    const next: ExpressionTile = { ...tile, id: newId() }
    if (tile.children) next.children = reassignIds(tile.children)
    if (tile.condition) next.condition = reassignIds(tile.condition)
    if (tile.thenBranch) next.thenBranch = reassignIds(tile.thenBranch)
    if (tile.elseBranch) next.elseBranch = reassignIds(tile.elseBranch)
    return next
  })
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

/**
 * Returns the ID of the container tile that directly owns the tile with `childId`,
 * or null if the tile is at the top level.
 * Returns undefined if the tile is not found in the tree.
 */
function findParentId(
  tiles: ExpressionTile[],
  childId: string,
  parentId: string | null = null,
): string | null | undefined {
  for (const t of tiles) {
    if (t.id === childId) return parentId
    for (const sub of [t.children, t.condition, t.thenBranch, t.elseBranch]) {
      if (!sub) continue
      const found = findParentId(sub, childId, t.id)
      if (found !== undefined) return found
    }
  }
  return undefined
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

    case 'COPY_SELECTION': {
      if (state.selectedIds.length === 0) return state
      // Collect selected top-level tiles in document order, deep-clone them
      const selected: ExpressionTile[] = []
      function collectSelected(tiles: ExpressionTile[]) {
        for (const t of tiles) {
          if (state.selectedIds.includes(t.id)) {
            selected.push(t)
          }
          // Also walk children so nested selections can be collected
          for (const sub of [t.children, t.condition, t.thenBranch, t.elseBranch]) {
            if (sub) collectSelected(sub)
          }
        }
      }
      collectSelected(state.tiles)
      return { ...state, clipboard: cloneTiles(selected) }
    }

    case 'CUT_SELECTION': {
      if (state.selectedIds.length === 0) return state
      // Same as COPY_SELECTION, but also removes selected tiles
      const selected: ExpressionTile[] = []
      function collectForCut(tiles: ExpressionTile[]) {
        for (const t of tiles) {
          if (state.selectedIds.includes(t.id)) {
            selected.push(t)
          }
          for (const sub of [t.children, t.condition, t.thenBranch, t.elseBranch]) {
            if (sub) collectForCut(sub)
          }
        }
      }
      collectForCut(state.tiles)
      const clipboard = cloneTiles(selected)

      // Remove selected tiles from the tree
      const newTiles = cloneTiles(state.tiles)
      for (const id of state.selectedIds) {
        const loc = findTileLocation(newTiles, id)
        if (loc) loc.arr.splice(loc.index, 1)
      }
      return {
        ...state,
        tiles: newTiles,
        clipboard,
        selectedIds: [],
        past: [cloneTiles(state.tiles), ...state.past].slice(0, MAX_HISTORY),
        future: [],
      }
    }

    case 'PASTE': {
      if (!state.clipboard || state.clipboard.length === 0) return state
      const pasted = reassignIds(cloneTiles(state.clipboard))
      const newTiles = cloneTiles(state.tiles)
      const arr = getChildArray(newTiles, state.cursorParentId)
      if (!arr) return state
      arr.splice(state.cursorIndex, 0, ...pasted)
      return {
        ...state,
        tiles: newTiles,
        past: [cloneTiles(state.tiles), ...state.past].slice(0, MAX_HISTORY),
        future: [],
        cursorIndex: state.cursorIndex + pasted.length,
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
  cursorParentId: string | null
  cursorIndex: number
  isDragging: boolean
}

function WorkspaceTile({ tile, selected, depth, dispatch, allSelectedIds, cursorParentId, cursorIndex, isDragging: isGlobalDragging }: WorkspaceTileProps) {
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
  const theme = useThemeName()

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  }

  const isContainer = ['group', 'square', 'cube', 'round', 'negate', 'abs'].includes(tile.type)
  const isControlFlow = tile.type === 'if_then_else'

  const nestingStyle = getNestingStyle(depth, theme)

  const bg = isContainer || isControlFlow
    ? 'transparent'
    : getTileColor(tile.type)

  const containerBorder = isContainer || isControlFlow
    ? `${nestingStyle.borderStyle} ${nestingStyle.color}`
    : `2px solid transparent`

  const containerBg = isContainer || isControlFlow
    ? `rgba(${hexToRgb(nestingStyle.color)}, ${nestingStyle.bgAlpha})`
    : bg

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation()
    dispatch({ type: 'SELECT', ids: [tile.id], additive: e.ctrlKey || e.metaKey })
    // For container tiles, move the cursor into the container so the breadcrumb
    // trail updates to show the nesting path. For non-container tiles, do not
    // move the cursor — clicking a leaf tile only selects it; the hit-box rows
    // inside DropZoneRow handle precise cursor placement.
    if (isContainer || isControlFlow) {
      const innerChildren = tile.children ?? []
      dispatch({ type: 'SET_CURSOR', parentId: tile.id, index: innerChildren.length })
    }
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
        border: containerBorder,
        background: containerBg,
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
      role={isContainer || isControlFlow ? 'group' : 'option'}
      aria-label={getTileAriaLabel(tile, depth)}
      aria-selected={selected}
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
        <ContainerTileContent tile={tile} depth={depth} dispatch={dispatch} allSelectedIds={allSelectedIds} cursorParentId={cursorParentId} cursorIndex={cursorIndex} isDragging={isGlobalDragging} />
      ) : isControlFlow ? (
        <IfThenElseContent tile={tile} depth={depth} dispatch={dispatch} allSelectedIds={allSelectedIds} cursorParentId={cursorParentId} cursorIndex={cursorIndex} isDragging={isGlobalDragging} />
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
    case 'round':    return `round(${tile.precision ?? 1})`
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

function getTileAriaLabel(tile: ExpressionTile, depth: number): string {
  const isContainer = ['group', 'square', 'cube', 'round', 'negate', 'abs'].includes(tile.type)
  const isControlFlow = tile.type === 'if_then_else'
  if (isContainer || isControlFlow) {
    switch (tile.type) {
      case 'group':        return `Group, level ${depth + 1}`
      case 'square':       return `Square container, level ${depth + 1}`
      case 'cube':         return `Cube container, level ${depth + 1}`
      case 'round':        return `Round container, increment ${tile.precision ?? 1}, level ${depth + 1}`
      case 'negate':       return `Negate container, level ${depth + 1}`
      case 'abs':          return `Absolute value container, level ${depth + 1}`
      case 'if_then_else': return `If-then-else container, level ${depth + 1}`
      default:             return `Container, level ${depth + 1}`
    }
  }
  switch (tile.type) {
    case 'add':            return 'Plus operator'
    case 'subtract':       return 'Minus operator'
    case 'multiply':       return 'Multiply operator'
    case 'divide':         return 'Divide operator'
    case 'modulus':        return 'Modulus operator'
    case 'power':          return 'Power operator'
    case 'gt':             return 'Greater than operator'
    case 'lt':             return 'Less than operator'
    case 'gte':            return 'Greater than or equal operator'
    case 'lte':            return 'Less than or equal operator'
    case 'and':            return 'AND operator'
    case 'or':             return 'OR operator'
    case 'not':            return 'NOT operator'
    case 'time_now':       return 'Current time function'
    case 'elapsed_since':  return 'Elapsed since function'
    case 'duration_above': return 'Duration above function'
    case 'duration_below': return 'Duration below function'
    case 'agg_avg':        return 'Average aggregate function'
    case 'agg_sum':        return 'Sum aggregate function'
    case 'agg_min':        return 'Minimum aggregate function'
    case 'agg_max':        return 'Maximum aggregate function'
    case 'agg_count':      return 'Count aggregate function'
    case 'point_ref':      return `Point Reference: ${tile.pointLabel ?? tile.pointId ?? 'current point'}`
    case 'field_ref':      return `Field Reference: ${tile.fieldName ?? 'field'}`
    case 'constant':       return `Value: ${tile.value ?? 0}`
    default:               return tile.type
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
  cursorParentId,
  cursorIndex,
  isDragging,
}: {
  tile: ExpressionTile
  depth: number
  dispatch: React.Dispatch<Action>
  allSelectedIds: string[]
  cursorParentId: string | null
  cursorIndex: number
  isDragging: boolean
}) {
  const children = tile.children ?? []
  const label = getTileLabel(tile)
  const theme = useThemeName()
  const nestingStyle = getNestingStyle(depth, theme)

  return (
    <div>
      <div style={{ fontSize: '11px', color: nestingStyle.color, marginBottom: '4px', fontWeight: 600 }}>
        {label}
      </div>
      <DropZoneRow
        tiles={children}
        parentId={tile.id}
        depth={depth + 1}
        dispatch={dispatch}
        allSelectedIds={allSelectedIds}
        cursorParentId={cursorParentId}
        cursorIndex={cursorIndex}
        isDragging={isDragging}
      />
      {tile.type === 'round' && (
        <div style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ fontSize: '11px', color: 'var(--io-text-muted)' }}>increment:</span>
          <select
            value={tile.precision ?? 1}
            onChange={(e) => dispatch({ type: 'UPDATE_TILE', id: tile.id, patch: { precision: parseFloat(e.target.value) } })}
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
            {ROUND_INCREMENTS.map((inc) => (
              <option key={inc} value={inc}>{inc}</option>
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
  cursorParentId,
  cursorIndex,
  isDragging,
}: {
  tile: ExpressionTile
  depth: number
  dispatch: React.Dispatch<Action>
  allSelectedIds: string[]
  cursorParentId: string | null
  cursorIndex: number
  isDragging: boolean
}) {
  const sections = [
    { label: 'IF', tiles: tile.condition ?? [], key: 'condition' as const },
    { label: 'THEN', tiles: tile.thenBranch ?? [], key: 'thenBranch' as const },
    { label: 'ELSE', tiles: tile.elseBranch ?? [], key: 'elseBranch' as const },
  ]
  const theme = useThemeName()
  const nestingStyle = getNestingStyle(depth, theme)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {sections.map((sec) => (
        <div key={sec.key}>
          <div style={{ fontSize: '10px', color: nestingStyle.color, fontWeight: 700, marginBottom: '3px' }}>
            {sec.label}
          </div>
          <DropZoneRow
            tiles={sec.tiles}
            parentId={tile.id}
            depth={depth + 1}
            dispatch={dispatch}
            allSelectedIds={allSelectedIds}
            sectionKey={sec.key}
            cursorParentId={cursorParentId}
            cursorIndex={cursorIndex}
            isDragging={isDragging}
          />
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Breadcrumb helpers
// ---------------------------------------------------------------------------

interface BreadcrumbItem {
  /** null means "Root" (top-level scope) */
  parentId: string | null
  label: string
}

/**
 * Build the ordered list of breadcrumb items for the current cursor position.
 *
 * Returns an array starting with the root item and ending with the item
 * that corresponds to the container identified by `targetParentId`.
 *
 * Example for cursor inside round(…) which is itself inside group(…):
 *   [ { parentId: null, label: 'Root' },
 *     { parentId: 'abc', label: '(…)' },
 *     { parentId: 'def', label: 'round(1)' } ]
 */
function buildBreadcrumbPath(
  tiles: ExpressionTile[],
  targetParentId: string | null,
): BreadcrumbItem[] {
  if (targetParentId === null) return []

  /** Walk the tile tree; collect the path of containers from root to targetParentId. */
  function walk(
    current: ExpressionTile[],
    path: BreadcrumbItem[],
  ): BreadcrumbItem[] | null {
    for (const tile of current) {
      if (tile.id === targetParentId) {
        // Found it — return the path up to (and including) this container
        return [
          ...path,
          { parentId: tile.id, label: getTileLabel(tile) },
        ]
      }
      // Recurse into all child arrays
      for (const sub of [tile.children, tile.condition, tile.thenBranch, tile.elseBranch]) {
        if (!sub) continue
        const result = walk(sub, [
          ...path,
          { parentId: tile.id, label: getTileLabel(tile) },
        ])
        if (result !== null) return result
      }
    }
    return null
  }

  const found = walk(tiles, [])
  if (!found) return []
  // Prepend the Root item
  return [{ parentId: null, label: 'Root' }, ...found]
}

// ---------------------------------------------------------------------------
// Breadcrumb navigation component
// ---------------------------------------------------------------------------

interface BreadcrumbNavProps {
  tiles: ExpressionTile[]
  cursorParentId: string | null
  dispatch: React.Dispatch<Action>
}

function BreadcrumbNav({ tiles, cursorParentId, dispatch }: BreadcrumbNavProps) {
  if (cursorParentId === null) return null

  const path = buildBreadcrumbPath(tiles, cursorParentId)
  if (path.length === 0) return null

  return (
    <nav
      aria-label="Expression nesting path"
      style={{
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '2px',
        padding: '5px 10px',
        background: 'var(--io-surface-secondary)',
        border: '1px solid var(--io-border)',
        borderRadius: 'var(--io-radius)',
        fontSize: '12px',
        marginBottom: '4px',
      }}
    >
      {path.map((item, i) => {
        const isLast = i === path.length - 1
        return (
          <React.Fragment key={item.parentId ?? '__root__'}>
            <button
              onClick={() => {
                dispatch({ type: 'SET_CURSOR', parentId: item.parentId, index: 0 })
              }}
              style={{
                background: 'none',
                border: 'none',
                padding: '2px 4px',
                borderRadius: '3px',
                cursor: isLast ? 'default' : 'pointer',
                color: isLast ? 'var(--io-text-primary)' : 'var(--io-accent)',
                fontWeight: isLast ? 600 : 400,
                fontSize: '12px',
                textDecoration: isLast ? 'none' : 'underline',
                opacity: isLast ? 1 : 0.85,
              }}
              aria-current={isLast ? 'location' : undefined}
              disabled={isLast}
            >
              {item.label}
            </button>
            {!isLast && (
              <span
                aria-hidden="true"
                style={{ color: 'var(--io-text-muted)', userSelect: 'none', padding: '0 1px' }}
              >
                {'>'}
              </span>
            )}
          </React.Fragment>
        )
      })}
    </nav>
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
  cursorParentId: string | null
  cursorIndex: number
  isDragging: boolean
}

// Inject CSS keyframes for cursor blink and hover once per page load
let _cursorStyleInjected = false
function ensureCursorStyle() {
  if (_cursorStyleInjected) return
  _cursorStyleInjected = true
  const style = document.createElement('style')
  style.textContent = [
    `@keyframes io-cursor-blink { 0%,49% { opacity: 1 } 50%,100% { opacity: 0 } }`,
    `.io-hitbox:hover .io-hitbox-preview { opacity: 1 !important; }`,
  ].join('\n')
  document.head.appendChild(style)
}

function DropZoneRow({ tiles, parentId, depth, dispatch, allSelectedIds, cursorParentId, cursorIndex, isDragging }: DropZoneRowProps) {
  // Inject cursor blink animation once
  React.useEffect(() => { ensureCursorStyle() }, [])

  // When the depth at this zone equals or exceeds MAX_NESTING_DEPTH, container
  // tiles cannot be dropped here. We show a subtle visual hint.
  const depthBlocked = depth >= MAX_NESTING_DEPTH

  const showCursorHere = cursorParentId === parentId

  // Register this zone as a droppable when it belongs to a container (parentId != null).
  // The droppable id encodes the parentId so handleDragEnd can route drops into the
  // correct container even when the zone is empty (no sortable children).
  const droppableId = parentId !== null ? `container-zone-${parentId}` : 'root-zone'
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({ id: droppableId, data: { parentId } })

  function renderCursor(index: number) {
    if (!showCursorHere || cursorIndex !== index) return null
    return (
      <div
        key={`cursor-${index}`}
        role="presentation"
        aria-label="Insertion cursor"
        style={{
          width: '2px',
          minWidth: '2px',
          height: '36px',
          background: 'var(--io-accent)',
          boxShadow: '0 0 4px var(--io-accent)',
          animation: isDragging ? 'none' : 'io-cursor-blink 1.06s step-end infinite',
          flexShrink: 0,
          alignSelf: 'center',
          borderRadius: '1px',
        }}
      />
    )
  }

  function renderHitbox(index: number) {
    const isActive = showCursorHere && cursorIndex === index
    return (
      <div
        key={`hitbox-${index}`}
        className="io-hitbox"
        onClick={(e) => {
          e.stopPropagation()
          dispatch({ type: 'SET_CURSOR', parentId, index })
        }}
        style={{
          width: '10px',
          height: '36px',
          flexShrink: 0,
          cursor: 'text',
          alignSelf: 'center',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
        aria-hidden="true"
      >
        {/* Hover preview line — appears when hovering over the hitbox and cursor is not already here */}
        {!isActive && (
          <div
            className="io-hitbox-preview"
            style={{
              position: 'absolute',
              width: '2px',
              height: '28px',
              background: 'var(--io-accent)',
              borderRadius: '1px',
              opacity: 0,
              transition: 'opacity 0.1s',
              pointerEvents: 'none',
            }}
          />
        )}
      </div>
    )
  }

  return (
    <SortableContext
      items={tiles.map((t) => t.id)}
      strategy={horizontalListSortingStrategy}
    >
      <div
        ref={setDroppableRef}
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0',
          minHeight: '36px',
          padding: '4px',
          border: depthBlocked
            ? '1px dashed var(--io-danger, #ef4444)'
            : isOver && tiles.length === 0
              ? '1px dashed var(--io-accent, #3b82f6)'
              : '1px dashed var(--io-border)',
          borderRadius: 'var(--io-radius)',
          alignItems: 'flex-start',
          background: depthBlocked
            ? 'rgba(239,68,68,0.05)'
            : isOver && tiles.length === 0
              ? 'rgba(59,130,246,0.08)'
              : 'rgba(255,255,255,0.02)',
        }}
        data-parent-id={parentId ?? 'root'}
        data-depth-blocked={depthBlocked ? 'true' : undefined}
        title={depthBlocked ? 'Maximum nesting depth (5 levels) reached.' : undefined}
      >
        {/* Cursor/hitbox before index 0 */}
        {renderCursor(0)}
        {renderHitbox(0)}
        {tiles.map((tile, i) => (
          <React.Fragment key={tile.id}>
            <WorkspaceTile
              tile={tile}
              selected={allSelectedIds.includes(tile.id)}
              depth={depth}
              dispatch={dispatch}
              allSelectedIds={allSelectedIds}
              cursorParentId={cursorParentId}
              cursorIndex={cursorIndex}
              isDragging={isDragging}
            />
            {/* Cursor/hitbox after tile at index i+1 */}
            {renderCursor(i + 1)}
            {renderHitbox(i + 1)}
          </React.Fragment>
        ))}
        {tiles.length === 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '4px 6px',
              alignSelf: 'center',
              color: 'var(--io-text-muted)',
              fontSize: '11px',
              pointerEvents: 'none',
              userSelect: 'none',
            }}
          >
            {/* Visible cursor indicator in empty state */}
            <div
              role="presentation"
              style={{
                width: '2px',
                minWidth: '2px',
                height: '28px',
                background: 'var(--io-accent)',
                boxShadow: '0 0 4px var(--io-accent)',
                animation: isDragging ? 'none' : 'io-cursor-blink 1.06s step-end infinite',
                borderRadius: '1px',
                flexShrink: 0,
              }}
            />
            <span>Click palette tiles to insert, or drag them here</span>
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
  const theme = useThemeName()
  const depth0Style = getNestingStyle(0, theme)

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette-${item.type}`,
    data: { source: 'palette', tileType: item.type },
  })

  return (
    <button
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={() => onClickAdd(item.type)}
      title={`Add ${item.label}`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '5px 10px',
        borderRadius: 'var(--io-radius)',
        border: isContainer ? `${depth0Style.borderStyle} ${depth0Style.color}` : 'none',
        background: isContainer ? `rgba(${hexToRgb(depth0Style.color)}, ${depth0Style.bgAlpha})` : bg,
        color: '#fff',
        fontSize: '12px',
        fontWeight: 500,
        cursor: isDragging ? 'grabbing' : 'pointer',
        whiteSpace: 'nowrap',
        transition: 'opacity 0.15s',
        opacity: isDragging ? 0.4 : 1,
      }}
      onMouseEnter={(e) => { if (!isDragging) (e.currentTarget as HTMLButtonElement).style.opacity = '0.8' }}
      onMouseLeave={(e) => { if (!isDragging) (e.currentTarget as HTMLButtonElement).style.opacity = '1' }}
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
  const isAdmin = user?.permissions.includes('system:expression_manage') ?? false

  const [state, dispatch] = useReducer(exprReducer, {
    tiles: [],
    selectedIds: [],
    cursorParentId: null,
    cursorIndex: 0,
    name: '',
    description: '',
    outputType: initialExpression?.output?.type ?? 'float',
    outputPrecision: initialExpression?.output?.precision ?? 2,
    saveForFuture: true,
    shareExpression: false,
    past: [],
    future: [],
    clipboard: null,
  })

  const [showTest, setShowTest] = useState(false)
  const [testValues, setTestValues] = useState<Record<string, string>>({})
  const [showPreview, setShowPreview] = useState(true)
  const [activeDragId, setActiveDragId] = useState<string | null>(null)
  const [benchmarkRunning, setBenchmarkRunning] = useState(false)

  // Cancel-confirmation dialog state
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  // Cut-confirmation dialog state
  const [showCutConfirm, setShowCutConfirm] = useState(false)

  // Capture initial header field values on mount for dirty tracking
  const initialHeaderRef = useRef({
    name: state.name,
    description: state.description,
    outputType: state.outputType,
    saveForFuture: state.saveForFuture,
    shareExpression: state.shareExpression,
  })

  // Dirty: tiles changed (past stack non-empty) OR any header field differs from initial
  const isHeaderDirty =
    state.name !== initialHeaderRef.current.name ||
    state.description !== initialHeaderRef.current.description ||
    state.outputType !== initialHeaderRef.current.outputType ||
    state.saveForFuture !== initialHeaderRef.current.saveForFuture ||
    state.shareExpression !== initialHeaderRef.current.shareExpression
  const isDirty = state.past.length > 0 || isHeaderDirty

  // OK-flow dialog state
  const [nameError, setNameError] = useState<string | null>(null)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [showSlowWarning, setShowSlowWarning] = useState(false)
  const [slowWarningAvgMs, setSlowWarningAvgMs] = useState<number>(0)
  const [showErrorDialog, setShowErrorDialog] = useState(false)
  const [okFlowRunning, setOkFlowRunning] = useState(false)
  // Holds the resolved AST during the multi-step OK flow
  const pendingAstRef = useRef<ExpressionAst | null>(null)
  const [benchmarkAvgMs, setBenchmarkAvgMs] = useState<number | null>(null)
  const [benchmarkResult, setBenchmarkResult] = useState<number | null | 'timeout'>(null)
  const [benchmarkWarnings, setBenchmarkWarnings] = useState<string[]>([])
  const benchmarkWorkerRef = useRef<Worker | null>(null)
  const workspaceRef = useRef<HTMLDivElement>(null)

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

  const validation = validateExpression(state)

  // Keyboard shortcut undo/redo + clipboard
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault()
          dispatch({ type: 'UNDO' })
        } else if ((e.key === 'y') || (e.key === 'z' && e.shiftKey)) {
          e.preventDefault()
          dispatch({ type: 'REDO' })
        } else if (e.key === 'c') {
          e.preventDefault()
          dispatch({ type: 'COPY_SELECTION' })
        } else if (e.key === 'x') {
          e.preventDefault()
          // Show confirmation before cutting (destroying tiles)
          setShowCutConfirm(true)
        } else if (e.key === 'v') {
          e.preventDefault()
          dispatch({ type: 'PASTE' })
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Arrow key cursor navigation for the workspace.
  // This handler is attached to the workspace `role="application"` div so that
  // ArrowLeft / ArrowRight keydown events originating from focused tiles (or the
  // workspace itself) are intercepted before they can bubble past the dialog and
  // accidentally trigger app-shell keyboard shortcuts or native ARIA focus
  // movement to sidebar links.
  const handleWorkspaceKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault()
      e.stopPropagation()
      const arr = state.cursorParentId === null
        ? state.tiles
        : (getChildArray(state.tiles, state.cursorParentId) ?? state.tiles)
      if (e.key === 'ArrowLeft') {
        const newIndex = Math.max(0, state.cursorIndex - 1)
        dispatch({ type: 'SET_CURSOR', parentId: state.cursorParentId, index: newIndex })
      } else {
        const newIndex = Math.min(arr.length, state.cursorIndex + 1)
        dispatch({ type: 'SET_CURSOR', parentId: state.cursorParentId, index: newIndex })
      }
    } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      // Prevent arrow keys from escaping the dialog entirely even if we have
      // no vertical cursor movement to implement yet.
      e.preventDefault()
      e.stopPropagation()
    } else if (e.key === 'Tab') {
      // Allow Tab to cycle within the dialog naturally (Radix Dialog manages
      // the focus trap), but stop it propagating past this element to avoid
      // triggering any window-level Tab handlers on the app shell.
      e.stopPropagation()
    }
  }, [state.cursorParentId, state.cursorIndex, state.tiles, dispatch])

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
      index: state.cursorIndex,
    })
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveDragId(String(event.active.id))
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setActiveDragId(null)
    if (!over || active.id === over.id) return

    // Detect palette-sourced drags
    const isPaletteSource = String(active.id).startsWith('palette-')
    if (isPaletteSource) {
      const tileType = active.data.current?.tileType as TileType
      if (!tileType) return
      const tile = createTile(tileType)
      const overId = String(over.id)

      // Case 1: dropped onto a DropZoneRow interior (container-zone-{parentId}).
      // Insert as the last child of that container.
      if (overId.startsWith('container-zone-')) {
        const zoneParentId = overId.slice('container-zone-'.length)
        const childArr = getChildArray(state.tiles, zoneParentId) ?? []
        dispatch({
          type: 'INSERT_TILE',
          tile,
          parentId: zoneParentId,
          index: childArr.length,
        })
        return
      }

      const toLoc = findTileLocation(state.tiles, overId)
      // Case 2: dropped onto a container tile itself — insert as its last child.
      const overTile = toLoc ? toLoc.arr[toLoc.index] : null
      const overIsContainer = overTile != null && CONTAINER_TILE_TYPES.includes(overTile.type)
      if (overIsContainer && overTile != null) {
        const children = overTile.children ?? overTile.condition ?? overTile.thenBranch ?? []
        dispatch({
          type: 'INSERT_TILE',
          tile,
          parentId: overTile.id,
          index: children.length,
        })
      } else {
        // Case 3: dropped onto a non-container tile — insert as a sibling at that position.
        // Use findParentId to find which parent array the target tile lives in.
        const parentId = findParentId(state.tiles, overId) ?? null
        const insertIndex = toLoc?.index ?? (parentId === null ? state.tiles.length : 0)
        dispatch({
          type: 'INSERT_TILE',
          tile,
          parentId,
          index: insertIndex,
        })
      }
      return
    }

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

  function runBenchmark() {
    if (!validation.valid) return

    // Static analysis before launching worker
    const warnings: string[] = []

    function scanTiles(tiles: ExpressionTile[]) {
      for (let i = 0; i < tiles.length; i++) {
        const tile = tiles[i]
        // Warn on nested exponentiation: a power tile immediately adjacent to another power tile
        if (tile.type === 'power' && i > 0 && tiles[i - 1]?.type === 'power') {
          warnings.push('Nested exponentiation detected — this may produce unexpectedly large values.')
        }
        // Warn on division by literal zero
        if (tile.type === 'divide' && i + 1 < tiles.length && tiles[i + 1]?.type === 'constant' && tiles[i + 1].value === 0) {
          warnings.push('Potential divide-by-zero: division followed by a constant 0.')
        }
        if (tile.children) scanTiles(tile.children)
        if (tile.condition) scanTiles(tile.condition)
        if (tile.thenBranch) scanTiles(tile.thenBranch)
        if (tile.elseBranch) scanTiles(tile.elseBranch)
      }
    }

    scanTiles(state.tiles)

    function countTiles(tiles: ExpressionTile[]): number {
      let n = tiles.length
      for (const tile of tiles) {
        if (tile.children) n += countTiles(tile.children)
        if (tile.condition) n += countTiles(tile.condition)
        if (tile.thenBranch) n += countTiles(tile.thenBranch)
        if (tile.elseBranch) n += countTiles(tile.elseBranch)
      }
      return n
    }

    if (countTiles(state.tiles) > 100) {
      warnings.push('Expression has more than 100 tiles — evaluation may be slow.')
    }

    setBenchmarkWarnings(warnings)
    setBenchmarkRunning(true)
    setBenchmarkAvgMs(null)
    setBenchmarkResult(null)

    // Terminate any prior worker
    if (benchmarkWorkerRef.current) {
      benchmarkWorkerRef.current.terminate()
    }

    const worker = new Worker(
      new URL('../../../workers/expressionBenchmark.worker.ts', import.meta.url),
      { type: 'module' },
    )
    benchmarkWorkerRef.current = worker

    const timeout = setTimeout(() => {
      worker.terminate()
      benchmarkWorkerRef.current = null
      setBenchmarkRunning(false)
      setBenchmarkResult('timeout')
    }, 5000)

    worker.onmessage = (e: MessageEvent<{ avgMs: number; result: number | null }>) => {
      clearTimeout(timeout)
      worker.terminate()
      benchmarkWorkerRef.current = null
      setBenchmarkRunning(false)
      setBenchmarkAvgMs(e.data.avgMs)
      setBenchmarkResult(e.data.result)
    }

    worker.onerror = () => {
      clearTimeout(timeout)
      worker.terminate()
      benchmarkWorkerRef.current = null
      setBenchmarkRunning(false)
      setBenchmarkResult('timeout')
    }

    worker.postMessage({ tiles: state.tiles, testValues: testNumericValues })
  }

  // ---------------------------------------------------------------------------
  // OK flow — runs the benchmark and optionally saves before calling onApply
  // ---------------------------------------------------------------------------

  function buildAst(): ExpressionAst {
    const root = tilesToAst(state.tiles, context)
    return {
      version: 1,
      context,
      root,
      output: {
        type: state.outputType,
        precision: state.outputPrecision,
      },
    }
  }

  function handleOkClick() {
    if (!validation.valid) return

    // Validate name when saving
    if (state.saveForFuture && !state.name.trim()) {
      setNameError('Expression name is required when "Save for Future Use" is checked.')
      return
    }
    setNameError(null)

    // Capture the AST for use later in the flow
    pendingAstRef.current = buildAst()

    // Show the appropriate confirmation dialog
    setShowConfirmDialog(true)
  }

  // Called when the user confirms the confirmation dialog
  const handleConfirmOk = useCallback(async () => {
    setShowConfirmDialog(false)
    setOkFlowRunning(true)

    const ast = pendingAstRef.current
    if (!ast) {
      setOkFlowRunning(false)
      return
    }

    // Run benchmark via Worker (same logic as runBenchmark)
    const benchmarkResult = await new Promise<{ avgMs: number; result: number | null } | 'timeout' | 'error'>((resolve) => {
      const worker = new Worker(
        new URL('../../../workers/expressionBenchmark.worker.ts', import.meta.url),
        { type: 'module' },
      )

      const timeout = setTimeout(() => {
        worker.terminate()
        resolve('timeout')
      }, 5000)

      worker.onmessage = (e: MessageEvent<{ avgMs: number; result: number | null }>) => {
        clearTimeout(timeout)
        worker.terminate()
        resolve(e.data)
      }

      worker.onerror = () => {
        clearTimeout(timeout)
        worker.terminate()
        resolve('error')
      }

      worker.postMessage({ tiles: state.tiles, testValues: testNumericValues })
    })

    // Handle benchmark outcomes
    if (benchmarkResult === 'timeout' || benchmarkResult === 'error') {
      setOkFlowRunning(false)
      setShowErrorDialog(true)
      return
    }

    if (benchmarkResult.result === null) {
      // Expression produced an evaluation error (e.g. division by zero)
      setOkFlowRunning(false)
      setShowErrorDialog(true)
      return
    }

    if (benchmarkResult.avgMs > 1) {
      // Warn about slow expression
      setSlowWarningAvgMs(benchmarkResult.avgMs)
      setOkFlowRunning(false)
      setShowSlowWarning(true)
      return
    }

    // All checks passed — proceed to save + apply
    await doSaveAndApply(ast)
  }, [state.tiles, state.saveForFuture, state.name, state.description, state.shareExpression, testNumericValues])

  // Called by slow-warning "Accept & Apply" button and by the normal path
  const doSaveAndApply = useCallback(async (ast: ExpressionAst) => {
    setOkFlowRunning(true)
    try {
      if (state.saveForFuture) {
        const result = await expressionsApi.create({
          name: state.name.trim(),
          description: state.description.trim() || undefined,
          context,
          ast,
          is_shared: state.shareExpression,
        })
        if (!result.success) {
          const errMsg = result.error?.message ?? 'Failed to save expression.'
          showToast({ title: 'Save failed', description: errMsg, variant: 'error', duration: 5000 })
          setOkFlowRunning(false)
          return
        }
      }
      onApply(ast)
    } catch (err) {
      showToast({ title: 'Save failed', description: String(err), variant: 'error', duration: 5000 })
    } finally {
      setOkFlowRunning(false)
    }
  }, [state.saveForFuture, state.name, state.description, state.shareExpression, context, onApply])

  // Shared button styles
  const okDisabled = !validation.valid || okFlowRunning

  const btnPrimary: React.CSSProperties = {
    padding: '8px 20px',
    background: 'var(--io-accent)',
    color: '#09090b',
    border: 'none',
    borderRadius: 'var(--io-radius)',
    fontSize: '13px',
    fontWeight: 600,
    cursor: okDisabled ? 'not-allowed' : 'pointer',
    opacity: okDisabled ? 0.5 : 1,
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
        position: 'relative',
      }}
    >
      {/* Header: Name, Description, checkboxes */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label style={labelStyle}>Expression Name</label>
            <input
              style={{
                ...inputStyle,
                borderColor: nameError ? 'var(--io-danger)' : undefined,
              }}
              placeholder="e.g. Pump Efficiency Formula"
              value={state.name}
              onChange={(e) => {
                dispatch({ type: 'SET_NAME', value: e.target.value })
                if (nameError) setNameError(null)
              }}
            />
            {nameError && (
              <div style={{ fontSize: '12px', color: 'var(--io-danger)', marginTop: '4px' }}>
                {nameError}
              </div>
            )}
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

      {/* Palette + Workspace share a single DndContext so palette→workspace drag works */}
      <DndContext
        sensors={sensors}
        collisionDetection={customCollisionDetection}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >

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

      {/* Breadcrumb navigation — shows nesting path when cursor is inside a container */}
      <BreadcrumbNav
        tiles={state.tiles}
        cursorParentId={state.cursorParentId}
        dispatch={dispatch}
      />

      {/* Workspace */}
        <div
          ref={workspaceRef}
          role="application"
          aria-label="Equation workspace"
          tabIndex={0}
          style={{
            flex: 1,
            minHeight: '100px',
            maxHeight: '280px',
            overflowY: 'auto',
            background: 'var(--io-surface-sunken)',
            border: '1px solid var(--io-border)',
            borderRadius: 'var(--io-radius)',
            padding: '10px',
            outline: 'none',
          }}
          onClick={() => {
            dispatch({ type: 'SELECT', ids: [], additive: false })
            dispatch({ type: 'SET_CURSOR', parentId: null, index: state.tiles.length })
            workspaceRef.current?.focus()
          }}
          onKeyDown={handleWorkspaceKeyDown}
        >
          <DropZoneRow
            tiles={state.tiles}
            parentId={null}
            depth={0}
            dispatch={dispatch}
            allSelectedIds={state.selectedIds}
            cursorParentId={state.cursorParentId}
            cursorIndex={state.cursorIndex}
            isDragging={activeDragId !== null}
          />
        </div>

        <DragOverlay>
          {activeDragId && (() => {
            // Palette drag ghost
            if (activeDragId.startsWith('palette-')) {
              const tileType = activeDragId.slice('palette-'.length) as TileType
              const paletteItem = paletteItems.find((p) => p.type === tileType)
              if (!paletteItem) return null
              return (
                <div style={{
                  padding: '4px 10px',
                  borderRadius: 'var(--io-radius)',
                  background: getTileColor(tileType),
                  color: '#fff',
                  fontSize: '12px',
                  fontWeight: 500,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                  pointerEvents: 'none',
                }}>
                  {paletteItem.label}
                </div>
              )
            }
            // Workspace tile drag ghost
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

          {/* Run benchmark button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
            <button
              style={{
                ...btnSecondary,
                padding: '5px 14px',
                fontSize: '12px',
                opacity: validation.valid && !benchmarkRunning ? 1 : 0.5,
              }}
              disabled={!validation.valid || benchmarkRunning}
              onClick={runBenchmark}
              title={!validation.valid ? 'Fix validation errors before running benchmark' : 'Run 10,000-iteration benchmark in background thread'}
            >
              {benchmarkRunning ? 'Running...' : 'Run Benchmark (10k)'}
            </button>
            {!validation.valid && (
              <span style={{ fontSize: '12px', color: 'var(--io-text-muted)' }}>
                Fix validation errors to enable benchmark.
              </span>
            )}
          </div>

          {/* Static analysis warnings */}
          {benchmarkWarnings.length > 0 && (
            <div style={{ marginBottom: '10px' }}>
              {benchmarkWarnings.map((w, i) => (
                <div key={i} style={{ fontSize: '12px', color: 'var(--io-warning, #d4a017)', marginBottom: '4px' }}>
                  Warning: {w}
                </div>
              ))}
            </div>
          )}

          {/* Benchmark result */}
          {benchmarkResult === 'timeout' && (
            <div style={{ fontSize: '13px', color: 'var(--io-danger)', fontWeight: 600 }}>
              Benchmark timed out (exceeded 5 seconds). Expression may be too expensive to evaluate in real-time.
            </div>
          )}
          {benchmarkResult !== 'timeout' && benchmarkAvgMs !== null && (
            <div style={{ fontSize: '13px', fontWeight: 600 }}>
              <span style={{ color: 'var(--io-text-secondary)' }}>
                Result:{' '}
                <span style={{ color: 'var(--io-text-primary)' }}>
                  {benchmarkResult === null ? 'Error (division by zero or incomplete expression)' : String(benchmarkResult)}
                </span>
              </span>
              {'  '}
              <span
                style={{
                  color:
                    benchmarkAvgMs < 0.1
                      ? '#22c55e'
                      : benchmarkAvgMs < 1
                        ? '#eab308'
                        : benchmarkAvgMs < 10
                          ? '#f97316'
                          : '#ef4444',
                  marginLeft: '12px',
                }}
              >
                {benchmarkAvgMs < 0.1
                  ? `Fast — ${benchmarkAvgMs.toFixed(4)} ms/eval`
                  : benchmarkAvgMs < 1
                    ? `Acceptable — ${benchmarkAvgMs.toFixed(4)} ms/eval`
                    : benchmarkAvgMs < 10
                      ? `Slow — ${benchmarkAvgMs.toFixed(4)} ms/eval (consider simplifying)`
                      : `Too Slow — ${benchmarkAvgMs.toFixed(4)} ms/eval (not recommended for real-time use)`}
              </span>
            </div>
          )}
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
            role="math"
            aria-label={previewStr ? previewStr : 'empty expression'}
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

      {/* Visually-hidden live region: announces expression changes to screen readers */}
      <div
        aria-live="polite"
        aria-atomic="true"
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: 0,
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0,0,0,0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      >
        {previewStr || 'empty expression'}
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
        <button
          style={btnSecondary}
          disabled={okFlowRunning}
          onClick={() => {
            if (isDirty) {
              setShowCancelConfirm(true)
            } else {
              onCancel()
            }
          }}
        >
          Cancel
        </button>
        <button style={btnPrimary} disabled={okDisabled} onClick={handleOkClick}>
          {okFlowRunning ? 'Working...' : 'OK'}
        </button>
      </div>

      {/* ---- Confirmation dialog ---- */}
      <Dialog.Root open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <Dialog.Portal>
          <Dialog.Overlay style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 1000,
          }} />
          <Dialog.Content style={{
            position: 'fixed',
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'var(--io-surface)',
            border: '1px solid var(--io-border)',
            borderRadius: 'var(--io-radius)',
            padding: '24px',
            minWidth: '360px',
            maxWidth: '480px',
            zIndex: 1001,
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}>
            <Dialog.Title style={{ fontSize: '15px', fontWeight: 600, color: 'var(--io-text-primary)', marginBottom: '12px' }}>
              Confirm
            </Dialog.Title>
            <Dialog.Description style={{ fontSize: '14px', color: 'var(--io-text-secondary)', marginBottom: '20px' }}>
              {state.saveForFuture
                ? 'Test this expression, save it, and apply it?'
                : 'Test this expression and apply it?'}
            </Dialog.Description>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button style={btnSecondary} onClick={() => setShowConfirmDialog(false)}>
                Cancel
              </button>
              <button style={btnPrimary} onClick={() => { void handleConfirmOk() }}>
                {state.saveForFuture ? 'Save & Apply' : 'Apply'}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* ---- Error dialog (expression evaluation error) ---- */}
      <Dialog.Root open={showErrorDialog} onOpenChange={setShowErrorDialog}>
        <Dialog.Portal>
          <Dialog.Overlay style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 1000,
          }} />
          <Dialog.Content style={{
            position: 'fixed',
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'var(--io-surface)',
            border: '1px solid rgba(239,68,68,0.4)',
            borderRadius: 'var(--io-radius)',
            padding: '24px',
            minWidth: '360px',
            maxWidth: '480px',
            zIndex: 1001,
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}>
            <Dialog.Title style={{ fontSize: '15px', fontWeight: 600, color: 'var(--io-danger)', marginBottom: '12px' }}>
              Expression Error
            </Dialog.Title>
            <Dialog.Description style={{ fontSize: '14px', color: 'var(--io-text-secondary)', marginBottom: '20px' }}>
              This expression produces an error. Please check your formula.
            </Dialog.Description>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button style={btnSecondary} onClick={() => setShowErrorDialog(false)}>
                Cancel
              </button>
              {state.saveForFuture && (
                <button style={btnSecondary} onClick={() => {
                  setShowErrorDialog(false)
                  // Save for later without applying
                  void (async () => {
                    const ast = pendingAstRef.current
                    if (!ast) return
                    setOkFlowRunning(true)
                    const result = await expressionsApi.create({
                      name: state.name.trim(),
                      description: state.description.trim() || undefined,
                      context,
                      ast,
                      is_shared: state.shareExpression,
                    })
                    setOkFlowRunning(false)
                    if (result.success) {
                      showToast({ title: 'Saved', description: 'Expression saved for later use.', variant: 'success', duration: 3000 })
                    } else {
                      const errMsg = result.error?.message ?? 'Failed to save expression.'
                      showToast({ title: 'Save failed', description: errMsg, variant: 'error', duration: 5000 })
                    }
                  })()
                }}>
                  Save for Later
                </button>
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* ---- Cancel confirmation dialog ---- */}
      <Dialog.Root open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <Dialog.Portal>
          <Dialog.Overlay style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 1000,
          }} />
          <Dialog.Content style={{
            position: 'fixed',
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'var(--io-surface)',
            border: '1px solid var(--io-border)',
            borderRadius: 'var(--io-radius)',
            padding: '24px',
            minWidth: '360px',
            maxWidth: '480px',
            zIndex: 1001,
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}>
            <Dialog.Title style={{ fontSize: '15px', fontWeight: 600, color: 'var(--io-text-primary)', marginBottom: '12px' }}>
              You have unsaved changes.
            </Dialog.Title>
            <Dialog.Description style={{ fontSize: '14px', color: 'var(--io-text-secondary)', marginBottom: '20px' }}>
              Discard changes and close the expression builder?
            </Dialog.Description>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button style={btnSecondary} onClick={() => setShowCancelConfirm(false)}>
                Keep Editing
              </button>
              <button
                style={{
                  ...btnSecondary,
                  color: 'var(--io-danger)',
                  borderColor: 'rgba(239,68,68,0.4)',
                }}
                onClick={() => {
                  setShowCancelConfirm(false)
                  onCancel()
                }}
              >
                Discard
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* ---- Slow warning dialog ---- */}
      <Dialog.Root open={showSlowWarning} onOpenChange={setShowSlowWarning}>
        <Dialog.Portal>
          <Dialog.Overlay style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 1000,
          }} />
          <Dialog.Content style={{
            position: 'fixed',
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'var(--io-surface)',
            border: '1px solid rgba(234,179,8,0.4)',
            borderRadius: 'var(--io-radius)',
            padding: '24px',
            minWidth: '360px',
            maxWidth: '500px',
            zIndex: 1001,
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}>
            <Dialog.Title style={{ fontSize: '15px', fontWeight: 600, color: '#d4a017', marginBottom: '12px' }}>
              Slow Expression Warning
            </Dialog.Title>
            <Dialog.Description style={{ fontSize: '14px', color: 'var(--io-text-secondary)', marginBottom: '20px' }}>
              This expression averages <strong>{slowWarningAvgMs.toFixed(3)} ms</strong> per evaluation,
              which exceeds the 1 ms threshold for real-time use. It may impact system performance.
              Consider simplifying the expression before applying.
            </Dialog.Description>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', flexWrap: 'wrap' }}>
              <button style={btnSecondary} onClick={() => setShowSlowWarning(false)}>
                Cancel
              </button>
              {state.saveForFuture && (
                <button style={btnSecondary} onClick={() => {
                  setShowSlowWarning(false)
                  void (async () => {
                    const ast = pendingAstRef.current
                    if (!ast) return
                    setOkFlowRunning(true)
                    const result = await expressionsApi.create({
                      name: state.name.trim(),
                      description: state.description.trim() || undefined,
                      context,
                      ast,
                      is_shared: state.shareExpression,
                    })
                    setOkFlowRunning(false)
                    if (result.success) {
                      showToast({ title: 'Saved', description: 'Expression saved for later use.', variant: 'success', duration: 3000 })
                    } else {
                      const errMsg = result.error?.message ?? 'Failed to save expression.'
                      showToast({ title: 'Save failed', description: errMsg, variant: 'error', duration: 5000 })
                    }
                  })()
                }}>
                  Save for Later
                </button>
              )}
              <button style={btnPrimary} onClick={() => {
                setShowSlowWarning(false)
                const ast = pendingAstRef.current
                if (ast) void doSaveAndApply(ast)
              }}>
                Accept &amp; Apply
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* ---- Cut confirmation dialog ---- */}
      <Dialog.Root open={showCutConfirm} onOpenChange={setShowCutConfirm}>
        <Dialog.Portal>
          <Dialog.Overlay style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 1000,
          }} />
          <Dialog.Content style={{
            position: 'fixed',
            top: '50%', left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'var(--io-surface)',
            border: '1px solid var(--io-border)',
            borderRadius: 'var(--io-radius)',
            padding: '24px',
            minWidth: '360px',
            maxWidth: '480px',
            zIndex: 1001,
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}>
            <Dialog.Title style={{ fontSize: '15px', fontWeight: 600, color: 'var(--io-text-primary)', marginBottom: '12px' }}>
              Cut {state.selectedIds.length} tile{state.selectedIds.length !== 1 ? 's' : ''}?
            </Dialog.Title>
            <Dialog.Description style={{ fontSize: '14px', color: 'var(--io-text-secondary)', marginBottom: '20px' }}>
              The selected tile{state.selectedIds.length !== 1 ? 's' : ''} will be copied to the clipboard and removed from the workspace.
            </Dialog.Description>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button style={btnSecondary} onClick={() => setShowCutConfirm(false)}>
                Cancel
              </button>
              <button
                style={{
                  ...btnSecondary,
                  color: 'var(--io-danger)',
                  borderColor: 'rgba(239,68,68,0.4)',
                }}
                onClick={() => {
                  setShowCutConfirm(false)
                  dispatch({ type: 'CUT_SELECTION' })
                }}
              >
                Cut
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
