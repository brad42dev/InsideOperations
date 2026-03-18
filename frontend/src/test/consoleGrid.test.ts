import { describe, it, expect } from 'vitest'
import { presetToGridItems } from '../pages/console/WorkspaceGrid'
import type { LayoutPreset, PaneConfig } from '../pages/console/types'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePanes(count: number): PaneConfig[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `pane-${i}`,
    type: 'blank' as const,
  }))
}

// ---------------------------------------------------------------------------
// presetToGridItems
// ---------------------------------------------------------------------------

describe('presetToGridItems — even grid layouts', () => {
  it('1x1 maps to one full-grid item (12×12)', () => {
    const items = presetToGridItems('1x1' as LayoutPreset, makePanes(1))
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ x: 0, y: 0, w: 12, h: 12 })
  })

  it('2x1 produces two side-by-side panes', () => {
    const items = presetToGridItems('2x1' as LayoutPreset, makePanes(2))
    expect(items).toHaveLength(2)
    // Each should be 6 cols wide
    expect(items[0].w).toBe(6)
    expect(items[1].w).toBe(6)
    // Both start at row 0
    expect(items[0].y).toBe(0)
    expect(items[1].y).toBe(0)
    // Second pane starts at column 6
    expect(items[1].x).toBe(6)
  })

  it('2x2 produces four equally-sized panes', () => {
    const items = presetToGridItems('2x2' as LayoutPreset, makePanes(4))
    expect(items).toHaveLength(4)
    for (const item of items) {
      expect(item.w).toBe(6)
      expect(item.h).toBe(6)
    }
  })

  it('3x3 produces nine panes each 4×4', () => {
    const items = presetToGridItems('3x3' as LayoutPreset, makePanes(9))
    expect(items).toHaveLength(9)
    for (const item of items) {
      expect(item.w).toBe(4)
      expect(item.h).toBe(4)
    }
  })

  it('handles fewer panes than preset slots (truncates to pane count)', () => {
    const items = presetToGridItems('2x2' as LayoutPreset, makePanes(2))
    expect(items).toHaveLength(2)
  })

  it('assigns pane IDs as grid item keys', () => {
    const panes = makePanes(2)
    const items = presetToGridItems('2x1' as LayoutPreset, panes)
    expect(items[0].i).toBe(panes[0].id)
    expect(items[1].i).toBe(panes[1].id)
  })
})

