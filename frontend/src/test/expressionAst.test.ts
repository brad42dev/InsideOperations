import { describe, it, expect } from 'vitest'
import type {
  ExpressionAst,
  LiteralNode,
  PointRefNode,
  BinaryNode,
  UnaryNode,
  FunctionNode,
  ConditionalNode,
  GroupNode,
  ExpressionTile,
} from '../shared/types/expression'
import { tilesToAst } from '../shared/components/expression/ast'

// ---------------------------------------------------------------------------
// ExpressionAst — JSON serialization / deserialization round-trip
// Tests that the new tree-format ExpressionAst survives JSON.stringify → JSON.parse intact.
// ---------------------------------------------------------------------------

function makeLiteralAst(value: number): ExpressionAst {
  return {
    version: 1,
    context: 'point_config',
    root: { type: 'literal', value } satisfies LiteralNode,
    output: { type: 'float', precision: 2 },
  }
}

describe('ExpressionAst — JSON round-trip', () => {
  it('serializes and restores a literal node', () => {
    const ast = makeLiteralAst(42)
    const restored = JSON.parse(JSON.stringify(ast)) as ExpressionAst
    expect(restored.version).toBe(1)
    expect(restored.context).toBe('point_config')
    expect(restored.root.type).toBe('literal')
    expect((restored.root as LiteralNode).value).toBe(42)
  })

  it('preserves output type and precision', () => {
    const ast: ExpressionAst = {
      version: 1,
      context: 'alarm_definition',
      root: { type: 'literal', value: 0 },
      output: { type: 'integer', precision: 0 },
    }
    const restored = JSON.parse(JSON.stringify(ast)) as ExpressionAst
    expect(restored.output.type).toBe('integer')
    expect(restored.output.precision).toBe(0)
  })

  it('preserves output without precision (optional)', () => {
    const ast: ExpressionAst = {
      version: 1,
      context: 'widget',
      root: { type: 'literal', value: 1 },
      output: { type: 'float' },
    }
    const restored = JSON.parse(JSON.stringify(ast)) as ExpressionAst
    expect(restored.output.type).toBe('float')
    expect(restored.output.precision).toBeUndefined()
  })

  it('preserves a binary tree node', () => {
    const root: BinaryNode = {
      type: 'binary',
      op: '+',
      left: { type: 'point_ref', ref_type: 'current', point_id: null, tagname: null },
      right: { type: 'literal', value: 10 },
    }
    const ast: ExpressionAst = { version: 1, context: 'point_config', root, output: { type: 'float' } }
    const restored = JSON.parse(JSON.stringify(ast)) as ExpressionAst
    const restoredRoot = restored.root as BinaryNode
    expect(restoredRoot.type).toBe('binary')
    expect(restoredRoot.op).toBe('+')
    expect((restoredRoot.left as PointRefNode).ref_type).toBe('current')
    expect((restoredRoot.right as LiteralNode).value).toBe(10)
  })

  it('preserves context across all ExpressionContext values', () => {
    const contexts = ['point_config', 'alarm_definition', 'rounds_checkpoint', 'log_segment', 'widget', 'forensics'] as const
    for (const ctx of contexts) {
      const ast: ExpressionAst = { version: 1, context: ctx, root: { type: 'literal', value: 0 }, output: { type: 'float' } }
      const restored = JSON.parse(JSON.stringify(ast)) as ExpressionAst
      expect(restored.context).toBe(ctx)
    }
  })
})

// ---------------------------------------------------------------------------
// ExprNode — all 8 node type round-trips
// ---------------------------------------------------------------------------

