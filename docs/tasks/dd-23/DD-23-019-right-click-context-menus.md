---
id: DD-23-019
title: Implement right-click context menus on workspace tiles
unit: DD-23
status: pending
priority: medium
depends-on: [DD-23-018]
---

## What This Feature Should Do

Right-clicking a tile in the workspace opens a context menu. The menu items depend on the target:

- **Right-click selected tile(s)**: Copy, Cut, Delete Tile(s), divider, Select All
- **Right-click unselected tile**: Copy, Cut, Delete, divider, Select All
- **Right-click empty workspace space**: Paste (if clipboard non-empty), Select All

The Delete item must use the same confirmation dialog as the Delete key (DD-23-018). Copy, Cut, and Paste wire to the existing COPY_SELECTION, CUT_SELECTION, PASTE reducer actions.

## Spec Excerpt (verbatim)

> **Copy**: Ctrl+C or right-click > "Copy": Copies selected tile(s) to clipboard
> **Paste**: Ctrl+V or right-click empty workspace > "Paste": Pastes at cursor position
> **Delete**: Right-click selected tile(s) > "Delete Tile(s)": Deletes all selected (with confirmation)
> Right-click an unselected tile > "Delete": Deletes just that tile (with confirmation)
> **Cut**: Ctrl+X or right-click > "Cut": Copy + Delete (with confirmation for the delete portion).
> **Multi-select**: Right-click > Select All: Same as Ctrl+A
> — design-docs/23_EXPRESSION_BUILDER.md, §6.4 and §6.7

## Where to Look in the Codebase

Primary files:
- `frontend/src/shared/components/expression/ExpressionBuilder.tsx` — `WorkspaceTile` component (line ~705); no `onContextMenu` handler anywhere in the file
- `frontend/src/shared/components/expression/ExpressionBuilder.tsx:1793–1808` — keyboard handler shows Copy/Cut/Paste actions already wired to reducer; context menu should reuse the same dispatch calls
- `frontend/src/shared/components/expression/ExpressionBuilder.tsx:2873–2930` — Cut confirmation dialog pattern to follow for context-menu-triggered cut

## Verification Checklist

- [ ] Right-clicking a workspace tile opens a context menu (browser default context menu is suppressed)
- [ ] Context menu includes "Copy" item that dispatches COPY_SELECTION
- [ ] Context menu includes "Cut" item that triggers the cut confirmation flow (showCutConfirm)
- [ ] Context menu includes "Delete" (or "Delete Tile(s)") item that triggers the delete confirmation dialog (DD-23-018)
- [ ] Context menu includes "Select All" item that selects all tiles via dispatch SELECT
- [ ] Right-clicking empty workspace space shows "Paste" item (only if clipboard non-empty)
- [ ] Context menu dismisses on outside click or Escape

## Assessment

- **Status**: ❌ Missing
- **What needs to change**: Add `onContextMenu` to `WorkspaceTile` and workspace empty-space click. Use Radix UI `ContextMenu` (already available via @radix-ui/react-context-menu) for the menu itself.

## Fix Instructions

Use `@radix-ui/react-context-menu`. Import and wrap the workspace tile content:

```tsx
import * as ContextMenu from '@radix-ui/react-context-menu'
```

In `WorkspaceTile`, wrap the tile content in `<ContextMenu.Root>/<ContextMenu.Trigger>/<ContextMenu.Portal>/<ContextMenu.Content>`:

```tsx
<ContextMenu.Root>
  <ContextMenu.Trigger asChild>
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} ...>
      {/* existing tile content */}
    </div>
  </ContextMenu.Trigger>
  <ContextMenu.Portal>
    <ContextMenu.Content>
      <ContextMenu.Item onSelect={() => dispatch({ type: 'SELECT', ids: [tile.id], additive: false })}>
        Select
      </ContextMenu.Item>
      <ContextMenu.Item onSelect={() => dispatch({ type: 'COPY_SELECTION' })}>Copy</ContextMenu.Item>
      <ContextMenu.Item onSelect={() => setShowCutConfirm(true)}>Cut</ContextMenu.Item>
      <ContextMenu.Separator />
      <ContextMenu.Item onSelect={() => onRequestDelete(
        allSelectedIds.includes(tile.id) ? allSelectedIds : [tile.id]
      )}>
        Delete Tile(s)
      </ContextMenu.Item>
      <ContextMenu.Separator />
      <ContextMenu.Item onSelect={() => dispatch({ type: 'SELECT', ids: collectIds(tiles), additive: false })}>
        Select All
      </ContextMenu.Item>
    </ContextMenu.Content>
  </ContextMenu.Portal>
</ContextMenu.Root>
```

For the empty workspace area (the DropZoneRow or workspace container), add a separate context menu showing just "Paste" and "Select All". The `clipboard` state must be passed down to enable/disable Paste.

Do NOT:
- Use a custom positioned div for the menu — use Radix ContextMenu for correct accessibility and positioning
- Skip the delete confirmation — right-click Delete must also go through the DD-23-018 confirmation dialog
- Disable the browser right-click globally; use `event.preventDefault()` only within the menu trigger area
