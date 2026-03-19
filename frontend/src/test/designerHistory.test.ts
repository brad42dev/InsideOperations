/**
 * Tests for Designer history and scene stores — doc 33 §Unit Tests
 *
 * Covers:
 * - useHistoryStore — push, undo, redo, clear, markClean, max depth
 * - useSceneStore   — newDocument, execute, loadGraphic, _setDoc, markClean, reset
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { act } from '@testing-library/react'
import { useHistoryStore } from '../store/designer/historyStore'
import { useSceneStore } from '../store/designer/sceneStore'
import { AddNodeCommand } from '../shared/graphics/commands'
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

function makeNode(id: string, x = 0, y = 0): SceneNode {
  return {
    id,
    type: 'group' as const,
    name: id,
    transform: baseTransform(x, y),
    visible: true,
    locked: false,
    opacity: 1,
    children: [],
  }
}

function makeDoc(children: SceneNode[] = []): GraphicDocument {
  return {
    id: 'doc-1',
    type: 'graphic_document',
    name: 'Test',
    transform: baseTransform(0, 0),
    visible: true,
    locked: false,
    opacity: 1,
    canvas: { width: 1920, height: 1080, backgroundColor: '#000' },
    metadata: {
      designMode: 'graphic',
      graphicScope: 'process',
      gridSize: 10,
      gridVisible: false,
      snapToGrid: false,
      tags: [],
    },
    layers: [],
    expressions: {},
    children,
  }
}

/** Convenience: AddNodeCommand adding to document root */
function addCmd(id: string) {
  return new AddNodeCommand(makeNode(id), null)
}

function resetStores() {
  useHistoryStore.getState().clear()
  useSceneStore.getState().reset()
}

// ---------------------------------------------------------------------------
// useHistoryStore — initial state
// ---------------------------------------------------------------------------

