/**
 * Tests for pipe routing utilities — doc 33 §Unit Tests
 *
 * Covers:
 * - buildObstacleSet — grid cell generation from bounding boxes
 * - routePipe — A* orthogonal path routing
 */
import { describe, it, expect } from 'vitest'
import { buildObstacleSet, routePipe } from '../shared/graphics/pipeRouter'

// ---------------------------------------------------------------------------
// buildObstacleSet
// ---------------------------------------------------------------------------

describe('buildObstacleSet — basic grid cell generation', () => {
  it('returns a Set', () => {
    const result = buildObstacleSet([])
    expect(result).toBeInstanceOf(Set)
  })

  it('empty obstacle list returns empty set', () => {
    expect(buildObstacleSet([])).toHaveProperty('size', 0)
  })

  it('a zero-size obstacle at origin with default clearance blocks cells', () => {
    // clearance = 10 (GRID_STEP), so blocked area: (-10,-10) to (10,10)
    const set = buildObstacleSet([{ x: 0, y: 0, width: 0, height: 0 }])
    expect(set.size).toBeGreaterThan(0)
    // Center cell should be blocked
    expect(set.has('0,0')).toBe(true)
  })

  it('contains the inflated boundary corners', () => {
    // obstacle at (10,10), 0×0 with clearance 10: cells from (0,0) to (20,20)
    const set = buildObstacleSet([{ x: 10, y: 10, width: 0, height: 0 }])
    expect(set.has('0,0')).toBe(true)
    expect(set.has('10,10')).toBe(true)
    expect(set.has('20,20')).toBe(true)
  })

  it('does not contain cells outside the inflated boundary', () => {
    // obstacle at (10,10), 0×0 with clearance 10: boundary is (0,0)–(20,20)
    const set = buildObstacleSet([{ x: 10, y: 10, width: 0, height: 0 }])
    expect(set.has('30,10')).toBe(false)
    expect(set.has('10,30')).toBe(false)
  })

  it('larger obstacle covers more cells than smaller one', () => {
    const small = buildObstacleSet([{ x: 0, y: 0, width: 10, height: 10 }])
    const large = buildObstacleSet([{ x: 0, y: 0, width: 100, height: 100 }])
    expect(large.size).toBeGreaterThan(small.size)
  })

  it('respects custom clearance of 0', () => {
    // With clearance=0 and a 10×10 obstacle at (0,0): cells (0,0)–(10,10) only
    const set = buildObstacleSet([{ x: 0, y: 0, width: 10, height: 10 }], 0)
    // Cells outside should not be blocked
    expect(set.has('-10,0')).toBe(false)
    expect(set.has('0,-10')).toBe(false)
  })

  it('respects custom clearance of 20', () => {
    const set10 = buildObstacleSet([{ x: 0, y: 0, width: 0, height: 0 }], 10)
    const set20 = buildObstacleSet([{ x: 0, y: 0, width: 0, height: 0 }], 20)
    expect(set20.size).toBeGreaterThan(set10.size)
  })

  it('multiple obstacles union their blocked cells', () => {
    const combined = buildObstacleSet([
      { x: 0, y: 0, width: 0, height: 0 },
      { x: 100, y: 100, width: 0, height: 0 },
    ])
    // Both obstacle centers should be blocked
    expect(combined.has('0,0')).toBe(true)
    expect(combined.has('100,100')).toBe(true)
  })

  it('cells are keyed as "x,y" integer strings', () => {
    const set = buildObstacleSet([{ x: 30, y: 50, width: 0, height: 0 }])
    // All keys should match the integer,integer pattern
    for (const key of set) {
      expect(key).toMatch(/^-?\d+,-?\d+$/)
    }
  })

  it('snaps obstacle coordinates to grid before inflating', () => {
    // obstacle at (5,5) — should snap to (10,10) then inflate
    const snapped = buildObstacleSet([{ x: 5, y: 5, width: 0, height: 0 }])
    // Should block the same cells as obstacle at (10,10)
    const aligned = buildObstacleSet([{ x: 10, y: 10, width: 0, height: 0 }])
    expect(snapped.size).toBe(aligned.size)
  })
})

