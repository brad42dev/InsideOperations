// ---------------------------------------------------------------------------
// Expression AST Types
// Used by the ExpressionBuilder component and serialized to/from JSON.
// ---------------------------------------------------------------------------

export type TileType =
  | 'point_ref'
  | 'field_ref'
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
  // For field_ref: the checkpoint/segment field name
  fieldName?: string
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

// ---------------------------------------------------------------------------
// ExprNode — typed recursive tree (doc 23 §11.2, doc 37 wire format)
// ---------------------------------------------------------------------------

export type LiteralNode = {
  type: 'literal'
  value: number
}

export type PointRefNode = {
  type: 'point_ref'
  ref_type: 'current' | 'specific'
  point_id: string | null    // UUID if specific, null if current
  tagname: string | null     // Display name if specific, null if current
}

export type FieldRefNode = {
  type: 'field_ref'
  field_name: string
}

export type UnaryNode = {
  type: 'unary'
  op: 'negate' | 'abs' | 'square' | 'cube'
  operand: ExprNode
}

export type BinaryNode = {
  type: 'binary'
  op: '+' | '-' | '*' | '/' | '%' | '^' | '>' | '<' | '>=' | '<='
  left: ExprNode
  right: ExprNode
}

export type FunctionNode = {
  type: 'function'
  name: string
  args: ExprNode[]
  params: Record<string, number>
}

export type ConditionalNode = {
  type: 'conditional'
  condition: ExprNode
  then: ExprNode
  else_branch: ExprNode | null
}

export type GroupNode = {
  type: 'group'
  child: ExprNode
}

export type ExprNode =
  | LiteralNode
  | PointRefNode
  | FieldRefNode
  | UnaryNode
  | BinaryNode
  | FunctionNode
  | ConditionalNode
  | GroupNode

// ---------------------------------------------------------------------------
// ExpressionAst — top-level document (doc 37 wire format)
// ---------------------------------------------------------------------------

export interface ExpressionAst {
  version: 1
  context: ExpressionContext
  root: ExprNode
  output: { type: 'float' | 'integer'; precision?: number }
}

export type ExpressionContext =
  | 'point_config'
  | 'alarm_definition'
  | 'rounds_checkpoint'
  | 'log_segment'
  | 'widget'
  | 'forensics'