describe('ExprNode — all 8 node types serialization', () => {
  it('LiteralNode', () => {
    const node: LiteralNode = { type: 'literal', value: 3.14 }
    const r = JSON.parse(JSON.stringify(node)) as LiteralNode
    expect(r.type).toBe('literal')
    expect(r.value).toBe(3.14)
  })

  it('PointRefNode — current', () => {
    const node: PointRefNode = { type: 'point_ref', ref_type: 'current', point_id: null, tagname: null }
    const r = JSON.parse(JSON.stringify(node)) as PointRefNode
    expect(r.ref_type).toBe('current')
    expect(r.point_id).toBeNull()
  })

  it('PointRefNode — specific', () => {
    const node: PointRefNode = { type: 'point_ref', ref_type: 'specific', point_id: 'abc-123', tagname: 'FIC-101' }
    const r = JSON.parse(JSON.stringify(node)) as PointRefNode
    expect(r.ref_type).toBe('specific')
    expect(r.point_id).toBe('abc-123')
    expect(r.tagname).toBe('FIC-101')
  })

  it('FieldRefNode', () => {
    const node = { type: 'field_ref' as const, field_name: 'feet' }
    const r = JSON.parse(JSON.stringify(node))
    expect(r.type).toBe('field_ref')
    expect(r.field_name).toBe('feet')
  })

  it('UnaryNode', () => {
    const node: UnaryNode = { type: 'unary', op: 'negate', operand: { type: 'literal', value: 5 } }
    const r = JSON.parse(JSON.stringify(node)) as UnaryNode
    expect(r.op).toBe('negate')
    expect((r.operand as LiteralNode).value).toBe(5)
  })

  it('BinaryNode', () => {
    const node: BinaryNode = {
      type: 'binary',
      op: '*',
      left: { type: 'literal', value: 2 },
      right: { type: 'literal', value: 3 },
    }
    const r = JSON.parse(JSON.stringify(node)) as BinaryNode
    expect(r.op).toBe('*')
    expect((r.left as LiteralNode).value).toBe(2)
    expect((r.right as LiteralNode).value).toBe(3)
  })

  it('FunctionNode', () => {
    const node: FunctionNode = {
      type: 'function',
      name: 'round',
      args: [{ type: 'literal', value: 3.14159 }],
      params: { precision: 2 },
    }
    const r = JSON.parse(JSON.stringify(node)) as FunctionNode
    expect(r.name).toBe('round')
    expect(r.args).toHaveLength(1)
    expect(r.params.precision).toBe(2)
  })

  it('ConditionalNode', () => {
    const node: ConditionalNode = {
      type: 'conditional',
      condition: { type: 'literal', value: 1 },
      then: { type: 'literal', value: 100 },
      else_branch: { type: 'literal', value: 0 },
    }
    const r = JSON.parse(JSON.stringify(node)) as ConditionalNode
    expect(r.type).toBe('conditional')
    expect((r.then as LiteralNode).value).toBe(100)
    expect((r.else_branch as LiteralNode | null)?.value).toBe(0)
  })

  it('GroupNode', () => {
    const node: GroupNode = {
      type: 'group',
      child: { type: 'literal', value: 42 },
    }
    const r = JSON.parse(JSON.stringify(node)) as GroupNode
    expect(r.type).toBe('group')
    expect((r.child as LiteralNode).value).toBe(42)
  })
})

// ---------------------------------------------------------------------------
// tilesToAst — conversion from flat tile array to ExprNode tree
// ---------------------------------------------------------------------------

function constTile(value: number, id = 'c'): ExpressionTile {
  return { id, type: 'constant', value }
}

function pointTile(id: string, pointId?: string, label?: string): ExpressionTile {
  return { id, type: 'point_ref', pointId, pointLabel: label }
}

function opTile(type: ExpressionTile['type'], id?: string): ExpressionTile {
  return { id: id ?? type, type }
}

