/**
 * historyStore.ts
 *
 * Undo/redo history for the Designer scene graph.
 *
 * Works in tandem with sceneStore:
 *  - sceneStore.execute() calls historyStore.push()
 *  - historyStore.undo() / .redo() call sceneStore._setDoc()
 *
 * Stack model:
 *  entries[0..pointer-1]  — commands that have been executed
 *  entries[pointer..]     — commands that have been undone (redo tail)
 *
 * `pointer` is the index of the NEXT insertion point.
 *  - entries[pointer - 1] is the last executed command
 *  - canUndo = pointer > 0
 *  - canRedo = pointer < entries.length
 *
 * Maximum stack depth is 50. When the stack is full and a new command is
 * pushed, the oldest entry (entries[0]) is dropped and the cleanPointer is
 * decremented accordingly (clamped to 0).
 */

import { create } from 'zustand'
import type { GraphicDocument } from '../../shared/types/graphics'
import type { SceneCommand } from '../../shared/graphics/commands'
import { useSceneStore } from './sceneStore'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HistoryEntry {
  /** The command that was executed. */
  command: SceneCommand
  /** Snapshot of the document *before* this command was applied. */
  docBefore: GraphicDocument
}

export interface HistoryStore {
  /** The linear history stack. */
  entries: HistoryEntry[]
  /** Index of the next insertion point. entries[pointer-1] is the last executed command. */
  pointer: number
  /** Value of pointer at the time of the last save. Used to drive isDirty in sync. */
  cleanPointer: number

  // Derived booleans (kept in state for cheap subscriptions)
  canUndo: boolean
  canRedo: boolean
  /** Description of the command that will be undone, or null. */
  undoDescription: string | null
  /** Description of the command that will be redone, or null. */
  redoDescription: string | null

  /**
   * Push a new command + pre-command snapshot onto the stack.
   * Truncates any redo tail before appending.
   * Enforces a 50-entry maximum.
   */
  push(cmd: SceneCommand, docBefore: GraphicDocument): void

  /**
   * Undo the last executed command.
   * Restores the docBefore of entries[pointer-1] via sceneStore._setDoc().
   */
  undo(): void

  /**
   * Redo the next undone command.
   * Re-executes entries[pointer].command against the current doc.
   */
  redo(): void

  /**
   * Clear all history (called on loadGraphic / newDocument / reset).
   */
  clear(): void

  /**
   * Record the current pointer as the clean point (called from sceneStore.markClean).
   */
  markClean(): void
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_HISTORY = 50

// ---------------------------------------------------------------------------
// Derived state helpers
// ---------------------------------------------------------------------------

function derivedState(entries: HistoryEntry[], pointer: number) {
  const canUndo = pointer > 0
  const canRedo = pointer < entries.length
  const undoDescription = canUndo ? entries[pointer - 1].command.description : null
  const redoDescription = canRedo ? entries[pointer].command.description : null
  return { canUndo, canRedo, undoDescription, redoDescription }
}

// ---------------------------------------------------------------------------
// Zustand store
// ---------------------------------------------------------------------------

export const useHistoryStore = create<HistoryStore>((set, get) => ({
  entries: [],
  pointer: 0,
  cleanPointer: 0,
  canUndo: false,
  canRedo: false,
  undoDescription: null,
  redoDescription: null,

  push(cmd, docBefore) {
    set((state) => {
      // Truncate redo tail
      let entries = state.entries.slice(0, state.pointer)
      let cleanPointer = state.cleanPointer

      // Append new entry
      entries = [...entries, { command: cmd, docBefore }]

      // Enforce max stack depth by evicting from the front
      if (entries.length > MAX_HISTORY) {
        const excess = entries.length - MAX_HISTORY
        entries = entries.slice(excess)
        cleanPointer = Math.max(0, cleanPointer - excess)
      }

      const pointer = entries.length

      return {
        entries,
        pointer,
        cleanPointer,
        ...derivedState(entries, pointer),
      }
    })
  },

  undo() {
    const { entries, pointer, cleanPointer } = get()
    if (pointer <= 0) return

    const newPointer = pointer - 1
    const entry = entries[newPointer]

    // Restore the document to its pre-command state.
    // If undoing back to the exact clean point, mark the document as clean.
    useSceneStore.getState()._setDoc(entry.docBefore, newPointer !== cleanPointer)

    set((state) => ({
      pointer: newPointer,
      ...derivedState(state.entries, newPointer),
    }))
  },

  redo() {
    const { entries, pointer } = get()
    if (pointer >= entries.length) return

    const currentDoc = useSceneStore.getState().doc
    if (!currentDoc) return

    const entry = entries[pointer]
    const newPointer = pointer + 1

    const newDoc = entry.command.execute(currentDoc)
    useSceneStore.getState()._setDoc(newDoc)

    set((state) => ({
      pointer: newPointer,
      ...derivedState(state.entries, newPointer),
    }))
  },

  clear() {
    set({
      entries: [],
      pointer: 0,
      cleanPointer: 0,
      canUndo: false,
      canRedo: false,
      undoDescription: null,
      redoDescription: null,
    })
  },

  markClean() {
    set((state) => ({ cleanPointer: state.pointer }))
  },
}))