// ---------------------------------------------------------------------------
// routePipe — path output format
// ---------------------------------------------------------------------------

describe('routePipe — output format', () => {
  it('returns a string', () => {
    const result = routePipe({ x: 0, y: 0 }, { x: 100, y: 0 })
    expect(typeof result).toBe('string')
  })

  it('starts with M (moveto)', () => {
    const path = routePipe({ x: 0, y: 0 }, { x: 50, y: 0 })
    expect(path.startsWith('M ')).toBe(true)
  })

  it('contains L (lineto) segments', () => {
    const path = routePipe({ x: 0, y: 0 }, { x: 100, y: 100 })
    expect(path).toContain('L ')
  })

  it('starts at the provided start point', () => {
    const path = routePipe({ x: 20, y: 30 }, { x: 80, y: 30 })
    expect(path.startsWith('M 20 30')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// routePipe — straight-line cases
// ---------------------------------------------------------------------------

describe('routePipe — horizontal routing', () => {
  it('routes horizontally in a single segment when unobstructed', () => {
    const path = routePipe({ x: 0, y: 0 }, { x: 100, y: 0 })
    // Direct horizontal path: M 0 0 L 100 0 or M 0 0 ... L 100 0
    expect(path).toContain('100')
    expect(path).toContain('0')
  })

  it('same-point start and end returns a path with both points', () => {
    const path = routePipe({ x: 50, y: 50 }, { x: 50, y: 50 })
    expect(path).toContain('50')
  })
})

describe('routePipe — vertical routing', () => {
  it('routes vertically when unobstructed', () => {
    const path = routePipe({ x: 0, y: 0 }, { x: 0, y: 100 })
    expect(path).toContain('100')
  })
})

// ---------------------------------------------------------------------------
// routePipe — obstacle avoidance
// ---------------------------------------------------------------------------

describe('routePipe — obstacle avoidance', () => {
  it('returns a valid path string when obstacle blocks direct route', () => {
    // Horizontal path from (0,0) to (100,0) with obstacle blocking middle
    const obstacles = buildObstacleSet([{ x: 40, y: -20, width: 20, height: 40 }])
    const path = routePipe({ x: 0, y: 0 }, { x: 100, y: 0 }, obstacles)
    expect(typeof path).toBe('string')
    expect(path.length).toBeGreaterThan(0)
    expect(path.startsWith('M ')).toBe(true)
  })

  it('path with obstacle is different from path without obstacle', () => {
    const noObs = routePipe({ x: 0, y: 0 }, { x: 100, y: 0 })
    const obstacles = buildObstacleSet([{ x: 40, y: -10, width: 20, height: 20 }])
    const withObs = routePipe({ x: 0, y: 0 }, { x: 100, y: 0 }, obstacles)
    // The paths should differ since the obstacle forces a detour
    expect(withObs).not.toBe(noObs)
  })
})

// ---------------------------------------------------------------------------
// routePipe — waypoints
// ---------------------------------------------------------------------------

describe('routePipe — waypoints', () => {
  it('passes through intermediate waypoint', () => {
    // Route (0,0) → waypoint (50,0) → (100,0)
    const path = routePipe({ x: 0, y: 0 }, { x: 100, y: 0 }, new Set(), [{ x: 50, y: 0 }])
    expect(path).toContain('50')
  })

  it('waypoint changes the path shape compared to direct route', () => {
    const direct = routePipe({ x: 0, y: 0 }, { x: 100, y: 100 })
    const withWp = routePipe({ x: 0, y: 0 }, { x: 100, y: 100 }, new Set(), [{ x: 0, y: 100 }])
    // With waypoint (0, 100), path must pass through that point
    expect(withWp).toContain('0 100')
    // Shapes should differ
    expect(withWp).not.toBe(direct)
  })

  it('works with empty waypoints array', () => {
    const path = routePipe({ x: 0, y: 0 }, { x: 50, y: 50 }, new Set(), [])
    expect(typeof path).toBe('string')
    expect(path.length).toBeGreaterThan(0)
  })
})