describe('tilesToAst — basic conversions', () => {
  it('empty tiles returns literal 0', () => {
    const node = tilesToAst([])
    expect(node.type).toBe('literal')
    expect((node as LiteralNode).value).toBe(0)
  })

  it('single constant tile becomes LiteralNode', () => {
    const node = tilesToAst([constTile(42)])
    expect(node.type).toBe('literal')
    expect((node as LiteralNode).value).toBe(42)
  })

  it('point_ref without pointId becomes current PointRefNode', () => {
    const node = tilesToAst([pointTile('p1')])
    expect(node.type).toBe('point_ref')
    const pn = node as PointRefNode
    expect(pn.ref_type).toBe('current')
    expect(pn.point_id).toBeNull()
  })

  it('point_ref with pointId becomes specific PointRefNode', () => {
    const node = tilesToAst([pointTile('p1', 'abc-123', 'FIC-101')])
    expect(node.type).toBe('point_ref')
    const pn = node as PointRefNode
    expect(pn.ref_type).toBe('specific')
    expect(pn.point_id).toBe('abc-123')
    expect(pn.tagname).toBe('FIC-101')
  })

  it('two operands with add op becomes BinaryNode with +', () => {
    const tiles: ExpressionTile[] = [constTile(3, 'a'), opTile('add'), constTile(5, 'b')]
    const node = tilesToAst(tiles) as BinaryNode
    expect(node.type).toBe('binary')
    expect(node.op).toBe('+')
    expect((node.left as LiteralNode).value).toBe(3)
    expect((node.right as LiteralNode).value).toBe(5)
  })

  it('chained binary ops fold left to right', () => {
    // 1 + 2 * 3 → ((1 + 2) * 3) — no precedence, left fold
    const tiles: ExpressionTile[] = [
      constTile(1, 'a'), opTile('add'), constTile(2, 'b'), opTile('multiply'), constTile(3, 'c'),
    ]
    const node = tilesToAst(tiles) as BinaryNode
    expect(node.type).toBe('binary')
    expect(node.op).toBe('*')
    const left = node.left as BinaryNode
    expect(left.type).toBe('binary')
    expect(left.op).toBe('+')
  })

  it('all binary op types map correctly', () => {
    const opMap: Array<[ExpressionTile['type'], BinaryNode['op']]> = [
      ['add', '+'], ['subtract', '-'], ['multiply', '*'], ['divide', '/'],
      ['modulus', '%'], ['power', '^'], ['gt', '>'], ['lt', '<'],
      ['gte', '>='], ['lte', '<='],
    ]
    for (const [tileType, expected] of opMap) {
      const tiles: ExpressionTile[] = [constTile(1, 'a'), opTile(tileType), constTile(2, 'b')]
      const node = tilesToAst(tiles) as BinaryNode
      expect(node.op).toBe(expected)
    }
  })
})

describe('tilesToAst — unary nodes', () => {
  it('negate tile with child becomes UnaryNode', () => {
    const tile: ExpressionTile = { id: 'n', type: 'negate', children: [constTile(5)] }
    const node = tilesToAst([tile]) as UnaryNode
    expect(node.type).toBe('unary')
    expect(node.op).toBe('negate')
    expect((node.operand as LiteralNode).value).toBe(5)
  })

  it('abs tile becomes UnaryNode with abs', () => {
    const tile: ExpressionTile = { id: 'a', type: 'abs', children: [constTile(-3)] }
    const node = tilesToAst([tile]) as UnaryNode
    expect(node.op).toBe('abs')
  })

  it('square tile becomes UnaryNode with square', () => {
    const tile: ExpressionTile = { id: 's', type: 'square', children: [constTile(4)] }
    const node = tilesToAst([tile]) as UnaryNode
    expect(node.op).toBe('square')
  })

  it('cube tile becomes UnaryNode with cube', () => {
    const tile: ExpressionTile = { id: 'c', type: 'cube', children: [constTile(2)] }
    const node = tilesToAst([tile]) as UnaryNode
    expect(node.op).toBe('cube')
  })

  it('unary tile without children returns literal 0 fallback', () => {
    const tile: ExpressionTile = { id: 'n', type: 'negate' }
    const node = tilesToAst([tile])
    // null operand falls back to literal 0
    expect(node.type).toBe('literal')
  })
})

