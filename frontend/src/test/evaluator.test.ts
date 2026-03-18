import { describe, it, expect } from 'vitest'
import { evaluateExpression } from '../shared/components/expression/evaluator'
import type { ExpressionTile } from '../shared/types/expression'

// ---------------------------------------------------------------------------
// Helper to build tiles concisely
// Operator tile types: 'add', 'subtract', 'multiply', 'divide', 'modulus', etc.
// ---------------------------------------------------------------------------

const constant = (value: number): ExpressionTile => ({ id: 'c', type: 'constant', value })
const add = (): ExpressionTile => ({ id: 'op', type: 'add' })
const subtract = (): ExpressionTile => ({ id: 'op', type: 'subtract' })
const multiply = (): ExpressionTile => ({ id: 'op', type: 'multiply' })
const divide = (): ExpressionTile => ({ id: 'op', type: 'divide' })
const pointRef = (pointId: string): ExpressionTile => ({ id: 'p', type: 'point_ref', pointId })
const currentRef = (): ExpressionTile => ({ id: 'cr', type: 'point_ref' })
const grp = (children: ExpressionTile[]): ExpressionTile => ({ id: 'g', type: 'group', children })
const square = (children: ExpressionTile[]): ExpressionTile => ({ id: 'sq', type: 'square', children })
const negate = (children: ExpressionTile[]): ExpressionTile => ({ id: 'n', type: 'negate', children })

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('evaluateExpression — constants', () => {
  it('evaluates a single constant', () => {
    expect(evaluateExpression([constant(42)], {})).toBe(42)
  })

  it('returns null for empty tile list', () => {
    expect(evaluateExpression([], {})).toBeNull()
  })

  it('returns null for a constant with NaN value', () => {
    expect(evaluateExpression([{ id: 'x', type: 'constant', value: NaN }], {})).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Basic arithmetic
// ---------------------------------------------------------------------------

describe('evaluateExpression — basic arithmetic', () => {
  it('adds two constants', () => {
    expect(evaluateExpression([constant(3), add(), constant(4)], {})).toBe(7)
  })

  it('subtracts constants', () => {
    expect(evaluateExpression([constant(10), subtract(), constant(4)], {})).toBe(6)
  })

  it('multiplies constants', () => {
    expect(evaluateExpression([constant(3), multiply(), constant(5)], {})).toBe(15)
  })

  it('divides constants', () => {
    expect(evaluateExpression([constant(10), divide(), constant(4)], {})).toBeCloseTo(2.5)
  })

  it('returns null for division by zero', () => {
    expect(evaluateExpression([constant(5), divide(), constant(0)], {})).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Point references
// ---------------------------------------------------------------------------

describe('evaluateExpression — point references', () => {
  const vals = { 'pt-001': 25.5, 'pt-002': 10 }

  it('resolves a point reference', () => {
    expect(evaluateExpression([pointRef('pt-001')], vals)).toBe(25.5)
  })

  it('adds a point reference to a constant', () => {
    expect(evaluateExpression([pointRef('pt-001'), add(), constant(4.5)], vals)).toBe(30)
  })

  it('returns null for an unresolved point reference', () => {
    expect(evaluateExpression([pointRef('unknown-pt')], vals)).toBeNull()
  })

  it('uses current_point value when pointId is undefined', () => {
    expect(evaluateExpression([currentRef(), multiply(), constant(2)], vals, 7)).toBe(14)
  })

  it('returns null for current_point when currentPointValue is not provided', () => {
    expect(evaluateExpression([currentRef()], vals, undefined)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Group (parentheses)
// ---------------------------------------------------------------------------

describe('evaluateExpression — groups', () => {
  it('evaluates a group', () => {
    expect(evaluateExpression([grp([constant(3), add(), constant(2)])], {})).toBe(5)
  })

  it('returns null for empty group', () => {
    expect(evaluateExpression([grp([])], {})).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Square function
// ---------------------------------------------------------------------------

describe('evaluateExpression — square', () => {
  it('squares a constant child', () => {
    expect(evaluateExpression([square([constant(4)])], {})).toBe(16)
  })

  it('returns null when child is null', () => {
    expect(evaluateExpression([square([pointRef('missing')])], {})).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Negate
// ---------------------------------------------------------------------------

describe('evaluateExpression — negate', () => {
  it('negates a constant', () => {
    expect(evaluateExpression([negate([constant(5)])], {})).toBe(-5)
  })

  it('negates a point value', () => {
    expect(evaluateExpression([negate([pointRef('pt')])], { pt: 3.5 })).toBe(-3.5)
  })
})

// ---------------------------------------------------------------------------
// Complex expressions
// ---------------------------------------------------------------------------

describe('evaluateExpression — complex', () => {
  it('propagates null from missing point', () => {
    const vals = { b: 10 }
    const tiles: ExpressionTile[] = [pointRef('missing'), add(), pointRef('b')]
    expect(evaluateExpression(tiles, vals)).toBeNull()
  })

  it('handles nested groups', () => {
    // (2 + 3) * (4 - 1) = 5 * 3 = 15
    const tiles: ExpressionTile[] = [
      grp([constant(2), add(), constant(3)]),
      multiply(),
      grp([constant(4), subtract(), constant(1)]),
    ]
    expect(evaluateExpression(tiles, {})).toBe(15)
  })
})
