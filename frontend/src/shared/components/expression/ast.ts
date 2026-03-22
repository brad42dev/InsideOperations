// ---------------------------------------------------------------------------
// tilesToAst — converts flat infix ExpressionTile[] to a recursive ExprNode tree
// per doc 23 §11.2 and doc 37 wire format.
//
// The tile model is a flat infix sequence:
//   operand op operand op operand ...
// Binary operator tiles are interleaved between operand tiles.
// Unary-modifier tiles (square, cube, negate, abs, round) and container tiles
// (group, if_then_else) carry their operands in children / condition / thenBranch / elseBranch.
//
// This converter maps that model to a left-to-right binary tree (no precedence —
// the tile UI enforces explicit grouping via the `group` tile instead).
// ---------------------------------------------------------------------------

import type {
  ExpressionTile,
  ExpressionContext,
  ExprNode,
  LiteralNode,
  PointRefNode,
  FieldRefNode,
  UnaryNode,
  BinaryNode,
  FunctionNode,
  ConditionalNode,
  GroupNode,
} from '../../types/expression'

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Convert a flat infix ExpressionTile[] (the internal UI state) into a
 * recursive ExprNode tree (the wire format / storage format).
 *
 * The context parameter is passed through for completeness but is not used
 * within the tree itself — it belongs on the ExpressionAst wrapper.
 *
 * Returns a LiteralNode with value 0 for empty/invalid tile arrays, so the
 * result is always a valid ExprNode.
 */
export function tilesToAst(
  tiles: ExpressionTile[],
  _context?: ExpressionContext,
): ExprNode {
  if (tiles.length === 0) {
    return { type: 'literal', value: 0 } satisfies LiteralNode
  }
  const node = parseInfixTiles(tiles)
  return node ?? ({ type: 'literal', value: 0 } satisfies LiteralNode)
}

// ---------------------------------------------------------------------------
// Internal parsing
// ---------------------------------------------------------------------------

/** Map from binary operator TileType to its wire-format op string */
const BINARY_OP_MAP: Partial<Record<string, BinaryNode['op']>> = {
  add:      '+',
  subtract: '-',
  multiply: '*',
  divide:   '/',
  modulus:  '%',
  power:    '^',
  gt:       '>',
  lt:       '<',
  gte:      '>=',
  lte:      '<=',
}

const BINARY_OP_TYPES = new Set(Object.keys(BINARY_OP_MAP))
const LOGIC_OP_TYPES = new Set(['and', 'or'])

function isBinaryOpTile(type: string): boolean {
  return BINARY_OP_TYPES.has(type) || LOGIC_OP_TYPES.has(type)
}

/**
 * Parse a flat infix tile sequence to an ExprNode.
 * Pattern: operand (binaryOp operand)*
 * Left-to-right fold — no precedence, matching the UI model.
 */
function parseInfixTiles(tiles: ExpressionTile[]): ExprNode | null {
  if (tiles.length === 0) return null

  // Collect operand/operator segments
  // Skip over unrecognised tiles (defensive)
  let result: ExprNode | null = null
  let pendingOp: string | null = null

  let i = 0
  while (i < tiles.length) {
    const tile = tiles[i]

    if (isBinaryOpTile(tile.type)) {
      // Map 'and'/'or' to binary-style ops stored as strings (Rhai handles them)
      if (tile.type === 'and') {
        pendingOp = 'and'
      } else if (tile.type === 'or') {
        pendingOp = 'or'
      } else {
        pendingOp = BINARY_OP_MAP[tile.type] ?? null
      }
      i++
      continue
    }

    // Not op tile: try to build an operand node
    const operand = tileToNode(tile)
    if (operand === null) {
      i++
      continue
    }

    if (result === null) {
      result = operand
    } else if (pendingOp !== null) {
      // Left-fold: wrap result and operand in a BinaryNode
      result = {
        type: 'binary',
        op: pendingOp as BinaryNode['op'],
        left: result,
        right: operand,
      } satisfies BinaryNode
      pendingOp = null
    } else {
      // Two operands with no operator — malformed; keep left side
    }

    i++
  }

  return result
}

/**
 * Convert a single (non-binary-op) ExpressionTile to an ExprNode.
 * Returns null for tiles that cannot be meaningfully converted
 * (e.g., stand-alone binary operator tiles encountered out of position).
 */
