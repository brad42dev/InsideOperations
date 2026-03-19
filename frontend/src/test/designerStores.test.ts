/**
 * Tests for Designer module Zustand stores — doc 33 §Unit Tests
 *
 * Covers:
 * - useSelectionStore — multi-select, toggle, scope, marquee
 * - useClipboardStore — copy, bounds computation, clear
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { act } from '@testing-library/react'
import { useSelectionStore } from '../shared/graphics/selectionStore'
import { useClipboardStore } from '../shared/graphics/clipboardStore'
import type { SceneNode } from '../shared/types/graphics'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const baseTransform = (x: number, y: number) => ({
  position: { x, y },
  rotation: 0,
  scale: { x: 1, y: 1 },
  mirror: 'none' as const,
})

function makeNode(id: string, x: number, y: number): SceneNode {
  return {
    id,
    type: 'group' as const,
    transform: baseTransform(x, y),
    visible: true,
    locked: false,
    opacity: 1,
    children: [],
    name: id,
  }
}

// ---------------------------------------------------------------------------
// useSelectionStore
// ---------------------------------------------------------------------------

describe('useSelectionStore — initial state', () => {
  beforeEach(() => {
    act(() => {
      useSelectionStore.getState().clear()
      useSelectionStore.setState({ selectionScope: 'root', scopeContainerId: null, marquee: null })
    })
  })

  it('starts with no selected nodes', () => {
    const state = useSelectionStore.getState()
    expect(state.selectedNodeIds.size).toBe(0)
  })

  it('starts in root scope', () => {
    expect(useSelectionStore.getState().selectionScope).toBe('root')
  })

  it('starts with no scope container', () => {
    expect(useSelectionStore.getState().scopeContainerId).toBeNull()
  })

  it('starts with no marquee', () => {
    expect(useSelectionStore.getState().marquee).toBeNull()
  })
})

describe('useSelectionStore — select', () => {
  beforeEach(() => {
    act(() => useSelectionStore.getState().clear())
  })

  it('selects a single node', () => {
    act(() => useSelectionStore.getState().select(['node-1']))
    const state = useSelectionStore.getState()
    expect(state.selectedNodeIds.has('node-1')).toBe(true)
    expect(state.selectedNodeIds.size).toBe(1)
  })

  it('replaces selection on new select() call', () => {
    act(() => useSelectionStore.getState().select(['node-1']))
    act(() => useSelectionStore.getState().select(['node-2']))
    const state = useSelectionStore.getState()
    expect(state.selectedNodeIds.has('node-1')).toBe(false)
    expect(state.selectedNodeIds.has('node-2')).toBe(true)
  })

  it('selects multiple nodes at once', () => {
    act(() => useSelectionStore.getState().select(['a', 'b', 'c']))
    const state = useSelectionStore.getState()
    expect(state.selectedNodeIds.size).toBe(3)
    expect(state.selectedNodeIds.has('a')).toBe(true)
    expect(state.selectedNodeIds.has('b')).toBe(true)
    expect(state.selectedNodeIds.has('c')).toBe(true)
  })

  it('select with scope changes the scope', () => {
    act(() => useSelectionStore.getState().select(['n1'], 'group'))
    expect(useSelectionStore.getState().selectionScope).toBe('group')
  })

  it('select without scope keeps current scope', () => {
    act(() => {
      useSelectionStore.setState({ selectionScope: 'symbol' })
      useSelectionStore.getState().select(['n1'])
    })
    expect(useSelectionStore.getState().selectionScope).toBe('symbol')
  })
})

describe('useSelectionStore — toggle', () => {
  beforeEach(() => {
    act(() => useSelectionStore.getState().clear())
  })

  it('adds node when not selected', () => {
    act(() => useSelectionStore.getState().toggle('x'))
    expect(useSelectionStore.getState().selectedNodeIds.has('x')).toBe(true)
  })

  it('removes node when already selected', () => {
    act(() => useSelectionStore.getState().select(['x']))
    act(() => useSelectionStore.getState().toggle('x'))
    expect(useSelectionStore.getState().selectedNodeIds.has('x')).toBe(false)
  })

  it('toggling does not affect other selected nodes', () => {
    act(() => useSelectionStore.getState().select(['a', 'b']))
    act(() => useSelectionStore.getState().toggle('a'))
    const state = useSelectionStore.getState()
    expect(state.selectedNodeIds.has('a')).toBe(false)
    expect(state.selectedNodeIds.has('b')).toBe(true)
  })
})

describe('useSelectionStore — addToSelection', () => {
  beforeEach(() => {
    act(() => useSelectionStore.getState().clear())
  })

  it('adds nodes without clearing existing selection', () => {
    act(() => useSelectionStore.getState().select(['a']))
    act(() => useSelectionStore.getState().addToSelection(['b', 'c']))
    const state = useSelectionStore.getState()
    expect(state.selectedNodeIds.has('a')).toBe(true)
    expect(state.selectedNodeIds.has('b')).toBe(true)
    expect(state.selectedNodeIds.has('c')).toBe(true)
  })

  it('does not add duplicates', () => {
    act(() => useSelectionStore.getState().select(['a']))
    act(() => useSelectionStore.getState().addToSelection(['a', 'b']))
    expect(useSelectionStore.getState().selectedNodeIds.size).toBe(2)
  })
})

describe('useSelectionStore — scope management', () => {
  beforeEach(() => {
    act(() => {
      useSelectionStore.getState().clear()
      useSelectionStore.setState({ selectionScope: 'root', scopeContainerId: null })
    })
  })

  it('enterScope sets container ID and scope type', () => {
    act(() => useSelectionStore.getState().enterScope('group-1', 'group'))
    const state = useSelectionStore.getState()
    expect(state.scopeContainerId).toBe('group-1')
    expect(state.selectionScope).toBe('group')
  })

  it('enterScope clears selection', () => {
    act(() => useSelectionStore.getState().select(['n1', 'n2']))
    act(() => useSelectionStore.getState().enterScope('g1', 'group'))
    expect(useSelectionStore.getState().selectedNodeIds.size).toBe(0)
  })

  it('exitScope resets to root scope', () => {
    act(() => useSelectionStore.getState().enterScope('g1', 'symbol'))
    act(() => useSelectionStore.getState().exitScope())
    const state = useSelectionStore.getState()
    expect(state.selectionScope).toBe('root')
    expect(state.scopeContainerId).toBeNull()
  })
})

describe('useSelectionStore — marquee', () => {
  it('setMarquee stores the marquee rect', () => {
    act(() => useSelectionStore.getState().setMarquee({ startX: 10, startY: 20, endX: 100, endY: 200 }))
    const marquee = useSelectionStore.getState().marquee
    expect(marquee?.startX).toBe(10)
    expect(marquee?.endX).toBe(100)
  })

  it('setMarquee(null) clears the marquee', () => {
    act(() => useSelectionStore.getState().setMarquee({ startX: 0, startY: 0, endX: 10, endY: 10 }))
    act(() => useSelectionStore.getState().setMarquee(null))
    expect(useSelectionStore.getState().marquee).toBeNull()
  })
})

describe('useSelectionStore — isSelected', () => {
  it('returns true for selected node', () => {
    act(() => useSelectionStore.getState().select(['target']))
    expect(useSelectionStore.getState().isSelected('target')).toBe(true)
  })

  it('returns false for unselected node', () => {
    act(() => useSelectionStore.getState().clear())
    expect(useSelectionStore.getState().isSelected('ghost')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// useClipboardStore
// ---------------------------------------------------------------------------

describe('useClipboardStore — initial state', () => {
  beforeEach(() => {
    act(() => useClipboardStore.getState().clear())
  })

  it('starts with null clipboard data', () => {
    expect(useClipboardStore.getState().data).toBeNull()
  })
})

describe('useClipboardStore — copy', () => {
  beforeEach(() => {
    act(() => useClipboardStore.getState().clear())
  })

  it('stores copied nodes', () => {
    const nodes = [makeNode('n1', 10, 20)]
    act(() => useClipboardStore.getState().copy(nodes, 'graphic-1'))
    const data = useClipboardStore.getState().data
    expect(data).not.toBeNull()
    expect(data?.nodes).toHaveLength(1)
    expect(data?.nodes[0].id).toBe('n1')
    expect(data?.sourceGraphicId).toBe('graphic-1')
    expect(data?.version).toBe('1.0')
  })

  it('deep clones nodes (mutations do not affect clipboard)', () => {
    const node = makeNode('n1', 0, 0)
    act(() => useClipboardStore.getState().copy([node], 'g1'))
    const original = useClipboardStore.getState().data!
    // Mutate original node's position
    node.transform.position.x = 999
    // Clipboard copy should be unaffected
    expect(original.nodes[0].transform.position.x).toBe(0)
  })

  it('computes correct originalBounds for a single node', () => {
    const nodes = [makeNode('a', 100, 200)]
    act(() => useClipboardStore.getState().copy(nodes, 'g'))
    const bounds = useClipboardStore.getState().data?.originalBounds
    expect(bounds?.x).toBe(100)
    expect(bounds?.y).toBe(200)
    expect(bounds?.width).toBe(0)  // single node = zero-size bbox
    expect(bounds?.height).toBe(0)
  })

  it('computes correct originalBounds for multiple nodes', () => {
    const nodes = [
      makeNode('a', 10, 20),
      makeNode('b', 110, 120),
    ]
    act(() => useClipboardStore.getState().copy(nodes, 'g'))
    const bounds = useClipboardStore.getState().data?.originalBounds
    expect(bounds?.x).toBe(10)
    expect(bounds?.y).toBe(20)
    expect(bounds?.width).toBe(100)
    expect(bounds?.height).toBe(100)
  })

  it('handles empty node array (zero bounds)', () => {
    act(() => useClipboardStore.getState().copy([], 'g'))
    const data = useClipboardStore.getState().data
    expect(data?.nodes).toHaveLength(0)
    expect(data?.originalBounds).toEqual({ x: 0, y: 0, width: 0, height: 0 })
  })
})

describe('useClipboardStore — clear', () => {
  it('sets data to null', () => {
    const nodes = [makeNode('n1', 0, 0)]
    act(() => useClipboardStore.getState().copy(nodes, 'g'))
    act(() => useClipboardStore.getState().clear())
    expect(useClipboardStore.getState().data).toBeNull()
  })
})
