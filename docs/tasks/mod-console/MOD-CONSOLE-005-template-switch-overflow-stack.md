---
id: MOD-CONSOLE-005
title: Template switching must move excess panes to overflow stack instead of discarding them
unit: MOD-CONSOLE
status: pending
priority: medium
depends-on: []
---

## What This Feature Should Do

When the user switches to a layout template with fewer pane slots than the current workspace, excess panes should be placed in a hidden "overflow stack" — not deleted. Switching back to a template with more slots should restore panes from the overflow stack. The operation is fully undoable. Currently, `changeLayout` in WorkspaceStore slices the panes array, silently discarding excess panes.

## Spec Excerpt (verbatim)

> **Downsizing** (more panes → fewer panes): The first N graphics in row-major order from the old layout fill all N slots of the new layout. Remaining graphics are **removed from view** (not deleted — the graphics still exist in the library). This operation is undoable (Ctrl+Z restores the previous layout with all graphics).
> — console-implementation-spec.md, §4.6

> **Template switching** — switching a workspace template (Full/Split/Quad/etc.) does NOT discard pane content. Existing panes are remapped to new grid positions; panes that no longer fit are moved to the overflow stack, not deleted. Discarding pane content on template switch is wrong.
> — docs/SPEC_MANIFEST.md, MOD-CONSOLE non-negotiable #11

## Where to Look in the Codebase

Primary files:
- `frontend/src/store/workspaceStore.ts` — lines 157–166: `changeLayout` action (drops panes via `.slice(0, needed)`)
- `frontend/src/pages/console/types.ts` — `WorkspaceLayout` interface (needs `overflowPanes?: PaneConfig[]` field)

## Verification Checklist

- [ ] `WorkspaceLayout` type includes an `overflowPanes: PaneConfig[]` field
- [ ] `changeLayout` places panes beyond the new template's slot count into `overflowPanes` (not discards them)
- [ ] When switching to a template with more slots than current panes, `overflowPanes` panes fill the new empty slots in order
- [ ] Template switch is in the zundo undo history — Ctrl+Z restores the previous layout and overflow state
- [ ] `overflowPanes` is serialized as part of WorkspaceConfig (persisted to server)

## Assessment

- **Status**: ⚠️ Wrong behavior
- `workspaceStore.ts:157-166` — `changeLayout` does `existing = w.panes.slice(0, needed)`. Excess panes (indices `needed` and beyond) are silently dropped from state.
- No `overflowPanes` field in `WorkspaceLayout`.

## Fix Instructions

**Step 1 — Add `overflowPanes` to `WorkspaceLayout`** in `frontend/src/pages/console/types.ts`:
```typescript
interface WorkspaceLayout {
  id: string
  name: string
  layout: LayoutPreset
  panes: PaneConfig[]
  gridItems?: GridItem[]
  overflowPanes?: PaneConfig[]   // add this
  published?: boolean
}
```

**Step 2 — Update `changeLayout` in `workspaceStore.ts`** (around line 157):
```typescript
changeLayout: (id, layout) =>
  set((s) => ({
    workspaces: s.workspaces.map((w) => {
      if (w.id !== id) return w
      const needed = layoutPaneCount(layout)
      const existing = w.panes
      const activeCount = Math.min(existing.length, needed)
      const activePanes = existing.slice(0, activeCount)
      const overflowing = existing.slice(activeCount) // excess panes go here
      // Restore from overflow if new layout has more slots
      const fromOverflow = (w.overflowPanes ?? []).slice(0, needed - activeCount)
      const newBlank = makeBlankPanes(Math.max(0, needed - activeCount - fromOverflow.length))
      const newOverflow = [
        ...overflowing,
        ...(w.overflowPanes ?? []).slice(needed - activeCount),  // remaining overflow
      ]
      return {
        ...w,
        layout,
        panes: [...activePanes, ...fromOverflow, ...newBlank],
        gridItems: undefined,
        overflowPanes: newOverflow,
      }
    }),
  })),
```

**Step 3 — No changes needed** to the undo system — because `changeLayout` goes through `set()`, it is automatically tracked by zundo temporal middleware. Ctrl+Z will restore the previous pane and overflowPanes state.

Do NOT:
- Delete panes from `overflowPanes` when the user explicitly removes them (only delete on explicit Remove action)
- Show overflow panes in the grid — they are hidden; only restored when a larger template is applied
- Truncate `overflowPanes` to a small number — the spec allows all panes to survive indefinitely in the overflow stack
