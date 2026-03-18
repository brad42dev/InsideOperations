import { describe, it, expect } from 'vitest'
import type { ExpressionAst, ExpressionTile, TileType } from '../shared/types/expression'

// ---------------------------------------------------------------------------
// ExpressionAst — JSON serialization / deserialization round-trip
// Tests that ExpressionAst objects survive JSON.stringify → JSON.parse intact.
// ---------------------------------------------------------------------------

function makeConstantTile(value: number): ExpressionTile {
  return { id: 'c1', type: 'constant', value }
}

function makePointRef(id: string, pointId: string): ExpressionTile {
  return { id, type: 'point_ref', pointId }
}

function makeAst(tiles: ExpressionTile[]): ExpressionAst {
  return { version: 1, tiles, outputType: 'float', precision: 2 }
}

// ---------------------------------------------------------------------------
// JSON round-trip
// ---------------------------------------------------------------------------

describe('ExpressionAst — JSON round-trip', () => {
  it('serializes and restores a simple constant expression', () => {
    const ast = makeAst([makeConstantTile(42)])
    const json = JSON.stringify(ast)
    const restored = JSON.parse(json) as ExpressionAst
    expect(restored.version).toBe(1)
    expect(restored.tiles).toHaveLength(1)
    expect(restored.tiles[0].type).toBe('constant')
    expect(restored.tiles[0].value).toBe(42)
  })

  it('serializes and restores a point_ref tile', () => {
    const ast = makeAst([makePointRef('p1', 'FIC-101')])
    const restored = JSON.parse(JSON.stringify(ast)) as ExpressionAst
    expect(restored.tiles[0].pointId).toBe('FIC-101')
  })

  it('preserves outputType and precision', () => {
    const ast: ExpressionAst = { version: 1, tiles: [], outputType: 'integer', precision: 0 }
    const restored = JSON.parse(JSON.stringify(ast)) as ExpressionAst
    expect(restored.outputType).toBe('integer')
    expect(restored.precision).toBe(0)
  })

  it('preserves optional name and description', () => {
    const ast: ExpressionAst = {
      version: 1, tiles: [],
      outputType: 'float', precision: 2,
      name: 'Flow Efficiency',
      description: 'Ratio of actual vs setpoint flow',
    }
    const restored = JSON.parse(JSON.stringify(ast)) as ExpressionAst
    expect(restored.name).toBe('Flow Efficiency')
    expect(restored.description).toBe('Ratio of actual vs setpoint flow')
  })

  it('preserves nested children in group tile', () => {
    const groupTile: ExpressionTile = {
      id: 'g1',
      type: 'group',
      children: [makeConstantTile(10), { id: 'op', type: 'add' }, makeConstantTile(5)],
    }
    const ast = makeAst([groupTile])
    const restored = JSON.parse(JSON.stringify(ast)) as ExpressionAst
    expect(restored.tiles[0].children).toHaveLength(3)
    expect(restored.tiles[0].children![1].type).toBe('add')
  })

  it('preserves if_then_else branches', () => {
    const ifTile: ExpressionTile = {
      id: 'if1',
      type: 'if_then_else',
      condition: [makePointRef('p', 'LEVEL'), { id: 'op', type: 'gt' }, makeConstantTile(50)],
      thenBranch: [makeConstantTile(1)],
      elseBranch: [makeConstantTile(0)],
    }
    const ast = makeAst([ifTile])
    const restored = JSON.parse(JSON.stringify(ast)) as ExpressionAst
    const tile = restored.tiles[0]
    expect(tile.condition).toHaveLength(3)
    expect(tile.thenBranch).toHaveLength(1)
    expect(tile.elseBranch).toHaveLength(1)
    expect(tile.condition![2].value).toBe(50)
  })
})

// ---------------------------------------------------------------------------
// TileType coverage
// ---------------------------------------------------------------------------

describe('ExpressionTile — TileType coverage', () => {
  const allTileTypes: TileType[] = [
    'point_ref', 'constant',
    'add', 'subtract', 'multiply', 'divide', 'modulus', 'power',
    'gt', 'lt', 'gte', 'lte',
    'group', 'square', 'cube', 'round', 'negate', 'abs',
    'if_then_else', 'and', 'or', 'not',
    'time_now', 'elapsed_since', 'duration_above', 'duration_below',
    'agg_avg', 'agg_sum', 'agg_min', 'agg_max', 'agg_count',
  ]

  it('has 31 tile types', () => {
    expect(allTileTypes).toHaveLength(31)
  })

  it('all tile types survive JSON round-trip in tiles array', () => {
    const tiles: ExpressionTile[] = allTileTypes.map((type) => ({ id: type, type }))
    const ast = makeAst(tiles)
    const restored = JSON.parse(JSON.stringify(ast)) as ExpressionAst
    for (let i = 0; i < allTileTypes.length; i++) {
      expect(restored.tiles[i].type).toBe(allTileTypes[i])
    }
  })
})

