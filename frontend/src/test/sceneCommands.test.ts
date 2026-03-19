/**
 * Tests for the Designer scene command system — doc 33 §Unit Tests
 *
 * Commands are the undo/redo unit of work in the Designer module.
 * Each command has execute() and undo() that both produce a new GraphicDocument.
 * Tests verify both the forward and reverse operations.
 */
import { describe, it, expect } from 'vitest'
import {
  MoveNodesCommand,
  ResizeNodeCommand,
  AddNodeCommand,
  DeleteNodesCommand,
} from '../shared/graphics/commands'
import type { GraphicDocument, SceneNode, Transform } from '../shared/types/graphics'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const baseTransform = (x: number, y: number): Transform => ({
  position: { x, y },
  rotation: 0,
  scale: { x: 1, y: 1 },
  mirror: 'none',
})

const baseNode = {
  visible: true,
  locked: false,
  opacity: 1,
}

function makeGroup(id: string, x: number, y: number, children: SceneNode[] = []): SceneNode {
  return {
    id,
    type: 'group' as const,
    name: id,
    transform: baseTransform(x, y),
    ...baseNode,
    children,
  }
}

function makeDoc(children: SceneNode[] = []): GraphicDocument {
  return {
    id: 'doc',
    type: 'graphic_document',
    name: 'Test Doc',
    transform: baseTransform(0, 0),
    ...baseNode,
    canvas: { width: 1920, height: 1080, backgroundColor: '#000' },
    metadata: {
      designMode: 'graphic',
      graphicScope: 'process',
      gridSize: 20,
      gridVisible: false,
      snapToGrid: false,
      tags: [],
    },
    layers: [],
    expressions: {},
    children,
  }
}

// ---------------------------------------------------------------------------
// MoveNodesCommand
// ---------------------------------------------------------------------------

describe('MoveNodesCommand — execute', () => {
  it('moves a single node by the delta', () => {
    const doc = makeDoc([makeGroup('n1', 100, 200)])
    const cmd = new MoveNodesCommand(['n1'], { x: 50, y: -30 }, new Map())
    const result = cmd.execute(doc)
    const node = result.children.find((n) => n.id === 'n1')!
    expect(node.transform.position.x).toBe(150)
    expect(node.transform.position.y).toBe(170)
  })

  it('moves multiple nodes by the same delta', () => {
    const doc = makeDoc([makeGroup('a', 0, 0), makeGroup('b', 100, 100)])
    const cmd = new MoveNodesCommand(['a', 'b'], { x: 10, y: 10 }, new Map())
    const result = cmd.execute(doc)
    const a = result.children.find((n) => n.id === 'a')!
    const b = result.children.find((n) => n.id === 'b')!
    expect(a.transform.position).toEqual({ x: 10, y: 10 })
    expect(b.transform.position).toEqual({ x: 110, y: 110 })
  })

  it('does not mutate the original document', () => {
    const doc = makeDoc([makeGroup('n1', 50, 50)])
    const cmd = new MoveNodesCommand(['n1'], { x: 100, y: 100 }, new Map())
    cmd.execute(doc)
    expect(doc.children[0].transform.position.x).toBe(50)
  })

  it('skips nodes not found in the document', () => {
    const doc = makeDoc([makeGroup('n1', 0, 0)])
    const cmd = new MoveNodesCommand(['ghost'], { x: 100, y: 100 }, new Map())
    const result = cmd.execute(doc)
    // n1 should be unchanged
    expect(result.children[0].transform.position.x).toBe(0)
  })
})

describe('MoveNodesCommand — undo', () => {
  it('restores previous position from previousTransforms map', () => {
    const prev = new Map([['n1', baseTransform(50, 50)]])
    const doc = makeDoc([makeGroup('n1', 150, 150)])
    const cmd = new MoveNodesCommand(['n1'], { x: 100, y: 100 }, prev)
    const restored = cmd.undo(doc)
    const node = restored.children.find((n) => n.id === 'n1')!
    expect(node.transform.position).toEqual({ x: 50, y: 50 })
  })

  it('execute + undo round-trip returns to original position', () => {
    const originalX = 100
    const originalY = 200
    const doc = makeDoc([makeGroup('n1', originalX, originalY)])
    const prev = new Map([['n1', baseTransform(originalX, originalY)]])
    const cmd = new MoveNodesCommand(['n1'], { x: 50, y: 50 }, prev)
    const moved = cmd.execute(doc)
    const restored = cmd.undo(moved)
    expect(restored.children[0].transform.position.x).toBe(originalX)
    expect(restored.children[0].transform.position.y).toBe(originalY)
  })
})

// ---------------------------------------------------------------------------
// ResizeNodeCommand
// ---------------------------------------------------------------------------

