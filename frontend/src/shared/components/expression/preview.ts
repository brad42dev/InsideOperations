// ---------------------------------------------------------------------------
// AST → human-readable string preview
// Converts an ExpressionTile array into a readable expression string.
// ---------------------------------------------------------------------------

import type { ExpressionTile } from '../../types/expression'

/**
 * Convert a flat tile array to a human-readable expression string.
 *
 * Examples:
 *   [point_ref("TI-101"), add, constant(5)]      → "(TI-101) + 5"
 *   [if_then_else { cond, then, else }]           → "IF (a > 100) THEN (a) ELSE (0)"
 */
export function expressionToString(tiles: ExpressionTile[]): string {
  if (tiles.length === 0) return ''
  return tilesToString(tiles)
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

function tilesToString(tiles: ExpressionTile[]): string {
  const parts: string[] = []

  for (const tile of tiles) {
    parts.push(tileToString(tile))
  }

  return parts.join(' ')
}

function tileToString(tile: ExpressionTile): string {
  switch (tile.type) {
    case 'point_ref': {
      const label = tile.pointLabel ?? tile.pointId ?? 'current_point'
      return `(${label})`
    }

    case 'constant': {
      if (tile.value === undefined) return '?'
      return String(tile.value)
    }

    case 'add':      return '+'
    case 'subtract': return '-'
    case 'multiply': return '×'
    case 'divide':   return '÷'
    case 'modulus':  return 'mod'
    case 'power':    return '^'
    case 'gt':       return '>'
    case 'lt':       return '<'
    case 'gte':      return '>='
    case 'lte':      return '<='
    case 'and':      return 'AND'
    case 'or':       return 'OR'
    case 'not':      return 'NOT'

    case 'group': {
      const inner = tile.children ? tilesToString(tile.children) : ''
      return `(${inner})`
    }

    case 'square': {
      const inner = tile.children ? tilesToString(tile.children) : '?'
      return `(${inner})²`
    }

    case 'cube': {
      const inner = tile.children ? tilesToString(tile.children) : '?'
      return `(${inner})³`
    }

    case 'round': {
      const inner = tile.children ? tilesToString(tile.children) : '?'
      const decimals = tile.precision ?? 0
      return `round(${inner}, ${decimals})`
    }

    case 'negate': {
      const inner = tile.children ? tilesToString(tile.children) : '?'
      return `-(${inner})`
    }

    case 'abs': {
      const inner = tile.children ? tilesToString(tile.children) : '?'
      return `|${inner}|`
    }

    case 'if_then_else': {
      const cond = tile.condition ? tilesToString(tile.condition) : '?'
      const then_ = tile.thenBranch ? tilesToString(tile.thenBranch) : '?'
      const else_ = tile.elseBranch ? tilesToString(tile.elseBranch) : '?'
      return `IF (${cond}) THEN (${then_}) ELSE (${else_})`
    }

    case 'time_now':       return 'now()'
    case 'elapsed_since':  return 'elapsed_since(?)'
    case 'duration_above': return 'duration_above(?)'
    case 'duration_below': return 'duration_below(?)'

    case 'agg_avg':   return 'avg(?)'
    case 'agg_sum':   return 'sum(?)'
    case 'agg_min':   return 'min(?)'
    case 'agg_max':   return 'max(?)'
    case 'agg_count': return 'count(?)'

    default:
      return '?'
  }
}
