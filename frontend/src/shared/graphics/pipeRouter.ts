import type { Point2D } from '../types/graphics'

const GRID_STEP = 10 // Match gridSize default

interface GridPoint {
  x: number
  y: number
}

interface AStarNode {
  point: GridPoint
  g: number
  h: number
  f: number
  parent: AStarNode | null
}

type ObstacleSet = Set<string>

function key(p: GridPoint): string {
  return `${p.x},${p.y}`
}

function heuristic(a: GridPoint, b: GridPoint): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y)
}

function snap(v: number): number {
  return Math.round(v / GRID_STEP) * GRID_STEP
}

function toGrid(p: Point2D): GridPoint {
  return { x: snap(p.x), y: snap(p.y) }
}

const DIRECTIONS: GridPoint[] = [
  { x: GRID_STEP, y: 0 },
  { x: -GRID_STEP, y: 0 },
  { x: 0, y: GRID_STEP },
  { x: 0, y: -GRID_STEP },
]

/**
 * A* orthogonal routing between two points, avoiding obstacles.
 * Returns SVG path `d` string.
 */
export function routePipe(
  start: Point2D,
  end: Point2D,
  obstacles: ObstacleSet = new Set(),
  waypoints: Point2D[] = []
): string {
  // With waypoints: route segments start->wp1->wp2->...->end
  const allPoints: Point2D[] = [start, ...waypoints, end]
  const segments: Point2D[][] = []

  for (let i = 0; i < allPoints.length - 1; i++) {
    const seg = routeSegment(allPoints[i], allPoints[i + 1], obstacles)
    segments.push(seg)
  }

  // Merge all segments into one path
  const allPts: Point2D[] = [segments[0][0]]
  for (const seg of segments) {
    for (let i = 1; i < seg.length; i++) {
      allPts.push(seg[i])
    }
  }

  return pointsToPath(allPts)
}

function routeSegment(
  start: Point2D,
  end: Point2D,
  obstacles: ObstacleSet
): Point2D[] {
  const gs = toGrid(start)
  const ge = toGrid(end)

  if (gs.x === ge.x && gs.y === ge.y) return [start, end]

  const open = new Map<string, AStarNode>()
  const closed = new Set<string>()

  const startNode: AStarNode = { point: gs, g: 0, h: heuristic(gs, ge), f: 0, parent: null }
  startNode.f = startNode.g + startNode.h
  open.set(key(gs), startNode)

  let iterations = 0
  const MAX_ITERATIONS = 10000

  while (open.size > 0 && iterations < MAX_ITERATIONS) {
    iterations++

    // Find node with lowest f
    let current: AStarNode | null = null
    for (const node of open.values()) {
      if (!current || node.f < current.f) current = node
    }
    if (!current) break

    const ck = key(current.point)
    open.delete(ck)
    closed.add(ck)

    if (current.point.x === ge.x && current.point.y === ge.y) {
      // Reconstruct path
      const path: Point2D[] = []
      let n: AStarNode | null = current
      while (n) {
        path.unshift({ x: n.point.x, y: n.point.y })
        n = n.parent
      }
      return path
    }

    for (const dir of DIRECTIONS) {
      const np: GridPoint = { x: current.point.x + dir.x, y: current.point.y + dir.y }
      const nk = key(np)

      if (closed.has(nk)) continue
      if (obstacles.has(nk)) continue

      // Direction change penalty (prefer straight lines)
      let turnPenalty = 0
      if (current.parent) {
        const lastDir = {
          x: current.point.x - current.parent.point.x,
          y: current.point.y - current.parent.point.y,
        }
        if (lastDir.x !== dir.x || lastDir.y !== dir.y) {
          turnPenalty = GRID_STEP * 2
        }
      }

      const g = current.g + GRID_STEP + turnPenalty
      const h = heuristic(np, ge)
      const f = g + h

      const existing = open.get(nk)
      if (!existing || g < existing.g) {
        open.set(nk, { point: np, g, h, f, parent: current })
      }
    }
  }

  // Fallback: straight Manhattan path if A* fails or hits limit
  return manhattanPath(start, end)
}

function manhattanPath(start: Point2D, end: Point2D): Point2D[] {
  // Route via horizontal then vertical (or vice versa)
  const mid: Point2D = { x: end.x, y: start.y }
  return [start, mid, end]
}

function pointsToPath(points: Point2D[]): string {
  if (points.length === 0) return ''
  const parts = [`M ${points[0].x} ${points[0].y}`]
  for (let i = 1; i < points.length; i++) {
    parts.push(`L ${points[i].x} ${points[i].y}`)
  }
  return parts.join(' ')
}

/**
 * Build obstacle set from node bounding boxes.
 * Inflates each obstacle by GRID_STEP for clearance.
 */
export function buildObstacleSet(
  obstacles: Array<{ x: number; y: number; width: number; height: number }>,
  clearance = GRID_STEP
): ObstacleSet {
  const set = new Set<string>()
  for (const ob of obstacles) {
    const x0 = snap(ob.x - clearance)
    const y0 = snap(ob.y - clearance)
    const x1 = snap(ob.x + ob.width + clearance)
    const y1 = snap(ob.y + ob.height + clearance)
    for (let x = x0; x <= x1; x += GRID_STEP) {
      for (let y = y0; y <= y1; y += GRID_STEP) {
        set.add(key({ x, y }))
      }
    }
  }
  return set
}
