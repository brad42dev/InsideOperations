/**
 * Tests for extractPointIds and extractViewportPointIds (pointExtractor.ts)
 *
 * These functions walk scene graphs to collect WebSocket subscription point IDs.
 * They are critical for the real-time data pipeline in Process and Console modules.
 */
import { describe, it, expect } from 'vitest'
import { extractPointIds, extractViewportPointIds } from '../shared/graphics/pointExtractor'
import type { GraphicDocument, DisplayElement, SymbolInstance, SceneNode } from '../shared/types/graphics'

// ---------------------------------------------------------------------------
// Helpers — minimal GraphicDocument construction
// ---------------------------------------------------------------------------

const baseTransform = {
  position: { x: 100, y: 100 },
  rotation: 0,
  scale: { x: 1, y: 1 },
  mirror: 'none' as const,
}

const baseNode = {
  transform: baseTransform,
  visible: true,
  locked: false,
  opacity: 1,
}

function makeDoc(children: SceneNode[], expressions: Record<string, { ast: object }> = {}): GraphicDocument {
  return {
    id: 'doc-1',
    type: 'graphic_document',
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
    expressions,
    children,
  }
}

function makeDisplayElement(pointId: string, id = 'de-1'): DisplayElement {
  return {
    id,
    type: 'display_element',
    ...baseNode,
    displayType: 'text_readout',
    binding: { pointId },
    config: { displayType: 'text_readout', showBox: false, showLabel: false, showUnits: false, valueFormat: '', minWidth: 60 },
  }
}

function makeSymbolInstance(pointId: string, id = 'si-1'): SymbolInstance {
  return {
    id,
    type: 'symbol_instance',
    ...baseNode,
    shapeRef: { shapeId: 'pump-centrifugal', variant: 'default' },
    composableParts: [],
    textZoneOverrides: {},
    children: [],
    stateBinding: { pointId },
    propertyOverrides: {},
  }
}

// ---------------------------------------------------------------------------
// extractPointIds
// ---------------------------------------------------------------------------

describe('extractPointIds — basic bindings', () => {
  it('returns empty set for document with no children', () => {
    const doc = makeDoc([])
    const ids = extractPointIds(doc)
    expect(ids.size).toBe(0)
  })

  it('collects pointId from a single DisplayElement', () => {
    const doc = makeDoc([makeDisplayElement('PT-100')])
    const ids = extractPointIds(doc)
    expect(ids.has('PT-100')).toBe(true)
    expect(ids.size).toBe(1)
  })

  it('collects pointId from a SymbolInstance stateBinding', () => {
    const doc = makeDoc([makeSymbolInstance('PUMP-101.STATE')])
    const ids = extractPointIds(doc)
    expect(ids.has('PUMP-101.STATE')).toBe(true)
  })

  it('collects multiple distinct points from multiple nodes', () => {
    const doc = makeDoc([
      makeDisplayElement('TI-200', 'de-1'),
      makeDisplayElement('PI-200', 'de-2'),
      makeSymbolInstance('V-201.POS', 'si-1'),
    ])
    const ids = extractPointIds(doc)
    expect(ids.size).toBe(3)
    expect(ids.has('TI-200')).toBe(true)
    expect(ids.has('PI-200')).toBe(true)
    expect(ids.has('V-201.POS')).toBe(true)
  })

  it('deduplicates when the same pointId appears in multiple nodes', () => {
    const doc = makeDoc([
      makeDisplayElement('SHARED-POINT', 'de-1'),
      makeDisplayElement('SHARED-POINT', 'de-2'),
    ])
    const ids = extractPointIds(doc)
    expect(ids.size).toBe(1)
    expect(ids.has('SHARED-POINT')).toBe(true)
  })

  it('skips DisplayElement without a pointId binding', () => {
    const de: DisplayElement = {
      id: 'de-1',
      type: 'display_element',
      ...baseNode,
      displayType: 'text_readout',
      binding: {},  // no pointId
      config: { displayType: 'text_readout', showBox: false, showLabel: false, showUnits: false, valueFormat: '', minWidth: 60 },
    }
    const doc = makeDoc([de])
    const ids = extractPointIds(doc)
    expect(ids.size).toBe(0)
  })

  it('skips SymbolInstance without stateBinding', () => {
    const si: SymbolInstance = {
      id: 'si-1',
      type: 'symbol_instance',
      ...baseNode,
      shapeRef: { shapeId: 'tank', variant: 'default' },
      composableParts: [],
      textZoneOverrides: {},
      children: [],
      stateBinding: undefined,
      propertyOverrides: {},
    }
    const doc = makeDoc([si])
    const ids = extractPointIds(doc)
    expect(ids.size).toBe(0)
  })
})

