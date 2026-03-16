// ---------------------------------------------------------------------------
// Expression AST Types
// Used by the ExpressionBuilder component and serialized to/from JSON.
// ---------------------------------------------------------------------------

export type TileType =
  | 'point_ref'
  | 'constant'
  | 'add'
  | 'subtract'
  | 'multiply'
  | 'divide'
  | 'modulus'
  | 'power'
  | 'gt'
  | 'lt'
  | 'gte'
  | 'lte'
  | 'group'
  | 'square'
  | 'cube'
  | 'round'
  | 'negate'
  | 'abs'
  | 'if_then_else'
  | 'and'
  | 'or'
  | 'not'
  | 'time_now'
  | 'elapsed_since'
  | 'duration_above'
  | 'duration_below'
  | 'agg_avg'
  | 'agg_sum'
  | 'agg_min'
  | 'agg_max'
  | 'agg_count'

export interface ExpressionTile {
  id: string
  type: TileType
  // For point_ref: null means "current_point" (the point being configured)
  pointId?: string
  pointLabel?: string
  // For constant
  value?: number
  // For round tile: 0–7 decimal places
  precision?: number
  // For group, square, cube, round, negate, abs
  children?: ExpressionTile[]
  // For if_then_else
  condition?: ExpressionTile[]
  thenBranch?: ExpressionTile[]
  elseBranch?: ExpressionTile[]
}

export interface ExpressionAst {
  version: 1
  tiles: ExpressionTile[]
  outputType: 'float' | 'integer'
  precision: number
  name?: string
  description?: string
}

export type ExpressionContext =
  | 'point_config'
  | 'alarm_definition'
  | 'rounds_checkpoint'
  | 'log_segment'
  | 'widget'
  | 'forensics'
