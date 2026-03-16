// ---------------------------------------------------------------------------
// Client-side expression evaluator
// Walks the ExpressionTile AST and computes a numeric result for live preview.
// Time functions and aggregation functions return 0 (require server-side eval).
// ---------------------------------------------------------------------------

import type { ExpressionTile } from '../../types/expression'

/**
 * Evaluate a sequence of tiles (left to right, infix for binary operators)
 * given a map of pointId → test value.
 *
 * Returns null if the expression is incomplete or division by zero.
 */
export function evaluateExpression(
  tiles: ExpressionTile[],
  values: Record<string, number>,
  currentPointValue?: number,
): number | null {
  if (tiles.length === 0) return null
  return evalTiles(tiles, values, currentPointValue)
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function evalTile(
  tile: ExpressionTile,
  values: Record<string, number>,
  currentPointValue?: number,
): number | null {
  switch (tile.type) {
    case 'point_ref': {
      if (tile.pointId == null) {
        // Refers to "current_point"
        return currentPointValue ?? null
      }
      const v = values[tile.pointId]
      return v !== undefined ? v : null
    }

    case 'constant': {
      if (tile.value === undefined || isNaN(tile.value)) return null
      return tile.value
    }

    case 'group': {
      if (!tile.children || tile.children.length === 0) return null
      return evalTiles(tile.children, values, currentPointValue)
    }

    case 'square': {
      const inner = evalSingleChild(tile, values, currentPointValue)
      if (inner === null) return null
      return inner * inner
    }

    case 'cube': {
      const inner = evalSingleChild(tile, values, currentPointValue)
      if (inner === null) return null
      return inner * inner * inner
    }

    case 'round': {
      const inner = evalSingleChild(tile, values, currentPointValue)
      if (inner === null) return null
      const decimals = tile.precision ?? 0
      const factor = Math.pow(10, decimals)
      return Math.round(inner * factor) / factor
    }

    case 'negate': {
      const inner = evalSingleChild(tile, values, currentPointValue)
      if (inner === null) return null
      return -inner
    }

    case 'abs': {
      const inner = evalSingleChild(tile, values, currentPointValue)
      if (inner === null) return null
      return Math.abs(inner)
    }

    case 'if_then_else': {
      if (!tile.condition || !tile.thenBranch || !tile.elseBranch) return null
      const condVal = evalTiles(tile.condition, values, currentPointValue)
      if (condVal === null) return null
      if (condVal !== 0) {
        return evalTiles(tile.thenBranch, values, currentPointValue)
      } else {
        return evalTiles(tile.elseBranch, values, currentPointValue)
      }
    }

    // Binary operators — these are handled in evalTiles as infix operators
    // If encountered directly (malformed AST), return null
    case 'add':
    case 'subtract':
    case 'multiply':
    case 'divide':
    case 'modulus':
    case 'power':
    case 'gt':
    case 'lt':
    case 'gte':
    case 'lte':
    case 'and':
    case 'or':
    case 'not':
      return null

    // Server-side only — return 0 as placeholder
    case 'time_now':
    case 'elapsed_since':
    case 'duration_above':
    case 'duration_below':
    case 'agg_avg':
    case 'agg_sum':
    case 'agg_min':
    case 'agg_max':
    case 'agg_count':
      return 0

    default:
      return null
  }
}

function evalSingleChild(
  tile: ExpressionTile,
  values: Record<string, number>,
  currentPointValue?: number,
): number | null {
  if (!tile.children || tile.children.length === 0) return null
  return evalTiles(tile.children, values, currentPointValue)
}

/**
 * Evaluate a flat list of tiles as an infix expression.
 * Tiles alternate between operands and binary operators.
 * E.g.: [point_ref, add, constant, multiply, constant]
 * → left-to-right evaluation (no operator precedence in the tile model).
 */
function evalTiles(
  tiles: ExpressionTile[],
  values: Record<string, number>,
  currentPointValue?: number,
): number | null {
  if (tiles.length === 0) return null

  // Filter: separate operands from operators
  // Model: operand op operand op operand ...
  // If the pattern doesn't fit, attempt best-effort evaluation
  let accumulator: number | null = null
  let pendingOp: ExpressionTile | null = null

  for (const tile of tiles) {
    const isBinaryOp = [
      'add', 'subtract', 'multiply', 'divide', 'modulus', 'power',
      'gt', 'lt', 'gte', 'lte', 'and', 'or',
    ].includes(tile.type)

    const isUnaryOp = tile.type === 'not'

    if (isBinaryOp) {
      pendingOp = tile
      continue
    }

    if (isUnaryOp) {
      // NOT applied to next operand — skip for now (handle inline below)
      pendingOp = tile
      continue
    }

    // Operand tile
    let val: number | null

    if (tile.type === 'not') {
      val = null // handled above
    } else {
      val = evalTile(tile, values, currentPointValue)
    }

    if (val === null) return null

    if (accumulator === null) {
      if (pendingOp?.type === 'not') {
        accumulator = val === 0 ? 1 : 0
        pendingOp = null
      } else {
        accumulator = val
      }
    } else if (pendingOp !== null) {
      const result = applyBinaryOp(pendingOp.type, accumulator, val)
      if (result === null) return null
      accumulator = result
      pendingOp = null
    } else {
      // Two operands in a row — implicit multiply (unusual, just return null)
      return null
    }
  }

  return accumulator
}

function applyBinaryOp(op: string, left: number, right: number): number | null {
  switch (op) {
    case 'add':      return left + right
    case 'subtract': return left - right
    case 'multiply': return left * right
    case 'divide':   return right === 0 ? null : left / right
    case 'modulus':  return right === 0 ? null : left % right
    case 'power':    return Math.pow(left, right)
    case 'gt':       return left > right ? 1 : 0
    case 'lt':       return left < right ? 1 : 0
    case 'gte':      return left >= right ? 1 : 0
    case 'lte':      return left <= right ? 1 : 0
    case 'and':      return left !== 0 && right !== 0 ? 1 : 0
    case 'or':       return left !== 0 || right !== 0 ? 1 : 0
    default:         return null
  }
}
