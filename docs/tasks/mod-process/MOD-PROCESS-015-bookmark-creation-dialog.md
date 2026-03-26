---
id: MOD-PROCESS-015
title: Add Name/Description dialog when creating a viewport bookmark
unit: MOD-PROCESS
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

When the user creates a bookmark (Ctrl+Shift+B or the ★ toolbar button), a small dialog should appear prompting for a Name (required) and optional Description before saving. Currently the code silently creates a bookmark with an auto-generated name ("Viewport @ XX%") with no user input.

## Spec Excerpt (verbatim)

> **Creating a bookmark:**
> 1. Ctrl+Shift+B or click Bookmark button in toolbar
> 2. Dialog appears: Name (required), Description (optional)
> 3. Current viewport transform is captured
> 4. Bookmark saved to user_preferences (API call)
> 5. Bookmark appears in sidebar Bookmarks section
> — process-implementation-spec.md, §4.4

## Where to Look in the Codebase

Primary files:
- `frontend/src/pages/process/index.tsx:502-511` — `handleAddBookmark()` — directly calls mutation without showing a dialog
- `frontend/src/pages/process/index.tsx:487-497` — `addViewportBookmarkMutation` — the mutation to invoke after dialog confirm

## Verification Checklist

- [ ] Pressing Ctrl+Shift+B shows a dialog/modal with a Name input (required) and Description input (optional).
- [ ] Clicking the ★ toolbar button shows the same dialog.
- [ ] Submitting the dialog with an empty Name is prevented (validation on the Name field).
- [ ] Confirmed bookmarks save the user-entered name, not an auto-generated one.
- [ ] Cancelling the dialog creates no bookmark.
- [ ] The dialog closes after successful save.

## Assessment

- **Status**: ⚠️ Wrong
- `index.tsx:502-511` — `handleAddBookmark()` immediately calls `addViewportBookmarkMutation.mutate(...)` with auto-name `"Viewport @ XX%"`. No dialog or user input.

## Fix Instructions

Replace `handleAddBookmark` with a two-step flow:

1. Add local state for the dialog:
```typescript
const [bookmarkDialogOpen, setBookmarkDialogOpen] = useState(false)
const [bookmarkName, setBookmarkName] = useState('')
const [bookmarkDescription, setBookmarkDescription] = useState('')
```

2. `handleAddBookmark` opens the dialog (capturing current viewport):
```typescript
function handleAddBookmark() {
  if (viewportBookmarks.length >= MAX_BOOKMARKS) {
    alert(`Maximum ${MAX_BOOKMARKS} bookmarks. Delete some before adding.`)
    return
  }
  setBookmarkName('')
  setBookmarkDescription('')
  setBookmarkDialogOpen(true)
}
```

3. Add a confirm handler:
```typescript
function handleBookmarkConfirm() {
  if (!bookmarkName.trim()) return
  addViewportBookmarkMutation.mutate({
    label: bookmarkName.trim(),
    description: bookmarkDescription.trim() || undefined,
    panX: viewport.panX,
    panY: viewport.panY,
    zoom: viewport.zoom,
  })
  setBookmarkDialogOpen(false)
}
```

4. Update `addViewportBookmarkMutation.mutationFn` to accept the label from the user:
```typescript
mutationFn: (args: { label: string; description?: string; panX: number; panY: number; zoom: number }) => {
  const name = JSON.stringify({ label: args.label, description: args.description, panX: args.panX, panY: args.panY, zoom: args.zoom })
  return bookmarksApi.add({ entity_type: 'viewport', entity_id: selectedId ?? 'process', name })
},
```

5. Render a simple inline dialog (use Radix Dialog or a simple modal overlay):
```tsx
{bookmarkDialogOpen && (
  <dialog open style={{ /* centered modal styles */ }}>
    <h3>Save Bookmark</h3>
    <label>Name (required)<input value={bookmarkName} onChange={e => setBookmarkName(e.target.value)} autoFocus /></label>
    <label>Description<input value={bookmarkDescription} onChange={e => setBookmarkDescription(e.target.value)} /></label>
    <button onClick={handleBookmarkConfirm} disabled={!bookmarkName.trim()}>Save</button>
    <button onClick={() => setBookmarkDialogOpen(false)}>Cancel</button>
  </dialog>
)}
```

Do NOT:
- Use `window.prompt()` — that is not a dialog.
- Auto-generate names — the user must provide the name.
- Save before the user confirms.