function tileToNode(tile: ExpressionTile): ExprNode | null {
  switch (tile.type) {
    // ------------------------------------------------------------------
    // Leaf nodes
    // ------------------------------------------------------------------

    case 'constant': {
      const value = tile.value ?? 0
      return { type: 'literal', value } satisfies LiteralNode
    }

    case 'point_ref': {
      if (tile.pointId == null) {
        return {
          type: 'point_ref',
          ref_type: 'current',
          point_id: null,
          tagname: null,
        } satisfies PointRefNode
      }
      return {
        type: 'point_ref',
        ref_type: 'specific',
        point_id: tile.pointId,
        tagname: tile.pointLabel ?? null,
      } satisfies PointRefNode
    }

    // Note: 'field_ref' TileType is added in DD-23-002. The type cast below
    // ensures this branch compiles until TileType is extended.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    case ('field_ref' as any): {
      return {
        type: 'field_ref',
        field_name: (tile as ExpressionTile & { fieldName?: string }).pointLabel ?? '',
      } satisfies FieldRefNode
    }

    // ------------------------------------------------------------------
    // Unary nodes — operand lives in tile.children
    // ------------------------------------------------------------------

    case 'negate':
    case 'abs':
    case 'square':
    case 'cube': {
      const operand = childrenToNode(tile.children)
      if (operand === null) return null
      return {
        type: 'unary',
        op: tile.type as UnaryNode['op'],
        operand,
      } satisfies UnaryNode
    }

    case 'not': {
      // NOT is a unary boolean negation; map to unary with op 'not'
      // The spec FunctionNode or UnaryNode could both apply — we use a
      // FunctionNode with name 'not' to match the Rhai evaluation path.
      const operand = childrenToNode(tile.children)
      if (operand === null) return null
      return {
        type: 'function',
        name: 'not',
        args: [operand],
        params: {},
      } satisfies FunctionNode
    }

    // ------------------------------------------------------------------
    // Function nodes
    // ------------------------------------------------------------------

    case 'round': {
      const operand = childrenToNode(tile.children)
      if (operand === null) return null
      const precision = tile.precision ?? 0
      return {
        type: 'function',
        name: 'round',
        args: [operand],
        params: { precision },
      } satisfies FunctionNode
    }

    case 'time_now': {
      return {
        type: 'function',
        name: 'time_now',
        args: [],
        params: {},
      } satisfies FunctionNode
    }

    case 'elapsed_since': {
      const operand = childrenToNode(tile.children)
      const args: ExprNode[] = operand ? [operand] : []
      return {
        type: 'function',
        name: 'elapsed_since',
        args,
        params: {},
      } satisfies FunctionNode
    }

    case 'duration_above': {
      const operand = childrenToNode(tile.children)
      const args: ExprNode[] = operand ? [operand] : []
      return {
        type: 'function',
        name: 'duration_above',
        args,
        params: {},
      } satisfies FunctionNode
    }

    case 'duration_below': {
      const operand = childrenToNode(tile.children)
      const args: ExprNode[] = operand ? [operand] : []
      return {
        type: 'function',
        name: 'duration_below',
        args,
        params: {},
      } satisfies FunctionNode
    }

    case 'agg_avg':
    case 'agg_sum':
    case 'agg_min':
    case 'agg_max':
    case 'agg_count': {
      const operand = childrenToNode(tile.children)
      const args: ExprNode[] = operand ? [operand] : []
      return {
        type: 'function',
        name: tile.type,
        args,
        params: {},
      } satisfies FunctionNode
    }

    // ------------------------------------------------------------------
    // Group node
    // ------------------------------------------------------------------

    case 'group': {
      const child = childrenToNode(tile.children)
      if (child === null) return null
      return {
        type: 'group',
        child,
      } satisfies GroupNode
    }

    // ------------------------------------------------------------------
    // Conditional (if_then_else)
    // ------------------------------------------------------------------

    case 'if_then_else': {
      const condition = tile.condition ? parseInfixTiles(tile.condition) : null
      const thenNode = tile.thenBranch ? parseInfixTiles(tile.thenBranch) : null
      const elseNode = tile.elseBranch ? parseInfixTiles(tile.elseBranch) : null
      if (condition === null || thenNode === null) return null
      return {
        type: 'conditional',
        condition,
        then: thenNode,
        else_branch: elseNode,
      } satisfies ConditionalNode
    }

    // ------------------------------------------------------------------
    // Binary operators encountered as standalone tiles — skip (should not
    // appear here since the caller's loop already handles them)
    // ------------------------------------------------------------------

    default:
      return null
  }
}

/**
 * Convert a tile.children array into a single ExprNode via parseInfixTiles.
 * Returns null if children is empty/undefined.
 */
function childrenToNode(children: ExpressionTile[] | undefined): ExprNode | null {
  if (!children || children.length === 0) return null
  return parseInfixTiles(children)
}