describe('tilesToAst — function nodes', () => {
  it('round tile becomes FunctionNode with precision param', () => {
    const tile: ExpressionTile = { id: 'r', type: 'round', children: [constTile(3.14)], precision: 1 }
    const node = tilesToAst([tile]) as FunctionNode
    expect(node.type).toBe('function')
    expect(node.name).toBe('round')
    expect(node.params.precision).toBe(1)
    expect((node.args[0] as LiteralNode).value).toBe(3.14)
  })

  it('round tile with precision 0 emits precision 0', () => {
    const tile: ExpressionTile = { id: 'r', type: 'round', children: [constTile(5.9)], precision: 0 }
    const node = tilesToAst([tile]) as FunctionNode
    expect(node.params.precision).toBe(0)
  })

  it('time_now tile becomes FunctionNode', () => {
    const tile: ExpressionTile = { id: 't', type: 'time_now' }
    const node = tilesToAst([tile]) as FunctionNode
    expect(node.type).toBe('function')
    expect(node.name).toBe('time_now')
    expect(node.args).toHaveLength(0)
  })

  it('agg_avg tile becomes FunctionNode', () => {
    const tile: ExpressionTile = { id: 'a', type: 'agg_avg', children: [pointTile('p')] }
    const node = tilesToAst([tile]) as FunctionNode
    expect(node.type).toBe('function')
    expect(node.name).toBe('agg_avg')
  })
})

describe('tilesToAst — group node', () => {
  it('group tile becomes GroupNode', () => {
    const tile: ExpressionTile = {
      id: 'g',
      type: 'group',
      children: [constTile(1, 'a'), opTile('add'), constTile(2, 'b')],
    }
    const node = tilesToAst([tile]) as GroupNode
    expect(node.type).toBe('group')
    const child = node.child as BinaryNode
    expect(child.type).toBe('binary')
    expect(child.op).toBe('+')
  })
})

describe('tilesToAst — conditional node', () => {
  it('if_then_else tile becomes ConditionalNode', () => {
    const tile: ExpressionTile = {
      id: 'if',
      type: 'if_then_else',
      condition: [pointTile('p', 'abc'), opTile('gt'), constTile(50, 'th')],
      thenBranch: [constTile(1, 'v1')],
      elseBranch: [constTile(0, 'v0')],
    }
    const node = tilesToAst([tile]) as ConditionalNode
    expect(node.type).toBe('conditional')
    const cond = node.condition as BinaryNode
    expect(cond.type).toBe('binary')
    expect(cond.op).toBe('>')
    expect((node.then as LiteralNode).value).toBe(1)
    expect((node.else_branch as LiteralNode | null)?.value).toBe(0)
  })

  it('if_then_else without condition returns literal 0 fallback', () => {
    const tile: ExpressionTile = { id: 'if', type: 'if_then_else' }
    const node = tilesToAst([tile])
    expect(node.type).toBe('literal')
    expect((node as LiteralNode).value).toBe(0)
  })
})

describe('tilesToAst — complex expression', () => {
  it('(a + b) * c — binary expression with intermediate result', () => {
    // This tests a flat tile sequence: a add b multiply c
    // Expected: BinaryNode(*, BinaryNode(+, a, b), c)
    const tiles: ExpressionTile[] = [
      pointTile('p1', 'id1', 'TagA'),
      opTile('add'),
      constTile(10, 'c1'),
      opTile('multiply'),
      constTile(2, 'c2'),
    ]
    const root = tilesToAst(tiles) as BinaryNode
    expect(root.op).toBe('*')
    const inner = root.left as BinaryNode
    expect(inner.op).toBe('+')
    expect((inner.left as PointRefNode).tagname).toBe('TagA')
    expect((inner.right as LiteralNode).value).toBe(10)
    expect((root.right as LiteralNode).value).toBe(2)
  })
})