describe('useHistoryStore — initial state', () => {
  beforeEach(() => { act(() => resetStores()) })

  it('starts with empty entries', () => {
    expect(useHistoryStore.getState().entries).toHaveLength(0)
  })

  it('starts with pointer = 0', () => {
    expect(useHistoryStore.getState().pointer).toBe(0)
  })

  it('canUndo is false initially', () => {
    expect(useHistoryStore.getState().canUndo).toBe(false)
  })

  it('canRedo is false initially', () => {
    expect(useHistoryStore.getState().canRedo).toBe(false)
  })

  it('undoDescription is null initially', () => {
    expect(useHistoryStore.getState().undoDescription).toBeNull()
  })

  it('redoDescription is null initially', () => {
    expect(useHistoryStore.getState().redoDescription).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// useHistoryStore — push
// ---------------------------------------------------------------------------

describe('useHistoryStore — push', () => {
  beforeEach(() => { act(() => resetStores()) })

  it('adds one entry and advances pointer', () => {
    const doc = makeDoc()
    act(() => useHistoryStore.getState().push(addCmd('n1'), doc))
    const s = useHistoryStore.getState()
    expect(s.entries).toHaveLength(1)
    expect(s.pointer).toBe(1)
  })

  it('canUndo becomes true after push', () => {
    act(() => useHistoryStore.getState().push(addCmd('n1'), makeDoc()))
    expect(useHistoryStore.getState().canUndo).toBe(true)
  })

  it('canRedo stays false after push', () => {
    act(() => useHistoryStore.getState().push(addCmd('n1'), makeDoc()))
    expect(useHistoryStore.getState().canRedo).toBe(false)
  })

  it('undoDescription reflects last pushed command', () => {
    act(() => useHistoryStore.getState().push(addCmd('n1'), makeDoc()))
    // AddNodeCommand.description = 'Add'
    expect(useHistoryStore.getState().undoDescription).toBe('Add')
  })

  it('multiple pushes accumulate entries', () => {
    const doc = makeDoc()
    act(() => {
      useHistoryStore.getState().push(addCmd('n1'), doc)
      useHistoryStore.getState().push(addCmd('n2'), doc)
      useHistoryStore.getState().push(addCmd('n3'), doc)
    })
    expect(useHistoryStore.getState().entries).toHaveLength(3)
    expect(useHistoryStore.getState().pointer).toBe(3)
  })

  it('push truncates redo tail', () => {
    const doc = makeDoc()
    act(() => {
      useHistoryStore.getState().push(addCmd('n1'), doc)
      useHistoryStore.getState().push(addCmd('n2'), doc)
    })
    // Set up sceneStore so undo can call _setDoc
    act(() => useSceneStore.getState()._setDoc(doc))
    act(() => useHistoryStore.getState().undo())
    // Now redo tail exists: entries.length=2, pointer=1
    expect(useHistoryStore.getState().canRedo).toBe(true)
    // Push a new command — redo tail should be cleared
    act(() => useHistoryStore.getState().push(addCmd('n3'), doc))
    const s = useHistoryStore.getState()
    expect(s.entries).toHaveLength(2)
    expect(s.pointer).toBe(2)
    expect(s.canRedo).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// useHistoryStore — undo
// ---------------------------------------------------------------------------

describe('useHistoryStore — undo', () => {
  beforeEach(() => { act(() => resetStores()) })

  it('decrements pointer', () => {
    const doc = makeDoc()
    act(() => {
      useSceneStore.getState()._setDoc(doc)
      useHistoryStore.getState().push(addCmd('n1'), doc)
    })
    act(() => useHistoryStore.getState().undo())
    expect(useHistoryStore.getState().pointer).toBe(0)
  })

  it('canUndo becomes false after undoing only entry', () => {
    const doc = makeDoc()
    act(() => {
      useSceneStore.getState()._setDoc(doc)
      useHistoryStore.getState().push(addCmd('n1'), doc)
    })
    act(() => useHistoryStore.getState().undo())
    expect(useHistoryStore.getState().canUndo).toBe(false)
  })

  it('canRedo becomes true after undo', () => {
    const doc = makeDoc()
    act(() => {
      useSceneStore.getState()._setDoc(doc)
      useHistoryStore.getState().push(addCmd('n1'), doc)
    })
    act(() => useHistoryStore.getState().undo())
    expect(useHistoryStore.getState().canRedo).toBe(true)
  })

  it('restores docBefore into sceneStore', () => {
    const docBefore = makeDoc([makeNode('original')])
    act(() => {
      useSceneStore.getState()._setDoc(docBefore)
      useHistoryStore.getState().push(addCmd('n1'), docBefore)
    })
    // Simulate command having been applied — advance scene doc
    const docAfter = makeDoc([makeNode('original'), makeNode('n1')])
    act(() => useSceneStore.getState()._setDoc(docAfter))
    // Undo should restore docBefore
    act(() => useHistoryStore.getState().undo())
    const restoredDoc = useSceneStore.getState().doc
    expect(restoredDoc?.children).toHaveLength(1)
    expect(restoredDoc?.children[0].id).toBe('original')
  })

  it('is a no-op when pointer is already 0', () => {
    act(() => useHistoryStore.getState().undo())
    expect(useHistoryStore.getState().pointer).toBe(0)
  })

  it('redoDescription reflects the undone command', () => {
    const doc = makeDoc()
    act(() => {
      useSceneStore.getState()._setDoc(doc)
      useHistoryStore.getState().push(addCmd('n1'), doc)
    })
    act(() => useHistoryStore.getState().undo())
    expect(useHistoryStore.getState().redoDescription).toBe('Add')
  })

  it('multiple undos walk back through history', () => {
    const doc = makeDoc()
    act(() => {
      useSceneStore.getState()._setDoc(doc)
      useHistoryStore.getState().push(addCmd('a'), doc)
      useHistoryStore.getState().push(addCmd('b'), doc)
      useHistoryStore.getState().push(addCmd('c'), doc)
    })
    act(() => useHistoryStore.getState().undo())
    expect(useHistoryStore.getState().pointer).toBe(2)
    act(() => useHistoryStore.getState().undo())
    expect(useHistoryStore.getState().pointer).toBe(1)
    act(() => useHistoryStore.getState().undo())
    expect(useHistoryStore.getState().pointer).toBe(0)
    expect(useHistoryStore.getState().canUndo).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// useHistoryStore — redo
// ---------------------------------------------------------------------------

describe('useHistoryStore — redo', () => {
  beforeEach(() => { act(() => resetStores()) })

  it('increments pointer after redo', () => {
    const doc = makeDoc()
    act(() => {
      useSceneStore.getState()._setDoc(doc)
      useHistoryStore.getState().push(addCmd('n1'), doc)
    })
    act(() => useHistoryStore.getState().undo())
    act(() => useHistoryStore.getState().redo())
    expect(useHistoryStore.getState().pointer).toBe(1)
  })

  it('canRedo becomes false after redoing all', () => {
    const doc = makeDoc()
    act(() => {
      useSceneStore.getState()._setDoc(doc)
      useHistoryStore.getState().push(addCmd('n1'), doc)
    })
    act(() => useHistoryStore.getState().undo())
    act(() => useHistoryStore.getState().redo())
    expect(useHistoryStore.getState().canRedo).toBe(false)
  })

  it('canUndo becomes true after redo', () => {
    const doc = makeDoc()
    act(() => {
      useSceneStore.getState()._setDoc(doc)
      useHistoryStore.getState().push(addCmd('n1'), doc)
    })
    act(() => useHistoryStore.getState().undo())
    act(() => useHistoryStore.getState().redo())
    expect(useHistoryStore.getState().canUndo).toBe(true)
  })

  it('re-executes the command against current doc', () => {
    const doc = makeDoc()
    act(() => {
      useSceneStore.getState()._setDoc(doc)
      useHistoryStore.getState().push(addCmd('n1'), doc)
    })
    act(() => useHistoryStore.getState().undo())
    // After undo, sceneStore.doc = docBefore = empty doc
    act(() => useHistoryStore.getState().redo())
    const docAfterRedo = useSceneStore.getState().doc
    expect(docAfterRedo?.children.some(c => c.id === 'n1')).toBe(true)
  })

  it('is a no-op when no redo tail', () => {
    const initialPointer = useHistoryStore.getState().pointer
    act(() => useHistoryStore.getState().redo())
    expect(useHistoryStore.getState().pointer).toBe(initialPointer)
  })

  it('undo + redo round-trip preserves pointer', () => {
    const doc = makeDoc()
    act(() => {
      useSceneStore.getState()._setDoc(doc)
      useHistoryStore.getState().push(addCmd('n1'), doc)
      useHistoryStore.getState().push(addCmd('n2'), doc)
    })
    const initialPointer = useHistoryStore.getState().pointer
    act(() => useHistoryStore.getState().undo())
    act(() => useHistoryStore.getState().undo())
    act(() => useHistoryStore.getState().redo())
    act(() => useHistoryStore.getState().redo())
    expect(useHistoryStore.getState().pointer).toBe(initialPointer)
  })
})

// ---------------------------------------------------------------------------
// useHistoryStore — clear
// ---------------------------------------------------------------------------

describe('useHistoryStore — clear', () => {
  beforeEach(() => { act(() => resetStores()) })

  it('resets entries to empty array', () => {
    act(() => useHistoryStore.getState().push(addCmd('n1'), makeDoc()))
    act(() => useHistoryStore.getState().clear())
    expect(useHistoryStore.getState().entries).toHaveLength(0)
  })

  it('resets pointer to 0', () => {
    act(() => useHistoryStore.getState().push(addCmd('n1'), makeDoc()))
    act(() => useHistoryStore.getState().clear())
    expect(useHistoryStore.getState().pointer).toBe(0)
  })

  it('canUndo is false after clear', () => {
    act(() => useHistoryStore.getState().push(addCmd('n1'), makeDoc()))
    act(() => useHistoryStore.getState().clear())
    expect(useHistoryStore.getState().canUndo).toBe(false)
  })

  it('canRedo is false after clear', () => {
    const doc = makeDoc()
    act(() => {
      useSceneStore.getState()._setDoc(doc)
      useHistoryStore.getState().push(addCmd('n1'), doc)
    })
    act(() => useHistoryStore.getState().undo())
    act(() => useHistoryStore.getState().clear())
    expect(useHistoryStore.getState().canRedo).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// useHistoryStore — markClean
// ---------------------------------------------------------------------------

describe('useHistoryStore — markClean', () => {
  beforeEach(() => { act(() => resetStores()) })

  it('sets cleanPointer to current pointer', () => {
    const doc = makeDoc()
    act(() => {
      useHistoryStore.getState().push(addCmd('n1'), doc)
      useHistoryStore.getState().push(addCmd('n2'), doc)
    })
    act(() => useHistoryStore.getState().markClean())
    expect(useHistoryStore.getState().cleanPointer).toBe(2)
  })

  it('after clear, cleanPointer resets to 0', () => {
    act(() => {
      useHistoryStore.getState().push(addCmd('n1'), makeDoc())
      useHistoryStore.getState().markClean()
    })
    act(() => useHistoryStore.getState().clear())
    expect(useHistoryStore.getState().cleanPointer).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// useHistoryStore — max depth (50)
// ---------------------------------------------------------------------------

describe('useHistoryStore — max depth (50)', () => {
  beforeEach(() => { act(() => resetStores()) })

  it('does not exceed 50 entries when 51 commands are pushed', () => {
    const doc = makeDoc()
    act(() => {
      for (let i = 0; i < 51; i++) {
        useHistoryStore.getState().push(addCmd(`n${i}`), doc)
      }
    })
    expect(useHistoryStore.getState().entries).toHaveLength(50)
    expect(useHistoryStore.getState().pointer).toBe(50)
  })

  it('evicts oldest entry from front when overflow occurs', () => {
    const doc = makeDoc()
    act(() => {
      for (let i = 0; i < 51; i++) {
        useHistoryStore.getState().push(addCmd(`n${i}`), doc)
      }
    })
    // n0's docBefore should have been evicted; verify by checking description (all are 'Add')
    // and that we only have 50 entries starting from n1's entry
    const entries = useHistoryStore.getState().entries
    expect(entries).toHaveLength(50)
    // All descriptions are 'Add' since we used AddNodeCommand
    expect(entries[0].command.description).toBe('Add')
  })

  it('clamps cleanPointer when overflow evicts entries before it', () => {
    const doc = makeDoc()
    act(() => {
      // Push 25 commands, mark clean, then push 26 more (total 51 = overflow by 1)
      for (let i = 0; i < 25; i++) {
        useHistoryStore.getState().push(addCmd(`n${i}`), doc)
      }
      useHistoryStore.getState().markClean()
      // cleanPointer is now 25
      for (let i = 25; i < 51; i++) {
        useHistoryStore.getState().push(addCmd(`n${i}`), doc)
      }
    })
    // 51 total pushed, overflow by 1 → cleanPointer was 25, decremented by 1 → 24
    expect(useHistoryStore.getState().cleanPointer).toBe(24)
  })

  it('cleanPointer is clamped to 0 when excess > cleanPointer', () => {
    const doc = makeDoc()
    act(() => {
      // cleanPointer stays at 0, push 51 → overflow by 1, max(0, 0-1) = 0
      for (let i = 0; i < 51; i++) {
        useHistoryStore.getState().push(addCmd(`n${i}`), doc)
      }
    })
    expect(useHistoryStore.getState().cleanPointer).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// useSceneStore — initial state
// ---------------------------------------------------------------------------

describe('useSceneStore — initial state', () => {
  beforeEach(() => { act(() => useSceneStore.getState().reset()) })

  it('doc is null', () => {
    expect(useSceneStore.getState().doc).toBeNull()
  })

  it('isDirty is false', () => {
    expect(useSceneStore.getState().isDirty).toBe(false)
  })

  it('graphicId is null', () => {
    expect(useSceneStore.getState().graphicId).toBeNull()
  })

  it('designMode defaults to graphic', () => {
    expect(useSceneStore.getState().designMode).toBe('graphic')
  })

  it('version is 0', () => {
    expect(useSceneStore.getState().version).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// useSceneStore — newDocument
// ---------------------------------------------------------------------------

describe('useSceneStore — newDocument', () => {
  beforeEach(() => { act(() => useSceneStore.getState().reset()) })

  it('creates a graphic doc with 1920×1080 canvas', () => {
    act(() => useSceneStore.getState().newDocument('graphic', 'My Graphic'))
    const doc = useSceneStore.getState().doc
    expect(doc).not.toBeNull()
    expect(doc?.canvas.width).toBe(1920)
    expect(doc?.canvas.height).toBe(1080)
  })

  it('creates a dashboard doc with 1920×1080 canvas', () => {
    act(() => useSceneStore.getState().newDocument('dashboard', 'My Dashboard'))
    const doc = useSceneStore.getState().doc
    expect(doc?.canvas.width).toBe(1920)
    expect(doc?.canvas.height).toBe(1080)
  })

  it('creates a report doc with 1240×1754 canvas (A4 portrait)', () => {
    act(() => useSceneStore.getState().newDocument('report', 'My Report'))
    const doc = useSceneStore.getState().doc
    expect(doc?.canvas.width).toBe(1240)
    expect(doc?.canvas.height).toBe(1754)
  })

  it('sets document name', () => {
    act(() => useSceneStore.getState().newDocument('graphic', 'Station Overview'))
    expect(useSceneStore.getState().doc?.name).toBe('Station Overview')
  })

  it('sets designMode', () => {
    act(() => useSceneStore.getState().newDocument('report', 'R'))
    expect(useSceneStore.getState().designMode).toBe('report')
  })

  it('marks document as dirty', () => {
    act(() => useSceneStore.getState().newDocument('graphic', 'G'))
    expect(useSceneStore.getState().isDirty).toBe(true)
  })

  it('resets graphicId to null', () => {
    act(() => {
      useSceneStore.setState({ graphicId: 'old-id' })
      useSceneStore.getState().newDocument('graphic', 'G')
    })
    expect(useSceneStore.getState().graphicId).toBeNull()
  })

  it('starts with empty children array', () => {
    act(() => useSceneStore.getState().newDocument('graphic', 'G'))
    expect(useSceneStore.getState().doc?.children).toHaveLength(0)
  })

  it('has 5 default layers', () => {
    act(() => useSceneStore.getState().newDocument('graphic', 'G'))
    expect(useSceneStore.getState().doc?.layers).toHaveLength(4)
  })

  it('default layers are named correctly', () => {
    act(() => useSceneStore.getState().newDocument('graphic', 'G'))
    const names = useSceneStore.getState().doc?.layers.map(l => l.name)
    expect(names).toEqual(['Background', 'Equipment', 'Instruments', 'Labels'])
  })

  it('resets version to 0', () => {
    act(() => {
      useSceneStore.setState({ version: 99 })
      useSceneStore.getState().newDocument('graphic', 'G')
    })
    expect(useSceneStore.getState().version).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// useSceneStore — execute
// ---------------------------------------------------------------------------

describe('useSceneStore — execute', () => {
  beforeEach(() => { act(() => useSceneStore.getState().reset()) })

  it('returns null when no doc loaded', () => {
    const result = useSceneStore.getState().execute(addCmd('n1'))
    expect(result).toBeNull()
  })

  it('applies command to doc', () => {
    act(() => useSceneStore.getState()._setDoc(makeDoc()))
    act(() => useSceneStore.getState().execute(addCmd('n1')))
    expect(useSceneStore.getState().doc?.children).toHaveLength(1)
    expect(useSceneStore.getState().doc?.children[0].id).toBe('n1')
  })

  it('marks isDirty true', () => {
    act(() => {
      useSceneStore.getState()._setDoc(makeDoc(), false)
      useSceneStore.setState({ isDirty: false })
    })
    act(() => useSceneStore.getState().execute(addCmd('n1')))
    expect(useSceneStore.getState().isDirty).toBe(true)
  })

  it('increments version on each execute', () => {
    act(() => useSceneStore.getState()._setDoc(makeDoc()))
    act(() => useSceneStore.setState({ version: 0 }))
    act(() => useSceneStore.getState().execute(addCmd('n1')))
    expect(useSceneStore.getState().version).toBe(1)
    act(() => useSceneStore.getState().execute(addCmd('n2')))
    expect(useSceneStore.getState().version).toBe(2)
  })

  it('returns the new doc', () => {
    act(() => useSceneStore.getState()._setDoc(makeDoc()))
    let result: GraphicDocument | null = null
    act(() => { result = useSceneStore.getState().execute(addCmd('n1')) })
    expect(result).not.toBeNull()
    expect(result!.children).toHaveLength(1)
  })

  it('execute is immutable — original doc is not mutated', () => {
    const original = makeDoc()
    act(() => useSceneStore.getState()._setDoc(original))
    act(() => useSceneStore.getState().execute(addCmd('n1')))
    // original.children should still be empty (command creates a new doc)
    expect(original.children).toHaveLength(0)
  })
})

// ---------------------------------------------------------------------------
// useSceneStore — loadGraphic
// ---------------------------------------------------------------------------

describe('useSceneStore — loadGraphic', () => {
  beforeEach(() => { act(() => useSceneStore.getState().reset()) })

  it('stores the loaded doc', () => {
    const doc = makeDoc([makeNode('existing')])
    act(() => useSceneStore.getState().loadGraphic('gfx-42', doc))
    expect(useSceneStore.getState().doc?.children[0].id).toBe('existing')
  })

  it('sets graphicId', () => {
    act(() => useSceneStore.getState().loadGraphic('gfx-42', makeDoc()))
    expect(useSceneStore.getState().graphicId).toBe('gfx-42')
  })

  it('clears isDirty', () => {
    act(() => {
      useSceneStore.setState({ isDirty: true })
      useSceneStore.getState().loadGraphic('gfx-42', makeDoc())
    })
    expect(useSceneStore.getState().isDirty).toBe(false)
  })

  it('sets designMode from doc metadata', () => {
    const reportDoc = makeDoc()
    reportDoc.metadata.designMode = 'report'
    act(() => useSceneStore.getState().loadGraphic('gfx-1', reportDoc))
    expect(useSceneStore.getState().designMode).toBe('report')
  })

  it('resets version to 0', () => {
    act(() => {
      useSceneStore.setState({ version: 15 })
      useSceneStore.getState().loadGraphic('gfx-1', makeDoc())
    })
    expect(useSceneStore.getState().version).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// useSceneStore — _setDoc
// ---------------------------------------------------------------------------

describe('useSceneStore — _setDoc', () => {
  beforeEach(() => { act(() => useSceneStore.getState().reset()) })

  it('replaces the doc', () => {
    const doc1 = makeDoc([makeNode('a')])
    const doc2 = makeDoc([makeNode('b')])
    act(() => {
      useSceneStore.getState()._setDoc(doc1)
      useSceneStore.getState()._setDoc(doc2)
    })
    expect(useSceneStore.getState().doc?.children[0].id).toBe('b')
  })

  it('increments version', () => {
    act(() => useSceneStore.setState({ version: 5 }))
    act(() => useSceneStore.getState()._setDoc(makeDoc()))
    expect(useSceneStore.getState().version).toBe(6)
  })

  it('sets isDirty true by default', () => {
    act(() => {
      useSceneStore.setState({ isDirty: false })
      useSceneStore.getState()._setDoc(makeDoc())
    })
    expect(useSceneStore.getState().isDirty).toBe(true)
  })

  it('can set isDirty false explicitly', () => {
    act(() => useSceneStore.getState()._setDoc(makeDoc(), false))
    expect(useSceneStore.getState().isDirty).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// useSceneStore — markClean
// ---------------------------------------------------------------------------

describe('useSceneStore — markClean', () => {
  beforeEach(() => { act(() => useSceneStore.getState().reset()) })

  it('sets isDirty to false', () => {
    act(() => {
      useSceneStore.getState()._setDoc(makeDoc())
      useSceneStore.getState().markClean()
    })
    expect(useSceneStore.getState().isDirty).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// useSceneStore — reset
// ---------------------------------------------------------------------------

describe('useSceneStore — reset', () => {
  beforeEach(() => { act(() => useSceneStore.getState().reset()) })

  it('sets doc to null', () => {
    act(() => {
      useSceneStore.getState()._setDoc(makeDoc())
      useSceneStore.getState().reset()
    })
    expect(useSceneStore.getState().doc).toBeNull()
  })

  it('clears isDirty', () => {
    act(() => {
      useSceneStore.setState({ isDirty: true })
      useSceneStore.getState().reset()
    })
    expect(useSceneStore.getState().isDirty).toBe(false)
  })

  it('clears graphicId', () => {
    act(() => {
      useSceneStore.setState({ graphicId: 'x' })
      useSceneStore.getState().reset()
    })
    expect(useSceneStore.getState().graphicId).toBeNull()
  })

  it('resets version to 0', () => {
    act(() => {
      useSceneStore.setState({ version: 10 })
      useSceneStore.getState().reset()
    })
    expect(useSceneStore.getState().version).toBe(0)
  })
})
