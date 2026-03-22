---
id: MOD-CONSOLE-002
title: Preserve pane content in overflow stack when template downsizes
unit: MOD-CONSOLE
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

When the operator switches to a template with fewer pane slots than the current layout, panes that no longer fit should be moved to an "overflow stack" — not destroyed. The operator can undo the template switch (Ctrl+Z) to restore all panes. The graphics assigned to those panes are preserved in memory during the session.

## Spec Excerpt (verbatim)

> **Downsizing** (more panes → fewer panes):
> - The first N graphics in row-major order from the old layout fill all N slots of the new layout
> - Remaining graphics are **removed from view** (not deleted — the graphics still exist in the library)
> - This operation is undoable (Ctrl+Z restores the previous layout with all graphics)
> — console-implementation-spec.md, §4.6 Template Switching Rules

## Where to Look in the Codebase

Primary files:
- `frontend/src/store/workspaceStore.ts` — lines 157-166: `changeLayout` method. Currently uses `w.panes.slice(0, needed)` which drops panes beyond the new slot count entirely.
- `frontend/src/pages/console/index.tsx` — line 400-405: `handleChangeLayout` calls `changeLayout` and then persists. The undo history wraps this via zundo temporal.

## Verification Checklist

- [ ] `changeLayout` does NOT call `slice()` to truncate the panes array.
- [ ] Panes beyond the new slot count are stored in a separate `overflowPanes` field on `WorkspaceLayout` (not deleted from the layout object).
- [ ] `WorkspaceLayout` type includes `overflowPanes?: PaneConfig[]`.
- [ ] After a template downsize, Ctrl+Z restores the previous full pane set (zundo captures the state before the change).
- [ ] Switching back to a larger template causes overflow panes to refill the newly available slots in row-major order.

## Assessment

- **Status**: ⚠️ Wrong
- `workspaceStore.ts:157-166`: `changeLayout` calls `w.panes.slice(0, needed)`. Panes beyond the needed count are discarded. The WorkspaceLayout type has no `overflowPanes` field.

## Fix Instructions

In `frontend/src/pages/console/types.ts` (or wherever `WorkspaceLayout` is defined), add:
```typescript
interface WorkspaceLayout {
  // ... existing fields ...
  overflowPanes?: PaneConfig[]  // Panes hidden due to template downsize
}
```

In `frontend/src/store/workspaceStore.ts`, replace the `changeLayout` implementation (lines 157-166):
```typescript
changeLayout: (id, layout) =>
  set((s) => ({
    workspaces: s.workspaces.map((w) => {
      if (w.id !== id) return w
      const needed = layoutPaneCount(layout)
      const allPanes = [...w.panes, ...(w.overflowPanes ?? [])]
      const visible = allPanes.slice(0, needed)
      const overflow = allPanes.slice(needed)
      const extra = makeBlankPanes(Math.max(0, needed - visible.length))
      return {
        ...w,
        layout,
        panes: [...visible, ...extra],
        overflowPanes: overflow.filter(p => p.type !== 'blank'),
        gridItems: undefined,
      }
    }),
  })),
```

The zundo temporal middleware already wraps all `set()` calls in the store, so Ctrl+Z will automatically restore the previous state (including the full panes array before downsizing). No additional undo plumbing is required.

Do NOT:
- Delete the overflow panes from the WorkspaceLayout when saving to the server — persist `overflowPanes` so they survive a page refresh.
- Show overflow panes in the grid — they are hidden until the user switches to a larger template.
- Reorder overflow panes when refilling — maintain the row-major order from the original layout.
