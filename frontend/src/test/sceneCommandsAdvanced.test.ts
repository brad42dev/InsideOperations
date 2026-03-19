/**
 * Advanced scene command tests — doc 33 §Unit Tests
 *
 * Covers commands not exercised in sceneCommands.test.ts:
 * - GroupNodesCommand / UngroupCommand
 * - DuplicateNodesCommand
 * - AlignNodesCommand (6 alignment types)
 * - DistributeNodesCommand (horizontal, vertical)
 * - CompoundCommand
 * - RotateNodesCommand / FlipNodesCommand
 * - SetVisibilityCommand / SetLockCommand / SetOpacityCommand
 * - RenameNodeCommand
 */
import { describe, it, expect } from 'vitest'
import {
  GroupNodesCommand,
  UngroupCommand,
  DuplicateNodesCommand,
  AlignNodesCommand,
  DistributeNodesCommand,
  CompoundCommand,
  RotateNodesCommand,
  FlipNodesCommand,
  SetVisibilityCommand,
  SetLockCommand,
  SetOpacityCommand,
  RenameNodeCommand,
  MoveNodesCommand,
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

function makeGroup(id: string, x: number, y: number, children: SceneNode[] = []): SceneNode {
  return {
    id,
    type: 'group' as const,
    name: id,
    transform: baseTransform(x, y),
    visible: true,
    locked: false,
    opacity: 1,
    children,
  }
}

function makeDoc(children: SceneNode[] = []): GraphicDocument {
  return {
    id: 'doc',
    type: 'graphic_document',
    name: 'Test Doc',
    transform: baseTransform(0, 0),
    visible: true,
    locked: false,
    opacity: 1,
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
// GroupNodesCommand
// ---------------------------------------------------------------------------

describe('GroupNodesCommand — execute', () => {
  it('groups selected nodes into a group node', () => {
    const doc = makeDoc([makeGroup('a', 0, 0), makeGroup('b', 50, 50)])
    const cmd = new GroupNodesCommand(['a', 'b'])
    const result = cmd.execute(doc)
    // Should have exactly 1 child (the group)
    expect(result.children).toHaveLength(1)
    expect(result.children[0].type).toBe('group')
  })

  it('grouped node contains the original nodes as children', () => {
    const doc = makeDoc([makeGroup('a', 0, 0), makeGroup('b', 50, 50)])
    const cmd = new GroupNodesCommand(['a', 'b'])
    const result = cmd.execute(doc)
    const group = result.children[0] as SceneNode & { children: SceneNode[] }
    const childIds = group.children.map(c => c.id)
    expect(childIds).toContain('a')
    expect(childIds).toContain('b')
  })

  it('non-grouped nodes remain at root', () => {
    const doc = makeDoc([makeGroup('a', 0, 0), makeGroup('b', 10, 10), makeGroup('c', 20, 20)])
    const cmd = new GroupNodesCommand(['a', 'b'])
    const result = cmd.execute(doc)
    // Group + 'c' = 2 root children
    expect(result.children).toHaveLength(2)
    const ids = result.children.map(n => n.id)
    expect(ids).toContain('c')
  })

  it('does not mutate the original document', () => {
    const doc = makeDoc([makeGroup('a', 0, 0), makeGroup('b', 0, 0)])
    const cmd = new GroupNodesCommand(['a', 'b'])
    cmd.execute(doc)
    expect(doc.children).toHaveLength(2)
    expect(doc.children[0].type).toBe('group')
    expect(doc.children[0].id).toBe('a')
  })
})

describe('GroupNodesCommand — undo', () => {
  it('restores individual nodes after undo', () => {
    const doc = makeDoc([makeGroup('a', 10, 10), makeGroup('b', 20, 20)])
    const cmd = new GroupNodesCommand(['a', 'b'])
    const grouped = cmd.execute(doc)
    const restored = cmd.undo(grouped)
    expect(restored.children).toHaveLength(2)
    const ids = restored.children.map(n => n.id)
    expect(ids).toContain('a')
    expect(ids).toContain('b')
  })

  it('execute + undo is a round trip', () => {
    const doc = makeDoc([makeGroup('a', 5, 5), makeGroup('b', 15, 15), makeGroup('c', 25, 25)])
    const cmd = new GroupNodesCommand(['a', 'b'])
    const after = cmd.execute(doc)
    const restored = cmd.undo(after)
    expect(restored.children).toHaveLength(3)
  })
})

// ---------------------------------------------------------------------------
// UngroupCommand
// ---------------------------------------------------------------------------

describe('UngroupCommand — execute', () => {
  it('dissolves a group and promotes its children to root', () => {
    // Build a group with two children
    const innerA = makeGroup('inner-a', 10, 10)
    const innerB = makeGroup('inner-b', 20, 20)
    const group = makeGroup('grp', 0, 0, [innerA, innerB])
    const doc = makeDoc([group])
    const cmd = new UngroupCommand('grp')
    const result = cmd.execute(doc)
    expect(result.children).toHaveLength(2)
    const ids = result.children.map(n => n.id)
    expect(ids).toContain('inner-a')
    expect(ids).toContain('inner-b')
  })

  it('does nothing for an unknown group id', () => {
    const doc = makeDoc([makeGroup('real', 0, 0)])
    const cmd = new UngroupCommand('ghost')
    const result = cmd.execute(doc)
    expect(result.children).toHaveLength(1)
  })
})

describe('UngroupCommand — undo', () => {
  it('restores the group after undo', () => {
    const inner = makeGroup('inner', 5, 5)
    const group = makeGroup('grp', 0, 0, [inner])
    const doc = makeDoc([group])
    const cmd = new UngroupCommand('grp')
    const ungrouped = cmd.execute(doc)
    const restored = cmd.undo(ungrouped)
    expect(restored.children).toHaveLength(1)
    expect(restored.children[0].id).toBe('grp')
  })
})

// ---------------------------------------------------------------------------
// DuplicateNodesCommand
// ---------------------------------------------------------------------------

describe('DuplicateNodesCommand — execute', () => {
  it('duplicates a node and adds it after the original', () => {
    const doc = makeDoc([makeGroup('orig', 100, 100)])
    const cmd = new DuplicateNodesCommand(['orig'])
    const result = cmd.execute(doc)
    expect(result.children).toHaveLength(2)
  })

  it('duplicate is offset by +20, +20 from original', () => {
    const doc = makeDoc([makeGroup('orig', 100, 100)])
    const cmd = new DuplicateNodesCommand(['orig'])
    const result = cmd.execute(doc)
    const dupe = result.children[1]
    expect(dupe.transform.position.x).toBe(120)
    expect(dupe.transform.position.y).toBe(120)
  })

  it('duplicate has a different id from the original', () => {
    const doc = makeDoc([makeGroup('orig', 0, 0)])
    const cmd = new DuplicateNodesCommand(['orig'])
    const result = cmd.execute(doc)
    expect(result.children[0].id).toBe('orig')
    expect(result.children[1].id).not.toBe('orig')
  })

  it('undo removes the duplicate', () => {
    const doc = makeDoc([makeGroup('orig', 0, 0)])
    const cmd = new DuplicateNodesCommand(['orig'])
    const after = cmd.execute(doc)
    const restored = cmd.undo(after)
    expect(restored.children).toHaveLength(1)
    expect(restored.children[0].id).toBe('orig')
  })
})

// ---------------------------------------------------------------------------
// AlignNodesCommand
// ---------------------------------------------------------------------------

describe('AlignNodesCommand', () => {
  it('align left — all nodes to the leftmost x', () => {
    const doc = makeDoc([makeGroup('a', 10, 0), makeGroup('b', 50, 0), makeGroup('c', 30, 0)])
    const cmd = new AlignNodesCommand(['a', 'b', 'c'], 'left')
    const result = cmd.execute(doc)
    for (const node of result.children) {
      expect(node.transform.position.x).toBe(10)
    }
  })

  it('align right — all nodes to the rightmost x', () => {
    const doc = makeDoc([makeGroup('a', 10, 0), makeGroup('b', 80, 0)])
    const cmd = new AlignNodesCommand(['a', 'b'], 'right')
    const result = cmd.execute(doc)
    for (const node of result.children) {
      expect(node.transform.position.x).toBe(80)
    }
  })

  it('align top — all nodes to the minimum y', () => {
    const doc = makeDoc([makeGroup('a', 0, 5), makeGroup('b', 0, 40)])
    const cmd = new AlignNodesCommand(['a', 'b'], 'top')
    const result = cmd.execute(doc)
    for (const node of result.children) {
      expect(node.transform.position.y).toBe(5)
    }
  })

  it('align bottom — all nodes to the maximum y', () => {
    const doc = makeDoc([makeGroup('a', 0, 0), makeGroup('b', 0, 60)])
    const cmd = new AlignNodesCommand(['a', 'b'], 'bottom')
    const result = cmd.execute(doc)
    for (const node of result.children) {
      expect(node.transform.position.y).toBe(60)
    }
  })

  it('undo restores previous positions', () => {
    const doc = makeDoc([makeGroup('a', 10, 0), makeGroup('b', 80, 0)])
    const cmd = new AlignNodesCommand(['a', 'b'], 'left')
    const aligned = cmd.execute(doc)
    const restored = cmd.undo(aligned)
    expect(restored.children.find(n => n.id === 'a')!.transform.position.x).toBe(10)
    expect(restored.children.find(n => n.id === 'b')!.transform.position.x).toBe(80)
  })
})

// ---------------------------------------------------------------------------
// DistributeNodesCommand
// ---------------------------------------------------------------------------

describe('DistributeNodesCommand', () => {
  it('horizontal distribute: middle node evenly spaced', () => {
    // Nodes at x=0, x=?, x=100 — after distribute middle should be at x=50
    const doc = makeDoc([
      makeGroup('a', 0, 0),
      makeGroup('b', 20, 0), // will be redistributed
      makeGroup('c', 100, 0),
    ])
    const cmd = new DistributeNodesCommand(['a', 'b', 'c'], 'horizontal')
    const result = cmd.execute(doc)
    const bNode = result.children.find(n => n.id === 'b')!
    expect(bNode.transform.position.x).toBe(50)
  })

  it('vertical distribute: middle node evenly spaced', () => {
    const doc = makeDoc([
      makeGroup('a', 0, 0),
      makeGroup('b', 0, 10), // will be redistributed
      makeGroup('c', 0, 200),
    ])
    const cmd = new DistributeNodesCommand(['a', 'b', 'c'], 'vertical')
    const result = cmd.execute(doc)
    const bNode = result.children.find(n => n.id === 'b')!
    expect(bNode.transform.position.y).toBe(100)
  })

  it('does nothing with 2 nodes', () => {
    const doc = makeDoc([makeGroup('a', 0, 0), makeGroup('b', 100, 0)])
    const cmd = new DistributeNodesCommand(['a', 'b'], 'horizontal')
    const result = cmd.execute(doc)
    // Doc unchanged (returns clone, not same ref)
    expect(result.children.find(n => n.id === 'a')!.transform.position.x).toBe(0)
    expect(result.children.find(n => n.id === 'b')!.transform.position.x).toBe(100)
  })

  it('undo restores original positions', () => {
    const doc = makeDoc([
      makeGroup('a', 0, 0),
      makeGroup('b', 20, 0),
      makeGroup('c', 100, 0),
    ])
    const cmd = new DistributeNodesCommand(['a', 'b', 'c'], 'horizontal')
    const after = cmd.execute(doc)
    const restored = cmd.undo(after)
    expect(restored.children.find(n => n.id === 'b')!.transform.position.x).toBe(20)
  })
})

// ---------------------------------------------------------------------------
// CompoundCommand
// ---------------------------------------------------------------------------

describe('CompoundCommand', () => {
  it('executes all sub-commands in sequence', () => {
    const doc = makeDoc([makeGroup('a', 0, 0), makeGroup('b', 0, 0)])
    const move1 = new MoveNodesCommand(['a'], { x: 10, y: 0 }, new Map())
    const move2 = new MoveNodesCommand(['b'], { x: 20, y: 0 }, new Map())
    const cmd = new CompoundCommand('Move two', [move1, move2])
    const result = cmd.execute(doc)
    expect(result.children.find(n => n.id === 'a')!.transform.position.x).toBe(10)
    expect(result.children.find(n => n.id === 'b')!.transform.position.x).toBe(20)
  })

  it('undo reverses all sub-commands in reverse order', () => {
    const doc = makeDoc([makeGroup('a', 100, 0)])
    const prev = new Map([['a', baseTransform(100, 0)]])
    const move = new MoveNodesCommand(['a'], { x: 50, y: 0 }, prev)
    const cmd = new CompoundCommand('Move a', [move])
    const after = cmd.execute(doc)
    const restored = cmd.undo(after)
    expect(restored.children[0].transform.position.x).toBe(100)
  })

  it('has the description passed in constructor', () => {
    const cmd = new CompoundCommand('Compound op', [])
    expect(cmd.description).toBe('Compound op')
  })
})

// ---------------------------------------------------------------------------
// RotateNodesCommand
// ---------------------------------------------------------------------------

describe('RotateNodesCommand', () => {
  it('applies new rotation transform on execute', () => {
    const doc = makeDoc([makeGroup('n1', 0, 0)])
    const newTf = { ...baseTransform(0, 0), rotation: 90 }
    const prevTf = baseTransform(0, 0)
    const cmd = new RotateNodesCommand(
      ['n1'],
      new Map([['n1', newTf]]),
      new Map([['n1', prevTf]])
    )
    const result = cmd.execute(doc)
    expect(result.children[0].transform.rotation).toBe(90)
  })

  it('restores previous rotation on undo', () => {
    const doc = makeDoc([makeGroup('n1', 0, 0)])
    const newTf = { ...baseTransform(0, 0), rotation: 45 }
    const prevTf = baseTransform(0, 0)
    const cmd = new RotateNodesCommand(
      ['n1'],
      new Map([['n1', newTf]]),
      new Map([['n1', prevTf]])
    )
    const rotated = cmd.execute(doc)
    const restored = cmd.undo(rotated)
    expect(restored.children[0].transform.rotation).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// FlipNodesCommand
// ---------------------------------------------------------------------------

describe('FlipNodesCommand', () => {
  it('flips horizontal: none → horizontal', () => {
    const doc = makeDoc([makeGroup('n1', 0, 0)])
    const prevTf = baseTransform(0, 0)
    const cmd = new FlipNodesCommand(['n1'], 'horizontal', new Map([['n1', prevTf]]))
    const result = cmd.execute(doc)
    expect(result.children[0].transform.mirror).toBe('horizontal')
  })

  it('flips horizontal again: horizontal → none', () => {
    const node = makeGroup('n1', 0, 0)
    node.transform.mirror = 'horizontal'
    const doc = makeDoc([node])
    const prevTf = { ...baseTransform(0, 0), mirror: 'horizontal' as const }
    const cmd = new FlipNodesCommand(['n1'], 'horizontal', new Map([['n1', prevTf]]))
    const result = cmd.execute(doc)
    expect(result.children[0].transform.mirror).toBe('none')
  })

  it('restores mirror on undo', () => {
    const doc = makeDoc([makeGroup('n1', 0, 0)])
    const prevTf = baseTransform(0, 0)
    const cmd = new FlipNodesCommand(['n1'], 'vertical', new Map([['n1', prevTf]]))
    const flipped = cmd.execute(doc)
    const restored = cmd.undo(flipped)
    expect(restored.children[0].transform.mirror).toBe('none')
  })
})

// ---------------------------------------------------------------------------
// SetVisibilityCommand / SetLockCommand / SetOpacityCommand
// ---------------------------------------------------------------------------

describe('SetVisibilityCommand', () => {
  it('hides a node on execute', () => {
    const doc = makeDoc([makeGroup('n1', 0, 0)])
    const cmd = new SetVisibilityCommand('n1', false, true)
    const result = cmd.execute(doc)
    expect(result.children[0].visible).toBe(false)
  })

  it('restores visibility on undo', () => {
    const doc = makeDoc([makeGroup('n1', 0, 0)])
    const cmd = new SetVisibilityCommand('n1', false, true)
    const hidden = cmd.execute(doc)
    const restored = cmd.undo(hidden)
    expect(restored.children[0].visible).toBe(true)
  })
})

describe('SetLockCommand', () => {
  it('locks a node on execute', () => {
    const doc = makeDoc([makeGroup('n1', 0, 0)])
    const cmd = new SetLockCommand('n1', true, false)
    const result = cmd.execute(doc)
    expect(result.children[0].locked).toBe(true)
  })

  it('unlocks on undo', () => {
    const doc = makeDoc([makeGroup('n1', 0, 0)])
    const cmd = new SetLockCommand('n1', true, false)
    const locked = cmd.execute(doc)
    const restored = cmd.undo(locked)
    expect(restored.children[0].locked).toBe(false)
  })
})

describe('SetOpacityCommand', () => {
  it('sets opacity on execute', () => {
    const doc = makeDoc([makeGroup('n1', 0, 0)])
    const cmd = new SetOpacityCommand('n1', 0.5, 1.0)
    const result = cmd.execute(doc)
    expect(result.children[0].opacity).toBe(0.5)
  })

  it('restores opacity on undo', () => {
    const doc = makeDoc([makeGroup('n1', 0, 0)])
    const cmd = new SetOpacityCommand('n1', 0.25, 1.0)
    const dimmed = cmd.execute(doc)
    const restored = cmd.undo(dimmed)
    expect(restored.children[0].opacity).toBe(1.0)
  })
})

// ---------------------------------------------------------------------------
// RenameNodeCommand
// ---------------------------------------------------------------------------

describe('RenameNodeCommand', () => {
  it('renames node on execute', () => {
    const doc = makeDoc([makeGroup('n1', 0, 0)])
    const cmd = new RenameNodeCommand('n1', 'Pump-101', 'n1')
    const result = cmd.execute(doc)
    expect(result.children[0].name).toBe('Pump-101')
  })

  it('restores old name on undo', () => {
    const doc = makeDoc([makeGroup('n1', 0, 0)])
    const cmd = new RenameNodeCommand('n1', 'Pump-101', 'n1')
    const renamed = cmd.execute(doc)
    const restored = cmd.undo(renamed)
    expect(restored.children[0].name).toBe('n1')
  })

  it('undefined prevName → undo sets name to undefined', () => {
    const doc = makeDoc([makeGroup('n1', 0, 0)])
    const cmd = new RenameNodeCommand('n1', 'New Name', undefined)
    const renamed = cmd.execute(doc)
    const restored = cmd.undo(renamed)
    expect(restored.children[0].name).toBeUndefined()
  })
})
