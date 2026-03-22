# Console Module — Spec Authority

**BEFORE editing any file in this directory**, read the spec:

```
/home/io/spec_docs/console-implementation-spec.md
```

This spec takes priority over design-docs/07_CONSOLE_MODULE.md when they conflict.

Key spec sections to check for common tasks:
- Zustand stores → "3 Zustand stores (WorkspaceStore with zundo, SelectionStore, RealtimeStore)"
- Grid layouts → "16 even templates + 8 asymmetric templates, react-grid-layout v2"
- Real-time update pipeline → "WebSocket → mutable buffer → requestAnimationFrame → O(1) point-to-element lookup → direct DOM mutation"
- Pane interactions → "Every pane interaction: drag-drop, swap, remove, resize, selection, copy/paste, full-screen"

## Non-Negotiables

- **SharedWorker for WebSocket** — one WebSocket connection shared across all Console tabs. Do not open per-tab connections.
- **Real-time updates bypass React entirely** — incoming point values mutate the SVG DOM directly via `data-point-id` lookup. Never call `setState` on the hot path.
- **WorkspaceStore undo/redo uses zundo** — not manual `useRef` stacks or custom history arrays.
- **Grid uses react-grid-layout v2** — not CSS grid, not flexbox, not a custom drag implementation.
- **Auto-save** — workspace layout saves to the server within 2s of any change. No manual save button.

## False-DONE Patterns — Do Not Accept

- WebSocket opened inside a React component or hook (must be SharedWorker)
- `useState` / `useReducer` updating on every point value change
- Undo/redo implemented with custom arrays instead of zundo middleware
- Template switching that replaces the entire DOM instead of preserving pane content
- Missing aspect-ratio lock on panes that contain graphics (aspect ratio must be preserved on resize)
