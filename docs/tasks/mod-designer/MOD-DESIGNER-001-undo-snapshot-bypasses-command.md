---
id: MOD-DESIGNER-001
title: Fix undo to call command.undo() instead of restoring docBefore snapshot
unit: MOD-DESIGNER
status: pending
priority: high
depends-on: []
---

## What This Feature Should Do

The undo operation should call `command.undo()` on the last executed command, which applies the inverse mutation to the current document. The current implementation skips `command.undo()` entirely and instead restores a full document snapshot (`docBefore`) that was captured before the command was applied. While snapshot-based undo works visually, it is the exact false-DONE pattern flagged in the spec and prevents memory-efficient incremental undo from working correctly.

## Spec Excerpt (verbatim)

> **Command pattern for undo/redo** — every mutation is a Command object with `execute()` and `undo()`. Commands are logged in the undo stack. Direct state mutation without commands is wrong.
> — designer-implementation-spec.md, §1 Architecture / Non-Negotiables #2

> `historyStore` — `SceneCommand` undo stack (or zundo temporal on `sceneStore`). Commands implement `execute()` / `undo()`. Stack resets on file open/new.
> — docs/SPEC_MANIFEST.md, MOD-DESIGNER Non-Negotiable #7

## Where to Look in the Codebase

Primary files:
- `frontend/src/store/designer/historyStore.ts` — `undo()` method at line 144; `undo()` calls `_setDoc(entry.docBefore)` instead of `entry.command.undo()`
- `frontend/src/shared/graphics/commands.ts` — `SceneCommand` interface at line 21; all command classes implement `undo(doc)` at line 27 but these are never called
- `frontend/src/store/designer/sceneStore.ts` — `_setDoc()` at line 46; used by both restore and undo paths

## Verification Checklist

Read the code at the files listed above. Check each item:

- [ ] `historyStore.ts` undo() calls `entry.command.undo(currentDoc)` to get the reverted document, NOT `entry.docBefore`
- [ ] All command classes in `commands.ts` have correct `undo(doc: GraphicDocument): GraphicDocument` implementations (verify at least MoveNodesCommand, DeleteNodesCommand, AddNodeCommand)
- [ ] redo() continues to call `entry.command.execute(currentDoc)` (should remain unchanged)
- [ ] `docBefore` field can be removed from `HistoryEntry` (or kept only as a debug/diff aid, not the undo mechanism)

## Assessment

After checking:
- **Status**: ⚠️ Partial (undo direction uses snapshot, not command.undo())
- historyStore.ts:153 calls `_setDoc(entry.docBefore, ...)` — this is the snapshot path

## Fix Instructions

In `frontend/src/store/designer/historyStore.ts`, change `undo()`:

Current code (line 144–158):
```
undo() {
  const { entries, pointer, cleanPointer } = get()
  if (pointer <= 0) return
  const newPointer = pointer - 1
  const entry = entries[newPointer]
  useSceneStore.getState()._setDoc(entry.docBefore, newPointer !== cleanPointer)
  ...
}
```

Replace with:
```
undo() {
  const { entries, pointer, cleanPointer } = get()
  if (pointer <= 0) return
  const currentDoc = useSceneStore.getState().doc
  if (!currentDoc) return
  const newPointer = pointer - 1
  const entry = entries[newPointer]
  const revertedDoc = entry.command.undo(currentDoc)
  useSceneStore.getState()._setDoc(revertedDoc, newPointer !== cleanPointer)
  set((state) => ({
    pointer: newPointer,
    ...derivedState(state.entries, newPointer),
  }))
},
```

Then verify each command class in `commands.ts` has a correct `undo(doc)` implementation. Spot-check:
- `MoveNodesCommand.undo()` — should restore original positions from `prevTransforms`
- `DeleteNodesCommand.undo()` — should re-insert the deleted nodes at their original indices
- `AddNodeCommand.undo()` — should remove the added node from the doc

Do NOT:
- Keep restoring `entry.docBefore` as the primary undo mechanism
- Remove `docBefore` from HistoryEntry entirely without first verifying all command.undo() implementations are correct (keep it as a fallback/debug reference initially)
- Change redo() — it already correctly calls `entry.command.execute(currentDoc)`