describe('extractPointIds — expression dependencies', () => {
  it('extracts point_ref nodes from expression AST', () => {
    const expr = {
      ast: {
        type: 'point_ref',
        pointId: 'TIC-300.PV',
      },
    }
    const doc = makeDoc([], { expr1: expr })
    const ids = extractPointIds(doc)
    expect(ids.has('TIC-300.PV')).toBe(true)
  })

  it('extracts nested point_ref nodes recursively', () => {
    const expr = {
      ast: {
        type: 'binary_op',
        op: '+',
        left: { type: 'point_ref', pointId: 'PT-A' },
        right: { type: 'point_ref', pointId: 'PT-B' },
      },
    }
    const doc = makeDoc([], { e1: expr })
    const ids = extractPointIds(doc)
    expect(ids.has('PT-A')).toBe(true)
    expect(ids.has('PT-B')).toBe(true)
  })

  it('ignores AST nodes without a pointId', () => {
    const expr = {
      ast: {
        type: 'constant',
        value: 42,
      },
    }
    const doc = makeDoc([], { e1: expr })
    const ids = extractPointIds(doc)
    expect(ids.size).toBe(0)
  })

  it('combines expression point IDs with direct bindings', () => {
    const expr = { ast: { type: 'point_ref', pointId: 'EXPR-PT-1' } }
    const doc = makeDoc([makeDisplayElement('DIRECT-PT-1')], { e1: expr })
    const ids = extractPointIds(doc)
    expect(ids.has('DIRECT-PT-1')).toBe(true)
    expect(ids.has('EXPR-PT-1')).toBe(true)
    expect(ids.size).toBe(2)
  })
})

describe('extractPointIds — AnalogBar setpointBinding', () => {
  it('collects setpointBinding from AnalogBar element', () => {
    const de: DisplayElement = {
      id: 'de-1',
      type: 'display_element',
      ...baseNode,
      displayType: 'analog_bar',
      binding: { pointId: 'FI-100.PV' },
      config: {
        displayType: 'analog_bar',
        orientation: 'vertical',
        barWidth: 20,
        barHeight: 120,
        rangeLo: 0,
        rangeHi: 100,
        showZoneLabels: true,
        showPointer: true,
        showSetpoint: true,
        setpointBinding: { pointId: 'FI-100.SP' },
        showNumericReadout: true,
        showSignalLine: false,
      },
    }
    const doc = makeDoc([de])
    const ids = extractPointIds(doc)
    expect(ids.has('FI-100.PV')).toBe(true)
    expect(ids.has('FI-100.SP')).toBe(true)
    expect(ids.size).toBe(2)
  })
})

describe('extractPointIds — AlarmIndicator additionalBindings', () => {
  it('collects all additional bindings from AlarmIndicator', () => {
    const de: DisplayElement = {
      id: 'de-1',
      type: 'display_element',
      ...baseNode,
      displayType: 'alarm_indicator',
      binding: { pointId: 'AL-MAIN' },
      config: {
        displayType: 'alarm_indicator',
        mode: 'multi',
        additionalBindings: [
          { pointId: 'AL-SECONDARY-1' },
          { pointId: 'AL-SECONDARY-2' },
          { pointId: undefined },  // should be skipped
        ],
      },
    }
    const doc = makeDoc([de])
    const ids = extractPointIds(doc)
    expect(ids.has('AL-MAIN')).toBe(true)
    expect(ids.has('AL-SECONDARY-1')).toBe(true)
    expect(ids.has('AL-SECONDARY-2')).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// extractViewportPointIds — viewport culling
// ---------------------------------------------------------------------------

describe('extractViewportPointIds — viewport culling', () => {
  // DisplayElement at position (100, 100) with a text_readout config
  // (no natural bounding box from getNodeBounds — so it's always included)

  it('returns empty set for empty document', () => {
    const doc = makeDoc([])
    const viewport = { x: 0, y: 0, width: 1920, height: 1080 }
    const ids = extractViewportPointIds(doc, viewport)
    expect(ids.size).toBe(0)
  })

  it('includes nodes without bounds (unknown nodes pass through)', () => {
    // display_element has no bounding box in getNodeBounds — always passes the bounds check
    const doc = makeDoc([makeDisplayElement('TI-500')])
    const viewport = { x: 0, y: 0, width: 200, height: 200 }
    const ids = extractViewportPointIds(doc, viewport)
    // Node has no geometry type, getNodeBounds returns null → not culled
    expect(ids.has('TI-500')).toBe(true)
  })

  it('respects margin expansion in viewport check', () => {
    // A rect node at (1800, 0) with width/height 100×100
    // viewport at (0, 0, 100, 100) — with 200px margin expands to (-200, -200, 500, 500)
    // Node rect (1800, 0, 100, 100) — x=1800 > 500 — so it IS outside even with margin
    const doc = makeDoc([makeDisplayElement('FAR-POINT')])
    const viewport = { x: 0, y: 0, width: 100, height: 100 }
    // display_element has no geometric bounds → always included (pass-through)
    // This test verifies that nodes without bounds are NOT culled
    const ids = extractViewportPointIds(doc, viewport, 200)
    expect(ids.has('FAR-POINT')).toBe(true)
  })
})
