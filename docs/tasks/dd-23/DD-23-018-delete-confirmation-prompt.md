---
id: DD-23-018
title: Add confirmation dialog before Delete-key tile deletion
unit: DD-23
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

When the user presses Delete (or Backspace) on selected workspace tiles, a confirmation dialog must appear before the tiles are removed. The dialog text is "Delete [N] tile(s)? This cannot be undone." with "Delete" and "Cancel" buttons. Cancelling leaves the tiles intact.

## Spec Excerpt (verbatim)

> **Delete**: Delete key: Deletes all selected tiles (with confirmation prompt)
> All delete operations prompt: "Delete [N] tile(s)? This cannot be undone." with "Delete" and "Cancel" buttons.
> — design-docs/23_EXPRESSION_BUILDER.md, §6.7

## Where to Look in the Codebase

Primary files:
- `frontend/src/shared/components/expression/ExpressionBuilder.tsx:755–762` — `handleKeyDown` in `WorkspaceTile` fires DELETE_TILE directly with no confirmation
- `frontend/src/shared/components/expression/ExpressionBuilder.tsx:1730–1734` — existing `showCancelConfirm` and `showCutConfirm` state show the pattern to follow for Radix Dialog confirmations
- `frontend/src/shared/components/expression/ExpressionBuilder.tsx:2753–2870` — existing cancel and cut confirmation dialogs show the pattern

## Verification Checklist

- [ ] Pressing Delete/Backspace on selected tile(s) opens a confirmation dialog before any tile is removed
- [ ] Dialog title or text includes the count of tiles being deleted, e.g. "Delete 2 tile(s)?"
- [ ] Dialog has a "Delete" confirm button and a "Cancel" button
- [ ] Clicking Cancel closes the dialog and leaves all tiles untouched
- [ ] Clicking Delete removes the selected tiles (same result as before, just gated)
- [ ] The dispatch to DELETE_TILE is NOT called before the user confirms

## Assessment

- **Status**: ⚠️ Partial
- **What needs to change**: `handleKeyDown` at line 755 dispatches DELETE_TILE immediately. It must instead set a `showDeleteConfirm` state variable (with the IDs to delete stored in a ref/state), and a Radix Dialog must confirm before dispatching.

## Fix Instructions

**Step 1** — Add state in the `ExpressionBuilder` component (near the other confirm dialog states around line 1730):

```tsx
const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
const pendingDeleteIdsRef = useRef<string[]>([])
```

**Step 2** — In `WorkspaceTile.handleKeyDown` (line 755), the handler currently dispatches directly. The `dispatch` and selected IDs need to be lifted so the parent `ExpressionBuilder` can control the dialog. The simplest approach: pass a `onRequestDelete(ids: string[]) => void` prop from `ExpressionBuilder` down to `WorkspaceTile`, replacing the direct dispatch.

In `ExpressionBuilder`:
```tsx
function handleRequestDelete(ids: string[]) {
  pendingDeleteIdsRef.current = ids
  setShowDeleteConfirm(true)
}
```

Pass `onRequestDelete={handleRequestDelete}` to `WorkspaceTile` (via `DropZoneRow`).

In `WorkspaceTile.handleKeyDown`:
```tsx
if (e.key === 'Delete' || e.key === 'Backspace') {
  e.preventDefault()
  const idsToDelete = allSelectedIds.includes(tile.id) ? allSelectedIds : [tile.id]
  onRequestDelete(idsToDelete)
}
```

**Step 3** — Add the confirmation dialog (after the existing cut confirmation dialog around line 2873):

```tsx
{/* ---- Delete confirmation dialog ---- */}
<Dialog.Root open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
  <Dialog.Portal>
    <Dialog.Overlay ... />
    <Dialog.Content ...>
      <Dialog.Title>Delete tiles?</Dialog.Title>
      <Dialog.Description>
        Delete {pendingDeleteIdsRef.current.length} tile(s)? This cannot be undone.
      </Dialog.Description>
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
        <button onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
        <button onClick={() => {
          for (const id of pendingDeleteIdsRef.current) {
            dispatch({ type: 'DELETE_TILE', id })
          }
          setShowDeleteConfirm(false)
        }}>
          Delete
        </button>
      </div>
    </Dialog.Content>
  </Dialog.Portal>
</Dialog.Root>
```

Do NOT:
- Remove delete functionality — only gate it behind a dialog
- Change the right-click context menu delete path (that's DD-23-019)
- Affect the Cut flow (which already has its own `showCutConfirm`)