describe('presetToGridItems — asymmetric layouts', () => {
  it('big-left-3-right produces 4 panes', () => {
    const items = presetToGridItems('big-left-3-right' as LayoutPreset, makePanes(4))
    expect(items).toHaveLength(4)
  })

  it('pip produces 2 panes (picture-in-picture)', () => {
    const items = presetToGridItems('pip' as LayoutPreset, makePanes(2))
    expect(items).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
// getVisiblePointIds — inlined from process/index.tsx
// Tests viewport-based point subscription filtering.
// ---------------------------------------------------------------------------

import type { SceneNode, ViewportState, DisplayElement } from '../shared/types/graphics'

function getVisiblePointIds(
  doc: { children: SceneNode[] },
  vp: ViewportState
): string[] {
  const visible = new Set<string>()
  const vLeft   = vp.panX
  const vTop    = vp.panY
  const vRight  = vp.panX + vp.screenWidth / vp.zoom
  const vBottom = vp.panY + vp.screenHeight / vp.zoom

  function scanNode(node: SceneNode) {
    if (!node.visible) return
    const { x, y } = node.transform.position
    const nRight  = x + 200
    const nBottom = y + 200
    const inViewport = x < vRight && nRight > vLeft && y < vBottom && nBottom > vTop

    if (inViewport) {
      if (node.type === 'display_element') {
        const de = node as DisplayElement
        if (de.binding?.pointId) visible.add(de.binding.pointId)
      }
    }

    if ('children' in node && Array.isArray(node.children)) {
      for (const child of node.children) scanNode(child as SceneNode)
    }
  }

  for (const node of doc.children) scanNode(node)
  return Array.from(visible)
}

function makeViewport(overrides: Partial<ViewportState> = {}): ViewportState {
  return {
    panX: 0, panY: 0, zoom: 1,
    canvasWidth: 1920, canvasHeight: 1080,
    screenWidth: 1920, screenHeight: 1080,
    ...overrides,
  }
}

function makeDisplayElement(x: number, y: number, pointId: string): SceneNode {
  return {
    id: `de-${pointId}`,
    type: 'display_element',
    name: pointId,
    transform: { position: { x, y }, rotation: 0, scale: { x: 1, y: 1 } },
    visible: true,
    locked: false,
    opacity: 1,
    binding: { pointId, mode: 'value' },
    elementType: 'text_readout',
    displayFormat: '#.##',
    units: '',
    alarmThresholds: [],
  } as unknown as SceneNode
}

describe('getVisiblePointIds', () => {
  it('returns empty array for empty scene', () => {
    const ids = getVisiblePointIds({ children: [] }, makeViewport())
    expect(ids).toEqual([])
  })

  it('returns point IDs for elements within viewport', () => {
    const node = makeDisplayElement(100, 100, 'FIC-101')
    const ids = getVisiblePointIds({ children: [node] }, makeViewport())
    expect(ids).toContain('FIC-101')
  })

  it('excludes elements completely outside viewport (right side)', () => {
    // Element at x=2200, which is past 1920px viewport width
    const node = makeDisplayElement(2200, 100, 'FIC-999')
    const ids = getVisiblePointIds({ children: [node] }, makeViewport())
    expect(ids).not.toContain('FIC-999')
  })

  it('excludes elements completely outside viewport (below)', () => {
    // Element at y=1500, which is past 1080px viewport height
    const node = makeDisplayElement(100, 1500, 'FIC-998')
    const ids = getVisiblePointIds({ children: [node] }, makeViewport())
    expect(ids).not.toContain('FIC-998')
  })

  it('excludes hidden nodes', () => {
    const node = makeDisplayElement(100, 100, 'FIC-HIDDEN')
    ;(node as SceneNode & { visible: boolean }).visible = false
    const ids = getVisiblePointIds({ children: [node] }, makeViewport())
    expect(ids).not.toContain('FIC-HIDDEN')
  })

  it('respects pan offset — panned so element is out of view', () => {
    // Element at canvas (100, 100), viewport panned to x=500 so element is left of viewport
    const node = makeDisplayElement(100, 100, 'FIC-OFFSCREEN')
    const vp = makeViewport({ panX: 500 })
    const ids = getVisiblePointIds({ children: [node] }, vp)
    expect(ids).not.toContain('FIC-OFFSCREEN')
  })

  it('respects pan offset — panned so element is within view', () => {
    // Element at canvas (600, 100), viewport panned to x=500
    const node = makeDisplayElement(600, 100, 'FIC-VISIBLE')
    const vp = makeViewport({ panX: 500 })
    const ids = getVisiblePointIds({ children: [node] }, vp)
    expect(ids).toContain('FIC-VISIBLE')
  })

  it('respects zoom — zoomed out so more elements are visible', () => {
    // With zoom=0.5, viewport shows 3840×2160 canvas area
    const node = makeDisplayElement(2000, 100, 'FIC-ZOOM')
    const vp = makeViewport({ zoom: 0.5 })
    const ids = getVisiblePointIds({ children: [node] }, vp)
    expect(ids).toContain('FIC-ZOOM')
  })

  it('excludes nodes without point bindings (display_element with no binding)', () => {
    const node: SceneNode = {
      id: 'de-unbound',
      type: 'display_element',
      name: 'unbound',
      transform: { position: { x: 100, y: 100 }, rotation: 0, scale: { x: 1, y: 1 } },
      visible: true,
      locked: false,
      opacity: 1,
      elementType: 'text_readout',
      displayFormat: '#.##',
      units: '',
      alarmThresholds: [],
    } as unknown as SceneNode
    const ids = getVisiblePointIds({ children: [node] }, makeViewport())
    expect(ids).toHaveLength(0)
  })

  it('deduplicates: same point bound to multiple elements counted once', () => {
    const node1 = makeDisplayElement(100, 100, 'FIC-101')
    const node2 = makeDisplayElement(200, 100, 'FIC-101')
    const ids = getVisiblePointIds({ children: [node1, node2] }, makeViewport())
    expect(ids.filter((id) => id === 'FIC-101')).toHaveLength(1)
  })
})