// ---------------------------------------------------------------------------
// Tile field constraints
// ---------------------------------------------------------------------------

describe('ExpressionTile — field constraints', () => {
  it('constant tile without value serializes as undefined (not in JSON)', () => {
    const tile: ExpressionTile = { id: 'c', type: 'constant' }
    const json = JSON.stringify(tile)
    expect(json).not.toContain('"value"')
  })

  it('point_ref without pointId refers to current_point (undefined pointId)', () => {
    const tile: ExpressionTile = { id: 'p', type: 'point_ref' }
    const json = JSON.stringify(tile)
    expect(json).not.toContain('"pointId"')
  })

  it('round tile preserves precision=0', () => {
    const tile: ExpressionTile = { id: 'r', type: 'round', children: [makeConstantTile(3.7)], precision: 0 }
    const restored = JSON.parse(JSON.stringify(tile)) as ExpressionTile
    expect(restored.precision).toBe(0)
  })

  it('round tile preserves precision=7', () => {
    const tile: ExpressionTile = { id: 'r', type: 'round', children: [makeConstantTile(3.14159265)], precision: 7 }
    const restored = JSON.parse(JSON.stringify(tile)) as ExpressionTile
    expect(restored.precision).toBe(7)
  })
})

// ---------------------------------------------------------------------------
// ExpressionAst — structural validation helpers (pure logic tests)
// ---------------------------------------------------------------------------

function isTileComplete(tile: ExpressionTile): boolean {
  if (tile.type === 'constant') return tile.value !== undefined && !isNaN(tile.value)
  if (tile.type === 'point_ref') return true  // null pointId = current_point, always valid
  if (['add','subtract','multiply','divide','modulus','power','gt','lt','gte','lte','and','or'].includes(tile.type)) return true
  if (['group','square','cube','negate','abs','not','round'].includes(tile.type)) {
    return (tile.children?.length ?? 0) > 0
  }
  if (tile.type === 'if_then_else') {
    return (tile.condition?.length ?? 0) > 0 &&
           (tile.thenBranch?.length ?? 0) > 0 &&
           (tile.elseBranch?.length ?? 0) > 0
  }
  return true
}

describe('isTileComplete — tile validation helper', () => {
  it('constant with value is complete', () => {
    expect(isTileComplete({ id: 'c', type: 'constant', value: 42 })).toBe(true)
  })

  it('constant without value is incomplete', () => {
    expect(isTileComplete({ id: 'c', type: 'constant' })).toBe(false)
  })

  it('constant with NaN value is incomplete', () => {
    expect(isTileComplete({ id: 'c', type: 'constant', value: NaN })).toBe(false)
  })

  it('point_ref is always complete', () => {
    expect(isTileComplete({ id: 'p', type: 'point_ref' })).toBe(true)
    expect(isTileComplete({ id: 'p', type: 'point_ref', pointId: 'FIC-101' })).toBe(true)
  })

  it('group without children is incomplete', () => {
    expect(isTileComplete({ id: 'g', type: 'group' })).toBe(false)
    expect(isTileComplete({ id: 'g', type: 'group', children: [] })).toBe(false)
  })

  it('group with children is complete', () => {
    expect(isTileComplete({ id: 'g', type: 'group', children: [{ id: 'c', type: 'constant', value: 1 }] })).toBe(true)
  })

  it('if_then_else without all branches is incomplete', () => {
    const partial: ExpressionTile = {
      id: 'if', type: 'if_then_else',
      condition: [{ id: 'c', type: 'constant', value: 1 }],
      thenBranch: [{ id: 'c', type: 'constant', value: 1 }],
      // no elseBranch
    }
    expect(isTileComplete(partial)).toBe(false)
  })

  it('if_then_else with all branches is complete', () => {
    const complete: ExpressionTile = {
      id: 'if', type: 'if_then_else',
      condition: [{ id: 'c', type: 'constant', value: 1 }],
      thenBranch: [{ id: 'c', type: 'constant', value: 2 }],
      elseBranch: [{ id: 'c', type: 'constant', value: 3 }],
    }
    expect(isTileComplete(complete)).toBe(true)
  })
})