describe('ResizeNodeCommand — execute and undo', () => {
  it('applies new transform on execute', () => {
    const doc = makeDoc([makeGroup('n1', 0, 0)])
    const newTf = baseTransform(200, 300)
    const prevTf = baseTransform(0, 0)
    const cmd = new ResizeNodeCommand('n1', newTf, prevTf)
    const result = cmd.execute(doc)
    const node = result.children.find((n) => n.id === 'n1')!
    expect(node.transform.position).toEqual({ x: 200, y: 300 })
  })

  it('restores previous transform on undo', () => {
    const doc = makeDoc([makeGroup('n1', 200, 300)])
    const newTf = baseTransform(200, 300)
    const prevTf = baseTransform(0, 0)
    const cmd = new ResizeNodeCommand('n1', newTf, prevTf)
    const resized = cmd.execute(doc)
    const restored = cmd.undo(resized)
    expect(restored.children.find((n) => n.id === 'n1')!.transform.position).toEqual({ x: 0, y: 0 })
  })

  it('does not mutate the source document', () => {
    const doc = makeDoc([makeGroup('n1', 10, 10)])
    const cmd = new ResizeNodeCommand('n1', baseTransform(99, 99), baseTransform(10, 10))
    cmd.execute(doc)
    expect(doc.children[0].transform.position.x).toBe(10)
  })
})

// ---------------------------------------------------------------------------
// AddNodeCommand
// ---------------------------------------------------------------------------

describe('AddNodeCommand — execute (add to root)', () => {
  it('adds a new node to document root', () => {
    const doc = makeDoc([])
    const newNode = makeGroup('new-1', 0, 0)
    const cmd = new AddNodeCommand(newNode, null)
    const result = cmd.execute(doc)
    expect(result.children).toHaveLength(1)
    expect(result.children[0].id).toBe('new-1')
  })

  it('appends after existing nodes', () => {
    const doc = makeDoc([makeGroup('existing', 0, 0)])
    const cmd = new AddNodeCommand(makeGroup('new-2', 10, 10), null)
    const result = cmd.execute(doc)
    expect(result.children).toHaveLength(2)
    expect(result.children[1].id).toBe('new-2')
  })

  it('deep clones the added node', () => {
    const node = makeGroup('clone-test', 0, 0)
    const cmd = new AddNodeCommand(node, null)
    const result = cmd.execute(makeDoc([]))
    // Mutate original node — should not affect the doc
    node.transform.position.x = 999
    expect(result.children[0].transform.position.x).toBe(0)
  })
})

describe('AddNodeCommand — undo', () => {
  it('removes the added node from root', () => {
    const doc = makeDoc([makeGroup('existing', 0, 0)])
    const cmd = new AddNodeCommand(makeGroup('to-add', 0, 0), null)
    const after = cmd.execute(doc)
    const restored = cmd.undo(after)
    expect(restored.children).toHaveLength(1)
    expect(restored.children.find((n) => n.id === 'to-add')).toBeUndefined()
  })

  it('execute + undo returns same number of root children', () => {
    const doc = makeDoc([makeGroup('a', 0, 0), makeGroup('b', 10, 10)])
    const cmd = new AddNodeCommand(makeGroup('c', 20, 20), null)
    const after = cmd.execute(doc)
    expect(after.children).toHaveLength(3)
    const restored = cmd.undo(after)
    expect(restored.children).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
// DeleteNodesCommand
// ---------------------------------------------------------------------------

describe('DeleteNodesCommand — execute', () => {
  it('removes a node from root', () => {
    const doc = makeDoc([makeGroup('del-me', 0, 0), makeGroup('keep', 10, 10)])
    const cmd = new DeleteNodesCommand(['del-me'])
    const result = cmd.execute(doc)
    expect(result.children).toHaveLength(1)
    expect(result.children[0].id).toBe('keep')
  })

  it('removes multiple nodes', () => {
    const doc = makeDoc([makeGroup('a', 0, 0), makeGroup('b', 10, 10), makeGroup('c', 20, 20)])
    const cmd = new DeleteNodesCommand(['a', 'c'])
    const result = cmd.execute(doc)
    expect(result.children).toHaveLength(1)
    expect(result.children[0].id).toBe('b')
  })

  it('does nothing for node IDs not in doc', () => {
    const doc = makeDoc([makeGroup('real', 0, 0)])
    const cmd = new DeleteNodesCommand(['ghost'])
    const result = cmd.execute(doc)
    expect(result.children).toHaveLength(1)
  })

  it('does not mutate the original document', () => {
    const doc = makeDoc([makeGroup('n1', 0, 0)])
    const cmd = new DeleteNodesCommand(['n1'])
    cmd.execute(doc)
    expect(doc.children).toHaveLength(1)
  })
})

describe('DeleteNodesCommand — undo', () => {
  it('restores deleted node after undo', () => {
    const doc = makeDoc([makeGroup('target', 50, 75)])
    const cmd = new DeleteNodesCommand(['target'])
    const after = cmd.execute(doc)
    expect(after.children).toHaveLength(0)
    const restored = cmd.undo(after)
    expect(restored.children).toHaveLength(1)
    expect(restored.children[0].id).toBe('target')
    expect(restored.children[0].transform.position).toEqual({ x: 50, y: 75 })
  })

  it('execute + undo round-trip preserves doc structure', () => {
    const doc = makeDoc([makeGroup('a', 0, 0), makeGroup('b', 10, 10)])
    const cmd = new DeleteNodesCommand(['a'])
    const after = cmd.execute(doc)
    const restored = cmd.undo(after)
    expect(restored.children).toHaveLength(2)
    const ids = restored.children.map((n) => n.id)
    expect(ids).toContain('a')
    expect(ids).toContain('b')
  })
})
