# Designer Module — Spec Authority

**BEFORE editing any file in this directory**, read the specs in order:

1. **Primary**: `/home/io/spec_docs/designer-implementation-spec.md`
2. **UI details**: `/home/io/spec_docs/designer-ui-prompt.md`

These take priority over design-docs/09_DESIGNER_MODULE.md when they conflict.

## Non-Negotiables

- **SVG.js is a rendering bridge, not the data store** — SVG.js renders what `sceneStore` says. It may be used for hit-testing. It must not own node data, selection state, or history. `sceneStore` is the single source of truth.
- **Three stores, not one** — `sceneStore` (scene graph data), `uiStore` (ephemeral tool/selection state), `historyStore` (command undo stack). Do not merge these.
- **Drag preview exception** — during active drag, SVG DOM may temporarily diverge from `sceneStore` for 60fps performance. On mouseup, commit via `MoveNodeCommand`.
- **Canvas context menus use Radix ContextMenu** — custom `onContextMenu` + `<div>` menu is not acceptable. See spec §6 for the 9 context menu subsections.
- **All 3 designer modes** — Graphics, Dashboard, Report. Ensure all spec-required context menu items exist per mode.

## Gotchas

- **`graphicScope`** — stored in `doc.metadata.graphicScope`, not `doc.scope`. Reading `doc.scope` will always be undefined.
- **DashboardBuilder is gone** — the old DashboardBuilder component was removed during the reconciliation. There is one Designer for all 3 modes (Graphics, Dashboard, Report).

## False-DONE Patterns — Do Not Accept

- SVG.js element properties used as the source of truth for position, size, or node identity
- `sceneStore` mutations outside of commands (bypassing `historyStore`)
- Canvas right-click using a custom implementation instead of Radix `ContextMenu`
- Only one or two designer modes implemented while calling the feature complete
